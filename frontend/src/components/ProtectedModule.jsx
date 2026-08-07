"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { BellRing, MessageCircleMore, Minimize, X } from "lucide-react";
import { API_URL, AuthProvider, getStoredAuth, useAuth } from "./AuthProvider";
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
import Dashboard from "./Dashboard";
import Documents from "./Documents";
import Automations from "./Automations";
import Reports from "./Reports";
import NotificationDrawer from "./NotificationDrawer";
import SheetDashboard from "./SheetDashboard";
import ManageRoles from "./ManageRoles";
import ActivityLog from "./ActivityLog";
import WhatsApp from "./WhatsApp";
import Forms from "./Forms";
import ProjectDashboard from "./ProjectDashboard";
import DmrDashboard from "./DmrDashboard";
import MrnDashboard from "./MrnDashboard";
import StockDashboard from "./StockDashboard";
import SiteImagesDashboard from "./SiteImagesDashboard";
import EmployeeDailyReport from "./EmployeeDailyReport";
import Todos from "./Todos";
import Forum from "./Forum";
import ModuleControl from "./ModuleControl";
import HrDashboard from "./HrDashboard";
import ProfilePage from "./ProfilePage";
import CommandPalette from "./CommandPalette";

const menuPaths = {
  dashboard: "/dashboard",
  documents: "/documents",
  forms: "/forms",
  projects: "/projects",
  "project-dmr": "/projects/dmr",
  "project-mrn": "/projects/mrn",
  "project-stock": "/projects/stock",
  "site-images": "/projects/site-images",
  "hr-dashboard": "/hr",
  "hr-employees": "/hr/employees",
  "hr-leave": "/hr/leave",
  "hr-attendance": "/hr/attendance",
  todos: "/todos",
  forum: "/loop",
  "sheet-dashboard": "/sheet-dashboard",
  automations: "/automations",
  reports: "/reports",
  "employee-daily-report": "/employee-daily-report",
  "activity-log": "/activity-log",
  whatsapp: "/whatsapp",
  "manage-roles": "/manage-roles",
  "manage-users": "/manage-users",
  "module-control": "/module-control",
  profile: "/profile",
};

