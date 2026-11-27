// Sentinel-2 L2A true-colour frames from Copernicus Browser (anonymous use, accepted with the user's OK).
// usage: node sat.js <name> <lat> <lng> <zoom> <startDate YYYY-MM-DD> <steps>
const puppeteer = require("C:/Users/my792/Desktop/redefined/backend/node_modules/puppeteer-core");
const path = require("path");
const fs = require("fs");
const [name, lat, lng, zoom, start, steps = "6", cc = "30"] = process.argv.slice(2);
const OUT = path.join(__dirname, "sat", name);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--window-size=1700,1100", "--use-gl=angle", "--enable-webgl"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  const url = `https://browser.dataspace.copernicus.eu/?zoom=${zoom}&lat=${lat}&lng=${lng}&themeId=DEFAULT-THEME&datasetId=S2_L2A_CDAS&fromTime=${start}T00%3A00%3A00.000Z&toTime=${start}T23%3A59%3A59.999Z&layerId=1_TRUE_COLOR&cloudCoverage=${cc}&dateMode=SINGLE`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(3000);
  // Anonymous-use / consent dialog
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button, a, div[role=button]")].find((x) => /use anonymously|accept/i.test(x.innerText || ""));
    if (b) b.click();
  });
  await sleep(2000);
  await page.mouse.click(1175, 342); // close welcome modal
  await sleep(2000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button, a, div[role=button]")].find((x) => /use anonymously/i.test(x.innerText || ""));
    if (b) b.click();
  });
  await sleep(1000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /remind me later/i.test(x.innerText || ""));
    if (b) b.click();
  });
  await sleep(1500);
  if (process.env.COLLAPSE !== "0") await page.mouse.click(416, 35); // collapse side panel
  await sleep(15000);
  for (let i = 0; i < Number(steps); i++) {
    const href = page.url();
    const d = (href.match(/fromTime=(\d{4}-\d{2}-\d{2})/) || [])[1] || `step${i}`;
    await page.screenshot({ path: path.join(OUT, `${d}.png`) });
    console.log("saved", d);
    // previous available date
    const ok = await page.evaluate(() => {
      const btn = document.querySelector(".react-calendar__navigation__prev-button, button[title*='revious'], .previous-date, .date-arrow-left");
      if (btn) { btn.click(); return "sel"; }
      return null;
    });
    if (!ok) await page.mouse.click(27 * 2, 113 * 1.666); // fallback approx
    await sleep(9000);
  }
  await browser.close();
})();
