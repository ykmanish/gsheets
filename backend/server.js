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
const PDFDocument = require("pdfkit");
const { pipeline } = require("@xenova/transformers");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const { processDocument, processSheetText } = require("./lib/processDocument");
const { createWhatsAppService, normalizePhone } = require("./lib/whatsappService");
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
const DEFAULT_MRN_SPREADSHEET_ID = process.env.MRN_SPREADSHEET_ID || "1Vfjgihl1Cf4Xe9SdBDoJWQHxaEGkn8c2KhH6qN92BJw";
const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "documents", label: "Documents" },
  { id: "forms", label: "Forms" },
  { id: "projects", label: "Projects" },
  { id: "project-dmr", label: "DMR" },
  { id: "project-mrn", label: "MRN" },
  { id: "site-images", label: "Site Images" },
  { id: "sheet-dashboard", label: "Sheet Dashboard" },
  { id: "automations", label: "Automation" },
  { id: "reports", label: "Reports" },
  { id: "employee-daily-report", label: "Employee Daily Report" },
  { id: "activity-log", label: "Activity Log" },
  { id: "manage-roles", label: "Manage Roles" },
  { id: "manage-users", label: "Manage Users" },
];
const SUPER_ADMIN_MENU_ITEMS = [{ id: "whatsapp", label: "WhatsApp" }, { id: "module-control", label: "Module Control" }];
const ALL_MENU_ITEMS = [...MENU_ITEMS, ...SUPER_ADMIN_MENU_ITEMS];
const PROTECTED_GLOBAL_MODULES = new Set(["dashboard", "module-control"]);
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
  { id: "view_employee_daily_reports", label: "View all employee daily reports" },
  { id: "view_activity_log", label: "View activity log" },
  { id: "edit_project_dmr", label: "Fill project DMR records" },
  { id: "edit_project_mrn", label: "Add MRN records" },
];

let mongoClient;
let authDb;
let moduleControlCache = { disabledModules: [], expiresAt: 0 };
const employeeDailyQuoteBuilds = new Map();

async function connectAuthDb() {
  if (authDb) return authDb;
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  authDb = mongoClient.db();
  await authDb.collection("users").createIndex({ usernameLower: 1 }, { unique: true });
  await authDb.collection("roles").createIndex({ nameLower: 1 }, { unique: true });
  await authDb.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await authDb.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await authDb.collection("employeeDailyReports").createIndex({ userId: 1, reportDate: 1 }, { unique: true });
  await authDb.collection("employeeDailyReports").createIndex({ reportDate: -1, submittedAt: -1 });
  await authDb.collection("employeeExecutiveReportAnswers").createIndex({ userId: 1, reportDate: 1 }, { unique: true });
  await authDb.collection("employeeExecutiveReportAnswers").createIndex({ reportDate: -1, employeeName: 1 });
  await authDb.collection("employeeExecutiveReportAnalyses").createIndex({ cacheKey: 1 }, { unique: true });
  await seedSuperAdmin();
  return authDb;
}

async function getDisabledModules({ fresh = false } = {}) {
  if (!fresh && moduleControlCache.expiresAt > Date.now()) return [...moduleControlCache.disabledModules];
  const db = await connectAuthDb();
  const setting = await db.collection("platformSettings").findOne({ _id: "module-control" });
  const disabledModules = (setting?.disabledModules || []).filter((id) => ALL_MENU_ITEMS.some((item) => item.id === id) && !PROTECTED_GLOBAL_MODULES.has(id));
  moduleControlCache = { disabledModules, expiresAt: Date.now() + 5000 };
  return [...disabledModules];
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

function profileText(value, max = 120) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function profilePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function isSuperAdminRole(role) {
  return Boolean(role && (role.nameLower === "super admin" || String(role.name || "").trim().toLowerCase() === "super admin"));
}

function isEffectiveSuperAdmin(user, role) {
  return Boolean(user?.isSuperAdmin || isSuperAdminRole(role));
}

function roleMenusForUser(user, role) {
  return isEffectiveSuperAdmin(user, role) ? ALL_MENU_ITEMS.map((item) => item.id) : role?.menus || user?.menus || [];
}

function rolePrivilegesForUser(user, role) {
  return isEffectiveSuperAdmin(user, role) ? PRIVILEGE_ITEMS.map((item) => item.id) : role?.privileges || user?.privileges || [];
}

function sanitizeUser(user, role) {
  if (!user) return null;
  const superAdmin = isEffectiveSuperAdmin(user, role);
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || "",
    phone: user.phone || "",
    whatsappPhone: user.whatsappPhone || user.whatsappNumber || "",
    department: user.department || "",
    designation: user.designation || user.jobTitle || "",
    roleId: user.roleId ? String(user.roleId) : null,
    roleName: role?.name || user.roleName || null,
    menus: roleMenusForUser(user, role),
    privileges: rolePrivilegesForUser(user, role),
    isSuperAdmin: superAdmin,
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
  await db.collection("users").updateMany(
    { roleId: role._id },
    { $set: { isSuperAdmin: true, updatedAt: now } }
  );
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
    req.disabledModules = await getDisabledModules();
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.authUser?.isSuperAdmin) return res.status(403).json({ error: "Super Admin access required" });
  next();
}

function hasPrivilege(req, privilege) {
  if (req?.authUser?.isSuperAdmin) return true;
  return Boolean(req?.authUser?.privileges?.includes(privilege));
}

function hasMenuAccess(req, menuId) {
  if (req?.disabledModules?.includes(menuId) && !PROTECTED_GLOBAL_MODULES.has(menuId)) return false;
  if (req?.authUser?.isSuperAdmin) return true;
  return Boolean(req?.authUser?.menus?.includes(menuId));
}

function hasAllDocumentAccess(req) {
  return Boolean(req?.authUser?.isSuperAdmin);
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
    res.json({ token, user: sanitizeUser(user, role), menus: roleMenusForUser(user, role), disabledModules: await getDisabledModules() });
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

app.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.authUser, menus: roleMenusForUser(req.user, req.role), disabledModules: await getDisabledModules() });
});

app.get("/profile", requireAuth, async (req, res) => {
  const role = req.role || await getRole(req.user?.roleId);
  res.json({ user: sanitizeUser(req.user, role) });
});

app.patch("/profile", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const update = {
      displayName: profileText(body.displayName || req.user.displayName || req.user.username, 80),
      email: profileText(body.email, 120),
      phone: profilePhone(body.phone),
      whatsappPhone: profilePhone(body.whatsappPhone || body.phone),
      department: profileText(body.department, 80),
      designation: profileText(body.designation, 80),
      updatedAt: new Date(),
    };
    if (!update.displayName) return res.status(400).json({ error: "Display name is required" });
    const db = await connectAuthDb();
    await db.collection("users").updateOne({ _id: req.user._id }, { $set: update });
    const user = await db.collection("users").findOne({ _id: req.user._id });
    const role = await getRole(user?.roleId);
    res.json({ success: true, user: sanitizeUser(user, role) });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Could not update profile" });
  }
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
  verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
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

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "connected", timestamp: new Date().toISOString() });
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

const EMPLOYEE_REPORT_OPTIONS = {
  departments: ["Design", "Execution", "Procurement", "Coordination", "Site Supervision", "Vendor Management", "Human Resource", "Administration", "Accounts", "Social Media"],
  sites: ["Kalhaar", "Paramdham", "Asteria", "Imperial", "Serenity Meadows Farmhouse", "Silver White", "Devsharnam", "Gharana"],
  taskTypes: ["System Designing", "Drawing", "Render", "BoQ", "Material Approval", "Site Work", "Purchase Order", "Installation", "Client Approval", "Quotation", "Negotiation", "Recruitment", "Interview", "Induction", "Salary Processing", "Documentation", "Performance Meeting", "Market Survey", "Event Planning", "Delivery List", "Client Meeting", "IT Solution", "Data Entry", "OutOfOffice Work", "Site Visit", "Vendor Meeting", "PaymentProcessing", "PRN Supportive", "Audit", "Record Filing", "Legal Work", "System Training", "System Implementation", "Material Inspection", "Dispatch", "Packing/Forwarding", "Pre-Production", "Post-Production", "Over-a-Call", "Campaign", "Content Creation", "Other"],
  taskStatuses: ["In Progress", "Completed", "Work Halt", "Work Suspended", "Work Cancelled", "Other"],
  involvements: ["Self", "Client", "Vendor", "Team", "Other"],
};
const EMPLOYEE_REPORT_APP_TAB = "_AppData";
const EMPLOYEE_REPORT_APP_HEADERS = ["Report ID", "User ID", "Employee", "Department", "Report Date", "Submitted At", "Client", "Site", "Task Type", "Task Status", "Involvement", "Tomorrow Plan", "Note", "Task Items JSON", "Waiting Items JSON"];
const EMPLOYEE_REPORT_REMINDER_TEMPLATE = process.env.EMPLOYEE_REPORT_REMINDER_TEMPLATE || process.env.WHATSAPP_EMPLOYEE_REPORT_REMINDER_TEMPLATE || "daily_report_reminder";
const EMPLOYEE_REPORT_REMINDER_TEMPLATE_LANGUAGE = process.env.EMPLOYEE_REPORT_REMINDER_TEMPLATE_LANGUAGE || process.env.WHATSAPP_EMPLOYEE_REPORT_REMINDER_LANGUAGE || "en";
const EMPLOYEE_REPORT_REMINDER_LINK = process.env.EMPLOYEE_REPORT_REMINDER_LINK || process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || "http://localhost:3000/employee-daily-report";
const DEFAULT_EMPLOYEE_EXECUTIVE_QUESTIONS = [
  { id: "vendor_finalized", label: "Was the vendor finalized?", assignees: ["nishi", "iqbal", "krupali", "milind", "dipak"] },
  { id: "quotation_received", label: "Is quotation received?", assignees: ["nishi", "iqbal", "krupali", "milind", "dipak"] },
  { id: "decision_pending", label: "What decision is pending?", assignees: ["krupali", "namrata", "chirag", "nishi", "iqbal", "milind"] },
  { id: "blocking_work_owner_due", label: "What is blocking work? Who owns the next step and by when?", assignees: ["krupali", "namrata", "chirag", "nishi", "iqbal"] },
  { id: "planned_payment_collection", label: "Planned payment collection for tomorrow", assignees: ["dhwani"] },
  { id: "ceo_decision_required", label: "CEO decision if required for critical items if pending", assignees: ["krupali", "chirag", "namrata", "miti", "shruti"] },
  { id: "material_delivery_dates", label: "Expected delivery dates of material ordered", assignees: ["milind", "nishi", "dipak"] },
  { id: "client_meeting_decisions", label: "Today's client meeting and decisions taken", assignees: ["krupali", "namrata"] },
  { id: "critical_client_approvals", label: "Critical client approvals pending", assignees: ["krupali", "namrata"] },
];
const EMPLOYEE_EXECUTIVE_QUESTIONS_SETTINGS_ID = "employee-executive-questions-settings";
const employeeMetaCache = new Map();
const employeeReportCache = new Map();
let employeeReminderCronTask = null;
const EMPLOYEE_META_CACHE_MS = 5 * 60 * 1000;
const EMPLOYEE_REPORT_CACHE_MS = 60 * 1000;

function cachedEmployeeValue(cache, key, ttl, loader) {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const promise = Promise.resolve().then(loader).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + ttl, promise });
  return promise;
}

function hasFreshEmployeeCache(cache, key) {
  const entry = cache.get(key);
  return Boolean(entry && entry.expiresAt > Date.now());
}

function isGoogleSheetsQuotaError(error) {
  return Number(error?.code || error?.status || error?.response?.status) === 429 || /quota exceeded|resource_exhausted|too many requests/i.test(error?.message || error?.cause?.message || "");
}

function employeeSheetErrorMessage(error, fallback = "Could not read employee report sheet") {
  return isGoogleSheetsQuotaError(error)
    ? "Google Sheets is temporarily busy. Cached report data is being used; please retry in about a minute."
    : error?.message || fallback;
}

function canViewEmployeeDailyReports(req) {
  return Boolean(req.authUser?.isSuperAdmin || hasPrivilege(req, "view_employee_daily_reports"));
}

function normalizeEmployeeAssignee(value = "") {
  return projectText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function employeeQuestionMatchTokens(user = {}) {
  const names = [
    user.displayName,
    user.employeeName,
    user.name,
    user.username,
    user.usernameLower,
  ].map(projectText).filter(Boolean);
  return [...new Set(names.flatMap((name) => {
    const normalized = normalizeEmployeeAssignee(name);
    const first = normalizeEmployeeAssignee(name.split(/\s+/)[0]);
    return [normalized, first].filter(Boolean);
  }))];
}

function employeeExecutiveUserId(user = {}) {
  return String(user._id || user.id || user.userId || "");
}

function serializeEmployeeExecutiveQuestion(question = {}) {
  return {
    id: projectText(question.id) || new ObjectId().toString(),
    label: projectText(question.label),
    assignedUserIds: [...new Set((Array.isArray(question.assignedUserIds) ? question.assignedUserIds : []).map((id) => projectText(id)).filter(Boolean))],
    enabled: question.enabled !== false,
  };
}

async function employeeExecutiveQuestionUsers(db) {
  return db.collection("users")
    .find({ active: { $ne: false } })
    .project({ displayName: 1, username: 1, usernameLower: 1, department: 1, role: 1, isSuperAdmin: 1 })
    .sort({ displayName: 1, username: 1 })
    .limit(1000)
    .toArray();
}

function defaultEmployeeExecutiveQuestionsForUsers(users = []) {
  return DEFAULT_EMPLOYEE_EXECUTIVE_QUESTIONS.map((question) => {
    const assignees = new Set((question.assignees || []).map(normalizeEmployeeAssignee));
    const assignedUserIds = users
      .filter((user) => employeeQuestionMatchTokens(user).some((token) => assignees.has(token)))
      .map((user) => String(user._id));
    return serializeEmployeeExecutiveQuestion({ id: question.id, label: question.label, assignedUserIds, enabled: true });
  });
}

async function getEmployeeExecutiveQuestionSettings({ includeUsers = false } = {}) {
  const db = await connectAuthDb();
  const users = includeUsers ? await employeeExecutiveQuestionUsers(db) : [];
  let settings = await db.collection("platformSettings").findOne({ _id: EMPLOYEE_EXECUTIVE_QUESTIONS_SETTINGS_ID });
  if (!settings) {
    const defaultUsers = includeUsers ? users : await employeeExecutiveQuestionUsers(db);
    const questions = defaultEmployeeExecutiveQuestionsForUsers(defaultUsers);
    settings = { _id: EMPLOYEE_EXECUTIVE_QUESTIONS_SETTINGS_ID, questions, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("platformSettings").updateOne(
      { _id: EMPLOYEE_EXECUTIVE_QUESTIONS_SETTINGS_ID },
      { $set: { questions, createdAt: settings.createdAt, updatedAt: settings.updatedAt } },
      { upsert: true },
    );
  }
  const questions = (Array.isArray(settings.questions) ? settings.questions : []).map(serializeEmployeeExecutiveQuestion).filter((question) => question.label);
  return {
    questions,
    users: includeUsers ? users.map((user) => ({
      userId: String(user._id),
      employeeName: user.displayName || user.username || "Employee",
      department: user.department || "",
      role: user.role || "",
      isSuperAdmin: Boolean(user.isSuperAdmin),
    })) : [],
  };
}

async function employeeExecutiveQuestionsForUser(user = {}) {
  const userId = employeeExecutiveUserId(user);
  if (!userId) return [];
  const settings = await getEmployeeExecutiveQuestionSettings();
  return settings.questions
    .filter((question) => question.enabled !== false && question.assignedUserIds.includes(userId))
    .map(({ id, label }) => ({ id, label, required: true }));
}

function sanitizeEmployeeExecutiveAnswersDoc(doc = null) {
  if (!doc) return null;
  return {
    id: String(doc._id || `${doc.userId || "employee"}-${doc.reportDate || ""}`),
    userId: String(doc.userId || ""),
    employeeName: doc.employeeName || "",
    username: doc.username || "",
    department: doc.department || "",
    reportDate: doc.reportDate || "",
    submittedAt: doc.submittedAt || doc.updatedAt || null,
    answers: Array.isArray(doc.answers) ? doc.answers.map((answer) => ({
      id: answer.id || "",
      label: answer.label || "",
      answer: answer.answer || "",
    })).filter((answer) => answer.id && answer.label) : [],
  };
}

async function employeeExecutiveAnswersForUserDate(db, userId, reportDate) {
  const doc = await db.collection("employeeExecutiveReportAnswers").findOne({ userId: String(userId), reportDate: dmrDateKey(reportDate) || employeeReportToday() });
  return sanitizeEmployeeExecutiveAnswersDoc(doc);
}

function employeeReportDateRange() {
  const dates = [];
  const today = employeeReportToday();
  const year = today.slice(0, 4);
  let date = `${year}-01-01`;
  const end = `${year}-12-31`;
  while (date && date <= end) {
    dates.push(date);
    date = addDaysToDateKey(date, 1);
  }
  return dates;
}

function employeeReportToday(req = null) {
  const headerDate = dmrDateKey(req?.headers?.["x-employee-report-date"]);
  const envDate = dmrDateKey(process.env.EMPLOYEE_REPORT_TEST_DATE);
  return headerDate || envDate || istDateKey(new Date());
}

function employeeReportReminderRunId(dateKey) {
  return `employee-report-whatsapp-reminder:${dmrDateKey(dateKey) || employeeReportToday()}`;
}

function validEmployeeReminderTime(value) {
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "";
}

async function getEmployeeReminderSettings() {
  const db = await connectAuthDb();
  const settings = await db.collection("platformSettings").findOne({ _id: "employee-report-whatsapp-reminder-settings" });
  return {
    enabled: settings?.enabled !== false,
    time: validEmployeeReminderTime(settings?.time) || "18:50",
    timezone: "Asia/Kolkata",
    updatedAt: settings?.updatedAt || null,
    updatedBy: settings?.updatedBy || null,
  };
}

async function saveEmployeeReminderSettings({ time, enabled = true, actor = null }) {
  const reminderTime = validEmployeeReminderTime(time);
  if (!reminderTime) throw new Error("Choose a valid reminder time");
  const db = await connectAuthDb();
  const settings = {
    enabled: Boolean(enabled),
    time: reminderTime,
    timezone: "Asia/Kolkata",
    updatedAt: new Date(),
    updatedBy: actor ? { id: actor.id, name: actor.displayName || actor.username || "User" } : null,
  };
  await db.collection("platformSettings").updateOne(
    { _id: "employee-report-whatsapp-reminder-settings" },
    { $set: settings },
    { upsert: true },
  );
  configureEmployeeReminderCron(settings);
  return settings;
}

function employeeReminderCronExpression(time) {
  const reminderTime = validEmployeeReminderTime(time) || "18:50";
  const [hour, minute] = reminderTime.split(":");
  return `${Number(minute)} ${Number(hour)} * * 1-6`;
}

function configureEmployeeReminderCron(settings = {}) {
  if (employeeReminderCronTask) {
    employeeReminderCronTask.stop();
    if (typeof employeeReminderCronTask.destroy === "function") employeeReminderCronTask.destroy();
    employeeReminderCronTask = null;
  }
  const reminderTime = validEmployeeReminderTime(settings.time) || "18:50";
  if (settings.enabled === false) {
    console.log("Employee WhatsApp reminder cron disabled");
    return null;
  }
  const expression = employeeReminderCronExpression(reminderTime);
  employeeReminderCronTask = cron.schedule(expression, async () => {
    try {
      const result = await sendEmployeeDailyReportReminders({ source: "cron" });
      console.log(`Employee WhatsApp reminders ${result.status} for ${result.date}: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error("Employee WhatsApp reminder cron error:", error);
    }
  }, { timezone: "Asia/Kolkata" });
  console.log(`Employee WhatsApp reminder cron scheduled at ${reminderTime} IST (${expression})`);
  return employeeReminderCronTask;
}

async function refreshEmployeeReminderCron() {
  const settings = await getEmployeeReminderSettings();
  configureEmployeeReminderCron(settings);
  return settings;
}

function isEmployeeReminderSunday(dateKey) {
  const date = new Date(`${dmrDateKey(dateKey) || employeeReportToday()}T00:00:00+05:30`);
  return date.getDay() === 0;
}

function employeeReminderPhone(user = {}) {
  return normalizePhone(
    user.whatsappPhone ||
    user.whatsappNumber ||
    user.whatsapp ||
    user.mobileNumber ||
    user.mobile ||
    user.phoneNumber ||
    user.phone ||
    user.contactNumber ||
    user.contact ||
    ""
  );
}

function employeeReminderLink(dateKey) {
  const base = projectText(EMPLOYEE_REPORT_REMINDER_LINK) || "http://localhost:3000/employee-daily-report";
  try {
    const url = new URL(base);
    url.pathname = url.pathname || "/employee-daily-report";
    url.searchParams.set("employeeReportDate", dmrDateKey(dateKey) || employeeReportToday());
    return url.toString();
  } catch {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}employeeReportDate=${encodeURIComponent(dmrDateKey(dateKey) || employeeReportToday())}`;
  }
}

async function resolveEmployeeReminderTemplateName() {
  if (projectText(EMPLOYEE_REPORT_REMINDER_TEMPLATE)) return projectText(EMPLOYEE_REPORT_REMINDER_TEMPLATE);
  try {
    const templates = await whatsappService.templates();
    const approved = (templates || []).filter((template) => String(template.status || "").toUpperCase() === "APPROVED");
    const daily = approved.find((template) => /daily|work|report|reminder/i.test(`${template.name || ""} ${template.category || ""}`));
    return daily?.name || approved[0]?.name || "";
  } catch (error) {
    console.warn("Employee WhatsApp reminder template lookup skipped:", error.message);
    return "";
  }
}

function serializeReminderRun(run = null, dateKey = employeeReportToday()) {
  if (!run) {
    return {
      date: dmrDateKey(dateKey) || employeeReportToday(),
      status: isEmployeeReminderSunday(dateKey) ? "skipped" : "not_sent",
      reason: isEmployeeReminderSunday(dateKey) ? "Sunday" : "",
      sent: 0,
      failed: 0,
      skipped: 0,
      recipients: 0,
      results: [],
    };
  }
  return {
    date: run.date,
    status: run.status || "unknown",
    reason: run.reason || "",
    sent: Number(run.sent || 0),
    failed: Number(run.failed || 0),
    skipped: Number(run.skipped || 0),
    recipients: Number(run.recipients || 0),
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    source: run.source || "",
    templateName: run.templateName || "",
    results: Array.isArray(run.results) ? run.results.slice(0, 300) : [],
  };
}

function uniqueEmployeeValues(values = []) {
  const seen = new Set();
  return values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => projectText(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sanitizeEmployeeTaskItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    site: projectText(item?.site),
    category: projectText(item?.category),
    status: projectText(item?.status),
    involvement: uniqueEmployeeValues([
      ...(Array.isArray(item?.involvementValues) ? item.involvementValues : []),
      ...(Array.isArray(item?.involvement) ? item.involvement : [item?.involvement]),
    ]).join(", "),
    involvementValues: uniqueEmployeeValues([
      ...(Array.isArray(item?.involvementValues) ? item.involvementValues : []),
      ...(Array.isArray(item?.involvement) ? item.involvement : String(item?.involvement || "").split(",")),
    ]),
    description: projectText(item?.description),
    recurring: Boolean(item?.recurring),
    recurringId: projectText(item?.recurringId),
  })).filter((item) => item.category && item.description).slice(0, 30);
}

function employeeReportOptionUsage(reports = []) {
  const buckets = {
    sites: new Map(),
    categories: new Map(),
    involvements: new Map(),
  };
  const count = (bucket, value) => {
    const label = projectText(value);
    if (!label || label.toLowerCase() === "other") return;
    const key = label.toLowerCase();
    const current = bucket.get(key) || { value: label, count: 0 };
    current.count += 1;
    bucket.set(key, current);
  };

  reports.forEach((report) => {
    const taskItems = [
      ...sanitizeEmployeeTaskItems(report.taskItems),
      ...sanitizeEmployeeTaskItems(report.waitingTaskItems),
    ];
    taskItems.forEach((item) => {
      count(buckets.sites, item.site);
      count(buckets.categories, item.category);
      (item.involvementValues?.length ? item.involvementValues : [item.involvement]).forEach((value) => count(buckets.involvements, value));
    });
    if (!taskItems.length) {
      count(buckets.sites, report.site);
      count(buckets.categories, report.taskType);
      count(buckets.involvements, report.involvement);
    }
  });

  return Object.fromEntries(Object.entries(buckets).map(([key, bucket]) => [
    key,
    [...bucket.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, 3),
  ]));
}

function sanitizeEmployeeTaskCategories(categories = []) {
  if (!Array.isArray(categories)) return [];
  const seen = new Set();
  return categories.map((category) => projectText(category)).filter((category) => {
    const key = category.toLowerCase();
    if (!category || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

function sanitizeEmployeeTaskPreferences(input = {}) {
  return {
    useCustomOnly: Boolean(input.useCustomOnly),
    sites: sanitizeEmployeeTaskCategories(input.sites || []),
    categories: sanitizeEmployeeTaskCategories(input.categories || []),
  };
}

function taskItemsToText(items = []) {
  return items.map((item) => `${item.site ? `${item.site} · ` : ""}${item.category}${item.status ? ` [${item.status}]` : ""}${item.involvement ? ` (${item.involvement})` : ""}: ${item.description}`).join("\n");
}

function employeeRecurringKey(item = {}) {
  return projectText(item.recurringId) || [
    projectText(item.site).toLowerCase(),
    projectText(item.category).toLowerCase(),
    projectText(item.description).toLowerCase(),
  ].join("|");
}

function employeeRecurringTasksFromReports(reports = [], today) {
  const latest = new Map();
  reports
    .filter((report) => projectText(report.reportDate) && projectText(report.reportDate) < today)
    .sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)) || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
    .forEach((report) => {
      sanitizeEmployeeTaskItems(report.taskItems).forEach((item) => {
        const key = employeeRecurringKey(item);
        if (!key || latest.has(key)) return;
        latest.set(key, { ...item, recurringId: key, recurringFrom: report.reportDate });
      });
    });
  return [...latest.values()]
    .filter((item) => item.recurring)
    .map((item) => ({
      site: item.site,
      category: item.category,
      status: item.status,
      involvement: item.involvement,
      involvementValues: item.involvementValues || [],
      description: item.description,
      recurring: true,
      recurringId: item.recurringId,
      recurringFrom: item.recurringFrom,
    }))
    .slice(0, 20);
}

function incrementEmployeeReportBucket(map, key, patch = {}) {
  const label = projectText(key) || "Not set";
  const current = map.get(label) || { label, reports: 0, completedTasks: 0, waitingTasks: 0, employees: new Set() };
  current.reports += Number(patch.reports || 0);
  current.completedTasks += Number(patch.completedTasks || 0);
  current.waitingTasks += Number(patch.waitingTasks || 0);
  if (patch.employeeName) current.employees.add(projectText(patch.employeeName));
  map.set(label, current);
}

function serializeEmployeeReportBucket(bucket) {
  return {
    label: bucket.label,
    reports: bucket.reports,
    completedTasks: bucket.completedTasks,
    waitingTasks: bucket.waitingTasks,
    employees: bucket.employees.size,
  };
}

function sanitizeEmployeeReport(report) {
  if (!report) return null;
  const taskItems = sanitizeEmployeeTaskItems(report.taskItems);
  const waitingTaskItems = sanitizeEmployeeTaskItems(report.waitingTaskItems);
  return {
    id: String(report._id || report.id || report.reportId || `${report.userId || "employee"}-${report.reportDate || ""}-${report.submittedAt || ""}`),
    userId: String(report.userId),
    employeeName: report.employeeName || "",
    department: report.department || "",
    reportDate: report.reportDate || "",
    submittedAt: report.submittedAt,
    client: report.client || "",
    site: report.site || "",
    taskType: report.taskType || "",
    taskDescription: report.taskDescription || taskItemsToText(taskItems),
    taskItems,
    taskStatus: report.taskStatus || "",
    involvement: report.involvement || "",
    waitingTaskDescription: report.waitingTaskDescription || taskItemsToText(waitingTaskItems),
    waitingTaskItems,
    tomorrowPlanTick: Boolean(report.tomorrowPlanTick),
    note: report.note || "",
  };
}

function extractSpreadsheetId(value = "") {
  const id = extractDriveFileId(value);
  if (!id) return null;
  return id;
}

function employeeSheetUrl(spreadsheetId = "") {
  return spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : "";
}

async function getEmployeeSpreadsheetMeta(spreadsheetId, preferredTabName = "") {
  const key = `${spreadsheetId}:${preferredTabName || ""}`;
  return cachedEmployeeValue(employeeMetaCache, key, EMPLOYEE_META_CACHE_MS, async () => {
    const sheets = await getDmrSpreadsheet(spreadsheetId);
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties(sheetId,title,sheetType,hidden)",
    }, { retry: false });
    const tabs = (response.data.sheets || [])
      .map((sheet) => sheet.properties)
      .filter((sheet) => sheet?.sheetType === "GRID" && !sheet.hidden && sheet.title !== EMPLOYEE_REPORT_APP_TAB);
    if (!tabs.length) throw new Error("No visible sheet tab found");
    const preferred = tabs.find((tab) => preferredTabName && tab.title === preferredTabName);
    const tab = preferred || tabs[0];
    return { title: response.data.properties?.title || "Employee report sheet", tabName: tab.title || "Sheet1", tabId: tab.sheetId };
  });
}

function employeeDailyTabName(reportDate = "") {
  const date = projectText(reportDate);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : istDateKey(new Date());
}

function employeeSheetDisplayDate(reportDate = "") {
  const date = projectText(reportDate);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

async function ensureEmployeeDailySheetTab(sheets, spreadsheetId, templateMeta, reportDate) {
  const dailyTabName = employeeDailyTabName(reportDate);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,sheetType,hidden)",
  }, { retry: false });
  const visibleTabs = (metadata.data.sheets || [])
    .map((sheet) => sheet.properties)
    .filter((sheet) => sheet?.sheetType === "GRID" && !sheet.hidden);
  const existing = visibleTabs.find((sheet) => sheet.title === dailyTabName);
  if (existing) return { tabName: existing.title, tabId: existing.sheetId, created: false };
  const template = visibleTabs.find((sheet) => sheet.title === templateMeta.tabName) || visibleTabs.find((sheet) => sheet.title !== EMPLOYEE_REPORT_APP_TAB);
  if (!template || template.sheetId === null || template.sheetId === undefined) throw new Error("Could not find employee report template sheet");
  const duplicateResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: template.sheetId,
            newSheetName: dailyTabName,
          },
        },
      ],
    },
  });
  const createdSheetId = duplicateResponse.data?.replies?.[0]?.duplicateSheet?.properties?.sheetId ?? null;
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapeSheetName(dailyTabName)}!A4:Z5`,
  }).catch(() => {});
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapeSheetName(dailyTabName)}!A8:Z1000`,
  }).catch(() => {});
  return { tabName: dailyTabName, tabId: createdSheetId, created: true };
}

function parseEmployeeJsonItems(value) {
  try {
    const parsed = JSON.parse(projectText(value) || "[]");
    return sanitizeEmployeeTaskItems(parsed);
  } catch {
    return [];
  }
}

function employeeReportsFromAppRows({ rows = [], user }) {
  return rows.map((row, index) => {
    const reportId = projectText(row[0]) || `${user?._id || "employee"}-${projectText(row[4])}-${index}`;
    const taskItems = parseEmployeeJsonItems(row[13]);
    const waitingTaskItems = parseEmployeeJsonItems(row[14]);
    return {
      _id: reportId,
      reportId,
      userId: String(row[1] || user?._id || ""),
      employeeName: projectText(row[2]) || user?.displayName || user?.username || "Employee",
      department: projectText(row[3]) || user?.department || "",
      reportDate: projectText(row[4]),
      submittedAt: projectText(row[5]) ? new Date(projectText(row[5])) : null,
      client: projectText(row[6]),
      site: projectText(row[7]),
      taskType: projectText(row[8]),
      taskStatus: projectText(row[9]),
      involvement: projectText(row[10]),
      tomorrowPlanTick: ["true", "yes", "y", "1", "checked", "tick"].includes(projectText(row[11]).toLowerCase()),
      note: projectText(row[12]),
      taskItems,
      taskDescription: taskItemsToText(taskItems),
      waitingTaskItems,
      waitingTaskDescription: taskItemsToText(waitingTaskItems),
    };
  }).filter((report) => report.reportDate || report.submittedAt);
}

