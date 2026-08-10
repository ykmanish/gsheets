# raga

Express backend (`backend/server.js`, single file) + Next.js frontend (`frontend/`), MongoDB Atlas.

## Database map

Database: **`sheets`** on `cluster0.zm7l2fa`. Read access is via the `raga-mongo` MCP server (read-only).

*Schema notes below were verified against live data on 2026-08-10: 524 reports, 3013 task items, 23 employees, `reportDate` spanning 2026-07-02 → 2026-08-10.*

### Traps — read before writing any query

- **`userId` is not the same type everywhere.** `employeeDailyReports.userId` is a **string** (hex form of the user `_id`, see `employeeReportCacheDocument`). Everywhere else — `personalTodos`, `hrLeaveRequests`, `hrAttendanceRecords`, `hrSalaryProfiles` — it is an **ObjectId**. Joining DMR to any other collection needs `$toString`/`$toObjectId` in the pipeline, or it returns zero rows with no error.
- **Dates are strings, not `Date`.** `reportDate`, `startDate`, `endDate`, and attendance `date` are `"YYYY-MM-DD"` strings, so range filters are lexical (`{ reportDate: { $gte: "2026-08-01", $lte: "2026-08-31" } }`). Only `submittedAt`, `clockInAt`, `clockOutAt`, `createdAt`, `updatedAt`, `cachedAt` are real `Date` objects — **except** `personalTodos.createdAt`/`updatedAt`, which are ISO **strings**.
- **Never combine `$regex` with `$gte`/`$lte` on the same field.** MongoDB silently drops the range and returns everything the regex matches. Verified: `{ reportDate: { $gte: "2026-08-04", $lte: "2026-08-10", $regex: "^\\d{4}-\\d{2}-\\d{2}$" } }` returns **521** reports instead of **87** — the whole collection, with no error. Put the regex in its own `$match` stage or an `$and`.
- **3 documents have a garbage `reportDate`** — sheet header/description text ingested as a date (all Chirag Gajjar; e.g. `"CHECKING OPTIONS AND THEN DISCUSSION"`). They poison `$min`/`$max`/sorts on `reportDate`. A **bounded range filter already excludes them** (letters sort above digits, so `"CHECKING…" > "2026-08-10"`) — so don't add a regex guard to a range query. Guard with a separate `{ reportDate: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } }` stage only for `$min`/`$max`, sorts, or open-ended queries.
- **Over MCP, write regexes in operator form** — `{ $regex: "^completed$", $options: "i" }`, not `/^completed$/i`. JSON transport can't carry a regex literal.
- **Site names need normalizing before grouping.** 5 sites exist in case/spacing variants and will silently split a per-site rollup: `OFFICE`/`Office`/`office` (869 items), `Paramdham`/`PARAMDHAM` (498), `Swati senor`/`Swati Senor`/`SWATI SENOR`/`swati senor` (161), `All Projects`/`all projects`, `Harmony`/`harmony`. Group on `{ $toLower: { $trim: { input: "$taskItems.site" } } }`. Beyond those there are ~50 distinct free-text site values including `Kalhaar` vs `Kalhar`, `NO SITE`, `NONE`, `WFH`, and personal names.
- **There is no `tasks` collection.** Tasks live inside arrays and sub-documents — see below.
- **`employeeDailyReports` is a cache** of per-employee Google Sheets, upserted on `{ userId, reportDate }`. It can lag the sheet.
- Exclude the `Super Admin` account from people-facing rollups (1 report); `sanitizeEmployeeReport` callers filter it by name.

### Where tasks actually live

