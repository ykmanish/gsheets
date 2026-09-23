"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FolderLock,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sheet,
  ShieldCheck,
  Trash2,
  Upload,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, getStoredAuth } from "./AuthProvider";
import { ConfirmModal, SelectMenu, useClickOutside } from "./ui";

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

// Flat, calm surfaces that match Employee Daily Report: hairline borders, no shadows.
function tone(darkMode) {
  return {
    muted: darkMode ? "text-white/45" : "text-black/45",
    panel: darkMode ? "border-white/10 bg-white/[0.025]" : "border-[#dfe7e4] bg-white",
    card: darkMode ? "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.055]" : "border-[#dfe7e4] bg-white hover:border-[#c6d8d0] hover:bg-[#fbfdfc]",
    soft: darkMode ? "bg-white/[0.06]" : "bg-[#f1f7f4]",
    line: darkMode ? "border-white/10" : "border-[#dfe7e4]",
  };
}

const FOLDER_TONES = {
  emerald: ["#3fae7a", "#93dcb8"],
  sky: ["#4c9fe0", "#a6d3f6"],
  violet: ["#8e7ad1", "#c7bbf0"],
  amber: ["#eea23f", "#fdcc86"],
  rose: ["#df6b74", "#f5a6aa"],
  teal: ["#34a99d", "#8cdad1"],
  indigo: ["#6572db", "#adb5f3"],
  orange: ["#ea8246", "#f8bb91"],
};

function FolderGlyph({ color, className = "h-12 w-14" }) {
  const [back, front] = FOLDER_TONES[color] || FOLDER_TONES.emerald;
  return (
    <svg viewBox="0 0 56 46" className={className} aria-hidden="true">
      <path d="M4 9a5 5 0 0 1 5-5h12.6a5 5 0 0 1 3.7 1.6L29 9.5h18a5 5 0 0 1 5 5V37a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill={back} />
      <path d="M4 17a5 5 0 0 1 5-5h38a5 5 0 0 1 5 5v20a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill={front} />
    </svg>
  );
}

const KIND_META = {
  pdf: { color: "#ef6b5b", name: "PDF" },
  doc: { color: "#3b82f6", name: "Word document" },
  xls: { color: "#1f9d62", name: "Spreadsheet" },
  ppt: { color: "#f08a3c", name: "Presentation" },
  image: { color: "#5cc592", name: "Image" },
  video: { color: "#8b5cf6", name: "Video" },
  audio: { color: "#ec4899", name: "Audio" },
  zip: { color: "#e0a526", name: "Archive" },
  cad: { color: "#0e9f9a", name: "Drawing" },
  text: { color: "#94a3b8", name: "Text" },
  file: { color: "#a3adb8", name: "File" },
  gsheet: { color: "#1fa463", name: "Google Sheet" },
  form: { color: "#7c5cd6", name: "Form" },
  link: { color: "#0ea5e9", name: "Link" },
};

function fileExtension(doc) {
  const name = String(doc.originalName || doc.name || "").toLowerCase();
  return name.includes(".") ? name.split(".").pop() : "";
}

function fileKind(doc) {
  if (doc.type === "sheet") return "gsheet";
  if (doc.type === "form") return "form";
  if (doc.type === "link") return "link";
  const ext = fileExtension(doc);
  const mime = String(doc.mimeType || "").toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(ext) || mime.includes("wordprocessing") || mime === "application/msword") return "doc";
  if (["xls", "xlsx", "xlsm", "csv", "ods"].includes(ext) || mime.includes("spreadsheet") || mime === "text/csv") return "xls";
  if (["ppt", "pptx", "odp", "key"].includes(ext) || mime.includes("presentation")) return "ppt";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"].includes(ext)) return "image";
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac"].includes(ext)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip")) return "zip";
  if (["dwg", "dxf", "skp", "rvt"].includes(ext)) return "cad";
  if (["txt", "md", "log"].includes(ext) || mime.startsWith("text/")) return "text";
  return "file";
}

function GlyphLabel({ text: label }) {
  return <text x="20" y="35" textAnchor="middle" fontSize={label.length > 3 ? 7.5 : 9} fontWeight="800" fill="#fff" fontFamily="system-ui, -apple-system, Segoe UI, sans-serif">{label}</text>;
}