async function ensureEmployeeAppDataTab(sheets, spreadsheetId, create = true) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,hidden,sheetType)",
  }, { retry: false });
  const existing = (metadata.data.sheets || []).find((sheet) => sheet.properties?.title === EMPLOYEE_REPORT_APP_TAB);
  if (existing) return existing.properties;
  if (!create) return null;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: EMPLOYEE_REPORT_APP_TAB,
              hidden: true,
              gridProperties: { rowCount: 1000, columnCount: EMPLOYEE_REPORT_APP_HEADERS.length },
            },
          },
        },
      ],
    },
  });
  const created = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,hidden,sheetType)",
  });
  const tab = (created.data.sheets || []).find((sheet) => sheet.properties?.title === EMPLOYEE_REPORT_APP_TAB)?.properties;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A1:O1`,
    valueInputOption: "RAW",
    requestBody: { values: [EMPLOYEE_REPORT_APP_HEADERS] },
  });
  return tab;
}

function findEmployeeTemplateColumns(values = []) {
  const fallback = {
    serial: 1,
    reportDate: null,
    client: 2,
    site: 3,
    taskType: 4,
    taskDescription: 5,
    taskStatus: 8,
    involvement: 9,
    waitingSerial: 11,
    waitingDescription: 12,
    tomorrowTick: 13,
    note: 14,
  };
  const headers = [];
  values.slice(0, 20).forEach((row, rowIndex) => {
    (row || []).forEach((cell, columnIndex) => {
      const text = projectText(cell).toLowerCase();
      if (text) headers.push({ text, rowIndex, column: columnIndex + 1 });
    });
  });
  const clientHeader = headers.find((header) => /^client$/.test(header.text));
  const tableHeader = clientHeader || headers.find((header) => /^task\s*type$/.test(header.text) || /^task\s*status$/.test(header.text));
  const tableHeaders = tableHeader ? headers.filter((header) => header.rowIndex === tableHeader.rowIndex) : headers;
  const findTableHeader = (matcher) => tableHeaders.find((header) => matcher(header.text))?.column;
  const datedHeader = headers.find((header) => /^dated?:?$|^date:?$|report\s*date:?$/.test(header.text));
  const reportHeader = headers.find((header) => /^report:?$|^report\s*name:?$/.test(header.text));
  const waitingMarker = tableHeaders.find((header) => /tasks?\s+in\s+waiting|tomorrow/.test(header.text) && header.column > 6)?.column || 10;
  const afterWaiting = (matcher) => tableHeaders.find((header) => header.column >= waitingMarker && matcher(header.text))?.column;
  const waitingDescription = afterWaiting((text) => /task\s*description/.test(text)) || fallback.waitingDescription;
  const detectedTomorrowTick = afterWaiting((text) => /tick|tomorrow/.test(text));
  const detectedNote = afterWaiting((text) => /note/.test(text)) || fallback.note;
  const tomorrowTick = detectedTomorrowTick && detectedTomorrowTick !== waitingDescription
    ? detectedTomorrowTick
    : detectedNote > waitingDescription + 1
      ? detectedNote - 1
      : waitingDescription + 1;
  return {
    headerRow: tableHeader ? tableHeader.rowIndex + 1 : 6,
    serial: tableHeaders.find((header) => header.column < waitingMarker && (/^no\.?$/.test(header.text) || /^sr\.?\s*no\.?$/.test(header.text)))?.column || fallback.serial,
    reportDate: findTableHeader((text) => /^date$|^dated$|report\s*date/.test(text)) || fallback.reportDate,
    reportDateLabelCell: datedHeader ? { row: datedHeader.rowIndex + 1, column: datedHeader.column } : { row: 4, column: 6 },
    reportDateCell: datedHeader ? { row: datedHeader.rowIndex + 1, column: datedHeader.column + 1 } : { row: 4, column: 7 },
    reportNameLabelCell: reportHeader ? { row: reportHeader.rowIndex + 1, column: reportHeader.column } : { row: 4, column: 3 },
    reportNameCell: reportHeader ? { row: reportHeader.rowIndex + 1, column: reportHeader.column + 1 } : { row: 4, column: 4 },
    client: findTableHeader((text) => /^client$/.test(text)) || fallback.client,
    site: findTableHeader((text) => /^site$/.test(text)) || fallback.site,
    taskType: findTableHeader((text) => /^task\s*type$/.test(text)) || fallback.taskType,
    taskDescription: tableHeaders.find((header) => header.column < waitingMarker && /task\s*description/.test(header.text))?.column || fallback.taskDescription,
    taskStatus: findTableHeader((text) => /^task\s*status$/.test(text)) || fallback.taskStatus,
    involvement: findTableHeader((text) => /^involvement$/.test(text)) || fallback.involvement,
    waitingSerial: afterWaiting((text) => /sr\.?\s*no/.test(text)) || fallback.waitingSerial,
    waitingDescription,
    tomorrowTick,
    note: detectedNote,
  };
}

function findNextEmployeeTemplateRow(values = [], columns = findEmployeeTemplateColumns(values)) {
  const contentColumns = [
    columns.serial,
    columns.client,
    columns.site,
    columns.reportDate,
    columns.taskType,
    columns.taskDescription,
    columns.taskStatus,
    columns.involvement,
    columns.waitingDescription,
    columns.tomorrowTick,
    columns.note,
  ].filter(Boolean).map((column) => column - 1);
  const startIndex = Math.max(Number(columns.headerRow || 2), 2);
  for (let index = startIndex; index < Math.max(values.length, 300); index += 1) {
    const row = values[index] || [];
    const hasVisibleData = contentColumns.some((columnIndex) => projectText(row[columnIndex]));
    if (!hasVisibleData) return index + 1;
  }
  return Math.max(values.length + 1, 3);
}

async function cleanEmployeeDailyHeaderJunk(sheets, spreadsheetId, tabName, columns = {}) {
  const headerRow = Number(columns.headerRow || 0);
  const startRow = 5;
  const endRow = headerRow - 1;
  const ranges = [];
  if (headerRow && startRow <= endRow) ranges.push(`${escapeSheetName(tabName)}!A${startRow}:Z${endRow}`);
  if (columns.reportNameLabelCell?.row && columns.reportNameLabelCell?.column) {
    ranges.push(`${escapeSheetName(tabName)}!${columnName(columns.reportNameLabelCell.column)}${columns.reportNameLabelCell.row}:Z${columns.reportNameLabelCell.row}`);
  }
  if (!ranges.length) return;
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges },
  }).catch((error) => {
    console.warn("Employee daily header cleanup skipped:", error.message);
  });
}

async function normalizeEmployeeDailyTemplateRows(sheets, spreadsheetId, tab, columns = {}) {
  const headerRow = Number(columns.headerRow || 0);
  if (!tab?.tabId && tab?.tabId !== 0) return false;
  if (!headerRow || headerRow <= 5) return false;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: tab.tabId,
            dimension: "ROWS",
            startIndex: 4,
            endIndex: headerRow - 1,
          },
        },
      }],
    },
  }).catch((error) => {
    console.warn("Employee daily template row normalize skipped:", error.message);
  });
  return true;
}

async function formatEmployeeDailyTaskRows(sheets, spreadsheetId, sheetId, columns = {}, startRow, rowCount) {
  if ((sheetId !== 0 && !sheetId) || !startRow || !rowCount) return;
  const mergeRanges = [];
  const taskStart = Number(columns.taskDescription || 0);
  const taskEnd = Number(columns.taskStatus || 0);
  if (taskStart && taskEnd && taskEnd - taskStart > 1) {
    mergeRanges.push({ startColumnIndex: taskStart - 1, endColumnIndex: taskEnd - 1 });
  }
  const waitingStart = Number(columns.waitingDescription || 0);
  const waitingEndCandidates = [columns.tomorrowTick, columns.note].map(Number).filter(Boolean);
  const waitingEnd = waitingEndCandidates.length ? Math.min(...waitingEndCandidates) : 0;
  if (waitingStart && waitingEnd && waitingEnd - waitingStart > 1) {
    mergeRanges.push({ startColumnIndex: waitingStart - 1, endColumnIndex: waitingEnd - 1 });
  }
  const noteStart = Number(columns.note || 0);
  if (noteStart) {
    mergeRanges.push({ startColumnIndex: noteStart - 1, endColumnIndex: Math.max(noteStart, 18) });
  }
  if (!mergeRanges.length) return;
  const requests = [];
  for (let rowIndex = startRow - 1; rowIndex < startRow - 1 + rowCount; rowIndex += 1) {
    mergeRanges.forEach((range) => {
      const gridRange = { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, ...range };
      requests.push({ unmergeCells: { range: gridRange } });
      requests.push({ mergeCells: { range: gridRange, mergeType: "MERGE_ALL" } });
    });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }).catch((error) => {
    console.warn("Employee daily row formatting skipped:", error.message);
  });
}

async function copyEmployeeDailyRowFormat(sheets, spreadsheetId, sheetId, sourceRow, targetRow, rowCount) {
  if ((sheetId !== 0 && !sheetId) || !sourceRow || !targetRow || !rowCount) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        copyPaste: {
          source: {
            sheetId,
            startRowIndex: sourceRow - 1,
            endRowIndex: sourceRow,
            startColumnIndex: 0,
            endColumnIndex: 18,
          },
          destination: {
            sheetId,
            startRowIndex: targetRow - 1,
            endRowIndex: targetRow - 1 + rowCount,
            startColumnIndex: 0,
            endColumnIndex: 18,
          },
          pasteType: "PASTE_FORMAT",
          pasteOrientation: "NORMAL",
        },
      }],
    },
  }).catch((error) => {
    console.warn("Employee daily row format copy skipped:", error.message);
  });
}

async function repairEmployeeSerialFormulas(sheets, spreadsheetId, tabName, maxRows = 300) {
  const rowCount = Math.max(2, maxRows);
  const serialFormulas = [];
  const waitingSerialFormulas = [];
  for (let rowNumber = 2; rowNumber <= rowCount; rowNumber += 1) {
    serialFormulas.push([`=IF(COUNTA(B${rowNumber}:I${rowNumber})=0,"",IFERROR(MAX($A$1:A${rowNumber - 1}),0)+1)`]);
    waitingSerialFormulas.push([`=IF(COUNTA(L${rowNumber}:N${rowNumber})=0,"",IFERROR(MAX($K$1:K${rowNumber - 1}),0)+1)`]);
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${escapeSheetName(tabName)}!A2:A${rowCount}`, values: serialFormulas },
        { range: `${escapeSheetName(tabName)}!K2:K${rowCount}`, values: waitingSerialFormulas },
      ],
    },
  });
}

function employeeReportFromSheetRows({ rows = [], user, spreadsheetId }) {
  const reports = new Map();
  rows.forEach((row, rowIndex) => {
    const reportDate = projectText(row[12]);
    const submittedAt = projectText(row[13]);
    const reportId = projectText(row[16]) || `${spreadsheetId || user?._id || "sheet"}-${reportDate}-${submittedAt}-${rowIndex}`;
    if (!reportDate && !submittedAt) return;
    const existing = reports.get(reportId) || {
      _id: reportId,
      reportId,
      userId: String(row[17] || user?._id || ""),
      employeeName: projectText(row[14]) || user?.displayName || user?.username || "Employee",
      department: projectText(row[15]) || user?.department || "",
      reportDate,
      submittedAt: submittedAt ? new Date(submittedAt) : null,
      client: projectText(row[1]),
      site: projectText(row[2]),
      taskType: projectText(row[3]),
      taskStatus: projectText(row[5]),
      involvement: projectText(row[6]),
      taskItems: [],
      waitingTaskItems: [],
      tomorrowPlanTick: false,
      note: projectText(row[11]),
    };
    const taskCategory = projectText(row[3]);
    const taskDescription = projectText(row[4]);
    if (taskCategory && taskDescription && !existing.taskItems.some((item) => item.category === taskCategory && item.description === taskDescription)) {
      existing.taskItems.push({ site: projectText(row[2]), category: taskCategory, status: projectText(row[5]), involvement: projectText(row[6]), description: taskDescription });
    }
    const waitingDescription = projectText(row[9]);
    if (waitingDescription && !existing.waitingTaskItems.some((item) => item.description === waitingDescription)) {
      existing.waitingTaskItems.push({ site: projectText(row[2]), category: "Waiting / tomorrow plan", involvement: projectText(row[6]), description: waitingDescription });
    }
    existing.tomorrowPlanTick = existing.tomorrowPlanTick || ["true", "yes", "y", "1", "checked", "tick"].includes(projectText(row[10]).toLowerCase());
    if (!existing.note) existing.note = projectText(row[11]);
    reports.set(reportId, existing);
  });
  return [...reports.values()].map((report) => ({
    ...report,
    taskDescription: taskItemsToText(report.taskItems),
    waitingTaskDescription: taskItemsToText(report.waitingTaskItems),
  }));
}

async function readEmployeeSheetReportsForUserUncached(user) {
  const spreadsheetId = user?.employeeDailySpreadsheetId;
  if (!spreadsheetId) return [];
  const meta = await getEmployeeSpreadsheetMeta(spreadsheetId, user?.employeeDailySheetTab);
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const serialResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(meta.tabName)}!A1:N300`,
  }).catch(() => ({ data: { values: [] } }));
  const serialValues = serialResponse.data.values || [];
  const hasBrokenSerials = serialValues.some((row) => projectText(row[0]) === "#REF!" || projectText(row[10]) === "#REF!");
  if (hasBrokenSerials) {
    await repairEmployeeSerialFormulas(sheets, spreadsheetId, meta.tabName, 300).catch((error) => {
      console.warn("Employee serial formula repair skipped:", error.message);
    });
  }
  const appTab = await ensureEmployeeAppDataTab(sheets, spreadsheetId, false);
  if (appTab) {
    const appResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A2:O10000`,
    });
    const appReports = employeeReportsFromAppRows({ rows: appResponse.data.values || [], user });
    if (appReports.length) return appReports;
  }
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(meta.tabName)}!A1:R10000`,
  });
  return employeeReportFromSheetRows({ rows: response.data.values || [], user, spreadsheetId });
}

function employeeReportCacheKey(user) {
  return `${user?.employeeDailySpreadsheetId || ""}:${String(user?._id || user?.id || "")}`;
}

function invalidateEmployeeSheetCache(user) {
  employeeReportCache.delete(employeeReportCacheKey(user));
  const spreadsheetId = user?.employeeDailySpreadsheetId || "";
  for (const key of employeeMetaCache.keys()) {
    if (key.startsWith(`${spreadsheetId}:`)) employeeMetaCache.delete(key);
  }
}

async function readEmployeeSheetReportsForUser(user) {
  const key = employeeReportCacheKey(user);
  if (!user?.employeeDailySpreadsheetId) return [];
  return cachedEmployeeValue(employeeReportCache, key, EMPLOYEE_REPORT_CACHE_MS, () => readEmployeeSheetReportsForUserUncached(user));
}

async function readEmployeeReportsForUsers(users = []) {
  const reports = [];
  let freshReads = 0;
  const maxFreshReads = 10;
  for (let index = 0; index < users.length; index += 4) {
    const batch = users.slice(index, index + 4).filter((user) => {
      const cached = hasFreshEmployeeCache(employeeReportCache, employeeReportCacheKey(user));
      if (cached) return true;
      if (freshReads >= maxFreshReads) return false;
      freshReads += 1;
      return true;
    });
    const results = await Promise.allSettled(batch.map((user) => readEmployeeSheetReportsForUser(user)));
    results.forEach((result, resultIndex) => {
      if (result.status === "fulfilled") reports.push(...result.value);
      else console.warn("Employee sheet read skipped:", batch[resultIndex]?.username || batch[resultIndex]?._id, employeeSheetErrorMessage(result.reason));
    });
  }
  return reports;
}

function employeeReportCacheDocument(report) {
  const sanitized = sanitizeEmployeeReport(report);
  return {
    ...sanitized,
    reportId: projectText(report?.reportId || sanitized?.id),
    userId: String(report?.userId || sanitized?.userId || ""),
    reportDate: projectText(report?.reportDate || sanitized?.reportDate),
    submittedAt: report?.submittedAt ? new Date(report.submittedAt) : null,
    cachedAt: new Date(),
  };
}

async function cacheEmployeeReports(db, reports = []) {
  const valid = reports.map(employeeReportCacheDocument).filter((report) => report.userId && report.reportDate);
  if (!valid.length) return;
  await db.collection("employeeDailyReports").bulkWrite(valid.map((report) => ({
    updateOne: {
      filter: { userId: report.userId, reportDate: report.reportDate },
      update: { $set: report },
      upsert: true,
    },
  })), { ordered: false });
}

async function getCachedEmployeeReportsForUsers(db, users = []) {
  const userIds = users.map((user) => String(user?._id || user?.id || "")).filter(Boolean);
  if (!userIds.length) return [];
  const pendingHydration = users.filter((user) => user?.employeeDailySpreadsheetId && !user?.employeeReportCacheHydratedAt).slice(0, 10);
  for (let index = 0; index < pendingHydration.length; index += 3) {
    const batch = pendingHydration.slice(index, index + 3);
    const results = await Promise.allSettled(batch.map((user) => readEmployeeSheetReportsForUser(user)));
    for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
      const result = results[resultIndex];
      const user = batch[resultIndex];
      if (result.status !== "fulfilled") {
        console.warn("Employee cache hydration skipped:", user?.username || user?._id, employeeSheetErrorMessage(result.reason));
        continue;
      }
      await cacheEmployeeReports(db, result.value);
      await db.collection("users").updateOne({ _id: user._id }, { $set: { employeeReportCacheHydratedAt: new Date() } });
    }
  }
  return db.collection("employeeDailyReports")
    .find({ userId: { $in: userIds } })
    .sort({ reportDate: -1, submittedAt: -1 })
    .limit(20000)
    .toArray();
}

async function sendEmployeeDailyReportReminders({ dateKey = employeeReportToday(), source = "manual", force = false, includeSubmitted = false } = {}) {
  const db = await connectAuthDb();
  const date = dmrDateKey(dateKey) || employeeReportToday();
  const runId = employeeReportReminderRunId(date);
  const existingRun = await db.collection("platformSettings").findOne({ _id: runId });
  if (!force && existingRun?.status === "completed" && existingRun?.source === source) return serializeReminderRun(existingRun, date);
  if (isEmployeeReminderSunday(date)) {
    const skippedRun = {
      _id: runId,
      date,
      status: "skipped",
      reason: "Sunday",
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      results: [],
      source,
      finishedAt: new Date(),
    };
    await db.collection("platformSettings").updateOne({ _id: runId }, { $set: skippedRun }, { upsert: true });
    return serializeReminderRun(skippedRun, date);
  }

  const templateName = await resolveEmployeeReminderTemplateName();
  if (!templateName) throw new Error("No approved WhatsApp reminder template found. Set EMPLOYEE_REPORT_REMINDER_TEMPLATE in backend/.env.");

  const linkedUsers = await db.collection("users").find({
    employeeDailySpreadsheetId: { $exists: true, $ne: "" },
    isActive: { $ne: false },
  }).limit(500).toArray();
  const reports = await getCachedEmployeeReportsForUsers(db, linkedUsers);
  const submitted = new Set(reports.filter((report) => report.reportDate === date).map((report) => String(report.userId)));
  const startedAt = new Date();
  const results = [];
  await db.collection("platformSettings").updateOne(
    { _id: runId },
    { $set: { _id: runId, date, status: "running", source, templateName, recipients: linkedUsers.length, startedAt, updatedAt: startedAt } },
    { upsert: true },
  );

  for (const user of linkedUsers) {
    const userId = String(user._id || user.id || "");
    const employeeName = user.displayName || user.username || "Employee";
    const phone = employeeReminderPhone(user);
    if (!includeSubmitted && submitted.has(userId)) {
      results.push({ userId, employeeName, status: "skipped", reason: "Already submitted" });
      continue;
    }
    if (!phone) {
      results.push({ userId, employeeName, status: "failed", reason: "WhatsApp phone not set" });
      continue;
    }
    try {
      const message = await whatsappService.sendMessage({
        to: phone,
        templateName,
        language: EMPLOYEE_REPORT_REMINDER_TEMPLATE_LANGUAGE,
        templateParams: [employeeName, dmrPdfDateLabel(date), employeeReminderLink(date)],
      }, { id: "system", displayName: "Employee report reminder" });
      results.push({ userId, employeeName, phone, status: "sent", messageId: message.wamid || message.id || null });
    } catch (error) {
      results.push({ userId, employeeName, phone, status: "failed", reason: error.message });
    }
  }

  const finishedAt = new Date();
  const run = {
    _id: runId,
    date,
    status: "completed",
    source,
    templateName,
    language: EMPLOYEE_REPORT_REMINDER_TEMPLATE_LANGUAGE,
    link: employeeReminderLink(date),
    recipients: linkedUsers.length,
    sent: results.filter((item) => item.status === "sent").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
    startedAt,
    finishedAt,
    updatedAt: finishedAt,
  };
  await db.collection("platformSettings").updateOne({ _id: runId }, { $set: run }, { upsert: true });
  return serializeReminderRun(run, date);
}

function filterEmployeeReports(reports = [], { search = "", dateFrom = "", dateTo = "", userIds = [] } = {}) {
  const needle = projectText(search).toLowerCase();
  const selected = new Set((userIds || []).map(String).filter(Boolean));
  return reports.filter((report) => {
    if (selected.size && !selected.has(String(report.userId))) return false;
    if (dateFrom && report.reportDate < dateFrom) return false;
    if (dateTo && report.reportDate > dateTo) return false;
    if (!needle) return true;
    return [
      report.employeeName,
      report.department,
      report.client,
      report.site,
      report.taskType,
      report.taskStatus,
      report.involvement,
      ...sanitizeEmployeeTaskItems(report.taskItems).flatMap((item) => [item.category, item.description]),
      ...sanitizeEmployeeTaskItems(report.waitingTaskItems).flatMap((item) => [item.category, item.description]),
    ].some((value) => projectText(value).toLowerCase().includes(needle));
  });
}

function dedupeEmployeeReportsByDate(reports = []) {
  const grouped = new Map();
  reports.forEach((report) => {
    const key = `${String(report.userId || "")}|${report.reportDate || ""}`;
    const current = grouped.get(key);
    if (!current || new Date(report.submittedAt || 0) >= new Date(current.submittedAt || 0)) {
      grouped.set(key, report);
    }
  });
  return [...grouped.values()];
}

async function allowEmployeeTaskTypeValuesOnRows(sheets, spreadsheetId, sheetId, columns, startRow, rowCount, taskItems = []) {
  if (sheetId === null || sheetId === undefined || !columns.taskType || !rowCount) return;
  const taskTypes = new Set(EMPLOYEE_REPORT_OPTIONS.taskTypes.filter((item) => item !== "Other"));
  sanitizeEmployeeTaskItems(taskItems).forEach((item) => {
    const category = projectText(item.category);
    if (category) taskTypes.add(category);
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: startRow - 1,
              endRowIndex: startRow - 1 + rowCount,
              startColumnIndex: columns.taskType - 1,
              endColumnIndex: columns.taskType,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [...taskTypes].map((value) => ({ userEnteredValue: value })),
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
      ],
    },
  }).catch((error) => {
    console.warn("Employee task type validation update skipped:", error.message);
  });
}

async function appendEmployeeReportToSheet({ user, report, taskItems, waitingTaskItems }) {
  const spreadsheetId = user?.employeeDailySpreadsheetId;
  if (!spreadsheetId) throw new Error("Link your Google Sheet before submitting today's report");
  const meta = await getEmployeeSpreadsheetMeta(spreadsheetId, user?.employeeDailySheetTab);
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  await ensureEmployeeAppDataTab(sheets, spreadsheetId, true);
  const appExisting = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A2:O10000`,
  });
  const alreadySubmittedFromApp = employeeReportsFromAppRows({ rows: appExisting.data.values || [], user }).some((item) => item.reportDate === report.reportDate);
  if (alreadySubmittedFromApp) {
    const duplicate = new Error("Today's report is already submitted");
    duplicate.code = "EMPLOYEE_REPORT_EXISTS";
    throw duplicate;
  }
  const dailyTab = await ensureEmployeeDailySheetTab(sheets, spreadsheetId, meta, report.reportDate);
  let existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(dailyTab.tabName)}!A1:R10000`,
  });
  let values = existing.data.values || [];
  let columns = findEmployeeTemplateColumns(values);
  if (await normalizeEmployeeDailyTemplateRows(sheets, spreadsheetId, dailyTab, columns)) {
    existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(dailyTab.tabName)}!A1:R10000`,
    });
    values = existing.data.values || [];
    columns = findEmployeeTemplateColumns(values);
  }
  await cleanEmployeeDailyHeaderJunk(sheets, spreadsheetId, dailyTab.tabName, columns);
  const startRow = findNextEmployeeTemplateRow(values, columns);
  const rowCount = Math.max(taskItems.length, waitingTaskItems.length, 1);
  await formatEmployeeDailyTaskRows(sheets, spreadsheetId, dailyTab.tabId, columns, startRow, rowCount);
  await allowEmployeeTaskTypeValuesOnRows(sheets, spreadsheetId, dailyTab.tabId, columns, startRow, rowCount, taskItems);
  const data = [];
  Array.from({ length: rowCount }, (_, index) => {
    const task = taskItems[index] || {};
    const waiting = waitingTaskItems[index] || {};
    const rowNumber = startRow + index;
    [
      ...(index === 0 && columns.reportNameLabelCell ? [[columns.reportNameLabelCell, "Report:"]] : []),
      ...(index === 0 && columns.reportNameCell ? [[columns.reportNameCell, "Personnel Daily Work Progress Report"]] : []),
      ...(index === 0 && columns.reportDateLabelCell ? [[columns.reportDateLabelCell, "Dated:"]] : []),
      ...(index === 0 && columns.reportDateCell ? [[columns.reportDateCell, employeeSheetDisplayDate(report.reportDate)]] : []),
      [columns.serial, task.category || waiting.description ? index + 1 : ""],
      [columns.client, "NA"],
      [columns.site, task.site || waiting.site || ""],
      [columns.reportDate, report.reportDate],
      [columns.taskType, task.category || report.taskType],
      [columns.taskDescription, task.description || ""],
      [columns.taskStatus, task.status || report.taskStatus],
      [columns.involvement, task.involvement || waiting.involvement || report.involvement],
      [columns.waitingSerial, waiting.description ? index + 1 : ""],
      [columns.waitingDescription, waiting.description || ""],
      [columns.tomorrowTick, report.tomorrowPlanTick ? "TRUE" : ""],
      [columns.note, index === 0 ? report.note : ""],
    ].forEach(([column, value]) => {
      if (!column) return;
      if (typeof column === "object") {
        data.push({
          range: `${escapeSheetName(dailyTab.tabName)}!${columnName(column.column)}${column.row}`,
          values: [[value]],
        });
        return;
      }
      data.push({
        range: `${escapeSheetName(dailyTab.tabName)}!${columnName(column)}${rowNumber}`,
        values: [[value]],
      });
    });
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A:O`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        report.reportId,
        report.userId,
        report.employeeName,
        report.department,
        report.reportDate,
        report.submittedAt.toISOString(),
        report.client,
        report.site,
        report.taskType,
        report.taskStatus,
        report.involvement,
        report.tomorrowPlanTick ? "TRUE" : "FALSE",
        report.note,
        JSON.stringify(taskItems),
        JSON.stringify(waitingTaskItems),
      ]],
    },
  });
  invalidateEmployeeSheetCache(user);
}

async function updateEmployeeReportInSheet({ user, report, taskItems, waitingTaskItems }) {
  const spreadsheetId = user?.employeeDailySpreadsheetId;
  if (!spreadsheetId) throw new Error("Link your Google Sheet before updating today's report");
  const meta = await getEmployeeSpreadsheetMeta(spreadsheetId, user?.employeeDailySheetTab);
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  await ensureEmployeeAppDataTab(sheets, spreadsheetId, true);
  const appResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A2:O10000`,
  });
  const appRows = appResponse.data.values || [];
  const appRowIndex = appRows.findIndex((row) => String(row[1] || "") === String(report.userId) && projectText(row[4]) === report.reportDate);
  if (appRowIndex < 0) {
    const missing = new Error("Today's submitted report could not be found");
    missing.code = "EMPLOYEE_REPORT_NOT_FOUND";
    throw missing;
  }
  const existingReportId = projectText(appRows[appRowIndex][0]) || report.reportId;
  const previousTaskItems = parseEmployeeJsonItems(appRows[appRowIndex][13]);
  const previousWaitingTaskItems = parseEmployeeJsonItems(appRows[appRowIndex][14]);
  const appValues = [[
    existingReportId,
    report.userId,
    report.employeeName,
    report.department,
    report.reportDate,
    report.submittedAt.toISOString(),
    "",
    report.site,
    report.taskType,
    report.taskStatus,
    report.involvement,
    report.tomorrowPlanTick ? "TRUE" : "FALSE",
    report.note,
    JSON.stringify(taskItems),
    JSON.stringify(waitingTaskItems),
  ]];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A${appRowIndex + 2}:O${appRowIndex + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: appValues },
  });

  const dailyTab = await ensureEmployeeDailySheetTab(sheets, spreadsheetId, meta, report.reportDate);
  let existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapeSheetName(dailyTab.tabName)}!A1:R10000` });
  let values = existing.data.values || [];
  let columns = findEmployeeTemplateColumns(values);
  if (await normalizeEmployeeDailyTemplateRows(sheets, spreadsheetId, dailyTab, columns)) {
    existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapeSheetName(dailyTab.tabName)}!A1:R10000` });
    values = existing.data.values || [];
    columns = findEmployeeTemplateColumns(values);
  }
  await cleanEmployeeDailyHeaderJunk(sheets, spreadsheetId, dailyTab.tabName, columns);
  const previousRowCount = Math.max(previousTaskItems.length, previousWaitingTaskItems.length, 1);
  const previousRowMatches = values.map((row, index) => ({ row, rowNumber: index + 1 })).filter(({ row, rowNumber }) => {
    if (rowNumber <= Number(columns.headerRow || 6)) return false;
    const site = projectText(row[(columns.site || 0) - 1]);
    const category = projectText(row[(columns.taskType || 0) - 1]);
    const description = projectText(row[(columns.taskDescription || 0) - 1]);
    const status = projectText(row[(columns.taskStatus || 0) - 1]);
    const waitingDescription = projectText(row[(columns.waitingDescription || 0) - 1]);
    return previousTaskItems.some((item) => (
      projectText(item.description) === description &&
      (!projectText(item.category) || projectText(item.category) === category) &&
      (!projectText(item.site) || projectText(item.site) === site) &&
      (!projectText(item.status) || projectText(item.status) === status)
    )) || previousWaitingTaskItems.some((item) => (
      projectText(item.description) === waitingDescription &&
      (!projectText(item.site) || projectText(item.site) === site)
    ));
  });
  const matchedStartRow = previousRowMatches[0]?.rowNumber || null;
  const startRow = matchedStartRow || findNextEmployeeTemplateRow(values, columns);
  const rowCount = Math.max(taskItems.length, waitingTaskItems.length, 1);
  if (matchedStartRow && rowCount > previousRowCount) {
    const rowsToInsert = rowCount - previousRowCount;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: dailyTab.tabId,
              dimension: "ROWS",
              startIndex: startRow - 1 + previousRowCount,
              endIndex: startRow - 1 + previousRowCount + rowsToInsert,
            },
            inheritFromBefore: true,
          },
        }],
      },
    }).catch((error) => {
      console.warn("Employee report row insert skipped:", error.message);
    });
    await copyEmployeeDailyRowFormat(sheets, spreadsheetId, dailyTab.tabId, Math.max(startRow, startRow + previousRowCount - 1), startRow + previousRowCount, rowsToInsert);
  }
  const clearThrough = Math.max(startRow + rowCount - 1, startRow + previousRowCount - 1, previousRowMatches.at(-1)?.rowNumber || startRow);
  const clearRanges = [columns.serial, columns.client, columns.site, columns.reportDate, columns.taskType, columns.taskDescription, columns.taskStatus, columns.involvement, columns.waitingSerial, columns.waitingDescription, columns.tomorrowTick, columns.note]
    .filter(Boolean)
    .map((column) => `${escapeSheetName(dailyTab.tabName)}!${columnName(column)}${startRow}:${columnName(column)}${clearThrough}`);
  if (columns.taskDescription && columns.taskStatus && columns.taskStatus - columns.taskDescription > 1) {
    clearRanges.push(`${escapeSheetName(dailyTab.tabName)}!${columnName(columns.taskDescription)}${startRow}:${columnName(columns.taskStatus - 1)}${clearThrough}`);
  }
  const waitingClearEnd = [columns.tomorrowTick, columns.note].map(Number).filter(Boolean).sort((a, b) => a - b)[0];
  if (columns.waitingDescription && waitingClearEnd && waitingClearEnd - columns.waitingDescription > 1) {
    clearRanges.push(`${escapeSheetName(dailyTab.tabName)}!${columnName(columns.waitingDescription)}${startRow}:${columnName(waitingClearEnd - 1)}${clearThrough}`);
  }
  if (columns.note) {
    clearRanges.push(`${escapeSheetName(dailyTab.tabName)}!${columnName(columns.note)}${startRow}:R${clearThrough}`);
  }
  if (clearRanges.length) await sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: clearRanges } });
  await formatEmployeeDailyTaskRows(sheets, spreadsheetId, dailyTab.tabId, columns, startRow, rowCount);
  await allowEmployeeTaskTypeValuesOnRows(sheets, spreadsheetId, dailyTab.tabId, columns, startRow, rowCount, taskItems);
  const data = [];
  Array.from({ length: rowCount }, (_, index) => {
    const task = taskItems[index] || {};
    const waiting = waitingTaskItems[index] || {};
    const rowNumber = startRow + index;
    [
      ...(index === 0 && columns.reportNameLabelCell ? [[columns.reportNameLabelCell, "Report:"]] : []),
      ...(index === 0 && columns.reportNameCell ? [[columns.reportNameCell, "Personnel Daily Work Progress Report"]] : []),
      ...(index === 0 && columns.reportDateLabelCell ? [[columns.reportDateLabelCell, "Dated:"]] : []),
      ...(index === 0 && columns.reportDateCell ? [[columns.reportDateCell, employeeSheetDisplayDate(report.reportDate)]] : []),
      [columns.serial, task.category || waiting.description ? index + 1 : ""],
      [columns.client, "NA"],
      [columns.site, task.site || waiting.site || ""],
      [columns.reportDate, report.reportDate],
      [columns.taskType, task.category || report.taskType],
      [columns.taskDescription, task.description || ""],
      [columns.taskStatus, task.status || report.taskStatus],
      [columns.involvement, task.involvement || waiting.involvement || report.involvement],
      [columns.waitingSerial, waiting.description ? index + 1 : ""],
      [columns.waitingDescription, waiting.description || ""],
      [columns.tomorrowTick, report.tomorrowPlanTick ? "TRUE" : ""],
      [columns.note, index === 0 ? report.note : ""],
    ].forEach(([column, value]) => {
      if (!column) return;
      const range = typeof column === "object"
        ? `${escapeSheetName(dailyTab.tabName)}!${columnName(column.column)}${column.row}`
        : `${escapeSheetName(dailyTab.tabName)}!${columnName(column)}${rowNumber}`;
      data.push({ range, values: [[value]] });
    });
  });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data } });
  invalidateEmployeeSheetCache(user);
  return existingReportId;
}

