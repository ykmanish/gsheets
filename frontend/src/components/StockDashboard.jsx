"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  Layers3,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Badge, Button, Chip, ConfirmModal, EmptyState, IconTile, PageHeader, SectionTitle, SelectMenu, StatTile, cx, fieldClass } from "./ui";

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

function emptyForm() {
  return { name: "", sheetUrl: "", architecture: "auto", notes: "" };
}

function initials(name = "Site") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : String(parts[0] || "ST").slice(0, 2)).toUpperCase();
}

const SITE_TONES = ["mint", "lavender", "peach", "sky", "lime", "amber"];
function siteTone(name = "") {
  const sum = [...String(name)].reduce((total, char) => total + char.charCodeAt(0), 0);
  return SITE_TONES[sum % SITE_TONES.length];
}

function SoftDropdown({ darkMode, value, options = [], onChange, placeholder = "Select" }) {
  return <SelectMenu darkMode={darkMode} value={value} options={options} onChange={onChange} placeholder={placeholder} />;
}

function FieldLabel({ darkMode, children }) {
  return <span className={cx("mb-1.5 block text-[12.5px]", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{children}</span>;
}

function Drawer({ open, title, subtitle, icon, tone = "mint", children, onClose, darkMode, wide = false }) {
  return (
    <>
      <div className={`fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] transition duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside
        style={open ? { boxShadow: "var(--ui-shadow-pop)" } : undefined}
        className={cx(
          "newq fixed z-[95] flex transform flex-col overflow-hidden border transition duration-300",
          wide ? "inset-0 sm:inset-2.5 sm:rounded-[24px]" : "inset-y-2.5 right-2.5 w-[min(1180px,calc(100vw-20px))] rounded-[24px]",
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0",
          darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]",
        )}
      >
        <header className={cx("flex items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
          <div className="flex min-w-0 items-center gap-3">
            {icon && <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />}
            <div className="min-w-0">
              <p className="truncate text-[17px] tracking-[-0.01em]">{title}</p>
              {subtitle && <p className={cx("truncate text-[12.5px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className={cx("min-h-0 flex-1 overflow-y-auto", darkMode ? "bg-[#0f1014]" : "bg-[#fafaf9]")}>{children}</div>
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

  const card = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";

  return (
    <Drawer open={open} onClose={onClose} darkMode={darkMode} icon={FileSpreadsheet} tone="mint" title={site ? `${site.name} · Stock link` : "Add stock site"} subtitle="Link a native Google Sheet with one or more stock tabs.">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="grid gap-4 p-6 lg:grid-cols-[320px_1fr]">
        <aside className={cx("flex flex-col rounded-[20px] border p-6", card)}>
          <Badge icon={Package} tone="mint" darkMode={darkMode} className="self-start">Stock setup</Badge>
          <SectionTitle darkMode={darkMode} className="mt-4" title={site ? "Edit linked site" : "New site stock"} subtitle="one sheet, any layout" />
          <p className={cx("mt-3 text-[13px] leading-6", muted)}>
            Add the site name and Google Sheet URL. The dashboard auto-detects Final Sheet ledgers and category-wise stock tabs.
          </p>
          <Button type="submit" darkMode={darkMode} variant="primary" size="lg" icon={Save} loading={saving} disabled={saving} className="mt-8 w-full">
            Save site
          </Button>
        </aside>
        <section className={cx("rounded-[20px] border p-6", card)}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <FieldLabel darkMode={darkMode}>Site name</FieldLabel>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Kalhaar, Asteria, Warehouse..." className={fieldClass(darkMode, { size: "lg" })} />
            </label>
            <label className="block">
              <FieldLabel darkMode={darkMode}>Architecture</FieldLabel>
              <SoftDropdown darkMode={darkMode} value={form.architecture} options={architectureOptions} onChange={(value) => update("architecture", value)} />
            </label>
          </div>
          <label className="mt-5 block">
            <FieldLabel darkMode={darkMode}>Google Sheet link</FieldLabel>
            <input value={form.sheetUrl} onChange={(event) => update("sheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={fieldClass(darkMode, { size: "lg" })} />
          </label>
          <label className="mt-5 block">
            <FieldLabel darkMode={darkMode}>Notes</FieldLabel>
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional sheet owner, update rhythm, or site notes." rows={5} className={cx("w-full resize-none rounded-[16px] border p-4 text-[13.5px] outline-none transition", darkMode ? "border-transparent bg-white/[0.06] focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]")} />
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
  const card = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";

  return (
    <Drawer wide open={open} onClose={onClose} darkMode={darkMode} icon={Boxes} tone="lavender" title={`${site?.name || "Site"} · Stock details`} subtitle="Live parsed stock data grouped by sheets and categories.">
      {!site ? null : (
        <div className="space-y-4 p-6">
          <section className={cx("rounded-[20px] border p-6", card)}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <IconTile icon={<span className="text-[20px]">{initials(site.name)}</span>} tone={siteTone(site.name)} darkMode={darkMode} size="lg" className="h-16 w-16 rounded-[20px]" />
                <div className="min-w-0">
                  <Badge icon={Package} tone="mint" darkMode={darkMode}>Stock workspace</Badge>
                  <h2 className="mt-2 truncate text-[28px] leading-tight tracking-[-0.02em]">{site.name}</h2>
                  <p className={cx("mt-0.5 text-[13px]", muted)}>
                    {fmt(site.summary?.totalItems)} items · {fmt(site.summary?.totalQuantity, 1)} quantity · {fmt(site.summary?.lowStock)} low / zero stock
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button darkMode={darkMode} variant="primary" icon={Pencil} onClick={() => onEdit(site)}>Edit link</Button>
                {site.sheetUrl && (
                  <a href={site.sheetUrl} target="_blank" rel="noreferrer" className={cx("inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-[13px] transition-colors", darkMode ? "border-white/10 bg-white/[0.04] hover:bg-white/10" : "border-[#e6e6e3] bg-white hover:bg-[#f6f6f4]")}>
                    <ExternalLink className="h-4 w-4" /> Open sheet
                  </a>
                )}
              </div>
            </div>
          </section>

          <section className={cx("rounded-[20px] border p-5", card)}>
            <div className="flex items-center gap-3">
              <IconTile icon={Layers3} tone="sky" darkMode={darkMode} size="sm" />
              <div>
                <h3 className="text-[15px]">Tabs in this stock file</h3>
                <p className={cx("text-[12.5px]", muted)}>Sheet breakdown</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(site.sheets || []).map((sheet) => (
                <button
                  type="button"
                  key={sheet.name}
                  onClick={() => setActiveSheet(sheet.name)}
                  className={cx(
                    "rounded-[18px] border p-4 text-left transition-colors",
                    activeSheet === sheet.name
                      ? darkMode ? "border-[#cff07a]/50 bg-[#cff07a]/10" : "border-[#141414] bg-white"
                      : darkMode ? "border-transparent bg-white/[0.04] hover:bg-white/[0.07]" : "border-transparent bg-[#f7f7f5] hover:bg-[#f1f1ef]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-[14px]">{sheet.name}</h4>
                      <p className={cx("mt-0.5 text-[12px]", muted)}>{fmt(sheet.totalItems)} items · {fmt(sheet.totalQuantity, 1)} qty</p>
                    </div>
                    <Chip tone={(sheet.lowStockItems?.length || 0) ? "rose" : "mint"} darkMode={darkMode} className="h-6 shrink-0 text-[11.5px]">{fmt(sheet.lowStockItems?.length || 0)} low</Chip>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(sheet.categories || []).slice(0, 4).map((category) => (
                      <span key={category.name} className={cx("rounded-full px-2.5 py-0.5 text-[11.5px]", darkMode ? "bg-white/10 text-white/65" : "bg-white text-[#5f5f5c]")}>{category.name} · {category.items}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={cx("rounded-[20px] border p-5", card)}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <IconTile icon={PackageSearch} tone="peach" darkMode={darkMode} size="sm" />
                <div>
                  <h3 className="text-[15px]">{activeSheetLabel}</h3>
                  <p className={cx("text-[12.5px]", muted)}>{items.length} visible items</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-72">
                  <SoftDropdown darkMode={darkMode} value={activeSheet} options={sheetOptions} onChange={setActiveSheet} placeholder="Choose sheet" />
                </div>
                <label className={cx(fieldClass(darkMode), "w-auto min-w-64 cursor-text")}>
                  <Search className={cx("h-4 w-4 shrink-0", muted)} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock..." className="min-w-0 flex-1 bg-transparent outline-none" />
                </label>
              </div>
            </div>
            <div className="mt-4 max-h-[520px] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                <thead className={cx("sticky top-0", darkMode ? "bg-[#15171c]" : "bg-white")}>
                  <tr className={muted}>
                    <th className="px-4 pb-2.5 pt-1 text-[12px] font-normal">Item</th>
                    <th className="px-4 pb-2.5 pt-1 text-[12px] font-normal">Category</th>
                    <th className="px-4 pb-2.5 pt-1 text-[12px] font-normal">Sheet</th>
                    <th className="px-4 pb-2.5 pt-1 text-right text-[12px] font-normal">Qty</th>
                    <th className="px-4 pb-2.5 pt-1 text-[12px] font-normal">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const low = item.quantity <= Math.max(0, item.reorderMin || 0);
                    return (
                      <tr key={`${item.sheetName}-${item.rowNumber}-${item.itemName}`} className={cx("border-t", darkMode ? "border-white/[0.07]" : "border-[#f0f0ee]")}>
                        <td className="px-4 py-3">{item.itemName}</td>
                        <td className={cx("px-4 py-3", darkMode ? "text-white/65" : "text-[#5f5f5c]")}>{item.category || "-"}</td>
                        <td className={cx("px-4 py-3", darkMode ? "text-white/65" : "text-[#5f5f5c]")}>{item.sheetName}</td>
                        <td className="px-4 py-3 text-right"><Chip tone={low ? "rose" : "mint"} darkMode={darkMode} className="h-6 tabular-nums">{fmt(item.quantity, 1)}</Chip></td>
                        <td className={cx("px-4 py-3", darkMode ? "text-white/65" : "text-[#5f5f5c]")}>{item.unit || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!items.length && (
                <EmptyState darkMode={darkMode} icon={PackageSearch} tone="neutral" title="No stock rows" text={`No parsed stock rows found for ${activeSheetLabel}.`} />
              )}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function StockSiteTable({ darkMode, sites, canManage, onOpen, onEdit, onDelete }) {
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
        <thead>
          <tr className={muted}>
            <th className="px-4 pb-2.5 pt-1 text-[12px] font-normal">Site</th>
            <th className="px-4 pb-2.5 pt-1 text-[12px] font-normal">Sheets</th>
            <th className="px-4 pb-2.5 pt-1 text-right text-[12px] font-normal">Items</th>
            <th className="px-4 pb-2.5 pt-1 text-right text-[12px] font-normal">Qty</th>
            <th className="px-4 pb-2.5 pt-1 text-right text-[12px] font-normal">Low</th>
            <th className="px-4 pb-2.5 pt-1 text-right text-[12px] font-normal" />
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const hasError = Boolean(site.error);
            return (
              <tr key={site.id} className={cx("border-t transition-colors", darkMode ? "border-white/[0.07] hover:bg-white/[0.03]" : "border-[#f0f0ee] hover:bg-[#fafaf9]")}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <IconTile icon={hasError ? AlertTriangle : <span className="text-[13px]">{initials(site.name)}</span>} tone={hasError ? "rose" : siteTone(site.name)} darkMode={darkMode} size="md" />
                    <div className="min-w-0">
                      <p className="text-[14px]">{site.name}</p>
                      <p className={cx("mt-0.5 max-w-[240px] truncate text-[12px]", hasError ? "text-[#c0394b]" : muted)}>{hasError ? site.error : site.linkedFileName || "Linked stock file"}</p>
                    </div>
                  </div>
                </td>
                <td className={cx("px-4 py-3.5 tabular-nums", darkMode ? "text-white/65" : "text-[#5f5f5c]")}>{fmt(site.summary?.sheets)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums">{fmt(site.summary?.totalItems)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums">{fmt(site.summary?.totalQuantity, 1)}</td>
                <td className="px-4 py-3.5 text-right"><Chip tone={site.summary?.lowStock ? "rose" : "neutral"} darkMode={darkMode} className="h-6 tabular-nums">{fmt(site.summary?.lowStock)}</Chip></td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <>
                        <Button darkMode={darkMode} variant="soft" size="sm" icon={Pencil} onClick={() => onEdit(site)}>Edit</Button>
                        <button type="button" aria-label="Remove site" onClick={() => onDelete(site)} className={cx("grid h-8 w-8 place-items-center rounded-full transition-colors", darkMode ? "bg-rose-400/10 text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d5d9]")}><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                    <Button darkMode={darkMode} variant="secondary" size="sm" iconRight={ChevronRight} onClick={() => onOpen(site)}>View detail</Button>
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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";

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

  // Display-only totals for the stat tiles, from the server summary when it sends one.
  const totals = useMemo(() => {
    const all = data?.sites || [];
    const sum = (key) => all.reduce((total, site) => total + (Number(site.summary?.[key]) || 0), 0);
    const summary = data?.summary || {};
    return {
      sites: summary.sites ?? all.length,
      sheets: summary.totalSheets ?? sum("sheets"),
      items: summary.totalItems ?? sum("totalItems"),
      low: summary.lowStock ?? sum("lowStock"),
    };
  }, [data?.sites, data?.summary]);

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
      <main className={cx("flex min-h-0 flex-1 items-center justify-center p-5", darkMode ? "text-white" : "text-[#141414]")}>
        <div className={cx("w-full max-w-md rounded-[24px] border p-7", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
          <IconTile icon={Package} tone="mint" darkMode={darkMode} size="lg" />
          <h2 className="mt-5 text-[20px] tracking-[-0.01em]">Opening stock workspace</h2>
          <p className={cx("mt-1 text-[13px]", muted)}>Reading linked site stock sheets and preparing dashboard cards.</p>
          <div className={cx("mt-6 h-1.5 overflow-hidden rounded-full", darkMode ? "bg-white/10" : "bg-[#f0f0ee]")}><div className={cx("h-full w-1/3 animate-pulse rounded-full", darkMode ? "bg-[#cff07a]" : "bg-[#141414]")} /></div>
        </div>
      </main>
    );
  }

  return (
    <main className={cx("min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8", darkMode ? "text-white" : "text-[#141414]")}>
      <PageHeader
        darkMode={darkMode}
        badge="Projects · Stock"
        badgeIcon={Warehouse}
        badgeTone="mint"
        title="Site stock"
        subtitle="what's on hand, where"
        description="Track site and warehouse inventory from linked Google Sheets, even when each workbook uses a different stock layout."
        actions={<>
          <Button darkMode={darkMode} variant="secondary" onClick={() => load(true)}><RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} /> Refresh</Button>
          {data?.canManage && <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={openAdd}>Add site</Button>}
        </>}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile darkMode={darkMode} icon={Warehouse} tone="mint" value={fmt(totals.sites)} label="Linked sites" />
        <StatTile darkMode={darkMode} icon={Layers3} tone="sky" value={fmt(totals.sheets)} label="Sheet tabs" />
        <StatTile darkMode={darkMode} icon={Boxes} tone="lavender" value={fmt(totals.items)} label="Stock items" />
        <StatTile darkMode={darkMode} icon={AlertTriangle} tone="rose" value={fmt(totals.low)} label="Low or zero stock" />
      </div>

      <section className={cx("mt-6 rounded-[20px] border p-5", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex shrink-0 items-center gap-3">
            <IconTile icon={PackageSearch} tone="peach" darkMode={darkMode} size="sm" />
            <div>
              <h2 className="text-[15px]">Stock locations</h2>
              <p className={cx("text-[12.5px]", muted)}>{sites.length} visible site{sites.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <label className={cx(fieldClass(darkMode), "cursor-text lg:w-80")}>
            <Search className={cx("h-4 w-4 shrink-0", muted)} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search site, sheet, category..." className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
        </div>

        {sites.length ? (
          <StockSiteTable darkMode={darkMode} sites={sites} canManage={data?.canManage} onOpen={setSelectedSite} onEdit={openEdit} onDelete={deleteSite} />
        ) : (
          <EmptyState
            darkMode={darkMode}
            icon={FileSpreadsheet}
            tone="mint"
            title="No stock sites linked yet"
            text="Add a site and paste its Google Sheet link. The dashboard will read all tabs and build the stock cards automatically."
            action={data?.canManage && <Button darkMode={darkMode} variant="primary" icon={Plus} onClick={openAdd}>Add first site</Button>}
          />
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
