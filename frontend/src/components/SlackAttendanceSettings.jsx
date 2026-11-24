"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Eye, Hash, History, Loader2, LogIn, Lock, Megaphone, MessageCircle, Palmtree, Save, Send, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Select, TimeInput } from "./ui";

// The three reminders and when each goes out.
const REMINDERS = [
  { kind: "clockIn", label: "Clock-in reminder", timeKey: "clockInAt", icon: LogIn },
  { kind: "report", label: "Daily report reminder", timeKey: "reportAt", icon: AlarmClock },
  { kind: "clockOut", label: "Clock-out reminder", timeKey: "clockOutAt", icon: AlarmClock },
];

// Who can see what. Each reminder can reach any of these three audiences.
const AUDIENCES = [
  {
    key: "team",
    label: "Everyone channel",
    icon: Users,
    hint: "A plain reminder with its button. No names, counts or times.",
    example: { clockIn: "Good morning team! Please mark your attendance.", report: "Time to fill today's daily report.", clockOut: "It's time to clock out." },
  },
  {
    key: "personal",
    label: "Each employee — own data only",
    icon: UserRound,
    hint: "Only that person sees it: whether they're due, their own times, their own report.",
    example: { clockIn: "You haven't clocked in yet → You clocked in at 10:38 AM", report: "Your report isn't in yet → your filled report", clockOut: "You're still clocked in (every few min) → You clocked out at 7:12 PM" },
  },
  {
    key: "hr",
    label: "HR channel — full view",
    icon: ShieldCheck,
    hint: "Everyone's status, live: who has and hasn't, with times, and each report.",
    example: { clockIn: "Clocked in (16) with times · Not clocked in yet (10)", report: "Filed / not filed, each report in the thread", clockOut: "Still clocked in · Clocked out with hours" },
  },
];

const RESPONSES = [
  { value: "both", label: "The employee and HR" },
  { value: "employee", label: "Only the employee" },
  { value: "hr", label: "Only HR" },
  { value: "off", label: "Nobody" },
];

