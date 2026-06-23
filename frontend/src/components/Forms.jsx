"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, ClipboardList, FilePlus2, History, Loader2, Plus, RefreshCw, Settings2, Sheet, Users, X } from "lucide-react";
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

const blankField = () => ({ key: `field_${Date.now()}`, label: "", type: "text", required: false, options: [], sheetColumn: "" });
const blankForm = () => ({ name: "", department: "", description: "", fields: [blankField()], allowedUserIds: [], spreadsheet: { spreadsheetId: "", sheetName: "Form responses 1" }, isActive: true });

function Modal({ darkMode, title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full ${wide ? "max-w-5xl" : "max-w-2xl"} overflow-y-auto rounded-[28px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-black/5 bg-white text-black"}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h3 className="small text-2xl font-semibold">{title}</h3><p className={`mt-1 text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>{subtitle}</p></div>
          <button type="button" onClick={onClose} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ darkMode, className = "", ...props }) {
  return <input {...props} className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10"} ${className}`} />;
}

function Select({ darkMode, children, ...props }) {
  return <select {...props} className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-[#191b20] text-white" : "border-black/10 bg-white text-black"}`}>{children}</select>;
}

function DynamicField({ field, value, onChange, darkMode, isLast }) {
  const common = { id: field.key, name: field.key, required: field.required, value: value ?? "", onChange: (event) => onChange(field.key, event.target.value) };
  
  let inputElement;
  if (field.type === "textarea") {
    inputElement = <textarea {...common} rows={4} className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${darkMode ? "border-white/10 bg-[#15171c] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25 hover:bg-white/10" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10 hover:bg-black/[0.03]"}`} />;
  } else if (field.type === "select") {
    inputElement = (
      <SelectMenu
        darkMode={darkMode}
        value={value ?? ""}
        onChange={(v) => onChange(field.key, v)}
        options={(field.options || []).map((o) => ({ value: o, label: o }))}
        placeholder={`Select ${field.label.toLowerCase()}`}
      />
    );
  } else {
    inputElement = <Input darkMode={darkMode} {...common} type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"} min={field.min} max={field.max} step={field.type === "number" ? "0.01" : undefined} />;
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[1.2fr_2fr] gap-4 md:gap-8 py-8 ${isLast ? "" : darkMode ? "border-b border-white/5" : "border-b border-black/[0.05]"}`}>
      <div>
        <label htmlFor={field.key} className={`block text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
          {field.label} {field.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <p className={`mt-1.5 text-sm ${darkMode ? "text-white/50" : "text-black/50"}`}>
          {field.description || `Provide your ${field.label.toLowerCase()} here.`}
        </p>
      </div>
      <div>
        {inputElement}
      </div>
    </div>
  );
}

export default function Forms({ darkMode }) {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => forms.reduce((result, form) => {
    (result[form.department] ||= []).push(form);
    return result;
  }, {}), [forms]);

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const requests = [api("/forms")];
        if (user?.isSuperAdmin) requests.push(api("/forms/admin/users"));
        const [formsData, usersData] = await Promise.all(requests);
        if (cancelled) return;
        setForms(formsData.forms || []);
        setUsers(usersData?.users || []);
      } catch (error) {
        if (!cancelled) toast.error(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialLoad();
    return () => { cancelled = true; };
  }, [user?.isSuperAdmin]);

  async function load() {
    try {
      setLoading(true);
      const requests = [api("/forms")];
      if (user?.isSuperAdmin) requests.push(api("/forms/admin/users"));
      const [formsData, usersData] = await Promise.all(requests);
      setForms(formsData.forms || []);
      setUsers(usersData?.users || []);
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }

  function openForm(form) {
    setSelected(form);
    setAnswers({ requester_name: user?.displayName || "" });
    setShowHistory(false);
    setSubmissions([]);
  }

  async function loadHistory(form = selected) {
    if (!form) return;
    try {
      const data = await api(`/forms/${form.id}/submissions`);
      setSubmissions(data.submissions || []);
      setShowHistory(true);
    } catch (error) { toast.error(error.message); }
  }

  async function submit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      const data = await api(`/forms/${selected.id}/submissions`, { method: "POST", body: JSON.stringify({ answers }) });
      toast.success(data.submission.syncStatus === "failed" ? "Saved; Sheet sync needs attention" : "Request submitted");
      setAnswers({ requester_name: user?.displayName || "" });
      await loadHistory(selected);
    } catch (error) { toast.error(error.message); }
    finally { setSubmitting(false); }
  }

  async function retrySync(submission) {
    try {
      await api(`/forms/${selected.id}/submissions/${submission.id}/retry`, { method: "POST" });
      toast.success("Synced to Google Sheets");
      await loadHistory(selected);
    } catch (error) { toast.error(error.message); }
  }

  function openEditor(form = null) {
    setEditor(form ? JSON.parse(JSON.stringify(form)) : blankForm());
  }

  function updateField(index, patch) {
    setEditor((current) => ({ ...current, fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field) }));
  }

  async function saveForm(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = { ...editor, fields: editor.fields.map((field) => ({ ...field, key: field.key || field.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), sheetColumn: field.sheetColumn || field.label })) };
      await api(editor.id ? `/forms/${editor.id}` : "/forms", { method: editor.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast.success(editor.id ? "Form updated" : "Form created");
      setEditor(null);
      await load();
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/5 bg-white/80";

  if (loading) return <div className={`flex flex-1 items-center justify-center ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-black"}`}><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-black"}`}>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className={`mb-2 text-[11px] uppercase tracking-[0.3em] ${muted}`}>Department workspace</p><h2 className="small text-3xl font-semibold">Forms</h2><p className={`mt-2 text-sm ${muted}`}>Submit requests and track responses from one place.</p></div>
          {user?.isSuperAdmin && <button onClick={() => openEditor()} className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}><FilePlus2 className="h-4 w-4" /> Create form</button>}
        </div>

        {!forms.length ? (
          <div className={`rounded-[28px] border p-12 text-center ${panel}`}><ClipboardList className={`mx-auto h-9 w-9 ${muted}`} /><h3 className="mt-4 text-lg font-medium">No forms assigned</h3><p className={`mt-2 text-sm ${muted}`}>Ask the Super Admin to provide access to a form.</p></div>
        ) : Object.entries(grouped).map(([department, departmentForms]) => (
          <section key={department} className="mb-8">
            <div className="mb-3 flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-black/5 text-black/60"}`}>{department}</span><span className={`text-xs ${muted}`}>{departmentForms.length} form{departmentForms.length === 1 ? "" : "s"}</span></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {departmentForms.map((form) => (
                <div key={form.id} className={`group rounded-[26px] border p-5 ${panel}`}>
                  <div className="flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? "bg-white/5 text-[#d8f36a]" : "bg-black/[0.04] text-black/60"}`}><ClipboardList className="h-5 w-5" /></span>{user?.isSuperAdmin && <button onClick={() => openEditor(form)} className={`flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/10 text-white/55" : "hover:bg-black/5 text-black/45"}`}><Settings2 className="h-4 w-4" /></button>}</div>
                  <h3 className="mt-5 small text-xl font-semibold">{form.name}</h3><p className={`mt-2 min-h-10 text-sm leading-5 ${muted}`}>{form.description || "Department request form"}</p>
                  <div className="mt-5 flex items-center justify-between"><span className={`text-xs ${form.isActive ? "text-emerald-500" : "text-amber-500"}`}>{form.isActive ? "Active" : "Paused"}</span><button disabled={!form.isActive} onClick={() => openForm(form)} className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm disabled:opacity-40 ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}>Open <ChevronRight className="h-4 w-4" /></button></div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected && <Modal darkMode={darkMode} title={selected.name} subtitle={`${selected.department} · ${showHistory ? "Submission history" : "New submission"}`} onClose={() => setSelected(null)} wide>
        <div className={`mb-5 grid grid-cols-2 rounded-2xl p-1 ${darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}>
          <button type="button" onClick={() => setShowHistory(false)} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm ${!showHistory ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : muted}`}><Plus className="h-4 w-4" /> New request</button>
          <button type="button" onClick={() => loadHistory()} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm ${showHistory ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : muted}`}><History className="h-4 w-4" /> Submissions</button>
        </div>
        {!showHistory ? <form onSubmit={submit} className="flex flex-col">
          <div className="flex-1">
            {(selected.fields || []).map((field, idx) => <DynamicField key={field.key} field={field} value={answers[field.key]} onChange={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))} darkMode={darkMode} isLast={idx === (selected.fields?.length || 0) - 1} />)}
          </div>
          <div className={`mt-4 flex items-center justify-between border-t pt-6 pb-2 ${darkMode ? "border-white/10" : "border-black/5"}`}>
            <button type="button" onClick={() => setSelected(null)} className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${darkMode ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"}`}>
              Back: Summary
            </button>
            <button disabled={submitting} className={`flex h-11 items-center justify-center gap-2 rounded-full px-8 text-sm font-medium transition disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#cbf03e]" : "bg-black text-white hover:bg-black/80"}`}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next: Application"}
            </button>
          </div>
        </form> : <div className="space-y-3">
          {!submissions.length && <div className={`rounded-2xl border p-8 text-center text-sm ${panel} ${muted}`}>No submissions yet.</div>}
          {submissions.map((submission) => <div key={submission.id} className={`rounded-2xl border p-4 ${panel}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{submission.answers?.description || submission.formName}</p><p className={`mt-1 text-xs ${muted}`}>{new Date(submission.createdAt).toLocaleString()} · {submission.submittedByName}</p>{submission.syncStatus === "failed" && submission.syncError && <p className="mt-2 text-xs text-red-500">{submission.syncError}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs ${submission.syncStatus === "synced" ? "bg-emerald-500/10 text-emerald-500" : submission.syncStatus === "failed" ? "bg-red-500/10 text-red-500" : darkMode ? "bg-white/5 text-white/50" : "bg-black/5 text-black/50"}`}>{submission.syncStatus === "not_configured" ? "Saved" : submission.syncStatus}</span>{user?.isSuperAdmin && submission.syncStatus === "failed" && <button type="button" onClick={() => retrySync(submission)} className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs ${darkMode ? "bg-white/10 text-white" : "bg-black/5 text-black"}`}><RefreshCw className="h-3.5 w-3.5" /> Retry</button>}</div></div></div>)}
        </div>}
      </Modal>}

      {editor && <Modal darkMode={darkMode} title={editor.id ? "Manage form" : "Create form"} subtitle="Configure fields, access, and the destination Google Sheet." onClose={() => setEditor(null)} wide>
        <form onSubmit={saveForm} className="flex flex-col">
          <div className="flex-1">
            {/* General Details */}
            <div className={`grid grid-cols-1 md:grid-cols-[1.2fr_2fr] gap-4 md:gap-8 py-8 ${darkMode ? "border-b border-white/5" : "border-b border-black/[0.05]"}`}>
              <div>
                <h4 className={`text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>General details</h4>
                <p className={`mt-1.5 text-sm ${darkMode ? "text-white/50" : "text-black/50"}`}>Basic information about this form.</p>
              </div>
              <div className="space-y-4">
                <Input darkMode={darkMode} placeholder="Form name" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} required />
                <Input darkMode={darkMode} placeholder="Department" value={editor.department} onChange={(e) => setEditor({ ...editor, department: e.target.value })} required />
                <textarea className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${darkMode ? "border-white/10 bg-[#15171c] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25 hover:bg-white/10" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10 hover:bg-black/[0.03]"}`} rows={3} placeholder="Description" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
              </div>
            </div>

            {/* Form Fields */}
            <div className={`grid grid-cols-1 md:grid-cols-[1.2fr_2fr] gap-4 md:gap-8 py-8 ${darkMode ? "border-b border-white/5" : "border-b border-black/[0.05]"}`}>
              <div>
                <h4 className={`text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>Form fields</h4>
                <p className={`mt-1.5 text-sm ${darkMode ? "text-white/50" : "text-black/50"}`}>Define the inputs your users will fill out.</p>
              </div>
              <div>
                <div className="space-y-3">
                  {editor.fields.map((field, index) => (
                    <div key={`${field.key}-${index}`} className={`grid gap-3 rounded-[20px] border p-4 sm:grid-cols-[1.4fr_1fr_1.2fr_auto] ${panel}`}>
                      <Input darkMode={darkMode} placeholder="Field label" value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} required />
                      <SelectMenu
                        darkMode={darkMode}
                        value={field.type}
                        onChange={(v) => updateField(index, { type: v })}
                        options={["text", "textarea", "number", "date", "select", "url", "email"].map((type) => ({ value: type, label: type }))}
                      />
                      {field.type === "select" ? (
                        <Input darkMode={darkMode} placeholder="Options, comma separated" value={(field.options || []).join(", ")} onChange={(e) => updateField(index, { options: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                      ) : (
                        <Input darkMode={darkMode} placeholder="Sheet column" value={field.sheetColumn || ""} onChange={(e) => updateField(index, { sheetColumn: e.target.value })} />
                      )}
                      <div className="flex items-center gap-2">
                        <label className={`flex items-center gap-2 text-xs ${muted}`}><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} /> Required</label>
                        <button type="button" onClick={() => setEditor({ ...editor, fields: editor.fields.filter((_, i) => i !== index) })} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10"><X className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setEditor({ ...editor, fields: [...editor.fields, blankField()] })} className={`mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-medium transition ${darkMode ? "border-white/10 text-white hover:bg-white/5" : "border-black/10 text-black hover:bg-black/5"}`}>
                  <Plus className="h-4 w-4" /> Add field
                </button>
              </div>
            </div>

            {/* Access & Integration */}
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr] gap-4 md:gap-8 py-8">
              <div>
                <h4 className={`text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>Configuration</h4>
                <p className={`mt-1.5 text-sm ${darkMode ? "text-white/50" : "text-black/50"}`}>Access control and sheet bindings.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className={`mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] ${muted}`}><Users className="h-4 w-4" /> User access</p>
                  <div className={`max-h-52 overflow-y-auto rounded-[20px] border p-2 ${panel}`}>
                    {users.filter((item) => !item.isSuperAdmin).map((item) => {
                      const active = editor.allowedUserIds.includes(item.id);
                      return (
                        <button type="button" key={item.id} onClick={() => setEditor({ ...editor, allowedUserIds: active ? editor.allowedUserIds.filter((id) => id !== item.id) : [...editor.allowedUserIds, item.id] })} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${active ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : darkMode ? "hover:bg-white/5" : "hover:bg-black/[0.03]"}`}>
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border">{active && <Check className="h-3 w-3" />}</span>
                          <span><span className="block text-sm">{item.displayName}</span><span className="block text-xs opacity-55">{item.username}</span></span>
                        </button>
                      );
                    })}
                    {!users.filter((item) => !item.isSuperAdmin).length && <p className={`p-3 text-sm ${muted}`}>Create users in Manage Roles first.</p>}
                  </div>
                </div>
                <div>
                  <p className={`mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] ${muted}`}><Sheet className="h-4 w-4" /> Google Sheet</p>
                  <div className={`space-y-3 rounded-[20px] border p-4 ${panel}`}>
                    <Input darkMode={darkMode} placeholder="Spreadsheet URL or ID (optional)" value={editor.spreadsheet?.spreadsheetId || ""} onChange={(e) => setEditor({ ...editor, spreadsheet: { ...editor.spreadsheet, spreadsheetId: e.target.value } })} />
                    <Input darkMode={darkMode} placeholder="Sheet tab name (first tab used if missing)" value={editor.spreadsheet?.sheetName || ""} onChange={(e) => setEditor({ ...editor, spreadsheet: { ...editor.spreadsheet, sheetName: e.target.value } })} />
                    <label className={`flex items-center gap-2 text-sm ${muted}`}>
                      <input type="checkbox" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} className="rounded" /> Form is active
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className={`mt-4 flex items-center justify-between border-t pt-6 pb-2 ${darkMode ? "border-white/10" : "border-black/5"}`}>
            <button type="button" onClick={() => setEditor(null)} className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${darkMode ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"}`}>
              Cancel
            </button>
            <button disabled={saving} className={`flex h-11 items-center justify-center gap-2 rounded-full px-8 text-sm font-medium transition disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#cbf03e]" : "bg-black text-white hover:bg-black/80"}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />} {editor.id ? "Save changes" : "Create form"}
            </button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
