# Setting up an independent Daily Digest on another account

This gives the CEO (or anyone else) their own live copy of the Daily Digest —
a separate artifact link, refreshed by their own nightly scheduled task,
independent of the original account's.

## Prerequisites

1. Open Claude Code under the other account, pointed at this same project
   folder (`C:\Users\my792\Desktop\raga`) — or a clone of it with the same
   `.mcp.json` and `RAGA_MONGODB_READONLY_URI` env var set, so the
   `raga-mongo` MCP connector works there too.
2. That's it — no Gmail connector needed for this one (only the MRN Vendor
   Outreach automation needs Gmail, and that's a separate, optional setup).

## The one-time setup prompt

Paste this into that session:

---

Read `backend/scripts/daily-digest-template.html` in this repo. Publish it as
a new Claude Artifact (do not pass a `url` — this creates a fresh artifact
under this account), title "Daily Digest", favicon "📋", description "Raga's
daily Attendance, DMR, and Stock summary, refreshed every evening."

Once published, note the resulting artifact URL, then create a scheduled task
using the scheduled-tasks tool:
- taskId: "raga-daily-digest"
- title: "Raga Daily Digest"
- description: "Pulls Attendance, DMR and Stock from raga-mongo and republishes the Daily Digest artifact"
- cronExpression: "0 20 * * *" (8:00 PM daily — ask the user first if they want a different time)
- prompt: the exact text below, with `<ARTIFACT_URL>` replaced everywhere by
  the URL you just got from publishing

[paste the full raga-daily-digest scheduled-task prompt here — see
`backend/scripts/daily-digest-task-prompt.txt` in this repo for the current
version, since it gets refined over time]

---

## Notes

- The two copies (this account's and the CEO's) will independently compute
  the same numbers from the same MongoDB data each night, but are otherwise
  fully decoupled — editing one's task or artifact doesn't touch the other's.
- If the digest's look or data logic changes later on the original account,
  re-copy `daily-digest-template.html` and the task prompt file to keep the
  CEO's version in sync — nothing propagates automatically between accounts.
