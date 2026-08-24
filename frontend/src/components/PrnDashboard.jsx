"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CalendarDays, CheckCircle2, CircleDollarSign, Eye, FileSpreadsheet, IndianRupee, Loader2, MessageSquare, RefreshCw, Save, Search, Settings, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { DatePicker } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    if (data.lastRun) error.lastRun = data.lastRun;
    throw error;
  }
  return data;
}

function localDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function money(value) {
  const number = typeof value === "number" ? value : Number(String(value || "").replace(/[₹,\s/-]/g, ""));
  if (!Number.isFinite(number) || number === 0) return String(value || "-");
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(number);
}

function formatDateTime(value) {
  if (!value) return "-";
  const text = String(value);
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(.+))?$/);
  if (match) return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}${match[4] ? ` ${match[4]}` : ""}`;
  return text;
}

function PrnWhatsappAutomationDrawer({ darkMode, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState({
    enabled: true,
    approvalContactIds: [],
    concernContactIds: [],
    templates: {
      actionRequest: "prn_submission",
      approved: "prn_approved_notification",
      declined: "prn_declined_notification",
      comment: "prn_comment_notification",
    },
    languages: { actionRequest: "en", approved: "en", declined: "en", comment: "en" },
  });
  const muted = darkMode ? "text-white/45" : "text-black/48";
  const panel = darkMode ? "border-white/10 bg-[#181a20]" : "border-black/[0.07] bg-white";
  const lastRun = settings.lastRun || null;

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api("/prn-dashboard/whatsapp/settings");
      const incomingTemplates = result.settings?.templates || {};
      const templates = {
        actionRequest: "prn_submission",
        approved: "prn_approved_notification",
        declined: "prn_declined_notification",
        comment: "prn_comment_notification",
        ...incomingTemplates,
        actionRequest: incomingTemplates.actionRequest === "prn_action_request"
          ? "prn_submission"
          : incomingTemplates.actionRequest || "prn_submission",
      };
      setContacts(result.contacts || []);
      setSettings((current) => ({
        ...current,
        ...(result.settings || {}),
        templates: { ...current.templates, ...templates },
        languages: { ...current.languages, ...(result.settings?.languages || {}) },
      }));
    } catch (error) {
      toast.error(error.message || "Could not load PRN WhatsApp settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  function toggleContact(field, id) {
    setSettings((current) => {
      const list = current[field] || [];
      return { ...current, [field]: list.includes(id) ? list.filter((item) => item !== id) : [...list, id] };
    });
  }

  async function saveSettings() {
    try {
      setSaving(true);
      const result = await api("/prn-dashboard/whatsapp/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSettings((current) => ({ ...current, ...(result.settings || {}) }));
      toast.success("PRN WhatsApp automation saved");
    } catch (error) {
      toast.error(error.message || "Could not save PRN WhatsApp automation");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(event = "actionRequest") {
    try {
      setSendingTest(true);
      const result = await api("/prn-dashboard/whatsapp/send-test", { method: "POST", body: JSON.stringify({ event, settings }) });
      setSettings((current) => ({ ...current, lastRun: result.result?.lastRun || current.lastRun }));
      result.result?.sent ? toast.success(`${event} sent to ${result.result.sent} contact(s)`) : toast.error(result.result?.lastRun?.reason || "Test did not send");
    } catch (error) {
      if (error.lastRun) setSettings((current) => ({ ...current, lastRun: error.lastRun }));
      toast.error(error.message || "Could not send PRN WhatsApp test");
    } finally {
      setSendingTest(false);
      void loadSettings();
    }
  }

  const ContactSection = ({ title, description, field }) => (
    <section className={`rounded-2xl border p-4 ${panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className={`mt-1 text-xs leading-5 ${muted}`}>{description}</p>
        </div>
        <span className="rounded-full bg-[#eafbdc] px-3 py-1 text-[11px] font-bold text-[#3f7d16]">{(settings[field] || []).length} selected</span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {contacts.map((contact) => {
          const checked = (settings[field] || []).includes(contact.id);
          return (
            <button key={contact.id} type="button" onClick={() => toggleContact(field, contact.id)} className={`flex items-center gap-3 rounded-xl p-3 text-left transition ${checked ? "bg-[#eafbdc] text-[#2f641b]" : darkMode ? "bg-white/[0.05] hover:bg-white/[0.08]" : "bg-[#f5f6f3] hover:bg-[#eef2ea]"}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${checked ? "bg-[#65bf45] text-white" : "bg-white text-[#5f665b]"}`}>{String(contact.name || contact.phone).slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{contact.name || contact.phone}</span><span className="block truncate text-[11px] opacity-70">{contact.phone}</span></span>
              <span className={`h-5 w-5 rounded-md border ${checked ? "border-[#65bf45] bg-[#65bf45]" : "border-[#b8bfb4]"}`} />
            </button>
          );
        })}
        {!contacts.length && <p className={`rounded-xl p-4 text-sm ${muted}`}>No WhatsApp contacts found. Add contacts in the WhatsApp module first.</p>}
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`absolute inset-y-3 right-3 flex w-[min(960px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[24px] shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
        <header className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}>
          <span><b>PRN</b> - WhatsApp automation</span>
          <div className="flex items-center gap-2">
            <button onClick={saveSettings} disabled={saving || loading} className="flex h-8 items-center gap-1.5 rounded-full bg-[#20231f] px-3 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save</button>
            <button onClick={onClose} className="px-1 font-semibold text-[#3f7d16]">Close</button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[290px_minmax(0,1fr)]">
          <aside className={`min-h-0 overflow-y-auto border-b p-5 md:border-b-0 md:border-r ${darkMode ? "border-white/10" : "border-black/10"}`}>
            <div className="flex gap-2"><span className="rounded bg-[#eafbdc] px-2 py-1 text-[10px] font-bold text-[#3f7d16]">WHATSAPP</span><span className="rounded bg-black/5 px-2 py-1 text-[10px] font-bold dark:bg-white/10">PRN</span></div>
            <h2 className="mt-4 text-2xl font-bold">Automation flow</h2>
            <p className={`mt-2 text-xs leading-5 ${muted}`}>New PRNs go to approval parties. Approve, decline and typed comments go to concern department recipients.</p>
            <label className={`mt-5 flex items-center justify-between rounded-2xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f6f3]"}`}><span><span className="block text-sm font-bold">Enable automation</span><span className={`text-[11px] ${muted}`}>Send approved templates automatically</span></span><input type="checkbox" checked={settings.enabled !== false} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} /></label>
            <button type="button" onClick={() => sendTest("actionRequest")} disabled={loading || sendingTest || !(settings.approvalContactIds || []).length} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#89ed3f] text-sm font-bold text-black disabled:opacity-45">
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Send test
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["approved", "declined", "comment"].map((event) => <button key={event} type="button" onClick={() => sendTest(event)} disabled={loading || sendingTest || !(settings.concernContactIds || []).length} className="h-9 rounded-xl bg-[#e9f0ff] text-[11px] font-bold text-[#3159a6] disabled:opacity-45">{event}</button>)}
            </div>
            <div className={`mt-3 rounded-2xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f6f3]"}`}>
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Last run</span><span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold dark:bg-white/10">{lastRun?.status || "Not run"}</span></div>
              {lastRun && <p className={`mt-3 break-words text-[11px] leading-5 ${muted}`}>{lastRun.event} · {lastRun.sent || 0} sent · {lastRun.failed || 0} failed · PRN: {lastRun.prnNo || "-"} · Template: {lastRun.templateName || "-"}</p>}
            </div>
          </aside>
          <main className={`min-h-0 overflow-y-auto p-5 ${darkMode ? "bg-[#101216]" : "bg-[#f7f8f5]"}`}>
            {loading ? <div className={`rounded-2xl border px-6 py-16 text-center ${panel}`}><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#4b9b16]" /></div> : <div className="space-y-5"><ContactSection title="Approval / action parties" description="These numbers receive the new PRN with approve, decline and comment buttons." field="approvalContactIds" /><ContactSection title="Concern department" description="These numbers receive approval, decline and the typed custom comments." field="concernContactIds" /></div>}
          </main>
        </div>
      </aside>
    </div>
  );
}

