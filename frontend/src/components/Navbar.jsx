import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, User } from "lucide-react";
import toast from "react-hot-toast";
import { ThemeSwitch, useClickOutside } from "./ui";
import { API_URL } from "./AuthProvider";

export default function Navbar({ darkMode, setDarkMode, user, onLogout, onMenuClick, onNotificationsClick }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useClickOutside(profileRef, () => setProfileOpen(false));
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const displayName = user?.displayName || user?.username || "there";
  const initials = (user?.displayName || user?.username || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotificationIdRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    
    const checkNotifications = async () => {
      try {
        const response = await fetch(`${API_URL}/notifications?limit=20`);
        if (!response.ok) return;
        const data = await response.json();
        const notifications = data.notifications || [];
        
        const unread = notifications.filter(n => !n.readAt);
        setUnreadCount(unread.length);
        
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
    return () => clearInterval(interval);
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

        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((open) => !open)}
            className={`h-10 rounded-full pl-1.5 pr-2 flex items-center gap-2 transition-all duration-300 sm:h-11 sm:pl-2 sm:pr-4 sm:gap-3 -sm ${
              darkMode
                ? "bg-white/10 text-white/80 hover:bg-white/15 border border-white/10"
                : "bg-white text-slate-700 hover:bg-[#f1f7f4] border border-[#dfe7e4]"
            }`}
          >
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#10a66b] text-white"}`}>
              {initials || <User className="w-4 h-4" />}
            </span>
            <span className="hidden md:block text-left">
              <span className="block text-sm font-medium leading-tight">{user?.displayName || user?.username}</span>
              <span className={`block text-xs leading-tight ${darkMode ? "text-white/45" : "text-black/40"}`}>{user?.roleName || "User"}</span>
            </span>
            <ChevronDown className="hidden w-4 h-4 sm:block" />
          </button>

          {profileOpen && (
            <div className={`absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-64 rounded-3xl border p-3 -lg z-30 ${darkMode ? "bg-[#15171c] border-white/10 text-white" : "bg-white border-black/5 text-black"}`}>
              <div className={`px-3 py-3 rounded-2xl ${darkMode ? "bg-white/5" : "bg-black/[0.03]"}`}>
                <p className="text-sm font-semibold">{user?.displayName || user?.username}</p>
                <p className={`${darkMode ? "text-white/45" : "text-black/45"} text-xs mt-1`}>{user?.username}</p>
              </div>
              <button
                onClick={onLogout}
                className="mt-2 w-full rounded-2xl px-3 py-2.5 text-left flex items-center gap-2 text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
