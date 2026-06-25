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
const { registerFormsModule } = require("./lib/formsModule");
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
const kalhaarPendingWorkDlArchitecture = require("./sheetArchitectures/kalhaarPendingWorkDl");
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
const DEFAULT_DMR_SPREADSHEET_ID = process.env.DMR_SPREADSHEET_ID || "";
const DEFAULT_DMR_TOMORROW_PLAN_SPREADSHEET_ID = process.env.DMR_TOMORROW_PLAN_SPREADSHEET_ID || "1592O80hnVL7scepUdvi1hX72MyWIfiP61vh-94TmTaw";
const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "documents", label: "Documents" },
  { id: "forms", label: "Forms" },
  { id: "projects", label: "Projects" },
  { id: "project-dmr", label: "DMR" },
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
  { id: "edit_project_dmr", label: "Fill project DMR records" },
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

function hasMenuAccess(req, menuId) {
  if (req?.user?.isSuperAdmin) return true;
  return Boolean(req?.authUser?.menus?.includes(menuId));
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

registerFormsModule(app, {
  connectDb: connectAuthDb,
  google,
  getGoogleAuth,
  requireSuperAdmin,
});

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

const storageRoot = process.env.APP_STORAGE_DIR
  ? path.resolve(process.env.APP_STORAGE_DIR)
  : __dirname;
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(storageRoot, "uploads");
const vectorsDir = process.env.VECTORS_DIR
  ? path.resolve(process.env.VECTORS_DIR)
  : path.join(storageRoot, "vectors");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(storageRoot, "data");

[uploadsDir, vectorsDir, dataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const documentsPath = path.join(dataDir, "documents.json");
const foldersPath = path.join(dataDir, "document-folders.json");
const automationsPath = path.join(dataDir, "automations.json");
const reportsPath = path.join(dataDir, "reports.json");
const notificationsPath = path.join(dataDir, "notifications.json");
const activityLogsPath = path.join(dataDir, "activity-logs.json");
const projectDashboardPath = path.join(dataDir, "project-dashboard.json");
const dmrHistoryPath = path.join(dataDir, "dmr-history.json");
const dmrSettingsPath = path.join(dataDir, "dmr-settings.json");

let documents = [];
let documentFolders = [];
let automations = [];
let reports = [];
let notifications = [];
let activityLogs = [];
let dmrHistory = [];
let dmrSettings = {
  spreadsheetId: normalizeSpreadsheetId(DEFAULT_DMR_SPREADSHEET_ID),
  linkedAt: null,
  linkedBy: null,
  unlinkedAt: null,
  unlinkedBy: null,
};
let projectDashboardConfig = { projects: [] };
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

if (fs.existsSync(dmrHistoryPath)) {
  try {
    dmrHistory = JSON.parse(fs.readFileSync(dmrHistoryPath, "utf8"));
  } catch (error) {
    console.error("Error loading DMR history:", error);
    dmrHistory = [];
  }
}

if (fs.existsSync(dmrSettingsPath)) {
  try {
    const savedDmrSettings = JSON.parse(fs.readFileSync(dmrSettingsPath, "utf8"));
    dmrSettings = {
      ...dmrSettings,
      ...(savedDmrSettings || {}),
      spreadsheetId: normalizeSpreadsheetId(savedDmrSettings?.spreadsheetId),
    };
  } catch (error) {
    console.error("Error loading DMR settings:", error);
  }
}

if (fs.existsSync(projectDashboardPath)) {
  try {
    const savedProjectDashboard = JSON.parse(fs.readFileSync(projectDashboardPath, "utf8"));
    projectDashboardConfig = {
      projects: Array.isArray(savedProjectDashboard?.projects) ? savedProjectDashboard.projects : [],
    };
  } catch (error) {
    console.error("Error loading project dashboard configuration:", error);
  }
}

function saveDocuments() {
  try {
    fs.writeFileSync(documentsPath, JSON.stringify(documents, null, 2));
  } catch (error) {
    console.error("Error saving documents:", error);
  }
}

function saveProjectDashboardConfig() {
  try {
    fs.writeFileSync(projectDashboardPath, JSON.stringify(projectDashboardConfig, null, 2));
  } catch (error) {
    console.error("Error saving project dashboard configuration:", error);
  }
}

function inspectVectorFile(documentId) {
  const vectorPath = path.join(vectorsDir, `${documentId}.json`);
  if (!fs.existsSync(vectorPath)) return { exists: false, valid: false, chunks: 0, vectorPath };
  try {
    const records = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
    const chunks = Array.isArray(records)
      ? records.filter((record) => Array.isArray(record?.embedding) && record?.text).length
      : 0;
    return { exists: true, valid: chunks > 0, chunks, vectorPath };
  } catch (error) {
    return { exists: true, valid: false, chunks: 0, vectorPath, error: error.message };
  }
}

function reconcileDocumentVector(doc, { persist = false } = {}) {
  if (!doc?.id) return { exists: false, valid: false, chunks: 0 };
  const vector = inspectVectorFile(doc.id);
  let changed = false;

  if (vector.valid && (!doc.isReady || doc.status !== "ready" || doc.chunks !== vector.chunks)) {
    doc.isReady = true;
    doc.status = "ready";
    doc.chunks = vector.chunks;
    delete doc.error;
    changed = true;
    processingStatus[doc.id] = { stage: "Ready", ready: true };
  } else if (!vector.valid && doc.isReady) {
    doc.isReady = false;
    doc.status = doc.type === "sheet" ? "processing" : "failed";
    doc.error = vector.exists
      ? `Vector index is invalid${vector.error ? `: ${vector.error}` : ""}`
      : "Vector index is missing";
    changed = true;
  }

  if (changed && persist) saveDocuments();
  return vector;
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

function saveDmrHistory() {
  try {
    fs.writeFileSync(dmrHistoryPath, JSON.stringify(dmrHistory, null, 2));
  } catch (error) {
    console.error("Error saving DMR history:", error);
  }
}

function saveDmrSettings() {
  try {
    fs.writeFileSync(dmrSettingsPath, JSON.stringify(dmrSettings, null, 2));
  } catch (error) {
    console.error("Error saving DMR settings:", error);
  }
}

function publicDmrSettings() {
  const spreadsheetId = normalizeSpreadsheetId(dmrSettings.spreadsheetId);
  return {
    linked: Boolean(spreadsheetId),
    spreadsheetId,
    linkedAt: dmrSettings.linkedAt || null,
    linkedBy: dmrSettings.linkedBy || null,
  };
}

function getActiveDmrSpreadsheetId() {
  const spreadsheetId = normalizeSpreadsheetId(dmrSettings.spreadsheetId);
  if (!spreadsheetId) {
    throw new Error("No DMR sheet is linked yet. Super Admin can open Fill DMR and link a native Google Sheet.");
  }
  return spreadsheetId;
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

function addDmrHistory(req, entries = []) {
  const user = req?.authUser || {};
  const createdAt = new Date().toISOString();
  const normalized = entries.filter(Boolean).map((entry) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    userId: user.id || null,
    username: user.username || "System",
    displayName: user.displayName || user.username || "System",
    roleName: user.roleName || null,
    ...entry,
  }));
  if (!normalized.length) return [];
  dmrHistory.unshift(...normalized);
  dmrHistory = dmrHistory.slice(0, 3000);
  saveDmrHistory();
  return normalized;
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
      "https://www.googleapis.com/auth/spreadsheets",
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

async function assertNativeGoogleSpreadsheet(spreadsheetId, label = "Sheet") {
  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,spreadsheetUrl",
    });
    return {
      id: spreadsheetId,
      name: response.data?.properties?.title || spreadsheetId,
      mimeType: "application/vnd.google-apps.spreadsheet",
      webViewLink: response.data?.spreadsheetUrl || null,
    };
  } catch (error) {
    if (isOfficeSpreadsheetError(error)) {
      throw new Error(`${label} is an Excel/Office workbook. DMR can read normal sheets, but filling DMR needs creating tabs and writing cells, which Google only supports on native Google Sheets. Open it and use File > Save as Google Sheets, then link the converted /spreadsheets/d/... file.`);
    }
    const message = String(error?.message || "");
    if (!/file not found|not found/i.test(message) && error?.code !== 404) {
      throw error;
    }
  }

  const drive = google.drive({ version: "v3", auth });
  let response;
  try {
    response = await drive.files.get({
      fileId: spreadsheetId,
      fields: "id,name,mimeType,webViewLink",
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (/file not found|not found/i.test(message) || error?.code === 404) {
      throw new Error(`${label} could not be opened by Google APIs. If it is shared as “Anyone with the link”, make sure it is a native Google Sheet, not an .xlsx Office workbook. If it is already native, share it directly with sheets-dashboard-sa@sheets-dashboard-498607.iam.gserviceaccount.com as Editor.`);
    }
    throw error;
  }
  const file = response.data || {};
  if (file.mimeType !== "application/vnd.google-apps.spreadsheet") {
    throw new Error(`${label} must be a native Google Sheet, but "${file.name || spreadsheetId}" is an Excel/Office workbook. Open it and use File > Save as Google Sheets, then link the converted /spreadsheets/d/... file.`);
  }
  return file;
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

const sheetDatasetCache = new Map();
const SHEET_DATASET_CACHE_TTL_MS = 1000 * 60 * 3;

async function fetchSheetDataset(sheetId, options = {}) {
  const force = Boolean(options.force);
  const cached = sheetDatasetCache.get(sheetId);
  if (!force && cached && Date.now() - cached.createdAt < SHEET_DATASET_CACHE_TTL_MS) {
    return cached.promise;
  }

  const datasetPromise = buildSheetDataset(sheetId).catch((error) => {
    if (sheetDatasetCache.get(sheetId)?.promise === datasetPromise) sheetDatasetCache.delete(sheetId);
    throw error;
  });
  sheetDatasetCache.set(sheetId, { createdAt: Date.now(), promise: datasetPromise });
  return datasetPromise;
}

async function buildSheetDataset(sheetId) {
  const sheets = await fetchRawSheetValues(sheetId);
  const result = [];
  const sourceDocument = documents.find((doc) => doc.type === "sheet" && doc.sheetId === sheetId);
  const architectureKind = sourceDocument?.sheetArchitecture?.kind || "";
  const isKalhaarPendingWork = sheetId === kalhaarPendingWorkDlArchitecture.SHEET_ID
    || architectureKind === kalhaarPendingWorkDlArchitecture.KIND;
  const isKalhaarPendingTracker = sheetId === kalhaarPendingTrackerArchitecture.SHEET_ID
    || architectureKind === kalhaarPendingTrackerArchitecture.KIND;

  // For kalhaarPendingWorkDl, we need cell styles (colors) for stage columns
  let kalhaarRawSheets = null;
  if (isKalhaarPendingWork) {
    try {
      const auth = await getGoogleAuth();
      const drive = google.drive({ version: "v3", auth });
      const downloadResponse = await drive.files.get(
        { fileId: sheetId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const bytes = Buffer.from(downloadResponse.data);
      const workbook = XLSX.read(bytes, { type: "buffer", cellStyles: true });
      kalhaarRawSheets = workbook.Sheets;
    } catch (err) {
      console.warn("Could not fetch cell styles for Kalhaar workbook:", err.message);
    }
  }

  for (const sheet of sheets) {
    const title = sheet.name;
    const values = sheet.values || [];
    const prepared = isKalhaarPendingWork
      ? kalhaarPendingWorkDlArchitecture.prepareSheet(title, values, kalhaarRawSheets ? kalhaarRawSheets[title] : null)
      : isKalhaarPendingTracker
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

const PROJECT_FIELD_PATTERNS = {
  project: [/^project$/i, /project.*name/i, /^site$/i, /site.*name/i, /location/i, /property/i],
  title: [/^activity$/i, /task/i, /work.*description/i, /description/i, /particular/i, /material.*product/i, /item/i, /subject/i, /action/i],
  status: [/^status$/i, /work.*status/i, /due.*status/i, /stage/i, /state/i, /approval/i, /payment.*status/i],
  dueDate: [/due.*date/i, /end.*date/i, /finish.*date/i, /target.*date/i, /planned.*date/i, /expected.*date/i, /schedule.*date/i, /deadline/i],
  startDate: [/start.*date/i, /commence.*date/i, /begin.*date/i],
  completedDate: [/completed.*date/i, /completion.*date/i, /finished.*date/i, /closed.*date/i, /actual.*date/i],
  updatedDate: [/updated/i, /modified/i, /timestamp/i, /action.*date/i, /entry.*date/i, /created.*date/i, /^date$/i],
  owner: [/owner/i, /responsible/i, /assigned/i, /supervisor/i, /manager/i, /agency/i, /contractor/i, /person/i],
  notes: [/remark/i, /note/i, /comment/i, /issue/i, /blocker/i, /reason/i, /action.*taken/i],
  agency: [/^agency$/i, /contractor/i, /vendor/i],
  supervisor: [/supervisor/i, /design.*owner/i, /responsible/i, /assigned/i],
  trade: [/^trade$/i, /trade.*category/i, /work.*type/i, /discipline/i],
  floor: [/^floor$/i, /level/i],
  area: [/room.*area/i, /^area$/i, /location/i, /zone/i],
  priority: [/priority/i, /severity/i, /urgency/i],
  pendingStages: [/pending.*stage/i, /stage.*needed/i],
  attendanceDate: [/attendance.*date/i, /^date$/i, /timestamp/i],
  attendanceStatus: [/attendance/i, /present/i, /absent/i, /^status$/i],
};

const PROJECT_WORKFLOW_STAGES = ["Design", "Approval", "Selection", "Procurement", "Execution", "Audit"];

function projectText(value) {
  return String(value ?? "").trim();
}

function normalizeSpreadsheetId(value = "") {
  return extractDriveFileId(value) || projectText(value);
}

function escapeSheetName(name = "") {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function columnName(number) {
  let result = "";
  let value = Number(number);
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result || "A";
}

function projectFindColumn(headers, explicit, patterns) {
  if (explicit && headers.includes(explicit)) return explicit;
  return headers.find((header) => patterns.some((pattern) => pattern.test(header))) || "";
}

function projectDateKey(value) {
  const text = projectText(value);
  if (!text) return "";
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    const year = direct.getFullYear();
    const month = String(direct.getMonth() + 1).padStart(2, "0");
    const day = String(direct.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (!match) return "";
  const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const IST_TIME_ZONE = "Asia/Kolkata";

function istDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return projectDateKey(new Date());
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysToDateKey(dateKey, days = 0) {
  const match = projectText(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function projectCategory(assignment, doc, tab) {
  if (assignment.category && assignment.category !== "auto") return assignment.category;
  const text = `${doc.name} ${tab.name} ${(tab.headers || []).join(" ")}`.toLowerCase();
  if (/attendance|present|absent|manpower|labou?r|workforce/.test(text)) return "attendance";
  if (/purchase|procurement|vendor|material|inventory|stock|delivery/.test(text)) return "procurement";
  if (/payment|expense|invoice|amount|cost|budget/.test(text)) return "payment";
  if (/approval|selection|decision/.test(text)) return "approval";
  if (/issue|risk|blocker|snag/.test(text)) return "issue";
  return "work";
}

function projectStatusFlags(statusValue, notesValue) {
  const text = `${projectText(statusValue)} ${projectText(notesValue)}`.toLowerCase();
  return {
    completed: /\b(done|complete|completed|closed|finished|approved|paid|resolved)\b/.test(text) && !/\b(not complete|incomplete|unpaid|not approved)\b/.test(text),
    blocked: /\b(blocked|hold|on hold|stuck|dependency|waiting|awaiting|delayed)\b/.test(text),
    cancelled: /\b(cancelled|canceled|not required|dropped)\b/.test(text),
  };
}

function projectStageState(value) {
  const text = projectText(value).toLowerCase();
  if (!text) return "unknown";
  if (/\b(done|complete|completed|closed|finished|approved|yes|paid|resolved)\b/.test(text)) return "done";
  if (/\b(on hold|hold|blocked|waiting|awaiting|stuck|delayed)\b/.test(text)) return "blocked";
  if (/\b(in progress|started|working|ongoing|partial)\b/.test(text)) return "in_progress";
  if (/\b(pending|not started|open|no|required|needed)\b/.test(text)) return "pending";
  return "unknown";
}

function projectRecordScore(record) {
  return Object.values(record.stageStatuses || {}).filter((value) => value !== "unknown").length * 10
    + [record.trade, record.agency, record.supervisor, record.floor, record.area, record.startDate, record.dueDate]
      .filter(Boolean).length;
}

function projectDedupeKey(record) {
  return [
    record.trade,
    record.floor,
    record.area,
    record.title,
    record.agency,
    record.startDate,
    record.dueDate,
  ].map((value) => projectText(value).toLowerCase().replace(/\s+/g, " ")).join("|");
}

function projectTabsForAssignment(doc, dataset, assignment) {
  if (assignment.tabs?.length) {
    return dataset.filter((tab) => assignment.tabs.includes(tab.name) && (tab.rows || []).length);
  }
  if (doc.sheetArchitecture?.kind === kalhaarPendingTrackerArchitecture.KIND) {
    return dataset.filter((tab) => tab.name === "All Tasks");
  }
  return dataset.filter((tab) => (tab.headers || []).length && (tab.rows || []).length);
}

function dmrDateKey(value = new Date()) {
  return projectDateKey(value) || istDateKey(new Date());
}

function dmrTabName(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dmrDateFromTabName(name, fallbackYear = new Date().getFullYear()) {
  const match = projectText(name).match(/^(\d{1,2})\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (!match) return "";
  const year = match[3] ? (match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3])) : fallbackYear;
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanDmrSiteName(value) {
  return projectText(value).replace(/^\d+\s*[.)-]?\s*/, "").replace(/\s+/g, " ").trim();
}

function dmrValueNumber(value) {
  const text = projectText(value).replace(/,/g, "");
  if (!text) return 0;
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function findDmrLabel(values, pattern) {
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (pattern.test(projectText(row[columnIndex]))) return { rowIndex, columnIndex };
    }
  }
  return null;
}

function dmrCell(values, rowIndex, columnIndex) {
  return projectText(values[rowIndex]?.[columnIndex]);
}

function dmrProjectMatchesSite(project, dmrConfig, siteName) {
  const site = cleanDmrSiteName(siteName).toLowerCase();
  const accepted = [
    project.name,
    project.code,
    project.location,
    ...(project.aliases || []),
    ...(dmrConfig?.siteNames || []),
  ].map((item) => cleanDmrSiteName(item).toLowerCase()).filter(Boolean);
  if (!accepted.length) return true;
  return accepted.some((item) => site === item || site.includes(item) || item.includes(site));
}

function canViewProjectDmr(project, req) {
  if (req.user?.isSuperAdmin) return true;
  const dmrConfig = project?.dmr || {};
  if (!dmrConfig.enabled) return false;
  const userId = String(req.authUser?.id || req.user?._id || "");
  const assigned = Array.isArray(dmrConfig.assignedUserIds) ? dmrConfig.assignedUserIds.map(String) : [];
  const editors = Array.isArray(dmrConfig.editableUserIds) ? dmrConfig.editableUserIds.map(String) : [];
  return assigned.includes(userId) || editors.includes(userId);
}

function canEditProjectDmr(project, req) {
  if (req.user?.isSuperAdmin) return true;
  if (!hasPrivilege(req, "edit_project_dmr")) return false;
  const userId = String(req.authUser?.id || req.user?._id || "");
  const editors = Array.isArray(project?.dmr?.editableUserIds) ? project.dmr.editableUserIds.map(String) : [];
  const assigned = Array.isArray(project?.dmr?.assignedUserIds) ? project.dmr.assignedUserIds.map(String) : [];
  return editors.includes(userId) || (!editors.length && assigned.includes(userId));
}

function parseDmrSheetValues({ values = [], sheetName = "", dateKey = "" }) {
  const measureRowIndex = values.findIndex((row) => row.filter((cell) => /^(planned|actual)$/i.test(projectText(cell))).length >= 2);
  if (measureRowIndex < 1) {
    return { records: [], sites: [], agencies: [], error: "Could not find Planned / Actual header row in this DMR tab." };
  }
  const equipmentLabel = findDmrLabel(values, /equipments?\s+and\s+tools/i);
  const materialsLabel = findDmrLabel(values, /materials?\s+details/i);
  const notesLabel = findDmrLabel(values, /notes?\s*[:-]/i);
  const staffLabel = findDmrLabel(values, /project\s+staff\s+attend/i);

  const siteRowIndex = measureRowIndex - 1;
  const agencyHeaderRowIndex = Math.max(0, measureRowIndex - 2);
  const agencyColumnIndex = values[agencyHeaderRowIndex]?.findIndex((cell) => /name\s+of\s+agency/i.test(projectText(cell)));
  const agencyColumn = agencyColumnIndex >= 0 ? agencyColumnIndex : 2;
  const siteRow = values[siteRowIndex] || [];
  const measureRow = values[measureRowIndex] || [];
  const siteColumns = [];
  let currentSite = "";

  for (let index = 0; index < Math.max(siteRow.length, measureRow.length); index += 1) {
    const possibleSite = cleanDmrSiteName(siteRow[index]);
    if (possibleSite) currentSite = possibleSite;
    const metric = projectText(measureRow[index]).toLowerCase();
    if (metric === "planned" || metric === "actual") {
      const sectionHeader = projectText(values[agencyHeaderRowIndex]?.[index]).toLowerCase();
      if (/total.*manpower|total.*site|all\s+site/i.test(sectionHeader)) continue;
      siteColumns.push({ site: currentSite || "Site", metric, columnIndex: index });
    }
  }

  const sitePairs = [...siteColumns.reduce((result, item) => {
    if (!result.has(item.site)) result.set(item.site, { site: item.site, plannedColumnIndex: null, actualColumnIndex: null });
    const pair = result.get(item.site);
    if (item.metric === "planned" && pair.plannedColumnIndex === null) pair.plannedColumnIndex = item.columnIndex;
    if (item.metric === "actual" && pair.actualColumnIndex === null) pair.actualColumnIndex = item.columnIndex;
    return result;
  }, new Map()).values()].filter((item) => item.plannedColumnIndex !== null || item.actualColumnIndex !== null);

  const records = [];
  const agencies = new Set();
  const manpowerEndRowIndex = equipmentLabel ? equipmentLabel.rowIndex : values.length;
  for (let rowIndex = measureRowIndex + 1; rowIndex < manpowerEndRowIndex; rowIndex += 1) {
    const row = values[rowIndex] || [];
    const agency = projectText(row[agencyColumn]);
    if (!agency || /total|grand total/i.test(agency)) continue;
    agencies.add(agency);
    for (const pair of sitePairs) {
      const planned = dmrValueNumber(row[pair.plannedColumnIndex]);
      const actual = dmrValueNumber(row[pair.actualColumnIndex]);
      records.push({
        id: `${sheetName}:${rowIndex + 1}:${pair.site}`,
        date: dateKey,
        sheetName,
        rowNumber: rowIndex + 1,
        agency,
        site: pair.site,
        planned,
        actual,
        variance: actual - planned,
        plannedColumn: pair.plannedColumnIndex + 1,
        actualColumn: pair.actualColumnIndex + 1,
      });
    }
  }

  const equipment = [];
  if (equipmentLabel) {
    const stopAt = notesLabel ? notesLabel.rowIndex : Math.min(equipmentLabel.rowIndex + 5, values.length);
    for (let rowIndex = equipmentLabel.rowIndex + 2; rowIndex < stopAt; rowIndex += 1) {
      const serial = dmrCell(values, rowIndex, 1);
      const site = dmrCell(values, rowIndex, 2);
      const details = dmrCell(values, rowIndex, 3);
      const quantity = dmrCell(values, rowIndex, 5);
      if (!serial && !site && !details && !quantity) break;
      equipment.push({
        id: `${sheetName}:equipment:${rowIndex + 1}`,
        rowNumber: rowIndex + 1,
        site,
        details,
        quantity,
        siteColumn: 3,
        detailsColumn: 4,
        quantityColumn: 6,
      });
    }
  }

  const materials = [];
  if (materialsLabel) {
    const stopAt = notesLabel ? notesLabel.rowIndex : Math.min(materialsLabel.rowIndex + 5, values.length);
    for (let rowIndex = materialsLabel.rowIndex + 2; rowIndex < stopAt; rowIndex += 1) {
      const serial = dmrCell(values, rowIndex, 8);
      const site = dmrCell(values, rowIndex, 9);
      const details = dmrCell(values, rowIndex, 12);
      const unit = dmrCell(values, rowIndex, 14);
      const quantity = dmrCell(values, rowIndex, 15);
      if (!serial && !site && !details && !unit && !quantity) break;
      materials.push({
        id: `${sheetName}:material:${rowIndex + 1}`,
        rowNumber: rowIndex + 1,
        site,
        details,
        unit,
        quantity,
        siteColumn: 10,
        detailsColumn: 13,
        unitColumn: 15,
        quantityColumn: 16,
      });
    }
  }

  const notes = [];
  if (notesLabel) {
    const stopAt = staffLabel ? staffLabel.rowIndex : Math.min(notesLabel.rowIndex + 3, values.length);
    for (let rowIndex = notesLabel.rowIndex + 1; rowIndex < stopAt; rowIndex += 1) {
      const serial = dmrCell(values, rowIndex, 1);
      const note = dmrCell(values, rowIndex, 2);
      if (!serial && !note) break;
      notes.push({
        id: `${sheetName}:note:${rowIndex + 1}`,
        rowNumber: rowIndex + 1,
        note,
        noteColumn: 3,
      });
    }
  }

  const staffAttendance = [];
  if (staffLabel) {
    const nameRowIndex = staffLabel.rowIndex + 1;
    const statusRowIndex = staffLabel.rowIndex + 2;
    for (let columnIndex = 2; columnIndex < Math.max(values[nameRowIndex]?.length || 0, values[statusRowIndex]?.length || 0); columnIndex += 1) {
      const name = projectText(values[nameRowIndex]?.[columnIndex]).replace(/^\d+\s*[.)-]?\s*/, "").trim();
      if (!name) continue;
      const status = dmrCell(values, statusRowIndex, columnIndex);
      staffAttendance.push({
        id: `${sheetName}:staff:${columnIndex + 1}`,
        name,
        status,
        rowNumber: statusRowIndex + 1,
        statusColumn: columnIndex + 1,
      });
    }
  }

  return {
    records,
    equipment,
    materials,
    notes,
    staffAttendance,
    sites: sitePairs.map((item) => item.site),
    agencies: [...agencies].sort((a, b) => a.localeCompare(b)),
    header: { measureRow: measureRowIndex + 1, agencyColumn: agencyColumn + 1 },
  };
}

async function getDmrSpreadsheet(spreadsheetId) {
  const auth = await getGoogleAuth();
  return google.sheets({ version: "v4", auth });
}

async function ensureDmrTab(spreadsheetId, dateKey) {
  await assertNativeGoogleSpreadsheet(spreadsheetId, "DMR sheet");
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const tabName = dmrTabName(dateKey);
  if (!tabName) throw new Error("Invalid DMR date");
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,index)",
  });
  const existingSheets = metadata.data.sheets || [];
  const existing = existingSheets.find((sheet) => projectText(sheet.properties?.title) === tabName);
  if (existing) return { sheetName: tabName, created: false };

  const fallbackYear = Number(dateKey.slice(0, 4)) || new Date().getFullYear();
  const datedSheets = existingSheets
    .map((sheet) => ({ sheet, date: dmrDateFromTabName(sheet.properties?.title, fallbackYear) }))
    .filter((item) => item.date)
    .sort((a, b) => Math.abs(new Date(`${a.date}T00:00:00`) - new Date(`${dateKey}T00:00:00`)) - Math.abs(new Date(`${b.date}T00:00:00`) - new Date(`${dateKey}T00:00:00`)));
  const template = datedSheets[0]?.sheet || existingSheets[0];
  if (!template?.properties?.sheetId && template?.properties?.sheetId !== 0) {
    throw new Error("No DMR template tab found to create today's sheet.");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        duplicateSheet: {
          sourceSheetId: template.properties.sheetId,
          insertSheetIndex: (template.properties.index || 0) + 1,
          newSheetName: tabName,
        },
      }],
    },
  });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(tabName)}!A1:ZZ300`,
  });
  const values = response.data.values || [];
  const measureRowIndex = values.findIndex((row) => row.filter((cell) => /^(planned|actual)$/i.test(projectText(cell))).length >= 2);
  const equipmentLabel = findDmrLabel(values, /equipments?\s+and\s+tools/i);
  const materialsLabel = findDmrLabel(values, /materials?\s+details/i);
  const notesLabel = findDmrLabel(values, /notes?\s*[:-]/i);
  const staffLabel = findDmrLabel(values, /project\s+staff\s+attend/i);
  const clearRanges = [];
  if (measureRowIndex >= 0) {
    const manpowerEnd = equipmentLabel ? equipmentLabel.rowIndex : Math.min(measureRowIndex + 40, values.length - 1);
    clearRanges.push(`${escapeSheetName(tabName)}!D${measureRowIndex + 2}:U${manpowerEnd}`);
  }
  if (equipmentLabel) clearRanges.push(`${escapeSheetName(tabName)}!C${equipmentLabel.rowIndex + 3}:F${equipmentLabel.rowIndex + 5}`);
  if (materialsLabel) clearRanges.push(`${escapeSheetName(tabName)}!J${materialsLabel.rowIndex + 3}:P${materialsLabel.rowIndex + 5}`);
  if (notesLabel) clearRanges.push(`${escapeSheetName(tabName)}!C${notesLabel.rowIndex + 2}:C${notesLabel.rowIndex + 3}`);
  if (staffLabel) clearRanges.push(`${escapeSheetName(tabName)}!C${staffLabel.rowIndex + 3}:W${staffLabel.rowIndex + 3}`);
  await Promise.all(clearRanges.map((range) => sheets.spreadsheets.values.clear({ spreadsheetId, range })));
  return { sheetName: tabName, created: true };
}

async function readDmrSheet(spreadsheetId, dateKey, { ensure = false } = {}) {
  if (!ensure) await assertNativeGoogleSpreadsheet(spreadsheetId, "DMR sheet");
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const sheetInfo = ensure ? await ensureDmrTab(spreadsheetId, dateKey) : { sheetName: dmrTabName(dateKey), created: false };
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetInfo.sheetName)}!A1:ZZ300`,
  });
  const parsed = parseDmrSheetValues({
    values: response.data.values || [],
    sheetName: sheetInfo.sheetName,
    dateKey,
  });
  return { ...parsed, sheetName: sheetInfo.sheetName, created: sheetInfo.created };
}

