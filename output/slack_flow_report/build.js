// Builds report.html (Slack daily-flow report) from data/messages.json, the screenshots in
// shots/ and Lucide icons, then prints it to PDF with headless Chrome and renders page previews.
// Usage: node build.js   (needs frontend/node_modules for react, react-dom and lucide-react)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = __dirname;
const FRONT = path.join(HERE, "..", "..", "frontend", "node_modules");
const React = require(path.join(FRONT, "react"));
const { renderToStaticMarkup } = require(path.join(FRONT, "react-dom", "server"));
const lucide = require(path.join(FRONT, "lucide-react"));
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_PDF = path.join(HERE, "..", "pdf", "UIPL_Slack_Daily_Flow.pdf");
const msgs = JSON.parse(fs.readFileSync(path.join(HERE, "data", "messages.json"), "utf8"));

/* ── helpers ── */
const icon = (name, size = 18, stroke = 1.9, extra = {}) => renderToStaticMarkup(React.createElement(lucide[name], { size, strokeWidth: stroke, ...extra }));
const img = (file) => `shots/${file}`;
const SLACK = '<svg viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg"><path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/><path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/><path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/><path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336-.001v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/></svg>';
const WA = fs.readFileSync(path.join(HERE, "assets", "whatsapp.svg"), "utf8").replace("<svg", '<svg fill="#25D366"');
const UIPL = "assets/uipl-logo.png";

const EMOJI = {
  white_check_mark: "✅", sunrise: "🌅", memo: "📝", alarm_clock: "⏰", wave: "👋", clipboard: "📋",
  busts_in_silhouette: "👥", hourglass_flowing_sand: "⏳", tada: "🎉", palm_tree: "🌴", construction: "🚧", x: "❌",
};
function mrkdwn(text = "") {
  return String(text)
    .replace(/:([a-z_]+):/g, (all, name) => EMOJI[name] || all)
    .replace(/<!channel>/g, '<span class="mention">@channel</span>')
    .replace(/<@([A-Z0-9]+)>/g, '<span class="mention">@$1</span>')
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}
// Long lists are cut so a preview fits its page; the full list is in the real message.
function trimLines(html, max) {
  const parts = html.split("<br>");
  return parts.length > max ? `${parts.slice(0, max).join("<br>")}<br><span class="more">…and ${parts.length - max} more</span>` : html;
}
function blocksHtml(blocks = [], { maxLines = 9 } = {}) {
  return blocks.map((b) => {
    if (b.type === "header") return `<div class="s-header">${mrkdwn(b.text.text)}</div>`;
    if (b.type === "divider") return '<div class="s-divider"></div>';
    if (b.type === "context") return `<div class="s-context">${b.elements.map((e) => mrkdwn(e.text)).join(" ")}</div>`;
    if (b.type === "actions") {
      return `<div class="s-actions">${b.elements.map((e) => `<span class="s-btn ${e.style || ""}">${e.text.text}</span>`).join("")}</div>`;
    }
    if (b.type === "section" && b.fields) return `<div class="s-fields">${b.fields.map((f) => `<div>${mrkdwn(f.text)}</div>`).join("")}</div>`;
    if (b.type === "section") return `<div class="s-section">${trimLines(mrkdwn(b.text.text), maxLines)}</div>`;
    return "";
  }).join("");
}
function slackMsg(message, { time = "10:00 AM", maxLines, note = "", thread = "" } = {}) {
  return `<div class="s-msg">
    <div class="s-ava"><img src="${UIPL}"></div>
    <div class="s-body">
      <div class="s-meta"><b>UIPL Docs</b><span class="s-app">APP</span><span class="s-time">${time}</span>${note ? `<span class="s-note">${note}</span>` : ""}</div>
      ${blocksHtml(message.blocks, { maxLines })}
      ${thread ? `<div class="s-thread">${icon("MessagesSquare", 13)} ${thread}</div>` : ""}
    </div>
  </div>`;
}
function slackWindow(title, inner, { kind = "channel", sub = "" } = {}) {
  const lead = kind === "dm" ? `<span class="w-dm"><img src="${UIPL}"></span>` : kind === "hr" ? `<span class="w-hash">${icon("Lock", 13)}</span>` : '<span class="w-hash">#</span>';
  return `<div class="s-window">
    <div class="s-bar">${lead}<b>${title}</b>${sub ? `<span class="w-sub">${sub}</span>` : ""}<span class="w-slack">${SLACK}</span></div>
    <div class="s-feed">${inner}</div>
  </div>`;
}
const segs = (n, on) => `<div class="segs">${Array.from({ length: 14 }, (_, i) => `<i class="${i < on ? "on" : ""}${i === on - 1 ? " cur" : ""}"></i>`).join("")}</div>`;
const story = (n) => `<div class="story">${segs(14, n)}<div class="who"><span class="ava"><img src="${UIPL}"></span><span class="nm">uipl docs</span><span class="w-slack small">${SLACK}</span></div></div>`;
const pill = (text, cls = "") => `<span class="pill ${cls}">${text}</span>`;
const chip = (iconName, text, cls = "") => `<span class="chip ${cls}">${icon(iconName, 14)}${text}</span>`;
const plusGrid = (rows, cols, extra = "") => `<div class="plusgrid ${extra}" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: rows * cols }, () => "<i>+</i>").join("")}</div>`;
const deco = (label = "uipl docs") => `<div class="deco"><div class="deco-row"><b>${label}</b>${"<i>+</i>".repeat(9)}</div><div class="deco-row">${"<i>+</i>".repeat(10)}<b class="r">slack</b></div></div>`;
const coverCells = () => {
  const out = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      if (r === 2 && c < 2) out.push('<i class="minus">−</i>');
      else if (r === 2 && c === 2) out.push('<i class="pac-cell"><span class="pac"></span></i>');
      else if ((r === 4 || r === 5) && c < 4) { if (c === 0) out.push(`<span class="q q${r}">${r === 4 ? "Are reminders getting" : "lost in WhatsApp?"}</span>`); }
      else out.push("<i>+</i>");
    }
  }
  return out.join("");
};
const page = (cls, n, inner) => `<section class="page ${cls}">${story(n)}${inner}<div class="foot"><span>UIPL Docs × Slack</span><span>${String(n).padStart(2, "0")} / 14</span></div></section>`;

