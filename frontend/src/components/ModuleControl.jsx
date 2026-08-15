"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Power, Save, Search, ShieldCheck, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";

function formatDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function dateInputFromIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeInputFromIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isoFromLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return "";
  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function displayTimeInput(value = "") {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return "Select time";
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function currentTimeInput() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function MaintenanceDatePicker({ darkMode, label, value, placeholder, onChange }) {
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date());
  const [panelStyle, setPanelStyle] = useState({});
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const toInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const displayValue = value ? formatDateLabel(value) : placeholder;

  function monthDays(baseDate) {
    const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (pickerRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function updatePanelPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const gap = 8;
      const panelWidth = 280;
      const wantedHeight = 392;
      const roomBelow = window.innerHeight - rect.bottom - gap - margin;
      const roomAbove = rect.top - gap - margin;
      const openUpward = roomBelow < wantedHeight && roomAbove > roomBelow;
      setPanelStyle({
        position: "fixed",
        width: panelWidth,
        left: Math.min(Math.max(margin, rect.left), window.innerWidth - panelWidth - margin),
        top: openUpward ? undefined : rect.bottom + gap,
        bottom: openUpward ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: Math.max(300, Math.min(wantedHeight, openUpward ? roomAbove : roomBelow)),
      });
    }
    updatePanelPosition();
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  return (
    <div ref={pickerRef} className="relative">
      <p className="text-xs font-medium text-black/65 dark:text-white/60">{label}</p>
      <button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)} className={`mt-2 flex h-11 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-semibold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"}`}>
        <span className={value ? "" : muted}>{displayValue}</span>
        <CalendarDays className={`h-4 w-4 ${muted}`} />
      </button>
      {open && (
        <div style={panelStyle} className={`z-[110] overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          <div className="p-4 pb-3">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setMonthDate(new Date(year, month - 1, 1))} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}><ChevronLeft className="h-4 w-4" /></button>
              <p className="text-xs font-medium text-blue-600">Choose date</p>
              <button type="button" onClick={() => setMonthDate(new Date(year, month + 1, 1))} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className={`mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase ${muted}`}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-1">{day}</span>)}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium">{monthDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {monthDays(new Date(year, month, 1)).map((day) => {
                  const key = toInput(day);
                  const isSelected = key === value;
                  const inMonth = day.getMonth() === month;
                  return (
                    <button key={key} type="button" onClick={() => { onChange(key); setOpen(false); }} className={`grid h-8 place-items-center text-xs font-normal transition ${isSelected ? "rounded-full bg-blue-600 text-white" : inMonth ? darkMode ? "text-white hover:bg-white/10" : "text-black hover:bg-black/[0.04]" : darkMode ? "text-white/22" : "text-black/18"}`}>
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className={`flex items-center justify-end gap-5 border-t px-4 py-3 ${darkMode ? "border-white/10" : "border-black/10"}`}>
            <button type="button" onClick={() => setOpen(false)} className={`text-xs font-bold ${muted}`}>Cancel</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-black text-[#171714] dark:text-white">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

const MAINTENANCE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label: new Date(2000, 0, 1, hour, 0).toLocaleTimeString("en-IN", { hour: "numeric" }),
}));
const MAINTENANCE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function MaintenanceTimePicker({ darkMode, label, value, onChange }) {
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(value || currentTimeInput());
  const [panelStyle, setPanelStyle] = useState({});
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const [selectedHour = "10", selectedMinute = "30"] = String(draftTime || currentTimeInput()).split(":");

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (ref.current?.contains(event.target)) return;
      setOpen(false);
    }
    function updatePanelPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const gap = 8;
      const panelWidth = Math.max(300, Math.min(380, rect.width));
      const wantedHeight = 392;
      const roomBelow = window.innerHeight - rect.bottom - gap - margin;
      const roomAbove = rect.top - gap - margin;
      const openUpward = roomBelow < wantedHeight && roomAbove > roomBelow;
      setPanelStyle({
        position: "fixed",
        width: panelWidth,
        left: Math.min(Math.max(margin, rect.left), window.innerWidth - panelWidth - margin),
        top: openUpward ? undefined : rect.bottom + gap,
        bottom: openUpward ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: Math.max(300, Math.min(wantedHeight, openUpward ? roomAbove : roomBelow)),
      });
    }
    updatePanelPosition();
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  function commitTime(nextHour = selectedHour, nextMinute = selectedMinute) {
    const next = `${nextHour}:${nextMinute}`;
    setDraftTime(next);
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-medium text-black/65 dark:text-white/60">{label}</p>
      <button ref={triggerRef} type="button" onClick={() => { setDraftTime(value || currentTimeInput()); setOpen((current) => !current); }} className={`mt-2 flex h-11 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-semibold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"} ${open ? (darkMode ? "ring-2 ring-rose-300/20" : "ring-2 ring-rose-500/15") : ""}`}>
        <span className="flex items-center gap-2">
          <Clock3 className={`h-4 w-4 ${darkMode ? "text-rose-200" : "text-rose-600"}`} />
          {value ? displayTimeInput(value) : "Select time"}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""} ${muted}`} />
      </button>
      {open && (
        <div style={panelStyle} className={`z-[120] overflow-hidden rounded-2xl border p-2 ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          <div className={`mb-2 rounded-2xl p-3 ${darkMode ? "bg-white/[0.045]" : "bg-[#fff5f5]"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Selected time</p>
            <p className="mt-1 text-lg font-black">{displayTimeInput(draftTime)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide ${muted}`}>Hour</p>
              <div className="max-h-56 overflow-y-auto pr-1">
                {MAINTENANCE_HOUR_OPTIONS.map((option) => {
                  const active = option.value === selectedHour;
                  return <button key={option.value} type="button" onClick={() => commitTime(option.value, selectedMinute)} className={`mb-1 flex h-9 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition ${active ? "bg-rose-500 text-white" : darkMode ? "text-white/70 hover:bg-white/[0.07]" : "text-black/65 hover:bg-rose-50"}`}><span>{option.label}</span>{active && <Check className="h-4 w-4" />}</button>;
                })}
              </div>
            </div>
            <div>
              <p className={`mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide ${muted}`}>Minute</p>
              <div className="max-h-56 overflow-y-auto pr-1">
                {MAINTENANCE_MINUTE_OPTIONS.map((minute) => {
                  const active = minute === selectedMinute;
                  return <button key={minute} type="button" onClick={() => commitTime(selectedHour, minute)} className={`mb-1 flex h-9 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition ${active ? "bg-rose-500 text-white" : darkMode ? "text-white/70 hover:bg-white/[0.07]" : "text-black/65 hover:bg-rose-50"}`}><span>{minute}</span>{active && <Check className="h-4 w-4" />}</button>;
                })}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className={`mt-2 h-10 w-full rounded-xl text-sm font-black transition ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#171714] text-white hover:bg-black/80"}`}>Done</button>
        </div>
      )}
    </div>
  );
}

