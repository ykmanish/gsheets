import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Cloud,
  Eye,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sheet,
  Table2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { DateRangePicker, SelectMenu } from "./ui";
import AdminMiscExpensesDashboard from "./sheetViews/AdminMiscExpensesDashboard";
import AssetPurchaseDashboard from "./sheetViews/AssetPurchaseDashboard";
import DirectorPaymentDashboard from "./sheetViews/DirectorPaymentDashboard";
import ProjectPaymentDashboard from "./sheetViews/ProjectPaymentDashboard";
import KalhaarPendingTrackerDashboard from "./sheetViews/KalhaarPendingTrackerDashboard";
import AsteriaClientDashboard from "./sheetViews/AsteriaClientDashboard";
import KalharClientDashboard from "./sheetViews/KalharClientDashboard";
import AurikaClientDashboard from "./sheetViews/AurikaClientDashboard";
import DevsharnamClientDashboard from "./sheetViews/DevsharnamClientDashboard";
import EmpereonClientDashboard from "./sheetViews/EmpereonClientDashboard";
import HarmonyClientDashboard from "./sheetViews/HarmonyClientDashboard";
import ImperialClientDashboard from "./sheetViews/ImperialClientDashboard";
import SheetalClientDashboard from "./sheetViews/SheetalClientDashboard";
import SilverWhiteClientDashboard from "./sheetViews/SilverWhiteClientDashboard";
import IskonBhavnagarDashboard from "./sheetViews/IskonBhavnagarDashboard";
import KalhaarPendingWorkDashboard from "./sheetViews/KalhaarPendingWorkDashboard";
import { isWithinDateRange } from "./sheetViews/amountUtils";
import { API_URL } from "./AuthProvider";
const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

function extractSheetId(url) {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || null;
}

function extractUrls(value) {
  return String(value ?? "").match(/https?:\/\/[^\s,]+/g) || [];
}

