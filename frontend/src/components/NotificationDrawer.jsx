import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, Loader2, MailOpen, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip, ConfirmModal, Drawer, EmptyState } from "./ui";

export default function NotificationDrawer({ open, onClose, darkMode }) {
  const [notifications, setNotifications] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);
  const allSelected = notifications.length > 0 && selected.length === notifications.length;
  const notifyChanged = useCallback(() => {
    window.dispatchEvent(new Event("uipl:notifications-changed"));
  }, []);

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
    const timeoutId = setTimeout(async () => {
      await loadNotifications();
      const response = await fetch(`${API_URL}/notifications/read-all`, { method: "POST" });
      if (response.ok) {
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
        notifyChanged();
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [open, loadNotifications, notifyChanged]);

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
    notifyChanged();
  };

  const markAllRead = async () => {
    await fetch(`${API_URL}/notifications/read-all`, { method: "POST" });
    toast.success("All notifications marked read");
    await loadNotifications();
    notifyChanged();
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
      notifyChanged();
    } catch {
      toast.error("Could not delete selected notifications");
    } finally {
      setDeleting(false);
    }
  };

  const severityTone = (severity) => (severity === "error" ? "rose" : severity === "warning" ? "amber" : "sky");

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        darkMode={darkMode}
        icon={Bell}
        tone="sky"
        title="Notifications"
        subtitle={unread ? `${unread} unread · action inbox` : "Action inbox"}
        width={460}
        notice={
          <div className={`flex flex-wrap items-center gap-2 border-b px-6 py-3 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
            <Button darkMode={darkMode} variant="soft" size="sm" onClick={() => setSelected(allSelected ? [] : notifications.map((item) => item.id))}>
              {allSelected ? "Clear selected" : "Select all"}
            </Button>
            <Button darkMode={darkMode} variant="soft" size="sm" icon={MailOpen} onClick={markSelectedRead} disabled={selected.length === 0}>
              Read
            </Button>
            <Button darkMode={darkMode} variant="soft" size="sm" icon={Trash2} onClick={() => setDeleteConfirm(true)} disabled={selected.length === 0} className={darkMode ? "" : "!text-[#c0394b]"}>
              Delete
            </Button>
            <Button darkMode={darkMode} variant="secondary" size="sm" icon={Check} onClick={markAllRead} disabled={unread === 0} className="ml-auto">
              All read
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className={`h-6 w-6 animate-spin ${muted}`} /></div>
        ) : notifications.length === 0 ? (
          <EmptyState darkMode={darkMode} icon={Bell} tone="sky" title="No notifications yet" text="Automation alerts and reminders will show up here." />
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const checked = selected.includes(notification.id);
              return (
                <article
                  key={notification.id}
                  className={`rounded-[16px] border p-4 transition-colors ${
                    checked
                      ? darkMode ? "border-white/20 bg-white/[0.06]" : "border-[#d9d9d6] bg-white"
                      : darkMode ? "border-transparent bg-white/[0.04]" : "border-transparent bg-[#f7f7f5]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelected(notification.id)}
                      aria-label={checked ? "Unselect notification" : "Select notification"}
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                        checked
                          ? darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white"
                          : darkMode ? "border-white/25" : "border-[#cfcfcb] bg-white"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[#2f6fc0]" />}
                        <h4 className={`truncate text-[13.5px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{notification.title || "Untitled notification"}</h4>
                      </div>
                      <p className={`mt-1.5 line-clamp-3 text-[13px] leading-5 ${darkMode ? "text-white/60" : "text-[#5f5f5c]"}`}>{notification.message || "No message provided."}</p>
                      <div className={`mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] ${muted}`}>
                        {notification.severity && notification.severity !== "info" && (
                          <Chip tone={severityTone(notification.severity)} darkMode={darkMode} className="h-6 px-2.5 text-[11.5px]">{notification.severity}</Chip>
                        )}
                        <span>{notification.automationName || "System"}</span>
                        <span>·</span>
                        <span>{new Date(notification.createdAt).toLocaleString()}</span>
                        <span>·</span>
                        <span>{notification.readAt ? "Read" : "Unread"}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Drawer>
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
