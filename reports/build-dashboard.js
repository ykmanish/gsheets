#!/usr/bin/env node
/**
 * Injects a day's project data into dashboard-template.html.
 *
 *   node build-dashboard.js <data.json>
 *
 * Writes  project-dashboard-<reportDate>.html  and  project-dashboard-latest.html
 * next to this script. The template's design is fixed; only the data changes.
 */
const fs = require("fs");
const path = require("path");

const here = __dirname;
const dataPath = process.argv[2];

if (!dataPath) {
  console.error("usage: node build-dashboard.js <data.json>");
  process.exit(1);
}

const raw = fs.readFileSync(dataPath, "utf8");
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("data file is not valid JSON: " + e.message);
  process.exit(1);
}

for (const key of ["reportDate", "reportDateLabel", "generatedAt", "kpi", "totals", "projects", "startingToday", "delayed", "assigneeLoad"]) {
  if (data[key] === undefined) {
    console.error(`data file is missing required key "${key}"`);
    process.exit(1);
  }
}

const template = fs.readFileSync(path.join(here, "dashboard-template.html"), "utf8");
if (!template.includes("__DATA__")) {
  console.error("template has no __DATA__ placeholder — was it overwritten with a built file?");
  process.exit(1);
}

// JSON.stringify output is safe inside <script> except for the </script> and
// HTML-comment sequences, which would terminate the block early.
const payload = JSON.stringify(data, null, 2)
  .replace(/<\//g, "<\\/")
  .replace(/<!--/g, "<\\!--");

const html = template.replace("__DATA__", payload);

const dated = path.join(here, `project-dashboard-${data.reportDate}.html`);
const latest = path.join(here, "project-dashboard-latest.html");
fs.writeFileSync(dated, html, "utf8");
fs.writeFileSync(latest, html, "utf8");

console.log("wrote " + dated);
console.log("wrote " + latest);
console.log(`  ${data.kpi.startingToday} starting today · ${data.kpi.delayed} delayed · ${data.kpi.pastTarget} past target`);
