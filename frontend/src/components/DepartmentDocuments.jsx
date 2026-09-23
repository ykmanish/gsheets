"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  FolderLock,
  FolderPlus,
  HardDrive,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sheet,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, getStoredAuth } from "./AuthProvider";
import { ConfirmModal, DocumentIcon, SelectMenu } from "./ui";

async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: isForm ? options.headers || {} : { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

// XHR instead of fetch so large uploads can report progress. The global fetch
// patch doesn't cover XHR, so the session token is attached here.
function uploadWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    const { token } = getStoredAuth();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(formData);
  });
}

const COLOR_STYLES = {
  emerald: { dot: "bg-emerald-500", soft: "bg-emerald-500/10 text-emerald-600", softDark: "bg-emerald-400/12 text-emerald-200" },
  sky: { dot: "bg-sky-500", soft: "bg-sky-500/10 text-sky-600", softDark: "bg-sky-400/12 text-sky-200" },
  violet: { dot: "bg-violet-500", soft: "bg-violet-500/10 text-violet-600", softDark: "bg-violet-400/12 text-violet-200" },
  amber: { dot: "bg-amber-500", soft: "bg-amber-500/10 text-amber-700", softDark: "bg-amber-400/12 text-amber-200" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-500/10 text-rose-600", softDark: "bg-rose-400/12 text-rose-200" },
  teal: { dot: "bg-teal-500", soft: "bg-teal-500/10 text-teal-600", softDark: "bg-teal-400/12 text-teal-200" },
  indigo: { dot: "bg-indigo-500", soft: "bg-indigo-500/10 text-indigo-600", softDark: "bg-indigo-400/12 text-indigo-200" },
  orange: { dot: "bg-orange-500", soft: "bg-orange-500/10 text-orange-600", softDark: "bg-orange-400/12 text-orange-200" },
};

const TYPE_META = {
  file: { label: "File", icon: FileUp },
  sheet: { label: "Google Sheet", icon: Sheet },
  form: { label: "Form", icon: ClipboardList },
  link: { label: "Link", icon: Link2 },
};

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "file", label: "Files" },
  { id: "sheet", label: "Sheets" },
  { id: "form", label: "Forms" },
  { id: "link", label: "Links" },
];

