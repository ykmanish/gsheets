// High-res evidence captures of public OSINT pages (passive viewing only).
const puppeteer = require("C:/Users/my792/Desktop/redefined/backend/node_modules/puppeteer-core");
const path = require("path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.join(__dirname, "shots");
const only = process.argv.slice(2);

const jobs = [
  { name: "os_9384306", search: "9384306" },
  { name: "os_9236248", search: "9236248" },
  { name: "os_9259197", search: "9259197" },
  { name: "vf_9384306", url: "https://www.vesselfinder.com/vessels/details/9384306", h: 2500 },
  { name: "vf_9236248", url: "https://www.vesselfinder.com/vessels/details/9236248", h: 2500 },
  { name: "vf_9259197", url: "https://www.vesselfinder.com/vessels/details/9259197", h: 2500 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissConsent(page) {
  // Pick the most privacy-preserving option where a banner offers one.
  await page.evaluate(() => {
    const words = ["disable", "reject all", "decline", "necessary only", "only necessary", "reject"];
    const buttons = [...document.querySelectorAll("button, a")];
    for (const w of words) {
      const b = buttons.find((x) => (x.innerText || "").trim().toLowerCase() === w || (x.innerText || "").trim().toLowerCase().startsWith(w));
      if (b) { b.click(); return; }
    }
  }).catch(() => {});
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--window-size=1440,1000"] });
  for (const job of jobs) {
    if (only.length && !only.includes(job.name)) continue;
    const page = await browser.newPage();
    await page.setViewport({ width: 1360, height: 1000, deviceScaleFactor: 2 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    try {
      if (job.search) {
        await page.goto(`https://www.opensanctions.org/search/?q=${job.search}`, { waitUntil: "networkidle2", timeout: 60000 });
        const href = await page.evaluate(() => {
          const a = [...document.querySelectorAll("a[href*='/entities/']")][0];
          return a ? a.href : null;
        });
        if (!href) throw new Error("no entity link");
        console.log(job.name, href);
        await page.goto(href, { waitUntil: "networkidle2", timeout: 60000 });
      } else {
        await page.goto(job.url, { waitUntil: "networkidle2", timeout: 60000 });
      }
      await sleep(2500);
      await dismissConsent(page);
      await sleep(1500);
      const title = await page.title();
      console.log(job.name, "title:", title);
      await page.screenshot({ path: path.join(OUT, `${job.name}.png`), clip: { x: 0, y: 0, width: 1360, height: job.h || 1900 }, captureBeyondViewport: true });
    } catch (e) {
      console.log(job.name, "FAILED", e.message);
    }
    await page.close();
  }
  await browser.close();
})();
