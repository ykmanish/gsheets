// Render cover + body to PDF (Poppins from Google Fonts), body with NFSU header and page numbers.
const puppeteer = require("C:/Users/my792/Desktop/redefined/backend/node_modules/puppeteer-core");
const fs = require("fs");
const path = require("path");

const logo = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "assets/pdfimg0.png")).toString("base64");

const header = `<div style="width:100%;padding:0 16mm;display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;font-size:7px;color:#5b5f66;-webkit-print-color-adjust:exact">
  <img src="${logo}" style="height:11mm">
  <span style="text-align:right;line-height:1.5">OSINT &amp; Dark Web Investigation · TA-II<br><b style="color:#161616">Maritime Intelligence Dossier</b></span></div>`;
const footer = `<div style="width:100%;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7px;color:#5b5f66">
  <span>Manishkumar Yadav · Enrolment No. 250104002031</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  for (const [src, out, opts] of [
    ["cover.html", "cover.pdf", { margin: { top: 0, bottom: 0, left: 0, right: 0 } }],
    ["body.html", "body.pdf", { displayHeaderFooter: true, headerTemplate: header, footerTemplate: footer, margin: { top: "24mm", bottom: "16mm", left: "16mm", right: "16mm" } }],
  ]) {
    await page.goto("file:///" + path.join(__dirname, src).replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    const fam = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + f.weight).join(","));
    console.log(src, "fonts:", fam.slice(0, 120));
    await page.pdf({ path: path.join(__dirname, out), format: "A4", printBackground: true, preferCSSPageSize: false, ...opts });
  }
  await browser.close();
})();
