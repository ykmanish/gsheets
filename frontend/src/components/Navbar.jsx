import { useEffect, useRef, useState } from "react";
import {
  Activity, Bell, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ChartNoAxesCombined, ChevronRight, CircleDollarSign, ClipboardList,
  FileSpreadsheet, FileText, FolderLock, Images, LayoutDashboard, ListTodo, MapPin, Menu, MessageCircleMore, MessagesSquare, PackageSearch,
  Search, Sheet, ShieldCheck, SlidersHorizontal, UserRound, UserRoundSearch, Users, Wifi, WifiOff, Workflow,
} from "lucide-react";
import { ThemeSwitch } from "./ui";
import { API_URL, fetchJsonShared } from "./AuthProvider";
import { showAppToast } from "./ToastPill";
import SlackAnnouncementComposer from "./SlackAnnouncementComposer";
import SlackLogo from "./SlackLogo";

// Breadcrumb for each page: [section, page, icon].
const PAGES = {
  dashboard: ["Workspace", "Dashboard", LayoutDashboard],
  documents: ["Workspace", "Documents", FileText],
  "department-documents": ["Workspace", "Department Documents", FolderLock],
  forms: ["Workspace", "Forms", ClipboardList],
  projects: ["Projects", "Project Control", Building2],
  "project-dmr": ["Projects", "DMR", FileSpreadsheet],
  "project-mrn": ["Projects", "MRN", ClipboardList],
  "project-prn": ["Projects", "PRN", CircleDollarSign],
  "project-stock": ["Projects", "Stock", PackageSearch],
  "site-images": ["Projects", "Site Images", Images],
  "hr-dashboard": ["HR", "Overview", BriefcaseBusiness],
  "hr-employees": ["HR", "Employees", Users],
  "hr-leave": ["HR", "Leave", CalendarDays],
  "hr-attendance": ["HR", "Attendance", MapPin],
  "hr-recruitment": ["HR", "Recruitment", UserRoundSearch],
  slack: ["Workspace", "Slack", SlackLogo],
  todos: ["Workspace", "Todos", ListTodo],
  forum: ["Workspace", "Loop", MessagesSquare],
  "sheet-dashboard": ["Workspace", "Sheet Dashboard", Sheet],
  automations: ["Workspace", "Automation", Workflow],
  reports: ["Workspace", "Reports", ChartNoAxesCombined],
  accounts: ["Finance", "Accounts", FileSpreadsheet],
  "accounts-forms": ["Finance", "Forms", ClipboardList],
  "employee-daily-report": ["Workspace", "Employee Daily Report", CalendarCheck],
  "activity-log": ["Workspace", "Activity Log", Activity],
  whatsapp: ["Workspace", "WhatsApp", MessageCircleMore],
  "manage-roles": ["Access Control", "Manage Roles", ShieldCheck],
  "manage-users": ["Access Control", "Manage Users", Users],
  "module-control": ["Access Control", "Module Control", SlidersHorizontal],
  profile: ["Account", "Profile", UserRound],
};