// Drawn file-type logos: a folded page tinted per type, with a white mark inside.
function FileGlyph({ doc, className = "h-12 w-10" }) {
  const kind = fileKind(doc);
  const color = KIND_META[kind].color;
  if (kind === "image") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect x="2" y="4" width="44" height="40" rx="9" fill="#cdeefa" />
        <circle cx="33" cy="16" r="5" fill="#fde68a" />
        <path d="M2 35l12-12 10 9 7-6 15 12v2a9 9 0 0 1-9 9H11a9 9 0 0 1-9-9z" fill="#7fd3aa" />
        <path d="M2 38l13-8 11 8 8-5 12 7v1a9 9 0 0 1-9 9H11a9 9 0 0 1-9-9z" fill="#3ba872" />
      </svg>
    );
  }
  if (kind === "link") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect x="2" y="4" width="44" height="40" rx="9" fill="#dff1fc" />
        <g transform="rotate(-45 24 24)" fill="none" stroke={color} strokeWidth="3.4">
          <rect x="9" y="18.5" width="17" height="11" rx="5.5" />
          <rect x="22" y="18.5" width="17" height="11" rx="5.5" />
        </g>
      </svg>
    );
  }
  let mark;
  if (kind === "doc" || kind === "text") {
    mark = <g fill="#fff"><rect x="10" y="21" width="20" height="3" rx="1.5" /><rect x="10" y="27.5" width="20" height="3" rx="1.5" /><rect x="10" y="34" width="13" height="3" rx="1.5" /></g>;
  } else if (kind === "xls" || kind === "gsheet") {
    mark = <g><rect x="10" y="21" width="20" height="17" rx="3" fill="#fff" /><path d="M10 29.5h20M20 21v17" stroke={color} strokeWidth="2.2" /></g>;
  } else if (kind === "ppt") {
    mark = <g><rect x="9" y="21" width="22" height="15" rx="2.5" fill="#fff" /><rect x="13" y="25" width="9" height="2.6" rx="1.3" fill={color} /><rect x="13" y="29.6" width="14" height="2.6" rx="1.3" fill={color} opacity=".45" /></g>;
  } else if (kind === "video") {
    mark = <path d="M16 22.6v13.8a1.2 1.2 0 0 0 1.8 1l10.9-6.9a1.2 1.2 0 0 0 0-2L17.8 21.6a1.2 1.2 0 0 0-1.8 1z" fill="#fff" />;
  } else if (kind === "audio") {
    mark = <g fill="#fff"><circle cx="17" cy="34" r="4" /><rect x="19.2" y="20" width="2.8" height="14" rx="1.2" /><path d="M20.5 20l8 3.2v4.3l-8-3.2z" /></g>;
  } else if (kind === "zip") {
    mark = <g fill="#fff"><rect x="17" y="2" width="5" height="3" rx="1" /><rect x="17" y="8" width="5" height="3" rx="1" /><rect x="17" y="14" width="5" height="3" rx="1" /><rect x="15.5" y="22" width="8" height="11" rx="2.5" /></g>;
  } else if (kind === "form") {
    mark = <g fill="#fff"><rect x="9" y="21" width="5.5" height="5.5" rx="1.6" /><rect x="17.5" y="22.4" width="13" height="2.7" rx="1.3" /><rect x="9" y="30.5" width="5.5" height="5.5" rx="1.6" /><rect x="17.5" y="31.9" width="10" height="2.7" rx="1.3" /></g>;
  } else if (kind === "pdf") {
    mark = <GlyphLabel text="PDF" />;
  } else if (kind === "cad") {
    mark = <GlyphLabel text={(fileExtension(doc) || "dwg").toUpperCase().slice(0, 4)} />;
  } else {
    const ext = fileExtension(doc).toUpperCase().slice(0, 4);
    mark = ext ? <GlyphLabel text={ext} /> : <g fill="#fff"><rect x="10" y="24" width="20" height="3" rx="1.5" /><rect x="10" y="31" width="14" height="3" rx="1.5" /></g>;
  }
  return (
    <svg viewBox="0 0 40 48" className={className} aria-hidden="true">
      <path d="M7 1h19l13 13v27a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6z" fill={color} />
      <path d="M26 1v8a5 5 0 0 0 5 5h8z" fill="#fff" fillOpacity=".42" />
      {mark}
    </svg>
  );
}

