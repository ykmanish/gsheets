"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowDownToLine, ArrowRightLeft, ArrowUpRight, History, CircleDollarSign, FileSpreadsheet, Loader2, MessageSquarePlus, MessageSquareText, RefreshCw, Save, Settings2, ShieldAlert, Sparkles, SpellCheck2, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import AccountsGoogleGuard, { GoogleSessionButton, financePage, muteFor } from "./AccountsGoogleGuard";
import { Button, Chip, DateInput, EmptyState, Highlight, IconTile, PageHeader, StatTile, toneOf } from "./ui";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.data = data;
    throw error;
  }
  return data;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function shortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// Both CRBR sheets are typed DD/MM/YYYY, so every date shown here uses that
// form. The YYYY-MM-DD key is only ever an internal sort order.
function sheetDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
}

function rowTitle(record = {}) {
  return [record.projectName, record.particulars || record.paidParticulars].filter(Boolean).join(" · ") || "CRBR entry";
}

const PILL_TONES = { green: "mint", red: "rose", amber: "amber", blue: "sky", slate: "neutral" };

function StatusPill({ children, tone = "slate", darkMode, icon }) {
  return <Chip tone={PILL_TONES[tone] || "neutral"} icon={icon} darkMode={darkMode}>{children}</Chip>;
}

// A name typed in the raw sheet that does not exactly match what accounts already uses.
function NameFlag({ issue, darkMode }) {
  if (!issue) return null;
  const t = toneOf(issue.type === "new" ? "sky" : "amber");
  const label = issue.type === "new"
    ? "New name"
    : issue.type === "spelling"
      ? `Usually "${issue.suggestion}"`
      : `Did you mean "${issue.suggestion}"?`;
  return (
    <span style={{ backgroundColor: darkMode ? t[2] : t[0], color: darkMode ? t[3] : t[1] }} className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px]">
      <SpellCheck2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

// One card per destination tab, so the split of the day's money is visible before syncing.
function DestinationCard({ target, darkMode, tone }) {
  if (!target) return null;
  const rows = target.pending?.length || 0;
  const totals = target.totals || {};
  const t = toneOf(tone === "receipt" ? "mint" : "sky");
  const Icon = tone === "receipt" ? ArrowDownLeft : ArrowUpRight;
  return (
    <div style={{ backgroundColor: darkMode ? t[2] : t[0] }} className="rounded-[20px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span style={{ color: darkMode ? t[3] : t[1] }} className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${darkMode ? "bg-white/10" : "bg-white/70"}`}>
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px]">{target.label}</p>
            <p className={`truncate text-[12.5px] ${muteFor(darkMode)}`}>{target.tabName ? `tab "${target.tabName}"` : "no tab set"}</p>
          </div>
        </div>
        <StatusPill tone={target.ok ? (rows ? "amber" : "slate") : "red"} darkMode={darkMode}>
          {target.ok ? (rows ? `${rows} row${rows === 1 ? "" : "s"}` : "nothing new") : "tab missing"}
        </StatusPill>
      </div>
      <p className={`mt-5 text-[30px] leading-none tracking-[-0.03em] tabular-nums ${darkMode ? "text-white" : "text-[#141414]"}`}>{money(totals.total)}</p>
      <div className={`mt-4 grid grid-cols-3 gap-2 border-t pt-3 ${darkMode ? "border-white/10" : "border-black/[0.06]"}`}>
        {[["Cash", totals.cash], ["Bank", totals.bankAll], ["Others", totals.others]].map(([label, value]) => (
          <div key={label}>
            <p className={`text-[12px] ${muteFor(darkMode)}`}>{label}</p>
            <p className="mt-0.5 text-[13.5px] tabular-nums">{money(value)}</p>
          </div>
        ))}
      </div>
      {!target.ok && target.error ? <p className="mt-3 text-[12.5px] text-[#c0394b]">{target.error}</p> : null}
    </div>
  );
}

const rowCard = (darkMode) => (darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]");
const headCell = (muted) => `px-4 py-2 text-[12px] font-normal ${muted}`;

