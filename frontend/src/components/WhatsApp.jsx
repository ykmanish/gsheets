"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleAlert,
  ContactRound,
  Loader2,
  MessageCircleMore,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { SelectMenu } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "WhatsApp request failed");
  }

  return data;
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(value) {
  const phone = normalizePhone(value);
  return phone ? `+${phone}` : "Unknown number";
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatListTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function Initials({ name, accent = false, size = "md" }) {
  const initials = String(name || "WA")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const sizeClass = size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClass} ${
        accent ? "bg-[#25D366] text-white" : "bg-[#d8f36a] text-black"
      }`}
    >
      {initials || "WA"}
    </span>
  );
}

function Modal({ darkMode, title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${
          darkMode
            ? "bg-[#15171c] text-white"
            : "bg-white text-[#171714]"
        }`}
      >
        <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>
          <span><b>WhatsApp</b> · {title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="font-semibold text-[#25D366]"
          >
            Close
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
          <section className={`rounded-[30px]  p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#dfe7e4] bg-white"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#25D366]">Workspace action</p>
                <h3 className="mt-1 text-2xl font-bold">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#25D366]"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ darkMode, muted, onAddContact }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto p-8 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
        <MessageCircleMore className="h-10 w-10" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">Select or start a conversation</h2>
      <p className={`mt-2 max-w-sm text-sm leading-6 ${muted}`}>
        Choose a conversation from the left panel, or add a new verified WhatsApp recipient.
      </p>
      <button
        type="button"
        onClick={onAddContact}
        className={`mt-5 rounded-full px-5 py-2.5 text-sm font-medium transition ${
          darkMode
            ? "bg-[#25D366] text-black hover:bg-[#23ef6e]"
            : "bg-black text-white hover:bg-black/80"
        }`}
      >
        Add contact
      </button>
    </div>
  );
}

export default function WhatsApp({ darkMode }) {
  const [view, setView] = useState("inbox");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [messages, setMessages] = useState([]);

  const [composer, setComposer] = useState({
    mode: "text",
    text: "",
    templateName: "hello_world",
    language: "en_US",
    to: "",
  });

  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ id: "", name: "", phone: "" });
  const [groupModal, setGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", members: [] });
  const [groupMemberInput, setGroupMemberInput] = useState("");
  const [broadcastGroup, setBroadcastGroup] = useState(null);

  const messagesEndRef = useRef(null);

  const surface = darkMode
    ? "border-white/10 bg-[#15171c]"
    : "border-black/[0.06] bg-white";
  const subSurface = darkMode ? "bg-white/[0.035]" : "bg-[#f7f8f6]";
  const divider = darkMode ? "border-white/10" : "border-black/[0.06]";
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const softText = darkMode ? "text-white/70" : "text-black/70";
  const hover = darkMode ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.035]";
  const selected = darkMode ? "bg-white/[0.09]" : "bg-black/[0.055]";
  const field = `h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:border-[#25D366]/70 focus:ring-4 focus:ring-[#25D366]/10 ${
    darkMode
      ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30"
      : "border-black/10 bg-white text-black placeholder:text-black/35"
  }`;

  const navigation = [
    {
      id: "inbox",
      label: "Inbox",
      subtitle: `${conversations.length} conversations`,
      icon: MessageCircleMore,
    },
    {
      id: "contacts",
      label: "Contacts",
      subtitle: `${contacts.length} saved`,
      icon: ContactRound,
    },
    {
      id: "groups",
      label: "Recipient groups",
      subtitle: `${groups.length} groups`,
      icon: UsersRound,
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  const loadData = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);

      try {
        const [conversationData, contactData, groupData, templateData] =
          await Promise.all([
            api("/whatsapp/conversations"),
            api("/whatsapp/contacts"),
            api("/whatsapp/groups"),
            api("/whatsapp/templates").catch(() => ({ templates: [] })),
          ]);

        setConversations(conversationData.conversations || []);
        setContacts(contactData.contacts || []);
        setGroups(groupData.groups || []);
        setTemplates(templateData.templates || []);

        try {
          const status = await api("/whatsapp/health");
          setHealth(status);
          setHealthError("");
        } catch (error) {
          setHealth(null);
          setHealthError(error.message);
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  const loadMessages = useCallback(async (phone, quiet = false) => {
    if (!phone) {
      setMessages([]);
      return;
    }

    try {
      const data = await api(
        `/whatsapp/conversations/${encodeURIComponent(phone)}/messages`,
      );
      setMessages(data.messages || []);
    } catch (error) {
      if (!quiet) toast.error(error.message);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadMessages(selectedPhone),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [loadMessages, selectedPhone]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData(true);
      if (selectedPhone) void loadMessages(selectedPhone, true);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [loadData, loadMessages, selectedPhone]);

  const selectedConversation = conversations.find(
    (item) => item.phone === selectedPhone,
  );

  const recipientName =
    selectedConversation?.contact?.name ||
    contacts.find((item) => item.phone === selectedPhone)?.name ||
    formatPhone(selectedPhone);

  const selectedContact =
    contacts.find((item) => item.phone === selectedPhone) ||
    selectedConversation?.contact ||
    null;

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;

    return conversations.filter((item) => {
      const contactName = item.contact?.name || "";
      const phone = formatPhone(item.phone);
      const preview = item.lastMessage?.text || "";

      return [contactName, phone, item.phone, preview]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [conversations, search]);

  const contactByPhone = useMemo(
    () => new Map(contacts.map((contact) => [contact.phone, contact])),
    [contacts],
  );

  const templateOptions = useMemo(() => {
    const approved = templates.filter(
      (template) => template.status === "APPROVED",
    );

    const options = approved.map((template) => ({
      value: template.name,
      label: `${template.name} · ${template.language}`,
    }));

    return options.length
      ? options
      : [{ value: "hello_world", label: "hello_world · en_US" }];
  }, [templates]);

  async function sendMessage(target = selectedPhone || composer.to) {
    const phone = normalizePhone(target);

    if (!phone) {
      toast.error("Enter a recipient number with country code");
      return;
    }

    if (composer.mode === "text" && !composer.text.trim()) {
      toast.error("Enter a message");
      return;
    }

    try {
      setSending(true);

      await api("/whatsapp/messages", {
        method: "POST",
        body: JSON.stringify({
          to: phone,
          text: composer.mode === "text" ? composer.text : undefined,
          templateName:
            composer.mode === "template" ? composer.templateName : undefined,
          language: composer.language,
        }),
      });

      setSelectedPhone(phone);
      setComposer((current) => ({ ...current, text: "", to: "" }));

      await Promise.all([loadMessages(phone), loadData(true)]);
      toast.success("Message sent");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  function openContactModal(contact = null) {
    setContactForm({
      id: contact?.id || "",
      name: contact?.name || contact?.profileName || "",
      phone: contact?.phone || "",
    });
    setContactModal(true);
  }

  function closeContactModal() {
    setContactModal(false);
    setContactForm({ id: "", name: "", phone: "" });
  }

  function openGroupModal(group = null) {
    setGroupForm({
      id: group?.id || "",
      name: group?.name || "",
      members: [...new Set((group?.members || []).map(normalizePhone).filter(Boolean))],
    });
    setGroupMemberInput("");
    setGroupModal(true);
  }

  function closeGroupModal() {
    setGroupModal(false);
    setGroupForm({ name: "", members: [] });
    setGroupMemberInput("");
  }

  function toggleGroupMember(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    setGroupForm((current) => ({
      ...current,
      members: current.members.includes(normalized)
        ? current.members.filter((item) => item !== normalized)
        : [...current.members, normalized],
    }));
  }

  function addGroupMemberByPhone() {
    const normalized = normalizePhone(groupMemberInput);
    if (!normalized) {
      toast.error("Enter a valid WhatsApp number with country code");
      return;
    }
    setGroupForm((current) => ({
      ...current,
      members: current.members.includes(normalized)
        ? current.members
        : [...current.members, normalized],
    }));
    setGroupMemberInput("");
  }

  async function addContact(event) {
    event.preventDefault();

    try {
      const data = await api("/whatsapp/contacts", {
        method: "POST",
        body: JSON.stringify(contactForm),
      });

      closeContactModal();
      setSelectedPhone(data.contact.phone);
      setView("inbox");

      await loadData(true);
      toast.success(contactForm.id ? "Contact renamed" : "Contact saved");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function deleteContact(id) {
    try {
      if (!window.confirm("Delete this WhatsApp contact? Conversation history will remain.")) return;
      await api(`/whatsapp/contacts/${id}`, { method: "DELETE" });
      await loadData(true);
      toast.success("Contact removed");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveGroup(event) {
    event.preventDefault();

    try {
      await api("/whatsapp/groups", {
        method: "POST",
        body: JSON.stringify(groupForm),
      });

      const editing = Boolean(groupForm.id);
      closeGroupModal();

      await loadData(true);
      toast.success(editing ? "Recipient group updated" : "Recipient group created");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function deleteGroup(id) {
    try {
      await api(`/whatsapp/groups/${id}`, { method: "DELETE" });
      await loadData(true);
      toast.success("Recipient group removed");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function sendBroadcast() {
    if (!broadcastGroup) return;

    if (composer.mode === "text" && !composer.text.trim()) {
      toast.error("Enter a message");
      return;
    }

    try {
      setSending(true);

      const data = await api(`/whatsapp/groups/${broadcastGroup.id}/send`, {
        method: "POST",
        body: JSON.stringify({
          text: composer.mode === "text" ? composer.text : undefined,
          templateName:
            composer.mode === "template" ? composer.templateName : undefined,
          language: composer.language,
        }),
      });

      setBroadcastGroup(null);
      setComposer((current) => ({ ...current, text: "" }));

      await loadData(true);
      toast.success(`Sent to ${data.sent}; ${data.failed} failed`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  function openConversation(phone) {
    setSelectedPhone(phone);
    setView("inbox");
  }

  if (loading) {
    return (
      <div
        className={`flex h-[calc(100dvh-24px)] min-h-[560px] items-center justify-center ${
          darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f2f4f1] text-black"
        }`}
      >
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`h-[calc(100dvh-24px)] min-h-[560px] overflow-hidden p-3 sm:p-4 ${
        darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f2f4f1] text-black"
      }`}
    >
      <div
        className={`grid h-full min-h-0 min-w-0 overflow-hidden rounded-[30px] border -sm lg:grid-cols-[230px_minmax(0,1fr)] ${surface}`}
      >
        {/* Desktop navigation rail. This area scrolls independently. */}
        <aside
          className={`hidden min-h-0 flex-col overflow-hidden border-r lg:flex ${divider}`}
        >
          <div className={`shrink-0 border-b p-5 ${divider}`}>
            <div className="flex items-center gap-3">
              <img src="/whatsappbusiness.svg" alt="WhatsApp" className="h-10 w-auto rounded-2xl" />
              <div className="min-w-0">
                <p className="truncate font-semibold">WhatsApp</p>
                <p className={`truncate text-xs ${muted}`}>Business inbox</p>
              </div>
            </div>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
            <p className={`px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.18em] ${muted}`}>
              Workspace
            </p>

            {navigation.map(({ id, label, subtitle, icon: Icon }) => {
              const active = view === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    active ? selected : hover
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      active
                        ? "bg-[#25D366] text-white"
                        : darkMode
                          ? "bg-white/[0.05] text-white/65"
                          : "bg-black/[0.04] text-black/65"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    <span className={`mt-0.5 block truncate text-xs ${muted}`}>
                      {subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className={`shrink-0 border-t p-3 ${divider}`}>
            <div
              className={`rounded-2xl p-3 ${
                health
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                {health ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
                <span className="truncate">
                  {health
                    ? health.displayPhoneNumber || "Meta connected"
                    : "Connection needs attention"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className={`mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm transition disabled:opacity-50 ${hover}`}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh data
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Mobile navigation */}
          <div className={`shrink-0 border-b p-3 lg:hidden ${divider}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
                  <MessageCircleMore className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">WhatsApp Business</p>
                  <p
                    className={`truncate text-xs ${
                      health ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {health
                      ? health.displayPhoneNumber || "Meta connected"
                      : "Connection needs attention"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                aria-label="Refresh WhatsApp data"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${hover}`}
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {navigation.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                    view === id
                      ? "bg-[#25D366] text-white"
                      : darkMode
                        ? "bg-white/[0.05] text-white/60"
                        : "bg-black/[0.04] text-black/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {healthError && (
            <div
              className={`mx-3 mt-3 flex shrink-0 items-start gap-3 rounded-2xl  border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 sm:mx-4`}
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-5">
                {healthError}. Temporary Meta tokens expire; regenerate the token if
                necessary.
              </span>
            </div>
          )}

          {view === "inbox" && (
            <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
              {/* Conversation list: fixed header + independently scrolling list */}
              <aside
                className={`min-h-0 min-w-0 flex-col overflow-hidden border-r ${divider} ${
                  selectedPhone ? "hidden lg:flex" : "flex"
                }`}
              >
                <div className={`shrink-0 border-b p-4 ${divider}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h1 className="text-lg font-semibold">Conversations</h1>
                      <p className={`mt-0.5 text-xs ${muted}`}>
                        {search.trim()
                          ? `${filteredConversations.length} of ${conversations.length} chats`
                          : `${conversations.length} chats available`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openContactModal()}
                      title="Add contact"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white transition hover:bg-[#20bd5a]"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="relative">
                    <Search
                      className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`}
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search conversations"
                      className={`${field} pl-10`}
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                  <div className="space-y-1">
                    {filteredConversations.map((item) => {
                      const name = item.contact?.name || formatPhone(item.phone);
                      const isActive = selectedPhone === item.phone;

                      return (
                        <button
                          key={item.phone}
                          type="button"
                          onClick={() => openConversation(item.phone)}
                          className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                            isActive ? selected : hover
                          }`}
                        >
                          <Initials name={name} accent />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">{name}</span>
                              <span className={`shrink-0 text-[10px] ${muted}`}>
                                {formatListTime(item.lastMessage?.timestamp)}
                              </span>
                            </span>
                            <span className={`mt-1 block truncate text-xs ${muted}`}>
                              {item.lastMessage?.text || "No message preview"}
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    {!filteredConversations.length && (
                      <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
                          <MessageCircleMore className="h-6 w-6" />
                        </span>
                        <p className="mt-4 text-sm font-medium">
                          {search.trim() ? "No matching conversations" : "No conversations found"}
                        </p>
                        <p className={`mt-1 text-xs leading-5 ${muted}`}>
                          {search.trim()
                            ? "Try another name, phone number, or message keyword."
                            : "Add a verified recipient and send the hello_world template."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              {/* Chat panel: header/composer stay fixed; only messages scroll */}
              <section
                className={`min-h-0 min-w-0 flex-col overflow-hidden ${
                  selectedPhone ? "flex" : "hidden lg:flex"
                }`}
              >
                {selectedPhone ? (
                  <>
                    <header className={`flex shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-5 ${divider}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedPhone("")}
                        aria-label="Back to conversations"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl lg:hidden ${hover}`}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>

                      <Initials name={recipientName} accent />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{recipientName}</p>
                        <p className={`truncate text-xs ${muted}`}>
                          {formatPhone(selectedPhone)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openContactModal(
                            selectedContact || {
                              name:
                                recipientName === formatPhone(selectedPhone)
                                  ? ""
                                  : recipientName,
                              phone: selectedPhone,
                            },
                          )
                        }
                        className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl transition sm:flex ${hover}`}
                        title={selectedContact ? "Rename contact" : "Save contact name"}
                        aria-label={selectedContact ? "Rename contact" : "Save contact name"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <span className="hidden items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-500 sm:inline-flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        WhatsApp
                      </span>
                    </header>

                    <div
                      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 ${subSurface}`}
                    >
                      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end space-y-3">
                        {!messages.length && (
                          <div className="flex flex-1 items-center justify-center py-16 text-center">
                            <div>
                              <p className="text-sm font-medium">No messages yet</p>
                              <p className={`mt-1 text-xs ${muted}`}>
                                Send a message to begin this conversation.
                              </p>
                            </div>
                          </div>
                        )}

                        {messages.map((message) => {
                          const outbound = message.direction === "outbound";

                          return (
                            <div
                              key={message.id}
                              className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[88%] rounded-[20px] px-4 py-3 text-sm -sm sm:max-w-[75%] ${
                                  outbound
                                    ? "rounded-br-md bg-[#d8f36a] text-black"
                                    : darkMode
                                      ? "rounded-bl-md bg-[#22252c] text-white"
                                      : "rounded-bl-md bg-white text-black"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words leading-5">
                                  {message.text}
                                </p>

                                <p
                                  className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                                    outbound ? "text-black/45" : muted
                                  }`}
                                >
                                  {formatTime(message.timestamp)}
                                  {outbound && (
                                    <CheckCheck
                                      className={`h-3 w-3 ${
                                        message.status === "read" ? "text-blue-600" : ""
                                      }`}
                                    />
                                  )}
                                </p>

                                {message.error && (
                                  <p className="mt-1 text-xs text-red-600">
                                    {message.error}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div ref={messagesEndRef} />
                      </div>
                    </div>

                    <footer className={`shrink-0 border-t p-3 sm:p-4 ${divider}`}>
                      <div className="mx-auto w-full max-w-4xl">
                        <div className="mb-3 flex items-center gap-2">
                          {["text", "template"].map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                setComposer((current) => ({ ...current, mode }))
                              }
                              className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                                composer.mode === mode
                                  ? "bg-[#25D366] text-white"
                                  : darkMode
                                    ? "bg-white/[0.06] text-white/55"
                                    : "bg-black/[0.04] text-black/55"
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-end gap-2 sm:gap-3">
                          {composer.mode === "text" ? (
                            <textarea
                              value={composer.text}
                              onChange={(event) =>
                                setComposer((current) => ({
                                  ...current,
                                  text: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  void sendMessage();
                                }
                              }}
                              rows={2}
                              placeholder="Type a message…"
                              className={`${field} max-h-36 min-h-12 resize-none py-3`}
                            />
                          ) : (
                            <SelectMenu
                              darkMode={darkMode}
                              value={composer.templateName}
                              options={templateOptions}
                              onChange={(templateName) =>
                                setComposer((current) => ({
                                  ...current,
                                  templateName,
                                }))
                              }
                              className="min-w-0 flex-1"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => sendMessage()}
                            disabled={sending}
                            aria-label="Send message"
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white transition hover:bg-[#20bd5a] disabled:opacity-50"
                          >
                            {sending ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Send className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </footer>
                  </>
                ) : (
                  <EmptyState
                    darkMode={darkMode}
                    muted={muted}
                    onAddContact={() => openContactModal()}
                  />
                )}
              </section>
            </div>
          )}

          {view === "contacts" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className={`flex shrink-0 items-center justify-between gap-4 border-b p-4 sm:p-5 ${divider}`}>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold">Contacts</h1>
                  <p className={`mt-1 text-xs ${muted}`}>
                    {contacts.length} saved WhatsApp recipients
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openContactModal()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#20bd5a]"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add contact</span>
                </button>
              </header>

              <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 ${subSurface}`}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-3 rounded-2xl  p-4 transition ${surface}`}
                    >
                      <Initials name={contact.name} accent size="lg" />

                      <button
                        type="button"
                        onClick={() => openConversation(contact.phone)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">{contact.name}</p>
                        <p className={`mt-1 truncate text-xs ${muted}`}>
                          {formatPhone(contact.phone)}
                        </p>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openContactModal(contact)}
                          aria-label={`Rename ${contact.name}`}
                          className={`rounded-xl p-2 transition ${hover}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteContact(contact.id)}
                          aria-label={`Delete ${contact.name}`}
                          className="rounded-xl p-2 text-red-500 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {!contacts.length && (
                  <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                    <ContactRound className="h-10 w-10 text-[#25D366]" />
                    <p className="mt-4 font-medium">No contacts saved</p>
                    <p className={`mt-1 text-sm ${muted}`}>
                      Add your first WhatsApp recipient.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "groups" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className={`flex shrink-0 items-center justify-between gap-4 border-b p-4 sm:p-5 ${divider}`}>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold">Recipient groups</h1>
                  <p className={`mt-1 text-xs ${muted}`}>
                    Broadcasts are sent as individual WhatsApp messages.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openGroupModal()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#20bd5a]"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create group</span>
                </button>
              </header>

              <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 ${subSurface}`}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={`rounded-[22px]  p-5 ${surface}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
                          <UsersRound className="h-5 w-5" />
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openGroupModal(group)}
                            aria-label={`Edit ${group.name}`}
                            className={`rounded-xl p-2 transition ${darkMode ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-black/55 hover:bg-black/5 hover:text-black"}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteGroup(group.id)}
                            aria-label={`Delete ${group.name}`}
                            className="rounded-xl p-2 text-red-500 transition hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="mt-4 truncate font-semibold">{group.name}</h3>
                      <p className={`mt-1 text-sm ${muted}`}>
                        {group.members.length} recipients
                      </p>

                      <button
                        type="button"
                        onClick={() => setBroadcastGroup(group)}
                        className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition ${
                          darkMode
                            ? "bg-white/[0.08] hover:bg-white/[0.13]"
                            : "bg-black text-white hover:bg-black/80"
                        }`}
                      >
                        <Send className="h-4 w-4" />
                        Send broadcast
                      </button>
                    </div>
                  ))}
                </div>

                {!groups.length && (
                  <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                    <UsersRound className="h-10 w-10 text-[#25D366]" />
                    <p className="mt-4 font-medium">No recipient groups</p>
                    <p className={`mt-1 text-sm ${muted}`}>
                      Create a group to send a broadcast.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {contactModal && (
        <Modal
          darkMode={darkMode}
          title={contactForm.id ? "Rename WhatsApp contact" : "Add WhatsApp contact"}
          onClose={closeContactModal}
        >
          <form onSubmit={addContact} className="space-y-4">
            <input
              required
              value={contactForm.name}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Contact name"
              className={field}
            />

            <input
              required
              inputMode="tel"
              disabled={Boolean(contactForm.id)}
              value={contactForm.phone}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="Phone with country code, e.g. 9198…"
              className={`${field} disabled:cursor-not-allowed disabled:opacity-60`}
            />

            <p className={`text-xs leading-5 ${muted}`}>
              {contactForm.id
                ? "Only the display name will change; existing chat history stays linked to this number."
                : "Test-number recipients must also be verified in Meta API Setup."}
            </p>

            <button className="w-full rounded-full bg-[#25D366] py-3 text-sm font-medium text-white transition hover:bg-[#20bd5a]">
              {contactForm.id ? "Save name" : "Save and open chat"}
            </button>
          </form>
        </Modal>
      )}

      {groupModal && (
        <Modal
          darkMode={darkMode}
          title={groupForm.id ? "Edit recipient group" : "Create recipient group"}
          onClose={closeGroupModal}
        >
          <form onSubmit={saveGroup} className="space-y-5">
            <label className="block">
              <span className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Broadcast name</span>
              <input
                required
                value={groupForm.name}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Group name"
                className={field}
              />
            </label>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Selected recipients</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${darkMode ? "bg-emerald-300/15 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}>
                  {groupForm.members.length} selected
                </span>
              </div>
              <div className={`mt-3 min-h-16 rounded-[24px]  p-3 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-[#f7f8f6]"}`}>
                {groupForm.members.length ? (
                  <div className="flex flex-wrap gap-2">
                    {groupForm.members.map((phone) => {
                      const contact = contactByPhone.get(phone);
                      return (
                        <span
                          key={phone}
                          className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${darkMode ? "border-white/10 bg-white/10 text-white" : "border-black/5 bg-white text-black "}`}
                        >
                          <span className="min-w-0 truncate">
                            {contact?.name || formatPhone(phone)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroupMember(phone)}
                            className="rounded-full text-red-500 transition hover:bg-red-500/10"
                            aria-label={`Remove ${contact?.name || phone}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`py-2 text-sm ${muted}`}>No recipients selected yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Add by number</p>
              <div className="flex gap-2">
              <input
                inputMode="tel"
                value={groupMemberInput}
                onChange={(event) => setGroupMemberInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addGroupMemberByPhone();
                  }
                }}
                placeholder="Add number, e.g. 9198..."
                className={field}
              />
              <button
                type="button"
                onClick={addGroupMemberByPhone}
                className="shrink-0 rounded-2xl bg-[#25D366] px-4 text-sm font-medium text-white transition hover:bg-[#20bd5a]"
              >
                Add
              </button>
              </div>
            </div>

            <div>
            <p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Add from saved contacts</p>

            <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {contacts.map((contact) => {
                const active = groupForm.members.includes(contact.phone);

                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => toggleGroupMember(contact.phone)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl  p-3 text-left transition-all duration-200 ${
                      active
                        ? darkMode ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-50" : "border-emerald-500 bg-emerald-50 text-emerald-950"
                        : darkMode
                          ? "border-white/10 text-white/75 hover:bg-white/[0.06]"
                          : "border-black/10 text-black/75 hover:bg-black/[0.025]"
                    }`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition-all duration-200 ${active ? "scale-105 border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {contact.name}
                    </span>
                    <span className={`shrink-0 text-xs ${muted}`}>
                      {formatPhone(contact.phone)}
                    </span>
                  </button>
                );
              })}

              {!contacts.length && (
                <p className={`py-6 text-center text-sm ${muted}`}>
                  Add contacts before creating a group.
                </p>
              )}
            </div>
            </div>

            <button
              disabled={!groupForm.members.length}
              className="mt-5 w-full rounded-full bg-[#25D366] py-3 text-sm font-medium text-white transition hover:bg-[#20bd5a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {groupForm.id ? "Save group changes" : "Create group"}
            </button>
          </form>
        </Modal>
      )}

      {broadcastGroup && (
        <Modal
          darkMode={darkMode}
          title={`Message ${broadcastGroup.name}`}
          onClose={() => setBroadcastGroup(null)}
        >
          <p className={`mb-4 text-sm ${muted}`}>
            This sends an individual message to {broadcastGroup.members.length}{" "}
            recipients.
          </p>

          <div className="mb-4 flex gap-2">
            {["text", "template"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  setComposer((current) => ({ ...current, mode }))
                }
                className={`rounded-full px-4 py-2 text-sm capitalize transition ${
                  composer.mode === mode
                    ? "bg-[#25D366] text-white"
                    : darkMode
                      ? "bg-white/[0.06] text-white/55"
                      : "bg-black/[0.04] text-black/55"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {composer.mode === "text" ? (
            <textarea
              rows={5}
              value={composer.text}
              onChange={(event) =>
                setComposer((current) => ({
                  ...current,
                  text: event.target.value,
                }))
              }
              placeholder="Broadcast message"
              className={`${field} h-auto resize-none py-3`}
            />
          ) : (
            <SelectMenu
              darkMode={darkMode}
              value={composer.templateName}
              options={templateOptions}
              onChange={(templateName) =>
                setComposer((current) => ({
                  ...current,
                  templateName,
                }))
              }
            />
          )}

          <button
            type="button"
            onClick={sendBroadcast}
            disabled={sending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-medium text-white transition hover:bg-[#20bd5a] disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send to group
          </button>
        </Modal>
      )}
    </div>
  );
}
