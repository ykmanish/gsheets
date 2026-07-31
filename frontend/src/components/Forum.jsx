"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronUp, CircleDot, Compass, Copy, Gem, Globe2, ImageIcon, Landmark, Layers3, Link as LinkIcon, LoaderCircle, LockKeyhole, MessageCircleMore, MessagesSquare, MoreVertical, Network, Pencil, Plus, Rocket, Search, Send, ShieldCheck, Sparkles, Star, SunMedium, Trash2, UsersRound, Waves, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { showAppToast } from "./ToastPill";
import { API_URL, getStoredAuth } from "./AuthProvider";
import UserAvatar from "./UserAvatar";

const GROUP_ID = "workspace-forum";

const GROUP_AVATAR_PRESETS = [
  ["ocean", "linear-gradient(135deg,#2563eb,#06b6d4)", MessagesSquare],
  ["emerald", "linear-gradient(135deg,#059669,#84cc16)", Sparkles],
  ["sunset", "linear-gradient(135deg,#f97316,#ec4899)", Rocket],
  ["violet", "linear-gradient(135deg,#7c3aed,#2563eb)", Globe2],
  ["rose", "linear-gradient(135deg,#e11d48,#fb7185)", Network],
  ["amber", "linear-gradient(135deg,#f59e0b,#ef4444)", Compass],
  ["cyan", "linear-gradient(135deg,#0891b2,#22c55e)", Zap],
  ["indigo", "linear-gradient(135deg,#4f46e5,#8b5cf6)", Star],
  ["lime", "linear-gradient(135deg,#65a30d,#14b8a6)", ShieldCheck],
  ["pink", "linear-gradient(135deg,#db2777,#9333ea)", Gem],
  ["sky", "linear-gradient(135deg,#0284c7,#38bdf8)", Layers3],
  ["forest", "linear-gradient(135deg,#166534,#0f766e)", CircleDot],
  ["coral", "linear-gradient(135deg,#fb7185,#f97316)", SunMedium],
  ["royal", "linear-gradient(135deg,#1d4ed8,#7c3aed)", Waves],
  ["mint", "linear-gradient(135deg,#10b981,#a3e635)", Landmark],
  ["fire", "linear-gradient(135deg,#dc2626,#f59e0b)", MessagesSquare],
  ["plum", "linear-gradient(135deg,#9333ea,#e879f9)", Sparkles],
  ["teal", "linear-gradient(135deg,#0d9488,#06b6d4)", Rocket],
  ["gold", "linear-gradient(135deg,#ca8a04,#facc15)", Globe2],
  ["night", "linear-gradient(135deg,#111827,#2563eb)", Network],
  ["grape", "linear-gradient(135deg,#581c87,#c026d3)", Compass],
  ["leaf", "linear-gradient(135deg,#15803d,#4ade80)", Zap],
  ["ruby", "linear-gradient(135deg,#9f1239,#f43f5e)", Star],
  ["aqua", "linear-gradient(135deg,#0e7490,#67e8f9)", ShieldCheck],
  ["orchid", "linear-gradient(135deg,#a21caf,#f0abfc)", Gem],
  ["steel", "linear-gradient(135deg,#334155,#64748b)", Layers3],
  ["peach", "linear-gradient(135deg,#fb923c,#fda4af)", CircleDot],
  ["bluegrass", "linear-gradient(135deg,#1d4ed8,#22c55e)", SunMedium],
  ["magenta", "linear-gradient(135deg,#be185d,#7c3aed)", Waves],
  ["slate", "linear-gradient(135deg,#0f172a,#475569)", Landmark],
].map(([id, gradient, Icon]) => ({ id, gradient, Icon }));

function groupAvatarPreset(id) {
  return GROUP_AVATAR_PRESETS.find((preset) => preset.id === id) || GROUP_AVATAR_PRESETS[0];
}

function GroupAvatar({ group, className = "h-11 w-11", iconClassName = "h-5 w-5", rounded = "full" }) {
  const preset = groupAvatarPreset(group?.avatarPreset);
  const Icon = preset.Icon || MessagesSquare;
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden ${rounded === "lg" ? "rounded-2xl" : "rounded-full"} text-white ${className}`} style={{ background: preset.gradient }}>
      <Icon className={iconClassName} />
    </span>
  );
}

function TinySpinner({ className = "h-3.5 w-3.5" }) {
  return <LoaderCircle className={`${className} animate-spin`} />;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Forum request failed");
  return data;
}

function socketUrl() {
  const { token } = getStoredAuth();
  const base = API_URL.replace(/^http/, "ws").replace(/\/api$/, "");
  return `${base}/forum/socket?token=${encodeURIComponent(token || "")}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatListTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? formatTime(value) : date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function messageDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function sameConversation(a, b) {
  return String(a) === String(b);
}

function renderMessageText(text, query, active = false, users = [], onMentionClick, mine = false) {
  const value = String(text || "");
  const needle = query.trim();
  const inlinePattern = /(https?:\/\/[^\s<>()]+)|@([a-zA-Z0-9_.-]+)/g;
  const parts = [];
  let lastIndex = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const start = match.index || 0;
    if (start > lastIndex) parts.push(value.slice(lastIndex, start));
    if (match[1]) {
      const url = match[1].replace(/[.,!?;:]+$/, "");
      const suffix = match[1].slice(url.length);
      parts.push(
        <a key={`${start}-${url}`} href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`inline-flex max-w-full align-baseline rounded-full px-3 py-1.5 text-sm font-medium no-underline ${mine ? "bg-white text-[#2563eb] hover:bg-[#f8fbff]" : "bg-white text-[#2563eb] hover:bg-[#f8fafc]"}`}>
          <span className="block max-w-full truncate">{url}</span>
        </a>
      );
      if (suffix) parts.push(suffix);
    } else {
      const username = match[2].toLowerCase();
      const user = users.find((item) => String(item.username || "").toLowerCase() === username || String(item.displayName || "").toLowerCase().replace(/\s+/g, "") === username);
      parts.push(
        <button key={`${start}-${match[0]}`} type="button" onClick={() => user && onMentionClick?.(user)} className={`font-normal underline underline-offset-2 ${mine ? "text-[#2563eb] decoration-[#2563eb]/35" : "text-[#2563eb] decoration-[#2563eb]/35"}`}>
          {match[0]}
        </button>
      );
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  const rendered = parts.length ? parts : [value];
  if (!needle) return rendered;
  return rendered.map((part, index) => {
    if (typeof part !== "string") return part;
    const lower = part.toLowerCase();
    const start = lower.indexOf(needle.toLowerCase());
    if (start === -1) return part;
    return (
      <span key={`highlight-${index}`}>
        {part.slice(0, start)}
        <mark className={`rounded px-0.5 ${active ? "bg-[#facc15] text-black" : "bg-[#fde68a] text-black"}`}>{part.slice(start, start + needle.length)}</mark>
        {part.slice(start + needle.length)}
      </span>
    );
  });
}

function firstUrlFromText(text = "") {
  const match = String(text || "").match(/https?:\/\/[^\s<>()]+/i);
  return match ? match[0].replace(/[.,!?;:]+$/, "") : "";
}

function textWithoutUrls(text = "") {
  return String(text || "").replace(/https?:\/\/[^\s<>()]+/gi, "").trim();
}

function linkPreviewMeta(url = "") {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname || ""}${parsed.search || ""}`.replace(/^\/$/, "");
    return {
      host: parsed.hostname.replace(/^www\./, ""),
      title: parsed.hostname.replace(/^www\./, ""),
      detail: path ? `/${path}` : parsed.origin,
    };
  } catch {
    return null;
  }
}

function compactUrlLabel(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = `${parsed.pathname || ""}${parsed.search || ""}`.replace(/^\/$/, "");
    return path ? `${host}/${path.replace(/^\//, "")}` : host;
  } catch {
    return url;
  }
}

function preferredFaviconSources(host = "", url = "") {
  const cleanHost = String(host || "").replace(/^www\./, "");
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }
  const pathname = parsedUrl?.pathname || "";
  const productIcons = {
    "drive.google.com": "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
    "docs.google.com": "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x32.png",
    "sheets.google.com": "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png",
    "slides.google.com": "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png",
    "mail.google.com": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    "gmail.com": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    "meet.google.com": "https://www.gstatic.com/images/branding/product/1x/meet_2020q4_48dp.png",
    "maps.google.com": "https://www.gstatic.com/images/branding/product/1x/maps_48dp.png",
  };
  const productIcon = cleanHost === "docs.google.com" && pathname.startsWith("/spreadsheets")
    ? "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png"
    : cleanHost === "docs.google.com" && pathname.startsWith("/presentation")
      ? "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png"
      : cleanHost === "docs.google.com" && pathname.startsWith("/forms")
        ? "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_form_x32.png"
        : productIcons[cleanHost] || ((cleanHost === "google.com" && pathname.startsWith("/maps")) ? "https://www.gstatic.com/images/branding/product/1x/maps_48dp.png" : "");
  return [
    productIcon,
    `https://icons.duckduckgo.com/ip3/${cleanHost}.ico`,
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=128`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanHost)}&sz=128`,
  ].filter(Boolean);
}

