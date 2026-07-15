"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Database,
  FilePlus2,
  FileText,
  Flag,
  FolderKanban,
  GanttChartSquare,
  GripVertical,
  Layers3,
  Link as LinkIcon,
  ListChecks,
  Loader2,
  Paperclip,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import { SelectMenu } from "./ui";

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

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const HEALTH_OPTIONS = [
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
];

const DOC_CATEGORIES = ["Drawing", "Agreement", "Quotation", "Approval", "Bill", "Site photo", "General"].map((label) => ({
  value: label,
  label,
}));

const blankPhase = () => ({
  id: `phase_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  name: "",
  description: "",
  status: "todo",
  startDate: "",
  dueDate: "",
  ownerId: "",
  ownerName: "",
  dependencyIds: [],
  tasks: [],
});

const blankTask = (phaseId = "") => ({
  id: `task_${Date.now()}_${Math.random().toString(16).slice(2)}`,
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
});

const blankProject = () => ({
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
  phases: [{ ...blankPhase(), name: "Planning" }],
  tasks: [],
  projectDocuments: [],
  assignments: [],
  dmr: { enabled: false, spreadsheetId: "", siteNames: [], agencyNames: [], assignedUserIds: [], editableUserIds: [] },
});

function listFromText(value = "") {
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function todayKey() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(value = "") {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "Todo";
}

function priorityClass(priority, darkMode) {
  if (priority === "critical") return "bg-red-500 text-white";
  if (priority === "high") return darkMode ? "bg-orange-400/15 text-orange-200" : "bg-orange-50 text-orange-700";
  if (priority === "low") return darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55";
  return darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700";
}

function healthClass(health, darkMode) {
  if (health === "red") return darkMode ? "bg-red-400/12 text-red-200" : "bg-red-50 text-red-700";
  if (health === "yellow") return darkMode ? "bg-amber-400/12 text-amber-200" : "bg-amber-50 text-amber-700";
  return darkMode ? "bg-emerald-400/12 text-emerald-200" : "bg-emerald-50 text-emerald-700";
}

function Drawer({ darkMode, title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-sm">
      <div className={`flex h-full w-full flex-col overflow-hidden border-l shadow-2xl xl:w-[92vw] ${darkMode ? "border-white/10 bg-[#0f1115] text-white" : "border-black/10 bg-[#f5f4ef] text-[#171714]"}`}>
        <header className={`flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-8 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onClose} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/10" : "border-black/10 hover:bg-black/[0.04]"}`}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold">{title}</h3>
              <p className={`mt-0.5 truncate text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full">
            <X className="h-5 w-5" />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">{children}</main>
        {footer && <footer className={`shrink-0 border-t px-5 py-4 sm:px-8 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}>{footer}</footer>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">{label}</span>
      {children}
    </label>
  );
}

function TextInput({ darkMode, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <input
      type={type}
      value={value || ""}
      required={required}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`}
    />
  );
}

function TextArea({ darkMode, value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value || ""}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] focus:ring-[#d8f36a]/25" : "border-black/10 bg-white focus:ring-black/10"}`}
    />
  );
}

