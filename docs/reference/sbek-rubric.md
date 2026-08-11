# SBEK Rubric Digest — SessionBoard OSS Hill-Climbing Target

Source: swyx's official eval kit at `/Users/markokraemer/Projects/kortix/sbek` (README.md,
`specs/01..07-*.yaml`, `docs/00..07-*.md`, `fixtures/sample-data.json`,
`evalconfig.example.json`), cross-referenced against our build plan at
`/Users/markokraemer/Projects/kortix/sessionboard/docs/SPEC.md`.

**Scoring model recap** (see sbek `README.md` "Scoring model" + "Calibration notes"):
- 98 rubric items total. **86 required items / 182 weighted points** across 6 required areas
  (their area-weights sum to 100). **12 extra-credit items / 19 points** in the optional
  `speaker-crm` area (area-weight 10, not part of the required 100).
- Each item has a `weight` (1/2/3) that only ranks it against *other items in its own area*;
  an item's contribution to the overall score is `(item_weight / area_total_item_weight) ×
  area_weight`. Area totals: CFP 38, ABS 28, SPK 33, CNT 31, AIA 18, EMB 34, CRM 19 (optional).
- Each item also has a `type`. Per the README's calibration notes: `exists`/`crud` pass almost
  anywhere and don't discriminate; `roundtrip`/`handoff` are where one-sided flows get caught;
  `rule`/`scoping` are the **strongest signal** in the whole rubric (deadlines, conflicts,
  approval gates, authz isolation) — and the first things a turn-limit cutoff eats, so weak
  coverage there reads as `cannot_judge`, not `not_found`, unless we make it fast to reach.
- Below 60% coverage the headline score is withheld ("insufficient coverage").

**Status legend used below**: **Covered** = SPEC.md screen/flow satisfies the pass_criteria as
written. **Partial** = SPEC.md addresses the capability but is missing a detail the rubric
explicitly checks (a script/date-lock, a field type, a distinct UI surface). **Gap** = SPEC.md
has no described screen, flow, or data-model support for this at all. **N/A** = the item is
conditionally graded only if we claim the feature (AI evaluators) — absence costs nothing.

**Headline count (required 86 items only):** 31 Covered · 18 Partial · 36 Gap · 1 N/A.
**Public Widgets (EMB, 20% of score): 0 of 16 items fully Covered** — 5 Partial, 11 Gap.
**Content Management (CNT, 15%): 3 of 14 Covered** — 2 Partial, 9 Gap.
Every optional Speaker-CRM item (12) is a Gap — SPEC.md has no org-level/cross-event concept.

---

## 1. Complete rubric checklist (98 items)

### 1.1 Call for Papers — `specs/01-call-for-papers.yaml` (prefix CFP, area weight 20, 18 items / 38 pts)

| ID | W | Type | Requirement (one-liner) | SPEC mapping | Status |
|---|---|---|---|---|---|
| CFP-01 | 3 | crud | Build a custom form (≥3 field types, required flags) that renders + validates publicly | §4.2 Form builder (question types, Required toggle) + §4.3 Submission step (red-outline validation, "Missing required fields" toast) | Covered |
| CFP-02 | 1 | depth | Conditional field show/hide keyed to another answer (track/format) | §4.2 "Conditional logic: per question, optional 'Show only when [question] is [value]' rule" | Covered |
| CFP-03 | 3 | exists | Public CFP portal reachable with no login, shows branding/deadline/tracks/formats | §4.3 Welcome step (event branding, deadline callout) + §4.2 "Copy public link" | Partial — track/format dropdowns only render on the **Submission** step, which sits *after* the Account (magic-code) step in our 5-step tracker (§4.3), so they aren't visible in a truly logged-out view. sbek explicitly tolerates deferring this check to the speaker scenario, but it's a tight coupling worth being deliberate about. |
| CFP-04 | 2 | rule | Past close date blocks new public submissions | §5 data model has `forms.status`/`closeAt`; §4.2 "Close date" setting exists | **Gap** — no described UI state for the public form once closed |
| CFP-05 | 3 | crud | Speaker signs up, submits, sees confirmation, sees status in own dashboard | §4.3 (signup→submit→success) + §4.7 Submissions tab | Covered |
| CFP-06 | 3 | roundtrip | Submitted fields round-trip intact to the organizer's view | §4.4 Submissions table + row-click drawer (Details/Participants/Evaluations) | Covered |
| CFP-07 | 1 | depth | Save-as-draft with as little as a title, resumable | §4.3 Review step "Save as draft"; "draft persists; resuming works" (accept criteria) | Covered |
| CFP-08 | 1 | side-effect | Submission triggers a confirmation email referencing the submission | — | **Gap** — §4.9 only seeds Accepted/Declined/Waitlisted/Reminder templates; no submission-received confirmation email is specified anywhere |
| CFP-09 | 2 | roundtrip | Speaker can edit an existing submission pre-deadline; edit is what organizer sees | §4.7 "Submissions (list → drawer Details/Participants; **editable after acceptance**)" | Partial — phrasing implies editability is tied to acceptance state, not explicitly to "any time before the CFP close date" as CFP-09 requires |
| CFP-10 | 2 | scoping | Reviewer provisioned with usable credentials, lands on reviewer-only UI (no admin nav) | §4.5 "Evaluator view (`/review/:token` magic link)... No login wall" | Covered |
| CFP-11 | 2 | roundtrip | Reviewer records rating+comment; organizer sees it; dashboard reflects completion | §4.5 "score + comment, progress bar, next/prev" | Covered |
| CFP-12 | 3 | crud | Organizer records Accept/Reject; list reflects distinct statuses | §4.4 status pills, Accept Queue/Decline Queue | Covered |
| CFP-13 | 2 | roundtrip | Decision status propagates to the speaker's own dashboard | UX law §2.4 "identical wording organizer- and speaker-side" | Covered |
| CFP-14 | 2 | side-effect | Accept/reject notification emails sent (or queued) with UI confirmation | §4.9 "Decision commits use templates; Accepted email includes portal link + tasks" + Outbox | Covered |
| CFP-15 | 2 | handoff | Accepted submission becomes a session with title/speaker/track intact, no re-entry | §5 data model: "accepted items ARE agenda sessions" | Covered |
| CFP-16 | 2 | rule | Speaker can no longer edit a submission once CFP is closed | — | **Gap** — no post-close edit-lock behavior described |
| CFP-17 | 2 | exists | App supports ≥2 coexisting events via a list/switcher | — | **Gap** — §3 IA states the organizer app is "event-scoped" with no events list/switcher anywhere |
| CFP-18 | 2 | scoping | One event's submissions/sessions/speakers don't leak into another event | — | **Gap** — consequence of CFP-17; no multi-event architecture to scope |

### 1.2 Abstract Management — `specs/02-abstract-management.yaml` (prefix ABS, area weight 20, 14 items / 28 pts)

| ID | W | Type | Requirement | SPEC mapping | Status |
|---|---|---|---|---|---|
| ABS-01 | 3 | crud | ≥2 independent review rounds, each with own name/dates/scorecard, persists | §4.5 "Multiple rounds = multiple plans" | Covered |
| ABS-02 | 2 | scoping | Each round can have its own reviewer pool (not global) | §4.5 Plan has its own `evaluatorEmails[]` | Covered |
| ABS-03 | 3 | crud | Scorecard editor supports numeric + dropdown + free-text criteria types | §4.5 "criteria (1–5 score fields, default single 'Overall')" + "score + comment" | Partial — numeric score and a text comment exist; no dropdown/Recommendation-style criterion type is named |
| ABS-04 | 1 | depth | Criteria can carry weights; aggregate reflects weighting | — | **Gap** — no weight field on criteria anywhere in §4.5 or §5 |
| ABS-05 | 3 | scoping | A reviewer's queue contains **exactly** their assigned submissions, nothing else | §4.5 Plan "assigned submissions (filter by track/status)" | **Gap** — plan-level `submissionIds[]` + `evaluatorEmails[]` are both plan-wide; there's no described per-evaluator sub-assignment inside a plan, so two evaluators on the same plan would see the same full pool |
| ABS-06 | 2 | bulk | At-scale assignment: per-reviewer caps, auto-distribute, or track-filtered bulk assign | §4.5 "assigned submissions (filter by track/status)" | Partial — track filter exists; no cap or auto-distribute control described |
| ABS-07 | 2 | scoping | Anonymized/blind round hides author identity from reviewers, visible to organizer | — | **Gap** — no anonymization/blind-review setting anywhere in §4.5 |
| ABS-08 | 2 | roundtrip | Progress dashboard shows accurate per-reviewer completion counts, before/after | §4.5 Summary "completion donut" + "Evaluators" metric card | Partial — aggregate-only; no per-reviewer breakdown described |
| ABS-09 | 1 | bulk | Organizer can bulk-remind reviewers with outstanding reviews | §4.9 only has "Send reminder to incomplete **speakers**" | **Gap** — no reviewer-facing reminder |
| ABS-10 | 3 | roundtrip | Aggregate score per submission, sortable | §4.5 "average score by plan" + "per-submission avg score column... sort submissions by score" | Covered |
| ABS-11 | 2 | crud | Co-authors persist with role labels, visible organizer-side | §5 `submissionParticipants` role(speaker\|chairperson\|moderator) + §4.3 "+ Add speaker" | Covered (role vocabulary differs from "co-author" but any role label passes per pass_criteria) |
| ABS-12 | 1 | depth | Reviewer can declare conflict-of-interest / recuse | — | **Gap** — no COI control described |
| ABS-13 | 2 | side-effect | Review scores/statuses exportable to CSV/XLSX | §4.4 Options "Export CSV" (submissions table only) | Partial — general submissions export exists; not scoped to review results/recommendation |
| ABS-14 | 1 | depth | If AI triage is claimed, AI score+reasoning exists with human override | — | N/A — SPEC doesn't claim AI evaluation; graded as not-applicable, no penalty |

### 1.3 Speaker Management — `specs/03-speaker-management.yaml` (prefix SPK, area weight 15, 16 items / 33 pts)

| ID | W | Type | Requirement | SPEC mapping | Status |
|---|---|---|---|---|---|
| SPK-01 | 3 | exists | Roster lists speakers with identity info, search/filter | §4.8 Speakers page (roster) + UX law §2.7 "search + status tabs" | Covered |
| SPK-02 | 3 | crud | Organizer can manually add a speaker (name/email/bio at least); edits persist | §4.8 describes a roster of **accepted** speakers derived from sessions | Partial — no explicit "Add speaker" manual-create form independent of session acceptance |
| SPK-03 | 2 | bulk | Speakers bulk-importable from CSV | — | **Gap** — no CSV import anywhere for speakers |
| SPK-04 | 2 | crud | Speaker workflow status (Invited/Confirmed/...) changes, persists, filterable | — | **Gap** — §5 `people` has no status field; only `submissions.status` exists |
| SPK-05 | 2 | crud | Organizer creates general/action tasks (title, due date) assignable to multiple speakers | §4.7 Tasks tab is speaker-facing only | **Gap** — no organizer-side task-creation screen described anywhere |
| SPK-06 | 2 | side-effect | Organizer can send a portal invite/onboarding email | §4.9 accept email "includes portal link" | Partial — invite happens implicitly via the decision email; no standalone "resend/invite" control described |
| SPK-07 | 3 | scoping | Each speaker's portal shows only their own content | §4.7 magic-link portal at `/portal/:eventSlug` | Covered |
| SPK-08 | 3 | roundtrip | Bio/social/headshot edited in portal reflect on organizer's record | §4.7 Profile tab + §4.8 "missing-bits pills (no bio / no headshot)" | Covered |
| SPK-09 | 2 | crud | Assigned general tasks show in portal with due dates, mark-complete persists | §4.7 Tasks "checklist... due dates; complete inline" | Covered |
| SPK-10 | 2 | roundtrip | Organizer can see/download a speaker-uploaded deliverable with metadata | §5 `uploads` table exists but no described organizer-side file listing UI with uploader/timestamp | Partial |
| SPK-11 | 2 | roundtrip | Session assignment visible on both organizer record and speaker portal | §4.8 roster "sessions" column + §4.7 Home "My submissions" | Covered |
| SPK-12 | 2 | roundtrip | List-level progress view of per-speaker general-task completion | §4.8 roster "task progress (2/3)" | Covered |
| SPK-13 | 3 | bulk | Organizer sends a general bulk email (e.g. welcome) to filtered speakers, logged | §4.9 Communications section has decision templates + reminder-to-incomplete + Outbox | **Gap** — no generic "compose to selected/filtered speakers" flow described |
| SPK-14 | 1 | depth | Templates use merge fields that resolve per-recipient in a preview | §4.9 "{{speakerName}}, {{sessionTitle}}, {{eventName}}, {{portalLink}}" | Partial — tokens exist; no described per-recipient preview screen |
| SPK-15 | 1 | depth | Speaker record stores travel/custom logistics fields, persists | — | **Gap** — no custom/travel field anywhere |
| SPK-16 | 1 | side-effect | Automated reminder emails for speakers w/ incomplete tasks | §4.9 "auto-reminder cron (daily, for open tasks near due date)" | Covered |

### 1.4 Content Management — `specs/04-content-management.yaml` (prefix CNT, area weight 15, 14 items / 31 pts)

| ID | W | Type | Requirement | SPEC mapping | Status |
|---|---|---|---|---|---|
| CNT-01 | 3 | crud | Organizer creates a file-request task w/ instructions + due date, assigned to speakers | — | **Gap** — no organizer-side task-builder screen anywhere in §4 (Tasks only appear speaker-side in §4.7) |
| CNT-02 | 3 | crud | Speaker portal lists tasks w/ deadlines, accepts file upload recorded against task/session | §4.7 Tasks "file-upload" task type | Covered |
| CNT-03 | 3 | scoping | Speaker scoped to own sessions/tasks; admin routes blocked for speaker accounts | §3 IA (`/portal` has no admin nav; separate route tree from `/app`) | Covered (structural, via route/IA separation) |
| CNT-04 | 2 | rule | Re-upload creates a new version; latest marked, priors still accessible | §5 `uploads` table has no version field | **Gap** — no versioning concept anywhere |
| CNT-05 | 2 | roundtrip | Comments on an uploaded file, author+timestamp, visible cross-role | `convex/lib/uploadComments.ts` · `tasksAdmin.listUploadComments/addUploadComment` · `portal.uploadComments/addUploadComment` · `src/components/shared/file-comments.tsx` | **Covered** (2026-08-11) — one thread per file, author + role + timestamp, organizer and speaker read the same conversation |
| CNT-06 | 1 | depth | Upload UI states file constraints (type/size) | — | **Gap** — no constraint messaging described |
| CNT-07 | 3 | roundtrip | Deliverables dashboard: per-speaker per-task status, filterable, reflects uploads | §4.8 Dashboard "Outstanding tasks" metric + "Top speakers by outstanding tasks" | Partial — dashboard-level insight exists; no full filterable per-task grid described |
| CNT-08 | 2 | bulk | Bulk reminder to speakers with outstanding tasks, confirmed | §4.9 "manual 'Send reminder to incomplete speakers' action + auto-reminder cron" | Covered (near-verbatim match) |
| CNT-09 | 2 | crud | Organizer edits session title/abstract from admin, persists | §4.4 drawer (Details/Participants/Evaluations tabs) — editability not explicit | Partial |
| CNT-10 | 2 | crud | Organizer edits speaker bio/headshot from admin, persists | — | **Gap** — only speaker self-edit via portal (§4.7) is described; no organizer-side edit path |
| CNT-11 | 2 | depth | Content edits logged in version/change history w/ attribution+timestamp; restore works | `convex/audit.ts` · submission drawer History tab · Settings → Activity | **Mostly closed (2026-08-11)** — append-only audit log with attribution + timestamp, incl. agent/API writes. Restore deliberately not built (HISTORY.md 61). |
| CNT-12 | 3 | rule | Sessions carry a content-approval status; unapproved content excluded from public output | §5 `submissions.status` (accept/decline/etc.) is the only status field | **Gap** — no distinct content-approval gate separate from submission/session status |
| CNT-13 | 1 | exists | Central files library aggregating uploads w/ metadata (session/speaker/date/versions) | — | **Gap** — no "Library"/"Files" nav item or screen anywhere in §3 IA |
| CNT-14 | 2 | bulk | Multi-select sessions/files → bulk ZIP download of latest versions | — | **Gap** — no bulk export feature described |

### 1.5 AI Agenda & Schedule Builder — `specs/05-ai-agenda.yaml` (prefix AIA, area weight 10, 8 items / 18 pts)

| ID | W | Type | Requirement | SPEC mapping | Status |
|---|---|---|---|---|---|
| AIA-01 | 3 | exists | Multi-day builder view: time dimension + rooms/tracks + day nav | §4.6 Views List/Day/Rooms/Conflicts; Day view "vertical time axis... columns = rooms" | Covered |
| AIA-02 | 2 | crud | Rooms/tracks configurable; new ones immediately usable | §4.1 "Rooms & Tracks manager: inline add/rename/delete" | Covered |
| AIA-03 | 3 | crud | Session placed into day/time/room slot, persists across reload | §4.6 "Drag from Unscheduled tray... onto grid" | Covered |
| AIA-04 | 3 | rule | Speaker double-booked across overlapping sessions → visible warning | §4.6 "same speaker in two overlapping sessions" conflict detection | Covered |
| AIA-05 | 2 | rule | Same room + overlapping time → blocked or flagged | §4.6 "same room overlap" | Covered |
| AIA-06 | 2 | rule | Moving a session clears its conflict indicators; persists | §4.6 "resolve it; public schedule updates" + Conflicts view "jump to" | Covered |
| AIA-07 | 2 | handoff | Explicit publish/go-live action; scheduled sessions become publicly observable | §4.6 accept criteria "public schedule updates" — no explicit publish control described | Partial — SPEC's reactive-Convex philosophy (§UX law 11, instant updates) implies no separate publish gate; sbek's script explicitly hunts for a Publish/Go-live button and may record its absence |
| AIA-08 | 1 | depth | Some auto-schedule/AI-assist control places ≥1 unscheduled session in one action | — | **Gap** (low priority — w1 polish, judged generously) |

### 1.6 Public & Embeddable Widgets — `specs/06-public-widgets.yaml` (prefix EMB, area weight **20**, 16 items / 34 pts)

| ID | W | Type | Requirement | SPEC mapping | Status |
|---|---|---|---|---|---|
| EMB-01 | 3 | exists | Sessions List: card per session (title, desc+Show more, date/time, room, speaker+title+company, Format/Track tags) | §4.3 `/e/:eventSlug` described only as "public schedule + speaker gallery... **struck as a requirement, keep minimal**" | **Gap/Partial** — a sessions-catalog surface with this field depth is not specified |
| EMB-02 | 2 | rule | Keyword search matches session titles AND speaker names | — | **Gap** |
| EMB-03 | 2 | rule | Faceted Filters (Track min., ideally Format/Location) narrow the list | — | **Gap** |
| EMB-04 | 3 | exists | Speakers List: alphabetized directory w/ headshot/name/title/company | — | **Gap** — SPEC only has "speaker gallery," not a separate directory pairing speakers↔sessions |
| EMB-05 | 2 | roundtrip | Speaker entry drills into detail (bio + their sessions); directory search by name | — | **Gap** |
| EMB-06 | 3 | exists | Agenda widget: day/room/time grid (or equivalent) w/ correctly placed session blocks | §4.3 "public schedule" — structure unspecified | Partial/Gap |
| EMB-07 | 2 | rule | Agenda day navigation switches days and re-renders sessions | — | **Gap** |
| EMB-08 | 2 | exists | Agenda block click → detail (full time range, room, description, Format/Track), Back restores | — | **Gap** |
| EMB-09 | 2 | exists | Schedule Itinerary: chronological day-tabbed list w/ full card anatomy | — | **Gap** — this widget doesn't exist as a distinct surface anywhere in SPEC |
| EMB-10 | 1 | depth | Personal schedule building: add/star sessions, view exactly those in a personal view | — | **Gap** |
| EMB-11 | 1 | depth | Personal schedule persists across reload; export/add-to-calendar exists | §6 API has `GET .../schedule.ics` (whole-event, not personal) + §4.9 per-speaker session .ics attachment | **Gap** — neither is an attendee personal-selection export |
| EMB-12 | 2 | exists | Speaker Gallery: photo grid, alphabetized, name search, graceful missing-photo fallback | §4.3 "speaker gallery" named but undetailed | Partial |
| EMB-13 | 1 | exists | Gallery card → detail modal (photo/name/title/bio/company/sessions list); Close restores grid | — | **Gap** |
| EMB-14 | 3 | scoping | All 5 widgets render to non-admin viewers (anonymous, attendee-auth, or embed — login-gating is fine) | §3 IA: `/e/:eventSlug` is public/unauthenticated | Partial — structurally sound for whichever widgets exist, but only ~2/5 widget types exist to score |
| EMB-15 | 3 | handoff | Organizer-side embed generator: type/format pickers, branding/filter/field config, saved list, retrievable "Get Code" snippet | §6 Public API — a raw Bearer-token JSON/`.ics` REST API, **not** a copy-paste-snippet builder with branding/filters/field-selection | **Gap** — biggest single miss in the whole rubric; no embed-admin UI is described anywhere in §3 IA (Settings has no "Embeds"/"Widgets"/"Share" section) |
| EMB-16 | 3 | roundtrip | Same session/speaker shows identical fields across widgets and matches organizer's record | Implied by Convex single-source-of-truth reactivity | Partial — plausible in principle, but only testable against the ~2/5 widgets that exist |

### 1.7 Speaker CRM (optional, extra credit) — `specs/07-speaker-crm.yaml` (prefix CRM, area weight 10, 12 items / 19 pts)

| ID | W | Type | Requirement | SPEC mapping | Status |
|---|---|---|---|---|---|
| CRM-01 | 3 | exists | Org-level cross-event contact directory, searchable | — | **Gap** |
| CRM-02 | 2 | rule | Multi-criteria filter (company/title/tag) on the directory | — | **Gap** |
| CRM-03 | 2 | roundtrip | Contact profile: identity + persistent notes + cross-event history surface | — | **Gap** |
| CRM-04 | 1 | depth | Custom fields or tags persist on a contact | — | **Gap** |
| CRM-05 | 2 | bulk | Contacts bulk-importable via CSV | — | **Gap** |
| CRM-06 | 1 | depth | Near-duplicate contacts surfaced + mergeable | — | **Gap** |
| CRM-07 | 2 | crud | Kanban sourcing pipeline, ≥4-5 stages, enroll + move + persists | — | **Gap** |
| CRM-08 | 1 | depth | Pipeline card detail: notes + timestamped stage history | — | **Gap** |
| CRM-09 | 1 | depth | Filtered view savable as a named reusable segment | — | **Gap** |
| CRM-10 | 2 | handoff | Contact pushed from org DB into a specific event's speaker list, data intact | — | **Gap** |
| CRM-11 | 1 | bulk | Bulk email to selected contacts, personalization + send confirmation/log | — | **Gap** |
| CRM-12 | 1 | depth | CRM dashboard w/ org-wide KPIs + ≥1 populated analytics widget | — | **Gap** |

All 12 are Gap by explicit scope choice: SPEC.md §3 IA has no organization/cross-event layer at
all — the whole app is a single event-scoped workspace. Since this area is optional (extra
credit, not part of the required 100), this is a deliberate and defensible trade, **not** a
priority fix (see §3 below) — but it means we forfeit the entire 19-point bonus pool unless we
add it late.

---

## 2. GAPS — brutal inventory

### 2.1 Public Widgets (EMB) — 20% of the required score, 0/16 items fully Covered

This is the single largest exposure in the whole eval. SPEC.md §4.3 explicitly says the public
route is meant to be **minimal** ("also serves as an 'embed' surface; struck as a requirement,
keep minimal") — a decision made before sbek's rubric existed, and it now directly conflicts
with 20% of the graded score:

- **Only 2 of 5 required widgets are even named** (`/e/:eventSlug` = "public schedule + speaker
  gallery"). **Sessions List** (EMB-01/02/03, 7 pts) and **Speakers List** (EMB-04/05, 5 pts,
  distinct from the gallery — it pairs each speaker with their sessions inline) and **Schedule
  Itinerary** (EMB-09/10/11, 4 pts, day-tabbed chronological view with personal-schedule
  building) don't exist as surfaces at all.
- Even the two named widgets ("public schedule" = Agenda, "speaker gallery") are undetailed:
  no card field anatomy, no search, no filters, no drill-down detail view, no day navigation on
  the schedule, no alphabetization/fallback rendering on the gallery.
- **EMB-15 (w3, handoff) is the most consequential single gap in the entire rubric.** sbek
  explicitly reads this item as "the primary evidence that the widgets are genuinely
  embeddable" and raised its weight specifically because EMB-14 stopped requiring anonymous
  access. It wants an organizer-facing embeds/widgets admin area: type picker (5 widget kinds),
  format picker (styled-HTML script tag / basic HTML / JSON / XML / iCal), branding/filter/field
  config, a saved-embeds list, and a retrievable "Get Code" snippet. SPEC.md §6 only specs a
  **raw Bearer-token REST API** (`/api/v1/*`) — a data feed, not a copy-paste embed generator.
  These are not the same capability and the API alone earns partial credit at best.
- EMB-14/16 (non-admin distribution, cross-surface consistency) can only be judged against
  whatever widgets exist, so their scores are capped by how many of the 5 we actually build.

### 2.2 Content Management (CNT) — file versions & approvals specifically called out

- **CNT-04 (file versioning, rule, w2) — Gap.** SessionBoard's headline content-management
  feature ("re-upload creates a new version, latest clearly marked, priors still viewable") has
  no equivalent anywhere: `uploads` in §5 has no version field, and no version-list UI is
  described.
- **CNT-11 (version/change history + restore, depth, w2) — MOSTLY CLOSED 2026-08-11.**
  An append-only `auditLog` records every high-value change with attribution and a timestamp
  (status changes, queue commits, form/agenda/speaker/settings edits, speaker portal edits)
  and — Marko's explicit addendum — every AGENT write: MCP tool calls (`MCP · <tool> ·
  sb_live_…`), REST writes (`API · <method path> · sb_live_…`), API-key create/revoke, and
  the experimental Airtable pull-back. Read as a **History** tab on each submission and an
  event-wide **Settings → Activity** feed with an "Agents & API" review lens. The RESTORE
  half is deliberately not built: swyx's own instinct (HISTORY.md 61) was that full
  versioning-with-restore is overkill for v1, so we ship the attribution and accept the
  remainder of this item's weight.
- **CNT-12 (approval gate, rule, w3) — Gap, and the highest-leverage single item in this area.**
  SessionBoard's content-management model is: organizer sets an internal approval status
  (draft/in-review/approved) on a session, and **only approved content syncs to the public
  agenda** — a gate distinct from the accept/reject *submission* decision. SPEC.md conflates
  these: `submissions.status` (accepted/declined/etc.) is the only status field, so there's no
  way to accept a talk but keep its *content* unpublished pending a content review. This is a
  `rule`-type item — sbek's calibration notes flag `rule` items as the strongest discriminator
  in the whole kit.
- **CNT-01 (organizer task-creation screen, crud, w3) — Gap.** Tasks only appear speaker-side in
  §4.7; there is no described admin screen for creating a file-request task with instructions
  and a due date and assigning it to speakers. Without this screen, CNT-01/07/08 all become hard
  to reach and CNT-02 (speaker-side upload) has nothing to be assigned against.
- **~~CNT-05 (file comments)~~ (COVERED 2026-08-11), CNT-10 (organizer edits speaker bio/photo), CNT-13 (files library),
  CNT-14 (bulk ZIP export) — all Gap.** None of these secondary content-management surfaces are
  described. CNT-13's absence is notable because sbek's own README calls it out as the
  organizer's review surface for collected assets.

### 2.3 Multi-event support + cross-event scoping

- **CFP-17/18 (2 pts each, exists+scoping) — Gap.** SPEC.md §3 IA is explicit: "Organizer app
  (`/app`, sidebar ~240px, **event-scoped**)." There is no events list, no event switcher, no
  "create a second event" control anywhere. sbek's CFP-S1 step 12 explicitly instructs the
  agent to look everywhere and record an explicit absence observation if none exists — that
  observation will read as a clean, unambiguous fail rather than a partial credit.
  This decision cascades: it's also why the entire optional Speaker-CRM area (10% bonus, 12
  items) is unreachable — cross-event reuse has nothing to reuse across.
- If multi-event is deliberately out of scope for v1, that's a legitimate product call — but it
  should be made **consciously**, since it forfeits ~4 required points (CFP-17/18) plus the
  entire 19-point optional CRM pool, and it's cheap to at least stub (a single-row "events" list
  screen with a "+ New event" control that creates a second isolated event) to bank the 2
  `exists`/`scoping` points without building real cross-event reuse.

### 2.4 Rule-enforcement items (deadlines, conflicts, approval gates)

Deadline enforcement is the weakest rule cluster:
- **CFP-04** (portal blocks new submissions after close) — Gap, no closed-state UI specified.
- **CFP-16** (speaker can't edit after close) — Gap, no edit-lock specified.
- **CNT-12** (approval gate on public output) — Gap, discussed above.

Conflict enforcement (agenda) is our **strongest** rule cluster and should be protected during
implementation, not just left to "should work":
- AIA-04 (speaker double-booking warning) and AIA-05 (room-overlap block/flag) are both
  explicitly Covered by §4.6's live conflict detection — these are exactly the kind of `rule`
  item sbek's calibration notes say most clones fail, so this is a real relative strength worth
  protecting against regression.

### 2.5 Handoff items (accepted → session → public, no re-entry)

- **CFP-15** (accepted submission → session, metadata intact) — Covered; §5's "accepted items
  ARE agenda sessions" data-model note is exactly the no-re-entry design sbek wants.
- **AIA-07** (explicit publish/go-live action + handoff glimpse) — Partial. SPEC's reactive,
  no-full-page-spinner philosophy (UX law §2.11) means changes are live immediately, with no
  separate "Publish" gate. That's a legitimate product stance, but sbek's script explicitly
  hunts for a Publish/Go-live control and screenshots its confirmation; if none exists the item
  degrades to "the data was already public the whole time," which is weaker evidence than an
  explicit action + confirmation, even though the underlying behavior (sessions become visible)
  is satisfied.
- **EMB-15** (embed generation as a handoff from organizer config → public rendering) — Gap, see
  §2.1 above; this is the single largest handoff-type point loss in the kit.
- **CRM-10** (contact pushed from CRM into an event) — Gap, moot without multi-event/CRM.

### 2.6 Manual-verification / side-effect items (emails, .ics)

These are graded auto-partial or manual, so the bar is lower (harness only needs the in-app
half: settings exist, send reports success, history/outbox logs the message) — but several have
**no described in-app half at all**, which would make even the auto-partial credit unreachable:

- **CFP-08** (submission confirmation email) — Gap. §4.9 never mentions a post-submit
  confirmation template; only decision-stage templates are seeded.
- **ABS-09** (bulk reminder to lagging *reviewers*) — Gap. §4.9's reminder feature is
  speaker-only ("Send reminder to incomplete speakers").
- **SPK-13** (general bulk email to speakers, e.g. welcome) — Gap. No compose-to-filtered-group
  flow beyond the decision-notification and CNT-08 reminder paths.
- **EMB-11** (personal-schedule export/add-to-calendar) — Gap. §6's `schedule.ics` is
  whole-event, not scoped to an attendee's personal selection; there's no widget-level ics
  export at all since the itinerary widget itself doesn't exist.
- Items that **are** covered and should be protected: **CFP-14** (decision emails + Outbox),
  **CNT-08** (bulk reminder to speakers with outstanding tasks — near-verbatim match to the
  spec's exact language), **SPK-16** (automated daily reminder cron), **§4.9**'s .ics attachment
  on scheduled acceptance emails (feeds the manual half of any future itinerary-export item).

---

## 3. PRIORITY — top 20 highest-leverage items

Ranked by `(item weight ÷ area total item weight) × area weight` — the item's actual point
contribution to the overall score — weighted up for items whose `type` is `rule`/`scoping`/
`handoff` (sbek's calibration notes call these the strongest discriminators and the first thing
a turn-limit cutoff eats) and for items that are currently a hard **Gap** (today: 0 credit).
Effective points shown are per-item, out of the required-area total of 100.

| Rank | ID | Area | W | Type | Eff. pts | Status | Why this is high-leverage |
|---|---|---|---|---|---|---|---|
| 1 | EMB-15 | Public Widgets | 3 | handoff | 1.76 | Gap | Single biggest miss in the kit — no embed generator = the whole "widgets are genuinely embeddable" claim fails; sbek raised this to w3 specifically for this reason |
| 2 | EMB-09 | Public Widgets | 3 | exists | 1.76 | Gap | An entire required widget type (Itinerary) doesn't exist as a surface — pure zero today |
| 3 | CNT-12 | Content Mgmt | 3 | rule | 1.45 | Gap | Approval-gate is a `rule` item (strongest discriminator type) and the pass/fail is binary and easy to check — cheap to add, expensive to skip |
| 4 | EMB-01 | Public Widgets | 3 | exists | 1.76 | Gap/Partial | Sessions List is a required widget with no described surface at all |
| 5 | EMB-04 | Public Widgets | 3 | exists | 1.76 | Gap | Speakers List (directory) is distinct from the gallery and doesn't exist |
| 6 | CNT-04 | Content Mgmt | 2 | rule | 0.97 | Gap | Versioning is `rule`-type and a headline SessionBoard feature; currently zero data-model support |
| 7 | CNT-01 | Content Mgmt | 3 | crud | 1.45 | Gap | Blocks CNT-02/07/08 downstream — no organizer task-creation screen means the whole file-request pipeline has no entry point |
| 8 | ABS-07 | Abstract Mgmt | 2 | scoping | 1.43 | Gap | Blind review is `scoping`-type in a 20%-weight area; currently no anonymization concept anywhere |
| 9 | CFP-17 | Call for Papers | 2 | exists | 1.05 | Gap | Cheap to stub (a 1-row events list + "+ New event"); unlocks CFP-18 and the entire CRM bonus area too |
| 10 | CFP-18 | Call for Papers | 2 | scoping | 1.05 | Gap | Direct consequence of #9 — once an events list exists, this is close to free |
| 11 | EMB-06 | Public Widgets | 3 | exists | 1.76 | Partial/Gap | Agenda widget structure (grid, day nav, block detail) is unspecified even though "public schedule" is named |
| 12 | CNT-11 | Content Mgmt | 2 | depth | 0.97 | **Mostly closed** (2026-08-11) | Audit log with attribution shipped (incl. agent/API writes); restore deliberately deferred — see the CNT-11 note above |
| 13 | SPK-13 | Speaker Mgmt | 3 | bulk | 1.36 | Gap | Highest-weight Speaker-Mgmt gap; no general bulk-compose-to-speakers flow exists at all |
| 14 | SPK-02 | Speaker Mgmt | 3 | crud | 1.36 | Partial | Highest-weight item in the whole SPK area; roster is described as derived-from-acceptance, not a first-class manual add flow |
| 15 | SPK-05 | Speaker Mgmt | 2 | crud | 0.91 | Gap | No organizer-side general-task creation screen — blocks SPK-05/09/12 chain |
| 16 | CNT-13 | Content Mgmt | 1 | exists | 0.48 | Gap | Cheap: an aggregate "Files" list view is a thin read-model over uploads already in §5 |
| 17 | CNT-14 | Content Mgmt | 2 | bulk | 0.97 | Gap | Bulk ZIP export — no feature at all; `bulk`-type items are explicitly called out as a common clone failure mode |
| 18 | CFP-04 | Call for Papers | 2 | rule | 1.05 | Gap | `rule`-type; requires only a closed-state branch on the already-existing `closeAt` field |
| 19 | CFP-16 | Call for Papers | 2 | rule | 1.05 | Gap | Same field (`closeAt`) gates both the public form (CFP-04) and the speaker edit lock — one date check, two rubric items |
| 20 | AIA-07 | AI Agenda | 2 | handoff | 1.11 | Partial | Cheap fix: add one explicit "Publish agenda" button + confirmation state on top of already-live data, to give sbek's script something concrete to click and screenshot |

**Reading order if triaging by effort:** #9/#10 (events stub), #18/#19 (one `closeAt` check, two
items), and #16 (files library as a read-model) are the cheapest wins. #1/#2/#4/#5/#11
(EMB widgets) are the most expensive but carry the most required points — building even a
minimal, faithful version of all 5 widget types before polishing any one of them is worth more
than perfecting 2 of them, because EMB-14/16 also depend on having all 5 present.

---

## 4. EVAL-OPS — running the kit against our deployment

### 4.1 One-time setup

```bash
cd /Users/markokraemer/Projects/kortix/sbek
pnpm install                                   # also downloads Playwright Chromium
cp evalconfig.example.json evalconfig.json     # then edit per §4.2 below
```

Requires Node.js 20+ and `ANTHROPIC_API_KEY` in the environment (or an `ant auth login`
profile). Budget ~$2–10 of API usage per full run (models default to `claude-opus-5`).

### 4.2 `evalconfig.json` fields to fill in

```jsonc
{
  "url": "https://<our-deployment-url>",
  "areas": [],                 // [] = all required areas; or e.g. ["call-for-papers","public-widgets"]
  "includeOptional": false,    // true also runs speaker-crm (optional, extra credit)

  "personaEmails": {           // override fixtures/sample-data.json's placeholder emails
    "organizer": "you+sbek-organizer@your-domain.com",   // use real inboxes we control so
    "speaker":   "you+sbek-speaker@your-domain.com",     // side-effect items (CFP-08/14,
    "speaker2":  "you+sbek-speaker2@your-domain.com",    // SPK-06/13/16, CNT-08, ABS-09/13)
    "reviewer":  "you+sbek-reviewer@your-domain.com"     // can be manually verified afterward
  },

  "credentials": {              // only if we ship password login; magic-link auth uses `auth` instead
    "organizer": { "email": "...", "password": "...", "notes": "Pre-seeded admin account" }
  },

  "agentModel": "claude-sonnet-5",   // cheap agent
  "judgeModel": "claude-opus-5",     // strong judge — judge quality drives cross-submission fairness
  "maxTurnsPerScenario": 70,
  "headless": true,
  "submissionNotes": "..."           // see §4.5 below
}
```

### 4.3 Personas / credentials the kit expects

Fixture identities come from `fixtures/sample-data.json` (`identities` block) unless overridden
by `personaEmails`/`credentials` above:

| Persona | Fixture identity | Notes for our app |
|---|---|---|
| `organizer` | Jordan Alvarez | SPEC §4.3's Account step is **magic-code, no passwords** — the harness's password-login `credentials` field won't apply. SPEC §7 promises "Demo mode banner shows magic links inline so no email is ever required to evaluate" — this is exactly the workaround sbek's README recommends (`auth --persona <name>`) baked into our own UX; make sure it actually ships, since it eliminates our biggest auth-related coverage risk. |
| `speaker` | Priya Raman | Reached via `/portal/:eventSlug` magic-link (§4.7). |
| `speaker2` | Marcus Okafor | Used in ABS/CNT co-author and multi-speaker scenarios. |
| `reviewer` | Sam Whitfield | Reached via `/review/:token` magic link (§4.5) — no signup/password flow to test, which is fine since CFP-10 explicitly accepts "any usable credentials." |
| `attendee` (ad hoc, EMB-S1/S2 only) | "Alex Attendee" — email/password hardcoded in the *scenario steps*, not in `fixtures/sample-data.json` | Our `/e/:eventSlug` route is unauthenticated per SPEC §3 IA, so the harness should never need to create this account against our app — record that explicitly as a positive in `submissionNotes` (see below), since sbek treats anonymous access as a bonus, not a requirement. |

If any surface ends up gated behind magic-link/OAuth that the harness's browser agent can't
complete unattended, pre-authenticate once by hand:

```bash
pnpm run sbek -- auth --persona speaker     # opens a real browser window; request the magic
                                             # link, paste it into THAT window, press Enter
```

This writes `.auth/<host>.<persona>.json`; every scenario for that persona then starts already
signed in. Re-run whenever a session expires.

### 4.4 Running the eval

```bash
pnpm run list                                              # see areas/scenarios/rubric coverage
pnpm run smoke                                              # offline Playwright check, no API key
pnpm run eval -- --url <url> --dry-run                      # validate specs, print the plan (free)

# Cheap pilot before a full run — one scenario, capped turns, small model:
pnpm run eval -- --url <url> --areas public-widgets --scenarios EMB-S1 \
  --max-turns 18 --agent-model claude-haiku-4-5 --judge-model claude-haiku-4-5

# Full required-areas run (recommended grading config):
pnpm run eval -- --url <url> --agent-model claude-sonnet-5 --judge-model claude-opus-5

# Include the optional Speaker-CRM area once we decide to build it:
pnpm run eval -- --url <url> --include-optional

# Watch a running eval (full run takes ~1hr):
tail -f runs/<ts>/run.log

# Resume an interrupted or partial-coverage run (no re-charge for completed scenarios):
pnpm run eval -- --resume runs/<ts> [--config evalconfig.json]

# Rescore existing evidence against an updated rubric, no API calls:
pnpm run sbek -- rescore --run runs/<ts>
```

Useful subset flags: `--areas call-for-papers,public-widgets`, `--scenarios CFP-S1,CFP-S2`,
`--headed` (watch the browser). Areas chain in order (01→07) — a full ordered run is the
intended mode since later areas assume state from earlier ones (accepted talks become sessions,
sessions become the agenda, the agenda feeds the public widgets); running a subset still works
via each spec's fallback "if X doesn't exist yet, create it" steps, just with more seeding turns.

### 4.5 Manual verification pass (async, after the auto run)

```bash
# Read runs/<ts>/manual-checklist.md, fill in runs/<ts>/manual-results.json
# (verdicts: pass | partial | fail | not_found), then:
pnpm run finalize -- --run runs/<ts>
```

This is the path back into the score for every `side-effect`/`manual`/`auto-partial` item we
listed in §2.6 (once built) plus any item the agent hit as `cannot_judge` (blocked, not
missing) rather than `not_found`. **This is where CFP-08, CFP-14, SPK-06/13/16, CNT-08, ABS-09/
13, EMB-11 get their credit** — make sure the inboxes in `personaEmails` are real before the run
so this checklist is fillable at all.

### 4.6 What `submissionNotes` should contain

Per the field's own description: *"Anything the graders should know: seeded demo data, how to
reach an organizer account, which routes exist, known quirks."* Map this directly to SPEC.md §7
"Demo & judge experience," which was written with exactly this purpose in mind:

```
Seed data: "AI Engineer Sandbox Event" — 2 rooms, 3 tracks, 1 open CFP form, 12 submissions
across all statuses, 2 evaluation plans w/ partial scores, 6 scheduled sessions incl. 1
deliberate resolved conflict, 4 speakers w/ mixed task completion, seeded email templates.

Entry points from "/": "Organizer demo →" auto-logs in the demo organizer account (no
credentials needed — do not use the evalconfig `credentials` block, it will 404/no-op).
"Speaker demo →" issues a magic link. "Submit a talk →" opens the public CFP form.

Auth model: magic-link / magic-code only, no passwords anywhere. In demo mode the magic
code is shown inline on-screen (never emailed) specifically so an unattended agent can
complete every login without an inbox — this is intentional, not a bug; do not route these
through `personaEmails`.

Routes: /app (organizer, event-scoped), /submit/:formSlug (public CFP), /e/:eventSlug
(public schedule + speaker gallery), /portal/:eventSlug (speaker portal, magic-link),
/review/:token (reviewer, magic-link), /api/v1/* (bonus REST API, Bearer token in .env.example).

Known gaps at submission time: [fill in from §2 above — e.g. "no organizer-side embed
generator (EMB-15) — public data is only reachable via the raw /api/v1 REST API today";
"no per-file versioning (CNT-04)"; "single-event only, no events list (CFP-17/18)"]. Listing
these ourselves means the agent records them as explicit `not_found` observations instead of
burning turns hunting for something that doesn't exist — cheaper for us and fairer to the judge.
```

Being explicit about known gaps in `submissionNotes` doesn't cost us points (judging is
implementation-agnostic and evidence-based either way) — but it saves agent turns that would
otherwise be spent hunting for a nonexistent embed builder, which is exactly the kind of
turn-limit pressure that turns a legitimate `not_found` on a `rule`/`scoping` item into a
`cannot_judge` on something else entirely, per the calibration notes.
