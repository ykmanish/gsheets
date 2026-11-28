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
import { Button, Chip, DateRangePicker, Drawer, EmptyState, IconTile, Notice, PageHeader, SelectMenu, Tabs } from "./ui";

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

  const muted = darkMode ? "text-white/50" : "text-[#8a8a8a]";

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
      auth: { label: "Auth", Icon: Lock, tone: "sky" },
      admin: { label: "Admin", Icon: UserCog, tone: "lavender" },
      document: { label: "Document", Icon: FileText, tone: "mint" },
      automation: { label: "Automation", Icon: Bot, tone: "peach" },
      notification: { label: "Notification", Icon: Bell, tone: "amber" },
      report: { label: "Report", Icon: Shield, tone: "rose" },
      whatsapp: { label: "WhatsApp", Icon: MessageCircleMore, tone: "mint" },
      system: { label: "System", Icon: Settings, tone: "neutral" },
    };
    return map[category] || map.system;
  }

  const ink = darkMode ? "text-white" : "text-[#141414]";
  const fieldLabel = `mb-2 mt-6 block text-[12.5px] first:mt-0 ${muted}`;
  const pageButton = (active) => `h-9 min-w-9 rounded-full px-2.5 text-[12.5px] tabular-nums transition ${
    active
      ? darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"
      : darkMode ? "text-white/70 hover:bg-white/[0.07]" : "text-[#3d3d3b] hover:bg-[#f4f4f2]"
  }`;

  return (
    <div className={`flex-1 min-h-0 overflow-hidden px-4 py-5 newq sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col">
        <PageHeader
          darkMode={darkMode}
          className="flex-shrink-0"
          badge="Audit trail"
          badgeIcon={Activity}
          badgeTone="sky"
          title="Activity log"
          subtitle="who did what, and when"
          actions={(
            <>
              <Button
                darkMode={darkMode}
                variant={activeFilterCount > 0 ? "accent" : "secondary"}
                icon={SlidersHorizontal}
                onClick={() => setFiltersOpen(true)}
              >
                Filters
                {activeFilterCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#141414] px-1 text-[11px] text-white">{activeFilterCount}</span>
                )}
              </Button>
              <Button
                darkMode={darkMode}
                variant="secondary"
                icon={filters.sort === "newest" ? ArrowDownWideNarrow : ArrowUpNarrowWide}
                onClick={() => patchFilters({ sort: filters.sort === "newest" ? "oldest" : "newest" })}
                title="Toggle date sort order"
              >
                <span className="hidden lg:inline">{filters.sort === "newest" ? "Newest" : "Oldest"}</span>
              </Button>
              <button
                type="button"
                onClick={() => void loadLogs(true)}
                disabled={refreshing}
                aria-label="Refresh activity log"
                className={`grid h-9 w-9 place-items-center rounded-full border transition disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/[0.04] hover:bg-white/10" : "border-[#e6e6e3] bg-white hover:bg-[#f6f6f4]"}`}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </>
          )}
        />

        <div className="relative mb-4 mt-6 flex-shrink-0">
          <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search action, target, user, path or IP..."
            className={`h-11 w-full rounded-full border pl-11 pr-4 text-[13.5px] outline-none transition ${darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"}`}
          />
        </div>

        <div className={`min-h-0 flex-1 overflow-hidden rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
          {loading ? (
            <div className="flex h-full items-center justify-center py-20">
              <Loader2 className={`h-7 w-7 animate-spin ${muted}`} />
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                    <tr className={darkMode ? "border-b border-white/10" : "border-b border-[#f0f0ee]"}>
                      {["Date", "User", "Action", "Target", "Status", "Details"].map((header) => (
                        <th key={header} className={`px-5 py-3.5 text-[12px] font-normal ${muted}`}>
                          {header === "Date" ? (
                            <button
                              type="button"
                              onClick={() => patchFilters({ sort: filters.sort === "newest" ? "oldest" : "newest" })}
                              className={`flex items-center gap-1.5 transition ${darkMode ? "hover:text-white" : "hover:text-[#141414]"}`}
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
                        <td colSpan="6" className="p-5">
                          <EmptyState
                            darkMode={darkMode}
                            icon={Activity}
                            tone="sky"
                            title={activeFilterCount > 0 ? "No activity matches these filters" : "No activity yet"}
                            action={activeFilterCount > 0 ? <Button darkMode={darkMode} variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>Clear filters</Button> : null}
                          />
                        </td>
                      </tr>
                    ) : logs.map((log) => {
                      const category = getCategoryMeta(log);
                      const targetLabel = getTargetLabel(log);
                      return (
                      <tr key={log.id} className={`border-b transition-colors ${darkMode ? "border-white/[0.06] hover:bg-white/[0.02]" : "border-[#f0f0ee] hover:bg-[#fafaf9]"}`}>
                        <td className={`whitespace-nowrap px-5 py-3.5 text-[13px] ${ink}`}>
                          {formatDate(log.createdAt)}
                          <span className={`mt-0.5 block text-[12px] ${muted}`}>{formatTime(log.createdAt)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className={`text-[13.5px] ${ink}`}>{log.displayName || log.username || "System"}</p>
                          <p className={`mt-0.5 text-[12px] ${muted}`}>{log.roleName || log.username || "System"}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <IconTile icon={category.Icon} tone={category.tone} darkMode={darkMode} size="xs" />
                            <div>
                              <p className={`text-[13.5px] ${ink}`}>{log.action}</p>
                              <p className={`mt-0.5 text-[12px] ${muted}`}>{category.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`px-5 py-3.5 text-[13px] ${muted}`} title={targetLabel}>{truncateTarget(targetLabel)}</td>
                        <td className="px-5 py-3.5">
                          <Chip
                            darkMode={darkMode}
                            tone={log.status === "failed" ? "rose" : "mint"}
                            icon={log.status === "failed" ? XCircle : CheckCircle2}
                            className="h-6 px-2.5 text-[12px]"
                          >
                            {log.status}
                          </Chip>
                        </td>
                        <td className="px-5 py-3.5">
                          <Button darkMode={darkMode} variant="soft" size="sm" onClick={() => setDetailLog(log)} className="h-7 px-3 text-[12px]">
                            Detail
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {meta && meta.total > 0 && (
                <div className={`flex flex-shrink-0 flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
                  <p className={`text-[12.5px] ${muted}`}>
                    {meta.showingAll
                      ? `All ${meta.total} ${meta.total === 1 ? "entry" : "entries"} on one page`
                      : `Page ${meta.page} of ${meta.pageCount} - ${meta.rangeFrom}-${meta.rangeTo} of ${meta.total}`}
                    {meta.total !== meta.retained ? ` (filtered from ${meta.retained})` : ""}
                  </p>
                  {!meta.showingAll && meta.pageCount > 1 && (
                    <div className={`flex items-center gap-0.5 rounded-full p-1 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                      <button
                        type="button"
                        onClick={() => goToPage(meta.page - 1)}
                        disabled={meta.page <= 1}
                        aria-label="Previous page"
                        className={`grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-40 ${pageButton(false)}`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {pageWindow[0] > 1 && (
                        <>
                          <button type="button" onClick={() => goToPage(1)} className={pageButton(false)}>
                            1
                          </button>
                          {pageWindow[0] > 2 && <span className={`px-1 text-[12px] ${muted}`}>...</span>}
                        </>
                      )}
                      {pageWindow.map((pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => goToPage(pageNumber)}
                          aria-current={pageNumber === meta.page ? "page" : undefined}
                          className={pageButton(pageNumber === meta.page)}
                        >
                          {pageNumber}
                        </button>
                      ))}
                      {pageWindow[pageWindow.length - 1] < meta.pageCount && (
                        <>
                          {pageWindow[pageWindow.length - 1] < meta.pageCount - 1 && (
                            <span className={`px-1 text-[12px] ${muted}`}>...</span>
                          )}
                          <button type="button" onClick={() => goToPage(meta.pageCount)} className={pageButton(false)}>
                            {meta.pageCount}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => goToPage(Math.min(meta.pageCount, meta.page + 1))}
                        disabled={meta.page >= meta.pageCount}
                        aria-label="Next page"
                        className={`grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-40 ${pageButton(false)}`}
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

      <Drawer
        open={filtersOpen && !filtersClosing}
        onClose={closeFilters}
        darkMode={darkMode}
        title="Filters and sorting"
        subtitle={meta
          ? meta.total === 0
            ? "No entries match these filters"
            : `${meta.total} of ${meta.retained} ${meta.retained === 1 ? "entry" : "entries"} match`
          : "Loading..."}
        icon={SlidersHorizontal}
        tone="sky"
        width={440}
        footer={(
          <>
            <Button darkMode={darkMode} variant="secondary" size="lg" icon={RotateCcw} onClick={resetFilters} disabled={activeFilterCount === 0} className="flex-1">
              Clear all
            </Button>
            <Button darkMode={darkMode} variant="primary" size="lg" onClick={closeFilters} className="flex-1">
              Done
            </Button>
          </>
        )}
      >
        <span className={fieldLabel}>User</span>
        <SelectMenu
          darkMode={darkMode}
          value={filters.userId}
          options={userOptions}
          onChange={(userId) => patchFilters({ userId })}
          searchable
          searchPlaceholder="Search user..."
          placeholder="All users"
        />

        <span className={fieldLabel}>Date range</span>
        <DateRangePicker
          darkMode={darkMode}
          from={filters.from}
          to={filters.to}
          onChange={(range) => patchFilters(range)}
          placeholder="All dates"
        />
        {(filters.from || filters.to) && (
          <Button darkMode={darkMode} variant="ghost" size="sm" icon={X} onClick={() => patchFilters({ from: "", to: "" })} className="mt-2">
            Clear date range
          </Button>
        )}

        <span className={fieldLabel}>Category</span>
        <SelectMenu
          darkMode={darkMode}
          value={filters.category}
          options={categoryOptions}
          onChange={(category) => patchFilters({ category })}
          placeholder="All categories"
        />

        <span className={fieldLabel}>Status</span>
        <SelectMenu
          darkMode={darkMode}
          value={filters.status}
          options={statusOptions}
          onChange={(status) => patchFilters({ status })}
          placeholder="All statuses"
        />

        <span className={fieldLabel}>Sort by date</span>
        <Tabs
          darkMode={darkMode}
          className="!flex w-full [&>button]:flex-1 [&>button]:justify-center"
          items={[
            { id: "newest", label: "Newest first" },
            { id: "oldest", label: "Oldest first" },
          ]}
          value={filters.sort}
          onChange={(sort) => patchFilters({ sort })}
        />

        <span className={fieldLabel}>Rows per page</span>
        <SelectMenu
          darkMode={darkMode}
          value={filters.pageSize}
          options={PAGE_SIZE_OPTIONS}
          onChange={(pageSize) => patchFilters({ pageSize })}
        />

        {meta?.earliestDate && meta?.latestDate && (
          <Notice tone="neutral" darkMode={darkMode} className="mt-6">
            The log keeps the latest {meta.retentionLimit} entries, currently spanning {meta.earliestDate} to{" "}
            {meta.latestDate}.
          </Notice>
        )}
      </Drawer>

      {detailLog && (
        <div className="ui-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`ui-pop w-full max-w-2xl rounded-[24px] border p-6 newq ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <IconTile icon={getCategoryMeta(detailLog).Icon} tone={getCategoryMeta(detailLog).tone} darkMode={darkMode} size="sm" />
                <div className="min-w-0">
                  <h3 className={`text-[17px] leading-tight ${ink}`}>{detailLog.action}</h3>
                  <p className={`mt-1 text-[12.5px] ${muted}`}>Activity details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                aria-label="Close"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
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
                <div key={label} className={`rounded-[14px] px-4 py-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
                  <p className={`text-[12px] ${muted}`}>{label}</p>
                  <p className={`mt-1 break-words text-[13.5px] ${ink}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className={`mt-2 rounded-[14px] px-4 py-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`}>
              <p className={`text-[12px] ${muted}`}>User agent and details</p>
              <p className={`mt-1 break-words text-[13px] ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}>
                {detailLog.details?.userAgent || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
