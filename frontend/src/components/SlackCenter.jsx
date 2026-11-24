"use client";

import { useEffect, useState } from "react";
import { AlarmClock, AlertTriangle, ArrowUpRight, BellRing, CalendarDays, CheckCircle2, Hash, Lock, Megaphone, MessageSquareText, Moon, NotebookPen, Palmtree, RefreshCw, Repeat, ShieldCheck, Sunrise, Trash2, UserRound, Users } from "lucide-react";
import { API_URL } from "./AuthProvider";
import SlackLogo from "./SlackLogo";
import { Tabs } from "./ui";
import SlackAttendanceSettings from "./SlackAttendanceSettings";
import CeoBriefSettings from "./CeoBriefSettings";

// The Slack page: an overview of who Slack reaches, what is set up and what went out today,
// then the settings for the attendance/report reminders and the CEO daily report.

const TABS = [
  { id: "reminders", label: "Attendance & reports", icon: BellRing },
  { id: "ceo", label: "CEO daily report", icon: MessageSquareText },
];

const minutesOf = (hhmm = "00:00") => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
function istNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return (Number(parts.find((p) => p.type === "hour")?.value) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
}
function clockLabel(hhmm = "00:00") {
  const minutes = minutesOf(hhmm);
  const hour = Math.floor(minutes / 60);
  return `${((hour + 11) % 12) + 1}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

// A striped bar with its count in a dark pill at the end of the fill.
function HatchBar({ value, total, color, darkMode }) {
  const pct = total ? Math.max(value ? 9 : 0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div className={`relative h-8 w-full overflow-hidden rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#efeee9]"}`}>
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full pr-1 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${pct}%`, backgroundColor: color, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.28) 0 2px, transparent 2px 7px)" }}
      >
        {value > 0 && <span className="grid h-6 min-w-8 place-items-center rounded-full bg-[#10231c] px-2 text-[11px] font-semibold text-white">{value}</span>}
      </div>
      {value === 0 && <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold ${darkMode ? "text-white/40" : "text-black/35"}`}>0</span>}
    </div>
  );
}

function Card({ darkMode, className = "", children }) {
  return <section className={`rounded-[18px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#e8e8e6] bg-white text-[#171717]"} ${className}`}>{children}</section>;
}

