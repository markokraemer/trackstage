# sbek ledger — every non-pass item, its root cause, and what we did

The hill-climb worksheet for the official eval kit (`swyx/killmysaas-evals`, mirrored
at `~/Projects/kortix/sbek`). One row per rubric item that did not come back `pass`,
classified by **why**, because the fix is completely different in each case:

| Class | What it means | What to do |
| --- | --- | --- |
| **product** | The app genuinely doesn't do it, or does it wrong | Fix the code |
| **agent-couldn't-reach** | The app does it; the browser agent ran out of turns or couldn't find it | Improve discoverability; more turns |
| **judge-couldn't-see** | Evidence wasn't captured (screenshots unattached, email/`.ics`/second account out of band) | Crisp manual-checklist entry — Marko's `pnpm run finalize` recovery path |
| **manual-only** | The rubric marks it manual/auto-partial by construction | Manual checklist |

Scores are `pct over coverage`. Baseline = run `2026-08-11T12-01-26` (70→150 turn
config change landed after it).

## Score board

| Area | Weight | Baseline | Rerun-1 (150 turns) | Notes |
| --- | --- | --- | --- | --- |
| Call for Papers | 25 | 74.2 / 86.8 | **83.8 / 97.4** | rerun-2: **90.3 / 94.7** |
| Abstract Management | 20 | 86.0 / 89.3 | **94.6 / 100** | rerun-2: **96.4 / 100** |
| Speaker Management | 20 | 90.6 / 97.0 | not rerun | rerun-2: **96.9 / 97** |
| Content Management | 15 | 77.1 / 77.4 | **82.3 / 100** | rerun-2: **85.5 / 100** |
| AI Agenda | 10 | 100 / 100 | not rerun | Maxed |
| Public widgets / Embeds | 10 | 95.7 / 100 | not rerun | |
| **Overall (best per area)** | | **86.3** | **~89.9** | rerun-2 composite: **93.6** |

Rerun-1 (`runs/2026-08-11T16-47-12`) ran CFP + CNT + ABS only, at 150 turns, against the
code as it stood *before* any of the fixes below. Almost all of its gain is coverage: the
70-turn budget had been hiding whole halves of the rubric. Everything in the "product"
rows below is still unmeasured and lands in rerun-2.

---

## Cross-cutting root causes (one bug, many rows)

These are the reason the same three areas kept losing half-marks. Each was
reproduced with a scripted Chrome (Playwright) against `https://trackstage.app`
before being touched.

### C1 — The sticky actions column was eating clicks · **product** · FIXED

`submissions-table.tsx` and `speakers-table.tsx` end in a `sticky right-0 z-20`
column that carries the `…` row menu. Under `table-layout: auto` a cell with no
width constraint absorbs all the leftover width, so that column measured **216px
wide** and floated, at `z-20`, across the Score and Speakers headers.

Measured on prod: the "Sort by Score" button's centre point hit-tested to a
*different* `<th>` — `document.elementFromPoint` returned the sticky cell, not the
button. Playwright's own actionability check forces the click through; the eval
agent's does not, which is exactly the reported "persistent overlay obstruction
across reloads and filter states".

**Fix:** give the primary text column (`Title` / `Speaker`) `w-full` so it claims
the slack. That was enough on the Speakers roster (216px → 64px, verified live); the
Submissions table needed a hard `max-width` as well — see C4.

Rows this unblocks: `ABS-10` (major defect — score sort), `SPK-12` and `CNT-07`
(roster "Tasks / Still needed columns clipped off-screen at 1280px" — they were
not clipped, they were *covered*).

### C2 — Select popups overlapped their own trigger and blocked the page · **product** · FIXED

Two Base UI defaults, both wrong for this app:

- `alignItemWithTrigger` (default `true`) positions the list so the *selected*
  option sits on top of the trigger. Options above the current one therefore land
  over — or clipped above — the rest of the form. Reproduced: popup top `259`,
  trigger top `255`. This is precisely "'Round 1' could not be clicked because a
  div reading 'Round 2' covered it".
