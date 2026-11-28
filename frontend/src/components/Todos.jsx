"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Check, CheckCircle2, ChevronDown, CirclePause, Clock3, ClipboardList, ListTodo, Loader2, Pencil, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import { Button, Chip, Drawer, EmptyState, IconTile, PageHeader, StatTile, cx, fieldClass, useClickOutside } from "./ui";

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
  const pastel = (light, dark) => (darkMode ? dark : light);
  if (key.includes("complete")) return { Icon: CheckCircle2, tone: "mint", option: pastel("text-[#2f7a4f] hover:bg-[#e4f1e6]", "text-[#a7e8bf] hover:bg-white/[0.06]"), selected: pastel("!border-transparent !bg-[#e4f1e6] !text-[#2f7a4f]", "!border-transparent !bg-emerald-400/[0.12] !text-[#a7e8bf]"), active: pastel("bg-[#e4f1e6] text-[#2f7a4f]", "bg-emerald-400/[0.14] text-[#a7e8bf]"), dot: "bg-[#2f7a4f]" };
  if (key.includes("halt")) return { Icon: CirclePause, tone: "peach", option: pastel("text-[#c2562b] hover:bg-[#fbe5dc]", "text-[#f9bf9b] hover:bg-white/[0.06]"), selected: pastel("!border-transparent !bg-[#fbe5dc] !text-[#c2562b]", "!border-transparent !bg-orange-400/[0.13] !text-[#f9bf9b]"), active: pastel("bg-[#fbe5dc] text-[#c2562b]", "bg-orange-400/[0.15] text-[#f9bf9b]"), dot: "bg-[#c2562b]" };
  if (key.includes("suspend")) return { Icon: AlertTriangle, tone: "rose", option: pastel("text-[#c0394b] hover:bg-[#fbe4e6]", "text-[#f7aab5] hover:bg-white/[0.06]"), selected: pastel("!border-transparent !bg-[#fbe4e6] !text-[#c0394b]", "!border-transparent !bg-rose-400/[0.13] !text-[#f7aab5]"), active: pastel("bg-[#fbe4e6] text-[#c0394b]", "bg-rose-400/[0.15] text-[#f7aab5]"), dot: "bg-[#c0394b]" };
  if (key.includes("cancel")) return { Icon: Ban, tone: "rose", option: pastel("text-[#c0394b] hover:bg-[#fbe4e6]", "text-[#f7aab5] hover:bg-white/[0.06]"), selected: pastel("!border-transparent !bg-[#fbe4e6] !text-[#c0394b]", "!border-transparent !bg-rose-400/[0.13] !text-[#f7aab5]"), active: pastel("bg-[#fbe4e6] text-[#c0394b]", "bg-rose-400/[0.15] text-[#f7aab5]"), dot: "bg-[#c0394b]" };
  return { Icon: Clock3, tone: "sky", option: pastel("text-[#2f6fc0] hover:bg-[#e3eefb]", "text-[#a9cbf7] hover:bg-white/[0.06]"), selected: pastel("!border-transparent !bg-[#e3eefb] !text-[#2f6fc0]", "!border-transparent !bg-sky-400/[0.13] !text-[#a9cbf7]"), active: pastel("bg-[#e3eefb] text-[#2f6fc0]", "bg-sky-400/[0.15] text-[#a9cbf7]"), dot: "bg-[#2f6fc0]" };
}

