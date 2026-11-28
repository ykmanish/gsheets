"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  AtSign,
  CalendarDays,
  Check,
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
  MessageSquare,
  Minimize2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Store,
  Tag,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Badge, Button, Chip, DatePicker, EmptyState, IconTile, Notice, PageHeader, SectionTitle, StatTile, Toggle, cx, fieldClass, toneOf } from "./ui";

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

function vendorMatchesForMaterial(row, material, index) {
  const matches = Array.isArray(row?.materialVendorMatches)
    ? row.materialVendorMatches
    : [];
  return matches.find((entry) => entry.material === material)
    || matches[index]
    || { material, vendors: [] };
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
  const materialsHtml = items.length
    ? items.map((item, index) => {
        const match = vendorMatchesForMaterial(row, item, index);
        const vendors = Array.isArray(match.vendors) ? match.vendors : [];
        const vendorRows = vendors
          .map((vendor) => ({
            name: String(vendor.contactVendorName || vendor.vendorName || "").trim(),
            proprietor: String(vendor.proprietorName || "").trim(),
            contact: String(vendor.contactNo || "").trim(),
          }))
          .filter((vendor) => vendor.name);
        const seenVendors = new Set();
        const uniqueVendors = vendorRows.filter((vendor) => {
          const key = `${vendor.name.toLowerCase()}|${vendor.proprietor.toLowerCase()}|${vendor.contact}`;
          if (seenVendors.has(key)) return false;
          seenVendors.add(key);
          return true;
        });
        return `<div class="material-row"><div class="item"><i class="dot"></i><span>${safe(item)}</span></div><div class="vendors"><div class="vendor-title">Vendor details</div>${uniqueVendors.length ? uniqueVendors.map((vendor) => `<div class="vendor"><strong>${safe(vendor.name)}</strong>${vendor.proprietor ? `<span>${safe(vendor.proprietor)}</span>` : ""}${vendor.contact ? `<b>${safe(vendor.contact)}</b>` : ""}</div>`).join("") : '<div class="no-vendor">No vendor available</div>'}</div></div>`;
      }).join("")
    : '<p class="muted">No material items added.</p>';
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(row.mrnNo || "MRN")} · Material Request</title>${styles}<style>
    @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#171714;font-family:Geist,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{max-width:794px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #171714;padding-bottom:9px}.eyebrow{font-size:8px;font-weight:800;letter-spacing:.14em;color:#4b9b16;text-transform:uppercase}.title{font-size:23px;line-height:1.05;margin:4px 0 2px;font-weight:800}.muted{color:#777;font-size:9px;line-height:1.3}.mrn{background:#eafbdc;color:#3f7d16;padding:7px 10px;border-radius:8px;font-size:10px;font-weight:800}.statusbar{margin:9px 0;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border-radius:20px;background:#f0f1ed}.statusbar span{padding:6px;text-align:center;font-size:8px;font-weight:800}.statusbar .done{background:#8de1dc}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}.card{border:1px solid #dedfd9;border-radius:11px;padding:10px;break-inside:avoid}.card h2{font-size:12px;margin:0 0 7px}.detail{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #ecece8;font-size:8px}.detail:last-child{border:0}.detail span{color:#777}.detail strong{text-align:right;font-size:9px}.materials{grid-column:1/-1;break-inside:auto;page-break-inside:auto}.material-row{margin-top:6px;border:1px solid #edf0ea;border-radius:9px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}.item{display:flex;gap:8px;padding:7px 9px;background:#f7f8f4;font-size:9px;font-weight:700}.dot{width:5px;height:5px;margin-top:4px;border-radius:50%;background:#69c832;flex:none}.vendors{padding:7px 9px}.vendor-title{font-size:7px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#4b9b16}.vendor{display:inline-flex;align-items:center;gap:5px;margin:4px 5px 0 0;border-left:3px solid #8de1dc;background:#fbfcf8;border-radius:6px;padding:4px 7px;font-size:8px;line-height:1.2;max-width:100%;vertical-align:top}.vendor strong{font-size:9px}.vendor span{color:#666}.vendor b{font-size:9px}.vendor span:before,.vendor b:before{content:"·";margin-right:5px;color:#9aa095}.no-vendor{margin-top:4px;color:#999;font-size:9px;font-weight:700}.amount{font-size:20px;font-weight:800;margin-top:3px}.note{grid-column:1/-1;background:#f7f8f4}.footer{display:flex;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid #ddd;font-size:8px;color:#888}@media print{.page{max-width:none}.materials{break-before:auto;page-break-before:auto}.card:not(.materials),.material-row{break-inside:avoid;page-break-inside:avoid}}
  </style></head><body class="newq"><main class="page"><header class="top"><div><div class="eyebrow">Material request note</div><h1 class="title">${safe(row.project || "Project / site not added")}</h1><p class="muted">Issued by ${safe(row.issuedBy || "Not added")} · Required ${safe(required.date)}</p></div><div class="mrn">${safe(row.mrnNo || "MRN")}</div></header><div class="statusbar"><span class="done">Requested</span><span class="done">Assigned</span><span class="done">Quoted</span><span>${safe(row.status || "Open")}</span></div><section class="grid"><article class="card"><h2>Request schedule</h2>${detail("Requested", requested.date)}${detail("Required by", required.date)}${detail("Lead time", row.leadTime)}${detail("Status", row.status || "Open")}</article><article class="card"><h2>Ownership & contact</h2>${detail("Issued by", row.issuedBy)}${detail("Assigned to", row.assignTo)}${detail("Email", row.emailAddress)}${detail("Vendor", row.vendorName)}</article><article class="card materials"><h2>Material requirement · ${items.length} item${items.length === 1 ? "" : "s"}</h2>${materialsHtml}</article><article class="card"><h2>Quotation</h2><p class="muted">Quotation amount</p><div class="amount">${safe(money(row.quotationAmount))}</div>${detail("Invoice date", row.invoiceDate)}${detail("PRN status", row.krishnaPrnStatusUpdated)}</article><article class="card"><h2>Documents</h2>${detail("MRN file", row.mrnPhoto ? "Available" : "Not added")}${detail("Quotation file", row.quotationPhoto ? "Available" : "Not added")}</article>${row.remark ? `<article class="card note"><h2>Remarks</h2><p class="muted">${safe(row.remark)}</p></article>` : ""}</section><footer class="footer"><span>Generated from MRN Workspace</span><span>${safe(new Date().toLocaleString("en-IN"))}</span></footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`);
  printWindow.document.close();
}

function FileButton({ darkMode, href, label }) {
  const validHref = /^https?:\/\//i.test(String(href || "").trim())
    ? String(href).trim()
    : "";
  if (!validHref) {
    return (
      <span
        className={cx("flex h-11 items-center justify-center rounded-full text-[13px]", darkMode ? "bg-white/[0.04] text-white/35" : "bg-[#f4f4f2] text-[#a3a3a0]")}
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
      className={cx("flex h-11 items-center justify-center gap-2 rounded-full text-[13px] transition-colors", darkMode ? "bg-white text-black hover:bg-white/90" : "bg-[#141414] text-white hover:bg-black")}
    >
      {label}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

const MRN_STAGES = ["Requested", "Assigned", "Quoted", "Delivered"];

// Pieces of the detail drawer, matching MrnDetailDrawer.
function SmallHeading({ darkMode, children, aside }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className={cx("text-[15px] tracking-[-0.01em]", darkMode ? "text-white" : "text-[#141414]")}>{children}</h3>
      {aside}
    </div>
  );
}

function ContactRow({ darkMode, icon, tone = "neutral", label, children }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
      <div className="min-w-0">
        <p className={cx("text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{label}</p>
        <div className="truncate text-[13.5px]">{children}</div>
      </div>
    </div>
  );
}

function FormLabel({ darkMode, children }) {
  return <span className={cx("mb-1.5 block text-[12.5px]", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{children}</span>;
}

function MrnWhatsappAutomationDrawer({ darkMode, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState({
    enabled: true,
    approvalContactIds: [],
    concernContactIds: [],
    templates: {
      actionRequest: "mrn_action_request",
      approved: "mrn_approved_notification",
      declined: "mrn_declined_notification",
      comment: "mrn_comment_notification",
    },
    languages: {
      actionRequest: "en",
      approved: "en",
      declined: "en",
      comment: "en",
    },
  });
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const panel = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const lastRun = settings.lastRun || null;
  const contactInitials = (value = "") =>
    String(value)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "WA";

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api("/mrn-dashboard/whatsapp/settings");
      setContacts(result.contacts || []);
      setSettings((current) => ({
        ...current,
        ...(result.settings || {}),
        templates: { ...current.templates, ...(result.settings?.templates || {}) },
        languages: { ...current.languages, ...(result.settings?.languages || {}) },
      }));
    } catch (error) {
      toast.error(error.message || "Could not load MRN WhatsApp settings");
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
      const result = await api("/mrn-dashboard/whatsapp/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSettings((current) => ({ ...current, ...(result.settings || {}) }));
      toast.success("MRN WhatsApp automation saved");
    } catch (error) {
      toast.error(error.message || "Could not save WhatsApp automation");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(event = "actionRequest") {
    try {
      setSendingTest(true);
      const result = await api("/mrn-dashboard/whatsapp/send-test", {
        method: "POST",
        body: JSON.stringify({ event, settings }),
      });
      const run = result.result?.lastRun || null;
      setSettings((current) => ({ ...current, lastRun: run || current.lastRun }));
      if (result.result?.sent) {
        toast.success(`${event === "actionRequest" ? "Action request" : event} sent to ${result.result.sent} contact${result.result.sent === 1 ? "" : "s"}`);
      } else {
        toast.error(result.result?.lastRun?.reason || result.result?.status || "Test did not send");
      }
    } catch (error) {
      if (error.lastRun) setSettings((current) => ({ ...current, lastRun: error.lastRun }));
      toast.error(error.message || "Could not send MRN WhatsApp test");
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
              <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px]", checked ? (darkMode ? "bg-[#cff07a] text-black" : "bg-[#141414] text-white") : darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#5f5f5c]")}>{contactInitials(contact.name || contact.phone)}</span>
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
    <div className="newq fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`mrn-detail-shell absolute flex flex-col overflow-hidden border animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
        <header className={cx("flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={MessageSquare} tone="mint" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-[17px] tracking-[-0.01em]">WhatsApp automation</h2>
              <p className={cx("truncate text-[12.5px]", muted)}>Who hears about new MRNs and their outcome</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button darkMode={darkMode} variant="primary" size="sm" icon={Save} loading={saving} onClick={saveSettings} disabled={saving || loading}>Save</Button>
            <button type="button" onClick={onClose} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside className={cx("min-h-0 overflow-y-auto border-b p-6 md:border-b-0 md:border-r", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
            <Badge icon={MessageSquare} tone="mint" darkMode={darkMode}>WhatsApp · MRN</Badge>
            <SectionTitle darkMode={darkMode} className="mt-4" title="Automation flow" subtitle="from request to reply" />
            <p className={cx("mt-3 text-[13px] leading-5", muted)}>New MRNs go to approval parties. Approval, decline and comment outcomes go to concern department recipients.</p>
            <div className={cx("mt-5 flex items-center justify-between gap-3 rounded-[16px] p-4", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
              <span><span className="block text-[13.5px]">Enable automation</span><span className={cx("text-[12px]", muted)}>Send approved templates automatically</span></span>
              <Toggle darkMode={darkMode} label="Enable automation" checked={settings.enabled !== false} onChange={(next) => setSettings((current) => ({ ...current, enabled: next }))} />
            </div>
            <Button darkMode={darkMode} variant="primary" className="mt-3 w-full" icon={MessageSquare} loading={sendingTest} onClick={() => sendTest("actionRequest")} disabled={loading || sendingTest || !(settings.approvalContactIds || []).length}>Send test</Button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                ["approved", "Approve", "mint"],
                ["declined", "Decline", "rose"],
                ["comment", "Comment", "sky"],
              ].map(([event, label, tone]) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => sendTest(event)}
                  disabled={loading || sendingTest || !(settings.concernContactIds || []).length}
                  style={{ backgroundColor: darkMode ? toneOf(tone)[2] : toneOf(tone)[0], color: darkMode ? toneOf(tone)[3] : toneOf(tone)[1] }}
                  className="h-8 rounded-full text-[12.5px] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={cx("mt-3 rounded-[16px] p-4", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px]">Last run</span>
                <Chip darkMode={darkMode} tone={lastRun?.status === "sent" ? "mint" : lastRun?.status === "failed" ? "rose" : "outline"} className="h-6 text-[11.5px]">{lastRun?.status || "Not run"}</Chip>
              </div>
              {lastRun ? (
                <div className={cx("mt-3 space-y-1 text-[12px] leading-5", muted)}>
                  <p>{formatMrnDateTime(lastRun.at).date} {formatMrnDateTime(lastRun.at).time}</p>
                  <p>{lastRun.event || "run"} · {lastRun.sent || 0} sent · {lastRun.failed || 0} failed · {lastRun.recipients || 0} recipients</p>
                  <p className="break-words">MRN: {lastRun.mrnNo || "-"} · Template: {lastRun.templateName || "-"}{lastRun.language ? ` · ${lastRun.language}` : ""}</p>
                  {lastRun.reason && <p className="text-[#c0394b]">{lastRun.reason}</p>}
                  {!!lastRun.results?.length && (
                    <div className="mt-2 space-y-1">
                      {lastRun.results.slice(0, 3).map((item, index) => (
                        <p key={`${item.phone || "recipient"}-${index}`} className={item.status === "sent" ? (darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]") : "text-[#c0394b]"}>
                          {item.phone || "Recipient"}: {item.status}{item.reason ? ` - ${item.reason}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className={cx("mt-2 text-[12px]", muted)}>No send attempt recorded yet.</p>
              )}
            </div>
          </aside>
          <main className={cx("min-h-0 overflow-y-auto p-6", darkMode ? "bg-[#0f1014]" : "bg-[#fafaf9]")}>
            {loading ? (
              <div className={cx("rounded-[20px] border px-6 py-16 text-center", panel)}><Loader2 className={cx("mx-auto h-6 w-6 animate-spin", muted)} /><p className={cx("mt-3 text-[13px]", muted)}>Loading WhatsApp contacts...</p></div>
            ) : (
              <div className="space-y-4">
                <ContactSection title="Approval / action parties" description="These numbers receive the new MRN action request with approve, decline and comment buttons." field="approvalContactIds" icon={CheckCircle2} tone="mint" />
                <ContactSection title="Concern department" description="These numbers receive approval, decline and comment outcomes." field="concernContactIds" icon={UserRound} tone="sky" />
              </div>
            )}
          </main>
        </div>
      </aside>
    </div>
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
  const [whatsappOpen, setWhatsappOpen] = useState(false);
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

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";

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
      <main className={cx("flex min-h-0 flex-1 items-center justify-center px-5 py-10", darkMode ? "text-white" : "text-[#141414]")}>
        <div className={cx("w-full max-w-xl rounded-[24px] border p-7", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
          <div className="flex items-center gap-4">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span className={cx("absolute inset-0 animate-ping rounded-[18px] opacity-20", darkMode ? "bg-[#cff07a]" : "bg-[#ece8fb]")} />
              <IconTile icon={FileSpreadsheet} tone="lavender" darkMode={darkMode} size="lg" className="relative" />
            </span>
            <div>
              <Badge icon={PackageCheck} tone="lavender" darkMode={darkMode}>MRN workspace</Badge>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-[19px] tracking-[-0.01em]">
                Opening live material request sheet
                <span className="inline-flex items-center gap-1 pt-1" aria-hidden="true">
                  <span className={cx("h-1.5 w-1.5 animate-bounce rounded-full", darkMode ? "bg-[#cff07a]" : "bg-[#141414]")} />
                  <span className={cx("h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:120ms]", darkMode ? "bg-[#cff07a]" : "bg-[#141414]")} />
                  <span className={cx("h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:240ms]", darkMode ? "bg-[#cff07a]" : "bg-[#141414]")} />
                </span>
              </h2>
              <p className={cx("mt-1 text-[13px]", muted)}>
                Loading linked MRNs, quotations, and uploaded files from the latest sheet data.
              </p>
            </div>
          </div>
          <div className={cx("mt-6 h-1.5 overflow-hidden rounded-full", darkMode ? "bg-white/10" : "bg-[#f0f0ee]")}>
            <div className={cx("h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full", darkMode ? "bg-[#cff07a]" : "bg-[#141414]")} />
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
    <main className={cx("min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8", darkMode ? "text-white" : "text-[#141414]")}>
      <PageHeader
        darkMode={darkMode}
        badge="Projects · MRN"
        badgeIcon={PackageCheck}
        badgeTone="lavender"
        title="Material requests"
        subtitle="what each site needs, and by when"
        description="Track requests, quotations, owners and delivery progress from one workspace."
        actions={<>
          {canManage && <Button darkMode={darkMode} variant="secondary" icon={MessageSquare} onClick={() => setWhatsappOpen(true)}>WhatsApp automation</Button>}
          {canManage && <Button darkMode={darkMode} variant="secondary" icon={Settings} onClick={() => setSettingsOpen(true)}>Links</Button>}
          <Button darkMode={darkMode} variant="secondary" onClick={() => { setAllData(null); void load(true); }}><RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} /> Refresh</Button>
          <Button darkMode={darkMode} variant="primary" icon={Plus} disabled={!canEdit || !settings.linked} onClick={openAddMrn}>Add MRN</Button>
        </>}
      />

      {!settings.linked && (
        <Notice tone="amber" darkMode={darkMode} icon={AlertTriangle} className="mt-6">Link the MRN Google Sheet before viewing or adding MRNs.</Notice>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile darkMode={darkMode} icon={FileSpreadsheet} tone="lavender" value={totalMrns} label="All MRNs" hint="Full sheet" />
        <StatTile darkMode={darkMode} icon={CalendarDays} tone="sky" value={summary.open || 0} label="Open / active" hint="Needs action" />
        <StatTile darkMode={darkMode} icon={CheckCircle2} tone="mint" value={summary.delivered || 0} label="Delivered / closed" hint="Completed" />
        <StatTile darkMode={darkMode} icon={IndianRupee} tone="amber" value={money(summary.quotationAmount)} label="Quotation amount" hint="All records" />
      </div>

      <section className={cx("mt-6 rounded-[20px] border p-5", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={FileSpreadsheet} tone="peach" darkMode={darkMode} size="sm" />
            <div>
              <h2 className="text-[15px]">MRN records</h2>
              <p className={cx("text-[12.5px]", muted)}>{records.length} visible requests</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DatePicker darkMode={darkMode} value={startDate} onChange={setStartDate} placeholder="From date" />
            <DatePicker darkMode={darkMode} value={endDate} onChange={setEndDate} placeholder="To date" />
            <label className={cx(fieldClass(darkMode), "w-full cursor-text sm:w-64")}>
              <Search className={cx("h-4 w-4 shrink-0", muted)} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search MRN, project, issued by"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
            <thead>
              <tr>
                {["MRN", "Request date", "Project / Site", "Required by", "Issued by", "Status", ""].map((header) => (
                  <th key={header || "action"} className={cx("px-4 pb-2.5 pt-1 text-[12px] font-normal", muted)}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row) => {
                const done = /delivered|closed|complete/i.test(row.status);
                const cellMuted = darkMode ? "text-white/65" : "text-[#5f5f5c]";
                return (
                  <tr key={row.id} className={cx("group border-t align-middle transition-colors", darkMode ? "border-white/[0.07] hover:bg-white/[0.03]" : "border-[#f0f0ee] hover:bg-[#fafaf9]")}>
                    <td className="px-4 py-3.5">{row.mrnNo || "-"}</td>
                    <td className={cx("px-4 py-3.5", cellMuted)}>{row.materialRequestDate || row.date || "-"}</td>
                    <td className="max-w-[240px] px-4 py-3.5">{row.project || "-"}</td>
                    <td className={cx("px-4 py-3.5", cellMuted)}>{row.requiredDate || "-"}</td>
                    <td className={cx("px-4 py-3.5", cellMuted)}>{row.issuedBy || "-"}</td>
                    <td className="px-4 py-3.5">
                      <Chip tone={done ? "mint" : "sky"} darkMode={darkMode} className="h-6 text-[11.5px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {row.status || "Open"}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          darkMode={darkMode}
                          variant="soft"
                          size="sm"
                          icon={Eye}
                          onClick={() => {
                            setDrawerClosing(false);
                            setSelectedMrn(row);
                          }}
                        >
                          View detail
                        </Button>
                        {canEdit && (
                          <Button darkMode={darkMode} variant="secondary" size="sm" icon={Pencil} onClick={() => openEditMrn(row)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!records.length && (
            <EmptyState darkMode={darkMode} icon={PackageCheck} tone="lavender" title="No MRNs found" text="Nothing in this date range. Try a wider range or another search." className="mt-2" />
          )}
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
                label: "Delivered in time", tone: "mint",
                icon: CheckCircle2,
              }
            : isOverdue
              ? {
                  bar: "bg-red-500",
                  text: "text-red-600",
                  soft: darkMode
                    ? "bg-red-400/10 text-red-200"
                    : "bg-red-50 text-red-700",
                  label: "Delayed", tone: "rose",
                  icon: AlertTriangle,
                }
              : {
                  bar: "bg-[#27a8f2]",
                  text: "text-[#168bd0]",
                  soft: darkMode
                    ? "bg-blue-400/10 text-blue-200"
                    : "bg-blue-50 text-blue-700",
                  label: "On track", tone: "sky",
                  icon: Clock3,
                };
          const ProgressIcon = progressTone.icon;
          const items = materialItems(selectedMrn.materialRequirement);
          const line = darkMode ? "border-white/10" : "border-[#f0f0ee]";
          const softPanel = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
          const doneStages = isDelivered ? 4 : 3;

          return (
            <div
              className={`newq fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] ${drawerClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeMrnDrawer();
              }}
              role="presentation"
            >
              <aside
                style={{ boxShadow: "var(--ui-shadow-pop)" }}
                className={`mrn-detail-shell absolute flex flex-col overflow-hidden border ${mrnDrawerExpanded ? "mrn-detail-shell-mrnDrawerExpanded" : ""} ${drawerClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}
                role="dialog"
                aria-modal="true"
                aria-label={`${selectedMrn.mrnNo || "MRN"} details`}
              >
                <header className={cx("flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-3.5", line)}>
                  <div className="flex min-w-0 items-center gap-3">
                    <IconTile icon={PackageCheck} tone="lavender" darkMode={darkMode} size="sm" />
                    <div className="min-w-0">
                      <h2 className="truncate text-[17px] tracking-[-0.01em]">{selectedMrn.mrnNo || "MRN"}</h2>
                      <p className={cx("truncate text-[12.5px]", muted)}>Material request details</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canViewMrnHistory && (
                      <Button darkMode={darkMode} variant="soft" size="sm" icon={History} onClick={() => openMrnHistory(selectedMrn)}>Version history</Button>
                    )}
                    <Button darkMode={darkMode} variant="secondary" size="sm" icon={FileText} onClick={() => printMrnDetail(selectedMrn)}>Print PDF</Button>
                    <Button darkMode={darkMode} variant="soft" size="sm" icon={mrnDrawerExpanded ? Minimize2 : Maximize2} onClick={() => setMrnDrawerExpanded((current) => !current)}>
                      {mrnDrawerExpanded ? "Restore" : "Expand"}
                    </Button>
                    <button type="button" onClick={closeMrnDrawer} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div className="grid min-h-0 flex-1 md:grid-cols-[290px_minmax(0,1fr)]">
                  <aside className={cx("min-h-0 overflow-y-auto border-b p-6 md:border-b-0 md:border-r", line)}>
                    <Badge icon={PackageCheck} tone="peach" darkMode={darkMode}>Material request</Badge>
                    <p className={cx("mt-4 text-[12.5px]", muted)}>Request #{selectedMrn.mrnNo || "-"}</p>
                    <h2 className="mt-1 text-[24px] leading-tight tracking-[-0.02em]">
                      {selectedMrn.project || "Project / site not added"}
                    </h2>
                    <p className={cx("mt-2 text-[13px] leading-5", muted)}>
                      {selectedMrn.remark || "Material requirement and purchase tracking"}
                    </p>

                    {canEdit && (
                      <Button
                        darkMode={darkMode}
                        variant="primary"
                        icon={Pencil}
                        className="mt-5 w-full"
                        onClick={() => {
                          closeMrnDrawer();
                          window.setTimeout(
                            () => openEditMrn(selectedMrn),
                            290,
                          );
                        }}
                      >
                        Edit MRN
                      </Button>
                    )}

                    <div style={{ backgroundColor: darkMode ? toneOf("amber")[2] : toneOf("amber")[0] }} className="mt-5 rounded-[20px] p-4">
                      <p className={cx("text-[12.5px]", darkMode ? "text-white/55" : "text-[#6b6b6b]")}>Quotation amount</p>
                      <div className="mt-1.5 flex items-end justify-between gap-2">
                        <span className="text-[26px] leading-none tracking-[-0.03em] tabular-nums">{money(selectedMrn.quotationAmount)}</span>
                        <Chip tone={progressTone.tone} darkMode={darkMode} className="h-6 text-[11.5px]">{selectedMrn.status || "Open"}</Chip>
                      </div>
                    </div>

                    <div className="mt-6"><SmallHeading darkMode={darkMode}>Contact details</SmallHeading></div>
                    <div className="mt-3 space-y-3">
                      <ContactRow darkMode={darkMode} icon={<span className="text-[12px]">{(selectedMrn.issuedBy || "MR").slice(0, 2).toUpperCase()}</span>} tone="rose" label="Issued by">{selectedMrn.issuedBy || "-"}</ContactRow>
                      <ContactRow darkMode={darkMode} icon={AtSign} label="Email address"><span className="break-all whitespace-normal text-[12.5px]">{selectedMrn.emailAddress || "Not added"}</span></ContactRow>
                      <ContactRow darkMode={darkMode} icon={UserRound} label="Assigned to">{selectedMrn.assignTo || "Not assigned"}</ContactRow>
                    </div>
                    <div className="mt-6"><SmallHeading darkMode={darkMode}>Vendor</SmallHeading></div>
                    <div className="mt-3"><ContactRow darkMode={darkMode} icon={Store} tone="sky" label="Vendor name">{selectedMrn.vendorName || "Not added"}</ContactRow></div>
                    <p className={cx("mt-8 text-[12px]", muted)}>
                      Last edited {editedAt.date}
                      {editedAt.time ? ` at ${editedAt.time}` : ""}
                    </p>
                  </aside>

                  <section className="min-h-0 overflow-y-auto">
                    <div className={cx("border-b px-6 py-5", line)}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                        <p>
                          <span className={muted}>Pipeline</span> Material request <span className={muted}>· Stage</span> {selectedMrn.status || "Open"}
                        </p>
                        <span className={cx("text-[12.5px] tabular-nums", muted)}>{progress}% complete</span>
                      </div>
                      <div className={cx("mt-4 grid grid-cols-4 gap-1 rounded-full p-1 text-[12px]", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
                        {MRN_STAGES.map((stage, index) => (
                          <span
                            key={stage}
                            style={index < doneStages ? { backgroundColor: darkMode ? toneOf("mint")[2] : toneOf("mint")[0], color: darkMode ? toneOf("mint")[3] : toneOf("mint")[1] } : undefined}
                            className={cx("grid h-7 place-items-center rounded-full", index >= doneStages && muted)}
                          >
                            {stage}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <ContactRow darkMode={darkMode} icon={ProgressIcon} tone={progressTone.tone} label="Current status">{progressTone.label}</ContactRow>
                        <ContactRow darkMode={darkMode} icon={Clock3} label="Lead time">{selectedMrn.leadTime || "Not specified"}</ContactRow>
                      </div>
                    </div>

                    <nav className={cx("flex gap-1 overflow-x-auto border-b px-6 py-3 text-[13px]", line)}>
                      <span className={cx("inline-flex h-8 items-center rounded-full px-3.5", darkMode ? "bg-white/10 text-white" : "bg-[#141414] text-white")}>Activity</span>
                      <span className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5", muted)}>
                        Materials
                        <span className={cx("rounded-full px-1.5 text-[11px]", darkMode ? "bg-white/10" : "bg-[#f1f1ef]")}>{items.length}</span>
                      </span>
                      <span className={cx("inline-flex h-8 items-center rounded-full px-3.5", muted)}>Files</span>
                      <span className={cx("inline-flex h-8 items-center rounded-full px-3.5", muted)}>Notes</span>
                    </nav>

                    <div className="space-y-8 p-6">
                      <section>
                        <SmallHeading darkMode={darkMode}>Latest activity</SmallHeading>
                        <div className="mt-4 space-y-4 text-[13.5px]">
                          <div className="flex gap-3">
                            <IconTile icon={CheckCircle2} tone="mint" darkMode={darkMode} size="xs" />
                            <div className="flex min-w-0 flex-1 justify-between gap-4">
                              <div>
                                <p>Material request created</p>
                                <p className={cx("mt-0.5 text-[12.5px]", muted)}>
                                  Request was submitted by {selectedMrn.issuedBy || "the project team"}.
                                </p>
                              </div>
                              <span className={cx("shrink-0 text-[12px]", muted)}>{requestedAt.date}</span>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <IconTile icon={Clock3} tone={isOverdue ? "rose" : "sky"} darkMode={darkMode} size="xs" />
                            <div className="flex min-w-0 flex-1 justify-between gap-4">
                              <div>
                                <p>Status: {selectedMrn.status || "Open"}</p>
                                <p className={cx("mt-0.5 text-[12.5px]", muted)}>
                                  {isOverdue
                                    ? "Required date has passed and this request needs attention."
                                    : "The request is progressing within its timeline."}
                                </p>
                              </div>
                              <span className={cx("shrink-0 text-[12px]", muted)}>{requiredAt.date}</span>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <SmallHeading darkMode={darkMode}>Request schedule</SmallHeading>
                        <div className={cx("mt-4 grid overflow-hidden rounded-[20px] border sm:grid-cols-[190px_1fr]", darkMode ? "border-white/10" : "border-[#ececec]")}>
                          <div className={cx("p-5", softPanel)}>
                            <p className={cx("text-[12.5px]", muted)}>{requestedAt.day || "Requested"}</p>
                            <p className="mt-1 text-[18px] tracking-[-0.01em]">{requestedAt.date}</p>
                            <p className={cx("mt-4 text-[12.5px]", muted)}>Required by</p>
                            <p className="text-[14px]">{requiredAt.date}</p>
                          </div>
                          <div className="p-5">
                            <p className="text-[14px]">Material required for {selectedMrn.project || "project"}</p>
                            <div className="mt-3 space-y-2">
                              {items.length ? (
                                items.map((item, index) => (
                                  <div key={`${item}-${index}`} className={cx("flex gap-2.5 rounded-[12px] px-3 py-2 text-[13px]", softPanel)}>
                                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f7a4f]" />
                                    {item}
                                  </div>
                                ))
                              ) : (
                                <p className={cx("text-[13px]", muted)}>No material items added.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <SmallHeading darkMode={darkMode} aside={<Chip tone={selectedMrn.quotationPhoto ? "mint" : "neutral"} darkMode={darkMode} className="h-6 text-[11.5px]">{selectedMrn.quotationPhoto ? "File available" : "No file"}</Chip>}>Quotation</SmallHeading>
                        <div className={cx("mt-4 grid gap-4 rounded-[20px] border p-5 sm:grid-cols-[1fr_auto]", darkMode ? "border-white/10" : "border-[#ececec]")}>
                          <div>
                            <p className="text-[14px]">#{selectedMrn.mrnNo || "MRN"} - {selectedMrn.project || "Material request"}</p>
                            <p className={cx("mt-3 text-[12.5px]", muted)}>Vendor</p>
                            <p className="text-[14px]">{selectedMrn.vendorName || "Not added"}</p>
                          </div>
                          <div className={cx("min-w-[150px] sm:border-l sm:pl-5", line)}>
                            <p className={cx("text-[12.5px]", muted)}>Amount</p>
                            <p className="text-[22px] tracking-[-0.02em] tabular-nums">{money(selectedMrn.quotationAmount)}</p>
                            <Chip tone="amber" darkMode={darkMode} className="mt-2 h-6 text-[11.5px]">{selectedMrn.status || "Pending"}</Chip>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <FileButton darkMode={darkMode} href={selectedMrn.mrnPhoto} label="Open MRN file" />
                          <FileButton darkMode={darkMode} href={selectedMrn.quotationPhoto} label="Open quotation file" />
                        </div>
                      </section>
                    </div>
                  </section>
                </div>

                {historyOpen && (
                  <div
                    className="absolute inset-0 z-20 flex justify-end bg-black/15 backdrop-blur-[1px]"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) setHistoryOpen(false);
                    }}
                  >
                    <section
                      style={{ boxShadow: "var(--ui-shadow-pop)" }}
                      className={cx("m-2 flex h-[calc(100%-16px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] border animate-[mrn-drawer-in_320ms_cubic-bezier(0.22,1,0.36,1)]", darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]")}
                    >
                      <div className={cx("flex items-center justify-between gap-4 border-b px-5 py-4", line)}>
                        <div className="flex min-w-0 items-center gap-3">
                          <IconTile icon={History} tone="lavender" darkMode={darkMode} size="sm" />
                          <div className="min-w-0">
                            <h3 className="truncate text-[16px] tracking-[-0.01em]">Version history</h3>
                            <p className={cx("truncate text-[12.5px]", muted)}>{selectedMrn.mrnNo || "MRN"} - tracked changes from now onward</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close history" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto p-5">
                        {historyLoading ? (
                          <div className={cx("rounded-[20px] p-8 text-center", softPanel)}>
                            <Loader2 className={cx("mx-auto h-5 w-5 animate-spin", muted)} />
                            <p className={cx("mt-3 text-[13px]", muted)}>Loading versions...</p>
                          </div>
                        ) : mrnHistory.length ? (
                          <div className="space-y-3">
                            {mrnHistory.map((entry) => (
                              <article key={entry.id} className={cx("rounded-[18px] border p-4", darkMode ? "border-white/10" : "border-[#ececec]")}>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <Chip tone="lavender" darkMode={darkMode} className="h-6 text-[11.5px]">Version {entry.version || "-"}</Chip>
                                    <h4 className="mt-2 text-[14px]">{entry.action === "added" ? "MRN created" : "MRN updated"}</h4>
                                    <p className={cx("mt-0.5 text-[12px]", muted)}>
                                      By {entry.actor || "System"} - {entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-IN") : "-"}
                                    </p>
                                  </div>
                                  <Chip tone={entry.action === "added" ? "mint" : "amber"} darkMode={darkMode} className="h-6 text-[11.5px]">{entry.action || "changed"}</Chip>
                                </div>

                                {entry.changes?.length ? (
                                  <div className="mt-4 space-y-2">
                                    {entry.changes.map((change) => (
                                      <div key={`${entry.id}-${change.key}`} className={cx("rounded-[14px] p-3 text-[12.5px]", softPanel)}>
                                        <p>{change.label}</p>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                          <div>
                                            <span className={muted}>Before</span>
                                            <p className="mt-0.5 break-words text-[13px]">{change.before || "Blank"}</p>
                                          </div>
                                          <div>
                                            <span className={muted}>After</span>
                                            <p className={cx("mt-0.5 break-words text-[13px]", darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]")}>{change.after || "Blank"}</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className={cx("mt-4 rounded-[14px] p-3 text-[12.5px]", softPanel, muted)}>
                                    Initial saved version. Future edits will show field-by-field changes here.
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            darkMode={darkMode}
                            icon={History}
                            tone="lavender"
                            title="No stored versions yet"
                            text={`History tracking is active now. The next MRN add or edit will create a version entry. Current: ${selectedMrn.project || "Project not added"} - ${selectedMrn.status || "Open"} - ${items.length} material item${items.length === 1 ? "" : "s"}.`}
                          />
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
        <div className="newq fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <div
            style={{ boxShadow: "var(--ui-shadow-pop)" }}
            className={cx("ui-pop max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-[24px] border p-6", darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]")}
          >
            <div className="flex items-start justify-between gap-3">
              <Badge icon={Tag} tone="mint" darkMode={darkMode}>MRN setup</Badge>
              <button type="button" aria-label="Close" onClick={() => setSettingsOpen(false)} className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <SectionTitle darkMode={darkMode} className="mt-4" title="Link workspace sources" subtitle="the sheet and the upload folder" />

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2">
                <span className={cx("flex items-center gap-2.5 text-[13px]", muted)}>
                  <Image src="/gsheet-icon.png" alt="Google Sheets" width={20} height={20} className="h-5 w-5" />
                  Google Sheet
                  <Chip tone={sheetLink.trim() || settings.spreadsheetId ? "mint" : "neutral"} darkMode={darkMode} className="h-6 text-[11.5px]">
                    {sheetLink.trim() || settings.spreadsheetId ? "Connected" : "Required"}
                  </Chip>
                </span>
                <input
                  value={sheetLink}
                  onChange={(event) => setSheetLink(event.target.value)}
                  placeholder={settings.spreadsheetId || "Paste MRN Google Sheet link or ID"}
                  className={fieldClass(darkMode, { size: "lg" })}
                />
              </label>

              <label className="grid gap-2">
                <span className={cx("flex items-center gap-2.5 text-[13px]", muted)}>
                  <Image src="/drive.svg" alt="Google Drive" width={20} height={20} className="h-5 w-5" />
                  Drive folder
                  <Chip tone={folderLink.trim() || settings.driveFolderId ? "mint" : "neutral"} darkMode={darkMode} className="h-6 text-[11.5px]">
                    {folderLink.trim() || settings.driveFolderId ? "Connected" : "Shared Drive required"}
                  </Chip>
                </span>
                <input
                  value={folderLink}
                  onChange={(event) => setFolderLink(event.target.value)}
                  placeholder={settings.driveFolderId || "Paste Shared Drive folder link or ID"}
                  className={fieldClass(darkMode, { size: "lg" })}
                />
                <span className={cx("text-[12px]", muted)}>
                  Uploads require a folder inside a Google Shared Drive shared with the service account.
                </span>
              </label>
            </div>

            <div className={cx("mt-6 flex flex-col gap-4 rounded-[16px] p-4 sm:flex-row sm:items-center sm:justify-between", darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]")}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={cx("h-5 w-5 shrink-0", sheetLink.trim() || settings.spreadsheetId ? "text-[#2f7a4f]" : muted)} />
                <div>
                  <p className="text-[13.5px]">Ready to save</p>
                  <p className={cx("text-[12px]", muted)}>Existing MRNs will stay untouched.</p>
                </div>
              </div>
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={Save}
                loading={savingSettings}
                disabled={savingSettings || (!sheetLink.trim() && !folderLink.trim())}
                onClick={saveSettings}
              >
                Save links
              </Button>
            </div>
          </div>
        </div>
      )}

      {whatsappOpen && (
        <MrnWhatsappAutomationDrawer darkMode={darkMode} onClose={() => setWhatsappOpen(false)} />
      )}

      {addOpen && (
        <div
          className="newq fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAddOpen(false);
              setEditingMrn(null);
            }
          }}
        >
          <div
            style={{ boxShadow: "var(--ui-shadow-pop)" }}
            className={cx("absolute inset-y-0 right-0 flex h-full w-full max-w-[940px] flex-col overflow-hidden border-l animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100%-20px)] sm:w-[min(88vw,940px)] sm:rounded-[24px] sm:border", darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]")}
          >
            <div className={cx("flex items-center justify-between gap-4 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={PackageCheck} tone="lavender" darkMode={darkMode} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate text-[17px] tracking-[-0.01em]">
                    {editingMrn ? `Edit ${editingMrn.mrnNo}` : "Create new MRN"}
                  </h3>
                  <p className={cx("truncate text-[12.5px]", muted)}>Material request</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setAddOpen(false);
                  setEditingMrn(null);
                }}
                className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className={cx("mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] p-5", darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]")}>
                <div className="min-w-0">
                  <p className={cx("text-[12.5px]", muted)}>Request overview</p>
                  <p className="mt-0.5 text-[18px] tracking-[-0.01em]">
                    {form.projectSite || "New material request"}
                  </p>
                  <p className={cx("mt-0.5 text-[12.5px]", muted)}>
                    {editingMrn
                      ? "Update the linked MRN sheet record."
                      : "Complete the details below to submit a new request."}
                  </p>
                </div>
                <Chip
                  tone={daysBetweenDates(form.materialRequestDate, form.requiredDate) < 0 ? "rose" : "lime"}
                  darkMode={darkMode}
                  icon={CalendarDays}
                >
                  {daysBetweenDates(
                    form.materialRequestDate,
                    form.requiredDate,
                  ) === null
                    ? "Select dates"
                    : `${daysBetweenDates(form.materialRequestDate, form.requiredDate)} day${Math.abs(daysBetweenDates(form.materialRequestDate, form.requiredDate)) === 1 ? "" : "s"}`}
                </Chip>
              </div>
              <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <FormLabel darkMode={darkMode}>Name of project and site address *</FormLabel>
                  <input
                    value={form.projectSite}
                    onChange={(e) =>
                      setForm({ ...form, projectSite: e.target.value })
                    }
                    placeholder="Example: Kalhaar bungalow, Royal Orchid..."
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Material request date *</FormLabel>
                  <DatePicker
                    darkMode={darkMode}
                    size="lg"
                    value={form.materialRequestDate}
                    onChange={(value) =>
                      setForm({ ...form, materialRequestDate: value })
                    }
                    placeholder="Request date"
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>By when material is required *</FormLabel>
                  <DatePicker
                    darkMode={darkMode}
                    size="lg"
                    value={form.requiredDate}
                    onChange={(value) =>
                      setForm({ ...form, requiredDate: value })
                    }
                    placeholder="Required date"
                  />
                </label>
                <div className={cx("rounded-[20px] border p-5 md:col-span-2", darkMode ? "border-white/10" : "border-[#ececec]")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <IconTile icon={PackageCheck} tone="peach" darkMode={darkMode} size="sm" />
                      <div>
                        <p className="text-[14px]">Material requirement *</p>
                        <p className={cx("text-[12.5px]", muted)}>Add one material item at a time.</p>
                      </div>
                    </div>
                    <Chip tone="neutral" darkMode={darkMode} className="h-6 text-[11.5px]">
                      {materialItems(form.materialRequirement).length} items
                    </Chip>
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
                      className={cx(fieldClass(darkMode, { size: "lg" }), "flex-1")}
                    />
                    <Button darkMode={darkMode} variant="primary" size="lg" icon={Plus} onClick={addMaterialLine}>
                      Add item
                    </Button>
                  </div>
                  {materialItems(form.materialRequirement).length > 0 && (
                    <div className="mt-3 grid gap-1.5">
                      {materialItems(form.materialRequirement).map(
                        (item, index) => (
                          <div
                            key={`${item}-${index}`}
                            className={cx("flex items-center justify-between gap-3 rounded-[14px] py-2 pl-4 pr-2 text-[13.5px]", darkMode ? "bg-white/[0.04] text-white/85" : "bg-[#f7f7f5] text-[#3d3d3b]")}
                          >
                            <span>{item}</span>
                            <button
                              type="button"
                              aria-label="Remove item"
                              onClick={() => removeMaterialLine(index)}
                              className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] text-white/60 hover:bg-white/10" : "bg-white text-[#8a8a8a] hover:text-[#141414]")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Issued by</FormLabel>
                  <input
                    value={form.issuedBy}
                    onChange={(e) =>
                      setForm({ ...form, issuedBy: e.target.value })
                    }
                    placeholder="Example: Atul Mevada"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Lead time</FormLabel>
                  <input
                    value={form.leadTime}
                    onChange={(e) =>
                      setForm({ ...form, leadTime: e.target.value })
                    }
                    placeholder="Example: 1 day"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Quotation amount</FormLabel>
                  <input
                    type="number"
                    value={form.quotationAmount}
                    onChange={(e) =>
                      setForm({ ...form, quotationAmount: e.target.value })
                    }
                    placeholder="Example: 25000"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Email address</FormLabel>
                  <input
                    type="email"
                    value={form.emailAddress}
                    onChange={(e) =>
                      setForm({ ...form, emailAddress: e.target.value })
                    }
                    placeholder="name@example.com"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Assign to</FormLabel>
                  <input
                    value={form.assignTo}
                    onChange={(e) =>
                      setForm({ ...form, assignTo: e.target.value })
                    }
                    placeholder="Example: Vivek"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Status</FormLabel>
                  <input
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    placeholder="Example: Open / Delivered"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Krishna PRN status updated</FormLabel>
                  <input
                    value={form.krishnaPrnStatusUpdated}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        krishnaPrnStatusUpdated: e.target.value,
                      })
                    }
                    placeholder="Example: Updated / Pending"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Vendor name</FormLabel>
                  <input
                    value={form.vendorName}
                    onChange={(e) =>
                      setForm({ ...form, vendorName: e.target.value })
                    }
                    placeholder="Example: ABC Traders"
                    className={fieldClass(darkMode, { size: "lg" })}
                  />
                </label>
                <label className="block">
                  <FormLabel darkMode={darkMode}>Invoice date</FormLabel>
                  <DatePicker
                    darkMode={darkMode}
                    size="lg"
                    value={form.invoiceDate}
                    onChange={(value) =>
                      setForm({ ...form, invoiceDate: value })
                    }
                    placeholder="Invoice date"
                  />
                </label>
                <label className="block md:col-span-2">
                  <FormLabel darkMode={darkMode}>Remark</FormLabel>
                  <textarea
                    value={form.remark}
                    onChange={(e) =>
                      setForm({ ...form, remark: e.target.value })
                    }
                    placeholder="Add any purchase, delivery, or vendor note..."
                    rows={3}
                    className={cx("w-full rounded-[16px] border px-4 py-3 text-[13.5px] outline-none transition", darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]")}
                  />
                </label>
                <label
                  className={cx("block cursor-pointer rounded-[20px] border border-dashed p-4 transition-colors", darkMode ? "border-white/15 hover:bg-white/[0.03]" : "border-[#dcdcd8] hover:bg-[#fafaf9]")}
                >
                  <span className="flex items-center gap-3">
                    <IconTile icon={Upload} tone="sky" darkMode={darkMode} size="md" />
                    <span className="min-w-0">
                      <span className="block text-[14px]">Upload MRN file</span>
                      <span className={cx("block truncate text-[12.5px]", muted)}>
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
                  className={cx("block cursor-pointer rounded-[20px] border border-dashed p-4 transition-colors", darkMode ? "border-white/15 hover:bg-white/[0.03]" : "border-[#dcdcd8] hover:bg-[#fafaf9]")}
                >
                  <span className="flex items-center gap-3">
                    <IconTile icon={FileSpreadsheet} tone="amber" darkMode={darkMode} size="md" />
                    <span className="min-w-0">
                      <span className="block text-[14px]">Upload quotation</span>
                      <span className={cx("block truncate text-[12.5px]", muted)}>
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
            <div className={cx("flex justify-end gap-2 border-t px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
              <Button
                darkMode={darkMode}
                variant="secondary"
                onClick={() => {
                  setAddOpen(false);
                  setEditingMrn(null);
                }}
              >
                Cancel
              </Button>
              <Button darkMode={darkMode} variant="primary" icon={Save} loading={saving} disabled={saving} onClick={saveMrn}>
                {editingMrn ? "Update MRN" : "Save MRN"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
