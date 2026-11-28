"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, CalendarOff, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Eye, FileText, FolderOpen, GraduationCap, HeartPulse, IdCard, Loader2, LogIn, LogOut, Mail, MapPin, Maximize2, MessageCircle, MessageSquare, Minimize2, Navigation, Pencil, Phone, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, Upload, UserRound, Users, WalletCards, X } from "lucide-react";
import { API_URL, useAuth } from "./AuthProvider";
import { showAppToast } from "./ToastPill";
import UserAvatar from "./UserAvatar";
import { Badge, Button, Chip, DateInput, DatePicker, EmptyState as KitEmptyState, IconTile, PageHeader, SelectMenu, StatTile, Tabs, TimePicker, cx, toneOf } from "./ui";

async function api(path) {
  const response = await fetch(`${API_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
let googleMapsPromise = null;

const EMPLOYEE_DOCUMENT_TYPES = [
  { id: "aadhar_card_copy", label: "Aadhar card copy" },
  { id: "pan_card_copy", label: "Pan card copy" },
  { id: "last_3_months_pay_slip", label: "Last 3 months pay slip" },
  { id: "educational_certificates", label: "Educational certificates - 10th, 12th, Graduation and PG(if applicable)" },
  { id: "last_company_letters", label: "Last company appointment letter and experience relieving letter" },
  { id: "medical_certificate", label: "Medical certificate from your doctor" },
];
const MULTI_EMPLOYEE_DOCUMENT_TYPES = new Set(["last_3_months_pay_slip", "educational_certificates", "last_company_letters"]);

const DOCUMENT_CARD_META = {
  aadhar_card_copy: { Icon: IdCard, tone: "peach" },
  pan_card_copy: { Icon: BadgeCheck, tone: "sky" },
  educational_certificates: { Icon: GraduationCap, tone: "lime" },
  last_3_months_pay_slip: { Icon: ReceiptText, tone: "lavender" },
  last_company_letters: { Icon: Building2, tone: "rose" },
  medical_certificate: { Icon: HeartPulse, tone: "mint" },
};

function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("Google Maps API key is not configured"));
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-uipl-google-maps]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
        existing.addEventListener("error", () => reject(new Error("Could not load Google Maps")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.uiplGoogleMaps = "true";
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error("Could not load Google Maps"));
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
}

function initials(name = "U") {
  return String(name || "U").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function escapePdfText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function downloadPdf(doc, employeeName, darkMode = false) {
  if (!doc) return;
  const title = doc.title || doc.name || "HR Document";
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const rows = [
    "UIPL Docs HR",
    title,
    `Employee: ${employeeName}`,
    `Type: ${doc.type || "Document"}`,
    `Date: ${doc.date || doc.createdAt || ""}`,
    "",
    ...(doc.lines || doc.details || ["Generated from HR records."]),
  ];
  const content = rows.map((line, index) => `BT /F1 ${index < 2 ? 18 : 11} Tf 56 ${760 - index * 28} Td (${escapePdfText(line)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName || "hr-document"}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
  showAppToast("PDF downloaded", { type: "success", darkMode });
}

function EmptyState({ darkMode, icon, title, text, tone = "neutral" }) {
  return <KitEmptyState darkMode={darkMode} icon={icon} tone={tone} title={title} text={text} className="min-h-[240px]" />;
}

// Someone who actually turned up outranks any blanket marker. A cell holding
// hours or NCO means there is a real clock-in behind it; PL, L, HF and "-" do
// not. Sunday and NWD only fill the cells of people with no record that day.
function attendanceWorked(value) {
  return Boolean(value) && value !== "-" && value !== "PL" && value !== "L" && value !== "HF";
}

function formatDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function leaveDayCount(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

function todayInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeInputFromDate(value, fallback = "") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

function currentMonthInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(value) {
  return value ? `${value}-01` : "";
}

function endOfMonthInput(month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return todayInput();
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabelFromInput(month = "") {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || "";
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function leaveDaysInMonth(request, month) {
  if (!request?.startDate || !request?.endDate || !/^\d{4}-\d{2}$/.test(month || "")) return 0;
  const monthStartDate = `${month}-01`;
  const monthEndDate = endOfMonthInput(month);
  if (request.endDate < monthStartDate || request.startDate > monthEndDate) return 0;
  const startDate = request.startDate > monthStartDate ? request.startDate : monthStartDate;
  const endDate = request.endDate < monthEndDate ? request.endDate : monthEndDate;
  return leaveDayCount(startDate, endDate);
}

function salaryMonthOptions(joiningDate = "") {
  const now = new Date();
  const options = [];
  const minMonth = joiningDate ? joiningDate.slice(0, 7) : "";
  for (let index = 0; index < 36; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (minMonth && value < minMonth) continue;
    options.push({ value, label: monthLabelFromInput(value) });
  }
  return options;
}

function moneyValue(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function roundedMoneyValue(value) {
  return Math.round(moneyValue(value));
}

function DrawerSelect({ darkMode, label, value, placeholder, options, onChange, required, searchable = false, searchPlaceholder = "Search..." }) {
  return (
    <div className={cx("relative block text-xs", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>
      {label}{required ? " *" : ""}
      <SelectMenu
        darkMode={darkMode}
        className="mt-1.5"
        value={value}
        options={options.map((option) => ({ value: option, label: String(option) }))}
        onChange={onChange}
        placeholder={placeholder}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
      />
    </div>
  );
}

function DrawerDatePicker({ darkMode, label, value, placeholder, onChange, minDate }) {
  return (
    <div className="relative">
      <p className={cx("text-xs", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{label} *</p>
      <DatePicker darkMode={darkMode} className="mt-1.5" value={value || ""} onChange={onChange} placeholder={placeholder} minDate={minDate} />
    </div>
  );
}

const ATTENDANCE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label: new Date(2000, 0, 1, hour, 0).toLocaleTimeString("en-IN", { hour: "numeric" }),
}));
const ATTENDANCE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function displayTimeInput(value = "") {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return "Select time";
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function currentTimeInput() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// Time of a clock in/out: the kit's time picker (type a time or pick from the list).
function AttendanceTimePicker({ darkMode, label, value, onChange, emptyLabel = "No record" }) {
  return (
    <div className="relative">
      <p className={cx("text-xs", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{label} *</p>
      <TimePicker darkMode={darkMode} className="mt-1.5" value={value || ""} onChange={onChange} placeholder={emptyLabel} step={5} />
    </div>
  );
}

// Shared look for the module's own drawers: a floating white sheet, radius 24.
function DrawerHead({ darkMode, icon, tone = "neutral", title, subtitle, onClose, extra, children }) {
  return (
    <div className={cx("flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />}
        <div className="min-w-0">
          <h2 className="truncate text-[17px] tracking-[-0.01em]">{title}</h2>
          {subtitle && <p className={cx("mt-0.5 text-[12.5px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{subtitle}</p>}
          {children}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        <button type="button" onClick={onClose} aria-label="Close" className={cx("grid h-9 w-9 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function HrDashboard({ darkMode, section = "dashboard" }) {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] = useState("All");
  const [requestEmployeeFilter, setRequestEmployeeFilter] = useState("All employees");
  const [requestDateFilter, setRequestDateFilter] = useState({ startDate: "", endDate: "" });
  const [salaryQuery, setSalaryQuery] = useState("");
  const [leaveDrawerOpen, setLeaveDrawerOpen] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveReviewSaving, setLeaveReviewSaving] = useState(false);
  const [salaryDrawerOpen, setSalaryDrawerOpen] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryMeta, setSalaryMeta] = useState(null);
  const [salaryEmployeeId, setSalaryEmployeeId] = useState(user?.id || "");
  const [editingSalaryId, setEditingSalaryId] = useState("");
  const [salaryDeleteTarget, setSalaryDeleteTarget] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetailExpanded, setEmployeeDetailExpanded] = useState(false);
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeRemoteSavingId, setEmployeeRemoteSavingId] = useState("");
  const [employeeDocumentUploading, setEmployeeDocumentUploading] = useState("");
  const [employeeDocumentUploadProgress, setEmployeeDocumentUploadProgress] = useState({});
  const [employeeForm, setEmployeeForm] = useState({ employmentType: "probation", monthlyInHandSalary: "", remoteWorkEnabled: false });
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceClockAction, setAttendanceClockAction] = useState("");
  const [attendanceLocating, setAttendanceLocating] = useState(false);
  const [attendanceSettingsOpen, setAttendanceSettingsOpen] = useState(false);
  const [attendanceSettingsExpanded, setAttendanceSettingsExpanded] = useState(false);
  const [attendanceAdjustOpen, setAttendanceAdjustOpen] = useState(false);
  const [attendanceAdjustSaving, setAttendanceAdjustSaving] = useState(false);
  const [attendanceAdjustForm, setAttendanceAdjustForm] = useState({ userId: "", date: todayInput(), clockInTime: "10:30", clockOutTime: "19:30", workMode: "office", reason: "" });
  const [attendanceAdjustMode, setAttendanceAdjustMode] = useState("single");
  const [attendanceAdjustRows, setAttendanceAdjustRows] = useState([{ date: todayInput(), clockInTime: "", clockOutTime: "", workMode: "office", reason: "" }]);
  const [attendanceRequestOpen, setAttendanceRequestOpen] = useState(false);
  const [attendanceRequestSaving, setAttendanceRequestSaving] = useState(false);
  const [attendanceRequestMode, setAttendanceRequestMode] = useState("single");
  const [attendanceRequestRows, setAttendanceRequestRows] = useState([{ date: todayInput(), clockInTime: "10:30", clockOutTime: "19:30", workMode: "office", reason: "" }]);
  const [attendanceRequestReviewingId, setAttendanceRequestReviewingId] = useState("");
  const [attendanceRequestHistoryOpen, setAttendanceRequestHistoryOpen] = useState(false);
  // The Adjustments drawer holds two unrelated jobs, so it carries a tab rather
  // than a second drawer. "nwd" is the company-holiday list.
  const [adjustTab, setAdjustTab] = useState("time");
  const [noWorkingDays, setNoWorkingDays] = useState([]);
  const [nwdForm, setNwdForm] = useState({ date: todayInput(), label: "" });
  const [nwdSaving, setNwdSaving] = useState(false);
  const [attendanceSearchResults, setAttendanceSearchResults] = useState([]);
  const [attendanceForm, setAttendanceForm] = useState({ address: "", latitude: "", longitude: "", radiusMeters: 100, googleSheetLink: "" });
  const [attendanceDateFilter, setAttendanceDateFilter] = useState({ startDate: todayInput(), endDate: todayInput() });
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [attendanceExportOpen, setAttendanceExportOpen] = useState(false);
  const [todayReportSubmitted, setTodayReportSubmitted] = useState(false);
  const [todayReportExempt, setTodayReportExempt] = useState(false);
  const [todayReportChecking, setTodayReportChecking] = useState(false);
  const attendanceSearchTimerRef = useRef(null);
  const attendanceGoogleGeocoderRef = useRef(null);
  const attendanceExportRef = useRef(null);
  const [reviewComment, setReviewComment] = useState("");
  const [leaveForm, setLeaveForm] = useState({ leaveType: "", startDate: "", endDate: "", reason: "" });
  const [salaryForm, setSalaryForm] = useState({
    month: currentMonthInput(),
    userId: user?.id || "",
    payDate: endOfMonthInput(currentMonthInput()),
    employeeName: user?.displayName || user?.username || "",
    designation: user?.designation || "",
    employeeCode: user?.employeeCode || "",
    joiningDate: user?.joiningDate || "",
    employmentType: user?.employmentType || "probation",
    monthlyInHandSalary: user?.monthlyInHandSalary || "",
    uan: "",
    paidDays: 30,
    lopDays: 0,
    basic: user?.monthlyInHandSalary || "",
    earnings: [{ label: "House Rent Allowance", amount: "" }, { label: "Conveyance Allowance", amount: "" }],
    deductions: [{ label: "EPF Contribution", amount: "" }, { label: "Professional Tax", amount: "" }],
    companyName: "UIPL Docs",
    companyLocation: "India",
    companyPhone: "",
    companyEmail: "",
    companyLogo: "",
    pfAccountNumber: "",
    note: "",
  });
  const hrToast = {
    success: (message, detail) => showAppToast(message, { type: "success", darkMode, detail }),
    error: (message, detail) => showAppToast(message, { type: "error", darkMode, detail }),
  };

  async function loadHr() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (section === "attendance") {
        if (attendanceDateFilter.startDate) params.set("attendanceStartDate", attendanceDateFilter.startDate);
        if (attendanceDateFilter.endDate) params.set("attendanceEndDate", attendanceDateFilter.endDate);
      }
      const overview = await api(`/hr/overview${params.toString() ? `?${params.toString()}` : ""}`);
      setData(overview);
      setNoWorkingDays(overview?.noWorkingDays || []);
      if (overview?.attendanceSettings) {
        setAttendanceForm({
          address: overview.attendanceSettings.address || "",
          latitude: overview.attendanceSettings.latitude || "",
          longitude: overview.attendanceSettings.longitude || "",
          radiusMeters: overview.attendanceSettings.radiusMeters || 100,
          googleSheetLink: overview.attendanceSettings.googleSheetLink || "",
        });
      }
      if (section === "attendance") void loadTodayReportStatus();
    } catch (error) {
      hrToast.error(error.message || "Could not load HR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHr();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function reloadHrData() {
      void loadHr();
    }
    window.addEventListener("uipl:hr-data-changed", reloadHrData);
    return () => window.removeEventListener("uipl:hr-data-changed", reloadHrData);
  }, []);

  useEffect(() => {
    if (section !== "attendance") return undefined;
    function refreshReportStatus() {
      void loadTodayReportStatus();
    }
    window.addEventListener("uipl:employee-daily-report-submitted", refreshReportStatus);
    window.addEventListener("focus", refreshReportStatus);
    return () => {
      window.removeEventListener("uipl:employee-daily-report-submitted", refreshReportStatus);
      window.removeEventListener("focus", refreshReportStatus);
    };
  }, [section]);

  useEffect(() => {
    if (section !== "attendance") return undefined;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (attendanceDateFilter.startDate) params.set("startDate", attendanceDateFilter.startDate);
        if (attendanceDateFilter.endDate) params.set("endDate", attendanceDateFilter.endDate);
        const result = await api(`/hr/attendance?${params.toString()}`);
        setData((current) => ({
          ...(current || {}),
          canManageHr: result.canManageHr ?? current?.canManageHr,
          attendanceSettings: result.settings || current?.attendanceSettings,
          attendanceRecords: result.records || [],
          attendanceAdjustmentRequests: result.adjustmentRequests || current?.attendanceAdjustmentRequests || [],
          remoteWorkEnabled: result.remoteWorkEnabled ?? current?.remoteWorkEnabled,
          reportExempt: result.reportExempt ?? current?.reportExempt,
        }));
      } catch (error) {
        hrToast.error(error.message || "Could not load attendance records");
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [section, attendanceDateFilter.startDate, attendanceDateFilter.endDate]);

  useEffect(() => {
    if (!attendanceExportOpen) return undefined;
    function closeAttendanceExport(event) {
      if (attendanceExportRef.current?.contains(event.target)) return;
      setAttendanceExportOpen(false);
    }
    document.addEventListener("mousedown", closeAttendanceExport);
    return () => document.removeEventListener("mousedown", closeAttendanceExport);
  }, [attendanceExportOpen]);

  const employees = data?.employees || [];
  const documents = data?.documents || [];
  const salarySlips = data?.salarySlips || [];
  const leaveRequests = data?.leaveRequests || [];
  const attendanceRecords = data?.attendanceRecords || [];
  const attendanceAdjustmentRequests = data?.attendanceAdjustmentRequests || [];
  const attendanceSettings = data?.attendanceSettings || {};
  const canManageSalary = Boolean(data?.canManageHr);

  // The Slack look-back links here with ?adjust=YYYY-MM-DD: open the adjustment request for
  // that day once the data is in, then drop the parameter so a reload doesn't reopen it.
  const slackAdjustHandled = useRef(false);
  useEffect(() => {
    if (section !== "attendance" || !data || slackAdjustHandled.current) return undefined;
    const params = new URLSearchParams(window.location.search);
    const date = params.get("adjust") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    slackAdjustHandled.current = true;
    params.delete("adjust");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    const record = attendanceRecords.find((item) => String(item.userId || "") === String(user?.id || "") && item.date === date);
    const timer = window.setTimeout(() => openAttendanceRequest(record || { date, workMode: "office" }), 0);
    return () => window.clearTimeout(timer);
  }, [section, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentName = user?.displayName || user?.username || "Employee";
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const panel = darkMode ? "border border-white/10 bg-[#15171c]" : "border border-[#ececec] bg-white";
  const salaryPanel = panel;
  const salaryTableSurface = darkMode ? "bg-[#15171c]" : "bg-white";
  const salaryRowBorder = darkMode ? "border-white/[0.06] hover:bg-white/[0.03]" : "border-[#f0f0ee] hover:bg-[#fafaf8]";
  const salaryBadge = darkMode ? "bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]";
  const softPanel = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
  // Floating drawer sheet, field and label styles shared by the module's own drawers.
  const drawerSheet = darkMode ? "border border-white/10 bg-[#121317] text-white" : "border border-[#ececec] bg-white text-[#141414]";
  const drawerBody = darkMode ? "bg-[#121317]" : "bg-white";
  const drawerCard = darkMode ? "border border-white/10 bg-[#15171c]" : "border border-[#ececec] bg-white";
  const fieldLabel = darkMode ? "text-white/55" : "text-[#8a8a8a]";
  const textField = darkMode ? "border border-transparent bg-white/[0.06] text-white placeholder:text-white/35" : "border border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:bg-white focus:border-[#e2e2df]";
  const drawerFooter = darkMode ? "border-white/10 bg-[#121317]" : "border-[#f0f0ee] bg-white";
  const backdrop = "fixed inset-0 z-[90] flex justify-end bg-black/20 backdrop-blur-[2px]";
  const primaryButton = darkMode ? "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black";
  const activeEmployees = employees.filter((employee) => !employee.blacklisted);
  const selectedDocs = section === "salary" ? salarySlips : documents;
  const filteredSalarySlips = salarySlips.filter((doc) => {
    const search = salaryQuery.trim().toLowerCase();
    if (!search) return true;
    return [doc.employeeName, doc.designation, doc.employeeCode, monthLabelFromInput(doc.month), doc.date, doc.netPay].some((value) => String(value || "").toLowerCase().includes(search));
  });
  const salaryMonthItems = salaryMonthOptions(salaryForm.joiningDate);
  const selectedSalaryMonthLabel = salaryMonthItems.find((item) => item.value === salaryForm.month)?.label || monthLabelFromInput(salaryForm.month);
  const salaryEmployeeOptions = activeEmployees.map((employee) => `${employee.displayName || employee.username} · ${employee.roleName || "Employee"}`);
  const selectedSalaryEmployeeLabel = activeEmployees.find((employee) => employee.id === salaryEmployeeId || employee.id === salaryForm.userId);
  const selectedSalaryEmployeeText = selectedSalaryEmployeeLabel ? `${selectedSalaryEmployeeLabel.displayName || selectedSalaryEmployeeLabel.username} · ${selectedSalaryEmployeeLabel.roleName || "Employee"}` : "";
  const leavePreviewDays = leaveDayCount(leaveForm.startDate, leaveForm.endDate);
  const leavePeriodPreview = leaveForm.startDate && leaveForm.endDate ? `${formatDateLabel(leaveForm.startDate)} - ${formatDateLabel(leaveForm.endDate)}` : "Select dates";
  const myLeaveRequests = leaveRequests.filter((request) => data?.canManageHr || request.userId === user?.id);
  const myAttendanceRecords = attendanceRecords.filter((record) => data?.canManageHr || record.userId === user?.id);
  const attendanceSearch = attendanceQuery.trim().toLowerCase();
  const attendanceEmployeeMatchesSearch = (employee = {}) => {
    if (!attendanceSearch) return true;
    return [
      employee.displayName,
      employee.username,
      employee.department,
      employee.designation,
      employee.roleName,
      employee.employeeCode,
    ].some((value) => String(value || "").toLowerCase().includes(attendanceSearch));
  };
  const attendanceRecordMatchesSearch = (record = {}) => {
    if (!attendanceSearch) return true;
    const matchedEmployee = activeEmployees.find((employee) => String(employee.id || "") === String(record.userId || ""));
    return [
      record.employeeName,
      record.designation,
      record.department,
      record.date,
      record.status,
      record.workMode,
      matchedEmployee?.displayName,
      matchedEmployee?.username,
      matchedEmployee?.employeeCode,
      matchedEmployee?.roleName,
    ].some((value) => String(value || "").toLowerCase().includes(attendanceSearch));
  };
  const filteredAttendanceRecords = myAttendanceRecords.filter((record) => {
    if (attendanceDateFilter.startDate && record.date < attendanceDateFilter.startDate) return false;
    if (attendanceDateFilter.endDate && record.date > attendanceDateFilter.endDate) return false;
    if (!attendanceRecordMatchesSearch(record)) return false;
    return true;
  });
  const attendanceReportEmployees = activeEmployees.filter((emp) => {
    if (!data?.canManageHr && String(emp.id || "") !== String(user?.id || "")) return false;
    const name = (emp.displayName || emp.username || "").toLowerCase();
    const role = (emp.roleName || emp.role || "employee").toLowerCase();
    const defaultIncluded = role === "employee" || name.includes("neelam") || name.includes("miti") || name.includes("iqbal");
    if (!defaultIncluded) return false;
    return attendanceEmployeeMatchesSearch(emp) || filteredAttendanceRecords.some((record) => String(record.userId || "") === String(emp.id || ""));
  });
  const attendanceReportSubject = attendanceSearch
    ? (attendanceReportEmployees.length === 1 ? (attendanceReportEmployees[0].displayName || attendanceReportEmployees[0].username || "Employee") : `Search: ${attendanceQuery.trim()}`)
    : "";
  const attendanceAdjustEmployeeOptions = activeEmployees.map((employee) => `${employee.displayName || employee.username} · ${employee.designation || employee.department || employee.roleName || "Employee"}`);
  const selectedAttendanceAdjustEmployee = activeEmployees.find((employee) => employee.id === attendanceAdjustForm.userId);
  const selectedAttendanceAdjustEmployeeText = selectedAttendanceAdjustEmployee ? `${selectedAttendanceAdjustEmployee.displayName || selectedAttendanceAdjustEmployee.username} · ${selectedAttendanceAdjustEmployee.designation || selectedAttendanceAdjustEmployee.department || selectedAttendanceAdjustEmployee.roleName || "Employee"}` : "";
  const attendanceAdjustmentIsToday = attendanceAdjustForm.date === todayInput();
  const selectedAttendanceAdjustRecord = attendanceRecords.find((record) => String(record.userId || "") === String(attendanceAdjustForm.userId || "") && record.date === attendanceAdjustForm.date);
  const attendanceAdjustBulkRows = attendanceAdjustRows.filter((row) => row.date || row.clockInTime || row.clockOutTime || row.reason);
  const attendanceAdjustBulkReady = Boolean(attendanceAdjustBulkRows.length && attendanceAdjustBulkRows.every((row) => row.date && row.clockInTime && (row.date === todayInput() || row.clockOutTime)));
  const myAttendanceAdjustmentRequests = attendanceAdjustmentRequests.filter((request) => data?.canManageHr || String(request.userId || "") === String(user?.id || ""));
  const pendingAttendanceAdjustmentRequests = myAttendanceAdjustmentRequests.filter((request) => request.status === "pending");

  const attendanceDateRangeLabel = attendanceDateFilter.startDate && attendanceDateFilter.endDate && attendanceDateFilter.startDate !== attendanceDateFilter.endDate 
    ? `${formatDateLabel(attendanceDateFilter.startDate)} - ${formatDateLabel(attendanceDateFilter.endDate)}` 
    : formatDateLabel(attendanceDateFilter.startDate || attendanceDateFilter.endDate) || "All dates";

  const downloadExcelReport = () => {
    let url = `${API_URL}/hr/attendance/export/excel?`;
    if (attendanceDateFilter.startDate) url += `startDate=${attendanceDateFilter.startDate}&`;
    if (attendanceDateFilter.endDate) url += `endDate=${attendanceDateFilter.endDate}`;
    
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then(blob => {
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = urlObj;
        a.download = "attendance-report.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(urlObj);
      })
      .catch(err => hrToast.error("Failed to download Excel: " + err.message));
  };

  const exportToGoogleSheet = async () => {
    try {
      const toastId = Math.random().toString();
      showAppToast("Exporting to Google Sheets...", { type: "info", darkMode, id: toastId });
      const response = await fetch(`${API_URL}/hr/attendance/export/google-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: attendanceDateFilter.startDate || todayInput() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Export failed");
      showAppToast("Exported to Google Sheets", { type: "success", darkMode, id: toastId });
    } catch (error) {
      hrToast.error("Failed to export: " + error.message);
    }
  };

  const downloadAttendanceReport = async () => {
    if (!attendanceReportEmployees.length) {
      hrToast.error("No employee found for this attendance search");
      return;
    }
    // The PDF library and its embedded font (~0.5 MB together) load only when someone exports.
    const [{ default: jsPDF }, { default: autoTable }, { GeistRegularBase64 }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("../lib/geistFont"),
    ]);
    const doc = new jsPDF("landscape");
    doc.addFileToVFS("Geist-Regular.ttf", GeistRegularBase64);
    doc.addFont("Geist-Regular.ttf", "Geist", "normal");
    
    doc.addFileToVFS("Geist-Bold.ttf", GeistRegularBase64);
    doc.addFont("Geist-Bold.ttf", "Geist", "bold"); // Fallback for bold
    
    const allDates = [];
    if (attendanceDateFilter.startDate && attendanceDateFilter.endDate) {
      let current = new Date(attendanceDateFilter.startDate);
      const end = new Date(attendanceDateFilter.endDate);
      while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        allDates.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
      }
    } else if (attendanceDateFilter.startDate) {
      allDates.push(attendanceDateFilter.startDate);
    } else if (attendanceDateFilter.endDate) {
      allDates.push(attendanceDateFilter.endDate);
    } else {
      allDates.push(todayInput());
    }

    if (allDates.length === 0) return;

    const datesByMonth = {};
    allDates.forEach(date => {
      const month = date.substring(0, 7);
      if (!datesByMonth[month]) datesByMonth[month] = [];
      datesByMonth[month].push(date);
    });

    const monthKeys = Object.keys(datesByMonth).sort();

    let currentY = 12;

    monthKeys.forEach((month, index) => {
      if (index > 0) {
        const finalY = doc.lastAutoTable?.finalY || currentY;
        // Landscape A4 height is 210mm. If we are below 130mm, force new page.
        if (finalY > 130) {
          doc.addPage("a4", "landscape");
          currentY = 12;
        } else {
          currentY = finalY + 15;
        }
      }
      
      const monthDates = datesByMonth[month];
      
      doc.setFont("Geist", "bold");
      doc.setFontSize(16);
      doc.text(attendanceReportSubject ? `Attendance Report - ${attendanceReportSubject}` : "Attendance Report", 14, currentY);
      doc.setFont("Geist", "normal");
      doc.setFontSize(10);
      
      const dateRangeLabel = monthDates.length > 1 
        ? `${formatDateLabel(monthDates[0])} - ${formatDateLabel(monthDates[monthDates.length - 1])}`
        : formatDateLabel(monthDates[0]);
      
      doc.text(`Date Range: ${dateRangeLabel}`, 14, currentY + 6);
      
      doc.setFont("Geist", "normal");
      
      const legendItems = [
        { code: "PL", label: "Paid Leave", fill: [37, 99, 235], text: [255, 255, 255] },
        { code: "L", label: "Leave", fill: [153, 27, 27], text: [255, 255, 255] },
        { code: "HF", label: "Half Day", fill: [221, 214, 254], text: [91, 33, 182] },
        { code: "-", label: "Absent", fill: [254, 226, 226], text: [220, 38, 38] },
        { code: "NCO", label: "No Clock Out", fill: [255, 237, 213], text: [234, 88, 12] },
        { code: "NWD", label: "No Working Day", fill: [204, 251, 241], text: [15, 118, 110] },
        { code: "SUN", label: "Sunday", fill: [240, 240, 240], text: [40, 40, 40] },
      ];
      const pageRight = doc.internal.pageSize.getWidth() - 14;
      const legendStartX = Math.max(104, doc.internal.pageSize.getWidth() - 190);
      let legendX = legendStartX;
      let legendY = currentY - 1;
      doc.setFont("Geist", "normal");
      doc.setFontSize(7);
      legendItems.forEach((item) => {
        const boxWidth = item.code.length > 1 ? 9 : 7;
        const itemWidth = boxWidth + 2 + doc.getTextWidth(item.label) + 4;
        if (legendX + itemWidth > pageRight) {
          legendX = legendStartX;
          legendY += 7;
        }
        doc.setFillColor(...item.fill);
        doc.rect(legendX, legendY + 1.3, boxWidth, 5, "F");
        doc.setTextColor(...item.text);
        doc.setFontSize(5.5);
        doc.setFont(item.code === "SUN" ? "Geist" : "Geist", item.code === "SUN" ? "normal" : "bold");
        doc.text(item.code, legendX + boxWidth / 2, legendY + 4.8, { align: "center" });
        doc.setFont("Geist", "normal");
        doc.setFontSize(7);
        doc.setTextColor(40, 40, 40);
        doc.text(item.label, legendX + boxWidth + 2, legendY + 4.8);
        legendX += itemWidth;
      });
      const tableStartY = Math.max(currentY + 11, legendY + 9);
      
      doc.setFontSize(10);

      const displayEmployees = attendanceReportEmployees;

      const employeeMap = {};
      displayEmployees.forEach(emp => {
        employeeMap[emp.id] = { name: emp.displayName || emp.username || "Unknown", totalMinutes: 0, days: {} };
      });

      filteredAttendanceRecords.forEach(record => {
        if (monthDates.includes(record.date) && employeeMap[record.userId]) {
          let val = record.status === "leave" ? "L" : record.status === "half-day" ? "HF" : "-";
          if (val === "-" && record.clockInAt && !record.clockOutAt) {
            val = "NCO";
          } else if (val === "-" && record.workMinutes != null) {
            val = (record.workMinutes / 60).toFixed(1);
          }
          employeeMap[record.userId].days[record.date] = val;
          employeeMap[record.userId].totalMinutes += (record.workMinutes || 0);
        }
      });

      const approvedLeaves = (data?.leaveRequests || []).filter(r => r.status === "approved");
      displayEmployees.forEach(emp => {
        const empLeaves = approvedLeaves.filter(r => r.userId === emp.id);
        monthDates.forEach(date => {
          if (!employeeMap[emp.id].days[date] || employeeMap[emp.id].days[date] === "-") {
            const leave = empLeaves.find(r => date >= r.startDate && date <= r.endDate);
            if (leave) {
              const isPaid = Number(leave.paidLeaveDays) > 0;
              employeeMap[emp.id].days[date] = isPaid ? "PL" : "L";
            } else {
              employeeMap[emp.id].days[date] = "-";
            }
          }
        });
      });

      const formatHeaderDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
      };

      const head = [["Employee", ...monthDates.map(formatHeaderDate), "Total Hrs", "Present Days", "Absent Days"]];

      const body = Object.values(employeeMap).map(emp => {
        const row = [emp.name];
        let presentDays = 0;
        let absentDays = 0;
        monthDates.forEach(date => {
          const isSunday = new Date(date).getDay() === 0;
          const val = emp.days[date] || "-";
          if (attendanceWorked(val)) {
            // Came in on a Sunday or a holiday — show what they actually did.
            row.push(val);
            presentDays += 1;
          } else if (noWorkingDaySet.has(date)) {
            // Declared holiday and no record: counts as present, never absent.
            row.push("NWD");
            presentDays += 1;
          } else if (isSunday) {
            // Not a working day, so it is neither present nor absent.
            row.push("SUN");
          } else {
            row.push(val);
            if (val === "-") absentDays += 1;
          }
        });
        row.push((emp.totalMinutes / 60).toFixed(1));
        row.push(presentDays);
        row.push(absentDays);
        return row;
      });

      const footRow = ["Total Hours"];
      let grandTotalMinutes = 0;
      let totalPresents = 0;
      let totalAbsents = 0;
      monthDates.forEach(date => {
        const isSunday = new Date(date).getDay() === 0;
        const dayTotalMins = filteredAttendanceRecords.filter(r => r.date === date).reduce((acc, r) => acc + (r.workMinutes || 0), 0);
        if (dayTotalMins) {
          // Somebody worked, so the footer shows hours rather than the marker.
          footRow.push((dayTotalMins / 60).toFixed(1));
        } else if (noWorkingDaySet.has(date)) {
          footRow.push("NWD");
        } else if (isSunday) {
          footRow.push("SUN");
        } else {
          footRow.push("-");
        }
        grandTotalMinutes += dayTotalMins;
      });
      
      Object.values(employeeMap).forEach(emp => {
        monthDates.forEach(date => {
          const isSunday = new Date(date).getDay() === 0;
          const val = emp.days[date] || "-";
          if (attendanceWorked(val)) { totalPresents += 1; return; }
          if (noWorkingDaySet.has(date)) { totalPresents += 1; return; }
          if (isSunday) return;
          if (val === "-") totalAbsents += 1;
        });
      });

      footRow.push((grandTotalMinutes / 60).toFixed(1));
      footRow.push(totalPresents);
      footRow.push(totalAbsents);

      autoTable(doc, {
        startY: tableStartY,
        margin: { top: 8, bottom: 5, left: 5, right: 5 },
        showFoot: "lastPage",
        head: head,
        body: body,
        foot: [footRow],
        theme: "grid",
        styles: { font: "Geist", fontSize: 7, cellPadding: 1.0, halign: "center", textColor: [40, 40, 40] },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: "wrap" } },
        headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        didParseCell: function(data) {
          if (data.cell.raw === "SUN") {
            data.cell.styles.fillColor = [240, 240, 240]; // light gray background
            data.cell.styles.textColor = [40, 40, 40];    // dark text
            data.cell.styles.fontStyle = "normal";
          } else if (data.section === "body") {
            if (data.cell.raw === "-") {
              data.cell.styles.fillColor = [254, 226, 226]; // light red
              data.cell.styles.textColor = [220, 38, 38];   // red text
            } else if (data.cell.raw === "NWD") {
              data.cell.styles.fillColor = [204, 251, 241]; // pale teal
              data.cell.styles.textColor = [15, 118, 110];  // deep teal
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.raw === "NCO") {
              data.cell.styles.fillColor = [255, 237, 213]; // light orange
              data.cell.styles.textColor = [234, 88, 12];   // dark orange
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.raw === "PL") {
              data.cell.styles.fillColor = [37, 99, 235];   // blue background
              data.cell.styles.textColor = [255, 255, 255]; // white text
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.raw === "L") {
              data.cell.styles.fillColor = [153, 27, 27];   // dark red background
              data.cell.styles.textColor = [255, 255, 255]; // white text
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.raw === "HF") {
              data.cell.styles.fillColor = [221, 214, 254]; // lavender
              data.cell.styles.textColor = [91, 33, 182];   // violet text
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });
    });

    const safeLabel = attendanceDateRangeLabel.replace(/\s+/g, '_').replace(/-/g, 'to');
    const safeSubject = attendanceReportSubject ? `_${attendanceReportSubject.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}` : "";
    doc.save(`Attendance_Report${safeSubject}_${safeLabel}.pdf`);
  };
  const currentEmployeeProfile = employees.find((employee) => employee.id === user?.id);
  const remoteWorkEnabled = Boolean(currentEmployeeProfile?.remoteWorkEnabled || data?.remoteWorkEnabled || user?.remoteWorkEnabled);
  const todayAttendance = attendanceRecords.find((record) => record.userId === user?.id && record.date === todayInput());
  const attendanceConfigured = Boolean(Number(attendanceSettings.latitude) && Number(attendanceSettings.longitude));
  const attendanceReady = attendanceConfigured || remoteWorkEnabled;
  const todayAttendanceRecords = myAttendanceRecords.filter((record) => record.date === todayInput());
  const todayAttendanceLabel = todayAttendance?.clockOutAt ? "Completed" : todayAttendance?.clockInAt ? "Checked in" : "Not marked";
  const todayWorkMinutes = Number(todayAttendance?.workMinutes || 0);
  const reportExempt = Boolean(todayReportExempt || data?.reportExempt);
  const mustFillReportBeforeClockOut = Boolean(todayAttendance?.clockInAt && !todayAttendance?.clockOutAt && !todayReportSubmitted && !reportExempt);
  const currentLeaveMonth = currentMonthInput();
  const currentMonthLeaveRequests = myLeaveRequests.filter((request) => leaveDaysInMonth(request, currentLeaveMonth) > 0);
  const approvedMonthLeaveRequests = currentMonthLeaveRequests.filter((request) => request.status === "approved");
  const monthlyPaidLeaveAllowance = data?.canManageHr
    ? activeEmployees.reduce((sum, employee) => sum + (employee.employmentType === "permanent" ? 1 : 0), 0)
    : ((employees.find((employee) => employee.id === user?.id)?.employmentType || user?.employmentType) === "permanent" ? 1 : 0);
  const currentMonthLeaveTaken = approvedMonthLeaveRequests.reduce((sum, request) => sum + leaveDaysInMonth(request, currentLeaveMonth), 0);
  const currentMonthPaidLeaves = approvedMonthLeaveRequests.reduce((sum, request) => sum + Math.min(leaveDaysInMonth(request, currentLeaveMonth), Number(request.paidLeaveDays || 0)), 0);
  const currentMonthAdvanceLeaves = approvedMonthLeaveRequests.reduce((sum, request) => sum + Math.min(leaveDaysInMonth(request, currentLeaveMonth), Number(request.unpaidLeaveDays || 0)), 0);
  const currentMonthPendingLeaves = currentMonthLeaveRequests.filter((request) => request.status === "pending").length;
  const remainingPaidLeaves = Math.max(0, monthlyPaidLeaveAllowance - currentMonthPaidLeaves);
  const selectedEmployeeLeaveHistory = selectedEmployee ? leaveRequests.filter((request) => request.userId === selectedEmployee.id) : [];
  const selectedEmployeeApprovedLeaves = selectedEmployeeLeaveHistory.filter((request) => request.status === "approved");
  const selectedEmployeeCurrentMonthLeaves = selectedEmployeeApprovedLeaves.filter((request) => leaveDaysInMonth(request, currentLeaveMonth) > 0);
  const selectedEmployeeMonthlyAllowance = selectedEmployee?.employmentType === "permanent" ? 1 : 0;
  const selectedEmployeeCurrentMonthPaidLeaves = selectedEmployeeCurrentMonthLeaves.reduce((sum, request) => sum + Math.min(leaveDaysInMonth(request, currentLeaveMonth), Number(request.paidLeaveDays || 0)), 0);
  const selectedEmployeePaidLeavesRemaining = Math.max(0, selectedEmployeeMonthlyAllowance - selectedEmployeeCurrentMonthPaidLeaves);
  const selectedEmployeeTotalLeavesTaken = selectedEmployeeApprovedLeaves.reduce((sum, request) => sum + (Number(request.days) || leaveDayCount(request.startDate, request.endDate)), 0);
  const selectedEmployeeTodayAttendance = selectedEmployee ? attendanceRecords.find((record) => record.userId === selectedEmployee.id && record.date === todayInput()) : null;
  const selectedEmployeeOnLeaveToday = selectedEmployeeTodayAttendance?.status === "leave";
  const selectedEmployeeHalfDayToday = selectedEmployeeTodayAttendance?.status === "half-day";
  const filteredEmployees = activeEmployees.filter((employee) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [employee.displayName, employee.username, employee.department, employee.designation, employee.roleName].some((value) => String(value || "").toLowerCase().includes(search));
  });

  const requestEmployeeOptions = ["All employees", ...activeEmployees.map((employee) => employee.displayName || employee.username).filter(Boolean)];
  const selectedRequestEmployee = requestEmployeeFilter === "All employees" ? null : activeEmployees.find((employee) => (employee.displayName || employee.username) === requestEmployeeFilter);
  const recentLeaveRequests = myLeaveRequests;
  const pendingSalaryRequests = [];
  const pendingDocumentRequests = [];
  const dashboardRequestItems = [
    ...recentLeaveRequests.map((request) => ({
      id: `leave-${request.id}`,
      kind: "Leave",
      userId: request.userId,
      employeeName: request.employeeName,
      department: request.department,
      title: request.leaveType,
      detail: `${request.days} day${request.days === 1 ? "" : "s"}`,
      period: `${request.startDate} to ${request.endDate}`,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
      onView: () => {
        setSelectedLeave(request);
        setReviewComment(request.adminComment || "");
      },
    })),
    ...pendingSalaryRequests,
    ...pendingDocumentRequests,
  ];
  const dashboardRequests = dashboardRequestItems.filter((request) => {
    if (requestTypeFilter !== "All" && request.kind !== requestTypeFilter) return false;
    if (selectedRequestEmployee && String(request.userId || "") !== String(selectedRequestEmployee.id || "")) return false;
    if (requestDateFilter.startDate && (request.endDate || request.startDate || "") < requestDateFilter.startDate) return false;
    if (requestDateFilter.endDate && (request.startDate || request.endDate || "") > requestDateFilter.endDate) return false;
    return true;
  });
  async function submitLeave(event) {
    event.preventDefault();
    try {
      setLeaveSaving(true);
      const response = await fetch(`${API_URL}/hr/leave-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit leave request");
      setData((current) => ({
        ...(current || {}),
        leaveRequests: [result.leaveRequest, ...((current?.leaveRequests) || [])],
      }));
      setLeaveForm({ leaveType: "", startDate: "", endDate: "", reason: "" });
      setLeaveDrawerOpen(false);
      window.dispatchEvent(new Event("uipl:notifications-changed"));
      window.dispatchEvent(new Event("uipl:hr-data-changed"));
      hrToast.success("Leave request sent for approval");
    } catch (error) {
      hrToast.error(error.message || "Could not submit leave request");
    } finally {
      setLeaveSaving(false);
    }
  }

  async function openSalaryDrawer(employeeId = "") {
    try {
      setEditingSalaryId("");
      const targetEmployeeId = data?.canManageHr ? (employeeId || salaryEmployeeId || activeEmployees[0]?.id || user?.id || "") : (user?.id || "");
      const meta = await api(`/hr/salary-slips/meta${targetEmployeeId ? `?userId=${encodeURIComponent(targetEmployeeId)}` : ""}`);
      setSalaryMeta(meta);
      setSalaryEmployeeId(targetEmployeeId);
      const profile = meta.profile || {};
      const company = meta.company || {};
      const currentMonth = currentMonthInput();
      const month = profile.joiningDate && currentMonth < profile.joiningDate.slice(0, 7) ? profile.joiningDate.slice(0, 7) : currentMonth;
      setSalaryForm((current) => ({
        ...current,
        month,
        userId: targetEmployeeId,
        payDate: endOfMonthInput(month),
        employeeName: profile.employeeName || user?.displayName || user?.username || "",
        designation: profile.designation || user?.designation || "",
        employeeCode: profile.employeeCode || user?.employeeCode || "",
        joiningDate: profile.joiningDate || user?.joiningDate || "",
        employmentType: profile.employmentType || "probation",
        monthlyInHandSalary: profile.monthlyInHandSalary || "",
        uan: profile.uan || "",
        paidDays: profile.paidDays || 30,
        lopDays: profile.lopDays || 0,
        basic: profile.monthlyInHandSalary || profile.basic || "",
        earnings: profile.earnings?.length ? profile.earnings : current.earnings,
        deductions: profile.deductions?.length ? profile.deductions : current.deductions,
        companyName: company.companyName || "UIPL Docs",
        companyLocation: company.companyLocation || "India",
        companyPhone: company.companyPhone || "",
        companyEmail: company.companyEmail || "",
        companyLogo: company.companyLogo || "",
        pfAccountNumber: company.pfAccountNumber || "",
        note: company.note || "",
      }));
      setSalaryDrawerOpen(true);
    } catch (error) {
      hrToast.error(error.message || "Could not load salary details");
    }
  }

  function handleSalaryEmployeeChange(label) {
    const employee = activeEmployees.find((item) => `${item.displayName || item.username} · ${item.roleName || "Employee"}` === label);
    if (employee) void openSalaryDrawer(employee.id);
  }

  async function editSalarySlip(doc) {
    try {
      const detail = await api(`/hr/salary-slips/${doc.id}`);
      const slip = detail.salarySlip || {};
      const meta = await api(`/hr/salary-slips/meta?userId=${encodeURIComponent(slip.userId || "")}`);
      const company = meta.company || {};
      setSalaryMeta(meta);
      setEditingSalaryId(doc.id);
      setSalaryEmployeeId(slip.userId || "");
      setSalaryForm((current) => ({
        ...current,
        userId: slip.userId || "",
        month: slip.month || currentMonthInput(),
        payDate: slip.payDate || endOfMonthInput(slip.month || currentMonthInput()),
        employeeName: slip.employeeName || "",
        designation: slip.designation || "",
        employeeCode: slip.employeeCode || "",
        joiningDate: slip.joiningDate || "",
        employmentType: slip.employmentType || meta.profile?.employmentType || "probation",
        monthlyInHandSalary: slip.monthlyInHandSalary || meta.profile?.monthlyInHandSalary || "",
        uan: slip.uan || "",
        paidDays: slip.paidDays || 30,
        lopDays: slip.lopDays || 0,
        basic: slip.monthlyInHandSalary || slip.basic || "",
        earnings: slip.earnings?.filter((item) => !/^basic(\s+salary)?$/i.test(String(item.label || "").trim()))?.length ? slip.earnings.filter((item) => !/^basic(\s+salary)?$/i.test(String(item.label || "").trim())) : current.earnings,
        deductions: slip.deductions?.length ? slip.deductions : current.deductions,
        companyName: company.companyName || "UIPL Docs",
        companyLocation: company.companyLocation || "India",
        companyPhone: company.companyPhone || "",
        companyEmail: company.companyEmail || "",
        companyLogo: company.companyLogo || "",
        pfAccountNumber: company.pfAccountNumber || "",
        note: company.note || "",
      }));
      setSalaryDrawerOpen(true);
    } catch (error) {
      hrToast.error(error.message || "Could not load salary slip");
    }
  }

  async function deleteSalarySlip(doc) {
    try {
      const response = await fetch(`${API_URL}/hr/salary-slips/${doc.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete salary slip");
      setData((current) => ({ ...(current || {}), salarySlips: (current?.salarySlips || []).filter((item) => item.id !== doc.id) }));
      hrToast.success("Salary slip deleted");
    } catch (error) {
      hrToast.error(error.message || "Could not delete salary slip");
    } finally {
      setSalaryDeleteTarget(null);
    }
  }

  function updateSalaryComponent(type, index, patch) {
    setSalaryForm((current) => ({
      ...current,
      [type]: current[type].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function addSalaryComponent(type) {
    setSalaryForm((current) => ({ ...current, [type]: [...current[type], { label: "", amount: "" }] }));
  }

  function openEmployeeDetail(employee) {
    setSelectedEmployee(employee);
    setEmployeeDetailExpanded(false);
    setEmployeeForm({
      employmentType: employee?.employmentType || "probation",
      monthlyInHandSalary: employee?.monthlyInHandSalary || "",
      remoteWorkEnabled: Boolean(employee?.remoteWorkEnabled),
    });
  }

  async function saveEmployeeHrDetails(event) {
    event.preventDefault();
    if (!selectedEmployee?.id) return;
    try {
      setEmployeeSaving(true);
      const response = await fetch(`${API_URL}/hr/employees/${selectedEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update employee");
      setData((current) => ({
        ...(current || {}),
        employees: (current?.employees || []).map((item) => item.id === result.employee.id ? result.employee : item),
      }));
      setSelectedEmployee(result.employee);
      hrToast.success("Employee HR details updated");
    } catch (error) {
      hrToast.error(error.message || "Could not update employee");
    } finally {
      setEmployeeSaving(false);
    }
  }

  async function saveEmployeeRemoteWork(remoteWorkEnabled) {
    if (!selectedEmployee?.id || employeeRemoteSavingId) return;
    const nextForm = { ...employeeForm, remoteWorkEnabled };
    setEmployeeForm(nextForm);
    try {
      setEmployeeRemoteSavingId(selectedEmployee.id);
      const response = await fetch(`${API_URL}/hr/employees/${selectedEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update remote work");
      setData((current) => ({
        ...(current || {}),
        employees: (current?.employees || []).map((item) => item.id === result.employee.id ? result.employee : item),
      }));
      setSelectedEmployee(result.employee);
      hrToast.success(remoteWorkEnabled ? "Remote work enabled" : "Remote work disabled");
    } catch (error) {
      setEmployeeForm((current) => ({ ...current, remoteWorkEnabled: Boolean(selectedEmployee?.remoteWorkEnabled) }));
      hrToast.error(error.message || "Could not update remote work");
    } finally {
      setEmployeeRemoteSavingId("");
    }
  }

  async function saveEmployeeRemoteWorkFor(employee, remoteWorkEnabled) {
    if (!employee?.id || employeeRemoteSavingId) return;
    const patch = {
      employmentType: employee.employmentType || "probation",
      monthlyInHandSalary: employee.monthlyInHandSalary || 0,
      remoteWorkEnabled,
    };
    try {
      setEmployeeRemoteSavingId(employee.id);
      const response = await fetch(`${API_URL}/hr/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update remote work");
      setData((current) => ({
        ...(current || {}),
        employees: (current?.employees || []).map((item) => item.id === result.employee.id ? result.employee : item),
      }));
      if (selectedEmployee?.id === result.employee.id) {
        setSelectedEmployee(result.employee);
        setEmployeeForm((current) => ({ ...current, remoteWorkEnabled: Boolean(result.employee.remoteWorkEnabled) }));
      }
      hrToast.success(remoteWorkEnabled ? "Remote work enabled" : "Remote work disabled");
    } catch (error) {
      hrToast.error(error.message || "Could not update remote work");
    } finally {
      setEmployeeRemoteSavingId("");
    }
  }

  function mergeAttendanceRecord(record) {
    setData((current) => {
      const records = current?.attendanceRecords || [];
      if (!record) {
        return { ...(current || {}), attendanceRecords: records.filter((item) => !(item.userId === selectedEmployee?.id && item.date === todayInput() && item.manualStatus)) };
      }
      const exists = records.some((item) => item.id === record.id || (item.userId === record.userId && item.date === record.date));
      const nextRecords = exists
        ? records.map((item) => (item.id === record.id || (item.userId === record.userId && item.date === record.date)) ? record : item)
        : [record, ...records];
      return { ...(current || {}), attendanceRecords: nextRecords };
    });
  }

  async function saveEmployeeManualAttendance(status) {
    if (!selectedEmployee?.id || employeeRemoteSavingId) return;
    try {
      setEmployeeRemoteSavingId(selectedEmployee.id);
      const response = await fetch(`${API_URL}/hr/attendance/manual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedEmployee.id, date: todayInput(), status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update attendance");
      mergeAttendanceRecord(result.record || null);
      hrToast.success(status === "half-day" ? "Half day marked" : status === "leave" ? "Leave marked" : "Attendance mark cleared");
    } catch (error) {
      hrToast.error(error.message || "Could not update attendance");
    } finally {
      setEmployeeRemoteSavingId("");
    }
  }

  // A Set of the marked dates, used by the grid and the PDF alike.
  const noWorkingDaySet = useMemo(() => new Set((noWorkingDays || []).map((day) => day.date)), [noWorkingDays]);

  async function saveNoWorkingDay() {
    if (!nwdForm.date) { hrToast.error("Pick a date first"); return; }
    try {
      setNwdSaving(true);
      const response = await fetch(`${API_URL}/hr/attendance/no-working-days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nwdForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not mark the day");
      setNoWorkingDays(result.days || []);
      hrToast.success(`${formatDateLabel(nwdForm.date)} marked as a no working day`);
      setNwdForm({ date: todayInput(), label: "" });
      await loadHr();
    } catch (error) {
      hrToast.error(error.message || "Could not mark the day");
    } finally {
      setNwdSaving(false);
    }
  }

  async function removeNoWorkingDay(date) {
    try {
      setNwdSaving(true);
      const response = await fetch(`${API_URL}/hr/attendance/no-working-days/${date}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not remove the day");
      setNoWorkingDays(result.days || []);
      hrToast.success(`${formatDateLabel(date)} is a working day again`);
      await loadHr();
    } catch (error) {
      hrToast.error(error.message || "Could not remove the day");
    } finally {
      setNwdSaving(false);
    }
  }

  function openAttendanceAdjustment(record = null) {
    const fallbackEmployee = activeEmployees[0];
    const userId = record?.userId || fallbackEmployee?.id || "";
    const date = record?.date || attendanceDateFilter.startDate || todayInput();
    setAttendanceAdjustMode("single");
    setAttendanceAdjustForm({
      userId,
      date,
      clockInTime: timeInputFromDate(record?.clockInAt, "10:30"),
      clockOutTime: timeInputFromDate(record?.clockOutAt, "19:30"),
      workMode: record?.workMode || "office",
      reason: "",
    });
    setAttendanceAdjustRows([{ date, clockInTime: timeInputFromDate(record?.clockInAt, ""), clockOutTime: timeInputFromDate(record?.clockOutAt, ""), workMode: record?.workMode || "office", reason: "" }]);
    setAttendanceAdjustOpen(true);
    if (!record) void applyAttendanceAdjustmentDate(userId, date);
  }

  function attendanceAdjustmentPatch(userId, date) {
    const record = attendanceRecords.find((item) => String(item.userId || "") === String(userId || "") && item.date === date);
    return {
      clockInTime: timeInputFromDate(record?.clockInAt, ""),
      clockOutTime: timeInputFromDate(record?.clockOutAt, ""),
      workMode: record?.workMode || "office",
    };
  }

  async function fetchAttendanceRecordForDate(userId, date) {
    if (!userId || !date) return null;
    const localRecord = attendanceRecords.find((item) => String(item.userId || "") === String(userId || "") && item.date === date);
    if (localRecord) return localRecord;
    const params = new URLSearchParams({ startDate: date, endDate: date });
    const result = await api(`/hr/attendance?${params.toString()}`);
    const records = result.records || [];
    return records.find((item) => String(item.userId || "") === String(userId || "") && item.date === date) || null;
  }

  async function applyAttendanceAdjustmentDate(userId, date) {
    setAttendanceAdjustForm((current) => ({ ...current, userId, date, ...attendanceAdjustmentPatch(userId, date) }));
    try {
      const record = await fetchAttendanceRecordForDate(userId, date);
      if (!record) return;
      setAttendanceAdjustForm((current) => {
        if (String(current.userId || "") !== String(userId || "") || current.date !== date) return current;
        return { ...current, ...attendanceAdjustmentPatchFromRecord(record) };
      });
      setAttendanceAdjustRows((rows) => rows.map((row, index) => (
        index === 0 && row.date === date
          ? { ...row, ...attendanceAdjustmentPatchFromRecord(record) }
          : row
      )));
      mergeAttendanceRecord(record);
    } catch {
      // The local patch still gives a usable form if the one-day lookup fails.
    }
  }

  function attendanceAdjustmentPatchFromRecord(record = {}) {
    return {
      clockInTime: timeInputFromDate(record.clockInAt, ""),
      clockOutTime: timeInputFromDate(record.clockOutAt, ""),
      workMode: record.workMode || "office",
    };
  }

  function updateAttendanceAdjustRow(index, patch) {
    setAttendanceAdjustRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function addAttendanceAdjustRow() {
    setAttendanceAdjustRows((rows) => [...rows, { date: todayInput(), ...attendanceAdjustmentPatch(attendanceAdjustForm.userId, todayInput()), reason: "" }]);
  }

  function removeAttendanceAdjustRow(index) {
    setAttendanceAdjustRows((rows) => rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index));
  }

  async function applyAttendanceAdjustRowDate(index, date, userId = attendanceAdjustForm.userId) {
    updateAttendanceAdjustRow(index, { date, ...attendanceAdjustmentPatch(userId, date) });
    try {
      const record = await fetchAttendanceRecordForDate(userId, date);
      if (!record) return;
      setAttendanceAdjustRows((rows) => rows.map((row, rowIndex) => (
        rowIndex === index && row.date === date
          ? { ...row, ...attendanceAdjustmentPatchFromRecord(record) }
          : row
      )));
      mergeAttendanceRecord(record);
    } catch {
      // Keep the local/default row values if the one-day lookup fails.
    }
  }

  async function applyAttendanceAdjustEmployee(userId) {
    setAttendanceAdjustForm((current) => ({ ...current, userId, ...attendanceAdjustmentPatch(userId, current.date) }));
    const rows = attendanceAdjustRows;
    rows.forEach((row, index) => {
      void applyAttendanceAdjustRowDate(index, row.date, userId);
    });
    void applyAttendanceAdjustmentDate(userId, attendanceAdjustForm.date);
  }

  async function saveAttendanceAdjustment(event) {
    event.preventDefault();
    if (!attendanceAdjustForm.userId) {
      hrToast.error("Choose an employee");
      return;
    }
    try {
      setAttendanceAdjustSaving(true);
      const payloads = attendanceAdjustMode === "bulk"
        ? attendanceAdjustRows.filter((row) => row.date || row.clockInTime || row.clockOutTime || row.reason).map((row) => ({ ...row, userId: attendanceAdjustForm.userId }))
        : [attendanceAdjustForm];
      const savedRecords = [];
      for (const payload of payloads) {
        const response = await fetch(`${API_URL}/hr/attendance/adjust-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not adjust attendance");
        if (result.record) {
          mergeAttendanceRecord(result.record);
          savedRecords.push(result.record);
        }
      }
      if (savedRecords.length) {
        const dates = savedRecords.map((record) => record.date).filter(Boolean).sort();
        setAttendanceDateFilter((current) => ({
          startDate: !current.startDate || dates[0] < current.startDate ? dates[0] : current.startDate,
          endDate: !current.endDate || dates[dates.length - 1] > current.endDate ? dates[dates.length - 1] : current.endDate,
        }));
      }
      setAttendanceAdjustOpen(false);
      hrToast.success(attendanceAdjustMode === "bulk" ? "Attendance adjustments saved" : "Attendance time adjusted");
    } catch (error) {
      hrToast.error(error.message || "Could not adjust attendance");
    } finally {
      setAttendanceAdjustSaving(false);
    }
  }

  function openAttendanceRequest(record = null, mode = "single") {
    setAttendanceRequestMode(mode);
    const date = record?.date || attendanceDateFilter.startDate || todayInput();
    const patch = record ? {
      clockInTime: timeInputFromDate(record.clockInAt, "10:30"),
      clockOutTime: timeInputFromDate(record.clockOutAt, record.date === todayInput() ? "" : "19:30"),
      workMode: record.workMode || "office",
    } : attendanceRequestPatch(date);
    setAttendanceRequestRows([{
      date,
      ...patch,
      reason: "",
    }]);
    setAttendanceRequestOpen(true);
    if (!record) void applyAttendanceRequestDate(0, date);
  }

  function attendanceRequestPatch(date) {
    const record = attendanceRecords.find((item) => String(item.userId || "") === String(user?.id || "") && item.date === date);
    return {
      clockInTime: timeInputFromDate(record?.clockInAt, "10:30"),
      clockOutTime: timeInputFromDate(record?.clockOutAt, date === todayInput() ? "" : "19:30"),
      workMode: record?.workMode || "office",
    };
  }

  function attendanceRequestPatchFromRecord(record = {}, date = "") {
    return {
      clockInTime: timeInputFromDate(record.clockInAt, "10:30"),
      clockOutTime: timeInputFromDate(record.clockOutAt, date === todayInput() ? "" : "19:30"),
      workMode: record.workMode || "office",
    };
  }

  function updateAttendanceRequestRow(index, patch) {
    setAttendanceRequestRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  async function applyAttendanceRequestDate(index, date) {
    updateAttendanceRequestRow(index, { date, ...attendanceRequestPatch(date) });
    try {
      const record = await fetchAttendanceRecordForDate(user?.id, date);
      if (!record) return;
      setAttendanceRequestRows((rows) => rows.map((row, rowIndex) => (
        rowIndex === index && row.date === date
          ? { ...row, ...attendanceRequestPatchFromRecord(record, date) }
          : row
      )));
      mergeAttendanceRecord(record);
    } catch {
      // Keep the local/default times if the one-day lookup fails.
    }
  }

  function addAttendanceRequestRow() {
    const date = todayInput();
    setAttendanceRequestRows((rows) => [...rows, { date, ...attendanceRequestPatch(date), reason: "" }]);
  }

  function removeAttendanceRequestRow(index) {
    setAttendanceRequestRows((rows) => rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index));
  }

  async function submitAttendanceAdjustmentRequest(event) {
    event.preventDefault();
    const rows = attendanceRequestRows.filter((row) => row.date || row.clockInTime || row.clockOutTime || row.reason);
    if (!rows.length) {
      hrToast.error("Add at least one adjustment row");
      return;
    }
    try {
      setAttendanceRequestSaving(true);
      const response = await fetch(`${API_URL}/hr/attendance/adjustment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: attendanceRequestMode === "bulk" ? rows : rows.slice(0, 1) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit adjustment request");
      setData((current) => ({
        ...(current || {}),
        attendanceAdjustmentRequests: [result.request, ...(current?.attendanceAdjustmentRequests || [])],
      }));
      setAttendanceRequestOpen(false);
      setAttendanceRequestRows([{ date: todayInput(), clockInTime: "10:30", clockOutTime: "19:30", workMode: "office", reason: "" }]);
      hrToast.success("Adjustment request sent");
    } catch (error) {
      hrToast.error(error.message || "Could not submit adjustment request");
    } finally {
      setAttendanceRequestSaving(false);
    }
  }

  async function validateAttendanceAdjustmentRequest(request) {
    if (!request?.id || attendanceRequestReviewingId) return;
    try {
      setAttendanceRequestReviewingId(request.id);
      const response = await fetch(`${API_URL}/hr/attendance/adjustment-requests/${request.id}/validate`, { method: "PATCH" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not validate request");
      setData((current) => {
        const records = current?.attendanceRecords || [];
        const nextRecords = [...records];
        (result.records || []).forEach((record) => {
          const index = nextRecords.findIndex((item) => item.id === record.id || (item.userId === record.userId && item.date === record.date));
          if (index >= 0) nextRecords[index] = record;
          else nextRecords.unshift(record);
        });
        return {
          ...(current || {}),
          attendanceRecords: nextRecords,
          attendanceAdjustmentRequests: (current?.attendanceAdjustmentRequests || []).map((item) => item.id === result.request?.id ? result.request : item),
        };
      });
      if (result.records?.length) {
        setAttendanceDateFilter((current) => {
          const dates = result.records.map((record) => record.date).filter(Boolean).sort();
          return {
            startDate: !current.startDate || dates[0] < current.startDate ? dates[0] : current.startDate,
            endDate: !current.endDate || dates[dates.length - 1] > current.endDate ? dates[dates.length - 1] : current.endDate,
          };
        });
      }
      hrToast.success("Adjustment request validated");
    } catch (error) {
      hrToast.error(error.message || "Could not validate request");
    } finally {
      setAttendanceRequestReviewingId("");
    }
  }

  async function uploadEmployeeDocument(type, files) {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (!selectedEmployee?.id || !selectedFiles.length) return;
    const formData = new FormData();
    try {
      setEmployeeDocumentUploading(type);
      let result = null;
      for (const [index, file] of selectedFiles.entries()) {
        setEmployeeDocumentUploadProgress((current) => ({ ...current, [type]: { current: index + 1, total: selectedFiles.length, name: file.name } }));
        formData.delete("file");
        formData.delete("type");
        formData.append("file", file);
        formData.append("type", type);
        const response = await fetch(`${API_URL}/hr/employees/${selectedEmployee.id}/documents/upload`, {
          method: "POST",
          body: formData,
        });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not upload document");
      }
      if (!result?.employee) throw new Error("Could not upload document");
      setData((current) => ({
        ...(current || {}),
        employees: (current?.employees || []).map((item) => item.id === result.employee.id ? result.employee : item),
      }));
      setSelectedEmployee(result.employee);
      hrToast.success(selectedFiles.length > 1 ? "Documents uploaded to Drive" : "Document uploaded to Drive");
    } catch (error) {
      hrToast.error(error.message || "Could not upload document");
    } finally {
      setEmployeeDocumentUploading("");
      setEmployeeDocumentUploadProgress((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
    }
  }

  async function saveEmployeeDocumentLink(docType) {
    if (!selectedEmployee?.id) return;
    const url = window.prompt(`Paste Drive link for ${docType.label}`);
    if (!url?.trim()) return;
    const name = window.prompt("Document name", docType.label) || docType.label;
    try {
      setEmployeeDocumentUploading(docType.id);
      const response = await fetch(`${API_URL}/hr/employees/${selectedEmployee.id}/documents/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: docType.id, name, url }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save document link");
      setData((current) => ({
        ...(current || {}),
        employees: (current?.employees || []).map((item) => item.id === result.employee.id ? result.employee : item),
      }));
      setSelectedEmployee(result.employee);
      hrToast.success("Document link saved");
    } catch (error) {
      hrToast.error(error.message || "Could not save document link");
    } finally {
      setEmployeeDocumentUploading("");
    }
  }

  async function loadTodayReportStatus() {
    try {
      setTodayReportChecking(true);
      const response = await fetch(`${API_URL}/employee-daily-report`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load daily report status");
      setTodayReportSubmitted(Boolean(result.todaySubmitted));
      setTodayReportExempt(Boolean(result.profile?.reportExempt));
    } catch {
      setTodayReportSubmitted(false);
      setTodayReportExempt(false);
    } finally {
      setTodayReportChecking(false);
    }
  }

  function browserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported in this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
        () => reject(new Error("Could not read your current location. Please allow location access.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  async function findAttendanceAddress(searchText = attendanceForm.address, notify = true) {
    const queryText = String(searchText || "").trim();
    if (queryText.length < 3) {
      setAttendanceSearchResults([]);
      if (notify) hrToast.error("Type at least 3 characters to search");
      return;
    }
    try {
      setAttendanceLocating(true);
      const maps = await loadGoogleMaps();
      let matches = [];
      if (maps.places?.AutocompleteService) {
        const service = new maps.places.AutocompleteService();
        const predictions = await new Promise((resolve) => {
          service.getPlacePredictions({ input: queryText, componentRestrictions: { country: "in" } }, (items, status) => {
            resolve(status === maps.places.PlacesServiceStatus.OK && Array.isArray(items) ? items : []);
          });
        });
        matches = predictions.slice(0, 7).map((item) => ({
          place_id: item.place_id,
          name: item.structured_formatting?.main_text || item.description?.split(",")?.[0] || "Location",
          display_name: item.description,
          lat: null,
          lon: null,
          prediction: true,
        }));
      }
      if (!matches.length) {
        const geocoder = attendanceGoogleGeocoderRef.current || new maps.Geocoder();
        attendanceGoogleGeocoderRef.current = geocoder;
        const response = await geocoder.geocode({ address: queryText });
        matches = (response.results || []).slice(0, 7).map((item) => ({
          place_id: item.place_id,
          name: item.address_components?.[0]?.long_name || item.formatted_address?.split(",")?.[0] || "Location",
          display_name: item.formatted_address,
          lat: item.geometry.location.lat(),
          lon: item.geometry.location.lng(),
        }));
      }
      if (!matches.length) {
        setAttendanceSearchResults([]);
        if (notify) throw new Error("Could not find this address");
        return;
      }
      setAttendanceSearchResults(matches);
      if (notify) hrToast.success(`${matches.length} location${matches.length === 1 ? "" : "s"} found`);
    } catch (error) {
      if (notify) hrToast.error(error.message || "Could not find location");
    } finally {
      setAttendanceLocating(false);
    }
  }

  function handleAttendanceAddressInput(value) {
    setAttendanceForm((current) => ({ ...current, address: value }));
    if (attendanceSearchTimerRef.current) window.clearTimeout(attendanceSearchTimerRef.current);
    const queryText = value.trim();
    if (queryText.length < 3) {
      setAttendanceSearchResults([]);
      return;
    }
    attendanceSearchTimerRef.current = window.setTimeout(() => {
      void findAttendanceAddress(queryText, false);
    }, 450);
  }

  async function searchTypedAttendanceAddress() {
    const queryText = String(attendanceForm.address || "").trim();
    if (queryText.length < 3) {
      hrToast.error("Type at least 3 characters to search");
      return;
    }
    try {
      setAttendanceLocating(true);
      const maps = await loadGoogleMaps();
      const geocoder = attendanceGoogleGeocoderRef.current || new maps.Geocoder();
      attendanceGoogleGeocoderRef.current = geocoder;
      const response = await geocoder.geocode({ address: queryText, componentRestrictions: { country: "IN" } });
      const match = response.results?.[0];
      if (!match?.geometry?.location) throw new Error("Could not find this address");
      setAttendanceForm((current) => ({
        ...current,
        address: match.formatted_address || queryText,
        latitude: match.geometry.location.lat(),
        longitude: match.geometry.location.lng(),
      }));
      setAttendanceSearchResults([]);
    } catch (error) {
      hrToast.error(error.message || "Could not find location");
    } finally {
      setAttendanceLocating(false);
    }
  }

  async function selectAttendanceSearchResult(item) {
    try {
      setAttendanceLocating(true);
      let nextLocation = item;
      const hasCoordinates = item.lat !== null && item.lat !== undefined && item.lon !== null && item.lon !== undefined && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon));
      if (!hasCoordinates && item.place_id) {
        const maps = await loadGoogleMaps();
        let resolved = null;
        if (maps.places?.PlacesService) {
          const serviceNode = document.createElement("div");
          const placesService = new maps.places.PlacesService(serviceNode);
          resolved = await new Promise((resolve) => {
            placesService.getDetails({ placeId: item.place_id, fields: ["formatted_address", "geometry", "name"] }, (place, status) => {
              resolve(status === maps.places.PlacesServiceStatus.OK ? place : null);
            });
          });
        }
        if (resolved?.geometry?.location) {
          nextLocation = {
            ...item,
            name: resolved.name || item.name,
            display_name: resolved.formatted_address || item.display_name,
            lat: resolved.geometry.location.lat(),
            lon: resolved.geometry.location.lng(),
          };
        } else {
          const geocoder = attendanceGoogleGeocoderRef.current || new maps.Geocoder();
          attendanceGoogleGeocoderRef.current = geocoder;
          const response = await geocoder.geocode({ placeId: item.place_id });
          const match = response.results?.[0];
          if (match?.geometry?.location) {
            nextLocation = {
              ...item,
              display_name: match.formatted_address || item.display_name,
              lat: match.geometry.location.lat(),
              lon: match.geometry.location.lng(),
            };
          }
        }
      }
      if (nextLocation.lat === null || nextLocation.lat === undefined || nextLocation.lon === null || nextLocation.lon === undefined || !Number.isFinite(Number(nextLocation.lat)) || !Number.isFinite(Number(nextLocation.lon))) {
        throw new Error("Could not get coordinates for this place");
      }
      setAttendanceForm((current) => ({
        ...current,
        address: nextLocation.display_name || current.address,
        latitude: Number(nextLocation.lat),
        longitude: Number(nextLocation.lon),
      }));
      setAttendanceSearchResults([]);
    } catch (error) {
      hrToast.error(error.message || "Could not select location");
    } finally {
      setAttendanceLocating(false);
    }
  }

  async function useCurrentAttendanceLocation() {
    try {
      setAttendanceLocating(true);
      const location = await browserLocation();
      setAttendanceForm((current) => ({ ...current, latitude: location.latitude, longitude: location.longitude }));
      setAttendanceSearchResults([]);
      hrToast.success("Current location captured");
    } catch (error) {
      hrToast.error(error.message || "Could not get location");
    } finally {
      setAttendanceLocating(false);
    }
  }

  function closeAttendanceSettings() {
    setAttendanceSettingsOpen(false);
    setAttendanceSettingsExpanded(false);
  }

  async function saveAttendanceSettings(event) {
    event.preventDefault();
    try {
      setAttendanceSaving(true);
      const response = await fetch(`${API_URL}/hr/attendance/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendanceForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save attendance location");
      setData((current) => ({ ...(current || {}), attendanceSettings: result.settings }));
      setAttendanceSearchResults([]);
      closeAttendanceSettings();
      hrToast.success("Attendance location saved");
    } catch (error) {
      hrToast.error(error.message || "Could not save attendance location");
    } finally {
      setAttendanceSaving(false);
    }
  }

  async function submitAttendance(action) {
    try {
      setAttendanceClockAction(action);
      setAttendanceSaving(true);
      let location = {};
      try {
        location = await browserLocation();
      } catch (error) {
        if (!remoteWorkEnabled) throw error;
      }
      const response = await fetch(`${API_URL}/hr/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update attendance");
      setData((current) => {
        const records = current?.attendanceRecords || [];
        const nextRecords = records.some((record) => record.id === result.record.id)
          ? records.map((record) => record.id === result.record.id ? result.record : record)
          : [result.record, ...records];
        return { ...(current || {}), attendanceSettings: result.settings || current?.attendanceSettings, attendanceRecords: nextRecords };
      });
      if (action === "clock-in") void loadTodayReportStatus();
      hrToast.success(action === "clock-in" ? "Clocked in" : "Clocked out");
    } catch (error) {
      hrToast.error(error.message || "Could not update attendance");
    } finally {
      setAttendanceClockAction("");
      setAttendanceSaving(false);
    }
  }

  async function downloadSalarySlip(doc) {
    const response = await fetch(`${API_URL}/hr/salary-slips/${doc.id}/pdf`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Could not download salary slip");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(doc.title || "salary-slip").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submitSalarySlip(event) {
    event.preventDefault();
    try {
      setSalarySaving(true);
      if (salaryForm.joiningDate && monthStart(salaryForm.month) < monthStart(salaryForm.joiningDate.slice(0, 7))) {
        throw new Error("Salary slip cannot be generated before joining date");
      }
      if (!canManageSalary) {
        const existingSlip = salarySlips.find((doc) => String(doc.userId || "") === String(user?.id || "") && doc.month === salaryForm.month);
        if (existingSlip) {
          await downloadSalarySlip(existingSlip);
          setSalaryDrawerOpen(false);
          return;
        }
      }
      if (!editingSalaryId && salarySlips.some((doc) => String(doc.userId || "") === String(salaryForm.userId || "") && doc.month === salaryForm.month)) {
        throw new Error("Salary slip already exists for this employee and month");
      }
      if (salaryMeta?.canEditCompany) {
        await fetch(`${API_URL}/hr/salary-slips/company`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: salaryForm.companyName,
            companyLocation: salaryForm.companyLocation,
            companyPhone: salaryForm.companyPhone,
            companyEmail: salaryForm.companyEmail,
            companyLogo: salaryForm.companyLogo,
            pfAccountNumber: salaryForm.pfAccountNumber,
            note: salaryForm.note,
          }),
        });
      }
      const response = await fetch(`${API_URL}/hr/salary-slips${editingSalaryId ? `/${editingSalaryId}` : "/generate"}`, {
        method: editingSalaryId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salaryForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || (editingSalaryId ? "Could not update salary slip" : "Could not generate salary slip"));
      setData((current) => ({
        ...(current || {}),
        salarySlips: editingSalaryId
          ? (current?.salarySlips || []).map((item) => item.id === result.salarySlip.id ? result.salarySlip : item)
          : [result.salarySlip, ...((current?.salarySlips) || [])],
      }));
      setSalaryDrawerOpen(false);
      setEditingSalaryId("");
      hrToast.success(editingSalaryId ? "Salary slip updated" : "Salary slip generated");
      if (!editingSalaryId) await downloadSalarySlip(result.salarySlip);
    } catch (error) {
      hrToast.error(error.message || "Could not generate salary slip");
    } finally {
      setSalarySaving(false);
    }
  }

  async function reviewLeave(status) {
    if (!selectedLeave) return;
    try {
      setLeaveReviewSaving(true);
      const response = await fetch(`${API_URL}/hr/leave-requests/${selectedLeave.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminComment: reviewComment }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not review leave request");
      setData((current) => ({
        ...(current || {}),
        leaveRequests: (current?.leaveRequests || []).map((request) => request.id === result.leaveRequest.id ? result.leaveRequest : request),
      }));
      setSelectedLeave(result.leaveRequest);
      setReviewComment("");
      window.dispatchEvent(new Event("uipl:notifications-changed"));
      window.dispatchEvent(new Event("uipl:hr-data-changed"));
      hrToast.success(status === "approved" ? "Leave approved" : "Leave declined");
    } catch (error) {
      hrToast.error(error.message || "Could not review leave request");
    } finally {
      setLeaveReviewSaving(false);
    }
  }

  async function deleteLeave(request) {
    if (!request?.id) return;
    try {
      const response = await fetch(`${API_URL}/hr/leave-requests/${request.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete leave request");
      setData((current) => ({
        ...(current || {}),
        leaveRequests: (current?.leaveRequests || []).filter((item) => item.id !== request.id),
      }));
      if (selectedLeave?.id === request.id) setSelectedLeave(null);
      window.dispatchEvent(new Event("uipl:notifications-changed"));
      window.dispatchEvent(new Event("uipl:hr-data-changed"));
      hrToast.success("Leave request deleted");
    } catch (error) {
      hrToast.error(error.message || "Could not delete leave request");
    }
  }

  function canDeleteLeave(request) {
    return request?.status === "pending" && String(request?.userId || "") === String(user?.id || "");
  }

  function statusTone(status) {
    if (status === "approved" || status === "completed") return "mint";
    if (status === "declined") return "rose";
    return "amber";
  }

  function statusChip(status, className = "") {
    return <Chip tone={statusTone(status)} darkMode={darkMode} className={cx("capitalize", className)}>{status}</Chip>;
  }

  function timelineDotClass(type) {
    if (type === "submitted") return "bg-[#2f6fc0]";
    if (type === "approved") return "bg-[#2f7a4f]";
    if (type === "declined") return "bg-[#c0394b]";
    return darkMode ? "bg-white/20" : "bg-[#dcdcd8]";
  }

  function timelineLineClass() {
    return darkMode ? "bg-white/10" : "bg-[#e8e8e6]";
  }

  function renderAttendanceAdjustmentRequest(request, { compact = false } = {}) {
    const firstItem = request.items?.[0] || {};
    return (
      <div key={request.id} className={cx("flex flex-col gap-3 rounded-[14px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between", compact ? (darkMode ? "bg-white/[0.04]" : "bg-white") : (darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"))}>
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={Clock3} tone={statusTone(request.status)} darkMode={darkMode} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px]">{data?.canManageHr ? request.employeeName : `${request.items?.length || 0} adjustment row${request.items?.length === 1 ? "" : "s"}`}</p>
              {statusChip(request.status, "h-6 px-2.5 text-[11.5px]")}
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>
              {firstItem.date ? formatDateLabel(firstItem.date) : "No date"} · {firstItem.clockInTime ? displayTimeInput(firstItem.clockInTime) : "-"}{firstItem.clockOutTime ? ` - ${displayTimeInput(firstItem.clockOutTime)}` : ""}
              {(request.items?.length || 0) > 1 ? ` · +${request.items.length - 1} more` : ""}
            </p>
          </div>
        </div>
        {data?.canManageHr && request.status === "pending" && (
          <Button darkMode={darkMode} variant="primary" size="sm" onClick={() => validateAttendanceAdjustmentRequest(request)} disabled={Boolean(attendanceRequestReviewingId)} icon={attendanceRequestReviewingId === request.id ? undefined : Check} loading={attendanceRequestReviewingId === request.id}>
            Validate
          </Button>
        )}
      </div>
    );
  }

  const hero = {
    dashboard: {
      eyebrow: "HR workspace",
      icon: BriefcaseBusiness,
      tone: "lavender",
      title: "HR requests",
      subtitle: "and approvals in one place",
      text: "Review leave applications from every employee in one table.",
    },
    employees: {
      eyebrow: "Employee records",
      icon: Users,
      tone: "sky",
      title: "Employees",
      subtitle: data?.canManageHr ? "everyone on the team" : "your employee profile",
      text: data?.canManageHr ? "Active users with their roles, departments and contact details." : "Showing your employee profile only.",
    },
    leave: {
      eyebrow: "Leave",
      icon: CalendarDays,
      tone: "mint",
      title: data?.canManageHr ? "Leave requests" : "My leave",
      subtitle: data?.canManageHr ? "approve, decline and track" : "apply and track approvals",
      text: data?.canManageHr ? "Approve or decline with a comment. The applicant gets notified." : "Track your submitted applications and the admin response.",
    },
    attendance: {
      eyebrow: "Attendance",
      icon: MapPin,
      tone: "peach",
      title: data?.canManageHr ? "Attendance" : "My attendance",
      subtitle: "who clocked in and when",
      text: "Geo-location based clock in and clock out for employees.",
    },
  }[section] || {
    eyebrow: "HR workspace",
    icon: BriefcaseBusiness,
    tone: "lavender",
    title: "HR",
    subtitle: "records and documents",
    text: "Employee records, leave, attendance and documents.",
  };
  const refreshButton = (
    <Button darkMode={darkMode} variant="secondary" onClick={loadHr} disabled={loading} icon={RefreshCw} className={loading ? "[&>svg]:animate-spin" : ""}>
      Refresh
    </Button>
  );
  const thClass = `px-4 pb-3 pt-1 text-[12px] font-normal ${muted}`;
  const rowClass = darkMode ? "border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]" : "border-b border-[#f0f0ee] last:border-b-0 hover:bg-[#fafaf8]";
  const headRowClass = darkMode ? "border-b border-white/[0.06]" : "border-b border-[#f0f0ee]";
  const headerActions = {
    dashboard: (
      <>
        <Chip darkMode={darkMode}>{dashboardRequests.length} request{dashboardRequests.length === 1 ? "" : "s"}</Chip>
        {refreshButton}
      </>
    ),
    employees: (
      <>
        <div className="relative">
          <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, role, department..." className={`h-10 w-full rounded-full pl-11 pr-4 text-[13.5px] outline-none sm:w-80 ${textField}`} />
        </div>
        {refreshButton}
      </>
    ),
    leave: (
      <>
        <Chip darkMode={darkMode}>{myLeaveRequests.length} request{myLeaveRequests.length === 1 ? "" : "s"}</Chip>
        {refreshButton}
        <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={() => setLeaveDrawerOpen(true)}>Apply for leave</Button>
      </>
    ),
    attendance: (
      <>
        {refreshButton}
        <Button darkMode={darkMode} variant={pendingAttendanceAdjustmentRequests.length ? "accent" : "soft"} icon={MessageCircle} onClick={() => setAttendanceRequestHistoryOpen(true)}>
          {pendingAttendanceAdjustmentRequests.length ? `${pendingAttendanceAdjustmentRequests.length} pending` : "Request history"}
        </Button>
        {!data?.canManageHr && (
          <Button darkMode={darkMode} variant="primary" icon={MessageSquare} onClick={() => openAttendanceRequest()}>Request adjustment</Button>
        )}
        {data?.canManageHr && (
          <>
            <Button darkMode={darkMode} variant="soft" icon={SlidersHorizontal} onClick={() => { setAttendanceSettingsExpanded(false); setAttendanceSettingsOpen(true); }}>Settings</Button>
            <Button darkMode={darkMode} variant="primary" icon={Clock3} onClick={() => { setAdjustTab("time"); openAttendanceAdjustment(); }}>Adjustments</Button>
          </>
        )}
      </>
    ),
  }[section] || refreshButton;

  return (
    <main className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <PageHeader
        darkMode={darkMode}
        badge={hero.eyebrow}
        badgeIcon={hero.icon}
        badgeTone={hero.tone}
        title={hero.title}
        subtitle={hero.subtitle}
        description={hero.text}
        actions={headerActions}
        className="mb-7"
      />

      {section === "dashboard" && (
        <section className={`w-full rounded-[20px] ${panel}`}>
          <div className="flex items-center gap-3 px-5 pt-5">
            <IconTile icon={MessageSquare} tone="lavender" darkMode={darkMode} size="sm" />
            <div>
              <h2 className="text-[15px]">Request records</h2>
              <p className={`text-[12px] ${muted}`}>Filter by type, employee and date</p>
            </div>
          </div>
          <div className="grid gap-3 px-5 pb-4 pt-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto]">
            <DrawerSelect darkMode={darkMode} label="Request type" value={requestTypeFilter} placeholder="Select type..." options={["All", "Leave"]} onChange={setRequestTypeFilter} />
            <DrawerSelect darkMode={darkMode} label="Employee" searchable searchPlaceholder="Search employee..." value={requestEmployeeFilter} placeholder="Select employee..." options={requestEmployeeOptions} onChange={setRequestEmployeeFilter} />
            <DrawerDatePicker darkMode={darkMode} label="From date" value={requestDateFilter.startDate} placeholder="Start date" onChange={(startDate) => setRequestDateFilter((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? startDate : current.endDate }))} />
            <DrawerDatePicker darkMode={darkMode} label="To date" value={requestDateFilter.endDate} placeholder="End date" minDate={requestDateFilter.startDate} onChange={(endDate) => setRequestDateFilter((current) => ({ ...current, endDate }))} />
            <Button darkMode={darkMode} variant="soft" className="mt-auto h-10" onClick={() => { setRequestTypeFilter("All"); setRequestEmployeeFilter("All employees"); setRequestDateFilter({ startDate: "", endDate: "" }); }}>
              Clear
            </Button>
          </div>
          {dashboardRequests.length ? (
            <div className="overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className={headRowClass}>
                    {["Request", "Employee", "Details", "Period / date", "Status", ""].map((heading) => (
                      <th key={heading || "actions"} className={thClass}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboardRequests.map((request) => (
                    <tr key={request.id} className={`transition ${rowClass}`}>
                      <td className="px-4 py-3.5"><Chip tone="lavender" darkMode={darkMode}>{request.kind}</Chip></td>
                      <td className="px-4 py-3.5"><p className="text-[13.5px]">{request.employeeName || "-"}</p><p className={`text-xs ${muted}`}>{request.department || "No department"}</p></td>
                      <td className="px-4 py-3.5"><p className="text-[13.5px]">{request.title}</p><p className={`text-xs ${muted}`}>{request.detail}</p></td>
                      <td className="px-4 py-3.5 text-[13px]">{request.period || "-"}</td>
                      <td className="px-4 py-3.5">{statusChip(request.status)}</td>
                      <td className="px-4 py-3.5 text-right"><Button darkMode={darkMode} variant="soft" size="sm" icon={Eye} onClick={request.onView}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 pt-0"><EmptyState darkMode={darkMode} icon={MessageSquare} tone="lavender" title={loading ? "Loading HR requests" : "No HR requests yet"} text="Leave requests will appear here in one table." /></div>
          )}
        </section>
      )}

      {section === "employees" && (
        <section className={`overflow-hidden rounded-[20px] ${panel}`}>
          <div className="flex items-center gap-3 px-5 pt-5">
            <IconTile icon={Users} tone="sky" darkMode={darkMode} size="sm" />
            <div>
              <h2 className="text-[15px]">Directory</h2>
              <p className={`text-[12px] ${muted}`}>{filteredEmployees.length} employee{filteredEmployees.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          {filteredEmployees.length ? (
            <div className="overflow-x-auto px-2 pb-3 pt-4">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className={headRowClass}>
                    {["Employee", "Designation", "Department", "Employment", "Remote", "Contact", ""].map((heading) => (
                      <th key={heading || "actions"} className={thClass}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className={`transition ${rowClass}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={employee} name={employee.displayName || employee.username} className="h-10 w-10" />
                          <div>
                            <p className="text-[13.5px]">{employee.displayName || employee.username}</p>
                            <p className={`mt-0.5 text-xs ${muted}`}>{employee.username || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-[13px] ${muted}`}>{employee.designation || "Not set"}</td>
                      <td className={`px-4 py-3 text-[13px] ${muted}`}>{employee.department || "Not set"}</td>
                      <td className="px-4 py-3"><Chip tone={employee.employmentType === "permanent" ? "mint" : "amber"} darkMode={darkMode} className="capitalize">{employee.employmentType || "probation"}</Chip></td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={Boolean(employeeRemoteSavingId)}
                          onClick={() => saveEmployeeRemoteWorkFor(employee, !employee.remoteWorkEnabled)}
                          className={`grid h-7 w-7 place-items-center rounded-[9px] border transition disabled:cursor-not-allowed disabled:opacity-60 ${employee.remoteWorkEnabled ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/15 bg-white/[0.04]" : "border-[#dcdcd8] bg-white hover:border-[#a3a3a0]"}`}
                          title={employee.remoteWorkEnabled ? "Disable remote today" : "Mark remote today"}
                        >
                          {employeeRemoteSavingId === employee.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : employee.remoteWorkEnabled && <Check className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className={`px-4 py-3 text-[13px] ${muted}`}>{employee.phone || employee.whatsappPhone || employee.email || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button darkMode={darkMode} variant="soft" size="sm" icon={Eye} onClick={() => openEmployeeDetail(employee)}>View detail</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4"><EmptyState darkMode={darkMode} icon={Users} tone="sky" title={loading ? "Loading employees" : "No employees found"} text="Employees will appear here from real UIPL user accounts." /></div>
          )}
        </section>
      )}

      {section === "leave" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Remaining paid leave", value: remainingPaidLeaves, note: `${monthlyPaidLeaveAllowance} allowed this month`, icon: CheckCircle2, tone: "mint" },
              { label: "Leave taken", value: currentMonthLeaveTaken, note: monthLabelFromInput(currentLeaveMonth), icon: CalendarDays, tone: "sky" },
              { label: "Advance leave", value: currentMonthAdvanceLeaves, note: "Deducted in salary slip", icon: WalletCards, tone: "peach" },
              { label: "Pending approvals", value: currentMonthPendingLeaves, note: "Waiting for HR action", icon: MessageSquare, tone: "lavender" },
            ].map(({ label, value, note, icon, tone }) => (
              <StatTile key={label} darkMode={darkMode} icon={icon} tone={tone} value={Number(value || 0).toLocaleString("en-IN")} label={label} hint={note} />
            ))}
          </div>
          <section className={`mt-5 overflow-hidden rounded-[20px] ${panel}`}>
            <div className="flex items-center gap-3 px-5 pt-5">
              <IconTile icon={CalendarDays} tone="mint" darkMode={darkMode} size="sm" />
              <div>
                <h2 className="text-[15px]">{data?.canManageHr ? "Applications" : "My applications"}</h2>
                <p className={`text-[12px] ${muted}`}>{myLeaveRequests.length} request{myLeaveRequests.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            {myLeaveRequests.length ? (
              <div className="overflow-x-auto px-2 pb-3 pt-4">
                <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13.5px]">
                  <colgroup>
                    <col className="w-[23%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[22%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead>
                    <tr className={headRowClass}>
                      {["Leave type", "Period", "Breakdown", "Status", "Approval", ""].map((heading) => (
                        <th key={heading || "actions"} className={thClass}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaveRequests.map((request) => {
                      const isCurrentLeaveUser = String(request.userId || "") === String(user?.id || "");
                      const leaveEmployee = isCurrentLeaveUser ? user : employees.find((employee) => String(employee.id || "") === String(request.userId || ""));
                      const leaveAvatarUser = leaveEmployee || {
                        id: request.userId,
                        username: request.username,
                        displayName: request.employeeName,
                        gender: request.gender,
                        avatarPreset: request.avatarPreset,
                        avatarUrl: request.avatarUrl,
                      };
                      return (
                      <tr key={request.id} className={`transition ${rowClass}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={leaveAvatarUser} name={request.employeeName || request.leaveType} className="h-10 w-10" />
                            <div className="min-w-0">
                              <p className="truncate">{data?.canManageHr ? request.employeeName : currentName}</p>
                              <p className={`truncate text-xs ${muted}`}>{request.leaveType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p>{request.startDate}</p>
                          <p className={`text-xs ${muted}`}>to {request.endDate}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{request.days} day{request.days === 1 ? "" : "s"}</p>
                          <p className={`mt-0.5 text-xs ${muted}`}>{request.paidLeaveDays || 0} paid · {request.unpaidLeaveDays || 0} unpaid</p>
                        </td>
                        <td className="px-4 py-4">{statusChip(request.status)}</td>
                        <td className={`px-4 py-4 text-[13px] first-letter:uppercase ${muted}`}>
                          {request.status === "pending" ? "Waiting for approval" : `${request.status} by ${request.reviewedBy?.name || "Admin"}`}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button darkMode={darkMode} variant="soft" size="sm" icon={Eye} onClick={() => { setSelectedLeave(request); setReviewComment(request.adminComment || ""); }}>View</Button>
                            {canDeleteLeave(request) && (
                              <button onClick={() => deleteLeave(request)} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b]"}`} title="Delete pending request">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState darkMode={darkMode} icon={CalendarDays} tone="mint" title="No leave applications yet" text={data?.canManageHr ? "When employees apply for leave, approval requests will appear here." : "Use Apply for leave to submit your first leave request."} />
              </div>
            )}
          </section>
        </>
      )}

      {section === "attendance" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: CheckCircle2, label: "Today status", value: todayAttendanceLabel, hint: todayAttendance?.clockInAt ? `In ${new Date(todayAttendance.clockInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Awaiting clock in", tone: "mint" },
              { icon: LogIn, label: "Clock in", value: todayAttendance?.clockInAt ? new Date(todayAttendance.clockInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-", hint: remoteWorkEnabled ? "Remote enabled" : attendanceConfigured ? "Location required" : "Geo fence not set", tone: "sky" },
              { icon: LogOut, label: "Clock out", value: todayAttendance?.clockOutAt ? new Date(todayAttendance.clockOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-", hint: todayAttendance?.clockOutAt ? "Completed today" : "Pending", tone: "peach" },
              { icon: CalendarDays, label: "Work time", value: todayWorkMinutes ? `${Math.floor(todayWorkMinutes / 60)}h ${todayWorkMinutes % 60}m` : "0h", hint: `${todayAttendanceRecords.length} marked today`, tone: "lavender" },
            ].map((stat) => (
              <StatTile key={stat.label} darkMode={darkMode} icon={stat.icon} tone={stat.tone} value={<span className="block truncate">{stat.value}</span>} label={stat.label} hint={stat.hint} />
            ))}
          </div>

          <div className={`flex flex-col gap-4 rounded-[20px] px-5 py-4 lg:flex-row lg:items-center lg:justify-between ${remoteWorkEnabled || attendanceConfigured ? (darkMode ? "bg-[#cff07a]/15" : "bg-[#d4f28a]") : (darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3.5 overflow-hidden">
              <MapPin className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-[14px]">{remoteWorkEnabled ? "Remote attendance enabled" : attendanceConfigured ? "Attendance location active" : "Attendance location not set"}</p>
                <p className={`block max-w-full truncate text-[12.5px] ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>{remoteWorkEnabled ? "Office geofence is skipped for your clock in and clock out." : attendanceSettings.address || "HR must set the office/site location before employees can clock in."}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button darkMode={darkMode} variant="secondary" disabled={!attendanceReady || attendanceSaving || todayAttendance?.clockInAt} onClick={() => submitAttendance("clock-in")} icon={attendanceClockAction === "clock-in" ? undefined : LogIn} loading={attendanceClockAction === "clock-in"} className="min-w-[118px]">
                {attendanceClockAction === "clock-in" ? "Clocking in" : "Clock in"}
              </Button>
              {mustFillReportBeforeClockOut ? (
                <Button darkMode={darkMode} variant="primary" disabled={todayReportChecking} onClick={() => router.push("/employee-daily-report")} icon={todayReportChecking ? undefined : FileText} loading={todayReportChecking} className="min-w-[178px]">
                  Fill employee report
                </Button>
              ) : (
                <Button darkMode={darkMode} variant="primary" disabled={!attendanceReady || attendanceSaving || !todayAttendance?.clockInAt || todayAttendance?.clockOutAt} onClick={() => submitAttendance("clock-out")} icon={attendanceClockAction === "clock-out" ? undefined : LogOut} loading={attendanceClockAction === "clock-out"} className="min-w-[124px]">
                  {attendanceClockAction === "clock-out" ? "Clocking out" : "Clock out"}
                </Button>
              )}
            </div>
          </div>

          <section className={`rounded-[20px] ${panel}`}>
            <div className="flex flex-col gap-4 px-5 pt-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex items-center gap-3">
                <IconTile icon={Clock3} tone="peach" darkMode={darkMode} size="sm" />
                <div>
                  <h2 className="text-[15px]">Attendance records</h2>
                  <p className={`text-[12px] ${muted}`}>{filteredAttendanceRecords.length} record{filteredAttendanceRecords.length === 1 ? "" : "s"} for {attendanceDateRangeLabel}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className={`w-full text-xs sm:w-[220px] ${fieldLabel}`}>Search
                  <div className={`mt-1.5 flex h-10 items-center gap-2 rounded-full px-4 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                    <Search className={`h-4 w-4 shrink-0 ${muted}`} />
                    <input
                      value={attendanceQuery}
                      onChange={(event) => setAttendanceQuery(event.target.value)}
                      placeholder="Employee, status, mode..."
                      className={`min-w-0 flex-1 bg-transparent text-[13.5px] outline-none ${darkMode ? "text-white placeholder:text-white/35" : "text-[#141414] placeholder:text-[#a3a3a0]"}`}
                    />
                    {attendanceQuery && (
                      <button type="button" onClick={() => setAttendanceQuery("")} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Clear attendance search">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </label>
                <div className="w-full sm:w-[160px]">
                  <DrawerDatePicker darkMode={darkMode} label="Start date" value={attendanceDateFilter.startDate} placeholder="Start date" onChange={(startDate) => setAttendanceDateFilter(current => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? startDate : current.endDate }))} />
                </div>
                <div className="w-full sm:w-[160px]">
                  <DrawerDatePicker darkMode={darkMode} label="End date" value={attendanceDateFilter.endDate} placeholder="End date" minDate={attendanceDateFilter.startDate} onChange={(endDate) => setAttendanceDateFilter(current => ({ ...current, endDate }))} />
                </div>
                <div ref={attendanceExportRef} className="relative">
                  <Button darkMode={darkMode} variant="secondary" className="h-10" onClick={() => setAttendanceExportOpen((current) => !current)} aria-expanded={attendanceExportOpen} aria-haspopup="menu" icon={Download} iconRight={ChevronDown}>
                    Export
                  </Button>
                  {attendanceExportOpen && (
                    <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`absolute right-0 top-[calc(100%+8px)] z-30 w-44 overflow-hidden rounded-[18px] border p-1.5 ${darkMode ? "border-white/10 bg-[#17181c]" : "border-[#ececec] bg-white"}`} role="menu">
                      <button type="button" onClick={() => { setAttendanceExportOpen(false); downloadAttendanceReport(); }} className={`flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] transition ${darkMode ? "text-white/80 hover:bg-white/[0.06]" : "text-[#3d3d3b] hover:bg-[#f4f4f2]"}`} role="menuitem">
                        <Download className="h-4 w-4" /> PDF
                      </button>
                      <button type="button" onClick={() => { setAttendanceExportOpen(false); downloadExcelReport(); }} className={`flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] transition ${darkMode ? "text-white/80 hover:bg-white/[0.06]" : "text-[#3d3d3b] hover:bg-[#f4f4f2]"}`} role="menuitem">
                        <FileText className="h-4 w-4" /> Excel
                      </button>
                      {user?.isSuperAdmin && (
                        <button type="button" onClick={() => { setAttendanceExportOpen(false); exportToGoogleSheet(); }} className={`flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] transition ${darkMode ? "text-white/80 hover:bg-white/[0.06]" : "text-[#3d3d3b] hover:bg-[#f4f4f2]"}`} role="menuitem">
                          <Upload className="h-4 w-4" /> Sheet
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {(attendanceQuery || attendanceDateFilter.startDate !== todayInput() || attendanceDateFilter.endDate !== todayInput()) && (
                  <Button darkMode={darkMode} variant="soft" className="h-10" icon={X} onClick={() => { setAttendanceQuery(""); setAttendanceDateFilter({ startDate: todayInput(), endDate: todayInput() }); }}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            {!!pendingAttendanceAdjustmentRequests.length && (
              <div className={`mx-5 mt-4 rounded-[16px] p-4 ${darkMode ? "bg-[rgba(251,191,36,0.08)]" : "bg-[#fbf0d4]"}`}>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[14px]">New attendance adjustment request{pendingAttendanceAdjustmentRequests.length === 1 ? "" : "s"}</p>
                    <p className={`mt-0.5 text-xs ${darkMode ? "text-white/55" : "text-[#8a6200]"}`}>{pendingAttendanceAdjustmentRequests.length} request{pendingAttendanceAdjustmentRequests.length === 1 ? "" : "s"} waiting for validation.</p>
                  </div>
                  <Button darkMode={darkMode} variant="secondary" size="sm" icon={Eye} onClick={() => setAttendanceRequestHistoryOpen(true)}>View history</Button>
                </div>
                <div className="grid gap-2">
                  {pendingAttendanceAdjustmentRequests.slice(0, 3).map((request) => renderAttendanceAdjustmentRequest(request, { compact: true }))}
                </div>
              </div>
            )}
            <div className="overflow-x-auto px-2 pb-3 pt-4">
              <table className="w-full min-w-[860px] table-fixed border-collapse text-left text-[13.5px]">
                <colgroup>
                  <col className="w-[21%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  {data?.canManageHr && <col className="w-[8%]" />}
                </colgroup>
                <thead>
                  <tr className={headRowClass}>
                    {["Employee", "Date", "Clock in", "Clock out", "Mode", "Hours", "Status", ...(data?.canManageHr ? [""] : [])].map((heading) => (
                      <th key={heading || "action"} className={thClass}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendanceRecords.map((record) => {
                    const attendanceEmployee = String(record.userId || "") === String(user?.id || "") ? user : employees.find((employee) => String(employee.id || "") === String(record.userId || ""));
                    return (
                      <tr key={record.id} className={`transition ${rowClass}`}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={attendanceEmployee || record} name={record.employeeName} className="h-10 w-10" />
                            <div className="min-w-0">
                              <p className="truncate">{record.employeeName}</p>
                              <p className={`truncate text-xs ${muted}`}>{record.designation || record.department || "Employee"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">{record.date}</td>
                        <td className={`px-4 py-3.5 ${muted}`}>{record.clockInAt ? new Date(record.clockInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                        <td className={`px-4 py-3.5 ${muted}`}>{record.clockOutAt ? new Date(record.clockOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                        <td className="px-4 py-3.5"><Chip tone={record.workMode === "remote" ? "sky" : "neutral"} darkMode={darkMode} className="capitalize">{record.workMode || "office"}</Chip></td>
                        <td className="px-4 py-3.5 tabular-nums">{record.workMinutes ? `${Math.floor(record.workMinutes / 60)}h ${record.workMinutes % 60}m` : "-"}</td>
                        <td className="px-4 py-3.5">{statusChip(record.status)}</td>
                        {data?.canManageHr && (
                          <td className="px-4 py-3.5 text-right">
                            <button type="button" onClick={() => openAttendanceAdjustment(record)} className={`grid h-8 w-8 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`} aria-label={`Adjust attendance for ${record.employeeName}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!filteredAttendanceRecords.length && (
                    <tr><td colSpan={data?.canManageHr ? 8 : 7} className={`px-5 py-12 text-center ${muted}`}>No attendance records found for {attendanceDateRangeLabel}.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {attendanceRequestHistoryOpen && (
        <div onMouseDown={() => setAttendanceRequestHistoryOpen(false)} className={backdrop}>
          <aside onMouseDown={(event) => event.stopPropagation()} className={`employee-report-drawer hr-request-history-drawer relative flex h-full w-full flex-col overflow-hidden sm:m-2.5 sm:h-[calc(100%-20px)] sm:rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`} role="dialog" aria-modal="true" aria-label="Attendance adjustment request history">
            <DrawerHead darkMode={darkMode} icon={MessageCircle} tone="amber" title={data?.canManageHr ? "Adjustment request history" : "My adjustment requests"} subtitle={data?.canManageHr ? "Review pending and past employee attendance update requests." : "Track every attendance correction request you have sent to HR."} onClose={() => setAttendanceRequestHistoryOpen(false)} />
            <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-3 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
              <div className="flex flex-wrap gap-2">
                <Chip tone="amber" darkMode={darkMode}>{pendingAttendanceAdjustmentRequests.length} pending</Chip>
                <Chip darkMode={darkMode}>{myAttendanceAdjustmentRequests.length} total</Chip>
              </div>
              {!data?.canManageHr && (
                <button type="button" onClick={() => { setAttendanceRequestHistoryOpen(false); openAttendanceRequest(null, "bulk"); }} className={`flex h-9 items-center justify-center gap-2 rounded-full px-4 text-[13px] transition ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                  <Plus className="h-4 w-4" /> Bulk request
                </button>
              )}
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${drawerBody}`}>
              {myAttendanceAdjustmentRequests.length ? (
                <div className="grid gap-2">
                  {myAttendanceAdjustmentRequests.map((request) => renderAttendanceAdjustmentRequest(request))}
                </div>
              ) : (
                <EmptyState darkMode={darkMode} icon={MessageSquare} title="No adjustment requests yet" text={data?.canManageHr ? "New attendance correction requests will appear here." : "Use Request adjustment to send a correction to HR."} />
              )}
            </div>
          </aside>
        </div>
      )}

      {attendanceRequestOpen && (
        <div onMouseDown={() => setAttendanceRequestOpen(false)} className={backdrop}>
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={submitAttendanceAdjustmentRequest} className={`employee-report-drawer relative flex h-full w-full max-w-2xl flex-col overflow-hidden sm:m-2.5 sm:h-[calc(100%-20px)] sm:rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead darkMode={darkMode} icon={Clock3} tone="sky" title="Attendance adjustment request" subtitle="Send corrected clock in and clock out time to HR for validation." onClose={() => setAttendanceRequestOpen(false)}>
              <Tabs darkMode={darkMode} className="mt-3" items={[{ id: "single", label: "Single" }, { id: "bulk", label: "Bulk" }]} value={attendanceRequestMode} onChange={setAttendanceRequestMode} />
            </DrawerHead>
            <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${drawerBody}`}>
              <div className="grid gap-4">
                {(attendanceRequestMode === "bulk" ? attendanceRequestRows : attendanceRequestRows.slice(0, 1)).map((row, index) => (
                  <section key={index} className={`rounded-[20px] border p-4 sm:p-5 ${drawerCard}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm">Adjustment {index + 1}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{row.date ? formatDateLabel(row.date) : "Select date"}</p>
                      </div>
                      {attendanceRequestMode === "bulk" && attendanceRequestRows.length > 1 && (
                        <button type="button" onClick={() => removeAttendanceRequestRow(index)} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`} title="Remove row">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DrawerDatePicker
                        darkMode={darkMode}
                        label="Date"
                        value={row.date}
                        placeholder="Select attendance date"
                        onChange={(date) => { void applyAttendanceRequestDate(index, date); }}
                      />
                      <DrawerSelect
                        darkMode={darkMode}
                        label="Work mode"
                        value={row.workMode === "remote" ? "Remote" : "Office"}
                        placeholder="Select work mode"
                        options={["Office", "Remote"]}
                        onChange={(workMode) => updateAttendanceRequestRow(index, { workMode: workMode.toLowerCase() })}
                      />
                      <AttendanceTimePicker darkMode={darkMode} label="Clock in" value={row.clockInTime} onChange={(clockInTime) => updateAttendanceRequestRow(index, { clockInTime })} />
                      <AttendanceTimePicker darkMode={darkMode} label="Clock out" value={row.clockOutTime} onChange={(clockOutTime) => updateAttendanceRequestRow(index, { clockOutTime })} emptyLabel={row.date === todayInput() ? "Optional today" : "No record"} />
                    </div>
                    <label className={`mt-4 block text-xs ${fieldLabel}`}>Reason / note
                      <textarea
                        value={row.reason}
                        onChange={(event) => updateAttendanceRequestRow(index, { reason: event.target.value })}
                        rows={3}
                        placeholder="Example: Forgot to clock out after site visit."
                        className={`mt-2 w-full resize-none rounded-[16px] px-4 py-3 text-[13.5px] leading-6 outline-none transition ${textField}`}
                      />
                    </label>
                  </section>
                ))}
                {attendanceRequestMode === "bulk" && (
                  <button type="button" onClick={addAttendanceRequestRow} className={`flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[13px] transition ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                    <Plus className="h-4 w-4" /> Add another date
                  </button>
                )}
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-4 border-t px-6 py-5 ${drawerFooter}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={() => setAttendanceRequestOpen(false)}>Cancel</Button>
              <button disabled={attendanceRequestSaving || !attendanceRequestRows[0]?.date || !attendanceRequestRows[0]?.clockInTime} type="submit" className={`inline-flex h-11 min-w-[180px] items-center justify-center rounded-full px-7 text-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${primaryButton}`}>
                {attendanceRequestSaving ? "Sending..." : "Send request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {attendanceAdjustOpen && (
        <div onMouseDown={() => setAttendanceAdjustOpen(false)} className={backdrop}>
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={saveAttendanceAdjustment} className={`employee-report-drawer relative flex h-full w-full max-w-xl flex-col overflow-hidden sm:m-2.5 sm:h-[calc(100%-20px)] sm:rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead
              darkMode={darkMode}
              icon={adjustTab === "time" ? Clock3 : CalendarOff}
              tone={adjustTab === "time" ? "peach" : "mint"}
              title="Adjustments"
              subtitle={adjustTab === "time" ? "Set clock in and clock out in IST for the selected employee/date." : "Mark a holiday or shutdown day. Everyone counts as present and the column reads NWD."}
              onClose={() => setAttendanceAdjustOpen(false)}
            >
              <Tabs darkMode={darkMode} className="mt-3" items={[{ id: "time", label: "Time" }, { id: "nwd", label: "No working day" }]} value={adjustTab} onChange={setAdjustTab} />
            </DrawerHead>
            <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${drawerBody}`}>
              {adjustTab === "nwd" ? (
                <section className={`rounded-[20px] border p-4 sm:p-5 ${drawerCard}`}>
                  <div className={`rounded-[16px] p-4 ${darkMode ? "bg-[#cff07a]/15" : "bg-[#d4f28a]"}`}>
                    <p className="text-[14px]">What a no working day does</p>
                    <p className={`mt-1.5 text-xs leading-5 ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>
                      The whole column reads <b>NWD</b> for every employee and the day counts towards present days, so a company holiday or shutdown never shows up as absence. Hours anyone did work that day still count towards their total. Sundays are already non-working, so marking one changes nothing.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr_auto] sm:items-end">
                    <label className="block">
                      <span className={`text-xs ${fieldLabel}`}>Date</span>
                      <DateInput
                        darkMode={darkMode}
                        value={nwdForm.date}
                        onChange={(event) => setNwdForm((current) => ({ ...current, date: event.target.value }))}
                        className="mt-1.5"
                      />
                    </label>
                    <label className="block">
                      <span className={`text-xs ${muted}`}>Reason (optional)</span>
                      <input
                        value={nwdForm.label}
                        onChange={(event) => setNwdForm((current) => ({ ...current, label: event.target.value }))}
                        placeholder="Diwali, Independence Day, office shutdown..."
                        className={`mt-1.5 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={saveNoWorkingDay}
                      disabled={nwdSaving || !nwdForm.date}
                      className={`flex h-10 items-center justify-center gap-2 rounded-full px-5 text-[13px] transition disabled:opacity-50 ${primaryButton}`}
                    >
                      {nwdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarOff className="h-4 w-4" />} Mark day
                    </button>
                  </div>

                  <div className="mt-6">
                    <p className={`text-xs ${muted}`}>Marked days</p>
                    {noWorkingDays.length ? (
                      <div className="mt-2 grid gap-2">
                        {noWorkingDays.map((day) => (
                          <div key={day.date} className={`flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 ${softPanel}`}>
                            <div className="min-w-0">
                              <p className="text-sm">{formatDateLabel(day.date)}</p>
                              <p className={`truncate text-xs ${muted}`}>
                                {day.label || "No reason noted"}
                                {day.markedByName ? ` · marked by ${day.markedByName}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeNoWorkingDay(day.date)}
                              disabled={nwdSaving}
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`}
                              title="Make this a working day again"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`mt-2 rounded-[14px] px-4 py-6 text-center text-[13px] ${softPanel} ${muted}`}>
                        No days marked yet. Pick a date above to add one.
                      </p>
                    )}
                  </div>
                </section>
              ) : (
              <section className={`rounded-[20px] border p-4 sm:p-5 ${drawerCard}`}>
                <div className={`mb-5 grid gap-3 rounded-[16px] p-4 sm:grid-cols-3 ${softPanel}`}>
                  <div>
                    <p className={`text-xs ${muted}`}>Employee</p>
                    <p className="mt-1 truncate text-sm">{selectedAttendanceAdjustEmployee?.displayName || selectedAttendanceAdjustEmployee?.username || "Select employee"}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${muted}`}>Date</p>
                    <p className="mt-1 text-sm">{formatDateLabel(attendanceAdjustForm.date)}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${muted}`}>Time</p>
                    <p className="mt-1 text-sm">{attendanceAdjustmentIsToday ? (attendanceAdjustForm.clockInTime ? displayTimeInput(attendanceAdjustForm.clockInTime) : "No record") : `${attendanceAdjustForm.clockInTime ? displayTimeInput(attendanceAdjustForm.clockInTime) : "No record"} - ${attendanceAdjustForm.clockOutTime ? displayTimeInput(attendanceAdjustForm.clockOutTime) : "No record"}`}</p>
                  </div>
                </div>
                <div className="grid gap-4">
                  <Tabs darkMode={darkMode} className="w-fit" items={[{ id: "single", label: "Single date" }, { id: "bulk", label: "Bulk dates" }]} value={attendanceAdjustMode} onChange={setAttendanceAdjustMode} />
                  <DrawerSelect
                    darkMode={darkMode}
                    label="Employee"
                    required
                    searchable
                    searchPlaceholder="Search employee..."
                    value={selectedAttendanceAdjustEmployeeText}
                    placeholder="Select employee"
                    options={attendanceAdjustEmployeeOptions}
                    onChange={(employeeText) => {
                      const employee = activeEmployees.find((item) => `${item.displayName || item.username} · ${item.designation || item.department || item.roleName || "Employee"}` === employeeText);
                      void applyAttendanceAdjustEmployee(employee?.id || "");
                    }}
                  />
                  {attendanceAdjustMode === "bulk" ? (
                    <>
                      <div className="grid gap-3">
                        {attendanceAdjustRows.map((row, index) => {
                          const rowIsToday = row.date === todayInput();
                          const rowRecord = attendanceRecords.find((record) => String(record.userId || "") === String(attendanceAdjustForm.userId || "") && record.date === row.date);
                          return (
                            <section key={`${row.date}-${index}`} className={`rounded-[16px] p-4 ${softPanel}`}>
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm">Date {index + 1}</p>
                                  <p className={`mt-1 text-xs ${muted}`}>{rowRecord ? "Existing record loaded" : "No record found yet"}</p>
                                </div>
                                {attendanceAdjustRows.length > 1 && (
                                  <button type="button" onClick={() => removeAttendanceAdjustRow(index)} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`} title="Remove date">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <DrawerDatePicker darkMode={darkMode} label="Date" value={row.date} placeholder="Select attendance date" onChange={(date) => { void applyAttendanceAdjustRowDate(index, date); }} />
                                <DrawerSelect
                                  darkMode={darkMode}
                                  label="Work mode"
                                  value={row.workMode === "remote" ? "Remote" : "Office"}
                                  placeholder="Select work mode"
                                  options={["Office", "Remote"]}
                                  onChange={(workMode) => updateAttendanceAdjustRow(index, { workMode: workMode.toLowerCase() })}
                                />
                                <AttendanceTimePicker darkMode={darkMode} label="Clock in" value={row.clockInTime} onChange={(clockInTime) => updateAttendanceAdjustRow(index, { clockInTime })} />
                                <AttendanceTimePicker darkMode={darkMode} label="Clock out" value={row.clockOutTime} onChange={(clockOutTime) => updateAttendanceAdjustRow(index, { clockOutTime })} emptyLabel={rowIsToday ? "Optional today" : "No record"} />
                              </div>
                              <label className={`mt-3 block text-xs ${fieldLabel}`}>Reason / note
                                <textarea value={row.reason} onChange={(event) => updateAttendanceAdjustRow(index, { reason: event.target.value })} rows={2} placeholder="Example: Forgot to clock out, corrected manually." className={`mt-2 w-full resize-none rounded-[16px] px-4 py-3 text-[13.5px] leading-6 outline-none transition ${textField}`} />
                              </label>
                            </section>
                          );
                        })}
                      </div>
                      <button type="button" onClick={addAttendanceAdjustRow} className={`flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[13px] transition ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                        <Plus className="h-4 w-4" /> Add another date
                      </button>
                    </>
                  ) : (
                    <>
                      <DrawerDatePicker
                        darkMode={darkMode}
                        label="Date"
                        value={attendanceAdjustForm.date}
                        placeholder="Select attendance date"
                        onChange={(date) => { void applyAttendanceAdjustmentDate(attendanceAdjustForm.userId, date); }}
                      />
                      <div className={`grid gap-3 ${attendanceAdjustmentIsToday ? "" : "sm:grid-cols-2"}`}>
                        <AttendanceTimePicker darkMode={darkMode} label="Clock in" value={attendanceAdjustForm.clockInTime} onChange={(clockInTime) => setAttendanceAdjustForm((current) => ({ ...current, clockInTime }))} />
                        {!attendanceAdjustmentIsToday && (
                          <AttendanceTimePicker darkMode={darkMode} label="Clock out" value={attendanceAdjustForm.clockOutTime} onChange={(clockOutTime) => setAttendanceAdjustForm((current) => ({ ...current, clockOutTime }))} />
                        )}
                      </div>
                      {selectedAttendanceAdjustRecord ? (
                        <p className={`rounded-[14px] px-4 py-3 text-xs ${darkMode ? "bg-[rgba(74,222,128,0.12)] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"}`}>Existing record found. Pick exact hour and minute only if you need to correct it.</p>
                      ) : (
                        <p className={`rounded-[14px] px-4 py-3 text-xs ${darkMode ? "bg-[rgba(251,191,36,0.13)] text-[#f5d27a]" : "bg-[#fbf0d4] text-[#8a6200]"}`}>No record found for this employee/date. Choose the time manually to create one.</p>
                      )}
                      <DrawerSelect
                        darkMode={darkMode}
                        label="Work mode"
                        value={attendanceAdjustForm.workMode === "remote" ? "Remote" : "Office"}
                        placeholder="Select work mode"
                        options={["Office", "Remote"]}
                        onChange={(workMode) => setAttendanceAdjustForm((current) => ({ ...current, workMode: workMode.toLowerCase() }))}
                      />
                      <label className={`text-xs ${fieldLabel}`}>Reason / note
                        <textarea value={attendanceAdjustForm.reason} onChange={(event) => setAttendanceAdjustForm((current) => ({ ...current, reason: event.target.value }))} rows={5} placeholder="Example: Forgot to clock in, corrected from HR approval." className={`mt-2 w-full resize-none rounded-[16px] px-4 py-3 text-[13.5px] leading-6 outline-none transition ${textField}`} />
                        <span className={`mt-2 block text-[11px] leading-5 ${muted}`}>This note is saved in the activity log with the adjustment.</span>
                      </label>
                    </>
                  )}
                </div>
              </section>
              )}
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-4 border-t px-6 py-5 ${drawerFooter}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={() => setAttendanceAdjustOpen(false)}>Cancel</Button>
              {adjustTab === "time" ? (
              <button disabled={attendanceAdjustSaving || !attendanceAdjustForm.userId || (attendanceAdjustMode === "bulk" ? !attendanceAdjustBulkReady : (!attendanceAdjustForm.date || !attendanceAdjustForm.clockInTime || (!attendanceAdjustmentIsToday && !attendanceAdjustForm.clockOutTime)))} type="submit" className={`inline-flex h-11 min-w-[180px] items-center justify-center rounded-full px-7 text-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${primaryButton}`}>{attendanceAdjustSaving ? "Saving..." : attendanceAdjustMode === "bulk" ? "Save adjustments" : "Save adjustment"}</button>
              ) : null}
            </div>
          </form>
        </div>
      )}

      {attendanceSettingsOpen && (
        <div onMouseDown={closeAttendanceSettings} className={backdrop}>
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={saveAttendanceSettings} className={`employee-report-drawer employee-report-shell absolute flex flex-col overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.16)] ${attendanceSettingsExpanded ? "employee-report-shell-expanded" : "sm:!rounded-[24px]"} animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead
              darkMode={darkMode}
              icon={MapPin}
              tone="peach"
              title="Attendance settings"
              subtitle="Set the allowed work location and radius."
              onClose={closeAttendanceSettings}
              extra={(
                <Button darkMode={darkMode} variant="soft" size="sm" icon={attendanceSettingsExpanded ? Minimize2 : Maximize2} onClick={() => setAttendanceSettingsExpanded((current) => !current)} aria-label={attendanceSettingsExpanded ? "Restore drawer size" : "Expand attendance settings"}>
                  <span className="hidden sm:inline">{attendanceSettingsExpanded ? "Restore" : "Expand"}</span>
                </Button>
              )}
            />
            <div className={`min-h-0 flex-1 overflow-hidden ${drawerBody}`}>
              <div className="grid h-full min-h-0 gap-5 overflow-y-auto p-5 xl:grid-cols-[minmax(360px,0.48fr)_minmax(0,0.52fr)]">
                <div className="min-w-0 space-y-5">
                  <section className={`rounded-[20px] border p-5 ${drawerCard}`}>
                    <div className="flex flex-col gap-3">
                      <label className={`newq relative text-xs ${fieldLabel}`}>Search address
                        <div className={`mt-1.5 flex h-11 items-center gap-3 rounded-full px-5 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                          <Search className={`h-4 w-4 ${muted}`} />
                          <input value={attendanceForm.address} onChange={(event) => handleAttendanceAddressInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchTypedAttendanceAddress(); } }} placeholder="Type office, site, city or landmark..." className={`attendance-search-input newq min-w-0 flex-1 appearance-none border-0 bg-transparent text-[13.5px] outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 ${darkMode ? "text-white placeholder:text-white/35" : "text-[#141414] placeholder:text-[#a3a3a0]"}`} />
                          {attendanceLocating && <RefreshCw className={`h-4 w-4 animate-spin ${muted}`} />}
                        </div>
                        {!!attendanceSearchResults.length && (
                          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`absolute left-0 right-0 top-[calc(100%+8px)] z-[95] max-h-[360px] overflow-y-auto rounded-[18px] border p-1.5 ${darkMode ? "border-white/10 bg-[#17181c]" : "border-[#ececec] bg-white"}`}>
                            {attendanceSearchResults.map((item) => {
                              const selected = item.lat !== null && item.lat !== undefined && item.lon !== null && item.lon !== undefined && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)) && String(Number(attendanceForm.latitude)) === String(Number(item.lat)) && String(Number(attendanceForm.longitude)) === String(Number(item.lon));
                              return (
                                <button key={`${item.place_id}-${item.display_name}`} type="button" onClick={() => selectAttendanceSearchResult(item)} className={`flex w-full items-start gap-3 rounded-[12px] p-2.5 text-left normal-case tracking-normal transition ${selected ? darkMode ? "bg-white/[0.08]" : "bg-[#f4f4f2]" : darkMode ? "hover:bg-white/[0.05]" : "hover:bg-[#f6f6f4]"}`}>
                                  <IconTile icon={MapPin} tone={selected ? "lime" : "peach"} darkMode={darkMode} size="sm" />
                                  <span className="min-w-0">
                                    <span className={`block truncate text-[13.5px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{item.name || item.display_name?.split(",")?.[0] || "Location"}</span>
                                    <span className={`mt-1 block line-clamp-2 text-xs leading-5 ${muted}`}>{item.display_name}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </label>
                      <button type="button" onClick={useCurrentAttendanceLocation} disabled={attendanceLocating} className={`newq inline-flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[13px] transition disabled:opacity-55 ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}><Navigation className="h-4 w-4" /> Use current location</button>
                    </div>
                  </section>

                  <section className={`rounded-[20px] border p-5 ${drawerCard}`}>
                    {attendanceForm.latitude && attendanceForm.longitude ? (
                      <>
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className={`text-xs ${muted}`}>Selected location</p>
                        <p className="mt-1 block max-w-full overflow-hidden truncate whitespace-nowrap text-[17px]">{attendanceForm.address || "Pinned location"}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{attendanceForm.latitude}, {attendanceForm.longitude}</p>
                      </div>
                      <a className={`inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${attendanceForm.latitude},${attendanceForm.longitude}`)}`} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" /> Open map</a>
                    </div>
                    <div className="mt-5 grid gap-3">
                      <label className={`text-xs ${fieldLabel}`}>Latitude
                        <input type="number" step="any" value={attendanceForm.latitude} onChange={(event) => setAttendanceForm((current) => ({ ...current, latitude: event.target.value }))} className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                      </label>
                      <label className={`text-xs ${fieldLabel}`}>Longitude
                        <input type="number" step="any" value={attendanceForm.longitude} onChange={(event) => setAttendanceForm((current) => ({ ...current, longitude: event.target.value }))} className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                      </label>
                      <label className={`block text-xs ${fieldLabel}`}>Allowed radius
                        <div className={`mt-2 flex h-10 items-center rounded-full px-4 ${darkMode ? "bg-white/[0.06] text-white" : "bg-[#f4f4f2] text-[#141414]"}`}>
                          <input type="number" min="25" value={attendanceForm.radiusMeters} onChange={(event) => setAttendanceForm((current) => ({ ...current, radiusMeters: event.target.value }))} className="min-w-0 flex-1 border-0 !bg-transparent text-[13.5px] outline-none" />
                          <span className={`text-xs ${muted}`}>meters</span>
                        </div>
                      </label>
                      <label className={`mt-3 block text-xs ${fieldLabel}`}>Google Sheet URL (for export)
                        <input type="url" value={attendanceForm.googleSheetLink} onChange={(event) => setAttendanceForm((current) => ({ ...current, googleSheetLink: event.target.value }))} className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} placeholder="https://docs.google.com/spreadsheets/d/..." />
                        <p className={`mt-1.5 text-[10px] ${muted}`}>Attendance will be appended daily at 11 PM to this sheet.</p>
                      </label>
                    </div>
                    </>
                    ) : (
                      <div className={`rounded-[16px] p-5 text-[13px] ${softPanel} ${muted}`}>Choose a location to show coordinates and radius.</div>
                    )}
                  </section>
                </div>
                <section className={`min-h-[420px] rounded-[20px] border p-5 ${drawerCard}`}>
                  <div className={`h-full overflow-hidden rounded-[16px] ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f4f2]"}`}>
                    {attendanceForm.latitude && attendanceForm.longitude ? (
                      <iframe title="Attendance Google map" className="h-full min-h-[420px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(`${attendanceForm.latitude},${attendanceForm.longitude}`)}&z=17&output=embed`} />
                    ) : attendanceForm.address ? (
                      <iframe title="Attendance Google map search" className="h-full min-h-[420px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(attendanceForm.address)}&z=14&output=embed`} />
                    ) : (
                      <div className={`grid h-full min-h-[420px] place-items-center px-6 text-center text-sm ${muted}`}>Search an address or use current location to preview Google Maps.</div>
                    )}
                  </div>
                </section>
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${drawerFooter}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={closeAttendanceSettings}>Cancel</Button>
              <button disabled={attendanceSaving || !attendanceForm.latitude || !attendanceForm.longitude} type="submit" className={`inline-flex h-11 min-w-[190px] items-center justify-center rounded-full px-7 text-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${primaryButton}`}>{attendanceSaving ? "Saving..." : "Save geo fence"}</button>
            </div>
          </form>
        </div>
      )}

      {salaryDrawerOpen && (
        <div onMouseDown={() => setSalaryDrawerOpen(false)} className={backdrop}>
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={submitSalarySlip} className={`employee-report-drawer employee-report-shell salary-slip-drawer relative flex h-full w-full flex-col overflow-hidden sm:m-2.5 sm:h-[calc(100%-20px)] sm:!rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead darkMode={darkMode} icon={WalletCards} tone="lime" title={editingSalaryId ? "Edit salary slip" : "Generate salary slip"} subtitle="Salary details save for the next generation." onClose={() => setSalaryDrawerOpen(false)} />
            <div className={`min-h-0 flex-1 overflow-hidden ${drawerBody}`}>
              <div className={`grid h-full min-h-0 gap-5 p-5 ${canManageSalary ? "lg:grid-cols-[230px_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
                {canManageSalary && <aside className={`h-fit space-y-4 self-start rounded-[20px] p-4 ${softPanel}`}>
                  <Badge icon={WalletCards} tone="lime" darkMode={darkMode}>Salary slip</Badge>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <p className={`text-xs ${muted}`}>Employee</p>
                    <p className="mt-2 text-lg">{salaryForm.employeeName || "Select employee"}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{salaryForm.designation || "Designation not added"}</p>
                  </div>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <p className={`text-xs ${muted}`}>Pay period</p>
                    <p className="mt-2">{selectedSalaryMonthLabel || "Select month"}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{salaryForm.payDate ? `Pay date ${formatDateLabel(salaryForm.payDate)}` : "Pay date pending"}</p>
                  </div>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-[#cff07a]/15" : "bg-[#d4f28a]"}`}>
                    <p className={`text-xs ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>Net payable</p>
                    <p className="mt-2 text-[26px] leading-none tracking-[-0.02em] tabular-nums">₹{Math.max(0, moneyValue(salaryForm.basic) + salaryForm.earnings.reduce((sum, item) => sum + moneyValue(item.amount), 0) - salaryForm.deductions.reduce((sum, item) => sum + moneyValue(item.amount), 0)).toLocaleString("en-IN")}</p>
                  </div>
                </aside>}
                <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
              {[
                ["Salary period", (
                  <div className={`grid gap-3 ${canManageSalary ? "sm:grid-cols-2" : "sm:grid-cols-1"}`} key="period">
                    {canManageSalary && (
                      <div className="sm:col-span-2">
                        <DrawerSelect darkMode={darkMode} label="Employee" required searchable searchPlaceholder="Search employee..." value={selectedSalaryEmployeeText} placeholder="Select employee..." options={salaryEmployeeOptions} onChange={handleSalaryEmployeeChange} />
                      </div>
                    )}
                    <DrawerSelect darkMode={darkMode} label="Month" required value={selectedSalaryMonthLabel} placeholder="Select salary month..." options={salaryMonthItems.map((item) => item.label)} onChange={(label) => {
                      const selected = salaryMonthItems.find((item) => item.label === label);
                      if (selected) setSalaryForm((current) => ({ ...current, month: selected.value, payDate: endOfMonthInput(selected.value) }));
                    }} />
                    {canManageSalary && <DrawerDatePicker darkMode={darkMode} label="Pay Date" value={salaryForm.payDate} placeholder="Select pay date" onChange={(payDate) => setSalaryForm((current) => ({ ...current, payDate }))} />}
                  </div>
                )],
                ...(canManageSalary ? [["Employee summary", (
                  <div className="grid gap-3 sm:grid-cols-2" key="employee">
                    {[
                      ["Employee Name", "employeeName", "text"],
                      ["Designation", "designation", "text"],
                      ["Employee ID", "employeeCode", "text"],
                      ["UAN", "uan", "text"],
                      ["Monthly In-Hand Salary", "monthlyInHandSalary", "number"],
                    ].map(([label, key, type]) => (
                      <label key={key} className={`text-xs ${fieldLabel}`}>{label}{["employeeName", "joiningDate", "monthlyInHandSalary"].includes(key) ? " *" : ""}
                        <input required={["employeeName", "joiningDate", "monthlyInHandSalary"].includes(key)} type={type} value={salaryForm[key]} onChange={(event) => setSalaryForm((current) => ({ ...current, [key]: event.target.value, ...(key === "monthlyInHandSalary" ? { basic: event.target.value } : {}) }))} className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                      </label>
                    ))}
                    <DrawerSelect darkMode={darkMode} label="Employment Status" required value={salaryForm.employmentType === "permanent" ? "Permanent" : "Probation"} placeholder="Select status..." options={["Permanent", "Probation"]} onChange={(employmentType) => setSalaryForm((current) => ({ ...current, employmentType: employmentType.toLowerCase() }))} />
                    <label className={`text-xs ${fieldLabel}`}>Paid days
                      <input readOnly value="Auto calculated from approved leave" className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                    </label>
                    <label className={`text-xs ${fieldLabel}`}>LOP days
                      <input readOnly value="Auto calculated from approved leave" className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                    </label>
                    <DrawerDatePicker darkMode={darkMode} label="Joining Date" value={salaryForm.joiningDate} placeholder="Select joining date" onChange={(joiningDate) => setSalaryForm((current) => ({ ...current, joiningDate, month: current.month && current.month < joiningDate.slice(0, 7) ? joiningDate.slice(0, 7) : current.month }))} />
                  </div>
                )]] : []),
              ].map(([title, content]) => (
                <section key={title} className={`rounded-[20px] p-4 ${drawerCard}`}>
                  <p className="mb-3 text-[14px]">{title}</p>
                  {content}
                </section>
              ))}

              {canManageSalary && ["earnings", "deductions"].map((type) => (
                <section key={type} className={`rounded-[20px] p-4 ${drawerCard}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[14px]">{type === "earnings" ? "Allowances / earnings" : "Deductions"}</p>
                    <button type="button" onClick={() => addSalaryComponent(type)} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] ${darkMode ? "bg-white/[0.07] hover:bg-white/[0.11]" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}><Plus className="h-3.5 w-3.5" /> Add</button>
                  </div>
                  <div className="space-y-2">
                    {salaryForm[type].map((item, index) => (
                      <div key={`${type}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_130px]">
                        <input value={item.label} onChange={(event) => updateSalaryComponent(type, index, { label: event.target.value })} placeholder={type === "earnings" ? "Allowance name" : "Deduction name"} className={`h-10 rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                        <input type="number" value={item.amount} onChange={(event) => updateSalaryComponent(type, index, { amount: event.target.value })} placeholder="Amount" className={`h-10 rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {salaryMeta?.canEditCompany && (
                <section className={`rounded-[20px] p-4 ${drawerCard}`}>
                  <p className="mb-3 text-[14px]">Company details</p>
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`grid h-14 w-20 place-items-center overflow-hidden rounded-[14px] text-xs ${darkMode ? "bg-white/[0.06] text-white/50" : "bg-[#f4f4f2] text-[#8a8a8a]"}`}>
                      {salaryForm.companyLogo ? <Image src={salaryForm.companyLogo} alt="Company logo" width={80} height={56} unoptimized className="h-full w-full object-contain" /> : "Logo"}
                    </span>
                    <label className={`inline-flex h-8 cursor-pointer items-center rounded-full border px-4 text-[12.5px] ${darkMode ? "border-white/10 bg-white/[0.04] hover:bg-white/10" : "border-[#e6e6e3] bg-white hover:bg-[#f6f6f4]"}`}>
                      Upload logo
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setSalaryForm((current) => ({ ...current, companyLogo: String(reader.result || "") }));
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Company Name", "companyName"],
                      ["Company Location", "companyLocation"],
                      ["Phone Number", "companyPhone"],
                      ["Email ID", "companyEmail"],
                      ["PF A/C Number", "pfAccountNumber"],
                    ].map(([label, key]) => (
                      <label key={key} className={`text-xs ${fieldLabel}`}>{label}
                        <input value={salaryForm[key]} onChange={(event) => setSalaryForm((current) => ({ ...current, [key]: event.target.value }))} className={`mt-2 h-10 w-full rounded-full px-4 text-[13.5px] outline-none ${textField}`} />
                      </label>
                    ))}
                    <label className={`text-xs sm:col-span-2 ${fieldLabel}`}>Footer note
                      <textarea value={salaryForm.note} onChange={(event) => setSalaryForm((current) => ({ ...current, note: event.target.value }))} className={`mt-2 min-h-20 w-full rounded-[16px] px-4 py-3 text-[13.5px] outline-none ${textField}`} />
                    </label>
                  </div>
                </section>
              )}
                </div>
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${drawerFooter}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={() => setSalaryDrawerOpen(false)}>Cancel</Button>
              <button disabled={salarySaving} type="submit" className={`inline-flex h-11 min-w-[190px] items-center justify-center rounded-full px-7 text-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${primaryButton}`}>{salarySaving ? "Saving..." : !canManageSalary ? "Download PDF" : editingSalaryId ? "Save changes" : "Generate PDF"}</button>
            </div>
          </form>
        </div>
      )}

      {salaryDeleteTarget && (
        <div onMouseDown={() => setSalaryDeleteTarget(null)} className="fixed inset-0 z-[120] grid place-items-center bg-black/35 p-4">
          <section onMouseDown={(event) => event.stopPropagation()} style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop w-full max-w-md overflow-hidden rounded-[24px] border p-6 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <div className="flex items-start gap-4">
              <IconTile icon={Trash2} tone="rose" darkMode={darkMode} />
              <div>
                <h2 className="text-[16px]">Delete salary slip?</h2>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>This will permanently remove {salaryDeleteTarget.title || "this salary slip"} for {salaryDeleteTarget.employeeName || "the employee"}.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button darkMode={darkMode} variant="secondary" onClick={() => setSalaryDeleteTarget(null)}>Cancel</Button>
              <Button darkMode={darkMode} variant="danger" onClick={() => deleteSalarySlip(salaryDeleteTarget)}>Delete slip</Button>
            </div>
          </section>
        </div>
      )}

      {leaveDrawerOpen && (
        <div onMouseDown={() => setLeaveDrawerOpen(false)} className={backdrop}>
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={submitLeave} className={`employee-report-drawer employee-report-shell hr-leave-drawer relative flex h-full w-full flex-col overflow-hidden sm:m-2.5 sm:h-[calc(100%-20px)] sm:!rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead darkMode={darkMode} icon={CalendarDays} tone="mint" title="Apply for leave" subtitle="Sent to HR/admin for approval." onClose={() => setLeaveDrawerOpen(false)} />
            <div className={`min-h-0 flex-1 overflow-hidden ${drawerBody}`}>
              <div className="grid h-full min-h-0 gap-5 p-5 lg:grid-cols-[230px_minmax(0,1fr)]">
                <aside className={`h-fit space-y-4 self-start rounded-[20px] p-4 ${softPanel}`}>
                  <Badge icon={CalendarDays} tone="mint" darkMode={darkMode}>Leave request</Badge>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <p className={`text-xs ${muted}`}>Applicant</p>
                    <p className="mt-2 text-lg">{currentName}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{user?.designation || user?.department || "Employee"}</p>
                  </div>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <p className={`text-xs ${muted}`}>Leave type</p>
                    <p className="mt-2 text-base">{leaveForm.leaveType || "Select leave type"}</p>
                  </div>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-[#cff07a]/15 text-white" : "bg-[#d4f28a] text-[#141414]"}`}>
                    <p className={`text-xs ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>Period</p>
                    <p className="mt-2 text-sm leading-5">{leavePeriodPreview}</p>
                    <p className={`mt-1 text-xs ${darkMode ? "text-white/60" : "text-[#3d4a1a]"}`}>{leavePreviewDays ? `${leavePreviewDays} day${leavePreviewDays === 1 ? "" : "s"}` : "Dates not selected"}</p>
                  </div>
                </aside>
                <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
                  <section className={`rounded-[20px] p-5 ${drawerCard}`}>
                    <p className="mb-3 text-[14px]">Leave details</p>
                    <DrawerSelect darkMode={darkMode} label="Leave Type" required value={leaveForm.leaveType} placeholder="Select leave type..." options={["Casual Leave", "Sick Leave", "Paid Leave", "Advance Leave"]} onChange={(leaveType) => setLeaveForm((current) => ({ ...current, leaveType }))} />
                    <p className={`mt-3 text-xs leading-5 ${muted}`}>Leave type is for reference. If policy balance is exceeded later, extra days can be marked as advance leave.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DrawerDatePicker darkMode={darkMode} label="Start Date" value={leaveForm.startDate} placeholder="Select start date" minDate={todayInput()} onChange={(startDate) => setLeaveForm((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? startDate : current.endDate }))} />
                      <DrawerDatePicker darkMode={darkMode} label="End Date" value={leaveForm.endDate} placeholder="Select end date" minDate={leaveForm.startDate || todayInput()} onChange={(endDate) => setLeaveForm((current) => ({ ...current, endDate }))} />
                    </div>
                  </section>
                  <div className={`rounded-[20px] p-5 ${drawerCard}`}>
                    <label className={`block text-xs ${fieldLabel}`}>Reason *</label>
                    <textarea required minLength={10} value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Please provide a detailed reason..." className={`mt-2 min-h-32 w-full rounded-[16px] px-4 py-3 text-[13.5px] outline-none ${textField}`} />
                    <p className={`mt-2 text-xs ${muted}`}>Minimum 10 characters required</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${drawerFooter}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={() => setLeaveDrawerOpen(false)}>Cancel</Button>
              <button disabled={leaveSaving} type="submit" className={`inline-flex h-11 min-w-[190px] items-center justify-center rounded-full px-7 text-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${primaryButton}`}>{leaveSaving ? "Sending..." : "Send for approval"}</button>
            </div>
          </form>
        </div>
      )}

      {selectedLeave && (
        <div onMouseDown={() => setSelectedLeave(null)} className="fixed inset-0 z-[90] flex justify-end bg-black/20 p-2.5 backdrop-blur-[2px]">
          {(() => {
            const isCurrentLeaveUser = String(selectedLeave.userId || "") === String(user?.id || "");
            const selectedLeaveEmployee = isCurrentLeaveUser ? user : employees.find((employee) => String(employee.id || "") === String(selectedLeave.userId || ""));
            const selectedLeaveAvatarUser = selectedLeaveEmployee || {
              id: selectedLeave.userId,
              username: selectedLeave.username,
              displayName: selectedLeave.employeeName,
              gender: selectedLeave.gender,
              avatarPreset: selectedLeave.avatarPreset,
              avatarUrl: selectedLeave.avatarUrl,
            };
            return (
          <section onMouseDown={(event) => event.stopPropagation()} className={`flex h-full w-full max-w-md flex-col overflow-hidden rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead darkMode={darkMode} icon={CalendarDays} tone={statusTone(selectedLeave.status)} title={`Leave #${selectedLeave.id?.slice(-5) || "request"}`} onClose={() => setSelectedLeave(null)} extra={statusChip(selectedLeave.status)} />
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex items-center gap-4 pb-4">
                <UserAvatar user={selectedLeaveAvatarUser} name={selectedLeave.employeeName} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-[20px] tracking-[-0.01em]">{selectedLeave.employeeName}</h2>
                  <p className={`mt-1 truncate text-sm ${muted}`}>{selectedLeave.department || "No department"}</p>
                </div>
              </div>

              <div className={`grid grid-cols-3 gap-2 rounded-[16px] p-4 ${softPanel}`}>
                {[["Type", selectedLeave.leaveType], ["Paid", selectedLeave.paidLeaveDays || 0], ["Unpaid", selectedLeave.unpaidLeaveDays || 0]].map(([label, value]) => (
                  <div key={label}>
                    <p className={`text-xs ${muted}`}>{label}</p>
                    <p className="mt-1 text-[14px] capitalize">{value}</p>
                  </div>
                ))}
              </div>

              <div className={`border-b py-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px]">Leave details</h3>
                </div>
                <div className={`rounded-[14px] p-3.5 ${softPanel}`}>
                  <p className="text-sm">{selectedLeave.startDate} → {selectedLeave.endDate}</p>
                  <p className={`mt-1 text-xs ${muted}`}>Submitted {selectedLeave.createdAt ? new Date(selectedLeave.createdAt).toLocaleString("en-IN") : "-"}</p>
                </div>
                <div className={`mt-3 rounded-[14px] p-3.5 ${softPanel}`}>
                  <p className={`text-xs ${muted}`}>Reason</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedLeave.reason}</p>
                </div>
                {selectedLeave.adminComment && (
                  <div className={`mt-3 rounded-[14px] p-3.5 ${darkMode ? "bg-[rgba(74,222,128,0.12)]" : "bg-[#e4f1e6]"}`}>
                    <p className={`text-xs ${muted}`}>Admin comment</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedLeave.adminComment}</p>
                  </div>
                )}
              </div>

              <div className="py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px]">Timeline</h3>
                </div>
                {[
                  { label: "Request submitted", value: selectedLeave.createdAt ? new Date(selectedLeave.createdAt).toLocaleString("en-IN") : "-", type: "submitted" },
                  { label: selectedLeave.status === "pending" ? "Waiting for approval" : `Request ${selectedLeave.status}`, value: selectedLeave.reviewedAt ? new Date(selectedLeave.reviewedAt).toLocaleString("en-IN") : "Pending", type: selectedLeave.status },
                ].map((item, index) => (
                  <div key={item.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {index === 0 && <span className={`absolute left-[7px] top-5 h-[calc(100%-12px)] w-px ${timelineLineClass(selectedLeave.status)}`} />}
                    <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full ${timelineDotClass(item.type)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{item.label}</p>
                      <p className={`mt-0.5 text-xs ${muted}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {data?.canManageHr && selectedLeave.status === "pending" && (
                <div className={`rounded-[14px] p-3.5 ${softPanel}`}>
                  <p className="text-[14px]">Approval decision</p>
                  <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Add comment for the applicant..." className={`mt-3 min-h-20 w-full rounded-[16px] px-4 py-3 text-[13.5px] outline-none ${textField}`} />
                  <div className="mt-3 flex gap-2">
                    <button disabled={leaveReviewSaving} onClick={() => reviewLeave("declined")} className={`h-10 flex-1 rounded-full px-4 text-[13px] disabled:opacity-60 ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`}>Decline</button>
                    <button disabled={leaveReviewSaving} onClick={() => reviewLeave("approved")} className={`h-10 flex-1 rounded-full px-4 text-[13px] disabled:opacity-60 ${primaryButton}`}>Approve</button>
                  </div>
                </div>
              )}
              {canDeleteLeave(selectedLeave) && (
                <button onClick={() => deleteLeave(selectedLeave)} className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] ${darkMode ? "bg-[rgba(251,113,133,0.13)] text-[#f7aab5]" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"}`}>
                  <Trash2 className="h-4 w-4" /> Delete pending request
                </button>
              )}
            </div>
          </section>
            );
          })()}
        </div>
      )}

      {selectedEmployee && (
        <div onMouseDown={() => { setSelectedEmployee(null); setEmployeeDetailExpanded(false); }} className={backdrop}>
          <section onMouseDown={(event) => event.stopPropagation()} className={`employee-report-drawer employee-report-shell hr-employee-drawer absolute flex flex-col overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.16)] ${employeeDetailExpanded ? "employee-report-shell-expanded" : "sm:!rounded-[24px]"} animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${drawerSheet}`}>
            <DrawerHead
              darkMode={darkMode}
              icon={UserRound}
              tone="sky"
              title={`Employee profile · ${selectedEmployee.displayName || selectedEmployee.username}`}
              subtitle="Profile, HR setup, employee documents, and request history."
              onClose={() => { setSelectedEmployee(null); setEmployeeDetailExpanded(false); }}
              extra={(
                <Button darkMode={darkMode} variant="soft" size="sm" icon={employeeDetailExpanded ? Minimize2 : Maximize2} onClick={() => setEmployeeDetailExpanded((current) => !current)} aria-label={employeeDetailExpanded ? "Restore drawer size" : "Expand employee profile"}>
                  <span className="hidden sm:inline">{employeeDetailExpanded ? "Restore" : "Expand"}</span>
                </Button>
              )}
            />
            <div className={`min-h-0 flex-1 overflow-hidden ${drawerBody}`}>
              <div className={`grid h-full min-h-0 gap-5 overflow-y-auto p-5 ${employeeDetailExpanded ? "xl:grid-cols-[280px_minmax(0,1fr)]" : "xl:grid-cols-[250px_minmax(0,1fr)]"}`}>
                <aside className={`h-fit space-y-3 self-start rounded-[20px] p-4 xl:sticky xl:top-0 ${softPanel}`}>
                  <Badge icon={UserRound} tone="sky" darkMode={darkMode}>Employee</Badge>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <UserAvatar user={selectedEmployee} name={selectedEmployee.displayName || selectedEmployee.username} size="lg" rounded="lg" />
                    <p className="mt-4 text-lg">{selectedEmployee.displayName || selectedEmployee.username}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{selectedEmployee.designation || "Designation not set"}</p>
                  </div>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white"}`}>
                    <p className={`text-xs ${muted}`}>Department</p>
                    <p className="mt-2 text-base">{selectedEmployee.department || "Not set"}</p>
                  </div>
                  <div className={`rounded-[14px] p-4 ${darkMode ? "bg-[rgba(167,139,250,0.14)] text-white" : "bg-[#ece8fb] text-[#141414]"}`}>
                    <p className={`text-xs ${darkMode ? "text-white/60" : "text-[#6b4fd1]"}`}>Access</p>
                    <p className="mt-2 text-[28px] leading-none tracking-[-0.03em] tabular-nums">{selectedEmployee.menus?.length || 0}</p>
                    <p className={`mt-1.5 text-xs ${darkMode ? "text-white/55" : "text-[#6b6b6b]"}`}>{selectedEmployee.privileges?.length || 0} permissions</p>
                  </div>
                </aside>
                <div className="min-w-0 space-y-5">
                  {data?.canManageHr && (
                    <form onSubmit={saveEmployeeHrDetails} className={`rounded-[20px] border p-6 ${drawerCard}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className={`text-xs ${muted}`}>Leave and attendance policy</p>
                          <h3 className="mt-1 text-[18px] tracking-[-0.01em]">Employee HR setup</h3>
                        </div>
                        <button disabled={employeeSaving} className={`h-9 rounded-full px-5 text-[13px] disabled:opacity-60 ${primaryButton}`}>{employeeSaving ? "Saving..." : "Save details"}</button>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <DrawerSelect darkMode={darkMode} label="Employment Status" required value={employeeForm.employmentType === "permanent" ? "Permanent" : "Probation"} placeholder="Select status..." options={["Permanent", "Probation"]} onChange={(employmentType) => setEmployeeForm((current) => ({ ...current, employmentType: employmentType.toLowerCase() }))} />
                      </div>
                      <label className={`mt-4 flex items-start gap-3 rounded-[16px] p-4 ${softPanel}`}>
                        <button
                          type="button"
                          disabled={Boolean(employeeRemoteSavingId)}
                          onClick={() => saveEmployeeRemoteWork(!employeeForm.remoteWorkEnabled)}
                          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border transition disabled:cursor-not-allowed disabled:opacity-60 ${employeeForm.remoteWorkEnabled ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-[#141414]" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/15 bg-white/[0.04]" : "border-[#dcdcd8] bg-white hover:border-[#a3a3a0]"}`}
                        >
                          {employeeRemoteSavingId === selectedEmployee?.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : employeeForm.remoteWorkEnabled && <Check className="h-4 w-4" />}
                        </button>
                        <span>
                          <span className="block text-sm">Remote Today {employeeRemoteSavingId === selectedEmployee?.id ? "· Saving..." : ""}</span>
                          <span className={`mt-1 block text-xs leading-5 ${muted}`}>When this is checked, this employee attendance is marked as remote and skips the office geofence.</span>
                        </span>
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={`flex items-start gap-3 rounded-[16px] p-4 ${softPanel}`}>
                          <button
                            type="button"
                            disabled={Boolean(employeeRemoteSavingId)}
                            onClick={() => saveEmployeeManualAttendance(selectedEmployeeOnLeaveToday ? "clear" : "leave")}
                            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedEmployeeOnLeaveToday ? "border-[#c0394b] bg-[#c0394b] text-white" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-[#dcdcd8] bg-white hover:border-[#a3a3a0]"}`}
                          >
                            {employeeRemoteSavingId === selectedEmployee?.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : selectedEmployeeOnLeaveToday && <Check className="h-4 w-4" />}
                          </button>
                          <span>
                            <span className="block text-sm">On Leave</span>
                            <span className={`mt-1 block text-xs leading-5 ${muted}`}>Marks today as leave in attendance when the employee did not apply from the leave module.</span>
                          </span>
                        </label>
                        <label className={`flex items-start gap-3 rounded-[16px] p-4 ${softPanel}`}>
                          <button
                            type="button"
                            disabled={Boolean(employeeRemoteSavingId)}
                            onClick={() => saveEmployeeManualAttendance(selectedEmployeeHalfDayToday ? "clear" : "half-day")}
                            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedEmployeeHalfDayToday ? "border-[#6b4fd1] bg-[#ece8fb] text-[#6b4fd1]" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-[#dcdcd8] bg-white hover:border-[#a3a3a0]"}`}
                          >
                            {employeeRemoteSavingId === selectedEmployee?.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : selectedEmployeeHalfDayToday && <Check className="h-4 w-4" />}
                          </button>
                          <span>
                            <span className="block text-sm">Half Day</span>
                            <span className={`mt-1 block text-xs leading-5 ${muted}`}>Marks today as HF in attendance exports with a lavender cell.</span>
                          </span>
                        </label>
                      </div>
                      <p className={`mt-3 text-xs leading-5 ${muted}`}>Permanent employees get 1 paid leave per month. Probation employees have no paid leave.</p>
                    </form>
                  )}
                  <section className={`w-full min-w-0 overflow-hidden rounded-[20px] border p-3 sm:p-6 ${drawerCard}`}>
                    <div className="flex flex-col gap-1">
                      <p className={`text-xs ${muted}`}>Profile information</p>
                      <h3 className="text-[18px] tracking-[-0.01em]">Contact & work details</h3>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          { label: "Work mode", value: selectedEmployee.remoteWorkEnabled ? "Remote" : "Office", icon: MapPin, tone: selectedEmployee.remoteWorkEnabled ? "sky" : "neutral" },
                          { label: "Status", value: selectedEmployee.blacklisted ? "Blacklisted" : "Active", icon: CheckCircle2, tone: selectedEmployee.blacklisted ? "rose" : "mint" },
                          { label: "Paid leave remaining", value: `${selectedEmployeePaidLeavesRemaining} day${selectedEmployeePaidLeavesRemaining === 1 ? "" : "s"}`, icon: CalendarCheck, tone: "lime" },
                          { label: "Total leaves taken", value: `${selectedEmployeeTotalLeavesTaken} day${selectedEmployeeTotalLeavesTaken === 1 ? "" : "s"}`, icon: CalendarDays, tone: "rose" },
                          { label: "Email", value: selectedEmployee.email || "Not set", icon: Mail, tone: "amber" },
                          { label: "Phone", value: selectedEmployee.phone || "Not set", icon: Phone, tone: "sky" },
                          { label: "WhatsApp", value: selectedEmployee.whatsappPhone || "Not set", icon: MessageCircle, tone: "mint" },
                        ].map(({ label, value, icon: Icon, tone }) => (
                          <div key={label} className={`min-w-0 rounded-[16px] p-4 ${softPanel}`}>
                            <div className="flex items-start gap-3">
                              <IconTile icon={Icon} tone={tone} darkMode={darkMode} size="sm" />
                              <span className="min-w-0">
                                <span className={`block text-xs ${muted}`}>{label}</span>
                                <span className="mt-0.5 block truncate text-[13.5px]">{value}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>
                  <section className={`rounded-[20px] border p-6 ${drawerCard}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-[18px] tracking-[-0.01em]">Documents</h3>
                        <p className={`mt-1 text-sm ${muted}`}>Employee document links stored in their Google Drive folder.</p>
                      </div>
                      {selectedEmployee.employeeDocumentsFolderId && (
                        <a href={`https://drive.google.com/drive/folders/${selectedEmployee.employeeDocumentsFolderId}`} target="_blank" rel="noreferrer" className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border px-4 text-[13px] sm:w-auto ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}>
                          <FolderOpen className="h-4 w-4" />
                          Open folder
                        </a>
                      )}
                    </div>
                    <div className={`mt-5 grid min-w-0 grid-cols-1 gap-4 ${employeeDetailExpanded ? "lg:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-2"}`}>
                      {EMPLOYEE_DOCUMENT_TYPES.map((docType) => {
                        const documents = (selectedEmployee.employeeDocuments || []).filter((item) => item.type === docType.id);
                        const document = documents[0];
                        const multiple = MULTI_EMPLOYEE_DOCUMENT_TYPES.has(docType.id);
                        const uploading = employeeDocumentUploading === docType.id;
                        const progress = employeeDocumentUploadProgress[docType.id];
                        const meta = DOCUMENT_CARD_META[docType.id] || DOCUMENT_CARD_META.aadhar_card_copy;
                        const Icon = meta.Icon;
                        return (
                          <div key={docType.id} className={`w-full min-w-0 overflow-hidden rounded-[20px] border p-3 sm:p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <IconTile icon={Icon} tone={meta.tone} darkMode={darkMode} size="sm" />
                                <div className="min-w-0">
                                  <p className={`text-[11.5px] ${muted}`}>HR document</p>
                                  <p className={`truncate text-[13.5px] ${darkMode ? "text-white" : "text-[#141414]"}`}>{docType.label}</p>
                                </div>
                              </div>
                              <Chip tone={document ? "mint" : "rose"} darkMode={darkMode} className="h-6 shrink-0 px-2.5 text-[11.5px]">{document ? `${documents.length} uploaded` : "Missing"}</Chip>
                            </div>
                            <div style={{ backgroundColor: darkMode ? toneOf(meta.tone)[2] : toneOf(meta.tone)[0] }} className={`relative min-h-[150px] w-full min-w-0 overflow-hidden rounded-[16px] p-5 sm:min-h-[180px] ${darkMode ? "text-white" : "text-[#141414]"}`}>
                              <p className="text-[12.5px] opacity-70">{document ? "Verified file" : "Pending upload"}</p>
                              <h4 className="mt-4 max-w-full break-words text-[19px] leading-[1.12] tracking-[-0.01em] sm:max-w-[15rem]">{docType.label}</h4>
                              <p className={`mt-2 text-xs ${darkMode ? "text-white/60" : "text-[#6b6b6b]"}`}>{progress ? `Uploading ${progress.current} of ${progress.total}` : document ? `${documents.length} file${documents.length === 1 ? "" : "s"} ready for HR review` : multiple ? "Multiple files accepted" : "No document uploaded yet"}</p>
                              {progress && (
                                <div className="mt-3">
                                  <p className={`truncate text-[10px] ${darkMode ? "text-white/60" : "text-black/45"}`}>{progress.name}</p>
                                  <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/15" : "bg-black/10"}`}>
                                    <div className={`h-full rounded-full transition-all duration-300 ${darkMode ? "bg-white" : "bg-black"}`} style={{ width: `${Math.max(8, Math.round((progress.current / progress.total) * 100))}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                              <label className={`inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full text-[13px] transition ${uploading ? "pointer-events-none opacity-60" : ""} ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                                {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {progress ? `Uploading ${progress.current}/${progress.total}` : uploading ? "Uploading" : multiple && document ? "Add files" : document ? "Replace" : "Upload"}
                                <input type="file" className="hidden" multiple={multiple} disabled={uploading} onChange={(event) => uploadEmployeeDocument(docType.id, event.target.files)} />
                              </label>
                              <a href={document?.url || "#"} target={document ? "_blank" : undefined} rel="noreferrer" onClick={(event) => { if (!document) event.preventDefault(); }} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/[0.07] text-white" : "bg-[#f4f4f2] text-[#141414]"}`}>
                                {document ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className={`rounded-[20px] border p-6 ${drawerCard}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[18px] tracking-[-0.01em]">HR request history</h3>
                        <p className={`mt-1 text-sm ${muted}`}>Leave applications submitted by this employee.</p>
                      </div>
                      <Chip darkMode={darkMode}>{selectedEmployeeLeaveHistory.length} requests</Chip>
                    </div>
                    {selectedEmployeeLeaveHistory.length ? (
                      <div className="mt-4 grid gap-2">
                        {selectedEmployeeLeaveHistory.slice(0, 5).map((request) => (
                          <button key={request.id} onClick={() => { setSelectedLeave(request); setReviewComment(request.adminComment || ""); }} className={`flex w-full items-center justify-between gap-4 rounded-[14px] px-4 py-3 text-left transition ${darkMode ? "bg-white/[0.04] hover:bg-white/[0.06]" : "bg-[#f7f7f5] hover:bg-[#f1f1ef]"}`}>
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px]">{request.leaveType}</span>
                              <span className={`mt-1 block truncate text-xs ${muted}`}>{request.startDate} to {request.endDate} · {request.days} day{request.days === 1 ? "" : "s"}</span>
                            </span>
                            {statusChip(request.status, "shrink-0")}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className={`mt-4 rounded-[14px] p-4 ${softPanel}`}>
                        <p className={`text-sm ${muted}`}>No leave applications from this employee yet.</p>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
