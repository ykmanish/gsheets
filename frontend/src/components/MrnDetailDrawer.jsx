"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

function money(value) {
  const amount = Number(String(value || "").replace(/,/g, "")) || 0;
  return amount ? `Rs ${amount.toLocaleString("en-IN")}` : "Rs 0";
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
  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join("");
  const detail = (label, value) =>
    `<div class="detail"><span>${safe(label)}</span><strong>${safe(value || "Not added")}</strong></div>`;
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(row.mrnNo || "MRN")} - Material Request</title>${styles}<style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#171714;font-family:Geist,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{max-width:794px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #171714;padding-bottom:18px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.16em;color:#4b9b16;text-transform:uppercase}.title{font-size:29px;line-height:1.1;margin:7px 0 5px;font-weight:800}.muted{color:#777;font-size:11px;line-height:1.5}.mrn{background:#eafbdc;color:#3f7d16;padding:9px 12px;border-radius:8px;font-size:12px;font-weight:800}.statusbar{margin:18px 0;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border-radius:20px;background:#f0f1ed}.statusbar span{padding:8px;text-align:center;font-size:9px;font-weight:800}.statusbar .done{background:#8de1dc}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #dedfd9;border-radius:13px;padding:16px;break-inside:avoid}.card h2{font-size:14px;margin:0 0 12px}.detail{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #ecece8;font-size:10px}.detail:last-child{border:0}.detail span{color:#777}.detail strong{text-align:right;font-size:11px}.materials{grid-column:1/-1}.item{display:flex;gap:9px;padding:8px 10px;margin-top:6px;background:#f7f8f4;border-radius:8px;font-size:11px}.dot{width:6px;height:6px;margin-top:4px;border-radius:50%;background:#69c832;flex:none}.amount{font-size:25px;font-weight:800;margin-top:4px}.note{grid-column:1/-1;background:#f7f8f4}.footer{display:flex;justify-content:space-between;margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#888}@media print{.page{max-width:none}}
  </style></head><body class="newq"><main class="page"><header class="top"><div><div class="eyebrow">Material request note</div><h1 class="title">${safe(row.project || "Project / site not added")}</h1><p class="muted">Issued by ${safe(row.issuedBy || "Not added")} - Required ${safe(required.date)}</p></div><div class="mrn">${safe(row.mrnNo || "MRN")}</div></header><div class="statusbar"><span class="done">Requested</span><span class="done">Assigned</span><span class="done">Quoted</span><span>${safe(row.status || "Open")}</span></div><section class="grid"><article class="card"><h2>Request schedule</h2>${detail("Requested", requested.date)}${detail("Required by", required.date)}${detail("Lead time", row.leadTime)}${detail("Status", row.status || "Open")}</article><article class="card"><h2>Ownership & contact</h2>${detail("Issued by", row.issuedBy)}${detail("Assigned to", row.assignTo)}${detail("Email", row.emailAddress)}${detail("Vendor", row.vendorName)}</article><article class="card materials"><h2>Material requirement - ${items.length} item${items.length === 1 ? "" : "s"}</h2>${items.length ? items.map((item) => `<div class="item"><i class="dot"></i><span>${safe(item)}</span></div>`).join("") : '<p class="muted">No material items added.</p>'}</article><article class="card"><h2>Quotation</h2><p class="muted">Quotation amount</p><div class="amount">${safe(money(row.quotationAmount))}</div>${detail("Invoice date", row.invoiceDate)}${detail("PRN status", row.krishnaPrnStatusUpdated)}</article><article class="card"><h2>Documents</h2>${detail("MRN file", row.mrnPhoto ? "Available" : "Not added")}${detail("Quotation file", row.quotationPhoto ? "Available" : "Not added")}</article>${row.remark ? `<article class="card note"><h2>Remarks</h2><p class="muted">${safe(row.remark)}</p></article>` : ""}</section><footer class="footer"><span>Generated from MRN Workspace</span><span>${safe(new Date().toLocaleString("en-IN"))}</span></footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`);
  printWindow.document.close();
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

export default function MrnDetailDrawer({
  darkMode,
  row,
  canEdit = false,
  canViewHistory = false,
  onClose,
  onEdit,
  onLoadHistory,
}) {
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const nowMs = useMemo(() => Date.now(), [row?.id, row?.mrnNo]);
  const muted = darkMode ? "text-white/45" : "text-black/48";

  useEffect(() => {
    setClosing(false);
    setExpanded(false);
    setHistoryOpen(false);
    setHistory([]);
  }, [row?.id, row?.mrnNo]);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 280);
  }, [closing, onClose]);

  useEffect(() => {
    if (!row) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [requestClose, row]);

  async function openHistory() {
    if (!row?.mrnNo || !onLoadHistory) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await onLoadHistory(row);
      setHistory(result.history || []);
    } catch (error) {
      toast.error(error.message || "Could not load MRN history");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  if (!row) return null;

  const requestedAt = formatMrnDateTime(row.materialRequestDate || row.date || row.timestamp);
  const requiredAt = formatMrnDateTime(row.requiredDate);
  const editedAt = formatMrnDateTime(row.lastEdited || row.timestamp || row.date);
  const isDelivered = deliveredStatus(row.status);
  const requiredEnd = endOfDate(parseMrnDate(row.requiredDate));
  const isOverdue = !isDelivered && requiredEnd && requiredEnd.getTime() < nowMs;
  const progress = isDelivered
    ? 100
    : Math.max(
        row.status ? 35 : 20,
        dateProgressPercent(row.materialRequestDate || row.date, row.requiredDate, nowMs),
      );
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
          soft: darkMode ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-700",
          label: "Delayed",
          icon: AlertTriangle,
        }
      : {
          bar: "bg-[#27a8f2]",
          text: "text-[#168bd0]",
          soft: darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700",
          label: "On track",
          icon: Clock3,
        };
  const ProgressIcon = progressTone.icon;
  const items = materialItems(row.materialRequirement);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] ${closing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      role="presentation"
    >
      <aside
        className={`mrn-detail-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${expanded ? "mrn-detail-shell-expanded" : ""} ${closing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${row.mrnNo || "MRN"} details`}
      >
        <header
          className={`flex h-12 shrink-0 items-center justify-between border-b px-4 text-xs ${darkMode ? "border-white/10" : "border-black/10"}`}
        >
          <span>
            <b>{row.mrnNo || "MRN"}</b> - Material request details
          </span>
          <div className="flex items-center gap-2">
            {canViewHistory && onLoadHistory && (
              <button
                onClick={openHistory}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f3f7ef] text-[#3f7d16] hover:bg-[#eafbdc]"}`}
              >
                <History className="h-3.5 w-3.5" />
                Version History
              </button>
            )}
            <button
              onClick={() => printMrnDetail(row)}
              className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 font-semibold text-white shadow-[0_10px_24px_rgba(239,68,68,0.22)] transition hover:bg-red-600"
            >
              <FileText className="h-3.5 w-3.5" />
              Print PDF
            </button>
            <button
              onClick={() => setExpanded((current) => !current)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold transition ${darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#eafbdc] text-[#3f7d16] hover:bg-[#ddf8c9]"}`}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {expanded ? "Restore" : "Expand"}
            </button>
            <button
              onClick={requestClose}
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
            <p className={`mt-4 text-xs ${muted}`}>Request #{row.mrnNo || "-"}</p>
            <h2 className="mt-1 text-2xl font-bold small dark:text-white text-black">
              {row.project || "Project / site not added"}
            </h2>
            <p className={`mt-2 text-xs leading-5 ${muted}`}>
              {row.remark || "Material requirement and purchase tracking"}
            </p>

            <div className="mt-5 flex gap-2">
              {canEdit && onEdit && (
                <button
                  onClick={() => {
                    requestClose();
                    window.setTimeout(() => onEdit(row), 290);
                  }}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#89ed3f] text-sm font-semibold text-black"
                >
                  <Pencil className="h-4 w-4" /> Edit MRN
                </button>
              )}
            </div>

            <div
              className={`mt-5 rounded-xl p-4 ${darkMode ? "bg-white/[0.05]" : "bg-[#f5f5f1]"}`}
            >
              <p className={`text-xs ${muted}`}>Quotation amount</p>
              <div className="mt-1 flex items-end justify-between">
                <strong className="text-2xl">{money(row.quotationAmount)}</strong>
                <span className={`text-xs font-semibold ${progressTone.text}`}>
                  {row.status || "Open"}
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
                  {(row.issuedBy || "MR").slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className={`text-[11px] ${muted}`}>Issued by</p>
                  <p className="font-semibold">{row.issuedBy || "-"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "bg-white/5" : "bg-[#f4f4ef]"}`}
                >
                  @
                </span>
                <div className="min-w-0">
                  <p className={`text-[11px] ${muted}`}>Email Address</p>
                  <p className="break-all text-xs font-semibold">
                    {row.emailAddress || "Not added"}
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
                  <p className="font-semibold">{row.assignTo || "Not assigned"}</p>
                </div>
              </div>
            </div>
            <h3
              className={`mt-6 border-b pb-3 text-sm font-bold ${darkMode ? "border-white/10" : "border-black/10"}`}
            >
              Vendor
            </h3>
            <p className="mt-4 text-sm font-semibold">
              {row.vendorName || "Not added"}
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
                  <b>{row.status || "Open"}</b>
                </p>
                <span className={`text-xs ${muted}`}>{progress}% complete</span>
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
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${progressTone.soft}`}>
                    <ProgressIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className={`text-xs ${muted}`}>Current status</p>
                    <p className="text-sm font-semibold">{progressTone.label}</p>
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
                      {row.leadTime || "Not specified"}
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
                        <p className="font-semibold">Material request created</p>
                        <p className={`mt-1 text-xs ${muted}`}>
                          Request was submitted by {row.issuedBy || "the project team"}.
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
                        <p className="font-semibold">Status: {row.status || "Open"}</p>
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
                  <div className={`p-4 ${darkMode ? "bg-white/[0.03]" : "bg-[#fafaf7]"}`}>
                    <p className="text-xs font-semibold text-[#4b9b16]">
                      {requestedAt.day || "Requested"}
                    </p>
                    <p className="mt-1 text-lg font-bold">{requestedAt.date}</p>
                    <p className={`mt-3 text-xs ${muted}`}>
                      Required by
                      <br />
                      <b>{requiredAt.date}</b>
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold">
                      Material required for {row.project || "project"}
                    </p>
                    <div className="mt-3 space-y-2">
                      {items.length ? (
                        items.map((item, index) => (
                          <div key={`${item}-${index}`} className="flex gap-2 text-sm">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#69c832]" />
                            {item}
                          </div>
                        ))
                      ) : (
                        <p className={`text-sm ${muted}`}>No material items added.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Quotation</h3>
                  <span className="text-xs font-semibold text-[#4b9b16]">
                    {row.quotationPhoto ? "File available" : "No file"}
                  </span>
                </div>
                <div
                  className={`mt-4 grid gap-4 rounded-xl border p-4 sm:grid-cols-[1fr_auto] ${darkMode ? "border-white/10" : "border-black/10"}`}
                >
                  <div>
                    <p className="text-sm font-semibold">
                      #{row.mrnNo || "MRN"} - {row.project || "Material request"}
                    </p>
                    <p className={`mt-3 text-xs ${muted}`}>Vendor</p>
                    <p className="text-sm font-semibold">
                      {row.vendorName || "Not added"}
                    </p>
                  </div>
                  <div className="min-w-[150px] sm:border-l sm:pl-5">
                    <p className={`text-xs ${muted}`}>Amount</p>
                    <p className="text-xl font-bold">{money(row.quotationAmount)}</p>
                    <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                      {row.status || "PENDING"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <FileButton darkMode={darkMode} href={row.mrnPhoto} label="Open MRN file" />
                  <FileButton darkMode={darkMode} href={row.quotationPhoto} label="Open quotation file" />
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
                  <h3 className="mt-2 text-2xl font-bold small">Version history</h3>
                  <p className={`mt-1 text-sm ${muted}`}>
                    {row.mrnNo || "MRN"} - tracked changes from now onward.
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
                  <div className={`rounded-3xl p-8 text-center ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#4b9b16]" />
                    <p className={`mt-3 text-sm ${muted}`}>Loading versions...</p>
                  </div>
                ) : history.length ? (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <article
                        key={entry.id}
                        className={`rounded-3xl p-4 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-white"}`}
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
                              By {entry.actor || "System"} - {entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-IN") : "-"}
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
                                <p>{change.label}</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <span className={muted}>Before</span>
                                    <p className="mt-1 break-words text-sm">
                                      {change.before || "Blank"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className={muted}>After</span>
                                    <p className="mt-1 break-words text-sm text-green-400">
                                      {change.after || "Blank"}
                                    </p>
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
                  <div className={`rounded-3xl p-6 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white"}`}>
                    <p className="text-sm font-semibold">No stored versions yet.</p>
                    <p className={`mt-2 text-sm leading-6 ${muted}`}>
                      History tracking is active now. The next MRN add/edit will create a version entry with changed fields.
                    </p>
                    <div className={`mt-4 rounded-2xl p-4 text-xs ${darkMode ? "bg-black/20" : "bg-[#f5f7f2]"}`}>
                      <p>Current snapshot</p>
                      <p className={`mt-1 ${muted}`}>
                        {row.project || "Project not added"} - {row.status || "Open"} - {items.length} material item{items.length === 1 ? "" : "s"}
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
}