function Pill({ tone = "green", children }) {
  const tones = {
    green: "bg-[#e3f6ea] text-[#147a45]",
    amber: "bg-[#fff2d9] text-[#9a6200]",
    red: "bg-[#fde8e4] text-[#b4412b]",
    grey: "bg-[#efeee9] text-[#5c625f]",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export default function SlackCenter({ darkMode }) {
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("reminders");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => istNowMinutes());

  async function load() {
    setRefreshing(true);
    try {
      const [settingsResponse, overviewResponse] = await Promise.all([
        fetch(`${API_URL}/slack/attendance/settings`),
        fetch(`${API_URL}/slack/overview`),
      ]);
      const settingsData = await settingsResponse.json();
      const overviewData = await overviewResponse.json().catch(() => ({}));
      if (!settingsResponse.ok) throw new Error(settingsData.error || "Could not load Slack");
      setData(settingsData);
      setOverview(overviewResponse.ok ? overviewData : null);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setRefreshing(false);
      setNow(istNowMinutes());
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const muted = darkMode ? "text-white/50" : "text-[#6b716e]";
  const soft = darkMode ? "bg-white/[0.045]" : "bg-[#f6f5f1]";
  const status = data?.status;
  const settings = data?.settings;
  const employees = status?.employees || { total: 0, inSlack: 0, missing: [], noContact: [] };
  const hrPeople = status?.hrPeople || [];
  const hrInSlack = hrPeople.filter((person) => person.inSlack).length;
  const noContact = employees.noContact?.length || 0;
  const notJoined = Math.max(0, (employees.missing?.length || 0) - noContact);

  // What has to be true before everything works, worst first.
  const checks = (() => {
    if (!status || !settings) return [];
    return [
      { ok: Boolean(status.slackConfigured), icon: SlackLogo, title: status.slackConfigured ? "Slack app connected" : "Slack app not connected", detail: "UIPL Docs app in the Juniper workspace" },
      { ok: Boolean(status.teamChannel?.id), icon: Hash, title: status.teamChannel?.id ? `${status.teamChannel.name} is ready` : `#${settings.teamChannel} doesn't exist yet`, detail: status.teamChannel?.id ? "The everyone channel for plain reminders" : "Create it in Slack as a public channel with everyone in it" },
      { ok: Boolean(status.hrChannel?.id), icon: Lock, title: status.hrChannel?.id ? "HR channel set" : "No HR channel yet", detail: status.hrChannel?.id ? "Private, HR only" : "Create a private channel, add HR and the app, paste its ID below" },
      { ok: Boolean(status.announcementChannel?.id), icon: Megaphone, title: status.announcementChannel?.id ? `#${settings.announcements.channel} is ready` : `#${settings.announcements.channel} doesn't exist yet`, detail: "Where announcements go" },
      { ok: !employees.missing?.length, icon: Users, title: employees.missing?.length ? `${employees.missing.length} people not in Slack` : "Everyone is in Slack", detail: employees.missing?.length ? `${noContact} of them have no email or phone on the dashboard` : "Every expected person can be reached" },
      { ok: Boolean(status.scheduleRunning), icon: AlarmClock, title: status.scheduleRunning ? "Schedule running" : "Schedule runs on the live server only", detail: status.scheduleRunning ? "Reminders go out on time, Monday to Saturday" : "This copy never sends the timed reminders" },
    ];
  })();
  const passed = checks.filter((check) => check.ok).length;
  const readiness = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  const failing = checks.filter((check) => !check.ok);

  const schedule = settings ? [
    { time: settings.cleanup?.time || "00:05", label: "Clear yesterday", detail: "Channel posts and private notes", icon: Trash2, on: settings.cleanup?.enabled !== false },
    { time: settings.clockInAt, label: "Clock-in", detail: "Look-back, then the reminder", icon: Sunrise, on: settings.enabled },
    { time: settings.reportAt, label: "Daily report", detail: "Reminder, then own copy and HR thread", icon: NotebookPen, on: settings.enabled },
    { time: settings.clockOutAt, label: "Clock-out", detail: `Again every ${settings.clockOutRepeatMinutes} min until ${clockLabel(settings.clockOutUntil)}`, icon: Repeat, on: settings.enabled },
  ] : [];
  const nextIndex = schedule.findIndex((item) => minutesOf(item.time) > now);

  const sent = overview?.sentToday || { team: 0, personal: 0, hr: 0 };
  const sentTotal = (sent.team || 0) + (sent.personal || 0) + (sent.hr || 0);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6 ${darkMode ? "text-white" : "text-[#171717]"}`}>
      <div className="mx-auto w-full max-w-[1500px]">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-sm ${muted}`}>UIPL Docs · Juniper workspace · {today}</p>
            <h1 className="mt-1 flex items-center gap-3 text-[26px] font-semibold leading-none tracking-tight">
              <span className={`grid h-10 w-10 place-items-center rounded-[11px] border ${darkMode ? "border-white/10 bg-white/[0.05]" : "border-[#e8e8e6] bg-white"}`}><SlackLogo className="h-5 w-5" /></span>
              Slack
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {settings && (settings.enabled ? <Pill tone="green"><span className="h-2 w-2 rounded-full bg-[#1fa463]" /> Reminders on</Pill> : <Pill tone="grey">Reminders off</Pill>)}
            <button type="button" onClick={load} disabled={refreshing} className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-medium transition active:scale-[0.98] ${darkMode ? "border-white/10 bg-white/[0.04] hover:bg-white/10" : "border-[#e4e4e1] bg-white hover:bg-[#f6f6f4]"}`}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </header>

        {error && <div className="mt-5 rounded-2xl bg-[#fde8e4] px-4 py-3 text-sm text-[#b4412b]">{error}</div>}

        {/* Row 1: reach + readiness */}
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card darkMode={darkMode}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[17px] font-medium">People on Slack</h2>
              <Pill tone={employees.missing?.length ? "amber" : "green"}>
                <Users className="h-3.5 w-3.5" /> {employees.total ? `${employees.total} expected each day` : "Loading"}
              </Pill>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <span className="text-[76px] font-light leading-[0.9] tracking-tight">{employees.inSlack}</span>
              <span className={`pb-2 text-[15px] ${muted}`}>of {employees.total} people reachable</span>
            </div>
            <div className="mt-6 grid grid-cols-[minmax(0,170px)_1fr] items-center gap-x-5 gap-y-3 text-sm">
              <span>Reachable on Slack</span><HatchBar value={employees.inSlack} total={employees.total} color="#3bbf7a" darkMode={darkMode} />
              <span>Not in Slack yet</span><HatchBar value={notJoined} total={employees.total} color="#e38fc4" darkMode={darkMode} />
              <span>No email or phone</span><HatchBar value={noContact} total={employees.total} color="#9aa39f" darkMode={darkMode} />
              <span>HR in Slack</span><HatchBar value={hrInSlack} total={Math.max(hrPeople.length, 1)} color="#3bbf7a" darkMode={darkMode} />
            </div>
            <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 text-xs ${muted}`}>
              <span className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3bbf7a]" /> Reachable</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#e38fc4]" /> Needs to join</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#9aa39f]" /> Add email or phone</span>
              </span>
              <span>Matched by email, else by phone</span>
            </div>
            {employees.missing?.length > 0 && (
              <div className={`mt-5 rounded-2xl p-4 ${soft}`}>
                <span className="text-sm font-medium">Not reachable yet</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {employees.missing.slice(0, 18).map((name) => {
                    const noInfo = employees.noContact?.includes(name);
                    return (
                      <span key={name} className={`rounded-full px-3 py-1.5 text-xs font-medium ${noInfo ? "bg-[#efeee9] text-[#5c625f]" : "bg-[#fbe3f1] text-[#8f2f68]"}`}>
                        {name}{noInfo ? " · add email or phone" : ""}
                      </span>
                    );
                  })}
                  {employees.missing.length > 18 && <span className={`px-2 py-1.5 text-xs ${muted}`}>+{employees.missing.length - 18} more</span>}
                </div>
              </div>
            )}
          </Card>

          <Card darkMode={darkMode}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-[17px] font-medium"><ShieldCheck className="h-5 w-5" /> Setup readiness</h2>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-4">
              <span className="text-[76px] font-light leading-[0.9] tracking-tight">{readiness}%</span>
              <span className={`pb-2 text-[15px] ${muted}`}>{passed} of {checks.length} checks pass</span>
            </div>
            <div className={`mt-5 h-3 overflow-hidden rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#efeee9]"}`}>
              <div className="h-full rounded-full bg-[#3bbf7a] transition-[width] duration-700" style={{ width: `${readiness}%` }} />
            </div>
            <p className="mt-4 text-sm font-medium">{failing.length ? `${failing.length} thing${failing.length === 1 ? "" : "s"} to fix` : "All set"}</p>
            <div className="mt-3 space-y-2.5">
              {(failing.length ? failing : checks).slice(0, 4).map((check) => {
                const Icon = check.icon;
                return (
                  <div key={check.title} className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 ${soft}`}>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${check.ok ? "bg-[#e3f6ea] text-[#147a45]" : "bg-[#fde8e4] text-[#b4412b]"}`}>
                      {check.ok ? <CheckCircle2 className="h-5 w-5" /> : Icon === SlackLogo ? <AlertTriangle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{check.title}</span>
                      <span className={`block truncate text-xs ${muted}`}>{check.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Row 2: today + schedule */}
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card darkMode={darkMode}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-medium">Today on Slack</h2>
              <span className={`text-sm ${muted}`}>{sentTotal} message{sentTotal === 1 ? "" : "s"} sent</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Everyone channel", value: sent.team || 0, icon: Users, note: "Plain reminders, no names", tone: "#8f7ad8" },
                { label: "Private messages", value: sent.personal || 0, icon: UserRound, note: "Each person's own status", tone: "#3bbf7a" },
                { label: "HR channel", value: sent.hr || 0, icon: ShieldCheck, note: "Live lists and reports", tone: "#1f4d3d" },
                { label: "Leave waiting for HR", value: overview?.pendingLeave || 0, icon: Palmtree, note: "Approve or decline on Slack", tone: "#d98a4e" },
              ].map((tile) => (
                <div key={tile.label} className={`rounded-[22px] p-5 ${soft}`}>
                  <span className={`flex items-center gap-2 text-sm ${muted}`}><tile.icon className="h-4 w-4" /> {tile.label}</span>
                  <span className="mt-3 block text-[44px] font-light leading-none tracking-tight">{tile.value}</span>
                  <span className={`mt-4 block h-1.5 w-full rounded-full ${darkMode ? "bg-white/10" : "bg-[#e4e3dd]"}`}>
                    <span className="block h-full rounded-full" style={{ width: `${sentTotal || tile.label.startsWith("Leave") ? Math.min(100, tile.label.startsWith("Leave") ? tile.value * 20 : (tile.value / Math.max(sentTotal, 1)) * 100) : 0}%`, background: tile.tone }} />
                  </span>
                  <span className={`mt-3 block text-xs ${muted}`}>{tile.note}</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 flex flex-wrap items-center gap-2 text-xs ${muted}`}>
              <Moon className="h-3.5 w-3.5" />
              {overview?.cleanedAt
                ? `Yesterday cleared at ${new Date(overview.cleanedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`
                : "Yesterday's messages are cleared after midnight"}
              <span className="mx-1">·</span>
              <Megaphone className="h-3.5 w-3.5" /> {overview?.announcementsThisMonth || 0} announcement{overview?.announcementsThisMonth === 1 ? "" : "s"} this month
            </div>
          </Card>

          <Card darkMode={darkMode}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-[17px] font-medium"><CalendarDays className="h-5 w-5" /> Today&apos;s schedule</h2>
              <span className={`text-sm ${muted}`}>Mon–Sat, IST</span>
            </div>
            <div className="mt-5 space-y-2.5">
              {schedule.map((item, index) => {
                const done = minutesOf(item.time) <= now;
                const next = index === nextIndex;
                return (
                  <div key={item.label} className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${next ? (darkMode ? "bg-[#3bbf7a]/15" : "bg-[#e3f6ea]") : soft}`}>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${next ? "bg-[#10231c] text-white" : darkMode ? "bg-white/10" : "bg-white"}`}><item.icon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className={`block truncate text-xs ${muted}`}>{item.detail}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-medium tabular-nums">{clockLabel(item.time)}</span>
                      <span className={`block text-[11px] ${!item.on ? "text-[#b4412b]" : next ? "text-[#147a45]" : muted}`}>{!item.on ? "Off" : next ? "Next" : done ? "Done" : "Later"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <a href="#slack-settings" className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${darkMode ? "text-[#86e0b0]" : "text-[#147a45]"}`}>
              Change times <ArrowUpRight className="h-4 w-4" />
            </a>
          </Card>
        </div>

        {/* Settings */}
        <div id="slack-settings" className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-medium tracking-tight">Settings</h2>
          <Tabs darkMode={darkMode} items={TABS} value={tab} onChange={setTab} />
        </div>
        <div className="mt-4">
          {tab === "reminders" ? <SlackAttendanceSettings darkMode={darkMode} /> : <CeoBriefSettings darkMode={darkMode} />}
        </div>
      </div>
    </main>
  );
}
