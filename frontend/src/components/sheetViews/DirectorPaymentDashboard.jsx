import { Banknote, CalendarDays, CreditCard, FileText, ReceiptText, Table2, UserRound } from "lucide-react";
import { isWithinDateRange, money, parseAmount } from "./amountUtils";
import { IconTile } from "../ui";
import { Metric, PALETTE } from "./viewKit";

const CHART_COLORS = PALETTE;

function cleanValue(value) {
  const text = String(value ?? "").trim();
  return text && !/^na$/i.test(text) ? text : "";
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

export default function DirectorPaymentDashboard({ darkMode, currentSheet, searchQuery, dateRange = {} }) {
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";
  const headers = currentSheet?.headers || [];
  const query = searchQuery.trim().toLowerCase();
  const rows = (currentSheet?.rows || []).filter((row) => {
    const matchesQuery = !query || headers.some((header) => String(row[header] ?? "").toLowerCase().includes(query));
    return matchesQuery && isWithinDateRange(row.Timestamp, dateRange);
  });
  const sortedRows = [...rows].sort((a, b) => (parseDate(b.Timestamp)?.getTime() || 0) - (parseDate(a.Timestamp)?.getTime() || 0));
  const totalAmount = rows.reduce((sum, row) => sum + parseAmount(row.Amount), 0);
  const latest = sortedRows[0]?.Timestamp ? parseDate(sortedRows[0].Timestamp) : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric darkMode={darkMode} icon={ReceiptText} label={query ? "Matching requests" : "Requests"} value={rows.length.toLocaleString()} accent="#22c55e" />
        <Metric darkMode={darkMode} icon={Banknote} label="Total amount" value={money(totalAmount)} accent="#3b82f6" />
        <Metric darkMode={darkMode} icon={FileText} label="Expense types" value={countBy(rows, "Expense Type").length.toLocaleString()} accent="#f59e0b" />
        <Metric darkMode={darkMode} icon={UserRound} label="Requesters" value={countBy(rows, "Requested By").length.toLocaleString()} accent="#ef4444" />
        <Metric darkMode={darkMode} icon={CalendarDays} label="Latest request" value={latest ? latest.toLocaleDateString() : "N/A"} accent="#a855f7" />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Bars darkMode={darkMode} title="Amount by expense type" data={sumBy(rows, "Expense Type", "Amount")} valueFormatter={money} />
        <Bars darkMode={darkMode} title="Requests by expense type" data={countBy(rows, "Expense Type")} />
        <Bars darkMode={darkMode} title="Requests by requester" data={countBy(rows, "Requested By")} />
        <Bars darkMode={darkMode} title="Payment mode split" data={countBy(rows, "Mode of Payment")} />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        {sortedRows.map((row) => (
          <article key={`${row.__sheetName}-${row.__rowIndex}`} className={`rounded-[20px] p-5 ${darkMode ? "bg-[#15171c] border border-white/10" : "bg-white border border-[#ececec]"}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className={`text-[17px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{cleanValue(row["Expense Type"]) || "Payment request"}</p>
                <p className={`mt-1 text-sm ${muted}`}>{cleanValue(row.Remarks) || cleanValue(row["Requested By"]) || "No remarks"}</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-sm ${darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"}`}>{money(parseAmount(row.Amount))}</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Requested by", cleanValue(row["Requested By"]), UserRound],
                ["Expense type", cleanValue(row["Expense Type"]), FileText],
                ["Payment mode", cleanValue(row["Mode of Payment"]), CreditCard],
                ["Date", parseDate(row.Timestamp)?.toLocaleString() || cleanValue(row.Timestamp), CalendarDays],
                ["Email", cleanValue(row["Email address"]), UserRound],
                ["Remarks", cleanValue(row.Remarks), ReceiptText],
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
          </article>
        ))}
      </div>

      <div className={`overflow-hidden rounded-[20px] ${darkMode ? "bg-[#15171c] border border-white/10" : "bg-white border border-[#ececec]"}`}>
        <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
          <h3 className={`text-[15px] tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>Complete director payment data</h3>
          <IconTile icon={Table2} tone="neutral" darkMode={darkMode} size="sm" />
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
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
                  {headers.map((header) => (
                    <td key={header} className={`min-w-[150px] px-5 py-3 align-top ${darkMode ? "text-white/75" : "text-[#3d3d3b]"}`}>
                      {cleanValue(row[header]) || "N/A"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
