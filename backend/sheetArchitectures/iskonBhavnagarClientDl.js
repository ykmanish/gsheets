const SHEET_ID = "1VAu70cmbIMpBhtBXEyyyEa4TV9oNWByXRbNDf5GoBmk";
const KIND = "iskon-bhavnagar-client-dl";

const ERROR_VALUE = /^#(?:N\/A|NAME\?|REF!|VALUE!|DIV\/0!|NUM!|NULL!)$/i;

function text(value) {
  const result = String(value ?? "").trim();
  return ERROR_VALUE.test(result) ? "" : result;
}

function uniqueHeaders(values = []) {
  const seen = new Map();
  return values.map((value, index) => {
    const base = text(value) || `Column ${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function usefulRows(rows = []) {
  return rows.filter((row) => row.some((value) => text(value)));
}

function findHeader(values = [], required = []) {
  return values.findIndex((row) => {
    const cells = row.map((value) => text(value).toLowerCase());
    return required.every((pattern) => cells.some((cell) => pattern.test(cell)));
  });
}

function categoryMeta(values = [], name = "") {
  let totalCost = 0;
  let category = name;
  for (const row of values.slice(0, 10)) {
    const detailIndex = row.findIndex((value) => /area details/i.test(text(value)));
    if (detailIndex >= 0) category = text(row[detailIndex + 1]) || category;
    const totalIndex = row.findIndex((value) => /total cost/i.test(text(value)));
    if (totalIndex >= 0) {
      const amount = Number(String(row[totalIndex + 1] ?? "").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(amount)) totalCost = amount;
    }
  }
  return { role: "category-detail", category, totalCost };
}

function prepareSheet(name, values = []) {
  if (/data segregation room and catog/i.test(name)) {
    return {
      headers: ["Room", "Room Items", "Room U&I Cost", "Room 30% Amount", "Room Actual Client Amount", "Spacer 1", "Spacer 2", "Category", "Category Items", "Category U&I Cost", "Remarks", "Category 30% Amount", "Category Actual Amount"],
      rows: usefulRows(values.slice(1)),
      firstDataRow: 2,
      meta: { role: "pricing-control" },
    };
  }

  if (/^summary$/i.test(name)) {
    const rows = [];
    values.forEach((row, index) => {
      const budgetIndex = row.findIndex((value) => /project budget summary/i.test(text(value)));
      if (budgetIndex >= 0) rows.push(["Project", "Project budget", row[budgetIndex + 1] ?? "", ""]);
      const label = text(row[1]);
      const amount = row[7];
      if (index > 10 && label && !/^(area|interior budget|add on)/i.test(label) && text(amount)) rows.push(["Interior budget", label, amount, ""]);
      if (index > 30 && label && !/^area$/i.test(label)) rows.push(["Add-on", label, amount ?? "", ""]);
    });
    return { headers: ["Section", "Label", "Amount", "Notes"], rows, firstDataRow: 1, meta: { role: "executive-summary" } };
  }

  const headerIndex = findHeader(values, [/category/, /room/, /qty/, /unit/]);
  if (headerIndex >= 0) {
    const isMaster = /^import range$/i.test(name);
    return {
      headers: uniqueHeaders(values[headerIndex]),
      rows: usefulRows(values.slice(headerIndex + 1)),
      firstDataRow: headerIndex + 2,
      meta: isMaster
        ? { role: "master-detail" }
        : /data segregation catogory wise/i.test(name)
        ? { role: "supporting-matrix" }
        : categoryMeta(values, name),
    };
  }

  const firstUseful = values.findIndex((row) => row.filter((value) => text(value)).length >= 2);
  const fallback = firstUseful >= 0 ? firstUseful : 0;
  return {
    headers: uniqueHeaders(values[fallback] || []),
    rows: usefulRows(values.slice(fallback + 1)),
    firstDataRow: fallback + 2,
    meta: { role: /specification/i.test(name) ? "reference" : /index/i.test(name) ? "index" : "supporting" },
  };
}

function matches({ doc = {} }) {
  return doc.sheetId === SHEET_ID;
}

function apply(architecture, sheetData = []) {
  const metaByTab = new Map(sheetData.map((sheet) => [sheet.name, sheet.meta || {}]));
  return {
    ...architecture,
    kind: KIND,
    displayName: "Iskon Bhavnagar Client DL",
    summary: {
      ...architecture.summary,
      purpose: "Give leadership a category-led view of Iskon Bhavnagar scope, U&I cost, client pricing, markup variance, room exposure, and detailed specifications.",
      recordName: "Category design line item",
      suggestedViews: ["executive-overview", "pricing-control", "category-costs", "room-costs", "category-detail"],
    },
    tabs: architecture.tabs.map((tab) => ({
      ...tab,
      role: metaByTab.get(tab.name)?.role || "supporting",
      meta: metaByTab.get(tab.name) || {},
      primaryLabel: tab.headers.find((header) => /particular|sub-category|label|category/i.test(header)) || tab.primaryLabel,
      keyMetrics: tab.headers.filter((header) => /amount|cost|qty/i.test(header)).slice(0, 6),
      segmentColumns: tab.headers.filter((header) => /room|category|unit|section/i.test(header)).slice(0, 6),
      workflowColumns: tab.headers.filter((header) => /remarks/i.test(header)),
    })),
  };
}

module.exports = { KIND, SHEET_ID, matches, apply, prepareSheet };