async function deleteEmployeeReportFromSheet({ user, reportDate, fallbackReport = null }) {
  const spreadsheetId = user?.employeeDailySpreadsheetId;
  if (!spreadsheetId) throw new Error("Linked Google Sheet not found for this employee");
  const date = employeeDailyTabName(reportDate);
  const meta = await getEmployeeSpreadsheetMeta(spreadsheetId, user?.employeeDailySheetTab);
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const appTab = await ensureEmployeeAppDataTab(sheets, spreadsheetId, false);
  let appRows = [];
  let appRowIndex = -1;
  let appRow = [];
  if (appTab) {
    const appResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A2:O10000`,
    });
    appRows = appResponse.data.values || [];
    appRowIndex = appRows.findIndex((row) => String(row[1] || "") === String(user._id || user.id || "") && projectText(row[4]) === date);
    appRow = appRowIndex >= 0 ? (appRows[appRowIndex] || []) : [];
  }
  const previousTaskItems = parseEmployeeJsonItems(appRow[13]).length
    ? parseEmployeeJsonItems(appRow[13])
    : sanitizeEmployeeTaskItems(fallbackReport?.taskItems);
  const previousWaitingTaskItems = parseEmployeeJsonItems(appRow[14]).length
    ? parseEmployeeJsonItems(appRow[14])
    : sanitizeEmployeeTaskItems(fallbackReport?.waitingTaskItems);

  if (appTab && appRowIndex >= 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: appTab.sheetId,
              dimension: "ROWS",
              startIndex: appRowIndex + 1,
              endIndex: appRowIndex + 2,
            },
          },
        }],
      },
    });
  }

  const dailyTab = await ensureEmployeeDailySheetTab(sheets, spreadsheetId, meta, date);
  let existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapeSheetName(dailyTab.tabName)}!A1:R10000` });
  let values = existing.data.values || [];
  let columns = findEmployeeTemplateColumns(values);
  if (await normalizeEmployeeDailyTemplateRows(sheets, spreadsheetId, dailyTab, columns)) {
    existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapeSheetName(dailyTab.tabName)}!A1:R10000` });
    values = existing.data.values || [];
    columns = findEmployeeTemplateColumns(values);
  }
  const previousRowMatches = values.map((row, index) => ({ row, rowNumber: index + 1 })).filter(({ row, rowNumber }) => {
    if (rowNumber <= Number(columns.headerRow || 6)) return false;
    const site = projectText(row[(columns.site || 0) - 1]);
    const category = projectText(row[(columns.taskType || 0) - 1]);
    const description = projectText(row[(columns.taskDescription || 0) - 1]);
    const status = projectText(row[(columns.taskStatus || 0) - 1]);
    const waitingDescription = projectText(row[(columns.waitingDescription || 0) - 1]);
    const rowDate = projectText(row[(columns.reportDate || 0) - 1]);
    const fallbackSite = projectText(fallbackReport?.site);
    const fallbackCategory = projectText(fallbackReport?.taskType);
    return previousTaskItems.some((item) => (
      projectText(item.description) === description &&
      (!projectText(item.category) || projectText(item.category) === category) &&
      (!projectText(item.site) || projectText(item.site) === site) &&
      (!projectText(item.status) || projectText(item.status) === status)
    )) || previousWaitingTaskItems.some((item) => (
      projectText(item.description) === waitingDescription &&
      (!projectText(item.site) || projectText(item.site) === site)
    )) || (rowDate === date && projectText(appRow[7]) && projectText(appRow[7]) === site && projectText(appRow[8]) && projectText(appRow[8]) === category)
      || (rowDate === date && fallbackSite && fallbackSite === site && (!fallbackCategory || fallbackCategory === category));
  });
  if (previousRowMatches.length) {
    const startRow = previousRowMatches[0].rowNumber;
    const clearThrough = previousRowMatches.at(-1).rowNumber;
    const clearRanges = [columns.serial, columns.client, columns.site, columns.reportDate, columns.taskType, columns.taskDescription, columns.taskStatus, columns.involvement, columns.waitingSerial, columns.waitingDescription, columns.tomorrowTick, columns.note]
      .filter(Boolean)
      .map((column) => `${escapeSheetName(dailyTab.tabName)}!${columnName(column)}${startRow}:${columnName(column)}${clearThrough}`);
    if (columns.note) clearRanges.push(`${escapeSheetName(dailyTab.tabName)}!${columnName(columns.note)}${startRow}:R${clearThrough}`);
    if (clearRanges.length) await sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: clearRanges } });
  }
  invalidateEmployeeSheetCache(user);
  return { deletedAppRow: appRowIndex >= 0 ? appRowIndex + 2 : null, appDataFound: appRowIndex >= 0, clearedRows: previousRowMatches.length };
}

async function buildEmployeeReportDashboard(req, query = {}) {
  const db = await connectAuthDb();
  const isAdmin = canViewEmployeeDailyReports(req);
  const userId = String(req.authUser.id);
  const search = projectText(query.search).toLowerCase();
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(query.dateFrom || "")) ? String(query.dateFrom) : "";
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(String(query.dateTo || "")) ? String(query.dateTo) : "";
  const linkedUsers = isAdmin
    ? await db.collection("users").find({ employeeDailySpreadsheetId: { $exists: true, $ne: "" } }).limit(500).toArray()
    : [req.user];
  const allCachedReports = await getCachedEmployeeReportsForUsers(db, linkedUsers);
  const reports = dedupeEmployeeReportsByDate(filterEmployeeReports(allCachedReports, { search, dateFrom, dateTo, userIds: isAdmin ? [] : [userId] }))
    .sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)) || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
    .slice(0, 500);
  const today = employeeReportToday(req);
  const ownReports = allCachedReports.filter((report) => String(report.userId) === userId);
  const optionUsage = employeeReportOptionUsage(ownReports);
  const todayReport = ownReports.find((report) => String(report.userId) === userId && report.reportDate === today) || null;
  const todaySubmitted = Boolean(todayReport);
  const executiveQuestions = await employeeExecutiveQuestionsForUser(req.user || req.authUser || {});
  const executiveAnswers = executiveQuestions.length ? await employeeExecutiveAnswersForUserDate(db, userId, today) : null;
  const carriedForwardTasks = todayReport ? [] : employeeRecurringTasksFromReports(ownReports, today);
  const siteOptions = [...new Set([...EMPLOYEE_REPORT_OPTIONS.sites, ...allCachedReports.flatMap((report) => [
    report.site,
    ...sanitizeEmployeeTaskItems(report.taskItems).map((item) => item.site),
    ...sanitizeEmployeeTaskItems(report.waitingTaskItems).map((item) => item.site),
  ])].map(projectText).filter(Boolean))];
  const dates = employeeReportDateRange();
  const heatmapReports = filterEmployeeReports(isAdmin ? allCachedReports : ownReports, { dateFrom: dates[0], dateTo: dates[dates.length - 1], userIds: isAdmin ? [] : [userId] });
  const users = [{ userId, employeeName: req.authUser.displayName || req.authUser.username || "You" }];
  const heatmap = users.map((user) => {
    const submitted = new Set(heatmapReports.filter((report) => String(report.userId) === user.userId).map((report) => report.reportDate));
    return {
      ...user,
      days: dates.map((date) => ({ date, submitted: submitted.has(date) })),
    };
  });
  const reportUsers = isAdmin
    ? linkedUsers.map((user) => ({ _id: String(user._id), employeeName: user.displayName || user.username || "Employee", department: user.department || "" }))
    : [];
  const todaySubmissionStatus = isAdmin
    ? linkedUsers.map((user) => {
      const linkedUserId = String(user._id);
      const submitted = allCachedReports.find((report) => String(report.userId) === linkedUserId && report.reportDate === today);
      return {
        userId: linkedUserId,
        employeeName: user.displayName || user.username || "Employee",
        department: user.department || "",
        submitted: Boolean(submitted),
        submittedAt: submitted?.submittedAt || null,
        taskType: submitted?.taskType || "",
        taskStatus: submitted?.taskStatus || "",
      };
    })
    : [];
  const reminderSettings = isAdmin ? await getEmployeeReminderSettings() : null;
  return {
    isAdmin,
    today,
    todaySubmitted,
    todayReport: sanitizeEmployeeReport(todayReport),
    executiveQuestions,
    executiveAnswers,
    executiveAnswersSubmitted: Boolean(executiveAnswers?.answers?.length),
    carriedForwardTasks,
    carriedForwardFrom: carriedForwardTasks[0]?.recurringFrom || "",
    currentUserId: userId,
    profile: {
      department: req.user.department || "",
      taskCategories: sanitizeEmployeeTaskCategories(req.user.employeeTaskCategories || []),
      taskPreferences: sanitizeEmployeeTaskPreferences(req.user.employeeTaskPreferences || {
        useCustomOnly: false,
        sites: req.user.employeeTaskSites || [],
        categories: req.user.employeeTaskCategories || [],
      }),
      sheetLinked: Boolean(req.user.employeeDailySpreadsheetId),
      sheetId: req.user.employeeDailySpreadsheetId || "",
      sheetUrl: employeeSheetUrl(req.user.employeeDailySpreadsheetId || ""),
    },
    options: { ...EMPLOYEE_REPORT_OPTIONS, sites: siteOptions },
    optionUsage,
    reportUsers: reportUsers.map((user) => ({ userId: String(user._id), employeeName: user.employeeName || "Employee", department: user.department || "" })),
    todaySubmissionStatus,
    reminderSettings,
    reports: reports.map(sanitizeEmployeeReport),
    heatmap,
  };
}

app.get("/employee-daily-report", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    res.json(await buildEmployeeReportDashboard(req, req.query || {}));
  } catch (error) {
    console.error("Employee daily report load error:", employeeSheetErrorMessage(error));
    res.status(isGoogleSheetsQuotaError(error) ? 429 : 500).json({ error: employeeSheetErrorMessage(error, "Could not load employee daily reports") });
  }
});

app.post("/employee-daily-report/refresh-today", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const spreadsheetId = req.user?.employeeDailySpreadsheetId;
    if (!spreadsheetId) return res.status(400).json({ error: "Link your Google Sheet before refreshing" });
    const db = await connectAuthDb();
    const today = employeeReportToday(req);
    const userId = String(req.authUser.id);
    const sheets = await getDmrSpreadsheet(spreadsheetId);
    const appTab = await ensureEmployeeAppDataTab(sheets, spreadsheetId, false);
    let currentReport = null;
    if (appTab) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${escapeSheetName(EMPLOYEE_REPORT_APP_TAB)}!A2:O10000`,
      }, { retry: false });
      currentReport = employeeReportsFromAppRows({ rows: response.data.values || [], user: req.user })
        .find((report) => String(report.userId) === userId && report.reportDate === today) || null;
    }
    await db.collection("employeeDailyReports").deleteOne({ userId, reportDate: today });
    if (currentReport) await cacheEmployeeReports(db, [currentReport]);
    employeeReportCache.delete(employeeReportCacheKey(req.user));
    await db.collection("users").updateOne(
      { _id: req.user._id },
      { $set: { employeeReportCacheHydratedAt: new Date(), updatedAt: new Date() } },
    );
    res.json({ success: true, reportFound: Boolean(currentReport), report: sanitizeEmployeeReport(currentReport) });
  } catch (error) {
    console.error("Employee today refresh error:", employeeSheetErrorMessage(error));
    res.status(isGoogleSheetsQuotaError(error) ? 429 : 500).json({ error: employeeSheetErrorMessage(error, "Could not refresh today's report") });
  }
});

app.put("/employee-daily-report/sheet", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const spreadsheetId = extractSpreadsheetId(req.body?.spreadsheet || req.body?.spreadsheetId || req.body?.sheetUrl);
    if (!spreadsheetId) return res.status(400).json({ error: "Paste a valid Google Sheet link or ID" });
    const meta = await getEmployeeSpreadsheetMeta(spreadsheetId);
    const db = await connectAuthDb();
    await db.collection("users").updateOne(
      { _id: req.user._id },
      {
        $set: {
          employeeDailySpreadsheetId: spreadsheetId,
          employeeDailySheetName: meta.title,
          employeeDailySheetTab: meta.tabName,
          updatedAt: new Date(),
        },
        $unset: { employeeReportCacheHydratedAt: "" },
      }
    );
    await db.collection("employeeDailyReports").deleteMany({ userId: String(req.authUser.id) });
    res.json({ success: true, sheetId: spreadsheetId, sheetUrl: employeeSheetUrl(spreadsheetId), sheetName: meta.title, tabName: meta.tabName });
  } catch (error) {
    console.error("Employee daily sheet link error:", employeeSheetErrorMessage(error));
    res.status(isGoogleSheetsQuotaError(error) ? 429 : 400).json({ error: employeeSheetErrorMessage(error, `Could not link sheet: ${error.message}`) });
  }
});

app.get("/employee-daily-report/executive-questions/settings", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    res.json(await getEmployeeExecutiveQuestionSettings({ includeUsers: true }));
  } catch (error) {
    console.error("Employee executive question settings load error:", error);
    res.status(500).json({ error: "Could not load management question settings" });
  }
});

app.put("/employee-daily-report/executive-questions/settings", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    const db = await connectAuthDb();
    const validUsers = new Set((await employeeExecutiveQuestionUsers(db)).map((user) => String(user._id)));
    const questions = (Array.isArray(req.body?.questions) ? req.body.questions : [])
      .map((question) => serializeEmployeeExecutiveQuestion({
        id: projectText(question?.id) || new ObjectId().toString(),
        label: question?.label,
        enabled: question?.enabled !== false,
        assignedUserIds: (Array.isArray(question?.assignedUserIds) ? question.assignedUserIds : []).filter((id) => validUsers.has(String(id))),
      }))
      .filter((question) => question.label)
      .slice(0, 40);
    if (!questions.length) return res.status(400).json({ error: "Add at least one management question" });
    const now = new Date();
    await db.collection("platformSettings").updateOne(
      { _id: EMPLOYEE_EXECUTIVE_QUESTIONS_SETTINGS_ID },
      { $set: { questions, updatedAt: now, updatedBy: { id: req.authUser.id, name: req.authUser.displayName || req.authUser.username || "Admin" } }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    await db.collection("employeeExecutiveReportAnalyses").deleteMany({});
    res.json({ success: true, ...(await getEmployeeExecutiveQuestionSettings({ includeUsers: true })) });
  } catch (error) {
    console.error("Employee executive question settings save error:", error);
    res.status(500).json({ error: error.message || "Could not save management question settings" });
  }
});

app.put("/employee-daily-report/executive-answers", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const db = await connectAuthDb();
    const reportDate = dmrDateKey(req.body?.reportDate) || employeeReportToday(req);
    const userId = String(req.authUser.id);
    const assignedQuestions = await employeeExecutiveQuestionsForUser(req.user || req.authUser || {});
    if (!assignedQuestions.length) return res.status(400).json({ error: "No management questions are assigned to this employee" });
    const answerMap = new Map((Array.isArray(req.body?.answers) ? req.body.answers : []).map((item) => [projectText(item?.id), projectText(item?.answer)]));
    const answers = assignedQuestions.map((question) => ({
      id: question.id,
      label: question.label,
      answer: answerMap.get(question.id) || "",
    }));
    const missing = answers.find((item) => !item.answer);
    if (missing) return res.status(400).json({ error: `Please answer: ${missing.label}` });
    const now = new Date();
    const doc = {
      userId,
      employeeName: req.authUser.displayName || req.authUser.username || "Employee",
      username: req.authUser.username || "",
      department: projectText(req.user?.department || ""),
      reportDate,
      answers,
      submittedAt: now,
      updatedAt: now,
    };
    await db.collection("employeeExecutiveReportAnswers").updateOne(
      { userId, reportDate },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    await db.collection("employeeExecutiveReportAnalyses").deleteMany({ rangeFrom: { $lte: reportDate }, rangeTo: { $gte: reportDate } });
    res.json({ success: true, answers: sanitizeEmployeeExecutiveAnswersDoc(doc) });
  } catch (error) {
    console.error("Employee executive answers save error:", error);
    res.status(500).json({ error: error.message || "Could not save management answers" });
  }
});

async function getEmployeeDailyPositivityQuote(dateKey) {
  const date = dmrDateKey(dateKey) || istDateKey(new Date());
  const cacheId = `employee-daily-quote:${date}`;
  const db = await connectAuthDb();
  const cached = await db.collection("platformSettings").findOne({ _id: cacheId });
  if (projectText(cached?.quote)) return cached.quote;
  if (employeeDailyQuoteBuilds.has(date)) return employeeDailyQuoteBuilds.get(date);

  const build = (async () => {
    const fallbackQuotes = [
      "Consistent progress, thoughtfully shared, turns everyday effort into meaningful momentum.",
      "Every clear update strengthens teamwork and makes tomorrow's progress easier to achieve.",
      "Small steps completed with care become the foundation of remarkable results.",
      "Your steady effort today creates confidence, clarity, and momentum for the whole team.",
      "Progress grows when good work is completed, shared, and carried forward together.",
      "Thoughtful work and honest updates turn busy days into meaningful achievement.",
      "Each well-finished task moves the team closer to something worth being proud of.",
    ];
    const fallbackQuote = fallbackQuotes[Number(date.replace(/\D/g, "")) % fallbackQuotes.length];
    let quote = fallbackQuote;
    let provider = "fallback";
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (anthropicKey) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: AbortSignal.timeout(8000),
          headers: { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
            max_tokens: 80,
            system: "Write one original, warm positivity quote for employees. Use simple professional language, no attribution, no quotation marks, and no more than 18 words. Return only the quote.",
            messages: [{ role: "user", content: `Create the daily positivity quote for ${date}.` }],
          }),
        });
        const data = await response.json();
        const generated = (data.content || []).filter((item) => item.type === "text").map((item) => item.text).join(" ").trim().replace(/^[\"'“”]+|[\"'“”]+$/g, "");
        if (response.ok && generated) {
          quote = generated.slice(0, 180);
          provider = "claude";
        }
      } catch (error) {
        console.warn("Employee daily quote fallback:", error.message);
      }
    }
    await db.collection("platformSettings").updateOne(
      { _id: cacheId },
      { $set: { date, quote, provider, generatedAt: new Date() } },
      { upsert: true },
    );
    return quote;
  })().finally(() => employeeDailyQuoteBuilds.delete(date));
  employeeDailyQuoteBuilds.set(date, build);
  return build;
}

async function generateEmployeeSubmissionPraise({ employeeName, taskItems = [], waitingTaskItems = [], date }) {
  const firstName = projectText(employeeName).split(/\s+/)[0] || "there";
  const completedCount = taskItems.length;
  const waitingCount = waitingTaskItems.length;
  const progressText = completedCount
    ? `You shared ${completedCount} clear work update${completedCount === 1 ? "" : "s"}`
    : "Your clear update";
  const followUpText = waitingCount ? " and made the next follow-ups visible" : " and helped the team stay aligned";
  return {
    message: `Beautiful work, ${firstName}. ${progressText}${followUpText}.`,
    quote: await getEmployeeDailyPositivityQuote(date),
  };
}

app.post("/employee-daily-report", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const db = await connectAuthDb();
    const today = employeeReportToday(req);
    const userId = String(req.authUser.id);
    const body = req.body || {};
    const department = projectText(body.department || req.user.department);
    if (!department) return res.status(400).json({ error: "Department is required for your first report" });
    const taskItems = sanitizeEmployeeTaskItems(body.taskItems);
    const waitingTaskItems = sanitizeEmployeeTaskItems(body.waitingTaskItems);
    if (!taskItems.length) return res.status(400).json({ error: "Add at least one completed task with site, category, status and description" });
    if (taskItems.some((item) => !item.site) || waitingTaskItems.some((item) => !item.site)) return res.status(400).json({ error: "Choose a site for every task" });
    if (taskItems.some((item) => !item.status)) return res.status(400).json({ error: "Choose a status for every today task" });
    if (taskItems.some((item) => !item.involvement) || waitingTaskItems.some((item) => !item.involvement)) return res.status(400).json({ error: "Choose involvement for every task" });
    const now = new Date();
    const report = {
      _id: new ObjectId(),
      reportId: new ObjectId().toString(),
      userId,
      employeeName: req.authUser.displayName || req.authUser.username || "Employee",
      department,
      reportDate: today,
      submittedAt: now,
      client: "",
      site: taskItems[0]?.site || waitingTaskItems[0]?.site || "",
      taskType: taskItems[0]?.category || "",
      taskItems,
      taskDescription: taskItemsToText(taskItems),
      taskStatus: taskItems[0]?.status || "",
      involvement: taskItems[0]?.involvement || waitingTaskItems[0]?.involvement || "",
      waitingTaskItems,
      waitingTaskDescription: taskItemsToText(waitingTaskItems),
      tomorrowPlanTick: Boolean(body.tomorrowPlanTick),
      note: projectText(body.note),
      createdAt: now,
      updatedAt: now,
    };
    await appendEmployeeReportToSheet({ user: req.user, report, taskItems, waitingTaskItems });
    await cacheEmployeeReports(db, [report]);
    const userSet = { updatedAt: now };
    userSet.employeeReportCacheHydratedAt = now;
    if (!req.user.department || req.user.department !== department) userSet.department = department;
    await db.collection("users").updateOne({ _id: req.user._id }, { $set: userSet });
    const celebration = await generateEmployeeSubmissionPraise({ employeeName: report.employeeName, taskItems, waitingTaskItems, date: today });
    const executiveQuestions = await employeeExecutiveQuestionsForUser(req.user || req.authUser || {});
    const executiveAnswers = executiveQuestions.length ? await employeeExecutiveAnswersForUserDate(db, userId, today) : null;
    res.json({ success: true, report: sanitizeEmployeeReport({ ...report, _id: report._id }), celebration, executiveQuestions, executiveAnswers });
  } catch (error) {
    if (error.code === 11000 || error.code === "EMPLOYEE_REPORT_EXISTS") return res.status(409).json({ error: "Today's report is already submitted" });
    if (/link your google sheet|could not open|permission|not found|no visible sheet/i.test(error.message || "")) return res.status(400).json({ error: error.message });
    console.error("Employee daily report submit error:", employeeSheetErrorMessage(error));
    res.status(isGoogleSheetsQuotaError(error) ? 429 : 500).json({ error: employeeSheetErrorMessage(error, "Could not submit daily report") });
  }
});

app.put("/employee-daily-report", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const db = await connectAuthDb();
    const today = employeeReportToday(req);
    const userId = String(req.authUser.id);
    const body = req.body || {};
    if (body.reportDate && projectText(body.reportDate) !== today) return res.status(403).json({ error: "Only the current date report can be edited" });
    const department = projectText(body.department || req.user.department);
    if (!department) return res.status(400).json({ error: "Department is required" });
    const taskItems = sanitizeEmployeeTaskItems(body.taskItems);
    const waitingTaskItems = sanitizeEmployeeTaskItems(body.waitingTaskItems);
    if (!taskItems.length) return res.status(400).json({ error: "Add at least one completed task with site, category and description" });
    if (taskItems.some((item) => !item.site) || waitingTaskItems.some((item) => !item.site)) return res.status(400).json({ error: "Choose a site for every task" });
    if (taskItems.some((item) => !item.status)) return res.status(400).json({ error: "Choose a status for every today task" });
    if (taskItems.some((item) => !item.involvement) || waitingTaskItems.some((item) => !item.involvement)) return res.status(400).json({ error: "Choose involvement for every task" });
    const now = new Date();
    const report = {
      reportId: projectText(body.id || body.reportId),
      userId,
      employeeName: req.authUser.displayName || req.authUser.username || "Employee",
      department,
      reportDate: today,
      submittedAt: now,
      client: "",
      site: taskItems[0]?.site || waitingTaskItems[0]?.site || "",
      taskType: taskItems[0]?.category || "",
      taskItems,
      taskDescription: taskItemsToText(taskItems),
      taskStatus: taskItems[0]?.status || "",
      involvement: taskItems[0]?.involvement || waitingTaskItems[0]?.involvement || "",
      waitingTaskItems,
      waitingTaskDescription: taskItemsToText(waitingTaskItems),
      tomorrowPlanTick: Boolean(body.tomorrowPlanTick),
      note: projectText(body.note),
      updatedAt: now,
    };
    report.reportId = await updateEmployeeReportInSheet({ user: req.user, report, taskItems, waitingTaskItems });
    await cacheEmployeeReports(db, [report]);
    const userSet = { updatedAt: now };
    userSet.employeeReportCacheHydratedAt = now;
    if (!req.user.department || req.user.department !== department) userSet.department = department;
    await db.collection("users").updateOne({ _id: req.user._id }, { $set: userSet });
    const executiveQuestions = await employeeExecutiveQuestionsForUser(req.user || req.authUser || {});
    const executiveAnswers = executiveQuestions.length ? await employeeExecutiveAnswersForUserDate(db, userId, today) : null;
    res.json({ success: true, report: sanitizeEmployeeReport(report), executiveQuestions, executiveAnswers });
  } catch (error) {
    if (error.code === "EMPLOYEE_REPORT_NOT_FOUND") return res.status(404).json({ error: error.message });
    if (/link your google sheet|could not open|permission|not found|no visible sheet/i.test(error.message || "")) return res.status(400).json({ error: error.message });
    console.error("Employee daily report update error:", employeeSheetErrorMessage(error));
    res.status(isGoogleSheetsQuotaError(error) ? 429 : 500).json({ error: employeeSheetErrorMessage(error, "Could not update today's daily report") });
  }
});

app.delete("/employee-daily-report/:reportDate", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const reportDate = dmrDateKey(req.params.reportDate);
    if (!reportDate) return res.status(400).json({ error: "Valid report date is required" });
    const db = await connectAuthDb();
    const requestedUserId = projectText(req.query.userId || req.body?.userId || req.authUser.id);
    const isAdmin = canViewEmployeeDailyReports(req);
    const ownUserId = String(req.authUser.id);
    if (!isAdmin && requestedUserId !== ownUserId) return res.status(403).json({ error: "You can delete only your own report" });
    const targetObjectId = /^[a-f\d]{24}$/i.test(requestedUserId) ? new ObjectId(requestedUserId) : req.user._id;
    const targetUser = requestedUserId === ownUserId
      ? req.user
      : await db.collection("users").findOne({ _id: targetObjectId });
    if (!targetUser) return res.status(404).json({ error: "Employee user not found" });
    const targetUserId = String(targetUser._id || requestedUserId);
    const cachedReport = await db.collection("employeeDailyReports").findOne({ userId: targetUserId, reportDate });
    const result = await deleteEmployeeReportFromSheet({ user: targetUser, reportDate, fallbackReport: cachedReport });
    const cacheDelete = await db.collection("employeeDailyReports").deleteOne({ userId: targetUserId, reportDate });
    await db.collection("employeeExecutiveReportAnswers").deleteOne({ userId: targetUserId, reportDate });
    await db.collection("users").updateOne(
      { _id: targetUser._id },
      { $set: { employeeReportCacheHydratedAt: new Date(), updatedAt: new Date() } },
    );
    employeeReportCache.delete(employeeReportCacheKey(targetUser));
    addActivityLog({ req, action: "Deleted employee daily report", target: `${targetUser.displayName || targetUser.username || "Employee"} · ${reportDate}`, details: { ...result, cacheDeleted: cacheDelete.deletedCount } });
    res.json({ success: true, ...result, cacheDeleted: cacheDelete.deletedCount });
  } catch (error) {
    if (/linked google sheet|permission|not found|no visible sheet/i.test(error.message || "")) return res.status(400).json({ error: error.message });
    console.error("Employee daily report delete error:", employeeSheetErrorMessage(error));
    res.status(isGoogleSheetsQuotaError(error) ? 429 : 500).json({ error: employeeSheetErrorMessage(error, "Could not delete employee daily report") });
  }
});

app.get("/employee-daily-report/reminder/status", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    const date = dmrDateKey(req.query.date) || employeeReportToday(req);
    const db = await connectAuthDb();
    const run = await db.collection("platformSettings").findOne({ _id: employeeReportReminderRunId(date) });
    res.json({ reminder: serializeReminderRun(run, date) });
  } catch (error) {
    console.error("Employee reminder status error:", error);
    res.status(500).json({ error: "Could not check reminder status" });
  }
});

app.get("/employee-daily-report/reminder/settings", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    res.json({ settings: await getEmployeeReminderSettings() });
  } catch (error) {
    console.error("Employee reminder settings load error:", error);
    res.status(500).json({ error: "Could not load reminder settings" });
  }
});

app.patch("/employee-daily-report/reminder/settings", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    const settings = await saveEmployeeReminderSettings({
      time: req.body?.time,
      enabled: req.body?.enabled !== false,
      actor: req.authUser,
    });
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Employee reminder settings save error:", error);
    res.status(400).json({ error: error.message || "Could not save reminder settings" });
  }
});

app.post("/employee-daily-report/reminder/send-now", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    const date = dmrDateKey(req.body?.date || req.query.date) || employeeReportToday(req);
    const reminder = await sendEmployeeDailyReportReminders({ dateKey: date, source: "manual", force: true, includeSubmitted: true });
    res.json({ success: true, reminder });
  } catch (error) {
    console.error("Employee reminder send-now error:", error);
    res.status(500).json({ error: error.message || "Could not send reminders now" });
  }
});

function fallbackEmployeeExecutiveAnalysis(entries = []) {
  const answerText = entries.flatMap((entry) => entry.answers || []).map((answer) => answer.answer).join(" ").toLowerCase();
  const riskWords = ["pending", "block", "delay", "not", "no", "issue", "critical", "required", "short", "hold"];
  const riskEntries = entries.filter((entry) => (entry.answers || []).some((answer) => riskWords.some((word) => String(answer.answer || "").toLowerCase().includes(word))));
  const riskNames = [...new Set(riskEntries.map((entry) => entry.employeeName).filter(Boolean))].slice(0, 4);
  const referencedAnswer = (entry, answer) => `${entry.employeeName || "Employee"}: ${shortExecutiveInsight(answer || "Follow-up required", 135)}`;
  const answersByLabel = (pattern) => entries.flatMap((entry) => (entry.answers || [])
    .filter((answer) => pattern.test(`${answer.label || ""} ${answer.answer || ""}`) && projectText(answer.answer))
    .map((answer) => referencedAnswer(entry, answer.answer)));
  const moneySignals = answersByLabel(/payment|collection|cash|amount|account|invoice/i).slice(0, 4);
  const procurementSignals = answersByLabel(/vendor|quotation|material|delivery|purchase|procure/i).slice(0, 4);
  const ceoDecisions = answersByLabel(/ceo|decision|approval|pending/i).slice(0, 4);
  const tomorrowCommitments = answersByLabel(/tomorrow|commitment|complete|delivery|target/i).slice(0, 4);
  const projectHealth = answersByLabel(/project|site|client|drawing|execution|work/i).slice(0, 4);
  return {
    provider: "fallback",
    model: "local",
    overallStatus: entries.length ? `${entries.length} management update${entries.length === 1 ? "" : "s"} submitted for the selected range.` : "No management question data is available for the selected range.",
    projectMostAtRiskTomorrow: riskNames.length ? `${riskNames.join(", ")} need follow-up based on pending or blocking updates.` : "No specific project risk was identified from the submitted answers.",
    keyRisks: riskEntries.slice(0, 5).map((entry) => referencedAnswer(entry, (entry.answers || []).find((answer) => riskWords.some((word) => String(answer.answer || "").toLowerCase().includes(word)))?.answer || "Follow-up required")),
    decisionsNeeded: entries.flatMap((entry) => (entry.answers || []).filter((answer) => /decision|approval|pending/i.test(answer.label) && projectText(answer.answer)).map((answer) => referencedAnswer(entry, answer.answer))).slice(0, 5),
    tomorrowPriorities: entries.flatMap((entry) => (entry.answers || []).filter((answer) => /tomorrow|delivery|blocking|payment/i.test(answer.label) && projectText(answer.answer)).map((answer) => referencedAnswer(entry, answer.answer))).slice(0, 5),
    positiveSignals: answerText && !riskEntries.length ? ["No major blockers were reported in the submitted management answers."] : [],
    ceoFocus: {
      projectRisk: riskNames.length ? `${riskNames.join(", ")} have the clearest pending or blocking updates.` : "No project risk was clearly identified.",
      paymentFocus: moneySignals[0] || "No payment or collection update submitted.",
      ceoDecision: ceoDecisions[0] || "No CEO decision request was clearly submitted.",
      todayMustFinish: tomorrowCommitments[0] || "No measurable next commitment was clearly submitted.",
    },
    projectHealth,
    moneySignals,
    teamSignals: riskEntries.slice(0, 4).map((entry) => `${entry.employeeName || "Employee"}: Follow-up needed on reported blocker or pending item.`),
    procurementSignals,
    legalSignals: answersByLabel(/legal|agreement|approval|compliance|document|contract/i).slice(0, 4),
    ceoDecisions,
    tomorrowCommitments,
  };
}

