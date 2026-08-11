# AI agenda builder

*Source: https://learn.sessionboard.com/videos/video-ai-agenda-builder — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

Here is the requirement document based on the Sessionboard AI Agenda Builder walkthrough video.

---

### Chronological Video Breakdown

#### [00:00]
**NARRATION:** Welcome to Sessionboard. In this video, we'll show you how to use the AI agenda builder to create a draft agenda from your sessions, apply smart rules, and commit only the changes you want.

*(Screen: Title card displayed: Blue gradient background with centered text "SESSIONBOARD" and "AI Agenda Builder".)*

#### [00:11]
**NARRATION:** Before creating drafts, I recommend setting event criteria. These saved default rules at the event level so your draft setup autofills, and you don't have to retype them every time. You can either add criteria manually at the bottom or navigate to Suggested criteria tab at the top, where AI will already have criteria generated for your specific event tailored for improvement.

*(Screen: `Sessions` -> `Settings` -> `Criteria` tab. Top header "Session Settings". Tabs: `Event Criteria (13)` [active], `Suggested (20)`. Criteria list items shown with edit/delete icons. Input box "Add Criteria" at bottom right with button `Add Criteria`.)*

#### [00:35]
**NARRATION:** First, access the sessions module and access the Agenda tab. You'll want to access the existing drafts to create a new one.

*(Screen: `Sessions` -> `Agenda` tab. Left sub-nav: `Agenda`, `List`, `Day`, `Week`, `Month`, `Rooms`, `Conflicts`. Main view shows session table. Top bar actions: `Drafts` button, `Options` dropdown, `+ Add` button.)*

#### [00:43]
**NARRATION:** Now let's create a draft. Click Create New Draft.

*(Screen: `Sessions` -> `Agenda` -> `Drafts` button clicked. Right slide-over panel opens titled "Agenda Drafts" listing saved drafts. Bottom right primary button: `+ Create New Draft`.)*

#### [00:47]
**NARRATION:** In Setup, confirm event dates, how many sessions are included, and which rooms are available. Then click Next.

*(Screen: Multi-step modal opens to Step 1 (`1 Setup`). Header: "Let's Build Your Agenda". Summary card: Event Overview (Jan 2, 1 day, 11 Sessions, 6 rooms available). Feature badges list. Buttons: `Back to Draft Agenda` [ghost], `Next` [primary orange].)*

#### [00:54]
**NARRATION:** In Settings, set your day start and end times, choose which session statuses to include, like Accepted, and optionally enable ignore existing times/rooms if you want AI to fully reschedule from scratch. Then pick the rooms to use and click Next.

*(Screen: Step 2 (`2 Settings`). Title: "Customize Agenda Settings". Fields: Draft Title ("AI Agenda Builder"), Day Start/End Time ("9:00am" - "11:00pm"), Session Statuses ("Accepted"), Toggles: "Ignore Existing Times", "Ignore Assigned Rooms", Room Selection radio ("Use only selected rooms"). Button: `Next`.)*

#### [01:10]
**NARRATION:** Next are rules, also called agenda criteria. These guide how the schedule should be built. You can type a rule and click Add Criteria, or pull from your saved event criteria and suggested recommendations.

*(Screen: Step 3 (`3 Rules`). Title: "Agenda Criteria". Tabs: `Agenda Criteria (0)`, `Event Criteria (13)`, `Suggested (20)`. Search bar, rule item list with `+` buttons to add.)*

#### [01:23]
**NARRATION:** Tip: You can reorder criteria to control priority. Rules at the top win when there's a conflict. When you're ready, click Next.

*(Screen: Reorder mode in Step 3 rules list. Drag-and-drop handles appear next to rules. Tooltip: "Enable edit mode to rearrange agenda criteria order." Bottom buttons: `Back`, `Next`.)*

#### [01:33]
**NARRATION:** Quickly review the setup summary and generate schedule.

*(Screen: Step 4 (`4 Build Agenda`). Header: "Ready to Generate!". Summary block: Event Duration (1 day), Sessions to Schedule (11 sessions), Rooms Available (3 rooms), Rules (8 rules). Buttons: `Back`, `Save and Skip`, `Generate Schedule` [primary orange].)*

#### [01:38]
**NARRATION:** Once it's generated, choose Review Agenda to inspect the draft, or See What Changed for a quick summary of updates.

*(Screen: Completion popup overlay: "Agenda Generated". Metrics: Sessions Scheduled, Conflicts Resolved, Optimized Layout. Buttons: `Review Agenda` [primary], `See What Changed` [secondary outline].)*

#### [01:45]
**NARRATION:** If you want to try again, you can return to Edit Draft and rerun with different settings or criteria.

*(Screen: Draft view mode active. Top banner: blue bar reading "You are viewing a draft of your agenda (Title: Valentin's Draft...)". Action links: `Edit Draft`, `View & Commit Changes`, `Back to Agenda`.)*

#### [01:52]
**NARRATION:** To publish changes, open your draft and click View and Commit Changes. This compares the draft against your live agenda.

*(Screen: Click on `View & Commit Changes` in top banner.)*

#### [02:00]
**NARRATION:** For each proposed change, like time or room, you can click Accept, or Accept All Changes if everything looks good.

*(Screen: Page `Draft Agenda Changes (Valentin's Draft....)`. Checkbox `Accept All Changes`, status count "0 of 14 changes accepted". Card view of session `SESS-26` showing old vs. new Date/Time/Room, AI Reason, Evaluated Criteria rules. Button: `Accept`.)*

#### [02:08]
**NARRATION:** When you're done, click Commit Changes to push only the accepted updates to your live agenda.

*(Screen: Primary button `Commit 14 Changes` highlighted green.)*

