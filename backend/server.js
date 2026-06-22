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
const XLSX = require("xlsx");
const { pipeline } = require("@xenova/transformers");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const { processDocument, processSheetText } = require("./lib/processDocument");
const { createWhatsAppService } = require("./lib/whatsappService");
const { callClaude, retrieveRelevantChunks, routeClaudeModel } = require("./lib/claudeRag");
const adminMiscExpensesArchitecture = require("./sheetArchitectures/adminMiscExpenses");
const assetPurchaseRequestsArchitecture = require("./sheetArchitectures/assetPurchaseRequests");
const directorPaymentRequestsArchitecture = require("./sheetArchitectures/directorPaymentRequests");
const projectPaymentRequestsArchitecture = require("./sheetArchitectures/projectPaymentRequests");
const kalhaarPendingTrackerArchitecture = require("./sheetArchitectures/kalhaarPendingTracker");
const asteriaClientDlArchitecture = require("./sheetArchitectures/asteriaClientDl");
const iskonBhavnagarClientDlArchitecture = require("./sheetArchitectures/iskonBhavnagarClientDl");
const kalharClientDlArchitecture = require("./sheetArchitectures/kalharClientDl");
const aurikaClientDlArchitecture = require("./sheetArchitectures/aurikaClientDl");
const devsharnamClientDlArchitecture = require("./sheetArchitectures/devsharnamClientDl");
const empereonClientDlArchitecture = require("./sheetArchitectures/empereonClientDl");
const harmonyClientDlArchitecture = require("./sheetArchitectures/harmonyClientDl");
const imperialClientDlArchitecture = require("./sheetArchitectures/imperialClientDl");
const sheetalClientDlArchitecture = require("./sheetArchitectures/sheetalClientDl");
const silverwhiteClientDlArchitecture = require("./sheetArchitectures/silverwhiteClientDl");

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const app = express();
app.use(cors());
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));
app.use((req, res, next) => {
  if (req.url.startsWith("/api/")) req.url = req.url.slice(4);
  next();
});

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://quantabase:manish1728@quants.u266oxg.mongodb.net/sheets?appName=Quants";
const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY
const SUPER_ADMIN_USERNAME = "AdminUIPL";
const SUPER_ADMIN_PASSWORD = "Admin@9579";
const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "documents", label: "Documents" },
  { id: "sheet-dashboard", label: "Sheet Dashboard" },
  { id: "automations", label: "Automation" },
  { id: "reports", label: "Reports" },
  { id: "activity-log", label: "Activity Log" },
  { id: "manage-roles", label: "Manage Roles" },
];
const SUPER_ADMIN_MENU_ITEMS = [{ id: "whatsapp", label: "WhatsApp" }];
const ALL_MENU_ITEMS = [...MENU_ITEMS, ...SUPER_ADMIN_MENU_ITEMS];
const PRIVILEGE_ITEMS = [
  { id: "upload_documents", label: "Upload documents" },
  { id: "link_sheets", label: "Link Google Sheets" },
  { id: "create_folder", label: "Create document folders" },
  { id: "manage_document_access", label: "Manage document and folder access" },
  { id: "rename_documents", label: "Rename documents" },
  { id: "delete_documents", label: "Delete documents" },
  { id: "toggle_documents", label: "Enable or disable documents" },
  { id: "manage_automations", label: "Create and manage automations" },
  { id: "manage_reports", label: "Manage and delete reports" },
  { id: "view_activity_log", label: "View activity log" },
];

let mongoClient;
let authDb;

