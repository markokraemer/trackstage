# Parity verification — merged gap list (2026-08-11)

Adversarial verification of 378 requirements across sbek rubric, coverage matrix,
video audit, and learn-site product map against the live app: **293/378 proven covered**, 39 gaps below (severity-ranked).
Fix wave dispatched same day — see BUILD-LOG.

## 1. [P0 · degraded] PRE-SUBMISSION BLOCKER: e2e test artifacts pollute the PUBLIC demo event — 8 of 16 published sessions and 19 of 34 people on ai-summit-2026 are junk fixtures, and they lead every public widget, the speakers directory and the .ics feed. Degrades evidence quality for EMB-01/04/06/09/12/16 and every judge's first impression.

**Evidence:** Live against dev:neat-sparrow-926 — published sessions include 'Agenda One ag-mso9sden-y0wr8', 'Dragged dg-mso9smq1-vqnnf', 'Keyboard kb-mso9tgdg-phjkr', 'Outbox Proof t-mso9vfzo-lr06h', 'Triage Talk tri-mso9ycqv-6m0po'. People include 6 duplicate 'Aggie Enda', 3 'Tria Ger', 2 'Evan Uator' and two with EMPTY names. curl /e/ai-summit-2026/sessions renders 'Agenda One ag-mso9sden-y0wr8 / Created by the agenda e2e flow.' as the FIRST card; /e/ai-summit-2026/speakers shows 'Speakers 1 - 19 of 19' with six identical 'AE Aggie Enda — 1 session' tiles; schedule.ics leads with SUMMARY:Agenda One ag-mso9sden-y0wr8.

**Fix:** Run `pnpm seed:setup` immediately before any sbek run or submission — this is a release-gate step, not a build. Longer-term: make tests/e2e write into their own event or a `__e2e__` slug, and extend the AGENT_ARTIFACT_EVENT purge at convex/seed.ts:46 to also purge people/submissions whose email or title matches the e2e prefixes.

**Sources:** rubric-2

## 2. [P0 · partial] Speaker-uploaded files are invisible to the organizer — closes FOUR rubric items at once (CNT-04 versions, CNT-05 cross-role comments, CNT-13 central files library, SPK-10 download deliverable with metadata). Portal uploads carry no submission link and the only by-person/by-task read model is unwired.

**Evidence:** src/components/portal/task-item.tsx:66-80 calls upload(file, { taskId, isHeadshot }) — no submissionId — passed straight through src/components/portal/use-portal-upload.ts:43 to convex/portal.ts:396 attachUpload (verified: the file writes only taskId). The ONLY organizer file surface is the submission drawer Files tab (src/components/submissions/submission-detail-drawer.tsx:717 → submission-files.tsx:52) reading convex/files.ts:195 submissionFiles, which is indexed by_submissionId (verified at convex/files.ts:195-206). convex/tasksAdmin.ts:303 listUploads exists but `grep -rn listUploads src/` returns ZERO consumers (verified). No /app/files, Library, Content or Assets route exists (verified: src/routes/app/ = agenda, communications, embeds, evaluation, events, forms, settings, speakers, submissions). The demo only looks complete because convex/seed.ts:1705 hand-writes BOTH submissionId and taskId on the seeded slides row, while the real portal-uploaded headshot.png row has neither.

**Fix:** One build closes all four: (1) add /app/files rendering the already-written convex/tasksAdmin.ts:303 listUploads with columns file / speaker / session / uploaded / version / approval, reusing src/components/shared/file-row.tsx and data-toolbar.tsx, and add it to NAV_GROUPS in src/routes/app/route.tsx; (2) add a Files section to src/components/dashboard/speaker-profile-drawer.tsx driven by the same query scoped by personId (gives SPK-10 filename/uploader/timestamp/download); (3) add `submissionId: v.optional(v.id("submissions"))` to `tasks` in convex/schema.ts:403 so assign-task-dialog.tsx can bind a task to a session and task-item.tsx passes it through — or widen submissionFiles to union uploads whose taskId belongs to a task on that session, which restores the version list and comment thread on the submission Files tab.

**Sources:** rubric-1, matrix-2

## 3. [P0 · degraded] EMB-15 (w3, handoff, ~1.76 pts — highest-leverage single item in the kit): the embed generator is fully built but UNREACHABLE from the organizer UI, so an agent hunting the sidebar records not_found on a shipped feature.

**Evidence:** VERIFIED: src/routes/app/embeds/index.tsx exists (5 widget types, 5 formats, save/load via convex/embeds.ts), but NAV_GROUPS in src/routes/app/route.tsx:83-114 lists only Dashboard, Submissions, Forms, Evaluation, Agenda, Speakers, Communications, Settings. `grep -rn 'app/embeds' src` (excluding routeTree.gen.ts and the route itself) returns exactly ONE in-app link: an inline text link in a card description at src/components/settings/rest-api-card.tsx:33, rendered only on Settings → API & MCP. No ⌘K action in src/components/shell/global-search.tsx; PublishAgendaButton says the schedule appears 'in your embeds' (src/components/agenda/publish-agenda-button.tsx:139) without linking there. `convex data embeds` = 0 rows, so the saved list is empty on first view too.

**Fix:** Add an 'Embeds' item to NAV_GROUPS in src/routes/app/route.tsx (Program group, after Agenda, icon RiCodeSSlashLine). Add a 'Get embed code' command-palette action in src/components/shell/global-search.tsx, a button next to 'View public agenda' in the Agenda PageHeader (src/routes/app/agenda/index.tsx ~line 213) and in the publish success toast. Seed one saved embed row in convex/seed.ts so the list is non-empty. Roughly 20 minutes for the single highest-value point block in the kit.

**Sources:** rubric-2

## 4. [P0 · partial] ABS-03 (w3, crud): scorecard criteria have no TYPE — the eval builds a Recommendation dropdown (Accept/Maybe/Reject) plus numeric Originality/Relevance plus a Comments field, and only the numeric third can be recorded.

**Evidence:** VERIFIED convex/schema.ts:370 — `criteria: v.array(v.object({ id: v.string(), label: v.string() }))` with the comment '1–5 each'; no discriminator. convex/evaluationsAdmin.ts:82 validateCriteria checks labels only; convex/review.ts:173 submitScores validates every value as an integer 1–5. The plan editor (src/components/evaluation/new-plan-dialog.tsx:341) renders criteria as bare label inputs with no type picker, and src/components/evaluation/score-field.tsx hard-codes SCORE_VALUES = [1,2,3,4,5] in a single ToggleGroup. Exactly ONE free-text field exists per evaluation (the global `comment`); no dropdown criterion type anywhere.

