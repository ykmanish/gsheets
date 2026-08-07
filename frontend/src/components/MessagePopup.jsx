"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { MessageCircleMore, X } from "lucide-react";
import UserAvatar from "./UserAvatar";

const POPUP_TTL = 9000;
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
    { ...popup, conversationId, id: `${conversationId}:${sequence}`, shownAt: Date.now() },
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

export function MessagePopupStack({ darkMode = false, onView }) {
  const items = useSyncExternalStore(subscribe, snapshot, snapshot);
  const pausedRef = useRef(false);

  // Cards expire on their own, but not while the pointer is on the stack — losing a message
  // under the cursor as you reach for View is worse than a card that lingers.
  useEffect(() => {
    if (!items.length) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      const cutoff = Date.now() - POPUP_TTL;
      const kept = popups.filter((item) => item.shownAt > cutoff);
      if (kept.length !== popups.length) publish(kept);
    }, 500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[96] flex flex-col items-center gap-2.5 px-3 sm:inset-x-auto sm:right-5 sm:top-5 sm:items-end sm:px-0"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`forum-message-popup pointer-events-auto w-full max-w-[380px] overflow-hidden rounded-2xl border shadow-[0_18px_50px_rgba(15,23,42,0.22)] ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/[0.08] bg-white text-[#111827]"}`}
          role="alert"
        >
          <div className="flex items-start gap-3 px-3.5 pt-3.5">
            <UserAvatar user={item.sender} name={item.senderName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold">{item.senderName || "Someone"}</p>
                <span className={`shrink-0 text-[11px] ${darkMode ? "text-white/40" : "text-black/40"}`}>{popupTime(item.createdAt)}</span>
              </div>
              {item.context && (
                <p className={`truncate text-[11px] font-semibold ${darkMode ? "text-white/45" : "text-black/45"}`}>{item.context}</p>
              )}
              <p className={`mt-1 line-clamp-2 break-words text-sm ${darkMode ? "text-white/75" : "text-black/70"}`}>
                {item.text || "Sent a message"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissMessagePopup(item.id)}
              className={`-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${darkMode ? "text-white/45 hover:bg-white/10 hover:text-white" : "text-black/35 hover:bg-black/[0.05] hover:text-black"}`}
              aria-label="Dismiss message notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 px-3.5 pb-3 pt-2.5">
            {item.mentioned ? (
              <span className="inline-flex h-7 items-center rounded-full bg-amber-50 px-2.5 text-[11px] font-bold text-amber-700 dark:bg-amber-400/12 dark:text-amber-200">
                Mentioned you
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${darkMode ? "text-white/40" : "text-black/40"}`}>
                <MessageCircleMore className="h-3.5 w-3.5" />
                New Loop message
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                dismissMessagePopup(item.id);
                onView?.(item);
              }}
              className="h-9 shrink-0 rounded-full bg-[#2563eb] px-5 text-sm font-bold text-white transition hover:bg-[#1d4ed8] active:scale-95"
            >
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
