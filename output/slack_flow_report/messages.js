// Builds every Slack message shown in the report from the backend's own message builders and
// today's real data, and saves them as data/messages.json. Sends nothing.
process.env.NODE_ENV = "test";
process.env.APP_PUBLIC_URL = "https://dashboard.nexarrow.eu";
const fs = require("fs");
const path = require("path");
const serverPath = path.join(__dirname, "..", "..", "backend", "server.js");
const s = require(serverPath);
const { MongoClient, ObjectId } = require(require.resolve("mongodb", { paths: [path.dirname(serverPath)] }));

const DATE = "2026-11-24";
const PREV = "2026-11-23";

(async () => {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db("sheets");
  const m = s.slackAssistMessages;
  const me = await db.collection("users").findOne({ _id: new ObjectId("6a466516a96004fda93e80b3") });
  const meRecord = await db.collection("hrAttendanceRecords").findOne({ userId: me._id, date: DATE });
  const outRecord = await db.collection("hrAttendanceRecords").findOne({ date: PREV, clockOutAt: { $ne: null } });
  const report = await db.collection("employeeDailyReports").findOne({ reportDate: DATE });
  const leave = {
    _id: new ObjectId(), userId: me._id, employeeName: "Sanjay Sharma", department: "Design",
    leaveType: "Casual Leave", startDate: "2026-11-30", endDate: "2026-11-30", days: 1, paidLeaveDays: 1, unpaidLeaveDays: 0,
    reason: "Family function in the village.", status: "pending", createdAt: new Date("2026-11-23T04:47:00Z"),
  };
  const out = {
    team: { clockIn: m.slackTeamMessage("clockIn", DATE), report: m.slackTeamMessage("report", DATE), clockOut: m.slackTeamMessage("clockOut", DATE) },
    personal: {
      recap: m.slackRecapMessage(me, PREV, [
        { short: "no clock-out", text: "You didn't clock out (you clocked in at 10:38 AM).", adjust: true },
        { short: "no daily report", text: "Your daily report wasn't filed. Speak to HR if it needs adding." },
      ], DATE),
      clockInDue: m.slackPersonal.clockInDue(me, DATE),
      clockedIn: m.slackPersonal.clockedIn(meRecord),
      reportDue: m.slackPersonal.reportDue(me, DATE),
      ownReport: m.slackReportResponsesMessage({ report: { ...report, employeeName: "Devang Shah" }, own: true }),
      clockOutDue1: m.slackPersonal.clockOutDue(me, meRecord, { count: 1, reportDue: true }),
      clockOutDue3: m.slackPersonal.clockOutDue(me, meRecord, { count: 3, reportDue: false }),
      clockedOut: m.slackPersonal.clockedOut(outRecord),
    },
    hr: {
      clockIn: await m.slackHrClockInMessage(db, DATE),
      report: await m.slackHrReportMessage(db, DATE),
      reportReply: m.slackReportResponsesMessage({ report }),
      clockOut: await m.slackHrClockOutMessage(db, DATE),
    },
    leave: {
      card: m.slackLeaveCardMessage(leave),
      decided: m.slackLeaveCardMessage(leave, { status: "approved", by: "Neelam Verma", comment: "Approved. Enjoy the function!" }),
    },
  };
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "data", "messages.json"), JSON.stringify(out, null, 2));
  console.log("messages:", Object.entries(out).map(([k, v]) => `${k}=${Object.keys(v).length}`).join(" "));
  await client.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED", e.stack); process.exit(1); });
