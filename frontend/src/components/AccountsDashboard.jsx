"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowDownToLine, ArrowRightLeft, ArrowUpRight, History, CircleDollarSign, FileSpreadsheet, Loader2, MessageSquarePlus, MessageSquareText, RefreshCw, Save, Settings2, ShieldAlert, Sparkles, SpellCheck2, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import AccountsGoogleGuard, { GoogleSessionButton, muteFor } from "./AccountsGoogleGuard";

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

function StatusPill({ children, tone = "slate", darkMode }) {
  const tones = {
    green: darkMode ? "bg-emerald-300/10 text-emerald-200" : "bg-emerald-100 text-emerald-700",
    red: darkMode ? "bg-rose-300/10 text-rose-200" : "bg-rose-100 text-rose-700",
    amber: darkMode ? "bg-amber-300/10 text-amber-200" : "bg-amber-100 text-amber-700",
    blue: darkMode ? "bg-blue-300/10 text-blue-200" : "bg-blue-100 text-blue-700",
    slate: darkMode ? "bg-white/10 text-white/65" : "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

// A name typed in the raw sheet that does not exactly match what accounts already uses.
function NameFlag({ issue, darkMode }) {
  if (!issue) return null;
  const tone = issue.type === "new"
    ? darkMode ? "bg-blue-300/10 text-blue-200" : "bg-blue-50 text-blue-700"
    : darkMode ? "bg-amber-300/10 text-amber-200" : "bg-amber-50 text-amber-700";
  const label = issue.type === "new"
    ? "New name"
    : issue.type === "spelling"
      ? `Usually "${issue.suggestion}"`
      : `Did you mean "${issue.suggestion}"?`;
  return (
    <span className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${tone}`}>
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
  const accent = tone === "receipt"
    ? darkMode ? "bg-emerald-300/10" : "bg-[#effdf4]"
    : darkMode ? "bg-blue-300/10" : "bg-[#eef4ff]";
  const Icon = tone === "receipt" ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className={`rounded-[24px] p-5 ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white ${tone === "receipt" ? "bg-emerald-500" : "bg-blue-500"}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black">{target.label}</p>
            <p className={`truncate text-xs font-bold ${muteFor(darkMode)}`}>{target.tabName ? `tab "${target.tabName}"` : "no tab set"}</p>
          </div>
        </div>
        <StatusPill tone={target.ok ? (rows ? "amber" : "slate") : "red"} darkMode={darkMode}>
          {target.ok ? (rows ? `${rows} row${rows === 1 ? "" : "s"}` : "nothing new") : "tab missing"}
        </StatusPill>
      </div>
      <p className={`mt-4 text-3xl font-black ${tone === "receipt" ? "text-emerald-600" : "text-blue-600"}`}>{money(totals.total)}</p>
      <div className={`mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}>
        {[["Cash", totals.cash], ["Bank", totals.bankAll], ["Others", totals.others]].map(([label, value]) => (
          <div key={label}>
            <p className={`font-black uppercase tracking-wide ${muteFor(darkMode)}`}>{label}</p>
            <p className="mt-1 text-sm font-bold">{money(value)}</p>
          </div>
        ))}
      </div>
      {!target.ok && target.error ? <p className="mt-3 text-xs font-bold text-rose-500">{target.error}</p> : null}
    </div>
  );
}

// The rows actually heading into one tab — full detail, not just a count.
function RouteRows({ target, rows, darkMode, tone, muted, onOpenRemark }) {
  if (!target || !rows?.length) return null;
  const accent = tone === "receipt" ? "text-emerald-600" : "text-blue-600";
  const dot = tone === "receipt" ? "bg-emerald-500" : "bg-blue-500";
  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <p className="text-sm font-black">{target.label}</p>
        <p className={`text-xs font-bold ${muted}`}>tab &quot;{target.tabName}&quot;</p>
        <p className={`ml-auto text-sm font-black ${accent}`}>{rows.length} row{rows.length === 1 ? "" : "s"} · {money(target.totals?.total)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-separate border-spacing-y-2 text-left">
          <thead>
            <tr>{["Row", "Date", "Main head", "Site / project", "Vendor / particulars", "Voucher", "Cash", "Bank", "Others", "Total", "Note"].map((heading) => (
              <th key={heading} className={`px-4 py-2 text-[11px] font-black uppercase tracking-wide ${muted}`}>{heading}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id} className={darkMode ? "bg-white/[0.04]" : "bg-[#f8f9fc]"}>
                <td className={`rounded-l-2xl px-4 py-3 text-sm tabular-nums ${muted}`} title="Row number in Mam's sheet">{record.rowNumber || "-"}</td>
                <td className="px-4 py-3 text-sm font-semibold">{sheetDate(record.dateKey) || record.date}</td>
                <td className="px-4 py-3 text-sm font-semibold">{record.mainHead || "-"}</td>
                <td className="max-w-[200px] px-4 py-3 text-sm"><p className="truncate">{record.projectName || "-"}</p></td>
                <td className="max-w-[220px] px-4 py-3 text-sm"><p className="truncate">{record.particulars || record.paidParticulars || "-"}</p></td>
                <td className={`px-4 py-3 text-sm ${muted}`}>{record.voucherNumber || "-"}</td>
                <td className="px-4 py-3 text-sm">{money(record.cash)}</td>
                <td className="px-4 py-3 text-sm">{money(record.bankAll)}</td>
                <td className="px-4 py-3 text-sm">{money(record.others)}</td>
                <td className={`px-4 py-3 text-sm font-black ${accent}`}>{money(record.total)}</td>
                <td className="rounded-r-2xl px-4 py-3"><RemarkButton record={record} darkMode={darkMode} onOpen={onOpenRemark} /></td>
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
      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold">
        {sheetDate(record.dateKey) || record.date}
        {record.reimport ? (
          <span className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${darkMode ? "text-amber-200" : "text-amber-600"}`} title="This row was imported before and is not in Mam's sheet now">
            <History className="h-3 w-3 shrink-0" /> Imported before
          </span>
        ) : null}
      </td>
    );
  }

  if (column.key === "total") {
    return (
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black tabular-nums">
        {money(record.total)}
        {!record.tallyOk && <span className="mt-1 block text-[11px] font-bold text-rose-500">Tally {money(record.tallyAmount)}</span>}
      </td>
    );
  }

  if (isMoney) {
    const amount = Number(value) || 0;
    return (
      <td className={`whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums ${amount ? "" : muted}`}>
        {amount ? money(amount) : "-"}
      </td>
    );
  }

  return (
    <td className="max-w-[200px] px-4 py-3 text-sm">
      <p className="truncate" title={String(value ?? "")}>{String(value ?? "") || "-"}</p>
      <NameFlag issue={issue} darkMode={darkMode} />
    </td>
  );
}

