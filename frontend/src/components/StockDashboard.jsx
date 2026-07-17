"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Package,
  PackageCheck,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { ConfirmModal } from "./ui";

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

function fmt(value, digits = 0) {
  const number = Number(value) || 0;
  return number.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function money(value) {
  const number = Number(value) || 0;
  if (!number) return "INR 0";
  return `INR ${number.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function emptyForm() {
  return { name: "", sheetUrl: "", architecture: "auto", notes: "" };
}

function initials(name = "Site") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : String(parts[0] || "ST").slice(0, 2)).toUpperCase();
}

function SoftDropdown({ darkMode, value, options = [], onChange, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-14 w-full items-center justify-between gap-3 rounded-[20px] border px-4 text-left text-sm font-semibold transition ${
          darkMode ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]" : "border-black/10 bg-white hover:bg-[#f8faf5]"
        }`}
      >
        <span className={selected ? "" : darkMode ? "text-white/35" : "text-black/35"}>{selected?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""} ${darkMode ? "text-white/45" : "text-black/45"}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close dropdown" className="fixed inset-0 z-[120] cursor-default" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-[125] max-h-72 overflow-y-auto rounded-[22px] border p-2 shadow-2xl ${
            darkMode ? "border-white/10 bg-[#191b20]" : "border-black/10 bg-white"
          }`}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                    active
                      ? "bg-[#eafbdc] font-bold text-[#319000]"
                      : darkMode ? "text-white/75 hover:bg-white/10" : "text-black/70 hover:bg-[#f4f6f1]"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {option.meta && <span className={active ? "text-[#319000]" : darkMode ? "text-white/35" : "text-black/35"}>{option.meta}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ darkMode, icon: Icon, label, value, note, tone = "green" }) {
  const tones = {
    green: darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-[#e7f9ef] text-[#079669]",
    blue: darkMode ? "bg-sky-400/10 text-sky-200" : "bg-[#e9f3ff] text-[#1267bd]",
    amber: darkMode ? "bg-amber-400/10 text-amber-200" : "bg-[#fff5db] text-[#b56a00]",
    red: darkMode ? "bg-rose-400/10 text-rose-200" : "bg-[#ffeded] text-[#dc2626]",
    slate: darkMode ? "bg-white/10 text-white/75" : "bg-[#f2f4ef] text-[#171714]",
  };
  return (
    <section className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.045]" : "bg-white"}`}>
      <div className="flex items-start justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${darkMode ? "bg-white/10 text-white/45" : "bg-[#f4f6f1] text-black/45"}`}>
          {note}
        </span>
      </div>
      <p className={`mt-5 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
    </section>
  );
}

function Drawer({ open, title, subtitle, children, onClose, darkMode, wide = false }) {
  return (
    <>
      <div className={`fixed inset-0 z-[90] bg-black/35 backdrop-blur-[2px] transition duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside
        className={`fixed z-[95] flex transform flex-col overflow-hidden border transition duration-300 ${
          wide ? "inset-0 h-screen w-screen rounded-none border-0" : "inset-y-3 right-3 w-[min(1180px,calc(100vw-24px))] rounded-[28px]"
        } ${
          open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0 pointer-events-none"
        } ${darkMode ? "border-white/10 bg-[#101114] text-white" : "border-black/10 bg-white text-[#171714]"}`}
      >
        <header className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/10"}`}>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-[#171714]"}`}>{title}</p>
            {subtitle && <p className={`mt-0.5 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={`grid h-11 w-11 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto ${darkMode ? "bg-[#0c0d10]" : "bg-[#f5f7f2]"}`}>{children}</div>
      </aside>
    </>
  );
}