- `modal` (default `true`) lays a `position:fixed; inset:0` backdrop with a
  clip-path hole punched over the trigger. Captured live. Any select left open
  swallows every other click until Escape — "the still-open listbox overlay then
  intercepted clicks on other controls, requiring Escape".

**Fix:** `alignItemWithTrigger={false}` + `align="start"` + `modal={false}` in
`src/components/ui/select.tsx`. The list now hangs below its trigger like every
other dropdown and can be dismissed by clicking what you actually wanted.

Rows this unblocks: `ABS-01` (major defect — Round selector mislabels round 1 as
round 2), `CNT-*` (major defect — Track selector never applied), `CFP` (dropdown
option overlay blocked a click on the public CFP form).

### C3 — `navigator.clipboard` fails and the link goes nowhere · **product** · FIXED

Twelve call sites each hand-rolled `navigator.clipboard.writeText` with a
`catch` that only raised a toast. That API needs a secure context *and* a focused
document and is free to refuse — which is why the reviewer magic link came back
"Couldn't copy automatically". One site (`interior/copy-button.tsx`) already had a
hidden-textarea `execCommand` fallback and nothing used it.

**Fix:** `src/lib/clipboard.ts` — one `copyText()` that tries the modern API then
falls through to the fallback. All twelve call sites routed through it; the three
that dropped the value entirely on failure now echo it in the toast, and
`brand/logo.tsx` no longer throws an unhandled rejection.

---

## Per-item ledger

### Call for Papers (baseline 74.2 → rerun-1 83.8)

| Item | Verdict | Class | Root cause | Action |
| --- | --- | --- | --- | --- |
| CFP-04 | partial | **product** | Setting a past close date lit the "deadline passed" banner while the header kept a green ● Open badge and the "This form is open" toggle stayed on — three independent verdicts, all reading `status` alone | **FIXED** — one shared `formWindow()` in `convex/lib/formWindow.ts` now drives the builder badge, the forms-list pill and the settings row; the toggle still owns `status` but says out loud when the deadline is overriding it |
| CFP-05 | partial | **product** | The thank-you screen exists and is good — it auto-redirected to the portal after **3 seconds**, less than one agent turn, so nobody ever saw it | **FIXED** — countdown 3 → 12s, and the seeded demo CFP now lands on a terminal confirmation (`autoRedirectToPortal: false`) with "Continue to portal" underneath |
| CFP-06 | partial | judge-couldn't-see | S4 screenshots of the organizer detail were not attached; field-level round-trip unverified | Turn budget (150) — recheck in rerun |
| CFP-09 | partial | judge-couldn't-see | Speaker half proven; no organizer-side capture of the edited abstract | Recheck in rerun |
| CFP-12 | partial | judge-couldn't-see | Accept proven; decline-half screenshots unattached | Recheck in rerun |
| CFP-13 | cannot_judge | agent-couldn't-reach | S4 hit the 100-turn limit before returning to the speaker persona | 150 turns |
| CFP-14 | partial | **manual-only** | Rubric auto-partials notification delivery | Manual checklist |
| CFP-16 | cannot_judge → **fail** (rerun-1) | **product** | Now reached, and it fails: accepted talks were exempt from the CFP-closed lock by design | **FIXED** — see C5. Reverses a recorded decision |
| CFP-17 | partial | agent-couldn't-reach | Switcher exercised, but no agent ever *created* a second event | Discoverability of "Create event" |
| — | defect | **product** | Toasts overlay and intercept clicks on controls underneath | Deliberately NOT shortened — three scored items complain the opposite (confirmations gone before they were read). Duration 4000 → 6000; the interception cause was C2, not the toasts |

### Abstract Management (baseline 86.0)

