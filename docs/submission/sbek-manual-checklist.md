# Manual verification checklist

Target: https://trackstage.app
Baseline run: `runs/2026-08-11T12-01-26` (the run that generated this 21-item list) ·
Latest full run: `runs/2026-08-11T18-41-41` (rerun-2, 150 turns, all 12 scenarios) ·
Final CNT+SPK pass: `runs/2026-08-12T01-01-00`

**Update after the final pass (2026-08-12).** Four of the items below are settled:
**CNT-11** (history + restore) and **CNT-14** (bulk ZIP, latest versions only) now come
back `pass` from the kit itself — no manual work left. **SPK-06** and **SPK-13** are
folded as `pass` on real delivery evidence: every send records a `resendId`, and Resend's
`GET /emails/{id}` reports `last_event: "delivered"` for the portal-link, bulk-compose,
confirmation, decision and reminder classes sent to real mailboxes. **CNT-08** stays
`partial` for a product reason, not an evidence one — the reminder *is* delivered, but its
body says only "you still have a few speaker tasks outstanding" and never names the task
or its due date, which the pass condition below requires.

The 21 items below are the ones the baseline flagged as not automatically verifiable.
Rerun-2 has since **auto-verified 8 of them outright** (marked ✅ AUTO-VERIFIED — no
manual work needed); the rest are either capped at *partial* by the rubric's own
construction (the browser agent cannot open inboxes, import an `.ics`, or unzip a
download) or have a small manual half left. For each remaining item: perform the
check, record the result in `manual-results.json`, then
`pnpm run finalize -- --run runs/2026-08-11T18-41-41` folds it into the final score.

## Status at a glance

| # | Item | w | Rerun-2 verdict | Manual work left |
| --- | --- | --- | --- | --- |
| 1 | ABS-07 blind review | 2 | **pass** | Optional: cross-reviewer isolation w/ 2nd account |
| 2 | ABS-09 reviewer reminder | 1 | **pass** ✅ AUTO-VERIFIED | None |
| 3 | ABS-13 scores export | 2 | **pass** | Open the exported CSV, sanity-check rows |
| 4 | ABS-14 AI review | 1 | not_found (deliberate) | None — swyx struck AI review from scope |
| 5 | CFP-08 confirmation email | 1 | manual-only | Real-inbox delivery |
| 6 | CFP-13 decision propagation | 2 | **pass** ✅ AUTO-VERIFIED | None |
| 7 | CFP-14 decision emails | 2 | partial (auto-capped) | Real-inbox delivery, accept + decline |
| 8 | CFP-16 edit lock on close | 2 | **pass** ✅ AUTO-VERIFIED | None (was a fail; fix `612828d` verified by the kit) |
| 9 | CNT-08 bulk task reminders | 2 | partial (auto-capped) | Real-inbox delivery |
| 10 | CNT-10 organizer edits profile | 2 | **pass** ✅ AUTO-VERIFIED | None |
| 11 | CNT-11 history + restore | 2 | partial | **Re-verify restore on prod** — broken during the run, fixed after (`45ba304`) |
| 12 | CNT-12 approval gate on public agenda | 3 | **pass** ✅ AUTO-VERIFIED | None |
| 13 | CNT-14 bulk file download | 2 | partial (auto-capped) | Open the download, check latest-version contents |
| 14 | EMB-11 personal schedule + .ics | 1 | pass (baseline; area not rerun) | Import the .ics in a calendar app |
| 15 | EMB-15 embed builder | 3 | partial (baseline) | Product gaps since closed — paste snippet on a 3rd-party page |
| 16 | EMB-16 cross-surface consistency | 3 | pass (baseline) | Edit propagation to a placed embed without republishing |
| 17 | SPK-06 portal invite email | 2 | **pass** ✅ AUTO-VERIFIED | Optional: real-inbox delivery |
| 18 | SPK-07 scoped speaker portal | 3 | **pass** ✅ AUTO-VERIFIED | None (agent reached the portal via token link) |
| 19 | SPK-10 deliverable download | 2 | **pass** ✅ AUTO-VERIFIED | Optional: open the file locally |
| 20 | SPK-13 bulk email + log | 2 | pass | Optional: real-inbox delivery |
| 21 | SPK-16 automated due-date reminders | 1 | manual-only | Wait through a reminder cycle (daily crons 09:00/09:30 UTC) |

Rerun-2 also surfaced one **new** manual item not in the baseline 21: **CFP-07**
(draft save/resume) came back `cannot_judge` — verify by hand: start a submission,
"Save as draft" (the persistent "Draft saved at HH:MM" stamp is the receipt), close the
tab, return with the same email, confirm the draft resumes.

## The remaining manual checks, in execution order

### A. Email egress (needs a real inbox) — covers CFP-08, CFP-14, CNT-08, SPK-06/13

1. Submit a talk at /submit/ai-engineer/ai-summit-2026/cfp with a real address →
   confirmation email arrives from hello@trackstage.app naming the event + talk title
   (CFP-08).
2. Organizer: stage that submission → Accept Queue → commit → acceptance email arrives
   with a working portal link. Repeat with a second submission through the Decline
   Queue → decline email (CFP-14 — capture both).
3. Speakers → "Remind all incomplete" → confirm dialog → reminder arrives naming the
   outstanding task and due date (CNT-08). NOTE: a 24-hour dedup guard means a
   recently-reminded speaker yields the "already reminded" receipt — use a fresh
   speaker or wait out the window.
4. Compose a bulk email to All speakers including your real address → arrives with the
   composed subject; Outbox shows the send (SPK-13, SPK-06's delivery half).

### B. Files & exports — covers ABS-13, CNT-11, CNT-14

5. Evaluation → "Export scores" → open the CSV: one row per submission with title,
   scores, recommendation matching the on-screen table (ABS-13's content half).
6. Submission drawer → History tab → make two wording edits → "Restore this version"
   on the earlier entry → the text actually reverts and the restore logs its own entry
   (CNT-11 — the run hit the pre-fix bug; `45ba304` moved wording into a
   `submissionVersions` table. This is the highest-value manual re-check).
7. Files → select 2 rows → "Download 2 selected" → open the result: latest versions
   only, deselected files absent (CNT-14).

### C. Calendar — covers EMB-11 (+ the .ics invite path)

8. Schedule an accepted talk (room + time) → speaker email carries an .ics → open it
   in Apple/Google Calendar: correct title, time, timezone, room in location.
9. Import https://trackstage.app/e/ai-engineer/ai-summit-2026/schedule.ics — all
   published sessions appear.

### D. Embeds — covers EMB-15, EMB-16

10. Embeds → build a widget (branding accent + track filter) → copy the iframe
    snippet into a local .html on another origin → renders live data, unauthenticated,
    reflecting the config (EMB-15's manual half).
11. Edit that session's title organizer-side → reload the placed embed → the edit
    shows without regenerating the embed (EMB-16's propagation half).

### E. Blind-review isolation — covers ABS-07 (optional)

12. Invite a second reviewer you control to a blind round, assign the same submission,
    sign in in a second browser: no author identity anywhere, and no visibility of the
    first reviewer's scores before submitting their own.

### F. Automated reminders — covers SPK-16

13. Assign a real-inbox speaker a task due within 24–48 h, leave it incomplete, wait
    through the daily sweep (09:00/09:30 UTC crons) → reminder arrives naming the task
    and due date, and the send appears in the Outbox.