async function connectAuthDb() {
  if (authDb) return authDb;
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  authDb = mongoClient.db();
  await authDb.collection("users").createIndex({ usernameLower: 1 }, { unique: true });
  await authDb.collection("roles").createIndex({ nameLower: 1 }, { unique: true });
  await authDb.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await authDb.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await seedSuperAdmin();
  return authDb;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, passwordHash, salt) {
  if (!passwordHash || !salt) return false;
  const candidate = hashPassword(password, salt).hash;
  const candidateBuffer = Buffer.from(candidate, "hex");
  const storedBuffer = Buffer.from(passwordHash, "hex");
  if (candidateBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizeUser(user, role) {
  if (!user) return null;
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName || user.username,
    roleId: user.roleId ? String(user.roleId) : null,
    roleName: role?.name || user.roleName || null,
    menus: role?.menus || user.menus || [],
    privileges: role?.privileges || user.privileges || [],
    isSuperAdmin: Boolean(user.isSuperAdmin),
    blacklisted: Boolean(user.blacklisted),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function formatUserTarget(user) {
  if (!user) return "User";
  const displayName = user.displayName || user.username || "User";
  return user.username && user.username !== displayName ? `${displayName} (${user.username})` : displayName;
}

function formatRoleTarget(role) {
  return role?.name || "Role";
}

async function getRole(roleId) {
  if (!roleId) return null;
  const db = await connectAuthDb();
  return db.collection("roles").findOne({ _id: typeof roleId === "string" ? new ObjectId(roleId) : roleId });
}

async function seedSuperAdmin() {
  const db = authDb;
  const now = new Date();
  const menus = ALL_MENU_ITEMS.map((item) => item.id);
  const privileges = PRIVILEGE_ITEMS.map((item) => item.id);
  const roleResult = await db.collection("roles").findOneAndUpdate(
    { nameLower: "super admin" },
    {
      $set: {
        name: "Super Admin",
        nameLower: "super admin",
        description: "Full platform access",
        menus,
        privileges,
        isSystem: true,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );
  const role = roleResult.value || roleResult;
  const existing = await db.collection("users").findOne({ usernameLower: SUPER_ADMIN_USERNAME.toLowerCase() });
  if (!existing) {
    const password = hashPassword(SUPER_ADMIN_PASSWORD);
    await db.collection("users").insertOne({
      username: SUPER_ADMIN_USERNAME,
      usernameLower: SUPER_ADMIN_USERNAME.toLowerCase(),
      displayName: "Super Admin",
      passwordHash: password.hash,
      passwordSalt: password.salt,
      roleId: role._id,
      isSuperAdmin: true,
      blacklisted: false,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const password = hashPassword(SUPER_ADMIN_PASSWORD);
    await db.collection("users").updateOne(
      { _id: existing._id },
      {
        $set: {
          roleId: role._id,
          isSuperAdmin: true,
          blacklisted: false,
          passwordHash: password.hash,
          passwordSalt: password.salt,
          updatedAt: now,
        },
      }
    );
  }
}

async function requireAuth(req, res, next) {
  try {
    const db = await connectAuthDb();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const session = await db.collection("sessions").findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ error: "Session expired" });
    const user = await db.collection("users").findOne({ _id: session.userId });
    if (!user || user.blacklisted) return res.status(403).json({ error: "User is blocked" });
    const role = await getRole(user.roleId);
    req.user = user;
    req.role = role;
    req.authUser = sanitizeUser(user, role);
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: "Super Admin access required" });
  next();
}

function hasPrivilege(req, privilege) {
  if (req?.user?.isSuperAdmin) return true;
  return Boolean(req?.authUser?.privileges?.includes(privilege));
}

function hasAllDocumentAccess(req) {
  return Boolean(req?.user?.isSuperAdmin);
}

function canCreateFolder(req) {
  return hasPrivilege(req, "create_folder");
}

function canManageDocumentAccess(req) {
  return hasPrivilege(req, "manage_document_access");
}

function requirePrivilege(privilege, message) {
  return (req, res, next) => {
    if (!hasPrivilege(req, privilege)) {
      return res.status(403).json({ error: message || "Permission required" });
    }
    next();
  };
}

async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET_KEY) return true;
  if (!token) return false;

  const params = new URLSearchParams({
    secret: RECAPTCHA_SECRET_KEY,
    response: token,
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await response.json();
  return Boolean(data.success);
}

app.post("/auth/login", async (req, res) => {
  try {
    const db = await connectAuthDb();
    const { username, password, recaptchaToken } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      addActivityLog({ req, action: "Login failed", target: username, status: "failed", details: { reason: "Invalid reCAPTCHA" } });
      return res.status(400).json({ error: "Please complete the reCAPTCHA check" });
    }

    const user = await db.collection("users").findOne({ usernameLower: String(username).toLowerCase() });
    if (!user || user.blacklisted || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      addActivityLog({ req, action: "Login failed", target: username, status: "failed", details: { reason: "Invalid credentials" } });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const role = await getRole(user.roleId);
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    await db.collection("sessions").insertOne({
      userId: user._id,
      tokenHash: hashToken(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL_MS),
    });
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
    addActivityLog({
      req,
      action: "Logged in",
      target: user.username,
      status: "success",
      actor: sanitizeUser(user, role),
    });
    res.json({ token, user: sanitizeUser(user, role), menus: role?.menus || [] });
  } catch (error) {
    console.error("Login error:", error);
    addActivityLog({
      req,
      action: "Login failed",
      target: req.body?.username || "Unknown user",
      status: "failed",
      details: { reason: error.message },
    });
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.authUser, menus: req.role?.menus || [] });
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  const db = await connectAuthDb();
  const token = (req.headers.authorization || "").slice(7);
  await db.collection("sessions").deleteOne({ tokenHash: hashToken(token) });
  addActivityLog({ req, action: "Logged out", target: req.authUser?.username || "User" });
  res.json({ success: true });
});

const whatsappService = createWhatsAppService({
  dataFile: path.join(__dirname, "data", "whatsapp.json"),
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  graphVersion: process.env.META_GRAPH_API_VERSION || "v23.0",
});

app.get("/webhooks/whatsapp", (req, res) => {
  const challenge = whatsappService.verifyWebhook(req.query);
  if (challenge === null) return res.status(403).send("Webhook verification failed");
  return res.status(200).send(challenge);
});

app.post("/webhooks/whatsapp", (req, res) => {
  try {
    whatsappService.handleWebhook(req.body, req.rawBody, req.headers["x-hub-signature-256"]);
    res.sendStatus(200);
  } catch (error) {
    console.error("WhatsApp webhook error:", error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.use(async (req, res, next) => {
  if (req.path.startsWith("/auth/")) return next();
  return requireAuth(req, res, next);
});

app.use(activityLogger);

app.get("/whatsapp/config", requireSuperAdmin, (req, res) => {
  res.json(whatsappService.config());
});

app.get("/whatsapp/health", requireSuperAdmin, async (req, res) => {
  try {
    res.json(await whatsappService.health());
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, code: error.metaCode || null });
  }
});

app.get("/whatsapp/templates", requireSuperAdmin, async (req, res) => {
  try {
    res.json({ templates: await whatsappService.templates() });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message });
  }
});

app.get("/whatsapp/conversations", requireSuperAdmin, (req, res) => {
  res.json({ conversations: whatsappService.listConversations(req.query.search) });
});

app.get("/whatsapp/conversations/:phone/messages", requireSuperAdmin, (req, res) => {
  res.json({ messages: whatsappService.listMessages(req.params.phone) });
});

app.post("/whatsapp/messages", requireSuperAdmin, async (req, res) => {
  try {
    const message = await whatsappService.sendMessage(req.body || {}, req.authUser);
    res.json({ success: true, message });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message, code: error.metaCode || null });
  }
});

app.get("/whatsapp/contacts", requireSuperAdmin, (req, res) => {
  res.json({ contacts: whatsappService.listContacts(req.query.search) });
});

app.post("/whatsapp/contacts", requireSuperAdmin, (req, res) => {
  try {
    res.json({ success: true, contact: whatsappService.saveContact(req.body || {}) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/whatsapp/contacts/:id", requireSuperAdmin, (req, res) => {
  if (!whatsappService.deleteContact(req.params.id)) return res.status(404).json({ error: "Contact not found" });
  res.json({ success: true });
});

app.get("/whatsapp/groups", requireSuperAdmin, (req, res) => {
  res.json({ groups: whatsappService.listGroups() });
});

app.post("/whatsapp/groups", requireSuperAdmin, (req, res) => {
  try {
    res.json({ success: true, group: whatsappService.saveGroup(req.body || {}) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/whatsapp/groups/:id", requireSuperAdmin, (req, res) => {
  if (!whatsappService.deleteGroup(req.params.id)) return res.status(404).json({ error: "Recipient group not found" });
  res.json({ success: true });
});

app.post("/whatsapp/groups/:id/send", requireSuperAdmin, async (req, res) => {
  try {
    res.json({ success: true, ...(await whatsappService.sendGroup(req.params.id, req.body || {}, req.authUser)) });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/admin/menu-items", requireSuperAdmin, (req, res) => {
  res.json({ menuItems: MENU_ITEMS, privilegeItems: PRIVILEGE_ITEMS });
});

app.get("/admin/roles", requireSuperAdmin, async (req, res) => {
  const db = await connectAuthDb();
  const roles = await db.collection("roles").find({}).sort({ createdAt: 1 }).toArray();
  res.json({
    roles: roles.map((role) => ({
      id: String(role._id),
      name: role.name,
      description: role.description || "",
      menus: role.menus || [],
      privileges: role.privileges || [],
      isSystem: Boolean(role.isSystem),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    })),
  });
});

app.post("/admin/roles", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const { name, description, menus = [], privileges = [] } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Role name is required" });
    const allowedMenus = menus.filter((menu) => MENU_ITEMS.some((item) => item.id === menu));
    const allowedPrivileges = privileges.filter((privilege) => PRIVILEGE_ITEMS.some((item) => item.id === privilege));
    const now = new Date();
    const result = await db.collection("roles").insertOne({
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      description: description || "",
      menus: allowedMenus,
      privileges: allowedPrivileges,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    res.json({ success: true, roleId: String(result.insertedId) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Role already exists" });
    res.status(500).json({ error: "Could not create role" });
  }
});

app.patch("/admin/roles/:id", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const roleId = new ObjectId(req.params.id);
    const role = await db.collection("roles").findOne({ _id: roleId });
    if (!role) return res.status(404).json({ error: "Role not found" });
    res.locals.activityTarget = formatRoleTarget(role);
    const { name, description, menus = [], privileges = [] } = req.body || {};
    const allowedMenus = menus.filter((menu) => MENU_ITEMS.some((item) => item.id === menu));
    const allowedPrivileges = privileges.filter((privilege) => PRIVILEGE_ITEMS.some((item) => item.id === privilege));
    const update = {
      description: description || "",
      menus: role.isSystem ? ALL_MENU_ITEMS.map((item) => item.id) : allowedMenus,
      privileges: role.isSystem ? PRIVILEGE_ITEMS.map((item) => item.id) : allowedPrivileges,
      updatedAt: new Date(),
    };
    if (!role.isSystem && name?.trim()) {
      update.name = name.trim();
      update.nameLower = name.trim().toLowerCase();
    }
    await db.collection("roles").updateOne({ _id: roleId }, { $set: update });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not update role" });
  }
});

app.delete("/admin/roles/:id", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const roleId = new ObjectId(req.params.id);
    const role = await db.collection("roles").findOne({ _id: roleId });
    if (!role) return res.status(404).json({ error: "Role not found" });
    if (role.isSystem) return res.status(400).json({ error: "System role cannot be deleted" });
    res.locals.activityTarget = formatRoleTarget(role);
    const usersWithRole = await db.collection("users").countDocuments({ roleId });
    if (usersWithRole > 0) return res.status(400).json({ error: "Assign users to another role first" });
    await db.collection("roles").deleteOne({ _id: roleId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not delete role" });
  }
});

app.get("/admin/users", requireSuperAdmin, async (req, res) => {
  const db = await connectAuthDb();
  const users = await db.collection("users").find({}).sort({ createdAt: -1 }).toArray();
  const roles = await db.collection("roles").find({}).toArray();
  const roleMap = new Map(roles.map((role) => [String(role._id), role]));
  res.json({ users: users.map((user) => sanitizeUser(user, roleMap.get(String(user.roleId)))) });
});

app.post("/admin/users", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const { username, password, displayName, roleId } = req.body || {};
    if (!username?.trim() || !password || !roleId) return res.status(400).json({ error: "Username, password, and role are required" });
    const role = await db.collection("roles").findOne({ _id: new ObjectId(roleId) });
    if (!role) return res.status(404).json({ error: "Role not found" });
    const hashed = hashPassword(password);
    const now = new Date();
    const result = await db.collection("users").insertOne({
      username: username.trim(),
      usernameLower: username.trim().toLowerCase(),
      displayName: displayName || username.trim(),
      passwordHash: hashed.hash,
      passwordSalt: hashed.salt,
      roleId: role._id,
      isSuperAdmin: false,
      blacklisted: false,
      createdAt: now,
      updatedAt: now,
    });
    res.json({ success: true, userId: String(result.insertedId) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Username already exists" });
    res.status(500).json({ error: "Could not create user" });
  }
});

app.patch("/admin/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const userId = new ObjectId(req.params.id);
    const { displayName, roleId, blacklisted } = req.body || {};
    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.locals.activityTarget = formatUserTarget(user);
    const update = { updatedAt: new Date() };
    if (displayName !== undefined) update.displayName = displayName;
    if (roleId) {
      const role = await db.collection("roles").findOne({ _id: new ObjectId(roleId) });
      if (!role) return res.status(404).json({ error: "Role not found" });
      update.roleId = role._id;
    }
    if (blacklisted !== undefined) update.blacklisted = Boolean(blacklisted);
    await db.collection("users").updateOne({ _id: userId }, { $set: update });
    if (blacklisted) await db.collection("sessions").deleteMany({ userId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not update user" });
  }
});

app.post("/admin/users/:id/reset-password", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: "Password is required" });
    const hashed = hashPassword(password);
    const userId = new ObjectId(req.params.id);
    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.locals.activityTarget = formatUserTarget(user);
    await db.collection("users").updateOne(
      { _id: userId },
      { $set: { passwordHash: hashed.hash, passwordSalt: hashed.salt, updatedAt: new Date() } }
    );
    await db.collection("sessions").deleteMany({ userId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not reset password" });
  }
});

app.delete("/admin/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const db = await connectAuthDb();
    const userId = new ObjectId(req.params.id);
    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isSuperAdmin) return res.status(400).json({ error: "Super Admin cannot be deleted" });
    res.locals.activityTarget = formatUserTarget(user);
    await db.collection("users").deleteOne({ _id: userId });
    await db.collection("sessions").deleteMany({ userId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not delete user" });
  }
});

const uploadsDir = path.join(__dirname, "uploads");
const vectorsDir = path.join(__dirname, "vectors");
const dataDir = path.join(__dirname, "data");

[uploadsDir, vectorsDir, dataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const documentsPath = path.join(dataDir, "documents.json");
const foldersPath = path.join(dataDir, "document-folders.json");
const automationsPath = path.join(dataDir, "automations.json");
const reportsPath = path.join(dataDir, "reports.json");
const notificationsPath = path.join(dataDir, "notifications.json");
const activityLogsPath = path.join(dataDir, "activity-logs.json");

let documents = [];
let documentFolders = [];
let automations = [];
let reports = [];
let notifications = [];
let activityLogs = [];
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

if (fs.existsSync(foldersPath)) {
  try {
    documentFolders = JSON.parse(fs.readFileSync(foldersPath, "utf8"));
  } catch (error) {
    console.error("Error loading document folders:", error);
    documentFolders = [];
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

if (fs.existsSync(activityLogsPath)) {
  try {
    activityLogs = JSON.parse(fs.readFileSync(activityLogsPath, "utf8"));
  } catch (error) {
    console.error("Error loading activity logs:", error);
    activityLogs = [];
  }
}

function saveDocuments() {
  try {
    fs.writeFileSync(documentsPath, JSON.stringify(documents, null, 2));
  } catch (error) {
    console.error("Error saving documents:", error);
  }
}

function saveDocumentFolders() {
  try {
    fs.writeFileSync(foldersPath, JSON.stringify(documentFolders, null, 2));
  } catch (error) {
    console.error("Error saving document folders:", error);
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

function saveActivityLogs() {
  try {
    fs.writeFileSync(activityLogsPath, JSON.stringify(activityLogs, null, 2));
  } catch (error) {
    console.error("Error saving activity logs:", error);
  }
}

function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req?.ip || req?.socket?.remoteAddress || null;
}

function getActivityCategory(action = "", pathValue = "") {
  const text = `${action} ${pathValue}`.toLowerCase();
  if (text.includes("whatsapp")) return "whatsapp";
  if (text.includes("document") || text.includes("sheet") || pathValue.startsWith("/upload") || pathValue.startsWith("/drive-documents")) return "document";
  if (text.includes("automation")) return "automation";
  if (text.includes("notification")) return "notification";
  if (text.includes("report")) return "report";
  if (text.includes("role") || text.includes("user") || pathValue.startsWith("/admin/")) return "admin";
  if (text.includes("login") || text.includes("logout") || pathValue.startsWith("/auth/")) return "auth";
  return "system";
}

function addActivityLog({ req, action, target = null, status = "success", details = null, actor = null }) {
  const user = actor || req?.authUser || null;
  const method = req?.method || null;
  const pathValue = req?.originalUrl || req?.url || null;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    action,
    target,
    category: getActivityCategory(action, req?.path || pathValue || ""),
    status,
    details: {
      ...(details && typeof details === "object" ? details : details ? { message: details } : {}),
      userAgent: req?.headers?.["user-agent"] || null,
    },
    method,
    path: pathValue,
    userId: user?.id || null,
    username: user?.username || "System",
    displayName: user?.displayName || user?.username || "System",
    roleName: user?.roleName || null,
    ip: getClientIp(req),
    macAddress: "N/A",
  };
  activityLogs.unshift(entry);
  activityLogs = activityLogs.slice(0, 1000);
  saveActivityLogs();
  return entry;
}

function normalizeIdList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeAccessGrants(body = {}) {
  if (body.visibility && body.visibility !== "selected") return [];
  const allowedUserIds = normalizeIdList(body.allowedUserIds);
  const expiresAt = body.accessExpiresAt ? new Date(body.accessExpiresAt) : null;
  const safeExpiresAt = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.toISOString() : null;
  return allowedUserIds.map((userId) => ({ userId, expiresAt: safeExpiresAt }));
}

function hasActiveGrant(entity, userId) {
  if (!userId) return false;
  const now = Date.now();
  const grants = entity.accessGrants || [];
  if (grants.length === 0 && (entity.allowedUserIds || []).includes(userId)) return true;
  return grants.some((grant) => {
    if (grant.userId !== userId) return false;
    if (!grant.expiresAt) return true;
    return new Date(grant.expiresAt).getTime() > now;
  });
}

function activeGrantUserIds(entity) {
  const now = Date.now();
  const grants = entity.accessGrants || [];
  const ids = new Set(grants.length === 0 ? entity.allowedUserIds || [] : []);
  for (const grant of grants) {
    if (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now) ids.add(grant.userId);
  }
  return [...ids];
}

function isFolderVisible(folder, req) {
  if (!folder) return true;
  if (hasAllDocumentAccess(req)) return true;
  const userId = req.authUser?.id;
  return Boolean(
    folder.visibility === "public" ||
    folder.createdBy === userId ||
    hasActiveGrant(folder, userId)
  );
}

function canContributeToFolder(folder, req) {
  if (!folder) return false;
  if (req.user?.isSuperAdmin) return true;
  const userId = req.authUser?.id;
  return Boolean(folder.createdBy === userId || hasActiveGrant(folder, userId));
}

function requireDocumentContribution(privilege, message) {
  return (req, res, next) => {
    if (hasPrivilege(req, privilege)) return next();
    const folderId = String(req.body?.folderId || "");
    const folder = documentFolders.find((item) => item.id === folderId);
    if (folder && canContributeToFolder(folder, req)) return next();
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: message || "Folder contribution permission required" });
  };
}

function isDocumentVisible(doc, req) {
  if (hasAllDocumentAccess(req)) return true;
  const userId = req.authUser?.id;
  const visibility = doc.visibility || "public";
  const folder = doc.folderId ? documentFolders.find((item) => item.id === doc.folderId) : null;
  if (visibility === "private") return doc.ownerId === userId;
  return Boolean(
    visibility === "public" ||
    doc.ownerId === userId ||
    hasActiveGrant(doc, userId) ||
    isFolderVisible(folder, req)
  );
}

function filterVisibleDocuments(req, source = documents) {
  return source.filter((doc) => isDocumentVisible(doc, req));
}

function notifyUsers(userIds, notification) {
  const uniqueIds = [...new Set((userIds || []).map(String).filter(Boolean))];
  for (const userId of uniqueIds) {
    notifications.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      title: notification.title,
      message: notification.message,
      type: notification.type || "folder",
      createdAt: new Date().toISOString(),
      readAt: null,
    });
  }
  notifications = notifications.slice(0, 1000);
  saveNotifications();
}

function describeActivity(req) {
  const method = req.method;
  const pathValue = req.path;
  const pathId = pathValue.split("/").filter(Boolean).at(-1);
  if (pathValue === "/chat") return null;
  if (method === "POST" && pathValue === "/whatsapp/messages") return { action: "Sent WhatsApp message", target: req.body?.to || "Recipient" };
  if (method === "POST" && /^\/whatsapp\/groups\/[^/]+\/send$/.test(pathValue)) return { action: "Sent WhatsApp broadcast", target: pathValue.split("/")[3] };
  if (method === "POST" && pathValue === "/whatsapp/contacts") return { action: "Saved WhatsApp contact", target: req.body?.name || req.body?.phone || "Contact" };
  if (method === "POST" && pathValue === "/whatsapp/groups") return { action: "Created WhatsApp recipient group", target: req.body?.name || "Recipient group" };
  if (method === "DELETE" && pathValue.startsWith("/whatsapp/contacts/")) return { action: "Deleted WhatsApp contact", target: pathId };
  if (method === "DELETE" && pathValue.startsWith("/whatsapp/groups/")) return { action: "Deleted WhatsApp recipient group", target: pathId };
  if (method === "POST" && pathValue === "/document-folders") return { action: "Created folder", target: req.body?.name || "Folder" };
  if (method === "PATCH" && pathValue.startsWith("/document-folders/")) return { action: "Updated folder", target: req.body?.name || pathId };
  if (method === "DELETE" && pathValue.startsWith("/document-folders/")) return { action: "Deleted folder", target: pathId };
  if (method === "POST" && pathValue === "/upload") return { action: "Uploaded document", target: req.file?.originalname || "Document" };
  if (method === "POST" && pathValue === "/drive-documents") return { action: "Added Drive document", target: req.body?.name || req.body?.url || "Drive document" };
  if (method === "POST" && pathValue === "/sheets") return { action: "Added Google Sheet", target: req.body?.name || req.body?.sheetId || "Sheet" };
  if (method === "DELETE" && pathValue.startsWith("/documents/")) return { action: "Deleted document", target: pathId };
  if (method === "PATCH" && pathValue.startsWith("/documents/") && !pathValue.endsWith("/toggle")) return { action: "Renamed document", target: req.body?.name || pathId };
  if (method === "PATCH" && pathValue.endsWith("/toggle")) return { action: "Toggled document source", target: pathValue.split("/").filter(Boolean).at(-2) };
  if (method === "POST" && pathValue === "/automations") return { action: "Created automation", target: req.body?.name || "Automation" };
  if (method === "PATCH" && pathValue.startsWith("/automations/")) return { action: "Updated automation", target: pathId };
  if (method === "DELETE" && pathValue.startsWith("/automations/")) return { action: "Deleted automation", target: pathId };
  if (method === "POST" && pathValue.endsWith("/run")) return { action: "Ran automation", target: pathValue.split("/").filter(Boolean).at(-2) };
  if (method === "PATCH" && pathValue.startsWith("/notifications/")) return { action: "Marked notification read", target: pathId };
  if (method === "POST" && pathValue === "/notifications/read-all") return { action: "Marked all notifications read", target: "Notifications" };
  if (method === "POST" && pathValue === "/notifications/read") return { action: "Marked selected notifications read", target: "Notifications" };
  if (method === "DELETE" && pathValue === "/notifications") return { action: "Deleted selected notifications", target: "Notifications" };
  if (method === "DELETE" && pathValue.startsWith("/notifications/")) return { action: "Deleted notification", target: pathId };
  if (method === "DELETE" && pathValue.startsWith("/reports/")) return { action: "Deleted report", target: pathId };
  if (method === "PATCH" && pathValue.startsWith("/reports/")) return { action: "Marked report read", target: pathId };
  if (method === "POST" && pathValue === "/admin/roles") return { action: "Created role", target: req.body?.name || "Role" };
  if (method === "PATCH" && pathValue.startsWith("/admin/roles/")) return { action: "Updated role", target: pathId };
  if (method === "DELETE" && pathValue.startsWith("/admin/roles/")) return { action: "Deleted role", target: pathId };
  if (method === "POST" && pathValue === "/admin/users") return { action: "Created user", target: req.body?.username || "User" };
  if (method === "PATCH" && pathValue.startsWith("/admin/users/")) return { action: "Updated user", target: pathId };
  if (method === "POST" && pathValue.endsWith("/reset-password")) return { action: "Reset user password", target: pathValue.split("/").filter(Boolean).at(-2) };
  if (method === "DELETE" && pathValue.startsWith("/admin/users/")) return { action: "Deleted user", target: pathId };
  if (["POST", "PATCH", "DELETE"].includes(method)) return { action: `${method} ${pathValue}`, target: null };
  return null;
}

function activityLogger(req, res, next) {
  const activity = describeActivity(req);
  if (!activity || req.path.startsWith("/activity-logs")) return next();

  res.on("finish", () => {
    addActivityLog({
      req,
      action: activity.action,
      target: res.locals.activityTarget || activity.target,
      status: res.statusCode >= 400 ? "failed" : "success",
      details: { statusCode: res.statusCode },
    });
  });

  next();
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

function extractDriveFileId(value = "") {
  const text = String(value).trim();
  if (!text) return null;

  const filePathMatch = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePathMatch) return filePathMatch[1];

  const documentPathMatch = text.match(/\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (documentPathMatch) return documentPathMatch[1];

  try {
    const url = new URL(text);
    const id = url.searchParams.get("id");
    if (id) return id;
  } catch {
    // Raw Drive IDs are accepted below.
  }

  return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : null;
}

function getDriveLinkType(value = "") {
  const text = String(value);
  if (text.includes("/document/d/")) return "document";
  if (text.includes("/spreadsheets/d/")) return "spreadsheet";
  if (text.includes("/presentation/d/")) return "presentation";
  return "file";
}

function safeFileName(name = "drive-document") {
  const cleaned = String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "drive-document";
}

function driveExportInfo(mimeType) {
  const exports = {
    "application/vnd.google-apps.document": {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: ".docx",
    },
    "application/vnd.google-apps.spreadsheet": {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: ".xlsx",
    },
    "application/vnd.google-apps.presentation": {
      mimeType: "application/pdf",
      extension: ".pdf",
    },
    "application/vnd.google-apps.drawing": {
      mimeType: "application/pdf",
      extension: ".pdf",
    },
  };
  return exports[mimeType] || null;
}

function extensionFromMimeType(mimeType) {
  const map = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
  };
  return map[mimeType] || "";
}

function publicDriveDownloadInfo(urlOrId, fileId) {
  const type = getDriveLinkType(urlOrId);
  if (type === "document") {
    return {
      url: `https://docs.google.com/document/d/${fileId}/export?format=docx`,
      name: `Drive-${fileId.slice(0, 8)}.docx`,
    };
  }
  if (type === "spreadsheet") {
    return {
      url: `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
      name: `Drive-${fileId.slice(0, 8)}.xlsx`,
    };
  }
  if (type === "presentation") {
    return {
      url: `https://docs.google.com/presentation/d/${fileId}/export/pdf`,
      name: `Drive-${fileId.slice(0, 8)}.pdf`,
    };
  }
  return {
    url: `https://drive.google.com/uc?export=download&id=${fileId}`,
    name: `Drive-${fileId.slice(0, 8)}`,
  };
}

function getFileNameFromContentDisposition(value) {
  if (!value) return null;
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
  const plainMatch = value.match(/filename="?([^"]+)"?/i);
  return plainMatch ? plainMatch[1] : null;
}

async function writeStreamToFile(stream, filePath) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(filePath);
    stream
      .on("error", reject)
      .pipe(output)
      .on("finish", resolve)
      .on("error", reject);
  });
}