function UserPicker({ darkMode, users = [], selectedIds = [], onChange, placeholder = "Assign members" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function close(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const selected = users.filter((user) => selectedIds.includes(user.id));
  const filtered = users.filter((user) => `${user.displayName} ${user.username}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left text-sm ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
      >
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {selected.length ? selected.map((user) => (
            <span key={user.id} className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8 text-white/75" : "bg-[#eef4ec] text-black/65"}`}>{user.displayName}</span>
          )) : <span className={darkMode ? "text-white/35" : "text-black/35"}>{placeholder}</span>}
        </span>
        <UsersRound className="h-4 w-4 shrink-0 opacity-45" />
      </button>
      {open && (
        <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-[20px] border p-2 shadow-2xl ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search member..."
            className={`mb-2 h-10 w-full rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}
          />
          <div className="max-h-56 overflow-y-auto pr-1">
            {filtered.map((user) => {
              const active = selectedIds.includes(user.id);
              return (
                <button key={user.id} type="button" onClick={() => toggle(user.id)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${active ? "bg-emerald-500/10 text-emerald-600" : darkMode ? "hover:bg-white/8" : "hover:bg-black/[0.04]"}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-emerald-500 text-white" : darkMode ? "bg-white/8" : "bg-[#eef4ec]"}`}>{(user.displayName || user.username || "?").slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{user.displayName || user.username}</span>
                    <span className={`block truncate text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{user.username}</span>
                  </span>
                  <span className={`h-5 w-5 rounded-full border transition ${active ? "border-emerald-500 bg-emerald-500 shadow-[inset_0_0_0_4px_white]" : darkMode ? "border-white/20" : "border-black/15"}`} />
                </button>
              );
            })}
            {!filtered.length && <p className={`px-3 py-5 text-center text-sm ${darkMode ? "text-white/40" : "text-black/40"}`}>No members found.</p>}
          </div>
        </div>
      )}
    </div>
  );
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
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState("board");
  const [editor, setEditor] = useState(null);
  const [editorTab, setEditorTab] = useState("project");
  const [saving, setSaving] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", category: "General", url: "" });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [driveDocs, setDriveDocs] = useState([]);
  const [newTaskDraft, setNewTaskDraft] = useState(null);
  const [phaseDraft, setPhaseDraft] = useState(null);
  const [taskEdits, setTaskEdits] = useState({});
  const [taskDetail, setTaskDetail] = useState(null);

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-[#151612]" : "border-[#dfe7e4] bg-white";
  const today = todayKey();

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const dashboard = await api("/project-dashboard");
      setData(dashboard);
      setSelected((current) => current ? dashboard.projects.find((project) => project.id === current.id) || null : null);
      if (isSuperAdmin) {
        const dashboardConfig = await api("/project-dashboard/config");
        setConfig(dashboardConfig);
      }
    } catch (error) {
      toast.error(error.message || "Could not load projects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const users = config.users || [];
  const projects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data.projects || []).filter((project) => !query || [
      project.name,
      project.code,
      project.client,
      project.location,
      project.manager,
      ...(project.manualTasks || []).map((task) => task.title),
    ].join(" ").toLowerCase().includes(query));
  }, [data.projects, search]);

  const routeProject = projectId ? (data.projects || []).find((project) => String(project.id) === String(projectId)) : null;
  const selectedProject = routeProject || (selected ? (data.projects || []).find((project) => project.id === selected.id) || selected : null);
  const selectedTasks = selectedProject?.manualTasks || [];
  const phaseMap = new Map((selectedProject?.phases || []).map((phase) => [phase.id, phase]));
  const docs = useMemo(() => {
    const byId = new Map([...(selectedProject?.projectDocuments || []), ...driveDocs].map((doc) => [doc.driveFileId || doc.url || doc.id, doc]));
    return [...byId.values()];
  }, [driveDocs, selectedProject]);

  async function loadProjectDocs(projectId = selectedProject?.id) {
    if (!projectId) return;
    try {
      const result = await api(`/project-dashboard/projects/${projectId}/documents`);
      setDriveDocs(result.documents || []);
    } catch (error) {
      setDriveDocs([]);
      toast.error(error.message || "Could not load project documents");
    }
  }

  useEffect(() => {
    setDriveDocs([]);
    if (selectedProject?.id) void loadProjectDocs(selectedProject.id);
  }, [selectedProject?.id]);

  function openEditor(project = null) {
    const source = project ? config.projects.find((item) => item.id === project.id) || project : blankProject();
    const next = JSON.parse(JSON.stringify(source));
    next.phases = next.phases?.length ? next.phases : [{ ...blankPhase(), name: "Planning" }];
    next.tasks = next.tasks || [];
    next.projectDocuments = next.projectDocuments || [];
    next.assignments = next.assignments || [];
    next.dmr = next.dmr || { enabled: false, spreadsheetId: "", siteNames: [], agencyNames: [], assignedUserIds: [], editableUserIds: [] };
    setEditor(next);
    setEditorTab("project");
  }

  function openProject(project) {
    setSelected(project);
    setDetailTab("board");
    router.push(`/projects/${project.id}`);
  }

  function closeProject() {
    setSelected(null);
    setTaskDetail(null);
    setNewTaskDraft(null);
    setPhaseDraft(null);
    router.push("/projects");
  }

  function updateEditor(patch) {
    setEditor((current) => ({ ...current, ...patch }));
  }

  function updatePhase(index, patch) {
    setEditor((current) => ({
      ...current,
      phases: current.phases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, ...patch } : phase),
    }));
  }

  function updateTask(taskId, patch) {
    setEditor((current) => ({
      ...current,
      phases: current.phases.map((phase) => ({
        ...phase,
        tasks: (phase.tasks || []).map((task) => task.id === taskId ? { ...task, ...patch } : task),
      })),
      tasks: (current.tasks || []).map((task) => task.id === taskId ? { ...task, ...patch } : task),
    }));
  }

  function addTask(phaseIndex) {
    setEditor((current) => ({
      ...current,
      phases: current.phases.map((phase, index) => index === phaseIndex ? { ...phase, tasks: [...(phase.tasks || []), blankTask(phase.id)] } : phase),
    }));
  }

  function deleteTask(taskId) {
    setEditor((current) => ({
      ...current,
      phases: current.phases.map((phase) => ({ ...phase, tasks: (phase.tasks || []).filter((task) => task.id !== taskId) })),
      tasks: (current.tasks || []).filter((task) => task.id !== taskId),
    }));
  }

  async function saveProject(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...editor,
        aliases: Array.isArray(editor.aliases) ? editor.aliases : listFromText(editor.aliases),
      };
      await api(editor.id ? `/project-dashboard/projects/${editor.id}` : "/project-dashboard/projects", {
        method: editor.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(editor.id ? "Project updated" : "Project created");
      setEditor(null);
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not save project");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    try {
      await api(`/project-dashboard/projects/${project.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      setSelected(null);
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not delete project");
    }
  }

  async function patchProject(project, patch, successMessage = "Project updated") {
    try {
      const source = config.projects.find((item) => item.id === project.id) || project;
      await api(`/project-dashboard/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...source, ...patch }),
      });
      toast.success(successMessage);
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not update project");
    }
  }

  function quickAddPhase() {
    setPhaseDraft({ ...blankPhase() });
    setDetailTab("phases");
  }

  function quickAddTask(project, phaseId = null) {
    const phases = project.phases?.length ? project.phases : [{ ...blankPhase(), name: "Planning" }];
    const targetPhaseId = phaseId || phases[0]?.id;
    setNewTaskDraft({ ...blankTask(targetPhaseId), phaseId: targetPhaseId });
    setDetailTab("table");
  }

  async function saveNewTask(project) {
    if (!newTaskDraft?.title?.trim()) return toast.error("Add task title");
    const phases = project.phases?.length ? project.phases : [{ ...blankPhase(), name: "Planning" }];
    const targetPhaseId = newTaskDraft.phaseId || phases[0]?.id;
    const nextTask = { ...newTaskDraft, phaseId: targetPhaseId, title: newTaskDraft.title.trim() };
    const nextPhases = phases.map((phase) => phase.id === targetPhaseId ? { ...phase, tasks: [...(phase.tasks || []), nextTask] } : phase);
    await patchProject(project, { phases: nextPhases }, "Task added");
    setNewTaskDraft(null);
  }

  async function saveNewPhase(project) {
    if (!phaseDraft?.name?.trim()) return toast.error("Add phase name");
    await patchProject(project, { phases: [...(project.phases || []), { ...phaseDraft, name: phaseDraft.name.trim() }] }, "Phase added");
    setPhaseDraft(null);
  }

  async function saveInlineTask(project, taskId) {
    const patch = taskEdits[taskId];
    if (!patch) return;
    const phases = project.phases?.length ? project.phases : [];
    const originalTask = selectedTasks.find((task) => task.id === taskId);
    if (!originalTask) return toast.error("Task not found");
    const nextTask = { ...originalTask, ...patch };
    const nextPhases = phases.map((phase) => ({
      ...phase,
      tasks: (phase.tasks || []).filter((task) => task.id !== taskId),
    })).map((phase) => phase.id === nextTask.phaseId ? { ...phase, tasks: [...(phase.tasks || []), nextTask] } : phase);
    await patchProject(project, { phases: nextPhases }, "Task updated");
    setTaskEdits((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  async function deleteInlineTask(project, taskId) {
    const nextPhases = (project.phases || []).map((phase) => ({ ...phase, tasks: (phase.tasks || []).filter((task) => task.id !== taskId) }));
    await patchProject(project, { phases: nextPhases }, "Task deleted");
  }

  function openTaskDetail(task) {
    setTaskDetail(JSON.parse(JSON.stringify(task)));
  }

  async function saveTaskDetail(project) {
    if (!taskDetail?.title?.trim()) return toast.error("Add task title");
    const phases = project.phases?.length ? project.phases : [{ ...blankPhase(), name: "Planning" }];
    const nextTask = { ...taskDetail, title: taskDetail.title.trim() };
    const nextPhases = phases.map((phase) => ({
      ...phase,
      tasks: (phase.tasks || []).filter((task) => task.id !== nextTask.id),
    })).map((phase) => phase.id === nextTask.phaseId ? { ...phase, tasks: [...(phase.tasks || []), nextTask] } : phase);
    await patchProject(project, { phases: nextPhases }, "Task updated");
    setTaskDetail(null);
  }

  async function addDocumentLink() {
    if (!selectedProject?.id || !docForm.url.trim()) return toast.error("Paste a document link");
    try {
      await api(`/project-dashboard/projects/${selectedProject.id}/documents`, {
        method: "POST",
        body: JSON.stringify(docForm),
      });
      toast.success("Document added");
      setDocForm({ name: "", category: "General", url: "" });
      await load(true);
      await loadProjectDocs(selectedProject.id);
    } catch (error) {
      toast.error(error.message || "Could not add document");
    }
  }

  async function uploadProjectDocument(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedProject?.id) return;
    try {
      setUploadingDoc(true);
      const form = new FormData();
      form.append("file", file);
      form.append("category", docForm.category || "General");
      await apiForm(`/project-dashboard/projects/${selectedProject.id}/documents/upload`, form);
      toast.success("Uploaded to project Drive folder");
      await load(true);
      await loadProjectDocs(selectedProject.id);
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  }

  if (loading) {
    return (
      <div className={`flex min-h-0 flex-1 items-center justify-center ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
        <div className={`rounded-[30px] border p-8 text-center ${panel}`}>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" />
          <h2 className="mt-4 text-xl font-semibold">Loading project workspace</h2>
          <p className={`mt-2 text-sm ${muted}`}>Preparing projects, phases, tasks, and linked documents.</p>
        </div>
      </div>
    );
  }

  const renderTaskCard = (task) => (
    <button type="button" onClick={() => openTaskDetail(task)} key={task.id} className={`w-full rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 ${darkMode ? "border-white/10 bg-white/[0.045]" : "border-black/[0.06] bg-white shadow-[0_14px_36px_rgba(28,42,64,0.06)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">{task.title}</h4>
          <p className={`mt-1 text-xs ${muted}`}>{phaseMap.get(task.phaseId)?.name || task.phaseName || "No phase"} · {formatDate(task.dueDate)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${priorityClass(task.priority, darkMode)}`}>{task.priority || "medium"}</span>
      </div>
      {task.description && <p className={`mt-3 line-clamp-3 text-xs leading-5 ${muted}`}>{task.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(task.assigneeIds || []).map((id) => {
          const member = users.find((item) => item.id === id);
          return <span key={id} className={`rounded-full px-2 py-1 text-[10px] ${darkMode ? "bg-white/8 text-white/65" : "bg-[#eef4ec] text-black/60"}`}>{member?.displayName || id}</span>;
        })}
        {(task.dependencyIds || []).length > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700">{task.dependencyIds.length} dependencies</span>}
      </div>
    </button>
  );

  if (selectedProject) {
    const totalTasks = selectedTasks.length;
    const doneTasks = selectedTasks.filter((task) => task.status === "done").length;
    const blockedTasks = selectedTasks.filter((task) => task.status === "blocked").length;
    const inProgressTasks = selectedTasks.filter((task) => task.status === "in_progress").length;
    const todoTasks = selectedTasks.filter((task) => !task.status || task.status === "todo").length;
    const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : selectedProject.metrics?.progress || 0;
    const ringCircumference = 2 * Math.PI * 42;
    const ringOffset = ringCircumference - (progress / 100) * ringCircumference;
    const statusCounts = [
      { label: "Todo", value: todoTasks, color: "bg-violet-500" },
      { label: "In progress", value: inProgressTasks, color: "bg-sky-500" },
      { label: "Blocked", value: blockedTasks, color: "bg-rose-500" },
      { label: "Done", value: doneTasks, color: "bg-emerald-500" },
    ];
    const priorityCounts = PRIORITY_OPTIONS.map((option) => ({
      ...option,
      count: selectedTasks.filter((task) => (task.priority || "medium") === option.value).length,
    }));
    const editablePhases = selectedProject.phases?.length ? selectedProject.phases : [{ ...blankPhase(), name: "Planning" }];
    const newTaskPhaseOptions = editablePhases.map((phase) => ({ value: phase.id, label: phase.name || "Untitled phase" }));
    const tabItems = [
      { value: "board", label: "Activity" },
      { value: "table", label: "Tasks", count: totalTasks },
      { value: "phases", label: "Phases", count: editablePhases.length },
      { value: "documents", label: "Files", count: docs.length || selectedProject.metrics?.documents || 0 },
    ];
    const stageItems = editablePhases.slice(0, 4);
    const projectMembers = [...new Set(selectedTasks.flatMap((task) => task.assigneeIds || []))]
      .map((id) => users.find((user) => user.id === id)?.displayName || id)
      .filter(Boolean);
    const latestTasks = [...selectedTasks]
      .sort((a, b) => String(b.updatedAt || b.createdAt || b.dueDate || "").localeCompare(String(a.updatedAt || a.createdAt || a.dueDate || "")))
      .slice(0, 5);
    const compactTaskDrawer = taskDetail && (
      <div className="fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-sm">
        <aside className={`flex h-full w-full max-w-[620px] flex-col overflow-hidden border-l shadow-2xl ${darkMode ? "border-white/10 bg-[#111318] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
          <header className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
            <div className="flex items-center gap-3 text-sm">
              <button type="button" className={`rounded-full px-3 py-2 ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>Share</button>
              <button type="button" className={`rounded-full px-3 py-2 ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>Expand</button>
            </div>
            <button type="button" onClick={() => setTaskDetail(null)} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.05]"}`}>
              <X className="h-5 w-5" />
            </button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <p className={`flex items-center gap-2 text-xs ${muted}`}><CalendarDays className="h-4 w-4" /> {phaseMap.get(taskDetail.phaseId)?.name || "Project task"}</p>
            <input value={taskDetail.title || ""} onChange={(event) => setTaskDetail((current) => ({ ...current, title: event.target.value }))} className={`mt-3 w-full rounded-2xl border-0 bg-transparent text-3xl font-semibold leading-tight outline-none ${darkMode ? "placeholder:text-white/25" : "placeholder:text-black/25"}`} placeholder="Task title" />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SelectMenu darkMode={darkMode} value={taskDetail.priority || "medium"} onChange={(value) => setTaskDetail((current) => ({ ...current, priority: value }))} options={PRIORITY_OPTIONS} />
              <SelectMenu darkMode={darkMode} value={taskDetail.status || "todo"} onChange={(value) => setTaskDetail((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
              <TextInput darkMode={darkMode} type="date" value={taskDetail.dueDate} onChange={(value) => setTaskDetail((current) => ({ ...current, dueDate: value }))} />
            </div>
            <div className={`mt-6 flex items-center justify-between rounded-2xl px-4 py-4 ${darkMode ? "bg-violet-400/12" : "bg-gradient-to-r from-violet-100 to-pink-100"}`}>
              <span className="flex items-center gap-3 text-sm font-semibold"><Clock3 className="h-5 w-5" /> Time spent on this project</span>
              <span className="text-lg font-semibold">00:00:00</span>
            </div>
            <section className="mt-7">
              <h4 className="text-sm font-semibold">Description</h4>
              <TextArea darkMode={darkMode} value={taskDetail.description} onChange={(value) => setTaskDetail((current) => ({ ...current, description: value }))} placeholder="Write expected output, blockers, and completion notes..." rows={5} />
            </section>
            <section className="mt-7 grid gap-4 sm:grid-cols-2">
              <Field label="Phase"><SelectMenu darkMode={darkMode} value={taskDetail.phaseId} onChange={(value) => setTaskDetail((current) => ({ ...current, phaseId: value }))} options={newTaskPhaseOptions} /></Field>
              <Field label="People"><UserPicker darkMode={darkMode} users={users} selectedIds={taskDetail.assigneeIds || []} onChange={(ids) => setTaskDetail((current) => ({ ...current, assigneeIds: ids }))} /></Field>
            </section>
          </main>
          <footer className={`flex justify-between gap-3 border-t px-6 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
            <button type="button" onClick={() => deleteInlineTask(selectedProject, taskDetail.id)} className="rounded-full bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-500">Delete task</button>
            <button type="button" onClick={() => saveTaskDetail(selectedProject)} className="rounded-full bg-[#7bea2a] px-6 py-3 text-sm font-semibold text-black">Save task</button>
          </footer>
        </aside>
      </div>
    );
    const focusedProjectDetailView = (
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f3f3ef] text-[#171714]"}`}>
        <header className={`sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b px-5 py-3 ${darkMode ? "border-white/10 bg-[#111318]" : "border-black/[0.08] bg-white"}`}>
          <div className="min-w-0">
            <p className="truncate text-sm"><span className="font-semibold">{selectedProject.name}</span><span className={muted}> · Project details</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => load(true)} className={`rounded-full px-4 py-2 text-sm font-semibold ${darkMode ? "bg-white/8 text-white/80" : "bg-[#eef4ec] text-[#3d7f14]"}`}><RefreshCw className="mr-2 inline h-4 w-4" /> Refresh</button>
            {isSuperAdmin && <button type="button" onClick={() => openEditor(selectedProject)} className="rounded-full bg-[#ff3347] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,51,71,0.22)]"><Pencil className="mr-2 inline h-4 w-4" /> Edit project</button>}
            <button type="button" onClick={closeProject} className="rounded-full px-4 py-2 text-sm font-semibold text-[#3d7f14] hover:bg-[#eef4ec]">Close</button>
          </div>
        </header>

        <nav className={`z-20 flex shrink-0 gap-7 border-b px-6 lg:px-10 ${darkMode ? "border-white/10 bg-[#101216]" : "border-black/[0.06] bg-white"}`}>
          {tabItems.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setDetailTab(tab.value)} className={`flex items-center gap-2 border-b-2 py-4 text-sm font-semibold transition ${detailTab === tab.value ? "border-[#4b9b16] text-[#4b9b16]" : "border-transparent text-black/60 hover:text-black"}`}>
              {tab.label}
              {typeof tab.count === "number" && <span className={`rounded-full px-2 py-0.5 text-xs ${detailTab === tab.value ? "bg-[#4b9b16]/10" : darkMode ? "bg-white/8" : "bg-black/[0.05]"}`}>{tab.count}</span>}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {detailTab === "board" && (
            <div className="space-y-5 p-5 lg:p-8">
              <section className={`rounded-[28px] border p-5 ${panel}`}>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_540px]">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-[#14aa6d] text-3xl font-bold text-white">
                      {(selectedProject.name || "P").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md bg-pink-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-pink-700">Project</span>
                        <span className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${healthClass(selectedProject.health, darkMode)}`}>
                          {selectedProject.health || "Green"}
                        </span>
                      </div>
                      <h2 className="mt-3 truncate text-3xl font-semibold">{selectedProject.name}</h2>
                      <p className={`mt-1 truncate text-base ${muted}`}>{selectedProject.client || selectedProject.location || "Project workspace"}</p>
                      <p className={`mt-3 line-clamp-2 max-w-3xl text-sm leading-6 ${muted}`}>
                        {selectedProject.description || "Manage phases, tasks, deadlines, people, and project documents in one workspace."}
                      </p>
                    </div>
                    {isSuperAdmin && (
                      <button type="button" onClick={() => openEditor(selectedProject)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#7bea2a] px-5 text-sm font-semibold text-black">
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`rounded-[20px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#eef8ff]"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Progress</p>
                        <span className="text-2xl font-semibold text-[#1374c8]">{progress}%</span>
                      </div>
                      <div className={`mt-3 h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-white"}`}>
                        <div className="h-full rounded-full bg-[#28b7e8]" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                    </div>
                    <div className={`rounded-[20px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#effaf2]"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Tasks done</p>
                      <p className="mt-2 text-2xl font-semibold text-[#079c62]">{doneTasks}/{totalTasks || 0}</p>
                    </div>
                    <div className={`rounded-[20px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#fff6df]"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Target date</p>
                      <p className="mt-2 text-lg font-semibold">{formatDate(selectedProject.targetDate)}</p>
                    </div>
                    <div className={`rounded-[20px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#fff0f1]"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Blocked</p>
                      <p className={`mt-2 text-2xl font-semibold ${blockedTasks ? "text-red-500" : "text-[#079c62]"}`}>{blockedTasks}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                <div className={`rounded-[24px] border p-5 ${panel}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Pipeline</p>
                      <h3 className="mt-1 text-2xl font-semibold">Project Work · {blockedTasks ? "Attention" : progress === 100 ? "Complete" : "Active"}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-[#f2f2ef] text-black/60"}`}>{progress}% complete</span>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-full">
                    <div className={`grid h-12 ${stageItems.length <= 1 ? "grid-cols-1" : stageItems.length === 2 ? "grid-cols-2" : stageItems.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                      {(stageItems.length ? stageItems : [{ id: "default", name: "Planning" }]).map((phase, index) => {
                        const phaseTasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                        const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                        const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : index === 0 ? progress : 0;
                        return (
                          <button key={phase.id || phase.name} type="button" onClick={() => setDetailTab("phases")} className={`min-w-0 px-3 text-sm font-semibold ${phaseProgress === 100 ? "bg-[#8edbd6]" : phaseProgress > 0 ? "bg-[#a1e4df]" : darkMode ? "bg-white/8" : "bg-[#e8e7e2]"}`}>
                            <span className="block truncate">{phase.name || `Phase ${index + 1}`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${blockedTasks ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600"}`}>
                        {blockedTasks ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                      </span>
                      <div>
                        <p className={`text-xs ${muted}`}>Current status</p>
                        <p className="font-semibold">{blockedTasks ? "Needs attention" : "On track"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? "bg-white/8" : "bg-[#f2f2ef]"}`}><UserRound className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className={`text-xs ${muted}`}>Manager</p>
                        <p className="truncate font-semibold">{selectedProject.manager || "Not assigned"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-[24px] border p-5 ${panel}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Project details</p>
                  <div className="mt-4 grid gap-3">
                    {[[CalendarDays, "Target", formatDate(selectedProject.targetDate)], [Flag, "Priority", selectedProject.priority || "Medium"], [ShieldCheck, "Health", selectedProject.health || "Green"], [FileText, "Documents", docs.length || selectedProject.metrics?.documents || 0]].map(([Icon, label, value]) => (
                      <div key={label} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${darkMode ? "bg-white/[0.035]" : "bg-[#f7f8f4]"}`}>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/8" : "bg-white"}`}><Icon className="h-4 w-4" /></span>
                          <span className={`text-sm ${muted}`}>{label}</span>
                        </span>
                        <span className="truncate text-sm font-semibold capitalize">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
                <section className={`rounded-[24px] border p-5 ${panel}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Activity</p>
                      <h3 className="mt-1 text-2xl font-semibold">Latest movement</h3>
                    </div>
                    {isSuperAdmin && (
                      <button type="button" onClick={() => quickAddTask(selectedProject)} className="rounded-full bg-[#171714] px-4 py-2 text-sm font-semibold text-white">
                        <Plus className="mr-1 inline h-4 w-4" /> Add task
                      </button>
                    )}
                  </div>
                  <div className="mt-5 divide-y divide-black/[0.06]">
                    {(latestTasks.length ? latestTasks : selectedTasks.slice(0, 4)).map((task, index) => (
                      <button key={task.id || index} type="button" onClick={() => openTaskDetail(task)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${task.status === "done" ? "bg-[#7bea2a] text-black" : task.status === "blocked" ? "bg-red-100 text-red-600" : "bg-[#8edbd6] text-black"}`}>
                            {task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{task.title || "Untitled task"}</span>
                            <span className={`mt-0.5 block truncate text-sm ${muted}`}>{statusLabel(task.status)} in {phaseMap.get(task.phaseId)?.name || "project"}</span>
                          </span>
                        </span>
                        <span className={`shrink-0 text-sm ${muted}`}>{formatDate(task.dueDate)}</span>
                      </button>
                    ))}
                    {!selectedTasks.length && <p className={`rounded-2xl border border-dashed p-8 text-center text-sm ${muted}`}>No task activity yet. Add a task to start the project timeline.</p>}
                  </div>
                </section>

                <section className={`overflow-hidden rounded-[24px] border ${panel}`}>
                  <div className={`border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Schedule</p>
                    <h3 className="mt-1 text-2xl font-semibold">Milestones</h3>
                  </div>
                  <div className="divide-y divide-black/[0.06]">
                    {editablePhases.map((phase, index) => {
                      const phaseTasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                      const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                      const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : 0;
                      return (
                        <button key={phase.id || index} type="button" onClick={() => setDetailTab("phases")} className="grid w-full grid-cols-[96px_minmax(0,1fr)] text-left">
                          <span className={`px-4 py-4 ${darkMode ? "bg-white/[0.03]" : "bg-[#f6f6f2]"}`}>
                            <span className="block text-xs font-semibold text-[#4b9b16]">Phase {index + 1}</span>
                            <span className="mt-1 block text-sm font-semibold">{formatDate(phase.dueDate)}</span>
                          </span>
                          <span className="min-w-0 px-4 py-4">
                            <span className="flex items-center justify-between gap-3">
                              <span className="truncate font-semibold">{phase.name || "Untitled phase"}</span>
                              <span className={`shrink-0 text-xs ${muted}`}>{phaseProgress}%</span>
                            </span>
                            <span className={`mt-1 block text-xs ${muted}`}>{phaseTasks.length} tasks · {phaseDone} done</span>
                            <span className={`mt-2 block h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>
                              <span className="block h-full rounded-full bg-[#7bea2a]" style={{ width: `${phaseProgress}%` }} />
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </section>
            </div>
          )}

          {detailTab === "board" && false && (
            <div className="grid min-h-full lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className={`border-r p-6 ${darkMode ? "border-white/10 bg-[#111318]" : "border-black/[0.08] bg-white"}`}>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-pink-100 px-3 py-2 text-xs font-bold uppercase text-pink-700">Project</span>
                  <span className={`rounded-md px-3 py-2 text-xs font-bold uppercase ${healthClass(selectedProject.health, darkMode)}`}>{selectedProject.health || "Green"}</span>
                </div>
                <p className={`mt-8 text-sm ${muted}`}>Project workspace</p>
                <div className="mt-5 flex items-center gap-5">
                  <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[32px] bg-[#14aa6d] text-4xl font-bold text-white">{(selectedProject.name || "P").slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0"><h2 className="truncate text-3xl font-semibold">{selectedProject.name}</h2><p className={`mt-1 truncate text-lg ${muted}`}>{selectedProject.client || selectedProject.location || "Project"}</p></div>
                </div>
                <p className={`mt-8 text-lg leading-8 ${muted}`}>{selectedProject.description || "Manage phases, tasks, deadlines, people, and project documents in one workspace."}</p>
                {isSuperAdmin && <button type="button" onClick={() => openEditor(selectedProject)} className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#7bea2a] text-lg font-semibold text-black shadow-[0_14px_34px_rgba(123,234,42,0.25)]"><Pencil className="h-5 w-5" /> Edit project</button>}
                <div className={`mt-8 rounded-[18px] p-5 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f4f1]"}`}>
                  <p className={`text-sm ${muted}`}>Progress</p>
                  <div className="mt-2 flex items-end justify-between gap-4"><p className="text-4xl font-semibold">{progress}%</p><p className={`pb-1 text-sm ${muted}`}>{doneTasks}/{totalTasks || 0} tasks done</p></div>
                  <div className={`mt-4 h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className="h-full rounded-full bg-[#7bea2a]" style={{ width: `${Math.min(100, progress)}%` }} /></div>
                </div>
                <div className="mt-8 space-y-4">
                  {[[UserRound, "Manager", selectedProject.manager || "Not assigned"], [CalendarDays, "Target", formatDate(selectedProject.targetDate)], [Flag, "Priority", selectedProject.priority || "Medium"], [ShieldCheck, "Health", selectedProject.health || "Green"]].map(([Icon, label, value]) => (
                    <div key={label} className="flex items-center gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/8" : "bg-[#f2f2ef]"}`}><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className={`block text-sm ${muted}`}>{label}</span><span className="block truncate text-base font-semibold capitalize">{value}</span></span></div>
                  ))}
                </div>
              </aside>
              <section className="min-w-0 p-6 lg:p-10">
                <div className={`rounded-[28px] border p-6 ${panel}`}>
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-2xl"><span>Pipeline: <strong>Project Work</strong></span><span className={muted}>| Stage:</span><strong>{blockedTasks ? "Attention" : progress === 100 ? "Complete" : "Active"}</strong></div>
                      <div className="mt-6 overflow-hidden rounded-full">
                        <div className={`grid h-12 ${stageItems.length <= 1 ? "grid-cols-1" : stageItems.length === 2 ? "grid-cols-2" : stageItems.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                          {(stageItems.length ? stageItems : [{ id: "default", name: "Planning" }]).map((phase, index) => {
                            const phaseTasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                            const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                            const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : index === 0 ? progress : 0;
                            return <button key={phase.id || phase.name} type="button" onClick={() => setDetailTab("phases")} className={`min-w-0 px-3 text-sm font-semibold ${phaseProgress === 100 ? "bg-[#8edbd6]" : phaseProgress > 0 ? "bg-[#a1e4df]" : darkMode ? "bg-white/8" : "bg-[#e8e7e2]"}`}><span className="block truncate">{phase.name || `Phase ${index + 1}`}</span></button>;
                          })}
                        </div>
                      </div>
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500"><AlertTriangle className="h-5 w-5" /></span><div><p className={`text-sm ${muted}`}>Current status</p><p className="text-lg font-semibold">{blockedTasks ? "Needs attention" : "On track"}</p></div></div>
                        <div className="flex items-center gap-4"><span className={`flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-white/8" : "bg-[#f2f2ef]"}`}><Clock3 className="h-5 w-5" /></span><div><p className={`text-sm ${muted}`}>Target date</p><p className="text-lg font-semibold">{formatDate(selectedProject.targetDate)}</p></div></div>
                      </div>
                    </div>
                    <p className={`text-sm ${muted}`}>{progress}% complete</p>
                  </div>
                </div>
                <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <section>
                    <h3 className="text-3xl font-semibold">Latest Activity</h3>
                    <div className="mt-5 space-y-5">
                      {(latestTasks.length ? latestTasks : selectedTasks.slice(0, 4)).map((task, index) => (
                        <button key={task.id || index} type="button" onClick={() => openTaskDetail(task)} className="flex w-full items-start justify-between gap-4 text-left">
                          <span className="flex min-w-0 items-start gap-4"><span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${task.status === "done" ? "bg-[#7bea2a] text-black" : task.status === "blocked" ? "bg-red-100 text-red-600" : "bg-[#8edbd6] text-black"}`}>{task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><span className="min-w-0"><span className="block text-lg font-semibold">{task.title || "Untitled task"}</span><span className={`mt-1 block text-sm ${muted}`}>{task.description || `${statusLabel(task.status)} in ${phaseMap.get(task.phaseId)?.name || "project"}.`}</span></span></span>
                          <span className={`shrink-0 text-sm ${muted}`}>{formatDate(task.dueDate)}</span>
                        </button>
                      ))}
                      {!selectedTasks.length && <p className={`rounded-2xl border border-dashed p-10 text-center text-sm ${muted}`}>No task activity yet. Add a task to start the project timeline.</p>}
                    </div>
                  </section>
                  <section className={`overflow-hidden rounded-[24px] border ${panel}`}>
                    <div className={`border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Project schedule</p><h3 className="mt-2 text-2xl font-semibold">Milestone overview</h3></div>
                    <div className="divide-y divide-black/[0.06]">
                      {editablePhases.map((phase, index) => {
                        const phaseTasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                        const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                        const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : 0;
                        return <button key={phase.id || index} type="button" onClick={() => setDetailTab("phases")} className="grid w-full grid-cols-[130px_minmax(0,1fr)] text-left"><span className={`px-5 py-5 ${darkMode ? "bg-white/[0.03]" : "bg-[#f6f6f2]"}`}><span className="block text-sm font-semibold text-[#4b9b16]">Phase {index + 1}</span><span className="mt-1 block text-lg font-semibold">{formatDate(phase.dueDate)}</span></span><span className="min-w-0 px-5 py-5"><span className="block truncate text-lg font-semibold">{phase.name || "Untitled phase"}</span><span className={`mt-1 block text-sm ${muted}`}>{phaseTasks.length} tasks · {phaseProgress}% complete</span></span></button>;
                      })}
                    </div>
                  </section>
                </div>
              </section>
            </div>
          )}

          {detailTab === "table" && (
            <div className="p-6 lg:p-10">
              <section className={`overflow-hidden rounded-[28px] border ${panel}`}>
                <div className="flex items-center justify-between gap-4 px-6 py-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Tasks</p><h3 className="text-3xl font-semibold">Project task register</h3></div>{isSuperAdmin && <button type="button" onClick={() => quickAddTask(selectedProject)} className="rounded-full bg-[#171714] px-5 py-3 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4" /> Add task</button>}</div>
                <div className="overflow-x-auto"><div className="min-w-[1020px]">
                  <div className={`grid grid-cols-[minmax(280px,1.5fr)_180px_240px_150px_140px_150px_90px] gap-4 border-y px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? "border-white/10 text-white/40" : "border-black/[0.06] bg-[#f7f8f5] text-black/45"}`}><span>Task</span><span>Phase</span><span>People</span><span>Status</span><span>Priority</span><span>Deadline</span><span>Action</span></div>
                  {newTaskDraft && <div className={`grid grid-cols-[minmax(280px,1.5fr)_180px_240px_150px_140px_150px_90px] gap-4 border-b px-6 py-4 ${darkMode ? "border-white/8 bg-emerald-400/5" : "border-black/[0.05] bg-emerald-50/70"}`}><div className="space-y-2"><TextInput darkMode={darkMode} value={newTaskDraft.title} onChange={(value) => setNewTaskDraft((current) => ({ ...current, title: value }))} placeholder="Task title" /><TextInput darkMode={darkMode} value={newTaskDraft.description} onChange={(value) => setNewTaskDraft((current) => ({ ...current, description: value }))} placeholder="Short description / output" /></div><SelectMenu darkMode={darkMode} value={newTaskDraft.phaseId} onChange={(value) => setNewTaskDraft((current) => ({ ...current, phaseId: value }))} options={newTaskPhaseOptions} /><UserPicker darkMode={darkMode} users={users} selectedIds={newTaskDraft.assigneeIds || []} onChange={(ids) => setNewTaskDraft((current) => ({ ...current, assigneeIds: ids }))} /><SelectMenu darkMode={darkMode} value={newTaskDraft.status} onChange={(value) => setNewTaskDraft((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} /><SelectMenu darkMode={darkMode} value={newTaskDraft.priority} onChange={(value) => setNewTaskDraft((current) => ({ ...current, priority: value }))} options={PRIORITY_OPTIONS} /><TextInput darkMode={darkMode} type="date" value={newTaskDraft.dueDate} onChange={(value) => setNewTaskDraft((current) => ({ ...current, dueDate: value }))} /><div className="flex flex-col gap-2"><button type="button" onClick={() => saveNewTask(selectedProject)} className="rounded-full bg-[#7bea2a] px-4 py-2 text-xs font-semibold text-black">Save</button><button type="button" onClick={() => setNewTaskDraft(null)} className={`rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-black/[0.04] text-black/60"}`}>Cancel</button></div></div>}
                  {selectedTasks.map((task) => {
                    const assignees = (task.assigneeIds || []).map((id) => users.find((item) => item.id === id)?.displayName || id).filter(Boolean);
                    return <button type="button" onClick={() => openTaskDetail(task)} key={task.id} className={`grid w-full grid-cols-[minmax(280px,1.5fr)_180px_240px_150px_140px_150px_90px] items-center gap-4 border-t px-6 py-5 text-left text-sm transition ${darkMode ? "border-white/8 hover:bg-white/[0.035]" : "border-black/[0.05] hover:bg-[#f7fbff]"}`}><span className="min-w-0"><span className="block truncate font-semibold">{task.title || "Untitled task"}</span><span className={`mt-1 block truncate text-xs ${muted}`}>{task.description || "No description"}</span></span><span className={muted}>{phaseMap.get(task.phaseId)?.name || task.phaseName || "-"}</span><span className="flex min-w-0 flex-wrap gap-1.5">{assignees.length ? assignees.slice(0, 2).map((name) => <span key={name} className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8 text-white/65" : "bg-[#eef4ec] text-black/60"}`}>{name}</span>) : <span className={muted}>Unassigned</span>}</span><span>{statusLabel(task.status)}</span><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(task.priority, darkMode)}`}>{task.priority || "medium"}</span><span>{formatDate(task.dueDate)}</span><span className="font-semibold text-emerald-600">Open</span></button>;
                  })}
                  {!selectedTasks.length && !newTaskDraft && <p className={`p-10 text-center text-sm ${muted}`}>No tasks added yet. Use Add task to create the first row.</p>}
                </div></div>
              </section>
            </div>
          )}

          {detailTab === "phases" && (
            <div className="space-y-5 p-6 lg:p-10">
              <div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Phases</p><h3 className="text-3xl font-semibold">Project phase schedule</h3></div>{isSuperAdmin && <button type="button" onClick={quickAddPhase} className="rounded-full bg-[#171714] px-5 py-3 text-sm font-semibold text-white"><Layers3 className="mr-2 inline h-4 w-4" /> Add phase</button>}</div>
              {phaseDraft && <article className={`rounded-[18px] border p-5 ${darkMode ? "border-emerald-400/30 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50/70"}`}><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">New phase</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Phase name"><TextInput darkMode={darkMode} value={phaseDraft.name} onChange={(value) => setPhaseDraft((current) => ({ ...current, name: value }))} placeholder="e.g. Design approval" /></Field><Field label="Due date"><TextInput darkMode={darkMode} type="date" value={phaseDraft.dueDate} onChange={(value) => setPhaseDraft((current) => ({ ...current, dueDate: value }))} /></Field><div className="md:col-span-2"><Field label="Description"><TextArea darkMode={darkMode} value={phaseDraft.description} onChange={(value) => setPhaseDraft((current) => ({ ...current, description: value }))} placeholder="What this phase must complete..." rows={3} /></Field></div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => saveNewPhase(selectedProject)} className="rounded-full bg-[#7bea2a] px-5 py-2.5 text-sm font-semibold text-black">Save phase</button><button type="button" onClick={() => setPhaseDraft(null)} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-white text-black/60"}`}>Cancel</button></div></article>}
              {editablePhases.map((phase, index) => {
                const tasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                const done = tasks.filter((task) => task.status === "done").length;
                const phaseProgress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
                return <article key={phase.id || index} className={`grid overflow-hidden rounded-[24px] border ${panel} md:grid-cols-[240px_minmax(0,1fr)]`}><div className={`p-6 ${darkMode ? "bg-white/[0.03]" : "bg-[#f6f6f2]"}`}><p className="text-sm font-semibold text-[#4b9b16]">Phase {index + 1}</p><h4 className="mt-3 text-2xl font-semibold">{phase.name || "Untitled phase"}</h4><p className={`mt-2 text-sm ${muted}`}>{formatDate(phase.dueDate)}</p></div><div className="p-6"><div className="flex items-center justify-between gap-4"><p className={`text-sm ${muted}`}>{phase.description || "No description added."}</p><span className="text-lg font-semibold">{phaseProgress}%</span></div><div className={`mt-4 h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className="h-full rounded-full bg-[#7bea2a]" style={{ width: `${phaseProgress}%` }} /></div>{isSuperAdmin && <button type="button" onClick={() => quickAddTask(selectedProject, phase.id)} className="mt-5 rounded-full bg-[#171714] px-4 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add task</button>}</div></article>;
              })}
            </div>
          )}

          {detailTab === "documents" && (
            <div className="grid gap-5 p-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:p-10">
              <section className={`rounded-[24px] border p-6 ${panel}`}><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Google Drive</p><h4 className="mt-1 text-2xl font-semibold">Project documents</h4><p className={`mt-2 text-sm leading-6 ${muted}`}>Files are read from the linked Drive folder. Uploads go into that same folder when it is shared with the service account.</p>{selectedProject.driveFolderId || selectedProject.driveFolderLink ? <a href={selectedProject.driveFolderLink || `https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Open Drive folder <ArrowUpRight className="h-4 w-4" /></a> : <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700">Add a Google Drive folder link in project settings to enable Drive sync and uploads.</p>}{isSuperAdmin && <div className="mt-6 space-y-3"><Field label="Category"><SelectMenu darkMode={darkMode} value={docForm.category} onChange={(value) => setDocForm((current) => ({ ...current, category: value }))} options={DOC_CATEGORIES} /></Field><Field label="Document name"><TextInput darkMode={darkMode} value={docForm.name} onChange={(value) => setDocForm((current) => ({ ...current, name: value }))} placeholder="e.g. Approved drawing" /></Field><Field label="Drive/document link"><TextInput darkMode={darkMode} value={docForm.url} onChange={(value) => setDocForm((current) => ({ ...current, url: value }))} placeholder="https://drive.google.com/..." /></Field><button type="button" onClick={addDocumentLink} className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sm font-semibold text-black"><LinkIcon className="h-4 w-4" /> Add link</button><label className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold ${selectedProject.driveFolderId || selectedProject.driveFolderLink ? "bg-[#7bea2a] text-black" : "bg-black/5 text-black/35"}`}>{uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload to Drive<input type="file" disabled={uploadingDoc || !(selectedProject.driveFolderId || selectedProject.driveFolderLink)} onChange={uploadProjectDocument} className="hidden" /></label></div>}</section>
              <section className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-3">{docs.map((doc) => <a key={doc.driveFileId || doc.url || doc.id} href={doc.url} target="_blank" rel="noreferrer" className={`rounded-[18px] border p-4 transition hover:-translate-y-0.5 ${panel}`}><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><FileText className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{doc.name}</p><p className={`mt-1 text-xs ${muted}`}>{doc.category || doc.source || "Document"} · {doc.uploadedAt ? formatDate(String(doc.uploadedAt).slice(0, 10)) : "Drive"}</p></div></div></a>)}{!docs.length && <p className={`rounded-[18px] border border-dashed p-10 text-center text-sm ${muted}`}>No project documents found yet.</p>}</section>
            </div>
          )}
        </main>
        {compactTaskDrawer}
      </div>
    );
    return focusedProjectDetailView;
    const projectDetailView = (
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f3f3ef] text-[#171714]"}`}>
        <header className={`sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b px-5 py-3 ${darkMode ? "border-white/10 bg-[#111318]" : "border-black/[0.08] bg-white"}`}>
          <div className="min-w-0">
            <p className="truncate text-sm">
              <span className="font-semibold">{selectedProject.name}</span>
              <span className={muted}> · Project details</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => load(true)} className={`hidden rounded-full px-4 py-2 text-sm font-semibold sm:inline-flex ${darkMode ? "bg-white/8 text-white/80" : "bg-[#eef4ec] text-[#3d7f14]"}`}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </button>
            {isSuperAdmin && (
              <button type="button" onClick={() => openEditor(selectedProject)} className="hidden rounded-full bg-[#ff3347] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,51,71,0.22)] sm:inline-flex">
                <Pencil className="mr-2 h-4 w-4" /> Edit project
              </button>
            )}
            <button type="button" onClick={closeProject} className="rounded-full px-4 py-2 text-sm font-semibold text-[#3d7f14] hover:bg-[#eef4ec]">Close</button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className={`hidden w-[340px] shrink-0 overflow-y-auto border-r p-6 lg:block ${darkMode ? "border-white/10 bg-[#111318]" : "border-black/[0.08] bg-white"}`}>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-pink-100 px-3 py-2 text-xs font-bold uppercase text-pink-700">Project</span>
              <span className={`rounded-md px-3 py-2 text-xs font-bold uppercase ${healthClass(selectedProject.health, darkMode)}`}>{selectedProject.health || "Green"}</span>
            </div>
            <p className={`mt-8 text-sm ${muted}`}>Project workspace</p>
            <div className="mt-5 flex items-center gap-5">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[32px] bg-[#14aa6d] text-4xl font-bold text-white">
                {(selectedProject.name || "P").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-semibold">{selectedProject.name}</h2>
                <p className={`mt-1 truncate text-lg ${muted}`}>{selectedProject.client || selectedProject.location || "Project"}</p>
              </div>
            </div>
            <p className={`mt-8 text-lg leading-8 ${muted}`}>{selectedProject.description || "Manage phases, tasks, deadlines, people, and project documents in one workspace."}</p>
            {isSuperAdmin && (
              <button type="button" onClick={() => openEditor(selectedProject)} className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#7bea2a] text-lg font-semibold text-black shadow-[0_14px_34px_rgba(123,234,42,0.25)]">
                <Pencil className="h-5 w-5" /> Edit project
              </button>
            )}
            <div className={`mt-8 rounded-[18px] p-5 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f4f1]"}`}>
              <p className={`text-sm ${muted}`}>Progress</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="text-4xl font-semibold">{progress}%</p>
                <p className={`pb-1 text-sm ${muted}`}>{doneTasks}/{totalTasks || 0} tasks done</p>
              </div>
              <div className={`mt-4 h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>
                <div className="h-full rounded-full bg-[#7bea2a]" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
            </div>
            <div className="mt-8">
              <h3 className="text-xl font-semibold">Project Details</h3>
              <div className="mt-4 space-y-4">
                {[
                  [UserRound, "Manager", selectedProject.manager || "Not assigned"],
                  [CalendarDays, "Target", formatDate(selectedProject.targetDate)],
                  [Flag, "Priority", selectedProject.priority || "Medium"],
                  [ShieldCheck, "Health", selectedProject.health || "Green"],
                  [Users, "Team", projectMembers.length ? projectMembers.slice(0, 3).join(", ") : "No assignees"],
                ].map(([Icon, label, value]) => (
                  <div key={label} className="flex items-center gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/8" : "bg-[#f2f2ef]"}`}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className={`block text-sm ${muted}`}>{label}</span>
                      <span className="block truncate text-base font-semibold capitalize">{value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto">
            <section className={`border-b px-5 py-6 lg:px-8 ${darkMode ? "border-white/10 bg-[#101216]" : "border-black/[0.06] bg-white"}`}>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xl">
                    <span>Pipeline: <strong>Project Work</strong></span>
                    <span className={muted}>| Stage:</span>
                    <strong>{blockedTasks ? "Attention" : progress === 100 ? "Complete" : "Active"}</strong>
                  </div>
                  <div className="mt-6 overflow-hidden rounded-full">
                    <div className={`grid h-11 ${stageItems.length <= 1 ? "grid-cols-1" : stageItems.length === 2 ? "grid-cols-2" : stageItems.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                      {(stageItems.length ? stageItems : [{ id: "default", name: "Planning" }]).map((phase, index) => {
                        const phaseTasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                        const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                        const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : index === 0 ? progress : 0;
                        return (
                          <button key={phase.id || phase.name} type="button" onClick={() => setDetailTab("phases")} className={`min-w-0 px-3 text-sm font-semibold ${phaseProgress === 100 ? "bg-[#8edbd6]" : phaseProgress > 0 ? "bg-[#a1e4df]" : darkMode ? "bg-white/8" : "bg-[#e8e7e2]"}`}>
                            <span className="block truncate">{phase.name || `Phase ${index + 1}`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500"><AlertTriangle className="h-5 w-5" /></span>
                      <div>
                        <p className={`text-sm ${muted}`}>Current status</p>
                        <p className="text-lg font-semibold">{blockedTasks ? "Needs attention" : "On track"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-white/8" : "bg-[#f2f2ef]"}`}><Clock3 className="h-5 w-5" /></span>
                      <div>
                        <p className={`text-sm ${muted}`}>Target date</p>
                        <p className="text-lg font-semibold">{formatDate(selectedProject.targetDate)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className={`text-sm ${muted}`}>{progress}% complete</p>
              </div>
            </section>

            <nav className={`sticky top-0 z-20 flex gap-7 border-b px-5 lg:px-8 ${darkMode ? "border-white/10 bg-[#101216]" : "border-black/[0.06] bg-white"}`}>
              {tabItems.map((tab) => (
                <button key={tab.value} type="button" onClick={() => setDetailTab(tab.value)} className={`flex items-center gap-2 border-b-2 py-4 text-sm font-semibold transition ${detailTab === tab.value ? "border-[#4b9b16] text-[#4b9b16]" : "border-transparent text-black/60 hover:text-black"}`}>
                  {tab.label}
                  {typeof tab.count === "number" && <span className={`rounded-full px-2 py-0.5 text-xs ${detailTab === tab.value ? "bg-[#4b9b16]/10" : darkMode ? "bg-white/8" : "bg-black/[0.05]"}`}>{tab.count}</span>}
                </button>
              ))}
            </nav>

            <div className="space-y-6 p-5 lg:p-8">
              {detailTab === "board" && (
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <section>
                    <h3 className="text-2xl font-semibold">Latest Activity</h3>
                    <div className="mt-5 space-y-5">
                      {(latestTasks.length ? latestTasks : selectedTasks.slice(0, 4)).map((task, index) => (
                        <button key={task.id || index} type="button" onClick={() => openTaskDetail(task)} className="flex w-full items-start justify-between gap-4 text-left">
                          <span className="flex min-w-0 items-start gap-4">
                            <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${task.status === "done" ? "bg-[#7bea2a] text-black" : task.status === "blocked" ? "bg-red-100 text-red-600" : "bg-[#8edbd6] text-black"}`}>
                              {task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-lg font-semibold">{task.title || "Untitled task"}</span>
                              <span className={`mt-1 block text-sm ${muted}`}>{task.description || `${statusLabel(task.status)} in ${phaseMap.get(task.phaseId)?.name || "project"}.`}</span>
                            </span>
                          </span>
                          <span className={`shrink-0 text-sm ${muted}`}>{formatDate(task.dueDate)}</span>
                        </button>
                      ))}
                      {!selectedTasks.length && <p className={`rounded-2xl border border-dashed p-10 text-center text-sm ${muted}`}>No task activity yet. Add a task to start the project timeline.</p>}
                    </div>
                  </section>
                  <section className={`rounded-[18px] border ${panel}`}>
                    <div className={`border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Project schedule</p>
                      <h3 className="mt-2 text-xl font-semibold">Milestone overview</h3>
                    </div>
                    <div className="divide-y divide-black/[0.06]">
                      {editablePhases.map((phase, index) => {
                        const phaseTasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                        const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                        const phaseProgress = phaseTasks.length ? Math.round((phaseDone / phaseTasks.length) * 100) : 0;
                        return (
                          <button key={phase.id || index} type="button" onClick={() => setDetailTab("phases")} className="grid w-full grid-cols-[120px_minmax(0,1fr)] text-left">
                            <span className={`px-5 py-5 ${darkMode ? "bg-white/[0.03]" : "bg-[#f6f6f2]"}`}>
                              <span className="block text-sm font-semibold text-[#4b9b16]">Phase {index + 1}</span>
                              <span className="mt-1 block text-lg font-semibold">{formatDate(phase.dueDate)}</span>
                            </span>
                            <span className="min-w-0 px-5 py-5">
                              <span className="block truncate text-lg font-semibold">{phase.name || "Untitled phase"}</span>
                              <span className={`mt-1 block text-sm ${muted}`}>{phaseTasks.length} tasks · {phaseProgress}% complete</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}

              {detailTab === "table" && (
                <section className={`overflow-hidden rounded-[18px] border ${panel}`}>
                  <div className="flex items-center justify-between gap-4 px-5 py-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Tasks</p>
                      <h3 className="text-2xl font-semibold">Project task register</h3>
                    </div>
                    {isSuperAdmin && <button type="button" onClick={() => quickAddTask(selectedProject)} className="rounded-full bg-[#171714] px-5 py-3 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4" /> Add task</button>}
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[1020px]">
                      <div className={`grid grid-cols-[minmax(260px,1.5fr)_170px_220px_140px_130px_140px_80px] gap-4 border-y px-5 py-4 text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? "border-white/10 text-white/40" : "border-black/[0.06] bg-[#f7f8f5] text-black/45"}`}>
                        <span>Task</span><span>Phase</span><span>People</span><span>Status</span><span>Priority</span><span>Deadline</span><span>Action</span>
                      </div>
                      {newTaskDraft && (
                        <div className={`grid grid-cols-[minmax(260px,1.5fr)_170px_220px_140px_130px_140px_80px] gap-4 border-b px-5 py-4 ${darkMode ? "border-white/8 bg-emerald-400/5" : "border-black/[0.05] bg-emerald-50/70"}`}>
                          <div className="space-y-2">
                            <TextInput darkMode={darkMode} value={newTaskDraft.title} onChange={(value) => setNewTaskDraft((current) => ({ ...current, title: value }))} placeholder="Task title" />
                            <TextInput darkMode={darkMode} value={newTaskDraft.description} onChange={(value) => setNewTaskDraft((current) => ({ ...current, description: value }))} placeholder="Short description / output" />
                          </div>
                          <SelectMenu darkMode={darkMode} value={newTaskDraft.phaseId} onChange={(value) => setNewTaskDraft((current) => ({ ...current, phaseId: value }))} options={newTaskPhaseOptions} />
                          <UserPicker darkMode={darkMode} users={users} selectedIds={newTaskDraft.assigneeIds || []} onChange={(ids) => setNewTaskDraft((current) => ({ ...current, assigneeIds: ids }))} />
                          <SelectMenu darkMode={darkMode} value={newTaskDraft.status} onChange={(value) => setNewTaskDraft((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
                          <SelectMenu darkMode={darkMode} value={newTaskDraft.priority} onChange={(value) => setNewTaskDraft((current) => ({ ...current, priority: value }))} options={PRIORITY_OPTIONS} />
                          <TextInput darkMode={darkMode} type="date" value={newTaskDraft.dueDate} onChange={(value) => setNewTaskDraft((current) => ({ ...current, dueDate: value }))} />
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => saveNewTask(selectedProject)} className="rounded-full bg-[#7bea2a] px-4 py-2 text-xs font-semibold text-black">Save</button>
                            <button type="button" onClick={() => setNewTaskDraft(null)} className={`rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-black/[0.04] text-black/60"}`}>Cancel</button>
                          </div>
                        </div>
                      )}
                      {STATUS_OPTIONS.map((status) => {
                        const items = selectedTasks.filter((task) => (task.status || "todo") === status.value);
                        return (
                          <div key={status.value}>
                            <div className={`flex items-center justify-between px-5 py-3 text-sm font-semibold ${darkMode ? "bg-white/[0.025]" : "bg-[#fbfbf8]"}`}>
                              <span>{status.label}</span>
                              <span className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8" : "bg-black/[0.05]"}`}>{items.length}</span>
                            </div>
                            {items.map((task) => {
                              const assignees = (task.assigneeIds || []).map((id) => users.find((item) => item.id === id)?.displayName || id).filter(Boolean);
                              return (
                                <button type="button" onClick={() => openTaskDetail(task)} key={task.id} className={`grid w-full grid-cols-[minmax(260px,1.5fr)_170px_220px_140px_130px_140px_80px] items-center gap-4 border-t px-5 py-4 text-left text-sm transition ${darkMode ? "border-white/8 hover:bg-white/[0.035]" : "border-black/[0.05] hover:bg-[#f7fbff]"}`}>
                                  <span className="min-w-0"><span className="block truncate font-semibold">{task.title || "Untitled task"}</span><span className={`mt-1 block truncate text-xs ${muted}`}>{task.description || "No description"}</span></span>
                                  <span className={muted}>{phaseMap.get(task.phaseId)?.name || task.phaseName || "-"}</span>
                                  <span className="flex min-w-0 flex-wrap gap-1.5">{assignees.length ? assignees.slice(0, 2).map((name) => <span key={name} className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8 text-white/65" : "bg-[#eef4ec] text-black/60"}`}>{name}</span>) : <span className={muted}>Unassigned</span>}</span>
                                  <span>{statusLabel(task.status)}</span>
                                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(task.priority, darkMode)}`}>{task.priority || "medium"}</span>
                                  <span>{formatDate(task.dueDate)}</span>
                                  <span className="font-semibold text-emerald-600">Open</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                      {!selectedTasks.length && !newTaskDraft && <p className={`p-10 text-center text-sm ${muted}`}>No tasks added yet. Use Add task to create the first row.</p>}
                    </div>
                  </div>
                </section>
              )}

              {detailTab === "phases" && (
                <div className="space-y-5">
                  {isSuperAdmin && <button type="button" onClick={quickAddPhase} className="rounded-full bg-[#171714] px-5 py-3 text-sm font-semibold text-white"><Layers3 className="mr-2 inline h-4 w-4" /> Add phase</button>}
                  {phaseDraft && (
                    <article className={`rounded-[18px] border p-5 ${darkMode ? "border-emerald-400/30 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50/70"}`}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">New phase</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Field label="Phase name"><TextInput darkMode={darkMode} value={phaseDraft.name} onChange={(value) => setPhaseDraft((current) => ({ ...current, name: value }))} placeholder="e.g. Design approval" /></Field>
                        <Field label="Due date"><TextInput darkMode={darkMode} type="date" value={phaseDraft.dueDate} onChange={(value) => setPhaseDraft((current) => ({ ...current, dueDate: value }))} /></Field>
                        <div className="md:col-span-2"><Field label="Description"><TextArea darkMode={darkMode} value={phaseDraft.description} onChange={(value) => setPhaseDraft((current) => ({ ...current, description: value }))} placeholder="What this phase must complete..." rows={3} /></Field></div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => saveNewPhase(selectedProject)} className="rounded-full bg-[#7bea2a] px-5 py-2.5 text-sm font-semibold text-black">Save phase</button>
                        <button type="button" onClick={() => setPhaseDraft(null)} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-white text-black/60"}`}>Cancel</button>
                      </div>
                    </article>
                  )}
                  {editablePhases.map((phase, index) => {
                    const tasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                    const done = tasks.filter((task) => task.status === "done").length;
                    const phaseProgress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
                    return (
                      <article key={phase.id || index} className={`grid overflow-hidden rounded-[18px] border ${panel} md:grid-cols-[220px_minmax(0,1fr)]`}>
                        <div className={`p-6 ${darkMode ? "bg-white/[0.03]" : "bg-[#f6f6f2]"}`}>
                          <p className="text-sm font-semibold text-[#4b9b16]">Phase {index + 1}</p>
                          <h4 className="mt-3 text-2xl font-semibold">{phase.name || "Untitled phase"}</h4>
                          <p className={`mt-2 text-sm ${muted}`}>{formatDate(phase.dueDate)}</p>
                        </div>
                        <div className="p-6">
                          <div className="flex items-center justify-between gap-4">
                            <p className={`text-sm ${muted}`}>{phase.description || "No description added."}</p>
                            <span className="text-lg font-semibold">{phaseProgress}%</span>
                          </div>
                          <div className={`mt-4 h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className="h-full rounded-full bg-[#7bea2a]" style={{ width: `${phaseProgress}%` }} /></div>
                          {isSuperAdmin && <button type="button" onClick={() => quickAddTask(selectedProject, phase.id)} className="mt-5 rounded-full bg-[#171714] px-4 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add task</button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {detailTab === "documents" && (
                <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                  <section className={`rounded-[18px] border p-6 ${panel}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Google Drive</p>
                    <h4 className="mt-1 text-2xl font-semibold">Project documents</h4>
                    <p className={`mt-2 text-sm leading-6 ${muted}`}>Files are read from the linked Drive folder. Uploads go into that same folder when it is shared with the service account.</p>
                    {selectedProject.driveFolderId || selectedProject.driveFolderLink ? (
                      <a href={selectedProject.driveFolderLink || `https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Open Drive folder <ArrowUpRight className="h-4 w-4" /></a>
                    ) : (
                      <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700">Add a Google Drive folder link in project settings to enable Drive sync and uploads.</p>
                    )}
                    {isSuperAdmin && (
                      <div className="mt-6 space-y-3">
                        <Field label="Category"><SelectMenu darkMode={darkMode} value={docForm.category} onChange={(value) => setDocForm((current) => ({ ...current, category: value }))} options={DOC_CATEGORIES} /></Field>
                        <Field label="Document name"><TextInput darkMode={darkMode} value={docForm.name} onChange={(value) => setDocForm((current) => ({ ...current, name: value }))} placeholder="e.g. Approved drawing" /></Field>
                        <Field label="Drive/document link"><TextInput darkMode={darkMode} value={docForm.url} onChange={(value) => setDocForm((current) => ({ ...current, url: value }))} placeholder="https://drive.google.com/..." /></Field>
                        <button type="button" onClick={addDocumentLink} className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sm font-semibold text-black"><LinkIcon className="h-4 w-4" /> Add link</button>
                        <label className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold ${selectedProject.driveFolderId || selectedProject.driveFolderLink ? "bg-[#7bea2a] text-black" : "bg-black/5 text-black/35"}`}>
                          {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload to Drive
                          <input type="file" disabled={uploadingDoc || !(selectedProject.driveFolderId || selectedProject.driveFolderLink)} onChange={uploadProjectDocument} className="hidden" />
                        </label>
                      </div>
                    )}
                  </section>
                  <section className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {docs.map((doc) => (
                      <a key={doc.driveFileId || doc.url || doc.id} href={doc.url} target="_blank" rel="noreferrer" className={`rounded-[18px] border p-4 transition hover:-translate-y-0.5 ${panel}`}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><FileText className="h-5 w-5" /></span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{doc.name}</p>
                            <p className={`mt-1 text-xs ${muted}`}>{doc.category || doc.source || "Document"} · {doc.uploadedAt ? formatDate(String(doc.uploadedAt).slice(0, 10)) : "Drive"}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                    {!docs.length && <p className={`rounded-[18px] border border-dashed p-10 text-center text-sm ${muted}`}>No project documents found yet.</p>}
                  </section>
                </div>
              )}
            </div>
          </main>
        </div>

        {taskDetail && (
          <div className="fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-sm">
            <aside className={`flex h-full w-full max-w-[620px] flex-col overflow-hidden border-l shadow-2xl ${darkMode ? "border-white/10 bg-[#111318] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
              <header className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                <div className="flex items-center gap-3 text-sm">
                  <button type="button" className={`rounded-full px-3 py-2 ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>Share</button>
                  <button type="button" className={`rounded-full px-3 py-2 ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>Expand</button>
                </div>
                <button type="button" onClick={() => setTaskDetail(null)} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.05]"}`}>
                  <X className="h-5 w-5" />
                </button>
              </header>
              <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <p className={`flex items-center gap-2 text-xs ${muted}`}><CalendarDays className="h-4 w-4" /> {phaseMap.get(taskDetail.phaseId)?.name || "Project task"}</p>
                <input value={taskDetail.title || ""} onChange={(event) => setTaskDetail((current) => ({ ...current, title: event.target.value }))} className={`mt-3 w-full rounded-2xl border-0 bg-transparent text-3xl font-semibold leading-tight outline-none ${darkMode ? "placeholder:text-white/25" : "placeholder:text-black/25"}`} placeholder="Task title" />
                <div className="mt-5 flex flex-wrap gap-2">
                  <SelectMenu darkMode={darkMode} value={taskDetail.priority || "medium"} onChange={(value) => setTaskDetail((current) => ({ ...current, priority: value }))} options={PRIORITY_OPTIONS} />
                  <SelectMenu darkMode={darkMode} value={taskDetail.status || "todo"} onChange={(value) => setTaskDetail((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
                  <TextInput darkMode={darkMode} type="date" value={taskDetail.dueDate} onChange={(value) => setTaskDetail((current) => ({ ...current, dueDate: value }))} />
                </div>
                <div className={`mt-6 flex items-center justify-between rounded-2xl px-4 py-4 ${darkMode ? "bg-violet-400/12" : "bg-gradient-to-r from-violet-100 to-pink-100"}`}>
                  <span className="flex items-center gap-3 text-sm font-semibold"><Clock3 className="h-5 w-5" /> Time spent on this project</span>
                  <span className="text-lg font-semibold">00:00:00</span>
                </div>
                <section className="mt-7">
                  <h4 className="text-sm font-semibold">Description</h4>
                  <TextArea darkMode={darkMode} value={taskDetail.description} onChange={(value) => setTaskDetail((current) => ({ ...current, description: value }))} placeholder="Write expected output, blockers, and completion notes..." rows={5} />
                </section>
                <section className="mt-7 grid gap-4 sm:grid-cols-2">
                  <Field label="Phase"><SelectMenu darkMode={darkMode} value={taskDetail.phaseId} onChange={(value) => setTaskDetail((current) => ({ ...current, phaseId: value }))} options={newTaskPhaseOptions} /></Field>
                  <Field label="People"><UserPicker darkMode={darkMode} users={users} selectedIds={taskDetail.assigneeIds || []} onChange={(ids) => setTaskDetail((current) => ({ ...current, assigneeIds: ids }))} /></Field>
                </section>
              </main>
              <footer className={`flex justify-between gap-3 border-t px-6 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                <button type="button" onClick={() => deleteInlineTask(selectedProject, taskDetail.id)} className="rounded-full bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-500">Delete task</button>
                <button type="button" onClick={() => saveTaskDetail(selectedProject)} className="rounded-full bg-[#7bea2a] px-6 py-3 text-sm font-semibold text-black">Save task</button>
              </footer>
            </aside>
          </div>
        )}
      </div>
    );
    return projectDetailView;
    return (
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#eef3f8] text-[#171714]"}`}>
        <div className={`sticky top-0 z-20 border-b px-4 py-3 sm:px-6 lg:px-8 ${darkMode ? "border-white/10 bg-[#0c0d10]/95" : "border-black/[0.06] bg-[#eef3f8]/95"} backdrop-blur`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setSelected(null)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold">{selectedProject.name}</h2>
                <p className={`truncate text-sm ${muted}`}>{selectedProject.client || selectedProject.location || "Project workspace"} · {progress}% complete</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {["board", "table", "phases", "documents"].map((tab) => (
                <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={`rounded-full px-5 py-3 text-sm font-semibold capitalize transition ${detailTab === tab ? "bg-[#171714] text-white shadow-sm" : darkMode ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-white text-black/60 hover:bg-black/[0.04]"}`}>{tab}</button>
              ))}
              {isSuperAdmin && (
                <>
                  <button type="button" onClick={() => quickAddTask(selectedProject)} className="rounded-full bg-[#171714] px-5 py-3 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" /> Add task</button>
                  <button type="button" onClick={quickAddPhase} className={`rounded-full border px-5 py-3 text-sm font-semibold ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`}><Layers3 className="mr-1 inline h-4 w-4" /> Add phase</button>
                  <button type="button" onClick={() => { setSelected(null); openEditor(selectedProject); }} className="rounded-full bg-[#7bea2a] px-5 py-3 text-sm font-semibold text-black">Edit project</button>
                  <button type="button" onClick={() => deleteProject(selectedProject)} className="rounded-full px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/10">Delete</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr_1fr]">
            <section className={`rounded-[32px] border p-5 ${panel}`}>
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Project Pulse</p>
                  <h3 className="mt-2 text-2xl font-semibold">{selectedProject.name}</h3>
                  <p className={`mt-1 text-sm ${muted}`}>{selectedProject.manager || "No manager"} · Target {formatDate(selectedProject.targetDate)}</p>
                </div>
                <div className="relative h-28 w-28 shrink-0">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="42" fill="none" stroke={darkMode ? "rgba(255,255,255,.08)" : "#e7edf2"} strokeWidth="13" />
                    <circle cx="55" cy="55" r="42" fill="none" stroke="#6f4af6" strokeWidth="13" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold">{progress}%</span>
                    <span className={`text-[10px] uppercase tracking-[0.12em] ${muted}`}>done</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={`rounded-[32px] border p-5 ${panel}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">Status Mix</p>
              <div className="mt-5 space-y-4">
                {statusCounts.map((item) => {
                  const width = totalTasks ? Math.max(8, Math.round((item.value / totalTasks) * 100)) : 0;
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><span className={muted}>{item.value}</span></div>
                      <div className={`h-2.5 rounded-full ${darkMode ? "bg-white/10" : "bg-slate-100"}`}>
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-[32px] border p-5 ${panel}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">Priority</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {priorityCounts.map((item) => (
                  <div key={item.value} className={`rounded-2xl p-3 ${priorityClass(item.value, darkMode)}`}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{item.count}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={`rounded-[32px] border p-5 ${panel}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">Readiness</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#f8fbff]"}`}>
                  <p className={`text-xs ${muted}`}>Health</p>
                  <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${healthClass(selectedProject.health, darkMode)}`}>{selectedProject.health || "green"}</p>
                </div>
                <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fff8ed]"}`}>
                  <p className={`text-xs ${muted}`}>Documents</p>
                  <p className="mt-2 text-2xl font-semibold">{docs.length || selectedProject.metrics?.documents || 0}</p>
                </div>
                <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fff3f4]"}`}>
                  <p className={`text-xs ${muted}`}>Blocked</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-500">{blockedTasks}</p>
                </div>
                <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#f5fff5]"}`}>
                  <p className={`text-xs ${muted}`}>Phases</p>
                  <p className="mt-2 text-2xl font-semibold">{editablePhases.length}</p>
                </div>
              </div>
            </section>
          </div>

          {detailTab === "board" && (
            <div className="grid gap-4 xl:grid-cols-4">
              {STATUS_OPTIONS.map((status) => {
                const items = selectedTasks.filter((task) => (task.status || "todo") === status.value);
                return (
                  <div key={status.value} className={`min-h-[420px] rounded-[28px] border p-4 ${panel}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{status.label}</h4>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>{items.length}</span>
                    </div>
                    <div className="space-y-3">{items.map(renderTaskCard)}</div>
                    {!items.length && <p className={`rounded-2xl border border-dashed p-8 text-center text-sm ${muted}`}>No tasks here.</p>}
                  </div>
                );
              })}
            </div>
          )}

          {detailTab === "table" && (
            <div className={`rounded-[28px] border ${panel}`}>
              <div className={`grid grid-cols-[minmax(260px,1.5fr)_180px_220px_150px_130px_145px_96px] gap-3 border-b px-5 py-4 text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? "border-white/10 text-white/40" : "border-black/[0.06] text-black/40"}`}>
                <span>Task</span><span>Phase</span><span>People</span><span>Status</span><span>Priority</span><span>Deadline</span><span>Action</span>
              </div>

              {newTaskDraft && (
                <div className={`grid grid-cols-[minmax(260px,1.5fr)_180px_220px_150px_130px_145px_96px] gap-3 border-b px-5 py-4 ${darkMode ? "border-white/8 bg-emerald-400/5" : "border-black/[0.05] bg-emerald-50/70"}`}>
                  <div className="space-y-2">
                    <TextInput darkMode={darkMode} value={newTaskDraft.title} onChange={(value) => setNewTaskDraft((current) => ({ ...current, title: value }))} placeholder="Task title" />
                    <TextInput darkMode={darkMode} value={newTaskDraft.description} onChange={(value) => setNewTaskDraft((current) => ({ ...current, description: value }))} placeholder="Short description / output" />
                  </div>
                  <SelectMenu darkMode={darkMode} value={newTaskDraft.phaseId} onChange={(value) => setNewTaskDraft((current) => ({ ...current, phaseId: value }))} options={newTaskPhaseOptions} />
                  <UserPicker darkMode={darkMode} users={users} selectedIds={newTaskDraft.assigneeIds || []} onChange={(ids) => setNewTaskDraft((current) => ({ ...current, assigneeIds: ids }))} />
                  <SelectMenu darkMode={darkMode} value={newTaskDraft.status} onChange={(value) => setNewTaskDraft((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
                  <SelectMenu darkMode={darkMode} value={newTaskDraft.priority} onChange={(value) => setNewTaskDraft((current) => ({ ...current, priority: value }))} options={PRIORITY_OPTIONS} />
                  <TextInput darkMode={darkMode} type="date" value={newTaskDraft.dueDate} onChange={(value) => setNewTaskDraft((current) => ({ ...current, dueDate: value }))} />
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => saveNewTask(selectedProject)} className="rounded-full bg-[#7bea2a] px-4 py-2 text-xs font-semibold text-black">Save</button>
                    <button type="button" onClick={() => setNewTaskDraft(null)} className={`rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-black/[0.04] text-black/60"}`}>Cancel</button>
                  </div>
                </div>
              )}

              {selectedTasks.map((task) => {
                const assignees = (task.assigneeIds || []).map((id) => users.find((item) => item.id === id)?.displayName || id).filter(Boolean);
                return (
                  <button type="button" onClick={() => openTaskDetail(task)} key={task.id} className={`grid w-full grid-cols-[minmax(260px,1.5fr)_180px_220px_150px_130px_145px_96px] items-center gap-3 border-b px-5 py-4 text-left text-sm transition last:border-b-0 ${darkMode ? "border-white/8 hover:bg-white/[0.035]" : "border-black/[0.05] hover:bg-[#f7fbff]"}`}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{task.title || "Untitled task"}</p>
                      <p className={`mt-1 truncate text-xs ${muted}`}>{task.description || "No description added"}</p>
                    </div>
                    <span className={muted}>{phaseMap.get(task.phaseId)?.name || task.phaseName || "-"}</span>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {assignees.length ? assignees.slice(0, 2).map((name) => <span key={name} className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8 text-white/65" : "bg-[#eef4ec] text-black/60"}`}>{name}</span>) : <span className={muted}>Unassigned</span>}
                      {assignees.length > 2 && <span className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8 text-white/65" : "bg-black/[0.04] text-black/45"}`}>+{assignees.length - 2}</span>}
                    </div>
                    <span>{statusLabel(task.status)}</span>
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(task.priority, darkMode)}`}>{task.priority || "medium"}</span>
                    <span>{formatDate(task.dueDate)}</span>
                    <span className="font-semibold text-emerald-600">Open</span>
                  </button>
                );
              })}
              {!selectedTasks.length && !newTaskDraft && <p className={`p-10 text-center text-sm ${muted}`}>No tasks added yet. Use Add task to create the first row.</p>}
            </div>
          )}

          {detailTab === "phases" && (
            <div className="grid gap-4 xl:grid-cols-2">
              {phaseDraft && (
                <article className={`rounded-[28px] border p-5 ${darkMode ? "border-emerald-400/30 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50/70"}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">New phase</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field label="Phase name"><TextInput darkMode={darkMode} value={phaseDraft.name} onChange={(value) => setPhaseDraft((current) => ({ ...current, name: value }))} placeholder="e.g. Design approval" /></Field>
                    <Field label="Due date"><TextInput darkMode={darkMode} type="date" value={phaseDraft.dueDate} onChange={(value) => setPhaseDraft((current) => ({ ...current, dueDate: value }))} /></Field>
                    <div className="md:col-span-2"><Field label="Description"><TextArea darkMode={darkMode} value={phaseDraft.description} onChange={(value) => setPhaseDraft((current) => ({ ...current, description: value }))} placeholder="What this phase must complete..." rows={3} /></Field></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => saveNewPhase(selectedProject)} className="rounded-full bg-[#7bea2a] px-5 py-2.5 text-sm font-semibold text-black">Save phase</button>
                    <button type="button" onClick={() => setPhaseDraft(null)} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${darkMode ? "bg-white/8 text-white/70" : "bg-white text-black/60"}`}>Cancel</button>
                  </div>
                </article>
              )}
              {(selectedProject.phases || []).map((phase, index) => {
                const tasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                const done = tasks.filter((task) => task.status === "done").length;
                const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
                return (
                  <article key={phase.id} className={`rounded-[28px] border p-5 ${panel}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Phase {index + 1}</p>
                        <h4 className="mt-1 text-xl font-semibold">{phase.name}</h4>
                        <p className={`mt-1 text-sm ${muted}`}>{phase.description || "No description added."}</p>
                      </div>
                      <div className="min-w-[220px]">
                        <div className="mb-2 flex justify-between text-xs"><span>{tasks.length} tasks</span><span>{progress}%</span></div>
                        <div className={`h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                        {isSuperAdmin && <button type="button" onClick={() => quickAddTask(selectedProject, phase.id)} className="mt-4 rounded-full bg-[#171714] px-4 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add task</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {detailTab === "documents" && (
            <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <section className={`rounded-[28px] border p-5 ${panel}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Google Drive</p>
                <h4 className="mt-1 text-xl font-semibold">Project documents</h4>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>Files are read from the linked Drive folder. Uploads go into that same folder when it is shared with the service account.</p>
                {selectedProject.driveFolderId || selectedProject.driveFolderLink ? (
                  <a href={selectedProject.driveFolderLink || `https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                    Open Drive folder <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : (
                  <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700">Add a Google Drive folder link in project settings to enable Drive sync and uploads.</p>
                )}
                {isSuperAdmin && (
                  <div className="mt-6 space-y-3">
                    <Field label="Category"><SelectMenu darkMode={darkMode} value={docForm.category} onChange={(value) => setDocForm((current) => ({ ...current, category: value }))} options={DOC_CATEGORIES} /></Field>
                    <Field label="Document name"><TextInput darkMode={darkMode} value={docForm.name} onChange={(value) => setDocForm((current) => ({ ...current, name: value }))} placeholder="e.g. Approved drawing" /></Field>
                    <Field label="Drive/document link"><TextInput darkMode={darkMode} value={docForm.url} onChange={(value) => setDocForm((current) => ({ ...current, url: value }))} placeholder="https://drive.google.com/..." /></Field>
                    <button type="button" onClick={addDocumentLink} className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sm font-semibold text-black"><LinkIcon className="h-4 w-4" /> Add link</button>
                    <label className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold ${selectedProject.driveFolderId || selectedProject.driveFolderLink ? "bg-[#7bea2a] text-black" : "bg-black/5 text-black/35"}`}>
                      {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload to Drive
                      <input type="file" disabled={uploadingDoc || !(selectedProject.driveFolderId || selectedProject.driveFolderLink)} onChange={uploadProjectDocument} className="hidden" />
                    </label>
                  </div>
                )}
              </section>
              <section className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {docs.map((doc) => (
                  <a key={doc.driveFileId || doc.url || doc.id} href={doc.url} target="_blank" rel="noreferrer" className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${panel}`}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><FileText className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{doc.name}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{doc.category || doc.source || "Document"} · {doc.uploadedAt ? formatDate(String(doc.uploadedAt).slice(0, 10)) : "Drive"}</p>
                      </div>
                    </div>
                  </a>
                ))}
                {!docs.length && <p className={`rounded-[24px] border border-dashed p-10 text-center text-sm ${muted}`}>No project documents found yet.</p>}
              </section>
            </div>
          )}
        </div>
        {taskDetail && (
          <div className="fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-sm">
            <aside className={`flex h-full w-full max-w-[620px] flex-col overflow-hidden border-l shadow-2xl ${darkMode ? "border-white/10 bg-[#111318] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
              <header className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                <div className="flex items-center gap-3 text-sm">
                  <button type="button" className={`rounded-full px-3 py-2 ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>Share</button>
                  <button type="button" className={`rounded-full px-3 py-2 ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>Expand</button>
                </div>
                <button type="button" onClick={() => setTaskDetail(null)} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.05]"}`}>
                  <X className="h-5 w-5" />
                </button>
              </header>

              <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <p className={`flex items-center gap-2 text-xs ${muted}`}><CalendarDays className="h-4 w-4" /> {phaseMap.get(taskDetail.phaseId)?.name || "Project task"}</p>
                <input
                  value={taskDetail.title || ""}
                  onChange={(event) => setTaskDetail((current) => ({ ...current, title: event.target.value }))}
                  className={`mt-3 w-full rounded-2xl border-0 bg-transparent text-3xl font-semibold leading-tight outline-none ${darkMode ? "placeholder:text-white/25" : "placeholder:text-black/25"}`}
                  placeholder="Task title"
                />

                <div className="mt-5 flex flex-wrap gap-2">
                  <SelectMenu darkMode={darkMode} value={taskDetail.priority || "medium"} onChange={(value) => setTaskDetail((current) => ({ ...current, priority: value }))} options={PRIORITY_OPTIONS} />
                  <SelectMenu darkMode={darkMode} value={taskDetail.status || "todo"} onChange={(value) => setTaskDetail((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
                  <TextInput darkMode={darkMode} type="date" value={taskDetail.dueDate} onChange={(value) => setTaskDetail((current) => ({ ...current, dueDate: value }))} />
                </div>

                <div className={`mt-6 flex items-center justify-between rounded-2xl px-4 py-4 ${darkMode ? "bg-violet-400/12" : "bg-gradient-to-r from-violet-100 to-pink-100"}`}>
                  <span className="flex items-center gap-3 text-sm font-semibold"><Clock3 className="h-5 w-5" /> Time spent on this project</span>
                  <span className="text-lg font-semibold">00:00:00</span>
                </div>

                <section className="mt-7">
                  <h4 className="text-sm font-semibold">Description</h4>
                  <TextArea darkMode={darkMode} value={taskDetail.description} onChange={(value) => setTaskDetail((current) => ({ ...current, description: value }))} placeholder="Write expected output, blockers, and completion notes..." rows={5} />
                </section>

                <section className="mt-7 grid gap-4 sm:grid-cols-2">
                  <Field label="Phase">
                    <SelectMenu darkMode={darkMode} value={taskDetail.phaseId} onChange={(value) => setTaskDetail((current) => ({ ...current, phaseId: value }))} options={newTaskPhaseOptions} />
                  </Field>
                  <Field label="People">
                    <UserPicker darkMode={darkMode} users={users} selectedIds={taskDetail.assigneeIds || []} onChange={(ids) => setTaskDetail((current) => ({ ...current, assigneeIds: ids }))} />
                  </Field>
                </section>

                <section className="mt-8">
                  <h4 className="text-sm font-semibold">Attachments</h4>
                  <div className="mt-3 space-y-3">
                    {docs.slice(0, 3).map((doc, index) => (
                      <a key={doc.driveFileId || doc.url || doc.id || index} href={doc.url} target="_blank" rel="noreferrer" className={`flex items-center justify-between rounded-2xl p-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f8fa]"}`}>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${index % 2 ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700"}`}><FileText className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{doc.name}</span>
                            <span className={`text-xs ${muted}`}>{doc.category || "Document"}</span>
                          </span>
                        </span>
                        <span className="text-xs font-semibold">View</span>
                      </a>
                    ))}
                    {!docs.length && <p className={`rounded-2xl border border-dashed p-5 text-center text-sm ${muted}`}>No attachments linked yet.</p>}
                  </div>
                </section>

                <section className="mt-8">
                  <div className="flex gap-5 border-b border-black/10 text-sm font-semibold">
                    <span className="border-b-2 border-black pb-3">Comments</span>
                    <span className={`pb-3 ${muted}`}>Updates</span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {(taskDetail.comments || []).slice(-3).map((comment, index) => (
                      <div key={comment.id || index} className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">{(comment.author || "U").slice(0, 1)}</span>
                        <div>
                          <p className="text-sm font-semibold">{comment.author || "Team"} <span className={`font-normal ${muted}`}>· {comment.date || "Just now"}</span></p>
                          <p className={`mt-1 text-sm ${muted}`}>{comment.text || comment.message}</p>
                        </div>
                      </div>
                    ))}
                    {!(taskDetail.comments || []).length && <p className={`text-sm ${muted}`}>No comments yet.</p>}
                    <input className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} placeholder="Add a comment..." />
                  </div>
                </section>
              </main>

              <footer className={`flex justify-between gap-3 border-t px-6 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                <button type="button" onClick={() => deleteInlineTask(selectedProject, taskDetail.id)} className="rounded-full bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-500">Delete task</button>
                <button type="button" onClick={() => saveTaskDetail(selectedProject)} className="rounded-full bg-[#7bea2a] px-6 py-3 text-sm font-semibold text-black">Save task</button>
              </footer>
            </aside>
          </div>
        )}
      </div>
    );
  }

  const dashboardStats = [
    ["In progress", projects.filter((project) => (project.metrics?.pending || 0) > 0).length],
    ["Blocked", projects.filter((project) => (project.metrics?.blocked || 0) > 0).length],
    ["Upcoming", projects.filter((project) => project.targetDate && project.targetDate >= today).length],
    ["Total Project", projects.length],
  ];
  const cardThemes = [
    { bg: "bg-white", bar: "bg-cyan-400", chip: "text-cyan-700 bg-cyan-50" },
    { bg: "bg-[#ffe2c2]", bar: "bg-orange-500", chip: "text-orange-700 bg-white/70" },
    { bg: "bg-[#b9f4d1]", bar: "bg-emerald-500", chip: "text-emerald-700 bg-white/70" },
    { bg: "bg-[#ffc9db]", bar: "bg-pink-500", chip: "text-pink-700 bg-white/70" },
    { bg: "bg-[#efe7ff]", bar: "bg-violet-500", chip: "text-violet-700 bg-white/70" },
    { bg: "bg-[#dff4ff]", bar: "bg-sky-500", chip: "text-sky-700 bg-white/70" },
  ];

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f3f7fb] text-[#171714]"}`}>
      <div className="mx-auto w-full max-w-[1500px]">
        <section className="mb-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">Projects</h1>
              <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/8 text-white/55" : "bg-white text-black/45"}`}>{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-8">
              {dashboardStats.map(([label, value], index) => (
                <div key={label} className="min-w-[86px]">
                  <p className="text-xl font-semibold">{value}</p>
                  <p className={`mt-1 flex items-center gap-2 text-xs ${muted}`}>{label} {index < dashboardStats.length - 1 && <span className="h-1 w-1 rounded-full bg-black/25" />}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <label className="relative block w-full sm:w-[340px]">
              <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects..." className={`h-12 w-full rounded-2xl border pl-11 pr-4 outline-none ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/10 bg-white"}`} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => load(true)} disabled={refreshing} className={`flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-medium ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </button>
              {isSuperAdmin && (
                <button type="button" onClick={() => openEditor()} className="flex h-12 items-center gap-2 rounded-full bg-[#171714] px-6 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" /> Add project
                </button>
              )}
            </div>
          </div>
        </section>

        {!projects.length ? (
          <section className={`rounded-[30px] border p-14 text-center ${panel}`}>
            <BriefcaseBusiness className={`mx-auto h-10 w-10 ${muted}`} />
            <h3 className="mt-4 text-xl font-semibold">No projects yet</h3>
            <p className={`mt-2 text-sm ${muted}`}>Add your first project, then create phases, tasks, dependencies, and linked Drive documents.</p>
          </section>
        ) : (
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {projects.map((project, index) => {
              const theme = cardThemes[index % cardThemes.length];
              const progress = project.metrics?.progress || 0;
              const due = project.targetDate ? Math.max(0, Math.ceil((new Date(`${project.targetDate}T00:00:00`) - new Date()) / 86400000)) : null;
              const assigneeIds = [...new Set((project.manualTasks || []).flatMap((task) => task.assigneeIds || []))].slice(0, 3);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => openProject(project)}
                  className={`min-h-[260px] rounded-[34px] p-5 text-left transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(33,48,80,0.14)] ${darkMode ? "bg-[#161a20]" : theme.bg}`}
                >
                  <div className="flex items-start justify-between">
                    <p className={`text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{formatDate(project.targetDate)}</p>
                    <span className="rounded-full px-2 text-xl leading-none">...</span>
                  </div>
                  <div className="mt-9 text-center">
                    <h3 className="text-xl font-semibold">{project.name}</h3>
                    <p className={`mt-1 text-sm ${darkMode ? "text-white/50" : "text-black/55"}`}>{project.client || project.location || "Project workspace"}</p>
                  </div>
                  <div className="mt-8">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/75">
                      <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <div className="flex -space-x-2">
                      {assigneeIds.map((id) => {
                        const member = users.find((item) => item.id === id);
                        return <span key={id} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[10px] font-bold text-white">{(member?.displayName || id).slice(0, 1).toUpperCase()}</span>;
                      })}
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white ${theme.chip}`}><Plus className="h-3.5 w-3.5" /></span>
                    </div>
                    <span className={`rounded-full px-4 py-2 text-xs font-semibold ${theme.chip}`}>{due === null ? "No date" : due === 0 ? "Due today" : `${due} days left`}</span>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </div>

      {selectedProject && (
        <Drawer
          darkMode={darkMode}
          title={selectedProject.name}
          subtitle={`${selectedProject.client || "Project"} · ${selectedProject.metrics?.progress || 0}% complete · ${selectedProject.metrics?.pending || 0} pending`}
          onClose={() => setSelected(null)}
          footer={
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {["board", "table", "phases", "documents"].map((tab) => (
                  <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${detailTab === tab ? "bg-[#171714] text-white" : darkMode ? "bg-white/5 text-white/60" : "bg-black/[0.04] text-black/60"}`}>{tab}</button>
                ))}
              </div>
              {isSuperAdmin && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => deleteProject(selectedProject)} className="rounded-full px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10">Delete</button>
                  <button type="button" onClick={() => openEditor(selectedProject)} className="rounded-full bg-[#7bea2a] px-5 py-2 text-sm font-semibold text-black">Edit project</button>
                </div>
              )}
            </div>
          }
        >
          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <section className={`rounded-[28px] border p-5 ${panel}`}>
                <div className="flex items-center gap-4">
                  <span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#12ad72] text-3xl font-bold text-white">{selectedProject.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4b9b16]">Project workspace</p>
                    <h3 className="mt-1 truncate text-2xl font-semibold">{selectedProject.name}</h3>
                    <p className={`mt-1 text-sm ${muted}`}>{selectedProject.location || "Location not added"}</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    ["Manager", selectedProject.manager || "Not assigned"],
                    ["Target", formatDate(selectedProject.targetDate)],
                    ["Priority", selectedProject.priority || "medium"],
                    ["Health", selectedProject.health || "green"],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-2xl p-3 ${darkMode ? "bg-white/[0.035]" : "bg-[#f5f7f3]"}`}>
                      <p className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>{label}</p>
                      <p className="mt-1 truncate text-sm font-semibold capitalize">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className={`rounded-[28px] border p-5 ${panel}`}>
                <p className="text-sm font-semibold">Deadline pulse</p>
                <div className="mt-4 space-y-3">
                  {[
                    ["Due today", selectedProject.metrics?.dueToday || 0, Clock3],
                    ["High priority", selectedProject.metrics?.highPriority || 0, ShieldAlert],
                    ["Blocked", selectedProject.metrics?.blocked || 0, AlertTriangle],
                    ["Documents", docs.length || selectedProject.metrics?.documents || 0, Paperclip],
                  ].map(([label, value, Icon]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-emerald-600" /> {label}</span>
                      <span className="text-sm font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>

            <section className="min-w-0">
              {detailTab === "board" && (
                <div className="grid gap-4 xl:grid-cols-4">
                  {STATUS_OPTIONS.map((status) => {
                    const items = selectedTasks.filter((task) => (task.status || "todo") === status.value);
                    return (
                      <div key={status.value} className={`rounded-[28px] border p-4 ${panel}`}>
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-sm font-semibold">{status.label}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/8" : "bg-black/[0.04]"}`}>{items.length}</span>
                        </div>
                        <div className="space-y-3">{items.map(renderTaskCard)}</div>
                        {!items.length && <p className={`rounded-2xl border border-dashed p-5 text-center text-xs ${muted}`}>No tasks here.</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {detailTab === "table" && (
                <div className={`overflow-hidden rounded-[28px] border ${panel}`}>
                  <div className={`grid grid-cols-[1.3fr_1fr_1fr_120px_120px_120px] gap-4 border-b px-5 py-4 text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? "border-white/10 text-white/40" : "border-black/[0.06] text-black/40"}`}>
                    <span>Task</span><span>Phase</span><span>Assignee</span><span>Status</span><span>Priority</span><span>Deadline</span>
                  </div>
                  {selectedTasks.map((task) => (
                    <div key={task.id} className={`grid grid-cols-[1.3fr_1fr_1fr_120px_120px_120px] gap-4 border-b px-5 py-4 text-sm last:border-b-0 ${darkMode ? "border-white/8" : "border-black/[0.05]"}`}>
                      <span className="font-semibold">{task.title}</span>
                      <span className={muted}>{phaseMap.get(task.phaseId)?.name || task.phaseName || "-"}</span>
                      <span className={muted}>{(task.assigneeIds || []).map((id) => users.find((item) => item.id === id)?.displayName || id).join(", ") || "-"}</span>
                      <span>{statusLabel(task.status)}</span>
                      <span className="capitalize">{task.priority}</span>
                      <span>{formatDate(task.dueDate)}</span>
                    </div>
                  ))}
                  {!selectedTasks.length && <p className={`p-10 text-center text-sm ${muted}`}>No tasks added yet.</p>}
                </div>
              )}

              {detailTab === "phases" && (
                <div className="space-y-4">
                  {(selectedProject.phases || []).map((phase, index) => {
                    const tasks = selectedTasks.filter((task) => task.phaseId === phase.id);
                    const done = tasks.filter((task) => task.status === "done").length;
                    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
                    return (
                      <article key={phase.id} className={`rounded-[28px] border p-5 ${panel}`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Phase {index + 1}</p>
                            <h4 className="mt-1 text-xl font-semibold">{phase.name}</h4>
                            <p className={`mt-1 text-sm ${muted}`}>{phase.description || "No description added."}</p>
                          </div>
                          <div className="min-w-[220px]">
                            <div className="mb-2 flex justify-between text-xs"><span>{tasks.length} tasks</span><span>{progress}%</span></div>
                            <div className={`h-2 rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {detailTab === "documents" && (
                <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                  <section className={`rounded-[28px] border p-5 ${panel}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Google Drive</p>
                    <h4 className="mt-1 text-xl font-semibold">Project documents</h4>
                    <p className={`mt-2 text-sm leading-6 ${muted}`}>Files are read from the linked Drive folder. Uploads go into that same folder when it is shared with the service account.</p>
                    {selectedProject.driveFolderId || selectedProject.driveFolderLink ? (
                      <a href={selectedProject.driveFolderLink || `https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                        Open Drive folder <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700">Add a Google Drive folder link in project settings to enable Drive sync and uploads.</p>
                    )}
                    {isSuperAdmin && (
                      <div className="mt-6 space-y-3">
                        <Field label="Category"><SelectMenu darkMode={darkMode} value={docForm.category} onChange={(value) => setDocForm((current) => ({ ...current, category: value }))} options={DOC_CATEGORIES} /></Field>
                        <Field label="Document name"><TextInput darkMode={darkMode} value={docForm.name} onChange={(value) => setDocForm((current) => ({ ...current, name: value }))} placeholder="e.g. Approved drawing" /></Field>
                        <Field label="Drive/document link"><TextInput darkMode={darkMode} value={docForm.url} onChange={(value) => setDocForm((current) => ({ ...current, url: value }))} placeholder="https://drive.google.com/..." /></Field>
                        <button type="button" onClick={addDocumentLink} className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sm font-semibold text-black"><LinkIcon className="h-4 w-4" /> Add link</button>
                        <label className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold ${selectedProject.driveFolderId || selectedProject.driveFolderLink ? "bg-[#7bea2a] text-black" : "bg-black/5 text-black/35"}`}>
                          {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload to Drive
                          <input type="file" disabled={uploadingDoc || !(selectedProject.driveFolderId || selectedProject.driveFolderLink)} onChange={uploadProjectDocument} className="hidden" />
                        </label>
                      </div>
                    )}
                  </section>
                  <section className="grid content-start gap-3 md:grid-cols-2">
                    {docs.map((doc) => (
                      <a key={doc.driveFileId || doc.url || doc.id} href={doc.url} target="_blank" rel="noreferrer" className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${panel}`}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><FileText className="h-5 w-5" /></span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{doc.name}</p>
                            <p className={`mt-1 text-xs ${muted}`}>{doc.category || doc.source || "Document"} · {doc.uploadedAt ? formatDate(String(doc.uploadedAt).slice(0, 10)) : "Drive"}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                    {!docs.length && <p className={`rounded-[24px] border border-dashed p-10 text-center text-sm ${muted}`}>No project documents found yet.</p>}
                  </section>
                </div>
              )}
            </section>
          </div>
        </Drawer>
      )}

      {editor && (
        <Drawer
          darkMode={darkMode}
          title={editor.id ? "Edit project" : "Add project"}
          subtitle="Project details, phases, tasks, dependencies, and Drive documents"
          onClose={() => setEditor(null)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setEditor(null)} className={`rounded-full border px-6 py-3 text-sm ${darkMode ? "border-white/10" : "border-black/10"}`}>Cancel</button>
              <button type="submit" form="project-editor-form" disabled={saving} className="flex items-center gap-2 rounded-full bg-[#7bea2a] px-7 py-3 text-sm font-semibold text-black disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save project
              </button>
            </div>
          }
        >
          <form id="project-editor-form" onSubmit={saveProject} className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className={`rounded-[28px] border p-4 ${panel}`}>
              <div className="space-y-2">
                {[
                  ["project", "Project", BriefcaseBusiness],
                  ["phases", "Phases", Layers3],
                  ["tasks", "Tasks", ListChecks],
                  ["documents", "Documents", Paperclip],
                ].map(([value, label, Icon]) => (
                  <button key={value} type="button" onClick={() => setEditorTab(value)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${editorTab === value ? "bg-[#171714] text-white" : darkMode ? "text-white/60 hover:bg-white/5" : "text-black/60 hover:bg-black/[0.04]"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </aside>

            <section className={`rounded-[28px] border p-5 sm:p-7 ${panel}`}>
              {editorTab === "project" && (
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Project name"><TextInput darkMode={darkMode} required value={editor.name} onChange={(value) => updateEditor({ name: value })} placeholder="Kalhaar Residence" /></Field>
                  <Field label="Project code"><TextInput darkMode={darkMode} value={editor.code} onChange={(value) => updateEditor({ code: value })} placeholder="KAL-01" /></Field>
                  <Field label="Client"><TextInput darkMode={darkMode} value={editor.client} onChange={(value) => updateEditor({ client: value })} placeholder="Client name" /></Field>
                  <Field label="Location"><TextInput darkMode={darkMode} value={editor.location} onChange={(value) => updateEditor({ location: value })} placeholder="Site location" /></Field>
                  <Field label="Project manager"><TextInput darkMode={darkMode} value={editor.manager} onChange={(value) => updateEditor({ manager: value })} placeholder="Responsible person" /></Field>
                  <Field label="Manager user"><SelectMenu darkMode={darkMode} value={editor.managerId || ""} onChange={(value) => updateEditor({ managerId: value, manager: users.find((item) => item.id === value)?.displayName || editor.manager })} options={[{ value: "", label: "No linked user" }, ...users.map((item) => ({ value: item.id, label: item.displayName || item.username }))]} /></Field>
                  <Field label="Start date"><TextInput darkMode={darkMode} type="date" value={editor.startDate} onChange={(value) => updateEditor({ startDate: value })} /></Field>
                  <Field label="Target date"><TextInput darkMode={darkMode} type="date" value={editor.targetDate} onChange={(value) => updateEditor({ targetDate: value })} /></Field>
                  <Field label="Priority"><SelectMenu darkMode={darkMode} value={editor.priority} onChange={(value) => updateEditor({ priority: value })} options={PRIORITY_OPTIONS} /></Field>
                  <Field label="Health"><SelectMenu darkMode={darkMode} value={editor.health} onChange={(value) => updateEditor({ health: value })} options={HEALTH_OPTIONS} /></Field>
                  <div className="md:col-span-2"><Field label="Google Drive folder"><TextInput darkMode={darkMode} value={editor.driveFolderLink || editor.driveFolderId} onChange={(value) => updateEditor({ driveFolderLink: value })} placeholder="https://drive.google.com/drive/folders/..." /></Field></div>
                  <div className="md:col-span-2"><Field label="Aliases"><TextInput darkMode={darkMode} value={(editor.aliases || []).join(", ")} onChange={(value) => updateEditor({ aliases: listFromText(value) })} placeholder="Alternate project names used in reports" /></Field></div>
                </div>
              )}

              {editorTab === "phases" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><h4 className="text-xl font-semibold">Project phases</h4><p className={`mt-1 text-sm ${muted}`}>Break the project into clear execution stages.</p></div>
                    <button type="button" onClick={() => updateEditor({ phases: [...(editor.phases || []), blankPhase()] })} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" /> Add phase</button>
                  </div>
                  {(editor.phases || []).map((phase, index) => (
                    <div key={phase.id} className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                      <div className="mb-4 flex items-center justify-between">
                        <span className={`flex items-center gap-2 text-sm font-semibold ${muted}`}><GripVertical className="h-4 w-4" /> Phase {index + 1}</span>
                        <button type="button" onClick={() => updateEditor({ phases: editor.phases.filter((_, phaseIndex) => phaseIndex !== index) })} className="rounded-full p-2 text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Phase name"><TextInput darkMode={darkMode} value={phase.name} onChange={(value) => updatePhase(index, { name: value })} placeholder="Design approval" /></Field>
                        <Field label="Status"><SelectMenu darkMode={darkMode} value={phase.status} onChange={(value) => updatePhase(index, { status: value })} options={STATUS_OPTIONS} /></Field>
                        <Field label="Start"><TextInput darkMode={darkMode} type="date" value={phase.startDate} onChange={(value) => updatePhase(index, { startDate: value })} /></Field>
                        <Field label="Deadline"><TextInput darkMode={darkMode} type="date" value={phase.dueDate} onChange={(value) => updatePhase(index, { dueDate: value })} /></Field>
                        <div className="md:col-span-2"><Field label="Description"><TextArea darkMode={darkMode} value={phase.description} onChange={(value) => updatePhase(index, { description: value })} placeholder="What this phase must complete..." rows={3} /></Field></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editorTab === "tasks" && (
                <div className="space-y-5">
                  <div><h4 className="text-xl font-semibold">Phase tasks</h4><p className={`mt-1 text-sm ${muted}`}>Assign work, deadlines, priorities, and dependencies.</p></div>
                  {(editor.phases || []).map((phase, phaseIndex) => (
                    <section key={phase.id} className={`rounded-[26px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                      <div className="mb-4 flex items-center justify-between">
                        <div><p className="text-sm font-semibold">{phase.name || `Phase ${phaseIndex + 1}`}</p><p className={`text-xs ${muted}`}>{(phase.tasks || []).length} tasks</p></div>
                        <button type="button" onClick={() => addTask(phaseIndex)} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" /> Add task</button>
                      </div>
                      <div className="space-y-4">
                        {(phase.tasks || []).map((task) => {
                          const dependencyOptions = (editor.phases || []).flatMap((item) => (item.tasks || [])).filter((item) => item.id !== task.id).map((item) => ({ value: item.id, label: item.title || "Untitled task" }));
                          return (
                            <div key={task.id} className={`rounded-[22px] border p-4 ${darkMode ? "border-white/10 bg-[#101216]" : "border-black/[0.06] bg-white"}`}>
                              <div className="mb-3 flex items-center justify-between">
                                <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${muted}`}>Task</span>
                                <button type="button" onClick={() => deleteTask(task.id)} className="rounded-full p-2 text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                              </div>
                              <div className="grid gap-4 lg:grid-cols-4">
                                <div className="lg:col-span-2"><Field label="Title"><TextInput darkMode={darkMode} value={task.title} onChange={(value) => updateTask(task.id, { title: value })} placeholder="Task title" /></Field></div>
                                <Field label="Status"><SelectMenu darkMode={darkMode} value={task.status} onChange={(value) => updateTask(task.id, { status: value })} options={STATUS_OPTIONS} /></Field>
                                <Field label="Priority"><SelectMenu darkMode={darkMode} value={task.priority} onChange={(value) => updateTask(task.id, { priority: value })} options={PRIORITY_OPTIONS} /></Field>
                                <Field label="Start"><TextInput darkMode={darkMode} type="date" value={task.startDate} onChange={(value) => updateTask(task.id, { startDate: value })} /></Field>
                                <Field label="Deadline"><TextInput darkMode={darkMode} type="date" value={task.dueDate} onChange={(value) => updateTask(task.id, { dueDate: value })} /></Field>
                                <div className="lg:col-span-2"><Field label="Assign members"><UserPicker darkMode={darkMode} users={users} selectedIds={task.assigneeIds || []} onChange={(ids) => updateTask(task.id, { assigneeIds: ids })} /></Field></div>
                                <div className="lg:col-span-2"><Field label="Dependencies"><SelectMenu darkMode={darkMode} value="" onChange={(value) => value && updateTask(task.id, { dependencyIds: [...new Set([...(task.dependencyIds || []), value])] })} options={[{ value: "", label: "Add dependency" }, ...dependencyOptions]} /></Field></div>
                                <div className="lg:col-span-2">
                                  <p className={`mb-2 text-xs ${muted}`}>Selected dependencies</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(task.dependencyIds || []).map((id) => <button key={id} type="button" onClick={() => updateTask(task.id, { dependencyIds: task.dependencyIds.filter((item) => item !== id) })} className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">{dependencyOptions.find((item) => item.value === id)?.label || id} ×</button>)}
                                    {!(task.dependencyIds || []).length && <span className={`text-xs ${muted}`}>No dependencies.</span>}
                                  </div>
                                </div>
                                <div className="lg:col-span-4"><Field label="Description"><TextArea darkMode={darkMode} value={task.description} onChange={(value) => updateTask(task.id, { description: value })} placeholder="What must be done, what is blocked, and expected output..." rows={3} /></Field></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {editorTab === "documents" && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div><h4 className="text-xl font-semibold">Document settings</h4><p className={`mt-2 text-sm leading-6 ${muted}`}>Paste a Google Drive folder link in the Project tab. Documents uploaded from the project drawer will be stored there.</p></div>
                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.035]" : "bg-[#f5f7f3]"}`}>
                    <p className="text-sm font-semibold">Current Drive folder</p>
                    <p className={`mt-2 break-all text-sm ${muted}`}>{editor.driveFolderLink || editor.driveFolderId || "Not linked yet"}</p>
                  </div>
                </div>
              )}
            </section>
          </form>
        </Drawer>
      )}
    </div>
  );
}
