"use client";

import { useState, useSyncExternalStore } from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { API_URL } from "./AuthProvider";
import { showAppToast } from "./ToastPill";
import UserAvatar from "./UserAvatar";

// Cards never time out — they stay until the user hits View or closes them, so an unread message
// can't slip past while they are looking at another tab. MAX_VISIBLE only caps how many chats
// stack at once; each chat keeps a single card no matter how many messages arrive.
const MAX_VISIBLE = 3;
const PENDING_CONVERSATION_KEY = "uipl_forum_open_conversation";

// Module-level store so any page can raise a popup without threading props through the tree.
// The array is always replaced, never mutated, so useSyncExternalStore can compare snapshots.
let popups = [];
let sequence = 0;
const listeners = new Set();

function publish(next) {
  popups = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return popups;
}

// One card per conversation: a burst of messages in the same chat refreshes the card in place
// instead of stacking five of them down the screen.
export function showMessagePopup(popup) {
  const conversationId = String(popup?.conversationId || "");
  if (!conversationId) return;
  const rest = popups.filter((item) => item.conversationId !== conversationId);
  sequence += 1;
  publish([
    { ...popup, conversationId, id: `${conversationId}:${sequence}` },
    ...rest,
  ].slice(0, MAX_VISIBLE));
}

export function dismissMessagePopup(id) {
  if (!popups.some((item) => item.id === id)) return;
  publish(popups.filter((item) => item.id !== id));
}

// Opening a chat should clear its own popup — the user is looking at the message now.
export function dismissMessagePopupsFor(conversationId) {
  const id = String(conversationId || "");
  if (!popups.some((item) => item.conversationId === id)) return;
  publish(popups.filter((item) => item.conversationId !== id));
}

// Hands a conversation to the Loop UI across a page navigation: Loop reads this once on boot.
export function requestForumConversation(conversationId) {
  try {
    window.sessionStorage.setItem(PENDING_CONVERSATION_KEY, String(conversationId || ""));
  } catch {
    // Private-mode storage failures just mean Loop opens on the default conversation.
  }
}

export function takeRequestedForumConversation() {
  try {
    const value = window.sessionStorage.getItem(PENDING_CONVERSATION_KEY);
    if (value) window.sessionStorage.removeItem(PENDING_CONVERSATION_KEY);
    return value || "";
  } catch {
    return "";
  }
}

// Attachment-only messages carry no text, so fall back to the file name rather than a blank card.
export function forumMessagePreviewText(message) {
  const text = String(message?.text || "").trim();
  if (text) return text;
  return String(message?.attachment?.name || "").trim();
}

// A DM is titled by the sender alone; a group message needs to say which group it landed in.
export function forumMessagePopupContext(conversation) {
  if (!conversation || conversation.type !== "group") return "";
  return conversation.name ? `in ${conversation.name}` : "in a group chat";
}

function popupTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Replying from the popup posts to the same endpoint Loop's composer uses; the socket then
// delivers the sent message back to Loop like any other, so nothing has to be kept in sync here.
async function postForumReply(conversationId, text) {
  const response = await fetch(`${API_URL}/forum/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not send reply");
  return data;
}

// Answering a chat means you have read it — clear the server-side unread and let the launcher
// badge and Loop's own list know.
function markForumConversationRead(conversationId) {
  fetch(`${API_URL}/forum/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" })
    .then(() => {
      window.dispatchEvent(new CustomEvent("uipl:forum-conversation-read", { detail: { conversationId } }));
      window.dispatchEvent(new Event("uipl:forum-unread-changed"));
    })
    .catch(() => {
      // The reply already landed; a stale unread badge sorts itself out on the next load.
    });
}

function MessagePopupCard({ item, darkMode, onView }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const replyTarget = String(item.senderName || "").split(/\s+/)[0] || "chat";

  async function sendReply() {
    const text = draft.trim();
    if (!text || sending) return;
    try {
      setSending(true);
      await postForumReply(item.conversationId, text);
      markForumConversationRead(item.conversationId);
      dismissMessagePopup(item.id);
      showAppToast("Reply sent", { type: "success", darkMode, detail: item.senderName });
    } catch (error) {
      showAppToast(error.message || "Could not send reply", { type: "error", darkMode });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{ boxShadow: "var(--ui-shadow-pop)" }}
      className={`forum-message-popup newq pointer-events-auto w-full max-w-[min(840px,calc(100vw-2.5rem))] overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#17181c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}
      role="alert"
    >
      <div className="flex items-start gap-3.5 px-4 pt-4">
        <UserAvatar user={item.sender} name={item.senderName} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[15px] leading-tight">{item.senderName || "Someone"}</p>
            <span className={`shrink-0 text-[12px] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>{popupTime(item.createdAt)}</span>
          </div>
          {item.context && (
            <p className={`mt-0.5 truncate text-[12px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{item.context}</p>
          )}
          <p className={`mt-1.5 line-clamp-3 break-words text-[14px] leading-6 ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>
            {item.text || "Sent a message"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismissMessagePopup(item.id)}
          className={`-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white" : "bg-[#f4f4f2] text-[#5f5f5c] hover:bg-[#ebebe8] hover:text-[#141414]"}`}
          aria-label="Dismiss message notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* One footer row on a wide card — reply box, then View — so the extra width gets used
          instead of leaving two sparse rows stacked on top of each other. */}
      <div className="flex flex-col gap-2.5 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:gap-3">
        {item.mentioned && (
          <span className={`inline-flex h-8 shrink-0 items-center self-start rounded-full px-3 text-[12px] sm:self-auto ${darkMode ? "bg-amber-400/[0.13] text-[#f5d27a]" : "bg-[#fbf0d4] text-[#8a6200]"}`}>
            Mentioned you
          </span>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendReply();
              }
            }}
            maxLength={4000}
            disabled={sending}
            placeholder={`Reply to ${replyTarget}…`}
            aria-label="Reply message"
            className={`h-10 min-w-0 flex-1 rounded-full border border-transparent px-4 text-[14px] outline-none transition disabled:opacity-60 ${darkMode ? "bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10" : "bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`}
          />
          <button
            type="button"
            onClick={() => void sendReply()}
            disabled={sending || !draft.trim()}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"}`}
            aria-label="Send reply"
          >
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissMessagePopup(item.id);
            onView?.(item);
          }}
          className={`h-10 shrink-0 rounded-full border px-5 text-[13.5px] transition active:scale-95 ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}
        >
          View
        </button>
      </div>
    </div>
  );
}

// Cards hang below the navbar Loop button on desktop, since that is where Loop is opened from.
// Smaller screens open Loop from the floating button instead, so there the stack sits in the bottom
// corner — lifted clear of that button when `aboveLauncher` says it is on screen.
export function MessagePopupStack({ darkMode = false, onView, aboveLauncher = false }) {
  const items = useSyncExternalStore(subscribe, snapshot, snapshot);

  if (!items.length) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-[96] flex flex-col-reverse items-center gap-3 px-3 sm:inset-x-auto sm:right-5 sm:items-end sm:px-0 lg:bottom-auto lg:top-24 lg:flex-col ${aboveLauncher ? "bottom-24" : "bottom-5"}`}
    >
      {items.map((item) => (
        <MessagePopupCard key={item.id} item={item} darkMode={darkMode} onView={onView} />
      ))}
    </div>
  );
}
