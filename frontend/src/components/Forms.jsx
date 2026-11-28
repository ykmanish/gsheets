"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CheckCircle2, ChevronRight, Clipboard, ClipboardList, Copy, FilePenLine, FilePlus2, History, LayoutList, Link2, Loader2, Plus, RefreshCw, Save, Settings2, Sheet, Table2, Trash2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import { Badge, Button, Chip, EmptyState, IconTile, Notice, PageHeader, SelectMenu, Select as KitSelect, Tabs, Toggle } from "./ui";

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

function Modal({ darkMode, title, subtitle, onClose, children, wide = false, eyebrow, scrollBody = true, icon = ClipboardList, tone = "peach" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-7">
      <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`flex max-h-[92vh] w-full flex-col ${wide ? "max-w-6xl" : "max-w-2xl"} overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
          <div className="flex min-w-0 items-start gap-3.5">
            <IconTile icon={icon} tone={tone} darkMode={darkMode} size="md" />
            <div className="min-w-0">
              {eyebrow && <Badge tone="neutral" darkMode={darkMode} className="mb-2">{eyebrow}</Badge>}
              <h3 className="text-[20px] leading-tight tracking-[-0.01em]">{title}</h3>
              <p className={`mt-1 max-w-2xl text-[13px] ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`}>{subtitle}</p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}><X className="h-4 w-4" /></button>
        </div>
        <div className={`min-h-0 ${scrollBody ? "overflow-y-auto" : "overflow-hidden"}`}>{children}</div>
      </div>
    </div>
  );
}

const textareaClass = (darkMode) => `w-full rounded-[16px] border px-4 py-3 text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 hover:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] hover:bg-[#efefec] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`;

function Input({ darkMode, className = "", ...props }) {
  return <input {...props} className={`h-11 w-full rounded-full border px-4 text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 hover:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] hover:bg-[#efefec] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"} ${className}`} />;
}

function StepHeading({ darkMode, step, title, text, icon, tone }) {
  return (
    <div>
      <Badge icon={icon} tone={tone} darkMode={darkMode} className="mb-3">Step {step}</Badge>
      <h4 className="text-[22px] leading-[1.15] tracking-[-0.02em]">{title}</h4>
      <p className={`mt-2 text-[13px] leading-6 ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`}>{text}</p>
    </div>
  );
}

function Select({ darkMode, children, ...props }) {
  return <KitSelect darkMode={darkMode} {...props}>{children}</KitSelect>;
}

function DynamicField({ field, value, onChange, darkMode, isLast }) {
  const common = { id: field.key, name: field.key, required: field.required, value: value ?? "", onChange: (event) => onChange(field.key, event.target.value) };
  
  let inputElement;
  if (field.type === "textarea") {
    inputElement = <textarea {...common} rows={4} className={textareaClass(darkMode)} />;
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
    <div className={`grid grid-cols-1 gap-3 py-6 md:grid-cols-[1.2fr_2fr] md:gap-8 ${isLast ? "" : darkMode ? "border-b border-white/[0.06]" : "border-b border-[#f0f0ee]"}`}>
      <div>
        <label htmlFor={field.key} className={`block text-[14px] ${darkMode ? "text-white" : "text-[#141414]"}`}>
          {field.label} {field.required && <span className="ml-1 text-[#c0394b]">*</span>}
        </label>
        <p className={`mt-1 text-[13px] ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`}>
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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const panel = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const softRow = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
  const hair = darkMode ? "border-white/10" : "border-[#f0f0ee]";
  const pageShell = `newq flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`;
  const smallPill = `inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "border border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`;
  const syncTone = (status) => (status === "synced" ? "mint" : status === "failed" ? "rose" : "neutral");

  if (loading) {
    const activeStep = FORM_LOADING_STEPS[loadingStep];
    const ActiveIcon = activeStep.icon;
    return (
      <div className={`newq flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
        <div className={`w-full max-w-lg rounded-[24px] border p-6 ${panel}`}>
          <div className="flex items-start gap-4">
            <IconTile icon={ActiveIcon} tone="peach" darkMode={darkMode} size="md" />
            <div>
              <Badge tone="neutral" darkMode={darkMode}>Forms workspace</Badge>
              <h2 className="mt-3 text-[18px] tracking-[-0.01em]">{activeStep.title}</h2>
              <p className={`mt-1 text-[13px] leading-6 ${muted}`}>{activeStep.detail}</p>
            </div>
          </div>
          <div className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-[#f0f0ee]"}`}><div className={`h-full rounded-full transition-all duration-700 ${darkMode ? "bg-[#cff07a]" : "bg-[#141414]"}`} style={{ width: `${((loadingStep + 1) / FORM_LOADING_STEPS.length) * 100}%` }} /></div>
          <div className={`mt-3 flex items-center justify-between text-[11px] ${muted}`}><span>Getting everything ready</span><span className="tabular-nums">{loadingStep + 1}/{FORM_LOADING_STEPS.length}</span></div>
        </div>
      </div>
    );
  }

  const formTones = ["peach", "lavender", "mint", "sky", "amber", "rose"];

  return (
    <div className={pageShell}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <PageHeader
          darkMode={darkMode}
          badge="Department workspace"
          badgeIcon={ClipboardList}
          badgeTone="peach"
          title="Forms"
          subtitle="that land straight in a Google Sheet"
          description="Create focused request forms, give the right people permanent access, and send every response directly into its Google Sheet."
          actions={user?.isSuperAdmin && <Button darkMode={darkMode} variant="primary" icon={FilePlus2} onClick={() => openEditor()}>Create form</Button>}
        />

        {!forms.length ? (
          <EmptyState darkMode={darkMode} icon={ClipboardList} tone="peach" title="No forms assigned" text="Ask the Super Admin to provide access to a form." />
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {forms.map((form, formIndex) => (
                <div key={form.id} className={`group relative flex min-h-[260px] flex-col rounded-[20px] border p-5 transition-colors ${panel} ${darkMode ? "hover:bg-[#191b21]" : "hover:bg-[#fcfcfb]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-11 w-11 place-items-center rounded-[14px] ${darkMode ? "bg-white/[0.07]" : "bg-[#f4f4f2]"}`}>
                      <img src="/formsheet.png" alt="Form icon" className="h-7 w-7" />
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] tabular-nums ${darkMode ? "text-white/35" : "text-[#b0b0ae]"}`}>{String(formIndex + 1).padStart(2, "0")}</span>
                      {user?.isSuperAdmin && <button onClick={() => openEditor(form)} aria-label="Manage form" className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`}><Settings2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                  <Chip darkMode={darkMode} tone={formTones[formIndex % formTones.length]} className="mt-5 w-fit">{form.department}</Chip>
                  <h3 className="mt-3 text-[17px] tracking-[-0.01em]">{form.name}</h3>
                  <p className={`mt-1.5 line-clamp-3 text-[13px] leading-5 ${muted}`}>{form.description || "Department request form"}</p>
                  <div className={`mt-auto flex items-center justify-between border-t pt-4 ${hair}`}>
                    <Chip darkMode={darkMode} tone={form.isActive ? "mint" : "amber"}>{form.isActive ? "Active" : "Paused"}</Chip>
                    <Button darkMode={darkMode} variant="primary" size="sm" iconRight={ChevronRight} disabled={!form.isActive} onClick={() => openForm(form)}>Open</Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {selected && <Modal darkMode={darkMode} eyebrow={selected.department} title={selected.name} subtitle={selected.description || "Choose a workbook sheet, then complete its response form."} onClose={() => setSelected(null)} wide>
        <div className="p-5 sm:p-7">
        <Tabs
          darkMode={darkMode}
          className="mb-5"
          value={showHistory ? "history" : "new"}
          onChange={(id) => (id === "history" ? loadHistory() : setShowHistory(false))}
          items={[{ id: "new", label: "New request", icon: Plus }, { id: "history", label: "Submissions", icon: History }]}
        />
        {!showHistory ? <>
          {selected.spreadsheet?.spreadsheetId && !selectedSheet && (
            <div className={`rounded-[20px] border p-5 sm:p-6 ${panel}`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <IconTile icon={Sheet} tone="mint" darkMode={darkMode} size="sm" />
                  <div><h4 className="text-[17px] tracking-[-0.01em]">{formWorkbook?.workbookTitle || "Choose a sheet"}</h4><p className={`mt-0.5 text-[13px] ${muted}`}>Select the sheet you want to fill. Your response will be added only to that tab.</p></div>
                </div>
                {loadingSheets && <Loader2 className={`h-5 w-5 animate-spin ${muted}`} />}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(formWorkbook?.sheets || []).map((sheet) => (
                  <button type="button" key={sheet.sheetId} onClick={() => { setSelectedSheet(sheet); setSheetMode("actions"); }} className={`group flex min-h-28 flex-col justify-between rounded-[20px] border p-4 text-left transition-colors ${darkMode ? "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]" : "border-[#ececec] bg-white hover:bg-[#f7f7f5]"}`}>
                    <IconTile icon={Table2} tone="mint" darkMode={darkMode} size="sm" />
                    <span className="mt-4 flex items-end justify-between gap-3"><span><span className="block text-[14px]">{sheet.title}</span><span className={`mt-0.5 block text-[12px] ${muted}`}>{sheet.rowCount.toLocaleString()} rows · {sheet.columnCount.toLocaleString()} columns</span></span><ChevronRight className={`h-4 w-4 shrink-0 ${muted}`} /></span>
                  </button>
                ))}
              </div>
              {!loadingSheets && formWorkbook && !formWorkbook.sheets.length && <EmptyState darkMode={darkMode} icon={Table2} title="No sheets found" text="No visible worksheet tabs were found." />}
            </div>
          )}
          {selectedSheet && sheetMode === "actions" && <div className={`rounded-[20px] border p-5 sm:p-6 ${panel}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <IconTile icon={Table2} tone="mint" darkMode={darkMode} size="sm" />
                <div><p className={`text-[12px] ${muted}`}>{formWorkbook?.workbookTitle}</p><h4 className="text-[17px] tracking-[-0.01em]">{selectedSheet.title}</h4><p className={`mt-0.5 text-[13px] ${muted}`}>Add a new response or update data already stored in this sheet.</p></div>
              </div>
              <button type="button" onClick={() => { setSelectedSheet(null); setSheetMode("choose"); }} className={smallPill}>Change sheet</button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setSheetMode("fill")} className={`flex items-center gap-4 rounded-[20px] p-5 text-left transition ${darkMode ? "bg-[#cff07a]/15 hover:bg-[#cff07a]/20" : "bg-[#d4f28a] hover:bg-[#cdee7c]"}`}><span className={`grid h-11 w-11 place-items-center rounded-[14px] ${darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"}`}><Plus className="h-5 w-5" /></span><span><span className="block text-[15px]">Fill new response</span><span className={`mt-0.5 block text-[12.5px] ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>Append a new row</span></span></button>
              <button type="button" disabled={loadingRows} onClick={() => loadSheetRows(selectedSheet)} className={`flex items-center gap-4 rounded-[20px] border p-5 text-left transition disabled:opacity-60 ${darkMode ? "border-white/10 hover:bg-white/[0.04]" : "border-[#ececec] bg-white hover:bg-[#f7f7f5]"}`}>{loadingRows ? <span className={`grid h-11 w-11 place-items-center rounded-[14px] ${darkMode ? "bg-white/[0.07]" : "bg-[#f4f4f2]"}`}><Loader2 className="h-5 w-5 animate-spin" /></span> : <IconTile icon={FilePenLine} tone="sky" darkMode={darkMode} size="md" />}<span><span className="block text-[15px]">Edit existing data</span><span className={`mt-0.5 block text-[12.5px] ${muted}`}>View and update saved rows</span></span></button>
            </div>
          </div>}
          {sheetMode === "edit" && selectedSheet && <div className={`rounded-[20px] border p-4 sm:p-6 ${panel}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><IconTile icon={FilePenLine} tone="sky" darkMode={darkMode} size="sm" /><div><h4 className="text-[17px] tracking-[-0.01em]">{selectedSheet.title} data</h4><p className={`text-[12.5px] ${muted}`}>First 200 rows. Scroll horizontally to see all columns.</p></div></div>
              <button type="button" onClick={() => setSheetMode("actions")} className={smallPill}>Back</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12.5px]">
                <thead><tr><th className={`px-3 py-2.5 font-normal ${muted}`}>Row</th>{(sheetData?.headers || []).map((header, index) => <th key={`${header}-${index}`} className={`min-w-40 px-3 py-2.5 font-normal ${muted}`}>{header || `Column ${index + 1}`}</th>)}<th className={`sticky right-0 px-3 py-2.5 font-normal ${muted} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>Action</th></tr></thead>
                <tbody>{(sheetData?.rows || []).map((row) => <tr key={row.rowNumber} className={`border-t ${hair}`}><td className={`px-3 py-2 tabular-nums ${muted}`}>{row.rowNumber}</td>{row.values.map((value, index) => <td key={index} className="px-2 py-2">{editingRow === row.rowNumber ? <input value={rowDraft[index] ?? ""} onChange={(event) => setRowDraft((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={`h-9 min-w-36 rounded-full px-3 outline-none ${darkMode ? "bg-white/[0.06] focus:ring-[3px] focus:ring-white/10" : "bg-[#f4f4f2] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`} /> : <span className="block max-w-56 truncate px-1">{value || "—"}</span>}</td>)}<td className={`sticky right-0 px-3 py-2 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>{editingRow === row.rowNumber ? <div className="flex gap-1.5"><Button darkMode={darkMode} variant="primary" size="sm" icon={Save} loading={savingRow} disabled={savingRow} onClick={saveSheetRow}>Save</Button><Button darkMode={darkMode} variant="ghost" size="sm" onClick={() => setEditingRow(null)}>Cancel</Button></div> : <button type="button" onClick={() => beginEditRow(row)} className={smallPill}>Edit</button>}</td></tr>)}</tbody>
              </table>
              {!sheetData?.rows?.length && <EmptyState darkMode={darkMode} icon={Table2} title="No rows yet" text="No existing data rows found." />}
            </div>
          </div>}
          {(!selected.spreadsheet?.spreadsheetId || (selectedSheet && sheetMode === "fill")) && <form onSubmit={submit} className={`flex flex-col rounded-[20px] border px-5 sm:px-7 ${panel}`}>
          {selectedSheet && <div className={`flex items-center justify-between border-b py-4 ${hair}`}><div className="flex items-center gap-3"><IconTile icon={Table2} tone="mint" darkMode={darkMode} size="sm" /><div><p className="text-[14px]">{selectedSheet.title}</p><p className={`text-[12px] ${muted}`}>{formWorkbook?.workbookTitle}</p></div></div><button type="button" onClick={() => setSheetMode("actions")} className={smallPill}>Back</button></div>}
          <div className="flex-1">
            {(selected.fields || []).map((field, idx) => <DynamicField key={field.key} field={field} value={answers[field.key]} onChange={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))} darkMode={darkMode} isLast={idx === (selected.fields?.length || 0) - 1} />)}
          </div>
          <div className={`mt-2 flex items-center justify-between border-t pb-5 pt-5 ${hair}`}>
            <Button darkMode={darkMode} variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            <Button type="submit" darkMode={darkMode} variant="primary" size="lg" icon={CheckCircle2} loading={submitting} disabled={submitting}>Submit response</Button>
          </div>
        </form>}
        </> : <div className="space-y-2">
          {!submissions.length && <EmptyState darkMode={darkMode} icon={History} tone="lavender" title="No submissions yet" text="Responses sent from this form appear here." />}
          {submissions.map((submission) => <div key={submission.id} className={`rounded-[14px] px-4 py-3.5 ${softRow}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="text-[14px]">{submission.answers?.description || submission.formName}</p><p className={`mt-0.5 text-[12px] ${muted}`}>{new Date(submission.createdAt).toLocaleString()} · {submission.submittedByName}{submission.sheetName ? ` · ${submission.sheetName}` : ""}</p>{submission.syncStatus === "failed" && submission.syncError && <p className="mt-1.5 text-[12px] text-[#c0394b]">{submission.syncError}</p>}</div><div className="flex items-center gap-2"><Chip darkMode={darkMode} tone={syncTone(submission.syncStatus)}>{submission.syncStatus === "not_configured" ? "Saved" : submission.syncStatus}</Chip>{user?.isSuperAdmin && submission.syncStatus === "failed" && <Button darkMode={darkMode} variant="secondary" size="sm" icon={RefreshCw} onClick={() => retrySync(submission)}>Retry</Button>}</div></div></div>)}
        </div>}
        </div>
      </Modal>}

      {editor && <Modal darkMode={darkMode} icon={Settings2} tone="lavender" eyebrow="Form studio" title={editor.id ? "Manage form" : "Create a new form"} subtitle="Build the form, choose exactly who can use it, then connect the response destination." onClose={() => setEditor(null)} wide scrollBody={false}>
        <form onSubmit={saveForm} className="grid h-[calc(92vh-118px)] min-h-0 max-h-[720px] grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[230px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
          <aside className={`shrink-0 border-b p-4 lg:row-start-1 lg:border-b-0 lg:border-r lg:p-4 ${hair}`}>
            <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
              {[
                ["details", "Details", Clipboard],
                ["fields", "Form fields", LayoutList],
                ["access", "People & links", Users],
                ["sheet", "Google Sheet", Sheet],
              ].map(([value, label, Icon], index) => (
                <button key={value} type="button" onClick={() => setEditorSection(value)} className={`flex items-center gap-3 rounded-full px-3 py-2 text-left text-[13px] transition ${editorSection === value ? darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white" : darkMode ? "text-white/60 hover:bg-white/[0.06]" : "text-[#5f5f5c] hover:bg-[#f4f4f2]"}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] tabular-nums ${editorSection === value ? darkMode ? "bg-black/10" : "bg-white/15" : darkMode ? "bg-white/[0.07]" : "bg-[#f4f4f2]"}`}>{index + 1}</span>
                  <Icon className="hidden h-4 w-4 sm:block" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </aside>
          <div className="min-h-0 min-w-0 overflow-y-auto p-5 pb-10 sm:p-8 sm:pb-12 lg:col-start-2 lg:row-start-1">
            {/* General Details */}
            {editorSection === "details" && <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.8fr] md:gap-10">
              <StepHeading darkMode={darkMode} step="01" icon={Clipboard} tone="peach" title="Give it a clear identity" text="The department and description help people immediately understand what this form is for." />
              <div className="space-y-4">
                <label className={`block text-[12px] ${muted}`}>Form name<Input darkMode={darkMode} className="mt-1.5" placeholder="e.g. Travel reimbursement" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} required /></label>
                <label className={`block text-[12px] ${muted}`}>Department<Input darkMode={darkMode} className="mt-1.5" placeholder="e.g. Admin & Accounts" value={editor.department} onChange={(e) => setEditor({ ...editor, department: e.target.value })} required /></label>
                <label className={`block text-[12px] ${muted}`}>Description
                <textarea className={`mt-1.5 ${textareaClass(darkMode)}`} rows={3} placeholder="Description" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
                </label>
              </div>
            </div>}

            {/* Form Fields */}
            {editorSection === "fields" && <div>
              <div className="mb-6 flex items-end justify-between gap-4">
                <StepHeading darkMode={darkMode} step="02" icon={LayoutList} tone="lavender" title="Build the questions" text="Each field becomes a column value in the response sheet." />
                <Button darkMode={darkMode} variant="secondary" icon={Plus} className="shrink-0" onClick={() => setEditor({ ...editor, fields: [...editor.fields, blankField()] })}>Add field</Button>
              </div>
                <div className="space-y-3">
                  {editor.fields.map((field, index) => (
                    <div key={`${field.key}-${index}`} className={`rounded-[20px] border p-4 ${panel}`}>
                      <div className="mb-3 flex items-center justify-between"><span className={`text-[12px] tabular-nums ${muted}`}>Field {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label="Remove field" onClick={() => setEditor({ ...editor, fields: editor.fields.filter((_, i) => i !== index) })} className={`grid h-8 w-8 place-items-center rounded-full text-[#c0394b] ${darkMode ? "hover:bg-red-500/10" : "hover:bg-[#fbe4e6]"}`}><Trash2 className="h-4 w-4" /></button></div>
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
                      <div className={`mt-3 flex items-center gap-2.5 text-[12.5px] ${muted}`}><Toggle darkMode={darkMode} size="sm" label="Required field" checked={field.required} onChange={(next) => updateField(index, { required: next })} /> Required field</div>
                    </div>
                  ))}
                </div>
            </div>}

            {/* Access & Integration */}
            {editorSection === "access" && <div>
                <div className="mb-6"><StepHeading darkMode={darkMode} step="03" icon={Users} tone="sky" title="Choose people, create links" text="Every selected person receives a permanent link bound to their account." /></div>
                <div>
                  <div className={`max-h-[390px] overflow-y-auto rounded-[20px] border p-2 ${panel}`}>
                    {users.filter((item) => !item.isSuperAdmin).map((item) => {
                      const active = editor.allowedUserIds.includes(item.id);
                      return (
                        <div key={item.id} className={`mb-1 flex items-center gap-3 rounded-[14px] p-3 last:mb-0 ${active ? softRow : ""}`}>
                          <button type="button" aria-pressed={active} onClick={() => setEditor({ ...editor, allowedUserIds: active ? editor.allowedUserIds.filter((id) => id !== item.id) : [...editor.allowedUserIds, item.id] })} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${active ? darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white" : darkMode ? "border-white/20" : "border-[#cfcfcb] bg-white"}`}>{active && <Check className="h-3.5 w-3.5" />}</button>
                          <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px]">{item.displayName}</span><span className={`block truncate text-[12px] ${muted}`}>{item.username}</span></span>
                          {active && <Button darkMode={darkMode} variant="secondary" size="sm" icon={copiedUserId === item.id ? Check : Copy} onClick={() => copyShareLink(editor.id, item.id)}>{editor.id ? "Copy link" : "After save"}</Button>}
                        </div>
                      );
                    })}
                    {!users.filter((item) => !item.isSuperAdmin).length && <p className={`p-3 text-[13px] ${muted}`}>Create users in Manage Roles first.</p>}
                  </div>
                  <Notice darkMode={darkMode} tone="blue" icon={Link2} className="mt-4">Links do not bypass security. The recipient signs in normally, and the backend confirms that the link belongs to that exact assigned account.</Notice>
                </div>
            </div>}

            {editorSection === "sheet" && <div className="grid gap-6 md:grid-cols-[1fr_1.8fr] md:gap-10">
              <StepHeading darkMode={darkMode} step="04" icon={Sheet} tone="mint" title="Connect the destination" text="The first submission creates headers when the selected tab is empty. Later responses append as new rows." />
              <div className={`space-y-4 rounded-[20px] border p-5 ${panel}`}>
                <label className={`block text-[12px] ${muted}`}>Google Spreadsheet URL or ID
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <Input darkMode={darkMode} placeholder="https://docs.google.com/spreadsheets/d/..." value={editor.spreadsheet?.spreadsheetId || ""} onChange={(e) => {
                      setWorkbook(null);
                      setEditor({ ...editor, spreadsheet: { ...editor.spreadsheet, spreadsheetId: e.target.value, sheetName: "" } });
                    }} />
                    <Button darkMode={darkMode} variant="secondary" className="h-11 shrink-0" icon={RefreshCw} loading={loadingWorkbook} disabled={loadingWorkbook} onClick={loadWorkbookTabs}>Load sheets</Button>
                  </div>
                </label>

                {workbook ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-[14px]">{workbook.workbookTitle}</p><p className={`mt-0.5 text-[12px] ${muted}`}>{workbook.sheets.length} worksheet tab{workbook.sheets.length === 1 ? "" : "s"} available</p></div>
                      <Chip darkMode={darkMode} tone="mint" icon={CheckCircle2}>Connected</Chip>
                    </div>
                    <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {workbook.sheets.map((sheet) => {
                        return (
                          <div key={sheet.sheetId} className={`flex items-center gap-3 rounded-[14px] p-3 text-left ${softRow}`}>
                            <IconTile icon={Table2} tone="mint" darkMode={darkMode} size="sm" />
                            <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px]">{sheet.title}</span><span className={`block text-[11.5px] ${muted}`}>{sheet.rowCount.toLocaleString()} rows · {sheet.columnCount.toLocaleString()} columns{sheet.hidden ? " · Hidden" : ""}</span></span>
                          </div>
                        );
                      })}
                    </div>
                    {!workbook.sheets.length && <EmptyState darkMode={darkMode} icon={Table2} title="No tabs" text="This workbook does not contain a worksheet tab." />}
                  </div>
                ) : (
                  <EmptyState darkMode={darkMode} icon={Sheet} tone="mint" className="py-8" title="Load the workbook to preview its sheets" text="Users will choose the destination sheet each time they open this form." />
                )}
                <Notice darkMode={darkMode} tone="neutral">Share the spreadsheet with the Google service-account email configured on the server and give it Editor access.</Notice>
                <div className={`flex items-center justify-between gap-4 rounded-[14px] p-4 text-[13px] ${softRow}`}><span><span className="block text-[14px]">Form is active</span><span className={`mt-0.5 block text-[12px] ${muted}`}>Turn this off to pause new responses without deleting the form.</span></span><Toggle darkMode={darkMode} label="Form is active" checked={editor.isActive} onChange={(next) => setEditor({ ...editor, isActive: next })} /></div>
              </div>
            </div>}
          </div>

          <div className={`z-10 col-span-full flex items-center justify-between gap-4 border-t px-5 py-4 sm:px-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#f0f0ee] bg-white"}`}>
            <Button darkMode={darkMode} variant="secondary" onClick={() => setEditor(null)}>Cancel</Button>
            <Button type="submit" darkMode={darkMode} variant="primary" className="min-w-[170px]" icon={Settings2} loading={saving} disabled={saving}>{editor.id ? "Save changes" : "Create form"}</Button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