async function downloadPublicDriveDocument(urlOrId, documentId, fileId) {
  const info = publicDriveDownloadInfo(urlOrId, fileId);
  const response = await fetch(info.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Drive public download failed (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Drive returned a web page instead of the file. Share the file with the service account or enable anyone-with-link viewer access.");
  }

  let originalName = safeFileName(
    getFileNameFromContentDisposition(response.headers.get("content-disposition")) || info.name
  );
  const fallbackExt = extensionFromMimeType(contentType.split(";")[0].trim());
  if (!path.extname(originalName) && fallbackExt) originalName += fallbackExt;

  const filePath = path.join(uploadsDir, `${documentId}-${originalName}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, bytes);

  return {
    filePath,
    originalName,
    fileSize: bytes.length,
    driveFileId: fileId,
    driveMimeType: contentType || null,
    driveModifiedTime: null,
    driveWebViewLink: String(urlOrId),
    downloadMethod: "public-link",
  };
}

async function downloadDriveDocumentWithServiceAccount(urlOrId, documentId, fileId) {
  if (!fileId) {
    throw new Error("Invalid Google Drive link or file ID");
  }

  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const metadataResponse = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,modifiedTime,webViewLink",
  });
  const file = metadataResponse.data;
  const exportInfo = driveExportInfo(file.mimeType);
  let originalName = safeFileName(file.name || `Drive-${fileId.slice(0, 8)}`);
  let downloadResponse;

  if (exportInfo) {
    const currentExt = path.extname(originalName).toLowerCase();
    if (currentExt !== exportInfo.extension) originalName += exportInfo.extension;
    downloadResponse = await drive.files.export(
      { fileId, mimeType: exportInfo.mimeType },
      { responseType: "stream" }
    );
  } else {
    const fallbackExt = extensionFromMimeType(file.mimeType);
    if (!path.extname(originalName) && fallbackExt) originalName += fallbackExt;
    downloadResponse = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
  }

  const filePath = path.join(uploadsDir, `${documentId}-${originalName}`);
  await writeStreamToFile(downloadResponse.data, filePath);

  return {
    filePath,
    originalName,
    fileSize: fs.statSync(filePath).size,
    driveFileId: file.id,
    driveMimeType: file.mimeType,
    driveModifiedTime: file.modifiedTime || null,
    driveWebViewLink: file.webViewLink || null,
    downloadMethod: "service-account",
  };
}

async function downloadDriveDocument(urlOrId, documentId) {
  const fileId = extractDriveFileId(urlOrId);
  if (!fileId) {
    throw new Error("Invalid Google Drive link or file ID");
  }

  try {
    return await downloadDriveDocumentWithServiceAccount(urlOrId, documentId, fileId);
  } catch (serviceAccountError) {
    console.warn("Service account Drive download failed, trying public link fallback:", serviceAccountError.message);
    try {
      return await downloadPublicDriveDocument(urlOrId, documentId, fileId);
    } catch (publicError) {
      throw new Error(`${serviceAccountError.message}. Public link fallback also failed: ${publicError.message}`);
    }
  }
}

async function processDriveDocument(documentId, url, requestedName) {
  try {
    processingStatus[documentId] = { stage: "Downloading from Drive" };
    const driveFile = await downloadDriveDocument(url, documentId);
    const displayName = String(requestedName || "").trim() || driveFile.originalName;
    const docIndex = documents.findIndex((doc) => doc.id === documentId);

    if (docIndex === -1) {
      if (driveFile.filePath && fs.existsSync(driveFile.filePath)) fs.unlinkSync(driveFile.filePath);
      return;
    }

    documents[docIndex] = {
      ...documents[docIndex],
      name: displayName,
      driveFileId: driveFile.driveFileId,
      driveMimeType: driveFile.driveMimeType,
      driveModifiedTime: driveFile.driveModifiedTime,
      driveWebViewLink: driveFile.driveWebViewLink,
      downloadMethod: driveFile.downloadMethod,
      filePath: driveFile.filePath,
      fileSize: driveFile.fileSize,
      status: "processing",
      error: null,
    };
    saveDocuments();

    processingStatus[documentId] = { stage: "Downloaded from Drive" };
    processDocument(
      driveFile.filePath,
      documentId,
      processingStatus,
      driveFile.originalName,
      documents,
      saveDocuments,
      vectorsDir,
      { deleteSourceAfterProcessing: true, deleteSourceOnFailure: true }
    );
  } catch (error) {
    console.error(`Drive document processing failed for ${documentId}:`, error);
    processingStatus[documentId] = { stage: "Failed", error: error.message };
    const docIndex = documents.findIndex((doc) => doc.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex] = {
        ...documents[docIndex],
        status: "failed",
        isReady: false,
        error: error.message,
      };
      saveDocuments();
    }
  }
}

function isOfficeSpreadsheetError(error) {
  const message = String(error?.message || "");
  return /must not be an Office file|not supported for this document/i.test(message);
}

async function fetchOfficeWorkbookValues(sheetId) {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const downloadResponse = await drive.files.get(
      { fileId: sheetId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const bytes = Buffer.from(downloadResponse.data);
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
    return workbook.SheetNames.map((name) => ({
      name,
      values: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      }),
    }));
  } catch (error) {
    throw new Error(`The Office workbook could not be downloaded. Make sure it is shared with the service account. (${error.message})`);
  }
}

async function fetchRawSheetValues(sheetId) {
  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const result = [];
    for (const sheet of meta.data.sheets || []) {
      const name = sheet.properties.title;
      const safeRange = `'${name.replace(/'/g, "''")}'`;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: safeRange });
      result.push({ name, values: response.data.values || [] });
    }
    return result;
  } catch (error) {
    if (!isOfficeSpreadsheetError(error)) throw error;
    console.log(`Sheet ${sheetId} is an Office workbook; using XLSX export fallback.`);
    return fetchOfficeWorkbookValues(sheetId);
  }
}

