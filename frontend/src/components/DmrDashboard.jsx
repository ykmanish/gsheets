"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, FileSpreadsheet, Filter, History, Loader2, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { DatePicker, SelectMenu } from "./ui";

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
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

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
    ? darkMode ? "bg-emerald-400/10 text-emerald-200 border-emerald-400/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
    : darkMode ? "bg-red-400/10 text-red-200 border-red-400/20" : "bg-red-50 text-red-700 border-red-200";
}

function WorkloadBars({ title, items = [], darkMode }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items.slice(0, 8);
  const max = Math.max(1, ...chartItems.map((item) => Math.max(Number(item.planned) || 0, Number(item.actual) || 0)));
  const totalActual = chartItems.reduce((sum, item) => sum + (Number(item.actual) || 0), 0);
  const totalPlanned = chartItems.reduce((sum, item) => sum + (Number(item.planned) || 0), 0);
  return (
    <section className={`min-w-0 overflow-hidden rounded-[28px]  p-5 ${darkMode ? "border-white/10 bg-[#111216]" : "border-[#dfe5e9] bg-white"}`}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Live DMR</p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
          <p className={`mt-2 text-xs ${muted}`}>{totalActual} actual / {totalPlanned} planned</p>
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
          const plannedHeight = Math.max(8, (Math.max(planned, actual) / max) * 100);
          const actualHeight = actual ? Math.max(8, (actual / max) * 100) : 0;
          return (
            <div key={item.label} className="flex min-w-[52px] flex-1 flex-col items-center">
              <div className="mb-2 min-h-9 text-center">
                <p className={`text-sm font-semibold ${darkMode ? "text-white" : ""}`}>{actual}</p>
                <p className={`text-[10px] ${muted}`}>/{planned}</p>
              </div>
              <div className="flex h-36 w-full max-w-[40px] items-end">
                <div className={`relative h-full w-full overflow-hidden rounded-t-[18px] rounded-b-md ${darkMode ? "bg-[#24262b]" : "bg-[#ece9e2]"}`}>
                  <div className={`absolute bottom-0 left-0 right-0 rounded-t-[18px] ${darkMode ? "bg-[#3a3d42]" : "bg-[#ece9e2]"}`} style={{ height: `${plannedHeight}%` }} />
                  <div className="absolute bottom-0 left-0 right-0 rounded-t-[18px] bg-[#15a8e0]" style={{ height: `${actualHeight}%` }} />
                </div>
              </div>
              <p className={`mt-3 line-clamp-2 min-h-8 text-center text-[11px] leading-4 ${muted}`}>{item.label}</p>
            </div>
          );
        })}
        {!chartItems.length && <p className={`flex flex-1 items-center justify-center py-8 text-center text-sm ${muted}`}>No DMR data available yet.</p>}
      </div>
    </section>
  );
}

