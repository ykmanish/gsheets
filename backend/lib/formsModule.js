const { ObjectId } = require("mongodb");

const DEFAULT_FORM = {
  slug: "admin-misc-expense-payment",
  name: "Admin and Misc. Expense Payment Request",
  department: "Admin & Accounts",
  description: "Submit advances, reimbursements, invoices, and other administrative payment requests.",
  isActive: true,
  allowedUserIds: [],
  spreadsheet: { spreadsheetId: "", sheetName: "Form responses 1" },
  fields: [
    { key: "requester_name", label: "Requester name", type: "text", required: true, sheetColumn: "Column 2" },
    { key: "department", label: "Department", type: "select", required: true, options: ["Accounts", "Admin", "HR", "Admin and HR"], sheetColumn: "Department" },
    { key: "expense_category", label: "Expense category", type: "select", required: true, options: ["Travel & Conveyance", "Pantry Expense", "Petty Cash", "Repair and Maintenance Work", "Rent", "Subscription / Software", "Utility Bill", "Staff Welfare", "Other"], sheetColumn: "Expense Category" },
    { key: "request_type", label: "Type of request", type: "select", required: true, options: ["Advance", "Reimbursement", "Against Invoice"], sheetColumn: "Type of Request" },
    { key: "supporting_documents", label: "Invoice or supporting document link", type: "url", required: false, sheetColumn: "Invoice and other supportive Documents" },
    { key: "description", label: "Description", type: "textarea", required: true, sheetColumn: "Description" },
    { key: "payment_mode", label: "Mode of payment", type: "select", required: true, options: ["Online Transfer", "Cheque", "Credit card", "Cash", "Others"], sheetColumn: "Mode of Payment" },
    { key: "amount", label: "Amount", type: "number", required: true, min: 0, sheetColumn: "Amount" },
    { key: "vendor_name", label: "Vendor name", type: "text", required: false, sheetColumn: "Vendor Name" },
    { key: "remarks", label: "Remarks", type: "textarea", required: false, sheetColumn: "Column 1" },
  ],
};

function serializeForm(form) {
  return {
    ...form,
    id: String(form._id),
    _id: undefined,
  };
}

function serializeSubmission(submission) {
  return {
    ...submission,
    id: String(submission._id),
    formId: String(submission.formId),
    _id: undefined,
  };
}