function notificationPath(notification = {}) {
  if (notification.path || notification.href || notification.url) return notification.path || notification.href || notification.url;
  if (notification.type === "hr-leave") return "/hr/leave";
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
    <div className={`border-b px-4 py-3 sm:px-6 lg:px-8 ${darkMode ? "border-white/10 bg-[#101820] text-white" : "border-emerald-100 bg-[#ecfff5] text-[#10210c]"}`}>
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

function ProtectedModuleContent({ moduleId, projectId }) {
  const router = useRouter();
  const { user, menus, disabledModules, loading, logout } = useAuth();
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
      ...(user?.isSuperAdmin ? [...menus, "project-mrn", "project-stock", "hr-dashboard", "hr-employees", "hr-leave", "hr-attendance", "todos", "forum", "whatsapp", "manage-users", "module-control"] : menus.filter((menu) => !["access-management", "manage-roles", "manage-users", "whatsapp", "module-control"].includes(menu))),
      "projects",
      "profile",
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
        const response = await fetch(`${API_URL}/forum/bootstrap`);
        if (!response.ok) return;
        const data = await response.json();
        if (stopped) return;
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
      setForumWidgetOpen(true);
      setForumWidgetMinimized(false);
      setForumWidgetClosing(false);
      forumUnreadConversationIdsRef.current = new Set();
      setForumUnreadTotal(0);
      return;
    }
    router.push("/loop");
  }, [allowedMenus, forumWidgetClosing, forumWidgetDesktop, forumWidgetOpen, moduleId, router]);

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

  useEffect(() => {
    const chatHeaderColor = darkMode ? "#15171c" : "#ffffff";
    const appColor = darkMode ? "#0b0c0f" : "#eef3f2";
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", forumMobileChatOpen ? chatHeaderColor : appColor);

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

    if (forumMobileChatOpen && typeof window !== "undefined" && window.innerWidth < 1024) {
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
  }, [darkMode, forumMobileChatOpen]);

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

  if (!isMounted || !user || (!loading && !allowedMenus.includes(moduleId))) {
    return (
      <div className={`min-h-dvh ${darkMode ? "bg-[#0f1115]" : "bg-[#eef3f2]"}`} />
    );
  }

  const navigateToMenu = (menu) => {
    setSidebarOpen(false);
    setCommandPaletteOpen(false);
    router.push(menuPaths[menu] || "/dashboard");
  };
  const hideTopChrome = moduleId === "forum" && forumMobileChatOpen;
  const forumWidgetAvailable = forumWidgetDesktop && allowedMenus.includes("forum") && moduleId !== "forum";
  // The floating Loop button owns the bottom-right corner whenever it is on screen, so message
  // popups stack on top of it instead of over it.
  const forumLauncherVisible = forumWidgetAvailable && (!forumWidgetOpen || forumWidgetMinimized);
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
    <div className={`flex newq ${hideTopChrome ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh md:h-screen"} ${darkMode ? "dark bg-[#0b0c0f]" : "bg-[#eef3f2]"}`}>
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
      <div className="flex-1 newq flex min-h-0 min-w-0 flex-col overflow-hidden">
        {!hideTopChrome && (
          <>
            <Navbar
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              user={user}
              onMenuClick={() => setSidebarOpen(true)}
              onNotificationsClick={() => setNotificationsOpen(true)}
              onNewNotification={showLatestUnreadNotification}
            />
            <NotificationStrip
              notification={latestNotification}
              darkMode={darkMode}
              onClose={closeNotificationStrip}
              onView={viewLatestNotification}
            />
          </>
        )}
        {moduleId === "dashboard" && (
          <Dashboard darkMode={darkMode} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} />
        )}
        {moduleId === "documents" && (
          <Documents darkMode={darkMode} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} />
        )}
        {moduleId === "forms" && <Forms darkMode={darkMode} />}
        {moduleId === "projects" && <ProjectDashboard darkMode={darkMode} projectId={projectId} />}
        {moduleId === "project-dmr" && <DmrDashboard darkMode={darkMode} />}
        {moduleId === "project-mrn" && <MrnDashboard darkMode={darkMode} />}
        {moduleId === "project-stock" && <StockDashboard darkMode={darkMode} />}
        {moduleId === "site-images" && <SiteImagesDashboard darkMode={darkMode} />}
        {moduleId === "hr-dashboard" && <HrDashboard darkMode={darkMode} section="dashboard" />}
        {moduleId === "hr-employees" && <HrDashboard darkMode={darkMode} section="employees" />}
        {moduleId === "hr-leave" && <HrDashboard darkMode={darkMode} section="leave" />}
        {moduleId === "hr-attendance" && <HrDashboard darkMode={darkMode} section="attendance" />}
        {moduleId === "todos" && <Todos darkMode={darkMode} />}
        {moduleId === "forum" && <Forum darkMode={darkMode} onMobileChatOpenChange={setForumMobileChatOpen} />}
        {moduleId === "automations" && <Automations darkMode={darkMode} />}
        {moduleId === "sheet-dashboard" && <SheetDashboard darkMode={darkMode} />}
        {moduleId === "reports" && <Reports darkMode={darkMode} />}
        {moduleId === "employee-daily-report" && <EmployeeDailyReport darkMode={darkMode} />}
        {moduleId === "activity-log" && <ActivityLog darkMode={darkMode} />}
        {moduleId === "whatsapp" && user?.isSuperAdmin && <WhatsApp darkMode={darkMode} />}
        {moduleId === "manage-roles" && <ManageRoles darkMode={darkMode} mode="roles" />}
        {moduleId === "manage-users" && <ManageRoles darkMode={darkMode} mode="users" />}
        {moduleId === "module-control" && user?.isSuperAdmin && <ModuleControl darkMode={darkMode} />}
        {moduleId === "profile" && <ProfilePage darkMode={darkMode} />}
      </div>
      {forumWidgetAvailable && (
        <>
          {forumLauncherVisible && (
            <button
              type="button"
              onClick={() => {
                setForumWidgetOpen(true);
                setForumWidgetMinimized(false);
                setForumWidgetClosing(false);
                forumUnreadConversationIdsRef.current = new Set();
                setForumUnreadTotal(0);
              }}
              className="fixed bottom-5 right-5 z-[80] grid h-14 w-14 place-items-center rounded-full bg-[#2563eb] text-white shadow-[0_18px_45px_rgba(37,99,235,0.34)] transition hover:scale-105 hover:bg-[#1d4ed8] active:scale-95"
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
              <Forum
                darkMode={darkMode}
                embedded
                forceMobileView={false}
                widgetControls={forumWidgetControls}
                surfaceHidden={forumWidgetMinimized || forumWidgetClosing}
              />
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

export default function ProtectedModule({ moduleId, projectId }) {
  return (
    <AuthProvider>
      <ProtectedModuleContent moduleId={moduleId} projectId={projectId} />
    </AuthProvider>
  );
}