| Collection | Task shape |
|---|---|
| `employeeDailyReports` | `taskItems[]` — the real DMR tasks. Always present: `site`, `category`, `status`, `description`. Often present: `involvement` (99%), `involvementValues[]` (89%), `recurringId` (89%), `recurring` (21%) — use `$ifNull`. Also `waitingTaskItems[]` (blocked / tomorrow's plan). Report-level: `reportId`, `userId`, `employeeName`, `department`, `reportDate`, `submittedAt`, `client`, `site`, `note`, `tomorrowPlanTick`, `cachedAt`. |
| `personalTodos` | One doc per todo (10 docs). `userId` (ObjectId), `completed` (bool), `importedAt`, `createdAt`/`updatedAt` (ISO strings), and `task{ site, siteOther, category, categoryOther, status, statusOther, involvement, involvementValues, involvementOther, description, recurring }` — note the `*Other` free-text companions to each dropdown. |
| `employeeSiteTaskRemarks` | Remarks attached to site tasks. |

`waitingTaskItems[]` carries ordinary category values in stored data (top 5: `Drawing` 153, `Quotation` 103, `System Designing` 61, `Co-ordination` 43, `Delivery` 37) — **not** the literal `"Waiting / tomorrow plan"`, which only appears on the Google-Sheets import path. Identify waiting work by the array it's in, not by category.

Task items are capped at 30 per report by `sanitizeEmployeeTaskItems`, which drops any item missing `category` or `description`.

### Controlled vocabularies vs. reality

`EMPLOYEE_REPORT_OPTIONS` (`backend/server.js:618`) defines the dropdowns, but stored data contains values outside them — match loosely.

- **taskStatuses** — declared: `In Progress`, `Completed`, `Work Halt`, `Work Suspended`, `Work Cancelled`, `Other`. Actually in data: `Completed` 2158, `In Progress` 824, `Work Halt` 13, `""` 12, `Work Cancelled` 2, **`On Hold` 2**, **`work completed but design changed`** 1, `Work Suspended` 1. A filter for open work must not enumerate statuses — negate `Completed` instead: `{ "taskItems.status": { $not: /^completed$/i } }`.
- **departments** — declared: Design, Execution, Procurement, Coordination, Site Supervision, Vendor Management, Human Resource, Administration, Accounts, Social Media. Also in data: `EA`, `Horticulturist`, `Store`, `TRUE`.
- **involvements**: `Self`, `Client`, `Vendor`, `Team`, `Other`.

Status matching in code is case-insensitive (`/^completed$/i`), so use `$regex`/`$options: "i"` rather than exact equality.

### Other collections

- `users`, `roles`, `sessions` — auth. Menu access is checked via `hasMenuAccess`.
- `hrAttendanceRecords` (202) — `userId` (ObjectId), `date` (string), `status` (`checked-in`/…), `workMode` (`office`/`remote`), `clockInAt`/`clockOutAt` (Date), `clockInLocation`, `clockInDistanceMeters`.
- `hrLeaveRequests` (4) — `userId` (ObjectId), `employeeName`, `leaveType`, `startDate`/`endDate` (strings), `days`, `paidLeaveDays`, `unpaidLeaveDays`, `reason`, `status` (`pending`/…), `adminComment`.
- `hrSalaryProfiles`, `hrSalarySlips`, `hrSettings` — payroll. **Sensitive; don't pull into general reporting unless asked.**
- `forms` (2), `formSubmissions` (4) — custom form builder. `forms`: `slug`, `name`, `department`, `fields`, `version`, `isActive`, `allowedUserIds`, `spreadsheet`, `shares`. `formSubmissions`: `formId`, `formVersion`, `answers`, `submittedByUserId`, `syncStatus`/`syncError`/`syncedAt`.
- `announcements` — exists but empty.
- `employeeExecutiveReportAnswers`, `employeeExecutiveReportAnalyses` — management Q&A layered on a DMR, keyed `{userId, reportDate}`.
- `forumConversations`, `forumMessages`, `forumSettings` — internal forum. Message bodies are encrypted (`FORUM_ENCRYPTION_KEY`), so they are **not readable over MCP**.
- `platformSettings`, `dmrWhatsAppReminderRuns` — config and reminder run history.

### Worked example — open tasks this week by employee

Verified against live data — returns 14 employees, 141 open items for 2026-08-04 → 2026-08-10.
Note the range filter carries **no** `$regex`; adding one would silently return the whole collection.

```json
[
  { "$match": {
      "reportDate": { "$gte": "2026-08-04", "$lte": "2026-08-10" },
      "employeeName": { "$ne": "Super Admin" }
  } },
  { "$unwind": "$taskItems" },
  { "$match": { "taskItems.status": { "$not": { "$regex": "^completed$", "$options": "i" } } } },
  { "$group": {
      "_id": { "employee": "$employeeName", "department": "$department" },
      "open": { "$sum": 1 },
      "sites": { "$addToSet": { "$toLower": { "$trim": { "input": "$taskItems.site" } } } },
      "tasks": { "$push": { "date": "$reportDate", "site": "$taskItems.site",
                            "status": "$taskItems.status", "what": "$taskItems.description" } }
  } },
  { "$sort": { "open": -1 } }
]
```

Sanity anchors for that window: 87 reports across 6 dates (2026-08-09 has none), 505 task items total.
