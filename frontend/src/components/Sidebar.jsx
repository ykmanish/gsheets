import { useState } from "react";
import { LayoutDashboard, FileText, Workflow, ChartNoAxesCombined, Sheet, ShieldCheck, Activity, MessageCircleMore, X, ClipboardList, Building2, FileSpreadsheet, ChevronDown, CalendarCheck } from "lucide-react";
import Image from "next/image";

export default function Sidebar({ activeMenu, setActiveMenu, darkMode, allowedMenus = [], mobileOpen = false, setMobileOpen }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "forms", label: "Forms", icon: ClipboardList },
    { id: "projects", label: "Projects", icon: Building2 },
    { id: "project-dmr", label: "DMR", icon: FileSpreadsheet, parent: "projects" },
    { id: "project-mrn", label: "MRN", icon: ClipboardList, parent: "projects" },
    { id: "sheet-dashboard", label: "Sheet Dashboard", icon: Sheet },
    { id: "automations", label: "Automation", icon: Workflow },
    { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
    { id: "employee-daily-report", label: "Employee Daily Report", icon: CalendarCheck },
    { id: "activity-log", label: "Activity Log", icon: Activity },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircleMore },
    { id: "manage-roles", label: "Manage Roles", icon: ShieldCheck },
  ];
  const projectSubMenu = menuItems.filter((item) => ["projects", "project-dmr", "project-mrn"].includes(item.id) && allowedMenus.includes(item.id));
  const visibleMenuItems = menuItems.filter((item) => allowedMenus.includes(item.id) || (item.id === "projects" && projectSubMenu.length));
  const [openGroups, setOpenGroups] = useState(() => ({ projects: projectSubMenu.some((item) => item.id === activeMenu) }));
  const shell = darkMode
    ? "border-white/10 bg-[#101114]"
    : "border-black/[0.06] bg-white";
  const divider = darkMode ? "border-white/10" : "border-black/[0.08]";
  const muted = darkMode ? "text-white/38" : "text-black/38";

  const itemClass = ({ active = false, child = false, parentActive = false } = {}) => `w-full newq flex items-center gap-3 rounded-2xl py-2 text-left transition-all duration-300 ${child ? "px-3" : "px-4"} ${
    parentActive
      ? darkMode
        ? "bg-white/[0.07] text-white/80"
        : "bg-black/[0.055] text-black/75"
      : active
      ? darkMode
        ? "bg-white/10 text-white"
        : "bg-black/[0.075] text-black"
      : darkMode
      ? "text-white/58 hover:bg-white/5 hover:text-white"
      : "text-black/58 hover:bg-black/[0.045] hover:text-black"
  }`;

  const iconClass = ({ active = false, child = false, parentActive = false } = {}) => `${child ? "h-8 w-8" : "h-9 w-9"} rounded-full flex items-center justify-center transition-all duration-300 ${
    parentActive
      ? darkMode
        ? "bg-white/10 text-white/70"
        : "bg-white text-black/70"
      : active
      ? darkMode
        ? "bg-[#d8f36a] text-black"
        : "bg-white text-black"
      : darkMode
      ? "bg-white/5"
      : "bg-black/[0.035]"
  }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen?.(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col overflow-hidden border-r transition-transform duration-300 md:static md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${shell}`}
        style={{
          fontFamily:
            '"Google Sans", "Product Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
      <div className={`border-b border-dashed px-5 py-5 ${divider}`}>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${darkMode ? "bg-white/5" : "bg-white"}`}
          >
            <Image src="/logo.png" alt="Logo" width={34} height={34} className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h1
              className={`truncate text-[20px] small font-semibold leading-none ${
                darkMode ? "text-white" : "text-black"
              }`}
            >
              UIPL Docs
            </h1>
            <p className={`mt-1 text-[11px] ${muted}`}>
              AI document workspace
            </p>
          </div>
          <button
            onClick={() => setMobileOpen?.(false)}
            className={`ml-auto flex h-10 w-10 items-center justify-center rounded-full md:hidden ${darkMode ? "hover:bg-white/5 text-white/70" : "hover:bg-black/5 text-black/60"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className={`space-y-1.5 border-b border-dashed pb-3 ${divider}`}>
        {visibleMenuItems.map((item) => {
          if (item.parent === "projects") return null;
          if (item.id === "projects" && projectSubMenu.length) {
            const isOpen = Boolean(openGroups.projects);
            const childActive = projectSubMenu.some((child) => child.id === activeMenu);
            return (
              <div key="projects-group" className="overflow-hidden rounded-[22px] transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setOpenGroups((current) => ({ ...current, projects: !current.projects }))}
                  className={itemClass({ parentActive: childActive })}
                >
                  <span className={iconClass({ parentActive: childActive })}>
                    <Building2 className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">Projects</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
                </button>

                <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="relative ml-7 mt-1 space-y-1 pb-2 pl-5">
                      <span className={`absolute bottom-5 left-0 top-0 w-px rounded-full ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                      {projectSubMenu.map((child) => {
                        const ChildIcon = child.icon;
                        const active = activeMenu === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => setActiveMenu(child.id)}
                            className={itemClass({ active, child: true })}
                          >
                            <span className={`absolute left-0 h-px w-4 ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                            <span className={iconClass({ active, child: true })}>
                              <ChildIcon className="h-4 w-4" />
                            </span>
                            <span className="max-w-full truncate text-[14px]">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const Icon = item.icon;
          const isActive = activeMenu === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={itemClass({ active: isActive })}
            >
              <span className={iconClass({ active: isActive })}>
                <Icon className="w-4.5 h-4.5" />
              </span>
              <span className="max-w-full truncate text-[15px]">{item.label}</span>
            </button>
          );
        })}
        </div>
      </nav>

      <div className={`border-t border-dashed p-4 ${divider}`}>
  <div
    className={`rounded-[22px] px-4 py-4 text-center  ${
      darkMode
        ? "bg-white/[0.035]"
        : "bg-white"
    }`}
  >
    <p
      className={`text-xs small ${muted}`}
    >
      Powered by AI
    </p>

    <div className="mt-3 flex items-center justify-center gap-3">
      <Image
        src={darkMode ? "/whiteclaudelogo.svg" : "/blackclaudelogo.svg"}
        alt="Claude"
        width={92}
        height={28}
        className="h-7 w-auto"
      />

     
    </div>
  </div>
</div>
      </aside>
    </>
  );
}
