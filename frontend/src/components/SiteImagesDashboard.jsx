"use client";
/* eslint-disable @next/next/no-img-element -- Google Drive image URLs are dynamic and cannot use the fixed Next image host allowlist. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Camera, ChevronLeft, ChevronRight, Folder, ImageOff, Loader2, RefreshCw, Search, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";

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
  const border = darkMode ? "border-white/10" : "border-black/10";
  const navClass = darkMode ? "bg-[#15171c] text-white hover:bg-white/10" : "bg-white text-[#1594ff] hover:bg-[#f3f8ff]";
  const trackClass = darkMode ? "border-white/10 bg-[#111318]" : "border-black/[0.08] bg-white -[0_10px_24px_rgba(15,23,42,0.08)]";

  return (
    <div className={`mt-5 flex overflow-hidden rounded-2xl border ${trackClass}`}>
      <button type="button" onClick={() => onNavigateWeek(-1)} className={`flex w-12 shrink-0 items-center justify-center border-r transition ${border} ${navClass}`} aria-label="Previous week"><ChevronLeft className="h-5 w-5" /></button>
      <div key={weekStart} className={`grid min-w-0 flex-1 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 ${direction > 0 ? "animate-[site-week-next_320ms_cubic-bezier(0.22,1,0.36,1)]" : "animate-[site-week-prev_320ms_cubic-bezier(0.22,1,0.36,1)]"}`}>
        {days.map((day) => {
          const selected = day === selectedDate;
          const count = counts.get(day) || 0;
          return (
            <button key={day} type="button" onClick={() => onSelectDate(day)} className={`relative min-h-[74px] border-r px-3 py-3 text-center transition last:border-r-0 ${border} ${selected ? "text-[#1295ff]" : darkMode ? "text-white/82 hover:bg-white/[0.04]" : "text-[#272727] hover:bg-[#f8fbf5]"}`}>
              <span className="block text-sm font-bold">{compactDayLabel(day)}</span>
              <span className={`mt-1 block text-sm ${selected ? "font-semibold text-[#1295ff]" : count ? "font-medium text-[#20a045]" : darkMode ? "text-white/45" : "text-black/48"}`}>{count ? `${count} photo${count === 1 ? "" : "s"}` : "View"}</span>
              {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1295ff]" />}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onNavigateWeek(1)} className={`flex w-12 shrink-0 items-center justify-center border-l transition ${border} ${navClass}`} aria-label="Next week"><ChevronRight className="h-5 w-5" /></button>
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
    return <span className={`flex h-full w-full items-center justify-center bg-[#e8ede9] text-4xl font-bold tracking-[-0.06em] text-[#5f6862] dark:bg-white/[0.06] dark:text-white/55 ${className}`}>{siteInitials(site)}</span>;
  }
  return <img src={imageUrl(photo.url || photo)} alt={alt} onError={() => setFailed(true)} className={className} />;
}

function SiteFolder({ group, darkMode, onOpen }) {
  const cover = group.photos[0];
  return (
    <button type="button" onClick={onOpen} className={`group overflow-hidden rounded-[26px] border text-left transition duration-300 hover:-translate-y-1 hover:-xl ${darkMode ? "border-white/10 bg-white/[0.035] hover:border-white/20" : "border-black/[0.06] bg-white hover:border-black/10"}`}>
      <div className={`relative h-44 overflow-hidden ${darkMode ? "bg-white/5" : "bg-[#e9eeeb]"}`}>
        {cover ? <SiteImage photo={cover} site={group.site} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <ImageOff className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 opacity-30" />}
        <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/55 text-white backdrop-blur-md"><Folder className="h-5 w-5" /></span>
        <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">{group.photos.length} photo{group.photos.length === 1 ? "" : "s"}</span>
      </div>
      <div className="p-5">
        <h3 className="truncate text-lg font-semibold">{group.site}</h3>
        <div className={`mt-2 flex items-center justify-between text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>
          <span>{group.trades.size} trade{group.trades.size === 1 ? "" : "s"}</span>
          <span>Open folder →</span>
        </div>
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

  const panel = darkMode ? "border-white/10 bg-[#17191e]" : "border-black/[0.06] bg-white";
  const muted = darkMode ? "text-white/45" : "text-black/45";

  return (
    <main className={`relative min-h-0 flex-1 overflow-y-auto p-5 sm:p-7 ${darkMode ? "bg-[#0c0d10] text-white" : "bg-[#f5f7f2] text-[#171714]"}`}>
      <div className={`mb-5 rounded-3xl p-5 sm:p-6 ${darkMode ? "border-white/10 bg-[#151612]" : "border-black/[0.08] bg-white"}`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1"><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4b9b16]"><Camera className="h-3.5 w-3.5" /> Projects · Site Images</span><h1 className="mt-2 text-3xl font-bold small tracking-tight">Site Images Dashboard</h1><p className={`mt-2 max-w-2xl text-sm ${muted}`}>Review daily site photos, trades and upload ownership from one workspace.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:pt-14">
            <label className={`flex h-12 w-full min-w-0 items-center gap-2 rounded-3xl border px-4 sm:w-72 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-[#fafbf8] text-black focus-within:border-[#69c832]"}`}><Search className="h-4 w-4 shrink-0 text-[#4b9b16]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search site or trade" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <button type="button" onClick={() => void load()} className={`flex h-12 w-fit shrink-0 items-center gap-2 rounded-full border px-5 text-sm font-semibold ${darkMode ? "border-white/15 hover:bg-white/5" : "border-black/15 bg-white hover:bg-[#f5f7f2]"}`}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
          </div>
        </div>
        <DateStrip darkMode={darkMode} selectedDate={date} weekStart={weekStart} direction={weekDirection} counts={photoCountsByDate} onSelectDate={selectDate} onNavigateWeek={navigateWeek} />
      </div>

      <section className={`rounded-3xl p-5 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.08] bg-white"}`}>
        <div className="mb-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b9b16]">Site gallery</p><h2 className="mt-1 text-xl small font-bold">Photo folders</h2><p className={`mt-1 text-sm ${muted}`}>{prettyDate(date)} · {groups.length} visible sites</p></div>
        </div>

        {loading && !source ? <div className={`flex h-72 items-center justify-center gap-3 ${muted}`}><Loader2 className="h-5 w-5 animate-spin" /> Reading Site Daily Report…</div> : groups.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{groups.map((group) => <SiteFolder key={group.site} group={group} darkMode={darkMode} onOpen={() => openSiteDrawer(group.site)} />)}</div>
        ) : (
          <div className={`flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed text-center ${darkMode ? "border-white/10" : "border-black/10"}`}><Camera className={`h-9 w-9 ${muted}`} /><h3 className="mt-4 font-semibold">No site images for this date</h3><p className={`mt-2 max-w-md px-5 text-sm ${muted}`}>{source ? "Choose another date or wait for the site team to add photos to the daily report." : 'Connect a sheet named “Site Daily Report” in Sheet Dashboard.'}</p></div>
        )}
      </section>

      {activeGroup && <div className={`fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] ${siteDrawerClosing ? "animate-[mrn-backdrop-out_300ms_ease_forwards]" : "animate-[mrn-backdrop-in_320ms_ease-out]"}`} onMouseDown={(event) => event.target === event.currentTarget && closeSiteDrawer()} role="presentation">
        <aside className={`absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col overflow-hidden border-l -[-24px_0_80px_rgba(0,0,0,0.22)] ${siteDrawerClosing ? "animate-[mrn-drawer-out_300ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[mrn-drawer-in_420ms_cubic-bezier(0.22,1,0.36,1)]"} ${darkMode ? "border-white/10 bg-[#111318] text-white" : "border-black/10 bg-[#f7f7f3] text-[#171714]"}`} role="dialog" aria-modal="true" aria-label={`${activeGroup.site} site photos`}>
          <header className={`flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7 ${darkMode ? "border-white/10" : "border-black/[0.07]"}`}><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={closeSiteDrawer} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${panel}`}><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><p className={`text-[11px] font-medium uppercase tracking-[0.18em] ${muted}`}>Site folder · {prettyDate(date)}</p><h2 className="mt-1 truncate text-xl font-semibold">{activeGroup.site}</h2></div></div><button type="button" onClick={closeSiteDrawer} className="flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button></header>
          <div className="overflow-y-auto p-5 sm:p-7"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{activeGroup.photos.map((photo) => <article key={photo.id} className={`overflow-hidden rounded-[22px] border ${panel}`}><button type="button" onClick={() => setSelectedPhoto(photo)} className="block h-52 w-full overflow-hidden bg-black/5"><SiteImage photo={photo} site={photo.site} alt={`${photo.trade} at ${photo.site}`} className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" /></button><div className="p-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "bg-[#d8f36a]/15 text-[#d8f36a]" : "bg-[#e8f8d7] text-[#39710f]"}`}>{photo.trade}</span><p className={`mt-3 flex items-center gap-2 text-xs ${muted}`}><UserRound className="h-3.5 w-3.5" /> Uploaded by {photo.uploadedBy}</p><a href={photo.url} target="_blank" rel="noreferrer" className={`mt-4 flex items-center gap-1.5 text-xs font-semibold ${darkMode ? "text-[#d8f36a]" : "text-[#39710f]"}`}>Open original <ArrowUpRight className="h-3.5 w-3.5" /></a></div></article>)}</div></div>
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
