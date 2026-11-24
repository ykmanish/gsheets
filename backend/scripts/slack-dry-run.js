// Dry run of every Slack attendance/report/leave/announcement feature: real data and real Slack
// lookups, but nothing is sent and the bookkeeping goes to throwaway dryrun_ collections
// (dropped at the end). Usage, from backend/:  node scripts/slack-dry-run.js [YYYY-MM-DD]
// People not in Slack yet are shown as if they were (marked *), to show the full reach.
process.env.NODE_ENV = "test";
process.env.SLACK_DRY_RUN = "everyone";
process.env.SLACK_ATTENDANCE_ASSIST = "true";
process.env.APP_PUBLIC_URL = "https://dashboard.nexarrow.eu";
const serverPath = require("path").join(__dirname, "..", "server.js");
const s = require(serverPath);
const { MongoClient, ObjectId } = require(require.resolve("mongodb", { paths: [require("path").dirname(serverPath)] }));

const DATE = /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2] || "") ? process.argv[2] : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const log = s.slackService.dryRunLog;
let names = new Map();

function who(channel, user) {
  const id = user || channel;
  const email = String(id).replace(/^DM:/, "").replace(/^PRETEND:/, "");
  if (String(channel).startsWith("MISSING#")) return `#${channel.slice(8)} (channel missing)`;
  if (String(id).startsWith("DM:") || String(id).startsWith("PRETEND:")) return `DM → ${names.get(email) || email}${String(id).includes("PRETEND:") ? " *" : ""}`;
  if (/^D/.test(channel)) return `DM ${channel}`;
  if (/^U/.test(id)) return `DM → ${names.get(id) || id}`;
  return `#${channel}`;
}

function firstLine(entry) {
  const block = (entry.blocks || []).find((b) => b.text?.text || b.fields);
  const text = block?.text?.text || entry.text || "";
  return text.replace(/\n/g, " | ").replace(/\s+/g, " ").slice(0, 150);
}

function buttons(entry) {
  return (entry.blocks || []).filter((b) => b.type === "actions").flatMap((b) => b.elements.map((e) => e.text?.text)).filter(Boolean);
}