function shortExecutiveInsight(value, maxLength = 180, maxWords = 26) {
  const text = projectText(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const words = text.split(/\s+/);
  const wordLimited = words.length > maxWords ? `${words.slice(0, maxWords).join(" ").replace(/[.,;:-]+$/, "")}.` : text;
  if (wordLimited.length <= maxLength) return wordLimited;
  const window = wordLimited.slice(0, maxLength + 1);
  const sentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "), window.lastIndexOf(", "));
  const cutAt = sentenceBreak >= Math.floor(maxLength * 0.55) ? sentenceBreak + 1 : window.lastIndexOf(" ");
  return `${window.slice(0, cutAt > 0 ? cutAt : maxLength).trim().replace(/[.,;:-]+$/, "")}.`;
}

function normalizeExecutiveInsightList(items, fallbackItems, options = {}) {
  const maxItems = options.maxItems || 4;
  const maxLength = options.maxLength || 190;
  const maxWords = options.maxWords || 24;
  return (Array.isArray(items) ? items : fallbackItems)
    .map((item) => shortExecutiveInsight(item, maxLength, maxWords))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeCeoFocus(rawFocus = {}, fallbackFocus = {}) {
  return {
    projectRisk: shortExecutiveInsight(rawFocus.projectRisk, 180, 24) || fallbackFocus.projectRisk || "No project risk was clearly identified.",
    paymentFocus: shortExecutiveInsight(rawFocus.paymentFocus, 180, 24) || fallbackFocus.paymentFocus || "No payment or collection update submitted.",
    ceoDecision: shortExecutiveInsight(rawFocus.ceoDecision, 180, 24) || fallbackFocus.ceoDecision || "No CEO decision request was clearly submitted.",
    todayMustFinish: shortExecutiveInsight(rawFocus.todayMustFinish, 180, 24) || fallbackFocus.todayMustFinish || "No measurable next commitment was clearly submitted.",
  };
}

function normalizeEmployeeDashboardCards(items, fallbackItems = [], options = {}) {
  const maxItems = options.maxItems || 4;
  return (Array.isArray(items) && items.length ? items : fallbackItems)
    .map((item) => {
      if (typeof item === "string") {
        return {
          name: shortExecutiveInsight(item, 70, 9),
          status: "",
          summary: shortExecutiveInsight(item, 180, 22),
          owner: "",
          nextAction: "",
        };
      }
      return {
        name: shortExecutiveInsight(item?.name || item?.project || item?.title, 70, 9),
        status: shortExecutiveInsight(item?.status, 80, 10),
        progress: shortExecutiveInsight(item?.progress, 45, 6),
        target: shortExecutiveInsight(item?.target, 70, 8),
        owner: shortExecutiveInsight(item?.owner, 80, 10),
        criticalPending: shortExecutiveInsight(item?.criticalPending, 70, 9),
        summary: shortExecutiveInsight(item?.summary || item?.insight, 185, 23),
        nextAction: shortExecutiveInsight(item?.nextAction, 165, 20),
        source: shortExecutiveInsight(item?.source, 90, 11),
      };
    })
    .filter((item) => item.name || item.summary || item.nextAction)
    .slice(0, maxItems);
}

function normalizeEmployeeExecutiveAnalysis(raw = {}, entries = []) {
  const fallback = fallbackEmployeeExecutiveAnalysis(entries);
  const fallbackProjectCards = (fallback.projectHealth || fallback.keyRisks || []).slice(0, 4).map((item) => ({
    name: "Clarify project",
    status: "Needs review",
    summary: item,
    source: item.split(":")[0],
  }));
  return {
    provider: raw.provider || fallback.provider,
    model: raw.model || fallback.model,
    overallStatus: shortExecutiveInsight(raw.overallStatus, 170, 22) || fallback.overallStatus,
    projectMostAtRiskTomorrow: shortExecutiveInsight(raw.projectMostAtRiskTomorrow, 190, 28) || fallback.projectMostAtRiskTomorrow,
    keyRisks: normalizeExecutiveInsightList(raw.keyRisks, fallback.keyRisks, { maxItems: 4, maxLength: 175, maxWords: 22 }),
    decisionsNeeded: normalizeExecutiveInsightList(raw.decisionsNeeded, fallback.decisionsNeeded, { maxItems: 4, maxLength: 175, maxWords: 22 }),
    tomorrowPriorities: normalizeExecutiveInsightList(raw.tomorrowPriorities, fallback.tomorrowPriorities, { maxItems: 4, maxLength: 175, maxWords: 22 }),
    positiveSignals: normalizeExecutiveInsightList(raw.positiveSignals, fallback.positiveSignals, { maxItems: 3, maxLength: 175, maxWords: 22 }),
    ceoFocus: normalizeCeoFocus(raw.ceoFocus, fallback.ceoFocus),
    projectHealth: normalizeExecutiveInsightList(raw.projectHealth, fallback.projectHealth, { maxItems: 5, maxLength: 175, maxWords: 22 }),
    moneySignals: normalizeExecutiveInsightList(raw.moneySignals, fallback.moneySignals, { maxItems: 4, maxLength: 175, maxWords: 22 }),
    teamSignals: normalizeExecutiveInsightList(raw.teamSignals, fallback.teamSignals, { maxItems: 4, maxLength: 175, maxWords: 22 }),
    procurementSignals: normalizeExecutiveInsightList(raw.procurementSignals, fallback.procurementSignals, { maxItems: 4, maxLength: 175, maxWords: 22 }),
    legalSignals: normalizeExecutiveInsightList(raw.legalSignals, fallback.legalSignals, { maxItems: 3, maxLength: 175, maxWords: 22 }),
    ceoDecisions: normalizeExecutiveInsightList(raw.ceoDecisions, fallback.ceoDecisions || fallback.decisionsNeeded, { maxItems: 5, maxLength: 175, maxWords: 22 }),
    tomorrowCommitments: normalizeExecutiveInsightList(raw.tomorrowCommitments, fallback.tomorrowCommitments || fallback.tomorrowPriorities, { maxItems: 5, maxLength: 175, maxWords: 22 }),
    projectCards: normalizeEmployeeDashboardCards(raw.projectCards, fallbackProjectCards, { maxItems: 5 }),
    moneyDashboard: normalizeExecutiveInsightList(raw.moneyDashboard, fallback.moneySignals, { maxItems: 5, maxLength: 180, maxWords: 22 }),
    teamDashboard: normalizeExecutiveInsightList(raw.teamDashboard, fallback.teamSignals, { maxItems: 5, maxLength: 180, maxWords: 22 }),
    procurementDashboard: normalizeExecutiveInsightList(raw.procurementDashboard, fallback.procurementSignals, { maxItems: 5, maxLength: 180, maxWords: 22 }),
    legalDashboard: normalizeExecutiveInsightList(raw.legalDashboard, fallback.legalSignals, { maxItems: 4, maxLength: 180, maxWords: 22 }),
    deliverablesMovedForward: normalizeExecutiveInsightList(raw.deliverablesMovedForward, fallback.positiveSignals, { maxItems: 5, maxLength: 180, maxWords: 22 }),
    stuckItems: normalizeExecutiveInsightList(raw.stuckItems, fallback.keyRisks, { maxItems: 5, maxLength: 180, maxWords: 22 }),
    supportRequired: normalizeExecutiveInsightList(raw.supportRequired, fallback.teamSignals, { maxItems: 5, maxLength: 180, maxWords: 22 }),
  };
}

async function generateEmployeeExecutiveAnalysis({ range, entries = [] }) {
  const normalizedEntries = entries.map((entry) => ({
    date: entry.reportDate,
    employee: entry.employeeName,
    department: entry.department,
    answers: (entry.answers || []).map((answer) => ({ question: answer.label, answer: answer.answer })),
  }));
  const signature = crypto.createHash("sha256").update(JSON.stringify({ range, entries: normalizedEntries })).digest("hex");
  const cacheKey = `employee-executive-analysis:v6:${range.from}:${range.to}:${signature}`;
  const db = await connectAuthDb();
  const cached = await db.collection("employeeExecutiveReportAnalyses").findOne({ cacheKey });
  if (cached?.analysis) return cached.analysis;
  const fallback = fallbackEmployeeExecutiveAnalysis(entries);
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  let analysis = fallback;
  if (anthropicKey && entries.length) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(18000),
        headers: { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
          max_tokens: 1800,
          system: "You are an executive project analyst preparing a CEO daily operating dashboard. Analyze only the provided employee management-question answers. Do not invent facts. Synthesize insights, do not copy raw employee wording. Return strict JSON only.",
          messages: [{
            role: "user",
            content: `Create a polished CEO-ready 5-minute operating dashboard for ${range.from} to ${range.to}.

Rules:
- Analyze every submitted answer together.
- Base every statement only on explicit facts present in the submitted answers.
- Do NOT paste or closely paraphrase raw answer text.
- Do NOT add vendor names, amounts, dates, recommendations, owners, or statuses unless they are explicitly present in the answers.
- Merge duplicate themes across employees.
- Each bullet must be an executive insight: impact, risk, decision, or action.
- Every bullet in list fields must begin with the source employee name(s), for example "Krupali: ...".
- Maximum 4 bullets per section.
- Maximum 22 words per bullet.
- overallStatus: one sentence, maximum 22 words.
- projectMostAtRiskTomorrow: one sentence, maximum 28 words.
- Use professional CEO language.
- If evidence is insufficient, say that the update needs clarification instead of guessing.
- Focus on these CEO questions:
  1. Which project is most at risk today?
  2. Which payment is most important today?
  3. Which CEO decision is blocking progress?
  4. What must be completed before leaving today?
- Also extract: vendor finalized, quotation received, pending decision, blocking work, owner, due date, what moved the project forward, top completed deliverables, 100% completed outputs, stuck items, risk, support required, and who should help.
- Organize around Projects, Money, Team, Procurement, Legal/approvals.
- Do not treat activity as progress unless it produced a clear deliverable, decision, payment, approval, or unblocked next step.

Return strict JSON only with keys:
overallStatus,
projectMostAtRiskTomorrow,
ceoFocus: { projectRisk, paymentFocus, ceoDecision, todayMustFinish },
projectCards: [{ name, status, progress, target, criticalPending, owner, summary, nextAction, source }],
moneyDashboard,
teamDashboard,
procurementDashboard,
legalDashboard,
deliverablesMovedForward,
stuckItems,
supportRequired,
projectHealth,
moneySignals,
teamSignals,
procurementSignals,
legalSignals,
keyRisks,
ceoDecisions,
decisionsNeeded,
tomorrowCommitments,
tomorrowPriorities,
positiveSignals.

Data: ${JSON.stringify(normalizedEntries).slice(0, 50000)}`,
          }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n").trim();
      const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      if (response.ok && jsonText) analysis = normalizeEmployeeExecutiveAnalysis({ ...JSON.parse(jsonText), provider: "claude", model: data.model || process.env.CLAUDE_MODEL || "claude-sonnet-4-6" }, entries);
    } catch (error) {
      console.warn("Employee executive analysis fallback:", error.message);
      analysis = fallback;
    }
  }
  await db.collection("employeeExecutiveReportAnalyses").updateOne(
    { cacheKey },
    { $set: { cacheKey, rangeFrom: range.from, rangeTo: range.to, signature, analysis, createdAt: new Date() } },
    { upsert: true },
  );
  return analysis;
}

async function buildEmployeeReportExportData(req, query = {}) {
  const db = await connectAuthDb();
  const today = employeeReportToday(req);
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(query.dateFrom || "")) ? String(query.dateFrom) : today;
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(String(query.dateTo || "")) ? String(query.dateTo) : dateFrom;
  const from = dateFrom <= dateTo ? dateFrom : dateTo;
  const to = dateFrom <= dateTo ? dateTo : dateFrom;
  const selectedUserIds = projectText(query.userIds).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 100);
  const selectedUserSet = new Set(selectedUserIds);
  const roles = await db.collection("roles").find({}).project({ name: 1, nameLower: 1 }).toArray();
  const roleMap = new Map(roles.map((role) => [String(role._id), role]));
  const activeUsers = (await db.collection("users")
    .find({ blacklisted: { $ne: true }, usernameLower: { $ne: SUPER_ADMIN_USERNAME.toLowerCase() } })
    .project({ displayName: 1, username: 1, usernameLower: 1, department: 1, roleId: 1, roleName: 1 })
    .sort({ displayName: 1, username: 1 })
    .limit(1000)
    .toArray())
    .map((user) => {
      const role = roleMap.get(String(user.roleId));
      return {
        id: String(user._id),
        displayName: user.displayName || user.username || "Employee",
        username: user.username || "",
        department: user.department || "",
        roleName: role?.name || user.roleName || "",
      };
    })
    .filter((user) => projectText(user.roleName).toLowerCase() !== "dmr manager")
    .filter((user) => !selectedUserSet.size || selectedUserSet.has(user.id));
  const eligibleUserIdSet = new Set(activeUsers.map((user) => user.id));
  const answerFilter = { reportDate: { $gte: from, $lte: to } };
  if (selectedUserIds.length) answerFilter.userId = { $in: selectedUserIds };
  const executiveAnswers = (await db.collection("employeeExecutiveReportAnswers")
    .find(answerFilter)
    .sort({ reportDate: 1, employeeName: 1 })
    .limit(5000)
    .toArray())
    .map(sanitizeEmployeeExecutiveAnswersDoc)
    .filter(Boolean)
    .filter((entry) => {
      if (projectText(entry.username).toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) return false;
      return entry.userId ? eligibleUserIdSet.has(String(entry.userId)) : true;
    });
  const reportFilter = { reportDate: { $gte: from, $lte: to } };
  if (selectedUserIds.length) reportFilter.userId = { $in: selectedUserIds };
  const employeeReports = (await db.collection("employeeDailyReports")
    .find(reportFilter)
    .sort({ reportDate: 1, employeeName: 1, submittedAt: 1 })
    .limit(5000)
    .toArray())
    .map(sanitizeEmployeeReport)
    .filter(Boolean)
    .filter((report) => report.userId ? eligibleUserIdSet.has(String(report.userId)) : projectText(report.employeeName).toLowerCase() !== "super admin");
  const answersByUserDate = new Map();
  executiveAnswers.forEach((entry) => {
    answersByUserDate.set(`${entry.userId || ""}|${entry.reportDate || ""}`, entry);
  });
  const reportsByUserDate = new Map(employeeReports.map((report) => [`${report.userId || ""}|${report.reportDate || ""}`, report]));
  executiveAnswers.forEach((entry) => {
    const key = `${entry.userId || ""}|${entry.reportDate || ""}`;
    if (reportsByUserDate.has(key)) return;
    const fallbackReport = sanitizeEmployeeReport({
      _id: key,
      userId: entry.userId,
      employeeName: entry.employeeName,
      department: entry.department,
      reportDate: entry.reportDate,
      submittedAt: entry.submittedAt || entry.updatedAt || entry.createdAt,
      taskItems: [],
      waitingTaskItems: [],
      tomorrowPlanTick: false,
      note: "",
    });
    if (fallbackReport) {
      employeeReports.push(fallbackReport);
      reportsByUserDate.set(key, fallbackReport);
    }
  });
  const employeeSubmissions = employeeReports
    .map((report) => {
      const executiveEntry = answersByUserDate.get(`${report.userId || ""}|${report.reportDate || ""}`);
      return {
        ...report,
        managementAnswers: (executiveEntry?.answers || [])
          .map((answer) => ({
            id: answer.id,
            label: answer.label,
            answer: answer.answer,
          }))
          .filter((answer) => projectText(answer.answer)),
      };
    })
    .sort((a, b) => {
      const aHasManagement = (a.managementAnswers || []).length ? 1 : 0;
      const bHasManagement = (b.managementAnswers || []).length ? 1 : 0;
      if (aHasManagement !== bHasManagement) return bHasManagement - aHasManagement;
      return `${a.reportDate || ""} ${a.employeeName || ""}`.localeCompare(`${b.reportDate || ""} ${b.employeeName || ""}`);
    });
  const employees = new Set();
  const departments = new Map();
  const questions = new Map();
  employeeSubmissions.forEach((report) => {
    employees.add(report.employeeName || report.userId);
    incrementEmployeeReportBucket(departments, report.department, {
      reports: 1,
      completedTasks: sanitizeEmployeeTaskItems(report.taskItems).length,
      waitingTasks: sanitizeEmployeeTaskItems(report.waitingTaskItems).length,
      employeeName: report.employeeName,
    });
  });
  executiveAnswers.forEach((entry) => {
    employees.add(entry.employeeName || entry.username || entry.userId);
    (entry.answers || []).forEach((answer) => {
      const current = questions.get(answer.id) || { id: answer.id, label: answer.label, responses: 0, employees: new Set() };
      current.responses += projectText(answer.answer) ? 1 : 0;
      if (entry.employeeName) current.employees.add(entry.employeeName);
      questions.set(answer.id, current);
    });
  });
  const dateKeys = [];
  for (let cursor = from; cursor && cursor <= to && dateKeys.length < 370; cursor = addDaysToDateKey(cursor, 1)) dateKeys.push(cursor);
  const submittedByDate = new Map();
  employeeSubmissions.forEach((report) => {
    const date = dmrDateKey(report.reportDate);
    if (!date) return;
    const set = submittedByDate.get(date) || new Set();
    if (report.userId) set.add(String(report.userId));
    submittedByDate.set(date, set);
  });
  const notSubmitted = dateKeys.map((date) => {
    const submitted = submittedByDate.get(date) || new Set();
    const missingEmployees = activeUsers.filter((user) => !submitted.has(user.id));
    return {
      date,
      count: missingEmployees.length,
      employees: missingEmployees,
    };
  });
  const notSubmittedCount = notSubmitted.reduce((sum, group) => sum + group.count, 0);
  return {
    range: { from, to },
    selectedUserIds,
    summary: { responses: employeeSubmissions.length, employees: employees.size, totalEmployees: activeUsers.length, notSubmitted: notSubmittedCount, departments: departments.size, questions: questions.size },
    analysis: null,
    departments: [...departments.values()].map(serializeEmployeeReportBucket).sort((a, b) => b.reports - a.reports),
    questions: [...questions.values()].map((item) => ({ id: item.id, label: item.label, responses: item.responses, employees: item.employees.size })).sort((a, b) => b.responses - a.responses),
    executiveAnswers,
    notSubmitted,
    employeeReports: employeeSubmissions,
  };
}

app.get("/employee-daily-report/report", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    res.json(await buildEmployeeReportExportData(req, req.query || {}));
  } catch (error) {
    console.error("Employee daily report generation error:", error);
    res.status(500).json({ error: "Could not generate employee daily report" });
  }
});

app.get("/employee-daily-report/report/pdf", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report") || !canViewEmployeeDailyReports(req)) return res.status(403).json({ error: "Employee report admin access required" });
    const report = await buildEmployeeReportExportData(req, req.query || {});
    const buffer = await generateEmployeeDailyReportPdf(report);
    const rangeName = report.range.from === report.range.to ? report.range.from : `${report.range.from}_to_${report.range.to}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="employee-daily-report-${rangeName}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error("Employee daily report PDF error:", error);
    res.status(500).json({ error: "Could not generate employee report PDF" });
  }
});

app.put("/employee-daily-report/preferences", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "employee-daily-report")) return res.status(403).json({ error: "Employee Daily Report access required" });
    const preferences = sanitizeEmployeeTaskPreferences(req.body || {});
    const db = await connectAuthDb();
    await db.collection("users").updateOne(
      { _id: req.user._id },
      {
        $set: {
          employeeTaskPreferences: preferences,
          employeeTaskSites: preferences.sites,
          employeeTaskCategories: preferences.categories,
          updatedAt: new Date(),
        },
      }
    );
    res.json({ success: true, preferences });
  } catch (error) {
    console.error("Employee task preferences update error:", error);
    res.status(500).json({ error: "Could not update task preferences" });
  }
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

app.get("/admin/module-control", requireSuperAdmin, async (req, res) => {
  try {
    const disabledModules = await getDisabledModules();
    res.json({
      modules: ALL_MENU_ITEMS.map((item) => ({
        ...item,
        enabled: !disabledModules.includes(item.id),
        locked: PROTECTED_GLOBAL_MODULES.has(item.id),
      })),
      disabledModules,
    });
  } catch (error) {
    console.error("Module control load error:", error);
    res.status(500).json({ error: "Could not load module controls" });
  }
});

app.put("/admin/module-control", requireSuperAdmin, async (req, res) => {
  try {
    const requested = Array.isArray(req.body?.disabledModules) ? req.body.disabledModules.map(String) : [];
    const disabledModules = [...new Set(requested)].filter((id) => ALL_MENU_ITEMS.some((item) => item.id === id) && !PROTECTED_GLOBAL_MODULES.has(id));
    const db = await connectAuthDb();
    await db.collection("platformSettings").updateOne(
      { _id: "module-control" },
      { $set: { disabledModules, updatedAt: new Date(), updatedBy: String(req.authUser?.id || "") } },
      { upsert: true },
    );
    moduleControlCache = { disabledModules, expiresAt: Date.now() + 5000 };
    addActivityLog({ req, action: "Updated module control", target: "Platform modules", status: "success", details: { disabledModules } });
    res.json({ success: true, disabledModules });
  } catch (error) {
    console.error("Module control update error:", error);
    res.status(500).json({ error: "Could not update module controls" });
  }
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
      isSuperAdmin: isSuperAdminRole(role),
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
      if (String(user.usernameLower || user.username || "").toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase() && !isSuperAdminRole(role)) {
        return res.status(400).json({ error: "System Super Admin role cannot be changed" });
      }
      update.roleId = role._id;
      update.isSuperAdmin = isSuperAdminRole(role);
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
    const role = await getRole(user.roleId);
    if (isEffectiveSuperAdmin(user, role)) return res.status(400).json({ error: "Super Admin cannot be deleted" });
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
const mrnHistoryPath = path.join(dataDir, "mrn-history.json");
const dmrSettingsPath = path.join(dataDir, "dmr-settings.json");
const dmrPdfDir = path.join(dataDir, "dmr-pdfs");
const dmrAiCacheDir = path.join(dataDir, "dmr-ai-cache");
const dmrPdfBuilds = new Map();
const dmrPdfRefreshes = new Map();
const DMR_PDF_CACHE_TTL_MS = Math.max(30_000, Number(process.env.DMR_PDF_CACHE_TTL_MS) || 5 * 60_000);
const DMR_PDF_RETRY_BACKOFF_MS = Math.max(30_000, Number(process.env.DMR_PDF_RETRY_BACKOFF_MS) || 2 * 60_000);
const mrnSettingsPath = path.join(dataDir, "mrn-settings.json");
if (!fs.existsSync(dmrPdfDir)) fs.mkdirSync(dmrPdfDir, { recursive: true });
if (!fs.existsSync(dmrAiCacheDir)) fs.mkdirSync(dmrAiCacheDir, { recursive: true });

let documents = [];
let documentFolders = [];
let automations = [];
let reports = [];
let notifications = [];
let activityLogs = [];
let dmrHistory = [];
let mrnHistory = [];
let dmrSettings = {
  spreadsheetId: normalizeSpreadsheetId(DEFAULT_DMR_SPREADSHEET_ID),
  linkedAt: null,
  linkedBy: null,
  unlinkedAt: null,
  unlinkedBy: null,
};
let mrnSettings = {
  spreadsheetId: normalizeSpreadsheetId(DEFAULT_MRN_SPREADSHEET_ID),
  driveFolderId: "",
  linkedAt: null,
  linkedBy: null,
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

if (fs.existsSync(mrnHistoryPath)) {
  try {
    mrnHistory = JSON.parse(fs.readFileSync(mrnHistoryPath, "utf8"));
  } catch (error) {
    console.error("Error loading MRN history:", error);
    mrnHistory = [];
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

if (fs.existsSync(mrnSettingsPath)) {
  try {
    const savedMrnSettings = JSON.parse(fs.readFileSync(mrnSettingsPath, "utf8"));
    mrnSettings = {
      ...mrnSettings,
      ...(savedMrnSettings || {}),
      spreadsheetId: normalizeSpreadsheetId(savedMrnSettings?.spreadsheetId),
      driveFolderId: extractDriveFileId(savedMrnSettings?.driveFolderId || savedMrnSettings?.driveFolderLink || "") || "",
    };
  } catch (error) {
    console.error("Error loading MRN settings:", error);
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

function saveMrnHistory() {
  try {
    fs.writeFileSync(mrnHistoryPath, JSON.stringify(mrnHistory, null, 2));
  } catch (error) {
    console.error("Error saving MRN history:", error);
  }
}

function saveDmrSettings() {
  try {
    fs.writeFileSync(dmrSettingsPath, JSON.stringify(dmrSettings, null, 2));
  } catch (error) {
    console.error("Error saving DMR settings:", error);
  }
}

function saveMrnSettings() {
  try {
    fs.writeFileSync(mrnSettingsPath, JSON.stringify(mrnSettings, null, 2));
  } catch (error) {
    console.error("Error saving MRN settings:", error);
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

function publicMrnSettings() {
  const spreadsheetId = normalizeSpreadsheetId(mrnSettings.spreadsheetId);
  const driveFolderId = extractDriveFileId(mrnSettings.driveFolderId || "") || "";
  return {
    linked: Boolean(spreadsheetId),
    driveLinked: Boolean(driveFolderId),
    spreadsheetId,
    driveFolderId,
    linkedAt: mrnSettings.linkedAt || null,
    linkedBy: mrnSettings.linkedBy || null,
  };
}

function getActiveMrnSpreadsheetId() {
  const spreadsheetId = normalizeSpreadsheetId(mrnSettings.spreadsheetId);
  if (!spreadsheetId) throw new Error("No MRN sheet is linked yet.");
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
  if (req.authUser?.isSuperAdmin) return true;
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
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function extractDriveFileId(value = "") {
  const text = String(value).trim().replace(/\s+/g, "");
  if (!text) return null;

  const filePathMatch = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePathMatch) return filePathMatch[1];

  const documentPathMatch = text.match(/\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (documentPathMatch) return documentPathMatch[1];

  const folderPathMatch = text.match(/\/folders\/([a-zA-Z0-9_-]+)/) || text.match(/[?&]folders=([a-zA-Z0-9_-]+)/);
  if (folderPathMatch) return folderPathMatch[1];

  try {
    const url = new URL(text);
    const id = url.searchParams.get("id");
    if (id) return id;
  } catch {
    // Raw Drive IDs are accepted below.
  }

  return /^[a-zA-Z0-9_-]{10,}$/.test(text) ? text : null;
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
  if (req.authUser?.isSuperAdmin) return true;
  const dmrConfig = project?.dmr || {};
  if (!dmrConfig.enabled) return false;
  const userId = String(req.authUser?.id || req.user?._id || "");
  const assigned = Array.isArray(dmrConfig.assignedUserIds) ? dmrConfig.assignedUserIds.map(String) : [];
  const editors = Array.isArray(dmrConfig.editableUserIds) ? dmrConfig.editableUserIds.map(String) : [];
  return assigned.includes(userId) || editors.includes(userId);
}

function canEditProjectDmr(project, req) {
  if (req.authUser?.isSuperAdmin) return true;
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
      const plannedValue = row[pair.plannedColumnIndex];
      const actualValue = row[pair.actualColumnIndex];
      const planned = dmrValueNumber(plannedValue);
      const actual = dmrValueNumber(actualValue);
      records.push({
        id: `${sheetName}:${rowIndex + 1}:${pair.site}`,
        date: dateKey,
        sheetName,
        rowNumber: rowIndex + 1,
        agency,
        site: pair.site,
        planned,
        actual,
        plannedFilled: projectText(plannedValue) !== "",
        actualFilled: projectText(actualValue) !== "",
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

async function refreshDmrManpowerTotals(spreadsheetId, sheetName) {
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A1:ZZ300`,
  });
  const values = response.data.values || [];
  const measureRowIndex = values.findIndex((row) => row.filter((cell) => /^(planned|actual)$/i.test(projectText(cell))).length >= 2);
  if (measureRowIndex < 1) return 0;

  const equipmentLabel = findDmrLabel(values, /equipments?\s+and\s+tools/i);
  const totalRowSearchEnd = equipmentLabel ? equipmentLabel.rowIndex : values.length;
  const totalRowIndex = values.findIndex((row, index) => (
    index > measureRowIndex &&
    index < totalRowSearchEnd &&
    row.some((cell) => /total\s+manpower/i.test(projectText(cell)))
  ));
  if (totalRowIndex < 0) return 0;

  const siteRowIndex = measureRowIndex - 1;
  const groupHeaderRowIndex = Math.max(0, measureRowIndex - 2);
  const siteRow = values[siteRowIndex] || [];
  const measureRow = values[measureRowIndex] || [];
  const sitePairs = [];
  const totalPair = { plannedColumnIndex: null, actualColumnIndex: null };
  let currentSite = "";

  for (let index = 0; index < Math.max(siteRow.length, measureRow.length); index += 1) {
    const possibleSite = cleanDmrSiteName(siteRow[index]);
    if (possibleSite) currentSite = possibleSite;
    const metric = projectText(measureRow[index]).toLowerCase();
    if (metric !== "planned" && metric !== "actual") continue;

    const groupHeader = projectText(values[groupHeaderRowIndex]?.[index]).toLowerCase();
    const isOverallTotal = /total.*site.*manpower|total\s+all\s+site\s+manpower/i.test(groupHeader);
    if (isOverallTotal) {
      if (metric === "planned") totalPair.plannedColumnIndex = index;
      if (metric === "actual") totalPair.actualColumnIndex = index;
      continue;
    }

    const site = currentSite || `Site ${sitePairs.length + 1}`;
    let pair = sitePairs.find((item) => item.site === site);
    if (!pair) {
      pair = { site, plannedColumnIndex: null, actualColumnIndex: null };
      sitePairs.push(pair);
    }
    if (metric === "planned" && pair.plannedColumnIndex === null) pair.plannedColumnIndex = index;
    if (metric === "actual" && pair.actualColumnIndex === null) pair.actualColumnIndex = index;
  }

  const startRowNumber = measureRowIndex + 2;
  const endRowNumber = totalRowIndex;
  const totalRowNumber = totalRowIndex + 1;
  if (endRowNumber < startRowNumber) return 0;

  const data = [];
  const plannedTotalCells = [];
  const actualTotalCells = [];
  for (const pair of sitePairs) {
    if (pair.plannedColumnIndex !== null) {
      const column = columnName(pair.plannedColumnIndex + 1);
      plannedTotalCells.push(`${column}${totalRowNumber}`);
      data.push({
        range: `${escapeSheetName(sheetName)}!${column}${totalRowNumber}`,
        values: [[`=SUM(${column}${startRowNumber}:INDEX(${column}:${column},ROW()-1))`]],
      });
    }
    if (pair.actualColumnIndex !== null) {
      const column = columnName(pair.actualColumnIndex + 1);
      actualTotalCells.push(`${column}${totalRowNumber}`);
      data.push({
        range: `${escapeSheetName(sheetName)}!${column}${totalRowNumber}`,
        values: [[`=SUM(${column}${startRowNumber}:INDEX(${column}:${column},ROW()-1))`]],
      });
    }
  }
  if (totalPair.plannedColumnIndex !== null && plannedTotalCells.length) {
    const column = columnName(totalPair.plannedColumnIndex + 1);
    data.push({
      range: `${escapeSheetName(sheetName)}!${column}${totalRowNumber}`,
      values: [[`=SUM(${plannedTotalCells.join(",")})`]],
    });
  }
  if (totalPair.actualColumnIndex !== null && actualTotalCells.length) {
    const column = columnName(totalPair.actualColumnIndex + 1);
    data.push({
      range: `${escapeSheetName(sheetName)}!${column}${totalRowNumber}`,
      values: [[`=SUM(${actualTotalCells.join(",")})`]],
    });
  }

  if (!data.length) return 0;
  const result = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  return result.data.totalUpdatedCells || 0;
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
  const totalUpdatedCells = await refreshDmrManpowerTotals(spreadsheetId, sheetName);
  sheetDatasetCache.delete(spreadsheetId);
  return { updatedCells: (response.data.totalUpdatedCells || 0) + totalUpdatedCells, sheetName, totalUpdatedCells };
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

function dmrActualsForPlan(records = []) {
  const siteBreakdown = [...records.reduce((result, record) => {
    const site = projectText(record.site) || "Unassigned site";
    const item = result.get(site) || { site, actual: 0, records: 0 };
    item.actual += Number(record.actual) || 0;
    item.records += 1;
    result.set(site, item);
    return result;
  }, new Map()).values()].sort((a, b) => b.actual - a.actual || a.site.localeCompare(b.site));
  const tradeSiteBreakdown = [...records.reduce((result, record) => {
    const site = projectText(record.site) || "Unassigned site";
    const trade = projectText(record.agency) || "General";
    const key = `${site}||${trade}`;
    const item = result.get(key) || { site, trade, actual: 0, records: 0 };
    item.actual += Number(record.actual) || 0;
    item.records += 1;
    result.set(key, item);
    return result;
  }, new Map()).values()].sort((a, b) => a.site.localeCompare(b.site) || a.trade.localeCompare(b.trade));

  return {
    actualManpower: records.reduce((sum, record) => sum + (Number(record.actual) || 0), 0),
    records: records.length,
    siteBreakdown,
    tradeSiteBreakdown,
  };
}

function parseGoogleTimestampDate(value) {
  const text = projectText(value);
  if (!text) return "";
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      year &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return "";
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return istDateKey(parsed);
  return "";
}

function parseGoogleTimestampParts(value) {
  const text = projectText(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?/i);
  if (!match) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
      dateKey: istDateKey(parsed),
      minutes: parsed.getHours() * 60 + parsed.getMinutes(),
    };
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !year ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  let hour = match[4] !== undefined ? Number(match[4]) : null;
  const minute = match[5] !== undefined ? Number(match[5]) : 0;
  const meridiem = projectText(match[7]).toUpperCase();
  if (hour !== null && meridiem) {
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }
  return {
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: hour === null || minute < 0 || minute > 59 ? null : (hour * 60) + minute,
  };
}