/* ── pages ── */
const P = [];

// 1. Cover
P.push(page("forest", 1, `
  <div class="cover-grid">${coverCells()}</div>
  <div class="cover-title">
    <div class="logos"><span class="logo-tile"><img src="${UIPL}"></span><span class="x">×</span><span class="logo-tile slack">${SLACK}</span></div>
    <h1>Slack,<br><span class="hl-mint">sorted.</span></h1>
    <p>How UIPL Docs runs attendance, daily reports, leave, DMR and announcements on Slack. Who gets what, when, and where.</p>
    <div class="meta-row">${chip("CalendarDays", "Flow report · 24 Nov 2026", "dark")}${chip("FlaskConical", "Built from real data", "dark")}</div>
  </div>`));

// 2. Who sees what
P.push(page("lavender", 2, `
  <div class="hero">
    <h1 class="mega">WHO SEES<br>WH<span class="ast">${icon("Asterisk", 70, 3)}</span>T?</h1>
    <div class="dark-pill">No more <b>missed</b> reminders.</div>
    <p class="lead">One simple rule: common reminders go to everyone. Anything about one person goes to that person only.</p>
  </div>
  <div class="rooms">
    <div class="room cream">
      <div class="room-ic">${icon("Users", 26)}</div>
      <h3>Everyone channel</h3><div class="room-ch">#uipl-daily</div>
      <p>The plain reminder and its button. No names, counts or times.</p>
      <div class="ex">“Good morning team! Please mark your attendance.”</div>
    </div>
    <div class="room mint">
      <div class="room-ic">${icon("UserRound", 26)}</div>
      <h3>Your private chat</h3><div class="room-ch">UIPL Docs · direct message</div>
      <p>Only you see it: whether you’re due, your times, your report, your leave result.</p>
      <div class="ex">“✅ You clocked in at 10:38 AM”</div>
    </div>
    <div class="room forest">
      <div class="room-ic">${icon("ShieldCheck", 26)}</div>
      <h3>HR channel</h3><div class="room-ch">private · HR only</div>
      <p>Everyone’s status, updated live: who has and hasn’t, with times, every report, every leave request.</p>
      <div class="ex">“Clocked in (16) · Not clocked in yet (10)”</div>
    </div>
  </div>
  ${deco()}`));

// 3. The day
const steps = [
  ["12:05 AM", "Trash2", "Fresh start", "Yesterday’s channel posts and private notes are deleted. The HR channel keeps its record.", ["Everyone", "Private"]],
  ["10:00 AM", "Sunrise", "Clock-in", "A look-back at what you missed on the last working day, then the clock-in reminder.", ["Everyone", "Private", "HR"]],
  ["6:50 PM", "NotebookPen", "Daily report", "Reminder to fill today’s report. Once filed, you get your own copy; HR gets it in a thread.", ["Everyone", "Private", "HR"]],
  ["7:00 PM", "AlarmClock", "Clock-out", "Time to clock out, with “file your report first” for anyone who hasn’t.", ["Everyone", "Private", "HR"]],
  ["every 10 min", "Repeat", "Still clocked in?", "Another private nudge, only to whoever is still clocked in, until 9 PM.", ["Private"]],
  ["any time", "Zap", "As it happens", "Leave requests and results, DMR reminders, announcements, and “you clocked in at…” receipts.", ["Private", "HR", "Announcements"]],
];
P.push(page("cream grid", 3, `
  <div class="hero tight">
    <div class="eyebrow">A day on Slack · Monday to Saturday</div>
    <h1>One day,<br><span class="hl-box">six moments.</span></h1>
  </div>
  <div class="timeline">
    ${steps.map(([t, ic, h, p, aud]) => `
      <div class="tl-row">
        <div class="tl-time">${t}</div>
        <div class="tl-dot">${icon(ic, 20)}</div>
        <div class="tl-card"><h3>${h}</h3><p>${p}</p><div class="aud">${aud.map((a) => `<span class="aud-${a.toLowerCase()}">${a}</span>`).join("")}</div></div>
      </div>`).join("")}
  </div>
  <div class="sunday">${icon("Coffee", 16)} No reminders on Sundays, company holidays or approved leave.</div>`));

// 4. 10:00 AM
P.push(page("cream", 4, `
  <div class="hero tight">
    <div class="eyebrow">10:00 AM · Clock-in</div>
    <h1>Good morning,<br><span class="hl-mint-box">team.</span></h1>
  </div>
  <div class="two-col">
    <div class="col">
      <div class="col-label">${icon("Users", 15)} Everyone sees</div>
      ${slackWindow("uipl-daily", slackMsg(msgs.team.clockIn, { time: "10:00 AM" }), { sub: "everyone" })}
      <div class="col-label">${icon("UserRound", 15)} Only you see · if you haven’t clocked in</div>
      ${slackWindow("UIPL Docs", slackMsg(msgs.personal.clockInDue, { time: "10:00 AM" }), { kind: "dm", sub: "private" })}
    </div>
    <div class="col">
      <div class="col-label">${icon("MousePointerClick", 15)} Tap Clock in</div>
      <div class="step-card">
        <p>The button opens the dashboard and clocks you in. Office staff allow location, so the office geofence still applies; remote staff just tap.</p>
      </div>
      <div class="col-label">${icon("CheckCircle2", 15)} Then, only you see</div>
      ${slackWindow("UIPL Docs", slackMsg(msgs.personal.clockedIn, { time: "10:38 AM" }), { kind: "dm", sub: "private" })}
      <div class="col-label">${icon("ShieldCheck", 15)} HR sees · live</div>
      ${slackWindow("hr-desk", slackMsg(msgs.hr.clockIn, { time: "10:00 AM", maxLines: 6, note: "edited" }), { kind: "hr", sub: "HR only" })}
    </div>
  </div>
  ${deco()}`));

