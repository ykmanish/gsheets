import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, Loader2, MailOpen, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { ConfirmModal } from "./ui";

export default function NotificationDrawer({ open, onClose, darkMode }) {
  const [notifications, setNotifications] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const muted = darkMode ? "text-white/50" : "text-black/45";
  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);
  const allSelected = notifications.length > 0 && selected.length === notifications.length;

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/notifications?limit=200`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotifications(data.notifications || []);
      setSelected((current) => current.filter((id) => (data.notifications || []).some((item) => item.id === id)));
    } catch {
      toast.error("Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeoutId = setTimeout(() => void loadNotifications(), 0);
    return () => clearTimeout(timeoutId);
  }, [open, loadNotifications]);

  const toggleSelected = (id) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const markSelectedRead = async () => {
    if (selected.length === 0) return;
    await fetch(`${API_URL}/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    toast.success("Selected notifications marked read");
    await loadNotifications();
  };

  const markAllRead = async () => {
    await fetch(`${API_URL}/notifications/read-all`, { method: "POST" });
    toast.success("All notifications marked read");
    await loadNotifications();
  };

  const deleteSelected = async () => {
    if (selected.length === 0) return;
    try {
      setDeleting(true);
      const response = await fetch(`${API_URL}/notifications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      if (!response.ok) throw new Error();
      toast.success("Selected notifications deleted");
      setDeleteConfirm(false);
      setSelected([]);
      await loadNotifications();
    } catch {
      toast.error("Could not delete selected notifications");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className={`fixed inset-0 z-50 bg-black/35 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside
        className={`fixed right-0 top-0 z-50 h-dvh w-full max-w-md transform overflow-hidden border-l shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        } ${darkMode ? "bg-[#101216] border-white/10 text-white" : "bg-white border-black/10 text-black"}`}
      >
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/5"}`}>
          <div>
            <p className={`text-[11px] uppercase tracking-[0.28em] ${muted}`}>Action inbox</p>
            <h3 className="mt-1 text-xl">Notifications</h3>
          </div>
          <button onClick={onClose} className={`h-10 w-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <button
            onClick={() => setSelected(allSelected ? [] : notifications.map((item) => item.id))}
            className={`rounded-full px-4 py-2 text-sm ${darkMode ? "bg-white/5 text-white" : "bg-black/[0.04] text-black"}`}
          >
            {allSelected ? "Clear selected" : "Select all"}
          </button>
          <button onClick={markSelectedRead} disabled={selected.length === 0} className="rounded-full px-4 py-2 text-sm bg-blue-500/10 text-blue-500 disabled:opacity-40">
            Read
          </button>
          <button onClick={() => setDeleteConfirm(true)} disabled={selected.length === 0} className="rounded-full px-4 py-2 text-sm bg-red-500/10 text-red-500 disabled:opacity-40">
            Delete
          </button>
          <button onClick={markAllRead} disabled={unread === 0} className="ml-auto rounded-full px-4 py-2 text-sm bg-green-500/10 text-green-500 disabled:opacity-40">
            All read
          </button>
        </div>

        <div className="h-[calc(100dvh-137px)] overflow-y-auto px-4 pb-5">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className={`h-7 w-7 animate-spin ${muted}`} /></div>
          ) : notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Bell className={`mb-4 h-10 w-10 ${muted}`} />
              <p className={muted}>No notifications yet.</p>
            </div>
          ) : notifications.map((notification) => {
            const checked = selected.includes(notification.id);
            return (
              <article key={notification.id} className={`mb-3 rounded-2xl border p-4 ${darkMode ? "bg-white/[0.03] border-white/10" : "bg-black/[0.02] border-black/5"}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleSelected(notification.id)}
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                      checked ? "bg-black text-white border-black dark:bg-[#d8f36a] dark:text-black dark:border-[#d8f36a]" : darkMode ? "border-white/20" : "border-black/15"
                    }`}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!notification.readAt && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                      <h4 className={`truncate text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{notification.title || "Untitled notification"}</h4>
                    </div>
                    <p className={`mt-2 line-clamp-3 text-sm leading-6 ${muted}`}>{notification.message || "No message provided."}</p>
                    <div className={`mt-3 flex flex-wrap gap-2 text-xs ${muted}`}>
                      <span>{notification.automationName || "System"}</span>
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      <span>{notification.readAt ? "Read" : "Unread"}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </aside>
      <ConfirmModal
        darkMode={darkMode}
        open={deleteConfirm}
        title="Delete notifications"
        message={`Are you sure you want to delete ${selected.length} selected notification${selected.length === 1 ? "" : "s"}? This action cannot be undone.`}
        loading={deleting}
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={deleteSelected}
      />
    </>
  );
}
