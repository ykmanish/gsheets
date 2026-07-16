"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Columns3,
  Download,
  FilePlus2,
  FileText,
  Filter,
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
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";

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

const DOC_CATEGORIES = ["Drawing", "Agreement", "Quotation", "Approval", "Bill", "Site photo", "General"];

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
  const response = await fetch(`${API_URL}${path}`, { method: "POST", body: formData });
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
    comments: [],
    __isNew: true,
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
    dmr: { enabled: false, spreadsheetId: "", siteNames: [], agencyNames: [], assignedUserIds: [], editableUserIds: [] },
  };
}

function formatDate(value, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
  return String(name).trim().split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || "Not started";
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Button({ children, variant = "default", className = "", ...props }) {
  const variants = {
    default: "border border-[#d9ddd6] bg-white text-[#20231f] hover:bg-[#f6f7f4] dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/10",
    primary: "border border-[#20231f] bg-[#20231f] text-white hover:bg-black dark:border-[#7ddb58] dark:bg-[#7ddb58] dark:text-[#11150f]",
    accent: "border border-[#71c94e] bg-[#78d455] text-[#13200e] hover:bg-[#6bc248]",
    ghost: "border border-transparent text-[#60655d] hover:bg-black/[0.04] dark:text-white/60 dark:hover:bg-white/[0.06]",
    danger: "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
  };
  return <button type="button" className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45", variants[variant], className)} {...props}>{children}</button>;
}

function IconButton({ label, className = "", children, ...props }) {
  return <button type="button" aria-label={label} title={label} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#63685f] transition hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white", className)} {...props}>{children}</button>;
}

function Avatar({ name, index = 0, size = "md", className = "" }) {
  const colors = ["bg-[#2e8b70]", "bg-[#637dd8]", "bg-[#b06f9f]", "bg-[#c47a45]", "bg-[#77883c]"];
  const sizes = size === "sm" ? "h-6 w-6 text-[9px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-8 w-8 text-[10px]";
  return <span title={name} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white dark:ring-[#171915]", colors[index % colors.length], sizes, className)}>{initials(name)}</span>;
}

function AvatarStack({ names = [], limit = 4 }) {
  return (
    <span className="flex items-center -space-x-2">
      {names.slice(0, limit).map((name, index) => <Avatar key={`${name}-${index}`} name={name} index={index} />)}
      {names.length > limit && <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eceee9] text-[10px] font-bold text-[#5f645c] ring-2 ring-white dark:bg-white/10 dark:text-white/70 dark:ring-[#171915]">+{names.length - limit}</span>}
    </span>
  );
}

function ProgressBar({ value = 0, className = "" }) {
  return <span className={cn("block h-1.5 overflow-hidden rounded-full bg-[#e8ebe5] dark:bg-white/10", className)}><span className="block h-full rounded-full bg-[#72cf50] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}

function StatusPill({ status, count, compact = false }) {
  const styles = {
    todo: "bg-[#eef0ec] text-[#51564e] dark:bg-white/10 dark:text-white/65",
    in_progress: "bg-[#fff0c9] text-[#8a6312] dark:bg-amber-400/15 dark:text-amber-200",
    blocked: "bg-[#ffe2e4] text-[#a93b47] dark:bg-rose-400/15 dark:text-rose-200",
    done: "bg-[#dff6d7] text-[#367b25] dark:bg-green-400/15 dark:text-green-200",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold", compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs", styles[status] || styles.todo)}><span className={cn("h-2 w-2 rounded-full border-2", status === "done" ? "border-[#63bd43] bg-[#63bd43]" : status === "blocked" ? "border-[#d95b67]" : status === "in_progress" ? "border-[#d8a62e]" : "border-[#8c9288]")} />{statusLabel(status)}{typeof count === "number" && <span className="ml-0.5 opacity-60">{count}</span>}</span>;
}

function PriorityPill({ priority = "medium" }) {
  const styles = {
    low: "bg-[#eef1ec] text-[#5f675b]",
    medium: "bg-[#fff2cc] text-[#836115]",
    high: "bg-[#ffe2d2] text-[#9b4a25]",
    critical: "bg-[#ffe0e4] text-[#a63644]",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold capitalize dark:bg-white/10 dark:text-white/70", styles[priority] || styles.medium)}><Flag className="h-3 w-3" />{priority}</span>;
}

function Field({ label, icon: Icon, hint, children, className = "" }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[#666c63] dark:text-white/50">
        <span className="flex items-center gap-1.5">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>{hint && <span className="text-[10px] opacity-70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#dfe3dc] bg-white px-3 text-sm text-[#20231f] outline-none transition placeholder:text-[#a4a9a1] focus:border-[#9acb87] focus:ring-2 focus:ring-[#72cf50]/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25";
const textAreaClass = "w-full resize-none rounded-lg border border-[#dfe3dc] bg-white px-3 py-2.5 text-sm leading-6 text-[#20231f] outline-none transition placeholder:text-[#a4a9a1] focus:border-[#9acb87] focus:ring-2 focus:ring-[#72cf50]/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25";

function NativeSelect({ value, onChange, options, className = "", disabled = false }) {
  return (
    <span className="relative block">
      <select value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={cn(inputClass, "appearance-none pr-9 disabled:cursor-default disabled:bg-[#f4f5f2] disabled:text-[#656b62] dark:disabled:bg-white/[0.025]", className)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747a71]" />
    </span>
  );
}

function AssigneePicker({ users, selectedIds, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const selected = users.filter((item) => selectedIds.includes(item.id));
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((current) => !current)} className={cn(inputClass, "flex min-h-10 h-auto items-center justify-between gap-2 py-1.5 text-left disabled:cursor-default disabled:bg-[#f4f5f2] dark:disabled:bg-white/[0.025]")}>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {selected.length ? selected.map((person, index) => <span key={person.id} className="inline-flex items-center gap-1 rounded-full bg-[#eef1ec] py-1 pl-1 pr-2 text-xs dark:bg-white/10"><Avatar name={person.displayName || person.username} index={index} size="sm" />{person.displayName || person.username}</span>) : <span className="text-[#a4a9a1]">Assign people</span>}
        </span>
        <UserPlus className="h-4 w-4 shrink-0 text-[#747a71]" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] max-h-64 overflow-y-auto rounded-xl border border-[#dfe3dc] bg-white p-1.5 shadow-[0_16px_40px_rgba(20,28,18,0.14)] dark:border-white/10 dark:bg-[#1c1f1a]">
          {users.map((person, index) => {
            const active = selectedIds.includes(person.id);
            return <button key={person.id} type="button" onClick={() => onChange(active ? selectedIds.filter((id) => id !== person.id) : [...selectedIds, person.id])} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[#f4f6f2] dark:hover:bg-white/[0.06]"><span className={cn("flex h-4 w-4 items-center justify-center rounded border", active ? "border-[#69c549] bg-[#69c549] text-white" : "border-[#cfd4cc]")}>{active && <Check className="h-3 w-3" />}</span><Avatar name={person.displayName || person.username} index={index} size="sm" /><span className="min-w-0"><span className="block truncate font-medium">{person.displayName || person.username}</span><span className="block truncate text-[11px] text-[#858b82]">{person.username}</span></span></button>;
          })}
          {!users.length && <p className="p-4 text-center text-xs text-[#858b82]">No users available</p>}
        </div>
      )}
    </div>
  );
}

function SlideOver({ title, eyebrow, onClose, width = "max-w-[560px]", children, footer }) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-[#11150f]/20 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={title} className={cn("flex h-full w-full flex-col border-l border-[#dfe3dc] bg-[#fbfcfa] text-[#20231f] shadow-[-18px_0_60px_rgba(28,36,24,0.12)] dark:border-white/10 dark:bg-[#141713] dark:text-white", width)}>
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e4e7e1] bg-white px-5 dark:border-white/10 dark:bg-[#171a16]">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#737970] dark:text-white/45">
            {eyebrow && <span className="truncate">{eyebrow}</span>}
            {eyebrow && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate font-medium text-[#30342e] dark:text-white/75">{title}</span>
          </div>
          <div className="flex items-center gap-0.5"><IconButton label="More actions"><MoreHorizontal className="h-4 w-4" /></IconButton><IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton></div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        {footer && <footer className="shrink-0 border-t border-[#e4e7e1] bg-white px-5 py-3 dark:border-white/10 dark:bg-[#171a16]">{footer}</footer>}
      </aside>
    </div>
  );
}

function PropertyRow({ icon: Icon, label, children }) {
  return <div className="grid min-h-10 grid-cols-[112px_minmax(0,1fr)] items-center gap-3"><span className="flex items-center gap-2 text-xs text-[#777d74] dark:text-white/45"><Icon className="h-3.5 w-3.5" />{label}</span><div className="min-w-0">{children}</div></div>;
}

function LoadingView({ darkMode }) {
  return <div className={cn("flex min-h-0 flex-1 items-center justify-center", darkMode ? "bg-[#10120f] text-white" : "bg-[#f4f5f2] text-[#20231f]")}><div className="flex items-center gap-3 rounded-xl border border-[#dfe3dc] bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"><Loader2 className="h-5 w-5 animate-spin text-[#61b642]" /><span className="text-sm font-medium">Loading project workspace...</span></div></div>;
}

function TaskDrawer({ task, project, users, phases, documents, allTasks, currentUser, saving, editable, onChange, onClose, onSave, onDelete }) {
  const [tab, setTab] = useState("details");
  const [comment, setComment] = useState("");
  const assignees = users.filter((person) => (task.assigneeIds || []).includes(person.id));
  const attachments = documents.filter((doc) => (task.documentIds || []).includes(doc.id) || (doc.driveFileId && (task.documentIds || []).includes(doc.driveFileId))).slice(0, 6);
  const dependencies = allTasks.filter((item) => (task.dependencyIds || []).includes(item.id));

  function addComment() {
    if (!comment.trim()) return;
    onChange({
      comments: [...(task.comments || []), {
        id: uid("comment"),
        text: comment.trim(),
        authorId: currentUser?.id || "",
        authorName: currentUser?.displayName || currentUser?.username || "You",
        createdAt: new Date().toISOString(),
      }],
    });
    setComment("");
  }

  return (
    <SlideOver
      title={task.__isNew ? "New task" : `${project.code || "TASK"}-${String(allTasks.findIndex((item) => item.id === task.id) + 1).padStart(2, "0")}`}
      eyebrow={`${project.name} / ${phases.find((phase) => phase.id === task.phaseId)?.name || "Unassigned"}`}
      onClose={onClose}
      width="max-w-[590px]"
      footer={editable ? <div className="flex items-center justify-between gap-3">{task.__isNew ? <span /> : <Button variant="danger" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button>}<div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving || !task.title.trim()} onClick={onSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save task</Button></div></div> : <div className="flex justify-end"><Button variant="primary" onClick={onClose}>Close</Button></div>}
    >
      <div className="px-6 pb-8 pt-5 sm:px-7">
        <div className="flex items-start gap-3">
          <button type="button" disabled={!editable} onClick={() => onChange({ status: task.status === "done" ? "todo" : "done" })} className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition disabled:cursor-default", task.status === "done" ? "border-[#65bf45] bg-[#65bf45] text-white" : "border-[#a9afa5] text-transparent hover:border-[#65bf45]")}><Check className="h-3.5 w-3.5" /></button>
          <textarea rows={2} readOnly={!editable} value={task.title || ""} onChange={(event) => onChange({ title: event.target.value })} placeholder="Task title" className="min-h-[66px] w-full resize-none border-0 bg-transparent p-0 text-2xl font-semibold leading-tight tracking-[-0.02em] outline-none placeholder:text-[#a6aaa3] read-only:cursor-default dark:text-white" />
        </div>

        <div className="mt-5 space-y-1 border-y border-[#e6e9e3] py-3 dark:border-white/10">
          <PropertyRow icon={Circle} label="Status"><NativeSelect disabled={!editable} value={task.status || "todo"} onChange={(value) => onChange({ status: value })} options={STATUS_OPTIONS} /></PropertyRow>
          <PropertyRow icon={CalendarDays} label="Due date"><input type="date" disabled={!editable} value={task.dueDate || ""} onChange={(event) => onChange({ dueDate: event.target.value })} className={cn(inputClass, "disabled:cursor-default disabled:bg-[#f4f5f2] dark:disabled:bg-white/[0.025]")} /></PropertyRow>
          <PropertyRow icon={Users} label="Assignee"><AssigneePicker disabled={!editable} users={users} selectedIds={task.assigneeIds || []} onChange={(value) => onChange({ assigneeIds: value })} /></PropertyRow>
          <PropertyRow icon={Layers3} label="Phase"><NativeSelect disabled={!editable} value={task.phaseId || ""} onChange={(value) => onChange({ phaseId: value })} options={[{ value: "", label: "No phase" }, ...phases.map((phase) => ({ value: phase.id, label: phase.name || "Untitled phase" }))]} /></PropertyRow>
          <PropertyRow icon={Flag} label="Priority"><NativeSelect disabled={!editable} value={task.priority || "medium"} onChange={(value) => onChange({ priority: value })} options={PRIORITY_OPTIONS} /></PropertyRow>
        </div>

        <section className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#72786f] dark:text-white/50"><FileText className="h-3.5 w-3.5" />Description</div>
          <textarea rows={5} readOnly={!editable} value={task.description || ""} onChange={(event) => onChange({ description: event.target.value })} placeholder="Describe the outcome, context, blockers, and completion criteria..." className={cn(textAreaClass, "read-only:cursor-default read-only:bg-[#f4f5f2] dark:read-only:bg-white/[0.025]")} />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-medium text-[#72786f] dark:text-white/50"><Paperclip className="h-3.5 w-3.5" />Attachments ({attachments.length})</span>{attachments.length > 1 && <button type="button" className="text-xs font-semibold text-[#527d42]"><Download className="mr-1 inline h-3.5 w-3.5" />Download all</button>}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attachments.map((doc) => <a key={doc.id || doc.driveFileId || doc.url} href={doc.url} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-2 rounded-lg border border-[#dfe3dc] bg-white p-2.5 hover:border-[#b8c4b3] dark:border-white/10 dark:bg-white/[0.03]"><span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-500 dark:bg-rose-400/10"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{doc.name}</span><span className="mt-0.5 block truncate text-[10px] text-[#858b82]">{doc.category || "Document"} · Open</span></span></a>)}
            {editable && <label className="relative flex min-h-[58px] items-center justify-center rounded-lg border border-dashed border-[#ccd2c8] text-[#7d837a] hover:bg-[#f4f6f2] dark:border-white/15 dark:hover:bg-white/[0.04]"><Plus className="pointer-events-none h-4 w-4" /><select value="" aria-label="Attach project file" onChange={(event) => event.target.value && onChange({ documentIds: [...new Set([...(task.documentIds || []), event.target.value])] })} className="absolute inset-0 cursor-pointer opacity-0"><option value="">Attach file</option>{documents.filter((doc) => !attachments.includes(doc)).map((doc) => <option key={doc.id || doc.driveFileId || doc.url} value={doc.id || doc.driveFileId}>{doc.name}</option>)}</select></label>}
          </div>
        </section>

        <div className="mt-7 flex gap-6 border-b border-[#e1e5de] dark:border-white/10">
          {[["details", "Subtasks"], ["comments", `Comments ${(task.comments || []).length || ""}`], ["activity", "Activities"]].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("border-b-2 px-1 pb-3 text-sm transition", tab === value ? "border-[#20231f] font-semibold text-[#20231f] dark:border-white dark:text-white" : "border-transparent text-[#7c8278] dark:text-white/45")}>{label}</button>)}
        </div>

        {tab === "details" && <section className="pt-5"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Dependencies</h4><span className="text-xs text-[#858b82]">{dependencies.length} linked</span></div>{editable && <NativeSelect value="" onChange={(value) => value && onChange({ dependencyIds: [...new Set([...(task.dependencyIds || []), value])] })} options={[{ value: "", label: "Add a dependency..." }, ...allTasks.filter((item) => item.id !== task.id && !(task.dependencyIds || []).includes(item.id)).map((item) => ({ value: item.id, label: item.title || "Untitled task" }))]} className="mt-3" />}<div className="mt-3 space-y-2">{dependencies.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#e0e4dd] bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]"><span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", item.status === "done" ? "border-[#65bf45] bg-[#65bf45] text-white" : "border-[#a9afa5]")}>{item.status === "done" && <Check className="h-3 w-3" />}</span><span className={cn("min-w-0 flex-1 truncate text-sm", item.status === "done" && "text-[#8a8f87] line-through")}>{item.title}</span><StatusPill status={item.status} compact />{editable && <IconButton label="Remove dependency" onClick={() => onChange({ dependencyIds: (task.dependencyIds || []).filter((id) => id !== item.id) })}><X className="h-3.5 w-3.5" /></IconButton>}</div>)}{!dependencies.length && <div className="rounded-lg border border-dashed border-[#d7dcd3] px-4 py-6 text-center text-xs text-[#858b82] dark:border-white/10">No dependencies linked to this task.</div>}</div></section>}

        {tab === "comments" && <section className="pt-5"><div className="space-y-4">{(task.comments || []).map((item, index) => <div key={item.id || index} className="flex items-start gap-3"><Avatar name={item.authorName || "User"} index={index} /><div className="min-w-0 flex-1 rounded-lg bg-[#f1f3ef] px-3 py-2.5 dark:bg-white/[0.05]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{item.authorName || "User"}</span><span className="text-[10px] text-[#8b9088]">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</span></div><p className="mt-1 text-sm leading-5 text-[#555b52] dark:text-white/65">{item.text}</p></div></div>)}{!(task.comments || []).length && <p className="py-4 text-center text-xs text-[#858b82]">No comments yet.</p>}</div>{editable && <div className="mt-4 flex items-end gap-2"><textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." className={textAreaClass} /><Button variant="primary" className="shrink-0" onClick={addComment}>Post</Button></div>}</section>}

        {tab === "activity" && <section className="pt-5"><div className="space-y-4"><div className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-[#72cf50]" /><div><p className="text-sm font-medium">Task is currently {statusLabel(task.status).toLowerCase()}</p><p className="mt-1 text-xs text-[#858b82]">Latest workspace state</p></div></div>{assignees.map((person, index) => <div key={person.id} className="flex gap-3"><Avatar name={person.displayName || person.username} index={index} size="sm" /><div><p className="text-sm font-medium">{person.displayName || person.username} is assigned</p><p className="mt-1 text-xs text-[#858b82]">Project member</p></div></div>)}</div></section>}
      </div>
    </SlideOver>
  );
}

function PhaseDrawer({ phase, tasks, users, saving, editable, onChange, onClose, onSave, onDelete, onAddTask }) {
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <SlideOver title={phase.__isNew ? "New phase" : "Phase details"} eyebrow="Project schedule" onClose={onClose} width="max-w-[560px]" footer={editable ? <div className="flex items-center justify-between">{phase.__isNew ? <span /> : <Button variant="danger" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button>}<div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving || !phase.name.trim()} onClick={onSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save phase</Button></div></div> : <div className="flex justify-end"><Button variant="primary" onClick={onClose}>Close</Button></div>}>
      <div className="px-6 pb-8 pt-6 sm:px-7">
        <p className="text-xs font-medium text-[#777d74]">Delivery milestone</p>
        <input readOnly={!editable} value={phase.name || ""} onChange={(event) => onChange({ name: event.target.value })} placeholder="Phase name" className="mt-2 w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none placeholder:text-[#a6aaa3] read-only:cursor-default dark:text-white" />
        <div className="mt-6 grid grid-cols-2 gap-3"><Field label="Start date" icon={CalendarDays}><input type="date" disabled={!editable} value={phase.startDate || ""} onChange={(event) => onChange({ startDate: event.target.value })} className={cn(inputClass, "disabled:cursor-default disabled:bg-[#f4f5f2] dark:disabled:bg-white/[0.025]")} /></Field><Field label="Target date" icon={CalendarDays}><input type="date" disabled={!editable} value={phase.dueDate || ""} onChange={(event) => onChange({ dueDate: event.target.value })} className={cn(inputClass, "disabled:cursor-default disabled:bg-[#f4f5f2] dark:disabled:bg-white/[0.025]")} /></Field></div>
        <Field label="Description" icon={FileText} className="mt-4"><textarea rows={4} readOnly={!editable} value={phase.description || ""} onChange={(event) => onChange({ description: event.target.value })} placeholder="What must be achieved in this phase?" className={cn(textAreaClass, "read-only:cursor-default read-only:bg-[#f4f5f2] dark:read-only:bg-white/[0.025]")} /></Field>
        {!phase.__isNew && <><section className="mt-7 rounded-xl border border-[#dfe3dc] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-end justify-between"><div><p className="text-xs text-[#777d74]">Phase progress</p><p className="mt-1 text-2xl font-semibold">{progress}%</p></div><p className="text-xs text-[#777d74]">{done} of {tasks.length} tasks done</p></div><ProgressBar value={progress} className="mt-3" /></section><section className="mt-6"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Tasks in this phase</h4>{editable && <Button onClick={onAddTask}><Plus className="h-4 w-4" />Add task</Button>}</div><div className="mt-3 divide-y divide-[#e4e7e1] overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">{tasks.map((task, index) => { const names = users.filter((person) => (task.assigneeIds || []).includes(person.id)).map((person) => person.displayName || person.username); return <div key={task.id} className="flex items-center gap-3 px-3 py-3"><span className={cn("h-2.5 w-2.5 rounded-full", task.status === "done" ? "bg-[#65bf45]" : task.status === "blocked" ? "bg-rose-500" : task.status === "in_progress" ? "bg-amber-400" : "border-2 border-[#9ba096]")} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-0.5 block text-[11px] text-[#858b82]">{formatDate(task.dueDate)}</span></span><AvatarStack names={names} limit={2} key={index} /></div>; })}{!tasks.length && <p className="p-7 text-center text-xs text-[#858b82]">No tasks in this phase yet.</p>}</div></section></>}
      </div>
    </SlideOver>
  );
}

function ProjectEditor({ project, users, saving, onChange, onClose, onSave, onDelete }) {
  const [section, setSection] = useState("details");
  return (
    <SlideOver title={project.id ? "Edit project" : "Create project"} eyebrow="Project Control" onClose={onClose} width="max-w-[700px]" footer={<div className="flex items-center justify-between gap-3">{project.id && onDelete ? <Button variant="danger" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete project</Button> : <span />}<div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving || !project.name.trim()} onClick={onSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{project.id ? "Save changes" : "Create project"}</Button></div></div>}>
      <div className="grid min-h-full sm:grid-cols-[160px_minmax(0,1fr)]">
        <nav className="border-b border-[#e3e7e0] bg-[#f2f4f0] p-3 sm:border-b-0 sm:border-r dark:border-white/10 dark:bg-white/[0.025]">
          {[ ["details", LayoutDashboard, "Details"], ["delivery", CalendarDays, "Delivery"], ["workspace", FolderOpen, "Workspace"] ].map(([value, Icon, label]) => <button key={value} type="button" onClick={() => setSection(value)} className={cn("mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium", section === value ? "bg-white text-[#20231f] shadow-sm dark:bg-white/10 dark:text-white" : "text-[#686e65] hover:bg-white/60 dark:text-white/45 dark:hover:bg-white/[0.05]")}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>
        <div className="p-5 sm:p-6">
          {section === "details" && <div><h3 className="text-xl font-semibold">Project identity</h3><p className="mt-1 text-sm text-[#777d74]">Core information shown across the portfolio and workspace.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Project name"><input value={project.name || ""} onChange={(event) => onChange({ name: event.target.value })} placeholder="e.g. Kalhaar Residence" className={inputClass} /></Field><Field label="Project code"><input value={project.code || ""} onChange={(event) => onChange({ code: event.target.value })} placeholder="e.g. KAL-01" className={inputClass} /></Field><Field label="Client"><input value={project.client || ""} onChange={(event) => onChange({ client: event.target.value })} placeholder="Client name" className={inputClass} /></Field><Field label="Location"><input value={project.location || ""} onChange={(event) => onChange({ location: event.target.value })} placeholder="Site location" className={inputClass} /></Field><Field label="Project manager"><input value={project.manager || ""} onChange={(event) => onChange({ manager: event.target.value })} placeholder="Responsible person" className={inputClass} /></Field><Field label="Linked manager"><NativeSelect value={project.managerId || ""} onChange={(value) => { const person = users.find((item) => item.id === value); onChange({ managerId: value, manager: person?.displayName || project.manager }); }} options={[{ value: "", label: "No linked user" }, ...users.map((person) => ({ value: person.id, label: person.displayName || person.username }))]} /></Field></div></div>}
          {section === "delivery" && <div><h3 className="text-xl font-semibold">Delivery setup</h3><p className="mt-1 text-sm text-[#777d74]">Dates, priority, and health used by reports and project views.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Start date"><input type="date" value={project.startDate || ""} onChange={(event) => onChange({ startDate: event.target.value })} className={inputClass} /></Field><Field label="Target date"><input type="date" value={project.targetDate || ""} onChange={(event) => onChange({ targetDate: event.target.value })} className={inputClass} /></Field><Field label="Priority"><NativeSelect value={project.priority || "medium"} onChange={(value) => onChange({ priority: value })} options={PRIORITY_OPTIONS} /></Field><Field label="Health"><NativeSelect value={project.health || "green"} onChange={(value) => onChange({ health: value })} options={HEALTH_OPTIONS} /></Field><Field label="Project status" className="sm:col-span-2"><NativeSelect value={project.status || "active"} onChange={(value) => onChange({ status: value })} options={[{ value: "active", label: "Active" }, { value: "on_hold", label: "On hold" }, { value: "closed", label: "Closed" }, { value: "archived", label: "Archived" }]} /></Field></div></div>}
          {section === "workspace" && <div><h3 className="text-xl font-semibold">Connected workspace</h3><p className="mt-1 text-sm text-[#777d74]">Link Drive and define alternate names used in imported reports.</p><div className="mt-6 space-y-4"><Field label="Google Drive folder" icon={FolderOpen}><input value={project.driveFolderLink || ""} onChange={(event) => onChange({ driveFolderLink: event.target.value })} placeholder="https://drive.google.com/drive/folders/..." className={inputClass} /></Field><Field label="Aliases" hint="Comma separated"><input value={(project.aliases || []).join(", ")} onChange={(event) => onChange({ aliases: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Alternate project names" className={inputClass} /></Field><div className="rounded-xl border border-[#dfe3dc] bg-[#f5f7f3] p-4 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-sm font-semibold">Workspace summary</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-white px-2 py-3 dark:bg-white/[0.05]"><p className="text-lg font-semibold">{(project.phases || []).length}</p><p className="text-[10px] text-[#858b82]">Phases</p></div><div className="rounded-lg bg-white px-2 py-3 dark:bg-white/[0.05]"><p className="text-lg font-semibold">{(project.tasks || []).length + (project.phases || []).flatMap((phase) => phase.tasks || []).length}</p><p className="text-[10px] text-[#858b82]">Tasks</p></div><div className="rounded-lg bg-white px-2 py-3 dark:bg-white/[0.05]"><p className="text-lg font-semibold">{(project.projectDocuments || []).length}</p><p className="text-[10px] text-[#858b82]">Files</p></div></div></div></div></div>}
        </div>
      </div>
    </SlideOver>
  );
}

function FileDrawer({ form, canUpload, uploading, onChange, onClose, onAddLink, onUpload }) {
  return (
    <SlideOver title="Add project file" eyebrow="Documents" onClose={onClose} width="max-w-[520px]" footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!form.url.trim()} onClick={onAddLink}><Link2 className="h-4 w-4" />Add link</Button></div>}>
      <div className="px-6 py-6">
        <h3 className="text-xl font-semibold">Connect a document</h3><p className="mt-1 text-sm leading-6 text-[#737970]">Paste a document link or upload a file to the project&apos;s connected Google Drive folder.</p>
        <div className="mt-6 space-y-4"><Field label="Category"><NativeSelect value={form.category} onChange={(value) => onChange({ category: value })} options={DOC_CATEGORIES.map((value) => ({ value, label: value }))} /></Field><Field label="Document name"><input value={form.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="e.g. Approved drawing" className={inputClass} /></Field><Field label="Drive or document link"><input value={form.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="https://..." className={inputClass} /></Field></div>
        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[#93988f]"><span className="h-px flex-1 bg-[#e1e5de]" />or upload<span className="h-px flex-1 bg-[#e1e5de]" /></div>
        <label className={cn("flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center transition", canUpload ? "cursor-pointer border-[#a9c99c] bg-[#f2f9ef] hover:bg-[#edf7e9] dark:border-green-400/30 dark:bg-green-400/[0.05]" : "cursor-not-allowed border-[#d5d9d2] bg-[#f5f6f4] text-[#a0a59d] dark:border-white/10 dark:bg-white/[0.02]")}><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-white/10">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</span><span className="mt-3 text-sm font-semibold">{uploading ? "Uploading to Drive..." : "Choose a file to upload"}</span><span className="mt-1 text-xs text-[#858b82]">PDF, image, spreadsheet, or supporting document</span><input type="file" className="hidden" disabled={!canUpload || uploading} onChange={onUpload} /></label>
        {!canUpload && <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Connect a Drive folder in project settings before uploading files.</p>}
      </div>
    </SlideOver>
  );
}

function PortfolioView({ darkMode, projects, users, search, onSearch, layout, onLayout, refreshing, isSuperAdmin, onRefresh, onCreate, onOpen }) {
  const totalTasks = projects.reduce((sum, project) => sum + (project.metrics?.totalTasks || 0), 0);
  const completed = projects.reduce((sum, project) => sum + (project.metrics?.completed || 0), 0);
  const atRisk = projects.filter((project) => project.health === "red" || (project.metrics?.blocked || 0) > 0).length;
  const progress = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", darkMode ? "bg-[#10120f] text-white" : "bg-[#f4f5f2] text-[#20231f]")}>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-semibold text-[#65984f]"><Sparkles className="h-3.5 w-3.5" />PROJECT CONTROL</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Projects, clearly organized.</h1><p className="mt-2 max-w-2xl text-sm text-[#71776e] dark:text-white/45">Plan delivery, manage issues, coordinate people, and keep every project file in one focused workspace.</p></div>
          <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1 sm:flex-none"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#858b82]" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search projects" className={cn(inputClass, "pl-9 sm:w-[270px]")} /></div><Button onClick={onRefresh} disabled={refreshing}><RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />Refresh</Button>{isSuperAdmin && <Button variant="primary" onClick={onCreate}><Plus className="h-4 w-4" />New project</Button>}</div>
        </header>

        <section className="mt-7 grid overflow-hidden rounded-xl border border-[#dfe3dc] bg-white sm:grid-cols-2 xl:grid-cols-4 dark:border-white/10 dark:bg-white/[0.03]">
          {[ [FolderKanban, "Active projects", projects.length], [ListChecks, "Open tasks", Math.max(0, totalTasks - completed)], [AlertCircle, "Projects at risk", atRisk], [BarChart3, "Portfolio progress", `${progress}%`] ].map(([Icon, label, value], index) => <div key={label} className={cn("flex items-center gap-4 px-5 py-4", index > 0 && "border-t border-[#e6e9e3] sm:border-l sm:border-t-0", index === 2 && "sm:border-l-0 xl:border-l", "dark:border-white/10")}><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f3ed] text-[#5e6759] dark:bg-white/[0.06] dark:text-white/60"><Icon className="h-4.5 w-4.5" /></span><div><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-xs text-[#777d74] dark:text-white/45">{label}</p></div></div>)}
        </section>

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Project portfolio</h2><p className="mt-0.5 text-xs text-[#7b8178]">{projects.length} visible {projects.length === 1 ? "project" : "projects"}</p></div><div className="flex rounded-lg border border-[#dfe3dc] bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]"><IconButton label="Grid view" className={layout === "grid" ? "bg-[#eef1ec] text-black dark:bg-white/10 dark:text-white" : ""} onClick={() => onLayout("grid")}><Grid2X2 className="h-4 w-4" /></IconButton><IconButton label="List view" className={layout === "list" ? "bg-[#eef1ec] text-black dark:bg-white/10 dark:text-white" : ""} onClick={() => onLayout("list")}><List className="h-4 w-4" /></IconButton></div></div>

          {!projects.length ? <div className="mt-4 rounded-xl border border-dashed border-[#cfd5cc] bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.02]"><FolderKanban className="mx-auto h-8 w-8 text-[#969c93]" /><h3 className="mt-3 text-base font-semibold">No projects found</h3><p className="mt-1 text-sm text-[#7b8178]">Try another search or create a new project.</p></div> : layout === "grid" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, projectIndex) => {
                const tasks = project.manualTasks || [];
                const memberNames = [...new Set([project.manager, ...tasks.flatMap((task) => (task.assigneeIds || []).map((id) => users.find((person) => person.id === id)?.displayName || id))].filter(Boolean))];
                const projectProgress = project.metrics?.progress || 0;
                return <button key={project.id} type="button" onClick={() => onOpen(project)} className="group rounded-xl border border-[#dfe3dc] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b8c4b3] hover:shadow-[0_10px_30px_rgba(31,42,26,0.07)] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white", projectIndex % 3 === 0 ? "bg-[#348a70]" : projectIndex % 3 === 1 ? "bg-[#687ac6]" : "bg-[#9b704f]")}>{initials(project.name)}</span><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{project.name}</h3><p className="mt-0.5 truncate text-xs text-[#7e847b]">{project.client || project.location || "Project workspace"}</p></div></div><ChevronRight className="mt-2 h-4 w-4 text-[#9aa097] transition group-hover:translate-x-0.5 group-hover:text-black" /></div><div className="mt-4 flex items-center gap-2"><span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", project.health === "red" ? "bg-rose-50 text-rose-600" : project.health === "yellow" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700")}>{HEALTH_OPTIONS.find((item) => item.value === project.health)?.label || "On track"}</span>{project.code && <span className="rounded-full bg-[#f1f3ef] px-2 py-1 text-[10px] text-[#686e65] dark:bg-white/[0.06] dark:text-white/55">{project.code}</span>}<span className="ml-auto text-[10px] text-[#858b82]">{formatRelativeDate(project.targetDate)}</span></div><div className="mt-5"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-[#777d74]">Progress</span><span className="font-semibold">{projectProgress}%</span></div><ProgressBar value={projectProgress} /></div><div className="mt-5 flex items-center justify-between border-t border-[#eceeea] pt-3 dark:border-white/10"><AvatarStack names={memberNames} /><div className="flex items-center gap-3 text-[11px] text-[#7d837a]"><span>{project.metrics?.totalTasks || 0} tasks</span><span>{project.metrics?.documents || 0} files</span></div></div></button>;
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]"><div className="hidden grid-cols-[minmax(240px,1.5fr)_160px_140px_180px_120px_40px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]"><span>Project</span><span>Manager</span><span>Health</span><span>Progress</span><span>Target</span><span /></div>{projects.map((project, index) => <button key={project.id} type="button" onClick={() => onOpen(project)} className="grid w-full gap-3 border-b border-[#eceeea] px-4 py-3 text-left last:border-0 hover:bg-[#f8f9f6] md:grid-cols-[minmax(240px,1.5fr)_160px_140px_180px_120px_40px] md:items-center dark:border-white/10 dark:hover:bg-white/[0.03]"><span className="flex min-w-0 items-center gap-3"><span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white", index % 2 ? "bg-[#687ac6]" : "bg-[#348a70]")}>{initials(project.name)}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{project.name}</span><span className="block truncate text-[11px] text-[#858b82]">{project.client || project.location || project.code}</span></span></span><span className="text-xs text-[#686e65] dark:text-white/55">{project.manager || "Unassigned"}</span><span className="text-xs capitalize">{HEALTH_OPTIONS.find((item) => item.value === project.health)?.label || "On track"}</span><span className="flex items-center gap-3"><ProgressBar value={project.metrics?.progress || 0} className="flex-1" /><span className="w-8 text-xs font-semibold">{project.metrics?.progress || 0}%</span></span><span className="text-xs text-[#686e65] dark:text-white/55">{formatDate(project.targetDate)}</span><ChevronRight className="h-4 w-4 text-[#969c93]" /></button>)}</div>
          )}
        </section>
      </div>
    </div>
  );
}

const WORKSPACE_NAV = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "issues", label: "Issues", icon: ListChecks },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "phases", label: "Phases", icon: Layers3 },
  { value: "files", label: "Files", icon: FolderOpen },
];

function WorkspaceRail({ project, view, onView, tasks, documents, users }) {
  const memberNames = [...new Set([project.manager, ...tasks.flatMap((task) => (task.assigneeIds || []).map((id) => users.find((person) => person.id === id)?.displayName || id))].filter(Boolean))];
  return <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e0e4dd] bg-[#f0f2ee] px-3 py-4 md:flex dark:border-white/10 dark:bg-[#121511]"><div className="px-2"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#348a70] text-xs font-bold text-white">{initials(project.name)}</span><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{project.name}</h2><p className="truncate text-[10px] text-[#7b8178]">{project.code || "Project workspace"}</p></div></div></div><nav className="mt-6 space-y-1">{WORKSPACE_NAV.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => onView(value)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition", view === value ? "bg-white font-semibold text-[#20231f] shadow-sm dark:bg-white/10 dark:text-white" : "text-[#62685f] hover:bg-white/60 dark:text-white/45 dark:hover:bg-white/[0.05]")}><Icon className="h-4 w-4" /><span className="flex-1">{label}</span>{value === "issues" && <span className="text-[10px] text-[#8a9087]">{tasks.length}</span>}{value === "files" && <span className="text-[10px] text-[#8a9087]">{documents.length}</span>}</button>)}</nav><div className="mt-6 border-t border-[#dce0d8] pt-5 dark:border-white/10"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949a91]">Project team</p><div className="mt-3 px-3"><AvatarStack names={memberNames} /></div><p className="mt-2 px-3 text-[11px] text-[#7d837a]">{memberNames.length || 0} active members</p></div><div className="mt-auto rounded-lg border border-[#dce0d8] bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-center justify-between text-xs"><span className="text-[#777d74]">Overall progress</span><strong>{project.metrics?.progress || 0}%</strong></div><ProgressBar value={project.metrics?.progress || 0} className="mt-2" /></div></aside>;
}

function OverviewView({ project, tasks, phases, documents, users, isSuperAdmin, onOpenTask, onAddTask, onOpenPhase }) {
  const done = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : project.metrics?.progress || 0;
  const recent = [...tasks].sort((a, b) => String(b.updatedAt || b.createdAt || b.dueDate || "").localeCompare(String(a.updatedAt || a.createdAt || a.dueDate || ""))).slice(0, 6);
  return <div className="mx-auto max-w-[1250px] p-4 sm:p-6"><section className="rounded-xl border border-[#dfe3dc] bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e8f6e3] px-2.5 py-1 text-[10px] font-semibold text-[#3e7c2d]">{HEALTH_OPTIONS.find((item) => item.value === project.health)?.label || "On track"}</span><PriorityPill priority={project.priority} /></div><h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">{project.name}</h2><p className="mt-1 text-sm text-[#72786f]">{project.client || "Client not set"}{project.location ? ` · ${project.location}` : ""}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Progress", `${progress}%`], ["Tasks done", `${done}/${tasks.length}`], ["Blocked", blocked], ["Target", formatDate(project.targetDate)]].map(([label, value]) => <div key={label} className="min-w-[118px] rounded-lg border border-[#e3e6e0] bg-[#f8f9f6] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]"><p className="text-[10px] text-[#7f857c]">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>)}</div></div></section>

    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_360px]"><section className="rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]"><header className="flex items-center justify-between border-b border-[#e5e8e2] px-4 py-3 dark:border-white/10"><div><h3 className="text-sm font-semibold">Recent work</h3><p className="mt-0.5 text-[11px] text-[#858b82]">Latest tasks across the project</p></div>{isSuperAdmin && <Button onClick={onAddTask}><Plus className="h-4 w-4" />Add task</Button>}</header><div className="divide-y divide-[#e9ebe7] dark:divide-white/10">{recent.map((task, index) => { const names = users.filter((person) => (task.assigneeIds || []).includes(person.id)).map((person) => person.displayName || person.username); return <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="grid w-full grid-cols-[minmax(0,1fr)_110px_90px] items-center gap-3 px-4 py-3 text-left hover:bg-[#f8f9f6] dark:hover:bg-white/[0.025]"><span className="flex min-w-0 items-center gap-3"><span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", task.status === "done" ? "bg-[#dcf5d4] text-[#4d9d36]" : task.status === "blocked" ? "bg-rose-50 text-rose-500" : "bg-[#eef0ec] text-[#747a71]")}>{task.status === "done" ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{task.title || "Untitled task"}</span><span className="mt-0.5 block truncate text-[11px] text-[#858b82]">{phases.find((phase) => phase.id === task.phaseId)?.name || "No phase"}</span></span></span><AvatarStack names={names} limit={3} key={index} /><span className="text-right text-[11px] text-[#777d74]">{formatDate(task.dueDate, "No date")}</span></button>; })}{!recent.length && <p className="px-5 py-12 text-center text-xs text-[#858b82]">No project tasks yet.</p>}</div></section>
      <section className="rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]"><header className="border-b border-[#e5e8e2] px-4 py-3 dark:border-white/10"><h3 className="text-sm font-semibold">Delivery phases</h3><p className="mt-0.5 text-[11px] text-[#858b82]">Milestone progress</p></header><div className="space-y-1 p-2">{phases.map((phase, index) => { const phaseTasks = tasks.filter((task) => task.phaseId === phase.id); const phaseDone = phaseTasks.filter((task) => task.status === "done").length; const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : 0; return <button key={phase.id} type="button" onClick={() => onOpenPhase(phase)} className="w-full rounded-lg p-3 text-left hover:bg-[#f6f8f4] dark:hover:bg-white/[0.03]"><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#eef6eb] text-[10px] font-bold text-[#568443]">{index + 1}</span><span className="truncate text-xs font-semibold">{phase.name}</span></span><span className="text-[10px] text-[#858b82]">{phaseProgress}%</span></div><ProgressBar value={phaseProgress} className="mt-2.5" /></button>; })}{!phases.length && <p className="p-6 text-center text-xs text-[#858b82]">No phases yet.</p>}</div><div className="border-t border-[#e5e8e2] px-4 py-3 text-[11px] text-[#777d74] dark:border-white/10"><div className="flex justify-between"><span>Connected files</span><strong className="text-[#30342e] dark:text-white">{documents.length}</strong></div></div></section></div>
  </div>;
}

function IssuesView({ tasks, phases, users, isSuperAdmin, onOpenTask, onAddTask }) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const filtered = tasks.filter((task) => {
    const matchesQuery = !query || `${task.title} ${task.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesPriority = priority === "all" || task.priority === priority;
    const matchesAssignee = assignee === "all" || (task.assigneeIds || []).includes(assignee);
    return matchesQuery && matchesPriority && matchesAssignee;
  });
  return <div className="mx-auto max-w-[1350px] p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">All issues</h2><p className="mt-0.5 text-xs text-[#7b8178]">Filter, scan, and update every project task.</p></div>{isSuperAdmin && <Button variant="primary" onClick={() => onAddTask()}><Plus className="h-4 w-4" />New issue</Button>}</div>
    <div className="mt-5 flex flex-wrap items-center gap-2"><div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#878d84]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter issues..." className={cn(inputClass, "pl-9")} /></div><span className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[#777d74]" /><select value={priority} onChange={(event) => setPriority(event.target.value)} className={cn(inputClass, "w-auto appearance-none pl-8 pr-8")}><option value="all">All priorities</option>{PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" /></span><span className="relative"><Users className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[#777d74]" /><select value={assignee} onChange={(event) => setAssignee(event.target.value)} className={cn(inputClass, "w-auto appearance-none pl-8 pr-8")}><option value="all">All assignees</option>{users.map((person) => <option key={person.id} value={person.id}>{person.displayName || person.username}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" /></span><Button><SlidersHorizontal className="h-4 w-4" />More</Button></div>
    <section className="mt-4 overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]">{STATUS_OPTIONS.map((status) => { const items = filtered.filter((task) => (task.status || "todo") === status.value); return <div key={status.value}><div className="flex items-center gap-2 border-b border-[#e6e9e3] bg-[#f7f8f5] px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.025]"><StatusPill status={status.value} count={items.length} /><button type="button" onClick={() => onAddTask("", status.value)} className="ml-1 text-[#7f857c] hover:text-black"><Plus className="h-4 w-4" /></button></div><div>{items.map((task, index) => { const assigneeNames = users.filter((person) => (task.assigneeIds || []).includes(person.id)).map((person) => person.displayName || person.username); return <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="grid w-full grid-cols-[minmax(260px,1.5fr)_170px_110px_120px_110px_28px] items-center gap-3 border-b border-[#eceeea] px-4 py-3 text-left text-sm last:border-0 hover:bg-[#fafbf9] dark:border-white/10 dark:hover:bg-white/[0.025]"><span className="flex min-w-0 items-center gap-3"><span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2", task.status === "done" ? "border-[#62bd43] bg-[#62bd43]" : task.status === "blocked" ? "border-rose-500" : task.status === "in_progress" ? "border-amber-400" : "border-[#a5aaa1]")} /><span className="min-w-0"><span className="block truncate font-medium">{task.title || "Untitled issue"}</span>{task.description && <span className="mt-0.5 block truncate text-[11px] text-[#858b82]">{task.description}</span>}</span></span><span className="truncate text-xs text-[#6e746b] dark:text-white/50">{phases.find((phase) => phase.id === task.phaseId)?.name || "No phase"}</span><AvatarStack names={assigneeNames} limit={3} key={index} /><PriorityPill priority={task.priority} /><span className={cn("text-xs", task.dueDate && new Date(`${task.dueDate}T00:00:00`) < new Date() && task.status !== "done" ? "font-semibold text-rose-500" : "text-[#747a71]")}>{formatDate(task.dueDate, "No date")}</span><ChevronRight className="h-4 w-4 text-[#a0a59d]" /></button>; })}{!items.length && <p className="border-b border-[#eceeea] px-4 py-5 text-center text-xs text-[#979c94] dark:border-white/10">No matching issues</p>}</div></div>; })}</section>
  </div>;
}

function BoardView({ tasks, phases, users, isSuperAdmin, onOpenTask, onAddTask }) {
  return <div className="min-w-max p-4 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Project board</h2><p className="mt-0.5 text-xs text-[#7b8178]">Work organized by status.</p></div>{isSuperAdmin && <Button variant="primary" onClick={() => onAddTask()}><Plus className="h-4 w-4" />New task</Button>}</div><div className="grid grid-cols-4 gap-3">{STATUS_OPTIONS.map((status) => { const items = tasks.filter((task) => (task.status || "todo") === status.value); return <section key={status.value} className="w-[250px] rounded-xl bg-[#eceee9] p-2.5 dark:bg-white/[0.035]"><header className="flex items-center justify-between px-1 py-1"><StatusPill status={status.value} count={items.length} /><div className="flex items-center"><IconButton label={`Add ${status.label} task`} onClick={() => onAddTask("", status.value)}><Plus className="h-4 w-4" /></IconButton><IconButton label="Column options"><MoreHorizontal className="h-4 w-4" /></IconButton></div></header><div className="mt-2 space-y-2">{items.map((task, index) => { const names = users.filter((person) => (task.assigneeIds || []).includes(person.id)).map((person) => person.displayName || person.username); return <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="w-full rounded-lg border border-[#dfe3dc] bg-white p-3 text-left shadow-[0_1px_2px_rgba(20,28,18,0.03)] transition hover:-translate-y-0.5 hover:border-[#bbc6b6] hover:shadow-[0_6px_16px_rgba(25,35,22,0.07)] dark:border-white/10 dark:bg-[#1a1d18]"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-medium text-[#858b82]">{phases.find((phase) => phase.id === task.phaseId)?.name || "Project task"}</span><MoreHorizontal className="h-4 w-4 text-[#a0a59d]" /></div><h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{task.title}</h3>{task.description && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#7b8178]">{task.description}</p>}<div className="mt-3 flex flex-wrap gap-1.5"><PriorityPill priority={task.priority} />{(task.dependencyIds || []).length > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-[#eef0ec] px-2 py-1 text-[10px] text-[#62685f]"><Link2 className="h-3 w-3" />{task.dependencyIds.length}</span>}</div><div className="mt-4 flex items-center justify-between border-t border-[#eceeea] pt-2.5 dark:border-white/10"><AvatarStack names={names} limit={3} key={index} /><span className="flex items-center gap-1 text-[10px] text-[#777d74]"><CalendarDays className="h-3 w-3" />{formatDate(task.dueDate, "No date")}</span></div></button>; })}<button type="button" onClick={() => onAddTask("", status.value)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#c9cec6] text-xs font-medium text-[#747a71] hover:bg-white/70 dark:border-white/10 dark:hover:bg-white/[0.04]"><Plus className="h-3.5 w-3.5" />Add task</button></div></section>; })}</div></div>;
}

function PhasesView({ phases, tasks, isSuperAdmin, onOpenPhase, onAddPhase, onAddTask }) {
  return <div className="mx-auto max-w-[1250px] p-4 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Project timeline</h2><p className="mt-0.5 text-xs text-[#7b8178]">Phases, deadlines, and task completion.</p></div>{isSuperAdmin && <Button variant="primary" onClick={onAddPhase}><Plus className="h-4 w-4" />New phase</Button>}</div><section className="mt-5 overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]"><div className="hidden grid-cols-[56px_minmax(240px,1.5fr)_160px_130px_180px_100px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]"><span>#</span><span>Phase</span><span>Delivery</span><span>Tasks</span><span>Progress</span><span /></div>{phases.map((phase, index) => { const phaseTasks = tasks.filter((task) => task.phaseId === phase.id); const done = phaseTasks.filter((task) => task.status === "done").length; const blocked = phaseTasks.filter((task) => task.status === "blocked").length; const progress = phaseTasks.length ? Math.round((done / phaseTasks.length) * 100) : 0; return <div key={phase.id} className="grid gap-3 border-b border-[#e9ebe7] px-4 py-4 last:border-0 md:grid-cols-[56px_minmax(240px,1.5fr)_160px_130px_180px_100px] md:items-center dark:border-white/10"><button type="button" onClick={() => onOpenPhase(phase)} className="contents text-left"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ecf5e8] text-xs font-bold text-[#568443]">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{phase.name || "Untitled phase"}</span><span className="mt-0.5 block truncate text-xs text-[#858b82]">{phase.description || "No description added"}</span></span><span><span className="block text-[10px] text-[#858b82]">Target date</span><span className="mt-0.5 block text-xs font-medium">{formatDate(phase.dueDate)}</span></span><span><span className="text-sm font-semibold">{done}/{phaseTasks.length}</span><span className={cn("ml-2 text-[10px]", blocked ? "text-rose-500" : "text-[#858b82]")}>{blocked ? `${blocked} blocked` : "complete"}</span></span><span><span className="flex justify-between text-[10px]"><span>{progress}%</span><span className="text-[#858b82]">{phaseTasks.length ? "active" : "not started"}</span></span><ProgressBar value={progress} className="mt-2" /></span></button><span className="flex justify-end">{isSuperAdmin && <Button onClick={() => onAddTask(phase.id)}><Plus className="h-3.5 w-3.5" />Task</Button>}</span></div>; })}{!phases.length && <p className="px-6 py-14 text-center text-sm text-[#858b82]">No phases created yet.</p>}</section></div>;
}

function FilesView({ project, documents, isSuperAdmin, onAddFile }) {
  return <div className="mx-auto max-w-[1250px] p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Project files</h2><p className="mt-0.5 text-xs text-[#7b8178]">Documents and links connected to this workspace.</p></div><div className="flex gap-2">{(project.driveFolderId || project.driveFolderLink) && <a href={project.driveFolderLink || `https://drive.google.com/drive/folders/${project.driveFolderId}`} target="_blank" rel="noreferrer"><Button><FolderOpen className="h-4 w-4" />Open Drive</Button></a>}{isSuperAdmin && <Button variant="primary" onClick={onAddFile}><FilePlus2 className="h-4 w-4" />Add file</Button>}</div></div>{!(project.driveFolderId || project.driveFolderLink) && <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"><AlertCircle className="h-4 w-4 shrink-0" />Connect a Google Drive folder in project settings to enable folder sync and uploads.</div>}<section className="mt-5 overflow-hidden rounded-xl border border-[#dfe3dc] bg-white dark:border-white/10 dark:bg-white/[0.03]"><div className="hidden grid-cols-[minmax(280px,1.7fr)_160px_160px_150px_90px] gap-4 border-b border-[#e4e7e1] bg-[#f7f8f5] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858b82] md:grid dark:border-white/10 dark:bg-white/[0.025]"><span>Name</span><span>Category</span><span>Source</span><span>Updated</span><span /></div>{documents.map((doc) => <div key={doc.id || doc.driveFileId || doc.url} className="grid gap-3 border-b border-[#e9ebe7] px-4 py-3.5 last:border-0 md:grid-cols-[minmax(280px,1.7fr)_160px_160px_150px_90px] md:items-center dark:border-white/10"><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#5874bd] dark:bg-blue-400/10 dark:text-blue-300"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{doc.name || "Untitled file"}</span><span className="mt-0.5 block truncate text-[11px] text-[#858b82]">{doc.url || "Drive file"}</span></span></span><span className="text-xs text-[#6d736a] dark:text-white/50">{doc.category || "General"}</span><span className="text-xs text-[#6d736a] dark:text-white/50">{doc.driveFileId ? "Google Drive" : "Linked file"}</span><span className="text-xs text-[#6d736a] dark:text-white/50">{doc.uploadedAt ? formatDate(String(doc.uploadedAt).slice(0, 10)) : "Unknown"}</span><a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg bg-[#f0f2ee] px-3 text-xs font-semibold text-[#4f554c] hover:bg-[#e7eae4] dark:bg-white/[0.06] dark:text-white/65">Open<ArrowUpRight className="h-3.5 w-3.5" /></a></div>)}{!documents.length && <div className="px-6 py-16 text-center"><Paperclip className="mx-auto h-7 w-7 text-[#9ca199]" /><h3 className="mt-3 text-sm font-semibold">No files connected</h3><p className="mt-1 text-xs text-[#858b82]">Add a link or upload the first project document.</p></div>}</section></div>;
}

export default function ProjectDashboard({ darkMode, projectId = null }) {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
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
  const [projectEditor, setProjectEditor] = useState(null);
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [fileForm, setFileForm] = useState({ name: "", category: "General", url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (quiet = false) => {
    try {
      quiet ? setRefreshing(true) : setLoading(true);
      const dashboard = await api("/project-dashboard");
      setData(dashboard);
      setSelected((current) => current ? dashboard.projects.find((project) => project.id === current.id) || null : null);
      if (isSuperAdmin) setConfig(await api("/project-dashboard/config"));
    } catch (error) {
      toast.error(error.message || "Could not load projects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSuperAdmin]);

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

  const routeProject = projectId ? data.projects.find((project) => String(project.id) === String(projectId)) : null;
  const selectedProject = routeProject || (selected ? data.projects.find((project) => project.id === selected.id) || selected : null);

  useEffect(() => {
    // Refresh the external Drive listing whenever the focused project changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjectDocs(selectedProject?.id);
  }, [loadProjectDocs, selectedProject?.id]);

  const users = config.users || [];
  const projects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data.projects || []).filter((project) => !query || [project.name, project.code, project.client, project.location, project.manager, ...(project.manualTasks || []).map((task) => task.title)].join(" ").toLowerCase().includes(query));
  }, [data.projects, search]);
  const phases = selectedProject?.phases || [];
  const tasks = selectedProject?.manualTasks || [];
  const documents = useMemo(() => {
    const byKey = new Map([...(selectedProject?.projectDocuments || []), ...driveDocs].map((doc) => [doc.driveFileId || doc.url || doc.id, doc]));
    return [...byKey.values()];
  }, [driveDocs, selectedProject?.projectDocuments]);

  function fullProject(project) {
    return (config.projects || []).find((item) => item.id === project?.id) || project;
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
    router.push("/projects");
  }

  async function patchProject(project, payload, message) {
    try {
      setSaving(true);
      const result = await api(`/project-dashboard/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(payload) });
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
    setTaskEditor(JSON.parse(JSON.stringify(task)));
  }

  function addTask(phaseId = "", status = "todo") {
    const resolvedPhase = phaseId || phases[0]?.id || "";
    setTaskEditor({ ...blankTask(resolvedPhase), status });
  }

  async function saveTask() {
    if (!selectedProject || !taskEditor?.title.trim()) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    const cleanTask = { ...taskEditor };
    delete cleanTask.__isNew;
    source.phases = (source.phases || []).map((phase) => ({ ...phase, tasks: (phase.tasks || []).filter((task) => task.id !== cleanTask.id) }));
    source.tasks = (source.tasks || []).filter((task) => task.id !== cleanTask.id);
    const targetPhase = source.phases.find((phase) => phase.id === cleanTask.phaseId);
    if (targetPhase) targetPhase.tasks = [...(targetPhase.tasks || []), cleanTask];
    else source.tasks = [...source.tasks, cleanTask];
    const updated = await patchProject(selectedProject, source, taskEditor.__isNew ? "Task created" : "Task updated");
    if (updated) setTaskEditor(null);
  }

  async function deleteTask() {
    if (!selectedProject || !taskEditor || !window.confirm(`Delete ${taskEditor.title}?`)) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    source.phases = (source.phases || []).map((phase) => ({ ...phase, tasks: (phase.tasks || []).filter((task) => task.id !== taskEditor.id) }));
    source.tasks = (source.tasks || []).filter((task) => task.id !== taskEditor.id);
    const updated = await patchProject(selectedProject, source, "Task deleted");
    if (updated) setTaskEditor(null);
  }

  function openPhase(phase) {
    setPhaseEditor(JSON.parse(JSON.stringify(phase)));
  }

  function addPhase() {
    setPhaseEditor(blankPhase());
  }

  async function savePhase() {
    if (!selectedProject || !phaseEditor?.name.trim()) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    const cleanPhase = { ...phaseEditor };
    delete cleanPhase.__isNew;
    source.phases = phaseEditor.__isNew ? [...(source.phases || []), cleanPhase] : (source.phases || []).map((phase) => phase.id === cleanPhase.id ? cleanPhase : phase);
    const updated = await patchProject(selectedProject, source, phaseEditor.__isNew ? "Phase created" : "Phase updated");
    if (updated) setPhaseEditor(null);
  }

  async function deletePhase() {
    if (!selectedProject || !phaseEditor) return;
    if (tasks.some((task) => task.phaseId === phaseEditor.id)) return toast.error("Move or delete this phase's tasks before deleting the phase");
    if (!window.confirm(`Delete ${phaseEditor.name}?`)) return;
    const source = JSON.parse(JSON.stringify(fullProject(selectedProject)));
    source.phases = (source.phases || []).filter((phase) => phase.id !== phaseEditor.id);
    const updated = await patchProject(selectedProject, source, "Phase deleted");
    if (updated) setPhaseEditor(null);
  }

  function editProject(project = null) {
    setProjectEditor(JSON.parse(JSON.stringify(project ? fullProject(project) : blankProject())));
  }

  async function saveProject() {
    if (!projectEditor?.name.trim()) return;
    try {
      setSaving(true);
      if (projectEditor.id) {
        await api(`/project-dashboard/projects/${projectEditor.id}`, { method: "PATCH", body: JSON.stringify(projectEditor) });
        toast.success("Project updated");
      } else {
        await api("/project-dashboard/projects", { method: "POST", body: JSON.stringify(projectEditor) });
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

  async function deleteProject() {
    if (!projectEditor?.id || !window.confirm(`Delete ${projectEditor.name}? This cannot be undone.`)) return;
    try {
      setSaving(true);
      await api(`/project-dashboard/projects/${projectEditor.id}`, { method: "DELETE" });
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

  async function addDocumentLink() {
    if (!selectedProject || !fileForm.url.trim()) return;
    try {
      setSaving(true);
      await api(`/project-dashboard/projects/${selectedProject.id}/documents`, { method: "POST", body: JSON.stringify(fileForm) });
      toast.success("Document linked");
      setFileForm({ name: "", category: "General", url: "" });
      setFileDrawerOpen(false);
      await Promise.all([loadProjectDocs(selectedProject.id), load(true)]);
    } catch (error) {
      toast.error(error.message || "Could not add document");
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
      await apiForm(`/project-dashboard/projects/${selectedProject.id}/documents/upload`, form);
      toast.success("File uploaded to Drive");
      setFileDrawerOpen(false);
      await Promise.all([loadProjectDocs(selectedProject.id), load(true)]);
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <LoadingView darkMode={darkMode} />;

  if (!selectedProject) {
    return <><PortfolioView darkMode={darkMode} projects={projects} users={users} search={search} onSearch={setSearch} layout={portfolioLayout} onLayout={setPortfolioLayout} refreshing={refreshing} isSuperAdmin={isSuperAdmin} onRefresh={() => load(true)} onCreate={() => editProject()} onOpen={openProject} />{projectEditor && <ProjectEditor project={projectEditor} users={users} saving={saving} onChange={(patch) => setProjectEditor((current) => ({ ...current, ...patch }))} onClose={() => setProjectEditor(null)} onSave={saveProject} onDelete={deleteProject} />}</>;
  }

  const projectMemberNames = [...new Set([selectedProject.manager, ...tasks.flatMap((task) => (task.assigneeIds || []).map((id) => users.find((person) => person.id === id)?.displayName || id))].filter(Boolean))];

  return (
    <div className={cn("flex min-h-0 flex-1 overflow-hidden", darkMode ? "bg-[#11130f] text-white" : "bg-[#f7f8f5] text-[#20231f]")}>
      <WorkspaceRail project={selectedProject} view={workspaceView} onView={setWorkspaceView} tasks={tasks} documents={documents} users={users} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e0e4dd] bg-white px-3 sm:px-4 dark:border-white/10 dark:bg-[#171a16]">
          <div className="flex min-w-0 items-center gap-2"><IconButton label="Back to projects" onClick={closeProject}><ArrowLeft className="h-4 w-4" /></IconButton><div className="hidden h-5 w-px bg-[#e0e4dd] sm:block dark:bg-white/10" /><div className="min-w-0"><div className="flex items-center gap-1.5 text-xs text-[#777d74] dark:text-white/45"><span className="hidden sm:inline">Projects</span><ChevronRight className="hidden h-3 w-3 sm:block" /><span className="truncate font-medium text-[#30342e] dark:text-white/75">{selectedProject.name}</span></div></div></div>
          <div className="flex shrink-0 items-center gap-1.5"><div className="mr-1 hidden sm:block"><AvatarStack names={projectMemberNames} /></div><IconButton label="Refresh project" onClick={() => load(true)}><RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /></IconButton>{isSuperAdmin && <Button variant="primary" onClick={() => editProject(selectedProject)}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit project</span></Button>}</div>
        </header>
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e0e4dd] bg-white px-3 py-2 md:hidden dark:border-white/10 dark:bg-[#171a16]">{WORKSPACE_NAV.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setWorkspaceView(value)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs", workspaceView === value ? "bg-[#20231f] font-semibold text-white dark:bg-[#78d455] dark:text-[#14200f]" : "text-[#676d64] dark:text-white/50")}><Icon className="h-3.5 w-3.5" />{label}</button>)}</nav>
        <main className={cn("min-h-0 flex-1", workspaceView === "board" ? "overflow-auto" : "overflow-y-auto")}>
          {workspaceView === "overview" && <OverviewView project={selectedProject} tasks={tasks} phases={phases} documents={documents} users={users} isSuperAdmin={isSuperAdmin} onOpenTask={openTask} onAddTask={() => addTask()} onOpenPhase={openPhase} />}
          {workspaceView === "issues" && <IssuesView tasks={tasks} phases={phases} users={users} isSuperAdmin={isSuperAdmin} onOpenTask={openTask} onAddTask={addTask} />}
          {workspaceView === "board" && <BoardView tasks={tasks} phases={phases} users={users} isSuperAdmin={isSuperAdmin} onOpenTask={openTask} onAddTask={addTask} />}
          {workspaceView === "phases" && <PhasesView phases={phases} tasks={tasks} isSuperAdmin={isSuperAdmin} onOpenPhase={openPhase} onAddPhase={addPhase} onAddTask={addTask} />}
          {workspaceView === "files" && <FilesView project={selectedProject} documents={documents} isSuperAdmin={isSuperAdmin} onAddFile={() => setFileDrawerOpen(true)} />}
        </main>
      </div>

      {taskEditor && <TaskDrawer task={taskEditor} project={selectedProject} users={users} phases={phases} documents={documents} allTasks={tasks} currentUser={user} saving={saving} editable={isSuperAdmin} onChange={(patch) => setTaskEditor((current) => ({ ...current, ...patch }))} onClose={() => setTaskEditor(null)} onSave={saveTask} onDelete={deleteTask} />}
      {phaseEditor && <PhaseDrawer phase={phaseEditor} tasks={tasks.filter((task) => task.phaseId === phaseEditor.id)} users={users} saving={saving} editable={isSuperAdmin} onChange={(patch) => setPhaseEditor((current) => ({ ...current, ...patch }))} onClose={() => setPhaseEditor(null)} onSave={savePhase} onDelete={deletePhase} onAddTask={() => { const phaseId = phaseEditor.id; setPhaseEditor(null); addTask(phaseId); }} />}
      {projectEditor && <ProjectEditor project={projectEditor} users={users} saving={saving} onChange={(patch) => setProjectEditor((current) => ({ ...current, ...patch }))} onClose={() => setProjectEditor(null)} onSave={saveProject} onDelete={deleteProject} />}
      {fileDrawerOpen && <FileDrawer form={fileForm} canUpload={Boolean(selectedProject.driveFolderId || selectedProject.driveFolderLink)} uploading={uploading} onChange={(patch) => setFileForm((current) => ({ ...current, ...patch }))} onClose={() => setFileDrawerOpen(false)} onAddLink={addDocumentLink} onUpload={uploadDocument} />}
    </div>
  );
}