function RemarkButton({ record, darkMode, onOpen }) {
  const has = Boolean(record.remark?.text);
  return (
    <button
      type="button"
      onClick={() => onOpen(record)}
      title={has ? record.remark.text : "Add a note for your own reference"}
      className={`flex max-w-[190px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left text-xs font-bold transition ${
        has
          ? darkMode ? "bg-amber-300/10 text-amber-200 hover:bg-amber-300/15" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          : darkMode ? "bg-white/[0.06] text-white/45 hover:bg-white/10" : "bg-black/[0.04] text-black/40 hover:bg-black/[0.07]"
      }`}
    >
      {has ? <MessageSquareText className="h-3.5 w-3.5 shrink-0" /> : <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{has ? record.remark.text : "Note"}</span>
    </button>
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
  const muted = darkMode ? "text-white/50" : "text-black/50";
  const panel = darkMode ? "border-transparent bg-[#15171c]" : "border-black/[0.06] bg-white";
  const soft = darkMode ? "border-transparent bg-white/[0.04]" : "border-black/[0.06] bg-[#fbfbfd]";
  const inputClass = `mt-2 h-11 w-full rounded-2xl border px-3 text-sm font-normal outline-none ${darkMode ? "border-white/10 bg-[#0d0f13] text-white/80 placeholder:text-white/30" : "border-black/10 bg-white text-black/75 placeholder:text-black/35"}`;

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
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
      {!!(newRows.length || pendingCount || blockedCount) && (
        <section className={`mb-5 rounded-[28px] border px-5 py-4 ${blockedCount ? darkMode ? "border-transparent bg-rose-300/10" : "border-rose-100 bg-rose-50" : darkMode ? "border-transparent bg-emerald-300/10" : "border-emerald-100 bg-[#effdf4]"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${blockedCount ? "bg-rose-500 text-white" : "bg-[#6ee72f] text-[#10210c]"}`}>
                {blockedCount ? <ShieldAlert className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </span>
              <div>
                <h2 className="small text-xl font-black">
                  {blockedCount ? "CRBR sync needs review" : newRows.length ? `${newRows.length} new row${newRows.length === 1 ? "" : "s"} in the raw CRBR sheet` : "New CRBR entries found"}
                </h2>
                <p className={`mt-1 text-sm leading-6 ${darkMode ? "text-white/65" : "text-black/60"}`}>
                  {blockedCount
                    ? "Resolve the blocker, then sync the pending entries."
                    : newRows.length
                      ? "Check them below, add notes if needed, then import into Mam's sheet."
                      : "Review the new entries and sync them into the all ongoing project sheet."}
                </p>
              </div>
            </div>
            <p className={`text-xs font-bold ${muted}`}>Checked {shortDate(data?.checkedAt || intake?.checkedAt)}</p>
          </div>
        </section>
      )}

      <section className={`overflow-hidden rounded-[30px] border p-6 sm:p-8 ${panel}`}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="blue" darkMode={darkMode}><FileSpreadsheet className="mr-2 h-4 w-4" /> Accounts</StatusPill>
              {intake?.enabled && <StatusPill tone={newRows.length ? "amber" : "slate"} darkMode={darkMode}>{newRows.length ? `${newRows.length} to import` : "Raw sheet clear"}</StatusPill>}
              <StatusPill tone={blockedCount ? "red" : pendingCount ? "amber" : "green"} darkMode={darkMode}>
                {blockedCount ? `${blockedCount} blocker${blockedCount === 1 ? "" : "s"}` : pendingCount ? `${pendingCount} ready to sync` : "All synced"}
              </StatusPill>
            </div>
            <h1 className="small mt-5 text-4xl font-black leading-none">CRBR sync dashboard</h1>
            <p className={`mt-3 max-w-2xl text-sm leading-6 ${muted}`}>
              Raw CRBR entries land here first for checking, then go into Mam&apos;s sheet. From there they are synced into the all ongoing project sheet once conflicts and amount tallies are clean.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-[auto_auto_auto_minmax(190px,auto)] sm:justify-start xl:w-auto xl:justify-end">
            <GoogleSessionButton gate={gate} onSignOut={signOutGoogle} darkMode={darkMode} />
            <button type="button" onClick={() => setSettingsOpen((current) => !current)} className={`flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition ${darkMode ? "border-white/10 bg-white/10" : "border-black/10 bg-white"}`}>
              {settingsOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />} Settings
            </button>
            <button type="button" onClick={() => loadAll()} disabled={loading || syncing || importing} className={`flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition disabled:opacity-50 ${darkMode ? "border-white/10 bg-white/10" : "border-black/10 bg-white"}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </button>
            <button type="button" onClick={sync} disabled={!data?.canSync || syncing || loading || !gate.canManage} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#6ee72f] px-5 text-sm font-black text-[#10210c] transition hover:bg-[#5edb22] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-70">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Sync to all projects
            </button>
          </div>
        </div>
      </section>

      {loading && !data && !intake ? (
        <section className={`mt-5 grid min-h-[360px] place-items-center rounded-[30px] border ${panel}`}>
          <div className={`flex items-center gap-3 text-sm font-semibold ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /> Reading CRBR sheets...</div>
        </section>
      ) : (
        <>
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["New in raw", newRows.length, newRows.length ? "amber" : "slate"],
              ["Pending rows", pendingCount, "blue"],
              ["Not synced", skippedCount, "slate"],
              ["Pending total", money(data?.totals?.total), blockedCount ? "red" : "green"],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-[24px] border p-5 ${soft}`}>
                <p className={`text-xs font-black uppercase tracking-wide ${muted}`}>{label}</p>
                <p className={`mt-3 text-2xl font-black ${tone === "red" ? "text-rose-500" : tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-500" : ""}`}>{value}</p>
              </div>
            ))}
          </section>

          {/* ── Step 1 · raw sheet → Mam's sheet ── */}
          {intake?.enabled ? (
            <section className={`mt-5 rounded-[30px] border p-5 sm:p-6 ${panel}`}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h2 className="small text-2xl font-black">New in raw CRBR</h2>
                  <p className={`mt-1 text-sm ${muted}`}>
                    {intake.raw?.workbookTitle || "Raw sheet"} · {intake.raw?.tabName} to {intake.mam?.tabName}
                    {intake.alreadyInMam ? ` · ${intake.alreadyInMam} already in Mam's sheet` : ""}
                    {intake.previouslyImported ? ` · ${intake.previouslyImported} imported before but no longer there` : ""}
                  </p>
                  {intake.skippedByStartDate?.startDate ? (
                    <p className={`mt-1 text-sm ${muted}`}>
                      Reading from <b>{sheetDate(intake.skippedByStartDate.startDate)}</b> onward
                      {intake.skippedByStartDate.before ? ` · ${intake.skippedByStartDate.before} earlier ${intake.skippedByStartDate.before === 1 ? "entry" : "entries"} skipped` : ""}
                      {intake.skippedByStartDate.undated ? ` · ${intake.skippedByStartDate.undated} skipped with no date` : ""}
                    </p>
                  ) : null}
                  {!!nameFlagCount && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!!nameSummary.spelling && <StatusPill tone="amber" darkMode={darkMode}>{nameSummary.spelling} spelling</StatusPill>}
                      {!!nameSummary.nearMatch && <StatusPill tone="amber" darkMode={darkMode}>{nameSummary.nearMatch} close match</StatusPill>}
                      {!!nameSummary.newName && <StatusPill tone="blue" darkMode={darkMode}>{nameSummary.newName} new name</StatusPill>}
                      {!!untalliedCount && <StatusPill tone="red" darkMode={darkMode}>{untalliedCount} do not tally</StatusPill>}
                    </div>
                  )}
                </div>
                <button type="button" onClick={importSelected} disabled={!selected.size || importing || loading || !gate.canManage} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#6ee72f] px-5 text-sm font-black text-[#10210c] transition hover:bg-[#5edb22] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-70">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                  {selected.size ? `Import ${selected.size} to Mam's sheet` : "Import to Mam's sheet"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[2200px] border-separate border-spacing-y-2 text-left">
                  <thead>
                    <tr>
                      <th className="px-3 py-3">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!importableIds.length} className="h-4 w-4 cursor-pointer accent-[#6ee72f]" aria-label="Select all importable rows" />
                      </th>
                      <th className={`px-4 py-3 text-[11px] font-black uppercase tracking-wide ${muted}`}>Row</th>
                      {sheetColumns.map((column) => (
                        <th key={column.key} className={`whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-wide ${muted}`}>{column.label}</th>
                      ))}
                      <th className={`px-4 py-3 text-[11px] font-black uppercase tracking-wide ${muted}`}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newRows.slice(0, 120).map((record) => {
                      const projectIssue = (record.nameIssues || []).find((issue) => issue.field === "projectName");
                      const vendorIssue = (record.nameIssues || []).find((issue) => issue.field === "particulars");
                      return (
                        <tr key={record.id} className={record.tallyOk ? darkMode ? "bg-white/[0.04]" : "bg-[#f8f9fc]" : darkMode ? "bg-rose-300/[0.07]" : "bg-rose-50"}>
                          <td className="rounded-l-2xl px-3 py-3">
                            <input type="checkbox" checked={selected.has(record.id)} onChange={() => toggleOne(record.id)} title={record.tallyOk ? "" : "Amounts do not tally in the raw sheet — it will still be copied across as it stands"} className="h-4 w-4 cursor-pointer accent-[#6ee72f]" />
                          </td>
                          <td className={`px-4 py-3 text-sm tabular-nums ${muted}`} title="Row number in the raw sheet">{record.rowNumber || "-"}</td>
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
                          <td className="rounded-r-2xl px-4 py-3"><RemarkButton record={record} darkMode={darkMode} onOpen={openRemark} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!newRows.length && <div className={`grid min-h-[150px] place-items-center text-sm ${muted}`}>Nothing new in the raw sheet.</div>}
              </div>

              {!!(intake.conflicts?.length || intake.rawDuplicates?.length) && (
                <div className="mt-4 grid gap-3">
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
            </section>
          ) : (
            <section className={`mt-5 rounded-[30px] border p-5 sm:p-6 ${panel}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-white/10" : "bg-black/[0.05]"}`}><FileSpreadsheet className="h-5 w-5" /></span>
                <div>
                  <h2 className="small text-xl font-black">Raw CRBR sheet is not linked yet</h2>
                  <p className={`mt-1 text-sm leading-6 ${muted}`}>Add the raw CRBR sheet link in Settings to see new entries here before they go into Mam&apos;s sheet.</p>
                </div>
              </div>
            </section>
          )}

          {/* ── What is going where, row by row ── */}
          <section className={`mt-5 rounded-[30px] border p-5 sm:p-6 ${panel}`}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="small text-2xl font-black">Going to the all-projects sheet</h2>
                <p className={`mt-1 text-sm ${muted}`}>
                  {data?.source?.workbookTitle || "Mam sheet"} · {data?.source?.tabName} to {data?.target?.tabName}
                </p>
                {data?.skippedByStartDate?.startDate ? (
                  <p className={`mt-1 text-sm ${muted}`}>
                    Reading from <b>{sheetDate(data.skippedByStartDate.startDate)}</b> onward
                    {data.skippedByStartDate.before ? ` · ${data.skippedByStartDate.before} earlier ${data.skippedByStartDate.before === 1 ? "entry" : "entries"} skipped` : ""}
                    {data.skippedByStartDate.undated ? ` · ${data.skippedByStartDate.undated} skipped with no date` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={pendingCount ? "amber" : "slate"} darkMode={darkMode}>{money(data?.totals?.total)} total</StatusPill>
                <StatusPill tone={data?.canSync ? "green" : pendingCount ? "amber" : "slate"} darkMode={darkMode}>
                  {data?.canSync ? "Ready" : pendingCount ? "Review needed" : "Clear"}
                </StatusPill>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DestinationCard target={data?.targets?.receipt} darkMode={darkMode} tone="receipt" />
              <DestinationCard target={data?.targets?.expense} darkMode={darkMode} tone="expense" />
            </div>

            <RouteRows target={data?.targets?.receipt} rows={receiptRows} darkMode={darkMode} tone="receipt" muted={muted} onOpenRemark={openRemark} />
            <RouteRows target={data?.targets?.expense} rows={expenseRows} darkMode={darkMode} tone="expense" muted={muted} onOpenRemark={openRemark} />

            {!pendingCount && <div className={`grid min-h-[140px] place-items-center text-sm ${muted}`}>Nothing waiting to be synced.</div>}

            {skippedCount ? (
              <p className={`mt-4 text-xs ${muted}`}>
                Only <strong>{(data?.routing?.receiptHeads || []).join(", ") || "—"}</strong> and <strong>{(data?.routing?.expenseHeads || []).join(", ") || "—"}</strong> go to the all-projects sheet.
                {` The other ${skippedCount} row${skippedCount === 1 ? "" : "s"} (${money(data?.routing?.skippedTotals?.total)}) are company heads and stay in Mam's sheet only.`}
              </p>
            ) : null}
          </section>


          {!!blockedCount && (
            <section className={`mt-5 rounded-[30px] border p-5 sm:p-6 ${panel}`}>
              <h2 className="small text-2xl font-black">Review blockers</h2>
              <div className="mt-4 grid gap-3">
                {(data?.conflicts || []).map((item, index) => <BlockerRow key={`conflict-${index}`} darkMode={darkMode} icon={AlertTriangle} title={rowTitle(item.source)} text={item.reason} />)}
                {(data?.tallyIssues || []).map((item) => <BlockerRow key={`tally-${item.record.id}`} darkMode={darkMode} icon={CircleDollarSign} title={rowTitle(item.record)} text={`Cash + Bank + Others is ${money(item.expected)}, but Total is ${money(item.actual)}.`} />)}
                {(data?.sourceDuplicates || []).map((item) => <BlockerRow key={`dup-${item.record.id}-${item.record.rowNumber}`} darkMode={darkMode} icon={AlertTriangle} title={rowTitle(item.record)} text={`Duplicate found in Mam sheet at row ${item.record.rowNumber}. First copy is row ${item.firstRow}.`} />)}
                {(data?.voucherDuplicates || []).map((item) => <BlockerRow key={`voucher-${item.voucherNumber}`} darkMode={darkMode} icon={AlertTriangle} title={`Duplicate voucher ${item.voucherNumber}`} text={`Found ${item.count} times in Mam CRBR rows ${item.rows.join(", ")}.`} />)}
                {(data?.missingTab || []).map((message, index) => <BlockerRow key={`missing-tab-${index}`} darkMode={darkMode} icon={ShieldAlert} title="Destination tab not found" text={message} />)}
                {data?.syncBlocked && <BlockerRow darkMode={darkMode} icon={ShieldAlert} title="Target rows are protected" text={data.syncBlocked.message} />}
              </div>
            </section>
          )}
        </>
      )}

      {remarkTarget && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setRemarkTarget(null); }}>
          <form onSubmit={(event) => { event.preventDefault(); void saveRemark(); }} className={`w-full max-w-lg rounded-[28px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-xs font-black uppercase tracking-[0.16em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Note for this row</p>
                <h2 className="small mt-2 truncate text-xl font-black">{rowTitle(remarkTarget)}</h2>
                <p className={`mt-1 text-sm ${muted}`}>{sheetDate(remarkTarget.dateKey) || remarkTarget.date} · {money(remarkTarget.total)}</p>
              </div>
              <button type="button" onClick={() => setRemarkTarget(null)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/10 hover:bg-white/15" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc]"}`} aria-label="Close note"><X className="h-5 w-5" /></button>
            </div>
            <textarea
              value={remarkText}
              onChange={(event) => setRemarkText(event.target.value)}
              rows={4}
              maxLength={1000}
              autoFocus
              placeholder="Anything worth remembering about this entry..."
              className={`mt-4 w-full rounded-2xl border p-3 text-sm outline-none ${darkMode ? "border-white/10 bg-[#0d0f13] text-white/85 placeholder:text-white/30" : "border-black/10 bg-white text-black/80 placeholder:text-black/35"}`}
            />
            <p className={`mt-2 text-xs ${muted}`}>Stays in this dashboard only — nothing is written into the Google Sheet.</p>
            {remarkTarget.remark?.updatedBy?.name && (
              <p className={`mt-1 text-xs ${muted}`}>Last edited by {remarkTarget.remark.updatedBy.name} · {shortDate(remarkTarget.remark.updatedAt)}</p>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setRemarkTarget(null)} className={`h-11 rounded-full px-5 text-sm font-bold transition ${darkMode ? "bg-white/10 hover:bg-white/15" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc]"}`}>Cancel</button>
              <button type="submit" disabled={remarkSaving} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:opacity-60">
                {remarkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save note
              </button>
            </div>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-[mrn-backdrop-in_280ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <form onSubmit={(event) => { event.preventDefault(); void saveSettings(); }} className={`employee-report-shell employee-settings-shell absolute flex flex-col overflow-hidden shadow-[-24px_0_80px_rgba(0,0,0,0.22)] animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#171714]"}`}>
            <div className={`border-b px-5 py-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-black uppercase tracking-[0.16em] ${darkMode ? "text-white/40" : "text-black/40"}`}>Accounts setup</p>
                  <h2 className="small mt-2 text-2xl font-black">CRBR sheet settings</h2>
                  <p className={`mt-1 text-sm leading-6 ${muted}`}>Paste sheet links and tab names here. Sync will use these saved settings.</p>
                </div>
                <button type="button" onClick={() => setSettingsOpen(false)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`} aria-label="Close settings">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4">
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Raw CRBR sheet link</span>
                  <input value={settingsForm.rawSheetUrl} onChange={(event) => updateSettingsField("rawSheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>Where the day&apos;s entries are typed. Leave blank if you are not using it yet.</span>
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Raw CRBR tab name</span>
                  <input value={settingsForm.rawTab} onChange={(event) => updateSettingsField("rawTab", event.target.value)} placeholder="Sheet1" className={inputClass} />
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Read raw entries from</span>
                  <input type="date" value={settingsForm.rawStartDate} onChange={(event) => updateSettingsField("rawStartDate", event.target.value)} className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>
                    Applies to both steps: only entries dated on or after this day are read from the raw sheet into Mam&apos;s sheet, and on from there into the all-projects sheet. Anything earlier is left alone, and nothing already in either sheet is changed or removed. Leave blank to read everything.
                  </span>
                  {settingsForm.rawStartDate ? (
                    <button
                      type="button"
                      onClick={() => updateSettingsField("rawStartDate", "")}
                      className={`mt-2 text-xs font-bold ${darkMode ? "text-white/60 hover:text-white" : "text-black/50 hover:text-black"}`}
                    >
                      Clear the date
                    </button>
                  ) : null}
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Mam CRBR sheet link</span>
                  <input value={settingsForm.sourceSheetUrl} onChange={(event) => updateSettingsField("sourceSheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={inputClass} />
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Mam CRBR tab name</span>
                  <input value={settingsForm.sourceTab} onChange={(event) => updateSettingsField("sourceTab", event.target.value)} placeholder="Sheet19" className={inputClass} />
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>All ongoing project sheet link</span>
                  <input value={settingsForm.targetSheetUrl} onChange={(event) => updateSettingsField("targetSheetUrl", event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className={inputClass} />
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Client receipt tab name</span>
                  <input value={settingsForm.targetReceiptTab} onChange={(event) => updateSettingsField("targetReceiptTab", event.target.value)} placeholder="Client Receipt" className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>Rows whose Main_Head is a receipt land here.</span>
                </label>
                <label className={`block rounded-[22px] p-4 ${darkMode ? "bg-white/[0.035]" : "bg-[#fbfbfd]"}`}>
                  <span className={`text-xs font-black uppercase tracking-wide ${muted}`}>Project expense tab name</span>
                  <input value={settingsForm.targetExpenseTab} onChange={(event) => updateSettingsField("targetExpenseTab", event.target.value)} placeholder="Project Expense" className={inputClass} />
                  <span className={`mt-2 block text-xs ${muted}`}>Every other Main_Head lands here.</span>
                </label>
              </div>
            </div>

            <div className={`flex items-center justify-between gap-3 border-t px-5 py-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/10 bg-white"}`}>
              <button type="button" onClick={() => setSettingsOpen(false)} className={`h-11 rounded-full px-5 text-sm font-bold transition ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#f3f5ef] text-black/60 hover:bg-[#eafbdc] hover:text-[#4b9b16]"}`}>Cancel</button>
              <button type="submit" disabled={settingsSaving} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#89ed3f] px-6 text-sm font-bold text-black hover:bg-[#7dde35] disabled:cursor-not-allowed disabled:opacity-60">
                {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function BlockerRow({ darkMode, icon: Icon, title, text }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${darkMode ? "border-transparent bg-rose-300/10" : "border-rose-100 bg-rose-50"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500 text-white"><Icon className="h-4 w-4" /></span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className={`mt-1 text-sm ${darkMode ? "text-white/60" : "text-black/58"}`}>{text}</p>
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
