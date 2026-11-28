"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheckBig, ClipboardList, Copy, CopyPlus, ExternalLink, Info, Maximize2, Minimize2, FilePlus2, Hash, Inbox, Link2, Loader2,
  Paperclip, Pencil, Plus, Power, Repeat2, RotateCcw, Save, Table2, Ticket, Trash2,
  TriangleAlert, Users, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip as KitChip, EmptyState, IconTile, Notice, SectionTitle, Select, toneOf } from "./ui";

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

/* ────────────────────── shared overlay with a close animation ──────────────────────
   The panel has to stay mounted while it slides out, so closing is a two-step:
   mark it closing, let the animation run, then tell the parent to unmount it.   */

const CLOSE_MS = { drawer: 280, modal: 200 };

export function Overlay({ onClose, variant = "drawer", children }) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS[variant]);
  }, [onClose, variant]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      className={`finance-scrim fixed inset-0 z-[65] bg-black/45 ${closing ? "is-closing" : ""} ${variant === "modal" ? "grid place-items-center p-4" : ""}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      {children({ close, closing })}
    </div>
  );
}

/* ───────────────────── which responses have already been seen ─────────────────────
   Kept in the browser rather than on the server: "new to me" is per person, and a
   response Dhwani has read is still new to whoever opens the module next.        */

const SEEN_KEY = "raga_accounts_forms_seen";

function readSeen() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}

function writeSeen(next) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
}

/* ─────────────────────────────── card pieces ───────────────────────────────
   Each form keeps its own colour, picked from its slug so it never moves about
   between reloads. Colour marks identity and state; nothing else is tinted.   */

const PALETTES = ["lavender", "mint", "amber", "rose", "sky", "peach"];

function paletteFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return PALETTES[hash % PALETTES.length];
}

const CHIP_TONES = { amber: "amber", blue: "sky", violet: "lavender", green: "mint", dark: "rose" };

function Chip({ icon, children, tone, darkMode }) {
  return (
    <KitChip icon={icon} tone={tone ? CHIP_TONES[tone] : "neutral"} darkMode={darkMode} className="h-6 shrink-0 px-2.5 text-[12px]">
      {children}
    </KitChip>
  );
}

const ICON_BUTTON_TONES = { blue: "sky", violet: "lavender", emerald: "mint", amber: "amber", rose: "rose", slate: "neutral" };

function IconButton({ icon: Icon, onClick, disabled, label, tone = "slate", darkMode }) {
  const t = toneOf(ICON_BUTTON_TONES[tone] || "neutral");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{ backgroundColor: darkMode ? t[2] : t[0], color: darkMode ? t[3] : t[1] }}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:opacity-80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
    </button>
  );
}

/* Shared look for the Finance drawers: header with an icon tile, a two-line title and a
   round close button; grey pill fields; quiet labels. */

function fieldInput(darkMode, { onSoft = false, extra = "" } = {}) {
  return `h-11 w-full rounded-full border px-4 text-[13.5px] outline-none transition ${extra} ${
    darkMode
      ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10"
      : onSoft
        ? "border-[#ececec] bg-white text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#dcdcd8] focus:ring-[3px] focus:ring-black/[0.05]"
        : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"
  }`;
}

function FieldLabel({ darkMode, label, hint, children, as: Tag = "label" }) {
  return (
    <Tag className="block">
      <span className={`mb-2 block text-[12.5px] ${darkMode ? "text-white/55" : "text-[#7a7a78]"}`}>{label}</span>
      {children}
      {hint ? <span className={`mt-2 block text-[12px] leading-5 ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>{hint}</span> : null}
    </Tag>
  );
}