function Modal({ darkMode, title, subtitle, eyebrow, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0f172a]/45 p-4 backdrop-blur-sm sm:p-7">
      <div className={`flex max-h-[92vh] w-full flex-col ${wide ? "max-w-3xl" : "max-w-xl"} overflow-hidden rounded-[30px] border ${darkMode ? "border-white/10 bg-[#1a1d22] text-white" : "border-[#dfe7e4] bg-white text-[#171714]"}`}>
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${darkMode ? "border-white/10" : "border-[#e6eeeb]"}`}>
          <div className="min-w-0">
            {eyebrow && <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#10a66b]"}`}>{eyebrow}</p>}
            <h3 className="small text-2xl font-semibold">{title}</h3>
            {subtitle && <p className={`mt-1 text-sm ${darkMode ? "text-white/48" : "text-black/48"}`}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/10 hover:bg-white/5" : "border-[#dfe7e4] hover:bg-[#f1f7f4]"}`}><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer && <div className={`flex shrink-0 flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-7 ${darkMode ? "border-white/10" : "border-[#e6eeeb]"}`}>{footer}</div>}
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
  return `h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25" : "border-[#dfe7e4] bg-white text-black placeholder:text-black/35 focus:ring-[#10a66b]/15"}`;
}

function textareaClass(darkMode) {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 ${darkMode ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25" : "border-[#dfe7e4] bg-white text-black placeholder:text-black/35 focus:ring-[#10a66b]/15"}`;
}

function PrimaryButton({ darkMode, children, className = "", ...props }) {
  return (
    <button type="button" {...props} className={`inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-3xl px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#e3f78f]" : "bg-[#10a66b] text-white hover:bg-[#0e955f]"} ${className}`}>
      {children}
    </button>
  );
}

function GhostButton({ darkMode, children, className = "", ...props }) {
  return (
    <button type="button" {...props} className={`inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-3xl border px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${darkMode ? "border-white/10 bg-white/10 text-white hover:bg-white/15" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"} ${className}`}>
      {children}
    </button>
  );
}

function IconButton({ darkMode, label, danger = false, children, className = "", ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...props}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40 ${danger
        ? darkMode ? "text-red-300 hover:bg-red-500/15" : "text-red-500 hover:bg-red-50"
        : darkMode ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-[#f1f7f4] hover:text-slate-900"} ${className}`}
    >
      {children}
    </button>
  );
}

function CheckList({ darkMode, items, selected, onToggle, emptyText, searchPlaceholder = "Search" }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => `${item.label} ${item.hint || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className={`overflow-hidden rounded-2xl border ${darkMode ? "border-white/10" : "border-[#dfe7e4]"}`}>
      {items.length > 6 && (
        <div className={`flex items-center gap-2 border-b px-4 ${darkMode ? "border-white/10" : "border-[#e6eeeb]"}`}>
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
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${darkMode ? "hover:bg-white/5" : "hover:bg-[#f6faf8]"}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black" : "border-[#10a66b] bg-[#10a66b] text-white" : darkMode ? "border-white/20" : "border-black/20"}`}>
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
                  className={`flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition ${colorStyle(color, darkMode).dot} ${form.color === color ? `ring-2 ${darkMode ? "ring-white ring-offset-[#1a1d22]" : "ring-[#171714] ring-offset-white"}` : ""}`}
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
        <div className={`mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1 sm:grid-cols-4 ${darkMode ? "bg-white/[0.04]" : "bg-[#f1f7f4]"}`}>
          {ADD_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = type === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setType(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? darkMode ? "bg-[#d8f36a] text-[#151612]" : "bg-white text-[#0f6b49] ring-1 ring-[#dfe7e4]" : darkMode ? "text-white/60 hover:text-white" : "text-black/55 hover:text-black"}`}
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
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition ${dragging ? darkMode ? "border-[#d8f36a] bg-[#d8f36a]/5" : "border-[#10a66b] bg-[#e8f6ee]" : darkMode ? "border-white/15 hover:border-white/30" : "border-[#cfddd7] hover:border-[#10a66b]/50"}`}
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
                <div className={`h-full rounded-full transition-all ${darkMode ? "bg-[#d8f36a]" : "bg-[#10a66b]"}`} style={{ width: `${progress}%` }} />
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
            <div className={`grid grid-cols-2 gap-1 rounded-2xl p-1 ${darkMode ? "bg-white/[0.04]" : "bg-[#f1f7f4]"}`}>
              {[{ id: "internal", label: "Workspace form" }, { id: "external", label: "External link" }].map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => set("formSource", option.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${form.formSource === option.id ? darkMode ? "bg-white/10 text-white" : "bg-white text-[#0f6b49] ring-1 ring-[#dfe7e4]" : darkMode ? "text-white/55" : "text-black/50"}`}
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

// ---------- Shared bits for the folder and file views ----------

const VIEW_STORAGE_KEY = "uipl_department_documents_view";

function readStoredView() {
  if (typeof window === "undefined") return "grid";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function Pill({ darkMode, variant = "green", icon: Icon, children }) {
  const light = {
    green: "border-[#dfe7e4] bg-[#e8f6ee] text-[#0f6b49]",
    yellow: "border-[#eadb8f] bg-[#fff4a8] text-[#5b4b00]",
    pink: "border-[#efaccb] bg-[#f7bdd7] text-[#6f123b]",
    blue: "border-[#c7ddf5] bg-[#e3effc] text-[#1d4f86]",
  }[variant];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : light}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />} {children}
    </span>
  );
}

function ViewToggle({ darkMode, view, onChange }) {
  const t = tone(darkMode);
  return (
    <div className={`inline-flex h-11 shrink-0 items-center rounded-2xl border p-1 ${t.line} ${darkMode ? "bg-white/[0.03]" : "bg-white"}`}>
      {[{ id: "grid", icon: LayoutGrid, label: "Grid view" }, { id: "list", icon: List, label: "List view" }].map((option) => {
        const Icon = option.icon;
        const active = view === option.id;
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => onChange(option.id)}
            aria-label={option.label}
            aria-pressed={active}
            className={`flex h-9 w-10 items-center justify-center rounded-xl transition ${active ? darkMode ? "bg-white/12 text-white" : "bg-[#f1f7f4] text-[#0f6b49]" : t.muted}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function SortControl({ darkMode, options, sort, onChange }) {
  const t = tone(darkMode);
  return (
    <div className="flex shrink-0 items-center gap-1">
      {options.map((option) => {
        const active = sort.key === option.id;
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => onChange(active ? { key: option.id, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: option.id, dir: option.defaultDir || "asc" })}
            className={`inline-flex h-11 items-center gap-1 rounded-2xl px-3 text-sm font-semibold transition ${active ? darkMode ? "text-white" : "text-[#171714]" : `${t.muted} hover:opacity-80`}`}
          >
            {option.label}
            {active && <ChevronDown className={`h-4 w-4 transition-transform ${sort.dir === "asc" ? "rotate-180" : ""}`} />}
          </button>
        );
      })}
    </div>
  );
}

function SearchBox({ darkMode, value, onChange, placeholder }) {
  const t = tone(darkMode);
  return (
    <div className="relative w-full sm:w-72">
      <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.035] placeholder:text-white/35" : "border-[#dfe7e4] bg-white placeholder:text-black/35"}`}
      />
    </div>
  );
}

function EmptyState({ darkMode, icon: Icon, title, body, children }) {
  const t = tone(darkMode);
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed px-6 py-16 text-center ${t.line}`}>
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${t.soft}`}><Icon className={`h-6 w-6 ${t.muted}`} /></span>
      <p className="text-base font-semibold">{title}</p>
      {body && <p className={`max-w-md text-sm ${t.muted}`}>{body}</p>}
      {children}
    </div>
  );
}

function memberSummary(department) {
  const names = (department.members || []).map((member) => member.name.split(" ")[0]);
  if (!names.length) return "No members yet";
  return names.length > 3 ? `${names.slice(0, 3).join(" • ")} +${names.length - 3}` : names.join(" • ");
}

// ---------- Folder views ----------

function FolderCard({ darkMode, department, isAdmin, onOpen, onManage }) {
  const t = tone(darkMode);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}
      className={`group flex cursor-pointer flex-col rounded-[24px] border p-5 transition ${t.card}`}
    >
      <div className="flex items-center gap-4">
        <FolderGlyph color={department.color} className="h-12 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold">{department.name}</h3>
          <p className={`mt-0.5 text-xs ${t.muted}`}>
            {department.documentCount} file{department.documentCount === 1 ? "" : "s"}
            {department.sharedInCount > 0 ? ` · ${department.sharedInCount} shared in` : ""}
          </p>
        </div>
        {isAdmin && (
          <IconButton darkMode={darkMode} label="Manage department" onClick={(event) => { event.stopPropagation(); onManage(); }}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      <div className={`mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs ${t.line} ${t.muted}`}>
        <span className="inline-flex min-w-0 items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{memberSummary(department)}</span></span>
        {isAdmin && !department.driveConfigured && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${darkMode ? "bg-amber-400/12 text-amber-200" : "bg-[#fff4a8] text-[#5b4b00]"}`}>
            <HardDrive className="h-3 w-3" /> No drive
          </span>
        )}
      </div>
    </div>
  );
}

function FolderRow({ darkMode, department, isAdmin, onOpen, onManage }) {
  const t = tone(darkMode);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}
      className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition sm:px-5 md:grid-cols-[44px_minmax(0,2fr)_minmax(0,1.5fr)_110px_72px] ${darkMode ? "hover:bg-white/[0.04]" : "hover:bg-[#f6faf8]"}`}
    >
      <FolderGlyph color={department.color} className="h-9 w-11" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{department.name}</p>
        <p className={`truncate text-xs ${t.muted}`}>{department.description || "No description"}</p>
      </div>
      <p className={`hidden truncate text-sm md:block ${t.muted}`}>{memberSummary(department)}</p>
      <p className={`hidden text-sm md:block ${t.muted}`}>{department.documentCount} file{department.documentCount === 1 ? "" : "s"}</p>
      <div className="flex items-center justify-end gap-1">
        {isAdmin && !department.driveConfigured && <HardDrive className={`h-4 w-4 ${darkMode ? "text-amber-300" : "text-amber-600"}`} aria-label="No shared drive folder" />}
        {isAdmin && (
          <IconButton darkMode={darkMode} label="Manage department" onClick={(event) => { event.stopPropagation(); onManage(); }}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

// ---------- Document views ----------

function documentMeta(doc) {
  const kind = KIND_META[fileKind(doc)];
  return [formatDate(doc.updatedAt), doc.type === "file" ? formatBytes(doc.size) || kind.name : kind.name].filter(Boolean).join(" · ");
}

function DocumentActions({ darkMode, doc, busy, onOpen, onDownload, onEdit, onShare, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setOpen(false));
  const t = tone(darkMode);
  const stop = (fn) => (event) => { event.stopPropagation(); setOpen(false); fn(doc); };

  if (busy) return <Loader2 className={`m-2 h-4 w-4 shrink-0 animate-spin ${t.muted}`} />;
  return (
    <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
      {doc.canManage ? (
        <>
          <IconButton darkMode={darkMode} label="Share with departments" onClick={stop(onShare)}><Share2 className="h-4 w-4" /></IconButton>
          <IconButton darkMode={darkMode} label="Edit" onClick={stop(onEdit)}><Pencil className="h-4 w-4" /></IconButton>
        </>
      ) : doc.hasFile ? (
        <IconButton darkMode={darkMode} label="Download" onClick={stop(onDownload)}><Download className="h-4 w-4" /></IconButton>
      ) : null}
      {doc.canManage && (
        <div ref={menuRef} className="relative">
          <IconButton darkMode={darkMode} label="More actions" aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreHorizontal className="h-4 w-4" /></IconButton>
          {open && (
            <div className={`absolute right-0 top-[calc(100%+6px)] z-30 w-44 overflow-hidden rounded-2xl border p-1.5 ${darkMode ? "border-white/10 bg-[#1f2228]" : "border-[#dfe7e4] bg-white"}`}>
              {[
                { label: "Open", icon: ExternalLink, fn: onOpen },
                ...(doc.hasFile ? [{ label: "Download", icon: Download, fn: onDownload }] : []),
                { label: "Delete", icon: Trash2, fn: onDelete, danger: true },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.label}
                    onClick={stop(item.fn)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${item.danger ? darkMode ? "text-red-300 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50" : darkMode ? "hover:bg-white/5" : "hover:bg-[#f1f7f4]"}`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SharedBadges({ darkMode, doc, shared }) {
  if (shared) {
    return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${darkMode ? "text-sky-300" : "text-[#1d4f86]"}`}><Share2 className="h-3 w-3" /> From {doc.departmentName}</span>;
  }
  if (!doc.sharedWith.length) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold ${darkMode ? "text-sky-300" : "text-[#1d4f86]"}`}>
      <Share2 className="h-3 w-3 shrink-0" /> <span className="truncate">Shared with {doc.sharedWith.map((target) => target.name).join(" • ")}</span>
    </span>
  );
}

function CategoryChip({ darkMode, category }) {
  if (!category) return null;
  return <span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${darkMode ? "bg-white/10 text-white/70" : "bg-[#f1f7f4] text-[#0f6b49]"}`}>{category}</span>;
}

function DocumentCard({ darkMode, doc, shared, busy, handlers }) {
  const t = tone(darkMode);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handlers.onOpen(doc)}
      onKeyDown={(event) => { if (event.key === "Enter") handlers.onOpen(doc); }}
      className={`group flex cursor-pointer flex-col rounded-[24px] border p-4 transition ${t.card}`}
    >
      <div className="flex items-start gap-4">
        <FileGlyph doc={doc} className="h-14 w-12 shrink-0" />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="line-clamp-2 break-words text-[15px] font-semibold leading-snug" title={doc.name}>{doc.name}</p>
          <p className={`mt-1 truncate text-xs ${t.muted}`}>{documentMeta(doc)}</p>
        </div>
        <DocumentActions darkMode={darkMode} doc={doc} busy={busy} {...handlers} />
      </div>
      {(doc.category || doc.description || shared || doc.sharedWith.length > 0) && (
        <div className="mt-3 flex min-w-0 flex-col gap-1.5">
          {doc.description && <p className={`line-clamp-2 text-xs leading-5 ${t.muted}`}>{doc.description}</p>}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CategoryChip darkMode={darkMode} category={doc.category} />
            <SharedBadges darkMode={darkMode} doc={doc} shared={shared} />
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentRow({ darkMode, doc, shared, busy, handlers }) {
  const t = tone(darkMode);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handlers.onOpen(doc)}
      onKeyDown={(event) => { if (event.key === "Enter") handlers.onOpen(doc); }}
      className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition sm:px-5 md:grid-cols-[36px_minmax(0,2.4fr)_minmax(0,1fr)_90px_120px_104px] ${darkMode ? "hover:bg-white/[0.04]" : "hover:bg-[#f6faf8]"}`}
    >
      <FileGlyph doc={doc} className="h-10 w-9" />
      <div className="min-w-0">
        <p className="truncate font-semibold" title={doc.name}>{doc.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className={`truncate text-xs md:hidden ${t.muted}`}>{documentMeta(doc)}</span>
          <span className="hidden min-w-0 md:inline-flex"><SharedBadges darkMode={darkMode} doc={doc} shared={shared} /></span>
        </div>
      </div>
      <div className="hidden min-w-0 md:block"><CategoryChip darkMode={darkMode} category={doc.category} /></div>
      <p className={`hidden text-sm md:block ${t.muted}`}>{doc.type === "file" ? formatBytes(doc.size) || "—" : "—"}</p>
      <p className={`hidden text-sm md:block ${t.muted}`}>{formatDate(doc.updatedAt)}</p>
      <DocumentActions darkMode={darkMode} doc={doc} busy={busy} {...handlers} />
    </div>
  );
}

function ListHeader({ darkMode, columns, className }) {
  const t = tone(darkMode);
  return (
    <div className={`hidden gap-4 border-b px-5 py-3 text-xs font-semibold md:grid ${t.line} ${t.muted} ${className}`}>
      {columns.map((column, index) => <span key={index}>{column}</span>)}
    </div>
  );
}

function sortItems(items, sort, getters) {
  const get = getters[sort.key] || getters.name;
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = get(a);
    const right = get(b);
    if (typeof left === "string") return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true }) * factor;
    return ((left || 0) - (right || 0)) * factor;
  });
}

const DOC_SORT_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date", defaultDir: "desc" },
  { id: "size", label: "Size", defaultDir: "desc" },
];
const DOC_SORTERS = {
  name: (doc) => doc.name || "",
  date: (doc) => new Date(doc.updatedAt || 0).getTime(),
  size: (doc) => Number(doc.size) || 0,
};
const FOLDER_SORT_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "files", label: "Files", defaultDir: "desc" },
];
const FOLDER_SORTERS = {
  name: (department) => department.name || "",
  files: (department) => department.documentCount || 0,
};

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
  const [folderSearch, setFolderSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [view, setView] = useState(readStoredView);
  const [docSort, setDocSort] = useState({ key: "date", dir: "desc" });
  const [folderSort, setFolderSort] = useState({ key: "name", dir: "asc" });
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

  function changeView(next) {
    setView(next);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch {}
  }

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
  const visibleDepartments = useMemo(() => {
    const query = folderSearch.trim().toLowerCase();
    const filtered = departments.filter((department) => !query || `${department.name} ${department.description} ${memberSummary(department)}`.toLowerCase().includes(query));
    return sortItems(filtered, folderSort, FOLDER_SORTERS);
  }, [departments, folderSearch, folderSort]);
  const currentDepartment = folder?.department || departments.find((department) => department.id === selectedId) || null;
  const currentList = useMemo(() => (tab === "owned" ? folder?.documents : folder?.sharedDocuments) || [], [folder, tab]);
  const categories = useMemo(() => [...new Set([...(folder?.documents || []), ...(folder?.sharedDocuments || [])].map((doc) => doc.category).filter(Boolean))].sort(), [folder]);
  const visibleDocs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = currentList.filter((doc) => (typeFilter === "all" || doc.type === typeFilter)
      && (!categoryFilter || doc.category === categoryFilter)
      && (!query || `${doc.name} ${doc.description} ${doc.category} ${doc.originalName} ${doc.departmentName}`.toLowerCase().includes(query)));
    return sortItems(filtered, docSort, DOC_SORTERS);
  }, [currentList, search, typeFilter, categoryFilter, docSort]);

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

  const t = tone(darkMode);
  const shell = `flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`;
  const hero = `relative mb-5 rounded-[30px] border p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#202328]" : "border-[#dfe7e4] bg-white/95"}`;

  if (loading) {
    return (
      <main className={`${shell} flex items-center justify-center`}>
        <Loader2 className={`h-6 w-6 animate-spin ${t.muted}`} />
      </main>
    );
  }

  if (!overview) {
    return (
      <main className={`${shell} flex flex-col items-center justify-center gap-4 text-center`}>
        <p className={t.muted}>Department documents couldn&apos;t be loaded.</p>
        <GhostButton darkMode={darkMode} onClick={() => { setLoading(true); void loadOverview(); }}><RefreshCw className="h-4 w-4" /> Try again</GhostButton>
      </main>
    );
  }

  const docHandlers = {
    onOpen: openDoc,
    onDownload: downloadDoc,
    onEdit: (item) => setDocumentModal({ document: item }),
    onShare: setShareDoc,
    onDelete: (item) => setConfirm({ kind: "document", doc: item }),
  };

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
    const showBack = overview.isAdmin || departments.length > 1;
    const adminDepartment = departments.find((department) => department.id === selectedId) || currentDepartment;
    const ownedCount = folder?.documents?.length ?? 0;
    const sharedCount = folder?.sharedDocuments?.length ?? 0;
    return (
      <main className={shell}>
        <section className={hero}>
          {showBack && (
            <button type="button" onClick={() => { setSelectedId(null); setFolder(null); }} className={`mb-5 inline-flex items-center gap-2 text-sm font-semibold ${t.muted} hover:opacity-80`}>
              <ArrowLeft className="h-4 w-4" /> All departments
            </button>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="flex min-w-0 items-start gap-5">
              <FolderGlyph color={currentDepartment?.color} className="hidden h-[72px] w-[86px] shrink-0 sm:block" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill darkMode={darkMode} icon={FolderLock}>Department folder</Pill>
                  <Pill darkMode={darkMode} variant="yellow" icon={Users}>{currentDepartment?.memberCount ?? 0} member{currentDepartment?.memberCount === 1 ? "" : "s"}</Pill>
                  {currentDepartment?.driveConfigured
                    ? <Pill darkMode={darkMode} variant="blue" icon={HardDrive}>{currentDepartment.driveFolderName || "Shared drive linked"}</Pill>
                    : <Pill darkMode={darkMode} variant="pink" icon={HardDrive}>No shared drive yet</Pill>}
                </div>
                <h1 className={`small mt-5 truncate pb-1 text-4xl font-black leading-[1.08] tracking-tight ${darkMode ? "text-white" : "text-[#161616]"}`}>{currentDepartment?.name || "Department"}</h1>
                <p className={`mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base ${darkMode ? "text-white/65" : "text-black/58"}`}>
                  {currentDepartment?.description || "Files, sheets, forms and links your department keeps together."}
                </p>
                {overview.isAdmin && currentDepartment?.driveFolderUrl && (
                  <a href={currentDepartment.driveFolderUrl} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline ${t.muted}`}>
                    Open folder in Google Drive <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              {overview.isAdmin && adminDepartment && (
                <GhostButton darkMode={darkMode} onClick={() => setDepartmentModal({ department: adminDepartment })}>
                  <Settings2 className="h-4 w-4" /> Manage
                </GhostButton>
              )}
              <PrimaryButton darkMode={darkMode} onClick={() => setDocumentModal({ type: "sheet" })}>
                <Plus className="h-4 w-4" /> Add sheet, form or link
              </PrimaryButton>
            </div>
          </div>
        </section>

        <section className={`overflow-visible rounded-[28px] border ${t.panel}`}>
          <div className={`flex flex-col gap-3 border-b p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between ${t.line}`}>
            <div className="flex flex-wrap items-center gap-3">
              <GhostButton darkMode={darkMode} onClick={() => setDocumentModal({ type: "file" })} className="h-11">
                <Upload className="h-4 w-4" /> Upload files
              </GhostButton>
              <div className={`inline-flex h-11 items-center rounded-2xl border p-1 ${t.line}`}>
                {[
                  { id: "owned", label: "Our files", count: ownedCount },
                  { id: "shared", label: "Shared with us", count: sharedCount },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition ${tab === item.id ? darkMode ? "bg-white/12 text-white" : "bg-[#f1f7f4] text-[#0f6b49]" : t.muted}`}
                  >
                    {item.label} <span className="opacity-60">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchBox darkMode={darkMode} value={search} onChange={setSearch} placeholder="Search files, categories…" />
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

          <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  onClick={() => setTypeFilter(filter.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${typeFilter === filter.id ? darkMode ? "border-[#d8f36a]/40 bg-[#d8f36a]/10 text-[#d8f36a]" : "border-[#bfe3cf] bg-[#e8f6ee] text-[#0f6b49]" : darkMode ? "border-white/10 text-white/55 hover:text-white" : "border-[#dfe7e4] text-black/50 hover:text-black"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <SortControl darkMode={darkMode} options={DOC_SORT_OPTIONS} sort={docSort} onChange={setDocSort} />
              <ViewToggle darkMode={darkMode} view={view} onChange={changeView} />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {folderLoading && !folder ? (
              <div className="flex justify-center py-20"><Loader2 className={`h-6 w-6 animate-spin ${t.muted}`} /></div>
            ) : visibleDocs.length === 0 ? (
              <EmptyState
                darkMode={darkMode}
                icon={tab === "owned" ? UploadCloud : Share2}
                title={currentList.length ? "No documents match these filters" : tab === "owned" ? "This folder is empty" : "Nothing has been shared with this department"}
                body={!currentList.length && tab === "owned" ? "Upload files to the department's shared drive, or link Google Sheets, forms and other pages." : undefined}
              >
                {!currentList.length && tab === "owned" && (
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {ADD_TABS.map((item) => {
                      const Icon = item.icon;
                      return <GhostButton key={item.id} darkMode={darkMode} onClick={() => setDocumentModal({ type: item.id })} className="h-10 px-4"><Icon className="h-4 w-4" /> {item.label}</GhostButton>;
                    })}
                  </div>
                )}
              </EmptyState>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleDocs.map((doc) => (
                  <DocumentCard key={doc.id} darkMode={darkMode} doc={doc} shared={tab === "shared"} busy={busyDocId === doc.id} handlers={docHandlers} />
                ))}
              </div>
            ) : (
              <div className={`overflow-visible rounded-[22px] border ${t.line}`}>
                <ListHeader darkMode={darkMode} className="grid-cols-[36px_minmax(0,2.4fr)_minmax(0,1fr)_90px_120px_104px]" columns={["", "Name", "Category", "Size", "Updated", ""]} />
                <div className={`divide-y ${darkMode ? "divide-white/10" : "divide-[#e6eeeb]"}`}>
                  {visibleDocs.map((doc) => (
                    <DocumentRow key={doc.id} darkMode={darkMode} doc={doc} shared={tab === "shared"} busy={busyDocId === doc.id} handlers={docHandlers} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        {modals}
      </main>
    );
  }

  // ---------- Departments overview ----------
  const linkedCount = departments.filter((department) => department.driveConfigured).length;
  const totalFiles = departments.reduce((sum, department) => sum + (department.documentCount || 0), 0);
  return (
    <main className={shell}>
      <section className={hero}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill darkMode={darkMode} icon={FolderLock}>Department Documents</Pill>
              <Pill darkMode={darkMode} variant="yellow">{overview.isAdmin ? "Admin view" : `${departments.length} department${departments.length === 1 ? "" : "s"}`}</Pill>
              {overview.isAdmin && <Pill darkMode={darkMode} variant={linkedCount === departments.length ? "blue" : "pink"} icon={HardDrive}>{linkedCount}/{departments.length} drives linked</Pill>}
            </div>
            <h1 className={`small mt-5 max-w-4xl text-4xl font-black leading-[0.96] tracking-tight ${darkMode ? "text-white" : "text-[#161616]"}`}>Every department, its own folder.</h1>
            <p className={`mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base ${darkMode ? "text-white/65" : "text-black/58"}`}>
              Keep files, Google Sheets, forms and links in one calm place. Members only see their department&apos;s folder and what others share with them.
            </p>
          </div>
          {overview.isAdmin && (
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PrimaryButton darkMode={darkMode} onClick={() => setDepartmentModal({ department: null })}>
                <FolderPlus className="h-4 w-4" /> New department
              </PrimaryButton>
            </div>
          )}
        </div>
        {overview.isAdmin && overview.serviceAccountEmail && (
          <div className={`mt-6 flex flex-col gap-3 rounded-[22px] border p-4 sm:flex-row sm:items-center ${t.line} ${darkMode ? "bg-white/[0.03]" : "bg-[#f6faf8]"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${darkMode ? "bg-white/10" : "bg-white"}`}><HardDrive className={`h-4 w-4 ${t.muted}`} /></span>
            <p className={`min-w-0 flex-1 text-sm ${darkMode ? "text-white/60" : "text-black/55"}`}>
              Create a folder per department in a Google <span className="font-semibold">Shared Drive</span> and share it as <span className="font-semibold">Content manager</span> with
              <span className={`ml-1 break-all font-mono text-xs ${darkMode ? "text-white/85" : "text-black/75"}`}>{overview.serviceAccountEmail}</span>
            </p>
            <GhostButton darkMode={darkMode} onClick={copyServiceEmail} className="h-10 shrink-0 px-4">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy email"}
            </GhostButton>
          </div>
        )}
      </section>

      <section className={`rounded-[28px] border ${t.panel}`}>
        <div className={`flex flex-col gap-3 border-b p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between ${t.line}`}>
          <div>
            <h2 className="small text-2xl font-semibold">Folders</h2>
            <p className={`mt-1 text-sm ${t.muted}`}>{departments.length} department{departments.length === 1 ? "" : "s"} · {totalFiles} file{totalFiles === 1 ? "" : "s"}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchBox darkMode={darkMode} value={folderSearch} onChange={setFolderSearch} placeholder="Search departments…" />
            <div className="flex items-center justify-between gap-2">
              <SortControl darkMode={darkMode} options={FOLDER_SORT_OPTIONS} sort={folderSort} onChange={setFolderSort} />
              <ViewToggle darkMode={darkMode} view={view} onChange={changeView} />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {departments.length === 0 ? (
            <EmptyState
              darkMode={darkMode}
              icon={FolderLock}
              title={overview.isAdmin ? "No departments yet" : "You haven't been added to a department"}
              body={overview.isAdmin ? "Create a department, add its members and link its shared drive folder." : "Ask an admin to add you to your department's documents folder."}
            >
              {overview.isAdmin && (
                <PrimaryButton darkMode={darkMode} onClick={() => setDepartmentModal({ department: null })} className="mt-2">
                  <FolderPlus className="h-4 w-4" /> Create department
                </PrimaryButton>
              )}
            </EmptyState>
          ) : visibleDepartments.length === 0 ? (
            <EmptyState darkMode={darkMode} icon={Search} title="No departments match your search" />
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleDepartments.map((department) => (
                <FolderCard
                  key={department.id}
                  darkMode={darkMode}
                  department={department}
                  isAdmin={overview.isAdmin}
                  onOpen={() => openDepartment(department.id)}
                  onManage={() => setDepartmentModal({ department })}
                />
              ))}
            </div>
          ) : (
            <div className={`overflow-hidden rounded-[22px] border ${t.line}`}>
              <ListHeader darkMode={darkMode} className="grid-cols-[44px_minmax(0,2fr)_minmax(0,1.5fr)_110px_72px]" columns={["", "Department", "Members", "Files", ""]} />
              <div className={`divide-y ${darkMode ? "divide-white/10" : "divide-[#e6eeeb]"}`}>
                {visibleDepartments.map((department) => (
                  <FolderRow
                    key={department.id}
                    darkMode={darkMode}
                    department={department}
                    isAdmin={overview.isAdmin}
                    onOpen={() => openDepartment(department.id)}
                    onManage={() => setDepartmentModal({ department })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      {modals}
    </main>
  );
}
