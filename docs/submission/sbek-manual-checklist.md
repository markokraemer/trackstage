# Manual verification checklist

Target: https://trackstage.app
Run: runs/2026-08-11T12-01-26

These rubric items could not be verified automatically (or only half-verified).
For each item: perform the check, then record the result in `manual-results.json`
and run `pnpm run finalize -- --run runs/2026-08-11T12-01-26` to fold it into the final score.

## Abstract Management (Review Depth & Disposition)

### ABS-07 (weight 2) — With anonymization enabled on a round, the reviewer's view hides author and co-author identity while the organizer's view of the same submission shows it.

- Pass when: A per-round anonymization/blind setting exists (ABS-S2 step 4) and the blinded reviewer view of 'Taming 40-Minute CI' contains none of 'Priya Raman', 'Marcus Okafor', or 'Latticework Systems', while the organizer view (ABS-S3 step 10) shows them; author names leaking anywhere in the reviewer view fails.
- How to verify: Cross-reviewer isolation needs a second simultaneous account: invite a second reviewer you control to the same round, assign them 'Taming 40-Minute CI', log in as them in a separate browser, and confirm they cannot see Sam Whitfield's scores or comments before submitting their own.
- Auto-judge said: pass — A per-round 'Blind review' toggle exists in the plan dialog ('Evaluators won't see who submitted — names, job titles and companies are stripped from their review page') and was enabled. The reviewer view of 'Taming 40-Minute CI' showed a 'Blind review — score this on the abstract alone. Speaker details are withheld for this round.' banner, and the agent explicitly scanned and found none of 'Priya Raman', 'Marcus Okafor' or 'Latticework Systems'. The organizer view of the same submission shows both names in the People tab.

### ABS-09 (weight 1) — Organizer can select reviewers with outstanding reviews and send them a bulk reminder from the progress or reviewer view.

- Pass when: A reminder/nudge action is available against the lagging reviewer (Sam at 0 of 2 complete), and triggering it reports success (confirmation toast, sent status, or log entry).
- How to verify: Check the sam.reviewer@sbek-test.example.com inbox (or the clone's outbound-mail log if it exposes one) and confirm a reminder email arrived referencing the pending reviews.
- Auto-judge said: partial — A reminder control targeted at lagging reviewers exists and is state-aware: while the reviewer was outstanding the plan page showed a 'Remind 1 outstanding reviewer' button (alongside 'Distribute evenly'), and after all scorecards were complete the same control became the disabled 'Everyone is up to date'. However there is no evidence the agent triggered it, so no sent confirmation/toast/log entry was captured — the success half of the pass condition is unverified.

### ABS-13 (weight 2) — Review scores and statuses can be exported to a downloadable file (CSV/XLSX) from the results or reports area.

- Pass when: An export/download control exists for review results and triggering it initiates a download or reports success without error.
- How to verify: Trigger the export yourself, open the downloaded file, and verify it contains one row per submission with title, per-criterion or aggregate scores, recommendation, and review status matching the on-screen results table (Taming 40-Minute CI with Originality 4 / Relevance 2 / Accept; Your AI Pair Programmer with 5 / 5 / Accept).
- Auto-judge said: cannot_judge — ABS-S3 ended on a turn limit before reaching the export step; no observation or screenshot addresses an export/download control for review results (an unopened 'Options' menu appears on the submissions table but its contents were never inspected). There is therefore no basis to judge presence or function of export.

### ABS-14 (weight 1) — If the clone claims AI-assisted triage, an AI evaluator produces a first-pass numeric score with written reasoning on a submission, and a human override persists distinguishably.

- Pass when: An AI evaluation feature exists and yields a numeric score plus rationale text attributed to the AI on 'Taming 40-Minute CI'; the results view distinguishes AI from human scores; an admin override to a different value persists after reload. Judge this item only if the clone claims AI review anywhere in its UI or marketing; otherwise score as not applicable per the agent's recorded observation of absence.
- How to verify: Read the AI-generated rationale and confirm it is substantive and specific to the abstract's actual content (mentions CI/builds/monorepo concepts) rather than generic boilerplate reusable on any submission.
- Auto-judge said: cannot_judge — The app does expose an AI surface ('Open the AI copilot' button in the header), so absence of AI review claims cannot be concluded, yet the agent never explored any AI evaluation/triage capability, produced no AI score/rationale evidence, and recorded no observation of its absence. Evidence is insufficient either way.

## Call for Papers

### CFP-08 (weight 1) — Submitting a proposal triggers an automated confirmation email to the submitter referencing the submission

- Pass when: A confirmation email arrives at the submitter's address within a few minutes of submitting, referencing the event and the submitted title; if the clone exposes an in-app email log/outbox, a logged message with correct recipient and title also passes
- How to verify: Submit a proposal using an inbox you can inspect (e.g. re-run the CFP-S2 submission with a real mailbox address, or use the clone's email log/outbox page if it has one). Within a few minutes, verify an email arrived that names the event and the submitted talk title. Capture a screenshot of the message showing recipient, subject, and title. Also note whether the CFP-S2 confirmation screen claimed an email was sent.


### CFP-13 (weight 2) — Decision statuses propagate to the submitter: the speaker's own dashboard reflects Accepted/Rejected for the corresponding proposals

- Pass when: Signed in as Priya Raman after decisions were recorded, her dashboard shows the CI talk as Accepted and the AI talk as Rejected (or unambiguous equivalents of those statuses)
- How to verify: (agent could not reach this — verify by hand: Screenshot of the speaker dashboard with both status labels visible; recorded exact status wording)
- Auto-judge said: cannot_judge — CFP-S4 hit the 100-turn limit before returning to the speaker persona, and no scenario re-opened Priya Raman's portal after decisions were recorded. The only speaker-dashboard screenshots pre-date the decisions and show both proposals as 'Pending'. There is therefore no evidence either way about decision propagation to the submitter.

### CFP-14 (weight 2) — The platform can send (or queue) acceptance and rejection notification emails to decided submitters, with the UI confirming dispatch

- Pass when: A notify/send-decisions action exists, accepts or provides accept/reject templates (merge-field support like {speaker_name}/{talk_title} is a plus, inferred), and after triggering it the UI reports the messages as sent/queued for the correct recipient sets; NOT auto-verified: actual delivery and body personalization
- How to verify: After decisions are recorded, trigger the decision notifications with submitter addresses that use a real, inspectable inbox. Verify one acceptance email and one rejection email arrive, each naming the correct talk title (and speaker name if templates support merge fields). Screenshot both messages.
- Auto-judge said: partial — The platform clearly has notification machinery — a 'Communications' section in the organizer navigation with templates/outbox routes (URLs /app/communications?tab=templates and ?tab=outbox visited in CFP-S4) and a per-submission 'Not notified yet' indicator on the submission detail header — and the agent's screenshot sequence suggests acceptance/decline templates were filled and sends confirmed. However, those screenshots (acceptance-template-filled, acceptances-sent-confirmation, communications-outbox-sent-emails) are not attached and the visible transcript ends before those turns, so the sent/queued confirmation itself could not be inspected. Per the rubric this item is auto-partial in any case; delivery and body personalization are not verified.

### CFP-16 (weight 2) — Submission editing locks after the CFP close date: the speaker can no longer modify a submission once the call is closed

- Pass when: With the close date in the past, the speaker's submission opens read-only, hides its edit affordance, or shows an editing-closed message — and no edit can be saved
- How to verify: (agent could not reach this — verify by hand: Speaker-side screenshot of the locked/read-only submission (or editing-closed message), taken after the close date was moved to the past — contrast with the successful edit in CFP-S2)
- Auto-judge said: cannot_judge — CFP-S4 reached the turn limit right after saving the past close date (final screenshot is the account menu on the form settings page), and no scenario re-entered the speaker portal afterwards to test whether the submission became read-only. The speaker-side modal seen earlier states 'You can update the wording here until Sep 16, 2026, when the call for speakers closes' — implying a lock is intended — but the post-close behaviour was never exercised.

## Content Management & Speaker Deliverables

### CNT-08 (weight 2) — Organizer can trigger bulk reminder emails to speakers with outstanding tasks and receives a send confirmation.

- Pass when: A bulk reminder action is available from the dashboard for incomplete/outstanding tasks (with or without a template picker) and the UI confirms the send (toast, dialog, or sent count). Actual delivery is verified manually.
- How to verify: Check the inboxes for the fixture speaker addresses (Priya Raman and Marcus Okafor at sbek-test.example.com) or, if those are not real mailboxes, the clone's outbound-mail log / mail-catcher. Confirm each speaker with outstanding tasks received a reminder naming the outstanding task ("Upload Final Headshot (print quality)" and, for Marcus, "Upload Session Presentation") and its due date.
- Auto-judge said: partial — Judging only the UI-observable half: a bulk reminder action for outstanding tasks is clearly present and prominent — 'Remind all incomplete' on the Speakers (deliverables) page and again on the organizer Dashboard next to 'Outstanding tasks 2'. The agent's captured sequence indicates it invoked it and reached a confirmation and an outbox record (screenshots labelled 'bulk-reminder-confirm-dialog', 'bulk-reminder-sent', 'outbox-reminder-confirmation'), but those images were not attached and the transcript excerpt does not cover those turns, so the exact confirmation wording/sent count could not be inspected. Actual delivery is out of scope for UI judging.

### CNT-10 (weight 2) — Organizer can edit speaker profile content (bio text and headshot photo) from the admin area and the changes persist.

- Pass when: Priya's bio shows the appended sentence and her record displays the newly uploaded headshot.png image after save and reload.
- How to verify: (agent could not reach this — verify by hand: Before/after screenshots of the speaker record showing the updated bio and photo.)
- Auto-judge said: cannot_judge — The agent reached the admin speaker editor ('Edit profile & bio' → 'Edit Priya Raman' dialog, which states 'Your changes overwrite what's on the public speaker page') and noted a headshot slot already containing a photo, but the run hit the turn limit before any bio text was appended, saved, and re-verified, and no before/after screenshot of the updated bio or a newly uploaded headshot.png on the speaker record was captured. The only headshot evidence (headshot.png in the Files library, v1, Awaiting review) came from a speaker-portal upload, not from an organizer-side edit. Insufficient evidence either way.

### CNT-11 (weight 2) — Content edits are recorded in a version/change history with editor attribution and timestamps, and a prior version can be restored.

- Pass when: The history panel lists at least two distinct timestamped entries attributed to Jordan Alvarez, and restoring the earlier version removes the second edit's sentence while keeping the first edit.
- How to verify: (agent could not reach this — verify by hand: Screenshot of the history/activity panel with who/when entries and of the abstract after restore.)
- Auto-judge said: cannot_judge — A 'History' tab is present on every submission drawer alongside Details/People/Reviews/Files, and the agent performed the two sequential abstract edits the scenario requires (the second, 'Attendees should bring a laptop.', was still unsaved/just typed when the run ended). However the History panel was never opened, so there is no evidence of timestamped entries, editor attribution to Jordan Alvarez, or a restore control, and no post-restore abstract state. The scenario ended at the turn limit before this step.

### CNT-12 (weight 3) — Sessions carry a content approval/review status the organizer can set, and unapproved content is excluded from the public agenda output. (This item grades the approval GATE, not the public widget rendering itself — that is graded by public-widgets EMB-06.)

- Pass when: A status control exists and persists (exact state names may vary - draft/in-review/approved is the inferred norm); the public agenda page shows the approved session (with its updated title) and omits the unapproved one. If no public agenda exists yet at area-04 time (it is built and published in a later area), the gate may be verified on any public sessions/preview surface, or judged from the agent's recorded observation together with the area-06 public-widget evidence.
- How to verify: (agent could not reach this — verify by hand: Screenshots of the status controls on both sessions and of the public agenda (or the closest public sessions/preview surface) listing only the approved session; if no public surface exists yet, the agent's explicit deferral observation.)
- Auto-judge said: cannot_judge — Candidate gate controls are visible in the session drawer — a workflow 'Status' chip (Accepted/Pending, with 'Not notified yet') and a 'Show on public schedule' toggle whose helper text says 'Anyone can see this session on your public schedule, session list and calendar feed' — plus per-file 'Awaiting review' approval states with an approve action in the Files library. But the agent never set/persisted a review status on the two fixture sessions and never opened any public agenda/preview surface, and it recorded no explicit deferral observation, so the exclusion behaviour (approved session shown, unapproved omitted) is entirely unverified. The run ended at the turn limit before this step.

### CNT-14 (weight 2) — Organizer can multi-select sessions/files and generate a bulk download (ZIP) of latest file versions, with grouping options if offered.

- Pass when: The UI supports selecting multiple sessions/files and starting an export, and confirms generation (queued/generating/ready state or download start). Grouping options and file deselection are positive evidence but optional. ZIP contents are verified manually.
- How to verify: Trigger the same export as an organizer, download the resulting ZIP (via the ready link or the email notification if the clone sends one), and verify it contains only the LATEST version of slides.pdf (the second upload), is organized according to the chosen grouping (e.g. one folder per session), and excludes any file deselected in the dialog.
- Auto-judge said: partial — Judging only the UI-observable half: bulk-download affordances exist — 'Download all' on the central Files library and 'Download all' on the per-session Files tab (which lists 2 files / latest version first), and the Submissions list provides row checkboxes plus an 'Options' menu for multi-row actions. However no evidence shows a multi-select state being built, an export/grouping dialog, or any generation/queued/ready confirmation or download start; the agent ran out of turns before exercising an export, so only the presence of a bulk-download control is established.

## Public & Embeddable Widgets

### EMB-11 (weight 1) — The personal schedule persists across a full page reload, and an export/add-to-calendar affordance is offered for the selection

- Pass when: After a browser reload the previously added sessions are still marked/present in the personal view (via localStorage or an account); an export/iCal/add-to-calendar control exists and reports success when activated — the downloaded file's correctness is the manual half
- How to verify: In a normal browser, add 2 sessions to the personal schedule, trigger the export/add-to-calendar action, and download the .ics (or open the calendar link). Import it into a calendar app and confirm both sessions appear with the correct titles, dates (event days 2027-05-12..14), start/end times, and rooms/locations. Also revisit the widget the next day (or in a new tab of the same profile) to confirm longer-term persistence.
- Auto-judge said: pass — After a full navigation/reload of /e/ai-summit-2026/my-schedule the two saved sessions were still present with badge '2' (localStorage persistence, page states 'kept in this browser'). Export affordances exist and reported success: an event-level 'Add to calendar' menu (Subscribe in my calendar app / Download the .ics file / Copy the feed URL) and a 'Add all to calendar' button on My schedule which produced the toast '2 sessions downloaded — Open the .ics file to add it to your calendar.' (file correctness is the manual half). Note the selection is browser-local only, not account-synced.

### EMB-15 (weight 3) — An organizer-side embed area lets the organizer generate a per-widget embeddable snippet or feed URL, with configuration such as output format, branding/colors, content filters, and field selection, and lists saved embeds with a retrievable code snippet

- Pass when: The agent finds an embeds/widgets/share area, sees widget-type choices covering most of the five, configures and saves an embed, and retrieves a generated snippet or feed URL via a Get Code / copy / share affordance — the snippet text must be captured, not merely asserted to exist. Full credit needs multiple output formats (styled HTML script, basic HTML, JSON/XML, iCal) plus filter/field/branding options, and a saved-embed list with per-embed management (naming, enable/disable). Partial credit if an embed area exists but yields only a plain share URL with no configuration, or offers configuration but no retrievable snippet. This item is the primary evidence that the widgets are genuinely embeddable; the snippet actually rendering inside a third-party page is the manual half.

- How to verify: Copy the generated styled-HTML snippet into a blank .html file on a different origin (e.g. a local file or codepen), open it, and confirm the widget renders with live event data, reflects any configured colors/filters/hidden fields, and remains interactive (search/detail). If JSON/XML/iCal formats are offered, fetch each endpoint and confirm the JSON/XML contains session/speaker data and the iCal imports the approved sessions into a calendar app. Also confirm the embed renders for a visitor who is NOT signed in to the organizer account.
- Auto-judge said: partial — An organizer Embeds area exists at /app/embeds ('Export a feed of your agenda, sessions, or speakers…') with a 3-step builder: widget picker covering all five types (Agenda, Schedule itinerary, Sessions list, Speaker gallery, Speakers list), format picker (Embedded widget iframe, Direct link, Static HTML, JSON feed, Calendar feed .ics), content options (toggles for descriptions / speakers / speaker photos / search-and-filters, a 'Show only one track' filter, iframe height), a live preview that reflected the track filter, a named saved embed that persisted across reload, and a 'Get code' tab whose iframe snippet was captured verbatim plus a copyable direct link which rendered correctly when navigated. Gaps against full credit: no branding/colour or custom-CSS controls, no XML output, per-embed management is limited to naming + delete with NO enable/disable toggle (agent confirmed only an event-level Agenda Publish/Unpublish exists), and content filtering is a single-track dropdown with no true per-field selection.

### EMB-16 (weight 3) — Widget data is consistent across surfaces and with the organizer-side source — the same session shows identical title, date/time, room, and track everywhere it appears, and matches the organizer's record without republishing

- Pass when: The consistency samples show no mismatches: one session's title/date/time/room/track identical across at least two widgets (EMB-S1), one speaker's name/title/company identical between speakers list and gallery (EMB-S1), and one session's attendee-facing rendering matching its organizer-side record (EMB-S3). Tolerance: a leftover 'UPDATED: ' title prefix from area 04's edit test (whose final revert step may have failed) is NOT a mismatch, provided the prefixed title is identical across surfaces. This point-in-time consistency is the auto half; propagation of organizer edits to an already-placed embed without republishing is the manual half
- How to verify: As the organizer, edit one session's title (or room) in the admin, then reload the attendee-facing widget or the placed embed — using any manual cache-refresh control the clone offers — and confirm the edit appears without regenerating, re-saving, or re-embedding the widget. If the clone documents an auto-refresh interval (SessionBoard's is ~60 min), optionally re-check after that interval to confirm the change also propagates with no manual refresh.
- Auto-judge said: pass — Point-in-time consistency (the auto half) checks out. Cross-widget: 'Taming 40-Minute CI: Incremental Builds at Monorepo Scale' appears with identical Infrastructure track, Talk format, Mon Oct 12 12:00–12:45 PM, Main Stage and speaker Priya Raman (Principal Engineer · Latticework Systems) in the sessions list, the by-room agenda grid, the by-time list and My schedule. Cross-surface speaker consistency: Noah Blackwood is 'Chief Technology Officer / Fathom Robotics' in gallery card, gallery modal, session detail and his itinerary page. Organizer-vs-public: the admin agenda popup for the same session on DevFlow Conf 2027 (Platform & Infra, Accepted, Wed May 12 10:00–10:45 AM, Room 2A, Priya Raman + Marcus Okafor) matches the rendered public embed field-for-field. No mismatches recorded.

## Speaker Management

### SPK-06 (weight 2) — Organizer can send a speaker a portal invitation or onboarding email

- Pass when: An explicit invite/welcome-email control exists (per-speaker or bulk), reports success when triggered, and ideally logs the send in a communications or activity history. Email delivery itself is not agent-verifiable.
- How to verify: Re-run the invite against a speaker whose email is a real inbox you control. Confirm an invitation email arrives containing a portal link, and that the link opens the speaker portal (or a password-set page leading to it).
- Auto-judge said: pass — Observable half satisfied: the organizer can send a welcome/onboarding email containing the speaker's personal portal link — the bulk compose flow sent "Welcome to DevFlow Conf 2027 speakers" with a resolved {{portalLink}} to all 5 speakers, reported success, and each send is logged in the Communications Outbox with recipient, subject, status "Sent" and timestamps (Queued/Sent). A per-speaker "Open their portal" action and a "Remind all incomplete" control also exist. No dedicated single-speaker "send invite" button was demonstrated, but the general welcome-with-portal-link path is functional and logged.

### SPK-07 (weight 3) — Each speaker gets a personalized portal scoped to only their own content

- Pass when: Logging in as Priya lands on a speaker-facing view (distinct from the organizer admin) that identifies her and lists her own tasks/sessions/profile, with no other speaker's name, tasks, or data visible anywhere in the portal. Any speaker-scoped access mechanism passes (invite link, magic link, or password login), but the agent can only exercise password sign-in/sign-up; if the clone's only portal access is a link delivered by email, the agent cannot reach the portal and this item falls to the manual half.
- How to verify: Only needed if the agent could not reach the portal because access requires an emailed link: re-run the portal invite for a speaker whose email is a real inbox you control, follow the emailed link, and confirm it opens a speaker-scoped portal identifying that speaker, with no other speaker's name, tasks, or data visible anywhere.
- Auto-judge said: pass — Observable half satisfied: a tokenized speaker portal (/portal/t/<token>) opened from the organizer's "Open their portal" action renders a distinct speaker-facing UI headed "DevFlow Conf 2027 Speaker portal" with "Priya Raman" in the account menu, her own 4 submissions, her profile card and her tasks. The agent reviewed Home, Submissions, Profile and Tasks and recorded that no Marcus Okafor or Dana Kowalski data appears anywhere. Access is magic-link only (no speaker password login), which is a legitimate scoped-access mechanism.

### SPK-10 (weight 2) — Organizer can see and download a speaker-uploaded deliverable with metadata

- Pass when: The headshot file Priya uploaded via her portal profile edit is listed organizer-side (on her record or a files area) with its filename plus uploader and/or timestamp, and a download/view control responds without error. File content integrity is not agent-verifiable.
- How to verify: As the organizer, download the uploaded file and open it locally; confirm it is a valid image matching the headshot.png fixture rather than a corrupted or empty file.
- Auto-judge said: pass — Observable half satisfied: a dedicated Files area lists headshot.png with type/size (Image · 569 B), uploader (Priya Raman), upload time ("8 minutes ago"), version (v1) and approval status, with Approve and Download controls; the same file with metadata also appears in Priya's speaker record. The agent clicked Download and the control responded (briefly disabled) with no error page.

### SPK-13 (weight 2) — Organizer can send a general bulk email (e.g. a welcome/announcement to all speakers) to a selected or filtered speaker group and the send is logged (deliverables-reminder emails to speakers with outstanding tasks are owned by content-management's CNT-08)

- Pass when: A compose flow lets the organizer choose recipients from the speaker list (filter or multi-select), accepts the fixture welcome subject ("Welcome to DevFlow Conf 2027 speakers") and a body, reports a successful send (or schedule), and a communications history records the message with recipients and timestamp. Inbox delivery is not agent-verifiable.
- How to verify: Include a speaker whose email is a real inbox you control in the recipient group, resend, and confirm the email arrives with the composed subject ("Welcome to DevFlow Conf 2027 speakers") and body.
- Auto-judge said: pass — Observable half satisfied: the Compose dialog lets the organizer pick a recipient group ("Send to: All speakers — 5 emails, one per person"), accepted the fixture subject "Welcome to DevFlow Conf 2027 speakers" and a body, offered a per-recipient review list, and "Send to 5 people" completed — the Outbox then shows 9 entries including the 5 new sends with recipient name/email, subject, template tag custom-bulk, status "Sent" and timestamps, and an entry detail view with Queued/Sent times and the rendered message.

### SPK-16 (weight 1) — Automated reminder emails go to speakers with incomplete tasks based on due dates

- Pass when: Without any organizer manually sending a message, a speaker with an incomplete task due soon (or overdue) receives a reminder email referencing the task and its due date within the expected reminder window; the automated send also appears in the communications history if the clone has one.
- How to verify: Create or edit a speaker so their email is a real inbox you control. Assign them a task due within 24-48 hours (or set the due date in the past) and leave it incomplete. Wait through the reminder cycle (up to 24 hours past the due date). Confirm a reminder email arrives referencing the task name and due date, and check the app's communications history for the automated send. Note: in SessionBoard, after an organizer extends a deadline the speaker may keep seeing (and reminders may keep referencing) the original due date while late work is still accepted - do not penalize a clone for either behavior.

