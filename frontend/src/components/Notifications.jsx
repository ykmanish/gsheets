import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Loader2, MailOpen, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmModal } from "./ui";

const API_URL = "https://dashboard.nexarrow.eu/api";

export default function Notifications({ darkMode }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewNotification, setViewNotification] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const openNotification = async (notification) => {
    setViewNotification(notification);
    await markRead(notification);
  };

  const deleteNotification = async (notification) => {
    try {
      setDeleting(true);
      const response = await fetch(`${API_URL}/notifications/${notification.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      if (viewNotification?.id === notification.id) setViewNotification(null);
      toast.success("Notification deleted");
      setDeleteConfirm(null);
      await loadNotifications();
    } catch {
      toast.error("Could not delete notification");
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 newq sm:px-6 lg:px-8 lg:py-8" style={{ background: darkMode ? "linear-gradient(180deg,#111318,#0c0d10)" : "linear-gradient(180deg,#f7f6f2,#f3f1ea)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${muted}`}>Action inbox</p>
            <h2 className={`text-2xl small font-semibold sm:text-3xl md:text-4xl ${darkMode ? "text-white" : "text-black"}`}>Important notifications</h2>
            <p className={`text-sm mt-4 max-w-2xl ${muted}`}>Every automation alert, failed action, AI finding, and scheduled report notice lands here.</p>
          </div>
          <button onClick={markAllRead} disabled={unread === 0} className={`flex w-full items-center justify-center gap-2 px-5 py-3 rounded-full disabled:opacity-40 sm:w-auto ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
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
          ) : (
            <div className="max-h-[56vh] overflow-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    {["Title", "Automation", "Category", "Severity", "Created", "Status", "Action"].map((header) => (
                      <th key={header} className={`px-5 py-4 text-[11px] uppercase tracking-[0.18em] font-medium ${darkMode ? "text-white/45" : "text-black/35"}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifications.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-5 py-16 text-center">
                        <CheckCircle2 className={`w-10 h-10 mx-auto mb-4 ${muted}`} />
                        <p className={`text-lg ${darkMode ? "text-white" : "text-black"}`}>No notifications yet</p>
                        <p className={`text-sm mt-2 ${muted}`}>Run an automation and important results will show up here.</p>
                      </td>
                    </tr>
                  ) : notifications.map((notification) => (
                    <tr
                      key={notification.id}
                      className={`transition-colors ${darkMode ? "border-b border-white/5 hover:bg-white/[0.03]" : "border-b border-black/5 hover:bg-black/[0.02]"}`}
                    >
                      <td className="px-5 py-4 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          {!notification.readAt && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                          <span className={`block max-w-[260px] truncate text-sm ${darkMode ? "text-white" : "text-black"}`}>
                            {notification.title || "Untitled notification"}
                          </span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-sm ${muted}`}>{notification.automationName || "N/A"}</td>
                      <td className={`px-5 py-4 text-sm ${muted}`}>{notification.category || "N/A"}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-3 py-1 rounded-full ${
                          notification.severity === "error"
                            ? "bg-red-500/10 text-red-500"
                            : notification.severity === "warning"
                            ? "bg-amber-500/10 text-amber-500"
                            : darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-green-50 text-green-700"
                        }`}>
                          {notification.severity || "info"}
                        </span>
                      </td>
                      <td className={`px-5 py-4 text-sm whitespace-nowrap ${muted}`}>{formatDateTime(notification.createdAt)}</td>
                      <td className={`px-5 py-4 text-sm ${muted}`}>{notification.readAt ? "Read" : "Unread"}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openNotification(notification)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              darkMode ? "bg-white/5 text-white/70 hover:bg-white/10" : "bg-black/[0.04] text-black/60 hover:bg-black/[0.07]"
                            }`}
                            title="View notification details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(notification)}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10"
                            title="Delete notification"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {viewNotification && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-5">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] p-5 sm:rounded-[28px] sm:p-6 ${darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"}`}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${muted}`}>Notification details</p>
                <h3 className={`text-2xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  {viewNotification.title || "Untitled notification"}
                </h3>
              </div>
              <button
                onClick={() => setViewNotification(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
                title="Close"
              >
                <X className={`w-5 h-5 ${muted}`} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              {[
                ["Automation", viewNotification.automationName || "N/A"],
                ["Category", viewNotification.category || "N/A"],
                ["Severity", viewNotification.severity || "info"],
                ["Status", viewNotification.readAt ? "Read" : "Unread"],
                ["Created", formatDateTime(viewNotification.createdAt)],
                ["Read at", formatDateTime(viewNotification.readAt)],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}>
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${muted}`}>{label}</p>
                  <p className={`text-sm mt-2 break-words ${darkMode ? "text-white/80" : "text-black/70"}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className={`rounded-2xl p-5 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}>
              <p className={`text-[11px] uppercase tracking-[0.18em] mb-3 ${muted}`}>Message</p>
              <p className={`text-sm leading-6 whitespace-pre-wrap ${darkMode ? "text-white/80" : "text-black/70"}`}>
                {viewNotification.message || "No message provided."}
              </p>
            </div>
            <button
              onClick={() => setDeleteConfirm(viewNotification)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-3 text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete notification
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title="Delete notification"
        message={`Are you sure you want to delete "${deleteConfirm?.title || "this notification"}"? This action cannot be undone.`}
        loading={deleting}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => deleteNotification(deleteConfirm)}
      />
    </div>
  );
}