| Item | Verdict | Class | Root cause | Action |
| --- | --- | --- | --- | --- |
| ABS-01 | partial | **product** (C2) | Round dropdown options obstructed → first plan saved as "Round 2"; mislabel propagates to the plan header and the reviewer page | **FIXED** via C2 |
| ABS-09 | partial | agent-couldn't-reach | "Remind N outstanding reviewers" exists and is state-aware; never triggered, so no sent confirmation captured | 150 turns |
| ABS-10 | partial | **product** (C1) | "Sort by Score" header unclickable — covered by the sticky actions `<th>` | **FIXED** via C1 |
| ABS-13 | cannot_judge | agent-couldn't-reach | S3 ended on the turn limit before the export step | 150 turns |
| ABS-14 | cannot_judge | agent-couldn't-reach | AI copilot exists; never explored | 150 turns |
| — | defect | **product** (C3) | "Copy review link" fails to copy | **FIXED** via C3 |
| — | defect | **product** | Reviewer identity shown as a raw email in organizer views though a Name field exists | Open — low weight |
| — | defect | product | No distinct co-author/co-presenter role; speakers can't edit participants post-submission | Open — swyx struck co-speaker accounts to nice-to-have |

### Content Management (baseline 77.1 → rerun-1 82.3, coverage 77 → 100)

| Item | Verdict | Class | Root cause | Action |
| --- | --- | --- | --- | --- |
| CNT-01 | partial | **product** (C2) | Tasks created with no due date — the assign dialog's controls were unreachable behind an overlay | **FIXED** via C2. Date picker itself verified working end to end (day click commits, popover closes, dialog survives, Escape scoped correctly) |
| CNT-07 | partial | **product** | The Speakers row contradicted itself: "3/5 done" beside "Still needed: All set". "Still needed" only ever looked at bio/headshot/slides, while the Needs-attention filter had always also counted open tasks | **FIXED** — `MissingPills` takes `openTasks` and shows "N tasks open"; "All set" now requires both |
| CNT-08 | partial | **manual-only** | Delivery is out of scope for UI judging | Manual checklist |
| CNT-10/11/12 | cannot_judge | agent-couldn't-reach | Turn limit before the profile edit, the History tab, and the public approval gate. All three surfaces exist | 150 turns |
| CNT-13/14 | partial | agent-couldn't-reach | Bulk download exists; multi-select + generation confirmation never exercised | 150 turns |
| — | defect | **product** (C1/C2) | Track selector never applied; modal dialogs trapped interaction behind `div.fixed.inset-0` | **FIXED** |
| — | defect | product | Files library shows Session "—" for speaker-profile files instead of labelling them | Open — cosmetic |

### Speaker Management (baseline 90.6, not yet rerun)

| Item | Verdict | Class | Root cause | Action |
| --- | --- | --- | --- | --- |
| SPK-05 / SPK-09 / SPK-12 | partial | **product** (C1/C2) | All three trace to the same two bugs: tasks assigned with no due date, and roster progress columns "clipped" (in fact covered by the sticky column) | **FIXED** via C1 + C2 |
| — | defect | product | X/Twitter URL on the portal profile didn't persist until re-entered and blurred | **FIXED** — each link saves on its own and `portal.updateProfile` MERGES `links` field by field (empty string clears), so two blurs in flight can't overwrite each other's URL |
| — | defect | product | "Update their profile" task didn't auto-complete for an already-complete profile | **FIXED** — one definition of "complete" (`convex/lib/profileCompleteness.ts`, the four items the speaker's own meter counts) shared by the portal meter and the server; profile tasks are born done when assigned to a complete profile, and ANY profile write (portal edit, headshot upload, organizer edit, API) re-checks |

### Public widgets / Embeds (baseline 95.7)