function tomorrowPlanTimeliness(records = []) {
  return [...records.reduce((result, record) => {
    const name = projectText(record.submittedBy) || "Unknown";
    const item = result.get(name) || { name, records: 0, onTime: 0, delayed: 0, status: "on-time", lastSubmittedAt: "" };
    item.records += 1;
    if (record.timeliness === "on-time") item.onTime += 1;
    else item.delayed += 1;
    item.status = item.delayed ? "delayed" : "on-time";
    if (record.timestamp) item.lastSubmittedAt = record.timestamp;
    result.set(name, item);
    return result;
  }, new Map()).values()].sort((a, b) => Number(b.status === "delayed") - Number(a.status === "delayed") || a.name.localeCompare(b.name));
}

function tomorrowPlanCategory(header) {
  const text = projectText(header);
  const match = text.match(/^manpower\s+(.+?)\s*&\s*planned\s*work/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function tomorrowPlanComparableSite(value) {
  const text = projectText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bfarm\s+house\b/g, "farmhouse")
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(/\s+/g, "");
  const siteAliases = {
    farmhouse: "serenitymeadowsfarmhouse",
    serenitymeadowsfarm: "serenitymeadowsfarmhouse",
    serenitymeadowsfarmhouse: "serenitymeadowsfarmhouse",
    gharana: "gharana",
    sgharana: "gharana",
    sheetalgharana: "gharana",
  };
  return siteAliases[compact] || text;
}

function tomorrowPlanComparableTrade(value) {
  const text = projectText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(/\s+/g, "");
  const tradeAliases = {
    ac: "ac",
    aircondition: "ac",
    airconditioning: "ac",
    airconditioner: "ac",
    airconditioners: "ac",
  };
  return tradeAliases[compact] || compact;
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
  const hasDateText = /\b(?:planned|plan|dated|date|created|updated|submitted)\s+(?:on|for|at)?\b/i.test(raw);
  const hasDateValue = /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}\b/i.test(raw);
  if (hasDateText && hasDateValue) return { raw: "", plannedManpower: null, work: "" };
  const numberOnly = raw.match(/^(\d+(?:\.\d+)?)$/);
  if (numberOnly) {
    const plannedManpower = Number(numberOnly[1]);
    if (Number.isInteger(plannedManpower) && plannedManpower >= 1900 && plannedManpower <= 2100) {
      return { raw: "", plannedManpower: null, work: "" };
    }
    return { raw, plannedManpower: Number.isFinite(plannedManpower) ? plannedManpower : null, work: "" };
  }
  const patterns = [
    /^(\d+(?:\.\d+)?)\s*(?:[-_:,]|person|persons?|worker|workers?|labou?r)?\s*(.*)$/i,
    /(?:total|work\s*person|person|worker|labou?r)\s*[-:=]?\s*(\d+(?:\.\d+)?)\s*,?\s*(.*)$/i,
    /^(.*?)\s*(?:[-_:,])?\s*(\d+(?:\.\d+)?)\s*(?:person|persons?|worker|workers?|labou?r|civil|mason|masons|carpenter|carpenters|plumber|plumbers|painter|painters|electrician|electricians|fabricator|fabricators|polisher|polishers|labour|labours|labor|labors)?\s*[,.;:]?\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const trailingNumberPattern = pattern.source.startsWith("^(.*?)");
    const plannedManpower = Number(trailingNumberPattern ? match[2] : match[1]);
    if (Number.isInteger(plannedManpower) && plannedManpower >= 1900 && plannedManpower <= 2100 && (hasDateText || hasDateValue)) {
      return { raw: "", plannedManpower: null, work: "" };
    }
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
    timelinessBySubmitter: [],
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

    const sheetDates = new Map();

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex] || [];
      const timestamp = dmrCell(values, rowIndex, timestampIndex);
      const submittedDate = parseGoogleTimestampDate(timestamp);
      const submittedAt = parseGoogleTimestampParts(timestamp);
      const rowPlanDate = submittedDate ? addDaysToDateKey(submittedDate, 1) : "";
      if (!rowPlanDate) continue;
      if (!sheetDates.has(rowPlanDate)) {
        sheetDates.set(rowPlanDate, {
          name: sheet.name,
          date: rowPlanDate,
          submittedDate,
          firstResponseRow: rowIndex + 1,
        });
      }
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
          submissionMinutes: submittedAt?.minutes,
          timeliness: submittedAt?.minutes !== null && submittedAt?.minutes !== undefined && submittedAt.minutes <= 690 ? "on-time" : "delayed",
          plannedForDate: rowPlanDate,
          submittedBy,
          site,
          category: column.category,
          plannedManpower: parsed.plannedManpower,
          work: parsed.work,
          raw: parsed.raw,
        });
      }
    }
    planSheets.push(...sheetDates.values());
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
    timelinessBySubmitter: tomorrowPlanTimeliness(records),
  };
}

async function readDmrTomorrowPlansForDates(dateKeys = []) {
  const spreadsheetId = DEFAULT_DMR_TOMORROW_PLAN_SPREADSHEET_ID;
  const targetDates = new Set(dateKeys.map(dmrDateKey).filter(Boolean));
  const result = new Map();
  if (!spreadsheetId || !targetDates.size) return result;

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

    const sheetDates = new Map();
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex] || [];
      const timestamp = dmrCell(values, rowIndex, timestampIndex);
      const submittedDate = parseGoogleTimestampDate(timestamp);
      const submittedAt = parseGoogleTimestampParts(timestamp);
      const rowPlanDate = submittedDate ? addDaysToDateKey(submittedDate, 1) : "";
      if (!rowPlanDate || !targetDates.has(rowPlanDate)) continue;
      if (!sheetDates.has(rowPlanDate)) {
        sheetDates.set(rowPlanDate, {
          name: sheet.name,
          date: rowPlanDate,
          submittedDate,
          firstResponseRow: rowIndex + 1,
        });
      }
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
          submissionMinutes: submittedAt?.minutes,
          timeliness: submittedAt?.minutes !== null && submittedAt?.minutes !== undefined && submittedAt.minutes <= 690 ? "on-time" : "delayed",
          plannedForDate: rowPlanDate,
          submittedBy,
          site,
          category: column.category,
          plannedManpower: parsed.plannedManpower,
          work: parsed.work,
          raw: parsed.raw,
        });
      }
    }
    planSheets.push(...sheetDates.values());
  }

  const normalizedRecords = mergeTomorrowPlanRecords(canonicalizeTomorrowPlanSites(allRecords));
  for (const date of targetDates) {
    const records = normalizedRecords.filter((record) => record.plannedForDate === date);
    const selectedSheets = planSheets.filter((sheet) => sheet.date === date);
    const summaryDraft = summarizeTomorrowPlan(records);
    result.set(date, {
      spreadsheetId,
      sheetName: selectedSheets.map((sheet) => sheet.name).join(", ") || "",
      requestedDate: date,
      selectedDate: date,
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
      timelinessBySubmitter: tomorrowPlanTimeliness(records),
    });
  }
  return result;
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
  const actualsForDate = (targetDate) => dmrActualsForPlan(parsedTabs.find((tab) => tab.date === targetDate)?.records || []);
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
    todayPlan: todayPlan ? { ...todayPlan, label: "Today's Plan", actuals: actualsForDate(date) } : { ...emptyDmrTomorrowPlan({ date, label: "Today's Plan" }), actuals: actualsForDate(date) },
    tomorrowPlan: tomorrowPlan ? { ...tomorrowPlan, label: "Tomorrow's Plan", actuals: actualsForDate(addDaysToDateKey(date, 1) || date) } : { ...emptyDmrTomorrowPlan({ date: addDaysToDateKey(date, 1) || date, label: "Tomorrow's Plan" }), actuals: actualsForDate(addDaysToDateKey(date, 1) || date) },
  };
}

function dmrDateRange(startDate, endDate) {
  const start = dmrDateKey(startDate);
  const end = dmrDateKey(endDate);
  if (!start || !end || start > end) throw new Error("Choose a valid report date range");
  const dates = [];
  for (let cursor = start; cursor && cursor <= end && dates.length < 370; cursor = addDaysToDateKey(cursor, 1)) {
    dates.push(cursor);
  }
  return { start, end, dates };
}

function sumDmrBreakdown(records = [], field) {
  return dmrBreakdown(records, field).map((item) => ({
    ...item,
    progress: item.planned ? Math.round((item.actual / item.planned) * 100) : item.actual ? 100 : 0,
  }));
}

function dmrReportProgress(planned, actual) {
  const plannedValue = Number(planned) || 0;
  const actualValue = Number(actual) || 0;
  return plannedValue ? Math.round((actualValue / plannedValue) * 100) : actualValue ? 100 : 0;
}

function dmrReportVariance(planned, actual) {
  return (Number(actual) || 0) - (Number(planned) || 0);
}

const DMR_PLAN_SUMMARY_CACHE_VERSION = "ceo-daily-summary-v3";
const DMR_DAILY_PDF_LAYOUT_VERSION = "single-masthead-inline-summary-v11-force-plan-cache";

function comparablePlanText(value = "") {
  const text = projectText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bfarm\s+house\b/g, "farmhouse")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(/\s+/g, "");
  const siteAliases = {
    farmhouse: "serenitymeadowsfarmhouse",
    serenitymeadowsfarm: "serenitymeadowsfarmhouse",
    serenitymeadowsfarmhouse: "serenitymeadowsfarmhouse",
    gharana: "gharana",
    sgharana: "gharana",
    sheetalgharana: "gharana",
  };
  return siteAliases[compact] || text;
}

function comparableTradeText(value = "") {
  const text = comparablePlanText(value);
  const compact = text.replace(/\s+/g, "");
  const tradeAliases = {
    ac: "ac",
    aircondition: "ac",
    airconditioning: "ac",
    airconditioner: "ac",
    airconditioners: "ac",
  };
  return tradeAliases[compact] || compact;
}

function buildDmrPlanSummaryPayload(plan = {}) {
  const planned = Number(plan?.summary?.plannedManpower) || 0;
  const actual = Number(plan?.actuals?.actualManpower) || 0;
  const progress = dmrReportProgress(planned, actual);
  const siteActuals = new Map((plan?.actuals?.siteBreakdown || []).map((item) => [comparablePlanText(item.site), Number(item.actual) || 0]));
  const tradeActuals = new Map((plan?.actuals?.tradeSiteBreakdown || []).map((item) => [`${comparablePlanText(item.site)}|${comparableTradeText(item.trade)}`, Number(item.actual) || 0]));
  const sites = [...(plan?.records || []).reduce((result, record) => {
    const site = projectText(record.site) || "Unassigned site";
    const item = result.get(site) || { site, planned: 0, actual: 0, variance: 0, records: 0 };
    item.planned += Number(record.plannedManpower) || 0;
    item.records += 1;
    result.set(site, item);
    return result;
  }, new Map()).values()].map((item) => {
    const actualValue = siteActuals.get(comparablePlanText(item.site)) || 0;
    return { ...item, actual: actualValue, variance: actualValue - item.planned, progress: dmrReportProgress(item.planned, actualValue) };
  }).sort((a, b) => a.variance - b.variance || b.planned - a.planned);
  const trades = [...(plan?.records || []).reduce((result, record) => {
    const site = projectText(record.site) || "Unassigned site";
    const trade = projectText(record.category) || "General";
    const key = `${site}|${trade}`;
    const item = result.get(key) || { site, trade, planned: 0, actual: 0, variance: 0, records: 0, workSamples: [] };
    item.planned += Number(record.plannedManpower) || 0;
    item.records += 1;
    if (record.work && item.workSamples.length < 2) item.workSamples.push(projectText(record.work).slice(0, 180));
    result.set(key, item);
    return result;
  }, new Map()).values()].map((item) => {
    const actualValue = tradeActuals.get(`${comparablePlanText(item.site)}|${comparableTradeText(item.trade)}`) || 0;
    return { ...item, actual: actualValue, variance: actualValue - item.planned, progress: dmrReportProgress(item.planned, actualValue) };
  }).sort((a, b) => a.variance - b.variance || b.planned - a.planned);

  return {
    date: plan?.selectedDate || plan?.requestedDate || "",
    planned,
    actual,
    variance: actual - planned,
    progress,
    records: plan?.summary?.records || 0,
    workItems: plan?.summary?.workItems || 0,
    sitesCount: plan?.summary?.sites || sites.length,
    categoriesCount: plan?.summary?.categories || 0,
    attentionSites: sites.filter((item) => item.actual < item.planned).slice(0, 8),
    goodSites: sites.filter((item) => item.planned > 0 && item.actual >= item.planned).sort((a, b) => b.variance - a.variance || b.planned - a.planned).slice(0, 8),
    topSites: sites.slice().sort((a, b) => b.planned - a.planned).slice(0, 8),
    attentionTrades: trades.filter((item) => item.actual < item.planned).slice(0, 10),
    goodTrades: trades.filter((item) => item.planned > 0 && item.actual >= item.planned).sort((a, b) => b.variance - a.variance || b.planned - a.planned).slice(0, 10),
    topTrades: trades.slice().sort((a, b) => b.planned - a.planned).slice(0, 10),
  };
}

function buildDmrExecutiveSummaryPayload(dashboard = {}) {
  const plan = buildDmrPlanSummaryPayload(dashboard.todayPlan);
  const today = dashboard.today || {};
  return {
    ...plan,
    dmr: {
      date: dashboard.date || plan.date,
      totals: today.totals || {},
      siteBreakdown: today.siteBreakdown || [],
      records: today.records || [],
      equipment: today.equipment || [],
      materials: today.materials || [],
      notes: today.notes || [],
      staffAttendance: today.staffAttendance || [],
    },
  };
}

function fallbackDmrPlanSummary(payload) {
  const shortfall = Math.max(0, -payload.variance);
  const surplus = Math.max(0, payload.variance);
  const attentionNames = payload.attentionSites.slice(0, 3).map((item) => `${item.site} (${item.actual}/${item.planned})`);
  const topTradeNames = payload.topTrades.slice(0, 3).map((item) => `${item.trade} at ${item.site}`);
  const summary = payload.planned
    ? `Today's plan is ${payload.progress}% complete with ${payload.actual}/${payload.planned} actual manpower reported across ${payload.sitesCount} site${payload.sitesCount === 1 ? "" : "s"}.`
    : "No planned manpower is available for today's plan yet.";
  const issues = [];
  if (shortfall) issues.push(`${shortfall} workers below plan; ${attentionNames.join(", ") || "site actuals require review"}.`);
  const attendance = payload.dmr?.staffAttendance || [];
  const absent = attendance.filter((item) => projectText(item.status).toLowerCase() === "a").length;
  const pending = attendance.filter((item) => !["p", "a", "l"].includes(projectText(item.status).toLowerCase())).length;
  if (absent) issues.push(`${absent} staff member${absent === 1 ? " is" : "s are"} absent.`);
  if (pending) issues.push(`${pending} attendance update${pending === 1 ? " is" : "s are"} pending.`);
  const issueLines = issues.length ? issues.slice(0, 3) : ["No major issues reported."];
  const actionLines = shortfall
    ? [`Review manpower gaps at ${attentionNames.map((item) => item.replace(/ \(.+\)$/, "")).join(", ") || "underperforming sites"}.`, "Resolve the largest trade shortfalls before the next shift.", "Confirm pending DMR and attendance updates."]
    : ["Maintain current manpower deployment.", "Confirm all DMR and attendance updates are complete.", "Monitor priority trades through the next reporting cycle."];
  return {
    provider: "rules",
    model: null,
    progress: payload.progress,
    text: [
      "Overall Status:",
      summary,
      "",
      "Executive Summary:",
      `${shortfall ? `Manpower is ${shortfall} below plan.` : `Manpower is meeting plan${surplus ? ` with a surplus of ${surplus}` : ""}.`} ${topTradeNames.length ? `Key work areas are ${topTradeNames.join(", ")}.` : "No trade-level work was reported."}`,
      "",
      "Issues:",
      ...issueLines.map((item) => `• ${item}`),
      "",
      "Priority Actions:",
      ...actionLines.map((item) => `• ${item}`),
    ].join("\n"),
  };
}

async function generateDmrPlanAiSummary(payload) {
  const fallback = fallbackDmrPlanSummary(payload);
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!anthropicKey) return fallback;
  const system = `You are an Executive Project Analyst preparing a CEO Daily Summary.

Analyze the complete Daily DMR data and generate a concise executive summary.

Rules:
- Maximum 120 words.
- Use simple business language.
- Do NOT repeat tables or raw data.
- Focus only on insights that matter to management.
- Mention overall project status first.
- Highlight major achievements.
- Mention any risks, delays, shortages, missing updates, attendance issues, or other problems ONLY if they exist.
- If there are no significant issues, explicitly state "No major issues reported."
- Mention any sites or trades that require immediate management attention.
- Do not speculate or invent information.
- Base every statement only on the provided DMR data.

Return the response in exactly this format:

Overall Status:
<One short sentence summarizing the day's overall execution.>

Executive Summary:
<2–4 concise sentences explaining the key insights, progress, and overall performance.>

Issues:
• Issue 1
• Issue 2
• Issue 3

If there are no issues, write:
Issues:
• No major issues reported.

Priority Actions:
• Action 1
• Action 2
• Action 3

Keep the response crisp, professional, and suitable for a CEO who should understand the day's situation within 20 seconds.`;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: 420,
      system,
      messages: [{ role: "user", content: `Complete Daily DMR JSON:\n${JSON.stringify(payload)}` }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Claude request failed");
  const text = (data.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n").trim();
  return { provider: "claude", model: data.model, progress: payload.progress, text: text || fallback.text };
}

function dmrPlanSummarySignature(payload) {
  return crypto.createHash("sha256").update(JSON.stringify({ version: DMR_PLAN_SUMMARY_CACHE_VERSION, payload })).digest("hex");
}

function dmrDailyPdfSignature({ dashboard, planPayload }) {
  return crypto.createHash("sha256").update(JSON.stringify({
    version: DMR_DAILY_PDF_LAYOUT_VERSION,
    planPayload,
    todayPlanRecords: dashboard?.todayPlan?.records || [],
    records: dashboard?.today?.records || [],
    attendance: dashboard?.today?.staffAttendance || [],
  })).digest("hex");
}

function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function getCachedDmrPlanSummary(date, payload, signature = dmrPlanSummarySignature(payload)) {
  const cachePath = dmrAiSummaryCachePath(date);
  const cached = readJsonFileSafe(cachePath);
  if (cached?.signature === signature && cached?.insight?.text) {
    return { ...cached, cacheStatus: "hit" };
  }
  let insight;
  try {
    insight = await generateDmrPlanAiSummary(payload);
  } catch (error) {
    console.error("DMR Today plan AI summary error:", error);
    insight = { ...fallbackDmrPlanSummary(payload), provider: "error", model: null, error: error.message };
  }
  const next = {
    date,
    signature,
    generatedAt: new Date().toISOString(),
    summary: payload,
    insight,
  };
  fs.writeFileSync(cachePath, JSON.stringify(next, null, 2));
  return { ...next, cacheStatus: "miss" };
}

async function buildDmrReport({ startDate, endDate, sections = [] } = {}) {
  const spreadsheetId = getActiveDmrSpreadsheetId();
  const { start, end, dates } = dmrDateRange(startDate, endDate);
  const selectedSections = new Set(sections.length ? sections : ["summary", "siteManpower", "agencyManpower", "tradeSiteManpower", "tradeComments", "attendance", "equipment", "materials", "notes", "dailyProgress"]);
  const sheets = await fetchRawSheetValues(spreadsheetId);
  const planMap = await readDmrTomorrowPlansForDates(dates);
  const parsedTabs = sheets
    .map((sheet) => {
      const tabDate = dmrDateFromTabName(sheet.name, Number(start.slice(0, 4)) || new Date().getFullYear());
      if (!tabDate || tabDate < start || tabDate > end) return null;
      const parsed = parseDmrSheetValues({ values: sheet.values || [], sheetName: sheet.name, dateKey: tabDate });
      return { ...parsed, sheetName: sheet.name, date: tabDate };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const allRecords = parsedTabs.flatMap((tab) => (tab.records || []).map((record) => ({ ...record, date: tab.date, sheetName: tab.sheetName })));
  const allEquipment = parsedTabs.flatMap((tab) => (tab.equipment || []).filter((item) => item.site || item.details || item.quantity).map((item) => ({ ...item, date: tab.date, sheetName: tab.sheetName })));
  const allMaterials = parsedTabs.flatMap((tab) => (tab.materials || []).filter((item) => item.site || item.details || item.unit || item.quantity).map((item) => ({ ...item, date: tab.date, sheetName: tab.sheetName })));
  const allNotes = parsedTabs.flatMap((tab) => (tab.notes || []).filter((item) => item.note).map((item) => ({ ...item, date: tab.date, sheetName: tab.sheetName })));
  const filledTradeKeys = new Set(allRecords
    .filter((record) => record.actualFilled)
    .map((record) => `${record.date}|${tomorrowPlanComparableSite(record.site)}|${tomorrowPlanComparableTrade(record.agency)}`));
  const filledTradeActuals = allRecords.reduce((result, record) => {
    if (!record.actualFilled) return result;
    const key = `${record.date}|${tomorrowPlanComparableSite(record.site)}|${tomorrowPlanComparableTrade(record.agency)}`;
    result.set(key, (result.get(key) || 0) + (Number(record.actual) || 0));
    return result;
  }, new Map());
  const tradeComments = [...dates.reduce((result, date) => {
    const plan = planMap.get(date);
    for (const record of plan?.records || []) {
      const comment = projectText(record.work || record.raw);
      if (!comment) continue;
      const site = projectText(record.site) || "Unassigned site";
      const trade = projectText(record.category) || "General";
      const filledKey = `${date}|${tomorrowPlanComparableSite(site)}|${tomorrowPlanComparableTrade(trade)}`;
      if (!filledTradeKeys.has(filledKey)) continue;
      const key = `${tomorrowPlanComparableSite(site)}|${tomorrowPlanComparableTrade(trade)}`;
      const current = result.get(key) || { site, trade, comments: [], submittedBy: [], plannedManpower: 0, actualManpower: filledTradeActuals.get(filledKey) || 0 };
      if (!current.comments.some((item) => item.toLowerCase() === comment.toLowerCase())) current.comments.push(comment);
      const submitter = projectText(record.submittedBy);
      if (submitter && !current.submittedBy.includes(submitter)) current.submittedBy.push(submitter);
      current.plannedManpower += Number(record.plannedManpower) || 0;
      result.set(key, current);
    }
    return result;
  }, new Map()).values()].sort((a, b) => a.site.localeCompare(b.site) || a.trade.localeCompare(b.trade));
  const allAttendance = parsedTabs.flatMap((tab) => (tab.staffAttendance || []).map((item) => ({ ...item, date: tab.date, sheetName: tab.sheetName })));
  const actualsByDate = new Map(parsedTabs.map((tab) => [tab.date, dmrActualsForPlan(tab.records || [])]));
  const plannedTotal = dates.reduce((sum, date) => sum + (Number(planMap.get(date)?.summary?.plannedManpower) || 0), 0);
  const actualTotal = dates.reduce((sum, date) => sum + (Number(actualsByDate.get(date)?.actualManpower) || 0), 0);
  const totals = {
    planned: plannedTotal,
    actual: actualTotal,
    variance: dmrReportVariance(plannedTotal, actualTotal),
    records: allRecords.length,
    filled: allRecords.filter((record) => Number(record.actual) || Number(record.planned)).length,
    missing: 0,
  };
  const progress = dmrReportProgress(totals.planned, totals.actual);
  const attendanceSummary = allAttendance.reduce((result, item) => {
    const status = projectText(item.status).toLowerCase();
    if (status === "p") result.present += 1;
    else if (status === "a") result.absent += 1;
    else if (status === "l") result.leave += 1;
    else result.pending += 1;
    result.total += 1;
    return result;
  }, { total: 0, present: 0, absent: 0, leave: 0, pending: 0 });
  const attendanceByDate = [...allAttendance.reduce((result, item) => {
    const date = item.date || "No date";
    const current = result.get(date) || { date, present: [], absent: [], leave: [], pending: [], total: 0 };
    const name = projectText(item.name) || "Unnamed";
    const status = projectText(item.status).toLowerCase();
    if (status === "p") current.present.push(name);
    else if (status === "a") current.absent.push(name);
    else if (status === "l") current.leave.push(name);
    else current.pending.push(name);
    current.total += 1;
    result.set(date, current);
    return result;
  }, new Map()).values()].sort((a, b) => a.date.localeCompare(b.date));
  const dailyProgress = dates.map((date) => {
    const tab = parsedTabs.find((item) => item.date === date);
    const plan = planMap.get(date);
    const actuals = actualsByDate.get(date) || dmrActualsForPlan([]);
    const dayPlanned = Number(plan?.summary?.plannedManpower) || 0;
    const dayActual = Number(actuals.actualManpower) || 0;
    return {
      date,
      sheetName: [plan?.sheetName, tab?.sheetName].filter(Boolean).join(" / "),
      planned: dayPlanned,
      actual: dayActual,
      variance: dmrReportVariance(dayPlanned, dayActual),
      progress: dmrReportProgress(dayPlanned, dayActual),
      records: plan?.summary?.records || 0,
      hasData: Boolean(dayPlanned || dayActual || plan?.summary?.records || tab),
      status: dayPlanned || dayActual || plan?.summary?.records || tab ? "Data available" : "No data provided for this date",
      attendance: (tab?.staffAttendance || []).reduce((result, item) => {
        const status = projectText(item.status).toLowerCase();
        if (status === "p") result.present += 1;
        else if (status === "a") result.absent += 1;
        else if (status === "l") result.leave += 1;
        else result.pending += 1;
        return result;
      }, { present: 0, absent: 0, leave: 0, pending: 0 }),
    };
  });
  const siteManpower = [...dates.reduce((result, date) => {
    const plan = planMap.get(date);
    const actuals = actualsByDate.get(date) || dmrActualsForPlan([]);
    for (const item of plan?.siteBreakdown || []) {
      const key = tomorrowPlanComparableSite(item.label);
      const current = result.get(key) || { label: item.label || "Unassigned site", planned: 0, actual: 0, variance: 0, progress: 0, records: 0 };
      current.planned += Number(item.plannedManpower) || 0;
      current.records += Number(item.records) || 0;
      if (!current.label || current.label === "Unassigned site") current.label = item.label;
      result.set(key, current);
    }
    for (const item of actuals.siteBreakdown || []) {
      const key = tomorrowPlanComparableSite(item.site);
      const current = result.get(key) || { label: item.site || "Unassigned site", planned: 0, actual: 0, variance: 0, progress: 0, records: 0 };
      current.actual += Number(item.actual) || 0;
      result.set(key, current);
    }
    return result;
  }, new Map()).values()]
    .map((item) => ({ ...item, variance: dmrReportVariance(item.planned, item.actual), progress: dmrReportProgress(item.planned, item.actual) }))
    .sort((a, b) => b.planned - a.planned || b.actual - a.actual || a.label.localeCompare(b.label));
  const agencyManpower = [...dates.reduce((result, date) => {
    const plan = planMap.get(date);
    for (const item of plan?.categoryBreakdown || []) {
      const label = item.label || "General";
      const key = projectText(label).toLowerCase();
      const current = result.get(key) || { label, planned: 0, actual: 0, variance: 0, progress: 0, records: 0 };
      current.planned += Number(item.plannedManpower) || 0;
      current.records += Number(item.records) || 0;
      result.set(key, current);
    }
    return result;
  }, new Map()).values()];
  for (const item of dmrBreakdown(allRecords, "agency")) {
    const key = projectText(item.label).toLowerCase();
    const current = agencyManpower.find((agency) => projectText(agency.label).toLowerCase() === key);
    if (current) current.actual += Number(item.actual) || 0;
    else agencyManpower.push({ label: item.label, planned: 0, actual: Number(item.actual) || 0, variance: 0, progress: 0, records: 0 });
  }
  const finalAgencyManpower = agencyManpower
    .map((item) => ({ ...item, variance: dmrReportVariance(item.planned, item.actual), progress: dmrReportProgress(item.planned, item.actual) }))
    .sort((a, b) => b.planned - a.planned || b.actual - a.actual || a.label.localeCompare(b.label));
  const reportSiteLabels = new Map();
  const reportTradeLabels = new Map();
  for (const tab of parsedTabs) {
    for (const site of tab.sites || []) {
      const label = projectText(site) || "Unassigned site";
      reportSiteLabels.set(tomorrowPlanComparableSite(label), label);
    }
    for (const trade of tab.agencies || []) {
      const label = projectText(trade) || "General";
      reportTradeLabels.set(tomorrowPlanComparableTrade(label), label);
    }
  }
  for (const date of dates) {
    const plan = planMap.get(date);
    const actuals = actualsByDate.get(date) || dmrActualsForPlan([]);
    for (const item of plan?.siteBreakdown || []) {
      const label = projectText(item.label) || "Unassigned site";
      reportSiteLabels.set(tomorrowPlanComparableSite(label), label);
    }
    for (const item of actuals.siteBreakdown || []) {
      const label = projectText(item.site) || "Unassigned site";
      reportSiteLabels.set(tomorrowPlanComparableSite(label), label);
    }
    for (const item of plan?.categoryBreakdown || []) {
      const label = projectText(item.label) || "General";
      reportTradeLabels.set(tomorrowPlanComparableTrade(label), label);
    }
    for (const item of actuals.tradeSiteBreakdown || []) {
      const label = projectText(item.trade) || "General";
      reportTradeLabels.set(tomorrowPlanComparableTrade(label), label);
    }
  }
  const tradeSiteManpowerMap = new Map();
  for (const [siteKey, site] of reportSiteLabels.entries()) {
    for (const [tradeKey, trade] of reportTradeLabels.entries()) {
      tradeSiteManpowerMap.set(`${siteKey}|${tradeKey}`, { site, trade, planned: 0, actual: 0, variance: 0, progress: 0, rows: 0 });
    }
  }
  dates.reduce((result, date) => {
    const plan = planMap.get(date);
    const actuals = actualsByDate.get(date) || dmrActualsForPlan([]);
    for (const record of plan?.records || []) {
      const site = projectText(record.site) || "Unassigned site";
      const trade = projectText(record.category) || "General";
      const key = `${tomorrowPlanComparableSite(site)}|${tomorrowPlanComparableTrade(trade)}`;
      const current = result.get(key) || { site, trade, planned: 0, actual: 0, variance: 0, progress: 0, rows: 0 };
      current.planned += Number(record.plannedManpower) || 0;
      current.rows += 1;
      result.set(key, current);
    }
    for (const item of actuals.tradeSiteBreakdown || []) {
      const site = projectText(item.site) || "Unassigned site";
      const trade = projectText(item.trade) || "General";
      const key = `${tomorrowPlanComparableSite(site)}|${tomorrowPlanComparableTrade(trade)}`;
      const current = result.get(key) || { site, trade, planned: 0, actual: 0, variance: 0, progress: 0, rows: 0 };
      current.actual += Number(item.actual) || 0;
      result.set(key, current);
    }
    return result;
  }, tradeSiteManpowerMap);
  const tradeSiteManpower = [...tradeSiteManpowerMap.values()]
    .map((item) => ({ ...item, variance: dmrReportVariance(item.planned, item.actual), progress: dmrReportProgress(item.planned, item.actual) }))
    .sort((a, b) => a.site.localeCompare(b.site) || b.planned - a.planned || b.actual - a.actual || a.trade.localeCompare(b.trade));
  const tradeSiteManpowerByDateMap = new Map();
  for (const [siteKey, site] of reportSiteLabels.entries()) {
    for (const [tradeKey, trade] of reportTradeLabels.entries()) {
      for (const date of dates) {
        tradeSiteManpowerByDateMap.set(`${siteKey}|${tradeKey}|${date}`, { site, trade, date, planned: 0, actual: 0, variance: 0, progress: 0 });
      }
    }
  }
  for (const date of dates) {
    const plan = planMap.get(date);
    const actuals = actualsByDate.get(date) || dmrActualsForPlan([]);
    for (const record of plan?.records || []) {
      const site = projectText(record.site) || "Unassigned site";
      const trade = projectText(record.category) || "General";
      const key = `${tomorrowPlanComparableSite(site)}|${tomorrowPlanComparableTrade(trade)}|${date}`;
      const current = tradeSiteManpowerByDateMap.get(key) || { site, trade, date, planned: 0, actual: 0, variance: 0, progress: 0 };
      current.planned += Number(record.plannedManpower) || 0;
      tradeSiteManpowerByDateMap.set(key, current);
    }
    for (const item of actuals.tradeSiteBreakdown || []) {
      const site = projectText(item.site) || "Unassigned site";
      const trade = projectText(item.trade) || "General";
      const key = `${tomorrowPlanComparableSite(site)}|${tomorrowPlanComparableTrade(trade)}|${date}`;
      const current = tradeSiteManpowerByDateMap.get(key) || { site, trade, date, planned: 0, actual: 0, variance: 0, progress: 0 };
      current.actual += Number(item.actual) || 0;
      tradeSiteManpowerByDateMap.set(key, current);
    }
  }
  const tradeSiteManpowerByDate = [];
  const sortedTradeSiteKeys = [...tradeSiteManpowerMap.keys()].sort((a, b) => {
    const first = tradeSiteManpowerMap.get(a);
    const second = tradeSiteManpowerMap.get(b);
    return first.site.localeCompare(second.site) || first.trade.localeCompare(second.trade);
  });
  for (const key of sortedTradeSiteKeys) {
    const [siteKey, tradeKey] = key.split("|");
    const total = tradeSiteManpowerMap.get(key) || { site: reportSiteLabels.get(siteKey) || "Unassigned site", trade: reportTradeLabels.get(tradeKey) || "General", planned: 0, actual: 0 };
    for (const date of dates) {
      const row = tradeSiteManpowerByDateMap.get(`${siteKey}|${tradeKey}|${date}`) || { site: total.site, trade: total.trade, date, planned: 0, actual: 0 };
      tradeSiteManpowerByDate.push({
        ...row,
        variance: dmrReportVariance(row.planned, row.actual),
        progress: dmrReportProgress(row.planned, row.actual),
        rowType: "date",
      });
    }
    const averagePlanned = dates.length ? Number((total.planned / dates.length).toFixed(1)) : 0;
    const averageActual = dates.length ? Number((total.actual / dates.length).toFixed(1)) : 0;
    tradeSiteManpowerByDate.push({
      site: total.site,
      trade: total.trade,
      date: "Average",
      planned: averagePlanned,
      actual: averageActual,
      variance: Number((averageActual - averagePlanned).toFixed(1)),
      progress: dmrReportProgress(averagePlanned, averageActual),
      rowType: "average",
    });
  }
  const siteLabels = new Set([...siteManpower.map((item) => item.label), ...allRecords.map((record) => record.site)].filter(Boolean));
  const agencyLabels = new Set([...finalAgencyManpower.map((item) => item.label), ...allRecords.map((record) => record.agency)].filter(Boolean));

  return {
    startDate: start,
    endDate: end,
    requestedDates: dates.length,
    dateKeys: dates,
    availableDates: parsedTabs.map((tab) => tab.date),
    generatedAt: new Date().toISOString(),
    sections: [...selectedSections],
    summary: {
      ...totals,
      progress,
      datesWithData: dailyProgress.filter((item) => item.hasData).length,
      datesWithoutData: dailyProgress.filter((item) => !item.hasData).map((item) => item.date),
      sites: siteLabels.size,
      agencies: agencyLabels.size,
      equipment: allEquipment.length,
      materials: allMaterials.length,
      notes: allNotes.length,
      attendance: attendanceSummary,
    },
    siteManpower: selectedSections.has("siteManpower") ? siteManpower : [],
    agencyManpower: selectedSections.has("agencyManpower") ? finalAgencyManpower : [],
    tradeSiteManpower: selectedSections.has("tradeSiteManpower") ? tradeSiteManpower : [],
    tradeSiteManpowerByDate: selectedSections.has("tradeSiteManpower") ? tradeSiteManpowerByDate : [],
    tradeComments: selectedSections.has("tradeComments") ? tradeComments : [],
    dailyProgress: selectedSections.has("dailyProgress") ? dailyProgress : [],
    attendance: selectedSections.has("attendance") ? { summary: attendanceSummary, rows: allAttendance, byDate: attendanceByDate } : { summary: attendanceSummary, rows: [], byDate: [] },
    equipment: selectedSections.has("equipment") ? allEquipment : [],
    materials: selectedSections.has("materials") ? allMaterials : [],
    notes: selectedSections.has("notes") ? allNotes : [],
  };
}

function dmrPdfDateLabel(value) {
  const date = new Date(`${dmrDateKey(value) || istDateKey(new Date())}T00:00:00`);
  if (Number.isNaN(date.getTime())) return projectText(value) || "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function dmrPdfSafe(value, fallback = "-") {
  const text = projectText(value);
  return text || fallback;
}

function dmrPdfFilename(dateKey) {
  return `dmr-ceo-report-${dmrDateKey(dateKey) || istDateKey(new Date())}.pdf`;
}

function dmrPdfPath(dateKey) {
  return path.join(dmrPdfDir, dmrPdfFilename(dateKey));
}

function dmrPdfMetaPath(dateKey) {
  return path.join(dmrPdfDir, `${dmrDateKey(dateKey) || istDateKey(new Date())}.meta.json`);
}

function dmrAiSummaryCachePath(dateKey) {
  return path.join(dmrAiCacheDir, `today-plan-summary-${dmrDateKey(dateKey) || istDateKey(new Date())}.json`);
}

function dmrPdfStatusColor(planned, actual) {
  const plannedValue = Number(planned) || 0;
  const actualValue = Number(actual) || 0;
  if (!plannedValue && !actualValue) return "#8f8f88";
  return actualValue >= plannedValue ? "#0f9f6e" : "#ef3038";
}

function dmrPdfAddPageIfNeeded(doc, neededHeight = 80) {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function dmrPdfCanAddPage(doc) {
  return doc.bufferedPageRange().count < 2;
}

function dmrPdfAddPageIfNeededLimited(doc, neededHeight = 80) {
  if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) return true;
  if (!dmrPdfCanAddPage(doc)) return false;
  doc.addPage();
  return true;
}

const dmrPdfFonts = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
};

function registerDmrPdfFonts(doc) {
  const geistFontPath = path.join(__dirname, "..", "frontend", "src", "app", "font", "satre.ttf");
  if (!fs.existsSync(geistFontPath)) return;
  try {
    doc.registerFont("DmrGeist", geistFontPath);
    dmrPdfFonts.regular = "DmrGeist";
    dmrPdfFonts.bold = "DmrGeist";
  } catch (error) {
    console.warn("Could not register DMR PDF font:", error.message);
  }
}

function employeePdfRangeLabel(range = {}) {
  if (range.from === range.to) return dmrPdfDateLabel(range.from);
  return `${dmrPdfDateLabel(range.from)} - ${dmrPdfDateLabel(range.to)}`;
}

function employeePdfEnsureSpace(doc, height, onNewPage) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
  if (onNewPage) onNewPage();
}

function employeePdfReportHeader(doc, report, continued = false) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const top = doc.y;
  doc.roundedRect(left, top, width, 76, 14).fill("#f4f8f5").stroke("#cfe5da");
  doc.fillColor("#0f6b49").font(dmrPdfFonts.bold).fontSize(8).text(continued ? "EMPLOYEE SUBMISSION - CONTINUED" : "EMPLOYEE SUBMISSION", left + 18, top + 13);
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(17).text(projectText(report.employeeName) || "Employee", left + 18, top + 30, { width: width - 250, height: 23 });
  doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8).text(projectText(report.department) || "No department", left + 18, top + 55, { width: width - 250, height: 12 });
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(11).text(dmrPdfDateLabel(report.reportDate), left + width - 210, top + 23, { width: 190, align: "right", height: 16 });
  const submitted = report.submittedAt ? new Date(report.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not available";
  doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(7.5).text(`Submitted ${submitted}`, left + width - 250, top + 48, { width: 230, align: "right", height: 12 });
  doc.y = top + 88;
}

