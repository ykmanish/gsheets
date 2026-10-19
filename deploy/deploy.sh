#!/usr/bin/env bash
# Deploys a release tarball (a `git archive` of this repo) on the production
# server. Run by .github/workflows/deploy.yml; can also be run by hand:
#
#   bash deploy.sh /tmp/release.tar.gz <git-sha>
#   DRY_RUN=1 bash deploy.sh /tmp/release.tar.gz <git-sha>   # build only, don't go live
#
# Layout under /var/www:
#   releases/<utc-time>-<sha>/{backend,frontend}  one directory per deploy
#   shared/                                       server state that outlives deploys
#   app -> releases/<id>                          what the raga-* systemd units run
#
# A release is fully installed and built before `app` is repointed, so a failed
# install or build never touches the live site. After the switch both services
# restart and are health-checked; if they don't come up, `app` goes back to the
# previous release.
set -Eeuo pipefail

TARBALL="${1:?usage: deploy.sh <release.tar.gz> [git-sha]}"
SHA="${2:-unknown}"
DRY_RUN="${DRY_RUN:-0}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"

BASE=/var/www
APP="$BASE/app"
RELEASES="$BASE/releases"
SHARED="$BASE/shared"
SERVICES=(raga-backend raga-frontend)

# Repo-relative paths that hold server state rather than code. In every release
# each one is a symlink into $SHARED, so deploys never overwrite them.
SHARED_DIRS=(backend/data backend/uploads backend/vectors)
SHARED_FILES=(backend/.env backend/sheet_account.json backend/vertex-sa.json backend/eng.traineddata frontend/.env.local)

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

[ -O "$BASE" ] || sudo chown "$(id -un):$(id -gn)" "$BASE"
mkdir -p "$RELEASES" "$SHARED/backend" "$SHARED/frontend"

exec 9>"$BASE/.deploy.lock"
flock -w 900 9 || { log "another deploy is still running"; exit 1; }

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-${SHA:0:7}"
RELEASE="$RELEASES/$RELEASE_ID"
PREVIOUS="$(readlink -f "$APP" 2>/dev/null || true)"
SWITCHED=0
STOPPED=0

# The first deploy finds the hand-copied tree as a real directory at $APP.
LEGACY=0
if [ -d "$APP" ] && [ ! -L "$APP" ]; then LEGACY=1; fi

cleanup() {
  local rc=$?
  rm -f "$TARBALL"
  if [ "$STOPPED" = 1 ] && [ "$SWITCHED" = 0 ]; then
    log "failed while the services were stopped; putting the old tree back"
    [ -e "$APP" ] || mv -T "$PREVIOUS" "$APP" || true
    sudo systemctl start "${SERVICES[@]}" || true
  fi
  if [ "$SWITCHED" = 0 ] && [ -d "$RELEASE" ] && { [ "$rc" != 0 ] || [ "$DRY_RUN" = 1 ]; }; then
    rm -rf "$RELEASE"
  fi
  exit "$rc"
}
trap cleanup EXIT

avail_kb="$(df --output=avail -k "$BASE" | tail -1 | tr -d ' ')"
if [ "$avail_kb" -lt 2500000 ]; then
  log "only $((avail_kb / 1024)) MB free on $BASE; need ~2.5 GB for a release with fresh dependencies"
  exit 1
fi

# Copy a path's current contents into $SHARED: dirs are merged, files overwritten.
sync_to_shared() {
  local src="$1" p="$2"
  if [ -d "$src/$p" ] && [ ! -L "$src/$p" ]; then
    mkdir -p "$SHARED/$p"
    rsync -a "$src/$p/" "$SHARED/$p/"
  elif [ -f "$src/$p" ] && [ ! -L "$src/$p" ]; then
    rsync -a "$src/$p" "$SHARED/$p"
  fi
}

if [ "$LEGACY" = 1 ]; then
  log "first deploy: seeding $SHARED from the hand-deployed tree at $APP"
  for p in "${SHARED_DIRS[@]}" "${SHARED_FILES[@]}"; do sync_to_shared "$APP" "$p"; done
fi
[ -f "$SHARED/backend/.env" ] || { log "missing $SHARED/backend/.env; refusing to deploy"; exit 1; }

log "extracting release $RELEASE_ID"
mkdir -p "$RELEASE"
tar -xzf "$TARBALL" -C "$RELEASE"
printf '%s\n' "$SHA" > "$RELEASE/REVISION"