// Prints what the log gained since `from`: one line per message, grouped by audience.
function report(title, from, extra = "") {
  const entries = log.slice(from).filter((e) => e.method !== "conversations.open");
  console.log(`\n━━━ ${title} ${extra}`);
  if (!entries.length) { console.log("   (nothing would be sent)"); return; }
  const groups = new Map();
  for (const e of entries) {
    const audience = String(e.channel).startsWith("MISSING#hr") || e.channel === "MISSING#hr-channel-not-set" ? "HR channel" : String(e.channel).startsWith("MISSING#") || /^C/.test(e.channel) ? "Channel" : "Private DM";
    const key = `${audience}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const [audience, items] of groups) {
    const verbs = items.reduce((acc, e) => { const v = { "chat.postMessage": e.threadTs ? "thread reply" : "post", "chat.update": "edit", "chat.delete": "delete", "chat.postEphemeral": "ephemeral" }[e.method] || e.method; acc[v] = (acc[v] || 0) + 1; return acc; }, {});
    console.log(`   ${audience}: ${Object.entries(verbs).map(([v, n]) => `${n} ${v}${n === 1 ? "" : "s"}`).join(", ")}`);
    const shown = audience === "Private DM" ? items.slice(0, 3) : items.slice(0, 4);
    for (const e of shown) {
      const b = buttons(e);
      console.log(`     • ${who(e.channel, e.user)}${e.method === "chat.update" ? " [edit]" : e.method === "chat.delete" ? " [delete]" : e.threadTs ? " [in thread]" : ""}: ${firstLine(e)}${b.length ? `  [buttons: ${b.join(" / ")}]` : ""}`);
    }
    if (items.length > shown.length) {
      const rest = items.slice(shown.length).map((e) => who(e.channel, e.user).replace(/^DM → /, "")).join(", ");
      console.log(`     • …and ${items.length - shown.length} more: ${rest.slice(0, 400)}`);
    }
  }
}

(async () => {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db("sheets");
  const users = await db.collection("users").find({}).toArray();
  for (const u of users) {
    const email = String(u.slackEmail || u.email || "").toLowerCase();
    if (email) names.set(email, u.displayName || u.username);
    const phone = String(u.whatsappPhone || u.whatsappNumber || u.mobileNumber || u.mobile || u.phoneNumber || u.phone || u.contactNumber || "").replace(/\D/g, "").slice(-10);
    if (phone.length === 10) names.set(`phone:${phone}`, u.displayName || u.username);
  }
  const realSlack = await s.slackService.listMembers();
  for (const m of realSlack) names.set(m.id, m.real_name || m.name);
  const drop = async () => { for (const c of ["dryrun_slackAttendanceAssist", "dryrun_slackAssistPosts", "dryrun_slackLeaveCards"]) await db.collection(c).drop().catch(() => {}); };
  await drop();

  const settings = await s.getSlackAttendanceSettings({ fresh: true });
  console.log("SETTINGS", JSON.stringify({ teamChannel: settings.teamChannel, hrChannel: settings.hrChannel, delivery: settings.personalDelivery, times: [settings.clockInAt, settings.reportAt, settings.clockOutAt, `every ${settings.clockOutRepeatMinutes}m until ${settings.clockOutUntil}`], cleanup: settings.cleanup.time, announcements: settings.announcements }));
  console.log("Names marked * are not in Slack yet: they are shown as if they were (dry-run 'everyone' mode).");

  /* Part 1: the day's schedule, minute by minute (the real scheduler function) */
  console.log("\n═════════ PART 1 — THE SCHEDULE (" + DATE + ", simulated clock) ═════════");
  const at = (hhmm) => new Date(`${DATE}T${hhmm}:00+05:30`);
  const times = ["00:05", "09:59", "10:00", "10:01", "18:49", "18:50", "18:51", "19:00", "19:05", "19:10", "20:50", "21:00"];
  for (const t of times) {
    if (t === "19:10" || t === "20:50") {
      // The repeat is "10 minutes since the last one"; move the last-sent time back to simulate the wait.
      await db.collection("dryrun_slackAttendanceAssist").updateMany({ _id: { $regex: "^personal:clockOut:" } }, { $set: { lastSentAt: new Date(Date.now() - 11 * 60000) } });
    }
    const from = log.length;
    await s.slackAssistTick(at(t));
    const added = log.slice(from).filter((e) => e.method !== "conversations.open");
    const channel = added.filter((e) => /^MISSING#uipl|^C/.test(e.channel) && !String(e.channel).includes("hr-channel")).length;
    const hr = added.filter((e) => String(e.channel).includes("hr-channel")).length;
    const dms = added.filter((e) => !/^MISSING#|^C/.test(e.channel)).length;
    console.log(`   ${t}  →  ${added.length ? `${channel} channel post(s), ${hr} HR post(s), ${dms} private DM(s)` : "nothing"}`);
  }
  await drop();
  log.length = 0;

  /* Part 2: each feature on its own, with what each audience gets */
  console.log("\n═════════ PART 2 — EACH FEATURE ═════════");
  let from = log.length;
  console.log("\n[1] 10:00 — Yesterday's misses, then the clock-in reminder");
  const recap = await s.sendSlackMorningRecaps({ date: DATE, force: true });
  report("1a  Yesterday's misses (look-back at the last working day)", from, `— last working day ${recap.previous}`);
  from = log.length;
  await s.sendSlackClockInReminders({ date: DATE, force: true });
  report("1b  Clock-in reminder", from);

  const manish = users.find((u) => /manish/i.test(u.displayName || ""));
  const todayRecord = await db.collection("hrAttendanceRecords").findOne({ date: DATE, userId: manish?._id });
  from = log.length;
  await s.syncSlackAttendanceMessages({ date: DATE, userId: String(manish._id), event: "clock-in" });
  report("1c  Someone clocks in (Manish Yadav, dashboard)", from, todayRecord ? "" : "(no record today)");

  from = log.length;
  await s.sendSlackReportReminderPost({ date: DATE, force: true });
  report("2a  18:50 — Daily report reminder", from);

  const filedToday = await db.collection("employeeDailyReports").findOne({ reportDate: DATE });
  if (filedToday) {
    from = log.length;
    await s.postSlackReportResponses({ report: filedToday });
    report(`2b  A report is filed (${filedToday.employeeName})`, from);
    from = log.length;
    await s.postSlackReportResponses({ report: { ...filedToday, updatedAt: new Date() }, edited: true });
    report(`2c  The same report is edited`, from);
  }

  from = log.length;
  await s.sendSlackClockOutReminders({ date: DATE, force: true });
  report("3a  19:00 — Clock-out reminder (1st)", from);
  await db.collection("dryrun_slackAttendanceAssist").updateMany({ _id: { $regex: "^personal:clockOut:" } }, { $set: { lastSentAt: new Date(Date.now() - 11 * 60000) } });
  from = log.length;
  await s.sendSlackClockOutReminders({ date: DATE });
  report("3b  19:10 — Clock-out repeat (only people still clocked in)", from);

  const closed = await db.collection("hrAttendanceRecords").findOne({ date: recap.previous, clockOutAt: { $ne: null } });
  if (closed) {
    from = log.length;
    await s.syncSlackAttendanceMessages({ date: recap.previous, userId: String(closed.userId), event: "clock-out" });
    report(`3c  Someone clocks out (${closed.employeeName}, from ${recap.previous}'s record)`, from);
  }

  const dmrRun = await db.collection("dmrWhatsAppReminderRuns").find({ "results.0": { $exists: true } }).sort({ finishedAt: -1 }).limit(1).next();
  if (dmrRun) {
    from = log.length;
    const dmr = await s.sendSlackDmrReminder({ type: dmrRun.type, date: dmrRun.date, results: dmrRun.results });
    report(`4   DMR reminder (WhatsApp run "${dmrRun.type}" of ${dmrRun.date}: ${dmrRun.results.length} contacts)`, from, `— matched in Slack by phone: ${dmr.personal}`);
  }

  const leave = await db.collection("hrLeaveRequests").find({}).sort({ createdAt: -1 }).limit(1).next();
  if (leave) {
    from = log.length;
    await s.notifySlackLeaveRequest(leave);
    report(`5a  Leave applied (${leave.employeeName}, ${leave.startDate}${leave.endDate !== leave.startDate ? ` → ${leave.endDate}` : ""})`, from);
    from = log.length;
    await s.notifySlackLeaveDecision({ ...leave, status: "approved" }, { status: "approved", by: "Neelam Verma", comment: "Approved, enjoy the function." });
    report("5b  HR approves it with a comment", from);
  }

  from = log.length;
  await s.postSlackAnnouncement({ settings, title: "Office closed on Friday", message: "The office is closed this Friday for maintenance.", notifyAll: true, author: "Super Admin", department: "Super Admin" });
  report("6   Announcement (posted by Super Admin, @channel on)", from);

  const postsLogged = await db.collection("dryrun_slackAssistPosts").countDocuments();
  from = log.length;
  const nextDay = new Date(new Date(`${DATE}T12:00:00+05:30`).getTime() + 86400000).toISOString().slice(0, 10);
  const cleanup = await s.cleanUpSlackDailyPosts({ today: nextDay });
  report(`7   00:05 next day — Midnight clean-up (${postsLogged} daily messages logged today)`, from, `— ${cleanup.deleted} deleted`);

  await drop();
  await client.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED", e.stack); process.exit(1); });
