const SHEET_ID = "1pGNHbnN1E-m63Is6d5uKBs7yi4Bz8R2L9ikdO3oFu0Y";
const KIND = "sheetal-client-dl";

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

function findHeaderRow(values = [], patterns = []) {
  return values.findIndex((row) => {
    const cells = row.map((value) => text(value).toLowerCase());
    return patterns.every((pattern) => cells.some((cell) => pattern.test(cell)));
  });
}

function roomMeta(values = []) {
  let title = "";
  let totalAmount = 0;
  for (let rowIndex = 0; rowIndex < Math.min(values.length, 12); rowIndex += 1) {
    const row = values[rowIndex] || [];
    const totalIndex = row.findIndex((value) => /total amount/i.test(text(value)));
    if (totalIndex >= 0) {
      title = text(row[Math.max(0, totalIndex - 2)]) || title;
      for (let next = rowIndex + 1; next < Math.min(values.length, rowIndex + 7); next += 1) {
        const amount = Number(String(values[next]?.[totalIndex] ?? "").replace(/[^0-9.-]/g, ""));
        if (Number.isFinite(amount) && amount) {
          totalAmount = amount;
          break;
        }
      }
      break;
    }
  }
  return { role: "room", title, totalAmount };
}

function prepareSheet(name, values = []) {
  if (/summary/i.test(name) && !/pmt/i.test(name)) {
    const rows = [];
    values.forEach((row, index) => {
      const compact = row.map(text);
      const budgetLabelIndex = compact.findIndex((value) => /project budget summary/i.test(value));
      if (budgetLabelIndex >= 0) {
        const amount = row.slice(budgetLabelIndex + 1).map((value) => Number(String(value ?? "").replace(/[^0-9.-]/g, ""))).find((value) => Number.isFinite(value) && value);
        rows.push(["Project", "Project budget", amount || "", ""]);
      }
      
      const area = text(row[0]);
      const amount = row[1];
      
      // Look for standard summary blocks
      if (area && amount && !/^category$/i.test(area) && Number.isFinite(Number(String(amount).replace(/[^0-9.-]/g, "")))) {
        rows.push(["Interior budget", area, amount, ""]);
      } else if (text(row[2]) && text(row[8])) {
        // Fallback to Asteria style summary format
        const altArea = text(row[2]);
        const altAmount = row[8];
        if (index > 10 && altArea && !/^area$/i.test(altArea) && text(altAmount)) rows.push(["Interior budget", altArea, altAmount, ""]);
      }
    });
    return { headers: ["Section", "Label", "Amount", "Notes"], rows, firstDataRow: 1, meta: { role: "executive-summary" } };
  }

  if (/data segregation room and catogory/i.test(name) || /data/i.test(name)) {
    return {
      headers: ["No.", "Category", "Items", "U&I Cost", "Markup %", "Client Amount", "Spacer", "Area", "Area U&I Cost", "Old Client DL", "Old Amount", "Revised Area", "Revised Amount"],
      rows: usefulRows(values.slice(2)),
      firstDataRow: 3,
      meta: { role: "cost-analysis" },
    };
  }

  if (/sheet33|purchase|pmt summary/i.test(name)) {
    let section = "Portfolio";
    const rows = [];
    values.forEach((row) => {
      const label = text(row[0]);
      if (!label) return;
      if (/^(china|quatation|indial dl)/i.test(label)) {
        section = label;
        return;
      }
      if (/amount|actual finalized/i.test(label)) return;
      rows.push([section, label, row[1] ?? "", row[2] ?? "", row[3] ?? "", row[4] ?? ""]);
    });
    return { headers: ["Section", "Category / Vendor", "DL Amount", "Finalized", "Paid", "Due"], rows, firstDataRow: 1, meta: { role: "financial-control" } };
  }

  if (/working for client/i.test(name)) {
    const rows = usefulRows(values).map((row) => [text(row[0]), text(row[1]) || text(row[4]), row[2] ?? "", text(row[4])]);
    return { headers: ["No.", "Decision / Scope Item", "Amount", "Alternative"], rows, firstDataRow: 1, meta: { role: "scope-decisions" } };
  }

  const headerRowIndex = findHeaderRow(values, [/particular/, /qty/, /unit/]);
  if (headerRowIndex >= 0) {
    const headers = uniqueHeaders(values[headerRowIndex]);
    if (!headers.some((h) => /amount/i.test(h)) && (values[headerRowIndex + 1]?.length > headers.length)) {
      headers.push("Amount");
    }
    return {
      headers,
      rows: usefulRows(values.slice(headerRowIndex + 1)),
      firstDataRow: headerRowIndex + 2,
      meta: roomMeta(values),
    };
  }

  const firstUseful = values.findIndex((row) => row.filter((value) => text(value)).length >= 2);
  const headerIndex = firstUseful >= 0 ? firstUseful : 0;
  return {
    headers: uniqueHeaders(values[headerIndex] || []),
    rows: usefulRows(values.slice(headerIndex + 1)),
    firstDataRow: headerIndex + 2,
    meta: { role: /specification/i.test(name) ? "reference" : "supporting" },
  };
}

function matches({ doc = {} }) {
  return doc.sheetId === SHEET_ID;
}

function apply(architecture, sheetData = []) {
  const metaByTab = new Map(sheetData.map((sheet) => [sheet.name, sheet.meta || {}]));
  const tabs = architecture.tabs.map((tab) => ({
    ...tab,
    role: metaByTab.get(tab.name)?.role || "supporting",
    meta: metaByTab.get(tab.name) || {},
    primaryLabel: tab.headers.find((header) => /particular|category \/ vendor|decision|label/i.test(header)) || tab.primaryLabel,
    keyMetrics: tab.headers.filter((header) => /amount|cost|paid|due|qty/i.test(header)).slice(0, 6),
    segmentColumns: tab.headers.filter((header) => /area|room|category|section|unit/i.test(header)).slice(0, 6),
    workflowColumns: [],
  }));

  return {
    ...architecture,
    kind: KIND,
    displayName: "Sheetal Gharana Client Design & Cost Dashboard",
    summary: {
      ...architecture.summary,
      purpose: "Give leadership one view of the Sheetal Gharana design estimate, room and category costs, financial commitments, and scope decisions.",
      recordName: "Design line item",
      suggestedViews: ["executive-overview", "room-costs", "category-costs", "financial-control", "scope-decisions"],
    },
    tabs,
  };
}

module.exports = { KIND, SHEET_ID, matches, apply, prepareSheet };
