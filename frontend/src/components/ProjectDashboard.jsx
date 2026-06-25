"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ChartNoAxesColumnIncreasing,
  Clock3,
  Database,
  FileSpreadsheet,
  Filter,
  Layers3,
  ListFilter,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Table2,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import { SelectMenu } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const DEFAULT_DMR_SPREADSHEET_ID = "";

const blankAssignment = () => ({
  id: `assignment_${Date.now()}`,
  documentId: "",
  tabs: [],
  category: "auto",
  projectValue: "",
  mapping: {},
});

const blankProject = () => ({
  name: "",
  code: "",
  location: "",
  manager: "",
  status: "active",
  aliases: [],
  assignments: [blankAssignment()],
  dmr: {
    enabled: false,
    spreadsheetId: DEFAULT_DMR_SPREADSHEET_ID,
    siteNames: [],
    agencyNames: [],
    assignedUserIds: [],
    editableUserIds: [],
  },
});

const CATEGORY_OPTIONS = [
  { value: "auto", label: "Auto detect" },
  { value: "work", label: "Work / Tasks" },
  { value: "attendance", label: "Attendance" },
  { value: "procurement", label: "Purchase / Materials" },
  { value: "payment", label: "Payments / Costs" },
  { value: "approval", label: "Approvals" },
  { value: "issue", label: "Issues / Risks" },
];

const MAPPING_FIELDS = [
  ["projectColumn", "Project / site"],
  ["titleColumn", "Task / item"],
  ["statusColumn", "Status"],
  ["dueDateColumn", "Due date"],
  ["completedDateColumn", "Completed date"],
  ["updatedDateColumn", "Updated / action date"],
  ["ownerColumn", "Owner / responsible"],
  ["notesColumn", "Notes / action"],
];

const PROJECT_LOADING_STEPS = [
  { title: "Connecting your project workbooks", detail: "Checking linked Sheets and available project tabs.", icon: Database },
  { title: "Organizing site activities", detail: "Matching trades, agencies, rooms, dates, and workflow stages.", icon: Layers3 },
  { title: "Preparing your project dashboard", detail: "Calculating progress, overdue work, and today’s priorities.", icon: ChartNoAxesColumnIncreasing },
];

function Modal({ darkMode, title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[30px] border ${wide ? "max-w-6xl" : "max-w-2xl"} ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-[#faf9f5] text-[#171714]"}`}>
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
          <div><p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>Project studio</p><h3 className=" text-2xl font-semibold">{title}</h3><p className={`mt-1 max-w-3xl text-sm ${darkMode ? "text-white/48" : "text-black/48"}`}>{subtitle}</p></div>
          <button type="button" onClick={onClose} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function DonutChart({ value = 0, label, darkMode, size = 112 }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className={darkMode ? "stroke-white/10" : "stroke-black/[0.06]"} />
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" strokeLinecap="round" className={darkMode ? "stroke-[#d8f36a]" : "stroke-[#15a8e0]"} strokeDasharray={circumference} strokeDashoffset={circumference - (progress / 100) * circumference} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className=" text-xl font-semibold">{progress}%</span><span className={`text-[9px] ${darkMode ? "text-white/40" : "text-black/40"}`}>{label}</span></div>
    </div>
  );
}

function WorkloadChart({ items = [], darkMode, color = "bg-[#e76f42]" }) {
  const visible = items.slice(0, 6);
  const max = Math.max(1, ...visible.map((item) => item.pending));
  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium">{item.label}</span><span className={darkMode ? "text-white/45" : "text-black/45"}>{item.pending} pending</span></div>
          <div className={`h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/8" : "bg-black/[0.055]"}`}><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, (item.pending / max) * 100)}%` }} /></div>
        </div>
      ))}
      {!visible.length && <p className={`py-8 text-center text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>No workload data available.</p>}
    </div>
  );
}

