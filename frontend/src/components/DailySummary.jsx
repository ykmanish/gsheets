"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  HardHat,
  Images,
  Loader2,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { DatePicker } from "./ui";

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

// MRN sheet dates are day-first (08/06/2026 = 8 June), unlike the Google Form
// site-images sheet which is month-first. Mirrors MrnDashboard's parseMrnDate so
// the dashboard and the MRN page always read a given cell the same way. Do NOT
// route MRN values through dateKeyFromValue — its month-first heuristic turns
// 08/06/2026 into 6 August.
function mrnDateKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  // Timestamps arrive as "06/08/2026 13:34:31" — drop the time before parsing.
  const [datePart] = text.split(/\s+/);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const dayFirst = datePart.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = dayFirst[3].length === 2 ? Number(`20${dayFirst[3]}`) : Number(dayFirst[3]);
    // Validating the month lets an unambiguous month-first value ("8/25/2026")
    // fall through to Date parsing instead of being read as day 8, month 25.
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : localDateKey(parsed);
}

// Material requirement cells hold one item per line (and sometimes "*" markers).
// Rendered as a plain paragraph the newlines collapse into one run-on string, so
// split them the same way MrnDashboard's materialItems does.
function materialItems(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .replace(/\r/g, "\n")
    .split(/\n+|(?=\s*\*)/)
    .map((item) => item.replace(/^\s*\*\s*/, "").trim())
    .filter(Boolean);
}

// The employee report is only considered final after the daily cut-off. Read the
// clock in IST explicitly rather than trusting the browser's zone, so a user in
// another timezone sees the same availability the office does.
const REPORT_CUTOFF_MINUTES = 21 * 60 + 30; // 21:30 IST
const REPORT_CUTOFF_LABEL = "9:30 PM IST";

function istMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
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

