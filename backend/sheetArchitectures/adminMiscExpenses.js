const SHEET_ID = "1Wc_OYc1QUYxcNnEuw2vXWZPL6uh4ea59Wbr8erBgrrM";
const KIND = "admin-misc-expenses";

function hasExpenseHeaders(headers = []) {
  const normalized = headers.map((header) => String(header).trim().toLowerCase());
  return [
    "timestamp",
    "department",
    "expense category",
    "type of request",
    "amount",
  ].every((header) => normalized.includes(header));
}

function matches({ doc = {}, sheetData = [] }) {
  if (doc.sheetId === SHEET_ID) return true;
  return sheetData.some((sheet) => hasExpenseHeaders(sheet.headers));
}

function apply(architecture) {
  const dashboard = (architecture.dashboard || []).map((item) => {
    if (!hasExpenseHeaders(architecture.tabs.find((tab) => tab.name === item.tab)?.headers)) return item;
    return {
      ...item,
      dateColumn: "Timestamp",
      entityColumn: "Expense Category",
      ownerColumn: "Column 2",
      mediaColumns: ["Invoice and other supportive Documents"],
      metricColumns: ["Amount"],
      statusColumns: ["Type of Request", "Mode of Payment"],
      narrativeColumns: ["Description", "Vendor Name", "Department"],
      cardTitle: "Expense Category",
      cardSubtitle: "Description",
      detailFields: [
        "Column 2",
        "Department",
        "Type of Request",
        "Mode of Payment",
        "Amount",
        "Vendor Name",
        "Description",
      ],
      chartFields: ["Expense Category", "Type of Request", "Department", "Mode of Payment", "Amount"],
    };
  });

  const tabs = (architecture.tabs || []).map((tab) => {
    if (!hasExpenseHeaders(tab.headers)) return tab;
    return {
      ...tab,
      primaryLabel: "Expense Category",
      keyMetrics: ["Amount"],
      workflowColumns: ["Type of Request", "Mode of Payment"],
      segmentColumns: ["Department", "Expense Category", "Type of Request", "Mode of Payment", "Column 2"],
    };
  });

  return {
    ...architecture,
    kind: KIND,
    displayName: "Admin & Misc Expense Requests",
    summary: {
      ...architecture.summary,
      purpose: "Track admin and miscellaneous expense payment requests, reimbursement/advance types, vendors, amounts, and supporting invoices.",
      recordName: "Expense request",
      suggestedViews: ["expense-overview", "payments", "attachments", "records"],
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