function cleanFields(fields) {
  if (!Array.isArray(fields)) return [];
  const seen = new Set();
  return fields.map((field, index) => {
    const key = String(field?.key || `field_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key || seen.has(key)) throw new Error("Each form field needs a unique key");
    seen.add(key);
    const type = ["text", "textarea", "number", "date", "select", "url", "email"].includes(field?.type) ? field.type : "text";
    return {
      key,
      label: String(field?.label || key).trim(),
      type,
      required: Boolean(field?.required),
      options: type === "select" ? (field.options || []).map(String).map((value) => value.trim()).filter(Boolean) : undefined,
      min: type === "number" && field.min !== null && field.min !== "" && field.min !== undefined && Number.isFinite(Number(field.min)) ? Number(field.min) : undefined,
      max: type === "number" && field.max !== null && field.max !== "" && field.max !== undefined && Number.isFinite(Number(field.max)) ? Number(field.max) : undefined,
      sheetColumn: String(field?.sheetColumn || field?.label || key).trim(),
    };
  });
}

function validateAnswers(form, rawAnswers) {
  const answers = {};
  const errors = [];
  for (const field of form.fields || []) {
    let value = rawAnswers?.[field.key];
    if (typeof value === "string") value = value.trim();
    const empty = value === undefined || value === null || value === "";
    if (field.required && empty) {
      errors.push(`${field.label} is required`);
      continue;
    }
    if (empty) {
      answers[field.key] = "";
      continue;
    }
    if (field.type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) errors.push(`${field.label} must be a number`);
      else if (field.min !== null && field.min !== undefined && Number.isFinite(Number(field.min)) && number < Number(field.min)) errors.push(`${field.label} must be at least ${field.min}`);
      else if (field.max !== null && field.max !== undefined && Number.isFinite(Number(field.max)) && number > Number(field.max)) errors.push(`${field.label} must be at most ${field.max}`);
      answers[field.key] = number;
      continue;
    }
    if (field.type === "select" && field.options?.length && !field.options.includes(String(value))) {
      errors.push(`Choose a valid ${field.label.toLowerCase()}`);
    }
    if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(String(value))) errors.push(`${field.label} must be a valid email`);
    if (field.type === "url") {
      try { new URL(String(value)); } catch { errors.push(`${field.label} must be a valid link`); }
    }
    answers[field.key] = String(value);
  }
  return { answers, errors };
}

function hasFormAccess(req, form) {
  return Boolean(req.user?.isSuperAdmin || form.allowedUserIds?.includes(String(req.user?._id)));
}

function buildSheetRow(form, submission) {
  return [submission.createdAt, submission.submittedByUsername, ...(form.fields || []).map((field) => submission.answers[field.key] ?? "")];
}

function columnName(number) {
  let result = "";
  for (let value = number; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function escapeSheetName(name) {
  return `'${String(name || "Form responses 1").replace(/'/g, "''")}'`;
}

function normalizeSpreadsheetId(value) {
  const text = String(value || "").trim();
  const urlMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return urlMatch ? urlMatch[1] : text;
}

function registerFormsModule(app, { connectDb, google, getGoogleAuth, requireSuperAdmin }) {
  let setupPromise;
  async function setup() {
    if (!setupPromise) setupPromise = (async () => {
      const db = await connectDb();
      await Promise.all([
        db.collection("forms").createIndex({ slug: 1 }, { unique: true }),
        db.collection("formSubmissions").createIndex({ formId: 1, createdAt: -1 }),
        db.collection("formSubmissions").createIndex({ submittedByUserId: 1, createdAt: -1 }),
      ]);
      const now = new Date().toISOString();
      await db.collection("forms").updateOne(
        { slug: DEFAULT_FORM.slug },
        { $setOnInsert: { ...DEFAULT_FORM, createdAt: now, updatedAt: now, version: 1 } },
        { upsert: true }
      );
      return db;
    })();
    return setupPromise;
  }

  async function syncSubmission(form, submission) {
    const spreadsheetId = normalizeSpreadsheetId(form.spreadsheet?.spreadsheetId);
    if (!spreadsheetId) return { status: "not_configured", error: null };
    try {
      const auth = await getGoogleAuth();
      const sheets = google.sheets({ version: "v4", auth });
      const row = buildSheetRow(form, submission);
      const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
      const tabNames = (metadata.data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
      const requestedTab = String(form.spreadsheet?.sheetName || "").trim();
      const sheetName = tabNames.includes(requestedTab) ? requestedTab : tabNames[0];
      if (!sheetName) throw new Error("The spreadsheet does not contain a sheet tab");
      const rangeEnd = columnName(row.length);
      const headerResult = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapeSheetName(sheetName)}!A1:${rangeEnd}1` });
      if (!headerResult.data.values?.[0]?.some((value) => String(value).trim())) {
        const headers = ["Timestamp", "Email address", ...(form.fields || []).map((field) => field.sheetColumn || field.label)];
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${escapeSheetName(sheetName)}!A1:${rangeEnd}1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${escapeSheetName(sheetName)}!A:${rangeEnd}`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
      return { status: "synced", error: null, syncedAt: new Date().toISOString(), sheetName };
    } catch (error) {
      return { status: "failed", error: error.message };
    }
  }

  app.get("/forms", async (req, res) => {
    try {
      const db = await setup();
      const query = req.user?.isSuperAdmin ? {} : { isActive: true, allowedUserIds: String(req.user._id) };
      const forms = await db.collection("forms").find(query).sort({ department: 1, name: 1 }).toArray();
      res.json({ forms: forms.map(serializeForm) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get("/forms/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const db = await setup();
      const users = await db.collection("users").find({ blacklisted: { $ne: true } }).sort({ displayName: 1 }).toArray();
      res.json({ users: users.map((user) => ({ id: String(user._id), displayName: user.displayName || user.username, username: user.username, isSuperAdmin: Boolean(user.isSuperAdmin) })) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post("/forms", requireSuperAdmin, async (req, res) => {
    try {
      const db = await setup();
      const name = String(req.body?.name || "").trim();
      const department = String(req.body?.department || "").trim();
      const fields = cleanFields(req.body?.fields);
      if (!name || !department || !fields.length) return res.status(400).json({ error: "Name, department, and at least one field are required" });
      const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "form";
      const now = new Date().toISOString();
      const document = {
        slug: `${slugBase}-${Date.now()}`,
        name,
        department,
        description: String(req.body?.description || "").trim(),
        fields,
        allowedUserIds: Array.from(new Set((req.body?.allowedUserIds || []).map(String))),
        spreadsheet: { spreadsheetId: normalizeSpreadsheetId(req.body?.spreadsheet?.spreadsheetId), sheetName: String(req.body?.spreadsheet?.sheetName || "Form responses 1").trim() },
        isActive: req.body?.isActive !== false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      const result = await db.collection("forms").insertOne(document);
      res.json({ success: true, form: serializeForm({ ...document, _id: result.insertedId }) });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.patch("/forms/:id", requireSuperAdmin, async (req, res) => {
    try {
      const db = await setup();
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid form" });
      const formId = new ObjectId(req.params.id);
      const existing = await db.collection("forms").findOne({ _id: formId });
      if (!existing) return res.status(404).json({ error: "Form not found" });
      const update = { updatedAt: new Date().toISOString() };
      for (const key of ["name", "department", "description"]) if (req.body?.[key] !== undefined) update[key] = String(req.body[key]).trim();
      if (req.body?.fields !== undefined) { update.fields = cleanFields(req.body.fields); update.version = (existing.version || 1) + 1; }
      if (req.body?.allowedUserIds !== undefined) update.allowedUserIds = Array.from(new Set(req.body.allowedUserIds.map(String)));
      if (req.body?.isActive !== undefined) update.isActive = Boolean(req.body.isActive);
      if (req.body?.spreadsheet !== undefined) update.spreadsheet = { spreadsheetId: normalizeSpreadsheetId(req.body.spreadsheet.spreadsheetId), sheetName: String(req.body.spreadsheet.sheetName || "Form responses 1").trim() };
      await db.collection("forms").updateOne({ _id: formId }, { $set: update });
      const saved = await db.collection("forms").findOne({ _id: formId });
      res.json({ success: true, form: serializeForm(saved) });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.get("/forms/:id/submissions", async (req, res) => {
    try {
      const db = await setup();
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid form" });
      const formId = new ObjectId(req.params.id);
      const form = await db.collection("forms").findOne({ _id: formId });
      if (!form || !hasFormAccess(req, form)) return res.status(403).json({ error: "Form access denied" });
      const query = { formId };
      if (!req.user.isSuperAdmin) query.submittedByUserId = String(req.user._id);
      const submissions = await db.collection("formSubmissions").find(query).sort({ createdAt: -1 }).limit(250).toArray();
      res.json({ submissions: submissions.map(serializeSubmission) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post("/forms/:id/submissions", async (req, res) => {
    try {
      const db = await setup();
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid form" });
      const formId = new ObjectId(req.params.id);
      const form = await db.collection("forms").findOne({ _id: formId });
      if (!form || !form.isActive || !hasFormAccess(req, form)) return res.status(403).json({ error: "Form access denied" });
      const validation = validateAnswers(form, req.body?.answers || {});
      if (validation.errors.length) return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
      const submission = {
        formId,
        formName: form.name,
        formVersion: form.version || 1,
        department: form.department,
        answers: validation.answers,
        submittedByUserId: String(req.user._id),
        submittedByName: req.authUser.displayName,
        submittedByUsername: req.authUser.username,
        createdAt: new Date().toISOString(),
        syncStatus: "pending",
        syncError: null,
      };
      const result = await db.collection("formSubmissions").insertOne(submission);
      const sync = await syncSubmission(form, submission);
      await db.collection("formSubmissions").updateOne({ _id: result.insertedId }, { $set: { syncStatus: sync.status, syncError: sync.error, syncedAt: sync.syncedAt || null } });
      res.json({ success: true, submission: serializeSubmission({ ...submission, _id: result.insertedId, syncStatus: sync.status, syncError: sync.error, syncedAt: sync.syncedAt || null }) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post("/forms/:formId/submissions/:submissionId/retry", requireSuperAdmin, async (req, res) => {
    try {
      const db = await setup();
      if (!ObjectId.isValid(req.params.formId) || !ObjectId.isValid(req.params.submissionId)) return res.status(400).json({ error: "Invalid submission" });
      const form = await db.collection("forms").findOne({ _id: new ObjectId(req.params.formId) });
      const submission = await db.collection("formSubmissions").findOne({ _id: new ObjectId(req.params.submissionId), formId: form?._id });
      if (!form || !submission) return res.status(404).json({ error: "Submission not found" });
      const sync = await syncSubmission(form, submission);
      await db.collection("formSubmissions").updateOne({ _id: submission._id }, { $set: { syncStatus: sync.status, syncError: sync.error, syncedAt: sync.syncedAt || null } });
      res.json({ success: sync.status === "synced", sync });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
}

module.exports = { registerFormsModule };
