import { AlertTriangle, ArrowUpRight, Building2, CalendarDays, ClipboardList, Layers3, PackageSearch, Table2, UsersRound } from "lucide-react";
import { isWithinDateRange, parseAmount } from "./amountUtils";

const COLORS = ["#d8f36a", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

const TAB_META = {
  "All Tasks": { title: "Consolidated pending activities", group: "Trade", owner: "Agency", date: "Start Date", value: null },
  "Agency Summary": { title: "Agency workload", group: "Agency", owner: "Supervisor", date: null, value: "Total Items" },
  "Agency Detail": { title: "Agency pending detail", group: "Agency", owner: "Trade", date: "Start Date", value: null },
  "Design Pending": { title: "Design decisions needed", group: "Design Owner / Supervisor", owner: "Trade", date: "Start Date", value: null },
  "Selection Procurement": { title: "Selection and procurement priorities", group: "Priority", owner: "Trade", date: "Start Date", value: null },
  "Purchase Priority": { title: "Material purchase priorities", group: "Priority", owner: "Trade", date: null, value: "Linked Activities" },
};

function clean(value) {
  const text = String(value ?? "").trim();
  return text && !/^na$/i.test(text) ? text : "";
}

function number(value) {
  const parsed = parseAmount(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countBy(rows, column, valueColumn) {
  if (!column) return [];
  const totals = {};
  rows.forEach((row) => {
    const label = clean(row[column]) || "Not specified";
    totals[label] = (totals[label] || 0) + (valueColumn ? number(row[valueColumn]) : 1);
  });
  return Object.entries(totals).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function countPending(rows, column) {
  return rows.filter((row) => /pending/i.test(clean(row[column]))).length;
}

function Metric({ darkMode, icon: Icon, label, value, accent }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <p className={`mt-4 text-2xl font-semibold sm:text-3xl ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
    </div>
  );
}

function Bars({ darkMode, title, data }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className={`rounded-[22px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
      <h3 className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className={`truncate ${darkMode ? "text-white/65" : "text-black/55"}`}>{item.label}</span>
              <span className={darkMode ? "text-white/40" : "text-black/40"}>{item.value.toLocaleString()}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/8" : "bg-black/5"}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(6, (item.value / max) * 100)}%`, background: COLORS[index % COLORS.length] }} />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className={`text-sm ${darkMode ? "text-white/40" : "text-black/40"}`}>No data for this view.</p>}
      </div>
    </div>
  );
}

function DashboardSummary({ darkMode, rows }) {
  const metrics = Object.fromEntries(rows.filter((row) => clean(row.Metric)).map((row) => [clean(row.Metric), number(row.Value)]));
  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric darkMode={darkMode} icon={ClipboardList} label="Activities" value={(metrics["Total consolidated activities"] || 0).toLocaleString()} accent={COLORS[0]} />
        <Metric darkMode={darkMode} icon={Building2} label="Agencies / vendors" value={(metrics["Agencies / vendors"] || 0).toLocaleString()} accent={COLORS[1]} />
        <Metric darkMode={darkMode} icon={Layers3} label="Design pending" value={(metrics["Design pending activities"] || 0).toLocaleString()} accent={COLORS[2]} />
        <Metric darkMode={darkMode} icon={PackageSearch} label="Procurement pending" value={(metrics["Procurement pending activities"] || 0).toLocaleString()} accent={COLORS[3]} />
        <Metric darkMode={darkMode} icon={AlertTriangle} label="Execution pending" value={(metrics["Execution pending activities"] || 0).toLocaleString()} accent={COLORS[4]} />
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Bars darkMode={darkMode} title="Pending items by trade" data={countBy(rows.filter((row) => clean(row.Trade)), "Trade", "Pending Items")} />
        <Bars darkMode={darkMode} title="Items by agency" data={countBy(rows.filter((row) => clean(row.Agency)), "Agency", "Items")} />
      </div>
    </>
  );
}

function RecordCards({ darkMode, rows, sheetName, headers = [] }) {
  const muted = darkMode ? "text-white/45" : "text-black/40";
  const titleColumn = sheetName === "Purchase Priority" ? "Material/Product" : sheetName === "Agency Summary" ? "Agency" : "Activity";
  const subtitleColumn = sheetName === "Design Pending" ? "Design Decision Needed" : sheetName === "Purchase Priority" ? "Action" : "Room / Area";
  return (
    <div className="mb-5 grid gap-4 xl:grid-cols-2">
      {rows.slice(0, 12).map((row) => {
        const titleVal = clean(row[titleColumn]) || clean(row["Material/Product Category"]);
        const subtitleVal = clean(row[subtitleColumn]) || clean(row["Trade(s)"]) || clean(row.Trade);
        const tagVal = clean(row.Priority) || clean(row["Pending Stages"]);
        const excludeSet = new Set([
          titleColumn, "Material/Product Category",
          subtitleColumn, "Trade(s)", "Trade",
          "Priority", "Pending Stages",
          "__sheetName", "__rowIndex"
        ]);
        const details = headers.filter(h => !excludeSet.has(h) && clean(row[h])).map(h => [h, clean(row[h])]);

        return (
          <article key={`${row.__sheetName}-${row.__rowIndex}`} className={`rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/5 bg-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-lg font-semibold ${darkMode ? "text-white" : "text-black"}`}>{titleVal || "Pending activity"}</p>
                <p className={`mt-1 text-sm ${muted}`}>{subtitleVal || "No additional detail"}</p>
              </div>
              {tagVal && (
                <span className={`max-w-[44%] rounded-full px-3 py-1.5 text-right text-xs font-medium ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                  {tagVal}
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className={`rounded-2xl p-3 ${darkMode ? "bg-black/20" : "bg-black/[0.025]"}`}>
                  <p className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>{label}</p>
                  <p className={`mt-1 break-words text-sm ${darkMode ? "text-white/75" : "text-black/70"}`}>{value}</p>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function KalhaarPendingTrackerDashboard({ darkMode, currentSheet, searchQuery, dateRange = {} }) {
  const headers = currentSheet?.headers || [];
  const sheetName = currentSheet?.name || "";
  const meta = TAB_META[sheetName];
  const query = searchQuery.trim().toLowerCase();
  const rows = (currentSheet?.rows || []).filter((row) => {
    const matchesQuery = !query || headers.some((header) => String(row[header] ?? "").toLowerCase().includes(query));
    return matchesQuery && (!meta?.date || isWithinDateRange(row[meta.date], dateRange));
  });
  const linkedActivities = rows.reduce((sum, row) => sum + number(row[meta?.value]), 0);
  const primaryGroups = countBy(rows, meta?.group, meta?.value);
  const ownerGroups = countBy(rows, meta?.owner);
  const pendingProcurement = sheetName === "All Tasks" ? countPending(rows, "Procurement") : rows.filter((row) => /procurement/i.test(clean(row["Stage Needed"]) || clean(row["Pending Stages"]))).length;
  const fifthMetric = sheetName === "All Tasks"
    ? { label: "Design flags", value: countPending(rows, "Design") }
    : sheetName === "Agency Summary"
      ? { label: "Design pending", value: rows.reduce((sum, row) => sum + number(row["Design Pending"]), 0) }
      : sheetName === "Design Pending"
        ? { label: "Decisions needed", value: rows.length }
        : sheetName === "Selection Procurement"
          ? { label: "Selection flags", value: rows.filter((row) => /selection/i.test(clean(row["Stage Needed"]))).length }
          : { label: "Priority records", value: rows.length };
  const muted = darkMode ? "text-white/50" : "text-black/45";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      {sheetName === "Dashboard" ? <DashboardSummary darkMode={darkMode} rows={rows} /> : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric darkMode={darkMode} icon={ClipboardList} label={meta?.title || "Records"} value={rows.length.toLocaleString()} accent={COLORS[0]} />
            <Metric darkMode={darkMode} icon={Building2} label={meta?.group || "Groups"} value={primaryGroups.length.toLocaleString()} accent={COLORS[1]} />
            <Metric darkMode={darkMode} icon={UsersRound} label={meta?.owner || "Owners"} value={ownerGroups.length.toLocaleString()} accent={COLORS[2]} />
            <Metric darkMode={darkMode} icon={PackageSearch} label={meta?.value ? "Linked activities" : "Procurement flags"} value={(meta?.value ? linkedActivities : pendingProcurement).toLocaleString()} accent={COLORS[3]} />
            <Metric darkMode={darkMode} icon={CalendarDays} label={fifthMetric.label} value={fifthMetric.value.toLocaleString()} accent={COLORS[4]} />
          </div>
          <div className="mb-5 grid gap-4 xl:grid-cols-2">
            <Bars darkMode={darkMode} title={`${meta?.value ? "Workload" : "Records"} by ${meta?.group || "group"}`} data={primaryGroups} />
            <Bars darkMode={darkMode} title={`Records by ${meta?.owner || "owner"}`} data={ownerGroups} />
          </div>
          <RecordCards darkMode={darkMode} rows={rows} sheetName={sheetName} headers={headers} />
        </>
      )}

      <div className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{sheetName} data</h3>
            <p className={`mt-1 text-xs ${muted}`}>{rows.length.toLocaleString()} visible rows</p>
          </div>
          <Table2 className={`h-4 w-4 ${muted}`} />
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                {headers.map((header) => <th key={header} className={`whitespace-nowrap px-5 py-3 text-left font-medium ${muted}`}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row) => (
                <tr key={`${row.__sheetName}-${row.__rowIndex}`} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                  {headers.map((header) => {
                    const value = clean(row[header]);
                    const url = value.match(/^https?:\/\/\S+$/)?.[0];
                    return (
                      <td key={header} className={`min-w-[150px] max-w-[360px] px-5 py-3 align-top ${darkMode ? "text-white/75" : "text-black/65"}`}>
                        {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><ArrowUpRight className="h-3 w-3" /> Open</a> : value || "N/A"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
