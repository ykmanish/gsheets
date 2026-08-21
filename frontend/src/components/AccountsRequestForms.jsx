"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleCheckBig, ClipboardList, Copy, ExternalLink, FilePlus2, Hash, Inbox, Link2, Loader2,
  Paperclip, Pencil, Plus, Power, Repeat2, RotateCcw, Save, Table2, Ticket, Trash2,
  TriangleAlert, Users, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "toggle", label: "Toggle (yes / no)" },
  { value: "select", label: "Choice list" },
  { value: "date", label: "Date" },
  { value: "file", label: "File upload" },
];

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function blankField() {
  return { label: "", type: "text", required: false, allowAttachment: false, options: [], sheetColumn: "", placeholder: "" };
}

function emptyDraft() {
  return {
    name: "",
    description: "",
    tabName: "",
    spreadsheetId: "",
    driveFolderId: "",
    visibility: "dashboard",
    submissionMode: "multi",
    isActive: true,
    fields: [blankField()],
  };
}

function copyText(value, label = "Link copied") {
  navigator.clipboard.writeText(value).then(
    () => toast.success(label),
    () => toast.error(`Could not copy — it is ${value}`),
  );
}

/* ─────────────────────────────── card pieces ───────────────────────────────
   Each form keeps its own colour, picked from its slug so it never moves about
   between reloads. Colour marks identity and state; nothing else is tinted.   */

const PALETTES = [
  { tile: "bg-indigo-50 text-indigo-600", tileDark: "bg-indigo-400/15 text-indigo-300", solid: "bg-indigo-600 hover:bg-indigo-700", solidDark: "bg-indigo-500 hover:bg-indigo-400" },
  { tile: "bg-emerald-50 text-emerald-600", tileDark: "bg-emerald-400/15 text-emerald-300", solid: "bg-emerald-600 hover:bg-emerald-700", solidDark: "bg-emerald-500 hover:bg-emerald-400" },
  { tile: "bg-amber-50 text-amber-600", tileDark: "bg-amber-400/15 text-amber-300", solid: "bg-amber-500 hover:bg-amber-600", solidDark: "bg-amber-500 hover:bg-amber-400" },
  { tile: "bg-rose-50 text-rose-600", tileDark: "bg-rose-400/15 text-rose-300", solid: "bg-rose-500 hover:bg-rose-600", solidDark: "bg-rose-500 hover:bg-rose-400" },
  { tile: "bg-sky-50 text-sky-600", tileDark: "bg-sky-400/15 text-sky-300", solid: "bg-sky-600 hover:bg-sky-700", solidDark: "bg-sky-500 hover:bg-sky-400" },
  { tile: "bg-violet-50 text-violet-600", tileDark: "bg-violet-400/15 text-violet-300", solid: "bg-violet-600 hover:bg-violet-700", solidDark: "bg-violet-500 hover:bg-violet-400" },
];

function paletteFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return PALETTES[hash % PALETTES.length];
}

