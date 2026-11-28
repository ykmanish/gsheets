"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Ban, BellRing, Building2, CalendarCheck, Check, CheckCircle2, ChevronDown, ClipboardList, Clock3, Copy, Download, Eye, FileText, Heart, Inbox, LogIn, Loader2, Maximize2, Minimize2, PauseCircle, Plus, RefreshCw, Repeat2, Search, Settings2, Sheet, Sparkles, Star, Trash2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, getStoredAuth, useAuth } from "./AuthProvider";
import { Button, Chip, ConfirmModal, DateRangePicker, EmptyState, FeatureCard, IconTile, MultiSelect, PageHeader, SelectMenu, StatTile, Toggle, cx, toneOf, useClickOutside } from "./ui";
import UserAvatar from "./UserAvatar";

const employeeReportTestDateKey = "employee-report-test-date";

// `?employeeReportDate=` is a debugging aid, nothing more. It used to be written
// to localStorage and reused forever, so an employee who tapped an OLD WhatsApp
// reminder link - employeeReminderLink() bakes the date into it - had every later
// report filed against that stale date. It is now read once per page load, never
// stored, and only honoured for a Super Admin; everyone else always gets the
// server's real today. Any value left over from the old behaviour is deleted so
// affected browsers heal themselves on the next visit.
let employeeReportDateOverride = null;

function employeeReportDateOverrideValue() {
  if (employeeReportDateOverride !== null) return employeeReportDateOverride;
  if (typeof window === "undefined") return "";
  try {
    window.localStorage.removeItem(employeeReportTestDateKey);
  } catch {
    // Private mode can throw on storage access; the override simply stays off.
  }
  const queryDate = String(new URLSearchParams(window.location.search).get("employeeReportDate") || "");
  employeeReportDateOverride = /^\d{4}-\d{2}-\d{2}$/.test(queryDate) ? queryDate : "";
  return employeeReportDateOverride;
}

function employeeReportTestDate() {
  const override = employeeReportDateOverrideValue();
  if (!override) return "";
  return getStoredAuth().user?.isSuperAdmin ? override : "";
}