// Drive share links can't be used as an <img> src directly — they must go through
// the thumbnail endpoint. Grid tiles ask for a small render, the preview a large
// one (matching SiteImagesDashboard's imageUrl).
function driveRender(url, width) {
  const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  return id && /drive\.google\.com|docs\.google\.com/i.test(url)
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`
    : url;
}

const driveThumb = (url) => driveRender(url, 600);
const driveFull = (url) => driveRender(url, 1600);

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

function parseManpowerData(data, fallbackDate) {
  const totals = data.today?.totals || {};
  const planRecords = data.todayPlan?.records || [];
  
  const planSitesMap = new Map();
  let totalPlanned = 0;
  for (const record of planRecords) {
    const siteKey = String(record.site || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (siteKey) {
      const plannedVal = Number(record.plannedManpower) || 0;
      planSitesMap.set(siteKey, (planSitesMap.get(siteKey) || 0) + plannedVal);
      totalPlanned += plannedVal;
    }
  }

  if (totalPlanned === 0) {
    totalPlanned = Number(data.todayPlan?.summary?.plannedManpower) || Number(totals.planned) || 0;
  }

  const actual = Number(totals.actual) || 0;
  const variance = actual - totalPlanned;
  
  const siteBreakdown = data.today?.siteBreakdown || [];
  const mergedSitesMap = new Map();
  
  for (const siteRow of siteBreakdown) {
    const siteName = siteRow.label || siteRow.site || "";
    const siteKey = String(siteName).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const plannedForSite = planSitesMap.has(siteKey) ? planSitesMap.get(siteKey) : (Number(siteRow.planned) || 0);
    const actualForSite = Number(siteRow.actual) || 0;
    
    mergedSitesMap.set(siteKey, {
      ...siteRow,
      label: siteName || "Unknown",
      site: siteName || "Unknown",
      planned: plannedForSite,
      actual: actualForSite,
      variance: actualForSite - plannedForSite,
      records: siteRow.records || 0,
    });
  }
  
  for (const record of planRecords) {
    const siteKey = String(record.site || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (siteKey && !mergedSitesMap.has(siteKey)) {
      const plannedForSite = planSitesMap.get(siteKey) || 0;
      mergedSitesMap.set(siteKey, {
        label: record.site || "Unknown",
        site: record.site || "Unknown",
        planned: plannedForSite,
        actual: 0,
        variance: -plannedForSite,
        records: 0,
      });
    }
  }
  
  const mergedSites = Array.from(mergedSitesMap.values());
  mergedSites.sort((a, b) => b.planned - a.planned || b.actual - a.actual || String(a.label || "").localeCompare(String(b.label || "")));

  return {
    date: data.date || fallbackDate,
    planned: totalPlanned,
    actual,
    variance,
    records: Number(totals.records) || 0,
    missing: Number(totals.missing) || 0,
    sites: mergedSites,
    agencies: data.today?.agencyBreakdown || [],
  };
}

async function loadManpower(force = false) {
  const data = await getJson(force ? "/dmr-dashboard?force=true" : "/dmr-dashboard");
  return parseManpowerData(data, "");
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

async function loadManpowerFor(date, force = false) {
  const data = await getJson(`/dmr-dashboard?date=${encodeURIComponent(date)}${force ? "&force=true" : ""}`);
  return parseManpowerData(data, date);
}

async function loadMrnFor(date) {
  const data = await getJson(
    `/mrn-dashboard?startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(date)}`,
  );
  return data.records || [];
}

// Builds "who submitted on this date" from the eligible-user roster plus the
// reports returned for that date. This is the same pairing the backend does for
// todaySubmissionStatus, just not pinned to today.
function submissionStatusFor(users, reports, date) {
  const byUser = new Map(
    (reports || [])
      .filter((report) => report.reportDate === date)
      .map((report) => [String(report.userId), report]),
  );
  return (users || []).map((user) => {
    const report = byUser.get(String(user.userId || user._id));
    return {
      userId: String(user.userId || user._id),
      employeeName: user.employeeName || "Employee",
      department: user.department || "",
      submitted: Boolean(report),
      submittedAt: report?.submittedAt || null,
    };
  });
}

async function loadEmployeeReportFor(date) {
  const data = await getJson(
    `/employee-daily-report?dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(date)}`,
  );
  const people = submissionStatusFor(data.reportUsers, data.reports, date);
  return {
    people,
    submitted: people.filter((person) => person.submitted).length,
    total: people.length,
  };
}

async function loadEmployeeReport() {
  const data = await getJson("/employee-daily-report");
  const status = data.todaySubmissionStatus || [];
  // Whether the nightly job has already produced today's PDF. Non-admins are not
  // allowed to read this, so a failure here must not fail the whole card.
  const pdf = await getJson("/employee-daily-report/report/pdf/status").catch(() => null);
  return {
    today: data.today || "",
    isAdmin: Boolean(data.isAdmin),
    todaySubmitted: Boolean(data.todaySubmitted),
    people: status,
    submitted: status.filter((person) => person.submitted).length,
    total: status.length,
    pdfReady: Boolean(pdf?.available),
    pdfGeneratedAt: pdf?.generatedAt || null,
  };
}

// Same endpoint the Employee Report page uses for its "Today PDF" button, so the
// generated document is byte-for-byte the one people already expect.
async function downloadEmployeeReportPdf(date) {
  const params = new URLSearchParams({ dateFrom: date, dateTo: date });
  const response = await fetch(`${API_URL}/employee-daily-report/report/pdf?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not download employee report PDF");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `employee-daily-report-${date}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
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

// blockEscape lets a layer stacked above the drawer (the image preview) claim
// the Escape key, so the first press closes that layer, not the whole drawer.
function Drawer({ darkMode, title, subtitle, count, onClose, blockEscape = false, toolbar = null, children }) {
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    if (blockEscape) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose, blockEscape]);

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
          <div className="flex shrink-0 items-center gap-2">
            {toolbar}
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

