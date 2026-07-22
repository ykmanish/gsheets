"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  ClipboardList,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Flag,
  FolderKanban,
  FolderOpen,
  Grid2X2,
  Layers3,
  LayoutDashboard,
  Link2,
  List,
  ListChecks,
  Loader2,
  MapPin,
  Maximize2,
  MessageSquare,
  Minimize2,
  PackageSearch,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
  Reply,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import MrnDetailDrawer from "./MrnDetailDrawer";
import { ConfirmModal, DatePicker, SelectMenu } from "./ui";

const STATUS_OPTIONS = [
  { value: "todo", label: "Not started", color: "slate" },
  { value: "in_progress", label: "In progress", color: "amber" },
  { value: "blocked", label: "Blocked", color: "rose" },
  { value: "done", label: "Done", color: "green" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const HEALTH_OPTIONS = [
  { value: "green", label: "On track" },
  { value: "yellow", label: "Needs attention" },
  { value: "red", label: "At risk" },
];

const DOC_CATEGORIES = [
  "Drawing",
  "Agreement",
  "Quotation",
  "Approval",
  "Bill",
  "Site photo",
  "General",
];

const STAT_TONES = {
  green: "bg-[#eafbdc] text-[#3f7d16] dark:bg-[#17361e] dark:text-[#a9f27c]",
  teal: "bg-[#e2faf6] text-[#137d6b] dark:bg-[#123936] dark:text-[#7de8d6]",
  blue: "bg-[#edf2ff] text-[#2d55a1] dark:bg-[#172544] dark:text-[#9ebaff]",
  amber: "bg-[#fff2cc] text-[#805b11] dark:bg-[#3b2d0d] dark:text-[#ffd872]",
  rose: "bg-[#ffe2e7] text-[#9c2d43] dark:bg-[#431822] dark:text-[#ff9aaa]",
};

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiForm(path, formData) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Upload failed");
  return data;
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function blankTask(phaseId = "") {
  return {
    id: uid("task"),
    phaseId,
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    startDate: "",
    dueDate: "",
    assigneeIds: [],
    assignees: [],
    dependencyIds: [],
    documentIds: [],
    subtasks: [],
    comments: [],
    __isNew: true,
  };
}

function completeSubtasksWhenTaskDone(task = {}) {
  if (task.status !== "done" || !Array.isArray(task.subtasks)) return task;
  const completedAt = task.completedAt || new Date().toISOString();
  return {
    ...task,
    completedAt,
    subtasks: task.subtasks.map((subtask) => ({ ...subtask, done: true })),
  };
}

function blankPhase() {
  return {
    id: uid("phase"),
    name: "",
    description: "",
    status: "todo",
    startDate: "",
    dueDate: "",
    ownerId: "",
    ownerName: "",
    dependencyIds: [],
    tasks: [],
    __isNew: true,
  };
}

function blankProject() {
  return {
    name: "",
    code: "",
    client: "",
    location: "",
    budget: "",
    manager: "",
    managerId: "",
    status: "active",
    priority: "medium",
    health: "green",
    startDate: "",
    targetDate: "",
    driveFolderLink: "",
    aliases: [],
    phases: [{ ...blankPhase(), name: "Planning", __isNew: undefined }],
    tasks: [],
    projectDocuments: [],
    assignments: [],
    dmr: {
      enabled: false,
      spreadsheetId: "",
      siteNames: [],
      agencyNames: [],
      assignedUserIds: [],
      editableUserIds: [],
    },
  };
}

function formatDate(value, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDate(value) {
  if (!value) return "No deadline";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  const days = Math.round((due - today) / 86400000);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `${days} days left`;
}

function initials(name = "?") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function statusLabel(status) {
  return (
    STATUS_OPTIONS.find((item) => item.value === status)?.label || "Not started"
  );
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Button({ children, variant = "default", className = "", ...props }) {
  const variants = {
    default:
      "border border-[#d9ddd6] bg-white text-[#20231f] hover:bg-[#f6f7f4] dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/10",
    primary:
      "border border-[#20231f] bg-[#20231f] text-white hover:bg-[#30342e] dark:!border-[#d8f36a] dark:!bg-[#d8f36a] dark:!text-[#11150f] dark:hover:!bg-[#cdea5e]",
    accent:
      "border border-[#71c94e] bg-[#78d455] text-[#13200e] hover:bg-[#6bc248]",
    ghost:
      "border border-transparent text-[#60655d] hover:bg-black/[0.04] dark:text-white/60 dark:hover:bg-white/[0.06]",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-2 rounded-full px-2.5 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function IconButton({ label, className = "", children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#63685f] transition hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Avatar({ name, index = 0, size = "md", className = "" }) {
  const colors = [
    "bg-[#2e8b70]",
    "bg-[#637dd8]",
    "bg-[#b06f9f]",
    "bg-[#c47a45]",
    "bg-[#77883c]",
  ];
  const sizes =
    size === "sm"
      ? "h-6 w-6 text-[9px]"
      : size === "lg"
        ? "h-11 w-11 text-sm"
        : "h-8 w-8 text-[10px]";
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white dark:ring-[#171915]",
        colors[(String(name || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) || index) % colors.length],
        sizes,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

function AvatarStack({ names = [], limit = 4 }) {
  return (
    <span className="flex items-center -space-x-2">
      {names.slice(0, limit).map((name, index) => (
        <Avatar key={`${name}-${index}`} name={name} index={index} />
      ))}
      {names.length > limit && (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eceee9] text-[10px] font-bold text-[#5f645c] ring-2 ring-white dark:bg-white/10 dark:text-white/70 dark:ring-[#171915]">
          +{names.length - limit}
        </span>
      )}
    </span>
  );
}

function projectTeamMembers(project = {}, tasks = [], users = []) {
  const byKey = new Map();
  const addMember = (person = {}, fallbackName = "", role = "Member") => {
    const name = person.displayName || fallbackName || person.username || "";
    const key = person.id || person.username || name;
    if (!key || byKey.has(key)) return;
    byKey.set(key, {
      id: key,
      name,
      username: person.username || "",
      role,
      taskCount: tasks.filter((task) => (task.assigneeIds || []).includes(person.id)).length,
    });
  };
  if (project.managerId) {
    addMember(users.find((person) => person.id === project.managerId), project.manager, "Manager");
  } else if (project.manager) {
    addMember({}, project.manager, "Manager");
  }
  tasks.forEach((task) => {
    (task.assigneeIds || []).forEach((id) => {
      const person = users.find((item) => item.id === id);
      addMember(person, id, "Assignee");
    });
  });
  return [...byKey.values()];
}

function ProgressBar({ value = 0, className = "" }) {
  return (
    <span
      className={cn(
        "block h-4 overflow-hidden rounded-full bg-[#e8ebe5] dark:bg-white/10",
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-[#72cf50] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </span>
  );
}

function StatusPill({ status, count, compact = false }) {
  const styles = {
    todo: "bg-[#eef0ec] text-[#51564e] dark:bg-white/10 dark:text-white/65",
    in_progress:
      "bg-[#fff0c9] text-[#8a6312] dark:bg-amber-400/15 dark:text-amber-200",
    blocked:
      "bg-[#ffe2e4] text-[#a93b47] dark:bg-rose-400/15 dark:text-rose-200",
    done: "bg-[#dff6d7] text-[#367b25] dark:bg-green-400/15 dark:text-green-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        styles[status] || styles.todo,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full border-2",
          status === "done"
            ? "border-[#63bd43] bg-[#63bd43]"
            : status === "blocked"
              ? "border-[#d95b67]"
              : status === "in_progress"
                ? "border-[#d8a62e]"
                : "border-[#8c9288]",
        )}
      />
      {statusLabel(status)}
      {typeof count === "number" && (
        <span className="ml-0.5 opacity-60">{count}</span>
      )}
    </span>
  );
}

function PriorityPill({ priority = "medium" }) {
  const styles = {
    low: "bg-[#eef1ec] text-[#5f675b]",
    medium: "bg-[#fff2cc] text-[#836115]",
    high: "bg-[#ffe2d2] text-[#9b4a25]",
    critical: "bg-[#ffe0e4] text-[#a63644]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold capitalize dark:bg-white/10 dark:text-white/70",
        styles[priority] || styles.medium,
      )}
    >
      <Flag className="h-3 w-3" />
      {priority}
    </span>
  );
}

function Field({ label, icon: Icon, hint, children, className = "" }) {
  return (
    <div className={cn("block", className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[#666c63] dark:text-white/50">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </span>
        {hint && <span className="text-[10px] opacity-70">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-[#dfe3dc] bg-white px-3 text-sm text-[#20231f] outline-none transition placeholder:text-[#a4a9a1] focus:border-[#9acb87] focus:ring-2 focus:ring-[#72cf50]/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25";
const textAreaClass =
  "w-full resize-none rounded-lg border border-[#dfe3dc] bg-white px-3 py-2.5 text-sm leading-6 text-[#20231f] outline-none transition placeholder:text-[#a4a9a1] focus:border-[#9acb87] focus:ring-2 focus:ring-[#72cf50]/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25";

function NativeSelect({
  darkMode,
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  placeholder = "Select an option",
}) {
  return (
    <SelectMenu
      darkMode={darkMode}
      value={value || ""}
      options={options}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

function AssigneePicker({
  darkMode,
  users,
  selectedIds,
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = users.filter((item) => selectedIds.includes(item.id));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter((person) => {
    if (!normalizedQuery) return true;
    return `${person.displayName || ""} ${person.username || ""}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) setQuery("");
          setOpen((current) => !current);
        }}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
          darkMode
            ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10"
            : "border-black/10 bg-white text-black hover:bg-black/[0.03]",
          open && (darkMode ? "ring-2 ring-[#d8f36a]/25" : "ring-2 ring-black/10"),
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {selected.length ? (
            selected.map((person, index) => (
              <span
                key={person.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-2 text-xs",
                  darkMode ? "bg-white/10" : "bg-black/[0.04]",
                )}
              >
                <Avatar
                  name={person.displayName || person.username}
                  index={index}
                  size="sm"
                />
                {person.displayName || person.username}
              </span>
            ))
          ) : (
            <span className={darkMode ? "text-white/35" : "text-black/35"}>
              Assign people
            </span>
          )}
        </span>
        <UserPlus className={cn("h-4 w-4 shrink-0", darkMode ? "text-white/45" : "text-black/45")} />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-[90] max-h-64 overflow-y-auto rounded-2xl border p-2 shadow-xl",
            darkMode ? "border-white/10 bg-[#181a20]" : "border-black/5 bg-white",
          )}
        >
          <div
            className={cn(
              "sticky top-0 z-10 mb-2 rounded-xl border px-3 py-2",
              darkMode ? "border-white/10 bg-[#181a20]" : "border-black/10 bg-white",
            )}
          >
            <div className="flex items-center gap-2">
              <Search
                className={cn(
                  "h-4 w-4 shrink-0",
                  darkMode ? "text-white/40" : "text-black/40",
                )}
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search team members"
                className={cn(
                  "h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current placeholder:opacity-35",
                  darkMode ? "text-white" : "text-black",
                )}
              />
            </div>
          </div>
          {filteredUsers.map((person, index) => {
            const active = selectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selectedIds.filter((id) => id !== person.id)
                      : [...selectedIds, person.id],
                  )
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition",
                  darkMode
                    ? "text-white/70 hover:bg-white/[0.08]"
                    : "text-black/65 hover:bg-black/[0.04]",
                  active &&
                    (darkMode
                      ? "border-[#d8f36a]/25 text-white"
                      : "border-[#dfe3dc] bg-[#f7f9f5] text-black"),
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    active
                      ? darkMode
                        ? "border-[#d8f36a] bg-[#d8f36a] text-black"
                        : "border-[#5fbe48] bg-[#5fbe48] text-white"
                      : darkMode
                        ? "border-white/20"
                        : "border-black/20",
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
                <Avatar
                  name={person.displayName || person.username}
                  index={index}
                  size="sm"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {person.displayName || person.username}
                  </span>
                  <span className={cn("block truncate text-[11px]", active ? "opacity-70" : darkMode ? "text-white/45" : "text-black/45")}>
                    {person.username}
                  </span>
                </span>
              </button>
            );
          })}
          {!filteredUsers.length && (
            <p className={cn("p-4 text-center text-xs", darkMode ? "text-white/45" : "text-black/45")}>
              {users.length ? "No matching members" : "No users available"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SlideOver({
  title,
  eyebrow,
  onClose,
  width = "max-w-[560px]",
  children,
  footer,
}) {
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 240);
  }

  return (
    <div
      className={cn(
        "project-drawer-backdrop fixed inset-0 z-[80] flex justify-end bg-[#11150f]/20 backdrop-blur-[1px]",
        closing && "is-closing",
      )}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) requestClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "project-drawer-panel flex h-full w-full flex-col border-l border-[#dfe3dc] bg-[#fbfcfa] text-[#20231f] dark:border-white/10 dark:bg-[#141713] dark:text-white",
          closing && "is-closing",
          width,
        )}
      >
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e4e7e1] bg-white px-5 dark:border-white/10 dark:bg-[#171a16]">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#737970] dark:text-white/45">
            {eyebrow && <span className="truncate">{eyebrow}</span>}
            {eyebrow && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate font-medium text-[#30342e] dark:text-white/75">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label="Close" onClick={requestClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        {footer && (
          <footer className="shrink-0 border-t border-[#e4e7e1] bg-white px-5 py-3 dark:border-white/10 dark:bg-[#171a16]">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

function PropertyRow({ icon: Icon, label, children }) {
  return (
    <div className="grid min-h-10 grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
      <span className="flex items-center gap-2 text-xs text-[#777d74] dark:text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function LoadingView({ darkMode }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center",
        darkMode ? "bg-[#10120f] text-white" : "bg-[#f4f5f2] text-[#20231f]",
      )}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-[#dfe3dc] bg-white px-5 py-4 dark:border-white/10 dark:bg-white/[0.04]">
        <Loader2 className="h-5 w-5 animate-spin text-[#61b642]" />
        <span className="text-sm font-medium">
          Loading project workspace...
        </span>
      </div>
    </div>
  );
}

function DetailBadge({ icon: Icon, label, children, className = "" }) {
  return (
    <div className={cn("rounded-2xl p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
          {label}
        </p>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/55 text-current dark:bg-white/10">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-base font-bold">{children}</div>
    </div>
  );
}

function DetailSection({ title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className="h-4 w-4 text-[#6c7468]" />}
        {title}
      </div>
      {children}
    </section>
  );
}

function TaskDetailView({
  task,
  project,
  phase,
  assignees,
  users = [],
  attachments,
  dependencies,
  editable,
  onEdit,
}) {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const doneSubtasks = subtasks.filter((item) => item.done).length;
  const blockedBy = task.blockedBy || dependencies.filter((item) => item.status !== "done");
  const dependencyWarnings = task.dependencyWarnings || dependencies.filter((item) => item.dueDate && task.dueDate && task.dueDate < item.dueDate);
  const progress = subtasks.length ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;
  const [activeTab, setActiveTab] = useState("progress");
  return (
    <div className="px-6 pb-8 pt-6 sm:px-7">
      <p className="text-sm text-[#7a8077] dark:text-white/45">
        in list <span className="border-b border-[#aeb4aa] text-[#30352f] dark:border-white/30 dark:text-white/75">{phase?.name || "Unassigned"}</span>
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <h2 className="max-w-[520px] min-w-0 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#101426] dark:text-white">
          {task.title || "Untitled task"}
        </h2>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {editable && (
            <Button variant="primary" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit task
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4 border-b border-[#e5e8e2] pb-5 dark:border-white/10">
        <PropertyRow icon={Circle} label="Status">
          <div className="flex flex-wrap items-center gap-4">
            <StatusPill status={task.status || "todo"} compact />
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-[#20231f] dark:text-white">
              <CalendarDays className="h-4 w-4 text-[#777d74] dark:text-white/45" />
              <span className="text-xs font-medium text-[#777d74] dark:text-white/45">Due date</span>
              {formatDate(task.dueDate, "No date")}
            </span>
          </div>
        </PropertyRow>
        <PropertyRow icon={Users} label="Assignee">
          {assignees.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {assignees.map((person, index) => (
                <span key={person.id} className="inline-flex items-center gap-2 rounded-full bg-[#f2f5f1] py-1 pl-1 pr-3 text-sm font-medium dark:bg-white/[0.06]">
                  <Avatar name={person.displayName || person.username} index={index} size="sm" />
                  {person.displayName || person.username}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-[#858b82]">No assignees added</span>
          )}
        </PropertyRow>
        <PropertyRow icon={Tag} label="Label">
          <div className="flex flex-wrap gap-2">
            <PriorityPill priority={task.priority || "medium"} />
            <span className="inline-flex rounded-full bg-[#f4f5f2] px-3 py-1 text-xs font-semibold text-[#4f554c] dark:bg-white/[0.06] dark:text-white/65">{phase?.name || "No phase"}</span>
          </div>
        </PropertyRow>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-semibold">Description</h3>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-[#4f554c] dark:text-white/65">
          {task.description || "No description added."}
        </p>
      </section>

      {(blockedBy.length > 0 || dependencyWarnings.length > 0) && (
        <section className="mt-6">
          <div className="space-y-2">
            {blockedBy.length > 0 && (
              <div className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
                Blocked by {blockedBy.map((item) => item.title || "Untitled task").join(", ")}. This clears automatically when the blocking task is done.
              </div>
            )}
            {dependencyWarnings.length > 0 && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-400/10 dark:text-amber-100">
                Warning: this task is due before {dependencyWarnings.map((item) => item.title || "a dependency").join(", ")}.
              </div>
            )}
          </div>
        </section>
      )}

      <div className="mt-7 flex gap-8 border-b border-[#e1e5de] dark:border-white/10">
        {[
          ["progress", "Progress"],
          ["file", `File ${attachments.length || ""}`],
          ["comments", `Comments ${(task.comments || []).length || ""}`],
        ].map(([value, label]) => (
          <button type="button" key={value} onClick={() => setActiveTab(value)} className={cn("border-b-2 px-1 pb-3 text-sm transition", activeTab === value ? "border-[#1683ff] font-semibold text-[#20231f] dark:border-[#7cb7ff] dark:text-white" : "border-transparent text-[#7c8278] hover:text-[#20231f] dark:text-white/45 dark:hover:text-white/75")}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "comments" && <section className="pt-5">
        <h4 className="text-lg font-semibold">Comment</h4>
        <div className="mt-4 space-y-4">
          {(task.comments || []).map((item, index) => (
            <div key={item.id || index} className="flex items-start gap-3">
              <Avatar name={item.authorName || "User"} index={index} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{item.authorName || "User"}</span>
                  <span className="text-xs text-[#8b9088]">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="mt-1 rounded-xl bg-[#f5f6f8] px-3 py-2 text-sm leading-6 text-[#4f554c] dark:bg-white/[0.05] dark:text-white/65">{item.text}</p>
              </div>
            </div>
          ))}
          {!(task.comments || []).length && (
            <p className="rounded-xl bg-[#f5f6f8] px-4 py-4 text-sm text-[#858b82] dark:bg-white/[0.04]">No comments yet.</p>
          )}
        </div>
        <div className="mt-5 rounded-full bg-[#f5f6f8] px-4 py-3 text-sm text-[#a1a6a0] dark:bg-white/[0.05]">
          Comment here ...
        </div>
      </section>}

      {activeTab === "progress" && <section className="pt-5">
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#5f665b] dark:text-white/55">Progress {doneSubtasks}/{subtasks.length}</span>
          <span className="text-xs text-[#858b82]">{progress}%</span>
        </div>
        <ProgressBar value={progress} className="mt-3" />
        <div className="mt-4 space-y-3">
          {subtasks.map((item) => {
            const subtaskStatus = item.done ? "done" : item.status || "todo";
            const subtaskDueDate = item.dueDate || item.deadline || item.date || "";
            return (
            <div key={item.id} className="rounded-xl border border-[#e0e4dd] bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", item.done ? "border-[#6877f4] bg-[#6877f4] text-white" : "border-[#a9afa5]")}>
                  {item.done && <Check className="h-3 w-3" />}
                </span>
                <span className={cn("min-w-[160px] flex-1 truncate text-sm font-medium", item.done && "text-[#8a8f87] line-through")}>{item.title || "Untitled subtask"}</span>
                <div className="ml-auto flex shrink-0 items-center gap-3">
                  <StatusPill status={subtaskStatus} compact />
                  <span className="text-sm font-semibold text-[#20231f] dark:text-white">
                    {formatDate(subtaskDueDate, "No deadline")}
                  </span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[#5f665b] dark:text-white/55">
                {item.description || "No description added."}
              </p>
            </div>
            );
          })}
          {!subtasks.length && <div className="rounded-lg border border-dashed border-[#d7dcd3] px-4 py-6 text-center text-xs text-[#858b82] dark:border-white/10">No subtasks added.</div>}
        </div>
      </section>}

      {activeTab === "file" && <section className="pt-5">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs font-medium text-[#72786f] dark:text-white/50">
          <span className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" />Attachment ({attachments.length})</span>
          {attachments.length > 1 && <button type="button" className="inline-flex items-center gap-1 text-[#4b5fb8]"><Download className="h-3.5 w-3.5" />Download all</button>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.length ? attachments.map((doc) => (
            <a key={doc.id || doc.driveFileId || doc.url} href={doc.url} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-2 rounded-lg border border-[#dfe3dc] bg-white p-2.5 hover:border-[#b8c4b3] dark:border-white/10 dark:bg-white/[0.03]">
              <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-500 dark:bg-rose-400/10"><FileText className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block truncate text-xs font-semibold">{doc.name || "File"}</span><span className="mt-0.5 block truncate text-[10px] text-[#858b82]">{doc.category || "Document"} · Open</span></span>
            </a>
          )) : <div className="col-span-full rounded-lg border border-dashed border-[#d7dcd3] px-4 py-6 text-center text-xs text-[#858b82] dark:border-white/10">No files attached.</div>}
        </div>
      </section>}

      {(dependencies.length > 0 || (task.comments || []).length > 0) && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <DetailSection title={`Dependencies (${dependencies.length})`} icon={Link2}>
            <div className="space-y-2">
              {dependencies.map((item) => (
                <div key={item.id} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm dark:bg-white/[0.05]", item.status === "done" ? "bg-[#f5f7f2]" : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200")}>
                  <StatusPill status={item.status || "todo"} compact />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title || "Untitled task"}</span>
                </div>
              ))}
              {!dependencies.length && <p className="text-sm text-[#858b82]">No dependencies linked.</p>}
            </div>
          </DetailSection>
          <DetailSection title="Activity" icon={Clock3}>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#72cf50]" />
                <p>Task is currently <b>{statusLabel(task.status || "todo").toLowerCase()}</b>.</p>
              </div>
              {(task.comments || []).length ? (
                <p className="text-[#6f766c] dark:text-white/55">{(task.comments || []).length} comment{(task.comments || []).length === 1 ? "" : "s"} added.</p>
              ) : (
                <p className="text-[#858b82]">No comments yet.</p>
              )}
            </div>
          </DetailSection>
        </section>
      )}
    </div>
  );
}

function PhaseDetailView({ phase, tasks, users, editable, onEdit, onOpenTask }) {
  const done = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const [activeTab, setActiveTab] = useState("tasks");
  return (
    <div className="px-6 pb-8 pt-6 sm:px-7">
      <p className="text-sm text-[#7a8077] dark:text-white/45">
        in project <span className="border-b border-[#aeb4aa] text-[#30352f] dark:border-white/30 dark:text-white/75">Project schedule</span>
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <h2 className="max-w-[520px] min-w-0 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#101426] dark:text-white">
          {phase.name || "Untitled phase"}
        </h2>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {editable && (
            <Button variant="primary" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit phase
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4 border-b border-[#e5e8e2] pb-5 dark:border-white/10">
        <PropertyRow icon={Sparkles} label="Progress">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{progress}% complete</span>
            <span className="text-xs text-[#737970] dark:text-white/50">{done} of {tasks.length} tasks done</span>
          </div>
        </PropertyRow>
        <PropertyRow icon={CalendarDays} label="Dates">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-[#20231f] dark:text-white">
              <span className="text-xs font-medium text-[#777d74] dark:text-white/45">Start date</span>
              {formatDate(phase.startDate, "No start date")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-[#20231f] dark:text-white">
              <span className="text-xs font-medium text-[#777d74] dark:text-white/45">Target date</span>
              {formatDate(phase.dueDate, "No target date")}
            </span>
          </div>
        </PropertyRow>
        <PropertyRow icon={Tag} label="Tags">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-400/15 dark:text-violet-100">
              <Layers3 className="h-3.5 w-3.5" />
              Phase
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold", blocked ? "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-100" : "bg-[#eafbdc] text-[#3f7d16] dark:bg-green-400/15 dark:text-green-100")}>
              <AlertCircle className="h-3.5 w-3.5" />
              {blocked ? `${blocked} blocked` : "On track"}
            </span>
          </div>
        </PropertyRow>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-semibold">Description</h3>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-[#4f554c] dark:text-white/65">
          {phase.description || "No description added for this phase."}
        </p>
      </section>

      <div className="mt-7 flex gap-8 border-b border-[#e1e5de] dark:border-white/10">
        {[
          ["progress", "Progress"],
          ["tasks", `Tasks ${tasks.length || ""}`],
          ["activity", "Activities"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => setActiveTab(value)}
            className={cn(
              "border-b-2 px-1 pb-3 text-sm transition",
              activeTab === value
                ? "border-[#1683ff] font-semibold text-[#20231f] dark:border-[#7cb7ff] dark:text-white"
                : "border-transparent text-[#7c8278] hover:text-[#20231f] dark:text-white/45 dark:hover:text-white/75",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "progress" && (
        <section className="pt-5">
          <div className="rounded-2xl border border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Phase progress</span>
              <span className="text-[#737970] dark:text-white/50">{done} of {tasks.length} done</span>
            </div>
            <ProgressBar value={progress} className="mt-3" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f5f6f3] p-4 text-sm dark:bg-white/[0.04]">
              <span className="text-xs font-medium uppercase text-[#858b82]">Completed</span>
              <p className="mt-2 text-2xl font-semibold">{done}</p>
            </div>
            <div className="rounded-xl bg-[#f5f6f3] p-4 text-sm dark:bg-white/[0.04]">
              <span className="text-xs font-medium uppercase text-[#858b82]">Blocked</span>
              <p className="mt-2 text-2xl font-semibold">{blocked}</p>
            </div>
          </div>
        </section>
      )}

      {activeTab === "tasks" && (
      <section className="pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-lg font-semibold">Tasks in this phase</h4>
          <span className="flex items-center gap-2 text-sm text-[#5f665b] dark:text-white/55">
            <span className="relative grid h-5 w-5 place-items-center rounded-full border-2 border-[#e1e5de] after:absolute after:inset-0 after:rounded-full after:border-2 after:border-l-[#6e7bff] after:border-t-[#6e7bff] after:border-transparent" />
            {done}/{tasks.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#e0e4dd] dark:border-white/10">
          {tasks.map((task, index) => {
            const names = users
              .filter((person) => (task.assigneeIds || []).includes(person.id))
              .map((person) => person.displayName || person.username);
            return (
              <button
                type="button"
                key={task.id}
                onClick={() => onOpenTask?.(task)}
                className="grid w-full gap-3 border-b border-[#e7eae4] bg-white px-3 py-3 text-left transition last:border-b-0 hover:bg-[#f7f8f5] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusPill status={task.status || "todo"} compact />
                    <span className="truncate text-sm font-semibold">
                      {task.title || "Untitled task"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#858b82]">
                    Due {formatDate(task.dueDate, "not set")}
                  </p>
                </div>
                <AvatarStack names={names} limit={2} key={index} />
              </button>
            );
          })}
          {!tasks.length && (
            <p className="p-7 text-center text-xs text-[#858b82]">
              No tasks in this phase yet.
            </p>
          )}
        </div>
      </section>
      )}

      {activeTab === "activity" && (
        <section className="pt-5">
          <h4 className="text-lg font-semibold">Activities</h4>
          <div className="mt-4 space-y-3 rounded-2xl border border-[#e0e4dd] bg-white p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#72cf50]" />
              <p>{done} task{done === 1 ? "" : "s"} completed in this phase.</p>
            </div>
            <div className="flex gap-3">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", blocked ? "bg-rose-500" : "bg-[#d8ddd4]")} />
              <p>{blocked ? `${blocked} task${blocked === 1 ? "" : "s"} blocked.` : "No blocked tasks."}</p>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1683ff]" />
              <p>{tasks.length} total task{tasks.length === 1 ? "" : "s"} linked to this phase.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TaskDrawer({
  darkMode,
  task,
  project,
  users,
  phases,
  documents,
  allTasks,
  currentUser,
  saving,
  editable,
  onChange,
  onClose,
  onSave,
  onSaveAddNew,
  onDelete,
}) {
  const [tab, setTab] = useState("subtasks");
  const [editMode, setEditMode] = useState(Boolean(task.__isNew));
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const isEditing = Boolean(editable && (task.__isNew || editMode));
  const assignees = users.filter((person) =>
    (task.assigneeIds || []).includes(person.id),
  );
  const attachments = documents
    .filter(
      (doc) =>
        (task.documentIds || []).includes(doc.id) ||
        (doc.driveFileId && (task.documentIds || []).includes(doc.driveFileId)),
    )
    .slice(0, 6);
  const dependencies = allTasks.filter((item) =>
    (task.dependencyIds || []).includes(item.id),
  );
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const doneSubtasks = subtasks.filter((item) => item.done).length;
  const phase = phases.find((item) => item.id === task.phaseId);

  function addComment() {
    if (!comment.trim()) return;
    onChange({
      comments: [
        ...(task.comments || []),
        {
          id: uid("comment"),
          text: comment.trim(),
          authorId: currentUser?.id || "",
          authorName:
            currentUser?.displayName || currentUser?.username || "You",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setComment("");
  }

  function addSubtask() {
    if (!subtaskTitle.trim()) return;
    onChange({
      subtasks: [
        ...subtasks,
        {
          id: uid("subtask"),
          title: subtaskTitle.trim(),
          description: "",
          dueDate: "",
          assigneeId: "",
          done: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setSubtaskTitle("");
  }

  function updateSubtask(id, patch) {
    onChange({
      subtasks: subtasks.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function removeSubtask(id) {
    onChange({ subtasks: subtasks.filter((item) => item.id !== id) });
  }

  function updateTaskStatus(status) {
    onChange(completeSubtasksWhenTaskDone({ ...task, status }));
  }

  return (
    <SlideOver
      title={
        task.__isNew
          ? "New task"
          : `${project.code || "TASK"}-${String(allTasks.findIndex((item) => item.id === task.id) + 1).padStart(2, "0")}`
      }
      eyebrow={`${project.name} / ${phases.find((phase) => phase.id === task.phaseId)?.name || "Unassigned"}`}
      onClose={onClose}
      width="max-w-[640px]"
      footer={
        isEditing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {task.__isNew ? (
              <span />
            ) : (
              <Button variant="danger" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={saving || !task.title.trim()}
                onClick={onSave}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save task
              </Button>
              {task.__isNew && (
                <Button
                  variant="primary"
                  disabled={saving || !task.title.trim()}
                  onClick={onSaveAddNew}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Save & add new
                </Button>
              )}
            </div>
          </div>
        ) : null
      }
    >
      {!isEditing ? (
        <TaskDetailView
          task={task}
          project={project}
          phase={phase}
          assignees={assignees}
          users={users}
          attachments={attachments}
          dependencies={dependencies}
          editable={editable}
          onEdit={() => setEditMode(true)}
        />
      ) : (
      <div className="px-6 pb-8 pt-5 sm:px-7">
        <div className="flex items-start gap-3">
          <button
            type="button"
            disabled={!isEditing}
            onClick={() => updateTaskStatus(task.status === "done" ? "todo" : "done")}
            className={cn(
              "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition disabled:cursor-default",
              task.status === "done"
                ? "border-[#65bf45] bg-[#65bf45] text-white"
                : "border-[#a9afa5] text-transparent hover:border-[#65bf45]",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <textarea
            rows={2}
            readOnly={!isEditing}
            value={task.title || ""}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Task title"
            className="min-h-[66px] w-full resize-none border-0 bg-transparent p-0 text-2xl font-semibold leading-tight tracking-[-0.02em] outline-none placeholder:text-[#a6aaa3] read-only:cursor-default dark:text-white"
          />
        </div>

        <div className="mt-5 space-y-1 border-y border-[#e6e9e3] py-3 dark:border-white/10">
          <PropertyRow icon={Circle} label="Status">
            <NativeSelect
              darkMode={darkMode}
              disabled={!isEditing}
              value={task.status || "todo"}
              onChange={updateTaskStatus}
              options={STATUS_OPTIONS}
            />
          </PropertyRow>
          <PropertyRow icon={CalendarDays} label="Due date">
            <DatePicker
              darkMode={darkMode}
              disabled={!isEditing}
              value={task.dueDate || ""}
              onChange={(value) => onChange({ dueDate: value })}
              placeholder="No date"
            />
          </PropertyRow>
          <PropertyRow icon={Users} label="Assignee">
            <AssigneePicker
              darkMode={darkMode}
              disabled={!isEditing}
              users={users}
              selectedIds={task.assigneeIds || []}
              onChange={(value) => onChange({ assigneeIds: value })}
            />
          </PropertyRow>
          <PropertyRow icon={Layers3} label="Phase">
            <NativeSelect
              darkMode={darkMode}
              disabled={!isEditing}
              value={task.phaseId || ""}
              onChange={(value) => onChange({ phaseId: value })}
              options={[
                { value: "", label: "No phase" },
                ...phases.map((phase) => ({
                  value: phase.id,
                  label: phase.name || "Untitled phase",
                })),
              ]}
            />
          </PropertyRow>
          <PropertyRow icon={Flag} label="Priority">
            <NativeSelect
              darkMode={darkMode}
              disabled={!isEditing}
              value={task.priority || "medium"}
              onChange={(value) => onChange({ priority: value })}
              options={PRIORITY_OPTIONS}
            />
          </PropertyRow>
        </div>

        <section className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#72786f] dark:text-white/50">
            <FileText className="h-3.5 w-3.5" />
            Description
          </div>
          <textarea
            rows={5}
            readOnly={!isEditing}
            value={task.description || ""}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Describe the outcome, context, blockers, and completion criteria..."
            className={cn(
              textAreaClass,
              "read-only:cursor-default read-only:bg-[#f4f5f2] dark:read-only:bg-white/[0.025]",
            )}
          />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-[#72786f] dark:text-white/50">
              <Paperclip className="h-3.5 w-3.5" />
              Attachments ({attachments.length})
            </span>
            {attachments.length > 1 && (
              <button
                type="button"
                className="text-xs font-semibold text-[#527d42]"
              >
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Download all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attachments.map((doc) => (
              <a
                key={doc.id || doc.driveFileId || doc.url}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="group flex min-w-0 items-center gap-2 rounded-lg border border-[#dfe3dc] bg-white p-2.5 hover:border-[#b8c4b3] dark:border-white/10 dark:bg-white/[0.03]"
              >
                <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-500 dark:bg-rose-400/10">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    {doc.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-[#858b82]">
                    {doc.category || "Document"} · Open
                  </span>
                </span>
              </a>
            ))}
            {isEditing && (
              <label className="relative flex min-h-[58px] items-center justify-center rounded-lg border border-dashed border-[#ccd2c8] text-[#7d837a] hover:bg-[#f4f6f2] dark:border-white/15 dark:hover:bg-white/[0.04]">
                <Plus className="pointer-events-none h-4 w-4" />
                <select
                  value=""
                  aria-label="Attach project file"
                  onChange={(event) =>
                    event.target.value &&
                    onChange({
                      documentIds: [
                        ...new Set([
                          ...(task.documentIds || []),
                          event.target.value,
                        ]),
                      ],
                    })
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="">Attach file</option>
                  {documents
                    .filter((doc) => !attachments.includes(doc))
                    .map((doc) => (
                      <option
                        key={doc.id || doc.driveFileId || doc.url}
                        value={doc.id || doc.driveFileId}
                      >
                        {doc.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        </section>

        <div className="mt-7 flex gap-6 border-b border-[#e1e5de] dark:border-white/10">
          {[
            ["subtasks", `Subtasks ${subtasks.length || ""}`],
            ["details", `Dependencies ${dependencies.length || ""}`],
            ["comments", `Comments ${(task.comments || []).length || ""}`],
            ["activity", "Activities"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "border-b-2 px-1 pb-3 text-sm transition",
                tab === value
                  ? "border-[#20231f] font-semibold text-[#20231f] dark:border-white dark:text-white"
                  : "border-transparent text-[#7c8278] dark:text-white/45",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "subtasks" && (
          <section className="pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">Subtasks</h4>
                <p className="mt-0.5 text-xs text-[#858b82]">
                  {doneSubtasks} of {subtasks.length} done
                </p>
              </div>
              <span className="text-xs text-[#858b82]">
                {subtasks.length ? Math.round((doneSubtasks / subtasks.length) * 100) : 0}%
              </span>
            </div>
            <ProgressBar
              value={subtasks.length ? Math.round((doneSubtasks / subtasks.length) * 100) : 0}
              className="mt-3"
            />
            {isEditing && (
              <div className="mt-4 flex gap-2">
                <input
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Add a subtask..."
                  className={cn(inputClass, "h-10 flex-1 rounded-full")}
                />
                <Button variant="primary" onClick={addSubtask}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {subtasks.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#e0e4dd] bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!isEditing}
                      onClick={() => updateSubtask(item.id, { done: !item.done })}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-default",
                        item.done
                          ? "border-[#65bf45] bg-[#65bf45] text-white"
                          : "border-[#a9afa5] text-transparent hover:border-[#65bf45]",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <input
                      readOnly={!isEditing}
                      value={item.title || ""}
                      onChange={(event) =>
                        updateSubtask(item.id, { title: event.target.value })
                      }
                      placeholder="Subtask title"
                      className={cn(
                        "min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none read-only:cursor-default",
                        item.done && "text-[#8a8f87] line-through",
                      )}
                    />
                    {isEditing && (
                      <IconButton
                        label="Remove subtask"
                        onClick={() => removeSubtask(item.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    readOnly={!isEditing}
                    value={item.description || ""}
                    onChange={(event) =>
                      updateSubtask(item.id, { description: event.target.value })
                    }
                    placeholder="Subtask description"
                    className={cn(
                      textAreaClass,
                      "mt-3 min-h-[58px] rounded-xl text-xs read-only:cursor-default read-only:bg-[#f4f5f2] dark:read-only:bg-white/[0.025]",
                    )}
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <DatePicker
                      darkMode={darkMode}
                      disabled={!isEditing}
                      value={item.dueDate || ""}
                      onChange={(value) => updateSubtask(item.id, { dueDate: value })}
                      placeholder="No deadline"
                    />
                    <NativeSelect
                      darkMode={darkMode}
                      disabled={!isEditing}
                      value={item.assigneeId || ""}
                      onChange={(value) => updateSubtask(item.id, { assigneeId: value })}
                      options={[
                        { value: "", label: "No assignee" },
                        ...users.map((person) => ({
                          value: person.id,
                          label: person.displayName || person.username,
                        })),
                      ]}
                    />
                  </div>
                </div>
              ))}
              {!subtasks.length && (
                <div className="rounded-lg border border-dashed border-[#d7dcd3] px-4 py-6 text-center text-xs text-[#858b82] dark:border-white/10">
                  No subtasks yet. Break this task into smaller steps here.
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "details" && (
          <section className="pt-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Dependencies</h4>
              <span className="text-xs text-[#858b82]">
                {dependencies.length} linked
              </span>
            </div>
            {(task.blockedBy || []).length > 0 && (
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
                Blocked by {(task.blockedBy || []).map((item) => item.title || "Untitled task").join(", ")} until completed.
              </div>
            )}
            {(task.dependencyWarnings || []).length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-100">
                Due date warning: this task is scheduled before a dependency finishes.
              </div>
            )}
            {isEditing && (
              <NativeSelect
                darkMode={darkMode}
                value=""
                onChange={(value) =>
                  value &&
                  onChange({
                    dependencyIds: [
                      ...new Set([...(task.dependencyIds || []), value]),
                    ],
                  })
                }
                options={[
                  { value: "", label: "Add a dependency..." },
                  ...allTasks
                    .filter(
                      (item) =>
                        item.id !== task.id &&
                        !(task.dependencyIds || []).includes(item.id),
                    )
                    .map((item) => ({
                      value: item.id,
                      label: item.title || "Untitled task",
                    })),
                ]}
                className="mt-3"
              />
            )}
            <div className="mt-3 space-y-2">
              {dependencies.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-[#e0e4dd] bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      item.status === "done"
                        ? "border-[#65bf45] bg-[#65bf45] text-white"
                        : "border-[#a9afa5]",
                    )}
                  >
                    {item.status === "done" && <Check className="h-3 w-3" />}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      item.status === "done" && "text-[#8a8f87] line-through",
                    )}
                  >
                    {item.title}
                  </span>
                  <StatusPill status={item.status} compact />
                  {isEditing && (
                    <IconButton
                      label="Remove dependency"
                      onClick={() =>
                        onChange({
                          dependencyIds: (task.dependencyIds || []).filter(
                            (id) => id !== item.id,
                          ),
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                </div>
              ))}
              {!dependencies.length && (
                <div className="rounded-lg border border-dashed border-[#d7dcd3] px-4 py-6 text-center text-xs text-[#858b82] dark:border-white/10">
                  No dependencies linked to this task.
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "comments" && (
          <section className="pt-5">
            <div className="space-y-4">
              {(task.comments || []).map((item, index) => (
                <div key={item.id || index} className="flex items-start gap-3">
                  <Avatar name={item.authorName || "User"} index={index} />
                  <div className="min-w-0 flex-1 rounded-lg bg-[#f1f3ef] px-3 py-2.5 dark:bg-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {item.authorName || "User"}
                      </span>
                      <span className="text-[10px] text-[#8b9088]">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-[#555b52] dark:text-white/65">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
              {!(task.comments || []).length && (
                <p className="py-4 text-center text-xs text-[#858b82]">
                  No comments yet.
                </p>
              )}
            </div>
            {isEditing && (
              <div className="mt-4 flex items-end gap-2">
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write a comment..."
                  className={textAreaClass}
                />
                <Button
                  variant="primary"
                  className="shrink-0"
                  onClick={addComment}
                >
                  Post
                </Button>
              </div>
            )}
          </section>
        )}

        {tab === "activity" && (
          <section className="pt-5">
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#72cf50]" />
                <div>
                  <p className="text-sm font-medium">
                    Task is currently {statusLabel(task.status).toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-[#858b82]">
                    Latest workspace state
                  </p>
                </div>
              </div>
              {assignees.map((person, index) => (
                <div key={person.id} className="flex gap-3">
                  <Avatar
                    name={person.displayName || person.username}
                    index={index}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {person.displayName || person.username} is assigned
                    </p>
                    <p className="mt-1 text-xs text-[#858b82]">
                      Project member
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}
    </SlideOver>
  );
}

function PhaseDrawer({
  darkMode,
  phase,
  tasks,
  users,
  saving,
  editable,
  onChange,
  onClose,
  onSave,
  onDelete,
  onAddTask,
  onOpenTask,
}) {
  const [editMode, setEditMode] = useState(Boolean(phase.__isNew));
  const isEditing = Boolean(editable && (phase.__isNew || editMode));
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <SlideOver
      title={phase.__isNew ? "New phase" : "Phase details"}
      eyebrow="Project schedule"
      onClose={onClose}
      width="max-w-[640px]"
      footer={
        isEditing ? (
          <div className="flex items-center justify-between">
            {phase.__isNew ? (
              <span />
            ) : (
              <Button variant="danger" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={saving || !phase.name.trim()}
                onClick={onSave}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save phase
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {!isEditing ? (
        <PhaseDetailView
          phase={phase}
          tasks={tasks}
          users={users}
          editable={editable}
          onEdit={() => setEditMode(true)}
          onOpenTask={onOpenTask}
        />
      ) : (
      <div className="px-6 pb-8 pt-6 sm:px-7">
        <p className="text-xs font-medium text-[#777d74]">Delivery milestone</p>
        <input
          readOnly={!isEditing}
          value={phase.name || ""}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Phase name"
          className="mt-2 w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none placeholder:text-[#a6aaa3] read-only:cursor-default dark:text-white"
        />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Field label="Start date" icon={CalendarDays}>
            <DatePicker
              darkMode={darkMode}
              disabled={!isEditing}
              value={phase.startDate || ""}
              onChange={(value) => onChange({ startDate: value })}
              placeholder="No start date"
            />
          </Field>
          <Field label="Target date" icon={CalendarDays}>
            <DatePicker
              darkMode={darkMode}
              disabled={!isEditing}
              value={phase.dueDate || ""}
              onChange={(value) => onChange({ dueDate: value })}
              placeholder="No target date"
            />
          </Field>
        </div>
        <Field label="Description" icon={FileText} className="mt-4">
          <textarea
            rows={4}
            readOnly={!isEditing}
            value={phase.description || ""}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="What must be achieved in this phase?"
            className={cn(
              textAreaClass,
              "read-only:cursor-default read-only:bg-[#f4f5f2] dark:read-only:bg-white/[0.025]",
            )}
          />
        </Field>
        {!phase.__isNew && (
          <>
            <section className="mt-7 rounded-xl border border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-[#777d74]">Phase progress</p>
                  <p className="mt-1 text-2xl font-semibold">{progress}%</p>
                </div>
                <p className="text-xs text-[#777d74]">
                  {done} of {tasks.length} tasks done
                </p>
              </div>
              <ProgressBar value={progress} className="mt-3" />
            </section>
            <section className="mt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Tasks in this phase</h4>
                {isEditing && (
                  <Button onClick={onAddTask}>
                    <Plus className="h-4 w-4" />
                    Add task
                  </Button>
                )}
              </div>
              <div className="mt-3 divide-y divide-[#e4e7e1] overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">
                {tasks.map((task, index) => {
                  const names = users
                    .filter((person) =>
                      (task.assigneeIds || []).includes(person.id),
                    )
                    .map((person) => person.displayName || person.username);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-3 py-3"
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          task.status === "done"
                            ? "bg-[#65bf45]"
                            : task.status === "blocked"
                              ? "bg-rose-500"
                              : task.status === "in_progress"
                                ? "bg-amber-400"
                                : "border-2 border-[#9ba096]",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {task.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[#858b82]">
                          {formatDate(task.dueDate)}
                        </span>
                      </span>
                      <AvatarStack names={names} limit={2} key={index} />
                    </div>
                  );
                })}
                {!tasks.length && (
                  <p className="p-7 text-center text-xs text-[#858b82]">
                    No tasks in this phase yet.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
      )}
    </SlideOver>
  );
}

function ProjectEditor({
  darkMode,
  project,
  users,
  saving,
  onChange,
  onClose,
  onSave,
  onDelete,
}) {
  const [section, setSection] = useState("details");
  return (
    <SlideOver
      title={project.id ? "Edit project" : "Create project"}
      eyebrow="Project Control"
      onClose={onClose}
      width="max-w-[700px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          {project.id && onDelete ? (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete project
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              disabled={saving || !project.name.trim()}
              onClick={onSave}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {project.id ? "Save changes" : "Create project"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid min-h-full sm:grid-cols-[160px_minmax(0,1fr)]">
        <nav className="border-b border-[#e3e7e0] bg-[#f2f4f0] p-3 sm:border-b-0 sm:border-r dark:border-white/10 dark:bg-white/[0.025]">
          {[
            ["details", LayoutDashboard, "Details"],
            ["delivery", CalendarDays, "Delivery"],
            ["workspace", FolderOpen, "Workspace"],
          ].map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSection(value)}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                section === value
                  ? "bg-white text-[#20231f] dark:bg-white/10 dark:text-white"
                  : "text-[#686e65] hover:bg-white/60 dark:text-white/45 dark:hover:bg-white/[0.05]",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-5 sm:p-6">
          {section === "details" && (
            <div>
              <h3 className="text-xl font-semibold">Project identity</h3>
              <p className="mt-1 text-sm text-[#777d74]">
                Core information shown across the portfolio and workspace.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Project name">
                  <input
                    value={project.name || ""}
                    onChange={(event) => onChange({ name: event.target.value })}
                    placeholder="e.g. Kalhaar Residence"
                    className={inputClass}
                  />
                </Field>
                <Field label="Project code">
                  <input
                    value={project.code || ""}
                    onChange={(event) => onChange({ code: event.target.value })}
                    placeholder="e.g. KAL-01"
                    className={inputClass}
                  />
                </Field>
                <Field label="Client">
                  <input
                    value={project.client || ""}
                    onChange={(event) =>
                      onChange({ client: event.target.value })
                    }
                    placeholder="Client name"
                    className={inputClass}
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={project.location || ""}
                    onChange={(event) =>
                      onChange({ location: event.target.value })
                    }
                    placeholder="Site location"
                    className={inputClass}
                  />
                </Field>
                <Field label="Project budget">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={project.budget || ""}
                    onChange={(event) =>
                      onChange({ budget: event.target.value })
                    }
                    placeholder="e.g. 5000000"
                    className={inputClass}
                  />
                </Field>
                <Field label="Project manager">
                  <input
                    value={project.manager || ""}
                    onChange={(event) =>
                      onChange({ manager: event.target.value })
                    }
                    placeholder="Responsible person"
                    className={inputClass}
                  />
                </Field>
                <Field label="Linked manager">
                  <NativeSelect
                    darkMode={darkMode}
                    value={project.managerId || ""}
                    onChange={(value) => {
                      const person = users.find((item) => item.id === value);
                      onChange({
                        managerId: value,
                        manager: person?.displayName || project.manager,
                      });
                    }}
                    options={[
                      { value: "", label: "No linked user" },
                      ...users.map((person) => ({
                        value: person.id,
                        label: person.displayName || person.username,
                      })),
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}
          {section === "delivery" && (
            <div>
              <h3 className="text-xl font-semibold">Delivery setup</h3>
              <p className="mt-1 text-sm text-[#777d74]">
                Dates, priority, and health used by reports and project views.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Start date">
                  <DatePicker
                    darkMode={darkMode}
                    value={project.startDate || ""}
                    onChange={(value) => onChange({ startDate: value })}
                    placeholder="No start date"
                  />
                </Field>
                <Field label="Target date">
                  <DatePicker
                    darkMode={darkMode}
                    value={project.targetDate || ""}
                    onChange={(value) => onChange({ targetDate: value })}
                    placeholder="No target date"
                  />
                </Field>
                <Field label="Priority">
                  <NativeSelect
                    darkMode={darkMode}
                    value={project.priority || "medium"}
                    onChange={(value) => onChange({ priority: value })}
                    options={PRIORITY_OPTIONS}
                  />
                </Field>
                <Field label="Health">
                  <NativeSelect
                    darkMode={darkMode}
                    value={project.health || "green"}
                    onChange={(value) => onChange({ health: value })}
                    options={HEALTH_OPTIONS}
                  />
                </Field>
                <Field label="Project status" className="sm:col-span-2">
                  <NativeSelect
                    darkMode={darkMode}
                    value={project.status || "active"}
                    onChange={(value) => onChange({ status: value })}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "on_hold", label: "On hold" },
                      { value: "closed", label: "Closed" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}
          {section === "workspace" && (
            <div>
              <h3 className="text-xl font-semibold">Connected workspace</h3>
              <p className="mt-1 text-sm text-[#777d74]">
                Link Drive and define alternate names used in imported reports.
              </p>
              <div className="mt-6 space-y-4">
                <Field label="Google Drive folder" icon={FolderOpen}>
                  <input
                    value={project.driveFolderLink || ""}
                    onChange={(event) =>
                      onChange({ driveFolderLink: event.target.value })
                    }
                    placeholder="https://drive.google.com/drive/folders/..."
                    className={inputClass}
                  />
                </Field>
                <Field label="Aliases" hint="Comma separated">
                  <input
                    value={(project.aliases || []).join(", ")}
                    onChange={(event) =>
                      onChange({
                        aliases: event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Alternate project names"
                    className={inputClass}
                  />
                </Field>
                <div className="rounded-xl border border-[#dfe3dc] bg-[#f5f7f3] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-semibold">Workspace summary</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white px-2 py-3 dark:bg-white/[0.05]">
                      <p className="text-lg font-semibold">
                        {(project.phases || []).length}
                      </p>
                      <p className="text-[10px] text-[#858b82]">Phases</p>
                    </div>
                    <div className="rounded-lg bg-white px-2 py-3 dark:bg-white/[0.05]">
                      <p className="text-lg font-semibold">
                        {(project.tasks || []).length +
                          (project.phases || []).flatMap(
                            (phase) => phase.tasks || [],
                          ).length}
                      </p>
                      <p className="text-[10px] text-[#858b82]">Tasks</p>
                    </div>
                    <div className="rounded-lg bg-white px-2 py-3 dark:bg-white/[0.05]">
                      <p className="text-lg font-semibold">
                        {(project.projectDocuments || []).length}
                      </p>
                      <p className="text-[10px] text-[#858b82]">Files</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

function FileDrawer({
  darkMode,
  form,
  editing,
  canUpload,
  uploading,
  onChange,
  onClose,
  onAddLink,
  onUpload,
}) {
  return (
    <SlideOver
      title={editing ? "Edit project file" : "Add project file"}
      eyebrow="Documents"
      onClose={onClose}
      width="max-w-[520px]"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!form.url.trim()}
            onClick={onAddLink}
          >
            {editing ? (
              <Save className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {editing ? "Save file" : "Add link"}
          </Button>
        </div>
      }
    >
      <div className="px-6 py-6">
        <h3 className="text-xl font-semibold">
          {editing ? "Update file details" : "Connect a document"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-[#737970]">
          {editing
            ? "Edit the project file name, category, or link."
            : "Paste a document link or upload a file to the project's connected Google Drive folder."}
        </p>
        <div className="mt-6 space-y-4">
          <Field label="Category">
            <NativeSelect
              darkMode={darkMode}
              value={form.category}
              onChange={(value) => onChange({ category: value })}
              options={DOC_CATEGORIES.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field label="Document name">
            <input
              value={form.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="e.g. Approved drawing"
              className={inputClass}
            />
          </Field>
          <Field label="Drive or document link">
            <input
              value={form.url}
              onChange={(event) => onChange({ url: event.target.value })}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
        </div>
        {!editing && (
          <>
            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[#93988f]">
              <span className="h-px flex-1 bg-[#e1e5de]" />
              or upload
              <span className="h-px flex-1 bg-[#e1e5de]" />
            </div>
            <label
              className={cn(
                "flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition",
                canUpload
                  ? "cursor-pointer border-[#a9c99c] bg-[#f2f9ef] hover:bg-[#edf7e9] dark:border-green-400/30 dark:bg-green-400/[0.05]"
                  : "cursor-not-allowed border-[#d5d9d2] bg-[#f5f6f4] text-[#a0a59d] dark:border-white/10 dark:bg-white/[0.02]",
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-white/10">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
              </span>
              <span className="mt-3 text-sm font-semibold">
                {uploading
                  ? "Uploading to Drive..."
                  : "Choose a file to upload"}
              </span>
              <span className="mt-1 text-xs text-[#858b82]">
                PDF, image, spreadsheet, or supporting document
              </span>
              <input
                type="file"
                className="hidden"
                disabled={!canUpload || uploading}
                onChange={onUpload}
              />
            </label>
            {!canUpload && (
              <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Connect a Drive folder in project settings before uploading
                files.
              </p>
            )}
          </>
        )}
      </div>
    </SlideOver>
  );
}

function TeamDrawer({ project, tasks, users, onClose }) {
  const members = projectTeamMembers(project, tasks, users);
  return (
    <SlideOver
      title="Project team"
      eyebrow={project.name}
      onClose={onClose}
      width="max-w-[520px]"
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="px-6 py-6">
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7d837a] dark:text-white/45">
                Total team
              </p>
              <h3 className="mt-1 text-2xl font-bold small">
                {members.length} {members.length === 1 ? "member" : "members"}
              </h3>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dff6d7] text-[#367b25] dark:bg-[#d8f36a]/12 dark:text-[#d8f36a]">
              <Users className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {members.map((member, index) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
            >
              <Avatar name={member.name} index={index} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{member.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#7d837a] dark:text-white/45">
                  {member.username || member.role}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-[#eef1ec] px-2.5 py-1 text-[11px] font-semibold text-[#5f675b] dark:bg-white/10 dark:text-white/70">
                  {member.role}
                </span>
                <p className="mt-1 text-[10px] text-[#8a9087]">
                  {member.taskCount} tasks
                </p>
              </div>
            </div>
          ))}
          {!members.length && (
            <div className="rounded-2xl border border-dashed border-[#d7dcd3] px-4 py-10 text-center dark:border-white/10">
              <UserRound className="mx-auto h-7 w-7 text-[#9ca199]" />
              <p className="mt-3 text-sm font-semibold">No team members yet</p>
              <p className="mt-1 text-xs text-[#858b82]">
                Assign people to tasks or set a project manager.
              </p>
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

function ProjectAccessDrawer({
  project,
  phases,
  tasks,
  users,
  access,
  canManage,
  saving,
  onSave,
  onClose,
}) {
  const [draft, setDraft] = useState(access || []);
  const [form, setForm] = useState({
    userId: "",
    scope: "project",
    phaseId: "",
    taskId: "",
    permission: "view",
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  function addAccess() {
    if (!form.userId) return;
    const entry = {
      id: uid("access"),
      userId: form.userId,
      scope: form.scope,
      phaseId: form.scope === "phase" ? form.phaseId : "",
      taskId: form.scope === "task" ? form.taskId : "",
      permission: form.permission,
      createdAt: new Date().toISOString(),
    };
    setDraft((current) => [...current, entry]);
    setForm({ userId: "", scope: "project", phaseId: "", taskId: "", permission: "view" });
  }

  function updateEntry(id, patch) {
    setDraft((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function removeEntry(id) {
    setDraft((current) => current.filter((entry) => entry.id !== id));
  }

  function scopeLabel(entry) {
    if (entry.scope === "phase") return phases.find((phase) => phase.id === entry.phaseId)?.name || "Phase";
    if (entry.scope === "task") return tasks.find((task) => task.id === entry.taskId)?.title || "Task";
    return project.name;
  }

  return (
    <SlideOver
      title="Project access"
      eyebrow={project.name}
      onClose={onClose}
      width="max-w-[620px]"
      footer={
        <div className="flex justify-between gap-3">
          <Button onClick={onClose}>Close</Button>
          {canManage && (
            <Button variant="primary" disabled={saving} onClick={() => onSave(draft)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save access
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5 px-6 py-6">
        <section className="rounded-2xl  border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#80ed99] text-[#000000]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold">Allowed people only</h3>
              <p className="mt-1 text-xs leading-5 text-[#747a71] dark:text-white/50">
                Task assignees automatically get access to their task and phase context. Use this panel to delegate broader project, phase, or task permissions.
              </p>
            </div>
          </div>
        </section>

        {canManage && (
          <section className="rounded-2xl  border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <h3 className="text-sm font-bold">Add access</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <NativeSelect
                value={form.userId}
                onChange={(userId) => setForm((current) => ({ ...current, userId }))}
                options={[
                  { value: "", label: "Select person" },
                  ...users.map((user) => ({ value: user.id, label: user.displayName || user.username })),
                ]}
              />
              <NativeSelect
                value={form.permission}
                onChange={(permission) => setForm((current) => ({ ...current, permission }))}
                options={[
                  { value: "view", label: "View" },
                  { value: "edit", label: "Edit" },
                  { value: "manage", label: "Manage access" },
                ]}
              />
              <NativeSelect
                value={form.scope}
                onChange={(scope) => setForm((current) => ({ ...current, scope }))}
                options={[
                  { value: "project", label: "Full project" },
                  { value: "phase", label: "Phase only" },
                  { value: "task", label: "Task only" },
                ]}
              />
              {form.scope === "phase" && (
                <NativeSelect
                  value={form.phaseId}
                  onChange={(phaseId) => setForm((current) => ({ ...current, phaseId }))}
                  options={[
                    { value: "", label: "Select phase" },
                    ...phases.map((phase) => ({ value: phase.id, label: phase.name || "Untitled phase" })),
                  ]}
                />
              )}
              {form.scope === "task" && (
                <NativeSelect
                  value={form.taskId}
                  onChange={(taskId) => setForm((current) => ({ ...current, taskId }))}
                  options={[
                    { value: "", label: "Select task" },
                    ...tasks.map((task) => ({ value: task.id, label: task.title || "Untitled task" })),
                  ]}
                />
              )}
            </div>
            <Button
              variant="primary"
              className="mt-4"
              disabled={!form.userId || (form.scope === "phase" && !form.phaseId) || (form.scope === "task" && !form.taskId)}
              onClick={addAccess}
            >
              <UserPlus className="h-4 w-4" />
              Add person
            </Button>
          </section>
        )}

        <section className="space-y-2">
          {draft.map((entry, index) => {
            const person = userMap.get(entry.userId);
            return (
              <div key={entry.id} className="rounded-2xl  border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex items-start gap-3">
                  <Avatar name={person?.displayName || person?.username || "User"} index={index} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{person?.displayName || person?.username || entry.userId}</p>
                    <p className="mt-1 text-xs text-[#747a71] dark:text-white/50">
                      {entry.permission} access · {entry.scope} · {scopeLabel(entry)}
                    </p>
                    {canManage && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <NativeSelect
                          value={entry.permission}
                          onChange={(permission) => updateEntry(entry.id, { permission })}
                          options={[
                            { value: "view", label: "View" },
                            { value: "edit", label: "Edit" },
                            { value: "manage", label: "Manage access" },
                          ]}
                        />
                        <Button variant="danger" onClick={() => removeEntry(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!draft.length && (
            <div className="rounded-2xl border border-dashed border-[#d7dcd3] px-4 py-10 text-center dark:border-white/10">
              <ShieldCheck className="mx-auto h-7 w-7 text-[#9ca199]" />
              <p className="mt-3 text-sm font-semibold">No delegated access yet</p>
              <p className="mt-1 text-xs text-[#858b82]">Task assignees still receive task-level access automatically.</p>
            </div>
          )}
        </section>
      </div>
    </SlideOver>
  );
}

function PortfolioView({
  darkMode,
  projects,
  users,
  search,
  onSearch,
  layout,
  onLayout,
  refreshing,
  isSuperAdmin,
  onRefresh,
  onCreate,
  onOpen,
}) {
  const totalTasks = projects.reduce(
    (sum, project) => sum + (project.metrics?.totalTasks || 0),
    0,
  );
  const completed = projects.reduce(
    (sum, project) => sum + (project.metrics?.completed || 0),
    0,
  );
  const atRisk = projects.filter(
    (project) =>
      project.health === "red" || (project.metrics?.blocked || 0) > 0,
  ).length;
  const progress = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto",
        darkMode ? "bg-[#10120f] text-white" : "bg-[#f4f5f2] text-[#20231f]",
      )}
    >
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#65984f]">
              <Sparkles className="h-3.5 w-3.5" />
              PROJECT CONTROL
            </div>
            <h1 className="mt-2 text-3xl font-semibold small tracking-[-0.035em] sm:text-4xl">
              Projects, clearly organized.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#71776e] dark:text-white/45">
              Plan delivery, manage tasks, coordinate people, and keep every
              project file in one focused workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 rounded-xl h-4 w-4 -translate-y-1/2 text-[#858b82]" />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search projects"
                className={cn(inputClass, "pl-9 h-12 rounded-xl sm:w-[270px]")}
              />
            </div>
            <Button onClick={onRefresh} disabled={refreshing}>
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
              Refresh
            </Button>
            {isSuperAdmin && (
              <Button variant="primary" onClick={onCreate}>
                <Plus className="h-4 w-4" />
                New project
              </Button>
            )}
          </div>
        </header>

        <section className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl  border-[#dfe3dc] bg-white xl:grid-cols-4 dark:border-white/10 dark:bg-white/[0.03]">
          {[
            [FolderKanban, "Active projects", projects.length],
            [ListChecks, "Open tasks", Math.max(0, totalTasks - completed)],
            [AlertCircle, "Projects at risk", atRisk],
            [BarChart3, "Portfolio progress", `${progress}%`],
          ].map(([Icon, label, value], index) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-4 px-5 py-4",
                index > 0 && "border-t border-[#e6e9e3]",
                index % 2 === 1 && "border-l",
                index > 1 && "border-t",
                index === 1 && "border-t-0",
                index === 2 && "border-l-0 xl:border-l xl:border-t-0",
                index === 3 && "xl:border-t-0",
                "dark:border-white/10",
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f3ed] text-[#5e6759] dark:bg-white/[0.06] dark:text-white/60">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-[#777d74] dark:text-white/45">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Project portfolio</h2>
              <p className="mt-0.5 text-xs text-[#7b8178]">
                {projects.length} visible{" "}
                {projects.length === 1 ? "project" : "projects"}
              </p>
            </div>
            <div className="flex rounded-xl  border-[#dfe3dc] bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
              <IconButton
                label="Grid view"
                className={
                  layout === "grid"
                    ? "bg-[#eef1ec] text-black dark:bg-white/10 dark:text-white"
                    : ""
                }
                onClick={() => onLayout("grid")}
              >
                <Grid2X2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="List view"
                className={
                  layout === "list"
                    ? "bg-[#eef1ec] text-black dark:bg-white/10 dark:text-white"
                    : ""
                }
                onClick={() => onLayout("list")}
              >
                <List className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          {!projects.length ? (
            <div className="mt-4 rounded-xl  border-dashed border-[#cfd5cc] bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.02]">
              <FolderKanban className="mx-auto h-8 w-8 text-[#969c93]" />
              <h3 className="mt-3 text-base font-semibold">
                No projects found
              </h3>
              <p className="mt-1 text-sm text-[#7b8178]">
                Try another search or create a new project.
              </p>
            </div>
          ) : layout === "grid" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, projectIndex) => {
                const tasks = project.manualTasks || [];
                const memberNames = [
                  ...new Set(
                    [
                      project.manager,
                      ...tasks.flatMap((task) =>
                        (task.assigneeIds || []).map(
                          (id) =>
                            users.find((person) => person.id === id)
                              ?.displayName || id,
                        ),
                      ),
                    ].filter(Boolean),
                  ),
                ];
                const projectProgress = project.metrics?.progress || 0;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpen(project)}
                    className="group rounded-2xl  border-[#dfe3dc] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b8c4b3] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                            projectIndex % 3 === 0
                              ? "bg-[#348a70]"
                              : projectIndex % 3 === 1
                                ? "bg-[#687ac6]"
                                : "bg-[#9b704f]",
                          )}
                        >
                          {initials(project.name)}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold">
                            {project.name}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-[#7e847b]">
                            {project.client ||
                              project.location ||
                              "Project workspace"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="mt-2 h-4 w-4 text-[#9aa097] transition group-hover:translate-x-0.5 group-hover:text-black" />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-semibold",
                          project.health === "red"
                            ? "bg-rose-50 text-rose-600"
                            : project.health === "yellow"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700",
                        )}
                      >
                        {HEALTH_OPTIONS.find(
                          (item) => item.value === project.health,
                        )?.label || "On track"}
                      </span>
                      {project.code && (
                        <span className="rounded-full bg-[#f1f3ef] px-2 py-1 text-[10px] text-[#686e65] dark:bg-white/[0.06] dark:text-white/55">
                          {project.code}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-[#858b82]">
                        {formatRelativeDate(project.targetDate)}
                      </span>
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-[#777d74]">Progress</span>
                        <span className="font-semibold">
                          {projectProgress}%
                        </span>
                      </div>
                      <ProgressBar value={projectProgress} />
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-[#eceeea] pt-3 dark:border-white/10">
                      <AvatarStack names={memberNames} />
                      <div className="flex items-center gap-3 text-[11px] text-[#7d837a]">
                        <span>{project.metrics?.totalTasks || 0} tasks</span>
                        <span>{project.metrics?.documents || 0} files</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
              <div className="hidden grid-cols-[minmax(240px,1.5fr)_160px_140px_180px_120px_40px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]">
                <span>Project</span>
                <span>Manager</span>
                <span>Health</span>
                <span>Progress</span>
                <span>Target</span>
                <span />
              </div>
              {projects.map((project, index) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpen(project)}
                  className="grid w-full gap-3 border-b border-[#eceeea] px-4 py-3 text-left last:border-0 hover:bg-[#f8f9f6] md:grid-cols-[minmax(240px,1.5fr)_160px_140px_180px_120px_40px] md:items-center dark:border-white/10 dark:hover:bg-white/[0.03]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white",
                        index % 2 ? "bg-[#687ac6]" : "bg-[#348a70]",
                      )}
                    >
                      {initials(project.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {project.name}
                      </span>
                      <span className="block truncate text-[11px] text-[#858b82]">
                        {project.client || project.location || project.code}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-[#686e65] dark:text-white/55">
                    {project.manager || "Unassigned"}
                  </span>
                  <span className="text-xs capitalize">
                    {HEALTH_OPTIONS.find(
                      (item) => item.value === project.health,
                    )?.label || "On track"}
                  </span>
                  <span className="flex items-center gap-3">
                    <ProgressBar
                      value={project.metrics?.progress || 0}
                      className="flex-1"
                    />
                    <span className="w-8 text-xs font-semibold">
                      {project.metrics?.progress || 0}%
                    </span>
                  </span>
                  <span className="text-xs text-[#686e65] dark:text-white/55">
                    {formatDate(project.targetDate)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#969c93]" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const WORKSPACE_NAV = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "phases", label: "Phases", icon: Layers3 },
  { value: "tasks", label: "Tasks", icon: ListChecks },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "manpower", label: "Manpower", icon: Users },
  { value: "mrn", label: "MRN", icon: ClipboardList },
  { value: "stock", label: "Stock", icon: PackageSearch },
  { value: "chat", label: "Chat", icon: MessageSquare },
  { value: "activity", label: "Activity", icon: Clock3 },
  { value: "files", label: "Files", icon: FolderOpen },
];

function WorkspaceRail({ project, view, onView, tasks, documents, users, onOpenTeam, navItems = WORKSPACE_NAV, unreadCounts = {} }) {
  const members = projectTeamMembers(project, tasks, users);
  const memberNames = members.map((member) => member.name);
  return (
    <aside className="hidden w-[220px] shrink-0 flex-col  border-[#e0e4dd] bg-[#f0f2ee] px-3 py-4 md:flex dark:border-white/10 dark:bg-[#121511]">
      <div className="px-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#348a70] text-xs font-bold text-white">
            {initials(project.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-md small font-semibold">{project.name}</h2>
            <p className="truncate text-[10px] text-[#7b8178]">
              {project.code || "Project workspace"}
            </p>
          </div>
        </div>
      </div>
      <nav className="mt-6 space-y-1">
        {navItems.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onView(value)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
              view === value
                ? "bg-white font-semibold text-[#20231f] dark:bg-white/10 dark:text-white"
                : "text-[#62685f] hover:bg-white/60 dark:text-white/45 dark:hover:bg-white/[0.05]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {value === "tasks" && (
              <span className="text-[10px] text-[#8a9087]">{tasks.length}</span>
            )}
            {value === "files" && (
              <span className="text-[10px] text-[#8a9087]">
                {documents.length}
              </span>
            )}
            {value === "chat" && unreadCounts.chat > 0 && (
              <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold text-white", unreadCounts.chatMentions > 0 ? "bg-[#65bf45]" : "bg-[#2f7cff]")}>
                {unreadCounts.chatMentions > 0 ? "@" : unreadCounts.chat > 99 ? "99+" : unreadCounts.chat}
              </span>
            )}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={onOpenTeam}
        className="mt-6 w-full rounded-2xl border-t border-[#dce0d8] px-0 pb-3 pt-5 text-left transition hover:bg-white/45 dark:border-white/10 dark:hover:bg-white/[0.04]"
      >
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949a91]">
          Project team
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 px-3">
          <AvatarStack names={memberNames} />
          <UserPlus className="h-4 w-4 text-[#8a9087]" />
        </div>
        <p className="mt-2 px-3 text-[11px] text-[#7d837a]">
          {members.length || 0} active members
        </p>
      </button>
    </aside>
  );
}

function OverviewView({
  project,
  tasks,
  phases,
  documents,
  users,
  isSuperAdmin,
  onOpenTask,
  onAddTask,
  onOpenPhase,
}) {
  const done = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const progress = tasks.length
    ? Math.round((done / tasks.length) * 100)
    : project.metrics?.progress || 0;
  const recent = [...tasks]
    .sort((a, b) =>
      String(b.updatedAt || b.createdAt || b.dueDate || "").localeCompare(
        String(a.updatedAt || a.createdAt || a.dueDate || ""),
      ),
    )
    .slice(0, 6);
  return (
    <div className="mx-auto max-w-[1250px] p-4 sm:p-6">
      <section className="rounded-2xl  border-[#dfe3dc] bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#e8f6e3] px-2.5 py-1 text-[10px] font-semibold text-[#3e7c2d]">
                {HEALTH_OPTIONS.find((item) => item.value === project.health)
                  ?.label || "On track"}
              </span>
              <PriorityPill priority={project.priority} />
            </div>
            <h2 className="mt-3 text-3xl small font-semibold tracking-[-0.025em]">
              {project.name}
            </h2>
            <p className="mt-1 text-sm text-[#72786f]">
              {project.client || "Client not set"}
              {project.location ? ` · ${project.location}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [Sparkles, "Progress", `${progress}%`, STAT_TONES.green],
              [CheckCircle2, "Tasks done", `${done}/${tasks.length}`, STAT_TONES.blue],
              [AlertCircle, "Blocked", blocked, STAT_TONES.rose],
              [CalendarDays, "Target", formatDate(project.targetDate), STAT_TONES.amber],
            ].map(([Icon, label, value, badgeClass]) => (
              <div
                key={label}
                className={cn(
                  "min-w-[118px] rounded-[22px] px-4 py-3",
                  badgeClass,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                    {label}
                  </p>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/55 text-current dark:bg-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <section className="rounded-2xl  border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <header className="flex items-center justify-between border-b border-[#e5e8e2] px-4 py-3 dark:border-white/10">
            <div>
              <h3 className="text-sm font-semibold">Recent work</h3>
              <p className="mt-0.5 text-[11px] text-[#858b82]">
                Latest tasks across the project
              </p>
            </div>
            {isSuperAdmin && (
              <Button onClick={onAddTask}>
                <Plus className="h-4 w-4" />
                Add task
              </Button>
            )}
          </header>
          <div className="divide-y divide-[#e9ebe7] dark:divide-white/10">
            {recent.map((task, index) => {
              const names = users
                .filter((person) =>
                  (task.assigneeIds || []).includes(person.id),
                )
                .map((person) => person.displayName || person.username);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_110px_90px] items-center gap-3 px-4 py-3 text-left hover:bg-[#f8f9f6] dark:hover:bg-white/[0.025]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        task.status === "done"
                          ? "bg-[#dcf5d4] text-[#4d9d36]"
                          : task.status === "blocked"
                            ? "bg-rose-50 text-rose-500"
                            : "bg-[#eef0ec] text-[#747a71]",
                      )}
                    >
                      {task.status === "done" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {task.title || "Untitled task"}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#858b82]">
                        {phases.find((phase) => phase.id === task.phaseId)
                          ?.name || "No phase"}
                      </span>
                    </span>
                  </span>
                  <AvatarStack names={names} limit={3} key={index} />
                  <span className="text-right text-[11px] text-[#777d74]">
                    {formatDate(task.dueDate, "No date")}
                  </span>
                </button>
              );
            })}
            {!recent.length && (
              <p className="px-5 py-12 text-center text-xs text-[#858b82]">
                No project tasks yet.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-2xl  border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <header className="border-b border-[#e5e8e2] px-4 py-3 dark:border-white/10">
            <h3 className="text-sm font-semibold">Delivery phases</h3>
            <p className="mt-0.5 text-[11px] text-[#858b82]">
              Milestone progress
            </p>
          </header>
          <div className="space-y-1 p-2">
            {phases.map((phase, index) => {
              const phaseTasks = tasks.filter(
                (task) => task.phaseId === phase.id,
              );
              const phaseDone = phaseTasks.filter(
                (task) => task.status === "done",
              ).length;
              const phaseProgress = phaseTasks.length
                ? Math.round((phaseDone / phaseTasks.length) * 100)
                : 0;
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => onOpenPhase(phase)}
                  className="w-full rounded-lg p-3 text-left hover:bg-[#f6f8f4] dark:hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#eef6eb] text-[10px] font-bold text-[#568443]">
                        {index + 1}
                      </span>
                      <span className="truncate text-xs font-semibold">
                        {phase.name}
                      </span>
                    </span>
                    <span className="text-[10px] text-[#858b82]">
                      {phaseProgress}%
                    </span>
                  </div>
                  <ProgressBar value={phaseProgress} className="mt-2.5" />
                </button>
              );
            })}
            {!phases.length && (
              <p className="p-6 text-center text-xs text-[#858b82]">
                No phases yet.
              </p>
            )}
          </div>
          <div className="border-t border-[#e5e8e2] px-4 py-3 text-[11px] text-[#777d74] dark:border-white/10">
            <div className="flex justify-between">
              <span>Connected files</span>
              <strong className="text-[#30342e] dark:text-white">
                {documents.length}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TasksView({
  darkMode,
  tasks,
  phases,
  users,
  isSuperAdmin,
  onOpenTask,
  onAddTask,
}) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const filtered = tasks.filter((task) => {
    const matchesQuery =
      !query ||
      `${task.title} ${task.description}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesPriority = priority === "all" || task.priority === priority;
    const matchesAssignee =
      assignee === "all" || (task.assigneeIds || []).includes(assignee);
    return matchesQuery && matchesPriority && matchesAssignee;
  });
  return (
    <div className="mx-auto max-w-[1350px] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">All tasks</h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            Filter, scan, and update every project task.
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            variant="primary"
            className="!h-8 !rounded-full !px-2.5 !text-[11px] !font-semibold shadow-sm"
            onClick={() => onAddTask()}
          >
            <Plus className="h-3 w-3" />
            New task
          </Button>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#878d84]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter tasks..."
            className={cn(inputClass, "pl-9")}
          />
        </div>
        <div className="min-w-[180px]">
          <SelectMenu
            darkMode={darkMode}
            value={priority}
            onChange={setPriority}
            options={[
              { value: "all", label: "All priorities" },
              ...PRIORITY_OPTIONS,
            ]}
          />
        </div>
        <div className="min-w-[200px]">
          <SelectMenu
            darkMode={darkMode}
            value={assignee}
            onChange={setAssignee}
            options={[
              { value: "all", label: "All assignees" },
              ...users.map((person) => ({
                value: person.id,
                label: person.displayName || person.username,
              })),
            ]}
          />
        </div>
      </div>
      <section className="mt-4 overflow-x-auto rounded-2xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <div className="hidden min-w-[940px] grid-cols-[340px_145px_150px_150px_120px] gap-3 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]">
          <span>Task</span>
          <span>Phase</span>
          <span>Assigned to</span>
          <span>Status</span>
          <span>Due date</span>
        </div>
        {filtered.map((task, index) => {
          const assigneeNames = users
            .filter((person) => (task.assigneeIds || []).includes(person.id))
            .map((person) => person.displayName || person.username);
          const overdue =
            task.dueDate &&
            new Date(`${task.dueDate}T00:00:00`) < new Date() &&
            task.status !== "done";
          const isBlockedByDependency = (task.blockedBy || []).length > 0;
          const hasDependencyWarning = (task.dependencyWarnings || []).length > 0;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task)}
              className="grid min-w-[940px] grid-cols-[340px_145px_150px_150px_120px] items-start gap-3 border-b border-[#eceeea] px-4 py-5 text-left text-sm last:border-0 hover:bg-[#fafbf9] dark:border-white/10 dark:hover:bg-white/[0.025]"
            >
              <span className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2",
                    task.status === "done"
                      ? "border-[#62bd43] bg-[#62bd43]"
                      : task.status === "blocked"
                        ? "border-rose-500"
                        : task.status === "in_progress"
                          ? "border-amber-400"
                          : "border-[#a5aaa1]",
                  )}
                />
                <span className="flex min-h-[40px] min-w-0 flex-col">
                  <span className="block truncate font-medium">
                    {task.title || "Untitled task"}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block h-4 max-w-[260px] truncate text-[11px] leading-4 text-[#858b82]",
                      !task.description && !isBlockedByDependency && !hasDependencyWarning && "invisible",
                      isBlockedByDependency && "font-semibold text-rose-500",
                      hasDependencyWarning && !isBlockedByDependency && "font-semibold text-amber-600",
                    )}
                  >
                    {isBlockedByDependency
                      ? `Blocked by ${(task.blockedBy || []).map((item) => item.title).join(", ")}`
                      : hasDependencyWarning
                        ? "Due date is before a dependency"
                        : task.description || "Description placeholder"}
                  </span>
                </span>
              </span>
              <span className="truncate pt-0.5 text-xs text-[#6e746b] dark:text-white/50">
                {phases.find((phase) => phase.id === task.phaseId)?.name ||
                  "No phase"}
              </span>
              <span className="block min-h-8 min-w-0">
                {assigneeNames.length ? (
                  <AvatarStack names={assigneeNames} limit={3} key={index} />
                ) : (
                  <span className="invisible block h-8 w-8">Unassigned</span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <StatusPill status={isBlockedByDependency ? "blocked" : task.status || "todo"} compact />
                <PriorityPill priority={task.priority} />
              </span>
              <span
                className={cn(
                  "pt-0.5 text-xs",
                  overdue ? "font-semibold text-rose-500" : "text-[#747a71]",
                )}
              >
                {formatDate(task.dueDate, "No date")}
              </span>
            </button>
          );
        })}
        {!filtered.length && (
          <div className="px-6 py-16 text-center">
            <ListChecks className="mx-auto h-7 w-7 text-[#9ca199]" />
            <h3 className="mt-3 text-sm font-semibold">No matching tasks</h3>
            <p className="mt-1 text-xs text-[#858b82]">
              Adjust the filters or create a new task.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function PhasesView({
  phases,
  tasks,
  isSuperAdmin,
  onOpenPhase,
  onAddPhase,
  onAddTask,
}) {
  return (
    <div className="mx-auto max-w-[1250px] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project timeline</h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            Phases, deadlines, and task completion.
          </p>
        </div>
        {isSuperAdmin && (
          <Button variant="primary" onClick={onAddPhase}>
            <Plus className="h-4 w-4" />
            New phase
          </Button>
        )}
      </div>
      <section className="mt-5 overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <div className="hidden grid-cols-[56px_minmax(240px,1.5fr)_160px_130px_180px_100px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]">
          <span>#</span>
          <span>Phase</span>
          <span>Delivery</span>
          <span>Tasks</span>
          <span>Progress</span>
          <span />
        </div>
        {phases.map((phase, index) => {
          const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
          const done = phaseTasks.filter(
            (task) => task.status === "done",
          ).length;
          const blocked = phaseTasks.filter(
            (task) => task.status === "blocked",
          ).length;
          const progress = phaseTasks.length
            ? Math.round((done / phaseTasks.length) * 100)
            : 0;
          return (
            <div
              key={phase.id}
              className="grid gap-3 border-b border-[#e9ebe7] px-4 py-4 last:border-0 md:grid-cols-[56px_minmax(240px,1.5fr)_160px_130px_180px_100px] md:items-center dark:border-white/10"
            >
              <button
                type="button"
                onClick={() => onOpenPhase(phase)}
                className="contents text-left"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ecf5e8] text-xs font-bold text-[#568443]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {phase.name || "Untitled phase"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#858b82]">
                    {phase.description || "No description added"}
                  </span>
                </span>
                <span>
                  <span className="block text-[10px] text-[#858b82]">
                    Target date
                  </span>
                  <span className="mt-0.5 block text-xs font-medium">
                    {formatDate(phase.dueDate)}
                  </span>
                </span>
                <span>
                  <span className="text-sm font-semibold">
                    {done}/{phaseTasks.length}
                  </span>
                  <span
                    className={cn(
                      "ml-2 text-[10px]",
                      blocked ? "text-rose-500" : "text-[#858b82]",
                    )}
                  >
                    {blocked ? `${blocked} blocked` : "complete"}
                  </span>
                </span>
                <span>
                  <span className="flex justify-between text-[10px]">
                    <span>{progress}%</span>
                    <span className="text-[#858b82]">
                      {phaseTasks.length ? "active" : "not started"}
                    </span>
                  </span>
                  <ProgressBar value={progress} className="mt-2" />
                </span>
              </button>
              <span className="flex justify-end">
                {isSuperAdmin && (
                  <Button onClick={() => onAddTask(phase.id)}>
                    <Plus className="h-3.5 w-3.5" />
                    Task
                  </Button>
                )}
              </span>
            </div>
          );
        })}
        {!phases.length && (
          <p className="px-6 py-14 text-center text-sm text-[#858b82]">
            No phases created yet.
          </p>
        )}
      </section>
    </div>
  );
}

function normalizeProjectReference(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactProjectReference(value) {
  const compact = comparableProjectText(value).replace(/\s+/g, "").replace(/([aeiou])\1+/g, "$1");
  const aliases = {
    devsharnam: "devsharnam",
    devsharanam: "devsharnam",
    devssharnam: "devsharnam",
    devsaranam: "devsharnam",
  };
  return aliases[compact] || compact;
}

function comparableProjectText(value = "") {
  const text = String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bfarm\s+house\b/g, "farmhouse")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(/\s+/g, "");
  const aliases = {
    kalhar: "kalhaar",
    kalhaar: "kalhaar",
    farmhouse: "serenitymeadowsfarmhouse",
    serenitymeadowsfarm: "serenitymeadowsfarmhouse",
    serenitymeadowsfarmhouse: "serenitymeadowsfarmhouse",
    gharana: "gharana",
    sgharana: "gharana",
    sheetalgharana: "gharana",
  };
  return aliases[compact] || text;
}

function comparableTradeText(value = "") {
  const text = comparableProjectText(value);
  const compact = text.replace(/\s+/g, "");
  const aliases = {
    ac: "ac",
    aircondition: "ac",
    airconditioning: "ac",
    airconditioner: "ac",
    airconditioners: "ac",
  };
  return aliases[compact] || compact;
}

function mrnMatchesProject(row, project) {
  const rowProject = compactProjectReference(row.project);
  if (!rowProject) return false;
  const candidates = [project.name, project.code]
    .map(compactProjectReference)
    .filter(Boolean);
  return candidates.some(
    (candidate) =>
      rowProject === candidate ||
      rowProject.includes(candidate) ||
      candidate.includes(rowProject),
  );
}

function dmrMatchesProject(value, project) {
  const rowProject = comparableProjectText(value);
  const compactRowProject = rowProject.replace(/\s+/g, "");
  if (!rowProject) return false;
  const candidates = [project.name, project.code, project.location]
    .map(comparableProjectText)
    .filter(Boolean);
  return candidates.some(
    (candidate) => {
      const compactCandidate = candidate.replace(/\s+/g, "");
      return (
      rowProject === candidate ||
        compactRowProject === compactCandidate ||
        rowProject.includes(candidate) ||
        candidate.includes(rowProject) ||
        compactRowProject.includes(compactCandidate) ||
        compactCandidate.includes(compactRowProject)
      );
    },
  );
}

function mrnAmount(value) {
  const amount = Number(String(value || "").replace(/,/g, "")) || 0;
  return amount ? `Rs ${amount.toLocaleString("en-IN")}` : "Rs 0";
}

function manpowerNumber(value) {
  return Number(value) || 0;
}

function manpowerProgress(planned, actual) {
  const plannedValue = manpowerNumber(planned);
  const actualValue = manpowerNumber(actual);
  if (!plannedValue) return actualValue ? 100 : 0;
  return Math.min(100, Math.round((actualValue / plannedValue) * 100));
}

function projectManpowerRows(records = [], project) {
  const grouped = new Map();
  records
    .filter((record) => dmrMatchesProject(record.site, project))
    .forEach((record) => {
      const key = `${record.agency || "Agency not added"}|${record.trade || record.category || "Trade not added"}`;
      const item = grouped.get(key) || {
        agency: record.agency || "Agency not added",
        trade: record.trade || record.category || "Trade not added",
        planned: 0,
        actual: 0,
      };
      item.planned += manpowerNumber(record.planned);
      item.actual += manpowerNumber(record.actual);
      grouped.set(key, item);
    });
  return [...grouped.values()].sort((a, b) => b.actual - a.actual || b.planned - a.planned);
}

function projectPlanRows(plan, project) {
  const rows = new Map();
  const rowKey = (site, trade) => `${comparableProjectText(site)}|${comparableTradeText(trade)}`;

  (plan?.records || [])
    .filter((record) => dmrMatchesProject(record.site, project))
    .forEach((record, index) => {
      const trade = record.trade || record.category || record.agency || "Work plan";
      const key = rowKey(record.site, trade);
      const existing = rows.get(key) || {
        id: `${plan?.date || "plan"}-${key || index}`,
        site: record.site || "",
        trade,
        plannedManpower: 0,
        actualManpower: 0,
        workItems: [],
        submitters: [],
      };
      existing.plannedManpower += manpowerNumber(record.plannedManpower ?? record.manpower ?? record.planned);
      const work = record.work || record.plannedWork || record.description || record.scope || "";
      if (work && !existing.workItems.includes(work)) existing.workItems.push(work);
      const submittedBy = record.submittedBy || record.createdBy || "";
      if (submittedBy && !existing.submitters.includes(submittedBy)) existing.submitters.push(submittedBy);
      rows.set(key, existing);
    });

  (plan?.actuals?.tradeSiteBreakdown || [])
    .filter((item) => dmrMatchesProject(item.site, project))
    .forEach((item, index) => {
      const trade = item.trade || "Actual manpower";
      const key = rowKey(item.site, trade);
      const existing = rows.get(key) || {
        id: `${plan?.date || "actual"}-${key || index}`,
        site: item.site || "",
        trade,
        plannedManpower: 0,
        actualManpower: 0,
        workItems: [],
        submitters: [],
      };
      existing.actualManpower += manpowerNumber(item.actual);
      rows.set(key, existing);
    });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      work: row.workItems.join("\n"),
      submittedBy: row.submitters.join(", "),
    }))
    .filter((row) => manpowerNumber(row.plannedManpower) || manpowerNumber(row.actualManpower))
    .sort((a, b) => b.plannedManpower - a.plannedManpower || b.actualManpower - a.actualManpower || a.trade.localeCompare(b.trade));
}

function projectPlanActual(plan, project) {
  return (plan?.actuals?.siteBreakdown || [])
    .filter((item) => dmrMatchesProject(item.site, project))
    .reduce((sum, item) => sum + manpowerNumber(item.actual), 0);
}

function inDateRange(value, start, end) {
  const key = dateKeyFromValue(value);
  if (!key) return false;
  if (start && key < start) return false;
  if (end && key > end) return false;
  return true;
}

function MiniBarChart({ rows = [], color = "#6f55d8" }) {
  if (!rows.length) {
    return (
      <div className="grid h-28 place-items-center rounded-2xl bg-[#f5f6f3] text-center text-xs text-[#858b82] dark:bg-white/[0.05] dark:text-white/45">
        No chart data in this range.
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((row) => Number(row.value) || 0));
  return (
    <div className="flex h-28 items-end gap-2">
      {rows.map((row, index) => (
        <div key={`${row.label || "bar"}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-24 w-full items-end rounded-full bg-[#eef0ec] px-1 dark:bg-white/10">
            <span
              className="block w-full rounded-full"
              style={{ height: `${Math.max(8, ((Number(row.value) || 0) / max) * 100)}%`, background: color }}
            />
          </div>
          <span className="max-w-full truncate text-[10px] text-[#858b82]">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function ReportDonut({ value, size = 150, stroke = 18, color = "#39c6d8", track = "#edf0ec", children }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <div className="absolute text-center">{children || <span className="text-2xl font-bold">{safe}%</span>}</div>
    </div>
  );
}

function ReportBars({ rows = [] }) {
  const colors = ["#ff3f62", "#ffad1f", "#44c7d8", "#7446ee"];
  const max = Math.max(1, ...rows.map((row) => Number(row.value) || 0));
  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#30342e] dark:text-white">{row.label}</span>
            <span className="text-[#777d74] dark:text-white/50">{row.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#eef0ec] dark:bg-white/10">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(5, ((Number(row.value) || 0) / max) * 100)}%`, background: row.color || colors[index % colors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectReportDrawer({ darkMode, project, tasks = [], phases = [], users = [], onClose }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(todayKey);
  const [mrnData, setMrnData] = useState(null);
  const [dmrData, setDmrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 260);
  }

  const loadReportData = useCallback(async (quiet = false) => {
    try {
      quiet ? setRefreshing(true) : setLoading(true);
      setError("");
      const [mrnResult, dmrResult] = await Promise.all([
        api("/mrn-dashboard?all=true").catch((loadError) => ({ records: [], error: loadError.message })),
        api(`/dmr-dashboard/report?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&sections=summary,siteManpower,tradeSiteManpower,dailyProgress`).catch((loadError) => ({ error: loadError.message })),
      ]);
      setMrnData(mrnResult);
      setDmrData(dmrResult);
      const messages = [mrnResult.error, dmrResult.error].filter(Boolean);
      if (messages.length) setError(messages.join(" · "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  const taskDateForRange = (task) => task.status === "done"
    ? task.completedAt || task.doneAt || task.updatedAt || ""
    : task.dueDate || task.startDate || task.updatedAt || "";
  const rangedTasks = useMemo(
    () => tasks.filter((task) => inDateRange(taskDateForRange(task), startDate, endDate)),
    [tasks, startDate, endDate],
  );
  const taskBase = rangedTasks;
  const doneTasks = taskBase.filter((task) => task.status === "done").length;
  const blockedTasks = taskBase.filter((task) => task.status === "blocked").length;
  const overallDoneTasks = tasks.filter((task) => task.status === "done").length;
  const overallBlockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const overallProgress = tasks.length ? Math.round((overallDoneTasks / tasks.length) * 100) : project.metrics?.progress || 0;
  const delayedTasks = taskBase.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < todayKey);
  const delayedBlockedTasks = [
    ...taskBase.filter((task) => task.status === "blocked"),
    ...delayedTasks,
  ].filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index);
  const completedTasks = taskBase.filter((task) => task.status === "done" && inDateRange(task.completedAt || task.doneAt || task.updatedAt, startDate, endDate));
  const activeTasks = taskBase.filter((task) => task.status !== "done" && task.status !== "blocked" && !(task.dueDate && task.dueDate < todayKey));
  const taskProgress = overallProgress;
  const phaseRows = phases.map((phase) => {
    const phaseTasks = taskBase.filter((task) => task.phaseId === phase.id);
    const done = phaseTasks.filter((task) => task.status === "done").length;
    const blocked = phaseTasks.filter((task) => task.status === "blocked").length;
    const delayed = phaseTasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < todayKey).length;
    return {
      id: phase.id,
      label: phase.name || "Phase",
      dueDate: phase.dueDate,
      value: phaseTasks.length ? Math.round((done / phaseTasks.length) * 100) : 0,
      total: phaseTasks.length,
      done,
      blocked,
      delayed,
      reason: blocked ? `${blocked} blocked task${blocked === 1 ? "" : "s"}` : delayed ? `${delayed} delayed task${delayed === 1 ? "" : "s"}` : phase.dueDate && phase.dueDate < todayKey && done < phaseTasks.length ? "Target date passed" : "On track",
    };
  }).filter((row) => row.total || inDateRange(row.dueDate, startDate, endDate));
  const delayedPhases = phaseRows.filter((row) => row.blocked || row.delayed || /passed/i.test(row.reason));

  const projectMrns = useMemo(
    () => (mrnData?.records || []).filter((row) => mrnMatchesProject(row, project)),
    [mrnData?.records, project],
  );
  const rangedMrns = projectMrns.filter((row) => inDateRange(row.materialRequestDate || row.date, startDate, endDate));
  const deliveredMrns = rangedMrns.filter((row) => /delivered|closed|complete|received/i.test(row.status)).length;
  const mrnValue = rangedMrns.reduce((sum, row) => sum + (Number(String(row.quotationAmount || "").replace(/,/g, "")) || 0), 0);

  const manpowerRows = (dmrData?.tradeSiteManpower || dmrData?.siteManpower || [])
    .filter((row) => dmrMatchesProject(row.site || row.label, project));
  const plannedManpower = manpowerRows.reduce((sum, row) => sum + manpowerNumber(row.planned), 0);
  const actualManpower = manpowerRows.reduce((sum, row) => sum + manpowerNumber(row.actual), 0);
  const manpowerPct = manpowerProgress(plannedManpower, actualManpower);
  const manpowerDatesWithData = dmrData?.summary?.datesWithData || 0;
  const hasManpowerData = manpowerDatesWithData > 0 && (plannedManpower > 0 || actualManpower > 0);
  const assigneeRows = users.map((person) => {
    const assigned = taskBase.filter((task) => (task.assigneeIds || []).includes(person.id));
    return {
      person,
      total: assigned.length,
      done: assigned.filter((task) => task.status === "done").length,
      delayed: assigned.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < todayKey).length,
      blocked: assigned.filter((task) => task.status === "blocked").length,
    };
  }).filter((row) => row.total).sort((a, b) => b.total - a.total).slice(0, 4);
  const muted = darkMode ? "text-white/50" : "text-[#777d74]";
  const card = darkMode ? "bg-[#1b1e24]" : "bg-white";
  const soft = darkMode ? "bg-white/[0.05]" : "bg-[#f6f6f4]";
  const reportCard = `rounded-[22px] p-5 shadow-[0_10px_30px_rgba(18,24,18,0.05)] ${card}`;

  const TaskLine = ({ task }) => {
    const phaseName = phases.find((phase) => phase.id === task.phaseId)?.name || "No phase";
    const assigneeNames = users.filter((person) => (task.assigneeIds || []).includes(person.id)).map((person) => person.displayName || person.username).join(", ");
    const displayDate = task.status === "done"
      ? task.completedAt || task.doneAt || task.updatedAt || task.dueDate
      : task.dueDate || task.startDate || task.updatedAt;
    return (
      <div className={`rounded-xl p-3 ${soft}`}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={task.status || "todo"} compact />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{task.title || "Untitled task"}</span>
          <span className={`text-xs ${muted}`}>{formatDate(displayDate, "No date")}</span>
        </div>
        <p className={`mt-2 text-xs leading-5 ${muted}`}>
          {phaseName}{assigneeNames ? ` · ${assigneeNames}` : ""}{task.description ? ` · ${task.description}` : ""}
        </p>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-[120] bg-black/40 backdrop-blur-[2px] ${closing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      role="presentation"
    >
      <aside
        className={`mrn-detail-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${expanded ? "mrn-detail-shell-expanded" : ""} ${closing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} project report`}
      >
        <header className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>
          <span><b>{project.code || project.name}</b> - Project report</span>
          <div className="flex items-center gap-2">
            <button onClick={() => loadReportData(true)} className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f7ef] text-[#3f7d16] hover:bg-[#eafbdc]"}`}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
            <button onClick={() => setExpanded((current) => !current)} className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#eafbdc] text-[#3f7d16] hover:bg-[#ddf8c9]"}`}>
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {expanded ? "Restore" : "Expand"}
            </button>
            <button onClick={requestClose} className="px-1 font-semibold text-[#3f7d16]">Close</button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside className={`min-h-0 overflow-y-auto border-b p-5 md:border-b-0 md:border-r ${darkMode ? "border-white/10" : "border-black/10"}`}>
            <div className="flex gap-2">
              <span className="rounded bg-[#eafbdc] px-2 py-1 text-[10px] font-bold text-[#3f7d16]">PROJECT</span>
              <span className="rounded bg-black/5 px-2 py-1 text-[10px] font-bold dark:bg-white/10">REPORT</span>
            </div>
            <p className={`mt-4 text-xs ${muted}`}>Date range</p>
            <h2 className="mt-1 text-2xl font-bold">{project.name}</h2>
            <p className={`mt-2 text-xs leading-5 ${muted}`}>{formatDate(startDate)} to {formatDate(endDate)}</p>
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className={`mb-1.5 block text-[11px] font-semibold ${muted}`}>Start date</span>
                <DatePicker darkMode={darkMode} value={startDate} onChange={setStartDate} placeholder="Start date" />
              </label>
              <label className="block">
                <span className={`mb-1.5 block text-[11px] font-semibold ${muted}`}>End date</span>
                <DatePicker darkMode={darkMode} value={endDate} onChange={setEndDate} placeholder="End date" />
              </label>
            </div>
            <div className={`mt-5 rounded-2xl p-4 ${soft}`}>
              <p className={`text-xs ${muted}`}>Overall efficiency</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">{taskProgress}%</p>
              <ProgressBar value={taskProgress} className="mt-3 !h-2" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Done", overallDoneTasks],
                ["Delayed", delayedTasks.length],
                ["Blocked", overallBlockedTasks],
                ["MRN", rangedMrns.length],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-xl p-3 ${soft}`}>
                  <p className={`text-[11px] ${muted}`}>{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto bg-[#f4f5f2] p-5 dark:bg-[#101216]">
            {loading ? (
              <div className={`rounded-2xl px-6 py-16 text-center ${card}`}>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#4b9b16]" />
                <p className={`mt-3 text-sm ${muted}`}>Preparing project report...</p>
              </div>
            ) : (
              <>
                {error && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-400/10 dark:text-amber-100">{error}</p>}
                <section className={reportCard}>
                  <div className="grid gap-6 xl:grid-cols-[1fr_300px] xl:items-center">
                    <div>
                      <p className={`text-xs ${muted}`}>Pipeline: <b className="text-[#171714] dark:text-white">Project Work</b> | Range: <b className="text-[#171714] dark:text-white">{formatDate(startDate)} - {formatDate(endDate)}</b></p>
                      <h3 className="mt-2 text-2xl font-bold">Task report</h3>
                      <div className="mt-6 max-w-xl">
                        <ReportBars rows={[
                          { label: "Completed", value: doneTasks, color: "#35c759" },
                          { label: "Active", value: activeTasks.length, color: "#44c7d8" },
                          { label: "Blocked", value: blockedTasks, color: "#ff3f62" },
                          { label: "Delayed", value: delayedTasks.length, color: "#ffad1f" },
                        ]} />
                      </div>
                    </div>
                    <div className="flex items-center gap-5 rounded-[20px] bg-[#f8f8f6] p-4 dark:bg-white/[0.04]">
                      <ReportDonut value={taskProgress} color="#35c759" track={darkMode ? "rgba(255,255,255,.1)" : "#e9ebe7"}>
                        <span className="text-2xl font-bold">{taskProgress}%</span>
                      </ReportDonut>
                      <div>
                        <p className="text-xl font-bold">{overallDoneTasks}/{tasks.length}</p>
                        <p className={`mt-1 text-xs leading-5 ${muted}`}>overall project tasks done</p>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <section className={reportCard}>
                    <h3 className="text-lg font-bold">Completed in Range</h3>
                    <div className="mt-4 space-y-3">
                      {completedTasks.slice(0, 6).map((task) => <TaskLine key={task.id} task={task} />)}
                      {!completedTasks.length && <p className={`rounded-xl p-4 text-sm ${soft} ${muted}`}>No tasks completed in this date range.</p>}
                    </div>
                  </section>
                  <section className={reportCard}>
                    <h3 className="text-lg font-bold">Delayed / Blocked</h3>
                    <div className="mt-4 space-y-3">
                      {delayedBlockedTasks.slice(0, 6).map((task) => <TaskLine key={task.id} task={task} />)}
                      {!delayedBlockedTasks.length && <p className={`rounded-xl p-4 text-sm ${soft} ${muted}`}>No delayed or blocked tasks in this date range.</p>}
                    </div>
                  </section>
                </div>

                <section className={`mt-5 ${reportCard}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">Phase Delay and Completion</h3>
                      <p className={`mt-1 text-xs ${muted}`}>Delayed phases show the reason from blocked/delayed tasks or passed target dates.</p>
                    </div>
                    <span className="text-2xl font-bold">{delayedPhases.length}</span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {phaseRows.map((row) => (
                      <div key={row.id} className={`rounded-[18px] p-4 ${soft}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-bold">{row.label}</span>
                          <span className="text-xs font-semibold">{row.value}%</span>
                        </div>
                        <ProgressBar value={row.value} className="!h-2" />
                        <p className={`mt-2 text-xs ${row.reason === "On track" ? muted : "text-amber-700 dark:text-amber-200"}`}>{row.reason}</p>
                      </div>
                    ))}
                    {!phaseRows.length && <p className={`rounded-xl p-4 text-sm ${soft} ${muted}`}>No phase activity in this date range.</p>}
                  </div>
                </section>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <section className={reportCard}>
                    <h3 className="text-lg font-bold">Manpower</h3>
                    <p className={`mt-1 text-xs ${muted}`}>
                      {hasManpowerData ? "Overall planned vs actual manpower" : "No manpower submitted in this range"}
                    </p>
                    <div className="mt-5 flex items-center gap-5">
                      <ReportDonut value={manpowerPct} color="#44c7d8" track={darkMode ? "rgba(255,255,255,.1)" : "#e9ebe7"}>
                        <span className="text-2xl font-bold">{manpowerPct}%</span>
                      </ReportDonut>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className={muted}>Actual</span>
                            <span className="font-bold">{actualManpower}</span>
                          </div>
                          <ProgressBar value={plannedManpower ? Math.min(100, Math.round((actualManpower / plannedManpower) * 100)) : actualManpower ? 100 : 0} className="!h-2" />
                        </div>
                        <div className={`grid grid-cols-2 gap-2 text-center`}>
                          <div className={`rounded-xl p-3 ${soft}`}>
                            <p className={`text-[11px] ${muted}`}>Planned</p>
                            <p className="mt-1 text-xl font-bold">{plannedManpower}</p>
                          </div>
                          <div className={`rounded-xl p-3 ${soft}`}>
                            <p className={`text-[11px] ${muted}`}>Actual</p>
                            <p className="mt-1 text-xl font-bold">{actualManpower}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className={reportCard}>
                    <h3 className="text-lg font-bold">MRN Received</h3>
                    <div className="mt-5 flex items-center gap-5">
                      <ReportDonut value={rangedMrns.length ? Math.round((deliveredMrns / rangedMrns.length) * 100) : 0} color="#ffad1f" track={darkMode ? "rgba(255,255,255,.1)" : "#e9ebe7"}>
                        <span className="text-2xl font-bold">{rangedMrns.length ? Math.round((deliveredMrns / rangedMrns.length) * 100) : 0}%</span>
                      </ReportDonut>
                      <div>
                        <p className="text-lg font-bold">{deliveredMrns}/{rangedMrns.length}</p>
                        <p className={`text-xs ${muted}`}>delivered or received</p>
                      </div>
                    </div>
                    <p className={`mt-4 text-xs ${muted}`}>Quotation value: <b>{mrnAmount(mrnValue)}</b></p>
                  </section>
                </div>

                <section className={`mt-5 ${reportCard}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">Team Output</h3>
                      <p className={`mt-1 text-xs ${muted}`}>Assigned task output in the selected range.</p>
                    </div>
                    <span className="text-2xl font-bold">{assigneeRows.length}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {assigneeRows.map(({ person, total, done, delayed, blocked }, index) => (
                        <div key={person.id} className={`rounded-[16px] p-3 ${soft}`}>
                          <div className="flex items-center gap-3">
                          <Avatar name={person.displayName || person.username} index={index} />
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between text-xs"><span className="truncate font-semibold">{person.displayName || person.username}</span><span className="font-bold">{done}/{total}</span></div>
                            <ProgressBar value={total ? Math.round((done / total) * 100) : 0} className="mt-2 !h-2" />
                            <p className={`mt-2 text-[11px] ${muted}`}>{delayed} delayed · {blocked} blocked</p>
                          </div>
                          </div>
                        </div>
                      ))}
                      {!assigneeRows.length && <p className={`rounded-xl p-4 text-sm ${soft} ${muted}`}>No assigned task output in this range.</p>}
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </aside>
    </div>
  );
}

function ProjectManpowerView({ darkMode, project }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDmr = useCallback(async (quiet = false) => {
    try {
      quiet ? setRefreshing(true) : setLoading(true);
      setError("");
      const result = await api("/dmr-dashboard");
      setData(result);
    } catch (loadError) {
      setError(loadError.message || "Could not load project manpower");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDmr();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDmr]);

  const todayRows = useMemo(
    () => projectManpowerRows(data?.today?.records || [], project),
    [data?.today?.records, project],
  );
  const todayPlanRows = useMemo(
    () => projectPlanRows(data?.todayPlan, project),
    [data?.todayPlan, project],
  );
  const tomorrowPlanRows = useMemo(
    () => projectPlanRows(data?.tomorrowPlan, project),
    [data?.tomorrowPlan, project],
  );
  const planForToday = todayPlanRows.reduce((sum, row) => sum + row.plannedManpower, 0);
  const planForTomorrow = tomorrowPlanRows.reduce((sum, row) => sum + row.plannedManpower, 0);
  const actualFromPlan = projectPlanActual(data?.todayPlan, project);
  const planned = planForToday || todayRows.reduce((sum, row) => sum + row.planned, 0);
  const actual = actualFromPlan || todayRows.reduce((sum, row) => sum + row.actual, 0);
  const progress = manpowerProgress(planned || planForToday, actual);

  return (
    <div className="mx-auto max-w-[1250px] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl  font-semibold">Project Manpower</h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            DMR manpower, today plan, and tomorrow plan for {project.name}.
          </p>
        </div>
        <Button onClick={() => loadDmr(true)}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl border border-[#dfe3dc] bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#4b9b16]" />
          <p className="mt-3 text-sm text-[#7b8178]">Loading project manpower...</p>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-[#dfe3dc] bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <AlertCircle className="mx-auto h-7 w-7 text-amber-500" />
          <h3 className="mt-3 text-sm font-semibold">DMR records unavailable</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#858b82]">{error}</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Actual today", actual, STAT_TONES.teal],
              ["Planned today", planned || planForToday, STAT_TONES.green],
              ["Tomorrow plan", planForTomorrow, STAT_TONES.blue],
              ["Overall progress", `${progress}%`, STAT_TONES.amber],
            ].map(([label, value, className]) => (
              <div key={label} className={cn("rounded-2xl p-4", className)}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
                <p className="mt-1 text-2xl small font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <section className="mt-5 rounded-2xl  border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Overall progress</h3>
                <p className="mt-0.5 text-[11px] text-[#858b82]">
                  {actual} actual against {planned || planForToday} planned manpower
                </p>
              </div>
              <span className="text-lg small font-bold tabular-nums">{progress}%</span>
            </div>
            <ProgressBar value={progress} className="mt-3" />
          </section>

          <div className="mt-5 space-y-4">
            <PlanPanel title="Today Plan" date={data?.todayPlan?.date || data?.date} rows={todayPlanRows} showActual />
            <PlanPanel title="Tomorrow Plan" date={data?.tomorrowPlan?.date} rows={tomorrowPlanRows} />
          </div>

        </>
      )}
    </div>
  );
}

function PlanPanel({ title, date, rows, showActual = false }) {
  const total = rows.reduce((sum, row) => sum + row.plannedManpower, 0);
  const actual = rows.reduce((sum, row) => sum + row.actualManpower, 0);
  const actualClass = (actualValue, plannedValue) =>
    !showActual
      ? ""
      : manpowerNumber(actualValue) >= manpowerNumber(plannedValue)
        ? "text-emerald-600"
        : "text-red-600";
  return (
    <section className="overflow-hidden rounded-2xl  border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <header className="flex items-center justify-between gap-3 border-b border-[#e5e8e2] px-4 py-3 dark:border-white/10">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-[11px]  text-[#858b82]">{formatDate(date)} · {rows.length} item{rows.length === 1 ? "" : "s"}</p>
        </div>
        <span className="rounded-xl small bg-[#eafbdc] px-4 py-2 text-sm font-bold text-[#3f7d16]">
          {showActual ? (
            <>
              <span className="text-2xl leading-none tabular-nums">{total}</span>
              <span className="mx-1 text-[#7b8178]">/</span>
              <span className={`text-2xl leading-none tabular-nums ${actualClass(actual, total)}`}>{actual}</span>
            </>
          ) : <span className="text-2xl leading-none tabular-nums">{total}</span>} <span className="align-middle text-xs">manpower</span>
        </span>
      </header>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl  border-zinc-100 bg-[#fbfcf9] p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base  font-semibold">{row.trade}</p>
                {row.submittedBy && <p className="mt-1  text-[10px] text-[#92988f]">By {row.submittedBy}</p>}
              </div>
              <span className="shrink-0 text-2xl small font-bold leading-none tabular-nums">
                {showActual ? (
                  <>
                    <span>{row.plannedManpower}</span>
                    <span className="mx-1 text-[#7b8178]">/</span>
                    <span className={actualClass(row.actualManpower, row.plannedManpower)}>
                      {row.actualManpower}
                    </span>
                  </>
                ) : row.plannedManpower}
              </span>
            </div>
            {row.work && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-[#6f756c] dark:text-white/50">{row.work}</p>}
          </div>
        ))}
        {!rows.length && (
          <p className="py-12 text-center text-sm text-[#858b82] sm:col-span-2 xl:col-span-3 2xl:col-span-4">No plan rows found for this site.</p>
        )}
      </div>
    </section>
  );
}

function dateKeyFromValue(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function calendarTone(type, status = "") {
  if (/blocked/i.test(status)) return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200";
  if (/done|delivered|closed|complete/i.test(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  const tones = {
    phase: "border-[#cde8bd] bg-[#effbe9] text-[#3f7d16] dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-200",
    task: "border-[#f4d38b] bg-[#fff6df] text-[#8a6312] dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    subtask: "border-[#cbd8ff] bg-[#f0f4ff] text-[#3159a5] dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
    mrn: "border-[#f0c5cd] bg-[#fff0f2] text-[#9b3445] dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
    project: "border-[#cbd7cf] bg-white text-[#4c5349] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/75",
  };
  return tones[type] || tones.project;
}

function buildCalendarEvents({ project, phases = [], tasks = [], mrns = [] }) {
  const events = [];
  const pushEvent = (event) => {
    const date = dateKeyFromValue(event.date);
    if (!date) return;
    events.push({ ...event, date });
  };

  pushEvent({ id: `${project.id}-start`, date: project.startDate, title: "Project start", type: "project", meta: project.name });
  pushEvent({ id: `${project.id}-target`, date: project.targetDate, title: "Project target", type: "project", meta: project.client || project.location });

  phases.forEach((phase) => {
    pushEvent({ id: `${phase.id}-start`, date: phase.startDate, title: `${phase.name || "Phase"} starts`, type: "phase", status: phase.status, meta: phase.ownerName || "Phase", source: phase });
    pushEvent({ id: `${phase.id}-due`, date: phase.dueDate, title: `${phase.name || "Phase"} deadline`, type: "phase", status: phase.status, meta: statusLabel(phase.status), source: phase });
  });

  tasks.forEach((task) => {
    const phaseName = phases.find((phase) => phase.id === task.phaseId)?.name;
    pushEvent({ id: `${task.id}-start`, date: task.startDate, title: `${task.title || "Task"} starts`, type: "task", status: task.status, meta: phaseName || statusLabel(task.status), source: task });
    pushEvent({ id: `${task.id}-due`, date: task.dueDate, title: task.title || "Task deadline", type: "task", status: task.status, meta: `${task.priority || "medium"} priority`, source: task });
    (task.subtasks || []).forEach((subtask) => {
      pushEvent({ id: `${task.id}-${subtask.id}-due`, date: subtask.dueDate || subtask.date, title: subtask.title || "Subtask deadline", type: "subtask", status: subtask.done ? "done" : task.status, meta: task.title, source: task });
    });
  });

  mrns.forEach((row) => {
    pushEvent({ id: `${row.id || row.mrnNo}-request`, date: row.materialRequestDate || row.date, title: `${row.mrnNo || "MRN"} requested`, type: "mrn", status: row.status, meta: row.materialRequirement || row.vendorName, source: row });
    pushEvent({ id: `${row.id || row.mrnNo}-required`, date: row.requiredDate, title: `${row.mrnNo || "MRN"} required`, type: "mrn", status: row.status, meta: row.assignTo || row.vendorName, source: row });
    pushEvent({ id: `${row.id || row.mrnNo}-invoice`, date: row.invoiceDate, title: `${row.mrnNo || "MRN"} invoice`, type: "mrn", status: row.status, meta: mrnAmount(row.quotationAmount), source: row });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

function ProjectCalendarView({ project, phases, tasks, onOpenTask, onOpenPhase, onOpenMrn }) {
  const [cursor, setCursor] = useState(() => {
    const seed = dateKeyFromValue(project.startDate) || new Date().toISOString().slice(0, 10);
    const date = new Date(`${seed}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  });
  const [mrnData, setMrnData] = useState(null);
  const [mrnError, setMrnError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [fullscreenMounted, setFullscreenMounted] = useState(false);
  const [calendarPopover, setCalendarPopover] = useState(null);

  const loadMrns = useCallback(async () => {
    try {
      setMrnError("");
      const result = await api("/mrn-dashboard?all=true");
      setMrnData(result);
    } catch (error) {
      setMrnError(error.message || "MRN dates unavailable");
      setMrnData({ records: [] });
    }
  }, []);

  useEffect(() => {
    // Calendar MRN dates are loaded once when the project calendar opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMrns();
  }, [loadMrns]);

  const projectMrns = useMemo(() => (mrnData?.records || []).filter((row) => mrnMatchesProject(row, project)), [mrnData?.records, project]);
  const events = useMemo(() => buildCalendarEvents({ project, phases, tasks, mrns: projectMrns }), [project, phases, tasks, projectMrns]);
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstCell = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(firstCell, index));
  const eventMap = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [events]);
  const todayKey = new Date().toISOString().slice(0, 10);
  function openEvent(event) {
    setCalendarPopover(null);
    if (event.type === "task" || event.type === "subtask") return event.source && onOpenTask(event.source);
    if (event.type === "phase") return event.source && onOpenPhase(event.source);
    if (event.type === "mrn") return event.source && onOpenMrn(event.source, mrnData);
  }
  function toggleCalendarExpand() {
    if (fullscreenMounted) {
      setExpanded(false);
      window.setTimeout(() => setFullscreenMounted(false), 260);
      return;
    }
    setFullscreenMounted(true);
    window.requestAnimationFrame(() => setExpanded(true));
  }
  const compactCalendar = fullscreenMounted;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] transform-gpu p-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:p-6",
        fullscreenMounted &&
          "fixed inset-0 z-[70] max-w-none origin-center overflow-y-auto bg-[#f7f8f5] p-3 shadow-[0_24px_90px_rgba(15,23,42,0.18)] dark:bg-[#11130f] sm:p-4",
        fullscreenMounted && (expanded ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.97] opacity-0"),
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="h-5 w-5 text-[#4b9b16]" />Calendar</h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">Project, phase, task, subtask and MRN dates for {project.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</Button>
          <Button onClick={() => setCursor(new Date())}>Today</Button>
          <Button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</Button>
          <IconButton label={fullscreenMounted ? "Exit full screen" : "Expand calendar"} onClick={toggleCalendarExpand}>
            {fullscreenMounted ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>

      <div className={cn(compactCalendar ? "mt-3" : "mt-5", "transition-[margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]")}>
        <section className="overflow-hidden rounded-2xl border border-[#dfe3dc] bg-white transition-shadow duration-500 dark:border-white/10 dark:bg-white/[0.03]">
          <header className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7e1] px-4 transition-[padding] duration-500 dark:border-white/10", compactCalendar ? "py-2" : "py-3")}>
            <h3 className="text-sm font-bold">{monthLabel(cursor)}</h3>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71776e] dark:text-white/45">
              {["Phase", "Task", "Subtask", "MRN"].map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", label === "Phase" ? "bg-green-400" : label === "Task" ? "bg-amber-400" : label === "Subtask" ? "bg-blue-400" : "bg-rose-400")} />
                  {label}
                </span>
              ))}
            </div>
          </header>
          <div className="grid grid-cols-7 border-b border-[#e4e7e1] bg-[#f7f8f5] text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#858b82] dark:border-white/10 dark:bg-white/[0.025]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className={cn("transition-[padding] duration-500", compactCalendar ? "py-2" : "py-3")}>{day}</span>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-7">
            {days.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayEvents = eventMap.get(key) || [];
              const muted = day.getMonth() !== cursor.getMonth();
              const visibleCount = compactCalendar ? 2 : 3;
              const hiddenCount = Math.max(0, dayEvents.length - visibleCount);
              const popoverOpen = calendarPopover?.date === key;
              return (
                <div key={key} className={cn(compactCalendar ? "h-[118px] p-1.5" : "min-h-[150px] p-2", "relative border-b border-r border-[#eef0eb] transition-[height,min-height,padding,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] last:border-r-0 dark:border-white/10", muted && "bg-[#fafbf8] text-[#a1a79e] dark:bg-white/[0.015]")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("grid place-items-center rounded-full text-xs font-bold transition-[width,height] duration-500", compactCalendar ? "h-5 w-5" : "h-7 w-7", key === todayKey ? "bg-[#20231f] text-white dark:bg-[#d8f36a] dark:text-[#11150f]" : "")}>{day.getDate()}</span>
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCalendarPopover(popoverOpen ? null : { date: key, events: dayEvents });
                        }}
                        className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold transition", popoverOpen ? "bg-[#20231f] text-white" : "bg-[#eef0ec] text-[#5f665b] hover:bg-[#dfe4da]")}
                      >
                        +{hiddenCount}
                      </button>
                    )}
                  </div>
                  <div className={cn(compactCalendar ? "mt-1 space-y-1" : "mt-2 space-y-1.5", "transition-[margin] duration-500")}>
                    {dayEvents.slice(0, visibleCount).map((event) => (
                      <button key={event.id} type="button" onClick={() => openEvent(event)} className={cn("block w-full rounded-lg border px-2 text-left text-[11px] leading-4 transition duration-200 hover:-translate-y-0.5", compactCalendar ? "py-1" : "py-1.5", calendarTone(event.type, event.status))}>
                        <span className="block truncate font-bold">{event.title}</span>
                        {event.meta && <span className="block truncate opacity-70">{event.meta}</span>}
                      </button>
                    ))}
                  </div>
                  {popoverOpen && (
                    <div className={cn("absolute left-2 right-2 top-9 z-30 rounded-[22px] bg-white p-3 text-[#171714] shadow-[0_18px_60px_rgba(15,23,42,0.22)] ring-1 ring-black/5 dark:bg-[#1b1e24] dark:text-white dark:ring-white/10", day.getDay() >= 5 && "left-auto right-2 w-[320px]", day.getDay() <= 1 && "left-2 right-auto w-[320px]")}>
                      <div className="flex items-start justify-between gap-3 border-b border-[#e8ebe5] pb-3 dark:border-white/10">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8178]">{formatDate(key)}</p>
                          <h4 className="mt-1 text-base font-bold">{dayEvents.length} calendar item{dayEvents.length === 1 ? "" : "s"}</h4>
                        </div>
                        <button type="button" onClick={() => setCalendarPopover(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0f2ee] text-[#5f665b] hover:bg-[#e2e6de] dark:bg-white/10 dark:text-white/70">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {dayEvents.map((event) => (
                          <button key={event.id} type="button" onClick={() => openEvent(event)} className={cn("group w-full rounded-2xl border px-3 py-2.5 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-sm", calendarTone(event.type, event.status))}>
                            <div className="flex items-start gap-2">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">{event.title}</span>
                                {event.meta && <span className="mt-0.5 block text-[11px] opacity-75">{event.meta}</span>}
                                <span className="mt-1 inline-flex rounded-full bg-white/55 px-2 py-0.5 text-[10px] font-bold capitalize text-current dark:bg-black/15">{event.type}</span>
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {mrnError && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">{mrnError}</p>}
    </div>
  );
}

function ProjectMrnView({ darkMode, project }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedMrn, setSelectedMrn] = useState(null);
  const [error, setError] = useState("");

  const loadMrns = useCallback(async (quiet = false) => {
    try {
      quiet ? setRefreshing(true) : setLoading(true);
      setError("");
      const result = await api("/mrn-dashboard?all=true");
      setData(result);
    } catch (loadError) {
      setError(loadError.message || "Could not load project MRNs");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMrns();
  }, [loadMrns]);

  const projectRecords = useMemo(
    () => (data?.records || []).filter((row) => mrnMatchesProject(row, project)),
    [data?.records, project],
  );

  const records = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projectRecords;
    return projectRecords.filter((row) =>
      [
        row.mrnNo,
        row.project,
        row.materialRequirement,
        row.issuedBy,
        row.status,
        row.assignTo,
        row.vendorName,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [projectRecords, query]);

  const delivered = projectRecords.filter((row) =>
    /delivered|closed|complete/i.test(row.status),
  ).length;
  const open = Math.max(0, projectRecords.length - delivered);
  const totalAmount = projectRecords.reduce(
    (sum, row) =>
      sum + (Number(String(row.quotationAmount || "").replace(/,/g, "")) || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-[1250px] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project MRN</h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            Material request notes linked to {project.name}.
          </p>
        </div>
        <Button onClick={() => loadMrns(true)}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Total MRN", projectRecords.length, STAT_TONES.green],
          ["Open", open, STAT_TONES.blue],
          ["Delivered", delivered, STAT_TONES.teal],
          ["Quotation", mrnAmount(totalAmount), STAT_TONES.amber],
        ].map(([label, value, className]) => (
          <div key={label} className={cn("rounded-2xl p-4", className)}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              {label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#878d84]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search MRN, material, vendor..."
            className={cn(inputClass, "pl-9")}
          />
        </div>
        <span className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-[#60665d] dark:bg-white/[0.05] dark:text-white/55">
          {records.length} visible
        </span>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
        {loading ? (
          <div className="px-6 py-16 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#4b9b16]" />
            <p className="mt-3 text-sm text-[#7b8178]">Loading project MRNs...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <AlertCircle className="mx-auto h-7 w-7 text-amber-500" />
            <h3 className="mt-3 text-sm font-semibold">MRN records unavailable</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#858b82]">
              {error}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[120px_140px_minmax(260px,1.4fr)_130px_130px_130px_120px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]">
              <span>MRN</span>
              <span>Request date</span>
              <span>Material</span>
              <span>Required by</span>
              <span>Issued by</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            {records.map((row) => (
              <button
                key={row.id || `${row.mrnNo}-${row.rowNumber}`}
                type="button"
                onClick={() => setSelectedMrn(row)}
                className="group grid w-full cursor-pointer gap-3 border-b border-[#e9ebe7] px-4 py-4 text-left transition last:border-0 hover:bg-[#fafbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72cf50]/25 md:grid-cols-[120px_140px_minmax(260px,1.4fr)_130px_130px_130px_120px] md:items-center dark:border-white/10 dark:hover:bg-white/[0.035]"
              >
                <span className="text-sm font-bold text-[#20231f] group-hover:text-[#4b9b16] dark:text-white">
                  {row.mrnNo || "-"}
                </span>
                <span className="text-xs text-[#6d736a] dark:text-white/50">
                  {formatDate(row.materialRequestDate || row.date)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {row.materialRequirement || "Material request"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#858b82]">
                    {row.vendorName || row.project || "No vendor added"}
                  </span>
                </span>
                <span className="text-xs text-[#6d736a] dark:text-white/50">
                  {formatDate(row.requiredDate)}
                </span>
                <span className="truncate text-xs text-[#6d736a] dark:text-white/50">
                  {row.issuedBy || "-"}
                </span>
                <span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-[11px] font-bold",
                      /delivered|closed|complete/i.test(row.status)
                        ? "bg-[#dff7f1] text-[#16836b]"
                        : "bg-[#eafbdc] text-[#4b9b16]",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {row.status || "Open"}
                  </span>
                </span>
                <span className="flex justify-end">
                  <span
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#f0f2ee] px-3 text-xs font-semibold text-[#4f554c] hover:bg-[#e7eae4] dark:bg-white/[0.06] dark:text-white/65"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Detail
                  </span>
                </span>
              </button>
            ))}
            {!records.length && (
              <div className="px-6 py-16 text-center">
                <ClipboardList className="mx-auto h-7 w-7 text-[#9ca199]" />
                <h3 className="mt-3 text-sm font-semibold">
                  No MRNs linked to this project
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#858b82]">
                  MRNs appear here when their Project / Site value matches{" "}
                  {project.name}
                  {project.code ? ` or ${project.code}` : ""}.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {selectedMrn && (
        <MrnDetailDrawer
          darkMode={darkMode}
          row={selectedMrn}
          canViewHistory={Boolean(data?.canViewMrnHistory)}
          onClose={() => setSelectedMrn(null)}
          onLoadHistory={(row) =>
            api(`/mrn-dashboard/${encodeURIComponent(row.mrnNo)}/history`)
          }
        />
      )}
    </div>
  );
}

function ProjectStockView({ darkMode, project }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const loadStock = useCallback(async (force = false) => {
    try {
      force ? setRefreshing(true) : setLoading(true);
      const result = await api(`/project-dashboard/projects/${project.id}/stock${force ? "?force=true" : ""}`);
      setData(result);
    } catch (error) {
      toast.error(error.message || "Could not load project stock");
      setData({ sites: [], totals: {} });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project.id]);

  useEffect(() => {
    // Project stock is loaded when the stock workspace opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStock(false);
  }, [loadStock]);

  const sites = data?.sites || [];
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = sites.flatMap((site) => (site.items || site.recentItems || []).map((item) => ({ ...item, siteName: site.name })));
    if (!needle) return all;
    return all.filter((item) => [item.siteName, item.itemName, item.category, item.sheetName, item.unit].join(" ").toLowerCase().includes(needle));
  }, [query, sites]);

  return (
    <div className="mx-auto max-w-[1250px] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <PackageSearch className="h-5 w-5 text-[#4b9b16]" />
            Site stock
          </h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            Stock linked to {project.name} from the Projects Stock module.
          </p>
        </div>
        <Button onClick={() => loadStock(true)}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <section className="mt-5 rounded-2xl border border-[#dfe3dc] bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#4b9b16]" />
          <p className="mt-3 text-sm text-[#7b8178]">Loading site stock...</p>
        </section>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Sites", data?.totals?.sites || sites.length, STAT_TONES.green],
              ["Items", data?.totals?.items || 0, STAT_TONES.blue],
              ["Quantity", fmtProjectStock(data?.totals?.quantity), STAT_TONES.teal],
              ["Low stock", data?.totals?.lowStock || 0, STAT_TONES.rose],
            ].map(([label, value, className]) => (
              <div key={label} className={cn("rounded-2xl p-4", className)}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
                <p className="mt-1 text-2xl small font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <section className="mt-5 rounded-2xl border border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Stock items</h3>
                <p className="mt-0.5 text-[11px] text-[#858b82]">{items.length} visible item{items.length === 1 ? "" : "s"}</p>
              </div>
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#878d84]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item, category, sheet..." className={cn(inputClass, "pl-9")} />
              </div>
            </div>
            {sites.length ? (
              <div className="mt-4 overflow-auto rounded-xl">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f7f8f5] text-[10px] font-bold uppercase tracking-[0.12em] text-[#858b82] dark:bg-white/[0.025]">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Site</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Sheet</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isFinalSheet = /final\s*sheet/i.test(item.sheetName || "");
                      return (
                      <tr
                        key={`${item.siteName}-${item.sheetName}-${item.rowNumber}-${item.itemName}`}
                        className={cn(
                          "border-b border-[#e9ebe7] last:border-0 dark:border-white/10",
                          isFinalSheet && "bg-[#fff8dd] dark:bg-amber-400/10",
                        )}
                      >
                        <td className="px-4 py-3 font-semibold">{item.itemName}</td>
                        <td className="px-4 py-3 text-[#6d736a] dark:text-white/50">{item.siteName}</td>
                        <td className="px-4 py-3 text-[#6d736a] dark:text-white/50">{item.category || "-"}</td>
                        <td className="px-4 py-3 text-[#6d736a] dark:text-white/50">
                          {isFinalSheet ? (
                            <span className="rounded-full bg-[#ffe7a3] px-2.5 py-1 text-[11px] font-bold text-[#8a5a00] dark:bg-amber-300/20 dark:text-amber-100">
                              {item.sheetName || "Final Sheet"}
                            </span>
                          ) : (
                            item.sheetName || "-"
                          )}
                        </td>
                        <td className={cn("px-4 py-3 text-right font-bold", item.quantity <= Math.max(0, item.reorderMin || 0) ? "text-rose-500" : "text-[#319000]")}>{fmtProjectStock(item.quantity)}</td>
                        <td className="px-4 py-3 text-[#6d736a] dark:text-white/50">{item.unit || "-"}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!items.length && (
                  <div className="px-6 py-14 text-center text-sm text-[#858b82]">No stock items match your search.</div>
                )}
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <PackageSearch className="mx-auto h-7 w-7 text-[#9ca199]" />
                <h3 className="mt-3 text-sm font-semibold">No stock linked to this site</h3>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#858b82]">
                  Add a site in the Projects Stock module with a name matching {project.name}
                  {project.code ? ` or ${project.code}` : ""}.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ProjectActivityView({ project }) {
  const [activity, setActivity] = useState(project.projectActivity || []);
  const [loading, setLoading] = useState(false);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api(`/project-dashboard/projects/${project.id}/activity`);
      setActivity(result.activity || []);
    } catch (error) {
      toast.error(error.message || "Could not load project activity");
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    // Refresh when the activity tab opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadActivity();
  }, [loadActivity]);
  const groups = useMemo(() => groupProjectActivity(activity), [activity]);

  return (
    <div className="mx-auto max-w-[1050px] p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Clock3 className="h-5 w-5 text-[#4b9b16]" />
            Project activity
          </h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            Task, phase, access, comment, and file changes for {project.name}.
          </p>
        </div>
        <Button onClick={loadActivity}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>
      <section className="mt-5 rounded-2xl  border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-2xl bg-[#f7f8f5] p-4 dark:bg-white/[0.04]">
              <div className="flex items-start gap-3">
                <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", group.type === "phase" ? "bg-[#72cf50]" : group.type === "task" ? "bg-amber-400" : group.type === "file" ? "bg-blue-400" : "bg-[#8a9087]")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{group.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#697066] dark:bg-white/10 dark:text-white/55">
                      {group.entries.length} change{group.entries.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#858b82]">
                    {group.firstUser || "System"} · {group.timeLabel}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2 border-l border-[#dfe3dc] pl-5 dark:border-white/10">
                {group.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-white px-3 py-2 dark:bg-white/[0.045]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold">{entry.action}</span>
                      {entry.target && entry.target !== group.label && <span className="truncate text-xs text-[#5f665c] dark:text-white/55">{entry.target}</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-[#858b82]">
                      {entry.userName || "System"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-IN") : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!groups.length && (
            <div className="px-6 py-16 text-center">
              <Clock3 className="mx-auto h-7 w-7 text-[#9ca199]" />
              <h3 className="mt-3 text-sm font-semibold">No activity yet</h3>
              <p className="mt-1 text-xs text-[#858b82]">New project changes will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("vectordocs_auth_token") || "";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareChatAttachment(file) {
  if (file.type.startsWith("image/")) {
    const dataUrl = await fileToDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      name: file.name,
      type: "image/jpeg",
      size: file.size,
      dataUrl: canvas.toDataURL("image/jpeg", 0.72),
    };
  }
  if (file.size > 1024 * 1024 * 2) {
    throw new Error(`${file.name} is too large. Keep files under 2 MB.`);
  }
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: await fileToDataUrl(file),
  };
}

function ProjectChatView({ project, tasks = [], phases = [], users = [], onOpenTask, onOpenPhase }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(project.projectChat || []);
  const [references, setReferences] = useState([]);
  const [text, setText] = useState("");
  const [pickedRefs, setPickedRefs] = useState([]);
  const [pickedMentions, setPickedMentions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [commandType, setCommandType] = useState("");
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const messageRefs = useRef(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState("");

  const loadChat = useCallback(async () => {
    const result = await api(`/project-dashboard/projects/${project.id}/chat`);
    setMessages(result.messages || []);
    setReferences(result.references || []);
  }, [project.id]);

  useEffect(() => {
    void loadChat().catch((error) => toast.error(error.message || "Could not load chat"));
  }, [loadChat]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    const source = new EventSource(`${API_URL}/project-dashboard/projects/${project.id}/chat/stream?token=${encodeURIComponent(token)}`);
    source.addEventListener("message", (event) => {
      const message = JSON.parse(event.data || "{}");
      if (!message.id) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });
    source.addEventListener("message-updated", (event) => {
      const message = JSON.parse(event.data || "{}");
      if (!message.id) return;
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
    });
    source.addEventListener("message-deleted", (event) => {
      const message = JSON.parse(event.data || "{}");
      if (!message.id) return;
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, deletedAt: new Date().toISOString(), text: "", references: [], attachments: [] } : item));
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, [project.id]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function handleChatScroll(event) {
    const target = event.currentTarget;
    stickToBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 96;
  }

  const slashCommand = text.match(/(?:^|\s)\/([^\n]*)$/);
  const commandQuery = editingMessage ? "" : (slashCommand?.[1] || "").trim();
  const commandOpen = Boolean(slashCommand && !editingMessage);
  const mentionCommand = text.match(/(?:^|\s)@([^\s@/]*)$/);
  const mentionQuery = editingMessage ? "" : (mentionCommand?.[1] || "").trim().toLowerCase();
  const mentionOpen = Boolean(mentionCommand && !editingMessage);
  const mentionMembers = useMemo(() => projectTeamMembers(project, tasks, users), [project, tasks, users]);
  const filteredRefs = useMemo(() => {
    const needle = commandQuery.toLowerCase();
    return references
      .filter((item) => !commandType || item.type === commandType)
      .filter((item) => !needle || `${item.title} ${item.meta}`.toLowerCase().includes(needle));
  }, [references, commandType, commandQuery]);
  const filteredMentions = useMemo(() => {
    return mentionMembers
      .filter((member) => String(member.id) !== String(user?.id || ""))
      .filter((member) => !mentionQuery || `${member.name} ${member.username}`.toLowerCase().includes(mentionQuery));
  }, [mentionMembers, mentionQuery, user?.id]);

  async function addFiles(event) {
    const files = Array.from(event.target.files || []).slice(0, 4);
    event.target.value = "";
    try {
      const prepared = [];
      for (const file of files) prepared.push(await prepareChatAttachment(file));
      setAttachments((current) => [...current, ...prepared].slice(0, 4));
    } catch (error) {
      toast.error(error.message || "Could not attach file");
    }
  }

  function toggleReference(ref) {
    setPickedRefs((current) =>
      current.some((item) => item.id === ref.id)
        ? current.filter((item) => item.id !== ref.id)
        : [...current, ref].slice(0, 5),
    );
    setText((current) => current.replace(/(?:^|\s)\/([^\n]*)$/, "").trimStart());
    setCommandType("");
  }

  function addMention(member) {
    setPickedMentions((current) =>
      current.some((item) => item.id === member.id)
        ? current
        : [...current, { id: member.id, name: member.name, username: member.username }].slice(0, 10),
    );
    setText((current) => current.replace(/(?:^|\s)@([^\s@/]*)$/, "").trimStart());
  }

  function openReference(ref) {
    if (ref.type === "phase") {
      const phase = phases.find((item) => item.id === ref.id);
      if (phase) onOpenPhase?.(phase);
      return;
    }
    if (ref.type === "task") {
      const task = tasks.find((item) => item.id === ref.id);
      if (task) onOpenTask?.(task);
    }
  }

  async function sendMessage() {
    if (!text.trim() && !pickedRefs.length && !pickedMentions.length && !attachments.length) return;
    try {
      setSending(true);
      stickToBottomRef.current = true;
      if (editingMessage) {
        const result = await api(`/project-dashboard/projects/${project.id}/chat/${editingMessage.id}`, {
          method: "PATCH",
          body: JSON.stringify({ text: text.trim() }),
        });
        setMessages((current) => current.map((item) => item.id === result.message.id ? result.message : item));
        setEditingMessage(null);
        setText("");
        return;
      }
      const result = await api(`/project-dashboard/projects/${project.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), references: pickedRefs, mentions: pickedMentions, attachments, replyToId: replyTo?.id }),
      });
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message]);
      setText("");
      setPickedRefs([]);
      setPickedMentions([]);
      setAttachments([]);
      setCommandType("");
      setReplyTo(null);
    } catch (error) {
      toast.error(error.message || "Could not send message");
    } finally {
      setSending(false);
    }
  }

  function referenceChipClass(type) {
    return type === "phase"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/15"
      : "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100 dark:hover:bg-blue-400/15";
  }

  function canModifyMessage(message) {
    if (message.deletedAt) return false;
    return String(message.userId || "") === String(user?.id || "") || user?.isSuperAdmin;
  }

  function isOwnMessage(message) {
    return String(message.userId || "") === String(user?.id || "");
  }

  function chatTime(value) {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToMessage(messageId) {
    const node = messageRefs.current.get(messageId);
    if (!node) return toast.error("Original message is not available");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId((current) => current === messageId ? "" : current), 1600);
  }

  function startEditMessage(message) {
    setEditingMessage(message);
    setReplyTo(null);
    setPickedRefs([]);
    setPickedMentions([]);
    setAttachments([]);
    setText(message.text || "");
  }

  async function deleteMessage(message) {
    try {
      const result = await api(`/project-dashboard/projects/${project.id}/chat/${message.id}`, { method: "DELETE" });
      if (result.message) setMessages((current) => current.map((item) => item.id === result.message.id ? result.message : item));
    } catch (error) {
      toast.error(error.message || "Could not delete message");
    }
  }

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-col overflow-hidden bg-white dark:bg-[#11130f]">
      <div ref={scrollRef} onScroll={handleChatScroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((message, index) => {
          const own = isOwnMessage(message);
          const actions = (
            <span className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <IconButton label="Reply" className="!h-7 !w-7 rounded-full" onClick={() => { setReplyTo(message); setEditingMessage(null); }}>
                <Reply className="h-3.5 w-3.5" />
              </IconButton>
              {canModifyMessage(message) && (
                <>
                  <IconButton label="Edit message" className="!h-7 !w-7 rounded-full" onClick={() => startEditMessage(message)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Delete for everyone" className="!h-7 !w-7 rounded-full text-rose-500" onClick={() => deleteMessage(message)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </>
              )}
            </span>
          );
          return (
            <article
              key={message.id}
              ref={(node) => {
                if (node) messageRefs.current.set(message.id, node);
                else messageRefs.current.delete(message.id);
              }}
              className={cn("group flex scroll-mt-24 items-end gap-3 transition-colors duration-500", own ? "justify-end" : "justify-start")}
            >
              {!own && <Avatar name={message.userName} index={index} />}
              {own && actions}
              <div className={cn(
                message.attachments?.length && !message.text && !message.references?.length && !message.mentions?.length ? "max-w-[360px]" : "max-w-[min(680px,78%)]",
                own ? "items-end" : "items-start",
              )}>
                <div className={cn(
                  "rounded-2xl px-4 py-3 transition-[background-color,box-shadow] duration-500",
                  highlightedMessageId === message.id && "ring-2 ring-[#65bf45]/45",
                  own
                    ? "rounded-br-md bg-[#e8f6df] text-[#172312] dark:bg-[#24401d] dark:text-white"
                    : "rounded-bl-md bg-[#f5f6f3] text-[#20231f] dark:bg-white/[0.07] dark:text-white",
                )}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{own ? "You" : message.userName}</span>
                    <span className={cn("text-[11px]", own ? "text-[#64755e] dark:text-white/55" : "text-[#8a9087]")}>{chatTime(message.createdAt)}</span>
                  </div>
                  {message.replyTo && (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(message.replyTo.id)}
                      className={cn(
                      "mb-2 block w-full rounded-xl px-3 py-2 text-left text-xs transition hover:bg-black/[0.04] dark:hover:bg-white/[0.08]",
                      own
                        ? "bg-white/55 text-[#42533d] dark:bg-white/10 dark:text-white/70"
                        : "bg-white text-[#596158] dark:bg-black/15 dark:text-white/65",
                    )}
                    >
                      <span className="block font-semibold">{message.replyTo.userName}</span>
                      <span className="block truncate">{message.replyTo.text || message.replyTo.attachmentName || "Attachment"}</span>
                    </button>
                  )}
                  {message.deletedAt ? (
                    <p className="text-sm italic text-[#7b8376] dark:text-white/45">This message was deleted</p>
                  ) : (
                    <>
                      {message.text && <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>}
                      {!!message.references?.length && (
                        <div className="mt-3 flex max-w-full flex-wrap gap-2">
                          {message.references.map((ref) => (
                            <button
                              key={`${message.id}-${ref.id}`}
                              type="button"
                              onClick={() => openReference(ref)}
                              className={cn("max-w-full rounded-lg border px-3 py-2 text-left text-xs transition sm:max-w-[260px]", referenceChipClass(ref.type))}
                            >
                              <span className="block truncate">
                                <b className="capitalize">{ref.type}</b> · {ref.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!!message.mentions?.length && (
                        <div className="mt-3 flex max-w-full flex-wrap gap-1.5">
                          {message.mentions.map((mention) => (
                            <span key={`${message.id}-mention-${mention.id}`} className="rounded-full bg-[#e8f1ff] px-2.5 py-1 text-xs font-semibold text-[#2864cc] dark:bg-blue-400/15 dark:text-blue-100">
                              @{mention.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {!!message.attachments?.length && (
                        <div className="mt-3 grid max-w-[560px] gap-2 sm:grid-cols-2">
                          {message.attachments.map((file) => (
                            <div key={file.id} className="overflow-hidden rounded-xl border border-[#dce2d8] bg-white dark:border-white/10 dark:bg-white/[0.03]">
                              {file.type?.startsWith("image/") ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(file)}
                                  className="block h-44 w-full overflow-hidden bg-[#f1f3ef] text-left dark:bg-white/[0.04]"
                                >
                                  <img src={file.dataUrl} alt={file.name} className="h-full w-full object-cover" />
                                </button>
                              ) : (
                                <a href={file.dataUrl} download={file.name} className="flex items-center gap-3 p-3 text-sm"><Paperclip className="h-4 w-4" />{file.name}</a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {message.editedAt && (
                    <div className="mt-2 text-right text-[10px] text-[#7b8376] dark:text-white/45">
                      edited {chatTime(message.editedAt)}
                    </div>
                  )}
                </div>
              </div>
              {!own && actions}
            </article>
          );
        })}
        {!messages.length && <p className="rounded-xl bg-[#f5f6f3] p-5 text-sm text-[#777d74] dark:bg-white/[0.04]">Start the project conversation here.</p>}
        <div ref={bottomRef} className="h-px" />
      </div>

      <footer className="shrink-0 border-t border-[#e1e5de] bg-white p-2 dark:border-white/10 dark:bg-[#11130f]">
        <div className="relative rounded-2xl bg-white px-3 py-2 dark:bg-white/[0.03]">
          {(replyTo || editingMessage) && (
            <div className="mb-2 flex flex-col gap-2">
              {replyTo && (
                <div className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-400/10 dark:text-blue-100">
                  <div className="min-w-0">
                    <span className="block font-semibold">Replying to {replyTo.userName}</span>
                    <span className="block truncate">{replyTo.text || replyTo.attachments?.[0]?.name || "Attachment"}</span>
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 text-blue-700 dark:text-blue-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {editingMessage && (
                <div className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
                  <div className="min-w-0">
                    <span className="block font-semibold">Editing message</span>
                    <span className="block truncate">{editingMessage.text || editingMessage.attachments?.[0]?.name || "Attachment"}</span>
                  </div>
                  <button type="button" onClick={() => { setEditingMessage(null); setText(""); }} className="shrink-0 text-amber-700 dark:text-amber-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
          <div className={cn("flex flex-wrap gap-2", (pickedRefs.length || pickedMentions.length || attachments.length) ? "mb-2" : "hidden")}>
            {pickedRefs.map((ref) => (
              <button key={ref.id} type="button" onClick={() => toggleReference(ref)} className="rounded-full bg-[#eafbdc] px-3 py-1 text-xs font-semibold text-[#3f7d16]">
                {ref.type}: {ref.title} <X className="ml-1 inline h-3 w-3" />
              </button>
            ))}
            {pickedMentions.map((mention) => (
              <button key={mention.id} type="button" onClick={() => setPickedMentions((current) => current.filter((item) => item.id !== mention.id))} className="rounded-full bg-[#e8f1ff] px-3 py-1 text-xs font-semibold text-[#2864cc] dark:bg-blue-400/15 dark:text-blue-100">
                @{mention.name} <X className="ml-1 inline h-3 w-3" />
              </button>
            ))}
            {attachments.map((file, index) => (
              <button key={`${file.name}-${index}`} type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full bg-[#f1f3ef] px-3 py-1 text-xs font-semibold text-[#555b52] dark:bg-white/[0.08] dark:text-white/70">
                {file.name} <X className="ml-1 inline h-3 w-3" />
              </button>
            ))}
          </div>
          {commandOpen && (
            <div className="absolute bottom-[calc(100%+8px)] left-3 z-10 w-[min(420px,calc(100vw-72px))] rounded-2xl border border-[#e0e5dc] bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#171a16]">
              {!commandType ? (
                <div className="grid gap-1">
                  {[
                    ["task", ListChecks, "Task"],
                    ["phase", Layers3, "Phase"],
                  ].map(([value, Icon, label]) => (
                    <button key={value} type="button" onClick={() => setCommandType(value)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f2f5f1] dark:hover:bg-white/[0.06]">
                      <Icon className="h-4 w-4 text-[#4d8c2f]" />
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#7d8579]">
                    <span>Select {commandType}</span>
                    <button type="button" onClick={() => setCommandType("")} className="text-[#20231f] dark:text-white">Back</button>
                  </div>
                  <div className="max-h-52 space-y-1 overflow-y-auto">
                    {filteredRefs.map((ref) => (
                      <button key={ref.id} type="button" onClick={() => toggleReference(ref)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f2f5f1] dark:hover:bg-white/[0.06]", pickedRefs.some((item) => item.id === ref.id) && "bg-[#f2f5f1] dark:bg-white/[0.06]")}>
                        <span className="min-w-0 truncate">{ref.title}</span>
                        <span className="ml-3 shrink-0 text-xs text-[#858b82]">{ref.meta}</span>
                      </button>
                    ))}
                    {!filteredRefs.length && <p className="px-3 py-4 text-center text-xs text-[#858b82]">No {commandType}s found.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
          {mentionOpen && (
            <div className="absolute bottom-[calc(100%+8px)] left-3 z-10 w-[min(360px,calc(100vw-72px))] rounded-2xl border border-[#e0e5dc] bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#171a16]">
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#7d8579]">Tag person</div>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {filteredMentions.map((member) => (
                  <button key={member.id} type="button" onClick={() => addMention(member)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f2f5f1] dark:hover:bg-white/[0.06]">
                    <Avatar name={member.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{member.name}</span>
                      <span className="block truncate text-xs text-[#858b82]">{member.role}</span>
                    </span>
                  </button>
                ))}
                {!filteredMentions.length && <p className="px-3 py-4 text-center text-xs text-[#858b82]">No people found.</p>}
              </div>
            </div>
          )}
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (editingMessage || !/(?:^|\s)\/([^\n]*)$/.test(event.target.value)) setCommandType("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            rows={1}
            placeholder='Comment or type "/" for commands'
            className="max-h-10 min-h-[32px] w-full resize-none border-0 bg-transparent px-1 py-1.5 pr-24 text-sm leading-5 outline-none placeholder:text-[#a0a69e] dark:text-white"
          />
          <div className="absolute bottom-2 right-3 flex items-center gap-2">
              <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#dce1d8] dark:border-white/10">
                <Paperclip className="h-4 w-4" />
                <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={addFiles} className="hidden" />
              </label>
            <Button variant="primary" className="h-9 px-4" disabled={sending} onClick={sendMessage}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </footer>
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImage.dataUrl}
            alt={previewImage.name}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}

function groupProjectActivity(activity = []) {
  const sorted = [...activity].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const groups = [];
  const quickWindowMs = 2 * 60 * 60 * 1000;
  sorted.forEach((entry) => {
    const type = entry.type || entry.details?.type || inferActivityType(entry.action);
    const parentId = entry.parentId || entry.details?.parentId || entry.details?.phaseId || entry.details?.taskId || entry.details?.documentId || type;
    const label = entry.parentLabel || entry.details?.parentLabel || parentActivityLabel(entry, type);
    const created = Date.parse(entry.createdAt || "") || Date.now();
    const existing = groups.find((group) => group.type === type && group.parentId === parentId && Math.abs(group.latestMs - created) <= quickWindowMs);
    if (existing) {
      existing.entries.push(entry);
      existing.latestMs = Math.max(existing.latestMs, created);
      existing.earliestMs = Math.min(existing.earliestMs, created);
      return;
    }
    groups.push({
      id: `${type}-${parentId}-${created}`,
      type,
      parentId,
      label,
      entries: [entry],
      latestMs: created,
      earliestMs: created,
      firstUser: entry.userName,
    });
  });
  return groups.map((group) => ({
    ...group,
    entries: group.entries.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    timeLabel: group.latestMs === group.earliestMs
      ? new Date(group.latestMs).toLocaleString("en-IN")
      : `${new Date(group.earliestMs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} - ${new Date(group.latestMs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
  }));
}

function inferActivityType(action = "") {
  if (/phase/i.test(action)) return "phase";
  if (/task|assignee|comment|due date|status/i.test(action)) return "task";
  if (/file/i.test(action)) return "file";
  if (/access/i.test(action)) return "access";
  return "project";
}

function parentActivityLabel(entry, type) {
  if (type === "access") return "Project access";
  if (type === "file") return "Files";
  return entry.target || "Project activity";
}

function fmtProjectStock(value, digits = 1) {
  const number = Number(value) || 0;
  return number.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function FilesView({
  project,
  documents,
  isSuperAdmin,
  onAddFile,
  onEditFile,
  onDeleteFile,
}) {
  return (
    <div className="mx-auto max-w-[1250px] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Project files</h2>
          <p className="mt-0.5 text-xs text-[#7b8178]">
            Documents and links connected to this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          {(project.driveFolderId || project.driveFolderLink) && (
            <a
              href={
                project.driveFolderLink ||
                `https://drive.google.com/drive/folders/${project.driveFolderId}`
              }
              target="_blank"
              rel="noreferrer"
            >
              <Button>
                <FolderOpen className="h-4 w-4" />
                Open Drive
              </Button>
            </a>
          )}
          {isSuperAdmin && (
            <Button variant="primary" onClick={onAddFile}>
              <FilePlus2 className="h-4 w-4" />
              Add file
            </Button>
          )}
        </div>
      </div>
      {!(project.driveFolderId || project.driveFolderLink) && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Connect a Google Drive folder in project settings to enable folder
          sync and uploads.
        </div>
      )}
      <section className="mt-5 overflow-hidden rounded-2xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <div className="hidden grid-cols-[minmax(280px,1.5fr)_140px_140px_130px_220px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]">
          <span>Name</span>
          <span>Category</span>
          <span>Source</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>
        {documents.map((doc) => (
          <div
            key={doc.id || doc.driveFileId || doc.url}
            className="grid gap-3 border-b border-[#e9ebe7] px-4 py-3.5 last:border-0 md:grid-cols-[minmax(280px,1.5fr)_140px_140px_130px_220px] md:items-center dark:border-white/10"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3ff] text-[#5874bd] dark:bg-blue-400/10 dark:text-blue-300">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {doc.name || "Untitled file"}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#858b82]">
                  {doc.url || "Drive file"}
                </span>
              </span>
            </span>
            <span className="text-xs text-[#6d736a] dark:text-white/50">
              {doc.category || "General"}
            </span>
            <span className="text-xs text-[#6d736a] dark:text-white/50">
              {doc.driveFileId ? "Google Drive" : "Linked file"}
            </span>
            <span className="text-xs text-[#6d736a] dark:text-white/50">
              {doc.uploadedAt
                ? formatDate(String(doc.uploadedAt).slice(0, 10))
                : "Unknown"}
            </span>
            <span className="flex flex-wrap items-center gap-2 md:justify-end">
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg bg-[#f0f2ee] px-3 text-xs font-semibold text-[#4f554c] hover:bg-[#e7eae4] dark:bg-white/[0.06] dark:text-white/65"
                >
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => onEditFile(doc)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d9ddd6] px-2.5 text-xs font-semibold text-[#4f554c] hover:bg-[#f6f7f4] dark:border-white/10 dark:text-white/65 dark:hover:bg-white/[0.05]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => onDeleteFile(doc)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </span>
          </div>
        ))}
        {!documents.length && (
          <div className="px-6 py-16 text-center">
            <Paperclip className="mx-auto h-7 w-7 text-[#9ca199]" />
            <h3 className="mt-3 text-sm font-semibold">No files connected</h3>
            <p className="mt-1 text-xs text-[#858b82]">
              Add a link or upload the first project document.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProjectDashboard({ darkMode, projectId = null }) {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const userMenus = user?.menus || [];
  const userPrivileges = user?.privileges || [];
  const canEditProjectControl = isSuperAdmin || userPrivileges.includes("manage_project_control");
  const canOpenProjectDmr = isSuperAdmin || userMenus.includes("project-dmr");
  const canOpenProjectMrn = isSuperAdmin || userMenus.includes("project-mrn");
  const workspaceNav = useMemo(
    () => WORKSPACE_NAV.filter((item) => {
      if (item.value === "manpower") return canOpenProjectDmr;
      if (item.value === "mrn") return canOpenProjectMrn;
      return true;
    }),
    [canOpenProjectDmr, canOpenProjectMrn],
  );
  const [data, setData] = useState({ projects: [], totals: {} });
  const [config, setConfig] = useState({ projects: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [portfolioLayout, setPortfolioLayout] = useState("grid");
  const [selected, setSelected] = useState(null);
  const [workspaceView, setWorkspaceView] = useState("overview");
  const [driveDocs, setDriveDocs] = useState([]);
  const [taskEditor, setTaskEditor] = useState(null);
  const [phaseEditor, setPhaseEditor] = useState(null);
  const [returnPhaseEditor, setReturnPhaseEditor] = useState(null);
  const [calendarMrn, setCalendarMrn] = useState(null);
  const [calendarMrnData, setCalendarMrnData] = useState(null);
  const [projectEditor, setProjectEditor] = useState(null);
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [accessDrawerOpen, setAccessDrawerOpen] = useState(false);
  const [projectReportOpen, setProjectReportOpen] = useState(false);
  const [accessData, setAccessData] = useState({ access: [], users: [], canManage: false });
  const [fileEditor, setFileEditor] = useState(null);
  const [fileForm, setFileForm] = useState({
    name: "",
    category: "General",
    url: "",
  });
  const [chatUnread, setChatUnread] = useState(0);
  const [chatMentionUnread, setChatMentionUnread] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      try {
        quiet ? setRefreshing(true) : setLoading(true);
        const dashboard = await api("/project-dashboard");
        setData(dashboard);
        setSelected((current) =>
          current
            ? dashboard.projects.find((project) => project.id === current.id) ||
              null
            : null,
        );
        setConfig(await api("/project-dashboard/config"));
      } catch (error) {
        toast.error(error.message || "Could not load projects");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  const loadProjectDocs = useCallback(async (id) => {
    if (!id) return setDriveDocs([]);
    try {
      const result = await api(`/project-dashboard/projects/${id}/documents`);
      setDriveDocs(result.documents || []);
    } catch {
      setDriveDocs([]);
    }
  }, []);

  useEffect(() => {
    // Initial dashboard synchronization is intentionally owned by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const routeProject = projectId
    ? data.projects.find((project) => String(project.id) === String(projectId))
    : null;
  const selectedProject =
    routeProject ||
    (selected
      ? data.projects.find((project) => project.id === selected.id) || selected
      : null);

  useEffect(() => {
    // Refresh the external Drive listing whenever the focused project changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjectDocs(selectedProject?.id);
  }, [loadProjectDocs, selectedProject?.id]);

  useEffect(() => {
    if (!workspaceNav.some((item) => item.value === workspaceView)) {
      setWorkspaceView("overview");
    }
  }, [workspaceNav, workspaceView]);

  useEffect(() => {
    if (workspaceView === "chat") {
      setChatUnread(0);
      setChatMentionUnread(0);
    }
  }, [workspaceView, selectedProject?.id]);

  useEffect(() => {
    if (!selectedProject?.id) return undefined;
    const token = getAuthToken();
    if (!token) return undefined;
    const source = new EventSource(`${API_URL}/project-dashboard/projects/${selectedProject.id}/chat/stream?token=${encodeURIComponent(token)}`);
    source.addEventListener("message", (event) => {
      const message = JSON.parse(event.data || "{}");
      if (!message.id || String(message.userId || "") === String(user?.id || "")) return;
      if (workspaceView !== "chat") {
        setChatUnread((count) => count + 1);
        if ((message.mentions || []).some((mention) => String(mention.id) === String(user?.id || ""))) {
          setChatMentionUnread((count) => count + 1);
        }
      }
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, [selectedProject?.id, user?.id, workspaceView]);

  const users = config.users || [];
  const projects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data.projects || []).filter(
      (project) =>
        !query ||
        [
          project.name,
          project.code,
          project.client,
          project.location,
          project.manager,
          ...(project.manualTasks || []).map((task) => task.title),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
  }, [data.projects, search]);
  const phases = selectedProject?.phases || [];
  const tasks = selectedProject?.manualTasks || [];
  const documents = useMemo(() => {
    const byKey = new Map(
      [...driveDocs, ...(selectedProject?.projectDocuments || [])].map(
        (doc) => [doc.driveFileId || doc.url || doc.id, doc],
      ),
    );
    return [...byKey.values()];
  }, [driveDocs, selectedProject?.projectDocuments]);
  const canManageProjectAccess = Boolean(canEditProjectControl || selectedProject?.access?.canManage);
  const canEditSelectedProject = Boolean(canEditProjectControl || selectedProject?.access?.canEdit);

  function fullProject(project) {
    return (
      (config.projects || []).find((item) => item.id === project?.id) || project
    );
  }

  function openProject(project) {
    setSelected(project);
    setWorkspaceView("overview");
    router.push(`/projects/${project.id}`);
  }

  function closeProject() {
    setSelected(null);
    setTaskEditor(null);
    setPhaseEditor(null);
    setCalendarMrn(null);
    setCalendarMrnData(null);
    setFileDrawerOpen(false);
    setFileEditor(null);
    setTeamDrawerOpen(false);
    setAccessDrawerOpen(false);
    router.push("/projects");
  }

  async function openAccessDrawer() {
    if (!selectedProject) return;
    try {
      const result = await api(`/project-dashboard/projects/${selectedProject.id}/access`);
      setAccessData({
        access: result.access || [],
        users: result.users || [],
        canManage: Boolean(result.canManage),
      });
      setAccessDrawerOpen(true);
    } catch (error) {
      toast.error(error.message || "Could not load project access");
    }
  }

  async function saveProjectAccess(nextAccess) {
    if (!selectedProject) return;
    try {
      setAccessSaving(true);
      const result = await api(`/project-dashboard/projects/${selectedProject.id}/access`, {
        method: "PATCH",
        body: JSON.stringify({ access: nextAccess }),
      });
      setAccessData((current) => ({ ...current, access: result.access || [] }));
      toast.success("Project access updated");
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not update project access");
    } finally {
      setAccessSaving(false);
    }
  }

  async function patchProject(project, payload, message) {
    try {
      setSaving(true);
      const result = await api(`/project-dashboard/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (message) toast.success(message);
      await load(true);
      return result.project;
    } catch (error) {
      toast.error(error.message || "Could not save changes");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function openTask(task) {
    setReturnPhaseEditor(null);
    setTaskEditor(JSON.parse(JSON.stringify(task)));
  }

  function addTask(phaseId = "", status = "todo") {
    const resolvedPhase = phaseId || phases[0]?.id || "";
    setReturnPhaseEditor(null);
    setTaskEditor({ ...blankTask(resolvedPhase), status });
  }

  function closeTaskDrawer() {
    setTaskEditor(null);
    if (returnPhaseEditor) {
      setPhaseEditor(returnPhaseEditor);
      setReturnPhaseEditor(null);
    }
  }

  async function saveTask(addNew = false) {
    if (!selectedProject || !taskEditor?.title.trim()) return;
    const nextPhaseId = taskEditor.phaseId;
    const nextStatus = taskEditor.status || "todo";
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    const cleanTask = completeSubtasksWhenTaskDone({ ...taskEditor });
    delete cleanTask.__isNew;
    source.phases = (source.phases || []).map((phase) => ({
      ...phase,
      tasks: (phase.tasks || []).filter((task) => task.id !== cleanTask.id),
    }));
    source.tasks = (source.tasks || []).filter(
      (task) => task.id !== cleanTask.id,
    );
    const targetPhase = source.phases.find(
      (phase) => phase.id === cleanTask.phaseId,
    );
    if (targetPhase)
      targetPhase.tasks = [...(targetPhase.tasks || []), cleanTask];
    else source.tasks = [...source.tasks, cleanTask];
    const updated = await patchProject(
      selectedProject,
      source,
      taskEditor.__isNew ? "Task created" : "Task updated",
    );
    if (updated) {
      if (addNew) {
        setTaskEditor({ ...blankTask(nextPhaseId), status: nextStatus });
      } else {
        closeTaskDrawer();
      }
    }
  }

  async function performDeleteTask() {
    if (!selectedProject || !taskEditor) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    source.phases = (source.phases || []).map((phase) => ({
      ...phase,
      tasks: (phase.tasks || []).filter((task) => task.id !== taskEditor.id),
    }));
    source.tasks = (source.tasks || []).filter(
      (task) => task.id !== taskEditor.id,
    );
    const updated = await patchProject(selectedProject, source, "Task deleted");
    if (updated) closeTaskDrawer();
  }

  function deleteTask() {
    if (!selectedProject || !taskEditor) return;
    setDeleteConfirm({
      title: "Delete task",
      message: `Delete "${taskEditor.title}"? This action cannot be undone.`,
      onConfirm: performDeleteTask,
    });
  }

  function openPhase(phase) {
    setPhaseEditor(JSON.parse(JSON.stringify(phase)));
  }

  function openCalendarMrn(row, sourceData = null) {
    setCalendarMrn(row);
    setCalendarMrnData(sourceData);
  }

  function addPhase() {
    setPhaseEditor(blankPhase());
  }

  async function savePhase() {
    if (!selectedProject || !phaseEditor?.name.trim()) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    const cleanPhase = { ...phaseEditor };
    delete cleanPhase.__isNew;
    source.phases = phaseEditor.__isNew
      ? [...(source.phases || []), cleanPhase]
      : (source.phases || []).map((phase) =>
          phase.id === cleanPhase.id ? cleanPhase : phase,
        );
    const updated = await patchProject(
      selectedProject,
      source,
      phaseEditor.__isNew ? "Phase created" : "Phase updated",
    );
    if (updated) setPhaseEditor(null);
  }

  async function performDeletePhase() {
    if (!selectedProject || !phaseEditor) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    source.phases = (source.phases || []).filter(
      (phase) => phase.id !== phaseEditor.id,
    );
    const updated = await patchProject(
      selectedProject,
      source,
      "Phase deleted",
    );
    if (updated) setPhaseEditor(null);
  }

  function deletePhase() {
    if (!selectedProject || !phaseEditor) return;
    if (tasks.some((task) => task.phaseId === phaseEditor.id))
      return toast.error(
        "Move or delete this phase's tasks before deleting the phase",
      );
    setDeleteConfirm({
      title: "Delete phase",
      message: `Delete "${phaseEditor.name}"? This action cannot be undone.`,
      onConfirm: performDeletePhase,
    });
  }

  function editProject(project = null) {
    setProjectEditor(
      JSON.parse(
        JSON.stringify(project ? fullProject(project) : blankProject()),
      ),
    );
  }

  async function saveProject() {
    if (!projectEditor?.name.trim()) return;
    try {
      setSaving(true);
      if (projectEditor.id) {
        await api(`/project-dashboard/projects/${projectEditor.id}`, {
          method: "PATCH",
          body: JSON.stringify(projectEditor),
        });
        toast.success("Project updated");
      } else {
        await api("/project-dashboard/projects", {
          method: "POST",
          body: JSON.stringify(projectEditor),
        });
        toast.success("Project created");
      }
      setProjectEditor(null);
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not save project");
    } finally {
      setSaving(false);
    }
  }

  async function performDeleteProject() {
    if (!projectEditor?.id) return;
    try {
      setSaving(true);
      await api(`/project-dashboard/projects/${projectEditor.id}`, {
        method: "DELETE",
      });
      toast.success("Project deleted");
      setProjectEditor(null);
      setSelected(null);
      router.push("/projects");
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not delete project");
    } finally {
      setSaving(false);
    }
  }

  function deleteProject() {
    if (!projectEditor?.id) return;
    setDeleteConfirm({
      title: "Delete project",
      message: `Delete "${projectEditor.name}"? This cannot be undone.`,
      onConfirm: performDeleteProject,
    });
  }

  function closeFileDrawer() {
    setFileDrawerOpen(false);
    setFileEditor(null);
    setFileForm({ name: "", category: "General", url: "" });
  }

  function openFileDrawer(doc = null) {
    setFileEditor(doc ? JSON.parse(JSON.stringify(doc)) : null);
    setFileForm({
      name: doc?.name || "",
      category: doc?.category || "General",
      url: doc?.url || "",
    });
    setFileDrawerOpen(true);
  }

  async function addDocumentLink() {
    if (!selectedProject || !fileForm.url.trim()) return;
    const documentId =
      fileEditor && (fileEditor.id || fileEditor.driveFileId || fileEditor.url);
    if (fileEditor && !documentId)
      return toast.error("This file cannot be edited");
    try {
      setSaving(true);
      if (fileEditor) {
        await api(
          `/project-dashboard/projects/${selectedProject.id}/documents/${encodeURIComponent(documentId)}`,
          { method: "PATCH", body: JSON.stringify(fileForm) },
        );
        toast.success("File updated");
      } else {
        await api(
          `/project-dashboard/projects/${selectedProject.id}/documents`,
          { method: "POST", body: JSON.stringify(fileForm) },
        );
        toast.success("Document linked");
      }
      closeFileDrawer();
      await Promise.all([loadProjectDocs(selectedProject.id), load(true)]);
    } catch (error) {
      toast.error(error.message || "Could not save document");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedProject) return;
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      form.append("category", fileForm.category || "General");
      await apiForm(
        `/project-dashboard/projects/${selectedProject.id}/documents/upload`,
        form,
      );
      toast.success("File uploaded to Drive");
      closeFileDrawer();
      await Promise.all([loadProjectDocs(selectedProject.id), load(true)]);
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function performDeleteDocument(doc) {
    const documentId = doc?.id || doc?.driveFileId || doc?.url;
    if (!selectedProject || !documentId) return;
    try {
      setSaving(true);
      await api(
        `/project-dashboard/projects/${selectedProject.id}/documents/${encodeURIComponent(documentId)}`,
        { method: "DELETE" },
      );
      toast.success("File removed");
      await Promise.all([loadProjectDocs(selectedProject.id), load(true)]);
    } catch (error) {
      toast.error(error.message || "Could not remove file");
    } finally {
      setSaving(false);
    }
  }

  function deleteDocument(doc) {
    const documentId = doc?.id || doc?.driveFileId || doc?.url;
    if (!selectedProject || !documentId) return;
    setDeleteConfirm({
      title: "Remove file",
      message: `Remove "${doc?.name || "this file"}" from project files?`,
      confirmLabel: "Remove",
      onConfirm: () => performDeleteDocument(doc),
    });
  }

  if (loading) return <LoadingView darkMode={darkMode} />;

  if (!selectedProject) {
    return (
      <>
        <PortfolioView
          darkMode={darkMode}
          projects={projects}
          users={users}
          search={search}
          onSearch={setSearch}
          layout={portfolioLayout}
          onLayout={setPortfolioLayout}
          refreshing={refreshing}
          isSuperAdmin={canEditProjectControl}
          onRefresh={() => load(true)}
          onCreate={() => editProject()}
          onOpen={openProject}
        />
        {projectEditor && (
          <ProjectEditor
            darkMode={darkMode}
            project={projectEditor}
            users={users}
            saving={saving}
            onChange={(patch) =>
              setProjectEditor((current) => ({ ...current, ...patch }))
            }
            onClose={() => setProjectEditor(null)}
            onSave={saveProject}
            onDelete={deleteProject}
          />
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden",
        darkMode ? "bg-[#11130f] text-white" : "bg-[#f7f8f5] text-[#20231f]",
      )}
    >
      <WorkspaceRail
        project={selectedProject}
        view={workspaceView}
        onView={setWorkspaceView}
        tasks={tasks}
        documents={documents}
        users={users}
        onOpenTeam={() => setTeamDrawerOpen(true)}
        navItems={workspaceNav}
        unreadCounts={{ chat: chatUnread, chatMentions: chatMentionUnread }}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e0e4dd] bg-white px-3 sm:px-4 dark:border-white/10 dark:bg-[#171a16]">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton label="Back to projects" onClick={closeProject}>
              <ArrowLeft className="h-4 w-4" />
            </IconButton>
            <div className="hidden h-5 w-px bg-[#e0e4dd] sm:block dark:bg-white/10" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base text-[#777d74] dark:text-white/45">
                <span className="hidden sm:inline">Projects</span>
                <ChevronRight className="hidden h-4 w-4 sm:block" />
                <span className="truncate font-semibold text-[#30342e] dark:text-white/80">
                  {selectedProject.name}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton label="Refresh project" onClick={() => load(true)}>
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
            </IconButton>
            <Button
              className="!h-8 !rounded-full !px-2.5 !text-[11px] !font-semibold shadow-sm"
              onClick={() => setProjectReportOpen(true)}
            >
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">Project report</span>
            </Button>
            <Button
              className="!h-8 !rounded-full !px-2.5 !text-[11px] !font-semibold shadow-sm"
              onClick={openAccessDrawer}
            >
              <ShieldCheck className="h-3 w-3" />
              <span className="hidden sm:inline">Access</span>
            </Button>
            {canEditSelectedProject && (
              <Button
                variant="primary"
                className="!h-8 !rounded-full !px-2.5 !text-[11px] !font-semibold shadow-sm"
                onClick={() => editProject(selectedProject)}
              >
                <Pencil className="h-3 w-3" />
                <span className="hidden sm:inline">Edit project</span>
              </Button>
            )}
          </div>
        </header>
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e0e4dd] bg-white px-3 py-2 md:hidden dark:border-white/10 dark:bg-[#171a16]">
          {workspaceNav.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setWorkspaceView(value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs",
                workspaceView === value
                  ? "bg-[#20231f] font-semibold text-white dark:bg-[#d8f36a] dark:text-[#11150f]"
                  : "text-[#676d64] dark:text-white/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {value === "chat" && chatUnread > 0 && (
                <span className={cn("ml-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white", chatMentionUnread > 0 ? "bg-[#65bf45]" : "bg-[#2f7cff]")}>
                  {chatMentionUnread > 0 ? "@" : chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
            </button>
          ))}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto">
          {workspaceView === "overview" && (
            <OverviewView
              project={selectedProject}
              tasks={tasks}
              phases={phases}
              documents={documents}
              users={users}
              isSuperAdmin={canEditSelectedProject}
              onOpenTask={openTask}
              onAddTask={() => addTask()}
              onOpenPhase={openPhase}
            />
          )}
          {workspaceView === "tasks" && (
            <TasksView
              darkMode={darkMode}
              tasks={tasks}
              phases={phases}
              users={users}
              isSuperAdmin={canEditSelectedProject}
              onOpenTask={openTask}
              onAddTask={addTask}
            />
          )}
          {workspaceView === "calendar" && (
            <ProjectCalendarView
              project={selectedProject}
              phases={phases}
              tasks={tasks}
              onOpenTask={openTask}
              onOpenPhase={openPhase}
              onOpenMrn={openCalendarMrn}
            />
          )}
          {workspaceView === "manpower" && (
            <ProjectManpowerView darkMode={darkMode} project={selectedProject} />
          )}
          {workspaceView === "mrn" && (
            <ProjectMrnView darkMode={darkMode} project={selectedProject} />
          )}
          {workspaceView === "stock" && (
            <ProjectStockView darkMode={darkMode} project={selectedProject} />
          )}
          {workspaceView === "chat" && (
            <ProjectChatView
              project={selectedProject}
              tasks={tasks}
              phases={phases}
              users={users}
              onOpenTask={openTask}
              onOpenPhase={openPhase}
            />
          )}
          {workspaceView === "activity" && (
            <ProjectActivityView project={selectedProject} />
          )}
          {workspaceView === "phases" && (
            <PhasesView
              phases={phases}
              tasks={tasks}
              isSuperAdmin={canEditSelectedProject}
              onOpenPhase={openPhase}
              onAddPhase={addPhase}
              onAddTask={addTask}
            />
          )}
          {workspaceView === "files" && (
            <FilesView
              project={selectedProject}
              documents={documents}
              isSuperAdmin={canEditSelectedProject}
              onAddFile={() => openFileDrawer()}
              onEditFile={openFileDrawer}
              onDeleteFile={deleteDocument}
            />
          )}
        </main>
      </div>

      {taskEditor && (
        <TaskDrawer
          darkMode={darkMode}
          task={taskEditor}
          project={selectedProject}
          users={users}
          phases={phases}
          documents={documents}
          allTasks={tasks}
          currentUser={user}
          saving={saving}
          editable={canEditSelectedProject}
          onChange={(patch) =>
            setTaskEditor((current) => ({ ...current, ...patch }))
          }
          onClose={closeTaskDrawer}
          onSave={saveTask}
          onSaveAddNew={() => saveTask(true)}
          onDelete={deleteTask}
        />
      )}
      {phaseEditor && (
        <PhaseDrawer
          darkMode={darkMode}
          phase={phaseEditor}
          tasks={tasks.filter((task) => task.phaseId === phaseEditor.id)}
          users={users}
          saving={saving}
          editable={canEditSelectedProject}
          onChange={(patch) =>
            setPhaseEditor((current) => ({ ...current, ...patch }))
          }
          onClose={() => setPhaseEditor(null)}
          onSave={savePhase}
          onDelete={deletePhase}
          onAddTask={() => {
            const phaseId = phaseEditor.id;
            setPhaseEditor(null);
            addTask(phaseId);
          }}
          onOpenTask={(task) => {
            setReturnPhaseEditor(phaseEditor ? JSON.parse(JSON.stringify(phaseEditor)) : null);
            setPhaseEditor(null);
            setTaskEditor({ ...task });
          }}
        />
      )}
      {calendarMrn && (
        <MrnDetailDrawer
          darkMode={darkMode}
          row={calendarMrn}
          canViewHistory={Boolean(calendarMrnData?.canViewMrnHistory)}
          onClose={() => setCalendarMrn(null)}
          onLoadHistory={(row) => api(`/mrn-dashboard/${encodeURIComponent(row.mrnNo)}/history`)}
        />
      )}
      {projectEditor && (
        <ProjectEditor
          darkMode={darkMode}
          project={projectEditor}
          users={users}
          saving={saving}
          onChange={(patch) =>
            setProjectEditor((current) => ({ ...current, ...patch }))
          }
          onClose={() => setProjectEditor(null)}
          onSave={saveProject}
          onDelete={deleteProject}
        />
      )}
      {teamDrawerOpen && (
        <TeamDrawer
          project={selectedProject}
          tasks={tasks}
          users={users}
          onClose={() => setTeamDrawerOpen(false)}
        />
      )}
      {accessDrawerOpen && (
        <ProjectAccessDrawer
          project={selectedProject}
          phases={phases}
          tasks={tasks}
          users={accessData.users.length ? accessData.users : users}
          access={accessData.access}
          canManage={Boolean(accessData.canManage || canManageProjectAccess)}
          saving={accessSaving}
          onSave={saveProjectAccess}
          onClose={() => setAccessDrawerOpen(false)}
        />
      )}
      {projectReportOpen && (
        <ProjectReportDrawer
          darkMode={darkMode}
          project={selectedProject}
          tasks={tasks}
          phases={phases}
          users={users}
          onClose={() => setProjectReportOpen(false)}
        />
      )}
      {fileDrawerOpen && (
        <FileDrawer
          darkMode={darkMode}
          form={fileForm}
          editing={Boolean(fileEditor)}
          canUpload={Boolean(
            selectedProject.driveFolderId || selectedProject.driveFolderLink,
          )}
          uploading={uploading}
          onChange={(patch) =>
            setFileForm((current) => ({ ...current, ...patch }))
          }
          onClose={closeFileDrawer}
          onAddLink={addDocumentLink}
          onUpload={uploadDocument}
        />
      )}
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.title}
        message={deleteConfirm?.message}
        confirmLabel={deleteConfirm?.confirmLabel || "Delete"}
        loading={saving}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          const action = deleteConfirm?.onConfirm;
          if (!action) return;
          await action();
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
}
