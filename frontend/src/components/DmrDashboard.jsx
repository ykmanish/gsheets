"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CalendarDays,
  ChevronDown,
  Check,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { ConfirmModal, DatePicker, SelectMenu, useClickOutside } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function localDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysInput(value, days) {
  const date = new Date(`${value || localDateInputValue()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateInputValue(date);
}

function dateInputToDate(value) {
  const date = new Date(`${value || localDateInputValue()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function sameCalendarDay(first, second) {
  return Boolean(
    first &&
    second &&
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate(),
  );
}

function reportDateLabel(value) {
  return dateInputToDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function reportMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const DMR_REPORT_SECTION_OPTIONS = [
  { id: "siteManpower", label: "Site wise manpower" },
  { id: "agencyManpower", label: "Agency wise manpower" },
  { id: "tradeSiteManpower", label: "Trade by site" },
  { id: "dailyProgress", label: "Daily progress" },
  { id: "attendance", label: "Attendance" },
  { id: "equipment", label: "Equipment & tools" },
  { id: "materials", label: "Materials" },
  { id: "notes", label: "Notes" },
];

function comparablePlanText(value = "") {
  const text = String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bfarm\s+house\b/g, "farmhouse")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(/\s+/g, "");
  const siteAliases = {
    farmhouse: "serenitymeadowsfarmhouse",
    serenitymeadowsfarm: "serenitymeadowsfarmhouse",
    serenitymeadowsfarmhouse: "serenitymeadowsfarmhouse",
    gharana: "gharana",
    sgharana: "gharana",
    sheetalgharana: "gharana",
  };
  return siteAliases[compact] || text;
}

function comparableTradeText(value = "") {
  const text = comparablePlanText(value);
  const compact = text.replace(/\s+/g, "");
  const tradeAliases = {
    ac: "ac",
    aircondition: "ac",
    airconditioning: "ac",
    airconditioner: "ac",
    airconditioners: "ac",
  };
  if (tradeAliases[compact]) return tradeAliases[compact];
  return compact;
}

function manpowerBreakdown(records = [], field) {
  return [
    ...records
      .reduce((result, record) => {
        const label = String(record?.[field] || "Unassigned").trim() || "Unassigned";
        const current = result.get(label) || {
          label,
          planned: 0,
          actual: 0,
          variance: 0,
        };
        current.planned += Number(record.planned) || 0;
        current.actual += Number(record.actual) || 0;
        current.variance = current.actual - current.planned;
        result.set(label, current);
        return result;
      }, new Map())
      .values(),
  ].sort(
    (a, b) =>
      b.actual - a.actual ||
      b.planned - a.planned ||
      a.label.localeCompare(b.label),
  );
}

function planActualStatus(plannedValue, actualValue) {
  const planned = Number(plannedValue) || 0;
  const actual = Number(actualValue) || 0;
  return {
    planned,
    actual,
    variance: actual - planned,
    ok: actual >= planned,
  };
}

function planStatusTone(status, darkMode) {
  return status.ok
    ? darkMode
      ? "bg-emerald-400/10 text-emerald-200 border-emerald-400/20"
      : "bg-emerald-50 text-emerald-700 border-emerald-200"
    : darkMode
      ? "bg-red-400/10 text-red-200 border-red-400/20"
      : "bg-red-50 text-red-700 border-red-200";
}

function WorkloadBars({ title, items = [], darkMode }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items.slice(0, 8);
  const max = Math.max(
    1,
    ...chartItems.map((item) =>
      Math.max(Number(item.planned) || 0, Number(item.actual) || 0),
    ),
  );
  const totalActual = chartItems.reduce(
    (sum, item) => sum + (Number(item.actual) || 0),
    0,
  );
  const totalPlanned = chartItems.reduce(
    (sum, item) => sum + (Number(item.planned) || 0),
    0,
  );
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-[#111216]" : "border-[#dfe7e4] bg-white"}`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
          >
            Live DMR
          </p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
          <p className={`mt-2 text-xs ${muted}`}>
            {totalActual} actual / {totalPlanned} planned
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#15a8e0]" />
          <span className={`text-[11px] ${muted}`}>Actual</span>
        </div>
      </div>

      <div className="flex h-64 max-w-full items-end gap-2 overflow-x-auto overflow-y-hidden pb-2">
        {chartItems.map((item) => {
          const actual = Number(item.actual) || 0;
          const planned = Number(item.planned) || 0;
          const plannedHeight = Math.max(
            8,
            (Math.max(planned, actual) / max) * 100,
          );
          const actualHeight = actual ? Math.max(8, (actual / max) * 100) : 0;
          return (
            <div
              key={item.label}
              className="flex min-w-[52px] flex-1 flex-col items-center"
            >
              <div className="mb-2 min-h-9 text-center">
                <p
                  className={`text-sm font-semibold ${darkMode ? "text-white" : ""}`}
                >
                  {actual}
                </p>
                <p className={`text-[10px] ${muted}`}>/{planned}</p>
              </div>
              <div className="flex h-36 w-full max-w-[40px] items-end">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-t-[18px] rounded-b-md ${darkMode ? "bg-[#24262b]" : "bg-[#ece9e2]"}`}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t-[18px] ${darkMode ? "bg-[#3a3d42]" : "bg-[#ece9e2]"}`}
                    style={{ height: `${plannedHeight}%` }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-[18px] bg-[#15a8e0]"
                    style={{ height: `${actualHeight}%` }}
                  />
                </div>
              </div>
              <p
                className={`mt-3 line-clamp-2 min-h-8 text-center text-[11px] leading-4 ${muted}`}
              >
                {item.label}
              </p>
            </div>
          );
        })}
        {!chartItems.length && (
          <p
            className={`flex flex-1 items-center justify-center py-8 text-center text-sm ${muted}`}
          >
            No DMR data available yet.
          </p>
        )}
      </div>
    </section>
  );
}

function TomorrowSiteBars({
  items = [],
  darkMode,
  title = "Site-wise planned manpower",
  emptyText = "No plan data available yet.",
}) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items.slice(0, 8);
  const max = Math.max(
    1,
    ...chartItems.map((item) =>
      Math.max(
        Number(item.plannedManpower) || 0,
        Number(item.actualManpower) || 0,
      ),
    ),
  );
  const total = items.reduce(
    (sum, item) => sum + (Number(item.plannedManpower) || 0),
    0,
  );
  const totalActual = items.reduce(
    (sum, item) => sum + (Number(item.actualManpower) || 0),
    0,
  );
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#dfe7e4] bg-white"}`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
          >
            Plan overview
          </p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
          <p className={`mt-2 text-xs ${muted}`}>
            {totalActual} actual / {total} planned across {items.length} site
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div
          className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] ${muted}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-[#8d939b]" /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-[#54d39f]" /> Actual ok
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-red-500" /> Attention
          </span>
        </div>
      </div>

      <div className="flex h-64 max-w-full items-end gap-2 overflow-x-auto overflow-y-hidden pb-2">
        {chartItems.map((item) => {
          const value = Number(item.plannedManpower) || 0;
          const actual = Number(item.actualManpower) || 0;
          const status = planActualStatus(value, actual);
          const plannedHeight = value ? Math.max(8, (value / max) * 100) : 0;
          const actualHeight = actual ? Math.max(8, (actual / max) * 100) : 0;
          return (
            <div
              key={item.site}
              className="flex min-w-[64px] flex-1 flex-col items-center"
            >
              <div className="mb-2 min-h-9 text-center">
                <p
                  className={`text-sm font-semibold ${status.ok ? "text-emerald-500" : "text-red-500"}`}
                >
                  {actual}
                </p>
                <p className={`text-[10px] ${muted}`}>/{value}</p>
              </div>
              <div className="flex h-36 w-full max-w-[46px] items-end">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-t-[18px] rounded-b-md ${darkMode ? "bg-[#24262b]" : "bg-[#ece9e2]"}`}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t-[18px] ${darkMode ? "bg-white/20" : "bg-[#8d939b]/25"}`}
                    style={{ height: `${plannedHeight}%` }}
                  />
                  <div
                    className={`absolute bottom-0 left-1 right-1 rounded-t-[14px] ${status.ok ? "bg-[#54d39f]" : "bg-red-500"}`}
                    style={{ height: `${actualHeight}%` }}
                  />
                </div>
              </div>
              <p
                className={`mt-3 line-clamp-2 min-h-8 text-center text-[11px] leading-4 ${muted}`}
              >
                {item.site}
              </p>
            </div>
          );
        })}
        {!chartItems.length && (
          <p
            className={`flex flex-1 items-center justify-center py-8 text-center text-sm ${muted}`}
          >
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function ReportDateRangePicker({
  darkMode,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}) {
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState("start");
  const [monthDate, setMonthDate] = useState(() =>
    dateInputToDate(endValue || startValue),
  );
  const [panelStyle, setPanelStyle] = useState({});
  const startDate = dateInputToDate(startValue);
  const endDate = dateInputToDate(endValue);
  useClickOutside(ref, () => setOpen(false));

  const days = useMemo(() => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [monthDate]);

  useEffect(() => {
    if (!open) return undefined;
    function placePanel() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(430, window.innerWidth - 32);
      const left = Math.min(
        Math.max(16, rect.left),
        window.innerWidth - width - 16,
      );
      const belowTop = rect.bottom + 10;
      const aboveTop = Math.max(16, rect.top - 430);
      const top = window.innerHeight - belowTop < 390 ? aboveTop : belowTop;
      setPanelStyle({ left, top, width });
    }
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open]);

  function openPicker(mode) {
    setSelecting(mode);
    setMonthDate(dateInputToDate(mode === "start" ? startValue : endValue));
    setOpen(true);
  }

  function selectDay(day) {
    const value = localDateInputValue(day);
    if (selecting === "start") {
      onStartChange(value);
      if (!endValue || value > endValue) onEndChange(value);
      setSelecting("end");
      return;
    }
    if (value < startValue) {
      onStartChange(value);
      onEndChange(startValue);
    } else {
      onEndChange(value);
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => openPicker("start")}
        className={`flex h-12 w-full min-w-[300px] items-center gap-3 rounded-3xl border px-4 text-left transition ${
          darkMode
            ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10"
            : "border-black/10 bg-white text-black hover:bg-black/[0.03]"
        }`}
      >
        <CalendarDays
          className={`h-4 w-4 shrink-0 ${darkMode ? "text-[#d8f36a]" : "text-indigo-600"}`}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {reportDateLabel(startValue)} - {reportDateLabel(endValue)}
        </span>
      </button>

      {open && (
        <div
          style={panelStyle}
          className={`fixed z-[80] max-h-[min(76vh,430px)] overflow-y-auto rounded-[24px] border p-4 shadow-2xl ${
            darkMode
              ? "border-white/10 bg-[#121317] text-white"
              : "border-black/10 bg-white text-black"
          }`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["start", "Start", startValue],
              ["end", "End", endValue],
            ].map(([mode, label, value]) => (
              <button
                key={mode}
                type="button"
                onClick={() => openPicker(mode)}
                className={`rounded-2xl border px-3 py-2 text-left text-sm ${
                  selecting === mode
                    ? darkMode
                      ? "border-[#d8f36a] bg-[#d8f36a]/10 text-[#d8f36a]"
                      : "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : darkMode
                      ? "border-white/10 bg-white/5"
                      : "border-black/10 bg-black/[0.025]"
                }`}
              >
                <span
                  className={`block text-[10px] uppercase tracking-[0.18em] ${darkMode ? "text-white/45" : "text-black/45"}`}
                >
                  {label}
                </span>
                <span className="mt-1 block font-semibold">
                  {reportDateLabel(value)}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setMonthDate(
                  new Date(
                    monthDate.getFullYear(),
                    monthDate.getMonth() - 1,
                    1,
                  ),
                )
              }
              className="rounded-full px-3 py-2 text-sm"
            >
              {"<"}
            </button>
            <p className="text-lg font-semibold">
              {reportMonthLabel(monthDate)}
            </p>
            <button
              type="button"
              onClick={() =>
                setMonthDate(
                  new Date(
                    monthDate.getFullYear(),
                    monthDate.getMonth() + 1,
                    1,
                  ),
                )
              }
              className="rounded-full px-3 py-2 text-sm"
            >
              {">"}
            </button>
          </div>

          <div
            className={`mt-4 grid grid-cols-7 gap-y-2 text-center text-xs ${darkMode ? "text-white/55" : "text-black/55"}`}
          >
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
            {days.map((day) => {
              const value = localDateInputValue(day);
              const inMonth = day.getMonth() === monthDate.getMonth();
              const selected =
                sameCalendarDay(day, startDate) ||
                sameCalendarDay(day, endDate);
              const inRange = value > startValue && value < endValue;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`mx-auto h-9 w-9 rounded-xl text-sm transition ${
                    selected
                      ? darkMode
                        ? "bg-[#d8f36a] text-black shadow-lg"
                        : "bg-indigo-600 text-white shadow-lg"
                      : inRange
                        ? darkMode
                          ? "bg-[#d8f36a]/10 text-[#d8f36a]"
                          : "bg-indigo-50 text-indigo-700"
                        : inMonth
                          ? darkMode
                            ? "text-white hover:bg-white/10"
                            : "text-black hover:bg-black/[0.04]"
                          : darkMode
                            ? "text-white/25"
                            : "text-black/35"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTable({
  title,
  headers = [],
  rows = [],
  darkMode,
  muted,
  subtitle = "",
  actions = null,
  columnClasses = [],
}) {
  return (
    <section
      className={`overflow-hidden rounded-[26px] border ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
    >
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold">{title}</h4>
          {subtitle && <p className={`mt-1 text-xs ${muted}`}>{subtitle}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {actions}
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
          >
            {rows.length} rows
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table
          className={`w-full min-w-[760px] text-left text-sm ${columnClasses.length ? "table-fixed" : ""}`}
        >
          <thead
            className={
              darkMode
                ? "bg-white/[0.04] text-white/55"
                : "bg-black/[0.035] text-black/55"
            }
          >
            <tr>
              {headers.map((header, headerIndex) => (
                <th
                  key={header}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] ${columnClasses[headerIndex] || ""}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`border-t ${darkMode ? "border-white/10 hover:bg-white/[0.035]" : "border-black/[0.06] hover:bg-black/[0.025]"}`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-5 py-3 align-top ${cellIndex === 0 ? "font-semibold" : ""} ${columnClasses[cellIndex] || ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={headers.length}
                  className={`px-5 py-8 text-center ${muted}`}
                >
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportPlannedValue({ value }) {
  return <span className="font-semibold text-black">{value}</span>;
}

function ReportActualValue({ planned, actual }) {
  const plannedValue = Number(planned) || 0;
  const actualValue = Number(actual) || 0;
  const ok = actualValue >= plannedValue;
  return (
    <span
      className={`font-semibold ${ok ? "text-emerald-600" : "text-red-600"}`}
    >
      {actual}
    </span>
  );
}

function TradeSiteMatrix({
  rows = [],
  dates = [],
  darkMode,
  muted,
  search,
  onSearch,
}) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const query = search.trim().toLowerCase();
  const grouped = rows.reduce((result, item) => {
    if (item.rowType === "average") return result;
    const site = String(item.site || "Unassigned site");
    const trade = String(item.trade || "General");
    if (
      query &&
      !site.toLowerCase().includes(query) &&
      !trade.toLowerCase().includes(query)
    )
      return result;
    const key = `${site}||${trade}`;
    const current = result.get(key) || { site, trade, values: new Map() };
    current.values.set(item.date, item);
    result.set(key, current);
    return result;
  }, new Map());
  const matrixRows = [...grouped.values()];

  return (
    <section
      className={`overflow-hidden rounded-[26px] border ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
    >
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold">Trade by site manpower</h4>
          <p className={`mt-1 text-xs ${muted}`}>{matrixRows.length} rows</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search
            className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`}
          />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search site or trade..."
            className={`h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.035] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black placeholder:text-black/35"}`}
          />
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 2)}
        className="relative overflow-x-auto"
      >
        {scrolled && (
          <div className="pointer-events-none sticky left-[340px] top-0 z-40 float-left h-0 w-0">
            <span className="absolute top-0 block h-[10000px] w-6 bg-gradient-to-r from-black/18 to-transparent" />
          </div>
        )}
        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-sm">
          <thead
            className={
              darkMode
                ? "bg-white/[0.04] text-white/55"
                : "bg-black/[0.035] text-black/55"
            }
          >
            <tr>
              <th
                className={`sticky left-0 z-30 w-[170px] border-b px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-[#f5f4f0]"}`}
              >
                Site
              </th>
              <th
                className={`sticky left-[170px] z-30 w-[170px] border-b px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-[#f5f4f0]"}`}
              >
                Trade
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className={`w-[130px] border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                >
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row) => (
              <tr
                key={`${row.site}-${row.trade}`}
                className={
                  darkMode ? "hover:bg-white/[0.035]" : "hover:bg-black/[0.025]"
                }
              >
                <td
                  className={`sticky left-0 z-20 w-[170px] border-b px-5 py-3 align-top font-semibold ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}
                >
                  {row.site}
                </td>
                <td
                  className={`sticky left-[170px] z-20 w-[170px] border-b px-5 py-3 align-top ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}
                >
                  {row.trade}
                </td>
                {dates.map((date) => {
                  const item = row.values.get(date) || {
                    planned: 0,
                    actual: 0,
                  };
                  return (
                    <td
                      key={date}
                      className={`w-[130px] border-b px-4 py-3 align-top ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                    >
                      <span className="font-semibold text-black">
                        {item.planned}
                      </span>
                      <span className={muted}>/</span>
                      <ReportActualValue
                        planned={item.planned}
                        actual={item.actual}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {!matrixRows.length && (
              <tr>
                <td
                  colSpan={dates.length + 2}
                  className={`px-5 py-8 text-center ${muted}`}
                >
                  No trade/site data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportComparisonBars({
  title,
  subtitle,
  items = [],
  darkMode,
  labelKey = "label",
  limit = 10,
}) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items
    .filter((item) => Number(item.planned) || Number(item.actual))
    .slice(0, limit);
  const max = Math.max(
    1,
    ...chartItems.map((item) =>
      Math.max(Number(item.planned) || 0, Number(item.actual) || 0),
    ),
  );
  return (
    <section
      className={`rounded-[26px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold">{title}</h4>
          {subtitle && <p className={`mt-1 text-xs ${muted}`}>{subtitle}</p>}
        </div>
        <div className={`flex gap-3 text-[11px] ${muted}`}>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-black" /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-emerald-500" /> Actual ok
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-red-500" /> Short
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {chartItems.map((item) => {
          const planned = Number(item.planned) || 0;
          const actual = Number(item.actual) || 0;
          const ok = actual >= planned;
          return (
            <div
              key={`${item[labelKey]}-${item.trade || ""}`}
              className="grid gap-2 lg:grid-cols-[180px_1fr_86px] lg:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {item[labelKey]}
                </p>
                {item.trade && (
                  <p className={`truncate text-[11px] ${muted}`}>
                    {item.trade}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <div
                  className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
                >
                  <div
                    className="h-full rounded-full bg-black"
                    style={{ width: `${Math.max(2, (planned / max) * 100)}%` }}
                  />
                </div>
                <div
                  className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
                >
                  <div
                    className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{
                      width: `${actual ? Math.max(2, (actual / max) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-right text-sm">
                <span className="font-semibold text-black">{planned}</span>
                <span className={muted}> / </span>
                <span
                  className={`font-semibold ${ok ? "text-emerald-600" : "text-red-600"}`}
                >
                  {actual}
                </span>
              </div>
            </div>
          );
        })}
        {!chartItems.length && (
          <p className={`py-8 text-center text-sm ${muted}`}>
            No chart data available for this report.
          </p>
        )}
      </div>
    </section>
  );
}

function ReportDailyTrend({ items = [], darkMode }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items || [];
  const max = Math.max(
    1,
    ...chartItems.map((item) =>
      Math.max(Number(item.planned) || 0, Number(item.actual) || 0),
    ),
  );
  return (
    <section
      className={`rounded-[26px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold">Daily planned vs actual</h4>
          <p className={`mt-1 text-xs ${muted}`}>
            Each date in the selected range, including dates with no data.
          </p>
        </div>
        <div className={`flex gap-3 text-[11px] ${muted}`}>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-black" /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-[#15a8e0]" /> Actual
          </span>
        </div>
      </div>
      <div className="flex h-64 max-w-full items-end gap-3 overflow-x-auto pb-2">
        {chartItems.map((item) => {
          const planned = Number(item.planned) || 0;
          const actual = Number(item.actual) || 0;
          const plannedHeight = planned
            ? Math.max(8, (planned / max) * 100)
            : 0;
          const actualHeight = actual ? Math.max(8, (actual / max) * 100) : 0;
          return (
            <div
              key={item.date}
              className="flex min-w-[58px] flex-1 flex-col items-center"
            >
              <div className="mb-2 text-center">
                <p
                  className={`text-xs font-semibold ${actual >= planned ? "text-emerald-600" : "text-red-600"}`}
                >
                  {actual}
                </p>
                <p className={`text-[10px] ${muted}`}>/{planned}</p>
              </div>
              <div className="flex h-36 w-full max-w-[44px] items-end">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-t-[18px] rounded-b-md ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-[18px] bg-black/35"
                    style={{ height: `${plannedHeight}%` }}
                  />
                  <div
                    className="absolute bottom-0 left-1 right-1 rounded-t-[14px] bg-[#15a8e0]"
                    style={{ height: `${actualHeight}%` }}
                  />
                </div>
              </div>
              <p className={`mt-3 text-center text-[10px] leading-4 ${muted}`}>
                {item.date.slice(5)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReportTradeHeatmap({ items = [], darkMode }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items
    .filter((item) => Number(item.planned) || Number(item.actual))
    .slice(0, 24);
  return (
    <section
      className={`rounded-[26px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
    >
      <div className="mb-5">
        <h4 className="text-lg font-semibold">Trade by site attention map</h4>
        <p className={`mt-1 text-xs ${muted}`}>
          Top site/trade combinations by planned manpower.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {chartItems.map((item) => {
          const planned = Number(item.planned) || 0;
          const actual = Number(item.actual) || 0;
          const progress = planned
            ? Math.min(100, Math.round((actual / planned) * 100))
            : actual
              ? 100
              : 0;
          const ok = actual >= planned;
          return (
            <div
              key={`${item.site}-${item.trade}`}
              className={`rounded-[18px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/[0.06] bg-[#f7f5ef]"}`}
            >
              <p className="truncate text-sm font-semibold">{item.site}</p>
              <p className={`mt-1 truncate text-xs ${muted}`}>{item.trade}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold text-black">{planned}</p>
                <p
                  className={`text-2xl font-semibold ${ok ? "text-emerald-600" : "text-red-600"}`}
                >
                  {actual}
                </p>
              </div>
              <div
                className={`mt-3 h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.08]"}`}
              >
                <div
                  className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
        {!chartItems.length && (
          <p
            className={`py-8 text-center text-sm sm:col-span-2 xl:col-span-4 ${muted}`}
          >
            No trade/site chart data available.
          </p>
        )}
      </div>
    </section>
  );
}

function PlanCeoView({
  activePlan,
  activePlanTitle,
  activeTomorrowSite,
  tomorrowPlanSites = [],
  darkMode,
}) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const line = darkMode ? "border-white/10" : "border-black/[0.07]";
  const head = darkMode
    ? "bg-white/[0.04] text-white/55"
    : "bg-black/[0.035] text-black/55";
  const rowHover = darkMode
    ? "hover:bg-white/[0.035]"
    : "hover:bg-black/[0.025]";
  const totalPlanned =
    activeTomorrowSite?.plannedManpower ??
    activePlan?.summary?.plannedManpower ??
    0;
  const totalActual =
    activeTomorrowSite?.actualManpower ??
    activePlan?.actuals?.actualManpower ??
    0;
  const totalStatus = planActualStatus(totalPlanned, totalActual);
  const detailRecords = (
    activeTomorrowSite?.records ||
    activePlan?.records ||
    []
  )
    .slice()
    .sort((a, b) => {
      const peopleA =
        a.plannedManpower !== null && a.plannedManpower !== undefined
          ? Number(a.plannedManpower) || 0
          : -1;
      const peopleB =
        b.plannedManpower !== null && b.plannedManpower !== undefined
          ? Number(b.plannedManpower) || 0
          : -1;
      return (
        peopleB - peopleA ||
        String(a.site || "").localeCompare(String(b.site || "")) ||
        String(a.category || "").localeCompare(String(b.category || ""))
      );
    });
  const visibleSites = activeTomorrowSite
    ? [activeTomorrowSite]
    : tomorrowPlanSites;
  const attentionCount = visibleSites.filter(
    (site) => !planActualStatus(site.plannedManpower, site.actualManpower).ok,
  ).length;
  const siteColumns = (
    visibleSites.length
      ? visibleSites.map((site) => site.site)
      : Array.from(
          new Set(detailRecords.map((record) => record.site || "Unassigned")),
        )
  ).filter(Boolean);
  const actualByTradeSite = new Map(
    (activePlan?.actuals?.tradeSiteBreakdown || []).map((item) => [
      `${comparablePlanText(item.site)}|${comparableTradeText(item.trade)}`,
      Number(item.actual) || 0,
    ]),
  );
  const tradeRows = Array.from(
    detailRecords
      .reduce((map, record) => {
        const trade = record.category || "General";
        const site = record.site || "Unassigned";
        const item = map.get(trade) || {
          trade,
          totalPeople: 0,
          totalItems: 0,
          cells: new Map(),
        };
        const cell = item.cells.get(site) || { people: 0, items: 0, works: [] };
        const people = Number(record.plannedManpower) || 0;
        cell.people += people;
        cell.items += 1;
        if (record.work || record.raw)
          cell.works.push(record.work || record.raw);
        item.totalPeople += people;
        item.totalItems += 1;
        item.cells.set(site, cell);
        map.set(trade, item);
        return map;
      }, new Map())
      .values(),
  ).sort(
    (a, b) => b.totalPeople - a.totalPeople || a.trade.localeCompare(b.trade),
  );
  const tradeActualTotal = (trade) =>
    siteColumns.reduce(
      (sum, site) =>
        sum +
        (actualByTradeSite.get(
          `${comparablePlanText(site)}|${comparableTradeText(trade)}`,
        ) || 0),
      0,
    );

  return (
    <div className="space-y-4 transition-all duration-300 ease-out">
      <section
        className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}
      >
        <div
          className={`grid gap-px ${darkMode ? "bg-white/10" : "bg-black/[0.06]"} sm:grid-cols-4`}
        >
          {[
            ["Planned", totalPlanned],
            ["Actual", totalActual],
            [
              "Variance",
              `${totalStatus.variance >= 0 ? "+" : ""}${totalStatus.variance}`,
            ],
            ["Needs attention", attentionCount],
          ].map(([label, value]) => (
            <div
              key={label}
              className={`px-5 py-4 ${darkMode ? "bg-[#111216]" : "bg-white"}`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}
              >
                {label}
              </p>
              <p
                className={`mt-1 text-3xl font-semibold leading-none ${label === "Actual" ? (totalStatus.ok ? "text-emerald-600" : "text-red-600") : ""}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p
              className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${muted}`}
            >
              CEO summary
            </p>
            <h4 className="mt-1 text-base font-semibold">
              {activePlanTitle} trade by site
            </h4>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
          >
            {siteColumns.length} sites · {tradeRows.length} trades
          </span>
        </div>
        <div className="max-h-[58vh] overflow-auto px-3 pb-3">
          <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-xs">
            <thead className={head}>
              <tr>
                <th
                  className={`sticky left-0 top-0 z-30 min-w-[120px] border-b px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${line} ${darkMode ? "bg-[#191b20]" : "bg-[#f4f3ef]"}`}
                >
                  Trade
                </th>
                {siteColumns.map((site) => (
                  <th
                    key={site}
                    className={`sticky top-0 z-20 min-w-[112px] max-w-[150px] whitespace-normal break-words border-b px-2.5 py-2 text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] ${line} ${darkMode ? "bg-[#191b20]" : "bg-[#f4f3ef]"}`}
                  >
                    {site}
                  </th>
                ))}
                <th
                  className={`sticky top-0 z-20 min-w-[90px] border-b px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${line} ${darkMode ? "bg-[#191b20]" : "bg-[#f4f3ef]"}`}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tradeRows.map((trade) => (
                <tr key={trade.trade} className={rowHover}>
                  <td
                    className={`sticky left-0 z-10 border-b px-2.5 py-2 font-semibold ${line} ${darkMode ? "bg-[#111216]" : "bg-white"}`}
                  >
                    {trade.trade}
                  </td>
                  {siteColumns.map((site) => {
                    const cell = trade.cells.get(site);
                    const actual =
                      actualByTradeSite.get(
                        `${comparablePlanText(site)}|${comparableTradeText(trade.trade)}`,
                      ) || 0;
                    const actualOk = actual >= (Number(cell?.people) || 0);
                    return (
                      <td
                        key={`${trade.trade}-${site}`}
                        className={`border-b px-2.5 py-2 align-middle ${line}`}
                      >
                        {cell ? (
                          <div className="flex items-baseline gap-1.5">
                            <p className="text-base font-semibold leading-none">
                              {cell.people}
                              <span className={muted}>/</span>
                              <span
                                className={
                                  actualOk ? "text-emerald-600" : "text-red-600"
                                }
                              >
                                {actual}
                              </span>
                            </p>
                            <p className={`text-[10px] ${muted}`}>
                              {cell.items}i
                            </p>
                          </div>
                        ) : (
                          <span className={muted}>-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`border-b px-2.5 py-2 align-middle ${line}`}>
                    <div className="flex items-baseline gap-1.5">
                      {(() => {
                        const actualTotal = tradeActualTotal(trade.trade);
                        const actualOk =
                          actualTotal >= (Number(trade.totalPeople) || 0);
                        return (
                          <p className="text-base font-semibold leading-none">
                            {trade.totalPeople}
                            <span className={muted}>/</span>
                            <span
                              className={
                                actualOk ? "text-emerald-600" : "text-red-600"
                              }
                            >
                              {actualTotal}
                            </span>
                          </p>
                        );
                      })()}
                      <p className={`text-[10px] ${muted}`}>
                        {trade.totalItems}i
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
              {!tradeRows.length && (
                <tr>
                  <td
                    colSpan={siteColumns.length + 2}
                    className={`px-4 py-8 text-center ${muted}`}
                  >
                    No trade and site plan data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}
            >
              Work plan
            </p>
            <h4 className="mt-1 text-lg font-semibold">
              {activeTomorrowSite?.site || "All sites"}
            </h4>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
          >
            {detailRecords.length} items
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className={head}>
              <tr>
                {[
                  "Site",
                  "Trade",
                  "People",
                  "Work planned",
                  "By",
                  "Timestamp",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailRecords.map((record) => (
                <tr
                  key={record.id}
                  className={`border-t align-top ${line} ${rowHover}`}
                >
                  <td className="max-w-[200px] px-5 py-3 font-semibold">
                    {record.site || "Unassigned"}
                  </td>
                  <td className="px-5 py-3">{record.category || "General"}</td>
                  <td className="px-5 py-3 text-lg font-semibold">
                    {record.plannedManpower ?? "-"}
                  </td>
                  <td className="max-w-[420px] px-5 py-3 leading-6">
                    {record.work || record.raw || "No work note added."}
                  </td>
                  <td className={`max-w-[160px] px-5 py-3 ${muted}`}>
                    {record.submittedBy || "Unknown"}
                  </td>
                  <td className={`whitespace-nowrap px-5 py-3 ${muted}`}>
                    {record.timestamp || record.submittedDate || "-"}
                  </td>
                </tr>
              ))}
              {!detailRecords.length && (
                <tr>
                  <td colSpan={6} className={`px-5 py-8 text-center ${muted}`}>
                    No work items available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function DmrDashboard({ darkMode }) {
  const [date, setDate] = useState(() => localDateInputValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [addingRow, setAddingRow] = useState("");
  const [pendingRows, setPendingRows] = useState({
    equipment: [],
    materials: [],
    notes: [],
  });
  const [siteFilter, setSiteFilter] = useState("all");
  const [agencySearch, setAgencySearch] = useState("");
  const [fillTab, setFillTab] = useState("manpower");
  const [detailSection, setDetailSection] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [planMode, setPlanMode] = useState(null);
  const [ceoPlanView, setCeoPlanView] = useState(false);
  const [selectedTomorrowSite, setSelectedTomorrowSite] = useState("");
  const [dmrSheetLink, setDmrSheetLink] = useState("");
  const [dmrSheetSaving, setDmrSheetSaving] = useState(false);
  const [dmrSheetOpen, setDmrSheetOpen] = useState(false);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportClosing, setReportClosing] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPdfLoading, setReportPdfLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportStartDate, setReportStartDate] = useState(() =>
    addDaysInput(localDateInputValue(), -6),
  );
  const [reportEndDate, setReportEndDate] = useState(() =>
    localDateInputValue(),
  );
  const [reportSections, setReportSections] = useState(() =>
    DMR_REPORT_SECTION_OPTIONS.map((option) => option.id),
  );
  const [reportTradeSearch, setReportTradeSearch] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSending, setReminderSending] = useState("");
  const [reminderContacts, setReminderContacts] = useState([]);
  const [reminderTypes, setReminderTypes] = useState([]);
  const [reminderStatus, setReminderStatus] = useState({});
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    reminders: {},
  });
  const [heroActionOpen, setHeroActionOpen] = useState(false);
  const heroActionRef = useRef(null);

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode
    ? "border-white/10 bg-white/[0.025]"
    : "border-[#dfe7e4] bg-white";
  const dmrSheetLinked = Boolean(data?.dmrSettings?.linked);
  const canFillDmr = Boolean(data?.canEdit && dmrSheetLinked);
  useClickOutside(heroActionRef, () => setHeroActionOpen(false));

  const closeReportDrawer = useCallback(() => {
    setReportClosing(true);
    window.setTimeout(() => {
      setReportOpen(false);
      setReportClosing(false);
      setReportExpanded(false);
    }, 280);
  }, []);

  useEffect(() => {
    if (!reportOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeReportDrawer();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeReportDrawer, reportOpen]);

  async function openReminderDrawer() {
    setReminderOpen(true);
    setReminderLoading(true);
    try {
      const result = await api(`/dmr-dashboard/reminders/settings?date=${encodeURIComponent(date)}`);
      setReminderSettings(result.settings || { enabled: true, reminders: {} });
      setReminderContacts(result.contacts || []);
      setReminderTypes(result.reminderTypes || []);
      setReminderStatus(result.status || {});
    } catch (error) {
      toast.error(error.message || "Could not load DMR reminders");
    } finally {
      setReminderLoading(false);
    }
  }

  function updateDmrReminder(type, patch) {
    setReminderSettings((current) => ({
      ...current,
      reminders: {
        ...(current.reminders || {}),
        [type]: {
          ...((current.reminders || {})[type] || {}),
          ...patch,
        },
      },
    }));
  }

  function toggleDmrReminderContact(type, phone) {
    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    if (!normalizedPhone) return;
    setReminderSettings((current) => {
      const reminder = (current.reminders || {})[type] || {};
      const selected = new Set(reminder.recipientPhones || []);
      if (selected.has(normalizedPhone)) selected.delete(normalizedPhone);
      else selected.add(normalizedPhone);
      return {
        ...current,
        reminders: {
          ...(current.reminders || {}),
          [type]: { ...reminder, recipientPhones: [...selected] },
        },
      };
    });
  }

  async function saveDmrReminderSchedule(event) {
    event?.preventDefault?.();
    if (reminderSaving) return;
    setReminderSaving(true);
    try {
      const result = await api("/dmr-dashboard/reminders/settings", {
        method: "PATCH",
        body: JSON.stringify(reminderSettings),
      });
      setReminderSettings(result.settings || reminderSettings);
      toast.success("DMR reminder schedule saved");
      setReminderOpen(false);
    } catch (error) {
      toast.error(error.message || "Could not save DMR reminders");
    } finally {
      setReminderSaving(false);
    }
  }

  async function sendDmrReminderNow(type) {
    if (reminderSending) return;
    setReminderSending(type);
    try {
      const result = await api("/dmr-dashboard/reminders/send-now", {
        method: "POST",
        body: JSON.stringify({ type, date }),
      });
      const reminder = result.reminder || {};
      setReminderStatus((current) => ({ ...current, [type]: reminder }));
      toast.success(`${reminder.sent || 0} sent, ${reminder.failed || 0} failed, ${reminder.skipped || 0} skipped`);
    } catch (error) {
      toast.error(error.message || "Could not send DMR reminder");
    } finally {
      setReminderSending("");
    }
  }

  const load = useCallback(
    async (quiet = false, force = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        const result = await api(
          `/dmr-dashboard?date=${encodeURIComponent(date)}${force ? "&force=true" : ""}`,
        );
        setData(result);
        setDrafts({});
        setPendingRows({ equipment: [], materials: [], notes: [] });
      } catch (error) {
        toast.error(error.message || "Could not load DMR");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const records = useMemo(
    () => data?.today?.records || [],
    [data?.today?.records],
  );
  const todayPlanLookup = useMemo(() => {
    const lookup = new Map();
    for (const item of data?.todayPlan?.records || []) {
      const siteKey = comparablePlanText(item.site);
      const tradeKey = comparableTradeText(item.category);
      const planned = Number(item.plannedManpower) || 0;
      if (!siteKey || !tradeKey || planned <= 0) continue;
      const key = `${siteKey}|${tradeKey}`;
      lookup.set(key, (lookup.get(key) || 0) + planned);
    }
    return lookup;
  }, [data?.todayPlan?.records]);

  const displayRecords = useMemo(
    () =>
      records.map((record) => {
        if (record.plannedFilled || Number(record.planned) > 0) return record;
        const key = `${comparablePlanText(record.site)}|${comparableTradeText(record.agency)}`;
        const planned = todayPlanLookup.get(key) || 0;
        if (!planned) return record;
        const actual = Number(record.actual) || 0;
        return {
          ...record,
          planned,
          variance: actual - planned,
          plannedFromTodayPlan: true,
        };
      }),
    [records, todayPlanLookup],
  );
  const siteManpowerBreakdown = useMemo(
    () => manpowerBreakdown(displayRecords, "site"),
    [displayRecords],
  );
  const agencyManpowerBreakdown = useMemo(
    () => manpowerBreakdown(displayRecords, "agency"),
    [displayRecords],
  );

  const filteredRecords = useMemo(() => {
    const query = agencySearch.trim().toLowerCase();
    return records.filter((record) => {
      if (siteFilter !== "all" && record.site !== siteFilter) return false;
      if (query && !record.agency.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [agencySearch, records, siteFilter]);
  const fillSiteOptions = useMemo(() => {
    const sites = data?.today?.sites || [];
    const counts = records.reduce((result, record) => {
      const key = record.site || "Unassigned site";
      result.set(key, (result.get(key) || 0) + 1);
      return result;
    }, new Map());
    return [
      { value: "all", label: "All sites", count: records.length },
      ...sites.map((site) => ({
        value: site,
        label: site,
        count: counts.get(site) || 0,
      })),
    ];
  }, [data?.today?.sites, records]);

  const projectManpowerCards = useMemo(() => {
    const query = agencySearch.trim().toLowerCase();
    return [
      ...displayRecords
        .reduce((result, record) => {
          if (siteFilter !== "all" && record.site !== siteFilter) return result;
          const key = record.site || "Unassigned site";
          const current = result.get(key) || {
            id: key,
            site: key,
            planned: 0,
            actual: 0,
            variance: 0,
            agencies: new Set(),
            rows: [],
          };
          current.planned += Number(record.planned) || 0;
          current.actual += Number(record.actual) || 0;
          current.variance = current.actual - current.planned;
          if (record.agency) current.agencies.add(record.agency);
          current.rows.push(record);
          result.set(key, current);
          return result;
        }, new Map())
        .values(),
    ]
      .map((project) => ({
        ...project,
        agencies: [...project.agencies].sort((a, b) => a.localeCompare(b)),
        progress: project.planned
          ? Math.min(100, Math.round((project.actual / project.planned) * 100))
          : project.actual
            ? 100
            : 0,
      }))
      .filter((project) => {
        if (!query) return true;
        return (
          project.site.toLowerCase().includes(query) ||
          project.agencies.some((agency) =>
            agency.toLowerCase().includes(query),
          )
        );
      })
      .sort(
        (a, b) =>
          b.actual - a.actual ||
          b.planned - a.planned ||
          a.site.localeCompare(b.site),
      );
  }, [agencySearch, displayRecords, siteFilter]);

  const activePlan =
    planMode === "today" ? data?.todayPlan || null : data?.tomorrowPlan || null;
  const activePlanTitle =
    planMode === "today" ? "Today’s Plan" : "Tomorrow’s Plan";
  const activePlanHeading =
    planMode === "today"
      ? "Today’s manpower & work plan"
      : "Next day manpower & work plan";
  const activePlanSummaryText =
    planMode === "today"
      ? "Total planned manpower scheduled for the selected DMR date."
      : "Total planned manpower extracted for the next DMR date.";
  const tomorrowPlanSites = useMemo(() => {
    const records = activePlan?.records || [];
    const actualBySite = new Map(
      (activePlan?.actuals?.siteBreakdown || []).map((item) => [
        comparablePlanText(item.site),
        Number(item.actual) || 0,
      ]),
    );
    return [
      ...records
        .reduce((result, record) => {
          const site = record.site || "Unassigned site";
          const item = result.get(site) || {
            site,
            records: [],
            plannedManpower: 0,
            actualManpower: 0,
            variance: 0,
            categories: new Set(),
            submitters: new Set(),
          };
          item.records.push(record);
          item.plannedManpower += Number(record.plannedManpower) || 0;
          if (record.category) item.categories.add(record.category);
          if (record.submittedBy) item.submitters.add(record.submittedBy);
          result.set(site, item);
          return result;
        }, new Map())
        .values(),
    ]
      .map((site) => {
        const actualManpower =
          actualBySite.get(comparablePlanText(site.site)) || 0;
        return {
          ...site,
          actualManpower,
          variance: actualManpower - site.plannedManpower,
          categories: [...site.categories],
          submitters: [...site.submitters],
        };
      })
      .sort((a, b) => {
        const statusA = planActualStatus(a.plannedManpower, a.actualManpower);
        const statusB = planActualStatus(b.plannedManpower, b.actualManpower);
        return (
          Number(statusA.ok) - Number(statusB.ok) ||
          b.plannedManpower - a.plannedManpower ||
          b.records.length - a.records.length ||
          a.site.localeCompare(b.site)
        );
      });
  }, [activePlan?.actuals?.siteBreakdown, activePlan?.records]);
  const activeTomorrowSite = useMemo(() => {
    return selectedTomorrowSite
      ? tomorrowPlanSites.find((site) => site.site === selectedTomorrowSite) ||
          null
      : null;
  }, [selectedTomorrowSite, tomorrowPlanSites]);
  const activePlanStatus = planActualStatus(
    activePlan?.summary?.plannedManpower || 0,
    activePlan?.actuals?.actualManpower || 0,
  );
  const activePlanProgress = activePlanStatus.planned
    ? Math.round((activePlanStatus.actual / activePlanStatus.planned) * 100)
    : activePlanStatus.actual
      ? 100
      : 0;
  const attentionPlanSites = tomorrowPlanSites.filter(
    (site) => !planActualStatus(site.plannedManpower, site.actualManpower).ok,
  );
  const activePlanTimeliness = activePlan?.timelinessBySubmitter || [];
  const hasDraftKey = (record, key) =>
    Object.prototype.hasOwnProperty.call(drafts[record.id] || {}, key);
  const autoPlannedForRecord = (record) => {
    if (
      !canFillDmr ||
      !todayPlanLookup.size ||
      hasDraftKey(record, "planned") ||
      record.plannedFilled ||
      Number(record.planned) > 0
    )
      return "";
    const key = `${comparablePlanText(record.site)}|${comparableTradeText(record.agency)}`;
    return todayPlanLookup.get(key) || "";
  };
  const hasAutoPlannedDrafts = records.some((record) =>
    autoPlannedForRecord(record),
  );
  const valueFor = (record, key) => {
    if (key === "planned") {
      const autoPlanned = autoPlannedForRecord(record);
      if (autoPlanned !== "") return autoPlanned;
    }
    return drafts[record.id]?.[key] ?? record[key] ?? "";
  };
  const updateDraft = (record, key, value) => {
    setDrafts((current) => ({
      ...current,
      [record.id]: {
        ...(current[record.id] || {}),
        id: record.id,
        rowNumber: record.rowNumber,
        plannedColumn: record.plannedColumn,
        actualColumn: record.actualColumn,
        siteColumn: record.siteColumn,
        detailsColumn: record.detailsColumn,
        quantityColumn: record.quantityColumn,
        unitColumn: record.unitColumn,
        noteColumn: record.noteColumn,
        statusColumn: record.statusColumn,
        planned: current[record.id]?.planned ?? record.planned,
        actual: current[record.id]?.actual ?? record.actual,
        site: current[record.id]?.site ?? record.site,
        details: current[record.id]?.details ?? record.details,
        quantity: current[record.id]?.quantity ?? record.quantity,
        unit: current[record.id]?.unit ?? record.unit,
        note: current[record.id]?.note ?? record.note,
        status: current[record.id]?.status ?? record.status,
        [key]: value,
        ...(key === "planned" ? { _autoPlannedFromTodayPlan: false } : {}),
      },
    }));
  };

  async function saveDmr() {
    try {
      setSaving(true);
      const submissionId = `dmr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const draftValues = Object.values(drafts);
      for (const record of records) {
        const autoPlanned = autoPlannedForRecord(record);
        if (autoPlanned === "") continue;
        const existingIndex = draftValues.findIndex(
          (item) => item.id === record.id,
        );
        const autoUpdate = {
          id: record.id,
          rowNumber: record.rowNumber,
          plannedColumn: record.plannedColumn,
          actualColumn: record.actualColumn,
          planned: autoPlanned,
          actual: drafts[record.id]?.actual ?? record.actual,
        };
        if (existingIndex >= 0) {
          draftValues[existingIndex] = {
            ...draftValues[existingIndex],
            ...autoUpdate,
          };
        } else {
          draftValues.push(autoUpdate);
        }
      }
      const newRows = draftValues.filter((item) =>
        String(item.id || "").startsWith("temp:"),
      );
      const existingUpdates = draftValues.filter(
        (item) => !String(item.id || "").startsWith("temp:"),
      );
      for (const row of newRows) {
        await api("/dmr-dashboard/section-row", {
          method: "POST",
          body: JSON.stringify({
            date,
            section: row.section,
            values: row,
            submissionId,
          }),
        });
      }
      if (existingUpdates.length) {
        await api("/dmr-dashboard", {
          method: "PATCH",
          body: JSON.stringify({
            date,
            updates: existingUpdates,
            submissionId,
          }),
        });
      }
      toast.success("DMR saved to Google Sheet");
      setFillOpen(false);
      await load(true, true);
    } catch (error) {
      toast.error(error.message || "Could not save DMR");
    } finally {
      setSaving(false);
    }
  }

  async function linkDmrSheet() {
    try {
      setDmrSheetSaving(true);
      const result = await api("/dmr-dashboard/settings", {
        method: "PUT",
        body: JSON.stringify({ spreadsheetId: dmrSheetLink }),
      });
      toast.success("DMR sheet linked");
      setData((current) =>
        current ? { ...current, dmrSettings: result.settings } : current,
      );
      setDmrSheetLink("");
      await load(true, true);
    } catch (error) {
      toast.error(error.message || "Could not link DMR sheet");
    } finally {
      setDmrSheetSaving(false);
    }
  }

  async function unlinkDmrSheet() {
    try {
      setDmrSheetSaving(true);
      const result = await api("/dmr-dashboard/settings", { method: "DELETE" });
      toast.success("DMR sheet unlinked");
      setUnlinkConfirmOpen(false);
      setData((current) =>
        current ? { ...current, dmrSettings: result.settings } : current,
      );
      await load(true, true);
    } catch (error) {
      toast.error(error.message || "Could not unlink DMR sheet");
    } finally {
      setDmrSheetSaving(false);
    }
  }

  function addSectionRow(section) {
    const id = `temp:${section}:${Date.now()}`;
    const baseRow = {
      id,
      section,
      rowNumber: "New",
      site: "",
      details: "",
      quantity: "",
      unit: "",
      note: "",
    };
    setAddingRow(section);
    setPendingRows((current) => ({
      ...current,
      [section]: [...(current[section] || []), baseRow],
    }));
    setDrafts((current) => ({ ...current, [id]: baseRow }));
    window.setTimeout(() => setAddingRow(""), 200);
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const result = await api(
        `/dmr-dashboard/history?date=${encodeURIComponent(date)}&limit=150`,
      );
      setHistoryItems(result.history || []);
      setSelectedHistory(null);
    } catch (error) {
      toast.error(error.message || "Could not load DMR history");
    } finally {
      setHistoryLoading(false);
    }
  }

  function setReportPreset(preset) {
    const today = localDateInputValue();
    if (preset === "weekly") {
      setReportStartDate(addDaysInput(today, -6));
      setReportEndDate(today);
    } else if (preset === "monthly") {
      setReportStartDate(today.slice(0, 8) + "01");
      setReportEndDate(today);
    } else if (preset === "selectedWeek") {
      setReportStartDate(addDaysInput(date, -6));
      setReportEndDate(date);
    }
  }

  function toggleReportSection(sectionId) {
    setReportSections((current) =>
      current.includes(sectionId)
        ? current.filter((item) => item !== sectionId)
        : [...current, sectionId],
    );
  }

  async function generateDmrReport() {
    try {
      setReportLoading(true);
      const sections = (
        reportSections.length
          ? reportSections
          : DMR_REPORT_SECTION_OPTIONS.map((option) => option.id)
      ).join(",");
      const result = await api(
        `/dmr-dashboard/report?startDate=${encodeURIComponent(reportStartDate)}&endDate=${encodeURIComponent(reportEndDate)}&sections=${encodeURIComponent(sections)}`,
      );
      setReportData(result);
    } catch (error) {
      toast.error(error.message || "Could not generate DMR report");
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadDmrReportPdf() {
    const pdfDate = date || localDateInputValue();
    try {
      setReportPdfLoading(true);
      const response = await fetch(
        `${API_URL}/dmr-dashboard/report/pdf?date=${encodeURIComponent(pdfDate)}`,
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not download DMR PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dmr-ceo-report-${pdfDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("DMR PDF downloaded");
    } catch (error) {
      toast.error(error.message || "Could not download DMR PDF");
    } finally {
      setReportPdfLoading(false);
    }
  }

  function openHistory() {
    setHistoryOpen(true);
    void loadHistory();
  }

  const attendanceSummary = useMemo(() => {
    const rows = data?.today?.staffAttendance || [];
    return rows.reduce(
      (result, item) => {
        const status = String(item.status || "")
          .trim()
          .toLowerCase();
        if (status === "p") result.present += 1;
        else if (status === "a") result.absent += 1;
        else result.pending += 1;
        return result;
      },
      { present: 0, absent: 0, pending: 0, total: rows.length },
    );
  }, [data?.today?.staffAttendance]);

  const sectionCards = useMemo(() => {
    const equipment = (data?.today?.equipment || []).filter(
      (item) => item.site || item.details || item.quantity,
    );
    const materials = (data?.today?.materials || []).filter(
      (item) => item.site || item.details || item.unit || item.quantity,
    );
    const notes = (data?.today?.notes || []).filter((item) => item.note);
    const staff = data?.today?.staffAttendance || [];
    return [
      {
        id: "equipment",
        eyebrow: "Equipment & tools",
        title: `${equipment.length} ${equipment.length === 1 ? "entry" : "entries"}`,
        hint: equipment[0]?.details || "Tools and machinery details",
        chip: "Machinery",
        accent: "bg-[#ff7a2f]",
        soft: darkMode
          ? "bg-[#ff7a2f]/10 text-orange-200"
          : "bg-orange-50 text-orange-700",
        count: equipment.length,
        items: equipment,
      },
      {
        id: "materials",
        eyebrow: "Materials",
        title: `${materials.length} ${materials.length === 1 ? "entry" : "entries"}`,
        hint: materials[0]?.details || "Material issue and quantity details",
        chip: "Stock",
        accent: "bg-[#f2c94c]",
        soft: darkMode
          ? "bg-[#f2c94c]/10 text-yellow-200"
          : "bg-yellow-50 text-yellow-700",
        count: materials.length,
        items: materials,
      },
      {
        id: "notes",
        eyebrow: "Notes",
        title: `${notes.length} ${notes.length === 1 ? "note" : "notes"}`,
        hint: notes[0]?.note || "Site remarks and reminders",
        chip: "Remarks",
        accent: "bg-[#63d5bd]",
        soft: darkMode
          ? "bg-[#63d5bd]/10 text-teal-200"
          : "bg-teal-50 text-teal-700",
        count: notes.length,
        items: notes,
      },
      {
        id: "attendance",
        eyebrow: "Project staff attendance",
        title: `${attendanceSummary.present}/${attendanceSummary.total} present`,
        hint: `${attendanceSummary.absent} absent · ${attendanceSummary.pending} pending`,
        chip: "Team",
        accent: "bg-[#15a8e0]",
        soft: darkMode
          ? "bg-[#15a8e0]/10 text-sky-200"
          : "bg-sky-50 text-sky-700",
        count: staff.filter((item) => String(item.status || "").trim()).length,
        items: staff,
      },
    ];
  }, [
    attendanceSummary,
    darkMode,
    data?.today?.equipment,
    data?.today?.materials,
    data?.today?.notes,
    data?.today?.staffAttendance,
  ]);

  const activeDetail = sectionCards.find((item) => item.id === detailSection);
  const fillEquipmentRows = [
    ...(data?.today?.equipment || []),
    ...(pendingRows.equipment || []),
  ];
  const fillMaterialRows = [
    ...(data?.today?.materials || []),
    ...(pendingRows.materials || []),
  ];
  const fillNoteRows = [
    ...(data?.today?.notes || []),
    ...(pendingRows.notes || []),
  ];
  const fillAttendanceSummary = (data?.today?.staffAttendance || []).reduce(
    (result, item) => {
      const status = String(valueFor(item, "status") || "")
        .trim()
        .toLowerCase();
      if (status === "p") result.present += 1;
      else if (status === "a") result.absent += 1;
      else result.pending += 1;
      return result;
    },
    { present: 0, absent: 0, pending: 0 },
  );

  if (loading) {
    return (
      <div
        className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`}
      >
        <div
          className={`w-full max-w-2xl rounded-[30px]  p-7 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}
        >
          <div className="flex items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span
                className={`absolute inset-0 animate-ping rounded-full opacity-20 ${darkMode ? "bg-[#d8f36a]" : "bg-black"}`}
              />
              <span
                className={`absolute inset-1 animate-pulse rounded-full ${darkMode ? "bg-[#d8f36a]/15" : "bg-black/[0.06]"}`}
              />
              <span
                className={`relative flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}
              >
                <FileSpreadsheet className="h-5 w-5" />
              </span>
            </span>
            <div>
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}
              >
                DMR workspace
              </p>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
                Opening today&apos;s live manpower sheet
                <span
                  className="inline-flex items-center gap-1 pt-1"
                  aria-hidden="true"
                >
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
                  />
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:120ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
                  />
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:240ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
                  />
                </span>
              </h2>
              <p className={`mt-2 text-sm ${muted}`}>
                If today&apos;s tab is missing, it will be created automatically
                from the latest DMR format.
              </p>
            </div>
          </div>
          <div
            className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
          >
            <div
              className={`h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`}
    >
      <div className="mx-auto w-full">
        <div
          className={`relative z-30 mb-8 overflow-visible rounded-[26px] p-5 sm:rounded-[30px] sm:p-8 ${darkMode ? "border-white/10 bg-[#151612]" : "border-[#dfe7e4] bg-white/95"}`}
        >
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium ${darkMode ? "border-white/10 bg-white/5 text-white/65" : "border-[#dfe7e4] bg-[#e8f6ee] text-[#0f6b49]"}`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Projects · DMR
              </span>
              <h2 className="mt-5 max-w-3xl small text-[2.35rem] font-semibold leading-[0.98] tracking-tight sm:text-4xl lg:text-4xl">
                Daily manpower, made simple.
              </h2>
              <p className={`mt-3 max-w-4xl text-sm leading-6 sm:text-base ${muted}`}>
                Live planned vs actual attendance across all sites and agencies.
                Fill today&apos;s DMR without touching spreadsheet cells.
              </p>
            </div>
            <div className="relative z-40 flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:items-end">
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                <button
                  onClick={() => {
                    setFillTab("manpower");
                    setFillOpen(true);
                  }}
                  className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-3xl px-4 text-sm font-medium sm:h-12 sm:shrink-0 sm:px-5 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#10a66b] text-white"}`}
                >
                  <CalendarDays className="h-4 w-4" /> Fill DMR
                </button>
                <div ref={heroActionRef} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setHeroActionOpen((value) => !value)}
                    className={`flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-3xl border px-4 text-sm font-semibold transition active:scale-[0.98] sm:h-12 sm:w-auto sm:shrink-0 sm:px-5 ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}
                  >
                    <Settings2 className="h-4 w-4" />
                    Actions
                    <ChevronDown className={`h-4 w-4 transition-transform ${heroActionOpen ? "rotate-180" : ""}`} />
                  </button>
                  {heroActionOpen && (
                    <div className={`absolute right-0 top-[calc(100%+10px)] z-[120] w-[286px] overflow-hidden rounded-[22px] border p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
                      {[
                        {
                          label: "CEO Report",
                          helper: "Download and preview DMR PDF",
                          icon: FileSpreadsheet,
                          onClick: () => {
                            setReportClosing(false);
                            setReportOpen(true);
                          },
                        },
                        {
                          label: "Today's Plan",
                          helper: "Review current manpower plan",
                          icon: CalendarDays,
                          onClick: () => {
                            setSelectedTomorrowSite("");
                            setPlanMode("today");
                          },
                        },
                        {
                          label: "Tomorrow's Plan",
                          helper: "Review next day manpower plan",
                          icon: CalendarDays,
                          onClick: () => {
                            setSelectedTomorrowSite("");
                            setPlanMode("tomorrow");
                          },
                        },
                        {
                          label: "Reminders",
                          helper: "WhatsApp DMR reminder timing",
                          icon: BellRing,
                          onClick: openReminderDrawer,
                          danger: true,
                        },
                        {
                          label: refreshing ? "Refreshing..." : "Refresh",
                          helper: "Sync latest DMR data",
                          icon: RefreshCw,
                          disabled: refreshing,
                          onClick: () => load(true, true),
                          spin: refreshing,
                        },
                        ...(data?.canViewHistory ? [{
                          label: "History",
                          helper: "View DMR version changes",
                          icon: History,
                          onClick: openHistory,
                        }] : []),
                      ].map((item) => {
                        const Icon = item.icon;
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
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "text-white hover:bg-white/[0.08]" : "text-slate-800 hover:bg-[#f3f5f9]"}`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.danger ? darkMode ? "bg-red-500/15 text-red-300" : "bg-red-50 text-red-600" : darkMode ? "bg-white/[0.08] text-white/75" : "bg-[#eef7f4] text-[#17643f]"}`}>
                              <Icon className={`h-4 w-4 ${item.spin ? "animate-spin" : ""}`} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block font-semibold ${item.danger ? "text-red-600 dark:text-red-300" : ""}`}>{item.label}</span>
                              <span className={`mt-0.5 block text-xs ${muted}`}>{item.helper}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full min-w-0 sm:w-[236px]">
                <DatePicker
                  darkMode={darkMode}
                  value={date}
                  onChange={setDate}
                  placeholder="Choose DMR date"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <WorkloadBars
            title="Site-wise actual manpower"
            items={siteManpowerBreakdown}
            darkMode={darkMode}
          />
          <WorkloadBars
            title="Top agencies today"
            items={agencyManpowerBreakdown}
            darkMode={darkMode}
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-4">
          {sectionCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setDetailSection(card.id)}
              className={`group relative min-h-44 rounded-[28px]  p-5 text-left transition ${panel}`}
            >
              <span
                className={`absolute left-6 right-6 top-0 h-1 rounded-full ${card.count ? "bg-[#15a8e0]" : darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                  >
                    {card.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold">{card.title}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${card.count ? "bg-emerald-500/10 text-emerald-700" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}
                >
                  {card.count ? "Added" : "Empty"}
                </span>
              </div>
              <p className={`mt-6 line-clamp-2 text-sm leading-6 ${muted}`}>
                {card.hint}
              </p>
              <p
                className={`mt-5 text-xs font-medium ${darkMode ? "text-[#d8f36a]" : "text-[#171714]"} opacity-70 group-hover:opacity-100`}
              >
                Click to view details
              </p>
            </button>
          ))}
        </div>

        <section className={`mt-5 rounded-[28px]  p-5 ${panel}`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
              >
                Project manpower
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                {data?.sheetName || "Today"} · {projectManpowerCards.length}{" "}
                project sites
              </h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SelectMenu
                darkMode={darkMode}
                value={siteFilter}
                onChange={setSiteFilter}
                options={[
                  { value: "all", label: "All sites" },
                  ...(data?.today?.sites || []).map((site) => ({
                    value: site,
                    label: site,
                  })),
                ]}
              />
              <label className="relative block">
                <Search
                  className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`}
                />
                <input
                  value={agencySearch}
                  onChange={(event) => setAgencySearch(event.target.value)}
                  placeholder="Search site or agency…"
                  className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none sm:w-64 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}
                />
              </label>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projectManpowerCards.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProject(project)}
                className={`group  flex min-h-80 flex-col rounded-[28px] border p-5 text-left transition ${darkMode ? "border-white/10 bg-[#111216] hover:bg-white/[0.04]" : "border-black/[0.07] bg-white hover:bg-[#fbfaf7]"}`}
              >
                <div className="flex items-start justify-between gap-3 border-b pb-5 border-black/[0.06] dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"}`}
                    >
                      <FileSpreadsheet className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                      >
                        In production
                      </p>
                      <h4 className="mt-1 truncate text-xl font-semibold">
                        {project.site}
                      </h4>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] ${project.variance < 0 ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
                  >
                    {project.variance >= 0 ? "+" : ""}
                    {project.variance}
                  </span>
                </div>

                <div className="mt-5">
                  <p className={`text-sm ${muted}`}>
                    Note:{" "}
                    {project.agencies.slice(0, 3).join(", ") ||
                      "No agencies filled yet"}
                    {project.agencies.length > 3
                      ? ` +${project.agencies.length - 3}`
                      : ""}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-semibold">Progress</span>
                    <span className="font-semibold">{project.progress}%</span>
                  </div>
                  <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                    {(() => {
                      const planned = Math.max(Number(project.planned) || 0, 0);
                      const actual = Math.max(Number(project.actual) || 0, 0);
                      const variance = Math.abs(Number(project.variance) || 0);
                      const total = planned + actual + variance || 1;
                      return [
                        {
                          label: "Planned",
                          value: planned,
                          color: "bg-[#ff7a2f]",
                        },
                        {
                          label: "Actual",
                          value: actual,
                          color: "bg-[#f2c94c]",
                        },
                        {
                          label: "Variance",
                          value: variance,
                          color: "bg-[#63d5bd]",
                        },
                      ].map((segment) => (
                        <span
                          key={segment.label}
                          className={`${segment.color} mr-1 last:mr-0 last:rounded-r-full first:rounded-l-full`}
                          style={{
                            width: `${Math.max(segment.value ? 10 : 4, (segment.value / total) * 100)}%`,
                          }}
                        />
                      ));
                    })()}
                  </div>
                  <div
                    className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] ${muted}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-[#ff7a2f]" />{" "}
                      Planned
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-[#f2c94c]" /> Actual
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-[#63d5bd]" />{" "}
                      Variance
                    </span>
                  </div>
                </div>

                <div className="mt-5 pb-2">
                  <p className="text-sm font-semibold">Active agencies</p>
                  <div className="mt-3 flex items-center">
                    {project.agencies.slice(0, 5).map((agency, index) => (
                      <span
                        key={agency}
                        title={agency}
                        className={`-ml-2 first:ml-0 grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-semibold ${darkMode ? "border-[#111216] bg-white/10 text-white" : "border-white bg-[#f4f0e8] text-black"}`}
                      >
                        {agency
                          .split(/\s+/)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || index + 1}
                      </span>
                    ))}
                    <span
                      className={`ml-3 rounded-full px-3 py-2 text-xs font-medium ${darkMode ? "bg-white/5 text-white/60" : "bg-[#f4f0e8] text-black/60"}`}
                    >
                      {project.agencies.length} agencies
                    </span>
                  </div>
                </div>

                <div
                  className={`mt-auto grid grid-cols-3 gap-2 border-t pt-4 text-xs ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                >
                  <div>
                    <p className="font-semibold">{project.planned}</p>
                    <p className={muted}>Planned</p>
                  </div>
                  <div>
                    <p className="font-semibold">{project.actual}</p>
                    <p className={muted}>Actual</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-2 font-semibold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                    >
                      View
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {!projectManpowerCards.length && (
              <div
                className={`rounded-[24px] border px-4 py-10 text-center text-sm md:col-span-2 xl:col-span-3 ${darkMode ? "border-white/10 bg-white/[0.025] text-white/45" : "border-black/[0.06] bg-white text-black/45"}`}
              >
                No project manpower found for the selected filters.
              </div>
            )}
          </div>
        </section>
      </div>

      {planMode && (
        <div
          className={`fixed inset-0 z-50 flex ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f7f5ef] text-[#171714]"}`}
        >
          <div className="flex h-[100dvh] w-screen flex-col overflow-hidden">
            <div
              className={`flex flex-col gap-4 border-b px-4 py-4 sm:px-7 sm:py-5 md:flex-row md:items-start md:justify-between ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-[#ebe6dc] text-[#171714]"}`}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}
                  >
                    {activePlanTitle}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold leading-tight sm:mt-2 sm:text-3xl">
                    {activePlanHeading}
                  </h3>
                  <p className={`mt-1 text-sm ${muted}`}>
                    {activePlan?.selectedDate ||
                      activePlan?.requestedDate ||
                      date}{" "}
                    · {activePlan?.summary?.records || 0} planned work item
                    {activePlan?.summary?.records === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end">
                {planMode === "today" && (
                  <button
                    type="button"
                    onClick={downloadDmrReportPdf}
                    disabled={reportPdfLoading}
                    className={`relative flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full px-3 text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-4 sm:text-sm ${
                      darkMode
                        ? "bg-gradient-to-r from-[#6af3a8] via-[#7df0c5] to-[#6af3a8] text-black shadow-lg shadow-[#d8f36a]/15 hover:scale-[1.02]"
                        : "bg-gradient-to-r from-[#6aff9e] via-[#7df0c5] to-[#6af3a8] text-[#171714] shadow-lg shadow-emerald-200/60 hover:scale-[1.02]"
                    }`}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 hover:translate-x-full" />
                    <span className="relative inline-flex items-center gap-2">
                      {reportPdfLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 " />
                      )}
                      Download Today&apos;s PDF
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCeoPlanView((value) => !value)}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full border px-3 text-xs font-medium transition-all duration-300 sm:flex-none sm:px-4 sm:text-sm ${ceoPlanView ? (darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black shadow-lg shadow-[#d8f36a]/10" : "border-[#171714] bg-[#171714] text-white shadow-lg shadow-black/10") : darkMode ? "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/10" : "border-black/10 bg-white text-black/65 hover:bg-black/[0.03]"}`}
                >
                  CEO&apos;s View
                </button>
                <button
                  onClick={() => {
                    setPlanMode(null);
                    setSelectedTomorrowSite("");
                  }}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {activePlan?.error && (
                <div
                  className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${darkMode ? "border-red-400/20 bg-red-400/5 text-red-200" : "border-red-500/20 bg-red-50 text-red-700"}`}
                >
                  Could not load {activePlanTitle} sheet: {activePlan.error}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside
                  className={`rounded-[28px] border p-3 lg:sticky lg:top-0 lg:self-start ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                >
                  <p
                    className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                  >
                    Plan menu
                  </p>
                  <div
                    role="tablist"
                    aria-label={`${activePlanTitle} menu`}
                    className="space-y-2"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={!activeTomorrowSite}
                      onClick={() => setSelectedTomorrowSite("")}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${!activeTomorrowSite ? (darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white") : darkMode ? "text-white/65 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"}`}
                    >
                      <span className="">Overview</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${!activeTomorrowSite ? "bg-black/10 text-inherit" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}
                      >
                        {activePlan?.summary?.plannedManpower || 0}
                      </span>
                    </button>
                    {tomorrowPlanSites.map((site) => {
                      const selected = activeTomorrowSite?.site === site.site;
                      return (
                        <button
                          key={site.site}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setSelectedTomorrowSite(site.site)}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${selected ? (darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white") : darkMode ? "text-white/65 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"}`}
                        >
                          <span className="truncate ">{site.site}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${selected ? "bg-black/10 text-inherit" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}
                          >
                            {site.plannedManpower}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div className="min-w-0 transition-all duration-300 ease-out">
                  {ceoPlanView ? (
                    <PlanCeoView
                      activePlan={activePlan}
                      activePlanTitle={activePlanTitle}
                      activeTomorrowSite={activeTomorrowSite}
                      tomorrowPlanSites={tomorrowPlanSites}
                      darkMode={darkMode}
                    />
                  ) : !activeTomorrowSite ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      <section
                        className={`rounded-[28px]  p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.07] bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold">
                              {activePlanTitle} manpower summary
                            </p>
                            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                              <div>
                                <p className="text-6xl font-semibold leading-none">
                                  {activePlanStatus.planned}
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  planned
                                </p>
                              </div>
                              <div>
                                <p
                                  className={`text-5xl font-semibold leading-none ${activePlanStatus.ok ? "text-emerald-500" : "text-red-500"}`}
                                >
                                  {activePlanStatus.actual}
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  actual
                                </p>
                              </div>
                              <span
                                className={`mb-2 rounded-full border px-3 py-1 text-sm font-semibold ${planStatusTone(activePlanStatus, darkMode)}`}
                              >
                                {activePlanProgress}% progress
                              </span>
                            </div>
                            <p className={`mt-3 text-sm ${muted}`}>
                              {activePlanSummaryText}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
                          >
                            Live sheet
                          </span>
                        </div>
                        <div
                          className={`mt-5 h-3 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
                        >
                          <div
                            className={`h-full rounded-full ${activePlanStatus.ok ? "bg-[#54d39f]" : "bg-red-500"}`}
                            style={{
                              width: `${Math.min(100, Math.max(4, (activePlanStatus.actual / Math.max(1, activePlanStatus.planned)) * 100))}%`,
                            }}
                          />
                        </div>
                        <div
                          className={`mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                        >
                          <div>
                            <p
                              className={`text-3xl font-semibold ${activePlanStatus.ok ? "text-emerald-500" : "text-red-500"}`}
                            >
                              {activePlanStatus.variance >= 0 ? "+" : ""}
                              {activePlanStatus.variance}
                            </p>
                            <p className={muted}>variance</p>
                          </div>
                          <div>
                            <p className="text-3xl font-semibold">
                              {activePlan?.summary?.sites || 0}
                            </p>
                            <p className={muted}>sites</p>
                          </div>
                          <div>
                            <p
                              className={`text-3xl font-semibold ${attentionPlanSites.length ? "text-red-500" : "text-emerald-500"}`}
                            >
                              {attentionPlanSites.length}
                            </p>
                            <p className={muted}>attention</p>
                          </div>
                        </div>
                        <div
                          className={`mt-4 rounded-2xl  p-4 ${attentionPlanSites.length ? (darkMode ? "border-red-400/20 bg-red-400/5" : "border-red-200 bg-red-50") : darkMode ? "border-emerald-400/20 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p
                              className={`text-sm font-semibold ${attentionPlanSites.length ? (darkMode ? "text-red-200" : "text-red-700") : darkMode ? "text-emerald-200" : "text-emerald-700"}`}
                            >
                              What needs attention
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attentionPlanSites.length ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
                            >
                              {attentionPlanSites.length
                                ? `${attentionPlanSites.length} site${attentionPlanSites.length === 1 ? "" : "s"}`
                                : "Clear"}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {(attentionPlanSites.length
                              ? attentionPlanSites.slice(0, 4)
                              : tomorrowPlanSites.slice(0, 3)
                            ).map((site) => {
                              const status = planActualStatus(
                                site.plannedManpower,
                                site.actualManpower,
                              );
                              return (
                                <div
                                  key={site.site}
                                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${darkMode ? "bg-black/15" : "bg-white/70"}`}
                                >
                                  <span className="truncate font-medium">
                                    {site.site}
                                  </span>
                                  <span
                                    className={`shrink-0 font-semibold ${status.ok ? "text-emerald-600" : "text-red-600"}`}
                                  >
                                    {status.actual}/{status.planned}
                                  </span>
                                </div>
                              );
                            })}
                            {!tomorrowPlanSites.length && (
                              <p className={`text-sm ${muted}`}>
                                No plan sites available yet.
                              </p>
                            )}
                          </div>
                        </div>
                        {planMode === "tomorrow" && (
                          <div
                            className={`mt-4 rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-black/[0.025]"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">
                                  Submission timing
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  Cutoff: 11:30 AM IST
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!activePlanTimeliness.length ? (darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55") : activePlanTimeliness.some((item) => item.status === "delayed") ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
                              >
                                {!activePlanTimeliness.length
                                  ? "No submissions"
                                  : activePlanTimeliness.some(
                                        (item) => item.status === "delayed",
                                      )
                                    ? "Delayed found"
                                    : "On time"}
                              </span>
                            </div>
                            <div className="mt-3 space-y-2">
                              {activePlanTimeliness.map((item) => {
                                const delayed = item.status === "delayed";
                                return (
                                  <div
                                    key={item.name}
                                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${darkMode ? "bg-black/15" : "bg-white/75"}`}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">
                                        {item.name}
                                      </p>
                                      <p
                                        className={`mt-0.5 truncate text-[11px] ${muted}`}
                                      >
                                        {item.records} entr
                                        {item.records === 1 ? "y" : "ies"}
                                        {item.lastSubmittedAt
                                          ? ` · ${item.lastSubmittedAt}`
                                          : ""}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${delayed ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
                                    >
                                      {delayed ? "Delayed" : "On time"}
                                    </span>
                                  </div>
                                );
                              })}
                              {!activePlanTimeliness.length && (
                                <p className={`text-sm ${muted}`}>
                                  No submissions found yet.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </section>

                      <TomorrowSiteBars
                        items={tomorrowPlanSites}
                        darkMode={darkMode}
                        title={`${activePlanTitle} by site`}
                        emptyText={`No ${activePlanTitle.toLowerCase()} data available yet.`}
                      />
                    </div>
                  ) : (
                    <article
                      className={`rounded-[32px]  p-6 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                          >
                            Selected project site
                          </p>
                          <h4 className="mt-2 text-3xl font-semibold">
                            {activeTomorrowSite.site}
                          </h4>
                          <p className={`mt-2 text-sm ${muted}`}>
                            {activeTomorrowSite.submitters.join(", ") ||
                              "No submitter"}{" "}
                            · {activeTomorrowSite.categories.length} trade
                            categor
                            {activeTomorrowSite.categories.length === 1
                              ? "y"
                              : "ies"}
                          </p>
                        </div>
                        <div
                          className={`rounded-[24px] border px-5 py-4 text-right ${planStatusTone(planActualStatus(activeTomorrowSite.plannedManpower, activeTomorrowSite.actualManpower), darkMode)}`}
                        >
                          <p className="text-4xl font-semibold leading-none">
                            {activeTomorrowSite.actualManpower}/
                            {activeTomorrowSite.plannedManpower}
                          </p>
                          <p className="mt-1 text-xs opacity-70">
                            actual / planned
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {activeTomorrowSite.records
                          .slice()
                          .sort((a, b) => {
                            const peopleA =
                              a.plannedManpower !== null &&
                              a.plannedManpower !== undefined
                                ? Number(a.plannedManpower) || 0
                                : -1;
                            const peopleB =
                              b.plannedManpower !== null &&
                              b.plannedManpower !== undefined
                                ? Number(b.plannedManpower) || 0
                                : -1;
                            return (
                              peopleB - peopleA ||
                              String(a.category || "").localeCompare(
                                String(b.category || ""),
                              )
                            );
                          })
                          .map((record) => {
                            const people =
                              record.plannedManpower !== null &&
                              record.plannedManpower !== undefined
                                ? Number(record.plannedManpower) || 0
                                : null;
                            const totalPlanned =
                              Number(activeTomorrowSite.plannedManpower) || 0;
                            const progress =
                              people === null || totalPlanned <= 0
                                ? null
                                : Math.min(
                                    100,
                                    Math.max(0, (people / totalPlanned) * 100),
                                  );
                            return (
                              <section
                                key={record.id}
                                className={`flex min-h-72 flex-col overflow-hidden rounded-[28px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-[#fbfaf7]"}`}
                              >
                                <div
                                  className={`border-b px-5 py-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#ffb000]">
                                        <span className="h-3 w-3 rounded bg-white/80" />
                                      </span>
                                      <h5 className="truncate text-lg font-semibold">
                                        {record.category}
                                      </h5>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/60"}`}
                                    >
                                      {record.submittedBy || "Unknown"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-1 flex-col p-5">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <p className={`text-xs ${muted}`}>
                                        Planned manpower
                                      </p>
                                      <p
                                        className={`mt-1 text-5xl font-semibold leading-none ${people === null ? muted : ""}`}
                                      >
                                        {people ?? "—"}
                                      </p>
                                    </div>
                                    <span
                                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${people !== null ? "bg-emerald-500/10 text-emerald-700" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}
                                    >
                                      {people !== null
                                        ? `${people} people`
                                        : "Text only"}
                                    </span>
                                  </div>
                                  <p className="mt-5 line-clamp-3 text-lg leading-7">
                                    {record.work ||
                                      record.raw ||
                                      "No work note added."}
                                  </p>
                                  <div className="mt-5">
                                    <div className="mb-2 flex items-center justify-between text-sm">
                                      <span className="font-semibold">
                                        Share of site manpower
                                      </span>
                                      <span className="font-semibold">
                                        {progress === null
                                          ? "—"
                                          : `${Math.round(progress)}%`}
                                      </span>
                                    </div>
                                    <div
                                      className={`h-3 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.07]"}`}
                                    >
                                      <div
                                        className="h-full rounded-full bg-[#15a8e0]"
                                        style={{ width: `${progress || 0}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </section>
                            );
                          })}
                      </div>
                    </article>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div
          className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] ${reportClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReportDrawer();
          }}
        >
          <div
            className={`dmr-report-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${reportExpanded ? "dmr-report-shell-expanded" : ""} ${reportClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}
            role="dialog"
            aria-modal="true"
            aria-label="DMR performance report"
          >
            <div
              className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}
            >
              <span>
                <b>CEO report</b> · DMR performance
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReportExpanded((current) => !current)}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`}
                  aria-label={
                    reportExpanded
                      ? "Restore drawer size"
                      : "Expand report to full screen"
                  }
                >
                  {reportExpanded ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {reportExpanded ? "Restore" : "Expand"}
                  </span>
                </button>
                <button
                  onClick={closeReportDrawer}
                  className="px-1 font-semibold text-[#4b9b16]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 md:grid-cols-[250px_minmax(0,1fr)]">
              <aside
                className={`min-h-0 overflow-y-auto border-b p-5 md:border-b-0  ${darkMode ? "border-white/10" : "border-black/10"}`}
              >
                <span className="rounded bg-[#eafbdc] px-2 py-1 text-[10px] font-bold text-[#4b9b16]">
                  CEO REPORT
                </span>
                <h3 className="mt-4 small text-black dark:text-white text-2xl font-bold leading-tight">
                  DMR performance report
                </h3>
                <p className={`mt-2 text-xs leading-5 ${muted}`}>
                  Planned versus actual progress, attendance and site
                  performance in one view.
                </p>
                <div
                  className={`mt-5 rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f7f2]"}`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}
                  >
                    Report range
                  </p>
                  <p className="mt-2 text-sm font-bold">{reportStartDate}</p>
                  <p className={`my-1 text-xs ${muted}`}>to</p>
                  <p className="text-sm font-bold">{reportEndDate}</p>
                </div>
                <div className="mt-5">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}
                  >
                    Included sections
                  </p>
                  <p className="mt-2 text-3xl font-bold">
                    {reportSections.length}
                  </p>
                  <p className={`text-xs ${muted}`}>report modules selected</p>
                </div>
                {reportData && (
                  <div
                    className={`mt-5 rounded-xl border p-4 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}
                  >
                    <p className={`text-xs ${muted}`}>Overall progress</p>
                    <p className="mt-1 text-3xl font-bold text-[#4b9b16]">
                      {reportData.summary.progress}%
                    </p>
                    <p className={`mt-2 text-xs ${muted}`}>
                      {reportData.summary.sites} sites ·{" "}
                      {reportData.summary.agencies} agencies
                    </p>
                  </div>
                )}
              </aside>

              <div
                className={`min-h-0 overflow-y-auto p-5 sm:p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}
              >
                <section
                  className={`rounded-2xl  p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.08] bg-white"}`}
                >
                  <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr_auto] xl:items-end">
                    <div>
                      <p className={`mb-2 text-xs  ${muted}`}>
                        Quick range
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["weekly", "This week"],
                          ["selectedWeek", "Selected date week"],
                          ["monthly", "This month"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setReportPreset(value)}
                            className={`h-9 rounded-full border px-3.5 text-xs  ${darkMode ? "border-white/10 bg-white/5 hover:border-[#89ed3f]" : "border-black/10 bg-[#fafbf8] hover:border-[#69c832] hover:text-[#4b9b16]"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className={`mb-2 text-xs  ${muted}`}>
                        Date range
                      </p>
                      <ReportDateRangePicker
                        darkMode={darkMode}
                        startValue={reportStartDate}
                        endValue={reportEndDate}
                        onStartChange={setReportStartDate}
                        onEndChange={setReportEndDate}
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      <button
                        onClick={generateDmrReport}
                        disabled={reportLoading}
                        className="flex h-11 min-w-40 items-center justify-center gap-2 rounded-full bg-[#89ed3f] px-5 text-sm font-bold text-black hover:bg-[#7dde35] disabled:opacity-60"
                      >
                        {reportLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4" />
                        )}
                        Generate
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {DMR_REPORT_SECTION_OPTIONS.map((option) => {
                      const selected = reportSections.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleReportSection(option.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs ${selected ? (darkMode ? "border-[#89ed3f]/40 bg-[#89ed3f]/15 text-[#89ed3f]" : "border-[#69c832] bg-[#eafbdc] text-[#4b9b16]") : darkMode ? "border-white/10 text-white/50" : "border-black/10 bg-white text-black/50"}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {reportData && (
                  <div className="mt-5 space-y-5">
                    <section
                      className={`rounded-2xl border p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.08] bg-white"}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                          >
                            {reportData.startDate} to {reportData.endDate}
                          </p>
                          <h4 className="mt-2 text-2xl font-semibold">
                            Executive summary
                          </h4>
                          <p className={`mt-1 text-sm ${muted}`}>
                            {reportData.summary.datesWithData} active date
                            {reportData.summary.datesWithData === 1 ? "" : "s"}{" "}
                            from {reportData.requestedDates} requested date
                            {reportData.requestedDates === 1 ? "" : "s"}.
                          </p>
                        </div>
                        <div
                          className={`rounded-[22px] px-5 py-4 text-right ${reportData.summary.progress >= 90 ? "bg-emerald-500/10 text-emerald-700" : reportData.summary.progress >= 60 ? "bg-amber-500/10 text-amber-700" : "bg-red-500/10 text-red-700"}`}
                        >
                          <p className="text-4xl font-semibold leading-none">
                            {reportData.summary.progress}%
                          </p>
                          <p className="mt-1 text-xs">overall progress</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          [
                            "Planned",
                            <ReportPlannedValue
                              key="summary-planned"
                              value={reportData.summary.planned}
                            />,
                          ],
                          [
                            "Actual",
                            <ReportActualValue
                              key="summary-actual"
                              planned={reportData.summary.planned}
                              actual={reportData.summary.actual}
                            />,
                          ],
                          [
                            "Variance",
                            `${reportData.summary.variance >= 0 ? "+" : ""}${reportData.summary.variance}`,
                          ],
                          [
                            "Attendance",
                            `${reportData.summary.attendance.present}/${reportData.summary.attendance.total}`,
                          ],
                          ["Sites", reportData.summary.sites],
                          ["Agencies", reportData.summary.agencies],
                          ["Equipment", reportData.summary.equipment],
                          ["Materials", reportData.summary.materials],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className={`rounded-[20px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f5ef]"}`}
                          >
                            <p className="text-2xl font-semibold">{value}</p>
                            <p className={`mt-1 text-xs ${muted}`}>{label}</p>
                          </div>
                        ))}
                      </div>
                      {reportData.summary.datesWithoutData?.length > 0 && (
                        <div
                          className={`mt-4 rounded-[18px] border px-4 py-3 text-sm ${darkMode ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                        >
                          No data was provided for:{" "}
                          {reportData.summary.datesWithoutData.join(", ")}
                        </div>
                      )}
                    </section>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <ReportDailyTrend
                        items={reportData.dailyProgress || []}
                        darkMode={darkMode}
                      />
                      <ReportComparisonBars
                        title="Site manpower chart"
                        subtitle="Planned from plan sheet, actual from filled DMR sheet."
                        items={reportData.siteManpower || []}
                        darkMode={darkMode}
                        limit={12}
                      />
                    </div>

                    {reportData.dailyProgress?.length > 0 && (
                      <ReportTable
                        title="Daily progress"
                        headers={[
                          "Date",
                          "Planned",
                          "Actual",
                          "Progress",
                          "Present",
                          "Absent",
                          "Status",
                        ]}
                        rows={reportData.dailyProgress.map((item) => [
                          item.date,
                          <ReportPlannedValue
                            key={`${item.date}-planned`}
                            value={item.planned}
                          />,
                          <ReportActualValue
                            key={`${item.date}-actual`}
                            planned={item.planned}
                            actual={item.actual}
                          />,
                          `${item.progress}%`,
                          item.attendance.present,
                          item.attendance.absent,
                          item.status,
                        ])}
                        darkMode={darkMode}
                        muted={muted}
                      />
                    )}
                    {reportData.attendance?.byDate?.length > 0 && (
                      <ReportTable
                        title="Attendance"
                        headers={[
                          "Date",
                          "Present",
                          "Absent",
                          "Leave",
                          "Pending",
                        ]}
                        rows={reportData.attendance.byDate.map((item) => [
                          item.date,
                          `${item.present.length}/${item.total}${item.present.length ? ` - ${item.present.join(", ")}` : ""}`,
                          `${item.absent.length}/${item.total}${item.absent.length ? ` - ${item.absent.join(", ")}` : ""}`,
                          `${item.leave.length}/${item.total}${item.leave.length ? ` - ${item.leave.join(", ")}` : ""}`,
                          `${item.pending.length}/${item.total}${item.pending.length ? ` - ${item.pending.join(", ")}` : ""}`,
                        ])}
                        darkMode={darkMode}
                        muted={muted}
                        columnClasses={[
                          "w-[120px]",
                          "w-[28%]",
                          "w-[28%]",
                          "w-[96px]",
                          "w-[28%]",
                        ]}
                      />
                    )}
                    {reportData.tradeSiteManpowerByDate?.length > 0 && (
                      <TradeSiteMatrix
                        rows={reportData.tradeSiteManpowerByDate}
                        dates={
                          reportData.dateKeys || reportData.availableDates || []
                        }
                        darkMode={darkMode}
                        muted={muted}
                        search={reportTradeSearch}
                        onSearch={setReportTradeSearch}
                      />
                    )}
                    {reportData.siteManpower?.length > 0 && (
                      <ReportTable
                        title="Site wise manpower"
                        headers={[
                          "Site",
                          "Planned",
                          "Actual",
                          "Variance",
                          "Progress",
                        ]}
                        rows={reportData.siteManpower
                          .slice(0, 20)
                          .map((item) => [
                            item.label,
                            <ReportPlannedValue
                              key={`${item.label}-planned`}
                              value={item.planned}
                            />,
                            <ReportActualValue
                              key={`${item.label}-actual`}
                              planned={item.planned}
                              actual={item.actual}
                            />,
                            `${item.variance >= 0 ? "+" : ""}${item.variance}`,
                            `${item.progress}%`,
                          ])}
                        darkMode={darkMode}
                        muted={muted}
                      />
                    )}
                    {reportData.agencyManpower?.length > 0 && (
                      <ReportTable
                        title="Agency wise manpower"
                        headers={[
                          "Agency",
                          "Planned",
                          "Actual",
                          "Variance",
                          "Progress",
                        ]}
                        rows={reportData.agencyManpower
                          .slice(0, 20)
                          .map((item) => [
                            item.label,
                            <ReportPlannedValue
                              key={`${item.label}-planned`}
                              value={item.planned}
                            />,
                            <ReportActualValue
                              key={`${item.label}-actual`}
                              planned={item.planned}
                              actual={item.actual}
                            />,
                            `${item.variance >= 0 ? "+" : ""}${item.variance}`,
                            `${item.progress}%`,
                          ])}
                        darkMode={darkMode}
                        muted={muted}
                      />
                    )}
                    {reportData.equipment?.length > 0 && (
                      <ReportTable
                        title="Equipment & tools"
                        headers={["Date", "Site", "Details", "Qty"]}
                        rows={reportData.equipment
                          .slice(0, 30)
                          .map((item) => [
                            item.date,
                            item.site || "-",
                            item.details || "-",
                            item.quantity || "-",
                          ])}
                        darkMode={darkMode}
                        muted={muted}
                      />
                    )}
                    {reportData.materials?.length > 0 && (
                      <ReportTable
                        title="Materials"
                        headers={["Date", "Site", "Details", "Unit", "Qty"]}
                        rows={reportData.materials
                          .slice(0, 30)
                          .map((item) => [
                            item.date,
                            item.site || "-",
                            item.details || "-",
                            item.unit || "-",
                            item.quantity || "-",
                          ])}
                        darkMode={darkMode}
                        muted={muted}
                      />
                    )}
                    {reportData.notes?.length > 0 && (
                      <ReportTable
                        title="Notes"
                        headers={["Date", "Note"]}
                        rows={reportData.notes
                          .slice(0, 30)
                          .map((item) => [item.date, item.note || "-"])}
                        darkMode={darkMode}
                        muted={muted}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
          <div
            className={`flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[34px] ${darkMode ? "border border-white/10 bg-[#111216] text-white" : "border border-black/10 bg-[#f7f5ef] text-[#171714]"}`}
          >
            <div
              className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"}`}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}
                  >
                    Project manpower
                  </p>
                  <h3 className="mt-2 truncate text-3xl small text-black dark:text-white font-semibold">
                    {selectedProject.site}
                  </h3>
                  <p className={`mt-1 text-sm ${muted}`}>
                    {selectedProject.actual} actual / {selectedProject.planned}{" "}
                    planned · {selectedProject.agencies.length} agencies
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              <div
                className={`rounded-[30px]  p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                    >
                      Manpower mix
                    </p>
                    <h4 className="mt-2 text-2xl font-semibold">
                      {selectedProject.progress}% progress
                    </h4>
                    <p className={`mt-1 text-sm ${muted}`}>
                      Planned, actual and variance at a glance.
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedProject.variance < 0 ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
                  >
                    {selectedProject.variance >= 0 ? "+" : ""}
                    {selectedProject.variance} variance
                  </div>
                </div>

                <div className="mt-5 flex h-3 overflow-hidden rounded-full">
                  {(() => {
                    const planned = Math.max(
                      Number(selectedProject.planned) || 0,
                      0,
                    );
                    const actual = Math.max(
                      Number(selectedProject.actual) || 0,
                      0,
                    );
                    const variance = Math.abs(
                      Number(selectedProject.variance) || 0,
                    );
                    const total = planned + actual + variance || 1;
                    return [
                      {
                        label: "Planned",
                        value: planned,
                        color: "bg-[#ff7a2f]",
                      },
                      { label: "Actual", value: actual, color: "bg-[#f2c94c]" },
                      {
                        label: "Variance",
                        value: variance,
                        color: "bg-[#63d5bd]",
                      },
                    ].map((segment) => (
                      <span
                        key={segment.label}
                        className={`${segment.color} mr-1 first:rounded-l-full last:mr-0 last:rounded-r-full`}
                        style={{
                          width: `${Math.max(segment.value ? 10 : 4, (segment.value / total) * 100)}%`,
                        }}
                      />
                    ));
                  })()}
                </div>
                <div
                  className={`mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${muted}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-[#ff7a2f]" /> Planned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-[#f2c94c]" /> Actual
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-[#63d5bd]" /> Variance
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Planned",
                    value: selectedProject.planned,
                    tone: darkMode
                      ? "bg-[#ff7a2f]/10 text-orange-200"
                      : "bg-orange-50 text-orange-700",
                  },
                  {
                    label: "Actual",
                    value: selectedProject.actual,
                    tone: darkMode
                      ? "bg-[#f2c94c]/10 text-yellow-200"
                      : "bg-yellow-50 text-yellow-700",
                  },
                  {
                    label: "Variance",
                    value: `${selectedProject.variance >= 0 ? "+" : ""}${selectedProject.variance}`,
                    tone:
                      selectedProject.variance < 0
                        ? darkMode
                          ? "bg-red-400/10 text-red-200"
                          : "bg-red-50 text-red-700"
                        : darkMode
                          ? "bg-emerald-400/10 text-emerald-200"
                          : "bg-emerald-50 text-emerald-700",
                  },
                  {
                    label: "Progress",
                    value: `${selectedProject.progress}%`,
                    tone: darkMode
                      ? "bg-blue-400/10 text-blue-200"
                      : "bg-blue-50 text-blue-700",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className={`rounded-[24px] px-5 py-4 ${metric.tone}`}
                  >
                    <p className="text-3xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs opacity-70">{metric.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                    >
                      Agency details
                    </p>
                    <h4 className="mt-1 text-xl font-semibold">
                      Who is active on this project
                    </h4>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {selectedProject.rows
                    .slice()
                    .sort((a, b) =>
                      (a.agency || "").localeCompare(b.agency || ""),
                    )
                    .map((row, index) => {
                      const planned = Number(row.planned) || 0;
                      const actual = Number(row.actual) || 0;
                      const variance = actual - planned;
                      const total = Math.max(
                        planned + actual + Math.abs(variance),
                        1,
                      );
                      return (
                        <article
                          key={`${row.agency}-${row.rowIndex || index}`}
                          className={`rounded-[26px]  p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold">
                                {row.agency || "Unnamed agency"}
                              </p>
                              <p className={`mt-1 text-xs ${muted}`}>
                                {row.site || selectedProject.site}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${variance < 0 ? (darkMode ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-700") : darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700"}`}
                            >
                              {variance >= 0 ? "+" : ""}
                              {variance}
                            </span>
                          </div>
                          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                            {[
                              { value: planned, color: "bg-[#ff7a2f]" },
                              { value: actual, color: "bg-[#f2c94c]" },
                              {
                                value: Math.abs(variance),
                                color: "bg-[#63d5bd]",
                              },
                            ].map((segment, segmentIndex) => (
                              <span
                                key={segmentIndex}
                                className={`${segment.color} mr-1 first:rounded-l-full last:mr-0 last:rounded-r-full`}
                                style={{
                                  width: `${Math.max(segment.value ? 10 : 4, (segment.value / total) * 100)}%`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                            <div
                              className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-[#ff7a2f]/10 text-orange-200" : "bg-orange-50 text-orange-700"}`}
                            >
                              <p className="text-base font-semibold">
                                {planned}
                              </p>
                              <p className="opacity-70">Planned</p>
                            </div>
                            <div
                              className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-[#f2c94c]/10 text-yellow-200" : "bg-yellow-50 text-yellow-700"}`}
                            >
                              <p className="text-base font-semibold">
                                {actual}
                              </p>
                              <p className="opacity-70">Actual</p>
                            </div>
                            <div
                              className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-white/5 text-white/65" : "bg-black/[0.035] text-black/60"}`}
                            >
                              <p className="text-base font-semibold">
                                {row.rowIndex || "-"}
                              </p>
                              <p className="opacity-70">Row</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reminderOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#171714]/60 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReminderOpen(false);
          }}
        >
          <form
            onSubmit={saveDmrReminderSchedule}
            className={`flex h-[100dvh] w-screen flex-col overflow-hidden ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#faf9f5] text-[#171714]"}`}
            role="dialog"
            aria-modal="true"
            aria-label="DMR WhatsApp reminder schedule"
          >
            <div
              className={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-red-400/10 text-red-100" : "bg-red-50 text-red-600"}`}
                >
                  <BellRing className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-red-200" : "text-red-600"}`}
                  >
                    DMR WhatsApp reminders
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold">
                    Reminder schedule
                  </h3>
                  <p className={`mt-1 hidden text-sm sm:block ${muted}`}>
                    Actual manpower, tomorrow&apos;s plan, and site daily report
                    reminders run from the backend cron even when this tab is
                    closed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReminderOpen(false)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              <section
                className={`rounded-[30px] border p-4 sm:p-6 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/[0.07] bg-white"}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}
                    >
                      Daily schedule
                    </p>
                    <h4 className="mt-2 text-2xl font-semibold">
                      Send only to pending DMR users
                    </h4>
                    <p className={`mt-2 max-w-3xl text-sm leading-6 ${muted}`}>
                      Each reminder sends once per day per type. People selected
                      below are skipped automatically once their matching DMR
                      data is filled.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReminderSettings((current) => ({
                        ...current,
                        enabled: !current.enabled,
                      }))
                    }
                    className={`flex h-14 w-28 items-center justify-between rounded-full p-2 text-sm font-semibold transition ${reminderSettings.enabled ? "bg-[#10a66b] text-white" : darkMode ? "bg-white/10 text-white/55" : "bg-black/[0.06] text-black/55"}`}
                  >
                    <span
                      className={`h-10 w-10 rounded-full bg-white transition ${reminderSettings.enabled ? "translate-x-0" : "translate-x-14"}`}
                    />
                    <span>{reminderSettings.enabled ? "On" : "Off"}</span>
                  </button>
                </div>
              </section>

              {reminderLoading ? (
                <div
                  className={`mt-5 rounded-[30px] border px-5 py-14 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/55" : "border-black/[0.06] bg-white text-black/55"}`}
                >
                  <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                  Loading WhatsApp contacts and DMR reminder status...
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 xl:grid-cols-3">
                    {reminderTypes.map((item) => {
                      const reminder =
                        (reminderSettings.reminders || {})[item.id] || {};
                      const selectedCount = Array.isArray(
                        reminder.recipientPhones,
                      )
                        ? reminder.recipientPhones.length
                        : 0;
                      const status = reminderStatus[item.id] || {};
                      const itemEnabled = reminder.enabled !== false;
                      return (
                        <article
                          key={item.id}
                          className={`rounded-[28px] border p-4 ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.07] bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                              >
                                {item.templateName}
                              </p>
                              <h5 className="mt-2 text-xl font-semibold">
                                {item.label}
                              </h5>
                              <p className={`mt-1 text-xs ${muted}`}>
                                {selectedCount} recipients selected
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateDmrReminder(item.id, {
                                  enabled: !itemEnabled,
                                })
                              }
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${itemEnabled ? "bg-emerald-500/10 text-emerald-700" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}
                            >
                              {itemEnabled ? "On" : "Off"}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto]">
                            <label className="block">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                              >
                                Reminder time
                              </span>
                              <input
                                type="time"
                                value={reminder.time || item.defaultTime}
                                onChange={(event) =>
                                  updateDmrReminder(item.id, {
                                    time: event.target.value,
                                  })
                                }
                                className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm font-semibold outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#fafafa]"}`}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => sendDmrReminderNow(item.id)}
                              disabled={reminderSending === item.id}
                              className={`mt-auto flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                            >
                              {reminderSending === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              Send now
                            </button>
                          </div>

                          <div
                            className={`mt-4 rounded-2xl p-3 text-xs ${darkMode ? "bg-white/[0.035] text-white/60" : "bg-[#f5f7f2] text-black/55"}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>Last run</span>
                              <span className="font-semibold">
                                {status.finishedAt
                                  ? new Date(status.finishedAt).toLocaleString()
                                  : "Not sent yet"}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <span className="rounded-xl bg-emerald-500/10 px-2 py-1 text-emerald-700">
                                {status.sent || 0} sent
                              </span>
                              <span className="rounded-xl bg-red-500/10 px-2 py-1 text-red-700">
                                {status.failed || 0} failed
                              </span>
                              <span className="rounded-xl bg-sky-500/10 px-2 py-1 text-sky-700">
                                {status.skipped || 0} skipped
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <section
                    className={`overflow-hidden rounded-[30px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.07] bg-white"}`}
                  >
                    <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
                      <div>
                        <p
                          className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}
                        >
                          Numbers
                        </p>
                        <h4 className="mt-1 text-2xl font-semibold">
                          Reminder recipients
                        </h4>
                        <p className={`mt-1 text-sm ${muted}`}>
                          Choose which WhatsApp contacts receive each reminder
                          category.
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
                      >
                        {reminderContacts.length} saved contacts
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left">
                        <thead
                          className={
                            darkMode
                              ? "bg-white/[0.035] text-white/55"
                              : "bg-[#f4f0e8] text-black/55"
                          }
                        >
                          <tr>
                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em]">
                              Contact
                            </th>
                            {reminderTypes.map((item) => {
                              const selectedCount = Array.isArray(
                                reminderSettings.reminders?.[item.id]
                                  ?.recipientPhones,
                              )
                                ? reminderSettings.reminders[item.id]
                                    .recipientPhones.length
                                : 0;
                              return (
                                <th
                                  key={item.id}
                                  className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em]"
                                >
                                  <span className="block">{item.label}</span>
                                  <span className="mt-1 block normal-case tracking-normal text-black/40 dark:text-white/40">
                                    {selectedCount} selected
                                  </span>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody
                          className={
                            darkMode
                              ? "divide-y divide-white/10"
                              : "divide-y divide-black/[0.06]"
                          }
                        >
                          {reminderContacts.map((contact) => (
                            <tr key={contact.phone}>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#10a66b] text-sm font-semibold text-white">
                                    {(contact.name || contact.phone || "?")
                                      .split(/\s+/)
                                      .map((part) => part[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                      {contact.name || contact.phone}
                                    </p>
                                    <p className={`truncate text-xs ${muted}`}>
                                      +{contact.phone}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {reminderTypes.map((item) => {
                                const selectedPhones =
                                  reminderSettings.reminders?.[item.id]
                                    ?.recipientPhones || [];
                                const checked = selectedPhones.includes(
                                  contact.phone,
                                );
                                return (
                                  <td key={item.id} className="px-4 py-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleDmrReminderContact(
                                          item.id,
                                          contact.phone,
                                        )
                                      }
                                      className={`inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${checked ? "border-emerald-400 bg-emerald-50 text-emerald-800" : darkMode ? "border-white/10 bg-white/[0.025] text-white/50 hover:bg-white/[0.055]" : "border-black/10 bg-white text-black/45 hover:bg-[#f1f7f4]"}`}
                                    >
                                      <span
                                        className={`grid h-5 w-5 place-items-center rounded-lg border transition ${checked ? "border-emerald-500 bg-emerald-500 text-white" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                                      >
                                        {checked && (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                      </span>
                                      {checked ? "Selected" : "Select"}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {!reminderContacts.length && (
                            <tr>
                              <td
                                colSpan={1 + reminderTypes.length}
                                className={`px-5 py-12 text-center text-sm ${muted}`}
                              >
                                No WhatsApp contacts saved yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div
              className={`flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <button
                type="button"
                onClick={() => setReminderOpen(false)}
                className={`h-11 rounded-full border px-5 text-sm ${darkMode ? "border-white/10 text-white/60" : "border-black/10 text-black/60"}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reminderSaving || reminderLoading}
                className={`flex h-11 min-w-40 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#10a66b] text-white"}`}
              >
                {reminderSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
          <div
            className={`flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px]  ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-[#faf9f5] text-[#171714]"}`}
          >
            <div
              className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <div>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}
                >
                  Super Admin only
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  DMR version history
                </h3>
                <p className={`mt-1 text-sm ${muted}`}>
                  Who changed what for {data?.sheetName || date}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-medium ${darkMode ? "border-white/10 text-white/70" : "border-black/10 text-black/65"}`}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${darkMode ? "border-white/10" : "border-black/10"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              {historyLoading && (
                <div
                  className={`rounded-[24px] border px-4 py-10 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/55" : "border-black/[0.06] bg-white text-black/55"}`}
                >
                  Loading DMR changes…
                </div>
              )}
              {!historyLoading && !historyItems.length && (
                <div
                  className={`rounded-[24px] border px-4 py-10 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/55" : "border-black/[0.06] bg-white text-black/55"}`}
                >
                  No version history found for this DMR date yet.
                </div>
              )}
              {!historyLoading &&
                historyItems.length > 0 &&
                !selectedHistory && (
                  <div className="space-y-3">
                    {historyItems.map((group) => (
                      <article
                        key={group.id}
                        className={`rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {(group.sections || [])
                                .slice(0, 4)
                                .map((section) => (
                                  <span
                                    key={section}
                                    className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
                                  >
                                    {section}
                                  </span>
                                ))}
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"}`}
                              >
                                {group.changeCount} change
                                {group.changeCount === 1 ? "" : "s"}
                              </span>
                            </div>
                            <h4 className="mt-3 truncate text-base font-semibold">
                              DMR submitted by{" "}
                              {group.displayName || group.username}
                            </h4>
                            <p className={`mt-1 text-xs ${muted}`}>
                              {group.createdAt
                                ? new Date(group.createdAt).toLocaleString()
                                : ""}{" "}
                              · {group.rowCount || 0} row
                              {group.rowCount === 1 ? "" : "s"} affected
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedHistory(group)}
                            className={`h-10 rounded-full px-4 text-xs font-semibold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                          >
                            View detail
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              {!historyLoading && selectedHistory && (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedHistory(null)}
                        className={`rounded-full border px-4 py-2 text-xs ${darkMode ? "border-white/10 text-white/70" : "border-black/10 text-black/65"}`}
                      >
                        Back to history
                      </button>
                      <h4 className="mt-4 text-xl font-semibold">
                        Submission details
                      </h4>
                      <p className={`mt-1 text-sm ${muted}`}>
                        {selectedHistory.displayName ||
                          selectedHistory.username}{" "}
                        ·{" "}
                        {selectedHistory.createdAt
                          ? new Date(selectedHistory.createdAt).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/55"}`}
                    >
                      {selectedHistory.changeCount} changes
                    </span>
                  </div>
                  <div
                    className={`overflow-hidden rounded-[22px] border ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead
                          className={
                            darkMode
                              ? "bg-white/[0.035] text-white/55"
                              : "bg-[#f4f0e8] text-black/55"
                          }
                        >
                          <tr>
                            {[
                              "Section",
                              "Row",
                              "Item",
                              "Field",
                              "Before",
                              "After",
                            ].map((label) => (
                              <th
                                key={label}
                                className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody
                          className={
                            darkMode
                              ? "divide-y divide-white/10"
                              : "divide-y divide-black/[0.06]"
                          }
                        >
                          {(selectedHistory.changes || []).map((change) => (
                            <tr key={change.id}>
                              <td className="px-4 py-3 capitalize">
                                {change.section || "—"}
                              </td>
                              <td className={`px-4 py-3 ${muted}`}>
                                {change.rowNumber || "—"}
                              </td>
                              <td className="max-w-[220px] px-4 py-3">
                                <span className="line-clamp-2">
                                  {change.label || "DMR row"}
                                </span>
                              </td>
                              <td className={`px-4 py-3 capitalize ${muted}`}>
                                {change.field || "row"}
                              </td>
                              <td
                                className={`max-w-[220px] px-4 py-3 ${darkMode ? "text-red-200" : "text-red-700"}`}
                              >
                                <span className="line-clamp-2 break-words">
                                  {change.before || "Blank"}
                                </span>
                              </td>
                              <td
                                className={`max-w-[220px] px-4 py-3 ${darkMode ? "text-emerald-200" : "text-emerald-700"}`}
                              >
                                <span className="line-clamp-2 break-words">
                                  {change.after || "Blank"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
          <div
            className={`flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[34px] border ${darkMode ? "border-white/10 bg-[#111216] text-white" : "border-black/10 bg-[#f7f5ef] text-[#171714]"}`}
          >
            <div
              className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${activeDetail.soft}`}
                >
                  <span
                    className={`h-4 w-4 rounded-md ${activeDetail.accent}`}
                  />
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}
                  >
                    {activeDetail.eyebrow}
                  </p>
                  <h3 className="mt-2 truncate text-3xl font-semibold">
                    {activeDetail.title}
                  </h3>
                  <p className={`mt-1 text-sm ${muted}`}>
                    Details from {data?.sheetName || "today's DMR"}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailSection(null)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              {activeDetail.id === "equipment" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeDetail.items.map((item) => (
                    <article
                      key={item.id}
                      className={`flex min-h-44 flex-col rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${activeDetail.soft}`}
                        >
                          {item.site || "No site"}
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
                        >
                          {item.quantity || "—"}
                        </span>
                      </div>
                      <p className="mt-5 text-lg font-semibold">
                        {item.details || "Equipment"}
                      </p>
                      <div
                        className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-black/[0.06] text-black/50"}`}
                      >
                        Equipment & tools entry
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "materials" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeDetail.items.map((item) => (
                    <article
                      key={item.id}
                      className={`flex min-h-44 flex-col rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${activeDetail.soft}`}
                        >
                          {item.site || "No site"}
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
                        >
                          {[item.quantity, item.unit]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </span>
                      </div>
                      <p className="mt-5 text-lg font-semibold">
                        {item.details || "Material"}
                      </p>
                      <div
                        className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-black/[0.06] text-black/50"}`}
                      >
                        Materials entry
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "notes" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeDetail.items.map((item, index) => (
                    <article
                      key={item.id}
                      className={`flex min-h-44 flex-col rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${activeDetail.soft}`}
                        >
                          Note {index + 1}
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}
                        >
                          Remark
                        </span>
                      </div>
                      <p className="mt-5 text-sm leading-6">{item.note}</p>
                      <div
                        className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-black/[0.06] text-black/50"}`}
                      >
                        Site note
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "attendance" && (
                <div>
                  <div className="mb-5 grid grid-cols-3 gap-3 text-xs">
                    <div
                      className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-emerald-400/10 text-emerald-200" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}
                    >
                      <p className="text-3xl font-semibold">
                        {attendanceSummary.present}
                      </p>
                      <p className="mt-1">Present</p>
                    </div>
                    <div
                      className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-red-400/10 text-red-200" : "border-red-100 bg-red-50 text-red-700"}`}
                    >
                      <p className="text-3xl font-semibold">
                        {attendanceSummary.absent}
                      </p>
                      <p className="mt-1">Absent</p>
                    </div>
                    <div
                      className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-white/5 text-white/55" : "border-black/[0.06] bg-white text-black/50"}`}
                    >
                      <p className="text-3xl font-semibold">
                        {attendanceSummary.pending}
                      </p>
                      <p className="mt-1">Pending</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeDetail.items.map((item, index) => {
                      const status = String(item.status || "")
                        .trim()
                        .toLowerCase();
                      const statusLabel =
                        status === "p"
                          ? "Present"
                          : status === "a"
                            ? "Absent"
                            : status === "l"
                              ? "Leave"
                              : "Pending";
                      const statusTone =
                        status === "p"
                          ? "text-emerald-700 bg-emerald-500/10"
                          : status === "a"
                            ? "text-red-700 bg-red-500/10"
                            : status === "l"
                              ? "text-amber-700 bg-amber-500/10"
                              : darkMode
                                ? "text-white/45 bg-white/5"
                                : "text-black/45 bg-black/[0.04]";
                      const headerColor =
                        status === "p"
                          ? "bg-[#75e6b4]"
                          : status === "a"
                            ? "bg-[#ff9aa2]"
                            : status === "l"
                              ? "bg-[#f5f76a]"
                              : "bg-[#6f7df2]";
                      const initials = (item.name || "?")
                        .split(/\s+/)
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <article
                          key={item.id}
                          className={`overflow-hidden rounded-[22px] border ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                        >
                          <div
                            className={`flex items-center justify-between px-4 py-3 text-sm font-semibold ${headerColor} text-[#171714]`}
                          >
                            <span>
                              STAFF-{String(index + 1).padStart(3, "0")}
                            </span>
                            <span>{data?.sheetName || date}</span>
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className={`text-xs ${muted}`}>
                                  Project Staff
                                </p>
                                <h4 className="mt-2 small tracking-wide text-black dark:text-white min-h-12 text-xl font-semibold">
                                  {item.name || "Unnamed staff"}
                                </h4>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusTone}`}
                              >
                                {statusLabel}
                              </span>
                            </div>

                            {/* <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`rounded-lg px-2.5 py-1 text-[11px] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>Row {index + 1}</span>
                              <span className={`rounded-lg px-2.5 py-1 text-[11px] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>DMR attendance</span>
                            </div> */}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {!activeDetail.items.length && (
                <div
                  className={`rounded-[24px] border px-4 py-10 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/45" : "border-black/[0.06] bg-white text-black/45"}`}
                >
                  No details added in this section yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fillOpen && (
        <div className="fixed inset-0 z-50 bg-[#171714]/60 backdrop-blur-md">
          <div
            className={`flex h-[100dvh] w-screen flex-col overflow-hidden ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#faf9f5] text-[#171714]"}`}
          >
            <div
              className={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <div>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}
                >
                  Fill DMR
                </p>
                <h3 className="mt-1 text-2xl font-semibold">
                  {data?.sheetName || "Today"} entries
                </h3>
                <p className={`mt-1 hidden text-sm sm:block ${muted}`}>
                  Pick a site from the left, then fill planned and actual
                  manpower trade-wise.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setDmrSheetOpen(true)}
                    className={`flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium sm:px-4 sm:text-sm ${darkMode ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10" : "border-black/10 bg-white text-black/65 hover:bg-black/[0.04]"}`}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Sheet link
                </button>
                <button
                  onClick={() => setFillOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:overflow-hidden">
              {!dmrSheetLinked && (
                <div
                  className={`mb-4 rounded-2xl  px-4 py-3 text-xs ${darkMode ? "border-amber-400/20 bg-amber-400/5 text-amber-200/75" : "border-amber-500/20 bg-amber-50 text-amber-800"}`}
                >
                  No DMR sheet is linked yet. Super Admin must link a native
                  Google Sheet before anyone can fill records.
                </div>
              )}
              {dmrSheetLinked && !data?.canEdit && (
                <div
                  className={`mb-4 rounded-2xl  px-4 py-3 text-xs ${darkMode ? "border-amber-400/20 bg-amber-400/5 text-amber-200/75" : "border-amber-500/20 bg-amber-50 text-amber-800"}`}
                >
                  You can view DMR, but your role does not have fill permission.
                </div>
              )}

              <div
                className={`mb-3 flex gap-2 overflow-x-auto rounded-2xl p-1.5 ${darkMode ? "bg-white/[0.035]" : "bg-[#ebe6dc]"}`}
              >
                {[
                  ["manpower", "Manpower", filteredRecords.length],
                  [
                    "attendance",
                    "Attendance",
                    data?.today?.staffAttendance?.length || 0,
                  ],
                  ["equipment", "Equipment & Tools", fillEquipmentRows.length],
                  ["materials", "Materials", fillMaterialRows.length],
                  ["notes", "Notes", fillNoteRows.length],
                ].map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFillTab(value)}
                    className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${fillTab === value ? (darkMode ? "bg-[#d8f36a] text-black" : "bg-white text-black") : muted}`}
                  >
                    <span className="font-medium">{label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${fillTab === value ? "bg-black/10" : darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {fillTab === "manpower" && (
                <>
                  <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside
                      className={`min-h-0 overflow-hidden rounded-[22px] border ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}
                    >
                      <div
                        className={`border-b p-3 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                      >
                        <p
                          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                        >
                          Sites
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {siteFilter === "all" ? "All sites" : siteFilter}
                        </p>
                      </div>
                      <div className="max-h-64 space-y-1 overflow-y-auto p-2 lg:max-h-[calc(100dvh-330px)] lg:pb-20">
                        {fillSiteOptions.map((site) => {
                          const selected = siteFilter === site.value;
                          return (
                            <button
                              key={site.value}
                              type="button"
                              onClick={() => setSiteFilter(site.value)}
                              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${selected ? (darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white") : darkMode ? "text-white/65 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"}`}
                            >
                              <span className="truncate font-medium">
                                {site.label}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${selected ? "bg-black/10 text-inherit" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}
                              >
                                {site.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </aside>
                    <section className="min-h-0">
                      <label className="relative mb-3 block">
                        <Filter
                          className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`}
                        />
                        <input
                          value={agencySearch}
                          onChange={(event) =>
                            setAgencySearch(event.target.value)
                          }
                          placeholder="Search trade / agency in selected site..."
                          className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}
                        />
                      </label>
                      <div className="overflow-visible pb-6 pr-1 lg:max-h-[calc(100dvh-330px)] lg:overflow-y-auto lg:pb-24">
                        <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                          {filteredRecords.map((record) => (
                            <article
                              key={record.id}
                              className={`rounded-[22px] p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.07] bg-white"}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-lg font-semibold">
                                    {record.agency}
                                  </p>
                                  <p className={`mt-1 text-xs ${muted}`}>
                                    {record.site}
                                  </p>
                                </div>
                                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px]">
                                  Row {record.rowNumber}
                                </span>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <label
                                  className={`text-[11px] ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    Planned
                                    {autoPlannedForRecord(record) !== "" && (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}
                                      >
                                        Auto
                                      </span>
                                    )}
                                  </span>
                                  <input
                                    disabled={!canFillDmr}
                                    type="number"
                                    value={valueFor(record, "planned")}
                                    onChange={(event) =>
                                      updateDraft(
                                        record,
                                        "planned",
                                        event.target.value,
                                      )
                                    }
                                    className={`mt-2 h-12 w-full rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-emerald-400/20 bg-emerald-400/10 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
                                  />
                                </label>
                                <label
                                  className={`text-[11px] ${darkMode ? "text-red-300" : "text-red-700"}`}
                                >
                                  Actual
                                  <input
                                    disabled={!canFillDmr}
                                    type="number"
                                    value={valueFor(record, "actual")}
                                    onChange={(event) =>
                                      updateDraft(
                                        record,
                                        "actual",
                                        event.target.value,
                                      )
                                    }
                                    className={`mt-2 h-12 w-full rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-red-400/20 bg-red-400/10 text-white" : "border-red-200 bg-red-50 text-red-900"}`}
                                  />
                                </label>
                              </div>
                            </article>
                          ))}
                          {!filteredRecords.length && (
                            <div
                              className={`rounded-[24px] border px-4 py-10 text-center text-sm xl:col-span-3 2xl:col-span-4 ${darkMode ? "border-white/10 bg-white/[0.025] text-white/45" : "border-black/[0.06] bg-white text-black/45"}`}
                            >
                              No manpower rows found for this site or search.
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                </>
              )}

              <div
                className={
                  fillTab === "manpower"
                    ? "mt-0"
                    : "mt-4 max-h-[calc(100vh-260px)] min-h-0 overflow-y-auto pb-24 pr-1"
                }
              >
                {fillTab === "equipment" && (
                  <section className={`rounded-[24px]  p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">
                          Equipments and Tools
                        </h4>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Add tools, machinery, and quantities used today.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canFillDmr || addingRow === "equipment"}
                        onClick={() => addSectionRow("equipment")}
                        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                      >
                        {addingRow === "equipment" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Add row
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {fillEquipmentRows.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-2 sm:grid-cols-[1fr_1.2fr_.7fr]"
                        >
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "site")}
                            onChange={(event) =>
                              updateDraft(item, "site", event.target.value)
                            }
                            placeholder="Site"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "details")}
                            onChange={(event) =>
                              updateDraft(item, "details", event.target.value)
                            }
                            placeholder="Details"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "quantity")}
                            onChange={(event) =>
                              updateDraft(item, "quantity", event.target.value)
                            }
                            placeholder="Nos/Pair"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {fillTab === "materials" && (
                  <section className={`rounded-[24px]  p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">
                          Materials Details
                        </h4>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Track site-wise material, unit, and quantity.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canFillDmr || addingRow === "materials"}
                        onClick={() => addSectionRow("materials")}
                        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                      >
                        {addingRow === "materials" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Add row
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {fillMaterialRows.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-2 sm:grid-cols-[1fr_1.2fr_.55fr_.55fr]"
                        >
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "site")}
                            onChange={(event) =>
                              updateDraft(item, "site", event.target.value)
                            }
                            placeholder="Site"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "details")}
                            onChange={(event) =>
                              updateDraft(item, "details", event.target.value)
                            }
                            placeholder="Details"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "unit")}
                            onChange={(event) =>
                              updateDraft(item, "unit", event.target.value)
                            }
                            placeholder="Unit"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "quantity")}
                            onChange={(event) =>
                              updateDraft(item, "quantity", event.target.value)
                            }
                            placeholder="Qty"
                            className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {fillTab === "notes" && (
                  <section className={`rounded-[24px]  p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">Notes</h4>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Write any site remarks, issues, or next-day reminders.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canFillDmr || addingRow === "notes"}
                        onClick={() => addSectionRow("notes")}
                        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                      >
                        {addingRow === "notes" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Add row
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {fillNoteRows.map((item, index) => (
                        <textarea
                          key={item.id}
                          disabled={!canFillDmr}
                          value={valueFor(item, "note")}
                          onChange={(event) =>
                            updateDraft(item, "note", event.target.value)
                          }
                          placeholder={`Note ${index + 1}`}
                          rows={2}
                          className={`w-full rounded-2xl border px-3 py-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {fillTab === "attendance" && (
                  <section className={`rounded-[24px]  p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">
                          Project Staff Attendance
                        </h4>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Mark Present in green, Absent in red, or Leave when
                          required.
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-700">
                          {fillAttendanceSummary.present} Present
                        </span>
                        <span className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-700">
                          {fillAttendanceSummary.absent} Absent
                        </span>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {(data?.today?.staffAttendance || []).map((item) => {
                        const currentStatus = String(
                          valueFor(item, "status") || "",
                        )
                          .trim()
                          .toUpperCase();
                        const statusMeta =
                          currentStatus === "P"
                            ? {
                                label: "Present",
                                chip: "bg-emerald-500/10 text-emerald-700",
                                dot: "bg-emerald-500",
                              }
                            : currentStatus === "A"
                              ? {
                                  label: "Absent",
                                  chip: "bg-red-500/10 text-red-700",
                                  dot: "bg-red-500",
                                }
                              : currentStatus === "L"
                                ? {
                                    label: "Leave",
                                    chip: "bg-amber-500/10 text-amber-700",
                                    dot: "bg-amber-500",
                                  }
                                : {
                                    label: "Pending",
                                    chip: darkMode
                                      ? "bg-white/5 text-white/45"
                                      : "bg-black/[0.04] text-black/45",
                                    dot: darkMode
                                      ? "bg-white/30"
                                      : "bg-black/30",
                                  };
                        const options = [
                          {
                            value: "P",
                            label: "Present",
                            active:
                              "bg-emerald-500 text-white border-emerald-500",
                            idle: darkMode
                              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                          },
                          {
                            value: "A",
                            label: "Absent",
                            active: "bg-red-500 text-white border-red-500",
                            idle: darkMode
                              ? "border-red-400/25 bg-red-400/10 text-red-200 hover:bg-red-400/15"
                              : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
                          },
                          {
                            value: "L",
                            label: "Leave",
                            active:
                              "bg-orange-500 text-white border-orange-500",
                            idle: darkMode
                              ? "border-orange-400/25 bg-orange-400/10 text-orange-200 hover:bg-orange-400/15"
                              : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
                          },
                        ];
                        return (
                          <article
                            key={item.id}
                            className={`flex min-h-48 flex-col rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}
                              >
                                <span className="text-sm font-semibold">
                                  {(item.name || "?")
                                    .split(/\s+/)
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${statusMeta.chip}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                                />
                                {statusMeta.label}
                              </span>
                            </div>
                            <div className="mt-5 min-w-0">
                              <p className=" text-xl tracking-wide text-black small font-semibold">
                                {item.name}
                              </p>
                              <p className={`mt-1 text-xs ${muted}`}>
                                Project staff attendance
                              </p>
                            </div>
                            <div
                              className={`mt-auto pt-5 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                            >
                              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                                {options.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    disabled={!canFillDmr}
                                    onClick={() =>
                                      updateDraft(item, "status", option.value)
                                    }
                                    className={`h-9 rounded-xl  px-2 text-[14px]  transition disabled:cursor-not-allowed disabled:opacity-50 ${currentStatus === option.value ? option.active : option.idle}`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>
            <div
              className={`flex shrink-0 items-center justify-end gap-2 border-t px-3 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}
            >
              <button
                onClick={() => setFillOpen(false)}
                className={`h-11 rounded-full border px-5 text-sm ${darkMode ? "border-white/10 text-white/60" : "border-black/10 text-black/60"}`}
              >
                Cancel
              </button>
              <button
                disabled={
                  !canFillDmr ||
                  saving ||
                  (!Object.keys(drafts).length && !hasAutoPlannedDrafts)
                }
                onClick={saveDmr}
                className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-36 sm:flex-none sm:px-6 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{" "}
                Save to Sheet
              </button>
            </div>
            {dmrSheetOpen && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#171714]/45 p-4 backdrop-blur-sm">
                <section
                  className={`w-full max-w-2xl rounded-[28px] border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-white text-[#171714]"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}
                      >
                        DMR Sheet Link
                      </p>
                      <h4 className="mt-2 text-xl font-semibold">
                        {data?.dmrSettings?.linked
                          ? "Google Sheet connected"
                          : "No DMR sheet linked"}
                      </h4>
                      <p className={`mt-1 text-xs ${muted}`}>
                        {data?.dmrSettings?.linked
                          ? `Active sheet ID: ${data.dmrSettings.spreadsheetId}`
                          : data?.canManageDmrSettings
                            ? "Paste a native Google Sheet link here once. After that, all DMR reads and fills use that sheet."
                            : "Ask Super Admin to link the DMR Google Sheet before filling records."}
                      </p>
                    </div>
                    <button
                      onClick={() => setDmrSheetOpen(false)}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {data?.canManageDmrSettings && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        value={dmrSheetLink}
                        onChange={(event) =>
                          setDmrSheetLink(event.target.value)
                        }
                        placeholder="Paste DMR Google Sheet link or ID"
                        className={`h-12 min-w-0 rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#fafafa]"}`}
                      />
                      <button
                        type="button"
                        disabled={dmrSheetSaving || !dmrSheetLink.trim()}
                        onClick={linkDmrSheet}
                        className={`h-12 rounded-2xl px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                      >
                        {dmrSheetSaving
                          ? "Linking..."
                          : data?.dmrSettings?.linked
                            ? "Replace"
                            : "Link"}
                      </button>
                      {data?.dmrSettings?.linked && (
                        <button
                          type="button"
                          disabled={dmrSheetSaving}
                          onClick={() => setUnlinkConfirmOpen(true)}
                          className={`h-12 rounded-2xl border px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-red-400/25 text-red-200 hover:bg-red-400/10" : "border-red-200 text-red-700 hover:bg-red-50"}`}
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        darkMode={darkMode}
        open={unlinkConfirmOpen}
        title="Unlink DMR sheet"
        message="Unlink the current DMR sheet? Existing Google Sheet data will not be deleted."
        confirmLabel="Unlink"
        loading={dmrSheetSaving}
        onCancel={() => setUnlinkConfirmOpen(false)}
        onConfirm={unlinkDmrSheet}
      />
    </div>
  );
}
