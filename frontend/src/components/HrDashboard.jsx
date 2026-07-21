"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FileText, Mail, MessageCircle, Pencil, Phone, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound, Users, WalletCards, X } from "lucide-react";
import { API_URL, useAuth } from "./AuthProvider";
import { showAppToast } from "./ToastPill";

async function api(path) {
  const response = await fetch(`${API_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
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
    <label ref={selectRef} className="relative block text-xs font-medium text-black/65 dark:text-white/60">
      {label}{required ? " *" : ""}
      <button type="button" onClick={() => { setOpen((current) => !current); setSearch(""); }} className={`mt-2 flex h-10 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-semibold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"}`}>
        <span className={value ? "" : muted}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""} ${muted}`} />
      </button>
      {open && (
        <div className={`absolute left-0 top-[calc(100%+8px)] z-[110] w-full rounded-2xl border p-1.5 shadow-2xl ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          {searchable && (
            <div className="relative mb-1.5">
              <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm font-medium outline-none ${darkMode ? "border-white/10 bg-white/[0.04] text-white" : "border-black/10 bg-white text-[#171714]"}`} />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
          {filteredOptions.map((option) => (
            <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-sm font-medium transition ${value === option ? "bg-[#171714] text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}>
              {option}
            </button>
          ))}
          {!filteredOptions.length && <p className={`px-3 py-3 text-sm font-medium ${muted}`}>No employee found</p>}
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
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
    uan: "",
    paidDays: 30,
    lopDays: 0,
    basic: "",
    earnings: [{ label: "House Rent Allowance", amount: "" }, { label: "Conveyance Allowance", amount: "" }],
    deductions: [{ label: "EPF Contribution", amount: "" }, { label: "Professional Tax", amount: "" }],
    companyName: "UIPL Docs",
    companyLocation: "India",
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
      setData(await api("/hr/overview"));
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

  const employees = data?.employees || [];
  const documents = data?.documents || [];
  const salarySlips = data?.salarySlips || [];
  const leaveRequests = data?.leaveRequests || [];
  const canManageSalary = Boolean(data?.canManageHr);
  const currentName = user?.displayName || user?.username || "Employee";
  const muted = darkMode ? "text-white/58" : "text-black/58";
  const panel = darkMode ? "border-white/10 bg-[#171a20]" : "border-[#dfe7e4] bg-white";
  const salaryPanel = darkMode ? "border-white/[0.08] bg-[#0f1217] shadow-[0_24px_70px_rgba(0,0,0,0.35)]" : panel;
  const salaryTableSurface = darkMode ? "bg-[#11151b]" : "bg-white";
  const salaryRowBorder = darkMode ? "border-white/[0.075] hover:bg-[#151a22]" : "border-black/5 hover:bg-[#f8faf8]";
  const salaryBadge = darkMode
    ? "border border-emerald-400/25 bg-emerald-400/14 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.04)]"
    : "bg-emerald-500/10 text-emerald-700";
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
  const selectedEmployeeLeaveHistory = selectedEmployee ? leaveRequests.filter((request) => request.userId === selectedEmployee.id) : [];
  const filteredEmployees = activeEmployees.filter((employee) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [employee.displayName, employee.username, employee.department, employee.designation, employee.roleName].some((value) => String(value || "").toLowerCase().includes(search));
  });

  const recentLeaveRequests = myLeaveRequests.slice(0, 6);
  const pendingSalaryRequests = [];
  const pendingDocumentRequests = [];
  const dashboardRequests = [
    ...recentLeaveRequests.map((request) => ({
      id: `leave-${request.id}`,
      kind: "Leave",
      employeeName: request.employeeName,
      department: request.department,
      title: request.leaveType,
      detail: `${request.days} day${request.days === 1 ? "" : "s"}`,
      period: `${request.startDate} to ${request.endDate}`,
      status: request.status,
      onView: () => {
        setSelectedLeave(request);
        setReviewComment(request.adminComment || "");
      },
    })),
    ...pendingSalaryRequests,
    ...pendingDocumentRequests,
  ];
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
        uan: profile.uan || "",
        paidDays: profile.paidDays || 30,
        lopDays: profile.lopDays || 0,
        basic: profile.basic || "",
        earnings: profile.earnings?.length ? profile.earnings : current.earnings,
        deductions: profile.deductions?.length ? profile.deductions : current.deductions,
        companyName: company.companyName || "UIPL Docs",
        companyLocation: company.companyLocation || "India",
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
        uan: slip.uan || "",
        paidDays: slip.paidDays || 30,
        lopDays: slip.lopDays || 0,
        basic: slip.basic || "",
        earnings: slip.earnings?.filter((item) => !/^basic(\s+salary)?$/i.test(String(item.label || "").trim()))?.length ? slip.earnings.filter((item) => !/^basic(\s+salary)?$/i.test(String(item.label || "").trim())) : current.earnings,
        deductions: slip.deductions?.length ? slip.deductions : current.deductions,
        companyName: company.companyName || "UIPL Docs",
        companyLocation: company.companyLocation || "India",
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
      text: "Review employee leave applications, salary slip requests, and HR document requests from one clean workspace.",
    },
    employees: {
      eyebrow: "Employee Records",
      icon: Users,
      title: "Employee directory.",
      text: "View real employee profiles, departments, designations, roles, and contact details from backend users.",
    },
    documents: {
      eyebrow: "HR Documents",
      icon: FileText,
      title: "Employee document library.",
      text: "Offer letters, appointment letters, experience letters, and other HR PDFs appear here when connected.",
    },
    salary: {
      eyebrow: "Salary Slips",
      icon: WalletCards,
      title: "Salary slip downloads.",
      text: "Employees can download available payslips, and HR can track salary slip requests here.",
    },
    leave: {
      eyebrow: "Leave Management",
      icon: CalendarDays,
      title: "Leave applications.",
      text: "Employees can apply for leave, and HR/admin can approve or decline requests with comments.",
    },
  }[section] || {};
  const HeroIcon = hero.icon || BriefcaseBusiness;
  const showHero = section !== "dashboard" && section !== "employees" && section !== "documents" && section !== "salary" && section !== "leave";

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"}`}>
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
            {section === "salary" && (
              <button type="button" disabled={!salarySlips[0]} onClick={() => downloadSalarySlip(salarySlips[0]).catch((error) => hrToast.error(error.message))} className="flex h-12 items-center gap-2 rounded-3xl bg-[#171714] px-5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45">
                <Download className="h-4 w-4" /> Download latest salary slip
              </button>
            )}
            {section === "leave" && (
              <button type="button" onClick={() => setLeaveDrawerOpen(true)} className="flex h-12 items-center gap-2 rounded-3xl bg-[#171714] px-5 text-sm font-bold text-white shadow-sm">
                <Plus className="h-4 w-4" /> Apply for Leave
              </button>
            )}
          </div>
        </div>
      </section>}

      {section === "dashboard" && (
        <section className={`w-full overflow-hidden rounded-[28px]  ${panel}`}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">HR request records</h2>
              <p className={`mt-1 text-sm ${muted}`}>Leave, salary slip, and HR document requests in one full-width table.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button onClick={loadHr} disabled={loading} className={`flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:border-white/20 hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{dashboardRequests.length} request{dashboardRequests.length === 1 ? "" : "s"}</span>
            </div>
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
            <div className="p-4"><EmptyState darkMode={darkMode} icon={MessageSquare} title={loading ? "Loading HR requests" : "No HR requests yet"} text="Leave, salary slip, and HR document requests will appear here in one table." /></div>
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
                    {["Employee", "Designation", "Department", "Role", "Contact", "Status", "Actions"].map((heading) => (
                      <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                      <td className="rounded-l-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#10a66b] text-sm font-black text-white">{initials(employee.displayName || employee.username)}</span>
                          <div>
                            <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{employee.displayName || employee.username}</p>
                            <p className={`mt-0.5 text-xs ${muted}`}>{employee.username || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{employee.designation || "Not set"}</td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{employee.department || "Not set"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-black/[0.05] text-black/65"}`}>{employee.roleName || "No role"}</span></td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{employee.phone || employee.whatsappPhone || employee.email || "-"}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">Active</span></td>
                      <td className="rounded-r-xl px-4 py-3">
                        <button onClick={() => setSelectedEmployee(employee)} className={`flex h-9 items-center gap-2 rounded-lg border px-4 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/5 text-white/75" : "border-slate-200 bg-white text-slate-700"}`}>
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

      {(section === "documents" || section === "salary") && (
        <section className={`overflow-hidden rounded-[28px]  ${section === "salary" ? salaryPanel : panel}`}>
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <h2 className="text-2xl small text-black dark:text-white font-black">{section === "salary" ? "Salary Slips" : "HR Documents"}</h2>
              <p className={`mt-1 text-sm ${muted}`}>Only real uploaded/generated PDFs are shown here.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {section === "documents" && (
                <button onClick={loadHr} disabled={loading} className={`flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:border-white/20 hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
              )}
              {section === "salary" && (
                <>
                  <div className="relative">
                    <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                    <input value={salaryQuery} onChange={(event) => setSalaryQuery(event.target.value)} placeholder="Search salary slips..." className={`h-10 w-64 rounded-full border pl-11 pr-4 text-sm outline-none ${darkMode ? "border-white/12 bg-[#171b22] text-white placeholder:text-white/42 focus:border-emerald-300/45" : "border-black/10 bg-white"}`} />
                  </div>
                  <button type="button" onClick={openSalaryDrawer} className="flex h-10 items-center gap-2 rounded-full bg-[#6ee72f] px-4 text-sm font-bold text-[#10210c] ">
                    <Plus className="h-4 w-4" /> Generate salary slip
                  </button>
                </>
              )}
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{section === "salary" ? filteredSalarySlips.length : selectedDocs.length} PDF{(section === "salary" ? filteredSalarySlips.length : selectedDocs.length) === 1 ? "" : "s"}</span>
            </div>
          </div>
          {section === "salary" && filteredSalarySlips.length ? (
            <div className="overflow-x-auto px-5 pb-5">
              <table className={`w-full min-w-[860px] table-fixed border-collapse text-left text-sm ${salaryTableSurface}`}>
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead className={muted}>
                  <tr className={`border-b ${darkMode ? "border-white/[0.08] bg-[#151922] text-white/62" : "border-black/5"}`}>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Employee</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Salary month</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Pay date</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Net pay</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalarySlips.map((doc) => (
                    <tr key={doc.id || doc.title || doc.name} className={`h-[90px] border-b last:border-b-0 ${salaryRowBorder}`}>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${darkMode ? "bg-emerald-400/15 text-emerald-100" : "bg-emerald-50 text-emerald-700"}`}>{initials(doc.employeeName || currentName)}</span>
                          <div className="min-w-0">
                            <p className="truncate text-md newq ">{doc.employeeName || currentName}</p>
                            <p className={`truncate text-xs ${muted}`}>{doc.designation || doc.employeeCode || "Employee"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap">{doc.month ? monthLabelFromInput(doc.month) : doc.title?.replace("Salary Slip - ", "") || "-"}</td>
                      <td className={`px-4 py-4 align-middle whitespace-nowrap ${muted}`}>{doc.date || "-"}</td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap font-black">₹{moneyValue(doc.netPay).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-4 align-middle"><span className={`inline-flex h-8 items-center rounded-full px-3 text-xs ${salaryBadge}`}>Generated</span></td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex h-10 items-center justify-start gap-2 whitespace-nowrap">
                          <button type="button" onClick={() => downloadSalarySlip(doc).catch((error) => hrToast.error(error.message))} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:border-white/20 hover:bg-[#1d232d]" : "border-black/10 bg-white text-[#171714] hover:bg-[#f8faf8]"}`}>
                            <Download className="h-4 w-4" /> Download
                          </button>
                          {data?.canManageHr && (
                            <>
                              <button type="button" onClick={() => editSalarySlip(doc)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${darkMode ? "border-white/12 bg-[#171b22] text-white/80 hover:border-white/20 hover:bg-[#1d232d]" : "border-black/10 bg-white text-[#171714] hover:bg-[#f8faf8]"}`} title="Edit salary slip">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => setSalaryDeleteTarget(doc)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${darkMode ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-red-200 bg-red-50 text-red-600"}`} title="Delete salary slip">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedDocs.length ? (
            <div className="space-y-3 px-4 pb-5">
              {selectedDocs.map((doc) => (
                <div key={doc.id || doc.title || doc.name} className={`flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-4 ${softPanel}`}>
                  <div>
                    <h3 className="font-black">{doc.title || doc.name}</h3>
                    <p className={`text-sm ${muted}`}>{doc.type || "PDF"} · {doc.date || doc.createdAt || "-"}</p>
                  </div>
                  <button type="button" onClick={() => section === "salary" ? downloadSalarySlip(doc).catch((error) => hrToast.error(error.message)) : downloadPdf(doc, currentName, darkMode)} className="flex h-10 items-center gap-2 rounded-full bg-[#171714] px-4 text-sm font-bold text-white">
                    <Download className="h-4 w-4" /> Download PDF
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState darkMode={darkMode} icon={section === "salary" ? WalletCards : FileText} title={section === "salary" ? "No salary slips generated yet" : "No HR documents uploaded yet"} text={section === "salary" ? "Generate your salary slip for an eligible month. Saved salary details will prefill next time." : "Offer letters, appointment letters, experience letters, and other employee PDFs will appear here after real records are connected."} />
            </div>
          )}
        </section>
      )}

      {section === "leave" && (
        <>
          <section className={`overflow-hidden rounded-[28px] border ${panel}`}>
            <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">{data?.canManageHr ? "Leave Requests" : "My Leave Applications"}</h2>
                <p className={`mt-1 text-sm ${muted}`}>{data?.canManageHr ? "Approve or decline with a comment. The applicant gets notified." : "Track your submitted applications and admin response."}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button onClick={loadHr} disabled={loading} className={`flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${darkMode ? "border-white/12 bg-[#171b22] text-white hover:border-white/20 hover:bg-[#1d232d]" : "border-black/10 bg-white text-slate-700 hover:bg-[#f1f7f4]"}`}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button type="button" onClick={() => setLeaveDrawerOpen(true)} className="flex h-10 items-center gap-2 rounded-full bg-[#6ee72f] px-4 text-sm font-bold text-[#10210c]">
                  <Plus className="h-4 w-4" /> Apply for Leave
                </button>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{myLeaveRequests.length} request{myLeaveRequests.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            {myLeaveRequests.length ? (
              <div className="overflow-x-auto px-5 pb-5">
                <table className={`w-full min-w-[900px] border-collapse text-left text-sm ${darkMode ? "bg-white/[0.025]" : "bg-white"}`}>
                  <thead className={muted}>
                    <tr className={`border-b ${darkMode ? "border-white/10" : "border-black/5"}`}>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Leave type</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Period</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Breakdown</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Approval progress</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaveRequests.map((request) => (
                      <tr key={request.id} className={`border-b last:border-b-0 ${darkMode ? "border-white/10 hover:bg-white/[0.04]" : "border-black/5 hover:bg-[#f8faf8]"}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${darkMode ? "bg-emerald-400/15 text-emerald-100" : "bg-emerald-50 text-emerald-700"}`}>{initials(data?.canManageHr ? request.employeeName : request.leaveType)}</span>
                            <div>
                              <p className="font-black">{request.leaveType}</p>
                              {data?.canManageHr && <p className={`text-xs ${muted}`}>{request.employeeName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold">{request.startDate}</p>
                          <p className={`text-xs ${muted}`}>to {request.endDate}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold">Total: {request.days} day{request.days === 1 ? "" : "s"}</p>
                          <p className={`mt-1 line-clamp-1 text-xs ${muted}`}>{request.reason}</p>
                        </td>
                        <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span></td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium">{request.status === "pending" ? "Waiting for approval" : `${request.status} by ${request.reviewedBy?.name || "Admin"}`}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setSelectedLeave(request); setReviewComment(request.adminComment || ""); }} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${darkMode ? "border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]" : "border-black/10 bg-white text-[#171714] hover:bg-[#f8faf8]"}`}>
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState darkMode={darkMode} icon={CalendarDays} title="No leave applications yet" text={data?.canManageHr ? "When employees apply for leave, approval requests will appear here." : "Click Apply for Leave to submit your first leave request."} />
              </div>
            )}
          </section>
        </>
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
                      ["Paid Days", "paidDays", "number"],
                      ["LOP Days", "lopDays", "number"],
                      ["Basic Salary", "basic", "number"],
                    ].map(([label, key, type]) => (
                      <label key={key} className="text-xs font-medium">{label}{["employeeName", "joiningDate", "basic"].includes(key) ? " *" : ""}
                        <input required={["employeeName", "joiningDate", "basic"].includes(key)} type={type} value={salaryForm[key]} onChange={(event) => setSalaryForm((current) => ({ ...current, [key]: event.target.value }))} className={`mt-2 h-10 w-full rounded-2xl border px-3 text-sm font-bold outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
                      </label>
                    ))}
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
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#10a66b] text-sm font-black text-white">{initials(selectedLeave.employeeName)}</span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black">{selectedLeave.employeeName}</h2>
                  <p className={`mt-1 truncate text-sm ${muted}`}>{selectedLeave.department || "No department"}</p>
                </div>
              </div>

              <div className={`grid grid-cols-3 border-y py-3 ${darkMode ? "border-white/10" : "border-black/10"}`}>
                {[["Type", selectedLeave.leaveType], ["Days", selectedLeave.days], ["Status", selectedLeave.status]].map(([label, value]) => (
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
        </div>
      )}

      {selectedEmployee && (
        <div onMouseDown={() => setSelectedEmployee(null)} className="fixed inset-0 z-[90] flex justify-end bg-[#10231c]/55 backdrop-blur-sm">
          <section onMouseDown={(event) => event.stopPropagation()} className={`employee-report-drawer employee-report-shell hr-employee-drawer relative flex h-full w-full flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-center justify-between border-b p-6 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-black">Employee details</h2>
                <p className={`mt-1 truncate text-sm ${muted}`}>Profile, access, contact, and HR request history.</p>
              </div>
              <button type="button" onClick={() => setSelectedEmployee(null)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-5 w-5" /></button>
            </div>
            <div className={`min-h-0 flex-1 overflow-hidden ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
              <div className="grid h-full min-h-0 gap-5 p-5 lg:grid-cols-[230px_minmax(0,1fr)]">
                <aside className={`h-fit space-y-4 self-start rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-emerald-100 bg-[#f6fbf7]"}`}>
                  <span className={`inline-flex rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-wide ${darkMode ? "bg-lime-300/15 text-lime-200" : "bg-[#dcfacb] text-[#4b9b16]"}`}>Employee</span>
                  <div className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-emerald-100 bg-white"}`}>
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#10a66b] text-base font-black text-white">{initials(selectedEmployee.displayName || selectedEmployee.username)}</span>
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
                <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
                  <section className={`rounded-[22px] p-5 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                    <p className={`mb-4 text-[11px] font-bold uppercase tracking-wide ${muted}`}>Profile information</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "Name", value: selectedEmployee.displayName || selectedEmployee.username || "-", icon: UserRound, tone: darkMode ? "bg-sky-300/14 text-sky-200" : "bg-sky-100 text-sky-700" },
                        { label: "Role", value: selectedEmployee.roleName || "No role", icon: ShieldCheck, tone: darkMode ? "bg-violet-300/14 text-violet-200" : "bg-violet-100 text-violet-700" },
                        { label: "Status", value: selectedEmployee.blacklisted ? "Blacklisted" : "Active", icon: CheckCircle2, tone: selectedEmployee.blacklisted ? (darkMode ? "bg-red-400/14 text-red-200" : "bg-red-100 text-red-700") : (darkMode ? "bg-emerald-300/14 text-emerald-200" : "bg-emerald-100 text-emerald-700") },
                        { label: "Email", value: selectedEmployee.email || "Not set", icon: Mail, tone: darkMode ? "bg-amber-300/14 text-amber-200" : "bg-amber-100 text-amber-700" },
                        { label: "Phone", value: selectedEmployee.phone || "Not set", icon: Phone, tone: darkMode ? "bg-blue-300/14 text-blue-200" : "bg-blue-100 text-blue-700" },
                        { label: "WhatsApp", value: selectedEmployee.whatsappPhone || "Not set", icon: MessageCircle, tone: darkMode ? "bg-green-300/14 text-green-200" : "bg-green-100 text-green-700" },
                      ].map(({ label, value, icon: Icon, tone }) => (
                        <div key={label} className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-emerald-100 bg-white"}`}>
                          <div className="flex items-center gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>{label}</p>
                              <p className="mt-1 truncate text-sm font-black">{value}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className={`rounded-[22px] p-5 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
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

