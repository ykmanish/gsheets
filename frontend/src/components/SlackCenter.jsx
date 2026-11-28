"use client";

import { useEffect, useState } from "react";
import { AlarmClock, AlertTriangle, ArrowUpRight, BellRing, CalendarDays, CheckCircle2, Hash, Lock, Megaphone, MessageSquareText, Moon, NotebookPen, Palmtree, RefreshCw, Repeat, Settings2, ShieldCheck, Sunrise, Trash2, UserRound, Users } from "lucide-react";
import { API_URL } from "./AuthProvider";
import SlackLogo from "./SlackLogo";
import { Badge, Button, Chip, IconTile, Notice, SectionTitle, Tabs, cx, toneOf } from "./ui";
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

// A soft bar in a pastel tone, with its count in a small pill at the end of the fill.
function HatchBar({ value, total, tone = "mint", darkMode }) {
  const pct = total ? Math.max(value ? 9 : 0, Math.min(100, (value / total) * 100)) : 0;
  const t = toneOf(tone);
  return (
    <div className={`relative h-7 w-full overflow-hidden rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full pr-1 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${pct}%`, backgroundColor: darkMode ? t[2] : t[0] }}
      >
        {value > 0 && <span className={cx("grid h-5 min-w-7 place-items-center rounded-full px-2 text-[11px] tabular-nums", darkMode ? "bg-white text-[#141414]" : "bg-[#141414] text-white")}>{value}</span>}
      </div>
      {value === 0 && <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] ${darkMode ? "text-white/40" : "text-[#a3a3a0]"}`}>0</span>}
    </div>
  );
}

function Card({ darkMode, className = "", children }) {
  return <section className={cx("rounded-[20px] border p-5 sm:p-6", darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]", className)}>{children}</section>;
}

// Card heading: a pastel icon tile, a title and a grey line, with something on the right.
function CardHead({ darkMode, icon, tone, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
        <div className="min-w-0">
          <h2 className="truncate text-[15px]">{title}</h2>
          {subtitle && <p className={cx("truncate text-[12.5px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
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

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const soft = darkMode ? "bg-white/[0.035]" : "bg-[#f7f7f5]";
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
    <main className={`min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "text-white" : "text-[#141414]"}`}>
      <div className="mx-auto w-full max-w-[1400px]">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Badge icon={<SlackLogo className="h-3.5 w-3.5" />} tone="lavender" darkMode={darkMode} className="mb-3">Juniper workspace · {today}</Badge>
            <SectionTitle darkMode={darkMode} title="Slack" subtitle="who it reaches and what went out today" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {settings && (settings.enabled
              ? <Chip darkMode={darkMode} tone="mint"><span className="h-2 w-2 rounded-full bg-current" /> Reminders on</Chip>
              : <Chip darkMode={darkMode} tone="neutral">Reminders off</Chip>)}
            <Button darkMode={darkMode} variant="secondary" onClick={load} disabled={refreshing} icon={RefreshCw} className={refreshing ? "[&>svg]:animate-spin" : ""}>
              Refresh
            </Button>
          </div>
        </header>

        {error && <Notice darkMode={darkMode} tone="red" icon={AlertTriangle} className="mt-5">{error}</Notice>}

        {/* Row 1: reach + readiness */}
        <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card darkMode={darkMode}>
            <CardHead
              darkMode={darkMode}
              icon={Users}
              tone="mint"
              title="People on Slack"
              subtitle="Matched by email, else by phone"
              right={<Chip darkMode={darkMode} tone={employees.missing?.length ? "amber" : "mint"} icon={Users}>{employees.total ? `${employees.total} expected each day` : "Loading"}</Chip>}
            />
            <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-[64px] leading-[0.9] tracking-[-0.04em] tabular-nums">{employees.inSlack}</span>
              <span className={`pb-1.5 text-[15px] ${muted}`}>of {employees.total} people reachable</span>
            </div>
            <div className="mt-6 grid grid-cols-[minmax(0,160px)_1fr] items-center gap-x-5 gap-y-2.5 text-[13px]">
              <span>Reachable on Slack</span><HatchBar value={employees.inSlack} total={employees.total} tone="mint" darkMode={darkMode} />
              <span>Not in Slack yet</span><HatchBar value={notJoined} total={employees.total} tone="rose" darkMode={darkMode} />
              <span>No email or phone</span><HatchBar value={noContact} total={employees.total} tone="neutral" darkMode={darkMode} />
              <span>HR in Slack</span><HatchBar value={hrInSlack} total={Math.max(hrPeople.length, 1)} tone="lavender" darkMode={darkMode} />
            </div>
            {employees.missing?.length > 0 && (
              <div className={`mt-5 rounded-[16px] p-4 ${soft}`}>
                <span className="text-[13px]">Not reachable yet</span>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {employees.missing.slice(0, 18).map((name) => {
                    const noInfo = employees.noContact?.includes(name);
                    return (
                      <Chip key={name} darkMode={darkMode} tone={noInfo ? "outline" : "rose"}>
                        {name}{noInfo ? " · add email or phone" : ""}
                      </Chip>
                    );
                  })}
                  {employees.missing.length > 18 && <span className={`px-2 py-1.5 text-[12px] ${muted}`}>+{employees.missing.length - 18} more</span>}
                </div>
              </div>
            )}
          </Card>

          <Card darkMode={darkMode}>
            <CardHead darkMode={darkMode} icon={ShieldCheck} tone="sky" title="Setup readiness" subtitle={failing.length ? `${failing.length} thing${failing.length === 1 ? "" : "s"} to fix` : "All set"} />
            <div className="mt-5 flex flex-wrap items-end gap-x-3">
              <span className="text-[64px] leading-[0.9] tracking-[-0.04em] tabular-nums">{readiness}%</span>
              <span className={`pb-1.5 text-[15px] ${muted}`}>{passed} of {checks.length} checks pass</span>
            </div>
            <div className={`mt-5 h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
              <div className={cx("h-full rounded-full transition-[width] duration-700", darkMode ? "bg-[#cff07a]" : "bg-[#141414]")} style={{ width: `${readiness}%` }} />
            </div>
            <div className="mt-5 space-y-2">
              {(failing.length ? failing : checks).slice(0, 4).map((check) => {
                const Icon = check.icon;
                return (
                  <div key={check.title} className={`flex items-center gap-3 rounded-[14px] px-3.5 py-3 ${soft}`}>
                    <IconTile
                      icon={check.ok ? CheckCircle2 : Icon === SlackLogo ? AlertTriangle : Icon}
                      tone={check.ok ? "mint" : "rose"}
                      darkMode={darkMode}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px]">{check.title}</span>
                      <span className={`block truncate text-[12px] ${muted}`}>{check.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Row 2: today + schedule */}
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card darkMode={darkMode}>
            <CardHead
              darkMode={darkMode}
              icon={MessageSquareText}
              tone="lavender"
              title="Today on Slack"
              subtitle={`${sentTotal} message${sentTotal === 1 ? "" : "s"} sent`}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Everyone channel", value: sent.team || 0, icon: Users, note: "Plain reminders, no names", tone: "lavender" },
                { label: "Private messages", value: sent.personal || 0, icon: UserRound, note: "Each person's own status", tone: "mint" },
                { label: "HR channel", value: sent.hr || 0, icon: ShieldCheck, note: "Live lists and reports", tone: "sky" },
                { label: "Leave waiting for HR", value: overview?.pendingLeave || 0, icon: Palmtree, note: "Approve or decline on Slack", tone: "peach" },
              ].map((tile) => {
                const t = toneOf(tile.tone);
                return (
                  <div key={tile.label} style={{ backgroundColor: darkMode ? t[2] : t[0] }} className="rounded-[20px] p-4">
                    <span style={{ color: darkMode ? t[3] : t[1] }} className="flex items-center gap-2 text-[12.5px]"><tile.icon className="h-4 w-4" strokeWidth={1.8} /> {tile.label}</span>
                    <span className="mt-4 block text-[34px] leading-none tracking-[-0.03em] tabular-nums">{tile.value}</span>
                    <span className={`mt-4 block h-1 w-full rounded-full ${darkMode ? "bg-white/10" : "bg-white/70"}`}>
                      <span className="block h-full rounded-full" style={{ width: `${sentTotal || tile.label.startsWith("Leave") ? Math.min(100, tile.label.startsWith("Leave") ? tile.value * 20 : (tile.value / Math.max(sentTotal, 1)) * 100) : 0}%`, background: darkMode ? t[3] : t[1] }} />
                    </span>
                    <span className={`mt-2.5 block text-[12px] ${darkMode ? "text-white/55" : "text-[#6b6b6b]"}`}>{tile.note}</span>
                  </div>
                );
              })}
            </div>
            <div className={`mt-4 flex flex-wrap items-center gap-2 text-[12px] ${muted}`}>
              <Moon className="h-3.5 w-3.5" />
              {overview?.cleanedAt
                ? `Yesterday cleared at ${new Date(overview.cleanedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`
                : "Yesterday's messages are cleared after midnight"}
              <span className="mx-1">·</span>
              <Megaphone className="h-3.5 w-3.5" /> {overview?.announcementsThisMonth || 0} announcement{overview?.announcementsThisMonth === 1 ? "" : "s"} this month
            </div>
          </Card>

          <Card darkMode={darkMode}>
            <CardHead darkMode={darkMode} icon={CalendarDays} tone="amber" title="Today's schedule" subtitle="Monday to Saturday, IST" />
            <div className="mt-5 space-y-2">
              {schedule.map((item, index) => {
                const done = minutesOf(item.time) <= now;
                const next = index === nextIndex;
                return (
                  <div key={item.label} className={cx("flex items-center gap-3.5 rounded-[14px] px-3.5 py-3", next ? (darkMode ? "bg-[#cff07a]/15" : "bg-[#eef8cc]") : soft)}>
                    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-[11px]", next ? (darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white") : darkMode ? "bg-white/10" : "bg-white")}><item.icon className="h-4 w-4" strokeWidth={1.8} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px]">{item.label}</span>
                      <span className={`block truncate text-[12px] ${muted}`}>{item.detail}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[13.5px] tabular-nums">{clockLabel(item.time)}</span>
                      <span className={cx("block text-[11.5px]", !item.on ? (darkMode ? "text-[#f7aab5]" : "text-[#c0394b]") : next ? (darkMode ? "text-[#d8f39a]" : "text-[#4d6b12]") : muted)}>{!item.on ? "Off" : next ? "Next" : done ? "Done" : "Later"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <a href="#slack-settings" className={cx("mt-4 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors", darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]")}>
              Change times <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Card>
        </div>

        {/* Settings */}
        <div id="slack-settings" className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconTile icon={Settings2} tone="neutral" darkMode={darkMode} size="md" />
            <SectionTitle darkMode={darkMode} title="Settings" subtitle="reminders and the CEO report" className="[&_h2]:text-[20px] [&_p]:text-[20px]" />
          </div>
          <Tabs darkMode={darkMode} items={TABS} value={tab} onChange={setTab} />
        </div>
        <div className="mt-4">
          {tab === "reminders" ? <SlackAttendanceSettings darkMode={darkMode} /> : <CeoBriefSettings darkMode={darkMode} />}
        </div>
      </div>
    </main>
  );
}
