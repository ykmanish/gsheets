"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hash, Megaphone, Send, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip, IconTile, cx } from "./ui";

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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const field = `w-full border px-4 text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`;

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
    <div className="fixed inset-0 z-[120] flex justify-end newq">
      <div
        onMouseDown={closeDrawer}
        className={`ui-backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] ${closing ? "is-closing" : ""}`}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Post an announcement"
        className={cx(
          "ui-drawer relative flex h-full w-full max-w-[520px] flex-col overflow-hidden border-l shadow-[0_24px_70px_rgba(0,0,0,0.16)] sm:m-2.5 sm:h-[calc(100%-20px)] sm:rounded-3xl sm:border",
          closing && "is-closing",
          darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]",
        )}
      >
        <header className={cx("flex items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={Megaphone} tone="peach" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-[17px] tracking-[-0.01em]">Share an announcement</h2>
              <p className={cx("truncate text-[12.5px]", muted)}>Goes to everyone, with your name and department</p>
            </div>
          </div>
          <button type="button" onClick={closeDrawer} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={post} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap gap-1.5">
              <Chip darkMode={darkMode} tone="sky" icon={Hash}>{access.channel}</Chip>
              <Chip darkMode={darkMode} tone="lavender" icon={Users}>Everyone</Chip>
            </div>
            <label className="block">
              <span className={`text-[12.5px] ${muted}`}>Title</span>
              <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} placeholder="e.g. Office closed on Friday" className={`mt-1.5 h-11 rounded-full ${field}`} />
            </label>
            <label className="block">
              <span className={`text-[12.5px] ${muted}`}>Message</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2800} rows={7} placeholder="What everyone should know" className={`mt-1.5 resize-y rounded-[16px] py-3 leading-6 ${field}`} />
            </label>
            <label className={cx("flex cursor-pointer items-center justify-between gap-3 rounded-[16px] px-4 py-3 text-[13px]", darkMode ? "bg-white/[0.04] text-white/80" : "bg-[#f7f7f5] text-[#3d3d3b]")}>
              <span className="flex items-center gap-2.5">
                <input type="checkbox" checked={notifyAll} onChange={(event) => setNotifyAll(event.target.checked)} className={cx("h-4 w-4", darkMode ? "accent-[#cff07a]" : "accent-[#141414]")} />
                Notify everyone in the channel (@channel)
              </span>
            </label>

            {access.recent?.length > 0 && (
              <div className="pt-2">
                <span className={`text-[12.5px] ${muted}`}>Recently posted</span>
                <ul className={cx("mt-2 divide-y", darkMode ? "divide-white/[0.07]" : "divide-[#f0f0ee]")}>
                  {access.recent.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-3 text-[13.5px]">
                      <IconTile icon={Megaphone} tone="neutral" darkMode={darkMode} size="xs" />
                      <span className="min-w-0">
                        <span className="block truncate">{item.title}</span>
                        <span className={`mt-0.5 block text-[12px] ${muted}`}>
                          {item.authorName}{item.department ? ` · ${item.department}` : ""} · {new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <footer className={cx("flex items-center justify-end gap-2 border-t px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
            <Button darkMode={darkMode} variant="secondary" onClick={closeDrawer}>Cancel</Button>
            <Button type="submit" darkMode={darkMode} variant={darkMode ? "accent" : "primary"} disabled={posting} loading={posting} icon={Send}>
              Post announcement
            </Button>
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
        className={cx(
          "flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[13px] transition-colors active:scale-[0.98] sm:px-3.5",
          darkMode ? "border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]",
        )}
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