// Full-screen image preview, mirroring the Site Images page: backdrop/Escape to
// close, arrows or side buttons to page through, position counter at the bottom.
function ImagePreview({ photos, index, onIndex, onClose }) {
  const photo = photos[index];
  const canNavigate = photos.length > 1;
  const step = useCallback(
    (direction) => onIndex((index + direction + photos.length) % photos.length),
    [index, onIndex, photos.length],
  );

  // Drive's large renders (sz=w1600) are not always available for a file even
  // when the small one is, which showed a broken image beside a working grid
  // thumbnail. Only the failure count is stored and src derived from it, so no
  // effect is needed on navigation, and a size already known to fail is not
  // retried when paging back.
  const [fallbackLevel, setFallbackLevel] = useState({});
  const level = photo ? fallbackLevel[photo.url] || 0 : 0;
  const src = !photo ? "" : level === 0 ? driveFull(photo.url) : level === 1 ? driveThumb(photo.url) : photo.url;
  const handleImageError = useCallback(() => {
    if (!photo) return;
    setFallbackLevel((current) => ({
      ...current,
      [photo.url]: Math.min((current[photo.url] || 0) + 1, 2),
    }));
  }, [photo]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && photos.length > 1) step(-1);
      if (event.key === "ArrowRight" && photos.length > 1) step(1);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, step, photos.length]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Site image preview"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close image preview"
      >
        <X className="h-5 w-5" />
      </button>
      {canNavigate && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              step(-1);
            }}
            className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6 sm:h-14 sm:w-14"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              step(1);
            }}
            className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6 sm:h-14 sm:w-14"
            aria-label="Next image"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
      <img
        key={`${photo.id}:${level}`}
        src={src}
        alt={photo.trade || "Site preview"}
        onError={handleImageError}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] max-w-[94vw] object-contain"
      />
      <div className="pointer-events-none absolute bottom-16 left-1/2 max-w-[80vw] -translate-x-1/2 truncate text-center text-xs text-white/70">
        {[photo.site, photo.trade, photo.uploadedBy].filter(Boolean).join(" · ")}
      </div>
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
      className={`group flex min-h-[124px] w-full flex-col justify-between rounded-[22px] p-4 text-left transition disabled:cursor-not-allowed ${
        darkMode
          ? "bg-white/[0.045] hover:bg-white/[0.075] disabled:hover:bg-white/[0.045]"
          : "bg-white hover:-translate-y-0.5 disabled:hover:translate-y-0"
      }`}
    >
      {/* Title sits beside the icon so the card is identifiable from the header
          row alone; it is therefore not repeated under the value. */}
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.tone}`}>
          <card.icon className="h-4.5 w-4.5" />
        </span>
        <span className={`small min-w-0 flex-1 truncate text-sm font-medium ${darkMode ? "text-white/50" : "text-black/45"}`}>
          {card.label}
        </span>
        {!card.unavailable && (
          <ChevronRight
            className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${darkMode ? "text-white/30" : "text-black/25"}`}
          />
        )}
      </div>
      <div className="mt-3 min-w-0">
        <p className="small truncate text-[32px] font-bold leading-tight tabular-nums">
          {card.unavailable ? "—" : card.value}
        </p>
        {card.hint && (
          <p className={`small mt-1.5 truncate text-xs font-medium ${darkMode ? "text-white/45" : "text-black/45"}`}>
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
  // Index into the photos currently listed in the drawer; -1 means closed.
  const [previewIndex, setPreviewIndex] = useState(-1);
  // Per-drawer selected date. Absent means "today" — the cards always report
  // today regardless; only the drawers are browsable.
  const [drawerDate, setDrawerDate] = useState({});
  // Manpower and MRN are filtered server-side, so other dates need a fetch.
  // Cached by date so re-opening a day is instant.
  const [manpowerByDate, setManpowerByDate] = useState({});
  const [mrnByDate, setMrnByDate] = useState({});
  const [dateLoading, setDateLoading] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [reportByDate, setReportByDate] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Pure fetch — resolves to the next state and touches no setters, so the mount
  // effect below can await it without firing setState synchronously.
  const fetchAll = useCallback(async () => {
    const [projectRes, manpowerRes, attendanceRes, mrnRes, imagesRes, employeeRes] =
      await Promise.allSettled([
        loadProjectData(),
        loadManpower(),
        loadAttendance(),
        loadMrn(),
        loadSiteImages(),
        loadEmployeeReport(),
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
      employee: employeeRes.status === "fulfilled" ? employeeRes.value : null,
      employeeError: employeeRes.status === "rejected" ? employeeRes.reason?.message : "",
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
  // Counted off the sheet's own Timestamp column — the moment the row was added.
  // That is the only trustworthy field here: the typed request-date cells contain
  // real typos (MRN794 has "06/08/0025"), whereas the timestamp is generated.
  const mrnOn = useCallback(
    (records, date) =>
      (records || []).filter(
        (record) => (mrnDateKey(record.timestamp) || record.date) === date,
      ),
    [],
  );
  const todayMrn = useMemo(() => mrnOn(state.mrn?.records, today), [mrnOn, state.mrn, today]);

  /* -------- date browsing (drawers only; the cards always show today) ------ */

  const dateFor = useCallback((id) => drawerDate[id] || today, [drawerDate, today]);

  const pickDate = useCallback(
    async (id, date) => {
      if (!date) return;
      setDrawerDate((current) => ({ ...current, [id]: date }));
      setPreviewIndex(-1);
      // Attendance and site images already hold every date client-side; only the
      // two server-filtered sources need a request, and only once per date.
      if (id === "manpower" && !manpowerByDate[date]) {
        setDateLoading(`manpower:${date}`);
        try {
          const value = await loadManpowerFor(date);
          setManpowerByDate((current) => ({ ...current, [date]: value }));
        } catch {
          setManpowerByDate((current) => ({ ...current, [date]: null }));
        } finally {
          setDateLoading("");
        }
      }
      if (id === "report" && !reportByDate[date]) {
        setDateLoading(`report:${date}`);
        try {
          setReportByDate((current) => ({ ...current, [date]: null }));
          const value = await loadEmployeeReportFor(date);
          setReportByDate((current) => ({ ...current, [date]: value }));
        } catch {
          setReportByDate((current) => ({ ...current, [date]: { people: [], submitted: 0, total: 0 } }));
        } finally {
          setDateLoading("");
        }
      }
      if (id === "mrn" && !mrnByDate[date]) {
        setDateLoading(`mrn:${date}`);
        try {
          const records = await loadMrnFor(date);
          setMrnByDate((current) => ({ ...current, [date]: records }));
        } catch {
          setMrnByDate((current) => ({ ...current, [date]: [] }));
        } finally {
          setDateLoading("");
        }
      }
    },
    [manpowerByDate, mrnByDate, reportByDate],
  );

  const manpowerDate = dateFor("manpower");
  const drawerManpower =
    manpowerDate === today ? state.manpower : manpowerByDate[manpowerDate] || null;

  const mrnDate = dateFor("mrn");
  const drawerMrn = useMemo(() => {
    if (mrnDate === today) return todayMrn;
    // The first payload already covers the last 7 days, so nearby dates resolve
    // without an extra request; the cache only fills for dates outside it.
    const cached = mrnByDate[mrnDate];
    return mrnOn(cached || state.mrn?.records, mrnDate);
  }, [mrnDate, today, todayMrn, mrnByDate, mrnOn, state.mrn]);

  const attendanceDate = dateFor("attendance");
  const drawerAttendance = useMemo(
    () => (state.attendance?.records || []).filter((record) => record.date === attendanceDate),
    [state.attendance, attendanceDate],
  );

  const imagesDate = dateFor("images");
  const drawerPhotos = useMemo(
    () => (state.images?.photos || []).filter((photo) => photo.date === imagesDate),
    [state.images, imagesDate],
  );

  const reportDate = dateFor("report");
  // The drawer must reflect the picked date, not the backend's "today" — after
  // midnight those differ, which made every employee read as Pending.
  const reportSubmissions =
    reportDate === today
      ? state.employee
        ? { people: state.employee.people, submitted: state.employee.submitted, total: state.employee.total }
        : null
      : reportByDate[reportDate] || null;
  // Ready when the nightly job has already stored the file, or — for a past day,
  // or today after the cut-off — when it can be generated on demand.
  const reportReady =
    (reportDate === today && state.employee?.pdfReady) ||
    reportDate < today ||
    (reportDate === today && istMinutesNow() >= REPORT_CUTOFF_MINUTES);

  const downloadReport = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadEmployeeReportPdf(reportDate);
      toast.success("Employee report PDF downloaded");
    } catch (error) {
      toast.error(error.message || "Could not download employee report");
    } finally {
      setDownloading(false);
    }
  }, [reportDate]);

  const refreshManpower = useCallback(async () => {
    const date = dateFor("manpower");
    setDateLoading(`manpower:${date}`);
    try {
      if (date === today) {
        const value = await loadManpower(true);
        setState((current) => ({ ...current, manpower: value }));
      } else {
        const value = await loadManpowerFor(date, true);
        setManpowerByDate((current) => ({ ...current, [date]: value }));
      }
    } catch {
      toast.error("Failed to refresh manpower data");
    } finally {
      setDateLoading("");
    }
  }, [dateFor, today]);

  const dateToolbar = useCallback(
    (id) => (
      <div className="flex items-center gap-2">
        {dateLoading.startsWith(`${id}:`) && <Loader2 className="h-4 w-4 animate-spin opacity-60" />}
        {id === "manpower" && (
          <button
            type="button"
            onClick={refreshManpower}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${darkMode ? "border-white/10 text-white/70 hover:bg-white/5 hover:text-white" : "border-black/10 text-black/60 hover:bg-black/5 hover:text-black"}`}
            title="Pull latest data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        <DatePicker darkMode={darkMode} value={dateFor(id)} onChange={(value) => pickDate(id, value)} />
      </div>
    ),
    [darkMode, dateFor, pickDate, dateLoading, refreshManpower],
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
        id: "report",
        icon: FileText,
        label: "Employee report",
        value: state.employee
          ? state.employee.isAdmin
            ? `${state.employee.submitted}/${state.employee.total}`
            : state.employee.todaySubmitted
              ? "Sent"
              : "Pending"
          : "—",
        count: 1,
        // Prefer the server's answer (has the nightly job actually produced the
        // file?) and fall back to the clock only if the status call was denied.
        hint: !state.employee
          ? ""
          : state.employee.pdfReady || istMinutesNow() >= REPORT_CUTOFF_MINUTES
            ? "Today's report available"
            : `Available after ${REPORT_CUTOFF_LABEL}`,
        tone: "bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-300",
        unavailable: !state.employee,
        unavailableReason: state.employeeError,
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
          <h2 className={`small mt-1 text-2xl font-bold ${darkMode ? "text-white" : "text-[#171714]"}`}>
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

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
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

      {open === "manpower" && (
        <Drawer
          darkMode={darkMode}
          title="Manpower"
          subtitle={formatDay(manpowerDate)}
          toolbar={dateToolbar("manpower")}
          onClose={() => setOpen(null)}
        >
          {!drawerManpower ? (
            <EmptyNote darkMode={darkMode}>No manpower data for this date.</EmptyNote>
          ) : (
          <>
          <div className={`grid grid-cols-3 gap-3 rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
            {(() => {
              // Same rule as the card: met-or-beat the plan is green, short is red.
              const short = drawerManpower.actual < drawerManpower.planned;
              const tone = short ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
              return [
                ["Planned", drawerManpower.planned, ""],
                ["Actual", drawerManpower.actual, tone],
                ["Variance", `${drawerManpower.variance >= 0 ? "+" : ""}${drawerManpower.variance}`, tone],
              ].map(([label, value, valueTone]) => (
                <div key={label}>
                  <p className={`text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</p>
                  <p className={`mt-1 text-xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
                </div>
              ));
            })()}
          </div>
          {drawerManpower.missing > 0 && (
            <p className={`mt-3 rounded-2xl px-4 py-3 text-xs ${darkMode ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
              {drawerManpower.missing} of {drawerManpower.records} rows have no actual filled in yet.
            </p>
          )}
          <h3 className="mt-6 text-sm font-semibold">By site</h3>
          <div className="mt-3">
            {!drawerManpower.sites.length ? (
              <EmptyNote darkMode={darkMode}>No site rows for today.</EmptyNote>
            ) : (
              <>
                {/* "22/7" says nothing about which number is which, so label the two columns and
                    keep the same actual-then-planned order the dashboard card uses. Paddings match
                    Row's px-4/gap-3 so the headings sit over their own numbers. */}
                <div className={`mb-1.5 flex items-center gap-3 px-4 text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? "text-white/40" : "text-black/40"}`}>
                  <span className="min-w-0 flex-1">Site</span>
                  <span className="w-14 shrink-0 text-right">Actual</span>
                  <span className="w-14 shrink-0 text-right">Planned</span>
                </div>
                <ListCard darkMode={darkMode}>
                  {drawerManpower.sites.map((site) => (
                    <Row key={site.label} darkMode={darkMode}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{site.label}</span>
                        <span className={`mt-0.5 block text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                          {site.records} {site.records === 1 ? "row" : "rows"}
                        </span>
                      </span>
                      {/* Same tone rule as the totals above: met-or-beat the plan is green, short is red. */}
                      <span className={`w-14 shrink-0 text-right text-sm font-semibold tabular-nums ${site.actual >= site.planned ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {site.actual}
                      </span>
                      <span className={`w-14 shrink-0 text-right text-sm font-medium tabular-nums ${darkMode ? "text-white/55" : "text-black/55"}`}>
                        {site.planned}
                      </span>
                    </Row>
                  ))}
                </ListCard>
              </>
            )}
          </div>
          </>
          )}
        </Drawer>
      )}

      {open === "attendance" && (
        <Drawer
          darkMode={darkMode}
          title="Attendance"
          subtitle={formatDay(attendanceDate)}
          count={drawerAttendance.length}
          toolbar={dateToolbar("attendance")}
          onClose={() => setOpen(null)}
        >
          {!drawerAttendance.length ? (
            <EmptyNote darkMode={darkMode}>No one clocked in on this date.</EmptyNote>
          ) : (
            <ListCard darkMode={darkMode}>
              {drawerAttendance.map((record) => {
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
          title="MRN raised"
          subtitle={formatDay(mrnDate)}
          count={drawerMrn.length}
          toolbar={dateToolbar("mrn")}
          onClose={() => setOpen(null)}
        >
          {!drawerMrn.length ? (
            <EmptyNote darkMode={darkMode}>No material request was raised on this date.</EmptyNote>
          ) : (
            <div className="space-y-3">
              {drawerMrn.map((record) => {
                const delivered = /delivered|closed|complete/i.test(record.status || "");
                const materials = materialItems(record.materialRequirement);
                // Spelled out ("8 Jun 2026") so a day-first cell can't be misread
                // as month-first. Blank stays blank so the filter below still
                // drops fields the sheet never filled in.
                const asDay = (key) => (key ? formatDay(key) : "");
                const details = [
                  ["Added on", asDay(mrnDateKey(record.timestamp) || record.date)],
                  ["Request date", asDay(mrnDateKey(record.materialRequestDate))],
                  ["Project", record.project],
                  ["Category", record.category],
                  ["Vendor", record.vendorName],
                  ["Quotation", record.quotationAmount],
                  ["Required by", asDay(mrnDateKey(record.requiredDate))],
                  ["Issued by", record.issuedBy],
                  ["Assigned to", record.assignTo],
                  ["Lead time", record.leadTime],
                ].filter(([, value]) => String(value || "").trim());
                return (
                  <article
                    key={record.id}
                    className={`rounded-2xl p-5 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{record.mrnNo}</p>
                        {materials.length === 1 && (
                          <p className={`mt-1.5 text-[15px] leading-6 ${darkMode ? "text-white/75" : "text-black/75"}`}>
                            {materials[0]}
                          </p>
                        )}
                        {materials.length > 1 && (
                          <ul className={`mt-2 space-y-2 ${darkMode ? "text-white/75" : "text-black/75"}`}>
                            {materials.map((item, index) => (
                              <li key={`${record.id}-m${index}`} className="flex gap-2.5 text-[15px] leading-6">
                                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#89ed3f]" />
                                <span className="min-w-0">{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          delivered
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                        }`}
                      >
                        {record.status || "Open"}
                      </span>
                    </div>
                    {details.length > 0 && (
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        {details.map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className={`text-[11px] uppercase tracking-wide ${darkMode ? "text-white/40" : "text-black/40"}`}>
                              {label}
                            </dt>
                            <dd className="mt-1 truncate text-sm font-medium" title={String(value)}>
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {record.remark && (
                      <p className={`mt-3 rounded-xl px-3 py-2.5 text-[13px] leading-6 ${darkMode ? "bg-white/[0.04] text-white/60" : "bg-black/[0.03] text-black/60"}`}>
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
                            className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition ${darkMode ? "bg-white/[0.07] hover:bg-white/10" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                          >
                            MRN photo
                          </a>
                        )}
                        {record.quotationPhoto && (
                          <a
                            href={record.quotationPhoto}
                            target="_blank"
                            rel="noreferrer"
                            className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition ${darkMode ? "bg-white/[0.07] hover:bg-white/10" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
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

      {open === "report" && (
        <Drawer
          darkMode={darkMode}
          title="Employee report"
          subtitle={formatDay(reportDate)}
          toolbar={dateToolbar("report")}
          onClose={() => setOpen(null)}
        >
          <button
            type="button"
            onClick={downloadReport}
            disabled={!reportReady || downloading}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-semibold transition disabled:cursor-not-allowed ${
              reportReady
                ? "bg-[#171714] text-white hover:bg-black disabled:opacity-60 dark:bg-[#d8f36a] dark:text-[#11150f] dark:hover:bg-[#cdea5e]"
                : darkMode
                  ? "bg-white/[0.06] text-white/40"
                  : "bg-black/[0.04] text-black/35"
            }`}
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing PDF…
              </>
            ) : reportReady ? (
              <>
                <Download className="h-4 w-4" />
                {reportDate === today ? "Today's report available — Download" : "Download report"}
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Available after {REPORT_CUTOFF_LABEL}
              </>
            )}
          </button>
          {!reportReady && (
            <p className={`mt-2 text-center text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
              Employees can still submit until the cut-off, so the report is only
              final after {REPORT_CUTOFF_LABEL}. Pick an earlier date to download it now.
            </p>
          )}
          {reportDate === today && state.employee?.pdfGeneratedAt && (
            <p className={`mt-2 text-center text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
              Generated automatically at {formatClock(state.employee.pdfGeneratedAt)}
            </p>
          )}

          {state.employee?.isAdmin && (
            <>
              <div className="mt-6 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {reportDate === today ? "Submissions today" : `Submissions on ${formatDay(reportDate)}`}
                </h3>
                <span className={`text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>
                  {reportSubmissions ? `${reportSubmissions.submitted} of ${reportSubmissions.total}` : "Loading…"}
                </span>
              </div>
              <div className="mt-3">
                {!reportSubmissions ? (
                  <EmptyNote darkMode={darkMode}>Loading submissions…</EmptyNote>
                ) : !reportSubmissions.people.length ? (
                  <EmptyNote darkMode={darkMode}>No employees linked for reporting.</EmptyNote>
                ) : (
                  <ListCard darkMode={darkMode}>
                    {[...reportSubmissions.people]
                      // Outstanding first — that is the list anyone chasing
                      // submissions actually needs to see.
                      .sort((a, b) => Number(a.submitted) - Number(b.submitted))
                      .map((person) => (
                        <Row key={person.userId} darkMode={darkMode}>
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${person.submitted ? "bg-emerald-500" : "bg-amber-400"}`}
                            title={person.submitted ? "Submitted" : "Pending"}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{person.employeeName}</span>
                            <span className={`mt-0.5 block truncate text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                              {person.department || "—"}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-[11px] font-medium ${
                              person.submitted
                                ? darkMode ? "text-emerald-300" : "text-emerald-600"
                                : darkMode ? "text-amber-300" : "text-amber-600"
                            }`}
                          >
                            {person.submitted ? formatClock(person.submittedAt) || "Submitted" : "Pending"}
                          </span>
                        </Row>
                      ))}
                  </ListCard>
                )}
              </div>
            </>
          )}
        </Drawer>
      )}

      {open === "images" && (
        <Drawer
          darkMode={darkMode}
          title="Site images"
          subtitle={formatDay(imagesDate)}
          count={drawerPhotos.length}
          toolbar={dateToolbar("images")}
          blockEscape={previewIndex >= 0}
          onClose={() => {
            setPreviewIndex(-1);
            setOpen(null);
          }}
        >
          {!drawerPhotos.length ? (
            <EmptyNote darkMode={darkMode}>No images uploaded on this date.</EmptyNote>
          ) : (
            <div className="space-y-6">
              {[...new Set(drawerPhotos.map((photo) => photo.site))].map((site) => {
                const sitePhotos = drawerPhotos.filter((photo) => photo.site === site);
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
                        <button
                          key={photo.id}
                          type="button"
                          // Index into the flat list for this date, so prev/next
                          // pages through every image rather than stopping at
                          // the end of a site block.
                          onClick={() => setPreviewIndex(drawerPhotos.indexOf(photo))}
                          className="group block w-full overflow-hidden rounded-xl text-left"
                          title={`${photo.trade} · ${photo.uploadedBy}`}
                        >
                          <img
                            src={driveThumb(photo.url)}
                            alt={photo.trade}
                            loading="lazy"
                            className="h-24 w-full bg-black/5 object-cover transition group-hover:scale-[1.03]"
                          />
                          <span
                            className={`block truncate px-1 pt-1 text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}
                          >
                            {photo.trade}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Drawer>
      )}

      {/* Tied to the images drawer so the preview can never outlive it. */}
      {open === "images" && previewIndex >= 0 && drawerPhotos.length > 0 && (
        <ImagePreview
          photos={drawerPhotos}
          index={Math.min(previewIndex, drawerPhotos.length - 1)}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(-1)}
        />
      )}
    </>
  );
}
