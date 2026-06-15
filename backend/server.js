require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Groq = require("groq-sdk");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { pipeline } = require("@xenova/transformers");

const { processDocument, processSheetText } = require("./lib/processDocument");

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
const vectorsDir = path.join(__dirname, "vectors");
const dataDir = path.join(__dirname, "data");

[uploadsDir, vectorsDir, dataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const documentsPath = path.join(dataDir, "documents.json");
const automationsPath = path.join(dataDir, "automations.json");
const reportsPath = path.join(dataDir, "reports.json");
const notificationsPath = path.join(dataDir, "notifications.json");

let documents = [];
let automations = [];
let reports = [];
let notifications = [];
const scheduledAutomationJobs = new Map();

if (fs.existsSync(documentsPath)) {
  try {
    documents = JSON.parse(fs.readFileSync(documentsPath, "utf8"));
    console.log(`Loaded ${documents.length} documents from storage`);
  } catch (error) {
    console.error("Error loading documents:", error);
    documents = [];
  }
}

if (fs.existsSync(automationsPath)) {
  try {
    automations = JSON.parse(fs.readFileSync(automationsPath, "utf8"));
    console.log(`Loaded ${automations.length} automations from storage`);
  } catch (error) {
    console.error("Error loading automations:", error);
    automations = [];
  }
}

if (fs.existsSync(reportsPath)) {
  try {
    reports = JSON.parse(fs.readFileSync(reportsPath, "utf8"));
    console.log(`Loaded ${reports.length} reports from storage`);
  } catch (error) {
    console.error("Error loading reports:", error);
    reports = [];
  }
}

if (fs.existsSync(notificationsPath)) {
  try {
    notifications = JSON.parse(fs.readFileSync(notificationsPath, "utf8"));
  } catch (error) {
    console.error("Error loading notifications:", error);
    notifications = [];
  }
}

function saveDocuments() {
  try {
    fs.writeFileSync(documentsPath, JSON.stringify(documents, null, 2));
  } catch (error) {
    console.error("Error saving documents:", error);
  }
}

function saveAutomations() {
  try {
    fs.writeFileSync(automationsPath, JSON.stringify(automations, null, 2));
  } catch (error) {
    console.error("Error saving automations:", error);
  }
}

function saveReports() {
  try {
    fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
  } catch (error) {
    console.error("Error saving reports:", error);
  }
}

function saveNotifications() {
  try {
    fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));
  } catch (error) {
    console.error("Error saving notifications:", error);
  }
}

const processingStatus = {};
let extractor;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getGoogleAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  }

  const credentials = JSON.parse(
    fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, "utf8")
  );

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

async function fetchSheetText(sheetId) {
  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetNames = meta.data.sheets.map((s) => s.properties.title);

  let fullText = "";

  for (const sheetName of sheetNames) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetName,
    });
    const rows = res.data.values || [];
    fullText += `Sheet: ${sheetName}\n`;
    rows.forEach((row) => {
      fullText += row.join(" | ") + "\n";
    });
    fullText += "\n";
  }

  return fullText;
}

async function fetchSheetRows(sheetId) {
  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetNames = meta.data.sheets.map((s) => s.properties.title);

  const result = [];

  for (const sheetName of sheetNames) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetName,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) continue;

    const headers = rows[0].map((h) => String(h).trim());
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const obj = { __sheetName: sheetName, __rowIndex: i + 1 };
      headers.forEach((header, idx) => {
        obj[header] = row[idx] !== undefined ? row[idx] : "";
      });
      result.push(obj);
    }
  }

  return result;
}

async function fetchSheetDataset(sheetId) {
  const auth = await getGoogleAuth();
  const sheetsApi = google.sheets({ version: "v4", auth });
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: sheetId });
  const result = [];

  for (const sheet of meta.data.sheets || []) {
    const title = sheet.properties.title;
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: title,
    });
    const values = response.data.values || [];
    const headers = (values[0] || []).map((value) => String(value).trim());
    const rows = values.slice(1).map((row, index) => {
      const item = { __sheetName: title, __rowIndex: index + 2 };
      headers.forEach((header, columnIndex) => {
        item[header] = row[columnIndex] !== undefined ? row[columnIndex] : "";
      });
      return item;
    });
    result.push({ name: title, headers, rows });
  }

  return result;
}

async function fetchSheetModifiedTime(sheetId) {
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get({
      fileId: sheetId,
      fields: "modifiedTime",
    });
    return res.data.modifiedTime || null;
  } catch (err) {
    console.warn(`Could not fetch modifiedTime for sheet ${sheetId}:`, err.message);
    return null;
  }
}