**Fix:** Add `type: 'numeric'|'select'|'text'` (+ `options?: string[]`) to the criterion validator in convex/schema.ts:370 and the criterionValidator/validateCriteria in convex/evaluationsAdmin.ts; store non-numeric answers in a sibling `values: v.record(v.string(), v.string())` on `evaluations` so convex/review.ts:173's 1–5 guard stays intact for numeric criteria; add a type Select + options editor to new-plan-dialog.tsx and branch rendering in score-field.tsx and /review/$token. Aggregation in evaluationsAdmin.summary/scoresBySubmission must skip non-numeric criteria.

**Sources:** rubric-1, matrix-2

## 5. [P0 · partial] ABS-05 (w3, the heaviest scoping item) + ABS-06: assignment is plan-wide only, so two evaluators on one plan see an IDENTICAL queue — 'a reviewer's queue contains exactly their assigned submissions' is only true when a plan has one evaluator. No auto-distribute, no per-reviewer cap.

**Evidence:** VERIFIED convex/schema.ts:378-387 — the `evaluators` table carries planId/eventId/email/name/token only, no assignment array and no cap. convex/review.ts:66 iterates `plan.submissionIds.entries()` for whichever token presents; :157 `const assigned = new Set(plan.submissionIds)`; :186 validates against the same plan-wide list. The seeded demo makes it observable: demo-eval-alex and demo-eval-sam share planId kn7fs4j04d9kysmhzp1ak3a3sh8c8fbw. The plan dialog has a track filter for building the pool (new-plan-dialog.tsx:430), so only the pool-building half of ABS-06 exists. docs/reference/sbek-rubric.md:68 already grades ABS-05 a Gap.

**Fix:** Add `assignedSubmissionIds: v.optional(v.array(v.id('submissions')))` to the `evaluators` table; have convex/review.ts:66/157/186 prefer it and fall back to plan.submissionIds so nothing regresses. Add an `autoDistribute` mutation in convex/evaluationsAdmin.ts (round-robin the pool honouring `reviewersPerSubmission` and a per-reviewer cap) plus a 'Distribute' control with a live impact-count on src/routes/app/evaluation/$planId.tsx.

**Sources:** matrix-2, learn-map, rubric-1

## 6. [P0 · missing] CFP-16 (w2, rule): submission editing does NOT lock after the CFP close date — CFP-S4 deliberately sets closeAt to the past and step 8 verifies the speaker's submission is read-only, so this fails deterministically.

**Evidence:** VERIFIED convex/portal.ts:266-300 updateSubmission gates only on status (declined/withdrawn) and the event-level portalBehavior.allowSubmissionEdits flag; it never loads the submission's form and never reads forms.closeAt / forms.status. `grep -rn isFormOpen convex/` returns hits ONLY in convex/submit.ts (29, 64, 353, 414) — portal.ts never imports it, even though submit.ts:29 already implements exactly this check. Client-side src/components/portal/portal-utils.ts:137 canEdit() = !['declined','withdrawn'].includes(status), and src/components/portal/submission-drawer.tsx:223 renders the affirmative banner 'You can update the wording here at any time — even after your talk has been accepted.' Live asymmetry: /submit/ds-cfp (seeded closed form, closeAt = now-20d) correctly renders the closed card while the portal ignores the same date.

**Fix:** Export isFormOpen from convex/submit.ts (or move to convex/lib/) and call it in convex/portal.ts updateSubmission after the ownership check when submission.formId is set — throw 'The call for speakers has closed, so this submission can no longer be edited.' Return an `editingClosed` flag per submission from the portal home/submissions payloads, consume it in portal-utils.ts canEdit(), and swap the banner in submission-drawer.tsx:221-240 for the existing closed-state alert. Note the doc tension: swyx's clarification was about acceptance-locking, not the close date, so this does not contradict AGENTS.md.

**Sources:** rubric-1, matrix-1

## 7. [P1 · missing] Staged queue statuses leak to speakers — a speaker whose talk an organizer has staged for decline sees 'Decline Queue' in their portal BEFORE any decision email is sent, defeating the entire point of the staged queue.

**Evidence:** Live: POST portal:home with portalToken 'demo-grace-lindqvist' against dev:neat-sparrow-926 returns `decline_queue | Why we rewrote our stack in Rust (again)`. VERIFIED convex/portal.ts:88 submissionSummary passes `status: s.status` through raw; src/components/portal/submission-card.tsx:68 and submission-drawer.tsx:179 render <StatusPill status={submission.status}> and statusLabel() maps decline_queue → 'Decline Queue' (src/components/shared/status-pill.tsx:98). DOC CONFLICT to resolve: AGENTS.md says 'Statuses use identical wording in organizer and speaker UIs' — which is why this shipped — but that rule was written for committed statuses, not the two staged queues whose purpose is that the decision is not yet public.

**Fix:** Mask in one place: in convex/portal.ts::submissionSummary map accept_queue|decline_queue → 'pending' before returning (and in the home/submissions payloads), leaving organizer surfaces untouched. Optionally honour a custom status's showCustomName:false. Add an e2e assertion: stage a decline, open /portal/t/<token>, expect 'Pending' and not 'Decline Queue'. Amend the AGENTS.md wording so the exception is recorded.

**Sources:** learn-map

## 8. [P1 · partial] CNT-07 (w3, roundtrip): no deliverables/tasks dashboard — there is no organizer destination showing per-speaker per-task status with due dates and filtering. CNT-S3 step 2 needs Priya's presentation task shown complete/uploaded and her headshot task incomplete, at list level.

**Evidence:** VERIFIED there is no Tasks/Deliverables entry in NAV_GROUPS (src/routes/app/route.tsx:83-114) and no /app/tasks route on disk. The nearest surface is the Speakers roster: convex/dashboard.ts:337-346 returns `tasks: {done,total}` plus `openTasks[]`, but src/components/dashboard/speakers-table.tsx:230-252 renders only the ratio and the FIRST open task title plus '+N more'. Completed task names never appear at list level, there is no per-task column or filter, and per the files finding uploads against tasks are not reflected organizer-side at all.

