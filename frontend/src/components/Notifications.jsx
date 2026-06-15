import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Loader2, MailOpen, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = "https://dashboard.nexarrow.eu/api";

export default function Notifications({ darkMode }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const panel = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white/80 border border-black/5";
  const muted = darkMode ? "text-white/50" : "text-black/45";

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/notifications?limit=200`);
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch {
      toast.error("Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadNotifications(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadNotifications]);

  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const markRead = async (notification) => {
    if (!notification.readAt) {
      await fetch(`${API_URL}/notifications/${notification.id}/read`, { method: "PATCH" });
      await loadNotifications();
    }
  };

  const markAllRead = async () => {
    await fetch(`${API_URL}/notifications/read-all`, { method: "POST" });
    toast.success("Notifications cleared");
    await loadNotifications();
  };

  const iconFor = (severity) => {
    if (severity === "error") return [AlertCircle, "text-red-500", "bg-red-500/10"];
    if (severity === "warning") return [Sparkles, "text-amber-500", "bg-amber-500/10"];
    return [Bell, darkMode ? "text-[#d8f36a]" : "text-green-700", darkMode ? "bg-[#d8f36a]/10" : "bg-green-50"];
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 newq" style={{ background: darkMode ? "linear-gradient(180deg,#111318,#0c0d10)" : "linear-gradient(180deg,#f7f6f2,#f3f1ea)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${muted}`}>Action inbox</p>
            <h2 className={`text-4xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>Important notifications</h2>
            <p className={`text-sm mt-4 max-w-2xl ${muted}`}>Every automation alert, failed action, AI finding, and scheduled report notice lands here.</p>
          </div>
          <button onClick={markAllRead} disabled={unread === 0} className={`flex items-center gap-2 px-5 py-3 rounded-full disabled:opacity-40 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
            <MailOpen className="w-4 h-4" /> Mark all read
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {[
            ["All", notifications.length],
            ["Unread", unread],
            ["Warnings", notifications.filter((item) => item.severity === "warning" || item.severity === "error").length],
          ].map(([label, value]) => (
            <div key={label} className={`rounded-[24px] p-5 ${panel}`}>
              <p className={`text-sm ${muted}`}>{label}</p>
              <p className={`text-3xl mt-4 ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className={`rounded-[30px] overflow-hidden ${panel}`}>
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className={`w-7 h-7 animate-spin ${muted}`} /></div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center">
              <CheckCircle2 className={`w-10 h-10 mx-auto mb-4 ${muted}`} />
              <p className={`text-lg ${darkMode ? "text-white" : "text-black"}`}>No notifications yet</p>
              <p className={`text-sm mt-2 ${muted}`}>Run an automation and important results will show up here.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {notifications.map((notification) => {
                const [Icon, iconColor, iconBg] = iconFor(notification.severity);
                return (
                  <button key={notification.id} onClick={() => markRead(notification)} className="w-full text-left p-6 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg}`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!notification.readAt && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                          <h3 className={`font-medium ${darkMode ? "text-white" : "text-black"}`}>{notification.title}</h3>
                        </div>
                        <p className={`text-sm leading-6 mt-2 whitespace-pre-wrap line-clamp-4 ${muted}`}>{notification.message}</p>
                        <div className={`flex flex-wrap gap-3 text-xs mt-3 ${muted}`}>
                          <span>{notification.automationName}</span>
                          <span>{new Date(notification.createdAt).toLocaleString()}</span>
                          <span>{notification.category}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