async function syncSheet(documentId, sheetId) {
  try {
    console.log(`Syncing sheet ${documentId} (sheetId: ${sheetId})`);
    processingStatus[documentId] = { stage: "Fetching Sheet" };

    const modifiedTime = await fetchSheetModifiedTime(sheetId);
    const text = await fetchSheetText(sheetId);

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex].isReady = false;
      documents[docIndex].status = "processing";
      saveDocuments();
    }

    await processSheetText(
      text,
      documentId,
      processingStatus,
      documents,
      saveDocuments,
      vectorsDir,
      modifiedTime
    );
  } catch (error) {
    console.error(`syncSheet error for ${documentId}:`, error.message);
    processingStatus[documentId] = { stage: "Failed", error: error.message };

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex].status = "failed";
      documents[docIndex].error = error.message;
      saveDocuments();
    }
  }
}

setInterval(async () => {
  const sheetDocs = documents.filter((d) => d.type === "sheet" && d.status !== "processing");

  for (const doc of sheetDocs) {
    try {
      const currentModifiedTime = await fetchSheetModifiedTime(doc.sheetId);
      if (currentModifiedTime && currentModifiedTime !== doc.lastModifiedTime) {
        console.log(`📊 Sheet "${doc.name}" changed — re-syncing...`);
        await syncSheet(doc.id, doc.sheetId);
      }
    } catch (err) {
      console.error(`Poll error for sheet ${doc.id}:`, err.message);
    }
  }
}, 30_000);

function getDocById(id) {
  return documents.find((d) => d.id === id);
}

function safeLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

