import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Bell,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Lock,
  MessageCircleMore,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  UserCog,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { DateRangePicker, SelectMenu } from "./ui";

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
  { value: "250", label: "250 per page" },
  { value: "500", label: "500 per page" },
  { value: "1000", label: "1000 per page" },
  { value: "all", label: "Show all (no pagination)" },
];

const CATEGORY_LABELS = {
  auth: "Auth",
  admin: "Admin",
  document: "Document",
  automation: "Automation",
  notification: "Notification",
  report: "Report",
  whatsapp: "WhatsApp",
  system: "System",
};

// `page` lives inside the same state object as the filters so that changing a
// filter and resetting to page 1 happen in one update instead of cascading.
const DEFAULT_QUERY = {
  userId: "",
  category: "",
  status: "",
  search: "",
  from: "",
  to: "",
  sort: "newest",
  pageSize: "50",
  page: 1,
};

export default function ActivityLog({ darkMode }) {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLog, setDetailLog] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_QUERY);
  const [searchDraft, setSearchDraft] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersClosing, setFiltersClosing] = useState(false);
  const page = filters.page;

  const panel = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white/80 border border-black/5";
  const muted = darkMode ? "text-white/50" : "text-black/45";
  const chip = darkMode
    ? "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
    : "border-black/10 bg-white text-black/60 hover:bg-black/[0.04]";

  // Any filter change invalidates the page number, so patch both together.
  const patchFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  }, []);

  const goToPage = useCallback((next) => {
    setFilters((current) => ({ ...current, page: Math.max(1, next) }));
  }, []);

  // Let the slide-out animation finish before unmounting the drawer.
  const closeFilters = useCallback(() => {
    setFiltersClosing(true);
    window.setTimeout(() => {
      setFiltersOpen(false);
      setFiltersClosing(false);
    }, 260);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeFilters();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeFilters, filtersOpen]);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((current) =>
        current.search === searchDraft ? current : { ...current, search: searchDraft, page: 1 },
      );
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [searchDraft]);

  const loadLogs = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          pageSize: filters.pageSize,
          sort: filters.sort,
        });
        if (filters.userId) params.set("userId", filters.userId);
        if (filters.category) params.set("category", filters.category);
        if (filters.status) params.set("status", filters.status);
        if (filters.search) params.set("search", filters.search);
        if (filters.from) params.set("startDate", filters.from);
        if (filters.to) params.set("endDate", filters.to);
        const response = await fetch(`${API_URL}/activity-logs?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLogs(data.logs || []);
        setMeta(data);
        // The server clamps an out-of-range page; adopt what it actually served.
        if (data.page && data.page !== page) goToPage(data.page);
      } catch (error) {
        toast.error(error.message || "Could not load activity logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, goToPage, page],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadLogs(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadLogs]);

  const userOptions = useMemo(
    () => [
      { value: "", label: `All users${meta?.retained ? ` (${meta.retained})` : ""}` },
      ...(meta?.users || []).map((user) => ({
        value: user.id,
        label: `${user.displayName}${user.roleName ? ` - ${user.roleName}` : ""} (${user.count})`,
      })),
    ],
    [meta?.users, meta?.retained],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...(meta?.categories || []).map((item) => ({
        value: item.id,
        label: `${CATEGORY_LABELS[item.id] || item.id} (${item.count})`,
      })),
    ],
    [meta?.categories],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      ...(meta?.statuses || []).map((item) => ({
        value: item.id,
        label: `${item.id} (${item.count})`,
      })),
    ],
    [meta?.statuses],
  );

  const activeFilterCount = [
    filters.userId,
    filters.category,
    filters.status,
    filters.search,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  // A short window of page numbers around the current page.
  const pageWindow = useMemo(() => {
    const pageCount = meta?.pageCount || 1;
    const span = 5;
    let start = Math.max(1, page - Math.floor(span / 2));
    const end = Math.min(pageCount, start + span - 1);
    start = Math.max(1, end - span + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [meta?.pageCount, page]);

  function resetFilters() {
    setFilters(DEFAULT_QUERY);
    setSearchDraft("");
  }

  function getTargetLabel(log) {
    if (log.target) return log.target;
    const userMatch = log.path?.match(/\/admin\/users\/([^/]+)/);
    if (userMatch) return `User ID: ${userMatch[1]}`;
    const roleMatch = log.path?.match(/\/admin\/roles\/([^/]+)/);
    if (roleMatch) return `Role ID: ${roleMatch[1]}`;
    const documentMatch = log.path?.match(/\/documents\/([^/]+)/);
    if (documentMatch) return `Document ID: ${documentMatch[1]}`;
    return "N/A";
  }

  function truncateTarget(value) {
    const text = String(value || "N/A");
    return text.length > 15 ? `${text.slice(0, 15)}...` : text;
  }

  function formatDate(value) {
    if (!value) return "N/A";
    return new Date(value).toLocaleDateString();
  }

  function formatTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateTime(value) {
    if (!value) return "N/A";
    return new Date(value).toLocaleString();
  }

  function getCategoryMeta(log) {
    const category = log.category || "system";
    const map = {
      auth: { label: "Auth", Icon: Lock, color: darkMode ? "text-sky-300 bg-sky-500/10" : "text-sky-700 bg-sky-50" },
      admin: { label: "Admin", Icon: UserCog, color: darkMode ? "text-violet-300 bg-violet-500/10" : "text-violet-700 bg-violet-50" },
      document: { label: "Document", Icon: FileText, color: darkMode ? "text-[#d8f36a] bg-[#d8f36a]/10" : "text-green-700 bg-green-50" },
      automation: { label: "Automation", Icon: Bot, color: darkMode ? "text-cyan-300 bg-cyan-500/10" : "text-cyan-700 bg-cyan-50" },
      notification: { label: "Notification", Icon: Bell, color: darkMode ? "text-amber-300 bg-amber-500/10" : "text-amber-700 bg-amber-50" },
      report: { label: "Report", Icon: Shield, color: darkMode ? "text-fuchsia-300 bg-fuchsia-500/10" : "text-fuchsia-700 bg-fuchsia-50" },
      whatsapp: { label: "WhatsApp", Icon: MessageCircleMore, color: darkMode ? "text-emerald-300 bg-emerald-500/10" : "text-emerald-700 bg-emerald-50" },
      system: { label: "System", Icon: Settings, color: darkMode ? "text-white/60 bg-white/5" : "text-black/55 bg-black/5" },
    };
    return map[category] || map.system;
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden px-4 py-4 newq sm:px-6 lg:px-8 lg:py-8" style={{ background: darkMode ? "linear-gradient(180deg,#111318,#0c0d10)" : "linear-gradient(180deg,#f7f6f2,#f3f1ea)" }}>
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col">
        <div className={`mb-4 flex flex-shrink-0 flex-col gap-2 rounded-[22px] p-2.5 sm:flex-row sm:items-center ${panel}`}>
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search action, target, user, path or IP..."
              className={`h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none ${darkMode ? "border-white/10 bg-white/[0.035] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black placeholder:text-black/35"}`}
            />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition ${
                activeFilterCount > 0
                  ? darkMode
                    ? "border-[#d8f36a]/40 bg-[#d8f36a]/15 text-[#d8f36a]"
                    : "border-[#69c832] bg-[#eafbdc] text-[#4b9b16]"
                  : chip
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#4b9b16] text-white"}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => patchFilters({ sort: filters.sort === "newest" ? "oldest" : "newest" })}
              className={`flex h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-medium transition ${chip}`}
              title="Toggle date sort order"
            >
              {filters.sort === "newest" ? (
                <ArrowDownWideNarrow className="h-4 w-4" />
              ) : (
                <ArrowUpNarrowWide className="h-4 w-4" />
              )}
              <span className="hidden lg:inline">{filters.sort === "newest" ? "Newest" : "Oldest"}</span>
            </button>
            <button
              type="button"
              onClick={() => void loadLogs(true)}
              disabled={refreshing}
              aria-label="Refresh activity log"
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition disabled:opacity-60 ${chip}`}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className={`min-h-0 flex-1 overflow-hidden rounded-[30px] ${panel}`}>
          {loading ? (
            <div className="flex h-full items-center justify-center py-20">
              <Loader2 className={`h-7 w-7 animate-spin ${muted}`} />
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                    <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                      {["Date", "User", "Action", "Target", "Status", "Details"].map((header) => (
                        <th key={header} className={`px-5 py-4 text-[11px] uppercase tracking-[0.18em] font-medium ${muted}`}>
                          {header === "Date" ? (
                            <button
                              type="button"
                              onClick={() => patchFilters({ sort: filters.sort === "newest" ? "oldest" : "newest" })}
                              className={`flex items-center gap-1.5 uppercase tracking-[0.18em] transition ${darkMode ? "hover:text-white" : "hover:text-black"}`}
                              title="Toggle date sort order"
                            >
                              Date
                              {filters.sort === "newest" ? (
                                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : (
                            header
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-5 py-16 text-center">
                          <Activity className={`mx-auto mb-4 h-10 w-10 ${muted}`} />
                          <p className={`text-lg ${darkMode ? "text-white" : "text-black"}`}>
                            {activeFilterCount > 0 ? "No activity matches these filters" : "No activity yet"}
                          </p>
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={resetFilters}
                              className={`mt-4 rounded-full border px-4 py-2 text-sm transition ${chip}`}
                            >
                              Clear filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : logs.map((log) => {
                      const category = getCategoryMeta(log);
                      const CategoryIcon = category.Icon;
                      const targetLabel = getTargetLabel(log);
                      return (
                      <tr key={log.id} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                        <td className={`px-5 py-4 text-sm whitespace-nowrap ${muted}`}>
                          {formatDate(log.createdAt)}
                          <span className="mt-0.5 block text-xs">{formatTime(log.createdAt)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <p className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>{log.displayName || log.username || "System"}</p>
                          <p className={`mt-1 text-xs ${muted}`}>{log.roleName || log.username || "System"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${category.color}`}>
                              <CategoryIcon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>{log.action}</p>
                              <p className={`mt-0.5 text-[11px] ${muted}`}>{category.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`px-5 py-4 text-sm ${muted}`} title={targetLabel}>{truncateTarget(targetLabel)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                            log.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                          }`}>
                            {log.status === "failed" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setDetailLog(log)}
                            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                              darkMode ? "bg-white/5 text-white/70 hover:bg-white/10" : "bg-black/[0.04] text-black/60 hover:bg-black/[0.07]"
                            }`}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {meta && meta.total > 0 && (
                <div className={`flex flex-shrink-0 flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-white/10" : "border-black/5"}`}>
                  <p className={`text-xs ${muted}`}>
                    {meta.showingAll
                      ? `All ${meta.total} ${meta.total === 1 ? "entry" : "entries"} on one page`
                      : `Page ${meta.page} of ${meta.pageCount} - ${meta.rangeFrom}-${meta.rangeTo} of ${meta.total}`}
                    {meta.total !== meta.retained ? ` (filtered from ${meta.retained})` : ""}
                  </p>
                  {!meta.showingAll && meta.pageCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => goToPage(meta.page - 1)}
                        disabled={meta.page <= 1}
                        aria-label="Previous page"
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-40 ${chip}`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {pageWindow[0] > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => goToPage(1)}
                            className={`h-9 min-w-9 rounded-xl border px-2 text-xs font-semibold transition ${chip}`}
                          >
                            1
                          </button>
                          {pageWindow[0] > 2 && <span className={`px-1 text-xs ${muted}`}>...</span>}
                        </>
                      )}
                      {pageWindow.map((pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => goToPage(pageNumber)}
                          aria-current={pageNumber === meta.page ? "page" : undefined}
                          className={`h-9 min-w-9 rounded-xl border px-2 text-xs font-semibold transition ${
                            pageNumber === meta.page
                              ? darkMode
                                ? "border-[#d8f36a] bg-[#d8f36a] text-black"
                                : "border-[#171714] bg-[#171714] text-white"
                              : chip
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                      {pageWindow[pageWindow.length - 1] < meta.pageCount && (
                        <>
                          {pageWindow[pageWindow.length - 1] < meta.pageCount - 1 && (
                            <span className={`px-1 text-xs ${muted}`}>...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => goToPage(meta.pageCount)}
                            className={`h-9 min-w-9 rounded-xl border px-2 text-xs font-semibold transition ${chip}`}
                          >
                            {meta.pageCount}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => goToPage(Math.min(meta.pageCount, meta.page + 1))}
                        disabled={meta.page >= meta.pageCount}
                        aria-label="Next page"
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-40 ${chip}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div
          className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] ${filtersClosing ? "animate-[mrn-backdrop-out_280ms_ease_forwards]" : "animate-[mrn-backdrop-in_280ms_ease-out]"}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFilters();
          }}
        >
          <div
            className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col shadow-[-24px_0_80px_rgba(0,0,0,0.22)] ${filtersClosing ? "animate-[mrn-drawer-out_280ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_360ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "bg-[#111216] text-white" : "bg-white text-[#171714]"}`}
            role="dialog"
            aria-modal="true"
            aria-label="Activity log filters"
          >
            <div className={`flex h-14 flex-shrink-0 items-center justify-between border-b px-5 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm font-semibold">Filters and sorting</span>
              </div>
              <button
                type="button"
                onClick={closeFilters}
                aria-label="Close filters"
                className={`flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`h-5 w-5 ${muted}`} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <p className={`text-xs ${muted}`}>
                {meta
                  ? meta.total === 0
                    ? "No entries match these filters"
                    : `${meta.total} of ${meta.retained} ${meta.retained === 1 ? "entry" : "entries"} match`
                  : "Loading..."}
              </p>

              <p className={`mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] ${muted}`}>User</p>
              <SelectMenu
                darkMode={darkMode}
                value={filters.userId}
                options={userOptions}
                onChange={(userId) => patchFilters({ userId })}
                searchable
                searchPlaceholder="Search user..."
                placeholder="All users"
              />

              <p className={`mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] ${muted}`}>Date range</p>
              <DateRangePicker
                darkMode={darkMode}
                from={filters.from}
                to={filters.to}
                onChange={(range) => patchFilters(range)}
                placeholder="All dates"
              />
              {(filters.from || filters.to) && (
                <button
                  type="button"
                  onClick={() => patchFilters({ from: "", to: "" })}
                  className={`mt-2 px-1 text-xs underline ${muted}`}
                >
                  Clear date range
                </button>
              )}

              <p className={`mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] ${muted}`}>Category</p>
              <SelectMenu
                darkMode={darkMode}
                value={filters.category}
                options={categoryOptions}
                onChange={(category) => patchFilters({ category })}
                placeholder="All categories"
              />

              <p className={`mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] ${muted}`}>Status</p>
              <SelectMenu
                darkMode={darkMode}
                value={filters.status}
                options={statusOptions}
                onChange={(status) => patchFilters({ status })}
                placeholder="All statuses"
              />

              <p className={`mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] ${muted}`}>Sort by date</p>
              <div className={`flex rounded-2xl p-1 ${darkMode ? "bg-white/[0.05]" : "bg-black/[0.04]"}`}>
                {[
                  { id: "newest", label: "Newest first" },
                  { id: "oldest", label: "Oldest first" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => patchFilters({ sort: option.id })}
                    className={`h-10 flex-1 rounded-xl text-xs font-semibold transition ${filters.sort === option.id ? (darkMode ? "bg-[#d8f36a] text-black" : "bg-[#171714] text-white") : darkMode ? "text-white/60 hover:text-white" : "text-black/55 hover:text-black"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <p className={`mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] ${muted}`}>Rows per page</p>
              <SelectMenu
                darkMode={darkMode}
                value={filters.pageSize}
                options={PAGE_SIZE_OPTIONS}
                onChange={(pageSize) => patchFilters({ pageSize })}
              />

              {meta?.earliestDate && meta?.latestDate && (
                <p className={`mt-5 px-1 text-[11px] leading-4 ${muted}`}>
                  The log keeps the latest {meta.retentionLimit} entries, currently spanning {meta.earliestDate} to{" "}
                  {meta.latestDate}.
                </p>
              )}
            </div>

            <div className={`flex flex-shrink-0 items-center gap-2 border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-black/10"}`}>
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition disabled:opacity-40 ${chip}`}
              >
                <RotateCcw className="h-4 w-4" />
                Clear all
              </button>
              <button
                type="button"
                onClick={closeFilters}
                className="h-11 flex-1 rounded-2xl bg-[#4b9b16] text-sm font-semibold text-white transition hover:bg-[#3f8412]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {detailLog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${muted}`}>Activity details</p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>{detailLog.action}</h3>
              </div>
              <button
                onClick={() => setDetailLog(null)}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`h-5 w-5 ${muted}`} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Exact time", formatDateTime(detailLog.createdAt)],
                ["User", `${detailLog.displayName || detailLog.username || "System"} (${detailLog.roleName || "System"})`],
                ["Category", getCategoryMeta(detailLog).label],
                ["Status", detailLog.status],
                ["Target", getTargetLabel(detailLog)],
                ["Path", `${detailLog.method || ""} ${detailLog.path || ""}`.trim() || "N/A"],
                ["IP address", detailLog.ip || "N/A"],
                ["MAC address", detailLog.macAddress || "N/A"],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}>
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${muted}`}>{label}</p>
                  <p className={`mt-2 break-words text-sm ${darkMode ? "text-white/80" : "text-black/70"}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className={`mt-3 rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}>
              <p className={`text-[11px] uppercase tracking-[0.18em] ${muted}`}>User agent and details</p>
              <p className={`mt-2 break-words text-sm ${darkMode ? "text-white/80" : "text-black/70"}`}>
                {detailLog.details?.userAgent || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
