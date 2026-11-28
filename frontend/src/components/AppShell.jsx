"use client";

import { Suspense, createContext, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { BellRing, Clock3, LogOut, MessageCircleMore, Minimize, ShieldCheck, Sparkles, Wrench, X } from "lucide-react";
import { API_URL, AuthProvider, fetchJsonShared, getStoredAuth, useAuth } from "./AuthProvider";
import {
  MessagePopupStack,
  forumMessagePopupContext,
  forumMessagePreviewText,
  requestForumConversation,
  showMessagePopup,
} from "./MessagePopup";
import { playForumNotificationSound } from "./forumNotificationSound";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import NotificationDrawer from "./NotificationDrawer";
import CommandPalette from "./CommandPalette";
import { menuPaths, moduleForPath, moduleLoaders, preloadModule } from "./appModules";

const Forum = lazy(moduleLoaders.Forum);

// What every module page needs from the shell. The shell is the (app) layout, so it stays
// mounted across page changes; only the module under it is swapped.
const ShellContext = createContext(null);

export function useShell() {
  return useContext(ShellContext);
}

// Shown once, before the stored session and theme are read on first load.
function ShellSkeleton({ darkMode }) {
  const bar = darkMode ? "skeleton-bar skeleton-bar-dark" : "skeleton-bar";
  return (
    <div className={`flex min-h-dvh ${darkMode ? "bg-[#0b0c0f]" : "bg-[#f5f5f3]"}`} aria-busy="true">
      <div className={`hidden w-[248px] shrink-0 flex-col gap-3 border-r p-4 md:flex ${darkMode ? "border-white/10 bg-[#101114]" : "border-[#e7eaee] bg-white"}`}>
        <div className={`h-8 w-36 rounded-lg ${bar}`} />
        <div className={`mt-2 h-10 rounded-xl ${bar}`} />
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className={`h-9 rounded-2xl ${bar}`} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <div className={`h-10 w-72 max-w-full rounded-xl ${bar}`} />
        <div className={`h-44 rounded-[30px] ${bar}`} />
        <div className={`flex-1 rounded-[30px] ${bar}`} />
      </div>
    </div>
  );
}

function notificationPath(notification = {}) {
  if (notification.path || notification.href || notification.url) return notification.path || notification.href || notification.url;
  if (notification.type === "hr-leave") return "/hr/leave";
  if (notification.type === "department-document") return "/department-documents";
  if (notification.type === "folder" || notification.type === "document") return "/documents";
  if (notification.type === "automation") return "/automations";
  if (notification.type === "report") return "/reports";
  if (notification.type === "employee-report") return "/employee-daily-report";
  if (notification.type === "dmr") return "/projects/dmr";
  if (notification.type === "mrn") return "/projects/mrn";
  return null;
}

function NotificationStrip({ notification, darkMode, onClose, onView }) {
  if (!notification) return null;
  return (
    <div key={notification.id} className={`notification-strip-in border-b px-4 py-3 sm:px-6 lg:px-8 ${darkMode ? "border-white/10 bg-[#101820] text-white" : "border-emerald-100 bg-[#ecfff5] text-[#10210c]"}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-emerald-400/14 text-emerald-200" : "bg-white text-[#08764f]"}`}>
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{notification.title || "New notification"}</p>
          <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-white/55" : "text-black/55"}`}>{notification.message || "You have a new update."}</p>
        </div>
        <button type="button" onClick={onView} className={`h-10 shrink-0 rounded-full px-5 text-sm font-black ${darkMode ? "bg-white text-black" : "bg-[#08764f] text-white"}`}>
          View detail
        </button>
        <button type="button" onClick={onClose} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close notification strip">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function maintenanceCountdown(estimatedEndAt) {
  if (!estimatedEndAt) return { label: "We will be back soon", expired: false };
  const target = new Date(estimatedEndAt).getTime();
  if (!Number.isFinite(target)) return { label: "We will be back soon", expired: false };
  const remaining = target - Date.now();
  if (remaining <= 0) return { label: "Final checks are running", expired: true };
  const totalMinutes = Math.ceil(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return { label: parts.join(" "), expired: false };
}

function MaintenanceScreen({ darkMode, maintenance, user, onLogout }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const countdown = maintenanceCountdown(maintenance?.estimatedEndAt, tick);
  const endLabel = maintenance?.estimatedEndAt
    ? new Date(maintenance.estimatedEndAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not announced yet";

  return (
    <main className={`grid min-h-dvh place-items-center overflow-hidden px-5 py-8 ${darkMode ? "bg-[#090d12] text-white" : "bg-[#eef3f2] text-[#171714]"}`}>
      <section className={`relative w-full max-w-5xl overflow-hidden rounded-[34px] border p-6 sm:p-8 lg:p-10 ${darkMode ? "border-white/10 bg-[#111820]" : "border-white bg-white"}`}>
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className={`absolute inset-x-0 top-0 h-32 ${darkMode ? "bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,47,0.18),transparent_55%)]" : "bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,47,0.28),transparent_55%)]"}`} />
          <div className={`absolute inset-0 ${darkMode ? "bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)]" : "bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)]"} bg-[size:68px_68px]`} />
        </div>
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${darkMode ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-emerald-100 bg-[#e7f6ed] text-[#08764f]"}`}>
              <Wrench className="h-4 w-4" /> Maintenance mode
            </span>
            <h1 className="small mt-6 max-w-3xl text-4xl font-black leading-[0.96] sm:text-5xl lg:text-6xl">Site under maintenance</h1>
            <p className={`mt-5 max-w-2xl text-base leading-7 sm:text-lg ${darkMode ? "text-white/62" : "text-black/58"}`}>
              {maintenance?.message || "We are improving the workspace. Please check back soon."}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${darkMode ? "bg-white/10 text-white" : "bg-[#171714] text-white"}`}>
                <Clock3 className="h-4 w-4" /> {countdown.label}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? "bg-white/[0.06] text-white/65" : "bg-[#f3f5ef] text-black/55"}`}>
                Estimated: {endLabel}
              </span>
            </div>
          </div>
          <aside className={`rounded-[28px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.045]" : "border-black/5 bg-[#f8fbf9]"}`}>
            <div className={`grid h-16 w-16 place-items-center rounded-3xl ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#6ee72f] text-[#10210c]"}`}>
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="small mt-5 text-2xl font-black">Access is paused</h2>
            <p className={`mt-3 text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/55"}`}>Hi {user?.displayName || user?.username || "there"}, Super Admin has temporarily locked all user routes while updates are being completed.</p>
            <div className={`mt-5 rounded-2xl p-4 ${darkMode ? "bg-black/20" : "bg-white"}`}>
              <div className="flex items-center gap-3">
                <ShieldCheck className={`h-5 w-5 ${darkMode ? "text-emerald-200" : "text-[#08764f]"}`} />
                <span className="text-sm font-black">Your data is safe</span>
              </div>
              <p className={`mt-2 text-xs leading-5 ${darkMode ? "text-white/45" : "text-black/45"}`}>Please wait for maintenance to finish, then refresh or sign in again.</p>
            </div>
            <button type="button" onClick={onLogout} className={`mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-black transition ${darkMode ? "bg-white text-black hover:bg-white/90" : "bg-[#171714] text-white hover:bg-black/85"}`}>
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ShellContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const moduleId = moduleForPath(pathname);
  const { user, menus, disabledModules, maintenance, loading, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = getStoredAuth().user;
    if (!storedUser?.id) return false;
    return window.localStorage.getItem(`uipl_docs_theme_${storedUser.id}`) === "dark";
  });
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("uipl_docs_sidebar_collapsed") === "true";
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Sidebar links navigate on their own; close the mobile drawer once the page has changed.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setSidebarOpen(false);
  }
  const [latestNotification, setLatestNotification] = useState(null);
  const [dismissedNotificationId, setDismissedNotificationId] = useState(null);
  const [forumMobileChatOpen, setForumMobileChatOpen] = useState(false);
  const [forumWidgetOpen, setForumWidgetOpen] = useState(false);
  const [forumWidgetMinimized, setForumWidgetMinimized] = useState(false);
  const [forumWidgetClosing, setForumWidgetClosing] = useState(false);
  const [forumWidgetDesktop, setForumWidgetDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });
  const [forumUnreadTotal, setForumUnreadTotal] = useState(0);
  const forumWidgetVisibleRef = useRef(false);
  const forumUnreadConversationIdsRef = useRef(new Set());
  const allowedMenus = useMemo(() => {
    const assigned = [
      ...(user?.isSuperAdmin ? [...menus, "project-mrn", "project-prn", "project-stock", "hr-dashboard", "hr-employees", "hr-leave", "hr-attendance", "hr-recruitment", "todos", "forum", "whatsapp", "slack", "manage-users", "module-control"] : menus.filter((menu) => !["access-management", "manage-roles", "manage-users", "whatsapp", "slack", "module-control"].includes(menu))),
      "projects",
      "profile",
      // Splitting Finance into Accounts + Forms must not revoke anyone: whoever already had
      // Accounts keeps Forms. Forms can still be granted on its own.
      ...(menus.includes("accounts") ? ["finance", "accounts-forms"] : []),
      ...(menus.includes("accounts-forms") ? ["finance"] : []),
    ];
    const globallyDisabled = new Set(disabledModules || []);
    return Array.from(new Set(assigned)).filter((menu) => !["notifications", "settings"].includes(menu) && (!globallyDisabled.has(menu) || ["dashboard", "module-control"].includes(menu)));
  }, [disabledModules, menus, user?.isSuperAdmin]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const syncForumWidgetViewport = () => {
      const desktop = window.innerWidth >= 1024;
      setForumWidgetDesktop(desktop);
      if (!desktop) {
        setForumWidgetOpen(false);
        setForumWidgetMinimized(false);
        setForumWidgetClosing(false);
      }
    };
    syncForumWidgetViewport();
    window.addEventListener("resize", syncForumWidgetViewport);
    return () => window.removeEventListener("resize", syncForumWidgetViewport);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(`uipl_docs_theme_${user.id}`, darkMode ? "dark" : "light");
  }, [darkMode, user?.id]);

  useEffect(() => {
    window.localStorage.setItem("uipl_docs_sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    forumWidgetVisibleRef.current = Boolean(forumWidgetOpen && !forumWidgetMinimized && !forumWidgetClosing);
  }, [forumWidgetClosing, forumWidgetMinimized, forumWidgetOpen]);

  useEffect(() => {
    if (!user?.id || !allowedMenus.includes("forum")) {
      const resetTimer = window.setTimeout(() => setForumUnreadTotal(0), 0);
      return () => window.clearTimeout(resetTimer);
    }
    let stopped = false;
    async function loadForumUnread(event) {
      if (typeof event?.detail?.total === "number") {
        forumUnreadConversationIdsRef.current = new Set(event.detail.conversationIds || []);
        setForumUnreadTotal(Math.max(0, Math.min(999, event.detail.total)));
        return;
      }
      try {
        // Shared with the Loop page, which reads the same data; reuse a recent answer
        // unless something announced that the unread state changed.
        const { ok, data } = await fetchJsonShared(`${API_URL}/forum/bootstrap`, { maxAgeMs: 30000, force: Boolean(event) });
        if (!ok || !data || stopped) return;
        const unreadIds = (data.conversations || []).filter((conversation) => Number(conversation.unreadCount || 0) > 0).map((conversation) => String(conversation.id));
        forumUnreadConversationIdsRef.current = new Set(unreadIds);
        setForumUnreadTotal(unreadIds.length);
      } catch {
        // The launcher badge is nice-to-have; the forum itself still loads normally.
      }
    }
    void loadForumUnread();
    window.addEventListener("uipl:forum-unread-changed", loadForumUnread);
    return () => {
      stopped = true;
      window.removeEventListener("uipl:forum-unread-changed", loadForumUnread);
    };
  }, [allowedMenus, user?.id]);

  // Quick navigation: once the first page has settled, fetch every other page this account
  // can open — its route and its module code — one at a time while the browser is idle.
  // A click then switches pages straight away instead of waiting on the network.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const idle = (callback) => (window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 2000 }) : window.setTimeout(callback, 200));
    const timer = window.setTimeout(async () => {
      for (const menu of allowedMenus) {
        if (cancelled) return;
        if (menuPaths[menu]) router.prefetch(menuPaths[menu]);
        await preloadModule(menu);
        await new Promise((resolve) => idle(resolve));
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allowedMenus, router, user?.id]);

  // Opens (or restores) the desktop Loop widget — the navbar button and the popup's View share it.
  const openForumWidget = useCallback(() => {
    setForumWidgetOpen(true);
    setForumWidgetMinimized(false);
    setForumWidgetClosing(false);
    forumUnreadConversationIdsRef.current = new Set();
    setForumUnreadTotal(0);
  }, []);

  // Where "View" on a message popup lands: straight into that conversation, whichever surface
  // Loop happens to be available on from the current page.
  const openForumConversation = useCallback((conversationId) => {
    const id = String(conversationId || "");
    if (!id) return;
    const loopMounted = moduleId === "forum" || (forumWidgetOpen && !forumWidgetClosing);
    if (loopMounted) {
      setForumWidgetMinimized(false);
      window.dispatchEvent(new CustomEvent("uipl:forum-open-conversation", { detail: { conversationId: id } }));
      return;
    }
    requestForumConversation(id);
    if (forumWidgetDesktop && allowedMenus.includes("forum")) {
      openForumWidget();
      return;
    }
    router.push("/loop");
  }, [allowedMenus, forumWidgetClosing, forumWidgetDesktop, forumWidgetOpen, moduleId, openForumWidget, router]);

  const closeForumWidget = useCallback(() => {
    setForumWidgetClosing(true);
    window.setTimeout(() => {
      setForumWidgetOpen(false);
      setForumWidgetMinimized(false);
      setForumWidgetClosing(false);
    }, 500);
  }, []);

  useEffect(() => {
    function openCommandPalette(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", openCommandPalette);
    return () => window.removeEventListener("keydown", openCommandPalette);
  }, []);

  // ── Global forum WebSocket: delivers notifications on ALL pages ──
  const globalForumWsRef = useRef(null);
  // Read inside the socket handler so menu changes don't tear the socket down. Someone without
  // Loop access has nowhere for "View" to go, so they get no popup either.
  const forumAllowedRef = useRef(false);
  useEffect(() => {
    forumAllowedRef.current = allowedMenus.includes("forum");
  }, [allowedMenus]);
  useEffect(() => {
    if (!user?.id) return;
    // Request browser notification permission early
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    let stopped = false;
    let reconnectTimer = null;
    function connectGlobalForumSocket() {
      const { token } = getStoredAuth();
      if (!token) return;
      const base = API_URL.replace(/^http/, "ws").replace(/\/api$/, "");
      const wsUrl = `${base}/forum/socket?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      globalForumWsRef.current = ws;
      ws.onmessage = (event) => {
        // Skip while Loop is on screen — it announces its own messages, and it knows which chat
        // is already open. A minimized Loop widget clears this flag so we take over again.
        if (window.__forumPageActive) return;
        try {
          const payload = JSON.parse(event.data || "{}");
          if (payload.type === "forum:message" && payload.message?.senderId !== user.id && !payload.message?.system && forumAllowedRef.current) {
            if (!forumWidgetVisibleRef.current) {
              forumUnreadConversationIdsRef.current.add(String(payload.conversationId));
              setForumUnreadTotal(Math.min(999, forumUnreadConversationIdsRef.current.size));
            }
            const senderName = payload.message?.sender?.displayName || payload.message?.sender?.username || "Someone";
            const fullText = forumMessagePreviewText(payload.message);
            const previewText = fullText.length > 35 ? `${fullText.slice(0, 35)}…` : fullText;
            const mentionNeedle = `@${user?.username || ""}`.toLowerCase();
            playForumNotificationSound();
            // The popup carries the sender, the message, and a View button — on whatever page
            // this user happens to be sitting on.
            showMessagePopup({
              conversationId: payload.conversationId,
              sender: payload.message?.sender,
              senderName,
              text: fullText,
              createdAt: payload.message?.createdAt,
              context: forumMessagePopupContext(payload.conversation),
              mentioned: mentionNeedle.length > 1 && fullText.toLowerCase().includes(mentionNeedle),
            });
            // Browser push notification only when tab is hidden
            if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
              try {
                const browserNotif = new Notification(senderName, {
                  body: previewText || "Sent a message",
                  icon: "/favicon.ico",
                  tag: `forum-global-${payload.conversationId}-${payload.message?.id}`,
                });
                browserNotif.onclick = () => {
                  window.focus();
                  requestForumConversation(payload.conversationId);
                  window.location.href = "/loop";
                  browserNotif.close();
                };
              } catch {}
            }
          }
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (stopped) return;
        reconnectTimer = window.setTimeout(connectGlobalForumSocket, 4000);
      };
    }
    connectGlobalForumSocket();
    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      globalForumWsRef.current?.close();
    };
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (loading || !user) return;
    const isEmployee = !user?.isSuperAdmin && String(user?.roleName || "").trim().toLowerCase() === "employee";
    if (allowedMenus.includes(moduleId)) return;
    const fallback = isEmployee ? "profile" : allowedMenus[0] || "dashboard";
    router.replace(menuPaths[fallback] || "/dashboard");
  }, [allowedMenus, loading, moduleId, router, user]);

  // The shell outlives the Loop page, so a chat left open there must not keep the body
  // locked (or the top chrome hidden) on the next page.
  const forumChatOpen = moduleId === "forum" && forumMobileChatOpen;

  useEffect(() => {
    const chatHeaderColor = darkMode ? "#15171c" : "#ffffff";
    const appColor = darkMode ? "#0b0c0f" : "#eef3f2";
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", forumChatOpen ? chatHeaderColor : appColor);

    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyHeight = document.body.style.height;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlHeight = document.documentElement.style.height;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    if (forumChatOpen && typeof window !== "undefined" && window.innerWidth < 1024) {
      document.body.style.position = "fixed";
      document.body.style.top = "0px";
      document.body.style.left = "0px";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.backgroundColor = chatHeaderColor;
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
      document.documentElement.style.backgroundColor = chatHeaderColor;
      document.documentElement.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.width = previousBodyWidth;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.height = previousBodyHeight;
      document.body.style.backgroundColor = previousBodyBackground;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.height = previousHtmlHeight;
      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      themeMeta.setAttribute("content", appColor);
    };
  }, [darkMode, forumChatOpen]);

  const showLatestUnreadNotification = useCallback((notification) => {
    if (!notification) {
      setLatestNotification(null);
      return;
    }
    if (notification.id === dismissedNotificationId) return;
    setLatestNotification(notification);
  }, [dismissedNotificationId]);

  const closeNotificationStrip = useCallback(() => {
    setDismissedNotificationId(latestNotification?.id || null);
    setLatestNotification(null);
  }, [latestNotification?.id]);

  const viewLatestNotification = useCallback(async () => {
    if (!latestNotification) return;
    try {
      await fetch(`${API_URL}/notifications/${latestNotification.id}/read`, { method: "PATCH" });
      window.dispatchEvent(new Event("uipl:notifications-changed"));
    } catch {
      // Navigation still matters more than read sync here.
    }
    const path = notificationPath(latestNotification);
    setDismissedNotificationId(latestNotification.id);
    setLatestNotification(null);
    if (path) router.push(path);
    else setNotificationsOpen(true);
  }, [latestNotification, router]);

  const shellValue = useMemo(
    () => ({ darkMode, user, allowedMenus, selectedDocs, setSelectedDocs, setForumMobileChatOpen }),
    [allowedMenus, darkMode, selectedDocs, user],
  );

  // Light until mounted: the server can't know the stored theme, so the first paint must match it.
  if (!isMounted || !user) return <ShellSkeleton darkMode={isMounted && darkMode} />;

  if (maintenance?.enabled && !user?.isSuperAdmin) {
    return <MaintenanceScreen darkMode={darkMode} maintenance={maintenance} user={user} onLogout={logout} />;
  }

  const navigateToMenu = (menu) => {
    setSidebarOpen(false);
    setCommandPaletteOpen(false);
    router.push(menuPaths[menu] || "/dashboard");
  };
  const hideTopChrome = forumChatOpen;
  const forumReachable = allowedMenus.includes("forum") && moduleId !== "forum";
  const forumWidgetAvailable = forumWidgetDesktop && forumReachable;
  // Desktop opens Loop from the navbar button; the widget overlay is desktop-only, so small screens
  // keep a floating button that goes to the Loop page. Message popups stack on top of that button
  // when it is on screen rather than over it.
  const forumLauncherVisible = forumReachable && !forumWidgetDesktop;
  const forumWidgetControls = (
    <div className="flex items-center gap-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <button
        type="button"
        onClick={() => setForumWidgetMinimized(true)}
        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-normal transition duration-300 active:scale-95 ${darkMode ? "bg-sky-400/12 text-sky-200 hover:bg-sky-400/18" : "bg-sky-50 text-sky-700 hover:bg-sky-100"}`}
        aria-label="Minimize Loop chat"
      >
        <Minimize className="h-4.5 w-4.5" />
        <span className="hidden sm:inline">Minimize</span>
      </button>
      <button
        type="button"
        onClick={closeForumWidget}
        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-normal transition duration-300 active:scale-95 ${darkMode ? "bg-rose-400/12 text-rose-200 hover:bg-rose-400/18" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}
        aria-label="Close Loop chat"
      >
        <X className="h-4.5 w-4.5" />
        <span className="hidden sm:inline">Close</span>
      </button>
    </div>
  );

  return (
    <div className={`shell-root flex newq ${hideTopChrome ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh md:h-screen"} ${darkMode ? "dark bg-[#0b0c0f]" : "bg-[#f5f5f3]"}`}>
      <Toaster position="top-center" />
      <Sidebar
        activeMenu={moduleId}
        setActiveMenu={navigateToMenu}
        darkMode={darkMode}
        allowedMenus={allowedMenus}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        user={user}
        onLogout={logout}
        onOpenSearch={() => setCommandPaletteOpen(true)}
      />
      {/* Each page sits on a white rounded panel inside the grey frame, as in the reference. */}
      <div className={`app-panel flex-1 newq flex min-h-0 min-w-0 flex-col overflow-hidden md:my-2.5 md:mr-2.5 md:rounded-[24px] md:border ${darkMode ? "bg-[#101114] md:border-white/10" : "bg-white md:border-[#ececec]"}`}>
        {!hideTopChrome && (
          <>
            <Navbar
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              user={user}
              onMenuClick={() => setSidebarOpen(true)}
              onNotificationsClick={() => setNotificationsOpen(true)}
              onNewNotification={showLatestUnreadNotification}
              showLoopButton={forumWidgetAvailable}
              loopUnreadCount={forumUnreadTotal}
              onLoopClick={openForumWidget}
              moduleId={moduleId}
              onOpenSearch={() => setCommandPaletteOpen(true)}
            />
            <NotificationStrip
              notification={latestNotification}
              darkMode={darkMode}
              onClose={closeNotificationStrip}
              onView={viewLatestNotification}
            />
          </>
        )}
        <ShellContext.Provider value={shellValue}>{children}</ShellContext.Provider>
      </div>
      {forumLauncherVisible && (
        <button
          type="button"
          onClick={() => router.push("/loop")}
          className="loop-launcher fixed bottom-5 right-5 z-[80] grid h-14 w-14 place-items-center rounded-full bg-[#2563eb] text-white shadow-[0_18px_45px_rgba(37,99,235,0.34)] transition hover:scale-105 hover:bg-[#1d4ed8] active:scale-95 lg:hidden"
          aria-label="Open Loop chat"
        >
          <MessageCircleMore className="h-6 w-6" />
          {forumUnreadTotal > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-[#0b0c0f]">
              {forumUnreadTotal > 99 ? "99+" : forumUnreadTotal}
            </span>
          )}
        </button>
      )}
      {forumWidgetAvailable && (
        <>
          {forumWidgetOpen && !forumWidgetMinimized && (
            <button
              type="button"
              className={`fixed inset-0 z-[87] cursor-default bg-black/30 backdrop-blur-[2px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${forumWidgetClosing ? "opacity-0" : "opacity-100"}`}
              aria-label="Close Loop backdrop"
              onClick={closeForumWidget}
            />
          )}
          {forumWidgetOpen && (
            <div className={`fixed inset-4 z-[88] overflow-hidden rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:inset-6 ${forumWidgetClosing || forumWidgetMinimized ? "pointer-events-none translate-y-4 scale-[0.96] opacity-0" : "translate-y-0 scale-100 opacity-100 forum-widget-pop"} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <div className="pointer-events-auto absolute right-4 top-3 z-[92] xl:hidden">
                {forumWidgetControls}
              </div>
              <Suspense fallback={null}>
                <Forum
                  darkMode={darkMode}
                  embedded
                  forceMobileView={false}
                  widgetControls={forumWidgetControls}
                  surfaceHidden={forumWidgetMinimized || forumWidgetClosing}
                />
              </Suspense>
            </div>
          )}
        </>
      )}
      <MessagePopupStack
        darkMode={darkMode}
        aboveLauncher={forumLauncherVisible}
        onView={(item) => openForumConversation(item.conversationId)}
      />
      <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} darkMode={darkMode} />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={navigateToMenu}
        allowedMenus={allowedMenus}
        darkMode={darkMode}
      />
    </div>
  );
}

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <ShellContent>{children}</ShellContent>
    </AuthProvider>
  );
}