export default function ModuleControl({ darkMode }) {
  const { refreshUser } = useAuth();
  const [modules, setModules] = useState([]);
  const [disabledModules, setDisabledModules] = useState([]);
  const [maintenance, setMaintenance] = useState({ enabled: false, estimatedEndAt: "", message: "We are improving the workspace. Please check back soon." });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`${API_URL}/admin/module-control`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load module controls");
        if (ignore) return;
        setModules(data.modules || []);
        setDisabledModules(data.disabledModules || []);
        setMaintenance({
          enabled: Boolean(data.maintenance?.enabled),
          estimatedEndAt: data.maintenance?.estimatedEndAt || "",
          message: data.maintenance?.message || "We are improving the workspace. Please check back soon.",
        });
      } catch (error) {
        if (!ignore) toast.error(error.message || "Could not load module controls");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => { ignore = true; };
  }, []);

  const filteredModules = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return modules.filter((module) => !needle || `${module.label} ${module.id}`.toLowerCase().includes(needle));
  }, [modules, query]);

  const disabledSet = useMemo(() => new Set(disabledModules), [disabledModules]);
  const enabledCount = modules.filter((module) => module.locked || !disabledSet.has(module.id)).length;

  function toggleModule(module) {
    if (module.locked) return;
    setDisabledModules((current) => (
      current.includes(module.id) ? current.filter((id) => id !== module.id) : [...current, module.id]
    ));
    setDirty(true);
  }

  function updateMaintenance(patch) {
    setMaintenance((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  async function save() {
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/admin/module-control`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledModules, maintenance }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save module controls");
      setDisabledModules(data.disabledModules || []);
      setMaintenance({
        enabled: Boolean(data.maintenance?.enabled),
        estimatedEndAt: data.maintenance?.estimatedEndAt || "",
        message: data.maintenance?.message || "We are improving the workspace. Please check back soon.",
      });
      setDirty(false);
      await refreshUser();
      toast.success("Module visibility updated");
    } catch (error) {
      toast.error(error.message || "Could not save module controls");
    } finally {
      setSaving(false);
    }
  }

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const maintenanceDate = dateInputFromIso(maintenance.estimatedEndAt);
  const maintenanceTime = timeInputFromIso(maintenance.estimatedEndAt);
  function updateMaintenanceEnd(nextDate = maintenanceDate, nextTime = maintenanceTime || currentTimeInput()) {
    updateMaintenance({ estimatedEndAt: isoFromLocalDateTime(nextDate, nextTime) });
  }

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
      <section className={`relative mb-5 overflow-hidden rounded-[30px] p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#202328]" : "border-black/[0.06] bg-[#fbfbfd]"}`}>
        {!darkMode && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/80 to-transparent" />
            <span className="absolute -left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f5f8]" />
            <span className="absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f5f8]" />
          </>
        )}
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.06] bg-white text-black/70 shadow-[0_10px_24px_rgba(31,35,40,0.08)]"}`}>
                <ShieldCheck className="h-4 w-4" /> Access administration
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.04] bg-[#fff1a8] text-black/70 shadow-[0_8px_18px_rgba(31,35,40,0.08)]"}`}>
                {modules.length} modules
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.04] bg-[#d5f3f0] text-black/70 shadow-[0_8px_18px_rgba(31,35,40,0.08)]"}`}>
                {enabledCount} active
              </span>
            </div>
            <h1 className={`mt-5 max-w-4xl text-4xl small font-black leading-[0.96] tracking-tight ${darkMode ? "text-white" : "text-[#161616]"}`}>Module access, made simple.</h1>
            <p className={`mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base ${darkMode ? "text-white/65" : "text-black/58"}`}>Turn platform modules on or off and control sidebar availability for every user in one clean workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button type="button" onClick={save} disabled={!dirty || saving} className={`flex h-12 items-center justify-center gap-2 rounded-3xl px-5 text-sm shadow-[0_14px_28px_rgba(31,35,40,0.16)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </section>

      <section className={`mb-5 overflow-hidden rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${maintenance.enabled ? "bg-rose-500/10 text-rose-500" : darkMode ? "bg-white/10 text-white/55" : "bg-slate-100 text-slate-500"}`}>
                <Wrench className="h-4 w-4" /> Maintenance
              </span>
              <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold ${darkMode ? "bg-white/10 text-white/65" : "bg-[#f3f5ef] text-black/55"}`}>
                <ShieldCheck className="h-4 w-4" /> Super Admin stays active
              </span>
            </div>
            <h2 className="small mt-4 text-3xl font-black leading-none">Maintenance access lock</h2>
            <p className={`mt-3 max-w-2xl text-sm leading-6 ${muted}`}>When enabled, every non-super-admin user sees a maintenance screen with your estimated timer and cannot access app routes.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className={`rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-[#fbfcf9]"}`}>
                <span className={`mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide ${muted}`}><CalendarDays className="h-4 w-4" /> End date</span>
                <MaintenanceDatePicker darkMode={darkMode} label="Date" value={maintenanceDate} placeholder="Select date" onChange={(date) => updateMaintenanceEnd(date, maintenanceTime || currentTimeInput())} />
              </label>
              <label className={`rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-[#fbfcf9]"}`}>
                <span className={`mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide ${muted}`}><Clock3 className="h-4 w-4" /> End time</span>
                <MaintenanceTimePicker darkMode={darkMode} label="Time" value={maintenanceTime} onChange={(time) => updateMaintenanceEnd(maintenanceDate || dateInputFromIso(new Date().toISOString()), time)} />
              </label>
            </div>
            <label className={`mt-4 block rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-[#fbfcf9]"}`}>
              <span className={`mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide ${muted}`}><Clock3 className="h-4 w-4" /> User message</span>
              <textarea
                rows={3}
                value={maintenance.message}
                onChange={(event) => updateMaintenance({ message: event.target.value })}
                placeholder="We are improving the workspace. Please check back soon."
                className={`min-h-[96px] w-full resize-none rounded-2xl border px-3 py-3 text-sm font-semibold leading-6 outline-none ${darkMode ? "border-white/10 bg-[#0d0f13] text-white placeholder:text-white/30" : "border-black/10 bg-white text-[#171714] placeholder:text-black/35"}`}
              />
            </label>
          </div>
          <aside className={`flex flex-col justify-between rounded-[26px] border p-5 ${maintenance.enabled ? darkMode ? "border-rose-300/20 bg-rose-300/10" : "border-rose-100 bg-rose-50" : darkMode ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-slate-100"}`}>
            <div>
              <p className={`text-[11px] font-black uppercase tracking-wide ${maintenance.enabled ? "text-rose-500" : darkMode ? "text-white/55" : "text-slate-500"}`}>Current mode</p>
              <h3 className="small mt-2 text-3xl font-black">{maintenance.enabled ? "Locked" : "Open"}</h3>
              <p className={`mt-2 text-sm leading-6 ${darkMode ? "text-white/60" : "text-black/58"}`}>{maintenance.enabled ? "Users are held at the maintenance screen." : "Users can access assigned modules normally."}</p>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className={`text-sm font-black ${maintenance.enabled ? "text-rose-500" : darkMode ? "text-white/55" : "text-slate-500"}`}>{maintenance.enabled ? "On" : "Off"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={maintenance.enabled}
                onClick={() => updateMaintenance({ enabled: !maintenance.enabled })}
                className={`relative h-8 w-14 shrink-0 overflow-hidden rounded-full transition ${maintenance.enabled ? "bg-rose-500" : darkMode ? "bg-white/20" : "bg-slate-300"}`}
              >
                <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform ${maintenance.enabled ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className={`overflow-hidden rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl small font-semibold">Module records</h2>
            <p className={`mt-1 text-sm ${muted}`}>Global module visibility and platform status list.</p>
          </div>
          <label className={`flex h-12 w-full items-center gap-3 rounded-2xl border px-4 lg:w-[360px] ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
            <Search className={`h-4 w-4 shrink-0 ${muted}`} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search module, status..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current placeholder:opacity-40" />
          </label>
        </div>

        <div className="overflow-x-auto pt-3">
          {loading ? (
            <div className={`p-10 text-center text-sm ${muted}`}>Loading modules...</div>
          ) : (
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left">
              <thead className={darkMode ? "bg-[#15171c]" : "bg-white"}>
                <tr>{["Module", "Status", "Availability", "Control"].map((heading) => <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {filteredModules.map((module) => {
                  const enabled = module.locked || !disabledSet.has(module.id);
                  return (
                    <tr key={module.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                      <td className="rounded-l-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${enabled ? darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-cyan-100 text-cyan-700" : darkMode ? "bg-white/[0.06] text-white/35" : "bg-slate-200 text-slate-500"}`}>
                            {module.locked ? <ShieldCheck className="h-4 w-4" /> : enabled ? <CheckCircle2 className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </span>
                          <div><p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{module.label}</p><p className={`mt-0.5 text-xs ${muted}`}>{module.id}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>{module.locked ? "Always on" : enabled ? "Enabled" : "Disabled"}</span></td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{module.locked ? "Protected platform module" : enabled ? "Visible in assigned sidebars" : "Hidden for every user"}</td>
                      <td className="rounded-r-xl px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`text-xs font-semibold ${enabled ? "text-emerald-600" : muted}`}>{module.locked ? "Locked" : enabled ? "On" : "Off"}</span>
                          <button type="button" role="switch" aria-checked={enabled} aria-label={`${enabled ? "Disable" : "Enable"} ${module.label}`} disabled={module.locked} onClick={() => toggleModule(module)} className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition ${enabled ? "bg-emerald-500" : darkMode ? "bg-white/15" : "bg-black/15"} disabled:cursor-not-allowed disabled:opacity-55`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !filteredModules.length && <div className={`p-10 text-center text-sm ${muted}`}>No modules match this search.</div>}
        </div>
      </section>
    </main>
  );
}
