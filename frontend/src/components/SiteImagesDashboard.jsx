"use client";
/* eslint-disable @next/next/no-img-element -- Google Drive image URLs are dynamic and cannot use the fixed Next image host allowlist. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Camera, ChevronLeft, ChevronRight, Folder, Hammer, ImageOff, Images, Loader2, MapPin, RefreshCw, Search, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip, EmptyState, IconTile, PageHeader, StatTile, cx, fieldClass } from "./ui";

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function value(row, header) {
  return String(header ? row?.[header] ?? "" : "").trim();
}

function urls(input) {
  return String(input ?? "").match(/https?:\/\/[^\s,;]+/g) || [];
}

function pick(headers, tests, fallback = "") {
  for (const test of tests) {
    const found = headers.find((header) => test.test(String(header).trim()));
    if (found) return found;
  }
  return fallback;
}

function parseDateKey(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const parts = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (parts) {
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    // Google Form response sheets commonly expose timestamps as M/D/YYYY.
    // Only switch to D/M/YYYY when the first value cannot be a month.
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${parts[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : localDateKey(parsed);
}

function imageUrl(url) {
  const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  return id && /drive\.google\.com|docs\.google\.com/i.test(url)
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600`
    : url;
}

function prettyDate(key) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${key}T12:00:00`));
}

function addDays(key, days) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function weekStartKey(key) {
  const date = new Date(`${key}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDateKey(date);
}

function compactDayLabel(key) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00`));
}

function DateStrip({ darkMode, selectedDate, weekStart, direction, counts, onSelectDate, onNavigateWeek }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const navClass = cx("grid h-10 w-10 shrink-0 place-items-center self-center rounded-full transition-colors", darkMode ? "bg-white/[0.06] text-white hover:bg-white/10" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]");

  return (
    <div className="mt-6 flex items-stretch gap-2">
      <button type="button" onClick={() => onNavigateWeek(-1)} className={navClass} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
      <div key={weekStart} className={`grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 ${direction > 0 ? "animate-[site-week-next_320ms_cubic-bezier(0.22,1,0.36,1)]" : "animate-[site-week-prev_320ms_cubic-bezier(0.22,1,0.36,1)]"}`}>
        {days.map((day) => {
          const selected = day === selectedDate;
          const count = counts.get(day) || 0;
          return (
            <button key={day} type="button" onClick={() => onSelectDate(day)} className={cx("min-h-[66px] rounded-[16px] px-3 py-2.5 text-center transition-colors", selected ? (darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white") : darkMode ? "bg-white/[0.05] text-white/85 hover:bg-white/[0.08]" : "bg-[#f7f7f5] text-[#141414] hover:bg-[#f0f0ee]")}>
              <span className="block text-[13px]">{compactDayLabel(day)}</span>
              <span className={cx("mt-1 block text-[12px]", selected ? "opacity-70" : count ? (darkMode ? "text-[#a7e8bf]" : "text-[#2f7a4f]") : darkMode ? "text-white/40" : "text-[#9a9a98]")}>{count ? `${count} photo${count === 1 ? "" : "s"}` : "View"}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onNavigateWeek(1)} className={navClass} aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
      <style jsx>{`
        @keyframes site-week-next {
          from { opacity: 0; transform: translateX(28px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes site-week-prev {
          from { opacity: 0; transform: translateX(-28px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function siteInitials(site) {
  const words = String(site || "Site").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  return String(words[0] || "SI").slice(0, 2).toUpperCase();
}

function SiteImage({ photo, site, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) {
    return <span className={`flex h-full w-full items-center justify-center bg-[#f4f4f2] text-4xl tracking-[-0.04em] text-[#8a8a8a] dark:bg-white/[0.06] dark:text-white/55 ${className}`}>{siteInitials(site)}</span>;
  }
  return <img src={imageUrl(photo.url || photo)} alt={alt} onError={() => setFailed(true)} className={className} />;
}

function SiteFolder({ group, darkMode, onOpen }) {
  const cover = group.photos[0];
  return (
    <button type="button" onClick={onOpen} className={cx("group overflow-hidden rounded-[20px] border text-left transition-colors", darkMode ? "border-white/10 bg-[#15171c] hover:bg-[#191b21]" : "border-[#ececec] bg-white hover:bg-[#fcfcfb]")}>
      <div className="p-2 pb-0">
        <div className={cx("relative h-44 overflow-hidden rounded-[14px]", darkMode ? "bg-white/5" : "bg-[#f4f4f2]")}>
          {cover ? <SiteImage photo={cover} site={group.site} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <ImageOff className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 opacity-30" />}
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] text-[#141414] backdrop-blur-md">{group.photos.length} photo{group.photos.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 p-4">
        <IconTile icon={Folder} tone="sky" darkMode={darkMode} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px]">{group.site}</h3>
          <p className={cx("text-[12px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{group.trades.size} trade{group.trades.size === 1 ? "" : "s"}</p>
        </div>
        <ChevronRight className={cx("h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5", darkMode ? "text-white/40" : "text-[#9a9a98]")} />
      </div>
    </button>
  );
}

export default function SiteImagesDashboard({ darkMode }) {
  const [date, setDate] = useState(localDateKey());
  const [weekStart, setWeekStart] = useState(() => weekStartKey(localDateKey()));
  const [weekDirection, setWeekDirection] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [siteDrawerClosing, setSiteDrawerClosing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const openSiteDrawer = useCallback((site) => {
    setSiteDrawerClosing(false);
    setSelectedSite(site);
  }, []);

  const closeSiteDrawer = useCallback(() => {
    if (siteDrawerClosing) return;
    setSiteDrawerClosing(true);
    window.setTimeout(() => {
      setSelectedSite("");
      setSelectedPhoto(null);
      setSiteDrawerClosing(false);
    }, 300);
  }, [siteDrawerClosing]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const documentsResponse = await fetch(`${API_URL}/documents`);
      const documentsData = await documentsResponse.json();
      if (!documentsResponse.ok) throw new Error(documentsData.error || "Could not load sheets");
      const sheets = (documentsData.documents || []).filter((doc) => doc.type === "sheet" && doc.isReady !== false);
      const doc = sheets.find((item) => /site\s*daily\s*report/i.test(item.name)) || sheets.find((item) => /site.*report|daily.*site/i.test(item.name));
      if (!doc) throw new Error('Link a sheet named "Site Daily Report" in Sheet Dashboard first.');
      const response = await fetch(`${API_URL}/sheets/${doc.id}/data`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read Site Daily Report");

      const next = [];
      (data.sheets || []).forEach((sheet) => {
        const headers = sheet.headers || [];
        const siteHeader = pick(headers, [/^site(?:\s*name)?$/i, /select.*site|site.*name/i, /project.*site|site.*project/i, /location/i, /project/i]);
        const dateHeader = pick(headers, [/^date$/i, /timestamp/i, /report.*date|date.*report/i, /created|submitted/i]);
        const tradeHeader = pick(headers, [/^trade$/i, /trade.*name|work.*trade/i, /work.*category|category.*work/i, /category|department|agency/i]);
        const uploaderHeader = pick(headers, [/uploaded.*by|submitted.*by/i, /site.*person|person.*site/i, /employee.*name|person.*name/i, /^name$/i, /email/i, /created.*by/i]);
        const mediaHeaders = headers.filter((header) => /photo|image|upload|attachment|drive\s*link|media/i.test(header) || (sheet.rows || []).some((row) => urls(row[header]).length));
        (sheet.rows || []).forEach((row, rowIndex) => {
          mediaHeaders.forEach((header) => urls(row[header]).forEach((url, urlIndex) => next.push({
            id: `${sheet.name}-${row.__rowIndex || rowIndex}-${header}-${urlIndex}`,
            url,
            site: value(row, siteHeader) || "Unassigned site",
            date: parseDateKey(value(row, dateHeader)),
            // In Site Daily Report, categories such as Civil and Carpenter are
            // often the media-column headers rather than values in a Trade cell.
            trade: value(row, tradeHeader) || String(header || "").trim() || "General work",
            uploadedBy: value(row, uploaderHeader) || "Site team",
            sheet: sheet.name,
          })));
        });
      });
      setPhotos(next);
      setSource(doc);
    } catch (error) {
      setPhotos([]);
      setSource(null);
      if (!quiet) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => void load({ quiet: true }), 60000);
    return () => window.clearInterval(id);
  }, [load]);
  const groups = useMemo(() => {
    const map = new Map();
    photos.filter((photo) => photo.date === date).forEach((photo) => {
      if (!map.has(photo.site)) map.set(photo.site, { site: photo.site, photos: [], trades: new Set() });
      map.get(photo.site).photos.push(photo);
      map.get(photo.site).trades.add(photo.trade);
    });
    const term = query.trim().toLowerCase();
    return [...map.values()].filter((group) => !term || group.site.toLowerCase().includes(term) || [...group.trades].some((trade) => trade.toLowerCase().includes(term))).sort((a, b) => b.photos.length - a.photos.length);
  }, [date, photos, query]);
  const photoCountsByDate = useMemo(() => {
    const map = new Map();
    photos.forEach((photo) => {
      if (!photo.date) return;
      map.set(photo.date, (map.get(photo.date) || 0) + 1);
    });
    return map;
  }, [photos]);
  const selectDate = useCallback((nextDate) => {
    setDate(nextDate);
    setWeekStart(weekStartKey(nextDate));
    setSelectedSite("");
  }, []);
  const navigateWeek = useCallback((direction) => {
    setWeekDirection(direction);
    setWeekStart((current) => {
      const nextStart = addDays(current, direction * 7);
      setDate(nextStart);
      setSelectedSite("");
      return nextStart;
    });
  }, []);
  const activeGroup = groups.find((group) => group.site === selectedSite) || null;
  const selectedPhotoIndex = activeGroup && selectedPhoto ? activeGroup.photos.findIndex((photo) => photo.id === selectedPhoto.id) : -1;
  const canNavigateSelectedPhoto = selectedPhotoIndex >= 0 && activeGroup.photos.length > 1;
  const navigateSelectedPhoto = useCallback((direction) => {
    if (!activeGroup || !selectedPhoto || activeGroup.photos.length < 2) return;
    const currentIndex = activeGroup.photos.findIndex((photo) => photo.id === selectedPhoto.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + direction + activeGroup.photos.length) % activeGroup.photos.length;
    setSelectedPhoto(activeGroup.photos[nextIndex]);
  }, [activeGroup, selectedPhoto]);

  useEffect(() => {
    if (!selectedSite) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (selectedPhoto) setSelectedPhoto(null);
        else closeSiteDrawer();
      }
      if (event.key === "ArrowLeft" && selectedPhoto) navigateSelectedPhoto(-1);
      if (event.key === "ArrowRight" && selectedPhoto) navigateSelectedPhoto(1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeSiteDrawer, navigateSelectedPhoto, selectedPhoto, selectedSite]);

  const panel = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const dayPhotoCount = photoCountsByDate.get(date) || 0;
  const dayTradeCount = new Set(photos.filter((photo) => photo.date === date).map((photo) => photo.trade)).size;

  return (
    <main className={cx("relative min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8", darkMode ? "text-white" : "text-[#141414]")}>
      <PageHeader
        darkMode={darkMode}
        badge="Projects · Site images"
        badgeIcon={Camera}
        badgeTone="sky"
        title="Site images"
        subtitle="what each site looked like"
        description="Review daily site photos, trades and upload ownership from one workspace."
        actions={<>
          <label className={cx(fieldClass(darkMode), "w-full cursor-text sm:w-72")}><Search className={cx("h-4 w-4 shrink-0", muted)} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search site or trade" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
          <Button darkMode={darkMode} variant="primary" onClick={() => void load()}><RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} /> Refresh</Button>
        </>}
      />
      <DateStrip darkMode={darkMode} selectedDate={date} weekStart={weekStart} direction={weekDirection} counts={photoCountsByDate} onSelectDate={selectDate} onNavigateWeek={navigateWeek} />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile darkMode={darkMode} icon={Images} tone="sky" value={dayPhotoCount} label="Photos this day" />
        <StatTile darkMode={darkMode} icon={MapPin} tone="mint" value={groups.length} label="Sites shown" />
        <StatTile darkMode={darkMode} icon={Hammer} tone="peach" value={dayTradeCount} label="Trades covered" />
      </div>

      <section className={cx("mt-6 rounded-[20px] border p-5", panel)}>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={Folder} tone="lavender" darkMode={darkMode} size="sm" />
          <div><h2 className="text-[15px]">Photo folders</h2><p className={cx("text-[12.5px]", muted)}>{prettyDate(date)} · {groups.length} visible sites</p></div>
        </div>

        {loading && !source ? <div className={cx("flex h-72 items-center justify-center gap-3 text-[13px]", muted)}><Loader2 className="h-5 w-5 animate-spin" /> Reading Site Daily Report…</div> : groups.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{groups.map((group) => <SiteFolder key={group.site} group={group} darkMode={darkMode} onOpen={() => openSiteDrawer(group.site)} />)}</div>
        ) : (
          <EmptyState darkMode={darkMode} icon={Camera} tone="sky" title="No site images for this date" text={source ? "Choose another date or wait for the site team to add photos to the daily report." : "Connect a sheet named \u201cSite Daily Report\u201d in Sheet Dashboard."} className="min-h-72" />
        )}
      </section>

      {activeGroup && <div className={`newq fixed inset-0 z-[70] bg-black/20 backdrop-blur-[2px] ${siteDrawerClosing ? "animate-[mrn-backdrop-out_300ms_ease_forwards]" : "animate-[mrn-backdrop-in_320ms_ease-out]"}`} onMouseDown={(event) => event.target === event.currentTarget && closeSiteDrawer()} role="presentation">
        <aside style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`absolute inset-0 flex w-full flex-col overflow-hidden sm:inset-y-2.5 sm:left-auto sm:right-2.5 sm:max-w-5xl sm:rounded-[24px] sm:border ${siteDrawerClosing ? "animate-[mrn-drawer-out_300ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_420ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]"}`} role="dialog" aria-modal="true" aria-label={`${activeGroup.site} site photos`}>
          <header className={cx("flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={Folder} tone="sky" darkMode={darkMode} size="sm" />
              <div className="min-w-0"><h2 className="truncate text-[17px] tracking-[-0.01em]">{activeGroup.site}</h2><p className={cx("truncate text-[12.5px]", muted)}>Site folder · {prettyDate(date)} · {activeGroup.photos.length} photo{activeGroup.photos.length === 1 ? "" : "s"}</p></div>
            </div>
            <button type="button" onClick={closeSiteDrawer} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}><X className="h-4 w-4" /></button>
          </header>
          <div className="overflow-y-auto p-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeGroup.photos.map((photo) => <article key={photo.id} className={cx("overflow-hidden rounded-[20px] border", panel)}><div className="p-2 pb-0"><button type="button" onClick={() => setSelectedPhoto(photo)} className={cx("block h-52 w-full overflow-hidden rounded-[14px]", darkMode ? "bg-white/5" : "bg-[#f4f4f2]")}><SiteImage photo={photo} site={photo.site} alt={`${photo.trade} at ${photo.site}`} className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" /></button></div><div className="p-4"><Chip tone="lime" darkMode={darkMode} className="h-6 max-w-full text-[11.5px]"><span className="truncate">{photo.trade}</span></Chip><p className={cx("mt-3 flex items-center gap-2 text-[12px]", muted)}><UserRound className="h-3.5 w-3.5" /> Uploaded by {photo.uploadedBy}</p><a href={photo.url} target="_blank" rel="noreferrer" className={cx("mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors", darkMode ? "bg-white/[0.07] hover:bg-white/[0.11]" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>Open original <ArrowUpRight className="h-3.5 w-3.5" /></a></div></article>)}</div></div>
        </aside>
      </div>}

      {selectedPhoto && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPhoto(null)} role="dialog" aria-modal="true" aria-label="Site image preview">
        <button type="button" onClick={() => setSelectedPhoto(null)} className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Close image preview"><X className="h-5 w-5" /></button>
        {canNavigateSelectedPhoto && <>
          <button type="button" onClick={(event) => { event.stopPropagation(); navigateSelectedPhoto(-1); }} className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6 sm:h-14 sm:w-14" aria-label="Previous image"><ChevronLeft className="h-7 w-7" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); navigateSelectedPhoto(1); }} className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6 sm:h-14 sm:w-14" aria-label="Next image"><ChevronRight className="h-7 w-7" /></button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">{selectedPhotoIndex + 1} / {activeGroup.photos.length}</div>
        </>}
        <img src={imageUrl(selectedPhoto.url)} alt="Site preview" onClick={(event) => event.stopPropagation()} className="max-h-[88vh] max-w-[94vw] object-contain" />
      </div>}
    </main>
  );
}
