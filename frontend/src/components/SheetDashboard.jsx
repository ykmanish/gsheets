import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Cloud,
  Eye,
  Image as ImageIcon,
  Layers3,
  Loader2,
  PieChart,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Sheet,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, Chip, DateRangePicker, EmptyState, IconTile, PageHeader, SelectMenu, StatTile } from "./ui";
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
// Soft chart colours drawn from the kit's pastel tones, deep enough to read on white and dark.
const CHART_COLORS = ["#7fbf8e", "#9b87e6", "#ee9a72", "#78a9e3", "#e88a98", "#b9d65a", "#e2b84a", "#9a9a98"];
const ROW_TONES = ["mint", "lavender", "peach", "sky", "rose", "lime", "amber"];

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

function toneFor(value) {
  const text = String(value || "sheet");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % ROW_TONES.length;
  return ROW_TONES[Math.abs(hash) % ROW_TONES.length];
}

function ChartCard({ title, description, icon = BarChart3, tone = "neutral", darkMode, children }) {
  return (
    <div className={`rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
      <div className="mb-4 flex items-start gap-3">
        <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
        <div className="min-w-0">
          <h3 className={`text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h3>
          {description && <p className={`mt-0.5 text-[12.5px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
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
    : `${darkMode ? "rgba(255,255,255,0.08)" : "#f0f0ee"} 0 100%`;

  return (
    <ChartCard title={title} description={description} icon={PieChart} tone="lavender" darkMode={darkMode}>
      <div className="grid items-center gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div
          className="relative h-[136px] w-[136px] rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className={`absolute inset-7 flex flex-col items-center justify-center rounded-full ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#141414]"}`}>
            <span className="text-[20px] leading-none tracking-[-0.02em] tabular-nums">{total}</span>
            <span className={`mt-1 text-[10.5px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{centerLabel}</span>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          {items.map((item, index) => (
            <div key={item.label} className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className={`flex-1 truncate text-[12.5px] ${darkMode ? "text-white/65" : "text-[#3d3d3b]"}`}>{item.label}</span>
              <span className={`text-[12px] tabular-nums ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{item.value}</span>
            </div>
          ))}
          {items.length === 0 && <p className={`text-[13px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>No chart data yet.</p>}
        </div>
      </div>
    </ChartCard>
  );
}

function ColumnBars({ title, description, data, darkMode }) {
  const items = data.filter((item) => item.value > 0).slice(0, 10);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ChartCard title={title} description={description} icon={BarChart3} tone="sky" darkMode={darkMode}>
      <div className="flex h-56 items-end gap-3">
        {items.map((item, index) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className={`text-[12px] tabular-nums ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{item.value}</div>
            <div className={`flex w-full items-end overflow-hidden rounded-[12px] ${darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]"}`} style={{ height: 150 }}>
              <div
                className="w-full rounded-[12px]"
                style={{
                  height: `${Math.max(8, (item.value / max) * 100)}%`,
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <p className={`w-full truncate text-center text-[11px] ${darkMode ? "text-white/55" : "text-[#8a8a8a]"}`}>{item.label}</p>
          </div>
        ))}
        {items.length === 0 && <p className={`text-[13px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>No bar chart data yet.</p>}
      </div>
    </ChartCard>
  );
}

function ColorBars({ title, description, data, darkMode }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ChartCard title={title} description={description} icon={BarChart3} tone="mint" darkMode={darkMode}>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
              <span className={`truncate ${darkMode ? "text-white/65" : "text-[#3d3d3b]"}`}>{item.label}</span>
              <span className={`tabular-nums ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{item.value}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(7, (item.value / max) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className={`text-[13px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>No chart data yet.</p>}
      </div>
    </ChartCard>
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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";

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

  const ink = darkMode ? "text-white" : "text-[#141414]";
  const hair = darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]";
  const soft = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
  const fieldInput = `w-full h-11 rounded-full border px-4 text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`;
  const readyCount = documents.filter((doc) => doc.isReady).length;
  const failedCount = documents.filter((doc) => doc.status === "failed").length;

  return (
    <div className={`newq flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:overflow-hidden ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-6">
        <PageHeader
          darkMode={darkMode}
          className="flex-shrink-0"
          badge="Adaptive sheet intelligence"
          badgeIcon={Sparkles}
          badgeTone="lime"
          title="Sheet dashboard"
          subtitle="a visual read of every linked sheet"
          description="Select a sheet and open a visual dashboard built from its own architecture."
          actions={<>
            <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={() => setAddModal(true)}>Add sheet</Button>
            <button onClick={() => void loadDocuments()} aria-label="Refresh" title="Refresh" className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] text-white hover:bg-white/10" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
              <RefreshCw className="h-4 w-4" />
            </button>
          </>}
        />

        {!loadingDocs && documents.length > 0 && (
          <div className="grid flex-shrink-0 grid-cols-3 gap-3">
            <StatTile darkMode={darkMode} icon={Sheet} tone="mint" value={documents.length} label="Linked sheets" className="min-h-[104px]" />
            <StatTile darkMode={darkMode} icon={CheckCircle2} tone="lime" value={readyCount} label="Ready to view" className="min-h-[104px]" />
            <StatTile darkMode={darkMode} icon={AlertCircle} tone={failedCount ? "rose" : "neutral"} value={failedCount} label="Need a retry" className="min-h-[104px]" />
          </div>
        )}

        <div className={`min-h-0 flex-1 overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
          {loadingDocs ? (
            <div className="flex h-full min-h-[240px] items-center justify-center"><Loader2 className={`h-7 w-7 animate-spin ${muted}`} /></div>
          ) : documents.length === 0 ? (
            <div className="p-5"><EmptyState darkMode={darkMode} icon={Sheet} tone="mint" title="No sheets yet" text="Add a Google Sheet link to create the first visual dashboard." /></div>
          ) : (
            <div className="h-full overflow-auto px-2 pb-2">
              <table className="w-full min-w-[780px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr>
                    {["Sheet", "Status", "Synced", "Chunks", "Dashboard"].map((header) => (
                      <th key={header} className={`px-4 py-3.5 text-[12px] font-normal ${muted}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className={`border-t transition-colors ${hair} ${darkMode ? "hover:bg-white/[0.02]" : "hover:bg-[#fafaf9]"}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <IconTile icon={Sheet} tone="mint" darkMode={darkMode} size="sm" />
                          <div className="min-w-0">
                            <p className={`truncate text-[13.5px] ${ink}`}>{doc.name}</p>
                            <p className={`mt-0.5 text-[12px] ${muted}`}>{doc.sheetArchitecture ? `Architecture v${doc.sheetArchitecture.version}` : "Architecture builds on view"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Chip darkMode={darkMode} tone={doc.isReady ? "mint" : doc.status === "failed" ? "rose" : "amber"}>
                          {doc.isReady ? "Ready" : doc.status || "Processing"}
                        </Chip>
                      </td>
                      <td className={`px-4 py-3.5 text-[13px] tabular-nums ${muted}`}>{doc.lastSyncedAt ? new Date(doc.lastSyncedAt).toLocaleString() : "Not synced"}</td>
                      <td className={`px-4 py-3.5 text-[13px] tabular-nums ${muted}`}>{doc.chunks || 0}</td>
                      <td className="px-4 py-3.5">
                        <Button
                          darkMode={darkMode}
                          size="sm"
                          variant={doc.status === "failed" ? "secondary" : "primary"}
                          onClick={() => doc.status === "failed" ? handleRetrySync(doc) : handleViewDashboard(doc)}
                          disabled={(!doc.isReady && doc.status !== "failed") || loadingSheet}
                          loading={loadingSheet && selectedSheetId === doc.id}
                          icon={doc.status === "failed" ? RefreshCw : Eye}
                        >
                          {doc.status === "failed" ? "Retry sync" : "View dashboard"}
                        </Button>
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
        <div className="fixed inset-0 z-50 bg-black/35 p-2 backdrop-blur-[2px] sm:p-4">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#121317]" : "border-[#ececec] bg-white"}`}>
            <div className={`flex flex-col gap-4 border-b px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={BarChart3} tone="lime" darkMode={darkMode} size="md" />
                <div className="min-w-0">
                  <h3 className={`truncate text-[18px] tracking-[-0.01em] ${ink}`}>{selectedDocument?.name || "Sheet dashboard"}</h3>
                  <p className={`text-[12.5px] ${muted}`}>Visual dashboard</p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
                <div className={`flex h-10 w-full max-w-sm items-center gap-2 rounded-full px-4 ${darkMode ? "bg-white/[0.06] text-white" : "bg-[#f4f4f2] text-[#141414]"}`}>
                  <Search className={`h-4 w-4 flex-shrink-0 ${muted}`} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search all dashboard data..."
                    className={`min-w-0 flex-1 bg-transparent text-[13.5px] outline-none ${darkMode ? "placeholder:text-white/35" : "placeholder:text-[#a3a3a0]"}`}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className={`text-[12px] ${muted}`}>Clear</button>
                  )}
                </div>
                {!['asteria-client-dl', 'iskon-bhavnagar-client-dl', 'kalhar-client-dl', 'aurika-client-dl', 'devsharnam-client-dl', 'empereon-client-dl', 'harmony-client-dl', 'imperial-client-dl', 'sheetal-client-dl', 'silverwhite-client-dl'].includes(sheetData?.architecture?.kind) && <div className="w-full sm:w-[320px]">
                  <DateRangePicker
                    darkMode={darkMode}
                    className=""
                    from={dateFilters.from}
                    to={dateFilters.to}
                    onChange={(range) => setDateFilters((current) => ({ ...current, ...range }))}
                    placeholder="Choose sheet dates"
                  />
                </div>}
                {!['asteria-client-dl', 'iskon-bhavnagar-client-dl', 'kalhar-client-dl', 'aurika-client-dl', 'devsharnam-client-dl', 'empereon-client-dl', 'harmony-client-dl', 'imperial-client-dl', 'sheetal-client-dl', 'silverwhite-client-dl', 'kalhaarPendingWorkDl'].includes(sheetData?.architecture?.kind) && (dateFilters.from || dateFilters.to) && (
                  <Button darkMode={darkMode} variant="soft" size="sm" onClick={() => setDateFilters({ from: "", to: "" })}>Clear dates</Button>
                )}
                <SelectMenu
                  darkMode={darkMode}
                  value={activeTab || ""}
                  onChange={setActiveTab}
                  className="w-full min-w-[220px] sm:w-[280px]"
                  options={[
                    ...(["asteria-client-dl", "iskon-bhavnagar-client-dl", "kalhar-client-dl", "aurika-client-dl", "devsharnam-client-dl", "empereon-client-dl", "harmony-client-dl", "imperial-client-dl", "sheetal-client-dl", "silverwhite-client-dl", "kalhaarPendingWorkDl"].includes(sheetData?.architecture?.kind) ? [{ value: "__overview", label: "Executive overview" }] : []),
                    ...(sheetData?.sheets || []).map((sheet) => ({ value: sheet.name, label: sheet.name })),
                  ]}
                />
                <button onClick={() => setDashboardOpen(false)} aria-label="Close" className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] text-white hover:bg-white/10" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!sheetData || !currentSheet ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className={`h-7 w-7 animate-spin ${muted}`} /></div>
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
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <StatTile darkMode={darkMode} icon={Rows3} tone="mint" label={searchQuery ? "Matching rows" : "Rows"} value={filteredRows.length.toLocaleString()} />
                  <StatTile darkMode={darkMode} icon={Layers3} tone="sky" label={entityColumn || "Groups"} value={countBy(filteredRows, entityColumn).length.toLocaleString()} />
                  <StatTile darkMode={darkMode} icon={ImageIcon} tone="amber" label="Media" value={mediaItems.length.toLocaleString()} />
                  <StatTile darkMode={darkMode} icon={AlertCircle} tone="rose" label="Alerts" value={challengeCount.toLocaleString()} />
                  <StatTile darkMode={darkMode} icon={CalendarDays} tone="lavender" label="Latest" value={latestDate ? latestDate.toLocaleDateString() : "N/A"} />
                </div>

                <div className="mb-5 grid gap-4 xl:grid-cols-2">
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

                <div className="mb-5 grid gap-4 xl:grid-cols-2">
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

                <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_0.7fr]">
                  <ColorBars
                    darkMode={darkMode}
                    title={ownerColumn ? `Bar graph by ${ownerColumn}` : "Ownership bar graph"}
                    description="Horizontal comparison of record ownership or assignee distribution."
                    data={countBy(filteredRows, ownerColumn)}
                  />
                  <ChartCard title="Architecture" description="How this sheet is laid out" icon={Table2} tone="peach" darkMode={darkMode}>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Tabs", sheetData.sheets?.length || 0],
                        ["Columns", currentSheet.headers.length],
                        ["Media cols", mediaColumns.length],
                        ["Shown rows", filteredRows.length],
                      ].map(([label, value]) => (
                        <div key={label} className={`rounded-[14px] p-4 ${soft}`}>
                          <p className={`text-[12px] ${muted}`}>{label}</p>
                          <p className={`mt-1.5 text-[24px] leading-none tracking-[-0.02em] tabular-nums ${ink}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>

                <div className="mb-5 grid gap-4 xl:grid-cols-2">
                  {sortedRows.map((row) => {
                    const rowMedia = mediaColumns.flatMap((column) => extractUrls(row[column]).map((url) => ({ url, column })));
                    const cardTitle = cleanValue(row[entityColumn]) || `Row ${row.__rowIndex}`;
                    const tone = toneFor(cardTitle);
                    return (
                      <article key={`${row.__sheetName}-${row.__rowIndex}`} className={`relative overflow-hidden rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <IconTile icon={<span className="text-[14px]">{getInitials(cardTitle)}</span>} tone={tone} darkMode={darkMode} size="md" />
                            <div className="min-w-0">
                              <h4 className={`truncate text-[17px] tracking-[-0.01em] ${ink}`}>{cardTitle}</h4>
                              <p className={`mt-0.5 truncate text-[13px] ${muted}`}>{cleanValue(row[ownerColumn]) || currentSheet.name}</p>
                            </div>
                          </div>
                          {dateColumn && cleanValue(row[dateColumn]) && (
                            <Chip darkMode={darkMode} tone="neutral" icon={CalendarDays} className="whitespace-nowrap">
                              {parseDate(row[dateColumn])?.toLocaleDateString() || cleanValue(row[dateColumn])}
                            </Chip>
                          )}
                        </div>

                        <div className="mt-5 grid gap-2 sm:grid-cols-2">
                          {recordFields.map((field) => (
                            <div key={field} className={`rounded-[14px] p-3 ${soft}`}>
                              <p className={`mb-0.5 text-[11.5px] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>{field}</p>
                              <p className={`break-words text-[13px] leading-5 ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}>{cleanValue(row[field]) || "—"}</p>
                            </div>
                          ))}
                        </div>

                        {rowMedia.length > 0 && (
                          <div className="mt-5">
                            <p className={`mb-2.5 text-[12px] ${muted}`}>Drive attachments</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {rowMedia.map((item, index) => (
                                <a
                                  key={`${item.url}-${index}`}
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center justify-between gap-3 rounded-[14px] p-3 transition-colors ${darkMode ? "bg-white/[0.04] text-white/75 hover:bg-white/[0.08]" : "bg-[#f7f7f5] text-[#3d3d3b] hover:bg-[#f0f0ee]"}`}
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <IconTile icon={Cloud} tone="mint" darkMode={darkMode} size="sm" />
                                    <span className="min-w-0">
                                      <span className={`block truncate text-[13px] ${ink}`}>{item.column}</span>
                                      <span className={`mt-0.5 block text-[12px] ${muted}`}>Google Drive link {index + 1}</span>
                                    </span>
                                  </span>
                                  <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
                  <div className={`flex items-center gap-3 border-b px-5 py-4 ${hair}`}>
                    <IconTile icon={Table2} tone="neutral" darkMode={darkMode} size="sm" />
                    <div>
                      <h3 className={`text-[15px] ${ink}`}>Complete data</h3>
                      <p className={`text-[12px] ${muted}`}>First 100 rows of {currentSheet.name}</p>
                    </div>
                  </div>
                  <div className="max-h-[360px] overflow-auto px-2 pb-2">
                    <table className="w-full min-w-[760px] text-[13px]">
                      <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                        <tr>
                          {currentSheet.headers.map((header) => (
                            <th key={header} className={`whitespace-nowrap px-4 py-3 text-left text-[12px] font-normal ${muted}`}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 100).map((row) => (
                          <tr key={row.__rowIndex} className={`border-t ${hair}`}>
                            {currentSheet.headers.map((header) => {
                              const urls = extractUrls(row[header]);
                              return (
                                <td key={header} className={`min-w-[170px] px-4 py-3 align-top ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>
                                  {urls.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {urls.slice(0, 3).map((url) => (
                                        <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] ${darkMode ? "bg-white/[0.06] text-white/70" : "bg-[#f4f4f2] text-[#3d3d3b]"}`}>
                                          <ArrowUpRight className="h-3 w-3" /> Link
                                        </a>
                                      ))}
                                      {urls.length > 3 && <span className={`text-[12px] ${muted}`}>+{urls.length - 3}</span>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-5">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`w-full max-w-lg rounded-[24px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <IconTile icon={Sheet} tone="mint" darkMode={darkMode} size="md" />
                <div>
                  <h3 className={`text-[20px] leading-tight tracking-[-0.01em] ${ink}`}>Add Google Sheet</h3>
                  <p className={`mt-1 text-[13px] ${muted}`}>A new dashboard is built from its architecture</p>
                </div>
              </div>
              <button onClick={() => setAddModal(false)} aria-label="Close" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`mb-1.5 block text-[12px] ${muted}`}>Sheet URL</label>
                <input
                  value={sheetUrl}
                  onChange={(event) => setSheetUrl(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={`mb-1.5 block text-[12px] ${muted}`}>Display name</label>
                <input
                  value={sheetName}
                  onChange={(event) => setSheetName(event.target.value)}
                  placeholder="Site daily report"
                  className={fieldInput}
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button darkMode={darkMode} variant="secondary" onClick={() => setAddModal(false)}>Cancel</Button>
              <Button darkMode={darkMode} variant="primary" icon={ImageIcon} loading={adding} onClick={handleAddSheet} disabled={adding || !sheetUrl.trim()}>Build dashboard</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