async function fetchSheetText(sheetId) {
  const sheets = await fetchRawSheetValues(sheetId);

  let fullText = "";

  for (const sheet of sheets) {
    fullText += `Sheet: ${sheet.name}\n`;
    const rows = sheet.values || [];
    rows.forEach((row) => {
      fullText += row.join(" | ") + "\n";
    });
    fullText += "\n";
  }

  return fullText;
}

async function fetchSheetRows(sheetId) {
  const sheets = await fetchSheetDataset(sheetId);
  return sheets.flatMap((sheet) => sheet.rows);
}

function buildGenericPreparedSheet(values) {
  return {
    headers: (values[0] || []).map((value) => String(value).trim()),
    rows: values.slice(1),
    firstDataRow: 2,
  };
}

async function fetchSheetDataset(sheetId) {
  const sheets = await fetchRawSheetValues(sheetId);
  const result = [];

  for (const sheet of sheets) {
    const title = sheet.name;
    const values = sheet.values || [];
    const prepared = sheetId === kalhaarPendingTrackerArchitecture.SHEET_ID
      ? kalhaarPendingTrackerArchitecture.prepareSheet(title, values)
      : sheetId === asteriaClientDlArchitecture.SHEET_ID
      ? asteriaClientDlArchitecture.prepareSheet(title, values)
      : sheetId === kalharClientDlArchitecture.SHEET_ID
      ? kalharClientDlArchitecture.prepareSheet(title, values)
      : sheetId === aurikaClientDlArchitecture.SHEET_ID
      ? aurikaClientDlArchitecture.prepareSheet(title, values)
      : sheetId === devsharnamClientDlArchitecture.SHEET_ID
      ? devsharnamClientDlArchitecture.prepareSheet(title, values)
      : sheetId === harmonyClientDlArchitecture.SHEET_ID
      ? harmonyClientDlArchitecture.prepareSheet(title, values)
      : sheetId === imperialClientDlArchitecture.SHEET_ID
      ? imperialClientDlArchitecture.prepareSheet(title, values)
      : sheetId === sheetalClientDlArchitecture.SHEET_ID
      ? sheetalClientDlArchitecture.prepareSheet(title, values)
      : sheetId === empereonClientDlArchitecture.SHEET_ID
      ? empereonClientDlArchitecture.prepareSheet(title, values)
      : sheetId === silverwhiteClientDlArchitecture.SHEET_ID
      ? silverwhiteClientDlArchitecture.prepareSheet(title, values)
      : sheetId === iskonBhavnagarClientDlArchitecture.SHEET_ID
      ? iskonBhavnagarClientDlArchitecture.prepareSheet(title, values)
      : buildGenericPreparedSheet(values);
    const headers = prepared.headers;
    const rows = prepared.rows.map((row, index) => {
      const item = { __sheetName: title, __rowIndex: index + prepared.firstDataRow };
      headers.forEach((header, columnIndex) => {
        item[header] = row[columnIndex] !== undefined ? row[columnIndex] : "";
      });
      return item;
    });
    result.push({ name: title, headers, rows, meta: prepared.meta || {} });
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

    processingStatus[documentId] = { stage: "Profiling Sheet" };
    const sheetData = await fetchSheetDataset(sheetId);
    await saveSheetArchitecture(documentId, sheetData);
    processingStatus[documentId] = { stage: "Ready", ready: true };
  } catch (error) {
    console.error(`syncSheet error for ${documentId}:`, error.message);
    processingStatus[documentId] = { stage: "Failed", error: error.message };

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      if (documents[docIndex].isReady && documents[docIndex].chunks > 0) {
        documents[docIndex].architectureError = error.message;
      } else {
        documents[docIndex].status = "failed";
        documents[docIndex].error = error.message;
      }
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
  const text = String(v)
    .replace(/\/-/g, "")
    .replace(/\/=/g, "")
    .replace(/,/g, "")
    .replace(/[₹$€£]/g, " ")
    .replace(/\b(inr|rs\.?|rupees?)\b/gi, " ");
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  const amount = match ? Number(match[0]) : 0;
  const suffix = match ? text.slice(match.index + match[0].length).trim().toLowerCase() : "";
  const multiplier = /^cr(?:ore)?\b/.test(suffix)
    ? 10000000
    : /^(lac|lakh)\b/.test(suffix)
    ? 100000
    : /^k\b/.test(suffix)
    ? 1000
    : 1;
  const n = amount * multiplier;
  return Number.isFinite(n) ? n : 0;
}

function isNumericCell(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return /[-+]?[₹$€£]?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:\/-|\/=|%|inr|rs\.?|rupees?))?/i.test(text);
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

