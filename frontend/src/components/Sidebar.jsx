import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, FileText, Workflow, ChartNoAxesCombined, Sheet, ShieldCheck, Activity, MessageCircleMore, X, ClipboardList, Building2, FileSpreadsheet, ChevronDown, CalendarCheck, Users, PanelLeftClose, PanelLeftOpen, Search, LogOut, Images, SlidersHorizontal, UserRound, BriefcaseBusiness, PackageSearch, CalendarDays, MapPin, ListTodo, MessagesSquare, FolderLock, CircleDollarSign, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { API_URL, fetchJsonShared } from "./AuthProvider";
import UserAvatar from "./UserAvatar";
import { menuPaths, preloadModule } from "./appModules";
import SlackLogo from "./SlackLogo";
import BrandMark from "./BrandMark";

const GROUP_CHILDREN = {
  projects: ["projects", "project-dmr", "project-mrn", "project-prn", "project-stock", "site-images"],
  hr: ["hr-dashboard", "hr-employees", "hr-leave", "hr-attendance", "hr-recruitment"],
  finance: ["accounts", "accounts-forms"],
  access: ["manage-roles", "manage-users", "module-control"],
};
const CLOSED_GROUPS = { projects: false, hr: false, access: false, finance: false };
const groupOf = (menuId) => Object.keys(GROUP_CHILDREN).find((group) => GROUP_CHILDREN[group].includes(menuId));

