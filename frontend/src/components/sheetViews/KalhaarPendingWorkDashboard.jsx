import React, { useState, useMemo } from "react";
import {
  Hammer,
  CheckCircle2,
  Clock,
  Search,
  UserCircle2,
  Layers,
  CalendarDays,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { EmptyState, StatTile } from "../ui";

const STAGE_COLS = ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit"];
const STATUS_COLORS = {
  Done: { bg: "bg-[#7fbf8e]", text: "text-[#2f7a4f]", light: "bg-[#e4f1e6]", label: "Done" },
  "In Progress": { bg: "bg-[#78a9e3]", text: "text-[#2f6fc0]", light: "bg-[#e3eefb]", label: "In Progress" },
  Started: { bg: "bg-[#9b87e6]", text: "text-[#6b4fd1]", light: "bg-[#ece8fb]", label: "Started" },
  Pending: { bg: "bg-[#e88a98]", text: "text-[#c0394b]", light: "bg-[#fbe4e6]", label: "Pending" },
  "On Hold": { bg: "bg-[#e2b84a]", text: "text-[#8a6200]", light: "bg-[#fbf0d4]", label: "On Hold" },
};
const STATUS_ORDER = ["Done", "In Progress", "Started", "Pending", "On Hold"];

function parseRows(sheets) {
  const tasks = [];
  const agencySet = new Set();
  const supervisorSet = new Set();

  for (const sheet of sheets) {
    if (!sheet.headers || sheet.headers.length === 0) continue;
    const category = sheet.name;

    for (const row of sheet.rows) {
      const room = row["Room / Area"] || "";
      const activity = row["Activity"] || "";
      if (!room && !activity) continue;

      const agency = (row["Agency"] || "").trim();
      const supervisor = (row["Site Supervisor"] || "").trim();
      if (agency) agencySet.add(agency);
      if (supervisor) supervisorSet.add(supervisor);

      tasks.push({
        category,
        floor: (row["Floor"] || "").trim(),
        room: room.trim(),
        activity: activity.trim(),
        agency,
        supervisor,
        remark: (row["REMARK"] || "").trim(),
        remarks: (row["Remarks"] || "").trim(),
        startDate: (row["Start Date"] || "").trim(),
        endDate: (row["End Date"] || "").trim(),
        duration: (row["Duration (Days)"] || "").trim(),
        design: (row["Design"] || "").trim(),
        approval: (row["Approval"] || "").trim(),
        selection: (row["Selection"] || "").trim(),
        procurement: (row["Procurement"] || "").trim(),
        execution: (row["Execution"] || "").trim(),
        audit: (row["Audit"] || "").trim(),
      });
    }
  }

  return { tasks, agencies: [...agencySet], supervisors: [...supervisorSet] };
}

/* ─── Stage status badge ─── */
function StatusBadge({ value, darkMode }) {
  const s = (value || "").trim();
  const cfg = STATUS_COLORS[s];
  if (!cfg) return <div className={`h-3 w-3 rounded-full mx-auto ${darkMode ? "bg-white/[0.06]" : "bg-[#ebebe8]"}`} title="No data" />;
  return (
    <div className={`h-3 w-3 rounded-full mx-auto ${cfg.bg}`} title={cfg.label} />
  );
}

/* ─── Donut ─── */
function StageDonut({ title, data, darkMode }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cursor = 0;
  const gradient = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const start = cursor;
      const size = (d.value / total) * 100;
      cursor += size;
      return `${d.color} ${start}% ${cursor}%`;
    })
    .join(", ");

  return (
    <div className={`rounded-[20px] p-5 ${darkMode ? "bg-[#15171c] border border-white/10" : "bg-white border border-[#ececec]"}`}>
      <h3 className={`text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h3>
      <div className="flex items-center gap-5 mt-4">
        <div
          className="w-24 h-24 rounded-full relative flex-shrink-0"
          style={{ background: data.some((d) => d.value > 0) ? `conic-gradient(${gradient})` : (darkMode ? "rgba(255,255,255,0.08)" : "#f0f0ee") }}
        >
          <div className={`absolute inset-5 rounded-full flex flex-col items-center justify-center ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#141414]"}`}>
            <span className="text-[18px] leading-none tabular-nums">{total}</span>
          </div>
        </div>
        <div className="space-y-1.5 min-w-0">
          {data.filter((d) => d.value > 0).map((d) => (
            <div key={d.label} className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className={`text-xs truncate flex-1 ${darkMode ? "text-white/65" : "text-[#3d3d3b]"}`}>{d.label}</span>
              <span className={`text-xs tabular-nums ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Horizontal bar chart ─── */
function HorizontalBars({ title, subtitle, data, color, darkMode }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const headerText = darkMode ? "text-white" : "text-[#141414]";
  const border = darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]";

  return (
    <div className={`rounded-[20px] border overflow-hidden ${darkMode ? "bg-[#15171c] border-white/10" : "bg-white border-[#ececec]"}`}>
      <div className={`px-5 py-4 border-b ${border}`}>
        <h3 className={`text-[15px] tracking-[-0.01em] ${headerText}`}>{title}</h3>
        {subtitle && <p className={`text-xs mt-0.5 ${muted}`}>{subtitle}</p>}
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {data.slice(0, 10).map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className={`text-xs w-28 truncate ${headerText}`}>{d.label}</span>
            <div className="flex-1">
              <div className={`h-2.5 rounded-full overflow-hidden ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(4, (d.value / max) * 100)}%`, background: color }}
                />
              </div>
            </div>
            <span className={`text-xs tabular-nums w-8 text-right ${headerText}`}>{d.value}</span>
          </div>
        ))}
        {data.length === 0 && <p className={`text-xs ${muted}`}>No data</p>}
      </div>
    </div>
  );
}

/* ─── Stage pipeline chart ─── */
function StagePipeline({ tasks, darkMode }) {
  const headerText = darkMode ? "text-white" : "text-[#141414]";
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";

  const stageStats = STAGE_COLS.map((stage) => {
    const key = stage.toLowerCase();
    let done = 0, inProgress = 0, pending = 0, other = 0;
    for (const t of tasks) {
      const val = t[key] || "";
      if (val === "Done") done++;
      else if (val === "In Progress" || val === "Started") inProgress++;
      else if (val === "Pending") pending++;
      else other++;
    }
    return { stage, done, inProgress, pending, other, total: tasks.length };
  });

  return (
    <div className={`rounded-[20px] border overflow-hidden ${darkMode ? "bg-[#15171c] border-white/10" : "bg-white border-[#ececec]"}`}>
      <div className={`px-5 py-4 border-b ${darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]"}`}>
        <h3 className={`text-[15px] tracking-[-0.01em] ${headerText}`}>Workflow Stage Pipeline</h3>
        <p className={`text-xs mt-0.5 ${muted}`}>Progress across all 6 workflow stages</p>
      </div>
      <div className="px-5 py-5 space-y-4">
        {stageStats.map((s) => {
          const total = s.total || 1;
          const doneP = (s.done / total) * 100;
          const inProgP = (s.inProgress / total) * 100;
          const pendingP = (s.pending / total) * 100;
          return (
            <div key={s.stage}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs ${headerText}`}>{s.stage}</span>
                <span className={`text-xs tabular-nums ${muted}`}>
                  {s.done} done · {s.inProgress} in progress · {s.pending} pending
                </span>
              </div>
              <div className={`h-4 rounded-full overflow-hidden flex ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                {doneP > 0 && <div className="h-full bg-[#7fbf8e] transition-all" style={{ width: `${doneP}%` }} />}
                {inProgP > 0 && <div className="h-full bg-[#78a9e3] transition-all" style={{ width: `${inProgP}%` }} />}
                {pendingP > 0 && <div className="h-full bg-[#e88a98] transition-all" style={{ width: `${pendingP}%` }} />}
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-5 pt-2">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#7fbf8e]" /><span className={`text-xs ${muted}`}>Done</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#78a9e3]" /><span className={`text-xs ${muted}`}>In Progress</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#e88a98]" /><span className={`text-xs ${muted}`}>Pending</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Overview ─── */
function OverviewDashboard({ tasks, categories, agencies, supervisors, darkMode }) {
  const panel = darkMode ? "bg-[#15171c] border-white/[0.06]" : "bg-white border-[#f0f0ee]";
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const headerText = darkMode ? "text-white" : "text-[#141414]";

  // Overall status counts
  const overallStatus = useMemo(() => {
    const counts = { Done: 0, "In Progress": 0, Started: 0, Pending: 0, "On Hold": 0, "No Data": 0 };
    for (const t of tasks) {
      for (const s of STAGE_COLS) {
        const val = t[s.toLowerCase()] || "";
        if (counts[val] !== undefined) counts[val]++;
        else counts["No Data"]++;
      }
    }
    return counts;
  }, [tasks]);

  const statusDonutData = [
    { label: "Done", value: overallStatus.Done, color: "#7fbf8e" },
    { label: "In Progress", value: overallStatus["In Progress"] + overallStatus.Started, color: "#78a9e3" },
    { label: "Pending", value: overallStatus.Pending, color: "#e88a98" },
    { label: "On Hold", value: overallStatus["On Hold"], color: "#e2b84a" },
  ];

  // Category task counts
  const categoryStats = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      map[t.category] = (map[t.category] || 0) + 1;
    }
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [tasks]);

  // Agency task counts
  const agencyStats = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const key = t.agency || "Unassigned";
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [tasks]);

  // Floor stats
  const floorStats = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const key = t.floor || "N/A";
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [tasks]);

  // Completion % per category
  const categoryCompletion = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!map[t.category]) map[t.category] = { total: 0, done: 0 };
      for (const s of STAGE_COLS) {
        map[t.category].total++;
        if (t[s.toLowerCase()] === "Done") map[t.category].done++;
      }
    }
    return Object.entries(map)
      .map(([label, data]) => ({ label, value: Math.round((data.done / (data.total || 1)) * 100) }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const tasksWithDates = tasks.filter((t) => t.startDate || t.endDate).length;
  const totalDoneStages = overallStatus.Done;
  const totalStages = tasks.length * STAGE_COLS.length;
  const overallPct = totalStages ? Math.round((totalDoneStages / totalStages) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Total tasks", value: tasks.length, icon: Hammer, tone: "sky" },
          { label: "Trade categories", value: categories.length, icon: Layers, tone: "amber" },
          { label: "Active agencies", value: agencies.length, icon: UserCircle2, tone: "lavender" },
          { label: "Scheduled tasks", value: tasksWithDates, icon: CalendarDays, tone: "peach" },
          { label: "Overall progress", value: `${overallPct}%`, icon: BarChart3, tone: "mint" },
        ].map((m) => (
          <StatTile key={m.label} darkMode={darkMode} icon={m.icon} tone={m.tone} value={m.value} label={m.label} />
        ))}
      </div>

      {/* Stage pipeline */}
      <StagePipeline tasks={tasks} darkMode={darkMode} />

      {/* Charts row */}
      <div className="grid xl:grid-cols-2 gap-4">
        <StageDonut title="Overall Stage Status" data={statusDonutData} darkMode={darkMode} />
        <HorizontalBars
          title="Completion by Category"
          subtitle="% of stages marked Done per trade"
          data={categoryCompletion}
          color="#7fbf8e"
          darkMode={darkMode}
        />
      </div>

      {/* Category + Agency + Floor */}
      <div className="grid xl:grid-cols-3 gap-4">
        <HorizontalBars title="Tasks per Category" data={categoryStats} color="#78a9e3" darkMode={darkMode} />
        <HorizontalBars title="Tasks per Agency" data={agencyStats} color="#9b87e6" darkMode={darkMode} />
        <HorizontalBars title="Tasks per Floor" data={floorStats} color="#e2b84a" darkMode={darkMode} />
      </div>
    </div>
  );
}

/* ─── Per-tab detail table ─── */
function TabDetailView({ tasks, darkMode, searchQuery }) {
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const headerText = darkMode ? "text-white" : "text-[#141414]";
  const border = darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]";

  const filtered = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.room.toLowerCase().includes(q) ||
        t.activity.toLowerCase().includes(q) ||
        t.agency.toLowerCase().includes(q) ||
        t.supervisor.toLowerCase().includes(q) ||
        t.floor.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  if (tasks.length === 0) {
    return <div className="flex-1 overflow-y-auto p-4 sm:p-6"><EmptyState darkMode={darkMode} icon={Layers} title="Nothing here yet" text="This tab has no data rows." /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className={`border-b ${border} sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
            <tr>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>#</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Floor</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Room / Area</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Activity</th>
              {STAGE_COLS.map((s) => (
                <th key={s} className={`px-3 py-3.5 text-center text-[12px] font-normal ${muted}`} title={s}>{s.slice(0, 3)}</th>
              ))}
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Supervisor</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Agency</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Start</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>End</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Days</th>
              <th className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>Remarks</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${border}`}>
            {filtered.length === 0 ? (
              <tr><td colSpan={17} className={`px-5 py-12 text-center ${muted}`}>No tasks match your search.</td></tr>
            ) : (
              filtered.map((t, idx) => (
                <tr key={idx} className={`transition-colors ${darkMode ? "hover:bg-white/[0.02]" : "hover:bg-[#fafaf9]"}`}>
                  <td className={`px-4 py-3 ${muted}`}>{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${darkMode ? "bg-white/[0.06] text-white/80" : "bg-[#f4f4f2] text-[#3d3d3b]"}`}>
                      {t.floor || "—"}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${headerText}`}>{t.room || "—"}</td>
                  <td className="px-4 py-3">{t.activity}</td>
                  {STAGE_COLS.map((s) => (
                    <td key={s} className="px-3 py-3 text-center">
                      <StatusBadge value={t[s.toLowerCase()]} darkMode={darkMode} />
                    </td>
                  ))}
                  <td className={`px-4 py-3 text-sm ${darkMode ? "text-white/70" : "text-[#3d3d3b]"}`}>{t.supervisor || "—"}</td>
                  <td className="px-4 py-3">
                    {t.agency ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-[rgba(167,139,250,0.14)] text-[#c9b9fb]" : "bg-[#ece8fb] text-[#6b4fd1]"}`}>{t.agency}</span>
                    ) : (
                      <span className={`text-xs ${muted}`}>—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-xs ${muted}`}>{t.startDate || "—"}</td>
                  <td className={`px-4 py-3 text-xs ${muted}`}>{t.endDate || "—"}</td>
                  <td className={`px-4 py-3 text-xs tabular-nums ${muted}`}>{t.duration || "—"}</td>
                  <td className={`px-4 py-3 max-w-[200px] truncate ${muted}`} title={[t.remark, t.remarks].filter(Boolean).join(" · ")}>
                    {[t.remark, t.remarks].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main export ─── */
export default function KalhaarPendingWorkDashboard({ darkMode, currentSheet, sheets = [], sheetData, overview, searchQuery }) {
  const { tasks, agencies, supervisors } = useMemo(() => parseRows(sheets), [sheets]);
  const categories = useMemo(() => sheets.filter((s) => s.headers?.length > 0).map((s) => s.name), [sheets]);

  if (overview) {
    return <OverviewDashboard tasks={tasks} categories={categories} agencies={agencies} supervisors={supervisors} darkMode={darkMode} />;
  }

  const tabTasks = useMemo(
    () => (currentSheet ? tasks.filter((t) => t.category === currentSheet.name) : []),
    [tasks, currentSheet]
  );

  return <TabDetailView tasks={tabTasks} darkMode={darkMode} searchQuery={searchQuery} />;
}