// 5. Yesterday's misses
P.push(page("mint", 5, `
  <div class="hero tight">
    <div class="eyebrow">10:00 AM · Look-back</div>
    <h1>Forgot to<br>clock out?</h1>
    <div class="dark-pill">Fix it in <b>one tap.</b></div>
  </div>
  <div class="lb-top">
    <div class="lb-msg">${slackWindow("UIPL Docs", slackMsg(msgs.personal.recap, { time: "10:00 AM" }), { kind: "dm", sub: "private" })}</div>
    <div class="lb-side">
      <div class="callouts col">${chip("LogIn", "Didn’t clock in")}${chip("LogOut", "Didn’t clock out")}${chip("FileX", "Report not filed")}</div>
      <p class="small-note">Sent before today’s clock-in reminder, only to people who missed something on the last working day. If an adjustment is already with HR, it says so instead of showing the button.</p>
    </div>
  </div>
  <div class="lb-arrow">${icon("ArrowDown", 30, 2.2)}<span>Tap <b>Request adjustment</b></span></div>
  <div class="lb-shot"><img src="${img("adjustment-form-crop.png")}"></div>
  <div class="shot-cap">${icon("MonitorSmartphone", 14)} The dashboard opens the adjustment form with that day already filled in. Add the right times and a reason; HR reviews it.</div>
  </div>`));

// 6. 6:50 PM report
P.push(page("lavender", 6, `
  <div class="hero tight">
    <div class="eyebrow">6:50 PM · Daily report</div>
    <h1>What did you<br><span class="hl-forest-box">get done?</span></h1>
  </div>
  <div class="two-col">
    <div class="col">
      <div class="col-label">${icon("Users", 15)} Everyone sees</div>
      ${slackWindow("uipl-daily", slackMsg(msgs.team.report, { time: "6:50 PM" }), { sub: "everyone" })}
      <div class="col-label">${icon("UserRound", 15)} Only you see · if it isn’t in yet</div>
      ${slackWindow("UIPL Docs", slackMsg(msgs.personal.reportDue, { time: "6:50 PM" }), { kind: "dm", sub: "private" })}
      <div class="col-label">${icon("FileCheck2", 15)} After you file · your own copy</div>
      ${slackWindow("UIPL Docs", slackMsg(msgs.personal.ownReport, { time: "6:58 PM", maxLines: 5 }), { kind: "dm", sub: "private" })}
    </div>
    <div class="col">
      <div class="col-label">${icon("ShieldCheck", 15)} HR sees · filed and not filed, live</div>
      ${slackWindow("hr-desk", slackMsg(msgs.hr.report, { time: "6:50 PM", maxLines: 6, note: "edited", thread: "1 reply · each report goes in the thread" }), { kind: "hr", sub: "HR only" })}
      <div class="col-label">${icon("MessagesSquare", 15)} In the thread</div>
      ${slackWindow("Thread", slackMsg(msgs.hr.reportReply, { time: "6:58 PM", maxLines: 5 }), { kind: "hr", sub: "hr-desk" })}
      <div class="tip">${icon("PencilLine", 16)} Edit a report and both copies update in place. Nothing is posted twice.</div>
    </div>
  </div>`));

// 7. 7:00 PM clock-out
P.push(page("forest", 7, `
  <div class="hero tight">
    <div class="eyebrow light">7:00 PM · Clock-out</div>
    <h1>Still here?<br><span class="hl-mint-box dark">Clock out.</span></h1>
  </div>
  <div class="two-col">
    <div class="col">
      <div class="col-label light">${icon("Users", 15)} Everyone sees · once</div>
      ${slackWindow("uipl-daily", slackMsg(msgs.team.clockOut, { time: "7:00 PM" }), { sub: "everyone" })}
      <div class="col-label light">${icon("ShieldCheck", 15)} HR sees · live</div>
      ${slackWindow("hr-desk", slackMsg(msgs.hr.clockOut, { time: "7:00 PM", maxLines: 5, note: "edited" }), { kind: "hr", sub: "HR only" })}
    </div>
    <div class="col">
      <div class="col-label light">${icon("UserRound", 15)} Only you see · every 10 minutes until you clock out</div>
      ${slackWindow("UIPL Docs", `${slackMsg(msgs.personal.clockOutDue1, { time: "7:00 PM" })}${slackMsg(msgs.personal.clockOutDue3, { time: "7:20 PM" })}${slackMsg(msgs.personal.clockedOut, { time: "7:24 PM" })}`, { kind: "dm", sub: "private" })}
      <div class="repeat-strip">${["7:00", "7:10", "7:20", "…", "8:50"].map((t) => `<span>${t}</span>`).join(icon("ChevronRight", 12))}<b>stops at 9 PM</b></div>
    </div>
  </div>
  ${deco()}`));

// 8. HR view
P.push(page("lavender", 8, `
  <div class="hero tight">
    <div class="eyebrow">HR channel · private</div>
    <h1>The whole<br>picture, <span class="hl-forest-box">live.</span></h1>
    <p class="lead">Only people in the HR channel see this. Each post updates itself as people clock in, file and clock out, so HR never chases.</p>
  </div>
  <div class="three-col">
    ${slackWindow("hr-desk", slackMsg(msgs.hr.clockIn, { time: "10:00 AM", maxLines: 12, note: "edited" }), { kind: "hr", sub: "HR only" })}
    ${slackWindow("hr-desk", slackMsg(msgs.hr.report, { time: "6:50 PM", maxLines: 12, note: "edited", thread: "Each report in the thread" }), { kind: "hr", sub: "HR only" })}
    ${slackWindow("hr-desk", slackMsg(msgs.hr.clockOut, { time: "7:00 PM", maxLines: 12, note: "edited" }), { kind: "hr", sub: "HR only" })}
  </div>
  <div class="hr-foot">${chip("Eye", "Who sees it: whoever is in the channel")}${chip("Lock", "Make it private, add only HR")}${chip("Archive", "Kept after midnight")}</div>`));