export default function PrnDashboard({ darkMode }) {
  const [startDate, setStartDate] = useState(() => localDateKey(-6));
  const [endDate, setEndDate] = useState(() => localDateKey());
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [sheetLink, setSheetLink] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedPrn, setSelectedPrn] = useState(null);
  const muted = darkMode ? "text-white/45" : "text-black/48";

  const load = useCallback(async (quiet = false) => {
    try {
      quiet ? setRefreshing(true) : setLoading(true);
      const result = await api(`/prn-dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
      setData(result);
    } catch (error) {
      toast.error(error.message || "Could not load PRN");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!query.trim() || allData) return;
    const id = window.setTimeout(async () => {
      try {
        setAllData(await api(`/prn-dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&all=true`));
      } catch (error) {
        toast.error(error.message || "Could not search all PRNs");
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [allData, endDate, query, startDate]);

  const records = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = term ? allData?.records || data?.records || [] : data?.records || [];
    if (!term) return rows;
    return rows.filter((row) => [row.prnNo, row.name, row.vendorName, row.project, row.typeOfPayment, row.amount, row.remark].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [allData?.records, data?.records, query]);

  async function saveSettings() {
    try {
      setSavingSettings(true);
      const result = await api("/prn-dashboard/settings", { method: "PUT", body: JSON.stringify({ spreadsheetId: sheetLink.trim() }) });
      setData((current) => current ? { ...current, prnSettings: result.settings } : current);
      setAllData(null);
      setSheetLink("");
      setSettingsOpen(false);
      toast.success("PRN sheet link saved");
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not save PRN link");
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return <main className={`flex min-h-0 flex-1 items-center justify-center px-5 py-10 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f4ef] text-[#171714]"}`}><Loader2 className="h-7 w-7 animate-spin text-[#4b9b16]" /></main>;
  }

  const settings = data?.prnSettings || {};
  const canManage = Boolean(data?.canManagePrnSettings);
  const summary = data?.allSummary || data?.summary || {};

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-7 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f7f2] text-[#171714]"}`}>
      <div className={`mb-5 rounded-3xl p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.08] bg-white"}`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4b9b16]"><FileSpreadsheet className="h-3.5 w-3.5" /> Projects · PRN</span>
            <h1 className="mt-2 text-3xl font-bold small tracking-tight">Payment Request Dashboard</h1>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>Track linked PRN requests, vendors, payment type, amount and approval flow.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && <button onClick={() => setWhatsappOpen(true)} className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${darkMode ? "border-white/15 hover:bg-white/5" : "border-black/15 bg-white hover:bg-[#f5f7f2]"}`}><MessageSquare className="h-4 w-4" /> WhatsApp automation</button>}
            {canManage && <button onClick={() => setSettingsOpen(true)} className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${darkMode ? "border-white/15 hover:bg-white/5" : "border-black/15 bg-white hover:bg-[#f5f7f2]"}`}><Settings className="h-4 w-4" /> Links</button>}
            <button onClick={() => { setAllData(null); void load(true); }} className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${darkMode ? "border-white/15 hover:bg-white/5" : "border-black/15 bg-white hover:bg-[#f5f7f2]"}`}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
          </div>
        </div>
      </div>

      {!settings.linked && <div className={`mb-5 rounded-[28px] p-5 ${darkMode ? "bg-amber-400/5 text-amber-100" : "bg-amber-50 text-amber-800"}`}>Link the PRN Google Sheet before viewing PRNs.</div>}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Metric darkMode={darkMode} icon={FileSpreadsheet} label="All PRNs" value={summary.total || 0} note="Full sheet" />
        <Metric darkMode={darkMode} icon={IndianRupee} label="Total amount" value={money(summary.amount)} note="All records" />
        <Metric darkMode={darkMode} icon={CircleDollarSign} label="Payment types" value={Object.keys(summary.byPaymentType || {}).length} note="Categories" />
      </div>

      <section className={`rounded-3xl p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white"}`}>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b9b16]">Requests</p>
            <h2 className="mt-1 text-xl font-bold small">PRN records</h2>
            <p className={`mt-1 text-sm ${muted}`}>{records.length} visible requests</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DatePicker darkMode={darkMode} value={startDate} onChange={setStartDate} placeholder="From date" />
            <DatePicker darkMode={darkMode} value={endDate} onChange={setEndDate} placeholder="To date" />
            <label className={`flex h-12 min-w-64 items-center gap-2 rounded-xl border px-4 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-[#fafbf8] text-black"}`}><Search className="h-4 w-4 text-[#4b9b16]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PRN, vendor, project" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          </div>
        </div>
        <div className={`overflow-x-auto rounded-xl border ${darkMode ? "border-white/10" : "border-black/[0.08]"}`}>
          <table className="w-full min-w-[940px] border-separate border-spacing-0 text-left text-sm">
            <thead className={darkMode ? "bg-white/[0.035] text-white/50" : "bg-[#f4f6f1] text-black/50"}>
              <tr>{["PRN", "Timestamp", "Name", "Vendor", "Project / Site", "Payment type", "Amount", "Action"].map((header) => <th key={header} className="border-b border-black/[0.06] px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em]">{header}</th>)}</tr>
            </thead>
            <tbody>
              {records.map((row, index) => (
                <tr key={row.id} className={`transition ${index % 2 === 0 ? (darkMode ? "bg-white/[0.015]" : "bg-white") : darkMode ? "bg-white/[0.03]" : "bg-[#fcfcfa]"}`}>
                  <Cell darkMode={darkMode} strong>{row.prnNo || "-"}</Cell>
                  <Cell darkMode={darkMode}>{formatDateTime(row.timestamp)}</Cell>
                  <Cell darkMode={darkMode}>{row.name || "-"}</Cell>
                  <Cell darkMode={darkMode}>{row.vendorName || "-"}</Cell>
                  <Cell darkMode={darkMode} strong>{row.project || "-"}</Cell>
                  <Cell darkMode={darkMode}>{row.typeOfPayment || "-"}</Cell>
                  <Cell darkMode={darkMode} strong>{money(row.amount)}</Cell>
                  <Cell darkMode={darkMode}><button onClick={() => setSelectedPrn(row)} className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs ${darkMode ? "border-white/15 bg-white/5 text-white" : "border-black/12 bg-white text-black"}`}><Eye className="h-4 w-4" /> View detail</button></Cell>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={8} className={`px-4 py-10 text-center ${muted}`}>No PRNs found for this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPrn && <div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && setSelectedPrn(null)}><aside className={`ml-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[24px] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}><header className={`flex h-12 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}><span><b>{selectedPrn.prnNo}</b> · Payment request details</span><button onClick={() => setSelectedPrn(null)} className="px-1 font-semibold text-[#3f7d16]">Close</button></header><div className="space-y-4 overflow-y-auto p-5"><Detail label="Requested by" value={selectedPrn.name} icon={UserRound} darkMode={darkMode} /><Detail label="Vendor" value={selectedPrn.vendorName} darkMode={darkMode} /><Detail label="Project / Site" value={selectedPrn.project} darkMode={darkMode} /><Detail label="Type of payment" value={selectedPrn.typeOfPayment} darkMode={darkMode} /><Detail label="Amount" value={money(selectedPrn.amount)} icon={IndianRupee} darkMode={darkMode} /><Detail label="Remark" value={selectedPrn.remark} darkMode={darkMode} /><Detail label="Timestamp" value={formatDateTime(selectedPrn.timestamp)} icon={CalendarDays} darkMode={darkMode} /></div></aside></div>}

      {settingsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}><div className={`w-full max-w-[620px] rounded-[22px] border p-6 ${darkMode ? "border-white/10 bg-[#101116] text-white" : "border-black/[0.08] bg-white text-[#171714]"}`}><div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-bold">Link PRN sheet</h3><button onClick={() => setSettingsOpen(false)} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f6f1]"}`}><X className="h-4 w-4" /></button></div><label className="mt-6 grid gap-3"><span className={`flex items-center gap-3 text-sm font-medium ${muted}`}><Image src="/gsheet.svg" alt="Google Sheets" width={22} height={22} /> Google Sheet <span className="rounded-md bg-[#eafbdc] px-2 py-1 text-[10px] font-bold text-[#4b9b16]">{sheetLink.trim() || settings.spreadsheetId ? "Connected" : "Required"}</span></span><input value={sheetLink} onChange={(event) => setSheetLink(event.target.value)} placeholder={settings.spreadsheetId || "Paste PRN Google Sheet link or ID"} className={`h-12 rounded-xl border px-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.045] text-white" : "border-black/10 bg-[#fafbf8] text-black"}`} /></label><div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-black/[0.06] p-4"><div className="flex items-center gap-3"><CheckCircle2 className={`h-5 w-5 ${sheetLink.trim() || settings.spreadsheetId ? "text-[#4b9b16]" : muted}`} /><p className="text-sm font-bold">Existing PRNs stay untouched.</p></div><button disabled={savingSettings || !sheetLink.trim()} onClick={saveSettings} className="flex h-11 items-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black disabled:opacity-45">{savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button></div></div></div>}

      {whatsappOpen && <PrnWhatsappAutomationDrawer darkMode={darkMode} onClose={() => setWhatsappOpen(false)} />}
    </main>
  );
}

function Metric({ darkMode, icon: Icon, label, value, note }) {
  return <article className={`rounded-3xl p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}><div className="flex items-start justify-between"><div><p className={`text-xs font-semibold uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className={`mt-1 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{note}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eafbdc] text-[#4b9b16]"><Icon className="h-5 w-5" /></span></div></article>;
}

function Cell({ darkMode, strong = false, children }) {
  return <td className={`border-t px-5 py-4 ${strong ? "font-bold" : ""} ${darkMode ? "border-white/10 text-white/75" : "border-black/[0.06] text-black/75"}`}>{children}</td>;
}

function Detail({ label, value, icon: Icon, darkMode }) {
  return <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f6f3]"}`}><div className="flex items-start gap-3">{Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eafbdc] text-[#4b9b16]"><Icon className="h-4 w-4" /></span>}<div><p className={`text-[11px] ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "-"}</p></div></div></div>;
}
