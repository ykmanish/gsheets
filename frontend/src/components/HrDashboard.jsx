"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileText, FolderOpen, GraduationCap, HeartPulse, IdCard, LogIn, LogOut, Mail, MapPin, Maximize2, MessageCircle, MessageSquare, Minimize2, Navigation, Pencil, Phone, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, Upload, UserRound, Users, WalletCards, X } from "lucide-react";
import { API_URL, useAuth } from "./AuthProvider";
import { showAppToast } from "./ToastPill";
import UserAvatar from "./UserAvatar";

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
  aadhar_card_copy: { Icon: IdCard, card: "bg-orange-100 text-[#171714]", icon: "bg-orange-50 text-orange-600" },
  pan_card_copy: { Icon: BadgeCheck, card: "bg-blue-100 text-[#171714]", icon: "bg-blue-50 text-blue-600" },
  educational_certificates: { Icon: GraduationCap, card: "bg-cyan-100 text-[#171714]", icon: "bg-cyan-50 text-cyan-600" },
  last_3_months_pay_slip: { Icon: ReceiptText, card: "bg-violet-100 text-[#171714]", icon: "bg-violet-50 text-violet-600" },
  last_company_letters: { Icon: Building2, card: "bg-rose-100 text-[#171714]", icon: "bg-rose-50 text-rose-600" },
  medical_certificate: { Icon: HeartPulse, card: "bg-green-100 text-[#171714]", icon: "bg-green-50 text-green-600" },
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

