"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, Bookmark, BookmarkCheck, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Eye, History, KeyRound, Loader2, MapPin, RefreshCw, Search, Send, Settings2, Sparkles, Star, Trash2, UserRoundSearch, Users, X } from "lucide-react";
import { API_URL } from "./AuthProvider";
import { showAppToast } from "./ToastPill";
import { SelectMenu } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.data = data;
    throw error;
  }
  return data;
}

const PLATFORM_TONES = {
  linkedin: { light: "bg-[#e8f0fe] text-[#1a56c4]", dark: "bg-[#2563eb]/15 text-[#93c5fd]" },
  indeed: { light: "bg-[#eef0ff] text-[#3b45c9]", dark: "bg-indigo-400/15 text-indigo-200" },
  foundit: { light: "bg-[#fdeef3] text-[#c2185b]", dark: "bg-pink-400/15 text-pink-200" },
  naukri: { light: "bg-[#fff2e5] text-[#c2621a]", dark: "bg-amber-400/15 text-amber-200" },
  github: { light: "bg-[#f1f2f4] text-[#24292f]", dark: "bg-white/10 text-white/75" },
  other: { light: "bg-[#f1f4f8] text-slate-600", dark: "bg-white/10 text-white/60" },
};

const STATUS_TONES = {
  sourced: { light: "bg-slate-100 text-slate-600", dark: "bg-white/10 text-white/65" },
  contacted: { light: "bg-blue-50 text-blue-700", dark: "bg-blue-400/15 text-blue-200" },
  screening: { light: "bg-violet-50 text-violet-700", dark: "bg-violet-400/15 text-violet-200" },
  interview: { light: "bg-amber-50 text-amber-700", dark: "bg-amber-400/15 text-amber-200" },
  offer: { light: "bg-cyan-50 text-cyan-700", dark: "bg-cyan-400/15 text-cyan-200" },
  hired: { light: "bg-emerald-50 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-200" },
  rejected: { light: "bg-rose-50 text-rose-700", dark: "bg-rose-400/15 text-rose-200" },
};