function DrawerHead({ darkMode, icon, tone = "neutral", title, subtitle, onClose, actions, children }) {
  return (
    <div className={`shrink-0 border-b px-6 py-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] leading-tight tracking-[-0.01em]">{title}</h2>
            {subtitle ? <div className={`mt-1 text-[12.5px] leading-5 ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button type="button" onClick={onClose} aria-label="Close" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function DrawerFoot({ darkMode, children }) {
  return (
    <div className={`flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4 ${darkMode ? "border-white/10 bg-[#121317]" : "border-[#f0f0ee] bg-white"}`}>
      {children}
    </div>
  );
}

const drawerShell = (darkMode) => `border shadow-[0_24px_70px_rgba(0,0,0,0.16)] newq ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`;

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
  const [duplicatedFrom, setDuplicatedFrom] = useState(null);
  const [responsesFor, setResponsesFor] = useState(null);
  const [seen, setSeen] = useState({});

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const cardClass = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const inputClass = fieldInput(darkMode);
  const softInputClass = fieldInput(darkMode, { onSoft: true });
  const choiceClass = (active) => (active
    ? darkMode ? "border-[#cff07a]/50 bg-[#cff07a]/10 text-white" : "border-[#141414] bg-white text-[#141414]"
    : darkMode ? "border-white/10 text-white/75 hover:bg-white/[0.04]" : "border-[#ececec] text-[#3d3d3b] hover:bg-[#f7f7f5]");

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
  useEffect(() => { setSeen(readSeen()); }, []);

  // The list is Mongo-only, so refreshing it costs no Google quota. Poll while the tab is
  // open and catch up the moment it is focused again, so a new response shows up on its own.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  // Opening the responses drawer is what counts as having read them. Both the count and the
  // timestamp are kept: the count is what makes "3 new" possible, and the timestamp catches
  // a response that never reached the sheet, since those never bump the count.
  function markSeen(form) {
    const next = {
      ...readSeen(),
      [form.id]: { count: form.submissionCount, lastAt: form.lastSubmissionAt || null },
    };
    writeSeen(next);
    setSeen(next);
  }

  function openResponses(form) {
    setResponsesFor(form);
    markSeen(form);
  }

  const publicBase = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);

  function openNew() {
    setDraft(emptyDraft());
    setEditingId(null);
    setDuplicatedFrom(null);
    setEditorOpen(true);
  }

  function draftFromForm(form) {
    return {
      name: form.name,
      description: form.description || "",
      tabName: form.tabName || "",
      spreadsheetId: form.spreadsheetId || "",
      driveFolderId: form.driveFolderId || "",
      visibility: form.visibility,
      submissionMode: form.submissionMode || "multi",
      isActive: form.isActive,
      fields: (form.fields || []).map((field) => ({ ...field, options: field.options || [] })),
    };
  }

  function openEdit(form) {
    setDraft(draftFromForm(form));
    setEditingId(form.id);
    setDuplicatedFrom(null);
    setEditorOpen(true);
  }

  // Everything is copied except the responses and the sheet tab. The tab is deliberately
  // renamed: two forms writing the same tab share one header row, so the moment the copy's
  // fields are edited its answers would land under the original's columns.
  function openDuplicate(form) {
    const copy = draftFromForm(form);
    setDraft({
      ...copy,
      name: `${form.name} (copy)`,
      tabName: `${form.tabName || form.name} copy`.slice(0, 90),
    });
    setEditingId(null);
    setDuplicatedFrom(form.name);
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
      toast.success(editingId ? "Form updated" : duplicatedFrom ? "Copy created" : "Form created");
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

  async function deleteForm(close) {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      const result = await api(`/accounts/forms/${confirmDelete.id}`, { method: "DELETE" });
      toast.success(result.submissionsRemoved ? `Form deleted with ${result.submissionsRemoved} response${result.submissionsRemoved === 1 ? "" : "s"}` : "Form deleted");
      close();
      await load();
    } catch (error) {
      toast.error(error.message || "Could not delete the form");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle darkMode={darkMode} title="Your forms" subtitle="each with its own link and sheet tab" />
        <Button
          darkMode={darkMode}
          variant="primary"
          icon={FilePlus2}
          onClick={openNew}
          disabled={!canManage}
          title={canManage ? "" : "Your Google account has view access only"}
          className="shrink-0"
        >
          New form
        </Button>
      </div>

      {loading ? (
        <div className={`grid min-h-[120px] place-items-center text-sm ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !forms.length ? (
        <EmptyState darkMode={darkMode} icon={ClipboardList} tone="lavender" title="No request forms yet" text="Create one and share its link." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {forms.map((form) => {
            const single = form.submissionMode === "single";
            const links = form.links || { total: 0, used: 0 };
            const url = `${publicBase}/f/${form.slug}`;
            const colour = paletteFor(form.slug);
            // Anything that arrived after the card was last opened is new. A submission the
            // sheet rejected still counts — it shows in the drawer, so it must be flagged here.
            const mark = seen[form.id];
            const arrived = mark && form.lastSubmissionAt && (!mark.lastAt || new Date(form.lastSubmissionAt) > new Date(mark.lastAt));
            const extra = mark ? form.submissionCount - mark.count : 0;
            const fresh = arrived || extra > 0 ? Math.max(1, extra) : 0;
            return (
              <article key={form.id} className={`flex min-w-0 flex-col rounded-[20px] border p-5 ${cardClass} ${form.isActive ? "" : "opacity-55"}`}>
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="relative shrink-0">
                    <IconTile icon={ClipboardList} tone={colour} darkMode={darkMode} />
                    {fresh > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center">
                        <span className="finance-ping absolute inset-0 text-emerald-500" />
                        <span className={`relative h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ${darkMode ? "ring-[#15171c]" : "ring-white"}`} />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[16px] leading-tight tracking-[-0.01em]">{form.name}</h3>
                    <p className={`mt-1 truncate text-[13px] ${muted}`}>{form.description || `Responses go to the "${form.tabName}" tab`}</p>
                  </div>
                  <Chip
                    icon={!form.isActive ? Power : form.visibility === "link" ? Link2 : Users}
                    tone={!form.isActive ? "dark" : form.visibility === "link" ? "amber" : "blue"}
                    darkMode={darkMode}
                  >
                    {!form.isActive ? "Closed" : form.visibility === "link" ? "Anyone with link" : "Dashboard only"}
                  </Chip>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Chip icon={Hash} darkMode={darkMode}>{form.fields.length} field{form.fields.length === 1 ? "" : "s"}</Chip>
                  <Chip icon={Table2} darkMode={darkMode}>{form.tabName}</Chip>
                  <button type="button" onClick={() => openResponses(form)} className="rounded-full outline-none transition hover:opacity-70 active:scale-95" title="View responses">
                    {fresh > 0
                      ? <Chip icon={Inbox} tone="green" darkMode={darkMode}>{fresh} new response{fresh === 1 ? "" : "s"}</Chip>
                      : <Chip icon={Inbox} darkMode={darkMode}>{form.submissionCount} response{form.submissionCount === 1 ? "" : "s"}</Chip>}
                  </button>
                  {single
                    ? <Chip icon={Ticket} tone="violet" darkMode={darkMode}>{links.total ? `${links.total - links.used} of ${links.total} links left` : "No links yet"}</Chip>
                    : <Chip icon={Repeat2} darkMode={darkMode}>Many responses</Chip>}
                </div>

                {/* wraps rather than forcing the card wider than a phone screen */}
                <div className={`mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-4 ${darkMode ? "border-white/[0.07]" : "border-[#f0f0ee]"}`}>
                  <p className={`min-w-0 flex-1 truncate text-[12.5px] ${muted}`}>
                    {single ? "One link per person" : `/f/${form.slug}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <IconButton icon={Pencil} label="Edit form" tone="blue" onClick={() => openEdit(form)} disabled={!canManage} darkMode={darkMode} />
                    <IconButton icon={CopyPlus} label="Duplicate form" tone="violet" onClick={() => openDuplicate(form)} disabled={!canManage} darkMode={darkMode} />
                    <IconButton icon={Inbox} label="View responses" tone="emerald" onClick={() => openResponses(form)} darkMode={darkMode} />
                    <IconButton
                      icon={form.isActive ? Power : RotateCcw}
                      label={form.isActive ? "Stop accepting responses" : "Accept responses again"}
                      onClick={() => toggleActive(form)}
                      disabled={!canManage}
                      tone="amber"
                      darkMode={darkMode}
                    />
                    <IconButton icon={Trash2} label="Delete form" tone="rose" onClick={() => setConfirmDelete(form)} disabled={!canManage} darkMode={darkMode} />
                    <Button
                      darkMode={darkMode}
                      variant="primary"
                      size="sm"
                      icon={single ? Ticket : Copy}
                      onClick={() => (single ? setLinksFor(form) : copyText(url))}
                      disabled={single && !canManage}
                      className="ml-1.5 h-9"
                    >
                      {single ? "Links" : "Copy link"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {responsesFor && (
        <ResponsesDrawer form={responsesFor} darkMode={darkMode} onClose={() => setResponsesFor(null)} />
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
        <Overlay variant="modal" onClose={() => setConfirmDelete(null)}>
          {({ close, closing }) => (
          <div className={`finance-modal w-full max-w-md rounded-[24px] border p-6 newq ${closing ? "is-closing" : ""} ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`} style={{ boxShadow: "var(--ui-shadow-pop)" }}>
            <div className="flex items-start gap-3.5">
              <IconTile icon={TriangleAlert} tone="rose" darkMode={darkMode} />
              <div className="min-w-0">
                <h3 className="text-[17px] leading-tight">Delete &quot;{confirmDelete.name}&quot;?</h3>
                <p className={`mt-2 text-[13px] leading-5 ${muted}`}>
                  The form, its {confirmDelete.submissionCount} saved response{confirmDelete.submissionCount === 1 ? "" : "s"} and every link to it are removed.
                  Rows already written into the spreadsheet stay where they are.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button darkMode={darkMode} variant="secondary" onClick={close}>Keep it</Button>
              <Button darkMode={darkMode} variant="danger" icon={Trash2} loading={deleting} onClick={() => deleteForm(close)} disabled={deleting}>Delete form</Button>
            </div>
          </div>
          )}
        </Overlay>
      )}

      {editorOpen && (
        <Overlay onClose={() => setEditorOpen(false)}>
          {({ close, closing }) => (
          <form
            onSubmit={(event) => { event.preventDefault(); void save(); }}
            className={`finance-panel employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden ${closing ? "is-closing" : ""} ${drawerShell(darkMode)}`}
          >
            <DrawerHead
              darkMode={darkMode}
              icon={editingId ? Pencil : duplicatedFrom ? CopyPlus : FilePlus2}
              tone="lavender"
              title={editingId ? "Edit request form" : duplicatedFrom ? "Duplicate request form" : "New request form"}
              subtitle={duplicatedFrom
                ? <>Copied from <span className={darkMode ? "text-white/80" : "text-[#141414]"}>{duplicatedFrom}</span>. Change anything you like — nothing is created until you save, and the original is untouched.</>
                : "Finance · fields, sheet tab and who can submit"}
              onClose={close}
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-5">
                <FieldLabel darkMode={darkMode} label="Form name">
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Site material request" className={inputClass} />
                </FieldLabel>
                <FieldLabel darkMode={darkMode} label="Description">
                  <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Shown at the top of the form" className={inputClass} />
                </FieldLabel>
                <FieldLabel darkMode={darkMode} label="Responses spreadsheet link" hint="Paste the sheet link or its id. Blank means responses go to the all-projects sheet from Settings.">
                  <input value={draft.spreadsheetId} onChange={(e) => setDraft({ ...draft, spreadsheetId: e.target.value })} placeholder="Leave blank to use the all-projects sheet" className={inputClass} />
                  {serviceEmail ? (
                    <span className={`mt-2 flex flex-wrap items-center gap-2 rounded-[14px] px-4 py-2.5 text-[12.5px] ${darkMode ? "bg-white/[0.05]" : "bg-[#f7f7f5]"}`}>
                      <span className={muted}>Share the sheet with</span>
                      <code className="break-all">{serviceEmail}</code>
                      <button type="button" onClick={() => copyText(serviceEmail, "Address copied")} className={`ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.05]"}`} title="Copy address">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                </FieldLabel>
                <FieldLabel darkMode={darkMode} label="Sheet tab for responses" hint="Created with a header row if the tab does not exist yet.">
                  <input value={draft.tabName} onChange={(e) => setDraft({ ...draft, tabName: e.target.value })} placeholder="Material Requests" className={inputClass} />
                </FieldLabel>
                <FieldLabel
                  darkMode={darkMode}
                  label={<>Drive folder link for uploads <span className={darkMode ? "text-white/35" : "text-[#a8a8a5]"}>· optional</span></>}
                  hint="Leave blank and files are kept on the dashboard server, with the link written into the sheet. A Drive folder is used when it accepts the file — which in practice means a Shared Drive, since a service account owns no Drive storage of its own."
                >
                  <input value={draft.driveFolderId} onChange={(e) => setDraft({ ...draft, driveFolderId: e.target.value })} placeholder="Paste a folder link, or leave blank" className={inputClass} />
                </FieldLabel>

                <FieldLabel darkMode={darkMode} label="Who can submit" as="div">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[["dashboard", "Dashboard users", Users], ["link", "Anyone with the link", Link2]].map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraft({ ...draft, visibility: value })}
                        className={`flex h-11 items-center gap-2 rounded-full border px-4 text-[13.5px] transition ${choiceClass(draft.visibility === value)}`}
                      >
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                </FieldLabel>

                <FieldLabel darkMode={darkMode} label="How many times a link works" as="div">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["multi", "Accept many responses", "One link, filled in as often as you like.", Repeat2],
                      ["single", "One submission per link", "Each person gets their own link that stops working once used.", Ticket],
                    ].map(([value, label, hint, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraft({ ...draft, submissionMode: value })}
                        className={`flex flex-col gap-1 rounded-[16px] border p-4 text-left transition ${choiceClass(draft.submissionMode === value)}`}
                      >
                        <span className="flex items-center gap-2 text-[13.5px]"><Icon className="h-4 w-4" /> {label}</span>
                        <span className={`text-[12px] leading-5 ${muted}`}>{hint}</span>
                      </button>
                    ))}
                  </div>
                  {draft.submissionMode === "single" && (
                    <Notice tone="neutral" darkMode={darkMode} className="mt-2">
                      Save the form, then use Links on its card to make one link per recipient. The plain <code>/f/{"{slug}"}</code> address stops working on its own.
                    </Notice>
                  )}
                </FieldLabel>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[17px] tracking-[-0.01em]">Fields <span className={muted}>· {draft.fields.length}</span></p>
                  <Button darkMode={darkMode} variant="soft" size="sm" icon={Plus} onClick={() => setDraft({ ...draft, fields: [...draft.fields, blankField()] })}>
                    Add field
                  </Button>
                </div>

                {draft.fields.map((field, index) => (
                  <div key={index} className={`rounded-[18px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[12.5px] ${muted}`}>Field {String(index + 1).padStart(2, "0")}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveField(index, -1)} aria-label="Move up" className={`grid h-7 w-7 place-items-center rounded-full text-[12px] ${darkMode ? "bg-white/10" : "bg-white"}`}>↑</button>
                        <button type="button" onClick={() => moveField(index, 1)} aria-label="Move down" className={`grid h-7 w-7 place-items-center rounded-full text-[12px] ${darkMode ? "bg-white/10" : "bg-white"}`}>↓</button>
                        {draft.fields.length > 1 && (
                          <button type="button" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })} aria-label="Remove field" className={`grid h-7 w-7 place-items-center rounded-full ${darkMode ? "bg-rose-400/15 text-rose-200" : "bg-[#fbe4e6] text-[#c0394b]"}`}><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </div>

                    <input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} placeholder="Question or label" className={`mt-3 ${softInputClass}`} />

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Select darkMode={darkMode} value={field.type} onChange={(e) => updateField(index, { type: e.target.value })}>
                        {FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </Select>
                      <input value={field.sheetColumn} onChange={(e) => updateField(index, { sheetColumn: e.target.value })} placeholder="Sheet column (defaults to label)" className={softInputClass} />
                    </div>

                    {field.type === "select" && (
                      <textarea
                        rows={3}
                        value={field.optionsText ?? (field.options || []).join("\n")}
                        onChange={(e) => updateField(index, { optionsText: e.target.value })}
                        placeholder={"One choice per line"}
                        className={`mt-2 w-full rounded-[16px] border p-3 text-[13.5px] outline-none ${darkMode ? "border-transparent bg-white/[0.06] text-white/85" : "border-[#ececec] bg-white text-[#141414]"}`}
                      />
                    )}

                    <div className="mt-3 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-[13px]">
                        <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} className="h-4 w-4 accent-[#141414]" /> Required
                      </label>
                      {field.type !== "file" && (
                        <label className="flex items-center gap-2 text-[13px]">
                          <input type="checkbox" checked={field.allowAttachment} onChange={(e) => updateField(index, { allowAttachment: e.target.checked })} className="h-4 w-4 accent-[#141414]" />
                          <Paperclip className="h-3.5 w-3.5" /> Allow a file with this answer
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DrawerFoot darkMode={darkMode}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={close}>Cancel</Button>
              <Button darkMode={darkMode} variant="primary" size="lg" type="submit" icon={Save} loading={saving} disabled={saving}>
                {editingId ? "Save changes" : duplicatedFrom ? "Create the copy" : "Create form"}
              </Button>
            </DrawerFoot>
          </form>
          )}
        </Overlay>
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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const inputClass = fieldInput(darkMode, { onSoft: true });

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
    <Overlay onClose={onClose}>
      {({ close, closing }) => (
      <div className={`finance-panel employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden ${closing ? "is-closing" : ""} ${drawerShell(darkMode)}`}>
        <DrawerHead
          darkMode={darkMode}
          icon={Ticket}
          tone="lavender"
          title={form.name}
          subtitle="One-time links · each accepts exactly one response, then stops working"
          onClose={close}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className={`rounded-[20px] p-5 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
            <p className="text-[15px]">Make new links</p>
            <p className={`mt-0.5 text-[12.5px] ${muted}`}>A single link is copied to your clipboard straight away.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Who is it for? e.g. Kalhar site" className={inputClass} />
              <input type="number" min={1} max={50} value={count} onChange={(event) => setCount(event.target.value)} className={inputClass} />
            </div>
            <Button darkMode={darkMode} variant="primary" size="lg" icon={Plus} loading={busy} onClick={create} disabled={busy} className="mt-3 w-full">
              Create {Number(count) > 1 ? `${count} links` : "link"}
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className={`text-[12.5px] ${muted}`}>
              {links === null ? "Links" : `${unused.length} unused · ${links.length - unused.length} used`}
            </span>
          </div>

          {links === null ? (
            <div className={`mt-4 grid min-h-[100px] place-items-center ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !links.length ? (
            <EmptyState darkMode={darkMode} icon={Ticket} tone="lavender" title="No links yet" text="Make one for each person you want a response from." className="mt-3 py-10" />
          ) : (
            <div className="mt-3 grid gap-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`rounded-[14px] border px-4 py-3 transition ${link.used
                    ? darkMode ? "border-transparent bg-white/[0.02] opacity-60" : "border-transparent bg-[#f7f7f5] opacity-70"
                    : justMade.includes(link.id)
                      ? darkMode ? "border-[#cff07a]/40 bg-[#cff07a]/10" : "border-[#c9e47a] bg-[#eef8cc]"
                      : darkMode ? "border-transparent bg-white/[0.04]" : "border-transparent bg-[#f7f7f5]"}`}
                >
                  <div className="flex items-center gap-2">
                    {link.used
                      ? <CircleCheckBig className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/30" : "text-[#a8a8a5]"}`} />
                      : <Ticket className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/45" : "text-[#6b4fd1]"}`} />}
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{link.label || "Unnamed link"}</span>
                    {link.used ? (
                      <span className={`shrink-0 text-[12px] ${muted}`}>
                        used {new Date(link.usedAt).toLocaleDateString("en-IN")}
                      </span>
                    ) : (
                      <>
                        <button type="button" onClick={() => copyText(link.url)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-white"}`} title="Copy link">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a href={link.url} target="_blank" rel="noreferrer" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-white"}`} title="Open">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                    <button type="button" onClick={() => remove(link)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#c0394b] transition hover:bg-[#fbe4e6]" title={link.used ? "Remove from the list" : "Cancel this link"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {!link.used && <p className={`mt-1.5 truncate pl-6 text-[12px] ${muted}`}>{link.url}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DrawerFoot darkMode={darkMode}>
          <span className={`text-[12.5px] ${muted}`}>{unused.length} link{unused.length === 1 ? "" : "s"} ready to send</span>
          <Button darkMode={darkMode} variant="primary" size="lg" onClick={close}>Done</Button>
        </DrawerFoot>
      </div>
      )}
    </Overlay>
  );
}


/* ─────────────────── responses, read back out of the sheet ─────────────────── */

function ResponsesDrawer({ form, darkMode, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  // A response table is wide by nature, so this one opens wider than the other panels
  // and can take the whole window when a form has a lot of columns.
  const [expanded, setExpanded] = useState(false);

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setData(await api(`/accounts/forms/${form.id}/responses`));
    } catch (error) {
      toast.error(error.message || "Could not load responses");
      setData({ headers: [], rows: [], unsynced: [], problem: error.message });
    } finally {
      setBusy(false);
    }
  }, [form.id]);

  useEffect(() => { void load(); }, [load]);

  // Hides the row without deleting the submission — the server keeps it either way.
  async function dismiss({ id, all } = {}) {
    const before = data;
    setData((current) => ({
      ...current,
      unsynced: all ? [] : (current.unsynced || []).filter((item) => item.id !== id),
    }));
    try {
      await api(`/accounts/forms/${form.id}/unsynced/dismiss`, {
        method: "POST",
        body: JSON.stringify(all ? { all: true } : { id }),
      });
    } catch (error) {
      setData(before);
      toast.error(error.message || "Could not dismiss");
    }
  }

  const rows = data?.rows || [];
  const headers = data?.headers || [];
  const unsynced = data?.unsynced || [];

  return (
    <Overlay onClose={onClose}>
      {({ close, closing }) => (
      <div className={`finance-panel employee-report-shell employee-report-drawer absolute flex flex-col overflow-hidden ${expanded ? "employee-report-shell-expanded" : ""} ${closing ? "is-closing" : ""} ${drawerShell(darkMode)}`}>
        <DrawerHead
          darkMode={darkMode}
          icon={Inbox}
          tone="mint"
          title={form.name}
          subtitle={<>Responses · read straight from the &quot;{form.tabName}&quot; tab, so edits made in the sheet show here too.</>}
          onClose={close}
          actions={(
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              title={expanded ? "Shrink the panel" : "Fill the window"}
              aria-label={expanded ? "Shrink the panel" : "Fill the window"}
              className={`hidden h-9 w-9 place-items-center rounded-full transition active:scale-95 sm:grid ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
        >
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {data?.sheetUrl ? (
              <a
                href={data.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "bg-white/[0.07] hover:bg-white/[0.11]" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open the sheet
              </a>
            ) : null}
            <Button darkMode={darkMode} variant="soft" size="sm" icon={RotateCcw} loading={busy} onClick={load} disabled={busy}>
              Refresh
            </Button>
            {data && !data.problem ? (
              <span className={`text-[12.5px] ${muted}`}>
                {data.totalRows} row{data.totalRows === 1 ? "" : "s"}{data.truncated ? ` · newest ${rows.length} shown` : ""}
              </span>
            ) : null}
          </div>
        </DrawerHead>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {data?.problem ? (
            <Notice tone="amber" darkMode={darkMode} icon={TriangleAlert}>{data.problem}</Notice>
          ) : null}

          {/* The chip counts every response ever accepted; the table shows what is in the tab
              right now. They drift apart if rows are deleted in the sheet, or if the form
              was pointed at a different tab after some responses had already been written. */}
          {data && !data.problem && form.submissionCount > data.totalRows ? (
            <Notice tone="neutral" darkMode={darkMode} icon={Info} className="mt-4">
              This form has accepted {form.submissionCount} response{form.submissionCount === 1 ? "" : "s"} in total, but the
              &quot;{form.tabName}&quot; tab holds {data.totalRows}. The rest were either removed in the sheet, or written before the
              form was pointed at this tab.
            </Notice>
          ) : null}

          {unsynced.length ? (
            <div className={`mt-4 rounded-[18px] p-4 ${darkMode ? "bg-rose-400/10" : "bg-[#fbe4e6]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`flex items-center gap-2 text-[13.5px] ${darkMode ? "text-rose-200" : "text-[#c0394b]"}`}>
                  <TriangleAlert className="h-4 w-4" /> {unsynced.length} response{unsynced.length === 1 ? "" : "s"} never reached the sheet
                </p>
                <Button darkMode={darkMode} variant="secondary" size="sm" onClick={() => dismiss({ all: true })} className="shrink-0">
                  Dismiss all
                </Button>
              </div>
              <div className="mt-3 grid gap-2">
                {unsynced.map((item) => (
                  <div key={item.id} className={`flex items-start gap-3 rounded-[14px] p-3 text-[12.5px] ${darkMode ? "bg-white/[0.05]" : "bg-white"}`}>
                    <div className="min-w-0 flex-1">
                      <p>{new Date(item.submittedAt).toLocaleString("en-IN")} · {item.submittedBy}</p>
                      <p className={`mt-1 break-words ${muted}`}>{Object.entries(item.answers).map(([key, value]) => `${key}: ${value}`).join(" · ") || "no answers"}</p>
                      {item.syncError ? <p className="mt-1 text-[#c0394b]">{item.syncError}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss({ id: item.id })}
                      title="Dismiss this one"
                      aria-label="Dismiss this one"
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition active:scale-95 ${darkMode ? "text-white/40 hover:bg-white/10 hover:text-white/70" : "text-[#a8a8a5] hover:bg-[#f4f4f2] hover:text-[#141414]"}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className={`mt-3 text-[12px] ${muted}`}>Dismissing only clears this panel — the response itself is kept.</p>
            </div>
          ) : null}

          {!data ? (
            <div className={`grid min-h-[160px] place-items-center ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !rows.length && !data.problem ? (
            <EmptyState darkMode={darkMode} icon={Inbox} tone="mint" title="No responses yet" text="They appear here as soon as someone submits the form." className="mt-4" />
          ) : rows.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                    <th className={`whitespace-nowrap px-3 py-2.5 text-[12px] ${muted}`}>#</th>
                    {headers.map((header, index) => (
                      <th key={`${header}-${index}`} className={`whitespace-nowrap px-3 py-2.5 text-[12px] ${muted}`}>{header || `Column ${index + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={`border-b ${darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]"}`}>
                      <td className={`whitespace-nowrap px-3 py-3 tabular-nums ${muted}`}>{data.totalRows - rowIndex}</td>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="max-w-[280px] px-3 py-3 align-top">
                          {/^https?:\/\//.test(cell)
                            ? <a href={cell} target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${darkMode ? "text-[#a9cbf7] decoration-[#a9cbf7]/40" : "text-[#2f6fc0] decoration-[#2f6fc0]/30"}`}>open file</a>
                            : <span className="break-words">{cell}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <DrawerFoot darkMode={darkMode}>
          <span className={`truncate text-[12.5px] ${muted}`}>Tab &quot;{form.tabName}&quot;</span>
          <Button darkMode={darkMode} variant="primary" size="lg" onClick={close}>Done</Button>
        </DrawerFoot>
      </div>
      )}
    </Overlay>
  );
}