function employeePdfTaskCard(doc, item, index, theme, onNewPage) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const description = projectText(item.description) || "No description provided.";
  doc.font(dmrPdfFonts.regular).fontSize(9);
  const descriptionHeight = doc.heightOfString(description, { width: width - 72, lineGap: 1.5 });
  const cardHeight = Math.max(70, 49 + descriptionHeight);
  employeePdfEnsureSpace(doc, cardHeight + 10, onNewPage);
  const top = doc.y;
  doc.roundedRect(left, top, width, cardHeight, 12).fill(theme.fill).stroke(theme.stroke);
  doc.circle(left + 20, top + 21, 10).fill(theme.color);
  doc.fillColor("#ffffff").font(dmrPdfFonts.bold).fontSize(8).text(String(index + 1), left + 14, top + 17, { width: 12, align: "center", lineBreak: false });
  const category = projectText(item.category) || "General";
  const site = projectText(item.site) || "No site";
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(10.5).text(category, left + 40, top + 12, { width: width - 300, height: 15 });
  doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8).text(site, left + 40, top + 29, { width: width - 300, height: 12 });
  const metadata = [projectText(item.status), projectText(item.involvement)].filter(Boolean).join(" | ");
  if (metadata) doc.fillColor(theme.color).font(dmrPdfFonts.bold).fontSize(8).text(metadata, left + width - 250, top + 14, { width: 230, align: "right", height: 15 });
  doc.fillColor("#26312c").font(dmrPdfFonts.regular).fontSize(9).text(description, left + 40, top + 47, { width: width - 60, lineGap: 1.5 });
  doc.y = top + cardHeight + 10;
}

function employeePdfInfoCard(doc, title, text, theme, onNewPage) {
  const value = projectText(text);
  if (!value) return;
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  doc.font(dmrPdfFonts.regular).fontSize(9);
  const textHeight = doc.heightOfString(value, { width: width - 36, lineGap: 1.5 });
  const height = Math.max(62, textHeight + 38);
  employeePdfEnsureSpace(doc, height + 10, onNewPage);
  const top = doc.y;
  doc.roundedRect(left, top, width, height, 12).fill(theme.fill).stroke(theme.stroke);
  doc.fillColor(theme.color).font(dmrPdfFonts.bold).fontSize(8).text(title.toUpperCase(), left + 18, top + 12);
  doc.fillColor("#26312c").font(dmrPdfFonts.regular).fontSize(9).text(value, left + 18, top + 31, { width: width - 36, lineGap: 1.5 });
  doc.y = top + height + 10;
}

function employeePdfCompactItem(item, type) {
  if (type === "management") {
    const question = projectText(item.label) || "Management question";
    const answer = projectText(item.answer) || "No answer provided.";
    return { type, text: `${question}: ${answer}` };
  }
  const site = projectText(item.site) || "No site";
  const category = projectText(item.category) || (type === "waiting" ? "Follow-up" : "General");
  const metadata = [projectText(item.status), projectText(item.involvement)].filter(Boolean).join(" / ");
  const description = projectText(item.description) || "No description provided.";
  return { type, text: `${site} - ${category}${metadata ? ` (${metadata})` : ""}: ${description}` };
}

function employeePdfCompactCardHeight(doc, segment, width) {
  const textWidth = width - 36;
  let height = 58;
  let previousType = "";
  segment.items.forEach((item) => {
    if (item.type !== previousType) height += 17;
    doc.font(dmrPdfFonts.regular).fontSize(7.4);
    height += Math.max(13, doc.heightOfString(item.text, { width: textWidth, lineGap: 1 })) + 4;
    previousType = item.type;
  });
  if (segment.includeFooter) {
    height += 26;
    if (projectText(segment.report.note)) {
      doc.font(dmrPdfFonts.regular).fontSize(7.3);
      height += Math.max(13, doc.heightOfString(projectText(segment.report.note), { width: textWidth - 28, lineGap: 1 })) + 7;
    }
  }
  return Math.max(92, Math.ceil(height) + 8);
}

function employeePdfCompactSegments(doc, report, width, maxHeight) {
  let completed = sanitizeEmployeeTaskItems(report.taskItems);
  if (!completed.length && projectText(report.taskDescription)) completed = [{ site: report.site, category: report.taskType, status: report.taskStatus, involvement: report.involvement, description: report.taskDescription }];
  let waiting = sanitizeEmployeeTaskItems(report.waitingTaskItems);
  if (!waiting.length && projectText(report.waitingTaskDescription)) waiting = [{ site: report.site, category: "Waiting / tomorrow plan", involvement: report.involvement, description: report.waitingTaskDescription }];
  const management = Array.isArray(report.managementAnswers) ? report.managementAnswers : [];
  const items = [
    ...completed.map((item) => employeePdfCompactItem(item, "completed")),
    ...waiting.map((item) => employeePdfCompactItem(item, "waiting")),
    ...management.map((item) => employeePdfCompactItem(item, "management")),
  ];
  const segments = [];
  let current = [];
  items.forEach((item) => {
    const candidate = { report, items: [...current, item], includeFooter: false };
    if (current.length && employeePdfCompactCardHeight(doc, candidate, width) > maxHeight) {
      segments.push({ report, items: current, includeFooter: false });
      current = [item];
    } else {
      current.push(item);
    }
  });
  segments.push({ report, items: current, includeFooter: true });
  return segments;
}

function employeePdfDrawCompactCard(doc, segment, x, y, width, index) {
  const height = employeePdfCompactCardHeight(doc, segment, width);
  const report = segment.report;
  doc.roundedRect(x, y, width, height, 12).fill("#ffffff").stroke("#dce6df");
  doc.roundedRect(x, y, width, 50, 12).fill("#f1f8f4");
  doc.rect(x, y + 38, width, 12).fill("#f1f8f4");
  doc.circle(x + 19, y + 19, 9).fill("#0f9f6e");
  doc.fillColor("#ffffff").font(dmrPdfFonts.bold).fontSize(7.5).text(String(index + 1), x + 13, y + 15.5, { width: 12, align: "center", lineBreak: false });
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(11.5).text(projectText(report.employeeName) || "Employee", x + 35, y + 11, { width: width - 155, height: 16 });
  doc.fillColor("#69716c").font(dmrPdfFonts.regular).fontSize(7.2).text(projectText(report.department) || "No department", x + 35, y + 29, { width: width - 155, height: 11 });
  doc.fillColor("#0f6b49").font(dmrPdfFonts.bold).fontSize(8).text(dmrPdfDateLabel(report.reportDate), x + width - 112, y + 13, { width: 96, align: "right", height: 12 });
  doc.fillColor("#7c817e").font(dmrPdfFonts.regular).fontSize(6.6).text(segment.includeFooter ? "Submission" : "Continued", x + width - 112, y + 29, { width: 96, align: "right", height: 10 });

  let cursor = y + 59;
  let previousType = "";
  segment.items.forEach((item) => {
    if (item.type !== previousType) {
      const color = item.type === "completed" ? "#0f9f6e" : item.type === "management" ? "#1268b3" : "#b66a00";
      const label = item.type === "completed" ? "COMPLETED WORK" : item.type === "management" ? "MANAGEMENT ANSWERS" : "WAITING / FOLLOW-UP";
      doc.fillColor(color).font(dmrPdfFonts.bold).fontSize(7.2).text(label, x + 14, cursor, { width: width - 28, height: 11 });
      cursor += 17;
    }
    doc.font(dmrPdfFonts.regular).fontSize(7.4);
    const itemHeight = Math.max(13, doc.heightOfString(item.text, { width: width - 36, lineGap: 1 }));
    doc.circle(x + 17, cursor + 3.8, 1.5).fill(item.type === "completed" ? "#0f9f6e" : item.type === "management" ? "#1268b3" : "#b66a00");
    doc.fillColor("#303733").text(item.text, x + 23, cursor, { width: width - 36, lineGap: 1 });
    cursor += itemHeight + 4;
    previousType = item.type;
  });
  if (segment.includeFooter) {
    doc.moveTo(x + 14, cursor + 2).lineTo(x + width - 14, cursor + 2).strokeColor("#e6ebe8").stroke();
    cursor += 10;
    doc.fillColor(report.tomorrowPlanTick ? "#0f9f6e" : "#b66a00").font(dmrPdfFonts.bold).fontSize(7.2).text(`TOMORROW PLAN: ${report.tomorrowPlanTick ? "CONFIRMED" : "NOT CONFIRMED"}`, x + 14, cursor, { width: width - 28, height: 11 });
    cursor += 16;
    const note = projectText(report.note);
    if (note) {
      doc.fillColor("#1268b3").font(dmrPdfFonts.bold).fontSize(7.2).text("NOTE", x + 14, cursor, { width: 28, height: 11 });
      doc.fillColor("#46514b").font(dmrPdfFonts.regular).fontSize(7.3).text(note, x + 44, cursor, { width: width - 58, lineGap: 1 });
    }
  }
  doc.roundedRect(x, y, width, height, 12).lineWidth(0.8).strokeColor("#dce6df").stroke();
  return height;
}

function generateEmployeeDailyReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true, info: { Title: `Employee Daily Report ${report.range.from} to ${report.range.to}`, Author: "UIPL Docs" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerDmrPdfFonts(doc);

    const left = doc.page.margins.left;
    const pageWidth = doc.page.width - left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const submissions = Array.isArray(report.employeeReports) ? report.employeeReports : [];
    let pageNumber = 1;
    const addSubmissionsHeader = () => {
      doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(18).text("Employee submissions", left, 44, { width: pageWidth * 0.55, height: 24 });
      doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8).text(`${employeePdfRangeLabel(report.range)} | Page ${pageNumber}`, left + pageWidth - 190, 50, { width: 190, align: "right", height: 12 });
      doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8).text(`${report.summary.responses || 0} submissions · ${report.summary.employees || 0} employees · ${report.summary.questions || 0} management questions`, left, 68, { width: pageWidth, height: 12 });
      doc.y = 86;
    };
    const addSubmissionPage = () => {
      doc.addPage();
      pageNumber += 1;
      addSubmissionsHeader();
    };
    const drawSummaryPage = () => {
      const completedTasks = submissions.reduce((sum, item) => sum + sanitizeEmployeeTaskItems(item.taskItems).length, 0);
      const waitingTasks = submissions.reduce((sum, item) => sum + sanitizeEmployeeTaskItems(item.waitingTaskItems).length, 0);
      const categories = new Map();
      const dates = new Map();
      submissions.forEach((submission) => {
        const dateLabel = dmrPdfDateLabel(submission.reportDate);
        dates.set(dateLabel, {
          reports: (dates.get(dateLabel)?.reports || 0) + 1,
          completed: (dates.get(dateLabel)?.completed || 0) + sanitizeEmployeeTaskItems(submission.taskItems).length,
        });
        [...sanitizeEmployeeTaskItems(submission.taskItems).map((task) => ({ ...task, waiting: false })), ...sanitizeEmployeeTaskItems(submission.waitingTaskItems).map((task) => ({ ...task, waiting: true }))].forEach((task) => {
          const label = projectText(task.category) || "General";
          const current = categories.get(label) || { label, completed: 0, waiting: 0 };
          if (task.waiting) current.waiting += 1;
          else current.completed += 1;
          categories.set(label, current);
        });
      });
      doc.fillColor("#0f6b49").font(dmrPdfFonts.bold).fontSize(8).text("EMPLOYEE DAILY REPORT", left, 42, { characterSpacing: 1.2 });
      doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(26).text("Employee work summary", left, 68, { width: pageWidth * 0.68, height: 34 });
      doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(9).text(`${employeePdfRangeLabel(report.range)} | Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, left, 104, { width: pageWidth * 0.68, height: 13 });
      const metrics = [
        ["Reports", submissions.length, "#eaf4ff", "#1268b3"],
        ["Employees", report.summary.employees || 0, "#e9fbf2", "#0f9f6e"],
        ["Completed tasks", completedTasks, "#eef8e8", "#4b9b16"],
        ["Waiting tasks", waitingTasks, "#fff7df", "#b66a00"],
        ["Departments", report.summary.departments || 0, "#f4efff", "#7651b5"],
        ["Categories", categories.size, "#fff0f0", "#d83b45"],
        ["Not submitted", report.summary.notSubmitted || 0, "#fff0f0", "#d83b45"],
      ];
      const metricGap = 10;
      const metricWidth = (pageWidth - metricGap * (metrics.length - 1)) / metrics.length;
      const metricTop = 142;
      metrics.forEach(([label, value, fill, color], index) => {
        const x = left + index * (metricWidth + metricGap);
        doc.roundedRect(x, metricTop, metricWidth, 70, 12).fill(fill);
        doc.fillColor(color).font(dmrPdfFonts.bold).fontSize(20).text(String(value), x + 14, metricTop + 14, { width: metricWidth - 28, height: 25 });
        doc.fillColor("#5f665f").font(dmrPdfFonts.regular).fontSize(7.5).text(label, x + 14, metricTop + 45, { width: metricWidth - 28, height: 12 });
      });
      const summaryTop = 238;
      const summaryGap = 12;
      const summaryWidth = (pageWidth - summaryGap * 2) / 3;
      const summaryCards = [
        {
          title: "Daily submissions",
          items: [...dates.entries()].map(([label, value]) => `${label}: ${value.reports} reports, ${value.completed} completed`).slice(0, 6),
        },
        {
          title: "Departments",
          items: (report.departments || []).map((item) => `${item.label}: ${item.reports} reports`).slice(0, 6),
        },
        {
          title: "Task categories",
          items: [...categories.values()].sort((a, b) => (b.completed + b.waiting) - (a.completed + a.waiting)).map((item) => `${item.label}: ${item.completed} completed, ${item.waiting} waiting`).slice(0, 8),
        },
      ];
      summaryCards.forEach((card, index) => {
        const x = left + index * (summaryWidth + summaryGap);
        doc.roundedRect(x, summaryTop, summaryWidth, 190, 14).fill("#f8faf8").stroke("#e1e8e3");
        doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(13).text(card.title, x + 16, summaryTop + 16, { width: summaryWidth - 32, height: 18 });
        let cursor = summaryTop + 45;
        (card.items.length ? card.items : ["No data submitted."]).forEach((item) => {
          doc.circle(x + 18, cursor + 4, 1.7).fill("#0f9f6e");
          doc.fillColor("#26312c").font(dmrPdfFonts.regular).fontSize(8.2).text(item, x + 26, cursor, { width: summaryWidth - 42, lineGap: 1 });
          cursor += Math.max(14, doc.heightOfString(item, { width: summaryWidth - 42, lineGap: 1 })) + 7;
        });
      });
      const missingGroups = Array.isArray(report.notSubmitted) ? report.notSubmitted.filter((group) => group.count > 0) : [];
      const missingTop = 444;
      const missingHeight = 82;
      doc.roundedRect(left, missingTop, pageWidth, missingHeight, 14).fill(missingGroups.length ? "#fff7f7" : "#f8faf8").stroke("#e1e8e3");
      doc.fillColor(missingGroups.length ? "#d83b45" : "#0f9f6e").font(dmrPdfFonts.bold).fontSize(9).text("NOT SUBMITTED", left + 16, missingTop + 14, { width: pageWidth - 32, height: 12 });
      const missingLines = missingGroups.length
        ? missingGroups.map((group) => {
          const names = (group.employees || []).map((employee) => employee.displayName || employee.username).filter(Boolean);
          const visible = names.slice(0, 18).join(", ");
          const remaining = names.length > 18 ? `, +${names.length - 18} more` : "";
          return `${dmrPdfDateLabel(group.date)}: ${visible || "No names available"}${remaining}`;
        })
        : ["Everyone submitted for the selected date range."];
      let missingCursor = missingTop + 34;
      missingLines.slice(0, 4).forEach((line) => {
        doc.circle(left + 18, missingCursor + 4, 1.7).fill(missingGroups.length ? "#d83b45" : "#0f9f6e");
        doc.fillColor("#26312c").font(dmrPdfFonts.regular).fontSize(8.2).text(line, left + 26, missingCursor, { width: pageWidth - 42, lineGap: 1 });
        missingCursor += Math.max(13, doc.heightOfString(line, { width: pageWidth - 42, lineGap: 1 })) + 5;
      });
      if (missingLines.length > 4) {
        doc.fillColor("#6f756f").font(dmrPdfFonts.bold).fontSize(7.8).text(`+${missingLines.length - 4} more dates with pending submissions`, left + 26, missingCursor, { width: pageWidth - 42, height: 10 });
      }
    };
    drawSummaryPage();
    if (!submissions.length) {
      doc.end();
      return;
    }
    addSubmissionPage();
    const columnGap = 12;
    const cardWidth = (pageWidth - columnGap) / 2;
    const columnX = [left, left + cardWidth + columnGap];
    let columnY = [doc.y, doc.y];
    const maxSegmentHeight = pageBottom - doc.y - 10;
    submissions.forEach((submission, index) => {
      const segments = employeePdfCompactSegments(doc, submission, cardWidth, maxSegmentHeight);
      segments.forEach((segment) => {
        const height = employeePdfCompactCardHeight(doc, segment, cardWidth);
        let column = columnY[0] <= columnY[1] ? 0 : 1;
        if (columnY[column] + height > pageBottom) {
          const other = column === 0 ? 1 : 0;
          if (columnY[other] + height <= pageBottom) {
            column = other;
          } else {
            addSubmissionPage();
            columnY = [doc.y, doc.y];
            column = 0;
          }
        }
        const drawnHeight = employeePdfDrawCompactCard(doc, segment, columnX[column], columnY[column], cardWidth, index);
        columnY[column] += drawnHeight + 12;
      });
    });
    doc.end();
    return;
    const addHeader = (continued = false) => {
      doc.fillColor("#0f6b49").font(dmrPdfFonts.bold).fontSize(8).text(continued ? "EMPLOYEE MANAGEMENT REPORT - CONTINUED" : "EMPLOYEE MANAGEMENT REPORT", left, 32, { characterSpacing: 1.2 });
      doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(7.5).text(employeePdfRangeLabel(report.range), left + pageWidth - 190, 34, { width: 190, align: "right" });
      doc.x = left;
      doc.y = 56;
    };
    const ensureSpace = (height) => {
      if (doc.y + height <= pageBottom) return;
      doc.addPage();
      addHeader(true);
    };
    const bulletList = (items = []) => (items.length ? items : ["No specific update reported."]);
    const insightCardHeight = (items, width) => {
      let height = 54;
      doc.font(dmrPdfFonts.regular).fontSize(8);
      bulletList(items).slice(0, 5).forEach((item) => {
        height += Math.max(15, doc.heightOfString(projectText(item), { width: width - 41, lineGap: 1.2 })) + 9;
      });
      return Math.max(160, Math.ceil(height) + 12);
    };
    const drawInsightCard = (title, items, fill, color, x, y, width, height) => {
      doc.roundedRect(x, y, width, height, 16).fill(fill).stroke("#dce6df");
      doc.fillColor(color).font(dmrPdfFonts.bold).fontSize(8).text(title.toUpperCase(), x + 16, y + 14, { width: width - 32, height: 12 });
      let cursor = y + 36;
      bulletList(items).slice(0, 5).forEach((item) => {
        doc.font(dmrPdfFonts.regular).fontSize(8);
        const itemHeight = Math.max(15, doc.heightOfString(projectText(item), { width: width - 41, lineGap: 1.2 }));
        doc.circle(x + 18, cursor + 4, 1.7).fill(color);
        doc.fillColor("#26312c").text(projectText(item), x + 25, cursor, { width: width - 41, lineGap: 1.2 });
        cursor += itemHeight + 9;
      });
    };
    const drawFocusCard = (label, value, fill, color, x, y, width, height = 82) => {
      doc.roundedRect(x, y, width, height, 15).fill(fill).stroke("#dce6df");
      doc.fillColor(color).font(dmrPdfFonts.bold).fontSize(7.8).text(label.toUpperCase(), x + 14, y + 13, { width: width - 28, height: 11 });
      doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(10).text(projectText(value) || "No update submitted.", x + 14, y + 32, { width: width - 28, height: height - 42, lineGap: 1.1 });
    };
    const signalCardHeight = (items, width) => {
      let height = 50;
      doc.font(dmrPdfFonts.regular).fontSize(7.7);
      bulletList(items).slice(0, 4).forEach((item) => {
        height += Math.max(14, doc.heightOfString(projectText(item), { width: width - 38, lineGap: 1 })) + 7;
      });
      return Math.max(118, Math.ceil(height) + 10);
    };
    const drawSignalCard = (title, items, fill, color, x, y, width, height) => {
      doc.roundedRect(x, y, width, height, 14).fill(fill).stroke("#dce6df");
      doc.fillColor(color).font(dmrPdfFonts.bold).fontSize(7.8).text(title.toUpperCase(), x + 14, y + 13, { width: width - 28, height: 11 });
      let cursor = y + 34;
      bulletList(items).slice(0, 4).forEach((item) => {
        doc.font(dmrPdfFonts.regular).fontSize(7.7);
        const text = projectText(item);
        const itemHeight = Math.max(14, doc.heightOfString(text, { width: width - 38, lineGap: 1 }));
        doc.circle(x + 16, cursor + 4, 1.5).fill(color);
        doc.fillColor("#26312c").text(text, x + 23, cursor, { width: width - 38, lineGap: 1 });
        cursor += itemHeight + 7;
      });
    };
    const drawSignalGrid = (cards) => {
      const cardGap = 10;
      const cardWidth = (pageWidth - cardGap * 2) / 3;
      for (let index = 0; index < cards.length; index += 3) {
        const row = cards.slice(index, index + 3);
        const rowHeight = Math.max(...row.map((card) => signalCardHeight(card.items || [], cardWidth)));
        ensureSpace(rowHeight + 14);
        const rowTop = doc.y;
        row.forEach((card, column) => {
          drawSignalCard(card.title, card.items, card.fill, card.color, left + column * (cardWidth + cardGap), rowTop, cardWidth, rowHeight);
        });
        doc.y = rowTop + rowHeight + 14;
      }
    };
    const drawProjectDashboard = (projects = []) => {
      const cards = Array.isArray(projects) && projects.length
        ? projects
        : [{ name: "Project risk", status: "Needs clarification", summary: "No clear project-level risk was identified from the submitted management answers." }];
      const cardGap = 10;
      const cardWidth = (pageWidth - cardGap * 2) / 3;
      const visibleCards = cards.slice(0, 6);
      for (let index = 0; index < visibleCards.length; index += 3) {
        const row = visibleCards.slice(index, index + 3);
        let rowHeight = 118;
        row.forEach((card) => {
          const text = [
            card.status,
            card.progress ? `Progress: ${card.progress}` : "",
            card.criticalPending ? `Pending: ${card.criticalPending}` : "",
            card.owner ? `Owner: ${card.owner}` : "",
            card.target ? `Target: ${card.target}` : "",
            card.summary,
            card.nextAction ? `Next: ${card.nextAction}` : "",
            card.source ? `Source: ${card.source}` : "",
          ].filter(Boolean).join("\n");
          doc.font(dmrPdfFonts.regular).fontSize(7.7);
          rowHeight = Math.max(rowHeight, 50 + doc.heightOfString(text, { width: cardWidth - 28, lineGap: 1.1 }));
        });
        ensureSpace(rowHeight + 14);
        const rowTop = doc.y;
        row.forEach((card, column) => {
          const x = left + column * (cardWidth + cardGap);
          const riskText = `${card.status || ""} ${card.summary || ""} ${card.criticalPending || ""}`.toLowerCase();
          const color = /delay|risk|block|pending|stuck|issue|critical|approval|not|no /.test(riskText)
            ? "#d83b45"
            : /complete|done|approved|received|finalized|confirmed/.test(riskText)
              ? "#0f9f6e"
              : "#b66a00";
          const fill = color === "#d83b45" ? "#fff0f0" : color === "#0f9f6e" ? "#e9fbf2" : "#fff7df";
          doc.roundedRect(x, rowTop, cardWidth, rowHeight, 14).fill(fill).stroke("#dce6df");
          doc.circle(x + 18, rowTop + 18, 7).fill(color);
          doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(12).text(projectText(card.name) || "Project", x + 34, rowTop + 10, { width: cardWidth - 48, height: 17 });
          let cursor = rowTop + 34;
          const rows = [
            card.status ? { label: "Status", value: card.status, bold: true } : null,
            card.progress ? { label: "Progress", value: card.progress } : null,
            card.criticalPending ? { label: "Critical pending", value: card.criticalPending } : null,
            card.owner ? { label: "Owner", value: card.owner } : null,
            card.target ? { label: "Target", value: card.target } : null,
            card.summary ? { label: "Insight", value: card.summary } : null,
            card.nextAction ? { label: "Next action", value: card.nextAction } : null,
            card.source ? { label: "Source", value: card.source } : null,
          ].filter(Boolean);
          rows.forEach((rowItem) => {
            doc.font(rowItem.bold ? dmrPdfFonts.bold : dmrPdfFonts.regular).fontSize(7.7);
            const line = `${rowItem.label}: ${rowItem.value}`;
            const lineHeight = Math.max(11, doc.heightOfString(line, { width: cardWidth - 28, lineGap: 1.1 }));
            doc.fillColor(rowItem.label === "Source" ? "#6f756f" : "#26312c").text(line, x + 14, cursor, { width: cardWidth - 28, lineGap: 1.1 });
            cursor += lineHeight + 3;
          });
        });
        doc.y = rowTop + rowHeight + 14;
      }
    };

    addHeader(false);
    doc.y = 72;
    const analysis = report.analysis || {};
    const focus = analysis.ceoFocus || {};
    doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(24).text("CEO Dashboard", left, doc.y, { width: pageWidth * 0.58, lineGap: 1 });
    doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(9).text("Projects, money, team blockers, procurement, and CEO decisions from management answers.", left, doc.y + 4, { width: pageWidth * 0.58 });
    doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8).text(`${employeePdfRangeLabel(report.range)} | Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, left + pageWidth - 245, 80, { width: 245, align: "right" });
    doc.y += 34;

    const overviewHeight = 76;
    const overviewTop = doc.y;
    doc.roundedRect(left, overviewTop, pageWidth, overviewHeight, 16).fill("#f4f8f5").stroke("#d7e6dd");
    doc.fillColor("#0f6b49").font(dmrPdfFonts.bold).fontSize(8).text("CEO OPERATING STATUS", left + 18, overviewTop + 13);
    doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(13.5).text(projectText(analysis.overallStatus) || "No executive analysis available.", left + 18, overviewTop + 32, { width: pageWidth * 0.56, height: 30 });
    doc.fillColor("#d83b45").font(dmrPdfFonts.bold).fontSize(8).text("MOST AT RISK TODAY", left + pageWidth * 0.61, overviewTop + 13, { width: pageWidth * 0.34 });
    doc.fillColor("#171714").font(dmrPdfFonts.regular).fontSize(9).text(projectText(analysis.projectMostAtRiskTomorrow) || "No risk identified.", left + pageWidth * 0.61, overviewTop + 32, { width: pageWidth * 0.34, height: 32, lineGap: 1 });
    doc.y = overviewTop + overviewHeight + 12;

    const focusGap = 10;
    const focusWidth = (pageWidth - focusGap * 3) / 4;
    const focusTop = doc.y;
    drawFocusCard("Project most at risk", focus.projectRisk || analysis.projectMostAtRiskTomorrow, "#fff0f0", "#d83b45", left, focusTop, focusWidth);
    drawFocusCard("Payment focus", focus.paymentFocus, "#fff7df", "#b66a00", left + focusWidth + focusGap, focusTop, focusWidth);
    drawFocusCard("CEO decision", focus.ceoDecision, "#f4efff", "#7651b5", left + (focusWidth + focusGap) * 2, focusTop, focusWidth);
    drawFocusCard("Must finish today", focus.todayMustFinish, "#eaf4ff", "#1268b3", left + (focusWidth + focusGap) * 3, focusTop, focusWidth);
    doc.y = focusTop + 96;

    ensureSpace(24);
    doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(14).text("Projects", left, doc.y, { width: pageWidth, height: 20 });
    doc.y += 24;
    drawProjectDashboard(analysis.projectCards || []);

    drawSignalGrid([
      { title: "Money", items: analysis.moneyDashboard || analysis.moneySignals || [], fill: "#fff7df", color: "#b66a00" },
      { title: "Team", items: analysis.teamDashboard || analysis.teamSignals || [], fill: "#eef7ff", color: "#1268b3" },
      { title: "Procurement", items: analysis.procurementDashboard || analysis.procurementSignals || [], fill: "#f4efff", color: "#7651b5" },
      { title: "Legal / approvals", items: analysis.legalDashboard || analysis.legalSignals || [], fill: "#f8f7f3", color: "#5f665f" },
      { title: "What moved forward", items: analysis.deliverablesMovedForward || analysis.positiveSignals || [], fill: "#e9fbf2", color: "#0f9f6e" },
      { title: "Support required", items: analysis.supportRequired || analysis.teamSignals || [], fill: "#fff0f0", color: "#d83b45" },
    ]);

    const insightWidth = (pageWidth - 24) / 3;
    const insightHeight = Math.max(
      insightCardHeight(analysis.stuckItems || analysis.keyRisks || [], insightWidth),
      insightCardHeight(analysis.ceoDecisions || analysis.decisionsNeeded || [], insightWidth),
      insightCardHeight(analysis.tomorrowCommitments || analysis.tomorrowPriorities || [], insightWidth),
    );
    ensureSpace(insightHeight + 18);
    const resolvedInsightTop = doc.y;
    drawInsightCard("Stuck / risk", analysis.stuckItems || analysis.keyRisks || [], "#fff0f0", "#d83b45", left, resolvedInsightTop, insightWidth, insightHeight);
    drawInsightCard("CEO decisions", analysis.ceoDecisions || analysis.decisionsNeeded || [], "#fff7df", "#b66a00", left + insightWidth + 12, resolvedInsightTop, insightWidth, insightHeight);
    drawInsightCard("Tomorrow commitments", analysis.tomorrowCommitments || analysis.tomorrowPriorities || [], "#eaf4ff", "#1268b3", left + (insightWidth + 12) * 2, resolvedInsightTop, insightWidth, insightHeight);
    doc.y = resolvedInsightTop + insightHeight + 18;

    if (!(report.executiveAnswers || []).length) {
      ensureSpace(80);
      doc.roundedRect(left, doc.y, pageWidth, 72, 14).fill("#f8faf8").stroke("#e1e8e3");
      doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(10).text("No management question answers were submitted for this date range.", left + 18, doc.y + 26, { width: pageWidth - 36, align: "center" });
    }
    doc.end();
  });
}

