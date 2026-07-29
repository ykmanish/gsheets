"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ClipboardList, FileSpreadsheet, FileText, Images, LayoutDashboard, ListTodo, MessageCircleMore, MessagesSquare, PackageSearch, Search, ShieldCheck, SlidersHorizontal, UserRound, Users, Workflow, X, ChartNoAxesCombined, Sheet } from "lucide-react";

const COMMAND_ITEMS = [
  { id: "dashboard", label: "Dashboard", description: "Overview, documents, activity, and workspace status", group: "Workspace", keywords: ["home", "overview"], icon: LayoutDashboard },
  { id: "documents", label: "Documents", description: "Browse, upload, search, and manage documents", group: "Workspace", keywords: ["files", "drive"], icon: FileText },
  { id: "forms", label: "Forms", description: "Create and submit internal requests", group: "Workspace", keywords: ["requests"], icon: ClipboardList },
  { id: "projects", label: "Project Control", description: "Project dashboard, tasks, phases, and files", group: "Projects", keywords: ["project", "control"], icon: Building2 },
  { id: "project-dmr", label: "DMR", description: "Daily manpower and site progress reports", group: "Projects", parent: "Project Control", keywords: ["daily", "manpower"], icon: FileSpreadsheet },
  { id: "project-mrn", label: "MRN", description: "Material request notes and procurement records", group: "Projects", parent: "Project Control", keywords: ["material", "request"], icon: ClipboardList },
  { id: "project-stock", label: "Stock", description: "Project stock and inventory sheets", group: "Projects", parent: "Project Control", keywords: ["inventory"], icon: PackageSearch },
  { id: "site-images", label: "Site Images", description: "View site report photos and image updates", group: "Projects", parent: "Project Control", keywords: ["photos", "pictures"], icon: Images },
  { id: "hr-dashboard", label: "HR", description: "HR dashboard and employee operations", group: "HR", keywords: ["human resource"], icon: BriefcaseBusiness },
  { id: "hr-employees", label: "Employees", description: "Employee profiles, HR setup, and documents", group: "HR", parent: "HR", keywords: ["staff", "team"], icon: Users },
  { id: "hr-leave", label: "Leave", description: "Manage and track employee leave requests", group: "HR", parent: "HR", keywords: ["leaves", "holiday"], icon: CalendarDays },
  { id: "hr-attendance", label: "Attendance", description: "Clock-in records, locations, and attendance", group: "HR", parent: "HR", keywords: ["clock", "timesheet"], icon: CalendarCheck },
  { id: "todos", label: "Todos", description: "Personal tasks you can send to daily report", group: "Workspace", keywords: ["todo", "personal tasks"], icon: ListTodo },
  { id: "forum", label: "Forum", description: "Group forum and direct team messages", group: "Workspace", keywords: ["chat", "message", "dm"], icon: MessagesSquare },
  { id: "sheet-dashboard", label: "Sheet Dashboard", description: "Connected sheet dashboards and views", group: "Workspace", keywords: ["spreadsheet", "google sheet"], icon: Sheet },
  { id: "automations", label: "Automation", description: "Run and manage automation workflows", group: "Workspace", keywords: ["workflow"], icon: Workflow },
  { id: "reports", label: "Reports", description: "Generate and review saved reports", group: "Workspace", keywords: ["pdf", "analysis"], icon: ChartNoAxesCombined },
  { id: "employee-daily-report", label: "Employee Daily Report", description: "Fill or review daily employee work reports", group: "HR", keywords: ["daily report", "work progress"], icon: CalendarCheck },
  { id: "activity-log", label: "Activity Log", description: "Audit trail and recent system activity", group: "Workspace", keywords: ["history", "audit"], icon: Activity },
  { id: "whatsapp", label: "WhatsApp", description: "WhatsApp contacts, templates, and messages", group: "Admin", keywords: ["message", "chat"], icon: MessageCircleMore },
  { id: "manage-roles", label: "Manage Roles", description: "Create roles and configure module access", group: "Access Control", parent: "Access Control", keywords: ["permissions"], icon: ShieldCheck },
  { id: "manage-users", label: "Manage Users", description: "Create users, reset passwords, and access", group: "Access Control", parent: "Access Control", keywords: ["accounts"], icon: Users },
  { id: "module-control", label: "Module Control", description: "Enable or disable platform modules", group: "Access Control", parent: "Access Control", keywords: ["settings"], icon: SlidersHorizontal },
  { id: "profile", label: "Profile", description: "Manage your user profile, contact, and password", group: "Account", keywords: ["account", "password"], icon: UserRound },
];

const SUGGESTIONS = ["profile", "leave", "daily report", "projects", "documents", "attendance", "password"];

function scoreItem(item, query) {
  if (!query) return 1;
  const haystack = [item.label, item.description, item.group, item.parent, ...(item.keywords || [])].join(" ").toLowerCase();
  const label = item.label.toLowerCase();
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (haystack.includes(query)) return 50;
  return 0;
}

