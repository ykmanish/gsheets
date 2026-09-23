const { ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Department Documents. An admin creates departments, assigns members and points
// each department at a folder inside a Google Shared Drive. Members keep their
// department's documents there: local uploads (stored in that folder), Google
// Sheet links, form links (internal /f/<slug> forms or external ones) and plain
// links. A document can be shared read-only with other departments.
//
// Isolation is enforced here, never in the UI: every read resolves the caller's
// department memberships first, and a document is visible only to members of its
// owning department, members of departments it was shared with, or an admin.
// Files are served through /file so members never need Drive permissions.

const MODULE_ID = "department-documents";
const ADMIN_PRIVILEGE = "manage_department_documents";
const DEPARTMENTS = "documentDepartments";
const DOCUMENTS = "departmentDocuments";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const DEPARTMENT_COLORS = ["emerald", "sky", "violet", "amber", "rose", "teal", "indigo", "orange"];
const FOLDER_MIME = "application/vnd.google-apps.folder";
// Types safe to render inline. Anything else (HTML, SVG, scripts…) is forced to
// download so an uploaded file can never run script in a viewer's session.
const INLINE_MIME = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp)|text\/plain|text\/csv|video\/(mp4|webm)|audio\/(mpeg|mp4|wav|ogg))$/i;

function text(value, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function longText(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function toObjectId(value) {
  const raw = String(value || "");
  return ObjectId.isValid(raw) && raw.length === 24 ? new ObjectId(raw) : null;
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter((id) => ObjectId.isValid(id) && id.length === 24))];
}

// Only http(s) — a stored `javascript:` URL would run in every viewer's session.
function safeHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

// multer 2 hands back multipart filenames decoded as latin1.
function decodeOriginalName(name = "") {
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return decoded.includes("�") ? name : decoded;
  } catch {
    return name;
  }
}

function driveErrorMessage(error, serviceEmail) {
  const message = String(error?.message || "");
  const shareHint = serviceEmail ? ` Share the folder with ${serviceEmail} as Content manager.` : "";
  if (/storage quota|Service Accounts do not have storage quota/i.test(message)) {
    return `The department folder must be inside a Google Shared Drive.${shareHint}`;
  }
  if (error?.code === 404 || /File not found/i.test(message)) {
    return `The department's Drive folder cannot be reached.${shareHint}`;
  }
  if (error?.code === 403 || /insufficient|permission/i.test(message)) {
    return `The service account does not have write access to the department folder.${shareHint}`;
  }
  return message || "Google Drive request failed";
}

