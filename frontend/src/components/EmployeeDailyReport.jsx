"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, CalendarCheck, Check, CheckCircle2, Clock3, Copy, Eye, FileText, Maximize2, Minimize2, PauseCircle, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { useClickOutside } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function todayInput() {
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

const emptyForm = {
  department: "",
  taskItems: [{ site: "", category: "", categoryOther: "", status: "", statusOther: "", involvement: "", involvementOther: "", description: "" }],
  waitingTaskItems: [{ site: "", category: "", categoryOther: "", involvement: "", involvementOther: "", description: "" }],
  tomorrowPlanTick: true,
  note: "",
};

function fieldValue(value, other) {
  return value === "__other" ? other : value;
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

function formatDraftTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

function taskStatusMeta(status, darkMode = false) {
  const value = String(status || "").toLowerCase();
  if (value.includes("complete")) return {
    Icon: CheckCircle2,
    selected: darkMode ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700",
    option: darkMode ? "text-emerald-100 hover:bg-emerald-400/10" : "text-emerald-700 hover:bg-emerald-50",
    active: "bg-emerald-500 text-white",
    dot: "bg-emerald-500",
  };
  if (value.includes("halt")) return {
    Icon: PauseCircle,
    selected: darkMode ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700",
    option: darkMode ? "text-amber-100 hover:bg-amber-400/10" : "text-amber-700 hover:bg-amber-50",
    active: "bg-amber-500 text-white",
    dot: "bg-amber-500",
  };
  if (value.includes("suspend")) return {
    Icon: AlertTriangle,
    selected: darkMode ? "border-orange-400/20 bg-orange-400/10 text-orange-100" : "border-orange-200 bg-orange-50 text-orange-700",
    option: darkMode ? "text-orange-100 hover:bg-orange-400/10" : "text-orange-700 hover:bg-orange-50",
    active: "bg-orange-500 text-white",
    dot: "bg-orange-500",
  };
  if (value.includes("cancel")) return {
    Icon: Ban,
    selected: darkMode ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-red-200 bg-red-50 text-red-700",
    option: darkMode ? "text-red-100 hover:bg-red-400/10" : "text-red-700 hover:bg-red-50",
    active: "bg-red-500 text-white",
    dot: "bg-red-500",
  };
  return {
    Icon: Clock3,
    selected: darkMode ? "border-sky-400/20 bg-sky-400/10 text-sky-100" : "border-sky-200 bg-sky-50 text-sky-700",
    option: darkMode ? "text-sky-100 hover:bg-sky-400/10" : "text-sky-700 hover:bg-sky-50",
    active: "bg-[#171714] text-white",
    dot: "bg-sky-500",
  };
}

function SearchableSelect({ darkMode, value, onChange, options = [], placeholder, allowOther = true, variant = "default" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useClickOutside(ref, () => setOpen(false));
  const selectedLabel = value === "__other" ? "Other" : value;
  const filtered = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedStatus = variant === "status" && selectedLabel ? taskStatusMeta(selectedLabel, darkMode) : null;
  const SelectedIcon = selectedStatus?.Icon;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm transition ${selectedStatus ? selectedStatus.selected : darkMode ? "border-white/10 bg-white/[0.035] text-white" : "border-black/10 bg-white text-black"}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selectedLabel ? "" : darkMode ? "text-white/35" : "text-black/35"}`}>
          {SelectedIcon && <SelectedIcon className="h-4 w-4 shrink-0" />}
          <span className="truncate">{selectedLabel || placeholder}</span>
        </span>
        <Search className="h-4 w-4 opacity-45" />
      </button>
      {open && (
        <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border p-2 shadow-2xl ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/10 bg-white"}`}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className={`mb-2 h-10 w-full rounded-xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white" : "border-black/10 bg-white"}`}
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((option) => {
              const meta = variant === "status" ? taskStatusMeta(option, darkMode) : null;
              const OptionIcon = meta?.Icon;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); setQuery(""); }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${option === value ? meta?.active || (darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white") : meta?.option || (darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]")}`}
                >
                  {OptionIcon ? <OptionIcon className="h-4 w-4 shrink-0" /> : null}
                  {!OptionIcon && variant === "status" ? <span className={`h-2 w-2 rounded-full ${meta?.dot || "bg-slate-400"}`} /> : null}
                  <span>{option}</span>
                </button>
              );
            })}
            {allowOther && (
              <button
                type="button"
                onClick={() => { onChange("__other"); setOpen(false); setQuery(""); }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${value === "__other" ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}
              >
                {variant === "status" && <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-[10px] text-slate-700">+</span>}
                <span>Other</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function taskNumberTone(index, darkMode = false) {
  void index;
  return darkMode ? "bg-[#89ed3f] text-black shadow-[#89ed3f]/15" : "bg-[#89ed3f] text-black shadow-[#89ed3f]/20";
}

function taskRowValue(row, field) {
  if (field === "site") return row.site === "__other" ? row.siteOther : row.site;
  if (field === "category") return row.category === "__other" ? row.categoryOther : row.category;
  if (field === "status") return row.status === "__other" ? row.statusOther : row.status;
  if (field === "involvement") return row.involvement === "__other" ? row.involvementOther : row.involvement;
  return "";
}

function TaskRowsEditor({ title, rows, categories, sites = [], statuses = [], involvements = [], showStatus = false, showInvolvement = false, onRowsChange, required = false, darkMode = false }) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const activeExpandedIndex = Math.min(expandedIndex, Math.max(0, rows.length - 1));

  function updateRow(index, patch) {
    onRowsChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setExpandedIndex(rows.length);
    onRowsChange([...rows, { site: "", category: "", categoryOther: "", status: "", statusOther: "", involvement: "", involvementOther: "", description: "" }]);
  }
  function duplicateRow(index) {
    const source = rows[index] || {};
    setExpandedIndex(rows.length);
    onRowsChange([
      ...rows,
      {
        site: source.site || "",
        siteOther: source.siteOther || "",
        category: source.category || "",
        categoryOther: source.categoryOther || "",
        status: source.status || "",
        statusOther: source.statusOther || "",
        involvement: source.involvement || "",
        involvementOther: source.involvementOther || "",
        description: "",
      },
    ]);
  }
  function removeRow(index) {
    setExpandedIndex((current) => Math.max(0, current > index ? current - 1 : Math.min(current, rows.length - 2)));
    onRowsChange(rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [{ site: "", category: "", categoryOther: "", status: "", statusOther: "", involvement: "", involvementOther: "", description: "" }]);
  }

  const summaryPill = darkMode ? "bg-white/[0.055] text-white/80" : "bg-white text-black/70";
  const summaryMuted = darkMode ? "text-white/40" : "text-black/40";
  const expandedGridClass = showStatus && showInvolvement
    ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
    : showStatus || showInvolvement
      ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]";

  return (
    <div className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className={`block text-xs font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/60" : "text-black/55"}`}>{title}</label>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const collapsed = rows.length > 1 && activeExpandedIndex !== index;
          return (
            <div
              key={index}
              role={collapsed ? "button" : undefined}
              tabIndex={collapsed ? 0 : undefined}
              onClick={() => { if (collapsed) setExpandedIndex(index); }}
              onKeyDown={(event) => { if (collapsed && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setExpandedIndex(index); } }}
              className={`rounded-[22px] p-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "cursor-pointer hover:-translate-y-0.5" : ""} ${darkMode ? "border-white/10 bg-[#1c1f24]" : "border-black/10 bg-[#f8f7f3]"}`}
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
                    <div key={label} className={`min-w-0 rounded-2xl  px-4 py-3 ${statusMeta ? statusMeta.selected : `border-transparent ${summaryPill}`}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${summaryMuted}`}>{label}</p>
                      <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">
                        {StatusIcon ? <StatusIcon className="h-4 w-4 shrink-0" /> : null}
                        <span className="truncate">{value || "Not selected"}</span>
                      </p>
                    </div>
                    );
                  })}
                  <div className="flex items-center justify-end gap-3">
                    <span className={`inline-flex h-12 min-w-11 items-center justify-center rounded-2xl px-4 text-sm font-black shadow-lg ${taskNumberTone(index, darkMode)}`}>
                      Task {index + 1}
                    </span>
                    <button type="button" onClick={(event) => { event.stopPropagation(); duplicateRow(index); }} className={`grid h-12 w-12 place-items-center rounded-xl transition ${darkMode ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white text-black/55 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} title="Duplicate task"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); removeRow(index); }} className={`grid h-12 w-12 place-items-center rounded-xl ${darkMode ? "bg-red-500/10 text-red-300 hover:bg-red-500/15" : "bg-red-50 text-red-600 hover:bg-red-100"}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${expandedGridClass}`}>
                  <div className="order-1">
                    <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Site</p>
                    <SearchableSelect darkMode={darkMode} value={row.site} onChange={(value) => updateRow(index, { site: value })} options={sites} placeholder="Choose site" allowOther />
                    {row.site === "__other" && (
                      <input required value={row.siteOther || ""} onChange={(event) => updateRow(index, { siteOther: event.target.value })} placeholder="Enter site" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />
                    )}
                    {required && index === 0 && !row.site && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                  </div>
                  {showStatus && (
                    <div className="order-4">
                      <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Task status</p>
                      <SearchableSelect darkMode={darkMode} value={row.status} onChange={(value) => updateRow(index, { status: value })} options={statuses.filter((status) => status !== "Other")} placeholder="Choose task status" allowOther variant="status" />
                      {row.status === "__other" && <input required={required} value={row.statusOther || ""} onChange={(event) => updateRow(index, { statusOther: event.target.value })} placeholder="Enter task status" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />}
                      {required && index === 0 && !row.status && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                    </div>
                  )}
                  {showInvolvement && (
                    <div className="order-3">
                      <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Involvement</p>
                      <SearchableSelect darkMode={darkMode} value={row.involvement} onChange={(value) => updateRow(index, { involvement: value })} options={involvements.filter((item) => item !== "Other")} placeholder="Choose involvement" allowOther />
                      {row.involvement === "__other" && <input required={required} value={row.involvementOther || ""} onChange={(event) => updateRow(index, { involvementOther: event.target.value })} placeholder="Enter involvement" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />}
                      {required && index === 0 && !row.involvement && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                    </div>
                  )}
                  <div className="order-2">
                    <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Category</p>
                    <SearchableSelect darkMode={darkMode} value={row.category} onChange={(value) => updateRow(index, { category: value })} options={categories.filter((category) => category !== "Other")} placeholder="Choose category" allowOther />
                    {row.category === "__other" && (
                      <input required={required && index === 0} value={row.categoryOther || ""} onChange={(event) => updateRow(index, { categoryOther: event.target.value })} placeholder="Enter category" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />
                    )}
                    {required && index === 0 && !row.category && <input tabIndex={-1} autoComplete="off" className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => {}} />}
                  </div>
                  <div className="order-6 lg:col-span-full">
                    <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Description</p>
                    <textarea required={required && index === 0} value={row.description} onChange={(event) => updateRow(index, { description: event.target.value })} rows={2} placeholder="Describe this task..." className={`min-h-12 w-full rounded-2xl border px-4 py-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />
                  </div>
                  <div className="order-5 flex flex-col lg:self-start">
                    <p className="mb-2 select-none text-[10px] font-semibold uppercase tracking-[0.12em] opacity-0">Actions</p>
                    <div className="flex h-12 items-center justify-end gap-3">
                      <span className={`inline-flex h-12 min-w-11 items-center justify-center rounded-2xl px-4 text-sm font-black shadow-lg ${taskNumberTone(index, darkMode)}`}>
                        Task {index + 1}
                      </span>
                      <button type="button" onClick={() => duplicateRow(index)} className={`grid h-12 w-12 place-items-center rounded-xl transition ${darkMode ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white text-black/55 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} title="Duplicate task"><Copy className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removeRow(index)} className={`grid h-12 w-12 place-items-center rounded-xl ${darkMode ? "bg-red-500/10 text-red-300 hover:bg-red-500/15" : "bg-red-50 text-red-600 hover:bg-red-100"}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center">
        <button type="button" onClick={addRow} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${darkMode ? "bg-[#89ed3f] text-black hover:bg-[#7dde35]" : "bg-[#171714] text-white"}`}><Plus className="h-4 w-4" /> Add task</button>
      </div>
    </div>
  );
}

function TaskItemsDisplay({ title, items = [], fallback, darkMode, showStatus = false, showInvolvement = false }) {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item.category || item.description) : [];
  return (
    <div className={`rounded-[22px] p-3 sm:p-5 md:col-span-2 ${darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]"}`}>
      <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>{title}</p>
      {visibleItems.length ? (
        <div className="mt-3">
          <div className="space-y-3 md:hidden">
            {visibleItems.map((item, index) => (
              <article key={`mobile-${item.category}-${index}`} className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Site</p><p className="mt-1 font-semibold break-words">{item.site || "-"}</p></div>
                  <div><p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Category</p><p className="mt-1 font-semibold break-words">{item.category || "-"}</p></div>
                  {showInvolvement && <div><p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Involvement</p><p className="mt-1 font-semibold break-words">{item.involvement || "-"}</p></div>}
                  {showStatus && <div className="col-span-2"><p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Status</p><p className="mt-1 font-semibold">{item.status || "-"}</p></div>}
                  <div className="col-span-2 border-t border-black/[0.06] pt-3 dark:border-white/10"><p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Description</p><p className="mt-2 whitespace-pre-wrap break-words leading-6">{item.description || "-"}</p></div>
                </div>
              </article>
            ))}
          </div>
          <table className="hidden w-full table-fixed border-separate border-spacing-y-2 text-left text-sm md:table">
            <thead className={darkMode ? "text-white/55" : "text-slate-500"}>
              <tr>
                <th className="w-16 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Sr No:</th>
                <th className="w-40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Site</th>
                <th className="w-48 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Task Category</th>
                {showStatus && <th className="w-36 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Status</th>}
                {showInvolvement && <th className="w-36 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Involvement</th>}
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Description</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={`${item.category}-${index}`} className={darkMode ? "bg-white/[0.045]" : "bg-white"}>
                  <td className="rounded-l-2xl px-4 py-3 font-semibold">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{item.site || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex max-w-[160px] whitespace-normal rounded-full px-3 py-1 text-xs font-semibold leading-4 ${darkMode ? "bg-[#d8f36a]/15 text-[#d8f36a]" : "bg-[#e8f5eb] text-[#145b39]"}`}>
                      {item.category || "-"}
                    </span>
                  </td>
                  {showStatus && <td className="px-4 py-3">{item.status || "-"}</td>}
                  {showInvolvement && <td className="px-4 py-3">{item.involvement || "-"}</td>}
                  <td className="whitespace-pre-wrap break-words rounded-r-2xl px-5 py-3 leading-6">{item.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-base leading-7">{fallback || "-"}</p>
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

function reportStatusClass(status, darkMode) {
  const value = String(status || "").toLowerCase();
  if (value === "mixed") return darkMode ? "bg-sky-400/15 text-sky-200" : "bg-sky-50 text-sky-700";
  if (value.includes("complete")) return "bg-emerald-50 text-emerald-700";
  if (value.includes("halt") || value.includes("suspend") || value.includes("cancel")) return "bg-red-50 text-red-700";
  if (!status || status === "-") return darkMode ? "bg-white/10 text-white/55" : "bg-slate-100 text-slate-500";
  return darkMode ? "bg-amber-500/10 text-amber-200" : "bg-amber-50 text-amber-700";
}

function EmployeeReportTable({ title, headers, rows, darkMode }) {
  return (
    <section className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}>
      <div className="flex items-center justify-between gap-3 p-4">
        <h4 className="text-lg font-semibold">{title}</h4>
        <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/10 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={darkMode ? "bg-white/[0.05] text-white/50" : "bg-black/[0.035] text-black/50"}>
            <tr>{headers.map((header) => <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={`border-t ${darkMode ? "border-white/10" : "border-black/5"}`}>
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={headers.length} className="px-4 py-8 text-center opacity-55">No data for this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmployeeUserMultiSelect({ darkMode, users = [], selectedIds = [], onChange }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useClickOutside(ref, () => setOpen(false));
  const selected = new Set(selectedIds);
  const filtered = users.filter((user) => `${user.employeeName} ${user.department}`.toLowerCase().includes(query.trim().toLowerCase()));
  const label = selectedIds.length ? `${selectedIds.length} employee${selectedIds.length === 1 ? "" : "s"}` : "All employees";

  function toggleUser(userId) {
    onChange(selected.has(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-11 min-w-[220px] items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}
      >
        <span className="truncate">{label}</span>
        <Search className="h-4 w-4 opacity-45" />
      </button>
      {open && (
        <div className={`absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(92vw,360px)] rounded-[22px] border p-3 shadow-2xl ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-black"}`}>
          <div className="mb-2 flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee..." className={`h-10 min-w-0 flex-1 rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
            <button type="button" onClick={() => onChange([])} className={`h-10 rounded-2xl px-3 text-xs font-semibold ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>All</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((user) => (
              <button
                key={user.userId}
                type="button"
                onClick={() => toggleUser(user.userId)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm ${selected.has(user.userId) ? darkMode ? "bg-[#d8f36a]/15 text-[#d8f36a]" : "bg-[#145b39]/10 text-[#145b39]" : darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-md border ${selected.has(user.userId) ? "border-[#145b39] bg-[#145b39] text-white" : darkMode ? "border-white/20" : "border-black/15"}`}>
                  {selected.has(user.userId) && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{user.employeeName}</span>
                  <span className="block truncate text-xs opacity-55">{user.department || "No department"}</span>
                </span>
              </button>
            ))}
            {!filtered.length && <p className="px-3 py-6 text-center text-sm opacity-55">No employees found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeDateRangePicker({ darkMode, from, to, onFromChange, onToChange, onApply }) {
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const [activeSide, setActiveSide] = useState("start");
  const [monthDate, setMonthDate] = useState(() => parseInputDate(from) || parseInputDate(to) || parseInputDate(todayInput()) || new Date());
  useClickOutside(ref, () => setOpen(false));
  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const fromDate = parseInputDate(from);
  const toDate = parseInputDate(to);

  useEffect(() => {
    if (!open) return undefined;
    function updatePanelPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const gap = 10;
      const panelWidth = Math.min(window.innerWidth - margin * 2, 400);
      const wantedHeight = 420;
      const roomBelow = window.innerHeight - rect.bottom - gap - margin;
      const roomAbove = rect.top - gap - margin;
      const openUpward = roomBelow < wantedHeight && roomAbove > roomBelow;
      const maxHeight = Math.max(300, Math.min(wantedHeight, openUpward ? roomAbove : roomBelow));
      const left = Math.min(Math.max(margin, rect.right - panelWidth), window.innerWidth - panelWidth - margin);
      setPanelStyle({
        left,
        width: panelWidth,
        maxHeight,
        top: openUpward ? undefined : rect.bottom + gap,
        bottom: openUpward ? window.innerHeight - rect.top + gap : undefined,
      });
    }
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  function chooseDate(day) {
    const value = dateInputValue(day);
    if (activeSide === "start") {
      if (to && value > to) onToChange(value);
      onFromChange(value);
      setActiveSide("end");
      return;
    }
    if (from && value < from) {
      onFromChange(value);
      onToChange(from);
      return;
    }
    onToChange(value);
  }

  function applyShortcut(nextFrom, nextTo) {
    onFromChange(nextFrom);
    onToChange(nextTo);
    setMonthDate(parseInputDate(nextFrom) || new Date());
    setActiveSide("end");
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          const selectedDate = fromDate || toDate;
          if (selectedDate) setMonthDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
        }}
        className={`flex h-11 min-w-[240px] items-center gap-2 rounded-2xl border px-4 text-sm ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}
      >
        <CalendarCheck className="h-4 w-4 text-indigo-600" />
        <span className="truncate">{rangeLabel(from, to)}</span>
      </button>
      {open && (
        <div style={panelStyle} className={`fixed z-[90] flex flex-col overflow-hidden rounded-[24px] border shadow-2xl ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-black"}`}>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setActiveSide("start");
                if (fromDate) setMonthDate(new Date(fromDate.getFullYear(), fromDate.getMonth(), 1));
              }}
              className={`rounded-2xl border p-2.5 text-left transition ${activeSide === "start" ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/10" : darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55">Start</span>
              <span className="mt-1 block text-sm font-semibold">{from ? formatShortDate(from) : "From date"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSide("end");
                if (toDate) setMonthDate(new Date(toDate.getFullYear(), toDate.getMonth(), 1));
              }}
              className={`rounded-2xl border p-2.5 text-left transition ${activeSide === "end" ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/10" : darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55">End</span>
              <span className="mt-1 block text-sm font-semibold">{to ? formatShortDate(to) : "To date"}</span>
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => applyShortcut(todayInput(), todayInput())} className={`h-8 rounded-full px-3 text-xs font-semibold ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>Today</button>
            <button type="button" onClick={() => applyShortcut(addDaysInput(todayInput(), -6), todayInput())} className={`h-8 rounded-full px-3 text-xs font-semibold ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>This week</button>
            <button type="button" onClick={() => applyShortcut(todayInput().slice(0, 8) + "01", todayInput())} className={`h-8 rounded-full px-3 text-xs font-semibold ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>This month</button>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/[0.04]">‹</button>
            <p className="text-lg font-semibold">{monthTitle(monthDate)}</p>
            <button type="button" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/[0.04]">›</button>
          </div>

          <div className={`grid grid-cols-7 text-center text-xs ${darkMode ? "text-white/55" : "text-black/55"}`}>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <span key={day} className="py-1.5">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day) => {
              const value = dateInputValue(day);
              const inMonth = day.getMonth() === monthDate.getMonth();
              const isStart = value === from;
              const isEnd = value === to;
              const inRange = from && to && value > from && value < to;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseDate(day)}
                  className={`grid h-7 place-items-center rounded-xl text-sm transition ${isStart || isEnd ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25" : inRange ? "bg-indigo-50 text-indigo-700" : inMonth ? darkMode ? "text-white hover:bg-white/10" : "text-black hover:bg-black/[0.04]" : darkMode ? "text-white/25" : "text-black/30"}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
            </div>
          </div>

          <div className={`flex shrink-0 justify-end border-t p-3 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/5 bg-white"}`}>
            <button type="button" onClick={() => { setOpen(false); onApply?.(); }} className={`h-10 rounded-2xl px-5 text-sm font-semibold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>Apply range</button>
          </div>
        </div>
      )}
    </div>
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
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const subtle = darkMode ? "text-white/65" : "text-black/55";
  const year = rows[0]?.days?.[0]?.date?.slice(0, 4) || new Date().getFullYear();
  const totalFilled = rows.reduce((sum, row) => sum + row.days.filter((day) => day.submitted).length, 0);
  const emptyCell = darkMode ? "border-white/5 bg-white/10" : "border-emerald-900/[0.08] bg-[#f4f8f5]";
  return (
    <section className={`rounded-[26px] border p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#1f2528] text-white" : "border-black/[0.06] bg-white text-[#171714] shadow-sm"}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-semibold ${muted}`}>Number of submissions</p>
          <h3 className="mt-1 text-3xl font-semibold leading-none">{totalFilled.toLocaleString()}</h3>
          <p className={`mt-2 text-sm ${subtle}`}>{title}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/10 text-white/75" : "bg-emerald-50 text-emerald-700"}`}>{year}</div>
          <div className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/10 text-white/65" : "bg-violet-50 text-violet-700"}`}>Current year</div>
        </div>
      </div>
      <div className={`overflow-x-auto rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-black/10" : "border-black/[0.04] bg-[#fbfcfb]"}`}>
        <div className="min-w-max space-y-5">
          {rows.map((row) => (
            <div key={row.userId} className="grid grid-cols-[96px_1fr] items-center gap-4">
              <p className="sticky left-0 z-10 truncate rounded-2xl py-2 pr-3 text-sm font-semibold backdrop-blur-sm">{row.employeeName}</p>
              <div className="flex min-w-max gap-5">
                {heatmapMonthGroups(row.days).map((month) => (
                  <div key={month.key} className="shrink-0">
                    <p className={`mb-3 text-center text-[11px] font-medium ${subtle}`}>{month.label}</p>
                    <div className="grid grid-flow-col grid-rows-7 gap-1">
                      {month.days.map((day) => (
                        <span
                          key={day.date}
                          title={`${day.date}: ${day.submitted ? "filled" : "not filled"}`}
                          className={`h-3.5 w-3.5 rounded-[4px] border -[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:scale-110 ${day.submitted ? "border-emerald-500 bg-emerald-500" : emptyCell}`}
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
        <span className={`h-3.5 w-3.5 rounded-[4px] border ${emptyCell}`} />
        <span className="h-3.5 w-3.5 rounded-[3px] bg-emerald-100" />
        <span className="h-3.5 w-3.5 rounded-[3px] bg-emerald-300" />
        <span className="h-3.5 w-3.5 rounded-[3px] bg-emerald-500" />
        <span>More</span>
      </div>
    </section>
  );
}

export default function EmployeeDailyReport({ darkMode }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => todayInput());
  const [dateTo, setDateTo] = useState(() => todayInput());
  const [formOpen, setFormOpen] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [todayStatusOpen, setTodayStatusOpen] = useState(false);
  const [todayStatusSearch, setTodayStatusSearch] = useState("");
  const [todayStatusFilter, setTodayStatusFilter] = useState("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportFrom, setReportFrom] = useState(() => addDaysInput(todayInput(), -6));
  const [reportTo, setReportTo] = useState(() => todayInput());
  const [reportUserIds, setReportUserIds] = useState([]);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingReport, setEditingReport] = useState(false);
  const [activeDraftKey, setActiveDraftKey] = useState("");
  const [draftChoiceOpen, setDraftChoiceOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState("");
  const [customPrefs, setCustomPrefs] = useState({ useCustomOnly: false, sites: [], categories: [] });
  const [customOptionsOpen, setCustomOptionsOpen] = useState(false);
  const [customSiteInput, setCustomSiteInput] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingToday, setRefreshingToday] = useState(false);

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
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-[#dfe7e4] bg-white";
  const softPanel = darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white";
  const userStorageId = data?.currentUserId || "me";
  const draftStoragePrefix = `employee-daily-report-draft:${userStorageId}:${todayInput()}`;
  const draftStorageKey = activeDraftKey || `${draftStoragePrefix}:new`;

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const result = await api(`/employee-daily-report?${params.toString()}`);
      setData(result);
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
    } catch (error) {
      toast.error(error.message || "Could not load daily reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function openForm() {
    if (!data?.profile?.sheetLinked) {
      toast.error("Link your Google Sheet before filling today's report");
      return;
    }
    setFormClosing(false);
    setFormExpanded(false);
    const todayReport = data?.todayReport;
    setEditingReport(Boolean(todayReport));
    const nextDraftKey = `${draftStoragePrefix}:${todayReport?.id ? `edit:${todayReport.id}` : "new"}`;
    setActiveDraftKey(nextDraftKey);
    const baseForm = {
      ...emptyForm,
      ...(todayReport || {}),
      tomorrowPlanTick: true,
      taskItems: todayReport?.taskItems?.length ? todayReport.taskItems.map((item) => ({ ...item, status: item.status || todayReport.taskStatus || "", involvement: item.involvement || todayReport.involvement || "" })) : [{ site: "", category: "", categoryOther: "", status: "", statusOther: "", involvement: "", involvementOther: "", description: "" }],
      waitingTaskItems: todayReport?.waitingTaskItems?.length ? todayReport.waitingTaskItems.map((item) => ({ ...item, involvement: item.involvement || todayReport.involvement || "" })) : [{ site: "", category: "", categoryOther: "", involvement: "", involvementOther: "", description: "" }],
      department: todayReport?.department || data?.profile?.department || "",
      carriedForwardFrom: "",
    };
    const storedDraft = safeJsonParse(window.localStorage.getItem(nextDraftKey), null);
    const usableDraft = storedDraft?.form && hasEmployeeDraftContent(storedDraft.form) ? storedDraft : null;
    if (storedDraft && !usableDraft) window.localStorage.removeItem(nextDraftKey);
    setForm(baseForm);
    setLastDraftSavedAt(usableDraft?.savedAt || "");
    if (usableDraft?.form) {
      setPendingDraft({ ...usableDraft, baseForm });
      setDraftChoiceOpen(true);
    } else {
      setPendingDraft(null);
      setDraftChoiceOpen(false);
    }
    setFormOpen(true);
  }

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
    try {
      setSubmitting(true);
      const missingTaskSite = [...(form.taskItems || []), ...(form.waitingTaskItems || [])].some((item) => (item.category || item.categoryOther || item.description) && !fieldValue(item.site, item.siteOther).trim());
      if (missingTaskSite) throw new Error("Choose a site for every task");
      const missingTaskStatus = (form.taskItems || []).some((item) => (item.category || item.categoryOther || item.description) && !fieldValue(item.status, item.statusOther).trim());
      if (missingTaskStatus) throw new Error("Choose a status for every today task");
      const missingTaskInvolvement = [...(form.taskItems || []), ...(form.waitingTaskItems || [])].some((item) => (item.category || item.categoryOther || item.description) && !fieldValue(item.involvement, item.involvementOther).trim());
      if (missingTaskInvolvement) throw new Error("Choose involvement for every task");
      const taskItems = (form.taskItems || []).map((item) => ({ site: fieldValue(item.site, item.siteOther).trim(), category: fieldValue(item.category, item.categoryOther).trim(), status: fieldValue(item.status, item.statusOther).trim(), involvement: fieldValue(item.involvement, item.involvementOther).trim(), description: item.description.trim() })).filter((item) => item.site && item.category && item.status && item.involvement && item.description);
      const waitingTaskItems = (form.waitingTaskItems || []).map((item) => ({ site: fieldValue(item.site, item.siteOther).trim(), category: fieldValue(item.category, item.categoryOther).trim(), involvement: fieldValue(item.involvement, item.involvementOther).trim(), description: item.description.trim() })).filter((item) => item.site && item.category && item.involvement && item.description);
      const payload = {
        ...form,
        tomorrowPlanTick: true,
        department: fieldValue(form.department, form.departmentOther),
        involvement: taskItems[0]?.involvement || waitingTaskItems[0]?.involvement || "",
        taskItems,
        waitingTaskItems,
      };
      await api("/employee-daily-report", { method: editingReport ? "PUT" : "POST", body: JSON.stringify(payload) });
      if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
      setLastDraftSavedAt("");
      toast.success(editingReport ? "Today’s report updated" : "Daily report submitted");
      setConfettiActive(true);
      closeFormDrawer();
      await load();
    } catch (error) {
      toast.error(error.message || "Could not submit report");
    } finally {
      setSubmitting(false);
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

  function setReportPreset(preset) {
    const today = todayInput();
    if (preset === "daily") {
      setReportFrom(today);
      setReportTo(today);
    } else if (preset === "weekly") {
      setReportFrom(addDaysInput(today, -6));
      setReportTo(today);
    } else if (preset === "monthly") {
      setReportFrom(today.slice(0, 8) + "01");
      setReportTo(today);
    }
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

  const reports = data?.reports || [];
  const options = data?.options || { departments: [], taskTypes: [], taskStatuses: [], involvements: [] };
  const formSites = customPrefs.useCustomOnly ? customPrefs.sites : uniqueClean([...(options.sites || []), ...customPrefs.sites]);
  const formCategories = customPrefs.useCustomOnly ? customPrefs.categories : uniqueClean([...(options.taskTypes || []), ...customPrefs.categories]);
  const hasCustomPreferences = Boolean(customPrefs.sites.length || customPrefs.categories.length);
  const customOptionsVisible = customOptionsOpen || !hasCustomPreferences;
  const sidebarSitesPreview = customPrefs.sites.slice(0, 3);
  const sidebarCategoriesPreview = customPrefs.categories.slice(0, 3);
  const reportUsers = data?.reportUsers || [];
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
  const initialLoading = loading && !data;

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`}>
      <section className={`relative mb-5 overflow-hidden rounded-[30px] border p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#202328]" : "border-[#dfe7e4] bg-white/95"}`}>
          {!darkMode && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/80 to-transparent" />
              <span className="absolute -left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#eef3f2]" />
              <span className="absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#eef3f2]" />
            </>
          )}
          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#dfe7e4] bg-[#e8f6ee] text-[#0f6b49]"}`}>
                  <CalendarCheck className="h-4 w-4" /> Employee Daily Report
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#eadb8f] bg-[#fff4a8] text-[#5b4b00]"}`}>
                  {initialLoading ? <ThreeDotLoader /> : data?.profile?.department || "Department not set"}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#efaccb] bg-[#f7bdd7] text-[#6f123b]"}`}>
                  <CalendarCheck className="h-3.5 w-3.5" /> {initialLoading ? <ThreeDotLoader /> : data?.todaySubmitted ? "Today filled" : "Today pending"}
                </span>
              </div>
              <h1 className={`mt-5 max-w-4xl text-4xl small font-black  leading-[0.96] tracking-tight sm:text-4xl ${darkMode ? "text-white" : "text-[#161616]"}`}>Daily work reports, made simple.</h1>
              <p className={`mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base ${darkMode ? "text-white/65" : "text-black/58"}`}>Submit today&apos;s work progress, review previous entries, and track reporting consistency in one clean workspace.</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  disabled={initialLoading}
                  className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}
                >
                  <FileText className="h-4 w-4" /> {data?.profile?.sheetLinked ? "Sheet settings" : "Link sheet"}
                </button>
                {data?.isAdmin && (
                  <button onClick={() => setTodayStatusOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm transition active:scale-[0.98] ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                    <CalendarCheck className="h-4 w-4" /> Today status
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <button
                  disabled={initialLoading || !data?.profile?.sheetLinked}
                  onClick={openForm}
                  className={`flex h-12 items-center justify-center gap-2 rounded-3xl px-5 text-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "border-[#d8f36a]/20 bg-[#d8f36a] text-black" : "bg-[#10a66b] text-white"}`}
                >
                  {data?.todaySubmitted ? <CheckCircle2 className="h-4 w-4" /> : initialLoading ? null : <Plus className="h-4 w-4" />}
                  {initialLoading ? <ThreeDotLoader /> : data?.todaySubmitted ? "Edit today's report" : data?.profile?.sheetLinked ? "Fill today's report" : "Link sheet first"}
                </button>
                <button
                  type="button"
                  disabled={initialLoading || refreshingToday || !data?.profile?.sheetLinked}
                  onClick={refreshTodayReport}
                  className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingToday ? "animate-spin" : ""}`} />
                  {refreshingToday ? "Refreshing..." : "Refresh today"}
                </button>
                {!data?.isAdmin && (
                  <button onClick={() => setHeatmapOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm transition active:scale-[0.98] ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                    <CalendarCheck className="h-4 w-4" /> My activity
                  </button>
                )}
                {data?.isAdmin && (
                  <button onClick={() => setReportOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm transition active:scale-[0.98] ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                    <FileText className="h-4 w-4" /> Generate report
                  </button>
                )}
              </div>
            </div>
          </div>
          {initialLoading ? (
            <div className={`mt-5 flex min-h-[92px] items-center justify-center rounded-[24px] border p-3 ${darkMode ? "border-white/10 bg-white/[0.05]" : "border-black/10 bg-white/65"}`}>
              <ThreeDotLoader className={darkMode ? "text-white/60" : "text-black/55"} />
            </div>
          ) : null}
       </section>

      <section className={`mt-5 overflow-hidden rounded-[28px] border ${panel}`}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl small font-semibold">{data?.isAdmin ? "Submitted employee reports" : "My filled reports"}</h2>
            <p className={`mt-1 text-sm ${muted}`}>Today can be updated; previous dates are read-only.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {data?.isAdmin && (
              <div className="relative">
                <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder="Search employee, site, task..." className={`h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none sm:w-72 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`} />
              </div>
            )}
            <EmployeeDateRangePicker darkMode={darkMode} from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={load} />
            <button onClick={load} className={`h-11 rounded-2xl px-4 text-sm font-semibold ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>Apply</button>
          </div>
        </div>
        <div className="overflow-x-auto px-3 pb-4">
          <table className="w-full min-w-[900px] border-separate border-spacing-y-3 text-left text-sm">
            <thead className={darkMode ? "text-white/55" : "text-slate-500"}>
              <tr>
                {["Sl No:", "Employee", "Time filled", "Department", "Status", "Actions"].map((header) => <th key={header} className="px-5 py-3 text-xs font-semibold">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className={`px-5 py-10 text-center ${muted}`}>Loading reports...</td></tr>}
              {!loading && reports.map((report, index) => {
                const statusSummary = reportStatusSummary(report);
                return (
                  <tr key={report.id} className={darkMode ? "bg-white/[0.04]" : "bg-[#f7f8fb]"}>
                    <td className="rounded-l-2xl px-5 py-4 font-semibold">{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold ${darkMode ? "bg-white/10 text-white" : "bg-[#d5f3f0] text-[#145b39]"}`}>{(report.employeeName || "E").slice(0, 1).toUpperCase()}</span>
                        <div>
                          <p className="font-semibold">{report.employeeName}</p>
                          <p className={`text-xs ${muted}`}>{report.reportDate || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{displayDateTime(report.submittedAt)}</td>
                    <td className="px-5 py-4">{report.department}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${reportStatusClass(statusSummary, darkMode)}`}>{statusSummary}</span>
                    </td>
                    <td className="rounded-r-2xl px-5 py-4">
                      <button onClick={() => { setDetailClosing(false); setDetailExpanded(false); setDetail(report); }} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-blue-600  hover:bg-blue-50"}`} title="View detail"><Eye className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
              {!loading && !reports.length && <tr><td colSpan={6} className={`px-5 py-10 text-center ${muted}`}>No reports found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheetOpen(false); }}>
          <div className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}><span><b>Employee daily report</b> · Sheet settings</span><button onClick={() => setSheetOpen(false)} className="font-semibold text-[#4b9b16]">Close</button></div>
            <div className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
            <div className={`rounded-2xl  p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white"}`}>
              <span className="rounded bg-[#eafbdc] px-2 py-1 text-[10px] font-bold text-[#4b9b16]">GOOGLE SHEETS</span>
              <h3 className="mt-4 text-2xl small text-black dark:text-white font-bold">Connect report workspace</h3>
              <p className={`mt-2 text-sm ${muted}`}>Link the sheet used to save and read employee daily reports.</p>
              <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${muted}`}>Linked Google Sheet</p>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                <input
                  value={sheetInput}
                  onChange={(event) => setSheetInput(event.target.value)}
                  placeholder="Paste your daily report Google Sheet link"
                  className={`h-12 min-w-0 flex-1 rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-black/20 text-white placeholder:text-white/35" : "border-black/10 bg-white text-black placeholder:text-black/35"}`}
                />
                <button
                  type="button"
                  onClick={saveSheetLink}
                  disabled={sheetSaving || !sheetInput.trim()}
                  className="h-12 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sheetSaving ? "Linking..." : data?.profile?.sheetLinked ? "Update sheet" : "Link sheet"}
                </button>
              </div>
              <p className={`mt-3 text-xs ${muted}`}>Reports are saved into this sheet and dashboard data is read back from it.</p>
            </div>
            </div>
          </div>
        </div>
      )}

      {todayStatusOpen && data?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setTodayStatusOpen(false); }}>
          <div className={`employee-report-shell employee-status-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}><span><b>Today&apos;s status</b> · {data?.today || todayInput()}</span><button onClick={() => setTodayStatusOpen(false)} className="font-semibold text-[#4b9b16]">Close</button></div>
            <div className={`min-h-0 flex-1 overflow-auto p-5 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
            <div className={`rounded-[26px] p-4 sm:p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#4b9b16]">Employee attendance</p>
                  <h3 className="mt-1 small text-2xl font-bold">Today&apos;s submission status</h3>
                  <p className={`mt-1 text-sm ${muted}`}>{todayStatusCounts.submitted} submitted · {todayStatusCounts.pending} not submitted · {todayStatusCounts.total} total</p>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative">
                    <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                    <input
                      value={todayStatusSearch}
                      onChange={(event) => setTodayStatusSearch(event.target.value)}
                      placeholder="Search employee or department..."
                      className={`h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none lg:w-72 ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-[#f8faf7] text-black placeholder:text-black/35"}`}
                    />
                  </div>
                  <div className={`flex rounded-2xl p-1 ${darkMode ? "bg-white/[0.06]" : "bg-[#f1f4ef]"}`}>
                    {[
                      ["all", "All", todayStatusCounts.total],
                      ["submitted", "Submitted", todayStatusCounts.submitted],
                      ["pending", "Not submitted", todayStatusCounts.pending],
                    ].map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTodayStatusFilter(value)}
                        className={`h-9 rounded-xl px-3 text-xs  transition ${todayStatusFilter === value ? "bg-[#89ed3f] text-black shadow-sm" : darkMode ? "text-white/60 hover:bg-white/10" : "text-black/55 hover:bg-white"}`}
                      >
                        {label} <span className="ml-1 opacity-60">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 overflow-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-3 text-left text-sm">
                  <thead className={darkMode ? "text-white/55" : "text-slate-500"}>
                    <tr>{["Sl No:", "Employee", "Department", "Time filled", "Status"].map((header) => <th key={header} className="px-5 py-3 text-xs font-semibold">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredTodayStatus.map((item, index) => (
                      <tr key={item.userId} className={darkMode ? "bg-white/[0.04]" : "bg-[#f7f8fb]"}>
                        <td className="rounded-l-2xl px-5 py-4 font-semibold">{index + 1}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold ${darkMode ? "bg-white/10 text-white" : "bg-[#d5f3f0] text-[#145b39]"}`}>{(item.employeeName || "E").slice(0, 1).toUpperCase()}</span>
                            <p className="font-semibold">{item.employeeName}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">{item.department || "-"}</td>
                        <td className="px-5 py-4">{item.submitted ? displayDateTime(item.submittedAt) : "-"}</td>
                        <td className="rounded-r-2xl px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${item.submitted ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.submitted ? "Submitted" : "Not submitted"}</span>
                        </td>
                      </tr>
                    ))}
                    {!filteredTodayStatus.length && <tr><td colSpan={5} className={`px-5 py-10 text-center ${muted}`}>No employees match this filter.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] ${formClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeFormDrawer(); }}>
          <form onSubmit={submitReport} className={`employee-report-drawer employee-report-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${formExpanded ? "employee-report-shell-expanded" : ""} ${formClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <span><b>Daily work progress</b> · {todayInput()}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setFormExpanded((current) => !current)} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} aria-label={formExpanded ? "Restore drawer size" : "Expand report to full screen"}>
                  {formExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{formExpanded ? "Restore" : "Expand"}</span>
                </button>
                <button type="button" onClick={closeFormDrawer} className="px-1 font-semibold text-[#4b9b16]">Close</button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[270px_minmax(0,1fr)]">
              <aside className={`flex min-h-0 flex-col overflow-hidden border-b md:border-b-0  ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/10 bg-white"}`}>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div>
                    <span className="rounded bg-[#eafbdc] px-2 py-1 text-[10px] font-bold text-[#4b9b16]">DAILY REPORT</span>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className={`rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f7f2]"}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? "text-white/45" : "text-black/40"}`}>Department</p><p className="mt-1 text-sm font-bold">{data?.profile?.department || "Required once"}</p></div>
                    <div className={`rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f7f2]"}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? "text-white/45" : "text-black/40"}`}>Status</p><p className="mt-1 text-sm font-bold text-[#4b9b16]">{data?.todaySubmitted ? "Already filled" : "Ready to submit"}</p></div>
                    <div className={`rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f7f2]"}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? "text-white/45" : "text-black/40"}`}>Draft</p><p className="mt-1 text-sm font-bold">{lastDraftSavedAt ? `Saved ${formatDraftTime(lastDraftSavedAt)}` : "Autosave ready"}</p></div>
                    <div className={`rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f7f2]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? "text-white/45" : "text-black/40"}`}>Saved options</p>
                          <p className={`mt-1 text-sm font-bold ${hasCustomPreferences ? "" : darkMode ? "text-white/55" : "text-black/50"}`}>
                            {hasCustomPreferences ? `${customPrefs.sites.length} sites · ${customPrefs.categories.length} categories` : "No saved options"}
                          </p>
                        </div>
                        {hasCustomPreferences && (
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${customPrefs.useCustomOnly ? "bg-[#89ed3f] text-black" : darkMode ? "bg-white/10 text-white/55" : "bg-white text-black/45"}`}>
                            {customPrefs.useCustomOnly ? "Mine" : "All"}
                          </span>
                        )}
                      </div>
                      {hasCustomPreferences && (
                        <div className="mt-3 space-y-2">
                          {sidebarSitesPreview.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sidebarSitesPreview.map((site) => <span key={site} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-black/60"}`}>{site}</span>)}
                              {customPrefs.sites.length > sidebarSitesPreview.length && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? "bg-white/10 text-white/45" : "bg-white text-black/40"}`}>+{customPrefs.sites.length - sidebarSitesPreview.length}</span>}
                            </div>
                          )}
                          {sidebarCategoriesPreview.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sidebarCategoriesPreview.map((category) => <span key={category} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? "bg-[#89ed3f]/15 text-[#b7ff82]" : "bg-[#eafbdc] text-[#4b9b16]"}`}>{category}</span>)}
                              {customPrefs.categories.length > sidebarCategoriesPreview.length && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? "bg-white/10 text-white/45" : "bg-white text-black/40"}`}>+{customPrefs.categories.length - sidebarCategoriesPreview.length}</span>}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setCustomOptionsOpen(true)}
                        className={`mt-3 h-9 w-full rounded-full text-xs font-bold transition ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-black/65 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`}
                      >
                        {hasCustomPreferences ? "Manage options" : "Add options"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`flex shrink-0 gap-2 border-t p-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
                  <button type="button" onClick={closeFormDrawer} className={`h-11 flex-1 rounded-full border text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Cancel</button>
                  <button disabled={submitting} className="h-11 flex-1 rounded-full bg-[#89ed3f] text-sm font-bold text-black hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Saving..." : editingReport ? "Update" : "Submit"}</button>
                </div>
              </aside>

              <div className={`min-h-0 overflow-y-auto p-5 pb-24 sm:p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
                <div className={`rounded-3xl  p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white"}`}>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Task entry</p>
                    <h4 className={`mt-1 text-2xl font-bold ${darkMode ? "text-white" : "text-black"}`}>Fill today&apos;s report</h4>
                    <p className={`mt-1 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{lastDraftSavedAt ? `Draft autosaved at ${formatDraftTime(lastDraftSavedAt)}` : "Draft autosaves as you type"}</p>
                  </div>
                  <span className="rounded-md bg-[#eafbdc] px-2.5 py-1 text-[10px] font-bold text-[#4b9b16]">EDITABLE TODAY</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {!data?.profile?.department && (
                    <div className="md:col-span-2">
                      <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/60" : "text-black/55"}`}>Department</label>
                      <SearchableSelect darkMode={darkMode} value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} options={options.departments} placeholder="Choose department" />
                      {form.department === "__other" && <input required value={form.departmentOther || ""} onChange={(event) => setForm((current) => ({ ...current, departmentOther: event.target.value }))} placeholder="Enter department" className={`mt-2 h-12 w-full rounded-2xl border px-4 outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />}
                    </div>
                  )}
                  <div className={`md:col-span-2 overflow-hidden transition-[max-height,opacity,transform,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${customOptionsVisible ? "max-h-[720px] opacity-100" : "max-h-0 -translate-y-2 opacity-0 pointer-events-none"}`}>
                  <div className={`rounded-[22px] p-4 ${darkMode ? "border-white/10 bg-[#1c1f24]" : "border-black/10 bg-[#f8f7f3]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-[0.12em] ${darkMode ? "text-white/70" : "text-black/55"}`}>My saved task options</p>
                        <p className={`mt-1 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>Save your own sites/categories. <br/>Turn on custom-only to show only your saved list in dropdowns.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {hasCustomPreferences && (
                          <button
                            type="button"
                            onClick={() => setCustomOptionsOpen(false)}
                            className={`h-10 rounded-full px-4 text-sm font-bold transition ${darkMode ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`}
                          >
                            Done
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => saveCustomPreferences({ ...customPrefs, useCustomOnly: !customPrefs.useCustomOnly })}
                          className={`h-10 rounded-full px-4 text-sm font-bold transition ${customPrefs.useCustomOnly ? "bg-[#89ed3f] text-black" : darkMode ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white text-black/60"}`}
                        >
                          {customPrefs.useCustomOnly ? "Using my options" : "Use all options"}
                        </button>
                        <button type="button" onClick={clearCustomOptions} className={`h-10 rounded-full px-4 text-sm font-bold transition ${darkMode ? "border border-white/10 bg-white/[0.04] text-white/70 hover:bg-red-500/10 hover:text-red-200" : "border border-black/10 bg-white text-black/55 hover:bg-red-50 hover:text-red-600"}`}>
                          Clear options
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div>
                        <label className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Custom sites</label>
                        <div className="flex gap-2">
                          <input value={customSiteInput} onChange={(event) => setCustomSiteInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomOption("site"); } }} placeholder="Add site name" className={`h-11 min-w-0 flex-1 rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />
                          <button type="button" onClick={() => addCustomOption("site")} className={`h-11 rounded-2xl px-4 text-sm font-bold ${darkMode ? "bg-[#89ed3f] text-black" : "bg-black text-white"}`}>Save</button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {customPrefs.sites.map((site) => <button key={site} type="button" onClick={() => removeCustomOption("site", site)} className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/10 text-white/70 hover:bg-red-500/10 hover:text-red-200" : "bg-white text-black/70 hover:bg-red-50 hover:text-red-600"}`}>{site} ×</button>)}
                          {!customPrefs.sites.length && <span className={`text-xs ${darkMode ? "text-white/35" : "text-black/40"}`}>No custom sites saved yet.</span>}
                        </div>
                      </div>
                      <div>
                        <label className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? "text-white/50" : "text-black/45"}`}>Custom categories</label>
                        <div className="flex gap-2">
                          <input value={customCategoryInput} onChange={(event) => setCustomCategoryInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomOption("category"); } }} placeholder="Add category name" className={`h-11 min-w-0 flex-1 rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} />
                          <button type="button" onClick={() => addCustomOption("category")} className={`h-11 rounded-2xl px-4 text-sm font-bold ${darkMode ? "bg-[#89ed3f] text-black" : "bg-black text-white"}`}>Save</button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {customPrefs.categories.map((category) => <button key={category} type="button" onClick={() => removeCustomOption("category", category)} className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/10 text-white/70 hover:bg-red-500/10 hover:text-red-200" : "bg-white text-black/70 hover:bg-red-50 hover:text-red-600"}`}>{category} ×</button>)}
                          {!customPrefs.categories.length && <span className={`text-xs ${darkMode ? "text-white/35" : "text-black/40"}`}>No custom categories saved yet.</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                  <TaskRowsEditor
                    title="Today's Tasks"
                    rows={form.taskItems}
                    categories={formCategories}
                    sites={formSites}
                    statuses={options.taskStatuses}
                    involvements={options.involvements}
                    showStatus
                    showInvolvement
                    required
                    onRowsChange={(rows) => setForm((current) => ({ ...current, taskItems: rows }))}
                    darkMode={darkMode}
                  />
                  <TaskRowsEditor
                    title="Tasks in waiting / tomorrow plan"
                    rows={form.waitingTaskItems}
                    categories={formCategories}
                    sites={formSites}
                    involvements={options.involvements}
                    showInvolvement
                    onRowsChange={(rows) => setForm((current) => ({ ...current, waitingTaskItems: rows }))}
                    darkMode={darkMode}
                  />
                  <div className="md:col-span-2"><label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.12em] ${darkMode ? "text-white/60" : "text-black/55"}`}>Note</label><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} placeholder="Any extra note..." className={`w-full rounded-2xl border px-4 py-3 outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} /></div>
                </div>
                </div>
              </div>
            </div>
          </form>
          {draftChoiceOpen && (
            <div className="absolute inset-0 z-[60] grid place-items-center bg-black/20 p-4">
              <div className={`w-full max-w-md rounded-[28px] p-5 shadow-2xl ${darkMode ? "bg-[#181a20] text-white" : "bg-white text-black"}`} onMouseDown={(event) => event.stopPropagation()}>
                <span className="rounded-md bg-[#eafbdc] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#4b9b16]">Draft detected</span>
                <h3 className="mt-4 text-2xl small text-black dark:text-white font-bold">Continue your saved report?</h3>
                <p className={`mt-2 text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/55"}`}>
                  A local draft was saved{pendingDraft?.savedAt ? ` at ${formatDraftTime(pendingDraft.savedAt)}` : ""}. Continue from it or start a fresh report for today.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={continueDraft} className="h-11 flex-1 rounded-full bg-[#89ed3f] text-sm font-bold text-black">Continue draft</button>
                  <button type="button" onClick={startFreshDraft} className={`h-11 flex-1 rounded-full border text-sm font-bold ${darkMode ? "border-white/15 text-white" : "border-black/15 text-black"}`}>Start new</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {reportOpen && data?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}>
          <div className={`employee-report-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#101216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}><span><b>Employee daily report</b> · Generate report</span><button onClick={() => setReportOpen(false)} className="font-semibold text-[#4b9b16]">Close</button></div>

            <div className={`min-h-0 flex-1 overflow-y-auto p-5 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>

            <div className={`mb-4 shrink-0 rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/[0.08] bg-white"}`}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  {/* <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${muted}`}>Report range</p> */}
                  {/* <h4 className="mt-2 text-2xl font-semibold">Generate employee work summary</h4> */}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {[
                    ["daily", "Today"],
                    ["weekly", "This week"],
                    ["monthly", "This month"],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setReportPreset(value)} className={`h-11 rounded-2xl border px-4 text-sm font-semibold ${darkMode ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-black/10 bg-[#f7f5ef] hover:bg-black/[0.04]"}`}>{label}</button>
                  ))}
                  <EmployeeUserMultiSelect darkMode={darkMode} users={reportUsers} selectedIds={reportUserIds} onChange={setReportUserIds} />
                  <EmployeeDateRangePicker darkMode={darkMode} from={reportFrom} to={reportTo} onFromChange={setReportFrom} onToChange={setReportTo} />
                  <button onClick={generateEmployeeReport} disabled={reportLoading} className="h-11 rounded-full bg-[#89ed3f] px-5 text-sm font-bold text-black hover:bg-[#7dde35] disabled:opacity-60">{reportLoading ? "Generating..." : "Generate"}</button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!reportData ? (
                <div className={`grid min-h-[360px] place-items-center rounded-[28px] border ${darkMode ? "border-white/10 bg-[#171a20] text-white/55" : "border-black/10 bg-white text-black/55"}`}>
                  Choose daily, weekly, monthly, or a custom date range, then click Generate.
                </div>
              ) : (
                <div className="space-y-4">
                  <section className={`rounded-[28px] border p-5 ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${muted}`}>{reportData.range.from} to {reportData.range.to}</p>
                        <h4 className="mt-2 text-2xl font-semibold">Executive summary</h4>
                        <p className={`mt-1 text-sm ${muted}`}>{reportData.selectedUserIds?.length ? `${reportData.selectedUserIds.length} selected employee${reportData.selectedUserIds.length === 1 ? "" : "s"}` : "All employees"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-[#d8f36a]/15 text-[#d8f36a]" : "bg-[#eef7df] text-[#17643f]"}`}>Generated</span>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      {[
                        ["Reports", reportData.summary.reports],
                        ["Employees", reportData.summary.employees],
                        ["Completed tasks", reportData.summary.completedTasks],
                        ["Waiting tasks", reportData.summary.waitingTasks],
                        ["Departments", reportData.summary.departments],
                        ["Categories", reportData.summary.categories],
                      ].map(([label, value]) => (
                        <div key={label} className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]"}`}>
                          <p className={`text-xs ${muted}`}>{label}</p>
                          <p className="mt-2 text-2xl font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <EmployeeReportTable
                    title="Daily submissions"
                    headers={["Date", "Reports", "Employees", "Completed tasks", "Waiting tasks"]}
                    rows={(reportData.daily || []).map((item) => [item.date, item.reports, item.employees, item.completedTasks, item.waitingTasks])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Department wise summary"
                    headers={["Department", "Reports", "Employees", "Completed tasks", "Waiting tasks"]}
                    rows={(reportData.departments || []).map((item) => [item.label, item.reports, item.employees, item.completedTasks, item.waitingTasks])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Task category summary"
                    headers={["Task category", "Employees", "Completed tasks", "Waiting tasks"]}
                    rows={(reportData.categories || []).map((item) => [item.label, item.employees, item.completedTasks, item.waitingTasks])}
                    darkMode={darkMode}
                  />
                  <EmployeeReportTable
                    title="Submitted reports"
                    headers={["Date", "Employee", "Department", "Client", "Site", "Task type", "Status"]}
                    rows={(reportData.reports || []).map((item) => [item.reportDate, item.employeeName, item.department, item.client, item.site, item.taskType, item.taskStatus])}
                    darkMode={darkMode}
                  />
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] ${detailClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetailDrawer(); }}>
          <div className={`employee-report-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${detailExpanded ? "employee-report-shell-expanded" : ""} ${detailClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#101216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <span><b>{detail.reportDate === data?.today && detail.userId === data?.currentUserId ? "Editable report detail" : "Read-only report detail"}</b> · {detail.reportDate}</span>
              <div className="flex items-center gap-2">
                {detail.reportDate === data?.today && detail.userId === data?.currentUserId && (
                  <button type="button" onClick={() => { closeDetailDrawer(); window.setTimeout(openForm, 300); }} className="flex h-8 items-center rounded-full bg-[#89ed3f] px-3 text-xs font-bold text-black">Edit report</button>
                )}
                <button onClick={() => setDetailExpanded((current) => !current)} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} aria-label={detailExpanded ? "Restore drawer size" : "Expand report to full screen"}>{detailExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{detailExpanded ? "Restore" : "Expand"}</span></button>
                <button onClick={closeDetailDrawer} className="px-1 font-semibold text-[#4b9b16]">Close</button>
              </div>
            </div>

            <div className={`${detailExpanded ? "grid md:grid-cols-[270px_minmax(0,1fr)]" : "block"} min-h-0 flex-1 overflow-hidden`}>
              {detailExpanded && <aside className={`hidden min-h-0 flex-col border-b p-6 md:flex md:border-b-0 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/10 bg-white"}`}>
                <div>
                  <span className="rounded bg-[#eafbdc] px-2 py-1 text-[10px]  text-[#4b9b16]">SUBMITTED BY</span>
                  <h4 className="mt-4 text-2xl font-bold small text-black dark:text-white leading-tight">{detail.employeeName || "Employee"}</h4>
                  <p className={`mt-2 text-xs ${darkMode ? "text-white/50" : "text-black/50"}`}>{displayDateTime(detail.submittedAt)}</p>
                </div>
                <div className="mt-8 space-y-3">
                  {[["Department", detail.department || "-"], ["Status", detail.taskStatus || "-"]].map(([label, value]) => <div key={label} className={`rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f7f2]"}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? "text-white/40" : "text-black/40"}`}>{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}
                </div>
                <button onClick={closeDetailDrawer} className={`mt-auto h-11 rounded-full border text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Close</button>
              </aside>}

              <div className={`h-full min-h-0 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}><div className={`rounded-3xl p-4 sm:p-6 ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/[0.08] bg-white"}`}>
                <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Work progress</p>
                    <h4 className="mt-2 text-2xl small font-semibold">Daily report summary</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {[
                      ["Task Type", detail.taskType],
                    ].map(([label, value]) => (
                      <span key={label} className={`inline-flex items-center gap-2 rounded-full  px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/[0.06] text-white/75" : "border-black/10 bg-[#f7f5ef] text-black/70"}`}>
                        <span className={darkMode ? "text-white/40" : "text-black/45"}>{label}</span>
                        <span className="max-w-[180px] truncate text-sm text-current">{value || "-"}</span>
                      </span>
                    ))}
                    <span className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${darkMode ? "bg-[#d8f36a]/15 text-[#d8f36a]" : "bg-[#eef7df] text-[#17643f]"}`}>Read-only</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TaskItemsDisplay title="Task description" items={detail.taskItems} fallback={detail.taskDescription} darkMode={darkMode} showStatus showInvolvement />
                  <TaskItemsDisplay title="Waiting / tomorrow plan" items={detail.waitingTaskItems} fallback={detail.waitingTaskDescription} darkMode={darkMode} showInvolvement />
                  <div className={`rounded-[22px] p-5 md:col-span-2 ${darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]"}`}>
                    <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>Note</p>
                    <p className="mt-3 whitespace-pre-wrap text-base leading-7">{detail.note || "-"}</p>
                  </div>
                </div>
              </div></div>
            </div>
          </div>
        </div>
      )}

      {heatmapOpen && !data?.isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md">
          <div className={`w-full max-w-6xl rounded-[30px] p-5 shadow-2xl ${darkMode ? "bg-[#1f2528] text-white" : "bg-[#eef2f5] text-[#171714]"}`}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Activity heatmap</p>
                <h3 className="mt-2 text-2xl font-semibold">Your submission activity</h3>
              </div>
              <button onClick={() => setHeatmapOpen(false)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-white/10" : "bg-white"}`}><X className="h-4 w-4" /></button>
            </div>
            <Heatmap darkMode={darkMode} rows={data?.heatmap || []} title="Your submission activity" />
          </div>
        </div>
      )}

      <ConfettiBurst active={confettiActive} onDone={() => setConfettiActive(false)} />
    </main>
  );
}