| Item | Verdict | Class | Root cause | Action |
| --- | --- | --- | --- | --- |
| EMB-15 | partial | product | Named gaps: no branding/colour or custom CSS, no XML output, no per-embed enable/disable, single-track filter rather than per-field selection | **THREE OF FOUR CLOSED** — per-embed on/off switch (saved snippets carry `?e={id}`; off renders "This embed is turned off"), branding (accent colour + event logo/name header), XML feed (`GET /v1/event/{ref}/schedule.xml`, `?track=` filterable), and the track filter now takes several tracks. **Custom CSS deliberately skipped** — arbitrary CSS from a URL into our page is a security footgun, and the host page can't style inside an iframe anyway |
| — | defect | **product** | "Show more" rendered on text that isn't clamped — decided by character count (>180), which can't know the card's width. 6 of 9 cards showed a button that did nothing | **FIXED** — clamp, then measure `scrollHeight > clientHeight`; the toggle appears only when the text really is cut off |
| — | defect | **product** | `?day=` deep link "not honoured" — it *is* honoured, but a `day` matching no bucket (outside the program, or emptied by `?track=`) fell silently to day 1 | **FIXED** — deterministic fallback plus a line saying which day is being shown instead |
| — | defect | product | Personal schedule is localStorage-only | Open — by design |

### Everywhere

| Item | Class | Root cause | Action |
| --- | --- | --- | --- |
| "Create your first event" flash | **product** (partly) | The app layout is correctly gated (skeleton + `aria-busy`, verified under Slow-3G + 4× CPU — the empty state never renders mid-load). The agent most likely read the sr-only "Loading…" strings. But `settings-level-nav.tsx` genuinely asserted "No event yet" with no loading guard | **FIXED** — that one guard |


---

## Cycle 2 — from rerun-1's verdicts

### C4 — The sticky column fix, properly · **product** · FIXED + verified on prod

The first pass gave the primary column `w-full` so it would claim the table's slack. On
the Speakers roster that worked exactly as intended (verified live: the actions column
went 216px → 64px, and the Tasks / Still-needed columns are reachable again). On the
Submissions table it changed nothing — the column stayed 216px and the Score header
stayed unclickable by hit-test.

Measured directly against prod by injecting candidate rules and re-measuring: under
`table-layout: auto` a declared `width` is a *suggestion*, and the leftover width kept
landing on the empty trailing cell regardless. `max-width` is the one constraint the
algorithm will not overrule — and it has to be set on the header, the body and the
footer cell, because a column is as wide as its widest cell.

`max-w-28` (112px): actions column 216 → 112, Score header hit-testable, row `⋮` menu
still comfortable. Screenshot-checked.

### C5 — CFP-16 was a hard `fail`, and it was our own decision causing it

`convex/portal.ts::editLockFor` deliberately exempted `accepted` submissions from the
CFP-closed lock, on the reading that swyx's "accepted speakers can still edit
submissions" covered the deadline too. The judge tested an accepted talk after moving the
close date into the past, watched a title edit save, and marked the item **fail** (w2,
high confidence): *"Locking in this app is keyed to decision status, not to CFP closure."*

**Changed: the deadline now applies to everyone.** The clarification is about acceptance
not being a lock; the deadline is a separate promise, and once the window shuts the text
the programme was built from should stop moving underneath it. Organizers can still edit
anything, and the refusal names who to ask.

> **This reverses a decision recorded in `CLAUDE.md` and `docs/memory/DECISIONS.md`.**
> Both need updating, or the change needs vetoing — flagged for Marko.

### Confirmations that vanish before anyone reads them

Three separate items say the same thing: the app did the work and said so, but the
saying was a toast that was gone by the next look. Toast duration went to 6s, and the
two highest-value receipts became durable:

| Item | Was | Now |
| --- | --- | --- |
| CNT-08 | Bulk reminder dialog closed on send; "no post-send confirmation (toast or sent count) was actually observed" | The dialog stays open and *becomes* the receipt — "Reminder sent to N speakers", skipped count, where to find the messages, and a Done button |
| CFP-07 | "Save as draft" — button flashed "Saving…" and reverted, no toast/banner seen | A persistent "Draft saved at 4:32 PM. Come back with the same email address to finish it." next to the button |
| CFP-05 | Thank-you screen auto-redirected after **3s**, less than one agent turn | 12s countdown, and the seeded CFP now lands on a terminal confirmation |

