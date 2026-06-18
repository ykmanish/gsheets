"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { AuthProvider, getStoredAuth, useAuth } from "./AuthProvider";
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

const menuPaths = {
  dashboard: "/dashboard",
  documents: "/documents",
  "sheet-dashboard": "/sheet-dashboard",
  automations: "/automations",
  reports: "/reports",
  "activity-log": "/activity-log",
  "manage-roles": "/manage-roles",
};

function ProtectedModuleContent({ moduleId }) {
  const router = useRouter();
  const { user, menus, loading, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = getStoredAuth().user;
    if (!storedUser?.id) return false;
    return window.localStorage.getItem(`uipl_docs_theme_${storedUser.id}`) === "dark";
  });
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const allowedMenus = useMemo(() => {
    return Array.from(new Set([
      ...(user?.isSuperAdmin ? menus : menus.filter((menu) => menu !== "manage-roles")),
    ])).filter((menu) => !["notifications", "settings"].includes(menu));
  }, [menus, user?.isSuperAdmin]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(`uipl_docs_theme_${user.id}`, darkMode ? "dark" : "light");
  }, [darkMode, user?.id]);

  useEffect(() => {
    if (loading || !user) return;
    if (allowedMenus.includes(moduleId)) return;
    const fallback = allowedMenus[0] || "dashboard";
    router.replace(menuPaths[fallback] || "/dashboard");
  }, [allowedMenus, loading, moduleId, router, user]);

  if (!user || (!loading && !allowedMenus.includes(moduleId))) {
    return (
      <div className={`min-h-dvh ${darkMode ? "bg-[#0f1115]" : "bg-[#f6f6f4]"}`} />
    );
  }

  const navigateToMenu = (menu) => {
    setSidebarOpen(false);
    router.push(menuPaths[menu] || "/dashboard");
  };

  return (
    <div className={`flex newq min-h-dvh md:h-screen ${darkMode ? "dark" : ""}`}>
      <Toaster position="top-center" />
      <Sidebar
        activeMenu={moduleId}
        setActiveMenu={navigateToMenu}
        darkMode={darkMode}
        allowedMenus={allowedMenus}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="flex-1 newq flex min-w-0 flex-col overflow-hidden">
        <Navbar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          user={user}
          onLogout={logout}
          onMenuClick={() => setSidebarOpen(true)}
          onNotificationsClick={() => setNotificationsOpen(true)}
        />
        {moduleId === "dashboard" && (
          <Dashboard darkMode={darkMode} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} />
        )}
        {moduleId === "documents" && (
          <Documents darkMode={darkMode} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} />
        )}
        {moduleId === "automations" && <Automations darkMode={darkMode} />}
        {moduleId === "sheet-dashboard" && <SheetDashboard darkMode={darkMode} />}
        {moduleId === "reports" && <Reports darkMode={darkMode} />}
        {moduleId === "activity-log" && <ActivityLog darkMode={darkMode} />}
        {moduleId === "manage-roles" && <ManageRoles darkMode={darkMode} />}
      </div>
      <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} darkMode={darkMode} />
    </div>
  );
}

export default function ProtectedModule({ moduleId }) {
  return (
    <AuthProvider>
      <ProtectedModuleContent moduleId={moduleId} />
    </AuthProvider>
  );
}
