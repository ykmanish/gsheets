import { useEffect, useRef, useState } from "react";
import { Activity, Bell, Menu, Wifi, WifiOff } from "lucide-react";
import toast from "react-hot-toast";
import { ThemeSwitch } from "./ui";
import { API_URL } from "./AuthProvider";

export default function Navbar({ darkMode, setDarkMode, user, onMenuClick, onNotificationsClick }) {
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
    timeoutId = window.setInterval(checkNetwork, 12000);
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

  useEffect(() => {
    if (!user) return;
    
    const checkNotifications = async () => {
      try {
        const response = await fetch(`${API_URL}/notifications?limit=20`);
        if (!response.ok) return;
        const data = await response.json();
        const notifications = data.notifications || [];
        setUnreadCount(Number.isFinite(data.unreadCount) ? data.unreadCount : notifications.filter(n => !n.readAt).length);
        
        if (notifications.length > 0) {
          const topId = notifications[0].id;
          // If we already have a recorded topId, and the new topId is different, it means there's a new notification.
          if (lastNotificationIdRef.current && lastNotificationIdRef.current !== topId) {
            toast(`New notification: ${notifications[0].title || 'You have a new message'}`, { icon: '🔔' });
          }
          lastNotificationIdRef.current = topId;
        }
      } catch (err) {
        // ignore silently
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 15000);
    window.addEventListener("uipl:notifications-changed", checkNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener("uipl:notifications-changed", checkNotifications);
    };
  }, [user]);

  return (
    <div
      className={`px-4 py-4 sm:px-6 lg:px-8 lg:py-5 newq flex items-center justify-between gap-4 transition-all duration-300 ${
        darkMode
          ? "bg-[#0f1115] border-b border-white/10"
          : "bg-[#f8faf9] border-b lg:border-b-0 border-[#dfe7e4]"
      }`}
      
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full md:hidden ${
            darkMode ? "bg-white/5 text-white hover:bg-white/10" : "border border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"
          }`}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2
            className={`truncate py-1 text-lg small font-semibold leading-none sm:text-[22px] ${
              darkMode ? "text-white" : "text-black"
            }`}
          >
            {greeting}, {displayName}
          </h2>
          <p className={`mt-1 hidden truncate text-xs sm:block ${darkMode ? "text-white/45" : "text-black/40"}`}>
            Welcome back to UIPL Docs
          </p>
        </div>
      </div>

      <div className="flex newq items-center gap-2 sm:gap-3">
        <div
          className={`hidden h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition-all duration-300 sm:flex ${networkMeta.className}`}
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
          className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 sm:h-11 sm:w-11 ${
            darkMode ? "bg-white/10 text-white/80 hover:bg-white/15 border border-white/10" : "bg-white text-slate-700 hover:bg-[#f1f7f4] border border-[#dfe7e4]"
          }`}
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
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
