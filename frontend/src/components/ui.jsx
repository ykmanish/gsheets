"use client";

// UIPL's UI kit, after the Chax reference: pill buttons and fields, soft grey fills, pastel
// icon tiles (mint, lavender, peach, sky, rose, lime), black for "selected" and primary, and
// two-line headings (black, then grey). Popovers have a search row, rows with icons and a
// check on the chosen one; calendars and time lists match. No dependencies beyond React and lucide icons, and every popover
// renders into <body> so a scrolling page or a drawer never clips it.

import { Children, createElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  File,
  FileArchive,
  FileText,
  FileType,
  Image as ImageIcon,
  Info,
  Moon,
  Search,
  Sheet,
  Sun,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

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

/* ───────── Popover plumbing ───────── */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Fixed position under (or above, when there is no room) an anchor, kept in place while
// anything scrolls. `width: "anchor"` matches the anchor's width.
function usePopoverPosition(open, anchorRef, { width = "anchor", height = 320, align = "start" } = {}) {
  const [style, setStyle] = useState(null);
  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const w = Math.min(width === "anchor" ? Math.max(rect.width, 200) : width, viewportWidth - margin * 2);
    const below = viewportHeight - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const opensBelow = below >= Math.min(height, 220) || below >= above;
    const maxHeight = Math.max(180, Math.min(height, opensBelow ? below : above));
    const preferredLeft = align === "end" ? rect.right - w : rect.left;
    const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - w - margin));
    setStyle({
      position: "fixed",
      left,
      width: w,
      maxHeight,
      ...(opensBelow ? { top: rect.bottom + gap } : { bottom: viewportHeight - rect.top + gap }),
      transformOrigin: opensBelow ? "top center" : "bottom center",
    });
  }, [anchorRef, width, height, align]);

  useIsoLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);
  return style;
}

