import { AlertTriangle, Building2, IndianRupee, Layers3, PackageOpen, Percent, Table2, WalletCards } from "lucide-react";
import { money, parseAmount } from "./amountUtils";

const COLORS = ["#d8f36a", "#3b82f6", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#ef4444"];

function clean(value) {
  const result = String(value ?? "").trim();
  return result && !/^#(?:N\/A|NAME\?|REF!|VALUE!)$/i.test(result) ? result : "";
}

function findSheet(sheets, matcher) {
  return sheets.find((sheet) => matcher.test(sheet.name));
}

function Metric({ darkMode, icon: Icon, label, value, note, accent }) {
  return <div className={`relative overflow-hidden rounded-[22px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
    <span className="absolute -right-7 -top-7 h-24 w-24 rounded-full opacity-15" style={{ background: accent }} />
    <div className="flex items-center justify-between gap-3"><p className={`text-xs uppercase tracking-[0.16em] ${darkMode ? "text-white/40" : "text-black/40"}`}>{label}</p><Icon className="h-4 w-4" style={{ color: accent }} /></div>
    <p className={`mt-4 text-2xl font-semibold sm:text-3xl ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
    <p className={`mt-2 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{note}</p>
  </div>;
}

function Bars({ darkMode, title, subtitle, data }) {
  const items = data.filter((item) => item.value > 0).slice(0, 8);
  const max = Math.max(...items.map((item) => item.value), 1);
  return <section className={`rounded-[22px] border p-5 ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
    <h3 className={darkMode ? "text-white" : "text-black"}>{title}</h3><p className={`mt-1 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>{subtitle}</p>
    <div className="mt-5 space-y-3">{items.map((item, index) => <div key={item.label}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className={`truncate ${darkMode ? "text-white/70" : "text-black/65"}`}>{item.label}</span><span className={darkMode ? "text-white/45" : "text-black/45"}>{money(item.value)}</span></div><div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? "bg-white/8" : "bg-black/5"}`}><div className="h-full rounded-full" style={{ width: `${Math.max(5, item.value / max * 100)}%`, background: COLORS[index % COLORS.length] }} /></div></div>)}</div>
  </section>;
}

function DataTable({ darkMode, title, subtitle, headers, rows }) {
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const visibleHeaders = headers.filter((header) => rows.some((row) => clean(row[header]))).slice(0, 10);
  return <section className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10 bg-white/[0.035]" : "border-black/5 bg-white"}`}>
    <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/5"}`}><div><h3 className={darkMode ? "text-white" : "text-black"}>{title}</h3><p className={`mt-1 text-xs ${muted}`}>{subtitle}</p></div><Table2 className={`h-4 w-4 ${muted}`} /></div>
    <div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[940px] text-sm"><thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}><tr>{visibleHeaders.map((header) => <th key={header} className={`whitespace-nowrap px-5 py-3 text-left text-xs font-medium ${muted}`}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 250).map((row) => <tr key={`${row.__sheetName}-${row.__rowIndex}`} className={darkMode ? "border-t border-white/5" : "border-t border-black/5"}>{visibleHeaders.map((header) => <td key={header} className={`max-w-[360px] px-5 py-3 align-top ${darkMode ? "text-white/70" : "text-black/65"}`}>{clean(row[header]) || <span className={muted}>—</span>}</td>)}</tr>)}</tbody></table></div>
  </section>;
}

function Overview({ darkMode, sheets, query }) {
  const summary = findSheet(sheets, /^summary$/i);
  const pricing = findSheet(sheets, /data segregation room and catog/i);
  const master = findSheet(sheets, /^import range$/i);
  const pricingRows = pricing?.rows || [];
  const roomRows = pricingRows.filter((row) => clean(row.Room) && !/old u&i|new addition/i.test(clean(row.Room)));
  const categoryRows = pricingRows.filter((row) => clean(row.Category));
  const totalRow = pricingRows.find((row) => !clean(row.Room) && parseAmount(row["Room U&I Cost"]) > 0 && parseAmount(row["Room Actual Client Amount"]) > 0) || {};
  const projectBudget = parseAmount(summary?.rows.find((row) => /project budget/i.test(clean(row.Label)))?.Amount);
  const baseCost = parseAmount(totalRow["Room U&I Cost"]);
  const targetClient = parseAmount(totalRow["Room 30% Amount"]);
  const actualClient = parseAmount(totalRow["Room Actual Client Amount"]);
  const variance = actualClient - targetClient;
  const markup = baseCost ? (actualClient - baseCost) / baseCost : 0;
  const itemRows = (master?.rows || []).filter((row) => clean(row.Category));
  const filteredPricing = pricingRows.filter((row) => !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query)));
  const roomData = roomRows.map((row) => ({ label: clean(row.Room), value: parseAmount(row["Room Actual Client Amount"]) })).sort((a, b) => b.value - a.value);
  const categoryData = categoryRows.map((row) => ({ label: clean(row.Category), value: parseAmount(row["Category Actual Amount"]) })).sort((a, b) => b.value - a.value);

  return <div className="flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? "text-[#d8f36a]" : "text-green-700"}`}>Category-led cost control</p><h2 className={`mt-2 text-2xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>Iskon Bhavnagar executive overview</h2></div><p className={`max-w-xl text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>Client pricing, expected markup, room exposure, and category concentration in one decision view.</p></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Metric darkMode={darkMode} icon={WalletCards} label="Project budget" value={projectBudget ? money(projectBudget) : "Not set"} note="Summary total" accent={COLORS[0]} />
      <Metric darkMode={darkMode} icon={IndianRupee} label="U&I base cost" value={baseCost ? money(baseCost) : "Not set"} note="Before client uplift" accent={COLORS[1]} />
      <Metric darkMode={darkMode} icon={Percent} label="Actual markup" value={baseCost ? `${(markup * 100).toFixed(1)}%` : "Not set"} note="Against U&I base" accent={COLORS[2]} />
      <Metric darkMode={darkMode} icon={AlertTriangle} label="Vs 30% target" value={variance ? money(variance) : "On target"} note={variance < 0 ? "Below target pricing" : "Above target pricing"} accent={variance < 0 ? COLORS[7] : COLORS[6]} />
      <Metric darkMode={darkMode} icon={Building2} label="Rooms" value={roomRows.length.toLocaleString()} note="Costed spaces" accent={COLORS[4]} />
      <Metric darkMode={darkMode} icon={PackageOpen} label="Line items" value={itemRows.length.toLocaleString()} note={`${categoryRows.length} categories`} accent={COLORS[3]} />
    </div>
    <div className="mb-5 grid gap-4 xl:grid-cols-2"><Bars darkMode={darkMode} title="Highest-value rooms" subtitle="Actual client DL amount by room" data={roomData} /><Bars darkMode={darkMode} title="Category concentration" subtitle="Actual client amount by category" data={categoryData} /></div>
    <DataTable darkMode={darkMode} title="Pricing control" subtitle={`${money(actualClient)} actual client DL vs ${money(targetClient)} at 30% uplift`} headers={pricing?.headers || []} rows={filteredPricing} />
  </div>;
}