function parseMoney(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isNumericCell(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return /^[-+]?[$€£₹]?\s*\d[\d,]*(?:\.\d+)?\s*%?$/.test(text);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isPendingDue(row, config) {
  const dueCol = config?.dueColumn || "Amount ($)";
  const statusCol = config?.statusColumn || "Due Status";
  const statusVal = safeLower(row[statusCol]);
  const due = parseMoney(row[dueCol]);
  const hasPendingStatus = statusVal.includes("pending") || statusVal.includes("due") || statusVal.includes("unpaid");
  if (statusVal) return hasPendingStatus;
  return due > 0;
}

function buildInvoiceEmail(row, config, docName) {
  const customerName = row[config.customerNameColumn || "Client Name"] || row["Customer Name"] || row.Customer || "Customer";
  const invoiceNo = row[config.invoiceNumberColumn || "Invoice #"] || row["Invoice No"] || row.Invoice || "N/A";
  const dueAmount = row[config.dueColumn || "Amount ($)"] || row["Due Amount"] || row["Pending Due"] || "0";
  const dueDate = row[config.dueDateColumn || "Due Date"] || "N/A";
  const companyName = config.companyName || "our team";

  const subjectTemplate = config.subjectTemplate || "Gentle reminder: Invoice {{invoiceNo}} payment pending";
  const subject = subjectTemplate
    .replaceAll("{{invoiceNo}}", String(invoiceNo))
    .replaceAll("{{customerName}}", String(customerName))
    .replaceAll("{{dueAmount}}", String(dueAmount))
    .replaceAll("{{dueDate}}", String(dueDate));
  const safeCustomerName = escapeHtml(customerName);
  const safeInvoiceNo = escapeHtml(invoiceNo);
  const safeDueAmount = escapeHtml(dueAmount);
  const safeDueDate = escapeHtml(dueDate);
  const safeDocName = escapeHtml(docName);
  const safeCompanyName = escapeHtml(companyName);
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <p>Dear ${safeCustomerName},</p>
      <p>We hope you are doing well.</p>
      <p>We are writing to kindly remind you that invoice <strong>${safeInvoiceNo}</strong> from <strong>${safeDocName}</strong> still shows an outstanding amount of <strong>${safeDueAmount}</strong>.</p>
      <p>The due date is <strong>${safeDueDate}</strong>. If you have already processed the payment, please ignore this message. Otherwise, we would appreciate your support in settling it at your earliest convenience.</p>
      <p>If you need any clarification, please reply to this email and we will be happy to assist you.</p>
      <p>Warm regards,<br/>${safeCompanyName}</p>
    </div>
  `;

  return { customerName, invoiceNo, dueAmount, dueDate, subject, html };
}

function makeTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendInvoiceReminderEmail(to, subject, html) {
  const transporter = makeTransporter();
  if (!transporter) {
    return { success: false, skipped: true, reason: "SMTP not configured" };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });

  return { success: true, messageId: info.messageId };
}

async function runInvoiceAutomation(automation) {
  const runStartedAt = new Date().toISOString();
  const deliveryMode = automation.config?.deliveryMode || "draft";
  const summary = {
    automationId: automation.id,
    automationName: automation.name,
    runDate: runStartedAt,
    processedSheets: [],
    totalRowsChecked: 0,
    totalPendingFound: 0,
    totalDraftsCreated: 0,
    totalEmailsSent: 0,
    totalSkipped: 0,
    totalErrors: 0,
    items: [],
  };

  try {
    for (const docId of automation.documentIds || []) {
      const doc = getDocById(docId);
      if (!doc || doc.type !== "sheet" || !doc.isActive || !doc.isReady) continue;

      const rows = await fetchSheetRows(doc.sheetId);
      const sheetItem = {
        documentId: doc.id,
        documentName: doc.name,
        rowsChecked: rows.length,
        pendingFound: 0,
        draftsCreated: 0,
        emailsSent: 0,
        skipped: 0,
        errors: 0,
      };

      for (const row of rows) {
        summary.totalRowsChecked += 1;

        if (!isPendingDue(row, automation.config || {})) continue;

        summary.totalPendingFound += 1;
        sheetItem.pendingFound += 1;

        const emailField = row[automation.config?.emailColumn || "Email"] || row[automation.config?.emailColumn || "Client Email"] || "";
        if (!emailField) {
          summary.totalErrors += 1;
          sheetItem.errors += 1;
          summary.items.push({
            type: "error",
            documentId: doc.id,
            documentName: doc.name,
            message: "Missing email field for pending due row",
            rowIndex: row.__rowIndex,
          });
          continue;
        }

        const emailData = buildInvoiceEmail(row, automation.config || {}, doc.name);

        try {
          if (deliveryMode === "draft") {
            summary.totalDraftsCreated += 1;
            sheetItem.draftsCreated += 1;
            summary.items.push({
              type: "draft",
              documentId: doc.id,
              documentName: doc.name,
              to: emailField,
              customerName: emailData.customerName,
              invoiceNo: emailData.invoiceNo,
              dueAmount: emailData.dueAmount,
              dueDate: emailData.dueDate,
              subject: emailData.subject,
              html: emailData.html,
              rowIndex: row.__rowIndex,
            });
            continue;
          }

          const sendResult = await sendInvoiceReminderEmail(emailField, emailData.subject, emailData.html);

          if (sendResult.success) {
            summary.totalEmailsSent += 1;
            sheetItem.emailsSent += 1;
            summary.items.push({
              type: "sent",
              documentId: doc.id,
              documentName: doc.name,
              to: emailField,
              customerName: emailData.customerName,
              invoiceNo: emailData.invoiceNo,
              dueAmount: emailData.dueAmount,
              dueDate: emailData.dueDate,
              subject: emailData.subject,
              rowIndex: row.__rowIndex,
              messageId: sendResult.messageId,
            });
          } else {
            summary.totalSkipped += 1;
            sheetItem.skipped += 1;
            summary.items.push({
              type: "skipped",
              documentId: doc.id,
              documentName: doc.name,
              to: emailField,
              reason: sendResult.reason || "Email skipped",
              rowIndex: row.__rowIndex,
            });
          }
        } catch (err) {
          summary.totalErrors += 1;
          sheetItem.errors += 1;
          summary.items.push({
            type: "error",
            documentId: doc.id,
            documentName: doc.name,
            to: emailField,
            reason: err.message,
            rowIndex: row.__rowIndex,
          });
        }
      }

      summary.processedSheets.push(sheetItem);
    }

    const report = {
      id: Date.now().toString(),
      type: "daily_invoice_automation",
      automationId: automation.id,
      automationName: automation.name,
      createdAt: runStartedAt,
      ...summary,
      status: "success",
      deliveryMode,
      readAt: null,
    };

    reports.unshift(report);
    saveReports();

    automation.lastRunAt = runStartedAt;
    automation.lastReportId = report.id;
    saveAutomations();

    return report;
  } catch (error) {
    const report = {
      id: Date.now().toString(),
      type: "daily_invoice_automation",
      automationId: automation.id,
      automationName: automation.name,
      createdAt: runStartedAt,
      status: "failed",
      error: error.message,
      deliveryMode,
      readAt: null,
      ...summary,
    };

    reports.unshift(report);
    saveReports();

    automation.lastRunAt = runStartedAt;
    automation.lastReportId = report.id;
    saveAutomations();

    throw error;
  }
}

function stopScheduledAutomation(id) {
  const task = scheduledAutomationJobs.get(id);
  if (!task) return;
  task.stop();
  if (typeof task.destroy === "function") task.destroy();
  scheduledAutomationJobs.delete(id);
}

function normalizeAutomation(automation) {
  if (automation.category) return automation;

  return {
    ...automation,
    category: automation.type === "invoice_followup" ? "due_monitor" : "scheduled_summary",
    trigger: {
      type: "schedule",
      schedule: automation.schedule || "daily",
      cron: automation.scheduleCron || "0 9 * * *",
    },
    intelligence: {
      useAi: false,
      provider: "auto",
      prompt: "",
    },
    condition: {
      column: automation.config?.statusColumn || "Due Status",
      operator: "contains_any",
      value: "pending,due,overdue,unpaid",
    },
    actions: [
      { type: "notification", enabled: true },
      { type: "save_report", enabled: true },
    ],
  };
}

function matchesCondition(row, condition = {}) {
  const actual = String(row[condition.column] ?? "").trim();
  const expected = String(condition.value ?? "").trim();
  const actualLower = actual.toLowerCase();
  const expectedLower = expected.toLowerCase();

  switch (condition.operator) {
    case "equals":
      return actualLower === expectedLower;
    case "not_equals":
      return actualLower !== expectedLower;
    case "contains":
      return actualLower.includes(expectedLower);
    case "contains_any":
      return expectedLower.split(",").map((item) => item.trim()).filter(Boolean)
        .some((item) => actualLower.includes(item));
    case "greater_than":
      return parseMoney(actual) > parseMoney(expected);
    case "less_than":
      return parseMoney(actual) < parseMoney(expected);
    case "is_empty":
      return !actual;
    case "is_not_empty":
      return Boolean(actual);
    default:
      return true;
  }
}

function summarizeSheetData(sheetData) {
  const totalRows = sheetData.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  const columns = [...new Set(sheetData.flatMap((sheet) => sheet.headers))];
  const numeric = {};

  for (const column of columns) {
    const rawValues = sheetData
      .flatMap((sheet) => sheet.rows)
      .map((row) => row[column])
      .filter((value) => String(value ?? "").trim() !== "");
    const numericValues = rawValues.filter(isNumericCell).map(parseMoney);
    if (rawValues.length > 0 && numericValues.length >= Math.max(2, Math.ceil(rawValues.length * 0.8))) {
      numeric[column] = {
        count: numericValues.length,
        total: numericValues.reduce((sum, value) => sum + value, 0),
        average: numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
      };
    }
  }

  return { totalRows, columns, numeric };
}

async function generateAiInsight({ prompt, documentName, sheets, matchedRows, category }) {
  const rows = (matchedRows?.length ? matchedRows : sheets.flatMap((sheet) => sheet.rows))
    .slice(0, 80)
    .map(({ __sheetName, __rowIndex, ...row }) => ({ sheet: __sheetName, row: __rowIndex, ...row }));
  const system = [
    "You are an operations analyst inside an automation system.",
    "Analyze only the supplied sheet data.",
    "Return a concise operational briefing with: Summary, Important findings, Risks or exceptions, and Recommended actions.",
    "Use plain text with short bullets. Do not invent facts.",
  ].join(" ");
  const userPrompt = [
    `Document: ${documentName}`,
    `Automation category: ${category}`,
    prompt ? `User instruction: ${prompt}` : "User instruction: Summarize the most important changes, exceptions, and actions.",
    `Sheet data JSON:\n${JSON.stringify(rows)}`,
  ].join("\n\n");

  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (anthropicKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
        max_tokens: 1200,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Claude request failed");
    return {
      provider: "claude",
      model: data.model,
      text: (data.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n"),
    };
  }

  if (process.env.GROQ_API_KEY) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_AUTOMATION_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });
    return {
      provider: "groq",
      model: completion.model,
      text: completion.choices[0].message.content,
    };
  }

  return {
    provider: "rules",
    model: null,
    text: "AI insight was skipped because no Claude or Groq API key is configured.",
  };
}

function templateText(template, row) {
  return String(template || "").replace(/\{\{([^}]+)\}\}/g, (_, key) => String(row[key.trim()] ?? ""));
}

function textToHtml(text) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#171717">${escapeHtml(text).replaceAll("\n", "<br/>")}</div>`;
}

function addNotification({ automation, report, title, message, severity = "info" }) {
  const notification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    automationId: automation.id,
    automationName: automation.name,
    reportId: report.id,
    title,
    message,
    severity,
    category: automation.category,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  notifications.unshift(notification);
  notifications = notifications.slice(0, 500);
  saveNotifications();
  return notification;
}

async function runAutomation(automationInput) {
  const automation = normalizeAutomation(automationInput);
  const startedAt = new Date().toISOString();
  const collectedSheets = [];
  const sourceSummaries = [];

  for (const docId of automation.documentIds || []) {
    const document = getDocById(docId);
    if (!document || document.type !== "sheet" || !document.isReady) continue;
    const sheets = await fetchSheetDataset(document.sheetId);
    collectedSheets.push(...sheets.map((sheet) => ({ ...sheet, documentId: document.id, documentName: document.name })));
    sourceSummaries.push({
      documentId: document.id,
      documentName: document.name,
      sheetCount: sheets.length,
      rowCount: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    });
  }

  const allRows = collectedSheets.flatMap((sheet) => sheet.rows.map((row) => ({
    ...row,
    __documentId: sheet.documentId,
    __documentName: sheet.documentName,
  })));
  let matchedRows = allRows;

  if (automation.category === "condition_alert") {
    matchedRows = allRows.filter((row) => matchesCondition(row, automation.condition));
  } else if (automation.category === "due_monitor") {
    const condition = automation.condition?.column
      ? automation.condition
      : { column: "Due Status", operator: "contains_any", value: "pending,due,overdue,unpaid" };
    matchedRows = allRows.filter((row) => matchesCondition(row, condition));
  }

  const overview = summarizeSheetData(collectedSheets);
  let aiInsight = null;
  const needsAi = automation.intelligence?.useAi ||
    ["scheduled_summary", "ai_watch", "scheduled_report"].includes(automation.category);
  if (needsAi) {
    try {
      aiInsight = await generateAiInsight({
        prompt: automation.intelligence?.prompt,
        documentName: sourceSummaries.map((source) => source.documentName).join(", "),
        sheets: collectedSheets,
        matchedRows: automation.category === "condition_alert" || automation.category === "due_monitor" ? matchedRows : null,
        category: automation.category,
      });
    } catch (error) {
      aiInsight = { provider: "error", model: null, text: `AI analysis failed: ${error.message}` };
    }
  }

  const report = {
    id: Date.now().toString(),
    type: "automation_run",
    automationId: automation.id,
    automationName: automation.name,
    category: automation.category,
    createdAt: startedAt,
    status: "success",
    sources: sourceSummaries,
    totalRowsChecked: allRows.length,
    totalMatched: matchedRows.length,
    overview,
    aiInsight,
    actions: [],
    items: matchedRows.slice(0, 100),
    readAt: null,
  };

  const actions = (automation.actions || []).filter((action) => action.enabled !== false);
  for (const action of actions) {
    try {
      if (action.type === "notification") {
        const matchText = ["condition_alert", "due_monitor"].includes(automation.category)
          ? `${matchedRows.length} matching row${matchedRows.length === 1 ? "" : "s"} found.`
          : `${allRows.length} rows analyzed.`;
        const notification = addNotification({
          automation,
          report,
          title: action.title || automation.name,
          message: aiInsight?.text || `${matchText} Open the report for details.`,
          severity: matchedRows.length > 0 && ["condition_alert", "due_monitor"].includes(automation.category) ? "warning" : "info",
        });
        report.actions.push({ type: "notification", status: "success", notificationId: notification.id });
      }

      if (action.type === "email_summary") {
        const recipients = String(action.recipients || "").split(",").map((item) => item.trim()).filter(Boolean);
        if (recipients.length === 0) throw new Error("No summary email recipient configured");
        const subject = templateText(action.subject || `Automation report: ${automation.name}`, {
          automationName: automation.name,
          matchedCount: matchedRows.length,
          rowCount: allRows.length,
        });
        const summaryText = aiInsight?.text || `${allRows.length} rows checked and ${matchedRows.length} matched.`;
        const result = await sendInvoiceReminderEmail(recipients.join(","), subject, textToHtml(summaryText));
        if (!result.success) throw new Error(result.reason || "Email was not sent");
        report.actions.push({ type: "email_summary", status: "success", recipients, messageId: result.messageId });
      }

      if (action.type === "row_email") {
        let sent = 0;
        let skipped = 0;
        const rowResults = [];
        for (const row of matchedRows) {
          const to = row[action.emailColumn || "Email"];
          if (!to) {
            skipped += 1;
            rowResults.push({ status: "skipped", rowIndex: row.__rowIndex, reason: "Missing recipient email" });
            continue;
          }
          const subject = templateText(action.subject || "Important update", row);
          const body = templateText(action.body || "Please review this update.", row);
          const result = await sendInvoiceReminderEmail(to, subject, textToHtml(body));
          if (result.success) {
            sent += 1;
            rowResults.push({ status: "sent", to, rowIndex: row.__rowIndex, messageId: result.messageId });
          } else {
            skipped += 1;
            rowResults.push({ status: "skipped", to, rowIndex: row.__rowIndex, reason: result.reason });
          }
        }
        report.actions.push({ type: "row_email", status: "success", sent, skipped, items: rowResults });
      }

      if (action.type === "save_report") {
        report.actions.push({ type: "save_report", status: "success" });
      }
    } catch (error) {
      report.actions.push({ type: action.type, status: "failed", error: error.message });
      report.status = "partial";
      addNotification({
        automation,
        report,
        title: `${automation.name}: action failed`,
        message: `${action.type}: ${error.message}`,
        severity: "error",
      });
    }
  }

  if (actions.length === 0) {
    report.actions.push({ type: "save_report", status: "success" });
  }

  reports.unshift(report);
  reports = reports.slice(0, 500);
  saveReports();

  const storedAutomation = automations.find((item) => item.id === automation.id);
  if (storedAutomation) {
    storedAutomation.lastRunAt = startedAt;
    storedAutomation.lastReportId = report.id;
    storedAutomation.lastStatus = report.status;
    saveAutomations();
  }

  return report;
}

function scheduleAutomation(automation) {
  stopScheduledAutomation(automation.id);
  if (!automation.enabled) return;

  const normalized = normalizeAutomation(automation);
  const scheduleExpr = normalized.trigger?.cron || normalized.scheduleCron || "0 9 * * *";
  if (!cron.validate(scheduleExpr)) {
    console.error(`Invalid cron schedule for automation ${automation.name}: ${scheduleExpr}`);
    return;
  }

  const task = cron.schedule(scheduleExpr, async () => {
    try {
      console.log(`Running automation: ${automation.name}`);
      await runAutomation(automation);
    } catch (err) {
      console.error(`Automation failed: ${automation.name}`, err.message);
    }
  });

  scheduledAutomationJobs.set(automation.id, task);
}

function scheduleAutomationJobs() {
  for (const id of scheduledAutomationJobs.keys()) stopScheduledAutomation(id);
  for (const automation of automations) scheduleAutomation(automation);
}

scheduleAutomationJobs();

app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend Running" });
});

