import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, FileText, History, Layers, ListChecks, Loader2, PlayCircle, Rows3, Search, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { Chip, DateRangePicker, EmptyState, IconTile, PageHeader, SelectMenu, StatTile } from "./ui";
import { API_URL } from "./AuthProvider";

export default function Reports({ darkMode }) {
  const [reports, setReports] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "", automationId: "", status: "" });

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const ink = darkMode ? "text-white" : "text-[#141414]";
  const card = darkMode ? "border border-white/10 bg-[#15171c]" : "border border-[#ececec] bg-white";
  const soft = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
  const hair = darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]";

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const [reportRes, automationRes] = await Promise.all([
        fetch(`${API_URL}/reports?${params}`),
        fetch(`${API_URL}/automations`),
      ]);
      const [reportData, automationData] = await Promise.all([reportRes.json(), automationRes.json()]);
      setReports(reportData.reports || []);
      setAutomations(automationData.automations || []);
    } catch {
      toast.error("Could not load reports");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadReports(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadReports]);

  const totals = useMemo(() => reports.reduce((sum, report) => ({
    runs: sum.runs + 1,
    rows: sum.rows + (report.totalRowsChecked || 0),
    matched: sum.matched + (report.totalMatched || report.totalPendingFound || 0),
    actions: sum.actions + (report.actions || []).length,
  }), { runs: 0, rows: 0, matched: 0, actions: 0 }), [reports]);

  const openReport = async (report) => {
    setSelectedReport(report);
    if (!report.readAt) {
      await fetch(`${API_URL}/reports/${report.id}/read`, { method: "PATCH" });
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, readAt: new Date().toISOString() } : item));
    }
  };

  const statusTone = (status) => {
    if (status === "failed") return "rose";
    if (status === "partial") return "amber";
    return "mint";
  };

  return (
    <div className={`newq flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          darkMode={darkMode}
          badge="Automation history"
          badgeIcon={History}
          badgeTone="lavender"
          title="Reports"
          subtitle="every automation run, with AI notes"
          description="Each scheduled or manual run is stored here with matched rows, executed actions, and AI findings."
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile darkMode={darkMode} icon={PlayCircle} tone="mint" value={totals.runs} label="Runs" />
          <StatTile darkMode={darkMode} icon={Rows3} tone="lavender" value={totals.rows} label="Rows checked" />
          <StatTile darkMode={darkMode} icon={ListChecks} tone="peach" value={totals.matched} label="Rows matched" />
          <StatTile darkMode={darkMode} icon={Zap} tone="sky" value={totals.actions} label="Actions" />
        </div>

        <section className={`rounded-[20px] ${card}`}>
          <div className={`flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between ${hair}`}>
            <div className="flex items-center gap-3">
              <IconTile icon={FileText} tone="neutral" darkMode={darkMode} size="sm" />
              <div>
                <p className={`text-[15px] ${ink}`}>Run log</p>
                <p className={`text-[12px] ${muted}`}>{reports.length} {reports.length === 1 ? "run" : "runs"} for these filters</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:w-[720px]">
              <DateRangePicker
                darkMode={darkMode}
                className=""
                from={filters.from}
                to={filters.to}
                onChange={(range) => setFilters((current) => ({ ...current, ...range }))}
              />
              <SelectMenu
                darkMode={darkMode}
                value={filters.automationId}
                onChange={(automationId) => setFilters((current) => ({ ...current, automationId }))}
                options={[
                  { value: "", label: "All automations" },
                  ...automations.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
              <SelectMenu
                darkMode={darkMode}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "success", label: "Successful" },
                  { value: "partial", label: "Partial" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 className={`mx-auto h-6 w-6 animate-spin ${muted}`} /></div>
          ) : reports.length === 0 ? (
            <div className="p-5"><EmptyState darkMode={darkMode} icon={FileText} tone="lavender" title="No reports yet" text="No reports match these filters." /></div>
          ) : (
            <div className="overflow-x-auto px-2 pb-2">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead>
                  <tr>
                    {["Date", "Automation", "Category", "Rows", "Matched", "Actions", "Status", ""].map((label) => (
                      <th key={label} className={`px-4 py-3 text-left text-[12px] font-normal ${muted}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className={`border-t ${hair}`}>
                      <td className={`px-4 py-3.5 tabular-nums ${muted}`}>{new Date(report.createdAt).toLocaleString()}</td>
                      <td className={`px-4 py-3.5 ${ink}`}>
                        <span className="inline-flex items-center gap-2">
                          {!report.readAt && <span className={`h-1.5 w-1.5 rounded-full ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`} />}
                          {report.automationName}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 ${muted}`}>{report.category || report.type}</td>
                      <td className={`px-4 py-3.5 tabular-nums ${muted}`}>{report.totalRowsChecked || 0}</td>
                      <td className={`px-4 py-3.5 tabular-nums ${muted}`}>{report.totalMatched || report.totalPendingFound || 0}</td>
                      <td className={`px-4 py-3.5 ${muted}`}>{(report.actions || []).map((item) => item.type).join(", ") || "report"}</td>
                      <td className="px-4 py-3.5">
                        <Chip darkMode={darkMode} tone={statusTone(report.status)} icon={report.status === "success" ? CheckCircle2 : AlertCircle}>{report.status}</Chip>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => openReport(report)} aria-label="Open report" className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "bg-white/[0.06] text-white hover:bg-white/10" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}><Search className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-5">
          <div className={`max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[24px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`} style={{ boxShadow: "var(--ui-shadow-pop)" }}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <IconTile icon={FileText} tone="lavender" darkMode={darkMode} size="md" />
                <div className="min-w-0">
                  <h3 className={`text-[20px] leading-tight tracking-[-0.01em] ${ink}`}>{selectedReport.automationName}</h3>
                  <p className={`mt-1 text-[13px] ${muted}`}>Run on {new Date(selectedReport.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setSelectedReport(null)} aria-label="Close" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}><X className="h-4 w-4" /></button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile darkMode={darkMode} icon={Rows3} tone="lavender" value={selectedReport.totalRowsChecked || 0} label="Rows" />
              <StatTile darkMode={darkMode} icon={ListChecks} tone="peach" value={selectedReport.totalMatched || selectedReport.totalPendingFound || 0} label="Matched" />
              <StatTile darkMode={darkMode} icon={Layers} tone="sky" value={(selectedReport.sources || selectedReport.processedSheets || []).length} label="Sources" />
              <StatTile darkMode={darkMode} icon={Zap} tone="mint" value={(selectedReport.actions || []).length} label="Actions" />
            </div>

            {selectedReport.aiInsight && (
              <div className={`mb-5 rounded-[20px] p-5 ${darkMode ? "bg-[#cff07a]/10" : "bg-[#eef8cc]"}`}>
                <div className="mb-3 flex items-center gap-2.5"><Bot className={`h-4 w-4 ${darkMode ? "text-[#d8f39a]" : "text-[#4d6b12]"}`} /><span className={`text-[14px] ${ink}`}>AI insight via {selectedReport.aiInsight.provider}</span></div>
                <p className={`whitespace-pre-wrap text-[13px] leading-6 ${darkMode ? "text-white/70" : "text-[#3d4a1a]"}`}>{selectedReport.aiInsight.text}</p>
              </div>
            )}

            <div className={`mb-5 rounded-[20px] p-5 ${card}`}>
              <div className="mb-3 flex items-center gap-2.5"><IconTile icon={Zap} tone="sky" darkMode={darkMode} size="xs" /><h4 className={`text-[15px] ${ink}`}>Actions</h4></div>
              <div className="space-y-2">
                {(selectedReport.actions || []).map((action, index) => (
                  <div key={`${action.type}-${index}`} className={`flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-[13px] ${soft}`}>
                    <span className={ink}>{action.type}</span>
                    <Chip darkMode={darkMode} tone={action.status === "failed" ? "rose" : "mint"}>{action.status}{action.error ? `: ${action.error}` : ""}</Chip>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-[20px] p-5 ${card}`}>
              <div className="mb-3 flex items-center gap-2.5"><IconTile icon={Rows3} tone="peach" darkMode={darkMode} size="xs" /><h4 className={`text-[15px] ${ink}`}>Matched rows preview</h4></div>
              {(selectedReport.items || []).length === 0 ? (
                <p className={`text-[13px] ${muted}`}>No matched rows were stored for this run.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <tbody>
                      {(selectedReport.items || []).slice(0, 12).map((row, index) => (
                        <tr key={index} className={`border-t first:border-t-0 ${hair}`}>
                          <td className={`whitespace-nowrap py-3 pr-4 tabular-nums ${muted}`}>Row {row.__rowIndex || row.rowIndex || index + 1}</td>
                          <td className={`py-3 ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}>
                            {Object.entries(row).filter(([key]) => !key.startsWith("__")).slice(0, 5).map(([key, value]) => `${key}: ${value}`).join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
