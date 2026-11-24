"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hash, Loader2, Megaphone, Send, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";

const CLOSE_MS = 220;

// The header's "Announcement" button and its right-side drawer. Shown only to people whose
// department may post announcements (set on the Module Control page); posts go to the
// company's Slack announcement channel.
export default function SlackAnnouncementComposer({ darkMode }) {
  const [access, setAccess] = useState(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifyAll, setNotifyAll] = useState(false);
  const [posting, setPosting] = useState(false);
  const closeTimer = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/slack/announcements/permission`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled) setAccess(data); })
      .catch(() => { if (!cancelled) setAccess(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function openDrawer() {
    window.clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }

  function closeDrawer() {
    if (!open || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_MS);
  }

  // Esc closes; focus lands on the title when the drawer opens; the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => titleRef.current?.focus(), 60);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
    };
  }, [open, closing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!access?.canPost) return null;

  const muted = darkMode ? "text-white/65" : "text-black/58";
  const field = `w-full rounded-[22px] border px-4 text-sm font-medium outline-none transition focus:ring-4 ${darkMode ? "border-white/10 bg-white/[0.05] text-white placeholder:text-white/35 focus:border-white/25 focus:ring-white/5" : "border-[#dfe7e4] bg-white text-[#161616] placeholder:text-black/35 focus:border-[#0f6b49]/40 focus:ring-emerald-500/10"}`;

  async function post(event) {
    event.preventDefault();
    if (!title.trim() || message.trim().length < 3) {
      toast.error("Add a title and a message");
      return;
    }
    setPosting(true);
    try {
      const response = await fetch(`${API_URL}/slack/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, notifyAll }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not post");
      toast.success(`Posted in #${access.channel}`);
      setAccess((current) => ({ ...current, recent: [data.announcement, ...(current.recent || [])].slice(0, 5) }));
      setTitle("");
      setMessage("");
      setNotifyAll(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPosting(false);
    }
  }

  const drawer = open && createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end">
      <div
        onMouseDown={closeDrawer}
        className={`project-drawer-backdrop absolute inset-0 bg-[#020609]/55 backdrop-blur-sm ${closing ? "is-closing" : ""}`}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Post an announcement"
        className={`project-drawer-panel relative flex h-full w-full max-w-[520px] flex-col overflow-hidden border-l shadow-[0_30px_100px_rgba(0,0,0,0.25)] ${closing ? "is-closing" : ""} ${darkMode ? "border-white/10 bg-[#171a20] text-white" : "border-[#dfe7e4] bg-white text-[#161616]"}`}
      >
        {!darkMode && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
          </div>
        )}

        <header className="relative z-10 flex items-start justify-between gap-4 px-6 pb-2 pt-6 sm:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#dfe7e4] bg-[#e8f6ee] text-[#0f6b49]"}`}>
                <Megaphone className="h-4 w-4" /> Announcement
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#eadb8f] bg-[#fff4a8] text-[#5b4b00]"}`}>
                <Hash className="h-3.5 w-3.5" /> {access.channel}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#efaccb] bg-[#f7bdd7] text-[#6f123b]"}`}>
                <Users className="h-3.5 w-3.5" /> Everyone
              </span>
            </div>
            <h2 className={`mt-5 text-3xl small font-black leading-[0.96] tracking-tight ${darkMode ? "text-white" : "text-[#161616]"}`}>Share an announcement.</h2>
            <p className={`mt-3 text-sm font-medium leading-6 ${muted}`}>It goes to everyone in the Slack announcement channel, with your name and department.</p>
          </div>
          <button type="button" onClick={closeDrawer} aria-label="Close" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={post} className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 sm:px-7">
            <label className="block">
              <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Title</span>
              <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} placeholder="e.g. Office closed on Friday" className={`mt-2 h-12 font-semibold ${field}`} />
            </label>
            <label className="block">
              <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Message</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2800} rows={7} placeholder="What everyone should know" className={`mt-2 resize-y py-3.5 ${field}`} />
            </label>
            <label className={`flex items-center gap-2.5 rounded-[18px] px-4 py-3 text-sm font-medium ${darkMode ? "bg-white/[0.05] text-white/75" : "bg-[#f7f5ef] text-black/70"}`}>
              <input type="checkbox" checked={notifyAll} onChange={(event) => setNotifyAll(event.target.checked)} className="h-4 w-4 accent-[#00c853]" />
              Notify everyone in the channel (@channel)
            </label>

            {access.recent?.length > 0 && (
              <div className="pt-2">
                <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Recently posted</span>
                <ul className="mt-3 grid gap-2">
                  {access.recent.map((item) => (
                    <li key={item.id} className={`rounded-[18px] border px-4 py-3 text-sm ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-[#dfe7e4] bg-white"}`}>
                      <span className="block font-semibold">{item.title}</span>
                      <span className={`mt-0.5 block text-xs ${muted}`}>
                        {item.authorName}{item.department ? ` · ${item.department}` : ""} · {new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <footer className={`flex items-center justify-end gap-3 border-t px-6 py-4 sm:px-7 ${darkMode ? "border-white/10" : "border-[#dfe7e4]"}`}>
            <button type="button" onClick={closeDrawer} className={`h-11 min-w-[108px] rounded-full border px-6 text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Cancel</button>
            <button type="submit" disabled={posting} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#00c853] px-6 text-sm font-bold text-white transition hover:bg-[#00b84d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post announcement
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className={`flex h-9 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px] font-medium transition-colors active:scale-[0.98] sm:px-3 ${darkMode ? "border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/10" : "border-[#e4e4e1] bg-white text-[#171717] shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:bg-[#f6f6f4]"}`}
        title="Post an announcement"
        aria-label="Post an announcement"
      >
        <Megaphone className="h-4 w-4" />
        <span className="hidden lg:inline">Announcement</span>
      </button>
      {drawer}
    </>
  );
}
