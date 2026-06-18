const SHEET_ID = "14LOkdOa2NZM3jrjfAxbZmsTA-VmKNMG-C8FbgKcWgfs";
const KIND = "asset-purchase-requests";

function normalize(header) {
  return String(header || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hasAssetHeaders(headers = []) {
  const normalized = headers.map(normalize);
  return [
    "timestamp",
    "employee name",
    "asset category",
    "asset name / description",
    "qty",
    "amount",
    "mode of payment",
  ].every((header) => normalized.includes(header));
}

function matches({ doc = {}, sheetData = [] }) {
  if (doc.sheetId === SHEET_ID) return true;
  return sheetData.some((sheet) => hasAssetHeaders(sheet.headers));
}

function apply(architecture) {
  const dashboard = (architecture.dashboard || []).map((item) => {
    if (!hasAssetHeaders(architecture.tabs.find((tab) => tab.name === item.tab)?.headers)) return item;
    return {
      ...item,
      dateColumn: "Timestamp",
      entityColumn: "Asset Category",
      ownerColumn: "Employee Name",
      mediaColumns: ["Invoice and Warranty card"],
      metricColumns: ["Amount", "Purchase Amt"],
      statusColumns: ["Status", "Mode of Payment"],
      narrativeColumns: [
        "Asset Name / Description",
        "Purpose / Requirement",
        "Location",
        "Vendor Name and Address",
        "warranty and guarantee Details",
      ],
      cardTitle: "Asset Name / Description",
      cardSubtitle: "Employee Name",
      detailFields: [
        "Employee Name",
        "Asset Category",
        "QTY",
        "Purpose / Requirement",
        "Location",
        "Vendor Name and Address",
        "Amount",
        "Mode of Payment",
        "Status",
        "Purchased Date",
        "Purchase Amt",
      ],
      chartFields: ["Asset Category", "Employee Name", "Mode of Payment", "Status", "Amount", "Purchase Amt"],
    };
  });

  const tabs = (architecture.tabs || []).map((tab) => {
    if (!hasAssetHeaders(tab.headers)) return tab;
    return {
      ...tab,
      primaryLabel: "Asset Name / Description",
      keyMetrics: ["Amount", "Purchase Amt"],
      workflowColumns: ["Status", "Mode of Payment"],
      segmentColumns: ["Asset Category", "Employee Name", "Location", "Mode of Payment", "Status"],
    };
  });

  return {
    ...architecture,
    kind: KIND,
    displayName: "Asset Purchase Requests",
    summary: {
      ...architecture.summary,
      purpose: "Track asset purchase requests, requested assets, quantities, locations, vendors, warranty/invoice documents, status, and purchase amounts.",
      recordName: "Asset purchase request",
      suggestedViews: ["asset-overview", "purchase-status", "vendors", "records"],
    },
    tabs,
    dashboard,
  };
}

module.exports = {
  KIND,
  SHEET_ID,
  matches,
  apply,
};