function getFilledValues(rows, column) {
  return rows
    .map((row) => row[column])
    .filter((value) => String(value ?? "").trim() !== "");
}

function inferColumnType(values, columnName = "") {
  if (values.length === 0) return "empty";
  const sample = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (sample.length === 0) return "empty";

  const looksLikeDate = (value) =>
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})$/.test(value);
  const numericCount = sample.filter(isNumericCell).length;
  const dateCount = sample.filter((value) => looksLikeDate(value) && !Number.isNaN(Date.parse(value))).length;
  const emailCount = sample.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).length;
  const urlCount = sample.filter((value) => /^https?:\/\//i.test(value)).length;
  const boolCount = sample.filter((value) => /^(true|false|yes|no|y|n)$/i.test(value)).length;
  const percentCount = sample.filter((value) => /%$/.test(value)).length;
  const moneyCount = sample.filter((value) => /^[₹$€£]|\b(inr|usd|eur|gbp)\b/i.test(value)).length;
  const threshold = Math.max(2, Math.ceil(sample.length * 0.7));

  if (emailCount >= threshold) return "email";
  if (urlCount >= threshold) return "url";
  if (boolCount >= threshold) return "boolean";
  if (moneyCount >= threshold) return "currency";
  if (percentCount >= threshold) return "percentage";
  if (numericCount >= threshold) return "number";
  if (dateCount >= threshold) return "date";

  const uniqueCount = new Set(sample.map((value) => value.toLowerCase())).size;
  if (/status|state|stage|priority|category|type|department|team|role/i.test(columnName)) return "category";
  if (uniqueCount <= Math.max(8, Math.ceil(sample.length * 0.25))) return "category";
  return "text";
}

