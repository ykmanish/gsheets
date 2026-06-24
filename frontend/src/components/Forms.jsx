"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CheckCircle2, ChevronRight, Clipboard, ClipboardList, Copy, FilePenLine, FilePlus2, History, LayoutList, Link2, Loader2, Plus, RefreshCw, Save, Settings2, Sheet, Sparkles, Table2, Trash2, Users, X } from "lucide-react";
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
const blankForm = () => ({ name: "", department: "", description: "", fields: [blankField()], allowedUserIds: [], spreadsheet: { spreadsheetId: "", sheetName: "" }, isActive: true });
const FORM_LOADING_STEPS = [
  { title: "Loading your forms", detail: "Checking assigned forms and department access.", icon: ClipboardList },
  { title: "Preparing connected sheets", detail: "Getting your response destinations ready.", icon: Sheet },
];

function Modal({ darkMode, title, subtitle, onClose, children, wide = false, eyebrow, scrollBody = true }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
      <div className={`flex max-h-[92vh] w-full flex-col ${wide ? "max-w-6xl" : "max-w-2xl"} overflow-hidden rounded-[30px] border -[0_30px_90px_rgba(0,0,0,.28)] ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-[#faf9f5] text-[#171714]"}`}>
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
          <div>
            {eyebrow && <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>{eyebrow}</p>}
            <h3 className="small text-2xl font-semibold">{title}</h3>
            <p className={`mt-1 max-w-2xl text-sm ${darkMode ? "text-white/48" : "text-black/48"}`}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}><X className="h-4 w-4" /></button>
        </div>
        <div className={`min-h-0 ${scrollBody ? "overflow-y-auto" : "overflow-hidden"}`}>{children}</div>
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
  const searchParams = useSearchParams();
  const requestedFormId = searchParams.get("form");
  const accessKey = searchParams.get("access");
  const [forms, setForms] = useState([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [formWorkbook, setFormWorkbook] = useState(null);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editorSection, setEditorSection] = useState("details");
  const [copiedUserId, setCopiedUserId] = useState("");
  const [workbook, setWorkbook] = useState(null);
  const [loadingWorkbook, setLoadingWorkbook] = useState(false);
  const [sheetMode, setSheetMode] = useState("choose");
  const [sheetData, setSheetData] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [rowDraft, setRowDraft] = useState([]);
  const [savingRow, setSavingRow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const requests = [api("/forms")];
        if (user?.isSuperAdmin) requests.push(api("/forms/admin/users"));
        const [formsData, usersData] = await Promise.all(requests);
        if (cancelled) return;
        const loadedForms = formsData.forms || [];
        setForms(loadedForms);
        setUsers(usersData?.users || []);
        const requested = requestedFormId ? loadedForms.find((form) => form.id === requestedFormId) : null;
        if (requested) {
          setSelected(requested);
          setAnswers({ requester_name: user?.displayName || "" });
          if (requested.spreadsheet?.spreadsheetId) {
            setLoadingSheets(true);
            try {
              const workbookData = await api(`/forms/${requested.id}/sheets`, { headers: accessKey ? { "X-Form-Access-Key": accessKey } : {} });
              if (cancelled) return;
              setFormWorkbook(workbookData);
              if (workbookData.sheets?.length === 1) {
                setSelectedSheet(workbookData.sheets[0]);
                setSheetMode("actions");
              }
            } finally {
              if (!cancelled) setLoadingSheets(false);
            }
          }
        }
      } catch (error) {
        if (!cancelled) toast.error(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialLoad();
    return () => { cancelled = true; };
  }, [accessKey, requestedFormId, user?.displayName, user?.isSuperAdmin]);

  useEffect(() => {
    if (!loading) return undefined;
    const intervalId = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % FORM_LOADING_STEPS.length);
    }, 1700);
    return () => window.clearInterval(intervalId);
  }, [loading]);

  async function load() {
    try {
      setLoadingStep(0);
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
    setSelectedSheet(null);
    setFormWorkbook(null);
    setSheetMode("choose");
    setSheetData(null);
    setEditingRow(null);
    setAnswers({ requester_name: user?.displayName || "" });
    setShowHistory(false);
    setSubmissions([]);
    void loadFormSheets(form);
  }

  async function loadFormSheets(form) {
    if (!form?.spreadsheet?.spreadsheetId) return;
    try {
      setLoadingSheets(true);
      const data = await api(`/forms/${form.id}/sheets`, { headers: accessKey ? { "X-Form-Access-Key": accessKey } : {} });
      setFormWorkbook(data);
      if (data.sheets?.length === 1) {
        setSelectedSheet(data.sheets[0]);
        setSheetMode("actions");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingSheets(false);
    }
  }

  async function loadSheetRows(sheet = selectedSheet) {
    if (!selected || !sheet) return;
    try {
      setLoadingRows(true);
      const data = await api(`/forms/${selected.id}/sheets/${encodeURIComponent(sheet.title)}/rows`, { headers: accessKey ? { "X-Form-Access-Key": accessKey } : {} });
      setSheetData(data);
      setSheetMode("edit");
      setEditingRow(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingRows(false);
    }
  }

  function beginEditRow(row) {
    setEditingRow(row.rowNumber);
    setRowDraft([...row.values]);
  }

  async function saveSheetRow() {
    try {
      setSavingRow(true);
      await api(`/forms/${selected.id}/sheets/${encodeURIComponent(selectedSheet.title)}/rows/${editingRow}`, {
        method: "PATCH",
        headers: accessKey ? { "X-Form-Access-Key": accessKey } : {},
        body: JSON.stringify({ values: rowDraft }),
      });
      toast.success("Sheet row updated");
      await loadSheetRows();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingRow(false);
    }
  }

  async function loadHistory(form = selected) {
    if (!form) return;
    try {
      const data = await api(`/forms/${form.id}/submissions`, { headers: accessKey ? { "X-Form-Access-Key": accessKey } : {} });
      setSubmissions(data.submissions || []);
      setShowHistory(true);
    } catch (error) { toast.error(error.message); }
  }

  async function submit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      const data = await api(`/forms/${selected.id}/submissions`, { method: "POST", headers: accessKey ? { "X-Form-Access-Key": accessKey } : {}, body: JSON.stringify({ answers, sheetName: selectedSheet?.title || "" }) });
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
    setEditorSection("details");
    setWorkbook(null);
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

  function shareUrl(formId, userId) {
    const access = editor?.accessLinks?.find((item) => item.userId === userId)?.accessKey;
    if (!access || typeof window === "undefined") return "";
    return `${window.location.origin}/forms?form=${formId}&access=${encodeURIComponent(access)}`;
  }

  async function copyShareLink(formId, userId) {
    const url = shareUrl(formId, userId);
    if (!url) {
      toast("Save the form once to create its permanent access links.");
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopiedUserId(userId);
    toast.success("Permanent form link copied");
    window.setTimeout(() => setCopiedUserId(""), 1800);
  }

  async function loadWorkbookTabs() {
    const spreadsheetId = editor?.spreadsheet?.spreadsheetId?.trim();
    if (!spreadsheetId) {
      toast.error("Paste a Google Spreadsheet URL or ID first");
      return;
    }
    try {
      setLoadingWorkbook(true);
      const data = await api("/forms/admin/spreadsheet-tabs", {
        method: "POST",
        body: JSON.stringify({ spreadsheetId }),
      });
      setWorkbook(data);
      const currentTab = editor.spreadsheet?.sheetName;
      const currentExists = data.sheets?.some((sheet) => sheet.title === currentTab);
      setEditor((current) => ({
        ...current,
        spreadsheet: { ...current.spreadsheet, spreadsheetId: data.spreadsheetId, sheetName: "" },
      }));
      toast.success(`${data.sheets?.length || 0} sheet tab${data.sheets?.length === 1 ? "" : "s"} found`);
    } catch (error) {
      setWorkbook(null);
      toast.error(error.message);
    } finally {
      setLoadingWorkbook(false);
    }
  }

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const panel = darkMode ? "border-white/10 bg-white/[0.025]" : "border-black/5 bg-white/80";

  if (loading) {
    const activeStep = FORM_LOADING_STEPS[loadingStep];
    const ActiveIcon = activeStep.icon;
    return (
      <div className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
        <div className={`w-full max-w-lg rounded-[26px] border p-6 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}>
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}><ActiveIcon className="h-5 w-5" /></span>
            <div><p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>Forms workspace</p><h2 className="mt-2 text-lg font-semibold">{activeStep.title}</h2><p className={`mt-1.5 text-sm leading-6 ${darkMode ? "text-white/48" : "text-black/48"}`}>{activeStep.detail}</p></div>
          </div>
          <div className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className={`h-full rounded-full transition-all duration-700 ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} style={{ width: `${((loadingStep + 1) / FORM_LOADING_STEPS.length) * 100}%` }} /></div>
          <div className="mt-3 flex items-center justify-between text-[10px]"><span className={darkMode ? "text-white/35" : "text-black/40"}>Getting everything ready</span><span className={darkMode ? "text-white/45" : "text-black/50"}>{loadingStep + 1}/{FORM_LOADING_STEPS.length}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-black"}`}>
      <div className="mx-auto w-full ">
        <div className={`mb-8 overflow-hidden rounded-[30px]  p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-[#ebe6dc]"}`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className={`inline-flex items-center gap-2 rounded-full  px-3 py-1.5 text-[11px] font-medium ${darkMode ? "border-white/10 bg-white/5 text-white/65" : "border-black/10 bg-white/55 text-black/60"}`}><Sparkles className="h-3.5 w-3.5" /> Department workspace</span>
              <h2 className="small mt-5 text-4xl font-semibold tracking-tight">Forms that go somewhere.</h2>
              <p className={`mt-2 max-w-5xl text-sm leading-6 ${muted}`}>Create focused request forms, give the right people permanent access, and send every response directly into its Google Sheet.</p>
            </div>
            {user?.isSuperAdmin && <button onClick={() => openEditor()} className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}><FilePlus2 className="h-4 w-4" /> Create form</button>}
          </div>
        </div>

        {!forms.length ? (
          <div className={`rounded-[28px] border p-12 text-center ${panel}`}><ClipboardList className={`mx-auto h-9 w-9 ${muted}`} /><h3 className="mt-4 text-lg font-medium">No forms assigned</h3><p className={`mt-2 text-sm ${muted}`}>Ask the Super Admin to provide access to a form.</p></div>
        ) : (
          <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {forms.map((form) => (
                <div key={form.id} className={`group flex min-h-[285px] flex-col rounded-[26px] border p-5 transition hover:-translate-y-0.5 ${panel}`}>
                  <div className="flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center border rounded-full ${darkMode ? "bg-[#ffffff] text-black" : "bg-white text-white"}`}>
                    <img src="/formsheet.png" alt="Form icon" className="h-8  w-8" />
                    </span>{user?.isSuperAdmin && <button onClick={() => openEditor(form)} className={`flex h-9 w-9 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/10 text-white/55" : "border-black/10 hover:bg-black/5 text-black/45"}`}><Settings2 className="h-4 w-4" /></button>}</div>
                  <span className={`mt-5 w-fit rounded-full px-3 py-1 text-[11px] ${darkMode ? "bg-white/5 text-white/55" : "bg-black/[0.04] text-black/55"}`}>{form.department}</span>
                  <h3 className="small mt-4 text-xl font-semibold">{form.name}</h3><p className={`mt-2 line-clamp-3 text-sm leading-5 ${muted}`}>{form.description || "Department request form"}</p>
                  <div className="mt-auto flex items-center justify-between pt-6"><span className={`text-xs ${form.isActive ? "text-emerald-500" : "text-amber-500"}`}>{form.isActive ? "Active" : "Paused"}</span><button disabled={!form.isActive} onClick={() => openForm(form)} className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm disabled:opacity-40 ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}>Open <ChevronRight className="h-4 w-4" /></button></div>
                </div>
              ))}
          </div>
        )}
      </div>

      {selected && <Modal darkMode={darkMode} eyebrow={selected.department} title={selected.name} subtitle={selected.description || "Choose a workbook sheet, then complete its response form."} onClose={() => setSelected(null)} wide>
        <div className="p-5 sm:p-7">
        <div className={`mb-4 grid grid-cols-2 rounded-full border p-1 ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-[#ebe6dc]"}`}>
          <button type="button" onClick={() => setShowHistory(false)} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm ${!showHistory ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : muted}`}><Plus className="h-4 w-4" /> New request</button>
          <button type="button" onClick={() => loadHistory()} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm ${showHistory ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white" : muted}`}><History className="h-4 w-4" /> Submissions</button>
        </div>
        {!showHistory ? <>
          {selected.spreadsheet?.spreadsheetId && !selectedSheet && (
            <div className={`rounded-[24px] border p-5 sm:p-7 ${panel}`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Connected workbook</p><h4 className="small mt-2 text-2xl font-semibold">{formWorkbook?.workbookTitle || "Choose a sheet"}</h4><p className={`mt-1 text-sm ${muted}`}>Select the sheet you want to fill. Your response will be added only to that tab.</p></div>
                {loadingSheets && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(formWorkbook?.sheets || []).map((sheet) => (
                  <button type="button" key={sheet.sheetId} onClick={() => { setSelectedSheet(sheet); setSheetMode("actions"); }} className={`group flex min-h-28 flex-col justify-between rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5 ${darkMode ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]" : "border-black/10 bg-white hover:bg-[#f4f0e8]"}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#f27a4b] text-white"}`}><Table2 className="h-4 w-4" /></span>
                    <span className="mt-4 flex items-end justify-between gap-3"><span><span className="block text-sm font-semibold">{sheet.title}</span><span className={`mt-1 block text-[11px] ${muted}`}>{sheet.rowCount.toLocaleString()} rows · {sheet.columnCount.toLocaleString()} columns</span></span><ChevronRight className="h-4 w-4 shrink-0" /></span>
                  </button>
                ))}
              </div>
              {!loadingSheets && formWorkbook && !formWorkbook.sheets.length && <p className={`rounded-2xl border p-5 text-center text-sm ${muted}`}>No visible worksheet tabs were found.</p>}
            </div>
          )}
          {selectedSheet && sheetMode === "actions" && <div className={`rounded-[24px] border p-5 sm:p-7 ${panel}`}>
            <div className="flex items-start justify-between gap-4"><div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>{formWorkbook?.workbookTitle}</p><h4 className="small mt-2 text-2xl font-semibold">{selectedSheet.title}</h4><p className={`mt-1 text-sm ${muted}`}>Add a new response or update data already stored in this sheet.</p></div><button type="button" onClick={() => { setSelectedSheet(null); setSheetMode("choose"); }} className={`rounded-full border px-3 py-2 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>Change sheet</button></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setSheetMode("fill")} className={`flex items-center gap-4 rounded-[20px] border p-5 text-left ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 bg-white hover:bg-[#f4f0e8]"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#f27a4b] text-white"}`}><Plus className="h-5 w-5" /></span><span><span className="block font-semibold">Fill new response</span><span className={`mt-1 block text-xs ${muted}`}>Append a new row</span></span></button>
              <button type="button" disabled={loadingRows} onClick={() => loadSheetRows(selectedSheet)} className={`flex items-center gap-4 rounded-[20px] border p-5 text-left disabled:opacity-60 ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 bg-white hover:bg-[#f4f0e8]"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>{loadingRows ? <Loader2 className="h-5 w-5 animate-spin" /> : <FilePenLine className="h-5 w-5" />}</span><span><span className="block font-semibold">Edit existing data</span><span className={`mt-1 block text-xs ${muted}`}>View and update saved rows</span></span></button>
            </div>
          </div>}
          {sheetMode === "edit" && selectedSheet && <div className={`rounded-[24px] border p-4 sm:p-6 ${panel}`}>
            <div className="mb-5 flex items-center justify-between gap-3"><div><h4 className="small text-xl font-semibold">{selectedSheet.title} data</h4><p className={`mt-1 text-xs ${muted}`}>First 200 rows. Scroll horizontally to see all columns.</p></div><button type="button" onClick={() => setSheetMode("actions")} className={`rounded-full border px-3 py-2 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>Back</button></div>
            <div className={`overflow-x-auto rounded-2xl border ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <table className="min-w-full text-left text-xs">
                <thead className={darkMode ? "bg-white/5" : "bg-[#ebe6dc]"}><tr><th className="px-3 py-3">Row</th>{(sheetData?.headers || []).map((header, index) => <th key={`${header}-${index}`} className="min-w-40 px-3 py-3 font-semibold">{header || `Column ${index + 1}`}</th>)}<th className="sticky right-0 px-3 py-3">Action</th></tr></thead>
                <tbody>{(sheetData?.rows || []).map((row) => <tr key={row.rowNumber} className={darkMode ? "border-t border-white/10" : "border-t border-black/[0.06]"}><td className={`px-3 py-2 ${muted}`}>{row.rowNumber}</td>{row.values.map((value, index) => <td key={index} className="px-2 py-2">{editingRow === row.rowNumber ? <input value={rowDraft[index] ?? ""} onChange={(event) => setRowDraft((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={`h-9 min-w-36 rounded-xl border px-3 outline-none ${darkMode ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`} /> : <span className="block max-w-56 truncate px-1">{value || "—"}</span>}</td>)}<td className={`sticky right-0 px-3 py-2 ${darkMode ? "bg-[#151612]" : "bg-[#faf9f5]"}`}>{editingRow === row.rowNumber ? <div className="flex gap-2"><button type="button" disabled={savingRow} onClick={saveSheetRow} className={`flex h-8 items-center gap-1 rounded-full px-3 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>{savingRow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</button><button type="button" onClick={() => setEditingRow(null)} className="px-2">Cancel</button></div> : <button type="button" onClick={() => beginEditRow(row)} className={`rounded-full border px-3 py-1.5 ${darkMode ? "border-white/10" : "border-black/10"}`}>Edit</button>}</td></tr>)}</tbody>
              </table>
              {!sheetData?.rows?.length && <div className={`p-8 text-center text-sm ${muted}`}>No existing data rows found.</div>}
            </div>
          </div>}
          {(!selected.spreadsheet?.spreadsheetId || (selectedSheet && sheetMode === "fill")) && <form onSubmit={submit} className={`flex flex-col rounded-[24px] border px-5 sm:px-7 ${panel}`}>
          {selectedSheet && <div className={`flex items-center justify-between border-b py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#f27a4b] text-white"}`}><Table2 className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{selectedSheet.title}</p><p className={`text-xs ${muted}`}>{formWorkbook?.workbookTitle}</p></div></div><button type="button" onClick={() => setSheetMode("actions")} className={`rounded-full border px-3 py-2 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>Back</button></div>}
          <div className="flex-1">
            {(selected.fields || []).map((field, idx) => <DynamicField key={field.key} field={field} value={answers[field.key]} onChange={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))} darkMode={darkMode} isLast={idx === (selected.fields?.length || 0) - 1} />)}
          </div>
          <div className={`mt-4 flex items-center justify-between border-t pt-6 pb-2 ${darkMode ? "border-white/10" : "border-black/5"}`}>
            <button type="button" onClick={() => setSelected(null)} className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${darkMode ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"}`}>
              Cancel
            </button>
            <button disabled={submitting} className={`flex h-11 items-center justify-center gap-2 rounded-full px-8 text-sm font-medium transition disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#cbf03e]" : "bg-black text-white hover:bg-black/80"}`}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Submit response
            </button>
          </div>
        </form>}
        </> : <div className="space-y-3">
          {!submissions.length && <div className={`rounded-2xl border p-8 text-center text-sm ${panel} ${muted}`}>No submissions yet.</div>}
          {submissions.map((submission) => <div key={submission.id} className={`rounded-2xl border p-4 ${panel}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{submission.answers?.description || submission.formName}</p><p className={`mt-1 text-xs ${muted}`}>{new Date(submission.createdAt).toLocaleString()} · {submission.submittedByName}{submission.sheetName ? ` · ${submission.sheetName}` : ""}</p>{submission.syncStatus === "failed" && submission.syncError && <p className="mt-2 text-xs text-red-500">{submission.syncError}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs ${submission.syncStatus === "synced" ? "bg-emerald-500/10 text-emerald-500" : submission.syncStatus === "failed" ? "bg-red-500/10 text-red-500" : darkMode ? "bg-white/5 text-white/50" : "bg-black/5 text-black/50"}`}>{submission.syncStatus === "not_configured" ? "Saved" : submission.syncStatus}</span>{user?.isSuperAdmin && submission.syncStatus === "failed" && <button type="button" onClick={() => retrySync(submission)} className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs ${darkMode ? "bg-white/10 text-white" : "bg-black/5 text-black"}`}><RefreshCw className="h-3.5 w-3.5" /> Retry</button>}</div></div></div>)}
        </div>}
        </div>
      </Modal>}

      {editor && <Modal darkMode={darkMode} eyebrow="Form studio" title={editor.id ? "Manage form" : "Create a new form"} subtitle="Build the form, choose exactly who can use it, then connect the response destination." onClose={() => setEditor(null)} wide scrollBody={false}>
        <form onSubmit={saveForm} className="grid h-[calc(92vh-102px)] min-h-0 max-h-[720px] grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[230px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
          <aside className={`shrink-0 border-b p-4 lg:row-start-1 lg:border-b-0 lg:border-r lg:p-5 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                ["details", "Details", Clipboard],
                ["fields", "Form fields", LayoutList],
                ["access", "People & links", Users],
                ["sheet", "Google Sheet", Sheet],
              ].map(([value, label, Icon], index) => (
                <button key={value} type="button" onClick={() => setEditorSection(value)} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm ${editorSection === value ? darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white" : darkMode ? "text-white/55 hover:bg-white/5" : "text-black/50 hover:bg-black/[0.04]"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] ${editorSection === value ? "border-current/20" : darkMode ? "border-white/10" : "border-black/10"}`}>{index + 1}</span>
                  <Icon className="hidden h-4 w-4 sm:block" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </aside>
          <div className="min-h-0 min-w-0 overflow-y-auto p-5 pb-10 sm:p-8 sm:pb-12 lg:col-start-2 lg:row-start-1">
            {/* General Details */}
            {editorSection === "details" && <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.8fr] md:gap-10">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 01</p>
                <h4 className="small mt-2 text-2xl font-semibold">Give it a clear identity</h4>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>The department and description help people immediately understand what this form is for.</p>
              </div>
              <div className="space-y-4">
                <label className="block text-xs font-medium">Form name<Input darkMode={darkMode} className="mt-2" placeholder="e.g. Travel reimbursement" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} required /></label>
                <label className="block text-xs font-medium">Department<Input darkMode={darkMode} className="mt-2" placeholder="e.g. Admin & Accounts" value={editor.department} onChange={(e) => setEditor({ ...editor, department: e.target.value })} required /></label>
                <label className="block text-xs font-medium">Description
                <textarea className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${darkMode ? "border-white/10 bg-[#15171c] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25 hover:bg-white/10" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10 hover:bg-black/[0.03]"}`} rows={3} placeholder="Description" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
                </label>
              </div>
            </div>}

            {/* Form Fields */}
            {editorSection === "fields" && <div>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 02</p><h4 className="small mt-2 text-2xl font-semibold">Build the questions</h4><p className={`mt-1 text-sm ${muted}`}>Each field becomes a column value in the response sheet.</p></div>
                <button type="button" onClick={() => setEditor({ ...editor, fields: [...editor.fields, blankField()] })} className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}><Plus className="h-4 w-4" /> Add field</button>
              </div>
                <div className="space-y-3">
                  {editor.fields.map((field, index) => (
                    <div key={`${field.key}-${index}`} className={`rounded-[22px] border p-4 ${panel}`}>
                      <div className="mb-3 flex items-center justify-between"><span className={`text-xs font-semibold ${muted}`}>FIELD {String(index + 1).padStart(2, "0")}</span><button type="button" onClick={() => setEditor({ ...editor, fields: editor.fields.filter((_, i) => i !== index) })} className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>
                      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1.2fr]">
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
                      </div>
                      <label className={`mt-3 flex items-center gap-2 text-xs ${muted}`}><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} /> Required field</label>
                    </div>
                  ))}
                </div>
            </div>}

            {/* Access & Integration */}
            {editorSection === "access" && <div>
                <div className="mb-6"><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 03</p><h4 className="small mt-2 text-2xl font-semibold">Choose people, create links</h4><p className={`mt-1 text-sm ${muted}`}>Every selected person receives a permanent link bound to their account.</p></div>
                <div>
                  <div className={`max-h-[390px] overflow-y-auto rounded-[22px] border p-2 ${panel}`}>
                    {users.filter((item) => !item.isSuperAdmin).map((item) => {
                      const active = editor.allowedUserIds.includes(item.id);
                      return (
                        <div key={item.id} className={`mb-1 flex items-center gap-3 rounded-2xl p-3 last:mb-0 ${active ? darkMode ? "bg-white/[0.07]" : "bg-[#ebe6dc]" : ""}`}>
                          <button type="button" onClick={() => setEditor({ ...editor, allowedUserIds: active ? editor.allowedUserIds.filter((id) => id !== item.id) : [...editor.allowedUserIds, item.id] })} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black" : "border-[#171714] bg-[#171714] text-white" : darkMode ? "border-white/20" : "border-black/20"}`}>{active && <Check className="h-3.5 w-3.5" />}</button>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.displayName}</span><span className={`block truncate text-xs ${muted}`}>{item.username}</span></span>
                          {active && <button type="button" onClick={() => copyShareLink(editor.id, item.id)} className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 bg-white hover:bg-black/[0.03]"}`}>{copiedUserId === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {editor.id ? "Copy link" : "After save"}</button>}
                        </div>
                      );
                    })}
                    {!users.filter((item) => !item.isSuperAdmin).length && <p className={`p-3 text-sm ${muted}`}>Create users in Manage Roles first.</p>}
                  </div>
                  <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/[0.07] bg-white"}`}><Link2 className="mt-0.5 h-4 w-4 shrink-0" /><p className={muted}>Links do not bypass security. The recipient signs in normally, and the backend confirms that the link belongs to that exact assigned account.</p></div>
                </div>
            </div>}

            {editorSection === "sheet" && <div className="grid gap-6 md:grid-cols-[1fr_1.8fr] md:gap-10">
              <div><p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${muted}`}>Step 04</p><h4 className="small mt-2 text-2xl font-semibold">Connect the destination</h4><p className={`mt-2 text-sm leading-6 ${muted}`}>The first submission creates headers when the selected tab is empty. Later responses append as new rows.</p></div>
              <div className={`space-y-4 rounded-[24px] border p-5 ${panel}`}>
                <label className="block text-xs font-medium">Google Spreadsheet URL or ID
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input darkMode={darkMode} placeholder="https://docs.google.com/spreadsheets/d/..." value={editor.spreadsheet?.spreadsheetId || ""} onChange={(e) => {
                      setWorkbook(null);
                      setEditor({ ...editor, spreadsheet: { ...editor.spreadsheet, spreadsheetId: e.target.value, sheetName: "" } });
                    }} />
                    <button type="button" disabled={loadingWorkbook} onClick={loadWorkbookTabs} className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 text-sm disabled:opacity-60 ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 bg-white hover:bg-black/[0.03]"}`}>
                      {loadingWorkbook ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Load sheets
                    </button>
                  </div>
                </label>

                {workbook ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{workbook.workbookTitle}</p><p className={`mt-0.5 text-xs ${muted}`}>{workbook.sheets.length} worksheet tab{workbook.sheets.length === 1 ? "" : "s"} available</p></div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-emerald-500/10 text-emerald-700"}`}>Connected</span>
                    </div>
                    <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {workbook.sheets.map((sheet) => {
                        return (
                          <div key={sheet.sheetId} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${darkMode ? "border-white/10" : "border-black/10 bg-white"}`}>
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-white/5" : "bg-[#ebe6dc]"}`}><Table2 className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{sheet.title}</span><span className="block text-[11px] opacity-55">{sheet.rowCount.toLocaleString()} rows · {sheet.columnCount.toLocaleString()} columns{sheet.hidden ? " · Hidden" : ""}</span></span>
                          </div>
                        );
                      })}
                    </div>
                    {!workbook.sheets.length && <div className={`rounded-2xl border p-4 text-sm ${darkMode ? "border-white/10" : "border-black/10"} ${muted}`}>This workbook does not contain a worksheet tab.</div>}
                  </div>
                ) : (
                  <div className={`rounded-2xl border border-dashed p-5 text-center ${darkMode ? "border-white/10" : "border-black/10"}`}>
                    <Sheet className={`mx-auto h-5 w-5 ${muted}`} />
                    <p className="mt-2 text-sm font-medium">Load the workbook to preview its sheets</p>
                    <p className={`mt-1 text-xs ${muted}`}>Users will choose the destination sheet each time they open this form.</p>
                  </div>
                )}
                <div className={`rounded-2xl p-4 text-xs leading-5 ${darkMode ? "bg-white/5 text-white/55" : "bg-[#ebe6dc] text-black/55"}`}>Share the spreadsheet with the Google service-account email configured on the server and give it Editor access.</div>
                <label className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-sm ${darkMode ? "border-white/10" : "border-black/10"}`}><span><span className="block font-medium">Form is active</span><span className={`mt-1 block text-xs ${muted}`}>Turn this off to pause new responses without deleting the form.</span></span><input type="checkbox" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} /></label>
              </div>
            </div>}
          </div>

          <div className={`z-10 col-span-full flex items-center justify-between gap-4 border-t px-5 pb-6 pt-5 sm:px-7 sm:pb-7 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-[#faf9f5]"}`}>
            <button type="button" onClick={() => setEditor(null)} className={`flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition ${darkMode ? "border-white/10 text-white/65 hover:bg-white/5 hover:text-white" : "border-black/10 text-black/60 hover:bg-black/[0.04] hover:text-black"}`}>
              Cancel
            </button>
            <button disabled={saving} className={`flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-full px-7 text-sm font-medium transition disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#cbf03e]" : "bg-black text-white hover:bg-black/80"}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />} {editor.id ? "Save changes" : "Create form"}
            </button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