function colorStyle(color, darkMode) {
  const style = COLOR_STYLES[color] || COLOR_STYLES.emerald;
  return { dot: style.dot, soft: darkMode ? style.softDark : style.soft };
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function documentHref(doc) {
  if (doc.type === "form" && doc.formId) return `/forms?form=${encodeURIComponent(doc.formId)}`;
  return doc.url || "";
}

function Modal({ darkMode, title, subtitle, eyebrow, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#171714]/60 p-4 backdrop-blur-md sm:p-7">
      <div className={`flex max-h-[92vh] w-full flex-col ${wide ? "max-w-3xl" : "max-w-xl"} overflow-hidden rounded-[30px] border ${darkMode ? "border-white/10 bg-[#151612] text-white" : "border-black/10 bg-[#faf9f5] text-[#171714]"}`}>
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
          <div className="min-w-0">
            {eyebrow && <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>{eyebrow}</p>}
            <h3 className="small text-2xl font-semibold">{title}</h3>
            {subtitle && <p className={`mt-1 text-sm ${darkMode ? "text-white/48" : "text-black/48"}`}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer && <div className={`flex shrink-0 flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>{footer}</div>}
      </div>
    </div>
  );
}

// `group` renders a div: a <label> forwards clicks on its text to the first
// control inside, which would toggle the first checkbox/colour in a list.
function Field({ darkMode, label, hint, group = false, children }) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.14em] ${darkMode ? "text-white/55" : "text-black/50"}`}>{label}</span>
      {children}
      {hint && <span className={`mt-1.5 block text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{hint}</span>}
    </Wrapper>
  );
}

function inputClass(darkMode) {
  return `h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10"}`;
}

function textareaClass(darkMode) {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10"}`;
}

function PrimaryButton({ darkMode, children, className = "", ...props }) {
  return (
    <button type="button" {...props} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-[#151612] hover:bg-[#e3f78f]" : "bg-[#171714] text-white hover:bg-black"} ${className}`}>
      {children}
    </button>
  );
}

function GhostButton({ darkMode, children, className = "", ...props }) {
  return (
    <button type="button" {...props} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/[0.04] text-black hover:bg-black/[0.07]"} ${className}`}>
      {children}
    </button>
  );
}

function IconButton({ darkMode, label, danger = false, children, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...props}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40 ${danger
        ? darkMode ? "text-red-300 hover:bg-red-500/15" : "text-red-500 hover:bg-red-50"
        : darkMode ? "text-white/65 hover:bg-white/10 hover:text-white" : "text-black/55 hover:bg-black/[0.06] hover:text-black"}`}
    >
      {children}
    </button>
  );
}

function CheckList({ darkMode, items, selected, onToggle, emptyText, searchPlaceholder = "Search" }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => `${item.label} ${item.hint || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className={`overflow-hidden rounded-2xl border ${darkMode ? "border-white/10" : "border-black/10"}`}>
      {items.length > 6 && (
        <div className={`flex items-center gap-2 border-b px-4 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
          <Search className={`h-4 w-4 ${darkMode ? "text-white/35" : "text-black/35"}`} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className={`h-11 w-full bg-transparent text-sm outline-none ${darkMode ? "placeholder:text-white/35" : "placeholder:text-black/35"}`} />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 && <p className={`px-4 py-4 text-sm ${darkMode ? "text-white/40" : "text-black/40"}`}>{emptyText}</p>}
        {filtered.map((item) => {
          const active = selected.includes(item.id);
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${darkMode ? "hover:bg-white/5" : "hover:bg-black/[0.03]"}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-[#151612]" : "border-[#171714] bg-[#171714] text-white" : darkMode ? "border-white/20" : "border-black/20"}`}>
                {active && <Check className="h-3.5 w-3.5" />}
              </span>
              {item.dot && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.label}</span>
                {item.hint && <span className={`block truncate text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{item.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Admin: create / edit department ----------

function DepartmentModal({ darkMode, department, colors, users, serviceAccountEmail, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState(() => ({
    name: department?.name || "",
    description: department?.description || "",
    color: department?.color || colors[0] || "emerald",
    memberUserIds: department?.memberUserIds || [],
    driveFolder: department?.driveFolderId ? department.driveFolderUrl : "",
  }));
  const [verified, setVerified] = useState(department?.driveFolderName ? { name: department.driveFolderName } : null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleMember = (id) => set("memberUserIds", form.memberUserIds.includes(id) ? form.memberUserIds.filter((item) => item !== id) : [...form.memberUserIds, id]);

  async function verify() {
    if (!form.driveFolder.trim()) return toast.error("Paste the shared drive folder link first");
    setVerifying(true);
    try {
      const data = await api("/department-documents/verify-drive", { method: "POST", body: JSON.stringify({ driveFolder: form.driveFolder }) });
      setVerified({ name: data.folderName });
      toast.success(`Folder "${data.folderName}" is ready`);
    } catch (error) {
      setVerified(null);
      toast.error(error.message);
    } finally {
      setVerifying(false);
    }
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Give the department a name");
    setSaving(true);
    try {
      if (department) await api(`/department-documents/departments/${department.id}`, { method: "PATCH", body: JSON.stringify(form) });
      else await api("/department-documents/departments", { method: "POST", body: JSON.stringify(form) });
      toast.success(department ? "Department updated" : "Department created");
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      darkMode={darkMode}
      wide
      eyebrow="Admin"
      title={department ? `Edit ${department.name}` : "New department"}
      subtitle="Members see only this department's folder and documents shared with it."
      onClose={onClose}
      footer={(
        <>
          {department && (
            <button type="button" onClick={onDelete} className={`mr-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${darkMode ? "text-red-300 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}>
              <Trash2 className="h-4 w-4" /> Delete department
            </button>
          )}
          <GhostButton darkMode={darkMode} onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton darkMode={darkMode} onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {department ? "Save changes" : "Create department"}
          </PrimaryButton>
        </>
      )}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <Field darkMode={darkMode} label="Name">
            <input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Accounts" maxLength={80} className={inputClass(darkMode)} />
          </Field>
          <Field darkMode={darkMode} label="Description">
            <textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows={3} maxLength={400} placeholder="What this department keeps here" className={textareaClass(darkMode)} />
          </Field>
          <Field darkMode={darkMode} label="Colour" group>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => set("color", color)}
                  aria-label={color}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition ${colorStyle(color, darkMode).dot} ${form.color === color ? `ring-2 ${darkMode ? "ring-white ring-offset-[#151612]" : "ring-black ring-offset-[#faf9f5]"}` : ""}`}
                >
                  {form.color === color && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </Field>
          <Field
            darkMode={darkMode}
            label="Shared drive folder"
            hint={serviceAccountEmail ? `Uploads go here. The folder must be in a Google Shared Drive and shared with ${serviceAccountEmail} as Content manager.` : "Uploads go here. The folder must be in a Google Shared Drive."}
          >
            <div className="flex gap-2">
              <input
                value={form.driveFolder}
                onChange={(event) => { set("driveFolder", event.target.value); setVerified(null); }}
                placeholder="https://drive.google.com/drive/folders/…"
                className={inputClass(darkMode)}
              />
              <GhostButton darkMode={darkMode} onClick={verify} disabled={verifying} className="shrink-0 px-4">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify
              </GhostButton>
            </div>
            {verified && (
              <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-emerald-400/12 text-emerald-200" : "bg-emerald-50 text-emerald-700"}`}>
                <HardDrive className="h-3.5 w-3.5" /> {verified.name}
              </span>
            )}
          </Field>
        </div>
        <Field darkMode={darkMode} group label={`Members (${form.memberUserIds.length})`} hint="Members can upload, edit, delete and share documents in this department.">
          <CheckList
            darkMode={darkMode}
            items={users.map((user) => ({ id: user.id, label: user.displayName, hint: [user.designation, user.department].filter(Boolean).join(" · ") || user.username }))}
            selected={form.memberUserIds}
            onToggle={toggleMember}
            emptyText="No users found"
            searchPlaceholder="Search users"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Add / edit document ----------

const ADD_TABS = [
  { id: "file", label: "Upload", icon: UploadCloud },
  { id: "sheet", label: "Sheet", icon: Sheet },
  { id: "form", label: "Form", icon: ClipboardList },
  { id: "link", label: "Link", icon: Link2 },
];

function DocumentModal({ darkMode, department, document, initialType = "file", forms, categories, maxUploadBytes, onClose, onSaved }) {
  const editing = Boolean(document);
  const [type, setType] = useState(document?.type || initialType);
  const [form, setForm] = useState(() => ({
    name: document?.name || "",
    description: document?.description || "",
    category: document?.category || "",
    url: document?.url || "",
    formId: document?.formId || "",
    formSource: document?.type === "form" && !document?.formId && document?.url ? "external" : "internal",
  }));
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function pickFile(next) {
    if (!next) return;
    if (maxUploadBytes && next.size > maxUploadBytes) return toast.error(`Files must be ${formatBytes(maxUploadBytes)} or smaller`);
    setFile(next);
  }

  async function save() {
    setSaving(true);
    try {
      if (type === "file") {
        if (!editing && !file) throw new Error("Choose a file to upload");
        if (editing) {
          await api(`/department-documents/documents/${document.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name, description: form.description, category: form.category }) });
          if (file) {
            const data = new FormData();
            data.append("file", file);
            setProgress(0);
            await uploadWithProgress(`/department-documents/documents/${document.id}/replace`, data, setProgress);
          }
        } else {
          const data = new FormData();
          data.append("file", file);
          data.append("name", form.name);
          data.append("description", form.description);
          data.append("category", form.category);
          setProgress(0);
          await uploadWithProgress(`/department-documents/departments/${department.id}/documents/upload`, data, setProgress);
        }
      } else {
        const payload = {
          type,
          name: form.name,
          description: form.description,
          category: form.category,
          ...(type === "form" && form.formSource === "internal" ? { formId: form.formId, url: "" } : { url: form.url, formId: "" }),
        };
        if (type === "form" && form.formSource === "internal" && !form.formId) throw new Error("Pick a form");
        if (editing) await api(`/department-documents/documents/${document.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        else await api(`/department-documents/departments/${department.id}/documents/link`, { method: "POST", body: JSON.stringify(payload) });
      }
      toast.success(editing ? "Document updated" : "Document added");
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const categoryListId = "department-document-categories";
  return (
    <Modal
      darkMode={darkMode}
      eyebrow={department?.name || document?.departmentName}
      title={editing ? "Edit document" : "Add document"}
      onClose={saving ? () => {} : onClose}
      footer={(
        <>
          <GhostButton darkMode={darkMode} onClick={onClose} disabled={saving}>Cancel</GhostButton>
          <PrimaryButton darkMode={darkMode} onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {progress !== null ? `Uploading ${progress}%` : editing ? "Save changes" : type === "file" ? "Upload" : "Add"}
          </PrimaryButton>
        </>
      )}
    >
      {!editing && (
        <div className={`mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1 sm:grid-cols-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.04]"}`}>
          {ADD_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = type === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setType(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? darkMode ? "bg-[#d8f36a] text-[#151612]" : "bg-white text-black shadow-sm" : darkMode ? "text-white/60 hover:text-white" : "text-black/55 hover:text-black"}`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-5">
        {type === "file" && (
          <div>
            {!department?.driveConfigured && !editing && (
              <p className={`mb-3 rounded-2xl px-4 py-3 text-sm ${darkMode ? "bg-amber-400/10 text-amber-200" : "bg-amber-50 text-amber-800"}`}>
                An admin hasn&apos;t linked a shared drive folder to this department yet, so uploads will fail. Sheet, form and link documents still work.
              </p>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); pickFile(event.dataTransfer.files?.[0]); }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition ${dragging ? darkMode ? "border-[#d8f36a] bg-[#d8f36a]/5" : "border-black bg-black/[0.03]" : darkMode ? "border-white/15 hover:border-white/30" : "border-black/15 hover:border-black/30"}`}
            >
              <UploadCloud className={`h-8 w-8 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              {file ? (
                <>
                  <span className="max-w-full truncate text-sm font-semibold">{file.name}</span>
                  <span className={`text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{formatBytes(file.size)} · click to change</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold">{editing ? "Replace with a new version (optional)" : "Drop a file here or click to browse"}</span>
                  <span className={`text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>Stored in the department&apos;s shared drive folder{maxUploadBytes ? ` · up to ${formatBytes(maxUploadBytes)}` : ""}</span>
                </>
              )}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = ""; }} />
            {progress !== null && (
              <div className={`mt-3 h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/10"}`}>
                <div className={`h-full rounded-full transition-all ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        {type === "sheet" && (
          <Field darkMode={darkMode} label="Google Sheet link" hint="Anyone opening it still needs access to the sheet in Google.">
            <input value={form.url} onChange={(event) => set("url", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className={inputClass(darkMode)} />
          </Field>
        )}

        {type === "form" && (
          <>
            <div className={`grid grid-cols-2 gap-1 rounded-2xl p-1 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.04]"}`}>
              {[{ id: "internal", label: "Workspace form" }, { id: "external", label: "External link" }].map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => set("formSource", option.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${form.formSource === option.id ? darkMode ? "bg-white/10 text-white" : "bg-white text-black shadow-sm" : darkMode ? "text-white/55" : "text-black/50"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {form.formSource === "internal" ? (
              <Field darkMode={darkMode} group label="Form" hint={forms.length ? "Opens in the Forms module; the form's own access rules still apply." : "No workspace forms exist yet."}>
                <SelectMenu
                  darkMode={darkMode}
                  value={form.formId}
                  onChange={(value) => set("formId", value)}
                  options={forms.map((item) => ({ value: item.id, label: item.department ? `${item.name} · ${item.department}` : item.name }))}
                  placeholder="Choose a form"
                  searchable
                  searchPlaceholder="Search forms"
                />
              </Field>
            ) : (
              <Field darkMode={darkMode} label="Form link" hint="Google Forms, Microsoft Forms, or any other form URL.">
                <input value={form.url} onChange={(event) => set("url", event.target.value)} placeholder="https://forms.gle/…" className={inputClass(darkMode)} />
              </Field>
            )}
          </>
        )}

        {type === "link" && (
          <Field darkMode={darkMode} label="Link">
            <input value={form.url} onChange={(event) => set("url", event.target.value)} placeholder="https://…" className={inputClass(darkMode)} />
          </Field>
        )}

        <Field darkMode={darkMode} label="Name" hint={editing ? undefined : "Leave blank to use the file, sheet or form name."}>
          <input value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={160} placeholder="Document name" className={inputClass(darkMode)} />
        </Field>
        <Field darkMode={darkMode} label="Category" hint="Optional. Group documents, e.g. Invoices, Policies, Drawings.">
          <input value={form.category} onChange={(event) => set("category", event.target.value)} list={categoryListId} maxLength={60} placeholder="Uncategorised" className={inputClass(darkMode)} />
          <datalist id={categoryListId}>
            {categories.map((category) => <option key={category} value={category} />)}
          </datalist>
        </Field>
        <Field darkMode={darkMode} label="Description">
          <textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows={3} maxLength={1000} placeholder="Optional notes" className={textareaClass(darkMode)} />
        </Field>
      </div>
    </Modal>
  );
}

function ShareModal({ darkMode, document, shareTargets, onClose, onSaved }) {
  const [selected, setSelected] = useState(() => document.sharedWith.map((item) => item.id));
  const [saving, setSaving] = useState(false);
  const targets = shareTargets.filter((target) => target.id !== document.departmentId);

  async function save() {
    setSaving(true);
    try {
      await api(`/department-documents/documents/${document.id}/share`, { method: "PUT", body: JSON.stringify({ departmentIds: selected }) });
      toast.success(selected.length ? `Shared with ${selected.length} department${selected.length === 1 ? "" : "s"}` : "Sharing removed");
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      darkMode={darkMode}
      eyebrow="Share"
      title={document.name}
      subtitle="Chosen departments can open this document but can't edit, delete or re-share it."
      onClose={onClose}
      footer={(
        <>
          <GhostButton darkMode={darkMode} onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton darkMode={darkMode} onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save sharing
          </PrimaryButton>
        </>
      )}
    >
      <CheckList
        darkMode={darkMode}
        items={targets.map((target) => ({ id: target.id, label: target.name, dot: colorStyle(target.color, darkMode).dot }))}
        selected={selected}
        onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
        emptyText="There are no other departments to share with."
        searchPlaceholder="Search departments"
      />
    </Modal>
  );
}

// ---------- Document row ----------

function DocumentRow({ darkMode, doc, shared, onOpen, onDownload, onEdit, onShare, onDelete, busy }) {
  const meta = TYPE_META[doc.type] || TYPE_META.link;
  const iconDoc = doc.type === "file" ? { name: doc.originalName || doc.name } : doc.type === "sheet" ? { type: "sheet" } : null;
  const TypeIcon = meta.icon;
  const details = [
    meta.label,
    doc.type === "file" ? formatBytes(doc.size) : "",
    doc.updatedBy?.name ? `by ${doc.updatedBy.name}` : "",
    formatDate(doc.updatedAt),
  ].filter(Boolean);

  return (
    <div className={`group flex flex-col gap-3 rounded-3xl border px-4 py-4 transition sm:flex-row sm:items-center sm:px-5 ${darkMode ? "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]" : "border-black/[0.06] bg-white hover:border-black/10"}`}>
      <button type="button" onClick={() => onOpen(doc)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${darkMode ? "bg-white/[0.06]" : "bg-black/[0.04]"}`}>
          {iconDoc ? <DocumentIcon doc={iconDoc} darkMode={darkMode} className="h-5 w-5" /> : <TypeIcon className={`h-5 w-5 ${doc.type === "form" ? "text-violet-500" : darkMode ? "text-sky-300" : "text-sky-600"}`} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{doc.name}</span>
            {doc.category && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${darkMode ? "bg-white/10 text-white/70" : "bg-black/[0.05] text-black/60"}`}>{doc.category}</span>}
          </span>
          {doc.description && <span className={`mt-0.5 block truncate text-sm ${darkMode ? "text-white/50" : "text-black/50"}`}>{doc.description}</span>}
          <span className={`mt-1 block text-xs ${darkMode ? "text-white/38" : "text-black/40"}`}>{details.join(" · ")}</span>
          {shared && <span className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold ${darkMode ? "text-sky-300" : "text-sky-700"}`}><Share2 className="h-3 w-3" /> From {doc.departmentName}</span>}
          {!shared && doc.sharedWith.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {doc.sharedWith.map((target) => (
                <span key={target.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${darkMode ? "bg-sky-400/12 text-sky-200" : "bg-sky-50 text-sky-700"}`}>
                  <Share2 className="h-3 w-3" /> {target.name}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
        {busy ? <Loader2 className="mx-2 h-4 w-4 animate-spin" /> : (
          <IconButton darkMode={darkMode} label="Open" onClick={() => onOpen(doc)}><ExternalLink className="h-4 w-4" /></IconButton>
        )}
        {doc.hasFile && <IconButton darkMode={darkMode} label="Download" onClick={() => onDownload(doc)} disabled={busy}><Download className="h-4 w-4" /></IconButton>}
        {doc.canManage && (
          <>
            <IconButton darkMode={darkMode} label="Edit" onClick={() => onEdit(doc)}><Pencil className="h-4 w-4" /></IconButton>
            <IconButton darkMode={darkMode} label="Share with departments" onClick={() => onShare(doc)}><Share2 className="h-4 w-4" /></IconButton>
            <IconButton darkMode={darkMode} label="Delete" danger onClick={() => onDelete(doc)}><Trash2 className="h-4 w-4" /></IconButton>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Main ----------

export default function DepartmentDocuments({ darkMode }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [folder, setFolder] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [tab, setTab] = useState("owned");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [departmentModal, setDepartmentModal] = useState(null);
  const [documentModal, setDocumentModal] = useState(null);
  const [shareDoc, setShareDoc] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busyDocId, setBusyDocId] = useState("");
  const [copied, setCopied] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const data = await api("/department-documents/overview");
      setOverview(data);
      if (data.isAdmin) {
        api("/department-documents/admin/users").then((result) => setUsers(result.users || [])).catch(() => {});
      }
      return data;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolder = useCallback(async (departmentId, { quiet = false } = {}) => {
    if (!departmentId) return;
    if (!quiet) setFolderLoading(true);
    try {
      setFolder(await api(`/department-documents/departments/${departmentId}/documents`));
    } catch (error) {
      toast.error(error.message);
      setSelectedId(null);
    } finally {
      setFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async fetch; state is only set once the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOverview();
  }, [loadOverview]);

  // A member of exactly one department lands straight in it.
  useEffect(() => {
    if (!overview || overview.isAdmin || selectedId || overview.departments.length !== 1) return;
    const onlyId = overview.departments[0].id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(onlyId);
    void loadFolder(onlyId);
  }, [overview, selectedId, loadFolder]);

  function openDepartment(id) {
    setSelectedId(id);
    setFolder(null);
    setTab("owned");
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("");
    void loadFolder(id);
  }

  async function refreshAll() {
    await loadOverview();
    if (selectedId) await loadFolder(selectedId, { quiet: true });
  }

  const departments = useMemo(() => overview?.departments || [], [overview]);
  const currentDepartment = folder?.department || departments.find((department) => department.id === selectedId) || null;
  const currentList = useMemo(() => (tab === "owned" ? folder?.documents : folder?.sharedDocuments) || [], [folder, tab]);
  const categories = useMemo(() => [...new Set([...(folder?.documents || []), ...(folder?.sharedDocuments || [])].map((doc) => doc.category).filter(Boolean))].sort(), [folder]);
  const visibleDocs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return currentList.filter((doc) => (typeFilter === "all" || doc.type === typeFilter)
      && (!categoryFilter || doc.category === categoryFilter)
      && (!query || `${doc.name} ${doc.description} ${doc.category} ${doc.originalName} ${doc.departmentName}`.toLowerCase().includes(query)));
  }, [currentList, search, typeFilter, categoryFilter]);

  async function fetchFile(doc, download) {
    const response = await fetch(`${API_URL}/department-documents/documents/${doc.id}/file${download ? "?download=1" : ""}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not open the file");
    }
    return response.blob();
  }

  async function downloadDoc(doc) {
    setBusyDocId(doc.id);
    try {
      const blob = await fetchFile(doc, true);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = doc.originalName || doc.name;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyDocId("");
    }
  }

  async function openDoc(doc) {
    if (doc.type !== "file") {
      const href = documentHref(doc);
      if (href) window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    if (!doc.previewable) return downloadDoc(doc);
    // Open the tab synchronously so popup blockers allow it, then fill it once the file arrives.
    const tabWindow = window.open("", "_blank");
    setBusyDocId(doc.id);
    try {
      const blob = await fetchFile(doc, false);
      const url = URL.createObjectURL(blob);
      if (tabWindow) tabWindow.location.href = url;
      else window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (error) {
      tabWindow?.close();
      toast.error(error.message);
    } finally {
      setBusyDocId("");
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirming(true);
    try {
      if (confirm.kind === "document") {
        await api(`/department-documents/documents/${confirm.doc.id}`, { method: "DELETE" });
        toast.success("Document deleted");
      } else {
        await api(`/department-documents/departments/${confirm.department.id}`, { method: "DELETE" });
        toast.success("Department deleted");
        setSelectedId(null);
        setFolder(null);
        setDepartmentModal(null);
      }
      setConfirm(null);
      await refreshAll();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirming(false);
    }
  }

  function copyServiceEmail() {
    if (!overview?.serviceAccountEmail) return;
    navigator.clipboard?.writeText(overview.serviceAccountEmail).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  const muted = darkMode ? "text-white/50" : "text-black/50";
  const shell = `min-h-full px-4 py-6 sm:px-6 lg:px-8 ${darkMode ? "text-white" : "text-[#171714]"}`;

  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center py-24`}>
        <Loader2 className={`h-6 w-6 animate-spin ${muted}`} />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className={`${shell} flex flex-col items-center justify-center gap-4 py-24 text-center`}>
        <p className={muted}>Department documents couldn&apos;t be loaded.</p>
        <GhostButton darkMode={darkMode} onClick={() => { setLoading(true); void loadOverview(); }}><RefreshCw className="h-4 w-4" /> Try again</GhostButton>
      </div>
    );
  }

  const modals = (
    <>
      {departmentModal && (
        <DepartmentModal
          darkMode={darkMode}
          department={departmentModal.department}
          colors={overview.colors || Object.keys(COLOR_STYLES)}
          users={users}
          serviceAccountEmail={overview.serviceAccountEmail}
          onClose={() => setDepartmentModal(null)}
          onSaved={async () => { setDepartmentModal(null); await refreshAll(); }}
          onDelete={() => setConfirm({ kind: "department", department: departmentModal.department })}
        />
      )}
      {documentModal && (
        <DocumentModal
          darkMode={darkMode}
          department={currentDepartment}
          document={documentModal.document}
          initialType={documentModal.type}
          forms={overview.forms || []}
          categories={categories}
          maxUploadBytes={overview.maxUploadBytes}
          onClose={() => setDocumentModal(null)}
          onSaved={async () => { setDocumentModal(null); await refreshAll(); }}
        />
      )}
      {shareDoc && (
        <ShareModal
          darkMode={darkMode}
          document={shareDoc}
          shareTargets={overview.shareTargets || []}
          onClose={() => setShareDoc(null)}
          onSaved={async () => { setShareDoc(null); await refreshAll(); }}
        />
      )}
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(confirm)}
        loading={confirming}
        title={confirm?.kind === "department" ? `Delete ${confirm?.department?.name}?` : `Delete "${confirm?.doc?.name}"?`}
        message={confirm?.kind === "department"
          ? "Members lose access and every document record in this department is removed, including shares to other departments. Files already in the shared drive folder stay there."
          : confirm?.doc?.hasFile
            ? "The document is removed for everyone, including departments it was shared with. The file moves to the shared drive's trash, where an admin can restore it for 30 days."
            : "The document is removed for everyone, including departments it was shared with."}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </>
  );

  // ---------- Department folder view ----------
  if (selectedId) {
    const color = colorStyle(currentDepartment?.color, darkMode);
    const showBack = overview.isAdmin || departments.length > 1;
    return (
      <div className={shell}>
        <div className="mx-auto max-w-6xl">
          {showBack && (
            <button type="button" onClick={() => { setSelectedId(null); setFolder(null); }} className={`mb-5 inline-flex items-center gap-2 text-sm font-semibold ${muted} hover:opacity-80`}>
              <ArrowLeft className="h-4 w-4" /> All departments
            </button>
          )}

          <div className={`mb-6 rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/[0.08] bg-white/[0.03]" : "border-black/[0.06] bg-white"}`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${color.soft}`}>
                  <FolderLock className="h-3.5 w-3.5" /> Department
                </span>
                <h1 className="small mt-3 text-3xl font-semibold">{currentDepartment?.name || "Department"}</h1>
                {currentDepartment?.description && <p className={`mt-2 max-w-2xl text-sm ${muted}`}>{currentDepartment.description}</p>}
                <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${muted}`}>
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {currentDepartment?.memberCount ?? 0} member{currentDepartment?.memberCount === 1 ? "" : "s"}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" />
                    {currentDepartment?.driveConfigured ? currentDepartment.driveFolderName || "Shared drive linked" : <span className={darkMode ? "text-amber-300" : "text-amber-700"}>No shared drive folder yet</span>}
                  </span>
                  {overview.isAdmin && currentDepartment?.driveFolderUrl && (
                    <a href={currentDepartment.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
                      Open in Drive <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {overview.isAdmin && currentDepartment && (
                  <GhostButton darkMode={darkMode} onClick={() => setDepartmentModal({ department: departments.find((department) => department.id === selectedId) || currentDepartment })}>
                    <Settings2 className="h-4 w-4" /> Manage
                  </GhostButton>
                )}
                <PrimaryButton darkMode={darkMode} onClick={() => setDocumentModal({ type: "file" })}>
                  <Plus className="h-4 w-4" /> Add document
                </PrimaryButton>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className={`inline-flex rounded-full p-1 ${darkMode ? "bg-white/[0.05]" : "bg-black/[0.04]"}`}>
              {[
                { id: "owned", label: "Department files", count: folder?.documents?.length ?? 0 },
                { id: "shared", label: "Shared with us", count: folder?.sharedDocuments?.length ?? 0 },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item.id ? darkMode ? "bg-white/10 text-white" : "bg-white text-black shadow-sm" : muted}`}
                >
                  {item.label} <span className="ml-1 opacity-60">{item.count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className={`flex h-11 items-center gap-2 rounded-full border px-4 sm:w-64 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                <Search className={`h-4 w-4 shrink-0 ${muted}`} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" className={`w-full bg-transparent text-sm outline-none ${darkMode ? "placeholder:text-white/35" : "placeholder:text-black/35"}`} />
              </div>
              {categories.length > 0 && (
                <div className="sm:w-48">
                  <SelectMenu
                    darkMode={darkMode}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={[{ value: "", label: "All categories" }, ...categories.map((category) => ({ value: category, label: category }))]}
                    placeholder="All categories"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {TYPE_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.id}
                onClick={() => setTypeFilter(filter.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${typeFilter === filter.id ? darkMode ? "border-[#d8f36a] bg-[#d8f36a]/10 text-[#d8f36a]" : "border-[#171714] bg-[#171714] text-white" : darkMode ? "border-white/10 text-white/60 hover:text-white" : "border-black/10 text-black/55 hover:text-black"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {folderLoading && !folder ? (
            <div className="flex justify-center py-20"><Loader2 className={`h-6 w-6 animate-spin ${muted}`} /></div>
          ) : visibleDocs.length === 0 ? (
            <div className={`flex flex-col items-center justify-center gap-3 rounded-[30px] border border-dashed px-6 py-16 text-center ${darkMode ? "border-white/10" : "border-black/10"}`}>
              {tab === "owned" ? <FileUp className={`h-8 w-8 ${muted}`} /> : <Share2 className={`h-8 w-8 ${muted}`} />}
              <p className="font-semibold">
                {currentList.length ? "No documents match these filters" : tab === "owned" ? "No documents yet" : "Nothing has been shared with this department"}
              </p>
              {!currentList.length && tab === "owned" && (
                <>
                  <p className={`max-w-md text-sm ${muted}`}>Upload files to the department&apos;s shared drive, or link Google Sheets, forms and other pages.</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {ADD_TABS.map((item) => {
                      const Icon = item.icon;
                      return <GhostButton key={item.id} darkMode={darkMode} onClick={() => setDocumentModal({ type: item.id })} className="px-4 py-2"><Icon className="h-4 w-4" /> {item.label}</GhostButton>;
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  darkMode={darkMode}
                  doc={doc}
                  shared={tab === "shared"}
                  busy={busyDocId === doc.id}
                  onOpen={openDoc}
                  onDownload={downloadDoc}
                  onEdit={(item) => setDocumentModal({ document: item })}
                  onShare={setShareDoc}
                  onDelete={(item) => setConfirm({ kind: "document", doc: item })}
                />
              ))}
            </div>
          )}
        </div>
        {modals}
      </div>
    );
  }

  // ---------- Departments overview ----------
  return (
    <div className={shell}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>{overview.isAdmin ? "Admin view · all departments" : "Your departments"}</p>
            <h1 className="small text-3xl font-semibold sm:text-4xl">Department Documents</h1>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>Each department has its own private folder. Members see only their department&apos;s documents and what other departments share with them.</p>
          </div>
          {overview.isAdmin && (
            <PrimaryButton darkMode={darkMode} onClick={() => setDepartmentModal({ department: null })} className="shrink-0 whitespace-nowrap">
              <FolderPlus className="h-4 w-4" /> New department
            </PrimaryButton>
          )}
        </div>

        {overview.isAdmin && overview.serviceAccountEmail && (
          <div className={`mb-6 flex flex-col gap-3 rounded-3xl border px-5 py-4 sm:flex-row sm:items-center ${darkMode ? "border-white/[0.08] bg-white/[0.03]" : "border-black/[0.06] bg-white"}`}>
            <HardDrive className={`h-5 w-5 shrink-0 ${muted}`} />
            <p className={`flex-1 text-sm ${muted}`}>
              To store uploads, create a folder for each department inside a Google <span className="font-semibold">Shared Drive</span> and share it with this address as <span className="font-semibold">Content manager</span>:
              <span className={`ml-1 break-all font-mono text-xs ${darkMode ? "text-white/80" : "text-black/75"}`}>{overview.serviceAccountEmail}</span>
            </p>
            <GhostButton darkMode={darkMode} onClick={copyServiceEmail} className="shrink-0 px-4 py-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
            </GhostButton>
          </div>
        )}

        {departments.length === 0 ? (
          <div className={`flex flex-col items-center justify-center gap-3 rounded-[30px] border border-dashed px-6 py-20 text-center ${darkMode ? "border-white/10" : "border-black/10"}`}>
            <FolderLock className={`h-9 w-9 ${muted}`} />
            <p className="text-lg font-semibold">{overview.isAdmin ? "No departments yet" : "You haven't been added to a department"}</p>
            <p className={`max-w-md text-sm ${muted}`}>
              {overview.isAdmin ? "Create a department, add its members and link its shared drive folder." : "Ask an admin to add you to your department's documents folder."}
            </p>
            {overview.isAdmin && (
              <PrimaryButton darkMode={darkMode} onClick={() => setDepartmentModal({ department: null })} className="mt-2">
                <FolderPlus className="h-4 w-4" /> Create department
              </PrimaryButton>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {departments.map((department) => {
              const color = colorStyle(department.color, darkMode);
              return (
                <div
                  key={department.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDepartment(department.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDepartment(department.id); } }}
                  className={`group relative flex cursor-pointer flex-col rounded-[28px] border p-5 text-left transition ${darkMode ? "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]" : "border-black/[0.06] bg-white hover:border-black/15 hover:shadow-[0_12px_40px_rgba(0,0,0,.06)]"}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color.soft}`}>
                      <FolderLock className="h-5 w-5" />
                    </span>
                    {overview.isAdmin && (
                      <IconButton darkMode={darkMode} label="Manage department" onClick={(event) => { event.stopPropagation(); setDepartmentModal({ department }); }}>
                        <Settings2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                  <h2 className="truncate text-lg font-semibold">{department.name}</h2>
                  <p className={`mt-1 line-clamp-2 min-h-[2.5rem] text-sm ${muted}`}>{department.description || "No description"}</p>
                  <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs ${muted}`}>
                    <span>{department.documentCount} document{department.documentCount === 1 ? "" : "s"}</span>
                    {department.sharedInCount > 0 && <span>{department.sharedInCount} shared in</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {department.memberCount}</span>
                  </div>
                  {!department.driveConfigured && overview.isAdmin && (
                    <span className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${darkMode ? "bg-amber-400/12 text-amber-200" : "bg-amber-50 text-amber-800"}`}>
                      <HardDrive className="h-3 w-3" /> Link a shared drive folder
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {modals}
    </div>
  );
}
