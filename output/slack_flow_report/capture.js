// Captures the dashboard screens used in the report, at 2x, from a local frontend that talks to
// a mock API (no real login or data). Usage: node capture.js <puppeteer-core path> [base url]
const path = require("path");
const puppeteer = require(process.argv[2]);
const BASE = process.argv[3] || "http://localhost:3100";
const OUT = path.join(__dirname, "shots");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const session = () => {
  const menus = ["module-control", "dashboard", "hr-attendance", "employee-daily-report", "hr-leave"];
  localStorage.setItem("vectordocs_auth_token", "mock-token");
  localStorage.setItem("vectordocs_auth_user", JSON.stringify({ id: "u1", username: "manish", displayName: "Manish Yadav", isSuperAdmin: true, menus, privileges: [], roleName: "Super Admin", department: "Human Resource" }));
  localStorage.setItem("vectordocs_auth_menus", JSON.stringify(menus));
  localStorage.setItem("vectordocs_disabled_modules", "[]");
  localStorage.setItem("vectordocs_maintenance", '{"enabled":false}');
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.evaluate(session);

  // 1. Header with the Announcement button.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForSelector('[aria-label="Post an announcement"]', { timeout: 60000 });
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, "header.png"), clip: { x: 0, y: 0, width: 1440, height: 110 } });

  // 2. The announcement drawer, filled in.
  await page.click('[aria-label="Post an announcement"]');
  await wait(900);
  await page.type('[role="dialog"] input', "Office Holiday Notice");
  await page.type('[role="dialog"] textarea', "The office will remain closed on Friday on account of the holiday. Regular operations resume on Monday. Have a wonderful holiday!");
  await wait(300);
  await page.screenshot({ path: path.join(OUT, "announcement-drawer.png") });
  await page.keyboard.press("Escape");
  await wait(600);

  // 3. Module Control: the "Who sees what" section, in parts.
  await page.goto(`${BASE}/module-control`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForFunction(() => [...document.querySelectorAll("h2")].some((h) => h.textContent.includes("Who sees what")), { timeout: 60000 });
  await wait(1500);
  // Tag each part of the section, then screenshot that element (Puppeteer scrolls it into view).
  await page.setViewport({ width: 1440, height: 1500, deviceScaleFactor: 2 });
  await wait(800);
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("Who sees what on Slack"));
    const section = heading.closest("section");
    section.setAttribute("data-shot", "section");
    const kids = [...section.children];
    const tag = (el, name) => el && el.setAttribute("data-shot", name);
    tag(kids.find((el) => el.textContent.includes("HR channel (full view)") && el.matches("div.grid")), "channels");
    tag(section.querySelector("div.overflow-x-auto"), "matrix");
    tag(kids.find((el) => el.textContent.includes("Clear after midnight")), "extras");
    tag(kids.find((el) => el.textContent.includes("Should be in the HR channel")), "people");
    tag(kids[0], "top");
  });
  await page.setViewport({ width: 1440, height: 2400, deviceScaleFactor: 2 });
  await wait(800);
  for (const name of ["top", "channels", "matrix", "extras", "people"]) {
    const box = await page.evaluate((name) => {
      const el = document.querySelector(`[data-shot="${name}"]`);
      if (!el) return null;
      el.scrollIntoView({ block: "start" });
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left - 16), y: Math.max(0, r.top - 16), width: r.width + 32, height: r.height + 32 };
    }, name);
    if (!box) { console.log("missing part", name); continue; }
    await wait(500);
    // Re-measure after the scroll has settled.
    const settled = await page.evaluate((name) => {
      const r = document.querySelector(`[data-shot="${name}"]`).getBoundingClientRect();
      return { x: Math.max(0, r.left - 16), y: Math.max(0, r.top - 16), width: r.width + 32, height: r.height + 32 };
    }, name);
    await page.screenshot({ path: path.join(OUT, `control-${name}.png`), clip: settled, captureBeyondViewport: false });
  }

  // 4. The adjustment form the Slack look-back opens.
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/hr/attendance?adjust=2026-11-23`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes("Attendance adjustment request"), { timeout: 60000 });
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, "adjustment-form.png") });

  await browser.close();
  console.log("captured");
})().catch((error) => { console.error("FAILED", error.message); process.exit(1); });