// 9. Leave
P.push(page("cream grid", 9, `
  <div class="hero tight">
    <div class="eyebrow">Leave · any time</div>
    <h1>Apply. Approve.<br><span class="hl-mint-box">Done.</span></h1>
  </div>
  <div class="leave-flow">
    <div class="lf-step"><span class="num">1</span><div><h3>Employee applies on the dashboard</h3><p>Dates, type and reason, as today. They get a note: “sent to HR”.</p></div></div>
    <div class="lf-step"><span class="num">2</span><div><h3>HR gets the request on Slack</h3>
      ${slackWindow("hr-desk", slackMsg(msgs.leave.card, { time: "10:17 AM" }), { kind: "hr", sub: "HR only" })}</div></div>
    <div class="lf-split">
      <div class="lf-step"><span class="num">3</span><div><h3>Approve or Decline, comment optional</h3>
        <div class="modal">
          <div class="modal-h"><b>Approve leave</b>${icon("X", 16)}</div>
          <div class="modal-l">Comment <span>(optional)</span></div>
          <div class="modal-i">Approved. Enjoy the function!</div>
          <div class="modal-f"><span class="s-btn">Cancel</span><span class="s-btn primary">Approve</span></div>
        </div></div></div>
      <div class="lf-step"><span class="num">4</span><div><h3>Everyone in the loop</h3>
        ${slackWindow("UIPL Docs", slackMsg({ blocks: [{ type: "section", text: { type: "mrkdwn", text: ":white_check_mark: Your leave for *Mon, 30 Nov* was *approved* by Neelam Verma." } }, { type: "section", text: { type: "mrkdwn", text: "*Comment*\nApproved. Enjoy the function!" } }] }, { time: "11:02 AM" }), { kind: "dm", sub: "employee · private" })}
        <p class="small-note">The HR card turns into “✅ Approved by Neelam Verma” for everyone in HR. The first decision wins.</p></div></div>
    </div>
  </div>`));

// 10. Announcements
P.push(page("forest", 10, `
  <div class="hero tight">
    <div class="eyebrow light">Announcements</div>
    <h1>Say it once.<br><span class="hl-mint-box dark">Everyone hears.</span></h1>
  </div>
  <div class="ann-header"><img src="${img("header.png")}"><span class="ann-tag">${icon("MousePointerClick", 14)} New header button</span></div>
  <div class="ann-row">
    <div class="ann-drawer"><img src="${img("announcement-drawer-crop.png")}"><span class="ann-cap">${icon("PanelRight", 14)} The drawer on the dashboard</span></div>
    <div class="ann-phone"><img src="${img("slack-announcements-phone.jpg")}"><span class="ann-cap">${icon("Smartphone", 14)} As it lands in Slack</span></div>
  </div>
  <div class="ann-notes">
    ${chip("Building2", "Only chosen departments can post (HR, Administration)", "dark")}
    ${chip("AtSign", "Optional @channel to notify all", "dark")}
    ${chip("PanelRight", "Opens as a side drawer", "dark")}
  </div>`));

// 11. DMR from WhatsApp
P.push(page("mint", 11, `
  <div class="hero tight">
    <div class="eyebrow">DMR reminders · from WhatsApp</div>
    <h1>WhatsApp<br>reminders, <span class="hl-forest-box">now on Slack.</span></h1>
    <p class="lead">Every DMR reminder that goes out on WhatsApp (actual manpower, tomorrow’s plan, site daily report) also goes to Slack, following the same rule.</p>
  </div>
  <div class="mirror">
    <div class="wa-card"><span class="wa-ic">${WA}</span><div><b>WhatsApp</b><p>“Tomorrow’s planned manpower (25 Nov) is due”</p></div></div>
    <div class="flow-arrow dark">${icon("ArrowRight", 30, 2.2)}</div>
    <div class="mirror-out">
      ${slackWindow("UIPL Docs", slackMsg({ blocks: [{ type: "section", text: { type: "mrkdwn", text: ":construction: Hi Miti, tomorrow's planned manpower (25 Nov 2026) is due." } }, { type: "actions", elements: [{ type: "button", style: "primary", text: { type: "plain_text", text: "Open DMR" } }] }] }, { time: "6:00 PM" }), { kind: "dm", sub: "each person still due" })}
      ${slackWindow("hr-desk", slackMsg({ blocks: [{ type: "section", text: { type: "mrkdwn", text: ":construction: *Tomorrow's planned manpower (25 Nov 2026) is due*  (HR view)" } }, { type: "section", text: { type: "mrkdwn", text: "*Still to fill (2)*\nMiti, Aslam Siddique" } }] }, { time: "6:00 PM" }), { kind: "hr", sub: "HR only" })}
    </div>
  </div>
  <div class="dmr-times">
    ${[["11:00 AM", "HardHat", "Actual manpower", "Today’s workers on each site"], ["2:00 PM", "CalendarClock", "Tomorrow’s plan", "Planned manpower for tomorrow"], ["6:00 PM", "ClipboardList", "Site daily report", "What happened on site today"]]
      .map(([t, ic, h, p]) => `<div class="dmr-card"><span class="dmr-ic">${icon(ic, 22)}</span><span class="dmr-t">${t}</span><h3>${h}</h3><p>${p}</p></div>`).join("")}
  </div>
  <div class="small-note center">Site people are matched by the phone number on their Slack profile, the same number WhatsApp uses.</div>
  ${deco()}`));