#### [02:15]
**NARRATION:** And if you no longer need a draft, go back to Drafts, open the ellipsis menu, and choose Delete, or Duplicate to keep a copy. Deleting a draft won't affect your live agenda unless you've already committed changes.

*(Screen: Right side panel "Agenda Drafts". Ellipsis dropdown open on draft card: `Edit`, `View & Commit Changes`, `Duplicate`, `Delete`.)*

#### [02:29]
**NARRATION:** Congratulations! You have created and pushed AI agenda draft changes. For any questions, please don't hesitate to reach out to our support team.

*(Screen: Transition to closing Sessionboard brand end-screen card.)*

---

### A. Screen Inventory

1. **Session Settings - Criteria Screen (`Sessions` -> `Settings` -> `Criteria`)**
   - **Purpose:** Manage global criteria library for auto-filling draft setups.
   - **Components:** Nav sub-menu (`Rooms`, `Tracks`, `Tags`, `Levels`, `Formats`, `Languages`, `Roles`, `Statuses`, `Criteria`), Tabs (`Event Criteria (13)`, `Suggested (20)`), Text input "Add Criteria", Button `Add Criteria`.

2. **Agenda Main View & Draft Panel (`Sessions` -> `Agenda`)**
   - **Purpose:** View current agenda and access draft management drawer.
   - **Components:** Sub-tabs (`List`, `Day`, `Week`, `Month`, `Rooms`, `Conflicts`), Buttons (`Drafts`, `Options`, `+ Add`), Drawer panel "Agenda Drafts" with search bar, list cards, draft metadata, vertical ellipsis menu (`Edit`, `View & Commit Changes`, `Duplicate`, `Delete`), Button `+ Create New Draft`.

3. **AI Agenda Builder Wizard (`Setup` -> `Settings` -> `Rules` -> `Build Agenda`)**
   - **Purpose:** 4-step workflow to configure and trigger AI agenda generation.
   - **Components:** Step indicators, summary cards, form inputs (Draft Title, Start/End Time dropdowns, Status select, Ignore toggles, Room selector radio/multiselect), drag-reorder rule cards, bottom actions (`Back`, `Next`, `Save and Skip`, `Generate Schedule`).

4. **Generation Confirmation & Draft Review Banner**
   - **Purpose:** Confirm generation completion and show active draft view indicator.
   - **Components:** Modal popup ("Agenda Generated", `Review Agenda`, `See What Changed`), Top notification banner ("You are viewing a draft...", `Edit Draft`, `View & Commit Changes`, `Back to Agenda`).

5. **Draft Agenda Changes / Commit Screen**
   - **Purpose:** Granular side-by-side comparison and selective approval of AI changes.
   - **Components:** Top header, `Accept All Changes` checkbox, `Remove All` button, accepted counter, change comparison cards (Session ID/Title badge, Date & Time before/after, Room before/after, Reason text, Evaluated Criteria list, `Accept`/`Remove` buttons), Button `Commit X Changes`.

---

### B. Feature / Capability List

- **Global Criteria Rules Library:** Create/edit reusable rules at event level; AI-suggested rule generation.
- **Draft Creation & Setup Wizard:** 4-step wizard for date/time range, session statuses, room filtering, and rule selection.
- **Reschedule Toggles:** Option to ignore existing assigned session times or rooms for full auto-rescheduling.
- **Rule Prioritization:** Drag-and-drop rule reordering where top-ranked rules take precedence during conflict resolution.
- **Draft Comparison & Selective Commit:** Diff view comparing proposed vs. live agenda; individual session `Accept`/`Remove` actions; bulk `Accept All`; partial commit execution.
- **Draft Version Management:** Slide-over panel supporting draft creation, duplication, editing, and deletion without affecting live data.

---

### C. Data Model Signals

- **Draft Agenda:** `id`, `title`, `event_id`, `created_by`, `updated_at`, `status`, `run_count`, `uncommitted_changes_count`.
- **Agenda Criteria / Rule:** `id`, `text`, `type` (Event vs. Draft-specific), `priority_order`, `is_suggested`, `applied_count`.
- **Proposed Session Change:** `session_id`, `original_start_time`, `proposed_start_time`, `original_room_id`, `proposed_room_id`, `reason`, `evaluated_criteria_list`, `acceptance_status` (Accepted / Rejected / Pending).
- **Session Attributes:** `id` (e.g., SESS-26), `title`, `status` (Accepted, Pending, etc.), `track`, `format`, `tags`.

---

### D. Organizer vs Participant

- **Organizer Side (100% of video functionality):**
  - Event criteria configuration.
  - Creating, running, and adjusting AI draft agendas.
  - Reviewing diffs and committing changes to the published schedule.
- **Participant Side:**
  - Read-only consumption of the live published agenda (affected only after organizer performs "Commit Changes").

---

### E. UX/UI Craft Notes

- **Layout Structure:**
  - Main app navigation uses a dark left sidebar (~220px width).
  - Draft drawer slides out from the right (~380px width) over the main content overlay.
  - AI Wizard operates in a centered modal dialog (~720px width) with top step-indicator tabs.
- **Active Draft Mode Indicator:**
  - Distinct light-blue top notification bar across the page header explicitly warning the user they are viewing a draft rather than live data.
- **Color Hierarchy & Actions:**
  - Primary call-to-action buttons use saturated orange (`#F26522` style) for main progression (`Next`, `+ Create New Draft`, `Generate Schedule`).
  - Commit action uses a green accent button (`Commit X Changes`).
  - Selection pills/badges use light grey/blue backgrounds with explicit status tags (`Accepted` in green pill).
- **Diff Comparison Cards:**
  - Standardized card layout displaying before/after state with arrow transitions (`Aug 7 -> Jan 2`), explicit AI reasoning boxes, and tag list of satisfied criteria.