const COUNTRY_OPTIONS = [
  { value: "in", label: "India" },
  { value: "us", label: "United States" },
  { value: "gb", label: "United Kingdom" },
  { value: "ae", label: "UAE" },
  { value: "sg", label: "Singapore" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
];

const EMPTY_FORM = {
  keyword: "",
  skills: [],
  experienceMin: "",
  experienceMax: "",
  location: "",
  company: "",
  excludeTerms: "",
  mode: "candidates",
  platforms: ["linkedin", "indeed", "foundit"],
  country: "in",
};

const EMPTY_SETTINGS = { projectId: "", location: "global", dataStoreId: "", engineId: "", collectionId: "default_collection" };

function settingsFormFrom(settings = {}) {
  return {
    projectId: settings.projectId || "",
    location: settings.location || "global",
    dataStoreId: settings.dataStoreId || "",
    engineId: settings.engineId || "",
    collectionId: settings.collectionId || "default_collection",
  };
}

function initials(name = "?") {
  return String(name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function Pill({ tone = "other", map = PLATFORM_TONES, darkMode, children, className = "" }) {
  const entry = map[tone] || map.other || PLATFORM_TONES.other;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${darkMode ? entry.dark : entry.light} ${className}`}>{children}</span>;
}

// Deliberately a div, not a label: these fields wrap buttons (SelectMenu, skill
// chip removers) as well as inputs, and an unlabelled <label> forwards clicks on
// its text to the first labelable descendant — which would silently delete the
// first skill chip when someone clicks the word "Skills".
function Field({ label, children, hint, darkMode }) {
  return (
    <div role="group" aria-label={label} className="block min-w-0">
      <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</span>
      {children}
      {hint ? <span className={`mt-1 block text-[11px] ${darkMode ? "text-white/35" : "text-black/40"}`}>{hint}</span> : null}
    </div>
  );
}

function EmptyState({ darkMode, icon: Icon, title, text, action }) {
  return (
    <div className={`grid min-h-[240px] place-items-center rounded-[24px] p-6 text-center ${darkMode ? "bg-white/[0.04]" : "bg-[#f8f9fc]"}`}>
      <div>
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${darkMode ? "bg-white/10 text-white/70" : "bg-[#e8f0fe] text-[#2563eb]"}`}>
          <Icon className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-xl font-black">{title}</h3>
        <p className={`mt-2 max-w-lg text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/55"}`}>{text}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

// Deterministic per-person, so the same face keeps the same colours between
// renders and pages instead of flickering as results reshuffle. Each hue has a
// dark-mode pair — the light pastels glare badly against a near-black page.
const AVATAR_TINTS = [
  { light: ["#dbeafe", "#93c5fd", "#1e40af"], dark: ["#12233f", "#1e3a6b", "#93c5fd"] },
  { light: ["#fae8ff", "#f0abfc", "#86198f"], dark: ["#2c1233", "#4a1d56", "#f0abfc"] },
  { light: ["#dcfce7", "#86efac", "#166534"], dark: ["#0f2a1c", "#17492f", "#86efac"] },
  { light: ["#ffedd5", "#fdba74", "#9a3412"], dark: ["#331d0d", "#5a3316", "#fdba74"] },
  { light: ["#e0e7ff", "#a5b4fc", "#3730a3"], dark: ["#1a1b3d", "#2c2e63", "#a5b4fc"] },
  { light: ["#fee2e2", "#fca5a5", "#991b1b"], dark: ["#331414", "#5c2222", "#fca5a5"] },
];
function tintFor(seed = "", darkMode = false) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  const entry = AVATAR_TINTS[hash % AVATAR_TINTS.length];
  return darkMode ? entry.dark : entry.light;
}

function CardStat({ icon: Icon, value, label, darkMode, accent }) {
  return (
    <div className="min-w-0 px-1 text-center">
      <p className={`flex items-center justify-center gap-1 truncate text-[13px] font-black ${accent || ""}`}>
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        <span className="truncate">{value}</span>
      </p>
      <p className={`mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.07em] ${darkMode ? "text-white/40" : "text-black/40"}`}>{label}</p>
    </div>
  );
}

// One card shape for both halves of the module: search results in the drawer
// and saved candidates on the dashboard. Only the footer action differs, so the
// person always looks the same wherever they appear.
//
// The avatar is deliberately a small round thumbnail rather than a hero image —
// these are search results to be scanned a screenful at a time, and a big photo
// pushed the name, skills and match score below the fold.
function ProfileCard({ person, darkMode, saved, onSave, onOpen, onRemove, saving, stats, action }) {
  const [bg, ring, ink] = tintFor(person.name || person.link || "", darkMode);
  const bio = person.snippet || person.headline || "No public summary on this profile.";
  // Only ever shown when the parser actually found them; LinkedIn publishes
  // neither on most profiles.
  const facts = [person.location, person.company].filter(Boolean);

  return (
    <article className={`group flex flex-col rounded-[20px] border p-4 transition ${
      darkMode
        ? "border-white/[0.08] bg-[#0f1319] hover:border-white/[0.16]"
        : "border-black/[0.07] bg-white hover:border-black/[0.14] hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
    }`}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {person.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.thumbnail} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div
              className="grid h-14 w-14 place-items-center rounded-full"
              style={{ background: `radial-gradient(circle at 30% 25%, ${ring} 0%, ${bg} 70%)` }}
            >
              <span className="text-base font-black tracking-tight" style={{ color: ink }}>{initials(person.name)}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h4 className="truncate text-[15px] font-black leading-tight">{person.name}</h4>
            {saved ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" /> : null}
          </div>
          {facts.length ? (
            <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
              {person.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{person.location}</span> : null}
              {person.company ? <span className="inline-flex items-center gap-1 truncate"><Building2 className="h-3 w-3 shrink-0" />{person.company}</span> : null}
            </p>
          ) : null}
        </div>

        {onSave || onRemove ? (
          <button
            type="button"
            onClick={saved && onRemove ? onRemove : onSave}
            disabled={saving}
            title={saved ? "Remove from pipeline" : "Save to pipeline"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-60 ${
              saved
                ? "bg-[#2563eb] text-white"
                : darkMode ? "bg-white/[0.07] text-white/60 hover:bg-white/[0.14] hover:text-white" : "bg-[#f1f4f8] text-slate-500 hover:bg-[#e5eaf2] hover:text-slate-700"
            }`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      <p className={`mt-3 line-clamp-2 text-[12.5px] leading-5 ${darkMode ? "text-white/50" : "text-black/52"}`}>{bio}</p>

      <div className={`mt-3 grid grid-cols-3 divide-x rounded-xl py-2 ${
        darkMode ? "divide-white/[0.08] bg-white/[0.04]" : "divide-black/[0.06] bg-[#f7f8fb]"
      }`}>
        {stats.map((stat) => <CardStat key={stat.label} {...stat} darkMode={darkMode} />)}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black transition ${
          darkMode ? "bg-white text-[#0b0f14] hover:bg-white/90" : "bg-[#111827] text-white hover:bg-[#1f2937]"
        }`}
      >
        {action.icon ? <action.icon className="h-4 w-4" /> : null} {action.label}
      </button>
    </article>
  );
}

export default function RecruitmentDashboard({ darkMode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pipeline");
  // Search lives in a drawer over the dashboard, so saving a candidate drops
  // them onto the grid already visible behind it.
  const [searchOpen, setSearchOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [skillInput, setSkillInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // The page number is the whole cursor — the backend maps each page to a fixed
  // offset window per platform, so page N is stable and Back needs no state.
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [queryOpen, setQueryOpen] = useState(false);
  const [savingLink, setSavingLink] = useState("");
  // Holds the candidate awaiting a remove confirmation. window.confirm is an OS
  // dialog that ignores the app's theme and blocks the whole tab.
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(EMPTY_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState("all");
  const [pipelineQuery, setPipelineQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailNotes, setDetailNotes] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);

  const muted = darkMode ? "text-slate-400" : "text-black/58";
  const panel = darkMode ? "bg-[#090d12]" : "bg-white";
  const soft = darkMode ? "bg-white/[0.045]" : "bg-[#f7f8fb]";
  const inputClass = `h-11 w-full rounded-2xl border px-4 text-sm outline-none transition ${darkMode ? "border-white/10 bg-white/[0.035] text-white placeholder:text-white/30 focus:border-white/25" : "border-black/10 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#2563eb]/40"}`;

  const toast = useMemo(() => ({
    success: (message, detailText) => showAppToast(message, { type: "success", darkMode, detail: detailText }),
    error: (message, detailText) => showAppToast(message, { type: "error", darkMode, detail: detailText }),
    info: (message, detailText) => showAppToast(message, { type: "info", darkMode, detail: detailText }),
  }), [darkMode]);

  useEffect(() => {
    if (!pendingRemove) return undefined;
    const onKey = (event) => { if (event.key === "Escape" && !removing) setPendingRemove(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingRemove, removing]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setSearchOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  const applyData = useCallback((result) => {
    setData(result);
    setSettingsForm(settingsFormFrom(result.settings));
    setForm((current) => ({ ...current, platforms: current.platforms.length ? current.platforms : result.defaultPlatforms || [] }));
  }, []);

  async function load({ quiet = false } = {}) {
    try {
      if (!quiet) setLoading(true);
      applyData(await api("/hr/recruitment"));
    } catch (error) {
      if (!quiet) showAppToast(error.message || "Could not load recruitment", { type: "error", darkMode });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const result = await api("/hr/recruitment");
        if (!ignore) applyData(result);
      } catch (error) {
        if (!ignore) showAppToast(error.message || "Could not load recruitment", { type: "error", darkMode });
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void loadInitial();
    return () => { ignore = true; };
  }, [applyData, darkMode]);

  const platforms = useMemo(() => data?.platforms || [], [data]);
  const statuses = useMemo(() => data?.statuses || [], [data]);
  const candidates = useMemo(() => data?.candidates || [], [data]);
  const searches = useMemo(() => data?.searches || [], [data]);
  const configured = Boolean(data?.settings?.configured);
  const canManage = Boolean(data?.canManage);
  const savedLinks = useMemo(() => new Map(candidates.map((candidate) => [candidate.link, candidate])), [candidates]);
  // Only platform/mode mismatches and explicit exclude words remove a result
  // now; skills and location merely rank, so nothing else can go missing.
  const hiddenCount = (meta?.filtered?.offPlatform || 0) + (meta?.filtered?.excluded || 0);
  // Each platform runs its own query, so showing the per-platform yield makes it
  // obvious which board came back empty rather than leaving it to guesswork.
  const platformBreakdown = useMemo(() => {
    const counts = meta?.perPlatformCounts;
    if (!counts) return "";
    return Object.entries(counts)
      .map(([id, count]) => `${platforms.find((platform) => platform.id === id)?.label || id} ${count}`)
      .join(" · ");
  }, [meta, platforms]);

  const activeCount = candidates.filter((candidate) => !["hired", "rejected"].includes(candidate.status)).length;
  const hiredCount = candidates.filter((candidate) => candidate.status === "hired").length;

  const filteredPipeline = useMemo(() => {
    const search = pipelineQuery.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (pipelineStatus !== "all" && candidate.status !== pipelineStatus) return false;
      if (!search) return true;
      return [candidate.name, candidate.headline, candidate.company, candidate.location, candidate.role, candidate.notes]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [candidates, pipelineQuery, pipelineStatus]);

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function addSkill(raw) {
    const cleaned = String(raw || "").trim().replace(/,$/, "");
    if (!cleaned) return;
    setForm((current) => {
      if (current.skills.some((skill) => skill.toLowerCase() === cleaned.toLowerCase())) return current;
      if (current.skills.length >= 10) {
        showAppToast("Up to 10 skills per search", { type: "info", darkMode });
        return current;
      }
      return { ...current, skills: [...current.skills, cleaned] };
    });
    setSkillInput("");
  }

  function togglePlatform(id) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(id) ? current.platforms.filter((item) => item !== id) : [...current.platforms, id],
    }));
  }

  // Switching mode drops the platforms that cannot answer it and falls back to
  // the ones that can, so a mode flip never leaves an unanswerable selection.
  function switchMode(mode) {
    setForm((current) => {
      const usable = platforms.filter((platform) => !platform.supports || platform.supports.includes(mode)).map((platform) => platform.id);
      const kept = current.platforms.filter((id) => usable.includes(id));
      return { ...current, mode, platforms: kept.length ? kept : usable };
    });
  }

  async function runSearch({ toPage = 1, override } = {}) {
    const payload = { ...(override || form), page: toPage };
    if (!payload.keyword.trim() && !payload.skills.length) {
      toast.error("Add a role keyword or at least one skill");
      return;
    }
    if (!payload.platforms.length) {
      toast.error("Pick at least one platform");
      return;
    }
    try {
      if (toPage === 1) setSearching(true);
      else setLoadingMore(true);
      const result = await api("/hr/recruitment/search", { method: "POST", body: JSON.stringify(payload) });
      setMeta(result);
      setResults(result.results);
      setPage(toPage);
      if (!result.results.length) {
        const dropped = result.filtered || {};
        // Skills and location no longer drop anything, so an empty page means
        // the platform/mode pairing found nothing — say which pairing works.
        if (dropped.offPlatform > 0) {
          toast.info(
            payload.mode === "candidates" ? "No candidate profiles on these platforms" : "No job posts on these platforms",
            payload.mode === "candidates"
              ? "Only LinkedIn and GitHub publish crawlable candidate profiles. Indeed, Foundit and Naukri keep seeker profiles behind a login — switch to Job posts for those."
              : "Try LinkedIn, Indeed, Foundit or Naukri for job posts. GitHub has none.",
          );
        } else {
          toast.info("Vertex AI Search returned no matches", "Try a broader role keyword — skills and location now only rank results, so they cannot be the cause.");
        }
      }
      void load({ quiet: true });
    } catch (error) {
      if (error.data?.needsSetup) setSettingsOpen(true);
      toast.error(error.message || "Search failed");
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }

  async function saveCandidate(result) {
    try {
      setSavingLink(result.link);
      const saved = await api("/hr/recruitment/candidates", {
        method: "POST",
        body: JSON.stringify({ ...result, role: form.keyword }),
      });
      toast.success(`${saved.candidate.name} added to the pipeline`);
      await load({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Could not save candidate");
    } finally {
      setSavingLink("");
    }
  }

  async function updateCandidate(id, patch, { quiet = false } = {}) {
    try {
      const saved = await api(`/hr/recruitment/candidates/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setData((current) => (current ? { ...current, candidates: current.candidates.map((item) => (item.id === id ? saved.candidate : item)) } : current));
      if (!quiet) toast.success("Candidate updated");
      return saved.candidate;
    } catch (error) {
      toast.error(error.message || "Could not update candidate");
      return null;
    }
  }

  async function confirmRemoveCandidate() {
    const candidate = pendingRemove;
    if (!candidate) return;
    try {
      setRemoving(true);
      await api(`/hr/recruitment/candidates/${candidate.id}`, { method: "DELETE" });
      toast.success(`${candidate.name} removed from the pipeline`);
      if (detail?.id === candidate.id) setDetail(null);
      setPendingRemove(null);
      await load({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Could not remove candidate");
    } finally {
      setRemoving(false);
    }
  }

  async function removeSearch(id) {
    try {
      await api(`/hr/recruitment/searches/${id}`, { method: "DELETE" });
      await load({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Could not remove search");
    }
  }

  function rerunSearch(entry) {
    const next = {
      ...EMPTY_FORM,
      keyword: entry.keyword || "",
      skills: entry.skills || [],
      experienceMin: entry.experienceMin ?? "",
      experienceMax: entry.experienceMax ?? "",
      location: entry.location || "",
      company: entry.company || "",
      platforms: entry.platforms?.length ? entry.platforms : EMPTY_FORM.platforms,
      mode: entry.mode || "candidates",
    };
    setForm(next);
    setTab("search");
    void runSearch({ override: next });
  }

  async function saveSettings() {
    try {
      setSettingsSaving(true);
      const result = await api("/hr/recruitment/settings", {
        method: "PUT",
        body: JSON.stringify({
          projectId: settingsForm.projectId.trim(),
          location: settingsForm.location,
          dataStoreId: settingsForm.dataStoreId.trim(),
          engineId: settingsForm.engineId.trim(),
          collectionId: settingsForm.collectionId.trim(),
        }),
      });
      setData((current) => (current ? { ...current, settings: result.settings } : current));
      setSettingsForm(settingsFormFrom(result.settings));
      setSettingsOpen(false);
      toast.success("Vertex AI Search connected");
    } catch (error) {
      toast.error(error.message || "Could not save settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  function openDetail(candidate) {
    setDetail(candidate);
    setDetailNotes(candidate.notes || "");
  }

  async function saveDetailNotes() {
    if (!detail) return;
    setDetailSaving(true);
    const saved = await updateCandidate(detail.id, { notes: detailNotes });
    if (saved) setDetail(saved);
    setDetailSaving(false);
  }

  const tabs = [
    { id: "pipeline", label: `Candidates${candidates.length ? ` (${candidates.length})` : ""}`, icon: Users },
    { id: "history", label: "History", icon: History },
  ];

  const stats = [
    { label: "Saved candidates", value: candidates.length, icon: Users },
    { label: "In pipeline", value: activeCount, icon: UserRoundSearch },
    { label: "Hired", value: hiredCount, icon: BookmarkCheck },
    { label: "Searches run", value: searches.length, icon: Search },
  ];

  return (
    <main className={`flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#05080c] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`}>
      <section className={`rounded-[28px] ${panel}`}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-black">Recruitment</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${configured ? (darkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-50 text-emerald-700") : darkMode ? "bg-amber-400/15 text-amber-200" : "bg-amber-50 text-amber-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${configured ? "bg-emerald-500" : "bg-amber-500"}`} />
                {configured ? "Vertex AI Search connected" : "Setup needed"}
              </span>
            </div>
            <p className={`mt-1 text-sm ${muted}`}>Source candidates and job posts from LinkedIn, Indeed, Foundit and more using Google Vertex AI Search.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              disabled={!configured}
              className="flex h-10 items-center gap-2 rounded-full bg-[#2563eb] px-5 text-sm font-black text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              <Search className="h-4 w-4" /> New search
            </button>
            {canManage ? (
              <button type="button" onClick={() => setSettingsOpen(true)} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f4f8]"}`}>
                <Settings2 className="h-4 w-4" /> Settings
              </button>
            ) : null}
            <button type="button" onClick={() => load()} disabled={loading} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f4f8]"}`}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`rounded-2xl p-4 ${soft}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#2563eb]"}`}>
                  <stat.icon className="h-4 w-4" />
                </span>
                <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${muted}`}>{stat.label}</span>
              </div>
              <p className="mt-2 text-3xl font-black">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className={`flex gap-1 border-t px-3 py-2 ${darkMode ? "border-white/[0.06]" : "border-black/[0.06]"}`}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
                tab === item.id
                  ? darkMode ? "bg-[#2563eb]/20 text-[#93c5fd]" : "bg-[#2563eb]/10 text-[#2563eb]"
                  : darkMode ? "text-white/55 hover:bg-white/[0.06]" : "text-slate-500 hover:bg-black/[0.04]"
              }`}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </div>
      </section>

      {!configured && !loading ? (
        <section className={`rounded-[28px] p-5 ${panel}`}>
          <EmptyState
            darkMode={darkMode}
            icon={KeyRound}
            title="Connect Google Vertex AI Search"
            text={canManage
              ? "Create a Vertex AI Search website data store in Google Cloud, add the job-board URL patterns to it, then paste the project and data store IDs into settings. The server signs every request with its existing service account."
              : "An HR manager needs to connect the Vertex AI Search data store before candidate search can run."}
            action={canManage ? (
              <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-11 items-center gap-2 rounded-full bg-[#2563eb] px-6 text-sm font-black text-white transition hover:bg-[#1d4ed8]">
                <Settings2 className="h-4 w-4" /> Open settings
              </button>
            ) : null}
          />
        </section>
      ) : null}


      {tab === "pipeline" ? (
        <section className={`rounded-[28px] ${panel}`}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-black">Candidate pipeline</h3>
              <p className={`mt-1 text-sm ${muted}`}>Everyone saved from search, with their current hiring stage.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                <input value={pipelineQuery} onChange={(event) => setPipelineQuery(event.target.value)} placeholder="Search name, role, company..." className={`${inputClass} pl-11 sm:w-72`} />
              </div>
              <div className="sm:w-48">
                <SelectMenu
                  darkMode={darkMode}
                  value={pipelineStatus}
                  options={[{ value: "all", label: "All stages" }, ...statuses.map((status) => ({ value: status.id, label: status.label }))]}
                  onChange={setPipelineStatus}
                />
              </div>
            </div>
          </div>

          {filteredPipeline.length ? (
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPipeline.map((candidate) => (
                <div key={candidate.id} className="flex flex-col gap-2">
                  <ProfileCard
                    person={candidate}
                    darkMode={darkMode}
                    saved
                    onRemove={() => setPendingRemove(candidate)}
                    onOpen={() => openDetail(candidate)}
                    stats={[
                      { value: statuses.find((status) => status.id === candidate.status)?.label || "Sourced", label: "Stage" },
                      { value: candidate.platformLabel || "-", label: "Source" },
                      { value: candidate.role || "-", label: "For role" },
                    ]}
                    action={{ icon: Send, label: "Get in touch" }}
                  />
                  {/* Stage is the one field a recruiter changes constantly, so it
                      stays reachable without opening the card. */}
                  <SelectMenu
                    darkMode={darkMode}
                    value={candidate.status}
                    options={statuses.map((status) => ({ value: status.id, label: status.label }))}
                    onChange={(value) => updateCandidate(candidate.id, { status: value })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                darkMode={darkMode}
                icon={Users}
                title={candidates.length ? "No candidates match this filter" : "No candidates yet"}
                text={candidates.length
                  ? "Clear the search or stage filter to see everyone."
                  : "Hit New search to source profiles from LinkedIn, GitHub and the job boards. Anyone you save lands here."}
                action={candidates.length ? null : (
                  <button type="button" onClick={() => setSearchOpen(true)} disabled={!configured} className="flex h-11 items-center gap-2 rounded-full bg-[#2563eb] px-6 text-sm font-black text-white transition hover:bg-[#1d4ed8] disabled:opacity-50">
                    <Search className="h-4 w-4" /> New search
                  </button>
                )}
              />
            </div>
          )}
        </section>
      ) : null}

      {tab === "history" ? (
        <section className={`rounded-[28px] ${panel}`}>
          <div className="p-5">
            <h3 className="text-lg font-black">Recent searches</h3>
            <p className={`mt-1 text-sm ${muted}`}>The last 25 searches your team ran. Re-run one to pull fresh results.</p>
          </div>
          <div className="space-y-2 px-5 pb-5">
            {searches.length ? searches.map((entry) => (
              <div key={entry.id} className={`flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${soft}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">{entry.keyword || entry.skills.join(", ") || "Untitled search"}</p>
                    <Pill tone="other" darkMode={darkMode}>{entry.mode === "jobs" ? "Job posts" : "Candidates"}</Pill>
                    {entry.platforms.map((id) => (
                      <Pill key={id} tone={id} darkMode={darkMode}>{platforms.find((platform) => platform.id === id)?.label || id}</Pill>
                    ))}
                  </div>
                  <p className={`mt-1 text-xs ${muted}`}>
                    {[
                      entry.skills.length ? entry.skills.join(", ") : "",
                      entry.experienceMin || entry.experienceMax ? `${entry.experienceMin || 0}-${entry.experienceMax || "+"} yrs` : "",
                      entry.location,
                      `${entry.resultCount} result${entry.resultCount === 1 ? "" : "s"}`,
                      entry.runByName,
                      shortDate(entry.createdAt),
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => rerunSearch(entry)} className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${darkMode ? "border-white/10 bg-white/5 text-white/75" : "border-slate-200 bg-white text-slate-700"}`}>
                    Run again <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeSearch(entry.id)} className={`grid h-9 w-9 place-items-center rounded-xl border ${darkMode ? "border-white/10 bg-white/5 text-white/60" : "border-slate-200 bg-white text-slate-500"}`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )) : (
              <EmptyState darkMode={darkMode} icon={History} title="No searches yet" text="Every search you run is logged here so the team can repeat what worked." />
            )}
          </div>
        </section>
      ) : null}

      {searchOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}
        >
          <div className={`employee-report-shell employee-report-drawer absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#0b0f14] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <span><b>Recruitment</b> · Source candidates{candidates.length ? ` · ${candidates.length} saved` : ""}</span>
              <button type="button" onClick={() => setSearchOpen(false)} className="font-semibold text-[#2563eb]">Close</button>
            </div>
            <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 ${darkMode ? "bg-[#05080c]" : "bg-[#f5f7f2]"}`}>
              <section className={`rounded-[28px] ${panel}`}>
                <div className="flex flex-col gap-3 p-5 pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black">Build your search</h3>
                    <p className={`mt-1 text-sm ${muted}`}>Add the role, skills and experience. Each platform is searched separately, and results are ranked by how well they match — nothing is hidden for a missing skill or city.</p>
                  </div>
                  <div className={`flex shrink-0 rounded-2xl p-1 ${soft}`}>
                    {[{ id: "candidates", label: "Candidates" }, { id: "jobs", label: "Job posts" }].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => switchMode(option.id)}
                        className={`h-9 rounded-xl px-4 text-xs font-bold transition ${form.mode === option.id ? "bg-[#2563eb] text-white" : darkMode ? "text-white/55" : "text-slate-500"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <Field label="Role / keyword" darkMode={darkMode} hint="e.g. Software Developer, Interior Designer, Site Engineer">
                <input
                  value={form.keyword}
                  onChange={(event) => updateForm({ keyword: event.target.value })}
                  onKeyDown={(event) => { if (event.key === "Enter") void runSearch({}); }}
                  placeholder="Software Developer"
                  className={inputClass}
                />
              </Field>

              <Field label="Skills" darkMode={darkMode} hint="Press Enter or comma to add. Matches any of the listed skills.">
                <div className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-2xl border px-3 py-2 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}>
                  {form.skills.map((skill) => (
                    <span key={skill} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${darkMode ? "bg-[#2563eb]/20 text-[#93c5fd]" : "bg-[#2563eb]/10 text-[#2563eb]"}`}>
                      {skill}
                      <button type="button" onClick={() => updateForm({ skills: form.skills.filter((item) => item !== skill) })} className="opacity-60 hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={skillInput}
                    onChange={(event) => {
                      if (event.target.value.endsWith(",")) addSkill(event.target.value);
                      else setSkillInput(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addSkill(skillInput);
                      } else if (event.key === "Backspace" && !skillInput && form.skills.length) {
                        updateForm({ skills: form.skills.slice(0, -1) });
                      }
                    }}
                    onBlur={() => addSkill(skillInput)}
                    placeholder={form.skills.length ? "Add another skill" : "React, Node.js, AutoCAD..."}
                    className={`h-7 min-w-[140px] flex-1 bg-transparent text-sm outline-none ${darkMode ? "text-white placeholder:text-white/30" : "text-slate-800 placeholder:text-slate-400"}`}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Experience from" darkMode={darkMode}>
                  <input type="number" min="0" max="40" value={form.experienceMin} onChange={(event) => updateForm({ experienceMin: event.target.value })} placeholder="3" className={inputClass} />
                </Field>
                <Field label="Experience to" darkMode={darkMode} hint="Years. Leave blank for open ended.">
                  <input type="number" min="0" max="40" value={form.experienceMax} onChange={(event) => updateForm({ experienceMax: event.target.value })} placeholder="6" className={inputClass} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Location" darkMode={darkMode}>
                  <input value={form.location} onChange={(event) => updateForm({ location: event.target.value })} placeholder="Ahmedabad" className={inputClass} />
                </Field>
                <Field label="Company" darkMode={darkMode} hint="Optional — target or exclude a company.">
                  <input value={form.company} onChange={(event) => updateForm({ company: event.target.value })} placeholder="Any" className={inputClass} />
                </Field>
              </div>

              <Field label="Exclude words" darkMode={darkMode} hint="Comma separated. Useful to drop recruiter and job-ad noise.">
                <input value={form.excludeTerms} onChange={(event) => updateForm({ excludeTerms: event.target.value })} placeholder="hiring, recruiter, internship" className={inputClass} />
              </Field>

              <Field label="Country" darkMode={darkMode} hint="Boosts results for this country on public website data stores.">
                <SelectMenu darkMode={darkMode} value={form.country} options={COUNTRY_OPTIONS} onChange={(value) => updateForm({ country: value })} />
              </Field>

              <div className="lg:col-span-2">
                <span className={`mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Platforms</span>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform) => {
                    const active = form.platforms.includes(platform.id);
                    const tone = PLATFORM_TONES[platform.id] || PLATFORM_TONES.other;
                    // Job boards keep seeker profiles behind a login, so they
                    // can only ever answer in Job posts mode. Say so on the chip
                    // instead of letting the search come back empty.
                    const usable = !platform.supports || platform.supports.includes(form.mode);
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => togglePlatform(platform.id)}
                        disabled={!usable}
                        title={usable ? platform.hint : `${platform.label} has no public ${form.mode === "jobs" ? "job posts" : "candidate profiles"} to index — switch to ${form.mode === "jobs" ? "Candidates" : "Job posts"} mode`}
                        className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${
                          !usable
                            ? darkMode ? "cursor-not-allowed border-white/5 bg-white/[0.015] text-white/25" : "cursor-not-allowed border-black/5 bg-[#f7f8fb] text-slate-300"
                            : active
                              ? `border-transparent ${darkMode ? tone.dark : tone.light}`
                              : darkMode ? "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]" : "border-black/10 bg-white text-slate-500 hover:bg-[#f7f8fb]"
                        }`}
                      >
                        <span className={`grid h-5 w-5 place-items-center rounded-md border ${active && usable ? "border-transparent bg-[#2563eb] text-white" : darkMode ? "border-white/20" : "border-black/15"}`}>
                          {active && usable ? <Check className="h-3 w-3" /> : null}
                        </span>
                        {platform.label}
                        {!usable ? <span className="text-[10px] font-semibold opacity-70">{form.mode === "jobs" ? "no jobs" : "jobs only"}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {meta?.query ? (
              <div className="px-5 pb-4">
                <button type="button" onClick={() => setQueryOpen((open) => !open)} className={`flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-xs font-bold ${soft} ${muted}`}>
                  <span className="inline-flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Vertex AI Search query</span>
                  <ChevronDown className={`h-4 w-4 transition ${queryOpen ? "rotate-180" : ""}`} />
                </button>
                {queryOpen ? (
                  <>
                    <pre className={`mt-2 overflow-x-auto rounded-2xl p-4 text-[11px] leading-5 ${darkMode ? "bg-black/40 text-white/70" : "bg-[#0f172a] text-[#e2e8f0]"}`}>{meta.query}</pre>
                    {meta.servingConfig ? <p className={`mt-2 break-all text-[11px] ${muted}`}>Serving config: {meta.servingConfig}</p> : null}
                  </>
                ) : null}
                <p className={`mt-2 flex items-start gap-2 text-xs ${muted}`}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Vertex AI Search ranks semantically and has no site: operator, so platform and exclude-word filters are applied to the results after retrieval.
                </p>
              </div>
            ) : null}

            <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 ${darkMode ? "border-white/[0.06]" : "border-black/[0.06]"}`}>
              <button
                type="button"
                onClick={() => { setForm(EMPTY_FORM); setResults([]); setMeta(null); setSkillInput(""); setPage(1); }}
                className={`h-11 rounded-full border px-5 text-sm font-semibold transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white/70 hover:bg-white/[0.08]" : "border-black/10 bg-white text-black/60 hover:bg-[#f7f8fb]"}`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => runSearch({})}
                disabled={searching || !configured}
                className="flex h-11 items-center gap-2 rounded-full bg-[#2563eb] px-7 text-sm font-black text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? "Searching Vertex AI..." : "Search"}
              </button>
            </div>
          </section>

          <section className={`rounded-[28px] ${panel}`}>
            <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black">Results</h3>
                <p className={`mt-1 text-sm ${muted}`}>
                  {meta
                    ? `Page ${meta.page || page} · ${results.length} result${results.length === 1 ? "" : "s"}${platformBreakdown ? ` (${platformBreakdown})` : ""}${hiddenCount ? ` · ${hiddenCount} off-platform` : ""}${meta.broadened ? " · widened to fill the page" : ""}`
                    : "Run a search to see profiles here."}
                </p>
              </div>
              {meta?.platforms?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {meta.platforms.map((id) => (
                    <Pill key={id} tone={id} darkMode={darkMode}>{platforms.find((platform) => platform.id === id)?.label || id}</Pill>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="px-5 pb-5">
              {results.length ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {results.map((result) => {
                      const saved = savedLinks.get(result.link);
                      return (
                        <ProfileCard
                          key={result.link || result.id}
                          person={result}
                          darkMode={darkMode}
                          saved={Boolean(saved)}
                          saving={savingLink === result.link}
                          onSave={() => saveCandidate(result)}
                          onOpen={() => window.open(result.link, "_blank", "noopener,noreferrer")}
                          stats={[
                            {
                              icon: Star,
                              value: `${result.relevance ?? 0}%`,
                              label: "Match",
                              accent: (result.relevance ?? 0) >= 60
                                ? (darkMode ? "text-[#4ade80]" : "text-[#16a34a]")
                                : (result.relevance ?? 0) >= 30
                                  ? (darkMode ? "text-[#fbbf24]" : "text-[#d97706]")
                                  : undefined,
                            },
                            { value: result.platformLabel || "-", label: "Source" },
                            { value: form.skills.length ? `${result.matchedSkills?.length || 0}/${form.skills.length}` : "-", label: "Skills" },
                          ]}
                          action={{ icon: ExternalLink, label: "Open profile" }}
                        />
                      );
                    })}
                  </div>
                  {meta && (page > 1 || meta.hasNextPage) ? (
                    <div className="mt-5 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => runSearch({ toPage: page - 1 })}
                        disabled={page <= 1 || loadingMore || searching}
                        className={`flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold transition disabled:opacity-40 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f4f8]"}`}
                      >
                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft className="h-4 w-4" />} Previous
                      </button>
                      <span className={`text-sm font-bold tabular-nums ${muted}`}>Page {page}</span>
                      <button
                        type="button"
                        onClick={() => runSearch({ toPage: page + 1 })}
                        disabled={!meta.hasNextPage || loadingMore || searching}
                        className={`flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold transition disabled:opacity-40 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f4f8]"}`}
                      >
                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Next <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  darkMode={darkMode}
                  icon={UserRoundSearch}
                  title={searching ? "Searching Vertex AI" : "No results yet"}
                      text={configured ? "Fill in the role, skills and platforms above, then hit Search. Anyone you save lands on the Candidates board behind this drawer." : "Connect Vertex AI Search in settings to start sourcing."}
                />
              )}
            </div>
          </section>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={() => setDetail(null)}>
          <div
            className={`max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] p-6 sm:rounded-[28px] ${darkMode ? "bg-[#0d1117] text-white" : "bg-white text-[#171714]"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`grid h-14 w-14 place-items-center rounded-2xl text-base font-black ${darkMode ? "bg-white/10 text-white/70" : "bg-[#e8f0fe] text-[#2563eb]"}`}>{initials(detail.name)}</span>
                <div>
                  <h3 className="text-xl font-black">{detail.name}</h3>
                  <p className={`text-sm ${muted}`}>{detail.headline || "No headline"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDetail(null)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Pill tone={detail.platform} darkMode={darkMode}>{detail.platformLabel}</Pill>
              <Pill tone={detail.status} map={STATUS_TONES} darkMode={darkMode}>{statuses.find((status) => status.id === detail.status)?.label || detail.status}</Pill>
              {detail.location ? <Pill tone="other" darkMode={darkMode}><MapPin className="h-3 w-3" />{detail.location}</Pill> : null}
              {detail.company ? <Pill tone="other" darkMode={darkMode}><Building2 className="h-3 w-3" />{detail.company}</Pill> : null}
            </div>

            {detail.snippet ? <p className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${soft} ${muted}`}>{detail.snippet}</p> : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Hiring stage" darkMode={darkMode}>
                <SelectMenu
                  darkMode={darkMode}
                  value={detail.status}
                  options={statuses.map((status) => ({ value: status.id, label: status.label }))}
                  onChange={async (value) => {
                    const saved = await updateCandidate(detail.id, { status: value });
                    if (saved) setDetail(saved);
                  }}
                />
              </Field>
              <Field label="Role searched for" darkMode={darkMode}>
                <input value={detail.role || ""} onChange={(event) => setDetail({ ...detail, role: event.target.value })} onBlur={(event) => updateCandidate(detail.id, { role: event.target.value }, { quiet: true })} className={inputClass} />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Notes" darkMode={darkMode} hint="Screening notes, callback outcome, expected CTC...">
                <textarea
                  value={detailNotes}
                  onChange={(event) => setDetailNotes(event.target.value)}
                  rows={5}
                  placeholder="Add interview or screening notes"
                  className={`w-full rounded-2xl border p-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.035] text-white placeholder:text-white/30" : "border-black/10 bg-white text-slate-800 placeholder:text-slate-400"}`}
                />
              </Field>
            </div>

            <p className={`mt-3 text-xs ${muted}`}>Saved by {detail.savedByName || "someone"} · {shortDate(detail.createdAt)}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a href={detail.link} target="_blank" rel="noopener noreferrer" className={`flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold ${darkMode ? "border-white/10 bg-white/5 text-white/80" : "border-black/10 bg-white text-slate-700"}`}>
                <ExternalLink className="h-4 w-4" /> Open profile
              </a>
              <button type="button" onClick={saveDetailNotes} disabled={detailSaving} className="flex h-11 items-center gap-2 rounded-full bg-[#2563eb] px-6 text-sm font-black text-white transition hover:bg-[#1d4ed8] disabled:opacity-50">
                {detailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save notes
              </button>
              <button type="button" onClick={() => setPendingRemove(detail)} className={`ml-auto flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold ${darkMode ? "bg-rose-400/10 text-rose-200" : "bg-rose-50 text-rose-600"}`}>
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRemove ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px] animate-[mrn-backdrop-in_200ms_ease-out]"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !removing) setPendingRemove(null); }}
        >
          <div className={`w-full max-w-md rounded-[24px] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] ${panel}`}>
            <div className="flex items-start gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-rose-400/15 text-rose-200" : "bg-rose-50 text-rose-600"}`}>
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black leading-tight">Remove {pendingRemove.name}?</h3>
                <p className={`mt-1.5 text-sm leading-6 ${muted}`}>
                  They come off the pipeline along with any notes and stage history. The profile itself is untouched, so you can save them again from a later search.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemove(null)}
                disabled={removing}
                className={`h-11 rounded-full border px-5 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/10 bg-white/[0.045] text-white/70 hover:bg-white/[0.08]" : "border-black/10 bg-white text-black/60 hover:bg-[#f7f8fb]"}`}
              >
                Keep
              </button>
              <button
                type="button"
                onClick={confirmRemoveCandidate}
                disabled={removing}
                className="flex h-11 items-center gap-2 rounded-full bg-[#e11d48] px-6 text-sm font-black text-white transition hover:bg-[#be123c] disabled:opacity-50"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" onClick={() => setSettingsOpen(false)}>
          <div className={`max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-6 ${darkMode ? "bg-[#0d1117] text-white" : "bg-white text-[#171714]"}`} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black">Vertex AI Search settings</h3>
                <p className={`mt-1 text-sm ${muted}`}>Recruitment runs on the Google Cloud Discovery Engine API.</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <ol className={`mt-4 space-y-2 rounded-2xl p-4 text-xs leading-5 ${soft} ${muted}`}>
              <li><b>1.</b> In Google Cloud Console, enable the <b>Discovery Engine API</b> on your project.</li>
              <li><b>2.</b> In <b>AI Applications &gt; Data Stores</b>, create a <b>Website</b> data store covering the job boards you want to search.</li>
              <li><b>3.</b> Create a <b>Search</b> app over that data store, then copy the project, app and data store IDs here.</li>
              <li><b>4.</b> Grant the server&apos;s service account the <b>Discovery Engine Viewer</b> role — it signs every search.</li>
            </ol>

            {data?.settings && !data.settings.serviceAccountConfigured ? (
              <p className={`mt-3 flex items-start gap-2 rounded-2xl p-3 text-xs ${darkMode ? "bg-amber-400/10 text-amber-200" : "bg-amber-50 text-amber-700"}`}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                GOOGLE_SERVICE_ACCOUNT_KEY is not set on the server, so searches will fail until it is configured.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              <Field label="Google Cloud project ID" darkMode={darkMode} hint="Required">
                <input
                  value={settingsForm.projectId}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, projectId: event.target.value }))}
                  placeholder="my-gcp-project"
                  className={inputClass}
                />
              </Field>
              <Field label="Location" darkMode={darkMode} hint="Must match where the data store was created.">
                <SelectMenu
                  darkMode={darkMode}
                  value={settingsForm.location}
                  options={(data?.locations || [{ id: "global", label: "Global" }]).map((item) => ({ value: item.id, label: item.label }))}
                  onChange={(value) => setSettingsForm((current) => ({ ...current, location: value }))}
                />
              </Field>
              <Field label="App (engine) ID" darkMode={darkMode} hint="Optional. Used in preference to the data store when set.">
                <input
                  value={settingsForm.engineId}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, engineId: event.target.value }))}
                  placeholder="recruitment-search_1730000000000"
                  className={inputClass}
                />
              </Field>
              <Field label="Data store ID" darkMode={darkMode} hint="Required unless an app ID is set.">
                <input
                  value={settingsForm.dataStoreId}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, dataStoreId: event.target.value }))}
                  placeholder="job-boards_1730000000000"
                  className={inputClass}
                />
              </Field>
              <Field label="Collection ID" darkMode={darkMode} hint="Leave as default_collection unless you created your own.">
                <input
                  value={settingsForm.collectionId}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, collectionId: event.target.value }))}
                  placeholder="default_collection"
                  className={inputClass}
                />
              </Field>
            </div>

            {data?.settings?.servingConfig ? (
              <p className={`mt-3 break-all text-[11px] ${muted}`}>Serving config: {data.settings.servingConfig}</p>
            ) : null}

            {data?.settings?.updatedBy ? (
              <p className={`mt-3 text-xs ${muted}`}>Last updated by {data.settings.updatedBy.name} · {shortDate(data.settings.updatedAt)}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSettingsOpen(false)} className={`h-11 rounded-full border px-5 text-sm font-semibold ${darkMode ? "border-white/10 bg-white/[0.045] text-white/70" : "border-black/10 bg-white text-black/60"}`}>
                Cancel
              </button>
              <button type="button" onClick={saveSettings} disabled={settingsSaving} className="flex h-11 items-center gap-2 rounded-full bg-[#2563eb] px-6 text-sm font-black text-white transition hover:bg-[#1d4ed8] disabled:opacity-50">
                {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
