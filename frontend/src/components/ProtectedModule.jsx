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
import WhatsApp from "./WhatsApp";
import Forms from "./Forms";
import ProjectDashboard from "./ProjectDashboard";
import DmrDashboard from "./DmrDashboard";
import MrnDashboard from "./MrnDashboard";
import StockDashboard from "./StockDashboard";
import SiteImagesDashboard from "./SiteImagesDashboard";
import EmployeeDailyReport from "./EmployeeDailyReport";
import ModuleControl from "./ModuleControl";
import HrDashboard from "./HrDashboard";
import ProfilePage from "./ProfilePage";

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
  "hr-documents": "/hr/documents",
  "hr-salary-slips": "/hr/salary-slips",
  "hr-leave": "/hr/leave",
  "hr-attendance": "/hr/attendance",
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
  const allowedMenus = useMemo(() => {
    const assigned = [
      ...(user?.isSuperAdmin ? [...menus, "project-mrn", "project-stock", "hr-dashboard", "hr-employees", "hr-documents", "hr-salary-slips", "hr-leave", "hr-attendance", "whatsapp", "manage-users", "module-control"] : menus.filter((menu) => !["access-management", "manage-roles", "manage-users", "whatsapp", "module-control"].includes(menu))),
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
    if (loading || !user) return;
    const isEmployee = !user?.isSuperAdmin && String(user?.roleName || "").trim().toLowerCase() === "employee";
    if (allowedMenus.includes(moduleId)) return;
    const fallback = isEmployee ? "profile" : allowedMenus[0] || "dashboard";
    router.replace(menuPaths[fallback] || "/dashboard");
  }, [allowedMenus, loading, moduleId, router, user]);

  if (!isMounted || !user || (!loading && !allowedMenus.includes(moduleId))) {
    return (
      <div className={`min-h-dvh ${darkMode ? "bg-[#0f1115]" : "bg-[#eef3f2]"}`} />
    );
  }

  const navigateToMenu = (menu) => {
    setSidebarOpen(false);
    router.push(menuPaths[menu] || "/dashboard");
  };

  return (
    <div className={`flex newq min-h-dvh md:h-screen ${darkMode ? "dark bg-[#0b0c0f]" : "bg-[#eef3f2]"}`}>
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
      />
      <div className="flex-1 newq flex min-w-0 flex-col overflow-hidden">
        <Navbar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
          onNotificationsClick={() => setNotificationsOpen(true)}
        />
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
        {moduleId === "hr-documents" && <HrDashboard darkMode={darkMode} section="documents" />}
        {moduleId === "hr-salary-slips" && <HrDashboard darkMode={darkMode} section="salary" />}
        {moduleId === "hr-leave" && <HrDashboard darkMode={darkMode} section="leave" />}
        {moduleId === "hr-attendance" && <HrDashboard darkMode={darkMode} section="attendance" />}
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
