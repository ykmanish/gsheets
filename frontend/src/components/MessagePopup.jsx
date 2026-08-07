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
      className={`forum-message-popup pointer-events-auto w-full max-w-[min(840px,calc(100vw-2.5rem))] overflow-hidden rounded-[22px] border shadow-[0_24px_64px_rgba(15,23,42,0.26)] ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/[0.07] bg-white text-[#111827]"}`}
      role="alert"
    >
      <div className="flex items-start gap-3.5 px-4 pt-4">
        <UserAvatar user={item.sender} name={item.senderName} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight">{item.senderName || "Someone"}</p>
            <span className={`shrink-0 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{popupTime(item.createdAt)}</span>
          </div>
          {item.context && (
            <p className={`mt-0.5 truncate text-xs font-semibold ${darkMode ? "text-white/45" : "text-black/45"}`}>{item.context}</p>
          )}
          <p className={`mt-1.5 line-clamp-3 break-words text-[15px] leading-6 ${darkMode ? "text-white/80" : "text-black/72"}`}>
            {item.text || "Sent a message"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismissMessagePopup(item.id)}
          className={`-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${darkMode ? "text-white/45 hover:bg-white/10 hover:text-white" : "text-black/35 hover:bg-black/[0.05] hover:text-black"}`}
          aria-label="Dismiss message notification"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
      {/* One footer row on a wide card — reply box, then View — so the extra width gets used
          instead of leaving two sparse rows stacked on top of each other. */}
      <div className="flex flex-col gap-2.5 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:gap-3">
        {item.mentioned && (
          <span className="inline-flex h-8 shrink-0 items-center self-start rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-700 sm:self-auto dark:bg-amber-400/12 dark:text-amber-200">
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
            className={`h-11 min-w-0 flex-1 rounded-full border px-4 text-[15px] outline-none transition disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.06] text-white placeholder:text-white/35 focus:border-[#2563eb]" : "border-[#e3e8ef] bg-[#f6f8fb] text-[#111827] placeholder:text-slate-400 focus:border-[#2563eb] focus:bg-white"}`}
          />
          <button
            type="button"
            onClick={() => void sendReply()}
            disabled={sending || !draft.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#22c55e] text-white transition hover:bg-[#16a34a] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send reply"
          >
            {sending ? <LoaderCircle className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissMessagePopup(item.id);
            onView?.(item);
          }}
          className="h-11 shrink-0 rounded-full bg-[#2563eb] px-6 text-[15px] font-bold text-white transition hover:bg-[#1d4ed8] active:scale-95"
        >
          View
        </button>
      </div>
    </div>
  );
}

// `aboveLauncher` leaves room for the floating Loop button so the newest card sits just on top of
// it; without the button (Loop page, mobile) the stack drops down to the normal corner inset.
export function MessagePopupStack({ darkMode = false, onView, aboveLauncher = false }) {
  const items = useSyncExternalStore(subscribe, snapshot, snapshot);

  if (!items.length) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-5 z-[96] flex flex-col-reverse items-center gap-3 px-3 sm:inset-x-auto sm:right-5 sm:items-end sm:px-0 ${aboveLauncher ? "sm:bottom-24" : "sm:bottom-5"}`}
    >
      {items.map((item) => (
        <MessagePopupCard key={item.id} item={item} darkMode={darkMode} onView={onView} />
      ))}
    </div>
  );
}