// The rows actually heading into one tab — full detail, not just a count.
function RouteRows({ target, rows, darkMode, tone, muted, onOpenRemark }) {
  if (!target || !rows?.length) return null;
  const t = toneOf(tone === "receipt" ? "mint" : "sky");
  const accent = { color: darkMode ? t[3] : t[1] };
  return (
    <div className="mt-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: darkMode ? t[3] : t[1] }} />
        <p className="text-[14.5px]">{target.label}</p>
        <p className={`text-[12.5px] ${muted}`}>tab &quot;{target.tabName}&quot;</p>
        <p className="ml-auto text-[13.5px] tabular-nums" style={accent}>{rows.length} row{rows.length === 1 ? "" : "s"} · {money(target.totals?.total)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr>{["Row", "Date", "Main head", "Site / project", "Vendor / particulars", "Voucher", "Cash", "Bank", "Others", "Total", "Note"].map((heading) => (
              <th key={heading} className={headCell(muted)}>{heading}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id} className={rowCard(darkMode)}>
                <td className={`rounded-l-[14px] px-4 py-3 text-[13px] tabular-nums ${muted}`} title="Row number in Mam's sheet">{record.rowNumber || "-"}</td>
                <td className="px-4 py-3 text-[13px]">{sheetDate(record.dateKey) || record.date}</td>
                <td className="px-4 py-3 text-[13px]">{record.mainHead || "-"}</td>
                <td className="max-w-[200px] px-4 py-3 text-[13px]"><p className="truncate">{record.projectName || "-"}</p></td>
                <td className="max-w-[220px] px-4 py-3 text-[13px]"><p className="truncate">{record.particulars || record.paidParticulars || "-"}</p></td>
                <td className={`px-4 py-3 text-[13px] ${muted}`}>{record.voucherNumber || "-"}</td>
                <td className="px-4 py-3 text-[13px] tabular-nums">{money(record.cash)}</td>
                <td className="px-4 py-3 text-[13px] tabular-nums">{money(record.bankAll)}</td>
                <td className="px-4 py-3 text-[13px] tabular-nums">{money(record.others)}</td>
                <td className="px-4 py-3 text-[13.5px] tabular-nums" style={accent}>{money(record.total)}</td>
                <td className="rounded-r-[14px] px-4 py-3"><RemarkButton record={record} darkMode={darkMode} onOpen={onOpenRemark} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// One cell of the raw sheet, rendered by what its column actually is. Money
// columns are right-aligned and blank when zero, so a row of twenty bank
// accounts stays readable instead of becoming a wall of noughts.
function CrbrCell({ column, record, darkMode, muted, issue }) {
  const value = record.cells?.[column.key];
  const isMoney = column.key === "cash" || column.key === "total" || typeof value === "number";

  if (column.key === "date") {
    return (
      <td className="whitespace-nowrap px-4 py-3 text-[13px]">
        {sheetDate(record.dateKey) || record.date}
        {record.reimport ? (
          <span className={`mt-1 flex items-center gap-1 text-[11.5px] ${darkMode ? "text-amber-200" : "text-[#8a6200]"}`} title="This row was imported before and is not in Mam's sheet now">
            <History className="h-3 w-3 shrink-0" /> Imported before
          </span>
        ) : null}
      </td>
    );
  }

  if (column.key === "total") {
    return (
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13.5px] tabular-nums">
        {money(record.total)}
        {!record.tallyOk && <span className="mt-1 block text-[11.5px] text-[#c0394b]">Tally {money(record.tallyAmount)}</span>}
      </td>
    );
  }

  if (isMoney) {
    const amount = Number(value) || 0;
    return (
      <td className={`whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums ${amount ? "" : muted}`}>
        {amount ? money(amount) : "-"}
      </td>
    );
  }

  return (
    <td className="max-w-[200px] px-4 py-3 text-[13px]">
      <p className="truncate" title={String(value ?? "")}>{String(value ?? "") || "-"}</p>
      <NameFlag issue={issue} darkMode={darkMode} />
    </td>
  );
}

function RemarkButton({ record, darkMode, onOpen }) {
  const has = Boolean(record.remark?.text);
  const t = toneOf("amber");
  return (
    <button
      type="button"
      onClick={() => onOpen(record)}
      title={has ? record.remark.text : "Add a note for your own reference"}
      style={has ? { backgroundColor: darkMode ? t[2] : t[0], color: darkMode ? t[3] : t[1] } : undefined}
      className={`flex h-7 max-w-[190px] items-center gap-1.5 rounded-full px-3 text-left text-[12px] transition hover:opacity-80 ${
        has ? "" : darkMode ? "bg-white/[0.06] text-white/50" : "bg-white text-[#8a8a8a]"
      }`}
    >
      {has ? <MessageSquareText className="h-3.5 w-3.5 shrink-0" /> : <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{has ? record.remark.text : "Note"}</span>
    </button>
  );
}

// A white section card with a pastel icon tile and a two-line title.
function Panel({ darkMode, icon, tone, title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`rounded-[20px] border p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"} ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <IconTile icon={icon} tone={tone} darkMode={darkMode} />
            <div className="min-w-0">
              <h2 className="text-[19px] leading-tight tracking-[-0.02em]">{title}</h2>
              {subtitle ? <div className={`mt-1 text-[13px] leading-5 ${muteFor(darkMode)}`}>{subtitle}</div> : null}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function settingsInput(darkMode) {
  return `h-11 w-full rounded-full border px-4 text-[13.5px] outline-none transition ${
    darkMode
      ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10"
      : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"
  }`;
}

function SettingField({ darkMode, label, hint, children }) {
  return (
    <label className="block">
      <span className={`mb-2 block text-[12.5px] ${darkMode ? "text-white/55" : "text-[#7a7a78]"}`}>{label}</span>
      {children}
      {hint ? <span className={`mt-2 block text-[12px] leading-5 ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>{hint}</span> : null}
    </label>
  );
}

function AccountsDashboardInner({ darkMode, gate, signOutGoogle }) {
  const [data, setData] = useState(null);
  const [intake, setIntake] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [remarkTarget, setRemarkTarget] = useState(null);
  const [remarkText, setRemarkText] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ rawSheetUrl: "", rawTab: "", rawStartDate: "", sourceSheetUrl: "", sourceTab: "", targetSheetUrl: "", targetReceiptTab: "", targetExpenseTab: "" });
  const muted = muteFor(darkMode);
  const inputClass = settingsInput(darkMode);

  const setSettingsFormFromData = useCallback((settings = {}) => {
    setSettingsForm({
      rawSheetUrl: settings.rawSheetUrl || (settings.rawSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${settings.rawSpreadsheetId}/edit` : ""),
      rawTab: settings.rawTab || "",
      rawStartDate: settings.rawStartDate || "",
      sourceSheetUrl: settings.sourceSheetUrl || (settings.sourceSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${settings.sourceSpreadsheetId}/edit` : ""),
      sourceTab: settings.sourceTab || "",
      targetSheetUrl: settings.targetSheetUrl || (settings.targetSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${settings.targetSpreadsheetId}/edit` : ""),
      targetReceiptTab: settings.targetReceiptTab || "",
      targetExpenseTab: settings.targetExpenseTab || settings.targetTab || "",
    });
  }, []);

  const loadAll = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    const [previewResult, intakeResult] = await Promise.allSettled([
      api("/accounts/crbr/preview"),
      api("/accounts/crbr/intake"),
    ]);
    if (previewResult.status === "fulfilled") {
      setData(previewResult.value);
      if (previewResult.value.settings) setSettingsFormFromData(previewResult.value.settings);
    } else if (!quiet) {
      toast.error(previewResult.reason?.message || "Could not load CRBR preview");
    }
    if (intakeResult.status === "fulfilled") setIntake(intakeResult.value);
    else if (!quiet) toast.error(intakeResult.reason?.message || "Could not read the raw CRBR sheet");
    setLoading(false);
  }, [setSettingsFormFromData]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function sync() {
    try {
      setSyncing(true);
      const result = await api("/accounts/crbr/sync", { method: "POST" });
      toast.success(`Synced ${result.syncedRows} CRBR entr${result.syncedRows === 1 ? "y" : "ies"}`);
      await loadAll({ quiet: true });
    } catch (error) {
      if (error.data) setData(error.data);
      toast.error(error.message || "CRBR sync stopped");
    } finally {
      setSyncing(false);
    }
  }

  async function importSelected() {
    const rowIds = [...selected];
    if (!rowIds.length) return;
    try {
      setImporting(true);
      const result = await api("/accounts/crbr/intake/import", { method: "POST", body: JSON.stringify({ rowIds }) });
      toast.success(`Imported ${result.importedRows} row${result.importedRows === 1 ? "" : "s"} into Mam's sheet`);
      // Copied across as they stand, so say so rather than letting a tally
      // problem travel into the sheet unannounced.
      if (result.unbalancedRows) {
        toast(`${result.unbalancedRows} of them do not tally in the raw sheet — worth a check`, { icon: "⚠️" });
      }
      setSelected(new Set());
      await loadAll({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Could not import rows");
    } finally {
      setImporting(false);
    }
  }

  function openRemark(record) {
    setRemarkTarget(record);
    setRemarkText(record.remark?.text || "");
  }

  async function saveRemark() {
    if (!remarkTarget) return;
    try {
      setRemarkSaving(true);
      await api("/accounts/crbr/remark", { method: "PUT", body: JSON.stringify({ rowId: remarkTarget.id, text: remarkText }) });
      toast.success(remarkText.trim() ? "Note saved" : "Note removed");
      setRemarkTarget(null);
      await loadAll({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Could not save the note");
    } finally {
      setRemarkSaving(false);
    }
  }

  function updateSettingsField(field, value) {
    setSettingsForm((current) => ({ ...current, [field]: value }));
  }

  async function saveSettings() {
    try {
      setSettingsSaving(true);
      const result = await api("/accounts/crbr/settings", { method: "PUT", body: JSON.stringify(settingsForm) });
      toast.success("CRBR sheet settings saved");
      if (result.settings) setSettingsFormFromData(result.settings);
      setSettingsOpen(false);
      await loadAll({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Could not save CRBR settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  const blockers = useMemo(() => ({
    conflicts: data?.conflicts?.length || 0,
    tally: data?.tallyIssues?.length || 0,
    duplicates: data?.sourceDuplicates?.length || 0,
    vouchers: data?.voucherDuplicates?.length || 0,
    protected: data?.syncBlocked ? 1 : 0,
    missingTab: data?.missingTab?.length || 0,
  }), [data]);
  const blockedCount = blockers.conflicts + blockers.tally + blockers.duplicates + blockers.vouchers + blockers.protected + blockers.missingTab;
  const skippedCount = data?.routing?.skippedCount || 0;
  const receiptRows = useMemo(() => (data?.pending || []).filter((record) => record.route === "receipt"), [data]);
  const expenseRows = useMemo(() => (data?.pending || []).filter((record) => record.route === "expense"), [data]);
  const pendingCount = data?.pending?.length || 0;
  // A fresh [] on every render made every useMemo keyed on it re-run each time.
  const newRows = useMemo(() => intake?.newRows || [], [intake]);
  // Every new row can be imported. A tally mismatch is flagged on the row and in
  // the header, but it no longer locks the checkbox — one odd row in the raw
  // sheet was holding back every good row behind it.
  const importableIds = useMemo(() => newRows.map((record) => record.id), [newRows]);
  const untalliedCount = useMemo(() => newRows.filter((record) => !record.tallyOk).length, [newRows]);
  // The raw sheet's own headers, up to and including Total. The backend stops
  // the list there, so Remarks never appears and never travels to Mam's sheet.
  const sheetColumns = useMemo(() => intake?.raw?.columns || [], [intake]);
  const allSelected = importableIds.length > 0 && importableIds.every((id) => selected.has(id));
  const nameSummary = intake?.nameSummary || { spelling: 0, nearMatch: 0, newName: 0 };
  const nameFlagCount = nameSummary.spelling + nameSummary.nearMatch + nameSummary.newName;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(importableIds));
  }

  function toggleOne(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className={financePage(darkMode)}>
      <div className="mx-auto max-w-[1500px]">
      <PageHeader
        darkMode={darkMode}
        badge="Finance · accounts"
        badgeIcon={FileSpreadsheet}
        badgeTone="sky"
        title="CRBR sync"
        subtitle="from the raw sheet to all projects"
        description="Raw CRBR entries land here first for checking, then go into Mam's sheet. From there they are synced into the all ongoing project sheet once conflicts and amount tallies are clean."
        actions={(
          <>
            <GoogleSessionButton gate={gate} onSignOut={signOutGoogle} darkMode={darkMode} />
            <Button darkMode={darkMode} variant="secondary" icon={settingsOpen ? X : Settings2} onClick={() => setSettingsOpen((current) => !current)}>
              Settings
            </Button>
            <Button darkMode={darkMode} variant="secondary" icon={RefreshCw} loading={loading} onClick={() => loadAll()} disabled={loading || syncing || importing}>
              Refresh
            </Button>
            <Button darkMode={darkMode} variant="primary" icon={ArrowRightLeft} loading={syncing} onClick={sync} disabled={!data?.canSync || syncing || loading || !gate.canManage}>
              Sync to all projects
            </Button>
          </>
        )}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {intake?.enabled && <StatusPill tone={newRows.length ? "amber" : "slate"} darkMode={darkMode}>{newRows.length ? `${newRows.length} to import` : "Raw sheet clear"}</StatusPill>}
        <StatusPill tone={blockedCount ? "red" : pendingCount ? "amber" : "green"} darkMode={darkMode}>
          {blockedCount ? `${blockedCount} blocker${blockedCount === 1 ? "" : "s"}` : pendingCount ? `${pendingCount} ready to sync` : "All synced"}
        </StatusPill>
      </div>

      {!!(newRows.length || pendingCount || blockedCount) && (
        blockedCount ? (
          <div className={`mt-6 flex flex-col gap-3 rounded-[20px] px-5 py-4 sm:flex-row sm:items-center ${darkMode ? "bg-rose-400/10 text-white" : "bg-[#fbe4e6] text-[#141414]"}`}>
            <ShieldAlert className={`h-5 w-5 shrink-0 ${darkMode ? "text-rose-200" : "text-[#c0394b]"}`} strokeWidth={1.8} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px]">CRBR sync needs review</p>
              <p className={`text-[12.5px] ${darkMode ? "text-white/60" : "text-[#5c1f1c]"}`}>Resolve the blocker, then sync the pending entries.</p>
            </div>
            <p className={`text-[12px] ${darkMode ? "text-white/50" : "text-[#5c1f1c]/70"}`}>Checked {shortDate(data?.checkedAt || intake?.checkedAt)}</p>
          </div>
        ) : (
          <Highlight
            darkMode={darkMode}
            icon={Sparkles}
            className="mt-6"
            title={newRows.length ? `${newRows.length} new row${newRows.length === 1 ? "" : "s"} in the raw CRBR sheet` : "New CRBR entries found"}
            text={newRows.length
              ? "Check them below, add notes if needed, then import into Mam's sheet."
              : "Review the new entries and sync them into the all ongoing project sheet."}
            action={<span className={`hidden text-[12px] sm:block ${darkMode ? "text-white/50" : "text-[#3d4a1a]/70"}`}>Checked {shortDate(data?.checkedAt || intake?.checkedAt)}</span>}
          />
        )
      )}

      {loading && !data && !intake ? (
        <section className={`mt-6 grid min-h-[360px] place-items-center rounded-[20px] ${darkMode ? "bg-white/[0.03]" : "bg-[#f7f7f5]"}`}>
          <div className={`flex items-center gap-3 text-[13.5px] ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /> Reading CRBR sheets…</div>
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile darkMode={darkMode} icon={ArrowDownToLine} tone={newRows.length ? "amber" : "neutral"} value={newRows.length} label="New in raw" />
            <StatTile darkMode={darkMode} icon={ArrowRightLeft} tone="sky" value={pendingCount} label="Pending rows" />
            <StatTile darkMode={darkMode} icon={History} tone="lavender" value={skippedCount} label="Not synced" hint="company heads" />
            <StatTile darkMode={darkMode} icon={CircleDollarSign} tone={blockedCount ? "rose" : "mint"} value={money(data?.totals?.total)} label="Pending total" />
          </section>

          {/* ── Step 1 · raw sheet → Mam's sheet ── */}
          {intake?.enabled ? (
            <Panel
              darkMode={darkMode}
              className="mt-6"
              icon={ArrowDownToLine}
              tone="amber"
              title="New in raw CRBR"
              subtitle={(
                <>
                  <p>
                    {intake.raw?.workbookTitle || "Raw sheet"} · {intake.raw?.tabName} to {intake.mam?.tabName}
                    {intake.alreadyInMam ? ` · ${intake.alreadyInMam} already in Mam's sheet` : ""}
                    {intake.previouslyImported ? ` · ${intake.previouslyImported} imported before but no longer there` : ""}
                  </p>
                  {intake.skippedByStartDate?.startDate ? (
                    <p>
                      Reading from <span className={darkMode ? "text-white" : "text-[#141414]"}>{sheetDate(intake.skippedByStartDate.startDate)}</span> onward
                      {intake.skippedByStartDate.before ? ` · ${intake.skippedByStartDate.before} earlier ${intake.skippedByStartDate.before === 1 ? "entry" : "entries"} skipped` : ""}
                      {intake.skippedByStartDate.undated ? ` · ${intake.skippedByStartDate.undated} skipped with no date` : ""}
                    </p>
                  ) : null}
                  {!!nameFlagCount && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {!!nameSummary.spelling && <StatusPill tone="amber" darkMode={darkMode}>{nameSummary.spelling} spelling</StatusPill>}
                      {!!nameSummary.nearMatch && <StatusPill tone="amber" darkMode={darkMode}>{nameSummary.nearMatch} close match</StatusPill>}
                      {!!nameSummary.newName && <StatusPill tone="blue" darkMode={darkMode}>{nameSummary.newName} new name</StatusPill>}
                      {!!untalliedCount && <StatusPill tone="red" darkMode={darkMode}>{untalliedCount} do not tally</StatusPill>}
                    </div>
                  )}
                </>
              )}
              actions={(
                <Button darkMode={darkMode} variant="primary" icon={ArrowDownToLine} loading={importing} onClick={importSelected} disabled={!selected.size || importing || loading || !gate.canManage} className="shrink-0">
                  {selected.size ? `Import ${selected.size} to Mam's sheet` : "Import to Mam's sheet"}
                </Button>
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[2200px] border-separate border-spacing-y-1.5 text-left">
                  <thead>
                    <tr>
                      <th className="px-3 py-2">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!importableIds.length} className="h-4 w-4 cursor-pointer accent-[#141414]" aria-label="Select all importable rows" />
                      </th>
                      <th className={headCell(muted)}>Row</th>
                      {sheetColumns.map((column) => (
                        <th key={column.key} className={`whitespace-nowrap ${headCell(muted)}`}>{column.label}</th>
                      ))}
                      <th className={headCell(muted)}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newRows.slice(0, 120).map((record) => {
                      const projectIssue = (record.nameIssues || []).find((issue) => issue.field === "projectName");
                      const vendorIssue = (record.nameIssues || []).find((issue) => issue.field === "particulars");
                      return (
                        <tr key={record.id} className={record.tallyOk ? rowCard(darkMode) : darkMode ? "bg-rose-400/[0.08]" : "bg-[#fdf0f1]"}>
                          <td className="rounded-l-[14px] px-3 py-3">
                            <input type="checkbox" checked={selected.has(record.id)} onChange={() => toggleOne(record.id)} title={record.tallyOk ? "" : "Amounts do not tally in the raw sheet — it will still be copied across as it stands"} className="h-4 w-4 cursor-pointer accent-[#141414]" />
                          </td>
                          <td className={`px-4 py-3 text-[13px] tabular-nums ${muted}`} title="Row number in the raw sheet">{record.rowNumber || "-"}</td>
                          {sheetColumns.map((column) => (
                            <CrbrCell
                              key={column.key}
                              column={column}
                              record={record}
                              darkMode={darkMode}
                              muted={muted}
                              issue={column.key === "projectname" ? projectIssue : column.key === "particulars" ? vendorIssue : null}
                            />
                          ))}
                          <td className="rounded-r-[14px] px-4 py-3"><RemarkButton record={record} darkMode={darkMode} onOpen={openRemark} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!newRows.length && <EmptyState darkMode={darkMode} icon={Sparkles} tone="mint" title="Nothing new in the raw sheet" className="py-8" />}
              </div>

              {!!(intake.conflicts?.length || intake.rawDuplicates?.length) && (
                <div className="mt-4 grid gap-2">
                  {(intake.conflicts || []).map((item, index) => (
                    <BlockerRow
                      key={`intake-conflict-${index}`}
                      darkMode={darkMode}
                      icon={AlertTriangle}
                      title={rowTitle(item.raw)}
                      text={`${item.reason} — raw total ${money(item.raw.total)}, Mam sheet total ${money(item.mam.total)} (raw row ${item.raw.rowNumber}, Mam row ${item.mam.rowNumber}).`}
                    />
                  ))}
                  {(intake.rawDuplicates || []).map((item) => (
                    <BlockerRow
                      key={`intake-dup-${item.record.id}-${item.record.rowNumber}`}
                      darkMode={darkMode}
                      icon={AlertTriangle}
                      title={rowTitle(item.record)}
                      text={`Same entry appears twice in the raw sheet — rows ${item.firstRow} and ${item.record.rowNumber}. Only the first will be imported.`}
                    />
                  ))}
                </div>
              )}
            </Panel>
          ) : (
            <Panel
              darkMode={darkMode}
              className="mt-6"
              icon={FileSpreadsheet}
              tone="neutral"
              title="Raw CRBR sheet is not linked yet"
              subtitle="Add the raw CRBR sheet link in Settings to see new entries here before they go into Mam's sheet."
            />
          )}

          {/* ── What is going where, row by row ── */}
          <Panel
            darkMode={darkMode}
            className="mt-6"
            icon={ArrowRightLeft}
            tone="sky"
            title="Going to the all-projects sheet"
            subtitle={(
              <>
                <p>{data?.source?.workbookTitle || "Mam sheet"} · {data?.source?.tabName} to {data?.target?.tabName}</p>
                {data?.skippedByStartDate?.startDate ? (
                  <p>
                    Reading from <span className={darkMode ? "text-white" : "text-[#141414]"}>{sheetDate(data.skippedByStartDate.startDate)}</span> onward
                    {data.skippedByStartDate.before ? ` · ${data.skippedByStartDate.before} earlier ${data.skippedByStartDate.before === 1 ? "entry" : "entries"} skipped` : ""}
                    {data.skippedByStartDate.undated ? ` · ${data.skippedByStartDate.undated} skipped with no date` : ""}
                  </p>
                ) : null}
              </>
            )}
            actions={(
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone={pendingCount ? "amber" : "slate"} darkMode={darkMode}>{money(data?.totals?.total)} total</StatusPill>
                <StatusPill tone={data?.canSync ? "green" : pendingCount ? "amber" : "slate"} darkMode={darkMode}>
                  {data?.canSync ? "Ready" : pendingCount ? "Review needed" : "Clear"}
                </StatusPill>
              </div>
            )}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <DestinationCard target={data?.targets?.receipt} darkMode={darkMode} tone="receipt" />
              <DestinationCard target={data?.targets?.expense} darkMode={darkMode} tone="expense" />
            </div>

            <RouteRows target={data?.targets?.receipt} rows={receiptRows} darkMode={darkMode} tone="receipt" muted={muted} onOpenRemark={openRemark} />
            <RouteRows target={data?.targets?.expense} rows={expenseRows} darkMode={darkMode} tone="expense" muted={muted} onOpenRemark={openRemark} />

            {!pendingCount && <EmptyState darkMode={darkMode} icon={ArrowRightLeft} tone="sky" title="Nothing waiting to be synced" className="mt-4 py-8" />}

            {skippedCount ? (
              <p className={`mt-4 text-[12.5px] leading-5 ${muted}`}>
                Only <span className={darkMode ? "text-white" : "text-[#141414]"}>{(data?.routing?.receiptHeads || []).join(", ") || "—"}</span> and <span className={darkMode ? "text-white" : "text-[#141414]"}>{(data?.routing?.expenseHeads || []).join(", ") || "—"}</span> go to the all-projects sheet.
                {` The other ${skippedCount} row${skippedCount === 1 ? "" : "s"} (${money(data?.routing?.skippedTotals?.total)}) are company heads and stay in Mam's sheet only.`}
              </p>
            ) : null}
          </Panel>


          {!!blockedCount && (
            <Panel darkMode={darkMode} className="mt-6" icon={ShieldAlert} tone="rose" title="Review blockers" subtitle="Each one stops the sync until it is fixed in the sheet.">
              <div className="grid gap-2">
                {(data?.conflicts || []).map((item, index) => <BlockerRow key={`conflict-${index}`} darkMode={darkMode} icon={AlertTriangle} title={rowTitle(item.source)} text={item.reason} />)}
                {(data?.tallyIssues || []).map((item) => <BlockerRow key={`tally-${item.record.id}`} darkMode={darkMode} icon={CircleDollarSign} title={rowTitle(item.record)} text={`Cash + Bank + Others is ${money(item.expected)}, but Total is ${money(item.actual)}.`} />)}
                {(data?.sourceDuplicates || []).map((item) => <BlockerRow key={`dup-${item.record.id}-${item.record.rowNumber}`} darkMode={darkMode} icon={AlertTriangle} title={rowTitle(item.record)} text={`Duplicate found in Mam sheet at row ${item.record.rowNumber}. First copy is row ${item.firstRow}.`} />)}
                {(data?.voucherDuplicates || []).map((item) => <BlockerRow key={`voucher-${item.voucherNumber}`} darkMode={darkMode} icon={AlertTriangle} title={`Duplicate voucher ${item.voucherNumber}`} text={`Found ${item.count} times in Mam CRBR rows ${item.rows.join(", ")}.`} />)}
                {(data?.missingTab || []).map((message, index) => <BlockerRow key={`missing-tab-${index}`} darkMode={darkMode} icon={ShieldAlert} title="Destination tab not found" text={message} />)}
                {data?.syncBlocked && <BlockerRow darkMode={darkMode} icon={ShieldAlert} title="Target rows are protected" text={data.syncBlocked.message} />}
              </div>
            </Panel>
          )}
        </>
      )}
      </div>

      {remarkTarget && (
        <div className="ui-backdrop fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRemarkTarget(null); }}>
          <form onSubmit={(event) => { event.preventDefault(); void saveRemark(); }} style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop w-full max-w-lg rounded-[24px] border p-6 newq ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <IconTile icon={MessageSquareText} tone="amber" darkMode={darkMode} size="sm" />
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] leading-tight">{rowTitle(remarkTarget)}</h2>
                  <p className={`mt-1 text-[12.5px] ${muted}`}>Note for this row · {sheetDate(remarkTarget.dateKey) || remarkTarget.date} · {money(remarkTarget.total)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setRemarkTarget(null)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`} aria-label="Close note"><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={remarkText}
              onChange={(event) => setRemarkText(event.target.value)}
              rows={4}
              maxLength={1000}
              autoFocus
              placeholder="Anything worth remembering about this entry..."
              className={`mt-5 w-full rounded-[16px] border p-4 text-[13.5px] outline-none ${darkMode ? "border-transparent bg-white/[0.06] text-white/85 placeholder:text-white/30" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white"}`}
            />
            <p className={`mt-2 text-[12px] ${muted}`}>Stays in this dashboard only — nothing is written into the Google Sheet.</p>
            {remarkTarget.remark?.updatedBy?.name && (
              <p className={`mt-1 text-[12px] ${muted}`}>Last edited by {remarkTarget.remark.updatedBy.name} · {shortDate(remarkTarget.remark.updatedAt)}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button darkMode={darkMode} variant="secondary" onClick={() => setRemarkTarget(null)}>Cancel</Button>
              <Button darkMode={darkMode} variant="primary" type="submit" icon={Save} loading={remarkSaving} disabled={remarkSaving}>Save note</Button>
            </div>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <form onSubmit={(event) => { event.preventDefault(); void saveSettings(); }} className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,0.16)] newq animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <div className={`shrink-0 border-b px-6 py-5 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile icon={Settings2} tone="sky" darkMode={darkMode} size="sm" />
                  <div className="min-w-0">
                    <h2 className="text-[17px] leading-tight">CRBR sheet settings</h2>
                    <p className={`mt-1 text-[12.5px] leading-5 ${muted}`}>Paste sheet links and tab names here. Sync will use these saved settings.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSettingsOpen(false)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`} aria-label="Close settings">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-5">
                <p className="text-[15px]">Raw sheet <span className={muted}>· step 1</span></p>
                <SettingField darkMode={darkMode} label="Raw CRBR sheet link" hint="Where the day's entries are typed. Leave blank if you are not using it yet.">
                  <input value={settingsForm.rawSheetUrl} onChange={(event) => updateSettingsField("rawSheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={inputClass} />
                </SettingField>
                <SettingField darkMode={darkMode} label="Raw CRBR tab name">
                  <input value={settingsForm.rawTab} onChange={(event) => updateSettingsField("rawTab", event.target.value)} placeholder="Sheet1" className={inputClass} />
                </SettingField>
                <div className="block">
                  <span className={`mb-2 block text-[12.5px] ${darkMode ? "text-white/55" : "text-[#7a7a78]"}`}>Read raw entries from</span>
                  <DateInput darkMode={darkMode} value={settingsForm.rawStartDate} onChange={(event) => updateSettingsField("rawStartDate", event.target.value)} />
                  <span className={`mt-2 block text-[12px] leading-5 ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>
                    Applies to both steps: only entries dated on or after this day are read from the raw sheet into Mam&apos;s sheet, and on from there into the all-projects sheet. Anything earlier is left alone, and nothing already in either sheet is changed or removed. Leave blank to read everything.
                  </span>
                  {settingsForm.rawStartDate ? (
                    <Button darkMode={darkMode} variant="soft" size="sm" icon={X} onClick={() => updateSettingsField("rawStartDate", "")} className="mt-2">
                      Clear the date
                    </Button>
                  ) : null}
                </div>

                <p className={`mt-3 border-t pt-5 text-[15px] ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>Mam&apos;s sheet <span className={muted}>· step 2</span></p>
                <SettingField darkMode={darkMode} label="Mam CRBR sheet link">
                  <input value={settingsForm.sourceSheetUrl} onChange={(event) => updateSettingsField("sourceSheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={inputClass} />
                </SettingField>
                <SettingField darkMode={darkMode} label="Mam CRBR tab name">
                  <input value={settingsForm.sourceTab} onChange={(event) => updateSettingsField("sourceTab", event.target.value)} placeholder="Sheet19" className={inputClass} />
                </SettingField>

                <p className={`mt-3 border-t pt-5 text-[15px] ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>All-projects sheet <span className={muted}>· destination</span></p>
                <SettingField darkMode={darkMode} label="All ongoing project sheet link">
                  <input value={settingsForm.targetSheetUrl} onChange={(event) => updateSettingsField("targetSheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={inputClass} />
                </SettingField>
                <SettingField darkMode={darkMode} label="Client receipt tab name" hint="Rows whose Main_Head is a receipt land here.">
                  <input value={settingsForm.targetReceiptTab} onChange={(event) => updateSettingsField("targetReceiptTab", event.target.value)} placeholder="Client Receipt" className={inputClass} />
                </SettingField>
                <SettingField darkMode={darkMode} label="Project expense tab name" hint="Every other Main_Head lands here.">
                  <input value={settingsForm.targetExpenseTab} onChange={(event) => updateSettingsField("targetExpenseTab", event.target.value)} placeholder="Project Expense" className={inputClass} />
                </SettingField>
              </div>
            </div>

            <div className={`flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4 ${darkMode ? "border-white/10 bg-[#121317]" : "border-[#f0f0ee] bg-white"}`}>
              <Button darkMode={darkMode} variant="secondary" size="lg" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button darkMode={darkMode} variant="primary" size="lg" type="submit" icon={Save} loading={settingsSaving} disabled={settingsSaving}>Save settings</Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function BlockerRow({ darkMode, icon, title, text }) {
  return (
    <div className={`flex items-start gap-3 rounded-[14px] p-4 ${darkMode ? "bg-rose-400/[0.08]" : "bg-[#fdf0f1]"}`}>
      <IconTile icon={icon} tone="rose" darkMode={darkMode} size="sm" />
      <div className="min-w-0">
        <p className="text-[13.5px]">{title}</p>
        <p className={`mt-0.5 text-[13px] leading-5 ${darkMode ? "text-white/60" : "text-[#6f6f6c]"}`}>{text}</p>
      </div>
    </div>
  );
}

export default function AccountsDashboard({ darkMode }) {
  return (
    <AccountsGoogleGuard darkMode={darkMode} title="Accounts">
      {({ gate, signOutGoogle }) => <AccountsDashboardInner darkMode={darkMode} gate={gate} signOutGoogle={signOutGoogle} />}
    </AccountsGoogleGuard>
  );
}