export default function IskonBhavnagarDashboard({ darkMode, currentSheet, sheets = [], overview = false, searchQuery = "" }) {
  const query = searchQuery.trim().toLowerCase();
  if (overview) return <Overview darkMode={darkMode} sheets={sheets} query={query} />;
  const headers = currentSheet?.headers || [];
  const rows = (currentSheet?.rows || []).filter((row) => !query || headers.some((header) => String(row[header] || "").toLowerCase().includes(query)));
  const meta = currentSheet?.meta || {};
  const rooms = new Set(rows.map((row) => clean(row.Room)).filter(Boolean));
  const total = meta.totalCost || rows.reduce((sum, row) => sum + parseAmount(row["U&I Amount"] || row["Category Actual Amount"] || row.Amount), 0);
  return <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric darkMode={darkMode} icon={PackageOpen} label="Visible records" value={rows.length.toLocaleString()} note={currentSheet?.name} accent={COLORS[0]} /><Metric darkMode={darkMode} icon={IndianRupee} label="Sheet value" value={total ? money(total) : "Not applicable"} note="Detected total cost" accent={COLORS[1]} /><Metric darkMode={darkMode} icon={Layers3} label="Rooms covered" value={rooms.size.toLocaleString()} note={(meta.role || "supporting").replace(/-/g, " ")} accent={COLORS[2]} /></div><DataTable darkMode={darkMode} title={meta.category || currentSheet?.name} subtitle={`${rows.length.toLocaleString()} relevant rows · empty spreadsheet rows removed`} headers={headers} rows={rows} /></div>;
}
