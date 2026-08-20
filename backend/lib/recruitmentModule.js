const { ObjectId } = require("mongodb");
const path = require("path");

// HR > Recruitment. Sourcing runs on Google Vertex AI Search (the Discovery
// Engine API): the recruiter's filters become a natural-language query, we hit
// the configured website data store, and the returned documents are parsed back
// into candidate (or job) cards. Nothing is scraped — the data store indexes
// only the site patterns the admin configured in Google Cloud.
//
// Two differences from the Custom Search JSON API this replaced, both of which
// shape the code below:
//   1. Auth is a service-account bearer token (cloud-platform scope), not an
//      API key, so credentials never live in the settings document.
//   2. Discovery Engine does NOT support Google search operators — no `site:`,
//      no `-exclude`. Platform selection and excluded words are therefore
//      applied as a post-filter over the returned documents.
const RECRUITMENT_SETTINGS_ID = "hr-recruitment-settings";
const VERTEX_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_COLLECTION_ID = "default_collection";
const DEFAULT_SERVING_CONFIG_ID = "default_search";
const VERTEX_LOCATIONS = [
  { id: "global", label: "Global" },
  { id: "us", label: "United States (us)" },
  { id: "eu", label: "Europe (eu)" },
];
const VERTEX_LOCATION_IDS = new Set(VERTEX_LOCATIONS.map((location) => location.id));
// Measured against the live data store, not assumed: basic website indexing
// returns exactly 20 documents per call whatever `pageSize` asks for, and hands
// back NO nextPageToken — so the cursor-based model cannot page at all. `offset`
// does work, and walks cleanly (100 distinct results across offsets 0/20/40/60/100
// with zero overlap), so offsets are how this pages.
const VERTEX_PAGE_SIZE = 20;
// Per platform, per page of ours: how far into the ranked list we are willing to
// walk while the post-filters discard non-matching URL shapes.
const MAX_UPSTREAM_PAGES = 5;
const PLATFORM_WINDOW = MAX_UPSTREAM_PAGES * VERTEX_PAGE_SIZE;
// Results are paged rather than fetched in one lump — a recruiter scans a
// screenful, then asks for the next one.
const PAGE_SIZE = 20;
const MAX_SKILLS = 10;

// GitHub's own pages sit at the same depth as usernames, so a single-segment
// URL is only a profile once these are excluded.
const GITHUB_RESERVED = new Set([
  "orgs", "topics", "features", "about", "pricing", "collections", "explore",
  "marketplace", "sponsors", "readme", "trending", "enterprise", "security",
  "team", "customer-stories", "login", "join", "settings", "notifications",
  "search", "new", "issues", "pulls", "codespaces", "apps", "site",
]);