function inferColumnRole(columnName, type) {
  if (/^(id|.* id|.*_id|.*#|invoice|order|ticket|reference|ref)/i.test(columnName)) return "identifier";
  if (/name|title|subject|employee|client|customer|project/i.test(columnName)) return "label";
  if (/email|phone|mobile|contact/i.test(columnName)) return "contact";
  if (/date|time|created|updated|synced|due|deadline/i.test(columnName)) return "timeline";
  if (/status|state|stage|priority/i.test(columnName)) return "workflow";
  if (/amount|price|cost|salary|revenue|total|balance|due|paid/i.test(columnName) || ["number", "currency", "percentage"].includes(type)) return "metric";
  if (type === "category") return "segment";
  return "detail";
}

function topValues(values, limit = 6) {
  const counts = {};
  for (const value of values) {
    const label = String(value ?? "").trim() || "Blank";
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function extractUrls(value) {
  return String(value ?? "").match(/https?:\/\/[^\s,]+/g) || [];
}

function profileColumn(rows, column) {
  const values = getFilledValues(rows, column);
  const type = inferColumnType(values, column);
  const urls = values.flatMap(extractUrls);
  const unique = new Set(values.map((value) => String(value).trim().toLowerCase())).size;
  const profile = {
    name: column,
    type: urls.length >= Math.max(1, Math.ceil(values.length * 0.5)) ? "url" : type,
    role: urls.length >= Math.max(1, Math.ceil(values.length * 0.5)) ? "media" : inferColumnRole(column, type),
    filled: values.length,
    blank: Math.max(0, rows.length - values.length),
    unique,
    examples: [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, 3),
  };

  if (urls.length > 0) {
    profile.linkCount = urls.length;
    profile.examples = [...new Set(urls)].slice(0, 3);
  }

  if (["number", "currency", "percentage"].includes(type)) {
    const numericValues = values.filter(isNumericCell).map(parseMoney);
    if (numericValues.length > 0) {
      profile.stats = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        total: numericValues.reduce((sum, value) => sum + value, 0),
        average: numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length,
      };
    }
  }

  if (["category", "boolean"].includes(type)) {
    profile.topValues = topValues(values);
  }

  return profile;
}

function buildDashboardHints(tabs) {
  return tabs.map((tab) => {
    const columns = tab.columns || [];
    const findByName = (patterns) =>
      columns.find((column) => patterns.some((pattern) => pattern.test(column.name)))?.name || null;
    const dateColumn =
      findByName([/timestamp/i, /\bdate\b/i, /created/i, /updated/i]) ||
      columns.find((column) => column.role === "timeline" || column.type === "date")?.name ||
      null;
    const entityColumn =
      findByName([/^site$/i, /project/i, /client/i, /customer/i, /location/i]) ||
      tab.primaryLabel ||
      columns.find((column) => column.role === "label")?.name ||
      tab.headers?.[0] ||
      null;
    const ownerColumn =
      findByName([/person/i, /owner/i, /manager/i, /lead/i, /assigned/i]) ||
      columns.find((column) => column.role === "contact")?.name ||
      null;
    const mediaColumns = columns.filter((column) => column.role === "media" || column.type === "url").map((column) => column.name);
    const metricColumns = columns.filter((column) => column.role === "metric").map((column) => column.name);
    const statusColumns = columns.filter((column) => column.role === "workflow").map((column) => column.name);
    const narrativeColumns = columns
      .filter((column) =>
        column.role === "detail" &&
        column.type === "text" &&
        !mediaColumns.includes(column.name) &&
        ![entityColumn, ownerColumn].includes(column.name)
      )
      .map((column) => column.name);

    return {
      tab: tab.name,
      dateColumn,
      entityColumn,
      ownerColumn,
      mediaColumns,
      metricColumns,
      statusColumns,
      narrativeColumns,
      cardTitle: entityColumn,
      cardSubtitle: ownerColumn,
      detailFields: [...new Set([...narrativeColumns, ...statusColumns])].slice(0, 8),
      chartFields: [...new Set([entityColumn, ownerColumn, ...statusColumns, ...metricColumns])].filter(Boolean).slice(0, 8),
    };
  });
}

const SHEET_ARCHITECTURE_VERSION = 10;
const sheetArchitectureProfiles = [
  kalhaarPendingTrackerArchitecture,
  asteriaClientDlArchitecture,
  iskonBhavnagarClientDlArchitecture,
  kalharClientDlArchitecture,
  aurikaClientDlArchitecture,
  devsharnamClientDlArchitecture,
  empereonClientDlArchitecture,
  harmonyClientDlArchitecture,
  imperialClientDlArchitecture,
  sheetalClientDlArchitecture,
  silverwhiteClientDlArchitecture,
  adminMiscExpensesArchitecture,
  assetPurchaseRequestsArchitecture,
  directorPaymentRequestsArchitecture,
  projectPaymentRequestsArchitecture,
];

function getSheetProfileDisplayName(sheetId) {
  if (sheetId === kalhaarPendingTrackerArchitecture.SHEET_ID) return "Kalhaar Consolidated Pending Tracker";
  if (sheetId === asteriaClientDlArchitecture.SHEET_ID) return "Asteria Client DL Dashboard";
  if (sheetId === kalharClientDlArchitecture.SHEET_ID) return "Kalhar Client DL Dashboard";
  if (sheetId === aurikaClientDlArchitecture.SHEET_ID) return "Aurika Client DL Dashboard";
  if (sheetId === devsharnamClientDlArchitecture.SHEET_ID) return "Devsharnam Client DL Dashboard";
  if (sheetId === empereonClientDlArchitecture.SHEET_ID) return "The Empereon Client DL Dashboard";
  if (sheetId === harmonyClientDlArchitecture.SHEET_ID) return "Harmony Client DL Dashboard";
  if (sheetId === imperialClientDlArchitecture.SHEET_ID) return "Imperial Park Client DL Dashboard";
  if (sheetId === sheetalClientDlArchitecture.SHEET_ID) return "Sheetal Gharana Client DL Dashboard";
  if (sheetId === silverwhiteClientDlArchitecture.SHEET_ID) return "Silver White Client DL Dashboard";
  if (sheetId === iskonBhavnagarClientDlArchitecture.SHEET_ID) return "Iskon Bhavnagar Client DL";
  if (sheetId === adminMiscExpensesArchitecture.SHEET_ID) return "Admin & Misc Expense Requests";
  if (sheetId === assetPurchaseRequestsArchitecture.SHEET_ID) return "Asset Purchase Requests";
  if (sheetId === directorPaymentRequestsArchitecture.SHEET_ID) return "Director Payment Requests";
  if (sheetId === projectPaymentRequestsArchitecture.SHEET_ID) return "Project Payment Requests";
  return null;
}

function buildSheetArchitecture(sheetData, doc = {}) {
  const tabs = sheetData.map((sheet) => {
    const columns = sheet.headers.map((header) => profileColumn(sheet.rows, header));
    return {
      name: sheet.name,
      rowCount: sheet.rows.length,
      columnCount: sheet.headers.length,
      headers: sheet.headers,
      columns,
      primaryLabel: columns.find((column) => column.role === "label")?.name || sheet.headers[0] || null,
      keyMetrics: columns.filter((column) => column.role === "metric").slice(0, 6).map((column) => column.name),
      workflowColumns: columns.filter((column) => column.role === "workflow").map((column) => column.name),
      segmentColumns: columns.filter((column) => column.role === "segment").slice(0, 6).map((column) => column.name),
    };
  });

  const allColumns = tabs.flatMap((tab) => tab.columns.map((column) => ({ tab: tab.name, ...column })));
  const totalRows = tabs.reduce((sum, tab) => sum + tab.rowCount, 0);
  const typeCounts = allColumns.reduce((counts, column) => {
    counts[column.type] = (counts[column.type] || 0) + 1;
    return counts;
  }, {});

  const suggestedViews = [];
  if (allColumns.some((column) => column.role === "workflow")) suggestedViews.push("workflow");
  if (allColumns.some((column) => column.role === "metric")) suggestedViews.push("metrics");
  if (allColumns.some((column) => column.role === "timeline")) suggestedViews.push("timeline");
  if (allColumns.some((column) => column.role === "segment")) suggestedViews.push("segments");
  if (suggestedViews.length === 0) suggestedViews.push("records");

  return {
    version: SHEET_ARCHITECTURE_VERSION,
    documentId: doc.id || null,
    sheetId: doc.sheetId || null,
    savedAt: new Date().toISOString(),
    sourceModifiedTime: doc.lastModifiedTime || null,
    summary: {
      tabCount: tabs.length,
      totalRows,
      totalColumns: allColumns.length,
      typeCounts,
      suggestedViews,
    },
    tabs,
    dashboard: buildDashboardHints(tabs),
  };
}

function applySheetArchitectureProfile(architecture, sheetData, doc = {}) {
  const profile = sheetArchitectureProfiles.find((item) => item.matches({ doc, sheetData, architecture }));
  return profile ? profile.apply(architecture, sheetData, doc) : architecture;
}

async function enrichSheetArchitectureWithAi(architecture, sheetData, documentName) {
  if (!process.env.GROQ_API_KEY) return architecture;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const sampleRows = sheetData.map((sheet) => ({
      tab: sheet.name,
      headers: sheet.headers,
      sampleRows: sheet.rows.slice(0, 5).map(({ __sheetName, __rowIndex, ...row }) => row),
    }));
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_AUTOMATION_MODEL || "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You profile spreadsheet architecture. Return compact JSON only with keys: purpose, recordName, importantColumns, recommendedViews, notes. Do not invent columns.",
        },
        {
          role: "user",
          content: JSON.stringify({
            documentName,
            deterministicArchitecture: architecture.summary,
            tabs: sampleRows,
          }),
        },
      ],
      temperature: 0.1,
      max_tokens: 700,
    });
    const content = completion.choices?.[0]?.message?.content || "";
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    return { ...architecture, ai: JSON.parse(jsonText) };
  } catch (error) {
    console.warn("Could not generate AI sheet architecture:", error.message);
    return architecture;
  }
}

