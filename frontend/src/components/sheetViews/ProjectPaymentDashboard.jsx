import { ArrowUpRight, Banknote, Building2, CalendarDays, CheckCircle2, ClipboardCheck, CreditCard, FileText, ReceiptText, Table2, UserRound } from "lucide-react";
import { isWithinDateRange, money, parseAmount } from "./amountUtils";

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

function cleanValue(value) {
  const text = String(value ?? "").trim();
  return text && !/^na$/i.test(text) ? text : "";
}

function extractUrls(value) {
  return String(value ?? "").match(/https?:\/\/[^\s,]+/g) || [];
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countBy(rows, column) {
  if (!column) return [];
  const counts = {};
  rows.forEach((row) => {
    const label = cleanValue(row[column]) || "Blank";
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function sumBy(rows, groupColumn, valueColumn) {
  const totals = {};
  rows.forEach((row) => {
    const label = cleanValue(row[groupColumn]) || "Blank";
    totals[label] = (totals[label] || 0) + parseAmount(row[valueColumn]);
  });
  return Object.entries(totals).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function Metric({ darkMode, icon: Icon, label, value, accent }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] p-5 ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <p className={`mt-4 text-2xl font-semibold sm:text-3xl ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
    </div>
  );
}

function Bars({ darkMode, title, data, valueFormatter = (value) => value }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  const muted = darkMode ? "text-white/45" : "text-black/40";

  return (
    <div className={`rounded-[22px] p-5 ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
      <h3 className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className={`truncate ${darkMode ? "text-white/65" : "text-black/55"}`}>{item.label}</span>
              <span className={muted}>{valueFormatter(item.value)}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/8" : "bg-black/5"}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(7, (item.value / max) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className={`text-sm ${muted}`}>No data yet.</p>}
      </div>
    </div>
  );
}

export default function ProjectPaymentDashboard({ darkMode, currentSheet, searchQuery, dateRange = {} }) {
  const muted = darkMode ? "text-white/50" : "text-black/45";
  const headers = currentSheet?.headers || [];
  const query = searchQuery.trim().toLowerCase();
  const rows = (currentSheet?.rows || []).filter((row) => {
    const matchesQuery = !query || headers.some((header) => String(row[header] ?? "").toLowerCase().includes(query));
    return matchesQuery && isWithinDateRange(row.Timestamp, dateRange);
  });
  const sortedRows = [...rows].sort((a, b) => (parseDate(b.Timestamp)?.getTime() || 0) - (parseDate(a.Timestamp)?.getTime() || 0));
  const totalAmount = rows.reduce((sum, row) => sum + parseAmount(row.Amount), 0);
  const paidCount = rows.filter((row) => /done|paid|complete/i.test(cleanValue(row.Payment))).length;
  const approvedCount = rows.filter((row) => /approved/i.test(cleanValue(row.Approved))).length;
  const attachmentCount = rows.reduce((sum, row) => sum + extractUrls(row["Supportive Documents"]).length + extractUrls(row["Tax Invoice"]).length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric darkMode={darkMode} icon={ReceiptText} label={query ? "Matching requests" : "Requests"} value={rows.length.toLocaleString()} accent="#22c55e" />
        <Metric darkMode={darkMode} icon={Banknote} label="Total amount" value={money(totalAmount)} accent="#3b82f6" />
        <Metric darkMode={darkMode} icon={CheckCircle2} label="Approved" value={approvedCount.toLocaleString()} accent="#f59e0b" />
        <Metric darkMode={darkMode} icon={CreditCard} label="Paid / done" value={paidCount.toLocaleString()} accent="#ef4444" />
        <Metric darkMode={darkMode} icon={FileText} label="Attachments" value={attachmentCount.toLocaleString()} accent="#a855f7" />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Bars darkMode={darkMode} title="Amount by project/site" data={sumBy(rows, "Project/Site Name", "Amount")} valueFormatter={money} />
        <Bars darkMode={darkMode} title="Amount by payment type" data={sumBy(rows, "Type of Payment", "Amount")} valueFormatter={money} />
        <Bars darkMode={darkMode} title="Approval status" data={countBy(rows, "Approved")} />
        <Bars darkMode={darkMode} title="Payment status" data={countBy(rows, "Payment")} />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        {sortedRows.map((row) => {
          const attachments = [...extractUrls(row["Supportive Documents"]), ...extractUrls(row["Tax Invoice"])];
          return (
            <article key={`${row.__sheetName}-${row.__rowIndex}`} className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.04] border border-white/10" : "bg-white border border-black/5"}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={`text-xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>{cleanValue(row["Column 13"]) || "Project payment"}</p>
                  <p className={`mt-1 text-sm ${muted}`}>{cleanValue(row["Vendor Name"]) || cleanValue(row["Project/Site Name"]) || "No vendor"}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>{money(parseAmount(row.Amount))}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Requested by", cleanValue(row.Name), UserRound],
                  ["Project / site", cleanValue(row["Project/Site Name"]), Building2],
                  ["Payment type", cleanValue(row["Type of Payment"]), ReceiptText],
                  ["Approved", cleanValue(row.Approved), ClipboardCheck],
                  ["Payment", cleanValue(row.Payment), CreditCard],
                  ["Accountant", cleanValue(row["Accountant Status"]), UserRound],
                  ["Mode", cleanValue(row["Mode of Payment"]) || cleanValue(row["Mode of payment"]), Banknote],
                  ["Date", parseDate(row.Timestamp)?.toLocaleString() || cleanValue(row.Timestamp), CalendarDays],
                ].map(([label, value, Icon]) => (
                  <div key={label} className={`rounded-2xl p-3 ${darkMode ? "bg-black/20" : "bg-black/[0.025]"}`}>
                    <p className={`mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] ${darkMode ? "text-white/35" : "text-black/35"}`}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </p>
                    <p className={`break-words text-sm leading-5 ${darkMode ? "text-white/75" : "text-black/70"}`}>{value || "N/A"}</p>
                  </div>
                ))}
              </div>

              {cleanValue(row.Remark) && (
                <div className={`mt-3 rounded-2xl p-3 ${darkMode ? "bg-black/20" : "bg-black/[0.025]"}`}>
                  <p className={`mb-1 text-[10px] uppercase tracking-[0.16em] ${darkMode ? "text-white/35" : "text-black/35"}`}>Remark</p>
                  <p className={`text-sm ${darkMode ? "text-white/75" : "text-black/70"}`}>{cleanValue(row.Remark)}</p>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {attachments.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${darkMode ? "bg-white/5 text-white/75 hover:bg-white/10" : "bg-black/[0.04] text-black/65 hover:bg-black/[0.07]"}`}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Document {index + 1}
                    </a>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className={`overflow-hidden rounded-[24px] ${darkMode ? "bg-white/[0.035] border border-white/10" : "bg-white border border-black/5"}`}>
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <h3 className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>Complete project payment data</h3>
          <Table2 className={`h-4 w-4 ${muted}`} />
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                {headers.map((header) => (
                  <th key={header} className={`whitespace-nowrap px-5 py-3 text-left font-medium ${darkMode ? "text-white/55" : "text-black/45"}`}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.slice(0, 150).map((row) => (
                <tr key={row.__rowIndex} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                  {headers.map((header) => {
                    const urls = extractUrls(row[header]);
                    return (
                      <td key={header} className={`min-w-[160px] px-5 py-3 align-top ${darkMode ? "text-white/75" : "text-black/65"}`}>
                        {urls.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {urls.slice(0, 3).map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/5 text-white/70" : "bg-black/[0.04] text-black/60"}`}>
                                <ArrowUpRight className="h-3 w-3" /> Link
                              </a>
                            ))}
                          </div>
                        ) : cleanValue(row[header]) || "N/A"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