// The floating surface itself. Closes on outside pointer-down (anchor excluded) and Escape.
export function Popover({ open, onClose, anchorRef, darkMode, width = "anchor", height = 320, align = "start", className = "", children, role = "dialog", labelledBy }) {
  const panelRef = useRef(null);
  const style = usePopoverPosition(open, anchorRef, { width, height, align });

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (panelRef.current?.contains(event.target)) return;
      if (anchorRef.current?.contains(event.target)) return;
      onClose?.();
    }
    function handleKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        anchorRef.current?.querySelector?.("button")?.focus?.();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !style || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-labelledby={labelledBy}
      style={{ ...style, boxShadow: "var(--ui-shadow-pop)" }}
      className={cx(
        "ui-pop z-[400] flex flex-col overflow-hidden rounded-[18px] border text-[13px] newq",
        darkMode ? "border-white/10 bg-[#17181c] text-white" : "border-[#ececec] bg-white text-[#141414]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ───────── Shared styling ───────── */

const SIZES = { sm: "h-8 text-[12.5px] px-3 rounded-full", md: "h-10 text-[13.5px] px-4 rounded-full", lg: "h-12 text-sm px-5 rounded-full" };

export function fieldClass(darkMode, { open = false, size = "md", invalid = false } = {}) {
  return cx(
    "flex w-full min-w-0 items-center gap-2 border text-left outline-none transition-[background-color,border-color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-55",
    SIZES[size] || SIZES.md,
    darkMode
      ? "border-transparent bg-white/[0.06] text-white hover:bg-white/[0.09] focus-visible:ring-[3px] focus-visible:ring-white/10"
      : "border-transparent bg-[#f4f4f2] text-[#141414] hover:bg-[#efefec] focus-visible:bg-white focus-visible:border-[#e2e2df] focus-visible:ring-[3px] focus-visible:ring-black/[0.05]",
    open && (darkMode ? "ring-[3px] ring-white/10 bg-white/[0.09]" : "bg-white border-[#e2e2df] ring-[3px] ring-black/[0.05]"),
    invalid && "border-red-400",
  );
}

const optionRowClass = (darkMode, { active, highlighted, disabled }) => cx(
  "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[13px] transition-colors",
  disabled && "cursor-not-allowed opacity-45",
  active
    ? darkMode ? "bg-white/[0.08] text-white" : "bg-[#f4f4f2] text-[#141414]"
    : highlighted
    ? darkMode ? "bg-white/[0.05] text-white" : "bg-[#f6f6f4] text-[#171717]"
    : darkMode ? "text-white/80" : "text-[#3d3d3b]",
);

function SearchRow({ darkMode, value, onChange, placeholder, onKeyDown }) {
  return (
    <div className={cx("flex items-center gap-2 border-b px-3", darkMode ? "border-white/10" : "border-[#efefed]")}>
      <Search className={cx("h-3.5 w-3.5 shrink-0", darkMode ? "text-white/40" : "text-[#a3a3a0]")} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus
        className={cx("h-10 w-full bg-transparent text-[13px] outline-none", darkMode ? "text-white placeholder:text-white/35" : "text-[#171717] placeholder:text-[#a3a3a0]")}
      />
    </div>
  );
}

/* ───────── Select ───────── */

/**
 * options: [{ value, label, icon?: LucideIcon | ReactNode, description?, disabled?, group?, color? }]
 * `color` tints that option's label; `triggerStyle` (inline) tints the closed field, e.g. by status.
 * A change of `group` between neighbours draws a divider, as in the reference menu.
 */
export function SelectMenu({
  darkMode,
  value,
  options = [],
  onChange,
  disabled = false,
  placeholder = "Select an option",
  className = "",
  searchable = false,
  searchPlaceholder = "Search...",
  size = "md",
  icon: LeadingIcon = null,
  menuWidth = "anchor",
  label,
  renderTrigger,
  ariaLabel,
  groupLabels = false,
  triggerStyle,
}) {
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const labelId = useId();
  const showSearch = searchable || options.length > 9;
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => `${option.label} ${option.description || ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  }, []);

  function choose(option) {
    if (!option || option.disabled) return;
    onChange?.(option.value);
    close();
  }

  function onKeyDown(event) {
    if (!open && ["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setHighlight(Math.max(0, visible.findIndex((option) => option.value === value)));
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => {
        let next = current;
        for (let i = 0; i < visible.length; i += 1) {
          next = (next + step + visible.length) % visible.length;
          if (!visible[next]?.disabled) break;
        }
        listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    }
    if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      choose(visible[highlight]);
    }
    if (event.key === "Tab") close();
  }

  // An icon may be a component (lucide) or an element someone already rendered.
  const renderIcon = (Icon, cls) => (!Icon ? null : isValidElement(Icon) ? Icon : createElement(Icon, { className: cls }));

  return (
    <div ref={anchorRef} className={cx("relative min-w-0", className)}>
      {label && <span id={labelId} className={cx("mb-1.5 block text-xs", darkMode ? "text-white/60" : "text-[#8a8a8a]")}>{label}</span>}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
        className={renderTrigger ? "w-full text-left" : fieldClass(darkMode, { open, size })}
        style={renderTrigger ? undefined : triggerStyle}
      >
        {renderTrigger ? renderTrigger({ open, selected }) : (<>
        {LeadingIcon && renderIcon(LeadingIcon, cx("h-4 w-4 shrink-0", darkMode ? "text-white/50" : "text-[#8a8a87]"))}
        {selected?.icon && !LeadingIcon && renderIcon(selected.icon, cx("h-4 w-4 shrink-0", darkMode ? "text-white/60" : "text-[#5f5f5c]"))}
        <span className={cx("min-w-0 flex-1 truncate", !selected && (darkMode ? "text-white/40" : "text-[#a3a3a0]"))}>{selected?.label || placeholder}</span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180", darkMode ? "text-white/45" : "text-[#8a8a87]")} />
        </>)}
      </button>

      <Popover open={open && !disabled} onClose={close} anchorRef={anchorRef} darkMode={darkMode} width={menuWidth} height={340} role="listbox">
        {showSearch && <SearchRow darkMode={darkMode} value={query} onChange={(next) => { setQuery(next); setHighlight(0); }} placeholder={searchPlaceholder} onKeyDown={onKeyDown} />}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.map((option, index) => {
            const active = option.value === value;
            const newGroup = option.group && (index === 0 || option.group !== visible[index - 1].group);
            return (
              <div key={`${option.value}`}>
                {newGroup && groupLabels && option.group.trim() && <p className={cx("px-2.5 pb-1 pt-2 text-[11px]", darkMode ? "text-white/40" : "text-[#8a8a87]")}>{option.group}</p>}
                {newGroup && index > 0 && (!groupLabels || !option.group.trim()) && <div className={cx("my-1.5 h-px", darkMode ? "bg-white/10" : "bg-[#efefed]")} />}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={index}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(option)}
                  className={optionRowClass(darkMode, { active, highlighted: highlight === index, disabled: option.disabled })}
                  style={option.color ? { color: option.color } : undefined}
                >
                  {option.icon && renderIcon(option.icon, cx("h-4 w-4 shrink-0", darkMode ? "text-white/60" : "text-[#5f5f5c]"))}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && <span className={cx("block truncate text-[11.5px]", darkMode ? "text-white/45" : "text-[#8a8a87]")}>{option.description}</span>}
                  </span>
                  {option.badge && <span className={cx("shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10.5px]", darkMode ? "bg-white/10 text-white/60" : "bg-[#f1f1ef] text-[#6f6f6c]")}>{option.badge}</span>}
                  {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </div>
            );
          })}
          {!visible.length && <p className={cx("px-3 py-5 text-center text-xs", darkMode ? "text-white/45" : "text-[#8a8a87]")}>No matches</p>}
        </div>
      </Popover>
    </div>
  );
}

/* ───────── Multi-select ───────── */

// values: array of option values. The trigger shows the first picks as chips and "+N".
export function MultiSelect({ darkMode, values = [], onChange, options = [], placeholder = "Select", emptyLabel, clearLabel = "Clear", searchable = true, searchPlaceholder = "Search...", size = "md", className = "", menuWidth = "anchor", onToggle, groupLabels = true }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);
  const chosen = new Set(values.map((value) => String(value)));
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => `${option.label} ${option.description || ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const picked = options.filter((option) => chosen.has(String(option.value)));

  function toggle(option) {
    const was = chosen.has(String(option.value));
    const next = was ? values.filter((value) => String(value) !== String(option.value)) : [...values, option.value];
    onChange?.(next);
    onToggle?.(option.value, next, was);
  }

  return (
    <div ref={anchorRef} className={cx("relative min-w-0", className)}>
      <button type="button" onClick={() => (open ? close() : setOpen(true))} aria-haspopup="listbox" aria-expanded={open} className={cx(fieldClass(darkMode, { open, size }), "h-auto py-1.5", size === "lg" ? "min-h-12" : size === "sm" ? "min-h-8" : "min-h-10")}>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {picked.length === 0 && <span className={cx("truncate", darkMode ? "text-white/40" : "text-[#a3a3a0]")}>{emptyLabel || placeholder}</span>}
          {picked.slice(0, 2).map((option) => (
            <span key={option.value} className={cx("inline-flex max-w-[140px] items-center rounded-full px-2 py-0.5 text-[12px]", darkMode ? "bg-white/10" : "bg-[#f1f1ef]")}>
              <span className="truncate">{option.label}</span>
            </span>
          ))}
          {picked.length > 2 && <span className={cx("text-[12px]", darkMode ? "text-white/55" : "text-[#6f6f6c]")}>+{picked.length - 2}</span>}
        </span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 transition-transform", open && "rotate-180", darkMode ? "text-white/45" : "text-[#8a8a87]")} />
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} darkMode={darkMode} width={menuWidth} height={360} role="listbox">
        {searchable && <SearchRow darkMode={darkMode} value={query} onChange={setQuery} placeholder={searchPlaceholder} />}
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.map((option, index) => {
            const checked = chosen.has(String(option.value));
            const newGroup = option.group && (index === 0 || option.group !== visible[index - 1].group);
            return (
              <div key={option.value}>
                {newGroup && groupLabels && <p className={cx("px-2.5 pb-1 pt-2 text-[11px]", darkMode ? "text-white/40" : "text-[#8a8a87]")}>{option.group}</p>}
                <button type="button" role="option" aria-selected={checked} onClick={() => toggle(option)} className={optionRowClass(darkMode, { highlighted: false })}>
                  <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors", checked ? (darkMode ? "border-white bg-white text-black" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/25" : "border-[#cfcfcb] bg-white")}>
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && <span className={cx("block truncate text-[11.5px]", darkMode ? "text-white/45" : "text-[#8a8a87]")}>{option.description}</span>}
                  </span>
                  {option.badge && <span className={cx("shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10.5px]", darkMode ? "bg-white/10 text-white/60" : "bg-[#f1f1ef] text-[#6f6f6c]")}>{option.badge}</span>}
                </button>
              </div>
            );
          })}
          {!visible.length && <p className={cx("px-3 py-5 text-center text-xs", darkMode ? "text-white/45" : "text-[#8a8a87]")}>No matches</p>}
        </div>
        <div className={cx("flex items-center justify-between border-t px-2 py-1.5", darkMode ? "border-white/10" : "border-[#efefed]")}>
          <FooterButton darkMode={darkMode} onClick={() => onChange?.([])}>{clearLabel}</FooterButton>
          <span className={cx("text-[11.5px]", darkMode ? "text-white/45" : "text-[#8a8a87]")}>{values.length} selected</span>
          <FooterButton darkMode={darkMode} strong onClick={close}>Done</FooterButton>
        </div>
      </Popover>
    </div>
  );
}