function EmptyState({ darkMode, icon: Icon, title, text }) {
  return (
    <div className={`grid min-h-[260px] place-items-center rounded-[24px]  p-6 text-center ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#f8f7f3]"}`}>
      <div>
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${darkMode ? "bg-white/10 text-white/70" : "bg-[#eafbdc] text-[#17643f]"}`}>
          <Icon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-black">{title}</h2>
        <p className={`mt-2 max-w-xl text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/55"}`}>{text}</p>
      </div>
    </div>
  );
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
  const selectRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const filteredOptions = searchable
    ? options.filter((option) => String(option || "").toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (selectRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  return (
    <label ref={selectRef} className="relative block text-xs font-normal text-black/65 dark:text-white/60">
      {label}{required ? " *" : ""}
      <button type="button" onClick={() => { setOpen((current) => !current); setSearch(""); }} className={`mt-2 flex h-10 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-normal outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"}`}>
        <span className={value ? "" : muted}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""} ${muted}`} />
      </button>
      {open && (
        <div className={`absolute left-0 top-[calc(100%+8px)] z-[110] w-full rounded-2xl border p-1.5 shadow-2xl ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          {searchable && (
            <div className="relative mb-1.5">
              <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm font-normal outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white" : "border-black/10 bg-white text-[#171714]"}`} />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
          {filteredOptions.map((option) => (
            <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-sm font-normal transition ${value === option ? "bg-[#171714] text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}>
              {option}
            </button>
          ))}
          {!filteredOptions.length && <p className={`px-3 py-3 text-sm font-normal ${muted}`}>No employee found</p>}
          </div>
        </div>
      )}
    </label>
  );
}

function DrawerDatePicker({ darkMode, label, value, placeholder, onChange, minDate }) {
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date());
  const [panelStyle, setPanelStyle] = useState({});
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const toInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const displayValue = value ? formatDateLabel(value) : placeholder;
  function monthDays(baseDate) {
    const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }
  function chooseDate(day) {
    const value = toInput(day);
    if (minDate && value < minDate) return;
    onChange(value);
    setOpen(false);
  }
  function renderMonth(baseDate) {
    const baseMonth = baseDate.getMonth();
    const title = baseDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    return (
      <div>
        <p className="mb-2 text-xs font-medium">{title}</p>
          <div className="grid grid-cols-7 gap-y-1 text-center">
          {monthDays(baseDate).map((day) => {
            const key = toInput(day);
            const isSelected = key === value;
            const disabled = minDate && key < minDate;
            const inMonth = day.getMonth() === baseMonth;
            return (
              <button
                key={key}
                type="button"
                onClick={() => chooseDate(day)}
                className={`grid h-8 place-items-center text-xs font-normal transition ${
                  disabled
                    ? darkMode ? "cursor-not-allowed text-white/16" : "cursor-not-allowed text-black/15"
                    : isSelected
                    ? "rounded-full bg-blue-600 text-white shadow-sm"
                    : inMonth
                        ? darkMode ? "text-white hover:bg-white/10" : "text-black hover:bg-black/[0.04]"
                        : darkMode ? "text-white/22" : "text-black/18"
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (pickerRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function updatePanelPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const gap = 8;
      const panelWidth = 280;
      const wantedHeight = 392;
      const roomBelow = window.innerHeight - rect.bottom - gap - margin;
      const roomAbove = rect.top - gap - margin;
      const openUpward = roomBelow < wantedHeight && roomAbove > roomBelow;
      setPanelStyle({
        position: "fixed",
        width: panelWidth,
        left: Math.min(Math.max(margin, rect.left), window.innerWidth - panelWidth - margin),
        top: openUpward ? undefined : rect.bottom + gap,
        bottom: openUpward ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: Math.max(300, Math.min(wantedHeight, openUpward ? roomAbove : roomBelow)),
      });
    }
    updatePanelPosition();
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  return (
    <div ref={pickerRef} className="relative">
      <p className="text-xs font-medium text-black/65 dark:text-white/60">{label} *</p>
      <button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)} className={`mt-2 flex h-10 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-normal outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"}`}>
        <span className={value ? "" : muted}>{displayValue}</span>
        <CalendarDays className={`h-4 w-4 ${muted}`} />
      </button>
      {open && (
        <div style={panelStyle} className={`z-[110] overflow-hidden rounded-[20px] border shadow-2xl ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          <div className="p-4 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setMonthDate(new Date(year, month - 1, 1))} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}><ChevronLeft className="h-4 w-4" /></button>
            <p className="text-xs font-medium text-blue-600">Choose {label.toLowerCase()}</p>
            <button type="button" onClick={() => setMonthDate(new Date(year, month + 1, 1))} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className={`mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase ${muted}`}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-1">{day}</span>)}
          </div>
          <div>
            {renderMonth(new Date(year, month, 1))}
          </div>
          </div>
          <div className={`flex items-center justify-end gap-5 border-t px-4 py-3 ${darkMode ? "border-white/10" : "border-black/10"}`}>
            <button type="button" onClick={() => setOpen(false)} className={`text-xs font-bold ${muted}`}>Cancel</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-black text-[#171714] dark:text-white">Apply</button>
          </div>
        </div>
      )}
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
  const [attendanceSearchResults, setAttendanceSearchResults] = useState([]);
  const [attendanceForm, setAttendanceForm] = useState({ address: "", latitude: "", longitude: "", radiusMeters: 100 });
  const [todayReportSubmitted, setTodayReportSubmitted] = useState(false);
  const [todayReportExempt, setTodayReportExempt] = useState(false);
  const [todayReportChecking, setTodayReportChecking] = useState(false);
  const attendanceSearchTimerRef = useRef(null);
  const attendanceGoogleGeocoderRef = useRef(null);
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
      const overview = await api("/hr/overview");
      setData(overview);
      if (overview?.attendanceSettings) {
        setAttendanceForm({
          address: overview.attendanceSettings.address || "",
          latitude: overview.attendanceSettings.latitude || "",
          longitude: overview.attendanceSettings.longitude || "",
          radiusMeters: overview.attendanceSettings.radiusMeters || 100,
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

  const employees = data?.employees || [];
  const documents = data?.documents || [];
  const salarySlips = data?.salarySlips || [];
  const leaveRequests = data?.leaveRequests || [];
  const attendanceRecords = data?.attendanceRecords || [];
  const attendanceSettings = data?.attendanceSettings || {};
  const canManageSalary = Boolean(data?.canManageHr);
  const currentName = user?.displayName || user?.username || "Employee";
  const muted = darkMode ? "text-slate-400" : "text-black/58";
  const panel = darkMode ? "border-white/[0.075] bg-[#090d12]" : "border-[#dfe7e4] bg-white";
  const salaryPanel = darkMode ? "border-white/[0.075] bg-[#090d12]" : "border-[#e7ebe4] bg-white";
  const salaryTableSurface = darkMode ? "bg-[#0c1117]" : "bg-[#fbfcf9]";
  const salaryRowBorder = darkMode ? "border-white/[0.06] bg-[#0f151c] hover:bg-[#141b24]" : "border-[#edf0ea] bg-white hover:bg-[#fbfcf7]";
  const salaryBadge = darkMode
    ? "border border-emerald-400/25 bg-emerald-400/14 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.04)]"
    : "bg-[#e8f7ef] text-[#08764f]";
  const softPanel = darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]";
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
    ...myAttendanceRecords.map((record) => ({
      id: `attendance-${record.id || `${record.userId}-${record.date}`}`,
      kind: "Attendance",
      userId: record.userId,
      employeeName: record.employeeName,
      department: record.department,
      title: record.workMode === "remote" ? "Remote attendance" : "Office attendance",
      detail: record.clockInAt ? `${record.clockOutAt ? "Completed" : "Checked in"} · ${record.workMinutes ? `${Math.floor(record.workMinutes / 60)}h ${record.workMinutes % 60}m` : "0h"}` : "Not marked",
      period: record.date,
      startDate: record.date,
      endDate: record.date,
      status: record.status || "pending",
      onView: () => {
        const employee = employees.find((item) => String(item.id || "") === String(record.userId || ""));
        if (employee) openEmployeeDetail(employee);
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

  function statusClass(status) {
    if (status === "approved") return darkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-50 text-emerald-700";
    if (status === "declined") return darkMode ? "bg-red-400/15 text-red-200" : "bg-red-50 text-red-700";
    return darkMode ? "bg-amber-400/15 text-amber-200" : "bg-amber-50 text-amber-700";
  }

  function timelineDotClass(type) {
    if (type === "submitted") return "bg-blue-500";
    if (type === "approved") return "bg-emerald-500";
    if (type === "declined") return "bg-red-500";
    return darkMode ? "bg-white/20" : "bg-black/15";
  }

  function timelineLineClass(status) {
    if (status === "approved") return "bg-gradient-to-b from-blue-500 to-emerald-500";
    if (status === "declined") return "bg-gradient-to-b from-blue-500 to-red-500";
    return darkMode ? "bg-white/10" : "bg-black/10";
  }

  const hero = {
    dashboard: {
      eyebrow: "HR Workspace",
      icon: BriefcaseBusiness,
      title: "HR requests and approvals.",
      text: "Review employee records, leave applications, attendance, and profile documents from one clean workspace.",
    },
    employees: {
      eyebrow: "Employee Records",
      icon: Users,
      title: "Employee directory.",
      text: "View real employee profiles, departments, designations, roles, and contact details from backend users.",
    },
    leave: {
      eyebrow: "Leave Management",
      icon: CalendarDays,
      title: "Leave applications.",
      text: "Employees can apply for leave, and HR/admin can approve or decline requests with comments.",
    },
  }[section] || {};
  const HeroIcon = hero.icon || BriefcaseBusiness;
  const showHero = section !== "dashboard" && section !== "employees" && section !== "leave" && section !== "attendance";

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#05080c] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`}>
      {showHero && <section className={`relative z-20 mb-5 overflow-hidden rounded-[30px] border p-6 sm:p-8 ${panel}`}>
        {!darkMode && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/80 to-transparent" />
          </div>
        )}
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-[#dfe7e4] bg-[#e8f6ee] text-[#0f6b49]"}`}>
              <HeroIcon className="h-4 w-4" /> {hero.eyebrow}
            </span>
            <h1 className={`mt-5 max-w-4xl small text-4xl font-black leading-[0.96] tracking-tight ${darkMode ? "text-white" : "text-[#161616]"}`}>{hero.title}</h1>
            <p className={`mt-4 max-w-3xl  text-sm font-medium leading-6 sm:text-base ${muted}`}>{hero.text}</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button onClick={loadHr} disabled={loading} className={`flex h-12 items-center justify-center gap-2 rounded-3xl border px-5 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/10 bg-white/10 text-white hover:bg-white/15" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {section === "leave" && (
              <button type="button" onClick={() => setLeaveDrawerOpen(true)} className="flex h-12 items-center gap-2 rounded-3xl bg-[#171714] px-5 text-sm font-bold text-white shadow-sm">
                <Plus className="h-4 w-4" /> Apply for Leave
              </button>
            )}
          </div>
        </div>
      </section>}

      {section === "dashboard" && (
        <section className={`w-full rounded-[28px] ${panel}`}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">HR request records</h2>
              <p className={`mt-1 text-sm ${muted}`}>Leave and attendance requests in one full-width table.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button onClick={loadHr} disabled={loading} className={`flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:border-white/20 hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{dashboardRequests.length} request{dashboardRequests.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto]">
            <DrawerSelect darkMode={darkMode} label="Request Type" value={requestTypeFilter} placeholder="Select type..." options={["All", "Leave", "Attendance"]} onChange={setRequestTypeFilter} />
            <DrawerSelect darkMode={darkMode} label="Employee" searchable searchPlaceholder="Search employee..." value={requestEmployeeFilter} placeholder="Select employee..." options={requestEmployeeOptions} onChange={setRequestEmployeeFilter} />
            <DrawerDatePicker darkMode={darkMode} label="From Date" value={requestDateFilter.startDate} placeholder="Start date" onChange={(startDate) => setRequestDateFilter((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? startDate : current.endDate }))} />
            <DrawerDatePicker darkMode={darkMode} label="To Date" value={requestDateFilter.endDate} placeholder="End date" minDate={requestDateFilter.startDate} onChange={(endDate) => setRequestDateFilter((current) => ({ ...current, endDate }))} />
            <button type="button" onClick={() => { setRequestTypeFilter("All"); setRequestEmployeeFilter("All employees"); setRequestDateFilter({ startDate: "", endDate: "" }); }} className={`mt-auto h-10 rounded-2xl border px-4 text-xs font-black transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white/70 hover:bg-white/[0.07]" : "border-black/10 bg-white text-black/60 hover:bg-[#fafbf8]"}`}>
              Clear
            </button>
          </div>
          {dashboardRequests.length ? (
            <div className="overflow-x-auto px-3 pb-4">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left">
                <thead className={darkMode ? "bg-[#15171c]" : "bg-white"}>
                  <tr>
                    {["Request", "Employee", "Details", "Period / Date", "Status", "Actions"].map((heading) => (
                      <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboardRequests.map((request) => (
                    <tr key={request.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                      <td className="rounded-l-xl px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-[#eafbdc] text-[#17643f]"}`}>{request.kind}</span></td>
                      <td className="px-4 py-3"><p className="text-sm font-bold">{request.employeeName || "-"}</p><p className={`text-xs ${muted}`}>{request.department || "No department"}</p></td>
                      <td className="px-4 py-3"><p className="text-sm font-semibold">{request.title}</p><p className={`text-xs ${muted}`}>{request.detail}</p></td>
                      <td className="px-4 py-3 text-sm">{request.period || "-"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span></td>
                      <td className="rounded-r-xl px-4 py-3"><button onClick={request.onView} className={`h-9 rounded-lg border px-4 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/5 text-white/75" : "border-slate-200 bg-white text-slate-700"}`}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4"><EmptyState darkMode={darkMode} icon={MessageSquare} title={loading ? "Loading HR requests" : "No HR requests yet"} text="Leave and attendance requests will appear here in one table." /></div>
          )}
        </section>
      )}

      {section === "employees" && (
        <section className={`overflow-hidden rounded-[28px]  ${panel}`}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Employees</h2>
              <p className={`mt-1 text-sm ${muted}`}>{data?.canManageHr ? "Showing all active users from backend roles." : "Showing your employee profile only."}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, role, department..." className={`h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none sm:w-80 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`} />
              </div>
              <button onClick={loadHr} disabled={loading} className={`flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/10 bg-white/10 text-white hover:bg-white/15" : "border-[#dfe7e4] bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>
          {filteredEmployees.length ? (
            <div className="overflow-x-auto px-3 pb-4">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left">
                <thead className={darkMode ? "bg-[#15171c]" : "bg-white"}>
                  <tr>
                    {["Employee", "Designation", "Department", "Employment", "Remote", "Contact", "Actions"].map((heading) => (
                      <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                      <td className="rounded-l-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={employee} name={employee.displayName || employee.username} className="h-10 w-10" />
                          <div>
                            <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{employee.displayName || employee.username}</p>
                            <p className={`mt-0.5 text-xs ${muted}`}>{employee.username || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{employee.designation || "Not set"}</td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{employee.department || "Not set"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${employee.employmentType === "permanent" ? "bg-emerald-500/10 text-emerald-600" : darkMode ? "bg-amber-400/15 text-amber-200" : "bg-amber-50 text-amber-700"}`}>{employee.employmentType || "probation"}</span></td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={Boolean(employeeRemoteSavingId)}
                          onClick={() => saveEmployeeRemoteWorkFor(employee, !employee.remoteWorkEnabled)}
                          className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60 ${employee.remoteWorkEnabled ? "border-emerald-500 bg-emerald-500 text-white" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-black/10 bg-white hover:border-emerald-300"}`}
                          title={employee.remoteWorkEnabled ? "Disable remote today" : "Mark remote today"}
                        >
                          {employeeRemoteSavingId === employee.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : employee.remoteWorkEnabled && <Check className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{employee.phone || employee.whatsappPhone || employee.email || "-"}</td>
                      <td className="rounded-r-xl px-4 py-3">
                        <button onClick={() => openEmployeeDetail(employee)} className={`flex h-9 items-center gap-2 rounded-lg border px-4 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/5 text-white/75" : "border-slate-200 bg-white text-slate-700"}`}>
                          <Eye className="h-3.5 w-3.5" /> View Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4"><EmptyState darkMode={darkMode} icon={Users} title={loading ? "Loading employees" : "No employees found"} text="Employees will appear here from real UIPL user accounts." /></div>
          )}
        </section>
      )}

      {section === "leave" && (
        <>
          <section className={`overflow-hidden rounded-[32px] ${darkMode ? "bg-[#090d12]" : "bg-white"}`}>
            <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">{data?.canManageHr ? "Leave Requests" : "My Leave Applications"}</h2>
                <p className={`mt-1 text-sm ${muted}`}>{data?.canManageHr ? "Approve or decline with a comment. The applicant gets notified." : "Track your submitted applications and admin response."}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button onClick={loadHr} disabled={loading} className={`flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:border-white/20 hover:bg-[#1d232d]" : "border-[#e1e5df] bg-white text-slate-700 hover:bg-[#fbfcf7]"}`}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button type="button" onClick={() => setLeaveDrawerOpen(true)} className="flex h-12 items-center gap-2 rounded-full bg-[#e7f6ed] px-5 text-sm font-bold text-[#08764f] transition hover:bg-[#d8f0e4]">
                  <Plus className="h-4 w-4" /> Apply for Leave
                </button>
                <span className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-[#f2ece5] text-[#6f6258]"}`}>{myLeaveRequests.length} request{myLeaveRequests.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Remaining paid leave", value: remainingPaidLeaves, note: `${monthlyPaidLeaveAllowance} allowed this month`, icon: CheckCircle2, tone: darkMode ? "bg-emerald-300/14 text-emerald-200" : "bg-emerald-50 text-emerald-700" },
                { label: "Leave taken", value: currentMonthLeaveTaken, note: monthLabelFromInput(currentLeaveMonth), icon: CalendarDays, tone: darkMode ? "bg-sky-300/14 text-sky-200" : "bg-sky-50 text-sky-700" },
                { label: "Advance leave", value: currentMonthAdvanceLeaves, note: "Deducted in salary slip", icon: WalletCards, tone: darkMode ? "bg-amber-300/14 text-amber-200" : "bg-amber-50 text-amber-700" },
                { label: "Pending approvals", value: currentMonthPendingLeaves, note: "Waiting for HR action", icon: MessageSquare, tone: darkMode ? "bg-violet-300/14 text-violet-200" : "bg-violet-50 text-violet-700" },
              ].map(({ label, value, note, icon: Icon, tone }) => (
                <div key={label} className={`rounded-[24px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfcf9]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-3xl font-black leading-none">{Number(value || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <p className="mt-4 text-sm font-black">{label}</p>
                  <p className={`mt-1 text-xs ${muted}`}>{note}</p>
                </div>
              ))}
            </div>
            {myLeaveRequests.length ? (
              <div className="px-6 pb-6">
                <div className={`overflow-hidden rounded-[28px] ${darkMode ? "border border-white/10 bg-white/[0.025]" : "bg-[#fbfcf9]"}`}>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[23%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[22%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className={muted}>
                    <tr className={`border-b ${darkMode ? "border-white/10" : "border-[#edf0ea] bg-[#fbfcf9]"}`}>
                      <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">Leave type</th>
                      <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">Period</th>
                      <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">Breakdown</th>
                      <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">Status</th>
                      <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">Approval</th>
                      <th className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">Actions</th>
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
                      <tr key={request.id} className={`h-[96px] border-b last:border-b-0 ${darkMode ? "border-white/10 hover:bg-white/[0.04]" : "border-[#edf0ea] bg-white hover:bg-[#fbfcf7]"}`}>
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={leaveAvatarUser} name={request.employeeName || request.leaveType} className="h-11 w-11" />
                            <div className="min-w-0">
                              <p className="truncate font-black">{data?.canManageHr ? request.employeeName : currentName}</p>
                              <p className={`truncate text-xs ${muted}`}>{request.leaveType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-5">
                          <p className="font-semibold">{request.startDate}</p>
                          <p className={`text-xs ${muted}`}>to {request.endDate}</p>
                        </td>
                        <td className="px-5 py-5">
                          <p className="font-bold">Total: {request.days} day{request.days === 1 ? "" : "s"}</p>
                          <p className={`mt-1 text-xs ${muted}`}>{request.paidLeaveDays || 0} paid · {request.unpaidLeaveDays || 0} unpaid</p>
                        </td>
                        <td className="px-5 py-5"><span className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-black capitalize ${statusClass(request.status)}`}>{request.status}</span></td>
                        <td className="px-5 py-5">
                          <p className="text-sm font-medium">{request.status === "pending" ? "Waiting for approval" : `${request.status} by ${request.reviewedBy?.name || "Admin"}`}</p>
                        </td>
                        <td className="px-5 py-5">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setSelectedLeave(request); setReviewComment(request.adminComment || ""); }} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${darkMode ? "border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]" : "border-[#e1e5df] bg-white text-[#171714] hover:bg-[#fbfcf7]"}`}>
                              <Eye className="h-4 w-4" /> View detail
                            </button>
                            {canDeleteLeave(request) && (
                              <button onClick={() => deleteLeave(request)} className={`grid h-10 w-10 place-items-center rounded-full border ${darkMode ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-red-200 bg-red-50 text-red-600"}`} title="Delete pending request">
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
                </div>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState darkMode={darkMode} icon={CalendarDays} title="No leave applications yet" text={data?.canManageHr ? "When employees apply for leave, approval requests will appear here." : "Click Apply for Leave to submit your first leave request."} />
              </div>
            )}
          </section>
        </>
      )}

      {section === "attendance" && (
        <section className={`overflow-hidden rounded-[32px] ${darkMode ? "bg-[#090d12]" : "bg-white"}`}>
          <div className="flex flex-col gap-4 px-7 pt-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">{data?.canManageHr ? "Attendance" : "My Attendance"}</h2>
              <p className={`mt-1 text-sm ${muted}`}>Geo-location based clock in and clock out for employees.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button onClick={loadHr} disabled={loading} className={`flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/[0.08] bg-[#0f151c] text-slate-100 hover:border-emerald-300/25 hover:bg-[#141b24]" : "border-[#e1e5df] bg-white text-slate-700 hover:bg-[#fbfcf7]"}`}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              {data?.canManageHr && (
                <button type="button" onClick={() => { setAttendanceSettingsExpanded(false); setAttendanceSettingsOpen(true); }} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#e7f6ed] px-5 text-sm font-bold text-[#08764f]">
                  <SlidersHorizontal className="h-4 w-4" /> Settings
                </button>
              )}
              <span className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-[#f2ece5] text-[#6f6258]"}`}>{myAttendanceRecords.length} record{myAttendanceRecords.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="px-7 pb-7 pt-7">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { icon: CheckCircle2, label: "Today status", value: todayAttendanceLabel, hint: todayAttendance?.clockInAt ? `In ${new Date(todayAttendance.clockInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Awaiting clock in", tone: "emerald" },
                  { icon: LogIn, label: "Clock in", value: todayAttendance?.clockInAt ? new Date(todayAttendance.clockInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-", hint: remoteWorkEnabled ? "Remote enabled" : attendanceConfigured ? "Location required" : "Geo fence not set", tone: "blue" },
                  { icon: LogOut, label: "Clock out", value: todayAttendance?.clockOutAt ? new Date(todayAttendance.clockOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-", hint: todayAttendance?.clockOutAt ? "Completed today" : "Pending", tone: "orange" },
                  { icon: CalendarDays, label: "Work time", value: todayWorkMinutes ? `${Math.floor(todayWorkMinutes / 60)}h ${todayWorkMinutes % 60}m` : "0h", hint: `${todayAttendanceRecords.length} marked today`, tone: "violet" },
                ].map((stat) => {
                  const Icon = stat.icon;
                  const toneClass = darkMode
                    ? stat.tone === "blue" ? "bg-sky-400/12 text-sky-300" : stat.tone === "orange" ? "bg-amber-400/12 text-amber-300" : stat.tone === "violet" ? "bg-violet-400/12 text-violet-300" : "bg-emerald-400/12 text-emerald-300"
                    : stat.tone === "blue" ? "bg-sky-50 text-sky-600" : stat.tone === "orange" ? "bg-amber-50 text-orange-600" : stat.tone === "violet" ? "bg-violet-50 text-violet-600" : "bg-[#e9fbf2] text-[#008f69]";
                  return (
                    <div key={stat.label} className={`min-h-[140px] rounded-[24px] p-5 ${darkMode ? "border border-white/[0.06] bg-[#0d131a]" : "bg-[#fbfcf9]"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <span className={`grid h-12 w-12 place-items-center rounded-full ${toneClass}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <strong className="max-w-[170px] truncate text-right text-3xl font-black">{stat.value}</strong>
                      </div>
                      <p className="mt-5 text-base font-black">{stat.label}</p>
                      <p className={`mt-1 text-sm ${muted}`}>{stat.hint}</p>
                    </div>
                  );
                })}
              </div>

              <div className={`rounded-[28px] p-5 ${darkMode ? "border border-white/[0.06] bg-[#0d131a]" : "bg-[#fbfcf9]"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-lg font-black">{remoteWorkEnabled ? "Remote attendance enabled" : attendanceConfigured ? "Attendance location active" : "Attendance location not set"}</p>
                    <p className={`mt-1 block max-w-full overflow-hidden truncate whitespace-nowrap text-sm ${muted}`}>{remoteWorkEnabled ? "Office geofence is skipped for your clock in and clock out." : attendanceSettings.address || "HR must set the office/site location before employees can clock in."}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" disabled={!attendanceReady || attendanceSaving || todayAttendance?.clockInAt} onClick={() => submitAttendance("clock-in")} className={`flex h-11 min-w-[118px] items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "bg-emerald-400/14 text-emerald-200 hover:bg-emerald-400/20" : "bg-[#e7f6ed] text-[#08764f]"}`}>
                      {attendanceClockAction === "clock-in" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} {attendanceClockAction === "clock-in" ? "Clocking in" : "Clock in"}
                    </button>
                    {mustFillReportBeforeClockOut ? (
                      <button type="button" disabled={todayReportChecking} onClick={() => router.push("/employee-daily-report")} className={`flex h-11 min-w-[178px] items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-55 ${darkMode ? "bg-sky-400/14 text-sky-200 hover:bg-sky-400/20" : "bg-sky-50 text-sky-700"}`}>
                        {todayReportChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Fill Employee Report
                      </button>
                    ) : (
                      <button type="button" disabled={!attendanceReady || attendanceSaving || !todayAttendance?.clockInAt || todayAttendance?.clockOutAt} onClick={() => submitAttendance("clock-out")} className={`flex h-11 min-w-[124px] items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "bg-red-600 text-white hover:bg-red-500" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                        {attendanceClockAction === "clock-out" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} {attendanceClockAction === "clock-out" ? "Clocking out" : "Clock out"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className={`overflow-hidden rounded-[28px] ${darkMode ? "border border-white/[0.06] bg-[#0c1117]" : "bg-[#fbfcf9]"}`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[13%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[13%]" />
                    </colgroup>
                    <thead className={muted}>
                      <tr className={`border-b ${darkMode ? "border-white/[0.06] bg-[#0b1016]" : "border-[#edf0ea] bg-[#fbfcf9]"}`}>
                        {["Employee", "Date", "Clock in", "Clock out", "Mode", "Hours", "Status"].map((heading) => (
                          <th key={heading} className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em]">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myAttendanceRecords.map((record) => {
                        const attendanceEmployee = String(record.userId || "") === String(user?.id || "") ? user : employees.find((employee) => String(employee.id || "") === String(record.userId || ""));
                        return (
                          <tr key={record.id} className={`h-[92px] border-b last:border-b-0 ${darkMode ? "border-white/[0.06] bg-[#0f151c] hover:bg-[#141b24]" : "border-[#edf0ea] bg-white hover:bg-[#fbfcf7]"}`}>
                            <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                <UserAvatar user={attendanceEmployee || record} name={record.employeeName} className="h-11 w-11" />
                                <div className="min-w-0">
                                  <p className="truncate font-black">{record.employeeName}</p>
                                  <p className={`truncate text-xs ${muted}`}>{record.designation || record.department || "Employee"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-5 font-semibold">{record.date}</td>
                            <td className={`px-5 py-5 ${muted}`}>{record.clockInAt ? new Date(record.clockInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                            <td className={`px-5 py-5 ${muted}`}>{record.clockOutAt ? new Date(record.clockOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                            <td className="px-5 py-5"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${record.workMode === "remote" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>{record.workMode || "office"}</span></td>
                            <td className="px-5 py-5 font-black">{record.workMinutes ? `${Math.floor(record.workMinutes / 60)}h ${record.workMinutes % 60}m` : "-"}</td>
                            <td className="px-5 py-5"><span className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-black capitalize ${record.status === "completed" ? salaryBadge : statusClass("pending")}`}>{record.status}</span></td>
                          </tr>
                        );
                      })}
                      {!myAttendanceRecords.length && (
                        <tr><td colSpan={7} className={`px-5 py-12 text-center ${muted}`}>No attendance records yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {attendanceSettingsOpen && (
        <div onMouseDown={closeAttendanceSettings} className="fixed inset-0 z-[90] flex justify-end bg-[#020609]/70 backdrop-blur-sm">
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={saveAttendanceSettings} className={`employee-report-drawer employee-report-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.38)] ${attendanceSettingsExpanded ? "employee-report-shell-expanded" : ""} animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#080c11] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div>
                <h2 className="text-xl font-black">Attendance settings</h2>
                <p className={`mt-1 text-xs ${muted}`}>Set the allowed work location and radius.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAttendanceSettingsExpanded((current) => !current)} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} aria-label={attendanceSettingsExpanded ? "Restore drawer size" : "Expand attendance settings"}>
                  {attendanceSettingsExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{attendanceSettingsExpanded ? "Restore" : "Expand"}</span>
                </button>
                <button type="button" onClick={closeAttendanceSettings} className={`h-8 rounded-full px-3 text-xs font-bold transition ${darkMode ? "text-emerald-300 hover:bg-white/10" : "text-[#08764f] hover:bg-[#e7f6ed]"}`}>Close</button>
              </div>
            </div>
            <div className={`min-h-0 flex-1 overflow-hidden ${darkMode ? "bg-[#060a0f]" : "bg-[#f5f7f2]"}`}>
              <div className="grid h-full min-h-0 gap-5 overflow-y-auto p-5 xl:grid-cols-[minmax(360px,0.48fr)_minmax(0,0.52fr)]">
                <div className="min-w-0 space-y-5">
                  <section className={`rounded-[26px] border p-5 ${darkMode ? "border-white/[0.07] bg-[#0d131a]" : "border-transparent bg-white"}`}>
                    <div className="flex flex-col gap-3">
                      <label className="newq relative text-xs font-bold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">Search address
                        <div className={`mt-2 flex h-12 items-center gap-3 rounded-full border px-5 ${darkMode ? "border-white/[0.1] bg-[#080d13]" : "border-[#e1e5df] bg-white"}`}>
                          <Search className={`h-4 w-4 ${muted}`} />
                          <input value={attendanceForm.address} onChange={(event) => handleAttendanceAddressInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchTypedAttendanceAddress(); } }} placeholder="Type office, site, city or landmark..." className="attendance-search-input newq min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm font-semibold outline-none ring-0 placeholder:text-black/35 focus:border-0 focus:outline-none focus:ring-0 dark:placeholder:text-white/35" />
                          {attendanceLocating && <RefreshCw className={`h-4 w-4 animate-spin ${muted}`} />}
                        </div>
                        {!!attendanceSearchResults.length && (
                          <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-[95] max-h-[360px] overflow-y-auto rounded-3xl border p-2 shadow-[0_20px_50px_rgba(15,23,42,0.16)] ${darkMode ? "border-white/[0.08] bg-[#101720]" : "border-[#e1e5df] bg-white"}`}>
                            {attendanceSearchResults.map((item) => {
                              const selected = item.lat !== null && item.lat !== undefined && item.lon !== null && item.lon !== undefined && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)) && String(Number(attendanceForm.latitude)) === String(Number(item.lat)) && String(Number(attendanceForm.longitude)) === String(Number(item.lon));
                              return (
                                <button key={`${item.place_id}-${item.display_name}`} type="button" onClick={() => selectAttendanceSearchResult(item)} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left normal-case tracking-normal transition ${selected ? darkMode ? "bg-emerald-400/10" : "bg-[#effbe9]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f6faf2]"}`}>
                                  <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${selected ? darkMode ? "bg-emerald-300/18 text-emerald-200" : "bg-[#6ee72f] text-[#10210c]" : darkMode ? "bg-emerald-400/12 text-emerald-300" : "bg-[#e7f6ed] text-[#08764f]"}`}><MapPin className="h-4 w-4" /></span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-black text-[#171714] dark:text-white">{item.name || item.display_name?.split(",")?.[0] || "Location"}</span>
                                    <span className={`mt-1 block line-clamp-2 text-xs leading-5 ${muted}`}>{item.display_name}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </label>
                      <button type="button" onClick={useCurrentAttendanceLocation} disabled={attendanceLocating} className={`newq h-12 w-fit rounded-full px-6 text-sm font-bold disabled:opacity-55 ${darkMode ? "bg-emerald-400/14 text-emerald-200 hover:bg-emerald-400/20" : "bg-[#e7f6ed] text-[#08764f]"}`}>Use current</button>
                    </div>
                  </section>

                  <section className={`rounded-[26px] border p-5 ${darkMode ? "border-white/[0.07] bg-[#0d131a]" : "border-transparent bg-white"}`}>
                    {attendanceForm.latitude && attendanceForm.longitude ? (
                      <>
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Selected location</p>
                        <p className="mt-2 block max-w-full overflow-hidden truncate whitespace-nowrap text-lg font-black">{attendanceForm.address || "Pinned location"}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{attendanceForm.latitude}, {attendanceForm.longitude}</p>
                      </div>
                      <a className={`inline-flex h-11 w-fit shrink-0 items-center gap-2 rounded-full px-5 text-sm font-bold ${darkMode ? "bg-emerald-400/14 text-emerald-200" : "bg-[#e7f6ed] text-[#08764f]"}`} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${attendanceForm.latitude},${attendanceForm.longitude}`)}`} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" /> Open map</a>
                    </div>
                    <div className="mt-5 grid gap-3">
                      <label className="text-xs font-medium">Latitude
                        <input type="number" step="any" value={attendanceForm.latitude} onChange={(event) => setAttendanceForm((current) => ({ ...current, latitude: event.target.value }))} className={`mt-2 h-11 w-full rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/[0.08] bg-[#080d13]" : "border-[#e1e5df] bg-white"}`} />
                      </label>
                      <label className="text-xs font-medium">Longitude
                        <input type="number" step="any" value={attendanceForm.longitude} onChange={(event) => setAttendanceForm((current) => ({ ...current, longitude: event.target.value }))} className={`mt-2 h-11 w-full rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/[0.08] bg-[#080d13]" : "border-[#e1e5df] bg-white"}`} />
                      </label>
                      <label className="block text-xs font-medium">Allowed radius
                        <div className={`mt-2 flex h-11 items-center rounded-2xl border px-3 ${darkMode ? "border-white/[0.08] bg-[#080d13]" : "border-[#e1e5df] bg-white"}`}>
                          <input type="number" min="25" value={attendanceForm.radiusMeters} onChange={(event) => setAttendanceForm((current) => ({ ...current, radiusMeters: event.target.value }))} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
                          <span className={`text-xs font-bold ${muted}`}>meters</span>
                        </div>
                      </label>
                    </div>
                    </>
                    ) : (
                      <div className={`rounded-2xl border border-dashed p-5 text-sm ${darkMode ? "border-white/10 text-white/45" : "border-black/10 text-black/45"}`}>Choose a location to show coordinates and radius.</div>
                    )}
                  </section>
                </div>
                <section className={`min-h-[420px] rounded-[26px] border p-5 ${darkMode ? "border-white/[0.07] bg-[#0d131a]" : "border-transparent bg-white"}`}>
                  <div className="h-full overflow-hidden rounded-[24px] border border-black/5 bg-[#eef2ed] dark:border-white/[0.07] dark:bg-[#080d13]">
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
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${darkMode ? "border-white/[0.07] bg-[#080c11]" : "border-black/10 bg-white"}`}>
              <button type="button" onClick={closeAttendanceSettings} className={`h-11 min-w-[108px] rounded-full border px-6 text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Cancel</button>
              <button disabled={attendanceSaving || !attendanceForm.latitude || !attendanceForm.longitude} className="h-11 min-w-[190px] rounded-full bg-[#6ee72f] px-7 text-sm font-bold text-[#10210c] shadow-[0_18px_45px_rgba(110,231,47,0.25)] disabled:opacity-60">{attendanceSaving ? "Saving..." : "Save geo fence"}</button>
            </div>
          </form>
        </div>
      )}

      {salaryDrawerOpen && (
        <div onMouseDown={() => setSalaryDrawerOpen(false)} className="fixed inset-0 z-[90] flex justify-end bg-[#10231c]/55 backdrop-blur-sm">
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={submitSalarySlip} className={`employee-report-drawer employee-report-shell salary-slip-drawer relative flex h-full w-full flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-start justify-between border-b p-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div>
                <h2 className="text-xl font-black">{editingSalaryId ? "Edit salary slip" : "Generate salary slip"}</h2>
                <p className={`mt-1 text-xs ${muted}`}>Salary details save for the next generation.</p>
              </div>
              <button type="button" onClick={() => setSalaryDrawerOpen(false)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-5 w-5" /></button>
            </div>
            <div className={`min-h-0 flex-1 overflow-hidden ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
              <div className={`grid h-full min-h-0 gap-5 p-5 ${canManageSalary ? "lg:grid-cols-[230px_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
                {canManageSalary && <aside className={`h-fit space-y-4 self-start rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-[#f0f3ec]"}`}>
                  <span className="inline-flex rounded-md bg-[#dcfacb] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#4b9b16]">Salary Slip</span>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white/70"}`}>
                    <p className={`text-[11px] font-bold uppercase ${muted}`}>Employee</p>
                    <p className="mt-2 text-lg font-black">{salaryForm.employeeName || "Select employee"}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{salaryForm.designation || "Designation not added"}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white/70"}`}>
                    <p className={`text-[11px] font-bold uppercase ${muted}`}>Pay period</p>
                    <p className="mt-2 font-black">{selectedSalaryMonthLabel || "Select month"}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{salaryForm.payDate ? `Pay date ${formatDateLabel(salaryForm.payDate)}` : "Pay date pending"}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-emerald-400/10" : "bg-[#dcfacb]"}`}>
                    <p className={`text-[11px] font-medium uppercase ${darkMode ? "text-emerald-100" : "text-[#4b9b16]"}`}>Net payable</p>
                    <p className="mt-2 text-2xl font-black">₹{Math.max(0, moneyValue(salaryForm.basic) + salaryForm.earnings.reduce((sum, item) => sum + moneyValue(item.amount), 0) - salaryForm.deductions.reduce((sum, item) => sum + moneyValue(item.amount), 0)).toLocaleString("en-IN")}</p>
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
                      <label key={key} className="text-xs font-medium">{label}{["employeeName", "joiningDate", "monthlyInHandSalary"].includes(key) ? " *" : ""}
                        <input required={["employeeName", "joiningDate", "monthlyInHandSalary"].includes(key)} type={type} value={salaryForm[key]} onChange={(event) => setSalaryForm((current) => ({ ...current, [key]: event.target.value, ...(key === "monthlyInHandSalary" ? { basic: event.target.value } : {}) }))} className={`mt-2 h-10 w-full rounded-2xl border px-3 text-sm font-bold outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                      </label>
                    ))}
                    <DrawerSelect darkMode={darkMode} label="Employment Status" required value={salaryForm.employmentType === "permanent" ? "Permanent" : "Probation"} placeholder="Select status..." options={["Permanent", "Probation"]} onChange={(employmentType) => setSalaryForm((current) => ({ ...current, employmentType: employmentType.toLowerCase() }))} />
                    <label className="text-xs font-medium">Paid Days
                      <input readOnly value="Auto calculated from approved leave" className={`mt-2 h-10 w-full rounded-2xl border px-3 text-sm font-bold outline-none ${darkMode ? "border-white/10 bg-white/[0.025] text-white/50" : "border-black/10 bg-slate-50 text-black/50"}`} />
                    </label>
                    <label className="text-xs font-medium">LOP Days
                      <input readOnly value="Auto calculated from approved leave" className={`mt-2 h-10 w-full rounded-2xl border px-3 text-sm font-bold outline-none ${darkMode ? "border-white/10 bg-white/[0.025] text-white/50" : "border-black/10 bg-slate-50 text-black/50"}`} />
                    </label>
                    <DrawerDatePicker darkMode={darkMode} label="Joining Date" value={salaryForm.joiningDate} placeholder="Select joining date" onChange={(joiningDate) => setSalaryForm((current) => ({ ...current, joiningDate, month: current.month && current.month < joiningDate.slice(0, 7) ? joiningDate.slice(0, 7) : current.month }))} />
                  </div>
                )]] : []),
              ].map(([title, content]) => (
                <section key={title} className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                  <p className={`mb-3 text-[11px] font-medium uppercase tracking-wide ${muted}`}>{title}</p>
                  {content}
                </section>
              ))}

              {canManageSalary && ["earnings", "deductions"].map((type) => (
                <section key={type} className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>{type === "earnings" ? "Allowances / earnings" : "Deductions"}</p>
                    <button type="button" onClick={() => addSalaryComponent(type)} className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}>Add</button>
                  </div>
                  <div className="space-y-2">
                    {salaryForm[type].map((item, index) => (
                      <div key={`${type}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_130px]">
                        <input value={item.label} onChange={(event) => updateSalaryComponent(type, index, { label: event.target.value })} placeholder={type === "earnings" ? "Allowance name" : "Deduction name"} className={`h-10 rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                        <input type="number" value={item.amount} onChange={(event) => updateSalaryComponent(type, index, { amount: event.target.value })} placeholder="Amount" className={`h-10 rounded-2xl border px-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {salaryMeta?.canEditCompany && (
                <section className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                  <p className={`mb-3 text-[11px] font-medium uppercase tracking-wide ${muted}`}>Company details</p>
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`grid h-14 w-20 place-items-center overflow-hidden rounded-2xl border text-xs font-bold ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#f8faf8]"}`}>
                      {salaryForm.companyLogo ? <Image src={salaryForm.companyLogo} alt="Company logo" width={80} height={56} unoptimized className="h-full w-full object-contain" /> : "Logo"}
                    </span>
                    <label className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-bold ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
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
                      <label key={key} className="text-xs font-medium">{label}
                        <input value={salaryForm[key]} onChange={(event) => setSalaryForm((current) => ({ ...current, [key]: event.target.value }))} className={`mt-2 h-10 w-full rounded-2xl border px-3 text-sm font-bold outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                      </label>
                    ))}
                    <label className="text-xs font-medium sm:col-span-2">Footer Note
                      <textarea value={salaryForm.note} onChange={(event) => setSalaryForm((current) => ({ ...current, note: event.target.value }))} className={`mt-2 min-h-20 w-full rounded-2xl border px-3 py-3 text-sm font-bold outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                    </label>
                  </div>
                </section>
              )}
                </div>
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/10 bg-white"}`}>
              <button type="button" onClick={() => setSalaryDrawerOpen(false)} className={`h-11 min-w-[108px] rounded-full border px-6 text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Cancel</button>
              <button disabled={salarySaving} className="h-11 min-w-[190px] rounded-full bg-[#6ee72f] px-7 text-sm font-bold text-[#10210c] shadow-[0_18px_45px_rgba(110,231,47,0.25)] disabled:opacity-60">{salarySaving ? "Saving..." : !canManageSalary ? "Download PDF" : editingSalaryId ? "Save changes" : "Generate PDF"}</button>
            </div>
          </form>
        </div>
      )}

      {salaryDeleteTarget && (
        <div onMouseDown={() => setSalaryDeleteTarget(null)} className="fixed inset-0 z-[120] grid place-items-center bg-[#10231c]/55 p-4 backdrop-blur-sm">
          <section onMouseDown={(event) => event.stopPropagation()} className={`w-full max-w-md overflow-hidden rounded-[28px] border p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)] animate-[mrn-drawer-in_260ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
            <div className="flex items-start gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-red-400/15 text-red-200" : "bg-red-50 text-red-600"}`}>
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-black">Delete salary slip?</h2>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>This will permanently remove {salaryDeleteTarget.title || "this salary slip"} for {salaryDeleteTarget.employeeName || "the employee"}.</p>
              </div>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button type="button" onClick={() => setSalaryDeleteTarget(null)} className={`h-11 rounded-full border px-6 text-sm font-bold ${darkMode ? "border-white/15 bg-white/[0.04]" : "border-black/10 bg-white"}`}>Cancel</button>
              <button type="button" onClick={() => deleteSalarySlip(salaryDeleteTarget)} className="h-11 rounded-full bg-red-500 px-6 text-sm font-bold text-white shadow-[0_16px_36px_rgba(239,68,68,0.22)]">Delete slip</button>
            </div>
          </section>
        </div>
      )}

      {leaveDrawerOpen && (
        <div onMouseDown={() => setLeaveDrawerOpen(false)} className="fixed inset-0 z-[90] flex justify-end bg-[#10231c]/55 backdrop-blur-sm">
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={submitLeave} className={`employee-report-drawer employee-report-shell hr-leave-drawer relative flex h-full w-full flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-start justify-between border-b p-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div><h2 className="text-xl font-black">Apply for Leave</h2><p className={`mt-1 text-xs ${muted}`}>Sent to HR/admin for approval.</p></div>
              </div>
              <button type="button" onClick={() => setLeaveDrawerOpen(false)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-5 w-5" /></button>
            </div>
            <div className={`min-h-0 flex-1 overflow-hidden ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
              <div className="grid h-full min-h-0 gap-5 p-5 lg:grid-cols-[230px_minmax(0,1fr)]">
                <aside className={`h-fit space-y-4 self-start rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-[#f0f3ec]"}`}>
                  <span className={`inline-flex rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-wide ${darkMode ? "bg-lime-300/15 text-lime-200" : "bg-[#dcfacb] text-[#4b9b16]"}`}>Leave request</span>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white/75"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Applicant</p>
                    <p className="mt-2 text-lg font-black">{currentName}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{user?.designation || user?.department || "Employee"}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-white/75"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Leave type</p>
                    <p className="mt-2 text-base font-black">{leaveForm.leaveType || "Select leave type"}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-emerald-300/12 text-emerald-100" : "bg-[#dfffd2] text-[#10210c]"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${darkMode ? "text-emerald-100/75" : "text-[#4b9b16]"}`}>Period</p>
                    <p className="mt-2 text-sm font-black leading-5">{leavePeriodPreview}</p>
                    <p className={`mt-1 text-xs ${darkMode ? "text-emerald-100/70" : "text-black/55"}`}>{leavePreviewDays ? `${leavePreviewDays} day${leavePreviewDays === 1 ? "" : "s"}` : "Dates not selected"}</p>
                  </div>
                </aside>
                <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
                  <section className={`rounded-[22px] p-5 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                    <p className={`mb-3 text-[11px] font-bold uppercase tracking-wide ${muted}`}>Leave details</p>
                    <DrawerSelect darkMode={darkMode} label="Leave Type" required value={leaveForm.leaveType} placeholder="Select leave type..." options={["Casual Leave", "Sick Leave", "Paid Leave", "Advance Leave"]} onChange={(leaveType) => setLeaveForm((current) => ({ ...current, leaveType }))} />
                    <p className={`mt-3 text-xs leading-5 ${muted}`}>Leave type is for reference. If policy balance is exceeded later, extra days can be marked as advance leave.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DrawerDatePicker darkMode={darkMode} label="Start Date" value={leaveForm.startDate} placeholder="Select start date" minDate={todayInput()} onChange={(startDate) => setLeaveForm((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? startDate : current.endDate }))} />
                      <DrawerDatePicker darkMode={darkMode} label="End Date" value={leaveForm.endDate} placeholder="Select end date" minDate={leaveForm.startDate || todayInput()} onChange={(endDate) => setLeaveForm((current) => ({ ...current, endDate }))} />
                    </div>
                  </section>
                  <div className={`rounded-[22px] p-5 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                    <label className="block text-xs font-semibold text-black/65 dark:text-white/60">Reason *</label>
                    <textarea required minLength={10} value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Please provide a detailed reason..." className={`mt-2 min-h-32 w-full rounded-2xl border px-3 py-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] placeholder:text-white/35" : "border-black/10 bg-white placeholder:text-black/35"}`} />
                    <p className={`mt-2 text-xs ${muted}`}>Minimum 10 characters required</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/10 bg-white"}`}>
              <button type="button" onClick={() => setLeaveDrawerOpen(false)} className={`h-11 min-w-[108px] rounded-full border px-6 text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Cancel</button>
              <button disabled={leaveSaving} className="h-11 min-w-[190px] rounded-full bg-[#6ee72f] px-7 text-sm font-bold text-[#10210c] shadow-[0_18px_45px_rgba(110,231,47,0.25)] disabled:opacity-60">{leaveSaving ? "Sending..." : "Send for approval"}</button>
            </div>
          </form>
        </div>
      )}

      {selectedLeave && (
        <div onMouseDown={() => setSelectedLeave(null)} className="fixed inset-0 z-[90] flex justify-end bg-black/35 p-3 backdrop-blur-md sm:p-5">
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
          <section onMouseDown={(event) => event.stopPropagation()} className={`flex h-full w-full max-w-md flex-col overflow-hidden rounded-[18px] border shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "border-white/10 bg-[#111216] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-6 w-6 rounded-md ${darkMode ? "bg-emerald-300/15" : "bg-[#eafbdc]"}`} />
                <p className="truncate text-sm font-black">Leave #{selectedLeave.id?.slice(-5) || "request"}</p>
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${statusClass(selectedLeave.status)}`}>{selectedLeave.status}</span>
              </div>
              <button type="button" onClick={() => setSelectedLeave(null)} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="flex items-center gap-4 pb-4">
                <UserAvatar user={selectedLeaveAvatarUser} name={selectedLeave.employeeName} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black">{selectedLeave.employeeName}</h2>
                  <p className={`mt-1 truncate text-sm ${muted}`}>{selectedLeave.department || "No department"}</p>
                </div>
              </div>

              <div className={`grid grid-cols-3 border-y py-3 ${darkMode ? "border-white/10" : "border-black/10"}`}>
                {[["Type", selectedLeave.leaveType], ["Paid", selectedLeave.paidLeaveDays || 0], ["Unpaid", selectedLeave.unpaidLeaveDays || 0]].map(([label, value]) => (
                  <div key={label}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>{label}</p>
                    <p className="mt-1 text-sm font-black capitalize">{value}</p>
                  </div>
                ))}
              </div>

              <div className={`border-b py-4 ${darkMode ? "border-white/10" : "border-black/10"}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black">Leave details</h3>
                </div>
                <div className={`rounded-2xl p-3 ${darkMode ? "bg-white/[0.045]" : "bg-[#f8f9fc]"}`}>
                  <p className="text-sm font-bold">{selectedLeave.startDate} → {selectedLeave.endDate}</p>
                  <p className={`mt-1 text-xs ${muted}`}>Submitted {selectedLeave.createdAt ? new Date(selectedLeave.createdAt).toLocaleString("en-IN") : "-"}</p>
                </div>
                <div className={`mt-3 rounded-2xl p-3 ${darkMode ? "bg-white/[0.045]" : "bg-[#f8f9fc]"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Reason</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedLeave.reason}</p>
                </div>
                {selectedLeave.adminComment && (
                  <div className={`mt-3 rounded-2xl p-3 ${darkMode ? "bg-emerald-400/10" : "bg-emerald-50"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Admin comment</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedLeave.adminComment}</p>
                  </div>
                )}
              </div>

              <div className="py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black">Timeline</h3>
                </div>
                {[
                  { label: "Request submitted", value: selectedLeave.createdAt ? new Date(selectedLeave.createdAt).toLocaleString("en-IN") : "-", type: "submitted" },
                  { label: selectedLeave.status === "pending" ? "Waiting for approval" : `Request ${selectedLeave.status}`, value: selectedLeave.reviewedAt ? new Date(selectedLeave.reviewedAt).toLocaleString("en-IN") : "Pending", type: selectedLeave.status },
                ].map((item, index) => (
                  <div key={item.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {index === 0 && <span className={`absolute left-[7px] top-5 h-[calc(100%-12px)] w-px ${timelineLineClass(selectedLeave.status)}`} />}
                    <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full ${timelineDotClass(item.type)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{item.label}</p>
                      <p className={`mt-0.5 text-xs ${muted}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {data?.canManageHr && selectedLeave.status === "pending" && (
                <div className={`rounded-2xl p-3 ${darkMode ? "bg-white/[0.045]" : "bg-[#f8f9fc]"}`}>
                  <p className="text-sm font-black">Approval decision</p>
                  <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Add comment for the applicant..." className={`mt-3 min-h-20 w-full rounded-2xl border px-3 py-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] placeholder:text-white/35" : "border-black/10 bg-white placeholder:text-black/35"}`} />
                  <div className="mt-3 flex gap-2">
                    <button disabled={leaveReviewSaving} onClick={() => reviewLeave("declined")} className="h-10 flex-1 rounded-full border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 disabled:opacity-60">Decline</button>
                    <button disabled={leaveReviewSaving} onClick={() => reviewLeave("approved")} className="h-10 flex-1 rounded-full bg-[#171714] px-4 text-sm font-bold text-white disabled:opacity-60">Approve</button>
                  </div>
                </div>
              )}
              {canDeleteLeave(selectedLeave) && (
                <button onClick={() => deleteLeave(selectedLeave)} className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-bold ${darkMode ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-red-200 bg-red-50 text-red-600"}`}>
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
        <div onMouseDown={() => { setSelectedEmployee(null); setEmployeeDetailExpanded(false); }} className="fixed inset-0 z-[90] flex justify-end bg-[#020609]/70 backdrop-blur-sm">
          <section onMouseDown={(event) => event.stopPropagation()} className={`employee-report-drawer employee-report-shell hr-employee-drawer absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.28)] ${employeeDetailExpanded ? "employee-report-shell-expanded" : ""} animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#101216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black">Employee profile · {selectedEmployee.displayName || selectedEmployee.username}</h2>
                <p className={`mt-1 truncate text-xs ${muted}`}>Profile, HR setup, employee documents, and request history.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEmployeeDetailExpanded((current) => !current)} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} aria-label={employeeDetailExpanded ? "Restore drawer size" : "Expand employee profile"}>
                  {employeeDetailExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{employeeDetailExpanded ? "Restore" : "Expand"}</span>
                </button>
                <button type="button" onClick={() => { setSelectedEmployee(null); setEmployeeDetailExpanded(false); }} className={`h-9 rounded-full px-3 text-xs font-bold transition ${darkMode ? "text-emerald-300 hover:bg-white/10" : "text-[#08764f] hover:bg-[#e7f6ed]"}`}>Close</button>
              </div>
            </div>
            <div className={`min-h-0 flex-1 overflow-hidden ${darkMode ? "bg-[#0a0d12]" : "bg-[#f5f7f2]"}`}>
              <div className={`grid h-full min-h-0 gap-5 overflow-y-auto p-5 ${employeeDetailExpanded ? "xl:grid-cols-[280px_minmax(0,1fr)]" : "xl:grid-cols-[250px_minmax(0,1fr)]"}`}>
                <aside className={`h-fit space-y-4 self-start rounded-[26px] border p-5 xl:sticky xl:top-0 ${darkMode ? "border-white/[0.07] bg-[#0f141b]" : "border-transparent bg-white"}`}>
                  <span className={`inline-flex rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-wide ${darkMode ? "bg-lime-300/15 text-lime-200" : "bg-[#dcfacb] text-[#4b9b16]"}`}>Employee</span>
                  <div className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-emerald-100 bg-white"}`}>
                    <UserAvatar user={selectedEmployee} name={selectedEmployee.displayName || selectedEmployee.username} size="lg" rounded="lg" />
                    <p className="mt-4 text-lg font-black">{selectedEmployee.displayName || selectedEmployee.username}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{selectedEmployee.designation || "Designation not set"}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-emerald-100 bg-white"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Department</p>
                    <p className="mt-2 text-base font-black">{selectedEmployee.department || "Not set"}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-emerald-300/12 text-emerald-100" : "bg-[#dfffd2] text-[#10210c]"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${darkMode ? "text-emerald-100/75" : "text-[#4b9b16]"}`}>Access</p>
                    <p className="mt-2 text-3xl font-black">{selectedEmployee.menus?.length || 0}</p>
                    <p className={`mt-1 text-xs ${darkMode ? "text-emerald-100/70" : "text-black/55"}`}>{selectedEmployee.privileges?.length || 0} permissions</p>
                  </div>
                </aside>
                <div className="min-w-0 space-y-5">
                  {data?.canManageHr && (
                    <form onSubmit={saveEmployeeHrDetails} className={`rounded-[28px] border p-6 ${darkMode ? "border-white/[0.07] bg-[#0f141b]" : "border-transparent bg-white"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Leave and attendance policy</p>
                          <h3 className="mt-1 text-xl font-black">Employee HR setup</h3>
                        </div>
                        <button disabled={employeeSaving} className="h-10 rounded-full bg-[#6ee72f] px-5 text-sm font-bold text-[#10210c] disabled:opacity-60">{employeeSaving ? "Saving..." : "Save details"}</button>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <DrawerSelect darkMode={darkMode} label="Employment Status" required value={employeeForm.employmentType === "permanent" ? "Permanent" : "Probation"} placeholder="Select status..." options={["Permanent", "Probation"]} onChange={(employmentType) => setEmployeeForm((current) => ({ ...current, employmentType: employmentType.toLowerCase() }))} />
                      </div>
                      <label className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${darkMode ? "border-sky-300/15 bg-sky-300/8" : "border-sky-100 bg-sky-50"}`}>
                        <button
                          type="button"
                          disabled={Boolean(employeeRemoteSavingId)}
                          onClick={() => saveEmployeeRemoteWork(!employeeForm.remoteWorkEnabled)}
                          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60 ${employeeForm.remoteWorkEnabled ? "border-emerald-500 bg-emerald-500 text-white" : darkMode ? "border-white/15 bg-white/[0.04]" : "border-black/10 bg-white hover:border-emerald-300"}`}
                        >
                          {employeeRemoteSavingId === selectedEmployee?.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : employeeForm.remoteWorkEnabled && <Check className="h-4 w-4" />}
                        </button>
                        <span>
                          <span className="block text-sm font-black">Remote Today {employeeRemoteSavingId === selectedEmployee?.id ? "· Saving..." : ""}</span>
                          <span className={`mt-1 block text-xs leading-5 ${muted}`}>When this is checked, this employee attendance is marked as remote and skips the office geofence.</span>
                        </span>
                      </label>
                      <p className={`mt-3 text-xs leading-5 ${muted}`}>Permanent employees get 1 paid leave per month. Probation employees have no paid leave.</p>
                    </form>
                  )}
                  <section className={`w-full min-w-0 overflow-hidden rounded-[22px] border p-3 sm:rounded-[28px] sm:p-6 ${darkMode ? "border-white/[0.07] bg-[#0f141b]" : "border-transparent bg-white"}`}>
                    <div className="flex flex-col gap-1">
                      <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Profile information</p>
                      <h3 className="text-xl font-black">Contact & work details</h3>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          { label: "Work mode", value: selectedEmployee.remoteWorkEnabled ? "Remote" : "Office", icon: MapPin, tone: selectedEmployee.remoteWorkEnabled ? (darkMode ? "bg-sky-300/14 text-sky-200" : "bg-sky-100 text-sky-700") : (darkMode ? "bg-white/10 text-white/70" : "bg-black/5 text-black/60") },
                          { label: "Status", value: selectedEmployee.blacklisted ? "Blacklisted" : "Active", icon: CheckCircle2, tone: selectedEmployee.blacklisted ? (darkMode ? "bg-red-400/14 text-red-200" : "bg-red-100 text-red-700") : (darkMode ? "bg-emerald-300/14 text-emerald-200" : "bg-emerald-100 text-emerald-700") },
                          { label: "Paid leave remaining", value: `${selectedEmployeePaidLeavesRemaining} day${selectedEmployeePaidLeavesRemaining === 1 ? "" : "s"}`, icon: CalendarCheck, tone: darkMode ? "bg-lime-300/14 text-lime-200" : "bg-lime-100 text-lime-700" },
                          { label: "Total leaves taken", value: `${selectedEmployeeTotalLeavesTaken} day${selectedEmployeeTotalLeavesTaken === 1 ? "" : "s"}`, icon: CalendarDays, tone: darkMode ? "bg-rose-300/14 text-rose-200" : "bg-rose-100 text-rose-700" },
                          { label: "Email", value: selectedEmployee.email || "Not set", icon: Mail, tone: darkMode ? "bg-amber-300/14 text-amber-200" : "bg-amber-100 text-amber-700" },
                          { label: "Phone", value: selectedEmployee.phone || "Not set", icon: Phone, tone: darkMode ? "bg-blue-300/14 text-blue-200" : "bg-blue-100 text-blue-700" },
                          { label: "WhatsApp", value: selectedEmployee.whatsappPhone || "Not set", icon: MessageCircle, tone: darkMode ? "bg-green-300/14 text-green-200" : "bg-green-100 text-green-700" },
                        ].map(({ label, value, icon: Icon, tone }) => (
                          <div key={label} className={`min-w-0 rounded-[20px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f5f7f2]"}`}>
                            <div className="flex items-start gap-3">
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className={`block text-[10px] font-bold uppercase tracking-wide ${muted}`}>{label}</span>
                                <span className="mt-1 block truncate text-sm font-black">{value}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>
                  <section className={`rounded-[28px] border p-6 ${darkMode ? "border-white/[0.07] bg-[#0f141b]" : "border-transparent bg-white"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-xl font-black">Documents</h3>
                        <p className={`mt-1 text-sm ${muted}`}>Employee document links stored in their Google Drive folder.</p>
                      </div>
                      {selectedEmployee.employeeDocumentsFolderId && (
                        <a href={`https://drive.google.com/drive/folders/${selectedEmployee.employeeDocumentsFolderId}`} target="_blank" rel="noreferrer" className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-black sm:w-auto ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#eef8e8] text-[#39710f] hover:bg-[#e1f7d3]"}`}>
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
                          <div key={docType.id} className={`w-full min-w-0 overflow-hidden rounded-[20px] border p-3 transition hover:-translate-y-0.5 sm:rounded-[24px] sm:p-4 ${darkMode ? "border-white/10 bg-[#191b20]" : "border-black/5 bg-white"}`}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/10 text-white" : meta.icon}`}>
                                  <Icon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                  <p className={`text-[11px] font-semibold ${darkMode ? "text-white/55" : "text-black/50"}`}>HR Document</p>
                                  <p className="truncate text-sm font-black text-[#171714] dark:text-white">{docType.label}</p>
                                </div>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${document ? (darkMode ? "bg-emerald-400/18 text-emerald-100" : "bg-emerald-100 text-emerald-700") : (darkMode ? "bg-red-400/18 text-red-100" : "bg-red-100 text-red-700")}`}>{document ? `${documents.length} uploaded` : "Missing"}</span>
                            </div>
                            <div className={`relative min-h-[170px] w-full min-w-0 overflow-hidden rounded-[18px] p-5 sm:min-h-[200px] sm:p-6 ${darkMode ? "bg-white/10 text-white" : meta.card}`}>
                              <p className="text-sm font-semibold opacity-80">{document ? "Verified file" : "Pending upload"}</p>
                              <h4 className="mt-5 max-w-full break-words text-[21px] font-black leading-[1.08] text-[#171714] dark:text-white sm:max-w-[15rem] sm:text-[22px]">{docType.label}</h4>
                              <p className={`mt-2 text-xs font-semibold ${darkMode ? "text-white/70" : "text-black/55"}`}>{progress ? `Uploading ${progress.current} of ${progress.total}` : document ? `${documents.length} file${documents.length === 1 ? "" : "s"} ready for HR review` : multiple ? "Multiple files accepted" : "No document uploaded yet"}</p>
                              {progress && (
                                <div className="mt-3">
                                  <p className={`truncate text-[10px] font-semibold ${darkMode ? "text-white/60" : "text-black/45"}`}>{progress.name}</p>
                                  <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/15" : "bg-black/10"}`}>
                                    <div className={`h-full rounded-full transition-all duration-300 ${darkMode ? "bg-white" : "bg-black"}`} style={{ width: `${Math.max(8, Math.round((progress.current / progress.total) * 100))}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                              <label className={`inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-black transition ${uploading ? "pointer-events-none opacity-60" : ""} ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#f5f6f2] text-[#171714] hover:bg-[#ecefe8]"}`}>
                                {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {progress ? `Uploading ${progress.current}/${progress.total}` : uploading ? "Uploading" : multiple && document ? "Add files" : document ? "Replace" : "Upload"}
                                <input type="file" className="hidden" multiple={multiple} disabled={uploading} onChange={(event) => uploadEmployeeDocument(docType.id, event.target.files)} />
                              </label>
                              <a href={document?.url || "#"} target={document ? "_blank" : undefined} rel="noreferrer" onClick={(event) => { if (!document) event.preventDefault(); }} className={`grid h-10 w-12 place-items-center rounded-xl ${darkMode ? "bg-white/10 text-white" : "bg-[#f5f6f2] text-[#171714]"}`}>
                                {document ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className={`rounded-[28px] border p-6 ${darkMode ? "border-white/[0.07] bg-[#0f141b]" : "border-transparent bg-white"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">HR request history</h3>
                        <p className={`mt-1 text-sm ${muted}`}>Leave applications submitted by this employee.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-black/5 text-black/55"}`}>{selectedEmployeeLeaveHistory.length} requests</span>
                    </div>
                    {selectedEmployeeLeaveHistory.length ? (
                      <div className="mt-4 overflow-hidden rounded-2xl">
                        {selectedEmployeeLeaveHistory.slice(0, 5).map((request) => (
                          <button key={request.id} onClick={() => { setSelectedLeave(request); setReviewComment(request.adminComment || ""); }} className={`flex w-full items-center justify-between gap-4 border-b p-4 text-left last:border-b-0 ${darkMode ? "border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06]" : "border-black/5 bg-[#f7f5ef] hover:bg-[#f1f4ee]"}`}>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black">{request.leaveType}</span>
                              <span className={`mt-1 block truncate text-xs ${muted}`}>{request.startDate} to {request.endDate} · {request.days} day{request.days === 1 ? "" : "s"}</span>
                            </span>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className={`mt-4 rounded-2xl p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#f7f5ef]"}`}>
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