// 12. Control panel
P.push(page("cream", 12, `
  <div class="hero tight">
    <div class="eyebrow">Module Control · Super Admin</div>
    <h1>You decide<br><span class="hl-mint-box">who sees what.</span></h1>
  </div>
  <div class="ctl-shot"><img src="${img("control-matrix.png")}"></div>
  <div class="ctl-shot"><img src="${img("control-extras.png")}"></div>
  <div class="ctl-notes">
    ${chip("ToggleRight", "A switch for every reminder × audience")}
    ${chip("Clock", "Times, repeats and clean-up are editable")}
    ${chip("Send", "Send now, to test any reminder")}
  </div>`));

// 13. Privacy, clean-up and reach
P.push(page("forest", 13, `
  <div class="hero tight">
    <div class="eyebrow light">Privacy · clean-up · reach</div>
    <h1>Clean every<br>night. <span class="hl-mint-box dark">Private always.</span></h1>
  </div>
  <div class="stats">
    <div class="stat"><b>63</b><span>daily messages cleared after midnight in the dry run</span></div>
    <div class="stat"><b>0</b><span>names or times in the everyone channel</span></div>
    <div class="stat"><b>17</b><span>private messages at 10:00 if everyone joins Slack</span></div>
    <div class="stat"><b>20/30</b><span>accounts with no email, now matched by phone</span></div>
  </div>
  <div class="vis-table">
    <div class="vt-row head"><span></span><span>${icon("Users", 15)} Everyone</span><span>${icon("UserRound", 15)} The person</span><span>${icon("ShieldCheck", 15)} HR</span><span>${icon("Trash2", 15)} After midnight</span></div>
    ${[
      ["Clock-in, report, clock-out reminders", "Plain reminder", "Own status", "Full list", "Deleted"],
      ["Yesterday’s misses", "—", "Own misses", "—", "Deleted"],
      ["Filed report", "—", "Own copy", "In thread", "Kept for HR"],
      ["Leave request and result", "—", "Own result", "Card + decision", "Kept"],
      ["DMR reminders", "—", "Own nudge", "Full list", "Kept for HR"],
      ["Announcements", "Everyone", "—", "—", "Kept"],
    ].map((r) => `<div class="vt-row">${r.map((c, i) => `<span class="${i === 0 ? "vt-h" : c === "—" ? "vt-no" : "vt-yes"}">${c}</span>`).join("")}</div>`).join("")}
  </div>
  ${deco()}`));

// 14. Go live
P.push(page("lavender", 14, `
  <div class="hero tight">
    <div class="eyebrow">Before it goes live</div>
    <h1>Five steps<br>to <span class="hl-forest-box">switch on.</span></h1>
  </div>
  <div class="checklist">
    ${[
      ["Hash", "Create #uipl-daily", "A public channel with everyone in it, for the plain reminders."],
      ["Lock", "Create a private HR channel", "Add only HR and the app (/invite @UIPL Docs), then paste its ID on Module Control."],
      ["UserPlus", "Bring everyone into Slack", "Same email or phone as on the dashboard. 5 accounts still need one added."],
      ["Megaphone", "Create #announcements", "Already done. Choose which departments can post."],
      ["Rocket", "Deploy", "The schedule runs on the live server; buttons and approvals work from then on."],
    ].map(([ic, h, p], i) => `<div class="check"><span class="ck-num">${i + 1}</span><span class="ck-ic">${icon(ic, 22)}</span><div><h3>${h}</h3><p>${p}</p></div></div>`).join("")}
  </div>
  <div class="end-card">
    <div class="logos"><span class="logo-tile"><img src="${UIPL}"></span><span class="x">×</span><span class="logo-tile slack">${SLACK}</span></div>
    <div class="end-text"><span class="end-big">Switch to Slack</span><span>and never chase a reminder on WhatsApp again.</span></div>
  </div>
  ${deco()}`));

