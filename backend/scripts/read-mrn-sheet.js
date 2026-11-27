// Read-only utility: reads the currently-linked MRN Google Sheet directly, using the
// backend's own service-account credential (backend/.env -> GOOGLE_SERVICE_ACCOUNT_KEY)
// and the real linked spreadsheet id (backend/data/mrn-settings.json), NOT the stale
// hardcoded default in server.js. Outputs clean JSON on stdout for scripts/agents to parse.
// Usage: node backend/scripts/read-mrn-sheet.js [--after=<rowNumber>]
const path = require("path");
const fs = require("fs");
const dns = require("dns");

// This machine's Node/undici fetch (used internally by googleapis) fails to reach
// Google's APIs over IPv6; forcing IPv4-first DNS resolution fixes it. Set here so
// every invocation works regardless of how the script is launched.
dns.setDefaultResultOrder("ipv4first");

const backendDir = path.join(__dirname, "..");
require(path.join(backendDir, "node_modules", "dotenv")).config({ path: path.join(backendDir, ".env") });
const { google } = require(path.join(backendDir, "node_modules", "googleapis"));

const SHEET_NAME = "MRN Form";

function normalizeHeaderKey(header) {
  return String(header || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mapRows(values) {
  const rawHeaders = values[0] || [];
  const headerMap = new Map();
  rawHeaders.forEach((header, index) => {
    const key = normalizeHeaderKey(header);
    if (!key) return;
    if (!headerMap.has(key)) headerMap.set(key, []);
    headerMap.get(key).push(index);
  });
  const valueAt = (row, names) => {
    for (const name of names) {
      const indices = headerMap.get(normalizeHeaderKey(name)) || [];
      for (const index of indices) {
        const value = String(row[index] || "").trim();
        if (value) return value;
      }
    }
    return "";
  };
  const records = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    const mrnNo = valueAt(row, ["MRN No"]);
    const timestamp = valueAt(row, ["Timestamp"]);
    const project = valueAt(row, ["PROJECT NAME", "Name of Project & Site Address", "Project Name", "Project / Site", "Project Site"]);
    const material = valueAt(row, ["Material Requirement"]);
    if (!mrnNo && !timestamp && !project && !material) continue;
    records.push({
      rowNumber: rowIndex + 1,
      mrnNo: mrnNo || `MRN${String(rowIndex).padStart(2, "0")}`,
      timestamp,
      project,
      materialRequestDate: valueAt(row, ["Material Request Date"]),
      requiredDate: valueAt(row, ["By when Material is Required"]),
      materialRequirement: material,
      issuedBy: valueAt(row, ["Issued by", "Issued by "]),
      leadTime: valueAt(row, ["Lead Time (Usual time to get Material )", "Lead Time"]),
      category: valueAt(row, ["Category", "Catagory"]),
      assignTo: valueAt(row, ["Assign To"]),
      status: valueAt(row, ["Status"]),
      vendorName: valueAt(row, ["Vendor Name"]),
      remark: valueAt(row, ["Remark"]),
    });
  }
  return records;
}

async function main() {
  const afterArg = process.argv.find((arg) => arg.startsWith("--after="));
  const afterRow = afterArg ? Number(afterArg.split("=")[1]) || 0 : 0;

  const mrnSettingsPath = path.join(backendDir, "data", "mrn-settings.json");
  const linkedSettings = fs.existsSync(mrnSettingsPath) ? JSON.parse(fs.readFileSync(mrnSettingsPath, "utf8")) : {};
  const spreadsheetId = linkedSettings.spreadsheetId || process.env.MRN_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("No MRN spreadsheet linked (backend/data/mrn-settings.json missing spreadsheetId)");

  const keyPath = path.isAbsolute(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    : path.join(backendDir, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const credentials = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A1:Z10000`,
  });
  const allRecords = mapRows(response.data.values || []);
  const records = afterRow ? allRecords.filter((r) => r.rowNumber > afterRow) : allRecords;
  const maxRowNumber = allRecords.reduce((max, r) => Math.max(max, r.rowNumber), 0);

  console.log(JSON.stringify({ spreadsheetId, totalRecords: allRecords.length, maxRowNumber, records }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});
