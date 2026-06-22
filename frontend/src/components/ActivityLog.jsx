import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  MessageCircleMore,
  Settings,
  Shield,
  UserCog,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";

export default function ActivityLog({ darkMode }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState(null);

  const panel = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white/80 border border-black/5";
  const muted = darkMode ? "text-white/50" : "text-black/45";

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/activity-logs?limit=300`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLogs(data.logs || []);
    } catch {
      toast.error("Could not load activity logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadLogs(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadLogs]);

  function getTargetLabel(log) {
    if (log.target) return log.target;
    const userMatch = log.path?.match(/\/admin\/users\/([^/]+)/);
    if (userMatch) return `User ID: ${userMatch[1]}`;
    const roleMatch = log.path?.match(/\/admin\/roles\/([^/]+)/);
    if (roleMatch) return `Role ID: ${roleMatch[1]}`;
    const documentMatch = log.path?.match(/\/documents\/([^/]+)/);
    if (documentMatch) return `Document ID: ${documentMatch[1]}`;
    return "N/A";
  }

  function truncateTarget(value) {
    const text = String(value || "N/A");
    return text.length > 15 ? `${text.slice(0, 15)}...` : text;
  }

  function formatDate(value) {
    if (!value) return "N/A";
    return new Date(value).toLocaleDateString();
  }

  function formatDateTime(value) {
    if (!value) return "N/A";
    return new Date(value).toLocaleString();
  }

  function getCategoryMeta(log) {
    const category = log.category || "system";
    const map = {
      auth: { label: "Auth", Icon: Lock, color: darkMode ? "text-sky-300 bg-sky-500/10" : "text-sky-700 bg-sky-50" },
      admin: { label: "Admin", Icon: UserCog, color: darkMode ? "text-violet-300 bg-violet-500/10" : "text-violet-700 bg-violet-50" },
      document: { label: "Document", Icon: FileText, color: darkMode ? "text-[#d8f36a] bg-[#d8f36a]/10" : "text-green-700 bg-green-50" },
      automation: { label: "Automation", Icon: Bot, color: darkMode ? "text-cyan-300 bg-cyan-500/10" : "text-cyan-700 bg-cyan-50" },
      notification: { label: "Notification", Icon: Bell, color: darkMode ? "text-amber-300 bg-amber-500/10" : "text-amber-700 bg-amber-50" },
      report: { label: "Report", Icon: Shield, color: darkMode ? "text-fuchsia-300 bg-fuchsia-500/10" : "text-fuchsia-700 bg-fuchsia-50" },
      whatsapp: { label: "WhatsApp", Icon: MessageCircleMore, color: darkMode ? "text-emerald-300 bg-emerald-500/10" : "text-emerald-700 bg-emerald-50" },
      system: { label: "System", Icon: Settings, color: darkMode ? "text-white/60 bg-white/5" : "text-black/55 bg-black/5" },
    };
    return map[category] || map.system;
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden px-4 py-4 newq sm:px-6 lg:px-8 lg:py-8" style={{ background: darkMode ? "linear-gradient(180deg,#111318,#0c0d10)" : "linear-gradient(180deg,#f7f6f2,#f3f1ea)" }}>
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <div className="mb-6 flex-shrink-0">
          <p className={`mb-3 text-[11px] uppercase tracking-[0.32em] ${muted}`}>System trail</p>
          <h2 className={`small text-2xl font-semibold sm:text-3xl md:text-4xl ${darkMode ? "text-white" : "text-black"}`}>Activity Log</h2>
          <p className={`mt-4 max-w-2xl text-sm ${muted}`}>Track user actions, automation runs, document changes, notifications, and admin updates.</p>
        </div>

        <div className={`min-h-0 flex-1 overflow-hidden rounded-[30px] ${panel}`}>
          {loading ? (
            <div className="flex h-full items-center justify-center py-20">
              <Loader2 className={`h-7 w-7 animate-spin ${muted}`} />
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    {["Date", "User", "Action", "Target", "Status", "Details"].map((header) => (
                      <th key={header} className={`px-5 py-4 text-[11px] uppercase tracking-[0.18em] font-medium ${muted}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-16 text-center">
                        <Activity className={`mx-auto mb-4 h-10 w-10 ${muted}`} />
                        <p className={`text-lg ${darkMode ? "text-white" : "text-black"}`}>No activity yet</p>
                      </td>
                    </tr>
                  ) : logs.map((log) => {
                    const category = getCategoryMeta(log);
                    const CategoryIcon = category.Icon;
                    const targetLabel = getTargetLabel(log);
                    return (
                    <tr key={log.id} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                      <td className={`px-5 py-4 text-sm whitespace-nowrap ${muted}`}>{formatDate(log.createdAt)}</td>
                      <td className="px-5 py-4">
                        <p className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>{log.displayName || log.username || "System"}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{log.roleName || log.username || "System"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${category.color}`}>
                            <CategoryIcon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>{log.action}</p>
                            <p className={`mt-0.5 text-[11px] ${muted}`}>{category.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-sm ${muted}`} title={targetLabel}>{truncateTarget(targetLabel)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                          log.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                        }`}>
                          {log.status === "failed" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDetailLog(log)}
                          className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                            darkMode ? "bg-white/5 text-white/70 hover:bg-white/10" : "bg-black/[0.04] text-black/60 hover:bg-black/[0.07]"
                          }`}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${muted}`}>Activity details</p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>{detailLog.action}</h3>
              </div>
              <button
                onClick={() => setDetailLog(null)}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`h-5 w-5 ${muted}`} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Exact time", formatDateTime(detailLog.createdAt)],
                ["User", `${detailLog.displayName || detailLog.username || "System"} (${detailLog.roleName || "System"})`],
                ["Category", getCategoryMeta(detailLog).label],
                ["Status", detailLog.status],
                ["Target", getTargetLabel(detailLog)],
                ["Path", `${detailLog.method || ""} ${detailLog.path || ""}`.trim() || "N/A"],
                ["IP address", detailLog.ip || "N/A"],
                ["MAC address", detailLog.macAddress || "N/A"],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}>
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${muted}`}>{label}</p>
                  <p className={`mt-2 break-words text-sm ${darkMode ? "text-white/80" : "text-black/70"}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className={`mt-3 rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}>
              <p className={`text-[11px] uppercase tracking-[0.18em] ${muted}`}>User agent and details</p>
              <p className={`mt-2 break-words text-sm ${darkMode ? "text-white/80" : "text-black/70"}`}>
                {detailLog.details?.userAgent || "N/A"}
              </p>
              {/* {detailLog.details && (
                <pre className={`mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-2xl p-3 text-xs ${darkMode ? "bg-black/30 text-white/65" : "bg-white text-black/60"}`}>
                  {JSON.stringify(detailLog.details, null, 2)}
                </pre>
              )} */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
