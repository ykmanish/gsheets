"use client";

import { useEffect, useState } from "react";
import { Bot, CalendarCheck, Clock3, FileText, Hash, Loader2, Save, Send } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip, IconTile, TimeInput, Toggle, cx } from "./ui";

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

// Three colour-coded posts, Monday to Saturday (IST), each at its own time.
const TIMES = [
  { key: "dmrCutoff", part: "dmr", label: "DMR cut-off", hint: "Posts whether today's DMR is filled, with actual vs planned manpower by site", icon: CalendarCheck },
  { key: "tomorrowPlanCutoff", part: "tomorrowPlan", label: "Tomorrow's plan cut-off", hint: "Posts whether tomorrow's plan is in, with planned manpower by site", icon: Clock3 },
  { key: "briefTime", part: "brief", label: "Evening report", hint: "The day's status, the CEO's priorities, and the DMR and employee PDFs", icon: FileText },
];

export default function CeoBriefSettings({ darkMode }) {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState("");

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const field = `h-10 w-full rounded-full border px-4 text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`;

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
      <section className={cx("mb-5 flex items-center gap-3 rounded-[20px] border p-6 text-[13px]", muted, darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading CEO brief settings…
      </section>
    );
  }

  const channelName = typeof status?.channel === "string" ? status.channel : null;
  const channelError = status?.channel?.error;

  return (
    <section className={cx("mb-5 rounded-[20px] border p-5 sm:p-6", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={<SlackMark className="h-5 w-5" />} tone="neutral" darkMode={darkMode} size="md" />
          <div className="min-w-0">
            <h2 className="text-[18px] leading-tight tracking-[-0.01em]">Today&apos;s report on Slack</h2>
            <p className={cx("text-[18px] leading-tight tracking-[-0.01em]", darkMode ? "text-white/40" : "text-[#9a9a98]")}>the CEO daily report</p>
            <p className={`mt-2 max-w-2xl text-[13px] leading-6 ${muted}`}>
              Three posts in the Slack channel, Monday to Saturday, each under a &quot;Today&apos;s Report&quot; title with the day and date and colour-coded green, amber or red: the DMR at its cut-off, tomorrow&apos;s plan at its cut-off, and the evening report with the CEO&apos;s priorities and the DMR and employee PDFs. Nothing else goes to Slack.
            </p>
          </div>
        </div>
        <div className={cx("flex shrink-0 items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5", darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]")}>
          <span className="text-[13px]">{settings.enabled ? "On" : "Off"}</span>
          <Toggle
            darkMode={darkMode}
            checked={settings.enabled}
            label="CEO daily report"
            onChange={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        <Chip darkMode={darkMode} tone={status?.slackConfigured ? "mint" : "rose"} icon={SlackMark}>
          {status?.slackConfigured ? "Slack connected" : "Slack not connected"}
        </Chip>
        <Chip darkMode={darkMode} tone={channelName ? "sky" : "amber"} icon={Hash}>
          {channelName ? `Posts in ${channelName}` : channelError || "Channel not found"}
        </Chip>
        <Chip darkMode={darkMode} tone={status?.canAttachPdf ? "mint" : "amber"} icon={FileText}>
          {status?.canAttachPdf ? "PDF attaches in Slack" : "PDF sent as a link (add files:write to the Slack app)"}
        </Chip>
        <Chip darkMode={darkMode} tone={status?.aiConfigured ? "lavender" : "rose"} icon={Bot}>
          {status?.aiConfigured ? `AI summary: ${status.model}` : "AI summary off (no Anthropic key)"}
        </Chip>
      </div>

      <label className="mt-6 block max-w-xl">
        <span className={`text-[12.5px] ${muted}`}>Slack channel</span>
        <div className="relative mt-1.5">
          <Hash className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
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
        {TIMES.map(({ key, part, label, hint, icon: Icon }, index) => (
          <div key={key} className={cx("relative rounded-[20px] border p-5", darkMode ? "border-white/10 bg-white/[0.02]" : "border-[#ececec] bg-white")}>
            <span className={cx("absolute right-5 top-4 text-[12px] tabular-nums", darkMode ? "text-white/35" : "text-[#b0b0ae]")}>{String(index + 1).padStart(2, "0")}</span>
            <IconTile icon={Icon} tone={["mint", "amber", "lavender"][index] || "neutral"} darkMode={darkMode} size="md" />
            <p className="mt-4 text-[15px] tracking-[-0.01em]">{label}</p>
            <p className={`mt-1 text-[12.5px] leading-5 ${muted}`}>{hint}</p>
            <TimeInput
              darkMode={darkMode}
              value={settings[key]}
              onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
              className="mt-4"
              aria-label={`${label} time`}
            />
            <Button darkMode={darkMode} variant="secondary" size="sm" onClick={() => sendNow(part)} disabled={Boolean(sending)} loading={sending === part} icon={Send} className="mt-2 w-full">
              Send now
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Button darkMode={darkMode} variant="primary" size="lg" onClick={save} disabled={saving} loading={saving} icon={Save}>
          Save schedule
        </Button>
      </div>
    </section>
  );
}