// Probed against the live data store on 2026-08-19. Two findings shape this:
//   1. `site:<domain>` in the query text steers the ranker hard (20/20 on-domain
//      on every board); naming the platform in words steers it *wrong*, pulling
//      pages *about* the site instead of pages *on* it.
//   2. Indeed, Foundit and Naukri expose no public seeker profiles at all —
//      every URL they return is a job posting or a job-search page, in both
//      modes. Only LinkedIn and GitHub can answer a candidate search.
// `classify` returns what a URL actually is, so a result is never guessed at.
const PLATFORMS = [
  {
    id: "linkedin",
    label: "LinkedIn",
    hint: "Public member profiles and job posts",
    domain: "linkedin.com",
    supports: ["candidates", "jobs"],
    sitePatterns: ["linkedin.com/in/*", "in.linkedin.com/in/*", "linkedin.com/jobs/*"],
    classify(url) {
      if (/\/(in|pub)\//i.test(url)) return "candidates";
      if (/\/jobs?\//i.test(url)) return "jobs";
      return null;
    },
  },
  {
    id: "indeed",
    label: "Indeed",
    hint: "Job posts only — Indeed keeps resumes behind a login",
    domain: "indeed.com",
    supports: ["jobs"],
    sitePatterns: ["in.indeed.com/*", "indeed.com/viewjob*", "indeed.com/cmp/*"],
    classify(url) {
      if (/\/(viewjob|jobs|cmp|q-|m\/jobs)/i.test(url)) return "jobs";
      return /indeed\.com\/?$/i.test(url) ? null : "jobs";
    },
  },
  {
    id: "foundit",
    label: "Foundit",
    hint: "Job posts only — formerly Monster India",
    domain: "foundit.in",
    supports: ["jobs"],
    sitePatterns: ["foundit.in/job/*", "foundit.in/search/*", "foundit.in/seeker/*"],
    classify(url) {
      if (/\/(job|search)\//i.test(url)) return "jobs";
      return null;
    },
  },
  {
    id: "naukri",
    label: "Naukri",
    hint: "Job posts only — India's largest job board",
    domain: "naukri.com",
    supports: ["jobs"],
    sitePatterns: ["naukri.com/job-listings-*", "naukri.com/mp/*"],
    classify(url) {
      if (/\/job-listings|\/jobs/i.test(url)) return "jobs";
      return null;
    },
  },
  {
    id: "github",
    label: "GitHub",
    hint: "Developer profiles",
    domain: "github.com",
    supports: ["candidates"],
    sitePatterns: ["github.com/*"],
    classify(url) {
      // A user profile is github.com/<name> and nothing deeper. Repos, topics,
      // orgs and discussions all sit below that and are noise for sourcing.
      const match = String(url).match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/?$/i);
      if (!match) return null;
      return GITHUB_RESERVED.has(match[1].toLowerCase()) ? null : "candidates";
    },
  },
];
const PLATFORM_BY_ID = new Map(PLATFORMS.map((platform) => [platform.id, platform]));
const DEFAULT_PLATFORM_IDS = ["linkedin", "indeed", "foundit"];

const CANDIDATE_STATUSES = [
  { id: "sourced", label: "Sourced" },
  { id: "contacted", label: "Contacted" },
  { id: "screening", label: "Screening" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];
const CANDIDATE_STATUS_IDS = new Set(CANDIDATE_STATUSES.map((status) => status.id));

function text(value, max = 400) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Vertex snippets come back with <b> highlight markup around the matched terms.
function stripTags(value = "") {
  return text(String(value).replace(/<[^>]*>/g, " "), 600);
}

function toList(value, { max = 20, maxLength = 60 } = {}) {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(/[,\n]/);
  const seen = new Set();
  const list = [];
  for (const entry of raw) {
    const cleaned = text(entry, maxLength);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    list.push(cleaned);
    if (list.length >= max) break;
  }
  return list;
}

function experiencePhrase(min, max) {
  const from = Number.isFinite(min) && min > 0 ? Math.floor(min) : null;
  const to = Number.isFinite(max) && max > 0 ? Math.floor(max) : null;
  if (from && to) return `${from} to ${to} years experience`;
  if (from) return `${from}+ years experience`;
  if (to) return `up to ${to} years experience`;
  return "";
}

// One shared data store holds every board and Discovery Engine returns a single
// semantically-ranked list, so a blended query lets LinkedIn take nearly every
// slot. Each platform is therefore queried on its own.
//
// The steering mechanism matters: probing the live store showed `site:<domain>`
// pins the ranker to that host (20/20 on-domain for every board), while naming
// the platform in words does the opposite — it surfaces pages *about* the site.
// Discovery Engine rejects a structured URI `filter` outright (HTTP 400) and
// ignores a `boostSpec` on the link, so the query text is the only lever.
function platformQuery(baseQuery, platformId) {
  const platform = PLATFORM_BY_ID.get(platformId);
  if (!platform) return baseQuery;
  // The mode tail is already on baseQuery; adding it again here produced
  // "... profile profile", which skews the ranker.
  return `site:${platform.domain} ${baseQuery}`;
}

// Discovery Engine ranks semantically, so a readable phrase beats the operator
// soup a Custom Search X-ray query needed.
function buildSearchQuery(input) {
  const mode = input.mode === "jobs" ? "jobs" : "candidates";
  const parts = [];
  if (input.keyword) parts.push(text(input.keyword, 120));
  if (input.skills.length) parts.push(input.skills.join(" "));
  const experience = experiencePhrase(input.experienceMin, input.experienceMax);
  if (experience) parts.push(experience);
  if (input.location) parts.push(text(input.location, 120));
  if (input.company) parts.push(text(input.company, 120));
  if (input.extraTerms) parts.push(text(input.extraTerms, 200));
  parts.push(mode === "jobs" ? "job opening" : "profile");

  // Retrieval anchor for the fallback: the role alone, which almost always
  // matches something, leaving skills and location to do their real job of
  // ranking rather than of quietly emptying the page.
  const broad = [
    text(input.keyword, 120) || input.skills[0] || "",
    mode === "jobs" ? "job opening" : "profile",
  ].filter(Boolean).join(" ");

  return { query: parts.filter(Boolean).join(" "), broadQuery: broad, mode };
}

function platformIdForLink(link = "") {
  const lower = String(link).toLowerCase();
  const match = PLATFORMS.find((platform) => lower.includes(platform.domain));
  return match ? match.id : "other";
}

// A result is kept only if the URL really is the kind of page this search asked
// for. `classify` reads that off the URL shape rather than guessing, so a job
// ad can never masquerade as a candidate profile.
function matchesSelectedPlatforms(link, platformIds, mode) {
  if (!platformIds.length) return true;
  const url = String(link || "");
  const lower = url.toLowerCase();
  return platformIds.some((id) => {
    const platform = PLATFORM_BY_ID.get(id);
    if (!platform || !lower.includes(platform.domain)) return false;
    return platform.classify(url) === mode;
  });
}

function matchesExcluded(result, excluded) {
  if (!excluded.length) return false;
  const haystack = `${result.name} ${result.headline} ${result.company} ${result.snippet} ${result.link}`.toLowerCase();
  return excluded.some((term) => haystack.includes(term.toLowerCase()));
}

// Skills, location and experience used to drop results outright, which meant a
// page of perfectly good profiles could vanish because none of them happened to
// spell the city in their snippet. They now only *rank*: every result survives
// and carries a score plus the reasons behind it, so the recruiter sees the
// near-misses instead of an empty page.
function scoreResult(result, input) {
  const haystack = `${result.name} ${result.headline} ${result.company} ${result.snippet}`.toLowerCase();
  const matchedSkills = input.skills.filter((skill) => haystack.includes(skill.toLowerCase()));
  const matchedLocation = Boolean(input.location) && haystack.includes(input.location.toLowerCase());
  const keywordWords = input.keyword ? input.keyword.toLowerCase().split(/\s+/).filter((word) => word.length > 2) : [];
  const matchedKeywords = keywordWords.filter((word) => haystack.includes(word));

  // Weighted so a skills match outranks a city match, and both outrank a loose
  // keyword hit — a React dev in the wrong city beats a designer in the right one.
  let score = 0;
  score += matchedSkills.length * 5;
  if (matchedLocation) score += 3;
  score += matchedKeywords.length * 2;
  if (result.photo) score += 1;

  const total = (input.skills.length * 5) + (input.location ? 3 : 0) + (keywordWords.length * 2) + 1;
  return {
    score,
    // 0-100, so the card can show a match strength without exposing weights.
    relevance: total > 0 ? Math.round((score / total) * 100) : 0,
    matchedSkills,
    matchedLocation,
    missingSkills: input.skills.filter((skill) => !matchedSkills.includes(skill)),
  };
}

function firstMeta(metatags = {}, keys = []) {
  for (const key of keys) {
    const value = text(metatags[key], 300);
    if (value) return value;
  }
  return "";
}

// Result titles are the only structured thing a public profile page gives us:
// "Name - Headline - Company | LinkedIn" and friends. Split on the separators
// the boards use, drop the trailing site brand, keep what's left.
function splitTitle(rawTitle, platformId) {
  const platform = PLATFORM_BY_ID.get(platformId);
  const brand = platform ? platform.label : "";
  let cleaned = text(rawTitle, 300);
  if (brand) cleaned = cleaned.replace(new RegExp(`\\s*[|\\-–—]\\s*${brand}(\\.com|\\.in)?\\s*$`, "i"), "");
  cleaned = cleaned.replace(/\s*[|\-–—]\s*(LinkedIn|Indeed\.com|Indeed|Foundit|Naukri\.com|Naukri|GitHub)\s*$/i, "");
  return cleaned
    .split(/\s+[|\-–—]\s+|\s+·\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// A LinkedIn headline is a comma-separated list too — "React, Next.js,
// JavaScript" sailed through the old comma test and every single card ended up
// labelled with a tech stack as its city. Verified against 60 live profiles:
// zero real locations were being extracted. This errs the other way and returns
// nothing unless the string genuinely reads like a place.
const TECH_WORDS = /\b(developer|engineer|stack|frontend|front-end|backend|back-end|fullstack|full-stack|react|node|next|angular|vue|java|python|django|sql|mongo|mongodb|express|aws|azure|docker|typescript|javascript|tailwind|redux|ui|ux|design|designer|intern|trainee|seeking|hiring|freelance|consultant|manager|analyst|architect|lead|senior|junior|sde|mern|mean|api|web|mobile|cloud|devops|testing|qa)\b/i;

function looksLikeLocation(value = "") {
  const cleaned = text(value, 80);
  if (!cleaned || cleaned.length > 60) return false;
  // Tech punctuation never appears in a place name.
  if (/[|•/@#]|\.(js|ts|py|net|io)\b|\+\+/i.test(cleaned)) return false;
  if (TECH_WORDS.test(cleaned)) return false;
  if (/\b(at|experience|education|skills|years|followers|connections|profile|linkedin)\b/i.test(cleaned)) return false;

  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return /^(remote|hybrid|work from home)$/i.test(cleaned);
  // Real places read "Pune, Maharashtra, India" — a few short, alphabetic parts.
  if (parts.length > 3) return false;
  return parts.every((part) => part.split(/\s+/).length <= 3 && /^[A-Za-z][A-Za-z .'-]*$/.test(part));
}

// A single bare word can be a city ("Gurugram") but is far too weak a signal to
// accept on its own — unless LinkedIn has already labelled it as the location,
// in which case the label is the evidence and only tech noise disqualifies it.
function isPlausiblePlace(value = "") {
  const cleaned = text(value, 80);
  if (!cleaned || cleaned.length > 60 || cleaned.split(/\s+/).length > 5) return false;
  if (/[|\u2022/@#]|\.(js|ts|py|net|io)\b|\+\+/i.test(cleaned)) return false;
  if (TECH_WORDS.test(cleaned)) return false;
  return /^[A-Za-z][A-Za-z ,.'-]*$/.test(cleaned);
}

// LinkedIn does state the city and employer explicitly when it states them at
// all, so read those labels rather than guessing from title fragments.
function locationFromText(value = "") {
  const labelled = String(value).match(/\bLocation:\s*([^·|]{2,60})/i);
  if (labelled) {
    // Snippets run on past the city ("Location: Mumbai ... Apr 2021 - May 2023"),
    // so stop at the first ellipsis, dash or digit instead of swallowing a whole
    // sentence and then rejecting it as implausible.
    const trimmed = text(labelled[1].split(/\.{2,}|\s[-\u2013]\s|\d/)[0], 120);
    if (isPlausiblePlace(trimmed)) return trimmed;
  }
  for (const chunk of String(value).split(/[·|]/)) {
    const cleaned = text(chunk, 80);
    if (cleaned && looksLikeLocation(cleaned)) return cleaned;
  }
  return "";
}

function companyFromText(value = "") {
  const labelled = String(value).match(/\bExperience:\s*([^·|]{2,60})/i);
  return labelled ? text(labelled[1], 120) : "";
}

function parseResultItem(searchResult = {}, mode) {
  const derived = searchResult.document?.derivedStructData || {};
  const link = text(derived.link || derived.formattedUrl, 500);
  const platformId = platformIdForLink(link || derived.displayLink || "");
  const metatags = derived.pagemap?.metatags?.[0] || {};
  const person = derived.pagemap?.person?.[0] || {};
  const rawTitle = stripTags(derived.title || derived.htmlTitle || firstMeta(metatags, ["og:title", "twitter:title"]));
  const snippet = stripTags(
    (Array.isArray(derived.snippets) ? derived.snippets.map((entry) => entry?.snippet).find(Boolean) : "") ||
    derived.extractive_answers?.[0]?.content ||
    firstMeta(metatags, ["og:description", "description"]),
  );
  const segments = splitTitle(rawTitle, platformId);
  const snippetParts = snippet.split(/\s+·\s+|\s+\|\s+/).map((part) => part.trim()).filter(Boolean);

  const firstName = text(metatags["profile:first_name"], 60);
  const lastName = text(metatags["profile:last_name"], 60);
  const metaName = [firstName, lastName].filter(Boolean).join(" ");
  const name = text(metaName || person.name || segments[0] || rawTitle, 120) || "Unknown";

  let headline = text(person.role || segments[1] || "", 200);
  // Structured metadata first, then an explicitly labelled "Experience:" in the
  // snippet. Title fragments are NOT a fallback — on LinkedIn they are skill
  // lists, and treating them as an employer filled the cards with nonsense.
  let company = text(person.org || companyFromText(snippet), 160);
  let location = text(person.address || locationFromText(snippet), 120);

  if (!location) {
    for (const segment of segments.slice(1)) {
      if (looksLikeLocation(segment)) { location = text(segment, 120); break; }
    }
  }
  // Only when the headline really is a place does it get promoted out of the way.
  if (looksLikeLocation(headline)) {
    location = location || headline;
    headline = text(segments[2] || "", 200);
  }
  if (mode === "jobs") {
    // Postings title as "Role - Company - Location", so segment 0 is the role
    // rather than a person's name.
    headline = text(segments[0] || rawTitle, 200);
    company = text(segments[1] || company, 160);
  }

  return {
    id: link || `${platformId}-${name}`,
    name,
    headline,
    company,
    location,
    snippet,
    link,
    platform: platformId,
    platformLabel: PLATFORM_BY_ID.get(platformId)?.label || "Web",
    displayLink: text(derived.displayLink, 160),
    thumbnail: text(derived.pagemap?.cse_thumbnail?.[0]?.src || derived.pagemap?.cse_image?.[0]?.src, 500),
  };
}

function defaultSettings() {
  return {
    projectId: process.env.VERTEX_SEARCH_PROJECT_ID || "",
    location: VERTEX_LOCATION_IDS.has(process.env.VERTEX_SEARCH_LOCATION) ? process.env.VERTEX_SEARCH_LOCATION : "global",
    dataStoreId: process.env.VERTEX_SEARCH_DATA_STORE_ID || "",
    engineId: process.env.VERTEX_SEARCH_ENGINE_ID || "",
    collectionId: process.env.VERTEX_SEARCH_COLLECTION_ID || DEFAULT_COLLECTION_ID,
    servingConfigId: process.env.VERTEX_SEARCH_SERVING_CONFIG_ID || DEFAULT_SERVING_CONFIG_ID,
  };
}

function settingsAreComplete(settings = {}) {
  return Boolean(settings.projectId && (settings.engineId || settings.dataStoreId));
}

// An engine (an "App" in the console) and a bare data store expose the same
// serving-config search method under different parents; the engine wins when
// both are configured because that is the resource the console hands you.
function servingConfigPath(settings) {
  const collection = settings.collectionId || DEFAULT_COLLECTION_ID;
  const servingConfig = settings.servingConfigId || DEFAULT_SERVING_CONFIG_ID;
  const parent = `projects/${settings.projectId}/locations/${settings.location || "global"}/collections/${collection}`;
  const resource = settings.engineId
    ? `engines/${settings.engineId}`
    : `dataStores/${settings.dataStoreId}`;
  return `${parent}/${resource}/servingConfigs/${servingConfig}`;
}

function vertexHost(location) {
  return location && location !== "global"
    ? `https://${location}-discoveryengine.googleapis.com`
    : "https://discoveryengine.googleapis.com";
}

function vertexErrorMessage(status, body) {
  const detail = text(body?.error?.message, 400);
  if (status === 401) return "Google rejected the service account credentials. Check GOOGLE_SERVICE_ACCOUNT_KEY on the server.";
  if (status === 403 && /has not been used|disabled/i.test(detail)) {
    return "The Discovery Engine API is not enabled on this Google Cloud project. Enable it, then search again.";
  }
  if (status === 403) {
    return `The service account is missing Vertex AI Search access: ${detail || "grant it the Discovery Engine Viewer role"}`;
  }
  if (status === 404) return "Vertex AI Search could not find that app or data store. Check the project ID, location, and IDs in Recruitment settings.";
  if (status === 429) return "Vertex AI Search is rate limiting this project. Wait a moment and try again.";
  if (status === 400) return `Vertex AI Search rejected the request: ${detail || "check the data store configuration"}`;
  return detail || `Vertex AI Search failed (HTTP ${status})`;
}

function toObjectId(value) {
  try {
    return new ObjectId(String(value));
  } catch {
    return null;
  }
}

// Candidates saved before the parser was tightened carry skill lists in their
// location and company fields ("Next.js", "Proficient in HTML, CSS"). Re-check
// on the way out so those records display correctly without rewriting stored
// data — a save the user made is theirs to keep, junk field or not.
function cleanStoredPlace(value = "") {
  const cleaned = text(value, 120);
  return cleaned && isPlausiblePlace(cleaned) ? cleaned : "";
}

function cleanStoredCompany(value = "") {
  const cleaned = text(value, 160);
  if (!cleaned) return "";
  // An employer name is not a stack: reject tech punctuation and skill words.
  if (/[|•/]|\.(js|ts|py|net|io)\b|\+\+|#/i.test(cleaned)) return "";
  if (TECH_WORDS.test(cleaned)) return "";
  return cleaned;
}

function serializeCandidate(doc = {}) {
  return {
    id: String(doc._id),
    name: doc.name || "Unknown",
    headline: doc.headline || "",
    company: cleanStoredCompany(doc.company),
    location: cleanStoredPlace(doc.location),
    snippet: doc.snippet || "",
    link: doc.link || "",
    platform: doc.platform || "other",
    platformLabel: PLATFORM_BY_ID.get(doc.platform)?.label || "Web",
    thumbnail: doc.thumbnail || "",
    status: doc.status || "sourced",
    notes: doc.notes || "",
    tags: doc.tags || [],
    role: doc.role || "",
    savedByName: doc.savedByName || "",
    savedById: doc.savedById ? String(doc.savedById) : "",
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function serializeSearch(doc = {}) {
  return {
    id: String(doc._id),
    keyword: doc.keyword || "",
    skills: doc.skills || [],
    experienceMin: doc.experienceMin ?? null,
    experienceMax: doc.experienceMax ?? null,
    location: doc.location || "",
    company: doc.company || "",
    platforms: doc.platforms || [],
    mode: doc.mode || "candidates",
    query: doc.query || "",
    resultCount: doc.resultCount || 0,
    totalResults: doc.totalResults || 0,
    runByName: doc.runByName || "",
    createdAt: doc.createdAt || null,
  };
}

function sanitizeSearchInput(body = {}) {
  const experienceMin = Number(body.experienceMin);
  const experienceMax = Number(body.experienceMax);
  const platforms = toList(body.platforms, { max: PLATFORMS.length, maxLength: 30 })
    .map((id) => id.toLowerCase())
    .filter((id) => PLATFORM_BY_ID.has(id));
  return {
    keyword: text(body.keyword, 120),
    skills: toList(body.skills, { max: MAX_SKILLS }),
    experienceMin: Number.isFinite(experienceMin) && experienceMin > 0 ? Math.min(40, experienceMin) : null,
    experienceMax: Number.isFinite(experienceMax) && experienceMax > 0 ? Math.min(40, experienceMax) : null,
    location: text(body.location, 120),
    company: text(body.company, 120),
    extraTerms: text(body.extraTerms, 200),
    excludeTerms: toList(body.excludeTerms, { max: 6 }),
    platforms: platforms.length ? platforms : DEFAULT_PLATFORM_IDS,
    mode: body.mode === "jobs" ? "jobs" : "candidates",
    country: /^[a-z]{2}$/i.test(String(body.country || "")) ? String(body.country).toLowerCase() : "in",
    pageSize: PAGE_SIZE,
    // The page number *is* the cursor: each page maps to a fixed offset window
    // per platform, so page N always shows the same results and Back works
    // without keeping any server-side state.
    page: Number.isFinite(Number(body.page)) && Number(body.page) > 0 ? Math.min(50, Math.floor(Number(body.page))) : 1,
  };
}

function registerRecruitmentModule(app, { connectDb, getGoogleAuth, hasMenuAccess, hasPrivilege, addActivityLog }) {
  let setupPromise;
  async function setup() {
    if (!setupPromise) {
      setupPromise = (async () => {
        const db = await connectDb();
        await Promise.all([
          db.collection("recruitmentCandidates").createIndex({ link: 1 }, { unique: true, sparse: true }),
          db.collection("recruitmentCandidates").createIndex({ status: 1, updatedAt: -1 }),
          db.collection("recruitmentSearches").createIndex({ createdAt: -1 }),
        ]);
        return db;
      })().catch((error) => {
        setupPromise = undefined;
        throw error;
      });
    }
    return setupPromise;
  }

  // The Sheets/Drive auth already on the server can't call Discovery Engine —
  // that needs the cloud-platform scope — so this asks for its own client.
// If VERTEX_SA_KEY_FILE is set, use that dedicated key (needed when the main
// service account lives in a different GCP org that blocks cross-project IAM).
  let authPromise;
  async function vertexAccessToken() {
    if (!authPromise) {
      authPromise = (async () => {
        const keyFile = process.env.VERTEX_SA_KEY_FILE;
        if (keyFile) {
          const { GoogleAuth } = require("google-auth-library");
          const resolvedKey = path.isAbsolute(keyFile)
            ? keyFile
            : path.join(__dirname, "..", keyFile);
          return new GoogleAuth({ keyFile: resolvedKey, scopes: [VERTEX_SCOPE] });
        }
        return getGoogleAuth([VERTEX_SCOPE]);
      })().catch((error) => {
        authPromise = undefined;
        throw error;
      });
    }
    const auth = await authPromise;
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Could not mint a Google access token for Vertex AI Search");
    return token;
  }

  async function callVertexSearch({ settings, query, offset, country }) {
    const path = servingConfigPath(settings);
    const token = await vertexAccessToken();
    const body = {
      query,
      pageSize: VERTEX_PAGE_SIZE,
      contentSearchSpec: { snippetSpec: { returnSnippet: true } },
      queryExpansionSpec: { condition: "AUTO" },
      spellCorrectionSpec: { mode: "AUTO" },
    };
    if (offset > 0) body.offset = offset;
    // Only meaningful for public website data stores; harmless elsewhere.
    if (country) body.params = { user_country_code: country };

    const response = await fetch(`${vertexHost(settings.location)}/v1/${path}:search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(vertexErrorMessage(response.status, payload));
      error.status = response.status === 429 ? 429 : 502;
      throw error;
    }
    return payload;
  }

  // Runs one platform's own query and keeps only that platform's documents.
  // Each of our pages owns a fixed offset window per platform, and we walk
  // forward inside it until we have `target` keepers — the post-filters discard
  // whole batches (a page of Indeed job ads during a candidate search), so one
  // upstream call is rarely enough.
  async function searchPlatform({ settings, baseQuery, broadQuery, platformId, mode, input, target, page }) {
    const results = [];
    const seen = new Set();
    const filtered = { offPlatform: 0, excluded: 0 };
    const startOffset = (page - 1) * PLATFORM_WINDOW;
    let totalResults = 0;
    let pagesFetched = 0;
    let broadened = false;

    // Walks this page's offset window for one query, returning true if the
    // ranked list ran out inside it.
    async function walk(rawQuery) {
      const query = platformQuery(rawQuery, platformId);
      for (let step = 0; step < MAX_UPSTREAM_PAGES && results.length < target; step += 1) {
        const offset = startOffset + (step * VERTEX_PAGE_SIZE);
        const body = await callVertexSearch({ settings, query, offset, country: input.country });
        pagesFetched += 1;
        totalResults = Math.max(totalResults, Number(body.totalSize || 0));
        const batch = body.results || [];

        for (const searchResult of batch) {
          const parsed = parseResultItem(searchResult, mode);
          if (!parsed.link || seen.has(parsed.link)) continue;
          // This query belongs to one platform, so anything else is noise the
          // shared data store returned.
          if (!matchesSelectedPlatforms(parsed.link, [platformId], mode)) {
            filtered.offPlatform += 1;
            continue;
          }
          if (matchesExcluded(parsed, input.excludeTerms)) {
            filtered.excluded += 1;
            continue;
          }
          seen.add(parsed.link);
          // Scored, not filtered: a weak match still belongs on the page, just
          // further down it.
          results.push({ ...parsed, ...scoreResult(parsed, input) });
        }

        // A short batch means the ranked list ran out, so there is nothing
        // deeper to offer on the next page either.
        if (batch.length < VERTEX_PAGE_SIZE) return true;
      }
      return false;
    }

    let exhausted = await walk(baseQuery);

    // Skills and location sit in the query text, so they narrow *retrieval* as
    // well as ranking — "COBOL Fortran Reykjavik" comes back with a single
    // document before any filter runs. When the specific query returns thin,
    // widen to the role alone and let scoring sort the looser matches down the
    // page, rather than handing back an empty one.
    if (results.length < Math.ceil(target / 2) && broadQuery && broadQuery !== baseQuery) {
      broadened = true;
      exhausted = await walk(broadQuery);
    }

    return { platformId, results, filtered, totalResults, pagesFetched, exhausted, broadened };
  }

  function canManage(req) {
    return Boolean(req.authUser?.isSuperAdmin || hasPrivilege(req, "manage_hr"));
  }

  function guard(req, res) {
    if (!hasMenuAccess(req, "hr-recruitment")) {
      res.status(403).json({ error: "Recruitment access required" });
      return false;
    }
    return true;
  }

  async function readSettings(db) {
    const saved = await db.collection("platformSettings").findOne({ _id: RECRUITMENT_SETTINGS_ID });
    const merged = { ...defaultSettings() };
    for (const key of ["projectId", "location", "dataStoreId", "engineId", "collectionId", "servingConfigId"]) {
      if (saved?.[key]) merged[key] = saved[key];
    }
    return { ...merged, updatedAt: saved?.updatedAt || null, updatedBy: saved?.updatedBy || null };
  }

  function publicSettings(settings) {
    const complete = settingsAreComplete(settings);
    return {
      configured: complete,
      projectId: settings.projectId || "",
      location: settings.location || "global",
      dataStoreId: settings.dataStoreId || "",
      engineId: settings.engineId || "",
      collectionId: settings.collectionId || DEFAULT_COLLECTION_ID,
      servingConfigId: settings.servingConfigId || DEFAULT_SERVING_CONFIG_ID,
      servingConfig: complete ? servingConfigPath(settings) : "",
      serviceAccountConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      updatedAt: settings.updatedAt || null,
      updatedBy: settings.updatedBy || null,
    };
  }

  app.get("/hr/recruitment", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const db = await setup();
      const [settings, candidates, searches] = await Promise.all([
        readSettings(db),
        db.collection("recruitmentCandidates").find({}).sort({ updatedAt: -1 }).limit(300).toArray(),
        db.collection("recruitmentSearches").find({}).sort({ createdAt: -1 }).limit(25).toArray(),
      ]);
      const pipeline = candidates.map(serializeCandidate);
      const statusCounts = CANDIDATE_STATUSES.reduce((counts, status) => {
        counts[status.id] = pipeline.filter((candidate) => candidate.status === status.id).length;
        return counts;
      }, {});
      res.json({
        settings: publicSettings(settings),
        platforms: PLATFORMS.map(({ id, label, hint, sitePatterns, supports }) => ({ id, label, hint, sitePatterns, supports })),
        locations: VERTEX_LOCATIONS,
        pageSize: PAGE_SIZE,
        defaultPlatforms: DEFAULT_PLATFORM_IDS,
        statuses: CANDIDATE_STATUSES,
        candidates: pipeline,
        searches: searches.map(serializeSearch),
        statusCounts,
        canManage: canManage(req),
        resultsPerPage: VERTEX_PAGE_SIZE,
      });
    } catch (error) {
      console.error("Recruitment load error:", error);
      res.status(500).json({ error: "Could not load recruitment dashboard" });
    }
  });

  app.put("/hr/recruitment/settings", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      if (!canManage(req)) return res.status(403).json({ error: "HR manage permission required" });
      const db = await setup();
      const projectId = text(req.body?.projectId, 120);
      const dataStoreId = text(req.body?.dataStoreId, 120);
      const engineId = text(req.body?.engineId, 120);
      const location = VERTEX_LOCATION_IDS.has(String(req.body?.location)) ? String(req.body.location) : "global";
      if (!projectId) return res.status(400).json({ error: "Google Cloud project ID is required" });
      if (!dataStoreId && !engineId) return res.status(400).json({ error: "Add a data store ID or an app (engine) ID" });
      const payload = {
        projectId,
        location,
        dataStoreId,
        engineId,
        collectionId: text(req.body?.collectionId, 120) || DEFAULT_COLLECTION_ID,
        servingConfigId: text(req.body?.servingConfigId, 120) || DEFAULT_SERVING_CONFIG_ID,
        updatedAt: new Date(),
        updatedBy: { id: req.authUser.id, name: req.authUser.displayName || req.authUser.username || "User" },
      };
      await db.collection("platformSettings").updateOne(
        { _id: RECRUITMENT_SETTINGS_ID },
        { $set: payload, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      addActivityLog({ req, action: "Updated recruitment search settings", target: "HR Recruitment", details: { projectId, location, dataStoreId, engineId } });
      res.json({ success: true, settings: publicSettings(payload) });
    } catch (error) {
      console.error("Recruitment settings save error:", error);
      res.status(500).json({ error: "Could not save recruitment settings" });
    }
  });

  app.post("/hr/recruitment/search", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const db = await setup();
      const settings = await readSettings(db);
      if (!settingsAreComplete(settings)) {
        return res.status(400).json({ error: "Add your Vertex AI Search project and data store in Recruitment settings first.", needsSetup: true });
      }
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        return res.status(400).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is not set on the server, so Vertex AI Search cannot be called.", needsSetup: true });
      }
      const input = sanitizeSearchInput(req.body || {});
      if (!input.keyword && !input.skills.length) {
        return res.status(400).json({ error: "Add a role keyword or at least one skill to search" });
      }
      const { query, broadQuery, mode } = buildSearchQuery(input);
      if (!query) return res.status(400).json({ error: "Nothing to search with these filters" });

      // Ask each platform for its fair share, plus headroom so a board that
      // runs dry does not shrink the page.
      const perPlatform = Math.max(6, Math.ceil((input.pageSize / input.platforms.length) * 2));
      const runs = await Promise.all(input.platforms.map((platformId) =>
        searchPlatform({
          settings,
          baseQuery: query,
          broadQuery,
          platformId,
          mode,
          input,
          target: perPlatform,
          page: input.page,
        }).catch((error) => {
          // One dead platform must not fail the whole search.
          console.error(`Recruitment search failed for ${platformId}:`, error.message);
          return { platformId, results: [], filtered: { offPlatform: 0, excluded: 0 }, totalResults: 0, pagesFetched: 0, exhausted: true, broadened: false, error: error.message };
        })
      ));

      // Interleave round-robin so every platform is represented, then sort the
      // page by relevance. Interleaving first guarantees each board a share of
      // the page; sorting after puts the best matches on top of that share.
      const collected = [];
      const seenLinks = new Set();
      for (let index = 0; collected.length < input.pageSize; index += 1) {
        let addedThisRound = false;
        for (const run of runs) {
          const candidate = run.results[index];
          if (!candidate || seenLinks.has(candidate.link)) continue;
          seenLinks.add(candidate.link);
          collected.push(candidate);
          addedThisRound = true;
          if (collected.length >= input.pageSize) break;
        }
        if (!addedThisRound) break;
      }
      collected.sort((a, b) => (b.score || 0) - (a.score || 0));

      const filtered = { offPlatform: 0, excluded: 0 };
      const perPlatformCounts = {};
      let totalResults = 0;
      let pagesFetched = 0;
      // There is more to show as long as one platform still had depth left in
      // its window — its next window starts where this one stopped.
      let hasNextPage = false;
      // Surfaced to the UI so a widened search never passes as an exact one.
      let broadened = false;
      for (const run of runs) {
        if (run.broadened) broadened = true;
        for (const key of Object.keys(filtered)) filtered[key] += run.filtered[key] || 0;
        perPlatformCounts[run.platformId] = run.results.length;
        totalResults += run.totalResults;
        pagesFetched += run.pagesFetched;
        if (!run.exhausted) hasNextPage = true;
      }

      const payload = {
        results: collected,
        totalResults,
        pagesFetched,
        filtered,
        perPlatformCounts,
        hasNextPage: hasNextPage && collected.length > 0,
        broadened,
      };
      const savedLinks = payload.results.length
        ? await db.collection("recruitmentCandidates")
            .find({ link: { $in: payload.results.map((result) => result.link) } }, { projection: { link: 1, status: 1 } })
            .toArray()
        : [];
      const savedByLink = new Map(savedLinks.map((doc) => [doc.link, doc.status || "sourced"]));

      // Only page 1 is a new search; pages 2+ are the same search continued.
      if (input.page === 1) {
        await db.collection("recruitmentSearches").insertOne({
          ...input,
          platforms: input.platforms,
          query,
          mode,
          resultCount: payload.results.length,
          totalResults: payload.totalResults,
          runById: new ObjectId(req.authUser.id),
          runByName: req.authUser.displayName || req.authUser.username || "User",
          createdAt: new Date(),
        });
        addActivityLog({
          req,
          action: "Ran recruitment search",
          target: input.keyword || input.skills.join(", ") || "Recruitment",
          details: { platforms: input.platforms, mode, results: payload.results.length },
        });
      }

      res.json({
        query,
        mode,
        platforms: input.platforms,
        engine: "vertex-ai-search",
        servingConfig: servingConfigPath(settings),
        pagesFetched: payload.pagesFetched,
        filtered: payload.filtered,
        perPlatformCounts: payload.perPlatformCounts,
        pageSize: input.pageSize,
        page: input.page,
        hasNextPage: payload.hasNextPage,
        broadened: payload.broadened,
        totalResults: payload.totalResults,
        results: payload.results.map((result) => ({ ...result, savedStatus: savedByLink.get(result.link) || null })),
      });
    } catch (error) {
      console.error("Recruitment search error:", error.message);
      res.status(error.status || 500).json({ error: error.message || "Could not run the search" });
    }
  });

  app.post("/hr/recruitment/candidates", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const db = await setup();
      const link = text(req.body?.link, 500);
      if (!link) return res.status(400).json({ error: "Candidate profile link is required" });
      const now = new Date();
      const doc = {
        name: text(req.body?.name, 120) || "Unknown",
        headline: text(req.body?.headline, 200),
        company: text(req.body?.company, 160),
        location: text(req.body?.location, 120),
        snippet: text(req.body?.snippet, 600),
        link,
        platform: PLATFORM_BY_ID.has(req.body?.platform) ? req.body.platform : platformIdForLink(link),
        thumbnail: text(req.body?.thumbnail, 500),
        role: text(req.body?.role, 120),
        tags: toList(req.body?.tags, { max: 10 }),
        notes: text(req.body?.notes, 2000),
        status: CANDIDATE_STATUS_IDS.has(req.body?.status) ? req.body.status : "sourced",
        updatedAt: now,
      };
      const result = await db.collection("recruitmentCandidates").findOneAndUpdate(
        { link },
        {
          $set: doc,
          $setOnInsert: {
            createdAt: now,
            savedById: new ObjectId(req.authUser.id),
            savedByName: req.authUser.displayName || req.authUser.username || "User",
          },
        },
        { upsert: true, returnDocument: "after" },
      );
      addActivityLog({ req, action: "Saved recruitment candidate", target: doc.name, details: { platform: doc.platform, link } });
      res.json({ success: true, candidate: serializeCandidate(result?.value || result) });
    } catch (error) {
      console.error("Recruitment candidate save error:", error);
      res.status(500).json({ error: "Could not save the candidate" });
    }
  });

  app.patch("/hr/recruitment/candidates/:id", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const db = await setup();
      const _id = toObjectId(req.params.id);
      if (!_id) return res.status(400).json({ error: "Invalid candidate id" });
      const update = { updatedAt: new Date() };
      if (req.body?.status !== undefined) {
        if (!CANDIDATE_STATUS_IDS.has(req.body.status)) return res.status(400).json({ error: "Unknown candidate status" });
        update.status = req.body.status;
      }
      if (req.body?.notes !== undefined) update.notes = text(req.body.notes, 2000);
      if (req.body?.tags !== undefined) update.tags = toList(req.body.tags, { max: 10 });
      if (req.body?.role !== undefined) update.role = text(req.body.role, 120);
      const result = await db.collection("recruitmentCandidates").findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" });
      const candidate = result?.value || result;
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });
      addActivityLog({ req, action: "Updated recruitment candidate", target: candidate.name, details: update });
      res.json({ success: true, candidate: serializeCandidate(candidate) });
    } catch (error) {
      console.error("Recruitment candidate update error:", error);
      res.status(500).json({ error: "Could not update the candidate" });
    }
  });

  app.delete("/hr/recruitment/candidates/:id", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const db = await setup();
      const _id = toObjectId(req.params.id);
      if (!_id) return res.status(400).json({ error: "Invalid candidate id" });
      const existing = await db.collection("recruitmentCandidates").findOne({ _id });
      if (!existing) return res.status(404).json({ error: "Candidate not found" });
      if (!canManage(req) && String(existing.savedById) !== String(req.authUser.id)) {
        return res.status(403).json({ error: "Only the person who saved this candidate, or an HR manager, can remove it" });
      }
      await db.collection("recruitmentCandidates").deleteOne({ _id });
      addActivityLog({ req, action: "Removed recruitment candidate", target: existing.name || "Candidate" });
      res.json({ success: true });
    } catch (error) {
      console.error("Recruitment candidate delete error:", error);
      res.status(500).json({ error: "Could not remove the candidate" });
    }
  });

  app.delete("/hr/recruitment/searches/:id", async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const db = await setup();
      const _id = toObjectId(req.params.id);
      if (!_id) return res.status(400).json({ error: "Invalid search id" });
      await db.collection("recruitmentSearches").deleteOne({ _id });
      res.json({ success: true });
    } catch (error) {
      console.error("Recruitment search delete error:", error);
      res.status(500).json({ error: "Could not remove the search" });
    }
  });
}

module.exports = {
  registerRecruitmentModule,
  buildSearchQuery,
  parseResultItem,
  servingConfigPath,
  matchesSelectedPlatforms,
  PLATFORMS,
  CANDIDATE_STATUSES,
};
