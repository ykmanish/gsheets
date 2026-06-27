"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, ExternalLink, Eye, FileSpreadsheet, IndianRupee, Loader2, PackageCheck, Pencil, Plus, RefreshCw, Save, Search, Settings, Tag, Upload, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { DatePicker } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: options.body instanceof FormData ? options.headers || {} : { "Content-Type": "application/json", ...(options.headers || {}) },
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
  }).formatToParts(date).reduce((result, part) => {
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
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    day: date.toLocaleDateString("en-IN", { weekday: "long" }),
    time: date.getHours() || date.getMinutes()
      ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
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
  const match = String(value || "").trim().match(/^mrn\s*0*(\d+)$/i);
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

function Metric({ darkMode, icon: Icon, label, value, note, tone = "", accent = "bg-[#171714]" }) {
  return (
    <section className={`flex min-h-[220px] flex-col rounded-[34px] p-7 -[0_24px_70px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 ${darkMode ? " border-white/10 bg-[#15171c] text-white -black/20" : "bg-white text-[#171714]"}`}>
      <div className="flex items-start justify-between gap-4">
        <span className={`grid h-16 w-16 place-items-center rounded-full  ring-black/10 ${tone || `${accent} text-white`}`}>
          <Icon className="h-6 w-6" />
        </span>
        <span className={`rounded-xl px-3 py-2 text-xs font-semibold ${darkMode ? "bg-white/[0.08] text-white/60" : "bg-black/[0.04] text-black/55"}`}>
          {note}
        </span>
      </div>

      <div className="mt-9">
        <p className={`text-sm  ${darkMode ? "text-white/55" : "text-black/55"}`}>{label}</p>
        <p className="mt-2 text-4xl font-semibold leading-none tracking-tight">{value}</p>
      </div>
    </section>
  );
}

function DetailItem({ darkMode, icon: Icon, label, value }) {
  return (
    <div className={`flex items-start gap-4 rounded-[24px] p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.07] text-[#d8f36a]" : "bg-[#f1eee6] text-[#171714]"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/40" : "text-black/40"}`}>{label}</p>
        <p className={`mt-2 break-words text-sm font-semibold leading-6 ${value ? "" : darkMode ? "text-white/35" : "text-black/35"}`}>{value || "-"}</p>
      </div>
    </div>
  );
}

function FileButton({ darkMode, href, label }) {
  const validHref = /^https?:\/\//i.test(String(href || "").trim()) ? String(href).trim() : "";
  if (!validHref) {
    return (
      <span className={`flex h-12 items-center justify-center rounded-2xl text-sm ${darkMode ? "bg-white/[0.035] text-white/35" : "bg-white text-black/35"}`}>
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
  const [nowMs] = useState(() => Date.now());

  const muted = darkMode ? "text-white/45" : "text-black/48";
  const panel = darkMode ? "border border-white/10 bg-white/[0.025] text-white" : "bg-white text-[#171714]";
  const softPanel = darkMode ? "bg-white/[0.035]" : "bg-black/[0.025]";
  const heroPanel = darkMode ? "bg-[#151612]" : "bg-[#ebe6dc]";

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const result = await api(`/mrn-dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
      setData(result);
    } catch (error) {
      toast.error(error.message || "Could not load MRN");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endDate, startDate]);

  const loadAllForSearch = useCallback(async () => {
    try {
      setAllLoading(true);
      const result = await api(`/mrn-dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&all=true`);
      setAllData(result);
    } catch (error) {
      toast.error(error.message || "Could not search all MRNs");
    } finally {
      setAllLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    const id = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!query.trim() || allData || allLoading) return;
    const id = window.setTimeout(() => { void loadAllForSearch(); }, 250);
    return () => window.clearTimeout(id);
  }, [allData, allLoading, loadAllForSearch, query]);

  const records = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = term ? (allData?.records || data?.records || []) : (data?.records || []);
    if (!term) return rows;
    const exactMrn = normalizedMrnNumber(term);
    if (exactMrn) {
      return rows.filter((row) => normalizedMrnNumber(row.mrnNo) === exactMrn);
    }
    return rows.filter((row) => [
      row.mrnNo,
      row.project,
      row.materialRequirement,
      row.issuedBy,
      row.status,
      row.assignTo,
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [allData?.records, data?.records, query]);

  async function saveSettings() {
    try {
      setSavingSettings(true);
      const result = await api("/mrn-dashboard/settings", {
        method: "PUT",
        body: JSON.stringify({ spreadsheetId: sheetLink, driveFolderId: folderLink }),
      });
      setData((current) => current ? { ...current, mrnSettings: result.settings } : current);
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
      materialRequestDate: row.materialRequestDate || row.date || localDateKey(),
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
    setForm({ ...form, materialRequirement: [...current, value].map((item) => `* ${item}`).join("\n") });
    setMaterialDraft("");
  }

  function removeMaterialLine(indexToRemove) {
    const next = materialItems(form.materialRequirement).filter((_, index) => index !== indexToRemove);
    setForm({ ...form, materialRequirement: next.map((item) => `* ${item}`).join("\n") });
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
      const path = editingMrn?.rowNumber ? `/mrn-dashboard/${editingMrn.rowNumber}` : "/mrn-dashboard";
      const result = await api(path, { method: editingMrn ? "PUT" : "POST", body });
      toast.success(`${result.mrnNo} ${editingMrn ? "updated" : "added"}`);
      const savedRequestDate = normalizedForm.materialRequestDate || localDateKey();
      setForm(emptyForm());
      setMaterialDraft("");
      setEditingMrn(null);
      setAddOpen(false);
      setAllData(null);
      setQuery("");
      if (savedRequestDate && (savedRequestDate < startDate || savedRequestDate > endDate)) {
        setStartDate(savedRequestDate < startDate ? savedRequestDate : startDate);
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
      <main className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}>
        <div className={`w-full max-w-2xl rounded-[30px] p-7 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.07] bg-white"}`}>
          <div className="flex items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span className={`absolute inset-0 animate-ping rounded-full opacity-20 ${darkMode ? "bg-[#d8f36a]" : "bg-black"}`} />
              <span className={`absolute inset-1 animate-pulse rounded-full ${darkMode ? "bg-[#d8f36a]/15" : "bg-black/[0.06]"}`} />
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                <FileSpreadsheet className="h-5 w-5" />
              </span>
            </span>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-[#d8f36a]" : "text-[#e76f42]"}`}>MRN workspace</p>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
                Opening live material request sheet
                <span className="inline-flex items-center gap-1 pt-1" aria-hidden="true">
                  <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
                  <span className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:120ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
                  <span className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:240ms] ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
                </span>
              </h2>
              <p className={`mt-2 text-sm ${muted}`}>Loading linked MRNs, quotations, and uploaded files from the latest sheet data.</p>
            </div>
          </div>
          <div className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}>
            <div className={`h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full ${darkMode ? "bg-[#d8f36a]" : "bg-[#171714]"}`} />
          </div>
        </div>
      </main>
    );
  }

  const settings = data?.mrnSettings || {};
  const canManage = Boolean(data?.canManageMrnSettings);
  const canEdit = Boolean(data?.canEdit);
  const summary = data?.allSummary || data?.summary || {};
  const totalMrns = summary.total || 0;

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-7 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f7f5ef] text-[#171714]"}`}>
      <div className={`mb-6 rounded-[34px] p-6 sm:p-8 lg:p-10 ${heroPanel}`}>
        <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ${darkMode ? "bg-white/5 text-white/65" : "bg-white/80 text-black/60"}`}><FileSpreadsheet className="h-3.5 w-3.5" /> Projects · MRN</span>
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold small tracking-tight sm:text-5xl">Material requests, made simple.</h1>
            <p className={`mt-4 max-w-2xl text-base leading-7 ${muted}`}>Track MRNs from the linked sheet, review quotations and files in one clean view, and add new material requests without opening spreadsheet cells.</p>
          </div>
          <div className="flex w-fit flex-col gap-3 xl:items-end xl:pb-3">
            <button disabled={!canEdit || !settings.linked} onClick={openAddMrn} className="flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-3xl  bg-[#000000] px-5 text-sm  text-white hover:bg-[#8572f5] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Add MRN</button>
            <div className="grid grid-cols-2 gap-3">
              {canManage && <button onClick={() => setSettingsOpen(true)} className={`flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-3xl border px-4 text-sm font-medium ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-black/[0.03]"}`}><Settings className="h-4 w-4" /> Links</button>}
              <button onClick={() => { setAllData(null); void load(true); }} className={`flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-3xl border px-4 text-sm font-medium ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-black/[0.03]"} ${canManage ? "" : "col-span-2"}`}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
            </div>
          </div>
        </div>
      </div>

      {!settings.linked && (
        <div className={`mb-5 rounded-[28px] p-5 ${darkMode ? "bg-amber-400/5 text-amber-100" : "bg-amber-50 text-amber-800"}`}>
          Link the MRN Google Sheet before viewing or adding MRNs.
        </div>
      )}

      <div className="mb-7 grid gap-4 md:grid-cols-4">
        <Metric darkMode={darkMode} icon={FileSpreadsheet} label="All MRNs" value={totalMrns} note="Full sheet" accent="bg-[#8c73ff]" />
        <Metric darkMode={darkMode} icon={CalendarDays} label="Open / active" value={summary.open || 0} note="Needs action" accent="bg-[#ff7a2f]" tone={darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700"} />
        <Metric darkMode={darkMode} icon={Save} label="Delivered / closed" value={summary.delivered || 0} note="Completed" accent="bg-[#24d36b]" tone={darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700"} />
        <Metric darkMode={darkMode} icon={IndianRupee} label="Quotation amount" value={money(summary.quotationAmount)} note="All records" accent="bg-[#ff9f1c]" tone={darkMode ? "bg-orange-400/10 text-orange-200" : "bg-orange-50 text-orange-700"} />
      </div>

      <section className={`rounded-[30px] p-5 ${panel}`}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">MRN records</h2>
            <p className={`mt-1 text-sm ${muted}`}>{records.length} visible requests</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DatePicker darkMode={darkMode} value={startDate} onChange={setStartDate} placeholder="From date" />
            <DatePicker darkMode={darkMode} value={endDate} onChange={setEndDate} placeholder="To date" />
            <label className={`flex h-12 min-w-64 items-center gap-2 rounded-2xl border px-4 ${darkMode ? "border-white/10 bg-[#15171c] text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-black/[0.03]"}`}><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search MRN, project, issued by" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          </div>
        </div>

        <div className={`overflow-hidden rounded-[26px] border ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
            <thead className={darkMode ? "bg-white/[0.035] text-white/50" : "bg-[#f2f1ec] text-black/50"}>
              <tr>{["MRN", "Request date", "Project / Site", "Required by", "Issued by", "Status", "Action"].map((header) => <th key={header} className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.14em]">{header}</th>)}</tr>
            </thead>
            <tbody>
              {records.map((row, index) => (
                <tr key={row.id} className={`align-middle transition ${darkMode ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.025]"} ${index % 2 === 0 ? darkMode ? "bg-white/[0.015]" : "bg-white" : darkMode ? "bg-white/[0.03]" : "bg-[#f8f7f3]"}`}>
                  <td className={`border-t px-5 py-4 font-semibold ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>{row.mrnNo || "-"}</td>
                  <td className={`border-t px-5 py-4 ${darkMode ? "border-white/10 text-white/70" : "border-black/[0.06] text-black/70"}`}>{row.materialRequestDate || row.date || "-"}</td>
                  <td className={`max-w-[240px] border-t px-5 py-4 font-semibold ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>{row.project || "-"}</td>
                  <td className={`border-t px-5 py-4 ${darkMode ? "border-white/10 text-white/70" : "border-black/[0.06] text-black/70"}`}>{row.requiredDate || "-"}</td>
                  <td className={`border-t px-5 py-4 ${darkMode ? "border-white/10 text-white/70" : "border-black/[0.06] text-black/70"}`}>{row.issuedBy || "-"}</td>
                  <td className={`border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${/delivered|closed|complete/i.test(row.status) ? "bg-emerald-500/10 text-emerald-700" : "bg-blue-500/10 text-blue-700"}`}>{row.status || "Open"}</span></td>
                  <td className={`border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
                    <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedMrn(row)} className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-white text-black -sm ring-1 ring-black/10 hover:bg-black/[0.04]"}`}>
                      <Eye className="h-4 w-4" />
                      View detail
                    </button>
                    {canEdit && (
                      <button onClick={() => openEditMrn(row)} className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${darkMode ? "bg-[#d8f36a] text-black hover:bg-[#cdea5e]" : "bg-[#171714] text-white hover:bg-black/80"}`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={7} className={`px-4 py-10 text-center ${muted}`}>No MRNs found for this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedMrn && (() => {
        const requestedAt = formatMrnDateTime(selectedMrn.materialRequestDate || selectedMrn.date || selectedMrn.timestamp);
        const requiredAt = formatMrnDateTime(selectedMrn.requiredDate);
        const editedAt = formatMrnDateTime(selectedMrn.lastEdited || selectedMrn.timestamp);
        const rawProgress = dateProgressPercent(selectedMrn.materialRequestDate || selectedMrn.date, selectedMrn.requiredDate, nowMs);
        const isDelivered = deliveredStatus(selectedMrn.status);
        const isOverdue = !isDelivered && endOfDate(parseMrnDate(selectedMrn.requiredDate))?.getTime() < nowMs;
        const progress = isDelivered ? 100 : isOverdue ? Math.min(94, Math.max(78, rawProgress || 92)) : rawProgress;
        const progressTone = isDelivered
          ? { bar: "bg-emerald-500", text: "text-emerald-600", soft: darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700", label: "Delivered in time", icon: CheckCircle2 }
          : isOverdue
          ? { bar: "bg-red-500", text: "text-red-600", soft: darkMode ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-700", label: "Delayed", icon: AlertTriangle }
          : { bar: "bg-[#27a8f2]", text: "text-[#168bd0]", soft: darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700", label: "On track", icon: Clock3 };
        const ProgressIcon = progressTone.icon;
        const items = materialItems(selectedMrn.materialRequirement);
        const invoiceAt = formatMrnDateTime(selectedMrn.invoiceDate);
        const extraDetails = [
          selectedMrn.emailAddress && ["Email address", selectedMrn.emailAddress],
          selectedMrn.assignTo && ["Assign To", selectedMrn.assignTo],
          selectedMrn.krishnaPrnStatusUpdated && ["Krishna PRN Status Updated", selectedMrn.krishnaPrnStatusUpdated],
          selectedMrn.vendorName && ["Vendor Name", selectedMrn.vendorName],
          selectedMrn.invoiceDate && ["Invoice Date", invoiceAt.date],
          selectedMrn.remark && ["Remark", selectedMrn.remark],
        ].filter(Boolean);
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md sm:p-7">
          <div className={`relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[30px] shadow-[0_30px_120px_rgba(0,0,0,0.25)] ${darkMode ? "bg-[#15171c] text-white" : "bg-[#f4f4f3] text-[#171714]"}`}>
            <div className={`flex items-center justify-between gap-4 border-b px-6 py-5 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}>
              <div className="flex min-w-0 items-center gap-4">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${darkMode ? "bg-[#d8f36a]/12 text-[#d8f36a]" : "bg-[#ffb020]/15 text-[#f5a400]"}`}>
                  <PackageCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm  ${darkMode ? "text-white/55" : "text-black/55"}`}>Material request</p>
                  <h3 className={`truncate small text-xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>{selectedMrn.mrnNo || "MRN detail"}</h3>
                  <p className={`mt-0.5 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>Last edited: {editedAt.date}{editedAt.time ? ` · ${editedAt.time}` : ""}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMrn(null)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-white hover:bg-black/[0.04]"}`}><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-5 pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className={`text-2xl small font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>{selectedMrn.project || "Project / site not added"}</h2>
                  <p className={`mt-1 text-sm ${darkMode ? "text-white/58" : "text-zinc-700"}`}>Issued by {selectedMrn.issuedBy || "-"}{selectedMrn.assignTo ? ` · Assigned to ${selectedMrn.assignTo}` : ""}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[230px] sm:justify-end">
                  <span className="rounded-xl bg-[#8d92ff] px-3 py-2 text-sm  text-white">Requested: {requestedAt.date}</span>
                  <span className="rounded-xl bg-red-500 px-3 py-2 text-sm  text-white">Required: {requiredAt.date}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-2 tracking-wide rounded-xl px-3 py-2 text-md  font-semibold ${progressTone.soft}`}><ProgressIcon className="h-4 w-4" />{progressTone.label}</span>
                <span className={`rounded-xl px-3 py-2 text-md font-semibold ${darkMode ? "bg-white/[0.06] text-white/65" : "bg-black/[0.04] text-black/60"}`}>#{selectedMrn.status || "Open"}</span>
                {/* <span className={`rounded-xl px-3 py-2 text-md font-semibold ${darkMode ? "bg-white/[0.06] text-white/65" : "bg-black/[0.04] text-black/60"}`}>#{selectedMrn.leadTime || "lead-time"}</span> */}
              </div>
              {isOverdue && (
                <div className={`mt-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${darkMode ? "bg-red-400/10 text-red-100" : "bg-red-50 text-red-700"}`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This MRN is still open and the required date has passed.</span>
                </div>
              )}

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-md font-semibold">Timeline progress</p>
                  <p className={`text-sm font-semibold ${progressTone.text}`}>{progress}%</p>
                </div>
                <div className={`h-4 overflow-hidden rounded-full ${darkMode ? "bg-white/[0.08]" : "bg-black/[0.08]"}`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${progressTone.bar}`} style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className={`mt-6 rounded-3xl p-4 ${darkMode ? "bg-white/[0.065]" : "bg-white"}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-white/[0.07] text-[#d8f36a]" : "bg-[#f1eee6] text-[#171714]"}`}>
                      <PackageCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Material requirement</p>
                      <p className={`text-xs ${muted}`}>{items.length || 0} line items</p>
                    </div>
                  </div>
                  {selectedMrn.quotationAmount && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/[0.06] text-white/60" : "bg-black/[0.04] text-black/55"}`}>{money(selectedMrn.quotationAmount)}</span>}
                </div>
                <div className="grid gap-2">
                  {items.length ? items.map((item, index) => (
                    <div key={`${item}-${index}`} className={`flex items-start gap-3 rounded-2xl px-3 py-2 text-sm leading-6 ${darkMode ? "bg-white/[0.045] text-white/82" : "bg-[#f7f5ef]"}`}>
                      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${darkMode ? "bg-[#27a8f2]" : "bg-[#171714]"}`} />
                      <span>{item}</span>
                    </div>
                  )) : <p className={`text-sm ${muted}`}>No material requirement added.</p>}
                </div>
              </div>

              {extraDetails.length > 0 && (
                <div className={`mt-4 rounded-3xl p-4 ${darkMode ? "bg-white/[0.065]" : "bg-white"}`}>
                  <p className="text-sm font-semibold">Additional details</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {extraDetails.map(([label, value]) => (
                      <div key={label} className={`rounded-2xl px-3 py-2 ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f5ef]"}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>{label}</p>
                        <p className="mt-1 break-words text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <div className={`shrink-0 border-t px-6 py-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-[#f4f4f3]"}`}>
              <div className={`grid gap-3 text-sm sm:grid-cols-4 ${darkMode ? "text-white/65" : "text-black/65"}`}>
                <div className="space-y-1">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>Lead time</p>
                  <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{selectedMrn.leadTime || "-"}</div>
                </div>
                <div className="space-y-1">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>MRN file</p>
                  <div className="flex items-center gap-2"><Upload className="h-4 w-4" />{selectedMrn.mrnPhoto ? "01" : "00"}</div>
                </div>
                <div className="space-y-1">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>Quotation file</p>
                  <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{selectedMrn.quotationPhoto ? "01" : "00"}</div>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>Quotation amount</p>
                  <div className="flex items-center gap-2 sm:justify-end"><IndianRupee className="h-4 w-4" />{selectedMrn.quotationAmount ? money(selectedMrn.quotationAmount) : "0"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FileButton darkMode={darkMode} href={selectedMrn.mrnPhoto} label="Open MRN file" />
                <FileButton darkMode={darkMode} href={selectedMrn.quotationPhoto} label="Open quotation file" />
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className={`grid w-full max-w-4xl gap-4 rounded-[28px] p-4 shadow-[0_26px_90px_rgba(0,0,0,0.22)] md:grid-cols-[1.55fr_0.9fr] ${darkMode ? "bg-[#101116] text-white" : "bg-[#efeee9] text-[#171714]"}`}>
            <div className={`rounded-[20px] p-7 ${darkMode ? "bg-[#181a20]" : "bg-white"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className={`flex items-center gap-2 text-xs font-semibold ${muted}`}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Projects / MRN Links
                </div>
                <div className="flex items-center gap-2">
                 
                  <button onClick={() => setSettingsOpen(false)} className={`grid h-9 w-9 place-items-center rounded-xl transition ${darkMode ? "bg-white/[0.06] text-white/65 hover:bg-white/10" : "bg-[#f4f4f2] text-black/55 hover:bg-black/[0.05]"}`}><X className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-8">
                <p className={`mb-3 flex items-center gap-2 text-sm font-semibold ${muted}`}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-red-500/10 text-red-500"><Tag className="h-3.5 w-3.5" /></span>
                  MRN Setup
                </p>
                <h3 className="text-4xl font-semibold small tracking-[-0.04em]">Link workspace sources</h3>
              </div>

              <div className="mt-8 grid gap-5">
                <label className="grid gap-3">
                  <span className={`flex items-center gap-3 text-sm font-medium ${muted}`}>
                    <Image src="/gsheet.svg" alt="Google Sheets" width={22} height={22} className="h-[22px] w-[22px]" />
                    Google Sheet
                    <span className={`rounded-full px-3 py-1 text-xs ${sheetLink.trim() || settings.spreadsheetId ? "bg-emerald-500/10 text-emerald-500" : darkMode ? "bg-white/[0.06] text-white/55" : "bg-black/[0.04] text-black/55"}`}>{sheetLink.trim() || settings.spreadsheetId ? "Connected" : "Required"}</span>
                  </span>
                  <input value={sheetLink} onChange={(event) => setSheetLink(event.target.value)} placeholder={settings.spreadsheetId || "Paste MRN Google Sheet link or ID"} className={`h-14 w-full rounded-2xl  px-4 text-sm outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white placeholder:text-white/30 focus:border-[#d8f36a]/45" : "border-black/10 bg-[#f7f7f5] text-black placeholder:text-black/35 focus:border-black/25"}`} />
                </label>

                <label className="grid gap-3">
                  <span className={`flex items-center gap-3 text-sm font-medium ${muted}`}>
                    <Image src="/drive.svg" alt="Google Drive" width={22} height={22} className="h-[22px] w-[22px]" />
                    Drive folder
                    <span className={`rounded-full px-3 py-1 text-xs ${folderLink.trim() || settings.driveFolderId ? "bg-emerald-500/10 text-emerald-500" : darkMode ? "bg-white/[0.06] text-white/55" : "bg-black/[0.04] text-black/55"}`}>{folderLink.trim() || settings.driveFolderId ? "Connected" : "Optional"}</span>
                  </span>
                  <input value={folderLink} onChange={(event) => setFolderLink(event.target.value)} placeholder={settings.driveFolderId || "Paste Google Drive folder link or ID"} className={`h-14 w-full rounded-2xl  px-4 text-sm outline-none transition ${darkMode ? "border-white/10 bg-white/[0.045] text-white placeholder:text-white/30 focus:border-[#d8f36a]/45" : "border-black/10 bg-[#f7f7f5] text-black placeholder:text-black/35 focus:border-black/25"}`} />
                </label>
              </div>

              <div className={`mt-8 border-t pt-5 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-[#d8f36a]/12 text-[#d8f36a]" : "bg-[#f0eee8] text-black"}`}><UserRound className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold">System note</p>
                    <p className={`mt-1 text-sm leading-6 ${muted}`}>MRN records will be pulled from the sheet. Uploaded MRN and quotation files will be stored in the linked Drive folder.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className={`rounded-[18px] p-5 ${darkMode ? "bg-[#181a20]" : "bg-white"}`}>
                <p className={`text-sm ${muted}`}>MRN</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <h4 className="text-2xl font-semibold tracking-[-0.03em]">Link Sources</h4>
                  <span className="flex -space-x-2">
                    <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#eaf8e6]"><Image src="/gsheet.svg" alt="Google Sheets" width={21} height={21} /></span>
                    <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#eef4ff]"><Image src="/drive.svg" alt="Google Drive" width={21} height={21} /></span>
                  </span>
                </div>
              </div>

              <div className={`rounded-[18px] p-5 ${darkMode ? "bg-[#181a20]" : "bg-white"}`}>
                <p className={`mb-4 text-sm font-semibold ${muted}`}>Integrations</p>
                <div className={`flex items-center gap-4 rounded-2xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f7f5]"}`}>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white"><Image src="/gsheet.svg" alt="Google Sheets" width={25} height={25} /></span>
                  <div><p className="font-semibold">Google Sheets</p><p className={`text-xs ${muted}`}>Live MRN table</p></div>
                </div>
                <div className={`mt-3 flex items-center gap-4 rounded-2xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f7f5]"}`}>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white"><Image src="/drive.svg" alt="Google Drive" width={25} height={25} /></span>
                  <div><p className="font-semibold">Google Drive</p><p className={`text-xs ${muted}`}>MRN file uploads</p></div>
                </div>
              </div>

              <div className={`rounded-[18px] p-5 ${darkMode ? "bg-[#181a20]" : "bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm ${muted}`}>Status</p>
                    <h4 className="mt-1 text-xl font-semibold">Ready to save</h4>
                  </div>
                  <CheckCircle2 className={`h-6 w-6 ${sheetLink.trim() || settings.spreadsheetId ? "text-emerald-500" : muted}`} />
                </div>
                <p className={`mt-4 text-sm leading-6 ${muted}`}>Paste or replace links, then save once. Existing MRNs stay untouched.</p>
                <button disabled={savingSettings || (!sheetLink.trim() && !folderLink.trim())} onClick={saveSettings} className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-semibold disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>{savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save links</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-md">
          <div className={`flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[34px] shadow-[0_30px_120px_rgba(0,0,0,0.28)] ${darkMode ? "bg-[#15171c] text-white" : "bg-[#f4f4f3] text-[#171714]"}`}>
            <div className={`flex items-center justify-between gap-4 border-b px-6 py-5 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}>
              <div className="flex items-center gap-4">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${darkMode ? "bg-[#d8f36a]/12 text-[#d8f36a]" : "bg-[#ffb020]/15 text-[#f5a400]"}`}><PackageCheck className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-2xl font-semibold">{editingMrn ? `Edit ${editingMrn.mrnNo}` : "Add MRN"}</h3>
                  <p className={`mt-1 text-sm ${muted}`}>{editingMrn ? "Update the material request in the MRN sheet." : "Submit a material request to the MRN Form sheet."}</p>
                </div>
              </div>
              <button onClick={() => { setAddOpen(false); setEditingMrn(null); }} className={`grid h-10 w-10 place-items-center rounded-full ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-white hover:bg-black/[0.04]"}`}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-6">
              <div className={`mb-5 rounded-3xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Request window</p>
                    <p className={`mt-1 text-sm ${muted}`}>Requested to required date gap</p>
                  </div>
                  <span className={`rounded-2xl px-4 py-2 text-sm font-semibold ${daysBetweenDates(form.materialRequestDate, form.requiredDate) < 0 ? "bg-red-500 text-white" : darkMode ? "bg-white/[0.08] text-white/70" : "bg-[#f1eee8] text-black/55"}`}>
                    {daysBetweenDates(form.materialRequestDate, form.requiredDate) === null ? "Select dates" : `${daysBetweenDates(form.materialRequestDate, form.requiredDate)} day${Math.abs(daysBetweenDates(form.materialRequestDate, form.requiredDate)) === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium md:col-span-2">Name of Project & Site Address *<input value={form.projectSite} onChange={(e) => setForm({ ...form, projectSite: e.target.value })} placeholder="Example: Kalhaar bungalow, Royal Orchid..." className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Material Request Date *<span className="mt-2 block"><DatePicker darkMode={darkMode} value={form.materialRequestDate} onChange={(value) => setForm({ ...form, materialRequestDate: value })} placeholder="Request date" /></span></label>
                <label className="block text-sm font-medium">By when Material is Required *<span className="mt-2 block"><DatePicker darkMode={darkMode} value={form.requiredDate} onChange={(value) => setForm({ ...form, requiredDate: value })} placeholder="Required date" /></span></label>
                <div className={`md:col-span-2 rounded-3xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Material Requirement *</p>
                      <p className={`mt-1 text-xs ${muted}`}>Add one material item at a time.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/[0.08] text-white/60" : "bg-[#f1eee8] text-black/45"}`}>{materialItems(form.materialRequirement).length} items</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input value={materialDraft} onChange={(event) => setMaterialDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addMaterialLine(); } }} placeholder="Example: Bricks - 1 cart" className={`h-14 min-w-0 flex-1 rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-[#f7f5ef] text-black placeholder:text-black/35"}`} />
                    <button type="button" onClick={addMaterialLine} className={`h-14 rounded-2xl px-5 text-sm font-semibold ${darkMode ? "bg-white/[0.08] text-white/75 hover:bg-white/[0.12]" : "bg-[#f1eee8] text-black/65 hover:bg-[#e9e5dc]"}`}>Add item</button>
                  </div>
                  {materialItems(form.materialRequirement).length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {materialItems(form.materialRequirement).map((item, index) => (
                        <div key={`${item}-${index}`} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${darkMode ? "bg-black/15 text-white/80" : "bg-[#f7f5ef] text-black/75"}`}>
                          <span>{item}</span>
                          <button type="button" onClick={() => removeMaterialLine(index)} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] text-white/60" : "bg-white text-black/45"}`}><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label className="block text-sm font-medium">Issued by<input value={form.issuedBy} onChange={(e) => setForm({ ...form, issuedBy: e.target.value })} placeholder="Example: Atul Mevada" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Lead Time<input value={form.leadTime} onChange={(e) => setForm({ ...form, leadTime: e.target.value })} placeholder="Example: 1 day" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Quotation Amount<input type="number" value={form.quotationAmount} onChange={(e) => setForm({ ...form, quotationAmount: e.target.value })} placeholder="Example: 25000" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Email address<input type="email" value={form.emailAddress} onChange={(e) => setForm({ ...form, emailAddress: e.target.value })} placeholder="name@example.com" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Assign To<input value={form.assignTo} onChange={(e) => setForm({ ...form, assignTo: e.target.value })} placeholder="Example: Vivek" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Status<input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} placeholder="Example: Open / Delivered" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Krishna PRN Status Updated<input value={form.krishnaPrnStatusUpdated} onChange={(e) => setForm({ ...form, krishnaPrnStatusUpdated: e.target.value })} placeholder="Example: Updated / Pending" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Vendor Name<input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="Example: ABC Traders" className={`mt-2 h-14 w-full rounded-2xl px-4 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className="block text-sm font-medium">Invoice Date<span className="mt-2 block"><DatePicker darkMode={darkMode} value={form.invoiceDate} onChange={(value) => setForm({ ...form, invoiceDate: value })} placeholder="Invoice date" /></span></label>
                <label className="block text-sm font-medium md:col-span-2">Remark<textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="Add any purchase, delivery, or vendor note..." rows={3} className={`mt-2 w-full rounded-2xl px-4 py-3 outline-none ${darkMode ? "bg-white/[0.055] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/35"}`} /></label>
                <label className={`block cursor-pointer rounded-3xl border border-dashed p-5 text-sm font-medium transition ${darkMode ? "border-white/12 bg-white/[0.04] hover:bg-white/[0.07]" : "border-black/10 bg-white hover:bg-black/[0.02]"}`}><span className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-full ${darkMode ? "bg-white/[0.07] text-[#d8f36a]" : "bg-[#f1eee6] text-[#171714]"}`}><Upload className="h-4 w-4" /></span><span><span className="block">Upload Photo of MRN</span><span className={`text-xs ${muted}`}>{form.mrnPhoto?.name || (editingMrn?.mrnPhoto ? "Existing file will be kept" : "Choose file")}</span></span></span><input type="file" onChange={(e) => setForm({ ...form, mrnPhoto: e.target.files?.[0] || null })} className="hidden" /></label>
                <label className={`block cursor-pointer rounded-3xl border border-dashed p-5 text-sm font-medium transition ${darkMode ? "border-white/12 bg-white/[0.04] hover:bg-white/[0.07]" : "border-black/10 bg-white hover:bg-black/[0.02]"}`}><span className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-full ${darkMode ? "bg-white/[0.07] text-[#d8f36a]" : "bg-[#f1eee6] text-[#171714]"}`}><FileSpreadsheet className="h-4 w-4" /></span><span><span className="block">Upload Photo of Quotation</span><span className={`text-xs ${muted}`}>{form.quotationPhoto?.name || (editingMrn?.quotationPhoto ? "Existing file will be kept" : "Choose file")}</span></span></span><input type="file" onChange={(e) => setForm({ ...form, quotationPhoto: e.target.files?.[0] || null })} className="hidden" /></label>
              </div>
            </div>
            <div className={`flex justify-end gap-2 border-t p-5 ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}><button onClick={() => { setAddOpen(false); setEditingMrn(null); }} className={`h-12 rounded-2xl px-6 ${softPanel}`}>Cancel</button><button disabled={saving} onClick={saveMrn} className={`flex h-12 items-center gap-2 rounded-2xl px-6 font-medium ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white"}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingMrn ? "Update MRN" : "Save MRN"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