function StageChart({ stages = {}, darkMode }) {
  const entries = Object.entries(stages).filter(([, data]) => data.total > 0);
  const max = Math.max(1, ...entries.map(([, data]) => data.total));
  return (
    <div className="flex min-h-64 items-end gap-3 pt-5">
      {entries.map(([stage, data]) => {
        const totalHeight = Math.max(14, (data.total / max) * 150);
        const doneHeight = data.total ? (data.done / data.total) * totalHeight : 0;
        return (
          <div key={stage} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="mb-2 text-center">
              <p className="text-[10px] font-semibold text-amber-600">{data.pending} pending</p>
              <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{data.done} completed</p>
            </div>
            <div className={`relative w-full max-w-12 overflow-hidden rounded-t-xl ${darkMode ? "bg-white/10" : "bg-[#ebe6dc]"}`} style={{ height: totalHeight }}>
              <div className="absolute inset-x-0 bottom-0 bg-[#99dfbd]" style={{ height: doneHeight }} />
            </div>
            <p className="mt-2 max-w-full truncate text-[10px] font-semibold capitalize">{stage}</p>
            <p className={`mt-0.5 text-[9px] ${darkMode ? "text-white/40" : "text-black/40"}`}>{data.total} tracked</p>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, darkMode }) {
  const tones = {
    neutral: darkMode ? "bg-white/5 text-white/70" : "bg-black/[0.035] text-black/65",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    danger: "bg-red-500/10 text-red-500",
  };
  return (
    <div className={`rounded-2xl p-4 ${darkMode ? "border border-white/10 bg-white/[0.025]" : "border border-black/5 bg-white"}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone || "neutral"]}`}><Icon className="h-4 w-4" /></span>
      <p className=" mt-4 text-2xl font-semibold">{value}</p>
      <p className={`mt-1 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</p>
    </div>
  );
}

function RecordList({ title, items, darkMode, empty = "Nothing to show." }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  return (
    <section>
      <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold">{title}</h4><span className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/5" : "bg-black/[0.04]"} ${muted}`}>{items.length}</span></div>
      <div className="grid gap-3 xl:grid-cols-2">
        {!items.length && <div className={`rounded-2xl border p-5 text-center text-sm ${darkMode ? "border-white/10" : "border-black/5"} ${muted}`}>{empty}</div>}
        {items.map((item) => {
          const stages = Object.entries(item.stageStatuses || {}).filter(([, state]) => state !== "unknown");
          const completedStages = stages.filter(([, state]) => state === "done").length;
          const pendingStages = stages.filter(([, state]) => state !== "done").map(([stage]) => stage);
          const progress = stages.length ? Math.round((completedStages / stages.length) * 100) : 0;
          return (
            <article key={item.id} className={`flex flex-col rounded-[22px] border p-4 sm:p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.07] bg-white"}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${darkMode ? "bg-white/10 text-white" : "bg-[#eef4ff] text-[#285db5]"}`}>{(item.trade || item.title || "P").slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-base font-semibold leading-5">{item.title}</p><p className={`mt-1 text-xs ${darkMode ? "text-white/55" : "text-black/55"}`}>{[item.trade, item.floor, item.area].filter(Boolean).join(" · ") || "Project activity"}</p></div>
                    {item.priority && <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-600">{item.priority}</span>}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(item.agency || item.supervisor) && <span className={`rounded-lg px-2.5 py-1.5 text-[11px] ${darkMode ? "bg-white/5 text-white/60" : "bg-[#f3f4f5] text-black/65"}`}><span className="font-semibold">Owner:</span> {[item.agency, item.supervisor].filter(Boolean).join(" · ")}</span>}
                {item.status && <span className={`rounded-lg px-2.5 py-1.5 text-[11px] ${item.completed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700"}`}>{item.status}</span>}
              </div>

              {item.notes && <p className={`mt-3 line-clamp-2 text-xs leading-5 ${darkMode ? "text-white/55" : "text-black/55"}`}>{item.notes}</p>}

              {stages.length > 0 && <div className={`mt-4 rounded-2xl p-3 ${darkMode ? "bg-white/[0.035]" : "bg-[#f7f8f9]"}`}>
                <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">Workflow progress</span><span className={muted}>{completedStages} of {stages.length} complete</span></div>
                <div className={`mt-2 h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.07]"}`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                <p className={`mt-2 text-[11px] leading-4 ${darkMode ? "text-white/50" : "text-black/50"}`}>{pendingStages.length ? `Still pending: ${pendingStages.join(", ")}` : "All workflow stages completed"}</p>
              </div>}

              <div className={`mt-4 flex flex-col gap-2 border-t pt-3 text-xs sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-white/8" : "border-black/[0.06]"}`}>
                <p className="flex flex-wrap items-center gap-1.5"><span className={muted}>Schedule</span><span className={`rounded-lg px-2 py-1 font-semibold ${darkMode ? "bg-blue-400/10 text-blue-300" : "bg-blue-50 text-blue-700"}`}>{item.startDate || "Not set"}</span><span className={muted}>→</span><span className={`rounded-lg px-2 py-1 font-semibold ${darkMode ? "bg-orange-400/10 text-orange-300" : "bg-orange-50 text-orange-700"}`}>{item.dueDate || "Not set"}</span></p>
                <p className={`truncate text-[10px] ${darkMode ? "text-white/35" : "text-black/40"}`}>{item.source.tab} · Row {item.source.row}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SearchField({ value, onChange, placeholder, darkMode, className = "" }) {
  return (
    <label className={`relative block ${className}`}>
      <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? "text-white/35" : "text-black/35"}`} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none transition focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.035] focus:ring-[#d8f36a]/30" : "border-black/10 bg-white focus:ring-black/10"}`}
      />
    </label>
  );
}

function StagePipeline({ stages = {}, darkMode }) {
  const entries = Object.entries(stages).filter(([, data]) => data.total > 0);
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {entries.map(([stage, data]) => {
        const percentage = data.total ? Math.round((data.done / data.total) * 100) : 0;
        return (
          <div key={stage} className={`rounded-2xl border p-3 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/5 bg-white"}`}>
            <div className="flex items-center justify-between"><p className="text-xs font-medium capitalize">{stage}</p><span className="text-xs font-semibold">{percentage}%</span></div>
            <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/5"}`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} /></div>
            <p className={`mt-2 text-[10px] ${darkMode ? "text-white/40" : "text-black/40"}`}>{data.pending} pending · {data.done} done</p>
          </div>
        );
      })}
    </div>
  );
}

function listFromText(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function UserPill({ user, active, onClick, darkMode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs transition ${
        active
          ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black" : "border-black bg-black text-white"
          : darkMode ? "border-white/10 text-white/55 hover:bg-white/5" : "border-black/10 bg-white text-black/55 hover:bg-black/[0.03]"
      }`}
    >
      {user.displayName || user.username}
    </button>
  );
}

function DmrPanel({ darkMode, project, dmrData, loading, saving, drafts, setDrafts, onRefresh, onSave }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-[#dfe5e9] bg-white";
  const rows = dmrData?.records || [];
  const totals = dmrData?.totals || {};
  const valueFor = (record, key) => drafts[record.id]?.[key] ?? record[key] ?? "";
  const updateValue = (record, key, value) => {
    setDrafts((current) => ({
      ...current,
      [record.id]: {
        ...(current[record.id] || {}),
        id: record.id,
        rowNumber: record.rowNumber,
        plannedColumn: record.plannedColumn,
        actualColumn: record.actualColumn,
        [key]: value,
      },
    }));
  };

  if (!project.dmr?.canView) {
    return (
      <div className={`rounded-[26px] border p-8 text-center ${panel}`}>
        <FileSpreadsheet className={`mx-auto h-9 w-9 ${muted}`} />
        <h4 className="mt-4 text-lg font-semibold">DMR is not assigned</h4>
        <p className={`mt-2 text-sm ${muted}`}>Ask Super Admin to assign this project DMR to your account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`rounded-[26px] border p-8 ${panel}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>
            <p className="text-sm font-semibold">Opening today&apos;s DMR sheet</p>
            <p className={`mt-1 text-xs ${muted}`}>If today&apos;s tab is missing, I&apos;ll create it from the latest DMR format.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {dmrData?.created && (
        <div className={`rounded-2xl border px-4 py-3 text-xs ${darkMode ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200" : "border-emerald-500/20 bg-emerald-50 text-emerald-800"}`}>
          Today&apos;s DMR tab was created automatically: <span className="font-semibold">{dmrData.sheetName}</span>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_.75fr]">
        <section className={`rounded-[26px] border p-5 sm:p-6 ${panel}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Daily manpower report</p>
              <h4 className="mt-2 text-2xl font-semibold">{project.name} · {dmrData?.sheetName || "Today"}</h4>
              <p className={`mt-2 text-sm ${muted}`}>Fill planned and actual attendance/manpower for each agency. The Google Sheet updates when you save.</p>
            </div>
            <button onClick={onRefresh} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm ${darkMode ? "border-white/10" : "border-black/10"}`}><RefreshCw className="h-4 w-4" /> Reload</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[["Planned", totals.planned || 0, "bg-[#fff0bd] text-amber-800"], ["Actual", totals.actual || 0, "bg-[#d9f4e5] text-emerald-800"], ["Variance", totals.variance || 0, (totals.variance || 0) < 0 ? "bg-[#ffd5cf] text-red-700" : "bg-[#e4e1ff] text-violet-800"], ["Pending rows", totals.missing || 0, "bg-[#f3efe6] text-black/60"]].map(([label, value, tone]) => (
              <div key={label} className={`rounded-2xl p-4 ${darkMode ? "bg-white/5 text-white" : tone}`}>
                <p className="text-2xl font-semibold">{value}</p>
                <p className={`mt-1 text-[10px] ${darkMode ? "text-white/45" : ""}`}>{label}</p>
              </div>
            ))}
          </div>
        </section>
        <section className={`rounded-[26px] border p-5 sm:p-6 ${panel}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Agency snapshot</p>
              <h4 className="mt-2 text-xl font-semibold">Today&apos;s actuals</h4>
            </div>
            <Table2 className={`h-5 w-5 ${muted}`} />
          </div>
          <div className="mt-5 max-h-56 space-y-2 overflow-y-auto pr-1">
            {(dmrData?.agencyBreakdown || []).slice(0, 8).map((item) => (
              <div key={item.agency} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${darkMode ? "bg-white/[0.035]" : "bg-[#f4f0e8]"}`}>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{item.agency}</p><p className={`mt-1 text-[10px] ${muted}`}>Planned {item.planned}</p></div>
                <div className="text-right"><p className="text-sm font-semibold">{item.actual}</p><p className={`text-[10px] ${(item.variance || 0) < 0 ? "text-red-500" : "text-emerald-600"}`}>{item.variance >= 0 ? "+" : ""}{item.variance}</p></div>
              </div>
            ))}
            {!dmrData?.agencyBreakdown?.length && <p className={`py-8 text-center text-xs ${muted}`}>No agency rows found for this project.</p>}
          </div>
        </section>
      </div>

      <section className={`rounded-[26px] border p-4 sm:p-5 ${panel}`}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h4 className="text-lg font-semibold">Fill today&apos;s entries</h4><p className={`mt-1 text-xs ${muted}`}>{rows.length} agency rows matched this project site.</p></div>
          <button disabled={!dmrData?.canEdit || saving || !Object.keys(drafts).length} onClick={onSave} className={`flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save DMR
          </button>
        </div>
        {!dmrData?.canEdit && <div className={`mb-4 rounded-2xl border px-4 py-3 text-xs ${darkMode ? "border-amber-400/20 bg-amber-400/5 text-amber-200/75" : "border-amber-500/20 bg-amber-50 text-amber-800"}`}>You can view this DMR, but editing is not assigned to your account.</div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((record) => (
            <article key={record.id} className={`rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.07] bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{record.agency}</p>
                  <p className={`mt-1 text-xs ${muted}`}>{record.site}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] ${(Number(valueFor(record, "actual")) - Number(valueFor(record, "planned"))) < 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                  {(Number(valueFor(record, "actual")) - Number(valueFor(record, "planned"))) >= 0 ? "+" : ""}{Number(valueFor(record, "actual")) - Number(valueFor(record, "planned"))}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className={`text-[11px] ${muted}`}>Planned<input disabled={!dmrData?.canEdit} type="number" value={valueFor(record, "planned")} onChange={(event) => updateValue(record, "planned", event.target.value)} className={`mt-2 h-11 w-full rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#fafafa]"}`} /></label>
                <label className={`text-[11px] ${muted}`}>Actual / Present<input disabled={!dmrData?.canEdit} type="number" value={valueFor(record, "actual")} onChange={(event) => updateValue(record, "actual", event.target.value)} className={`mt-2 h-11 w-full rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#fafafa]"}`} /></label>
              </div>
            </article>
          ))}
          {!rows.length && <div className={`rounded-2xl border p-6 text-center text-sm ${darkMode ? "border-white/10" : "border-black/5"} ${muted}`}>No DMR rows matched this project. Check the project aliases/site names in settings.</div>}
        </div>
      </section>
    </div>
  );
}

export default function ProjectDashboard({ darkMode }) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const [data, setData] = useState({ projects: [], totals: {} });
  const [config, setConfig] = useState({ projects: [], sheets: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState("today");
  const [attentionTab, setAttentionTab] = useState("due");
  const [projectSearch, setProjectSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordTrade, setRecordTrade] = useState("all");
  const [recordAgency, setRecordAgency] = useState("all");
  const [recordStatus, setRecordStatus] = useState("pending");
  const [editor, setEditor] = useState(null);
  const [editorSection, setEditorSection] = useState("details");
  const [saving, setSaving] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [dmrDate, setDmrDate] = useState(() => localDateInputValue());
  const [dmrData, setDmrData] = useState(null);
  const [dmrLoading, setDmrLoading] = useState(false);
  const [dmrSaving, setDmrSaving] = useState(false);
  const [dmrDrafts, setDmrDrafts] = useState({});

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-[#dfe5e9] bg-white";

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoadingStep(0);
        setLoading(true);
      }
      const dashboard = await api("/project-dashboard");
      setData(dashboard);
      setSelected((current) => current ? dashboard.projects.find((project) => project.id === current.id) || null : null);
      if (!quiet) setLoading(false);
      if (isSuperAdmin) {
        try {
          const dashboardConfig = await api("/project-dashboard/config");
          setConfig(dashboardConfig);
        } catch (configError) {
          toast.error(`Project settings could not load: ${configError.message}`);
        }
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    if (!loading) return undefined;
    const intervalId = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % PROJECT_LOADING_STEPS.length);
    }, 1800);
    return () => window.clearInterval(intervalId);
  }, [loading]);

  const selectedProject = selected ? data.projects.find((project) => project.id === selected.id) || selected : null;
  const categories = useMemo(() => selectedProject ? Object.entries(selectedProject.categoryCounts || {}).sort((a, b) => b[1] - a[1]) : [], [selectedProject]);
  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return data.projects.filter((project) => {
      const matchesSearch = !query || [project.name, project.code, project.location, project.manager].join(" ").toLowerCase().includes(query);
      const matchesRisk = riskFilter === "all"
        || (riskFilter === "overdue" && project.metrics.overdue > 0)
        || (riskFilter === "due" && project.metrics.dueToday > 0)
        || (riskFilter === "blocked" && project.metrics.blocked > 0);
      return matchesSearch && matchesRisk;
    });
  }, [data.projects, projectSearch, riskFilter]);
  const detailOptions = useMemo(() => {
    const records = selectedProject?.records || [];
    const values = (key) => [...new Set(records.map((record) => record[key]).filter(Boolean))].sort().map((value) => ({ value, label: value }));
    return { trades: values("trade"), agencies: values("agency") };
  }, [selectedProject]);
  const filteredRecords = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    return (selectedProject?.records || []).filter((record) => {
      if (query && !record.searchText?.includes(query)) return false;
      if (recordTrade !== "all" && record.trade !== recordTrade) return false;
      if (recordAgency !== "all" && record.agency !== recordAgency) return false;
      if (recordStatus === "pending" && record.completed) return false;
      if (recordStatus === "overdue" && !(record.dueDate && record.dueDate < selectedProject.date && !record.completed)) return false;
      if (recordStatus === "blocked" && !record.blocked) return false;
      if (recordStatus === "completed" && !record.completed) return false;
      return true;
    });
  }, [recordAgency, recordSearch, recordStatus, recordTrade, selectedProject]);
  const attentionViews = selectedProject ? {
    due: { label: "Due today", items: selectedProject.highlights.dueToday, tone: "text-amber-600" },
    overdue: { label: "Overdue", items: selectedProject.highlights.overdue, tone: "text-red-600" },
    starting: { label: "Starting today", items: selectedProject.highlights.startingToday || [], tone: "text-blue-600" },
    blocked: { label: "Blocked / waiting", items: selectedProject.highlights.blocked, tone: "text-violet-600" },
  } : {};

  const loadDmr = useCallback(async (projectId = selectedProject?.id, date = dmrDate) => {
    if (!projectId) return;
    try {
      setDmrLoading(true);
      const result = await api(`/project-dashboard/dmr?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`);
      setDmrData(result);
      setDmrDrafts({});
    } catch (error) {
      toast.error(error.message || "Could not load DMR");
      setDmrData(null);
    } finally {
      setDmrLoading(false);
    }
  }, [dmrDate, selectedProject]);

  useEffect(() => {
    if (detailTab !== "dmr" || !selectedProject?.id) return undefined;
    const timeoutId = window.setTimeout(() => { void loadDmr(selectedProject.id, dmrDate); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [detailTab, dmrDate, loadDmr, selectedProject?.id]);

  async function saveDmr() {
    try {
      setDmrSaving(true);
      await api("/project-dashboard/dmr", {
        method: "PATCH",
        body: JSON.stringify({
          projectId: selectedProject.id,
          date: dmrDate,
          updates: Object.values(dmrDrafts),
        }),
      });
      toast.success("DMR saved to Google Sheet");
      await loadDmr();
    } catch (error) {
      toast.error(error.message || "Could not save DMR");
    } finally {
      setDmrSaving(false);
    }
  }

  function openEditor(project = null) {
    const nextProject = project ? JSON.parse(JSON.stringify(project)) : blankProject();
    nextProject.dmr = {
      enabled: Boolean(nextProject.dmr?.enabled),
      spreadsheetId: nextProject.dmr?.spreadsheetId || DEFAULT_DMR_SPREADSHEET_ID,
      siteNames: nextProject.dmr?.siteNames || [],
      agencyNames: nextProject.dmr?.agencyNames || [],
      assignedUserIds: nextProject.dmr?.assignedUserIds || [],
      editableUserIds: nextProject.dmr?.editableUserIds || [],
    };
    setEditor(nextProject);
    setEditorSection("details");
  }

  function updateAssignment(index, patch) {
    setEditor((current) => ({
      ...current,
      assignments: current.assignments.map((assignment, assignmentIndex) => assignmentIndex === index ? { ...assignment, ...patch } : assignment),
    }));
  }

  function updateDmr(patch) {
    setEditor((current) => ({ ...current, dmr: { ...(current.dmr || {}), ...patch } }));
  }

  function toggleDmrUser(field, userId) {
    const current = editor.dmr?.[field] || [];
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    updateDmr({ [field]: next });
  }

  function assignmentSheet(assignment) {
    return config.sheets.find((sheet) => sheet.id === assignment.documentId);
  }

  function assignmentHeaders(assignment) {
    const sheet = assignmentSheet(assignment);
    const tabs = assignment.tabs?.length ? sheet?.tabs?.filter((tab) => assignment.tabs.includes(tab.name)) : sheet?.tabs;
    return [...new Set((tabs || []).flatMap((tab) => tab.headers || []))];
  }

  async function saveProject(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...editor,
        aliases: Array.isArray(editor.aliases) ? editor.aliases : listFromText(editor.aliases),
        dmr: {
          ...(editor.dmr || {}),
          siteNames: Array.isArray(editor.dmr?.siteNames) ? editor.dmr.siteNames : listFromText(editor.dmr?.siteNames),
          agencyNames: Array.isArray(editor.dmr?.agencyNames) ? editor.dmr.agencyNames : listFromText(editor.dmr?.agencyNames),
          assignedUserIds: editor.dmr?.assignedUserIds || [],
          editableUserIds: editor.dmr?.editableUserIds || [],
        },
      };
      await api(editor.id ? `/project-dashboard/projects/${editor.id}` : "/project-dashboard/projects", {
        method: editor.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(editor.id ? "Project updated" : "Project created");
      setEditor(null);
      await load(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    try {
      await api(`/project-dashboard/projects/${project.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      setEditor(null);
      await load(true);
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (loading) {
    const activeStep = PROJECT_LOADING_STEPS[loadingStep];
    const ActiveIcon = activeStep.icon;
    return (
      <div className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
        <div className="w-full max-w-2xl">
          <div className={`rounded-[30px] border p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}>
            <div className="flex items-start gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}><ActiveIcon className="h-5 w-5" /></span>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>Project workspace</p>
                <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{activeStep.title}</h2>
                <p className={`mt-2 text-sm leading-6 ${darkMode ? "text-white/50" : "text-black/50"}`}>{activeStep.detail}</p>
              </div>
            </div>

            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {PROJECT_LOADING_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const active = index === loadingStep;
                const complete = index < loadingStep;
                return <div key={step.title} className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${active ? darkMode ? "border-[#d8f36a]/35 bg-[#d8f36a]/8" : "border-black/15 bg-[#f3f1eb]" : darkMode ? "border-white/8" : "border-black/[0.06]"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${complete ? "bg-emerald-500/10 text-emerald-500" : active ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : darkMode ? "bg-white/5 text-white/35" : "bg-black/[0.04] text-black/35"}`}><StepIcon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0"><p className={`truncate text-xs font-medium ${!active && !complete ? darkMode ? "text-white/35" : "text-black/35" : ""}`}>Step {index + 1}</p><p className={`mt-0.5 truncate text-[10px] ${darkMode ? "text-white/40" : "text-black/40"}`}>{complete ? "Ready" : active ? "Working…" : "Up next"}</p></div>
                </div>;
              })}
            </div>

            <div className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>
              <div className={`h-full rounded-full transition-all duration-700 ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} style={{ width: `${((loadingStep + 1) / PROJECT_LOADING_STEPS.length) * 100}%` }} />
            </div>
            <p className={`mt-3 text-center text-xs ${darkMode ? "text-white/35" : "text-black/40"}`}>Large workbooks may take a moment the first time. The next visit will be faster.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
      <div className="mx-auto w-full ">
        <div className={`mb-8 overflow-hidden rounded-[30px] p-6 sm:p-8 ${darkMode ? "bg-[#151612]" : "bg-[#ebe6dc]"}`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/65" : "bg-white/55 text-black/60"}`}><ChartNoAxesColumnIncreasing className="h-3.5 w-3.5" /> Project workspace</span>
              <h2 className=" mt-5 text-4xl font-semibold small tracking-tight">Projects that stay on track.</h2>
              <p className={`mt-2 max-w-4xl text-sm leading-6 ${muted}`}>Consolidate every project sheet, monitor pending work and deadlines, and see exactly which trade or agency needs attention.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => load(true)} disabled={refreshing} className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white/55"}`}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
              {isSuperAdmin && <button onClick={() => openEditor()} className={`flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}><Plus className="h-4 w-4" /> Create project</button>}
            </div>
          </div>
        </div>

        {/* <div className={`mb-6 flex flex-col gap-3 rounded-[24px] border p-3 sm:flex-row ${panel}`}>
          <SearchField value={projectSearch} onChange={setProjectSearch} placeholder="Search project, site, manager or code…" darkMode={darkMode} className="flex-1" />
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-white/5" : "bg-[#ebe6dc]"}`}><Filter className="h-4 w-4" /></span>
            {[["all", "All sites"], ["overdue", "Has overdue"], ["due", "Due today"], ["blocked", "Blocked"]].map(([value, label]) => (
              <button key={value} onClick={() => setRiskFilter(value)} className={`h-10 shrink-0 rounded-xl px-4 text-xs font-medium ${riskFilter === value ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : muted}`}>{label}</button>
            ))}
          </div>
        </div> */}

        {!data.projects.length ? (
          <div className={`rounded-[28px]  p-12 text-center ${panel}`}><BriefcaseBusiness className={`mx-auto h-9 w-9 ${muted}`} /><h3 className="mt-4 text-lg font-medium">No projects configured</h3><p className={`mt-2 text-sm ${muted}`}>Create a project and assign its linked Google Sheets to start consolidation.</p></div>
        ) : (
          <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <article key={project.id} className={`group flex min-h-[320px] flex-col rounded-[26px] p-5 transition hover:-translate-y-0.5 ${panel}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-white/10 text-white" : "bg-[#eef4ff] text-[#285db5]"}`}><BriefcaseBusiness className="h-4 w-4" /></span><h3 className=" truncate text-xl font-semibold leading-tight">{project.name}</h3></div>
                    <span className={`mt-3 inline-flex w-fit rounded-full px-3 py-1 text-[11px] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{project.code || project.location || "Project site"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isSuperAdmin && <button onClick={() => openEditor(config.projects.find((item) => item.id === project.id))} aria-label={`Configure ${project.name}`} className={`flex h-9 w-9 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/10 text-white/55" : "border-black/10 hover:bg-black/5 text-black/45"}`}><Settings2 className="h-4 w-4" /></button>}
                    <button onClick={() => { setSelected(project); setDetailTab("overview"); setAttentionTab("due"); setRecordSearch(""); setRecordTrade("all"); setRecordAgency("all"); setRecordStatus("pending"); }} className={`flex h-9 items-center gap-1 rounded-full px-3.5 text-xs font-medium ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}>Open <ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${muted}`}>
                  {project.location && project.code && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {project.location}</span>}
                  {project.manager && <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {project.manager}</span>}
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${darkMode ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active · {project.metrics.trades} trades</span>
                </div>

                <div className={`mt-5 flex items-center gap-4 rounded-[20px]  p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.05] bg-[#fafafa]"}`}>
                  <DonutChart value={project.metrics.progress} label="complete" darkMode={darkMode} size={102} />
                  <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-4 text-center">
                    {[["Pending", project.metrics.pending], ["Due", project.metrics.dueToday], ["Overdue", project.metrics.overdue], ["Agencies", project.metrics.agencies]].map(([label, value]) => <div key={label}><p className={` text-lg font-semibold ${label === "Overdue" && value > 0 ? "text-red-500" : ""}`}>{value}</p><p className={`mt-0.5 text-[9px] ${muted}`}>{label}</p></div>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedProject && <Modal darkMode={darkMode} title={selectedProject.name} subtitle={`${selectedProject.location || "Project site"} · Consolidated through ${selectedProject.sources.length} source assignment${selectedProject.sources.length === 1 ? "" : "s"}`} onClose={() => setSelected(null)} wide>
        <div className="p-5 sm:p-7">
          <div className={`mb-6 flex gap-2 overflow-x-auto rounded-full  p-1 ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-[#ebe6dc]"}`}>
            {[["overview", "Executive overview"], ["work", "Activities"], ["agencies", "Agencies & trades"], ["procurement", "Procurement"], ["sources", "Sources"]].map(([value, label]) => <button key={value} onClick={() => setDetailTab(value)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm ${detailTab === value ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : muted}`}>{label}</button>)}
          </div>
          {detailTab === "overview" && <div className="space-y-7">
            <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <div className={`flex flex-col rounded-[26px] p-5 sm:p-6 ${panel}`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <DonutChart value={selectedProject.metrics.progress} label="overall" darkMode={darkMode} size={138} />
                  <div className="flex-1"><p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Site performance</p><h4 className=" mt-2 text-2xl font-semibold">{selectedProject.metrics.pending} activities still open</h4><p className={`mt-2 text-sm leading-6 ${muted}`}>{selectedProject.metrics.overdue ? `${selectedProject.metrics.overdue} overdue activities need immediate coordination.` : "No overdue activities are currently reported."}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#fff0bd] px-3 py-1.5 text-xs text-amber-800">{selectedProject.metrics.dueToday} due today</span><span className="rounded-full bg-[#dce8ff] px-3 py-1.5 text-xs text-blue-800">{selectedProject.metrics.trades} trades</span><span className="rounded-full bg-[#d9f4e5] px-3 py-1.5 text-xs text-emerald-800">{selectedProject.metrics.agencies} agencies</span></div></div>
                </div>
                <div className={`mt-5 border-t pt-4 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
                  <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">Critical workflow health</p><span className={`text-[10px] ${muted}`}>Completed vs tracked</span></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["Design", selectedProject.stageCounts?.design, "bg-[#39a8e0]"],
                      ["Procurement", selectedProject.stageCounts?.procurement, "bg-[#ff8a24]"],
                      ["Execution", selectedProject.stageCounts?.execution, "bg-[#8555d9]"],
                    ].map(([label, stage, color]) => {
                      const percentage = stage?.total ? Math.round((stage.done / stage.total) * 100) : 0;
                      return <div key={label} className={`rounded-2xl p-3 ${darkMode ? "bg-white/[0.035]" : "bg-[#f6f7f8]"}`}>
                        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">{label}</span><span className="text-xs font-semibold">{percentage}%</span></div>
                        <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.07]"}`}><div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} /></div>
                        <p className={`mt-2 text-[10px] ${muted}`}>{stage?.pending || 0} pending · {stage?.done || 0} done</p>
                      </div>;
                    })}
                  </div>
                </div>
              </div>
              <div className={`rounded-[26px]  p-5 sm:p-6 ${panel}`}><div className="flex items-center justify-between"><div><p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Attention snapshot</p><h4 className=" mt-2 text-xl font-semibold">Today&apos;s pulse</h4></div><ListFilter className={`h-5 w-5 ${muted}`} /></div><div className="mt-5 grid grid-cols-2 gap-3">{[["Due today", selectedProject.metrics.dueToday, "bg-[#fff0bd]"], ["Overdue", selectedProject.metrics.overdue, "bg-[#ffd5cf]"], ["Blocked", selectedProject.metrics.blocked, "bg-[#e4e1ff]"], ["Starting", selectedProject.metrics.startingToday, "bg-[#d9f4e5]"]].map(([label, value, bg]) => <div key={label} className={`rounded-2xl p-3 ${darkMode ? "bg-white/5" : bg}`}><p className=" text-2xl font-semibold">{value}</p><p className={`mt-1 text-[10px] ${muted}`}>{label}</p></div>)}</div></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <section className={`rounded-[26px] p-5 sm:p-6 ${panel}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Workflow chart</p><h4 className="mt-2 text-xl font-semibold">Stage completion overview</h4><p className={`mt-1 text-xs ${muted}`}>Each column shows all tracked activities in that workflow stage.</p></div><div className="flex flex-wrap gap-2 text-[10px]"><span className="flex items-center gap-1.5 rounded-full bg-[#d9f4e5] px-3 py-1.5 text-emerald-700"><i className="h-2 w-2 rounded-full bg-[#49bd8b]" /> Completed</span><span className="flex items-center gap-1.5 rounded-full bg-[#f3efe6] px-3 py-1.5 text-amber-700"><i className="h-2 w-2 rounded-full bg-[#c9bda7]" /> Pending</span></div></div><StageChart stages={selectedProject.stageCounts} darkMode={darkMode} /></section>
              <section className={`rounded-[26px]  p-5 sm:p-6 ${panel}`}><div className="mb-5"><p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Agency chart</p><h4 className=" mt-2 text-xl font-semibold">Largest open workloads</h4></div><WorkloadChart items={selectedProject.agencyBreakdown || []} darkMode={darkMode} /></section>
            </div>
            {!selectedProject.coverage?.hasCompletionDates && <div className={`rounded-2xl border px-4 py-3 text-xs ${darkMode ? "border-amber-400/20 bg-amber-400/5 text-amber-200/70" : "border-amber-500/20 bg-amber-50 text-amber-800"}`}>These workbooks track current stage status but do not store the date a task was completed. “Completed today” is therefore not inferred; due and overdue figures use the End Date column.</div>}
            <section>
              <div className={`mb-5 flex gap-2 overflow-x-auto rounded-2xl  p-1.5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.07] bg-[#f3f1eb]"}`}>
                {Object.entries(attentionViews).map(([value, view]) => (
                  <button key={value} type="button" onClick={() => setAttentionTab(value)} className={`flex min-w-fit flex-1 items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm ${attentionTab === value ? darkMode ? "bg-white text-black" : "bg-white text-black" : muted}`}>
                    <span className="font-medium">{view.label}</span><span className={`rounded-full px-2 py-0.5 text-xs ${attentionTab === value ? view.tone : darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}>{view.items.length}</span>
                  </button>
                ))}
              </div>
              <RecordList title={attentionViews[attentionTab]?.label || "Due today"} items={attentionViews[attentionTab]?.items || []} darkMode={darkMode} empty={`No ${String(attentionViews[attentionTab]?.label || "items").toLowerCase()} records.`} />
            </section>
          </div>}
          {detailTab === "dmr" && <div className="space-y-5">
            <div className={`flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between ${panel}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${darkMode ? "bg-white/5" : "bg-[#ebe6dc]"}`}><FileSpreadsheet className="h-4 w-4" /></span>
                <div><p className="text-sm font-semibold">Daily DMR</p><p className={`text-xs ${muted}`}>Choose a date. Missing date tabs are created automatically.</p></div>
              </div>
              <input type="date" value={dmrDate} onChange={(event) => setDmrDate(event.target.value)} className={`h-11 rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
            </div>
            <DmrPanel darkMode={darkMode} project={selectedProject} dmrData={dmrData} loading={dmrLoading} saving={dmrSaving} drafts={dmrDrafts} setDrafts={setDmrDrafts} onRefresh={loadDmr} onSave={saveDmr} />
          </div>}
          {detailTab === "work" && <div>
            <div className={`mb-5 grid gap-3 rounded-2xl border p-3 md:grid-cols-2 xl:grid-cols-5 ${panel}`}>
              <SearchField value={recordSearch} onChange={setRecordSearch} placeholder="Search activity, room, agency…" darkMode={darkMode} className="md:col-span-2" />
              <SelectMenu darkMode={darkMode} value={recordTrade} onChange={setRecordTrade} options={[{ value: "all", label: "All trades" }, ...detailOptions.trades]} />
              <SelectMenu darkMode={darkMode} value={recordAgency} onChange={setRecordAgency} options={[{ value: "all", label: "All agencies" }, ...detailOptions.agencies]} />
              <SelectMenu darkMode={darkMode} value={recordStatus} onChange={setRecordStatus} options={[{ value: "all", label: "Every status" }, { value: "pending", label: "Pending" }, { value: "overdue", label: "Overdue" }, { value: "blocked", label: "Blocked" }, { value: "completed", label: "Completed" }]} />
            </div>
            <div className="mb-5 flex flex-wrap gap-2">{categories.map(([category, count]) => <span key={category} className={`rounded-full px-3 py-1.5 text-xs capitalize ${darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/60"}`}>{category} · {count}</span>)}</div>
            <RecordList title={`Activities (${filteredRecords.length} matching)`} items={filteredRecords} darkMode={darkMode} empty="No activities match these filters." />
          </div>}
          {detailTab === "agencies" && <div className="grid gap-5 lg:grid-cols-2">
            {[["Agency workload", selectedProject.agencyBreakdown || [], "bg-[#e76f42]"], ["Trade workload", selectedProject.tradeBreakdown || [], "bg-[#6f8fd8]"]].map(([title, items, color]) => <section key={title} className={`rounded-[26px] border p-5 ${panel}`}><div className="mb-6 flex items-center justify-between"><div><p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Workload chart</p><h4 className=" mt-2 text-xl font-semibold">{title}</h4></div><ChartNoAxesColumnIncreasing className={`h-5 w-5 ${muted}`} /></div><WorkloadChart items={items} darkMode={darkMode} color={color} /><div className="mt-6 space-y-2">{items.slice(0, 8).map((item) => <div key={item.label} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${darkMode ? "bg-white/[0.035]" : "bg-[#f4f0e8]"}`}><div><p className="text-sm font-medium">{item.label}</p><p className={`mt-1 text-[10px] ${muted}`}>{item.total} total activities</p></div><div className="text-right"><p className="text-sm font-semibold">{item.pending}</p><p className="text-[10px] text-red-500">{item.overdue} overdue</p></div></div>)}</div></section>)}
          </div>}
          {detailTab === "procurement" && <RecordList title="Selection and procurement pending" items={selectedProject.records.filter((record) => ["pending", "in_progress", "blocked"].includes(record.stageStatuses?.Selection) || ["pending", "in_progress", "blocked"].includes(record.stageStatuses?.Procurement) || record.category === "procurement")} darkMode={darkMode} empty="No procurement backlog found." />}
          {detailTab === "sources" && <div className="grid gap-3 md:grid-cols-2">{selectedProject.sources.map((source, index) => <div key={`${source.documentId}-${index}`} className={`rounded-2xl border p-4 ${panel}`}><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${source.status === "ready" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}><Database className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{source.documentName || source.documentId}</p><p className={`mt-1 text-xs capitalize ${muted}`}>{source.status} · {source.recordCount || 0} records</p></div></div>{source.error && <p className="mt-3 text-xs text-red-500">{source.error}</p>}</div>)}</div>}
        </div>
      </Modal>}

      {editor && <Modal darkMode={darkMode} title={editor.id ? "Configure project" : "Create project"} subtitle="Assign linked Sheets and map their different columns into one project view." onClose={() => setEditor(null)} wide>
        <form onSubmit={saveProject} className="grid h-[calc(92vh-102px)] min-h-0 max-h-[720px] grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[230px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
          <aside className={`border-b p-4 lg:row-start-1 lg:border-b-0 lg:border-r lg:p-5 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[["details", "Project details", Building2], ["sources", "Sheets & mapping", Database]].map(([value, label, Icon], index) => (
                <button key={value} type="button" onClick={() => setEditorSection(value)} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm ${editorSection === value ? darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white" : darkMode ? "text-white/55 hover:bg-white/5" : "text-black/50 hover:bg-black/[0.04]"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] ${editorSection === value ? "border-current/20" : darkMode ? "border-white/10" : "border-black/10"}`}>{index + 1}</span><Icon className="h-4 w-4" /><span>{label}</span>
                </button>
              ))}
            </div>
            <div className={`mt-5 hidden rounded-[22px] p-4 text-xs leading-5 lg:block ${darkMode ? "bg-white/5 text-white/45" : "bg-[#ebe6dc] text-black/50"}`}><ChartNoAxesColumnIncreasing className="mb-3 h-5 w-5" />Each linked sheet contributes live activities to this project dashboard. Automatic mapping works for known workbook structures.</div>
          </aside>

          <div className="min-h-0 min-w-0 overflow-y-auto p-5 pb-10 sm:p-8 sm:pb-12 lg:col-start-2 lg:row-start-1">
            {editorSection === "details" && <div className="grid gap-6 md:grid-cols-[1fr_1.8fr] md:gap-10">
              <div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 01</p><h4 className=" mt-2 text-2xl font-semibold">Define the project site</h4><p className={`mt-2 text-sm leading-6 ${muted}`}>Use a clear name, site location, project code, and accountable manager so reports remain easy to understand.</p></div>
              <div className="space-y-4">
                {[["name", "Project name", "e.g. Kalhaar Residence"], ["code", "Project code", "e.g. KAL-01"], ["location", "Location", "City, area or site address"], ["manager", "Project manager", "Responsible person"]].map(([key, label, placeholder]) => <label key={key} className="block text-xs font-medium">{label}<input value={editor[key] || ""} placeholder={placeholder} onChange={(event) => setEditor({ ...editor, [key]: event.target.value })} required={key === "name"} className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`} /></label>)}
                <label className="block text-xs font-medium">Project aliases<input value={(editor.aliases || []).join(", ")} onChange={(event) => setEditor({ ...editor, aliases: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Kalhaar, Kalhar Site, KAL-01" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`} /><span className={`mt-2 block text-[10px] ${muted}`}>Comma-separated names used to match this project in shared company sheets.</span></label>
              </div>
            </div>}

            {editorSection === "sources" && <div>
              <div className="mb-6 flex items-end justify-between gap-4"><div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 02</p><h4 className=" mt-2 text-2xl font-semibold">Connect project data</h4><p className={`mt-1 text-sm ${muted}`}>Add one or more workbooks, choose relevant tabs, and optionally fine-tune column mapping.</p></div><button type="button" onClick={() => setEditor({ ...editor, assignments: [...editor.assignments, blankAssignment()] })} className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm ${darkMode ? "border-white/10" : "border-black/10"}`}><Plus className="h-4 w-4" /> Add source</button></div>
              <div className="space-y-4">
                {editor.assignments.map((assignment, index) => {
                  const sheet = assignmentSheet(assignment);
                  const headers = assignmentHeaders(assignment);
                  return <div key={assignment.id || index} className={`rounded-[24px]  p-4 sm:p-5 ${panel}`}>
                    <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${darkMode ? "bg-white/5" : "bg-[#ebe6dc]"}`}><Database className="h-4 w-4" /></span><div><span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${muted}`}>Data source {index + 1}</span><p className="mt-0.5 text-sm font-medium">{sheet?.name || "Choose a linked workbook"}</p></div></div><button type="button" onClick={() => setEditor({ ...editor, assignments: editor.assignments.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div><p className={`mb-2 text-xs ${muted}`}>Linked Sheet</p><SelectMenu darkMode={darkMode} value={assignment.documentId} onChange={(value) => updateAssignment(index, { documentId: value, tabs: [], mapping: {} })} options={config.sheets.map((item) => ({ value: item.id, label: item.name }))} placeholder="Choose Sheet" /></div>
                      <div><p className={`mb-2 text-xs ${muted}`}>Data category</p><SelectMenu darkMode={darkMode} value={assignment.category} onChange={(value) => updateAssignment(index, { category: value })} options={CATEGORY_OPTIONS} /></div>
                      <label className={`text-xs ${muted}`}>Project value in shared Sheet<input value={assignment.projectValue || ""} onChange={(event) => updateAssignment(index, { projectValue: event.target.value })} placeholder="e.g. Kalhaar" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} /></label>
                    </div>
                    {sheet?.tabs?.length > 0 && <div className="mt-4"><p className={`mb-2 text-xs ${muted}`}>Workbook tabs <span className="opacity-60">· none selected uses the recommended tabs</span></p><div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">{sheet.tabs.map((tab) => { const active = assignment.tabs?.includes(tab.name); return <button type="button" key={tab.name} onClick={() => updateAssignment(index, { tabs: active ? assignment.tabs.filter((name) => name !== tab.name) : [...(assignment.tabs || []), tab.name] })} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${active ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black" : "border-black bg-black text-white" : darkMode ? "border-white/10" : "border-black/10 bg-white"}`}>{active && <Check className="h-3.5 w-3.5" />}{tab.name}</button>; })}</div></div>}
                    {assignment.documentId && <details className={`mt-5 rounded-2xl border p-4 ${darkMode ? "border-white/10" : "border-black/[0.07] bg-white"}`}><summary className="cursor-pointer text-xs font-medium">Advanced column mapping <span className={muted}>(optional)</span></summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{MAPPING_FIELDS.map(([key, label]) => <div key={key}><p className={`mb-2 text-[11px] ${muted}`}>{label}</p><SelectMenu darkMode={darkMode} value={assignment.mapping?.[key] || ""} onChange={(value) => updateAssignment(index, { mapping: { ...(assignment.mapping || {}), [key]: value } })} options={[{ value: "", label: "Auto detect" }, ...headers.map((header) => ({ value: header, label: header }))]} placeholder="Auto detect" /></div>)}</div></details>}
                  </div>;
                })}
              </div>
            </div>}

            {editorSection === "dmr" && <div className="grid gap-6 md:grid-cols-[1fr_1.8fr] md:gap-10">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 03</p>
                <h4 className="mt-2 text-2xl font-semibold">Set up daily DMR</h4>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>Connect the daily manpower report workbook and assign the non-technical users who can view or fill this project&apos;s rows.</p>
                <div className={`mt-5 rounded-[22px] p-4 text-xs leading-5 ${darkMode ? "bg-white/5 text-white/45" : "bg-[#ebe6dc] text-black/50"}`}>
                  The app reads date tabs like <span className="font-semibold">23 06</span>. If the selected date tab is missing, it creates one from the existing DMR format.
                </div>
              </div>
              <div className="space-y-5">
                <label className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                  <span><span className="block text-sm font-semibold">Enable DMR for this project</span><span className={`mt-1 block text-xs ${muted}`}>Shows the DMR tab inside this project.</span></span>
                  <input type="checkbox" checked={Boolean(editor.dmr?.enabled)} onChange={(event) => updateDmr({ enabled: event.target.checked })} className="h-5 w-5 accent-black" />
                </label>

                <label className="block text-xs font-medium">DMR Google Sheet URL or ID
                  <input value={editor.dmr?.spreadsheetId || ""} onChange={(event) => updateDmr({ spreadsheetId: event.target.value })} placeholder="Paste Google Sheet link or ID" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`} />
                  <span className={`mt-2 block text-[10px] ${muted}`}>This is prefilled with the DMR workbook you shared. The sheet must be shared with the service account.</span>
                </label>

                <label className="block text-xs font-medium">Site names to match
                  <input value={(editor.dmr?.siteNames || []).join(", ")} onChange={(event) => updateDmr({ siteNames: listFromText(event.target.value) })} placeholder="Kalhaar, Kalhar, 03.Kalhaar" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`} />
                  <span className={`mt-2 block text-[10px] ${muted}`}>Leave blank to use project name and aliases. Add comma-separated names if the DMR header uses different spelling.</span>
                </label>

                <label className="block text-xs font-medium">Agency filter <span className={muted}>(optional)</span>
                  <input value={(editor.dmr?.agencyNames || []).join(", ")} onChange={(event) => updateDmr({ agencyNames: listFromText(event.target.value) })} placeholder="Carpenter, Civil, Electrician" className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`} />
                  <span className={`mt-2 block text-[10px] ${muted}`}>Leave blank to show all agency/trade rows for the matched site.</span>
                </label>

                <div className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10" : "border-black/[0.07] bg-white"}`}>
                  <p className="text-sm font-semibold">Who can view this DMR?</p>
                  <p className={`mt-1 text-xs ${muted}`}>Assigned users can open the DMR tab for this project.</p>
                  <div className="mt-4 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {(config.users || []).filter((item) => !item.isSuperAdmin).map((item) => (
                      <UserPill key={item.id} user={item} active={(editor.dmr?.assignedUserIds || []).includes(item.id)} onClick={() => toggleDmrUser("assignedUserIds", item.id)} darkMode={darkMode} />
                    ))}
                    {!config.users?.length && <span className={`text-xs ${muted}`}>Users will appear here after the admin list loads.</span>}
                  </div>
                </div>

                <div className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10" : "border-black/[0.07] bg-white"}`}>
                  <p className="text-sm font-semibold">Who can fill/edit?</p>
                  <p className={`mt-1 text-xs ${muted}`}>These users also need the role permission “Fill project DMR records”.</p>
                  <div className="mt-4 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {(config.users || []).filter((item) => !item.isSuperAdmin).map((item) => (
                      <UserPill key={item.id} user={item} active={(editor.dmr?.editableUserIds || []).includes(item.id)} onClick={() => toggleDmrUser("editableUserIds", item.id)} darkMode={darkMode} />
                    ))}
                    {!config.users?.length && <span className={`text-xs ${muted}`}>Users will appear here after the admin list loads.</span>}
                  </div>
                </div>
              </div>
            </div>}
          </div>

          <div className={`z-10 col-span-full flex items-center justify-between gap-4 border-t px-5 pb-6 pt-5 sm:px-7 sm:pb-7 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-[#faf9f5]"}`}>
            <div>{editor.id && <button type="button" onClick={() => deleteProject(editor)} className="rounded-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10">Delete project</button>}</div>
            <div className="flex gap-2"><button type="button" onClick={() => setEditor(null)} className={`flex h-11 items-center rounded-full border px-6 text-sm ${darkMode ? "border-white/10 text-white/60" : "border-black/10 text-black/60"}`}>Cancel</button><button disabled={saving} className={`flex h-11 min-w-40 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />} Save project</button></div>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
