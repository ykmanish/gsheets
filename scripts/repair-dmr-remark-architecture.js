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

function findLabel(values, regex) {
  for (let r = 0; r < values.length; r += 1) {
    const row = values[r] || [];
    for (let c = 0; c < row.length; c += 1) {
      if (regex.test(text(row[c]))) return { rowIndex: r, columnIndex: c };
    }
  }
  return null;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,index,gridProperties(columnCount,rowCount))",
  });
  const requests = [];
  const valueUpdates = [];
  const repaired = [];
  const deleted = [];

  for (const sheet of meta.data.sheets || []) {
    const props = sheet.properties || {};
    const title = props.title || "";
    if (/^DEMO Other Remarks/i.test(title)) {
      requests.push({ deleteSheet: { sheetId: props.sheetId } });
      deleted.push(title);
      continue;
    }
    if (!/^\d{2}\s+\d{2}/.test(title)) continue;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(title)}!A1:ZZ120`,
    });
    const values = response.data.values || [];
    const measureRowIndex = values.findIndex((row) => (row || []).filter((cell) => /^(planned|actual)$/i.test(text(cell))).length >= 2);
    if (measureRowIndex < 1) continue;
    const equipmentLabel = findLabel(values, /equipments?\s+and\s+tools/i);
    const otherRemarksLabel = findLabel(values, /other\s+remarks?\s*[:-]?/i);
    const notesLabel = findLabel(values, /notes?\s*[:-]/i);
    if (!equipmentLabel || !notesLabel) continue;

    const remarkColumns = new Set();
    for (let r = Math.max(0, measureRowIndex - 2); r <= measureRowIndex; r += 1) {
      const row = values[r] || [];
      row.forEach((cell, index) => {
        if (index < equipmentLabel.columnIndex && /\bremarks?\b/i.test(text(cell))) {
          remarkColumns.add(index);
        }
      });
    }
    [...remarkColumns].sort((a, b) => b - a).forEach((columnIndex) => {
      requests.push({
        deleteDimension: {
          range: {
            sheetId: props.sheetId,
            dimension: "COLUMNS",
            startIndex: columnIndex,
            endIndex: columnIndex + 1,
          },
        },
      });
    });

    if (!otherRemarksLabel) {
      const insertAt = notesLabel.rowIndex;
      requests.push({
        insertDimension: {
          range: {
            sheetId: props.sheetId,
            dimension: "ROWS",
            startIndex: insertAt,
            endIndex: insertAt + 5,
          },
          inheritFromBefore: true,
        },
      });
      const startRow = insertAt + 1;
      valueUpdates.push(
        { range: `${escapeSheetName(title)}!A${startRow}:F${startRow}`, values: [["Other Remarks :-", "", "", "", "", ""]] },
        { range: `${escapeSheetName(title)}!A${startRow + 1}:F${startRow + 1}`, values: [["Sr. No.", "Site", "", "Actual", "Remark", ""]] },
        { range: `${escapeSheetName(title)}!A${startRow + 2}:F${startRow + 4}`, values: [[1, "", "", "", "", ""], [2, "", "", "", "", ""], [3, "", "", "", "", ""]] },
      );
      requests.push(
        {
          repeatCell: {
            range: { sheetId: props.sheetId, startRowIndex: insertAt, endRowIndex: insertAt + 1, startColumnIndex: 0, endColumnIndex: 6 },
            cell: { userEnteredFormat: { backgroundColor: { red: 0.96, green: 0.78, blue: 0.65 }, textFormat: { bold: true } } },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          repeatCell: {
            range: { sheetId: props.sheetId, startRowIndex: insertAt + 1, endRowIndex: insertAt + 2, startColumnIndex: 0, endColumnIndex: 6 },
            cell: { userEnteredFormat: { backgroundColor: { red: 0.66, green: 0.82, blue: 0.56 }, horizontalAlignment: "CENTER", textFormat: { bold: true } } },
            fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)",
          },
        },
        {
          updateBorders: {
            range: { sheetId: props.sheetId, startRowIndex: insertAt + 1, endRowIndex: insertAt + 5, startColumnIndex: 0, endColumnIndex: 6 },
            top: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
            bottom: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
            left: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
            right: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
            innerHorizontal: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
            innerVertical: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } },
          },
        },
      );
    }

    if (remarkColumns.size || !otherRemarksLabel) {
      repaired.push({
        title,
        removedRemarkColumns: [...remarkColumns].map((index) => colName(index + 1)),
        addedOtherRemarksSection: !otherRemarksLabel,
      });
    }
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
  if (valueUpdates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: valueUpdates },
    });
  }

  console.log(JSON.stringify({
    deleted,
    repaired,
    requestCount: requests.length,
    valueUpdateCount: valueUpdates.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
