const XLSX = require("xlsx");
const KIND = "kalhaarPendingWorkDl";
const SHEET_ID = "1YcFUaOMnWk4HpYEF3VNIvruwR5f0PBNJ";

// Tabs to skip – these are empty templates
const SKIP_TABS = new Set(["Sheet1", "Sheet1 (2)", "Sheet1 (3)", "Formate"]);

// Stage column letters (in the raw Excel, col F-K after the header row)
// After we slice off col A, they become indices 4-9 in our 0-based offset array
const STAGE_NAMES = ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit"];
const STAGE_OFFSET_INDICES = [4, 5, 6, 7, 8, 9]; // indices in the offset row (after removing col A)

const STANDARD_HEADERS = [
  "Sr. No.",
  "Floor",
  "Room / Area",
  "Activity",
  "Design",
  "Approval",
  "Selection",
  "Procurement",
  "Execution",
  "Audit",
  "Site Supervisor",
  "Agency",
  "REMARK",
  "Start Date",
  "End Date",
  "Duration (Days)",
  "Remarks",
];

// Color mapping: cell background color → status label
function colorToStatus(rgb) {
  if (!rgb) return "";
  const c = rgb.toUpperCase();
  // Red variants
  if (c === "FF0000" || c === "FFFF0000") return "Pending";
  // Bright green
  if (c === "00B050" || c === "FF00B050") return "Done";
  // Light green
  if (c === "A9D18E" || c === "FFA9D18E") return "In Progress";
  // Very light green
  if (c === "C5E0B4" || c === "FFC5E0B4") return "Started";
  // Yellow
  if (c === "FFFF00" || c === "FFFFFF00" || c === "FFC000" || c === "FFFFC000") return "On Hold";
  return "";
}

// Excel column number (1-based) to letter
function colLetter(n) {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

const TAB_CONFIG_DEFAULT = {
  primaryLabel: "Activity",
  keyMetrics: ["Duration (Days)"],
  workflowColumns: ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit"],
  segmentColumns: ["Floor", "Room / Area", "Agency", "Site Supervisor"],
  dashboard: {
    dateColumn: "Start Date",
    entityColumn: "Agency",
    ownerColumn: "Site Supervisor",
    metricColumns: ["Duration (Days)"],
    statusColumns: ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit"],
    narrativeColumns: ["Activity", "REMARK", "Floor", "Room / Area", "Remarks"],
    cardTitle: "Activity",
    cardSubtitle: "Room / Area",
    detailFields: [
      "Floor", "Room / Area", "Activity", "Agency", "Site Supervisor",
      "Design", "Approval", "Selection", "Procurement", "Execution", "Audit",
      "REMARK", "Start Date", "End Date", "Duration (Days)", "Remarks",
    ],
    chartFields: ["Agency", "Site Supervisor", "Floor"],
  },
};

function compact(values = []) {
  return values.map((v) => String(v ?? "").trim()).filter(Boolean);
}

/**
 * Custom prepareSheet that receives the raw xlsx sheet object (with cell styles)
 * instead of just values. If `rawSheet` is provided, we read cell colors from it.
 */
function prepareSheet(name, values = [], rawSheet = null) {
  if (SKIP_TABS.has(name.trim())) {
    return { headers: [], rows: [], firstDataRow: 0 };
  }

  // Find header row – look for a row containing "Room" and "Activity"
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(10, values.length); i++) {
    const row = values[i] || [];
    const joined = compact(row).join(" ").toLowerCase();
    if (joined.includes("room") && joined.includes("activity")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { headers: [], rows: [], firstDataRow: 0 };
  }

  // Build header array — use the raw header names with fallback to standard
  const rawHeaders = values[headerRowIndex] || [];
  const offsetHeaders = rawHeaders.slice(1); // skip empty col A
  const headers = STANDARD_HEADERS.map((std, i) => {
    const raw = String(offsetHeaders[i] ?? "").trim();
    return raw || std;
  });

  // Data rows — also shift left by 1 to align with headers
  const dataRows = [];
  for (let rowIdx = headerRowIndex + 1; rowIdx < values.length; rowIdx++) {
    const rawRow = values[rowIdx] || [];
    const offsetRow = rawRow.slice(1); // skip col A
    if (compact(offsetRow).length === 0) continue;

    // Build the row values array
    const rowValues = [];
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      let val = offsetRow[colIdx] !== undefined ? offsetRow[colIdx] : "";

      // For stage columns (Design through Audit), inject status from cell color
      if (rawSheet && STAGE_OFFSET_INDICES.includes(colIdx)) {
        const excelRow = rowIdx + 1; // xlsx is 1-based
        const excelCol = colIdx + 2; // +1 for col A skip, +1 for 1-based
        const cellRef = colLetter(excelCol) + excelRow;
        const cell = rawSheet[cellRef];
        if (cell && cell.s && cell.s.fgColor) {
          const rgb = cell.s.fgColor.rgb || "";
          const status = colorToStatus(rgb);
          if (status) val = status;
        }
      }

      rowValues.push(val);
    }

    dataRows.push(rowValues);
  }

  return {
    headers,
    rows: dataRows,
    firstDataRow: headerRowIndex + 2,
  };
}

function matches({ doc = {}, sheetData = [] }) {
  if (doc.sheetId === SHEET_ID) return true;
  const names = new Set(sheetData.map((s) => s.name));
  const expected = ["Carpenter", "POP", "Paint", "Stone", "Tiles", "Plumbing", "electrician"];
  return expected.filter((n) => names.has(n)).length >= 5;
}

function apply(architecture) {
  const tabs = (architecture.tabs || []).map((tab) => ({
    ...tab,
    ...(SKIP_TABS.has(tab.name) ? {} : TAB_CONFIG_DEFAULT),
  }));
  const dashboard = (architecture.dashboard || []).map((item) => ({
    ...item,
    ...(SKIP_TABS.has(item.tab) ? {} : TAB_CONFIG_DEFAULT.dashboard),
  }));
  return {
    ...architecture,
    kind: KIND,
    displayName: "Kalhaar Pending Work Tracker",
    summary: {
      ...architecture.summary,
      purpose:
        "Track all pending balance construction activities at the Kalhaar project site across trades (Carpenter, POP, Paint, Stone, Tiles, Plumbing, Electrical, Polish, Window, Glass, Furniture), with agency assignments, workflow stage tracking via color-coded statuses, and scheduling details.",
      recordName: "Pending work item",
      suggestedViews: ["portfolio-overview", "trade-breakdown", "agency-summary"],
    },
    tabs,
    dashboard,
  };
}

module.exports = { KIND, SHEET_ID, matches, apply, prepareSheet };