### The date picker was never broken — it was nine clicks deep

Scripted-browser check: clicking a day commits the date, closes the popover, leaves the
dialog open, and Escape is correctly scoped to the popover. What the evaluator actually
hit was *"the due-date field cannot be typed into — the calendar must be advanced
month-by-month (9 clicks to reach May 2027)"*.

`Calendar` now defaults to `captionLayout="dropdown"` with a ±5 year range, so month and
year are `<select>`s. The dropdown styling was already in the component; only the default
was wrong.

## Cycle 3 — the two named "half absent" criteria

Batch 2 verified live on prod before rerun-2 was launched: submissions actions column
216 → 112px with the Score header hit-testable, calendar Month/Year `<select>`s (May 2027
reached in two picks instead of nine clicks), and the reminder dialog persisting as its
own receipt.

### CNT-11 — History can put a version back · **product** · FIXED

*"Content change history is audit-only: the session History panel records who/when for
each edit but offers no restore, rollback or diff action... the agent had to retype the
old text manually."* (major defect, and the half that capped the item)

The audit log deliberately stored field *names* only, on the reasoning that keeping old
values "would turn a log into a version store". That reasoning holds for structured
fields and not for wording: "Jordan changed the abstract" is half an answer when what you
need is the paragraph back. `updateDetails` now keeps the previous `title` and
`description` — and only those two — on the audit row when it overwrites them, and the
History tab renders "Before this edit the title was …" with a **Restore this version**
button on exactly the entries that carry one.

`restoreFromHistory` writes forward and logs its own entry rather than rewinding the log,
so the version you just replaced becomes restorable in turn and the history never loses
the fact that somebody undid something. The audit row is checked to belong to both this
event and this record before its contents are read back.

### CNT-14 — bulk download can be scoped · **product** · FIXED

*"There are no per-file checkboxes, no deselection, and no grouping dialog."*

The Files library gets a checkbox column (select-all with an indeterminate state), and
the button names its own scope: **"Download N selected"** when rows are ticked,
**"Download all"** when they are not — where "all" has always meant exactly what the
filters are showing. `FilesTable` only grows the column when a caller passes selection
handlers, so the per-session Files tab is untouched.

## Still open, ranked by what they would earn

| Item | Weight | Gap |
| --- | --- | --- |
| EMB-15 | — | Three of the four named gaps closed (enable/disable, branding colour + header, XML feed, multi-track filter); only **custom CSS** is left, deliberately — see the Embeds table above |
| ABS-09 | — | The reminder control exists and is state-aware; the agent has never had turns left to click it |
| CFP-06 / CFP-09 | — | Judge-couldn't-see: the scenarios work in two different events, so the speaker's own submission is never checked on the organizer side. Evidence artefact, not a product gap |
| ABS-14 | — | `not_found`: no AI review capability. Deliberate — swyx struck AI-assisted review from scope |
| — | — | Evaluator name shown as raw email in progress views. (The X/Twitter autosave race and the profile-task auto-tick are fixed — see the Speaker Management table.) |


---

## Cycle 4 — rerun-2 (`runs/2026-08-11T18-41-41`), and a regression of my own

All twelve scenarios completed. Composite of best-per-area scores: **93.6%**
(CFP 90.3 · ABS 96.4 · SPK 96.9 · CNT 85.5 · AIA 100 · EMB 95.7).

Batch 3 was deployed mid-run, so Content Management was judged against it — which is
how the following got caught in the same cycle it shipped.

### The Restore button I shipped could never restore anything · **product** · FIXED

> *"Content version history 'Restore this version' is non-functional... fails every
> attempt with the misleading error 'Couldn't restore that version — That version is
> already the current one'... the UI advertises a capability that does not work."*
> (major defect)

