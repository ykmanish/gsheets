const path = require("path");
const { createRequire } = require("module");
const backendRequire = createRequire(path.join(__dirname, "..", "backend", "server.js"));
backendRequire("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !path.isAbsolute(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = path.join(__dirname, "..", "backend", process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}
const { google } = backendRequire("googleapis");

const spreadsheetId = "12wJZ-tcgISlEqAONSEeUdtg-PkKzkxTmPtCdf2EIB5U";
const baseName = "DEMO Other Remarks";

function escapeSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,index)",
  });
  const existingSheets = meta.data.sheets || [];
  const template =
    existingSheets.find((sheet) => sheet.properties?.title === "09 09") ||
    existingSheets.find((sheet) => /^\d{2}\s+\d{2}/.test(sheet.properties?.title || "")) ||
    existingSheets[0];
  if (!template?.properties) throw new Error("No DMR template tab found");

  const usedNames = new Set(existingSheets.map((sheet) => sheet.properties?.title).filter(Boolean));
  let demoName = baseName;
  let suffix = 2;
  while (usedNames.has(demoName)) {
    demoName = `${baseName} ${suffix}`;
    suffix += 1;
  }

  const duplicate = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        duplicateSheet: {
          sourceSheetId: template.properties.sheetId,
          insertSheetIndex: (template.properties.index || 0) + 1,
          newSheetName: demoName,
        },
      }],
    },
  });
  const demoSheetId = duplicate.data.replies?.[0]?.duplicateSheet?.properties?.sheetId;

  const values = [
    ["Name of Agency / Trade", "Paramdham", "", "", "Kalhaar", "", "", "Devsharnam", "", ""],
    ["", "Planned", "Actual", "Paramdham Remark", "Planned", "Actual", "Kalhaar Remark", "Planned", "Actual", "Devsharnam Remark"],
    ["Tiles", 4, 3, "", 2, 2, "", 0, 0, ""],
    ["Waterproofing", 2, 2, "", 0, 0, "", 1, 1, ""],
    ["Window Fixture.", 1, 0, "", 1, 1, "", 0, 0, ""],
    ["Land scapping", 0, 0, "", 2, 1, "", 1, 1, ""],
    ["Others", 0, 2, "Two helpers used for site cleaning and material shifting.", 1, 1, "One person assigned for temporary barricade repair.", 0, 3, "Three people helped unload urgent plywood material."],
    ["Depart Labour", 0, 2, "", 0, 0, "", 0, 0, ""],
    ["Farming", 0, 0, "", 0, 0, "", 0, 0, ""],
    ["Total Manpower", "=SUM(B3:B9)", "=SUM(C3:C9)", "", "=SUM(E3:E9)", "=SUM(F3:F9)", "", "=SUM(H3:H9)", "=SUM(I3:I9)", ""],
  ];

  const reportValues = [
    ["Today Report Preview", "", "", ""],
    ["Site", "Planned", "Actual", "Remark"],
    ["Paramdham", 7, 9, "Two helpers used for site cleaning and material shifting."],
    ["Kalhaar", 6, 5, "One person assigned for temporary barricade repair."],
    ["Devsharnam", 2, 5, "Three people helped unload urgent plywood material."],
  ];

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: [`${escapeSheetName(demoName)}!A1:ZZ80`] },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${escapeSheetName(demoName)}!A1:J10`, values },
        { range: `${escapeSheetName(demoName)}!A13:D17`, values: reportValues },
        { range: `${escapeSheetName(demoName)}!A20:F20`, values: [["PROJECT STAFF ATTENDENCE", "", "", "", "", ""]] },
        { range: `${escapeSheetName(demoName)}!A21:F22`, values: [["1.Jay Panchal", "2.Prakash Luhar", "3.Sanjay Jadhav", "4.Deepak", "5.Vipul Shah", ""], ["P", "P", "P", "L", "A", ""]] },
      ],
    },
  });

  const requests = [];
  if (demoSheetId !== undefined && demoSheetId !== null) {
    requests.push(
      { repeatCell: { range: { sheetId: demoSheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: { red: 0, green: 0.69, blue: 0.31 }, textFormat: { bold: true }, horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)" } },
      { repeatCell: { range: { sheetId: demoSheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.8 }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(backgroundColor,wrapStrategy)" } },
      { repeatCell: { range: { sheetId: demoSheetId, startRowIndex: 12, endRowIndex: 14, startColumnIndex: 0, endColumnIndex: 4 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.91, green: 0.96, blue: 0.93 }, textFormat: { bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
      { repeatCell: { range: { sheetId: demoSheetId, startRowIndex: 19, endRowIndex: 22, startColumnIndex: 0, endColumnIndex: 6 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.66, green: 0.82, blue: 0.56 }, textFormat: { bold: true }, horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)" } },
      { autoResizeDimensions: { dimensions: { sheetId: demoSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 10 } } },
    );
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  console.log(JSON.stringify({
    spreadsheetId,
    demoName,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${demoSheetId}`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