function Switch({ on, onChange, label, darkMode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : darkMode ? "bg-white/20" : "bg-slate-300"}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function SlackAttendanceSettings({ darkMode }) {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState("");

  const muted = darkMode ? "text-white/45" : "text-black/45";
  const card = darkMode ? "border-white/10 bg-white/[0.035]" : "border-slate-200 bg-[#f8f9fc]";
  const field = `h-11 w-full rounded-2xl border px-3 text-sm font-semibold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white focus:border-white/25" : "border-black/10 bg-white text-[#171714] focus:border-black/25"}`;
  const chip = "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold";
  const ghostButton = `inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60 ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-[#171714] ring-1 ring-black/10 hover:bg-slate-50"}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/slack/attendance/settings`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || "Could not load Slack attendance settings");
        setSettings(data.settings);
        setStatus(data.status);
      })
      .catch((error) => toast.error(error.message));
    return () => { cancelled = true; };
  }, []);

  const update = (patch) => setSettings((current) => ({ ...current, ...patch }));
  const updateMessage = (kind, patch) => setSettings((current) => ({
    ...current,
    messages: { ...current.messages, [kind]: { ...current.messages[kind], ...patch } },
  }));

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/slack/attendance/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save");
      setSettings(data.settings);
      setStatus(data.status);
      toast.success("Slack attendance settings saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendNow(kind) {
    setSending(kind);
    try {
      const response = await fetch(`${API_URL}/slack/attendance/send-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send");
      const result = data.result || {};
      if (result.skipped) toast(`Not sent: ${result.skipped}`);
      else if (kind === "cleanup") toast.success(`Cleared ${result.deleted || 0} message${result.deleted === 1 ? "" : "s"}`);
      else toast.success(`Sent${result.personal ? ` · ${result.personal} private note${result.personal === 1 ? "" : "s"}` : ""}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending("");
    }
  }

  if (!settings) {
    return (
      <section className={`mb-5 flex items-center gap-3 rounded-[30px] border p-6 text-sm ${muted} ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Slack attendance settings…
      </section>
    );
  }

  const teamChannel = status?.teamChannel;
  const hrChannel = status?.hrChannel;
  const employees = status?.employees;

  return (
    <section className={`mb-5 overflow-hidden rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${darkMode ? "bg-[#4a154b]/40 text-[#e9c8ea]" : "bg-[#4a154b]/10 text-[#4a154b]"}`}>
            <Eye className="h-4 w-4" /> Slack attendance &amp; report reminders
          </span>
          <h2 className="small mt-4 text-2xl font-black">Who sees what on Slack</h2>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${muted}`}>
            Monday to Saturday, three reminders. The everyone channel only gets the plain reminder. Each employee sees only their own status and report, privately. The HR channel sees everyone&apos;s, updated live. Choose below which audience gets each reminder.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${settings.enabled ? "text-emerald-600" : muted}`}>{settings.enabled ? "On" : "Off"}</span>
          <Switch on={settings.enabled} onChange={(enabled) => update({ enabled })} label="Slack attendance reminders" darkMode={darkMode} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className={`${chip} ${status?.slackConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500"}`}>
          {status?.slackConfigured ? "Slack connected" : "Slack not connected"}
        </span>
        {status && !status.scheduleRunning && (
          <span className={`${chip} bg-amber-500/10 text-amber-600`}>Schedule runs on the live server only</span>
        )}
        {employees && (
          <span className={`${chip} ${employees.inSlack === employees.total ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
            <UserRound className="h-3.5 w-3.5" /> {employees.inSlack} of {employees.total} employees found in Slack
          </span>
        )}
      </div>

      {/* Channels */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <label className={`block rounded-[24px] border p-4 ${card}`}>
          <span className="flex items-center gap-2 text-sm font-black"><Users className="h-4 w-4" /> Everyone channel</span>
          <span className={`mt-1 block text-xs leading-5 ${muted}`}>Where the plain reminders go. Everyone should be in it.</span>
          <div className="relative mt-3">
            <Hash className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
            <input value={settings.teamChannel} onChange={(event) => update({ teamChannel: event.target.value.replace(/^#/, "") })} placeholder="uipl-daily" className={`${field} pl-9`} />
          </div>
          {teamChannel?.error && <span className="mt-2 block text-xs font-semibold text-rose-500">{teamChannel.error}</span>}
        </label>
        <label className={`block rounded-[24px] border p-4 ${card}`}>
          <span className="flex items-center gap-2 text-sm font-black"><Lock className="h-4 w-4" /> HR channel (full view)</span>
          <span className={`mt-1 block text-xs leading-5 ${muted}`}>Make it a private channel with only HR in it, add the app with <code>/invite @UIPL Docs</code>, then paste its channel ID (channel name → About → Channel ID). Leave empty to turn the HR view off.</span>
          <div className="relative mt-3">
            <Hash className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
            <input value={settings.hrChannel} onChange={(event) => update({ hrChannel: event.target.value.replace(/^#/, "") })} placeholder="C0123ABCD or hr-attendance" className={`${field} pl-9`} />
          </div>
          {hrChannel?.error && <span className="mt-2 block text-xs font-semibold text-rose-500">{hrChannel.error}</span>}
        </label>
      </div>

      {/* Visibility matrix */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`w-[22%] pb-3 text-left text-xs font-semibold uppercase tracking-wide ${muted}`}>Reminder</th>
              {AUDIENCES.map(({ key, label, icon: Icon, hint }) => (
                <th key={key} className="pb-3 pl-3 text-left align-top">
                  <span className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4" /> {label}</span>
                  <span className={`mt-1 block text-xs font-normal leading-5 ${muted}`}>{hint}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REMINDERS.map(({ kind, label, timeKey, icon: Icon }) => (
              <tr key={kind}>
                <td className={`border-t py-4 pr-3 align-top ${darkMode ? "border-white/10" : "border-slate-200"}`}>
                  <span className="flex items-center gap-2 font-black"><Icon className="h-4 w-4" /> {label}</span>
                  <TimeInput darkMode={darkMode} value={settings[timeKey]} onChange={(event) => update({ [timeKey]: event.target.value })} className="mt-2" aria-label={`${label} time`} />
                  <button type="button" onClick={() => sendNow(kind)} disabled={Boolean(sending)} className={`mt-2 w-full ${ghostButton}`}>
                    {sending === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now
                  </button>
                </td>
                {AUDIENCES.map(({ key, label: audience, example }) => {
                  const on = Boolean(settings.messages[kind][key]);
                  const unavailable = key === "hr" && !settings.hrChannel;
                  return (
                    <td key={key} className={`border-t py-4 pl-3 align-top ${darkMode ? "border-white/10" : "border-slate-200"}`}>
                      <div className={`h-full rounded-[20px] border p-3 transition ${card} ${on && !unavailable ? "" : "opacity-55"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{unavailable ? "Set an HR channel first" : on ? "Shown" : "Not shown"}</span>
                          <Switch on={on} onChange={(value) => updateMessage(kind, { [key]: value })} label={`${label}: ${audience}`} darkMode={darkMode} />
                        </div>
                        <p className={`mt-2 text-xs leading-5 ${muted}`}>{example[kind]}</p>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delivery and the rest */}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className={`block rounded-[24px] border p-4 ${card}`}>
          <span className="text-sm font-black">How employees get their own data</span>
          <Select darkMode={darkMode} value={settings.personalDelivery} onChange={(event) => update({ personalDelivery: event.target.value })} className="mt-3">
            <option value="dm">Direct message from the app (recommended)</option>
            <option value="ephemeral">In the everyone channel, “only visible to you”</option>
          </Select>
          <span className={`mt-2 block text-xs leading-5 ${muted}`}>
            {settings.personalDelivery === "ephemeral"
              ? "Nobody else sees it, but Slack only shows it while the person has Slack open, and it's gone after they reload."
              : "Stays in their messages with the app until they delete it."}
          </span>
        </label>
        <label className={`block rounded-[24px] border p-4 ${card}`}>
          <span className="text-sm font-black">A filled report is sent to</span>
          <Select darkMode={darkMode} value={settings.messages.report.responses} onChange={(event) => updateMessage("report", { responses: event.target.value })} className="mt-3">
            {RESPONSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <span className={`mt-2 block text-xs leading-5 ${muted}`}>The employee gets only their own report; HR gets each report in the HR thread.</span>
        </label>
        <div className={`rounded-[24px] border p-4 ${card}`}>
          <span className="text-sm font-black">Clock-out repeats</span>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className={`text-xs ${muted}`}>Every (minutes)</span>
              <input type="number" min={5} max={60} value={settings.clockOutRepeatMinutes} onChange={(event) => update({ clockOutRepeatMinutes: Number(event.target.value) })} className={`mt-1 ${field}`} />
            </label>
            <label className="block">
              <span className={`text-xs ${muted}`}>Until</span>
              <TimeInput darkMode={darkMode} value={settings.clockOutUntil} onChange={(event) => update({ clockOutUntil: event.target.value })} className="mt-1" />
            </label>
          </div>
          <span className={`mt-2 block text-xs leading-5 ${muted}`}>Only the people still clocked in are reminded again, privately.</span>
        </div>
      </div>

      {/* Daily housekeeping, WhatsApp reminders, leave and announcements */}
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-[24px] border p-4 ${card}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-black"><Trash2 className="h-4 w-4" /> Clear after midnight</span>
            <Switch on={settings.cleanup.enabled} onChange={(enabled) => update({ cleanup: { ...settings.cleanup, enabled } })} label="Clear after midnight" darkMode={darkMode} />
          </div>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>Deletes the day&apos;s posts in the everyone channel and everyone&apos;s private notes, so each day starts clean.</p>
          <label className="mt-3 block">
            <span className={`text-xs ${muted}`}>At</span>
            <TimeInput darkMode={darkMode} value={settings.cleanup.time} onChange={(event) => update({ cleanup: { ...settings.cleanup, time: event.target.value } })} className="mt-1" />
          </label>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">Clear the HR channel too</span>
            <Switch on={settings.cleanup.includeHr} onChange={(includeHr) => update({ cleanup: { ...settings.cleanup, includeHr } })} label="Clear the HR channel too" darkMode={darkMode} />
          </div>
          <button type="button" onClick={() => sendNow("cleanup")} disabled={Boolean(sending)} className={`mt-3 w-full ${ghostButton}`}>
            {sending === "cleanup" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Clear earlier days now
          </button>
        </div>

        <div className={`rounded-[24px] border p-4 ${card}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4" /> Yesterday&apos;s misses</span>
            <Switch on={settings.morningRecap.enabled} onChange={(enabled) => update({ morningRecap: { enabled } })} label="Yesterday's misses" darkMode={darkMode} />
          </div>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>With the clock-in reminder, each person privately sees what they missed on the last working day: no clock-in, no clock-out, no report. A missed clock-in or clock-out comes with a <b>Request adjustment</b> button.</p>
          <button type="button" onClick={() => sendNow("recap")} disabled={Boolean(sending)} className={`mt-3 w-full ${ghostButton}`}>
            {sending === "recap" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now
          </button>
        </div>

        <div className={`rounded-[24px] border p-4 ${card}`}>
          <span className="flex items-center gap-2 text-sm font-black"><MessageCircle className="h-4 w-4" /> WhatsApp reminders on Slack</span>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>The daily-report reminder is the one above. DMR reminders (actual manpower, tomorrow&apos;s plan, site report) go privately to each person still due, and the full list to HR.</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">DMR reminders</span>
            <Switch on={settings.whatsappMirror.dmr} onChange={(dmr) => update({ whatsappMirror: { dmr } })} label="DMR reminders on Slack" darkMode={darkMode} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-black"><Palmtree className="h-4 w-4" /> Leave requests</span>
            <Switch on={settings.leave.enabled} onChange={(enabled) => update({ leave: { enabled } })} label="Leave requests on Slack" darkMode={darkMode} />
          </div>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>Each request, with its dates and reason, goes to HR with Approve and Decline (optional comment). The employee is told the result.</p>
        </div>

        <div className={`rounded-[24px] border p-4 ${card}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-black"><Megaphone className="h-4 w-4" /> Announcements</span>
            <Switch on={settings.announcements.enabled} onChange={(enabled) => update({ announcements: { ...settings.announcements, enabled } })} label="Announcements" darkMode={darkMode} />
          </div>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>Posted from the Dashboard page into one channel for everyone.</p>
          <div className="relative mt-3">
            <Hash className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
            <input value={settings.announcements.channel} onChange={(event) => update({ announcements: { ...settings.announcements, channel: event.target.value.replace(/^#/, "") } })} placeholder="announcements" className={`${field} pl-9`} aria-label="Announcement channel" />
          </div>
          {status?.announcementChannel?.error && <span className="mt-2 block text-xs font-semibold text-rose-500">{status.announcementChannel.error}</span>}
          <span className={`mt-3 block text-xs ${muted}`}>Departments that can post</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(status?.departments || settings.announcements.departments).map((department) => {
              const on = settings.announcements.departments.some((item) => item.toLowerCase() === department.toLowerCase());
              return (
                <button
                  key={department}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ announcements: { ...settings.announcements, departments: on ? settings.announcements.departments.filter((item) => item.toLowerCase() !== department.toLowerCase()) : [...settings.announcements.departments, department] } })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${on ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30" : darkMode ? "bg-white/10 text-white/60" : "bg-slate-100 text-slate-500"}`}
                >
                  {department}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Who is in which audience */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className={`rounded-[24px] border p-4 ${card}`}>
          <span className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4" /> Should be in the HR channel</span>
          <span className={`mt-1 block text-xs leading-5 ${muted}`}>People who can manage HR on the dashboard (change it in Manage Roles). Slack decides who reads the channel, so add these people there, and only them.</span>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(status?.hrPeople || []).map((person) => (
              <li key={person.name} className={`${chip} ${person.inSlack ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                {person.name}{person.inSlack ? "" : " · not in Slack"}
              </li>
            ))}
            {!status?.hrPeople?.length && <li className={`text-xs ${muted}`}>Nobody has HR access yet.</li>}
          </ul>
        </div>
        <div className={`rounded-[24px] border p-4 ${card}`}>
          <span className="flex items-center gap-2 text-sm font-black"><UserRound className="h-4 w-4" /> Employees not found in Slack</span>
          <span className={`mt-1 block text-xs leading-5 ${muted}`}>They miss their private notes until they join Slack. People are matched by the email on their dashboard account, or else by phone number (the one on their Slack profile).{employees?.noContact?.length ? " Red ones have no email and no phone on the dashboard, so add one in Manage Users." : ""}</span>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(employees?.missing || []).slice(0, 40).map((name) => {
              const noContact = employees?.noContact?.includes(name);
              const noEmail = employees?.noEmail?.includes(name);
              return (
                <li key={name} className={`${chip} ${noContact ? "bg-rose-500/10 text-rose-500" : darkMode ? "bg-white/10 text-white/70" : "bg-slate-100 text-slate-600"}`}>
                  {name}{noContact ? " · no email or phone" : noEmail ? " · no email" : ""}
                </li>
              );
            })}
            {employees && !employees.missing.length && <li className="text-xs font-semibold text-emerald-600">Everyone is in Slack.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${darkMode ? "bg-white text-black hover:bg-white/90" : "bg-[#171714] text-white hover:bg-black/85"}`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
      </div>
    </section>
  );
}