// Shared look for the two in-drawer pickers: grey pill trigger, white popover with hairline border.
const popoverClass = (darkMode) => cx(
  "absolute left-0 top-[calc(100%+6px)] z-50 rounded-[18px] border p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.1)]",
  darkMode ? "border-white/10 bg-[#17181c] text-white" : "border-[#ececec] bg-white text-[#141414]",
);
const popoverSearchClass = (darkMode) => cx(
  "mb-1.5 h-9 w-full rounded-full px-3.5 text-[13px] outline-none",
  darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0]",
);
const groupLabelClass = (darkMode) => cx("px-2.5 pb-1 pt-1 text-[11px]", darkMode ? "text-white/40" : "text-[#8a8a87]");
const mostUsedClass = (darkMode) => cx("shrink-0 rounded-full px-2 py-0.5 text-[10.5px]", darkMode ? "bg-[#cff07a]/15 text-[#d8f39a]" : "bg-[#eef8cc] text-[#4d6b12]");

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
        className={cx(fieldClass(darkMode, { open }), "justify-between", selectedStatus && selectedStatus.selected)}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${selectedLabel ? "" : darkMode ? "text-white/40" : "text-[#a3a3a0]"}`}>{SelectedIcon ? <SelectedIcon className="h-4 w-4 shrink-0" /> : null}<span className="truncate">{selectedLabel || placeholder}</span></span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={cx(popoverClass(darkMode), "w-[min(18rem,calc(100vw-2rem))]")}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className={popoverSearchClass(darkMode)} />
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {popular.length > 0 && <p className={groupLabelClass(darkMode)}>Most used</p>}
            {[...popular, ...regular].map((option) => {
              const meta = variant === "status" ? taskStatusMeta(option, darkMode) : null;
              const OptionIcon = meta?.Icon;
              const isPopular = popularKeys.has(option.toLowerCase());
              return (
              <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); setQuery(""); }} className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[13px] transition-colors ${option === value ? meta?.active || (darkMode ? "bg-white/[0.08] text-white" : "bg-[#f4f4f2] text-[#141414]") : meta?.option || (darkMode ? "text-white/80 hover:bg-white/[0.05]" : "text-[#3d3d3b] hover:bg-[#f6f6f4]")}`}>
                {OptionIcon ? <OptionIcon className="h-4 w-4 shrink-0" /> : null}
                <span className="min-w-0 flex-1 truncate">{option}</span>
                {isPopular && <span className={mostUsedClass(darkMode)}>Most used</span>}
                {option === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
              );
            })}
            {allowOther && (
              <>
                <div className={`my-1 h-px ${darkMode ? "bg-white/10" : "bg-[#efefed]"}`} />
                <button type="button" onClick={() => { onChange("__other"); setOpen(false); setQuery(""); }} className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[13px] transition-colors ${value === "__other" ? darkMode ? "bg-white/[0.08] text-white" : "bg-[#f4f4f2] text-[#141414]" : darkMode ? "text-white/80 hover:bg-white/[0.05]" : "text-[#3d3d3b] hover:bg-[#f6f6f4]"}`}>
                  <span className="flex-1">Other</span>
                  {value === "__other" && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </>
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
      <button type="button" onClick={() => setOpen((current) => !current)} className={cx(fieldClass(darkMode, { open }), "justify-between")}>
        <span className={`min-w-0 flex-1 truncate ${values.length ? "" : darkMode ? "text-white/40" : "text-[#a3a3a0]"}`}>{values.length ? values.join(", ") : placeholder}</span>
        {values.length > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] ${darkMode ? "bg-white/10 text-white/75" : "bg-white text-[#3d3d3b]"}`}>{values.length}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={cx(popoverClass(darkMode), "w-[min(20rem,calc(100vw-2rem))]")}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className={popoverSearchClass(darkMode)} />
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {popular.length > 0 && <p className={groupLabelClass(darkMode)}>Most used</p>}
            {[...popular, ...regular].map((option) => {
              const checked = selected.has(option.toLowerCase());
              const isPopular = popularKeys.has(option.toLowerCase());
              return (
                <button key={option} type="button" onClick={() => toggle(option)} className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[13px] transition-colors ${checked ? darkMode ? "bg-white/[0.08] text-white" : "bg-[#f4f4f2] text-[#141414]" : darkMode ? "text-white/80 hover:bg-white/[0.05]" : "text-[#3d3d3b] hover:bg-[#f6f6f4]"}`}>
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${checked ? darkMode ? "border-white bg-white text-black" : "border-[#141414] bg-[#141414] text-white" : darkMode ? "border-white/25" : "border-[#cfcfcb] bg-white"}`}>{checked && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {isPopular && <span className={mostUsedClass(darkMode)}>Most used</span>}
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const inputClass = cx(fieldClass(darkMode), "placeholder:text-[#a3a3a0]");
  const labelClass = `mb-1.5 block text-[12px] ${darkMode ? "text-white/55" : "text-[#8a8a8a]"}`;

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

  const completedCount = todos.filter((todo) => todo.completed).length;
  const sentCount = todos.filter((todo) => !todo.completed && todo.importedAt).length;
  const openCount = todos.length - completedCount;

  return (
    <main className={`newq min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto w-full max-w-[1600px]">
        <PageHeader
          darkMode={darkMode}
          badge="Personal todos"
          badgeIcon={ListTodo}
          badgeTone="lavender"
          title="Todos"
          subtitle="ready to send to your daily report"
          actions={
            <>
              <label className={cx(fieldClass(darkMode), "w-full min-w-[220px] cursor-text sm:w-72")}>
                <Search className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/45" : "text-[#8a8a87]"}`} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search todos..." className={`min-w-0 flex-1 !rounded-none !border-0 !bg-transparent !p-0 text-[13.5px] !shadow-none outline-none !ring-0 ${darkMode ? "placeholder:text-white/35" : "placeholder:text-[#a3a3a0]"}`} />
              </label>
              <button type="button" onClick={load} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.07] hover:bg-white/[0.11]" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`} aria-label="Refresh todos">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={openAddDrawer} className="h-10">
                Add task
              </Button>
            </>
          }
        />

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile darkMode={darkMode} icon={ListTodo} tone="lavender" value={todos.length} label="All todos" />
          <StatTile darkMode={darkMode} icon={Clock3} tone="sky" value={openCount} label="Still open" />
          <StatTile darkMode={darkMode} icon={CheckCircle2} tone="mint" value={completedCount} label="Completed" />
          <StatTile darkMode={darkMode} icon={Send} tone="lime" value={sentCount} label="Sent to report" />
        </div>

        <section className={`mt-6 rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
          <div className="flex items-center gap-2.5 px-5 pt-4">
            <IconTile icon={ClipboardList} tone="lavender" darkMode={darkMode} size="sm" />
            <div>
              <h2 className="text-[15px]">Todo records</h2>
              <p className={`text-[12.5px] ${muted}`}>{filtered.length} personal task{filtered.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="p-3 pt-2 sm:p-4 sm:pt-2">
            {loading ? (
              <div className={`p-12 text-center ${muted}`}><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
            ) : filtered.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-y-1.5 text-left">
                  <thead>
                    <tr className={`text-[12px] ${muted}`}>
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
                      const statusTone = todo.completed ? "mint" : todo.importedAt ? "lime" : taskStatusMeta(task.status, darkMode).tone;
                      const iconButton = `grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.07] hover:bg-white/[0.12]" : "bg-white hover:bg-[#ebebe8]"}`;
                      return (
                        <tr key={todo.id} className={darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}>
                          <td className="rounded-l-[14px] px-4 py-3.5 text-[14px]">{task.site || "No site"}</td>
                          <td className="px-4 py-3.5"><Chip tone="lavender" darkMode={darkMode}>{task.category || "-"}</Chip></td>
                          <td className="px-4 py-3.5"><Chip tone="outline" darkMode={darkMode}>{task.involvement || "-"}</Chip></td>
                          <td className="px-4 py-3.5">
                            <Chip tone={statusTone} darkMode={darkMode}>
                              {todo.completed ? "Completed" : todo.importedAt ? "Sent" : task.status || "In Progress"}
                            </Chip>
                          </td>
                          <td className={`max-w-md truncate px-4 py-3.5 text-[13px] ${muted}`}>{task.description || "No description added"}</td>
                          <td className="rounded-r-[14px] px-4 py-3.5">
                            <div className="flex justify-end gap-1.5">
                              <Button darkMode={darkMode} variant="primary" size="sm" icon={Send} onClick={() => sendTodoToReport(todo).catch((error) => toast.error(error.message || "Could not send todo"))}>Send</Button>
                              <button type="button" onClick={() => openEditDrawer(todo)} className={iconButton} aria-label="Edit todo"><Pencil className="h-4 w-4" /></button>
                              <button type="button" onClick={() => toggleComplete(todo).catch((error) => toast.error(error.message))} className={todo.completed ? `grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-emerald-400/[0.14] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"}` : iconButton} aria-label="Toggle complete"><CheckCircle2 className="h-4 w-4" /></button>
                              <button type="button" onClick={() => deleteTodo(todo.id)} className={`grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "bg-rose-400/[0.13] text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`} aria-label="Delete todo"><Trash2 className="h-4 w-4" /></button>
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
              <EmptyState
                darkMode={darkMode}
                icon={ClipboardList}
                tone="lavender"
                title="No todos yet"
                text="Add a personal task and send it to your daily report when ready."
                action={<Button darkMode={darkMode} variant="primary" size="sm" icon={Plus} onClick={openAddDrawer}>Add task</Button>}
              />
            )}
          </div>
        </section>
      </div>

      <Drawer
        open={drawerOpen && !drawerClosing}
        onClose={closeDrawer}
        darkMode={darkMode}
        icon={ListTodo}
        tone="lavender"
        title={editingTodo ? "Edit todo task" : "Add todo task"}
        subtitle="Task entry"
        width={720}
        footer={
          <>
            <Button darkMode={darkMode} variant="secondary" onClick={closeDrawer}>Cancel</Button>
            <Button darkMode={darkMode} variant="primary" onClick={saveTodo} disabled={saving} icon={Check} loading={saving}>
              {editingTodo ? "Update task" : "Save task"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Site</span><SearchableSelect darkMode={darkMode} value={draft.site} onChange={(value) => setDraft((current) => ({ ...current, site: value }))} options={formSites} popularOptions={optionUsage.sites} placeholder="Choose site" /></label>
          <label><span className={labelClass}>Category</span><SearchableSelect darkMode={darkMode} value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value }))} options={formCategories.filter((category) => category !== "Other")} popularOptions={optionUsage.categories} placeholder="Choose category" /></label>
          <label><span className={labelClass}>Involvement</span><MultiChoiceSelect darkMode={darkMode} values={draft.involvementValues || []} onChange={(values) => setDraft((current) => ({ ...current, involvementValues: values, involvement: values.join(", ") }))} options={options.involvements || []} popularOptions={optionUsage.involvements} placeholder="Choose involvement" /></label>
          <label><span className={labelClass}>Task status</span><SearchableSelect darkMode={darkMode} value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} options={(options.taskStatuses || []).filter((status) => status !== "Other")} placeholder="Choose task status" variant="status" /></label>
        </div>
        {draft.site === "__other" && <input value={draft.siteOther || ""} onChange={(event) => setDraft((current) => ({ ...current, siteOther: event.target.value }))} placeholder="Enter site" className={`mt-3 ${inputClass}`} />}
        {draft.category === "__other" && <input value={draft.categoryOther || ""} onChange={(event) => setDraft((current) => ({ ...current, categoryOther: event.target.value }))} placeholder="Enter category" className={`mt-3 ${inputClass}`} />}
        {(draft.involvementValues || []).some((value) => value.toLowerCase() === "other") && <input value={draft.involvementOther || ""} onChange={(event) => setDraft((current) => ({ ...current, involvementOther: event.target.value }))} placeholder="Enter involvement" className={`mt-3 ${inputClass}`} />}
        <label className="mt-4 block"><span className={labelClass}>Description</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Describe this task..." className={`w-full rounded-[16px] border border-transparent px-4 py-3 text-[13.5px] outline-none transition ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`} /></label>
        <button type="button" onClick={() => setDraft((current) => ({ ...current, recurring: !current.recurring }))} aria-pressed={Boolean(draft.recurring)} className={`mt-4 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] transition ${draft.recurring ? darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white" : darkMode ? "bg-white/[0.07] text-white/70 hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`}>
          <RefreshCw className="h-4 w-4" /> Recurring
        </button>
      </Drawer>
    </main>
  );
}
