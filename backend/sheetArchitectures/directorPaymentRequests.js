const SHEET_ID = "1akL_lq7STmvFwQE8k8VlBO33WzS6ARv1Evaq8YCQE3s";
const KIND = "director-payment-requests";

function normalize(header) {
  return String(header || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hasDirectorPaymentHeaders(headers = []) {
  const normalized = headers.map(normalize);
  return [
    "timestamp",
    "requested by",
    "expense type",
    "amount",
    "mode of payment",
    "remarks",
  ].every((header) => normalized.includes(header));
}

function matches({ doc = {}, sheetData = [] }) {
  if (doc.sheetId === SHEET_ID) return true;
  return sheetData.some((sheet) => hasDirectorPaymentHeaders(sheet.headers));
}

function apply(architecture) {
  const dashboard = (architecture.dashboard || []).map((item) => {
    if (!hasDirectorPaymentHeaders(architecture.tabs.find((tab) => tab.name === item.tab)?.headers)) return item;
    return {
      ...item,
      dateColumn: "Timestamp",
      entityColumn: "Expense Type",
      ownerColumn: "Requested By",
      mediaColumns: [],
      metricColumns: ["Amount"],
      statusColumns: ["Mode of Payment"],
      narrativeColumns: ["Remarks", "Email address"],
      cardTitle: "Expense Type",
      cardSubtitle: "Remarks",
      detailFields: ["Requested By", "Expense Type", "Amount", "Mode of Payment", "Remarks", "Email address"],
      chartFields: ["Expense Type", "Requested By", "Mode of Payment", "Amount"],
    };
  });

  const tabs = (architecture.tabs || []).map((tab) => {
    if (!hasDirectorPaymentHeaders(tab.headers)) return tab;
    return {
      ...tab,
      primaryLabel: "Expense Type",
      keyMetrics: ["Amount"],
      workflowColumns: ["Mode of Payment"],
      segmentColumns: ["Requested By", "Expense Type", "Mode of Payment"],
    };
  });

  return {
    ...architecture,
    kind: KIND,
    displayName: "Director Payment Requests",
    summary: {
      ...architecture.summary,
      purpose: "Track director payment requests by requester, expense type, amount, payment mode, and remarks.",
      recordName: "Director payment request",
      suggestedViews: ["payment-overview", "expense-types", "requesters", "records"],
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