function TomorrowSiteBars({ items = [], darkMode, title = "Site-wise planned manpower", emptyText = "No plan data available yet." }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const chartItems = items.slice(0, 8);
  const max = Math.max(1, ...chartItems.map((item) => Math.max(Number(item.plannedManpower) || 0, Number(item.actualManpower) || 0)));
  const total = items.reduce((sum, item) => sum + (Number(item.plannedManpower) || 0), 0);
  const totalActual = items.reduce((sum, item) => sum + (Number(item.actualManpower) || 0), 0);
  return (
    <section className={`min-w-0 overflow-hidden rounded-[28px] p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.07] bg-white"}`}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Plan overview</p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
          <p className={`mt-2 text-xs ${muted}`}>{totalActual} actual / {total} planned across {items.length} site{items.length === 1 ? "" : "s"}</p>
        </div>
        <div className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] ${muted}`}>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8d939b]" /> Planned</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#54d39f]" /> Actual ok</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" /> Attention</span>
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
            <div key={item.site} className="flex min-w-[64px] flex-1 flex-col items-center">
              <div className="mb-2 min-h-9 text-center">
                <p className={`text-sm font-semibold ${status.ok ? "text-emerald-500" : "text-red-500"}`}>{actual}</p>
                <p className={`text-[10px] ${muted}`}>/{value}</p>
              </div>
              <div className="flex h-36 w-full max-w-[46px] items-end">
                <div className={`relative h-full w-full overflow-hidden rounded-t-[18px] rounded-b-md ${darkMode ? "bg-[#24262b]" : "bg-[#ece9e2]"}`}>
                  <div className={`absolute bottom-0 left-0 right-0 rounded-t-[18px] ${darkMode ? "bg-white/20" : "bg-[#8d939b]/25"}`} style={{ height: `${plannedHeight}%` }} />
                  <div className={`absolute bottom-0 left-1 right-1 rounded-t-[14px] ${status.ok ? "bg-[#54d39f]" : "bg-red-500"}`} style={{ height: `${actualHeight}%` }} />
                </div>
              </div>
              <p className={`mt-3 line-clamp-2 min-h-8 text-center text-[11px] leading-4 ${muted}`}>{item.site}</p>
            </div>
          );
        })}
        {!chartItems.length && <p className={`flex flex-1 items-center justify-center py-8 text-center text-sm ${muted}`}>{emptyText}</p>}
      </div>
    </section>
  );
}

function PlanCeoView({ activePlan, activePlanTitle, activeTomorrowSite, tomorrowPlanSites = [], darkMode }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const line = darkMode ? "border-white/10" : "border-black/[0.07]";
  const head = darkMode ? "bg-white/[0.04] text-white/55" : "bg-black/[0.035] text-black/55";
  const rowHover = darkMode ? "hover:bg-white/[0.035]" : "hover:bg-black/[0.025]";
  const totalPlanned = activeTomorrowSite?.plannedManpower ?? activePlan?.summary?.plannedManpower ?? 0;
  const totalActual = activeTomorrowSite?.actualManpower ?? activePlan?.actuals?.actualManpower ?? 0;
  const totalStatus = planActualStatus(totalPlanned, totalActual);
  const detailRecords = (activeTomorrowSite?.records || activePlan?.records || []).slice().sort((a, b) => {
    const peopleA = a.plannedManpower !== null && a.plannedManpower !== undefined ? Number(a.plannedManpower) || 0 : -1;
    const peopleB = b.plannedManpower !== null && b.plannedManpower !== undefined ? Number(b.plannedManpower) || 0 : -1;
    return peopleB - peopleA || String(a.site || "").localeCompare(String(b.site || "")) || String(a.category || "").localeCompare(String(b.category || ""));
  });
  const visibleSites = activeTomorrowSite ? [activeTomorrowSite] : tomorrowPlanSites;
  const attentionCount = visibleSites.filter((site) => !planActualStatus(site.plannedManpower, site.actualManpower).ok).length;

  return (
    <div className="space-y-4 transition-all duration-300 ease-out">
      <section className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}>
        <div className={`grid gap-px ${darkMode ? "bg-white/10" : "bg-black/[0.06]"} sm:grid-cols-4`}>
          {[
            ["Planned", totalPlanned],
            ["Actual", totalActual],
            ["Variance", `${totalStatus.variance >= 0 ? "+" : ""}${totalStatus.variance}`],
            ["Needs attention", attentionCount],
          ].map(([label, value]) => (
            <div key={label} className={`px-5 py-4 ${darkMode ? "bg-[#111216]" : "bg-white"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}>{label}</p>
              <p className="mt-1 text-3xl font-semibold leading-none">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {!activeTomorrowSite && (
        <section className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}>
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}>CEO summary</p>
              <h4 className="mt-1 text-lg font-semibold">{activePlanTitle} by site</h4>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{visibleSites.length} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className={head}>
                <tr>
                  {["Site", "Planned", "Actual", "Variance", "Status", "Work items", "Submitters"].map((header) => (
                    <th key={header} className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleSites.map((site) => {
                  const status = planActualStatus(site.plannedManpower, site.actualManpower);
                  return (
                    <tr key={site.site} className={`border-t ${line} ${rowHover}`}>
                      <td className="max-w-[240px] px-5 py-3 font-semibold">{site.site}</td>
                      <td className="px-5 py-3 text-xl font-semibold">{status.planned}</td>
                      <td className={`px-5 py-3 text-xl font-semibold ${status.ok ? "text-emerald-600" : "text-red-600"}`}>{status.actual}</td>
                      <td className={`px-5 py-3 font-semibold ${status.ok ? "text-emerald-600" : "text-red-600"}`}>{status.variance >= 0 ? "+" : ""}{status.variance}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full  px-3 py-1 text-xs ${planStatusTone(status, darkMode)}`}>
                          {status.ok ? "On track" : "Needs attention"}
                        </span>
                      </td>
                      <td className="px-5 py-3">{site.records.length}</td>
                      <td className={`max-w-[240px] truncate px-5 py-3 ${muted}`}>{site.submitters.join(", ") || "Unknown"}</td>
                    </tr>
                  );
                })}
                {!visibleSites.length && (
                  <tr><td colSpan={7} className={`px-5 py-8 text-center ${muted}`}>No plan data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}>Work plan</p>
            <h4 className="mt-1 text-lg font-semibold">{activeTomorrowSite?.site || "All sites"}</h4>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>{detailRecords.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className={head}>
              <tr>
                {["Site", "Trade", "People", "Work planned", "By", "Timestamp"].map((header) => (
                  <th key={header} className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em]">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailRecords.map((record) => (
                <tr key={record.id} className={`border-t align-top ${line} ${rowHover}`}>
                  <td className="max-w-[200px] px-5 py-3 font-semibold">{record.site || "Unassigned"}</td>
                  <td className="px-5 py-3">{record.category || "General"}</td>
                  <td className="px-5 py-3 text-lg font-semibold">{record.plannedManpower ?? "-"}</td>
                  <td className="max-w-[420px] px-5 py-3 leading-6">{record.work || record.raw || "No work note added."}</td>
                  <td className={`max-w-[160px] px-5 py-3 ${muted}`}>{record.submittedBy || "Unknown"}</td>
                  <td className={`whitespace-nowrap px-5 py-3 ${muted}`}>{record.timestamp || record.submittedDate || "-"}</td>
                </tr>
              ))}
              {!detailRecords.length && (
                <tr><td colSpan={6} className={`px-5 py-8 text-center ${muted}`}>No work items available.</td></tr>
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
  const [pendingRows, setPendingRows] = useState({ equipment: [], materials: [], notes: [] });
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

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-[#dfe5e9] bg-white";
  const dmrSheetLinked = Boolean(data?.dmrSettings?.linked);
  const canFillDmr = Boolean(data?.canEdit && dmrSheetLinked);

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const result = await api(`/dmr-dashboard?date=${encodeURIComponent(date)}`);
      setData(result);
      setDrafts({});
      setPendingRows({ equipment: [], materials: [], notes: [] });
    } catch (error) {
      toast.error(error.message || "Could not load DMR");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const records = useMemo(() => data?.today?.records || [], [data?.today?.records]);
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

  const filteredRecords = useMemo(() => {
    const query = agencySearch.trim().toLowerCase();
    return records.filter((record) => {
      if (siteFilter !== "all" && record.site !== siteFilter) return false;
      if (query && !record.agency.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [agencySearch, records, siteFilter]);

  const projectManpowerCards = useMemo(() => {
    const query = agencySearch.trim().toLowerCase();
    return [...records.reduce((result, record) => {
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
    }, new Map()).values()]
      .map((project) => ({
        ...project,
        agencies: [...project.agencies].sort((a, b) => a.localeCompare(b)),
        progress: project.planned ? Math.min(100, Math.round((project.actual / project.planned) * 100)) : project.actual ? 100 : 0,
      }))
      .filter((project) => {
        if (!query) return true;
        return project.site.toLowerCase().includes(query) || project.agencies.some((agency) => agency.toLowerCase().includes(query));
      })
      .sort((a, b) => b.actual - a.actual || b.planned - a.planned || a.site.localeCompare(b.site));
  }, [agencySearch, records, siteFilter]);

  const activePlan = planMode === "today" ? data?.todayPlan || null : data?.tomorrowPlan || null;
  const activePlanTitle = planMode === "today" ? "Today’s Plan" : "Tomorrow’s Plan";
  const activePlanHeading = planMode === "today" ? "Today’s manpower & work plan" : "Next day manpower & work plan";
  const activePlanSummaryText = planMode === "today"
    ? "Total planned manpower scheduled for the selected DMR date."
    : "Total planned manpower extracted for the next DMR date.";
  const tomorrowPlanSites = useMemo(() => {
    const records = activePlan?.records || [];
    const actualBySite = new Map((activePlan?.actuals?.siteBreakdown || []).map((item) => [comparablePlanText(item.site), Number(item.actual) || 0]));
    return [...records.reduce((result, record) => {
      const site = record.site || "Unassigned site";
      const item = result.get(site) || { site, records: [], plannedManpower: 0, actualManpower: 0, variance: 0, categories: new Set(), submitters: new Set() };
      item.records.push(record);
      item.plannedManpower += Number(record.plannedManpower) || 0;
      if (record.category) item.categories.add(record.category);
      if (record.submittedBy) item.submitters.add(record.submittedBy);
      result.set(site, item);
      return result;
    }, new Map()).values()]
      .map((site) => {
        const actualManpower = actualBySite.get(comparablePlanText(site.site)) || 0;
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
        return Number(statusA.ok) - Number(statusB.ok) || b.plannedManpower - a.plannedManpower || b.records.length - a.records.length || a.site.localeCompare(b.site);
      });
  }, [activePlan?.actuals?.siteBreakdown, activePlan?.records]);
  const activeTomorrowSite = useMemo(() => {
    return selectedTomorrowSite ? tomorrowPlanSites.find((site) => site.site === selectedTomorrowSite) || null : null;
  }, [selectedTomorrowSite, tomorrowPlanSites]);
  const activePlanStatus = planActualStatus(activePlan?.summary?.plannedManpower || 0, activePlan?.actuals?.actualManpower || 0);
  const attentionPlanSites = tomorrowPlanSites.filter((site) => !planActualStatus(site.plannedManpower, site.actualManpower).ok);
  const activePlanTimeliness = activePlan?.timelinessBySubmitter || [];
  const hasDraftKey = (record, key) => Object.prototype.hasOwnProperty.call(drafts[record.id] || {}, key);
  const autoPlannedForRecord = (record) => {
    if (!canFillDmr || !todayPlanLookup.size || hasDraftKey(record, "planned") || Number(record.planned) > 0) return "";
    const key = `${comparablePlanText(record.site)}|${comparableTradeText(record.agency)}`;
    return todayPlanLookup.get(key) || "";
  };
  const hasAutoPlannedDrafts = records.some((record) => autoPlannedForRecord(record));
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
        const existingIndex = draftValues.findIndex((item) => item.id === record.id);
        const autoUpdate = {
          id: record.id,
          rowNumber: record.rowNumber,
          plannedColumn: record.plannedColumn,
          actualColumn: record.actualColumn,
          planned: autoPlanned,
          actual: drafts[record.id]?.actual ?? record.actual,
        };
        if (existingIndex >= 0) {
          draftValues[existingIndex] = { ...draftValues[existingIndex], ...autoUpdate };
        } else {
          draftValues.push(autoUpdate);
        }
      }
      const newRows = draftValues.filter((item) => String(item.id || "").startsWith("temp:"));
      const existingUpdates = draftValues.filter((item) => !String(item.id || "").startsWith("temp:"));
      for (const row of newRows) {
        await api("/dmr-dashboard/section-row", {
          method: "POST",
          body: JSON.stringify({ date, section: row.section, values: row, submissionId }),
        });
      }
      if (existingUpdates.length) {
        await api("/dmr-dashboard", {
          method: "PATCH",
          body: JSON.stringify({ date, updates: existingUpdates, submissionId }),
        });
      }
      toast.success("DMR saved to Google Sheet");
      setFillOpen(false);
      await load(true);
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
      setData((current) => current ? { ...current, dmrSettings: result.settings } : current);
      setDmrSheetLink("");
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not link DMR sheet");
    } finally {
      setDmrSheetSaving(false);
    }
  }

  async function unlinkDmrSheet() {
    if (!window.confirm("Unlink the current DMR sheet? Existing Google Sheet data will not be deleted.")) return;
    try {
      setDmrSheetSaving(true);
      const result = await api("/dmr-dashboard/settings", { method: "DELETE" });
      toast.success("DMR sheet unlinked");
      setData((current) => current ? { ...current, dmrSettings: result.settings } : current);
      await load(true);
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
      const result = await api(`/dmr-dashboard/history?date=${encodeURIComponent(date)}&limit=150`);
      setHistoryItems(result.history || []);
      setSelectedHistory(null);
    } catch (error) {
      toast.error(error.message || "Could not load DMR history");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistory() {
    setHistoryOpen(true);
    void loadHistory();
  }

  const attendanceSummary = useMemo(() => {
    const rows = data?.today?.staffAttendance || [];
    return rows.reduce((result, item) => {
      const status = String(item.status || "").trim().toLowerCase();
      if (status === "p") result.present += 1;
      else if (status === "a") result.absent += 1;
      else result.pending += 1;
      return result;
    }, { present: 0, absent: 0, pending: 0, total: rows.length });
  }, [data?.today?.staffAttendance]);

  const sectionCards = useMemo(() => {
    const equipment = (data?.today?.equipment || []).filter((item) => item.site || item.details || item.quantity);
    const materials = (data?.today?.materials || []).filter((item) => item.site || item.details || item.unit || item.quantity);
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
        soft: darkMode ? "bg-[#ff7a2f]/10 text-orange-200" : "bg-orange-50 text-orange-700",
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
        soft: darkMode ? "bg-[#f2c94c]/10 text-yellow-200" : "bg-yellow-50 text-yellow-700",
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
        soft: darkMode ? "bg-[#63d5bd]/10 text-teal-200" : "bg-teal-50 text-teal-700",
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
        soft: darkMode ? "bg-[#15a8e0]/10 text-sky-200" : "bg-sky-50 text-sky-700",
        count: staff.filter((item) => String(item.status || "").trim()).length,
        items: staff,
      },
    ];
  }, [attendanceSummary, darkMode, data?.today?.equipment, data?.today?.materials, data?.today?.notes, data?.today?.staffAttendance]);

  const activeDetail = sectionCards.find((item) => item.id === detailSection);
  const fillEquipmentRows = [...(data?.today?.equipment || []), ...(pendingRows.equipment || [])];
  const fillMaterialRows = [...(data?.today?.materials || []), ...(pendingRows.materials || [])];
  const fillNoteRows = [...(data?.today?.notes || []), ...(pendingRows.notes || [])];
  const fillAttendanceSummary = (data?.today?.staffAttendance || []).reduce((result, item) => {
    const status = String(valueFor(item, "status") || "").trim().toLowerCase();
    if (status === "p") result.present += 1;
    else if (status === "a") result.absent += 1;
    else result.pending += 1;
    return result;
  }, { present: 0, absent: 0, pending: 0 });

  if (loading) {
    return (
      <div className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
        <div className={`w-full max-w-2xl rounded-[30px]  p-7 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}>
          <div className="flex items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span className={`absolute inset-0 animate-ping rounded-full opacity-20 ${darkMode ? "bg-[#d8f36a]" : "bg-black"}`} />
              <span className={`absolute inset-1 animate-pulse rounded-full ${darkMode ? "bg-[#d8f36a]/15" : "bg-black/[0.06]"}`} />
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                <FileSpreadsheet className="h-5 w-5" />
              </span>
            </span>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>DMR workspace</p>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
                Opening today&apos;s live manpower sheet
                <span className="inline-flex items-center gap-1 pt-1" aria-hidden="true">
                  <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
                  <span className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:120ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
                  <span className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:240ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
                </span>
              </h2>
              <p className={`mt-2 text-sm ${muted}`}>If today&apos;s tab is missing, it will be created automatically from the latest DMR format.</p>
            </div>
          </div>
          <div className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>
            <div className={`h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
      <div className="mx-auto w-full">
        <div className={`mb-8 rounded-[30px] p-6 sm:p-8 ${darkMode ? "bg-[#151612]" : "bg-[#ebe6dc]"}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/65" : "bg-white/55 text-black/60"}`}><FileSpreadsheet className="h-3.5 w-3.5" /> Projects · DMR</span>
              <h2 className="mt-5 text-4xl font-semibold small tracking-tight">Daily manpower, made simple.</h2>
              <p className={`mt-2 max-w-4xl text-sm leading-6 ${muted}`}>Live planned vs actual attendance across all sites and agencies. Fill today&apos;s DMR without touching spreadsheet cells.</p>
            </div>
            <div className="relative z-20 flex shrink-0 flex-col gap-3 lg:items-end">
              <div className="flex flex-nowrap items-center gap-2">
                <button onClick={() => { setFillTab("manpower"); setFillOpen(true); }} className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-5 text-sm font-medium ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}><CalendarDays className="h-4 w-4" /> Fill DMR</button>
                <button onClick={() => { setSelectedTomorrowSite(""); setPlanMode("today"); }} className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border px-5 text-sm font-medium ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-black/[0.03]"}`}><FileSpreadsheet className="h-4 w-4" /> Today&apos;s Plan</button>
                <button onClick={() => { setSelectedTomorrowSite(""); setPlanMode("tomorrow"); }} className="flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-[#9381ff] bg-[#9381ff] px-5 text-sm font-medium text-white hover:bg-[#8572f5]"><FileSpreadsheet className="h-4 w-4" /> Tomorrow&apos;s Plan</button>
              </div>
              <div className="flex flex-nowrap items-center gap-2">
                <DatePicker darkMode={darkMode} value={date} onChange={setDate} placeholder="Choose DMR date" />
                <button onClick={() => load(true)} disabled={refreshing} className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border px-4 text-sm font-medium ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-black/[0.03]"}`}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
                {data?.canViewHistory && <button onClick={openHistory} className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border px-4 text-sm font-medium ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-black/[0.03]"}`}><History className="h-4 w-4" /> History</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <WorkloadBars title="Site-wise actual manpower" items={data?.today?.siteBreakdown || []} darkMode={darkMode} />
          <WorkloadBars title="Top agencies today" items={data?.today?.agencyBreakdown || []} darkMode={darkMode} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-4">
          {sectionCards.map((card) => (
            <button key={card.id} type="button" onClick={() => setDetailSection(card.id)} className={`group relative min-h-44 rounded-[28px]  p-5 text-left transition ${panel}`}>
              <span className={`absolute left-6 right-6 top-0 h-1 rounded-full ${card.count ? "bg-[#15a8e0]" : darkMode ? "bg-white/10" : "bg-black/[0.06]"}`} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>{card.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-semibold">{card.title}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${card.count ? "bg-emerald-500/10 text-emerald-700" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}>
                  {card.count ? "Added" : "Empty"}
                </span>
              </div>
              <p className={`mt-6 line-clamp-2 text-sm leading-6 ${muted}`}>{card.hint}</p>
              <p className={`mt-5 text-xs font-medium ${darkMode ? "text-[#d8f36a]" : "text-[#171714]"} opacity-70 group-hover:opacity-100`}>Click to view details</p>
            </button>
          ))}
        </div>

        <section className={`mt-5 rounded-[28px]  p-5 ${panel}`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Project manpower</p>
              <h3 className="mt-2 text-xl font-semibold">{data?.sheetName || "Today"} · {projectManpowerCards.length} project sites</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SelectMenu darkMode={darkMode} value={siteFilter} onChange={setSiteFilter} options={[{ value: "all", label: "All sites" }, ...(data?.today?.sites || []).map((site) => ({ value: site, label: site }))]} />
              <label className="relative block">
                <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                <input value={agencySearch} onChange={(event) => setAgencySearch(event.target.value)} placeholder="Search site or agency…" className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none sm:w-64 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`} />
              </label>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projectManpowerCards.map((project) => (
              <button key={project.id} type="button" onClick={() => setSelectedProject(project)} className={`group  flex min-h-80 flex-col rounded-[28px] border p-5 text-left transition ${darkMode ? "border-white/10 bg-[#111216] hover:bg-white/[0.04]" : "border-black/[0.07] bg-white hover:bg-[#fbfaf7]"}`}>
                <div className="flex items-start justify-between gap-3 border-b pb-5 border-black/[0.06] dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"}`}>
                      <FileSpreadsheet className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${muted}`}>In production</p>
                      <h4 className="mt-1 truncate text-xl font-semibold">{project.site}</h4>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] ${project.variance < 0 ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}>{project.variance >= 0 ? "+" : ""}{project.variance}</span>
                </div>

                <div className="mt-5">
                  <p className={`text-sm ${muted}`}>Note: {project.agencies.slice(0, 3).join(", ") || "No agencies filled yet"}{project.agencies.length > 3 ? ` +${project.agencies.length - 3}` : ""}</p>
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
                        { label: "Planned", value: planned, color: "bg-[#ff7a2f]" },
                        { label: "Actual", value: actual, color: "bg-[#f2c94c]" },
                        { label: "Variance", value: variance, color: "bg-[#63d5bd]" },
                      ].map((segment) => (
                        <span
                          key={segment.label}
                          className={`${segment.color} mr-1 last:mr-0 last:rounded-r-full first:rounded-l-full`}
                          style={{ width: `${Math.max(segment.value ? 10 : 4, (segment.value / total) * 100)}%` }}
                        />
                      ));
                    })()}
                  </div>
                  <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] ${muted}`}>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#ff7a2f]" /> Planned</span>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f2c94c]" /> Actual</span>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#63d5bd]" /> Variance</span>
                  </div>
                </div>

                <div className="mt-5 pb-2">
                  <p className="text-sm font-semibold">Active agencies</p>
                  <div className="mt-3 flex items-center">
                    {project.agencies.slice(0, 5).map((agency, index) => (
                      <span key={agency} title={agency} className={`-ml-2 first:ml-0 grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-semibold ${darkMode ? "border-[#111216] bg-white/10 text-white" : "border-white bg-[#f4f0e8] text-black"}`}>
                        {agency.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || index + 1}
                      </span>
                    ))}
                    <span className={`ml-3 rounded-full px-3 py-2 text-xs font-medium ${darkMode ? "bg-white/5 text-white/60" : "bg-[#f4f0e8] text-black/60"}`}>{project.agencies.length} agencies</span>
                  </div>
                </div>

                <div className={`mt-auto grid grid-cols-3 gap-2 border-t pt-4 text-xs ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                  <div><p className="font-semibold">{project.planned}</p><p className={muted}>Planned</p></div>
                  <div><p className="font-semibold">{project.actual}</p><p className={muted}>Actual</p></div>
                  <div className="text-right"><span className={`inline-flex rounded-full px-3 py-2 font-semibold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>View</span></div>
                </div>
              </button>
            ))}
            {!projectManpowerCards.length && <div className={`rounded-[24px] border px-4 py-10 text-center text-sm md:col-span-2 xl:col-span-3 ${darkMode ? "border-white/10 bg-white/[0.025] text-white/45" : "border-black/[0.06] bg-white text-black/45"}`}>No project manpower found for the selected filters.</div>}
          </div>
        </section>
      </div>

      {planMode && (
        <div className={`fixed inset-0 z-50 flex ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f7f5ef] text-[#171714]"}`}>
          <div className="flex h-screen w-screen flex-col overflow-hidden">
            <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
              <div className="flex min-w-0 items-start gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-[#ebe6dc] text-[#171714]"}`}>
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>{activePlanTitle}</p>
                  <h3 className="mt-2 truncate text-3xl font-semibold">{activePlanHeading}</h3>
                  <p className={`mt-1 text-sm ${muted}`}>
                    {activePlan?.selectedDate || activePlan?.requestedDate || date} · {activePlan?.summary?.records || 0} planned work item{activePlan?.summary?.records === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCeoPlanView((value) => !value)}
                  className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-300 ${ceoPlanView ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black shadow-lg shadow-[#d8f36a]/10" : "border-[#171714] bg-[#171714] text-white shadow-lg shadow-black/10" : darkMode ? "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/10" : "border-black/10 bg-white text-black/65 hover:bg-black/[0.03]"}`}
                >
                  CEO&apos;s View
                </button>
                <button onClick={() => { setPlanMode(null); setSelectedTomorrowSite(""); }} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              {activePlan?.error && (
                <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${darkMode ? "border-red-400/20 bg-red-400/5 text-red-200" : "border-red-500/20 bg-red-50 text-red-700"}`}>
                  Could not load {activePlanTitle} sheet: {activePlan.error}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className={`rounded-[28px] border p-3 lg:sticky lg:top-0 lg:self-start ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                  <p className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Plan menu</p>
                  <div role="tablist" aria-label={`${activePlanTitle} menu`} className="space-y-2">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={!activeTomorrowSite}
                      onClick={() => setSelectedTomorrowSite("")}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${!activeTomorrowSite ? darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white" : darkMode ? "text-white/65 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"}`}
                    >
                      <span className="">Overview</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${!activeTomorrowSite ? "bg-black/10 text-inherit" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}>{activePlan?.summary?.plannedManpower || 0}</span>
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
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${selected ? darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white" : darkMode ? "text-white/65 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"}`}
                        >
                          <span className="truncate ">{site.site}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${selected ? "bg-black/10 text-inherit" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}>{site.plannedManpower}</span>
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
                      <section className={`rounded-[28px]  p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.07] bg-white"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold">{activePlanTitle} manpower summary</p>
                            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                              <div>
                                <p className="text-6xl font-semibold leading-none">{activePlanStatus.planned}</p>
                                <p className={`mt-1 text-xs ${muted}`}>planned</p>
                              </div>
                              <div>
                                <p className={`text-5xl font-semibold leading-none ${activePlanStatus.ok ? "text-emerald-500" : "text-red-500"}`}>{activePlanStatus.actual}</p>
                                <p className={`mt-1 text-xs ${muted}`}>actual</p>
                              </div>
                              <span className={`mb-2 rounded-full border px-3 py-1 text-sm font-semibold ${planStatusTone(activePlanStatus, darkMode)}`}>
                                {activePlanStatus.ok ? "On track" : "Needs attention"}
                              </span>
                            </div>
                            <p className={`mt-3 text-sm ${muted}`}>{activePlanSummaryText}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>Live sheet</span>
                        </div>
                        <div className={`mt-5 h-3 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>
                          <div className={`h-full rounded-full ${activePlanStatus.ok ? "bg-[#54d39f]" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.max(4, (activePlanStatus.actual / Math.max(1, activePlanStatus.planned)) * 100))}%` }} />
                        </div>
                        <div className={`mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                          <div>
                            <p className={`text-3xl font-semibold ${activePlanStatus.ok ? "text-emerald-500" : "text-red-500"}`}>{activePlanStatus.variance >= 0 ? "+" : ""}{activePlanStatus.variance}</p>
                            <p className={muted}>variance</p>
                          </div>
                          <div>
                            <p className="text-3xl font-semibold">{activePlan?.summary?.sites || 0}</p>
                            <p className={muted}>sites</p>
                          </div>
                          <div>
                            <p className={`text-3xl font-semibold ${attentionPlanSites.length ? "text-red-500" : "text-emerald-500"}`}>{attentionPlanSites.length}</p>
                            <p className={muted}>attention</p>
                          </div>
                        </div>
                        <div className={`mt-4 rounded-2xl  p-4 ${attentionPlanSites.length ? darkMode ? "border-red-400/20 bg-red-400/5" : "border-red-200 bg-red-50" : darkMode ? "border-emerald-400/20 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className={`text-sm font-semibold ${attentionPlanSites.length ? darkMode ? "text-red-200" : "text-red-700" : darkMode ? "text-emerald-200" : "text-emerald-700"}`}>
                              What needs attention
                            </p>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attentionPlanSites.length ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                              {attentionPlanSites.length ? `${attentionPlanSites.length} site${attentionPlanSites.length === 1 ? "" : "s"}` : "Clear"}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {(attentionPlanSites.length ? attentionPlanSites.slice(0, 4) : tomorrowPlanSites.slice(0, 3)).map((site) => {
                              const status = planActualStatus(site.plannedManpower, site.actualManpower);
                              return (
                                <div key={site.site} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${darkMode ? "bg-black/15" : "bg-white/70"}`}>
                                  <span className="truncate font-medium">{site.site}</span>
                                  <span className={`shrink-0 font-semibold ${status.ok ? "text-emerald-600" : "text-red-600"}`}>{status.actual}/{status.planned}</span>
                                </div>
                              );
                            })}
                            {!tomorrowPlanSites.length && <p className={`text-sm ${muted}`}>No plan sites available yet.</p>}
                          </div>
                        </div>
                        {planMode === "tomorrow" && (
                          <div className={`mt-4 rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-black/[0.025]"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">Submission timing</p>
                                <p className={`mt-1 text-xs ${muted}`}>Cutoff: 11:30 AM IST</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!activePlanTimeliness.length ? darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55" : activePlanTimeliness.some((item) => item.status === "delayed") ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                                {!activePlanTimeliness.length ? "No submissions" : activePlanTimeliness.some((item) => item.status === "delayed") ? "Delayed found" : "On time"}
                              </span>
                            </div>
                            <div className="mt-3 space-y-2">
                              {activePlanTimeliness.map((item) => {
                                const delayed = item.status === "delayed";
                                return (
                                  <div key={item.name} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${darkMode ? "bg-black/15" : "bg-white/75"}`}>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{item.name}</p>
                                      <p className={`mt-0.5 truncate text-[11px] ${muted}`}>{item.records} entr{item.records === 1 ? "y" : "ies"}{item.lastSubmittedAt ? ` · ${item.lastSubmittedAt}` : ""}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${delayed ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                                      {delayed ? "Delayed" : "On time"}
                                    </span>
                                  </div>
                                );
                              })}
                              {!activePlanTimeliness.length && <p className={`text-sm ${muted}`}>No submissions found yet.</p>}
                            </div>
                          </div>
                        )}
                      </section>

                      <TomorrowSiteBars items={tomorrowPlanSites} darkMode={darkMode} title={`${activePlanTitle} by site`} emptyText={`No ${activePlanTitle.toLowerCase()} data available yet.`} />
                    </div>
                  ) : (
                    <article className={`rounded-[32px]  p-6 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Selected project site</p>
                          <h4 className="mt-2 text-3xl font-semibold">{activeTomorrowSite.site}</h4>
                          <p className={`mt-2 text-sm ${muted}`}>{activeTomorrowSite.submitters.join(", ") || "No submitter"} · {activeTomorrowSite.categories.length} trade categor{activeTomorrowSite.categories.length === 1 ? "y" : "ies"}</p>
                        </div>
                        <div className={`rounded-[24px] border px-5 py-4 text-right ${planStatusTone(planActualStatus(activeTomorrowSite.plannedManpower, activeTomorrowSite.actualManpower), darkMode)}`}>
                          <p className="text-4xl font-semibold leading-none">{activeTomorrowSite.actualManpower}/{activeTomorrowSite.plannedManpower}</p>
                          <p className="mt-1 text-xs opacity-70">actual / planned</p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {activeTomorrowSite.records.slice().sort((a, b) => {
                          const peopleA = a.plannedManpower !== null && a.plannedManpower !== undefined ? Number(a.plannedManpower) || 0 : -1;
                          const peopleB = b.plannedManpower !== null && b.plannedManpower !== undefined ? Number(b.plannedManpower) || 0 : -1;
                          return peopleB - peopleA || String(a.category || "").localeCompare(String(b.category || ""));
                        }).map((record) => {
                          const people = record.plannedManpower !== null && record.plannedManpower !== undefined ? Number(record.plannedManpower) || 0 : null;
                          const totalPlanned = Number(activeTomorrowSite.plannedManpower) || 0;
                          const progress = people === null || totalPlanned <= 0 ? null : Math.min(100, Math.max(0, (people / totalPlanned) * 100));
                          return (
                            <section key={record.id} className={`flex min-h-72 flex-col overflow-hidden rounded-[28px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-[#fbfaf7]"}`}>
                              <div className={`border-b px-5 py-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#ffb000]">
                                      <span className="h-3 w-3 rounded bg-white/80" />
                                    </span>
                                    <h5 className="truncate text-lg font-semibold">{record.category}</h5>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/60"}`}>{record.submittedBy || "Unknown"}</span>
                                </div>
                              </div>
                              <div className="flex flex-1 flex-col p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className={`text-xs ${muted}`}>Planned manpower</p>
                                    <p className={`mt-1 text-5xl font-semibold leading-none ${people === null ? muted : ""}`}>{people ?? "—"}</p>
                                  </div>
                                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${people !== null ? "bg-emerald-500/10 text-emerald-700" : darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45"}`}>
                                    {people !== null ? `${people} people` : "Text only"}
                                  </span>
                                </div>
                                <p className="mt-5 line-clamp-3 text-lg leading-7">{record.work || record.raw || "No work note added."}</p>
                                <div className="mt-5">
                                  <div className="mb-2 flex items-center justify-between text-sm">
                                    <span className="font-semibold">Share of site manpower</span>
                                    <span className="font-semibold">{progress === null ? "—" : `${Math.round(progress)}%`}</span>
                                  </div>
                                  <div className={`h-3 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.07]"}`}>
                                    <div className="h-full rounded-full bg-[#15a8e0]" style={{ width: `${progress || 0}%` }} />
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

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
          <div className={`flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[34px] ${darkMode ? "border border-white/10 bg-[#111216] text-white" : "border border-black/10 bg-[#f7f5ef] text-[#171714]"}`}>
            <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
              <div className="flex min-w-0 items-start gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"}`}>
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Project manpower</p>
                  <h3 className="mt-2 truncate text-3xl small text-black dark:text-white font-semibold">{selectedProject.site}</h3>
                  <p className={`mt-1 text-sm ${muted}`}>
                    {selectedProject.actual} actual / {selectedProject.planned} planned · {selectedProject.agencies.length} agencies
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedProject(null)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              <div className={`rounded-[30px]  p-5 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Manpower mix</p>
                    <h4 className="mt-2 text-2xl font-semibold">{selectedProject.progress}% progress</h4>
                    <p className={`mt-1 text-sm ${muted}`}>Planned, actual and variance at a glance.</p>
                  </div>
                  <div className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedProject.variance < 0 ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                    {selectedProject.variance >= 0 ? "+" : ""}{selectedProject.variance} variance
                  </div>
                </div>

                <div className="mt-5 flex h-3 overflow-hidden rounded-full">
                  {(() => {
                    const planned = Math.max(Number(selectedProject.planned) || 0, 0);
                    const actual = Math.max(Number(selectedProject.actual) || 0, 0);
                    const variance = Math.abs(Number(selectedProject.variance) || 0);
                    const total = planned + actual + variance || 1;
                    return [
                      { label: "Planned", value: planned, color: "bg-[#ff7a2f]" },
                      { label: "Actual", value: actual, color: "bg-[#f2c94c]" },
                      { label: "Variance", value: variance, color: "bg-[#63d5bd]" },
                    ].map((segment) => (
                      <span
                        key={segment.label}
                        className={`${segment.color} mr-1 first:rounded-l-full last:mr-0 last:rounded-r-full`}
                        style={{ width: `${Math.max(segment.value ? 10 : 4, (segment.value / total) * 100)}%` }}
                      />
                    ));
                  })()}
                </div>
                <div className={`mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${muted}`}>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#ff7a2f]" /> Planned</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f2c94c]" /> Actual</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#63d5bd]" /> Variance</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Planned", value: selectedProject.planned, tone: darkMode ? "bg-[#ff7a2f]/10 text-orange-200" : "bg-orange-50 text-orange-700" },
                  { label: "Actual", value: selectedProject.actual, tone: darkMode ? "bg-[#f2c94c]/10 text-yellow-200" : "bg-yellow-50 text-yellow-700" },
                  { label: "Variance", value: `${selectedProject.variance >= 0 ? "+" : ""}${selectedProject.variance}`, tone: selectedProject.variance < 0 ? (darkMode ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-700") : (darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700") },
                  { label: "Progress", value: `${selectedProject.progress}%`, tone: darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700" },
                ].map((metric) => (
                  <div key={metric.label} className={`rounded-[24px] px-5 py-4 ${metric.tone}`}>
                    <p className="text-3xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs opacity-70">{metric.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>Agency details</p>
                    <h4 className="mt-1 text-xl font-semibold">Who is active on this project</h4>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {selectedProject.rows.slice().sort((a, b) => (a.agency || "").localeCompare(b.agency || "")).map((row, index) => {
                    const planned = Number(row.planned) || 0;
                    const actual = Number(row.actual) || 0;
                    const variance = actual - planned;
                    const total = Math.max(planned + actual + Math.abs(variance), 1);
                      return (
                        <article key={`${row.agency}-${row.rowIndex || index}`} className={`rounded-[26px]  p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold">{row.agency || "Unnamed agency"}</p>
                              <p className={`mt-1 text-xs ${muted}`}>{row.site || selectedProject.site}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${variance < 0 ? (darkMode ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-700") : (darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700")}`}>
                              {variance >= 0 ? "+" : ""}{variance}
                            </span>
                          </div>
                          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                            {[
                              { value: planned, color: "bg-[#ff7a2f]" },
                              { value: actual, color: "bg-[#f2c94c]" },
                              { value: Math.abs(variance), color: "bg-[#63d5bd]" },
                            ].map((segment, segmentIndex) => (
                              <span
                                key={segmentIndex}
                                className={`${segment.color} mr-1 first:rounded-l-full last:mr-0 last:rounded-r-full`}
                                style={{ width: `${Math.max(segment.value ? 10 : 4, (segment.value / total) * 100)}%` }}
                              />
                            ))}
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                            <div className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-[#ff7a2f]/10 text-orange-200" : "bg-orange-50 text-orange-700"}`}>
                              <p className="text-base font-semibold">{planned}</p>
                              <p className="opacity-70">Planned</p>
                            </div>
                            <div className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-[#f2c94c]/10 text-yellow-200" : "bg-yellow-50 text-yellow-700"}`}>
                              <p className="text-base font-semibold">{actual}</p>
                              <p className="opacity-70">Actual</p>
                            </div>
                            <div className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-white/5 text-white/65" : "bg-black/[0.035] text-black/60"}`}>
                              <p className="text-base font-semibold">{row.rowIndex || "-"}</p>
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

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
          <div className={`flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px]  ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-[#faf9f5] text-[#171714]"}`}>
            <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Super Admin only</p>
                <h3 className="mt-2 text-2xl font-semibold">DMR version history</h3>
                <p className={`mt-1 text-sm ${muted}`}>Who changed what for {data?.sheetName || date}.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={loadHistory} disabled={historyLoading} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-medium ${darkMode ? "border-white/10 text-white/70" : "border-black/10 text-black/65"}`}>
                  <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button onClick={() => setHistoryOpen(false)} className={`flex h-10 w-10 items-center justify-center rounded-full border ${darkMode ? "border-white/10" : "border-black/10"}`}><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              {historyLoading && <div className={`rounded-[24px] border px-4 py-10 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/55" : "border-black/[0.06] bg-white text-black/55"}`}>Loading DMR changes…</div>}
              {!historyLoading && !historyItems.length && <div className={`rounded-[24px] border px-4 py-10 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/55" : "border-black/[0.06] bg-white text-black/55"}`}>No version history found for this DMR date yet.</div>}
              {!historyLoading && historyItems.length > 0 && !selectedHistory && (
                <div className="space-y-3">
                  {historyItems.map((group) => (
                    <article key={group.id} className={`rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {(group.sections || []).slice(0, 4).map((section) => (
                              <span key={section} className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{section}</span>
                            ))}
                            <span className={`rounded-full px-2.5 py-1 text-[10px] ${darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"}`}>{group.changeCount} change{group.changeCount === 1 ? "" : "s"}</span>
                          </div>
                          <h4 className="mt-3 truncate text-base font-semibold">DMR submitted by {group.displayName || group.username}</h4>
                          <p className={`mt-1 text-xs ${muted}`}>{group.createdAt ? new Date(group.createdAt).toLocaleString() : ""} · {group.rowCount || 0} row{group.rowCount === 1 ? "" : "s"} affected</p>
                        </div>
                        <button type="button" onClick={() => setSelectedHistory(group)} className={`h-10 rounded-full px-4 text-xs font-semibold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>
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
                      <button type="button" onClick={() => setSelectedHistory(null)} className={`rounded-full border px-4 py-2 text-xs ${darkMode ? "border-white/10 text-white/70" : "border-black/10 text-black/65"}`}>Back to history</button>
                      <h4 className="mt-4 text-xl font-semibold">Submission details</h4>
                      <p className={`mt-1 text-sm ${muted}`}>{selectedHistory.displayName || selectedHistory.username} · {selectedHistory.createdAt ? new Date(selectedHistory.createdAt).toLocaleString() : ""}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/55"}`}>{selectedHistory.changeCount} changes</span>
                  </div>
                  <div className={`overflow-hidden rounded-[22px] border ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className={darkMode ? "bg-white/[0.035] text-white/55" : "bg-[#f4f0e8] text-black/55"}>
                          <tr>
                            {["Section", "Row", "Item", "Field", "Before", "After"].map((label) => (
                              <th key={label} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={darkMode ? "divide-y divide-white/10" : "divide-y divide-black/[0.06]"}>
                          {(selectedHistory.changes || []).map((change) => (
                            <tr key={change.id}>
                              <td className="px-4 py-3 capitalize">{change.section || "—"}</td>
                              <td className={`px-4 py-3 ${muted}`}>{change.rowNumber || "—"}</td>
                              <td className="max-w-[220px] px-4 py-3"><span className="line-clamp-2">{change.label || "DMR row"}</span></td>
                              <td className={`px-4 py-3 capitalize ${muted}`}>{change.field || "row"}</td>
                              <td className={`max-w-[220px] px-4 py-3 ${darkMode ? "text-red-200" : "text-red-700"}`}><span className="line-clamp-2 break-words">{change.before || "Blank"}</span></td>
                              <td className={`max-w-[220px] px-4 py-3 ${darkMode ? "text-emerald-200" : "text-emerald-700"}`}><span className="line-clamp-2 break-words">{change.after || "Blank"}</span></td>
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
          <div className={`flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[34px] border ${darkMode ? "border-white/10 bg-[#111216] text-white" : "border-black/10 bg-[#f7f5ef] text-[#171714]"}`}>
            <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
              <div className="flex min-w-0 items-start gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${activeDetail.soft}`}>
                  <span className={`h-4 w-4 rounded-md ${activeDetail.accent}`} />
                </span>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>{activeDetail.eyebrow}</p>
                  <h3 className="mt-2 truncate text-3xl font-semibold">{activeDetail.title}</h3>
                  <p className={`mt-1 text-sm ${muted}`}>Details from {data?.sheetName || "today's DMR"}.</p>
                </div>
              </div>
              <button onClick={() => setDetailSection(null)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              {activeDetail.id === "equipment" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeDetail.items.map((item) => (
                    <article key={item.id} className={`flex min-h-44 flex-col rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${activeDetail.soft}`}>{item.site || "No site"}</span>
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{item.quantity || "—"}</span>
                      </div>
                      <p className="mt-5 text-lg font-semibold">{item.details || "Equipment"}</p>
                      <div className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-black/[0.06] text-black/50"}`}>Equipment & tools entry</div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "materials" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeDetail.items.map((item) => (
                    <article key={item.id} className={`flex min-h-44 flex-col rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${activeDetail.soft}`}>{item.site || "No site"}</span>
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{[item.quantity, item.unit].filter(Boolean).join(" ") || "—"}</span>
                      </div>
                      <p className="mt-5 text-lg font-semibold">{item.details || "Material"}</p>
                      <div className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-black/[0.06] text-black/50"}`}>Materials entry</div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "notes" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeDetail.items.map((item, index) => (
                    <article key={item.id} className={`flex min-h-44 flex-col rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${activeDetail.soft}`}>Note {index + 1}</span>
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>Remark</span>
                      </div>
                      <p className="mt-5 text-sm leading-6">{item.note}</p>
                      <div className={`mt-auto border-t pt-4 text-xs ${darkMode ? "border-white/10 text-white/50" : "border-black/[0.06] text-black/50"}`}>Site note</div>
                    </article>
                  ))}
                </div>
              )}

              {activeDetail.id === "attendance" && (
                <div>
                  <div className="mb-5 grid grid-cols-3 gap-3 text-xs">
                    <div className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-emerald-400/10 text-emerald-200" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}><p className="text-3xl font-semibold">{attendanceSummary.present}</p><p className="mt-1">Present</p></div>
                    <div className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-red-400/10 text-red-200" : "border-red-100 bg-red-50 text-red-700"}`}><p className="text-3xl font-semibold">{attendanceSummary.absent}</p><p className="mt-1">Absent</p></div>
                    <div className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-white/5 text-white/55" : "border-black/[0.06] bg-white text-black/50"}`}><p className="text-3xl font-semibold">{attendanceSummary.pending}</p><p className="mt-1">Pending</p></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeDetail.items.map((item, index) => {
                      const status = String(item.status || "").trim().toLowerCase();
                      const statusLabel = status === "p" ? "Present" : status === "a" ? "Absent" : status === "l" ? "Leave" : "Pending";
                      const statusTone = status === "p"
                        ? "text-emerald-700 bg-emerald-500/10"
                        : status === "a"
                          ? "text-red-700 bg-red-500/10"
                          : status === "l"
                            ? "text-amber-700 bg-amber-500/10"
                            : darkMode ? "text-white/45 bg-white/5" : "text-black/45 bg-black/[0.04]";
                      const headerColor = status === "p" ? "bg-[#75e6b4]" : status === "a" ? "bg-[#ff9aa2]" : status === "l" ? "bg-[#f5f76a]" : "bg-[#6f7df2]";
                      const initials = (item.name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <article key={item.id} className={`overflow-hidden rounded-[22px] border ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                          <div className={`flex items-center justify-between px-4 py-3 text-sm font-semibold ${headerColor} text-[#171714]`}>
                            <span>STAFF-{String(index + 1).padStart(3, "0")}</span>
                            <span>{data?.sheetName || date}</span>
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className={`text-xs ${muted}`}>Project Staff</p>
                                <h4 className="mt-2 small tracking-wide text-black dark:text-white min-h-12 text-xl font-semibold">{item.name || "Unnamed staff"}</h4>
                              </div>
                              <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusTone}`}>{statusLabel}</span>
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
                <div className={`rounded-[24px] border px-4 py-10 text-center text-sm ${darkMode ? "border-white/10 bg-white/[0.025] text-white/45" : "border-black/[0.06] bg-white text-black/45"}`}>
                  No details added in this section yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
          <div className={`flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-[#faf9f5] text-[#171714]"}`}>
            <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
              <div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>Fill DMR</p><h3 className="mt-1 text-2xl font-semibold">{data?.sheetName || "Today"} entries</h3><p className={`mt-1 text-sm ${muted}`}>Fill one section at a time. Changes from all tabs save together.</p></div>
              <button onClick={() => setFillOpen(false)} className={`flex h-10 w-10 items-center justify-center rounded-full border ${darkMode ? "border-white/10" : "border-black/10"}`}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              {!dmrSheetLinked && <div className={`mb-4 rounded-2xl  px-4 py-3 text-xs ${darkMode ? "border-amber-400/20 bg-amber-400/5 text-amber-200/75" : "border-amber-500/20 bg-amber-50 text-amber-800"}`}>No DMR sheet is linked yet. Super Admin must link a native Google Sheet before anyone can fill records.</div>}
              {dmrSheetLinked && !data?.canEdit && <div className={`mb-4 rounded-2xl  px-4 py-3 text-xs ${darkMode ? "border-amber-400/20 bg-amber-400/5 text-amber-200/75" : "border-amber-500/20 bg-amber-50 text-amber-800"}`}>You can view DMR, but your role does not have fill permission.</div>}
              <section className={`mb-5 rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.06] bg-white"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${muted}`}>DMR Sheet Link</p>
                    <h4 className="mt-2 text-lg font-semibold">{data?.dmrSettings?.linked ? "Google Sheet connected" : "No DMR sheet linked"}</h4>
                    <p className={`mt-1 text-xs ${muted}`}>
                      {data?.dmrSettings?.linked
                        ? `Active sheet ID: ${data.dmrSettings.spreadsheetId}`
                        : data?.canManageDmrSettings
                          ? "Paste a native Google Sheet link here once. After that, all DMR reads and fills use that sheet."
                          : "Ask Super Admin to link the DMR Google Sheet before filling records."}
                    </p>
                  </div>
                  {data?.canManageDmrSettings && (
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                      <input
                        value={dmrSheetLink}
                        onChange={(event) => setDmrSheetLink(event.target.value)}
                        placeholder="Paste DMR Google Sheet link or ID"
                        className={`h-11 min-w-0 rounded-2xl border px-4 text-sm outline-none sm:w-80 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#fafafa]"}`}
                      />
                      <button
                        type="button"
                        disabled={dmrSheetSaving || !dmrSheetLink.trim()}
                        onClick={linkDmrSheet}
                        className={`h-11 rounded-2xl px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}
                      >
                        {dmrSheetSaving ? "Linking…" : data?.dmrSettings?.linked ? "Replace" : "Link"}
                      </button>
                      {data?.dmrSettings?.linked && (
                        <button
                          type="button"
                          disabled={dmrSheetSaving}
                          onClick={unlinkDmrSheet}
                          className={`h-11 rounded-2xl border px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-red-400/25 text-red-200 hover:bg-red-400/10" : "border-red-200 text-red-700 hover:bg-red-50"}`}
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <div className={`mb-5 flex gap-2 overflow-x-auto rounded-2xl p-1.5 ${darkMode ? "bg-white/[0.035]" : "bg-[#ebe6dc]"}`}>
                {[
                  ["manpower", "Manpower", filteredRecords.length],
                  ["attendance", "Attendance", data?.today?.staffAttendance?.length || 0],
                  ["equipment", "Equipment & Tools", fillEquipmentRows.length],
                  ["materials", "Materials", fillMaterialRows.length],
                  ["notes", "Notes", fillNoteRows.length],
                ].map(([value, label, count]) => (
                  <button key={value} type="button" onClick={() => setFillTab(value)} className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${fillTab === value ? darkMode ? "bg-[#d8f36a] text-black" : "bg-white text-black" : muted}`}>
                    <span className="font-medium">{label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${fillTab === value ? "bg-black/10" : darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}>{count}</span>
                  </button>
                ))}
              </div>

              {fillTab === "manpower" && <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <SelectMenu darkMode={darkMode} value={siteFilter} onChange={setSiteFilter} options={[{ value: "all", label: "All sites" }, ...(data?.today?.sites || []).map((site) => ({ value: site, label: site }))]} />
                <label className="relative block flex-1">
                  <Filter className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                  <input value={agencySearch} onChange={(event) => setAgencySearch(event.target.value)} placeholder="Search agency/trade…" className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`} />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRecords.map((record) => (
                  <article key={record.id} className={`rounded-[22px]  p-4 ${darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/[0.07] bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-base font-semibold">{record.agency}</p><p className={`mt-1 text-xs ${muted}`}>{record.site}</p></div>
                      <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px]">Row {record.rowNumber}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className={`text-[11px] ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>
                        <span className="flex items-center justify-between gap-2">
                          Planned
                          {autoPlannedForRecord(record) !== "" && <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}>Auto from plan</span>}
                        </span>
                        <input disabled={!canFillDmr} type="number" value={valueFor(record, "planned")} onChange={(event) => updateDraft(record, "planned", event.target.value)} className={`mt-2 h-11 w-full rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-emerald-400/20 bg-emerald-400/10 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} />
                      </label>
                      <label className={`text-[11px] ${darkMode ? "text-red-300" : "text-red-700"}`}>Actual<input disabled={!canFillDmr} type="number" value={valueFor(record, "actual")} onChange={(event) => updateDraft(record, "actual", event.target.value)} className={`mt-2 h-11 w-full rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-red-400/20 bg-red-400/10 text-white" : "border-red-200 bg-red-50 text-red-900"}`} /></label>
                    </div>
                  </article>
                ))}
              </div>
              </>}

              <div className="mt-7">
                {fillTab === "equipment" && <section className={`rounded-[24px]  p-4 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">Equipments and Tools</h4>
                      <p className={`mt-1 text-xs ${muted}`}>Add tools, machinery, and quantities used today.</p>
                    </div>
                    <button type="button" disabled={!canFillDmr || addingRow === "equipment"} onClick={() => addSectionRow("equipment")} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>
                      {addingRow === "equipment" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add row
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {fillEquipmentRows.map((item) => (
                      <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_.7fr]">
                        <input disabled={!canFillDmr} value={valueFor(item, "site")} onChange={(event) => updateDraft(item, "site", event.target.value)} placeholder="Site" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                        <input disabled={!canFillDmr} value={valueFor(item, "details")} onChange={(event) => updateDraft(item, "details", event.target.value)} placeholder="Details" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                        <input disabled={!canFillDmr} value={valueFor(item, "quantity")} onChange={(event) => updateDraft(item, "quantity", event.target.value)} placeholder="Nos/Pair" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                      </div>
                    ))}
                  </div>
                </section>}

                {fillTab === "materials" && <section className={`rounded-[24px]  p-4 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">Materials Details</h4>
                      <p className={`mt-1 text-xs ${muted}`}>Track site-wise material, unit, and quantity.</p>
                    </div>
                    <button type="button" disabled={!canFillDmr || addingRow === "materials"} onClick={() => addSectionRow("materials")} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>
                      {addingRow === "materials" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add row
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {fillMaterialRows.map((item) => (
                      <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_.55fr_.55fr]">
                        <input disabled={!canFillDmr} value={valueFor(item, "site")} onChange={(event) => updateDraft(item, "site", event.target.value)} placeholder="Site" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                        <input disabled={!canFillDmr} value={valueFor(item, "details")} onChange={(event) => updateDraft(item, "details", event.target.value)} placeholder="Details" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                        <input disabled={!canFillDmr} value={valueFor(item, "unit")} onChange={(event) => updateDraft(item, "unit", event.target.value)} placeholder="Unit" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                        <input disabled={!canFillDmr} value={valueFor(item, "quantity")} onChange={(event) => updateDraft(item, "quantity", event.target.value)} placeholder="Qty" className={`h-11 rounded-2xl border px-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                      </div>
                    ))}
                  </div>
                </section>}

                {fillTab === "notes" && <section className={`rounded-[24px]  p-4 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">Notes</h4>
                      <p className={`mt-1 text-xs ${muted}`}>Write any site remarks, issues, or next-day reminders.</p>
                    </div>
                    <button type="button" disabled={!canFillDmr || addingRow === "notes"} onClick={() => addSectionRow("notes")} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>
                      {addingRow === "notes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add row
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {fillNoteRows.map((item, index) => (
                      <textarea key={item.id} disabled={!canFillDmr} value={valueFor(item, "note")} onChange={(event) => updateDraft(item, "note", event.target.value)} placeholder={`Note ${index + 1}`} rows={2} className={`w-full rounded-2xl border px-3 py-3 text-sm outline-none disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                    ))}
                  </div>
                </section>}

                {fillTab === "attendance" && <section className={`rounded-[24px]  p-4 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">Project Staff Attendance</h4>
                      <p className={`mt-1 text-xs ${muted}`}>Mark Present in green, Absent in red, or Leave when required.</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-700">{fillAttendanceSummary.present} Present</span>
                      <span className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-700">{fillAttendanceSummary.absent} Absent</span>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(data?.today?.staffAttendance || []).map((item) => {
                      const currentStatus = String(valueFor(item, "status") || "").trim().toUpperCase();
                      const statusMeta = currentStatus === "P"
                        ? { label: "Present", chip: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" }
                        : currentStatus === "A"
                        ? { label: "Absent", chip: "bg-red-500/10 text-red-700", dot: "bg-red-500" }
                        : currentStatus === "L"
                        ? { label: "Leave", chip: "bg-amber-500/10 text-amber-700", dot: "bg-amber-500" }
                        : { label: "Pending", chip: darkMode ? "bg-white/5 text-white/45" : "bg-black/[0.04] text-black/45", dot: darkMode ? "bg-white/30" : "bg-black/30" };
                      const options = [
                        { value: "P", label: "Present", active: "bg-emerald-500 text-white border-emerald-500", idle: darkMode ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
                        { value: "A", label: "Absent", active: "bg-red-500 text-white border-red-500", idle: darkMode ? "border-red-400/25 bg-red-400/10 text-red-200 hover:bg-red-400/15" : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100" },
                        { value: "L", label: "Leave", active: "bg-orange-500 text-white border-orange-500", idle: darkMode ? "border-orange-400/25 bg-orange-400/10 text-orange-200 hover:bg-orange-400/15" : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100" },
                      ];
                      return (
                        <article key={item.id} className={`flex min-h-52 flex-col rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/[0.06] bg-white"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}>
                              <span className="text-sm font-semibold">{(item.name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${statusMeta.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="mt-5 min-w-0">
                            <p className=" text-xl tracking-wide text-black small font-semibold">{item.name}</p>
                            <p className={`mt-1 text-xs ${muted}`}>Project staff attendance</p>
                          </div>
                          <div className={`mt-auto pt-5 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                            <div className="grid grid-cols-3 gap-2 border-t pt-4">
                            {options.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={!canFillDmr}
                                onClick={() => updateDraft(item, "status", option.value)}
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
                </section>}
              </div>
            </div>
            <div className={`flex items-center justify-end gap-2 border-t px-5 pb-6 pt-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
              <button onClick={() => setFillOpen(false)} className={`h-11 rounded-full border px-6 text-sm ${darkMode ? "border-white/10 text-white/60" : "border-black/10 text-black/60"}`}>Cancel</button>
              <button disabled={!canFillDmr || saving || (!Object.keys(drafts).length && !hasAutoPlannedDrafts)} onClick={saveDmr} className={`flex h-11 min-w-36 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to Sheet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