/* ───────── Dates ───────── */

export function toDateInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromDateInputValue(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value, fallback = "Select date") {
  const date = fromDateInputValue(value);
  return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : fallback;
}

const sameDay = (a, b) => Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function monthGrid(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// One month of days. `isSelected`, `inRange` and `isDisabled` decide each cell's look.
export function Calendar({ darkMode, monthDate, onMonthChange, onSelect, isSelected, inRange, isDisabled, isEdge, onHoverDay }) {
  const today = new Date();
  const days = useMemo(() => monthGrid(monthDate), [monthDate]);
  const navButton = cx("grid h-7 w-7 place-items-center rounded-full transition-colors", darkMode ? "text-white/70 hover:bg-white/10" : "text-[#5f5f5c] hover:bg-[#f1f1ef]");
  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-1 pb-2">
        <button type="button" aria-label="Previous month" onClick={() => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} className={navButton}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px]">{monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <button type="button" aria-label="Next month" onClick={() => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} className={navButton}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className={cx("grid grid-cols-7 pb-1 text-center text-[11px]", darkMode ? "text-white/40" : "text-[#a3a3a0]")}>
        {WEEKDAYS.map((label) => <span key={label} className="py-1">{label}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const outside = day.getMonth() !== monthDate.getMonth();
          const selected = isSelected?.(day);
          const ranged = inRange?.(day);
          const disabled = isDisabled?.(day);
          const edge = isEdge?.(day);
          return (
            <div key={day.toISOString()} className={cx("flex justify-center", ranged && (darkMode ? "bg-white/[0.06]" : "bg-[#f3f3f1]"), edge === "start" && "rounded-l-full", edge === "end" && "rounded-r-full")}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(day)}
                onMouseEnter={() => onHoverDay?.(day)}
                aria-pressed={selected}
                className={cx(
                  "relative h-8 w-8 rounded-full text-[12.5px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                  selected
                    ? darkMode ? "bg-white text-black" : "bg-[#141414] text-white"
                    : outside
                    ? darkMode ? "text-white/25 hover:bg-white/[0.06]" : "text-[#c4c4c1] hover:bg-[#f3f3f1]"
                    : darkMode ? "text-white/85 hover:bg-white/[0.08]" : "text-[#2b2b29] hover:bg-[#f1f1ef]",
                )}
              >
                {day.getDate()}
                {sameDay(day, today) && !selected && <span className={cx("absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full", darkMode ? "bg-white/70" : "bg-[#171717]")} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FooterButton({ darkMode, onClick, children, strong = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "h-8 rounded-full px-3.5 text-[12.5px] transition-colors",
        strong
          ? darkMode ? "bg-white text-black hover:bg-white/90" : "bg-[#171717] text-white hover:bg-black"
          : darkMode ? "text-white/70 hover:bg-white/10" : "text-[#5f5f5c] hover:bg-[#f1f1ef]",
      )}
    >
      {children}
    </button>
  );
}

export function DatePicker({ darkMode, value, onChange, placeholder = "Choose date", disabled = false, minDate, maxDate, size = "md", className = "", label, clearable = false }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = fromDateInputValue(value);
  const [monthDate, setMonthDate] = useState(() => selected || new Date());
  const min = minDate ? fromDateInputValue(minDate) : null;
  const max = maxDate ? fromDateInputValue(maxDate) : null;
  const close = useCallback(() => setOpen(false), []);

  function select(day) {
    onChange?.(toDateInputValue(day));
    setMonthDate(day);
    setOpen(false);
  }

  return (
    <div ref={anchorRef} className={cx("relative min-w-0", className)}>
      {label && <span className={cx("mb-1.5 block text-xs", darkMode ? "text-white/60" : "text-[#8a8a8a]")}>{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open && selected) setMonthDate(selected);
          setOpen((current) => !current);
        }}
        className={cx(fieldClass(darkMode, { open, size }), "min-w-[150px]")}
      >
        <CalendarDays className={cx("h-4 w-4 shrink-0", darkMode ? "text-white/50" : "text-[#8a8a87]")} />
        <span className={cx("min-w-0 flex-1 truncate", !value && (darkMode ? "text-white/40" : "text-[#a3a3a0]"))}>{value ? formatDisplayDate(value) : placeholder}</span>
        {clearable && value && !disabled && (
          <span role="button" tabIndex={-1} aria-label="Clear date" onClick={(event) => { event.stopPropagation(); onChange?.(""); }} className={cx("grid h-5 w-5 place-items-center rounded-full", darkMode ? "hover:bg-white/10" : "hover:bg-black/5")}>
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
      <Popover open={open && !disabled} onClose={close} anchorRef={anchorRef} darkMode={darkMode} width={286} height={360}>
        <div className="p-3">
          <Calendar
            darkMode={darkMode}
            monthDate={monthDate}
            onMonthChange={setMonthDate}
            onSelect={select}
            isSelected={(day) => sameDay(day, selected)}
            isDisabled={(day) => Boolean((min && day < min) || (max && day > max))}
          />
        </div>
        <div className={cx("flex items-center justify-between border-t px-2 py-1.5", darkMode ? "border-white/10" : "border-[#efefed]")}>
          <FooterButton darkMode={darkMode} onClick={() => { onChange?.(""); setOpen(false); }}>Clear</FooterButton>
          <FooterButton darkMode={darkMode} onClick={() => select(startOfDay(new Date()))}>Today</FooterButton>
        </div>
      </Popover>
    </div>
  );
}

const QUICK_RANGES = [
  { label: "Today", range: () => [new Date(), new Date()] },
  { label: "Yesterday", range: () => { const d = new Date(); d.setDate(d.getDate() - 1); return [d, d]; } },
  { label: "Last 7 days", range: () => { const d = new Date(); d.setDate(d.getDate() - 6); return [d, new Date()]; } },
  { label: "This week", range: () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [d, new Date()]; } },
  { label: "Last 30 days", range: () => { const d = new Date(); d.setDate(d.getDate() - 29); return [d, new Date()]; } },
  { label: "This month", range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
  { label: "Last month", range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)]; } },
];

export function DateRangePicker({ darkMode, from, to, onChange, placeholder = "Choose dates", className = "md:col-span-2", size = "md", disabled = false, minDate, maxDate }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const fromDate = fromDateInputValue(from);
  const toDate = fromDateInputValue(to);
  const [monthDate, setMonthDate] = useState(() => fromDate || new Date());
  const [picking, setPicking] = useState("from");
  const [hovered, setHovered] = useState(null);
  const min = minDate ? fromDateInputValue(minDate) : null;
  const max = maxDate ? fromDateInputValue(maxDate) : null;
  const close = useCallback(() => setOpen(false), []);

  function setRange(start, end) {
    onChange?.({ from: toDateInputValue(start), to: toDateInputValue(end) });
  }

  function select(day) {
    if (picking === "from" || !fromDate || day < fromDate) {
      setRange(day, null);
      setPicking("to");
      return;
    }
    setRange(fromDate, day);
    setPicking("from");
    setOpen(false);
  }

  const previewEnd = picking === "to" && fromDate && hovered && hovered >= fromDate ? hovered : toDate;
  const label = from || to ? `${formatDisplayDate(from, "Start")} – ${formatDisplayDate(to, "End")}` : placeholder;

  return (
    <div ref={anchorRef} className={cx("relative min-w-0", className)}>
      <button type="button" disabled={disabled} onClick={() => { setPicking("from"); setOpen((current) => !current); }} className={fieldClass(darkMode, { open, size })}>
        <CalendarDays className={cx("h-4 w-4 shrink-0", darkMode ? "text-white/50" : "text-[#8a8a87]")} />
        <span className={cx("min-w-0 flex-1 truncate", !(from || to) && (darkMode ? "text-white/40" : "text-[#a3a3a0]"))}>{label}</span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 transition-transform", open && "rotate-180", darkMode ? "text-white/45" : "text-[#8a8a87]")} />
      </button>
      <Popover open={open && !disabled} onClose={close} anchorRef={anchorRef} darkMode={darkMode} width={468} height={380}>
        <div className="flex min-h-0">
          <div className={cx("hidden w-[140px] shrink-0 flex-col gap-0.5 border-r p-1.5 sm:flex", darkMode ? "border-white/10" : "border-[#efefed]")}>
            {QUICK_RANGES.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => {
                  const [start, end] = quick.range();
                  setRange(start, end);
                  setMonthDate(start);
                  setPicking("from");
                  setOpen(false);
                }}
                className={optionRowClass(darkMode, {})}
              >
                {quick.label}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-3" onMouseLeave={() => setHovered(null)}>
            <div className={cx("mb-3 grid grid-cols-2 gap-1.5 rounded-[14px] p-1 text-[12px]", darkMode ? "bg-white/[0.05]" : "bg-[#f3f3f1]")}>
              {[["from", "Start", from], ["to", "End", to]].map(([key, name, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicking(key)}
                  className={cx("rounded-[11px] px-2.5 py-1.5 text-left transition", picking === key ? (darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]") : darkMode ? "text-white/55" : "text-[#8a8a87]")}
                >
                  <span className="block text-[10.5px] opacity-70">{name}</span>
                  <span className="block truncate">{formatDisplayDate(val, "—")}</span>
                </button>
              ))}
            </div>
            <div>
              <Calendar
                onHoverDay={setHovered}
                darkMode={darkMode}
                monthDate={monthDate}
                onMonthChange={setMonthDate}
                onSelect={select}
                isSelected={(day) => sameDay(day, fromDate) || sameDay(day, toDate)}
                inRange={(day) => Boolean(fromDate && previewEnd && day >= fromDate && day <= previewEnd)}
                isEdge={(day) => (sameDay(day, fromDate) ? "start" : sameDay(day, previewEnd) ? "end" : null)}
                isDisabled={(day) => Boolean((min && day < min) || (max && day > max))}
              />
            </div>
          </div>
        </div>
        <div className={cx("flex items-center justify-between border-t px-2 py-1.5", darkMode ? "border-white/10" : "border-[#efefed]")}>
          <FooterButton darkMode={darkMode} onClick={() => { onChange?.({ from: "", to: "" }); setPicking("from"); }}>Clear</FooterButton>
          <FooterButton darkMode={darkMode} strong onClick={close}>Done</FooterButton>
        </div>
      </Popover>
    </div>
  );
}

/* ───────── Time ───────── */

function parseTime(value = "") {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value));
  return match ? { h: Number(match[1]), m: Number(match[2]) } : null;
}
export function formatTime12(value) {
  const t = parseTime(value);
  if (!t) return "";
  return `${((t.h + 11) % 12) + 1}:${String(t.m).padStart(2, "0")} ${t.h < 12 ? "AM" : "PM"}`;
}
const toHHMM = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

// value and onChange use "HH:MM" (24-hour), like <input type="time">.
export function TimePicker({ darkMode, value, onChange, placeholder = "Select time", disabled = false, step = 15, minTime, maxTime, size = "md", className = "", label, clearable = false }) {
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);
  const options = useMemo(() => {
    const list = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += step) list.push(toHHMM(Math.floor(minutes / 60), minutes % 60));
    if (value && parseTime(value) && !list.includes(value.slice(0, 5))) list.push(value.slice(0, 5));
    return list.sort().filter((t) => (!minTime || t >= minTime) && (!maxTime || t <= maxTime));
  }, [step, value, minTime, maxTime]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return options;
    return options.filter((t) => formatTime12(t).toLowerCase().replace(/\s+/g, "").includes(q) || t.includes(q));
  }, [options, query]);

  // Typing an exact time ("9:05 pm", "21:05") offers it even off the step grid.
  const typed = useMemo(() => {
    const match = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i.exec(query.trim());
    if (!match) return null;
    let h = Number(match[1]);
    const m = Number(match[2] || 0);
    if (match[3]) h = (h % 12) + (/pm/i.test(match[3]) ? 12 : 0);
    return h < 24 && m < 60 ? toHHMM(h, m) : null;
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.requestAnimationFrame(() => {
      const target = listRef.current?.querySelector('[aria-selected="true"]') || listRef.current?.querySelector('[data-time="09:00"]');
      target?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  function choose(t) {
    onChange?.(t);
    close();
  }

  return (
    <div ref={anchorRef} className={cx("relative min-w-0", className)}>
      {label && <span className={cx("mb-1.5 block text-xs", darkMode ? "text-white/60" : "text-[#8a8a8a]")}>{label}</span>}
      <button type="button" disabled={disabled} onClick={() => (open ? close() : setOpen(true))} className={fieldClass(darkMode, { open, size })}>
        <Clock3 className={cx("h-4 w-4 shrink-0", darkMode ? "text-white/50" : "text-[#8a8a87]")} />
        <span className={cx("min-w-0 flex-1 truncate tabular-nums", !value && (darkMode ? "text-white/40" : "text-[#a3a3a0]"))}>{value ? formatTime12(value) : placeholder}</span>
        {clearable && value && !disabled ? (
          <span role="button" tabIndex={-1} aria-label="Clear time" onClick={(event) => { event.stopPropagation(); onChange?.(""); }} className={cx("grid h-5 w-5 place-items-center rounded-full", darkMode ? "hover:bg-white/10" : "hover:bg-black/5")}>
            <X className="h-3 w-3" />
          </span>
        ) : <ChevronDown className={cx("h-4 w-4 shrink-0 transition-transform", open && "rotate-180", darkMode ? "text-white/45" : "text-[#8a8a87]")} />}
      </button>
      <Popover open={open && !disabled} onClose={close} anchorRef={anchorRef} darkMode={darkMode} width={200} height={300}>
        <SearchRow
          darkMode={darkMode}
          value={query}
          onChange={setQuery}
          placeholder="Type a time, e.g. 9:30 pm"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (typed) choose(typed);
              else if (visible[0]) choose(visible[0]);
            }
          }}
        />
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {typed && !visible.includes(typed) && (
            <button type="button" onClick={() => choose(typed)} className={optionRowClass(darkMode, { highlighted: true })}>
              <Clock3 className="h-3.5 w-3.5 shrink-0" /> Use {formatTime12(typed)}
            </button>
          )}
          {visible.map((t) => {
            const active = value?.slice(0, 5) === t;
            return (
              <button key={t} type="button" role="option" data-time={t} aria-selected={active} onClick={() => choose(t)} className={cx(optionRowClass(darkMode, { active }), "tabular-nums")}>
                <span className="flex-1">{formatTime12(t)}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
          {!visible.length && !typed && <p className={cx("px-3 py-5 text-center text-xs", darkMode ? "text-white/45" : "text-[#8a8a87]")}>No matching time</p>}
        </div>
      </Popover>
    </div>
  );
}

function fromDateTimeInputValue(value) {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = String(value).split("T");
  const date = fromDateInputValue(datePart);
  const time = parseTime(timePart) || { h: 0, m: 0 };
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.h, time.m) : null;
}

// value and onChange use "YYYY-MM-DDTHH:MM", like <input type="datetime-local">.
export function DateTimePicker({ darkMode, value, onChange, placeholder = "Choose date", disabled = false, minDate }) {
  const current = fromDateTimeInputValue(value);
  const datePart = current ? toDateInputValue(current) : "";
  const timePart = current ? toHHMM(current.getHours(), current.getMinutes()) : "";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-2">
      <DatePicker darkMode={darkMode} value={datePart} placeholder={placeholder} disabled={disabled} minDate={minDate} onChange={(next) => onChange?.(next ? `${next}T${timePart || "18:00"}` : "")} />
      <TimePicker darkMode={darkMode} value={timePart} placeholder="Time" disabled={disabled || !datePart} step={30} onChange={(next) => onChange?.(datePart ? `${datePart}T${next || "00:00"}` : "")} />
    </div>
  );
}

/* ───────── Drop-in replacements for native inputs ─────────
   Same props as <select>, <input type="date"> and <input type="time"> (onChange receives an
   event-like { target: { value } }), so old call sites only change the tag. */

const textOf = (node) => Children.toArray(node).map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : isValidElement(part) ? textOf(part.props.children) : "")).join("");

function optionsFromChildren(children, group) {
  const out = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const text = textOf(child.props.children);
      out.push({ value: child.props.value ?? text, label: text, disabled: Boolean(child.props.disabled), group });
    } else if (child.type === "optgroup") {
      out.push(...optionsFromChildren(child.props.children, child.props.label));
    }
  });
  return out;
}

