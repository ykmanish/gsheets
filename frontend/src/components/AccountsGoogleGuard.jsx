"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Lock, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Card, Notice, PageHeader } from "./ui";

// Everything under Finance is gated on Google rather than on a role: the Google account
// must be the email on the raga profile, and Google itself must grant it access to the
// CRBR sheets. Asked once per login — the grant lives on the session, so signing out of
// raga clears it. Shared by the Accounts and Forms sub-modules.

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function muteFor(darkMode) {
  return darkMode ? "text-white/50" : "text-[#8a8a8a]";
}

// The page surface every Finance sub-module sits on.
export function financePage(darkMode) {
  return `flex-1 overflow-y-auto px-4 py-5 newq sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`;
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.1c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C1 16.1 0 19.9 0 23.5s1 7.4 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 47c6.2 0 11.5-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.4 0-11.7-4.4-13.6-10.3l-7.8 6.1C6.5 41.6 14.6 47 24 47z" />
    </svg>
  );
}

function GateScreen({ status, darkMode, onVerify, busy, notice, title }) {
  const muted = muteFor(darkMode);
  const unconfigured = status && status.configured === false;
  const hasEmail = Boolean(status?.profileEmail);
  const problem = unconfigured
    ? { tone: "error", title: "Google sign-in is not set up on the server yet", detail: "An OAuth client ID and secret need adding to the backend environment." }
    : !hasEmail
      ? { tone: "error", title: "Your raga profile has no email address", detail: "There is nothing to match a Google account against. Ask an admin to add it." }
      : notice;

  return (
    <main className={financePage(darkMode)}>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          darkMode={darkMode}
          badge="Finance · locked"
          badgeIcon={Lock}
          badgeTone="amber"
          title={`${title} is locked`}
          subtitle="sign in with Google to continue"
          description="Use the Google account that has access to the CRBR sheets. It has to be the same address as your raga profile."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card darkMode={darkMode} icon={FileSpreadsheet} tone="sky" title="Google check" subtitle="Asked once per login">
            <div className="grid gap-3">
              {hasEmail && (
                <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[14px] px-4 py-3 ${darkMode ? "bg-white/[0.05]" : "bg-[#f7f7f5]"}`}>
                  <span className={`text-[12.5px] ${muted}`}>Your profile email</span>
                  <span className="break-all text-[14px]">{status.profileEmail}</span>
                </div>
              )}
              {problem && (
                <Notice tone={problem.tone === "error" ? "red" : "amber"} darkMode={darkMode} icon={AlertTriangle}>
                  <p>{problem.title}</p>
                  {problem.detail ? <p className="mt-0.5 opacity-75">{problem.detail}</p> : null}
                </Notice>
              )}
            </div>
          </Card>

          {!unconfigured && (
            <div className={`flex flex-col justify-between gap-4 rounded-[20px] p-5 ${darkMode ? "bg-[#cff07a]/15" : "bg-[#d4f28a]"}`}>
              <div>
                <span className={`grid h-9 w-9 place-items-center rounded-[11px] ${darkMode ? "bg-white/10" : "bg-white/70"}`}><Lock className="h-4 w-4" strokeWidth={1.8} /></span>
                <p className="mt-4 text-[15px]">Unlock {title}</p>
                <p className={`mt-1 text-[12.5px] ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>Google confirms the account and its sheet access.</p>
              </div>
              <Button
                darkMode={darkMode}
                variant="primary"
                size="lg"
                onClick={onVerify}
                disabled={busy || !hasEmail}
                className="w-full"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-white"><GoogleMark /></span>}
                Continue with Google
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Wraps a Finance sub-module. Renders the gate until Google has verified this session,
 * then calls children with the grant so the page can respect view-only access.
 */
export default function AccountsGoogleGuard({ darkMode, title = "This module", children }) {
  const [gate, setGate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const checkGate = useCallback(async () => {
    try {
      const status = await api("/accounts/google/status");
      setGate(status);
      return status;
    } catch (error) {
      setGate({ configured: true, verified: false });
      toast.error(error.message || "Could not check Google verification");
      return null;
    }
  }, []);

  // The Google callback bounces back with the outcome in the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (!result) return;
    const reason = params.get("reason") || "";
    if (result === "ok") toast.success("Google verified");
    else if (result === "mismatch") setNotice({ tone: "error", title: "That is not the account on your profile", detail: reason });
    else if (result === "denied") setNotice({ tone: "error", title: "No access to the CRBR sheets", detail: reason || "Ask whoever owns the sheets to share them with this Google account." });
    else setNotice({ tone: "error", title: "Google verification failed", detail: reason });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => { void checkGate(); }, [checkGate]);

  async function startGoogle() {
    try {
      setBusy(true);
      const { url } = await api("/accounts/google/start", { method: "POST" });
      window.location.href = url;
    } catch (error) {
      setBusy(false);
      toast.error(error.message || "Could not start Google sign-in");
    }
  }

  async function signOutGoogle() {
    try {
      await api("/accounts/google/revoke", { method: "POST" });
      setNotice(null);
      await checkGate();
      toast.success("Signed out of Finance");
    } catch (error) {
      toast.error(error.message || "Could not sign out");
    }
  }

  if (!gate) {
    return (
      <main className={`grid flex-1 place-items-center newq ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
        <div className={`flex items-center gap-3 text-[13.5px] ${muteFor(darkMode)}`}><Loader2 className="h-5 w-5 animate-spin" /> Checking access…</div>
      </main>
    );
  }

  if (!gate.verified) {
    return <GateScreen status={gate} darkMode={darkMode} onVerify={startGoogle} busy={busy} notice={notice} title={title} />;
  }

  return children({ gate, signOutGoogle });
}

// The "signed in as x — click to sign out" button each sub-module puts in its header.
export function GoogleSessionButton({ gate, onSignOut, darkMode }) {
  return (
    <Button
      darkMode={darkMode}
      variant="secondary"
      onClick={onSignOut}
      title={`Signed in as ${gate.email}${gate.canManage ? "" : " · view only"}`}
      icon={LogOut}
    >
      <span className="max-w-[160px] truncate">{gate.email}</span>
    </Button>
  );
}
