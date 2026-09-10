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

function columnName(number) {
  let n = Number(number);
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function findLabel(values, regex) {
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (regex.test(text(row[columnIndex]))) return { rowIndex, columnIndex };
    }
  }
  return null;
}

function findColumn(values, rowIndex, regex, fallbackColumnIndex) {
  const row = values[rowIndex] || [];
  for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
    if (regex.test(text(row[columnIndex]))) return columnIndex;
  }
  return fallbackColumnIndex;
}

function isNumericCell(value) {
  const cleaned = text(value).replace(/,/g, "");
  return !cleaned || Number.isFinite(Number(cleaned));
}

function parseOtherNote(note) {
  const value = text(note);
  const match = value.match(/^others?\s*:\s*([^-:]+?)\s*-\s*(.+?)(?:\s*:\s*(\d+(?:\.\d+)?))?\.?\s*$/i);
  if (!match) return null;
  return {
    site: text(match[1]),
    remark: text(match[2]),
    actual: text(match[3]),
  };
}

function parseSiteFromRemark(remark, siteNames) {
  const lower = text(remark).toLowerCase();
  return siteNames.find((site) => lower.includes(site.toLowerCase())) || "";
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
  const titles = (meta.data.sheets || [])
    .map((sheet) => sheet.properties?.title || "")
    .filter((title) => /^\d{2}\s+\d{2}/.test(title));
  const ranges = titles.map((title) => `${escapeSheetName(title)}!A1:W90`);
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
  const data = [];
  const moved = [];
  const cleared = [];

  titles.forEach((title, titleIndex) => {
    const values = response.data.valueRanges?.[titleIndex]?.values || [];
    const measureRowIndex = values.findIndex((row) => (row || []).filter((cell) => /^(planned|actual)$/i.test(text(cell))).length >= 2);
    const siteRowIndex = measureRowIndex - 1;
    const equipmentLabel = findLabel(values, /equipments?\s+and\s+tools/i);
    const otherRemarksLabel = findLabel(values, /other\s+remarks?\s*[:-]?/i);
    const notesLabel = findLabel(values, /notes?\s*[:-]/i);
    if (measureRowIndex < 0 || !otherRemarksLabel || !notesLabel) return;

    const otherHeaderRow = otherRemarksLabel.rowIndex + 1;
    const otherSerialColumn = findColumn(values, otherHeaderRow, /^(sr\.?\s*no\.?|no\.?)$/i, otherRemarksLabel.columnIndex);
    const otherSiteColumn = findColumn(values, otherHeaderRow, /^site$/i, otherRemarksLabel.columnIndex + 1);
    const otherActualColumn = findColumn(values, otherHeaderRow, /^actual$/i, otherRemarksLabel.columnIndex + 3);
    const otherRemarkColumn = findColumn(values, otherHeaderRow, /^remarks?$/i, otherRemarksLabel.columnIndex + 4);
    const otherRows = [];
    for (let rowIndex = otherRemarksLabel.rowIndex + 2; rowIndex < notesLabel.rowIndex; rowIndex += 1) {
      const serial = text(values[rowIndex]?.[otherSerialColumn]);
      const site = text(values[rowIndex]?.[otherSiteColumn]);
      const actual = text(values[rowIndex]?.[otherActualColumn]);
      const remark = text(values[rowIndex]?.[otherRemarkColumn]);
      otherRows.push({ rowIndex, empty: !site && !actual && !remark });
    }
    let nextOtherRow = otherRows.find((row) => row.empty)?.rowIndex;
    let nextSerial = otherRows.reduce((max, row) => {
      const serial = Number(values[row.rowIndex]?.[otherSerialColumn]) || 0;
      return Math.max(max, serial);
    }, 0) + 1;
    const writeOtherRemark = (payload) => {
      if (!nextOtherRow) return false;
      data.push(
        { range: `${escapeSheetName(title)}!${columnName(otherSerialColumn + 1)}${nextOtherRow + 1}`, values: [[nextSerial]] },
        { range: `${escapeSheetName(title)}!${columnName(otherSiteColumn + 1)}${nextOtherRow + 1}`, values: [[payload.site || ""]] },
        { range: `${escapeSheetName(title)}!${columnName(otherActualColumn + 1)}${nextOtherRow + 1}`, values: [[payload.actual || ""]] },
        { range: `${escapeSheetName(title)}!${columnName(otherRemarkColumn + 1)}${nextOtherRow + 1}`, values: [[payload.remark || ""]] },
      );
      moved.push({ title, row: nextOtherRow + 1, ...payload });
      nextSerial += 1;
      const remaining = otherRows.find((row) => row.empty && row.rowIndex > nextOtherRow);
      nextOtherRow = remaining?.rowIndex;
      return true;
    };

    const siteNames = (values[siteRowIndex] || []).map(text).filter((value) => /^\d{2}\./.test(value)).map((value) => value.replace(/^\d{2}\./, "").trim());
    const numericRowsEnd = equipmentLabel ? equipmentLabel.rowIndex : otherRemarksLabel.rowIndex;
    const metricRow = values[measureRowIndex] || [];
    for (let rowIndex = measureRowIndex + 1; rowIndex < numericRowsEnd; rowIndex += 1) {
      const agency = text(values[rowIndex]?.[2]);
      metricRow.forEach((metric, columnIndex) => {
        if (!/^(planned|actual)$/i.test(text(metric))) return;
        const value = values[rowIndex]?.[columnIndex];
        if (isNumericCell(value)) return;
        const remark = text(value);
        if (/^others?$/i.test(agency)) {
          writeOtherRemark({
            site: parseSiteFromRemark(remark, siteNames),
            actual: "",
            remark,
          });
        }
        data.push({ range: `${escapeSheetName(title)}!${columnName(columnIndex + 1)}${rowIndex + 1}`, values: [[""]] });
        cleared.push({ title, row: rowIndex + 1, column: columnName(columnIndex + 1), value: remark });
      });
    }

    for (let rowIndex = notesLabel.rowIndex + 1; rowIndex < values.length; rowIndex += 1) {
      const note = text(values[rowIndex]?.[2]);
      const payload = parseOtherNote(note);
      if (!payload) continue;
      if (writeOtherRemark(payload)) {
        data.push({ range: `${escapeSheetName(title)}!C${rowIndex + 1}`, values: [[""]] });
        cleared.push({ title, row: rowIndex + 1, column: "C", value: note });
      }
    }
  });

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
  }
  console.log(JSON.stringify({ moved, cleared, updatedCells: data.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
