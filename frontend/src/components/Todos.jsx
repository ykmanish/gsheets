"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Check, CheckCircle2, CirclePause, Clock3, ClipboardList, Loader2, Pencil, Plus, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import { useClickOutside } from "./ui";

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function emptyTodoTask() {
  return { site: "", category: "", status: "In Progress", involvement: "", involvementValues: [], description: "", recurring: false };
}

function uniqueClean(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function reportRowFromTodo(todo = {}) {
  const task = todo.task || todo;
  const involvementValues = uniqueClean(Array.isArray(task.involvementValues) ? task.involvementValues : String(task.involvement || "").split(","));
  return {
    site: String(task.site === "__other" ? task.siteOther : task.site || "").trim(),
    siteOther: task.siteOther || "",
    category: String(task.category === "__other" ? task.categoryOther : task.category || "").trim(),
    categoryOther: task.categoryOther || "",
    status: String(task.status === "__other" ? task.statusOther : task.status || "In Progress").trim(),
    statusOther: task.statusOther || "",
    involvement: involvementValues.join(", "),
    involvementValues,
    involvementOther: task.involvementOther || "",
    description: String(task.description || "").trim(),
    recurring: Boolean(task.recurring),
    recurringId: [task.site, task.category, task.description].map((value) => String(value || "").trim().toLowerCase()).join("|"),
  };
}

function taskStatusMeta(status = "", darkMode = false) {
  const key = String(status || "").toLowerCase();
  if (key.includes("complete")) return { Icon: CheckCircle2, option: darkMode ? "text-emerald-100 hover:bg-emerald-400/10" : "text-emerald-700 hover:bg-emerald-50", selected: darkMode ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700", active: "bg-emerald-500 text-white", dot: "bg-emerald-500" };
  if (key.includes("halt")) return { Icon: CirclePause, option: darkMode ? "text-orange-100 hover:bg-orange-400/10" : "text-orange-700 hover:bg-orange-50", selected: darkMode ? "border-orange-400/20 bg-orange-400/10 text-orange-100" : "border-orange-200 bg-orange-50 text-orange-700", active: "bg-orange-500 text-white", dot: "bg-orange-500" };
  if (key.includes("suspend")) return { Icon: AlertTriangle, option: darkMode ? "text-red-100 hover:bg-red-400/10" : "text-red-700 hover:bg-red-50", selected: darkMode ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-red-200 bg-red-50 text-red-700", active: "bg-red-500 text-white", dot: "bg-red-500" };
  if (key.includes("cancel")) return { Icon: Ban, option: darkMode ? "text-red-100 hover:bg-red-400/10" : "text-red-700 hover:bg-red-50", selected: darkMode ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-red-200 bg-red-50 text-red-700", active: "bg-red-600 text-white", dot: "bg-red-600" };
  return { Icon: Clock3, option: darkMode ? "text-sky-100 hover:bg-sky-400/10" : "text-sky-700 hover:bg-sky-50", selected: darkMode ? "border-sky-400/20 bg-sky-400/10 text-sky-100" : "border-sky-200 bg-sky-50 text-sky-700", active: "bg-[#171714] text-white", dot: "bg-sky-500" };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function SearchableSelect({ darkMode, value, onChange, options = [], popularOptions = [], placeholder, allowOther = true, variant = "default" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useClickOutside(ref, () => setOpen(false));
  const filtered = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const popularKeys = new Set(popularOptions.map((option) => String(option.value || option).toLowerCase()));
  const popular = filtered.filter((option) => popularKeys.has(option.toLowerCase()));
  const regular = filtered.filter((option) => !popularKeys.has(option.toLowerCase()));
  const selectedLabel = value === "__other" ? "Other" : value;
  const selectedStatus = variant === "status" && selectedLabel ? taskStatusMeta(selectedLabel, darkMode) : null;
  const SelectedIcon = selectedStatus?.Icon;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm transition ${selectedStatus ? selectedStatus.selected : darkMode ? "border-white/10 bg-white/[0.035] text-white" : "border-black/10 bg-white text-black"}`}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${selectedLabel ? "" : darkMode ? "text-white/35" : "text-black/35"}`}>{SelectedIcon ? <SelectedIcon className="h-4 w-4 shrink-0" /> : null}<span className="truncate">{selectedLabel || placeholder}</span></span>
        <Search className="h-4 w-4 opacity-45" />
      </button>
      {open && (
        <div className={`absolute left-0 top-[calc(100%+8px)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border p-2 shadow-2xl ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/10 bg-white"}`}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className={`mb-2 h-10 w-full rounded-xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white" : "border-black/10 bg-white"}`} />
          <div className="max-h-56 overflow-y-auto">
            {popular.length > 0 && <p className={`px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>Most used</p>}
            {[...popular, ...regular].map((option) => {
              const meta = variant === "status" ? taskStatusMeta(option, darkMode) : null;
              const OptionIcon = meta?.Icon;
              const isPopular = popularKeys.has(option.toLowerCase());
              return (
              <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); setQuery(""); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${option === value ? meta?.active || (darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white") : isPopular ? darkMode ? "bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15" : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : meta?.option || (darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]")}`}>
                {OptionIcon ? <OptionIcon className="h-4 w-4 shrink-0" /> : null}
                <span className="min-w-0 flex-1 truncate">{option}</span>
                {isPopular && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${darkMode ? "bg-emerald-300/15 text-emerald-200" : "bg-emerald-200/70 text-emerald-800"}`}>Most used</span>}
              </button>
              );
            })}
            {allowOther && (
              <button type="button" onClick={() => { onChange("__other"); setOpen(false); setQuery(""); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${value === "__other" ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}>
                Other
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiChoiceSelect({ darkMode, values = [], onChange, options = [], popularOptions = [], placeholder }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useClickOutside(ref, () => setOpen(false));
  const selected = new Set(values.map((value) => String(value).toLowerCase()));
  const filtered = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const popularKeys = new Set(popularOptions.map((option) => String(option.value || option).toLowerCase()));
  const popular = filtered.filter((option) => popularKeys.has(option.toLowerCase()));
  const regular = filtered.filter((option) => !popularKeys.has(option.toLowerCase()));
  function toggle(option) {
    const key = option.toLowerCase();
    onChange(uniqueClean(selected.has(key) ? values.filter((value) => value.toLowerCase() !== key) : [...values, option]));
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left text-sm transition ${darkMode ? "border-white/10 bg-white/[0.035] text-white" : "border-black/10 bg-white text-black"}`}>
        <span className={`min-w-0 flex-1 truncate ${values.length ? "" : darkMode ? "text-white/35" : "text-black/35"}`}>{values.length ? values.join(", ") : placeholder}</span>
        {values.length > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${darkMode ? "bg-emerald-300/15 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}>{values.length}</span>}
        <Search className="h-4 w-4 opacity-45" />
      </button>
      {open && (
        <div className={`absolute left-0 top-[calc(100%+8px)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border p-2 shadow-2xl ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/10 bg-white"}`}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className={`mb-2 h-10 w-full rounded-xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white" : "border-black/10 bg-white"}`} />
          <div className="max-h-56 overflow-y-auto">
            {popular.length > 0 && <p className={`px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>Most used</p>}
            {[...popular, ...regular].map((option) => {
              const checked = selected.has(option.toLowerCase());
              const isPopular = popularKeys.has(option.toLowerCase());
              return (
                <button key={option} type="button" onClick={() => toggle(option)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-all duration-200 ${checked ? darkMode ? "bg-emerald-400/15 text-emerald-100" : "bg-emerald-50 text-emerald-900" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition-all duration-200 ${checked ? "border-emerald-500 bg-emerald-500 text-white" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-black/10 bg-white"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {isPopular && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${darkMode ? "bg-emerald-300/15 text-emerald-200" : "bg-emerald-200/70 text-emerald-800"}`}>Most used</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Todos({ darkMode = false }) {
  const { user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [draft, setDraft] = useState(emptyTodoTask());
  const [editingTodo, setEditingTodo] = useState(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState({ sites: [], taskTypes: [], taskStatuses: [], involvements: [] });
  const [optionUsage, setOptionUsage] = useState({ sites: [], categories: [], involvements: [] });
  const [preferences, setPreferences] = useState({ useCustomOnly: false, sites: [], categories: [] });
  const panel = darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/[0.06] bg-white text-black";
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const inputClass = `h-12 w-full rounded-2xl border px-4 outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black placeholder:text-black/35"}`;

  async function load() {
    try {
      setLoading(true);
      const result = await api("/todos");
      setTodos(result.todos || []);
      setOptions(result.options || { sites: [], taskTypes: [], taskStatuses: [], involvements: [] });
      setOptionUsage(result.optionUsage || { sites: [], categories: [], involvements: [] });
      setPreferences(result.preferences || { useCustomOnly: false, sites: [], categories: [] });
    } catch (error) {
      toast.error(error.message || "Could not load todos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return todos;
    return todos.filter((todo) => [todo.task?.site, todo.task?.category, todo.task?.status, todo.task?.involvement, todo.task?.description].join(" ").toLowerCase().includes(needle));
  }, [query, todos]);
  const formSites = preferences.useCustomOnly ? preferences.sites : uniqueClean([...(options.sites || []), ...(preferences.sites || [])]);
  const formCategories = preferences.useCustomOnly ? preferences.categories : uniqueClean([...(options.taskTypes || []), ...(preferences.categories || [])]);

  function closeDrawer() {
    setDrawerClosing(true);
    window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
      setEditingTodo(null);
      setDraft(emptyTodoTask());
    }, 220);
  }

  function openAddDrawer() {
    setEditingTodo(null);
    setDraft(emptyTodoTask());
    setDrawerClosing(false);
    setDrawerOpen(true);
  }

  function openEditDrawer(todo) {
    setEditingTodo(todo);
    setDraft({ ...emptyTodoTask(), ...(todo.task || {}) });
    setDrawerClosing(false);
    setDrawerOpen(true);
  }

  async function saveTodo() {
    if (!draft.site && !draft.category && !draft.description) {
      toast.error("Add todo task details");
      return;
    }
    try {
      setSaving(true);
      if (editingTodo?.id) {
        await patchTodo(editingTodo.id, { task: draft });
        toast.success("Todo updated");
      } else {
        const result = await api("/todos", { method: "POST", body: JSON.stringify(draft) });
        setTodos((current) => [result.todo, ...current]);
        toast.success("Todo added");
      }
      closeDrawer();
    } catch (error) {
      toast.error(error.message || "Could not save todo");
    } finally {
      setSaving(false);
    }
  }

  async function patchTodo(id, patch) {
    const result = await api(`/todos/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setTodos((current) => current.map((item) => item.id === id ? result.todo : item));
    return result.todo;
  }

  async function deleteTodo(id) {
    try {
      await api(`/todos/${id}`, { method: "DELETE" });
      setTodos((current) => current.filter((item) => item.id !== id));
      toast.success("Todo deleted");
    } catch (error) {
      toast.error(error.message || "Could not delete todo");
    }
  }

  async function sendTodoToReport(todo) {
    if (!todo) return;
    const date = todayInput();
    const key = `employee-daily-report-todo-import:${user?.id || "me"}:${date}`;
    const existing = JSON.parse(window.localStorage.getItem(key) || "[]");
    window.localStorage.setItem(key, JSON.stringify([...existing, reportRowFromTodo(todo)]));
    await patchTodo(todo.id, { markImported: true });
    toast.success("Todo added to daily report draft");
  }

  function toggleComplete(todo) {
    const nextCompleted = !todo.completed;
    const nextTask = {
      ...(todo.task || {}),
      status: nextCompleted ? "Completed" : ((todo.task?.status || "").toLowerCase() === "completed" ? "In Progress" : todo.task?.status || "In Progress"),
    };
    return patchTodo(todo.id, { task: nextTask, completed: nextCompleted });
  }

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0f1115] text-white" : "bg-[#eef3f2] text-black"}`}>
      <section className={`overflow-hidden rounded-[28px] border p-4 ${panel}`}>
        <div className="flex flex-col gap-4 px-2 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4b9b16]">Personal todos</p>
            <h1 className="mt-1 text-3xl font-black">Todo records</h1>
            <p className={`mt-0.5 text-sm ${muted}`}>{filtered.length} personal task{filtered.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl">
            <label className={`relative flex h-12 min-w-0 flex-1 items-center rounded-2xl border ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
              <Search className={`ml-4 h-4 w-4 ${muted}`} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search todos..." className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
            </label>
            <button type="button" onClick={load} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/10" : "border-black/10 bg-white hover:bg-black/[0.03]"}`} aria-label="Refresh todos">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={openAddDrawer} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white dark:bg-white dark:text-black">
              <Plus className="h-4 w-4" /> Add task
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className={`text-xs font-bold ${muted}`}>
                  <th className="px-4 py-2">Task</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Involvement</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((todo) => {
                  const task = todo.task || {};
                  return (
                    <tr key={todo.id} className={`${darkMode ? "bg-white/[0.045]" : "bg-[#f6f7fb]"}`}>
                      <td className="rounded-l-2xl px-4 py-4 font-black">{task.site || "No site"}</td>
                      <td className="px-4 py-4"><span className="rounded-full bg-[#eafbdc] px-3 py-1 text-xs font-bold text-[#3f7d16]">{task.category || "-"}</span></td>
                      <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-black/55"}`}>{task.involvement || "-"}</span></td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${todo.completed ? "bg-emerald-100 text-emerald-700" : todo.importedAt ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                          {todo.completed ? "Completed" : todo.importedAt ? "Sent" : task.status || "In Progress"}
                        </span>
                      </td>
                      <td className={`max-w-md truncate px-4 py-4 text-sm ${muted}`}>{task.description || "No description added"}</td>
                      <td className="rounded-r-2xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => sendTodoToReport(todo).catch((error) => toast.error(error.message || "Could not send todo"))} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#89ed3f] px-4 text-xs font-black text-black"><Send className="h-4 w-4" /> Send</button>
                          <button type="button" onClick={() => openEditDrawer(todo)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-white/10" : "bg-white"}`} aria-label="Edit todo"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => toggleComplete(todo).catch((error) => toast.error(error.message))} className={`grid h-10 w-10 place-items-center rounded-full ${todo.completed ? "bg-[#89ed3f] text-black" : darkMode ? "bg-white/10" : "bg-white"}`} aria-label="Toggle complete"><CheckCircle2 className="h-5 w-5" /></button>
                          <button type="button" onClick={() => deleteTodo(todo.id)} className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-600" aria-label="Delete todo"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !filtered.length && (
          <div className="p-12 text-center">
            <ClipboardList className={`mx-auto h-8 w-8 ${muted}`} />
            <h3 className="mt-3 font-black">No todos yet</h3>
            <p className={`mt-1 text-sm ${muted}`}>Add a personal task and send it to your daily report when ready.</p>
          </div>
        )}
      </section>

      {drawerOpen && (
        <div className={`fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm ${drawerClosing ? "animate-[mrn-backdrop-out_220ms_ease_forwards]" : "animate-[mrn-backdrop-in_180ms_ease-out_forwards]"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
          <aside className={`employee-report-drawer employee-report-shell absolute overflow-hidden border bg-white shadow-2xl dark:bg-[#11130f] ${drawerClosing ? "animate-[mrn-drawer-out_220ms_ease_forwards]" : "animate-[mrn-drawer-in_280ms_cubic-bezier(0.22,1,0.36,1)_forwards]"} ${darkMode ? "border-white/10 text-white" : "border-black/[0.06] text-black"}`}>
            <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4b9b16]">Task entry</p>
                <h2 className="mt-1 text-2xl font-black">{editingTodo ? "Edit todo task" : "Add todo task"}</h2>
              </div>
              <button type="button" onClick={closeDrawer} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </header>
            <div className="h-[calc(100%-81px)] overflow-y-auto bg-[#f7f8f3] p-6 pb-24 dark:bg-[#11130f]">
              <section className="min-h-full rounded-[24px] bg-white p-4 dark:bg-white/[0.04]">
                <div className="grid gap-4 lg:grid-cols-4">
                  <label><span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${muted}`}>Site</span><SearchableSelect darkMode={darkMode} value={draft.site} onChange={(value) => setDraft((current) => ({ ...current, site: value }))} options={formSites} popularOptions={optionUsage.sites} placeholder="Choose site" /></label>
                  <label><span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${muted}`}>Category</span><SearchableSelect darkMode={darkMode} value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value }))} options={formCategories.filter((category) => category !== "Other")} popularOptions={optionUsage.categories} placeholder="Choose category" /></label>
                  <label><span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${muted}`}>Involvement</span><MultiChoiceSelect darkMode={darkMode} values={draft.involvementValues || []} onChange={(values) => setDraft((current) => ({ ...current, involvementValues: values, involvement: values.join(", ") }))} options={options.involvements || []} popularOptions={optionUsage.involvements} placeholder="Choose involvement" /></label>
                  <label><span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${muted}`}>Task status</span><SearchableSelect darkMode={darkMode} value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} options={(options.taskStatuses || []).filter((status) => status !== "Other")} placeholder="Choose task status" variant="status" /></label>
                </div>
                {draft.site === "__other" && <input value={draft.siteOther || ""} onChange={(event) => setDraft((current) => ({ ...current, siteOther: event.target.value }))} placeholder="Enter site" className={`mt-3 ${inputClass}`} />}
                {draft.category === "__other" && <input value={draft.categoryOther || ""} onChange={(event) => setDraft((current) => ({ ...current, categoryOther: event.target.value }))} placeholder="Enter category" className={`mt-3 ${inputClass}`} />}
                {(draft.involvementValues || []).some((value) => value.toLowerCase() === "other") && <input value={draft.involvementOther || ""} onChange={(event) => setDraft((current) => ({ ...current, involvementOther: event.target.value }))} placeholder="Enter involvement" className={`mt-3 ${inputClass}`} />}
                <label className="mt-4 block"><span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${muted}`}>Description</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Describe this task..." className={`w-full rounded-2xl border px-4 py-3 outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"}`} /></label>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, recurring: !current.recurring }))} className={`mt-4 inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${draft.recurring ? "bg-emerald-100 text-emerald-800" : darkMode ? "bg-white/10 text-white/60 hover:bg-white/15" : "bg-white text-black/55 hover:bg-[#eafbdc]"}`}>
                  <RefreshCw className="h-4 w-4" /> Recurring
                </button>
              </section>
            </div>
            <footer className="absolute bottom-0 left-0 right-0 flex justify-end gap-2 border-t border-black/10 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#11130f]">
              <button type="button" onClick={closeDrawer} className={`h-12 rounded-full border px-6 text-sm font-black ${darkMode ? "border-white/10" : "border-black/10"}`}>Cancel</button>
              <button type="button" onClick={saveTodo} disabled={saving} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-black text-black disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editingTodo ? "Update task" : "Save task"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </main>
  );
}