export default function Sidebar({ activeMenu, setActiveMenu, darkMode, allowedMenus = [], mobileOpen = false, setMobileOpen, collapsed = false, setCollapsed, user, onLogout, onOpenSearch }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "department-documents", label: "Department Documents", icon: FolderLock },
    { id: "forms", label: "Forms", icon: ClipboardList },
    { id: "projects", label: "Project Control", icon: Building2 },
    { id: "project-dmr", label: "DMR", icon: FileSpreadsheet, parent: "projects" },
    { id: "project-mrn", label: "MRN", icon: ClipboardList, parent: "projects" },
    { id: "project-prn", label: "PRN", icon: CircleDollarSign, parent: "projects" },
    { id: "project-stock", label: "Stock", icon: PackageSearch, parent: "projects" },
    { id: "site-images", label: "Site Images", icon: Images, parent: "projects" },
    { id: "hr-dashboard", label: "HR", icon: BriefcaseBusiness },
    { id: "hr-employees", label: "Employees", icon: Users, parent: "hr" },
    { id: "hr-leave", label: "Leave", icon: CalendarDays, parent: "hr" },
    { id: "hr-attendance", label: "Attendance", icon: MapPin, parent: "hr" },
    { id: "hr-recruitment", label: "Recruitment", icon: UserRoundSearch, parent: "hr" },
    { id: "slack", label: "Slack", icon: SlackLogo },
    { id: "todos", label: "Todos", icon: ListTodo },
    // { id: "forum", label: "Loop", icon: MessagesSquare },
    { id: "sheet-dashboard", label: "Sheet Dashboard", icon: Sheet },
    { id: "automations", label: "Automation", icon: Workflow },
    { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
    { id: "finance", label: "Finance", icon: CircleDollarSign },
    { id: "accounts", label: "Accounts", icon: FileSpreadsheet, parent: "finance" },
    { id: "accounts-forms", label: "Forms", icon: ClipboardList, parent: "finance" },
    { id: "employee-daily-report", label: "Employee Daily Report", icon: CalendarCheck },
    { id: "activity-log", label: "Activity Log", icon: Activity },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircleMore },
    { id: "access-management", label: "Access Control", icon: ShieldCheck },
    { id: "manage-roles", label: "Manage Role", icon: ShieldCheck, parent: "access-management" },
    { id: "manage-users", label: "Manage User", icon: Users, parent: "access-management" },
    { id: "module-control", label: "Module Control", icon: SlidersHorizontal, parent: "access-management" },
  ];
  const projectSubMenu = menuItems.filter((item) => ["projects", "project-dmr", "project-mrn", "project-prn", "project-stock", "site-images"].includes(item.id) && allowedMenus.includes(item.id));
  const hrSubMenu = menuItems.filter((item) => ["hr-dashboard", "hr-employees", "hr-leave", "hr-attendance", "hr-recruitment"].includes(item.id) && allowedMenus.includes(item.id));
  const financeSubMenu = menuItems.filter((item) => item.parent === "finance" && allowedMenus.includes(item.id));
  const accessSubMenu = menuItems.filter((item) => item.parent === "access-management" && allowedMenus.includes(item.id));
  const visibleMenuItems = menuItems.filter((item) => allowedMenus.includes(item.id) || (item.id === "hr-dashboard" && hrSubMenu.length) || (item.id === "projects" && projectSubMenu.length) || (item.id === "access-management" && accessSubMenu.length) || (item.id === "finance" && financeSubMenu.length));
  const [openGroups, setOpenGroups] = useState(() => ({
    projects: projectSubMenu.some((item) => item.id === activeMenu),
    hr: hrSubMenu.some((item) => item.id === activeMenu),
    access: accessSubMenu.some((item) => item.id === activeMenu),
    finance: financeSubMenu.some((item) => item.id === activeMenu),
  }));
  // The sidebar stays mounted across pages, so when a page inside a closed group is reached
  // some other way (search, a notification, a link), open that group to show where you are.
  const [lastActiveMenu, setLastActiveMenu] = useState(activeMenu);
  if (activeMenu !== lastActiveMenu) {
    setLastActiveMenu(activeMenu);
    const group = groupOf(activeMenu);
    if (group && !openGroups[group]) setOpenGroups({ ...CLOSED_GROUPS, [group]: true });
  }
  const [menuSearch, setMenuSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [newSiteImages, setNewSiteImages] = useState(false);
  const [flyout, setFlyout] = useState(null);
  const navRef = useRef(null);
  const profileRef = useRef(null);
  const flyoutHideTimerRef = useRef(null);
  const searchTerm = menuSearch.trim().toLowerCase();
  const filteredProjectSubMenu = projectSubMenu.filter((item) => !searchTerm || item.label.toLowerCase().includes(searchTerm));
  const filteredHrSubMenu = hrSubMenu.filter((item) => !searchTerm || item.label.toLowerCase().includes(searchTerm));
  const filteredAccessSubMenu = accessSubMenu.filter((item) => !searchTerm || item.label.toLowerCase().includes(searchTerm));
  const filteredFinanceSubMenu = financeSubMenu.filter((item) => !searchTerm || item.label.toLowerCase().includes(searchTerm));
  const filteredMenuItems = visibleMenuItems.filter((item) => {
    if (!searchTerm) return true;
    if (item.label.toLowerCase().includes(searchTerm)) return true;
    if (item.id === "projects") return filteredProjectSubMenu.length > 0;
    if (item.id === "hr-dashboard") return filteredHrSubMenu.length > 0;
    if (item.id === "access-management") return filteredAccessSubMenu.length > 0;
    if (item.id === "finance") return filteredFinanceSubMenu.length > 0;
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
        // Both reads are shared and reused for a minute: this re-runs on every page
        // change, the Documents page reads the same list, and the sheet download is large.
        const { data: docsData } = await fetchJsonShared(`${API_URL}/documents`, { maxAgeMs: 60000 });
        const doc = (docsData?.documents || []).find((item) => item.type === "sheet" && /site\s*daily\s*report/i.test(item.name));
        if (!doc || stopped) return;
        const { ok, data } = await fetchJsonShared(`${API_URL}/sheets/${doc.id}/data`, { maxAgeMs: 60000 });
        if (!ok || !data || stopped) return;
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
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [activeMenu, user?.id]);

  // The collapsed icon-only rail hides sidebar groups' children entirely (no room to show
  // them). Expanding the sidebar isn't the only way to reach them — hovering a group's icon
  // pops a flyout card with its children, positioned via viewport coordinates (not relative to
  // the scrollable nav, which would otherwise clip anything past its right edge). The flyout
  // only makes sense while collapsed, so it's cleared right in the collapse toggle below
  // rather than reacted to via an effect.
  function openFlyout(groupId, targetEl, label, GroupIcon, children) {
    if (!collapsed || !children.length) return;
    if (flyoutHideTimerRef.current) {
      window.clearTimeout(flyoutHideTimerRef.current);
      flyoutHideTimerRef.current = null;
    }
    const rect = targetEl.getBoundingClientRect();
    setFlyout({ id: groupId, top: rect.top, left: rect.right + 10, label, GroupIcon, children });
  }

  function scheduleCloseFlyout() {
    flyoutHideTimerRef.current = window.setTimeout(() => setFlyout(null), 180);
  }

  function cancelCloseFlyout() {
    if (flyoutHideTimerRef.current) {
      window.clearTimeout(flyoutHideTimerRef.current);
      flyoutHideTimerRef.current = null;
    }
  }

  const shell = darkMode ? "bg-[#0b0c0f]" : "bg-[#f5f5f3]";
  const muted = darkMode ? "text-white/38" : "text-[#a8a8a5]";
  const displayName = user?.displayName || user?.username || "User";

  function openProfileModal() {
    setActiveMenu("profile");
    setProfileOpen(false);
  }

  // Rows after the Chax reference: quiet grey text, a soft hover, and a black pill for the
  // current page (lime in dark mode). The same pill marks a collapsed group whose page is open.
  const activeRow = darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white";
  const idleRow = darkMode ? "text-white/60 hover:bg-white/[0.06] hover:text-white" : "text-[#5f5f5c] hover:bg-black/[0.045] hover:text-[#141414]";

  const leafItemClass = ({ active = false } = {}) => `newq group relative flex h-9 items-center gap-2.5 rounded-full text-left text-[13.5px] transition-[background-color,color,box-shadow] duration-150 ${collapsed ? "md:mx-auto md:h-10 md:w-10 md:justify-center md:gap-0 md:p-0" : "w-full px-3"} ${active ? activeRow : idleRow}`;

  const leafIconClass = ({ active = false } = {}) => `relative z-10 flex h-5 w-5 shrink-0 items-center justify-center ${
    active ? "text-current" : darkMode ? "text-white/50 group-hover:text-white/80" : "text-[#8a8a87] group-hover:text-[#3d3d3b]"
  }`;

  const groupHeaderClass = ({ parentActive = false } = {}) => `newq group relative flex h-9 w-full items-center gap-2.5 rounded-full text-left text-[13.5px] transition-[background-color,color,box-shadow] duration-150 ${collapsed ? "md:mx-auto md:h-10 md:w-10 md:justify-center md:gap-0 md:p-0" : "px-3"} ${
    parentActive ? (collapsed ? activeRow : darkMode ? "text-white" : "text-[#141414]") : idleRow
  }`;

  const groupHeaderIconClass = ({ parentActive = false } = {}) => `relative z-10 flex h-5 w-5 shrink-0 items-center justify-center ${
    parentActive ? (collapsed ? "text-current" : darkMode ? "text-white" : "text-[#141414]") : darkMode ? "text-white/50 group-hover:text-white/80" : "text-[#8a8a87] group-hover:text-[#3d3d3b]"
  }`;

  const childItemClass = ({ active = false } = {}) => `newq group relative flex h-8 w-full items-center gap-2 rounded-full px-3 text-left text-[13px] transition-[background-color,color,box-shadow] duration-150 ${
    active ? activeRow : darkMode ? "text-white/55 hover:bg-white/[0.06] hover:text-white" : "text-[#6b6b69] hover:bg-black/[0.045] hover:text-[#141414]"
  }`;

  const childIconClass = ({ active = false } = {}) => `relative z-10 flex h-4 w-4 shrink-0 items-center justify-center ${
    active ? "text-current" : darkMode ? "text-white/40" : "text-[#a3a3a0] group-hover:text-[#5f5f5c]"
  }`;

  // Kept as a no-op so the render code below stays the same: the pill is the row's own style now.
  const activePill = () => null;
  const linkProps = (menuId) => ({
    href: menuPaths[menuId] || "/dashboard",
    onClick: () => setMobileOpen?.(false),
    onMouseEnter: () => void preloadModule(menuId),
    onFocus: () => void preloadModule(menuId),
    onTouchStart: () => void preloadModule(menuId),
  });

  function renderGroup({ groupKey, label, GroupIcon, allChildren, filtered }) {
    if (!allChildren.length) return null;
    const isOpen = Boolean(openGroups[groupKey]);
    const list = searchTerm ? filtered : allChildren;
    // Highlight the parent group whenever one of its children is the active page — matters
    // most on the collapsed icon-only rail, where the label is hidden and the icon tint is
    // the only cue for "your current page lives in this section".
    const childActive = allChildren.some((child) => child.id === activeMenu);
    const parentTint = undefined;

    return (
      <div key={`${groupKey}-group`} className="transition-all duration-300">
        <button
          type="button"
          onClick={() => {
            if (collapsed) return;
            // Accordion behavior: opening one group closes any other open group instead of
            // stacking them all expanded at once.
            setOpenGroups((current) => (current[groupKey] ? { ...current, [groupKey]: false } : { ...CLOSED_GROUPS, [groupKey]: true }));
          }}
          onMouseEnter={(event) => openFlyout(groupKey, event.currentTarget, label, GroupIcon, list)}
          onMouseLeave={scheduleCloseFlyout}
          className={groupHeaderClass({ parentActive: childActive })}
          title={collapsed ? label : undefined}
        >
          {childActive && activePill("sidebar-pill")}
          <span className={groupHeaderIconClass({ parentActive: childActive })}>
            <GroupIcon className="h-[17px] w-[17px]" style={parentTint} />
          </span>
          <span className={`relative z-10 min-w-0 flex-1 truncate text-[13px] transition-[max-width,opacity] duration-300 ${collapsed ? "md:max-w-0 md:opacity-0" : "max-w-[140px] opacity-100"}`} style={parentTint}>{label}</span>
          <ChevronDown className={`relative z-10 h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${collapsed ? "md:w-0 md:opacity-0" : ""} ${isOpen ? "rotate-180" : ""} ${darkMode ? "text-white/40" : "text-black/35"}`} />
        </button>

        <div className={`grid transition-all duration-300 ease-out ${collapsed ? "md:grid-rows-[0fr] md:opacity-0" : isOpen || searchTerm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="relative ml-[18px] mt-0.5 space-y-0.5 pb-1.5 pl-3">
              <span className={`absolute bottom-3 left-0 top-1 w-px rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.08]"}`} />
              {list.map((child) => {
                const ChildIcon = child.icon;
                const active = activeMenu === child.id;
                return (
                  <Link
                    key={child.id}
                    data-sidebar-menu={child.id}
                    {...linkProps(child.id)}
                    aria-current={active ? "page" : undefined}
                    className={childItemClass({ active })}
                  >
                    {active && activePill(`sidebar-pill-${groupKey}`, "rounded-xl")}
                                        <span className={childIconClass({ active })}>
                      <ChildIcon className="h-[15px] w-[15px]" />
                    </span>
                    <span className="relative z-10 max-w-full truncate text-[13px]">{child.label}</span>
                    {child.id === "site-images" && newSiteImages && <span className="relative z-10 ml-auto flex h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/15" title="New site photos" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen?.(false)}
      />
      <aside
        className={`app-sidebar newq fixed inset-y-0 left-0 z-50 flex w-[248px] transform flex-col dark:border-r lg:border-r-0 md:static md:z-auto md:h-screen md:translate-x-0 ${collapsed ? "app-sidebar-collapsed" : ""} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${shell}`}
      >
        <div className={`relative px-3 pb-1 pt-4 transition-all duration-300 ${collapsed ? "md:px-2" : ""}`}>
          <div className={`flex items-center gap-2.5 px-1.5 ${collapsed ? "md:flex-col md:gap-3 md:px-0" : ""}`}>
            <BrandMark darkMode={darkMode} size={36} />
            <span className={`force-bold small min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[17px] tracking-[-0.02em] transition-[max-width,opacity] duration-300 ${collapsed ? "md:max-w-0 md:flex-none md:opacity-0" : "max-w-[150px] opacity-100"} ${darkMode ? "text-white" : "text-[#171717]"}`}>
              UIPL Docs
            </span>
            <button
              onClick={() => setMobileOpen?.(false)}
              className={`grid h-8 w-8 place-items-center rounded-[9px] md:hidden ${darkMode ? "text-white/70 hover:bg-white/10" : "text-[#5f5f5c] hover:bg-black/5"}`}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCollapsed?.(!collapsed);
                setFlyout(null);
              }}
              className={`hidden h-8 w-8 shrink-0 place-items-center rounded-[9px] transition-colors md:grid ${darkMode ? "text-white/55 hover:bg-white/10" : "text-[#7a7a77] hover:bg-black/[0.05] hover:text-[#171717]"}`}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <div className={`relative newq overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${collapsed ? "md:mt-0 md:max-h-0 md:opacity-0" : "mt-4 max-h-10 opacity-100"}`}>
            <Search className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
            <input
              value={menuSearch}
              onFocus={() => onOpenSearch?.()}
              onChange={(event) => setMenuSearch(event.target.value)}
              placeholder="Global Search"
              className={`h-10 w-full rounded-full border pl-9 pr-16 text-[13px] outline-none transition-shadow focus:ring-[3px] ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-white/10" : "border-[#ececec] bg-white text-[#141414] placeholder:text-[#a8a8a5] focus:ring-black/[0.05]"}`}
            />
            <kbd className={`pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] sm:block ${darkMode ? "border-white/10 text-white/35" : "border-[#ececec] text-[#a8a8a5]"}`}>Ctrl K</kbd>
          </div>
        </div>

        <nav ref={navRef} className={`flex-1 overflow-y-auto scroll-smooth px-3 py-2 transition-all duration-500 ${collapsed ? "md:px-0" : ""}`}>
          <p className={`overflow-hidden px-3 newq text-[11.5px] transition-[max-height,opacity,margin] duration-300 ${muted} ${collapsed ? "md:mb-0 md:max-h-0 md:opacity-0" : "mb-2 max-h-5 opacity-100"}`}>Workspace</p>
          <div className={`space-y-1 ${collapsed ? "md:flex md:flex-col md:items-center md:gap-2 md:space-y-0" : ""}`}>
          {filteredMenuItems.map((item) => {
            if (item.parent === "projects") return null;
            if (item.parent === "hr") return null;
            if (item.parent === "access-management") return null;
            if (item.parent === "finance") return null;

            if (item.id === "projects" && projectSubMenu.length) {
              return renderGroup({ groupKey: "projects", label: "Projects", GroupIcon: Building2, allChildren: projectSubMenu, filtered: filteredProjectSubMenu });
            }
            if (item.id === "hr-dashboard" && hrSubMenu.length) {
              return renderGroup({ groupKey: "hr", label: "HR", GroupIcon: BriefcaseBusiness, allChildren: hrSubMenu, filtered: filteredHrSubMenu });
            }
            if (item.id === "finance" && financeSubMenu.length) {
              return renderGroup({ groupKey: "finance", label: "Finance", GroupIcon: CircleDollarSign, allChildren: financeSubMenu, filtered: filteredFinanceSubMenu });
            }
            if (item.id === "access-management" && accessSubMenu.length) {
              return renderGroup({ groupKey: "access", label: "Access Control", GroupIcon: ShieldCheck, allChildren: accessSubMenu, filtered: filteredAccessSubMenu });
            }

            const Icon = item.icon;
            const isActive = activeMenu === item.id;

            return (
              <Link
                key={item.id}
                data-sidebar-menu={item.id}
                {...linkProps(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={leafItemClass({ active: isActive })}
                title={collapsed ? item.label : undefined}
              >
                {isActive && activePill("sidebar-pill")}
                <span className={leafIconClass({ active: isActive })}>
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className={`relative z-10 overflow-hidden whitespace-nowrap text-[13px] transition-[max-width,opacity,transform] duration-300 ${collapsed ? "md:max-w-0 md:-translate-x-2 md:opacity-0" : "max-w-[160px] opacity-100"}`}>{item.label}</span>
              </Link>
            );
          })}
          </div>
        </nav>

        <div ref={profileRef} className={`relative newq shrink-0 px-3 pb-4 pt-3 transition-all duration-500 ${collapsed ? "md:flex md:justify-center md:px-0" : ""}`}>
          <div
            className={`absolute bottom-[calc(100%+10px)] z-[70] origin-bottom rounded-[22px] p-2 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "md:left-2 md:w-56" : "left-3 right-3"} ${profileOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-95 opacity-0"} ${darkMode ? "bg-[#17181d] text-white ring-white/10" : "bg-white text-[#141414] ring-[#ececec]"}`}
          >
            <div className={`flex items-center gap-3 rounded-[16px] px-3 py-3 ${darkMode ? "bg-white/[0.045]" : "bg-[#f4f4f2]"}`}>
              <UserAvatar user={user} name={displayName} className="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate text-sm">{displayName}</p>
                <p className={`mt-1 truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{user?.username || user?.roleName || "UIPL user"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openProfileModal}
              className={`mt-2 flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-left text-sm transition ${darkMode ? "text-white/80 hover:bg-white/10" : "text-[#3d3d3b] hover:bg-[#f4f4f2]"}`}
            >
              <UserRound className="h-4 w-4" />
              View profile
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-left text-sm text-[#c0394b] transition hover:bg-[#fbe4e6]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className={`flex items-center gap-2.5 text-left transition-colors duration-150 ${collapsed ? "md:mx-auto md:grid md:h-11 md:w-11 md:place-items-center md:gap-0 md:rounded-[12px] md:p-0" : "h-12 w-full rounded-full px-2"} ${darkMode ? "text-white hover:bg-white/[0.06]" : "text-[#141414] hover:bg-black/[0.045]"}`}
            aria-expanded={profileOpen}
          >
            <UserAvatar user={user} name={displayName} className={`h-8 w-8 ${collapsed ? "md:m-0 md:h-9 md:w-9" : ""}`} />
            <span className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ${collapsed ? "md:max-w-0 md:-translate-x-2 md:opacity-0" : "max-w-[145px] opacity-100"}`}>
              <span className="block truncate text-[13px]">{displayName}</span>
              <span className={`block truncate text-[11.5px] ${darkMode ? "text-white/45" : "text-[#8a8a87]"}`}>{user?.email || user?.username || user?.roleName || "User"}</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${profileOpen ? "rotate-180" : ""} ${collapsed ? "md:w-0 md:opacity-0" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
          </button>
        </div>

      </aside>

      {flyout && (
        <div
          className={`newq fixed z-[80] w-56 rounded-[18px] p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ${darkMode ? "bg-[#17181d] text-white ring-white/10" : "bg-white text-[#141414] ring-[#ececec]"}`}
          style={{ top: Math.max(8, flyout.top), left: flyout.left }}
          onMouseEnter={cancelCloseFlyout}
          onMouseLeave={scheduleCloseFlyout}
        >
          <div className={`mb-1 flex items-center gap-2 px-2 py-1.5 text-xs ${darkMode ? "text-white/50" : "text-[#a3a3a0]"}`}>
            <flyout.GroupIcon className="h-3.5 w-3.5" />
            {flyout.label}
          </div>
          <div className="space-y-0.5">
            {flyout.children.map((child) => {
              const ChildIcon = child.icon;
              const active = activeMenu === child.id;
              return (
                <Link
                  key={child.id}
                  {...linkProps(child.id)}
                  onClick={() => setFlyout(null)}
                  aria-current={active ? "page" : undefined}
                  className={childItemClass({ active })}
                >
                  <span className={childIconClass({ active })}>
                    <ChildIcon className="h-[15px] w-[15px]" />
                  </span>
                  <span className="max-w-full truncate text-[13px]">{child.label}</span>
                  {child.id === "site-images" && newSiteImages && <span className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/15" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
