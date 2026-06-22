import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  Clock3,
  FileText,
  Loader2,
  Mail,
  Play,
  Plus,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmModal } from "./ui";
import { API_URL } from "./AuthProvider";

const schedules = {
  hourly: { label: "Every hour", cron: "0 * * * *" },
  daily9: { label: "Every day at 9:00 AM", cron: "0 9 * * *" },
  daily18: { label: "Every day at 6:00 PM", cron: "0 18 * * *" },
  weekdays9: { label: "Weekdays at 9:00 AM", cron: "0 9 * * 1-5" },
  weekly: { label: "Every Monday at 9:00 AM", cron: "0 9 * * 1" },
};

const categories = {
  scheduled_summary: {
    title: "AI sheet summary",
    text: "Every day, explain what matters in this sheet.",
    icon: Bot,
    defaults: ["notification", "save_report"],
    ai: true,
  },
  scheduled_report: {
    title: "Scheduled report",
    text: "Create a date-wise report and optionally email it to you.",
    icon: FileText,
    defaults: ["notification", "save_report", "email_summary"],
    ai: true,
  },
  due_monitor: {
    title: "Pending dues monitor",
    text: "Watch due/status rows and alert or send customer emails.",
    icon: Mail,
    defaults: ["notification", "save_report"],
    ai: false,
  },
  condition_alert: {
    title: "Custom condition alert",
    text: "When a column matches your rule, notify or act.",
    icon: Bell,
    defaults: ["notification", "save_report"],
    ai: false,
  },
  ai_watch: {
    title: "AI watchlist",
    text: "Ask AI to inspect the sheet for a custom risk or opportunity.",
    icon: Sparkles,
    defaults: ["notification", "save_report"],
    ai: true,
  },
};

const actionLabels = {
  notification: "Notify me in app",
  save_report: "Save report",
  email_summary: "Email summary to me",
  row_email: "Send row-level emails",
};

const defaultForm = {
  name: "Daily sheet briefing",
  category: "scheduled_summary",
  documentIds: [],
  scheduleKey: "daily9",
  condition: { column: "Due Status", operator: "contains_any", value: "pending,due,overdue,unpaid" },
  intelligence: {
    useAi: true,
    provider: "auto",
    prompt: "Summarize important changes, risks, exceptions, and recommended actions.",
  },
  actions: ["notification", "save_report"],
  summaryRecipients: "",
  rowEmailColumn: "Email",
  rowEmailSubject: "Important update from {{Client Name}} / {{Invoice #}}",
  rowEmailBody: "Dear {{Client Name}},\n\nPlease review this update regarding {{Invoice #}}.\n\nRegards",
};

