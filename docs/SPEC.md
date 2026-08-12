# Sessionboard OSS — Build Specification

Single source of truth for what we build. Derived from: the brief, swyx's video walkthrough
(`docs/video/`), all 42 screenshots (`docs/ux/`), and swyx's Discord clarifications
(`docs/reference/`). When this spec and a deep-dive doc disagree, the deep-dive doc wins on
UI detail; this spec wins on scope.

## 1. What wins

- Judge #1: **non-technical event-production professionals** actually using it.
- Judge #2: **an LLM browser agent (sbek)** driving flows through real links/forms/buttons.
- Tiebreaker: product judgment. swyx's stated pains: Sessionboard is **slow**, its
  **navigation buries things**, and its **defaults trap users** (min-2-speakers).
- Therefore: same structure and domain language as Sessionboard, half the chrome, instant
  interactions (optimistic updates via Convex reactivity), obvious navigation, safe defaults.

## 2. UX laws (non-negotiable)

1. Light mode only. Primary blue `#2F5CE0`; bg `#F8FAFC`; white cards; navy `#1B1E27` text.
2. Every structured input uses a proper component: calendar date pickers, dropdown selects,
   toggles, tag multi-selects. Never a raw text field for a date/choice.
3. Labels above inputs; red asterisk = required; helper text under label, not placeholder.
4. Status pills everywhere, identical wording organizer- and speaker-side:
   green Accepted/Accept Queue · amber Pending/Decline Queue · red Declined · gray Draft/Withdrawn.