function conversationPreviewText(message, fallback) {
  const text = String(message?.text || "").trim();
  if (!text) return fallback;
  const url = firstUrlFromText(text);
  if (!url) return text.length > 90 ? `${text.slice(0, 90).trim()}...` : text;
  const rest = textWithoutUrls(text);
  const preview = rest || compactUrlLabel(url);
  return preview.length > 90 ? `${preview.slice(0, 90).trim()}...` : preview;
}

function LinkPreviewCard({ url, mine, darkMode, time, embedded = false }) {
  const [faviconSourceIndex, setFaviconSourceIndex] = useState(0);
  const meta = linkPreviewMeta(url);
  if (!meta) return null;
  const faviconSources = preferredFaviconSources(meta.host, url);
  const faviconUrl = faviconSources[faviconSourceIndex];
  const compactUrl = compactUrlLabel(url);
  const surfaceClass = embedded
    ? darkMode ? "bg-black/35 hover:bg-black/45" : "bg-black/5 hover:bg-black/10"
    : mine
      ? darkMode ? "bg-[#141a26] hover:bg-[#19202e]" : "bg-[#e5f1ff] hover:bg-[#d6e8fb]"
      : darkMode ? "bg-[#1e222b] hover:bg-[#242934]" : "bg-[#f0f2f5] hover:bg-[#e4e7ec]";
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`flex w-full min-w-0 max-w-full items-center gap-2.5 rounded-[20px] px-3 py-2.5 text-left transition sm:gap-3 sm:px-4 ${surfaceClass}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white sm:h-11 sm:w-11">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            onError={() => setFaviconSourceIndex((current) => current + 1)}
            className="h-6 w-6 rounded-md object-contain sm:h-7 sm:w-7"
          />
        ) : (
          <Globe2 className="h-6 w-6 text-[#2563eb] sm:h-7 sm:w-7" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${darkMode ? "text-white" : "text-[#14213d]"}`}>{meta.title}</span>
        <span className={`mt-0.5 block truncate text-xs ${darkMode ? "text-white/70" : "text-[#525866]"}`}>{compactUrl}</span>
      </span>
      {!embedded && <span className={`self-end whitespace-nowrap pb-0.5 text-[10px] ${mine ? darkMode ? "text-white/60" : "text-[#71809a]" : darkMode ? "text-white/50" : "text-black/45"}`}>{time}</span>}
    </a>
  );
}