export default function Automations({ darkMode }) {
  const [automations, setAutomations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const panel = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white/80 border border-black/5";
  const muted = darkMode ? "text-white/50" : "text-black/45";
  const input = darkMode ? "bg-white/5 border border-white/10 text-white placeholder-white/25" : "bg-black/[0.03] border border-black/10 text-black placeholder-black/30";

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [automationRes, documentRes, integrationRes] = await Promise.all([
        fetch(`${API_URL}/automations`),
        fetch(`${API_URL}/documents`),
        fetch(`${API_URL}/integrations/status`),
      ]);
      const [automationData, documentData, integrationData] = await Promise.all([
        automationRes.json(),
        documentRes.json(),
        integrationRes.json(),
      ]);
      setAutomations(automationData.automations || []);
      setDocuments((documentData.documents || []).filter((doc) => doc.type === "sheet" && doc.isReady));
      setIntegrations(integrationData);
    } catch {
      toast.error("Could not load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadData]);

  const stats = useMemo(() => ({
    active: automations.filter((item) => item.enabled).length,
    ai: automations.filter((item) => item.intelligence?.useAi).length,
    actions: automations.reduce((sum, item) => sum + (item.actions || []).filter((action) => action.enabled !== false).length, 0),
  }), [automations]);

  const openBuilder = () => {
    setForm({
      ...defaultForm,
      documentIds: documents.length === 1 ? [documents[0].id] : [],
    });
    setModalOpen(true);
  };

  const setCategory = (category) => {
    setForm((current) => ({
      ...current,
      category,
      name: categories[category].title,
      intelligence: { ...current.intelligence, useAi: categories[category].ai },
      actions: categories[category].defaults,
    }));
  };

  const toggleSheet = (id) => {
    setForm((current) => ({
      ...current,
      documentIds: current.documentIds.includes(id)
        ? current.documentIds.filter((item) => item !== id)
        : [...current.documentIds, id],
    }));
  };

  const toggleAction = (type) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.includes(type)
        ? current.actions.filter((item) => item !== type)
        : [...current.actions, type],
    }));
  };

  const buildActions = () => form.actions.map((type) => {
    if (type === "email_summary") {
      return {
        type,
        enabled: true,
        recipients: form.summaryRecipients,
        subject: "Automation report: {{automationName}}",
      };
    }
    if (type === "row_email") {
      return {
        type,
        enabled: true,
        emailColumn: form.rowEmailColumn,
        subject: form.rowEmailSubject,
        body: form.rowEmailBody,
      };
    }
    return { type, enabled: true };
  });

  const createAutomation = async () => {
    if (!form.name.trim() || form.documentIds.length === 0) {
      toast.error("Add a name and select at least one sheet");
      return;
    }
    if (form.actions.includes("email_summary") && !form.summaryRecipients.trim()) {
      toast.error("Add a recipient for summary emails");
      return;
    }

    const schedule = schedules[form.scheduleKey];
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          documentIds: form.documentIds,
          trigger: { type: "schedule", schedule: form.scheduleKey, cron: schedule.cron },
          schedule: form.scheduleKey,
          scheduleCron: schedule.cron,
          condition: ["due_monitor", "condition_alert"].includes(form.category) ? form.condition : null,
          intelligence: form.intelligence,
          actions: buildActions(),
          enabled: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Automation created");
      setModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error.message || "Could not create automation");
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomation = async (automation) => {
    try {
      const response = await fetch(`${API_URL}/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !automation.enabled }),
      });
      if (!response.ok) throw new Error();
      toast.success(automation.enabled ? "Automation paused" : "Automation activated");
      await loadData();
    } catch {
      toast.error("Could not update automation");
    }
  };

  const runAutomation = async (automation) => {
    try {
      setRunningId(automation.id);
      const response = await fetch(`${API_URL}/automations/${automation.id}/run`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`Run complete: ${data.report.totalRowsChecked} rows checked`);
      await loadData();
    } catch (error) {
      toast.error(error.message || "Automation run failed");
    } finally {
      setRunningId(null);
    }
  };

  const deleteAutomation = async (automation) => {
    try {
      setDeleting(true);
      const response = await fetch(`${API_URL}/automations/${automation.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Automation deleted");
      setDeleteConfirm(null);
      await loadData();
    } catch {
      toast.error("Could not delete automation");
    } finally {
      setDeleting(false);
    }
  };

  const sheetNames = (ids) =>
    ids.map((id) => documents.find((doc) => doc.id === id)?.name).filter(Boolean).join(", ") || "No sheet";

  const actionSummary = (automation) => (automation.actions || [])
    .filter((action) => action.enabled !== false)
    .map((action) => actionLabels[action.type] || action.type)
    .join(", ");

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 newq sm:px-6 lg:px-8 lg:py-8" style={{ background: darkMode ? "linear-gradient(180deg,#111318,#0c0d10)" : "linear-gradient(180deg,#f7f6f2,#f3f1ea)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between mb-8">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${muted}`}>Automation studio</p>
            <h2 className={`text-2xl small font-semibold sm:text-3xl md:text-4xl ${darkMode ? "text-white" : "text-black"}`}>Turn sheet data into action</h2>
            <p className={`text-sm mt-4 max-w-2xl ${muted}`}>
              Choose a purpose, add AI if useful, then decide whether it should notify, report, email, or run row-level actions.
            </p>
          </div>
          <button onClick={openBuilder} disabled={documents.length === 0} className={`flex w-full items-center justify-center gap-2 px-5 py-3 rounded-full disabled:opacity-40 sm:w-auto ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
            <Plus className="w-4 h-4" /> New automation
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[
            [Workflow, "Active workflows", stats.active],
            [Bot, "AI-enabled", stats.ai],
            [Sparkles, "Configured actions", stats.actions],
          ].map(([Icon, label, value]) => (
            <div key={label} className={`rounded-[26px] p-5 ${panel}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${muted}`}>{label}</span>
                <Icon className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-black/45"}`} />
              </div>
              <p className={`text-3xl mt-5 font-semibold ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
            </div>
          ))}
        </div>

        {integrations && (
          <div className={`rounded-[24px] p-5 mb-6 grid md:grid-cols-3 gap-3 ${panel}`}>
            <div>
              <p className={`text-xs uppercase tracking-wider ${muted}`}>Email sending</p>
              <p className={`text-sm mt-2 ${integrations.smtp?.verified ? "text-green-500" : "text-amber-500"}`}>
                {integrations.smtp?.verified ? `Ready from ${integrations.smtp.from}` : integrations.smtp?.configured ? "SMTP configured but not verified" : "SMTP not configured"}
              </p>
              {integrations.smtp?.error && <p className={`text-xs mt-1 ${muted}`}>{integrations.smtp.error}</p>}
            </div>
            <div>
              <p className={`text-xs uppercase tracking-wider ${muted}`}>AI provider</p>
              <p className={`text-sm mt-2 ${darkMode ? "text-white" : "text-black"}`}>
                {integrations.ai?.claudeConfigured ? "Claude ready" : integrations.ai?.groqConfigured ? "Groq fallback ready" : "No AI key configured"}
              </p>
            </div>
            <div>
              <p className={`text-xs uppercase tracking-wider ${muted}`}>Safe default</p>
              <p className={`text-sm mt-2 ${darkMode ? "text-white" : "text-black"}`}>New workflows notify and save reports unless email actions are selected.</p>
            </div>
          </div>
        )}

        <div className={`rounded-[30px] overflow-hidden ${panel}`}>
          <div className={`px-6 py-5 border-b ${darkMode ? "border-white/10" : "border-black/5"}`}>
            <h3 className={`text-xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>Workflows</h3>
            <p className={`text-xs mt-1 ${muted}`}>Run now, pause, or let the schedule handle it.</p>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className={`w-7 h-7 animate-spin ${muted}`} /></div>
          ) : automations.length === 0 ? (
            <div className="py-20 text-center px-6">
              <Workflow className={`w-10 h-10 mx-auto mb-4 ${muted}`} />
              <p className={`text-lg ${darkMode ? "text-white" : "text-black"}`}>No automations yet</p>
              <p className={`text-sm mt-2 ${muted}`}>{documents.length ? "Create your first workflow from a connected sheet." : "Connect a ready Google Sheet first."}</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {automations.map((automation) => {
                const category = categories[automation.category] || categories.scheduled_summary;
                const Icon = category.icon;
                return (
                  <div key={automation.id} className="p-6 flex flex-col gap-5 xl:flex-row xl:items-center">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${darkMode ? "bg-[#d8f36a]/10" : "bg-black/[0.04]"}`}>
                      <Icon className={`w-5 h-5 ${darkMode ? "text-[#d8f36a]" : "text-black/60"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className={`font-medium ${darkMode ? "text-white" : "text-black"}`}>{automation.name}</h4>
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500">{category.title}</span>
                        {automation.intelligence?.useAi && <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-500">AI</span>}
                      </div>
                      <p className={`text-sm mt-2 truncate ${muted}`}>{sheetNames(automation.documentIds || [])}</p>
                      <div className={`flex flex-wrap gap-x-5 gap-y-2 text-xs mt-3 ${muted}`}>
                        <span className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" />{schedules[automation.trigger?.schedule]?.label || automation.scheduleCron}</span>
                        <span>{actionSummary(automation)}</span>
                        <span>Last run: {automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString() : "Not run yet"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                      <button onClick={() => toggleAutomation(automation)} className={`h-11 flex-1 rounded-full px-4 flex items-center justify-center gap-2 sm:flex-none ${darkMode ? "bg-white/5 text-white" : "bg-black/[0.04] text-black"}`}>
                        {automation.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 opacity-40" />}
                        {automation.enabled ? "Active" : "Paused"}
                      </button>
                      <button onClick={() => runAutomation(automation)} disabled={runningId === automation.id} className={`w-11 h-11 rounded-full flex items-center justify-center ${darkMode ? "bg-white/10 text-white" : "bg-black text-white"}`}>
                        {runningId === automation.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setDeleteConfirm(automation)} className="w-11 h-11 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-5">
          <div className={`w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-[24px] p-4 sm:rounded-[30px] sm:p-7 ${darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"}`}>
            <div className="flex items-start justify-between mb-7">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${muted}`}>New workflow</p>
                <h3 className={`text-2xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>Build an automation</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}><X className={`w-5 h-5 ${muted}`} /></button>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
              <div className="space-y-5">
                <div>
                  <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>1. What should this automation do?</span>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Object.entries(categories).map(([key, item]) => {
                      const Icon = item.icon;
                      const active = form.category === key;
                      return (
                        <button key={key} onClick={() => setCategory(key)} className={`text-left rounded-2xl p-4 border ${active ? (darkMode ? "border-[#d8f36a] bg-[#d8f36a]/8" : "border-black bg-black/[0.03]") : (darkMode ? "border-white/10" : "border-black/10")}`}>
                          <Icon className={`w-5 h-5 mb-3 ${active ? (darkMode ? "text-[#d8f36a]" : "text-black") : muted}`} />
                          <span className={`text-sm block ${darkMode ? "text-white" : "text-black"}`}>{item.title}</span>
                          <span className={`text-xs mt-1 block leading-5 ${muted}`}>{item.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label>
                  <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>Automation name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full rounded-2xl px-4 py-3 outline-none ${input}`} />
                </label>

                <div>
                  <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>2. Select sheets</span>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {documents.map((doc) => (
                      <button key={doc.id} onClick={() => toggleSheet(doc.id)} className={`text-left rounded-2xl p-4 border ${form.documentIds.includes(doc.id) ? (darkMode ? "border-[#d8f36a] bg-[#d8f36a]/8" : "border-black bg-black/[0.03]") : (darkMode ? "border-white/10" : "border-black/10")}`}>
                        <span className={`text-sm block ${darkMode ? "text-white" : "text-black"}`}>{doc.name}</span>
                        <span className={`text-xs mt-1 block ${muted}`}>{form.documentIds.includes(doc.id) ? "Selected" : "Click to include"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>3. Frequency</span>
                  <select value={form.scheduleKey} onChange={(e) => setForm({ ...form, scheduleKey: e.target.value })} className={`w-full rounded-2xl px-4 py-3 outline-none ${input}`}>
                    {Object.entries(schedules).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="space-y-5">
                {["due_monitor", "condition_alert"].includes(form.category) && (
                  <div>
                    <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>Condition</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input value={form.condition.column} onChange={(e) => setForm({ ...form, condition: { ...form.condition, column: e.target.value } })} placeholder="Column" className={`rounded-2xl px-4 py-3 outline-none ${input}`} />
                      <select value={form.condition.operator} onChange={(e) => setForm({ ...form, condition: { ...form.condition, operator: e.target.value } })} className={`rounded-2xl px-4 py-3 outline-none ${input}`}>
                        <option value="contains_any">contains any</option>
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="greater_than">greater than</option>
                        <option value="less_than">less than</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </select>
                      <input value={form.condition.value} onChange={(e) => setForm({ ...form, condition: { ...form.condition, value: e.target.value } })} placeholder="Value" className={`rounded-2xl px-4 py-3 outline-none ${input}`} />
                    </div>
                  </div>
                )}

                <div>
                  <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>AI intelligence</span>
                  <button onClick={() => setForm({ ...form, intelligence: { ...form.intelligence, useAi: !form.intelligence.useAi } })} className={`w-full text-left rounded-2xl p-4 border ${form.intelligence.useAi ? "border-purple-500/40 bg-purple-500/10" : darkMode ? "border-white/10" : "border-black/10"}`}>
                    <span className={`text-sm block ${darkMode ? "text-white" : "text-black"}`}>{form.intelligence.useAi ? "AI is enabled" : "AI is off"}</span>
                    <span className={`text-xs mt-1 block ${muted}`}>Uses Claude when configured, otherwise Groq fallback.</span>
                  </button>
                  {form.intelligence.useAi && (
                    <textarea value={form.intelligence.prompt} onChange={(e) => setForm({ ...form, intelligence: { ...form.intelligence, prompt: e.target.value } })} rows={4} className={`w-full mt-2 rounded-2xl px-4 py-3 outline-none ${input}`} />
                  )}
                </div>

                <div>
                  <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>Actions</span>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(actionLabels).map(([type, label]) => (
                      <button key={type} onClick={() => toggleAction(type)} className={`rounded-2xl p-4 text-left border ${form.actions.includes(type) ? (darkMode ? "border-[#d8f36a] bg-[#d8f36a]/8" : "border-black bg-black/[0.03]") : (darkMode ? "border-white/10" : "border-black/10")}`}>
                        <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.actions.includes("email_summary") && (
                  <label>
                    <span className={`text-xs uppercase tracking-wider block mb-2 ${muted}`}>Summary email recipients</span>
                    <input value={form.summaryRecipients} onChange={(e) => setForm({ ...form, summaryRecipients: e.target.value })} placeholder="you@example.com" className={`w-full rounded-2xl px-4 py-3 outline-none ${input}`} />
                  </label>
                )}

                {form.actions.includes("row_email") && (
                  <div className="space-y-2">
                    <input value={form.rowEmailColumn} onChange={(e) => setForm({ ...form, rowEmailColumn: e.target.value })} placeholder="Email column" className={`w-full rounded-2xl px-4 py-3 outline-none ${input}`} />
                    <input value={form.rowEmailSubject} onChange={(e) => setForm({ ...form, rowEmailSubject: e.target.value })} placeholder="Subject template" className={`w-full rounded-2xl px-4 py-3 outline-none ${input}`} />
                    <textarea value={form.rowEmailBody} onChange={(e) => setForm({ ...form, rowEmailBody: e.target.value })} rows={4} className={`w-full rounded-2xl px-4 py-3 outline-none ${input}`} />
                    <p className={`text-xs ${muted}`}>Use column tokens like {"{{Client Name}}"} or {"{{Invoice #}}"}. Row emails are real sends through SMTP.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-7 sm:flex-row">
              <button onClick={() => setModalOpen(false)} className={`flex-1 py-3 rounded-full ${darkMode ? "bg-white/5 text-white" : "bg-black/[0.04] text-black"}`}>Cancel</button>
              <button onClick={createAutomation} disabled={saving} className={`flex-1 py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Create workflow
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title="Delete automation"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This workflow will stop running.`}
        loading={deleting}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => deleteAutomation(deleteConfirm)}
      />
    </div>
  );
}
