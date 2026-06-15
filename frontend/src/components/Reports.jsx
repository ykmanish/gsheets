import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, FileText, Loader2, Search, X } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = "http://localhost:5000";

export default function Reports({ darkMode }) {
  const [reports, setReports] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "", automationId: "", status: "" });

  const panel = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white/80 border border-black/5";
  const muted = darkMode ? "text-white/50" : "text-black/45";
  const input = darkMode ? "bg-white/5 border border-white/10 text-white" : "bg-black/[0.03] border border-black/10 text-black";

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

  const statusClass = (status) => {
    if (status === "failed" || status === "partial") return "text-amber-500";
    return "text-green-500";
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 newq" style={{ background: darkMode ? "linear-gradient(180deg,#111318,#0c0d10)" : "linear-gradient(180deg,#f7f6f2,#f3f1ea)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${muted}`}>Automation history</p>
          <h2 className={`text-4xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>Reports and AI briefings</h2>
          <p className={`text-sm mt-4 max-w-2xl ${muted}`}>Each scheduled or manual run is stored here with matched rows, executed actions, and AI findings.</p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            ["Runs", totals.runs],
            ["Rows checked", totals.rows],
            ["Rows matched", totals.matched],
            ["Actions", totals.actions],
          ].map(([label, value]) => (
            <div key={label} className={`rounded-[24px] p-5 ${panel}`}>
              <p className={`text-sm ${muted}`}>{label}</p>
              <p className={`text-3xl font-semibold mt-5 ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className={`rounded-[26px] p-5 mb-6 grid md:grid-cols-4 gap-3 ${panel}`}>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={`rounded-2xl px-4 py-3 outline-none ${input}`} />
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={`rounded-2xl px-4 py-3 outline-none ${input}`} />
          <select value={filters.automationId} onChange={(e) => setFilters({ ...filters, automationId: e.target.value })} className={`rounded-2xl px-4 py-3 outline-none ${input}`}>
            <option value="">All automations</option>
            {automations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={`rounded-2xl px-4 py-3 outline-none ${input}`}>
            <option value="">All statuses</option>
            <option value="success">Successful</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className={`rounded-[30px] overflow-hidden ${panel}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                  {["Date", "Automation", "Category", "Rows", "Matched", "Actions", "Status", ""].map((label) => (
                    <th key={label} className={`text-left px-6 py-5 text-[11px] uppercase tracking-[0.2em] font-medium ${muted}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="py-20 text-center"><Loader2 className={`w-7 h-7 mx-auto animate-spin ${muted}`} /></td></tr>
                ) : reports.length === 0 ? (
                  <tr><td colSpan="8" className="py-20 text-center"><FileText className={`w-10 h-10 mx-auto mb-4 ${muted}`} /><p className={muted}>No reports match these filters.</p></td></tr>
                ) : reports.map((report) => (
                  <tr key={report.id} className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    <td className={`px-6 py-5 text-sm ${muted}`}>{new Date(report.createdAt).toLocaleString()}</td>
                    <td className={`px-6 py-5 text-sm ${darkMode ? "text-white" : "text-black"}`}>{report.automationName}</td>
                    <td className={`px-6 py-5 text-sm ${muted}`}>{report.category || report.type}</td>
                    <td className={`px-6 py-5 text-sm ${muted}`}>{report.totalRowsChecked || 0}</td>
                    <td className={`px-6 py-5 text-sm ${muted}`}>{report.totalMatched || report.totalPendingFound || 0}</td>
                    <td className={`px-6 py-5 text-sm ${muted}`}>{(report.actions || []).map((item) => item.type).join(", ") || "report"}</td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${statusClass(report.status)}`}>
                        {report.status === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-5"><button onClick={() => openReport(report)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "bg-white/5 text-white" : "bg-black/[0.04] text-black"}`}><Search className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-5">
          <div className={`w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[30px] p-7 ${darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"}`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${muted}`}>Run detail</p>
                <h3 className={`text-2xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>{selectedReport.automationName}</h3>
                <p className={`text-sm mt-2 ${muted}`}>{new Date(selectedReport.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}><X className={`w-5 h-5 ${muted}`} /></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                ["Rows", selectedReport.totalRowsChecked || 0],
                ["Matched", selectedReport.totalMatched || selectedReport.totalPendingFound || 0],
                ["Sources", (selectedReport.sources || selectedReport.processedSheets || []).length],
                ["Actions", (selectedReport.actions || []).length],
              ].map(([label, value]) => <div key={label} className={`rounded-2xl p-4 ${panel}`}><p className={`text-xs ${muted}`}>{label}</p><p className={`text-2xl mt-2 ${darkMode ? "text-white" : "text-black"}`}>{value}</p></div>)}
            </div>

            {selectedReport.aiInsight && (
              <div className={`rounded-2xl p-5 mb-5 ${panel}`}>
                <div className="flex items-center gap-2 mb-3"><Bot className="w-4 h-4 text-purple-500" /><span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>AI insight via {selectedReport.aiInsight.provider}</span></div>
                <p className={`text-sm leading-6 whitespace-pre-wrap ${muted}`}>{selectedReport.aiInsight.text}</p>
              </div>
            )}

            <div className={`rounded-2xl p-5 mb-5 ${panel}`}>
              <h4 className={`font-medium mb-3 ${darkMode ? "text-white" : "text-black"}`}>Actions</h4>
              <div className="space-y-2">
                {(selectedReport.actions || []).map((action, index) => (
                  <div key={`${action.type}-${index}`} className={`text-sm flex justify-between gap-3 rounded-xl px-4 py-3 ${darkMode ? "bg-white/5" : "bg-black/[0.03]"}`}>
                    <span className={darkMode ? "text-white" : "text-black"}>{action.type}</span>
                    <span className={action.status === "failed" ? "text-red-500" : "text-green-500"}>{action.status}{action.error ? `: ${action.error}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl p-5 ${panel}`}>
              <h4 className={`font-medium mb-3 ${darkMode ? "text-white" : "text-black"}`}>Matched rows preview</h4>
              {(selectedReport.items || []).length === 0 ? (
                <p className={`text-sm ${muted}`}>No matched rows were stored for this run.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {(selectedReport.items || []).slice(0, 12).map((row, index) => (
                        <tr key={index} className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                          <td className={`py-3 pr-4 ${muted}`}>Row {row.__rowIndex || row.rowIndex || index + 1}</td>
                          <td className={`py-3 ${darkMode ? "text-white/80" : "text-black/70"}`}>
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
