import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  Check,
  Clock3,
  FileText,
  Loader2,
  Mail,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, Chip, ConfirmModal, EmptyState, FeatureCard, IconTile, PageHeader, Select, StatTile, Toggle } from "./ui";
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
    tone: "lavender",
    icon: Bot,
    defaults: ["notification", "save_report"],
    ai: true,
  },
  scheduled_report: {
    title: "Scheduled report",
    text: "Create a date-wise report and optionally email it to you.",
    tone: "sky",
    icon: FileText,
    defaults: ["notification", "save_report", "email_summary"],
    ai: true,
  },
  due_monitor: {
    title: "Pending dues monitor",
    text: "Watch due/status rows and alert or send customer emails.",
    tone: "peach",
    icon: Mail,
    defaults: ["notification", "save_report"],
    ai: false,
  },
  condition_alert: {
    title: "Custom condition alert",
    text: "When a column matches your rule, notify or act.",
    tone: "amber",
    icon: Bell,
    defaults: ["notification", "save_report"],
    ai: false,
  },
  ai_watch: {
    title: "AI watchlist",
    text: "Ask AI to inspect the sheet for a custom risk or opportunity.",
    tone: "mint",
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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const input = `w-full border text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`;

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

  const ink = darkMode ? "text-white" : "text-[#141414]";
  const choice = (active) => (active
    ? darkMode ? "border-[#cff07a]/50 bg-[#cff07a]/10" : "border-[#141414] bg-white"
    : darkMode ? "border-white/10 hover:bg-white/[0.04]" : "border-[#ececec] hover:bg-[#f7f7f5]");
  const stepLabel = `mb-2 block text-[12.5px] ${muted}`;

  return (
    <div className={`flex-1 overflow-y-auto px-4 py-5 newq sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          darkMode={darkMode}
          badge="Automation studio"
          badgeIcon={Workflow}
          badgeTone="lavender"
          title="Automations"
          subtitle="turn sheet data into action"
          description="Choose a purpose, add AI if useful, then decide whether it should notify, report, email, or run row-level actions."
          actions={(
            <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={openBuilder} disabled={documents.length === 0}>
              New automation
            </Button>
          )}
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatTile darkMode={darkMode} icon={Workflow} tone="mint" value={stats.active} label="Active workflows" />
          <StatTile darkMode={darkMode} icon={Bot} tone="lavender" value={stats.ai} label="AI-enabled" />
          <StatTile darkMode={darkMode} icon={Sparkles} tone="peach" value={stats.actions} label="Configured actions" />
        </div>

        {integrations && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FeatureCard
              darkMode={darkMode}
              icon={Mail}
              tone="sky"
              index={1}
              title="Email sending"
              text={integrations.smtp?.verified ? `Ready from ${integrations.smtp.from}` : integrations.smtp?.configured ? "SMTP configured but not verified" : "SMTP not configured"}
              footer={integrations.smtp?.error || null}
            >
              <div className="mt-3">
                <Chip darkMode={darkMode} tone={integrations.smtp?.verified ? "mint" : "amber"} className="h-6 px-2.5 text-[12px]">
                  {integrations.smtp?.verified ? "Ready" : "Needs setup"}
                </Chip>
              </div>
            </FeatureCard>
            <FeatureCard
              darkMode={darkMode}
              icon={Bot}
              tone="lavender"
              index={2}
              title="AI provider"
              text={integrations.ai?.claudeConfigured ? "Claude ready" : integrations.ai?.groqConfigured ? "Groq fallback ready" : "No AI key configured"}
            />
            <FeatureCard
              darkMode={darkMode}
              icon={ShieldCheck}
              tone="mint"
              index={3}
              title="Safe default"
              text="New workflows notify and save reports unless email actions are selected."
            />
          </div>
        )}

        <section className={`mt-8 rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
          <div className={`flex items-center gap-3.5 border-b px-5 py-4 sm:px-6 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
            <IconTile icon={Workflow} tone="neutral" darkMode={darkMode} size="sm" />
            <div>
              <h3 className={`text-[17px] leading-tight ${ink}`}>Workflows</h3>
              <p className={`mt-0.5 text-[12.5px] ${muted}`}>Run now, pause, or let the schedule handle it.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className={`h-7 w-7 animate-spin ${muted}`} /></div>
          ) : automations.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                darkMode={darkMode}
                icon={Workflow}
                tone="lavender"
                title="No automations yet"
                text={documents.length ? "Create your first workflow from a connected sheet." : "Connect a ready Google Sheet first."}
              />
            </div>
          ) : (
            <div className={`divide-y ${darkMode ? "divide-white/[0.07]" : "divide-[#f0f0ee]"}`}>
              {automations.map((automation) => {
                const category = categories[automation.category] || categories.scheduled_summary;
                return (
                  <div key={automation.id} className="flex flex-col gap-4 px-5 py-5 sm:px-6 xl:flex-row xl:items-center">
                    <IconTile icon={category.icon} tone={category.tone} darkMode={darkMode} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`text-[15px] ${ink}`}>{automation.name}</h4>
                        <Chip darkMode={darkMode} tone={category.tone} className="h-6 px-2.5 text-[12px]">{category.title}</Chip>
                        {automation.intelligence?.useAi && <Chip darkMode={darkMode} tone="lavender" icon={Sparkles} className="h-6 px-2.5 text-[12px]">AI</Chip>}
                      </div>
                      <p className={`mt-1.5 truncate text-[13px] ${muted}`}>{sheetNames(automation.documentIds || [])}</p>
                      <div className={`mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] ${muted}`}>
                        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{schedules[automation.trigger?.schedule]?.label || automation.scheduleCron}</span>
                        <span>{actionSummary(automation)}</span>
                        <span>Last run: {automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString() : "Not run yet"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                      <span className={`flex h-10 items-center gap-2.5 rounded-full pl-4 pr-2 text-[13px] ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                        {automation.enabled ? "Active" : "Paused"}
                        <Toggle darkMode={darkMode} checked={automation.enabled} onChange={() => toggleAutomation(automation)} label={automation.enabled ? "Pause automation" : "Activate automation"} />
                      </span>
                      <button
                        type="button"
                        onClick={() => runAutomation(automation)}
                        disabled={runningId === automation.id}
                        aria-label="Run now"
                        title="Run now"
                        className={`grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-60 ${darkMode ? "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
                      >
                        {runningId === automation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(automation)}
                        aria-label="Delete automation"
                        title="Delete"
                        className={`grid h-10 w-10 place-items-center rounded-full transition ${darkMode ? "bg-rose-400/10 text-rose-200 hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d5d9]"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 sm:p-5">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border newq ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
              <div className="flex min-w-0 items-start gap-3">
                <IconTile icon={Workflow} tone="lavender" darkMode={darkMode} size="sm" />
                <div>
                  <h3 className="text-[17px] leading-tight">Build an automation</h3>
                  <p className={`mt-1 text-[12.5px] ${muted}`}>New workflow · purpose, sheets, schedule and actions</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
              <div className="space-y-6">
                <div>
                  <span className={stepLabel}>01 · What should this automation do?</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(categories).map(([key, item]) => {
                      const active = form.category === key;
                      return (
                        <button key={key} type="button" onClick={() => setCategory(key)} className={`rounded-[16px] border p-4 text-left transition ${choice(active)}`}>
                          <IconTile icon={item.icon} tone={item.tone} darkMode={darkMode} size="xs" />
                          <span className={`mt-3 block text-[13.5px] ${ink}`}>{item.title}</span>
                          <span className={`mt-1 block text-[12px] leading-5 ${muted}`}>{item.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className={stepLabel}>Automation name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${input} h-11 rounded-full px-4`} />
                </label>

                <div>
                  <span className={stepLabel}>02 · Select sheets</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {documents.map((doc) => {
                      const picked = form.documentIds.includes(doc.id);
                      return (
                        <button key={doc.id} type="button" onClick={() => toggleSheet(doc.id)} className={`flex items-center gap-3 rounded-[16px] border p-3.5 text-left transition ${choice(picked)}`}>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${picked ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/20" : "border-[#cfcfcb]"}`}>
                            {picked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0">
                            <span className={`block truncate text-[13.5px] ${ink}`}>{doc.name}</span>
                            <span className={`mt-0.5 block text-[12px] ${muted}`}>{picked ? "Selected" : "Click to include"}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className={stepLabel}>03 · Frequency</span>
                  <Select darkMode={darkMode} value={form.scheduleKey} onChange={(e) => setForm({ ...form, scheduleKey: e.target.value })}>
                    {Object.entries(schedules).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                  </Select>
                </label>
              </div>

              <div className="space-y-6">
                {["due_monitor", "condition_alert"].includes(form.category) && (
                  <div>
                    <span className={stepLabel}>Condition</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input value={form.condition.column} onChange={(e) => setForm({ ...form, condition: { ...form.condition, column: e.target.value } })} placeholder="Column" className={`${input} h-10 rounded-full px-4`} />
                      <Select darkMode={darkMode} value={form.condition.operator} onChange={(e) => setForm({ ...form, condition: { ...form.condition, operator: e.target.value } })}>
                        <option value="contains_any">contains any</option>
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="greater_than">greater than</option>
                        <option value="less_than">less than</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </Select>
                      <input value={form.condition.value} onChange={(e) => setForm({ ...form, condition: { ...form.condition, value: e.target.value } })} placeholder="Value" className={`${input} h-10 rounded-full px-4`} />
                    </div>
                  </div>
                )}

                <div>
                  <span className={stepLabel}>AI intelligence</span>
                  <div className={`flex items-center gap-3 rounded-[16px] p-4 ${form.intelligence.useAi ? (darkMode ? "bg-violet-400/[0.12]" : "bg-[#ece8fb]") : darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                    <Bot className={`h-5 w-5 shrink-0 ${form.intelligence.useAi ? (darkMode ? "text-[#c9b9fb]" : "text-[#6b4fd1]") : muted}`} strokeWidth={1.8} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13.5px] ${ink}`}>{form.intelligence.useAi ? "AI is enabled" : "AI is off"}</span>
                      <span className={`mt-0.5 block text-[12px] ${muted}`}>Uses Claude when configured, otherwise Groq fallback.</span>
                    </span>
                    <Toggle darkMode={darkMode} checked={form.intelligence.useAi} onChange={() => setForm({ ...form, intelligence: { ...form.intelligence, useAi: !form.intelligence.useAi } })} label="Use AI" />
                  </div>
                  {form.intelligence.useAi && (
                    <textarea value={form.intelligence.prompt} onChange={(e) => setForm({ ...form, intelligence: { ...form.intelligence, prompt: e.target.value } })} rows={4} className={`${input} mt-2 rounded-[16px] px-4 py-3`} />
                  )}
                </div>

                <div>
                  <span className={stepLabel}>Actions</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(actionLabels).map(([type, label]) => {
                      const on = form.actions.includes(type);
                      return (
                        <button key={type} type="button" onClick={() => toggleAction(type)} className={`flex items-center gap-3 rounded-full border px-4 py-2.5 text-left transition ${choice(on)}`}>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/20" : "border-[#cfcfcb]"}`}>
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span className={`text-[13px] ${ink}`}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.actions.includes("email_summary") && (
                  <label className="block">
                    <span className={stepLabel}>Summary email recipients</span>
                    <input value={form.summaryRecipients} onChange={(e) => setForm({ ...form, summaryRecipients: e.target.value })} placeholder="you@example.com" className={`${input} h-11 rounded-full px-4`} />
                  </label>
                )}

                {form.actions.includes("row_email") && (
                  <div className="space-y-2">
                    <input value={form.rowEmailColumn} onChange={(e) => setForm({ ...form, rowEmailColumn: e.target.value })} placeholder="Email column" className={`${input} h-11 rounded-full px-4`} />
                    <input value={form.rowEmailSubject} onChange={(e) => setForm({ ...form, rowEmailSubject: e.target.value })} placeholder="Subject template" className={`${input} h-11 rounded-full px-4`} />
                    <textarea value={form.rowEmailBody} onChange={(e) => setForm({ ...form, rowEmailBody: e.target.value })} rows={4} className={`${input} rounded-[16px] px-4 py-3`} />
                    <p className={`text-[12px] ${muted}`}>Use column tokens like {"{{Client Name}}"} or {"{{Invoice #}}"}. Row emails are real sends through SMTP.</p>
                  </div>
                )}
              </div>
            </div>
            </div>

            <div className={`flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button darkMode={darkMode} variant="primary" size="lg" icon={Sparkles} loading={saving} onClick={createAutomation} disabled={saving}>Create workflow</Button>
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