async function writeDmrRecords(spreadsheetId, dateKey, updates = []) {
  const { sheetName } = await ensureDmrTab(spreadsheetId, dateKey);
  const data = [];
  for (const update of updates) {
    const rowNumber = Number(update.rowNumber);
    const plannedColumn = Number(update.plannedColumn);
    const actualColumn = Number(update.actualColumn);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
    if (Array.isArray(update.cells)) {
      for (const cell of update.cells) {
        const column = Number(cell.column);
        if (!Number.isInteger(column) || column < 1) continue;
        data.push({
          range: `${escapeSheetName(sheetName)}!${columnName(column)}${rowNumber}`,
          values: [[cell.value ?? ""]],
        });
      }
      continue;
    }
    if (Number.isInteger(plannedColumn) && plannedColumn > 0) {
      data.push({
        range: `${escapeSheetName(sheetName)}!${columnName(plannedColumn)}${rowNumber}`,
        values: [[update.planned ?? ""]],
      });
    }
    if (Number.isInteger(actualColumn) && actualColumn > 0) {
      data.push({
        range: `${escapeSheetName(sheetName)}!${columnName(actualColumn)}${rowNumber}`,
        values: [[update.actual ?? ""]],
      });
    }
  }
  if (!data.length) return { updatedCells: 0, sheetName };
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const response = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  sheetDatasetCache.delete(spreadsheetId);
  return { updatedCells: response.data.totalUpdatedCells || 0, sheetName };
}

