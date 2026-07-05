import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, FileText, Workflow, ChartNoAxesCombined, Sheet, ShieldCheck, Activity, MessageCircleMore, X, ClipboardList, Building2, FileSpreadsheet, ChevronDown, CalendarCheck, Users, PanelLeftClose, PanelLeftOpen, Search, LogOut, Images } from "lucide-react";
import Image from "next/image";
import { API_URL } from "./AuthProvider";

export default function Sidebar({ activeMenu, setActiveMenu, darkMode, allowedMenus = [], mobileOpen = false, setMobileOpen, collapsed = false, setCollapsed, user, onLogout }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "forms", label: "Forms", icon: ClipboardList },
    { id: "projects", label: "Projects", icon: Building2 },
    { id: "project-dmr", label: "DMR", icon: FileSpreadsheet, parent: "projects" },
    { id: "project-mrn", label: "MRN", icon: ClipboardList, parent: "projects" },
    { id: "site-images", label: "Site Images", icon: Images, parent: "projects" },
    { id: "sheet-dashboard", label: "Sheet Dashboard", icon: Sheet },
    { id: "automations", label: "Automation", icon: Workflow },
    { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
    { id: "employee-daily-report", label: "Employee Daily Report", icon: CalendarCheck },
    { id: "activity-log", label: "Activity Log", icon: Activity },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircleMore },
    { id: "access-management", label: "Access Control", icon: ShieldCheck },
    { id: "manage-roles", label: "Manage Role", icon: ShieldCheck, parent: "access-management" },
    { id: "manage-users", label: "Manage User", icon: Users, parent: "access-management" },
  ];
  const projectSubMenu = menuItems.filter((item) => ["projects", "project-dmr", "project-mrn", "site-images"].includes(item.id) && allowedMenus.includes(item.id));
  const accessSubMenu = menuItems.filter((item) => item.parent === "access-management" && allowedMenus.includes(item.id));
  const visibleMenuItems = menuItems.filter((item) => allowedMenus.includes(item.id) || (item.id === "projects" && projectSubMenu.length) || (item.id === "access-management" && accessSubMenu.length));
  const [openGroups, setOpenGroups] = useState(() => ({
    projects: projectSubMenu.some((item) => item.id === activeMenu),
    access: accessSubMenu.some((item) => item.id === activeMenu),
  }));
  const [menuSearch, setMenuSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [newSiteImages, setNewSiteImages] = useState(false);
  const navRef = useRef(null);
  const profileRef = useRef(null);
  const searchTerm = menuSearch.trim().toLowerCase();
  const filteredProjectSubMenu = projectSubMenu.filter((item) => !searchTerm || item.label.toLowerCase().includes(searchTerm));
  const filteredAccessSubMenu = accessSubMenu.filter((item) => !searchTerm || item.label.toLowerCase().includes(searchTerm));
  const filteredMenuItems = visibleMenuItems.filter((item) => {
    if (!searchTerm) return true;
    if (item.label.toLowerCase().includes(searchTerm)) return true;
    if (item.id === "projects") return filteredProjectSubMenu.length > 0;
    if (item.id === "access-management") return filteredAccessSubMenu.length > 0;
    return false;
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nav = navRef.current;
      const activeItem = nav?.querySelector(`[data-sidebar-menu="${activeMenu}"]`);
      if (!nav || !activeItem) return;
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const targetTop = nav.scrollTop + itemRect.top - navRect.top - (nav.clientHeight - itemRect.height) / 2;
      nav.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }, 360);

    return () => window.clearTimeout(timeoutId);
  }, [activeMenu]);

  useEffect(() => {
    let stopped = false;
    const storageKey = `uipl_site_images_seen_${user?.id || "user"}`;
    async function check() {
      try {
        const docsResponse = await fetch(`${API_URL}/documents`);
        const docsData = await docsResponse.json();
        const doc = (docsData.documents || []).find((item) => item.type === "sheet" && /site\s*daily\s*report/i.test(item.name));
        if (!doc || stopped) return;
        const response = await fetch(`${API_URL}/sheets/${doc.id}/data`);
        const data = await response.json();
        if (!response.ok || stopped) return;
        const signature = (data.sheets || []).flatMap((sheet) => (sheet.rows || []).flatMap((row) => (sheet.headers || []).flatMap((header) => String(row[header] ?? "").match(/https?:\/\/[^\s,;]+/g) || []))).sort().join("|");
        const seen = window.localStorage.getItem(storageKey);
        if (!seen || activeMenu === "site-images") {
          window.localStorage.setItem(storageKey, signature);
          setNewSiteImages(false);
        } else setNewSiteImages(signature !== seen);
      } catch {
        // The module itself shows source/access errors; the nav indicator stays quiet.
      }
    }
    void check();
    const timer = window.setInterval(check, 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [activeMenu, user?.id]);
  const shell = darkMode
    ? "border-white/10 bg-[#101114]"
    : "border-[#e7eaee] bg-white";
  const muted = darkMode ? "text-white/38" : "text-slate-400";
  const displayName = user?.displayName || user?.username || "User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const itemClass = ({ active = false, child = false, parentActive = false } = {}) => `newq flex h-10 items-center gap-3 rounded-[14px] text-left transition-all duration-300 ${collapsed ? "md:mx-auto md:h-12 md:w-12 md:justify-center md:gap-0 md:rounded-[16px] md:p-0" : "w-full px-3"} ${child ? "px-3" : ""} ${
    parentActive
      ? darkMode
        ? "bg-white/[0.07] text-white/80"
        : "bg-[#a8f0cf] text-[#163f32]"
      : active
      ? darkMode
        ? "bg-white/10 text-white"
        : "bg-[#a8f0cf] text-[#163f32]"
      : darkMode
      ? "text-white/58 hover:bg-white/5 hover:text-white"
      : "text-slate-600 hover:bg-[#f3f6f8] hover:text-slate-950"
  }`;

  const iconClass = ({ active = false, child = false, parentActive = false } = {}) => `${child ? "h-7 w-7" : "h-7 w-7"} flex shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${collapsed ? "md:h-10 md:w-10" : ""} ${
    parentActive
      ? darkMode
        ? "bg-white/10 text-white/70"
        : "text-[#163f32]"
      : active
      ? darkMode
        ? "bg-[#d8f36a] text-black"
        : "text-[#163f32]"
      : darkMode
      ? "text-white/55"
      : "text-slate-500"
  }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen?.(false)}
      />
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[248px] transform flex-col dark:border-r lg:border-r-0 md:static md:z-auto md:h-screen md:translate-x-0 ${collapsed ? "app-sidebar-collapsed" : ""} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${shell}`}
        style={{
          fontFamily:
            '"Google Sans", "Product Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div className={`relative px-4 pb-2 pt-4 transition-all duration-300 ${collapsed ? "md:px-3" : ""}`}>
          <div className="flex items-center justify-center gap-3 transition-all duration-500">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-500 `}
            >
              <Image src="/logo.png" alt="Logo" width={26} height={26} className="h-8 w-8 rounded-md" />
            </div>
            <div className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out ${collapsed ? "md:max-w-0 md:-translate-x-2 md:opacity-0" : "max-w-[150px] opacity-100"}`}>
              <h1
                className={`truncate text-[22px] small font-bold leading-none ${
                  darkMode ? "text-white" : "text-black"
                }`}
              >
                UIPL Docs
              </h1>
            </div>
            <button
              onClick={() => setMobileOpen?.(false)}
              className={`ml-auto flex h-10 w-10 items-center justify-center rounded-full md:hidden ${darkMode ? "hover:bg-white/5 text-white/70" : "hover:bg-black/5 text-black/60"}`}
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed?.(!collapsed)}
              className={`absolute -right-3.5 top-4 z-[60] hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-[background-color,color,transform] duration-300 hover:scale-105 md:flex ${darkMode ? "border-white/10 bg-[#17181c] text-white/65 hover:bg-[#22242a]" : "border-[#dfe4e8] bg-white text-slate-500 hover:bg-[#f3f6f8]"}`}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <div className={`relative newq overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${collapsed ? "md:mt-0 md:max-h-0 md:opacity-0" : "mt-4 max-h-10 opacity-100"}`}>
            <Search className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
            <input value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Global Search" className={`h-10 w-full rounded-xl border-0 pl-9 pr-3 text-sm outline-none ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35" : "bg-[#f1f4f8] text-slate-800 placeholder:text-slate-400"}`} />
          </div>
        </div>

        <nav ref={navRef} className={`flex-1 overflow-y-auto scroll-smooth px-3 py-2 transition-all duration-500 ${collapsed ? "md:px-0" : ""}`}>
          <p className={`overflow-hidden px-3 newq text-[9px] font-bold uppercase tracking-[0.14em] transition-[max-height,opacity,margin] duration-300 ${muted} ${collapsed ? "md:mb-0 md:max-h-0 md:opacity-0" : "mb-2 max-h-5 opacity-100"}`}>Workspace</p>
          <div className={`space-y-1 ${collapsed ? "md:flex md:flex-col md:items-center md:gap-1 md:space-y-0" : ""}`}>
          {filteredMenuItems.map((item) => {
            if (item.parent === "projects") return null;
            if (item.parent === "access-management") return null;
            if (item.id === "projects" && projectSubMenu.length) {
              const isOpen = Boolean(openGroups.projects);
              const childActive = projectSubMenu.some((child) => child.id === activeMenu);
              return (
                <div key="projects-group" className="transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((current) => ({ ...current, projects: !current.projects }))}
                    className={itemClass({ parentActive: childActive })}
                  >
                    <span className={iconClass({ parentActive: childActive })}>
                      <Building2 className="h-4.5 w-4.5" />
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] transition-[max-width,opacity] duration-300 ${collapsed ? "md:max-w-0 md:opacity-0" : "max-w-[140px] opacity-100"}`}>Projects</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${collapsed ? "md:w-0 md:opacity-0" : ""} ${isOpen ? "rotate-180" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
                  </button>

                  <div className={`grid transition-all duration-300 ease-out ${collapsed ? "md:grid-rows-[0fr] md:opacity-0" : isOpen || searchTerm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="relative ml-7 mt-1 space-y-1 pb-2 pl-5">
                        <span className={`absolute bottom-5 left-0 top-0 w-px rounded-full ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                        {(searchTerm ? filteredProjectSubMenu : projectSubMenu).map((child) => {
                          const ChildIcon = child.icon;
                          const active = activeMenu === child.id;
                          return (
                            <button
                              key={child.id}
                              data-sidebar-menu={child.id}
                              type="button"
                              onClick={() => setActiveMenu(child.id)}
                              className={itemClass({ active, child: true })}
                            >
                              <span className={`absolute left-0 h-px w-4 ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                              <span className={iconClass({ active, child: true })}>
                                <ChildIcon className="h-4 w-4" />
                              </span>
                              <span className="max-w-full truncate text-[13px]">{child.label}</span>
                              {child.id === "site-images" && newSiteImages && <span className="ml-auto flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/15" title="New site photos" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.id === "access-management" && accessSubMenu.length) {
              const isOpen = Boolean(openGroups.access);
              const childActive = accessSubMenu.some((child) => child.id === activeMenu);
              return (
                <div key="access-group" className="transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((current) => ({ ...current, access: !current.access }))}
                    className={itemClass({ parentActive: childActive })}
                  >
                    <span className={iconClass({ parentActive: childActive })}>
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] transition-[max-width,opacity] duration-300 ${collapsed ? "md:max-w-0 md:opacity-0" : "max-w-[140px] opacity-100"}`}>Access Control</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${collapsed ? "md:w-0 md:opacity-0" : ""} ${isOpen ? "rotate-180" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
                  </button>

                  <div className={`grid transition-all duration-300 ease-out ${collapsed ? "md:grid-rows-[0fr] md:opacity-0" : isOpen || searchTerm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="relative ml-7 mt-1 space-y-1 pb-2 pl-5">
                        <span className={`absolute bottom-5 left-0 top-0 w-px rounded-full ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                        {(searchTerm ? filteredAccessSubMenu : accessSubMenu).map((child) => {
                          const ChildIcon = child.icon;
                          const active = activeMenu === child.id;
                          return (
                            <button
                              key={child.id}
                              data-sidebar-menu={child.id}
                              type="button"
                              onClick={() => setActiveMenu(child.id)}
                              className={itemClass({ active, child: true })}
                            >
                              <span className={`absolute left-0 h-px w-4 ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                              <span className={iconClass({ active, child: true })}>
                                <ChildIcon className="h-4 w-4" />
                              </span>
                              <span className="max-w-full truncate text-[12px]">{child.label}</span>
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
                data-sidebar-menu={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={itemClass({ active: isActive })}
              >
                <span className={iconClass({ active: isActive })}>
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <span className={`overflow-hidden whitespace-nowrap text-[13px] transition-[max-width,opacity,transform] duration-300 ${collapsed ? "md:max-w-0 md:-translate-x-2 md:opacity-0" : "max-w-[160px] opacity-100"}`}>{item.label}</span>
              </button>
            );
          })}
          </div>
        </nav>

        <div ref={profileRef} className={`relative newq shrink-0 px-3 pb-4 pt-3 transition-all duration-500 ${collapsed ? "md:flex md:justify-center md:px-0" : ""}`}>
          <div
            className={`absolute bottom-[calc(100%+10px)] z-[70] origin-bottom rounded-[22px] p-2 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "md:left-2 md:w-56" : "left-3 right-3"} ${profileOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-95 opacity-0"} ${darkMode ? "bg-[#17181d] text-white ring-white/10" : "bg-white text-[#171714] ring-black/5"}`}
          >
            <div className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${darkMode ? "bg-white/[0.045]" : "bg-[#f5f7f2]"}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold leading-none ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#10a66b] text-white"}`}>{initials}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className={`mt-1 truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{user?.username || user?.roleName || "UIPL user"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className={`flex items-center gap-3 text-left   transition-all duration-300 hover:-translate-y-0.5 ${collapsed ? "md:mx-auto md:grid md:h-14 md:w-14 md:place-items-center md:gap-0 md:rounded-[20px] md:p-0" : "h-14 w-full rounded-[18px] px-3"} ${darkMode ? "bg-white/[0.045] text-white ring-white/10 hover:bg-white/[0.075]" : "bg-white text-[#171714] ring-black/5 hover:bg-[#f8fbf9]"}`}
            aria-expanded={profileOpen}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold leading-none ${collapsed ? "md:m-0 md:h-10 md:w-10 md:translate-y-[1px] md:text-sm" : ""} ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#10a66b] text-white"}`}>
              {initials}
            </span>
            <span className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ${collapsed ? "md:max-w-0 md:-translate-x-2 md:opacity-0" : "max-w-[145px] opacity-100"}`}>
              <span className="block truncate text-sm font-semibold">{displayName}</span>
              <span className={`block truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{user?.roleName || user?.username || "User"}</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${profileOpen ? "rotate-180" : ""} ${collapsed ? "md:w-0 md:opacity-0" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
          </button>
        </div>

      </aside>
    </>
  );
}