async function saveSheetArchitecture(documentId, sheetData) {
  const docIndex = documents.findIndex((d) => d.id === documentId && d.type === "sheet");
  if (docIndex === -1) return null;

  const architecture = await enrichSheetArchitectureWithAi(
    applySheetArchitectureProfile(buildSheetArchitecture(sheetData, documents[docIndex]), sheetData, documents[docIndex]),
    sheetData,
    documents[docIndex].name
  );
  documents[docIndex].sheetArchitecture = architecture;
  documents[docIndex].architectureSavedAt = architecture.savedAt;
  saveDocuments();
  return architecture;
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
  addActivityLog({
    action: "Automation run completed",
    target: automation.name,
    status: report.status === "failed" ? "failed" : "success",
    details: {
      reportId: report.id,
      rowsChecked: report.totalRowsChecked,
      matched: report.totalMatched,
    },
  });

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

app.get("/documents", async (req, res) => {
  const visibleFolders = documentFolders
    .filter((folder) => isFolderVisible(folder, req))
    .map((folder) => ({
      ...folder,
      allowedUserIds: activeGrantUserIds(folder),
      canContribute: canContributeToFolder(folder, req),
    }));
  const visibleDocuments = filterVisibleDocuments(req);
  const updatedDocuments = visibleDocuments.map((doc) => {
    const vectorPath = path.join(vectorsDir, `${doc.id}.json`);
    const vectorExists = fs.existsSync(vectorPath);
    return {
      ...doc,
      allowedUserIds: activeGrantUserIds(doc),
      isReady: vectorExists && doc.isReady,
      isActive: doc.isActive !== undefined ? doc.isActive : true,
    };
  });

  let users = [];
  if (
    canManageDocumentAccess(req) ||
    canCreateFolder(req) ||
    hasPrivilege(req, "upload_documents") ||
    hasPrivilege(req, "link_sheets") ||
    visibleFolders.some((folder) => folder.canContribute)
  ) {
    const db = await connectAuthDb();
    const rawUsers = await db.collection("users").find({ blacklisted: { $ne: true } }).sort({ displayName: 1 }).toArray();
    users = rawUsers.map((user) => ({
      id: String(user._id),
      username: user.username,
      displayName: user.displayName || user.username,
      isSuperAdmin: Boolean(user.isSuperAdmin),
    }));
  }

  res.json({
    documents: updatedDocuments,
    folders: visibleFolders,
    users,
    privileges: req.authUser?.privileges || [],
    canCreateFolder: canCreateFolder(req),
    canManageDocumentAccess: canManageDocumentAccess(req),
    canSeeAllDocuments: hasAllDocumentAccess(req),
    actionPermissions: {
      uploadDocuments: hasPrivilege(req, "upload_documents"),
      linkSheets: hasPrivilege(req, "link_sheets"),
      createFolder: canCreateFolder(req),
      manageDocumentAccess: canManageDocumentAccess(req),
      renameDocuments: hasPrivilege(req, "rename_documents"),
      deleteDocuments: hasPrivilege(req, "delete_documents"),
      toggleDocuments: hasPrivilege(req, "toggle_documents"),
    },
  });
});

app.post("/document-folders", (req, res) => {
  try {
    if (!canCreateFolder(req)) {
      return res.status(403).json({ error: "Folder creation permission required" });
    }

    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Folder name is required" });

    const accessGrants = normalizeAccessGrants(req.body);
    const allowedUserIds = activeGrantUserIds({ accessGrants });
    const folder = {
      id: Date.now().toString(),
      name,
      visibility: req.body?.visibility === "public" ? "public" : "selected",
      allowedUserIds,
      accessGrants,
      createdBy: req.authUser?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    documentFolders.unshift(folder);
    saveDocumentFolders();
    res.locals.activityTarget = name;

    notifyUsers(allowedUserIds, {
      title: "Folder access granted",
      message: `${req.authUser?.displayName || "Admin"} gave you access to ${name}.`,
      type: "folder",
    });

    res.json({ success: true, folder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/document-folders/:id", (req, res) => {
  try {
    const folder = documentFolders.find((item) => item.id === req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!canManageDocumentAccess(req) && folder.createdBy !== req.authUser?.id) {
      return res.status(403).json({ error: "Folder access permission required" });
    }

    const previousUserIds = new Set(activeGrantUserIds(folder));
    if (req.body?.name !== undefined) folder.name = String(req.body.name || "").trim() || folder.name;
    if (req.body?.visibility !== undefined) folder.visibility = req.body.visibility === "public" ? "public" : "selected";
    if (req.body?.allowedUserIds !== undefined) {
      folder.accessGrants = normalizeAccessGrants(req.body);
      folder.allowedUserIds = activeGrantUserIds(folder);
    }
    folder.updatedAt = new Date().toISOString();
    saveDocumentFolders();
    res.locals.activityTarget = folder.name;

    const newlyAssigned = activeGrantUserIds(folder).filter((id) => !previousUserIds.has(id));
    notifyUsers(newlyAssigned, {
      title: "Folder access granted",
      message: `${req.authUser?.displayName || "Admin"} gave you access to ${folder.name}.`,
      type: "folder",
    });

    res.json({ success: true, folder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/document-folders/:id", (req, res) => {
  try {
    const folder = documentFolders.find((item) => item.id === req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (!canManageDocumentAccess(req) && folder.createdBy !== req.authUser?.id) {
      return res.status(403).json({ error: "Folder access permission required" });
    }

    documentFolders = documentFolders.filter((item) => item.id !== req.params.id);
    documents = documents.map((doc) => doc.folderId === req.params.id ? { ...doc, folderId: null } : doc);
    saveDocumentFolders();
    saveDocuments();
    res.locals.activityTarget = folder.name;
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/upload", upload.single("pdf"), requireDocumentContribution("upload_documents", "Upload inside an assigned folder or request upload permission"), async (req, res) => {
  try {
    const documentId = Date.now().toString();
    const pdfPath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const folderId = req.body?.folderId || null;
    const accessGrants = normalizeAccessGrants(req.body);
    const allowedUserIds = activeGrantUserIds({ accessGrants });
    const visibility = req.body?.visibility || (allowedUserIds.length > 0 ? "selected" : "private");

    const newDoc = {
      id: documentId,
      name: originalName,
      type: "file",
      ownerId: req.authUser?.id || null,
      ownerName: req.authUser?.displayName || req.authUser?.username || null,
      folderId,
      visibility,
      allowedUserIds,
      accessGrants,
      source: "local",
      sourceLabel: "Added from local computer drive",
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
      vectorsDir,
      { deleteSourceAfterProcessing: true }
    );

    res.json({ success: true, documentId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/drive-documents", requireDocumentContribution("upload_documents", "Add Drive documents inside an assigned folder or request upload permission"), async (req, res) => {
  try {
    const { url, name } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Google Drive link is required" });
    }

    const fileId = extractDriveFileId(url);
    if (!fileId) {
      return res.status(400).json({ error: "Invalid Google Drive link or file ID" });
    }

    const documentId = Date.now().toString();
    const displayName = String(name || "").trim() || `Drive-${fileId.slice(0, 8)}`;
    const accessGrants = normalizeAccessGrants(req.body);
    const allowedUserIds = activeGrantUserIds({ accessGrants });
    const visibility = req.body?.visibility || (allowedUserIds.length > 0 ? "selected" : "private");

    const newDoc = {
      id: documentId,
      name: displayName,
      type: "file",
      ownerId: req.authUser?.id || null,
      ownerName: req.authUser?.displayName || req.authUser?.username || null,
      folderId: req.body?.folderId || null,
      visibility,
      allowedUserIds,
      accessGrants,
      source: "drive",
      sourceLabel: "Added from Drive",
      driveUrl: url,
      driveFileId: fileId,
      filePath: null,
      fileSize: null,
      uploadedAt: new Date().toISOString(),
      isActive: true,
      isReady: false,
      chunks: 0,
      status: "processing",
    };

    documents.push(newDoc);
    saveDocuments();
    res.locals.activityTarget = displayName;

    processingStatus[documentId] = { stage: "Downloading from Drive" };
    void processDriveDocument(documentId, url, name);

    res.json({
      success: true,
      documentId,
      name: displayName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/sheets", requireDocumentContribution("link_sheets", "Link sheets inside an assigned folder or request sheet permission"), async (req, res) => {
  try {
    const { sheetId, name } = req.body;

    if (!sheetId) {
      return res.status(400).json({ error: "sheetId is required" });
    }

    const existingDoc = documents.find((doc) => doc.type === "sheet" && doc.sheetId === sheetId);
    if (existingDoc) {
      if (!isDocumentVisible(existingDoc, req)) {
        return res.status(403).json({ error: "This sheet already exists but is not shared with you" });
      }
      const profileName = getSheetProfileDisplayName(sheetId);
      if (profileName && existingDoc.name !== profileName) {
        existingDoc.name = profileName;
        saveDocuments();
      }
      if (existingDoc.status === "failed" || !existingDoc.isReady) {
        existingDoc.status = "processing";
        existingDoc.error = null;
        saveDocuments();
        syncSheet(existingDoc.id, existingDoc.sheetId);
      }
      return res.json({ success: true, documentId: existingDoc.id, existing: true });
    }

    const documentId = Date.now().toString();
    const profileName = getSheetProfileDisplayName(sheetId);
    const accessGrants = normalizeAccessGrants(req.body);
    const allowedUserIds = activeGrantUserIds({ accessGrants });
    const visibility = req.body?.visibility || (allowedUserIds.length > 0 ? "selected" : "private");

    const newDoc = {
      id: documentId,
      name: name || profileName || `Sheet-${sheetId.slice(0, 8)}`,
      type: "sheet",
      ownerId: req.authUser?.id || null,
      ownerName: req.authUser?.displayName || req.authUser?.username || null,
      folderId: req.body?.folderId || null,
      visibility,
      allowedUserIds,
      accessGrants,
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
    error: status?.error || doc?.error || null,
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
    if (!isDocumentVisible(doc, req) || (!hasPrivilege(req, "delete_documents") && doc.ownerId !== req.authUser?.id)) {
      return res.status(403).json({ error: "Document access denied" });
    }

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

app.patch("/documents/:id", (req, res) => {
  try {
    const doc = documents.find((d) => d.id === req.params.id);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!isDocumentVisible(doc, req)) {
      return res.status(403).json({ error: "Document access denied" });
    }

    if (req.body?.name !== undefined) {
      if (!hasPrivilege(req, "rename_documents") && doc.ownerId !== req.authUser?.id) {
        return res.status(403).json({ error: "Document rename permission required" });
      }
      const nextName = String(req.body?.name || "").trim();
      if (!nextName) return res.status(400).json({ error: "Document name is required" });
      const previousName = doc.name;
      doc.name = nextName;
      res.locals.activityTarget = `${previousName} -> ${nextName}`;
    }

    if (req.body?.visibility !== undefined || req.body?.allowedUserIds !== undefined || req.body?.folderId !== undefined) {
      if (!canManageDocumentAccess(req) && doc.ownerId !== req.authUser?.id) {
        return res.status(403).json({ error: "Document visibility permission required" });
      }
      if (req.body?.visibility !== undefined) {
        doc.visibility = ["private", "public", "selected"].includes(req.body.visibility) ? req.body.visibility : "private";
      }
      if (req.body?.allowedUserIds !== undefined) {
        doc.accessGrants = normalizeAccessGrants(req.body);
        doc.allowedUserIds = activeGrantUserIds(doc);
      }
      if (req.body?.folderId !== undefined) doc.folderId = req.body.folderId || null;
      res.locals.activityTarget = doc.name;
      notifyUsers(doc.allowedUserIds || [], {
        title: "Document access granted",
        message: `${req.authUser?.displayName || "Admin"} shared ${doc.name} with you.`,
        type: "document",
      });
    }

    doc.updatedAt = new Date().toISOString();
    saveDocuments();

    res.json({ success: true, document: doc });
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
    if (!isDocumentVisible(doc, req)) {
      return res.status(403).json({ error: "Document access denied" });
    }
    if (!hasPrivilege(req, "toggle_documents") && doc.ownerId !== req.authUser?.id) {
      return res.status(403).json({ error: "Document toggle permission required" });
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

    doc.status = "processing";
    doc.isReady = false;
    doc.error = null;
    saveDocuments();
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
    if (!isDocumentVisible(doc, req)) return res.status(403).json({ error: "Sheet access denied" });

    const sheets = await fetchSheetDataset(doc.sheetId);
    const overview = summarizeSheetData(sheets);
    const architectureNeedsRefresh =
      !doc.sheetArchitecture ||
      doc.sheetArchitecture.sourceModifiedTime !== doc.lastModifiedTime ||
      doc.sheetArchitecture.version !== SHEET_ARCHITECTURE_VERSION;
    
    let architecture = doc.sheetArchitecture;
    try {
      if (architectureNeedsRefresh) {
        architecture = await saveSheetArchitecture(doc.id, sheets);
      }
    } catch (err) {
      console.warn(`Could not generate sheet architecture for ${doc.id}:`, err.message);
      doc.architectureError = err.message;
      saveDocuments();
    }
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
      document: documents.find((d) => d.id === req.params.id && d.type === "sheet") || doc,
      sheets,
      architecture,
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

app.post("/automations", requirePrivilege("manage_automations", "Automation management permission required"), (req, res) => {
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

app.patch("/automations/:id", requirePrivilege("manage_automations", "Automation management permission required"), (req, res) => {
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

app.delete("/automations/:id", requirePrivilege("manage_automations", "Automation management permission required"), (req, res) => {
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

app.post("/automations/:id/run", requirePrivilege("manage_automations", "Automation management permission required"), async (req, res) => {
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
  const userId = req.authUser?.id;
  const result = notifications
    .filter((item) => !item.userId || item.userId === userId || hasAllDocumentAccess(req))
    .slice(0, limit);
  res.json({
    notifications: result,
    unreadCount: result.filter((item) => !item.readAt).length,
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

app.post("/notifications/read", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const now = new Date().toISOString();
  notifications = notifications.map((item) => (
    ids.includes(item.id) ? { ...item, readAt: item.readAt || now } : item
  ));
  saveNotifications();
  res.json({ success: true });
});

app.delete("/notifications", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: "No notifications selected" });
  notifications = notifications.filter((item) => !ids.includes(item.id));
  saveNotifications();
  res.json({ success: true });
});

app.delete("/notifications/:id", (req, res) => {
  const before = notifications.length;
  notifications = notifications.filter((item) => item.id !== req.params.id);
  if (notifications.length === before) return res.status(404).json({ error: "Notification not found" });
  saveNotifications();
  res.json({ success: true });
});

app.get("/reports/:id", (req, res) => {
  const report = reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ report });
});

app.get("/activity-logs", requirePrivilege("view_activity_log", "Activity log permission required"), (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const userId = req.query.userId ? String(req.query.userId) : "";
  const status = req.query.status ? String(req.query.status) : "";
  let result = activityLogs.filter((item) => !String(item.path || "").includes("/chat") && item.action !== "POST /chat");
  if (userId) result = result.filter((item) => item.userId === userId);
  if (status) result = result.filter((item) => item.status === status);
  res.json({ logs: result.slice(0, limit) });
});

app.delete("/reports/:id", requirePrivilege("manage_reports", "Report management permission required"), (req, res) => {
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
    const question = String(req.body?.question || "").trim();
    const requestedIds = Array.isArray(req.body?.documentIds)
      ? req.body.documentIds
      : req.body?.documentId
      ? [req.body.documentId]
      : [];
    const documentIds = [...new Set(requestedIds.map(String).filter(Boolean))];
    const modelPreference = req.body?.modelPreference || "auto";

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }
    if (documentIds.length === 0) {
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

    const accessibleDocuments = documentIds
      .map((docId) => documents.find((item) => item.id === docId))
      .filter((doc) => doc && doc.isReady && doc.isActive !== false && isDocumentVisible(doc, req));
    if (accessibleDocuments.length === 0) {
      return res.status(404).json({ error: "No ready, accessible documents were found" });
    }

    const routing = routeClaudeModel(question, accessibleDocuments.length, modelPreference);
    const vectorRecords = [];

    for (const doc of accessibleDocuments) {
      const vectorPath = path.join(vectorsDir, `${doc.id}.json`);
      if (!fs.existsSync(vectorPath)) continue;

      const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
      for (const record of vectors) {
        if (!Array.isArray(record.embedding) || !record.text) continue;
        vectorRecords.push({
          text: record.text,
          embedding: record.embedding,
          chunkId: record.id,
          docId: doc.id,
          documentName: doc.name,
        });
      }
    }

    if (vectorRecords.length === 0) {
      return res.json({
        answer: "No relevant information found in the selected documents.",
        modelTier: routing.tier,
        routingReason: routing.reason,
        sources: [],
      });
    }

    const matches = retrieveRelevantChunks({
      question,
      queryVector,
      records: vectorRecords,
      tier: routing.tier,
    });
    const claude = await callClaude({
      question,
      matches,
      tier: routing.tier,
      routingReason: routing.reason,
    });

    res.json({
      ...claude,
      modelTier: claude.tier,
      sources: matches.map((match, index) => ({
        source: index + 1,
        documentId: match.docId,
        documentName: match.documentName,
        chunkId: match.chunkId,
        score: Number(match.score.toFixed(4)),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.message });
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
