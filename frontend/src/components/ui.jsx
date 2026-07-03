"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Clock3,
  File,
  FileArchive,
  FileText,
  FileType,
  Image as ImageIcon,
  Moon,
  Sheet,
  Sun,
} from "lucide-react";

export function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handlePointerDown(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      onOutside?.();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [ref, onOutside]);
}

export function ThemeSwitch({ darkMode, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-10 w-[74px] rounded-full border p-1 transition-all duration-500 ease-out sm:h-11 sm:w-20 ${
        darkMode
          ? "border-white/10 bg-white/10 shadow-[inset_0_0_18px_rgba(216,243,106,0.08)]"
          : "border-black/10 bg-black/[0.04]"
      }`}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span
        className={`absolute inset-y-1 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-500 ease-out sm:h-9 sm:w-9 ${
          darkMode ? "translate-x-8 bg-[#d8f36a] text-black sm:translate-x-9" : "translate-x-0 bg-black text-white"
        }`}
      >
        {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function SelectMenu({ darkMode, value, options, onChange, disabled = false, placeholder = "Select an option", className = "" }) {
  const [open, setOpen] = useState(false);
  const [opensUpward, setOpensUpward] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const selected = options.find((option) => option.value === value);

  const updatePlacement = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedMenuHeight = Math.min(options.length * 44 + 20, 276);
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    setOpensUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow);
  }, [options.length]);

  useEffect(() => {
    if (!open) return undefined;
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  return (
    <div ref={ref} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          updatePlacement();
          setOpen((current) => !current);
        }}
        className={`h-12 w-full rounded-2xl border px-4 flex items-center justify-between gap-3 text-left transition disabled:opacity-60 ${
          darkMode
            ? "bg-[#15171c] border-white/10 text-white hover:bg-white/10"
            : "bg-white border-black/10 text-black hover:bg-black/[0.03]"
        } ${open ? (darkMode ? "ring-2 ring-[#d8f36a]/25" : "ring-2 ring-black/10") : ""}`}
      >
        <span className={`truncate ${selected ? "" : darkMode ? "text-white/35" : "text-black/35"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <div
          className={`absolute left-0 right-0 z-40 rounded-2xl border p-2 shadow-xl ${opensUpward ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"} ${
            darkMode ? "bg-[#181a20] border-white/10" : "bg-white border-black/5"
          }`}
        >
          <div className="max-h-64 overflow-y-auto pr-1">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 text-left text-sm transition ${
                    active
                      ? darkMode
                        ? "bg-[#d8f36a] text-black"
                        : "bg-black text-white"
                      : darkMode
                      ? "text-white/70 hover:bg-white/8"
                      : "text-black/65 hover:bg-black/[0.04]"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function toDateInputValue(date) {
  if (!date) return "";
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) return "";
  normalized.setMinutes(normalized.getMinutes() - normalized.getTimezoneOffset());
  return normalized.toISOString().slice(0, 10);
}

function fromDateInputValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value) {
  if (!value) return "Select date";
  const date = fromDateInputValue(value);
  if (!date) return "Select date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameDay(a, b) {
  return Boolean(a && b && toDateInputValue(a) === toDateInputValue(b));
}

function toDateTimeInputValue(date) {
  if (!date) return "";
  const normalized = new Date(date);
  normalized.setMinutes(normalized.getMinutes() - normalized.getTimezoneOffset());
  return normalized.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value) {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0);
}

export function DateRangePicker({ darkMode, from, to, onChange, placeholder = "Choose report dates" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState("from");
  const [monthDate, setMonthDate] = useState(() => fromDateInputValue(from) || new Date());
  useClickOutside(ref, () => setOpen(false));

  const fromDate = fromDateInputValue(from);
  const toDate = fromDateInputValue(to);
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

  const quickRanges = [
    ["Last week", -7],
    ["Last Month", -30],
    ["This week", "week"],
    ["This month", "month"],
  ];

  function setRange(nextFrom, nextTo) {
    onChange({ from: toDateInputValue(nextFrom), to: toDateInputValue(nextTo) });
  }

  function handleDayClick(day) {
    if (activeField === "from") {
      const nextTo = toDate && day > toDate ? day : toDate;
      setRange(day, nextTo);
      setActiveField("to");
      return;
    }
    const nextFrom = fromDate && day < fromDate ? day : fromDate;
    setRange(nextFrom, day);
  }

  function applyQuick(value) {
    const today = new Date();
    if (value === "week") {
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      setRange(start, today);
      setMonthDate(start);
      return;
    }
    if (value === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setRange(start, today);
      setMonthDate(start);
      return;
    }
    const start = new Date(today);
    start.setDate(today.getDate() + value);
    setRange(start, today);
    setMonthDate(start);
  }

  return (
    <div ref={ref} className="relative md:col-span-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`h-12 w-full rounded-2xl border px-4 text-left transition ${
          darkMode
            ? "bg-[#15171c] border-white/10 text-white hover:bg-white/10"
            : "bg-white border-black/10 text-black hover:bg-black/[0.03]"
        }`}
      >
        <span className="flex items-center gap-2 text-sm">
          <CalendarDays className={`h-4 w-4 ${darkMode ? "text-[#d8f36a]" : "text-indigo-600"}`} />
          <span className="truncate">{from || to ? `${formatDisplayDate(from)} - ${formatDisplayDate(to)}` : placeholder}</span>
        </span>
      </button>

      {open && (
        <div
          className={`absolute left-0 top-[calc(100%+10px)] z-50 w-[min(92vw,462px)] rounded-[22px] border p-3 shadow-2xl sm:p-4 ${
            darkMode ? "bg-[#121317] border-white/10 text-white" : "bg-white border-black/10 text-black"
          }`}
        >
          <div className="rounded-2xl border p-3 shadow-sm sm:p-4 dark:border-white/10">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
              <div>
                <p className={`mb-1 text-sm ${darkMode ? "text-white/70" : "text-black/65"}`}>Start day</p>
                <button
                  type="button"
                  onClick={() => setActiveField("from")}
                  className={`flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition sm:text-base ${
                    activeField === "from"
                      ? darkMode
                        ? "border-[#d8f36a] text-[#d8f36a] ring-2 ring-[#d8f36a]/20"
                        : "border-indigo-600 text-indigo-700 ring-2 ring-indigo-600/20"
                      : darkMode
                      ? "border-white/10 text-white"
                      : "border-black/15 text-black"
                  }`}
                >
                  <CalendarDays className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{formatDisplayDate(from)}</span>
                </button>
              </div>
              <span className={`pb-3 text-xl ${darkMode ? "text-white/50" : "text-black/45"}`}>→</span>
              <div>
                <p className={`mb-1 text-sm ${darkMode ? "text-white/70" : "text-black/65"}`}>End day</p>
                <button
                  type="button"
                  onClick={() => setActiveField("to")}
                  className={`flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition sm:text-base ${
                    activeField === "to"
                      ? darkMode
                        ? "border-[#d8f36a] text-[#d8f36a] ring-2 ring-[#d8f36a]/20"
                        : "border-indigo-600 text-indigo-700 ring-2 ring-indigo-600/20"
                      : darkMode
                      ? "border-white/10 text-white"
                      : "border-black/15 text-black"
                  }`}
                >
                  <CalendarDays className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{formatDisplayDate(to)}</span>
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickRanges.map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => applyQuick(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm ${darkMode ? "bg-white/5 text-white/75" : "bg-black/[0.04] text-black/75"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              className="rounded-full px-3 py-2 text-sm"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            <p className="text-xl font-semibold">{monthLabel(monthDate)}</p>
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              className="rounded-full px-3 py-2 text-sm"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>

          <div className={`mt-5 grid grid-cols-7 gap-y-2 text-center text-sm ${darkMode ? "text-white/55" : "text-black/55"}`}>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-y-2 text-center">
            {days.map((day) => {
              const inMonth = day.getMonth() === monthDate.getMonth();
              const selected = sameDay(day, fromDate) || sameDay(day, toDate);
              const inRange = fromDate && toDate && day > fromDate && day < toDate;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`mx-auto h-9 w-9 rounded-xl text-sm transition sm:h-10 sm:w-10 sm:text-base ${
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
                        ? "text-white hover:bg-white/8"
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

export function DatePicker({ darkMode, value, onChange, placeholder = "Choose date" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0, maxHeight: 380 });
  const selectedDate = fromDateInputValue(value);
  const [monthDate, setMonthDate] = useState(() => selectedDate || new Date());
  useClickOutside(ref, () => setOpen(false));

  const positionPopover = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;
    const margin = 8;
    const width = Math.min(300, viewportWidth - margin * 2);
    const desiredHeight = 370;
    const spaceBelow = viewportHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const opensBelow = spaceBelow >= Math.min(desiredHeight, spaceAbove);
    const maxHeight = Math.max(240, Math.min(desiredHeight, opensBelow ? spaceBelow : spaceAbove));
    const top = opensBelow
      ? Math.min(rect.bottom + gap, viewportHeight - maxHeight - margin)
      : Math.max(margin, rect.top - maxHeight - gap);
    const preferredLeft = rect.left;
    const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - width - margin));
    setPopoverStyle({ top, left, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    positionPopover();
    window.addEventListener("resize", positionPopover);
    window.addEventListener("scroll", positionPopover, true);
    return () => {
      window.removeEventListener("resize", positionPopover);
      window.removeEventListener("scroll", positionPopover, true);
    };
  }, [open, positionPopover]);

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

  function selectDay(day) {
    onChange(toDateInputValue(day));
    setMonthDate(day);
    setOpen(false);
  }

  function selectToday() {
    const today = new Date();
    selectDay(today);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`h-10 w-full min-w-[150px] rounded-xl border px-3 text-left transition ${
          darkMode
            ? "bg-[#15171c] border-white/10 text-white hover:bg-white/10"
            : "bg-white border-black/10 text-black hover:bg-black/[0.03]"
        }`}
      >
        <span className="flex items-center gap-2 text-sm">
          <CalendarDays className={`h-3.5 w-3.5 ${darkMode ? "text-[#89ed3f]" : "text-[#4b9b16]"}`} />
          <span className="truncate">{value ? formatDisplayDate(value) : placeholder}</span>
        </span>
      </button>

      {open && (
        <div
          style={popoverStyle}
          className={`fixed z-[100] overflow-y-auto rounded-2xl border p-3 shadow-[0_18px_60px_rgba(0,0,0,0.2)] ${
            darkMode ? "bg-[#121317] border-white/10 text-white" : "bg-white border-black/10 text-black"
          }`}
        >
          <div className="rounded-xl border p-2.5 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-white/55" : "text-black/45"}`}>Selected day</p>
                <div
                  className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${
                    darkMode
                      ? "border-[#89ed3f] text-[#89ed3f]"
                      : "border-[#69c832] text-[#4b9b16]"
                  }`}
                >
                  <CalendarDays className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{formatDisplayDate(value)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={selectToday}
                className={`mt-4 rounded-lg px-2.5 py-2 text-xs font-semibold ${darkMode ? "bg-white/5 text-white/75" : "bg-[#f3f5ef] text-black/65"}`}
              >
                Today
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              className="rounded-full p-2 text-sm"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            <p className="text-base font-bold">{monthLabel(monthDate)}</p>
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              className="rounded-full p-2 text-sm"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>

          <div className={`mt-2 grid grid-cols-7 text-center text-[11px] font-semibold ${darkMode ? "text-white/45" : "text-black/45"}`}>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-y-1 text-center">
            {days.map((day) => {
              const inMonth = day.getMonth() === monthDate.getMonth();
              const selected = sameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`mx-auto h-8 w-8 rounded-lg text-xs transition ${
                    selected
                      ? darkMode
                        ? "bg-[#89ed3f] text-black shadow-sm"
                        : "bg-[#89ed3f] text-black shadow-sm"
                      : inMonth
                      ? darkMode
                        ? "text-white hover:bg-white/8"
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

export function DateTimePicker({ darkMode, value, onChange, placeholder = "Choose expiry" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(null);
  const selectedDate = fromDateTimeInputValue(value);
  const [monthDate, setMonthDate] = useState(() => selectedDate || new Date());
  useClickOutside(ref, () => setOpen(null));

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

  const selectedHour = selectedDate?.getHours() ?? 18;
  const selectedMinute = selectedDate?.getMinutes() ?? 0;
  const timeOptions = useMemo(() => Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 === 0 ? 0 : 30;
    const date = new Date(2000, 0, 1, hour, minute);
    return { hour, minute, label: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
  }), []);

  function commitDateTime(day, hour = selectedHour, minute = selectedMinute) {
    const next = new Date(day);
    next.setHours(hour, minute, 0, 0);
    onChange(toDateTimeInputValue(next));
  }

  function selectTime(hour, minute) {
    commitDateTime(selectedDate || new Date(), hour, minute);
    setOpen(null);
  }

  return (
    <div ref={ref} className="relative">
      <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
        <button
          type="button"
          onClick={() => setOpen((current) => current === "date" ? null : "date")}
          className={`flex h-12 min-w-0 items-center gap-2 rounded-2xl border px-4 text-left text-sm transition ${
            darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-black"
          } ${open === "date" ? (darkMode ? "ring-2 ring-[#d8f36a]/25" : "ring-2 ring-orange-500/20") : ""}`}
        >
          <CalendarDays className={`h-4 w-4 shrink-0 ${darkMode ? "text-[#d8f36a]" : "text-orange-500"}`} />
          <span className={`truncate ${value ? "" : darkMode ? "text-white/35" : "text-black/35"}`}>
            {selectedDate ? selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : placeholder}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((current) => current === "time" ? null : "time")}
          className={`flex h-12 items-center gap-2 rounded-2xl border px-4 text-left text-sm transition ${
            darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-black"
          } ${open === "time" ? (darkMode ? "ring-2 ring-[#d8f36a]/25" : "ring-2 ring-orange-500/20") : ""}`}
        >
          <Clock3 className={`h-4 w-4 shrink-0 ${darkMode ? "text-[#d8f36a]" : "text-orange-500"}`} />
          <span className={value ? "" : darkMode ? "text-white/35" : "text-black/35"}>
            {selectedDate ? selectedDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Time"}
          </span>
        </button>
      </div>

      {open === "date" && (
        <div
          className={`absolute left-0 top-[calc(100%+10px)] z-50 w-[min(92vw,330px)] rounded-[18px] border p-3 shadow-2xl ${
            darkMode ? "bg-[#121317] border-white/10 text-white" : "bg-white border-orange-200 text-black"
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/[0.03] hover:bg-black/[0.06]"}`}
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            <p className="text-sm font-semibold">{monthLabel(monthDate)}</p>
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/[0.03] hover:bg-black/[0.06]"}`}
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>

          <div className={`mt-4 grid grid-cols-7 gap-y-2 text-center text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-y-2 text-center">
            {days.map((day) => {
              const inMonth = day.getMonth() === monthDate.getMonth();
              const selected = sameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    commitDateTime(day);
                    setOpen(null);
                  }}
                  className={`mx-auto h-8 w-8 rounded-lg text-sm transition ${
                    selected
                      ? darkMode
                        ? "bg-[#d8f36a] text-black shadow-lg"
                        : "bg-orange-500 text-white shadow-lg"
                      : inMonth
                      ? darkMode
                        ? "text-white hover:bg-white/8"
                        : "text-black hover:bg-black/[0.04]"
                      : darkMode
                      ? "text-white/20"
                      : "text-black/25"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(null);
              }}
              className={`w-full rounded-xl px-3 py-2 text-sm ${darkMode ? "bg-white/5 text-white/65" : "bg-black/[0.04] text-black/65"}`}
            >
              Clear expiry
            </button>
          </div>
        </div>
      )}

      {open === "time" && (
        <div className={`absolute right-0 top-[calc(100%+10px)] z-50 w-[180px] rounded-[18px] border p-2 shadow-2xl ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-orange-200 bg-white text-black"}`}>
          <p className={`px-2 pb-2 pt-1 text-[11px] uppercase tracking-[0.2em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Select time</p>
          <div className="max-h-64 overflow-y-auto pr-1">
            {timeOptions.map((option) => {
              const active = selectedHour === option.hour && selectedMinute === option.minute && Boolean(value);
              return (
                <button
                  key={`${option.hour}-${option.minute}`}
                  type="button"
                  onClick={() => selectTime(option.hour, option.minute)}
                  className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm transition ${active ? darkMode ? "bg-[#d8f36a] text-black" : "bg-orange-500 text-white" : darkMode ? "text-white/70 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConfirmModal({
  darkMode,
  open,
  title = "Delete item",
  message = "Are you sure? This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"}`}>
        <div className="mb-5 flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${darkMode ? "bg-red-500/10" : "bg-red-50"}`}>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </span>
          <div className="min-w-0">
            <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>Confirm action</p>
            <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
            <p className={`mt-3 text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/50"}`}>{message}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={`flex-1 rounded-full px-4 py-3 transition disabled:opacity-60 ${darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/[0.04] text-black hover:bg-black/[0.07]"}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-full bg-red-500 px-4 py-3 text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentIcon({ doc, darkMode, className = "w-4 h-4" }) {
  const name = doc?.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  const base = darkMode ? "text-white/55" : "text-black/45";

  if (doc?.type === "sheet" || ["csv", "xls", "xlsx"].includes(ext)) {
    return <Sheet className={`${className} ${darkMode ? "text-[#d8f36a]" : "text-green-600"}`} />;
  }
  if (ext === "pdf") return <FileText className={`${className} text-red-500`} />;
  if (["doc", "docx"].includes(ext)) return <FileType className={`${className} text-blue-500`} />;
  if (["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(ext)) {
    return <ImageIcon className={`${className} text-fuchsia-500`} />;
  }
  if (["zip", "rar", "7z"].includes(ext)) return <FileArchive className={`${className} text-amber-500`} />;
  if (["txt", "md", "rtf"].includes(ext)) return <FileText className={`${className} ${base}`} />;
  return <File className={`${className} ${base}`} />;
}