async function addDmrSectionRow(spreadsheetId, dateKey, section, valuesToWrite = {}) {
  const normalizedSection = projectText(section).toLowerCase();
  if (!["equipment", "materials", "notes"].includes(normalizedSection)) {
    throw new Error("Unsupported DMR section");
  }
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const { sheetName } = await ensureDmrTab(spreadsheetId, dateKey);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = (metadata.data.sheets || []).find((item) => projectText(item.properties?.title) === sheetName);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) throw new Error("Could not find DMR sheet tab");

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A1:ZZ300`,
  });
  const values = response.data.values || [];
  const equipmentLabel = findDmrLabel(values, /equipments?\s+and\s+tools/i);
  const materialsLabel = findDmrLabel(values, /materials?\s+details/i);
  const notesLabel = findDmrLabel(values, /notes?\s*[:-]/i);
  const staffLabel = findDmrLabel(values, /project\s+staff\s+attend/i);
  let insertBeforeRowIndex = normalizedSection === "notes"
    ? staffLabel?.rowIndex
    : notesLabel?.rowIndex;
  let valueUpdates = [];
  if (normalizedSection === "equipment" || normalizedSection === "materials") {
    const startRowIndex = (equipmentLabel || materialsLabel)?.rowIndex + 2;
    const sectionStop = notesLabel?.rowIndex;
    if (Number.isInteger(startRowIndex) && Number.isInteger(sectionStop)) {
      let maxSerial = 0;
      for (let rowIndex = startRowIndex; rowIndex < sectionStop; rowIndex += 1) {
        const equipmentSerial = Number(dmrCell(values, rowIndex, 1)) || 0;
        const materialSerial = Number(dmrCell(values, rowIndex, 8)) || 0;
        const hasEquipment = Boolean(dmrCell(values, rowIndex, 2) || dmrCell(values, rowIndex, 3) || dmrCell(values, rowIndex, 5) || equipmentSerial);
        const hasMaterial = Boolean(dmrCell(values, rowIndex, 9) || dmrCell(values, rowIndex, 12) || dmrCell(values, rowIndex, 14) || dmrCell(values, rowIndex, 15) || materialSerial);
        if (!hasEquipment && !hasMaterial) {
          insertBeforeRowIndex = rowIndex;
          break;
        }
        maxSerial = Math.max(maxSerial, equipmentSerial, materialSerial);
      }
      const nextSerial = maxSerial + 1;
      valueUpdates = [
        { range: `${escapeSheetName(sheetName)}!B${insertBeforeRowIndex + 1}`, values: [[nextSerial]] },
        { range: `${escapeSheetName(sheetName)}!I${insertBeforeRowIndex + 1}`, values: [[nextSerial]] },
      ];
      if (normalizedSection === "equipment") {
        valueUpdates.push(
          { range: `${escapeSheetName(sheetName)}!C${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.site ?? ""]] },
          { range: `${escapeSheetName(sheetName)}!D${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.details ?? ""]] },
          { range: `${escapeSheetName(sheetName)}!F${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.quantity ?? ""]] },
        );
      } else {
        valueUpdates.push(
          { range: `${escapeSheetName(sheetName)}!J${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.site ?? ""]] },
          { range: `${escapeSheetName(sheetName)}!M${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.details ?? ""]] },
          { range: `${escapeSheetName(sheetName)}!O${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.unit ?? ""]] },
          { range: `${escapeSheetName(sheetName)}!P${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.quantity ?? ""]] },
        );
      }
    }
  } else if (normalizedSection === "notes") {
    const startRowIndex = notesLabel?.rowIndex + 1;
    const sectionStop = staffLabel?.rowIndex;
    if (Number.isInteger(startRowIndex) && Number.isInteger(sectionStop)) {
      let maxSerial = 0;
      for (let rowIndex = startRowIndex; rowIndex < sectionStop; rowIndex += 1) {
        const serial = Number(dmrCell(values, rowIndex, 1)) || 0;
        const note = dmrCell(values, rowIndex, 2);
        if (!serial && !note) {
          insertBeforeRowIndex = rowIndex;
          break;
        }
        maxSerial = Math.max(maxSerial, serial);
      }
      valueUpdates = [
        { range: `${escapeSheetName(sheetName)}!B${insertBeforeRowIndex + 1}`, values: [[maxSerial + 1]] },
        { range: `${escapeSheetName(sheetName)}!C${insertBeforeRowIndex + 1}`, values: [[valuesToWrite.note ?? ""]] },
      ];
    }
  }
  if (!Number.isInteger(insertBeforeRowIndex) || insertBeforeRowIndex < 1) {
    throw new Error("Could not locate the section boundary in the DMR sheet");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        insertDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: "ROWS",
            startIndex: insertBeforeRowIndex,
            endIndex: insertBeforeRowIndex + 1,
          },
          inheritFromBefore: true,
        },
      }],
    },
  });
  if (valueUpdates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: valueUpdates },
    });
  }
  sheetDatasetCache.delete(spreadsheetId);
  return { sheetName, section: normalizedSection, insertedRowNumber: insertBeforeRowIndex + 1 };
}