function Chip({ icon: Icon, children, tone, darkMode }) {
  const tones = {
    amber: darkMode ? "bg-amber-400/12 text-amber-200" : "bg-amber-50 text-amber-700",
    blue: darkMode ? "bg-blue-400/12 text-blue-200" : "bg-blue-50 text-blue-700",
    violet: darkMode ? "bg-violet-400/12 text-violet-200" : "bg-violet-50 text-violet-700",
    dark: darkMode ? "bg-white/[0.14] text-white/75" : "bg-[#171714] text-white",
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${tone ? tones[tone] : darkMode ? "bg-white/[0.07] text-white/60" : "bg-black/[0.045] text-black/55"}`}>
      {Icon ? <Icon className="h-3 w-3 opacity-70" /> : null}
      {children}
    </span>
  );
}

function IconButton({ icon: Icon, onClick, disabled, label, danger, darkMode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? darkMode ? "text-white/45 hover:bg-rose-400/15 hover:text-rose-300" : "text-black/35 hover:bg-rose-50 hover:text-rose-500"
          : darkMode ? "text-white/60 hover:bg-white/[0.08]" : "text-black/45 hover:bg-black/[0.05]"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* ──────────────────────────────── the module ──────────────────────────────── */

export default function AccountsRequestForms({ darkMode, canManage }) {
  const [forms, setForms] = useState([]);
  const [serviceEmail, setServiceEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [linksFor, setLinksFor] = useState(null);

  const muted = darkMode ? "text-white/50" : "text-black/50";
  const panel = darkMode ? "border-transparent bg-[#15171c]" : "border-black/[0.06] bg-white";
  const cardClass = darkMode ? "border-white/[0.07] bg-[#191b21]" : "border-black/[0.07] bg-white";
  const inputClass = `mt-2 h-11 w-full rounded-2xl border px-3 text-sm font-normal outline-none ${darkMode ? "border-white/10 bg-[#0d0f13] text-white/80 placeholder:text-white/30" : "border-black/10 bg-white text-black/75 placeholder:text-black/35"}`;

  const load = useCallback(async () => {
    try {
      const result = await api("/accounts/forms");
      setForms(result.forms || []);
      setServiceEmail(result.serviceAccountEmail || "");
    } catch (error) {
      toast.error(error.message || "Could not load forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publicBase = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);

  function openNew() {
    setDraft(emptyDraft());
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEdit(form) {
    setDraft({
      name: form.name,
      description: form.description || "",
      tabName: form.tabName || "",
      spreadsheetId: form.spreadsheetId || "",
      driveFolderId: form.driveFolderId || "",
      visibility: form.visibility,
      submissionMode: form.submissionMode || "multi",
      isActive: form.isActive,
      fields: (form.fields || []).map((field) => ({ ...field, options: field.options || [] })),
    });
    setEditingId(form.id);
    setEditorOpen(true);
  }

  function updateField(index, patch) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    }));
  }

  function moveField(index, direction) {
    setDraft((current) => {
      const next = [...current.fields];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, fields: next };
    });
  }

  async function save() {
    try {
      setSaving(true);
      const payload = {
        ...draft,
        fields: draft.fields.map((field) => ({
          ...field,
          options: field.type === "select"
            ? String(field.optionsText ?? field.options.join("\n")).split("\n").map((o) => o.trim()).filter(Boolean)
            : [],
        })),
      };
      if (editingId) await api(`/accounts/forms/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/accounts/forms", { method: "POST", body: JSON.stringify(payload) });
      toast.success(editingId ? "Form updated" : "Form created");
      setEditorOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not save the form");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(form) {
    try {
      await api(`/accounts/forms/${form.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !form.isActive }) });
      await load();
    } catch (error) {
      toast.error(error.message || "Could not update the form");
    }
  }

  async function deleteForm() {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      const result = await api(`/accounts/forms/${confirmDelete.id}`, { method: "DELETE" });
      toast.success(result.submissionsRemoved ? `Form deleted with ${result.submissionsRemoved} response${result.submissionsRemoved === 1 ? "" : "s"}` : "Form deleted");
      setConfirmDelete(null);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not delete the form");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className={`mt-5 rounded-[30px] border p-5 sm:p-6 ${panel}`}>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="small text-2xl font-black">Your forms</h2>
          <p className={`mt-1 text-sm ${muted}`}>
            Each form has its own link and its own sheet tab. Open one to edit its fields or read its responses.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={!canManage}
          title={canManage ? "" : "Your Google account has view access only"}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#6ee72f] px-5 text-sm font-black text-[#10210c] transition hover:bg-[#5edb22] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          <FilePlus2 className="h-4 w-4" /> New form
        </button>
      </div>

      {loading ? (
        <div className={`grid min-h-[120px] place-items-center text-sm ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !forms.length ? (
        <div className={`grid min-h-[160px] place-items-center rounded-[24px] border border-dashed p-6 text-center ${darkMode ? "border-white/10" : "border-black/10"}`}>
          <div>
            <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${darkMode ? "bg-white/[0.06]" : "bg-black/[0.04]"}`}><ClipboardList className={`h-6 w-6 ${muted}`} /></span>
            <p className={`mt-3 text-sm font-bold ${muted}`}>No request forms yet. Create one and share its link.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {forms.map((form) => {
            const single = form.submissionMode === "single";
            const links = form.links || { total: 0, used: 0 };
            const url = `${publicBase}/f/${form.slug}`;
            const colour = paletteFor(form.slug);
            return (
              <article key={form.id} className={`flex min-w-0 flex-col rounded-[20px] border p-4 ${cardClass} ${form.isActive ? "" : "opacity-55"}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${darkMode ? colour.tileDark : colour.tile}`}>
                    <ClipboardList className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="small truncate text-[17px] font-black leading-tight">{form.name}</h3>
                    <p className={`mt-0.5 truncate text-xs ${muted}`}>{form.description || `Responses go to the "${form.tabName}" tab`}</p>
                  </div>
                  <Chip
                    icon={!form.isActive ? Power : form.visibility === "link" ? Link2 : Users}
                    tone={!form.isActive ? "dark" : form.visibility === "link" ? "amber" : "blue"}
                    darkMode={darkMode}
                  >
                    {!form.isActive ? "Closed" : form.visibility === "link" ? "Anyone with link" : "Dashboard only"}
                  </Chip>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Chip icon={Hash} darkMode={darkMode}>{form.fields.length} field{form.fields.length === 1 ? "" : "s"}</Chip>
                  <Chip icon={Table2} darkMode={darkMode}>{form.tabName}</Chip>
                  <Chip icon={Inbox} darkMode={darkMode}>{form.submissionCount} response{form.submissionCount === 1 ? "" : "s"}</Chip>
                  {single
                    ? <Chip icon={Ticket} tone="violet" darkMode={darkMode}>{links.total ? `${links.total - links.used} of ${links.total} links left` : "No links yet"}</Chip>
                    : <Chip icon={Repeat2} darkMode={darkMode}>Many responses</Chip>}
                </div>

                {/* wraps rather than forcing the card wider than a phone screen */}
                <div className={`mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-3 ${darkMode ? "border-white/[0.07]" : "border-black/[0.07]"}`}>
                  <p className={`min-w-0 flex-1 truncate text-xs font-bold ${muted}`}>
                    {single ? "One link per person" : `/f/${form.slug}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-0.5">
                    <IconButton icon={Pencil} label="Edit form" onClick={() => openEdit(form)} disabled={!canManage} darkMode={darkMode} />
                    <IconButton
                      icon={form.isActive ? Power : RotateCcw}
                      label={form.isActive ? "Stop accepting responses" : "Accept responses again"}
                      onClick={() => toggleActive(form)}
                      disabled={!canManage}
                      darkMode={darkMode}
                    />
                    <IconButton icon={Trash2} label="Delete form" onClick={() => setConfirmDelete(form)} disabled={!canManage} danger darkMode={darkMode} />
                    <button
                      type="button"
                      onClick={() => (single ? setLinksFor(form) : copyText(url))}
                      disabled={single && !canManage}
                      className={`ml-1.5 flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-35 ${darkMode ? colour.solidDark : colour.solid}`}
                    >
                      {single ? <><Ticket className="h-3.5 w-3.5" /> Links</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {linksFor && (
        <LinksDrawer
          form={linksFor}
          darkMode={darkMode}
          publicBase={publicBase}
          onClose={() => { setLinksFor(null); void load(); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDelete(null); }}>
          <div className={`w-full max-w-md rounded-[28px] p-7 ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
            <span className={`grid h-12 w-12 place-items-center rounded-full border ${darkMode ? "border-rose-400/30" : "border-rose-200"}`}><TriangleAlert className="h-6 w-6 text-rose-500" /></span>
            <h3 className="small mt-4 text-2xl font-black">Delete &quot;{confirmDelete.name}&quot;?</h3>
            <p className={`mt-3 text-sm leading-6 ${muted}`}>
              The form, its {confirmDelete.submissionCount} saved response{confirmDelete.submissionCount === 1 ? "" : "s"} and every link to it are removed.
              Rows already written into the spreadsheet stay where they are.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={`h-11 rounded-full px-5 text-sm font-bold ${darkMode ? "bg-white/10" : "bg-[#f3f5ef] text-black/60"}`}>Keep it</button>
              <button type="button" onClick={deleteForm} disabled={deleting} className="flex h-11 items-center gap-2 rounded-full bg-rose-500 px-6 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete form
              </button>
            </div>
          </div>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <form
            onSubmit={(event) => { event.preventDefault(); void save(); }}
            className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}
          >
            <div className={`border-b px-5 py-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-black uppercase tracking-[0.16em] ${muted}`}>Finance</p>
                  <h2 className="small mt-2 text-2xl font-black">{editingId ? "Edit request form" : "New request form"}</h2>
                </div>
                <button type="button" onClick={() => setEditorOpen(false)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/10" : "bg-[#f3f5ef]"}`}><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4">
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Form name</span>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Site material request" className={inputClass} />
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Description</span>
                  <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Shown at the top of the form" className={inputClass} />
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Responses spreadsheet link</span>
                  <input value={draft.spreadsheetId} onChange={(e) => setDraft({ ...draft, spreadsheetId: e.target.value })} placeholder="Leave blank to use the all-projects sheet" className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>Paste the sheet link or its id. Blank means responses go to the all-projects sheet from Settings.</span>
                  {serviceEmail ? (
                    <span className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs ${darkMode ? "bg-white/[0.06]" : "bg-white"}`}>
                      <span className={muted}>Share the sheet with</span>
                      <code className="break-all font-bold">{serviceEmail}</code>
                      <button type="button" onClick={() => copyText(serviceEmail, "Address copied")} className="ml-auto shrink-0" title="Copy address">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Sheet tab for responses</span>
                  <input value={draft.tabName} onChange={(e) => setDraft({ ...draft, tabName: e.target.value })} placeholder="Material Requests" className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>Created with a header row if the tab does not exist yet.</span>
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Drive folder link for uploads <span className="font-normal normal-case">— optional</span></span>
                  <input value={draft.driveFolderId} onChange={(e) => setDraft({ ...draft, driveFolderId: e.target.value })} placeholder="Paste a folder link, or leave blank" className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>Leave blank and files are kept on the dashboard server, with the link written into the sheet. A Drive folder is used when it accepts the file — which in practice means a Shared Drive, since a service account owns no Drive storage of its own.</span>
                </label>

                <div className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Who can submit</span>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[["dashboard", "Dashboard users", Users], ["link", "Anyone with the link", Link2]].map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraft({ ...draft, visibility: value })}
                        className={`flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${draft.visibility === value ? "border-[#6ee72f] bg-[#f2fde9] text-[#10210c]" : darkMode ? "border-white/10" : "border-black/10"}`}
                      >
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>How many times a link works</span>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["multi", "Accept many responses", "One link, filled in as often as you like.", Repeat2],
                      ["single", "One submission per link", "Each person gets their own link that stops working once used.", Ticket],
                    ].map(([value, label, hint, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraft({ ...draft, submissionMode: value })}
                        className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${draft.submissionMode === value ? "border-[#6ee72f] bg-[#f2fde9] text-[#10210c]" : darkMode ? "border-white/10" : "border-black/10"}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4" /> {label}</span>
                        <span className={`text-xs leading-5 ${draft.submissionMode === value ? "text-[#10210c]/70" : muted}`}>{hint}</span>
                      </button>
                    ))}
                  </div>
                  {draft.submissionMode === "single" && (
                    <p className={`mt-3 rounded-xl px-3 py-2.5 text-xs leading-5 ${darkMode ? "bg-white/[0.05] text-white/60" : "bg-black/[0.035] text-black/55"}`}>
                      Save the form, then use <b>Links</b> on its card to make one link per recipient. The plain <code>/f/{"{slug}"}</code> address stops working on its own.
                    </p>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Fields</span>
                  <button type="button" onClick={() => setDraft({ ...draft, fields: [...draft.fields, blankField()] })} className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>
                    <Plus className="h-3.5 w-3.5" /> Add field
                  </button>
                </div>

                {draft.fields.map((field, index) => (
                  <div key={index} className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-black ${muted}`}>Field {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveField(index, -1)} className={`h-7 rounded-lg px-2 text-xs font-black ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>↑</button>
                        <button type="button" onClick={() => moveField(index, 1)} className={`h-7 rounded-lg px-2 text-xs font-black ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>↓</button>
                        {draft.fields.length > 1 && (
                          <button type="button" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })} className="h-7 rounded-lg bg-rose-100 px-2 text-xs font-black text-rose-700">✕</button>
                        )}
                      </div>
                    </div>

                    <input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} placeholder="Question or label" className={inputClass} />

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <select value={field.type} onChange={(e) => updateField(index, { type: e.target.value })} className={inputClass.replace("mt-2 ", "")}>
                        {FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                      <input value={field.sheetColumn} onChange={(e) => updateField(index, { sheetColumn: e.target.value })} placeholder="Sheet column (defaults to label)" className={inputClass.replace("mt-2 ", "")} />
                    </div>

                    {field.type === "select" && (
                      <textarea
                        rows={3}
                        value={field.optionsText ?? (field.options || []).join("\n")}
                        onChange={(e) => updateField(index, { optionsText: e.target.value })}
                        placeholder={"One choice per line"}
                        className={`mt-2 w-full rounded-2xl border p-3 text-sm outline-none ${darkMode ? "border-white/10 bg-[#0d0f13] text-white/80" : "border-black/10 bg-white text-black/75"}`}
                      />
                    )}

                    <div className="mt-3 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm font-bold">
                        <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} className="h-4 w-4 accent-[#6ee72f]" /> Required
                      </label>
                      {field.type !== "file" && (
                        <label className="flex items-center gap-2 text-sm font-bold">
                          <input type="checkbox" checked={field.allowAttachment} onChange={(e) => updateField(index, { allowAttachment: e.target.checked })} className="h-4 w-4 accent-[#6ee72f]" />
                          <Paperclip className="h-3.5 w-3.5" /> Allow a file with this answer
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`flex items-center justify-between gap-3 border-t px-5 py-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/10 bg-white"}`}>
              <button type="button" onClick={() => setEditorOpen(false)} className={`h-11 rounded-full px-5 text-sm font-bold ${darkMode ? "bg-white/10" : "bg-[#f3f5ef] text-black/60"}`}>Cancel</button>
              <button type="submit" disabled={saving} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black hover:bg-[#7dde35] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingId ? "Save changes" : "Create form"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────── one link per person, used once ─────────────────────── */

function LinksDrawer({ form, darkMode, publicBase, onClose }) {
  const [links, setLinks] = useState(null);
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [justMade, setJustMade] = useState([]);

  const muted = darkMode ? "text-white/50" : "text-black/50";
  const inputClass = `h-11 w-full rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-[#0d0f13] text-white/80 placeholder:text-white/30" : "border-black/10 bg-white text-black/75 placeholder:text-black/35"}`;

  const load = useCallback(async () => {
    try {
      const result = await api(`/accounts/forms/${form.id}/links?base=${encodeURIComponent(publicBase)}`);
      setLinks(result.links || []);
    } catch (error) {
      toast.error(error.message || "Could not load links");
      setLinks([]);
    }
  }, [form.id, publicBase]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    try {
      setBusy(true);
      const result = await api(`/accounts/forms/${form.id}/links`, {
        method: "POST",
        body: JSON.stringify({ count: Number(count) || 1, label, base: publicBase }),
      });
      const made = (result.links || []).map((link) => ({ ...link, url: `${publicBase}/f/${form.slug}?t=${link.token}` }));
      setJustMade(made.map((link) => link.id));
      setLabel("");
      setCount(1);
      if (made.length === 1) copyText(made[0].url, "Link created and copied");
      else toast.success(`${made.length} links created`);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not create links");
    } finally {
      setBusy(false);
    }
  }

  async function remove(link) {
    try {
      await api(`/accounts/forms/${form.id}/links/${link.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      toast.error(error.message || "Could not remove the link");
    }
  }

  const unused = (links || []).filter((link) => !link.used);

  return (
    <div className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
        <div className={`border-b px-5 py-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-xs font-black uppercase tracking-[0.16em] ${muted}`}>One-time links</p>
              <h2 className="small mt-2 truncate text-2xl font-black">{form.name}</h2>
              <p className={`mt-2 text-sm ${muted}`}>Every link below accepts exactly one response, then stops working.</p>
            </div>
            <button type="button" onClick={onClose} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/10" : "bg-[#f3f5ef]"}`}><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
            <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Make new links</span>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Who is it for? e.g. Kalhar site" className={inputClass} />
              <input type="number" min={1} max={50} value={count} onChange={(event) => setCount(event.target.value)} className={inputClass} />
            </div>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#6ee72f] text-sm font-black text-[#10210c] transition hover:bg-[#5edb22] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create {Number(count) > 1 ? `${count} links` : "link"}
            </button>
            <p className={`mt-2 text-xs ${muted}`}>A single link is copied to your clipboard straight away.</p>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>
              {links === null ? "Links" : `${unused.length} unused · ${links.length - unused.length} used`}
            </span>
          </div>

          {links === null ? (
            <div className={`mt-4 grid min-h-[100px] place-items-center ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !links.length ? (
            <div className={`mt-4 grid min-h-[120px] place-items-center rounded-2xl border border-dashed p-6 text-center text-sm ${darkMode ? "border-white/10 text-white/45" : "border-black/10 text-black/45"}`}>
              No links yet. Make one for each person you want a response from.
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`rounded-2xl border p-3.5 transition ${link.used
                    ? darkMode ? "border-white/[0.06] bg-white/[0.02] opacity-60" : "border-black/[0.05] bg-[#fafafa] opacity-70"
                    : justMade.includes(link.id)
                      ? darkMode ? "border-white/25 bg-white/[0.06]" : "border-black/25 bg-black/[0.02]"
                      : darkMode ? "border-white/[0.08] bg-white/[0.03]" : "border-black/[0.06] bg-[#fbfbfd]"}`}
                >
                  <div className="flex items-center gap-2">
                    {link.used
                      ? <CircleCheckBig className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/30" : "text-black/25"}`} />
                      : <Ticket className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/45" : "text-black/35"}`} />}
                    <span className="min-w-0 flex-1 truncate text-sm font-black">{link.label || "Unnamed link"}</span>
                    {link.used ? (
                      <span className={`shrink-0 text-[11px] font-black ${darkMode ? "text-white/40" : "text-black/40"}`}>
                        used {new Date(link.usedAt).toLocaleDateString("en-IN")}
                      </span>
                    ) : (
                      <>
                        <button type="button" onClick={() => copyText(link.url)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.06]"}`} title="Copy link">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a href={link.url} target="_blank" rel="noreferrer" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.06]"}`} title="Open">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                    <button type="button" onClick={() => remove(link)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-500/10" title={link.used ? "Remove from the list" : "Cancel this link"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {!link.used && <p className={`mt-2 truncate text-xs ${muted}`}>{link.url}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between gap-3 border-t px-5 py-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/10 bg-white"}`}>
          <span className={`text-xs ${muted}`}>{unused.length} link{unused.length === 1 ? "" : "s"} ready to send</span>
          <button type="button" onClick={onClose} className={`h-11 rounded-full px-6 text-sm font-bold ${darkMode ? "bg-white/10" : "bg-[#f3f5ef] text-black/60"}`}>Done</button>
        </div>
      </div>
    </div>
  );
}
