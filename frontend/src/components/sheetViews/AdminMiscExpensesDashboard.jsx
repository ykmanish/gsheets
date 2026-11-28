import { ArrowUpRight, Banknote, Building2, CalendarDays, FileText, Paperclip, ReceiptText, Table2, UserRound } from "lucide-react";
import { isWithinDateRange, money, parseAmount } from "./amountUtils";
import { IconTile } from "../ui";
import { Metric, PALETTE } from "./viewKit";

const CHART_COLORS = PALETTE;

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


function Bars({ darkMode, title, data, valueFormatter = (value) => value }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";

  return (
    <div className={`rounded-[20px] p-5 ${darkMode ? "bg-[#15171c] border border-white/10" : "bg-white border border-[#ececec]"}`}>
      <h3 className={`text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{title}</h3>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className={`truncate ${darkMode ? "text-white/65" : "text-[#3d3d3b]"}`}>{item.label}</span>
              <span className={muted}>{valueFormatter(item.value)}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(7, (item.value / max) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className={`text-sm ${muted}`}>No data yet.</p>}
      </div>
    </div>
  );
}

export default function AdminMiscExpensesDashboard({ darkMode, currentSheet, searchQuery, dateRange = {} }) {
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const headers = currentSheet?.headers || [];
  const query = searchQuery.trim().toLowerCase();
  const rows = (currentSheet?.rows || []).filter((row) => {
    const matchesQuery = !query || headers.some((header) => String(row[header] ?? "").toLowerCase().includes(query));
    return matchesQuery && isWithinDateRange(row.Timestamp, dateRange);
  });
  const sortedRows = [...rows].sort((a, b) => (parseDate(b.Timestamp)?.getTime() || 0) - (parseDate(a.Timestamp)?.getTime() || 0));
  const totalAmount = rows.reduce((sum, row) => sum + parseAmount(row.Amount), 0);
  const attachmentCount = rows.reduce((sum, row) => sum + extractUrls(row["Invoice and other supportive Documents"]).length, 0);
  const latest = sortedRows[0]?.Timestamp ? parseDate(sortedRows[0].Timestamp) : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric darkMode={darkMode} icon={ReceiptText} label={query ? "Matching requests" : "Requests"} value={rows.length.toLocaleString()} accent="#22c55e" />
        <Metric darkMode={darkMode} icon={Banknote} label="Total amount" value={money(totalAmount)} accent="#3b82f6" />
        <Metric darkMode={darkMode} icon={Building2} label="Departments" value={countBy(rows, "Department").length.toLocaleString()} accent="#f59e0b" />
        <Metric darkMode={darkMode} icon={Paperclip} label="Attachments" value={attachmentCount.toLocaleString()} accent="#ef4444" />
        <Metric darkMode={darkMode} icon={CalendarDays} label="Latest request" value={latest ? latest.toLocaleDateString() : "N/A"} accent="#a855f7" />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Bars darkMode={darkMode} title="Amount by expense category" data={sumBy(rows, "Expense Category", "Amount")} valueFormatter={money} />
        <Bars darkMode={darkMode} title="Requests by type" data={countBy(rows, "Type of Request")} />
        <Bars darkMode={darkMode} title="Requests by department" data={countBy(rows, "Department")} />
        <Bars darkMode={darkMode} title="Payment mode split" data={countBy(rows, "Mode of Payment")} />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        {sortedRows.map((row) => {
          const attachments = extractUrls(row["Invoice and other supportive Documents"]);
          return (
            <article key={`${row.__sheetName}-${row.__rowIndex}`} className={`rounded-[20px] p-5 ${darkMode ? "bg-[#15171c] border border-white/10" : "bg-white border border-[#ececec]"}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={`text-[17px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{cleanValue(row["Expense Category"]) || "Expense request"}</p>
                  <p className={`mt-1 text-sm ${muted}`}>{cleanValue(row.Description) || cleanValue(row["Vendor Name"]) || "No description"}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm ${darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"}`}>{money(parseAmount(row.Amount))}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Requester", cleanValue(row["Column 2"]) || cleanValue(row["Email address"]), UserRound],
                  ["Department", cleanValue(row.Department), Building2],
                  ["Request type", cleanValue(row["Type of Request"]), ReceiptText],
                  ["Payment mode", cleanValue(row["Mode of Payment"]), Banknote],
                  ["Vendor", cleanValue(row["Vendor Name"]), FileText],
                  ["Date", parseDate(row.Timestamp)?.toLocaleString() || cleanValue(row.Timestamp), CalendarDays],
                ].map(([label, value, Icon]) => (
                  <div key={label} className={`rounded-[14px] p-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                    <p className={`mb-1 flex items-center gap-2 text-[11.5px] ${darkMode ? "text-white/35" : "text-[#9a9a98]"}`}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </p>
                    <p className={`break-words text-sm leading-5 ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>{value || "N/A"}</p>
                  </div>
                ))}
              </div>

              {attachments.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {attachments.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${darkMode ? "bg-white/5 text-white/75 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Attachment {index + 1}
                    </a>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className={`overflow-hidden rounded-[20px] ${darkMode ? "bg-[#15171c] border border-white/10" : "bg-white border border-[#ececec]"}`}>
        <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
          <h3 className={`text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>Complete expense data</h3>
          <IconTile icon={Table2} tone="neutral" darkMode={darkMode} size="sm" />
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <tr className={darkMode ? "border-b border-white/10" : "border-b border-[#f0f0ee]"}>
                {headers.map((header) => (
                  <th key={header} className={`whitespace-nowrap px-5 py-3 text-left text-[12px] font-normal ${darkMode ? "text-white/55" : "text-[#8a8a8a]"}`}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.slice(0, 150).map((row) => (
                <tr key={row.__rowIndex} className={darkMode ? "border-b border-white/[0.06]" : "border-b border-[#f0f0ee]"}>
                  {headers.map((header) => {
                    const urls = extractUrls(row[header]);
                    return (
                      <td key={header} className={`min-w-[170px] px-5 py-3 align-top ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>
                        {urls.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {urls.slice(0, 3).map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/5 text-white/70" : "bg-[#f4f4f2] text-[#3d3d3b]"}`}>
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
