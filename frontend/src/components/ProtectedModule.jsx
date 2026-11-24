"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import { useShell } from "./AppShell";
import { moduleLoaders } from "./appModules";

const Dashboard = lazy(moduleLoaders.Dashboard);
const Documents = lazy(moduleLoaders.Documents);
const DepartmentDocuments = lazy(moduleLoaders.DepartmentDocuments);
const Forms = lazy(moduleLoaders.Forms);
const ProjectDashboard = lazy(moduleLoaders.ProjectDashboard);
const DmrDashboard = lazy(moduleLoaders.DmrDashboard);
const MrnDashboard = lazy(moduleLoaders.MrnDashboard);
const PrnDashboard = lazy(moduleLoaders.PrnDashboard);
const StockDashboard = lazy(moduleLoaders.StockDashboard);
const SiteImagesDashboard = lazy(moduleLoaders.SiteImagesDashboard);
const HrDashboard = lazy(moduleLoaders.HrDashboard);
const RecruitmentDashboard = lazy(moduleLoaders.RecruitmentDashboard);
const Todos = lazy(moduleLoaders.Todos);
const Forum = lazy(moduleLoaders.Forum);
const Automations = lazy(moduleLoaders.Automations);
const SheetDashboard = lazy(moduleLoaders.SheetDashboard);
const Reports = lazy(moduleLoaders.Reports);
const AccountsDashboard = lazy(moduleLoaders.AccountsDashboard);
const AccountsFormsModule = lazy(moduleLoaders.AccountsFormsModule);
const EmployeeDailyReport = lazy(moduleLoaders.EmployeeDailyReport);
const ActivityLog = lazy(moduleLoaders.ActivityLog);
const WhatsApp = lazy(moduleLoaders.WhatsApp);
const ManageRoles = lazy(moduleLoaders.ManageRoles);
const ModuleControl = lazy(moduleLoaders.ModuleControl);
const SlackCenter = lazy(moduleLoaders.SlackCenter);
const ProfilePage = lazy(moduleLoaders.ProfilePage);

/** Shimmering stand-in while a module's code downloads, laid out like a typical module page. */
export function ModuleSkeleton({ darkMode }) {
  const page = darkMode ? "bg-[#0b0c0f]" : "bg-[#eef3f2]";
  const card = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#dfe7e4] bg-white";
  const bar = darkMode ? "skeleton-bar skeleton-bar-dark" : "skeleton-bar";
  return (
    <div className={`module-skeleton flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-4 sm:p-6 ${page}`} aria-busy="true" aria-label="Loading">
      <div className={`rounded-[30px] border p-6 sm:p-8 ${card}`}>
        <div className={`h-7 w-56 rounded-xl ${bar}`} />
        <div className={`mt-3 h-4 w-80 max-w-full rounded-lg ${bar}`} />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className={`h-20 rounded-2xl ${bar}`} />
          ))}
        </div>
      </div>
      <div className={`flex-1 rounded-[30px] border p-6 ${card}`}>
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center gap-4 py-3">
            <div className={`h-10 w-10 shrink-0 rounded-full ${bar}`} />
            <div className="flex-1">
              <div className={`h-3.5 w-1/3 rounded-md ${bar}`} />
              <div className={`mt-2 h-3 w-1/5 rounded-md ${bar}`} />
            </div>
            <div className={`hidden h-7 w-24 rounded-full sm:block ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Plays the entrance (the page rises in, its sections one after another) once, when the
// module's code has arrived. The class comes off afterwards so anything the module opens
// later — dialogs, drawers, new rows — appears without replaying it.
function ModuleEntrance({ children }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className={`module-frame ${entering ? "module-entering" : ""}`}>{children}</div>;
}

export default function ProtectedModule({ moduleId, projectId, departmentId }) {
  const shell = useShell();
  // The shell redirects away from modules this account can't open; render nothing meanwhile.
  if (!shell?.allowedMenus.includes(moduleId)) return null;
  const { darkMode, user, selectedDocs, setSelectedDocs, setForumMobileChatOpen } = shell;

  return (
    <Suspense fallback={<ModuleSkeleton darkMode={darkMode} />}>
      <ModuleEntrance>
        {moduleId === "dashboard" && (
          <Dashboard darkMode={darkMode} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} />
        )}
        {moduleId === "documents" && (
          <Documents darkMode={darkMode} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} />
        )}
        {moduleId === "department-documents" && <DepartmentDocuments darkMode={darkMode} departmentId={departmentId} />}
        {moduleId === "forms" && <Forms darkMode={darkMode} />}
        {moduleId === "projects" && <ProjectDashboard darkMode={darkMode} projectId={projectId} />}
        {moduleId === "project-dmr" && <DmrDashboard darkMode={darkMode} />}
        {moduleId === "project-mrn" && <MrnDashboard darkMode={darkMode} />}
        {moduleId === "project-prn" && <PrnDashboard darkMode={darkMode} />}
        {moduleId === "project-stock" && <StockDashboard darkMode={darkMode} />}
        {moduleId === "site-images" && <SiteImagesDashboard darkMode={darkMode} />}
        {moduleId === "hr-dashboard" && <HrDashboard darkMode={darkMode} section="dashboard" />}
        {moduleId === "hr-employees" && <HrDashboard darkMode={darkMode} section="employees" />}
        {moduleId === "hr-leave" && <HrDashboard darkMode={darkMode} section="leave" />}
        {moduleId === "hr-attendance" && <HrDashboard darkMode={darkMode} section="attendance" />}
        {moduleId === "hr-recruitment" && <RecruitmentDashboard darkMode={darkMode} />}
        {moduleId === "todos" && <Todos darkMode={darkMode} />}
        {moduleId === "forum" && <Forum darkMode={darkMode} onMobileChatOpenChange={setForumMobileChatOpen} />}
        {moduleId === "automations" && <Automations darkMode={darkMode} />}
        {moduleId === "sheet-dashboard" && <SheetDashboard darkMode={darkMode} />}
        {moduleId === "reports" && <Reports darkMode={darkMode} />}
        {moduleId === "accounts" && <AccountsDashboard darkMode={darkMode} />}
        {moduleId === "accounts-forms" && <AccountsFormsModule darkMode={darkMode} />}
        {moduleId === "employee-daily-report" && <EmployeeDailyReport darkMode={darkMode} />}
        {moduleId === "activity-log" && <ActivityLog darkMode={darkMode} />}
        {moduleId === "whatsapp" && user?.isSuperAdmin && <WhatsApp darkMode={darkMode} />}
        {moduleId === "slack" && user?.isSuperAdmin && <SlackCenter darkMode={darkMode} />}
        {moduleId === "manage-roles" && <ManageRoles darkMode={darkMode} mode="roles" />}
        {moduleId === "manage-users" && <ManageRoles darkMode={darkMode} mode="users" />}
        {moduleId === "module-control" && user?.isSuperAdmin && <ModuleControl darkMode={darkMode} />}
        {moduleId === "profile" && <ProfilePage darkMode={darkMode} />}
      </ModuleEntrance>
    </Suspense>
  );
}