5. Right slide-over drawers (~480px) for create/detail; tables never lose state.
6. Left step-rail wizards with checkmarks for multi-step flows; Back/Next footer; last step = Save.
7. Every list: search + status tabs + `+ Add` primary button top-right. `...` row menus.
8. Every form card shows **Copy public link** directly (swyx hunted for this — don't hide it).
9. Defaults never block: speaker min = 1; forms open by default; drafts allowed.
10. Empty states always say what the thing is and offer the primary action.
11. No full-page spinners; skeletons + optimistic mutations. Speed is a feature.

## 3. Information architecture

### Organizer app (`/app`, sidebar ~240px, event-scoped)
```
Dashboard
Program
  Submissions        (unified table: abstracts + sessions, status tabs)
  Forms              (CFP form builder)
  Evaluation         (plans, evaluators, my evaluations)
  Agenda             (List | Day | Rooms | Conflicts views)
Speakers             (people roster — accepted or in review + outstanding tasks)
Communications       (templates, outbox, reminders)
Settings             (event details, rooms & tracks, portal)
```
Header: event name + dates · "View public page" outline button · avatar menu.
(We deliberately flatten Sessionboard's `Program > View All/Abstracts/Sessions` +
`Collect & Review` nesting into the 7 items above — this is the master.md guidance.)

### Public (de-chromed, centered card on `#F8FAFC`)
- `/submit/:workspaceSlug/:eventSlug/:formSlug` — 5-step tracker: Welcome → Account → Submission →
  Participants → Review. Form slugs are unique **per event**, so `cfp` is available to
  every organizer. The legacy `/submit/:eventSlug/:formSlug` shape still resolves.
  A one-segment link first resolves an exact form slug; otherwise it is treated as an
  event slug and opens that event's primary CFP (open abstract → any open → closed
  abstract → oldest remaining). All legacy shapes land on this canonical route
  (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical").
- `/e/:eventSlug` — public schedule + speaker gallery (also serves as "embed" surface; struck
  as a requirement, keep minimal).

### Speaker portal (`/portal/:eventSlug`, top tabs)
- Home · Submissions · Profile · Tasks. Magic-link auth (`/portal/token/:token`).

## 4. Screens & acceptance criteria

### 4.1 Event settings
Two-column stacked-label form: Name*, Slug*, Type (select), Website URL, Timezone (select
with search), Starts/Ends (date-time pickers showing TZ chip), Description (rich text),
Venue. Rooms & Tracks manager: inline add/rename/delete, track color dots, room capacity +
order. Accept: organizer can fully configure an event in <2 minutes with zero docs.

### 4.2 Form builder (the centerpiece — match in great capacity)
Forms list: cards with name, type badge, Open/Closed badge, submission count, close date,
**Copy public link**, View, Edit, `...` (Duplicate/Delete). `+ New form`.

Editor: left step rail (checkmark done / dark active):
1. **Setup** — submission type cards: Abstracts / Sessions.
2. **Welcome screen** — Internal name*, External title*, Page heading*, Welcome message
   (rich text, "Show message" toggle).
3. **Submission questions** — QuestionRow list: drag handle, label, type sublabel, Required
   toggle, Enabled toggle, pencil → edit drawer (label, help text, options for selects,
   max chars), `...` (duplicate/delete). Locked system rows: Title, Description. Default
   rows: Format, Tags, Track, Level, Language. `+ Add question` (types: short text, long
   text/rich, dropdown, multi-select, email, url, phone, checkbox, file).
   **Conditional logic:** per question, optional "Show only when [question] is [value]"
   rule (one rule per question is enough — matches brief's "conditional logic").
   **Routing:** the Track question routes the submission to its track automatically.
4. **Participants** — roles: Speaker (min/max, default 1/4), Chairperson & Moderator
   toggles. Locked: First/Last/Email. Optional: Mobile phone (US/Intl validation),
   Biography, Job title, Company, Headshot upload. "Send confirmation email" toggle.
5. **Form settings** — Close date (calendar picker) + close time, Send reminder email
   toggle, Submission limit per user toggle+number, Allow multiple drafts toggle,
   Success message (rich text), Auto-redirect to portal toggle.
6. **Notifications** — admin emails notified on new/updated submission (multi-select).

Accept: build a working CFP form with a conditional question and track routing in <5 min;
sbek can complete the resulting public form.

### 4.3 Public submission flow
Step tracker exactly: Welcome! → Account → Submission → Participants → Review.
- Welcome: event branding, deadline + per-user cap callout, rich welcome, Continue.
- Account: email only, no passwords. A **new** address for this event continues
  immediately (empty account, nothing to protect). An address with any history —
  submission, draft, co-speaker credit, task, upload, profile — gets a sign-in link
  emailed to it (`/submit/{event}/{form}?t=…`, ≤3/hour) and the step shows "Check your
  email" with resend / use-a-different-address, revealing nothing about the account.
  See DECISIONS.md, "Typing an email is not proof of owning it".
- Submission: the built questions, conditional logic live, validation with red outlines +
  toast "Missing required fields…".
- Participants: "Participant 1 (You)" prefilled from account; `+ Add speaker` up to max.
- Review: summary cards, Back, Save as draft, Submit.
- Success: "Thank you for submitting to present at our event!" + **Continue to portal →**.
Accept: full submit in <3 min; draft persists; resuming works; browser agent completes it.

### 4.4 Submissions table (organizer)
Status tabs: All · Accepted · Accept Queue · Pending · Decline Queue · Declined ·
Withdrawn · Drafts. Toolbar: search, Columns, Sort, Filter, `+ Add submission` (manual,
drawer: Title*, Status, Description, Format/Track/Level/Language/Tags, speakers),
Options (Export CSV). Columns: checkbox, Status (inline editable pill → popover picker
with Save/Cancel), Title, Track, Format, Speakers (chips), Submitted, `...`.
Row click → drawer: Details / Participants / Evaluations tabs.
Bulk: select → move to Accept/Decline Queue.
**Queues commit decisions:** an Accept Queue banner shows "N staged — Send decisions"
which fires the accept emails (+ portal tasks) and flips statuses to Accepted. Same for
Decline. This is the two-phase pipeline the video shows.
Accept: triage 10 submissions to queues and commit in <2 min; speaker portal reflects
status instantly.

### 4.5 Evaluation
Tabs: Summary · Plans · My evaluations · Evaluators.
- Plan: name, round number, criteria (1–5 score fields, default single "Overall"),
  assigned submissions (filter by track/status), evaluators (emails), due date, Open/Closed.
- Evaluator view (`/review/:token` magic link): queue of assigned submissions, score +
  comment, progress bar, next/prev. No login wall.
- Summary: metric cards (Total evaluations, Evaluated submissions, Plans, Evaluators),
  completion donut, average score by plan; per-submission avg score column appears in
  submissions table.
Accept: create plan → evaluator scores via link → averages visible → sort submissions by
score. Multiple rounds = multiple plans.

### 4.6 Agenda builder
Views: **List · Day · Rooms · Conflicts** (Week/Month cut — Day+Rooms cover the job).
- Day view: vertical time axis (15-min snap), columns = rooms, session cards (track color
  edge, title, room, speakers). Drag from **Unscheduled tray** (accepted submissions) onto
  grid; drag to move/resize duration.
- Conflict detection, live: same room overlap; same speaker in two overlapping sessions.
  Red outline + Conflicts view listing each conflict with "jump to".
- `+ Add session` for breaks/keynotes (manual sessions).
- List view: table with time, title, room, track, speakers; inline edit.
Accept: schedule 6 accepted talks across 2 rooms via drag-drop; create an overlap →
conflict appears in <1s; resolve it; public schedule updates.

### 4.7 Speaker portal
Tabs: Home (My submissions cards + statuses, My profile card, Tasks preview) ·
Submissions (list → drawer Details/Participants; editable after acceptance) ·
Profile (Biography rich text, Salutation/Pronouns/Job title/Company/Phone, Links:
LinkedIn/X/Website, **Headshot upload** with preview) ·
Tasks (checklist: each task = form-fill / file-upload / confirm; due dates; complete inline).
Accept: speaker (via magic link) uploads headshot, fills bio, completes a task; organizer
dashboard reflects it in real time.

### 4.8 Speakers + outstanding-tasks dashboard (core requirement)
Speakers page: ONE roster of everyone attached to the program — anyone on a submission
or session at any status (drafts aside), plus anyone added by hand. Avatar, name,
company, why they're here ("1 accepted session" / "1 in review" / "Added manually"),
task progress (2/3), missing-bits pills (no bio / no headshot / no slides). Acceptance
is a facet with a filter (All · Confirmed · In review), never a gate on who exists;
the public gallery stays accepted-and-visible only.
Dashboard: greeting, metric cards (Submissions, Accepted speakers, Outstanding tasks),
status pill bar, insight banner "N accepted speakers are missing a bio or headshot →
View speakers", "Top speakers by outstanding tasks" list, submission pacing chart
(nice-to-have, last), Your forms card with copy-link.
Accept: dashboard answers "who do I need to chase?" in one glance, live.

### 4.9 Communications
- Templates: seeded Accepted / Declined / Waitlisted / Reminder; `{{speakerName}}`,
  `{{sessionTitle}}`, `{{eventName}}`, `{{portalLink}}` placeholders; rich text editor.
- Decision commits use templates; Accepted email includes portal link + tasks; when the
  session is scheduled, **.ics attachment** (room in LOCATION when assigned).
- Outbox: table of scheduled/sent/failed messages; manual "Send reminder to incomplete
  speakers" action + auto-reminder cron (daily, for open tasks near due date).
- Email transport: Resend (env `RESEND_API_KEY`); without a key, messages render in the
  outbox with full preview (demo-safe) and .ics still downloadable. Transactional mail
  addressed outside the event people table (workspace invites, account lifecycle,
  organizer submission alerts, evaluator reminders) uses `platformEmailDeliveries`: a
  durable scoped mini-outbox with escaped HTML, idempotent provider calls, bounded retry,
  stuck-job recovery, final-failure UI and manual retry.
Accept: committing Accept Queue produces sent (or previewable) personalized emails with
working portal links; scheduling produces a valid .ics that imports into Google/Apple/Outlook.

## 5. Data model (Convex)

`events` name, slug, type, websiteUrl, description, venue, timezone, startsAt, endsAt.
`rooms` eventId, name, capacity, order. `tracks` eventId, name, color, order.
`forms` eventId, slug, kind(abstract|session), status(open|closed), closeAt, welcome{...},
  questions[] {id, label, type, required, enabled, locked, help, options[], maxChars,
  showIf{questionId, equals}, isTrackQuestion}, participants{speakerMin, speakerMax,
  rolesEnabled[], fields[]}, settings{limitPerUser, allowDrafts, successMessage,
  autoRedirect, reminderEmail}, notifyEmails[].
`people` eventId, email, name, salutation, pronouns, jobTitle, company, phone, bio,
  headshotId, links{}, portalToken. (speakers + submitters unified)
`submissions` eventId, formId?, kind(abstract|session), title, description, answers{},
  trackId?, format?, level?, language?, tags[], status(draft|pending|accept_queue|
  decline_queue|accepted|declined|withdrawn), submitterId, decidedAt, notifiedAt,
  roomId?, startsAt?, durationMinutes? (scheduling lives on the submission — accepted
  items ARE agenda sessions; manual sessions are kind=session).
`submissionParticipants` submissionId, personId, role(speaker|chairperson|moderator), order.
`evaluationPlans` eventId, name, round, criteria[], evaluatorEmails[], submissionIds[],
  dueAt, status. `evaluations` planId, submissionId, evaluatorEmail, scores{}, comment,
  completedAt. `evaluatorTokens` planId, email, token.
`tasks` eventId, personId, title, kind(profile|headshot|upload|form|confirm), formId?,
  dueAt, completedAt. `uploads` eventId, personId, taskId?, storageId, filename, contentType.
`emailTemplates` eventId, key, name, subject, body.
`messages` eventId, personId, templateKey, subject, body, submissionId?, icsAttached,
  scheduledAt, sentAt, status, error.
`airtableConnections` eventId, token (the organizer's PAT — never returned by any query,
  only `maskToken()`ed), baseId, status(connected|error), demo?, lastSyncAt?, lastError?,
  recordCounts{submissions,speakers,sessions}?, syncScheduled? (on-write debounce latch).
Indexes follow Convex naming (`by_field1_and_field2`), all fields in name.

### 5.1 Airtable mirror (bonus — rule 15)
One-way and idempotent, per swyx's clarification that a read-only mirror is enough
(his team's automations fire "once a new row lands"). Settings → Integrations takes a
personal access token + base ID, verifies them live, and creates three tables in the
organizer's own base — **Submissions**, **Speakers**, **Sessions** — each keyed on a
`Sessionboard ID` primary column. Writes are `PATCH /v0/{baseId}/{table}` with
`performUpsert.fieldsToMergeOn: ["Sessionboard ID"]`, batched 10 at a time and throttled
under Airtable's 5 req/s per base. Freshness comes from two paths: a ~5s debounced sync
scheduled by the submission-creating mutations, and an `airtable-sync` cron every 5
minutes. Nothing is ever read back from Airtable. Env: `AIRTABLE_DEMO_MODE=1` skips live
validation and simulates the sync (labelled in the UI) so the flow is demo-able without
an Airtable account.

## 6. Public API (bonus)

`/api/v1/*` via Convex HTTP actions, mirroring Sessionboard's shape: Bearer token
(env-configured demo token), `GET /v1/event/:slug/sessions` (accepted+scheduled, paginated
`{data, pagination:{currentPage,pageSize,totalPages,totalResults}}`), `GET .../speakers`,
`GET .../submissions` (auth'd), `GET .../schedule.ics` (whole-event calendar). Documented
in README.

## 7. Demo & judge experience

- Seed script: "AI Engineer Sandbox Event" — 2 rooms, 3 tracks, 1 open CFP form, 12
  submissions across all statuses, 2 evaluation plans w/ partial scores, 6 scheduled
  sessions incl. 1 deliberate conflict resolved in demo docs, 4 speakers w/ mixed task
  completion, seeded templates.
- `/` = clean landing: "Organizer demo →" (auto-login demo organizer), "Speaker demo →"
  (magic link), "Submit a talk →" (public form). Judge reaches every flow in one click.
- Demo mode banner shows magic links inline so no email is ever required to evaluate.

## 8. Build order

1. **Foundation**: app shell (sidebar/header), design tokens, schema, seed, demo auth.
2. **Slice 1 — CFP**: form builder (steps 1–3 minimal) → public flow → submissions table.
3. **Slice 2 — Decisions**: queues + commit + templates + portal Home/Submissions.
4. **Slice 3 — Agenda**: rooms/tracks, Day+List views, drag-drop, conflicts, .ics.
5. **Slice 4 — Portal tasks + Speakers + Dashboard** (real-time chase list).
6. **Slice 5 — Evaluation** (plans, evaluator link, scores in table).
7. **Polish**: form builder steps 4–6 complete, API, seed richness, empty states, speed
   pass, sbek dry-run against every acceptance criterion, deploy, README, submission form.

Each slice ends deployed + committed. Cut order if time collapses: evaluation summary
charts → Week/Month views (already cut) → embeds page → pacing chart.