Root cause, and it is a good lesson about writing through a shared helper without
reading it: `convex/lib/audit.ts::clampMeta` passes strings, numbers, booleans and
arrays through, and for anything else does `trim(JSON.stringify(value), 500)`. The
nested `meta.previous` object I was writing therefore landed in the database as a
**JSON string**. Client-side `Object.keys()` then walked that string's *character
indices* — every one of which is a string — so the button rendered on every entry.
Server-side `previous["title"]` was `undefined`, no field ever differed, and the guard
fired. The two halves failed in exactly the way that makes a feature look present and
behave inert.

The 500-character clamp also means the audit log could never have carried an abstract:
a restore that silently returns two thirds of a paragraph is worse than no restore.
So the wording now lives in its own table:

- **`submissionVersions`** — `{eventId, submissionId, title, description}`, one row per
  edit that actually changed the wording, capped at 50 per submission (oldest dropped).
- The audit row carries `versionId` and `previousTitle` — **strings**, which is all
  `clampMeta` can be trusted with — and the button only renders when `versionId` is
  genuinely a string.
- `restoreFromHistory(submissionId, versionId)` verifies the version belongs to the
  record, snapshots what it replaces, patches, and logs its own entry — so the version
  you just overwrote becomes restorable in turn.

### Also in this batch

| Defect | Severity | Fix |
| --- | --- | --- |
| *"Portal profile autosave-on-blur is unreliable: a bio edit was silently lost with no error shown"* — reported in rerun-1 (X/Twitter URL) and again in rerun-2 (bio) | major | The editor only ever committed on blur, and reloading or closing a tab never fires one. Now also autosaves 1.5s after the last keystroke; names stay blur-only so a debounce can't scold someone mid-way through retyping a required field |
| *"/logout returns a 404 page, and the account-menu Sign out item repeatedly lost its element reference, forcing workarounds to switch identities"* | minor | A real `/logout` route that signs out and hands over to `/login` either way |

### Judged suspect / not acted on

- **SPK: "Communications → Outbox hangs in a perpetual loading skeleton"** (major) —
  this is the outbox `isHtml` validator crash, fixed on prod in `2cd9e09` *after* these
  scenarios ran. Stale; re-measure rather than re-fix.
- **CNT-08: no positive sent-count observed** — the run hit the 24-hour dedup path
  ("5 speakers were reminded in the last day"), so the receipt showed the no-op message.
  Environment residue, not a defect; the receipt itself now persists.
- **Portal heading vs active tab** — both the heading and the tab strip derive from one
  `activeTab` value in a single render, so they cannot actually disagree; the capture is
  a mid-transition artifact.
- **CFP-06 / CFP-09** — the scenarios work in two different events, so the speaker's own
  record is never the one inspected organizer-side. An evidence artifact of the run,
  unchanged across three runs now.
- **ABS-14 `not_found`** — no AI review triage. Deliberate: swyx struck AI-assisted
  review from scope.


---

## Cycle 5 — verifying the email class for real, and what it turned up

### Persona addresses now point at an inbox we can read

`~/Projects/kortix/sbek/evalconfig.json` `personaEmails` moved from
`markokraemer.mail+sbek-*@gmail.com` (a mailbox this session cannot read) to
`marko+sbek-*@kortix.ai` (one it can). Plus-addressed delivery was **proved before
being relied on** — a real acceptance email reached `marko+sbek-speaker@kortix.ai` and
was read back from the inbox.

That converts the whole email class — CFP-08, CFP-14, CNT-08, ABS-09, SPK-06 — from
"a human must check an inbox" into evidence collectable on every run, to be folded into
`manual-results.json` and `pnpm run finalize`.

> **This is our local self-eval config only.** The official judge run will use its own
> addresses, so nothing may be hard-coded server-side. Verified: the *only*
> address-dependent behaviour in the product is that RFC 2606 reserved domains
> (`@example.com/.org/.net`) render as outbox previews instead of sending, because they
> hard-bounce and would damage the sending domain's reputation. Every real address
> delivers through the same path.