function cleanValue(value) {
  const text = String(value ?? "").trim();
  return text && !/^na$/i.test(text) ? text : "";
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countBy(rows, column) {
  if (!column) return [];
  const counts = {};
  rows.forEach((row) => {
    const value = cleanValue(row[column]) || "Blank";
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function getInitials(value) {
  const words = String(value || "Sheet").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "S";
}

function accentFor(value) {
  const text = String(value || "sheet");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % CHART_COLORS.length;
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

function DonutChart({ title, description, centerLabel = "records", data, darkMode }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = items.length
    ? items.map((item, index) => {
        const start = cursor;
        const size = (item.value / total) * 100;
        cursor += size;
        return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cursor}%`;
      }).join(", ")
    : `${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} 0 100%`;

  return (
    <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className={`text-sm   ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
          {description && <p className={`text-xs mt-1 ${darkMode ? "text-white/40" : "text-black/35"}`}>{description}</p>}
        </div>
        <BarChart3 className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-black/45"}`} />
      </div>
      <div className="grid gap-5 items-center sm:grid-cols-[140px_minmax(0,1fr)]">
        <div
          className="w-[136px] h-[136px] rounded-full relative"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className={`absolute inset-7 rounded-full flex flex-col items-center justify-center ${darkMode ? "bg-[#121317] text-white" : "bg-white text-black"}`}>
            <span className="text-lg   leading-none">{total}</span>
            <span className={`text-[10px] mt-1 ${darkMode ? "text-white/45" : "text-black/40"}`}>{centerLabel}</span>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          {items.map((item, index) => (
            <div key={item.label} className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className={`text-xs truncate  flex-1 ${darkMode ? "text-white/65" : "text-black/55"}`}>{item.label}</span>
              <span className={`text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>{item.value}</span>
            </div>
          ))}
          {items.length === 0 && <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No chart data yet.</p>}
        </div>
      </div>
    </div>
  );
}

function ColumnBars({ title, description, data, darkMode }) {
  const items = data.filter((item) => item.value > 0).slice(0, 10);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
      <h3 className={`text-sm  ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
      {description && <p className={`text-xs mt-1 ${darkMode ? "text-white/40" : "text-black/35"}`}>{description}</p>}
      <div className="h-56 mt-5 flex items-end gap-3">
        {items.map((item, index) => (
          <div key={item.label} className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <div className={`text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>{item.value}</div>
            <div className={`w-full rounded-t-2xl ${darkMode ? "bg-white/8" : "bg-black/5"} flex items-end overflow-hidden`} style={{ height: 150 }}>
              <div
                className="w-full rounded-t-2xl"
                style={{
                  height: `${Math.max(8, (item.value / max) * 100)}%`,
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <p className={`text-[11px] text-center truncate w-full ${darkMode ? "text-white/55" : "text-black/45"}`}>{item.label}</p>
          </div>
        ))}
        {items.length === 0 && <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No bar chart data yet.</p>}
      </div>
    </div>
  );
}

function ColorBars({ title, description, data, darkMode }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
      <h3 className={`text-sm  ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
      {description && <p className={`text-xs mt-1 mb-4 ${darkMode ? "text-white/40" : "text-black/35"}`}>{description}</p>}
      {!description && <div className="mb-4" />}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="flex justify-between gap-3 text-xs mb-1">
              <span className={`truncate ${darkMode ? "text-white/65" : "text-black/55"}`}>{item.label}</span>
              <span className={darkMode ? "text-white/45" : "text-black/40"}>{item.value}</span>
            </div>
            <div className={`h-2.5 rounded-full overflow-hidden ${darkMode ? "bg-white/8" : "bg-black/5"}`}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(7, (item.value / max) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No chart data yet.</p>}
      </div>
    </div>
  );
}

function MetricTile({ label, value, accent, darkMode }) {
  return (
    <div className={`rounded-[24px] p-5 overflow-hidden relative ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
      <span className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-20" style={{ background: accent }} />
      <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>{label}</p>
      <p className={`text-3xl small font-semibold mt-4 sm:text-4xl ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
    </div>
  );
}

export default function SheetDashboard({ darkMode }) {
  const [documents, setDocuments] = useState([]);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [sheetData, setSheetData] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilters, setDateFilters] = useState({ from: "", to: "" });

  const muted = darkMode ? "text-white/50" : "text-black/45";
  const panel = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white/80 border border-black/5";

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocs(true);
      const response = await fetch(`${API_URL}/documents`);
      const data = await response.json();
      setDocuments((data.documents || []).filter((doc) => doc.type === "sheet"));
    } catch {
      toast.error("Could not load sheets");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const loadSheet = useCallback(async (id) => {
    if (!id) return;
    try {
      setLoadingSheet(true);
      const response = await fetch(`${API_URL}/sheets/${id}/data`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSheetData(data);
      setActiveTab(["asteria-client-dl", "iskon-bhavnagar-client-dl", "kalhar-client-dl", "aurika-client-dl", "devsharnam-client-dl", "empereon-client-dl", "harmony-client-dl", "imperial-client-dl", "sheetal-client-dl", "silverwhite-client-dl", "kalhaarPendingWorkDl"].includes(data.architecture?.kind) ? "__overview" : data.sheets?.[0]?.name || "");
      setDashboardOpen(true);
    } catch (error) {
      toast.error(error.message || "Could not load sheet dashboard");
    } finally {
      setLoadingSheet(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadDocuments(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadDocuments]);

  const handleViewDashboard = (doc) => {
    if (!doc.isReady) {
      toast.error("This sheet is still processing");
      return;
    }
    setSelectedSheetId(doc.id);
    setSheetData(null);
    setActiveTab("");
    setSearchQuery("");
    setDateFilters({ from: "", to: "" });
    void loadSheet(doc.id);
  };

  const handleRetrySync = async (doc) => {
    try {
      setSelectedSheetId(doc.id);
      const response = await fetch(`${API_URL}/sheets/${doc.id}/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Sync restarted. The Office workbook will be imported automatically.");
      await loadDocuments();
    } catch (error) {
      toast.error(error.message || "Could not restart sync");
    }
  };

  const handleAddSheet = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast.error("Please enter a valid Google Sheet URL");
      return;
    }

    try {
      setAdding(true);
      const response = await fetch(`${API_URL}/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, name: sheetName.trim() || `Sheet-${sheetId.slice(0, 8)}` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Sheet added. It will appear when processing is ready.");
      setAddModal(false);
      setSheetUrl("");
      setSheetName("");
      await loadDocuments();
      setSelectedSheetId(data.documentId);
    } catch (error) {
      toast.error(error.message || "Could not add sheet");
    } finally {
      setAdding(false);
    }
  };

  const selectedDocument = documents.find((doc) => doc.id === selectedSheetId) || sheetData?.document;
  const currentSheet = useMemo(
    () => (sheetData?.sheets || []).find((sheet) => sheet.name === activeTab) || sheetData?.sheets?.[0],
    [activeTab, sheetData]
  );
  const currentArchitecture = useMemo(
    () => sheetData?.architecture?.tabs?.find((tab) => tab.name === currentSheet?.name),
    [currentSheet, sheetData]
  );
  const dashboardHints = useMemo(
    () => sheetData?.architecture?.dashboard?.find((item) => item.tab === currentSheet?.name) || {},
    [currentSheet, sheetData]
  );

  const rows = useMemo(() => currentSheet?.rows || [], [currentSheet]);
  const fallbackMediaColumns = useMemo(
    () => (currentSheet?.headers || []).filter((header) => rows.some((row) => extractUrls(row[header]).length > 0)),
    [currentSheet, rows]
  );
  const fallbackDateColumn = (currentSheet?.headers || []).find((header) => /timestamp|date|created|updated/i.test(header));
  const fallbackEntityColumn =
    (currentSheet?.headers || []).find((header) => /^site$/i.test(header)) ||
    (currentSheet?.headers || []).find((header) => /project|client|customer|location|name/i.test(header)) ||
    currentSheet?.headers?.[0];
  const fallbackOwnerColumn = (currentSheet?.headers || []).find((header) => /person|owner|manager|lead|assigned/i.test(header));
  const architectureMediaColumns = currentArchitecture?.columns?.filter((column) => column.role === "media").map((column) => column.name) || [];
  const mediaColumns = dashboardHints.mediaColumns?.length
    ? dashboardHints.mediaColumns
    : architectureMediaColumns.length
    ? architectureMediaColumns
    : fallbackMediaColumns;
  const entityColumn = dashboardHints.entityColumn || currentArchitecture?.primaryLabel || fallbackEntityColumn;
  const ownerColumn = dashboardHints.ownerColumn || fallbackOwnerColumn;
  const dateColumn = dashboardHints.dateColumn || fallbackDateColumn;
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) =>
      (!query ||
        (currentSheet?.headers || []).some((header) =>
          String(row[header] ?? "").toLowerCase().includes(query) ||
          String(header).toLowerCase().includes(query)
        )) &&
      (!dateColumn || isWithinDateRange(row[dateColumn], dateFilters))
    );
  }, [currentSheet, dateColumn, dateFilters, rows, searchQuery]);
  const sortedRows = useMemo(() => {
    if (!dateColumn) return filteredRows;
    return [...filteredRows].sort((a, b) => (parseDate(b[dateColumn])?.getTime() || 0) - (parseDate(a[dateColumn])?.getTime() || 0));
  }, [dateColumn, filteredRows]);
  const mediaItems = sortedRows.flatMap((row) =>
    mediaColumns.flatMap((column) =>
      extractUrls(row[column]).map((url) => ({
        url,
        column,
        title: cleanValue(row[entityColumn]) || currentSheet?.name,
        subtitle: cleanValue(row[ownerColumn]) || "",
      }))
    )
  );
  const challengeFields = (currentSheet?.headers || []).filter((header) => /challenge|support|discrepancy/i.test(header));
  const challengeCount = filteredRows.filter((row) => challengeFields.some((field) => cleanValue(row[field]) && !/^no$/i.test(cleanValue(row[field])))).length;
  const latestDate = sortedRows[0]?.[dateColumn] ? parseDate(sortedRows[0][dateColumn]) : null;
  const mediaByColumn = mediaColumns
    .map((column) => ({ label: column, value: filteredRows.reduce((sum, row) => sum + extractUrls(row[column]).length, 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const recordFields = (currentSheet?.headers || []).filter((header) => !mediaColumns.includes(header));

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-4 newq sm:px-6 lg:overflow-hidden lg:px-8 lg:py-8"
      style={{
        background: darkMode
          ? "linear-gradient(180deg, #111318 0%, #0c0d10 100%)"
          : "linear-gradient(180deg, #f7f6f2 0%, #f3f1ea 100%)",
      }}
    >
      <div className="h-full min-h-0 flex flex-col max-w-[1500px] mx-auto">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between mb-6 flex-shrink-0">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${muted}`}>Adaptive sheet intelligence</p>
            <h2 className={`text-2xl small font-semibold sm:text-3xl md:text-4xl ${darkMode ? "text-white" : "text-black"}`}>Sheet Dashboard</h2>
            <p className={`text-sm mt-4 max-w-2xl ${muted}`}>Select a sheet and open a visual dashboard built from its own architecture.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button onClick={() => setAddModal(true)} className={`flex items-center gap-2 px-4 py-3 rounded-full sm:px-5 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
              <Plus className="w-4 h-4" /> Add Sheet
            </button>
            <button onClick={() => void loadDocuments()} className={`w-12 h-12 rounded-full flex items-center justify-center ${darkMode ? "bg-white/10 text-white" : "bg-black/[0.04] text-black"}`} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`rounded-[30px] overflow-hidden flex-1 min-h-0 ${panel}`}>
          {loadingDocs ? (
            <div className="h-full flex items-center justify-center"><Loader2 className={`w-8 h-8 animate-spin ${muted}`} /></div>
          ) : documents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Sheet className={`w-12 h-12 mb-4 ${muted}`} />
              <p className={`text-xl font-medium ${darkMode ? "text-white" : "text-black"}`}>No sheets yet</p>
              <p className={`text-sm mt-2 ${muted}`}>Add a Google Sheet link to create the first visual dashboard.</p>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    {["Sheet", "Status", "Synced", "Chunks", "Dashboard"].map((header) => (
                      <th key={header} className={`px-6 py-5 text-[12px] uppercase tracking-[0.2em] font-medium ${darkMode ? "text-white/45" : "text-black/35"}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className={`transition-colors ${darkMode ? "border-b border-white/5 hover:bg-white/[0.03]" : "border-b border-black/5 hover:bg-black/[0.02]"}`}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}>
                            <Sheet className={`w-5 h-5 ${darkMode ? "text-[#d8f36a]" : "text-green-600"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm  truncate ${darkMode ? "text-white" : "text-black"}`}>{doc.name}</p>
                            <p className={`text-xs mt-1 ${muted}`}>{doc.sheetArchitecture ? `Architecture v${doc.sheetArchitecture.version}` : "Architecture builds on view"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-xs px-3 py-1 rounded-full ${doc.isReady ? darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-green-50 text-green-700" : "bg-amber-500/10 text-amber-500"}`}>
                          {doc.isReady ? "Ready" : doc.status || "Processing"}
                        </span>
                      </td>
                      <td className={`px-6 py-5 text-sm ${muted}`}>{doc.lastSyncedAt ? new Date(doc.lastSyncedAt).toLocaleString() : "Not synced"}</td>
                      <td className={`px-6 py-5 text-sm ${muted}`}>{doc.chunks || 0}</td>
                      <td className="px-6 py-5">
                        <button
                          onClick={() => doc.status === "failed" ? handleRetrySync(doc) : handleViewDashboard(doc)}
                          disabled={(!doc.isReady && doc.status !== "failed") || loadingSheet}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm disabled:opacity-40 ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-black text-white hover:bg-black/85"}`}
                        >
                          {loadingSheet && selectedSheetId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : doc.status === "failed" ? <RefreshCw className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {doc.status === "failed" ? "Retry Sync" : "View Dashboard"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {dashboardOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm p-2 sm:p-4">
          <div className={`h-full max-w-7xl mx-auto w-full rounded-[22px] overflow-hidden flex flex-col sm:rounded-[28px] ${darkMode ? "bg-[#101216] border border-white/10" : "bg-[#f7f6f2] border border-black/5"}`}>
            <div className={`px-4 py-4 flex flex-col gap-4 border-b sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between ${darkMode ? "border-white/10" : "border-black/5"}`}>
              <div className="min-w-0">
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${muted}`}>Visual dashboard</p>
                <h3 className={`text-2xl small font-semibold  truncate ${darkMode ? "text-white" : "text-black"}`}>{selectedDocument?.name || "Sheet Dashboard"}</h3>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
                <div className={`flex items-center gap-2 w-full max-w-sm rounded-full px-4 py-3 ${darkMode ? "bg-white/5 text-white border border-white/10" : "bg-white text-black border border-black/5"}`}>
                  <Search className={`w-4 h-4 flex-shrink-0 ${muted}`} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search all dashboard data..."
                    className="bg-transparent outline-none text-sm flex-1 min-w-0"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className={`text-xs ${muted}`}>Clear</button>
                  )}
                </div>
                {!['asteria-client-dl', 'iskon-bhavnagar-client-dl', 'kalhar-client-dl', 'aurika-client-dl', 'devsharnam-client-dl', 'empereon-client-dl', 'harmony-client-dl', 'imperial-client-dl', 'sheetal-client-dl', 'silverwhite-client-dl'].includes(sheetData?.architecture?.kind) && <div className="w-full sm:w-[360px]">
                  <DateRangePicker
                    darkMode={darkMode}
                    from={dateFilters.from}
                    to={dateFilters.to}
                    onChange={(range) => setDateFilters((current) => ({ ...current, ...range }))}
                    placeholder="Choose sheet dates"
                  />
                </div>}
                {!['asteria-client-dl', 'iskon-bhavnagar-client-dl', 'kalhar-client-dl', 'aurika-client-dl', 'devsharnam-client-dl', 'empereon-client-dl', 'harmony-client-dl', 'imperial-client-dl', 'sheetal-client-dl', 'silverwhite-client-dl', 'kalhaarPendingWorkDl'].includes(sheetData?.architecture?.kind) && (dateFilters.from || dateFilters.to) && (
                  <button
                    onClick={() => setDateFilters({ from: "", to: "" })}
                    className={`rounded-full px-3 py-2 text-xs ${darkMode ? "bg-white/5 text-white/65 hover:bg-white/10" : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]"}`}
                  >
                    Clear dates
                  </button>
                )}
                <SelectMenu
                  darkMode={darkMode}
                  value={activeTab || ""}
                  onChange={setActiveTab}
                  className="w-full min-w-[220px] sm:w-[300px]"
                  options={[
                    ...(["asteria-client-dl", "iskon-bhavnagar-client-dl", "kalhar-client-dl", "aurika-client-dl", "devsharnam-client-dl", "empereon-client-dl", "harmony-client-dl", "imperial-client-dl", "sheetal-client-dl", "silverwhite-client-dl", "kalhaarPendingWorkDl"].includes(sheetData?.architecture?.kind) ? [{ value: "__overview", label: "Executive overview" }] : []),
                    ...(sheetData?.sheets || []).map((sheet) => ({ value: sheet.name, label: sheet.name })),
                  ]}
                />
                <button onClick={() => setDashboardOpen(false)} className={`w-11 h-11 rounded-full flex items-center justify-center ${darkMode ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]"}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {!sheetData || !currentSheet ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className={`w-8 h-8 animate-spin ${muted}`} /></div>
            ) : sheetData?.architecture?.kind === "kalhaar-pending-tracker" ? (
              <KalhaarPendingTrackerDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                searchQuery={searchQuery}
                dateRange={dateFilters}
              />
            ) : sheetData?.architecture?.kind === "asteria-client-dl" ? (
              <AsteriaClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "kalhar-client-dl" ? (
              <KalharClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "aurika-client-dl" ? (
              <AurikaClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "devsharnam-client-dl" ? (
              <DevsharnamClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "empereon-client-dl" ? (
              <EmpereonClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "harmony-client-dl" ? (
              <HarmonyClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "imperial-client-dl" ? (
              <ImperialClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "sheetal-client-dl" ? (
              <SheetalClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "silverwhite-client-dl" ? (
              <SilverWhiteClientDashboard
                darkMode={darkMode}
                currentSheet={sheetData.sheets?.find((s) => s.name === activeTab)}
                sheets={sheetData.sheets}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "iskon-bhavnagar-client-dl" ? (
              <IskonBhavnagarDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                sheets={sheetData.sheets || []}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "kalhaarPendingWorkDl" ? (
              <KalhaarPendingWorkDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                sheets={sheetData.sheets || []}
                sheetData={sheetData}
                overview={activeTab === "__overview"}
                searchQuery={searchQuery}
              />
            ) : sheetData?.architecture?.kind === "admin-misc-expenses" ? (
              <AdminMiscExpensesDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                searchQuery={searchQuery}
                dateRange={dateFilters}
              />
            ) : sheetData?.architecture?.kind === "asset-purchase-requests" ? (
              <AssetPurchaseDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                searchQuery={searchQuery}
                dateRange={dateFilters}
              />
            ) : sheetData?.architecture?.kind === "director-payment-requests" ? (
              <DirectorPaymentDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                searchQuery={searchQuery}
                dateRange={dateFilters}
              />
            ) : sheetData?.architecture?.kind === "project-payment-requests" ? (
              <ProjectPaymentDashboard
                darkMode={darkMode}
                currentSheet={currentSheet}
                searchQuery={searchQuery}
                dateRange={dateFilters}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
                  <MetricTile darkMode={darkMode} label={searchQuery ? "Matching rows" : "Rows"} value={filteredRows.length.toLocaleString()} accent="#22c55e" />
                  <MetricTile darkMode={darkMode} label={entityColumn || "Groups"} value={countBy(filteredRows, entityColumn).length.toLocaleString()} accent="#3b82f6" />
                  <MetricTile darkMode={darkMode} label="Media" value={mediaItems.length.toLocaleString()} accent="#f59e0b" />
                  <MetricTile darkMode={darkMode} label="Alerts" value={challengeCount.toLocaleString()} accent="#ef4444" />
                  <MetricTile darkMode={darkMode} label="Latest" value={latestDate ? latestDate.toLocaleDateString() : "N/A"} accent="#a855f7" />
                </div>

                <div className="grid xl:grid-cols-2 gap-4 mb-5">
                  <DonutChart
                    darkMode={darkMode}
                    title={`Records by ${entityColumn || "group"}`}
                    description={`Shows how many submissions belong to each ${entityColumn || "group"}.`}
                    data={countBy(filteredRows, entityColumn)}
                  />
                  <DonutChart
                    darkMode={darkMode}
                    title={ownerColumn ? `Records by ${ownerColumn}` : "Records by owner"}
                    description={ownerColumn ? `Shows submissions assigned to each ${ownerColumn}.` : "Shows ownership distribution when available."}
                    data={countBy(filteredRows, ownerColumn)}
                  />
                </div>

                <div className="grid xl:grid-cols-2 gap-4 mb-5">
                  <ColumnBars
                    darkMode={darkMode}
                    title={`Bar graph by ${entityColumn || "group"}`}
                    description="Vertical comparison of record volume across the primary grouping."
                    data={countBy(filteredRows, entityColumn)}
                  />
                  <ColorBars
                    darkMode={darkMode}
                    title={mediaByColumn.length ? "Drive links by work category" : `Top ${entityColumn || "record"} groups`}
                    description={mediaByColumn.length ? "Each bar counts attached Drive links in that work/category column." : "Each bar counts records in the detected primary grouping column."}
                    data={mediaByColumn.length ? mediaByColumn : countBy(filteredRows, entityColumn)}
                  />
                </div>

                <div className="grid xl:grid-cols-[1fr_0.7fr] gap-4 mb-5">
                  <ColorBars
                    darkMode={darkMode}
                    title={ownerColumn ? `Bar graph by ${ownerColumn}` : "Ownership bar graph"}
                    description="Horizontal comparison of record ownership or assignee distribution."
                    data={countBy(filteredRows, ownerColumn)}
                  />
                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
                    <h3 className={`text-sm  mb-4 ${darkMode ? "text-white" : "text-black"}`}>Architecture</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Tabs", sheetData.sheets?.length || 0],
                        ["Columns", currentSheet.headers.length],
                        ["Media cols", mediaColumns.length],
                        ["Shown rows", filteredRows.length],
                      ].map(([label, value]) => (
                        <div key={label} className={`rounded-2xl p-4 ${darkMode ? "bg-black/20" : "bg-black/[0.025]"}`}>
                          <p className={`text-xs ${muted}`}>{label}</p>
                          <p className={`text-2xl mt-2 ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid xl:grid-cols-2 gap-4 mb-5">
                  {sortedRows.map((row) => {
                    const rowMedia = mediaColumns.flatMap((column) => extractUrls(row[column]).map((url) => ({ url, column })));
                    const cardTitle = cleanValue(row[entityColumn]) || `Row ${row.__rowIndex}`;
                    const accent = accentFor(cardTitle);
                    return (
                      <article key={`${row.__sheetName}-${row.__rowIndex}`} className={`rounded-[26px] p-5 overflow-hidden relative ${darkMode ? "bg-white/[0.04] border border-white/10" : "bg-white border border-black/5"}`}>
                        <span className="absolute inset-x-0 top-0 h-1.5"  />
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-12 h-12 small font-semibold rounded-full flex items-center justify-center text-white  flex-shrink-0"
                              style={{ background: accent }}
                            >
                              {getInitials(cardTitle)}
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-xl small font-semibold tracking-wide truncate ${darkMode ? "text-white" : "text-black"}`}>{cardTitle}</h4>
                              <p className={`text-sm mt-1 truncate ${muted}`}>{cleanValue(row[ownerColumn]) || currentSheet.name}</p>
                            </div>
                          </div>
                          {dateColumn && cleanValue(row[dateColumn]) && (
                            <span className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/50"}`}>
                              <CalendarDays className="w-3 h-3 inline mr-1" />
                              {parseDate(row[dateColumn])?.toLocaleDateString() || cleanValue(row[dateColumn])}
                            </span>
                          )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 mt-5">
                          {recordFields.map((field) => (
                            <div key={field} className={`rounded-2xl p-3 ${darkMode ? "bg-black/20" : "bg-black/[0.025]"}`}>
                              <p className={`text-[10px] uppercase tracking-[0.16em] mb-1 ${darkMode ? "text-white/35" : "text-black/35"}`}>{field}</p>
                              <p className={`text-sm leading-5 break-words ${darkMode ? "text-white/75" : "text-black/70"}`}>{cleanValue(row[field]) || "—"}</p>
                            </div>
                          ))}
                        </div>

                        {rowMedia.length > 0 && (
                          <div className="mt-5">
                            <p className={`text-[10px] uppercase tracking-[0.16em] mb-3 ${darkMode ? "text-white/35" : "text-black/35"}`}>Drive attachments</p>
                            <div className="grid sm:grid-cols-2 gap-3">
                              {rowMedia.map((item, index) => (
                                <a
                                  key={`${item.url}-${index}`}
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`rounded-2xl p-3 flex items-center justify-between gap-3 transition-colors ${darkMode ? "bg-white/5 text-white/75 hover:bg-white/10" : "bg-black/[0.035] text-black/70 hover:bg-black/[0.06]"}`}
                                >
                                  <span className="flex items-center gap-3 min-w-0">
                                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#34a853]/12 text-[#34a853]">
                                      <Cloud className="w-5 h-5" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className={`block text-sm truncate ${darkMode ? "text-white" : "text-black"}`}>{item.column}</span>
                                      <span className={`block text-xs mt-1 ${muted}`}>Google Drive link {index + 1}</span>
                                    </span>
                                  </span>
                                  <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className={`rounded-[24px] overflow-hidden ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
                  <div className="px-5 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/10">
                    <h3 className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>Complete data</h3>
                    <Table2 className={`w-4 h-4 ${muted}`} />
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                        <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                          {currentSheet.headers.map((header) => (
                            <th key={header} className={`text-left px-5 py-3 font-medium whitespace-nowrap ${darkMode ? "text-white/55" : "text-black/45"}`}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 100).map((row) => (
                          <tr key={row.__rowIndex} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                            {currentSheet.headers.map((header) => {
                              const urls = extractUrls(row[header]);
                              return (
                                <td key={header} className={`px-5 py-3 min-w-[170px] align-top ${darkMode ? "text-white/75" : "text-black/65"}`}>
                                  {urls.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {urls.slice(0, 3).map((url) => (
                                        <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${darkMode ? "bg-white/5 text-white/70" : "bg-black/[0.04] text-black/60"}`}>
                                          <ArrowUpRight className="w-3 h-3" /> Link
                                        </a>
                                      ))}
                                      {urls.length > 3 && <span className={`text-xs ${muted}`}>+{urls.length - 3}</span>}
                                    </div>
                                  ) : cleanValue(row[header]) || "—"}
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
            )}
          </div>
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-5">
          <div className={`w-full max-w-lg rounded-[24px] p-5 sm:rounded-[28px] sm:p-6 ${darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"}`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${muted}`}>New architecture</p>
                <h3 className={`text-2xl  ${darkMode ? "text-white" : "text-black"}`}>Add Google Sheet</h3>
              </div>
              <button onClick={() => setAddModal(false)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
                <X className={`w-5 h-5 ${muted}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`text-xs uppercase tracking-widest mb-2 block ${muted}`}>Sheet URL</label>
                <input
                  value={sheetUrl}
                  onChange={(event) => setSheetUrl(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className={`w-full px-4 py-4 rounded-2xl text-sm outline-none ${darkMode ? "bg-white/5 text-white placeholder-white/25" : "bg-black/[0.03] text-black placeholder-black/30"}`}
                />
              </div>
              <div>
                <label className={`text-xs uppercase tracking-widest mb-2 block ${muted}`}>Display name</label>
                <input
                  value={sheetName}
                  onChange={(event) => setSheetName(event.target.value)}
                  placeholder="Site daily report"
                  className={`w-full px-4 py-4 rounded-2xl text-sm outline-none ${darkMode ? "bg-white/5 text-white placeholder-white/25" : "bg-black/[0.03] text-black placeholder-black/30"}`}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-6 sm:flex-row">
              <button onClick={() => setAddModal(false)} className={`flex-1 px-4 py-3 rounded-full ${darkMode ? "bg-white/5 text-white" : "bg-black/[0.04] text-black"}`}>Cancel</button>
              <button onClick={handleAddSheet} disabled={adding || !sheetUrl.trim()} className={`flex-1 px-4 py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                Build Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
