const path = require("path");
const { createRequire } = require("module");
const backendRequire = createRequire(path.join(__dirname, "..", "backend", "server.js"));
backendRequire("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !path.isAbsolute(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = path.join(__dirname, "..", "backend", process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}
const { google } = backendRequire("googleapis");

const spreadsheetId = "12wJZ-tcgISlEqAONSEeUdtg-PkKzkxTmPtCdf2EIB5U";

function text(value) {
  return String(value ?? "").trim();
}

function escapeSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function colName(number) {
  let n = Number(number);
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title)",
  });
  const dateSheetTitles = (meta.data.sheets || [])
    .map((sheet) => sheet.properties?.title || "")
    .filter((title) => /^\d{2}\s+\d{2}/.test(title));
  if (!dateSheetTitles.length) {
    console.log(JSON.stringify({ repaired: [], updatedCells: 0 }, null, 2));
    return;
  }
  const ranges = dateSheetTitles.map((title) => `${escapeSheetName(title)}!A1:ZZ20`);
  const valuesResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    majorDimension: "ROWS",
  });
  const data = [];
  const repaired = [];
  for (const [rangeIndex, title] of dateSheetTitles.entries()) {
    const values = valuesResponse.data.valueRanges?.[rangeIndex]?.values || [];
    const measureRowIndex = values.findIndex((row) => (row || []).filter((cell) => /^(planned|actual)$/i.test(text(cell))).length >= 2);
    if (measureRowIndex < 1) continue;
    const row = values[measureRowIndex] || [];
    const fixes = [];
    row.forEach((cell, index) => {
      if (/\bremarks?\b/i.test(text(cell))) {
        data.push({
          range: `${escapeSheetName(title)}!${colName(index + 1)}${measureRowIndex + 1}`,
          values: [["Planned"]],
        });
        fixes.push(colName(index + 1));
      }
    });
    if (fixes.length) repaired.push({ title, fixedColumns: fixes });
  }
  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
  }
  console.log(JSON.stringify({ repaired, updatedCells: data.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
