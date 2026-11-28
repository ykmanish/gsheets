"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Building2,
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
  Package,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Search,
  Send,
  Settings2,
  StickyNote,
  Users,
  Wrench,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip, ConfirmModal, DatePicker, DateRangePicker, EmptyState, IconTile, PageHeader, SelectMenu, StatTile, TimeInput, useClickOutside } from "./ui";

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

// The CEO report opens on Trade by site only - the other modules are opt-in.
const DMR_REPORT_DEFAULT_SECTION = "tradeSiteManpower";

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

function isDmrOthersRecord(record = {}) {
  return /^others?$/i.test(String(record.agency || "").trim());
}

function planStatusTone(status, darkMode) {
  return status.ok
    ? darkMode
      ? "bg-emerald-400/10 text-emerald-200 border-transparent"
      : "bg-[#e4f1e6] text-[#2f7a4f] border-transparent"
    : darkMode
      ? "bg-red-400/10 text-red-200 border-transparent"
      : "bg-[#fbe4e6] text-[#c0394b] border-transparent";
}

function ChartLegendDot({ className, label, muted }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] ${muted}`}>
      <i className={`h-2 w-2 rounded-full ${className}`} /> {label}
    </span>
  );
}

function WorkloadBars({ title, items = [], darkMode, icon = Users, tone = "sky" }) {
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
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
      className={`min-w-0 overflow-hidden rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
          <div className="min-w-0">
            <h3 className={`truncate text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h3>
            <p className={`text-[12.5px] ${muted}`}>
              {totalActual} actual / {totalPlanned} planned
            </p>
          </div>
        </div>
        <ChartLegendDot className={darkMode ? "bg-[#cff07a]" : "bg-[#141414]"} label="Actual" muted={muted} />
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
                <p className={`text-[15px] tabular-nums ${darkMode ? "text-white" : "text-[#141414]"}`}>
                  {actual}
                </p>
                <p className={`text-[11px] tabular-nums ${muted}`}>/{planned}</p>
              </div>
              <div className="flex h-36 w-full max-w-[40px] items-end">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-[14px] ${darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]"}`}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-[14px] ${darkMode ? "bg-white/[0.07]" : "bg-[#ebebe8]"}`}
                    style={{ height: `${plannedHeight}%` }}
                  />
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-[14px] ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`}
                    style={{ height: `${actualHeight}%` }}
                  />
                </div>
              </div>
              <p
                className={`mt-3 line-clamp-2 min-h-8 text-center text-[11.5px] leading-4 ${muted}`}
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
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
      className={`min-w-0 overflow-hidden rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={CalendarDays} tone="lavender" darkMode={darkMode} size="sm" />
          <div className="min-w-0">
            <h3 className={`text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h3>
            <p className={`text-[12.5px] ${muted}`}>
              {totalActual} actual / {total} planned across {items.length} site
              {items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <ChartLegendDot className={darkMode ? "bg-white/25" : "bg-[#d6d6d2]"} label="Planned" muted={muted} />
          <ChartLegendDot className="bg-[#4fae7a]" label="Actual ok" muted={muted} />
          <ChartLegendDot className="bg-[#e5484d]" label="Attention" muted={muted} />
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
                  className={`text-[15px] tabular-nums ${status.ok ? (darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]") : darkMode ? "text-[#f7aab5]" : "text-[#c0394b]"}`}
                >
                  {actual}
                </p>
                <p className={`text-[11px] tabular-nums ${muted}`}>/{value}</p>
              </div>
              <div className="flex h-36 w-full max-w-[46px] items-end">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-[14px] ${darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]"}`}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-[14px] ${darkMode ? "bg-white/15" : "bg-[#e3e3df]"}`}
                    style={{ height: `${plannedHeight}%` }}
                  />
                  <div
                    className={`absolute bottom-0 left-1 right-1 rounded-[11px] ${status.ok ? "bg-[#4fae7a]" : "bg-[#e5484d]"}`}
                    style={{ height: `${actualHeight}%` }}
                  />
                </div>
              </div>
              <p
                className={`mt-3 line-clamp-2 min-h-8 text-center text-[11.5px] leading-4 ${muted}`}
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

function ReportDateRangePicker({ darkMode, startValue, endValue, onStartChange, onEndChange }) {
  return (
    <DateRangePicker
      darkMode={darkMode}
      from={startValue}
      to={endValue}
      className=""
      onChange={({ from, to }) => {
        onStartChange(from);
        onEndChange(to);
      }}
    />
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
      className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className={`text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h4>
          {subtitle && <p className={`mt-1 text-xs ${muted}`}>{subtitle}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {actions}
          <span
            className={`inline-flex h-7 w-fit items-center rounded-full px-3 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
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
                ? "text-white/45"
                : "text-[#8a8a8a]"
            }
          >
            <tr>
              {headers.map((header, headerIndex) => (
                <th
                  key={header}
                  className={`px-5 py-3 text-[12px] ${columnClasses[headerIndex] || ""}`}
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
                className={`border-t ${darkMode ? "border-white/[0.06] hover:bg-white/[0.03]" : "border-[#f0f0ee] hover:bg-[#fafaf9]"}`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-5 py-3 align-top ${cellIndex === 0 ? "" : ""} ${columnClasses[cellIndex] || ""}`}
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
  return <span className="text-inherit">{value}</span>;
}

function ReportActualValue({ planned, actual }) {
  const plannedValue = Number(planned) || 0;
  const actualValue = Number(actual) || 0;
  const ok = actualValue >= plannedValue;
  return (
    <span
      className={` ${ok ? "text-[#3f9a66]" : "text-[#d64550]"}`}
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
  onExport,
  exportLoading = "",
}) {
  const scrollRef = useRef(null);
  const exportRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState("site");
  const [exportSite, setExportSite] = useState("");
  const [exportTrade, setExportTrade] = useState("");
  const [exportIncludeEmpty, setExportIncludeEmpty] = useState(false);
  useClickOutside(exportRef, () => setExportOpen(false));
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

  const exportGroups = useMemo(() => {
    const sites = new Map();
    const trades = new Map();
    for (const item of rows) {
      if (item.rowType === "average") continue;
      const site = String(item.site || "Unassigned site");
      const trade = String(item.trade || "General");
      const weight = (Number(item.planned) || 0) + (Number(item.actual) || 0);
      const siteEntry = sites.get(site.toLowerCase()) || { label: site, weight: 0 };
      siteEntry.weight += weight;
      sites.set(site.toLowerCase(), siteEntry);
      const tradeEntry = trades.get(trade.toLowerCase()) || { label: trade, weight: 0 };
      tradeEntry.weight += weight;
      trades.set(trade.toLowerCase(), tradeEntry);
    }
    const sort = (list) =>
      [...list.values()].sort((a, b) => a.label.localeCompare(b.label));
    return { site: sort(sites), trade: sort(trades) };
  }, [rows]);

  const exportSelectOptions = (dimension) => [
    {
      value: "",
      label: `All ${dimension === "trade" ? "trades" : "sites"} (${(exportGroups[dimension] || []).length})`,
    },
    ...(exportGroups[dimension] || []).map((item) => ({
      value: item.label,
      label: item.weight ? item.label : `${item.label} - no data`,
    })),
  ];
  const exportBusy = Boolean(exportLoading);
  const exportKey = `${exportMode}:${exportMode === "trade" ? "" : exportSite}:${exportMode === "site" ? "" : exportTrade}`;

  function runExport(mode, site, trade, includeEmpty = exportIncludeEmpty) {
    if (!onExport) return;
    setExportOpen(false);
    onExport({ mode, site, trade, includeEmpty });
  }

  function runPopoverExport() {
    runExport(
      exportMode,
      exportMode === "trade" ? "" : exportSite,
      exportMode === "site" ? "" : exportTrade,
    );
  }

  const exportModeHint =
    exportMode === "combo"
      ? "Pick a site, a trade, or both. Leaving one on \"All\" keeps every value for that side."
      : exportMode === "trade"
        ? "One section per trade with a planned/actual column for every date in the report range."
        : "One section per site with a planned/actual column for every date in the report range.";

  return (
    <section
      className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className={`text-[15px] lg:whitespace-nowrap ${darkMode ? "text-white" : "text-[#141414]"}`}>
            Trade by site manpower
          </h4>
          <p className={`mt-1 text-xs ${muted}`}>{matrixRows.length} rows</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
          <div className="relative w-full sm:w-72">
            <Search
              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`}
            />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search site or trade..."
              className={`h-10 w-full rounded-full pl-11 pr-4 text-sm outline-none transition ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09]" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
            />
          </div>
          {onExport && (
            <div ref={exportRef} className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setExportOpen((current) => !current)}
                disabled={exportBusy}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-full border px-4 text-[13px] transition disabled:opacity-60 sm:w-auto ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
              >
                {exportBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Export PDF</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${exportOpen ? "rotate-180" : ""}`}
                />
              </button>
              {exportOpen && (
                <div
                  className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-[18px] border p-3 shadow-[0_18px_50px_rgba(0,0,0,0.12)] ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                >
                  <p
                    className={`px-1 text-[12px] ${muted}`}
                  >
                    Group the PDF by
                  </p>
                  <div
                    className={`mt-2 flex rounded-full p-1 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}
                  >
                    {[
                      { id: "site", label: "Site" },
                      { id: "trade", label: "Trade" },
                      { id: "combo", label: "Site + trade" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setExportMode(option.id)}
                        className={`h-8 flex-1 rounded-full px-1 text-[12.5px] transition ${exportMode === option.id ? (darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#141414] shadow-[0_1px_4px_rgba(0,0,0,0.08)]") : darkMode ? "text-white/60 hover:text-white" : "text-[#7a7a78] hover:text-black"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {exportMode !== "trade" && (
                    <>
                      <p
                        className={`mt-3 px-1 text-[11px] ${muted}`}
                      >
                        Site
                      </p>
                      <div className="mt-2">
                        <SelectMenu
                          darkMode={darkMode}
                          value={exportSite}
                          options={exportSelectOptions("site")}
                          onChange={setExportSite}
                          searchable
                          searchPlaceholder="Search site..."
                          placeholder="Choose a site"
                        />
                      </div>
                    </>
                  )}
                  {exportMode !== "site" && (
                    <>
                      <p
                        className={`mt-3 px-1 text-[11px] ${muted}`}
                      >
                        Trade
                      </p>
                      <div className="mt-2">
                        <SelectMenu
                          darkMode={darkMode}
                          value={exportTrade}
                          options={exportSelectOptions("trade")}
                          onChange={setExportTrade}
                          searchable
                          searchPlaceholder="Search trade..."
                          placeholder="Choose a trade"
                        />
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setExportIncludeEmpty((current) => !current)}
                    className={`mt-3 flex w-full items-center gap-2.5 rounded-[12px] px-1 py-2 text-left text-xs ${darkMode ? "text-white/70" : "text-[#5f5f5c]"}`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border transition ${exportIncludeEmpty ? "border-[#141414] bg-[#141414] text-white" : darkMode ? "border-white/20" : "border-[#d6d6d2]"}`}
                    >
                      {exportIncludeEmpty && <Check className="h-3 w-3" />}
                    </span>
                    Include rows with no manpower
                  </button>
                  <button
                    type="button"
                    onClick={runPopoverExport}
                    disabled={exportBusy}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#141414] text-[13px] text-white transition hover:bg-black disabled:opacity-60"
                  >
                    {exportLoading === exportKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PDF
                  </button>
                  <p className={`mt-2 px-1 text-[11px] leading-4 ${muted}`}>
                    {exportModeHint}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 2)}
        className="relative overflow-x-auto"
      >
        {scrolled && (
          <div className="pointer-events-none sticky left-[340px] top-0 z-40 float-left h-0 w-0">
            <span className="absolute top-0 block h-[10000px] w-6 bg-gradient-to-r from-black/[0.06] to-transparent" />
          </div>
        )}
        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-sm">
          <thead
            className={
              darkMode
                ? "text-white/45"
                : "text-[#8a8a8a]"
            }
          >
            <tr>
              <th
                className={`sticky left-0 z-30 w-[170px] border-b px-5 py-3 text-[12px] ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
              >
                Site
              </th>
              <th
                className={`sticky left-[170px] z-30 w-[170px] border-b px-5 py-3 text-[12px] ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
              >
                Trade
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className={`w-[130px] border-b px-4 py-3 text-[12px] ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
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
                className={`group ${darkMode ? "hover:bg-white/[0.035]" : "hover:bg-[#f7f7f5]"}`}
              >
                <td
                  className={`sticky left-0 z-20 w-[170px] border-b px-5 py-3 align-top ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{row.site}</span>
                    {onExport && (
                      <button
                        type="button"
                        title={`Download PDF for site ${row.site}`}
                        aria-label={`Download PDF for site ${row.site}`}
                        onClick={() => runExport("site", row.site, "")}
                        disabled={exportBusy}
                        className={`shrink-0 rounded-lg p-1 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40 ${darkMode ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-[#8a8a8a] hover:bg-[#f6f6f4]"}`}
                      >
                        {exportLoading === `site:${row.site}:` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </span>
                </td>
                <td
                  className={`sticky left-[170px] z-20 w-[170px] border-b px-5 py-3 align-top ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{row.trade}</span>
                    {onExport && (
                      <span className="flex shrink-0 items-center">
                        <button
                          type="button"
                          title={`Download PDF for trade ${row.trade}`}
                          aria-label={`Download PDF for trade ${row.trade}`}
                          onClick={() => runExport("trade", "", row.trade)}
                          disabled={exportBusy}
                          className={`rounded-lg p-1 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40 ${darkMode ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-[#8a8a8a] hover:bg-[#f6f6f4]"}`}
                        >
                          {exportLoading === `trade::${row.trade}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          title={`Download PDF for ${row.site} + ${row.trade}`}
                          aria-label={`Download PDF for site ${row.site} and trade ${row.trade}`}
                          onClick={() => runExport("combo", row.site, row.trade)}
                          disabled={exportBusy}
                          className={`rounded-lg p-1 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40 ${darkMode ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-[#8a8a8a] hover:bg-[#f6f6f4]"}`}
                        >
                          {exportLoading === `combo:${row.site}:${row.trade}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Rows3 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </span>
                    )}
                  </span>
                </td>
                {dates.map((date) => {
                  const item = row.values.get(date) || {
                    planned: 0,
                    actual: 0,
                  };
                  return (
                    <td
                      key={date}
                      className={`w-[130px] border-b px-4 py-3 align-top ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
                    >
                      <span className="text-inherit">
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
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
      className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className={`text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h4>
          {subtitle && <p className={`mt-1 text-xs ${muted}`}>{subtitle}</p>}
        </div>
        <div className={`flex gap-3 text-[11px] ${muted}`}>
          <span className="inline-flex items-center gap-1.5">
            <i className={`h-2 w-2 rounded-full ${darkMode ? "bg-white/40" : "bg-[#141414]"}`} /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-[#4fae7a]" /> Actual ok
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-[#e5484d]" /> Short
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
                <p className="truncate text-sm">
                  {item[labelKey]}
                </p>
                {item.trade && (
                  <p className={`truncate text-[12px] ${muted}`}>
                    {item.trade}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <div
                  className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-[#ebebe8]"}`}
                >
                  <div
                    className={`h-full rounded-full ${darkMode ? "bg-white/40" : "bg-[#141414]"}`}
                    style={{ width: `${Math.max(2, (planned / max) * 100)}%` }}
                  />
                </div>
                <div
                  className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-[#ebebe8]"}`}
                >
                  <div
                    className={`h-full rounded-full ${ok ? "bg-[#4fae7a]" : "bg-[#e5484d]"}`}
                    style={{
                      width: `${actual ? Math.max(2, (actual / max) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-right text-sm">
                <span className="text-inherit">{planned}</span>
                <span className={muted}> / </span>
                <span
                  className={` ${ok ? "text-[#3f9a66]" : "text-[#d64550]"}`}
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const chartItems = items || [];
  const max = Math.max(
    1,
    ...chartItems.map((item) =>
      Math.max(Number(item.planned) || 0, Number(item.actual) || 0),
    ),
  );
  return (
    <section
      className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className={`text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>Daily planned vs actual</h4>
          <p className={`mt-1 text-xs ${muted}`}>
            Each date in the selected range, including dates with no data.
          </p>
        </div>
        <div className={`flex gap-3 text-[11px] ${muted}`}>
          <span className="inline-flex items-center gap-1.5">
            <i className={`h-2 w-2 rounded-full ${darkMode ? "bg-white/40" : "bg-[#141414]"}`} /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-[#6b9fe0]" /> Actual
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
                  className={`text-xs ${actual >= planned ? "text-[#3f9a66]" : "text-[#d64550]"}`}
                >
                  {actual}
                </p>
                <p className={`text-[12px] ${muted}`}>/{planned}</p>
              </div>
              <div className="flex h-36 w-full max-w-[44px] items-end">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-[14px] ${darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]"}`}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-[14px] ${darkMode ? "bg-white/15" : "bg-[#dcdcd8]"}`}
                    style={{ height: `${plannedHeight}%` }}
                  />
                  <div
                    className="absolute bottom-0 left-1 right-1 rounded-[11px] bg-[#6b9fe0]"
                    style={{ height: `${actualHeight}%` }}
                  />
                </div>
              </div>
              <p className={`mt-3 text-center text-[11px] leading-4 ${muted}`}>
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const chartItems = items
    .filter((item) => Number(item.planned) || Number(item.actual))
    .slice(0, 24);
  return (
    <section
      className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
    >
      <div className="mb-5">
        <h4 className={`text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>Trade by site attention map</h4>
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
              className={`rounded-[16px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}
            >
              <p className="truncate text-sm">{item.site}</p>
              <p className={`mt-1 truncate text-xs ${muted}`}>{item.trade}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="text-2xl">{planned}</p>
                <p
                  className={`text-2xl ${ok ? "text-[#3f9a66]" : "text-[#d64550]"}`}
                >
                  {actual}
                </p>
              </div>
              <div
                className={`mt-3 h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-[#ebebe8]"}`}
              >
                <div
                  className={`h-full rounded-full ${ok ? "bg-[#4fae7a]" : "bg-[#e5484d]"}`}
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const line = darkMode ? "border-white/[0.07]" : "border-[#f0f0ee]";
  const head = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const rowHover = darkMode
    ? "hover:bg-white/[0.03]"
    : "hover:bg-[#fafaf9]";
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Planned", totalPlanned, Users, "sky"],
          ["Actual", totalActual, Check, totalStatus.ok ? "mint" : "rose"],
          [
            "Variance",
            `${totalStatus.variance >= 0 ? "+" : ""}${totalStatus.variance}`,
            Rows3,
            "lavender",
          ],
          ["Needs attention", attentionCount, BellRing, attentionCount ? "peach" : "neutral"],
        ].map(([label, value, icon, tone]) => (
          <StatTile
            key={label}
            darkMode={darkMode}
            icon={icon}
            tone={tone}
            value={value}
            label={label}
          />
        ))}
      </div>

      <section
        className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={Rows3} tone="lavender" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h4 className="text-[15px]">
                {activePlanTitle} trade by site
              </h4>
              <p className={`text-[12px] ${muted}`}>CEO summary</p>
            </div>
          </div>
          <Chip darkMode={darkMode} tone="neutral">
            {siteColumns.length} sites · {tradeRows.length} trades
          </Chip>
        </div>
        <div className="max-h-[58vh] overflow-auto px-3 pb-3">
          <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-xs">
            <thead className={head}>
              <tr>
                <th
                  className={`sticky left-0 top-0 z-30 min-w-[120px] border-b px-2.5 py-2 text-[11px] ${line} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}
                >
                  Trade
                </th>
                {siteColumns.map((site) => (
                  <th
                    key={site}
                    className={`sticky top-0 z-20 min-w-[112px] max-w-[150px] whitespace-normal break-words border-b px-2.5 py-2 text-[11px] leading-4 ${line} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}
                  >
                    {site}
                  </th>
                ))}
                <th
                  className={`sticky top-0 z-20 min-w-[90px] border-b px-2.5 py-2 text-[11px] ${line} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tradeRows.map((trade) => (
                <tr key={trade.trade} className={rowHover}>
                  <td
                    className={`sticky left-0 z-10 border-b px-2.5 py-2 ${line} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}
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
                            <p className="text-base leading-none">
                              {cell.people}
                              <span className={muted}>/</span>
                              <span
                                className={
                                  actualOk ? "text-[#3f9a66]" : "text-[#d64550]"
                                }
                              >
                                {actual}
                              </span>
                            </p>
                            <p className={`text-[12px] ${muted}`}>
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
                          <p className="text-base leading-none">
                            {trade.totalPeople}
                            <span className={muted}>/</span>
                            <span
                              className={
                                actualOk ? "text-[#3f9a66]" : "text-[#d64550]"
                              }
                            >
                              {actualTotal}
                            </span>
                          </p>
                        );
                      })()}
                      <p className={`text-[12px] ${muted}`}>
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
        className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={FileSpreadsheet} tone="amber" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h4 className="text-[15px]">
                {activeTomorrowSite?.site || "All sites"}
              </h4>
              <p className={`text-[12px] ${muted}`}>Work plan</p>
            </div>
          </div>
          <Chip darkMode={darkMode} tone="neutral">
            {detailRecords.length} items
          </Chip>
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
                    className="px-5 py-3 text-[12px]"
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
                  <td className="max-w-[200px] px-5 py-3">
                    {record.site || "Unassigned"}
                  </td>
                  <td className="px-5 py-3">{record.category || "General"}</td>
                  <td className="px-5 py-3 text-lg">
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
  const [reportSections, setReportSections] = useState(() => [
    DMR_REPORT_DEFAULT_SECTION,
  ]);
  const [reportTradeSearch, setReportTradeSearch] = useState("");
  const [tradeSitePdfLoading, setTradeSitePdfLoading] = useState("");
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

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const panel = darkMode
    ? "border border-white/10 bg-[#15171c]"
    : "border border-[#ececec] bg-white";
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
  const otherRemarksBySite = useMemo(() => {
    return new Map(
      (data?.today?.otherRemarks || []).map((item) => [
        comparablePlanText(item.site),
        item,
      ]),
    );
  }, [data?.today?.otherRemarks]);
  const valueFor = (record, key) => {
    if (key === "planned") {
      const autoPlanned = autoPlannedForRecord(record);
      if (autoPlanned !== "") return autoPlanned;
    }
    if (key === "remark" && isDmrOthersRecord(record)) {
      return drafts[record.id]?.remark ?? otherRemarksBySite.get(comparablePlanText(record.site))?.remark ?? "";
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
        remark:
          current[record.id]?.remark ??
          (isDmrOthersRecord(record)
            ? otherRemarksBySite.get(comparablePlanText(record.site))?.remark
            : record.remark),
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
      await load(false, true);
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
        reportSections.length ? reportSections : [DMR_REPORT_DEFAULT_SECTION]
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

  async function downloadTradeSitePdf({
    mode = "site",
    site = "",
    trade = "",
    includeEmpty = false,
  } = {}) {
    const scope = [site, trade].filter(Boolean).join(" + ");
    try {
      setTradeSitePdfLoading(`${mode}:${site}:${trade}`);
      const params = new URLSearchParams({
        startDate: reportStartDate,
        endDate: reportEndDate,
        groupBy: mode,
      });
      if (site) params.set("site", site);
      if (trade) params.set("trade", trade);
      if (includeEmpty) params.set("includeEmpty", "1");
      const response = await fetch(
        `${API_URL}/dmr-dashboard/report/trade-site/pdf?${params.toString()}`,
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not download trade by site PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug =
        String(scope || `all-${mode === "trade" ? "trade" : "site"}s`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || mode;
      link.href = url;
      link.download = `dmr-trade-by-${mode}-${slug}-${reportStartDate}-to-${reportEndDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(
        scope
          ? `PDF downloaded for ${scope}`
          : `PDF downloaded for all ${mode === "trade" ? "trades" : "sites"}`,
      );
    } catch (error) {
      toast.error(error.message || "Could not download trade by site PDF");
    } finally {
      setTradeSitePdfLoading("");
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
        accent: "bg-[#f2b8a0]",
        soft: darkMode
          ? "bg-[#ff7a2f]/10 text-orange-200"
          : "bg-[#fbe5dc] text-[#c2562b]",
        count: equipment.length,
        items: equipment,
      },
      {
        id: "materials",
        eyebrow: "Materials",
        title: `${materials.length} ${materials.length === 1 ? "entry" : "entries"}`,
        hint: materials[0]?.details || "Material issue and quantity details",
        chip: "Stock",
        accent: "bg-[#f0d488]",
        soft: darkMode
          ? "bg-[#f2c94c]/10 text-yellow-200"
          : "bg-[#fbf0d4] text-[#8a6200]",
        count: materials.length,
        items: materials,
      },
      {
        id: "notes",
        eyebrow: "Notes",
        title: `${notes.length} ${notes.length === 1 ? "note" : "notes"}`,
        hint: notes[0]?.note || "Site remarks and reminders",
        chip: "Remarks",
        accent: "bg-[#9fd8b3]",
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
          : "bg-[#e3eefb] text-[#2f6fc0]",
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
        className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}
      >
        <div
          className={`w-full max-w-2xl rounded-[20px] border p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
        >
          <div className="flex items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span
                className={`absolute inset-0 animate-ping rounded-[18px] opacity-30 ${darkMode ? "bg-[#cff07a]/40" : "bg-[#e4f1e6]"}`}
              />
              <IconTile icon={FileSpreadsheet} tone="mint" darkMode={darkMode} size="lg" className="relative" />
            </span>
            <div>
              <p className={`text-[12px] ${muted}`}>DMR workspace</p>
              <h2 className={`mt-1 flex flex-wrap items-center gap-2 text-[20px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>
                Opening today&apos;s live manpower sheet
                <span
                  className="inline-flex items-center gap-1 pt-1"
                  aria-hidden="true"
                >
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`}
                  />
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:120ms] ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`}
                  />
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:240ms] ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`}
                  />
                </span>
              </h2>
              <p className={`mt-1.5 text-[13px] ${muted}`}>
                If today&apos;s tab is missing, it will be created automatically
                from the latest DMR format.
              </p>
            </div>
          </div>
          <div
            className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-[#f4f4f2]"}`}
          >
            <div
              className={`h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`}
            />
          </div>
        </div>
      </div>
    );
  }

  const sectionCardLook = {
    equipment: { icon: Wrench, tone: "peach" },
    materials: { icon: Package, tone: "amber" },
    notes: { icon: StickyNote, tone: "lavender" },
    attendance: { icon: Users, tone: "sky" },
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}
    >
      <div className="mx-auto w-full">
        <PageHeader
          darkMode={darkMode}
          className="relative z-30 mb-8"
          badge="Projects · DMR"
          badgeIcon={FileSpreadsheet}
          badgeTone="mint"
          title="Daily manpower"
          subtitle="planned vs actual, site by site"
          description="Live attendance across all sites and agencies. Fill today's DMR without touching spreadsheet cells."
          actions={
            <>
              <div className="w-full min-w-0 sm:w-[220px]">
                <DatePicker
                  darkMode={darkMode}
                  value={date}
                  onChange={setDate}
                  placeholder="Choose DMR date"
                />
              </div>
              <div ref={heroActionRef} className="relative z-40 min-w-0">
                <Button
                  darkMode={darkMode}
                  variant="secondary"
                  icon={Settings2}
                  onClick={() => setHeroActionOpen((value) => !value)}
                  className="h-10"
                >
                  Actions
                  <ChevronDown className={`h-4 w-4 transition-transform ${heroActionOpen ? "rotate-180" : ""}`} />
                </Button>
                {heroActionOpen && (
                  <div className={`absolute right-0 top-[calc(100%+8px)] z-[120] w-[290px] overflow-hidden rounded-[18px] border p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.12)] ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
                    {[
                      {
                        label: "CEO Report",
                        helper: "Download and preview DMR PDF",
                        icon: FileSpreadsheet,
                        tone: "mint",
                        onClick: () => {
                          setReportClosing(false);
                          setReportOpen(true);
                        },
                      },
                      {
                        label: "Today's Plan",
                        helper: "Review current manpower plan",
                        icon: CalendarDays,
                        tone: "sky",
                        onClick: () => {
                          setSelectedTomorrowSite("");
                          setPlanMode("today");
                        },
                      },
                      {
                        label: "Tomorrow's Plan",
                        helper: "Review next day manpower plan",
                        icon: CalendarDays,
                        tone: "lavender",
                        onClick: () => {
                          setSelectedTomorrowSite("");
                          setPlanMode("tomorrow");
                        },
                      },
                      {
                        label: "Reminders",
                        helper: "WhatsApp DMR reminder timing",
                        icon: BellRing,
                        tone: "rose",
                        onClick: openReminderDrawer,
                      },
                      {
                        label: refreshing ? "Refreshing..." : "Refresh",
                        helper: "Sync latest DMR data",
                        icon: RefreshCw,
                        tone: "neutral",
                        disabled: refreshing,
                        onClick: () => load(true, true),
                        spin: refreshing,
                      },
                      ...(data?.canViewHistory ? [{
                        label: "History",
                        helper: "View DMR version changes",
                        icon: History,
                        tone: "amber",
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
                          className={`flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left text-[13.5px] transition disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "text-white hover:bg-white/[0.06]" : "text-[#141414] hover:bg-[#f4f4f2]"}`}
                        >
                          <IconTile icon={<Icon className={`h-4 w-4 ${item.spin ? "animate-spin" : ""}`} />} tone={item.tone} darkMode={darkMode} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block">{item.label}</span>
                            <span className={`block text-[12px] ${muted}`}>{item.helper}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={CalendarDays}
                className="h-10"
                onClick={() => {
                  setFillTab("manpower");
                  setFillOpen(true);
                }}
              >
                Fill DMR
              </Button>
            </>
          }
        />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <WorkloadBars
            title="Site-wise actual manpower"
            items={siteManpowerBreakdown}
            darkMode={darkMode}
            icon={Building2}
            tone="sky"
          />
          <WorkloadBars
            title="Top agencies today"
            items={agencyManpowerBreakdown}
            darkMode={darkMode}
            icon={Users}
            tone="lavender"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sectionCards.map((card) => {
            const look = sectionCardLook[card.id] || { icon: FileSpreadsheet, tone: "neutral" };
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetailSection(card.id)}
                className={`group relative flex min-h-44 flex-col rounded-[20px] p-5 text-left transition-colors ${panel} ${darkMode ? "hover:bg-[#191b21]" : "hover:bg-[#fcfcfb]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <IconTile icon={look.icon} tone={look.tone} darkMode={darkMode} />
                  <Chip darkMode={darkMode} tone={card.count ? "mint" : "neutral"}>
                    {card.count ? "Added" : "Empty"}
                  </Chip>
                </div>
                <p className={`mt-4 text-[12.5px] ${muted}`}>{card.eyebrow}</p>
                <h3 className={`mt-0.5 text-[22px] tracking-[-0.02em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{card.title}</h3>
                <p className={`mt-2 line-clamp-2 text-[13px] leading-5 ${muted}`}>
                  {card.hint}
                </p>
                <p
                  className={`mt-auto pt-4 text-[12px] transition-colors ${darkMode ? "text-white/45 group-hover:text-[#cff07a]" : "text-[#8a8a8a] group-hover:text-[#141414]"}`}
                >
                  View details
                </p>
              </button>
            );
          })}
        </div>

        <section className={`mt-4 rounded-[20px] p-5 ${panel}`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={Building2} tone="mint" darkMode={darkMode} size="sm" />
              <div className="min-w-0">
                <h3 className={`text-[15px] ${darkMode ? "text-white" : "text-[#141414]"}`}>
                  Project manpower
                </h3>
                <p className={`text-[12.5px] ${muted}`}>
                  {data?.sheetName || "Today"} · {projectManpowerCards.length}{" "}
                  project sites
                </p>
              </div>
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
                  className={`h-10 w-full rounded-full pl-11 pr-4 text-sm outline-none transition sm:w-64 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                />
              </label>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projectManpowerCards.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProject(project)}
                className={`group flex min-h-80 flex-col rounded-[20px] border p-5 text-left transition-colors ${darkMode ? "border-white/10 bg-[#15171c] hover:bg-[#191b21]" : "border-[#ececec] bg-white hover:bg-[#fcfcfb]"}`}
              >
                <div className={`flex items-start justify-between gap-3 border-b pb-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <IconTile icon={Building2} tone="sky" darkMode={darkMode} />
                    <div className="min-w-0">
                      <p className={`text-[12px] ${muted}`}>In production</p>
                      <h4 className={`truncate text-[18px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>
                        {project.site}
                      </h4>
                    </div>
                  </div>
                  <Chip darkMode={darkMode} tone={project.variance < 0 ? "rose" : "mint"} className="tabular-nums">
                    {project.variance >= 0 ? "+" : ""}
                    {project.variance}
                  </Chip>
                </div>

                <div className="mt-5">
                  <p className={`line-clamp-2 text-[13px] leading-5 ${muted}`}>
                    Note:{" "}
                    {project.agencies.slice(0, 3).join(", ") ||
                      "No agencies filled yet"}
                    {project.agencies.length > 3
                      ? ` +${project.agencies.length - 3}`
                      : ""}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[13px]">
                    <span className={muted}>Progress</span>
                    <span className="tabular-nums">{project.progress}%</span>
                  </div>
                  <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full">
                    {(() => {
                      const planned = Math.max(Number(project.planned) || 0, 0);
                      const actual = Math.max(Number(project.actual) || 0, 0);
                      const variance = Math.abs(Number(project.variance) || 0);
                      const total = planned + actual + variance || 1;
                      return [
                        {
                          label: "Planned",
                          value: planned,
                          color: "bg-[#f2b8a0]",
                        },
                        {
                          label: "Actual",
                          value: actual,
                          color: "bg-[#f0d488]",
                        },
                        {
                          label: "Variance",
                          value: variance,
                          color: "bg-[#9fd8b3]",
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
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <ChartLegendDot className="bg-[#f2b8a0]" label="Planned" muted={muted} />
                    <ChartLegendDot className="bg-[#f0d488]" label="Actual" muted={muted} />
                    <ChartLegendDot className="bg-[#9fd8b3]" label="Variance" muted={muted} />
                  </div>
                </div>

                <div className="mt-5 pb-2">
                  <p className={`text-[12.5px] ${muted}`}>Active agencies</p>
                  <div className="mt-2.5 flex items-center">
                    {project.agencies.slice(0, 5).map((agency, index) => (
                      <span
                        key={agency}
                        title={agency}
                        className={`-ml-2 first:ml-0 grid h-9 w-9 place-items-center rounded-full border-2 text-[11px] ${darkMode ? "border-[#15171c] bg-white/10 text-white" : "border-white bg-[#f4f4f2] text-[#3d3d3b]"}`}
                      >
                        {agency
                          .split(/\s+/)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || index + 1}
                      </span>
                    ))}
                    <Chip darkMode={darkMode} tone="neutral" className="ml-3">
                      {project.agencies.length} agencies
                    </Chip>
                  </div>
                </div>

                <div
                  className={`mt-auto grid grid-cols-3 items-end gap-2 border-t pt-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
                >
                  <div>
                    <p className="text-[18px] tabular-nums">{project.planned}</p>
                    <p className={`text-[12px] ${muted}`}>Planned</p>
                  </div>
                  <div>
                    <p className="text-[18px] tabular-nums">{project.actual}</p>
                    <p className={`text-[12px] ${muted}`}>Actual</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] ${darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white"}`}
                    >
                      View
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {!projectManpowerCards.length && (
              <EmptyState
                darkMode={darkMode}
                icon={Building2}
                tone="neutral"
                title="No project manpower"
                text="Nothing matches the selected site or search."
                className="md:col-span-2 xl:col-span-3"
              />
            )}
          </div>
        </section>
      </div>

      {planMode && (
        <div
          className={`fixed inset-0 z-50 flex ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}
        >
          <div className="flex h-[100dvh] w-screen flex-col overflow-hidden">
            <div
              className={`flex flex-col gap-4 border-b px-4 py-4 sm:px-7 sm:py-5 md:flex-row md:items-center md:justify-between ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <IconTile icon={CalendarDays} tone={planMode === "today" ? "sky" : "lavender"} darkMode={darkMode} />
                <div className="min-w-0">
                  <p className={`text-[12px] ${muted}`}>
                    {activePlanTitle}
                  </p>
                  <h3 className="text-[22px] leading-tight tracking-[-0.02em] sm:text-[26px]">
                    {activePlanHeading}
                  </h3>
                  <p className={`mt-0.5 text-[13px] ${muted}`}>
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
                  <Button
                    darkMode={darkMode}
                    variant="accent"
                    onClick={downloadDmrReportPdf}
                    disabled={reportPdfLoading}
                    loading={reportPdfLoading}
                    icon={reportPdfLoading ? undefined : Download}
                    className="h-10 flex-1 sm:flex-none"
                  >
                    Download Today&apos;s PDF
                  </Button>
                )}
                <Button
                  darkMode={darkMode}
                  variant={ceoPlanView ? "primary" : "secondary"}
                  onClick={() => setCeoPlanView((value) => !value)}
                  className={`h-10 flex-1 sm:flex-none ${ceoPlanView && darkMode ? "!bg-[#cff07a] !text-black" : ""}`}
                >
                  CEO&apos;s View
                </Button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    setPlanMode(null);
                    setSelectedTomorrowSite("");
                  }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {activePlan?.error && (
                <div
                  className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${darkMode ? "border-red-400/20 bg-red-400/5 text-red-200" : "border-red-500/20 bg-[#fbe4e6] text-[#c0394b]"}`}
                >
                  Could not load {activePlanTitle} sheet: {activePlan.error}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside
                  className={`rounded-[20px] border p-3 lg:sticky lg:top-0 lg:self-start ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                >
                  <p
                    className={`px-3 py-2 text-[12px] ${muted}`}
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
                      className={`flex w-full items-center justify-between rounded-[14px] px-4 py-2.5 text-left text-[13.5px] transition ${!activeTomorrowSite ? (darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white") : darkMode ? "text-white/65 hover:bg-white/5" : "text-[#5f5f5c] hover:bg-[#f4f4f2]"}`}
                    >
                      <span className="">Overview</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${!activeTomorrowSite ? (darkMode ? "bg-black/15 text-inherit" : "bg-white/15 text-inherit") : darkMode ? "bg-white/5 text-white/45" : "bg-[#f4f4f2] text-[#8a8a8a]"}`}
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
                          className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-4 py-2.5 text-left text-[13.5px] transition ${selected ? (darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white") : darkMode ? "text-white/65 hover:bg-white/5" : "text-[#5f5f5c] hover:bg-[#f4f4f2]"}`}
                        >
                          <span className="truncate ">{site.site}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${selected ? (darkMode ? "bg-black/15 text-inherit" : "bg-white/15 text-inherit") : darkMode ? "bg-white/5 text-white/45" : "bg-[#f4f4f2] text-[#8a8a8a]"}`}
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
                        className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm">
                              {activePlanTitle} manpower summary
                            </p>
                            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                              <div>
                                <p className="text-6xl leading-none">
                                  {activePlanStatus.planned}
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  planned
                                </p>
                              </div>
                              <div>
                                <p
                                  className={`text-5xl leading-none ${activePlanStatus.ok ? "text-[#3f9a66]" : "text-[#d64550]"}`}
                                >
                                  {activePlanStatus.actual}
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  actual
                                </p>
                              </div>
                              <span
                                className={`mb-2 rounded-full border px-3 py-1 text-sm ${planStatusTone(activePlanStatus, darkMode)}`}
                              >
                                {activePlanProgress}% progress
                              </span>
                            </div>
                            <p className={`mt-3 text-sm ${muted}`}>
                              {activePlanSummaryText}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-[#f4f4f2] text-[#7a7a78]"}`}
                          >
                            Live sheet
                          </span>
                        </div>
                        <div
                          className={`mt-5 h-3 rounded-full ${darkMode ? "bg-white/10" : "bg-[#ebebe8]"}`}
                        >
                          <div
                            className={`h-full rounded-full ${activePlanStatus.ok ? "bg-[#4fae7a]" : "bg-red-500"}`}
                            style={{
                              width: `${Math.min(100, Math.max(4, (activePlanStatus.actual / Math.max(1, activePlanStatus.planned)) * 100))}%`,
                            }}
                          />
                        </div>
                        <div
                          className={`mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
                        >
                          <div>
                            <p
                              className={`text-3xl ${activePlanStatus.ok ? "text-[#3f9a66]" : "text-[#d64550]"}`}
                            >
                              {activePlanStatus.variance >= 0 ? "+" : ""}
                              {activePlanStatus.variance}
                            </p>
                            <p className={muted}>variance</p>
                          </div>
                          <div>
                            <p className="text-3xl">
                              {activePlan?.summary?.sites || 0}
                            </p>
                            <p className={muted}>sites</p>
                          </div>
                          <div>
                            <p
                              className={`text-3xl ${attentionPlanSites.length ? "text-[#d64550]" : "text-[#3f9a66]"}`}
                            >
                              {attentionPlanSites.length}
                            </p>
                            <p className={muted}>attention</p>
                          </div>
                        </div>
                        <div
                          className={`mt-4 rounded-[16px] p-4 ${attentionPlanSites.length ? (darkMode ? "border-red-400/20 bg-red-400/5" : "bg-[#fdf1f2]") : darkMode ? "border-emerald-400/20 bg-emerald-400/5" : "bg-[#eef6ef]"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p
                              className={`text-sm ${attentionPlanSites.length ? (darkMode ? "text-red-200" : "text-red-700") : darkMode ? "text-emerald-200" : "text-emerald-700"}`}
                            >
                              What needs attention
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs ${attentionPlanSites.length ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
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
                                  className={`flex items-center justify-between gap-3 rounded-full px-3.5 py-2 text-[13px] ${darkMode ? "bg-black/15" : "bg-white/80"}`}
                                >
                                  <span className="truncate">
                                    {site.site}
                                  </span>
                                  <span
                                    className={`shrink-0 ${status.ok ? "text-[#3f9a66]" : "text-[#d64550]"}`}
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
                            className={`mt-4 rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#f7f7f5]"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm">
                                  Submission timing
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  Cutoff: 3:30 PM IST
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${!activePlanTimeliness.length ? (darkMode ? "bg-white/5 text-white/55" : "bg-[#f4f4f2] text-[#7a7a78]") : activePlanTimeliness.some((item) => item.status === "delayed") ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
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
                                    className={`flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 text-[13px] ${darkMode ? "bg-black/15" : "bg-white/75"}`}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate">
                                        {item.name}
                                      </p>
                                      <p
                                        className={`mt-0.5 truncate text-[12px] ${muted}`}
                                      >
                                        {item.records} entr
                                        {item.records === 1 ? "y" : "ies"}
                                        {item.lastSubmittedAt
                                          ? ` · ${item.lastSubmittedAt}`
                                          : ""}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${delayed ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}
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
                      className={`rounded-[20px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p
                            className={`text-[12px] ${muted}`}
                          >
                            Selected project site
                          </p>
                          <h4 className="mt-2 text-3xl">
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
                          className={`rounded-[20px] border px-5 py-4 text-right ${planStatusTone(planActualStatus(activeTomorrowSite.plannedManpower, activeTomorrowSite.actualManpower), darkMode)}`}
                        >
                          <p className="text-4xl leading-none">
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
                                className={`flex min-h-72 flex-col overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}
                              >
                                <div
                                  className={`border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <IconTile icon={Rows3} tone="amber" darkMode={darkMode} size="sm" />
                                      <h5 className="truncate text-lg">
                                        {record.category}
                                      </h5>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
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
                                        className={`mt-1 text-5xl leading-none ${people === null ? muted : ""}`}
                                      >
                                        {people ?? "—"}
                                      </p>
                                    </div>
                                    <span
                                      className={`rounded-full px-3 py-1.5 text-xs ${people !== null ? "bg-emerald-500/10 text-emerald-700" : darkMode ? "bg-white/5 text-white/45" : "bg-[#f4f4f2] text-[#8a8a8a]"}`}
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
                                      <span className="">
                                        Share of site manpower
                                      </span>
                                      <span className="">
                                        {progress === null
                                          ? "—"
                                          : `${Math.round(progress)}%`}
                                      </span>
                                    </div>
                                    <div
                                      className={`h-3 rounded-full ${darkMode ? "bg-white/10" : "bg-[#ebebe8]"}`}
                                    >
                                      <div
                                        className={`h-full rounded-full ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`}
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
            className={`dmr-report-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${reportExpanded ? "dmr-report-shell-expanded" : ""} ${reportClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#141414]"}`}
            role="dialog"
            aria-modal="true"
            aria-label="DMR performance report"
          >
            <div
              className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <IconTile icon={FileSpreadsheet} tone="mint" darkMode={darkMode} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">CEO report</span>
                  <span className={`block truncate text-[12px] ${muted}`}>DMR performance</span>
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReportExpanded((current) => !current)}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f4f4f2] text-[#5f5f5c] hover:bg-[#f6f6f4]"}`}
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
                  type="button"
                  onClick={closeReportDrawer}
                  aria-label="Close"
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 md:grid-cols-[250px_minmax(0,1fr)]">
              <aside
                className={`min-h-0 overflow-y-auto border-b p-5 md:border-b-0 md:border-r ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
              >
                <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] ${darkMode ? "bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"}`}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CEO report
                </span>
                <h3 className={`mt-4 text-[22px] leading-tight tracking-[-0.02em] ${darkMode ? "text-white" : "text-[#141414]"}`}>
                  DMR performance report
                </h3>
                <p className={`mt-2 text-xs leading-5 ${muted}`}>
                  Planned versus actual progress, attendance and site
                  performance in one view.
                </p>
                <div
                  className={`mt-5 rounded-[16px] p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]"}`}
                >
                  <p
                    className={`text-[12px] ${muted}`}
                  >
                    Report range
                  </p>
                  <p className="mt-2 text-sm">{reportStartDate}</p>
                  <p className={`my-1 text-xs ${muted}`}>to</p>
                  <p className="text-sm">{reportEndDate}</p>
                </div>
                <div className="mt-5">
                  <p
                    className={`text-[12px] ${muted}`}
                  >
                    Included sections
                  </p>
                  <p className="mt-2 text-3xl">
                    {reportSections.length}
                  </p>
                  <p className={`text-xs ${muted}`}>report modules selected</p>
                </div>
                {reportData && (
                  <div
                    className={`mt-5 rounded-[16px] border p-4 ${darkMode ? "border-white/10" : "border-[#ececec]"}`}
                  >
                    <p className={`text-xs ${muted}`}>Overall progress</p>
                    <p className={`mt-1 text-3xl tabular-nums ${darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]"}`}>
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
                className={`min-h-0 overflow-y-auto p-5 sm:p-6 ${darkMode ? "bg-[#121317]" : "bg-[#f7f7f5]"}`}
              >
                <section
                  className={`rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
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
                            className={`h-8 rounded-full border px-3.5 text-[12.5px] transition ${darkMode ? "border-white/10 bg-white/[0.04] hover:bg-white/10" : "border-[#e6e6e3] bg-white hover:bg-[#f6f6f4]"}`}
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
                        className={`flex h-10 min-w-40 items-center justify-center gap-2 rounded-full px-5 text-[13px] transition disabled:opacity-60 ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
                          className={`h-8 rounded-full border px-3.5 text-[12.5px] transition ${selected ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-black" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/10 text-white/50" : "border-[#e6e6e3] bg-white text-[#7a7a78]"}`}
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
                      className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p
                            className={`text-[12px] ${muted}`}
                          >
                            {reportData.startDate} to {reportData.endDate}
                          </p>
                          <h4 className="mt-2 text-2xl">
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
                          className={`rounded-[20px] px-5 py-4 text-right ${reportData.summary.progress >= 90 ? (darkMode ? "bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]") : reportData.summary.progress >= 60 ? (darkMode ? "bg-[rgba(251,191,36,0.13)] text-[#f5d27a]" : "bg-[#fbf0d4] text-[#8a6200]") : darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b]"}`}
                        >
                          <p className="text-4xl leading-none">
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
                        ].map(([label, value], index) => (
                          <StatTile
                            key={label}
                            darkMode={darkMode}
                            tone={["mint", "sky", "lavender", "peach", "amber", "lime", "rose", "neutral"][index % 8]}
                            value={value}
                            label={label}
                            className="min-h-[92px]"
                          />
                        ))}
                      </div>
                      {reportData.summary.datesWithoutData?.length > 0 && (
                        <div
                          className={`mt-4 rounded-[14px] px-4 py-3 text-[13px] ${darkMode ? "bg-amber-400/[0.08] text-amber-100" : "bg-[#fbf3dc] text-[#4a3a1c]"}`}
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
                        onExport={downloadTradeSitePdf}
                        exportLoading={tradeSitePdfLoading}
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
                    {reportData.otherRemarks?.length > 0 && (
                      <ReportTable
                        title="Other Remarks"
                        headers={["Date", "Site", "Actual", "Remark"]}
                        rows={reportData.otherRemarks
                          .slice(0, 30)
                          .map((item) => [
                            item.date,
                            item.site || "-",
                            item.actual || "-",
                            item.remark || "-",
                          ])}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:p-7">
          <div
            className={`flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] ${darkMode ? "border border-white/10 bg-[#15171c] text-white" : "border border-[#e6e6e3] bg-white text-[#141414]"}`}
          >
            <div
              className={`flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <div className="flex min-w-0 items-center gap-4">
                <IconTile icon={Building2} tone="sky" darkMode={darkMode} />
                <div className="min-w-0">
                  <p className={`text-[12px] ${muted}`}>
                    Project manpower
                  </p>
                  <h3 className="truncate text-[24px] leading-tight tracking-[-0.02em]">
                    {selectedProject.site}
                  </h3>
                  <p className={`mt-0.5 text-[13px] ${muted}`}>
                    {selectedProject.actual} actual / {selectedProject.planned}{" "}
                    planned · {selectedProject.agencies.length} agencies
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedProject(null)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              <div
                className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className={`text-[12px] ${muted}`}>
                      Manpower mix
                    </p>
                    <h4 className="mt-1 text-[22px] tracking-[-0.02em]">
                      {selectedProject.progress}% progress
                    </h4>
                    <p className={`mt-1 text-sm ${muted}`}>
                      Planned, actual and variance at a glance.
                    </p>
                  </div>
                  <Chip darkMode={darkMode} tone={selectedProject.variance < 0 ? "rose" : "mint"}>
                    {selectedProject.variance >= 0 ? "+" : ""}
                    {selectedProject.variance} variance
                  </Chip>
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
                        color: "bg-[#f2b8a0]",
                      },
                      { label: "Actual", value: actual, color: "bg-[#f0d488]" },
                      {
                        label: "Variance",
                        value: variance,
                        color: "bg-[#9fd8b3]",
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
                    <i className="h-2 w-2 rounded-full bg-[#f2b8a0]" /> Planned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-[#f0d488]" /> Actual
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-[#9fd8b3]" /> Variance
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
                      : "bg-[#fbe5dc] text-[#c2562b]",
                  },
                  {
                    label: "Actual",
                    value: selectedProject.actual,
                    tone: darkMode
                      ? "bg-[#f2c94c]/10 text-yellow-200"
                      : "bg-[#fbf0d4] text-[#8a6200]",
                  },
                  {
                    label: "Variance",
                    value: `${selectedProject.variance >= 0 ? "+" : ""}${selectedProject.variance}`,
                    tone:
                      selectedProject.variance < 0
                        ? darkMode
                          ? "bg-red-400/10 text-red-200"
                          : "bg-[#fbe4e6] text-[#c0394b]"
                        : darkMode
                          ? "bg-emerald-400/10 text-emerald-200"
                          : "bg-[#e4f1e6] text-[#2f7a4f]",
                  },
                  {
                    label: "Progress",
                    value: `${selectedProject.progress}%`,
                    tone: darkMode
                      ? "bg-blue-400/10 text-blue-200"
                      : "bg-[#e3eefb] text-[#2f6fc0]",
                  },
                ].map((metric, metricIndex) => (
                  <StatTile
                    key={metric.label}
                    darkMode={darkMode}
                    icon={[Users, Check, Rows3, CalendarDays][metricIndex]}
                    tone={["peach", "amber", selectedProject.variance < 0 ? "rose" : "mint", "sky"][metricIndex]}
                    value={metric.value}
                    label={metric.label}
                  />
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-[18px] tracking-[-0.01em]">
                      Who is active on this project
                    </h4>
                    <p className={`text-[13px] ${muted}`}>
                      Agency details
                    </p>
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
                          className={`rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[15px]">
                                {row.agency || "Unnamed agency"}
                              </p>
                              <p className={`mt-1 text-xs ${muted}`}>
                                {row.site || selectedProject.site}
                              </p>
                            </div>
                            <span
                              className={`inline-flex h-7 items-center rounded-full px-3 text-[12.5px] ${variance < 0 ? (darkMode ? "bg-red-400/10 text-red-200" : "bg-[#fbe4e6] text-[#c0394b]") : darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-[#e4f1e6] text-[#2f7a4f]"}`}
                            >
                              {variance >= 0 ? "+" : ""}
                              {variance}
                            </span>
                          </div>
                          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                            {[
                              { value: planned, color: "bg-[#f2b8a0]" },
                              { value: actual, color: "bg-[#f0d488]" },
                              {
                                value: Math.abs(variance),
                                color: "bg-[#9fd8b3]",
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
                              className={`rounded-[14px] px-3 py-2 ${darkMode ? "bg-[#ff7a2f]/10 text-orange-200" : "bg-[#fbe5dc] text-[#c2562b]"}`}
                            >
                              <p className="text-base">
                                {planned}
                              </p>
                              <p className="opacity-70">Planned</p>
                            </div>
                            <div
                              className={`rounded-[14px] px-3 py-2 ${darkMode ? "bg-[#f2c94c]/10 text-yellow-200" : "bg-[#fbf0d4] text-[#8a6200]"}`}
                            >
                              <p className="text-base">
                                {actual}
                              </p>
                              <p className="opacity-70">Actual</p>
                            </div>
                            <div
                              className={`rounded-[14px] px-3 py-2 ${darkMode ? "bg-white/5 text-white/65" : "bg-[#f7f7f5] text-[#5f5f5c]"}`}
                            >
                              <p className="text-base">
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
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReminderOpen(false);
          }}
        >
          <form
            onSubmit={saveDmrReminderSchedule}
            className={`flex h-[100dvh] w-screen flex-col overflow-hidden ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}
            role="dialog"
            aria-modal="true"
            aria-label="DMR WhatsApp reminder schedule"
          >
            <div
              className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={BellRing} tone="rose" darkMode={darkMode} />
                <div className="min-w-0">
                  <p className={`text-[12px] ${muted}`}>
                    DMR WhatsApp reminders
                  </p>
                  <h3 className="text-[22px] leading-tight tracking-[-0.02em]">
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
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              <section
                className={`rounded-[20px] border p-4 sm:p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-[20px] tracking-[-0.02em]">
                      Daily schedule
                    </h4>
                    <p className={`text-[20px] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>
                      Send only to pending DMR users
                    </p>
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
                    className={`flex h-14 w-28 items-center justify-between rounded-full p-2 text-sm transition ${reminderSettings.enabled ? (darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white") : darkMode ? "bg-white/10 text-white/55" : "bg-[#ebebe8] text-[#7a7a78]"}`}
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
                  className={`mt-5 rounded-[20px] px-5 py-14 text-center text-[13px] ${darkMode ? "bg-white/[0.03] text-white/55" : "bg-[#f7f7f5] text-[#7a7a78]"}`}
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
                          className={`rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h5 className="text-[16px] tracking-[-0.01em]">
                                {item.label}
                              </h5>
                              <p className={`truncate text-[12px] ${muted}`}>
                                {item.templateName}
                              </p>
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
                              className={`inline-flex h-7 items-center rounded-full px-3 text-[12.5px] transition ${itemEnabled ? (darkMode ? "bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]") : darkMode ? "bg-white/[0.07] text-white/50" : "bg-[#f4f4f2] text-[#8a8a8a]"}`}
                            >
                              {itemEnabled ? "On" : "Off"}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto]">
                            <label className="block">
                              <span
                                className={`text-[12px] ${muted}`}
                              >
                                Reminder time
                              </span>
                              <TimeInput
                                darkMode={darkMode}
                                value={reminder.time || item.defaultTime}
                                onChange={(event) =>
                                  updateDmrReminder(item.id, {
                                    time: event.target.value,
                                  })
                                }
                                className="mt-2"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => sendDmrReminderNow(item.id)}
                              disabled={reminderSending === item.id}
                              className={`mt-auto flex h-10 items-center justify-center gap-2 rounded-full px-5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white"}`}
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
                            className={`mt-4 rounded-[14px] p-3 text-[12px] ${darkMode ? "bg-white/[0.04] text-white/60" : "bg-[#f7f7f5] text-[#7a7a78]"}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>Last run</span>
                              <span className="">
                                {status.finishedAt
                                  ? new Date(status.finishedAt).toLocaleString()
                                  : "Not sent yet"}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <span className={`rounded-full px-2 py-1 ${darkMode ? "bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"}`}>
                                {status.sent || 0} sent
                              </span>
                              <span className={`rounded-full px-2 py-1 ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b]"}`}>
                                {status.failed || 0} failed
                              </span>
                              <span className={`rounded-full px-2 py-1 ${darkMode ? "bg-[rgba(96,165,250,0.13)] text-[#a9cbf7]" : "bg-[#e3eefb] text-[#2f6fc0]"}`}>
                                {status.skipped || 0} skipped
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <section
                    className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                  >
                    <div className={`flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                      <div className="flex min-w-0 items-start gap-3">
                        <IconTile icon={Users} tone="mint" darkMode={darkMode} size="sm" />
                        <div className="min-w-0">
                        <h4 className="text-[15px]">
                          Reminder recipients
                        </h4>
                        <p className={`text-[12.5px] ${muted}`}>
                          Choose which WhatsApp contacts receive each reminder
                          category.
                        </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex h-7 w-fit items-center rounded-full px-3 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
                      >
                        {reminderContacts.length} saved contacts
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left">
                        <thead
                          className={
                            darkMode
                              ? "text-white/45"
                              : "text-[#8a8a8a]"
                          }
                        >
                          <tr>
                            <th className="px-5 py-3 text-[12px]">
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
                                  className="px-4 py-3 text-[12px]"
                                >
                                  <span className="block">{item.label}</span>
                                  <span className="mt-1 block normal-case tracking-normal text-[#8a8a8a] dark:text-white/40">
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
                              ? "divide-y divide-white/[0.07]"
                              : "divide-y divide-[#f0f0ee]"
                          }
                        >
                          {reminderContacts.map((contact) => (
                            <tr key={contact.phone}>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#e4f1e6] text-sm text-[#2f7a4f]">
                                    {(contact.name || contact.phone || "?")
                                      .split(/\s+/)
                                      .map((part) => part[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm">
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
                                      className={`inline-flex h-9 min-w-32 items-center justify-center gap-2 rounded-full border px-4 text-[13px] transition ${checked ? (darkMode ? "border-transparent bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "border-transparent bg-[#e4f1e6] text-[#2f7a4f]") : darkMode ? "border-white/10 bg-white/[0.025] text-white/50 hover:bg-white/[0.055]" : "border-[#e6e6e3] bg-white text-[#8a8a8a] hover:bg-[#f6f6f4]"}`}
                                    >
                                      <span
                                        className={`grid h-5 w-5 place-items-center rounded-full border transition ${checked ? "border-[#2f7a4f] bg-[#2f7a4f] text-white" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-[#e6e6e3] bg-white"}`}
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
              className={`flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-[#ececec]"}`}
            >
              <button
                type="button"
                onClick={() => setReminderOpen(false)}
                className={`h-10 rounded-full border px-5 text-[13px] transition ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reminderSaving || reminderLoading}
                className={`flex h-10 min-w-40 items-center justify-center gap-2 rounded-full px-6 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white"}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:p-7">
          <div
            className={`flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#e6e6e3] bg-white text-[#141414]"}`}
          >
            <div
              className={`flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={History} tone="amber" darkMode={darkMode} />
                <div className="min-w-0">
                  <p className={`text-[12px] ${muted}`}>
                    Super Admin only
                  </p>
                  <h3 className="text-[22px] leading-tight tracking-[-0.02em]">
                    DMR version history
                  </h3>
                  <p className={`mt-0.5 text-[13px] ${muted}`}>
                    Who changed what for {data?.sheetName || date}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className={`flex h-9 items-center gap-2 rounded-full border px-4 text-[12.5px] transition ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setHistoryOpen(false)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              {historyLoading && (
                <div
                  className={`rounded-[20px] px-4 py-10 text-center text-[13px] ${darkMode ? "bg-white/[0.03] text-white/55" : "bg-[#f7f7f5] text-[#7a7a78]"}`}
                >
                  Loading DMR changes…
                </div>
              )}
              {!historyLoading && !historyItems.length && (
                <div
                  className={`rounded-[20px] px-4 py-10 text-center text-[13px] ${darkMode ? "bg-white/[0.03] text-white/55" : "bg-[#f7f7f5] text-[#7a7a78]"}`}
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
                        className={`rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {(group.sections || [])
                                .slice(0, 4)
                                .map((section) => (
                                  <span
                                    key={section}
                                    className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
                                  >
                                    {section}
                                  </span>
                                ))}
                              <span
                                className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-[#e3eefb] text-[#2f6fc0]"}`}
                              >
                                {group.changeCount} change
                                {group.changeCount === 1 ? "" : "s"}
                              </span>
                            </div>
                            <h4 className="mt-3 truncate text-[15px]">
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
                            className={`h-9 rounded-full px-4 text-[12.5px] transition ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
                        className={`h-8 rounded-full border px-4 text-[12.5px] transition ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
                      >
                        Back to history
                      </button>
                      <h4 className="mt-4 text-[18px] tracking-[-0.01em]">
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
                      className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
                    >
                      {selectedHistory.changeCount} changes
                    </span>
                  </div>
                  <div
                    className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10" : "border-[#ececec]"}`}
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead
                          className={
                            darkMode
                              ? "text-white/45"
                              : "text-[#8a8a8a]"
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
                                className="px-4 py-3 text-[12px]"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody
                          className={
                            darkMode
                              ? "divide-y divide-white/[0.07]"
                              : "divide-y divide-[#f0f0ee]"
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
                                className={`max-w-[220px] px-4 py-3 ${darkMode ? "text-red-200" : "text-[#c0394b]"}`}
                              >
                                <span className="line-clamp-2 break-words">
                                  {change.before || "Blank"}
                                </span>
                              </td>
                              <td
                                className={`max-w-[220px] px-4 py-3 ${darkMode ? "text-emerald-200" : "text-[#2f7a4f]"}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:p-7">
          <div
            className={`flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#e6e6e3] bg-white text-[#141414]"}`}
          >
            <div
              className={`flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <div className="flex min-w-0 items-center gap-4">
                <IconTile icon={(sectionCardLook[activeDetail.id] || {}).icon || FileSpreadsheet} tone={(sectionCardLook[activeDetail.id] || {}).tone || "neutral"} darkMode={darkMode} />
                <div className="min-w-0">
                  <p className={`text-[12px] ${muted}`}>
                    {activeDetail.eyebrow}
                  </p>
                  <h3 className="truncate text-[22px] leading-tight tracking-[-0.02em]">
                    {activeDetail.title}
                  </h3>
                  <p className={`mt-0.5 text-[13px] ${muted}`}>
                    Details from {data?.sheetName || "today's DMR"}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDetailSection(null)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
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
                      className={`flex min-h-44 flex-col rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${activeDetail.soft}`}
                        >
                          {item.site || "No site"}
                        </span>
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
                        >
                          {item.quantity || "—"}
                        </span>
                      </div>
                      <p className="mt-5 text-[16px] leading-6">
                        {item.details || "Equipment"}
                      </p>
                      <div
                        className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-[#f0f0ee] text-[#7a7a78]"}`}
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
                      className={`flex min-h-44 flex-col rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${activeDetail.soft}`}
                        >
                          {item.site || "No site"}
                        </span>
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
                        >
                          {[item.quantity, item.unit]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </span>
                      </div>
                      <p className="mt-5 text-[16px] leading-6">
                        {item.details || "Material"}
                      </p>
                      <div
                        className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-[#f0f0ee] text-[#7a7a78]"}`}
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
                      className={`flex min-h-44 flex-col rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${activeDetail.soft}`}
                        >
                          Note {index + 1}
                        </span>
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}
                        >
                          Remark
                        </span>
                      </div>
                      <p className="mt-5 text-sm leading-6">{item.note}</p>
                      <div
                        className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-[#f0f0ee] text-[#7a7a78]"}`}
                      >
                        Site note
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "attendance" && (
                <div>
                  <div className="mb-5 grid grid-cols-3 gap-3">
                    <StatTile darkMode={darkMode} icon={Check} tone="mint" value={attendanceSummary.present} label="Present" />
                    <StatTile darkMode={darkMode} icon={X} tone="rose" value={attendanceSummary.absent} label="Absent" />
                    <StatTile darkMode={darkMode} icon={Clock3} tone="neutral" value={attendanceSummary.pending} label="Pending" />
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
                                : "text-[#8a8a8a] bg-[#f4f4f2]";
                      const headerColor =
                        status === "p"
                          ? "bg-[#e4f1e6]"
                          : status === "a"
                            ? "bg-[#fbe4e6]"
                            : status === "l"
                              ? "bg-[#fbf0d4]"
                              : "bg-[#ece8fb]";
                      const initials = (item.name || "?")
                        .split(/\s+/)
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <article
                          key={item.id}
                          className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                        >
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 text-[12.5px] ${headerColor} text-[#3d3d3b]`}
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
                                <h4 className="mt-1 min-h-12 text-[17px] tracking-[-0.01em]">
                                  {item.name || "Unnamed staff"}
                                </h4>
                              </div>
                              <span
                                className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[12.5px] ${statusTone}`}
                              >
                                {statusLabel}
                              </span>
                            </div>

                            {/* <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}>Row {index + 1}</span>
                              <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}>DMR attendance</span>
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
                  className={`rounded-[20px] px-4 py-10 text-center text-[13px] ${darkMode ? "bg-white/[0.03] text-white/45" : "bg-[#f7f7f5] text-[#8a8a8a]"}`}
                >
                  No details added in this section yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fillOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]">
          <div
            className={`flex h-[100dvh] w-screen flex-col overflow-hidden ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}
          >
            <div
              className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={CalendarDays} tone="mint" darkMode={darkMode} />
                <div className="min-w-0">
                  <p className={`text-[12px] ${muted}`}>
                    Fill DMR
                  </p>
                  <h3 className="text-[22px] leading-tight tracking-[-0.02em]">
                    {data?.sheetName || "Today"} entries
                  </h3>
                  <p className={`mt-0.5 hidden text-[13px] sm:block ${muted}`}>
                    Pick a site from the left, then fill planned and actual
                    manpower trade-wise.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setDmrSheetOpen(true)}
                    className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[12.5px] transition sm:px-4 sm:text-[13px] ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Sheet link
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setFillOpen(false)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:overflow-hidden">
              {!dmrSheetLinked && (
                <div
                  className={`mb-4 rounded-[14px] px-4 py-3 text-xs ${darkMode ? "bg-amber-400/[0.08] text-amber-100" : "bg-[#fbf3dc] text-[#4a3a1c]"}`}
                >
                  No DMR sheet is linked yet. Super Admin must link a native
                  Google Sheet before anyone can fill records.
                </div>
              )}
              {dmrSheetLinked && !data?.canEdit && (
                <div
                  className={`mb-4 rounded-[14px] px-4 py-3 text-xs ${darkMode ? "bg-amber-400/[0.08] text-amber-100" : "bg-[#fbf3dc] text-[#4a3a1c]"}`}
                >
                  You can view DMR, but your role does not have fill permission.
                </div>
              )}

              <div
                className={`mb-3 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}
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
                    className={`flex h-9 min-w-fit items-center gap-2 rounded-full px-4 text-[13px] transition ${fillTab === value ? (darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#141414] shadow-[0_1px_4px_rgba(0,0,0,0.08)]") : `${muted} ${darkMode ? "hover:text-white" : "hover:text-[#141414]"}`}`}
                  >
                    <span className="">{label}</span>
                    <span
                      className={`rounded-full px-1.5 text-[11px] ${fillTab === value ? (darkMode ? "bg-white/10" : "bg-[#f4f4f2]") : darkMode ? "bg-white/10" : "bg-[#e9e9e6]"}`}
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
                      className={`min-h-0 overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                    >
                      <div
                        className={`border-b p-3 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
                      >
                        <p className={`px-1 text-[12px] ${muted}`}>
                          Sites
                        </p>
                        <p className="px-1 text-[16px]">
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
                              className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left text-[13.5px] transition ${selected ? (darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white") : darkMode ? "text-white/65 hover:bg-white/5" : "text-[#5f5f5c] hover:bg-[#f4f4f2]"}`}
                            >
                              <span className="truncate">
                                {site.label}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${selected ? (darkMode ? "bg-black/15 text-inherit" : "bg-white/15 text-inherit") : darkMode ? "bg-white/5 text-white/45" : "bg-[#f4f4f2] text-[#8a8a8a]"}`}
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
                          className={`h-10 w-full rounded-full pl-11 pr-4 text-sm outline-none transition ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                        />
                      </label>
                      <div className="overflow-visible pb-6 pr-1 lg:max-h-[calc(100dvh-330px)] lg:overflow-y-auto lg:pb-24">
                        <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                          {filteredRecords.map((record) => (
                            <article
                              key={record.id}
                              className={`rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-[15px]">
                                    {record.agency}
                                  </p>
                                  <p className={`mt-1 text-xs ${muted}`}>
                                    {record.site}
                                  </p>
                                </div>
                                <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.07] text-white/60" : "bg-[#f4f4f2] text-[#5f5f5c]"}`}>
                                  Row {record.rowNumber}
                                </span>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <label
                                  className={`text-[12px] ${darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]"}`}
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    Planned
                                    {autoPlannedForRecord(record) !== "" && (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] ${darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-[#e4f1e6] text-[#2f7a4f]"}`}
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
                                    className={`mt-1.5 h-10 w-full rounded-full px-4 text-sm tabular-nums outline-none transition focus:ring-1 disabled:opacity-60 ${darkMode ? "bg-[rgba(74,222,128,0.12)] text-white focus:ring-white/15" : "bg-[#e4f1e6] text-[#16432c] focus:ring-[#2f7a4f]/30"}`}
                                  />
                                </label>
                                <label
                                  className={`text-[12px] ${darkMode ? "text-[#f7aab5]" : "text-[#c0394b]"}`}
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
                                    className={`mt-1.5 h-10 w-full rounded-full px-4 text-sm tabular-nums outline-none transition focus:ring-1 disabled:opacity-60 ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-white focus:ring-white/15" : "bg-[#fbe4e6] text-[#5c1f1c] focus:ring-[#c0394b]/30"}`}
                                  />
                                </label>
                              </div>
                              {isDmrOthersRecord(record) && (
                                <label
                                  className={`mt-3 block text-[12px] ${darkMode ? "text-white/60" : "text-[#5f5f5c]"}`}
                                >
                                  Remark
                                  <textarea
                                    disabled={!canFillDmr}
                                    value={valueFor(record, "remark")}
                                    onChange={(event) =>
                                      updateDraft(
                                        record,
                                        "remark",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Add line for Other work..."
                                    rows={2}
                                    className={`mt-2 w-full resize-none rounded-[16px] px-4 py-2 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                                  />
                                </label>
                              )}
                            </article>
                          ))}
                          {!filteredRecords.length && (
                            <div
                              className={`rounded-[20px] px-4 py-10 text-center text-[13px] xl:col-span-3 2xl:col-span-4 ${darkMode ? "bg-white/[0.03] text-white/45" : "bg-[#f7f7f5] text-[#8a8a8a]"}`}
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
                  <section className={`rounded-[20px] p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
                        <IconTile icon={Wrench} tone="peach" darkMode={darkMode} size="sm" className="row-span-2" />
                        <h4 className="text-[15px]">
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
                        className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "details")}
                            onChange={(event) =>
                              updateDraft(item, "details", event.target.value)
                            }
                            placeholder="Details"
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "quantity")}
                            onChange={(event) =>
                              updateDraft(item, "quantity", event.target.value)
                            }
                            placeholder="Nos/Pair"
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {fillTab === "materials" && (
                  <section className={`rounded-[20px] p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
                        <IconTile icon={Package} tone="amber" darkMode={darkMode} size="sm" className="row-span-2" />
                        <h4 className="text-[15px]">
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
                        className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "details")}
                            onChange={(event) =>
                              updateDraft(item, "details", event.target.value)
                            }
                            placeholder="Details"
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "unit")}
                            onChange={(event) =>
                              updateDraft(item, "unit", event.target.value)
                            }
                            placeholder="Unit"
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                          <input
                            disabled={!canFillDmr}
                            value={valueFor(item, "quantity")}
                            onChange={(event) =>
                              updateDraft(item, "quantity", event.target.value)
                            }
                            placeholder="Qty"
                            className={`h-10 rounded-full px-4 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {fillTab === "notes" && (
                  <section className={`rounded-[20px] p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
                        <IconTile icon={StickyNote} tone="lavender" darkMode={darkMode} size="sm" className="row-span-2" />
                        <h4 className="text-[15px]">Notes</h4>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Write any site remarks, issues, or next-day reminders.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canFillDmr || addingRow === "notes"}
                        onClick={() => addSectionRow("notes")}
                        className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
                          className={`w-full rounded-[16px] px-4 py-3 text-sm outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {fillTab === "attendance" && (
                  <section className={`rounded-[20px] p-4 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
                        <IconTile icon={Users} tone="sky" darkMode={darkMode} size="sm" className="row-span-2" />
                        <h4 className="text-[15px]">
                          Project Staff Attendance
                        </h4>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Mark Present in green, Absent in red, or Leave when
                          required.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Chip darkMode={darkMode} tone="mint">
                          {fillAttendanceSummary.present} Present
                        </Chip>
                        <Chip darkMode={darkMode} tone="rose">
                          {fillAttendanceSummary.absent} Absent
                        </Chip>
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
                                      : "bg-[#f4f4f2] text-[#8a8a8a]",
                                    dot: darkMode
                                      ? "bg-white/30"
                                      : "bg-black/30",
                                  };
                        const options = [
                          {
                            value: "P",
                            label: "Present",
                            active: "bg-[#2f7a4f] text-white",
                            idle: darkMode
                              ? "bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"
                              : "bg-[#e4f1e6] text-[#2f7a4f] hover:bg-[#d6eadb]",
                          },
                          {
                            value: "A",
                            label: "Absent",
                            active: "bg-[#c0394b] text-white",
                            idle: darkMode
                              ? "bg-red-400/10 text-red-200 hover:bg-red-400/15"
                              : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f7d5d9]",
                          },
                          {
                            value: "L",
                            label: "Leave",
                            active: "bg-[#c2562b] text-white",
                            idle: darkMode
                              ? "bg-orange-400/10 text-orange-200 hover:bg-orange-400/15"
                              : "bg-[#fbe5dc] text-[#c2562b] hover:bg-[#f7d6c9]",
                          },
                        ];
                        return (
                          <article
                            key={item.id}
                            className={`flex min-h-48 flex-col rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/5" : "bg-[#f4f4f2]"}`}
                              >
                                <span className="text-sm">
                                  {(item.name || "?")
                                    .split(/\s+/)
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <span
                                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] ${statusMeta.chip}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                                />
                                {statusMeta.label}
                              </span>
                            </div>
                            <div className="mt-5 min-w-0">
                              <p className="text-[17px] tracking-[-0.01em]">
                                {item.name}
                              </p>
                              <p className={`mt-1 text-xs ${muted}`}>
                                Project staff attendance
                              </p>
                            </div>
                            <div
                              className={`mt-auto pt-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
                            >
                              <div className={`grid grid-cols-3 gap-1.5 border-t pt-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                                {options.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    disabled={!canFillDmr}
                                    onClick={() =>
                                      updateDraft(item, "status", option.value)
                                    }
                                    className={`h-9 rounded-full px-2 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50 ${currentStatus === option.value ? option.active : option.idle}`}
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
              className={`flex shrink-0 items-center justify-end gap-2 border-t px-3 py-3 sm:px-7 sm:py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}
            >
              <button
                onClick={() => setFillOpen(false)}
                className={`h-10 rounded-full border px-5 text-[13px] transition ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
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
                className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-36 sm:flex-none sm:px-6 ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
                <section
                  className={`w-full max-w-2xl rounded-[24px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.16)] ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#e6e6e3] bg-white text-[#141414]"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <IconTile icon={FileSpreadsheet} tone={data?.dmrSettings?.linked ? "mint" : "amber"} darkMode={darkMode} />
                      <div className="min-w-0">
                      <p className={`text-[12px] ${muted}`}>
                        DMR sheet link
                      </p>
                      <h4 className="text-[18px] tracking-[-0.01em]">
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
                    </div>
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => setDmrSheetOpen(false)}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
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
                        className={`h-10 min-w-0 rounded-full px-4 text-sm outline-none transition ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-1 focus:ring-white/15" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#9a9a98] focus:bg-white focus:ring-1 focus:ring-[#e6e6e3]"}`}
                      />
                      <button
                        type="button"
                        disabled={dmrSheetSaving || !dmrSheetLink.trim()}
                        onClick={linkDmrSheet}
                        className={`h-10 rounded-full px-5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#cff07a] text-black hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
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
                          className={`h-10 rounded-full px-5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-red-400/10 text-red-200 hover:bg-red-400/15" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f7d5d9]"}`}
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