function dmrSummary(records = []) {
  const totals = records.reduce((result, record) => {
    result.planned += Number(record.planned) || 0;
    result.actual += Number(record.actual) || 0;
    if (record.planned || record.actual) result.filled += 1;
    return result;
  }, { planned: 0, actual: 0, filled: 0, records: records.length, variance: 0, missing: 0 });
  totals.variance = totals.actual - totals.planned;
  totals.missing = Math.max(0, records.length - totals.filled);
  return totals;
}

function dmrBreakdown(records = [], field) {
  return [...records.reduce((result, record) => {
    const label = projectText(record[field]) || "Unassigned";
    const item = result.get(label) || { label, planned: 0, actual: 0, variance: 0, records: 0, filled: 0 };
    item.records += 1;
    item.planned += Number(record.planned) || 0;
    item.actual += Number(record.actual) || 0;
    if (record.planned || record.actual) item.filled += 1;
    item.variance = item.actual - item.planned;
    result.set(label, item);
    return result;
  }, new Map()).values()].sort((a, b) => b.actual - a.actual || a.label.localeCompare(b.label));
}

function parseGoogleTimestampDate(value) {
  const text = projectText(value);
  if (!text) return "";
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return istDateKey(parsed);
  return "";
}

function tomorrowPlanCategory(header) {
  const text = projectText(header);
  const match = text.match(/^manpower\s+(.+?)\s*&\s*planned\s*work/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function tomorrowPlanComparableSite(value) {
  return projectText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bfarm\s+house\b/g, "farmhouse")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeTomorrowPlanSites(records = []) {
  const labels = [...new Set(records.map((record) => projectText(record.site)).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  return records.map((record) => {
    const comparable = tomorrowPlanComparableSite(record.site);
    const canonical = labels.find((label) => {
      const candidate = tomorrowPlanComparableSite(label);
      return candidate && comparable && candidate !== comparable && (candidate.startsWith(comparable) || comparable.startsWith(candidate));
    }) || record.site;
    return { ...record, site: canonical || "Unassigned site" };
  });
}

function parseTomorrowPlanCell(value) {
  const raw = projectText(value).replace(/\s+/g, " ");
  if (!raw) return { raw: "", plannedManpower: null, work: "" };
  const numberOnly = raw.match(/^(\d+(?:\.\d+)?)$/);
  if (numberOnly) {
    const plannedManpower = Number(numberOnly[1]);
    return { raw, plannedManpower: Number.isFinite(plannedManpower) ? plannedManpower : null, work: "" };
  }
  const patterns = [
    /^(\d+(?:\.\d+)?)\s*(?:[-_:,]|person|persons?|worker|workers?|labou?r)?\s*(.*)$/i,
    /(?:total|work\s*person|person|worker|labou?r)\s*[-:=]?\s*(\d+(?:\.\d+)?)\s*,?\s*(.*)$/i,
    /^(.*?)\s*(?:[-_:,])?\s*(\d+(?:\.\d+)?)\s*(?:person|persons?|worker|workers?|labou?r|civil|mason|masons|carpenter|carpenters|plumber|plumbers|painter|painters|electrician|electricians|fabricator|fabricators|polisher|polishers|labour|labours|labor|labors)?\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const trailingNumberPattern = pattern.source.startsWith("^(.*?)");
    const plannedManpower = Number(trailingNumberPattern ? match[2] : match[1]);
    const work = projectText(trailingNumberPattern ? match[1] : match[2] || raw.replace(match[0], ""));
    return {
      raw,
      plannedManpower: Number.isFinite(plannedManpower) ? plannedManpower : null,
      work: work || (plannedManpower === 0 ? raw.replace(/^0\s*[-_:,]?/i, "").trim() : raw),
    };
  }
  return { raw, plannedManpower: null, work: raw };
}

function mergeTomorrowPlanRecords(records = []) {
  const groups = records.reduce((result, record) => {
    const key = [
      tomorrowPlanComparableSite(record.site),
      projectText(record.category).toLowerCase(),
      projectText(record.submittedBy).toLowerCase(),
      record.plannedForDate || record.submittedDate || "",
      record.plannedManpower ?? "text",
    ].join("|");
    result.set(key, [...(result.get(key) || []), record]);
    return result;
  }, new Map());

  return [...groups.values()].flatMap((group) => {
    const hasWorkRecord = group.some((record) => Boolean(projectText(record.work)));
    const filtered = hasWorkRecord ? group.filter((record) => Boolean(projectText(record.work))) : group;
    const seen = new Set();
    return filtered.filter((record) => {
      const key = projectText(record.work || record.raw).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

function summarizeTomorrowPlan(records = []) {
  return records.reduce((result, record) => {
    result.records += 1;
    if (record.plannedManpower !== null && record.plannedManpower !== undefined) {
      result.plannedManpower += Number(record.plannedManpower) || 0;
    }
    if (record.work) result.workItems += 1;
    result.sites.add(record.site || "Unassigned");
    result.categories.add(record.category || "General");
    return result;
  }, { records: 0, plannedManpower: 0, workItems: 0, sites: new Set(), categories: new Set() });
}

function tomorrowPlanBreakdown(records = [], field) {
  return [...records.reduce((result, record) => {
    const label = projectText(record[field]) || "Unassigned";
    const item = result.get(label) || { label, records: 0, plannedManpower: 0, workItems: 0 };
    item.records += 1;
    item.plannedManpower += Number(record.plannedManpower) || 0;
    if (record.work) item.workItems += 1;
    result.set(label, item);
    return result;
  }, new Map()).values()].sort((a, b) => b.plannedManpower - a.plannedManpower || b.records - a.records || a.label.localeCompare(b.label));
}

function emptyDmrTomorrowPlan({ date, label, error = "" } = {}) {
  return {
    label,
    error,
    records: [],
    requestedDate: date || "",
    selectedDate: date || "",
    latestDate: date || "",
    availableDates: [],
    summary: { records: 0, plannedManpower: 0, workItems: 0, sites: 0, categories: 0 },
    siteBreakdown: [],
    categoryBreakdown: [],
    submitterBreakdown: [],
  };
}

async function readDmrTomorrowPlan(dateKey) {
  const spreadsheetId = DEFAULT_DMR_TOMORROW_PLAN_SPREADSHEET_ID;
  if (!spreadsheetId) return null;
  const targetDate = dmrDateKey(dateKey);
  const sheets = await fetchRawSheetValues(spreadsheetId);
  const planSheets = [];
  const allRecords = [];

  for (const sheet of sheets) {
    const values = sheet?.values || [];
    const headers = (values[0] || []).map(projectText);
    const timestampIndex = headers.findIndex((header) => /^timestamp$/i.test(header));
    const nameIndex = headers.findIndex((header) => /^name$/i.test(header));
    const siteIndex = headers.findIndex((header) => /site\s*name/i.test(header));
    const categoryColumns = headers
      .map((header, index) => ({ header, index, category: tomorrowPlanCategory(header) }))
      .filter((item) => item.category);

    if (timestampIndex < 0 || siteIndex < 0 || !categoryColumns.length) continue;

    const firstResponseRowIndex = values.findIndex((row, index) => index > 0 && parseGoogleTimestampDate(row?.[timestampIndex]));
    if (firstResponseRowIndex < 0) continue;
    const sheetSubmittedDate = parseGoogleTimestampDate(values[firstResponseRowIndex]?.[timestampIndex]);
    const sheetPlanDate = sheetSubmittedDate ? addDaysToDateKey(sheetSubmittedDate, 1) : "";
    if (!sheetPlanDate) continue;

    planSheets.push({
      name: sheet.name,
      date: sheetPlanDate,
      submittedDate: sheetSubmittedDate,
      firstResponseRow: firstResponseRowIndex + 1,
    });

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex] || [];
      const timestamp = dmrCell(values, rowIndex, timestampIndex);
      const submittedDate = parseGoogleTimestampDate(timestamp);
      const submittedBy = dmrCell(values, rowIndex, nameIndex);
      const site = dmrCell(values, rowIndex, siteIndex) || "Unassigned site";
      for (const column of categoryColumns) {
        const parsed = parseTomorrowPlanCell(row[column.index]);
        if (!parsed.raw) continue;
        allRecords.push({
          id: `${sheet.name}:${rowIndex + 1}:${column.index + 1}`,
          rowNumber: rowIndex + 1,
          columnNumber: column.index + 1,
          sheetName: sheet.name,
          timestamp,
          submittedDate,
          plannedForDate: sheetPlanDate,
          submittedBy,
          site,
          category: column.category,
          plannedManpower: parsed.plannedManpower,
          work: parsed.work,
          raw: parsed.raw,
        });
      }
    }
  }

  const normalizedRecords = mergeTomorrowPlanRecords(canonicalizeTomorrowPlanSites(allRecords));
  const availableDates = [...new Set(planSheets.map((sheet) => sheet.date).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const latestDate = availableDates[0] || targetDate;
  const selectedDate = targetDate;
  const records = normalizedRecords.filter((record) => record.plannedForDate === targetDate);
  const selectedSheets = planSheets.filter((sheet) => sheet.date === targetDate);
  const summaryDraft = summarizeTomorrowPlan(records);
  return {
    spreadsheetId,
    sheetName: selectedSheets.map((sheet) => sheet.name).join(", ") || "",
    requestedDate: targetDate,
    selectedDate,
    latestDate,
    availableDates,
    sheets: planSheets,
    records,
    summary: {
      records: summaryDraft.records,
      plannedManpower: summaryDraft.plannedManpower,
      workItems: summaryDraft.workItems,
      sites: summaryDraft.sites.size,
      categories: summaryDraft.categories.size,
    },
    siteBreakdown: tomorrowPlanBreakdown(records, "site"),
    categoryBreakdown: tomorrowPlanBreakdown(records, "category"),
    submitterBreakdown: tomorrowPlanBreakdown(records, "submittedBy"),
  };
}

async function readDmrDashboard(dateKey, { ensureToday = true } = {}) {
  const spreadsheetId = getActiveDmrSpreadsheetId();
  const date = dmrDateKey(dateKey);
  if (ensureToday) await ensureDmrTab(spreadsheetId, date);
  const sheets = await fetchRawSheetValues(spreadsheetId);
  const parsedTabs = sheets
    .map((sheet) => {
      const tabDate = dmrDateFromTabName(sheet.name, Number(date.slice(0, 4)) || new Date().getFullYear());
      if (!tabDate) return null;
      const parsed = parseDmrSheetValues({ values: sheet.values || [], sheetName: sheet.name, dateKey: tabDate });
      return {
        sheetName: sheet.name,
        date: tabDate,
        records: parsed.records || [],
        equipment: parsed.equipment || [],
        materials: parsed.materials || [],
        notes: parsed.notes || [],
        staffAttendance: parsed.staffAttendance || [],
        sites: parsed.sites || [],
        agencies: parsed.agencies || [],
        error: parsed.error || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
  const today = parsedTabs.find((tab) => tab.date === date) || { sheetName: dmrTabName(date), date, records: [], sites: [], agencies: [] };
  const allRecords = parsedTabs.flatMap((tab) => tab.records);
  let todayPlan = null;
  let tomorrowPlan = null;
  try {
    todayPlan = await readDmrTomorrowPlan(date);
  } catch (error) {
    console.error("Today plan read error:", error);
    todayPlan = emptyDmrTomorrowPlan({ date, label: "Today's Plan", error: error.message });
  }
  try {
    const tomorrowDate = addDaysToDateKey(date, 1) || date;
    tomorrowPlan = await readDmrTomorrowPlan(tomorrowDate);
  } catch (error) {
    console.error("Tomorrow plan read error:", error);
    tomorrowPlan = emptyDmrTomorrowPlan({ date: addDaysToDateKey(date, 1) || date, label: "Tomorrow's Plan", error: error.message });
  }
  const recentTabs = parsedTabs.slice(0, 14).map((tab) => ({
    date: tab.date,
    sheetName: tab.sheetName,
    totals: dmrSummary(tab.records),
  }));

  return {
    spreadsheetId,
    date,
    sheetName: today.sheetName,
    today: {
      records: today.records,
      equipment: today.equipment || [],
      materials: today.materials || [],
      notes: today.notes || [],
      staffAttendance: today.staffAttendance || [],
      totals: dmrSummary(today.records),
      siteBreakdown: dmrBreakdown(today.records, "site"),
      agencyBreakdown: dmrBreakdown(today.records, "agency"),
      sites: [...new Set(today.records.map((record) => record.site))],
      agencies: [...new Set(today.records.map((record) => record.agency))].sort((a, b) => a.localeCompare(b)),
    },
    workbook: {
      sheets: parsedTabs.map((tab) => ({ date: tab.date, sheetName: tab.sheetName, recordCount: tab.records.length })),
      totals: dmrSummary(allRecords),
      recentTabs,
      siteBreakdown: dmrBreakdown(allRecords, "site"),
      agencyBreakdown: dmrBreakdown(allRecords, "agency"),
    },
    todayPlan: todayPlan ? { ...todayPlan, label: "Today's Plan" } : emptyDmrTomorrowPlan({ date, label: "Today's Plan" }),
    tomorrowPlan: tomorrowPlan ? { ...tomorrowPlan, label: "Tomorrow's Plan" } : emptyDmrTomorrowPlan({ date: addDaysToDateKey(date, 1) || date, label: "Tomorrow's Plan" }),
  };
}

function projectRowMatches(row, headers, assignment, project) {
  const projectColumn = projectFindColumn(headers, assignment.mapping?.projectColumn, PROJECT_FIELD_PATTERNS.project);
  if (!projectColumn) return true;
  const value = projectText(row[projectColumn]).toLowerCase();
  if (!value) return false;
  const accepted = [assignment.projectValue, project.name, ...(project.aliases || [])]
    .map((item) => projectText(item).toLowerCase())
    .filter(Boolean);
  return accepted.some((item) => value === item || value.includes(item) || item.includes(value));
}

function normalizeProjectRow({ row, headers, assignment, project, doc, tab, category }) {
  const mapping = assignment.mapping || {};
  const projectColumn = projectFindColumn(headers, mapping.projectColumn, PROJECT_FIELD_PATTERNS.project);
  const titleColumn = projectFindColumn(headers, mapping.titleColumn, PROJECT_FIELD_PATTERNS.title);
  const statusColumn = projectFindColumn(headers, mapping.statusColumn, PROJECT_FIELD_PATTERNS.status);
  const dueDateColumn = projectFindColumn(headers, mapping.dueDateColumn, PROJECT_FIELD_PATTERNS.dueDate);
  const startDateColumn = projectFindColumn(headers, mapping.startDateColumn, PROJECT_FIELD_PATTERNS.startDate);
  const completedDateColumn = projectFindColumn(headers, mapping.completedDateColumn, PROJECT_FIELD_PATTERNS.completedDate);
  const updatedDateColumn = projectFindColumn(headers, mapping.updatedDateColumn, PROJECT_FIELD_PATTERNS.updatedDate);
  const ownerColumn = projectFindColumn(headers, mapping.ownerColumn, PROJECT_FIELD_PATTERNS.owner);
  const notesColumn = projectFindColumn(headers, mapping.notesColumn, PROJECT_FIELD_PATTERNS.notes);
  const agencyColumn = projectFindColumn(headers, mapping.agencyColumn, PROJECT_FIELD_PATTERNS.agency);
  const supervisorColumn = projectFindColumn(headers, mapping.supervisorColumn, PROJECT_FIELD_PATTERNS.supervisor);
  const tradeColumn = projectFindColumn(headers, mapping.tradeColumn, PROJECT_FIELD_PATTERNS.trade);
  const floorColumn = projectFindColumn(headers, mapping.floorColumn, PROJECT_FIELD_PATTERNS.floor);
  const areaColumn = projectFindColumn(headers, mapping.areaColumn, PROJECT_FIELD_PATTERNS.area);
  const priorityColumn = projectFindColumn(headers, mapping.priorityColumn, PROJECT_FIELD_PATTERNS.priority);
  const pendingStagesColumn = projectFindColumn(headers, mapping.pendingStagesColumn, PROJECT_FIELD_PATTERNS.pendingStages);
  const stageStatuses = Object.fromEntries(PROJECT_WORKFLOW_STAGES.map((stage) => [
    stage,
    projectStageState(row[headers.find((header) => header.toLowerCase() === stage.toLowerCase())]),
  ]));
  const knownStages = Object.values(stageStatuses).filter((value) => value !== "unknown");
  const stagesCompleted = knownStages.filter((value) => value === "done").length;
  const stagesBlocked = knownStages.filter((value) => value === "blocked").length;
  const stageComplete = knownStages.length > 0 && stagesCompleted === knownStages.length;
  const rawStatus = projectText(row[statusColumn]);
  const notes = projectText(row[notesColumn]);
  const flags = projectStatusFlags(rawStatus, notes);
  const fallbackTitleColumn = headers.find((header) => projectText(row[header]) && ![projectColumn, statusColumn, dueDateColumn, completedDateColumn, updatedDateColumn].includes(header));
  const pendingStages = projectText(row[pendingStagesColumn]);
  const status = stageComplete ? "Completed" : pendingStages || rawStatus || (knownStages.length ? "Pending" : "");
  const trade = projectText(row[tradeColumn]) || (
    doc.sheetArchitecture?.kind === kalhaarPendingWorkDlArchitecture.KIND ? tab.name : ""
  );
  const agency = projectText(row[agencyColumn]);
  const supervisor = projectText(row[supervisorColumn]);
  const title = projectText(row[titleColumn || fallbackTitleColumn]) || `${category} record`;
  const startDate = projectDateKey(row[startDateColumn]);
  const dueDate = projectDateKey(row[dueDateColumn]);
  const record = {
    id: `${doc.id}:${tab.name}:${row.__rowIndex}`,
    projectId: project.id,
    category,
    title,
    status,
    trade,
    agency,
    supervisor,
    owner: projectText(row[ownerColumn]) || supervisor || agency,
    floor: projectText(row[floorColumn]),
    area: projectText(row[areaColumn]),
    priority: projectText(row[priorityColumn]),
    pendingStages,
    notes,
    startDate,
    dueDate,
    completedDate: projectDateKey(row[completedDateColumn]),
    updatedDate: projectDateKey(row[updatedDateColumn]),
    completed: stageComplete || flags.completed,
    blocked: stagesBlocked > 0 || flags.blocked,
    cancelled: flags.cancelled,
    stageStatuses,
    stagesCompleted,
    stagesTracked: knownStages.length,
    source: {
      documentId: doc.id,
      documentName: doc.name,
      sheetId: doc.sheetId,
      tab: tab.name,
      row: row.__rowIndex,
    },
    values: Object.fromEntries(headers.slice(0, 30).map((header) => [header, row[header] ?? ""])),
  };
  record.dedupeKey = projectDedupeKey(record);
  record.searchText = [
    title, trade, agency, supervisor, record.floor, record.area, status, pendingStages, notes, doc.name, tab.name,
  ].map(projectText).join(" ").toLowerCase();
  return record;
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
    const sheetData = await fetchSheetDataset(sheetId, { force: true });
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

setTimeout(async () => {
  let recovered = 0;
  for (const doc of documents) {
    const vector = reconcileDocumentVector(doc);
    if (vector.valid && doc.isReady) recovered += 1;
  }
  if (recovered > 0) saveDocuments();
  console.log(`Reconciled ${recovered}/${documents.length} document vector indexes`);

  for (const doc of documents.filter((item) => item.type === "sheet" && item.sheetId)) {
    const vector = inspectVectorFile(doc.id);
    if (vector.valid) continue;
    try {
      console.log(`Rebuilding missing vector index for sheet "${doc.name}"`);
      await syncSheet(doc.id, doc.sheetId);
    } catch (error) {
      console.error(`Startup vector rebuild failed for ${doc.id}:`, error.message);
    }
  }
}, 0);

setInterval(async () => {
  const sheetDocs = documents.filter((d) => d.type === "sheet");

  for (const doc of sheetDocs) {
    try {
      const vector = inspectVectorFile(doc.id);
      if (processingStatus[doc.id] && !processingStatus[doc.id].ready && !processingStatus[doc.id].error) continue;
      const currentModifiedTime = await fetchSheetModifiedTime(doc.sheetId);
      if (!vector.valid || (currentModifiedTime && currentModifiedTime !== doc.lastModifiedTime)) {
        console.log(`📊 Sheet "${doc.name}" needs vector sync — processing...`);
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
  kalhaarPendingWorkDlArchitecture,
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
  if (sheetId === kalhaarPendingWorkDlArchitecture.SHEET_ID) return "Kalhaar Pending Work Tracker";
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
    const vector = reconcileDocumentVector(doc, { persist: true });
    return {
      ...doc,
      allowedUserIds: activeGrantUserIds(doc),
      isReady: vector.valid && doc.isReady,
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

  const vector = doc ? reconcileDocumentVector(doc, { persist: true }) : { valid: false };
  const isReady = Boolean(doc?.isReady && vector.valid);

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

function normalizeProjectInput(body, existing = {}) {
  const name = projectText(body?.name ?? existing.name);
  if (!name) throw new Error("Project name is required");
  const assignments = Array.isArray(body?.assignments ?? existing.assignments)
    ? (body?.assignments ?? existing.assignments).map((assignment) => ({
        id: projectText(assignment.id) || crypto.randomUUID(),
        documentId: projectText(assignment.documentId),
        tabs: Array.isArray(assignment.tabs) ? assignment.tabs.map(projectText).filter(Boolean) : [],
        category: projectText(assignment.category) || "auto",
        projectValue: projectText(assignment.projectValue),
        mapping: Object.fromEntries(
          Object.entries(assignment.mapping || {})
            .map(([key, value]) => [key, projectText(value)])
            .filter(([, value]) => value)
        ),
      })).filter((assignment) => assignment.documentId)
    : [];
  const incomingDmr = body?.dmr !== undefined ? body.dmr : existing.dmr;
  const dmr = {
    ...(existing.dmr || {}),
    ...(incomingDmr || {}),
    enabled: Boolean(incomingDmr?.enabled ?? existing.dmr?.enabled),
    spreadsheetId: normalizeSpreadsheetId(incomingDmr?.spreadsheetId ?? existing.dmr?.spreadsheetId),
    siteNames: Array.isArray(incomingDmr?.siteNames ?? existing.dmr?.siteNames)
      ? (incomingDmr?.siteNames ?? existing.dmr?.siteNames).map(projectText).filter(Boolean)
      : [],
    agencyNames: Array.isArray(incomingDmr?.agencyNames ?? existing.dmr?.agencyNames)
      ? (incomingDmr?.agencyNames ?? existing.dmr?.agencyNames).map(projectText).filter(Boolean)
      : [],
    assignedUserIds: Array.isArray(incomingDmr?.assignedUserIds ?? existing.dmr?.assignedUserIds)
      ? (incomingDmr?.assignedUserIds ?? existing.dmr?.assignedUserIds).map(projectText).filter(Boolean)
      : [],
    editableUserIds: Array.isArray(incomingDmr?.editableUserIds ?? existing.dmr?.editableUserIds)
      ? (incomingDmr?.editableUserIds ?? existing.dmr?.editableUserIds).map(projectText).filter(Boolean)
      : [],
  };
  return {
    ...existing,
    name,
    code: projectText(body?.code ?? existing.code),
    location: projectText(body?.location ?? existing.location),
    manager: projectText(body?.manager ?? existing.manager),
    status: projectText(body?.status ?? existing.status) || "active",
    aliases: Array.isArray(body?.aliases ?? existing.aliases)
      ? (body?.aliases ?? existing.aliases).map(projectText).filter(Boolean)
      : [],
    assignments,
    dmr,
    updatedAt: new Date().toISOString(),
  };
}

app.get("/project-dashboard/config", requireSuperAdmin, async (req, res) => {
  const db = await connectAuthDb();
  const sheetDocs = documents.filter((doc) => doc.type === "sheet" && isDocumentVisible(doc, req));
  const sheets = [];
  for (const doc of sheetDocs) {
    let architecture = doc.sheetArchitecture;
    if (!architecture?.tabs?.length && doc.isReady) {
      try {
        architecture = await saveSheetArchitecture(doc.id, await fetchSheetDataset(doc.sheetId));
      } catch (error) {
        console.warn(`Could not prepare mapping metadata for ${doc.name}:`, error.message);
      }
    }
    sheets.push({
      id: doc.id,
      name: doc.name,
      sheetId: doc.sheetId,
      isReady: Boolean(doc.isReady),
      status: doc.status,
      tabs: (architecture?.tabs || []).map((tab) => ({
        name: tab.name,
        headers: tab.headers || [],
        rowCount: tab.rowCount || 0,
      })),
    });
  }
  const users = await db.collection("users").find({ blacklisted: { $ne: true } }).sort({ displayName: 1 }).toArray();
  res.json({
    projects: projectDashboardConfig.projects,
    sheets,
    users: users.map((user) => ({
      id: String(user._id),
      displayName: user.displayName || user.username,
      username: user.username,
      isSuperAdmin: Boolean(user.isSuperAdmin),
    })),
  });
});

app.post("/project-dashboard/projects", requireSuperAdmin, (req, res) => {
  try {
    const now = new Date().toISOString();
    const project = normalizeProjectInput(req.body, {
      id: crypto.randomUUID(),
      createdAt: now,
      createdBy: req.authUser?.id || null,
    });
    projectDashboardConfig.projects.push(project);
    saveProjectDashboardConfig();
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/project-dashboard/projects/:id", requireSuperAdmin, (req, res) => {
  try {
    const index = projectDashboardConfig.projects.findIndex((project) => project.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Project not found" });
    projectDashboardConfig.projects[index] = normalizeProjectInput(req.body, projectDashboardConfig.projects[index]);
    saveProjectDashboardConfig();
    res.json({ success: true, project: projectDashboardConfig.projects[index] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/project-dashboard/projects/:id", requireSuperAdmin, (req, res) => {
  const before = projectDashboardConfig.projects.length;
  projectDashboardConfig.projects = projectDashboardConfig.projects.filter((project) => project.id !== req.params.id);
  if (before === projectDashboardConfig.projects.length) return res.status(404).json({ error: "Project not found" });
  saveProjectDashboardConfig();
  res.json({ success: true });
});

function emptyDmrDashboard(date) {
  return {
    spreadsheetId: "",
    date,
    sheetName: dmrTabName(date),
    today: {
      records: [],
      equipment: [],
      materials: [],
      notes: [],
      staffAttendance: [],
      totals: dmrSummary([]),
      siteBreakdown: [],
      agencyBreakdown: [],
      sites: [],
      agencies: [],
    },
    workbook: {
      sheets: [],
      totals: dmrSummary([]),
      recentTabs: [],
      siteBreakdown: [],
      agencyBreakdown: [],
    },
    todayPlan: emptyDmrTomorrowPlan({ date, label: "Today's Plan" }),
    tomorrowPlan: emptyDmrTomorrowPlan({ date: addDaysToDateKey(date, 1) || date, label: "Tomorrow's Plan" }),
  };
}

app.get("/dmr-dashboard/settings", (req, res) => {
  if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
  res.json({
    settings: publicDmrSettings(),
    canManage: Boolean(req.user?.isSuperAdmin),
  });
});

app.put("/dmr-dashboard/settings", requireSuperAdmin, async (req, res) => {
  try {
    const spreadsheetId = normalizeSpreadsheetId(req.body?.spreadsheetId || req.body?.url || req.body?.link);
    if (!spreadsheetId) return res.status(400).json({ error: "Paste a valid Google Sheet link or spreadsheet ID" });
    const file = await assertNativeGoogleSpreadsheet(spreadsheetId, "DMR sheet");
    dmrSettings = {
      ...dmrSettings,
      spreadsheetId,
      linkedAt: new Date().toISOString(),
      linkedBy: req.authUser?.displayName || req.authUser?.username || "Super Admin",
      linkedFileName: file.name || null,
      unlinkedAt: null,
      unlinkedBy: null,
    };
    saveDmrSettings();
    addActivityLog({
      req,
      action: "Linked DMR sheet",
      target: file.name || spreadsheetId,
      details: { spreadsheetId },
    });
    res.json({ success: true, settings: publicDmrSettings() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/dmr-dashboard/settings", requireSuperAdmin, (req, res) => {
  const previousSpreadsheetId = normalizeSpreadsheetId(dmrSettings.spreadsheetId);
  dmrSettings = {
    ...dmrSettings,
    spreadsheetId: "",
    unlinkedAt: new Date().toISOString(),
    unlinkedBy: req.authUser?.displayName || req.authUser?.username || "Super Admin",
  };
  saveDmrSettings();
  addActivityLog({
    req,
    action: "Unlinked DMR sheet",
    target: previousSpreadsheetId || "DMR sheet",
  });
  res.json({ success: true, settings: publicDmrSettings() });
});

app.get("/dmr-dashboard", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
      ? String(req.query.date)
      : istDateKey(new Date());
    const dashboard = publicDmrSettings().linked
      ? await readDmrDashboard(date, { ensureToday: true })
      : emptyDmrDashboard(date);
    res.json({
      ...dashboard,
      canEdit: hasPrivilege(req, "edit_project_dmr"),
      canViewHistory: Boolean(req.user?.isSuperAdmin),
      canManageDmrSettings: Boolean(req.user?.isSuperAdmin),
      dmrSettings: publicDmrSettings(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("DMR dashboard error:", error);
    res.status(500).json({ error: `Could not load DMR dashboard: ${error.message}` });
  }
});

function dmrHistoryLabel(record) {
  if (!record) return "DMR row";
  if (record.type === "manpower") return `${record.agency} · ${record.site}`;
  if (record.type === "staff") return record.name || "Staff attendance";
  if (record.type === "equipment") return record.details || record.site || "Equipment & tools";
  if (record.type === "material") return record.details || record.site || "Materials";
  if (record.type === "note") return `Note row ${record.rowNumber}`;
  return record.label || record.id || "DMR row";
}

function buildDmrHistoryEntries({ req, date, sheetName, allowed, update }) {
  const entries = [];
  const base = {
    dmrDate: date,
    sheetName,
    section: allowed.type,
    rowNumber: allowed.rowNumber || null,
    label: dmrHistoryLabel(allowed),
    site: allowed.site || update.site || null,
    agency: allowed.agency || null,
  };
  const add = (field, fromValue, toValue) => {
    const before = projectText(fromValue);
    const after = projectText(toValue);
    if (before === after) return;
    entries.push({
      ...base,
      action: "updated",
      field,
      before,
      after,
      submissionId: projectText(update.submissionId) || null,
    });
  };
  if (allowed.type === "equipment") {
    add("site", allowed.site, update.site);
    add("details", allowed.details, update.details);
    add("quantity", allowed.quantity, update.quantity);
  } else if (allowed.type === "material") {
    add("site", allowed.site, update.site);
    add("details", allowed.details, update.details);
    add("unit", allowed.unit, update.unit);
    add("quantity", allowed.quantity, update.quantity);
  } else if (allowed.type === "note") {
    add("note", allowed.note, update.note);
  } else if (allowed.type === "staff") {
    add("attendance", allowed.status, update.status);
  } else {
    add("planned", allowed.planned, update.planned);
    add("actual", allowed.actual, update.actual);
  }
  return entries.map((entry) => ({ ...entry, ip: getClientIp(req) }));
}

app.patch("/dmr-dashboard", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
    if (!hasPrivilege(req, "edit_project_dmr")) return res.status(403).json({ error: "DMR fill permission required" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || ""))
      ? String(req.body.date)
      : istDateKey(new Date());
    const incomingUpdates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const submissionId = projectText(req.body?.submissionId) || `dmr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!incomingUpdates.length) return res.status(400).json({ error: "No DMR rows were provided" });
    const spreadsheetId = getActiveDmrSpreadsheetId();
    const today = await readDmrSheet(spreadsheetId, date, { ensure: true });
    const sectionRecords = [
      ...(today.records || []).map((record) => ({ ...record, type: "manpower" })),
      ...(today.equipment || []).map((record) => ({ ...record, type: "equipment" })),
      ...(today.materials || []).map((record) => ({ ...record, type: "material" })),
      ...(today.notes || []).map((record) => ({ ...record, type: "note" })),
      ...(today.staffAttendance || []).map((record) => ({ ...record, type: "staff" })),
    ];
    const allowedMap = new Map(sectionRecords.map((record) => [record.id, record]));
    const historyEntries = [];
    const updates = incomingUpdates.map((rawUpdate) => {
      const update = { ...rawUpdate, submissionId };
      const allowed = allowedMap.get(projectText(update.id));
      if (!allowed) return null;
      historyEntries.push(...buildDmrHistoryEntries({ req, date, sheetName: today.sheetName, allowed, update }));
      if (allowed.type === "equipment") {
        return {
          rowNumber: allowed.rowNumber,
          cells: [
            { column: allowed.siteColumn, value: update.site },
            { column: allowed.detailsColumn, value: update.details },
            { column: allowed.quantityColumn, value: update.quantity },
          ],
        };
      }
      if (allowed.type === "material") {
        return {
          rowNumber: allowed.rowNumber,
          cells: [
            { column: allowed.siteColumn, value: update.site },
            { column: allowed.detailsColumn, value: update.details },
            { column: allowed.unitColumn, value: update.unit },
            { column: allowed.quantityColumn, value: update.quantity },
          ],
        };
      }
      if (allowed.type === "note") {
        return {
          rowNumber: allowed.rowNumber,
          cells: [{ column: allowed.noteColumn, value: update.note }],
        };
      }
      if (allowed.type === "staff") {
        return {
          rowNumber: allowed.rowNumber,
          cells: [{ column: allowed.statusColumn, value: update.status }],
        };
      }
      return {
        rowNumber: allowed.rowNumber,
        plannedColumn: allowed.plannedColumn,
        actualColumn: allowed.actualColumn,
        planned: update.planned,
        actual: update.actual,
      };
    }).filter(Boolean);
    if (!updates.length) return res.status(400).json({ error: "No matching DMR rows found for this date" });
    const result = await writeDmrRecords(spreadsheetId, date, updates);
    addDmrHistory(req, historyEntries);
    addActivityLog({
      req,
      action: "Updated DMR dashboard",
      target: result.sheetName,
      details: { rows: updates.length, updatedCells: result.updatedCells },
    });
    res.json({ success: true, ...result, rows: updates.length });
  } catch (error) {
    console.error("DMR dashboard update error:", error);
    res.status(500).json({ error: `Could not save DMR: ${error.message}` });
  }
});

app.post("/dmr-dashboard/section-row", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
    if (!hasPrivilege(req, "edit_project_dmr")) return res.status(403).json({ error: "DMR fill permission required" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || ""))
      ? String(req.body.date)
      : istDateKey(new Date());
    const values = req.body?.values || {};
    const submissionId = projectText(req.body?.submissionId) || `dmr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const spreadsheetId = getActiveDmrSpreadsheetId();
    const result = await addDmrSectionRow(spreadsheetId, date, req.body?.section, values);
    addDmrHistory(req, [{
      submissionId,
      dmrDate: date,
      sheetName: result.sheetName,
      section: result.section,
      rowNumber: result.insertedRowNumber,
      action: "added row",
      field: "row",
      before: "",
      after: result.section === "notes"
        ? projectText(values.note)
        : [values.site, values.details, values.quantity, values.unit].map(projectText).filter(Boolean).join(" · "),
      label: result.section === "notes" ? "New note" : (projectText(values.details) || `New ${result.section} row`),
      site: projectText(values.site) || null,
      agency: null,
      ip: getClientIp(req),
    }]);
    addActivityLog({
      req,
      action: "Added DMR section row",
      target: result.sheetName,
      details: { section: result.section, rowNumber: result.insertedRowNumber },
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("DMR add row error:", error);
    res.status(500).json({ error: `Could not add DMR row: ${error.message}` });
  }
});

app.get("/dmr-dashboard/history", requireSuperAdmin, (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
    ? String(req.query.date)
    : "";
  const section = projectText(req.query.section).toLowerCase();
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 100));
  let items = dmrHistory;
  if (date) items = items.filter((entry) => entry.dmrDate === date);
  if (section) items = items.filter((entry) => projectText(entry.section).toLowerCase() === section);
  const grouped = [...items.reduce((result, entry) => {
    const key = projectText(entry.submissionId)
      || `${entry.createdAt || ""}|${entry.userId || entry.username || ""}|${entry.dmrDate || ""}|${entry.sheetName || ""}`;
    const current = result.get(key) || {
      id: key || entry.id,
      submissionId: entry.submissionId || null,
      createdAt: entry.createdAt,
      dmrDate: entry.dmrDate,
      sheetName: entry.sheetName,
      userId: entry.userId || null,
      username: entry.username || "System",
      displayName: entry.displayName || entry.username || "System",
      roleName: entry.roleName || null,
      changes: [],
    };
    current.createdAt = current.createdAt && entry.createdAt && current.createdAt > entry.createdAt ? current.createdAt : entry.createdAt || current.createdAt;
    current.changes.push(entry);
    result.set(key, current);
    return result;
  }, new Map()).values()]
    .map((group) => ({
      ...group,
      changeCount: group.changes.length,
      sections: [...new Set(group.changes.map((change) => projectText(change.section)).filter(Boolean))],
      actions: [...new Set(group.changes.map((change) => projectText(change.action)).filter(Boolean))],
      rowCount: new Set(group.changes.map((change) => change.rowNumber).filter(Boolean)).size,
    }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  res.json({ history: grouped.slice(0, limit), total: grouped.length });
});

app.get("/project-dashboard/dmr", async (req, res) => {
  try {
    const project = projectDashboardConfig.projects.find((item) => item.id === req.query.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.dmr?.enabled || !project.dmr?.spreadsheetId) {
      return res.status(400).json({ error: "DMR is not configured for this project" });
    }
    if (!canViewProjectDmr(project, req)) return res.status(403).json({ error: "DMR access is not assigned to this user" });

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
      ? String(req.query.date)
      : istDateKey(new Date());
    const dmrSheet = await readDmrSheet(project.dmr.spreadsheetId, date, { ensure: true });
    const allowedAgencyNames = new Set((project.dmr.agencyNames || []).map((item) => projectText(item).toLowerCase()).filter(Boolean));
    const records = dmrSheet.records.filter((record) => {
      if (!dmrProjectMatchesSite(project, project.dmr, record.site)) return false;
      if (allowedAgencyNames.size && !allowedAgencyNames.has(projectText(record.agency).toLowerCase())) return false;
      return true;
    });
    const totals = records.reduce((result, record) => {
      result.planned += Number(record.planned) || 0;
      result.actual += Number(record.actual) || 0;
      if (record.actual || record.planned) result.filled += 1;
      return result;
    }, { planned: 0, actual: 0, filled: 0 });
    totals.variance = totals.actual - totals.planned;
    totals.records = records.length;
    totals.missing = Math.max(0, records.length - totals.filled);
    const agencyBreakdown = [...records.reduce((result, record) => {
      const current = result.get(record.agency) || { agency: record.agency, planned: 0, actual: 0, variance: 0 };
      current.planned += Number(record.planned) || 0;
      current.actual += Number(record.actual) || 0;
      current.variance = current.actual - current.planned;
      result.set(record.agency, current);
      return result;
    }, new Map()).values()].sort((a, b) => b.actual - a.actual || a.agency.localeCompare(b.agency));

    res.json({
      projectId: project.id,
      projectName: project.name,
      date,
      sheetName: dmrSheet.sheetName,
      created: Boolean(dmrSheet.created),
      canEdit: canEditProjectDmr(project, req),
      records,
      totals,
      agencyBreakdown,
      sites: [...new Set(records.map((record) => record.site))],
      agencies: [...new Set(records.map((record) => record.agency))].sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    console.error("Project DMR read error:", error);
    res.status(500).json({ error: `Could not load DMR: ${error.message}` });
  }
});

app.patch("/project-dashboard/dmr", async (req, res) => {
  try {
    const project = projectDashboardConfig.projects.find((item) => item.id === req.body?.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.dmr?.enabled || !project.dmr?.spreadsheetId) {
      return res.status(400).json({ error: "DMR is not configured for this project" });
    }
    if (!canEditProjectDmr(project, req)) return res.status(403).json({ error: "DMR edit permission is required" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || ""))
      ? String(req.body.date)
      : istDateKey(new Date());
    const incomingUpdates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (!incomingUpdates.length) return res.status(400).json({ error: "No DMR rows were provided" });

    const dmrSheet = await readDmrSheet(project.dmr.spreadsheetId, date, { ensure: true });
    const allowedAgencyNames = new Set((project.dmr.agencyNames || []).map((item) => projectText(item).toLowerCase()).filter(Boolean));
    const allowedRecords = dmrSheet.records.filter((record) => {
      if (!dmrProjectMatchesSite(project, project.dmr, record.site)) return false;
      if (allowedAgencyNames.size && !allowedAgencyNames.has(projectText(record.agency).toLowerCase())) return false;
      return true;
    });
    const allowedMap = new Map(allowedRecords.map((record) => [record.id, record]));
    const updates = incomingUpdates.map((update) => {
      const allowed = allowedMap.get(projectText(update.id));
      if (!allowed) return null;
      return {
        rowNumber: allowed.rowNumber,
        plannedColumn: allowed.plannedColumn,
        actualColumn: allowed.actualColumn,
        planned: update.planned,
        actual: update.actual,
      };
    }).filter(Boolean);
    if (!updates.length) return res.status(403).json({ error: "No editable DMR rows matched this project scope" });

    const result = await writeDmrRecords(project.dmr.spreadsheetId, date, updates);
    addActivityLog({
      req,
      action: "Updated project DMR",
      target: `${project.name} · ${result.sheetName}`,
      details: { rows: updates.length, updatedCells: result.updatedCells },
    });
    res.json({ success: true, ...result, rows: updates.length });
  } catch (error) {
    console.error("Project DMR update error:", error);
    res.status(500).json({ error: `Could not save DMR: ${error.message}` });
  }
});

app.get("/project-dashboard", async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
      ? String(req.query.date)
      : istDateKey(new Date());
    const visibleSheetDocs = new Map(
      documents
        .filter((doc) => doc.type === "sheet" && doc.isActive !== false && doc.isReady && isDocumentVisible(doc, req))
        .map((doc) => [doc.id, doc])
    );
    const datasetCache = new Map();
    const dashboardProjects = [];

    for (const project of projectDashboardConfig.projects.filter((item) => item.status !== "archived")) {
      const records = [];
      const sources = [];
      for (const assignment of project.assignments || []) {
        const doc = visibleSheetDocs.get(assignment.documentId);
        if (!doc) {
          sources.push({ documentId: assignment.documentId, status: "unavailable" });
          continue;
        }
        try {
          if (!datasetCache.has(doc.id)) datasetCache.set(doc.id, await fetchSheetDataset(doc.sheetId));
          const dataset = datasetCache.get(doc.id);
          const tabs = projectTabsForAssignment(doc, dataset, assignment);
          let sourceRecordCount = 0;
          for (const tab of tabs) {
            const category = projectCategory(assignment, doc, tab);
            for (const row of tab.rows || []) {
              if (!projectRowMatches(row, tab.headers || [], assignment, project)) continue;
              const normalizedRecord = normalizeProjectRow({
                row,
                headers: tab.headers || [],
                assignment,
                project,
                doc,
                tab,
                category,
              });
              records.push(normalizedRecord);
              sourceRecordCount += 1;
            }
          }
          sources.push({
            documentId: doc.id,
            documentName: doc.name,
            status: "ready",
            recordCount: sourceRecordCount,
            category: assignment.category || "auto",
          });
        } catch (error) {
          sources.push({ documentId: doc.id, documentName: doc.name, status: "failed", error: error.message });
        }
      }

      const deduplicatedRecords = [...records.reduce((result, record) => {
        const key = record.dedupeKey || record.id;
        const current = result.get(key);
        if (!current || projectRecordScore(record) > projectRecordScore(current)) result.set(key, record);
        return result;
      }, new Map()).values()];
      const activeRecords = deduplicatedRecords.filter((record) => !record.cancelled);
      const completedRecords = activeRecords.filter((record) => record.completed);
      const dueToday = activeRecords.filter((record) => record.dueDate === date && !record.completed);
      const startingToday = activeRecords.filter((record) => record.startDate === date && !record.completed);
      const completedToday = activeRecords.filter((record) => record.completedDate === date || (record.completed && record.updatedDate === date));
      const actionsToday = activeRecords.filter((record) => record.updatedDate === date || record.completedDate === date);
      const overdue = activeRecords.filter((record) => record.dueDate && record.dueDate < date && !record.completed);
      const blocked = activeRecords.filter((record) => record.blocked && !record.completed);
      const upcoming = activeRecords
        .filter((record) => record.dueDate && record.dueDate > date && !record.completed)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const attendanceToday = activeRecords.filter((record) => record.category === "attendance" && [record.updatedDate, record.dueDate, record.completedDate].includes(date));
      const attendancePresent = attendanceToday.filter((record) => /\b(present|yes|p)\b/i.test(record.status || record.notes)).length;
      const attendanceAbsent = attendanceToday.filter((record) => /\b(absent|no|a|leave)\b/i.test(record.status || record.notes)).length;
      const categoryCounts = activeRecords.reduce((result, record) => {
        result[record.category] = (result[record.category] || 0) + 1;
        return result;
      }, {});
      const stageCounts = PROJECT_WORKFLOW_STAGES.reduce((result, stage) => {
        const key = stage.toLowerCase();
        const stageRecords = activeRecords.filter((record) => record.stageStatuses?.[stage] && record.stageStatuses[stage] !== "unknown");
        result[key] = {
          total: stageRecords.length,
          done: stageRecords.filter((record) => record.stageStatuses[stage] === "done").length,
          pending: stageRecords.filter((record) => ["pending", "in_progress", "blocked"].includes(record.stageStatuses[stage])).length,
          blocked: stageRecords.filter((record) => record.stageStatuses[stage] === "blocked").length,
        };
        return result;
      }, {});
      const buildBreakdown = (field) => [...activeRecords.reduce((result, record) => {
        const label = projectText(record[field]) || "Unassigned";
        const item = result.get(label) || { label, total: 0, pending: 0, overdue: 0, blocked: 0 };
        item.total += 1;
        if (!record.completed) item.pending += 1;
        if (record.dueDate && record.dueDate < date && !record.completed) item.overdue += 1;
        if (record.blocked && !record.completed) item.blocked += 1;
        result.set(label, item);
        return result;
      }, new Map()).values()].sort((a, b) => b.pending - a.pending || b.total - a.total);
      const agencyBreakdown = buildBreakdown("agency");
      const tradeBreakdown = buildBreakdown("trade");
      const progressBase = activeRecords.filter((record) => record.category !== "attendance");
      const trackedStageTotal = progressBase.reduce((total, record) => total + record.stagesTracked, 0);
      const trackedStageDone = progressBase.reduce((total, record) => total + record.stagesCompleted, 0);
      const progress = trackedStageTotal
        ? Math.round((trackedStageDone / trackedStageTotal) * 100)
        : progressBase.length
        ? Math.round((progressBase.filter((record) => record.completed).length / progressBase.length) * 100)
        : 0;
      const take = (items, limit = 100) => items.slice(0, limit);

      dashboardProjects.push({
        id: project.id,
        name: project.name,
        code: project.code,
        location: project.location,
        manager: project.manager,
        status: project.status,
        date,
        dmr: {
          enabled: Boolean(project.dmr?.enabled && project.dmr?.spreadsheetId),
          canView: Boolean(project.dmr?.enabled && project.dmr?.spreadsheetId && canViewProjectDmr(project, req)),
          canEdit: Boolean(project.dmr?.enabled && project.dmr?.spreadsheetId && canEditProjectDmr(project, req)),
        },
        metrics: {
          progress,
          totalRecords: activeRecords.length,
          completed: completedRecords.length,
          pending: activeRecords.filter((record) => !record.completed).length,
          dueToday: dueToday.length,
          startingToday: startingToday.length,
          completedToday: completedToday.length,
          actionsToday: actionsToday.length,
          overdue: overdue.length,
          blocked: blocked.length,
          attendancePresent,
          attendanceAbsent,
          agencies: agencyBreakdown.filter((item) => item.label !== "Unassigned").length,
          trades: tradeBreakdown.filter((item) => item.label !== "Unassigned").length,
        },
        stageCounts,
        agencyBreakdown,
        tradeBreakdown,
        categoryCounts,
        highlights: {
          dueToday: take(dueToday),
          startingToday: take(startingToday),
          completedToday: take(completedToday),
          actionsToday: take(actionsToday),
          overdue: take(overdue),
          blocked: take(blocked),
          upcoming: take(upcoming, 30),
        },
        records: take(activeRecords, 1000),
        sources,
        coverage: {
          hasCompletionDates: activeRecords.some((record) => record.completedDate),
          hasUpdateDates: activeRecords.some((record) => record.updatedDate),
          rawRecords: records.length,
          deduplicatedRecords: activeRecords.length,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    res.json({
      date,
      projects: dashboardProjects,
      totals: dashboardProjects.reduce((totals, project) => {
        totals.projects += 1;
        totals.dueToday += project.metrics.dueToday;
        totals.completedToday += project.metrics.completedToday;
        totals.overdue += project.metrics.overdue;
        totals.blocked += project.metrics.blocked;
        return totals;
      }, { projects: 0, dueToday: 0, completedToday: 0, overdue: 0, blocked: 0 }),
    });
  } catch (error) {
    console.error("Project dashboard error:", error);
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
