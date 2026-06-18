const SHEET_ID = "1ueqDLa6WUN_1Fae44eo_QgrS4Rx-2AhdrbmYVXhcv1M";
const KIND = "project-payment-requests";

function normalize(header) {
  return String(header || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hasProjectPaymentHeaders(headers = []) {
  const normalized = headers.map(normalize);
  return [
    "timestamp",
    "vendor name",
    "project/site name",
    "type of payment",
    "amount",
    "approved",
    "payment",
  ].every((header) => normalized.includes(header));
}

function matches({ doc = {}, sheetData = [] }) {
  if (doc.sheetId === SHEET_ID) return true;
  return sheetData.some((sheet) => hasProjectPaymentHeaders(sheet.headers));
}

function apply(architecture) {
  const dashboard = (architecture.dashboard || []).map((item) => {
    if (!hasProjectPaymentHeaders(architecture.tabs.find((tab) => tab.name === item.tab)?.headers)) return item;
    return {
      ...item,
      dateColumn: "Timestamp",
      entityColumn: "Project/Site Name",
      ownerColumn: "Name",
      mediaColumns: ["Supportive Documents", "Tax Invoice"],
      metricColumns: ["Amount"],
      statusColumns: ["Approved", "Payment", "Accountant Status", "Print status from Shruti", "Mode of Payment", "Mode of payment"],
      narrativeColumns: ["Remark", "Vendor Name", "Consumption QTY At Project site"],
      cardTitle: "Column 13",
      cardSubtitle: "Vendor Name",
      detailFields: [
        "Column 13",
        "Name",
        "Vendor Name",
        "Project/Site Name",
        "Type of Payment",
        "Amount",
        "Approved",
        "Payment",
        "Accountant Status",
        "Remark",
      ],
      chartFields: ["Project/Site Name", "Type of Payment", "Approved", "Payment", "Amount"],
    };
  });

  const tabs = (architecture.tabs || []).map((tab) => {
    if (!hasProjectPaymentHeaders(tab.headers)) return tab;
    return {
      ...tab,
      primaryLabel: "Column 13",
      keyMetrics: ["Amount"],
      workflowColumns: ["Approved", "Payment", "Accountant Status", "Print status from Shruti"],
      segmentColumns: ["Project/Site Name", "Type of Payment", "Mode of Payment", "Payment", "Approved"],
    };
  });

  return {
    ...architecture,
    kind: KIND,
    displayName: "Project Payment Requests",
    summary: {
      ...architecture.summary,
      purpose: "Track project and site payment requests by PRN, requester, vendor, project/site, payment type, amount, approval status, payment status, and invoices.",
      recordName: "Project payment request",
      suggestedViews: ["project-payment-overview", "approval-status", "payment-status", "vendors", "records"],
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