// Margins and widths from an old input's className still apply to the new control's wrapper.
const layoutClasses = (className = "") => String(className).split(/\s+/).filter((token) => /^(?:[a-z]+:)?(?:m[trblxy]?-|w-|max-w-|min-w-|flex-|col-span|self-|justify-self-|order-)/.test(token)).join(" ");
const fakeEvent = (value, name) => ({ target: { value, name }, currentTarget: { value, name } });

export function Select({ value, onChange, children, darkMode, disabled, placeholder, name, className = "", size = "md", searchable, "aria-label": ariaLabel }) {
  const options = optionsFromChildren(children);
  return (
    <SelectMenu
      darkMode={darkMode}
      value={value ?? ""}
      options={options}
      onChange={(next) => onChange?.(fakeEvent(next, name))}
      disabled={disabled}
      placeholder={placeholder || "Select"}
      className={layoutClasses(className)}
      size={size}
      searchable={searchable}
      ariaLabel={ariaLabel}
    />
  );
}

export function DateInput({ value, onChange, darkMode, disabled, min, max, name, className = "", placeholder = "Choose date", size = "md" }) {
  return <DatePicker darkMode={darkMode} value={value || ""} disabled={disabled} minDate={min} maxDate={max} placeholder={placeholder} size={size} className={layoutClasses(className)} onChange={(next) => onChange?.(fakeEvent(next, name))} />;
}

