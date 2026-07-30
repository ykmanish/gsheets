"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronUp, CircleDot, Compass, Gem, Globe2, ImageIcon, Landmark, Layers3, Link as LinkIcon, LockKeyhole, MessageCircleMore, MessagesSquare, MoreVertical, Network, Pencil, Plus, Rocket, Search, Send, ShieldCheck, Sparkles, Star, SunMedium, Trash2, UsersRound, Waves, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
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

function LinkPreviewCard({ url, mine, darkMode, time }) {
  const [faviconSourceIndex, setFaviconSourceIndex] = useState(0);
  const meta = linkPreviewMeta(url);
  if (!meta) return null;
  const faviconSources = [
    `https://icons.duckduckgo.com/ip3/${meta.host}.ico`,
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=128`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(meta.host)}&sz=128`,
  ];
  const faviconUrl = faviconSources[faviconSourceIndex];
  const compactUrl = compactUrlLabel(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`flex min-w-[260px] max-w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left transition ${mine ? "bg-[#dcecff] hover:bg-[#d6e8fb]" : darkMode ? "bg-white/[0.08] hover:bg-white/[0.11]" : "bg-white hover:bg-[#f8fafc]"}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            onError={() => setFaviconSourceIndex((current) => current + 1)}
            className="h-8 w-8 rounded-lg object-contain"
          />
        ) : (
          <Globe2 className="h-8 w-8 text-[#2563eb]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-black ${darkMode && !mine ? "text-white" : "text-[#14213d]"}`}>{meta.title}</span>
        <span className={`mt-0.5 block truncate text-sm ${darkMode && !mine ? "text-white/50" : "text-[#667085]"}`}>{compactUrl}</span>
      </span>
      <span className={`self-end whitespace-nowrap pb-0.5 text-[10px] ${mine ? "text-[#71809a]" : darkMode ? "text-white/40" : "text-black/40"}`}>{time}</span>
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
      {onBack && (
        <div className={`flex h-16 shrink-0 items-center justify-end border-b px-5 2xl:px-6 ${divider}`}>
          <button type="button" onClick={onBack} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${darkMode ? "bg-white/[0.05] hover:bg-white/10" : "bg-[#f4f7fb] hover:bg-[#edf1f7]"}`}>
          Back
        </button>
        </div>
      )}
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
  const [saving, setSaving] = useState(false);
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

  async function saveGroup(update) {
    try {
      setSaving(true);
      await onUpdateGroup(update);
    } finally {
      setSaving(false);
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
    <aside className={`hidden min-h-0 w-[min(30vw,340px)] min-w-[280px] shrink-0 flex-col overflow-x-hidden overflow-y-auto px-5 py-7 2xl:px-6 xl:flex ${panelBg}`}>
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
                    <button key={preset.id} type="button" onClick={() => { void saveGroup({ avatarPreset: preset.id }); setAvatarPickerOpen(false); }} className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-[0.96] ${selected ? "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-white dark:ring-offset-[#1c1f26]" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label={`Choose ${preset.id} avatar`}>
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
              <input value={groupNameDraft} autoFocus onChange={(event) => setGroupNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { void saveGroup({ name: groupNameDraft }).then(() => setEditingName(false)); } }} className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold outline-none" />
              <button type="button" disabled={saving || !groupNameDraft.trim()} onClick={() => { void saveGroup({ name: groupNameDraft }).then(() => setEditingName(false)); }} className="grid h-7 w-7 place-items-center rounded-full bg-[#2563eb] text-white disabled:opacity-35" aria-label="Save group name">
                <Check className="h-3.5 w-3.5" />
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
              <button type="button" disabled={saving} onClick={() => saveGroup({ adminOnlyMessages: !group?.adminOnlyMessages })} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f7fb]"}`}>
                <span>Only admins can message</span>
                <span className={`relative h-6 w-11 rounded-full transition ${group?.adminOnlyMessages ? "bg-[#2563eb]" : darkMode ? "bg-white/15" : "bg-black/10"}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${group?.adminOnlyMessages ? "left-6" : "left-1"}`} />
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
                  <button type="button" disabled={saving || !memberToAdd} onClick={() => { void saveGroup({ participantIds: participantListWith(memberToAdd, true) }); setMemberToAdd(""); }} className="rounded-xl bg-[#2563eb] px-3 text-xs font-bold text-white disabled:opacity-35">Add</button>
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
              <button key={member.id} type="button" onClick={() => onSelectUser(member)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left ${darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
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
                          void saveGroup({ adminIds: adminListWith(member.id, !adminIds.has(String(member.id))) });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void saveGroup({ adminIds: adminListWith(member.id, !adminIds.has(String(member.id))) });
                          }
                        }}
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#2563eb]"}`}
                      >
                        {adminIds.has(String(member.id)) ? "Demote" : "Promote"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveGroup({ participantIds: participantListWith(member.id, false), adminIds: adminListWith(member.id, false) });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void saveGroup({ participantIds: participantListWith(member.id, false), adminIds: adminListWith(member.id, false) });
                          }
                        }}
                        className="rounded-full px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/10"
                      >
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

