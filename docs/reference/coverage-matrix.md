# Coverage matrix — adversarial audit vs everything swyx said

**Run:** 2026-08-11 · **Auditor:** independent `google/gemini-3.6-flash` via
`opencode run` (repo cwd, read+bash+webfetch tools, live app on `localhost:3000`),
orchestrated + spot-checked by Claude. Default verdict was MISSING; docs (SPEC.md,
TODO.md, AGENTS.md) were explicitly disallowed as evidence — only `src/`, `convex/`
and live HTTP responses counted.

**Sources merged into the checklist**
- `docs/video/requirements_audit.md` — fresh adversarial video pass (60 numbered items,
  EXPLICIT-REQUIREMENT / SHOWN-IN-PRODUCT / OFFHAND-PREFERENCE / SCOPE-EXCLUSION),
  generated this run from https://youtu.be/vUuK4Knl7oc.
- `docs/video/master.md`, `actions.md`, `ui_fidelity.md` — screen/label/geometry detail.
- `docs/reference/brief.md` (9 numbered features + bonus rules), `swyx-clarifications.md`.
- `docs/reference/sbek-rubric.md` — all 98 rubric ids (CFP/ABS/SPK/CNT/AIA/EMB/CRM).

## Headline

| | Count | Share |
|---|---|---|
| **Total items** | **175** | |
| COVERED | **124** | 71% |
| PARTIAL | **19** | 11% |
| MISSING | **31** | 18% |
| CANNOT-VERIFY (needs browser) | **1** | <1% |

Coverage is strong exactly where the video spends its time (form builder, public CFP,
submissions pipeline, speaker portal, agenda, public widgets — the widget area that the
sbek digest called "0 of 16 covered" is now essentially all built). The residual gaps
cluster in three places: **side-effect emails that are configured but never fire**,
**evaluation depth (blind/weights/COI/per-reviewer assignment)**, and **event-settings
fidelity items swyx showed on screen** (logo upload, exhibitors/sponsors, email themes).

**Severity legend** — impact on judging:
`S1` = an explicit brief requirement or a sbek `rule`/`scoping`/`handoff` item; a judge
will notice. `S2` = a surface swyx demoed on screen; an evaluator hunting for it fails.
`S3` = fidelity/depth detail. `S4` = offhand / optional / bonus.

## Full matrix

