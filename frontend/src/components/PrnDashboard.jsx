"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, CircleDollarSign, Eye, FileSpreadsheet, IndianRupee, Loader2, MessageSquare, RefreshCw, Save, Search, Settings, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Badge, Button, Chip, DatePicker, Drawer, EmptyState, IconTile, Notice, PageHeader, SectionTitle, StatTile, Toggle, cx, fieldClass } from "./ui";

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

const closeButtonClass = (darkMode) => cx("grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]");

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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const panel = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
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

  const ContactSection = ({ title, description, field, icon, tone }) => (
    <section className={cx("rounded-[20px] border p-5", panel)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
          <div className="min-w-0">
            <h3 className="text-[15px]">{title}</h3>
            <p className={cx("mt-0.5 text-[12.5px] leading-5", muted)}>{description}</p>
          </div>
        </div>
        <Chip tone="lime" darkMode={darkMode} className="shrink-0">{(settings[field] || []).length} selected</Chip>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {contacts.map((contact) => {
          const checked = (settings[field] || []).includes(contact.id);
          return (
            <button key={contact.id} type="button" onClick={() => toggleContact(field, contact.id)} className={cx("flex items-center gap-3 rounded-[14px] border p-3 text-left transition-colors", checked ? (darkMode ? "border-[#cff07a]/40 bg-[#cff07a]/10" : "border-[#141414] bg-white") : darkMode ? "border-transparent bg-white/[0.05] hover:bg-white/[0.08]" : "border-transparent bg-[#f7f7f5] hover:bg-[#f1f1ef]")}>
              <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px]", checked ? (darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white") : darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#5f5f5c]")}>{String(contact.name || contact.phone).slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px]">{contact.name || contact.phone}</span><span className={cx("block truncate text-[11.5px]", muted)}>{contact.phone}</span></span>
              <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border", checked ? (darkMode ? "border-[#cff07a] bg-[#cff07a] text-black" : "border-[#141414] bg-[#141414] text-white") : darkMode ? "border-white/25" : "border-[#cfcfcb] bg-white")}>{checked && <Check className="h-3 w-3" strokeWidth={3} />}</span>
            </button>
          );
        })}
        {!contacts.length && <p className={cx("rounded-[14px] p-4 text-[13px] md:col-span-2", darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]", muted)}>No WhatsApp contacts found. Add contacts in the WhatsApp module first.</p>}
      </div>
    </section>
  );

  return (
    <div className="ui-backdrop fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] newq" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside style={{ boxShadow: "var(--ui-shadow-pop)" }} className={cx("ui-drawer absolute inset-y-2.5 right-2.5 flex w-[min(960px,calc(100vw-20px))] flex-col overflow-hidden rounded-[24px] border", darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]")}>
        <header className={cx("flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={MessageSquare} tone="mint" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-[17px] tracking-[-0.01em]">WhatsApp automation</h2>
              <p className={cx("truncate text-[12.5px]", muted)}>Who hears about new PRNs and their outcome</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button darkMode={darkMode} variant="primary" size="sm" icon={Save} loading={saving} onClick={saveSettings} disabled={saving || loading}>Save</Button>
            <button type="button" onClick={onClose} aria-label="Close" className={closeButtonClass(darkMode)}><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside className={cx("min-h-0 overflow-y-auto border-b p-6 md:border-b-0 md:border-r", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
            <Badge icon={MessageSquare} tone="mint" darkMode={darkMode}>WhatsApp · PRN</Badge>
            <SectionTitle darkMode={darkMode} className="mt-4" title="Automation flow" subtitle="from request to reply" />
            <p className={cx("mt-3 text-[13px] leading-5", muted)}>New PRNs go to approval parties. Approve, decline and typed comments go to concern department recipients.</p>
            <div className={cx("mt-5 flex items-center justify-between gap-3 rounded-[16px] p-4", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
              <span><span className="block text-[13.5px]">Enable automation</span><span className={cx("text-[12px]", muted)}>Send approved templates automatically</span></span>
              <Toggle darkMode={darkMode} label="Enable automation" checked={settings.enabled !== false} onChange={(next) => setSettings((current) => ({ ...current, enabled: next }))} />
            </div>
            <Button darkMode={darkMode} variant="primary" className="mt-3 w-full" icon={MessageSquare} loading={sendingTest} onClick={() => sendTest("actionRequest")} disabled={loading || sendingTest || !(settings.approvalContactIds || []).length}>Send test</Button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["approved", "declined", "comment"].map((event) => <Button key={event} darkMode={darkMode} variant="soft" size="sm" className="px-2 capitalize" onClick={() => sendTest(event)} disabled={loading || sendingTest || !(settings.concernContactIds || []).length}>{event}</Button>)}
            </div>
            <div className={cx("mt-3 rounded-[16px] p-4", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
              <div className="flex items-center justify-between gap-3"><span className="text-[13.5px]">Last run</span><Chip darkMode={darkMode} tone={lastRun?.status === "sent" ? "mint" : lastRun?.status === "failed" ? "rose" : "outline"}>{lastRun?.status || "Not run"}</Chip></div>
              {lastRun && <p className={cx("mt-3 break-words text-[12px] leading-5", muted)}>{lastRun.event} · {lastRun.sent || 0} sent · {lastRun.failed || 0} failed · PRN: {lastRun.prnNo || "-"} · Template: {lastRun.templateName || "-"}</p>}
            </div>
          </aside>
          <main className={cx("min-h-0 overflow-y-auto p-6", darkMode ? "bg-[#0f1014]" : "bg-[#fafaf9]")}>
            {loading ? <div className={cx("rounded-[20px] border px-6 py-16 text-center", panel)}><Loader2 className={cx("mx-auto h-6 w-6 animate-spin", muted)} /></div> : <div className="space-y-4"><ContactSection title="Approval / action parties" description="These numbers receive the new PRN with approve, decline and comment buttons." field="approvalContactIds" icon={CheckCircle2} tone="mint" /><ContactSection title="Concern department" description="These numbers receive approval, decline and the typed custom comments." field="concernContactIds" icon={UserRound} tone="sky" /></div>}
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";

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
    return <main className={cx("flex min-h-0 flex-1 items-center justify-center px-5 py-10", darkMode ? "text-white" : "text-[#141414]")}><Loader2 className={cx("h-7 w-7 animate-spin", muted)} /></main>;
  }

  const settings = data?.prnSettings || {};
  const canManage = Boolean(data?.canManagePrnSettings);
  const summary = data?.allSummary || data?.summary || {};

  return (
    <main className={cx("min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8", darkMode ? "text-white" : "text-[#141414]")}>
      <PageHeader
        darkMode={darkMode}
        badge="Projects · PRN"
        badgeIcon={IndianRupee}
        badgeTone="peach"
        title="Payment requests"
        subtitle="who asked, for whom, how much"
        description="Track linked PRN requests, vendors, payment type, amount and approval flow."
        actions={<>
          {canManage && <Button darkMode={darkMode} variant="secondary" icon={MessageSquare} onClick={() => setWhatsappOpen(true)}>WhatsApp automation</Button>}
          {canManage && <Button darkMode={darkMode} variant="secondary" icon={Settings} onClick={() => setSettingsOpen(true)}>Links</Button>}
          <Button darkMode={darkMode} variant="primary" onClick={() => { setAllData(null); void load(true); }}><RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} /> Refresh</Button>
        </>}
      />

      {!settings.linked && <Notice tone="amber" darkMode={darkMode} icon={AlertTriangle} className="mt-6">Link the PRN Google Sheet before viewing PRNs.</Notice>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile darkMode={darkMode} icon={FileSpreadsheet} tone="mint" value={summary.total || 0} label="All PRNs" hint="Full sheet" />
        <StatTile darkMode={darkMode} icon={IndianRupee} tone="peach" value={money(summary.amount)} label="Total amount" hint="All records" />
        <StatTile darkMode={darkMode} icon={CircleDollarSign} tone="lavender" value={Object.keys(summary.byPaymentType || {}).length} label="Payment types" hint="Categories" />
      </div>

      <section className={cx("mt-6 rounded-[20px] border p-5", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={FileSpreadsheet} tone="sky" darkMode={darkMode} size="sm" />
            <div>
              <h2 className="text-[15px]">PRN records</h2>
              <p className={cx("text-[12.5px]", muted)}>{records.length} visible requests</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DatePicker darkMode={darkMode} value={startDate} onChange={setStartDate} placeholder="From date" />
            <DatePicker darkMode={darkMode} value={endDate} onChange={setEndDate} placeholder="To date" />
            <label className={cx(fieldClass(darkMode), "w-full cursor-text sm:w-64")}><Search className={cx("h-4 w-4 shrink-0", muted)} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PRN, vendor, project" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left text-[13px]">
            <thead>
              <tr>{["PRN", "Timestamp", "Name", "Vendor", "Project / Site", "Payment type", "Amount", ""].map((header) => <th key={header || "action"} className={cx("px-4 pb-2.5 pt-1 text-[12px] font-normal", muted)}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className={cx("border-t transition-colors", darkMode ? "border-white/[0.07] hover:bg-white/[0.03]" : "border-[#f0f0ee] hover:bg-[#fafaf9]")}>
                  <Cell darkMode={darkMode} strong>{row.prnNo || "-"}</Cell>
                  <Cell darkMode={darkMode}>{formatDateTime(row.timestamp)}</Cell>
                  <Cell darkMode={darkMode}>{row.name || "-"}</Cell>
                  <Cell darkMode={darkMode}>{row.vendorName || "-"}</Cell>
                  <Cell darkMode={darkMode} strong>{row.project || "-"}</Cell>
                  <Cell darkMode={darkMode}>{row.typeOfPayment ? <Chip tone="neutral" darkMode={darkMode}>{row.typeOfPayment}</Chip> : "-"}</Cell>
                  <Cell darkMode={darkMode} strong><span className="tabular-nums">{money(row.amount)}</span></Cell>
                  <Cell darkMode={darkMode}><Button darkMode={darkMode} variant="soft" size="sm" icon={Eye} onClick={() => setSelectedPrn(row)}>View detail</Button></Cell>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && <EmptyState darkMode={darkMode} icon={FileSpreadsheet} tone="peach" title="No PRNs found" text="Nothing in this date range. Try a wider range or another search." className="mt-2" />}
        </div>
      </section>

      <Drawer open={Boolean(selectedPrn)} onClose={() => setSelectedPrn(null)} darkMode={darkMode} icon={IndianRupee} tone="peach" title={selectedPrn?.prnNo || "PRN"} subtitle="Payment request details" width={560}>
        {selectedPrn && <div className="space-y-3">
          <div className={cx("rounded-[20px] p-5", darkMode ? "bg-[rgba(251,146,60,0.13)]" : "bg-[#fbe5dc]")}>
            <p className={cx("text-[12.5px]", darkMode ? "text-white/55" : "text-[#6b6b6b]")}>Amount</p>
            <p className="mt-1 text-[30px] leading-none tracking-[-0.03em] tabular-nums">{money(selectedPrn.amount)}</p>
            {selectedPrn.typeOfPayment && <p className={cx("mt-2 text-[12.5px]", darkMode ? "text-white/55" : "text-[#6b6b6b]")}>{selectedPrn.typeOfPayment}</p>}
          </div>
          <Detail label="Requested by" value={selectedPrn.name} icon={UserRound} darkMode={darkMode} />
          <Detail label="Vendor" value={selectedPrn.vendorName} darkMode={darkMode} />
          <Detail label="Project / Site" value={selectedPrn.project} darkMode={darkMode} />
          <Detail label="Type of payment" value={selectedPrn.typeOfPayment} darkMode={darkMode} />
          <Detail label="Amount" value={money(selectedPrn.amount)} icon={IndianRupee} darkMode={darkMode} />
          <Detail label="Remark" value={selectedPrn.remark} darkMode={darkMode} />
          <Detail label="Timestamp" value={formatDateTime(selectedPrn.timestamp)} icon={CalendarDays} darkMode={darkMode} />
        </div>}
      </Drawer>

      {settingsOpen && <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 newq" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}>
        <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={cx("ui-pop w-full max-w-[600px] rounded-[24px] border p-6", darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile icon={FileSpreadsheet} tone="mint" darkMode={darkMode} size="md" />
              <div><h3 className="text-[18px] tracking-[-0.01em]">Link PRN sheet</h3><p className={cx("text-[13px]", muted)}>where payment requests are read from</p></div>
            </div>
            <button type="button" aria-label="Close" onClick={() => setSettingsOpen(false)} className={closeButtonClass(darkMode)}><X className="h-4 w-4" /></button>
          </div>
          <label className="mt-6 grid gap-2">
            <span className={cx("flex items-center gap-2.5 text-[13px]", muted)}><Image src="/gsheet-icon.png" alt="Google Sheets" width={20} height={20} /> Google Sheet <Chip tone={sheetLink.trim() || settings.spreadsheetId ? "mint" : "neutral"} darkMode={darkMode} className="h-6 text-[11.5px]">{sheetLink.trim() || settings.spreadsheetId ? "Connected" : "Required"}</Chip></span>
            <input value={sheetLink} onChange={(event) => setSheetLink(event.target.value)} placeholder={settings.spreadsheetId || "Paste PRN Google Sheet link or ID"} className={fieldClass(darkMode, { size: "lg" })} />
          </label>
          <div className={cx("mt-5 flex items-center justify-between gap-4 rounded-[16px] p-4", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
            <div className="flex items-center gap-3"><CheckCircle2 className={cx("h-5 w-5", sheetLink.trim() || settings.spreadsheetId ? "text-[#2f7a4f]" : muted)} /><p className="text-[13.5px]">Existing PRNs stay untouched.</p></div>
            <Button darkMode={darkMode} variant="primary" icon={Save} loading={savingSettings} disabled={savingSettings || !sheetLink.trim()} onClick={saveSettings}>Save</Button>
          </div>
        </div>
      </div>}

      {whatsappOpen && <PrnWhatsappAutomationDrawer darkMode={darkMode} onClose={() => setWhatsappOpen(false)} />}
    </main>
  );
}

function Cell({ darkMode, strong = false, children }) {
  return <td className={cx("px-4 py-3.5 align-middle", strong ? (darkMode ? "text-white" : "text-[#141414]") : darkMode ? "text-white/65" : "text-[#5f5f5c]")}>{children}</td>;
}

function Detail({ label, value, icon: Icon, darkMode }) {
  return (
    <div className={cx("flex items-start gap-3 rounded-[16px] p-4", darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]")}>
      {Icon && <IconTile icon={Icon} tone="neutral" darkMode={darkMode} size="xs" />}
      <div className="min-w-0">
        <p className={cx("text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{label}</p>
        <p className="mt-0.5 break-words text-[14px]">{value || "-"}</p>
      </div>
    </div>
  );
}
