"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  PackageCheck,
  Pencil,
  Store,
  UserRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Chip, EmptyState, IconTile, cx, toneOf } from "./ui";

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

// Shared look for the detail drawer pieces (also used by MrnDashboard's inline drawer markup).
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
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";

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
        label: "Delivered in time", tone: "mint",
        icon: CheckCircle2,
      }
    : isOverdue
      ? {
          bar: "bg-red-500",
          text: "text-red-600",
          soft: darkMode ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-700",
          label: "Delayed", tone: "rose",
          icon: AlertTriangle,
        }
      : {
          bar: "bg-[#27a8f2]",
          text: "text-[#168bd0]",
          soft: darkMode ? "bg-blue-400/10 text-blue-200" : "bg-blue-50 text-blue-700",
          label: "On track", tone: "sky",
          icon: Clock3,
        };
  const ProgressIcon = progressTone.icon;
  const items = materialItems(row.materialRequirement);

  const line = darkMode ? "border-white/10" : "border-[#f0f0ee]";
  const softPanel = darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]";
  const doneStages = isDelivered ? 4 : 3;

  return (
    <div
      className={`newq fixed inset-0 z-[120] bg-black/20 backdrop-blur-[2px] ${closing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      role="presentation"
    >
      <aside
        style={{ boxShadow: "var(--ui-shadow-pop)" }}
        className={`mrn-detail-shell absolute flex flex-col overflow-hidden border ${expanded ? "mrn-detail-shell-expanded" : ""} ${closing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${row.mrnNo || "MRN"} details`}
      >
        <header className={cx("flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-3.5", line)}>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={PackageCheck} tone="lavender" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-[17px] tracking-[-0.01em]">{row.mrnNo || "MRN"}</h2>
              <p className={cx("truncate text-[12.5px]", muted)}>Material request details</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewHistory && onLoadHistory && (
              <Button darkMode={darkMode} variant="soft" size="sm" icon={History} onClick={openHistory}>Version history</Button>
            )}
            <Button darkMode={darkMode} variant="secondary" size="sm" icon={FileText} onClick={() => printMrnDetail(row)}>Print PDF</Button>
            <Button darkMode={darkMode} variant="soft" size="sm" icon={expanded ? Minimize2 : Maximize2} onClick={() => setExpanded((current) => !current)}>
              {expanded ? "Restore" : "Expand"}
            </Button>
            <button type="button" onClick={requestClose} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[290px_minmax(0,1fr)]">
          <aside className={cx("min-h-0 overflow-y-auto border-b p-6 md:border-b-0 md:border-r", line)}>
            <Badge icon={PackageCheck} tone="peach" darkMode={darkMode}>Material request</Badge>
            <p className={cx("mt-4 text-[12.5px]", muted)}>Request #{row.mrnNo || "-"}</p>
            <h2 className="mt-1 text-[24px] leading-tight tracking-[-0.02em]">
              {row.project || "Project / site not added"}
            </h2>
            <p className={cx("mt-2 text-[13px] leading-5", muted)}>
              {row.remark || "Material requirement and purchase tracking"}
            </p>

            {canEdit && onEdit && (
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={Pencil}
                className="mt-5 w-full"
                onClick={() => {
                  requestClose();
                  window.setTimeout(() => onEdit(row), 290);
                }}
              >
                Edit MRN
              </Button>
            )}

            <div style={{ backgroundColor: darkMode ? toneOf("amber")[2] : toneOf("amber")[0] }} className="mt-5 rounded-[20px] p-4">
              <p className={cx("text-[12.5px]", darkMode ? "text-white/55" : "text-[#6b6b6b]")}>Quotation amount</p>
              <div className="mt-1.5 flex items-end justify-between gap-2">
                <span className="text-[26px] leading-none tracking-[-0.03em] tabular-nums">{money(row.quotationAmount)}</span>
                <Chip tone={progressTone.tone} darkMode={darkMode} className="h-6 text-[11.5px]">{row.status || "Open"}</Chip>
              </div>
            </div>

            <div className="mt-6"><SmallHeading darkMode={darkMode}>Contact details</SmallHeading></div>
            <div className="mt-3 space-y-3">
              <ContactRow darkMode={darkMode} icon={<span className="text-[12px]">{(row.issuedBy || "MR").slice(0, 2).toUpperCase()}</span>} tone="rose" label="Issued by">{row.issuedBy || "-"}</ContactRow>
              <ContactRow darkMode={darkMode} icon={AtSign} label="Email address"><span className="break-all whitespace-normal text-[12.5px]">{row.emailAddress || "Not added"}</span></ContactRow>
              <ContactRow darkMode={darkMode} icon={UserRound} label="Assigned to">{row.assignTo || "Not assigned"}</ContactRow>
            </div>
            <div className="mt-6"><SmallHeading darkMode={darkMode}>Vendor</SmallHeading></div>
            <div className="mt-3"><ContactRow darkMode={darkMode} icon={Store} tone="sky" label="Vendor name">{row.vendorName || "Not added"}</ContactRow></div>
            <p className={cx("mt-8 text-[12px]", muted)}>
              Last edited {editedAt.date}
              {editedAt.time ? ` at ${editedAt.time}` : ""}
            </p>
          </aside>

          <section className="min-h-0 overflow-y-auto">
            <div className={cx("border-b px-6 py-5", line)}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                <p>
                  <span className={muted}>Pipeline</span> Material request <span className={muted}>· Stage</span> {row.status || "Open"}
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
                <ContactRow darkMode={darkMode} icon={Clock3} label="Lead time">{row.leadTime || "Not specified"}</ContactRow>
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
                          Request was submitted by {row.issuedBy || "the project team"}.
                        </p>
                      </div>
                      <span className={cx("shrink-0 text-[12px]", muted)}>{requestedAt.date}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <IconTile icon={Clock3} tone={isOverdue ? "rose" : "sky"} darkMode={darkMode} size="xs" />
                    <div className="flex min-w-0 flex-1 justify-between gap-4">
                      <div>
                        <p>Status: {row.status || "Open"}</p>
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
                    <p className="text-[14px]">Material required for {row.project || "project"}</p>
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
                <SmallHeading darkMode={darkMode} aside={<Chip tone={row.quotationPhoto ? "mint" : "neutral"} darkMode={darkMode} className="h-6 text-[11.5px]">{row.quotationPhoto ? "File available" : "No file"}</Chip>}>Quotation</SmallHeading>
                <div className={cx("mt-4 grid gap-4 rounded-[20px] border p-5 sm:grid-cols-[1fr_auto]", darkMode ? "border-white/10" : "border-[#ececec]")}>
                  <div>
                    <p className="text-[14px]">#{row.mrnNo || "MRN"} - {row.project || "Material request"}</p>
                    <p className={cx("mt-3 text-[12.5px]", muted)}>Vendor</p>
                    <p className="text-[14px]">{row.vendorName || "Not added"}</p>
                  </div>
                  <div className={cx("min-w-[150px] sm:border-l sm:pl-5", line)}>
                    <p className={cx("text-[12.5px]", muted)}>Amount</p>
                    <p className="text-[22px] tracking-[-0.02em] tabular-nums">{money(row.quotationAmount)}</p>
                    <Chip tone="amber" darkMode={darkMode} className="mt-2 h-6 text-[11.5px]">{row.status || "Pending"}</Chip>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <FileButton darkMode={darkMode} href={row.mrnPhoto} label="Open MRN file" />
                  <FileButton darkMode={darkMode} href={row.quotationPhoto} label="Open quotation file" />
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
                    <p className={cx("truncate text-[12.5px]", muted)}>{row.mrnNo || "MRN"} - tracked changes from now onward</p>
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
                ) : history.length ? (
                  <div className="space-y-3">
                    {history.map((entry) => (
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
                    text={`History tracking is active now. The next MRN add or edit will create a version entry. Current: ${row.project || "Project not added"} - ${row.status || "Open"} - ${items.length} material item${items.length === 1 ? "" : "s"}.`}
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