export default function Navbar({ darkMode, setDarkMode, user, onMenuClick, onNotificationsClick, onNewNotification, onLoopClick, loopUnreadCount = 0, showLoopButton = false, moduleId = "dashboard", onOpenSearch }) {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const displayName = user?.displayName || user?.username || "there";

  const [unreadCount, setUnreadCount] = useState(0);
  const [networkStatus, setNetworkStatus] = useState(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "connected",
  );
  const lastNotificationIdRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let timeoutId;

    const checkNetwork = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (!disposed) setNetworkStatus("offline");
        return;
      }

      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1800);

      try {
        const response = await fetch(`${API_URL}/health?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const elapsed = performance.now() - startedAt;
        if (!disposed) setNetworkStatus(response.ok && elapsed < 1200 ? "connected" : "unstable");
      } catch {
        if (!disposed) setNetworkStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "unstable");
      } finally {
        window.clearTimeout(timer);
      }
    };

    const handleOnline = () => {
      setNetworkStatus("unstable");
      void checkNetwork();
    };
    const handleOffline = () => setNetworkStatus("offline");

    void checkNetwork();
    timeoutId = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkNetwork();
    }, 12000);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      window.clearInterval(timeoutId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const networkMeta = {
    connected: {
      label: "Connected",
      title: "Internet connection is working",
      Icon: Wifi,
      className: darkMode
        ? "bg-emerald-400/12 text-emerald-200 ring-emerald-300/15"
        : "bg-emerald-50 text-emerald-700 ring-emerald-100",
      dot: "bg-emerald-500",
    },
    unstable: {
      label: "Unstable",
      title: "Network looks unstable",
      Icon: Activity,
      className: darkMode
        ? "bg-amber-400/12 text-amber-200 ring-amber-300/15"
        : "bg-amber-50 text-amber-700 ring-amber-100",
      dot: "bg-amber-500",
    },
    offline: {
      label: "Offline",
      title: "No internet connection",
      Icon: WifiOff,
      className: darkMode
        ? "bg-red-400/12 text-red-200 ring-red-300/15"
        : "bg-red-50 text-red-700 ring-red-100",
      dot: "bg-red-500",
    },
  }[networkStatus] || {};
  const NetworkIcon = networkMeta.Icon || Wifi;

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;

    const checkNotifications = async ({ force = false } = {}) => {
      try {
        // Shared and briefly reused, so overlapping checks cost one request.
        const { ok, data } = await fetchJsonShared(`${API_URL}/notifications?limit=20`, { maxAgeMs: 10000, force });
        if (!ok || !data) return;
        const notifications = data.notifications || [];
        setUnreadCount(Number.isFinite(data.unreadCount) ? data.unreadCount : notifications.filter(n => !n.readAt).length);
        onNewNotification?.(notifications.find((notification) => !notification.readAt) || null);
        
        if (notifications.length > 0) {
          const topId = notifications[0].id;
          // If we already have a recorded topId, and the new topId is different, it means there's a new notification.
          if (lastNotificationIdRef.current && lastNotificationIdRef.current !== topId) {
            onNewNotification?.(notifications[0]);
            showAppToast(notifications[0].title || "You have a new message", {
              type: "notification",
              darkMode,
              detail: "New notification",
              label: "Received",
            });
            if (notifications[0].type === "hr-leave") {
              window.dispatchEvent(new Event("uipl:hr-data-changed"));
            }
          }
          lastNotificationIdRef.current = topId;
        }
      } catch (err) {
        // ignore silently
      }
    };

    const refreshNow = () => void checkNotifications({ force: true });
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkNotifications();
    };
    checkNotifications();
    const interval = setInterval(checkWhenVisible, 15000);
    window.addEventListener("uipl:notifications-changed", refreshNow);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("uipl:notifications-changed", refreshNow);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [darkMode, onNewNotification, userId]);

  return (
    <div className={`newq flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5 ${darkMode ? "border-white/10" : "border-[#efefed]"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] md:hidden ${darkMode ? "text-white/75 hover:bg-white/10" : "text-[#5f5f5c] hover:bg-[#f1f1ef]"}`}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        {(() => {
          const [section, page, PageIcon] = PAGES[moduleId] || ["Workspace", "UIPL Docs", LayoutDashboard];
          return (
            <nav aria-label="Breadcrumb" className={`flex min-w-0 items-center gap-1.5 text-[13.5px] ${darkMode ? "text-white/50" : "text-[#7a7a77]"}`}>
              <PageIcon className="h-4 w-4 shrink-0" />
              <span className="hidden truncate sm:inline">{section}</span>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 opacity-60 sm:block" />
              <span title={`${greeting}, ${displayName}`} className={`truncate font-medium ${darkMode ? "text-white" : "text-[#171717]"}`}>{page}</span>
            </nav>
          );
        })()}
      </div>

      <div className="flex newq items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className={`hidden h-9 w-[220px] items-center gap-2 rounded-[10px] border px-3 text-[13px] transition-colors lg:flex ${darkMode ? "border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.07]" : "border-[#e4e4e1] bg-white text-[#a3a3a0] shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:bg-[#fafaf9]"}`}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className={`rounded-[5px] border px-1.5 text-[10.5px] ${darkMode ? "border-white/10" : "border-[#e8e8e6]"}`}>Ctrl K</kbd>
        </button>
        <SlackAnnouncementComposer darkMode={darkMode} />

        {/* Loop lives up here on desktop; small screens get the floating button instead. */}
        {showLoopButton && (
          <button
            onClick={onLoopClick}
            className="relative hidden h-9 items-center gap-1.5 rounded-[10px] bg-[#2563eb] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4ed8] active:scale-[0.98] lg:flex"
            title="Loop chat"
            aria-label="Open Loop chat"
          >
            <MessageCircleMore className="h-4 w-4" />
            <span>Loop</span>
            {loopUnreadCount > 0 && (
              <span className={`absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ${darkMode ? "ring-[#0f1115]" : "ring-white"}`}>
                {loopUnreadCount > 99 ? "99+" : loopUnreadCount}
              </span>
            )}
          </button>
        )}

        <div
          className={`hidden h-9 items-center gap-2 rounded-[10px] px-2.5 text-[12px] font-medium ring-1 transition-colors xl:flex ${networkMeta.className}`}
          title={networkMeta.title}
          aria-label={`Network status: ${networkMeta.label}`}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${networkStatus === "connected" ? "animate-ping" : ""} ${networkMeta.dot}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${networkMeta.dot}`} />
          </span>
          <NetworkIcon className="h-3.5 w-3.5" />
          <span>{networkMeta.label}</span>
        </div>

        <ThemeSwitch darkMode={darkMode} onToggle={() => setDarkMode(!darkMode)} />

        <button
          onClick={onNotificationsClick}
          className={`relative grid h-9 w-9 place-items-center rounded-[10px] border transition-colors ${
            darkMode ? "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10" : "border-[#e4e4e1] bg-white text-[#5f5f5c] hover:bg-[#f6f6f4]"
          }`}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[22px] w-[22px] items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60"></span>
              <span className={`relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border-2 ${darkMode ? "border-[#0f1115]" : "border-white"}`}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </span>
          )}
        </button>

      </div>
    </div>
  );
}
