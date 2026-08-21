/* ──────────────────────────── Accounts request forms ────────────────────────────
   Self-contained to the Accounts module: forms are built here, shared by link, and
   every accepted response is appended to its own tab in the CRBR spreadsheet.
   Attachments go to a Drive folder and the sheet cell gets the link.

   Deliberately separate from lib/formsModule.js — accounts data is gated behind the
   Google identity check and must not be reachable from the general Forms module.  */

const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const fs = require("fs");

const FORMS = "accountsForms";
const SUBMISSIONS = "accountsFormSubmissions";
const LINKS = "accountsFormLinks";
const FIELD_TYPES = ["text", "textarea", "number", "toggle", "select", "date", "file"];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_SUBMISSION = 10;
const PUBLIC_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 30 };
const MAX_LINKS_PER_BATCH = 50;

const publicHits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = publicHits.get(ip) || { count: 0, resetAt: now + PUBLIC_RATE_LIMIT.windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + PUBLIC_RATE_LIMIT.windowMs; }
  entry.count += 1;
  publicHits.set(ip, entry);
  if (publicHits.size > 5000) for (const [key, value] of publicHits) if (now > value.resetAt) publicHits.delete(key);
  return entry.count > PUBLIC_RATE_LIMIT.max;
}

function slugify(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function cleanFields(fields, text) {
  if (!Array.isArray(fields) || !fields.length) throw new Error("Add at least one field to the form");
  const seen = new Set();
  return fields.map((field, index) => {
    const label = text(field?.label).slice(0, 120);
    if (!label) throw new Error(`Field ${index + 1} needs a label`);
    let key = slugify(field?.key || label).replace(/-/g, "_") || `field_${index + 1}`;
    while (seen.has(key)) key = `${key}_${index + 1}`;
    seen.add(key);
    const type = FIELD_TYPES.includes(field?.type) ? field.type : "text";
    return {
      key,
      label,
      type,
      required: Boolean(field?.required),
      // any field can carry an attachment, not just the file type
      allowAttachment: type === "file" ? true : Boolean(field?.allowAttachment),
      options: type === "select" ? [...new Set((field?.options || []).map((o) => text(o)).filter(Boolean))] : [],
      placeholder: text(field?.placeholder).slice(0, 120),
      sheetColumn: text(field?.sheetColumn).slice(0, 120) || label,
    };
  });
}

function serializeForm(form, { includeSecrets = false } = {}) {
  if (!form) return null;
  return {
    id: String(form._id),
    slug: form.slug,
    name: form.name,
    description: form.description || "",
    tabName: form.tabName,
    spreadsheetId: includeSecrets ? form.spreadsheetId || "" : undefined,
    driveFolderId: includeSecrets ? form.driveFolderId || "" : undefined,
    usesDefaultSheet: !form.spreadsheetId,
    visibility: form.visibility,
    // "multi" keeps one link open for any number of responses; "single" means every
    // recipient gets their own link that stops working the moment it is used.
    submissionMode: form.submissionMode === "single" ? "single" : "multi",
    isActive: form.isActive !== false,
    fields: form.fields || [],
    submissionCount: form.submissionCount || 0,
    createdAt: form.createdAt || null,
    updatedAt: form.updatedAt || null,
    createdBy: form.createdBy || null,
  };
}

// The form as an outsider sees it — no internal ids, no Drive folder, no counts.
function publicForm(form) {
  return {
    slug: form.slug,
    name: form.name,
    description: form.description || "",
    visibility: form.visibility,
    submissionMode: form.submissionMode === "single" ? "single" : "multi",
    fields: (form.fields || []).map(({ key, label, type, required, allowAttachment, options, placeholder }) => ({
      key, label, type, required, allowAttachment, options, placeholder,
    })),
  };
}

function registerAccountsFormsModule(app, deps) {
  const {
    connectDb, google, getGoogleAuth, upload, hasMenuAccess, requireAccountsGoogle,
    addActivityLog, projectText: text, escapeSheetName, getCrbrSettings, hashToken,
    extractDriveFileId, normalizeSpreadsheetId, publicApiUrl = "",
    sheetAccountEmail = () => "",
  } = deps;

  async function driveClient() {
    return google.drive({ version: "v3", auth: await getGoogleAuth() });
  }
  async function sheetsClient() {
    return google.sheets({ version: "v4", auth: await getGoogleAuth() });
  }

  // Checked when the form is saved rather than when someone submits, so a wrong link is
  // caught by the person who pasted it instead of silently degrading a stranger's upload.
  async function validateDriveFolder(folderId) {
    if (!folderId) return null;
    const drive = await driveClient();
    try {
      const file = await drive.files.get({
        fileId: folderId,
        fields: "id,name,mimeType,capabilities(canAddChildren)",
        supportsAllDrives: true,
      });
      if (file.data.mimeType !== "application/vnd.google-apps.folder") {
        return `That link points to "${file.data.name}", which is a file, not a folder. Copy the link of the folder or Shared Drive instead.`;
      }
      if (file.data.capabilities?.canAddChildren === false) {
        return `"${file.data.name}" is shared with ${sheetAccountEmail() || "the service account"} but it cannot add files. Give it Content manager or Editor access.`;
      }
      return null;
    } catch (error) {
      // a Shared Drive's own id is a drive resource, not a file, so check that too
      try {
        const shared = await drive.drives.get({ driveId: folderId, fields: "id,name" });
        if (shared.data.id) return null;
      } catch { /* not a shared drive either */ }
      if (error?.code === 404) {
        return `That folder cannot be opened by ${sheetAccountEmail() || "the service account"}. Share it with that address, then save again.`;
      }
      return `Could not check that folder: ${error.message}`;
    }
  }

  // Files go to Drive when that is possible, and stay on this server when it is not.
  // A service account owns no Drive storage of its own, so an ordinary My Drive folder
  // always refuses the write however it is shared — only a Shared Drive accepts it.
  // Rather than reject the submission, the file is kept locally and the sheet still
  // gets a working link, so a form is never blocked by a Drive setting.
  async function storeFile(form, file) {
    const localName = require("path").basename(file.path);
    const localUrl = `${publicApiUrl}/uploads/${encodeURIComponent(localName)}`;
    const local = { id: localName, name: file.originalname, url: localUrl, storage: "server" };

    if (!form.driveFolderId) return local;

    try {
      const drive = await driveClient();
      const created = await drive.files.create({
        requestBody: { name: `${Date.now()}-${file.originalname}`.slice(0, 180), parents: [form.driveFolderId] },
        media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      });
      fs.promises.unlink(file.path).catch(() => {});
      return {
        id: created.data.id,
        name: created.data.name,
        url: created.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`,
        storage: "drive",
      };
    } catch (error) {
      console.warn(`Drive upload fell back to local storage: ${error.message}`);
      return { ...local, driveError: error.message };
    }
  }

  // Appends one response to the form's own tab, creating the tab and header row the
  // first time anything is submitted.
  async function appendToSheet(form, answers, files) {
    const settings = await getCrbrSettings();
    const spreadsheetId = form.spreadsheetId || settings.targetSpreadsheetId;
    if (!spreadsheetId) throw new Error("No spreadsheet is configured for accounts forms");
    const sheets = await sheetsClient();

    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
    const exists = (meta.data.sheets || []).some((sheet) => sheet.properties.title === form.tabName);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: form.tabName } } }] },
      });
    }

    const headers = ["Submitted at", "Submitted by", ...form.fields.map((field) => field.sheetColumn || field.label)];
    const attachmentColumns = form.fields.filter((field) => field.allowAttachment && field.type !== "file").map((field) => `${field.sheetColumn || field.label} — file`);
    headers.push(...attachmentColumns);

    const range = `${escapeSheetName(form.tabName)}!A1:${String.fromCharCode(64 + Math.min(headers.length, 26))}1`;
    const current = await sheets.spreadsheets.values.get({ spreadsheetId, range }).catch(() => ({ data: {} }));
    if (!current.data?.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${escapeSheetName(form.tabName)}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] },
      });
    }

    const row = [new Date().toLocaleString("en-IN"), answers.__submittedBy || "Link"];
    form.fields.forEach((field) => {
      if (field.type === "file") {
        row.push((files[field.key] || []).map((f) => f.url).join("\n"));
        return;
      }
      const value = answers[field.key];
      row.push(field.type === "toggle" ? (value ? "Yes" : "No") : value == null ? "" : String(value));
    });
    form.fields.filter((field) => field.allowAttachment && field.type !== "file").forEach((field) => {
      row.push((files[field.key] || []).map((f) => f.url).join("\n"));
    });

    const appended = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${escapeSheetName(form.tabName)}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    return { spreadsheetId, updatedRange: appended.data?.updates?.updatedRange || "" };
  }

  /* ───────────────────────────── one-time links ─────────────────────────────
     A single-use form does not have one public URL — it has one URL per recipient,
     each carrying a token that burns on first accepted submission. The token is
     stored as written rather than hashed so the accounts team can re-copy a link
     they already handed out; it is a capability to fill one form in, nothing more,
     and it is worthless the moment it is used.                                    */

  function newLinkToken() {
    return crypto.randomBytes(16).toString("base64url");
  }

  function serializeLink(link, base) {
    return {
      id: String(link._id),
      token: link.token,
      label: link.label || "",
      url: `${base}/f/${link.slug}?t=${link.token}`,
      createdAt: link.createdAt || null,
      usedAt: link.usedAt || null,
      used: Boolean(link.usedAt),
    };
  }

  // Where the public form lives. The API and the app are different origins in
  // development, so the caller tells us its own origin and we fall back to the API.
  function appBaseFrom(req) {
    return text(req.query?.base) || text(req.headers?.origin) || publicApiUrl;
  }

  async function formById(db, id) {
    let objectId;
    try { objectId = new ObjectId(id); } catch { return null; }
    return db.collection(FORMS).findOne({ _id: objectId });
  }

  /* ───────────────────────── management, inside Accounts ───────────────────────── */

  async function gate(req, res, { needManage = false } = {}) {
    // Accounts access implies Forms, so splitting the module did not revoke anyone.
    if (!hasMenuAccess(req, "accounts-forms") && !hasMenuAccess(req, "accounts")) { res.status(403).json({ error: "Forms access required" }); return null; }
    const grant = await requireAccountsGoogle(req, res);
    if (!grant) return null;
    if (needManage && !grant.canManage) {
      res.status(403).json({ error: "Your Google account has view access to the sheets but not edit access" });
      return null;
    }
    return grant;
  }

  app.get("/accounts/forms", async (req, res) => {
    try {
      if (!await gate(req, res)) return;
      const db = await connectDb();
      const forms = await db.collection(FORMS).find({}).sort({ createdAt: -1 }).toArray();
      // One grouped pass rather than a query per form, so the list stays cheap as forms grow.
      const tallies = new Map();
      for (const row of await db.collection(LINKS).aggregate([
        { $group: { _id: "$formId", total: { $sum: 1 }, used: { $sum: { $cond: [{ $ifNull: ["$usedAt", false] }, 1, 0] } } } },
      ]).toArray()) tallies.set(String(row._id), { total: row.total, used: row.used });

      res.json({
        forms: forms.map((form) => ({
          ...serializeForm(form, { includeSecrets: true }),
          links: tallies.get(String(form._id)) || { total: 0, used: 0 },
        })),
        // shown in the editor so the right address can be given access to a sheet
        serviceAccountEmail: sheetAccountEmail(),
      });
    } catch (error) {
      console.error("Accounts forms list error:", error);
      res.status(500).json({ error: error.message || "Could not load forms" });
    }
  });

  app.post("/accounts/forms", async (req, res) => {
    try {
      if (!await gate(req, res, { needManage: true })) return;
      const db = await connectDb();
      const name = text(req.body?.name).slice(0, 120);
      if (!name) return res.status(400).json({ error: "Give the form a name" });
      const tabName = text(req.body?.tabName).slice(0, 90) || name;
      const fields = cleanFields(req.body?.fields, text);
      // Both fields accept a pasted Google URL or a bare id.
      const driveFolderId = extractDriveFileId(req.body?.driveFolderId) || "";
      const spreadsheetId = normalizeSpreadsheetId(req.body?.spreadsheetId) || "";
      const driveProblem = await validateDriveFolder(driveFolderId);
      if (driveProblem) return res.status(400).json({ error: driveProblem });

      let slug = slugify(req.body?.slug || name) || crypto.randomBytes(4).toString("hex");
      if (await db.collection(FORMS).findOne({ slug })) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;

      const doc = {
        slug,
        name,
        description: text(req.body?.description).slice(0, 500),
        tabName,
        spreadsheetId,
        driveFolderId,
        visibility: req.body?.visibility === "link" ? "link" : "dashboard",
        submissionMode: req.body?.submissionMode === "single" ? "single" : "multi",
        isActive: true,
        fields,
        submissionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: req.authUser.id, name: req.authUser.displayName || req.authUser.username },
      };
      const result = await db.collection(FORMS).insertOne(doc);
      addActivityLog({ req, action: "Created accounts request form", target: name, status: "success", details: { slug, tabName } });
      res.json({ success: true, form: serializeForm({ ...doc, _id: result.insertedId }, { includeSecrets: true }) });
    } catch (error) {
      console.error("Accounts form create error:", error);
      res.status(400).json({ error: error.message || "Could not create the form" });
    }
  });

  app.patch("/accounts/forms/:id", async (req, res) => {
    try {
      if (!await gate(req, res, { needManage: true })) return;
      const db = await connectDb();
      const update = { updatedAt: new Date() };
      if (req.body?.name !== undefined) update.name = text(req.body.name).slice(0, 120);
      if (req.body?.description !== undefined) update.description = text(req.body.description).slice(0, 500);
      if (req.body?.tabName !== undefined) update.tabName = text(req.body.tabName).slice(0, 90);
      if (req.body?.driveFolderId !== undefined) {
        update.driveFolderId = extractDriveFileId(req.body.driveFolderId) || "";
        const driveProblem = await validateDriveFolder(update.driveFolderId);
        if (driveProblem) return res.status(400).json({ error: driveProblem });
      }
      if (req.body?.spreadsheetId !== undefined) update.spreadsheetId = normalizeSpreadsheetId(req.body.spreadsheetId) || "";
      if (req.body?.visibility !== undefined) update.visibility = req.body.visibility === "link" ? "link" : "dashboard";
      if (req.body?.submissionMode !== undefined) update.submissionMode = req.body.submissionMode === "single" ? "single" : "multi";
      if (req.body?.isActive !== undefined) update.isActive = Boolean(req.body.isActive);
      if (req.body?.fields !== undefined) update.fields = cleanFields(req.body.fields, text);
      const result = await db.collection(FORMS).findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: update },
        { returnDocument: "after" },
      );
      const form = result?.value || result;
      if (!form?._id) return res.status(404).json({ error: "Form not found" });
      addActivityLog({ req, action: "Updated accounts request form", target: form.name, status: "success" });
      res.json({ success: true, form: serializeForm(form, { includeSecrets: true }) });
    } catch (error) {
      console.error("Accounts form update error:", error);
      res.status(400).json({ error: error.message || "Could not update the form" });
    }
  });

  // Deleting a form takes its responses and its links with it. The rows already written
  // into the spreadsheet are left alone — that sheet is the accounts record, not ours.
  app.delete("/accounts/forms/:id", async (req, res) => {
    try {
      if (!await gate(req, res, { needManage: true })) return;
      const db = await connectDb();
      const form = await formById(db, req.params.id);
      if (!form) return res.status(404).json({ error: "Form not found" });

      const [submissions] = await Promise.all([
        db.collection(SUBMISSIONS).countDocuments({ formId: form._id }),
      ]);
      await Promise.all([
        db.collection(FORMS).deleteOne({ _id: form._id }),
        db.collection(SUBMISSIONS).deleteMany({ formId: form._id }),
        db.collection(LINKS).deleteMany({ formId: form._id }),
      ]);

      addActivityLog({
        req, action: "Deleted accounts request form", target: form.name, status: "success",
        details: { slug: form.slug, submissionsRemoved: submissions },
      });
      res.json({ success: true, submissionsRemoved: submissions });
    } catch (error) {
      console.error("Accounts form delete error:", error);
      res.status(400).json({ error: error.message || "Could not delete the form" });
    }
  });

  app.get("/accounts/forms/:id/links", async (req, res) => {
    try {
      if (!await gate(req, res)) return;
      const db = await connectDb();
      const form = await formById(db, req.params.id);
      if (!form) return res.status(404).json({ error: "Form not found" });
      const links = await db.collection(LINKS).find({ formId: form._id }).sort({ createdAt: -1 }).limit(400).toArray();
      const base = appBaseFrom(req);
      res.json({ links: links.map((link) => serializeLink(link, base)) });
    } catch (error) {
      console.error("Accounts form links error:", error);
      res.status(500).json({ error: error.message || "Could not load links" });
    }
  });

  app.post("/accounts/forms/:id/links", async (req, res) => {
    try {
      if (!await gate(req, res, { needManage: true })) return;
      const db = await connectDb();
      const form = await formById(db, req.params.id);
      if (!form) return res.status(404).json({ error: "Form not found" });

      const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), MAX_LINKS_PER_BATCH);
      // One label for a batch of one ("Kalhar site"), blank for a bulk batch.
      const label = text(req.body?.label).slice(0, 80);
      const now = new Date();
      const docs = Array.from({ length: count }, () => ({
        formId: form._id,
        slug: form.slug,
        token: newLinkToken(),
        label,
        createdAt: now,
        createdBy: { id: req.authUser.id, name: req.authUser.displayName || req.authUser.username },
        usedAt: null,
      }));
      await db.collection(LINKS).insertMany(docs);

      addActivityLog({ req, action: "Created one-time form links", target: form.name, status: "success", details: { count } });
      const base = appBaseFrom(req);
      res.json({ success: true, links: docs.map((link) => serializeLink(link, base)) });
    } catch (error) {
      console.error("Accounts form link create error:", error);
      res.status(400).json({ error: error.message || "Could not create links" });
    }
  });

  app.delete("/accounts/forms/:id/links/:linkId", async (req, res) => {
    try {
      if (!await gate(req, res, { needManage: true })) return;
      const db = await connectDb();
      let linkId;
      try { linkId = new ObjectId(req.params.linkId); } catch { return res.status(400).json({ error: "Bad link" }); }
      const result = await db.collection(LINKS).deleteOne({ _id: linkId });
      if (!result.deletedCount) return res.status(404).json({ error: "Link not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Accounts form link delete error:", error);
      res.status(400).json({ error: error.message || "Could not remove the link" });
    }
  });

  app.get("/accounts/forms/:id/submissions", async (req, res) => {
    try {
      if (!await gate(req, res)) return;
      const db = await connectDb();
      const submissions = await db.collection(SUBMISSIONS)
        .find({ formId: new ObjectId(req.params.id) })
        .sort({ submittedAt: -1 }).limit(200).toArray();
      res.json({
        submissions: submissions.map((item) => ({
          id: String(item._id),
          answers: item.answers,
          files: item.files,
          submittedAt: item.submittedAt,
          submittedBy: item.submittedBy,
          syncStatus: item.syncStatus,
          syncError: item.syncError || null,
        })),
      });
    } catch (error) {
      console.error("Accounts form submissions error:", error);
      res.status(500).json({ error: error.message || "Could not load responses" });
    }
  });

  /* ───────────────────────── the shareable public form ───────────────────────── */

  app.get("/public/accounts-forms/:slug", async (req, res) => {
    try {
      const db = await connectDb();
      const form = await db.collection(FORMS).findOne({ slug: req.params.slug, isActive: { $ne: false } });
      if (!form) return res.status(404).json({ error: "This form is not available" });

      if (form.submissionMode === "single") {
        const token = text(req.query?.t);
        if (!token) {
          return res.status(403).json({ error: "This form is filled in through a personal link. Ask the accounts team to send you one.", needsToken: true });
        }
        const link = await db.collection(LINKS).findOne({ formId: form._id, token });
        if (!link) return res.status(404).json({ error: "This link is not valid any more.", badToken: true });
        if (link.usedAt) return res.status(410).json({ error: "This link has already been used.", used: true });
        return res.json({ form: publicForm(form), linkLabel: link.label || "" });
      }

      res.json({ form: publicForm(form) });
    } catch (error) {
      console.error("Public accounts form error:", error);
      res.status(500).json({ error: "Could not load the form" });
    }
  });

  app.post("/public/accounts-forms/:slug/submit", upload.array("files", MAX_FILES_PER_SUBMISSION), async (req, res) => {
    let claimedLink = null;
    try {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
      if (rateLimited(ip)) return res.status(429).json({ error: "Too many submissions from here. Try again later." });

      const db = await connectDb();
      const form = await db.collection(FORMS).findOne({ slug: req.params.slug, isActive: { $ne: false } });
      if (!form) return res.status(404).json({ error: "This form is not available" });

      // A dashboard-only form still needs a real raga session even though the page is public.
      let submittedBy = null;
      const header = req.headers.authorization || "";
      if (header.startsWith("Bearer ")) {
        const session = await db.collection("sessions").findOne({ tokenHash: hashToken(header.slice(7)), expiresAt: { $gt: new Date() } });
        if (session) {
          const user = await db.collection("users").findOne({ _id: session.userId });
          if (user) submittedBy = { id: String(user._id), name: user.displayName || user.username };
        }
      }
      if (form.visibility !== "link" && !submittedBy) {
        return res.status(401).json({ error: "This form is only open to signed-in dashboard users" });
      }

      const raw = req.body?.answers ? JSON.parse(req.body.answers) : {};
      const answers = {};
      for (const field of form.fields) {
        const value = raw[field.key];
        if (field.type === "toggle") answers[field.key] = Boolean(value);
        else if (field.type === "number") answers[field.key] = value === "" || value == null ? null : Number(value);
        else answers[field.key] = text(value).slice(0, 5000);
        const empty = field.type === "file"
          ? !(req.files || []).some((file) => file.fieldname === "files" && String(file.originalname).length && text(req.body[`file_field_${field.key}`]))
          : answers[field.key] === "" || answers[field.key] == null;
        if (field.required && field.type !== "toggle" && empty) {
          return res.status(400).json({ error: `"${field.label}" is required` });
        }
        if (field.type === "number" && answers[field.key] != null && !Number.isFinite(answers[field.key])) {
          return res.status(400).json({ error: `"${field.label}" must be a number` });
        }
      }

      // A single-use form burns its link here — after validation, before anything is
      // recorded. findOneAndUpdate is the atomic part: two tabs racing the same link
      // means exactly one of them gets a document back and the other is turned away.
      if (form.submissionMode === "single") {
        const token = text(req.body?.token);
        if (!token) return res.status(403).json({ error: "This form needs a personal link." });
        const claim = await db.collection(LINKS).findOneAndUpdate(
          { formId: form._id, token, usedAt: null },
          { $set: { usedAt: new Date(), usedIp: ip } },
          { returnDocument: "after" },
        );
        claimedLink = claim?.value || claim;
        if (!claimedLink?._id) {
          const exists = await db.collection(LINKS).findOne({ formId: form._id, token });
          return res.status(410).json({ error: exists ? "This link has already been used." : "This link is not valid any more." });
        }
      }

      // Each uploaded file carries the field it belongs to in a matching text part.
      const files = {};
      for (const [index, file] of (req.files || []).entries()) {
        const fieldKey = text(req.body[`fileField${index}`]);
        const field = form.fields.find((item) => item.key === fieldKey && item.allowAttachment);
        if (!field) { fs.promises.unlink(file.path).catch(() => {}); continue; }
        const uploaded = await storeFile(form, file);
        files[field.key] = [...(files[field.key] || []), uploaded];
      }

      const submission = {
        formId: form._id,
        slug: form.slug,
        answers,
        files,
        submittedAt: new Date(),
        submittedBy,
        linkId: claimedLink?._id || null,
        linkLabel: claimedLink?.label || "",
        ip,
        syncStatus: "pending",
      };
      const inserted = await db.collection(SUBMISSIONS).insertOne(submission);
      if (claimedLink?._id) {
        await db.collection(LINKS).updateOne({ _id: claimedLink._id }, { $set: { submissionId: inserted.insertedId } });
      }
      claimedLink = null; // the response is recorded; the link stays used from here on

      try {
        const result = await appendToSheet(form, { ...answers, __submittedBy: submittedBy?.name || "Link" }, files);
        await db.collection(SUBMISSIONS).updateOne({ _id: inserted.insertedId }, { $set: { syncStatus: "synced", syncedAt: new Date(), sheetRange: result.updatedRange } });
      } catch (error) {
        console.error("Accounts form sheet append failed:", error);
        await db.collection(SUBMISSIONS).updateOne({ _id: inserted.insertedId }, { $set: { syncStatus: "failed", syncError: error.message } });
        return res.status(202).json({ success: true, warning: "Your response was saved, but it could not be written to the sheet yet." });
      }

      await db.collection(FORMS).updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });
      res.json({ success: true });
    } catch (error) {
      console.error("Accounts form submit error:", error);
      (req.files || []).forEach((file) => fs.promises.unlink(file.path).catch(() => {}));
      if (claimedLink?._id) {
        // the submission never landed, so the recipient keeps their link
        await connectDb()
          .then((db) => db.collection(LINKS).updateOne({ _id: claimedLink._id }, { $set: { usedAt: null } }))
          .catch(() => {});
      }
      res.status(400).json({ error: error.message || "Could not submit the form" });
    }
  });
}

module.exports = { registerAccountsFormsModule, MAX_UPLOAD_BYTES, MAX_FILES_PER_SUBMISSION };
