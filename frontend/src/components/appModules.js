// Where each menu lives, and the code behind it. Module code is split per page: a page
// downloads only its own module, and the rest are fetched in the background or when a
// link to them is hovered, so switching pages never waits on a download.

export const menuPaths = {
  dashboard: "/dashboard",
  documents: "/documents",
  "department-documents": "/department-documents",
  forms: "/forms",
  projects: "/projects",
  "project-dmr": "/projects/dmr",
  "project-mrn": "/projects/mrn",
  "project-prn": "/projects/prn-module",
  "project-stock": "/projects/stock",
  "site-images": "/projects/site-images",
  "hr-dashboard": "/hr",
  "hr-employees": "/hr/employees",
  "hr-leave": "/hr/leave",
  "hr-attendance": "/hr/attendance",
  "hr-recruitment": "/hr/recruitment",
  todos: "/todos",
  forum: "/loop",
  "sheet-dashboard": "/sheet-dashboard",
  automations: "/automations",
  reports: "/reports",
  finance: "/accounts",
  accounts: "/accounts",
  "accounts-forms": "/accounts/forms",
  "employee-daily-report": "/employee-daily-report",
  "activity-log": "/activity-log",
  whatsapp: "/whatsapp",
  "manage-roles": "/manage-roles",
  "manage-users": "/manage-users",
  "module-control": "/module-control",
  profile: "/profile",
};

// The longest path wins, so /projects/dmr is DMR while /projects/<id> is Project Control.
// /projects/prn is the public spelling of /projects/prn-module (see next.config.mjs).
const pathModules = [
  ...Object.entries(menuPaths).filter(([id]) => id !== "finance"),
  ["project-prn", "/projects/prn"],
]
  .map(([id, path]) => ({ id, path }))
  .sort((a, b) => b.path.length - a.path.length);

export function moduleForPath(pathname = "") {
  return pathModules.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.id ?? null;
}

export const moduleLoaders = {
  Dashboard: () => import("./Dashboard"),
  Documents: () => import("./Documents"),
  DepartmentDocuments: () => import("./DepartmentDocuments"),
  Forms: () => import("./Forms"),
  ProjectDashboard: () => import("./ProjectDashboard"),
  DmrDashboard: () => import("./DmrDashboard"),
  MrnDashboard: () => import("./MrnDashboard"),
  PrnDashboard: () => import("./PrnDashboard"),
  StockDashboard: () => import("./StockDashboard"),
  SiteImagesDashboard: () => import("./SiteImagesDashboard"),
  HrDashboard: () => import("./HrDashboard"),
  RecruitmentDashboard: () => import("./RecruitmentDashboard"),
  Todos: () => import("./Todos"),
  Forum: () => import("./Forum"),
  Automations: () => import("./Automations"),
  SheetDashboard: () => import("./SheetDashboard"),
  Reports: () => import("./Reports"),
  AccountsDashboard: () => import("./AccountsDashboard"),
  AccountsFormsModule: () => import("./AccountsFormsModule"),
  EmployeeDailyReport: () => import("./EmployeeDailyReport"),
  ActivityLog: () => import("./ActivityLog"),
  WhatsApp: () => import("./WhatsApp"),
  ManageRoles: () => import("./ManageRoles"),
  ModuleControl: () => import("./ModuleControl"),
  ProfilePage: () => import("./ProfilePage"),
};

const menuModules = {
  dashboard: "Dashboard",
  documents: "Documents",
  "department-documents": "DepartmentDocuments",
  forms: "Forms",
  projects: "ProjectDashboard",
  "project-dmr": "DmrDashboard",
  "project-mrn": "MrnDashboard",
  "project-prn": "PrnDashboard",
  "project-stock": "StockDashboard",
  "site-images": "SiteImagesDashboard",
  "hr-dashboard": "HrDashboard",
  "hr-employees": "HrDashboard",
  "hr-leave": "HrDashboard",
  "hr-attendance": "HrDashboard",
  "hr-recruitment": "RecruitmentDashboard",
  todos: "Todos",
  forum: "Forum",
  "sheet-dashboard": "SheetDashboard",
  automations: "Automations",
  reports: "Reports",
  finance: "AccountsDashboard",
  accounts: "AccountsDashboard",
  "accounts-forms": "AccountsFormsModule",
  "employee-daily-report": "EmployeeDailyReport",
  "activity-log": "ActivityLog",
  whatsapp: "WhatsApp",
  "manage-roles": "ManageRoles",
  "manage-users": "ManageRoles",
  "module-control": "ModuleControl",
  profile: "ProfilePage",
};

/** Starts downloading a menu's code. Safe to call repeatedly; the bundler caches the chunk. */
export function preloadModule(menuId) {
  const load = moduleLoaders[menuModules[menuId]];
  return load ? load().catch(() => {}) : Promise.resolve();
}
