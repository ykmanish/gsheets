import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, FileText, Workflow, ChartNoAxesCombined, Sheet, ShieldCheck, Activity, MessageCircleMore, X, ClipboardList, Building2, FileSpreadsheet, ChevronDown, CalendarCheck, Users, PanelLeftClose, PanelLeftOpen, Search, LogOut, Images, SlidersHorizontal, UserRound, BriefcaseBusiness, PackageSearch, CalendarDays, MapPin, ListTodo, MessagesSquare, CircleDollarSign, UserRoundSearch } from "lucide-react";
import Image from "next/image";
import { API_URL } from "./AuthProvider";
import UserAvatar from "./UserAvatar";

const ACCENT = "#2563eb";
const ACCENT_DARK_TEXT = "#93c5fd";

export default function Sidebar({ activeMenu, setActiveMenu, darkMode, allowedMenus = [], mobileOpen = false, setMobileOpen, collapsed = false, setCollapsed, user, onLogout, onOpenSearch }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText },
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

  const shell = darkMode
    ? "border-white/10 bg-[#101114]"
    : "border-[#e7eaee] bg-white";
  const muted = darkMode ? "text-white/38" : "text-slate-400";
  const displayName = user?.displayName || user?.username || "User";

  function openProfileModal() {
    setActiveMenu("profile");
    setProfileOpen(false);
  }

  // Top-level leaf items (no children): active state is the same light-blue tint used for
  // active/hovered sub-module rows — no solid fill — for one consistent visual language
  // across the whole sidebar, in both themes.
  const leafItemClass = ({ active = false } = {}) => `newq group flex h-11 items-center gap-3 rounded-2xl text-left font-medium transition-all duration-300 ${collapsed ? "md:mx-auto md:h-12 md:w-12 md:justify-center md:gap-0 md:rounded-2xl md:p-0" : "w-full px-3"} ${
    active
      ? darkMode ? "bg-[#2563eb]/20 text-[#93c5fd] font-semibold" : "bg-[#2563eb]/10 text-[#2563eb] font-semibold"
      : darkMode
      ? "text-white/60 hover:bg-[#2563eb]/15 hover:text-[#93c5fd]"
      : "text-slate-600 hover:bg-[#2563eb]/8 hover:text-[#2563eb]"
  }`;

  const leafIconClass = ({ active = false } = {}) => `flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${collapsed ? "md:h-10 md:w-10" : ""} ${
    active
      ? darkMode ? "bg-[#2563eb]/30 text-[#93c5fd]" : "bg-[#2563eb]/15 text-[#2563eb]"
      : darkMode ? "text-white/55 group-hover:text-[#93c5fd]" : "text-slate-500 group-hover:text-[#2563eb]"
  }`;

  // Group headers (Projects / HR / Access Control) are plain, bold rows — never a solid pill
  // like a top-level active item — but they DO get the same light-blue tint when one of their
  // children is the current page (parentActive) or on hover, so the collapsed icon-only rail
  // still shows which section you're in even without the label visible.
  const groupHeaderClass = ({ parentActive = false } = {}) => `newq group flex h-11 w-full items-center gap-3 rounded-2xl text-left font-semibold transition-all duration-300 ${collapsed ? "md:mx-auto md:h-12 md:w-12 md:justify-center md:gap-0 md:rounded-2xl md:p-0" : "px-3"} ${
    parentActive
      ? darkMode ? "bg-[#2563eb]/20" : "bg-[#2563eb]/12"
      : darkMode ? "text-white/90 hover:bg-[#2563eb]/15 hover:text-[#93c5fd]" : "text-slate-800 hover:bg-[#2563eb]/8 hover:text-[#2563eb]"
  }`;

  const groupHeaderIconClass = ({ parentActive = false } = {}) => `flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${collapsed ? "md:h-10 md:w-10" : ""} ${
    parentActive
      ? darkMode ? "bg-[#2563eb]/25" : "bg-white"
      : darkMode ? "text-white/75 group-hover:text-[#93c5fd]" : "text-slate-600 group-hover:text-[#2563eb]"
  }`;

  const childItemClass = ({ active = false } = {}) => `newq group relative flex h-9 items-center gap-2.5 rounded-xl px-3 text-left transition-all duration-200 w-full ${
    active
      ? darkMode ? "bg-[#2563eb]/20 font-semibold" : "bg-[#2563eb]/10 font-semibold"
      : darkMode ? "font-normal text-white/55 hover:bg-[#2563eb]/15 hover:text-[#93c5fd]" : "font-normal text-slate-500 hover:bg-[#2563eb]/8 hover:text-[#2563eb]"
  }`;

  const childIconClass = ({ active = false } = {}) => `flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg ${
    active ? (darkMode ? "bg-[#2563eb]/30" : "bg-[#2563eb]/15") : darkMode ? "text-white/40 group-hover:text-[#93c5fd]" : "text-slate-400 group-hover:text-[#2563eb]"
  }`;

  function renderGroup({ groupKey, label, GroupIcon, allChildren, filtered }) {
    if (!allChildren.length) return null;
    const isOpen = Boolean(openGroups[groupKey]);
    const list = searchTerm ? filtered : allChildren;
    // Highlight the parent group whenever one of its children is the active page — matters
    // most on the collapsed icon-only rail, where the label is hidden and the icon tint is
    // the only cue for "your current page lives in this section".
    const childActive = allChildren.some((child) => child.id === activeMenu);
    const parentTint = childActive ? { color: darkMode ? ACCENT_DARK_TEXT : ACCENT } : undefined;

    return (
      <div key={`${groupKey}-group`} className="transition-all duration-300">
        <button
          type="button"
          onClick={() => {
            if (collapsed) return;
            // Accordion behavior: opening one group closes any other open group instead of
            // stacking them all expanded at once.
            setOpenGroups((current) => (current[groupKey] ? { ...current, [groupKey]: false } : { projects: false, hr: false, access: false, finance: false, [groupKey]: true }));
          }}
          onMouseEnter={(event) => openFlyout(groupKey, event.currentTarget, label, GroupIcon, list)}
          onMouseLeave={scheduleCloseFlyout}
          className={groupHeaderClass({ parentActive: childActive })}
          title={collapsed ? label : undefined}
        >
          <span className={groupHeaderIconClass({ parentActive: childActive })}>
            <GroupIcon className="h-4.5 w-4.5" style={parentTint} />
          </span>
          <span className={`min-w-0 flex-1 truncate text-[13px] transition-[max-width,opacity] duration-300 ${collapsed ? "md:max-w-0 md:opacity-0" : "max-w-[140px] opacity-100"}`} style={parentTint}>{label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${collapsed ? "md:w-0 md:opacity-0" : ""} ${isOpen ? "rotate-180" : ""} ${darkMode ? "text-white/40" : "text-black/35"}`} />
        </button>

        <div className={`grid transition-all duration-300 ease-out ${collapsed ? "md:grid-rows-[0fr] md:opacity-0" : isOpen || searchTerm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="relative ml-6 mt-1 space-y-0.5 pb-2 pl-4">
              <span className={`absolute bottom-4 left-0 top-0 w-px rounded-full ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
              {list.map((child) => {
                const ChildIcon = child.icon;
                const active = activeMenu === child.id;
                return (
                  <button
                    key={child.id}
                    data-sidebar-menu={child.id}
                    type="button"
                    onClick={() => setActiveMenu(child.id)}
                    className={childItemClass({ active })}
                  >
                    <span className={`absolute -left-4 h-px w-4 ${darkMode ? "bg-white/10" : "bg-black/10"}`} />
                    <span className={childIconClass({ active })}>
                      <ChildIcon className="h-3.5 w-3.5" style={active ? { color: ACCENT } : undefined} />
                    </span>
                    <span className="max-w-full truncate text-[13px]" style={active ? { color: darkMode ? ACCENT_DARK_TEXT : ACCENT } : undefined}>{child.label}</span>
                    {child.id === "site-images" && newSiteImages && <span className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/15" title="New site photos" />}
                  </button>
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
              onClick={() => {
                setCollapsed?.(!collapsed);
                setFlyout(null);
              }}
              className={`absolute -right-3.5 top-4 z-[60] hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-[background-color,color,transform] duration-300 hover:scale-105 md:flex ${darkMode ? "border-white/10 bg-[#17181c] text-white/65 hover:bg-[#22242a]" : "border-[#dfe4e8] bg-white text-slate-500 hover:bg-[#f3f6f8]"}`}
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
              className={`h-10 w-full rounded-xl border-0 pl-9 pr-16 text-sm outline-none ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35" : "bg-[#f1f4f8] text-slate-800 placeholder:text-slate-400"}`}
            />
            <kbd className={`pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:block ${darkMode ? "border-white/10 text-white/35" : "border-slate-200 text-slate-400"}`}>Ctrl K</kbd>
          </div>
        </div>

        <nav ref={navRef} className={`flex-1 overflow-y-auto scroll-smooth px-3 py-2 transition-all duration-500 ${collapsed ? "md:px-0" : ""}`}>
          <p className={`overflow-hidden px-3 newq text-[9px] font-bold uppercase tracking-[0.14em] transition-[max-height,opacity,margin] duration-300 ${muted} ${collapsed ? "md:mb-0 md:max-h-0 md:opacity-0" : "mb-2 max-h-5 opacity-100"}`}>Workspace</p>
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
              <button
                key={item.id}
                data-sidebar-menu={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={leafItemClass({ active: isActive })}
                title={collapsed ? item.label : undefined}
              >
                <span className={leafIconClass({ active: isActive })}>
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
              <UserAvatar user={user} name={displayName} className="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className={`mt-1 truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{user?.username || user?.roleName || "UIPL user"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openProfileModal}
              className={`mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "text-white/80 hover:bg-white/10" : "text-slate-700 hover:bg-[#f3f8f5]"}`}
            >
              <UserRound className="h-4 w-4" />
              View profile
            </button>
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
            className={`flex items-center gap-3 text-left   transition-all duration-300 hover:-translate-y-0.5 ${collapsed ? "md:mx-auto md:grid md:h-14 md:w-14 md:place-items-center md:gap-0 md:rounded-[20px] md:p-0" : "h-14 w-full rounded-[18px] px-3"} ${darkMode ? "bg-white/[0.075] text-white ring-white/10" : "bg-[#f8fbf9] text-[#171714] ring-black/5"}`}
            aria-expanded={profileOpen}
          >
            <UserAvatar user={user} name={displayName} className={`h-9 w-9 ${collapsed ? "md:m-0 md:h-10 md:w-10 md:translate-y-[1px]" : ""}`} />
            <span className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ${collapsed ? "md:max-w-0 md:-translate-x-2 md:opacity-0" : "max-w-[145px] opacity-100"}`}>
              <span className="block truncate text-sm font-semibold">{displayName}</span>
              <span className={`block truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{user?.roleName || user?.username || "User"}</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-[transform,opacity,width] duration-300 ${profileOpen ? "rotate-180" : ""} ${collapsed ? "md:w-0 md:opacity-0" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
          </button>
        </div>

      </aside>

      {flyout && (
        <div
          className={`fixed z-[80] w-56 rounded-2xl p-2 shadow-[0_24px_60px_rgba(15,23,42,0.28)] ring-1 ${darkMode ? "bg-[#17181d] text-white ring-white/10" : "bg-white text-[#171714] ring-black/5"}`}
          style={{ top: Math.max(8, flyout.top), left: flyout.left }}
          onMouseEnter={cancelCloseFlyout}
          onMouseLeave={scheduleCloseFlyout}
        >
          <div className={`mb-1 flex items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase tracking-wide ${darkMode ? "text-white/50" : "text-slate-400"}`}>
            <flyout.GroupIcon className="h-3.5 w-3.5" />
            {flyout.label}
          </div>
          <div className="space-y-0.5">
            {flyout.children.map((child) => {
              const ChildIcon = child.icon;
              const active = activeMenu === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setActiveMenu(child.id);
                    setFlyout(null);
                  }}
                  className={childItemClass({ active })}
                >
                  <span className={childIconClass({ active })}>
                    <ChildIcon className="h-3.5 w-3.5" style={active ? { color: ACCENT } : undefined} />
                  </span>
                  <span className="max-w-full truncate text-[13px]" style={active ? { color: darkMode ? ACCENT_DARK_TEXT : ACCENT } : undefined}>{child.label}</span>
                  {child.id === "site-images" && newSiteImages && <span className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/15" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