function dmrPdfPill(doc, text, x, y, options = {}) {
  const width = options.width || Math.max(72, doc.widthOfString(text) + 22);
  const height = options.height || 24;
  doc.save();
  doc.roundedRect(x, y, width, height, height / 2).fill(options.fill || "#f3f1eb");
  doc.fillColor(options.color || "#171714").fontSize(options.fontSize || 9).font(dmrPdfFonts.bold);
  doc.text(text, x + 11, y + 7, { width: width - 22, lineBreak: false });
  doc.restore();
  return width;
}

function dmrPdfTextRow(doc, columns, y, options = {}) {
  const fill = options.fill || null;
  const height = options.height || 34;
  if (fill) {
    doc.save();
    doc.roundedRect(doc.page.margins.left, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, height, 12).fill(fill);
    doc.restore();
  }
  columns.forEach((column) => {
    doc.fillColor(column.color || options.color || "#171714").font(column.bold ? dmrPdfFonts.bold : dmrPdfFonts.regular).fontSize(column.size || options.size || 9);
    doc.text(column.text, column.x, y + (column.top || 10), { width: column.width, lineGap: 1 });
  });
}

function dmrPdfSectionTitle(doc, title, subtitle) {
  dmrPdfAddPageIfNeeded(doc, 90);
  doc.moveDown(1);
  doc.fillColor("#171714").font("Helvetica-Bold").fontSize(15).text(title);
  if (subtitle) {
    doc.moveDown(0.25);
    doc.fillColor("#807d76").font("Helvetica").fontSize(9).text(subtitle);
  }
  doc.moveDown(0.8);
}

function dmrPdfDrawDailyHeader(doc, dateKey) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;
  const left = doc.page.margins.left;
  const generatedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.rect(left, top, pageWidth, 58).fill("#ffffff").stroke("#ece8df");
  doc.fillColor("#7b7f89").font(dmrPdfFonts.bold).fontSize(7).text("CEO SUMMARY", left, top + 9, { characterSpacing: 1.8 });
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(17).text("Daily DMR report", left, top + 25, { lineBreak: false });
  const titleWidth = doc.widthOfString("Daily DMR report");
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(15).text(dmrPdfDateLabel(dateKey), left + titleWidth + 18, top + 27, { lineBreak: false });
  doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(8).text(`Generated: ${generatedAt}`, left, top + 48, { width: pageWidth, lineBreak: false });
  doc.y = top + 74;
}

function dmrPdfDrawSummary(doc, report, dateKey) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;
  doc.roundedRect(doc.page.margins.left, top, pageWidth, 132, 22).fill("#f7f4ec");
  doc.fillColor("#e76f42").font("Helvetica-Bold").fontSize(8).text("CEO DAILY DMR", doc.page.margins.left + 22, top + 22, { characterSpacing: 2 });
  doc.fillColor("#171714").font("Helvetica-Bold").fontSize(25).text("Daily manpower performance", doc.page.margins.left + 22, top + 42);
  doc.fillColor("#807d76").font("Helvetica").fontSize(10).text(`Report date: ${dmrPdfDateLabel(dateKey)} - Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, doc.page.margins.left + 22, top + 76);
  const scoreColor = dmrPdfStatusColor(report.summary.planned, report.summary.actual);
  doc.roundedRect(doc.page.width - doc.page.margins.right - 146, top + 24, 124, 76, 20).fill(report.summary.actual >= report.summary.planned ? "#e8fbf4" : "#fff0f0");
  doc.fillColor(scoreColor).font("Helvetica-Bold").fontSize(28).text(`${report.summary.progress}%`, doc.page.width - doc.page.margins.right - 126, top + 38, { width: 84, align: "center" });
  doc.fillColor(scoreColor).font("Helvetica").fontSize(8).text("overall progress", doc.page.width - doc.page.margins.right - 126, top + 70, { width: 84, align: "center" });
  doc.y = top + 150;

  const metrics = [
    ["Planned", report.summary.planned, "#171714"],
    ["Actual", report.summary.actual, dmrPdfStatusColor(report.summary.planned, report.summary.actual)],
    ["Variance", `${report.summary.variance >= 0 ? "+" : ""}${report.summary.variance}`, report.summary.variance >= 0 ? "#0f9f6e" : "#ef3038"],
    ["Attendance", `${report.summary.attendance.present}/${report.summary.attendance.total}`, "#171714"],
  ];
  const gap = 8;
  const cardWidth = (pageWidth - gap * (metrics.length - 1)) / metrics.length;
  const y = doc.y;
  metrics.forEach(([label, value, color], index) => {
    const x = doc.page.margins.left + index * (cardWidth + gap);
    doc.roundedRect(x, y, cardWidth, 66, 16).fill("#ffffff").stroke("#eee9df");
    doc.fillColor(color).font("Helvetica-Bold").fontSize(19).text(String(value), x + 15, y + 14, { width: cardWidth - 30 });
    doc.fillColor("#807d76").font("Helvetica").fontSize(8).text(label, x + 15, y + 42, { width: cardWidth - 30 });
  });
  doc.y = y + 82;
}

function dmrPdfPageTitle(doc, title, subtitle) {
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(18).text(title, doc.page.margins.left, doc.y, { align: "left" });
  if (subtitle) {
    doc.moveDown(0.25);
    doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(9).text(subtitle, doc.page.margins.left, doc.y, { align: "left" });
  }
  doc.moveDown(0.8);
}

function dmrPdfDrawAttendance(doc, attendance) {
  const item = attendance?.byDate?.[0] || { present: [], absent: [], leave: [], pending: [], total: 0 };
  dmrPdfPageTitle(doc, "Attendance", "Consolidated staff attendance for the selected DMR day.");
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { label: "Present", names: item.present || [], color: "#0f9f6e" },
    { label: "Absent", names: item.absent || [], color: "#ef3038" },
    { label: "Leave", names: item.leave || [], color: "#b66a00" },
    { label: "Pending", names: item.pending || [], color: "#75716a" },
  ];
  const columnWidth = pageWidth / columns.length;
  let y = doc.y;
  doc.rect(left, y, pageWidth, 34).fill("#f3f1eb");
  columns.forEach((column, index) => {
    doc.fillColor("#5e6a7f").font(dmrPdfFonts.bold).fontSize(10).text(column.label.toUpperCase(), left + index * columnWidth + 12, y + 12, { width: columnWidth - 24, height: 12 });
  });
  y += 34;
  const bodyHeight = 128;
  columns.forEach((column, index) => {
    const x = left + index * columnWidth;
    const names = column.names.join(", ") || "-";
    doc.rect(x, y, columnWidth, bodyHeight).fill(index % 2 ? "#ffffff" : "#faf9f5").stroke("#ece8df");
    doc.fillColor(column.color).font(dmrPdfFonts.bold).fontSize(20).text(`${column.names.length}/${item.total || 0}`, x + 12, y + 14, { width: columnWidth - 24, height: 24 });
    doc.fillColor("#171714").font(dmrPdfFonts.regular).fontSize(10).text(names, x + 12, y + 48, { width: columnWidth - 24, height: 64, ellipsis: true, lineGap: 2 });
  });
  doc.y = y + bodyHeight + 10;
}

function parseDmrExecutiveSummary(text = "") {
  const normalized = projectText(text).replace(/\r/g, "");
  const section = (name, nextName) => {
    const start = normalized.match(new RegExp(`${name}:\\s*`, "i"));
    if (!start) return "";
    const contentStart = (start.index || 0) + start[0].length;
    const remainder = normalized.slice(contentStart);
    const next = nextName ? remainder.search(new RegExp(`\\n\\s*${nextName}:`, "i")) : -1;
    return (next >= 0 ? remainder.slice(0, next) : remainder).trim();
  };
  const clean = (value) => value
    .split("\n")
    .map((line) => line.replace(/^\s*[•*-]\s*/, "").replace(/[–—]/g, "-").trim())
    .filter(Boolean)
    .join(" • ");
  return {
    overall: clean(section("Overall Status", "Executive Summary")),
    executive: clean(section("Executive Summary", "Issues")),
    issues: clean(section("Issues", "Priority Actions")),
    actions: clean(section("Priority Actions")),
  };
}

function dmrPdfQuickLookCards(payload = {}, insight = {}) {
  const parsed = parseDmrExecutiveSummary(insight.text || "");
  const fallback = parseDmrExecutiveSummary(fallbackDmrPlanSummary(payload).text);
  return [
    {
      title: "Overall status",
      text: parsed.overall || fallback.overall,
      fill: "#eaf4ff",
      stroke: "#b9dcff",
      color: "#1268b3",
    },
    {
      title: "Executive summary",
      text: parsed.executive || fallback.executive,
      fill: "#e9fbf2",
      stroke: "#abe8c7",
      color: "#0f9f6e",
    },
    {
      title: "Issues",
      text: parsed.issues || fallback.issues,
      fill: "#fff0f0",
      stroke: "#ffc2c2",
      color: "#df3038",
    },
    {
      title: "Priority actions",
      text: parsed.actions || fallback.actions,
      fill: "#fff7df",
      stroke: "#f3d57d",
      color: "#b66a00",
    },
  ];
}

function dmrPdfCardBulletItems(text = "") {
  const value = projectText(text);
  if (!value) return ["No update provided."];
  const explicitItems = value.split(/\s+•\s+/).map((item) => item.trim()).filter(Boolean);
  if (explicitItems.length > 1) return explicitItems;
  const sentences = value.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((item) => item.trim()).filter(Boolean);
  return sentences.length ? sentences : [value];
}

function dmrPdfDrawTodayPlanSummary(doc, summaryCache) {
  const payload = summaryCache?.summary || {};
  const insight = summaryCache?.insight || {};
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cards = dmrPdfQuickLookCards(payload, insight);
  const gap = 12;
  const cardWidth = (pageWidth - 36 - gap) / 2;
  const textWidth = cardWidth - 38;
  cards.forEach((card) => {
    card.items = dmrPdfCardBulletItems(card.text);
  });
  const cardTextHeights = cards.map((card) => {
    doc.font(dmrPdfFonts.regular).fontSize(7.2);
    return card.items.reduce((height, item, index) => (
      height + doc.heightOfString(item, { width: textWidth, lineGap: 1 }) + (index ? 4 : 0)
    ), 0);
  });
  const rowHeights = [0, 1].map((row) => Math.max(
    70,
    ...cardTextHeights.slice(row * 2, row * 2 + 2).map((height) => Math.ceil(height) + 35),
  ));
  const boxHeight = 82 + rowHeights[0] + gap + rowHeights[1] + 12;
  let top = doc.y + 8;
  if (top + boxHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    top = doc.y;
  }

  doc.roundedRect(left, top, pageWidth, boxHeight, 18).fill("#fbfcfb").stroke("#dce6df");
  doc.fillColor("#0f6b49").font(dmrPdfFonts.bold).fontSize(8).text("CEO DAILY SUMMARY", left + 18, top + 13);
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(16).text("Executive project overview", left + 18, top + 32, { width: pageWidth - 176 });
  doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(8).text("Management insights, current issues, and immediate priorities from today's DMR.", left + 18, top + 54, { width: pageWidth - 176 });

  const progressColor = dmrPdfStatusColor(payload.planned, payload.actual);
  doc.roundedRect(left + pageWidth - 132, top + 18, 104, 58, 16).fill((Number(payload.actual) || 0) >= (Number(payload.planned) || 0) ? "#daf8ea" : "#ffe7e7");
  doc.fillColor(progressColor).font(dmrPdfFonts.bold).fontSize(24).text(`${payload.progress || 0}%`, left + pageWidth - 120, top + 29, { width: 80, align: "center" });
  doc.fillColor(progressColor).font(dmrPdfFonts.regular).fontSize(7).text("day progress", left + pageWidth - 120, top + 56, { width: 80, align: "center" });

  const startX = left + 18;
  const startY = top + 82;
  cards.forEach((card, index) => {
    const row = Math.floor(index / 2);
    const cardHeight = rowHeights[row];
    const x = startX + (index % 2) * (cardWidth + gap);
    const y = startY + (row === 0 ? 0 : rowHeights[0] + gap);
    doc.roundedRect(x, y, cardWidth, cardHeight, 14).fill(card.fill).stroke(card.stroke);
    doc.fillColor(card.color).font(dmrPdfFonts.bold).fontSize(8).text(card.title.toUpperCase(), x + 12, y + 10, { width: cardWidth - 24, height: 10 });
    let itemY = y + 27;
    card.items.forEach((item) => {
      doc.font(dmrPdfFonts.regular).fontSize(7.2);
      const itemHeight = doc.heightOfString(item, { width: textWidth, lineGap: 1 });
      doc.circle(x + 15, itemY + 3.5, 1.7).fill(card.color);
      doc.fillColor("#26312c").text(item, x + 22, itemY, { width: textWidth, lineGap: 1 });
      itemY += itemHeight + 4;
    });
  });
  doc.y = top + boxHeight + 8;
}

function dmrPdfDrawTradeSite(doc, report) {
  const entries = (report.tradeSiteManpowerByDate || [])
    .filter((item) => item.rowType !== "average")
    .filter((item) => (Number(item.planned) || 0) || (Number(item.actual) || 0));

  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const summaryPlanned = entries.reduce((sum, item) => sum + (Number(item.planned) || 0), 0);
  const summaryActual = entries.reduce((sum, item) => sum + (Number(item.actual) || 0), 0);
  const titleTop = doc.y;
  doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(18).text("Trade by site", left, titleTop, { align: "left" });
  doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(9).text("Consolidated planned/actual manpower. Blank cells have no data.", left, titleTop + 27, { align: "left" });
  const kpiX = left + pageWidth - 172;
  const kpiColor = dmrPdfStatusColor(summaryPlanned, summaryActual);
  doc.fillColor("#7b7f89").font(dmrPdfFonts.bold).fontSize(7).text("PLANNED / ACTUAL", kpiX, titleTop + 1, { width: 172, align: "right", characterSpacing: 1.2 });
  const plannedText = String(summaryPlanned);
  const slashText = "/";
  const actualText = String(summaryActual);
  doc.font(dmrPdfFonts.bold).fontSize(24);
  const totalTextWidth = doc.widthOfString(plannedText) + doc.widthOfString(slashText) + doc.widthOfString(actualText);
  let summaryCursor = kpiX + 172 - totalTextWidth;
  doc.fillColor("#171714").text(plannedText, summaryCursor, titleTop + 16, { lineBreak: false });
  summaryCursor += doc.widthOfString(plannedText);
  doc.fillColor("#171714").text(slashText, summaryCursor, titleTop + 16, { lineBreak: false });
  summaryCursor += doc.widthOfString(slashText);
  doc.fillColor(kpiColor).text(actualText, summaryCursor, titleTop + 16, { lineBreak: false });
  doc.y = titleTop + 58;

  if (!entries.length) {
    doc.roundedRect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 52, 14).fill("#f7f4ec");
    doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(10).text("No trade by site manpower was provided for this date.", doc.page.margins.left + 16, doc.y + 18);
    doc.y += 66;
    return;
  }

  const tradeWidth = 118;
  const totalWidth = 60;
  const siteTotals = new Map();
  const tradeTotals = new Map();
  const matrix = new Map();
  for (const item of entries) {
    const site = dmrPdfSafe(item.site, "Unassigned site");
    const trade = dmrPdfSafe(item.trade, "General");
    const planned = Number(item.planned) || 0;
    const actual = Number(item.actual) || 0;
    const siteCurrent = siteTotals.get(site) || { site, planned: 0, actual: 0 };
    siteCurrent.planned += planned;
    siteCurrent.actual += actual;
    siteTotals.set(site, siteCurrent);
    const tradeCurrent = tradeTotals.get(trade) || { trade, planned: 0, actual: 0 };
    tradeCurrent.planned += planned;
    tradeCurrent.actual += actual;
    tradeTotals.set(trade, tradeCurrent);
    matrix.set(`${trade}|${site}`, { planned, actual });
  }
  const sites = [...siteTotals.values()]
    .sort((a, b) => (b.planned + b.actual) - (a.planned + a.actual) || a.site.localeCompare(b.site))
    .slice(0, 8)
    .map((item) => item.site);
  const trades = [...tradeTotals.values()]
    .filter((item) => item.planned || item.actual)
    .sort((a, b) => (b.planned + b.actual) - (a.planned + a.actual) || a.trade.localeCompare(b.trade))
    .map((item) => item.trade);
  const siteWidth = Math.max(56, (pageWidth - tradeWidth - totalWidth) / Math.max(1, sites.length));
  let y = doc.y;
  const bottom = doc.page.height - doc.page.margins.bottom;

  function drawMatrixHeader() {
    doc.rect(left, y, pageWidth, 28).fill("#f3f1eb");
    doc.fillColor("#5e6a7f").font(dmrPdfFonts.bold).fontSize(8).text("TRADE", left + 9, y + 10, { width: tradeWidth - 16, height: 12 });
    sites.forEach((site, index) => {
      doc.fillColor("#5e6a7f").font(dmrPdfFonts.bold).fontSize(site.length > 16 ? 5.4 : 6.6).text(site.toUpperCase(), left + tradeWidth + index * siteWidth + 3, y + 6, { width: siteWidth - 6, height: 18, align: "center" });
    });
    doc.fillColor("#5e6a7f").font(dmrPdfFonts.bold).fontSize(8).text("TOTAL", left + tradeWidth + sites.length * siteWidth + 4, y + 10, { width: totalWidth - 8, height: 12, align: "center" });
    y += 28;
    doc.y = y;
  }

  function drawPair(x, yValue, width, planned, actual) {
    if (!planned && !actual) {
      doc.fillColor("#9b9b94").font(dmrPdfFonts.regular).fontSize(8).text("-", x, yValue, { width, height: 9, align: "center" });
      return;
    }
    const color = dmrPdfStatusColor(planned, actual);
    const plannedText = String(planned);
    const slashText = "/";
    const actualText = String(actual);
    const totalTextWidth = doc.font(dmrPdfFonts.bold).fontSize(8.7).widthOfString(plannedText) + doc.widthOfString(slashText) + doc.widthOfString(actualText);
    let cursor = x + Math.max(0, (width - totalTextWidth) / 2);
    doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(8.7).text(plannedText, cursor, yValue, { lineBreak: false });
    cursor += doc.widthOfString(plannedText);
    doc.fillColor("#171714").text(slashText, cursor, yValue, { lineBreak: false });
    cursor += doc.widthOfString(slashText);
    doc.fillColor(color).text(actualText, cursor, yValue, { lineBreak: false });
  }

  drawMatrixHeader();
  const totalRowHeight = 20;
  const rowHeight = Math.max(14, Math.min(20, Math.floor((bottom - y - totalRowHeight - 20) / Math.max(1, trades.length))));
  const maxRows = Math.max(1, Math.floor((bottom - y - totalRowHeight - 22) / rowHeight));
  const visibleTrades = trades.slice(0, maxRows);
  const hiddenRows = Math.max(0, trades.length - visibleTrades.length);
  visibleTrades.forEach((trade, index) => {
    doc.rect(left, y, pageWidth, rowHeight).fill(index % 2 ? "#ffffff" : "#faf9f5").stroke("#ece8df");
    doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(8.4).text(trade, left + 9, y + Math.max(5, Math.floor((rowHeight - 9) / 2)), { width: tradeWidth - 16, height: 10, ellipsis: true });
    let totalPlanned = 0;
    let totalActual = 0;
    sites.forEach((site, siteIndex) => {
      const cell = matrix.get(`${trade}|${site}`) || { planned: 0, actual: 0 };
      totalPlanned += Number(cell.planned) || 0;
      totalActual += Number(cell.actual) || 0;
      drawPair(left + tradeWidth + siteIndex * siteWidth, y + Math.max(5, Math.floor((rowHeight - 9) / 2)), siteWidth, Number(cell.planned) || 0, Number(cell.actual) || 0);
    });
    drawPair(left + tradeWidth + sites.length * siteWidth, y + Math.max(5, Math.floor((rowHeight - 9) / 2)), totalWidth, totalPlanned, totalActual);
    y += rowHeight;
    doc.y = y;
  });
  if (y + totalRowHeight <= bottom) {
    doc.rect(left, y, pageWidth, totalRowHeight).fill("#f3f1eb").stroke("#e4ded3");
    doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(8.8).text("TOTAL", left + 9, y + 6, { width: tradeWidth - 16, height: 10 });
    let grandPlanned = 0;
    let grandActual = 0;
    sites.forEach((site, siteIndex) => {
      const siteTotal = siteTotals.get(site) || { planned: 0, actual: 0 };
      const planned = Number(siteTotal.planned) || 0;
      const actual = Number(siteTotal.actual) || 0;
      grandPlanned += planned;
      grandActual += actual;
      drawPair(left + tradeWidth + siteIndex * siteWidth, y + 6, siteWidth, planned, actual);
    });
    drawPair(left + tradeWidth + sites.length * siteWidth, y + 6, totalWidth, grandPlanned, grandActual);
    y += totalRowHeight;
    doc.y = y;
  }
  if (hiddenRows > 0 && doc.y + 20 <= doc.page.height - doc.page.margins.bottom) {
    doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(8).text(`${hiddenRows} more trade row${hiddenRows === 1 ? "" : "s"} hidden to keep the PDF within 2 pages.`, left, doc.y + 8);
  }
}

function dmrPdfDrawTradeComments(doc, report, dateKey) {
  const entries = report.tradeComments || [];
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const grouped = [...entries.reduce((result, entry) => {
    const site = projectText(entry.site) || "Unassigned site";
    if (!result.has(site)) result.set(site, []);
    result.get(site).push(entry);
    return result;
  }, new Map()).entries()];

  const startPage = (addPage = false, showTitle = true) => {
    if (addPage) doc.addPage();
    if (showTitle) dmrPdfPageTitle(doc, "Site trade comments", "Submitted work comments with planned and actual manpower, grouped by site.");
  };

  startPage(false);
  if (!grouped.length) {
    doc.roundedRect(left, doc.y, pageWidth, 72, 14).fill("#f7f4ec").stroke("#e7e1d7");
    doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(10).text("No site or trade comments were submitted for this date.", left + 18, doc.y + 26, { width: pageWidth - 36 });
    return;
  }

  const commentWidth = pageWidth - 72;
  grouped.forEach(([site, trades]) => {
    const rows = trades.map((trade) => {
      const comments = (trade.comments || []).filter(Boolean);
      doc.font(dmrPdfFonts.regular).fontSize(9.2);
      const commentsHeight = comments.reduce((height, comment, index) => (
        height + doc.heightOfString(comment, { width: commentWidth, lineGap: 1.5 }) + (index ? 3 : 0)
      ), 0);
      return { trade, comments, rowHeight: Math.max(42, 27 + commentsHeight + 8) };
    });
    let nextRow = 0;
    while (nextRow < rows.length) {
      if (bottom() - doc.y < 92) startPage(true, false);
      const available = bottom() - doc.y;
      const chunkStart = nextRow;
      const chunk = [];
      let cardHeight = 42;
      while (nextRow < rows.length && cardHeight + rows[nextRow].rowHeight <= available) {
        chunk.push(rows[nextRow]);
        cardHeight += rows[nextRow].rowHeight;
        nextRow += 1;
      }
      if (!chunk.length) {
        startPage(true, false);
        continue;
      }

      const cardTop = doc.y;
      doc.roundedRect(left, cardTop, pageWidth, cardHeight, 12).fill("#f7fbf9").stroke("#9dd8bf");
      doc.roundedRect(left, cardTop, pageWidth, 42, 12).fill("#e8f7f0");
      doc.rect(left, cardTop + 30, pageWidth, 12).fill("#e8f7f0");
      doc.fillColor("#087a55").font(dmrPdfFonts.bold).fontSize(13).text(site, left + 18, cardTop + 13, { width: pageWidth - 210, height: 18 });
      const rangeLabel = rows.length === chunk.length
        ? `${rows.length} TRADE${rows.length === 1 ? "" : "S"}`
        : `${chunkStart + 1}-${chunkStart + chunk.length} OF ${rows.length} TRADES`;
      doc.fillColor("#087a55").font(dmrPdfFonts.bold).fontSize(8.5).text(rangeLabel, left + pageWidth - 176, cardTop + 16, { width: 156, align: "right" });

      let rowTop = cardTop + 42;
      chunk.forEach(({ trade, comments, rowHeight }, chunkIndex) => {
        if (chunkIndex) doc.moveTo(left + 18, rowTop).lineTo(left + pageWidth - 18, rowTop).strokeColor("#cfe5da").stroke();
        doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(10).text(projectText(trade.trade) || "General", left + 18, rowTop + 8, { width: pageWidth - 330, height: 15 });
        const metricX = left + pageWidth - 286;
        doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8.3).text("PLANNED", metricX, rowTop + 8, { width: 58, align: "right", lineBreak: false });
        doc.fillColor("#171714").font(dmrPdfFonts.bold).fontSize(9.4).text(String(Number(trade.plannedManpower) || 0), metricX + 62, rowTop + 7, { width: 28, align: "left", lineBreak: false });
        doc.fillColor("#6f756f").font(dmrPdfFonts.regular).fontSize(8.3).text("ACTUAL", metricX + 98, rowTop + 8, { width: 50, align: "right", lineBreak: false });
        doc.fillColor(dmrPdfStatusColor(trade.plannedManpower, trade.actualManpower)).font(dmrPdfFonts.bold).fontSize(9.4).text(String(Number(trade.actualManpower) || 0), metricX + 152, rowTop + 7, { width: 28, align: "left", lineBreak: false });
        const submitters = (trade.submittedBy || []).join(", ");
        if (submitters) doc.fillColor("#807d76").font(dmrPdfFonts.regular).fontSize(7.7).text(`By ${submitters}`, metricX + 184, rowTop + 8, { width: 84, align: "right", height: 13 });

        let commentY = rowTop + 27;
        comments.forEach((comment) => {
          doc.font(dmrPdfFonts.regular).fontSize(9.2);
          const commentHeight = doc.heightOfString(comment, { width: commentWidth, lineGap: 1.5 });
          doc.circle(left + 22, commentY + 4.5, 1.8).fill("#0f9f6e");
          doc.fillColor("#26312c").text(comment, left + 31, commentY, { width: commentWidth, lineGap: 1.5 });
          commentY += commentHeight + 3;
        });
        rowTop += rowHeight;
      });
      doc.roundedRect(left, cardTop, pageWidth, cardHeight, 12).lineWidth(1).strokeColor("#9dd8bf").stroke();
      doc.y = cardTop + cardHeight + 10;
      if (nextRow < rows.length) startPage(true, false);
    }
  });
}

function generateDmrDailyPdfBuffer(report, dateKey, todayPlanSummary = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 32,
      bufferPages: true,
      info: {
        Title: `DMR CEO Report ${dateKey}`,
        Author: "UIPL Docs",
        Subject: "Daily DMR performance report",
      },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    registerDmrPdfFonts(doc);
    dmrPdfDrawDailyHeader(doc, dateKey);
    dmrPdfDrawTradeSite(doc, report);
    doc.addPage();
    dmrPdfDrawAttendance(doc, report.attendance);
    dmrPdfDrawTodayPlanSummary(doc, todayPlanSummary);
    doc.addPage();
    dmrPdfDrawTradeComments(doc, report, dateKey);
    doc.end();
  });
}

async function buildDmrDailyPdf(dateKey, { save = false, knownPayload = null, knownSignature = "", pdfSignature = "" } = {}) {
  const date = dmrDateKey(dateKey) || istDateKey(new Date());
  const report = await buildDmrReport({
    startDate: date,
    endDate: date,
    sections: ["summary", "attendance", "tradeSiteManpower", "tradeComments", "dailyProgress"],
  });
  let payload = knownPayload;
  if (!payload) {
    const dashboard = await readDmrDashboard(date, { ensureToday: false });
    payload = buildDmrExecutiveSummaryPayload(dashboard);
  }
  const signature = knownSignature || dmrPlanSummarySignature(payload);
  const todayPlanSummary = await getCachedDmrPlanSummary(date, payload, signature);
  const buffer = await generateDmrDailyPdfBuffer(report, date, todayPlanSummary);
  if (save) {
    const generatedAt = new Date().toISOString();
    fs.writeFileSync(dmrPdfPath(date), buffer);
    fs.writeFileSync(dmrPdfMetaPath(date), JSON.stringify({ date, layoutVersion: DMR_DAILY_PDF_LAYOUT_VERSION, signature: pdfSignature || signature, summarySignature: signature, generatedAt, validatedAt: generatedAt, summaryGeneratedAt: todayPlanSummary.generatedAt }, null, 2));
  }
  return { date, report, buffer, signature, todayPlanSummary };
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
    const roles = await db.collection("roles").find({}).toArray();
    const roleMap = new Map(roles.map((role) => [String(role._id), role]));
    users = rawUsers.map((user) => ({
      id: String(user._id),
      username: user.username,
      displayName: user.displayName || user.username,
      isSuperAdmin: isEffectiveSuperAdmin(user, roleMap.get(String(user.roleId))),
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
  const roles = await db.collection("roles").find({}).toArray();
  const roleMap = new Map(roles.map((role) => [String(role._id), role]));
  res.json({
    projects: projectDashboardConfig.projects,
    sheets,
    users: users.map((user) => ({
      id: String(user._id),
      displayName: user.displayName || user.username,
      username: user.username,
      isSuperAdmin: isEffectiveSuperAdmin(user, roleMap.get(String(user.roleId))),
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

const MRN_SHEET_NAME = "MRN Form";
const MRN_HEADERS = [
  "MRN No",
  "Timestamp",
  "Name of Project & Site Address",
  "Material Request Date",
  "By when Material is Required",
  "Material Requirement",
  "Issued by ",
  "Lead Time (Usual time to get Material )",
  "Upload Photo of MRN",
  "Email address",
  "Upload Photo of Quotation",
  "Quotation Amount  ",
  "Upload photo of Quotation",
  "Assign To",
  "Status",
  "Krishna PRN Status Updated",
  "Vendor Name",
  "Invoice Date",
  "Remark",
];

const MRN_FIELD_HEADERS = {
  mrnNo: ["MRN No"],
  timestamp: ["Timestamp"],
  projectSite: ["Name of Project & Site Address"],
  materialRequestDate: ["Material Request Date"],
  requiredDate: ["By when Material is Required"],
  materialRequirement: ["Material Requirement"],
  issuedBy: ["Issued by", "Issued by "],
  leadTime: ["Lead Time (Usual time to get Material )", "Lead Time"],
  mrnPhoto: ["Upload Photo of MRN"],
  emailAddress: ["Email Address", "Email address"],
  quotationPhoto: ["Upload Photo of Quotation", "Upload photo of Quatation"],
  quotationAmount: ["Quotation Amount", "Quotation Amount  "],
  assignTo: ["Assign To"],
  status: ["Status"],
  krishnaPrnStatusUpdated: ["Krishna PRN Status Updated"],
  vendorName: ["Vendor Name"],
  invoiceDate: ["Invoice Date"],
  remark: ["Remark"],
};

function normalizeHeaderKey(value = "") {
  return projectText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function mrnFieldForHeader(header = "") {
  const key = normalizeHeaderKey(header);
  for (const [field, aliases] of Object.entries(MRN_FIELD_HEADERS)) {
    if (aliases.some((alias) => normalizeHeaderKey(alias) === key)) return field;
  }
  return "";
}

function normalizedMrnNumber(value = "") {
  const match = projectText(value).match(/^mrn\s*0*(\d+)$/i);
  return match ? `mrn${Number(match[1])}` : "";
}

function isEmailLike(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(projectText(value));
}

function isUrlLike(value = "") {
  return /^https?:\/\//i.test(projectText(value));
}

function isAmountLike(value = "") {
  const text = projectText(value).replace(/,/g, "");
  return text !== "" && /^₹?\s*\d+(\.\d+)?$/.test(text);
}

function buildMrnSheetRow(headers = [], values = {}, existingRow = []) {
  const normalizedHeaders = normalizeMrnHeaders(headers);
  const width = Math.max(normalizedHeaders.length, MRN_HEADERS.length);
  return Array.from({ length: width }, (_, index) => {
    const field = mrnFieldForHeader(normalizedHeaders[index] || MRN_HEADERS[index] || "");
    if (!field) return projectText(existingRow[index]);
    return projectText(values[field]);
  });
}

function normalizeMrnHeaders(rawHeaders = []) {
  const headers = rawHeaders.map((header, index) => projectText(header) || (index === 0 ? "MRN No" : ""));
  const firstHeader = normalizeHeaderKey(headers[0] || "");
  if (firstHeader === normalizeHeaderKey("Timestamp")) return ["MRN No", ...headers];
  return headers;
}

function normalizeMrnRow(row = [], headers = []) {
  const firstHeader = normalizeHeaderKey(headers[0] || "");
  if (firstHeader !== normalizeHeaderKey("MRN No")) return row;
  const firstCell = projectText(row[0]);
  if (!firstCell || /^MRN\s*0*\d+$/i.test(firstCell)) return row;
  return ["", ...row];
}

async function clearManualMrnSerialObstructions(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`${escapeSheetName(MRN_SHEET_NAME)}!A2:A10000`],
    includeGridData: true,
    fields: "sheets(data(startRow,rowData(values(userEnteredValue))))",
  });
  const grid = response.data.sheets?.[0]?.data?.[0];
  const formulaCell = grid?.rowData?.[0]?.values?.[0]?.userEnteredValue?.formulaValue || "";
  if (!/ARRAYFORMULA/i.test(formulaCell)) return 0;
  const startRow = Number(grid?.startRow || 1);
  const ranges = [];
  (grid?.rowData || []).forEach((rowData, index) => {
    const rowNumber = startRow + index + 1;
    const value = rowData.values?.[0]?.userEnteredValue;
    if (rowNumber > 2 && value) ranges.push(`${escapeSheetName(MRN_SHEET_NAME)}!A${rowNumber}`);
  });
  if (!ranges.length) return 0;
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges },
  });
  return ranges.length;
}

function lastMrnDataRow(values = []) {
  for (let index = values.length - 1; index >= 1; index -= 1) {
    const row = values[index] || [];
    if (row.slice(1).some((value) => projectText(value))) return index + 1;
  }
  return 1;
}

async function repairShiftedMrnRows(sheets, spreadsheetId, values = []) {
  const updates = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    const rowNumber = rowIndex + 1;
    const hasMrn = /^MRN\s*0*\d+$/i.test(projectText(row[0]));
    const shiftedLeft = hasMrn && !parseMrnDate(row[1]) && parseMrnDate(row[2]) && parseMrnDate(row[3]);
    if (!shiftedLeft) continue;
    const corrected = [formatMrnTimestamp(new Date()), ...row.slice(1, MRN_HEADERS.length - 1)];
    while (corrected.length < MRN_HEADERS.length - 1) corrected.push("");
    updates.push({
      range: `${escapeSheetName(MRN_SHEET_NAME)}!B${rowNumber}:S${rowNumber}`,
      values: [corrected],
    });
  }
  if (!updates.length) return 0;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates,
    },
  });
  return updates.length;
}

function parseMrnDate(value) {
  const key = projectDateKey(value);
  if (key) return key;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : istDateKey(parsed);
}

function formatMrnTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(",", "");
}

function nextMrnNumber(records = []) {
  const max = records.reduce((highest, record) => {
    const match = projectText(record.mrnNo).match(/MRN\s*0*(\d+)/i);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `MRN${String(max + 1).padStart(2, "0")}`;
}

function mapMrnRows(values = []) {
  const rawHeaders = values[0] || [];
  const headers = normalizeMrnHeaders(rawHeaders);
  const headerMap = headers.reduce((map, header, index) => {
    const key = normalizeHeaderKey(header);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(index);
    return map;
  }, new Map());
  const valueAt = (row, names = []) => {
    for (const name of names) {
      const indices = headerMap.get(normalizeHeaderKey(name)) || [];
      for (const index of indices) {
        const value = projectText(row[index]);
        if (value) return value;
      }
    }
    return "";
  };
  const records = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = normalizeMrnRow(values[rowIndex] || [], headers);
    const sheetMrnNo = valueAt(row, ["MRN No"]);
    const timestamp = valueAt(row, ["Timestamp"]);
    const project = valueAt(row, ["Name of Project & Site Address"]);
    const material = valueAt(row, ["Material Requirement"]);
    if (!sheetMrnNo && !timestamp && !project && !material) continue;
    const mrnNo = sheetMrnNo || `MRN${String(rowIndex).padStart(2, "0")}`;
    const requestDate = valueAt(row, ["Material Request Date"]);
    const requiredDate = valueAt(row, ["By when Material is Required"]);
    let mrnPhoto = valueAt(row, ["Upload Photo of MRN"]);
    let emailAddress = valueAt(row, ["Email Address", "Email address"]);
    let quotationPhoto = valueAt(row, ["Upload Photo of Quotation", "Upload photo of Quatation"]);
    let quotationAmount = valueAt(row, ["Quotation Amount"]);
    let assignTo = valueAt(row, ["Assign To"]);
    let status = valueAt(row, ["Status"]);
    let krishnaPrnStatusUpdated = valueAt(row, ["Krishna PRN Status Updated"]);
    let vendorName = valueAt(row, ["Vendor Name"]);
    let invoiceDate = valueAt(row, ["Invoice Date"]);
    let remark = valueAt(row, ["Remark"]);
    if (isEmailLike(mrnPhoto) && isUrlLike(emailAddress)) {
      [mrnPhoto, emailAddress] = [emailAddress, mrnPhoto];
    }
    if (isAmountLike(quotationPhoto) && isUrlLike(quotationAmount)) {
      [quotationPhoto, quotationAmount] = [quotationAmount, quotationPhoto];
    }
    if (isUrlLike(assignTo) && assignTo === quotationPhoto) {
      assignTo = status;
      status = krishnaPrnStatusUpdated;
      krishnaPrnStatusUpdated = vendorName;
      vendorName = invoiceDate;
      invoiceDate = remark;
      remark = projectText(row[18]) || "";
    }
    records.push({
      id: `${mrnNo || "MRN"}:${rowIndex + 1}`,
      rowNumber: rowIndex + 1,
      mrnNo,
      timestamp,
      lastEdited: timestamp,
      date: parseMrnDate(timestamp || requestDate),
      project,
      materialRequestDate: requestDate,
      requiredDate,
      materialRequirement: material,
      issuedBy: valueAt(row, ["Issued by", "Issued by "]),
      leadTime: valueAt(row, ["Lead Time (Usual time to get Material )", "Lead Time"]),
      mrnPhoto,
      emailAddress,
      quotationPhoto,
      quotationAmount,
      assignTo,
      status,
      krishnaPrnStatusUpdated,
      vendorName,
      invoiceDate,
      remark,
    });
  }
  return { headers, records };
}

async function readMrnDashboard({ startDate, endDate, all = false } = {}) {
  const spreadsheetId = getActiveMrnSpreadsheetId();
  await assertNativeGoogleSpreadsheet(spreadsheetId, "MRN sheet");
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  let response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(MRN_SHEET_NAME)}!A1:Z10000`,
  });
  const clearedSerialObstructions = await clearManualMrnSerialObstructions(sheets, spreadsheetId).catch((error) => {
    console.error("Could not clear MRN serial obstructions:", error);
    return 0;
  });
  if (clearedSerialObstructions) {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(MRN_SHEET_NAME)}!A1:Z10000`,
    });
  }
  const repairedRows = await repairShiftedMrnRows(sheets, spreadsheetId, response.data.values || []).catch((error) => {
    console.error("Could not repair shifted MRN rows:", error);
    return 0;
  });
  if (repairedRows) {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(MRN_SHEET_NAME)}!A1:Z10000`,
    });
  }
  const { records } = mapMrnRows(response.data.values || []);
  const today = istDateKey(new Date());
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) ? String(startDate) : addDaysToDateKey(today, -6);
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || "")) ? String(endDate) : today;
  const filtered = records
    .filter((record) => all || !record.date || (record.date >= start && record.date <= end))
    .sort((a, b) => b.rowNumber - a.rowNumber || (b.date || "").localeCompare(a.date || ""));
  const summarizeMrnRecords = (items = []) => {
    const byStatus = items.reduce((result, record) => {
      const status = projectText(record.status) || "Open";
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});
    return {
      total: items.length,
      open: items.filter((record) => !/delivered|closed|complete/i.test(record.status)).length,
      delivered: items.filter((record) => /delivered|closed|complete/i.test(record.status)).length,
      quotationAmount: items.reduce((sum, record) => sum + (Number(String(record.quotationAmount).replace(/,/g, "")) || 0), 0),
      byStatus,
    };
  };
  const sortedAllRecords = [...records].sort((a, b) => b.rowNumber - a.rowNumber || (b.date || "").localeCompare(a.date || ""));
  const byStatus = filtered.reduce((result, record) => {
    const status = projectText(record.status) || "Open";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  return {
    spreadsheetId,
    sheetName: MRN_SHEET_NAME,
    startDate: start,
    endDate: end,
    all,
    records: filtered,
    summary: {
      total: filtered.length,
      open: filtered.filter((record) => !/delivered|closed|complete/i.test(record.status)).length,
      delivered: filtered.filter((record) => /delivered|closed|complete/i.test(record.status)).length,
      quotationAmount: filtered.reduce((sum, record) => sum + (Number(String(record.quotationAmount).replace(/,/g, "")) || 0), 0),
      byStatus,
    },
    allSummary: summarizeMrnRecords(sortedAllRecords),
  };
}

const MRN_HISTORY_FIELDS = [
  ["project", "Project / site"],
  ["materialRequestDate", "Request date"],
  ["requiredDate", "Required by"],
  ["materialRequirement", "Material requirement"],
  ["issuedBy", "Issued by"],
  ["leadTime", "Lead time"],
  ["mrnPhoto", "MRN file"],
  ["emailAddress", "Email address"],
  ["quotationPhoto", "Quotation file"],
  ["quotationAmount", "Quotation amount"],
  ["assignTo", "Assigned to"],
  ["status", "Status"],
  ["krishnaPrnStatusUpdated", "PRN status"],
  ["vendorName", "Vendor"],
  ["invoiceDate", "Invoice date"],
  ["remark", "Remark"],
];

function mrnSnapshotFromSheetRow(headers = [], row = [], rowNumber = null) {
  const record = mapMrnRows([headers, row]).records?.[0] || {};
  return {
    rowNumber,
    mrnNo: record.mrnNo || projectText(row[0]),
    project: record.project || "",
    materialRequestDate: record.materialRequestDate || "",
    requiredDate: record.requiredDate || "",
    materialRequirement: record.materialRequirement || "",
    issuedBy: record.issuedBy || "",
    leadTime: record.leadTime || "",
    mrnPhoto: record.mrnPhoto || "",
    emailAddress: record.emailAddress || "",
    quotationPhoto: record.quotationPhoto || "",
    quotationAmount: record.quotationAmount || "",
    assignTo: record.assignTo || "",
    status: record.status || "",
    krishnaPrnStatusUpdated: record.krishnaPrnStatusUpdated || "",
    vendorName: record.vendorName || "",
    invoiceDate: record.invoiceDate || "",
    remark: record.remark || "",
  };
}

function mrnHistoryChanges(before = {}, after = {}) {
  return MRN_HISTORY_FIELDS
    .map(([key, label]) => ({
      key,
      label,
      before: projectText(before?.[key]),
      after: projectText(after?.[key]),
    }))
    .filter((change) => change.before !== change.after);
}

function addMrnHistoryEntry(req, { action, mrnNo, rowNumber, before = null, after = null }) {
  const normalized = projectText(mrnNo || after?.mrnNo || before?.mrnNo);
  if (!normalized) return;
  const existingCount = mrnHistory.filter((entry) => projectText(entry.mrnNo).toLowerCase() === normalized.toLowerCase()).length;
  const entry = {
    id: `mrn-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mrnNo: normalized,
    rowNumber: rowNumber || after?.rowNumber || before?.rowNumber || null,
    version: existingCount + 1,
    action,
    createdAt: new Date().toISOString(),
    actor: req.authUser?.displayName || req.authUser?.username || "System",
    username: req.authUser?.username || null,
    before,
    after,
    changes: action === "added" ? [] : mrnHistoryChanges(before, after),
  };
  mrnHistory.unshift(entry);
  mrnHistory = mrnHistory.slice(0, 2000);
  saveMrnHistory();
}

async function assertDriveFolder(folderId) {
  const id = extractDriveFileId(folderId);
  if (!id) throw new Error("Paste a valid Google Drive folder link or ID");
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  let response;
  try {
    response = await drive.files.get({
      fileId: id,
      fields: "id,name,mimeType,webViewLink,driveId",
      supportsAllDrives: true,
    });
  } catch (error) {
    const status = error?.code || error?.response?.status;
    if (status === 403 || status === 404) {
      throw new Error("The service account cannot access this Drive folder. Share the folder or Shared Drive with the service account email, then save again.");
    }
    throw error;
  }
  if (response.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Drive link must point to a folder");
  }
  return response.data;
}

async function uploadMrnFileToDrive(file, label) {
  const folderId = extractDriveFileId(mrnSettings.driveFolderId || "");
  if (!file || !file.path) return "";
  if (!folderId) throw new Error("Link an MRN Drive folder before uploading files.");
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const safeName = safeFileName(`${label}-${Date.now()}-${file.originalname || "upload"}`);
  try {
    const response = await drive.files.create({
      requestBody: { name: safeName, parents: [folderId] },
      media: { mimeType: file.mimetype || "application/octet-stream", body: fs.createReadStream(file.path) },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });
    return response.data.webViewLink || `https://drive.google.com/open?id=${response.data.id}`;
  } catch (error) {
    const message = String(error?.message || "");
    if (/storage quota|Service Accounts do not have storage quota/i.test(message)) {
      throw new Error("MRN files must upload to a Google Shared Drive folder. Move/link the MRN upload folder inside a Shared Drive and share it with the service account.");
    }
    throw error;
  }
}

async function appendMrnRecord(values = {}, files = {}) {
  const spreadsheetId = getActiveMrnSpreadsheetId();
  await assertNativeGoogleSpreadsheet(spreadsheetId, "MRN sheet");
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(MRN_SHEET_NAME)}!A1:Z10000`,
  });
  await clearManualMrnSerialObstructions(sheets, spreadsheetId).catch((error) => {
    console.error("Could not clear MRN serial obstructions:", error);
  });
  const parsed = mapMrnRows(existing.data.values || []);
  const mrnNo = nextMrnNumber(parsed.records);
  const mrnPhoto = await uploadMrnFileToDrive(files.mrnPhoto?.[0], mrnNo);
  const quotationPhoto = await uploadMrnFileToDrive(files.quotationPhoto?.[0], `${mrnNo}-quotation`);
  const row = buildMrnSheetRow(parsed.headers, {
    ...values,
    mrnNo,
    timestamp: formatMrnTimestamp(new Date()),
    mrnPhoto,
    quotationPhoto,
  });
  const nextRow = lastMrnDataRow(existing.data.values || []) + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapeSheetName(MRN_SHEET_NAME)}!B${nextRow}:S${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row.slice(1)] },
  });
  sheetDatasetCache.delete(spreadsheetId);
  return { mrnNo, row, rowNumber: nextRow, snapshot: mrnSnapshotFromSheetRow(parsed.headers, row, nextRow) };
}

async function updateMrnRecord(rowNumber, values = {}, files = {}) {
  const spreadsheetId = getActiveMrnSpreadsheetId();
  await assertNativeGoogleSpreadsheet(spreadsheetId, "MRN sheet");
  const numericRow = Number(rowNumber);
  if (!Number.isInteger(numericRow) || numericRow < 2) throw new Error("Valid MRN row number is required");
  const sheets = await getDmrSpreadsheet(spreadsheetId);
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(MRN_SHEET_NAME)}!A1:Z${numericRow}`,
  });
  const parsed = mapMrnRows(existing.data.values || []);
  const current = normalizeMrnRow(existing.data.values?.[numericRow - 1] || [], parsed.headers);
  const currentRecord = parsed.records.find((record) => record.rowNumber === numericRow) || {};
  if (!currentRecord.mrnNo && !projectText(current[1]) && !projectText(current[2]) && !projectText(current[5])) throw new Error("MRN row was not found");
  const mrnNo = currentRecord.mrnNo || `MRN${String(numericRow - 1).padStart(2, "0")}`;
  const headerMap = (parsed.headers || []).reduce((map, header, index) => {
    const key = normalizeHeaderKey(header);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(index);
    return map;
  }, new Map());
  const currentValue = (names = []) => {
    for (const name of names) {
      const indices = headerMap.get(normalizeHeaderKey(name)) || [];
      for (const index of indices) {
        const value = projectText(current[index]);
        if (value) return value;
      }
    }
    return "";
  };
  const mrnPhoto = files.mrnPhoto?.[0]
    ? await uploadMrnFileToDrive(files.mrnPhoto?.[0], mrnNo)
    : currentRecord.mrnPhoto || currentValue(MRN_FIELD_HEADERS.mrnPhoto);
  const quotationPhoto = files.quotationPhoto?.[0]
    ? await uploadMrnFileToDrive(files.quotationPhoto?.[0], `${mrnNo}-quotation`)
    : currentRecord.quotationPhoto || currentValue(MRN_FIELD_HEADERS.quotationPhoto);
  const row = buildMrnSheetRow(parsed.headers, {
    ...values,
    mrnNo,
    timestamp: formatMrnTimestamp(new Date()),
    mrnPhoto,
    quotationPhoto,
  }, current);
  const beforeSnapshot = {
    rowNumber: numericRow,
    mrnNo,
    project: currentRecord.project || "",
    materialRequestDate: currentRecord.materialRequestDate || "",
    requiredDate: currentRecord.requiredDate || "",
    materialRequirement: currentRecord.materialRequirement || "",
    issuedBy: currentRecord.issuedBy || "",
    leadTime: currentRecord.leadTime || "",
    mrnPhoto: currentRecord.mrnPhoto || "",
    emailAddress: currentRecord.emailAddress || "",
    quotationPhoto: currentRecord.quotationPhoto || "",
    quotationAmount: currentRecord.quotationAmount || "",
    assignTo: currentRecord.assignTo || "",
    status: currentRecord.status || "",
    krishnaPrnStatusUpdated: currentRecord.krishnaPrnStatusUpdated || "",
    vendorName: currentRecord.vendorName || "",
    invoiceDate: currentRecord.invoiceDate || "",
    remark: currentRecord.remark || "",
  };
  const afterSnapshot = mrnSnapshotFromSheetRow(parsed.headers, row, numericRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapeSheetName(MRN_SHEET_NAME)}!B${numericRow}:${columnName(row.length)}${numericRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row.slice(1)] },
  });
  sheetDatasetCache.delete(spreadsheetId);
  return { mrnNo, row, rowNumber: numericRow, lastEdited: row[1], before: beforeSnapshot, after: afterSnapshot };
}

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
    canManage: Boolean(req.authUser?.isSuperAdmin),
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

