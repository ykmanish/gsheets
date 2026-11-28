import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Eye, Loader2, MailOpen, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Chip, ConfirmModal, EmptyState, IconTile, InfoRows, PageHeader, StatTile } from "./ui";
import { API_URL } from "./AuthProvider";

export default function Notifications({ darkMode }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewNotification, setViewNotification] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";

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

  const severityTone = (severity) => (severity === "error" ? "rose" : severity === "warning" ? "amber" : "mint");

  return (
    <div className={`newq flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          darkMode={darkMode}
          badge="Action inbox"
          badgeIcon={Bell}
          badgeTone="sky"
          title="Important notifications"
          subtitle="from automations and reports"
          description="Every automation alert, failed action, AI finding, and scheduled report notice lands here."
          actions={
            <Button darkMode={darkMode} variant="primary" icon={MailOpen} onClick={markAllRead} disabled={unread === 0}>
              Mark all read
            </Button>
          }
        />

        <div className="mb-6 mt-6 grid gap-3 sm:grid-cols-3">
          <StatTile darkMode={darkMode} icon={Bell} tone="sky" value={notifications.length} label="All" />
          <StatTile darkMode={darkMode} icon={MailOpen} tone="lavender" value={unread} label="Unread" />
          <StatTile darkMode={darkMode} icon={AlertTriangle} tone="amber" value={notifications.filter((item) => item.severity === "warning" || item.severity === "error").length} label="Warnings" />
        </div>

        <div className={`overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className={`h-6 w-6 animate-spin ${muted}`} /></div>
          ) : notifications.length === 0 ? (
            <div className="p-4">
              <EmptyState darkMode={darkMode} icon={CheckCircle2} tone="mint" title="No notifications yet" text="Run an automation and important results will show up here." />
            </div>
          ) : (
            <div className="max-h-[56vh] overflow-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={`border-b ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                    {["Title", "Automation", "Category", "Severity", "Created", "Status", "Action"].map((header) => (
                      <th key={header} className={`px-5 py-3 text-[12px] ${muted}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notification) => (
                    <tr
                      key={notification.id}
                      className={`border-b transition-colors last:border-b-0 ${darkMode ? "border-white/[0.06] hover:bg-white/[0.03]" : "border-[#f0f0ee] hover:bg-[#fafaf9]"}`}
                    >
                      <td className="min-w-[220px] px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {!notification.readAt && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#2f6fc0]" />}
                          <span className="block max-w-[260px] truncate text-[13.5px]">
                            {notification.title || "Untitled notification"}
                          </span>
                        </div>
                      </td>
                      <td className={`px-5 py-3.5 text-[13px] ${muted}`}>{notification.automationName || "N/A"}</td>
                      <td className={`px-5 py-3.5 text-[13px] ${muted}`}>{notification.category || "N/A"}</td>
                      <td className="px-5 py-3.5">
                        <Chip tone={severityTone(notification.severity)} darkMode={darkMode}>{notification.severity || "info"}</Chip>
                      </td>
                      <td className={`whitespace-nowrap px-5 py-3.5 text-[13px] ${muted}`}>{formatDateTime(notification.createdAt)}</td>
                      <td className={`px-5 py-3.5 text-[13px] ${muted}`}>{notification.readAt ? "Read" : "Unread"}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openNotification(notification)}
                            className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${darkMode ? "bg-white/[0.07] text-white/75 hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`}
                            title="View notification details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(notification)}
                            className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${darkMode ? "bg-rose-400/[0.13] text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`}
                            title="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
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
        <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 sm:p-5">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={Bell} tone={severityTone(viewNotification.severity)} darkMode={darkMode} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate text-[17px] tracking-[-0.01em]">{viewNotification.title || "Untitled notification"}</h3>
                  <p className={`text-[12.5px] ${muted}`}>Notification details</p>
                </div>
              </div>
              <button
                onClick={() => setViewNotification(null)}
                className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <InfoRows
              darkMode={darkMode}
              rows={[
                ["Automation", viewNotification.automationName || "N/A"],
                ["Category", viewNotification.category || "N/A"],
                ["Severity", viewNotification.severity || "info"],
                ["Status", viewNotification.readAt ? "Read" : "Unread"],
                ["Created", formatDateTime(viewNotification.createdAt)],
                ["Read at", formatDateTime(viewNotification.readAt)],
              ]}
            />

            <div className={`mt-3 rounded-[16px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f4f2]"}`}>
              <p className={`mb-2 text-[12px] ${muted}`}>Message</p>
              <p className={`whitespace-pre-wrap text-[13.5px] leading-6 ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}>
                {viewNotification.message || "No message provided."}
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button darkMode={darkMode} variant="danger" icon={Trash2} onClick={() => setDeleteConfirm(viewNotification)}>
                Delete notification
              </Button>
            </div>
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
