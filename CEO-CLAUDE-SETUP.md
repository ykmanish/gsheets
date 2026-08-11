# Giving the CEO's Claude read-only access to the `sheets` database (macOS)

Goal: on the CEO's Mac, he opens **Claude Desktop**, asks a question in plain English
("how many open tasks this week, by person?"), and Claude queries MongoDB directly.
No repo, no terminal, no code — after the one-time setup below.

**His different Claude account does not matter.** An MCP server is configured on the
*machine*, in the *app* — it is not attached to a Claude account or synced from ours.
So there is nothing to "share" from our side; we just repeat the setup on his Mac.

---

## Part 1 — Atlas prep (do this first, from your own machine)

Two things must be true before his Mac can connect, or he'll just see a timeout.

### 1a. Give him his own database user (do not reuse `uipldocs`)

Atlas → **Database Access** → *Add New Database User*

| Field | Value |
|---|---|
| Auth method | Password |
| Username | `ceo-readonly` |
| Password | Autogenerate → **copy it now**, it's shown once |
| Database User Privileges | *Only read any database* — or a custom role, see 1c |

Why a separate user: you can revoke his access without breaking ours, you can see in
Atlas logs which account ran what, and if his laptop is lost you rotate one credential
instead of both.

### 1b. Allow his network

Atlas → **Network Access** → *Add IP Address*

Have him open <https://whatismyipaddress.com> on the Mac and read you the IPv4. Add it
with a comment like `CEO MacBook — office`. If he works from home and the office, add
both, or add his home range.

> If his ISP rotates his IP, connections will start failing one day for no visible
> reason. The lazy fix is `0.0.0.0/0` (open to the whole internet) — don't. Better: add
> the few IPs he actually uses, and if it becomes a nuisance, revisit with a VPN or a
> hosted setup.

### 1c. Optional — hide payroll from his Claude

`hrSalaryProfiles`, `hrSalarySlips` and `hrSettings` sit in the same `sheets` database.
A plain *read any database* role means his Claude can read salaries. That's probably
fine for a CEO — but if you'd rather it not be casually queryable, build a custom role
instead of using the built-in read role:

Atlas → **Database Access** → *Custom Roles* → create `ceo-reporting` granting `find`
on only the collections he needs (`employeeDailyReports`, `projectDashboard`,
`hrAttendanceRecords`, `hrLeaveRequests`, `personalTodos`, `users`, `roles`,
`forms`, `formSubmissions`), then assign that role to `ceo-readonly` in 1a.

---

## Part 2 — On the CEO's Mac

### 2a. Install Claude Desktop

<https://claude.ai/download> → the macOS build. He signs in with **his own** account.

### 2b. Add MongoDB — try the one-click route first

Claude Desktop → **Settings → Extensions → Browse extensions** → search **MongoDB**.

There is an official MongoDB extension that bundles the MongoDB MCP Server (and some
MongoDB skills). If it's listed, install it and paste the connection string when it
asks. This route needs **no Node.js install and no JSON editing**, and Claude Desktop
stores the connection string in the macOS **Keychain** rather than a plaintext file.
That's the cleanest option for him — prefer it.

If it's not in the directory, use 2c.

### 2c. Manual route (if the extension isn't available)

**Install Node.js** — <https://nodejs.org> LTS `.pkg` installer. Then in Terminal:

```bash
which npx
```

Note the path it prints (usually `/usr/local/bin/npx`, or `/opt/homebrew/bin/npx` on
Apple Silicon with Homebrew). You need the **absolute path** — Claude Desktop on macOS
is launched by Finder and does not inherit his shell `PATH`, so a bare `npx` silently
fails to start. This is the single most common reason a Mac MCP setup shows
"server disconnected".

**Edit the config**: Claude Desktop → **Settings → Developer → Edit Config**, which
opens:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Paste this, substituting the `which npx` path and the real credentials:

```json
{
  "mcpServers": {
    "raga-mongo": {
      "command": "/usr/local/bin/npx",
      "args": ["-y", "mongodb-mcp-server@latest", "--readOnly"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://ceo-readonly:PASSWORD_HERE@cluster0.zm7l2fa.mongodb.net/sheets?appName=Cluster0"
      }
    }
  }
}
```

Notes on that block:

- `--readOnly` makes the MCP server refuse every write, update, drop and index change.
  Keep it. It's a client-side guard; the Atlas read-only role from Part 1a is the one
  that actually can't be bypassed. Use both.
- `/sheets` in the path sets the default database, so he can ask questions without
  naming the database every time.
- If his password contains `@ : / ? # [ ] %`, it must be percent-encoded in the URI, or
  the connection string parses wrong. Easiest: regenerate a password without symbols.
- This file is **plaintext on disk**. That's the tradeoff versus the extension route in
  2b, which uses the Keychain.