/* ── styles ── */
const CSS = `
@font-face { font-family: "Regular"; src: url("fonts/regular.otf"); font-weight: 400; }
@font-face { font-family: "Fill"; src: url("fonts/manrope-regular.ttf"); font-weight: 400; }
@page { size: 210mm 297mm; margin: 0; }
:root { --forest:#0c4a38; --deep:#073527; --lav:#d6c5f6; --lav2:#bba2ee; --cream:#f8f4e6; --paper:#fffdf6; --mint:#5bd6a0; --mint2:#a9ecca; --ink:#0b2a20; --soft:#3d5a4f; --line:rgba(11,42,32,.14); }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:"Regular","Fill","Segoe UI Emoji",sans-serif; color:var(--ink); font-size:11px; line-height:1.45; font-synthesis:none; }
b,strong,h1,h2,h3 { font-weight:400; }
.page { position:relative; width:794px; height:1123px; overflow:hidden; break-after:page; padding:104px 44px 70px; }
.page:last-child { break-after:auto; }
.forest { background:var(--forest); color:var(--cream); }
.lavender { background:var(--lav); }
.cream { background:var(--cream); }
.mint { background:var(--mint); }
.grid { background-image:linear-gradient(rgba(11,42,32,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(11,42,32,.06) 1px,transparent 1px); background-size:36px 36px; }

.story { position:absolute; left:34px; right:34px; top:22px; }
.segs { display:flex; gap:5px; }
.segs i { flex:1; height:3px; border-radius:3px; background:currentColor; opacity:.22; }
.segs i.on { opacity:.85; }
.who { display:flex; align-items:center; gap:9px; margin-top:11px; }
.ava { width:30px; height:30px; border-radius:50%; background:var(--paper); display:grid; place-items:center; box-shadow:0 0 0 2px currentColor; }
.ava img { width:18px; height:18px; }
.nm { font-size:12px; }
.w-slack.small { margin-left:auto; width:18px; height:18px; display:inline-flex; }
.w-slack svg { width:100%; height:100%; }
.foot { position:absolute; left:44px; right:44px; bottom:26px; display:flex; justify-content:space-between; font-size:10px; opacity:.6; letter-spacing:.04em; }

.hero h1 { font-size:58px; line-height:.96; letter-spacing:-.03em; }
.hero.tight h1 { font-size:50px; }
.hero .lead { font-size:13.5px; max-width:520px; margin-top:16px; line-height:1.4; }
.eyebrow { font-size:11px; letter-spacing:.16em; text-transform:uppercase; margin-bottom:12px; opacity:.75; }
.mega { font-size:84px !important; line-height:.9 !important; letter-spacing:-.04em; }
.ast { display:inline-flex; vertical-align:middle; color:var(--paper); margin:0 -4px; transform:translateY(-6px); }
.dark-pill { display:inline-block; background:var(--ink); color:var(--cream); border-radius:10px; padding:7px 14px; font-size:15px; margin-top:16px; }
.dark-pill b { color:var(--mint2); }
.hl-mint { color:var(--mint); }
.hl-box, .hl-mint-box, .hl-forest-box { display:inline-block; border-radius:14px; padding:0 12px 4px; margin-left:-6px; }
.hl-box { background:var(--mint2); }
.hl-mint-box { background:var(--mint2); color:var(--ink); }
.hl-mint-box.dark { background:var(--mint); color:var(--deep); }
.hl-forest-box { background:var(--forest); color:var(--cream); }
.pill { display:inline-block; }
.chip { display:inline-flex; align-items:center; gap:7px; padding:7px 12px; border-radius:999px; background:var(--paper); color:var(--ink); font-size:11px; border:1px solid var(--line); }
.chip.dark { background:rgba(255,255,255,.1); color:var(--cream); border-color:rgba(255,255,255,.18); }
.small-note { font-size:11px; opacity:.8; margin-top:10px; line-height:1.45; }
.small-note.center { text-align:center; margin-top:22px; }

/* cover */
.cover-grid { position:absolute; left:58px; right:58px; top:118px; display:grid; grid-template-columns:repeat(7,1fr); row-gap:22px; align-items:center; }
.cover-grid > i { font-style:normal; text-align:center; font-size:34px; line-height:40px; color:var(--cream); }
.pac-cell { display:flex; justify-content:center; }
.pac { display:block; width:50px; height:50px; border-radius:50%; background:conic-gradient(var(--lav) 0 280deg, transparent 280deg 360deg); transform:rotate(130deg); }
.cover-grid .q { grid-column:1 / span 4; justify-self:start; background:var(--paper); color:var(--ink); padding:3px 14px 6px; border-radius:6px; font-size:26px; letter-spacing:-.01em; line-height:1.25; }
.cover-grid .q5 { margin-left:22px; }
.cover-title { position:absolute; left:44px; right:44px; bottom:84px; }
.cover-title h1 { font-size:96px; line-height:.9; letter-spacing:-.045em; margin-top:22px; }
.cover-title p { font-size:15px; max-width:520px; margin-top:16px; opacity:.9; }
.meta-row { display:flex; gap:10px; margin-top:20px; }
.logos { display:flex; align-items:center; gap:12px; }
.logo-tile { width:54px; height:54px; border-radius:16px; background:var(--paper); display:grid; place-items:center; }
.logo-tile img { width:34px; height:34px; }
.logo-tile.slack svg { width:30px; height:30px; }
.logos .x { font-size:26px; opacity:.7; }

/* rooms */
.rooms { display:grid; grid-template-columns:1fr; gap:16px; margin-top:38px; }
.room { border-radius:24px; padding:24px; display:grid; grid-template-columns:52px 1fr; column-gap:16px; }
.room.cream { background:var(--paper); }
.room.mint { background:var(--mint2); }
.room.forest { background:var(--forest); color:var(--cream); }
.room-ic { grid-row:span 4; width:52px; height:52px; border-radius:16px; background:rgba(11,42,32,.08); display:grid; place-items:center; }
.room.forest .room-ic { background:rgba(255,255,255,.12); }
.room h3 { font-size:22px; letter-spacing:-.01em; }
.room-ch { font-size:11px; opacity:.7; margin-top:2px; }
.room p { font-size:12.5px; margin-top:8px; }
.room .ex { margin-top:10px; display:inline-block; font-size:12px; padding:6px 12px; border-radius:10px; background:rgba(11,42,32,.07); justify-self:start; }
.room.forest .ex { background:rgba(255,255,255,.1); }

/* timeline */
.timeline { margin-top:30px; position:relative; }
.timeline:before { content:""; position:absolute; left:121px; top:18px; bottom:18px; width:2px; background:var(--forest); opacity:.25; }
.tl-row { display:grid; grid-template-columns:96px 52px 1fr; align-items:center; gap:0 0; margin-bottom:12px; }
.tl-time { font-size:17px; text-align:right; padding-right:14px; letter-spacing:-.01em; }
.tl-dot { width:44px; height:44px; border-radius:50%; background:var(--forest); color:var(--mint2); display:grid; place-items:center; position:relative; z-index:1; }
.tl-card { background:var(--paper); border:1px solid var(--line); border-radius:18px; padding:12px 16px; margin-left:12px; }
.tl-card h3 { font-size:16px; }
.tl-card p { font-size:11.5px; margin-top:3px; color:var(--soft); }
.aud { display:flex; gap:6px; margin-top:8px; }
.aud span { font-size:9.5px; padding:3px 9px; border-radius:999px; }
.aud-everyone { background:var(--lav); }
.aud-private { background:var(--mint2); }
.aud-hr { background:var(--forest); color:var(--cream); }
.aud-announcements { background:#fff1a8; }
.sunday { display:flex; align-items:center; gap:8px; font-size:12px; margin-top:8px; padding:10px 14px; background:var(--lav); border-radius:12px; width:fit-content; }

/* slack mock */
.s-window { background:#fff; color:#1d1c1d; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(7,53,39,.14), 0 0 0 1px rgba(7,53,39,.08); font-family:"Segoe UI","Segoe UI Emoji",sans-serif; font-synthesis:weight; }
.s-bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:1px solid #ececec; font-size:12px; background:#fafafa; }
.s-bar b { font-family:"Regular","Fill",sans-serif; font-size:13px; }
.w-hash { width:18px; text-align:center; color:#616061; font-size:14px; display:inline-flex; justify-content:center; }
.w-dm img { width:18px; height:18px; border-radius:5px; background:#0c4a38; padding:2px; display:block; }
.w-sub { color:#8a888a; font-size:10.5px; }
.s-bar .w-slack { margin-left:auto; width:14px; height:14px; display:inline-flex; }
.s-feed { padding:4px 0; }
.s-msg { display:grid; grid-template-columns:32px 1fr; gap:9px; padding:8px 12px; }
.s-msg + .s-msg { border-top:1px dashed #efefef; }
.s-ava { width:32px; height:32px; border-radius:8px; background:var(--forest); display:grid; place-items:center; }
.s-ava img { width:20px; height:20px; }
.s-meta { display:flex; align-items:center; gap:6px; font-size:12px; }
.s-meta b { font-weight:700; }
.s-app { font-size:8.5px; background:#eaeaea; color:#616061; border-radius:3px; padding:1px 4px; letter-spacing:.03em; }
.s-time { font-size:10px; color:#8a888a; }
.s-note { font-size:9.5px; color:#8a888a; }
.s-section { font-size:11.5px; line-height:1.48; margin-top:3px; }
.s-section b, .s-fields b, .s-header, .s-meta b { font-weight:700; }
.s-section .more { color:#8a888a; font-size:10.5px; }
.s-header { font-size:14px; margin-top:4px; }
.s-fields { display:grid; grid-template-columns:1fr 1fr; gap:6px 14px; font-size:11px; margin-top:6px; }
.s-context { font-size:10px; color:#616061; margin-top:5px; }
.s-divider { height:1px; background:#ececec; margin:7px 0; }
.s-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }
.s-btn { display:inline-flex; align-items:center; height:24px; padding:0 11px; border-radius:5px; border:1px solid #d0d0d0; font-size:11px; font-weight:700; color:#1d1c1d; background:#fff; }
.s-btn.primary { background:#007a5a; border-color:#007a5a; color:#fff; }
.s-btn.danger { color:#e01e5a; border-color:#e8a8bb; }
.mention { background:#e8f5fa; color:#1264a3; border-radius:3px; padding:0 2px; }
.s-thread { display:flex; align-items:center; gap:5px; font-size:10.5px; color:#1264a3; margin-top:6px; }
code { font-family:Consolas,monospace; background:#f2f2f2; padding:0 3px; border-radius:3px; font-size:10px; }

/* layouts */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:26px; }
.three-col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:28px; align-items:start; }
.three-col .s-section { font-size:10.5px; }
.three-col .s-msg { grid-template-columns:26px 1fr; gap:7px; padding:8px 10px; }
.three-col .s-ava { width:26px; height:26px; border-radius:7px; }
.three-col .s-ava img { width:16px; height:16px; }
.three-col .s-meta { white-space:nowrap; font-size:11px; gap:4px; }
.three-col .s-app, .three-col .s-note { display:none; }
.col { display:flex; flex-direction:column; gap:9px; }
.col-label { display:flex; align-items:center; gap:7px; font-size:11.5px; margin-top:6px; }
.col-label.light { color:var(--mint2); }
.step-card { background:var(--forest); color:var(--cream); border-radius:16px; padding:14px 16px; font-size:12px; line-height:1.45; }
.tip { display:flex; gap:8px; align-items:flex-start; background:var(--paper); border-radius:14px; padding:11px 14px; font-size:11.5px; margin-top:6px; }
.flow-row { display:grid; grid-template-columns:minmax(0,1fr) 34px minmax(0,1.05fr); gap:12px; align-items:center; margin-top:30px; }
.flow-left, .flow-right { min-width:0; }
.flow-arrow { display:grid; place-items:center; color:var(--deep); }
.flow-arrow.dark { color:var(--deep); }
.callouts { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
.callouts.col { flex-direction:column; align-items:flex-start; margin-top:0; }
.lb-top { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); gap:20px; margin-top:26px; align-items:start; }
.lb-arrow { display:flex; align-items:center; gap:10px; margin:16px 0 12px; font-size:13px; color:var(--deep); }
.lb-shot { border-radius:16px; overflow:hidden; box-shadow:0 14px 34px rgba(7,53,39,.25); background:#fff; }
.lb-shot img { width:100%; display:block; }
.shot-frame { border-radius:16px; overflow:hidden; box-shadow:0 14px 34px rgba(7,53,39,.25); background:#fff; height:420px; }
.shot-frame img { width:100%; height:100%; display:block; object-fit:cover; }
.shot-cap { display:flex; gap:7px; align-items:flex-start; font-size:11.5px; margin-top:10px; }
.repeat-strip { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--mint2); margin-top:4px; flex-wrap:wrap; }
.repeat-strip span { background:rgba(255,255,255,.1); border-radius:999px; padding:4px 10px; color:var(--cream); }
.repeat-strip b { margin-left:6px; }
.hr-foot { display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; }

/* leave */
.leave-flow { margin-top:22px; display:flex; flex-direction:column; gap:14px; }
.lf-step { display:grid; grid-template-columns:34px 1fr; gap:12px; }
.lf-step h3 { font-size:16px; margin:5px 0 8px; }
.lf-step p { font-size:11.5px; color:var(--soft); }
.num { width:34px; height:34px; border-radius:50%; background:var(--forest); color:var(--mint2); display:grid; place-items:center; font-size:15px; }
.lf-split { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.modal { background:#fff; border-radius:14px; box-shadow:0 10px 30px rgba(7,53,39,.14), 0 0 0 1px rgba(7,53,39,.08); padding:14px 16px; font-family:"Segoe UI",sans-serif; color:#1d1c1d; }
.modal-h { display:flex; justify-content:space-between; align-items:center; font-size:14px; }
.modal-h b { font-weight:700; }
.modal-l { font-size:11px; font-weight:700; margin-top:12px; }
.modal-l span { color:#8a888a; font-weight:400; }
.modal-i { border:1px solid #1264a3; box-shadow:0 0 0 3px #d4e6f4; border-radius:6px; padding:8px 10px; font-size:11px; margin-top:6px; height:56px; }
.modal-f { display:flex; justify-content:flex-end; gap:6px; margin-top:12px; }

/* announcements */
.ann-header { position:relative; margin-top:24px; border-radius:14px; overflow:hidden; box-shadow:0 10px 28px rgba(0,0,0,.25); }
.ann-header img { width:100%; display:block; }
.ann-tag { position:absolute; right:12px; bottom:-1px; transform:translateY(100%); }
.ann-row { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:44px; align-items:start; }
.ann-drawer, .ann-phone { position:relative; }
.ann-drawer img { width:100%; height:560px; object-fit:cover; object-position:top; display:block; border-radius:18px; box-shadow:0 14px 34px rgba(0,0,0,.3); }
.ann-phone img { width:100%; height:560px; border-radius:24px; display:block; box-shadow:0 14px 34px rgba(0,0,0,.3); border:6px solid #062b20; object-fit:cover; object-position:top; }
.ann-cap { position:absolute; left:50%; transform:translateX(-50%); bottom:-14px; display:flex; gap:6px; align-items:center; white-space:nowrap; background:var(--mint); color:var(--deep); font-size:10.5px; padding:6px 12px; border-radius:999px; }
.ann-notes { display:flex; gap:10px; margin-top:34px; flex-wrap:wrap; }

/* DMR */
.mirror { display:grid; grid-template-columns:0.9fr 40px 1.4fr; gap:12px; align-items:center; margin-top:36px; }
.wa-card { background:var(--paper); border-radius:18px; padding:16px; display:flex; gap:12px; align-items:flex-start; }
.wa-ic { width:40px; height:40px; flex:none; }
.wa-ic svg { width:40px; height:40px; }
.wa-card b { font-size:15px; }
.wa-card p { font-size:12px; margin-top:4px; color:var(--soft); }
.mirror-out { display:flex; flex-direction:column; gap:14px; }
.dmr-times { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:30px; }
.dmr-card { background:var(--forest); color:var(--cream); border-radius:20px; padding:16px; }
.dmr-ic { width:42px; height:42px; border-radius:13px; background:rgba(255,255,255,.12); color:var(--mint2); display:grid; place-items:center; }
.dmr-t { display:block; font-size:22px; color:var(--mint); margin-top:12px; letter-spacing:-.01em; }
.dmr-card h3 { font-size:15px; margin-top:2px; }
.dmr-card p { font-size:11px; opacity:.8; margin-top:2px; }
.deco { position:absolute; left:44px; right:44px; bottom:64px; display:flex; flex-direction:column; gap:12px; opacity:.9; }
.deco-row { display:flex; justify-content:space-between; align-items:center; font-size:26px; line-height:1; }
.deco-row i { font-style:normal; }
.deco-row b { font-size:22px; letter-spacing:-.01em; }

/* control */
.ctl-shot { margin-top:18px; border-radius:16px; overflow:hidden; background:#fff; box-shadow:0 10px 28px rgba(7,53,39,.14), 0 0 0 1px rgba(7,53,39,.06); padding:6px; }
.ctl-shot img { width:100%; display:block; }
.ctl-notes { display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; }

/* stats + table */
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:30px; }
.stat { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); border-radius:18px; padding:16px; }
.stat b { display:block; font-size:40px; letter-spacing:-.03em; color:var(--mint); line-height:1; }
.stat span { display:block; font-size:11px; margin-top:8px; opacity:.85; }
.vis-table { margin-top:26px; background:var(--paper); color:var(--ink); border-radius:20px; padding:8px 16px; }
.vt-row { display:grid; grid-template-columns:1.7fr 1fr 1fr 1fr 1fr; gap:8px; align-items:center; padding:12px 0; border-bottom:1px solid var(--line); font-size:11.5px; }
.vt-row:last-child { border-bottom:0; }
.vt-row.head span { display:flex; align-items:center; gap:6px; font-size:11px; opacity:.75; }
.vt-h { font-size:12.5px; }
.vt-yes { background:var(--mint2); border-radius:999px; padding:3px 10px; width:fit-content; }
.vt-no { opacity:.35; padding-left:10px; }

/* checklist */
.checklist { margin-top:28px; display:flex; flex-direction:column; gap:12px; }
.check { display:grid; grid-template-columns:30px 46px 1fr; gap:12px; align-items:center; background:var(--paper); border-radius:18px; padding:14px 18px; }
.ck-num { font-size:22px; opacity:.4; }
.ck-ic { width:46px; height:46px; border-radius:14px; background:var(--forest); color:var(--mint2); display:grid; place-items:center; }
.check h3 { font-size:17px; }
.check p { font-size:11.5px; color:var(--soft); margin-top:2px; }
.end-card { margin-top:24px; background:var(--forest); color:var(--cream); border-radius:22px; padding:22px 24px; display:flex; align-items:center; gap:22px; }
.end-text { display:flex; flex-direction:column; }
.end-big { font-size:28px; letter-spacing:-.02em; color:var(--mint); }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Slack, sorted — UIPL Docs daily flow</title><style>${CSS}</style></head><body>${P.join("\n")}</body></html>`;
const built = path.join(HERE, "report.html");
fs.writeFileSync(built, html);

fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files", "--virtual-time-budget=8000", `--print-to-pdf=${OUT_PDF}`, `file:///${built.replace(/\\/g, "/")}`], { stdio: "ignore" });
execFileSync("python", ["-c", `
import pypdfium2 as pdfium
pdf = pdfium.PdfDocument(r"${OUT_PDF}")
print("pages:", len(pdf), "size(pt):", [round(v) for v in pdf[0].get_size()])
for i, p in enumerate(pdf):
    p.render(scale=1.4).to_pil().save(r"${path.join(HERE, "preview")}" + f"/page-{i+1:02d}.png")
`], { stdio: "inherit" });
console.log("pdf:", OUT_PDF);
