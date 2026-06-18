const SHEET_ID = "1i0OQDvkZf6TyiLxKehAL98v16TWgsnF8";
const KIND = "kalhaar-pending-tracker";

const TAB_CONFIG = {
  Dashboard: {
    primaryLabel: "Metric",
    keyMetrics: ["Value", "Pending Items", "Items"],
    workflowColumns: [],
    segmentColumns: ["Trade", "Agency"],
    dashboard: {
      entityColumn: "Trade",
      ownerColumn: "Agency",
      metricColumns: ["Value", "Pending Items", "Items"],
      statusColumns: [],
      narrativeColumns: ["Metric"],
      cardTitle: "Metric",
      cardSubtitle: "Trade",
      detailFields: ["Metric", "Value", "Trade", "Pending Items", "Agency", "Items"],
      chartFields: ["Trade", "Pending Items", "Agency", "Items"],
    },
  },
  "All Tasks": {
    primaryLabel: "Activity",
    keyMetrics: ["Duration"],
    workflowColumns: ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit", "Pending Stages"],
    segmentColumns: ["Trade", "Agency", "Supervisor / Design Owner", "Floor", "Room / Area"],
    dashboard: {
      dateColumn: "Start Date",
      entityColumn: "Trade",
      ownerColumn: "Agency",
      metricColumns: ["Duration"],
      statusColumns: ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit", "Pending Stages"],
      narrativeColumns: ["Activity", "Remark", "Floor", "Room / Area"],
      cardTitle: "Activity",
      cardSubtitle: "Room / Area",
      detailFields: ["Trade", "Agency", "Supervisor / Design Owner", "Floor", "Room / Area", "Activity", "Remark", "Start Date", "End Date", "Duration", "Pending Stages", "Design", "Approval", "Selection", "Procurement", "Execution", "Audit", "Source File", "Source Ref"],
      chartFields: ["Trade", "Agency", "Pending Stages", "Duration"],
    },
  },
  "Agency Summary": {
    primaryLabel: "Agency",
    keyMetrics: ["Total Items", "Design Pending", "Approval Pending", "Selection Pending", "Procurement Pending", "Execution Pending", "Audit Pending"],
    workflowColumns: ["Design Pending", "Approval Pending", "Selection Pending", "Procurement Pending", "Execution Pending", "Audit Pending"],
    segmentColumns: ["Agency", "Supervisor", "Trade(s)"],
    dashboard: {
      entityColumn: "Agency",
      ownerColumn: "Supervisor",
      metricColumns: ["Total Items", "Design Pending", "Approval Pending", "Selection Pending", "Procurement Pending", "Execution Pending", "Audit Pending"],
      statusColumns: [],
      narrativeColumns: ["Trade(s)", "Immediate Focus / First 5 Activities"],
      cardTitle: "Agency",
      cardSubtitle: "Trade(s)",
      detailFields: ["Agency", "Supervisor", "Trade(s)", "Total Items", "Design Pending", "Approval Pending", "Selection Pending", "Procurement Pending", "Execution Pending", "Audit Pending", "Immediate Focus / First 5 Activities"],
      chartFields: ["Agency", "Total Items", "Design Pending", "Selection Pending", "Procurement Pending", "Execution Pending"],
    },
  },
  "Agency Detail": {
    primaryLabel: "Activity",
    keyMetrics: [],
    workflowColumns: ["Pending Stages"],
    segmentColumns: ["Agency", "Trade", "Supervisor", "Floor", "Room / Area"],
    dashboard: {
      dateColumn: "Start Date",
      entityColumn: "Agency",
      ownerColumn: "Supervisor",
      metricColumns: [],
      statusColumns: ["Pending Stages"],
      narrativeColumns: ["Activity", "Remark", "Trade", "Floor", "Room / Area"],
      cardTitle: "Activity",
      cardSubtitle: "Agency",
      detailFields: ["Agency", "Trade", "Supervisor", "Floor", "Room / Area", "Activity", "Remark", "Pending Stages", "Start Date", "End Date", "Source File"],
      chartFields: ["Agency", "Trade", "Supervisor", "Pending Stages"],
    },
  },
  "Design Pending": {
    primaryLabel: "Activity",
    keyMetrics: [],
    workflowColumns: ["Design Decision Needed"],
    segmentColumns: ["Design Owner / Supervisor", "Trade", "Agency", "Floor", "Room / Area"],
    dashboard: {
      dateColumn: "Start Date",
      entityColumn: "Trade",
      ownerColumn: "Design Owner / Supervisor",
      metricColumns: [],
      statusColumns: ["Design Decision Needed"],
      narrativeColumns: ["Activity", "Remark", "Floor", "Room / Area"],
      cardTitle: "Activity",
      cardSubtitle: "Design Decision Needed",
      detailFields: ["Design Owner / Supervisor", "Trade", "Agency", "Floor", "Room / Area", "Activity", "Remark", "Design Decision Needed", "Start Date", "End Date", "Source File"],
      chartFields: ["Design Owner / Supervisor", "Trade", "Agency"],
    },
  },
  "Selection Procurement": {
    primaryLabel: "Activity",
    keyMetrics: [],
    workflowColumns: ["Priority", "Stage Needed"],
    segmentColumns: ["Priority", "Trade", "Agency", "Supervisor", "Material/Product Category"],
    dashboard: {
      dateColumn: "Start Date",
      entityColumn: "Trade",
      ownerColumn: "Agency",
      metricColumns: [],
      statusColumns: ["Priority", "Stage Needed"],
      narrativeColumns: ["Activity", "Material/Product Category", "Remark", "Floor", "Room / Area"],
      cardTitle: "Activity",
      cardSubtitle: "Material/Product Category",
      detailFields: ["Priority", "Trade", "Agency", "Supervisor", "Floor", "Room / Area", "Activity", "Material/Product Category", "Stage Needed", "Remark", "Start Date", "End Date", "Source File"],
      chartFields: ["Priority", "Trade", "Agency", "Stage Needed"],
    },
  },
  "Purchase Priority": {
    primaryLabel: "Material/Product",
    keyMetrics: ["Linked Activities"],
    workflowColumns: ["Priority", "Action"],
    segmentColumns: ["Priority", "Trade", "Agency"],
    dashboard: {
      entityColumn: "Trade",
      ownerColumn: "Agency",
      metricColumns: ["Linked Activities"],
      statusColumns: ["Priority", "Action"],
      narrativeColumns: ["Material/Product", "Rooms / Areas", "Remarks / Notes"],
      cardTitle: "Material/Product",
      cardSubtitle: "Action",
      detailFields: ["Priority", "Material/Product", "Trade", "Agency", "Linked Activities", "Rooms / Areas", "Action", "Remarks / Notes"],
      chartFields: ["Priority", "Trade", "Agency", "Linked Activities"],
    },
  },
};

