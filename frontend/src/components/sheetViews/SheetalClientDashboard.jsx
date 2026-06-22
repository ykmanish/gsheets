import { Banknote, Building2, ClipboardList, IndianRupee, Layers3, PackageOpen, Table2, WalletCards } from "lucide-react";
import { money, parseAmount } from "./amountUtils";

const COLORS = ["#d8f36a", "#3b82f6", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#ef4444"];

function clean(value) {
  const result = String(value ?? "").trim();
  return result && !/^#(?:N\/A|NAME\?|REF!|VALUE!)$/i.test(result) ? result : "";
}

function firstValue(row, names) {
  for (const name of names) if (clean(row?.[name])) return row[name];
  return "";
}

function findSheet(sheets, matcher) {
  return sheets.find((sheet) => matcher.test(sheet.name));
}

function sumBy(rows, labelNames, valueNames) {
  const totals = new Map();
  rows.forEach((row) => {
    const label = clean(firstValue(row, labelNames));
    const value = parseAmount(firstValue(row, valueNames));
    if (label && value) totals.set(label, (totals.get(label) || 0) + value);
  });
  return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function Metric({ darkMode, icon: Icon, label, value, note, accent }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
      <span className="absolute -right-7 -top-7 h-24 w-24 rounded-full opacity-15" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs uppercase tracking-[0.16em] ${darkMode ? "text-white/40" : "text-black/40"}`}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <p className={`mt-4 text-2xl font-semibold sm:text-3xl ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
      {note && <p className={`mt-2 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{note}</p>}
    </div>
  );
}

function Bars({ darkMode, title, subtitle, data, formatter = (value) => value.toLocaleString() }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className={`rounded-[22px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
      <h3 className={`font-medium ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
      <p className={`mt-1 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{subtitle}</p>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1.5 flex justify-between gap-3 text-xs">
              <span className={`truncate ${darkMode ? "text-white/70" : "text-black/65"}`}>{item.label}</span>
              <span className={darkMode ? "text-white/45" : "text-black/45"}>{formatter(item.value)}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/8" : "bg-black/5"}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(5, (item.value / max) * 100)}%`, background: COLORS[index % COLORS.length] }} />
            </div>
          </div>
        ))}
        {!items.length && <p className={`py-8 text-center text-sm ${darkMode ? "text-white/35" : "text-black/35"}`}>No cost values available.</p>}
      </div>
    </section>
  );
}

function DataTable({ darkMode, title, subtitle, headers, rows }) {
  const visibleHeaders = headers.filter((header) => rows.some((row) => clean(row[header]))).slice(0, 10);
  const muted = darkMode ? "text-white/45" : "text-black/45";
  return (
    <section className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
      <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/5"}`}>
        <div><h3 className={`font-medium ${darkMode ? "text-white" : "text-black"}`}>{title}</h3><p className={`mt-1 text-xs ${muted}`}>{subtitle}</p></div>
        <Table2 className={`h-4 w-4 ${muted}`} />
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}><tr>{visibleHeaders.map((header) => <th key={header} className={`whitespace-nowrap px-5 py-3 text-left text-xs font-medium ${muted}`}>{header}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 250).map((row) => <tr key={`${row.__sheetName}-${row.__rowIndex}`} className={darkMode ? "border-t border-white/5" : "border-t border-black/5"}>{visibleHeaders.map((header) => <td key={header} className={`max-w-[360px] px-5 py-3 align-top ${darkMode ? "text-white/70" : "text-black/65"}`}>{clean(row[header]) || <span className={muted}>—</span>}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function ExecutiveOverview({ darkMode, sheets, query }) {
  const detailSheet = findSheet(sheets, /^DL 1$/i) || findSheet(sheets, /^DL$/i) || findSheet(sheets, /master dl/i) || sheets.find((sheet) => sheet.headers.some((header) => /^particulars?$/i.test(header)));
  const summarySheet = findSheet(sheets, /summary/i);
  const financeSheet = findSheet(sheets, /^Sheet33$|^Purchase/i);
  const scopeSheet = findSheet(sheets, /working for client|^index/i);
  const detailRows = (detailSheet?.rows || []).filter((row) => !query || detailSheet.headers.some((header) => String(row[header] || "").toLowerCase().includes(query)));
  const projectBudget = parseAmount(summarySheet?.rows.find((row) => /project budget/i.test(clean(row.Label)))?.Amount);
  const areas = new Set(detailRows.map((row) => clean(firstValue(row, ["Area", "Room"]))).filter(Boolean));
  const categories = new Set(detailRows.map((row) => clean(firstValue(row, ["Category", "Catogory"]))).filter(Boolean));
  const estimate = detailRows.reduce((sum, row) => sum + parseAmount(firstValue(row, ["U&I Amount", "U&I Amt", "Client Amt", "Amount"])), 0);
  const financeTotals = (financeSheet?.rows || []).filter((row) => /^total$/i.test(clean(row["Category / Vendor"])));
  const paid = financeTotals.reduce((sum, row) => sum + parseAmount(row.Paid), 0);
  const due = financeTotals.reduce((sum, row) => sum + parseAmount(row.Due), 0);
  const roomSpend = sumBy(detailRows, ["Area", "Room"], ["U&I Amount", "U&I Amt", "Client Amt", "Amount"]);
  const categorySpend = sumBy(detailRows, ["Category", "Catogory"], ["U&I Amount", "U&I Amt", "Client Amt", "Amount"]);
  const decisions = (scopeSheet?.rows || []).filter((row) => clean(row["Decision / Scope Item"]) && !/^(total|option [ab]|original dl amount|new and revised)/i.test(clean(row["Decision / Scope Item"]))).slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? "text-[#d8f36a]" : "text-green-700"}`}>Leadership snapshot</p><h2 className={`mt-2 text-2xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>Sheetal Gharana design & cost overview</h2></div>
        <p className={`max-w-xl text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>Budget, estimated design value, commitments, and scope signals consolidated across the workbook.</p>
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric darkMode={darkMode} icon={WalletCards} label="Project budget" value={projectBudget ? money(projectBudget) : "Not set"} note="Workbook summary" accent={COLORS[0]} />
        <Metric darkMode={darkMode} icon={IndianRupee} label="Design estimate" value={estimate ? money(estimate) : "Not set"} note={detailSheet?.name || "Detail sheet"} accent={COLORS[1]} />
        <Metric darkMode={darkMode} icon={Building2} label="Areas covered" value={areas.size.toLocaleString()} note="Distinct rooms / areas" accent={COLORS[2]} />
        <Metric darkMode={darkMode} icon={Layers3} label="Categories" value={categories.size.toLocaleString()} note={`${detailRows.length.toLocaleString()} line items`} accent={COLORS[3]} />
        <Metric darkMode={darkMode} icon={Banknote} label="Tracked due" value={due ? money(due) : "Not set"} note={paid ? `${money(paid)} paid` : "Financial control"} accent={COLORS[7]} />
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Bars darkMode={darkMode} title="Highest-cost rooms" subtitle="Estimated design amount by area" data={roomSpend} formatter={money} />
        <Bars darkMode={darkMode} title="Cost by category" subtitle="Where the design budget is concentrated" data={categorySpend} formatter={money} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <DataTable darkMode={darkMode} title="Financial control" subtitle="DL value compared with finalized, paid, and due amounts" headers={financeSheet?.headers || []} rows={(financeSheet?.rows || []).filter((row) => !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query)))} />
        <section className={`rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
          <div className="flex items-center justify-between"><div><h3 className={darkMode ? "text-white" : "text-black"}>Scope decisions</h3><p className={`mt-1 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>Items leadership may want to review</p></div><ClipboardList className="h-5 w-5 text-amber-500" /></div>
          <div className="mt-5 space-y-3">{decisions.map((row) => <div key={row.__rowIndex} className={`rounded-2xl p-3 ${darkMode ? "bg-black/20" : "bg-black/[0.025]"}`}><p className={`text-sm ${darkMode ? "text-white/75" : "text-black/70"}`}>{clean(row["Decision / Scope Item"])}</p>{parseAmount(row.Amount) > 0 && <p className="mt-2 text-xs font-medium text-amber-500">{money(parseAmount(row.Amount))}</p>}</div>)}{!decisions.length && <p className={`py-8 text-center text-sm ${darkMode ? "text-white/35" : "text-black/35"}`}>No scope decisions found.</p>}</div>
        </section>
      </div>
    </div>
  );
}

export default function SheetalClientDashboard({ darkMode, currentSheet, sheets = [], overview = false, searchQuery = "" }) {
  const query = searchQuery.trim().toLowerCase();
  if (overview) return <ExecutiveOverview darkMode={darkMode} sheets={sheets} query={query} />;

  const headers = currentSheet?.headers || [];
  const rows = (currentSheet?.rows || []).filter((row) => !query || headers.some((header) => String(row[header] || "").toLowerCase().includes(query)));
  const role = currentSheet?.meta?.role || "supporting";
  const amountTotal = rows.reduce((sum, row) => sum + parseAmount(firstValue(row, ["U&I Amount", "U&I Amt", "Client Amount", "Amount", "DL Amount"])), 0);
  const areaSpend = sumBy(rows, ["Area", "Room", "Revised Area"], ["U&I Amount", "U&I Amt", "Client Amount", "Revised Amount"]);
  const categorySpend = sumBy(rows, ["Category", "Catogory", "Category / Vendor"], ["U&I Amount", "U&I Amt", "Client Amount", "DL Amount"]);
  const title = role === "room" ? `${currentSheet.meta?.title || currentSheet.name} BOQ` : currentSheet?.name;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric darkMode={darkMode} icon={PackageOpen} label="Visible records" value={rows.length.toLocaleString()} note={title} accent={COLORS[0]} />
        <Metric darkMode={darkMode} icon={IndianRupee} label="Visible value" value={amountTotal ? money(amountTotal) : currentSheet?.meta?.totalAmount ? money(currentSheet.meta.totalAmount) : "Not applicable"} note="Based on populated amount fields" accent={COLORS[1]} />
        <Metric darkMode={darkMode} icon={Layers3} label="Data view" value={role.replace(/-/g, " ")} note="Workbook architecture role" accent={COLORS[2]} />
      </div>
      {(areaSpend.length > 0 || categorySpend.length > 0) && <div className="mb-5 grid gap-4 xl:grid-cols-2"><Bars darkMode={darkMode} title="Value by area" subtitle="Cost concentration in this sheet" data={areaSpend} formatter={money} /><Bars darkMode={darkMode} title="Value by category" subtitle="Category-level contribution" data={categorySpend} formatter={money} /></div>}
      <DataTable darkMode={darkMode} title={title} subtitle={`${rows.length.toLocaleString()} relevant rows · empty spreadsheet rows removed`} headers={headers} rows={rows} />
    </div>
  );
}
