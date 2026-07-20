"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FileText, MessageSquare, Plus, RefreshCw, Search, Trash2, Users, WalletCards, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";

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

function downloadPdf(doc, employeeName) {
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
  toast.success("PDF downloaded");
}

function EmptyState({ darkMode, icon: Icon, title, text }) {
  return (
    <div className={`grid min-h-[260px] place-items-center rounded-[24px] border p-6 text-center ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-[#f8f7f3]"}`}>
      <div>
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${darkMode ? "bg-white/10 text-white/70" : "bg-[#eafbdc] text-[#17643f]"}`}>
          <Icon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-black">{title}</h2>
        <p className={`mt-2 max-w-md text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/55"}`}>{text}</p>
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

function todayInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DrawerSelect({ darkMode, label, value, placeholder, options, onChange, required }) {
  const [open, setOpen] = useState(false);
  const muted = darkMode ? "text-white/45" : "text-black/45";
  return (
    <label className="relative block text-xs font-semibold text-black/65 dark:text-white/60">
      {label}{required ? " *" : ""}
      <button type="button" onClick={() => setOpen((current) => !current)} className={`mt-2 flex h-10 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-bold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"}`}>
        <span className={value ? "" : muted}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""} ${muted}`} />
      </button>
      {open && (
        <div className={`absolute left-0 top-[calc(100%+8px)] z-[110] w-full rounded-2xl border p-1.5 shadow-2xl ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          {options.map((option) => (
            <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition ${value === option ? "bg-[#171714] text-white" : darkMode ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/[0.04]"}`}>
              {option}
            </button>
          ))}
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
        <p className="mb-2 text-xs font-black">{title}</p>
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
                className={`grid h-8 place-items-center text-xs font-bold transition ${
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
      <p className="text-xs font-semibold text-black/65 dark:text-white/60">{label} *</p>
      <button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)} className={`mt-2 flex h-10 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm font-bold outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.07]" : "border-black/10 bg-white text-[#171714] hover:bg-[#fafbf8]"}`}>
        <span className={value ? "" : muted}>{displayValue}</span>
        <CalendarDays className={`h-4 w-4 ${muted}`} />
      </button>
      {open && (
        <div style={panelStyle} className={`z-[110] overflow-hidden rounded-[20px] border shadow-2xl ${darkMode ? "border-white/10 bg-[#171a20]" : "border-black/10 bg-white"}`}>
          <div className="p-4 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setMonthDate(new Date(year, month - 1, 1))} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}><ChevronLeft className="h-4 w-4" /></button>
            <p className="text-xs font-bold text-blue-600">Choose {label.toLowerCase()}</p>
            <button type="button" onClick={() => setMonthDate(new Date(year, month + 1, 1))} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/[0.04]"}`}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className={`mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase ${muted}`}>
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
  const [leaveDrawerOpen, setLeaveDrawerOpen] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveReviewSaving, setLeaveReviewSaving] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [leaveForm, setLeaveForm] = useState({ leaveType: "", startDate: "", endDate: "", reason: "" });

  async function loadHr() {
    try {
      setLoading(true);
      setData(await api("/hr/overview"));
    } catch (error) {
      toast.error(error.message || "Could not load HR");
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

  const employees = data?.employees || [];
  const documents = data?.documents || [];
  const salarySlips = data?.salarySlips || [];
  const leaveRequests = data?.leaveRequests || [];
  const currentName = user?.displayName || user?.username || "Employee";
  const muted = darkMode ? "text-white/58" : "text-black/58";
  const panel = darkMode ? "border-white/10 bg-[#171a20]" : "border-[#dfe7e4] bg-white";
  const softPanel = darkMode ? "bg-white/[0.055]" : "bg-[#f7f5ef]";
  const activeEmployees = employees.filter((employee) => !employee.blacklisted);
  const selectedDocs = section === "salary" ? salarySlips : documents;
  const myLeaveRequests = leaveRequests.filter((request) => data?.canManageHr || request.userId === user?.id);
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
      toast.success("Leave request sent for approval");
    } catch (error) {
      toast.error(error.message || "Could not submit leave request");
    } finally {
      setLeaveSaving(false);
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
      toast.success(status === "approved" ? "Leave approved" : "Leave declined");
    } catch (error) {
      toast.error(error.message || "Could not review leave request");
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
      toast.success("Leave request deleted");
    } catch (error) {
      toast.error(error.message || "Could not delete leave request");
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
  const showHero = section !== "employees";

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
              <button type="button" disabled={!salarySlips[0]} onClick={() => downloadPdf(salarySlips[0], currentName)} className="flex h-12 items-center gap-2 rounded-3xl bg-[#171714] px-5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45">
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
        <section className={`w-full overflow-hidden rounded-[28px] border ${panel}`}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">HR request records</h2>
              <p className={`mt-1 text-sm ${muted}`}>Leave, salary slip, and HR document requests in one full-width table.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{dashboardRequests.length} request{dashboardRequests.length === 1 ? "" : "s"}</span>
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
        <section className={`overflow-hidden rounded-[28px] border ${panel}`}>
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
        <section className={`overflow-hidden rounded-[28px] border ${panel}`}>
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <h2 className="text-2xl font-black">{section === "salary" ? "Salary Slips" : "HR Documents"}</h2>
              <p className={`mt-1 text-sm ${muted}`}>Only real uploaded/generated PDFs are shown here.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{selectedDocs.length} PDF{selectedDocs.length === 1 ? "" : "s"}</span>
          </div>
          {selectedDocs.length ? (
            <div className="space-y-3 px-4 pb-5">
              {selectedDocs.map((doc) => (
                <div key={doc.id || doc.title || doc.name} className={`flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-4 ${softPanel}`}>
                  <div>
                    <h3 className="font-black">{doc.title || doc.name}</h3>
                    <p className={`text-sm ${muted}`}>{doc.type || "PDF"} · {doc.date || doc.createdAt || "-"}</p>
                  </div>
                  <button type="button" onClick={() => downloadPdf(doc, currentName)} className="flex h-10 items-center gap-2 rounded-full bg-[#171714] px-4 text-sm font-bold text-white">
                    <Download className="h-4 w-4" /> Download PDF
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState darkMode={darkMode} icon={section === "salary" ? WalletCards : FileText} title={section === "salary" ? "No salary slips uploaded yet" : "No HR documents uploaded yet"} text={section === "salary" ? "Once salary slips are generated or uploaded for employees, they will appear here for PDF download." : "Offer letters, appointment letters, experience letters, and other employee PDFs will appear here after real records are connected."} />
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
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-white/10 text-white/65" : "bg-black/[0.05] text-black/55"}`}>{myLeaveRequests.length} request{myLeaveRequests.length === 1 ? "" : "s"}</span>
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

      {leaveDrawerOpen && (
        <div onMouseDown={() => setLeaveDrawerOpen(false)} className="fixed inset-0 z-[90] flex justify-end bg-[#10231c]/55 backdrop-blur-sm">
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={submitLeave} className={`employee-report-drawer employee-report-shell hr-leave-drawer relative flex h-full w-full flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-start justify-between border-b p-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div><h2 className="text-xl font-black">Apply for Leave</h2><p className={`mt-1 text-xs ${muted}`}>Sent to HR/admin for approval.</p></div>
              </div>
              <button type="button" onClick={() => setLeaveDrawerOpen(false)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-5 w-5" /></button>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
              <section className={`rounded-[22px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                <p className={`mb-3 text-[11px] font-bold uppercase tracking-wide ${muted}`}>Leave details</p>
                <DrawerSelect darkMode={darkMode} label="Leave Type" required value={leaveForm.leaveType} placeholder="Select leave type..." options={["Casual Leave", "Sick Leave", "Paid Leave", "Advance Leave"]} onChange={(leaveType) => setLeaveForm((current) => ({ ...current, leaveType }))} />
                <p className={`mt-3 text-xs leading-5 ${muted}`}>Leave type is for reference. If policy balance is exceeded later, extra days can be marked as advance leave.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DrawerDatePicker darkMode={darkMode} label="Start Date" value={leaveForm.startDate} placeholder="Select start date" minDate={todayInput()} onChange={(startDate) => setLeaveForm((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? startDate : current.endDate }))} />
                  <DrawerDatePicker darkMode={darkMode} label="End Date" value={leaveForm.endDate} placeholder="Select end date" minDate={leaveForm.startDate || todayInput()} onChange={(endDate) => setLeaveForm((current) => ({ ...current, endDate }))} />
                </div>
              </section>
              <div className={`mt-4 rounded-[22px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                <label className="block text-xs font-semibold text-black/65 dark:text-white/60">Reason *</label>
                <textarea required minLength={10} value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Please provide a detailed reason..." className={`mt-2 min-h-32 w-full rounded-2xl border px-3 py-3 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.04] placeholder:text-white/35" : "border-black/10 bg-white placeholder:text-black/35"}`} />
                <p className={`mt-2 text-xs ${muted}`}>Minimum 10 characters required</p>
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-6 border-t px-6 py-5 ${darkMode ? "border-white/10 bg-[#111216]" : "border-black/10 bg-white"}`}>
              <button type="button" onClick={() => setLeaveDrawerOpen(false)} className={`h-11 min-w-[108px] rounded-full border px-6 text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}>Cancel</button>
              <button disabled={leaveSaving} className="h-11 min-w-[190px] rounded-full bg-[#10a66b] px-7 text-sm font-bold text-white disabled:opacity-60">{leaveSaving ? "Sending..." : "Send for approval"}</button>
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
        <div className="fixed inset-0 z-[90] flex justify-end bg-[#10231c]/55 backdrop-blur-sm">
          <section className={`employee-report-drawer employee-report-shell relative flex h-full w-full max-w-3xl flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`flex items-center justify-between border-b p-6 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#10a66b] text-base font-black text-white">{initials(selectedEmployee.displayName || selectedEmployee.username)}</span>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-black">{selectedEmployee.displayName || selectedEmployee.username}</h2>
                  <p className={`mt-1 truncate text-sm ${muted}`}>{selectedEmployee.designation || "Designation not set"} · {selectedEmployee.department || "Department not set"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedEmployee(null)} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-5 w-5" /></button>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}>
              <div className={`rounded-[28px] border p-5 ${panel}`}>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Username", selectedEmployee.username || "-"],
                    ["Role", selectedEmployee.roleName || "No role"],
                    ["Status", selectedEmployee.blacklisted ? "Blacklisted" : "Active"],
                    ["Department", selectedEmployee.department || "Not set"],
                    ["Designation", selectedEmployee.designation || "Not set"],
                    ["Email", selectedEmployee.email || "Not set"],
                    ["Phone", selectedEmployee.phone || "Not set"],
                    ["WhatsApp", selectedEmployee.whatsappPhone || "Not set"],
                    ["Modules", `${selectedEmployee.menus?.length || 0}`],
                    ["Permissions", `${selectedEmployee.privileges?.length || 0}`],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-2xl p-4 ${softPanel}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>{label}</p>
                      <p className="mt-1 truncate text-sm font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`mt-5 rounded-[28px] border p-5 ${panel}`}>
                <h3 className="text-xl font-black">HR request history</h3>
                {leaveRequests.filter((request) => request.userId === selectedEmployee.id).length ? (
                  <div className="mt-4 space-y-3">
                    {leaveRequests.filter((request) => request.userId === selectedEmployee.id).slice(0, 5).map((request) => (
                      <button key={request.id} onClick={() => { setSelectedLeave(request); setReviewComment(request.adminComment || ""); }} className={`flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left ${softPanel}`}>
                        <span><span className="block font-bold">{request.leaveType}</span><span className={`text-sm ${muted}`}>{request.startDate} to {request.endDate}</span></span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-3 text-sm ${muted}`}>No leave applications from this employee yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