export default function CommandPalette({ open, onClose, onNavigate, allowedMenus = [], darkMode = false }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const allowed = useMemo(() => new Set(allowedMenus), [allowedMenus]);
  const items = useMemo(() => COMMAND_ITEMS.filter((item) => allowed.has(item.id)), [allowed]);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items
      .map((item) => ({ item, score: scoreItem(item, normalized) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map(({ item }) => item);
  }, [items, query]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 90);
    return () => window.clearTimeout(timer);
  }, [open]);

  function closePalette() {
    setQuery("");
    setActiveIndex(0);
    onClose();
  }

  function selectItem(item = filteredItems[activeIndex]) {
    if (!item) return;
    onNavigate(item.id);
    setQuery("");
    setActiveIndex(0);
    onClose();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(0, filteredItems.length - 1)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectItem();
    }
  }

  const visibleItems = query.trim() ? filteredItems : filteredItems.slice(0, 8);

  return (
    <div className={`fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[7vh] transition duration-300 ${open ? "pointer-events-auto bg-black/45 backdrop-blur-md opacity-100" : "pointer-events-none bg-black/0 backdrop-blur-0 opacity-0"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closePalette(); }}>
      <div className={`flex max-h-[86vh] w-full max-w-3xl origin-top flex-col overflow-hidden rounded-[30px] border shadow-[0_36px_120px_rgba(15,23,42,0.30)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-5 scale-[0.96] opacity-0"} ${darkMode ? "border-white/10 bg-[#111318] text-white" : "border-white/70 bg-white text-[#172033]"}`}>
        <div className={`flex h-24 shrink-0 items-center gap-4 border-b px-6 ${darkMode ? "border-white/10" : "border-black/5"}`}>
          <Search className={`h-6 w-6 shrink-0 ${darkMode ? "text-white/45" : "text-slate-400"}`} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search modules, pages, or actions..."
            className={`min-w-0 flex-1 bg-transparent text-lg outline-none ${darkMode ? "placeholder:text-white/35" : "placeholder:text-slate-400"}`}
          />
          <kbd className={`hidden rounded-lg border px-3 py-1.5 text-xs sm:inline ${darkMode ? "border-white/10 bg-white/5 text-white/55" : "border-slate-200 bg-slate-50 text-slate-500"}`}>Esc</kbd>
          <button type="button" onClick={closePalette} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "text-white/55 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100"}`} aria-label="Close search">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {!query.trim() && (
            <p className={`mb-4 text-sm font-semibold ${darkMode ? "text-white/60" : "text-slate-600"}`}>Popular modules</p>
          )}
          {query.trim() && filteredItems.length > 0 && (
            <p className={`mb-4 text-sm font-semibold ${darkMode ? "text-white/55" : "text-slate-500"}`}>Found {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}</p>
          )}

          {visibleItems.length > 0 ? (
            <div className={!query.trim() ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
              {visibleItems.map((item, index) => {
                const Icon = item.icon || Search;
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                    className={`group flex w-full items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-200 ${active ? darkMode ? "border-[#d8f36a]/30 bg-[#d8f36a]/10" : "border-emerald-100 bg-[#f5fbf7]" : darkMode ? "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]" : "border-slate-200 bg-white hover:border-emerald-100 hover:bg-[#f8fcfa]"}`}
                  >
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${item.group === "Access Control" ? "bg-rose-50 text-rose-600" : item.group === "HR" ? "bg-emerald-50 text-emerald-600" : darkMode ? "bg-white/10 text-[#d8f36a]" : "bg-blue-50 text-blue-600"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-base font-semibold">{item.label}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${darkMode ? "bg-white/10 text-white/55" : "bg-slate-100 text-slate-500"}`}>{item.parent ? "submenu" : "module"}</span>
                      </span>
                      <span className={`mt-1 block truncate text-sm ${darkMode ? "text-white/45" : "text-slate-500"}`}>{item.description}</span>
                      {item.parent && <span className={`mt-1 block truncate text-xs ${darkMode ? "text-white/35" : "text-slate-400"}`}>{item.parent} / {item.group}</span>}
                    </span>
                    <ArrowRight className={`h-5 w-5 shrink-0 transition ${active ? "translate-x-0 opacity-70" : "-translate-x-1 opacity-25 group-hover:translate-x-0 group-hover:opacity-60"}`} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-[260px] place-items-center text-center">
              <div>
                <span className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${darkMode ? "bg-white/5 text-white/45" : "bg-slate-50 text-slate-400"}`}>
                  <Search className="h-9 w-9" />
                </span>
                <h3 className="mt-6 text-xl font-semibold">No results found</h3>
                <p className={`mt-2 text-sm ${darkMode ? "text-white/45" : "text-slate-500"}`}>Try a different module, page, or action name.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className={`rounded-xl px-3 py-2 text-sm ${darkMode ? "bg-white/7 text-white/65 hover:bg-white/10" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{suggestion}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`grid shrink-0 grid-cols-2 items-center gap-3 border-t px-5 py-4 text-xs sm:grid-cols-3 ${darkMode ? "border-white/10 bg-white/[0.03] text-white/45" : "border-black/5 bg-slate-50 text-slate-500"}`}>
          <span><kbd className="rounded-md border px-2 py-1">↑↓</kbd> Navigate</span>
          <span className="text-center"><kbd className="rounded-md border px-2 py-1">Enter</kbd> Select</span>
          <span className="hidden text-right sm:block">{query.trim() ? `Showing ${filteredItems.length} of ${items.length}` : `Search across ${items.length} items`}</span>
        </div>
      </div>
    </div>
  );
}