| # | Item | Source | Verdict | Evidence | Missing / notes |
|---|---|---|---|---|---|
| 1 | Event Details settings page: Event Name, Slug, Type, Website URL, Timezone, Starts At, Ends At, Description/Theme. | V6, VID 02:43, SPEC 4.1 | **COVERED** | `src/components/settings/event-details-form.tsx:EventDetailsForm` |  |
| 2 | Location/Venue field on event details. | V6 | **COVERED** | `src/components/settings/event-details-form.tsx:EventDetailsForm` |  |
| 3 | Logo image upload + Background image upload on event settings. | V8, VID 02:50 | **MISSING** | searched `src/routes/app/settings/` & `src/components/settings/` | No image upload controls for logo or background in event settings UI |
| 4 | Exhibitors & Sponsors toggles on event settings. | V7 | **MISSING** | searched `src/routes/app/settings/` & `src/components/settings/` | No Exhibitors & Sponsors toggles found in settings |
| 5 | Settings sub-navigation covering: Event Details, Portals, Submission Forms, Email Templates, Integrations. | V9 | **PARTIAL** | `src/routes/app/settings/route.tsx:TABS` | Settings sub-nav has Event details, Rooms & tracks, and API & MCP, but lacks Portals, Submission Forms, Email Templates, and Integrations tabs |
| 6 | Email Templates list/table with Name, Subject, Category, Trigger columns. | V10, SPEC 4.9 | **PARTIAL** | `src/components/comms/template-list.tsx:TemplateList` | Rendered as template cards showing Name, Key, Subject, and Trigger ("When") description, but missing an explicit Category column |
| 7 | Custom HTML/CSS email header/footer editor (email theme). | V11 | **MISSING** | searched `convex/lib/email.ts` & `src/components/comms/` | No custom HTML/CSS email header/footer editor or email theme builder |
| 8 | Rooms & Tracks manager: add/rename/delete rooms (capacity, order) and tracks (color). | SPEC 4.1, SBEK AIA-02 | **COVERED** | `src/components/settings/rooms-card.tsx:RoomsCard`, `src/components/settings/tracks-card.tsx:TracksCard` |  |
| 9 | Dashboard top metric cards: Submissions, Accepted Speakers (+Exhibitors/Sponsors equivalent). | V12 | **PARTIAL** | `src/routes/app/index.tsx:147-171` | Submissions and Accepted Speakers cards exist, but Exhibitors/Sponsors metric card is absent |
| 10 | Dashboard submission status counters: Accepted, Pending, Declined, Drafts, Withdrawn. | V13 | **COVERED** | `src/components/dashboard/status-count-bar.tsx:StatusCountBar` |  |
| 11 | Dashboard Submission Pacing chart (time series vs event date / T-minus). | V14 | **COVERED** | `src/components/dashboard/pacing-chart.tsx:PacingChart` |  |
| 12 | Dashboard "Your Forms" widget: active forms, entry counts, View/Manage buttons. | V15 | **COVERED** | `src/components/dashboard/forms-card.tsx:FormsCard` |  |
| 13 | Dashboard "Today"/greeting header + sub-tabs (Today, Review Progress, Speaker Tracking, Submissions Pipeline). | VID master 03:11, brief screenshots 10-* | **PARTIAL** | `src/routes/app/index.tsx:68-122` | Greeting header is present, but sub-tabs (Today, Review Progress, Speaker Tracking, Submissions Pipeline) are missing |
| 14 | Real-time dashboard of speakers with outstanding onboarding tasks (brief requirement #6). | BRIEF 6, SPEC 4.8 | **COVERED** | `src/components/dashboard/top-speakers-card.tsx:TopSpeakersCard` |  |
| 15 | Dashboard insight/alert rows (e.g. "N accepted speakers missing bio or headshot" → link). | SPEC 4.8, brief 10-dashboard-alerts | **COVERED** | `src/routes/app/index.tsx:189-207` |  |
| 16 | Speed: no full-page spinners, fast navigation — swyx's #1 complaint. | V21, VID 04:11, BRIEF bonus | **CANNOT-VERIFY** | requires interactive browser | Needs live browser measurements to verify transition speed and lack of spinners |
| 17 | Multi-event support: create ≥2 events, list/switcher in UI. | SBEK CFP-17, RULES 23a | **COVERED** | `src/components/shell/event-switcher.tsx:ShellEventSwitcher` |  |
| 18 | Cross-event data scoping: one event's submissions/speakers don't leak into another. | SBEK CFP-18 | **COVERED** | `convex/lib/auth.ts:requireEventAccess` |  |
| 19 | Organizer authentication (login) exists and gates /app. | SPEC, RULES 18c | **COVERED** | `src/routes/app/route.tsx:beforeLoad` |  |
| 20 | Workspace/organization layer: rename org, invite/remove members, roles, workspace switcher. | RULES 18g/23c | **COVERED** | `convex/workspaces.ts`, `src/routes/app/workspace.tsx` |  |
| 21 | Unified submissions table with status filter tabs: All, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, Drafts. | V19, VID 03:39 | **COVERED** | `src/components/submissions/constants.ts:12` | Status tabs strip includes All, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, and Drafts with live counts. |
| 22 | Program view switcher between All Submissions / Abstracts / Sessions. | V16 | **MISSING** | `src/routes/app/submissions/index.tsx` | No view switcher control between All Submissions / Abstracts / Sessions found. |
| 23 | Table columns incl. Status, Source (manual/form), Title, Client Session ID, Description, Starts At, Ends At, Speakers, Rating/score, Notified. | V17 | **PARTIAL** | `src/components/submissions/submissions-table.tsx:114` | Submissions table includes Status, Source (under Title), Title, Track, Format, Rating/score, Speakers, and Submitted, but lacks columns for Client Session ID, Description, Starts At, Ends At, and Notified. |
| 24 | Column chooser ("Columns") control. | VID toolbar, brief 05-abstracts-review-column-chooser | **MISSING** | `src/routes/app/submissions/index.tsx` | No Column chooser ("Columns") control implemented. |
| 25 | Sort control on the submissions table. | VID toolbar | **COVERED** | `src/components/submissions/submissions-table.tsx:116` | Table column headers contain sort controls for Title, Score, and Submitted date. |
| 26 | Filter control on the submissions table. | VID toolbar | **COVERED** | `src/routes/app/submissions/index.tsx:388` | Toolbar includes status filter tabs and track filter dropdown. |
| 27 | Saved Views dropdown. | VID toolbar | **MISSING** | `src/routes/app/submissions/index.tsx` | No Saved Views dropdown found. |
| 28 | Search input over submissions. | VID toolbar | **COVERED** | `src/routes/app/submissions/index.tsx:383` | Search input filters submissions by title, description, track, format, and speaker details. |
| 29 | "+ Add Abstract"/"+ Add Submission" slide-over drawer for manual entry with fields Title, Status, Description, Starts At, Ends At, Capacity, CEU Credits, Client ID, Format, Language, Level, Track, Location, Tags. | V18, VID master 03:43 | **PARTIAL** | `src/components/submissions/add-submission-drawer.tsx:197` | Slide-over drawer exists with Title, Status, Description, Track, Format, Level, Language, Tags, and Speakers, but lacks Starts At, Ends At, Capacity, CEU Credits, Client ID, and Location fields. |
| 30 | Options menu: Import Sessions, Export CSV, Export XLSX, Download files bundle. | V20 | **PARTIAL** | `src/routes/app/submissions/index.tsx:430` | Options menu contains Export CSV, but lacks Import Sessions, Export XLSX, and Download files bundle. |
| 31 | Inline status editor on a row (pill → picker with Save/Cancel). | brief 05-abstracts-review-status-editor, SPEC 4.4 | **COVERED** | `src/components/submissions/status-picker.tsx:45` | Table rows feature inline status picker with status options, optimistic preview, and Save/Cancel buttons. |
| 32 | Row click → detail drawer with Details / Participants / Evaluations tabs. | SPEC 4.4 | **COVERED** | `src/components/submissions/submission-detail-drawer.tsx:223` | Clicking row title opens detail drawer with Details, People (Participants), Reviews (Evaluations), and Files tabs. |
| 33 | Bulk select → move to Accept Queue / Decline Queue. | SPEC 4.4 | **COVERED** | `src/components/submissions/bulk-bar.tsx:51` | Bulk selection bar allows moving selected items to Accept Queue, Decline Queue, or Pending. |
| 34 | Queue commit action ("N staged — Send decisions") that fires emails and flips statuses. | SPEC 4.4 | **COVERED** | `convex/submissions.ts:175` | Queue banner and `commitQueue` mutation commit staged decisions, flip statuses, and queue emails. |
| 35 | Accept/Reject recorded and list reflects distinct statuses. | SBEK CFP-12 | **COVERED** | `convex/submissions.ts:135` | Status changes persist in Convex database and update table views. |
| 36 | Decision status propagates to speaker's own portal dashboard. | SBEK CFP-13 | **COVERED** | `src/components/portal/submission-card.tsx:68` | Speaker portal fetches and renders submission decision status on cards. |
| 37 | Accepted submission becomes an agenda session with title/speaker/track intact (no re-entry). | SBEK CFP-15 | **COVERED** | `convex/agenda.ts:111` | Accepted submissions become schedulable agenda items with title, speakers, and track preserved. |
| 38 | Submitted form fields round-trip intact to the organizer's view. | SBEK CFP-06 | **COVERED** | `src/components/submissions/submission-detail-drawer.tsx:485` | Custom form answers are saved in submission record and displayed under Form Answers in detail drawer. |
| 39 | Organizer can edit session title/abstract from admin and it persists. | SBEK CNT-09 | **COVERED** | `convex/submissions.ts:377` | `updateDetails` mutation persists title and description updates from admin detail drawer. |
| 40 | Review scores/statuses exportable (CSV/XLSX). | SBEK ABS-13 | **PARTIAL** | `src/components/submissions/export-csv.ts:41` | CSV export includes review scores and status columns, but XLSX format export is not implemented. |
| 41 | Forms list page with form cards: name, type badge, Open/Closed badge, submission count, close date. | VID 04:28, SPEC 4.2 | **COVERED** | `src/components/forms-builder/form-card.tsx:FormCard` | Implemented with submission count, name, type badge, status pill, and close date. |
| 42 | "Copy public link" directly on each form card (swyx hunted for this). | SPEC UX law 8, VID 04:00 friction | **COVERED** | `src/components/forms-builder/form-card.tsx:113` | `<CopyLinkButton slug={form.slug} size="sm" />` rendered on every form card. |
| 43 | "+ Add" / "Create Form" entry point. | VID 04:28 | **COVERED** | `src/routes/app/forms/index.tsx:108` | `newFormLink` button in `PageHeader` linking to `/app/forms/new`. |
| 44 | Multi-step form builder wizard with left step rail. | V22, VID B | **COVERED** | `src/routes/app/forms/$formId.tsx:45` | `WizardShell` component provides a multi-step form builder with left step rail. |
| 45 | Step: Submission Setup — submission type selector Abstracts vs Sessions (and Participants inclusion). | V23 | **COVERED** | `src/components/forms-builder/steps/setup-step.tsx:46` | RadioGroup selector for Abstracts vs Sessions (`FORM_KINDS`). |
| 46 | Step: Welcome Screen — Internal Form Name, External Form Title, Page Heading, Welcome Message rich text + "Show message" toggle. | V24 | **COVERED** | `src/components/forms-builder/steps/welcome-step.tsx:40` | Form includes internalName, externalTitle, pageHeading, welcomeMessage rich text, and showWelcomeMessage toggle. |
| 47 | Step: Abstract Information — Section Title, Page Heading, Description & Instructions. | ui_fidelity B3 | **MISSING** | searched `src/` & `convex/` for abstract section title/description fields | No dedicated Abstract Information step or section title / instructions fields in form builder. |
| 48 | Abstract question list with default fields Title, Description, Format, Tags, Track, Level, Language. | V25 | **COVERED** | `convex/forms.ts:48` | `defaultQuestions()` initializes Title, Description, Format, Track, Level, Language, Tags. |
| 49 | Per-question Required toggle AND Enabled toggle. | V25, ui_fidelity B3 | **COVERED** | `src/components/forms-builder/question-row.tsx:165` | Per-question Required toggle (line 165) and Enabled toggle (line 175) on each row. |
| 50 | Per-question edit (pencil/gear) opening field editor: Custom Label, Help Text, Character Limits, Input Type (e.g. US vs International phone). | V29 | **PARTIAL** | `src/components/forms-builder/question-editor-drawer.tsx:60` | Drawer supports Custom Label, Help Text, Character Limits, and Input Type; US vs International phone option absent. |
| 51 | Locked system fields (Title/Description; First/Last/Email) that cannot be removed. | ui_fidelity B4 | **COVERED** | `convex/forms.ts:50` | Title, Description, First Name, Last Name, Email set with `locked: true` and cannot be deleted or disabled. |
| 52 | Add new custom question with multiple field types (short text, long text, dropdown, multi-select, email, url, phone, checkbox, file). | SPEC 4.2, SBEK CFP-01 | **COVERED** | `src/components/forms-builder/model.ts:98` | `QUESTION_TYPES` includes short text, long text, dropdown, multi-select, email, url, phone, checkbox, file, rich text. |
| 53 | Drag-to-reorder questions. | VID "drag-and-drop field list" | **COVERED** | `src/components/forms-builder/steps/questions-step.tsx:215` | Reordering powered by `@dnd-kit/core` and `@dnd-kit/sortable` in `QuestionsStep`. |
| 54 | Conditional logic: show/hide a question based on another answer. | BRIEF 1, SBEK CFP-02 | **COVERED** | `src/components/forms-builder/question-editor-drawer.tsx:348` | `showIf` rule builder in editor drawer and evaluation in `src/components/submit/form-logic.ts:46`. |
| 55 | Category/track-based routing from the form. | BRIEF 1, CLAR "single form w one or more track options" | **COVERED** | `convex/submit.ts:214` | Dropdown questions with `isTrackQuestion: true` resolve answers to submission `trackId`. |
| 56 | Step: Participant Information — roles Speaker/Chairperson/Moderator with per-role Min/Max inputs. | V26 | **PARTIAL** | `src/components/forms-builder/steps/participants-step.tsx:68` | Speaker min/max inputs present; Chairperson and Moderator have enable toggles only without min/max inputs. |
| 57 | Default speaker minimum = 1 (never trap the user with min 2). | V27, VID 06:48 | **COVERED** | `convex/forms.ts:63` | `speakerMin: 1` explicitly set in `defaultParticipantConfig()`. |
| 58 | "Send submission confirmation email" toggle on the participant/role config. | VID master 05:07 | **COVERED** | `src/components/forms-builder/steps/notifications-step.tsx:46` | Toggle for `participantConfig.sendConfirmationEmail` in `NotificationsStep`. |
| 59 | Participant fields: First Name, Last Name, Email, Mobile Phone, Biography (+ job title/company/headshot). | V28 | **COVERED** | `convex/forms.ts:68` | `defaultParticipantConfig()` fields include firstName, lastName, email, jobTitle, company, phone, bio, headshot. |
| 60 | Step: Payments & Fees — explicitly skippable/omitted. | V30 SCOPE-EXCLUSION | **COVERED** | `src/routes/app/forms/$formId.tsx:45` | Payments & Fees step is explicitly omitted from `STEPS` per scope exclusion. |
| 61 | Step: Form Settings — Close Date picker (real calendar). | V31, SPEC 4.2 | **COVERED** | `src/components/forms-builder/steps/settings-step.tsx:74` | Uses Popover with single-mode Calendar date picker and time select |
| 62 | "Send Reminder Email" toggle. | V31 | **COVERED** | `src/components/forms-builder/steps/settings-step.tsx:91` | Toggle setting bound to `draft.settings.sendReminderEmail` |
| 63 | "Set Submission Limit" (X per user for this form). | V31 | **COVERED** | `src/components/forms-builder/steps/settings-step.tsx:105`, `convex/submit.ts:363` | Per-user limit input stored in settings and enforced in backend submit query |
| 64 | "Allow multiple draft submissions" toggle. | V31 | **COVERED** | `src/components/forms-builder/steps/settings-step.tsx:135` | Toggle setting bound to `draft.settings.allowDrafts` and enforced in submit flow |
| 65 | "Auto-redirect to speaker portal" toggle. | V32 | **PARTIAL** | `src/components/forms-builder/steps/settings-step.tsx:158` | Setting toggle present in form editor and schema, but `src/routes/submit/$slug.tsx` does not auto-redirect on submission |
| 66 | "Customize the success page message" rich text. | V32 | **COVERED** | `src/components/forms-builder/steps/settings-step.tsx:148`, `src/components/submit/outcome-cards.tsx:57` | Rich text success message editor saved and displayed on confirmation card |
| 67 | Cross-field character limits setting. | VID master 05:33 | **MISSING** | Searched `src/components/forms-builder` and `convex/` | No cross-field character limits setting or rule builder found |
| 68 | Multi-language section/toggle (English only is fine, but the surface was shown). | V33 | **MISSING** | Searched `src/components/forms-builder` and `convex/schema.ts` | No multi-language section or toggle found in form editor or schema |
| 69 | Step: Notifications — which admins are notified on new submission AND on updated submission. | V34 | **COVERED** | `src/components/forms-builder/steps/notifications-step.tsx:77` | `EmailChipsInput` configures `notifyEmails` array for new and updated submission alerts |
| 70 | Save button persists the form; form appears in list with Open badge. | VID master 05:50 | **COVERED** | `src/routes/app/forms/$formId.tsx:192`, `src/routes/app/forms/index.tsx:160` | Form save button updates form via Convex mutation; forms list renders Open status badge |
| 71 | Public CFP reachable with no login, shows event branding/deadline/tracks/formats. | SBEK CFP-03 | **COVERED** | `http://localhost:3000/submit/cfp` | Public route accessible unauthenticated, rendering event title, deadline, tracks, and formats |
| 72 | Public CFP header banner: event title, submission deadline, remaining submission allocation. | V35 | **COVERED** | `http://localhost:3000/submit/cfp`, `src/components/submit/welcome-step.tsx:49` | Header card displays event title, deadline date/time, and submission allocation limit |
| 73 | Public 5-step tracker: Welcome → Account → Submission → Participant → Review. | V36 | **COVERED** | `http://localhost:3000/submit/cfp`, `src/components/submit/step-tracker.tsx:55` | 5-step stepper bar renders Welcome, Account, Submission, Participants, Review |
| 74 | Account step: email lookup → auth (magic code / passwordless preferred over password). | V37, ui_fidelity E | **COVERED** | `src/components/submit/account-step.tsx:81` | Passwordless email lookup returns portal token via `submit.identify` |
| 75 | Submission step fields: Title, rich Description, Format, Tags, Track, Level, Language. | V38 | **COVERED** | `src/components/submit/submission-step.tsx:40`, `src/components/submit/question-field.tsx:68` | Renders questions for Title, rich Description, Format, Track, Level, Language, etc. |
| 76 | Form action controls: "Save as draft", "Back", "Next step". | V39, SBEK CFP-07 | **COVERED** | `src/routes/submit/$slug.tsx:505`, `src/routes/submit/$slug.tsx:510`, `src/routes/submit/$slug.tsx:552` | Footer controls provide Back, Save as draft, and Continue buttons |
| 77 | Participants step: dynamic add co-speakers with roles and contact details/bio. | V40 | **COVERED** | `src/components/submit/participants-step.tsx:104`, `src/components/submit/participant-card.tsx:97` | Dynamic co-speaker addition with role selection, contact fields, and bio |
| 78 | Review step: read-only summary of everything before submit. | V41 | **COVERED** | `src/components/submit/review-step.tsx:73` | Read-only summary cards for Account, Submission, and Participants with Edit step links |
| 79 | Validation: red field outlines + toast "Missing required fields…". | ui_fidelity C | **COVERED** | `src/routes/submit/$slug.tsx:63`, `src/routes/submit/$slug.tsx:351`, `src/components/submit/question-field.tsx:76` | Highlights invalid fields with red borders and displays "Missing required fields…" toast |
| 80 | Confirmation screen "Thank you for submitting to present at our event!" + "Continue to portal →". | V42 | **COVERED** | `src/components/submit/outcome-cards.tsx:46`, `src/components/submit/outcome-cards.tsx:71` | Confirmation card displays thank you message and "Continue to portal →" link |
| 81 | Past close date blocks new public submissions (closed-state UI). | SBEK CFP-04 | **COVERED** | `convex/submit.ts:isFormOpen`, `src/routes/submit/$slug.tsx:ClosedCard` | — |
| 82 | Speaker can no longer edit a submission once CFP is closed. | SBEK CFP-16 | **MISSING** | searched `convex/portal.ts:updateSubmission` and `src/components/portal/portal-utils.ts:canEdit` | `updateSubmission` checks submission status (`declined`/`withdrawn`) but does not check if the CFP form is closed |
| 83 | Speaker can edit an existing submission pre-deadline; edit visible to organizer. | SBEK CFP-09, CLAR "yes they can edit" | **COVERED** | `convex/portal.ts:updateSubmission`, `src/components/portal/submission-drawer.tsx:handleSave` | — |
| 84 | Submission triggers a confirmation email referencing the submission. | SBEK CFP-08 | **MISSING** | searched `convex/submit.ts:submit` | `sendConfirmationEmail` flag exists in form schema, but `submit` mutation does not enqueue or send a confirmation email |
| 85 | Speaker portal with tabs Home, Submissions, Profile, Tasks. | V44 | **COVERED** | `src/components/portal/portal-tabs.tsx:PORTAL_TABS` | — |
| 86 | Portal Home: "My Submissions" cards with format + status badges. | V45 | **COVERED** | `src/components/portal/submission-card.tsx:SubmissionCard`, `src/routes/portal/index.tsx` | — |
| 87 | Portal Tasks widget/checklist with due dates + mark complete. | V46, SBEK SPK-09 | **COVERED** | `src/components/portal/task-item.tsx:TaskItem`, `src/routes/portal/tasks.tsx` | — |
| 88 | Portal submission detail drawer with Details + Participants. | V47 | **COVERED** | `src/components/portal/submission-drawer.tsx:SubmissionDrawer` | — |
| 89 | Portal Profile editor: Biography rich text, Salutation, First/Last, Honorific, Pronouns, Gender, Job Title, Company, Email, Mobile Phone, Address. | V48, VID master 07:30 | **PARTIAL** | `src/components/portal/profile-editor.tsx:ProfileEditor`, `convex/schema.ts:people` | Bio is plain textarea rather than rich text; honorific, gender, and address fields are missing from schema and editor |
| 90 | Portal Profile "My Links": LinkedIn, X/Twitter, Facebook, Website. | V48 | **PARTIAL** | `src/components/portal/profile-editor.tsx:LINK_FIELDS`, `convex/schema.ts:people` | Facebook link field is missing (only LinkedIn, Twitter/X, and Website are supported) |
| 91 | Headshot upload in the portal with preview. | BRIEF 2, SPEC 4.7 | **COVERED** | `src/components/portal/headshot-uploader.tsx:HeadshotUploader` | — |
| 92 | Slides / supporting-document upload by the speaker. | BRIEF 2 | **COVERED** | `convex/portal.ts:attachUpload`, `src/components/portal/task-item.tsx:handleFile` | — |
| 93 | Bio/social/headshot edited in portal reflects on organizer record. | SBEK SPK-08 | **COVERED** | `convex/portal.ts:updateProfile`, `convex/portal.ts:attachUpload` | — |
| 94 | Each speaker's portal shows only their own content (scoping). | SBEK SPK-07, CNT-03 | **COVERED** | `convex/portal.ts:getHome` | — |
| 95 | Organizer-side task creation: general task (title, due date) assignable to multiple speakers. | SBEK SPK-05 | **COVERED** | `convex/tasksAdmin.ts:create`, `src/components/dashboard/assign-task-dialog.tsx:AssignTaskDialog` | — |
| 96 | Organizer-side file-request task with instructions + due date. | SBEK CNT-01, brief 08-portal-forms-file-requests | **COVERED** | `convex/tasksAdmin.ts:create`, `src/components/dashboard/assign-task-dialog.tsx:AssignTaskDialog` | — |
| 97 | Portal forms: organizer builds a form for speakers to fill inside a task. | brief "Portal > Forms" screenshots | **MISSING** | searched `src/components/portal/task-item.tsx` and `src/components/dashboard/assign-task-dialog.tsx` | Task kind `form` exists in schema enum but forms cannot be built or filled inside speaker tasks |
| 98 | Portal form confirmation email configuration. | brief 08-portal-forms-confirmation-email | **MISSING** | searched `src/components/forms-builder/` and `convex/forms.ts` | No portal form confirmation email configuration found |
| 99 | Deliverables dashboard: per-speaker per-task status, filterable. | SBEK CNT-07 | **COVERED** | `src/routes/app/speakers/index.tsx:SpeakersPage`, `src/components/dashboard/speakers-table.tsx:SpeakersTable` | — |
| 100 | Bulk reminder to speakers with outstanding tasks + confirmation. | SBEK CNT-08 | **COVERED** | `convex/comms.ts:remindIncompleteSpeakers`, `src/components/dashboard/remind-incomplete-button.tsx:RemindIncompleteButton` | — |
| 101 | Evaluation Summary dashboard: Total Evaluations, Evaluated Submissions, Plans, Evaluators, completion chart, Avg Score by plan. | V50 | **COVERED** | `src/routes/app/evaluation/index.tsx:154-213` | - |
| 102 | Evaluation Plans tab: create multi-round plans, assign submission pools, evaluators, due dates. | V51, SBEK ABS-01 | **COVERED** | `src/components/evaluation/new-plan-dialog.tsx:1-250`, `convex/evaluationsAdmin.ts:createPlan` | - |
| 103 | "My Evaluations" tab. | VID 07:42 tab list | **MISSING** | `src/routes/app/evaluation/index.tsx:37-39` | "My Evaluations" tab omitted in organizer UI; organizers evaluate via review token links. |
| 104 | Evaluators list table: Name, Status, Rounds, Progress, Actions. | V52 | **COVERED** | `src/components/evaluation/evaluators-table.tsx:65-151` | - |
| 105 | Evaluator Tags tab (categorize reviewers by expertise). | V53 | **MISSING** | `convex/schema.ts:233-242`, `src/routes/app/evaluation/index.tsx:31` | No Evaluator Tags tab or evaluator tag fields exist. |
| 106 | Reviewer provisioned with usable credentials, lands on reviewer-only UI (no admin nav). | SBEK CFP-10 | **COVERED** | `src/routes/review/$token.tsx:35-37`, `http://localhost:3000/review/demo-eval-alex` | - |
| 107 | Reviewer records rating + comment; organizer sees it; dashboard reflects completion. | SBEK CFP-11 | **COVERED** | `convex/review.ts:159-245`, `convex/evaluationsAdmin.ts:summary` | - |
| 108 | Scorecard editor supporting numeric + dropdown + free-text criteria types. | SBEK ABS-03 | **PARTIAL** | `src/components/evaluation/score-field.tsx:4-80`, `convex/schema.ts:225` | Only 1–5 numeric scale criteria supported; dropdown and free-text criteria types absent. |
| 109 | Criteria weights affecting aggregate. | SBEK ABS-04 | **MISSING** | `convex/schema.ts:225`, `convex/evaluationsAdmin.ts:310` | No criteria weights or weighted aggregate calculations. |
| 110 | Per-reviewer queue contains exactly their assigned submissions. | SBEK ABS-05 | **COVERED** | `convex/review.ts:62-105` | - |
| 111 | At-scale assignment: per-reviewer caps / auto-distribute / track-filtered bulk assign. | SBEK ABS-06 | **MISSING** | `convex/evaluationsAdmin.ts` | No per-reviewer caps, auto-distribution, or track-filtered bulk assignment. |
| 112 | Blind/anonymized review round hides author identity from reviewers. | SBEK ABS-07 | **PARTIAL** | `convex/schema.ts:230`, `convex/review.ts:81` | `blind` field exists on schema, but `review.ts` includes speaker name/company regardless of setting. |
| 113 | Per-reviewer completion counts on a progress dashboard. | SBEK ABS-08 | **COVERED** | `src/components/evaluation/evaluators-table.tsx:121-125`, `convex/evaluationsAdmin.ts:listEvaluators` | - |
| 114 | Bulk-remind reviewers with outstanding reviews. | SBEK ABS-09 | **MISSING** | `convex/evaluationsAdmin.ts`, `convex/comms.ts` | Speaker reminders exist, but no bulk-remind for evaluators with outstanding reviews. |
| 115 | Aggregate score per submission, sortable in the submissions list. | SBEK ABS-10 | **COVERED** | `src/routes/app/submissions/index.tsx:128,198-201`, `src/components/submissions/submissions-table.tsx:220-231` | - |
| 116 | Reviewer conflict-of-interest / recusal control. | SBEK ABS-12 | **MISSING** | `convex/schema.ts`, `src/` | No conflict-of-interest or recusal controls implemented. |
| 117 | Co-authors/participants persist with role labels, visible organizer-side. | SBEK ABS-11 | **COVERED** | `convex/schema.ts:209-218`, `convex/submissions.ts:38-50`, `src/components/submissions/submission-detail-drawer.tsx:509-540` | - |
| 118 | Re-upload creates a new file version; latest marked, priors accessible. | SBEK CNT-04 | **COVERED** | `convex/portal.ts:299-311`, `convex/portal.ts:331-346`, `convex/submissions.ts:119-129` | - |
| 119 | Comments on an uploaded file with author + timestamp, cross-role visible. | SBEK CNT-05 | **MISSING** | `convex/schema.ts:273-290` | `uploads` table only contains a single `reviewNote` string field; no file comments model. |
| 120 | Upload UI states file constraints (type/size). | SBEK CNT-06 | **COVERED** | `src/components/portal/headshot-uploader.tsx:81`, `src/components/portal/task-item.tsx:75,210` | - |
| 121 | Content-approval status on sessions; unapproved content excluded from public output. | SBEK CNT-12 | **MISSING** | Searched `convex/schema.ts` and `convex/publicData.ts:127` | No content approval status field on sessions/submissions; public output includes all accepted sessions regardless of content review. |
| 122 | Change/version history with attribution + timestamp; restore works. | SBEK CNT-11 | **MISSING** | Searched `convex/` and `src/` for content versioning/restore | No change history or restore functionality for session/submission content (only file uploads have version numbers). |
| 123 | Central files library aggregating uploads with metadata. | SBEK CNT-13 | **PARTIAL** | `convex/tasksAdmin.ts:118` (`listUploads`) | `listUploads` query aggregates uploads with metadata, but no central files library UI exists in `src/routes/app`. |
| 124 | Multi-select bulk ZIP download of files. | SBEK CNT-14 | **MISSING** | Searched codebase for `zip`/`JSZip` | No bulk ZIP file archiving or download implementation found. |
| 125 | Organizer edits speaker bio/headshot from admin, persists. | SBEK CNT-10 | **MISSING** | Searched `src/routes/app/speakers/index.tsx` and `convex/` for admin speaker patch | No organizer UI or mutation to edit a speaker's bio/headshot directly from the admin interface. |
| 126 | Organizer can see/download a speaker-uploaded deliverable with metadata. | SBEK SPK-10 | **COVERED** | `src/components/submissions/submission-detail-drawer.tsx:622`, `convex/submissions.ts:120` | Files tab displays filename, version, date, approval status, and link/button to view/download uploaded deliverables. |
| 127 | Speaker roster with identity info + search/filter. | SBEK SPK-01 | **COVERED** | `src/routes/app/speakers/index.tsx:42`, `convex/dashboard.ts:248` | Roster shows speakers, company, job title, avatar, sessions, tasks, with search and status tab filters. |
| 128 | Organizer can manually add a speaker (name/email/bio); edits persist. | SBEK SPK-02 | **MISSING** | Searched `src/routes/app/speakers/index.tsx` and `convex/` for manual speaker creation | No "Add speaker" UI or standalone `addPerson` mutation in the organizer admin app. |
| 129 | Speakers bulk-importable from CSV. | SBEK SPK-03 | **MISSING** | Searched codebase for speaker CSV import | CSV export exists for submissions, but no CSV import exists for speakers. |
| 130 | Speaker workflow status (Invited/Confirmed/…) changes, persists, filterable. | SBEK SPK-04 | **MISSING** | Searched `convex/schema.ts` (`people` table) and `convex/dashboard.ts:248` | No speaker workflow status field (Invited/Confirmed/etc.) exists on speaker records. |
| 131 | Organizer can send a portal invite/onboarding email. | SBEK SPK-06 | **PARTIAL** | `convex/submissions.ts:174` (`commitDecisionQueue`), `convex/comms.ts:128` | Acceptance emails with portal links are sent when decision queues are committed, but no standalone "Send portal invite" action exists per speaker in the roster. |
| 132 | Session assignment visible on both organizer record and speaker portal. | SBEK SPK-11 | **COVERED** | `src/components/dashboard/speakers-table.tsx:187`, `convex/portal.ts:61` | Sessions are listed on the speaker's row in the organizer roster and under Submissions in the speaker portal. |
| 133 | List-level per-speaker task-completion progress. | SBEK SPK-12 | **COVERED** | `src/components/dashboard/speakers-table.tsx:208`, `convex/dashboard.ts:311` | Displays numerical progress (e.g. 2/3 done) and a visual progress bar for each speaker in the table. |
| 134 | Organizer sends a general bulk email to filtered speakers, logged. | SBEK SPK-13 | **MISSING** | Searched `convex/comms.ts` and `src/routes/app/communications/index.tsx` | Only task reminders and templated decision emails exist; no general bulk email composer to filtered speakers. |
| 135 | Templates use merge fields resolving per-recipient in a preview. | SBEK SPK-14 | **COVERED** | `convex/lib/email.ts:30`, `convex/comms.ts:123` | `renderTemplate` replaces `{{firstName}}`, `{{speakerName}}`, `{{sessionTitle}}`, `{{eventName}}`, `{{portalLink}}` per recipient in previews and outgoing mail. |
| 136 | Speaker record stores travel/custom logistics fields. | SBEK SPK-15 | **MISSING** | Searched `convex/schema.ts` (`people` table) | `people` schema lacks fields for travel details or custom logistics. |
| 137 | Automated reminder emails for speakers with incomplete tasks. | SBEK SPK-16 | **COVERED** | `convex/crons.ts:47`, `convex/comms.ts:175` | Daily cron (`task-reminders`) runs at 09:00 UTC to automatically email speakers with incomplete/due tasks. |
| 138 | Automated templated speaker communications incl. reminders (brief #3). | BRIEF 3 | **COVERED** | `convex/comms.ts:122`, `convex/crons.ts:47`, `convex/submissions.ts:174` | Automated templated emails for confirmations, acceptances, declines, waitlist, and task reminders. |
| 139 | Calendar invites delivered to speaker's own calendar via .ics (Gmail/Outlook/iCal). | BRIEF 3, CLAR "ics good enough" | **COVERED** | `convex/lib/ics.ts:105`, `convex/comms.ts:700` | RFC 5545 VCALENDAR built and attached as `.ics` file to acceptance emails for scheduled sessions. |
| 140 | .ics includes room details when assigned (no video link). | CLAR | **COVERED** | `convex/comms.ts:590`, `convex/lib/ics.ts:152` | `LOCATION` field in `.ics` includes room name and venue when assigned. |
| 141 | Outbox: scheduled/sent/failed message log with previews. | SPEC 4.9 | **COVERED** | `src/routes/app/communications/index.tsx:167`, `convex/comms.ts:344` | Communications outbox lists all messages with status filters and side drawer for full rendered preview. |
| 142 | Public REST API (bonus): sessions/speakers/submissions endpoints with Bearer auth + pagination. | BRIEF bonus, SPEC 6 | **COVERED** | `curl https://neat-sparrow-926.eu-west-1.convex.site/v1/event/ai-summit-2026/sessions`, `convex/http.ts:16` | Endpoints `/v1/event/{slug}/sessions`, `/speakers`, `/submissions` accept Bearer auth and return paginated JSON. |
| 143 | Agenda builder with drag-and-drop placement of sessions into day/time/room. | V55, BRIEF 5, SBEK AIA-03 | **COVERED** | `src/components/agenda/day-view.tsx:13-25` | `@dnd-kit/core` drag-and-drop grid placement into day/time/room |
| 144 | Agenda view modes: List, Day, Week, Month, Rooms, Conflicts. | V56, BRIEF 5 "list, day, week, track, room" | **PARTIAL** | `src/routes/app/agenda/index.tsx:69` | List, Day, Rooms, and Conflicts implemented; Week and Month views missing |
| 145 | Manual "+ Add Session" for breaks/keynotes. | V57 | **COVERED** | `src/components/submissions/add-submission-drawer.tsx:77-226` | Manual session creation ("session" kind for breaks/keynotes) |
| 146 | Multi-day builder view: time axis + rooms/tracks columns + day navigation. | SBEK AIA-01 | **COVERED** | `src/components/agenda/day-view.tsx:52-85` | Multi-day view with 15-min time axis, room columns, and day switcher tabs |
| 147 | Speaker double-booked across overlapping sessions → visible warning. | SBEK AIA-04 | **COVERED** | `convex/agenda.ts:74-104` | Computes speaker double-bookings across sessions with warning badge/view |
| 148 | Same room + overlapping time → blocked or flagged. | SBEK AIA-05 | **COVERED** | `convex/agenda.ts:54-72` | Detects room double-bookings on overlapping times and flags conflicts |
| 149 | Moving a session clears its conflict indicators, persists. | SBEK AIA-06 | **COVERED** | `convex/agenda.ts:177-207` | `schedule` mutation updates startsAt/roomId and reactively recomputes conflicts |
| 150 | Explicit publish/go-live action making scheduled sessions publicly observable. | SBEK AIA-07 | **MISSING** | searched `convex/events.ts`, `convex/agenda.ts`, `convex/publicData.ts` | Accepted sessions are public automatically; no explicit publish/go-live action exists |
| 151 | Auto-schedule/AI-assist control placing ≥1 unscheduled session in one action. | SBEK AIA-08 | **COVERED** | `convex/agenda.ts:336` | `autoPlace` greedy mutation and `AutoPlaceDialog` schedule all unscheduled accepted sessions |
| 152 | Unscheduled tray of accepted submissions to drag from. | SPEC 4.6 | **COVERED** | `src/components/agenda/unscheduled-tray.tsx:10-126` | Unscheduled tray with draggable cards alongside grid |
| 153 | Embeddable public agenda widget generating HTML/JS snippet. | V58, BRIEF 9 | **COVERED** | `src/routes/app/embeds/index.tsx:181-195` | Generates iframe HTML embed code snippet for public agenda/schedule |
| 154 | Embed generator UI: type picker, format picker, filters, field options, style options, saved list, "Get Code". | V59, SBEK EMB-15 | **PARTIAL** | `src/routes/app/embeds/index.tsx:76-127,334-418` | Configurator UI has type picker, field toggles, track filter, height; lacks saved list and style/format pickers |
| 155 | Embed preview: date tabs, track tags, room columns, time slots, talk cards, speaker popups, "Add to Calendar". | V60 | **COVERED** | `src/routes/app/embeds/index.tsx:461-490` | Iframe preview renders public schedule with date tabs, track tags, room grid, session cards, and AddToCalendar |
| 156 | Public Sessions List widget: card per session with title, description + Show more, date/time, room, speaker + title + company, Format/Track tags. | SBEK EMB-01 | **COVERED** | `src/components/public/session-card.tsx:26-150` | Session card with title, abstract + Show more, date/time, room, speakers, Format/Track tags |
| 157 | Keyword search matching session titles AND speaker names. | SBEK EMB-02 | **COVERED** | `src/routes/e/$slug/sessions/index.tsx:63-78` | Search matches session titles, descriptions, and speaker name/jobTitle/company |
| 158 | Faceted filters (Track, ideally Format/Location). | SBEK EMB-03 | **COVERED** | `src/routes/e/$slug/sessions/index.tsx:111-137` | Dropdown faceted filters for Track, Format, and Room |
| 159 | Public Speakers List: alphabetized directory with headshot/name/title/company. | SBEK EMB-04 | **COVERED** | `src/components/public/speaker-gallery.tsx:97-170` | Alphabetized speaker directory with headshot, name, title, company |
| 160 | Speaker entry drills into detail (bio + their sessions); directory search by name. | SBEK EMB-05 | **COVERED** | `src/components/public/speaker-gallery.tsx:180-344` | Speaker detail modal with bio and sessions; directory search by name |
| 161 | Agenda widget day/room/time grid with correctly placed blocks. | SBEK EMB-06 | **COVERED** | `src/components/public/rooms-grid.tsx:1-120` | Public day/room/time grid with placed session blocks |
| 162 | Agenda day navigation switches days and re-renders. | SBEK EMB-07 | **COVERED** | `src/routes/e/$slug/index.tsx:121-180` | Day switcher buttons update URL search param and re-render grid/itinerary |
| 163 | Agenda block click → detail (time range, room, description, Format/Track); Back restores. | SBEK EMB-08 | **COVERED** | `src/routes/e/$slug/sessions/$sessionId.tsx:1-120` | Session detail page with time range, room, description, tags, and Back link |
| 164 | Schedule Itinerary: chronological day-tabbed list with full card anatomy. | SBEK EMB-09 | **COVERED** | `src/routes/e/$slug/index.tsx:200-280` | Chronological day-tabbed schedule itinerary list using full SessionCard |
| 165 | Personal schedule building: add/star sessions, personal view. | SBEK EMB-10 | **COVERED** | `src/components/public/save-session-button.tsx:1-60` | Bookmark/star button adds session to personal schedule at `/my-schedule` |
| 166 | Personal schedule persists across reload; export/add-to-calendar. | SBEK EMB-11 | **COVERED** | `src/components/public/use-my-schedule.ts:1-50` | Personal schedule saved in localStorage; exports to `.ics` calendar |
| 167 | Speaker Gallery: photo grid, alphabetized, name search, missing-photo fallback. | SBEK EMB-12 | **COVERED** | `src/components/public/speaker-gallery.tsx:45-95` | Alphabetized photo grid with name search and initials fallback avatar |
| 168 | Gallery card → detail modal (photo/name/title/bio/company/sessions); Close restores grid. | SBEK EMB-13 | **COVERED** | `src/components/public/speaker-gallery.tsx:180-344` | Card click opens detail modal with photo/name/title/bio/company/sessions; close restores grid |
| 169 | All widgets render to non-admin viewers. | SBEK EMB-14 | **COVERED** | `convex/publicData.ts:1-150` | `http://localhost:3000/e/ai-summit-2026/sessions` renders to unauthenticated viewers |
| 170 | Same session/speaker shows identical fields across widgets and matches organizer record. | SBEK EMB-16 | **COVERED** | `convex/publicData.ts:111-150` | `loadProgram` projects directly from Convex `submissions` and `people` tables for all widgets |
| 171 | Mobile-friendly public widgets. | BRIEF 9 | **COVERED** | `src/routes/e/$slug/index.tsx` | Mobile-responsive Tailwind layouts and mobile device preview in embed configurator |
| 172 | Org-level cross-event speaker/contact directory (optional CRM bonus). | SBEK CRM-01..12 | **MISSING** | searched `src/` and `convex/` | Cross-event CRM contact directory not implemented |
| 173 | Airtable persistence/sync (bonus). | BRIEF bonus, RULES 15 | **COVERED** | `convex/airtable.ts:1-580` | One-way Airtable sync for Submissions, Speakers, and Sessions |
| 174 | Cloudflare deploy (bonus). | BRIEF bonus | **COVERED** | `wrangler.jsonc:1-10` | Cloudflare Worker setup via `wrangler.jsonc` and `wrangler deploy` script |
| 175 | Open-source repo + deployed site reachable. | BRIEF submission rules | **COVERED** | `git remote -v` | Git repo at `https://github.com/markokraemer/sessionboard.git` and app running at `http://localhost:3000/` |
---

## Auditor's own spot-checks (Claude, independent of Gemini)

Every one of these confirmed the evaluator's verdict, and three found a *worse* problem
than the item as written:

| Check | Result |
|---|---|
| `logoId` in `convex/schema.ts:100` vs any upload UI | schema field exists, **no upload control anywhere** — confirms #3 |
| `sendConfirmationEmail` | set in `convex/schema.ts:138`, `forms.ts:37/67`, seeded true — **read by nothing**; `convex/submit.ts` has no `queueForPerson`/`scheduler` call. Confirms #84 |
| `notifyEmails` | stored (`schema.ts:147`), edited in the Notifications wizard step, **never read by any send path** — the entire Notifications step is inert. *New finding, not on the checklist* |
| `autoRedirectToPortal` | plumbed through `submit.ts:81/418` to the client but `rg autoRedirect src/routes/submit/$slug.tsx` → no hits. Confirms #65 |
| `blind` | `schema.ts:230` only; `rg blind convex/review.ts src/routes/review src/components/evaluation` → **zero hits**. Confirms #112 |
| `evaluationPlans.criteria` | `v.object({id, label})` — no `type`, no `weight`. Confirms #108/#109 |
| Plan assignment shape | `submissionIds[]` is plan-wide and `evaluators` are plan-wide, so two evaluators on one plan see an identical queue. #110 is COVERED only in the single-evaluator case — treat as **PARTIAL** for sbek ABS-05 |
| Agenda views | `src/routes/app/agenda/index.tsx` = List · Day · Rooms · Conflicts. No Week, **no Track view** — brief #5 enumerates "list, day, week, track, or room". Confirms #144 and widens it |
| `rg -n publish convex/agenda.ts src/routes/app/agenda` | zero hits. Confirms #150 |
| `tasksAdmin.*` consumers | only `src/components/dashboard/assign-task-dialog.tsx`; `listUploads`/`reviewUpload` have **no organizer page**. Confirms #123 |
| Airtable | `convex/airtable.ts` + `convex/lib/airtable.ts` + `src/components/settings/airtable-card.tsx` — full connect/sync/disconnect UI. Confirms #173 (this card **landed mid-audit**, see churn note) |
| REST API | live `curl` against `…convex.site/v1/event/ai-summit-2026/sessions` returned paginated JSON with nested speakers. Confirms #142 |

## Ranked GAP LIST — fix before submission

Ranked by judging impact (explicit brief requirement × sbek item type/weight × how
obviously an evaluator trips over it). Effort: **XS** <30min · **S** ~1h · **M** ~half day ·
**L** ~a day+.

| Rank | Item(s) | Gap | Sev | Effort | Why it matters |
|---|---|---|---|---|---|
| 1 | #84 | Submission-received confirmation email never sent, despite a "Send submission confirmation email" toggle in the builder | S1 | S | sbek **CFP-08** `side-effect`. Worse than a gap: the UI promises it. A speaker submits and hears nothing — the single most obviously-broken loop for a human judge. |
| 2 | *(new)* #69 | `notifyEmails` — the whole **Notifications** wizard step — is stored and never read | S1 | S | swyx demoed this step explicitly [05:38]. An organizer configures who gets alerted; nobody ever does. Same fix path as #1. |
| 3 | #112 | `blind` flag on evaluation plans is never enforced — reviewers always see speaker names | S1 | S | sbek **ABS-07** `scoping` (~1.4 eff pts), and `scoping` items are the rubric's strongest discriminator. TODO already says "VERIFY at integration" — it was not. Shipping the flag unenforced is worse than not having it. |
| 4 | #82 | Speaker can still edit a submission after the CFP close date | S1 | XS | sbek **CFP-16** `rule`. `isFormOpen` already exists for CFP-04 — one call in `convex/portal.ts:updateSubmission`. Two rubric items off one date check. |
| 5 | #150 | No explicit **Publish / Go live** action on the agenda | S1 | XS | sbek **AIA-07** `handoff` — the script hunts for the button and screenshots the confirmation. Our data is live-by-default, which reads as weaker evidence. One button + a confirmation state. |
| 6 | #144 | Agenda has List/Day/Rooms/Conflicts — **no Week view, no Track view** | S1 | M | Brief requirement #5 literally enumerates "viewable by list, day, week, track, or room"; the video shows Week and Month tabs. Two of five named views absent is a checkable miss against the brief text itself. |
| 7 | #121 | No content-approval gate on sessions — everything accepted is instantly public | S1 | M | sbek **CNT-12** `rule`, the highest-leverage item in a 15%-weight area. Note: `uploads.approvalStatus` exists but that's file review, a different gate. |
| 8 | #128, #130, #125 | No manual **Add speaker**, no speaker workflow status, no organizer-side edit of a speaker's bio/headshot | S1 | M | sbek **SPK-02** (w3, highest in its area), **SPK-04**, **CNT-10**. The roster is derive-only: an organizer who wants to add a confirmed keynote speaker by hand simply cannot. |
| 9 | #134 | No general bulk-email composer to filtered speakers | S1 | M | sbek **SPK-13** (w3 `bulk`). Only decision emails and the task reminder exist. Already flagged in TODO as "add backend compose fn at integration" — still open. |
| 10 | #3 | No logo / background-image upload on event settings | S2 | S | swyx demoed it [02:50]; `events.logoId` already exists in schema; branding also feeds the public site + embeds, which currently render text-only headers. |
| 11 | #24, #27, #30, #40 | No Columns chooser, no Saved Views, no Import Sessions / Export XLSX / files bundle | S2 | M | All four are in the brief's own screenshots (`05-abstracts-review-column-chooser`, `-import-export`) and the video's Options menu [03:56]. Columns chooser is the one a judge reaches for first. |
| 12 | #154 | Embed generator has no **saved embeds list** and no **format picker** (styled-HTML/basic-HTML/JSON/XML/iCal) | S2 | M | sbek **EMB-15** (w3 `handoff`, the rubric's single most consequential item). The type picker, field toggles and Get-code snippet are there — this is the last mile of the highest-value item. |
| 13 | #97, #98 | Task kind `form` exists in the schema but a speaker can't fill a form inside a task, and there's no portal-form confirmation email | S2 | M | The brief devotes a whole screenshot section to **Portal > Forms** (5 images). Today it's an enum value with no path. |
| 14 | #123 | No central **Files library** page (backend `tasksAdmin.listUploads` already written) | S2 | S | sbek **CNT-13**; cheapest remaining CNT point — a thin read-model page over an existing query. |
| 15 | #108, #109, #111 | Scorecards are 1–5 numeric only (no dropdown/free-text criteria), no criteria weights, no per-reviewer caps/auto-distribute | S2 | M | sbek **ABS-03** (w3), **ABS-04**, **ABS-06**. ABS-03 is the highest-weight evaluation item after ABS-01/10. |
| 16 | #105, #103, #114, #116 | No Evaluator Tags tab, no My Evaluations tab, no reviewer bulk-reminder, no COI/recusal | S3 | M | Evaluator Tags and My Evaluations are named tabs in the video [07:42]; ABS-09/ABS-12 are 1-weight rubric items. |
| 17 | #65 | `autoRedirectToPortal` toggle is honoured nowhere | S3 | XS | A settings toggle that lies. Either wire it or delete it — an evaluator toggling it and seeing no change reads as broken. |
| 18 | #22, #23, #29 | No Abstracts/Sessions view switcher; table and Add-drawer lack Client Session ID, Starts/Ends At, Capacity, CEU Credits, Location, Notified | S3 | M | swyx's canonical Abstracts vs Sessions distinction [03:24] is invisible in our UI, and Client Session ID is a column he showed by name. |
| 19 | #7, #5, #13 | No email-theme HTML/CSS editor; settings sub-nav missing Portals/Submission forms/Email templates/Integrations; dashboard has no Today / Review Progress / Speaker Tracking / Submissions Pipeline sub-tabs | S3 | M | All shown on screen. The settings sub-nav delta is partly our deliberate flattening — but Email Templates being unreachable from Settings is a genuine dead end (they live only under Communications). |
| 20 | #89, #90 | Portal profile: bio is a plain textarea (video shows rich text), missing Honorific/Gender/Address and the Facebook link | S3 | S | swyx walked the profile field-by-field [07:27]. Cheap fidelity. |
| 21 | #122, #119, #124, #129, #136 | No content change-history/restore, no file comments, no bulk ZIP, no speaker CSV import, no travel/logistics fields | S3 | L | sbek CNT-11/CNT-05/CNT-14, SPK-03/SPK-15. Five 1–2-weight items; only worth it after ranks 1–15. |
| 22 | #47, #50, #56, #67, #68 | Form builder: no Abstract-section heading/instructions, no US-vs-International phone option, no min/max for Chairperson/Moderator, no cross-field char limits, no multi-language toggle | S4 | M | All demoed, all small. #68 is explicitly discounted by swyx ("we only care about English"); #50 is the one he actually opened a modal to show. |
| 23 | #4, #9 | No Exhibitors & Sponsors toggles / metric card | S4 | XS | Shown at [02:46] but swyx explicitly scopes the sponsor/CRM column OUT. Safe to skip; listed for completeness. |
| 24 | #172 | Speaker CRM area (12 items, 19 extra-credit points) absent | S4 | L | Optional area — a defensible deliberate trade, already a TODO decision item. |

### Cross-check against `TODO.md`

**Already tracked** (do not double-count): blind review verify (rank 3), bulk email compose
(rank 9), content-management depth / file versions + approval UI (partially rank 7 & 14),
change history CNT-11 (rank 21), Speaker CRM (rank 24), multi-event switcher (now COVERED),
AI auto-place UI (now COVERED), embed generator + itinerary (now COVERED), public API (COVERED).

**Genuinely new** → appended to `TODO.md` under "## Coverage audit gaps": ranks 1, 2, 4, 5, 6,
8, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 22, and the CNT-12 session-level approval gate as
distinct from the existing upload-approval work.

## CANNOT-VERIFY list — hand to the e2e / browser pass

Statically the code is present for all of these; only a real browser (or a real inbox) can
prove the behaviour. This is the work order for the Playwright/sbek pass:

| # | What must be driven interactively |
|---|---|
| 16 | Perceived speed: no full-page spinners, sub-second navigations (swyx's #1 complaint). Measure route transitions in Chromium. |
| 143, 152 | Drag a card from the Unscheduled tray onto the Day grid; verify it persists across reload. |
| 147, 148, 149 | Create a deliberate room overlap and a speaker double-booking; assert the warning appears <1s and clears when the session is moved. |
| 151 | Click Auto-place and assert ≥1 unscheduled session lands on the grid. |
| 31, 33, 34 | Inline status pill → Save; bulk-select → Accept Queue; commit the queue and assert emails appear in the Outbox and the portal flips status. |
| 54, 79 | Conditional (`showIf`) question actually shows/hides live in the public form; validation toast + red outlines fire. |
| 53 | dnd-kit question reordering persists after save. |
| 74, 83 | Passwordless account step end-to-end; speaker edits a submission and the organizer sees the edit. |
| 91, 92, 120 | Headshot + file upload round-trip through Convex storage; constraint messaging renders. |
| 137, 138, 141 | Real Resend delivery (needs a non-`@example.com` inbox) — and that the daily reminder cron actually fires. |
| 139, 140 | Import the generated `.ics` into Google Calendar, Apple Calendar and Outlook; confirm LOCATION carries the room. |
| 165, 166 | Personal schedule (localStorage) survives a reload and the `.ics` export opens. |
| 153, 155, 171 | Paste the generated `<iframe>` into a third-party page and confirm it renders; check mobile widths. |
| 106, 107 | Reviewer magic link → score + comment → organizer sees it and the completion donut moves. |
| 18 | Cross-event isolation: sign in, switch events, assert no bleed (code path exists via `requireEventAccess`). |

## Notes on churn (5 agents editing `src/` during this audit)

- `src/components/settings/airtable-card.tsx` and `src/routes/app/settings/api-mcp.tsx`
  appeared **mid-run** — items #173 and the API/MCP settings tab flipped from absent to
  present while the audit was executing. Any MISSING verdict in this matrix is a snapshot
  as of this run; re-verify ranks 10–20 before acting if a slice landed since.
- Verdicts were produced from live source, so they reflect whatever was on disk at read
  time; the evidence column names the file so re-checking is cheap.
