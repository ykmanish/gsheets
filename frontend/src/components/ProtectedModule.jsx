"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { BellRing, X } from "lucide-react";
import { API_URL, AuthProvider, getStoredAuth, useAuth } from "./AuthProvider";
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
  forum: "/forum",
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
    function openCommandPalette(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", openCommandPalette);
    return () => window.removeEventListener("keydown", openCommandPalette);
  }, []);

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

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyHeight = document.body.style.height;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlHeight = document.documentElement.style.height;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    if (forumMobileChatOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100dvh";
      document.body.style.backgroundColor = chatHeaderColor;
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100dvh";
      document.documentElement.style.backgroundColor = chatHeaderColor;
      document.documentElement.style.overscrollBehavior = "none";
    }

    return () => {
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