function compact(values = []) {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean);
}

function prepareSheet(name, values = []) {
  if (name === "Dashboard") {
    const summaryRow = values[2] || [];
    const rows = [
      [summaryRow[0] ?? "", summaryRow[1] ?? "", "", "", "", ""],
      ...values.slice(3).map((row) => [row[0] ?? "", row[1] ?? "", row[3] ?? "", row[4] ?? "", row[6] ?? "", row[7] ?? ""]),
    ];
    return {
      headers: ["Metric", "Value", "Trade", "Pending Items", "Agency", "Items"],
      rows: rows.filter((row) => compact(row).length > 0),
      firstDataRow: 3,
    };
  }

  const headerRowIndex = values.findIndex((row) => {
    const cells = compact(row).map((value) => value.toLowerCase());
    return cells.length >= 3 && (cells.includes("activity") || cells.includes("agency") || cells.includes("priority"));
  });
  const index = headerRowIndex >= 0 ? headerRowIndex : 0;
  return {
    headers: (values[index] || []).map((value) => String(value ?? "").trim()),
    rows: values.slice(index + 1),
    firstDataRow: index + 2,
  };
}

function matches({ doc = {}, sheetData = [] }) {
  if (doc.sheetId === SHEET_ID) return true;
  const names = new Set(sheetData.map((sheet) => sheet.name));
  return ["All Tasks", "Agency Summary", "Design Pending", "Selection Procurement", "Purchase Priority"].every((name) => names.has(name));
}

function apply(architecture) {
  const tabs = (architecture.tabs || []).map((tab) => ({ ...tab, ...(TAB_CONFIG[tab.name] || {}) }));
  const dashboard = (architecture.dashboard || []).map((item) => ({ ...item, ...(TAB_CONFIG[item.tab]?.dashboard || {}) }));
  return {
    ...architecture,
    kind: KIND,
    displayName: "Kalhaar Consolidated Pending Tracker",
    summary: {
      ...architecture.summary,
      purpose: "Track consolidated construction and interior activities across design, approval, selection, procurement, execution, and audit, with agency, trade, owner, and purchasing priority views.",
      recordName: "Pending activity",
      suggestedViews: ["portfolio-overview", "all-tasks", "agency-summary", "design-pending", "selection-procurement", "purchase-priority"],
    },
    tabs,
    dashboard,
  };
}

module.exports = { KIND, SHEET_ID, matches, apply, prepareSheet };