for p in "${SHARED_DIRS[@]}"; do
  mkdir -p "$SHARED/$p"
  if [ -d "$RELEASE/$p" ]; then
    # Tracked defaults (e.g. backend/data/*.json) only fill gaps; the server's copy wins.
    rsync -a --ignore-existing "$RELEASE/$p/" "$SHARED/$p/"
    rm -rf "$RELEASE/$p"
  fi
  ln -s "$SHARED/$p" "$RELEASE/$p"
done
for p in "${SHARED_FILES[@]}"; do
  if [ -e "$RELEASE/$p" ]; then
    [ -e "$SHARED/$p" ] || rsync -a "$RELEASE/$p" "$SHARED/$p"
    rm -f "$RELEASE/$p"
  fi
  if [ -e "$SHARED/$p" ]; then
    ln -s "$SHARED/$p" "$RELEASE/$p"
  else
    log "warning: $SHARED/$p does not exist, not linked"
  fi
done

deps_key() { cat "$1/package.json" "$1/package-lock.json" | sha256sum | cut -d' ' -f1; }

# Reuse the previous release's node_modules (as hard links, so it costs no
# space) when package.json and the lockfile are unchanged; otherwise npm ci.
install_deps() {
  local dir="$1"; shift
  local new="$RELEASE/$dir" prev="$PREVIOUS/$dir" key
  key="$(deps_key "$new")"
  if [ -n "$PREVIOUS" ] && [ "$(cat "$prev/node_modules/.deploy-deps-key" 2>/dev/null)" = "$key" ]; then
    log "$dir: dependencies unchanged, linking node_modules from $(basename "$PREVIOUS")"
    rsync -a --link-dest="$prev/node_modules/" "$prev/node_modules/" "$new/node_modules/"
  else
    log "$dir: installing dependencies (npm ci $*)"
    (cd "$new" && npm ci --no-audit --no-fund "$@")
  fi
  rm -f "$new/node_modules/.deploy-deps-key"
  printf '%s\n' "$key" > "$new/node_modules/.deploy-deps-key"
}

install_deps backend --omit=dev
node --check "$RELEASE/backend/server.js"
install_deps frontend
log "frontend: building"
(cd "$RELEASE/frontend" && NODE_OPTIONS=--max-old-space-size=4096 npm run build)

if [ "$DRY_RUN" = 1 ]; then
  log "dry run: release $RELEASE_ID installed and built; removing it without going live"
  exit 0
fi

point_app_at() {
  ln -sfn "$1" "$APP.next"
  mv -T "$APP.next" "$APP"
}

healthy() {
  local _
  for _ in $(seq 1 45); do
    if curl -fsS -m 5 -o /dev/null http://127.0.0.1:5000/health &&
       curl -fsS -m 5 -o /dev/null http://127.0.0.1:3000/login; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if [ "$LEGACY" = 1 ]; then
  # Stop first so nothing writes to the old tree between the final sync and the switch.
  log "stopping services for the one-time move to $SHARED"
  STOPPED=1
  sudo systemctl stop "${SERVICES[@]}"
  for p in "${SHARED_DIRS[@]}" "${SHARED_FILES[@]}"; do sync_to_shared "$APP" "$p"; done
  PREVIOUS="$RELEASES/legacy-$(date -u +%Y%m%d%H%M%S)"
  mv -T "$APP" "$PREVIOUS"
  log "old tree kept at $PREVIOUS"
fi

log "switching $APP -> $RELEASE"
point_app_at "$RELEASE"
SWITCHED=1
sudo systemctl restart "${SERVICES[@]}" || true

if ! healthy; then
  log "health check failed; recent logs:"
  sudo journalctl -u raga-backend -u raga-frontend --no-pager -n 40 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    log "rolling back to $(basename "$PREVIOUS")"
    point_app_at "$PREVIOUS"
    sudo systemctl restart "${SERVICES[@]}" || true
    healthy && log "rollback is serving" || log "rollback is not healthy either"
  fi
  exit 1
fi
log "live: $RELEASE_ID ($SHA)"

# Keep the newest releases plus whatever is live or was live just before.
# legacy-* trees from the first deploy are never removed automatically.
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{14}-[^/]*' -printf '%f\n' |
  sort -r | tail -n +"$((KEEP_RELEASES + 1))" |
  while read -r old; do
    [ "$RELEASES/$old" = "$RELEASE" ] || [ "$RELEASES/$old" = "$PREVIOUS" ] && continue
    log "removing old release $old"
    rm -rf -- "${RELEASES:?}/$old"
  done