**Fix:** Add /app/tasks backed by the already-written convex/tasksAdmin.ts:20 `list` query, rendered as a speaker × task matrix with due dates, upload/complete state and a status/task filter; link it from NAV_GROUPS and from the dashboard's outstanding-tasks card. Pairs naturally with the /app/files build above.

**Sources:** rubric-1

## 9. [P1 · missing] SPK-03 (w2, bulk): speakers cannot be bulk-imported from CSV — SPK-S1 step 6 uploads a speakers.csv fixture and expects Dana Kowalski on the roster.

**Evidence:** VERIFIED convex/speakersAdmin.ts exports only addManual (59), updateProfile (155), setPublicVisibility (228), hiddenFromPublic (268), setWorkflowStatus (284) — no bulk create. `grep -rli csv src convex` returns only export-side files (src/components/submissions/export-csv.ts, src/lib/files.ts, convex/submissions.ts exportData) plus design-system demos; no parseCsv/importCsv symbol anywhere. src/routes/app/speakers/index.tsx header actions are Remind incomplete / Assign task / Add speaker (lines 266-296) — no Import. docs/reference/sbek-rubric.md:85 already grades SPK-03 a Gap.

**Fix:** Add `importRows` to convex/speakersAdmin.ts taking parsed rows (email, firstName, lastName, jobTitle, company, bio), upserting on people.by_eventId_and_email with workflowStatus 'invited', honouring an 'Update record if already exists' flag and an 'Ignore this column' mapping, capped at 1,000 rows, writing one auditLog row per batch. Client-side parse + column-mapping/preview dialog beside 'Add speaker' in src/routes/app/speakers/index.tsx; reuse the existing export column set as the downloadable template. Dedupe-by-email is explicitly acceptable per pass_criteria.

**Sources:** rubric-1, matrix-2, learn-map

## 10. [P1 · partial] CNT-14 (w2, bulk): bulk ZIP download only works inside ONE submission — there is no multi-select → download path, no grouping options, and no file-type dimension.

**Evidence:** VERIFIED downloadFilesBundle exists (src/lib/files.ts:236, backed by src/lib/zip.ts) with a single call site: src/components/submissions/submission-files.tsx:78-80, which zips all files of the one open submission. src/components/submissions/bulk-bar.tsx offers status moves only (grep for download/bundle/zip → nothing) and src/routes/app/submissions/index.tsx:449-462 offers CSV export only. The uploads table (convex/schema.ts:431-466) has title/version/approvalStatus/assignedPersonId/deletedAt but no fileType, so the Presentation/Poster/Handout filter and the 3-step grouping wizard have nothing to filter on.

**Fix:** Add a 'Download files' action to src/components/submissions/bulk-bar.tsx that collects the selected submissions' latest-version uploads and calls the existing downloadFilesBundle with folder-per-session grouping — the zip machinery is written, this is UI only. Mirror it over selected rows once /app/files lands. Optional depth: add `uploads.fileType` (presentation|poster|handout, default presentation) and a file-type checkbox + group-by + estimated count/size step to the dialog.

**Sources:** rubric-1, matrix-2, matrix-1, video, learn-map

## 11. [P1 · degraded] The form builder's 'Send a deadline reminder' toggle promises emails that are NEVER sent — a silent false promise inside the brief's core comms/reminders scope.

**Evidence:** VERIFIED the toggle persists (src/components/forms-builder/steps/settings-step.tsx:92-98, copy 'Emails anyone with an unfinished draft before the form closes. Needs a close date.', stored as forms.settings.sendReminderEmail, convex/schema.ts:251, seeded true at convex/seed.ts:1102) but NOTHING reads it: `grep -rn sendReminderEmail convex/` returns only schema.ts:251, seed.ts:1102/1521, forms.ts:46/178 and mcp.ts write args — no query, mutation, action or cron. convex/crons.ts registers exactly four jobs (task-reminders → comms.queueDueTaskReminders, airtable-sync, webhook-delivery-sweep, upload-intent-sweep); task-reminders chases open SPEAKER TASKS, not unfinished CFP drafts. closeAt's only runtime reader is convex/submit.ts:33 (reject after deadline). Live: 4 draft submissions exist on ai-summit-2026 and no message row is ever queued for them.

**Fix:** Wire it: add a daily internalMutation in convex/crons.ts (`queueDraftCloseReminders`) that, for each form with settings.sendReminderEmail && closeAt, buckets to the 5-day and 1-day marks in the event timezone and queues a new `draft_reminder` template through the same queue+deliverPending path as comms.queueDueTaskReminders, deduped on templateKey+formId+bucket via the existing wasRecentlyMessaged latch; add the template to the seeded set and TEMPLATE_META in src/components/comms/constants.ts. Cheap alternative if time runs out: disable the toggle and drop the claim from its description.

**Sources:** video, learn-map

## 12. [P1 · degraded] ABS-01 (w3): review rounds have a single due date, not an open/close RANGE — ABS-S2 asks for Initial Review 2026-08-01..2026-10-15 and Final Review 2026-10-16..2026-11-30 and expects both ranges visible after reload.

**Evidence:** evaluationPlans (convex/schema.ts:366-377) has name, round, criteria, dueAt, status, blind — one date, no opensAt. convex/evaluationsAdmin.ts:338 createPlan / :392 updatePlan accept only dueAt (+clearDueAt), and src/components/evaluation/new-plan-dialog.tsx:589-599 renders a single 'Due date' DatePickerField. Distinct names and distinct scorecards per plan DO work, so this is partial credit at risk on a w3 item, not a total miss.

**Fix:** Add `opensAt: v.optional(v.number())` to evaluationPlans, thread it through createPlan/updatePlan/listPlans/planDetail in convex/evaluationsAdmin.ts, add a second DatePickerField to new-plan-dialog.tsx, and render 'Aug 1 – Oct 15' on src/components/evaluation/plan-card.tsx.

**Sources:** rubric-1

## 13. [P1 · partial] ABS-11 (w2, crud): co-authors can only be added at CREATION time — a chained eval run reuses the area-01 submission and adds the co-author by EDITING it, which is impossible in either UI.