app.get("/mrn-dashboard/settings", (req, res) => {
  if (!hasMenuAccess(req, "project-mrn")) return res.status(403).json({ error: "MRN module access required" });
  res.json({
    settings: publicMrnSettings(),
    canManage: Boolean(req.authUser?.isSuperAdmin),
  });
});

app.put("/mrn-dashboard/settings", requireSuperAdmin, async (req, res) => {
  try {
    const spreadsheetId = normalizeSpreadsheetId(req.body?.spreadsheetId || req.body?.sheetUrl || req.body?.url || req.body?.link) || normalizeSpreadsheetId(mrnSettings.spreadsheetId);
    if (!spreadsheetId) return res.status(400).json({ error: "Paste a valid MRN Google Sheet link or spreadsheet ID" });
    const file = await assertNativeGoogleSpreadsheet(spreadsheetId, "MRN sheet");
    let folder = null;
    const driveFolderId = extractDriveFileId(req.body?.driveFolderId || req.body?.driveFolderLink || req.body?.folderUrl || "");
    if (driveFolderId) folder = await assertDriveFolder(driveFolderId);
    mrnSettings = {
      ...mrnSettings,
      spreadsheetId,
      driveFolderId: driveFolderId || mrnSettings.driveFolderId || "",
      linkedAt: new Date().toISOString(),
      linkedBy: req.authUser?.displayName || req.authUser?.username || "Super Admin",
      linkedFileName: file.name || null,
      linkedFolderName: folder?.name || mrnSettings.linkedFolderName || null,
    };
    saveMrnSettings();
    addActivityLog({
      req,
      action: "Linked MRN sheet",
      target: file.name || spreadsheetId,
      details: { spreadsheetId, driveFolderId: mrnSettings.driveFolderId },
    });
    res.json({ success: true, settings: publicMrnSettings() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/mrn-dashboard/settings", requireSuperAdmin, (req, res) => {
  const previousSpreadsheetId = normalizeSpreadsheetId(mrnSettings.spreadsheetId);
  mrnSettings = {
    ...mrnSettings,
    spreadsheetId: "",
    driveFolderId: "",
    unlinkedAt: new Date().toISOString(),
    unlinkedBy: req.authUser?.displayName || req.authUser?.username || "Super Admin",
  };
  saveMrnSettings();
  addActivityLog({ req, action: "Unlinked MRN sheet", target: previousSpreadsheetId || "MRN sheet" });
  res.json({ success: true, settings: publicMrnSettings() });
});

app.get("/mrn-dashboard", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-mrn")) return res.status(403).json({ error: "MRN module access required" });
    const dashboard = publicMrnSettings().linked
      ? await readMrnDashboard({ startDate: req.query.startDate, endDate: req.query.endDate, all: String(req.query.all || "") === "true" })
      : {
          spreadsheetId: "",
          sheetName: MRN_SHEET_NAME,
          startDate: addDaysToDateKey(istDateKey(new Date()), -6),
          endDate: istDateKey(new Date()),
          records: [],
          summary: { total: 0, open: 0, delivered: 0, quotationAmount: 0, byStatus: {} },
          allSummary: { total: 0, open: 0, delivered: 0, quotationAmount: 0, byStatus: {} },
        };
    res.json({
      ...dashboard,
      canEdit: hasPrivilege(req, "edit_project_mrn"),
      canViewMrnHistory: Boolean(req.authUser?.isSuperAdmin),
      canManageMrnSettings: Boolean(req.authUser?.isSuperAdmin),
      mrnSettings: publicMrnSettings(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("MRN dashboard error:", error);
    res.status(500).json({ error: `Could not load MRN dashboard: ${error.message}` });
  }
});

app.get("/mrn-dashboard/:mrnNo/history", requireSuperAdmin, (req, res) => {
  const mrnNo = projectText(req.params.mrnNo);
  const normalized = normalizedMrnNumber(mrnNo);
  const history = mrnHistory
    .filter((entry) => {
      const entryMrn = projectText(entry.mrnNo);
      return normalized
        ? normalizedMrnNumber(entryMrn) === normalized
        : entryMrn.toLowerCase() === mrnNo.toLowerCase();
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ history, total: history.length });
});

app.post("/mrn-dashboard", upload.fields([
  { name: "mrnPhoto", maxCount: 1 },
  { name: "quotationPhoto", maxCount: 1 },
]), async (req, res) => {
  const uploadedFiles = Object.values(req.files || {}).flat();
  try {
    if (!hasMenuAccess(req, "project-mrn")) return res.status(403).json({ error: "MRN module access required" });
    if (!hasPrivilege(req, "edit_project_mrn")) return res.status(403).json({ error: "MRN add permission required" });
    const required = ["projectSite", "materialRequestDate", "requiredDate", "materialRequirement"];
    const missing = required.filter((field) => !projectText(req.body?.[field]));
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    const result = await appendMrnRecord(req.body || {}, req.files || {});
    addMrnHistoryEntry(req, {
      action: "added",
      mrnNo: result.mrnNo,
      rowNumber: result.rowNumber,
      after: result.snapshot,
    });
    addActivityLog({
      req,
      action: "Added MRN",
      target: result.mrnNo,
      details: { projectSite: req.body?.projectSite, materialRequirement: req.body?.materialRequirement },
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("MRN add error:", error);
    res.status(500).json({ error: `Could not add MRN: ${error.message}` });
  } finally {
    for (const file of uploadedFiles) {
      if (file?.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
  }
});

app.put("/mrn-dashboard/:rowNumber", upload.fields([
  { name: "mrnPhoto", maxCount: 1 },
  { name: "quotationPhoto", maxCount: 1 },
]), async (req, res) => {
  const uploadedFiles = Object.values(req.files || {}).flat();
  try {
    if (!hasMenuAccess(req, "project-mrn")) return res.status(403).json({ error: "MRN module access required" });
    if (!hasPrivilege(req, "edit_project_mrn")) return res.status(403).json({ error: "MRN edit permission required" });
    const required = ["projectSite", "materialRequestDate", "requiredDate", "materialRequirement"];
    const missing = required.filter((field) => !projectText(req.body?.[field]));
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    const result = await updateMrnRecord(req.params.rowNumber, req.body || {}, req.files || {});
    addMrnHistoryEntry(req, {
      action: "edited",
      mrnNo: result.mrnNo,
      rowNumber: result.rowNumber,
      before: result.before,
      after: result.after,
    });
    addActivityLog({
      req,
      action: "Edited MRN",
      target: result.mrnNo,
      details: { rowNumber: result.rowNumber, projectSite: req.body?.projectSite },
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("MRN edit error:", error);
    res.status(500).json({ error: `Could not edit MRN: ${error.message}` });
  } finally {
    for (const file of uploadedFiles) {
      if (file?.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
  }
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
      canViewHistory: Boolean(req.authUser?.isSuperAdmin),
      canManageDmrSettings: Boolean(req.authUser?.isSuperAdmin),
      dmrSettings: publicDmrSettings(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("DMR dashboard error:", error);
    res.status(500).json({ error: `Could not load DMR dashboard: ${error.message}` });
  }
});

app.get("/dmr-dashboard/today-plan-summary", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
    if (!publicDmrSettings().linked) return res.status(400).json({ error: "DMR sheet is not linked" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || "")) ? String(req.query.date) : istDateKey(new Date());
    const dashboard = await readDmrDashboard(date, { ensureToday: false });
    const payload = buildDmrExecutiveSummaryPayload(dashboard);
    const signature = dmrPlanSummarySignature(payload);
    const cached = await getCachedDmrPlanSummary(date, payload, signature);
    res.json({
      date,
      generatedAt: cached.generatedAt,
      cacheStatus: cached.cacheStatus,
      signature,
      summary: cached.summary,
      insight: cached.insight,
    });
  } catch (error) {
    console.error("DMR Today plan summary error:", error);
    res.status(500).json({ error: `Could not generate Today plan summary: ${error.message}` });
  }
});

app.get("/dmr-dashboard/report", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
    if (!publicDmrSettings().linked) return res.status(400).json({ error: "DMR sheet is not linked" });
    const today = istDateKey(new Date());
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.startDate || "")) ? String(req.query.startDate) : addDaysToDateKey(today, -6);
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.endDate || "")) ? String(req.query.endDate) : today;
    const sections = String(req.query.sections || "")
      .split(",")
      .map((section) => projectText(section))
      .filter(Boolean);
    const report = await buildDmrReport({ startDate, endDate, sections });
    res.json(report);
  } catch (error) {
    console.error("DMR report error:", error);
    res.status(500).json({ error: `Could not generate DMR report: ${error.message}` });
  }
});

app.get("/dmr-dashboard/report/pdf", async (req, res) => {
  try {
    if (!hasMenuAccess(req, "project-dmr")) return res.status(403).json({ error: "DMR module access required" });
    if (!publicDmrSettings().linked) return res.status(400).json({ error: "DMR sheet is not linked" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || "")) ? String(req.query.date) : istDateKey(new Date());
    const forceRefresh = ["1", "true", "yes", "force"].includes(String(req.query.force || "").toLowerCase());
    const cachedPath = dmrPdfPath(date);
    const metaPath = dmrPdfMetaPath(date);
    const cachedMeta = readJsonFileSafe(metaPath);
    const hasCachedPdf = fs.existsSync(cachedPath);
    const now = Date.now();
    const validatedAt = Date.parse(cachedMeta?.validatedAt || cachedMeta?.generatedAt || "") || 0;
    const validationFailedAt = Date.parse(cachedMeta?.validationFailedAt || "") || 0;
    const currentLayout = cachedMeta?.layoutVersion === DMR_DAILY_PDF_LAYOUT_VERSION;
    let buffer;
    let cacheStatus;

    if (!forceRefresh && hasCachedPdf && currentLayout && now - validatedAt < DMR_PDF_CACHE_TTL_MS) {
      buffer = fs.readFileSync(cachedPath);
      cacheStatus = "HIT";
    } else if (!forceRefresh && hasCachedPdf && currentLayout && validationFailedAt && now - validationFailedAt < DMR_PDF_RETRY_BACKOFF_MS) {
      buffer = fs.readFileSync(cachedPath);
      cacheStatus = "STALE-BACKOFF";
    } else {
      let refresh = dmrPdfRefreshes.get(date);
      cacheStatus = refresh ? "WAIT" : forceRefresh ? "FORCE" : "MISS";
      if (!refresh) {
        refresh = (async () => {
          try {
            const dashboard = await readDmrDashboard(date, { ensureToday: false });
            const payload = buildDmrExecutiveSummaryPayload(dashboard);
            const summarySignature = dmrPlanSummarySignature(payload);
            const signature = dmrDailyPdfSignature({ dashboard, planPayload: payload });
            const latestMeta = readJsonFileSafe(metaPath);
            if (!forceRefresh && latestMeta?.signature === signature && fs.existsSync(cachedPath)) {
              const nextMeta = { ...latestMeta, validatedAt: new Date().toISOString() };
              delete nextMeta.validationFailedAt;
              delete nextMeta.validationError;
              fs.writeFileSync(metaPath, JSON.stringify(nextMeta, null, 2));
              return { buffer: fs.readFileSync(cachedPath), status: "VALIDATED" };
            }
            const buildKey = `${date}:${signature}`;
            let build = dmrPdfBuilds.get(buildKey);
            if (!build) {
              build = buildDmrDailyPdf(date, {
                save: true,
                knownPayload: payload,
                knownSignature: summarySignature,
                pdfSignature: signature,
              }).finally(() => dmrPdfBuilds.delete(buildKey));
              dmrPdfBuilds.set(buildKey, build);
            }
            const result = await build;
            return { buffer: result.buffer, status: "REFRESHED" };
          } catch (error) {
            const fallbackMeta = readJsonFileSafe(metaPath) || cachedMeta || { date };
            if (forceRefresh || !fs.existsSync(cachedPath) || fallbackMeta.layoutVersion !== DMR_DAILY_PDF_LAYOUT_VERSION) throw error;
            fs.writeFileSync(metaPath, JSON.stringify({
              ...fallbackMeta,
              validationFailedAt: new Date().toISOString(),
              validationError: projectText(error.message).slice(0, 240),
            }, null, 2));
            console.warn(`Serving stale DMR PDF cache for ${date}:`, error.message);
            return { buffer: fs.readFileSync(cachedPath), status: "STALE" };
          }
        })().finally(() => dmrPdfRefreshes.delete(date));
        dmrPdfRefreshes.set(date, refresh);
      }
      const result = await refresh;
      buffer = result.buffer;
      cacheStatus = cacheStatus === "WAIT" ? "WAIT" : forceRefresh ? `FORCE-${result.status}` : result.status;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${dmrPdfFilename(date)}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("X-DMR-PDF-Cache", cacheStatus);
    res.setHeader("Cache-Control", "private, no-cache, must-revalidate");
    res.send(buffer);
  } catch (error) {
    console.error("DMR PDF report error:", error);
    res.status(500).json({ error: `Could not generate DMR PDF: ${error.message}` });
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

if (require.main === module) {
  refreshEmployeeReminderCron().catch((error) => {
    console.error("Employee WhatsApp reminder cron setup error:", error);
  });

  cron.schedule("0 12 * * *", async () => {
    try {
      if (!publicDmrSettings().linked) return;
      const date = istDateKey(new Date());
      await buildDmrDailyPdf(date, { save: true });
      console.log(`Generated scheduled DMR CEO PDF for ${date}`);
    } catch (error) {
      console.error("Scheduled DMR PDF generation error:", error);
    }
  }, { timezone: "Asia/Kolkata" });

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Uploads: ${uploadsDir}`);
    console.log(`📁 Vectors: ${vectorsDir}`);
    console.log(`📁 Data: ${dataDir}`);
  });
}

module.exports = { app, generateEmployeeDailyReportPdf };

app.patch("/reports/:id/read", (req, res) => {
  const report = reports.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  report.readAt = report.readAt || new Date().toISOString();
  saveReports();
  res.json({ success: true, report });
});
