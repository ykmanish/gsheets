"use client";

import { useEffect, useState } from "react";
import { Bot, CalendarCheck, Clock3, FileText, Hash, Loader2, Save, Send } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";

// Slack's four-colour mark (lucide no longer ships brand icons).
function SlackMark({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 54 54" className={className} aria-hidden="true">
      <path fill="#36C5F0" d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" />
      <path fill="#2EB67D" d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" />
      <path fill="#ECB22E" d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" />
      <path fill="#E01E5A" d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336-.001v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" />
    </svg>
  );
}

// The three CEO checks on Slack: each runs at its time, Monday to Saturday (IST).
const CHECKS = [
  { key: "dmrCutoff", part: "dmr", label: "Today's DMR filled?", hint: "Checks whether today's actual manpower is in the DMR", icon: CalendarCheck },
  { key: "tomorrowPlanCutoff", part: "tomorrowPlan", label: "Tomorrow's plan added?", hint: "Checks whether tomorrow's planned manpower is in", icon: Clock3 },
  { key: "briefTime", part: "brief", label: "Evening brief", hint: "Employee report PDF plus an AI summary of the day", icon: FileText },
];

export default function CeoBriefSettings({ darkMode }) {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState("");

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const field = `h-11 w-full rounded-2xl border px-3 text-sm font-semibold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white focus:border-white/25" : "border-black/10 bg-white text-[#171714] focus:border-black/25"}`;
  const chip = `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/slack/ceo-brief/settings`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || "Could not load CEO brief settings");
        setSettings(data.settings);
        setStatus(data.status);
      })
      .catch((error) => toast.error(error.message));
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/slack/ceo-brief/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save");
      setSettings(data.settings);
      toast.success("CEO brief settings saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendNow(part) {
    setSending(part);
    try {
      const response = await fetch(`${API_URL}/slack/ceo-brief/send-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send");
      toast.success(`Posted in ${data.result?.sentTo || "Slack"}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending("");
    }
  }

  if (!settings) {
    return (
      <section className={`mb-5 flex items-center gap-3 rounded-[30px] border p-6 text-sm ${muted} ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading CEO brief settings…
      </section>
    );
  }

  const channelName = typeof status?.channel === "string" ? status.channel : null;
  const channelError = status?.channel?.error;

  return (
    <section className={`mb-5 overflow-hidden rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${darkMode ? "bg-[#4a154b]/40 text-[#e9c8ea]" : "bg-[#4a154b]/10 text-[#4a154b]"}`}>
            <SlackMark /> CEO daily report
          </span>
          <h2 className="small mt-4 text-2xl font-black">Today&apos;s report on Slack</h2>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>
            Posted in one Slack channel, Monday to Saturday, each under a &quot;Today&apos;s Report&quot; title with the day and date. Set the cut-off for each check; the evening brief attaches the employee report PDF and an AI summary of the day with its efficiency numbers. Nothing else goes to Slack.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
          className={`inline-flex h-11 shrink-0 items-center gap-3 rounded-full px-4 text-sm font-semibold transition ${settings.enabled ? "bg-emerald-500/10 text-emerald-600" : darkMode ? "bg-white/10 text-white/55" : "bg-slate-100 text-slate-500"}`}
        >
          <span className={`relative h-6 w-11 rounded-full transition ${settings.enabled ? "bg-emerald-500" : darkMode ? "bg-white/20" : "bg-slate-300"}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${settings.enabled ? "left-6" : "left-1"}`} />
          </span>
          {settings.enabled ? "On" : "Off"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className={`${chip} ${status?.slackConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500"}`}>
          <SlackMark className="h-3.5 w-3.5" /> {status?.slackConfigured ? "Slack connected" : "Slack not connected"}
        </span>
        <span className={`${chip} ${channelName ? "bg-sky-500/10 text-sky-600" : "bg-amber-500/10 text-amber-600"}`}>
          <Hash className="h-3.5 w-3.5" /> {channelName ? `Posts in ${channelName}` : channelError || "Channel not found"}
        </span>
        <span className={`${chip} ${status?.canAttachPdf ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
          <FileText className="h-3.5 w-3.5" /> {status?.canAttachPdf ? "PDF attaches in Slack" : "PDF sent as a link (add files:write to the Slack app)"}
        </span>
        <span className={`${chip} ${status?.aiConfigured ? "bg-violet-500/10 text-violet-600" : "bg-rose-500/10 text-rose-500"}`}>
          <Bot className="h-3.5 w-3.5" /> {status?.aiConfigured ? `AI summary: ${status.model}` : "AI summary off (no Anthropic key)"}
        </span>
      </div>

      <label className="mt-6 block max-w-xl">
        <span className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Slack channel</span>
        <div className="relative mt-2">
          <Hash className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
          <input
            type="text"
            value={settings.channel}
            onChange={(event) => setSettings((current) => ({ ...current, channel: event.target.value.replace(/^#/, "") }))}
            placeholder="uipl-updates"
            className={`${field} pl-9`}
          />
        </div>
      </label>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {CHECKS.map(({ key, part, label, hint, icon: Icon }) => (
          <div key={key} className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-slate-200 bg-[#f8f9fc]"}`}>
            <div className="flex items-center gap-2 text-sm font-black">
              <Icon className="h-4 w-4" /> {label}
            </div>
            <p className={`mt-1 text-xs leading-5 ${muted}`}>{hint}</p>
            <input
              type="time"
              value={settings[key]}
              onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
              className={`mt-3 ${field}`}
              aria-label={`${label} time`}
            />
            <button
              type="button"
              onClick={() => sendNow(part)}
              disabled={Boolean(sending)}
              className={`mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60 ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-[#171714] ring-1 ring-black/10 hover:bg-slate-50"}`}
            >
              {sending === part ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${darkMode ? "bg-white text-black hover:bg-white/90" : "bg-[#171714] text-white hover:bg-black/85"}`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save schedule
        </button>
      </div>
    </section>
  );
}
