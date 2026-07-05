"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  FileSpreadsheet,
  History,
  IndianRupee,
  Loader2,
  Maximize2,
  Minimize2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tag,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { DatePicker } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers || {}
        : { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function localDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function emptyForm() {
  return {
    projectSite: "",
    materialRequestDate: localDateKey(),
    requiredDate: localDateKey(),
    materialRequirement: "",
    issuedBy: "",
    leadTime: "",
    quotationAmount: "",
    emailAddress: "",
    assignTo: "",
    status: "",
    krishnaPrnStatusUpdated: "",
    vendorName: "",
    invoiceDate: "",
    remark: "",
    mrnPhoto: null,
    quotationPhoto: null,
  };
}

function money(value) {
  const amount = Number(value) || 0;
  return amount ? `₹${amount.toLocaleString("en-IN")}` : "₹0";
}

function parseMrnDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const [datePart, timePart = ""] = text.split(/\s+/);
  let day;
  let month;
  let year;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    [year, month, day] = datePart.split("-").map(Number);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
    [day, month, year] = datePart.split("/").map(Number);
  } else {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

function formatMrnDateTime(value) {
  const date = parseMrnDate(value);
  if (!date) return { date: value || "-", day: "", time: "" };
  return {
    date: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    day: date.toLocaleDateString("en-IN", { weekday: "long" }),
    time:
      date.getHours() || date.getMinutes()
        ? date.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
  };
}

function materialItems(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .replace(/\r/g, "\n")
    .split(/\n+|(?=\s*\*)/)
    .map((item) => item.replace(/^\s*\*\s*/, "").trim())
    .filter(Boolean);
}

function normalizedMrnNumber(value) {
  const match = String(value || "")
    .trim()
    .match(/^mrn\s*0*(\d+)$/i);
  return match ? `mrn${Number(match[1])}` : "";
}

function dateProgressPercent(startValue, endValue, nowMs) {
  const start = parseMrnDate(startValue);
  const end = parseMrnDate(endValue);
  if (!start || !end) return 0;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 100;
  const elapsed = nowMs - start.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function endOfDate(date) {
  if (!date) return null;
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function deliveredStatus(status) {
  return /delivered|closed|complete/i.test(String(status || ""));
}

function daysBetweenDates(from, to) {
  const start = parseMrnDate(from);
  const end = parseMrnDate(to);
  if (!start || !end) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function escapePrintText(value) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printMrnDetail(row) {
  const printWindow = window.open("", "_blank", "width=960,height=760");
  if (!printWindow) {
    toast.error("Allow pop-ups to print this MRN");
    return;
  }
  const requested = formatMrnDateTime(row.materialRequestDate || row.date || row.timestamp);
  const required = formatMrnDateTime(row.requiredDate);
  const items = materialItems(row.materialRequirement);
  const safe = escapePrintText;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join("");
  const detail = (label, value) => `<div class="detail"><span>${safe(label)}</span><strong>${safe(value || "Not added")}</strong></div>`;
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(row.mrnNo || "MRN")} · Material Request</title>${styles}<style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#171714;font-family:Geist,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{max-width:794px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #171714;padding-bottom:18px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.16em;color:#4b9b16;text-transform:uppercase}.title{font-size:29px;line-height:1.1;margin:7px 0 5px;font-weight:800}.muted{color:#777;font-size:11px;line-height:1.5}.mrn{background:#eafbdc;color:#3f7d16;padding:9px 12px;border-radius:8px;font-size:12px;font-weight:800}.statusbar{margin:18px 0;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border-radius:20px;background:#f0f1ed}.statusbar span{padding:8px;text-align:center;font-size:9px;font-weight:800}.statusbar .done{background:#8de1dc}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #dedfd9;border-radius:13px;padding:16px;break-inside:avoid}.card h2{font-size:14px;margin:0 0 12px}.detail{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #ecece8;font-size:10px}.detail:last-child{border:0}.detail span{color:#777}.detail strong{text-align:right;font-size:11px}.materials{grid-column:1/-1}.item{display:flex;gap:9px;padding:8px 10px;margin-top:6px;background:#f7f8f4;border-radius:8px;font-size:11px}.dot{width:6px;height:6px;margin-top:4px;border-radius:50%;background:#69c832;flex:none}.amount{font-size:25px;font-weight:800;margin-top:4px}.note{grid-column:1/-1;background:#f7f8f4}.footer{display:flex;justify-content:space-between;margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#888}@media print{.page{max-width:none}}
  </style></head><body class="newq"><main class="page"><header class="top"><div><div class="eyebrow">Material request note</div><h1 class="title">${safe(row.project || "Project / site not added")}</h1><p class="muted">Issued by ${safe(row.issuedBy || "Not added")} · Required ${safe(required.date)}</p></div><div class="mrn">${safe(row.mrnNo || "MRN")}</div></header><div class="statusbar"><span class="done">Requested</span><span class="done">Assigned</span><span class="done">Quoted</span><span>${safe(row.status || "Open")}</span></div><section class="grid"><article class="card"><h2>Request schedule</h2>${detail("Requested", requested.date)}${detail("Required by", required.date)}${detail("Lead time", row.leadTime)}${detail("Status", row.status || "Open")}</article><article class="card"><h2>Ownership & contact</h2>${detail("Issued by", row.issuedBy)}${detail("Assigned to", row.assignTo)}${detail("Email", row.emailAddress)}${detail("Vendor", row.vendorName)}</article><article class="card materials"><h2>Material requirement · ${items.length} item${items.length === 1 ? "" : "s"}</h2>${items.length ? items.map((item) => `<div class="item"><i class="dot"></i><span>${safe(item)}</span></div>`).join("") : '<p class="muted">No material items added.</p>'}</article><article class="card"><h2>Quotation</h2><p class="muted">Quotation amount</p><div class="amount">${safe(money(row.quotationAmount))}</div>${detail("Invoice date", row.invoiceDate)}${detail("PRN status", row.krishnaPrnStatusUpdated)}</article><article class="card"><h2>Documents</h2>${detail("MRN file", row.mrnPhoto ? "Available" : "Not added")}${detail("Quotation file", row.quotationPhoto ? "Available" : "Not added")}</article>${row.remark ? `<article class="card note"><h2>Remarks</h2><p class="muted">${safe(row.remark)}</p></article>` : ""}</section><footer class="footer"><span>Generated from MRN Workspace</span><span>${safe(new Date().toLocaleString("en-IN"))}</span></footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`);
  printWindow.document.close();
}

function Metric({
  darkMode,
  icon: Icon,
  label,
  value,
  note,
  tone = "",
  accent = "bg-[#171714]",
}) {
  return (
    <section
      className={`rounded-3xl  p-5 transition duration-300 hover:-translate-y-0.5 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/[0.08] bg-white text-[#171714] -[0_8px_30px_rgba(28,40,20,0.04)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-11 w-11 place-items-center rounded-full ${tone || `${accent} text-white`}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "bg-white/[0.08] text-white/60" : "bg-[#f3f5ef] text-black/50"}`}
        >
          {note}
        </span>
      </div>
      <div className="mt-5">
        <p
          className={`text-xs ${darkMode ? "text-white/55" : "text-black/50"}`}
        >
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold leading-none tracking-tight">
          {value}
        </p>
      </div>
    </section>
  );
}

function FileButton({ darkMode, href, label }) {
  const validHref = /^https?:\/\//i.test(String(href || "").trim())
    ? String(href).trim()
    : "";
  if (!validHref) {
    return (
      <span
        className={`flex h-12 items-center justify-center rounded-2xl text-sm ${darkMode ? "bg-white/[0.035] text-white/35" : "bg-white text-black/35"}`}
      >
        {label} not added
      </span>
    );
  }
  return (
    <a
      href={validHref}
      target="_blank"
      rel="noreferrer"
      className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#cdea5e]" : "bg-[#171714] text-white hover:bg-black/80"}`}
    >
      {label}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

export default function MrnDashboard({ darkMode }) {
  const [startDate, setStartDate] = useState(() => localDateKey(-6));
  const [endDate, setEndDate] = useState(() => localDateKey());
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [allLoading, setAllLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetLink, setSheetLink] = useState("");
  const [folderLink, setFolderLink] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm());
  const [editingMrn, setEditingMrn] = useState(null);
  const [materialDraft, setMaterialDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedMrn, setSelectedMrn] = useState(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [mrnDrawerExpanded, setMrnDrawerExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mrnHistory, setMrnHistory] = useState([]);
  const [nowMs] = useState(() => Date.now());

  const muted = darkMode ? "text-white/45" : "text-black/48";

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        const result = await api(
          `/mrn-dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        );
        setData(result);
      } catch (error) {
        toast.error(error.message || "Could not load MRN");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endDate, startDate],
  );

  const loadAllForSearch = useCallback(async () => {
    try {
      setAllLoading(true);
      const result = await api(
        `/mrn-dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&all=true`,
      );
      setAllData(result);
    } catch (error) {
      toast.error(error.message || "Could not search all MRNs");
    } finally {
      setAllLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!query.trim() || allData || allLoading) return;
    const id = window.setTimeout(() => {
      void loadAllForSearch();
    }, 250);
    return () => window.clearTimeout(id);
  }, [allData, allLoading, loadAllForSearch, query]);

  const closeMrnDrawer = useCallback(() => {
    setDrawerClosing(true);
    window.setTimeout(() => {
      setSelectedMrn(null);
      setDrawerClosing(false);
      setMrnDrawerExpanded(false);
      setHistoryOpen(false);
      setMrnHistory([]);
    }, 280);
  }, []);

  const openMrnHistory = useCallback(async (row) => {
    if (!row?.mrnNo) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await api(`/mrn-dashboard/${encodeURIComponent(row.mrnNo)}/history`);
      setMrnHistory(result.history || []);
    } catch (error) {
      toast.error(error.message || "Could not load MRN history");
      setMrnHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedMrn) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMrnDrawer();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMrnDrawer, selectedMrn]);

  const records = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = term
      ? allData?.records || data?.records || []
      : data?.records || [];
    if (!term) return rows;
    const exactMrn = normalizedMrnNumber(term);
    if (exactMrn) {
      return rows.filter((row) => normalizedMrnNumber(row.mrnNo) === exactMrn);
    }
    return rows.filter((row) =>
      [
        row.mrnNo,
        row.project,
        row.materialRequirement,
        row.issuedBy,
        row.status,
        row.assignTo,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [allData?.records, data?.records, query]);

  async function saveSettings() {
    try {
      setSavingSettings(true);
      const result = await api("/mrn-dashboard/settings", {
        method: "PUT",
        body: JSON.stringify({
          spreadsheetId: sheetLink.trim(),
          driveFolderId: folderLink.trim(),
        }),
      });
      setData((current) =>
        current ? { ...current, mrnSettings: result.settings } : current,
      );
      setAllData(null);
      setSheetLink("");
      setFolderLink("");
      setSettingsOpen(false);
      toast.success("MRN links saved");
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not save MRN links");
    } finally {
      setSavingSettings(false);
    }
  }

  function openAddMrn() {
    setEditingMrn(null);
    setForm(emptyForm());
    setMaterialDraft("");
    setAddOpen(true);
  }

  function openEditMrn(row) {
    setEditingMrn(row);
    setForm({
      projectSite: row.project || "",
      materialRequestDate:
        row.materialRequestDate || row.date || localDateKey(),
      requiredDate: row.requiredDate || localDateKey(),
      materialRequirement: row.materialRequirement || "",
      issuedBy: row.issuedBy || "",
      leadTime: row.leadTime || "",
      quotationAmount: row.quotationAmount || "",
      emailAddress: row.emailAddress || "",
      assignTo: row.assignTo || "",
      status: row.status || "",
      krishnaPrnStatusUpdated: row.krishnaPrnStatusUpdated || "",
      vendorName: row.vendorName || "",
      invoiceDate: row.invoiceDate || "",
      remark: row.remark || "",
      mrnPhoto: null,
      quotationPhoto: null,
    });
    setMaterialDraft("");
    setAddOpen(true);
  }

  function addMaterialLine() {
    const value = materialDraft.trim();
    if (!value) return;
    const current = materialItems(form.materialRequirement);
    setForm({
      ...form,
      materialRequirement: [...current, value]
        .map((item) => `* ${item}`)
        .join("\n"),
    });
    setMaterialDraft("");
  }

  function removeMaterialLine(indexToRemove) {
    const next = materialItems(form.materialRequirement).filter(
      (_, index) => index !== indexToRemove,
    );
    setForm({
      ...form,
      materialRequirement: next.map((item) => `* ${item}`).join("\n"),
    });
  }

  async function saveMrn() {
    try {
      setSaving(true);
      const body = new FormData();
      const materialList = materialDraft.trim()
        ? [...materialItems(form.materialRequirement), materialDraft.trim()]
        : materialItems(form.materialRequirement);
      const normalizedForm = {
        ...form,
        materialRequirement: materialList.map((item) => `* ${item}`).join("\n"),
      };
      for (const [key, value] of Object.entries(normalizedForm)) {
        if (value instanceof File) body.append(key, value);
        else if (value !== null && value !== undefined) body.append(key, value);
      }
      const path = editingMrn?.rowNumber
        ? `/mrn-dashboard/${editingMrn.rowNumber}`
        : "/mrn-dashboard";
      const result = await api(path, {
        method: editingMrn ? "PUT" : "POST",
        body,
      });
      toast.success(`${result.mrnNo} ${editingMrn ? "updated" : "added"}`);
      const savedRequestDate =
        normalizedForm.materialRequestDate || localDateKey();
      setForm(emptyForm());
      setMaterialDraft("");
      setEditingMrn(null);
      setAddOpen(false);
      setAllData(null);
      setQuery("");
      if (
        savedRequestDate &&
        (savedRequestDate < startDate || savedRequestDate > endDate)
      ) {
        setStartDate(
          savedRequestDate < startDate ? savedRequestDate : startDate,
        );
        setEndDate(savedRequestDate > endDate ? savedRequestDate : endDate);
      } else {
        await load(true);
      }
    } catch (error) {
      toast.error(error.message || "Could not add MRN");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}
      >
        <div
          className={`w-full max-w-2xl rounded-[30px] p-7 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}
        >
          <div className="flex items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span
                className={`absolute inset-0 animate-ping rounded-full opacity-20 ${darkMode ? "bg-[#d8f36a]" : "bg-black"}`}
              />
              <span
                className={`absolute inset-1 animate-pulse rounded-full ${darkMode ? "bg-[#d8f36a]/15" : "bg-black/[0.06]"}`}
              />
              <span
                className={`relative flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}
              >
                <FileSpreadsheet className="h-5 w-5" />
              </span>
            </span>
            <div>
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}
              >
                MRN workspace
              </p>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
                Opening live material request sheet
                <span
                  className="inline-flex items-center gap-1 pt-1"
                  aria-hidden="true"
                >
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
                  />
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:120ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
                  />
                  <span
                    className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:240ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
                  />
                </span>
              </h2>
              <p className={`mt-2 text-sm ${muted}`}>
                Loading linked MRNs, quotations, and uploaded files from the
                latest sheet data.
              </p>
            </div>
          </div>
          <div
            className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}
          >
            <div
              className={`h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`}
            />
          </div>
        </div>
      </main>
    );
  }

  const settings = data?.mrnSettings || {};
  const canManage = Boolean(data?.canManageMrnSettings);
  const canViewMrnHistory = Boolean(data?.canViewMrnHistory);
  const canEdit = Boolean(data?.canEdit);
  const summary = data?.allSummary || data?.summary || {};
  const totalMrns = summary.total || 0;

  return (
    <main
      className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-7 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f7f2] text-[#171714]"}`}
    >
      <div
        className={`mb-5 rounded-3xl  p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.08] bg-white -[0_8px_30px_rgba(28,40,20,0.04)]"}`}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4b9b16]">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Projects · MRN
            </span>
            <h1 className="mt-2 text-3xl font-bold small tracking-tight">
              Material Request Dashboard
            </h1>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>
              Track requests, quotations, owners and delivery progress from one
              workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!canEdit || !settings.linked}
              onClick={openAddMrn}
              className="flex h-11 items-center gap-2 rounded-full bg-[#89ed3f] px-5 text-sm font-bold text-black hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add MRN
            </button>
            {canManage && (
              <button
                onClick={() => setSettingsOpen(true)}
                className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${darkMode ? "border-white/15 hover:bg-white/5" : "border-black/15 bg-white hover:bg-[#f5f7f2]"}`}
              >
                <Settings className="h-4 w-4" /> Links
              </button>
            )}
            <button
              onClick={() => {
                setAllData(null);
                void load(true);
              }}
              className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${darkMode ? "border-white/15 hover:bg-white/5" : "border-black/15 bg-white hover:bg-[#f5f7f2]"}`}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </button>
            
          </div>
        </div>
      </div>

      {!settings.linked && (
        <div
          className={`mb-5 rounded-[28px] p-5 ${darkMode ? "bg-amber-400/5 text-amber-100" : "bg-amber-50 text-amber-800"}`}
        >
          Link the MRN Google Sheet before viewing or adding MRNs.
        </div>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <Metric
          darkMode={darkMode}
          icon={FileSpreadsheet}
          label="All MRNs"
          value={totalMrns}
          note="Full sheet"
          accent="bg-[#171714]"
        />
        <Metric
          darkMode={darkMode}
          icon={CalendarDays}
          label="Open / active"
          value={summary.open || 0}
          note="Needs action"
          tone={
            darkMode
              ? "bg-[#89ed3f]/15 text-[#89ed3f]"
              : "bg-[#eafbdc] text-[#4b9b16]"
          }
        />
        <Metric
          darkMode={darkMode}
          icon={Save}
          label="Delivered / closed"
          value={summary.delivered || 0}
          note="Completed"
          tone={
            darkMode
              ? "bg-emerald-400/10 text-emerald-200"
              : "bg-[#dff7f1] text-[#16836b]"
          }
        />
        <Metric
          darkMode={darkMode}
          icon={IndianRupee}
          label="Quotation amount"
          value={money(summary.quotationAmount)}
          note="All records"
          tone={
            darkMode
              ? "bg-amber-400/10 text-amber-200"
              : "bg-amber-50 text-amber-700"
          }
        />
      </div>

      <section
        className={`rounded-3xl  p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white -[0_8px_30px_rgba(28,40,20,0.04)]"}`}
      >
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b9b16]">
              Requests
            </p>
            <h2 className="mt-1 text-xl small dark:text-white text-black font-bold">
              MRN records
            </h2>
            <p className={`mt-1 text-sm ${muted}`}>
              {records.length} visible requests
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DatePicker
              darkMode={darkMode}
              value={startDate}
              onChange={setStartDate}
              placeholder="From date"
            />
            <DatePicker
              darkMode={darkMode}
              value={endDate}
              onChange={setEndDate}
              placeholder="To date"
            />
            <label
              className={`flex h-12 min-w-64 items-center gap-2 rounded-xl border px-4 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-[#fafbf8] text-black focus-within:border-[#69c832]"}`}
            >
              <Search className="h-4 w-4 text-[#4b9b16]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search MRN, project, issued by"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
        </div>

        <div
          className={`overflow-x-auto rounded-xl border ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}
        >
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
            <thead
              className={
                darkMode
                  ? "bg-white/[0.035] text-white/50"
                  : "bg-[#f4f6f1] text-black/50"
              }
            >
              <tr>
                {[
                  "MRN",
                  "Request date",
                  "Project / Site",
                  "Required by",
                  "Issued by",
                  "Status",
                  "Action",
                ].map((header) => (
                  <th
                    key={header}
                    className="border-b border-black/[0.06] px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row, index) => (
                <tr
                  key={row.id}
                  className={`group align-middle transition ${darkMode ? "hover:bg-white/[0.04]" : "hover:bg-[#f8fbf5]"} ${index % 2 === 0 ? (darkMode ? "bg-white/[0.015]" : "bg-white") : darkMode ? "bg-white/[0.03]" : "bg-[#fcfcfa]"}`}
                >
                  <td
                    className={`border-t px-5 py-4 font-bold text-[#000000] dark:text-white ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                  >
                    {row.mrnNo || "-"}
                  </td>
                  <td
                    className={`border-t px-5 py-4 ${darkMode ? "border-white/10 text-white/70" : "border-black/[0.06] text-black/70"}`}
                  >
                    {row.materialRequestDate || row.date || "-"}
                  </td>
                  <td
                    className={`max-w-[240px] border-t px-5 py-4 font-semibold ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                  >
                    {row.project || "-"}
                  </td>
                  <td
                    className={`border-t px-5 py-4 ${darkMode ? "border-white/10 text-white/70" : "border-black/[0.06] text-black/70"}`}
                  >
                    {row.requiredDate || "-"}
                  </td>
                  <td
                    className={`border-t px-5 py-4 ${darkMode ? "border-white/10 text-white/70" : "border-black/[0.06] text-black/70"}`}
                  >
                    {row.issuedBy || "-"}
                  </td>
                  <td
                    className={`border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-[11px] font-bold ${/delivered|closed|complete/i.test(row.status) ? "bg-[#dff7f1] text-[#16836b]" : "bg-[#eafbdc] text-[#4b9b16]"}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {row.status || "Open"}
                    </span>
                  </td>
                  <td
                    className={`border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}
                  >
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setDrawerClosing(false);
                          setSelectedMrn(row);
                        }}
                        className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs  transition ${darkMode ? "border-white/15 bg-white/5 text-white hover:bg-white/10" : "border-black/12 bg-white text-black hover:border-[#69c832] hover:text-[#4b9b16]"}`}
                      >
                        <Eye className="h-4 w-4" />
                        View detail
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEditMrn(row)}
                          className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-xs  transition ${darkMode ? "bg-[#89ed3f] text-black hover:bg-[#7dde35]" : "bg-[#89ed3f] text-black hover:bg-[#7dde35]"}`}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={7} className={`px-4 py-10 text-center ${muted}`}>
                    No MRNs found for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedMrn &&
        (() => {
          const requestedAt = formatMrnDateTime(
            selectedMrn.materialRequestDate ||
              selectedMrn.date ||
              selectedMrn.timestamp,
          );
          const requiredAt = formatMrnDateTime(selectedMrn.requiredDate);
          const editedAt = formatMrnDateTime(
            selectedMrn.lastEdited || selectedMrn.timestamp,
          );
          const rawProgress = dateProgressPercent(
            selectedMrn.materialRequestDate || selectedMrn.date,
            selectedMrn.requiredDate,
            nowMs,
          );
          const isDelivered = deliveredStatus(selectedMrn.status);
          const isOverdue =
            !isDelivered &&
            endOfDate(parseMrnDate(selectedMrn.requiredDate))?.getTime() <
              nowMs;
          const progress = isDelivered
            ? 100
            : isOverdue
              ? Math.min(94, Math.max(78, rawProgress || 92))
              : rawProgress;
          const progressTone = isDelivered
            ? {
                bar: "bg-emerald-500",
                text: "text-emerald-600",
                soft: darkMode
                  ? "bg-emerald-400/10 text-emerald-200"
                  : "bg-emerald-50 text-emerald-700",
                label: "Delivered in time",
                icon: CheckCircle2,
              }
            : isOverdue
              ? {
                  bar: "bg-red-500",
                  text: "text-red-600",
                  soft: darkMode
                    ? "bg-red-400/10 text-red-200"
                    : "bg-red-50 text-red-700",
                  label: "Delayed",
                  icon: AlertTriangle,
                }
              : {
                  bar: "bg-[#27a8f2]",
                  text: "text-[#168bd0]",
                  soft: darkMode
                    ? "bg-blue-400/10 text-blue-200"
                    : "bg-blue-50 text-blue-700",
                  label: "On track",
                  icon: Clock3,
                };
          const ProgressIcon = progressTone.icon;
          const items = materialItems(selectedMrn.materialRequirement);
          return (
            <div
              className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] ${drawerClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeMrnDrawer();
              }}
              role="presentation"
            >
              <aside
                className={`mrn-detail-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${mrnDrawerExpanded ? "mrn-detail-shell-expanded" : ""} ${drawerClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}
                role="dialog"
                aria-modal="true"
                aria-label={`${selectedMrn.mrnNo || "MRN"} details`}
              >
                <header
                  className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}
                >
                  <span>
                    <b>{selectedMrn.mrnNo || "MRN"}</b> · Material request
                    details
                  </span>
                  <div className="flex items-center gap-2">
                    {canViewMrnHistory && (
                      <button
                        onClick={() => openMrnHistory(selectedMrn)}
                        className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f7ef] text-[#3f7d16] hover:bg-[#eafbdc]"}`}
                      >
                        <History className="h-3.5 w-3.5" />
                        Version History
                      </button>
                    )}
                    <button
                      onClick={() => printMrnDetail(selectedMrn)}
                      className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 font-semibold text-white shadow-[0_10px_24px_rgba(239,68,68,0.22)] transition hover:bg-red-600"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Print PDF
                    </button>
                    <button
                      onClick={() => setMrnDrawerExpanded((current) => !current)}
                      className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#eafbdc] text-[#3f7d16] hover:bg-[#ddf8c9]"}`}
                    >
                      {mrnDrawerExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      {mrnDrawerExpanded ? "Restore" : "Expand"}
                    </button>
                    <button
                      onClick={closeMrnDrawer}
                      className="px-1 font-semibold text-[#3f7d16]"
                    >
                      Close
                    </button>
                  </div>
                </header>

                <div className="grid min-h-0 flex-1 md:grid-cols-[270px_minmax(0,1fr)]">
                  <aside
                    className={`min-h-0 overflow-y-auto border-b p-5 md:border-b-0 md:border-r ${darkMode ? "border-white/10" : "border-black/10"}`}
                  >
                    <div className="flex gap-2">
                      <span className="rounded bg-pink-100 px-2 py-1 text-[10px] font-bold text-pink-800">
                        MATERIAL
                      </span>
                      <span className="rounded bg-black/5 px-2 py-1 text-[10px] font-bold">
                        REQUEST
                      </span>
                    </div>
                    <p className={`mt-4 text-xs ${muted}`}>
                      Request #{selectedMrn.mrnNo || "-"}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold small dark:text-white text-black">
                      {selectedMrn.project || "Project / site not added"}
                    </h2>
                    <p className={`mt-2 text-xs leading-5 ${muted}`}>
                      {selectedMrn.remark ||
                        "Material requirement and purchase tracking"}
                    </p>

                    <div className="mt-5 flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => {
                            closeMrnDrawer();
                            window.setTimeout(
                              () => openEditMrn(selectedMrn),
                              290,
                            );
                          }}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#89ed3f] text-sm font-semibold text-black"
                        >
                          <Pencil className="h-4 w-4" /> Edit MRN
                        </button>
                      )}
                      {/* <button
                        onClick={closeMrnDrawer}
                        className={`grid h-11 w-11 place-items-center rounded-full border ${darkMode ? "border-white/15" : "border-black/15"}`}
                      >
                        <X className="h-4 w-4" />
                      </button> */}
                    </div>

                    <div
                      className={`mt-5 rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f5f1]"}`}
                    >
                      <p className={`text-xs ${muted}`}>Quotation amount</p>
                      <div className="mt-1 flex items-end justify-between">
                        <strong className="text-2xl">
                          {money(selectedMrn.quotationAmount)}
                        </strong>
                        <span
                          className={`text-xs font-semibold ${progressTone.text}`}
                        >
                          {selectedMrn.status || "Open"}
                        </span>
                      </div>
                    </div>

                    <h3
                      className={`mt-6 border-b pb-3 text-sm font-bold ${darkMode ? "border-white/10" : "border-black/10"}`}
                    >
                      Contact Details
                    </h3>
                    <div className="mt-4 space-y-4 text-sm">
                      <div className="flex gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-pink-100 text-xs font-bold text-pink-800">
                          {(selectedMrn.issuedBy || "MR")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div>
                          <p className={`text-[11px] ${muted}`}>Issued by</p>
                          <p className="font-semibold">
                            {selectedMrn.issuedBy || "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/5" : "bg-[#f4f4ef]"}`}
                        >
                          @
                        </span>
                        <div className="min-w-0">
                          <p className={`text-[11px] ${muted}`}>
                            Email Address
                          </p>
                          <p className="break-all text-xs font-semibold">
                            {selectedMrn.emailAddress || "Not added"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/5" : "bg-[#f4f4ef]"}`}
                        >
                          <UserRound className="h-4 w-4" />
                        </span>
                        <div>
                          <p className={`text-[11px] ${muted}`}>Assigned to</p>
                          <p className="font-semibold">
                            {selectedMrn.assignTo || "Not assigned"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <h3
                      className={`mt-6 border-b pb-3 text-sm font-bold ${darkMode ? "border-white/10" : "border-black/10"}`}
                    >
                      Vendor
                    </h3>
                    <p className="mt-4 text-sm font-semibold">
                      {selectedMrn.vendorName || "Not added"}
                    </p>
                    <p className={`mt-8 text-[11px] ${muted}`}>
                      Last edited {editedAt.date}
                      {editedAt.time ? ` at ${editedAt.time}` : ""}
                    </p>
                  </aside>

                  <section className="min-h-0 overflow-y-auto">
                    <div
                      className={`border-b px-5 py-5 ${darkMode ? "border-white/10" : "border-black/10"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p>
                          Pipeline: <b>Material Request</b>{" "}
                          <span className={muted}> | </span> Stage:{" "}
                          <b>{selectedMrn.status || "Open"}</b>
                        </p>
                        <span className={`text-xs ${muted}`}>
                          {progress}% complete
                        </span>
                      </div>
                      <div
                        className={`mt-4 flex h-8 overflow-hidden rounded-full text-[10px] font-semibold ${darkMode ? "bg-white/10" : "bg-[#ecece7]"}`}
                      >
                        <span className="grid flex-1 place-items-center bg-[#8fe3df] text-black">
                          Requested
                        </span>
                        <span className="grid flex-1 place-items-center bg-[#9ce8e4] text-black">
                          Assigned
                        </span>
                        <span className="grid flex-1 place-items-center bg-[#a7ebe7] text-black">
                          Quoted
                        </span>
                        <span
                          className={`grid flex-1 place-items-center ${isDelivered ? "bg-[#80dbd6] text-black" : ""}`}
                        >
                          Delivered
                        </span>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-9 w-9 place-items-center rounded-full ${progressTone.soft}`}
                          >
                            <ProgressIcon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className={`text-xs ${muted}`}>Current status</p>
                            <p className="text-sm font-semibold">
                              {progressTone.label}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/5" : "bg-[#f5f5f1]"}`}
                          >
                            <Clock3 className="h-4 w-4" />
                          </span>
                          <div>
                            <p className={`text-xs ${muted}`}>Lead time</p>
                            <p className="text-sm font-semibold">
                              {selectedMrn.leadTime || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <nav
                      className={`flex gap-6 overflow-x-auto border-b px-5 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}
                    >
                      <span className="border-b-2 border-[#4b9b16] py-4 font-bold text-[#4b9b16]">
                        Activity
                      </span>
                      <span className="py-4">
                        Materials{" "}
                        <b className="ml-1 rounded-full bg-black/5 px-1.5">
                          {items.length}
                        </b>
                      </span>
                      <span className="py-4">Files</span>
                      <span className="py-4">Notes</span>
                    </nav>

                    <div className="space-y-8 p-5">
                      <section>
                        <h3 className="text-lg font-bold">Latest Activity</h3>
                        <div className="mt-4 space-y-4 text-sm">
                          <div className="flex gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#89ed3f]">
                              <CheckCircle2 className="h-4 w-4 text-black" />
                            </span>
                            <div className="flex min-w-0 flex-1 justify-between gap-4">
                              <div>
                                <p className="font-semibold">
                                  Material request created
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  Request was submitted by{" "}
                                  {selectedMrn.issuedBy || "the project team"}.
                                </p>
                              </div>
                              <span className={`shrink-0 text-xs ${muted}`}>
                                {requestedAt.date}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#8fe3df]">
                              <Clock3 className="h-4 w-4 text-black" />
                            </span>
                            <div className="flex min-w-0 flex-1 justify-between gap-4">
                              <div>
                                <p className="font-semibold">
                                  Status: {selectedMrn.status || "Open"}
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                  {isOverdue
                                    ? "Required date has passed and this request needs attention."
                                    : "The request is progressing within its timeline."}
                                </p>
                              </div>
                              <span className={`shrink-0 text-xs ${muted}`}>
                                {requiredAt.date}
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="text-lg font-bold">Request schedule</h3>
                        <div
                          className={`mt-4 grid overflow-hidden rounded-xl border sm:grid-cols-[180px_1fr] ${darkMode ? "border-white/10" : "border-black/10"}`}
                        >
                          <div
                            className={`p-4 ${darkMode ? "bg-white/[0.03]" : "bg-[#fafaf7]"}`}
                          >
                            <p className="text-xs font-semibold text-[#4b9b16]">
                              {requestedAt.day || "Requested"}
                            </p>
                            <p className="mt-1 text-lg font-bold">
                              {requestedAt.date}
                            </p>
                            <p className={`mt-3 text-xs ${muted}`}>
                              Required by
                              <br />
                              <b>{requiredAt.date}</b>
                            </p>
                          </div>
                          <div className="p-4">
                            <p className="font-semibold">
                              Material required for{" "}
                              {selectedMrn.project || "project"}
                            </p>
                            <div className="mt-3 space-y-2">
                              {items.length ? (
                                items.map((item, index) => (
                                  <div
                                    key={`${item}-${index}`}
                                    className="flex gap-2 text-sm"
                                  >
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#69c832]" />
                                    {item}
                                  </div>
                                ))
                              ) : (
                                <p className={`text-sm ${muted}`}>
                                  No material items added.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">Quotation</h3>
                          <span className="text-xs font-semibold text-[#4b9b16]">
                            {selectedMrn.quotationPhoto
                              ? "File available"
                              : "No file"}
                          </span>
                        </div>
                        <div
                          className={`mt-4 grid gap-4 rounded-xl border p-4 sm:grid-cols-[1fr_auto] ${darkMode ? "border-white/10" : "border-black/10"}`}
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              #{selectedMrn.mrnNo || "MRN"} ·{" "}
                              {selectedMrn.project || "Material request"}
                            </p>
                            <p className={`mt-3 text-xs ${muted}`}>Vendor</p>
                            <p className="text-sm font-semibold">
                              {selectedMrn.vendorName || "Not added"}
                            </p>
                          </div>
                          <div className="min-w-[150px] sm:border-l sm:pl-5">
                            <p className={`text-xs ${muted}`}>Amount</p>
                            <p className="text-xl font-bold">
                              {money(selectedMrn.quotationAmount)}
                            </p>
                            <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                              {selectedMrn.status || "PENDING"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <FileButton
                            darkMode={darkMode}
                            href={selectedMrn.mrnPhoto}
                            label="Open MRN file"
                          />
                          <FileButton
                            darkMode={darkMode}
                            href={selectedMrn.quotationPhoto}
                            label="Open quotation file"
                          />
                        </div>
                      </section>
                    </div>
                  </section>
                </div>

                {historyOpen && (
                  <div
                    className="absolute inset-0 z-20 flex justify-end bg-black/25 backdrop-blur-[1px]"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) setHistoryOpen(false);
                    }}
                  >
                    <section
                      className={`h-full w-full max-w-[520px] overflow-y-auto border-l p-5 shadow-[-18px_0_60px_rgba(0,0,0,0.18)] animate-[mrn-drawer-in_320ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-[#fbfcf8] text-[#171714]"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${muted}`}>
                            Super Admin
                          </p>
                          <h3 className="mt-2 text-2xl font-bold small">
                            Version history
                          </h3>
                          <p className={`mt-1 text-sm ${muted}`}>
                            {selectedMrn.mrnNo || "MRN"} · tracked changes from now onward.
                          </p>
                        </div>
                        <button
                          onClick={() => setHistoryOpen(false)}
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-white text-black/55 hover:bg-black/[0.04]"}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-5">
                        {historyLoading ? (
                          <div className={`rounded-3xl  p-8 text-center ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                            <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#4b9b16]" />
                            <p className={`mt-3 text-sm ${muted}`}>Loading versions…</p>
                          </div>
                        ) : mrnHistory.length ? (
                          <div className="space-y-3">
                            {mrnHistory.map((entry) => (
                              <article
                                key={entry.id}
                                className={`rounded-3xl  p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <span className="inline-flex rounded-full bg-[#eafbdc] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3f7d16]">
                                      Version {entry.version || "-"}
                                    </span>
                                    <h4 className="mt-2 text-sm font-bold">
                                      {entry.action === "added" ? "MRN created" : "MRN updated"}
                                    </h4>
                                    <p className={`mt-1 text-xs ${muted}`}>
                                      By {entry.actor || "System"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-IN") : "-"}
                                    </p>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.action === "added" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                    {entry.action || "changed"}
                                  </span>
                                </div>

                                {entry.changes?.length ? (
                                  <div className="mt-4 space-y-2">
                                    {entry.changes.map((change) => (
                                      <div
                                        key={`${entry.id}-${change.key}`}
                                        className={`rounded-2xl p-3 text-xs ${darkMode ? "bg-black/20" : "bg-[#f5f7f2]"}`}
                                      >
                                        <p className="">{change.label}</p>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                          <div>
                                            <span className={muted}>Before</span>
                                            <p className="mt-1 text-sm break-words">{change.before || "Blank"}</p>
                                          </div>
                                          <div>
                                            <span className={muted}>After</span>
                                            <p className="mt-1 text-sm break-words text-green-400">{change.after || "Blank"}</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className={`mt-4 rounded-2xl p-3 text-xs ${darkMode ? "bg-black/20 text-white/55" : "bg-[#f5f7f2] text-black/55"}`}>
                                    Initial saved version. Future edits will show field-by-field changes here.
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className={`rounded-3xl  p-6 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                            <p className="text-sm font-semibold">No stored versions yet.</p>
                            <p className={`mt-2 text-sm leading-6 ${muted}`}>
                              History tracking is active now. The next MRN add/edit will create a version entry with changed fields.
                            </p>
                            <div className={`mt-4 rounded-2xl p-4 text-xs ${darkMode ? "bg-black/20" : "bg-[#f5f7f2]"}`}>
                              <p className="">Current snapshot</p>
                              <p className={`mt-1 ${muted}`}>
                                {selectedMrn.project || "Project not added"} · {selectedMrn.status || "Open"} · {items.length} material item{items.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}
              </aside>
            </div>
          );
        })()}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <div
            className={`max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-[22px] border p-3 shadow-[0_26px_90px_rgba(0,0,0,0.24)] ${darkMode ? "border-white/10 bg-[#101116] text-white" : "border-black/[0.08] bg-[#f5f7f2] text-[#171714]"}`}
          >
            <div
              className={`rounded-2xl  p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/[0.07] bg-white"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`flex items-center gap-2 text-xs font-semibold ${muted}`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Projects / MRN Links
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSettingsOpen(false)}
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/65 hover:bg-white/10" : "bg-[#f4f6f1] text-black/55 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <p
                  className={`mb-3 flex items-center gap-2 text-sm font-semibold ${muted}`}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eafbdc] text-[#4b9b16]">
                    <Tag className="h-3.5 w-3.5" />
                  </span>
                  MRN Setup
                </p>
                <h3 className="text-2xl font-bold small tracking-tight sm:text-3xl">
                  Link workspace sources
                </h3>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-3">
                  <span
                    className={`flex items-center gap-3 text-sm font-medium ${muted}`}
                  >
                    <Image
                      src="/gsheet.svg"
                      alt="Google Sheets"
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px]"
                    />
                    Google Sheet
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-bold ${sheetLink.trim() || settings.spreadsheetId ? "bg-[#eafbdc] text-[#4b9b16]" : darkMode ? "bg-white/[0.06] text-white/55" : "bg-black/[0.04] text-black/55"}`}
                    >
                      {sheetLink.trim() || settings.spreadsheetId
                        ? "Connected"
                        : "Required"}
                    </span>
                  </span>
                  <input
                    value={sheetLink}
                    onChange={(event) => setSheetLink(event.target.value)}
                    placeholder={
                      settings.spreadsheetId ||
                      "Paste MRN Google Sheet link or ID"
                    }
                    className={`h-12 w-full rounded-xl border px-4 text-sm outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white placeholder:text-white/30 focus:border-[#89ed3f]/60" : "border-black/10 bg-[#fafbf8] text-black placeholder:text-black/35 focus:border-[#69c832] focus:ring-3 focus:ring-[#89ed3f]/10"}`}
                  />
                </label>

                <label className="grid gap-3">
                  <span
                    className={`flex items-center gap-3 text-sm font-medium ${muted}`}
                  >
                    <Image
                      src="/drive.svg"
                      alt="Google Drive"
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px]"
                    />
                    Drive folder
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-bold ${folderLink.trim() || settings.driveFolderId ? "bg-[#eafbdc] text-[#4b9b16]" : darkMode ? "bg-white/[0.06] text-white/55" : "bg-black/[0.04] text-black/55"}`}
                    >
                      {folderLink.trim() || settings.driveFolderId
                        ? "Connected"
                        : "Shared Drive required"}
                    </span>
                  </span>
                  <input
                    value={folderLink}
                    onChange={(event) => setFolderLink(event.target.value)}
                    placeholder={
                      settings.driveFolderId ||
                      "Paste Shared Drive folder link or ID"
                    }
                    className={`h-12 w-full rounded-xl border px-4 text-sm outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white placeholder:text-white/30 focus:border-[#89ed3f]/60" : "border-black/10 bg-[#fafbf8] text-black placeholder:text-black/35 focus:border-[#69c832] focus:ring-3 focus:ring-[#89ed3f]/10"}`}
                  />
                  <span className={`text-xs ${muted}`}>
                    Uploads require a folder inside a Google Shared Drive shared
                    with the service account.
                  </span>
                </label>
              </div>

              <div
                className={`mt-6 border-t pt-4 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-[#89ed3f]/12 text-[#89ed3f]" : "bg-[#eafbdc] text-[#4b9b16]"}`}
                  >
                    <UserRound className="h-4 w-4" />
                  </span>
                  
                </div>
              </div>

              <div className={`mt-5 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/[0.06] bg-[#fafbf8]"}`}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${sheetLink.trim() || settings.spreadsheetId ? "text-[#4b9b16]" : muted}`} />
                  <div>
                    <p className="text-sm font-bold">Ready to save</p>
                    <p className={`mt-0.5 text-xs ${muted}`}>Existing MRNs will stay untouched.</p>
                  </div>
                </div>
                <button
                  disabled={savingSettings || (!sheetLink.trim() && !folderLink.trim())}
                  onClick={saveSettings}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black transition hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35 dark:disabled:bg-white/10 dark:disabled:text-white/30"
                >
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save links
                </button>
              </div>
            </div>

            <div className="hidden">
              <div
                className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/[0.07] bg-white"}`}
              >
                <p className={`text-sm ${muted}`}>MRN</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <h4 className="text-xl font-bold tracking-tight">
                    Link Sources
                  </h4>
                  <span className="flex -space-x-2">
                    <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#eaf8e6]">
                      <Image
                        src="/gsheet.svg"
                        alt="Google Sheets"
                        width={21}
                        height={21}
                      />
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#eef4ff]">
                      <Image
                        src="/drive.svg"
                        alt="Google Drive"
                        width={21}
                        height={21}
                      />
                    </span>
                  </span>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/[0.07] bg-white"}`}
              >
                <p className={`mb-4 text-sm font-semibold ${muted}`}>
                  Integrations
                </p>
                <div
                  className={`flex items-center gap-3 rounded-xl border p-3 ${darkMode ? "border-white/5 bg-white/[0.045]" : "border-black/[0.05] bg-[#fafbf8]"}`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white">
                    <Image
                      src="/gsheet.svg"
                      alt="Google Sheets"
                      width={25}
                      height={25}
                    />
                  </span>
                  <div>
                    <p className="font-semibold">Google Sheets</p>
                    <p className={`text-xs ${muted}`}>Live MRN table</p>
                  </div>
                </div>
                <div
                  className={`mt-2 flex items-center gap-3 rounded-xl border p-3 ${darkMode ? "border-white/5 bg-white/[0.045]" : "border-black/[0.05] bg-[#fafbf8]"}`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white">
                    <Image
                      src="/drive.svg"
                      alt="Google Drive"
                      width={25}
                      height={25}
                    />
                  </span>
                  <div>
                    <p className="font-semibold">Google Drive</p>
                    <p className={`text-xs ${muted}`}>MRN file uploads</p>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-[#181a20]" : "border-black/[0.07] bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm ${muted}`}>Status</p>
                    <h4 className="mt-1 text-xl font-semibold">
                      Ready to save
                    </h4>
                  </div>
                  <CheckCircle2
                    className={`h-6 w-6 ${sheetLink.trim() || settings.spreadsheetId ? "text-[#4b9b16]" : muted}`}
                  />
                </div>
                <p className={`mt-4 text-sm leading-6 ${muted}`}>
                  Paste or replace links, then save once. Existing MRNs stay
                  untouched.
                </p>
                <button
                  disabled={
                    savingSettings || (!sheetLink.trim() && !folderLink.trim())
                  }
                  onClick={saveSettings}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#89ed3f] text-sm font-bold text-black transition hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35 dark:disabled:bg-white/10 dark:disabled:text-white/30"
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}{" "}
                  Save links
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAddOpen(false);
              setEditingMrn(null);
            }
          }}
        >
          <div
            className={`mrn-form-drawer absolute inset-y-0 right-0 flex h-full w-full max-w-[940px] flex-col overflow-hidden border-l shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] sm:inset-y-3 sm:right-3 sm:h-[calc(100%-1.5rem)] sm:w-[min(88vw,940px)] sm:rounded-[28px] sm:border ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/[0.08] bg-white text-[#171714]"}`}
          >
            <div
              className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-[#89ed3f]/15 text-[#89ed3f]" : "bg-[#eafbdc] text-[#4b9b16]"}`}
                >
                  <PackageCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#4b9b16]">
                    Material request
                  </p>
                  <h3 className="text-lg small text-black dark:text-white font-bold">
                    {editingMrn ? `Edit ${editingMrn.mrnNo}` : "Create new MRN"}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setAddOpen(false);
                  setEditingMrn(null);
                }}
                className="text-sm font-bold text-[#4b9b16]"
              >
                Close
              </button>
            </div>
            <div
              className={`min-h-0 overflow-y-auto p-5 sm:p-6 ${darkMode ? "bg-[#101116]" : "bg-[#f5f7f2]"}`}
            >
              <div
                className={`mb-5 rounded-3xl  p-5 ${darkMode ? "border-white/10 bg-white/[0.05]" : "border-black/[0.08] bg-white"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4b9b16]">
                      Request overview
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {form.projectSite || "New material request"}
                    </p>
                    <p className={`mt-1 text-xs ${muted}`}>
                      {editingMrn
                        ? "Update the linked MRN sheet record."
                        : "Complete the details below to submit a new request."}
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${daysBetweenDates(form.materialRequestDate, form.requiredDate) < 0 ? "bg-red-500 text-white" : darkMode ? "bg-[#89ed3f]/15 text-[#89ed3f]" : "bg-[#eafbdc] text-[#4b9b16]"}`}
                  >
                    {daysBetweenDates(
                      form.materialRequestDate,
                      form.requiredDate,
                    ) === null
                      ? "Select dates"
                      : `${daysBetweenDates(form.materialRequestDate, form.requiredDate)} day${Math.abs(daysBetweenDates(form.materialRequestDate, form.requiredDate)) === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
              <div
                className={`grid gap-4 rounded-3xl  p-5 md:grid-cols-2 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white"}`}
              >
                <label className="block text-sm font-medium md:col-span-2">
                  Name of Project & Site Address *
                  <input
                    value={form.projectSite}
                    onChange={(e) =>
                      setForm({ ...form, projectSite: e.target.value })
                    }
                    placeholder="Example: Kalhaar bungalow, Royal Orchid..."
                    className={`mt-2 h-14 w-full rounded-3xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Material Request Date *
                  <span className="mt-2 block">
                    <DatePicker
                      darkMode={darkMode}
                      value={form.materialRequestDate}
                      onChange={(value) =>
                        setForm({ ...form, materialRequestDate: value })
                      }
                      placeholder="Request date"
                    />
                  </span>
                </label>
                <label className="block text-sm font-medium">
                  By when Material is Required *
                  <span className="mt-2 block">
                    <DatePicker
                      darkMode={darkMode}
                      value={form.requiredDate}
                      onChange={(value) =>
                        setForm({ ...form, requiredDate: value })
                      }
                      placeholder="Required date"
                    />
                  </span>
                </label>
                <div
                  className={`md:col-span-2 rounded-xl border p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/[0.08] bg-[#fafbf8]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Material Requirement *
                      </p>
                      <p className={`mt-1 text-xs ${muted}`}>
                        Add one material item at a time.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/[0.08] text-white/60" : "bg-[#f1eee8] text-black/45"}`}
                    >
                      {materialItems(form.materialRequirement).length} items
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={materialDraft}
                      onChange={(event) => setMaterialDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addMaterialLine();
                        }
                      }}
                      placeholder="Example: Bricks - 1 cart"
                      className={`h-14 min-w-0 flex-1 rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-[#f7f5ef] text-black placeholder:text-black/35"}`}
                    />
                    <button
                      type="button"
                      onClick={addMaterialLine}
                      className="h-14 rounded-xl bg-[#89ed3f] px-5 text-sm font-bold text-black hover:bg-[#7dde35]"
                    >
                      Add item
                    </button>
                  </div>
                  {materialItems(form.materialRequirement).length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {materialItems(form.materialRequirement).map(
                        (item, index) => (
                          <div
                            key={`${item}-${index}`}
                            className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${darkMode ? "bg-black/15 text-white/80" : "bg-[#f7f5ef] text-black/75"}`}
                          >
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() => removeMaterialLine(index)}
                              className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] text-white/60" : "bg-white text-black/45"}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <label className="block text-sm font-medium">
                  Issued by
                  <input
                    value={form.issuedBy}
                    onChange={(e) =>
                      setForm({ ...form, issuedBy: e.target.value })
                    }
                    placeholder="Example: Atul Mevada"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Lead Time
                  <input
                    value={form.leadTime}
                    onChange={(e) =>
                      setForm({ ...form, leadTime: e.target.value })
                    }
                    placeholder="Example: 1 day"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Quotation Amount
                  <input
                    type="number"
                    value={form.quotationAmount}
                    onChange={(e) =>
                      setForm({ ...form, quotationAmount: e.target.value })
                    }
                    placeholder="Example: 25000"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Email address
                  <input
                    type="email"
                    value={form.emailAddress}
                    onChange={(e) =>
                      setForm({ ...form, emailAddress: e.target.value })
                    }
                    placeholder="name@example.com"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Assign To
                  <input
                    value={form.assignTo}
                    onChange={(e) =>
                      setForm({ ...form, assignTo: e.target.value })
                    }
                    placeholder="Example: Vivek"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Status
                  <input
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    placeholder="Example: Open / Delivered"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Krishna PRN Status Updated
                  <input
                    value={form.krishnaPrnStatusUpdated}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        krishnaPrnStatusUpdated: e.target.value,
                      })
                    }
                    placeholder="Example: Updated / Pending"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Vendor Name
                  <input
                    value={form.vendorName}
                    onChange={(e) =>
                      setForm({ ...form, vendorName: e.target.value })
                    }
                    placeholder="Example: ABC Traders"
                    className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Invoice Date
                  <span className="mt-2 block">
                    <DatePicker
                      darkMode={darkMode}
                      value={form.invoiceDate}
                      onChange={(value) =>
                        setForm({ ...form, invoiceDate: value })
                      }
                      placeholder="Invoice date"
                    />
                  </span>
                </label>
                <label className="block text-sm font-medium md:col-span-2">
                  Remark
                  <textarea
                    value={form.remark}
                    onChange={(e) =>
                      setForm({ ...form, remark: e.target.value })
                    }
                    placeholder="Add any purchase, delivery, or vendor note..."
                    rows={3}
                    className={`mt-2 w-full rounded-2xl px-4 py-3 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`}
                  />
                </label>
                <label
                  className={`block cursor-pointer rounded-2xl border border-dashed p-5 text-sm font-semibold transition ${darkMode ? "border-white/15 bg-white/[0.03]" : "border-[#9abb85] bg-[#f8fcf5] hover:bg-[#f0fae9]"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eafbdc] text-[#4b9b16]">
                      <Upload className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block">Upload MRN file</span>
                      <span className={`text-xs font-normal ${muted}`}>
                        {form.mrnPhoto?.name ||
                          (editingMrn?.mrnPhoto
                            ? "Existing file will be kept"
                            : "Choose file")}
                      </span>
                    </span>
                  </span>
                  <input
                    type="file"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mrnPhoto: e.target.files?.[0] || null,
                      })
                    }
                    className="hidden"
                  />
                </label>
                <label
                  className={`block cursor-pointer rounded-2xl border border-dashed p-5 text-sm font-semibold transition ${darkMode ? "border-white/15 bg-white/[0.03]" : "border-[#9abb85] bg-[#f8fcf5] hover:bg-[#f0fae9]"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eafbdc] text-[#4b9b16]">
                      <FileSpreadsheet className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block">Upload quotation</span>
                      <span className={`text-xs font-normal ${muted}`}>
                        {form.quotationPhoto?.name ||
                          (editingMrn?.quotationPhoto
                            ? "Existing file will be kept"
                            : "Choose file")}
                      </span>
                    </span>
                  </span>
                  <input
                    type="file"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quotationPhoto: e.target.files?.[0] || null,
                      })
                    }
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div
              className={`flex justify-end gap-2 border-t p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white"}`}
            >
              <button
                onClick={() => {
                  setAddOpen(false);
                  setEditingMrn(null);
                }}
                className={`h-11 rounded-full border px-5 text-sm font-bold ${darkMode ? "border-white/15" : "border-black/15"}`}
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={saveMrn}
                className="flex h-11 items-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black hover:bg-[#7dde35] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{" "}
                {editingMrn ? "Update MRN" : "Save MRN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
