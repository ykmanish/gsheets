"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Check, CheckCircle2, Clock3, Eye, FileText, Plus, Search, Trash2, X } from "lucide-react";
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
  client: "",
  site: "",
  taskType: "",
  taskTypeOther: "",
  taskItems: [{ category: "", description: "" }],
  taskStatus: "",
  taskStatusOther: "",
  involvement: "",
  involvementOther: "",
  waitingTaskItems: [{ category: "", description: "" }],
  tomorrowPlanTick: false,
  note: "",
};

function fieldValue(value, other) {
  return value === "__other" ? other : value;
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

function SearchableSelect({ darkMode, value, onChange, options = [], placeholder, allowOther = true }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useClickOutside(ref, () => setOpen(false));
  const selectedLabel = value === "__other" ? "Other" : value;
  const filtered = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm ${darkMode ? "border-white/10 bg-white/[0.035] text-white" : "border-black/10 bg-white text-black"}`}
      >
        <span className={selectedLabel ? "" : darkMode ? "text-white/35" : "text-black/35"}>{selectedLabel || placeholder}</span>
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
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => { onChange(option); setOpen(false); setQuery(""); }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${option === value ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}
              >
                {option}
              </button>
            ))}
            {allowOther && (
              <button
                type="button"
                onClick={() => { onChange("__other"); setOpen(false); setQuery(""); }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${value === "__other" ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}
              >
                Other
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRowsEditor({ title, rows, categories, onRowsChange, required = false }) {
  function updateRow(index, patch) {
    onRowsChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    onRowsChange([...rows, { category: "", description: "" }]);
  }
  function removeRow(index) {
    onRowsChange(rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [{ category: "", description: "" }]);
  }
  return (
    <div className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">{title}</label>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-[22px] border border-black/10 bg-[#f8f7f3] p-3">
            <div className="grid gap-3 lg:grid-cols-[260px_1fr_auto]">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">Category</p>
                <SearchableSelect
                  darkMode={false}
                  value={row.category}
                  onChange={(value) => updateRow(index, { category: value })}
                  options={categories}
                  placeholder="Choose category"
                  allowOther={false}
                />
                {required && index === 0 && !row.category && <input tabIndex={-1} autoComplete="off" className="pointer-events-none h-0 w-0 opacity-0" required value="" onChange={() => {}} />}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">Description</p>
                <textarea
                  required={required && index === 0}
                  value={row.description}
                  onChange={(event) => updateRow(index, { description: event.target.value })}
                  rows={2}
                  placeholder="Describe this task..."
                  className="min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                />
              </div>
              <button type="button" onClick={() => removeRow(index)} className="mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <button type="button" onClick={addRow} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#171714] px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add task</button>
      </div>
    </div>
  );
}

function TaskItemsDisplay({ title, items = [], fallback, darkMode }) {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item.category || item.description) : [];
  return (
    <div className={`rounded-[22px] p-5 md:col-span-2 ${darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]"}`}>
      <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>{title}</p>
      {visibleItems.length ? (
        <div className="mt-3">
          <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm">
            <thead className={darkMode ? "text-white/55" : "text-slate-500"}>
              <tr>
                <th className="w-16 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Sr No:</th>
                <th className="w-36 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Task Category</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">Description</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={`${item.category}-${index}`} className={darkMode ? "bg-white/[0.045]" : "bg-white"}>
                  <td className="rounded-l-2xl px-4 py-3 font-semibold">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex max-w-full whitespace-normal rounded-full px-3 py-1 text-xs font-semibold leading-4 ${darkMode ? "bg-[#d8f36a]/15 text-[#d8f36a]" : "bg-[#e8f5eb] text-[#145b39]"}`}>
                      {item.category || "-"}
                    </span>
                  </td>
                  <td className="whitespace-pre-wrap break-words rounded-r-2xl px-4 py-3 leading-6">{item.description || "-"}</td>
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportFrom, setReportFrom] = useState(() => addDaysInput(todayInput(), -6));
  const [reportTo, setReportTo] = useState(() => todayInput());
  const [reportUserIds, setReportUserIds] = useState([]);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [sheetInput, setSheetInput] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white";
  const softPanel = darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white";

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

  function openForm() {
    if (!data?.profile?.sheetLinked) {
      toast.error("Link your Google Sheet before filling today's report");
      return;
    }
    setForm({
      ...emptyForm,
      taskItems: [{ category: "", description: "" }],
      waitingTaskItems: [{ category: "", description: "" }],
      department: data?.profile?.department || "",
    });
    setFormOpen(true);
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
      const taskItems = (form.taskItems || []).map((item) => ({ category: item.category.trim(), description: item.description.trim() })).filter((item) => item.category && item.description);
      const waitingTaskItems = (form.waitingTaskItems || []).map((item) => ({ category: item.category.trim(), description: item.description.trim() })).filter((item) => item.category && item.description);
      const payload = {
        ...form,
        department: fieldValue(form.department, form.departmentOther),
        taskType: fieldValue(form.taskType, form.taskTypeOther),
        taskStatus: fieldValue(form.taskStatus, form.taskStatusOther),
        involvement: fieldValue(form.involvement, form.involvementOther),
        taskItems,
        waitingTaskItems,
      };
      await api("/employee-daily-report", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Daily report submitted");
      setConfettiActive(true);
      setFormOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not submit report");
    } finally {
      setSubmitting(false);
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
  const reportUsers = data?.reportUsers || [];
  const initialLoading = loading && !data;

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#e4f2f0] text-[#171714]"}`}>
      <section className={`relative mb-5 overflow-hidden rounded-[28px] border p-6 sm:p-7 ${darkMode ? "border-white/10 bg-[#202328]" : "border-black/10 bg-[#fbf4e6] shadow-[8px_8px_0_rgba(0,0,0,0.12)]"}`}>
          {!darkMode && (
            <>
              <span className="absolute -left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#e4f2f0]" />
              <span className="absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#e4f2f0]" />
              {/* <span className="absolute left-1/2 top-4 hidden -translate-x-1/2 rounded-full border border-black/15 bg-[#f7ec9a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] shadow-[3px_3px_0_rgba(0,0,0,0.16)] rotate-3 md:inline-flex">
                work log
              </span> */}
            </>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold shadow-[3px_3px_0_rgba(0,0,0,0.14)] ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/15 bg-[#d5f3f0] text-black/70 -rotate-1"}`}>
                  <CalendarCheck className="h-4 w-4" /> Employee Daily Report
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/10 bg-[#f7ec9a] text-black/70 shadow-[2px_2px_0_rgba(0,0,0,0.12)]"}`}>
                  {initialLoading ? <ThreeDotLoader /> : data?.profile?.department || "Department not set"}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/10 bg-[#f8b9d4] text-black/70 shadow-[2px_2px_0_rgba(0,0,0,0.12)]"}`}>
                  <CalendarCheck className="h-3.5 w-3.5" /> {initialLoading ? <ThreeDotLoader /> : data?.todaySubmitted ? "Today filled" : "Today pending"}
                </span>
              </div>
              <h1 className={`mt-4 max-w-4xl text-4xl small font-black leading-[0.95] tracking-tight sm:text-4xl ${darkMode ? "text-white" : "text-[#171714]"}`}>Daily work reports, made simple.</h1>
              <div className={`my-3 h-1 w-full max-w-xl border-t border-dashed ${darkMode ? "border-white/20" : "border-black/20"}`} />
              <p className={`max-w-3xl text-sm font-medium leading-6 ${darkMode ? "text-white/65" : "text-black/70"}`}>Submit today&apos;s work progress, review previous entries, and track reporting consistency in one clean workspace.</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
            <button
              disabled={initialLoading || data?.todaySubmitted || !data?.profile?.sheetLinked}
              onClick={openForm}
              className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm font-black shadow-[4px_4px_0_rgba(0,0,0,0.18)] transition active:translate-x-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "border-[#d8f36a]/20 bg-[#d8f36a] text-black" : "border-black bg-[#171714] text-white"}`}
            >
              {data?.todaySubmitted ? <CheckCircle2 className="h-4 w-4" /> : initialLoading ? null : <Plus className="h-4 w-4" />}
              {initialLoading ? <ThreeDotLoader /> : data?.todaySubmitted ? "Today's report filled" : data?.profile?.sheetLinked ? "Fill today's report" : "Link sheet first"}
            </button>
            {!data?.isAdmin && (
              <button onClick={() => setHeatmapOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm font-black shadow-[4px_4px_0_rgba(0,0,0,0.14)] transition active:translate-x-0.5 active:translate-y-0.5 ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-black/10 bg-[#f8b9d4] text-black"}`}>
                <CalendarCheck className="h-4 w-4" /> My activity
              </button>
            )}
            {data?.isAdmin && (
              <button onClick={() => setReportOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm font-black shadow-[4px_4px_0_rgba(0,0,0,0.14)] transition active:translate-x-0.5 active:translate-y-0.5 ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-black/10 bg-[#f7ec9a] text-black"}`}>
                <FileText className="h-4 w-4" /> Generate report
              </button>
            )}
            </div>
          </div>
          {initialLoading ? (
            <div className={`mt-5 flex min-h-[92px] items-center justify-center rounded-[24px] border p-3 ${darkMode ? "border-white/10 bg-white/[0.05]" : "border-black/10 bg-white/65"}`}>
              <ThreeDotLoader className={darkMode ? "text-white/60" : "text-black/55"} />
            </div>
          ) : (
            <div className={`mt-5 rounded-[24px] border p-3 ${darkMode ? "border-white/10 bg-white/[0.05]" : "border-black/10 bg-white/65"}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Linked Google Sheet</p>
                  <input
                    value={sheetInput}
                    onChange={(event) => setSheetInput(event.target.value)}
                    placeholder="Paste your daily report Google Sheet link"
                    className={`mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-black/20 text-white placeholder:text-white/35" : "border-black/10 bg-white text-black placeholder:text-black/35"}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveSheetLink}
                  disabled={sheetSaving || !sheetInput.trim()}
                  className={`h-11 rounded-2xl px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                >
                  {sheetSaving ? "Linking..." : data?.profile?.sheetLinked ? "Update sheet" : "Link sheet"}
                </button>
              </div>
              <p className={`mt-2 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>Reports are saved into this sheet and dashboard data is read back from it.</p>
            </div>
          )}
       </section>

      <section className={`mt-5 overflow-hidden rounded-[28px] border ${panel}`}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl small font-semibold">{data?.isAdmin ? "Submitted employee reports" : "My filled reports"}</h2>
            <p className={`mt-1 text-sm ${muted}`}>Read-only report history.</p>
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
          <table className="w-full min-w-[1040px] border-separate border-spacing-y-3 text-left text-sm">
            <thead className={darkMode ? "text-white/55" : "text-slate-500"}>
              <tr>
                {["Sl No:", "Employee", "Date", "Time filled", "Department", "Task type", "Status", "Actions"].map((header) => <th key={header} className="px-5 py-3 text-xs font-semibold">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className={`px-5 py-10 text-center ${muted}`}>Loading reports...</td></tr>}
              {!loading && reports.map((report, index) => (
                <tr key={report.id} className={darkMode ? "bg-white/[0.04]" : "bg-[#f7f8fb]"}>
                  <td className="rounded-l-2xl px-5 py-4 font-semibold">{index + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold ${darkMode ? "bg-white/10 text-white" : "bg-[#d5f3f0] text-[#145b39]"}`}>{(report.employeeName || "E").slice(0, 1).toUpperCase()}</span>
                      <div>
                        <p className="font-semibold">{report.employeeName}</p>
                        <p className={`text-xs ${muted}`}>{report.client || "-"} · {report.site || "-"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium">{report.reportDate}</td>
                  <td className="px-5 py-4">{displayDateTime(report.submittedAt)}</td>
                  <td className="px-5 py-4">{report.department}</td>
                  <td className="px-5 py-4">{report.taskType}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${/complete/i.test(report.taskStatus || "") ? "bg-emerald-50 text-emerald-700" : darkMode ? "bg-amber-500/10 text-amber-200" : "bg-amber-50 text-amber-700"}`}>{report.taskStatus}</span>
                  </td>
                  <td className="rounded-r-2xl px-5 py-4">
                    <button onClick={() => setDetail(report)} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-blue-600  hover:bg-blue-50"}`} title="View detail"><Eye className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!loading && !reports.length && <tr><td colSpan={8} className={`px-5 py-10 text-center ${muted}`}>No reports found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-[#2f2a22]/65 backdrop-blur-md">
          <form onSubmit={submitReport} className="flex h-screen w-screen flex-col overflow-hidden bg-[#f4f1ea] p-4 text-[#171714] shadow-2xl">
            <div className="mb-4 flex shrink-0 items-center justify-between rounded-[22px] bg-[#2d2a22] px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><CalendarCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs text-white/55">Daily work progress</p>
                  <h3 className="text-lg font-semibold">{todayInput()}</h3>
                </div>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[360px_1fr]">
              <aside className="flex min-h-0 flex-col overflow-hidden rounded-[26px] bg-[#145b39] text-white shadow-xl">
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/55">Report setup</p>
                    <h4 className="mt-4 text-2xl font-semibold">What did you work on today?</h4>
                    <p className="mt-3 text-sm leading-6 text-white/65">Keep the update clear and complete. Once submitted, today&apos;s report becomes read-only.</p>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/15 p-4"><p className="text-xs text-white/55">Department</p><p className="mt-1 font-semibold">{data?.profile?.department || "Required once"}</p></div>
                    <div className="rounded-2xl border border-white/15 p-4"><p className="text-xs text-white/55">Status</p><p className="mt-1 font-semibold">{data?.todaySubmitted ? "Already filled" : "Ready to submit"}</p></div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 border-t border-white/10 p-6">
                  <button type="button" onClick={() => setFormOpen(false)} className="h-11 flex-1 rounded-full bg-white text-sm font-semibold text-[#145b39]">Cancel</button>
                  <button disabled={submitting} className="h-11 flex-1 rounded-full bg-[#d8f36a] text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Submitting..." : "Submit"}</button>
                </div>
              </aside>

              <div className="min-h-0 overflow-y-auto rounded-[26px] bg-white p-6 pb-24 shadow-sm">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">Task entry</p>
                    <h4 className="mt-2 text-2xl font-semibold">Fill today&apos;s report</h4>
                  </div>
                  <span className="rounded-full bg-[#eef7df] px-3 py-1 text-xs font-semibold text-[#17643f]">Read-only after submit</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {!data?.profile?.department && (
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Department</label>
                      <SearchableSelect darkMode={false} value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} options={options.departments} placeholder="Choose department" />
                      {form.department === "__other" && <input required value={form.departmentOther || ""} onChange={(event) => setForm((current) => ({ ...current, departmentOther: event.target.value }))} placeholder="Enter department" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none" />}
                    </div>
                  )}
                  {["client", "site"].map((field) => (
                    <div key={field}>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">{field === "client" ? "Client" : "Site"}</label>
                      <input required value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={field === "client" ? "Enter client" : "Enter site"} className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none" />
                    </div>
                  ))}
                  <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Task Type</label><SearchableSelect darkMode={false} value={form.taskType} onChange={(value) => setForm((current) => ({ ...current, taskType: value }))} options={options.taskTypes} placeholder="Choose task type" />{form.taskType === "__other" && <input required value={form.taskTypeOther} onChange={(event) => setForm((current) => ({ ...current, taskTypeOther: event.target.value }))} placeholder="Enter task type" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none" />}</div>
                  <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Task Status</label><SearchableSelect darkMode={false} value={form.taskStatus} onChange={(value) => setForm((current) => ({ ...current, taskStatus: value }))} options={options.taskStatuses} placeholder="Choose task status" />{form.taskStatus === "__other" && <input required value={form.taskStatusOther} onChange={(event) => setForm((current) => ({ ...current, taskStatusOther: event.target.value }))} placeholder="Enter task status" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none" />}</div>
                  <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Involvement</label><SearchableSelect darkMode={false} value={form.involvement} onChange={(value) => setForm((current) => ({ ...current, involvement: value }))} options={options.involvements} placeholder="Choose involvement" />{form.involvement === "__other" && <input required value={form.involvementOther} onChange={(event) => setForm((current) => ({ ...current, involvementOther: event.target.value }))} placeholder="Enter involvement" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none" />}</div>
                  <label className="flex h-12 w-full cursor-pointer select-none items-center gap-3 self-end rounded-2xl border border-black/10 bg-[#f8f7f3] px-4 text-sm transition duration-200 hover:border-[#145b39]/25 hover:bg-[#f3f8ed] active:scale-[0.99]">
                    <input
                      type="checkbox"
                      checked={form.tomorrowPlanTick}
                      onChange={(event) => setForm((current) => ({ ...current, tomorrowPlanTick: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-xl border shadow-sm transition duration-200 peer-active:scale-95 ${form.tomorrowPlanTick ? "scale-105 border-[#145b39] bg-[#145b39]" : "border-black/15 bg-white"}`}>
                      <Check className={`h-4 w-4 text-white transition duration-200 ${form.tomorrowPlanTick ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} />
                    </span>
                    <span className="font-medium text-black/80">Tick for tomorrow&apos;s plan</span>
                  </label>
                  <TaskRowsEditor
                    title="Task description"
                    rows={form.taskItems}
                    categories={options.taskTypes}
                    required
                    onRowsChange={(rows) => setForm((current) => ({ ...current, taskItems: rows }))}
                  />
                  <TaskRowsEditor
                    title="Tasks in waiting / tomorrow plan"
                    rows={form.waitingTaskItems}
                    categories={options.taskTypes}
                    onRowsChange={(rows) => setForm((current) => ({ ...current, waitingTaskItems: rows }))}
                  />
                  <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Note</label><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} placeholder="Any extra note..." className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none" /></div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {reportOpen && data?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-[#2f2a22]/65 backdrop-blur-md">
          <div className={`flex h-screen w-screen flex-col overflow-hidden p-4 shadow-2xl ${darkMode ? "bg-[#101216] text-white" : "bg-[#f4f1ea] text-[#171714]"}`}>
            <div className={`mb-4 flex shrink-0 items-center justify-between rounded-[22px] px-5 py-4 text-white ${darkMode ? "bg-[#191b20]" : "bg-[#2d2a22]"}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><FileText className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs text-white/55">Employee daily report</p>
                  <h3 className="text-lg font-semibold">Admin report generator</h3>
                </div>
              </div>
              <button onClick={() => setReportOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
            </div>

            <div className={`mb-4 shrink-0 rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${muted}`}>Report range</p>
                  <h4 className="mt-2 text-2xl font-semibold">Generate employee work summary</h4>
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
                  <button onClick={generateEmployeeReport} disabled={reportLoading} className={`h-11 rounded-2xl px-5 text-sm font-semibold disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>{reportLoading ? "Generating..." : "Generate"}</button>
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
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-[#2f2a22]/65 backdrop-blur-md">
          <div className={`flex h-screen w-screen flex-col overflow-hidden p-4 shadow-2xl ${darkMode ? "bg-[#101216] text-white" : "bg-[#f4f1ea] text-[#171714]"}`}>
            <div className={`mb-4 flex items-center justify-between rounded-[22px] px-5 py-4 text-white ${darkMode ? "bg-[#191b20]" : "bg-[#2d2a22]"}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Eye className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs text-white/55">Read-only report detail</p>
                  <h3 className="text-lg font-semibold">{detail.reportDate}</h3>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[300px_1fr]">
              <aside className={`flex min-h-0 flex-col rounded-[26px] p-6 text-white shadow-xl ${darkMode ? "bg-[#0f4f34]" : "bg-[#145b39]"}`}>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Submitted by</p>
                  <h4 className="mt-4 text-2xl font-semibold leading-tight">{detail.employeeName || "Employee"}</h4>
                  <p className="mt-3 text-sm leading-6 text-white/65">{displayDateTime(detail.submittedAt)}</p>
                </div>
                <div className="mt-8 space-y-3">
                  <div className="rounded-2xl border border-white/15 p-4"><p className="text-xs text-white/55">Department</p><p className="mt-1 font-semibold">{detail.department || "-"}</p></div>
                  <div className="rounded-2xl border border-white/15 p-4"><p className="text-xs text-white/55">Status</p><p className="mt-1 font-semibold">{detail.taskStatus || "-"}</p></div>
                  <div className="rounded-2xl border border-white/15 p-4"><p className="text-xs text-white/55">Tomorrow plan</p><p className="mt-1 font-semibold">{detail.tomorrowPlanTick ? "Ticked" : "Not ticked"}</p></div>
                </div>
                <button onClick={() => setDetail(null)} className="mt-auto h-11 rounded-full bg-white text-sm font-semibold text-[#145b39]">Close</button>
              </aside>

              <div className={`min-h-0 overflow-y-auto rounded-[26px] p-6 pb-10 shadow-sm ${darkMode ? "bg-[#171a20]" : "bg-white"}`}>
                <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Work progress</p>
                    <h4 className="mt-2 text-2xl small font-semibold">Daily report summary</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {[
                      ["Client", detail.client],
                      ["Site", detail.site],
                      ["Task Type", detail.taskType],
                      ["Involvement", detail.involvement],
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
                  <TaskItemsDisplay title="Task description" items={detail.taskItems} fallback={detail.taskDescription} darkMode={darkMode} />
                  <TaskItemsDisplay title="Waiting / tomorrow plan" items={detail.waitingTaskItems} fallback={detail.waitingTaskDescription} darkMode={darkMode} />
                  <div className={`rounded-[22px] p-5 md:col-span-2 ${darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]"}`}>
                    <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>Note</p>
                    <p className="mt-3 whitespace-pre-wrap text-base leading-7">{detail.note || "-"}</p>
                  </div>
                </div>
              </div>
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