export function TimeInput({ value, onChange, darkMode, disabled, name, className = "", placeholder = "Select time", step = 15, size = "md", "aria-label": ariaLabel }) {
  return (
    <div className={layoutClasses(className)} aria-label={ariaLabel}>
      <TimePicker darkMode={darkMode} value={value || ""} disabled={disabled} placeholder={placeholder} step={step} size={size} onChange={(next) => onChange?.(fakeEvent(next, name))} />
    </div>
  );
}

/* ───────── Small pieces ───────── */

export function ThemeSwitch({ darkMode, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cx("grid h-9 w-9 place-items-center rounded-full transition-colors", darkMode ? "bg-white/[0.06] text-white/80 hover:bg-white/10" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]")}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={darkMode ? "Light mode" : "Dark mode"}
    >
      {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Toggle({ checked, onChange, label, disabled = false, darkMode, size = "md" }) {
  const small = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cx(
        "relative shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        small ? "h-5 w-9" : "h-6 w-11",
        checked ? (darkMode ? "bg-[#c9ee6a]" : "bg-[#141414]") : darkMode ? "bg-white/20" : "bg-[#dcdcd8]",
      )}
    >
      <span className={cx("absolute top-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200", small ? "left-0.5 h-4 w-4" : "left-0.5 h-5 w-5", checked && (small ? "translate-x-4" : "translate-x-5"))} />
    </button>
  );
}

// Segmented tabs: [{ id, label, icon? }]
export function Tabs({ darkMode, items = [], value, onChange, className = "" }) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-full p-1", darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]", className)}>
      {items.map(({ id, label, icon: Icon, count }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(id)}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition",
              active ? (darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#141414] shadow-[0_1px_4px_rgba(0,0,0,0.08)]") : darkMode ? "text-white/55 hover:text-white" : "text-[#8a8a8a] hover:text-[#141414]",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
            {count != null && <span className={cx("rounded-full px-1.5 text-[11px]", darkMode ? "bg-white/10" : active ? "bg-[#f4f4f2]" : "bg-[#e9e9e6]")}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: (dm) => (dm ? "bg-white text-black hover:bg-white/90" : "bg-[#141414] text-white hover:bg-black"),
  accent: () => "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]",
  secondary: (dm) => (dm ? "border border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"),
  soft: (dm) => (dm ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"),
  ghost: (dm) => (dm ? "text-white/75 hover:bg-white/10" : "text-[#3d3d3b] hover:bg-[#f4f4f2]"),
  danger: () => "bg-[#e5484d] text-white hover:bg-[#d93f44]",
};

export function Button({ variant = "secondary", size = "md", darkMode, icon: Icon, iconRight: IconRight, className = "", children, loading = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full transition-[background-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-8 px-3.5 text-[12.5px]" : size === "lg" ? "h-11 px-6 text-sm" : "h-9 px-4 text-[13px]",
        (BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary)(darkMode),
        className,
      )}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
      {IconRight && <IconRight className="h-4 w-4" />}
    </button>
  );
}

// Pastel tones shared by chips, icon tiles and stat tiles: [light bg, light fg, dark bg, dark fg].
export const TONES = {
  neutral: ["#f4f4f2", "#3d3d3b", "rgba(255,255,255,0.07)", "rgba(255,255,255,0.78)"],
  mint: ["#e4f1e6", "#2f7a4f", "rgba(74,222,128,0.12)", "#a7e8bf"],
  lavender: ["#ece8fb", "#6b4fd1", "rgba(167,139,250,0.14)", "#c9b9fb"],
  peach: ["#fbe5dc", "#c2562b", "rgba(251,146,60,0.13)", "#f9bf9b"],
  sky: ["#e3eefb", "#2f6fc0", "rgba(96,165,250,0.13)", "#a9cbf7"],
  rose: ["#fbe4e6", "#c0394b", "rgba(251,113,133,0.13)", "#f7aab5"],
  lime: ["#eef8cc", "#4d6b12", "rgba(207,240,122,0.14)", "#d8f39a"],
  amber: ["#fbf0d4", "#8a6200", "rgba(251,191,36,0.13)", "#f5d27a"],
};
const TONE_ALIASES = { green: "mint", violet: "lavender", purple: "lavender", blue: "sky", red: "rose", yellow: "amber", orange: "peach" };
export const toneOf = (tone) => TONES[TONE_ALIASES[tone] || tone] || TONES.neutral;
const toneStyle = (tone, dm) => { const t = toneOf(tone); return { backgroundColor: dm ? t[2] : t[0], color: dm ? t[3] : t[1] }; };

const CHIP_TONES = {
  outline: (dm) => (dm ? "border border-white/12 text-white/75" : "border border-[#e6e6e3] bg-white text-[#3d3d3b]"),
};

export function Chip({ tone = "neutral", darkMode, icon: Icon, children, className = "", onRemove }) {
  return (
    <span style={tone === "outline" ? undefined : toneStyle(tone, darkMode)} className={cx("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px]", tone === "outline" && CHIP_TONES.outline(darkMode), className)}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="-mr-1 grid h-5 w-5 place-items-center rounded-full opacity-60 hover:opacity-100">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function Card({ darkMode, title, subtitle, icon: Icon, tone = "neutral", actions, className = "", bodyClassName = "", children }) {
  return (
    <section className={cx("rounded-[20px] border", darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h3 className="flex min-w-0 items-center gap-2.5 text-[15px]">
            {Icon && <IconTile icon={Icon} tone={tone} darkMode={darkMode} size="sm" />}
            <span className="min-w-0"><span className="block truncate">{title}</span>{subtitle && <span className={cx("block truncate text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{subtitle}</span>}</span>
          </h3>
          {actions}
        </header>
      )}
      <div className={cx("p-5", title && "pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

// Label / value rows on a soft panel, like the reference's detail cards.
export function InfoRows({ darkMode, rows = [], className = "" }) {
  return (
    <dl className={cx("grid grid-cols-[minmax(0,110px)_1fr] gap-x-4 gap-y-2.5 rounded-[16px] p-4 text-[13px]", darkMode ? "bg-white/[0.04]" : "bg-[#f4f4f2]", className)}>
      {rows.filter(Boolean).map(([label, value, Icon]) => (
        <div key={label} className="contents">
          <dt className={cx("flex items-center gap-2", darkMode ? "text-white/50" : "text-[#7a7a77]")}>{Icon && <Icon className="h-3.5 w-3.5" />}{label}</dt>
          <dd className="min-w-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const NOTICE_TONES = {
  amber: { box: (dm) => (dm ? "bg-amber-400/[0.08] text-amber-100" : "bg-[#fbf3dc] text-[#4a3a1c]"), icon: "text-[#b07d00]" },
  blue: { box: (dm) => (dm ? "bg-blue-400/[0.08] text-blue-100" : "bg-[#e9f1fb] text-[#1f3463]"), icon: "text-[#2f6fc0]" },
  red: { box: (dm) => (dm ? "bg-red-400/[0.08] text-red-100" : "bg-[#fcebed] text-[#5c1f1c]"), icon: "text-[#c0394b]" },
  green: { box: (dm) => (dm ? "bg-emerald-400/[0.08] text-emerald-100" : "bg-[#e9f4eb] text-[#16432c]"), icon: "text-[#2f7a4f]" },
  neutral: { box: (dm) => (dm ? "bg-white/[0.05] text-white/80" : "bg-[#f4f4f2] text-[#3d3d3b]"), icon: "text-[#6b6b6b]" },
};

export function Notice({ tone = "amber", darkMode, icon: Icon = Info, children, className = "" }) {
  const t = NOTICE_TONES[tone] || NOTICE_TONES.amber;
  return (
    <div className={cx("flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[13px] leading-5", t.box(darkMode), className)}>
      <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", t.icon)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Activity timeline: [{ id, icon?, tone?, title, time, children }]
export function Timeline({ darkMode, items = [] }) {
  return (
    <ol className="relative">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <li key={item.id || index} className="relative grid grid-cols-[22px_1fr] gap-3 pb-6 last:pb-0">
            {index < items.length - 1 && <span className={cx("absolute bottom-0 left-[10.5px] top-6 w-px", darkMode ? "bg-white/10" : "bg-[#e8e8e6]")} />}
            <span className={cx("relative mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full", item.tone === "green" ? "bg-[#e4f1e6] text-[#2f7a4f]" : darkMode ? "bg-white/10 text-white/70" : "bg-[#f4f4f2] text-[#5f5f5c]")}>
              {Icon ? <Icon className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px]">{item.title}</p>
              {item.time && <p className={cx("mt-0.5 text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a87]")}>{item.time}</p>}
              {item.children && <div className="mt-3">{item.children}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Right-side panel with a slide in/out. Escape and the backdrop close it.
export function Drawer({ open, onClose, darkMode, title, subtitle, icon: Icon, tone = "neutral", width = 520, footer, children, notice }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  if (open && !mounted) {
    setMounted(true);
    setClosing(false);
  }
  if (!open && mounted && !closing) setClosing(true);

  useEffect(() => {
    if (!closing) return undefined;
    const id = window.setTimeout(() => { setMounted(false); setClosing(false); }, 220);
    return () => window.clearTimeout(id);
  }, [closing]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end newq">
      <div className={cx("ui-backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px]", closing && "is-closing")} onMouseDown={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} style={{ maxWidth: width }} className={cx("ui-drawer relative flex h-full w-full flex-col overflow-hidden border-l shadow-[0_24px_70px_rgba(0,0,0,0.16)] sm:m-2.5 sm:h-[calc(100%-20px)] sm:rounded-[24px] sm:border", closing && "is-closing", darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]")}>
        <header className={cx("flex items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
          <h2 className="flex min-w-0 items-center gap-3 text-[17px] tracking-[-0.01em]">{Icon && <IconTile icon={Icon} tone={tone} darkMode={darkMode} size="sm" />}<span className="min-w-0"><span className="block truncate">{title}</span>{subtitle && <span className={cx("block truncate text-[12.5px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{subtitle}</span>}</span></h2>
          <button type="button" onClick={onClose} aria-label="Close" className={cx("grid h-9 w-9 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
            <X className="h-4 w-4" />
          </button>
        </header>
        {notice}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className={cx("flex items-center justify-end gap-2 border-t px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>{footer}</footer>}
      </aside>
    </div>,
    document.body,
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
    <div className="ui-backdrop fixed inset-0 z-[320] flex items-center justify-center bg-black/35 p-4 newq">
      <div role="alertdialog" aria-modal="true" className={cx("ui-pop w-full max-w-md rounded-[24px] border p-6", darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]")} style={{ boxShadow: "var(--ui-shadow-pop)" }}>
        <div className="flex items-start gap-3.5">
          <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px]", darkMode ? "bg-red-500/10" : "bg-[#fbe4e6]")}>
            <AlertTriangle className="h-[18px] w-[18px] text-[#c0394b]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px]">{title}</h3>
            <p className={cx("mt-1.5 text-[13px] leading-5", darkMode ? "text-white/55" : "text-[#6f6f6c]")}>{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button darkMode={darkMode} variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button darkMode={darkMode} variant="danger" onClick={onConfirm} disabled={loading} loading={loading}>{loading ? "Deleting…" : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function DocumentIcon({ doc, darkMode, className = "w-4 h-4" }) {
  const name = doc?.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  const base = darkMode ? "text-white/55" : "text-black/45";
  if (doc?.type === "sheet" || ["csv", "xls", "xlsx"].includes(ext)) return <Sheet className={`${className} ${darkMode ? "text-[#d8f36a]" : "text-green-600"}`} />;
  if (ext === "pdf") return <FileText className={`${className} text-red-500`} />;
  if (["doc", "docx"].includes(ext)) return <FileType className={`${className} text-blue-500`} />;
  if (["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(ext)) return <ImageIcon className={`${className} text-fuchsia-500`} />;
  if (["zip", "rar", "7z"].includes(ext)) return <FileArchive className={`${className} text-amber-500`} />;
  if (["txt", "md", "rtf"].includes(ext)) return <FileText className={`${className} ${base}`} />;
  return <File className={`${className} ${base}`} />;
}

/* ───────── Reference building blocks ───────── */

const TILE_SIZES = { xs: "h-7 w-7 rounded-[9px] [&>svg]:h-3.5 [&>svg]:w-3.5", sm: "h-9 w-9 rounded-[11px] [&>svg]:h-4 [&>svg]:w-4", md: "h-11 w-11 rounded-[14px] [&>svg]:h-5 [&>svg]:w-5", lg: "h-14 w-14 rounded-[18px] [&>svg]:h-6 [&>svg]:w-6" };

// A pastel square with an icon, as on every reference card.
export function IconTile({ icon: Icon, tone = "neutral", darkMode, size = "md", className = "" }) {
  if (!Icon) return null;
  return (
    <span style={toneStyle(tone, darkMode)} className={cx("grid shrink-0 place-items-center", TILE_SIZES[size] || TILE_SIZES.md, className)}>
      {isValidElement(Icon) ? Icon : createElement(Icon, { strokeWidth: 1.8 })}
    </span>
  );
}

// Small pill with an icon: "Area A · Scam interception".
export function Badge({ icon: Icon, tone = "mint", darkMode, children, className = "" }) {
  return (
    <span style={toneStyle(tone, darkMode)} className={cx("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px]", className)}>
      {Icon && (isValidElement(Icon) ? Icon : createElement(Icon, { className: "h-3.5 w-3.5", strokeWidth: 1.9 }))}
      {children}
    </span>
  );
}

// Two-line heading: the first line black, the second grey.
export function SectionTitle({ darkMode, title, subtitle, size = "md", className = "" }) {
  const big = size === "lg";
  const line = big ? "text-[30px] leading-[1.08] sm:text-[34px]" : "text-[22px] leading-[1.15]";
  return (
    <div className={cx("min-w-0", className)}>
      <h2 className={cx("tracking-[-0.02em]", line, darkMode ? "text-white" : "text-[#141414]")}>{title}</h2>
      {subtitle && <p className={cx("tracking-[-0.02em]", line, darkMode ? "text-white/40" : "text-[#9a9a98]")}>{subtitle}</p>}
    </div>
  );
}

// The top of every module: badge, two-line title, an optional line of text and actions.
export function PageHeader({ darkMode, badge, badgeIcon, badgeTone = "mint", title, subtitle, description, actions, className = "" }) {
  return (
    <header className={cx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {badge && <Badge icon={badgeIcon} tone={badgeTone} darkMode={darkMode} className="mb-3">{badge}</Badge>}
        <SectionTitle darkMode={darkMode} title={title} subtitle={subtitle} />
        {description && <p className={cx("mt-2 max-w-2xl text-[13.5px] leading-6", darkMode ? "text-white/55" : "text-[#7a7a78]")}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// A pastel number tile: icon, big value, small label.
// size "lg" is the dashboard's big tile: value and label set large and bold in the heading font.
export function StatTile({ darkMode, icon, tone = "mint", value, label, hint, onClick, size = "md", className = "" }) {
  const Tag = onClick ? "button" : "div";
  const t = toneOf(tone);
  const renderedIcon = (cls) => (isValidElement(icon) ? icon : createElement(icon, { className: cls, strokeWidth: 1.8 }));

  // size "lg" is the dashboard tile: a neutral grey card, the tone only on the icon tile,
  // the label beside it, a chevron when it opens something, then a big bold value and a hint.
  if (size === "lg") {
    return (
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("group flex min-h-[150px] min-w-0 flex-col justify-between rounded-[24px] p-4 text-left transition-[transform,background-color] sm:min-h-[168px] sm:p-5", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]", onClick && (darkMode ? "hover:-translate-y-0.5 hover:bg-white/[0.07] active:scale-[0.99]" : "hover:-translate-y-0.5 hover:bg-[#efefec] active:scale-[0.99]"), className)}>
        <span className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]" style={{ backgroundColor: darkMode ? t[2] : t[0], color: darkMode ? t[3] : t[1] }}>
              {renderedIcon("h-5 w-5")}
            </span>
          )}
          {label && <span className={cx("min-w-0 flex-1 truncate text-[14.5px] sm:text-[16px]", darkMode ? "text-white/75" : "text-[#3d3d3b]")}>{label}</span>}
          {onClick && <ChevronRight className={cx("h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5", darkMode ? "text-white/40" : "text-[#a3a3a0]")} />}
        </span>
        <span className="mt-5 block">
          <span className={cx("small force-bold block truncate text-[36px] leading-none tracking-[-0.03em] tabular-nums sm:text-[42px]", darkMode ? "text-white" : "text-[#141414]")}>{value}</span>
          {hint && <span className={cx("mt-2 block truncate text-[13px] sm:text-[14px]", darkMode ? "text-white/50" : "text-[#6b6b6b]")}>{hint}</span>}
        </span>
      </Tag>
    );
  }

  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} style={{ backgroundColor: darkMode ? t[2] : t[0] }} className={cx("flex min-h-[118px] min-w-0 flex-col justify-between rounded-[20px] p-4 text-left transition-transform", onClick && "hover:-translate-y-0.5 active:scale-[0.99]", className)}>
      {icon && <span style={{ color: darkMode ? t[3] : t[1] }}>{renderedIcon("h-5 w-5")}</span>}
      <span className="mt-4 block">
        <span className={cx("block truncate text-[28px] leading-none tracking-[-0.03em] tabular-nums", darkMode ? "text-white" : "text-[#141414]")}>{value}</span>
        {label && <span className={cx("mt-2 block text-[12.5px]", darkMode ? "text-white/55" : "text-[#6b6b6b]")}>{label}</span>}
        {hint && <span className={cx("mt-0.5 block text-[11.5px]", darkMode ? "text-white/40" : "text-[#9a9a98]")}>{hint}</span>}
      </span>
    </Tag>
  );
}

// A white card with a pastel icon tile, a title and a short line, like the reference feature cards.
export function FeatureCard({ darkMode, icon, tone = "mint", title, text, index, footer, onClick, className = "", children }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("relative flex flex-col rounded-[20px] border p-5 text-left transition-colors", darkMode ? "border-white/10 bg-[#15171c] hover:bg-[#191b21]" : "border-[#ececec] bg-white hover:bg-[#fcfcfb]", className)}>
      {index != null && <span className={cx("absolute right-5 top-4 text-[12px] tabular-nums", darkMode ? "text-white/35" : "text-[#b0b0ae]")}>{String(index).padStart(2, "0")}</span>}
      <IconTile icon={icon} tone={tone} darkMode={darkMode} />
      {title && <h4 className={cx("mt-4 text-[15px] tracking-[-0.01em]", darkMode ? "text-white" : "text-[#141414]")}>{title}</h4>}
      {text && <p className={cx("mt-1.5 text-[13px] leading-5", darkMode ? "text-white/55" : "text-[#7a7a78]")}>{text}</p>}
      {children}
      {footer && <div className={cx("mt-4 text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{footer}</div>}
    </Tag>
  );
}

// A lime (or black) highlight strip: icon, title, line.
export function Highlight({ darkMode, icon, title, text, tone = "lime", action, className = "" }) {
  const ink = tone === "ink";
  return (
    <div className={cx("flex items-center gap-3.5 rounded-[20px] px-5 py-4", ink ? "bg-[#141414] text-white" : darkMode ? "bg-[#cff07a]/15 text-white" : "bg-[#d4f28a] text-[#141414]", className)}>
      {icon && (isValidElement(icon) ? icon : createElement(icon, { className: "h-5 w-5 shrink-0", strokeWidth: 1.8 }))}
      <div className="min-w-0 flex-1">
        {title && <p className="text-[14px]">{title}</p>}
        {text && <p className={cx("text-[12.5px]", ink || darkMode ? "text-white/60" : "text-[#3d4a1a]")}>{text}</p>}
      </div>
      {action}
    </div>
  );
}

// Empty state: a soft tile, a line and an optional action.
export function EmptyState({ darkMode, icon, tone = "neutral", title, text, action, className = "" }) {
  return (
    <div className={cx("flex flex-col items-center justify-center rounded-[20px] px-6 py-12 text-center", darkMode ? "bg-white/[0.03]" : "bg-[#f7f7f5]", className)}>
      <IconTile icon={icon} tone={tone} darkMode={darkMode} size="lg" />
      {title && <p className={cx("mt-4 text-[15px]", darkMode ? "text-white" : "text-[#141414]")}>{title}</p>}
      {text && <p className={cx("mt-1 max-w-sm text-[13px]", darkMode ? "text-white/50" : "text-[#8a8a8a]")}>{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