function registerDepartmentDocumentsModule(app, {
  connectDb,
  google,
  getGoogleAuth,
  hasMenuAccess,
  hasPrivilege,
  notifyUsers,
  extractDriveFileId,
  safeFileName,
  uploadsDir,
}) {
  let indexesReady = null;
  let serviceEmailPromise = null;

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => cb(null, `deptdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  async function db() {
    const database = await connectDb();
    if (!indexesReady) {
      indexesReady = Promise.all([
        database.collection(DEPARTMENTS).createIndex({ nameLower: 1 }, { unique: true }),
        database.collection(DEPARTMENTS).createIndex({ memberUserIds: 1 }),
        database.collection(DOCUMENTS).createIndex({ departmentId: 1, updatedAt: -1 }),
        database.collection(DOCUMENTS).createIndex({ sharedWithDepartmentIds: 1 }),
      ]).catch((error) => {
        indexesReady = null;
        console.error("Department documents index error:", error.message);
      });
    }
    await indexesReady;
    return database;
  }

  async function drive() {
    const auth = await getGoogleAuth();
    return google.drive({ version: "v3", auth });
  }

  function serviceEmail() {
    if (!serviceEmailPromise) {
      serviceEmailPromise = getGoogleAuth()
        .then((auth) => auth.getCredentials())
        .then((credentials) => credentials?.client_email || "")
        .catch(() => "");
    }
    return serviceEmailPromise;
  }

  function isAdmin(req) {
    return Boolean(req.authUser?.isSuperAdmin || hasPrivilege(req, ADMIN_PRIVILEGE));
  }

  function actor(req) {
    return { id: String(req.authUser?.id || ""), name: req.authUser?.displayName || req.authUser?.username || "User" };
  }

  // Everything below the module gate. Admins get in even if the menu isn't on their role.
  function requireModule(req, res, next) {
    if (isAdmin(req) || hasMenuAccess(req, MODULE_ID)) return next();
    return res.status(403).json({ error: "Department Documents access required" });
  }

  function requireAdmin(req, res, next) {
    if (isAdmin(req)) return next();
    return res.status(403).json({ error: "Only an admin can manage departments" });
  }

  async function memberDepartmentIds(database, req) {
    const userId = String(req.authUser?.id || "");
    const departments = await database.collection(DEPARTMENTS).find({ memberUserIds: userId }, { projection: { _id: 1 } }).toArray();
    return new Set(departments.map((department) => String(department._id)));
  }

  function canView(req, memberIds, doc) {
    if (isAdmin(req)) return true;
    if (memberIds.has(String(doc.departmentId))) return true;
    return (doc.sharedWithDepartmentIds || []).some((id) => memberIds.has(String(id)));
  }

  function canManage(req, memberIds, doc) {
    return isAdmin(req) || memberIds.has(String(doc.departmentId));
  }

  function serializeDepartment(department, { admin = false, counts = {}, userNames = new Map() } = {}) {
    const id = String(department._id);
    const base = {
      id,
      name: department.name,
      description: department.description || "",
      color: department.color || "emerald",
      memberCount: (department.memberUserIds || []).length,
      members: (department.memberUserIds || []).map((userId) => ({ id: userId, name: userNames.get(userId) || "Unknown user" })),
      documentCount: counts[id]?.owned || 0,
      sharedInCount: counts[id]?.sharedIn || 0,
      driveConfigured: Boolean(department.driveFolderId),
      driveFolderName: department.driveFolderName || "",
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
    if (admin) {
      base.memberUserIds = department.memberUserIds || [];
      base.driveFolderId = department.driveFolderId || "";
      base.driveFolderUrl = department.driveFolderId ? `https://drive.google.com/drive/folders/${department.driveFolderId}` : "";
      base.driveVerifiedAt = department.driveVerifiedAt || null;
    }
    return base;
  }

  function serializeDocument(doc, { manage, departmentNames }) {
    const departmentId = String(doc.departmentId);
    const sharedIds = (doc.sharedWithDepartmentIds || []).map(String);
    return {
      id: String(doc._id),
      departmentId,
      departmentName: departmentNames.get(departmentId) || "Unknown department",
      type: doc.type,
      name: doc.name,
      description: doc.description || "",
      category: doc.category || "",
      url: doc.url || "",
      formId: doc.formId || "",
      formSlug: doc.formSlug || "",
      mimeType: doc.mimeType || "",
      previewable: Boolean(doc.driveFileId) && (String(doc.mimeType || "").startsWith("application/vnd.google-apps") || INLINE_MIME.test(doc.mimeType || "")),
      size: doc.size || null,
      originalName: doc.originalName || "",
      driveUrl: doc.driveFileId ? `https://drive.google.com/file/d/${doc.driveFileId}/view` : "",
      hasFile: Boolean(doc.driveFileId),
      // Owners see where the document went; recipients only see that it was shared with them.
      sharedWith: manage ? sharedIds.map((id) => ({ id, name: departmentNames.get(id) || "Unknown department" })) : [],
      createdBy: doc.createdBy || null,
      updatedBy: doc.updatedBy || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      canManage: manage,
    };
  }

  async function departmentNameMap(database) {
    const all = await database.collection(DEPARTMENTS).find({}, { projection: { name: 1 } }).toArray();
    return new Map(all.map((department) => [String(department._id), department.name]));
  }

  async function loadDepartmentForMember(database, req, departmentId) {
    const id = toObjectId(departmentId);
    if (!id) return { error: [400, "Invalid department"] };
    const department = await database.collection(DEPARTMENTS).findOne({ _id: id });
    if (!department) return { error: [404, "Department not found"] };
    const isMember = (department.memberUserIds || []).includes(String(req.authUser?.id));
    if (!isAdmin(req) && !isMember) return { error: [403, "You are not a member of this department"] };
    return { department };
  }

  async function loadManageableDocument(database, req, documentId) {
    const id = toObjectId(documentId);
    if (!id) return { error: [400, "Invalid document"] };
    const doc = await database.collection(DOCUMENTS).findOne({ _id: id });
    if (!doc) return { error: [404, "Document not found"] };
    const memberIds = await memberDepartmentIds(database, req);
    if (!canView(req, memberIds, doc)) return { error: [404, "Document not found"] };
    if (!canManage(req, memberIds, doc)) return { error: [403, "Only the owning department can change this document"] };
    return { doc, memberIds };
  }

  function fail(res, [status, message]) {
    return res.status(status).json({ error: message });
  }

  function cleanupUpload(req) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  }

  // Runs multer and turns its errors (e.g. file too large) into JSON 400s.
  function receiveFile(req, res, next) {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      const message = error.code === "LIMIT_FILE_SIZE" ? `Files must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller` : error.message;
      return res.status(400).json({ error: message });
    });
  }

  async function verifyDriveFolder(folderInput) {
    const folderId = extractDriveFileId(folderInput);
    if (!folderId) throw new Error("Enter a Google Drive folder link or ID");
    const email = await serviceEmail();
    let info;
    try {
      const client = await drive();
      info = (await client.files.get({
        fileId: folderId,
        fields: "id,name,mimeType,driveId,trashed,capabilities(canAddChildren)",
        supportsAllDrives: true,
      })).data;
    } catch (error) {
      throw new Error(driveErrorMessage(error, email));
    }
    if (info.trashed) throw new Error("That Drive folder is in the trash");
    if (info.mimeType !== FOLDER_MIME) throw new Error("That link points to a file, not a folder");
    if (!info.driveId) throw new Error(`The folder must live inside a Google Shared Drive (service accounts cannot own files in My Drive).${email ? ` Share it with ${email}.` : ""}`);
    if (info.capabilities && info.capabilities.canAddChildren === false) {
      throw new Error(`The service account can see this folder but cannot add files to it.${email ? ` Give ${email} Content manager access.` : ""}`);
    }
    return { driveFolderId: info.id, driveFolderName: info.name || "", driveId: info.driveId, driveVerifiedAt: new Date() };
  }

  async function uploadToDepartmentFolder(department, file, displayName) {
    if (!department.driveFolderId) throw new Error("An admin has not assigned a shared drive folder to this department yet");
    const originalName = decodeOriginalName(file.originalname || "upload");
    const ext = path.extname(originalName);
    const baseName = safeFileName(displayName || path.basename(originalName, ext));
    const driveName = ext && !baseName.toLowerCase().endsWith(ext.toLowerCase()) ? `${baseName}${ext}` : baseName;
    try {
      const client = await drive();
      const response = await client.files.create({
        requestBody: { name: driveName, parents: [department.driveFolderId] },
        media: { mimeType: file.mimetype || "application/octet-stream", body: fs.createReadStream(file.path) },
        fields: "id,name,mimeType,size",
        supportsAllDrives: true,
      });
      return {
        driveFileId: response.data.id,
        mimeType: response.data.mimeType || file.mimetype || "",
        size: Number(response.data.size || file.size) || null,
        originalName,
      };
    } catch (error) {
      throw new Error(driveErrorMessage(error, await serviceEmail()));
    }
  }

  async function trashDriveFile(fileId) {
    if (!fileId) return;
    try {
      const client = await drive();
      await client.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
    } catch (error) {
      console.error("Department document Drive trash error:", error.message);
    }
  }

  async function driveFileName(fileId) {
    try {
      const client = await drive();
      return (await client.files.get({ fileId, fields: "name", supportsAllDrives: true })).data.name || "";
    } catch {
      return "";
    }
  }

  // Builds the type-specific fields for a link-style document from the request body.
  async function linkFields(database, body, { partial = false } = {}) {
    const type = String(body?.type || "");
    if (type === "form" && body?.formId) {
      const formId = toObjectId(body.formId);
      const form = formId ? await database.collection("forms").findOne({ _id: formId }, { projection: { name: 1, slug: 1 } }) : null;
      if (!form) throw new Error("That form no longer exists");
      return { type, url: "", formId: String(form._id), formSlug: form.slug || "", defaultName: form.name || "Form" };
    }
    const url = safeHttpUrl(body?.url);
    if (!url) {
      if (partial && body?.url === undefined) return null;
      throw new Error(type === "form" ? "Pick a form or paste a form link" : "Enter a valid http(s) link");
    }
    if (type === "sheet" && !/docs\.google\.com\/spreadsheets\/d\//.test(url)) {
      throw new Error("Paste a Google Sheets link (docs.google.com/spreadsheets/...)");
    }
    let defaultName = "";
    if (type === "sheet") {
      const sheetId = extractDriveFileId(url);
      defaultName = (sheetId && await driveFileName(sheetId)) || "Google Sheet";
    } else {
      try { defaultName = new URL(url).hostname; } catch { defaultName = "Link"; }
    }
    return { type, url, formId: "", formSlug: "", defaultName };
  }

  // Tells newly-added share targets their department received a document.
  async function notifyShareTargets(database, req, doc, departmentIds, ownerName) {
    if (!departmentIds.length) return;
    const targets = await database.collection(DEPARTMENTS)
      .find({ _id: { $in: departmentIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1, memberUserIds: 1 } })
      .toArray();
    const me = String(req.authUser?.id || "");
    for (const target of targets) {
      const recipients = (target.memberUserIds || []).filter((id) => id !== me);
      if (!recipients.length) continue;
      notifyUsers(recipients, {
        title: "Document shared with your department",
        message: `${actor(req).name} (${ownerName}) shared "${doc.name}" with ${target.name}.`,
        type: "department-document",
      });
    }
  }

  // ---------- Overview ----------

  app.get("/department-documents/overview", requireModule, async (req, res) => {
    try {
      const database = await db();
      const admin = isAdmin(req);
      const userId = String(req.authUser?.id || "");
      const all = await database.collection(DEPARTMENTS).find({}).sort({ nameLower: 1 }).toArray();
      const visible = admin ? all : all.filter((department) => (department.memberUserIds || []).includes(userId));
      const visibleIds = visible.map((department) => department._id);

      const [ownedCounts, sharedCounts] = await Promise.all([
        database.collection(DOCUMENTS).aggregate([
          { $match: { departmentId: { $in: visibleIds } } },
          { $group: { _id: "$departmentId", count: { $sum: 1 } } },
        ]).toArray(),
        database.collection(DOCUMENTS).aggregate([
          { $match: { sharedWithDepartmentIds: { $in: visibleIds } } },
          { $unwind: "$sharedWithDepartmentIds" },
          { $match: { sharedWithDepartmentIds: { $in: visibleIds } } },
          { $group: { _id: "$sharedWithDepartmentIds", count: { $sum: 1 } } },
        ]).toArray(),
      ]);
      const counts = {};
      for (const row of ownedCounts) counts[String(row._id)] = { ...(counts[String(row._id)] || {}), owned: row.count };
      for (const row of sharedCounts) counts[String(row._id)] = { ...(counts[String(row._id)] || {}), sharedIn: row.count };

      const memberIds = [...new Set(visible.flatMap((department) => department.memberUserIds || []))];
      const users = memberIds.length
        ? await database.collection("users").find({ _id: { $in: memberIds.map((id) => new ObjectId(id)) } }, { projection: { displayName: 1, username: 1 } }).toArray()
        : [];
      const userNames = new Map(users.map((user) => [String(user._id), user.displayName || user.username]));

      const forms = await database.collection("forms")
        .find(admin ? {} : { isActive: true }, { projection: { name: 1, slug: 1, department: 1 } })
        .sort({ name: 1 })
        .toArray();

      res.json({
        isAdmin: admin,
        serviceAccountEmail: admin ? await serviceEmail() : "",
        colors: DEPARTMENT_COLORS,
        maxUploadBytes: MAX_UPLOAD_BYTES,
        departments: visible.map((department) => serializeDepartment(department, { admin, counts, userNames })),
        // Share targets: names only, so members can pick a department without seeing into it.
        shareTargets: all.map((department) => ({ id: String(department._id), name: department.name, color: department.color || "emerald" })),
        forms: forms.map((form) => ({ id: String(form._id), name: form.name, slug: form.slug || "", department: form.department || "" })),
      });
    } catch (error) {
      console.error("Department documents overview error:", error);
      res.status(500).json({ error: "Could not load departments" });
    }
  });

  // ---------- Admin: departments ----------

  app.get("/department-documents/admin/users", requireModule, requireAdmin, async (req, res) => {
    try {
      const database = await db();
      const users = await database.collection("users")
        .find({ blacklisted: { $ne: true }, isSuperAdmin: { $ne: true } }, { projection: { displayName: 1, username: 1, department: 1, designation: 1 } })
        .sort({ displayName: 1 })
        .toArray();
      res.json({
        users: users.map((user) => ({
          id: String(user._id),
          displayName: user.displayName || user.username,
          username: user.username,
          department: user.department || "",
          designation: user.designation || "",
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  async function departmentPayload(database, body, existing = null) {
    const name = text(body?.name, 80);
    if (!name) throw new Error("Department name is required");
    const duplicate = await database.collection(DEPARTMENTS).findOne({ nameLower: name.toLowerCase(), ...(existing ? { _id: { $ne: existing._id } } : {}) });
    if (duplicate) throw new Error("A department with this name already exists");
    const color = DEPARTMENT_COLORS.includes(body?.color) ? body.color : existing?.color || DEPARTMENT_COLORS[0];
    const memberUserIds = uniqueIds(body?.memberUserIds);
    const payload = { name, nameLower: name.toLowerCase(), description: longText(body?.description, 400), color, memberUserIds };

    const folderInput = String(body?.driveFolder ?? "").trim();
    if (!folderInput) {
      Object.assign(payload, { driveFolderId: "", driveFolderName: "", driveId: "", driveVerifiedAt: null });
    } else if (existing?.driveFolderId && extractDriveFileId(folderInput) === existing.driveFolderId && !body?.reverifyDrive) {
      // Unchanged folder — keep the stored verification.
    } else {
      Object.assign(payload, await verifyDriveFolder(folderInput));
    }
    return payload;
  }

  app.post("/department-documents/departments", requireModule, requireAdmin, async (req, res) => {
    try {
      const database = await db();
      const payload = await departmentPayload(database, req.body);
      const now = new Date();
      const result = await database.collection(DEPARTMENTS).insertOne({ ...payload, createdAt: now, updatedAt: now, createdBy: actor(req) });
      res.locals.activityTarget = payload.name;
      notifyUsers(payload.memberUserIds, {
        title: "Added to a department",
        message: `You now have access to the ${payload.name} documents folder.`,
        type: "department-document",
      });
      res.status(201).json({ id: String(result.insertedId) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/department-documents/departments/:id", requireModule, requireAdmin, async (req, res) => {
    try {
      const database = await db();
      const id = toObjectId(req.params.id);
      const existing = id && await database.collection(DEPARTMENTS).findOne({ _id: id });
      if (!existing) return res.status(404).json({ error: "Department not found" });
      const payload = await departmentPayload(database, req.body, existing);
      await database.collection(DEPARTMENTS).updateOne({ _id: id }, { $set: { ...payload, updatedAt: new Date(), updatedBy: actor(req) } });
      res.locals.activityTarget = payload.name;
      const added = payload.memberUserIds.filter((userId) => !(existing.memberUserIds || []).includes(userId));
      notifyUsers(added, {
        title: "Added to a department",
        message: `You now have access to the ${payload.name} documents folder.`,
        type: "department-document",
      });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Removes the department and its document records. Files already in the shared
  // drive folder are left untouched — the folder belongs to the admin.
  app.delete("/department-documents/departments/:id", requireModule, requireAdmin, async (req, res) => {
    try {
      const database = await db();
      const id = toObjectId(req.params.id);
      const existing = id && await database.collection(DEPARTMENTS).findOne({ _id: id });
      if (!existing) return res.status(404).json({ error: "Department not found" });
      const removed = await database.collection(DOCUMENTS).deleteMany({ departmentId: id });
      await database.collection(DOCUMENTS).updateMany({ sharedWithDepartmentIds: id }, { $pull: { sharedWithDepartmentIds: id } });
      await database.collection(DEPARTMENTS).deleteOne({ _id: id });
      res.locals.activityTarget = existing.name;
      res.json({ success: true, removedDocuments: removed.deletedCount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/department-documents/verify-drive", requireModule, requireAdmin, async (req, res) => {
    try {
      const result = await verifyDriveFolder(req.body?.driveFolder);
      res.json({ success: true, folderName: result.driveFolderName, folderId: result.driveFolderId });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ---------- Documents ----------

  app.get("/department-documents/departments/:id/documents", requireModule, async (req, res) => {
    try {
      const database = await db();
      const { department, error } = await loadDepartmentForMember(database, req, req.params.id);
      if (error) return fail(res, error);
      const memberIds = await memberDepartmentIds(database, req);
      const departmentNames = await departmentNameMap(database);
      const [owned, sharedIn] = await Promise.all([
        database.collection(DOCUMENTS).find({ departmentId: department._id }).sort({ updatedAt: -1 }).toArray(),
        database.collection(DOCUMENTS).find({ sharedWithDepartmentIds: department._id }).sort({ updatedAt: -1 }).toArray(),
      ]);
      res.json({
        department: serializeDepartment(department, { admin: isAdmin(req) }),
        documents: owned.map((doc) => serializeDocument(doc, { manage: canManage(req, memberIds, doc), departmentNames })),
        sharedDocuments: sharedIn.map((doc) => serializeDocument(doc, { manage: canManage(req, memberIds, doc), departmentNames })),
      });
    } catch (error) {
      console.error("Department documents list error:", error);
      res.status(500).json({ error: "Could not load documents" });
    }
  });

  app.post("/department-documents/departments/:id/documents/upload", requireModule, receiveFile, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Choose a file to upload" });
      const database = await db();
      const { department, error } = await loadDepartmentForMember(database, req, req.params.id);
      if (error) return fail(res, error);
      const name = text(req.body?.name, 160);
      const stored = await uploadToDepartmentFolder(department, req.file, name);
      const now = new Date();
      const doc = {
        departmentId: department._id,
        type: "file",
        name: name || stored.originalName,
        description: longText(req.body?.description, 1000),
        category: text(req.body?.category, 60),
        url: "",
        ...stored,
        sharedWithDepartmentIds: [],
        createdBy: actor(req),
        updatedBy: actor(req),
        createdAt: now,
        updatedAt: now,
      };
      const result = await database.collection(DOCUMENTS).insertOne(doc);
      res.locals.activityTarget = `${department.name} · ${doc.name}`;
      res.status(201).json({ id: String(result.insertedId) });
    } catch (error) {
      console.error("Department document upload error:", error.message);
      res.status(400).json({ error: error.message || "Upload failed" });
    } finally {
      cleanupUpload(req);
    }
  });

  app.post("/department-documents/departments/:id/documents/link", requireModule, async (req, res) => {
    try {
      const database = await db();
      const { department, error } = await loadDepartmentForMember(database, req, req.params.id);
      if (error) return fail(res, error);
      if (!["sheet", "form", "link"].includes(req.body?.type)) return res.status(400).json({ error: "Choose sheet, form or link" });
      const fields = await linkFields(database, req.body);
      const now = new Date();
      const doc = {
        departmentId: department._id,
        type: fields.type,
        name: text(req.body?.name, 160) || fields.defaultName,
        description: longText(req.body?.description, 1000),
        category: text(req.body?.category, 60),
        url: fields.url,
        formId: fields.formId,
        formSlug: fields.formSlug,
        sharedWithDepartmentIds: [],
        createdBy: actor(req),
        updatedBy: actor(req),
        createdAt: now,
        updatedAt: now,
      };
      const result = await database.collection(DOCUMENTS).insertOne(doc);
      res.locals.activityTarget = `${department.name} · ${doc.name}`;
      res.status(201).json({ id: String(result.insertedId) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/department-documents/documents/:docId", requireModule, async (req, res) => {
    try {
      const database = await db();
      const { doc, error } = await loadManageableDocument(database, req, req.params.docId);
      if (error) return fail(res, error);
      const update = { updatedAt: new Date(), updatedBy: actor(req) };
      if (req.body?.name !== undefined) {
        const name = text(req.body.name, 160);
        if (!name) return res.status(400).json({ error: "Name cannot be empty" });
        update.name = name;
      }
      if (req.body?.description !== undefined) update.description = longText(req.body.description, 1000);
      if (req.body?.category !== undefined) update.category = text(req.body.category, 60);
      if (doc.type !== "file" && (req.body?.url !== undefined || req.body?.formId !== undefined)) {
        const fields = await linkFields(database, { ...req.body, type: doc.type }, { partial: true });
        if (fields) Object.assign(update, { url: fields.url, formId: fields.formId, formSlug: fields.formSlug });
      }
      await database.collection(DOCUMENTS).updateOne({ _id: doc._id }, { $set: update });
      res.locals.activityTarget = update.name || doc.name;
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Swaps the file behind an uploaded document for a new version, same record and shares.
  app.post("/department-documents/documents/:docId/replace", requireModule, receiveFile, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Choose a file to upload" });
      const database = await db();
      const { doc, error } = await loadManageableDocument(database, req, req.params.docId);
      if (error) return fail(res, error);
      if (doc.type !== "file") return res.status(400).json({ error: "Only uploaded files can be replaced" });
      const department = await database.collection(DEPARTMENTS).findOne({ _id: doc.departmentId });
      if (!department) return res.status(404).json({ error: "Department not found" });
      const stored = await uploadToDepartmentFolder(department, req.file, doc.name);
      await database.collection(DOCUMENTS).updateOne({ _id: doc._id }, { $set: { ...stored, updatedAt: new Date(), updatedBy: actor(req) } });
      await trashDriveFile(doc.driveFileId);
      res.locals.activityTarget = doc.name;
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message || "Replace failed" });
    } finally {
      cleanupUpload(req);
    }
  });

  // Uploaded files move to the shared drive's trash (recoverable there for 30 days).
  app.delete("/department-documents/documents/:docId", requireModule, async (req, res) => {
    try {
      const database = await db();
      const { doc, error } = await loadManageableDocument(database, req, req.params.docId);
      if (error) return fail(res, error);
      await database.collection(DOCUMENTS).deleteOne({ _id: doc._id });
      await trashDriveFile(doc.driveFileId);
      res.locals.activityTarget = doc.name;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/department-documents/documents/:docId/share", requireModule, async (req, res) => {
    try {
      const database = await db();
      const { doc, error } = await loadManageableDocument(database, req, req.params.docId);
      if (error) return fail(res, error);
      const requested = uniqueIds(req.body?.departmentIds).filter((id) => id !== String(doc.departmentId));
      const existing = requested.length
        ? await database.collection(DEPARTMENTS).find({ _id: { $in: requested.map((id) => new ObjectId(id)) } }, { projection: { _id: 1 } }).toArray()
        : [];
      const departmentIds = existing.map((department) => String(department._id));
      const before = new Set((doc.sharedWithDepartmentIds || []).map(String));
      await database.collection(DOCUMENTS).updateOne(
        { _id: doc._id },
        { $set: { sharedWithDepartmentIds: departmentIds.map((id) => new ObjectId(id)), updatedAt: new Date(), updatedBy: actor(req) } },
      );
      const owner = await database.collection(DEPARTMENTS).findOne({ _id: doc.departmentId }, { projection: { name: 1 } });
      await notifyShareTargets(database, req, doc, departmentIds.filter((id) => !before.has(id)), owner?.name || "another department");
      res.locals.activityTarget = doc.name;
      res.json({ success: true, sharedWithDepartmentIds: departmentIds });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Streams an uploaded file from Drive after the visibility check, so members
  // never need direct access to the shared drive.
  app.get("/department-documents/documents/:docId/file", requireModule, async (req, res) => {
    try {
      const database = await db();
      const id = toObjectId(req.params.docId);
      const doc = id && await database.collection(DOCUMENTS).findOne({ _id: id });
      const memberIds = await memberDepartmentIds(database, req);
      if (!doc || !canView(req, memberIds, doc)) return res.status(404).json({ error: "Document not found" });
      if (!doc.driveFileId) return res.status(400).json({ error: "This document has no stored file" });
      const client = await drive();
      const googleNative = String(doc.mimeType || "").startsWith("application/vnd.google-apps");
      const response = googleNative
        ? await client.files.export({ fileId: doc.driveFileId, mimeType: "application/pdf" }, { responseType: "stream" })
        : await client.files.get({ fileId: doc.driveFileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" });
      const filename = doc.originalName || doc.name || "document";
      const contentType = googleNative ? "application/pdf" : doc.mimeType || "application/octet-stream";
      const inline = !req.query.download && INLINE_MIME.test(contentType);
      res.setHeader("Content-Type", inline ? contentType : "application/octet-stream");
      res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'unsafe-inline'");
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      response.data.on("error", () => res.destroy()).pipe(res);
    } catch (error) {
      console.error("Department document file error:", error.message);
      if (!res.headersSent) res.status(502).json({ error: "Could not fetch the file from Google Drive" });
    }
  });
}

module.exports = { registerDepartmentDocumentsModule, DEPARTMENT_DOCUMENTS_MODULE_ID: MODULE_ID };
