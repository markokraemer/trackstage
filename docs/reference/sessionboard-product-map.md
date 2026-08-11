# Sessionboard product map — the definitive read of the real software

**Built:** 2026-08-11 · **Source:** [learn.sessionboard.com](https://learn.sessionboard.com), the
official product-education site swyx posted as validation material (RULES.md rule 29).

This is the requirement truth **beyond the video**. `docs/video/*` is one organizer's 10-minute
tour; this is the vendor's own documentation of every screen, setting, label, limit and rule.
Where the two disagree, the learn site is newer (it documents "Sessions 2.0", which post-dates
the build swyx recorded) — both are noted.

## How this was produced

| Layer | Method | Output |
|---|---|---|
| **Docs** | `sitemap.xml` → 226 URLs → **177 in-scope pages** crawled (skipped `/apps/*`, `/marketing/*`, `/sponsors-exhibitors/*`, `/speaker-crm/*`, `/awards/*` per standing scope) | `scratchpad/learn/pages/*.md` |
| **Videos** | 26 Guidde playbooks resolved to direct `.mp4` assets (headless Chromium network capture of `embed.app.guidde.com`), each run through `google/gemini-3.6-flash` on OpenRouter with a combined transcript + screen-action + UI-inventory + requirements prompt | `docs/video/learn/<slug>.md` |
| **Frames** | every MP4 sampled at 1 frame / 6 s (768 frames), tiled into contact sheets, key screens read directly with vision | the *Visual craft* sections below |
| **Inline transcripts** | every `/videos/*` page ships a verbatim timestamped transcript in its HTML — captured during the crawl | quoted throughout |

Two videos could not be run through the Gemini path: **Portals (Pro)**
(`youtube.com/embed/6QhdvNAGPco`) and **AI evaluations** (`youtube.com/embed/BXSO-KO35qs`) are
YouTube embeds with no inline transcript on the page, and **Importing data** is a Loom embed
(`loom.com/embed/66d0dd40…`) with no transcript. Their subject matter is covered by the prose
docs (`/portals/portals-101`, `/evaluations/ai-evaluations`, `/settings/importing-data`), which
are more detailed than the videos anyway.

**Legend used throughout:**
`NEW` = not previously in `docs/video/*`, `docs/ux/*`, `docs/reference/coverage-matrix.md` or
`docs/reference/api-parity.md`. `CONFIRMS` = independently corroborates something we already had.

---

## 1. The real information architecture

The left sidebar (frame-verified, `video-session-submission-form` 00:30 onward):

```
Dashboard
Contacts            ▸ All Contacts · Additional Contacts · Speakers · Chairpersons & Moderators
Exhibitors
Sponsors
Sessions            ▸ Submissions · Evaluation · Agenda · Embeds · Settings
Portals             ▸ Portals · Forms · File Requests · Tasks · Resources · Files
Content / Library   ▸ Fields · Files · Documents · Criteria
Reports
Studio              ▸ Remix Content   (or "Agents" when AI agents are on)
History             ▸ Emails · SMS · Integrations · Exports · Audit
Event Team          ▸ Users · Permissions
Settings            ▸ Event Details · Record Settings · Email Templates · Email Themes
                      Portals · Submission Forms · Integrations · Early Access
```

Top bar: hamburger · workspace mark · **event name + date range** · global Search · **View Portal**
· share icon · **?** help · avatar. `CONFIRMS` our 3-tier shell (rule 18b); `NEW` is that
**"View Portal" sits in the top bar of every organizer screen**, and its dropdown carries
**"View portal as…"** (search a contact → open their real portal read-only).

A newer nav grouping is shipping behind Early Access — **Program · CRM · Marketing · CMS ·
Attend** — which is where `Program → Forms`, `Program → Evaluations`, `Program → Agenda`,
`Program → Site` and `Deliver → Embeds` paths in the newer docs come from. `NEW`: our flattened
`Program / Collect & Review` grouping is closer to their *new* IA than their old one.

### Canonical vocabulary (corrections + additions)

| Term | Meaning | Note |
|---|---|---|
| **Contact** | a person on the event. The root record. | `CONFIRMS` |
| **Speaker** | a contact with a speaker role **on ≥1 session**. The Speakers module is a *derived view*, not a table — "a new contact must be assigned to a session before they appear in the Speakers module". | `NEW`, and it explains a real bug class |
| **Additional Contact** | an assistant/EA linked to a primary contact; can be CC'd on all mail and can log into **the primary contact's portal** to complete tasks on their behalf. Up to 3 importable per contact. | `NEW` |
| **Group** | sponsor or exhibitor org. Group portals are shared by several colleagues. | `CONFIRMS` (out of scope) |
| **Portal** | not one screen — a *segment*. Every event has **Default People / Default Exhibitor / Default Sponsor** portals; admins create **custom portals** defined by a **filter**, and a contact is auto-assigned to the **first portal in list order whose filter they match**. | `NEW` — big one |
| **Task / File request / Form** | the three portal work-item types. Assigned **to a portal**, not to a person (though direct per-record assignment also exists). | `NEW` (we model tasks per-person only) |
| **Resource / Wiki page** | editable page rendered in the portal. | `CONFIRMS` (struck by swyx) |
| **Session status** | 5 built-ins + **admin-defined custom statuses**, each mapped to a *category* that determines behaviour. | `NEW` (custom statuses) |
| **Subsession** | a child session inside a parent session's time window (max 200/event). | `NEW` |

---

## 2. Organizer journey, end to end

### 2.1 Setup

The vendor's own **onboarding checklist** gives the canonical order (`/get-started/onboarding-checklist`):
`NEW` — this is the sequence their CS team teaches.

> Event name → Event slug → Timezone → Event dates → Event logo → Portal background images →
> Record settings → **then modules in order:** Speaker management → Session submission forms →
> Agenda building → Sponsor management → Exhibitor management → Evaluations → Portal configuration.

**Settings → Event Details** (`video-event-settings`): Event Name · Slug (`app.sessionboard.com/<slug>`)
· Event Type · Event Website URL · Event Location · Timezone · Starts At / Ends At (calendar picker)
· **Theme** ("describe the core focus or theme of your event") · Logo (**300×300**) · Background
image (**1500×500**, "we recommend using an abstract image", no words). Save at bottom.
`CONFIRMS` most; `NEW`: exact dimensions, and that **Event Type / Website URL / Location / Theme
are the four fields that feed the AI features** — they are documented as AI context, not decoration.

**Settings → Record Settings** (`video-settings-record-settings` + `/events/event-details`) — `NEW`, we have none of this:
- **Set submission limit** — max sessions one user may submit *across all forms* (form-level limits must fit inside it).
- **Automatically provision contact portal access** — grant portal access on add/import.
- **Collect additional contacts** — on by default.
- **Enable primary speakers** — designate a "Primary" speaker per session.
- **Enable Participant Acceptance** — participants accept/decline **each role they hold**, per submission.
- **Enable speaker headshot limitations** — enforce type/size/dimensions; blocks non-conforming uploads (no auto-downsize).
- **Enable sponsor & exhibitor logo limitations** — auto-downsizes instead.
- **Record IDs** — 3–6 uppercase-character prefixes for submissions / contacts / groups (this is where `SESS-36`, `SESS-28` in the frames come from), plus "keep parent ID on subsessions".
- **Layouts** — controls which fields appear (and in what order) in the *Add Contact* modal.

**Sessions → Settings** (a.k.a. Program settings) — 11 sub-pages in a left rail:
`Agenda · Criteria · Personas · Rooms · Tracks · Tags · Levels · Formats · Languages · Files · Statuses`.

| Sub-page | What it holds | vs us |
|---|---|---|
| **Agenda** | Day Start Time / Day End Time · **Interval** (creation & resize increment) · **Agenda content** (session-based / abstract-based / both) · **Session Statuses to show on the agenda** (multi-select chips — default `Accepted` + `Accept Queue`) · **Session Format → Default Duration** rows (`Lightning Talk 15min`, `Session 1h 30min`, `Keynote 1h`, `+ Add format`) · **Room Visibility** (Show all rooms / Select individual rooms, chips) | `NEW` — every one of these is a gap |
| **Criteria** | saved natural-language scheduling rules reused by the AI agenda builder | `NEW` |
| **Personas** | AI virtual evaluators: Name* · Role* · Biography · **Feedback style** (Positive / Neutral / Constructive / Critical) · up to 3 **Likes** and 3 **Dislikes**. 3 uneditable defaults ship. | `NEW` (AI eval is out of our scope, but personas explain the AI-eval data model) |
| **Rooms** | Name · **Order** (left-to-right in the agenda embed; ties → alphabetical) · **Capacity** (limit 100,000; visible in agenda, *not* in embeds) | `CONFIRMS` + `NEW` (order semantics, capacity ceiling) |
| **Tracks** | Name + colour. Colour drives card colour in day/week/room views — **not month view**. | `CONFIRMS` + `NEW` (month exception) |
| **Tags** | multi-select, colour + order optional | `CONFIRMS` |
| **Levels / Formats / Languages** | name + order, single-select | `CONFIRMS` |
| **Files** | **Enable File Upload** toggle → reveals due date · accepted file types · max files per session · **file size limit (max 1.95 GB/file)** · **Enable comments** | `NEW` (all of it) |
| **Statuses** | full custom-status CRUD | `NEW` (see below) |

**Custom statuses** (`NEW`, frame-verified in `decline-sessions`): a table with columns
`Name · Category · Color · Order · Sessions · Created By · Created At` and an **Add Status**
button. The five built-ins ship as `Created By: System` — Accepted (green, order 10),
Accept Queue (green, 20), Pending (amber, 30), Decline Queue (amber, 40), Declined (red, 50).
A new status takes **Name · Category · Color · Display Order · "Show custom status name"**
(when off, portal users see the *category's* wording instead of the custom name). Every status
**maps to a category and inherits its behaviour** — an "Accepted-category" status syncs to
integrations and lands on the agenda. Examples given: "Accepted with pending revisions",
"Cancelled". The `Sessions` column is a live count per status.

**Event Team** (`video-event-team`): **Invite User** (email, first, last, **role**, **tags**);
tags are reusable in evaluation-plan assignment. Roles: defaults (not deletable) + custom roles
built by toggling permissions; **Portal User** is auto-assigned to every event contact. Row
actions: Edit · **Copy Invite URL** · Resend Invite · Remove · **Unlock Account** (accounts lock
after **5 failed logins**; unlocking auto-sends a reset email). Two roles — **Session Manager**
and **Evaluator Session Manager** — take a **filter** that scopes which sessions/speakers they
can see. **Field-level permissions** per role: every field is `View` / **`Lock`** (visible,
uneditable) / **`Hide`**. `NEW` — field-level role permissions and the filter-scoped roles are
both absent from us.

### 2.2 Build the form

`Sessions → Forms`. **Up to 20 forms per event** (the video says "up to a maximum of 24" — the
docs say 20; treat 20 as current). A **default form already exists** on every new event. Form
row `⋯`: **Edit · View Submissions · View Draft Submissions · View Form · Duplicate · Delete**
plus **Copy Link** on hover. `NEW`: *duplicate a form*, *view draft submissions as a separate
list*, and the fact that a starter form is pre-created.

**The classic builder is 4 pages**, not 7 (`video-session-submission-form`):
`Welcome Screen · Session Information · Speaker Information · Form Settings`.
**Sessions 2.0 is 7 steps**: `Submission Setup · Welcome Screen · Session Information ·
Participant Information · Payments & Fees · Form Settings · Notifications` — which is exactly
our wizard, minus payments. `CONFIRMS` our shape is the current one.

Details worth copying:

- **Page headings are limited to 15 characters** (stated three times in the video). `NEW`
- **Title is the only permanently-required session field** in 2.0; Description became optional. Each field row shows its **type and constraint under the label**: `Text · Max 10 chars`, `Wysiwyg · Max 5,000 chars`. `NEW` — that inline type/limit hint is a nice, cheap fidelity win.
- **`+ Add Field` opens three routes**: *Add Section Element* (Section Header / Rich Text / Divider), *Create Field*, or **search the event's existing field library**. Hovering *between* two rows reveals a **blue `+`** to insert a layout element inline. `NEW` (the blue inline `+`).
- Per-field `⋯`: **Customize question** (Custom Label · **Placeholder** · Help Text · Required) · **Edit field** (changes the underlying field definition — *affects every form using it*) · **Use question rules** (conditional logic) · **Remove from form** ("without deleting it, allowing it to be used again"). `NEW`: Placeholder as a first-class per-question setting; the remove-vs-delete distinction; the shared-field warning.
- **Conditional logic works only on Checkbox, Dropdown and Number fields**, the rule attaches to the *dependent* question, and **all fields must be created and saved before rules can be applied**. `NEW` — we allow `showIf` on any type; theirs is narrower, and their ordering constraint is a real UX rule.
- **Field level**: `Event field` (this event only) vs **`Global field`** (reusable across every event in the org). Field **type is immutable after save** — delete and recreate. Field **description** is internal-only and **field names are visible to evaluators**. `NEW`
- **Text = 255 chars, Text area = 5,000 chars**, customisable within those ranges. `NEW` (exact ceilings)
- Participant roles: three core categories **Speaker / Chairperson / Moderator**, each with **Min/Max**, plus a **Total min / Total max across all roles**, plus **`Check participant limit`** as the master enable. 2.0 adds **custom role labels** mapped onto the three categories (e.g. "Author"→Speaker, "Co-author"→Chairperson) and **conditional participant limits**: `+ Add rule` → **WHEN ALL MATCH** (field/operator/value) → **THEN APPLY PER ROLE** (min/max overrides) → optional **Total Participants Override**; *first matching rule wins*. `NEW` — a real differentiator; we only have speaker min/max.
- **Speaker limit: max 15 per submission through the form**; admins may exceed it from the back end. `NEW`
- **Unique Contact Settings**: *"Allow users to submit new information for existing contacts"* (off ⇒ the existing contact must log into the portal to update their own data) and *"Notify existing contacts that they have been added to a submission"*. `NEW` — this is the co-speaker-collision problem, solved.
- **Form Settings**: Close Date (date + time + timezone) · **Set Submission Limit** (must be within the event-level limit) · **Automatically redirect to the user's portal after 10 seconds** (the number is theirs; we use 3 s) · **Customize the success page message** · **Send Reminder Email** — fires at **5 days and 1 day before close**, to submitters **with drafts in progress**, body editable under Settings → Email Templates. `CONFIRMS` + `NEW` (5-days/1-day cadence, draft-only targeting).
- **Cross-field character limits**: `Add rule` → **Rule name** · **Combined character limit** · **Fields in this rule** · **Custom error message**. All fields in a rule must be from the same step; a speaker-scope rule counts **per speaker**, a session-scope rule counts once. Rich-text formatting is stripped before counting; whitespace counts; submitters see a **live counter per rule**. If a referenced field is removed the rule flags itself. `NEW` — full spec for TODO item [22].
- **Notifications step**: two admin-recipient pickers (*"What admins should be notified when a new session is submitted?"* / *"…when an existing session is updated?"*) plus three toggleable, **Customize**-able templates: **Submission Confirmation** (to submitter), **New Submission Alert**, **Submission Revision Alert**. `CONFIRMS` our fixed [1]/[2].
- **Preview** before publishing; the form is shared **by link only — it cannot be embedded**; there is **no open date, only a close date**. `NEW` (both facts).
- **Extending the close date re-opens editing for existing submissions** — this is the documented way to let speakers add co-speakers late. `NEW` — and it's the counterpart to sbek CFP-16.
- **Portal forms are a separate builder** (`Portals → Forms`): 3 pages — *Form Set Up* (Internal Form Name · External Form Title · Page Heading) · *Form Questions* (Section Title · Description & Instructions · `+ Add Field`) · *Form Settings* (**Send confirmation email** → emails the contact **a PDF of their own responses**, with an editable body). Types: **Contacts / Groups / Sessions**. Pre-existing data **pre-fills** the form so the user reviews-and-updates rather than retypes. Results have their own **View Submissions** table with Columns/Filters/Sort, CSV/XLSX export, and **Download Forms** (PDF, only available if the confirmation email is enabled). `NEW` — this is the complete spec for TODO item [13].

### 2.3 Collect

Public submitter flow (`/participants/*`): open link → **Save as draft** needs only a **Title**;
a banner reads *"you are editing a draft submission"*; returning to the link **prompts you to
resume**, and **"Reset saved data"** discards it. Required fields still gate page-to-page
progress. `NEW` — the resume prompt and the discard control.

Organizer-side draft visibility: `Sessions → Submissions → **Drafts**` tab (title, submitter,
**source form**), *or* `Forms → ⋯ → View Draft Submissions`, and the **dashboard shows a
submissions + drafts count per form**. `CONFIRMS` mostly; `NEW` is the per-form draft count.

**Manual creation**: `Sessions → Submissions → + Add` opens a modal with pages
**Details / Other / Participants** — Title and Status required; participants are searched from
existing contacts only ("if a participant doesn't appear, create them first in Contacts").
Custom fields live **at the bottom of the session profile**, or can be edited **inline in the
table** once added as a column. `NEW` (inline table editing).

**Importing** (`/settings/importing-data`) — `NEW`, we have none of it:
`Options → Import` in any module. Flow: **Generate Import Template** (reflects the module's
*visible columns* — a custom field must be in the view to be importable) → upload CSV/XLSX or
paste → header-row question → **map your fields** → red-highlighted invalid cells, click to fix
→ Submit. Rules: **UTF-8**, **1,000 records per file**, phones as `+1 (123)456-7891`, multi-select
values pipe-separated (`Convertible | Two Door`), datetimes as **`YYYY-MM-DD HH:mm`**, currency
and file fields (except headshot) not importable. To *update* rather than insert: export first,
add a **`Update record if already exists`** column set to `TRUE`, and set **`Ignore this column`**
on the mapping screen for anything you don't want touched — **an empty column blanks the field**.
`Session Friendly ID` is the match key; leave blank for new rows.

### 2.4 Review & decide

**Submissions table** (frame-verified, `decline-sessions`) — the structure is a **left inspector
rail plus a table**, not a toolbar of dropdowns:

```
┌ Sample ▾            ┐  Submissions                          [Search…] [Options ▾] [+ Add]
│  ✎ Edit View        │  View All (11) · Accepted (8) · Accept Queue (0) · Pending (1)
│  ⧉ Show/Hide Fields │  · Decline Queue (0) · Declined (2) · Drafts (0)
│  ▽ Filters  + Add   │  ☐ ✎ | Status | Title | CEU Credits | Description | Starts At | …
│  ↕ Sort By  + Add   │
└─────────────────────┘  11 rows                                        Show: 100 ▾
```

- **Saved views are first-class**: the view has a *name* ("Sample"), an **Edit View** action, and Rename/Delete. Columns (max **25 fields per view**), Filters and Sort all belong to the view and **must be saved separately after Apply Changes**. `NEW`
- Filter operators: `contains · does not contain · is · is not · is empty · is not empty · starts with · ends with`, plus a **"Must match all filters"** AND toggle. `NEW`
- **Pagination `Show: 100`** matters — every bulk operation (emails, file downloads, headshots) is capped at **100 records/page**, and the docs repeatedly tell you to raise pagination first. `NEW`
- Bulk bar: `N Selected | ✎ Edit | ✉ Send Emails | ⬇ Download Files | Delete | More ▾ | Clear selected`. **Bulk Edit** is a generic modal — *Field to update* → *value* → **Update**, with the warning *"If you have existing data in this field, it will be removed and replaced with your current selection."* **More** holds *Duplicate Sessions*. `NEW` — a generic bulk-edit-any-field, not just status.
- **Duplicating a session resets its status to Pending and does not copy files.** `NEW`
- Inline status editing: click the pill → dropdown of coloured status pills with an `✕` to clear. `CONFIRMS`
- Session profile (pencil icon) tabs: **Details · Other · Files · Subsessions · Connections · Participants · Messages**. Details carries `Session ID` (e.g. `SESS-36`), Title, Status, **CEU Credits**, **Starts At / Ends At** (date + time pickers), Description (rich text), **Save Session** + **Open full page ↗**. `NEW` (Messages tab, Connections tab, Open-full-page).
- **Changing a status never emails anyone.** Stated twice, in bold, in the docs *and* the video. `NEW` and important: their queue statuses exist **because** decisions and emails are decoupled — teams stage in Accept/Decline Queue, then send a templated email from the Sessions module, and the portal shows queued items as plain *Pending* so the email lands first. Our auto-send-on-commit is a deliberate improvement, but the **"Pending in the portal" masking rule** is theirs and we should keep matching it.
- Options menu: **Export CSV / Excel**, **Import**, **Sync to <integration>**. Exports respect the current view's columns; file fields export as **public URLs**. `NEW` (URL-export behaviour).

**Evaluation** — module tabs `Summary · Evaluation Plans · My Evaluations · Personas`. `CONFIRMS` the
missing tabs we have on the TODO.

Plans table: `Name · Status · Evaluators · Sessions · Total Evals · Progress · Due Date · Actions`.
Status values seen: **CLOSED** (amber), **REVIEWING** (blue). Row `⋯`: **Review · Edit · Open ·
Export · Duplicate · Delete**, plus *Open and notify evaluators* / *Open and do not send
notifications* and **Notify New Evaluators**. `NEW` (the two open-modes; Duplicate).

Plan wizard (classic, frame-verified): `Type · Configuration · Evaluators · Session Filters ·
Display Fields · Grading Options`.
- **Type**: two cards — *Assign Evaluators* vs *Virtual Evaluators* (AI personas).
- **Configuration**: Name*, Instructions* (rich text), toggles **Set Plan as Open** · **Enable Anonymized Review** · **Enable Weekly Reminders** ("weekly and 1 day prior to the due date") · **Include Uploaded Files**.
- **Evaluators**: dual-pane picker — left "Select Evaluators" with Select All/Remove All and a live "*N* Evaluators found"; right **Invited Evaluators (n)** and **Added Evaluators (n)**. Evaluators must already be event-team users, and **the plan must be closed to assign them**. `NEW`
- **Session Filters**: rule rows with the stated semantics *"Multiple criteria in one filter act as ORs; multiple filters act as ANDs"*, an **AND** chip between rows, `+ Add filter row`, `Clear all`, and a live green banner **"N sessions match this filter"**. `NEW` — the live match count is excellent UX and cheap for us.
- **Display Fields**: "Fields will be visible to evaluators when grading submissions" — tabs **Session Fields / Speaker Fields / Evaluation Fields**, a right-hand **Visible fields (13)** basket with per-chip `✕` and *Remove all* per group (SESSION DETAILS / SPEAKER DETAILS / EVALUATION FIELDS), and a `Select Defaults` shortcut. The Speaker tab shows a banner **"Anonymized View will not show speaker names to evaluators"** with the anonymise toggle inline. **Evaluation Fields are the scorecard questions** — shipped examples: *Internal Comments* (Textarea), *External Comments* (Textarea), *"Should we accept this session?"* (Dropdown), *"Interest in helping to develop this session?"* (Dropdown) — plus **Create New Field** and a per-field **Customize field** modal (Set as required · Label · Help text). `NEW` — internal-vs-external comments is a distinction we don't have.
- **Grading Options**: **Rating Icon** radio — ★ stars, ♥ hearts, ☺ faces, `1 2 3 4 5` numbers — where **stars/hearts scale up to 20 and faces/numbers max at 5**, with a numeric stepper *and a colour swatch* to brand the icon. **Enable Rubric** → `CRITERIA | WEIGHT (%)` rows with a **slider** per criterion, `✕` delete, `Add Criteria`, and a live validation banner **"Looks good! All values added together equal 100%."** (criterion label max 255 chars). **Set Evaluation Limits** → *"Select how you want to distribute sessions for evaluation"* → **Session limit** → *Number of evaluations per session* with the note *"This plan currently has N evaluators."* **Grading options cannot be edited once the plan is created.** `NEW` — the weighted-rubric UI is a complete spec for TODO [15].

Sessions 2.0 replaces this with **rounds** (`/evaluations/setting-up-round-based-evaluations`) —
a 4-step wizard `Overview · Rounds · Evaluators · Assignments`:
- Rounds carry their own name, type, deadline, scorecard, anonymisation and evaluator pool; **Funnel** (must be promoted between rounds) vs **Parallel** (all rounds at once).
- **Scoring Method: Percentage-based vs Points-based.**
- Scorecard question types: **1-3 / 1-5 / 1-10 scale · Numeric Score (custom min/max) · Custom Dropdown with point values ("Accept = 3, Revise = 2, Reject = 1") · Free Text · File Upload · Separator**.
- **Reviewer View Configuration**: *Visible Fields to Reviewers* · *Filterable Fields for Reviewers* (checkbox/dropdown/multi-select only) · **Submission Card Fields** (Title fixed + up to 3 more) · *Visible Participant Fields to Reviewers*.
- **Assignment wizard**: *Which submissions?* (all-in-scope / by filters / individual) → *How distributed?* (**All to All** vs **Individual Reviewer**) with **workload constraints — "Reviewers per submission" and "Max submissions per evaluator"** → *Review & apply* with a live **Impact Preview** (filtered submissions / evaluators in round / new assignments) and a merge mode: **Add to existing · Replace not-yet-reviewed · Replace all (including reviewed)**.
- **Abstaining** per round: *Allow reviewers to abstain* (on by default) · *Require a reason* → **Free text** or **Select from a list of options** you define.
- **Show Scores From Other Evaluators** toggle.
- Plan deep-dive tabs: **Submissions** (ID · Title · Evaluators · Progress · Avg score · Status; Grouped/Flat) · **Rounds** (bulk **Promote to next round / Demote to previous**) · **Evaluators** (per-evaluator `⋯`: **Resend invite email · Edit assignments · Remove from plan**) · **Review**.
`NEW` — the per-reviewer caps + auto-distribute + COI/abstain + impact preview are collectively TODO [15]/[16] with a full design.

**Evaluation Summary** page: `# of Evaluations · # of Evaluated Sessions · # of Evaluation Plans ·
# of Evaluators`, **Highest and Lowest Scoring Sessions**, Completion Status chart, **Average
Session Score by Plan** bar chart, **Top 10 Sessions**, and — `NEW` and genuinely clever —
**"Thought-Provoking" Sessions: sessions that received a wide range of evaluator feedback from
the highest and the lowest score** (i.e. rank by score *variance*). 2.0 adds Started / In progress
/ Complete counts split across **Assignments** and **Evaluators**.

Reviewer experience: magic link (no password, no account) → **My Reviews** ("Manage your assigned
review tasks across all programs") → plan cards (name, Active/closed badge, round count, Overall
Progress, "0 / 0 submissions") → round view with a **Reviewer Instructions banner**, **Quick Jump
(Pending / Reviewed counts)**, filters (search, Track, Language), submission cards with
`Pending Review` / `Reviewed` badges → split review screen: **Submission Details** left,
**Score Submission** right, `*` on required questions, an **Abstain — "Conflict of interest or
cannot review"** control at the top of the scorecard, a yellow **"You have unsaved changes"**
banner, and **Save Review** with a **"Go to next submission after saving"** checkbox. Reviewers
may revise while the round is open; evaluations lock when it closes. Evaluators see *nothing*
else in the event — the docs state this explicitly. `NEW`: the unsaved-changes banner, the
go-to-next checkbox, the Quick Jump counts, and the hard-scoped role statement.

### 2.5 Onboard speakers (portals)

**Portals is a segmentation engine.** `Portals → + Create Portal` → internal name → **People
portal** or **Group portal** → build a **filter** (contact fields, contact roles
Speaker/Moderator/Chairperson/Submitter, and a *limited* set of session fields: **track, tags,
format, level, language** only) → the participant list auto-populates with a live count →
*Save & customise*. Multiple filters AND together. Anyone matching nothing lands in the
**Default Portal**. Contacts match **one portal only — the first in list order**, and order is
changed by a **pencil → drag-and-drop**. Portal cards show *"Filters: 1 · Assigned to: 5"* and
a created-by line. Row `⋯`: **Copy Link · Edit Criteria · Edit Tasks · Edit Settings · Edit
Appearance · Duplicate · Delete**. **Every portal shares the same login URL**
(`app.sessionboard.com/portal-login/<event-slug>`) — routing is by identity, not by link.
`NEW` — all of it.

The portal editor is a 4-step tracker: **Select participants · Assign items · Configuration · Appearance**.

*Assign items* is a set of widgets — **Assign Tasks · Collect Form Submissions · Collect Files ·
Share Files · Assigned Pages** — each with `[Assign …] [Manage …] [Learn more]`, an assigned
count, and a table `Name · Alias · Due Date · Extended Due Date · Required · Actions`. Per
assignment: **Alias** (rename the item for this portal) · Required toggle · Due Date · **Extended
Due Date** · **Make Completed Tasks View-Only** · **Assign By Filter** for session items
(max **3 filters**). `NEW` — Alias and per-portal assignment settings are both new to us.

*Configuration* toggles, verbatim: `NEW`, none of these exist in our portal
- **Control Session Visibility** — "Display sessions to portal users. If this is off, sessions will not be shown to speakers or submitters."
- **View Session Submission Form from Portal** — "Let users access their submission via the submission form."
- **Always Show Tasks** — "Display portal tasks to all users. If unchecked, tasks will only be visible to speakers with approved sessions." *(This is their answer to "a portal for accepted speakers only".)*
- **Extend Task Deadlines** — "Let portal users complete past due tasks for a specified period of time." → **Final Deadline** select, default **"31 days after deadline"** (the docs elsewhere say the default is 7 days — treat the control as the truth, the number as configurable).
- **Manage Profile** — "Allow portal users to view and edit their profile information."
- **Manage Related Sessions and Participants** — "Allow portal users to edit related sessions and participant information." *(off by default; this is what lets a speaker add a co-presenter)*
- Reminders: **Send Weekly Digest Email** ("a weekly email summary of portal actions and upcoming tasks by due date" — Mondays 07:00 UTC) and **Email Notifications** ("Send an email to primary contacts when tasks are assigned to this portal"). Both only reach contacts who have logged in at least once.
- **Participation sections** (when acceptance is on): three sections — **Invited Sessions · My Submissions · Confirmed Participation** — with toggles *Show a separate Confirmed Participation section* and *Show subsessions in My Submissions*, and **renameable section titles (100 chars each)**.
- **Task display order**: **Smart** (sort precedence `Required > Incomplete > Type > Due Date > Name`) · **Due Date** · **Custom** (drag-and-drop across two tabs, *My Tasks* and *Submission Tasks*). `NEW` — a precise, copyable ordering spec.

*Appearance*: **Title** ("Home"), **Welcome Message** (rich text), **Logo Image** (100×100),
**Background Image** (1920×200), **Accent Color** (hex + swatch), and **Advanced Custom CSS Code**
with the note *"This can break existing styles. Recommended for expert users only."* — all
rendered against a **live portal preview panel on the right**. `NEW` — the live preview is a
strong, very cheap UX win for us.

*Manage Fields*: sub-tabs `Contact Fields · Session Fields · Contact Participants · Group
Participants`; table `Name · Category · Type · Level · Created At · Updated At · Actions`; a
**Show/Hide Fields** picker; per-row `⋯` → **Lock** (view-only) or **Remove**. `NEW` — per-portal
field visibility and locking.

**Work items.** All three live under `Portals` as their own libraries and are then *assigned* to
portals:

| Type | Creation fields | Limits |
|---|---|---|
| **Task** (`Portals → Tasks → + Add Task`) | **Task*** (100-char counter) · **Type*** as three icon cards — **People (Contacts, Speakers)** / **Groups (Sponsors, Exhibitors)** / **Sessions (Sessions)** · **Description**: radio *Enter Description* vs **Use Field** (bind to a contact/session field so every user sees their own text) · **Task Link**: radio *Enter Task URL* vs **Use Field** | list columns `Name · Type · Method · URL Value · Actions` |
| **File request** (`→ File Requests → Create Request`) | Title · Type (People/Groups/Submissions) · **Instructions** · **Include sample file(s) with this request** | **exactly one file per request**, ≤1.95 GB; versions allowed |
| **Portal form** (`→ Forms → Add Form`) | see §2.2 | unlimited |

`NEW`: the **Use Field** binding (per-recipient personalised description *and* link) is a genuinely
good idea and cheap for us; so is **sample files** on a file request.

Tasks can also be assigned **directly from a record** — in Contacts/Sponsors/Exhibitors, the task
is a **column**, and clicking its `+` assigns it (confirm dialog → click again → **Options** for
due date/required). Bulk: select rows → **Assign ▾ → Task / Forms / File Requests** → pick →
set due dates/required/close-on-complete → **Assign**. Tasks assigned via a portal **cannot be
unassigned from a record**. `NEW`

**The task status icon legend** (identical on three doc pages, so it is canonical) — `NEW`:

| Icon | Meaning |
|---|---|
| 🟢 Green check | Task is complete |
| 🟡 Yellow clock | File request **pending approval** (new *and* declined submissions) |
| 🟠 Orange checklist | Task assigned **manually**, not completed |
| 🔵 Blue circle / blue file | Task assigned **via portal**, not completed |
| ⚪ Grey plus | Task **not assigned** — click to assign |

**File-request review**: `Portals → File Requests → ⋯ → View Submissions` → pencil per contact →
hover the filename to open, download icon, **green check = Approve / red ✕ = Deny**, and
`⋮ → Revert to pending`. **Denying does not notify the contact** — the docs recommend messaging
them. Denied ⇒ the contact may upload a **new version**. There's a **messaging thread per file
request**, with emails both ways: *"<Admin Name> sent a message about "<Task Name>" in <Event Name>"*
and the mirror for contact→admin (which goes to **every admin with Portal Tasks access** and
**cannot be disabled**). `NEW` — a per-item message thread is a notable capability.

**Session files** are a *separate* system from file requests: enabled in `Sessions → Settings →
Files`, uploaded by any speaker with portal access or by an admin (session profile → **Files**
tab), with **file type** (`Presentation` default / `Poster` / `Handout`), **versioning**
(**History** / **Expand All** to see all versions) and **comments** (author + timestamp,
admin-vs-speaker labelled, **no email notification on a new comment** — called out as a known gap).
A **Files** column can be added to the sessions table showing which sessions have files and how
many (excluding versions). Bulk export: select sessions → **Download Files** → **"Group files by"**
→ **Generate Download** → *"You will receive an email once the file is ready"* (subject
**"[Sessionboard] Your file is ready"**); only the **latest version** of each file is included.
The unified **Download Files** modal (from Contacts/Speakers/Sessions) is a 3-step wizard: pick
**file types** (Form file uploads · Headshots · File requests · Session files · Custom field files ·
Awards files · Speaker contracts) → pick grouping (**By submitter / By field / By record**) →
review **estimated file count and size** → Generate → **Download zip**. `NEW` — the file-type
picker + grouping + size estimate is a much better bulk download than ours.

Frame-verified detail on that modal (`video-session-files`): the header reads
*"Download 5 files for 5 selected sessions"*, with **"Group files by: Date · Room · Session"** as
inline links opening a **Folder Structure** sub-modal — *"Select how you would like content to be
grouped in the export"* → **GROUP FIRST BY** (`Content Type · Session Date · Room · Session`).
Below it renders the **actual folder tree it will produce**, with a checkbox per file so
individual files can be excluded. **Generate Download** carries the note *"We will generate a file
and send you an email with the link when it's ready. This could take up to 10 minutes depending on
how many files are selected"* — i.e. the whole thing is **async with an email hand-off**, subject
**"[Sessionboard] Your file is ready"**. The **central files library** lives at `Content → Files`
("Manage files attached to sessions in your agenda") with columns
`Name (icon + type + size) · Session · Uploaded At · Uploaded By · Comments · Last Comment At ·
Actions`, and the submissions table can show a **Files** column rendering *"1 Attached"*.

### 2.6 Schedule

`Sessions → Agenda`, view tabs **List · Day · Week · Month · Rooms**, plus **Conflicts**,
**Embeds** and **Settings** as sibling tabs, and **Drafts** + **Options** + **`+ Add`** in the
toolbar. `CONFIRMS` our five views (we ship List/Day/Week/Track/Rooms — **they have Month, we
have Track**; the brief names "list, day, week, track, or room", so we match the brief and they
don't).

- Only **Accepted** sessions appear by default; Agenda Settings widen that to any status set.
- The right rail splits **Scheduled (n) / Unscheduled (n)**, grouped under date headers (`TUE, AUG 5`), each card showing time range + status chip. `CONFIRMS` our tray.
- **Rooms view** has a **zoom control** ("zoom out to see all rooms without scrolling") and a **timeline icon that flips rooms onto the x-axis**. `NEW`
- **Conflicts** page: *"View sessions where speakers or locations are shared with other sessions in the same timeslot"*, a **"Refreshed <timestamp>"** stamp — **conflicts only recompute on refresh** — an **Unresolved** table `Session ID · Title · Conflicts` with a prose explanation per row and an **Open** action. Conflicting sessions carry a **red dot** in the calendar views. `CONFIRMS` (and ours is live, which is strictly better — say so).
- **Default duration per format** auto-sets the end time when you drop a session. `NEW` — small, high-value.
- **Subsessions**: created from the parent's **Connections** tab → *Create subsession*; must fall inside the parent's window; **speakers are linked both ways**; moderators/chairpersons and sponsors attach to parents only; ordered chronologically then alphabetically; shown in the agenda as an **icon on the parent card** with a **hover summary**; dragging the parent carries them. Max 200. `NEW`
- **AI agenda builder** (`Agenda → Drafts → Create New Draft`): *Setup* (confirm dates/session count/rooms) → *Settings* (Day Start/End, which **Session Statuses** to include, **Ignore Existing Times/Rooms**) → *Rooms* → *Rules* (type a rule + **Add Criteria**, or pull from saved **Event Criteria** / AI-**Suggested**; **order = priority**, drag to reorder) → **Next & Generate Schedule** → "Agenda Generated" → **Review Agenda** / **See What Changed** → **View & Commit Changes** → per-change **Accept** or **Accept All Changes** → **Commit Changes**. Drafts are fully isolated from the live agenda; `⋯` → Delete / Duplicate. `NEW` — this is the *right* shape for our auto-place feature: a reviewable diff, not a mutation.

### 2.7 Publish

Two publishing surfaces:

**Embeds** (`Sessions → Agenda → Embeds`, or `Deliver → Embeds` in the new IA) — "Export a feed
of your agenda, sessions, or speakers to place in your app or website." Saved embeds are
**grouped by format with counts** (`Styled HTML 4`, `JSON 1`), each card carrying an
**Enabled** state and `⋯ → Edit · Get Code · **Refresh Cache** · Delete`. **Embeds auto-update
every 60 minutes**; Refresh Cache forces it. **The data type cannot be changed after creation** —
make a new embed. `CONFIRMS` + `NEW` (grouping, enabled flag, cache semantics).

Add Embed wizard: `Select Type · Style Options · Filters · Field Options · Get Code`.
- **Types**: Schedule itinerary · Speaker gallery · Agenda · Session list · Speaker list. **Formats**: **Embed Styled HTML · Embed HTML · JSON · XML · iCal**.
- **Style Options**: Website Color Theme (Light/Dark) · **Primary Color** (hex) · **Date/Time Format** (e.g. `English (US) Fri, June 3, 2022 at 11…`) · **Extra CSS Code**; plus **Embed Options** checkboxes — *Click session or speaker to open pop-out view* · *Display schedule in browser timezone* · *Show add to calendar button* · *Search session/speaker by name* · *Order session speakers alphabetically* — and **Show filters**: *Filter sessions by format / language / level / location*.
- **Filters**: rule rows (`Ends At` `is after` `04-04-26`) with a live green **"2 sessions and 68 speakers match this filter"** and the caveat *"Some embed styles will not show sessions if they do not have a start and time defined."*
- **Field Options**: three columns — **Agenda**, **Speaker**, **Session** — each with **Select All**, choosing which fields render where. **Grey = required, blue = preselected and customisable.**
- **Get Code**: one `<script>` + one custom element per widget, with **Copy** and **Preview** buttons per widget, and the warning *"Do not use multiple codes on the same webpage."*
- Documented search behaviour: itinerary & session list match **session titles and speaker names**; speaker gallery & list match **speaker names only**; descriptions, tags, levels, audience and custom fields are **excluded from search**. `NEW` — a precise, testable rule.

**Program Site** (`Program → Site`) — `NEW`, and a real gap in kind, not just degree: a single
branded URL (`sites.sessionboard.com/s/<slug>`) that aggregates **every** program interaction —
all open CFP/abstract/awards/interest forms, plus **reviewer access to evaluation plans and
rounds** — with settings for *Site URL · Landing page & login (Standard email / SSO, logo,
gradient colors, Google Font, custom HTML/CSS/JS) · Logged-in experience · Available programs
(choose & reorder) · User information (required fields + privacy notice) · Custom pages*. This
is how reviewers and submitters both get in: one link, magic-link login, everything behind it.

Also `NEW`: **per-speaker public visibility.** Every session participant has an **eye icon**
toggling `is_public`; hidden speakers drop out of embeds and return `is_public: false` from the
API. Use case: embargo a keynote until announcement. Independent of acceptance status.

### 2.8 Communicate

**Email Templates** (`Settings → Email Templates`, `+ Add Template`): **Template Name · Type
(Groups / Contacts / Sessions) · Reply To (one address only) · Send From (custom-domain add-on
only) · CC (≤5) · BCC (≤5) · Subject Line · Message Body** with merge tags. Templates sort
**alphabetically**, unlimited count; four are built-in and undeletable: **Accept · Decline ·
One Day Reminder · Five Days Reminder**. **Changing the Type after writing the body invalidates
the merge tags.** Row `⋯`: edit / delete / duplicate. `NEW` — the Type-scoped merge-tag model is
the important part: *a Contacts-scoped template cannot use session merge fields*, which is why
acceptance emails must be sent **from the Sessions module**.

**Email Themes** (`Settings → Email Themes`) — the HTML/CSS wrapper. Tabs **All Themes / Default /
Custom**; **+ Add Theme** starting from **Plain** or **Event Logo**; a drag-and-drop builder with
**Blocks / Pages & Layers / Global Styles / Assets / Templates** panels, desktop-mobile toggle,
code editor and import; **every theme must contain `{{{content}}}`**; theme merge tags are
`{{{content}}} {{{event_name}}} {{{event_logo_image_url}}} {{{recipient_name}}} {{{recipient_email}}}
{{{recipient_phone}}} {{{subject}}} {{{replyTo}}} {{{sendFrom}}} {{{cc}}} {{{bcc}}} {{{emailType}}}`;
`⋯ → Make Default` (★, one per event). **Themes apply only to manually-sent email, not system
mail.** `NEW` — full spec for TODO [19].

**Sending**: select records in Contacts / Speakers / Sessions / Sponsors / Exhibitors → **Send →
Send Emails**. **Max 100 per send** (raise pagination first). Modal: **"Who should receive this
email?"** (e.g. *Session Speakers*, *Session Speakers + Additional Contacts*, *Chairperson*,
*Moderators*, *Participants*, *Everyone*, *Select Individual Contacts*) · **Include Additional
Contacts** sub-select (*Be copied on the email to the primary contact* / *Only send to the
additional contact* / *Do not include*) · **Replies sent to** · Send from · CC/BCC · subject +
body or **Template**. Then a **Review** step that renders **the exact email each recipient will
get, one at a time from the Actions column**, then **Send Emails**. **No attachments** — use
portal files. `NEW` — the per-recipient rendered review step is a strong trust affordance and
cheap for us.

**System email catalogue** — `NEW`, and worth auditing our own surface against:
account & sign-in (reset password, 2FA code, 2FA reset by admin, organization invite, event
invite, org portal magic link) · sessions & forms (**submission confirmation** — subject
`[Event Name] Your session has been submitted`, body editable, **cannot be disabled**;
**submission closing reminder** at 5 days + 1 day; new submission (admin); submission revised
(admin); **added to a submission**; invoice receipt) · portal (**portal assignment notification**,
**weekly portal summary** — Mondays 07:00 UTC, subject `[Event Name] Portal Task Summary - <date>`;
new message / mentioned in a message) · evaluations (**evaluation plan opened** — subject
`[Event Name] Evaluator Invitation`; weekly reminder Mondays 07:00 UTC) · files & reports
(**report ready**, **session content export ready**, scheduled report delivery, **document
request comment**).

**History** module — tabs **Emails · SMS · Integrations · Exports · Audit**. Emails splits into
**Campaigns** (`Subject Line · Module · Total Recipients · Unique Opens · Sent By · Sent At`,
click → detail with recipient list, per-recipient **Status** and **Reason if undelivered**,
Unique Opens/Clicks, preview panel) and **Sent Emails** (`Recipient · Email · Subject · Status ·
Sent By · Sent At`). Status vocabulary: **Delivered · Opened · Clicked · Bounced · Spam ·
Dropped**, each with a documented meaning. **Audit** tab: `Subject · Type · User · Action
(Create/Update/Delete) · Field · New Value · Occurred At`, also viewable per-contact and
per-session. `NEW` — the Audit tab is exactly sbek **CNT-11** (change history with attribution),
and their model (field-level diffs on a generic log) is the cheap way to build it.

The docs are also blunt that **a row in History only proves hand-off to the provider, not
delivery**, and publish their **sending IPs (159.183.10.230, 159.183.207.219, 159.183.47.254)**
for allow-listing.

---

## 3. Participant journey

1. **Get in.** The portal link arrives in the **submission confirmation email**, or the organizer sends **More → Manage Portal Access → Give Portal Access** (email the invite, or copy the invitation link). Subject: *"You've been invited to the <Event Name> portal"*. **New users create a password on first visit**; there is also a **magic-link** path on the newer Program Site. **Forgot your password?** sits bottom-right of the login box. **5 failed attempts locks the account.**
2. **Critical rule (`NEW`, and the single most common support issue in their FAQ):** login is checked against a **Portal Username** field that is **separate from the contact's Email field and never auto-syncs**. Changing Email leaves the portal login (and portal notifications) on the old address. Admins change it via contact profile → **Details → gear → Change Portal Username**.
3. **Pick a portal.** If a person holds several (speaker + sponsor contact + assistant-for-someone-else), they choose after login, and switch later via **name menu → Switch Portals**. Multiple *events* are switched via the **event name / down-arrow top-left**, listed **alphabetically**.
4. **Home** shows the welcome message, **My Sessions**, **My Profile**, and the assigned Tasks / Forms / Files / Resources widgets. Portal tabs seen in the live preview: **Home · Sessions · Profile · Tasks**. `CONFIRMS` our tab set exactly.
5. **Submissions.** *View & edit your submission* — open the session in **My Sessions**, then **View Submission** at the bottom of the sidebar, which re-opens the original form. **Editable only before the close date**; after it, the option is gone. **Save as draft** needs a Title; a banner marks draft mode; **Reset saved data** discards. `NEW`: sessions of **every** status appear in the portal — the docs are explicit that non-accepted sessions **cannot** be hidden from a participant's portal (only removing them from the session or deleting it works), while the public agenda shows accepted only.
6. **Participant acceptance** (when enabled): a **Confirm** button on each accepted session → accept or decline **each role separately** → optionally **Withdraw** the submission entirely (with a reason the organizer sees, and an **undo withdrawal** on the organizer side). Portal status wording is overridable per event (**Portal Status Verbiage**, ≤60 chars, default *"Confirmation Needed"*). Status indicators: 🟨 Pending · 🟩 Accept · 🟧 Decline.
7. **Tasks.** A task row shows **Task name · Required (red asterisk) · Description · Due date (in the event's timezone) · Status (Incomplete/Complete)**. Opening it shows whether the deadline is **Open**, the full description, an **Open Link** button, then **Mark as Complete** or **Done** to leave without changing status. Visiting a third-party link **never auto-completes** a task. `CONFIRMS` + `NEW` (the Open/expired deadline state, the Done-vs-Complete split).
8. **Files.** Portal → **Submissions → session → Files** → drag-drop or browse → set **File type** (Presentation / Poster / Handout) and **File versioning** (mark as a new version of a previous upload) → Upload. **History / Expand All** shows every version. **Comments** thread with admins per file — with no email on either side.
9. **Profile.** Editable only if **Manage Profile** is on for their portal, and field-by-field visibility/lock is controlled per portal. Standard contact fields include **Salutation · Honorific · Pronouns · Gender · Biography (wysiwyg) · Job Title · Company Name · Address / Address Line 2 / City / State / Zip / Country · Home Phone · Mobile Phone · Headshot · LinkedIn URL · Twitter URL · Facebook URL · Website · Languages · Opt-in to receive text message updates**.
10. **Headshots.** Recommended **300×300 square**; do's and don'ts published (face camera, well lit, neutral background; no uneven lighting, no other people, no busy backgrounds). Organizers can enforce a size cap and **bulk compress / bulk resize** existing ones.

---

## 4. Data-model signals worth stealing

`NEW` unless noted. Their **standard field catalogue** (`/concepts/sessionboard-standard-fields`)
is effectively a schema:

- **Session fields:** `CEU Credits (number) · Client Session ID (text) · Description (wysiwyg) · Ends At (datetime) · Format · Language · Level · Location · Speakers · Starts At · Status · Submitter · Tags · Title · Track` — `CONFIRMS` the coverage-matrix #23/#29 gap list exactly, and adds **Location as a dropdown distinct from Room**.
- **Contact fields (44):** everything in §3.9 plus `Annual Revenue · Audience Type · Availability · Brand · Educational Affiliation · Ethnicity · Global Region · Headcount · Highest Level of Education · Industry · Organization Contact · Organization Structure · Past Companies · Preferred Session Format · **Speaker Fee (currency)** · **Speaker Score (dropdown)** · Target Age Range · Topic / Expertise · Years in Operation`. The presence of **Speaker Fee** and **Speaker Score** answers sbek **SPK-15** (travel/logistics/custom fields) — they solve it with a rich standard-field catalogue plus custom fields, not a bespoke "logistics" tab.
- **Field types:** `text (255) · textarea (5,000) · wysiwyg · dropdown · multi-select · checkbox · number · currency · email · phone · file · date · datetime · countries · languages · user`.
- **Field scope:** `Contact | Group | Session | Evaluation Plan`, each with **Event vs Global** level.
- **New / Returning badge** on a contact: **New** = created ≤30 days ago; **Returning** = older than 30 days **and** linked to at least one other event in the org; otherwise no badge. Editing never resets it.
- **Merge duplicates**: up to 3 at a time, duplicates detected at a **70–80% match on email or name**, side-by-side value picker, primary record wins for event-level fields/notes/additional contacts, **irreversible**, logged to History.

---

## 5. Visual / UX craft notes (from the frame pass)

Read directly off the video frames — these are the things the transcripts under-specify.

- **Two accent colours, used consistently.** Blue (`#2F5CE0`-ish) is *navigational/creational* — `+ Create Submission Form`, `+ Add Task`, `+ Create Portal`, `Done`, `Save` inside secondary modals. **Orange** is the *commit* colour — every wizard's `Next` / `Add Plan` / `Add Task` / `Save Session` / `Update` / `Add Status` / `+ Add`. A wizard footer is always `Back` (ghost, left) + orange primary (right). `NEW` — we are blue-only; a second commit colour is a legible, non-decorative use of colour that fits rule 22 ("colour carries data, not chrome").
- **Full-bleed modal wizards, not drawers.** The form builder, evaluation plan and embed builder are **full-screen modals with a coloured title bar and an X**, carrying a **horizontal numbered step tracker** with green ticks on completed steps. Our left-rail `WizardShell` is arguably better, but the *horizontal tracker with completion ticks* is the pattern their users know.
- **Live validation banners inside forms.** Green `Looks good! All values added together equal 100%.` under the rubric sliders; green `2 sessions and 68 speakers match this filter` under filter rules; blue info banners at the top of steps explaining semantics (`Multiple criteria in one filter act as ORs…`). Cheap, and they make complex config legible to non-technical users.
- **Live preview panes.** Portal appearance renders an actual portal preview beside the controls; the embed builder has a **Preview** button per widget. `NEW`
- **Dual-pane pickers** for many-to-many assignment (available ⟷ selected, with `Select All` / `Remove All` per pane and a live "N found" count).
- **Radio *cards* with icons** for enumerated choices — task type (People / Groups / Sessions), evaluation type (Assign Evaluators / Virtual Evaluators), embed format. Not a `<select>`.
- **Sliders for weights.** The rubric uses a slider + numeric % + `✕` per criterion, not number inputs.
- **The left inspector rail** on data screens (saved view + Show/Hide Fields + Filters + Sort) instead of toolbar dropdowns. Given rule 22's "make things a bit larger", this is worth considering for the submissions table.
- **Character counters** on constrained inputs (`0/100 characters` on task name; a word count in the welcome-message editor; a live per-rule counter for cross-field limits).
- **Inline type/limit hints** under each field row in the builder (`Wysiwyg · Max 5,000 chars`).
- **Status pills** are soft-tinted with the status name; queue statuses render to participants as plain *Pending*.
- Portal preview shows **red/accent-coloured** action cards — the accent colour is per-portal (`#E03131` in the demo), i.e. **branding is per-portal, not just per-event**.

---

## 6. NEW findings — index

Ninety-four distinct findings are labelled `NEW` above. Grouped by area for the parity loop:

| Area | Count | Highest-value items |
|---|---|---|
| Portals & work items | 21 | portals-as-filtered-segments · Always Show Tasks · Extend Task Deadlines · Use Field task binding · task icon legend · task display order · Alias · per-portal field lock · live appearance preview |
| Form builder | 17 | conditional participant limits · Unique Contact Settings · cross-field char limits spec · placeholder per question · global vs event fields · 15-char page headings · remove-vs-delete · duplicate form |
| Evaluation | 14 | weighted rubric UI · rating icon set + colour · evaluation limits · internal vs external comments · abstain-with-reason · workload constraints · Impact Preview · Thought-Provoking sessions |
| Settings & data model | 13 | custom statuses w/ categories · Record Settings block · agenda interval + default duration per format · standard field catalogue · New/Returning badge · Record ID prefixes |
| Comms | 10 | email themes + `{{{content}}}` · template Type scoping · per-recipient review step · full system-email catalogue · History/Audit tabs · 100-per-send cap |
| Files | 7 | session-files settings block · file type + versioning + comments · download-files wizard w/ grouping + size estimate · sample files on requests |
| Agenda | 6 | AI draft/commit diff model · subsessions · rooms zoom + axis flip · month view |
| Publishing | 5 | Program Site · per-speaker `is_public` eye icon · embed cache/refresh · documented search scope · format picker incl. XML/iCal |
| Import/export | 4 | full CSV contract · Ignore-this-column · friendly-ID upsert · 1,000-row cap |
| Auth & access | 4 | Portal Username ≠ Email · 5-attempt lockout + admin unlock · field-level role permissions · filter-scoped roles |

---

## 7. DELTA — what the real product does that ours doesn't

Verified against `src/routes`, `convex/schema.ts` and `convex/*.ts` at the time of writing, and
cross-checked against `TODO.md` and `docs/reference/coverage-matrix.md` so nothing already tracked
is re-flagged as new. Severity: **S1** a judge or the brief will notice · **S2** a demoed surface ·
**S3** fidelity/depth · **S4** optional.

### Already tracked — this pass only adds the missing *spec*

These are open TODO items where the learn site now supplies the exact design, so building them is
mechanical: **[13] portal forms** (§2.2, full 3-page builder + PDF confirmation) ·
**[15] scorecard depth** (§2.4 rubric sliders, rating icons, evaluation limits, workload caps) ·
**[16] evaluator ops** (abstain-with-reason, resend invite, bulk remind, My Evaluations) ·
**[18] table fields** (Location, CEU Credits, Client Session ID, Starts/Ends At — all confirmed as
*standard* fields) · **[19] email theme** (§2.8, `{{{content}}}` contract and merge tags) ·
**[11] Columns chooser / Saved Views / Import** (§2.4 left rail + §2.3 import contract) ·
**[14] Files library** (`Library → Files`) · **[20] portal profile fidelity** (Honorific, Gender,
Address, Facebook all confirmed standard).

### Top 10 new deltas, ranked

| # | Gap | Sev | Effort | Why it matters |
|---|---|---|---|---|
| **1** | **Custom session statuses.** `submissions.status` is a fixed string union; there is no `statuses` table, no category mapping, no colour/order, no "show custom status name". Their Settings → Statuses screen is a full CRUD with a live per-status session count. | S1 | M | It is a *first-class settings screen* in the real product and the first thing a program lead with a bespoke workflow ("Accepted with pending revisions", "Cancelled", "Waitlist") reaches for. It also unlocks the agenda's status filter and the portal's status masking. Category mapping keeps every downstream rule (agenda visibility, public output, portal wording) intact. |
| **2** | **Portal Username separate from Email.** We authenticate the portal by `people.email` + `portalToken`. Sessionboard's #1 documented support issue is that these are *deliberately* two fields: changing a contact's email must not silently move their login. | S1 | S | An evaluator who edits a speaker's email and then tries the portal link will hit exactly the behaviour their docs warn about. Cheap: add `portalUsername` (defaulting to email), authenticate on it, expose "Change portal username" on the speaker drawer. |
| **3** | **Change history / audit log.** No `auditLog` table, no History module. Theirs is a generic `Subject · Type · User · Action · Field · New Value · Occurred At` log, surfaced globally *and* on each contact and session. | S1 | M | sbek **CNT-11** (`change history with attribution + restore`) is still open in our matrix, and this is the shape that satisfies it for every entity at once instead of per-feature. Also the natural home for our MCP/AI-copilot writes — "every agent action appears in the record's Activity feed" is literally their model. |
| **4** | **Per-participant public visibility (`is_public`).** Every accepted speaker of ours is public the moment the agenda is published. Sessionboard has a per-session-participant eye toggle that removes a speaker from embeds and the API while leaving them accepted. | S1 | S | The embargoed-keynote case is universal in event production, and it is also half of sbek **CNT-12** (unapproved content excluded from public output) at the speaker granularity. `submissionParticipants.isPublic` + a filter in `publicData` + an eye button in the drawer. |
| **5** | **Agenda settings: interval, per-format default duration, status set, room visibility.** We hard-code the grid. They expose Day Start/End, **Interval**, **Session Format → Default Duration**, which **statuses** appear, and which **rooms** are visible. | S1 | M | Dropping a "Lightning Talk" and having it *automatically* become 15 minutes is the single most-felt scheduling nicety in their product, and room visibility is what makes a 30-room event usable. This is also the config the AI agenda builder reads. |
| **6** | **Portal segmentation + per-portal configuration.** We have exactly one portal per event with fixed behaviour. They have filter-defined portals with per-portal task assignment, **Always Show Tasks**, **Extend Task Deadlines**, **Manage Profile**, **Manage Related Sessions and Participants**, weekly digest, appearance and **per-field lock/hide**. | S1 | L | This is the biggest structural difference in the whole product. Full parity is a lot; the **high-value subset is small**: `Always Show Tasks` (tasks only for accepted speakers), `Manage Related Sessions and Participants` (lets a speaker add a co-presenter — sbek-adjacent and swyx cares), and **Extend Task Deadlines**. Recommend shipping those three as event settings and deferring multi-portal. |
| **7** | **Per-recipient email review step + a real send log with delivery status.** Our outbox lists messages; theirs makes you step through **each recipient's fully-rendered email** before sending, then records `Delivered / Opened / Clicked / Bounced / Spam / Dropped` with a **reason** per recipient. | S1 | M | sbek **SPK-14** wants merge fields resolving per recipient *in a preview* — we render one preview, not a per-recipient walk. And with our Resend account still in test mode (TODO), a bounce-reason column is the difference between "the email silently didn't send" and a diagnosable state. |
| **8** | **File comments + file type + a real bulk-download wizard.** `uploads` has a single `reviewNote` string. They have a threaded comment log per file (author, role, timestamp), a **File type** (Presentation / Poster / Handout), and a 3-step download wizard (file types → **group by submitter/field/record** → estimated count & size → zip). | S2 | M | sbek **CNT-05** (file comments, cross-role visible) is still MISSING in our matrix, and **CNT-14** (bulk ZIP) is only per-submission today. The grouping choice is what makes a 200-file export usable for an AV team. |
| **9** | **Conditional participant limits + Unique Contact Settings on the form.** We have one speaker min/max. They have per-role min/max, a **total across roles**, rules that override limits by session format, and two settings governing what happens when a submitter names an **existing contact** (may they overwrite their data? are they notified?). | S2 | M | The existing-contact case is a real correctness issue, not polish: today a second submission naming the same co-speaker silently rewrites their profile with whatever the submitter typed. Their two toggles are the fix. |
| **10** | **Task personalisation (`Use Field`) + task/file-request libraries with aliases.** Our tasks are per-person rows with a fixed title and instructions. Theirs are reusable library items whose **description and link can bind to a field**, so each speaker sees their own text and their own URL, and each portal can **alias** the name. | S2 | S | "Register at *your* personalised registration link" and "Your room is *X*" are the two things organizers always want and always solve with a spreadsheet mail-merge. Cheap for us: a `useField` variant on `tasks.instructions`/`link` resolved at render. |

### Further deltas (11–24), lower rank

11. **Subsessions** (parent/child sessions, ≤200, child inside parent's window, linked speakers, agenda icon + hover summary). S2 · L — big model change; only worth it if we want workshop-with-breakouts parity.
12. **Program Site** — one branded URL aggregating all open forms *and* reviewer access. S2 · M. Our `/submit/:slug` + `/review/:token` already exist; this is an index page over them, and it's how their reviewers get in at all.
13. **Event clone / session duplicate / form duplicate.** `forms.ts` has a duplicate; sessions and events don't. Their clone has a granular copy-options checklist, resets session status to Pending, drops files, and clones evaluation plans **closed**. S2 · M.
14. **CSV/XLSX import** for speakers and sessions with their exact contract (1,000 rows, `Update record if already exists`, **`Ignore this column`**, friendly-ID upsert, red-cell inline fixing). S2 · M — sbek **SPK-03** is still MISSING for us.
15. **"View portal as…"** in the top bar — read-only impersonation, task completion blocked. S2 · S. A judge testing the speaker flow would love it, and it's the single best debugging tool in their product.
16. **Field-level role permissions (View / Lock / Hide)** and **filter-scoped roles** (Session Manager sees only matching sessions). S2 · M — real multi-tenant depth for rule 18d.
17. **Reports module** — four report types (Session / Contact / Group / Evaluation plan), relationship joins as columns, filters + sorting, run to **XLSX or CSV**, saved and re-runnable. S3 · M. Our exports are per-table CSV.
18. **Rooms view zoom + axis flip**, and **Month view**. S3 · S.
19. **Additional Contacts** (assistant linked to a speaker, CC'd on mail, can complete tasks in the speaker's portal, importable 3-at-a-time). S3 · M — swyx's "co-speaker portal accounts are nice-to-have" clarification is adjacent but not the same thing.
20. **Merge duplicate contacts** (≤3, 70–80% match detection, side-by-side value picker, irreversible + logged). S3 · M — real: their own FAQ says re-submission *creates* duplicate speakers, and ours will too.
21. **Bulk resize / compress headshots**, event-level headshot restrictions, a **Large Image** filter. S3 · S.
22. **`Location` as a session field distinct from Room**, plus **Client Session ID**, **CEU Credits**, **Capacity** — already TODO [18], but now confirmed as *standard* fields with types. S3 · S.
23. **Email template scoping by Type** (Contacts / Sessions / Groups) governing which merge tags exist. S3 · S — it prevents the "why is `{{sessionTitle}}` blank?" class of bug.
24. **Live "N matches" counters** on every filter builder (evaluation plan, embed, portal criteria) and the **rubric 100% validator**. S4 · S — pure UX, very cheap, and exactly the kind of legibility non-technical organizers need.

### Where we are already ahead (say so in the README)

- **Conflicts recompute live.** Theirs only update on page refresh and carry a "Refreshed <timestamp>" stamp. Ours is reactive — this is rule 26 paying off against their documented weakness.
- **Decisions send their emails.** Their docs warn twice that changing a status emails nobody; our queue-commit does it in one action.
- **The agenda has a Track view.** Brief requirement #5 names "list, day, week, track, or room" — they ship Month instead of Track, so we match the brief and they don't.
- **Auto-place is one click.** Their AI builder is better *designed* (a reviewable diff), but ours needs no draft round-trip for the simple case — adopting their accept/commit diff for the *AI* path while keeping one-click auto-place is the best of both.
- **The form is embeddable and the API is public.** Their submission form is link-only ("cannot be embedded"), and applications explicitly have no API.

---

## 8. Deliberately not pursued

`/apps/*` (11 third-party event-platform integrations), `/marketing/*` (Studio, Clips, Recaps,
Dispatch, Brand Kits, Media Library, Live Transcribe, Print Agendas), `/sponsors-exhibitors/*`,
`/speaker-crm/*` and `/awards/*` were skipped per standing scope. Also documented but out of
scope by swyx's own exclusions: **wiki pages / resources**, **payments & fees** (their 2.0 form
builder has a full gateway/VAT/promo-code step), **SMS**, **AI evaluations**, **document
generation**, **SSO**, **Zapier/Cvent/webhooks beyond our existing `/v1` surface**, and the
**Sponsors/Exhibitors** module in its entirety.