function UserInfoPanel({ darkMode, user, online, muted, onDirect, onBack, activeDirectUserId }) {
  const panelBg = darkMode ? "bg-[#15171c] text-white" : "bg-[#fbfcff] text-black";
  const softBlock = darkMode ? "bg-white/[0.05]" : "bg-[#f4f7fb]";
  const divider = darkMode ? "border-white/[0.06]" : "border-[#eef1f5]";
  const isActiveDirectUser = activeDirectUserId && String(activeDirectUserId) === String(user?.id);
  if (!user) return null;
  return (
    <aside className={`hidden min-h-0 w-[min(30vw,340px)] min-w-[280px] shrink-0 flex-col overflow-hidden ${panelBg} xl:flex`}>
      <div className={`flex h-16 shrink-0 items-center justify-end border-b px-5 2xl:px-6 ${divider}`}>
        {onBack && (
          <button type="button" onClick={onBack} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${darkMode ? "bg-white/[0.05] hover:bg-white/10" : "bg-[#f4f7fb] hover:bg-[#edf1f7]"}`}>
            Back
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto flex w-[calc(100%-40px)] max-w-[320px] flex-col py-7">
      <UserAvatar user={user} name={user.displayName} className="mx-auto h-24 w-24" />
      <h2 className="small mt-5 text-center text-2xl font-bold leading-tight">{user.displayName}</h2>
      {user.username && <p className={`mt-1 truncate text-center text-sm ${muted}`}>@{user.username}</p>}
      <div className="mt-3 flex justify-center">
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${online.has(user.id) ? "bg-[#dcfce7] text-[#16a34a]" : "bg-slate-100 text-slate-500"}`}>
          {online.has(user.id) ? "Online" : "Offline"}
        </span>
      </div>
      {!isActiveDirectUser && (
        <button type="button" onClick={() => onDirect(user)} className={`mt-8 flex w-full max-w-full items-center justify-center gap-2 rounded-[14px] px-4 py-4 text-sm font-semibold ${softBlock}`}>
          <MessageCircleMore className="h-4 w-4 text-[#2563eb]" />
          Add Chat
        </button>
      )}
      <PanelSection title="Profile" muted={muted}>
        {[
          ["Designation", user.designation],
          ["Department", user.department],
          ["Email", user.email],
          ["Phone", user.phone],
        ].map(([label, value]) => (
          <div key={label} className="py-1.5">
            <p className={`text-xs ${muted}`}>{label}</p>
            <p className="mt-0.5 min-w-0 break-words text-sm font-bold">{value || "-"}</p>
          </div>
        ))}
      </PanelSection>
        </div>
      </div>
    </aside>
  );
}

function ForumInfoPanel({ darkMode, group, users, currentUser, groupParticipants, online, onlineUserIds, muted, onDirect, onSelectUser, onUpdateGroup }) {
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState(group?.name || "Group Forum");
  const [editingName, setEditingName] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const avatarPickerRef = useRef(null);
  const memberPickerRef = useRef(null);
  const panelBg = darkMode ? "bg-[#15171c] text-white" : "bg-[#fbfcff] text-black";
  const visibleMembers = showAllMembers ? groupParticipants : groupParticipants.slice(0, 4);
  const adminIds = new Set((group?.adminIds || []).map(String));
  const participantIds = new Set((group?.participantIds || groupParticipants.map((member) => member.id)).map(String));
  const canManage = Boolean(currentUser?.isSuperAdmin || adminIds.has(String(currentUser?.id || "")));
  const availableUsers = users.filter((user) => user.id && !participantIds.has(String(user.id)));

  useEffect(() => {
    if (!memberPickerOpen) return undefined;
    function closeOnOutside(event) {
      if (memberPickerRef.current?.contains(event.target)) return;
      setMemberPickerOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [memberPickerOpen]);

  useEffect(() => {
    if (!avatarPickerOpen) return undefined;
    function closeOnOutside(event) {
      if (avatarPickerRef.current?.contains(event.target)) return;
      setAvatarPickerOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [avatarPickerOpen]);

  async function saveGroup(update, action = "group") {
    try {
      setPendingAction(action);
      await onUpdateGroup(update);
    } finally {
      setPendingAction("");
    }
  }

  function participantListWith(userId, included) {
    const next = new Set(participantIds);
    if (included) next.add(String(userId));
    else next.delete(String(userId));
    return [...next];
  }

  function adminListWith(userId, included) {
    const next = new Set(adminIds);
    if (included) next.add(String(userId));
    else next.delete(String(userId));
    return [...next];
  }

  return (
    <aside className={`hidden min-h-0 w-[min(30vw,340px)] min-w-[280px] shrink-0 flex-col overflow-hidden ${panelBg} xl:flex`}>
      <div className={`h-16 shrink-0 border-b ${darkMode ? "border-white/[0.06]" : "border-[#eef1f5]"}`} />
      <div className="min-h-0 overflow-x-hidden overflow-y-auto px-5 py-7 2xl:px-6">
      <div className="mx-auto flex w-full max-w-[320px] flex-col">
        <div ref={avatarPickerRef} className="relative mx-auto">
          <GroupAvatar group={group} className="h-20 w-20 min-w-20" iconClassName="h-9 w-9" />
          {canManage && (
            <button type="button" onClick={() => setAvatarPickerOpen((open) => !open)} className={`absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 ${darkMode ? "border-[#15171c] bg-[#1c1f26] hover:bg-[#252934]" : "border-[#fbfcff] bg-white hover:bg-[#f4f7fb]"}`} aria-label="Change group avatar">
              <Pencil className={`h-3.5 w-3.5 ${muted}`} />
            </button>
          )}
          {canManage && avatarPickerOpen && (
            <div className={`absolute left-1/2 top-[calc(100%+12px)] z-40 w-[304px] -translate-x-1/2 rounded-[22px] border p-3 shadow-2xl ${darkMode ? "border-white/10 bg-[#1c1f26] text-white" : "border-black/10 bg-white text-black"}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${muted}`}>Group avatar</p>
                  <p className="text-sm font-black">Choose gradient</p>
                </div>
                <button type="button" onClick={() => setAvatarPickerOpen(false)} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close avatar picker">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto pr-1">
                {GROUP_AVATAR_PRESETS.map((preset) => {
                  const selected = (group?.avatarPreset || "ocean") === preset.id;
                  const Icon = preset.Icon || MessagesSquare;
                  return (
                    <button key={preset.id} type="button" disabled={Boolean(pendingAction)} onClick={() => { void saveGroup({ avatarPreset: preset.id }, "avatar"); setAvatarPickerOpen(false); }} className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-[0.96] disabled:cursor-wait disabled:opacity-60 ${selected ? "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-white dark:ring-offset-[#1c1f26]" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label={`Choose ${preset.id} avatar`}>
                      <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: preset.gradient }}>
                        <Icon className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {canManage && editingName ? (
            <div className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
              <input value={groupNameDraft} autoFocus onChange={(event) => setGroupNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { void saveGroup({ name: groupNameDraft }, "name").then(() => setEditingName(false)); } }} className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold outline-none" />
              <button type="button" disabled={Boolean(pendingAction) || !groupNameDraft.trim()} onClick={() => { void saveGroup({ name: groupNameDraft }, "name").then(() => setEditingName(false)); }} className="grid h-7 w-7 place-items-center rounded-full bg-[#2563eb] text-white disabled:opacity-35" aria-label="Save group name">
                {pendingAction === "name" ? <TinySpinner /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => { setGroupNameDraft(group?.name || "Group Forum"); setEditingName(false); }} className={`grid h-7 w-7 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label="Cancel group name edit">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <h2 className="min-w-0 truncate text-center text-lg font-bold">{group?.name || "Group Forum"}</h2>
              {canManage && (
                <button type="button" onClick={() => { setGroupNameDraft(group?.name || "Group Forum"); setEditingName(true); }} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label="Edit group name">
                  <Pencil className={`h-4 w-4 ${muted}`} />
                </button>
              )}
            </>
          )}
        </div>
        <p className="mt-1 text-center text-xs font-semibold text-[#22c55e]">{groupParticipants.length} members · {onlineUserIds.length} online</p>

        {canManage && (
          <PanelSection title="Group settings" muted={muted}>
            <div className="space-y-3">
              <button type="button" disabled={Boolean(pendingAction)} onClick={() => saveGroup({ adminOnlyMessages: !group?.adminOnlyMessages }, "adminOnlyMessages")} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition disabled:cursor-wait disabled:opacity-75 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f7fb]"}`}>
                <span>Only admins can message</span>
                <span className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${group?.adminOnlyMessages ? "bg-[#2563eb]" : darkMode ? "bg-white/15" : "bg-black/10"}`}>
                  <span className={`absolute top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm transition-all duration-300 ${group?.adminOnlyMessages ? "left-6" : "left-1"}`}>
                    {pendingAction === "adminOnlyMessages" && <TinySpinner className="h-3 w-3 text-[#2563eb]" />}
                  </span>
                </span>
              </button>
              <div className={`rounded-2xl p-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f7fb]"}`}>
                <span className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] ${muted}`}>Add member</span>
                <div className="flex gap-2">
                  <div ref={memberPickerRef} className="relative min-w-0 flex-1">
                    <button type="button" onClick={() => setMemberPickerOpen((open) => !open)} className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-semibold outline-none ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-black"}`}>
                      <span className={memberToAdd ? "truncate" : `truncate ${muted}`}>{availableUsers.find((user) => user.id === memberToAdd)?.displayName || "Choose user"}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition ${memberPickerOpen ? "rotate-180" : ""} ${muted}`} />
                    </button>
                    {memberPickerOpen && (
                      <div className={`absolute left-0 top-[calc(100%+8px)] z-30 max-h-64 w-full overflow-y-auto rounded-2xl border p-1.5 shadow-2xl ${darkMode ? "border-white/10 bg-[#1c1f26]" : "border-black/10 bg-white"}`}>
                        {availableUsers.map((user) => (
                          <button key={user.id} type="button" onClick={() => { setMemberToAdd(user.id); setMemberPickerOpen(false); }} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold ${memberToAdd === user.id ? "bg-[#2563eb] text-white" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}>
                            <UserAvatar user={user} name={user.displayName} className="h-6 w-6" />
                            <span className="min-w-0 flex-1 truncate">{user.displayName || user.username}</span>
                          </button>
                        ))}
                        {!availableUsers.length && <p className={`px-3 py-3 text-xs ${muted}`}>All users are already added.</p>}
                      </div>
                    )}
                  </div>
                  <button type="button" disabled={Boolean(pendingAction) || !memberToAdd} onClick={() => { const addingUserId = memberToAdd; void saveGroup({ participantIds: participantListWith(addingUserId, true) }, `add:${addingUserId}`).then(() => setMemberToAdd("")); }} className="inline-flex min-w-14 items-center justify-center gap-1.5 rounded-xl bg-[#2563eb] px-3 text-xs font-bold text-white transition disabled:cursor-wait disabled:opacity-35">
                    {pendingAction.startsWith("add:") ? <TinySpinner /> : null}
                    Add
                  </button>
                </div>
              </div>
            </div>
          </PanelSection>
        )}

        <PanelSection
          title="Members"
          action={groupParticipants.length > 4 ? (showAllMembers ? "Show less" : "View all") : null}
          muted={muted}
          onAction={() => setShowAllMembers((current) => !current)}
        >
          <div className="space-y-2">
            {visibleMembers.map((member) => (
              <button key={member.id} type="button" disabled={pendingAction === `member:${member.id}` || pendingAction === `remove:${member.id}`} onClick={() => onSelectUser(member)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition disabled:cursor-wait disabled:opacity-75 ${darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                <span className="relative shrink-0">
                  <UserAvatar user={member} name={member.displayName} className="h-8 w-8" />
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${darkMode ? "border-[#15171c]" : "border-white"} ${online.has(member.id) ? "bg-[#22c55e]" : "bg-slate-300"}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-semibold">{member.displayName}</span>
                    {adminIds.has(String(member.id)) && <span className="shrink-0 rounded-full bg-[#dbeafe] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#2563eb]">Admin</span>}
                  </span>
                  <span className={`block truncate text-[10px] ${muted}`}>{member.designation || member.department || member.username}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {canManage && !member.isSuperAdmin && String(member.id) !== String(currentUser?.id || "") && (
                    <>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveGroup({ adminIds: adminListWith(member.id, !adminIds.has(String(member.id))) }, `member:${member.id}`);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void saveGroup({ adminIds: adminListWith(member.id, !adminIds.has(String(member.id))) }, `member:${member.id}`);
                          }
                        }}
                        className={`inline-flex min-w-[58px] items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#2563eb]"}`}
                      >
                        {pendingAction === `member:${member.id}` && <TinySpinner className="h-3 w-3" />}
                        {adminIds.has(String(member.id)) ? "Demote" : "Promote"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveGroup({ participantIds: participantListWith(member.id, false), adminIds: adminListWith(member.id, false) }, `remove:${member.id}`);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void saveGroup({ participantIds: participantListWith(member.id, false), adminIds: adminListWith(member.id, false) }, `remove:${member.id}`);
                          }
                        }}
                        className="inline-flex min-w-[54px] items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/10"
                      >
                        {pendingAction === `remove:${member.id}` && <TinySpinner className="h-3 w-3" />}
                        Remove
                      </span>
                    </>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDirect(member);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onDirect(member);
                      }
                    }}
                    className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                    aria-label={`Message ${member.displayName}`}
                  >
                    <MessageCircleMore className={`h-4 w-4 ${muted}`} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </PanelSection>
      </div>
      </div>
    </aside>
  );
}

function PanelSection({ title, action, muted, children, onAction }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold">{title}</h3>
        {action && (
          <button type="button" onClick={onAction} className="shrink-0 text-[10px] font-semibold text-[#2563eb]">
            {action}
          </button>
        )}
      </div>
      <div className={muted ? "" : ""}>{children}</div>
    </section>
  );
}

export default function Forum({ darkMode, onMobileChatOpenChange }) {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [selectedId, setSelectedId] = useState(GROUP_ID);
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [search, setSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [unreadByConversation, setUnreadByConversation] = useState({});
  const [typingByConversation, setTypingByConversation] = useState({});
  const [sidebarUser, setSidebarUser] = useState(null);
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileViewportHeight, setMobileViewportHeight] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [copyFeedbackId, setCopyFeedbackId] = useState("");
  const [deleteMessageTarget, setDeleteMessageTarget] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef(new Map());
  const chatMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const optimisticMessageCounterRef = useRef(0);
  const composerRef = useRef(null);

  const surface = darkMode ? "bg-[#15171c]" : "bg-white";
  const subSurface = darkMode ? "bg-[#101116]" : "bg-[#f7f8fb]";
  const divider = darkMode ? "border-white/[0.06]" : "border-[#eef1f5]";
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const softText = darkMode ? "text-white/72" : "text-black/68";

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth < 1024);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    onMobileChatOpenChange?.(isMobileViewport && !mobileListOpen);
    return () => onMobileChatOpenChange?.(false);
  }, [isMobileViewport, mobileListOpen, onMobileChatOpenChange]);
  const selectedConversation = conversations.find((item) => item.id === selectedId) || conversations.find((item) => item.id === GROUP_ID);
  const selectedIsGroup = selectedId === GROUP_ID;
  const online = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const currentUser = getStoredAuth().user;

  const searchedUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((user) => user.id && [user.displayName, user.username, user.department, user.designation].join(" ").toLowerCase().includes(term))
      .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || (a.displayName || "").localeCompare(b.displayName || ""));
  }, [online, search, users]);

  const filteredDirectConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((item) => item.type === "direct")
      .filter((item) => !term || [item.name, item.lastMessage?.text].join(" ").toLowerCase().includes(term));
  }, [conversations, search]);

  const groupConversation = conversations.find((item) => item.id === GROUP_ID);
  const selectedOtherUser = selectedConversation?.type === "direct"
    ? selectedConversation.participants?.find((user) => user.id !== getStoredAuth().user?.id)
    : null;
  const groupAdminIds = useMemo(() => new Set((groupConversation?.adminIds || []).map(String)), [groupConversation?.adminIds]);
  const currentUserIsGroupAdmin = Boolean(currentUser?.isSuperAdmin || groupAdminIds.has(String(currentUser?.id || "")));
  const canSendSelectedConversation = Boolean(selectedConversation && (selectedConversation.type !== "group" || !selectedConversation.adminOnlyMessages || currentUserIsGroupAdmin));
  const messageMatches = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    if (!term) return [];
    return messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => String(message.text || "").toLowerCase().includes(term));
  }, [messageSearch, messages]);
  const groupParticipants = useMemo(() => {
    const byId = new Map();
    for (const user of groupConversation?.participants || []) byId.set(user.id, user);
    return [...byId.values()].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || (a.displayName || "").localeCompare(b.displayName || ""));
  }, [groupConversation?.participants, online]);
  const mentionQuery = useMemo(() => {
    if (!selectedIsGroup) return null;
    const match = composer.match(/(^|\s)@([a-zA-Z0-9_.-]*)$/);
    return match ? match[2].toLowerCase() : null;
  }, [composer, selectedIsGroup]);
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    return groupParticipants
      .filter((user) => user.id !== currentUser?.id)
      .filter((user) => [user.displayName, user.username].join(" ").toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [currentUser?.id, groupParticipants, mentionQuery]);

  const loadBootstrap = useCallback(async () => {
    const data = await api("/forum/bootstrap");
    const list = data.conversations || [];
    setConversations(list);
    setSelectedId((current) => list.some((item) => item.id === current) ? current : (list[0]?.id || GROUP_ID));
    setUsers(data.users || []);
    setOnlineUserIds(data.onlineUserIds || []);
    return data;
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    const data = await api(`/forum/conversations/${encodeURIComponent(conversationId)}/messages`);
    setMessages(data.messages || []);
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }, []);

  // Request browser notification permission & mark forum page as active
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    window.__forumPageActive = true;
    return () => { window.__forumPageActive = false; };
  }, []);

  useEffect(() => {
    let stopped = false;
    async function boot() {
      try {
        setLoading(true);
        const bootData = await loadBootstrap();
        if (!stopped && (bootData?.conversations || []).some((item) => item.id === GROUP_ID)) await loadMessages(GROUP_ID);
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void boot();
    return () => { stopped = true; };
  }, [loadBootstrap, loadMessages]);

  useEffect(() => {
    if (!selectedId || !selectedConversation) return;
    const timer = window.setTimeout(() => {
      void loadMessages(selectedId).catch((error) => toast.error(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages, selectedConversation, selectedId]);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer = null;
    function connectSocket() {
      const ws = new WebSocket(socketUrl());
      socketRef.current = ws;
      ws.onmessage = (event) => {
      const payload = JSON.parse(event.data || "{}");
      if (payload.type === "forum:presence") setOnlineUserIds(payload.onlineUserIds || []);
      if (payload.type === "forum:conversation" && payload.conversation) {
        setConversations((current) => [payload.conversation, ...current.filter((item) => item.id !== payload.conversation.id)]);
      }
      if (payload.type === "forum:message") {
        setConversations((current) => current.map((item) => (
          item.id === payload.conversationId
            ? { ...item, lastMessage: payload.message, updatedAt: payload.message.createdAt }
            : item
        )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
        setTypingByConversation((current) => ({ ...current, [payload.conversationId]: [] }));
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) => current.some((message) => message.id === payload.message.id) ? current : [...current, payload.message]);
          window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
        } else if (payload.message?.senderId !== currentUser?.id) {
          const mentionNeedle = `@${currentUser?.username || ""}`.toLowerCase();
          const mentioned = mentionNeedle.length > 1 && String(payload.message?.text || "").toLowerCase().includes(mentionNeedle);
          setUnreadByConversation((current) => {
            const previous = current[payload.conversationId] || { count: 0, mentioned: false };
            return {
              ...current,
              [payload.conversationId]: {
                count: previous.count + 1,
                mentioned: previous.mentioned || mentioned,
              },
            };
          });

          // Notify for messages in other conversations
          const senderName = payload.message?.sender?.displayName || payload.message?.sender?.username || "Someone";
          const fullText = String(payload.message?.text || "").trim();
          const previewText = fullText.length > 35 ? `${fullText.slice(0, 35)}…` : fullText;
          showAppToast(`${senderName}: ${previewText}`, {
            type: "notification",
            darkMode,
            detail: mentioned ? "You were mentioned" : "New forum message",
            label: "Message",
            duration: 4500,
          });

          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            try {
              const browserNotif = new Notification(senderName, {
                body: previewText || "Sent a message",
                icon: "/favicon.ico",
                tag: `forum-${payload.conversationId}-${payload.message?.id}`,
              });
              browserNotif.onclick = () => {
                window.focus();
                setSelectedId(payload.conversationId);
                setMobileListOpen(false);
                browserNotif.close();
              };
            } catch {}
          }
        }
      }
      if (payload.type === "forum:messageDeleted") {
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) => current.filter((message) => message.id !== payload.messageId));
        }
        setMessageMenu((current) => current?.message?.id === payload.messageId ? null : current);
        setDeleteMessageTarget((current) => current?.id === payload.messageId ? null : current);
      }
      if (payload.type === "forum:typing") {
        setTypingByConversation((current) => {
          const list = (current[payload.conversationId] || []).filter((item) => item.id !== payload.user?.id);
          return {
            ...current,
            [payload.conversationId]: payload.typing ? [...list, payload.user] : list,
          };
        });
      }
      if (payload.type === "forum:cleared") {
        setConversations((current) => current.map((item) => (
          item.id === payload.conversationId ? { ...item, lastMessage: null, updatedAt: new Date().toISOString() } : item
        )));
        if (sameConversation(payload.conversationId, selectedId)) setMessages([]);
      }
      if (payload.type === "forum:deleted") {
        setConversations((current) => current.filter((item) => item.id !== payload.conversationId));
        if (sameConversation(payload.conversationId, selectedId)) {
          setSelectedId(GROUP_ID);
          setMessages([]);
        }
      }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (stopped) return;
        reconnectTimer = window.setTimeout(connectSocket, 2500);
      };
    }
    connectSocket();
    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [currentUser?.id, currentUser?.username, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUnreadByConversation((current) => {
        if (!current[selectedId]) return current;
        const next = { ...current };
        delete next[selectedId];
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setActiveMatchIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [messageSearch, selectedId]);

  useEffect(() => {
    const match = messageMatches[activeMatchIndex];
    if (!match) return;
    const node = messageRefs.current.get(match.message.id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchIndex, messageMatches]);

  useEffect(() => {
    if (!chatMenuOpen) return;
    function closeOnOutside(event) {
      if (chatMenuRef.current?.contains(event.target)) return;
      setChatMenuOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [chatMenuOpen]);

  useEffect(() => {
    if (!messageMenu) return undefined;
    function closeMessageMenu(event) {
      if (messageMenuRef.current?.contains(event.target)) return;
      setMessageMenu(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setMessageMenu(null);
    }
    window.addEventListener("mousedown", closeMessageMenu);
    window.addEventListener("resize", closeMessageMenu);
    window.addEventListener("scroll", closeMessageMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMessageMenu);
      window.removeEventListener("resize", closeMessageMenu);
      window.removeEventListener("scroll", closeMessageMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [messageMenu]);

  async function startDirect(user) {
    try {
      const data = await api("/forum/conversations/direct", {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
      setSelectedId(data.conversation.id);
      setSidebarUser(null);
      setMobileListOpen(false);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = composer.trim();
    if (!text) return;
    if (!canSendSelectedConversation) {
      toast.error("Only group admins can message right now");
      return;
    }
    setComposer("");
    window.setTimeout(() => composerRef.current?.focus(), 0);
    emitTyping(false);
    optimisticMessageCounterRef.current += 1;
    const tempMessage = {
      id: `temp-${optimisticMessageCounterRef.current}`,
      conversationId: selectedId,
      type: selectedConversation?.type || "group",
      senderId: currentUser?.id,
      sender: currentUser,
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, tempMessage]);
    setConversations((current) => current.map((item) => (
      item.id === selectedId
        ? { ...item, lastMessage: tempMessage, updatedAt: tempMessage.createdAt }
        : item
    )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
    try {
      const data = await api(`/forum/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (data.message) {
        setConversations((current) => current.map((item) => (
          item.id === selectedId
            ? { ...item, lastMessage: data.message, updatedAt: data.message.createdAt }
            : item
        )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
        setMessages((current) => [
          ...current.filter((message) => message.id !== tempMessage.id && message.id !== data.message.id),
          data.message,
        ]);
        window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
      }
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== tempMessage.id));
      setComposer(text);
      window.setTimeout(() => composerRef.current?.focus(), 0);
      toast.error(error.message);
    }
  }

  function emitTyping(isTyping = true) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !selectedId) return;
    socket.send(JSON.stringify({
      type: "forum:typing",
      conversationId: selectedId,
      typing: isTyping,
      recipientIds: selectedConversation?.participantIds || selectedConversation?.participants?.map((user) => user.id) || [],
    }));
  }

  function updateComposer(value) {
    setComposer(value);
    emitTyping(Boolean(value.trim()));
  }

  function selectMention(user) {
    const next = composer.replace(/(^|\s)@([a-zA-Z0-9_.-]*)$/, `$1@${user.username || user.displayName} `);
    setComposer(next);
    emitTyping(true);
  }

  function navigateMatch(direction) {
    if (!messageMatches.length) return;
    setActiveMatchIndex((current) => (current + direction + messageMatches.length) % messageMatches.length);
  }

  function closeChat() {
    setMobileListOpen(true);
    setMessageSearch("");
    setMessageSearchOpen(false);
    setChatMenuOpen(false);
  }

  const touchTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  function handleMessageTouchStart(event, message) {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      openMessageMenu({ preventDefault: () => {}, clientX: touchStartPosRef.current.x, clientY: touchStartPosRef.current.y }, message);
    }, 450);
  }

  function handleMessageTouchMove(event) {
    const touch = event.touches?.[0];
    if (!touch || !touchTimerRef.current) return;
    const dist = Math.hypot(touch.clientX - touchStartPosRef.current.x, touch.clientY - touchStartPosRef.current.y);
    if (dist > 10) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }

  function handleMessageTouchEnd() {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }

  function openMessageMenu(event, message) {
    event.preventDefault();
    const menuWidth = 192;
    const menuHeight = 108;
    const padding = 12;
    const x = Math.min(Math.max(padding, event.clientX), window.innerWidth - menuWidth - padding);
    const y = Math.min(Math.max(padding, event.clientY), window.innerHeight - menuHeight - padding);
    setMessageMenu({ message, x, y });
  }

  async function copyMessageText(message) {
    const text = String(message?.text || "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedbackId(message.id);
      setMessageMenu(null);
      window.setTimeout(() => setCopyFeedbackId((current) => current === message.id ? "" : current), 1400);
    } catch (error) {
      toast.error("Could not copy message");
    }
  }

  async function deleteSingleMessage() {
    if (!deleteMessageTarget || deletingMessage) return;
    try {
      setDeletingMessage(true);
      await api(`/forum/conversations/${encodeURIComponent(deleteMessageTarget.conversationId || selectedId)}/messages/${encodeURIComponent(deleteMessageTarget.id)}`, { method: "DELETE" });
      setMessages((current) => current.filter((message) => message.id !== deleteMessageTarget.id));
      setDeleteMessageTarget(null);
      setMessageMenu(null);
    } catch (error) {
      toast.error(error.message || "Could not delete message");
    } finally {
      setDeletingMessage(false);
    }
  }

  async function clearChat() {
    try {
      await api(`/forum/conversations/${encodeURIComponent(selectedId)}/messages`, { method: "DELETE" });
      setMessages([]);
      setConversations((current) => current.map((item) => item.id === selectedId ? { ...item, lastMessage: null } : item));
      setChatMenuOpen(false);
      toast.success("Chat cleared");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function deleteChat() {
    if (selectedConversation?.type !== "direct") {
      toast.error("Only direct chats can be deleted");
      return;
    }
    try {
      await api(`/forum/conversations/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      setConversations((current) => current.filter((item) => item.id !== selectedId));
      setSelectedId(GROUP_ID);
      setMessages([]);
      setChatMenuOpen(false);
      toast.success("Chat deleted");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function updateGroup(update) {
    try {
      const data = await api("/forum/group", {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }

  // Auto-resize composer textarea height as content changes
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [composer]);

  // Dynamic mobile visualViewport height handling (WhatsApp style)
  useEffect(() => {
    if (!isMobileViewport || mobileListOpen) {
      setMobileViewportHeight(null);
      return;
    }
    const updateViewport = () => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      if (window.visualViewport) {
        setMobileViewportHeight(window.visualViewport.height);
      }
    };
    updateViewport();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateViewport);
      vv.addEventListener("scroll", updateViewport);
    }
    window.addEventListener("scroll", updateViewport);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateViewport);
        vv.removeEventListener("scroll", updateViewport);
      }
      window.removeEventListener("scroll", updateViewport);
    };
  }, [isMobileViewport, mobileListOpen]);

  if (loading) {
    return (
      <div className={`grid h-[calc(100dvh-24px)] min-h-[560px] place-items-center ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f2f4f1] text-black"}`}>
        <MessageCircleMore className="h-8 w-8 animate-pulse text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className={`min-h-0 w-full max-w-full flex-1 overflow-hidden ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f7f8fb] text-black"}`}>
      <div className={`grid h-full min-h-0 w-full max-w-full overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] ${surface}`}>
        <aside className={`min-h-0 min-w-0 w-screen max-w-full flex-col overflow-hidden border-x lg:w-full lg:flex ${darkMode ? "border-white/[0.06]" : "border-[#eef1f5]"} ${mobileListOpen ? "flex" : "hidden lg:flex"}`}>
          <div className={`min-w-0 shrink-0 overflow-hidden border-b p-4 ${divider}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#10b981] text-white">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="truncate text-lg font-semibold">Forum</h1>
                <p className={`truncate text-xs ${muted}`}>{onlineUserIds.length} online now</p>
              </div>
            </div>
            <div className={`mt-4 flex h-11 min-w-0 items-center gap-2 overflow-hidden rounded-2xl px-3 ${darkMode ? "bg-white/[0.06]" : "bg-[#f3f4f6]"}`}>
              <Search className={`h-4 w-4 ${muted}`} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats and people" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/30" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <p className={`px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Group</p>
            <div className="min-w-0 space-y-1 overflow-hidden px-2">
              {[groupConversation].filter(Boolean).map((conversation) => {
                const active = conversation.id === selectedId;
                const unread = unreadByConversation[conversation.id];
                const typingUsers = typingByConversation[conversation.id] || [];
                return (
                  <button key={conversation.id} type="button" onClick={() => { setSelectedId(conversation.id); setMobileListOpen(false); }} className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-left transition ${active ? darkMode ? "bg-white/10" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                    {conversation.type === "group" ? (
                      <GroupAvatar group={conversation} className="h-11 w-11" iconClassName="h-5 w-5" />
                    ) : (
                      <UserAvatar user={conversation.participants?.find((user) => user.id !== getStoredAuth().user?.id)} name={conversation.name} className="h-11 w-11" />
                    )}
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold">{conversation.name}</span>
                        {unread?.count ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread.mentioned ? "@" : unread.count}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[11px] ${muted}`}>{formatListTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                        )}
                      </span>
                      <span className={`mt-1 block max-w-full truncate text-xs ${typingUsers.length ? "text-[#2563eb]" : muted}`} title={typingUsers.length ? `${typingUsers[0].displayName} typing...` : conversationPreviewText(conversation.lastMessage, "Workspace group forum")}>
                        {typingUsers.length ? `${typingUsers[0].displayName} typing...` : conversationPreviewText(conversation.lastMessage, "Workspace group forum")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className={`px-4 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Direct messages</p>
            <div className="min-w-0 space-y-1 overflow-hidden px-2 pb-4">
              {filteredDirectConversations.map((conversation) => {
                const other = conversation.participants?.find((user) => user.id !== getStoredAuth().user?.id);
                const active = conversation.id === selectedId;
                const unread = unreadByConversation[conversation.id];
                const typingUsers = typingByConversation[conversation.id] || [];
                return (
                  <button key={conversation.id} type="button" onClick={() => { setSelectedId(conversation.id); setMobileListOpen(false); }} className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-left transition ${active ? darkMode ? "bg-white/10" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                    <span className="relative shrink-0">
                      <UserAvatar user={other} name={conversation.name} className="h-10 w-10" />
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${darkMode ? "border-[#15171c]" : "border-white"} ${online.has(other?.id) ? "bg-[#22c55e]" : "bg-slate-300"}`} />
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold">{conversation.name}</span>
                        {unread?.count ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread.mentioned ? "@" : unread.count}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[11px] ${muted}`}>{formatListTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                        )}
                      </span>
                      <span className={`mt-1 block max-w-full truncate text-xs ${typingUsers.length ? "text-[#2563eb]" : muted}`} title={typingUsers.length ? "typing..." : conversationPreviewText(conversation.lastMessage, "Direct message")}>
                        {typingUsers.length ? "typing..." : conversationPreviewText(conversation.lastMessage, "Direct message")}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!filteredDirectConversations.length && (
                <p className={`px-3 py-3 text-sm ${muted}`}>No direct conversations yet.</p>
              )}
              {searchedUsers.length > 0 && (
                <>
                  <p className={`px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>People</p>
                  {searchedUsers.map((user) => (
                    <button key={user.id} type="button" onClick={() => startDirect(user)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                      <UserAvatar user={user} name={user.displayName} className="h-10 w-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                        <span className={`block truncate text-xs ${muted}`}>{user.designation || user.department || user.username}</span>
                      </span>
                      <Plus className={`h-4 w-4 ${muted}`} />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </aside>

        <main
          style={isMobileViewport && !mobileListOpen && mobileViewportHeight ? { height: `${mobileViewportHeight}px` } : undefined}
          className={`min-h-0 min-w-0 w-screen max-w-full overflow-hidden lg:w-auto ${mobileListOpen ? "hidden lg:flex" : "flex"} ${darkMode ? "bg-[#15171c]" : "bg-white"} flex-col flex-1 h-full relative`}
        >
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <header className={`sticky top-0 z-20 flex h-16 w-full shrink-0 items-center gap-3 border-b border-t-0 px-4 ${divider} ${surface}`}>
              <button type="button" onClick={closeChat} className={`h-9 w-9 shrink-0 place-items-center rounded-full ${messageSearchOpen ? "hidden" : "grid lg:hidden"} ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Back to chats">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className={`flex min-w-0 items-center gap-3 overflow-hidden text-left transition-[max-width,opacity,transform] duration-300 ease-out ${messageSearchOpen ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[320px] flex-1 opacity-100 xl:max-w-none"}`}>
                {selectedConversation?.type === "group" ? (
                  <GroupAvatar group={selectedConversation} className="h-10 w-10" iconClassName="h-5 w-5" />
                ) : (
                  <UserAvatar user={selectedConversation?.participants?.find((user) => user.id !== getStoredAuth().user?.id)} name={selectedConversation?.name} className="h-10 w-10" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{selectedConversation?.name || "Group Forum"}</span>
                  {selectedConversation?.type === "direct" && selectedOtherUser && (
                    <span className={`block truncate text-[11px] leading-4 lg:hidden ${online.has(selectedOtherUser.id) ? "text-[#22c55e]" : muted}`}>
                      {online.has(selectedOtherUser.id) ? "Online" : "Offline"}
                    </span>
                  )}
                </span>
              </div>
              <div className={`flex h-10 items-center gap-2 overflow-hidden rounded-full px-3 transition-[width,background-color] duration-300 ease-out ${messageSearchOpen ? "w-full flex-1" : "hidden"} ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f8fb]"}`}>
                <button type="button" onClick={() => setMessageSearchOpen(true)} className="flex h-7 shrink-0 items-center gap-2 rounded-full" aria-label="Search messages">
                  <Search className={`h-4 w-4 ${muted}`} />
                  <span className={`hidden text-xs font-semibold transition-opacity duration-200 lg:inline ${messageSearchOpen ? "w-0 opacity-0" : "opacity-100"} ${muted}`}>Search</span>
                </button>
                <input
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  placeholder="Search messages"
                  className={`min-w-0 flex-1 bg-transparent text-xs outline-none transition-opacity duration-200 placeholder:text-black/35 dark:placeholder:text-white/30 ${messageSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
                />
                {messageSearchOpen && messageSearch.trim() && (
                  <span className={`shrink-0 text-[10px] ${muted}`}>
                    {messageMatches.length ? `${activeMatchIndex + 1}/${messageMatches.length}` : "0/0"}
                  </span>
                )}
                {messageSearchOpen && (
                  <>
                    <button type="button" onClick={() => navigateMatch(-1)} disabled={!messageMatches.length} className={`grid h-6 w-6 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-white"} disabled:opacity-35`} aria-label="Previous match">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => navigateMatch(1)} disabled={!messageMatches.length} className={`grid h-6 w-6 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-white"} disabled:opacity-35`} aria-label="Next match">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => { setMessageSearchOpen(false); setMessageSearch(""); }} className={`grid h-6 w-6 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-white"}`} aria-label="Close search">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${messageSearchOpen ? "sm:hidden" : ""} ${darkMode ? "bg-emerald-300/12 text-emerald-200" : "bg-[#dcfce7] text-[#16a34a]"}`}>
                <LockKeyhole className="h-3.5 w-3.5" />
                Encrypted
              </span>
              <div ref={chatMenuRef} className={`relative ${messageSearchOpen ? "hidden" : ""}`}>
                <button type="button" onClick={() => setChatMenuOpen((open) => !open)} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Chat actions">
                  <MoreVertical className="h-4 w-4" />
                </button>
                {chatMenuOpen && (
                  <div className={`absolute right-0 top-11 z-20 w-40 rounded-2xl p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-black"}`}>
                    <button type="button" onClick={() => { setMessageSearchOpen(true); setChatMenuOpen(false); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-normal ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`}>
                      <Search className="h-3.5 w-3.5" />
                      Search
                    </button>
                    <button type="button" onClick={clearChat} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-normal ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear chat
                    </button>
                    <button type="button" onClick={deleteChat} disabled={selectedConversation?.type !== "direct"} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-normal text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete chat
                    </button>
                  </div>
                )}
              </div>
              <button type="button" onClick={closeChat} className={`h-9 w-9 place-items-center rounded-full ${messageSearchOpen ? "hidden" : "grid"} ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Close chat">
                <X className="h-4 w-4" />
              </button>
            </header>

            <section className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 ${subSurface}`}>
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                {messages.map((message, index) => {
                  const mine = message.senderId === getStoredAuth().user?.id;
                  const nextMessage = messages[index + 1];
                  const previousMessage = messages[index - 1];
                  const showDate = messageDateKey(message.createdAt) !== messageDateKey(previousMessage?.createdAt);
                  const groupedWithNext = nextMessage?.senderId === message.senderId;
                  const groupedWithPrevious = !showDate && previousMessage?.senderId === message.senderId;
                  const isGroupChat = selectedConversation?.type === "group";
                  const showAvatar = isGroupChat && !mine && !groupedWithNext;
                  const showName = isGroupChat && !mine && !groupedWithPrevious;
                  const matchPosition = messageMatches.findIndex((match) => match.message.id === message.id);
                  const isActiveMatch = matchPosition === activeMatchIndex && messageSearch.trim();
                  const previewUrl = firstUrlFromText(message.text);
                  const displayText = previewUrl ? textWithoutUrls(message.text) : message.text;
                  return (
                    <div key={message.id} className="min-w-0">
                      {showDate && (
                        <div className="sticky top-2 z-10 my-2 flex justify-center">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${darkMode ? "bg-[#1f232b] text-white/70" : "bg-white text-black/45"}`}>
                            {formatMessageDate(message.createdAt)}
                          </span>
                        </div>
                      )}
                      <div
                        ref={(node) => {
                          if (node) messageRefs.current.set(message.id, node);
                          else messageRefs.current.delete(message.id);
                        }}
                        onContextMenu={(event) => openMessageMenu(event, message)}
                        onTouchStart={(event) => handleMessageTouchStart(event, message)}
                        onTouchMove={handleMessageTouchMove}
                        onTouchEnd={handleMessageTouchEnd}
                        onTouchCancel={handleMessageTouchEnd}
                        style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
                        className={`flex min-w-0 items-end gap-2 sm:gap-3 ${groupedWithPrevious ? "mt-[-6px]" : ""} ${mine ? "justify-end" : "justify-start"}`}
                      >
                      {!mine && isGroupChat && (showAvatar ? (
                        <span className="self-end">
                          <UserAvatar user={message.sender} name={message.sender?.displayName} className="h-7 w-7 sm:h-8 sm:w-8" />
                        </span>
                      ) : <span className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />)}
                      <div className={`flex min-w-0 flex-col ${mine ? "max-w-[85%] items-end sm:max-w-[75%]" : isGroupChat ? "max-w-[calc(100%-36px)] items-start sm:max-w-[86%] xl:max-w-[82%]" : "max-w-[85%] items-start sm:max-w-[75%]"}`}>
                        {showName && (
                          <div className={`mb-1 flex items-center gap-2 text-xs ${muted}`}>
                            {mine || !message.sender ? (
                              <span>{mine ? "You" : selectedConversation?.name || "User"}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSidebarUser(message.sender)}
                                className="font-normal hover:text-[#2563eb] hover:underline hover:underline-offset-2"
                              >
                                {message.sender.displayName || "User"}
                              </button>
                            )}
                          </div>
                        )}
                        {displayText && previewUrl && (
                          <div className={`w-full max-w-full min-w-0 rounded-[22px] p-2 transition ${isActiveMatch ? "ring-2 ring-[#facc15] ring-offset-2" : ""} ${mine ? darkMode ? "rounded-br-[6px] bg-[#141a26] text-[#f1f5f9]" : "rounded-br-[6px] bg-[#e5f1ff] text-[#14213d]" : darkMode ? "rounded-bl-[6px] bg-[#1e222b] text-[#f1f5f9]" : "rounded-bl-[6px] bg-[#f0f2f5] text-[#14213d]"}`}>
                            <LinkPreviewCard url={previewUrl} mine={mine} darkMode={darkMode} time={formatTime(message.createdAt)} embedded />
                            <p className="flex min-w-0 items-end gap-3 px-2 pb-1 pt-2 text-sm leading-6">
                              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                {renderMessageText(displayText, messageSearch, isActiveMatch, users, setSidebarUser, mine)}
                              </span>
                              <span className={`inline-block whitespace-nowrap align-baseline text-[10px] leading-none ${mine ? darkMode ? "text-white/50" : "text-[#71809a]" : muted}`}>
                                {formatTime(message.createdAt)}
                              </span>
                            </p>
                          </div>
                        )}
                        {displayText && !previewUrl && (
                          <div className={`max-w-full rounded-[20px] px-4 py-3 transition ${isActiveMatch ? "ring-2 ring-[#facc15] ring-offset-2" : ""} ${mine ? darkMode ? "rounded-br-[6px] bg-[#141a26] text-[#f1f5f9]" : "rounded-br-[6px] bg-[#e5f1ff] text-[#14213d]" : darkMode ? "rounded-bl-[6px] bg-[#1e222b] text-[#f1f5f9]" : "rounded-bl-[6px] bg-[#f0f2f5] text-[#14213d]"}`}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
                              {renderMessageText(displayText, messageSearch, isActiveMatch, users, setSidebarUser, mine)}
                              <span className="inline-block w-3" />
                              <span className={`inline-block whitespace-nowrap align-baseline text-[10px] leading-none ${mine ? darkMode ? "text-white/50" : "text-[#71809a]" : muted}`}>
                                {formatTime(message.createdAt)}
                              </span>
                            </p>
                          </div>
                        )}
                        {previewUrl && !displayText && (
                          <div className={`w-full max-w-full min-w-0 ring-offset-2 transition ${isActiveMatch ? "rounded-[22px] ring-2 ring-[#facc15]" : ""}`}>
                            <LinkPreviewCard url={previewUrl} mine={mine} darkMode={darkMode} time={formatTime(message.createdAt)} />
                          </div>
                        )}
                        {copyFeedbackId === message.id && (
                          <span className={`mt-1 inline-flex animate-pulse items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${darkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-50 text-emerald-600"}`}>
                            <Check className="h-3 w-3" />
                            Copied
                          </span>
                        )}
                      </div>
                    </div>
                    </div>
                  );
                })}
                {!messages.length && (
                  <div className={`mx-auto mt-16 max-w-sm rounded-[24px] p-6 text-center ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <ShieldCheck className="mx-auto h-9 w-9 text-[#2563eb]" />
                    <p className="mt-3 font-semibold">Start the conversation</p>
                    <p className={`mt-1 text-sm ${muted}`}>Messages are stored encrypted and delivered live when people are online.</p>
                  </div>
                )}
                {(typingByConversation[selectedId] || []).length > 0 && (
                  <div className="flex min-w-0 items-end gap-2 sm:gap-3">
                    <span className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
                    <div className={`flex items-center gap-1 rounded-[18px] rounded-bl-[6px] px-4 py-3 ${darkMode ? "bg-white/[0.08]" : "bg-white"}`} aria-label={`${(typingByConversation[selectedId] || []).map((user) => user.displayName).join(", ")} typing`}>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa4b2] [animation-delay:-0.24s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa4b2] [animation-delay:-0.12s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa4b2]" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </section>

            <form onSubmit={sendMessage} className={`relative shrink-0 px-3 py-2 sm:px-6 ${subSurface}`}>
              {mentionOptions.length > 0 && (
                <div className={`absolute bottom-[76px] left-6 z-20 w-72 overflow-hidden rounded-2xl p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-black"}`}>
                  {mentionOptions.map((user) => (
                    <button key={user.id} type="button" onClick={() => selectMention(user)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`}>
                      <UserAvatar user={user} name={user.displayName} className="h-8 w-8" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                        <span className={`block truncate text-xs ${muted}`}>@{user.username || user.displayName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mx-auto flex max-w-4xl items-end gap-2">
                <label className={`flex min-h-12 flex-1 items-center rounded-[20px] px-4 transition-all ${darkMode ? "bg-white/[0.08]" : "bg-white"}`}>
                  <textarea
                    ref={composerRef}
                    value={composer}
                    disabled={!canSendSelectedConversation}
                    onChange={(event) => updateComposer(event.target.value)}
                    onFocus={() => {
                      if (isMobileViewport) {
                        window.scrollTo(0, 0);
                        document.body.scrollTop = 0;
                      }
                    }}
                    onBlur={() => emitTyping(false)}
                    onKeyDown={(event) => {
                      if (!isMobileViewport && event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage(event);
                      }
                    }}
                    enterKeyHint="enter"
                    rows={1}
                    placeholder={canSendSelectedConversation ? "Write Something" : "Only group admins can message"}
                    className={`max-h-32 min-h-7 flex-1 resize-none bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 ${softText}`}
                  />
                </label>
                <button type="submit" onMouseDown={(event) => event.preventDefault()} onPointerDown={(event) => event.preventDefault()} disabled={!composer.trim() || !canSendSelectedConversation} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#2563eb] text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#d1d5db]" aria-label="Send message">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {sidebarUser || selectedConversation?.type === "direct" ? (
            <UserInfoPanel
              darkMode={darkMode}
              user={sidebarUser || selectedOtherUser}
              online={online}
              muted={muted}
              onDirect={startDirect}
              onBack={sidebarUser ? () => setSidebarUser(null) : null}
              activeDirectUserId={selectedConversation?.type === "direct" ? selectedOtherUser?.id : null}
            />
          ) : (
            <ForumInfoPanel
              key={`${groupConversation?.id || GROUP_ID}-${groupConversation?.name || "Group Forum"}`}
              darkMode={darkMode}
              group={groupConversation}
              users={users}
              currentUser={currentUser}
              groupParticipants={groupParticipants}
              online={online}
              onlineUserIds={onlineUserIds}
              muted={muted}
              onDirect={startDirect}
              onSelectUser={setSidebarUser}
              onUpdateGroup={updateGroup}
            />
          )}
        </main>
        {messageMenu && (
          <div
            ref={messageMenuRef}
            style={{ left: messageMenu.x, top: messageMenu.y }}
            className={`fixed z-[80] w-48 origin-top-left rounded-2xl border p-1.5 shadow-[0_18px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${darkMode ? "border-white/10 bg-[#1c1f26]/95 text-white" : "border-black/10 bg-white/95 text-[#111827]"}`}
          >
            <button
              type="button"
              onClick={() => copyMessageText(messageMenu.message)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
            >
              <Copy className="h-4 w-4 text-[#2563eb]" />
              Copy message
            </button>
            <button
              type="button"
              disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
              onClick={() => {
                setDeleteMessageTarget(messageMenu.message);
                setMessageMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Trash2 className="h-4 w-4" />
              Delete message
            </button>
          </div>
        )}
        {deleteMessageTarget && (
          <div className="fixed inset-0 z-[90] grid place-items-center dark:bg-black/80 bg-black/60 px-4 " onMouseDown={() => !deletingMessage && setDeleteMessageTarget(null)}>
            <div onMouseDown={(event) => event.stopPropagation()} className={`w-full max-w-md rounded-[24px] p-5 shadow-[0_24px_90px_rgba(15,23,42,0.28)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#111827]"}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg text-black dark:text-white font-black">Delete message?</h3>
                  <p className={`mt-1 text-sm leading-5 ${muted}`}>This message will be removed from the conversation for everyone.</p>
                </div>
              </div>
              {/* <div className={`mt-4 max-h-24 overflow-hidden rounded-2xl px-3 py-2 text-sm ${darkMode ? "bg-white/[0.05] text-white/70" : "bg-[#f7f8fb] text-black/60"}`}>
                <p className="line-clamp-3 whitespace-pre-wrap break-words">{deleteMessageTarget.text || "Link preview message"}</p>
              </div> */}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={deletingMessage} onClick={() => setDeleteMessageTarget(null)} className={`h-10 rounded-full px-4 text-sm font-bold ${darkMode ? "bg-white/10 hover:bg-white/15" : "bg-[#f3f4f6] hover:bg-[#e5e7eb]"} disabled:opacity-50`}>
                  Cancel
                </button>
                <button type="button" disabled={deletingMessage} onClick={deleteSingleMessage} className="inline-flex h-10 min-w-24 items-center justify-center gap-2 rounded-full bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60">
                  {deletingMessage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