**Quit Claude Desktop fully** (⌘Q — closing the window isn't enough) and reopen it.

### 2d. Confirm it works

In a new chat, ask: *"What collections are in the sheets database?"*

He should see a tool-permission prompt, approve it, and get back a list including
`employeeDailyReports`, `projectDashboard`, `hrAttendanceRecords`. If instead he sees
nothing or an error, check in order: absolute `npx` path (2c), Atlas IP allowlist (1b),
then password encoding (2c).

---

## Part 3 — The part that actually decides answer quality

A bare MCP connection gets him *wrong* answers confidently. This schema has real traps:
dates are stored as strings, "tasks" means three unrelated things in three collections,
and one particular query shape silently returns the entire collection instead of a date
range. Claude cannot guess any of that from the field names.

So: in his Claude Desktop, create a **Project** (left sidebar → Projects → New) named
something like *Raga Data*, open **Project instructions**, and paste everything between
the markers below. He then asks all his data questions **inside that project**.

Five minutes of setup here is the difference between a useful tool and a confidently
wrong one.

---

### ✂️ PASTE FROM HERE ✂️

You have read-only MongoDB access to the `sheets` database for a design/build firm.
Answer questions about employees, daily reports, projects, attendance and leave by
querying it. Follow these rules — the schema has traps that produce silently wrong
answers.

**Route the question to the right collection before writing any query.** Each module
owns its own collection:

| Question about… | Query |
|---|---|
| Projects, phases, milestones, deadlines, project health, "Project Control" | `projectDashboard` |
| DMR, daily reports, "what did X do on date Y", site work logs | `employeeDailyReports` |
| Attendance, clock-in/out, present/absent | `hrAttendanceRecords` |
| Leave, paid leave, leave balance | `hrLeaveRequests` |
| Personal to-dos | `personalTodos` |
| Salary, payroll | `hrSalaryProfiles`, `hrSalarySlips` |
| Forms and submissions | `forms`, `formSubmissions` |
| People, roles, permissions | `users`, `roles` |

There is **no `tasks` collection**. "Tasks" exists in three unrelated places — project
tasks in `projectDashboard` (`config.projects[].phases[].tasks[]`), daily-report tasks
in `employeeDailyReports.taskItems[]`, and private to-dos in `personalTodos`. If a
question could mean more than one, answer from both and label each — never silently
pick one.

**Traps:**

1. **Dates are strings, not date objects.** `reportDate`, `startDate`, `endDate` and
   attendance `date` are `"YYYY-MM-DD"` strings, so ranges are lexical:
   `{ reportDate: { $gte: "2026-08-01", $lte: "2026-08-31" } }`. Only `submittedAt`,
   `clockInAt`, `clockOutAt`, `createdAt`, `updatedAt` are real dates — except
   `personalTodos.createdAt`/`updatedAt`, which are strings again.
2. **Never put `$regex` and `$gte`/`$lte` on the same field.** MongoDB drops the range
   and returns everything the regex matches — no error. A range query that should
   return 87 reports returns all 521. Put the regex in a separate `$match` stage.
3. **A few documents have garbage `reportDate` values** (sheet header text ingested as a
   date). A bounded range filter already excludes them. Only add a
   `{ reportDate: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } }` guard when using `$min`,
   `$max`, a sort, or an open-ended query.
4. **`userId` types differ.** In `employeeDailyReports` it's a **string**; everywhere
   else (`personalTodos`, `hrLeaveRequests`, `hrAttendanceRecords`,
   `hrSalaryProfiles`) it's an **ObjectId**. Joining daily reports to anything else
   needs `$toString` or `$toObjectId`, or you get zero rows with no error.
5. **`projectDashboard` is a single document**, `_id: "default"`, with every project
   under `config.projects[]`. `$unwind` `config.projects` first — never expect one doc
   per project.
6. **Normalize site names before grouping.** Several sites exist in case and spacing
   variants (`OFFICE`/`Office`/`office`, `Paramdham`/`PARAMDHAM`, `Swati senor` in four
   spellings) and will split a per-site rollup. Group on
   `{ $toLower: { $trim: { input: "$taskItems.site" } } }`. Also `Kalhaar` vs `Kalhar`
   and `Devsharanam` vs `Devsharnam` are the same places.
7. **Two different status vocabularies.** Project tasks use `todo` / `in_progress` /
   `done`. Daily-report tasks use `Completed` / `In Progress` / `Work Halt` and a few
   stragglers (`On Hold`, blanks, free text). Never reuse one module's status filter in
   the other. To find open daily-report work, **negate completed** rather than listing
   statuses: `{ "taskItems.status": { $not: { $regex: "^completed$", $options: "i" } } }`.
   Match statuses case-insensitively everywhere.
8. **Exclude the `Super Admin` account** from any people-facing rollup.
9. A project name appearing in both `projectDashboard` and the daily reports does
   **not** mean the two are linked — they aren't.
10. Overdue project task = `status != "done"` **and** `dueDate` non-empty **and**
    `dueDate < today`. Many tasks have an empty `dueDate` and can never be overdue.
11. `employeeDailyReports` is a cache of per-employee Google Sheets, so it can lag the
    live sheet by a short while.

**Style:** lead with the number or the answer, then the breakdown. Say which collection
and date range you used. If data is missing for a date, say so rather than reporting
zero as if it were a real result. Present findings as a table when comparing people,
sites or projects.

### ✂️ PASTE TO HERE ✂️

---

## Part 4 — What he can ask

Worth pasting into a note for him, so he doesn't have to guess:

- "Open tasks this week by employee — who has the most?"
- "What did the Paramdham site log in the last two weeks?"
- "Which project tasks are overdue right now, and who owns them?"
- "Attendance for August so far — anyone with unusual patterns?"
- "Summarize what the design department worked on last month by site."
- "Pending leave requests?"
- "Compare task completion rates across sites this month."

He should keep questions inside the *Raga Data* project — outside it, the instructions
from Part 3 don't load and the answers get less reliable.

---

## Maintenance

- If the schema changes materially, update Part 3 in his project instructions too —
  it's a copy, it won't follow our `CLAUDE.md`.
- Rotate `ceo-readonly` in Atlas if his Mac is ever lost, and re-paste the new string.
- If his IP changes and things break, Part 1b is the first place to look.