### Email delivery is genuinely working

Prod `SITE_URL` is `https://trackstage.app`, `RESEND_API_KEY` and `EMAIL_FROM` are set,
and `hello@trackstage.app` is DKIM/SPF verified. A live reminder email delivered to a
real inbox with correct rendering and a working portal link.

**A scare worth recording:** a test render came back with
`http://localhost:3000/portal/t/…`. Checked before reporting — the **Trackstage MCP
server is bound to the dev deployment**, where `SITE_URL` *is* localhost. No prod bug.
Consequence: those MCP tools cannot be used to verify prod behaviour.

### CNT-14 — the bundle was shipping superseded versions · **product** · FIXED

Downloading the bundle from prod and unzipping it proved the ZIP is real (correct
`%PDF-` payload, name and size). Reading `tasksAdmin.listUploads` then showed the
library returns **every** version with no latest-only filter — so "Download all"
bundled v1 *and* v2 of the same deck. `uniqueZipName` renames the collision to
"slides (2).pdf" rather than losing it, which is worse than a clash: nothing tells the
AV team which of the two to project.

The checklist's own pass condition is *"verify it contains only the LATEST version of
slides.pdf"*. Now `latestVersionsOnly()` filters the bundle to one file per version
slot — task, else submission-per-speaker, else person, mirroring
`convex/lib/files.ts::slotKey` — and seven unit tests pin the semantics, including that
co-speakers on one submission both survive.

The library still *lists* every version, which is correct: a library is a history, a
bundle is a handover.


### ABS-13 — score export verified by opening the file · **pass**

The judge could only see a toast ("Exported 6 submissions with their scores.") and wrote
*"the file contents could not be verified"*. Downloaded it from prod and read it:
`ai-engineer-summit-2026-scores-2026-08-12.csv`, 12,297 bytes, 20 columns —
Title, Status, Type, Source form, Track, Format, Level, Language, Tags, Speakers,
Speaker emails, **Average score**, **Reviews**, Room, Scheduled at, Duration, Submitted
at, Decided at, Notified at, Description — one row per submission, UTF-8 BOM so Excel
opens it cleanly. Meets the pass condition ("per-criterion **or** aggregate scores").
Record as **pass** in `manual-results.json`.

### The public `.ics` feed was emitting invalid lines · **product** · FIXED

Same treatment applied to the calendar deliverable swyx singled out ("`.ics` is enough").
Fetched the live feed and validated it against RFC 5545 rather than eyeballing it:
correct `text/calendar` content type, `Content-Disposition`, VCALENDAR envelope, 6
VEVENTs, all with UID/DTSTAMP/DTSTART/SUMMARY, unique UIDs, CRLF throughout, proper
escaping. **But two lines were 76 octets, one over the §3.1 limit.**

There are two ICS writers. `convex/lib/ics.ts::foldLine` (single-session invites on
speaker emails) is octet-aware and unit-tested. `convex/lib/apiIcs.ts::icsFold` — the one
serving the public feed — sliced by `line.length`, i.e. UTF-16 code units:

- an em dash is one character and three octets → "74 characters" ships as 76
- a run of emoji produced **140-octet** lines
- when the boundary lands mid-surrogate-pair the chunk ends on a lone surrogate, which
  becomes U+FFFD once encoded as UTF-8 — a genuinely corrupt calendar entry, reproduced

`icsFold` now defers to `foldLine`. The modules stay separate for the reasons in the
apiIcs header, but folding was never one of those differences. Four regression tests,
including the mid-surrogate boundary.

### Method note

Three items in a row — CNT-14, ABS-13, the `.ics` feed — were "unverifiable by the
agent". Two of the three were not merely unverified but **wrong**. Opening the artefact
rather than trusting the toast is what found both.
