const path = require("path");
const { createRequire } = require("module");
const backendRequire = createRequire(path.join(__dirname, "..", "backend", "server.js"));
backendRequire("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !path.isAbsolute(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = path.join(__dirname, "..", "backend", process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}
const { google } = backendRequire("googleapis");

const spreadsheetId = "12wJZ-tcgISlEqAONSEeUdtg-PkKzkxTmPtCdf2EIB5U";
const tabName = process.argv[2] || "10 09";

function escapeSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(tabName)}!A1:ZZ80`,
  });
  const values = response.data.values || [];
  values.forEach((row, index) => {
    const joined = (row || []).map((cell, col) => `${col + 1}:${cell || ""}`).filter((cell) => /remark|planned|actual|total all site|other remarks|equipment|material|notes|staff/i.test(cell)).join(" | ");
    if (joined) console.log(`${index + 1}: ${joined}`);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