async function api(path, options = {}) {
  const testDate = employeeReportTestDate();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(testDate ? { "X-Employee-Report-Date": testDate } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

// The device clock. Only a placeholder until the server's date arrives - never
// the value a report is filed against.
function todayInput() {
  const testDate = employeeReportTestDate();
  if (testDate) return testDate;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function displayDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function addDaysInput(value, days) {
  const date = new Date(`${value || todayInput()}T00:00:00`);
  date.setDate(date.getDate() + days);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function rangeLabel(from, to) {
  if (!from && !to) return "Date range";
  if (from && to && from === to) return formatShortDate(from);
  if (from && to) return `${formatShortDate(from)} - ${formatShortDate(to)}`;
  return formatShortDate(from || to);
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseInputDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value) {
  const date = parseInputDate(value);
  if (!date) return "Date range";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthTitle(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildMonthGrid(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function createEmptyTaskRow() {
  return { draftTaskId: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`, site: "", category: "", categoryOther: "", status: "", statusOther: "", involvement: "", involvementValues: [], involvementOther: "", collaboratorUserIds: [], collaborationTask: false, collaborationSourceUserId: "", collaborationSourceName: "", description: "", durationHours: "", durationMinutes: "", startTime: "", endTime: "", timeFormat: "24", recurring: false, recurringId: "" };
}

function createEmptyWaitingRow() {
  return { draftTaskId: `waiting-${Date.now()}-${Math.random().toString(36).slice(2)}`, site: "", category: "", categoryOther: "", involvement: "", involvementValues: [], involvementOther: "", collaboratorUserIds: [], collaborationTask: false, collaborationSourceUserId: "", collaborationSourceName: "", description: "", durationHours: "", durationMinutes: "", startTime: "", endTime: "", timeFormat: "24" };
}

const emptyForm = {
  department: "",
  taskItems: [createEmptyTaskRow()],
  waitingTaskItems: [createEmptyWaitingRow()],
  dismissedRecurringIds: [],
  tomorrowPlanTick: true,
  note: "",
};

function fieldValue(value, other) {
  return value === "__other" ? other : value;
}

function involvementValuesFromRow(row = {}) {
  return uniqueClean([
    ...(Array.isArray(row.involvementValues) ? row.involvementValues : []),
    ...(Array.isArray(row.involvement) ? row.involvement : String(row.involvement || "").split(",")),
  ].filter((value) => value !== "__other"));
}

function involvementText(row = {}) {
  return uniqueClean([
    ...involvementValuesFromRow(row),
    row.involvementOther,
  ]).join(", ");
}

function hasTeamInvolvement(row = {}) {
  return involvementValuesFromRow(row).some((value) => value.toLowerCase() === "team");
}

function recurringIdForTask(item = {}) {
  return item.recurringId || [item.site, item.category, item.description].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function normalizeTaskRowForForm(item = {}, fallback = {}, includeStatus = true) {
  const involvementValues = involvementValuesFromRow({ ...item, involvement: item.involvement || fallback.involvement });
  return {
    ...(includeStatus ? createEmptyTaskRow() : createEmptyWaitingRow()),
    ...item,
    draftTaskId: item.draftTaskId || item.collaborationDraftId || item.inviteId || (includeStatus ? createEmptyTaskRow().draftTaskId : createEmptyWaitingRow().draftTaskId),
    status: includeStatus ? item.status || fallback.taskStatus || "" : "",
    involvement: involvementValues.join(", "),
    involvementValues,
    collaboratorUserIds: Array.isArray(item.collaboratorUserIds) ? item.collaboratorUserIds.map(String).filter(Boolean) : [],
    collaborationTask: Boolean(item.collaborationTask),
    collaborationSourceUserId: item.collaborationSourceUserId || "",
    collaborationSourceName: item.collaborationSourceName || "",
    recurring: includeStatus ? Boolean(item.recurring) : false,
    recurringId: includeStatus ? item.recurringId || recurringIdForTask(item) : "",
  };
}

function plannedWorkKey(item = {}, index = 0, sourceDate = "") {
  return [sourceDate, index, item.site, item.category, item.description].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function cleanTaskItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    site: String(item?.site || "").trim(),
    category: String(item?.category || "").trim(),
    status: String(item?.status || "").trim(),
    involvement: String(item?.involvement || "").trim(),
    involvementValues: involvementValuesFromRow(item),
    draftTaskId: String(item?.draftTaskId || item?.collaborationDraftId || ""),
    collaboratorUserIds: Array.isArray(item?.collaboratorUserIds) ? item.collaboratorUserIds.map(String).filter(Boolean) : [],
    collaborationTask: Boolean(item?.collaborationTask),
    collaborationSourceUserId: String(item?.collaborationSourceUserId || ""),
    collaborationSourceName: String(item?.collaborationSourceName || ""),
    description: String(item?.description || "").trim(),
  })).filter((item) => item.site || item.category || item.description);
}

function collaborationDraftRows(items = [], includeStatus = true) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const involvementValues = hasTeamInvolvement(item) ? ["Team"] : uniqueClean([...involvementValuesFromRow(item), item.involvementOther]);
    return {
      site: fieldValue(item.site, item.siteOther).trim(),
      category: fieldValue(item.category, item.categoryOther).trim(),
      status: includeStatus ? fieldValue(item.status, item.statusOther).trim() : "In Progress",
      involvement: involvementValues.join(", "),
      involvementValues,
      description: String(item.description || "").trim(),
      durationHours: cleanDurationPart(item.durationHours ?? item.duration?.hours ?? ""),
      durationMinutes: cleanDurationPart(item.durationMinutes ?? item.duration?.minutes ?? "", 59),
      collaboratorUserIds: hasTeamInvolvement(item) ? uniqueClean(item.collaboratorUserIds || []) : [],
      collaborationDraftId: item.draftTaskId || item.collaborationDraftId || "",
    };
  }).filter((item) => item.site && item.category && item.description && item.collaboratorUserIds.length);
}

function plannedWorkToTaskRow(item = {}) {
  const site = String(item.site || "").trim();
  const category = String(item.category || "").trim();
  const description = String(item.description || "").trim();
  const involvementValues = involvementValuesFromRow(item);
  return {
    ...createEmptyTaskRow(),
    draftTaskId: item.draftTaskId || item.collaborationDraftId || createEmptyTaskRow().draftTaskId,
    site,
    category,
    status: "In Progress",
    involvement: involvementValues.join(", "),
    involvementValues,
    involvementOther: item.involvementOther || "",
    collaboratorUserIds: Array.isArray(item.collaboratorUserIds) ? item.collaboratorUserIds.map(String).filter(Boolean) : [],
    collaborationTask: Boolean(item.collaborationTask),
    collaborationSourceUserId: item.collaborationSourceUserId || "",
    collaborationSourceName: item.collaborationSourceName || "",
    description,
    recurringId: recurringIdForTask({ site, category, description }),
  };
}

function uniqueClean(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function executiveAnswerState(questions = [], saved = null) {
  const savedMap = new Map((saved?.answers || []).map((answer) => [answer.id, answer.answer || ""]));
  return questions.reduce((result, question) => {
    result[question.id] = savedMap.get(question.id) || "";
    return result;
  }, {});
}

function formatDraftTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function padTimePart(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

function cleanDurationPart(value, max = 999) {
  const text = String(value ?? "").replace(/[^\d]/g, "");
  if (!text) return "";
  return String(Math.min(max, Math.max(0, Number.parseInt(text, 10) || 0)));
}

function parseReminderTime(value) {
  const [rawHour, rawMinute] = String(value || "18:50").split(":");
  const hour = Math.min(23, Math.max(0, Number.parseInt(rawHour, 10) || 0));
  const minute = Math.min(59, Math.max(0, Number.parseInt(rawMinute, 10) || 0));
  return { hour, minute };
}

function formatReminderTime(hour, minute) {
  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

function shiftReminderTime(value, part, delta) {
  const { hour, minute } = parseReminderTime(value);
  if (part === "hour") return formatReminderTime((hour + delta + 24) % 24, minute);
  return formatReminderTime(hour, (minute + delta + 60) % 60);
}

function ReminderTimeWheel({ value, onChange, darkMode }) {
  const wheelStateRef = useRef({});
  const { hour, minute } = parseReminderTime(value);
  const columns = [
    { key: "hour", label: "Hr", value: hour, max: 24 },
    { key: "minute", label: "Min", value: minute, max: 60 },
  ];
  const scrollPart = (event, part) => {
    event.preventDefault();
    if (!event.deltaY) return;
    const current = wheelStateRef.current[part] || { delta: 0, lastAt: 0 };
    const now = event.timeStamp || 0;
    const nextDelta = now - current.lastAt > 220 ? event.deltaY : current.delta + event.deltaY;
    const threshold = 95;
    if (Math.abs(nextDelta) < threshold) {
      wheelStateRef.current[part] = { delta: nextDelta, lastAt: now };
      return;
    }
    wheelStateRef.current[part] = { delta: 0, lastAt: now };
    onChange(shiftReminderTime(value, part, nextDelta > 0 ? 1 : -1));
  };

  return (
    <div className={`mt-2 overflow-hidden rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
      <p className={`text-[12px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>Pick time</p>
      <div className="mt-3 grid grid-cols-2 items-center gap-3">
        {columns.map((column, index) => {
          const previous = (column.value - 1 + column.max) % column.max;
          const next = (column.value + 1) % column.max;
          return (
            <div key={column.key} className={`grid grid-cols-[1fr_auto] items-center gap-2 ${index === 0 ? "border-r pr-3 " : ""}${index === 0 ? darkMode ? "border-white/10" : "border-[#f0f0ee]" : ""}`}>
              <div
                role="spinbutton"
                tabIndex={0}
                aria-label={`${column.label} picker`}
                aria-valuemin={0}
                aria-valuemax={column.max - 1}
                aria-valuenow={column.value}
                onWheel={(event) => scrollPart(event, column.key)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    onChange(shiftReminderTime(value, column.key, -1));
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    onChange(shiftReminderTime(value, column.key, 1));
                  }
                }}
                className={`relative overflow-hidden rounded-[16px] outline-none transition focus:ring-[3px] ${darkMode ? "bg-white/[0.05] focus:ring-white/10" : "bg-[#f4f4f2] focus:ring-black/[0.05]"}`}
              >
                <button
                  type="button"
                  onClick={() => onChange(shiftReminderTime(value, column.key, -1))}
                  className={`block h-9 w-full text-center text-xl tabular-nums transition ${darkMode ? "text-white/25 hover:text-white/50" : "text-[#c4c4c1] hover:text-[#8a8a8a]"}`}
                  aria-label={`Decrease ${column.label}`}
                >
                  {padTimePart(previous)}
                </button>
                <div className={`mx-auto grid h-12 w-full place-items-center border-y text-3xl tabular-nums tracking-[-0.02em] ${darkMode ? "border-white/10 text-white" : "border-[#e8e8e6] text-[#141414]"}`}>
                  {padTimePart(column.value)}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(shiftReminderTime(value, column.key, 1))}
                  className={`block h-9 w-full text-center text-xl tabular-nums transition ${darkMode ? "text-white/25 hover:text-white/50" : "text-[#c4c4c1] hover:text-[#8a8a8a]"}`}
                  aria-label={`Increase ${column.label}`}
                >
                  {padTimePart(next)}
                </button>
              </div>
              <span className={`text-xs ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{column.label}</span>
            </div>
          );
        })}
      </div>
      <div className={`mt-4 flex items-center justify-between rounded-[14px] px-4 py-3 ${darkMode ? "bg-[#cff07a]/15" : "bg-[#eef8cc]"}`}>
        <span className={`text-xs ${darkMode ? "text-white/55" : "text-[#4d6b12]"}`}>Selected</span>
        <span className="tabular-nums">{formatReminderTime(hour, minute)} IST</span>
      </div>
    </div>
  );
}

function timeDisplayParts(value = "", format = "24") {
  const hasValue = /^\d{2}:\d{2}$/.test(String(value || ""));
  if (!hasValue) return { hour: "", minute: "", period: "AM" };
  const [rawHour, minute] = value.split(":");
  const hour24 = Number(rawHour);
  if (format === "12") {
    return {
      hour: padTimePart(hour24 % 12 || 12),
      minute,
      period: hour24 >= 12 ? "PM" : "AM",
    };
  }
  return { hour: rawHour, minute, period: hour24 >= 12 ? "PM" : "AM" };
}

function timePartsToValue(hour, minute, period, format = "24") {
  if (!hour || !minute) return "";
  let hourNumber = Number(hour);
  if (format === "12") {
    if (period === "PM" && hourNumber !== 12) hourNumber += 12;
    if (period === "AM" && hourNumber === 12) hourNumber = 0;
  }
  return `${padTimePart(hourNumber)}:${padTimePart(minute)}`;
}

function TaskDurationField({ row, onChange, darkMode }) {
  const hours = cleanDurationPart(row.durationHours ?? row.duration?.hours ?? "");
  const minutes = cleanDurationPart(row.durationMinutes ?? row.duration?.minutes ?? "", 59);
  const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const label = totalMinutes
    ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 ? ` ${totalMinutes % 60}m` : ""}`
    : "--";
  const inputClass = `h-10 w-full rounded-full border px-3 text-center text-sm tabular-nums outline-none transition focus:ring-[3px] ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/25 focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-black/[0.05]"}`;

  return (
    <div className={`rounded-[16px] border px-3 py-2.5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
      <div className={`mb-2 flex items-center gap-2 text-[12px] ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`}>
        <Clock3 className="h-3.5 w-3.5" /> Duration
      </div>
      <div className="grid grid-cols-[1fr_1fr_92px] items-end gap-2">
        <label className="min-w-0">
          <span className={`mb-1 block text-[11px] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>Hours</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={hours}
            onChange={(event) => onChange({ durationHours: cleanDurationPart(event.target.value), durationMinutes: minutes, startTime: "", endTime: "", timeFormat: "24" })}
            placeholder="0"
            className={inputClass}
          />
        </label>
        <label className="min-w-0">
          <span className={`mb-1 block text-[11px] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>Minutes</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={minutes}
            onChange={(event) => onChange({ durationHours: hours, durationMinutes: cleanDurationPart(event.target.value, 59), startTime: "", endTime: "", timeFormat: "24" })}
            placeholder="0"
            className={inputClass}
          />
        </label>
        <div className={`grid h-16 place-items-center rounded-[14px] text-center ${totalMinutes ? darkMode ? "bg-[#cff07a]/15 text-[#d8f39a]" : "bg-[#eef8cc] text-[#4d6b12]" : darkMode ? "bg-white/[0.05] text-white/30" : "bg-[#f4f4f2] text-[#a3a3a0]"}`}>
          <div>
            <p className="text-[11px] opacity-80">Total</p>
            <p className="mt-0.5 text-lg tabular-nums tracking-[-0.02em]">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function hasEmployeeDraftContent(form = {}) {
  const hasText = [form.note].some((value) => String(value || "").trim());
  const hasRows = [...(Array.isArray(form.taskItems) ? form.taskItems : []), ...(Array.isArray(form.waitingTaskItems) ? form.waitingTaskItems : [])]
    .some((item) => [item?.site, item?.siteOther, item?.category, item?.categoryOther, item?.status, item?.statusOther, item?.involvement, item?.involvementOther, item?.description].some((value) => String(value || "").trim()));
  return Boolean(hasText || hasRows);
}

function ThreeDotLoader({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label="Loading">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}

// Grey pill field and soft textarea, as in the kit's fieldClass.
function pillInputClass(darkMode) {
  return darkMode
    ? "h-11 w-full rounded-full border border-transparent bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-white/35 hover:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10"
    : "h-11 w-full rounded-full border border-transparent bg-[#f4f4f2] px-4 text-sm text-[#141414] outline-none transition placeholder:text-[#a3a3a0] hover:bg-[#efefec] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]";
}

function areaInputClass(darkMode) {
  return darkMode
    ? "w-full rounded-[16px] border border-transparent bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10"
    : "w-full rounded-[16px] border border-transparent bg-[#f4f4f2] px-4 py-3 text-sm text-[#141414] outline-none transition placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]";
}

// Header row for the drawers and modals this page builds: icon tile, two lines, round close.
function DrawerHeader({ darkMode, icon, tone = "mint", title, subtitle, onClose, closeLabel = "Close", children }) {
  return (
    <div className={cx("flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 sm:px-6", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
      <div className="flex min-w-0 items-center gap-3">
        <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-[16px] tracking-[-0.01em]">{title}</p>
          {subtitle && <p className={cx("truncate text-[12.5px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {onClose && (
          <button type="button" onClick={onClose} aria-label={closeLabel} className={cx("grid h-9 w-9 place-items-center rounded-full transition", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// A small label / value tile for drawer side panels.
function SideFact({ darkMode, label, children, tone }) {
  const t = tone ? toneOf(tone) : null;
  return (
    <div className="rounded-[16px] p-4" style={t ? { backgroundColor: darkMode ? t[2] : t[0] } : undefined}>
      <p className={cx("text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{label}</p>
      <div className="mt-1 text-[14px]">{children}</div>
    </div>
  );
}

function taskStatusMeta(status, darkMode = false) {
  const value = String(status || "").toLowerCase();
  if (value.includes("complete")) return {
    Icon: CheckCircle2,
    tone: "mint",
    selected: darkMode ? "border-transparent bg-emerald-400/[0.12] text-[#a7e8bf]" : "border-transparent bg-[#e4f1e6] text-[#2f7a4f]",
    option: darkMode ? "text-[#a7e8bf] hover:bg-emerald-400/10" : "text-[#2f7a4f] hover:bg-[#e4f1e6]",
    active: "bg-[#2f7a4f] text-white",
    dot: "bg-[#2f7a4f]",
    fg: darkMode ? "#a7e8bf" : "#2f7a4f",
    bg: darkMode ? "rgba(52, 211, 153, 0.12)" : "#e4f1e6",
  };
  if (value.includes("halt")) return {
    Icon: PauseCircle,
    tone: "amber",
    selected: darkMode ? "border-transparent bg-amber-400/[0.13] text-[#f5d27a]" : "border-transparent bg-[#fbf0d4] text-[#8a6200]",
    option: darkMode ? "text-[#f5d27a] hover:bg-amber-400/10" : "text-[#8a6200] hover:bg-[#fbf0d4]",
    active: "bg-[#8a6200] text-white",
    dot: "bg-[#c99a1e]",
    fg: darkMode ? "#f5d27a" : "#8a6200",
    bg: darkMode ? "rgba(251, 191, 36, 0.13)" : "#fbf0d4",
  };
  if (value.includes("suspend")) return {
    Icon: AlertTriangle,
    tone: "peach",
    selected: darkMode ? "border-transparent bg-orange-400/[0.13] text-[#f9bf9b]" : "border-transparent bg-[#fbe5dc] text-[#c2562b]",
    option: darkMode ? "text-[#f9bf9b] hover:bg-orange-400/10" : "text-[#c2562b] hover:bg-[#fbe5dc]",
    active: "bg-[#c2562b] text-white",
    dot: "bg-[#c2562b]",
    fg: darkMode ? "#f9bf9b" : "#c2562b",
    bg: darkMode ? "rgba(251, 146, 60, 0.13)" : "#fbe5dc",
  };
  if (value.includes("cancel")) return {
    Icon: Ban,
    tone: "rose",
    selected: darkMode ? "border-transparent bg-rose-400/[0.13] text-[#f7aab5]" : "border-transparent bg-[#fbe4e6] text-[#c0394b]",
    option: darkMode ? "text-[#f7aab5] hover:bg-rose-400/10" : "text-[#c0394b] hover:bg-[#fbe4e6]",
    active: "bg-[#c0394b] text-white",
    dot: "bg-[#c0394b]",
    fg: darkMode ? "#f7aab5" : "#c0394b",
    bg: darkMode ? "rgba(251, 113, 133, 0.13)" : "#fbe4e6",
  };
  return {
    Icon: Clock3,
    tone: "sky",
    selected: darkMode ? "border-transparent bg-sky-400/[0.13] text-[#a9cbf7]" : "border-transparent bg-[#e3eefb] text-[#2f6fc0]",
    option: darkMode ? "text-[#a9cbf7] hover:bg-sky-400/10" : "text-[#2f6fc0] hover:bg-[#e3eefb]",
    active: "bg-[#141414] text-white",
    dot: "bg-[#2f6fc0]",
    fg: darkMode ? "#a9cbf7" : "#2f6fc0",
    bg: darkMode ? "rgba(56, 189, 248, 0.13)" : "#e3eefb",
  };
}

// Site, category and status pickers: "Most used" first, then the rest, then "Other".
function SearchableSelect({ darkMode, value, onChange, options = [], popularOptions = [], placeholder, allowOther = true, variant = "default" }) {
  const popularKeys = new Set(popularOptions.map((option) => String(option.value || option).toLowerCase()));
  // Task status options are colour-coded: green done, blue in progress, amber halt, orange suspended, red cancelled.
  const statusLook = (option) => {
    if (variant !== "status") return {};
    const meta = taskStatusMeta(option, darkMode);
    return { icon: <meta.Icon className="h-4 w-4 shrink-0" style={{ color: meta.fg }} />, color: meta.fg };
  };
  const popular = options.filter((option) => popularKeys.has(option.toLowerCase()));
  const regular = options.filter((option) => !popularKeys.has(option.toLowerCase()));
  const items = [
    ...popular.map((option) => ({ value: option, label: option, ...statusLook(option), group: "Most used", badge: "Most used" })),
    ...regular.map((option) => ({ value: option, label: option, ...statusLook(option), group: popular.length ? "All" : undefined })),
    ...(allowOther ? [{ value: "__other", label: "Other", group: " " }] : []),
  ];
  const chosenStatus = variant === "status" && value && value !== "__other" ? taskStatusMeta(value, darkMode) : null;
  return (
    <SelectMenu
      darkMode={darkMode}
      value={value}
      options={items}
      onChange={onChange}
      placeholder={placeholder}
      searchable
      groupLabels
      size="lg"
      triggerStyle={chosenStatus ? { backgroundColor: chosenStatus.bg, color: chosenStatus.fg } : undefined}
    />
  );
}

function MultiChoiceSelect({ darkMode, values = [], onChange, options = [], popularOptions = [], placeholder, onOptionToggle }) {
  const popularKeys = new Set(popularOptions.map((option) => String(option.value || option).toLowerCase()));
  const popular = options.filter((option) => popularKeys.has(option.toLowerCase()));
  const regular = options.filter((option) => !popularKeys.has(option.toLowerCase()));
  const items = [
    ...popular.map((option) => ({ value: option, label: option, group: "Most used", badge: "Most used" })),
    ...regular.map((option) => ({ value: option, label: option, group: popular.length ? "All" : undefined })),
  ];
  return (
    <MultiSelect
      darkMode={darkMode}
      values={values}
      options={items}
      placeholder={placeholder}
      size="lg"
      onChange={(next) => onChange(uniqueClean(next))}
      onToggle={(option, next, was) => onOptionToggle?.(option, uniqueClean(next), was)}
    />
  );
}

function taskNumberTone(index, darkMode = false) {
  void index;
  return darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white";
}

function taskRowValue(row, field) {
  if (field === "site") return row.site === "__other" ? row.siteOther : row.site;
  if (field === "category") return row.category === "__other" ? row.categoryOther : row.category;
  if (field === "status") return row.status === "__other" ? row.statusOther : row.status;
  if (field === "involvement") return involvementText(row);
  return "";
}

function taskTimeLabel(item = {}) {
  const duration = taskDurationLabel(item);
  if (duration) return duration;
  const start = String(item.startTime || "").trim();
  const end = String(item.endTime || "").trim();
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function taskDurationLabel(item = {}) {
  const directMinutes = Number(item.durationTotalMinutes ?? item.durationMinutesTotal);
  if (Number.isFinite(directMinutes) && directMinutes > 0) {
    const hours = Math.floor(directMinutes / 60);
    const remainder = directMinutes % 60;
    if (!hours) return `${remainder}m`;
    if (!remainder) return `${hours}h`;
    return `${hours}h ${remainder}m`;
  }
  const hoursValue = Number.parseInt(item.durationHours, 10) || Number.parseInt(item.duration?.hours, 10) || 0;
  const minutesValue = Number.parseInt(item.durationMinutes, 10) || Number.parseInt(item.duration?.minutes, 10) || 0;
  const enteredMinutes = Math.max(0, hoursValue) * 60 + Math.min(59, Math.max(0, minutesValue));
  if (enteredMinutes > 0) {
    const hours = Math.floor(enteredMinutes / 60);
    const remainder = enteredMinutes % 60;
    if (!hours) return `${remainder}m`;
    if (!remainder) return `${hours}h`;
    return `${hours}h ${remainder}m`;
  }
  const start = String(item.startTime || "");
  const end = String(item.endTime || "");
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return "";
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function TaskRowsEditor({ title, rows, categories, sites = [], statuses = [], involvements = [], popularSites = [], popularCategories = [], popularInvolvements = [], collaborationUsers = [], showStatus = false, showInvolvement = false, onRowsChange, onRefineDescription, required = false, darkMode = false }) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [refiningIndex, setRefiningIndex] = useState(null);
  const [teamPickerIndex, setTeamPickerIndex] = useState(null);
  const taskListRef = useRef(null);
  const activeExpandedIndex = Math.min(expandedIndex, Math.max(0, rows.length - 1));
  const teamPickerRow = teamPickerIndex !== null ? rows[teamPickerIndex] : null;
  const selectedTeamUsers = new Set(teamPickerRow?.collaboratorUserIds || []);

  function updateRow(index, patch) {
    onRowsChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
  function updateTeamUsers(ids) {
    if (teamPickerIndex === null) return;
    updateRow(teamPickerIndex, { collaboratorUserIds: ids });
  }
  function toggleTeamUser(userId) {
    const currentIds = teamPickerRow?.collaboratorUserIds || [];
    updateTeamUsers(selectedTeamUsers.has(userId) ? currentIds.filter((id) => id !== userId) : [...currentIds, userId]);
  }
  async function refineRowDescription(index) {
    const currentText = rows[index]?.description || "";
    if (!currentText.trim()) {
      toast.error("Add a description first");
      return;
    }
    if (!onRefineDescription || refiningIndex !== null) return;
    try {
      setRefiningIndex(index);
      const refined = await onRefineDescription(currentText);
      if (refined) updateRow(index, { description: refined });
    } finally {
      setRefiningIndex(null);
    }
  }
  function addRow() {
    setExpandedIndex(rows.length);
    onRowsChange([...rows, showStatus ? createEmptyTaskRow() : createEmptyWaitingRow()]);
    // Scroll the new task to the top of the view, so it can be filled straight away on a phone.
    window.setTimeout(() => taskListRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  function duplicateRow(index) {
    const source = rows[index] || {};
    setExpandedIndex(rows.length);
    onRowsChange([
      ...rows,
      {
        site: source.site || "",
        draftTaskId: createEmptyTaskRow().draftTaskId,
        siteOther: source.siteOther || "",
        category: source.category || "",
        categoryOther: source.categoryOther || "",
        status: source.status || "",
        statusOther: source.statusOther || "",
        involvement: source.involvement || "",
        involvementValues: involvementValuesFromRow(source),
        involvementOther: source.involvementOther || "",
        description: "",
        durationHours: source.durationHours || source.duration?.hours || "",
        durationMinutes: source.durationMinutes || source.duration?.minutes || "",
        startTime: source.startTime || "",
        endTime: source.endTime || "",
        timeFormat: source.timeFormat || "24",
        recurring: Boolean(source.recurring),
        recurringId: source.recurringId || "",
        collaboratorUserIds: Array.isArray(source.collaboratorUserIds) ? source.collaboratorUserIds : [],
        collaborationTask: Boolean(source.collaborationTask),
        collaborationSourceUserId: source.collaborationSourceUserId || "",
        collaborationSourceName: source.collaborationSourceName || "",
      },
    ]);
  }
  function removeRow(index) {
    const removedRow = rows[index] || {};
    const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [showStatus ? createEmptyTaskRow() : createEmptyWaitingRow()];
    setExpandedIndex((current) => Math.max(0, current > index ? current - 1 : Math.min(current, rows.length - 2)));
    onRowsChange(nextRows, { action: "remove", removedRow, index });
  }

  const summaryPill = darkMode ? "bg-white/[0.05] text-white/85" : "bg-white text-[#141414]";
  const summaryMuted = darkMode ? "text-white/40" : "text-[#9a9a98]";
  const fieldLabel = `mb-2 text-[12px] ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`;
  const rowIconButton = `grid h-10 w-10 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f4f4f2] text-[#5f5f5c] hover:bg-[#ebebe8]"}`;
  const rowDangerButton = `grid h-10 w-10 place-items-center rounded-full transition ${darkMode ? "bg-rose-400/[0.12] text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`;
  const expandedGridClass = showStatus && showInvolvement
    ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
    : showStatus || showInvolvement
      ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]";

  return (
    <div className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className={`block text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</label>
        {rows.some((row) => row.collaborationTask && row.collaborationSourceName) && (
          <div className="flex flex-wrap justify-end gap-2">
            {uniqueClean(rows.filter((row) => row.collaborationTask && row.collaborationSourceName).map((row) => row.collaborationSourceName)).map((sourceName) => (
              <Chip key={sourceName} tone="lime" darkMode={darkMode} icon={Users}>
                Collaboration from {sourceName}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div ref={taskListRef} className="space-y-3">
        {rows.map((row, index) => {
          const collapsed = rows.length > 1 && activeExpandedIndex !== index;
          return (
            <div
              key={index}
              role={collapsed ? "button" : undefined}
              tabIndex={collapsed ? 0 : undefined}
              onClick={() => { if (collapsed) setExpandedIndex(index); }}
              onKeyDown={(event) => { if (collapsed && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setExpandedIndex(index); } }}
              className={`relative rounded-[20px] border p-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? darkMode ? "cursor-pointer border-white/10 bg-white/[0.03] hover:bg-white/[0.05]" : "cursor-pointer border-transparent bg-[#f7f7f5] hover:bg-[#f2f2ef]" : darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
            >
              {collapsed ? (
                <div className={`grid items-center gap-3 ${expandedGridClass} animate-[mrn-drawer-in_260ms_cubic-bezier(0.22,1,0.36,1)]`}>
                  {[
                    ["Site", taskRowValue(row, "site")],
                    ["Category", taskRowValue(row, "category")],
                    ...(showInvolvement ? [["Involvement", taskRowValue(row, "involvement")]] : []),
                    ...(showStatus ? [["Task status", taskRowValue(row, "status")]] : []),
                  ].map(([label, value]) => {
                    const statusMeta = label === "Task status" && value ? taskStatusMeta(value, darkMode) : null;
                    const StatusIcon = statusMeta?.Icon;
                    return (
                    <div key={label} className={`min-w-0 rounded-[14px] px-4 py-2.5 ${statusMeta ? statusMeta.selected : summaryPill}`}>
                      <p className={`text-[11.5px] ${statusMeta ? "opacity-70" : summaryMuted}`}>{label}</p>
                      <p className="mt-0.5 flex items-center gap-2 truncate text-[13.5px]">
                        {StatusIcon ? <StatusIcon className="h-4 w-4 shrink-0" /> : null}
                        <span className="truncate">{value || "Not selected"}</span>
                      </p>
                    </div>
                    );
                  })}
                  <div className="flex items-center justify-end gap-2">
                    <span className={`inline-flex h-10 min-w-11 items-center justify-center rounded-full px-4 text-[13px] ${taskNumberTone(index, darkMode)}`}>
                      Task {index + 1}
                    </span>
                    <button type="button" onClick={(event) => { event.stopPropagation(); duplicateRow(index); }} className={rowIconButton} title="Duplicate task"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); removeRow(index); }} className={rowDangerButton}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${expandedGridClass}`}>
                  <div className="order-1">
                    <p className={fieldLabel}>Site</p>
                    <SearchableSelect darkMode={darkMode} value={row.site} onChange={(value) => updateRow(index, { site: value })} options={sites} popularOptions={popularSites} placeholder="Choose site" allowOther />
                    {row.site === "__other" && (
                      <input required value={row.siteOther || ""} onChange={(event) => updateRow(index, { siteOther: event.target.value })} placeholder="Enter site" className={`mt-2 ${pillInputClass(darkMode)}`} />
                    )}
                    {required && index === 0 && !row.site && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                  </div>
                  {showStatus && (
                    <div className="order-4">
                      <p className={fieldLabel}>Task status</p>
                      <SearchableSelect darkMode={darkMode} value={row.status} onChange={(value) => updateRow(index, { status: value })} options={statuses.filter((status) => status !== "Other")} placeholder="Choose task status" allowOther variant="status" />
                      {row.status === "__other" && <input required={required} value={row.statusOther || ""} onChange={(event) => updateRow(index, { statusOther: event.target.value })} placeholder="Enter task status" className={`mt-2 ${pillInputClass(darkMode)}`} />}
                      {required && index === 0 && !row.status && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                    </div>
                  )}
                  {showInvolvement && (
                    <div className="order-3">
                      <p className={fieldLabel}>Involvement</p>
                      <MultiChoiceSelect darkMode={darkMode} values={involvementValuesFromRow(row)} onChange={(values) => {
                        const hadTeam = hasTeamInvolvement(row);
                        const hasTeam = values.some((value) => value.toLowerCase() === "team");
                        updateRow(index, { involvementValues: values, involvement: values.join(", "), collaboratorUserIds: hasTeam ? row.collaboratorUserIds || [] : [] });
                        if (hasTeam && !hadTeam && !row.collaborationTask) setTeamPickerIndex(index);
                      }} onOptionToggle={(option, nextValues, wasSelected) => {
                        const teamStillSelected = nextValues.some((value) => value.toLowerCase() === "team");
                        if (option.toLowerCase() === "team" && !wasSelected && teamStillSelected && !row.collaborationTask) setTeamPickerIndex(index);
                      }} options={involvements} popularOptions={popularInvolvements} placeholder="Choose involvement" />
                      {involvementValuesFromRow(row).some((value) => value.toLowerCase() === "other") && (
                        <input
                          required={required && index === 0}
                          value={row.involvementOther || ""}
                          onChange={(event) => updateRow(index, { involvementOther: event.target.value })}
                          placeholder="Enter involvement"
                          className={`mt-2 ${pillInputClass(darkMode)}`}
                        />
                      )}
                      {required && index === 0 && !involvementText(row) && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                    </div>
                  )}
                  <div className="order-2">
                    <p className={fieldLabel}>Category</p>
                    <SearchableSelect darkMode={darkMode} value={row.category} onChange={(value) => updateRow(index, { category: value })} options={categories.filter((category) => category !== "Other")} popularOptions={popularCategories} placeholder="Choose category" allowOther />
                    {row.category === "__other" && (
                      <input required={required && index === 0} value={row.categoryOther || ""} onChange={(event) => updateRow(index, { categoryOther: event.target.value })} placeholder="Enter category" className={`mt-2 ${pillInputClass(darkMode)}`} />
                    )}
                    {required && index === 0 && !row.category && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                  </div>
                  <div className="order-6 lg:col-span-full">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-[12px] ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`}>Description</p>
                      {/* Full colour even before there is text to refine: violet tint while waiting, a bright gradient once it can run. */}
                      <button
                        type="button"
                        disabled={refiningIndex !== null || !row.description.trim()}
                        onClick={() => refineRowDescription(index)}
                        title={row.description.trim() ? "Rewrite this description clearly" : "Type a description first, then refine it"}
                        className={`ml-auto inline-flex h-8 min-w-[132px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12.5px] transition active:scale-[0.98] disabled:cursor-not-allowed ${
                          row.description.trim() || refiningIndex === index
                            ? "bg-[linear-gradient(135deg,#7c5cff_0%,#a855f7_100%)] text-white shadow-[0_6px_16px_rgba(124,92,255,0.32)] hover:brightness-110"
                            : darkMode ? "bg-[#7c5cff]/25 text-[#d9ceff]" : "bg-[#e6defe] text-[#5b3fd6]"
                        }`}
                      >
                        {refiningIndex === index ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Refining...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Refine with AI
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
                      <textarea required={required && index === 0} value={row.description} onChange={(event) => updateRow(index, { description: event.target.value })} rows={2} placeholder="Describe this task..." className={`min-h-20 ${areaInputClass(darkMode)}`} />
                      <TaskDurationField row={row} onChange={(patch) => updateRow(index, patch)} darkMode={darkMode} />
                    </div>
                  </div>
                  <div className="order-5 flex flex-col lg:self-start">
                    <p className="mb-2 hidden select-none text-[12px] opacity-0 lg:block">Actions</p>
                    <div className="flex h-12 items-center justify-end gap-2">
                      {showStatus && (
                        <button
                          type="button"
                          onClick={() => updateRow(index, { recurring: !row.recurring })}
                          className={`inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[12.5px] transition-all duration-200 ${row.recurring ? darkMode ? "bg-emerald-400/[0.14] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]" : darkMode ? "bg-white/[0.06] text-white/60 hover:bg-white/10" : "bg-[#f4f4f2] text-[#5f5f5c] hover:bg-[#ebebe8]"}`}
                          title="Repeat this task tomorrow until turned off"
                        >
                          <Repeat2 className={`h-4 w-4 ${row.recurring ? "animate-pulse" : ""}`} />
                          Recurring
                        </button>
                      )}
                      <span className={`inline-flex h-10 min-w-11 items-center justify-center rounded-full px-4 text-[13px] ${taskNumberTone(index, darkMode)}`}>
                        Task {index + 1}
                      </span>
                      <button type="button" onClick={() => duplicateRow(index)} className={rowIconButton} title="Duplicate task"><Copy className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removeRow(index)} className={rowDangerButton}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center">
        <Button darkMode={darkMode} variant={darkMode ? "accent" : "primary"} icon={Plus} onClick={addRow}>Add task</Button>
      </div>
      {teamPickerIndex !== null && teamPickerRow && (
        <div className="ui-backdrop fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" onClick={() => setTeamPickerIndex(null)}>
          <div onClick={(event) => event.stopPropagation()} style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <DrawerHeader darkMode={darkMode} icon={Users} tone="lavender" title="Choose team users" subtitle="Optional" onClose={() => setTeamPickerIndex(null)} />
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {collaborationUsers.map((teamUser) => (
                  <button
                    key={teamUser.userId}
                    type="button"
                    onClick={() => toggleTeamUser(teamUser.userId)}
                    className={`flex items-center gap-3 rounded-[14px] px-3 py-3 text-left transition ${selectedTeamUsers.has(teamUser.userId) ? darkMode ? "bg-[#cff07a]/15 text-white" : "bg-[#eef8cc] text-[#141414]" : darkMode ? "bg-white/[0.035] hover:bg-white/[0.07]" : "bg-[#f7f7f5] hover:bg-[#f0f0ee]"}`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${selectedTeamUsers.has(teamUser.userId) ? darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white" : darkMode ? "border-white/20" : "border-[#cfcfcb] bg-white"}`}>
                      {selectedTeamUsers.has(teamUser.userId) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px]">{teamUser.employeeName}</span>
                      <span className={`block truncate text-xs ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{teamUser.department || "No department"}</span>
                    </span>
                  </button>
                ))}
                {!collaborationUsers.length && <p className={`col-span-full px-3 py-8 text-center text-sm ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>No users available.</p>}
              </div>
            </div>
            <div className={`flex items-center justify-between gap-3 border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
              <Button darkMode={darkMode} variant="secondary" onClick={() => setTeamPickerIndex(null)}>Skip</Button>
              <Button darkMode={darkMode} variant={darkMode ? "accent" : "primary"} onClick={() => setTeamPickerIndex(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskItemsDisplay({ title, items = [], fallback, darkMode, showStatus = false, showInvolvement = false }) {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item.category || item.description) : [];
  const label = `text-[12px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`;
  return (
    <div className={`rounded-[20px] border p-4 sm:p-5 md:col-span-2 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={showStatus ? ClipboardList : Clock3} tone={showStatus ? "mint" : "amber"} darkMode={darkMode} size="xs" />
        <p className="text-[15px] tracking-[-0.01em]">{title}</p>
        {visibleItems.length > 0 && <span className={`text-[12.5px] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>{visibleItems.length}</span>}
      </div>
      {visibleItems.length ? (
        <div className="mt-3">
          <div className="space-y-2 md:hidden">
            {visibleItems.map((item, index) => (
              <article key={`mobile-${item.category}-${index}`} className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className={label}>Site</p><p className="mt-1 break-words">{item.site || "-"}</p></div>
                  <div><p className={label}>Category</p><p className="mt-1 break-words">{item.category || "-"}</p></div>
                  {showInvolvement && <div><p className={label}>Involvement</p><p className="mt-1 break-words">{item.involvement || "-"}</p></div>}
                  {showStatus && <div className="col-span-2"><p className={label}>Status</p><p className="mt-1">{item.status ? <Chip tone={taskStatusMeta(item.status).tone} darkMode={darkMode}>{item.status}</Chip> : "-"}</p></div>}
                  {taskTimeLabel(item) && <div className="col-span-2"><p className={label}>Duration</p><p className="mt-1 tabular-nums">{taskTimeLabel(item)}</p></div>}
                  <div className={`col-span-2 border-t pt-3 ${darkMode ? "border-white/10" : "border-[#ececea]"}`}><p className={label}>Description</p><p className="mt-2 whitespace-pre-wrap break-words leading-6">{item.description || "-"}</p></div>
                </div>
              </article>
            ))}
          </div>
          <table className="hidden w-full table-fixed text-left text-sm md:table">
            <thead className={darkMode ? "text-white/45" : "text-[#8a8a8a]"}>
              <tr className={`border-b ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                <th className="w-14 px-3 py-2.5 text-[12px] font-normal">No.</th>
                <th className="w-40 px-3 py-2.5 text-[12px] font-normal">Site</th>
                <th className="w-48 px-3 py-2.5 text-[12px] font-normal">Task category</th>
                {showStatus && <th className="w-36 px-3 py-2.5 text-[12px] font-normal">Status</th>}
                {showInvolvement && <th className="w-36 px-3 py-2.5 text-[12px] font-normal">Involvement</th>}
                <th className="w-28 px-3 py-2.5 text-[12px] font-normal">Duration</th>
                <th className="px-3 py-2.5 text-[12px] font-normal">Description</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={`${item.category}-${index}`} className={`border-b align-top last:border-b-0 ${darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]"}`}>
                  <td className={`px-3 py-3 tabular-nums ${darkMode ? "text-white/45" : "text-[#9a9a98]"}`}>{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-3">{item.site || "-"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex max-w-[170px] whitespace-normal rounded-full px-3 py-1 text-[12px] leading-4 ${darkMode ? "bg-white/[0.07] text-white/80" : "bg-[#f4f4f2] text-[#3d3d3b]"}`}>
                      {item.category || "-"}
                    </span>
                  </td>
                  {showStatus && <td className="px-3 py-3">{item.status ? <Chip tone={taskStatusMeta(item.status).tone} darkMode={darkMode} className="h-6 px-2.5 text-[12px]">{item.status}</Chip> : "-"}</td>}
                  {showInvolvement && <td className="px-3 py-3">{item.involvement || "-"}</td>}
                  <td className="px-3 py-3 tabular-nums">{taskTimeLabel(item) || "-"}</td>
                  <td className={`whitespace-pre-wrap break-words px-3 py-3 leading-6 ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}>{item.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={`mt-3 whitespace-pre-wrap text-[14px] leading-7 ${darkMode ? "text-white/70" : "text-[#3d3d3b]"}`}>{fallback || "-"}</p>
      )}
    </div>
  );
}

function reportStatusSummary(report) {
  const statuses = [...new Set((Array.isArray(report?.taskItems) ? report.taskItems : [])
    .map((item) => String(item?.status || "").trim())
    .filter(Boolean))];
  if (statuses.length > 1) return "Mixed";
  return statuses[0] || report?.taskStatus || "-";
}

// Pastel chip tone for a report's overall status.
function reportStatusTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "mixed") return "sky";
  if (value.includes("complete")) return "mint";
  if (value.includes("halt") || value.includes("suspend") || value.includes("cancel")) return "rose";
  if (!status || status === "-") return "neutral";
  return "amber";
}

function EmployeeReportTable({ title, headers, rows, darkMode }) {
  return (
    <section className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h4 className="text-[15px] tracking-[-0.01em]">{title}</h4>
        <Chip darkMode={darkMode} className="h-6 px-2.5 text-[12px]">{rows.length} rows</Chip>
      </div>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={darkMode ? "text-white/45" : "text-[#8a8a8a]"}>
            <tr>{headers.map((header) => <th key={header} className="px-3 py-2.5 text-[12px] font-normal">{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={`border-t ${darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]"}`}>
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3 leading-6">{cell}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={headers.length} className={`px-3 py-8 text-center ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>No data for this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmployeeUserMultiSelect({ darkMode, users = [], selectedIds = [], onChange, emptyLabel = "All employees", clearLabel = "All" }) {
  return (
    <MultiSelect
      darkMode={darkMode}
      values={selectedIds}
      options={users.map((user) => ({ value: user.userId, label: user.employeeName, description: user.department || "No department" }))}
      onChange={onChange}
      emptyLabel={emptyLabel}
      clearLabel={clearLabel}
      searchPlaceholder="Search employees..."
      menuWidth={300}
    />
  );
}

// Applies as soon as a full range is chosen (the old picker had an Apply button).
function EmployeeDateRangePicker({ darkMode, from, to, onFromChange, onToChange, onApply }) {
  const appliedRef = useRef(`${from}|${to}`);
  useEffect(() => {
    const key = `${from}|${to}`;
    if (!onApply || !from || !to || appliedRef.current === key) return;
    appliedRef.current = key;
    onApply();
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <DateRangePicker
      darkMode={darkMode}
      from={from}
      to={to}
      className=""
      onChange={({ from: nextFrom, to: nextTo }) => {
        onFromChange(nextFrom);
        onToChange(nextTo);
      }}
    />
  );
}

function ConfettiBurst({ active, onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#16a34a", "#d8f36a", "#22c55e", "#f59e0b", "#111827"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.3,
      size: 5 + Math.random() * 8,
      speed: 2 + Math.random() * 5,
      drift: -2 + Math.random() * 4,
      rotation: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frame;
    const startedAt = Date.now();
    function draw() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const piece of pieces) {
        piece.y += piece.speed;
        piece.x += piece.drift;
        piece.rotation += 0.08;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      }
      if (Date.now() - startedAt < 2200) frame = requestAnimationFrame(draw);
      else onDone?.();
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, onDone]);
  if (!active) return null;
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[70]" />;
}

function SubmissionCelebrationModal({ darkMode, celebration, onClose, canClockOut, clockingOut, onClockOut }) {
  if (!celebration) return null;
  const saving = celebration.status === "saving";
  const firstName = String(celebration.name || "there").trim().split(/\s+/)[0];
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/35 p-4 animate-[mrn-backdrop-in_280ms_ease-out]">
      <section style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`relative w-full max-w-md overflow-hidden rounded-[24px] border p-7 text-center animate-[mrn-drawer-in_420ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
        <Sparkles className="absolute left-8 top-9 h-5 w-5 animate-bounce text-[#c99a1e] [animation-duration:2.2s]" strokeWidth={1.8} />
        <Heart className="absolute right-9 top-14 h-5 w-5 animate-bounce text-[#c0394b] [animation-delay:300ms] [animation-duration:2.5s]" strokeWidth={1.8} />
        <Star className="absolute right-16 top-7 h-4 w-4 animate-pulse text-[#2f6fc0]" strokeWidth={1.8} />
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className={`absolute inset-0 rounded-[28px] ${saving ? "animate-pulse" : ""} ${darkMode ? "bg-emerald-400/[0.12]" : "bg-[#e4f1e6]"}`} />
          {saving ? <FileText className={`relative h-9 w-9 animate-bounce [animation-duration:1.8s] ${darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]"}`} strokeWidth={1.8} /> : <Check className={`relative h-10 w-10 ${darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]"}`} strokeWidth={2} />}
        </div>

        <div className="relative mt-5">
          <Chip tone="mint" darkMode={darkMode}>{saving ? "Saving your day" : "Daily report submitted"}</Chip>
          <h3 className="mt-4 text-[26px] leading-tight tracking-[-0.02em]">{saving ? `One moment, ${firstName}` : `Beautiful work, ${firstName}.`}</h3>
          <p className={`mx-auto mt-3 max-w-sm text-sm leading-6 ${darkMode ? "text-white/55" : "text-[#7a7a78]"}`}>
            {saving ? "Your update is being placed safely into today’s report." : celebration.message}
          </p>
          {!saving && celebration.quote && (
            <blockquote className={`mt-5 rounded-[16px] px-4 py-3 text-center text-sm leading-6 ${darkMode ? "bg-white/[0.04] text-white/70" : "bg-[#f7f7f5] text-[#3d3d3b]"}`}>
              “{celebration.quote}”
            </blockquote>
          )}
          {!saving && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {canClockOut && (
                <Button darkMode={darkMode} variant="secondary" size="lg" onClick={onClockOut} disabled={clockingOut} className={darkMode ? "text-[#f7aab5]" : "text-[#c0394b]"}>
                  {clockingOut ? "Clocking out..." : "Clock out"}
                </Button>
              )}
              <Button darkMode={darkMode} variant={darkMode ? "accent" : "primary"} size="lg" onClick={onClose}>Done</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function heatmapMonthGroups(days = []) {
  return days.reduce((groups, day) => {
    const parsed = new Date(`${day.date}T00:00:00`);
    const key = day.date.slice(0, 7);
    const existing = groups.find((group) => group.key === key);
    const group = existing || {
      key,
      label: Number.isNaN(parsed.getTime()) ? key : parsed.toLocaleDateString("en-US", { month: "short" }),
      days: [],
    };
    group.days.push(day);
    if (!existing) groups.push(group);
    return groups;
  }, []);
}

function Heatmap({ darkMode, rows = [], title }) {
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const year = rows[0]?.days?.[0]?.date?.slice(0, 4) || new Date().getFullYear();
  const totalFilled = rows.reduce((sum, row) => sum + row.days.filter((day) => day.submitted).length, 0);
  const emptyCell = darkMode ? "bg-white/[0.08]" : "bg-[#efefec]";
  const filledCell = darkMode ? "bg-[#a7e8bf]" : "bg-[#2f7a4f]";
  return (
    <section className={`rounded-[20px] border p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile icon={Activity} tone="mint" darkMode={darkMode} />
          <div>
            <p className="text-[28px] leading-none tracking-[-0.03em] tabular-nums">{totalFilled.toLocaleString()}</p>
            <p className={`mt-1.5 text-[12.5px] ${muted}`}>Submissions · {title}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Chip tone="mint" darkMode={darkMode}>{year}</Chip>
          <Chip tone="lavender" darkMode={darkMode}>Current year</Chip>
        </div>
      </div>
      <div className={`overflow-x-auto rounded-[16px] p-4 ${darkMode ? "bg-white/[0.03]" : "bg-[#f7f7f5]"}`}>
        <div className="min-w-max space-y-5">
          {rows.map((row) => (
            <div key={row.userId} className="grid grid-cols-[96px_1fr] items-center gap-4">
              <p className="sticky left-0 z-10 truncate py-2 pr-3 text-[13px]">{row.employeeName}</p>
              <div className="flex min-w-max gap-5">
                {heatmapMonthGroups(row.days).map((month) => (
                  <div key={month.key} className="shrink-0">
                    <p className={`mb-3 text-center text-[11px] ${muted}`}>{month.label}</p>
                    <div className="grid grid-flow-col grid-rows-7 gap-1">
                      {month.days.map((day) => (
                        <span
                          key={day.date}
                          title={`${day.date}: ${day.submitted ? "filled" : "not filled"}`}
                          className={`h-3.5 w-3.5 rounded-[4px] transition hover:scale-110 ${day.submitted ? filledCell : emptyCell}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!rows.length && <p className={`text-sm ${muted}`}>No activity yet.</p>}
        </div>
      </div>
      <div className={`mt-5 flex items-center justify-end gap-2 text-xs ${muted}`}>
        <span>Less</span>
        <span className={`h-3.5 w-3.5 rounded-[4px] ${emptyCell}`} />
        <span className={`h-3.5 w-3.5 rounded-[4px] ${darkMode ? "bg-[#a7e8bf]/30" : "bg-[#cfe6d4]"}`} />
        <span className={`h-3.5 w-3.5 rounded-[4px] ${darkMode ? "bg-[#a7e8bf]/60" : "bg-[#7fb48f]"}`} />
        <span className={`h-3.5 w-3.5 rounded-[4px] ${filledCell}`} />
        <span>More</span>
      </div>
    </section>
  );
}

export default function EmployeeDailyReport({ darkMode }) {
  const { user } = useAuth();
  const defaultTableDate = user?.isSuperAdmin ? todayInput() : "";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => defaultTableDate);
  const [dateTo, setDateTo] = useState(() => defaultTableDate);
  const [formOpen, setFormOpen] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [todayStatusOpen, setTodayStatusOpen] = useState(false);
  const [todayStatusSearch, setTodayStatusSearch] = useState("");
  const [todayStatusFilter, setTodayStatusFilter] = useState("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({ enabled: true, time: "18:50", timezone: "Asia/Kolkata" });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDownloading, setReportDownloading] = useState("");
  const [reportData, setReportData] = useState(null);
  const [reportFrom, setReportFrom] = useState(() => addDaysInput(todayInput(), -6));
  const [reportTo, setReportTo] = useState(() => todayInput());
  const [reportUserIds, setReportUserIds] = useState([]);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [submissionCelebration, setSubmissionCelebration] = useState(null);
  const [pendingCelebration, setPendingCelebration] = useState(null);
  const [executiveOpen, setExecutiveOpen] = useState(false);
  const [executiveQuestions, setExecutiveQuestions] = useState([]);
  const [executiveAnswers, setExecutiveAnswers] = useState({});
  const [executiveSaving, setExecutiveSaving] = useState(false);
  const [questionSettingsOpen, setQuestionSettingsOpen] = useState(false);
  const [questionSettingsLoading, setQuestionSettingsLoading] = useState(false);
  const [questionSettingsSaving, setQuestionSettingsSaving] = useState(false);
  const [questionSettingsDraft, setQuestionSettingsDraft] = useState([]);
  const [questionSettingsUsers, setQuestionSettingsUsers] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingReport, setEditingReport] = useState(false);
  const [activeDraftKey, setActiveDraftKey] = useState("");
  const [draftChoiceOpen, setDraftChoiceOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState("");
  const [plannedWorkOpen, setPlannedWorkOpen] = useState(false);
  const [plannedWorkSelection, setPlannedWorkSelection] = useState({});
  const [plannedWorkImported, setPlannedWorkImported] = useState({});
  const [plannedWorkDiscarded, setPlannedWorkDiscarded] = useState(false);
  const [collaborationResponding, setCollaborationResponding] = useState("");
  const [activeCollaborationInviteIndex, setActiveCollaborationInviteIndex] = useState(0);
  const [customPrefs, setCustomPrefs] = useState({ useCustomOnly: false, sites: [], categories: [] });
  const [customOptionsOpen, setCustomOptionsOpen] = useState(false);
  const [customSiteInput, setCustomSiteInput] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceClockingIn, setAttendanceClockingIn] = useState(false);
  const [attendanceClockingOut, setAttendanceClockingOut] = useState(false);
  const [refreshingToday, setRefreshingToday] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [checkingReminder, setCheckingReminder] = useState(false);
  const [heroActionOpen, setHeroActionOpen] = useState(false);
  const heroActionRef = useRef(null);
  useClickOutside(heroActionRef, () => setHeroActionOpen(false));

  const closeFormDrawer = useCallback(() => {
    setFormClosing(true);
    window.setTimeout(() => {
      setFormOpen(false);
      setFormClosing(false);
      setFormExpanded(false);
      setDraftChoiceOpen(false);
      setPendingDraft(null);
      setActiveDraftKey("");
    }, 280);
  }, []);

  const closeDetailDrawer = useCallback(() => {
    setDetailClosing(true);
    window.setTimeout(() => {
      setDetail(null);
      setDetailClosing(false);
      setDetailExpanded(false);
    }, 280);
  }, []);

  useEffect(() => {
    if (!formOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape") closeFormDrawer(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeFormDrawer, formOpen]);

  useEffect(() => {
    if (!detail) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape") closeDetailDrawer(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDetailDrawer, detail]);
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const panel = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  // Drawer chrome shared by every panel this page opens.
  const drawerBody = darkMode ? "bg-[#121317]" : "bg-white";
  const drawerSurface = darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]";
  const drawerBorder = darkMode ? "border-white/10" : "border-[#f0f0ee]";
  const sectionCard = `rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`;
  const softTile = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
  const eyebrow = `text-[12px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`;
  const primaryVariant = darkMode ? "accent" : "primary";
  const initialLoading = loading && !data;
  const isClockedInToday = Boolean(todayAttendance?.clockInAt && !todayAttendance?.clockOutAt);
  const isClockedOutToday = Boolean(todayAttendance?.clockOutAt);
  const reportExempt = Boolean(data?.profile?.reportExempt);
  const clockButtonIsClockOut = reportExempt ? isClockedInToday : Boolean(data?.todaySubmitted);
  const clockButtonDisabled = initialLoading
    || attendanceClockingIn
    || attendanceClockingOut
    || (!reportExempt && !data?.todaySubmitted && isClockedInToday)
    || (clockButtonIsClockOut && (!isClockedInToday || isClockedOutToday));
  const userStorageId = data?.currentUserId || "me";
  // Always the server's date when we have it; the device clock is a placeholder.
  const currentReportDate = data?.today || todayInput();
  const deviceToday = todayInput();
  const clockMismatch = Boolean(data?.today) && data.today !== deviceToday;
  // A Super Admin keeps the ?employeeReportDate= override, so say so out loud -
  // an admin who taps an old reminder link should never be backdated silently.
  const dateOverride = employeeReportTestDate();
  const draftStoragePrefix = `employee-daily-report-draft:${userStorageId}:${currentReportDate}`;
  const draftStorageKey = activeDraftKey || `${draftStoragePrefix}:new`;
  const plannedWorkSourceDate = data?.plannedWorkSourceDate || addDaysInput(currentReportDate, -1);
  const plannedWorkSignature = useMemo(() => cleanTaskItems(data?.plannedWorkItems)
    .map((item) => [item.site, item.category, item.involvement, item.description].join("::"))
    .join("||"), [data?.plannedWorkItems]);
  const plannedWorkSourceSignature = [data?.plannedWorkSourceId, data?.plannedWorkSourceSubmittedAt, plannedWorkSignature].filter(Boolean).join(":");
  const plannedWorkDiscardKey = `employee-daily-report-planned-discard:${userStorageId}:${currentReportDate}:${plannedWorkSourceDate}:${plannedWorkSourceSignature || "empty"}`;
  const plannedWorkImportedKey = `employee-daily-report-planned-imported:${userStorageId}:${currentReportDate}:${plannedWorkSourceDate}:${plannedWorkSourceSignature || "empty"}`;
  const plannedWorkItems = useMemo(() => {
    if (plannedWorkDiscarded) return [];
    return cleanTaskItems(data?.plannedWorkItems)
      .map((item, index) => ({ ...item, plannedKey: plannedWorkKey(item, index, plannedWorkSourceDate) }))
      .filter((item) => item.site && item.category && item.description && !plannedWorkImported[item.plannedKey]);
  }, [data?.plannedWorkItems, plannedWorkDiscarded, plannedWorkImported, plannedWorkSourceDate]);
  const selectedPlannedWorkCount = plannedWorkItems.filter((item) => plannedWorkSelection[item.plannedKey]).length;
  const collaborationUsers = useMemo(() => (data?.collaborationUsers || []).filter((item) => String(item.userId) !== String(data?.currentUserId)), [data?.collaborationUsers, data?.currentUserId]);
  const pendingCollaborationTasks = !data?.todaySubmitted ? (data?.pendingCollaborationTasks || []) : [];
  const pendingCollaborationTask = pendingCollaborationTasks[Math.min(activeCollaborationInviteIndex, Math.max(0, pendingCollaborationTasks.length - 1))] || null;

  async function load(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const result = await api(`/employee-daily-report?${params.toString()}`);
      setData(result);
      setExecutiveQuestions(result.executiveQuestions || []);
      setExecutiveAnswers(executiveAnswerState(result.executiveQuestions || [], result.executiveAnswers));
      if (result.reminderSettings) setReminderSettings({
        enabled: result.reminderSettings.enabled !== false,
        time: result.reminderSettings.time || "18:50",
        timezone: result.reminderSettings.timezone || "Asia/Kolkata",
      });
      setSheetInput(result.profile?.sheetUrl || "");
      const storedPrefs = result.profile?.taskPreferences || {};
      const normalizedPrefs = {
        useCustomOnly: Boolean(storedPrefs?.useCustomOnly),
        sites: uniqueClean(storedPrefs?.sites || []),
        categories: uniqueClean(storedPrefs?.categories || []),
      };
      setCustomPrefs(normalizedPrefs);
      setCustomOptionsOpen(!(normalizedPrefs.sites.length || normalizedPrefs.categories.length));
      setForm((current) => ({ ...current, department: current.department || result.profile?.department || "" }));
      void loadTodayAttendance();
    } catch (error) {
      toast.error(error.message || "Could not load daily reports");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  function browserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported in this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
        () => reject(new Error("Could not read your current location. Please allow location access.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  async function loadTodayAttendance() {
    try {
      const result = await api("/hr/attendance");
      const records = result.records || [];
      const ownToday = records.find((record) => String(record.userId || "") === String(user?.id || "") && record.date === currentReportDate) || null;
      setTodayAttendance(ownToday);
    } catch {
      setTodayAttendance(null);
    }
  }

  async function clockInFromReportHero() {
    try {
      setAttendanceClockingIn(true);
      const location = await browserLocation();
      const response = await fetch(`${API_URL}/hr/attendance/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not clock in");
      setTodayAttendance(result.record || null);
      window.dispatchEvent(new Event("uipl:hr-data-changed"));
      toast.success("Clocked in");
    } catch (error) {
      toast.error(error.message || "Could not clock in");
    } finally {
      setAttendanceClockingIn(false);
    }
  }

  async function clockOutFromReportModal() {
    try {
      setAttendanceClockingOut(true);
      const location = await browserLocation();
      const response = await fetch(`${API_URL}/hr/attendance/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not clock out");
      setTodayAttendance(result.record || null);
      window.dispatchEvent(new Event("uipl:hr-data-changed"));
      toast.success("Clocked out");
      setSubmissionCelebration(null);
    } catch (error) {
      toast.error(error.message || "Could not clock out");
    } finally {
      setAttendanceClockingOut(false);
    }
  }

  async function refineDescription(text) {
    try {
      const result = await api("/employee-daily-report/refine-description", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      toast.success("Description refined");
      return result.refined || "";
    } catch (error) {
      toast.error(error.message || "Could not refine description");
      return "";
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (data?.todaySubmitted || search || dateFrom || dateTo) return undefined;
    const intervalId = window.setInterval(() => {
      if (!submitting && !draftChoiceOpen && document.visibilityState === "visible") void load(false);
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [data?.todaySubmitted, draftChoiceOpen, submitting, search, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingCollaborationTasks.length) {
      if (activeCollaborationInviteIndex !== 0) setActiveCollaborationInviteIndex(0);
      return;
    }
    if (activeCollaborationInviteIndex >= pendingCollaborationTasks.length) setActiveCollaborationInviteIndex(pendingCollaborationTasks.length - 1);
  }, [activeCollaborationInviteIndex, pendingCollaborationTasks.length]);

  useEffect(() => {
    if (!formOpen || data?.todaySubmitted) return;
    const activeAcceptedIds = new Set((data?.collaborationTasks || []).map((item) => item.inviteId).filter(Boolean));
    setForm((current) => {
      const currentItems = Array.isArray(current.taskItems) ? current.taskItems : [];
      const acceptedMap = new Map((data?.collaborationTasks || []).map((task) => [task.inviteId, task]));
      const filteredItems = currentItems
        .filter((item) => !item.collaborationTask || !item.inviteId || activeAcceptedIds.has(item.inviteId))
        .map((item) => item.collaborationTask && acceptedMap.has(item.inviteId) ? normalizeTaskRowForForm(acceptedMap.get(item.inviteId), item, true) : item);
      const missingAccepted = (data?.collaborationTasks || []).filter((task) => !filteredItems.some((item) => item.inviteId === task.inviteId));
      if (JSON.stringify(filteredItems) === JSON.stringify(currentItems) && !missingAccepted.length) return current;
      const baseItems = filteredItems.length ? filteredItems : [createEmptyTaskRow()];
      const hasEmptyOnly = baseItems.length === 1 && !hasEmployeeDraftContent({ taskItems: baseItems, waitingTaskItems: [] });
      const nextItems = missingAccepted.map((task) => normalizeTaskRowForForm(task, {}, true));
      return { ...current, taskItems: hasEmptyOnly ? nextItems : [...baseItems, ...nextItems] };
    });
  }, [data?.collaborationTasks, data?.todaySubmitted, formOpen]);



  useEffect(() => {
    if (!formOpen || draftChoiceOpen || submitting || !draftStorageKey) return undefined;
    const timeoutId = window.setTimeout(() => {
      if (!hasEmployeeDraftContent(form)) {
        window.localStorage.removeItem(draftStorageKey);
        setLastDraftSavedAt("");
        return;
      }
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(draftStorageKey, JSON.stringify({ form, savedAt }));
      setLastDraftSavedAt(savedAt);
    }, 450);
    return () => window.clearTimeout(timeoutId);
  }, [draftChoiceOpen, draftStorageKey, form, formOpen, submitting]);

  useEffect(() => {
    if (!formOpen || draftChoiceOpen || submitting || data?.todaySubmitted) return undefined;
    const timeoutId = window.setTimeout(() => {
      const taskItems = collaborationDraftRows(form.taskItems, true);
      const waitingTaskItems = collaborationDraftRows(form.waitingTaskItems, false);
      void api("/employee-daily-report/collaboration-draft", {
        method: "POST",
        body: JSON.stringify({ taskItems, waitingTaskItems }),
      }).catch(() => {});
    }, 650);
    return () => window.clearTimeout(timeoutId);
  }, [data?.todaySubmitted, draftChoiceOpen, form.taskItems, form.waitingTaskItems, formOpen, submitting]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPlannedWorkDiscarded(typeof window !== "undefined" && window.localStorage.getItem(plannedWorkDiscardKey) === "true");
      setPlannedWorkImported(safeJsonParse(window.localStorage.getItem(plannedWorkImportedKey), {}) || {});
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [plannedWorkDiscardKey, plannedWorkImportedKey]);

  function openForm() {
    if (!data?.profile?.sheetLinked) {
      toast.error("Link your Google Sheet before filling today's report");
      return;
    }
    setFormClosing(false);
    setFormExpanded(false);
    const todayReport = data?.todayReport;
    const recurringTasks = Array.isArray(data?.carriedForwardTasks) ? data.carriedForwardTasks : [];
    const collaborationTasks = Array.isArray(data?.collaborationTasks) ? data.collaborationTasks : [];
    const discardedForToday = window.localStorage.getItem(plannedWorkDiscardKey) === "true";
    setPlannedWorkDiscarded(discardedForToday);
    setPlannedWorkImported(safeJsonParse(window.localStorage.getItem(plannedWorkImportedKey), {}) || {});
    setPlannedWorkSelection({});
    setPlannedWorkOpen(false);
    setEditingReport(Boolean(todayReport));
    const nextDraftKey = `${draftStoragePrefix}:${todayReport?.id ? `edit:${todayReport.id}` : "new"}`;
    setActiveDraftKey(nextDraftKey);
    const todoImportKey = `employee-daily-report-todo-import:${userStorageId}:${currentReportDate}`;
    const todoImportRows = cleanTaskItems(safeJsonParse(window.localStorage.getItem(todoImportKey), []) || [])
      .map((item) => normalizeTaskRowForForm(item, {}, true));
    const baseForm = {
      ...emptyForm,
      ...(todayReport || {}),
      tomorrowPlanTick: true,
      taskItems: todayReport?.taskItems?.length
        ? todayReport.taskItems.map((item) => normalizeTaskRowForForm(item, todayReport, true))
        : todoImportRows.length
          ? todoImportRows
          : collaborationTasks.length || recurringTasks.length
          ? [
            ...collaborationTasks.map((item) => normalizeTaskRowForForm(item, {}, true)),
            ...recurringTasks.map((item) => normalizeTaskRowForForm(item, {}, true)),
          ]
          : [createEmptyTaskRow()],
      waitingTaskItems: todayReport?.waitingTaskItems?.length
        ? todayReport.waitingTaskItems.map((item) => normalizeTaskRowForForm(item, todayReport, false))
        : [createEmptyWaitingRow()],
      dismissedRecurringIds: Array.isArray(todayReport?.dismissedRecurringIds) ? todayReport.dismissedRecurringIds : [],
      department: todayReport?.department || data?.profile?.department || "",
      carriedForwardFrom: data?.carriedForwardFrom || "",
    };
    const storedDraft = safeJsonParse(window.localStorage.getItem(nextDraftKey), null);
    const usableDraft = storedDraft?.form && hasEmployeeDraftContent(storedDraft.form) ? storedDraft : null;
    if (storedDraft && !usableDraft) window.localStorage.removeItem(nextDraftKey);
    const nextBaseForm = todoImportRows.length && (todayReport?.taskItems?.length || usableDraft?.form?.taskItems?.length)
      ? {
        ...baseForm,
        taskItems: [
          ...(usableDraft?.form?.taskItems?.length ? usableDraft.form.taskItems : baseForm.taskItems || []),
          ...todoImportRows,
        ],
      }
      : baseForm;
    if (todoImportRows.length) {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(nextDraftKey, JSON.stringify({ form: nextBaseForm, savedAt }));
      window.localStorage.removeItem(todoImportKey);
      setLastDraftSavedAt(savedAt);
      toast.success(`${todoImportRows.length} todo task${todoImportRows.length === 1 ? "" : "s"} added to draft`);
    }
    setForm(nextBaseForm);
    if (!todoImportRows.length) setLastDraftSavedAt(usableDraft?.savedAt || "");
    if (usableDraft?.form && !todoImportRows.length) {
      setPendingDraft({ ...usableDraft, baseForm });
      setDraftChoiceOpen(true);
    } else {
      setPendingDraft(null);
      setDraftChoiceOpen(false);
    }
    setFormOpen(true);
  }

  useEffect(() => {
    if (!data || formOpen) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openTodos") === "1") openForm();
  }, [data, formOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function continueDraft() {
    if (pendingDraft?.form) {
      setForm({ ...emptyForm, ...pendingDraft.form, tomorrowPlanTick: true });
      setLastDraftSavedAt(pendingDraft.savedAt || "");
    }
    setDraftChoiceOpen(false);
    setPendingDraft(null);
  }

  function startFreshDraft() {
    window.localStorage.removeItem(draftStorageKey);
    setForm(pendingDraft?.baseForm || { ...emptyForm, department: data?.profile?.department || "", tomorrowPlanTick: true });
    setLastDraftSavedAt("");
    setDraftChoiceOpen(false);
    setPendingDraft(null);
  }

  async function respondToCollaborationTask(task, status) {
    if (!task?.inviteId || collaborationResponding) return;
    try {
      setCollaborationResponding(`${task.inviteId}:${status}`);
      await api("/employee-daily-report/collaboration-response", {
        method: "POST",
        body: JSON.stringify({ inviteId: task.inviteId, status }),
      });
      if (status === "accepted") {
        const nextTask = normalizeTaskRowForForm({ ...task, collaborationStatus: "accepted" }, {}, true);
        if (!formOpen) openForm();
        setForm((current) => {
          const currentItems = Array.isArray(current.taskItems) ? current.taskItems : [];
          const alreadyAdded = currentItems.some((item) => item.inviteId === task.inviteId || (
            item.collaborationSourceReportId === task.collaborationSourceReportId &&
            item.description === task.description &&
            item.category === task.category
          ));
          const hasEmptyOnly = currentItems.length === 1 && !hasEmployeeDraftContent({ taskItems: currentItems, waitingTaskItems: [] });
          return alreadyAdded ? current : { ...current, taskItems: hasEmptyOnly ? [nextTask] : [...currentItems, nextTask] };
        });
        toast.success("Collaboration task accepted");
      } else {
        toast.success("Collaboration task rejected");
      }
      await load();
    } catch (error) {
      if (/no longer exists/i.test(error.message || "")) {
        toast.error("This collaboration task no longer exists");
        await load();
      } else {
        toast.error(error.message || "Could not save collaboration response");
      }
    } finally {
      setCollaborationResponding("");
    }
  }

  function togglePlannedWorkItem(key) {
    setPlannedWorkSelection((current) => ({ ...current, [key]: !current[key] }));
  }

  function importSelectedPlannedWork() {
    const selectedItems = plannedWorkItems.filter((item) => plannedWorkSelection[item.plannedKey]);
    if (!selectedItems.length) {
      toast.error("Select planned work to import");
      return;
    }
    const importedRows = selectedItems.map(plannedWorkToTaskRow);
    setForm((current) => {
      const existingRows = Array.isArray(current.taskItems) ? current.taskItems : [];
      const hasEmptyOnly = existingRows.length === 1 && !hasEmployeeDraftContent({ taskItems: existingRows, waitingTaskItems: [] });
      const nextForm = {
        ...current,
        taskItems: hasEmptyOnly ? importedRows : [...existingRows, ...importedRows],
      };
      if (draftStorageKey) {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(draftStorageKey, JSON.stringify({ form: nextForm, savedAt }));
        setLastDraftSavedAt(savedAt);
      }
      return nextForm;
    });
    setPlannedWorkImported((current) => {
      const next = { ...current };
      selectedItems.forEach((item) => { next[item.plannedKey] = true; });
      window.localStorage.setItem(plannedWorkImportedKey, JSON.stringify(next));
      return next;
    });
    const importedAllPlannedWork = selectedItems.length >= plannedWorkItems.length;
    if (importedAllPlannedWork) {
      window.localStorage.setItem(plannedWorkDiscardKey, "true");
      setPlannedWorkDiscarded(true);
      setPlannedWorkOpen(false);
    } else {
      setPlannedWorkOpen(true);
    }
    setPlannedWorkSelection({});
    toast.success(`${selectedItems.length} planned task${selectedItems.length === 1 ? "" : "s"} imported`);
  }

  function discardPlannedWorkForToday() {
    window.localStorage.setItem(plannedWorkDiscardKey, "true");
    setPlannedWorkDiscarded(true);
    setPlannedWorkSelection({});
    setPlannedWorkOpen(false);
    toast.success("Today's planned work hidden");
  }

  function saveCustomPreferences(nextPrefs, options = {}) {
    const normalized = {
      useCustomOnly: Boolean(nextPrefs.useCustomOnly),
      sites: uniqueClean(nextPrefs.sites || []),
      categories: uniqueClean(nextPrefs.categories || []),
    };
    setCustomPrefs(normalized);
    void api("/employee-daily-report/preferences", { method: "PUT", body: JSON.stringify(normalized) })
      .then((result) => {
        if (result.preferences) setCustomPrefs({
          useCustomOnly: Boolean(result.preferences.useCustomOnly),
          sites: uniqueClean(result.preferences.sites || []),
          categories: uniqueClean(result.preferences.categories || []),
        });
        if (options.toast) toast.success("Task options saved");
      })
      .catch((error) => toast.error(error.message || "Could not save task options"));
  }

  function addCustomOption(type) {
    const rawValue = type === "site" ? customSiteInput : customCategoryInput;
    const value = rawValue.trim();
    if (!value) return;
    const key = type === "site" ? "sites" : "categories";
    saveCustomPreferences({ ...customPrefs, [key]: uniqueClean([...(customPrefs[key] || []), value]) }, { toast: true });
    setCustomOptionsOpen(true);
    if (type === "site") setCustomSiteInput("");
    else setCustomCategoryInput("");
  }

  function removeCustomOption(type, value) {
    const key = type === "site" ? "sites" : "categories";
    saveCustomPreferences({ ...customPrefs, [key]: (customPrefs[key] || []).filter((item) => item !== value) });
    setCustomOptionsOpen(true);
  }

  function clearCustomOptions() {
    saveCustomPreferences({ ...customPrefs, sites: [], categories: [], useCustomOnly: false }, { toast: true });
    setCustomOptionsOpen(true);
  }

  async function saveSheetLink() {
    try {
      setSheetSaving(true);
      const result = await api("/employee-daily-report/sheet", { method: "PUT", body: JSON.stringify({ spreadsheet: sheetInput }) });
      setSheetInput(result.sheetUrl || sheetInput);
      setData((current) => current ? {
        ...current,
        profile: {
          ...current.profile,
          sheetLinked: true,
          sheetId: result.sheetId || current.profile?.sheetId || "",
          sheetUrl: result.sheetUrl || sheetInput,
        },
      } : current);
      toast.success("Daily report sheet linked");
      setSheetSaving(false);
      void load();
    } catch (error) {
      toast.error(error.message || "Could not link sheet");
    } finally {
      setSheetSaving(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (submitting) return;
    const firstSubmission = !editingReport && !data?.todaySubmitted;
    let celebrationStartedAt = 0;
    try {
      setSubmitting(true);
      const missingTaskSite = [...(form.taskItems || []), ...(form.waitingTaskItems || [])].some((item) => (item.category || item.categoryOther || item.description) && !fieldValue(item.site, item.siteOther).trim());
      if (missingTaskSite) throw new Error("Choose a site for every task");
      const missingTaskStatus = (form.taskItems || []).some((item) => (item.category || item.categoryOther || item.description) && !fieldValue(item.status, item.statusOther).trim());
      if (missingTaskStatus) throw new Error("Choose a status for every today task");
      const missingTaskInvolvement = [...(form.taskItems || []), ...(form.waitingTaskItems || [])].some((item) => (item.category || item.categoryOther || item.description) && !involvementText(item));
      if (missingTaskInvolvement) throw new Error("Choose involvement for every task");
      const taskItems = (form.taskItems || []).map((item) => {
        const involvementValues = hasTeamInvolvement(item) ? ["Team"] : uniqueClean([...involvementValuesFromRow(item), item.involvementOther]);
        const site = fieldValue(item.site, item.siteOther).trim();
        const category = fieldValue(item.category, item.categoryOther).trim();
        const description = item.description.trim();
        const durationHours = cleanDurationPart(item.durationHours ?? item.duration?.hours ?? "");
        const durationMinutes = cleanDurationPart(item.durationMinutes ?? item.duration?.minutes ?? "", 59);
        const durationTotalMinutes = (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
        return {
          site,
          category,
          status: fieldValue(item.status, item.statusOther).trim(),
          involvement: involvementValues.join(", "),
          involvementValues,
          description,
          durationHours,
          durationMinutes,
          durationTotalMinutes,
          startTime: "",
          endTime: "",
          timeFormat: "24",
          recurring: Boolean(item.recurring),
          recurringId: item.recurringId || recurringIdForTask({ site, category, description }),
          collaboratorUserIds: hasTeamInvolvement(item) ? uniqueClean(item.collaboratorUserIds || []) : [],
          collaborationDraftId: item.draftTaskId || item.collaborationDraftId || "",
          inviteId: item.inviteId || "",
          collaborationTask: Boolean(item.collaborationTask),
          collaborationStatus: item.collaborationStatus || "",
          collaborationSourceUserId: item.collaborationSourceUserId || "",
          collaborationSourceName: item.collaborationSourceName || "",
          collaborationSourceReportId: item.collaborationSourceReportId || "",
        };
      }).filter((item) => item.site && item.category && item.status && item.involvement && item.description);
      const waitingTaskItems = (form.waitingTaskItems || []).map((item) => {
        const involvementValues = hasTeamInvolvement(item) ? ["Team"] : uniqueClean([...involvementValuesFromRow(item), item.involvementOther]);
        const durationHours = cleanDurationPart(item.durationHours ?? item.duration?.hours ?? "");
        const durationMinutes = cleanDurationPart(item.durationMinutes ?? item.duration?.minutes ?? "", 59);
        const durationTotalMinutes = (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
        return {
          site: fieldValue(item.site, item.siteOther).trim(),
          category: fieldValue(item.category, item.categoryOther).trim(),
          involvement: involvementValues.join(", "),
          involvementValues,
          description: item.description.trim(),
          durationHours,
          durationMinutes,
          durationTotalMinutes,
          startTime: "",
          endTime: "",
          timeFormat: "24",
          collaboratorUserIds: hasTeamInvolvement(item) ? uniqueClean(item.collaboratorUserIds || []) : [],
          collaborationDraftId: item.draftTaskId || item.collaborationDraftId || "",
          inviteId: item.inviteId || "",
          collaborationTask: Boolean(item.collaborationTask),
          collaborationStatus: item.collaborationStatus || "",
          collaborationSourceUserId: item.collaborationSourceUserId || "",
          collaborationSourceName: item.collaborationSourceName || "",
          collaborationSourceReportId: item.collaborationSourceReportId || "",
        };
      }).filter((item) => item.site && item.category && item.involvement && item.description);
      const payload = {
        ...form,
        tomorrowPlanTick: true,
        department: fieldValue(form.department, form.departmentOther),
        involvement: taskItems[0]?.involvement || waitingTaskItems[0]?.involvement || "",
        taskItems,
        waitingTaskItems,
        dismissedRecurringIds: uniqueClean(form.dismissedRecurringIds || []),
      };
      if (firstSubmission) {
        celebrationStartedAt = Date.now();
        setSubmissionCelebration({ status: "saving", name: user?.displayName || user?.username || "there", message: "", quote: "" });
      }
      const result = await api("/employee-daily-report", { method: editingReport ? "PUT" : "POST", body: JSON.stringify(payload) });
      if (firstSubmission) {
        const remainingAnimationTime = Math.max(0, 900 - (Date.now() - celebrationStartedAt));
        if (remainingAnimationTime) await new Promise((resolve) => window.setTimeout(resolve, remainingAnimationTime));
      }
      if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
      setLastDraftSavedAt("");
      const nextCelebration = {
        status: "success",
        name: result.report?.employeeName || user?.displayName || user?.username || "there",
        message: result.celebration?.message || "Your clear update helps the whole team move forward with confidence.",
        quote: result.celebration?.quote || "Consistent progress, thoughtfully shared, turns everyday effort into meaningful momentum.",
      };
      const assignedQuestions = result.executiveQuestions || [];
      const savedExecutiveAnswers = result.executiveAnswers || null;
      const needsExecutiveAnswers = assignedQuestions.length && (savedExecutiveAnswers?.answers || []).length < assignedQuestions.length;
      if (needsExecutiveAnswers) {
        setSubmissionCelebration(null);
        setPendingCelebration(firstSubmission ? nextCelebration : null);
        setExecutiveQuestions(assignedQuestions);
        setExecutiveAnswers(executiveAnswerState(assignedQuestions, savedExecutiveAnswers));
        setExecutiveOpen(true);
        toast.success("Daily report saved. Please complete the required management questions.");
      } else if (firstSubmission) {
        setSubmissionCelebration(nextCelebration);
        setConfettiActive(true);
      } else {
        toast.success("Today’s report updated");
      }
      if (result.sheetWarning) toast(result.sheetWarning, { duration: 8000 });
      window.dispatchEvent(new Event("uipl:employee-daily-report-submitted"));
      void loadTodayAttendance();
      closeFormDrawer();
      await load();
    } catch (error) {
      if (firstSubmission) setSubmissionCelebration(null);
      toast.error(error.message || "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveExecutiveAnswers(event) {
    event.preventDefault();
    if (executiveSaving) return;
    try {
      const missing = executiveQuestions.find((question) => !String(executiveAnswers[question.id] || "").trim());
      if (missing) throw new Error(`Please answer: ${missing.label}`);
      setExecutiveSaving(true);
      await api("/employee-daily-report/executive-answers", {
        method: "PUT",
        body: JSON.stringify({
          reportDate: currentReportDate,
          answers: executiveQuestions.map((question) => ({ id: question.id, answer: executiveAnswers[question.id] || "" })),
        }),
      });
      setExecutiveOpen(false);
      if (pendingCelebration) {
        setSubmissionCelebration(pendingCelebration);
        setPendingCelebration(null);
        setConfettiActive(true);
      } else {
        toast.success("Management questions saved");
      }
      await load();
    } catch (error) {
      toast.error(error.message || "Could not save management questions");
    } finally {
      setExecutiveSaving(false);
    }
  }

  async function refreshTodayReport() {
    if (refreshingToday) return;
    try {
      setRefreshingToday(true);
      const result = await api("/employee-daily-report/refresh-today", { method: "POST" });
      toast.success(result.reportFound ? "Today’s report cache refreshed" : "Today’s deleted report was removed from the dashboard");
      await load();
    } catch (error) {
      toast.error(error.message || "Could not refresh today’s report");
    } finally {
      setRefreshingToday(false);
    }
  }

  async function checkReminderStatus() {
    if (checkingReminder) return;
    try {
      setCheckingReminder(true);
      const date = currentReportDate;
      const result = await api("/employee-daily-report/reminder/send-now", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      const reminder = result.reminder || {};
      if (reminder.status === "completed") {
        toast.success(`Reminder sent now for ${date}: ${reminder.sent || 0} sent, ${reminder.failed || 0} failed, ${reminder.skipped || 0} skipped`);
      } else if (reminder.status === "skipped") {
        toast(`Reminder skipped for ${date}${reminder.reason ? `: ${reminder.reason}` : ""}`);
      } else if (reminder.status === "running") {
        toast(`Reminder is currently sending for ${date}`);
      } else {
        toast(`Reminder has not been sent yet for ${date}`);
      }
    } catch (error) {
      toast.error(error.message || "Could not send reminders now");
    } finally {
      setCheckingReminder(false);
    }
  }

  async function openReminderSchedule() {
    setReminderOpen(true);
    try {
      const result = await api("/employee-daily-report/reminder/settings");
      if (result.settings) setReminderSettings({
        enabled: result.settings.enabled !== false,
        time: result.settings.time || "18:50",
        timezone: result.settings.timezone || "Asia/Kolkata",
      });
    } catch (error) {
      toast.error(error.message || "Could not load reminder schedule");
    }
  }

  async function saveReminderSchedule(event) {
    event.preventDefault();
    if (reminderSaving) return;
    try {
      setReminderSaving(true);
      const result = await api("/employee-daily-report/reminder/settings", {
        method: "PATCH",
        body: JSON.stringify(reminderSettings),
      });
      if (result.settings) setReminderSettings({
        enabled: result.settings.enabled !== false,
        time: result.settings.time || reminderSettings.time,
        timezone: result.settings.timezone || "Asia/Kolkata",
      });
      toast.success(`Daily reminder scheduled at ${result.settings?.time || reminderSettings.time} IST`);
      setReminderOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not save reminder schedule");
    } finally {
      setReminderSaving(false);
    }
  }

  async function openQuestionSettings() {
    setQuestionSettingsOpen(true);
    try {
      setQuestionSettingsLoading(true);
      const result = await api("/employee-daily-report/executive-questions/settings");
      setQuestionSettingsDraft((result.questions || []).map((question) => ({
        id: question.id,
        label: question.label || "",
        assignedUserIds: question.assignedUserIds || [],
        enabled: question.enabled !== false,
      })));
      setQuestionSettingsUsers(result.users || []);
    } catch (error) {
      toast.error(error.message || "Could not load management questions");
    } finally {
      setQuestionSettingsLoading(false);
    }
  }

  function updateQuestionDraft(id, patch) {
    setQuestionSettingsDraft((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  function addQuestionDraft() {
    setQuestionSettingsDraft((current) => [
      ...current,
      { id: `new-${Date.now()}`, label: "", assignedUserIds: [], enabled: true },
    ]);
  }

  function removeQuestionDraft(id) {
    setQuestionSettingsDraft((current) => current.filter((question) => question.id !== id));
  }

  async function saveQuestionSettings(event) {
    event.preventDefault();
    if (questionSettingsSaving) return;
    try {
      const questions = questionSettingsDraft.map((question) => ({
        id: question.id?.startsWith("new-") ? "" : question.id,
        label: question.label.trim(),
        assignedUserIds: question.assignedUserIds || [],
        enabled: question.enabled !== false,
      })).filter((question) => question.label);
      if (!questions.length) throw new Error("Add at least one management question");
      setQuestionSettingsSaving(true);
      const result = await api("/employee-daily-report/executive-questions/settings", {
        method: "PUT",
        body: JSON.stringify({ questions }),
      });
      setQuestionSettingsDraft((result.questions || []).map((question) => ({
        id: question.id,
        label: question.label || "",
        assignedUserIds: question.assignedUserIds || [],
        enabled: question.enabled !== false,
      })));
      setQuestionSettingsUsers(result.users || questionSettingsUsers);
      toast.success("Management questions saved");
      await load();
    } catch (error) {
      toast.error(error.message || "Could not save management questions");
    } finally {
      setQuestionSettingsSaving(false);
    }
  }

  async function performDeleteEmployeeReport(report) {
    if (!report?.reportDate || deletingReportId) return;
    try {
      setDeletingReportId(report.id);
      const params = new URLSearchParams();
      if (report.userId) params.set("userId", report.userId);
      await api(`/employee-daily-report/${encodeURIComponent(report.reportDate)}${params.toString() ? `?${params.toString()}` : ""}`, { method: "DELETE" });
      if (detail?.id === report.id) setDetail(null);
      toast.success("Employee report deleted");
      setDeleteConfirm(null);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not delete employee report");
    } finally {
      setDeletingReportId("");
    }
  }

  function deleteEmployeeReport(report) {
    if (!report?.reportDate || deletingReportId) return;
    setDeleteConfirm(report);
  }

  async function generateEmployeeReport() {
    try {
      setReportLoading(true);
      const params = new URLSearchParams({ dateFrom: reportFrom || todayInput(), dateTo: reportTo || reportFrom || todayInput() });
      if (reportUserIds.length) params.set("userIds", reportUserIds.join(","));
      const result = await api(`/employee-daily-report/report?${params.toString()}`);
      setReportData(result);
    } catch (error) {
      toast.error(error.message || "Could not generate report");
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadEmployeeReportPdf({ from = reportFrom, to = reportTo, mode = "range" } = {}) {
    try {
      setReportDownloading(mode);
      const resolvedFrom = from || todayInput();
      const resolvedTo = to || resolvedFrom;
      const params = new URLSearchParams({ dateFrom: resolvedFrom, dateTo: resolvedTo });
      if (reportUserIds.length) params.set("userIds", reportUserIds.join(","));
      const testDate = employeeReportTestDate();
      const response = await fetch(`${API_URL}/employee-daily-report/report/pdf?${params.toString()}`, {
        headers: testDate ? { "X-Employee-Report-Date": testDate } : {},
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not download employee report PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const rangeName = resolvedFrom === resolvedTo ? resolvedFrom : `${resolvedFrom}_to_${resolvedTo}`;
      link.href = url;
      link.download = `employee-daily-report-${rangeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success("Employee report PDF downloaded");
    } catch (error) {
      toast.error(error.message || "Could not download employee report PDF");
    } finally {
      setReportDownloading("");
    }
  }

  const reports = data?.reports || [];
  const options = data?.options || { departments: [], taskTypes: [], taskStatuses: [], involvements: [] };
  const optionUsage = data?.optionUsage || { sites: [], categories: [], involvements: [] };
  const formSites = customPrefs.useCustomOnly ? customPrefs.sites : uniqueClean([...(options.sites || []), ...customPrefs.sites]);
  const formCategories = customPrefs.useCustomOnly ? customPrefs.categories : uniqueClean([...(options.taskTypes || []), ...customPrefs.categories]);
  const profileUsername = String(data?.profile?.username || user?.username || "").trim().toLowerCase();
  const formInvolvements = uniqueClean([
    ...(options.involvements || []),
    ...(profileUsername === "nishimehta" ? ["Nishi & Iqbal", "Iqbal"] : []),
    "Other",
  ]);
  const hasCustomPreferences = Boolean(customPrefs.sites.length || customPrefs.categories.length);
  const customOptionsVisible = customOptionsOpen || !hasCustomPreferences;
  const sidebarSitesPreview = customPrefs.sites.slice(0, 3);
  const sidebarCategoriesPreview = customPrefs.categories.slice(0, 3);
  const reportUsers = data?.reportUsers || [];
  const reportUserMap = new Map(reportUsers.map((item) => [String(item.userId || ""), item]));
  const currentReportUser = {
    ...user,
    ...(data?.profile || {}),
    userId: user?.id || data?.profile?.userId || data?.profile?.id,
    displayName: data?.profile?.displayName || user?.displayName || user?.username,
    employeeName: data?.profile?.displayName || user?.displayName || user?.username,
  };
  const reportAvatarUser = (report) => {
    const reportUserId = String(report?.userId || "");
    const mappedUser = reportUserMap.get(reportUserId);
    if (mappedUser) return mappedUser;
    if (reportUserId && reportUserId === String(user?.id || "")) return currentReportUser;
    if (!data?.isAdmin) return currentReportUser;
    return null;
  };
  const todaySubmissionStatus = data?.todaySubmissionStatus || [];
  const filteredTodayStatus = todaySubmissionStatus.filter((item) => {
    const query = todayStatusSearch.trim().toLowerCase();
    const matchesSearch = !query || [item.employeeName, item.department].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesFilter = todayStatusFilter === "all" || (todayStatusFilter === "submitted" ? item.submitted : !item.submitted);
    return matchesSearch && matchesFilter;
  });
  const todayStatusCounts = todaySubmissionStatus.reduce((result, item) => {
    result.total += 1;
    if (item.submitted) result.submitted += 1;
    else result.pending += 1;
    return result;
  }, { total: 0, submitted: 0, pending: 0 });
  return (
    <main className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="relative z-20">
        <PageHeader
          darkMode={darkMode}
          badge="Daily report"
          badgeIcon={CalendarCheck}
          badgeTone="mint"
          title="Daily work reports"
          subtitle="filed in a minute, every day"
          description="Submit today's work progress, review previous entries and track reporting consistency in one place."
          actions={(
            <>
              <button
                type="button"
                onClick={clockButtonIsClockOut ? clockOutFromReportModal : clockInFromReportHero}
                disabled={clockButtonDisabled}
                className={"inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-full px-6 text-sm transition-[background-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 " + (
                  clockButtonIsClockOut
                    ? darkMode ? "bg-rose-400/[0.14] text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"
                    : isClockedInToday
                      ? darkMode ? "bg-emerald-400/[0.12] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"
                      : "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]"
                )}
              >
                {(attendanceClockingIn || attendanceClockingOut) ? <Loader2 className="h-4 w-4 animate-spin" /> : isClockedInToday && !clockButtonIsClockOut ? <CheckCircle2 className="h-4 w-4" /> : <LogIn className={`h-4 w-4 ${clockButtonIsClockOut ? "rotate-180" : ""}`} />}
                {initialLoading
                  ? <ThreeDotLoader />
                  : clockButtonIsClockOut
                    ? isClockedOutToday ? "Clocked out" : "Clock out"
                    : isClockedInToday ? "Clocked in" : "Clock in"}
              </button>
              {!reportExempt && (
                <Button
                  darkMode={darkMode}
                  variant="primary"
                  size="lg"
                  disabled={initialLoading || !data?.profile?.sheetLinked}
                  onClick={openForm}
                >
                  {data?.todaySubmitted ? <CheckCircle2 className="h-4 w-4" /> : initialLoading ? null : <Plus className="h-4 w-4" />}
                  {initialLoading ? <ThreeDotLoader /> : data?.todaySubmitted ? "Edit today's report" : data?.profile?.sheetLinked ? "Fill today's report" : "Link sheet first"}
                </Button>
              )}
              <div ref={heroActionRef} className="relative">
                <Button
                  darkMode={darkMode}
                  variant="secondary"
                  size="lg"
                  onClick={() => setHeroActionOpen((value) => !value)}
                  disabled={initialLoading}
                  icon={Settings2}
                >
                  Actions
                  <ChevronDown className={`h-4 w-4 transition-transform ${heroActionOpen ? "rotate-180" : ""}`} />
                </Button>
                {heroActionOpen && (
                  <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop absolute right-0 top-[calc(100%+8px)] z-[80] w-[290px] overflow-hidden rounded-[18px] border p-1.5 ${darkMode ? "border-white/10 bg-[#17181c]" : "border-[#ececec] bg-white"}`}>
                    {[
                      {
                        label: data?.profile?.sheetLinked ? "Sheet settings" : "Link sheet",
                        icon: FileText,
                        disabled: initialLoading,
                        onClick: () => setSheetOpen(true),
                      },
                      ...(data?.isAdmin ? [{
                        label: "Today status",
                        icon: CalendarCheck,
                        onClick: () => setTodayStatusOpen(true),
                      }] : [{
                        label: "My activity",
                        icon: CalendarCheck,
                        onClick: () => setHeatmapOpen(true),
                      }]),
                      {
                        label: refreshingToday ? "Refreshing today..." : "Refresh today",
                        icon: RefreshCw,
                        disabled: refreshingToday || !data?.profile?.sheetLinked,
                        onClick: refreshTodayReport,
                        spin: refreshingToday,
                      },
                      ...(data?.isAdmin ? [
                        {
                          label: "Generate report",
                          icon: FileText,
                          onClick: () => setReportOpen(true),
                        },
                        {
                          label: "Reminder schedule",
                          icon: BellRing,
                          onClick: openReminderSchedule,
                          danger: true,
                        },
                        {
                          label: "Management questions",
                          icon: Sparkles,
                          onClick: openQuestionSettings,
                        },
                      ] : []),
                    ].map((item) => {
                      const Icon = item.icon;
                      const tone = item.danger ? "rose"
                        : item.label.includes("Sheet") || item.label.includes("Link") ? "mint"
                          : item.label.includes("status") || item.label.includes("activity") ? "sky"
                            : item.label.includes("Refresh") ? "neutral"
                              : item.label.includes("Generate") ? "peach"
                                : "lavender";
                      return (
                        <button
                          key={item.label}
                          type="button"
                          disabled={item.disabled}
                          onClick={() => {
                            if (item.disabled) return;
                            setHeroActionOpen(false);
                            item.onClick?.();
                          }}
                          className={`flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "text-white hover:bg-white/[0.06]" : "text-[#141414] hover:bg-[#f6f6f4]"}`}
                        >
                          <IconTile icon={<Icon className={`h-4 w-4 ${item.spin ? "animate-spin" : ""}`} strokeWidth={1.8} />} tone={tone} darkMode={darkMode} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block">{item.label}</span>
                            <span className={`mt-0.5 block text-[12px] ${muted}`}>
                              {item.label.includes("Sheet") || item.label.includes("Link") ? "Workbook connection"
                                : item.label.includes("status") || item.label.includes("activity") ? "Submission tracking"
                                  : item.label.includes("Refresh") || item.label.includes("Refreshing") ? "Sync latest sheet data"
                                    : item.label.includes("Generate") ? "Download and preview PDF"
                                      : item.label.includes("Reminder") ? "WhatsApp reminder timing"
                                        : "Assigned management prompts"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        />
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          darkMode={darkMode}
          icon={CalendarCheck}
          tone={reportExempt ? "neutral" : data?.todaySubmitted ? "mint" : "peach"}
          value={initialLoading ? <ThreeDotLoader /> : reportExempt ? "Exempt" : data?.todaySubmitted ? "Filled" : "Pending"}
          label="Today's report"
          hint={currentReportDate}
        />
        {data?.isAdmin ? (
          <StatTile
            darkMode={darkMode}
            icon={Users}
            tone="sky"
            value={initialLoading ? <ThreeDotLoader /> : `${todayStatusCounts.submitted}/${todayStatusCounts.total}`}
            label="Submitted today"
            hint={`${todayStatusCounts.pending} not submitted`}
          />
        ) : (
          <StatTile
            darkMode={darkMode}
            icon={LogIn}
            tone="sky"
            value={initialLoading ? <ThreeDotLoader /> : isClockedOutToday ? "Out" : isClockedInToday ? "In" : "Not yet"}
            label="Attendance today"
          />
        )}
        <StatTile
          darkMode={darkMode}
          icon={ClipboardList}
          tone="lavender"
          value={loading ? <ThreeDotLoader /> : reports.length}
          label={data?.isAdmin ? "Reports in this view" : "My reports in view"}
          hint={rangeLabel(dateFrom, dateTo)}
        />
        <StatTile
          darkMode={darkMode}
          icon={Building2}
          tone="amber"
          value={initialLoading ? <ThreeDotLoader /> : <span className="block truncate text-[22px]">{data?.profile?.department || "Not set"}</span>}
          label="Department"
        />
      </div>

      <section className={`mt-6 rounded-[20px] border ${panel}`}>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={ClipboardList} tone="mint" darkMode={darkMode} />
            <div>
              <h2 className="text-[17px] tracking-[-0.01em]">{data?.isAdmin ? "Submitted employee reports" : "My filled reports"}</h2>
              <p className={`mt-0.5 text-[13px] ${muted}`}>Today can be updated; previous dates are read-only.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {data?.isAdmin && (
              <div className="relative">
                <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder="Search employee, site, task..." className={`${pillInputClass(darkMode)} h-10 pl-11 sm:w-72`} />
              </div>
            )}
            <EmployeeDateRangePicker darkMode={darkMode} from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={load} />
            <Button darkMode={darkMode} variant="soft" onClick={load} className="h-10">Apply</Button>
          </div>
        </div>
        <div className="overflow-x-auto px-3 pb-4">
          <table className="w-full min-w-[900px] border-separate border-spacing-y-1.5 text-left text-sm">
            <thead className={muted}>
              <tr>
                {["No.", "Employee", "Time filled", "Department", "Status", "Actions"].map((header) => <th key={header} className="px-4 py-2 text-[12px] font-normal">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className={`px-5 py-10 text-center ${muted}`}><ThreeDotLoader /></td></tr>}
              {!loading && reports.map((report, index) => {
                const statusSummary = reportStatusSummary(report);
                return (
                  <tr key={report.id} className={`transition-colors ${darkMode ? "bg-white/[0.03] hover:bg-white/[0.05]" : "bg-[#f7f7f5] hover:bg-[#f2f2ef]"}`}>
                    <td className={`rounded-l-[14px] px-4 py-3 tabular-nums ${muted}`}>{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={reportAvatarUser(report)} name={report.employeeName} className="h-9 w-9" />
                        <div>
                          <p className="text-[13.5px]">{report.employeeName}</p>
                          <p className={`text-xs ${muted}`}>{report.reportDate || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>{displayDateTime(report.submittedAt)}</td>
                    <td className={`px-4 py-3 ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>{report.department}</td>
                    <td className="px-4 py-3">
                      <Chip tone={reportStatusTone(statusSummary)} darkMode={darkMode} className="h-6 px-2.5 text-[12px]">{statusSummary}</Chip>
                    </td>
                    <td className="rounded-r-[14px] px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setDetailClosing(false); setDetailExpanded(false); setDetail(report); }} className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.12]" : "bg-white text-[#141414] hover:bg-[#ebebe8]"}`} title="View detail"><Eye className="h-4 w-4" /></button>
                        <button
                          type="button"
                          onClick={() => deleteEmployeeReport(report)}
                          disabled={deletingReportId === report.id}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-rose-400/[0.12] text-[#f7aab5] hover:bg-rose-400/20" : "bg-white text-[#c0394b] hover:bg-[#fbe4e6]"}`}
                          title="Delete report"
                        >
                          <Trash2 className={`h-4 w-4 ${deletingReportId === report.id ? "animate-pulse" : ""}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !reports.length && (
                <tr><td colSpan={6} className="px-1 py-2"><EmptyState darkMode={darkMode} icon={Inbox} title="No reports found" text="Try another date range or search." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {reminderOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setReminderOpen(false); }}>
          <form onSubmit={saveReminderSchedule} className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={BellRing} tone="rose" title="Reminder schedule" subtitle="Employee daily report" onClose={() => setReminderOpen(false)} />
            <div className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 ${drawerBody}`}>
              <section className={sectionCard}>
                <div className="p-5 sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <p className="text-[22px] leading-[1.15] tracking-[-0.02em]">Send every day</p>
                      <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>at the selected time</p>
                      <p className={`mt-3 text-sm leading-6 ${muted}`}>
                        Runs in IST and skips Sunday. Automatic reminders are sent only to employees who have not submitted for the day.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[13px] ${muted}`}>{reminderSettings.enabled ? "On" : "Off"}</span>
                      <Toggle
                        darkMode={darkMode}
                        checked={reminderSettings.enabled}
                        label="Automatic reminders"
                        onChange={() => setReminderSettings((current) => ({ ...current, enabled: !current.enabled }))}
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="block">
                      <span className={eyebrow}>Reminder time</span>
                      <ReminderTimeWheel
                        value={reminderSettings.time}
                        onChange={(time) => setReminderSettings((current) => ({ ...current, time }))}
                        darkMode={darkMode}
                      />
                    </div>
                    <div className="mt-6 flex flex-col gap-3">
                      <div className={`rounded-[20px] p-4 ${darkMode ? "bg-rose-400/[0.10]" : "bg-[#fbe4e6]"}`}>
                        <BellRing className={`h-5 w-5 ${darkMode ? "text-[#f7aab5]" : "text-[#c0394b]"}`} strokeWidth={1.8} />
                        <p className="mt-4 text-[15px]">{reminderSettings.enabled ? `Daily at ${reminderSettings.time} IST` : "Automatic reminders are off"}</p>
                        <p className={`mt-1 text-[12.5px] leading-5 ${darkMode ? "text-white/55" : "text-[#6b6b6b]"}`}>Saved schedule is handled by the server cron, not the open page.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <div className={`flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6 ${drawerBorder}`}>
              <Button darkMode={darkMode} variant="secondary" onClick={() => setReminderOpen(false)}>Cancel</Button>
              <Button darkMode={darkMode} variant="soft" onClick={checkReminderStatus} disabled={checkingReminder}>
                <BellRing className={`h-4 w-4 ${checkingReminder ? "animate-pulse" : ""}`} />
                {checkingReminder ? "Sending..." : "Send now"}
              </Button>
              <Button darkMode={darkMode} variant={primaryVariant} type="submit" disabled={reminderSaving}>
                {reminderSaving ? "Saving..." : "Save schedule"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheetOpen(false); }}>
          <div className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={Sheet} tone="mint" title="Sheet settings" subtitle="Employee daily report" onClose={() => setSheetOpen(false)} />
            <div className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 ${drawerBody}`}>
            <div className={`${sectionCard} p-5 sm:p-6`}>
              <Chip tone="mint" darkMode={darkMode} icon={Sheet}>Google Sheets</Chip>
              <h3 className="mt-4 text-[22px] leading-[1.15] tracking-[-0.02em]">Connect report workspace</h3>
              <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>one sheet per employee</p>
              <p className={`mt-3 text-sm ${muted}`}>Link the sheet used to save and read employee daily reports.</p>
              <p className={`mt-5 ${eyebrow}`}>Linked Google Sheet</p>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center">
                <input
                  value={sheetInput}
                  onChange={(event) => setSheetInput(event.target.value)}
                  placeholder="Paste your daily report Google Sheet link"
                  className={`${pillInputClass(darkMode)} min-w-0 flex-1`}
                />
                <Button darkMode={darkMode} variant={primaryVariant} size="lg" onClick={saveSheetLink} disabled={sheetSaving || !sheetInput.trim()}>
                  {sheetSaving ? "Linking..." : data?.profile?.sheetLinked ? "Update sheet" : "Link sheet"}
                </Button>
              </div>
              <p className={`mt-3 text-xs ${muted}`}>Reports are saved into this sheet and dashboard data is read back from it.</p>
            </div>
            </div>
          </div>
        </div>
      )}

      {todayStatusOpen && data?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setTodayStatusOpen(false); }}>
          <div className={`employee-report-shell employee-status-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={CalendarCheck} tone="sky" title="Today's status" subtitle={data?.today || todayInput()} onClose={() => setTodayStatusOpen(false)} />
            <div className={`min-h-0 flex-1 overflow-auto p-5 sm:p-6 ${drawerBody}`}>
              <div className="grid grid-cols-3 gap-3">
                <StatTile darkMode={darkMode} icon={Users} tone="neutral" value={todayStatusCounts.total} label="Employees" />
                <StatTile darkMode={darkMode} icon={CheckCircle2} tone="mint" value={todayStatusCounts.submitted} label="Submitted" />
                <StatTile darkMode={darkMode} icon={Clock3} tone="peach" value={todayStatusCounts.pending} label="Not submitted" />
              </div>
            <div className={`mt-4 ${sectionCard} p-4 sm:p-5`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="text-[17px] tracking-[-0.01em]">Today&apos;s submission status</h3>
                  <p className={`mt-0.5 text-[13px] ${muted}`}>{todayStatusCounts.submitted} submitted · {todayStatusCounts.pending} not submitted · {todayStatusCounts.total} total</p>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="relative">
                    <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                    <input
                      value={todayStatusSearch}
                      onChange={(event) => setTodayStatusSearch(event.target.value)}
                      placeholder="Search employee or department..."
                      className={`${pillInputClass(darkMode)} h-10 pl-11 lg:w-72`}
                    />
                  </div>
                  <div className={`inline-flex rounded-full p-1 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                    {[
                      ["all", "All", todayStatusCounts.total],
                      ["submitted", "Submitted", todayStatusCounts.submitted],
                      ["pending", "Not submitted", todayStatusCounts.pending],
                    ].map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTodayStatusFilter(value)}
                        className={`inline-flex h-8 items-center rounded-full px-3.5 text-[13px] transition ${todayStatusFilter === value ? darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#141414] shadow-[0_1px_4px_rgba(0,0,0,0.08)]" : darkMode ? "text-white/55 hover:text-white" : "text-[#8a8a8a] hover:text-[#141414]"}`}
                      >
                        {label} <span className="ml-1.5 opacity-60">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 overflow-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-1.5 text-left text-sm">
                  <thead className={muted}>
                    <tr>{["No.", "Employee", "Department", "Time filled", "Status"].map((header) => <th key={header} className="px-4 py-2 text-[12px] font-normal">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredTodayStatus.map((item, index) => (
                      <tr key={item.userId} className={darkMode ? "bg-white/[0.03]" : "bg-[#f7f7f5]"}>
                        <td className={`rounded-l-[14px] px-4 py-3 tabular-nums ${muted}`}>{String(index + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={item} name={item.employeeName} className="h-9 w-9" />
                            <p className="text-[13.5px]">{item.employeeName}</p>
                          </div>
                        </td>
                        <td className={`px-4 py-3 ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>{item.department || "-"}</td>
                        <td className={`px-4 py-3 ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>{item.submitted ? displayDateTime(item.submittedAt) : "-"}</td>
                        <td className="rounded-r-[14px] px-4 py-3">
                          <Chip tone={item.submitted ? "mint" : "rose"} darkMode={darkMode} className="h-6 px-2.5 text-[12px]">{item.submitted ? "Submitted" : "Not submitted"}</Chip>
                        </td>
                      </tr>
                    ))}
                    {!filteredTodayStatus.length && <tr><td colSpan={5} className="px-1 py-2"><EmptyState darkMode={darkMode} icon={Users} title="No employees match this filter" /></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] ${formClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeFormDrawer(); }}>
          <form onSubmit={submitReport} className={`employee-report-drawer employee-report-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] ${formExpanded ? "employee-report-shell-expanded" : ""} ${formClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={ClipboardList} tone="mint" title="Daily work progress" subtitle={currentReportDate} onClose={closeFormDrawer}>
              {/* On a phone the header is too narrow; the chip sits in the status row under it instead. */}
              <span className="hidden sm:block"><Chip tone="lime" darkMode={darkMode} icon={CheckCircle2}>Editable today</Chip></span>
              <button type="button" onClick={() => setFormExpanded((current) => !current)} className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "bg-white/[0.06] text-white/75 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`} aria-label={formExpanded ? "Restore drawer size" : "Expand report to full screen"}>
                {formExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{formExpanded ? "Restore" : "Expand"}</span>
              </button>
            </DrawerHeader>

            {dateOverride ? (
              <div className={`flex shrink-0 items-start gap-2 border-b px-5 py-2.5 text-xs sm:px-6 ${darkMode ? "border-white/10 bg-amber-400/[0.08] text-amber-100" : "border-[#f0f0ee] bg-[#fbf3dc] text-[#4a3a1c]"}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b07d00]" />
                <span>
                  Date override active from the page link: this report will be filed for{" "}
                  <b>{dateOverride}</b>, not today. Remove{" "}
                  <code>?employeeReportDate=</code> from the URL and reload to file for today.
                </span>
              </div>
            ) : clockMismatch ? (
              <div className={`flex shrink-0 items-start gap-2 border-b px-5 py-2.5 text-xs sm:px-6 ${darkMode ? "border-white/10 bg-amber-400/[0.08] text-amber-100" : "border-[#f0f0ee] bg-[#fbf3dc] text-[#4a3a1c]"}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b07d00]" />
                <span>
                  This device&apos;s date is <b>{deviceToday}</b>, but the server date is{" "}
                  <b>{data?.today}</b>. Your report will be filed for <b>{data?.today}</b>. Please
                  correct this device&apos;s date and time.
                </span>
              </div>
            ) : null}

            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[270px_minmax(0,1fr)]">
              {/* The side panel is for wide screens; on a phone it would pin half the screen. */}
              <aside className={`hidden min-h-0 flex-col overflow-hidden md:flex md:border-r ${drawerBorder} ${drawerSurface}`}>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <Chip tone="mint" darkMode={darkMode} icon={CalendarCheck}>Daily report</Chip>
                  <div className="mt-5 space-y-2.5">
                    <SideFact darkMode={darkMode} label="Department" tone="neutral">{data?.profile?.department || "Required once"}</SideFact>
                    <SideFact darkMode={darkMode} label="Status" tone={data?.todaySubmitted ? "mint" : "lime"}>{data?.todaySubmitted ? "Already filled" : "Ready to submit"}</SideFact>
                    <SideFact darkMode={darkMode} label="Draft" tone="neutral">{lastDraftSavedAt ? `Saved ${formatDraftTime(lastDraftSavedAt)}` : "Autosave ready"}</SideFact>
                    <div className={`rounded-[16px] p-4 ${darkMode ? "bg-white/[0.07]" : "bg-[#f4f4f2]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={eyebrow}>Saved options</p>
                          <p className={`mt-1 text-[14px] ${hasCustomPreferences ? "" : muted}`}>
                            {hasCustomPreferences ? `${customPrefs.sites.length} sites · ${customPrefs.categories.length} categories` : "No saved options"}
                          </p>
                        </div>
                        {hasCustomPreferences && (
                          <Chip tone={customPrefs.useCustomOnly ? "lime" : "outline"} darkMode={darkMode} className="h-6 px-2.5 text-[11.5px]">
                            {customPrefs.useCustomOnly ? "Mine" : "All"}
                          </Chip>
                        )}
                      </div>
                      {hasCustomPreferences && (
                        <div className="mt-3 space-y-2">
                          {sidebarSitesPreview.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sidebarSitesPreview.map((site) => <span key={site} className={`rounded-full px-2.5 py-1 text-[11px] ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#3d3d3b]"}`}>{site}</span>)}
                              {customPrefs.sites.length > sidebarSitesPreview.length && <span className={`rounded-full px-2.5 py-1 text-[11px] ${darkMode ? "bg-white/10 text-white/45" : "bg-white text-[#8a8a8a]"}`}>+{customPrefs.sites.length - sidebarSitesPreview.length}</span>}
                            </div>
                          )}
                          {sidebarCategoriesPreview.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sidebarCategoriesPreview.map((category) => <span key={category} className={`rounded-full px-2.5 py-1 text-[11px] ${darkMode ? "bg-[#cff07a]/15 text-[#d8f39a]" : "bg-[#eef8cc] text-[#4d6b12]"}`}>{category}</span>)}
                              {customPrefs.categories.length > sidebarCategoriesPreview.length && <span className={`rounded-full px-2.5 py-1 text-[11px] ${darkMode ? "bg-white/10 text-white/45" : "bg-white text-[#8a8a8a]"}`}>+{customPrefs.categories.length - sidebarCategoriesPreview.length}</span>}
                            </div>
                          )}
                        </div>
                      )}
                      <Button darkMode={darkMode} variant="secondary" size="sm" onClick={() => setCustomOptionsOpen(true)} className="mt-3 w-full">
                        {hasCustomPreferences ? "Manage options" : "Add options"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className={`flex shrink-0 gap-2 border-t p-4 ${drawerBorder}`}>
                  <Button darkMode={darkMode} variant="secondary" size="lg" onClick={closeFormDrawer} className="flex-1 px-0">Cancel</Button>
                  <Button darkMode={darkMode} variant={primaryVariant} size="lg" type="submit" disabled={submitting} className="flex-1 px-0">{submitting && editingReport ? "Saving..." : editingReport ? "Update" : "Submit"}</Button>
                </div>
              </aside>

              <div className={`min-h-0 overflow-y-auto p-4 pb-8 sm:p-6 md:pb-24 ${drawerBody}`}>
                <div>
                <div className="mb-4 flex flex-wrap items-center gap-2 md:hidden">
                  <Chip tone={data?.todaySubmitted ? "mint" : "lime"} darkMode={darkMode} icon={CheckCircle2}>{data?.todaySubmitted ? "Already filled" : "Ready to submit"}</Chip>
                  <Chip tone="lime" darkMode={darkMode} className="sm:hidden">Editable today</Chip>
                  <Chip tone="neutral" darkMode={darkMode}>{lastDraftSavedAt ? `Saved ${formatDraftTime(lastDraftSavedAt)}` : "Autosave on"}</Chip>
                  <Button darkMode={darkMode} variant="secondary" size="sm" onClick={() => setCustomOptionsOpen(true)} className="ml-auto">
                    {hasCustomPreferences ? "My options" : "Add options"}
                  </Button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {!data?.profile?.department && (
                    <div className="md:col-span-2">
                      <label className={`mb-2 block ${eyebrow}`}>Department</label>
                      <SearchableSelect darkMode={darkMode} value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} options={options.departments} placeholder="Choose department" />
                      {form.department === "__other" && <input required value={form.departmentOther || ""} onChange={(event) => setForm((current) => ({ ...current, departmentOther: event.target.value }))} placeholder="Enter department" className={`mt-2 ${pillInputClass(darkMode)}`} />}
                    </div>
                  )}
                  <div className={`md:col-span-2 overflow-hidden transition-[max-height,opacity,transform,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${customOptionsVisible ? "max-h-[720px] opacity-100" : "max-h-0 -translate-y-2 opacity-0 pointer-events-none"}`}>
                  <div className={`${sectionCard} p-4`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        <IconTile icon={Settings2} tone="lavender" darkMode={darkMode} size="sm" />
                        <div>
                          <p className="text-[15px]">My saved task options</p>
                          <p className={`mt-0.5 text-[12.5px] ${muted}`}>Save your own sites and categories. Turn on custom-only to show only your saved list in dropdowns.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {hasCustomPreferences && (
                          <Button darkMode={darkMode} variant="secondary" onClick={() => setCustomOptionsOpen(false)}>
                            Done
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => saveCustomPreferences({ ...customPrefs, useCustomOnly: !customPrefs.useCustomOnly })}
                          className={`h-9 rounded-full px-4 text-[13px] transition ${customPrefs.useCustomOnly ? "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]" : darkMode ? "border border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
                        >
                          {customPrefs.useCustomOnly ? "Using my options" : "Use all options"}
                        </button>
                        <button type="button" onClick={clearCustomOptions} className={`h-9 rounded-full px-4 text-[13px] transition ${darkMode ? "text-white/70 hover:bg-rose-400/10 hover:text-[#f7aab5]" : "text-[#5f5f5c] hover:bg-[#fbe4e6] hover:text-[#c0394b]"}`}>
                          Clear options
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className={`mb-2 block ${eyebrow}`}>Custom sites</label>
                        <div className="flex gap-2">
                          <input value={customSiteInput} onChange={(event) => setCustomSiteInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomOption("site"); } }} placeholder="Add site name" className={`${pillInputClass(darkMode)} min-w-0 flex-1`} />
                          <Button darkMode={darkMode} variant={primaryVariant} onClick={() => addCustomOption("site")} className="h-11">Save</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {customPrefs.sites.map((site) => <button key={site} type="button" onClick={() => removeCustomOption("site", site)} className={`inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12px] transition ${darkMode ? "bg-white/10 text-white/75 hover:bg-rose-400/10 hover:text-[#f7aab5]" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#fbe4e6] hover:text-[#c0394b]"}`}>{site} <X className="h-3 w-3 opacity-60" /></button>)}
                          {!customPrefs.sites.length && <span className={`text-xs ${muted}`}>No custom sites saved yet.</span>}
                        </div>
                      </div>
                      <div>
                        <label className={`mb-2 block ${eyebrow}`}>Custom categories</label>
                        <div className="flex gap-2">
                          <input value={customCategoryInput} onChange={(event) => setCustomCategoryInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomOption("category"); } }} placeholder="Add category name" className={`${pillInputClass(darkMode)} min-w-0 flex-1`} />
                          <Button darkMode={darkMode} variant={primaryVariant} onClick={() => addCustomOption("category")} className="h-11">Save</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {customPrefs.categories.map((category) => <button key={category} type="button" onClick={() => removeCustomOption("category", category)} className={`inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12px] transition ${darkMode ? "bg-white/10 text-white/75 hover:bg-rose-400/10 hover:text-[#f7aab5]" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#fbe4e6] hover:text-[#c0394b]"}`}>{category} <X className="h-3 w-3 opacity-60" /></button>)}
                          {!customPrefs.categories.length && <span className={`text-xs ${muted}`}>No custom categories saved yet.</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                  {plannedWorkItems.length > 0 && (
                    <div className="md:col-span-2">
                      <div className={`overflow-hidden rounded-[20px] transition ${darkMode ? "bg-[#cff07a]/[0.10]" : "bg-[#eef8cc]"}`}>
                        <button
                          type="button"
                          onClick={() => setPlannedWorkOpen((current) => !current)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <CalendarCheck className={`h-5 w-5 shrink-0 ${darkMode ? "text-[#d8f39a]" : "text-[#4d6b12]"}`} strokeWidth={1.8} />
                            <span className="min-w-0">
                              <span className="block text-[14px]">Today&apos;s planned work</span>
                              <span className={`block truncate text-[12.5px] ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>
                                {plannedWorkItems.length} item{plannedWorkItems.length === 1 ? "" : "s"} from {formatShortDate(plannedWorkSourceDate)}
                              </span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={`hidden h-7 items-center rounded-full px-3 text-[12px] sm:inline-flex ${darkMode ? "bg-white/10 text-white/75" : "bg-white/70 text-[#3d4a1a]"}`}>
                              Import to today
                            </span>
                            <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${darkMode ? "text-[#d8f39a]" : "text-[#4d6b12]"} ${plannedWorkOpen ? "rotate-180" : ""}`} />
                          </span>
                        </button>
                        <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${plannedWorkOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                          <div className="min-h-0 overflow-hidden">
                            <div className={`border-t p-4 ${darkMode ? "border-white/10" : "border-[#dfeeb0]"}`}>
                              <div className="space-y-2">
                                {plannedWorkItems.map((item) => {
                                  const selected = Boolean(plannedWorkSelection[item.plannedKey]);
                                  return (
                                    <button
                                      key={item.plannedKey}
                                      type="button"
                                      onClick={() => togglePlannedWorkItem(item.plannedKey)}
                                      className={`flex w-full items-start gap-3 rounded-[14px] p-3 text-left transition ${selected ? darkMode ? "bg-white/[0.10]" : "bg-white" : darkMode ? "bg-white/[0.04] hover:bg-white/[0.07]" : "bg-white/55 hover:bg-white"}`}
                                    >
                                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition ${selected ? darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white" : darkMode ? "border-white/20 bg-white/5" : "border-[#cfcfcb] bg-white"}`}>
                                        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-[13.5px]">{item.site}</span>
                                          <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] ${darkMode ? "bg-white/10 text-white/65" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}>{item.category}</span>
                                          {item.involvement && <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] ${darkMode ? "bg-white/10 text-white/65" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}>{item.involvement}</span>}
                                        </span>
                                        <span className={`mt-1 block text-[13px] leading-5 ${darkMode ? "text-white/65" : "text-[#5f5f5c]"}`}>{item.description}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Button
                                  darkMode={darkMode}
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    const allSelected = plannedWorkItems.every((item) => plannedWorkSelection[item.plannedKey]);
                                    setPlannedWorkSelection(allSelected ? {} : plannedWorkItems.reduce((result, item) => ({ ...result, [item.plannedKey]: true }), {}));
                                  }}
                                >
                                  {plannedWorkItems.every((item) => plannedWorkSelection[item.plannedKey]) ? "Clear selection" : "Select all"}
                                </Button>
                                <div className="flex gap-2">
                                  <button type="button" onClick={discardPlannedWorkForToday} className={`h-8 rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "bg-rose-400/[0.12] text-[#f7aab5] hover:bg-rose-400/20" : "bg-white text-[#c0394b] hover:bg-[#fbe4e6]"}`}>Discard for today</button>
                                  <Button darkMode={darkMode} variant={primaryVariant} size="sm" onClick={importSelectedPlannedWork} disabled={!selectedPlannedWorkCount}>Import selected {selectedPlannedWorkCount ? `(${selectedPlannedWorkCount})` : ""}</Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <TaskRowsEditor
                    title="Today's Tasks"
                    rows={form.taskItems}
                    categories={formCategories}
                    sites={formSites}
                    statuses={options.taskStatuses}
                    involvements={formInvolvements}
                    popularSites={optionUsage.sites}
                    popularCategories={optionUsage.categories}
                    popularInvolvements={optionUsage.involvements}
                    collaborationUsers={collaborationUsers}
                    showStatus
                    showInvolvement
                    required
                    onRowsChange={(rows, meta) => setForm((current) => {
                      const removedRow = meta?.action === "remove" ? meta.removedRow || {} : null;
                      const recurringId = removedRow && (removedRow.recurring || removedRow.recurringId) ? recurringIdForTask(removedRow) : "";
                      return {
                        ...current,
                        taskItems: rows,
                        dismissedRecurringIds: recurringId ? uniqueClean([...(current.dismissedRecurringIds || []), recurringId]) : (current.dismissedRecurringIds || []),
                      };
                    })}
                    onRefineDescription={refineDescription}
                    darkMode={darkMode}
                  />
                  <TaskRowsEditor
                    title="Tasks in waiting / tomorrow plan"
                    rows={form.waitingTaskItems}
                    categories={formCategories}
                    sites={formSites}
                    involvements={formInvolvements}
                    popularSites={optionUsage.sites}
                    popularCategories={optionUsage.categories}
                    popularInvolvements={optionUsage.involvements}
                    collaborationUsers={collaborationUsers}
                    showInvolvement
                    onRowsChange={(rows) => setForm((current) => ({ ...current, waitingTaskItems: rows }))}
                    onRefineDescription={refineDescription}
                    darkMode={darkMode}
                  />
                  <div className="md:col-span-2"><label className={`mb-2 block text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>Note</label><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} placeholder="Any extra note..." className={areaInputClass(darkMode)} /></div>
                </div>
                </div>
              </div>
            </div>
            {/* Phone: Cancel / Submit stay in a slim bar at the bottom while the form scrolls above. */}
            <div className={`flex shrink-0 gap-2 border-t px-4 pt-3 md:hidden ${drawerBorder} ${drawerSurface}`} style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={closeFormDrawer} className="flex-1 px-0">Cancel</Button>
              <Button darkMode={darkMode} variant={primaryVariant} size="lg" type="submit" disabled={submitting} className="flex-[1.4] px-0">{submitting && editingReport ? "Saving..." : editingReport ? "Update" : "Submit"}</Button>
            </div>
          </form>
          {draftChoiceOpen && (
            <div className="absolute inset-0 z-[60] grid place-items-center bg-black/20 p-4">
              <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop w-full max-w-md rounded-[24px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`} onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={FileText} tone="lime" darkMode={darkMode} />
                  <div className="min-w-0">
                    <p className={eyebrow}>Draft detected</p>
                    <h3 className="mt-0.5 text-[18px] tracking-[-0.01em]">Continue your saved report?</h3>
                  </div>
                </div>
                <p className={`mt-3 text-[13.5px] leading-6 ${darkMode ? "text-white/55" : "text-[#6f6f6c]"}`}>
                  A local draft was saved{pendingDraft?.savedAt ? ` at ${formatDraftTime(pendingDraft.savedAt)}` : ""}. Continue from it or start a fresh report for today.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button darkMode={darkMode} variant={primaryVariant} size="lg" onClick={continueDraft} className="flex-1">Continue draft</Button>
                  <Button darkMode={darkMode} variant="secondary" size="lg" onClick={startFreshDraft} className="flex-1">Start new</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {pendingCollaborationTask && (
        <div className="ui-backdrop fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop w-full max-w-lg rounded-[24px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <Chip tone="lime" darkMode={darkMode} icon={Users}>Collaboration task</Chip>
              {pendingCollaborationTasks.length > 1 && (
                <Chip darkMode={darkMode} className="tabular-nums">
                  {Math.min(activeCollaborationInviteIndex + 1, pendingCollaborationTasks.length)} / {pendingCollaborationTasks.length}
                </Chip>
              )}
            </div>
            <h3 className="mt-4 text-[22px] leading-[1.15] tracking-[-0.02em]">You have been added</h3>
            <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>to a team task</p>
            <p className={`mt-3 text-[13.5px] leading-6 ${darkMode ? "text-white/55" : "text-[#6f6f6c]"}`}>
              {pendingCollaborationTask.collaborationSourceName || "A team member"} added you to this task. Accept it to add it to your report, or reject it to skip.
            </p>
            {pendingCollaborationTasks.length > 1 && (
              <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                {pendingCollaborationTasks.map((task, index) => (
                  <button
                    key={task.inviteId || index}
                    type="button"
                    onClick={() => setActiveCollaborationInviteIndex(index)}
                    className={`h-8 shrink-0 rounded-full px-3.5 text-[12.5px] transition ${index === activeCollaborationInviteIndex ? darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white" : darkMode ? "bg-white/[0.07] text-white/65 hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#5f5f5c] hover:bg-[#ebebe8]"}`}
                  >
                    Task {index + 1}
                  </button>
                ))}
              </div>
            )}
            <div className={`mt-4 rounded-[16px] p-4 ${softTile}`}>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className={eyebrow}>Site</p><p className="mt-1">{pendingCollaborationTask.site || "-"}</p></div>
                <div><p className={eyebrow}>Category</p><p className="mt-1">{pendingCollaborationTask.category || "-"}</p></div>
                <div><p className={eyebrow}>Status</p><p className="mt-1">{pendingCollaborationTask.status || "In Progress"}</p></div>
                <div><p className={eyebrow}>Involvement</p><p className="mt-1">{pendingCollaborationTask.involvement || "Team"}</p></div>
                <div className="sm:col-span-2"><p className={eyebrow}>Description</p><p className="mt-1.5 whitespace-pre-wrap leading-6">{pendingCollaborationTask.description || "-"}</p></div>
              </div>
            </div>
            {pendingCollaborationTasks.length > 1 && (
              <div className="mt-4 flex justify-between gap-2">
                <Button
                  darkMode={darkMode}
                  variant="soft"
                  size="sm"
                  disabled={activeCollaborationInviteIndex <= 0}
                  onClick={() => setActiveCollaborationInviteIndex((index) => Math.max(0, index - 1))}
                >
                  Previous
                </Button>
                <Button
                  darkMode={darkMode}
                  variant="soft"
                  size="sm"
                  disabled={activeCollaborationInviteIndex >= pendingCollaborationTasks.length - 1}
                  onClick={() => setActiveCollaborationInviteIndex((index) => Math.min(pendingCollaborationTasks.length - 1, index + 1))}
                >
                  Next
                </Button>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                darkMode={darkMode}
                variant="secondary"
                size="lg"
                disabled={Boolean(collaborationResponding)}
                onClick={() => respondToCollaborationTask(pendingCollaborationTask, "rejected")}
                className="flex-1"
              >
                {collaborationResponding === `${pendingCollaborationTask.inviteId}:rejected` && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject
              </Button>
              <Button
                darkMode={darkMode}
                variant={primaryVariant}
                size="lg"
                disabled={Boolean(collaborationResponding)}
                onClick={() => respondToCollaborationTask(pendingCollaborationTask, "accepted")}
                className="flex-1"
              >
                {collaborationResponding === `${pendingCollaborationTask.inviteId}:accepted` && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept task
              </Button>
            </div>
          </div>
        </div>
      )}

      {questionSettingsOpen && data?.isAdmin && (
        <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuestionSettingsOpen(false); }}>
          <form onSubmit={saveQuestionSettings} className={`employee-report-drawer employee-report-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={Sparkles} tone="lavender" title="Management questions" subtitle="Employee daily report" onClose={() => setQuestionSettingsOpen(false)} />

            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[270px_minmax(0,1fr)]">
              <aside className={`flex min-h-0 flex-col overflow-hidden border-b md:border-b-0 md:border-r ${drawerBorder} ${drawerSurface}`}>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <Chip tone="lavender" darkMode={darkMode} icon={Settings2}>Super admin</Chip>
                  <h3 className="mt-4 text-[20px] leading-[1.15] tracking-[-0.02em]">Assign management questions</h3>
                  <p className={`mt-2 text-[13px] leading-6 ${muted}`}>
                    Choose which employees must answer each question after submitting their daily report.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-1">
                    <StatTile darkMode={darkMode} icon={Sparkles} tone="lavender" value={questionSettingsDraft.length} label="Questions" className="min-h-[104px]" />
                    <StatTile darkMode={darkMode} icon={Users} tone="sky" value={questionSettingsUsers.length} label="Employees" className="min-h-[104px]" />
                  </div>
                </div>
                <div className={`flex shrink-0 flex-col gap-2 border-t p-4 ${drawerBorder}`}>
                  <Button darkMode={darkMode} variant="secondary" size="lg" icon={Plus} onClick={addQuestionDraft}>
                    Add question
                  </Button>
                  <Button darkMode={darkMode} variant={primaryVariant} size="lg" type="submit" disabled={questionSettingsSaving || questionSettingsLoading}>
                    {questionSettingsSaving ? "Saving..." : "Save setup"}
                  </Button>
                </div>
              </aside>

              <div className={`min-h-0 overflow-y-auto p-5 pb-24 sm:p-6 ${drawerBody}`}>
                <section>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-[22px] leading-[1.15] tracking-[-0.02em]">Management answer setup</h4>
                      <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>who answers what</p>
                      <p className={`mt-2 text-[13px] ${muted}`}>Enabled questions are compulsory only for the selected employees.</p>
                    </div>
                    <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={addQuestionDraft}>
                      Add question
                    </Button>
                  </div>

                  {questionSettingsLoading ? (
                    <div className={`mt-6 grid min-h-[260px] place-items-center rounded-[20px] ${softTile}`}><ThreeDotLoader /></div>
                  ) : (
                    <div className="mt-6 space-y-3">
                      {questionSettingsDraft.map((question, index) => (
                        <div key={question.id} className={`${sectionCard} p-4`}>
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-[13px] tabular-nums ${darkMode ? "bg-[#a78bfa]/15 text-[#c9b9fb]" : "bg-[#ece8fb] text-[#6b4fd1]"}`}>{String(index + 1).padStart(2, "0")}</div>
                            <div className="min-w-0 flex-1">
                              <label className={`mb-2 block ${eyebrow}`}>Question</label>
                              <input
                                value={question.label}
                                onChange={(event) => updateQuestionDraft(question.id, { label: event.target.value })}
                                placeholder="Type management question"
                                className={pillInputClass(darkMode)}
                              />
                            </div>
                            <div className="w-full xl:w-[340px]">
                              <label className={`mb-2 block ${eyebrow}`}>Assign employees</label>
                              <EmployeeUserMultiSelect
                                darkMode={darkMode}
                                users={questionSettingsUsers}
                                selectedIds={question.assignedUserIds || []}
                                onChange={(ids) => updateQuestionDraft(question.id, { assignedUserIds: ids })}
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-2.5 xl:pt-8">
                              <span className={`text-[12.5px] ${muted}`}>{question.enabled !== false ? "On" : "Off"}</span>
                              <Toggle
                                darkMode={darkMode}
                                checked={question.enabled !== false}
                                label="Question enabled"
                                onChange={() => updateQuestionDraft(question.id, { enabled: question.enabled === false })}
                              />
                              <button type="button" onClick={() => removeQuestionDraft(question.id)} aria-label="Remove question" className={`grid h-10 w-10 place-items-center rounded-full transition ${darkMode ? "bg-rose-400/[0.12] text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!questionSettingsDraft.length && (
                        <EmptyState darkMode={darkMode} icon={Sparkles} tone="lavender" title="No management questions yet" text="Add a question and choose who answers it." />
                      )}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </form>
        </div>
      )}

      {executiveOpen && (
        <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]">
          <form onSubmit={saveExecutiveAnswers} className={`employee-report-drawer employee-report-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={Sparkles} tone="amber" title="Management follow-up" subtitle={data?.today || todayInput()}>
              <Chip tone="amber" darkMode={darkMode}>Required</Chip>
            </DrawerHeader>

            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[270px_minmax(0,1fr)]">
              <aside className={`flex min-h-0 flex-col overflow-hidden border-b md:border-b-0 md:border-r ${drawerBorder} ${drawerSurface}`}>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <Chip tone="lime" darkMode={darkMode} icon={Sparkles}>CEO inputs</Chip>
                  <h3 className="mt-4 text-[20px] leading-[1.15] tracking-[-0.02em]">Complete today&apos;s management questions</h3>
                  <p className={`mt-2 text-[13px] leading-6 ${muted}`}>
                    These answers are used for the executive employee report and tomorrow risk analysis.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    <StatTile darkMode={darkMode} icon={ClipboardList} tone="mint" value={executiveQuestions.length} label="Assigned questions" className="min-h-[104px]" />
                    <SideFact darkMode={darkMode} label="Must complete" tone="amber">All fields are required before closing this step.</SideFact>
                  </div>
                </div>
                <div className={`flex shrink-0 gap-2 border-t p-4 ${drawerBorder}`}>
                  <Button darkMode={darkMode} variant={primaryVariant} size="lg" type="submit" disabled={executiveSaving} className="flex-1">
                    {executiveSaving ? "Saving..." : "Save answers"}
                  </Button>
                </div>
              </aside>

              <div className={`min-h-0 overflow-y-auto p-5 pb-24 sm:p-6 ${drawerBody}`}>
                <section>
                  <h4 className="text-[22px] leading-[1.15] tracking-[-0.02em]">Management questions</h4>
                  <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>brief but clear</p>
                  <p className={`mt-2 text-[13px] ${muted}`}>Mention names, dates, blockers and ownership wherever applicable.</p>
                  <div className="mt-6 grid gap-3">
                    {executiveQuestions.map((question, index) => (
                      <label key={question.id} className={`block ${sectionCard} p-4 transition`}>
                        <span className="flex items-start gap-3">
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[12px] tabular-nums ${darkMode ? "bg-emerald-400/[0.12] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"}`}>{String(index + 1).padStart(2, "0")}</span>
                          <span>
                            <span className="block text-[14px]">{question.label}</span>
                            <span className={`mt-0.5 block text-[12px] ${muted}`}>Required for executive analysis</span>
                          </span>
                        </span>
                        <textarea
                          required
                          value={executiveAnswers[question.id] || ""}
                          onChange={(event) => setExecutiveAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                          rows={3}
                          placeholder="Type the update here..."
                          className={`mt-3 resize-y leading-6 ${areaInputClass(darkMode)}`}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </form>
        </div>
      )}

      {reportOpen && data?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}>
          <div className={`employee-report-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader darkMode={darkMode} icon={FileText} tone="peach" title="Generate report" subtitle="Employee daily report" onClose={() => setReportOpen(false)} />

            <div className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 ${drawerBody}`}>

            <div className={`mb-4 shrink-0 rounded-[20px] p-3 ${softTile}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <EmployeeUserMultiSelect darkMode={darkMode} users={reportUsers} selectedIds={reportUserIds} onChange={setReportUserIds} />
                <EmployeeDateRangePicker darkMode={darkMode} from={reportFrom} to={reportTo} onFromChange={setReportFrom} onToChange={setReportTo} />
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Button darkMode={darkMode} variant={primaryVariant} onClick={generateEmployeeReport} disabled={reportLoading} className="h-10">{reportLoading ? "Generating..." : "Generate"}</Button>
                  <Button darkMode={darkMode} variant="secondary" icon={Download} onClick={() => downloadEmployeeReportPdf()} disabled={Boolean(reportDownloading)} className="h-10">
                    {reportDownloading === "range" ? "Preparing..." : "Range PDF"}
                  </Button>
                  <Button darkMode={darkMode} variant="secondary" icon={FileText} onClick={() => { const today = todayInput(); void downloadEmployeeReportPdf({ from: today, to: today, mode: "today" }); }} disabled={Boolean(reportDownloading)} className={`h-10 ${darkMode ? "text-[#f7aab5]" : "text-[#c0394b]"}`}>
                    {reportDownloading === "today" ? "Preparing..." : "Today PDF"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!reportData ? (
                <EmptyState darkMode={darkMode} icon={FileText} tone="peach" title="No report generated yet" text="Choose employees and a date range, then click Generate." className="min-h-[360px]" />
              ) : (
                <div className="space-y-4">
                  <section className={`${sectionCard} p-5`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={eyebrow}>{reportData.range.from} to {reportData.range.to}</p>
                        <h4 className="mt-1 text-[22px] leading-[1.15] tracking-[-0.02em]">Employee submissions</h4>
                        <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>{reportData.selectedUserIds?.length ? `${reportData.selectedUserIds.length} selected employee${reportData.selectedUserIds.length === 1 ? "" : "s"}` : "All employees"}</p>
                      </div>
                      <Chip tone="mint" darkMode={darkMode} icon={CheckCircle2}>Generated</Chip>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                      {[
                        ["Submissions", reportData.summary.responses, ClipboardList, "mint"],
                        ["Employees", reportData.summary.employees, Users, "sky"],
                        ["Not submitted", reportData.summary.notSubmitted || 0, Clock3, "rose"],
                        ["Departments", reportData.summary.departments, Building2, "amber"],
                        ["Questions", reportData.summary.questions, Sparkles, "lavender"],
                      ].map(([label, value, Icon, tone]) => (
                        <StatTile key={label} darkMode={darkMode} icon={Icon} tone={tone} value={value} label={label} />
                      ))}
                    </div>
                    {(reportData.notSubmitted || []).some((group) => group.count > 0) && (
                      <div className={`mt-5 rounded-[16px] p-4 ${darkMode ? "bg-rose-400/[0.08]" : "bg-[#fbe4e6]"}`}>
                        <p className={`text-[12.5px] ${darkMode ? "text-[#f7aab5]" : "text-[#c0394b]"}`}>Not submitted</p>
                        <ul className="mt-2 space-y-1.5 text-sm leading-5">
                          {(reportData.notSubmitted || []).filter((group) => group.count > 0).slice(0, 4).map((group) => (
                            <li key={group.date}>• {group.date}: {(group.employees || []).map((employee) => employee.displayName || employee.username).filter(Boolean).join(", ")}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {(reportData.employeeReports || []).slice(0, 8).map((report, index) => (
                        <div key={report.id || `${report.userId}-${report.reportDate}-${index}`} className={`rounded-[16px] p-4 ${softTile}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[15px]"><span className={`mr-1.5 tabular-nums ${muted}`}>{String(index + 1).padStart(2, "0")}</span>{report.employeeName || "Employee"}</p>
                              <p className={`mt-0.5 text-xs ${muted}`}>{report.department || "No department"} · {report.reportDate}</p>
                            </div>
                            <Chip tone={report.tomorrowPlanTick ? "mint" : "amber"} darkMode={darkMode} className="h-6 px-2.5 text-[11.5px]">
                              {report.tomorrowPlanTick ? "Plan confirmed" : "Plan pending"}
                            </Chip>
                          </div>
                          <div className="mt-4 space-y-3">
                            {[
                              ["Completed work", report.taskItems || []],
                              ["Waiting / follow-up", report.waitingTaskItems || []],
                            ].map(([label, items]) => items.length ? (
                              <div key={label}>
                                <p className={eyebrow}>{label}</p>
                                <ul className="mt-1.5 space-y-1.5 text-sm leading-5">
                                  {items.slice(0, 3).map((item, itemIndex) => (
                                    <li key={itemIndex}>• {[item.site, item.category].filter(Boolean).join(" - ")}{item.description ? `: ${item.description}` : ""}</li>
                                  ))}
                                  {items.length > 3 && <li className={muted}>• +{items.length - 3} more</li>}
                                </ul>
                              </div>
                            ) : null)}
                            {(report.managementAnswers || []).length ? (
                              <div>
                                <p className={eyebrow}>Management answers</p>
                                <ul className="mt-1.5 space-y-1.5 text-sm leading-5">
                                  {(report.managementAnswers || []).slice(0, 3).map((answer, answerIndex) => (
                                    <li key={answer.id || answerIndex}>• <span className={darkMode ? "text-white" : "text-[#141414]"}>{answer.label}</span>: <span className={darkMode ? "text-white/70" : "text-[#5f5f5c]"}>{answer.answer}</span></li>
                                  ))}
                                  {report.managementAnswers.length > 3 && <li className={muted}>• +{report.managementAnswers.length - 3} more</li>}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!(reportData.employeeReports || []).length && (
                      <EmptyState darkMode={darkMode} icon={Inbox} title="No employee submissions" text="Nothing was submitted in this range." className="mt-5" />
                    )}
                    {reportData.analysis ? <>
                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {[
                        ["CEO operating status", reportData.analysis?.overallStatus, Activity, "sky"],
                        ["Most at risk today", reportData.analysis?.projectMostAtRiskTomorrow, AlertTriangle, "rose"],
                      ].map(([label, value, Icon, tone]) => (
                        <FeatureCard key={label} darkMode={darkMode} icon={Icon} tone={tone} title={label} text={value || "No analysis available."} />
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Project most at risk", reportData.analysis?.ceoFocus?.projectRisk, AlertTriangle, "peach"],
                        ["Payment focus", reportData.analysis?.ceoFocus?.paymentFocus, Building2, "amber"],
                        ["CEO decision", reportData.analysis?.ceoFocus?.ceoDecision, Sparkles, "lavender"],
                        ["Must finish today", reportData.analysis?.ceoFocus?.todayMustFinish, CheckCircle2, "mint"],
                      ].map(([label, value, Icon, tone]) => (
                        <FeatureCard key={label} darkMode={darkMode} icon={Icon} tone={tone} title={label} text={value || "No update submitted."} />
                      ))}
                    </div>
                    </> : null}
                  </section>

                  {reportData.analysis && (reportData.analysis?.projectCards || []).length ? (
                    <section className={`${sectionCard} p-5`}>
                      <div className="flex items-center gap-3">
                        <IconTile icon={Building2} tone="peach" darkMode={darkMode} size="sm" />
                        <div>
                          <h4 className="text-[17px] tracking-[-0.01em]">Project risk dashboard</h4>
                          <p className={`text-[12.5px] ${muted}`}>Projects</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {(reportData.analysis?.projectCards || []).map((project, index) => (
                          <div key={`${project.name || "project"}-${index}`} className={`rounded-[16px] p-4 ${softTile}`}>
                            <div className="flex items-start justify-between gap-3">
                              <h5 className="text-[15px]">{project.name || "Project needs clarification"}</h5>
                              <Chip darkMode={darkMode} tone="outline" className="h-6 shrink-0 px-2.5 text-[11.5px]">{project.progress || project.status || "Update"}</Chip>
                            </div>
                            {[project.status, project.criticalPending && `Pending: ${project.criticalPending}`, project.owner && `Owner: ${project.owner}`, project.target && `Target: ${project.target}`, project.summary, project.nextAction && `Next: ${project.nextAction}`, project.source && `Source: ${project.source}`].filter(Boolean).map((line, lineIndex) => (
                              <p key={lineIndex} className={`mt-2 text-sm leading-5 ${lineIndex === 0 ? "" : muted}`}>{line}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {reportData.analysis ? <>
                  <EmployeeReportTable
                    title="Money"
                    headers={["Insight"]}
                    rows={(reportData.analysis?.moneyDashboard || reportData.analysis?.moneySignals || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Team"
                    headers={["Insight"]}
                    rows={(reportData.analysis?.teamDashboard || reportData.analysis?.teamSignals || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Procurement"
                    headers={["Insight"]}
                    rows={(reportData.analysis?.procurementDashboard || reportData.analysis?.procurementSignals || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Legal / approvals"
                    headers={["Insight"]}
                    rows={(reportData.analysis?.legalDashboard || reportData.analysis?.legalSignals || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="What moved forward"
                    headers={["Insight"]}
                    rows={(reportData.analysis?.deliverablesMovedForward || reportData.analysis?.positiveSignals || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Stuck / risk"
                    headers={["Insight"]}
                    rows={(reportData.analysis?.stuckItems || reportData.analysis?.keyRisks || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="CEO decisions"
                    headers={["Decision"]}
                    rows={(reportData.analysis?.ceoDecisions || reportData.analysis?.decisionsNeeded || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Tomorrow commitments"
                    headers={["Commitment"]}
                    rows={(reportData.analysis?.tomorrowCommitments || reportData.analysis?.tomorrowPriorities || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Support required"
                    headers={["Support"]}
                    rows={(reportData.analysis?.supportRequired || []).map((item) => [item])}
                    darkMode={darkMode}
                  />
                  </> : null}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] ${detailClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetailDrawer(); }}>
          <div className={`employee-report-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] ${detailExpanded ? "employee-report-shell-expanded" : ""} ${detailClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${drawerBorder} ${drawerSurface}`}>
            <DrawerHeader
              darkMode={darkMode}
              icon={Eye}
              tone="sky"
              title={detail.reportDate === data?.today && detail.userId === data?.currentUserId ? "Editable report detail" : "Read-only report detail"}
              subtitle={`${detail.employeeName || "Employee"} · ${detail.reportDate}`}
              onClose={closeDetailDrawer}
            >
              {detail.reportDate === data?.today && detail.userId === data?.currentUserId && (
                <Button darkMode={darkMode} variant={primaryVariant} size="sm" onClick={() => { closeDetailDrawer(); window.setTimeout(openForm, 300); }}>Edit report</Button>
              )}
              <button type="button" onClick={() => setDetailExpanded((current) => !current)} className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "bg-white/[0.06] text-white/75 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`} aria-label={detailExpanded ? "Restore drawer size" : "Expand report to full screen"}>{detailExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{detailExpanded ? "Restore" : "Expand"}</span></button>
            </DrawerHeader>

            <div className={`${detailExpanded ? "grid md:grid-cols-[270px_minmax(0,1fr)]" : "block"} min-h-0 flex-1 overflow-hidden`}>
              {detailExpanded && <aside className={`hidden min-h-0 flex-col border-b p-5 md:flex md:border-b-0 md:border-r ${drawerBorder} ${drawerSurface}`}>
                <div>
                  <Chip tone="sky" darkMode={darkMode} icon={Users}>Submitted by</Chip>
                  <h4 className="mt-4 text-[20px] leading-tight tracking-[-0.02em]">{detail.employeeName || "Employee"}</h4>
                  <p className={`mt-1 text-xs ${muted}`}>{displayDateTime(detail.submittedAt)}</p>
                </div>
                <div className="mt-6 space-y-2.5">
                  {[["Department", detail.department || "-"], ["Status", detail.taskStatus || "-"]].map(([label, value]) => <SideFact key={label} darkMode={darkMode} label={label} tone="neutral">{value}</SideFact>)}
                </div>
                <Button darkMode={darkMode} variant="secondary" size="lg" onClick={closeDetailDrawer} className="mt-auto">Close</Button>
              </aside>}

              <div className={`h-full min-h-0 overflow-y-auto p-4 sm:p-6 ${drawerBody}`}><div>
                <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h4 className="text-[22px] leading-[1.15] tracking-[-0.02em]">Daily report summary</h4>
                    <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>work progress</p>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {[
                      ["Task Type", detail.taskType],
                    ].map(([label, value]) => (
                      <Chip key={label} darkMode={darkMode} tone="outline">
                        <span className={muted}>{label}</span>
                        <span className="max-w-[180px] truncate">{value || "-"}</span>
                      </Chip>
                    ))}
                    <Chip tone="lime" darkMode={darkMode}>Read-only</Chip>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TaskItemsDisplay title="Task description" items={detail.taskItems} fallback={detail.taskDescription} darkMode={darkMode} showStatus showInvolvement />
                  <TaskItemsDisplay title="Waiting / tomorrow plan" items={detail.waitingTaskItems} fallback={detail.waitingTaskDescription} darkMode={darkMode} showInvolvement />
                  <div className={`rounded-[20px] p-5 md:col-span-2 ${softTile}`}>
                    <p className={eyebrow}>Note</p>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7">{detail.note || "-"}</p>
                  </div>
                </div>
              </div></div>
            </div>
          </div>
        </div>
      )}

      {heatmapOpen && !data?.isAdmin && (
        <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop w-full max-w-6xl rounded-[24px] border p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Chip tone="mint" darkMode={darkMode} icon={Activity}>Activity heatmap</Chip>
                <h3 className="mt-3 text-[22px] leading-[1.15] tracking-[-0.02em]">Your submission activity</h3>
                <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>day by day this year</p>
              </div>
              <button onClick={() => setHeatmapOpen(false)} aria-label="Close" className={`grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}><X className="h-4 w-4" /></button>
            </div>
            <Heatmap darkMode={darkMode} rows={data?.heatmap || []} title="Your submission activity" />
          </div>
        </div>
      )}

      <SubmissionCelebrationModal
        darkMode={darkMode}
        celebration={submissionCelebration}
        onClose={() => setSubmissionCelebration(null)}
        canClockOut={Boolean(todayAttendance?.clockInAt && !todayAttendance?.clockOutAt)}
        clockingOut={attendanceClockingOut}
        onClockOut={clockOutFromReportModal}
      />
      <ConfettiBurst active={confettiActive} onDone={() => setConfettiActive(false)} />
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title="Delete employee report"
        message={`Delete ${deleteConfirm?.employeeName || "this employee"}'s report for ${deleteConfirm?.reportDate}? This will remove it from _AppData and clear the matching Google Sheet rows.`}
        loading={Boolean(deletingReportId)}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => performDeleteEmployeeReport(deleteConfirm)}
      />
    </main>
  );
}