export default function Forum({ darkMode }) {
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
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef(new Map());
  const chatMenuRef = useRef(null);
  const optimisticMessageCounterRef = useRef(0);

  const surface = darkMode ? "bg-[#15171c]" : "bg-white";
  const subSurface = darkMode ? "bg-[#101116]" : "bg-[#f7f8fb]";
  const divider = darkMode ? "border-white/[0.06]" : "border-[#eef1f5]";
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const softText = darkMode ? "text-white/72" : "text-black/68";
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
        }
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
    setSelectedId(GROUP_ID);
    setMessageSearch("");
    setChatMenuOpen(false);
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

  if (loading) {
    return (
      <div className={`grid h-[calc(100dvh-24px)] min-h-[560px] place-items-center ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f2f4f1] text-black"}`}>
        <MessageCircleMore className="h-8 w-8 animate-pulse text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className={`h-[calc(100dvh-64px)] min-h-[560px] overflow-hidden ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f7f8fb] text-black"}`}>
      <div className={`grid h-full min-h-0 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] ${surface}`}>
        <aside className={`min-h-0 flex-col border-x lg:flex ${darkMode ? "border-white/[0.06]" : "border-[#eef1f5]"} ${mobileListOpen ? "flex" : "hidden lg:flex"}`}>
          <div className={`shrink-0 border-b p-4 ${divider}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#10b981] text-white">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">Forum</h1>
                <p className={`truncate text-xs ${muted}`}>{onlineUserIds.length} online now</p>
              </div>
            </div>
            <div className={`mt-4 flex h-11 items-center gap-2 rounded-2xl px-3 ${darkMode ? "bg-white/[0.06]" : "bg-[#f3f4f6]"}`}>
              <Search className={`h-4 w-4 ${muted}`} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats and people" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/30" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className={`px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Group</p>
            <div className="space-y-1 px-2">
              {[groupConversation].filter(Boolean).map((conversation) => {
                const active = conversation.id === selectedId;
                const unread = unreadByConversation[conversation.id];
                const typingUsers = typingByConversation[conversation.id] || [];
                return (
                  <button key={conversation.id} type="button" onClick={() => { setSelectedId(conversation.id); setMobileListOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? darkMode ? "bg-white/10" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                    {conversation.type === "group" ? (
                      <GroupAvatar group={conversation} className="h-11 w-11" iconClassName="h-5 w-5" />
                    ) : (
                      <UserAvatar user={conversation.participants?.find((user) => user.id !== getStoredAuth().user?.id)} name={conversation.name} className="h-11 w-11" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{conversation.name}</span>
                        {unread?.count ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread.mentioned ? "@" : unread.count}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[11px] ${muted}`}>{formatListTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                        )}
                      </span>
                      <span className={`mt-1 block truncate text-xs ${typingUsers.length ? "text-[#2563eb]" : muted}`}>
                        {typingUsers.length ? `${typingUsers[0].displayName} typing...` : conversation.lastMessage?.text || "Workspace group forum"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className={`px-4 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Direct messages</p>
            <div className="space-y-1 px-2 pb-4">
              {filteredDirectConversations.map((conversation) => {
                const other = conversation.participants?.find((user) => user.id !== getStoredAuth().user?.id);
                const active = conversation.id === selectedId;
                const unread = unreadByConversation[conversation.id];
                const typingUsers = typingByConversation[conversation.id] || [];
                return (
                  <button key={conversation.id} type="button" onClick={() => { setSelectedId(conversation.id); setMobileListOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? darkMode ? "bg-white/10" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                    <span className="relative shrink-0">
                      <UserAvatar user={other} name={conversation.name} className="h-10 w-10" />
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${darkMode ? "border-[#15171c]" : "border-white"} ${online.has(other?.id) ? "bg-[#22c55e]" : "bg-slate-300"}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{conversation.name}</span>
                        {unread?.count ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread.mentioned ? "@" : unread.count}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[11px] ${muted}`}>{formatListTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                        )}
                      </span>
                      <span className={`mt-1 block truncate text-xs ${typingUsers.length ? "text-[#2563eb]" : muted}`}>
                        {typingUsers.length ? "typing..." : conversation.lastMessage?.text || "Direct message"}
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

        <main className={`min-h-0 min-w-0 overflow-hidden ${mobileListOpen ? "hidden lg:flex" : "flex"}`}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className={`flex h-16 shrink-0 items-center gap-3 border-b px-4 ${divider}`}>
              <button type="button" onClick={() => setMobileListOpen(true)} className={`grid h-10 w-10 place-items-center rounded-full lg:hidden ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Back to chats">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className={`flex min-w-0 items-center gap-3 overflow-hidden text-left transition-[max-width,opacity,transform] duration-300 ease-out ${messageSearchOpen ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[320px] flex-1 opacity-100"}`}>
                {selectedConversation?.type === "group" ? (
                  <GroupAvatar group={selectedConversation} className="h-10 w-10" iconClassName="h-5 w-5" />
                ) : (
                  <UserAvatar user={selectedConversation?.participants?.find((user) => user.id !== getStoredAuth().user?.id)} name={selectedConversation?.name} className="h-10 w-10" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{selectedConversation?.name || "Group Forum"}</span>
                </span>
              </div>
              <div className={`hidden h-10 items-center gap-2 overflow-hidden rounded-full px-3 transition-[width,background-color] duration-300 ease-out lg:flex ${messageSearchOpen ? "w-[380px]" : "w-[104px]"} ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f8fb]"}`}>
                <button type="button" onClick={() => setMessageSearchOpen(true)} className="flex h-7 shrink-0 items-center gap-2 rounded-full" aria-label="Search messages">
                  <Search className={`h-4 w-4 ${muted}`} />
                  <span className={`text-xs font-semibold transition-opacity duration-200 ${messageSearchOpen ? "w-0 opacity-0" : "opacity-100"} ${muted}`}>Search</span>
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
              <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${darkMode ? "bg-emerald-300/12 text-emerald-200" : "bg-[#dcfce7] text-[#16a34a]"}`}>
                <LockKeyhole className="h-3.5 w-3.5" />
                Encrypted
              </span>
              <div ref={chatMenuRef} className="relative">
                <button type="button" onClick={() => setChatMenuOpen((open) => !open)} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Chat actions">
                  <MoreVertical className="h-4 w-4" />
                </button>
                {chatMenuOpen && (
                  <div className={`absolute right-0 top-11 z-20 w-40 rounded-2xl p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-black"}`}>
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
              <button type="button" onClick={closeChat} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Close chat">
                <X className="h-4 w-4" />
              </button>
            </header>

            <section className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 ${subSurface}`}>
              <div className="mx-auto flex max-w-4xl flex-col gap-3">
                {messages.map((message, index) => {
                  const mine = message.senderId === getStoredAuth().user?.id;
                  const nextMessage = messages[index + 1];
                  const previousMessage = messages[index - 1];
                  const groupedWithNext = nextMessage?.senderId === message.senderId;
                  const groupedWithPrevious = previousMessage?.senderId === message.senderId;
                  const showAvatar = !groupedWithNext;
                  const showName = !groupedWithPrevious;
                  const matchPosition = messageMatches.findIndex((match) => match.message.id === message.id);
                  const isActiveMatch = matchPosition === activeMatchIndex && messageSearch.trim();
                  const previewUrl = firstUrlFromText(message.text);
                  const displayText = previewUrl ? textWithoutUrls(message.text) : message.text;
                  return (
                    <div
                      key={message.id}
                      ref={(node) => {
                        if (node) messageRefs.current.set(message.id, node);
                        else messageRefs.current.delete(message.id);
                      }}
                      className={`flex items-end gap-3 ${groupedWithPrevious ? "mt-[-6px]" : ""} ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!mine && (showAvatar ? (
                        <span className="self-end">
                          <UserAvatar user={message.sender} name={message.sender?.displayName} className="h-8 w-8" />
                        </span>
                      ) : <span className="h-8 w-8 shrink-0" />)}
                      <div className={`flex max-w-[76%] flex-col ${mine ? "items-end" : "items-start"}`}>
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
                        {displayText && (
                          <div className={`rounded-[20px] px-4 py-3 ring-offset-2 transition ${isActiveMatch ? "ring-2 ring-[#facc15]" : ""} ${mine ? darkMode ? "rounded-br-[6px] bg-[#dcecff] text-[#14213d]" : "rounded-br-[6px] bg-[#e5f1ff] text-[#14213d]" : darkMode ? "rounded-bl-[6px] bg-white/[0.08] text-white" : "rounded-bl-[6px] bg-white text-[#14213d]"}`}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{renderMessageText(displayText, messageSearch, isActiveMatch, users, setSidebarUser, mine)}</p>
                            {!previewUrl && <p className={`mt-1 text-right text-[10px] ${mine ? "text-[#71809a]" : muted}`}>{formatTime(message.createdAt)}</p>}
                          </div>
                        )}
                        {previewUrl && (
                          <div className={`ring-offset-2 transition ${displayText ? "mt-2" : ""} ${isActiveMatch ? "rounded-[22px] ring-2 ring-[#facc15]" : ""}`}>
                            <LinkPreviewCard url={previewUrl} mine={mine} darkMode={darkMode} time={formatTime(message.createdAt)} />
                          </div>
                        )}
                      </div>
                      {mine && (showAvatar ? (
                        <span className="self-end">
                          <UserAvatar user={getStoredAuth().user} name="You" className="h-8 w-8" />
                        </span>
                      ) : <span className="h-8 w-8 shrink-0" />)}
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
                <div ref={endRef} />
              </div>
            </section>

            {(typingByConversation[selectedId] || []).length > 0 && (
              <div className={`border-t px-6 py-2 text-xs ${divider} text-[#2563eb]`}>
                {(typingByConversation[selectedId] || []).map((user) => user.displayName).join(", ")} typing...
              </div>
            )}
            <form onSubmit={sendMessage} className={`relative shrink-0 border-t px-6 py-3 ${divider}`}>
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
              <div className={`mx-auto flex max-w-4xl items-center gap-3 rounded-full border px-5 py-1.5 ${darkMode ? "border-white/[0.06] bg-white/[0.045]" : "border-[#eef1f5] bg-white"}`}>
                <textarea value={composer} disabled={!canSendSelectedConversation} onChange={(event) => updateComposer(event.target.value)} onBlur={() => emitTyping(false)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) sendMessage(event); }} rows={1} placeholder={canSendSelectedConversation ? "Write Something" : "Only group admins can message"} className={`max-h-20 min-h-7 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 ${softText}`} />
                <button type="submit" disabled={!composer.trim() || !canSendSelectedConversation} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2563eb] text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#d1d5db]" aria-label="Send message">
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
      </div>
    </div>
  );
}