function SiteFormDrawer({ darkMode, open, site, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm());
  const architectureOptions = useMemo(() => [
    { value: "auto", label: "Auto detect" },
    { value: "site-final-sheet", label: "Final Sheet stock ledger" },
    { value: "category-tabs", label: "Category-wise tabs" },
    { value: "warehouse", label: "Warehouse inventory" },
  ], []);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      setForm(site ? { name: site.name || "", sheetUrl: site.sheetUrl || site.spreadsheetId || "", architecture: site.architecture || "auto", notes: site.notes || "" } : emptyForm());
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [open, site]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <Drawer open={open} onClose={onClose} darkMode={darkMode} title={site ? `${site.name} · Stock link` : "Add stock site"} subtitle="Link a native Google Sheet with one or more stock tabs.">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="grid gap-5 p-5 lg:grid-cols-[320px_1fr]">
        <aside className={`rounded-[28px] p-6 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
          <span className="inline-flex rounded-lg bg-[#eafbdc] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b9b16]">Stock setup</span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight">{site ? "Edit linked site" : "New site stock"}</h2>
          <p className={`mt-3 text-sm leading-6 ${darkMode ? "text-white/50" : "text-black/50"}`}>
            Add the site name and Google Sheet URL. The dashboard auto-detects Final Sheet ledgers and category-wise stock tabs.
          </p>
          <button disabled={saving} className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#89ed3f] text-sm font-bold text-black transition hover:bg-[#7dde35] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save site
          </button>
        </aside>
        <section className={`rounded-[28px] p-6 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className={`text-xs font-bold uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Site name</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Kalhaar, Asteria, Warehouse..." className={`mt-2 h-14 w-full rounded-2xl border px-4 outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
            </label>
            <label className="block">
              <span className={`text-xs font-bold uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Architecture</span>
              <div className="mt-2">
                <SoftDropdown darkMode={darkMode} value={form.architecture} options={architectureOptions} onChange={(value) => update("architecture", value)} />
              </div>
            </label>
          </div>
          <label className="mt-5 block">
            <span className={`text-xs font-bold uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Google Sheet link</span>
            <input value={form.sheetUrl} onChange={(event) => update("sheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={`mt-2 h-14 w-full rounded-2xl border px-4 outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
          </label>
          <label className="mt-5 block">
            <span className={`text-xs font-bold uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Notes</span>
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional sheet owner, update rhythm, or site notes." rows={5} className={`mt-2 w-full resize-none rounded-2xl border p-4 outline-none ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`} />
          </label>
        </section>
      </form>
    </Drawer>
  );
}

function SiteDetailDrawer({ darkMode, site, open, onClose, onEdit }) {
  const [query, setQuery] = useState("");
  const [activeSheet, setActiveSheet] = useState("");
  const firstSheetName = site?.sheets?.[0]?.name || "";

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      setQuery("");
      setActiveSheet(firstSheetName);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [firstSheetName, open, site?.id]);

  const allItems = useMemo(() => site?.items || site?.recentItems || [], [site]);
  const sheetOptions = useMemo(() => (site?.sheets || []).map((sheet) => ({ value: sheet.name, label: sheet.name, meta: `${fmt(sheet.totalItems)} items` })), [site?.sheets]);
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sheetFiltered = activeSheet ? allItems.filter((item) => item.sheetName === activeSheet) : allItems;
    const list = sheetFiltered;
    if (!needle) return list;
    return list.filter((item) => [item.itemName, item.category, item.unit, item.sheetName, item.location].join(" ").toLowerCase().includes(needle));
  }, [activeSheet, allItems, query]);
  const activeSheetLabel = activeSheet || "Selected sheet";

  return (
    <Drawer wide open={open} onClose={onClose} darkMode={darkMode} title={`${site?.name || "Site"} · Stock details`} subtitle="Live parsed stock data grouped by sheets and categories.">
      {!site ? null : (
        <div className="space-y-5 p-5">
          <section className={`rounded-[28px] p-6 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#10ad73] text-3xl font-bold text-white">{initials(site.name)}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-[0.16em] ${darkMode ? "text-[#d8f36a]" : "text-[#4b9b16]"}`}>Stock workspace</p>
                  <h2 className="mt-2 truncate small text-4xl font-bold tracking-tight">{site.name}</h2>
                  <p className={`mt-1 text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>
                    {fmt(site.summary?.totalItems)} items · {fmt(site.summary?.totalQuantity, 1)} quantity · {fmt(site.summary?.lowStock)} low / zero stock
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onEdit(site)} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black">
                  <Pencil className="h-4 w-4" /> Edit link
                </button>
                {site.sheetUrl && (
                  <a href={site.sheetUrl} target="_blank" rel="noreferrer" className={`flex h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/[0.03]"}`}>
                    <ExternalLink className="h-4 w-4" /> Open sheet
                  </a>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className={`rounded-[28px] p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Sheet breakdown</p>
                  <h3 className="mt-1 text-xl font-bold">Tabs in this stock file</h3>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(site.sheets || []).map((sheet) => (
                  <button
                    type="button"
                    key={sheet.name}
                    onClick={() => setActiveSheet(sheet.name)}
                    className={`rounded-[20px] border p-4 text-left transition ${
                      activeSheet === sheet.name
                        ? darkMode ? "border-[#89ed3f] bg-[#89ed3f]/10" : "border-[#10ad73] bg-[#f0ffea]"
                        : darkMode ? "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]" : "border-black/10 bg-[#fbfcf8] hover:bg-[#f4f8ef]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold">{sheet.name}</h4>
                        <p className={`mt-1 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{fmt(sheet.totalItems)} items · {fmt(sheet.totalQuantity, 1)} qty</p>
                      </div>
                      <span className="rounded-full bg-[#eafbdc] px-3 py-1 text-[11px] font-bold text-[#4b9b16]">{fmt(sheet.lowStockItems?.length || 0)} low</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(sheet.categories || []).slice(0, 4).map((category) => (
                        <span key={category.name} className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/10 text-white/65" : "bg-white text-black/60"}`}>{category.name} · {category.items}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={`rounded-[28px] p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Stock items</p>
                  <h3 className="mt-1 text-xl font-bold">{activeSheetLabel} · {items.length} visible items</h3>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-72">
                    <SoftDropdown darkMode={darkMode} value={activeSheet} options={sheetOptions} onChange={setActiveSheet} placeholder="Choose sheet" />
                  </div>
                  <label className={`flex h-12 min-w-64 items-center gap-2 rounded-2xl border px-4 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
                    <Search className="h-4 w-4 text-[#4b9b16]" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                </div>
              </div>
              <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
                  <thead className={darkMode ? "text-white/45" : "text-black/45"}>
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Sheet</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={`${item.sheetName}-${item.rowNumber}-${item.itemName}`} className={darkMode ? "bg-white/[0.035]" : "bg-[#f7f9f4]"}>
                        <td className="rounded-l-2xl px-4 py-3 font-semibold">{item.itemName}</td>
                        <td className="px-4 py-3">{item.category || "-"}</td>
                        <td className="px-4 py-3">{item.sheetName}</td>
                        <td className={`px-4 py-3 text-right font-bold ${item.quantity <= Math.max(0, item.reorderMin || 0) ? "text-red-500" : "text-[#0f9f6e]"}`}>{fmt(item.quantity, 1)}</td>
                        <td className="rounded-r-2xl px-4 py-3">{item.unit || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!items.length && (
                  <div className={`rounded-2xl border border-dashed p-8 text-center text-sm ${darkMode ? "border-white/10 text-white/45" : "border-black/10 text-black/45"}`}>
                    No parsed stock rows found for {activeSheetLabel}.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function StockSiteTable({ darkMode, sites, canManage, onOpen, onEdit, onDelete }) {
  return (
    <div className={`overflow-hidden rounded-[24px] border ${darkMode ? "border-white/10" : "border-black/10"}`}>
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className={`${darkMode ? "bg-white/[0.05] text-white/45" : "bg-[#f2f4ef] text-black/45"}`}>
          <tr>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.12em]">Site</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.12em]">Sheets</th>
            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.12em]">Items</th>
            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.12em]">Qty</th>
            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.12em]">Low</th>
            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.12em]">Action</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const hasError = Boolean(site.error);
            return (
              <tr key={site.id} className={`border-t ${darkMode ? "border-white/10 hover:bg-white/[0.04]" : "border-black/10 hover:bg-[#fafcf7]"}`}>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl text-base font-bold text-white ${hasError ? "bg-red-500" : "bg-[#10ad73]"}`}>{initials(site.name)}</span>
                    <div className="min-w-0">
                      <p className="font-bold">{site.name}</p>
                      <p className={`mt-0.5 max-w-[220px] truncate text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>{hasError ? site.error : site.linkedFileName || "Linked stock file"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 font-semibold">{fmt(site.summary?.sheets)}</td>
                <td className="px-6 py-5 text-right font-bold">{fmt(site.summary?.totalItems)}</td>
                <td className="px-6 py-5 text-right font-bold">{fmt(site.summary?.totalQuantity, 1)}</td>
                <td className="px-6 py-5 text-right font-bold text-red-500">{fmt(site.summary?.lowStock)}</td>
                <td className="px-6 py-5">
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <>
                        <button type="button" onClick={() => onEdit(site)} className={`flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#89ed3f] text-black hover:bg-[#7dde35]"}`}><Pencil className="h-4 w-4" /> Edit</button>
                        <button type="button" onClick={() => onDelete(site)} className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                    <button type="button" onClick={() => onOpen(site)} className={`flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold ${darkMode ? "border-white/10 hover:bg-white/10" : "border-black/10 bg-white hover:bg-[#f7faf2]"}`}>
                      View detail <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StockDashboard({ darkMode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);

  const muted = darkMode ? "text-white/50" : "text-black/50";

  const load = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      const result = await api(`/project-stock${force ? "?force=true" : ""}`);
      setData(result);
      setSelectedSite((current) => current ? (result.sites || []).find((site) => site.id === current.id) || current : null);
    } catch (error) {
      toast.error(error.message || "Could not load stock");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const sites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = data?.sites || [];
    if (!needle) return list;
    return list.filter((site) => [site.name, site.linkedFileName, ...(site.categories || []).map((item) => item.name)].join(" ").toLowerCase().includes(needle));
  }, [data?.sites, query]);

  function openAdd() {
    setEditingSite(null);
    setFormOpen(true);
  }

  function openEdit(site) {
    setEditingSite(site);
    setFormOpen(true);
  }

  async function saveSite(form) {
    try {
      setSaving(true);
      if (editingSite) {
        await api(`/project-stock/sites/${editingSite.id}`, { method: "PATCH", body: JSON.stringify(form) });
        toast.success("Stock site updated");
      } else {
        await api("/project-stock/sites", { method: "POST", body: JSON.stringify(form) });
        toast.success("Stock site linked");
      }
      setFormOpen(false);
      setEditingSite(null);
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not save stock site");
    } finally {
      setSaving(false);
    }
  }

  async function performDeleteSite(site) {
    if (!site?.id) return;
    try {
      await api(`/project-stock/sites/${site.id}`, { method: "DELETE" });
      toast.success("Stock site removed");
      setDeleteConfirm(null);
      setSelectedSite((current) => current?.id === site.id ? null : current);
      await load(true);
    } catch (error) {
      toast.error(error.message || "Could not delete stock site");
    }
  }

  function deleteSite(site) {
    setDeleteConfirm(site);
  }

  if (loading) {
    return (
      <main className={`flex min-h-0 flex-1 items-center justify-center ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f7f2] text-[#171714]"}`}>
        <div className={`w-full max-w-lg rounded-[32px] p-8 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eafbdc] text-[#4b9b16]"><Package className="h-6 w-6" /></span>
          <h2 className="mt-5 text-2xl font-bold">Opening stock workspace</h2>
          <p className={`mt-2 text-sm ${muted}`}>Reading linked site stock sheets and preparing dashboard cards.</p>
          <div className={`mt-6 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/[0.06]"}`}><div className="h-full w-1/3 animate-pulse rounded-full bg-[#89ed3f]" /></div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-7 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f7f2] text-[#171714]"}`}>
      <section className={`rounded-[32px] p-6 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4b9b16]"><PackageSearch className="h-3.5 w-3.5" /> Projects · Stock</span>
            <h1 className="mt-3 text-4xl font-bold small text-black dark:text-white tracking-tight">Site stock dashboard</h1>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>Track site and warehouse inventory from linked Google Sheets, even when each workbook uses a different stock layout.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data?.canManage && (
              <button type="button" onClick={openAdd} className="flex h-12 items-center gap-2 rounded-full bg-[#89ed3f] px-5 text-sm font-bold text-black hover:bg-[#7dde35]"><Plus className="h-4 w-4" /> Add site</button>
            )}
            <button type="button" onClick={() => load(true)} className={`flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 bg-white hover:bg-[#f7faf2]"}`}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </section>

      <section className={`mt-5 rounded-[32px] p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4b9b16]">Sites</p>
            <h2 className="mt-1 text-2xl font-bold">Stock locations</h2>
            <p className={`mt-1 text-sm ${muted}`}>{sites.length} visible site{sites.length === 1 ? "" : "s"}</p>
          </div>
          <label className={`flex h-12 min-w-72 items-center gap-2 rounded-2xl border px-4 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
            <Search className="h-4 w-4 text-[#4b9b16]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search site, sheet, category..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>

        {sites.length ? (
          <StockSiteTable darkMode={darkMode} sites={sites} canManage={data?.canManage} onOpen={setSelectedSite} onEdit={openEdit} onDelete={deleteSite} />
        ) : (
          <div className={`rounded-[28px] border border-dashed p-10 text-center ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-[#fbfcf8]"}`}>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#eafbdc] text-[#4b9b16]"><FileSpreadsheet className="h-7 w-7" /></span>
            <h3 className="mt-5 text-2xl font-bold">No stock sites linked yet</h3>
            <p className={`mx-auto mt-2 max-w-md text-sm ${muted}`}>Add a site and paste its Google Sheet link. The dashboard will read all tabs and build the stock cards automatically.</p>
            {data?.canManage && <button type="button" onClick={openAdd} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-6 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add first site</button>}
          </div>
        )}
      </section>

      <SiteFormDrawer darkMode={darkMode} open={formOpen} site={editingSite} saving={saving} onClose={() => { setFormOpen(false); setEditingSite(null); }} onSubmit={saveSite} />
      <SiteDetailDrawer darkMode={darkMode} site={selectedSite} open={Boolean(selectedSite)} onClose={() => setSelectedSite(null)} onEdit={openEdit} />
      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title="Remove stock site"
        message={`Remove ${deleteConfirm?.name || "this site"} from Stock? The Google Sheet will not be deleted.`}
        confirmLabel="Remove"
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => performDeleteSite(deleteConfirm)}
      />
    </main>
  );
}