**Evidence:** Co-authors work via convex/submit.ts participantArg (public form Participants step) and speakerEmails[] on convex/submissions.ts:404 addManual only. Afterwards: convex/portal.ts:266 updateSubmission's patch validator is limited to {title, description, answers} (VERIFIED at convex/portal.ts:269-274), and the organizer's Participants tab is read-only — src/components/submissions/submission-detail-drawer.tsx:613-645 renders a plain <ul> whose empty state literally says 'You can add people to a manually created session when you create it.' `grep -rn 'addParticipant|removeParticipant' convex/ src/` matches only local handlers in src/routes/submit/$slug.tsx:221/225 (the public wizard's client state) — no Convex mutation exists.

**Fix:** Add addParticipant / removeParticipant / setParticipantRole mutations to convex/submissions.ts (upsert people by eventId+email, write submissionParticipants with role + order, recordAudit), expose an 'Add person' control in the Participants tab of submission-detail-drawer.tsx, and add the same control to src/components/portal/submission-drawer.tsx gated on allowSubmissionEdits.

**Sources:** rubric-1

## 14. [P1 · partial] CNT-10 (w2, crud): the organizer cannot upload a speaker's HEADSHOT — CNT-S3 step 10 replaces headshot.png from the organizer side. Bio editing works and persists; the photo half cannot be exercised at all.

**Evidence:** VERIFIED convex/speakersAdmin.ts:155 updateProfile accepts firstName/lastName/jobTitle/company/bio/headshotNote/publicVisible — no headshotId, no organizer upload path. src/components/dashboard/speaker-profile-drawer.tsx:2-11 states the design choice explicitly ('The headshot IMAGE itself stays the speaker's to upload'); the drawer offers only a text headshotNote (lines 297-311) beside a read-only <AvatarImage> (line 181). `grep -rn headshotId src/components/dashboard/` → 0 hits.

**Fix:** Add `headshotId` to speakersAdmin.updateProfile's patch (or extend convex/files.ts:120 attachUploadAsOrganizer with a personId + headshot branch reusing replaceHeadshot from convex/lib/files.ts), and drop a FileDropZone (src/components/shared/file-drop-zone.tsx, imagesOnly) into the avatar block of speaker-profile-drawer.tsx — the portal's HeadshotUploader is a ready template.

**Sources:** rubric-1, matrix-2

## 15. [P1 · degraded] The REST /v1 API ignores per-session and per-speaker public visibility — a session the organizer explicitly hid still reports is_public:true, and hidden speakers carry no visibility field at all. The embargo leaks the moment anyone uses the documented integration path.

**Evidence:** VERIFIED convex/apiV1.ts:322 hardcodes `is_public: submission.status === "accepted"` — it never reads submissions.publicVisible. speakerShape (convex/apiV1.ts:212-254) emits no is_public/publicVisible field. Live: curl /v1/event/ai-summit-2026/sessions returns "is_public": true with no visibility field on any participant. The web surfaces ARE correct (convex/publicData.ts:145 filters publicVisible !== false, :171 skips hidden people), so the gap is confined to /v1 — but TODO.md claims delta L4 is DONE 'including the JSON API'.

**Fix:** convex/apiV1.ts: change is_public to `submission.status === 'accepted' && submission.publicVisible !== false`, add `is_public: person.publicVisible !== false` to speakerShape, and add a `?public=true` filter on the sessions/speakers list endpoints. Extend scripts/verify-backend.mjs 'Public visibility flags' to assert the REST shape, not just publicData.

**Sources:** learn-map

## 16. [P1 · missing] No Program view switcher between All Submissions / Abstracts / Sessions — swyx's canonical distinction and our own IA in AGENTS.md, with no way to isolate confirmed sessions.

**Evidence:** VERIFIED `grep -n kind src/routes/app/submissions/index.tsx` matches only line 615 (the delete dialog); validateSearch accepts status/q/track/id only. `submissions.kind` exists in convex/schema.ts and is rendered as row subtext/badge (src/components/submissions/submissions-table.tsx:205-209 'Session · …' / 'Abstract · …') but cannot be filtered. The toolbar's single filter is Track (index.tsx:404-440) and STATUS_TABS are the seven pipeline statuses only. The sidebar exposes one flat 'Submissions' entry (VERIFIED in NAV_GROUPS). A judge told 'show me the confirmed sessions' cannot isolate them.

**Fix:** Add `kind?: 'all'|'abstract'|'session'` to validateSearch in src/routes/app/submissions/index.tsx, render it as a SegmentedControl (src/components/interior/segmented-control.tsx) above the status tabs using links so it stays URL-addressable, filter alongside the existing track filter, and add kind counts to convex/submissions.ts:counts. Optionally add Program sub-links (/app/submissions?kind=abstract | ?kind=session) to the sidebar group.

**Sources:** matrix-1, video

## 17. [P1 · missing] Portal FORMS are dead schema — tasks declare kind 'form' and a formId, but no organizer can create one and no portal surface renders one. The brief has a 5-screenshot 'Portal > Forms' section.

**Evidence:** convex/schema.ts tasks declares `kind: v.string() // profile | headshot | upload | form | confirm` and `formId: v.optional(v.id('forms'))`, but src/components/dashboard/assign-task-dialog.tsx:48 TASK_KINDS offers only upload/profile/headshot/confirm. `grep -rn 'kind === "form"|formId' src/components/portal/ src/components/dashboard/assign-task-dialog.tsx` → 0 hits; src/components/portal/task-item.tsx:45-47 branches only on upload/headshot/confirm/profile. The schema field is unreachable from any route. The related confirmation-email config (brief 08-portal-forms-confirmation-email) has nothing to attach to.

**Fix:** Add a `form` entry to TASK_KINDS with a form picker (reuse api.forms.list) in assign-task-dialog.tsx; render the selected form's questions inside src/components/portal/task-item.tsx using the existing public renderer from src/components/submit/; persist via a new convex/portal.ts:submitTaskForm that marks the task complete, and queue a `portalFormConfirmation` template from it behind a per-task 'Send a confirmation when they submit' toggle. Alternatively delete kind 'form' + formId from convex/schema.ts so nothing dangles.

**Sources:** matrix-2

## 18. [P2 · missing] No CSV/spreadsheet import for sessions — an organizer moving 40 sponsor sessions off a spreadsheet must use the one-at-a-time Add submission drawer. The Options menu is expected to carry 'Import Sessions'.

**Evidence:** VERIFIED the Options dropdown (src/routes/app/submissions/index.tsx:443-470) contains only Export all submissions (CSV), Export this view (CSV), Deleted submissions, Manage submission forms. `grep -rIn 'Import\b' src --include='*.tsx'` matches only prose in the design-system/interactions catalog; no importSessions/CSV-parse mutation exists in convex/. The only bulk-create paths are the REST API (convex/apiV1.ts) and MCP (convex/mcp.ts) — both developer surfaces, wrong for the non-technical organizer this product targets. Airtable sync is an ongoing mirror, not a one-shot import.

**Fix:** Add an 'Import sessions (CSV)' item to the Options menu opening a paste/upload drawer that maps columns to title/description/track/format/level/language/tags/speaker name+email, previews parsed rows, then calls a new convex/submissions.ts `importRows` (reuse the validation in submissions.ts:create and the person-upsert in convex/submit.ts). Use the header names from src/components/submissions/export-csv.ts so an exported file round-trips. Ships cheaply after the speakers importer above. XLSX is safely skippable — CSV opens in Excel.

**Sources:** matrix-1, video, learn-map

## 19. [P2 · partial] The public speakers directory hard-codes 'Roles: speaker' under every session for every participant, so panel moderators and chairpersons are mislabelled on a public page.

**Evidence:** src/components/public/speaker-gallery.tsx:167 renders a literal `Roles: speaker` string. convex/publicData.ts:345-395 (the `speakers` query) never reads submissionParticipants.role even though convex/schema.ts:354 stores role (speaker | chairperson | moderator). Live: curl '/e/ai-summit-2026/speakers?view=list' prints 'Roles: speaker' for all 19 entries, moderators included.

**Fix:** Return the participant role from convex/publicData.ts `speakers` (join submissionParticipants when building each row's sessions[]) and render the real capitalized role in speaker-gallery.tsx — or drop the line entirely when the role is plain 'speaker'. Fifteen-minute fix on a page the EMB items are graded against.

**Sources:** rubric-2

## 20. [P2 · missing] ABS-04 (w1, depth): scoring criteria carry no weights, so the per-submission aggregate cannot reflect weighting (Originality 2 / Relevance 1 → ~3.33 rather than 3.0).

**Evidence:** VERIFIED convex/schema.ts:370 criterion is {id, label} only. convex/evaluationsAdmin.ts:31-44 computes a plain unweighted mean (scores.reduce(...)/scores.length); `grep -rn weight convex/evaluationsAdmin.ts` → 0 hits. src/components/evaluation/new-plan-dialog.tsx:341-366 renders one label input per criterion with no weight control.

**Fix:** Add `weight: v.optional(v.number())` (default 1) to the criterion validator in convex/schema.ts and evaluationsAdmin's criterionValidator, apply it in the averaging helper at evaluationsAdmin.ts:31-44 and in scoresBySubmission (the aggregate the submissions table sorts on), add a small numeric input per criterion row, and label the column 'Weighted avg' when any weight ≠ 1. Best shipped in the same edit as the ABS-03 criterion-type change since it touches the same validator.

**Sources:** rubric-1, matrix-2

## 21. [P2 · missing] ABS-09 (w1, bulk): no way to bulk-remind reviewers with outstanding reviews — the evaluation UI's only 'nudge' is static copy with no action attached.

**Evidence:** convex/comms.ts has remindIncompleteSpeakers (line 794) and queueTaskReminders (237) only — both walk the `tasks` table and target `people`; nothing targets the `evaluators` table, whose only send path is the initial magic link. The seeded template set (convex/lib/email.ts:58-177) has confirmation/accepted/declined/waitlisted/reminder with no reviewer variant. src/components/evaluation/evaluators-table.tsx exposes remove/rotate-token only; the sole nudge string is static copy at src/routes/app/evaluation/$planId.tsx:212 ('Past due — nudge your evaluators').

**Fix:** Add `remindOutstandingEvaluators({planId})` to convex/comms.ts mirroring remindIncompleteSpeakers (reuse REMINDER_DEDUPE_MS, address by evaluator email + review-token URL, land it in the Outbox), add a 'reviewer_reminder' template to convex/lib/email.ts, and wire a per-row 'Send reminder' plus a bulk 'Remind N evaluators' button beside the $planId.tsx progress meter.

**Sources:** rubric-1, matrix-2, video

## 22. [P2 · missing] ABS-12 (w1, depth): no conflict-of-interest / recusal control for reviewers, and no organizer-side Conflicts view. ABS-S3 step 4 looks for Declare conflict / Recuse / Cannot review.

**Evidence:** `grep -rn 'conflictOfInterest|recus|\bcoi\b' convex/ src/` → 0 hits; the only 'conflict' matches are agenda room/speaker scheduling conflicts (convex/apiV1.ts:2036, convex/mcp.ts computeConflicts) and Airtable sync conflicts. convex/review.ts exposes queue, progress, submitScores, clearScores only; the evaluations table (convex/schema.ts:389) has scores/comment/completedAt with no recusal flag.

**Fix:** Add `recusedAt: v.optional(v.number())` + optional reason to `evaluations` (or a recusals table), a convex/review.ts `recuse({token, submissionId, reason})` mutation that drops the item from the queue's outstanding count (review.ts:49 queue, :152 progress), and an 'I have a conflict — skip this one' control on the /review/$token scoring card, with recused items shown greyed in the organizer's plan detail.

**Sources:** rubric-1, matrix-2, video

## 23. [P2 · partial] Evaluator management depth: no Tags/expertise tab for routing, and the evaluators table lacks per-evaluator Status and Assigned Rounds columns.

**Evidence:** VERIFIED convex/schema.ts:378-387 evaluators = planId/eventId/email/name/token only; `grep -rn 'evaluatorTag|expertise' convex/ src/` → 0 hits. src/routes/app/evaluation/index.tsx:31 TABS = ['summary','plans','evaluators'] — no tags tab. src/components/evaluation/evaluators-table.tsx:73-83 renders Evaluator, Plan (conditionally), Progress, Last scored, Actions; line 113 shows the PLAN's status pill, not the evaluator's invite/active state, and `round` lives on the plan and is never surfaced per evaluator.

**Fix:** Add `tags: v.optional(v.array(v.string()))` to the evaluators table with a tag column + filter chips in evaluators-table.tsx, and add derived Status (invited / active / no reviews yet, from lastUsedAt + evaluation rows) and Rounds columns via convex/evaluationsAdmin.ts:listEvaluators. Highest value is using tags to filter the ABS-06 auto-distribute.

**Sources:** matrix-2, video

## 24. [P2 · degraded] ABS-13 (w2, side-effect): score/status export exists but is unreachable from the review or results context, so an agent working there is likely to record absence.

**Evidence:** src/routes/app/submissions/index.tsx:449-462 offers 'Export all submissions (CSV)' / 'Export this view (CSV)' and src/components/submissions/export-csv.ts:37-58 does include 'Average score' and 'Reviews' columns — so the data ships. But grepping csv/export across src/routes/app/evaluation/*.tsx and src/components/evaluation/*.tsx returns only unrelated `export const` declarations: neither /app/evaluation nor /app/evaluation/$planId has any export control.

**Fix:** Add an 'Export results (CSV)' button to src/routes/app/evaluation/$planId.tsx emitting one row per submission with per-criterion scores, per-evaluator completion and the aggregate, reusing downloadCsv from src/components/submissions/export-csv.ts. Cheapest partial: link the submissions export from the evaluation summary.

**Sources:** rubric-1

## 25. [P2 · degraded] SPK-06 (w2, side-effect): the per-speaker invite control is a bare mailto: that sends nothing and logs nothing; there is no invite/welcome template for an agent to recognise. The bulk half is solid.

**Evidence:** Bulk works well: convex/comms.ts:709 composeBulk with an all_speakers filter, {{portalLink}} merge field, per-recipient preview and Outbox logging. Per-speaker, the row menu in src/components/dashboard/speakers-table.tsx:277-312 offers Edit profile / Copy portal link / Open their portal / Assign a task / 'Email <name>' — and that last item is a plain mailto: link at lines 306-308. The seeded template set (convex/lib/email.ts:58) has no invite/welcome template.

**Fix:** Add a 'portal_invite' template to convex/lib/email.ts and a 'Send portal invite' item to the speakers-table row menu and speaker-profile-drawer that calls comms.queueForPerson with it, so the send lands in the Outbox with a success toast — replacing or supplementing the mailto: item.

**Sources:** rubric-1

## 26. [P2 · missing] SPK-15 (w1, depth): speaker records cannot store travel-preference or custom logistics fields — SPK-S3 step 8 enters 'Arrival May 11, aisle seat; dietary: Vegetarian' and reloads.

**Evidence:** convex/schema.ts:259 `people` has salutation/pronouns/jobTitle/company/phone/bio/headshotId/headshotNote/links/portalToken/workflowStatus/publicVisible — `grep -n 'travel|dietary|logistics|customField' convex/schema.ts` → 0 hits, so there is no workaround path either. convex/speakersAdmin.ts:155 updateProfile has no such field, and src/components/dashboard/speaker-profile-drawer.tsx offers only name/title/company/bio/headshot-note/visibility. Settings → Fields & options configures submission value lists, not speaker fields.

**Fix:** Cheapest faithful fix: add `logistics: v.optional(v.string())` (or a v.record for keyed custom fields) to `people`, accept it in speakersAdmin.updateProfile, and render a 'Travel & logistics (internal)' textarea in speaker-profile-drawer.tsx next to the headshot note. Optionally collect it via a portal `confirm` task.

**Sources:** rubric-1, matrix-2

## 27. [P2 · partial] CNT-11 (w2, depth): change history has attribution + timestamps but no RESTORE, and the audit rows retain no prior values to restore from. CNT-S3 step 9 restores the version before the second edit.

**Evidence:** The attribution half is solid: convex/lib/audit.ts writes append-only rows with actor type + label, surfaced as the submission History tab and /app/settings/activity. The restore half is deliberately absent AND unbuildable from existing data — convex/lib/audit.ts:1-26 documents it as 'a change LOG, not a change STORE. Nothing here reconstructs an old document', and convex/submissions.ts updateDetails records only `meta: {fields, title}` with no before/after values. `grep -rn restore convex/audit.ts` → nothing; the only restore in the codebase is soft-delete undelete. Recorded as a deliberate deferral in docs/memory/HISTORY.md 61.

**Fix:** If reclaiming the point: store `before`/`after` for title+description in the audit meta at the convex/submissions.ts updateDetails call site (the write site already has the pre-patch doc; clampMeta truncates), then add a 'Restore this version' action on the History tab rows that re-applies the `before` values through updateDetails — which itself logs the restore. Otherwise leave as a documented trade.

**Sources:** rubric-1, matrix-2

## 28. [P2 · partial] Submissions table power controls absent: no Columns chooser, no Saved Views, and no optional columns for Notified / Scheduled time / Room / Client Session ID (which does not exist in the data model at all).

**Evidence:** `grep -rn 'Columns' src` matches only CSS gridTemplateColumns. The toolbar (src/routes/app/submissions/index.tsx:397-475) has search, a Track select and an Options dropdown; the header set is hard-coded in src/components/submissions/submissions-table.tsx:129-158 (Status, Title, Track, Format, Score, Speakers, Submitted) with sorting on three columns only. notifiedAt appears only in the detail drawer (submission-detail-drawer.tsx:362) and the CSV (export-csv.ts:105); scheduled time/room only in the drawer (579-583). `grep -rn 'savedView|clientSessionId|externalId' src convex` → 0 hits.

**Fix:** All filters already live in the URL, so the cheap wins are: (a) a 'Columns' DropdownMenu with checkbox items persisted as a `cols=` search param, driving <TableHead>/<TableCell> in submissions-table.tsx, exposing Notified / Scheduled / Room as optional columns; (b) a 'Save this view' / 'Copy link to this view' affordance (localStorage or a small savedViews table). Add `clientSessionId` (plus Capacity, which already exists at convex/schema.ts:143, and Location) to the add/detail drawers only if a judge-visible need appears.

**Sources:** matrix-1, video

## 29. [P2 · missing] No email branding — outbound mail has no header/footer/theme and never carries the event logo that is already stored.

**Evidence:** `grep -rIn 'emailHeader|emailFooter|headerHtml|footerHtml|customCss|brandColor' src convex` → nothing. convex/lib/email.ts (207 lines) is a plain {{token}} text renderer whose only header/footer/logo match is the comment 'From: header' at line 197. Settings tabs are Event details / Rooms & tracks / Fields & options / Statuses / Integrations / API & MCP / Activity (src/routes/app/settings/route.tsx:25-43) — no Email Themes. events.logoId already exists (convex/schema.ts:112) and never reaches an email.

**Fix:** Add an 'Email branding' card to Settings → Event details (beside EventBrandingCard) writing events.emailHeaderHtml / emailFooterHtml (+ optional accent colour), and wrap every rendered body in convex/lib/email.ts / convex/comms.ts / convex/platformEmails.ts with it, defaulting the header to the event logo already in events.logoId.

**Sources:** matrix-1, video

## 30. [P2 · missing] Agenda has no settings: day start/end, slot interval, per-format default duration, which statuses appear, and room visibility are all hardcoded constants. Month view also absent.

**Evidence:** events has no agenda settings block (convex/schema.ts:95-137 — only portalSettings). Duration is constant: src/components/agenda/agenda-model.ts:23 DEFAULT_DURATION_MINUTES = 45; auto-place-dialog.tsx:34-35 DURATION_MINUTES = 45 / GAP_MINUTES = 15; convex/agenda.ts:369 `args.defaultDurationMinutes ?? 45`, :371 `dayStartHour ?? 9`. Interval is constant: src/components/agenda/agenda-time.ts:15 SLOT_MINUTES = 15, :20-21 GRID_START_HOUR 8 / GRID_END_HOUR 20. Formats exist only as options on a form question (convex/valueLists.ts), so there is no record to hang a per-format duration on. No Settings → Agenda tab. VIEWS = list/day/week/track/rooms/conflicts (src/routes/app/agenda/index.tsx:79) — Week and Track are built, only the video's Month tab is missing.

**Fix:** Add `events.agendaSettings { dayStartHour, dayEndHour, intervalMinutes, statuses[], visibleRoomIds[] }` plus a `formatDurations: Record<string, number>` map, read in agenda-time.ts (SLOT_MINUTES/GRID_*), agenda-model.ts (duration lookup by submission.format), convex/agenda.ts autoPlace defaults and the rooms/day/week column set; surface as a Settings → Agenda tab. Highest-value single piece: per-format default duration on drop ('dropping a Lightning Talk auto-sets 15 min'). Month view is low value for a multi-day conference — close as a deliberate trade.

**Sources:** learn-map, matrix-2

## 31. [P2 · partial] EMB-15 sub-criterion: the embed generator offers filter and field config but NO branding config, and ?embed=1 strips the event identity with no way to keep it.

**Evidence:** src/routes/app/embeds/index.tsx exposes field toggles (descriptions/speakers/photos/search), a track filter and an iframe height — no branding control. src/components/public/widget-search.ts documents ?embed=1 as 'renders bare (no site header, no nav)', and curl of /e/ai-summit-2026?embed=1 confirms event name, dates, venue and logo are all stripped. Event branding exists but only in Settings → Event branding and never reaches an embed.

**Fix:** Add a `showHeader` (and optionally `accent`) flag to WidgetSearch in src/components/public/widget-search.ts, honour it in src/components/public/public-shell.tsx (render the compact event header + logo when set), and surface it as a 'Show event header & logo' switch in the Display options block of src/routes/app/embeds/index.tsx so it round-trips through EmbedOptions and saved embeds. Ship with the nav fix above.

**Sources:** rubric-2

## 32. [P2 · partial] Participant configuration depth: per-role Min/Max only exists for Speaker, with no chairperson/moderator limits, no total-across-roles, no conditional rules, and no exposed unique-contact toggles.

**Evidence:** src/components/forms-builder/steps/participants-step.tsx:68-107 has Minimum/Maximum speaker inputs; lines 134-142 give Chairperson and Moderator plain enable Switches only. forms.participantConfig (convex/schema.ts:237-244) carries speakerMin, speakerMax, chairpersonEnabled, moderatorEnabled — no per-role min/max, no total, no rules array. The correctness half IS fixed: convex/submit.ts:132-146 profilePatch in 'existing-contact' mode only fills blanks, and :485-505 emails every speaker on the proposal — but neither policy is configurable.

**Fix:** Extend participantConfig to `{ roles: { speaker|chairperson|moderator: {min,max,enabled} }, totalMin, totalMax, rules: [{when, then, totalOverride}], allowExistingContactOverwrite, notifyExistingContacts }`; enforce in convex/submit.ts::upsertParticipants (first matching rule wins) and mirror the counts in the CFP participants step; gate profilePatch's existing-contact branch on allowExistingContactOverwrite.

**Sources:** matrix-1, learn-map

## 33. [P2 · partial] Form-builder parity remainder: no Abstract Information section heading/instructions, no US-vs-International phone input type, no multi-language switch for submitters.

**Evidence:** Wizard STEPS (src/routes/app/forms/$formId.tsx:45-75) are Setup, Welcome screen, Submission questions, Participants, Form settings, Notifications; `pageHeading` exists only on the welcome screen (convex/schema.ts:234) and `instructions` only on tasks (407, 423). src/components/forms-builder/question-editor-drawer.tsx offers label / answer type / helper text / example / character limit / options — a case-insensitive grep for 'phone' in that file returns nothing. `grep -rIn 'multiLanguage|translat|i18n|locale' src convex` (excluding toLocale*/localeCompare) returns only Tailwind classes and the date-picker's locale prop; forms.settings (convex/schema.ts:246-252) has no language field. (The per-submission 'Language' dropdown at convex/forms.ts:56 is metadata about the talk, not UI translation.)

**Fix:** Add optional questionsHeading/questionsInstructions to the form doc (convex/schema.ts + convex/forms.ts), edited atop src/components/forms-builder/steps/questions-step.tsx and rendered above the question list in src/components/submit/submission-step.tsx. Add a `phoneFormat: 'us'|'international'` sub-option when question.type === 'phone', used for the mask/placeholder in src/components/submit/question-field.tsx. Multi-language is the weakest of the three — either add forms.settings.languages with a per-language override map for labels/help/welcome copy, or declare it an explicit non-goal in docs/SPEC.md.

**Sources:** matrix-1, video

## 34. [P2 · partial] Portal profile depth: bio is a plain textarea (not rich text) and the field/link set is short — no honorific, gender, address, or Facebook link.

**Evidence:** src/components/portal/profile-editor.tsx:158-173 renders a plain <textarea> with a character counter; LINK_FIELDS at line 50 is ['linkedin','twitter','website']. `grep -n 'honorific|gender|address|facebook' convex/schema.ts src/components/portal/profile-editor.tsx` matches only salutation/pronouns (schema.ts:264-265).

**Fix:** Add honorific, gender, address and links.facebook to `people` in convex/schema.ts and to portal.updateProfile's patch validator, extend LINK_FIELDS and the editor fields; swap the bio textarea for the existing rich-text field (src/components/forms-builder/rich-text-field.tsx) only if organizer-side rendering is HTML-safe.

**Sources:** matrix-1

## 35. [P2 · missing] No session duplicate and no event clone — an organizer whose sponsor buys two identical slots has to retype the session.

**Evidence:** convex/submissions.ts exports list, counts, get, setStatus, setStatusInternal, bulkSetStatus, commitQueue, addManual, updateDetails, remove, restore, listDeleted, exportData — no duplicate. No clone/copy mutation in convex/events.ts. Only convex/forms.ts has a duplicate. The bulk bar has no 'More → Duplicate' and bulkSetStatus is status-only (no generic bulk field edit).

**Fix:** Add `submissions.duplicate` (copy title + '(copy)', answers, track/format/level/language/tags; reset status to pending; clear statusId/decidedAt/notifiedAt/roomId/startsAt; copy participants; skip uploads) wired to the row ⋯ menu and the bulk More menu, with an auditLog row. Event clone can wait.

**Sources:** learn-map

## 36. [P2 · missing] No duplicate-contact merge — the same human submitting under work and personal addresses creates two unreconcilable people rows.

**Evidence:** `grep -rn 'mergeDup|mergePeople|merge duplicate' convex src` → no matches. `people` is keyed by (eventId, email) via by_eventId_and_email with no merge path. The demo deployment already carries near-duplicate rows from repeated e2e runs (several 'Tria Ger' rows on ai-summit-2026 with different addresses) — the same pollution flagged as the P0 release-gate item above.

**Fix:** Add a `speakersAdmin.findDuplicates` query (normalised-name equality or Levenshtein ≥0.7, plus email local-part match) surfaced as a 'Possible duplicates (n)' banner on the roster, and a `merge` mutation repointing submissionParticipants / submissions.submitterId / tasks / uploads / messages to the primary, keeping the primary's non-blank fields, deleting the loser, writing one auditLog row.

**Sources:** learn-map

## 37. [P2 · missing] No 'View portal as…' read-only impersonation from the top bar — mitigated, since the speaker drawer already deep-links to the real portal.

**Evidence:** `grep -rn 'viewAs|impersonat' src convex` returns only two comments explicitly declining it (src/components/dashboard/speaker-profile-drawer.tsx:11, convex/speakersAdmin.ts:153). Mitigation that keeps this off P1: speaker-profile-drawer.tsx:323 links `/portal/t/${speaker.portalToken}`, so a browser-agent judge CAN reach any speaker's portal in two clicks. What's missing is only the read-only framing and the top-bar entry point.

**Fix:** Cheapest useful version: keep the existing per-speaker link and add `?as=organizer`, which shows a banner ('Viewing Priya's portal as an organizer — actions are disabled') and short-circuits completeTask/attachUpload/profile save in convex/portal.ts when the caller also presents an organizer session. Add the same entry to the top-bar View Portal control.

**Sources:** learn-map

## 38. [P2 · missing] CRM area (CRM-01…CRM-12, 12 items / 19 EXTRA-CREDIT points): no org-level cross-event contact directory, filters, notes, custom fields, contact CSV import, merge, sourcing kanban, segments, push-to-event, bulk email or CRM dashboard.

**Evidence:** convex/schema.ts has organizations/members/events but `people` is event-scoped (eventId + by_eventId, schema.ts:259-302); there is no contacts/pipeline/segments/notes table. No route matches contacts/crm/pipeline under src/routes (full listing verified). `grep -rn 'crossEvent|directory|contacts' src/routes/app/ convex/` finds only REST scope strings ('read:contacts' in convex/apiRoutes.ts). Multi-event DOES exist (/app/events, 2 demo events), so the prerequisite is in place and unused. The brief marks CRM as bonus and swyx scoped the column out.

**Fix:** Only if time remains after the required 100 — this is outside them. Cheapest meaningful slice: an org-scoped `contacts` table (name/email/company/title/tags/notes + sourcedFrom event ids) with (a) /app/contacts directory + search and company/title/tag filters, (b) CSV import (reuse the speakers importer), (c) an 'Add to this event' action copying a contact into `people` (CRM-10), (d) a stage field rendered as a 4-column kanban. That reaches CRM-01/02/03/04/05/07/10.

**Sources:** rubric-2, matrix-2

## 39. [P2 · missing] Backlog, correctly deferred and verified not-started: L11 Program Site · L15 field-level role permissions · L16 Reports module · L17 rooms-view zoom/axis flip · L18 Additional Contacts · L20 headshot restrictions + bulk resize · L21 email-template Type scoping · L22 live 'N matches' counters + rubric validator · L23 subsessions.

**Evidence:** Spot-checked each: no /site or program-index route in src/routes (only /submit/$slug and /review/$token); members carries no per-field permission or filter scope; no reports route or query; agenda tabs are List/Day/Week/Track/Rooms/Conflicts with no zoom/axis control; people has no additionalContacts relation; no headshot dimension enforcement in convex/lib/files.ts; emailTemplates has key/name/subject/body but no `type` scope (convex/schema.ts:479-488); no match-count banner in new-plan-dialog.tsx; no parent/child fields on submissions.

**Fix:** Do NOT build as a block. Two are cheap enough to be worth pre-deadline: L22 (a live 'N matches' count under the evaluation plan filter and the embed filter, plus a weight-sum banner once ABS-04 weights exist — under an hour, and exactly the legibility non-technical organizers need) and L21 (add emailTemplates.type contacts|sessions and filter the merge-tag palette + compose picker by it, killing the blank-{{sessionTitle}} bug class). Leave L11/L15/L16/L17/L18/L20/L23 on the backlog.

**Sources:** learn-map