app.get("/integrations/status", async (req, res) => {
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  let smtpVerified = false;
  let smtpError = null;

  if (smtpConfigured) {
    try {
      const transporter = makeTransporter();
      await transporter.verify();
      smtpVerified = true;
    } catch (error) {
      smtpError = error.message;
    }
  }

  res.json({
    smtp: {
      configured: smtpConfigured,
      verified: smtpVerified,
      error: smtpError,
      from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
    },
    ai: {
      claudeConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      defaultProvider: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY ? "claude" : "groq",
    },
  });
});

app.get("/documents", (req, res) => {
  const updatedDocuments = documents.map((doc) => {
    const vectorPath = path.join(vectorsDir, `${doc.id}.json`);
    const vectorExists = fs.existsSync(vectorPath);
    return {
      ...doc,
      isReady: vectorExists && doc.isReady,
      isActive: doc.isActive !== undefined ? doc.isActive : true,
    };
  });

  res.json({ documents: updatedDocuments });
});

app.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    const documentId = Date.now().toString();
    const pdfPath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    const newDoc = {
      id: documentId,
      name: originalName,
      type: "file",
      filePath: pdfPath,
      fileSize,
      uploadedAt: new Date().toISOString(),
      isActive: true,
      isReady: false,
      chunks: 0,
      status: "processing",
    };

    documents.push(newDoc);
    saveDocuments();

    processingStatus[documentId] = { stage: "Uploaded" };

    processDocument(
      pdfPath,
      documentId,
      processingStatus,
      originalName,
      documents,
      saveDocuments,
      vectorsDir
    );

    res.json({ success: true, documentId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/sheets", async (req, res) => {
  try {
    const { sheetId, name } = req.body;

    if (!sheetId) {
      return res.status(400).json({ error: "sheetId is required" });
    }

    const documentId = Date.now().toString();

    const newDoc = {
      id: documentId,
      name: name || `Sheet-${sheetId.slice(0, 8)}`,
      type: "sheet",
      sheetId,
      uploadedAt: new Date().toISOString(),
      isActive: true,
      isReady: false,
      chunks: 0,
      status: "processing",
      lastModifiedTime: null,
      lastSyncedAt: null,
    };

    documents.push(newDoc);
    saveDocuments();

    processingStatus[documentId] = { stage: "Fetching Sheet" };

    syncSheet(documentId, sheetId);

    res.json({ success: true, documentId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/status/:id", (req, res) => {
  const status = processingStatus[req.params.id];
  const doc = documents.find((d) => d.id === req.params.id);

  if (!status && !doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  const isReady = doc?.isReady || false;

  res.json({
    stage: isReady ? "Ready" : (status?.stage || "Processing"),
    ready: isReady,
  });
});

app.delete("/documents/:id", (req, res) => {
  try {
    const documentId = req.params.id;
    const docIndex = documents.findIndex((d) => d.id === documentId);

    if (docIndex === -1) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = documents[docIndex];

    const vectorPath = path.join(vectorsDir, `${documentId}.json`);
    if (fs.existsSync(vectorPath)) fs.unlinkSync(vectorPath);

    if (doc.type !== "sheet" && doc.filePath && fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    documents.splice(docIndex, 1);
    saveDocuments();
    delete processingStatus[documentId];

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/documents/:id/toggle", (req, res) => {
  try {
    const doc = documents.find((d) => d.id === req.params.id);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    doc.isActive = !doc.isActive;
    saveDocuments();

    res.json({ success: true, isActive: doc.isActive });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/sheets/:id/sync", async (req, res) => {
  try {
    const doc = documents.find((d) => d.id === req.params.id && d.type === "sheet");

    if (!doc) {
      return res.status(404).json({ error: "Sheet not found" });
    }

    syncSheet(doc.id, doc.sheetId);

    res.json({ success: true, message: "Re-sync started" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/automations", (req, res) => {
  const result = automations.map((automation) => {
    const task = scheduledAutomationJobs.get(automation.id);
    return {
      ...normalizeAutomation(automation),
      nextRunAt: task && typeof task.getNextRun === "function"
        ? task.getNextRun()?.toISOString() || null
        : null,
    };
  });
  res.json({ automations: result });
});

app.get("/sheets/:id/data", async (req, res) => {
  try {
    const doc = documents.find((d) => d.id === req.params.id && d.type === "sheet");
    if (!doc) return res.status(404).json({ error: "Sheet not found" });

    const sheets = await fetchSheetDataset(doc.sheetId);
    const overview = summarizeSheetData(sheets);
    const statusColumns = overview.columns.filter((column) => /status|state|stage/i.test(column));
    const statusBreakdown = {};
    for (const column of statusColumns) {
      statusBreakdown[column] = {};
      for (const row of sheets.flatMap((sheet) => sheet.rows)) {
        const value = String(row[column] || "Blank");
        statusBreakdown[column][value] = (statusBreakdown[column][value] || 0) + 1;
      }
    }

    res.json({
      document: doc,
      sheets,
      overview: {
        ...overview,
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/automations", (req, res) => {
  try {
    const trigger = req.body.trigger || {
      type: "schedule",
      schedule: req.body.schedule || "daily",
      cron: req.body.scheduleCron || "0 9 * * *",
    };
    const automation = {
      id: Date.now().toString(),
      name: req.body.name || "Untitled automation",
      type: req.body.type || "workflow",
      category: req.body.category || "scheduled_summary",
      documentIds: req.body.documentIds || [],
      trigger,
      schedule: trigger.schedule || req.body.schedule || "daily",
      scheduleCron: trigger.cron || req.body.scheduleCron || "0 9 * * *",
      enabled: req.body.enabled !== undefined ? req.body.enabled : true,
      condition: req.body.condition || null,
      intelligence: req.body.intelligence || { useAi: false, provider: "auto", prompt: "" },
      actions: req.body.actions || [{ type: "notification", enabled: true }, { type: "save_report", enabled: true }],
      config: req.body.config || {},
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      lastReportId: null,
    };

    automations.unshift(automation);
    saveAutomations();
    scheduleAutomation(automation);

    res.json({ success: true, automation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/automations/:id", (req, res) => {
  try {
    const automation = automations.find((a) => a.id === req.params.id);
    if (!automation) {
      return res.status(404).json({ error: "Automation not found" });
    }

    automation.name = req.body.name ?? automation.name;
    automation.type = req.body.type ?? automation.type;
    automation.category = req.body.category ?? automation.category;
    automation.documentIds = req.body.documentIds ?? automation.documentIds;
    automation.trigger = req.body.trigger ?? automation.trigger;
    automation.schedule = req.body.schedule ?? automation.schedule;
    automation.scheduleCron = req.body.scheduleCron ?? automation.scheduleCron;
    automation.enabled = req.body.enabled ?? automation.enabled;
    automation.condition = req.body.condition ?? automation.condition;
    automation.intelligence = req.body.intelligence ?? automation.intelligence;
    automation.actions = req.body.actions ?? automation.actions;
    automation.config = req.body.config ?? automation.config;

    saveAutomations();
    scheduleAutomation(automation);
    res.json({ success: true, automation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/automations/:id", (req, res) => {
  try {
    stopScheduledAutomation(req.params.id);
    automations = automations.filter((a) => a.id !== req.params.id);
    saveAutomations();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/automations/:id/run", async (req, res) => {
  try {
    const automation = automations.find((a) => a.id === req.params.id);
    if (!automation) {
      return res.status(404).json({ error: "Automation not found" });
    }

    const report = await runAutomation(automation);
    res.json({ success: true, report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/reports", (req, res) => {
  const { from, to, automationId, status, limit } = req.query;
  let result = [...reports];

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    result = result.filter((report) => new Date(report.createdAt) >= fromDate);
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59.999`);
    result = result.filter((report) => new Date(report.createdAt) <= toDate);
  }
  if (automationId) result = result.filter((report) => report.automationId === automationId);
  if (status) result = result.filter((report) => report.status === status);
  if (limit) result = result.slice(0, Math.max(0, Number(limit) || 0));

  res.json({ reports: result });
});

app.get("/notifications", (req, res) => {
  const limit = Math.max(1, Number(req.query.limit) || 100);
  const result = notifications.slice(0, limit);
  res.json({
    notifications: result,
    unreadCount: notifications.filter((item) => !item.readAt).length,
  });
});

app.patch("/notifications/:id/read", (req, res) => {
  const notification = notifications.find((item) => item.id === req.params.id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  notification.readAt = notification.readAt || new Date().toISOString();
  saveNotifications();
  res.json({ success: true, notification });
});

app.post("/notifications/read-all", (req, res) => {
  const now = new Date().toISOString();
  notifications = notifications.map((item) => ({ ...item, readAt: item.readAt || now }));
  saveNotifications();
  res.json({ success: true });
});

app.get("/reports/:id", (req, res) => {
  const report = reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ report });
});

app.delete("/reports/:id", (req, res) => {
  try {
    reports = reports.filter((r) => r.id !== req.params.id);
    saveReports();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { question, documentIds } = req.body;

    if (!documentIds || documentIds.length === 0) {
      return res.status(400).json({ error: "No documents selected" });
    }

    if (!extractor) {
      extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }

    const queryEmbedding = await extractor(question, {
      pooling: "mean",
      normalize: true,
    });
    const queryVector = Array.from(queryEmbedding.data);

    let allMatches = [];

    for (const docId of documentIds) {
      const vectorPath = path.join(vectorsDir, `${docId}.json`);
      if (!fs.existsSync(vectorPath)) continue;

      const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8"));

      for (const record of vectors) {
        const score = cosineSimilarity(queryVector, record.embedding);
        allMatches.push({ score, text: record.text, docId });
      }
    }

    allMatches.sort((a, b) => b.score - a.score);
    const topMatches = allMatches.slice(0, 5);

    if (topMatches.length === 0) {
      return res.json({
        answer: "No relevant information found in the selected documents.",
      });
    }

    const context = topMatches.map((m) => m.text).join("\n\n---\n\n");

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Answer the question based only on the provided context. If the answer cannot be found in the context, say so politely.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion:\n${question}\n\nAnswer based on the context above:`,
        },
      ],
    });

    res.json({
      answer: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads: ${uploadsDir}`);
  console.log(`📁 Vectors: ${vectorsDir}`);
  console.log(`📁 Data: ${dataDir}`);
});

app.patch("/reports/:id/read", (req, res) => {
  const report = reports.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  report.readAt = report.readAt || new Date().toISOString();
  saveReports();
  res.json({ success: true, report });
});
