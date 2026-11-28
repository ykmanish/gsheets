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
import { Button, Chip, ConfirmModal, EmptyState, IconTile, Notice, PageHeader, SelectMenu, Tabs, toneOf } from "./ui";

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

function Initials({ name, accent = false, size = "md", darkMode }) {
  const initials = String(name || "WA")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const sizeClass = size === "lg" ? "h-12 w-12 text-[15px]" : "h-10 w-10 text-[13px]";
  const t = toneOf(accent ? "mint" : "lime");

  return (
    <span
      style={{ backgroundColor: darkMode ? t[2] : t[0], color: darkMode ? t[3] : t[1] }}
      className={`flex shrink-0 items-center justify-center rounded-full ${sizeClass}`}
    >
      {initials || "WA"}
    </span>
  );
}

function Modal({ darkMode, title, onClose, children, icon = MessageCircleMore }) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] newq animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${
          darkMode
            ? "border-white/10 bg-[#121317] text-white"
            : "border-[#ececec] bg-white text-[#141414]"
        }`}
      >
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
          <div className="flex min-w-0 items-start gap-3">
            <IconTile icon={icon} tone="mint" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h3 className="truncate text-[17px] leading-tight">{title}</h3>
              <p className={`mt-1 text-[12.5px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>WhatsApp · workspace action</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function InboxEmpty({ darkMode, onAddContact }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto p-8">
      <EmptyState
        darkMode={darkMode}
        icon={MessageCircleMore}
        tone="mint"
        title="Select or start a conversation"
        text="Choose a conversation from the left panel, or add a new verified WhatsApp recipient."
        action={<Button darkMode={darkMode} variant="primary" icon={Plus} onClick={onAddContact}>Add contact</Button>}
        className="w-full max-w-md !bg-transparent"
      />
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
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesPaneRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const previousSelectedPhoneRef = useRef("");

  const surface = darkMode
    ? "border-white/10 bg-[#15171c]"
    : "border-[#ececec] bg-white";
  const subSurface = darkMode ? "bg-white/[0.02]" : "bg-[#fafaf9]";
  const divider = darkMode ? "border-white/10" : "border-[#f0f0ee]";
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const hover = darkMode ? "hover:bg-white/[0.05]" : "hover:bg-[#f7f7f5]";
  const selected = darkMode ? "bg-white/[0.08]" : "bg-[#f4f4f2]";
  const field = `h-11 w-full rounded-full border px-4 text-[13.5px] outline-none transition ${
    darkMode
      ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10"
      : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"
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
    if (previousSelectedPhoneRef.current !== selectedPhone) {
      shouldStickToBottomRef.current = true;
      previousSelectedPhoneRef.current = selectedPhone;
    }
  }, [selectedPhone]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  function updateMessageScrollState() {
    const pane = messagesPaneRef.current;
    if (!pane) return;

    const distanceFromBottom =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 120;
  }

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
      shouldStickToBottomRef.current = true;

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

  async function performDeleteContact(id) {
    try {
      await api(`/whatsapp/contacts/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      await loadData(true);
      toast.success("Contact removed");
    } catch (error) {
      toast.error(error.message);
    }
  }

  function deleteContact(id) {
    setDeleteConfirm(id);
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
        className={`flex h-[calc(100dvh-24px)] min-h-[560px] items-center justify-center newq ${
          darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"
        }`}
      >
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  const navTones = { inbox: "mint", contacts: "sky", groups: "lavender" };
  const modeTabs = [
    { id: "text", label: "Text" },
    { id: "template", label: "Template" },
  ];
  const primaryRound = darkMode
    ? "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]"
    : "bg-[#141414] text-white hover:bg-black";
  const iconGhost = `grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${hover}`;
  const fieldLabel = `mb-2 block text-[12.5px] ${muted}`;

  return (
    <div
      className={`flex h-[calc(100dvh-24px)] min-h-[560px] flex-col overflow-hidden px-4 py-5 newq sm:px-6 lg:px-8 lg:py-6 ${
        darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"
      }`}
    >
      <PageHeader
        darkMode={darkMode}
        className="shrink-0"
        badge="WhatsApp Business"
        badgeIcon={MessageCircleMore}
        badgeTone="mint"
        title="WhatsApp"
        subtitle="inbox, contacts and broadcasts"
        actions={(
          <>
            <Chip darkMode={darkMode} tone={health ? "mint" : "rose"} icon={health ? Wifi : WifiOff}>
              <span className="max-w-[200px] truncate">
                {health
                  ? health.displayPhoneNumber || "Meta connected"
                  : "Connection needs attention"}
              </span>
            </Chip>
            <Button darkMode={darkMode} variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => loadData(true)} disabled={refreshing} aria-label="Refresh WhatsApp data">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        )}
      />

      <div
        className={`mt-5 grid min-h-0 min-w-0 flex-1 overflow-hidden rounded-[20px] border lg:grid-cols-[236px_minmax(0,1fr)] ${surface}`}
      >
        {/* Desktop navigation rail. This area scrolls independently. */}
        <aside
          className={`hidden min-h-0 flex-col overflow-hidden border-r lg:flex ${divider}`}
        >
          <div className={`shrink-0 border-b px-5 py-4 ${divider}`}>
            <div className="flex items-center gap-3">
              <img src="/whatsappbusiness.svg" alt="WhatsApp" className="h-9 w-auto rounded-[11px]" />
              <div className="min-w-0">
                <p className="truncate text-[14px]">WhatsApp</p>
                <p className={`truncate text-[12px] ${muted}`}>Business inbox</p>
              </div>
            </div>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
            {navigation.map(({ id, label, subtitle, icon: Icon }) => {
              const active = view === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left transition ${
                    active ? selected : hover
                  }`}
                >
                  <IconTile icon={Icon} tone={active ? navTones[id] : "neutral"} darkMode={darkMode} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{label}</span>
                    <span className={`mt-0.5 block truncate text-[12px] ${muted}`}>
                      {subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Mobile navigation */}
          <div className={`shrink-0 overflow-x-auto border-b p-3 lg:hidden ${divider}`}>
            <Tabs
              darkMode={darkMode}
              items={navigation.map(({ id, label, icon }) => ({ id, label, icon }))}
              value={view}
              onChange={setView}
            />
          </div>

          {healthError && (
            <Notice tone="amber" darkMode={darkMode} icon={CircleAlert} className="mx-3 mt-3 shrink-0 sm:mx-4">
              {healthError}. Temporary Meta tokens expire; regenerate the token if
              necessary.
            </Notice>
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
                      <h1 className="text-[16px] leading-tight">Conversations</h1>
                      <p className={`mt-0.5 text-[12px] ${muted}`}>
                        {search.trim()
                          ? `${filteredConversations.length} of ${conversations.length} chats`
                          : `${conversations.length} chats available`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openContactModal()}
                      title="Add contact"
                      aria-label="Add contact"
                      className={`grid h-9 w-9 place-items-center rounded-full transition ${primaryRound}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="relative">
                    <Search
                      className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`}
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search conversations"
                      className={`${field} h-10 pl-10`}
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                  <div className="space-y-0.5">
                    {filteredConversations.map((item) => {
                      const name = item.contact?.name || formatPhone(item.phone);
                      const isActive = selectedPhone === item.phone;

                      return (
                        <button
                          key={item.phone}
                          type="button"
                          onClick={() => openConversation(item.phone)}
                          className={`flex w-full items-center gap-3 rounded-[14px] p-2.5 text-left transition ${
                            isActive ? selected : hover
                          }`}
                        >
                          <Initials name={name} accent darkMode={darkMode} />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13.5px]">{name}</span>
                              <span className={`shrink-0 text-[11px] tabular-nums ${muted}`}>
                                {formatListTime(item.lastMessage?.timestamp)}
                              </span>
                            </span>
                            <span className={`mt-0.5 block truncate text-[12.5px] ${muted}`}>
                              {item.lastMessage?.text || "No message preview"}
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    {!filteredConversations.length && (
                      <EmptyState
                        darkMode={darkMode}
                        icon={MessageCircleMore}
                        tone="mint"
                        title={search.trim() ? "No matching conversations" : "No conversations found"}
                        text={search.trim()
                          ? "Try another name, phone number, or message keyword."
                          : "Add a verified recipient and send the hello_world template."}
                        className="m-1 min-h-72"
                      />
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
                        className={`${iconGhost} lg:hidden`}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>

                      <Initials name={recipientName} accent darkMode={darkMode} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px]">{recipientName}</p>
                        <p className={`truncate text-[12px] ${muted}`}>
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
                        className={`${iconGhost} hidden sm:grid`}
                        title={selectedContact ? "Rename contact" : "Save contact name"}
                        aria-label={selectedContact ? "Rename contact" : "Save contact name"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <Chip darkMode={darkMode} tone="mint" className="hidden h-7 sm:inline-flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        WhatsApp
                      </Chip>
                    </header>

                    <div
                      ref={messagesPaneRef}
                      onScroll={updateMessageScrollState}
                      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 ${subSurface}`}
                    >
                      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end space-y-2.5">
                        {!messages.length && (
                          <div className="flex flex-1 items-center justify-center py-16 text-center">
                            <div>
                              <p className="text-[14px]">No messages yet</p>
                              <p className={`mt-1 text-[12.5px] ${muted}`}>
                                Send a message to begin this conversation.
                              </p>
                            </div>
                          </div>
                        )}

                        {messages.map((message) => {
                          const outbound = message.direction === "outbound";
                          const outboundBubble = darkMode
                            ? "rounded-br-[6px] bg-[#cff07a]/15 text-white"
                            : "rounded-br-[6px] bg-[#e7f6c0] text-[#141414]";
                          const inboundBubble = darkMode
                            ? "rounded-bl-[6px] bg-white/[0.07] text-white"
                            : "rounded-bl-[6px] border border-[#ececec] bg-white text-[#141414]";

                          return (
                            <div
                              key={message.id}
                              className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[88%] rounded-[18px] px-4 py-2.5 text-[13.5px] sm:max-w-[75%] ${
                                  outbound ? outboundBubble : inboundBubble
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words leading-5">
                                  {message.text}
                                </p>

                                <p
                                  className={`mt-1 flex items-center justify-end gap-1 text-[10.5px] ${
                                    darkMode ? "text-white/45" : "text-[#8a8a8a]"
                                  }`}
                                >
                                  {formatTime(message.timestamp)}
                                  {outbound && (
                                    <CheckCheck
                                      className={`h-3 w-3 ${
                                        message.status === "read"
                                          ? "text-[#2f6fc0]"
                                          : darkMode
                                            ? "text-white/50"
                                            : "text-[#8a8a8a]"
                                      }`}
                                    />
                                  )}
                                </p>

                                {message.error && (
                                  <p className="mt-1 text-[12px] text-[#c0394b]">
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
                        <Tabs
                          darkMode={darkMode}
                          className="mb-3"
                          items={modeTabs}
                          value={composer.mode}
                          onChange={(mode) =>
                            setComposer((current) => ({ ...current, mode }))
                          }
                        />

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
                              className={`${field} max-h-36 min-h-12 resize-none rounded-[22px] py-3`}
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
                            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${primaryRound}`}
                          >
                            {sending ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Send className="h-[18px] w-[18px]" />
                            )}
                          </button>
                        </div>
                      </div>
                    </footer>
                  </>
                ) : (
                  <InboxEmpty
                    darkMode={darkMode}
                    onAddContact={() => openContactModal()}
                  />
                )}
              </section>
            </div>
          )}

          {view === "contacts" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className={`flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 ${divider}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <IconTile icon={ContactRound} tone="sky" darkMode={darkMode} size="sm" />
                  <div className="min-w-0">
                    <h1 className="truncate text-[16px] leading-tight">Contacts</h1>
                    <p className={`mt-0.5 text-[12px] ${muted}`}>
                      {contacts.length} saved WhatsApp recipients
                    </p>
                  </div>
                </div>

                <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={() => openContactModal()} className="shrink-0">
                  <span className="hidden sm:inline">Add contact</span>
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-3 rounded-[18px] border p-4 transition ${darkMode ? "border-white/10 bg-white/[0.02]" : "border-[#ececec] bg-white"}`}
                    >
                      <Initials name={contact.name} accent size="lg" darkMode={darkMode} />

                      <button
                        type="button"
                        onClick={() => openConversation(contact.phone)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-[14px]">{contact.name}</p>
                        <p className={`mt-0.5 truncate text-[12.5px] ${muted}`}>
                          {formatPhone(contact.phone)}
                        </p>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openContactModal(contact)}
                          aria-label={`Rename ${contact.name}`}
                          className={iconGhost}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteContact(contact.id)}
                          aria-label={`Delete ${contact.name}`}
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "text-rose-200 hover:bg-rose-400/10" : "text-[#c0394b] hover:bg-[#fbe4e6]"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {!contacts.length && (
                  <EmptyState darkMode={darkMode} icon={ContactRound} tone="sky" title="No contacts saved" text="Add your first WhatsApp recipient." className="min-h-[50vh]" />
                )}
              </div>
            </section>
          )}

          {view === "groups" && (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className={`flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 ${divider}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <IconTile icon={UsersRound} tone="lavender" darkMode={darkMode} size="sm" />
                  <div className="min-w-0">
                    <h1 className="truncate text-[16px] leading-tight">Recipient groups</h1>
                    <p className={`mt-0.5 text-[12px] ${muted}`}>
                      Broadcasts are sent as individual WhatsApp messages.
                    </p>
                  </div>
                </div>

                <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={() => openGroupModal()} className="shrink-0">
                  <span className="hidden sm:inline">Create group</span>
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {groups.map((group, index) => (
                    <div
                      key={group.id}
                      className={`relative flex flex-col rounded-[20px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.02]" : "border-[#ececec] bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <IconTile icon={UsersRound} tone="lavender" darkMode={darkMode} />

                        <div className="flex items-center gap-1">
                          <span className={`mr-1 text-[12px] tabular-nums ${darkMode ? "text-white/35" : "text-[#b0b0ae]"}`}>{String(index + 1).padStart(2, "0")}</span>
                          <button
                            type="button"
                            onClick={() => openGroupModal(group)}
                            aria-label={`Edit ${group.name}`}
                            className={iconGhost}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteGroup(group.id)}
                            aria-label={`Delete ${group.name}`}
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "text-rose-200 hover:bg-rose-400/10" : "text-[#c0394b] hover:bg-[#fbe4e6]"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="mt-4 truncate text-[15px]">{group.name}</h3>
                      <p className={`mt-0.5 text-[13px] ${muted}`}>
                        {group.members.length} recipients
                      </p>

                      <Button darkMode={darkMode} variant="primary" icon={Send} onClick={() => setBroadcastGroup(group)} className="mt-5 w-full">
                        Send broadcast
                      </Button>
                    </div>
                  ))}
                </div>

                {!groups.length && (
                  <EmptyState darkMode={darkMode} icon={UsersRound} tone="lavender" title="No recipient groups" text="Create a group to send a broadcast." className="min-h-[50vh]" />
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {contactModal && (
        <Modal
          darkMode={darkMode}
          icon={ContactRound}
          title={contactForm.id ? "Rename WhatsApp contact" : "Add WhatsApp contact"}
          onClose={closeContactModal}
        >
          <form onSubmit={addContact} className="space-y-5">
            <label className="block">
              <span className={fieldLabel}>Contact name</span>
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
            </label>

            <label className="block">
              <span className={fieldLabel}>Phone number</span>
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
            </label>

            <Notice tone="neutral" darkMode={darkMode}>
              {contactForm.id
                ? "Only the display name will change; existing chat history stays linked to this number."
                : "Test-number recipients must also be verified in Meta API Setup."}
            </Notice>

            <Button darkMode={darkMode} variant="primary" size="lg" type="submit" className="w-full">
              {contactForm.id ? "Save name" : "Save and open chat"}
            </Button>
          </form>
        </Modal>
      )}

      {groupModal && (
        <Modal
          darkMode={darkMode}
          icon={UsersRound}
          title={groupForm.id ? "Edit recipient group" : "Create recipient group"}
          onClose={closeGroupModal}
        >
          <form onSubmit={saveGroup} className="space-y-6">
            <label className="block">
              <span className={fieldLabel}>Broadcast name</span>
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
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className={`text-[12.5px] ${muted}`}>Selected recipients</p>
                <Chip darkMode={darkMode} tone="mint" className="h-6 px-2.5 text-[12px]">
                  {groupForm.members.length} selected
                </Chip>
              </div>
              <div className={`min-h-16 rounded-[18px] p-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                {groupForm.members.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {groupForm.members.map((phone) => {
                      const contact = contactByPhone.get(phone);
                      return (
                        <span
                          key={phone}
                          className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-full pl-3 pr-1.5 text-[12.5px] ${darkMode ? "bg-white/10 text-white" : "bg-white text-[#141414]"}`}
                        >
                          <span className="min-w-0 truncate">
                            {contact?.name || formatPhone(phone)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroupMember(phone)}
                            className={`grid h-5 w-5 place-items-center rounded-full transition ${darkMode ? "text-white/60 hover:bg-white/10" : "text-[#8a8a8a] hover:bg-[#f4f4f2] hover:text-[#c0394b]"}`}
                            aria-label={`Remove ${contact?.name || phone}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`py-2 text-[13px] ${muted}`}>No recipients selected yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className={fieldLabel}>Add by number</p>
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
                <Button darkMode={darkMode} variant="soft" icon={Plus} onClick={addGroupMemberByPhone} className="h-11 shrink-0">
                  Add
                </Button>
              </div>
            </div>

            <div>
              <p className={fieldLabel}>Add from saved contacts</p>

              <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
                {contacts.map((contact) => {
                  const active = groupForm.members.includes(contact.phone);

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleGroupMember(contact.phone)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] p-3 text-left transition ${
                        active
                          ? darkMode ? "bg-white/[0.07] text-white" : "bg-[#f4f4f2] text-[#141414]"
                          : darkMode
                            ? "text-white/75 hover:bg-white/[0.04]"
                            : "text-[#3d3d3b] hover:bg-[#f7f7f5]"
                      }`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition ${active ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/20" : "border-[#cfcfcb] bg-white"}`}>
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {contact.name}
                      </span>
                      <span className={`shrink-0 text-[12px] ${muted}`}>
                        {formatPhone(contact.phone)}
                      </span>
                    </button>
                  );
                })}

                {!contacts.length && (
                  <p className={`py-6 text-center text-[13px] ${muted}`}>
                    Add contacts before creating a group.
                  </p>
                )}
              </div>
            </div>

            <Button
              darkMode={darkMode}
              variant="primary"
              size="lg"
              type="submit"
              disabled={!groupForm.members.length}
              className="w-full"
            >
              {groupForm.id ? "Save group changes" : "Create group"}
            </Button>
          </form>
        </Modal>
      )}

      {broadcastGroup && (
        <Modal
          darkMode={darkMode}
          icon={Send}
          title={`Message ${broadcastGroup.name}`}
          onClose={() => setBroadcastGroup(null)}
        >
          <p className={`mb-4 text-[13px] ${muted}`}>
            This sends an individual message to {broadcastGroup.members.length}{" "}
            recipients.
          </p>

          <Tabs
            darkMode={darkMode}
            className="mb-4"
            items={modeTabs}
            value={composer.mode}
            onChange={(mode) =>
              setComposer((current) => ({ ...current, mode }))
            }
          />

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
              className={`${field} h-auto resize-none rounded-[16px] py-3`}
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

          <Button
            darkMode={darkMode}
            variant="primary"
            size="lg"
            icon={Send}
            loading={sending}
            onClick={sendBroadcast}
            disabled={sending}
            className="mt-5 w-full"
          >
            Send to group
          </Button>
        </Modal>
      )}
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title="Delete contact"
        message="Delete this WhatsApp contact? Conversation history will remain."
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => performDeleteContact(deleteConfirm)}
      />
    </div>
  );
}
