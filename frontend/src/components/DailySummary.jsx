"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  HardHat,
  Images,
  Loader2,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import { API_URL } from "./AuthProvider";

/*
 * Dashboard daily summary.
 *
 * There is no aggregated "daily report" endpoint on the backend, so this fans out
 * to the existing per-area routes and assembles the summary client-side. Each
 * source is fetched independently via allSettled: several of these routes are
 * permission-gated (GET /dmr-dashboard needs `project-dmr`), so a user without
 * access must still get a working dashboard with that card marked unavailable
 * rather than an error screen.
 */

const DONE_STATUS = /done|complete|completed/i;

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateKeyFromValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const parts = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (parts) {
    // Google Form sheets usually emit M/D/YYYY; only flip to D/M when the first
    // number cannot be a month. Same rule as SiteImagesDashboard.
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${parts[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : localDateKey(parsed);
}

function formatDay(key) {
  if (!key) return "No date";
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatClock(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  if (total <= 0) return "";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function cellValue(row, header) {
  return String(header ? row?.[header] ?? "" : "").trim();
}

function extractUrls(input) {
  return String(input ?? "").match(/https?:\/\/[^\s,;]+/g) || [];
}

function pickHeader(headers, tests) {
  for (const test of tests) {
    const found = headers.find((header) => test.test(String(header).trim()));
    if (found) return found;
  }
  return "";
}

function driveThumb(url) {
  const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  return id && /drive\.google\.com|docs\.google\.com/i.test(url)
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w600`
    : url;
}

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ---------------------------------------------------------------- sources -- */

async function loadProjectData() {
  const data = await getJson("/project-dashboard");
  const today = data.date || localDateKey();
  const delayed = [];
  const starting = [];
  for (const project of data.projects || []) {
    for (const task of project.manualTasks || []) {
      if (DONE_STATUS.test(task.status || "")) continue;
      const due = dateKeyFromValue(task.dueDate);
      const start = dateKeyFromValue(task.startDate);
      const row = { task, project, due, start };
      // Same rule the backend uses for metrics.overdue (summarizeManualProject).
      if (due && due < today) {
        delayed.push({
          ...row,
          key: `${project.id}:${task.id || task.title}`,
          daysLate: Math.max(
            1,
            Math.round(
              (new Date(`${today}T00:00:00`) - new Date(`${due}T00:00:00`)) / 86400000,
            ),
          ),
        });
      }
      if (start && start === today) {
        starting.push({ ...row, key: `s:${project.id}:${task.id || task.title}` });
      }
    }
  }
  delayed.sort((a, b) => b.daysLate - a.daysLate);
  return { today, delayed, starting };
}

async function loadManpower() {
  const data = await getJson("/dmr-dashboard");
  const totals = data.today?.totals || {};
  return {
    date: data.date || "",
    planned: Number(totals.planned) || 0,
    actual: Number(totals.actual) || 0,
    variance: Number(totals.variance) || 0,
    records: Number(totals.records) || 0,
    missing: Number(totals.missing) || 0,
    sites: data.today?.siteBreakdown || [],
    agencies: data.today?.agencyBreakdown || [],
  };
}

async function loadAttendance() {
  // Non-HR users only receive their own rows (loadHrAttendanceRecords scopes the
  // query by userId), so this card shows whatever the caller is allowed to see.
  const data = await getJson("/hr/attendance");
  return { records: data.records || [], canManageHr: Boolean(data.canManageHr) };
}

async function loadMrn() {
  // Default range is the last 7 days, which still contains today, and the payload
  // carries allSummary for the all-time total — so one call covers both the card
  // count and the today-only drawer.
  const data = await getJson("/mrn-dashboard");
  return {
    records: data.records || [],
    total: data.allSummary?.total ?? data.summary?.total ?? 0,
    open: data.allSummary?.open ?? 0,
  };
}

async function loadSiteImages() {
  // No backend route for site images — replicate the sheet scrape that
  // SiteImagesDashboard already performs, so both screens agree.
  const documentsData = await getJson("/documents");
  const sheets = (documentsData.documents || []).filter(
    (doc) => doc.type === "sheet" && doc.isReady !== false,
  );
  const doc =
    sheets.find((item) => /site\s*daily\s*report/i.test(item.name)) ||
    sheets.find((item) => /site.*report|daily.*site/i.test(item.name));
  if (!doc) throw new Error('Link a sheet named "Site Daily Report" first.');
  const data = await getJson(`/sheets/${doc.id}/data`);
  const photos = [];
  for (const sheet of data.sheets || []) {
    const headers = sheet.headers || [];
    const siteHeader = pickHeader(headers, [/^site(?:\s*name)?$/i, /site.*name/i, /location/i, /project/i]);
    const dateHeader = pickHeader(headers, [/^date$/i, /timestamp/i, /report.*date/i, /created|submitted/i]);
    const tradeHeader = pickHeader(headers, [/^trade$/i, /trade.*name/i, /category|department|agency/i]);
    const uploaderHeader = pickHeader(headers, [/uploaded.*by|submitted.*by/i, /^name$/i, /created.*by/i]);
    const mediaHeaders = headers.filter(
      (header) =>
        /photo|image|upload|attachment|drive\s*link|media/i.test(header) ||
        (sheet.rows || []).some((row) => extractUrls(row[header]).length),
    );
    (sheet.rows || []).forEach((row, rowIndex) => {
      mediaHeaders.forEach((header) => {
        extractUrls(row[header]).forEach((url, urlIndex) => {
          photos.push({
            id: `${sheet.name}-${row.__rowIndex || rowIndex}-${header}-${urlIndex}`,
            url,
            site: cellValue(row, siteHeader) || "Unassigned site",
            date: dateKeyFromValue(cellValue(row, dateHeader)),
            // Categories are often the media column header rather than a Trade cell.
            trade: cellValue(row, tradeHeader) || String(header || "").trim() || "General work",
            uploadedBy: cellValue(row, uploaderHeader) || "Site team",
          });
        });
      });
    });
  }
  return { photos, source: doc };
}

/* ------------------------------------------------------------------- UI --- */

function Drawer({ darkMode, title, subtitle, count, onClose, children }) {
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div
      className={`fixed inset-0 z-[90] flex justify-end bg-black/25 backdrop-blur-[1px] transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) requestClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex h-full w-full max-w-[560px] flex-col transition-transform duration-200 ${closing ? "translate-x-full" : "translate-x-0"} ${darkMode ? "bg-[#111318] text-white" : "bg-[#f7f9f8] text-[#171714]"}`}
      >
        <header
          className={`flex min-h-16 shrink-0 items-center justify-between gap-3 px-5 ${darkMode ? "bg-[#16181d]" : "bg-white"}`}
        >
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {title}
              {typeof count === "number" && (
                <span className={`ml-2 text-sm font-normal ${darkMode ? "text-white/45" : "text-black/45"}`}>
                  {count}
                </span>
              )}
            </h2>
            {subtitle && (
              <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

function SummaryCard({ darkMode, card, onOpen }) {
  const disabled = card.unavailable || !card.count;
  return (
    <button
      type="button"
      onClick={() => !card.unavailable && onOpen(card.id)}
      disabled={card.unavailable}
      className={`group flex min-h-[104px] w-full flex-col justify-between rounded-[22px] p-4 text-left transition disabled:cursor-not-allowed ${
        darkMode
          ? "bg-white/[0.045] hover:bg-white/[0.075] disabled:hover:bg-white/[0.045]"
          : "bg-white hover:-translate-y-0.5 disabled:hover:translate-y-0"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
          <card.icon className="h-4.5 w-4.5" />
        </span>
        {!card.unavailable && (
          <ChevronRight
            className={`h-4 w-4 transition group-hover:translate-x-0.5 ${darkMode ? "text-white/30" : "text-black/25"}`}
          />
        )}
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-2xl font-semibold tabular-nums">
          {card.unavailable ? "—" : card.value}
        </p>
        <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-white/50" : "text-black/50"}`}>
          {card.label}
        </p>
        {card.hint && (
          <p className={`mt-1 truncate text-[11px] ${darkMode ? "text-white/35" : "text-black/35"}`}>
            {card.unavailable ? card.unavailableReason || "Not available" : card.hint}
          </p>
        )}
      </div>
    </button>
  );
}

function EmptyNote({ darkMode, children }) {
  return (
    <p className={`rounded-2xl px-4 py-10 text-center text-sm ${darkMode ? "bg-white/[0.04] text-white/45" : "bg-white text-black/45"}`}>
      {children}
    </p>
  );
}

function Row({ darkMode, children, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${onClick ? (darkMode ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.02]") : ""}`}
    >
      {children}
    </Tag>
  );
}

function ListCard({ darkMode, children }) {
  return (
    <div
      className={`divide-y overflow-hidden rounded-2xl ${darkMode ? "divide-white/[0.06] bg-white/[0.04]" : "divide-black/[0.05] bg-white"}`}
    >
      {children}
    </div>
  );
}

export default function DailySummary({ darkMode }) {
  const [state, setState] = useState({ loading: true });
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pure fetch — resolves to the next state and touches no setters, so the mount
  // effect below can await it without firing setState synchronously.
  const fetchAll = useCallback(async () => {
    const [projectRes, manpowerRes, attendanceRes, mrnRes, imagesRes] = await Promise.allSettled([
      loadProjectData(),
      loadManpower(),
      loadAttendance(),
      loadMrn(),
      loadSiteImages(),
    ]);
    return {
      loading: false,
      project: projectRes.status === "fulfilled" ? projectRes.value : null,
      projectError: projectRes.status === "rejected" ? projectRes.reason?.message : "",
      manpower: manpowerRes.status === "fulfilled" ? manpowerRes.value : null,
      manpowerError: manpowerRes.status === "rejected" ? manpowerRes.reason?.message : "",
      attendance: attendanceRes.status === "fulfilled" ? attendanceRes.value : null,
      attendanceError: attendanceRes.status === "rejected" ? attendanceRes.reason?.message : "",
      mrn: mrnRes.status === "fulfilled" ? mrnRes.value : null,
      mrnError: mrnRes.status === "rejected" ? mrnRes.reason?.message : "",
      images: imagesRes.status === "fulfilled" ? imagesRes.value : null,
      imagesError: imagesRes.status === "rejected" ? imagesRes.reason?.message : "",
    };
  }, []);

  useEffect(() => {
    // Guarded so navigating away mid-fetch doesn't set state on an unmounted tree.
    let cancelled = false;
    void fetchAll().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setState(await fetchAll());
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const today = state.project?.today || localDateKey();
  const todayPhotos = useMemo(
    () => (state.images?.photos || []).filter((photo) => photo.date === today),
    [state.images, today],
  );
  const todayAttendance = useMemo(
    () => (state.attendance?.records || []).filter((record) => record.date === today),
    [state.attendance, today],
  );
  const todayMrn = useMemo(
    () => (state.mrn?.records || []).filter((record) => record.date === today),
    [state.mrn, today],
  );

  const cards = useMemo(() => {
    const delayed = state.project?.delayed || [];
    const starting = state.project?.starting || [];
    const manpower = state.manpower;
    return [
      {
        id: "delayed",
        icon: AlertTriangle,
        label: "Delayed tasks",
        value: delayed.length,
        count: delayed.length,
        hint: delayed.length ? `across ${new Set(delayed.map((r) => r.project.id)).size} projects` : "Nothing overdue",
        tone: "bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300",
        unavailable: !state.project,
        unavailableReason: state.projectError,
      },
      {
        id: "starting",
        icon: CalendarClock,
        label: "Starting today",
        value: starting.length,
        count: starting.length,
        hint: starting.length ? "tasks kicking off" : "Nothing starts today",
        tone: "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
        unavailable: !state.project,
        unavailableReason: state.projectError,
      },
      {
        id: "manpower",
        icon: HardHat,
        label: "Today's manpower",
        // Actual is the number that matters, so it carries the colour: green when
        // we met or beat the plan, red when we came up short. The planned figure
        // sits alongside it de-emphasised, and both are labelled underneath so
        // "54 / 6" can't be read the wrong way round.
        value: manpower ? (
          <>
            <span className={manpower.actual >= manpower.planned ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
              {manpower.actual}
            </span>
            <span className="opacity-35"> / </span>
            <span className="opacity-70">{manpower.planned}</span>
          </>
        ) : "—",
        count: manpower?.records || 0,
        hint: manpower
          ? `Actual / Planned · ${manpower.variance >= 0 ? "+" : ""}${manpower.variance}`
          : "",
        tone: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
        unavailable: !manpower,
        unavailableReason: state.manpowerError,
      },
      {
        id: "attendance",
        icon: UserCheck,
        label: "Today's attendance",
        value: todayAttendance.length,
        count: todayAttendance.length,
        hint: todayAttendance.length
          ? `${todayAttendance.filter((r) => r.clockOutAt).length} clocked out`
          : "No one clocked in yet",
        tone: "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300",
        unavailable: !state.attendance,
        unavailableReason: state.attendanceError,
      },
      {
        id: "mrn",
        icon: ClipboardList,
        label: "Total MRN",
        value: state.mrn?.total ?? 0,
        count: state.mrn?.total || 0,
        hint: state.mrn
          ? `${todayMrn.length} raised today · ${state.mrn.open} open`
          : "",
        tone: "bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300",
        unavailable: !state.mrn,
        unavailableReason: state.mrnError,
      },
      {
        id: "images",
        icon: Images,
        label: "New site images",
        value: todayPhotos.length,
        count: todayPhotos.length,
        hint: todayPhotos.length
          ? `${new Set(todayPhotos.map((p) => p.site)).size} sites · ${formatDay(today)}`
          : `Nothing uploaded ${formatDay(today)}`,
        tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
        unavailable: !state.images,
        unavailableReason: state.imagesError,
      },
    ];
  }, [state, today, todayPhotos, todayAttendance, todayMrn]);

  if (state.loading) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-[24px] px-4 py-10 text-sm ${darkMode ? "bg-white/[0.04] text-white/50" : "bg-white text-black/45"}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Building today&apos;s summary…
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className={`text-[10px] uppercase tracking-[0.24em] ${darkMode ? "text-white/40" : "text-[#8c948f]"}`}>
            Daily report
          </p>
          <h2 className={`mt-1 text-xl font-semibold ${darkMode ? "text-white" : "text-[#171714]"}`}>
            Today at a glance
          </h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-white text-black/60 hover:bg-black/[0.03]"}`}
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard key={card.id} darkMode={darkMode} card={card} onOpen={setOpen} />
        ))}
      </div>

      {open === "delayed" && (
        <Drawer
          darkMode={darkMode}
          title="Delayed tasks"
          subtitle="Past their due date"
          count={state.project?.delayed.length}
          onClose={() => setOpen(null)}
        >
          {!state.project?.delayed.length ? (
            <EmptyNote darkMode={darkMode}>Nothing is past its due date.</EmptyNote>
          ) : (
            <ListCard darkMode={darkMode}>
              {state.project.delayed.map((row) => (
                <Row key={row.key} darkMode={darkMode}>
                  <span className="w-[74px] shrink-0 rounded-full bg-rose-50 px-2 py-1 text-center text-[11px] font-semibold text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
                    {row.daysLate}d late
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.task.title || "Untitled task"}</span>
                    <span className={`mt-0.5 block truncate text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                      {row.project.name}
                      {row.task.phaseName ? ` · ${row.task.phaseName}` : ""} · Due {formatDay(row.due)}
                    </span>
                  </span>
                </Row>
              ))}
            </ListCard>
          )}
        </Drawer>
      )}

      {open === "starting" && (
        <Drawer
          darkMode={darkMode}
          title="Starting today"
          subtitle={formatDay(today)}
          count={state.project?.starting.length}
          onClose={() => setOpen(null)}
        >
          {!state.project?.starting.length ? (
            <EmptyNote darkMode={darkMode}>No task is scheduled to start today.</EmptyNote>
          ) : (
            <ListCard darkMode={darkMode}>
              {state.project.starting.map((row) => (
                <Row key={row.key} darkMode={darkMode}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.task.title || "Untitled task"}</span>
                    <span className={`mt-0.5 block truncate text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                      {row.project.name}
                      {row.task.phaseName ? ` · ${row.task.phaseName}` : ""}
                      {row.due ? ` · Due ${formatDay(row.due)}` : ""}
                    </span>
                  </span>
                </Row>
              ))}
            </ListCard>
          )}
        </Drawer>
      )}

      {open === "manpower" && state.manpower && (
        <Drawer
          darkMode={darkMode}
          title="Today's manpower"
          subtitle={formatDay(state.manpower.date || today)}
          onClose={() => setOpen(null)}
        >
          <div className={`grid grid-cols-3 gap-3 rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
            {(() => {
              // Same rule as the card: met-or-beat the plan is green, short is red.
              const short = state.manpower.actual < state.manpower.planned;
              const tone = short ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
              return [
                ["Planned", state.manpower.planned, ""],
                ["Actual", state.manpower.actual, tone],
                ["Variance", `${state.manpower.variance >= 0 ? "+" : ""}${state.manpower.variance}`, tone],
              ].map(([label, value, valueTone]) => (
                <div key={label}>
                  <p className={`text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</p>
                  <p className={`mt-1 text-xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
                </div>
              ));
            })()}
          </div>
          {state.manpower.missing > 0 && (
            <p className={`mt-3 rounded-2xl px-4 py-3 text-xs ${darkMode ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
              {state.manpower.missing} of {state.manpower.records} rows have no actual filled in yet.
            </p>
          )}
          <h3 className="mt-6 text-sm font-semibold">By site</h3>
          <div className="mt-3">
            {!state.manpower.sites.length ? (
              <EmptyNote darkMode={darkMode}>No site rows for today.</EmptyNote>
            ) : (
              <ListCard darkMode={darkMode}>
                {state.manpower.sites.map((site) => (
                  <Row key={site.label} darkMode={darkMode}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{site.label}</span>
                      <span className={`mt-0.5 block text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                        {site.records} {site.records === 1 ? "row" : "rows"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {site.actual}/{site.planned}
                    </span>
                  </Row>
                ))}
              </ListCard>
            )}
          </div>
        </Drawer>
      )}

      {open === "attendance" && (
        <Drawer
          darkMode={darkMode}
          title="Today's attendance"
          subtitle={formatDay(today)}
          count={todayAttendance.length}
          onClose={() => setOpen(null)}
        >
          {!todayAttendance.length ? (
            <EmptyNote darkMode={darkMode}>No one has clocked in today.</EmptyNote>
          ) : (
            <ListCard darkMode={darkMode}>
              {todayAttendance.map((record) => {
                const duration = formatDuration(record.workMinutes);
                return (
                  <Row key={record.id} darkMode={darkMode}>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${record.clockOutAt ? "bg-slate-400" : "bg-emerald-500"}`}
                      title={record.clockOutAt ? "Clocked out" : "Currently in"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{record.employeeName}</span>
                      <span className={`mt-0.5 block truncate text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                        {[record.designation || record.department, record.workMode === "remote" ? "Remote" : "Office"]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-medium tabular-nums">
                        {formatClock(record.clockInAt)}
                        <span className="opacity-40"> → </span>
                        {formatClock(record.clockOutAt)}
                      </span>
                      {duration && (
                        <span className={`mt-0.5 block text-[11px] tabular-nums ${darkMode ? "text-white/45" : "text-black/45"}`}>
                          {duration}
                        </span>
                      )}
                    </span>
                  </Row>
                );
              })}
            </ListCard>
          )}
        </Drawer>
      )}

      {open === "mrn" && (
        <Drawer
          darkMode={darkMode}
          title="MRN raised today"
          subtitle={formatDay(today)}
          count={todayMrn.length}
          onClose={() => setOpen(null)}
        >
          {!todayMrn.length ? (
            <EmptyNote darkMode={darkMode}>No material request was raised today.</EmptyNote>
          ) : (
            <div className="space-y-3">
              {todayMrn.map((record) => {
                const delivered = /delivered|closed|complete/i.test(record.status || "");
                const details = [
                  ["Project", record.project],
                  ["Category", record.category],
                  ["Vendor", record.vendorName],
                  ["Quotation", record.quotationAmount],
                  ["Required by", record.requiredDate],
                  ["Issued by", record.issuedBy],
                  ["Assigned to", record.assignTo],
                  ["Lead time", record.leadTime],
                ].filter(([, value]) => String(value || "").trim());
                return (
                  <article
                    key={record.id}
                    className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{record.mrnNo}</p>
                        {record.materialRequirement && (
                          <p className={`mt-1 text-[13px] leading-5 ${darkMode ? "text-white/70" : "text-black/70"}`}>
                            {record.materialRequirement}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          delivered
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                        }`}
                      >
                        {record.status || "Open"}
                      </span>
                    </div>
                    {details.length > 0 && (
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                        {details.map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className={`text-[10px] uppercase tracking-wide ${darkMode ? "text-white/35" : "text-black/35"}`}>
                              {label}
                            </dt>
                            <dd className="mt-0.5 truncate text-xs font-medium" title={String(value)}>
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {record.remark && (
                      <p className={`mt-3 rounded-xl px-3 py-2 text-[11px] leading-5 ${darkMode ? "bg-white/[0.04] text-white/55" : "bg-black/[0.03] text-black/55"}`}>
                        {record.remark}
                      </p>
                    )}
                    {(record.mrnPhoto || record.quotationPhoto) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {record.mrnPhoto && (
                          <a
                            href={record.mrnPhoto}
                            target="_blank"
                            rel="noreferrer"
                            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${darkMode ? "bg-white/[0.07] hover:bg-white/10" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                          >
                            MRN photo
                          </a>
                        )}
                        {record.quotationPhoto && (
                          <a
                            href={record.quotationPhoto}
                            target="_blank"
                            rel="noreferrer"
                            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${darkMode ? "bg-white/[0.07] hover:bg-white/10" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                          >
                            Quotation
                          </a>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Drawer>
      )}

      {open === "images" && (
        <Drawer
          darkMode={darkMode}
          title="New site images"
          subtitle={formatDay(today)}
          count={todayPhotos.length}
          onClose={() => setOpen(null)}
        >
          {!todayPhotos.length ? (
            <EmptyNote darkMode={darkMode}>No images uploaded today.</EmptyNote>
          ) : (
            <div className="space-y-6">
              {[...new Set(todayPhotos.map((photo) => photo.site))].map((site) => {
                const sitePhotos = todayPhotos.filter((photo) => photo.site === site);
                return (
                  <section key={site}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="min-w-0 truncate text-sm font-semibold">{site}</h3>
                      <span className={`shrink-0 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>
                        {sitePhotos.length} {sitePhotos.length === 1 ? "image" : "images"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {sitePhotos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-xl"
                          title={`${photo.trade} · ${photo.uploadedBy}`}
                        >
                          <img
                            src={driveThumb(photo.url)}
                            alt={photo.trade}
                            loading="lazy"
                            className="h-24 w-full bg-black/5 object-cover transition group-hover:scale-[1.03]"
                          />
                          <span
                            className={`block truncate px-1 pt-1 text-[10px] ${darkMode ? "text-white/45" : "text-black/45"}`}
                          >
                            {photo.trade}
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
