"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ClipboardList, FileSpreadsheet, FileText, FolderLock, Images, LayoutDashboard, ListTodo, MessageCircleMore, MessagesSquare, PackageSearch, Search, ShieldCheck, SlidersHorizontal, UserRound, UserRoundSearch, Users, Workflow, X, ChartNoAxesCombined, Sheet } from "lucide-react";
import { preloadModule } from "./appModules";

const COMMAND_ITEMS = [
  { id: "dashboard", label: "Dashboard", description: "Overview, documents, activity, and workspace status", group: "Workspace", keywords: ["home", "overview"], icon: LayoutDashboard },
  { id: "documents", label: "Documents", description: "Browse, upload, search, and manage documents", group: "Workspace", keywords: ["files", "drive"], icon: FileText },
  { id: "department-documents", label: "Department Documents", description: "Department folders: uploads, sheet and form links, sharing", group: "Workspace", keywords: ["department", "folder", "shared drive", "files"], icon: FolderLock },
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
  { id: "hr-recruitment", label: "Recruitment", description: "Source candidates from LinkedIn, Indeed, and Foundit", group: "HR", parent: "HR", keywords: ["hiring", "sourcing", "candidates", "jobs", "resume"], icon: UserRoundSearch },
  { id: "todos", label: "Todos", description: "Personal tasks you can send to daily report", group: "Workspace", keywords: ["todo", "personal tasks"], icon: ListTodo },
  { id: "forum", label: "Loop", description: "Group chats and direct team messages", group: "Workspace", keywords: ["chat", "message", "dm", "forum"], icon: MessagesSquare },
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
    void preloadModule(item.id);
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
    <div className={`fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[10vh] newq transition duration-200 ${open ? "pointer-events-auto bg-black/25 opacity-100" : "pointer-events-none bg-black/0 opacity-0"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closePalette(); }}>
      <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`flex max-h-[70vh] w-full max-w-xl origin-top flex-col overflow-hidden rounded-[16px] border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.98] opacity-0"} ${darkMode ? "border-white/10 bg-[#17181c] text-white" : "border-[#e8e8e6] bg-white text-[#171717]"}`}>
        <div className={`flex h-12 shrink-0 items-center gap-2.5 border-b px-4 ${darkMode ? "border-white/10" : "border-[#efefed]"}`}>
          <Search className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/45" : "text-[#a3a3a0]"}`} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search modules, pages, or actions..."
            className={`min-w-0 flex-1 bg-transparent text-[14px] outline-none ${darkMode ? "placeholder:text-white/35" : "placeholder:text-[#a3a3a0]"}`}
          />
          <kbd className={`hidden rounded-[6px] border px-1.5 py-0.5 text-[11px] sm:inline ${darkMode ? "border-white/10 text-white/50" : "border-[#e4e4e1] text-[#8a8a87]"}`}>Esc</kbd>
          <button type="button" onClick={closePalette} className={`grid h-7 w-7 place-items-center rounded-[8px] ${darkMode ? "text-white/55 hover:bg-white/10" : "text-[#8a8a87] hover:bg-[#f1f1ef]"}`} aria-label="Close search">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {!query.trim() && (
            <p className={`px-2.5 pb-1 pt-2 text-[11.5px] font-medium ${darkMode ? "text-white/45" : "text-[#8a8a87]"}`}>Go to</p>
          )}
          {query.trim() && filteredItems.length > 0 && (
            <p className={`px-2.5 pb-1 pt-2 text-[11.5px] font-medium ${darkMode ? "text-white/45" : "text-[#8a8a87]"}`}>{filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}</p>
          )}

          {visibleItems.length > 0 ? (
            <div className="space-y-0.5">
              {visibleItems.map((item, index) => {
                const Icon = item.icon || Search;
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => {
                      setActiveIndex(index);
                      void preloadModule(item.id);
                    }}
                    onClick={() => selectItem(item)}
                    className={`group relative flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition-colors duration-100 ${active ? (darkMode ? "bg-white/[0.07]" : "bg-[#f3f3f1]") : ""}`}
                  >
                    <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border ${darkMode ? "border-white/10 bg-white/[0.04] text-white/70" : "border-[#ececea] bg-white text-[#5f5f5c]"}`}>
                      <Icon className="h-[15px] w-[15px]" />
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13.5px] font-medium">{item.label}</span>
                        {item.parent && <span className={`shrink-0 text-[11.5px] ${darkMode ? "text-white/40" : "text-[#a3a3a0]"}`}>in {item.parent}</span>}
                      </span>
                      <span className={`block truncate text-[12px] ${darkMode ? "text-white/45" : "text-[#8a8a87]"}`}>{item.description}</span>
                    </span>
                    <ArrowRight className={`relative h-4 w-4 shrink-0 transition ${active ? "opacity-60" : "opacity-0 group-hover:opacity-40"}`} />
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

        <div className={`grid shrink-0 grid-cols-2 items-center gap-3 border-t px-4 py-2.5 text-[11.5px] sm:grid-cols-3 ${darkMode ? "border-white/10 text-white/45" : "border-[#efefed] text-[#8a8a87]"}`}>
          <span><kbd className="rounded-[5px] border px-1.5 py-0.5">↑↓</kbd> Navigate</span>
          <span className="text-center"><kbd className="rounded-[5px] border px-1.5 py-0.5">Enter</kbd> Select</span>
          <span className="hidden text-right sm:block">{query.trim() ? `Showing ${filteredItems.length} of ${items.length}` : `Search across ${items.length} items`}</span>
        </div>
      </div>
    </div>
  );
}
