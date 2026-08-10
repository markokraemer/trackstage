# Sessionboard UX Forensics — Agenda Builder, Tasks, Forms, File Requests

**Source images:** `$10,0000 Kill My SaaS - Competition Brief/images/{image30,image33,image18,image22,image26,image28,image24,image16}.png`

> **IMPORTANT CAVEAT:** None of the 8 screenshots in this batch actually show the *end-user-facing Speaker Portal* itself (i.e. what a speaker sees when they log into their portal and complete a task/form). All 8 are the **organizer/admin side** — the builder screens under the left-nav "PORTALS" section (`Portals`, `Tasks`, `Forms`, `File Requests`, `Resources`, `Files`) where an organizer configures what will later appear inside a speaker's portal. Several are also **empty states** (no data yet in this sandbox account: "AI.Engineer Sandbox", Oct 12–14, 2026). This doc documents exactly what's visible — the admin-side Agenda module, the admin Tasks list, and the admin Forms/File-Request builders — and calls out explicitly, per image, what could NOT be captured (the actual portal-rendered task checklist / live form-fill UI) so a follow-up screenshot pass can target those specifically.

---

## Global chrome (present in all 8 images)

Consistent app shell across every screen:

- **Top bar** (white, ~64px tall, thin bottom border `#E5E7EB`):
  - Top-left: small blue rounded-square logo mark (megaphone icon, `#2563EB`-ish blue, ~36×36, radius ~8px) — no wordmark, just icon.
  - Center-left: global search/command bar, pill-shaped, light gray fill (`#F3F4F6`/`#F1F5F9`), placeholder "Find or ask", magnifying-glass icon left, `⌘K` keyboard-shortcut chip right-aligned inside the field (light gray badge, monospace-ish).
  - Top-right cluster, left to right: **"View Portal"** link/button (blue text `#2563EB` on white/outline pill, this is the organizer's shortcut to preview the live speaker portal), a megaphone/announcement bell icon with a small red notification dot (top-right corner, solid red `#EF4444`), a "?" help icon in a circle, and a circular user avatar (dark navy circle, white initials "SY").
- **Left sidebar** (white/very-light-gray, ~340px wide, thin right border):
  - Top: workspace/event switcher — square avatar tile "AS" (gray, rounded ~6px) + event name "AI.Engineer Sand..." (truncated, bold, ~14px) with subtitle "Oct 12–14, 2026" (gray, ~12px) + chevron expand/collapse icon at far right.
  - Below that, a collapsed/highlighted item labeled "Ove[rview]" (partially obscured by a gray pill in most captures — likely a UI tooltip/highlight artifact from screen-recording tooling, not real product chrome).
  - Nav is grouped into ALL-CAPS section headers with 11px gray tracked-out labels:
    - **SUBMISSIONS**: View All (grid icon), Abstracts (document icon), Sessions (link/chain icon), Files (folder icon)
    - **COLLECT & REVIEW**: Forms (speech-bubble icon), Evaluation (folder icon), Agenda (calendar icon), Invoices ($ document icon), Site (house icon)
    - **PORTALS**: Portals (gear icon), Tasks (pulse/waveform icon), Forms (globe icon), File Requests (file-with-arrow icon), Resources (globe icon), Files (file-plus icon)
    - **CONFIGURE**: Settings (gear icon)
  - Below the nav module block: top-level app switcher rows — **CRM** (contact-card icon, chevron for submenu), **Marketing** (megaphone icon), **CMS** (globe icon, has its own sub-chevron + expand caret), each row full-width, ~15px, gray-900 text, hover/active state = light blue background (`#EFF6FF`-ish) + blue text + blue left accent/rounded highlight (seen on active items: "Agenda", "Tasks", "Forms", "File Requests" each highlighted blue when that section is open).
  - Bottom-left corner: small blue 2×2 grid-dots icon in its own square tile (app-launcher / all-apps toggle), and in some later screens a "collapse sidebar" `<` chevron button appears bottom-right of the sidebar footer.
  - Note: the nav re-labels itself between screenshots — in image30/33/18 the "SUBMISSIONS" group sits directly under the truncated "Ove" item (Overview collapsed), while in image22/26/28/24/16 a "Dashboard" (grid icon) and expandable "Program" (clipboard icon, chevron) group wrap the same Submissions/Collect&Review items — i.e. **Program** is a collapsible parent section containing Overview, Submissions, Collect & Review as children, and it can be toggled open/closed independently from the page currently shown. When "Program" is expanded, "Dashboard" appears as its own top-level sibling above it.

- **Page header pattern** (used everywhere): a small icon-in-square (light gray/blue tinted square, rounded ~8px) + **H1** page title (bold, ~28px, near-black `#0F172A`) on one line, with a one-line gray subtitle/description directly below (~14px, `#6B7280`), e.g. "Manage your event agenda and schedule", "Create tasks that can be assigned to your portals", "Create forms that can be assigned to your portals to collect information", "Collect files (e.g. documents, contracts) from your portals...".
- Primary action button top-right of page header: solid blue (`#2563EB`/`#3B82F6`) pill/rounded-rect button, white bold text, often a split-button with a chevron opening a small dropdown menu (seen: "+ Add Session", "+ Add ▾" → "Add Task" / "Copy from...", "+ Add ▾" for Forms and File Requests).
- Empty states share one template: centered, inside a large white card with a **dashed light-gray border** (`#D1D5DB`, ~1.5px dashed) and generous padding (~180px tall): a gray icon in a light circle/rounded-square at top (~48px), bold ~16px heading ("Nothing here yet", "No forms yet", "No file requests yet"), then a lighter ~14px helper line below.

Overall visual language: light mode only, white background (`#FFFFFF`) with a very light blue-gray content-area wash (`#F8FAFC`/`#F1F5F9` behind the header band), blue accent (`#2563EB` primary, `#EFF6FF` light-blue tints for active/selected states), gray-scale text hierarchy (near-black headings, mid-gray body, light-gray placeholders/borders), border radius consistently ~8–10px on cards/buttons/inputs, ~6px on small chips/badges, generous 16–24px internal padding, Inter/system-UI-style sans-serif font throughout, no visible dark mode.

---

## image30.png — Program > Agenda (List view, empty state)

**Screen:** Agenda module, "List" tab selected, no sessions scheduled yet.

**Layout structure:**
1. Page header: calendar icon + "Agenda" H1 + subtitle "Manage your event agenda and schedule".
2. **View switcher tab bar** directly under header — this is the key structural element for the requested agenda/calendar builder. Six tabs in a single horizontal row, underline-style active indicator:
   - **List** (bullet-list icon) — active/selected, blue text `#2563EB` with blue underline (~2px) beneath it
   - **Day** (calendar-day icon)
   - **Week** (calendar-week icon)
   - **Month** (calendar-clock icon)
   - **Rooms** (a "building/rooms" icon — looks like a person-in-doorway/room glyph)
   - **Conflicts** (warning-triangle icon)
   - Inactive tabs are gray (`#6B7280`) text+icon, ~14px, no underline. Tabs are left-aligned, roughly 90–110px apart, with icon-left-of-label pattern for all six.
   - **Notable finding for the clone brief:** there is NO explicit "Track" view tab visible here despite the task description expecting one — the six views are List / Day / Week / Month / Rooms / Conflicts. "Rooms" appears to be the room-column/grid equivalent of a "room view," and there's a dedicated "Conflicts" tab rather than conflicts being inline badges only.
3. **Toolbar row** below the tabs, inside a bordered white bar:
   - Search input, left-aligned, pill/rounded-rect, gray placeholder "Search sessions...", magnifying icon.
   - A small icon-only button right after search (looks like a "sort/filter lines with chevron" glyph — possibly a density/list-options toggle).
   - "👁 Saved Views ▾" — eye icon + label + dropdown chevron, plain button.
   - "▤ Columns" — this one rendered as an active/selected state: blue border (`#2563EB`), blue text, light blue-tinted fill — implying it's currently toggled open (a column-picker panel would drop down, not visible/expanded in this capture).
   - "↕ Sort", "▽ Filter", "📄 Drafts" — plain outline buttons, gray border, gray-900 text, icon-left.
   - "••• Options" — overflow/more menu, plain button.
   - "+ Add Session" — primary blue filled button, far right, bold white text.
   - All toolbar buttons are same height (~36–38px), rounded ~8px, gray-200 border (`#E5E7EB`) except the active "Columns" one which has blue border.
4. **Content area:** large white panel below toolbar, essentially the full remaining viewport height, with the dashed-border empty-state card centered inside it (see global empty-state pattern above): calendar icon, "Nothing here yet", "Sessions will appear here in list view".

**Colors/typography:** H1 ~28px bold `#0F172A`; tab active blue `#2563EB`; toolbar buttons ~14px medium weight `#374151`; empty-state heading ~16px semibold `#111827`, helper text ~14px `#6B7280` (matches global empty pattern).

**Interactions implied (not directly visible since empty):**
- Switching among List/Day/Week/Month/Rooms/Conflicts tabs presumably swaps the main content area to a corresponding grid: Day/Week are most likely the drag-and-drop time-grid+room-column agenda builder (time axis down the left, room/track columns across the top, draggable session blocks); Month is a calendar-month grid; Rooms is likely a room-centric grid (rooms as rows or columns, sessions placed within); Conflicts is a dedicated list/report of scheduling collisions (double-booked rooms, speaker overlaps) — flagged via the warning-triangle icon in the tab itself.
- "Add Session" opens a creation flow/panel (not captured) to create a session and presumably assign room/time/track — this is likely the entry point that then appears as a draggable card in Day/Week/Rooms views.
- "Columns" toggle governs which metadata columns show in List view (implies List view is a spreadsheet/table of sessions, sortable/filterable via the Sort/Filter buttons, with Drafts as a separate filtered subset).
- "Saved Views" suggests users can save custom filter/sort/column configurations as named views — a reusable-view pattern worth cloning.
- No unscheduled-session tray, time-grid granularity markers, drag handles, or conflict badges are visible in this capture because the account has zero sessions — **this view needs a populated-data screenshot to fully forensically capture the drag-and-drop grid mechanics**; only the navigational scaffold (tabs + toolbar) is confirmed here.

---

## image33.png — Portal > Tasks (admin builder list, NOT the live portal checklist)

**Screen:** This is the **organizer-side "Tasks" configuration screen** (left nav: PORTALS > Tasks, highlighted blue/active), listing the task *definitions* an org creates to later assign into speaker portals — not the speaker-facing checklist UI itself. A red arrow annotation (added by whoever captured this, not product UI) points at an open "+ Add" dropdown menu.

**Layout structure:**
1. Header: checkbox-in-square icon + "Tasks" H1 + subtitle "Create tasks that can be assigned to your portals".
2. Primary button top-right: **"+ Add ▾"** solid blue, dropdown open showing two menu items in a small white popover card (rounded ~8px, drop shadow):
   - **"Add Task"** — top item, currently shown in a highlighted/hovered blue state (blue background fill, white text) — i.e., default/primary option.
   - **"Copy from..."** — second item, plain white background, gray-900 text, small vertical divider between them via padding, likely for duplicating a task from another event/template.
3. Search bar below header: pill input, placeholder "Search tasks...".
4. **Tab/segmented filter row**, underline style like Agenda tabs:
   - **All Tasks** `3` (active, blue underline)
   - **Contact Tasks** `1`
   - **Group Tasks** `0`
   - **Submission Tasks** `2`
   - Each tab shows a numeric count badge immediately after the label (bold black number, not pill-badge styled — just plain text, right after label with a gap).
   - This taxonomy (Contact / Group / Submission) mirrors the "Type" taxonomy seen later in Forms/File Requests creation (Contacts / Groups / Submissions) — tasks, forms, and file requests are all assignable to one of these three target-entity types.
5. **Task list:** vertical stack of white bordered cards (full width, ~90px tall each, ~16px gap or just a divider line between title row and metadata row within the same card), rounded corners ~8–10px, thin gray border `#E5E7EB`:
   - **Card 1 — "Hotel and Travel Reservations"**: bold title (~16px, `#111827`) + a **"Manual"** badge/pill immediately to its right (light-gray pill, `#F3F4F6` fill, dark text, small ~11px caps-ish label — this is a task-type indicator, i.e. "Manual" = organizer manually marks it complete vs. an automated/system-triggered task). Below the title, a metadata row (lighter gray, ~13px) reading "**ssign up** 👤 **Contact**" — this looks like truncated text ("...ssign up" is likely a clipped longer string, possibly "Assign upon sign up" or similar condition text) followed by a person icon + "Contact" tag denoting this task targets Contact-type portal recipients. Far right of the title row: a "•••" overflow-menu icon (three dots).
   - **Card 2 — "Presentation Upload"**: bold title + "Manual" badge. Metadata row below: 📅 calendar icon + "**Session**" tag — meaning this task is tied to/scoped by Session (i.e., generated per session, e.g., each speaker gets one Presentation Upload task per session they own). "•••" menu top-right.
   - **Card 3 — "add oil"** (clearly placeholder/test data, lowercase, non-production name): bold title + "Manual" badge. Metadata row: "**add**" (truncated text, probably clipped condition/description) + 📅 "**Session**" tag. "•••" menu top-right.
6. Cards are stacked with visible horizontal divider lines separating the title/badge row from the metadata row inside each card (a thin `#F1F5F9` rule).

**Colors:** badge pill "Manual" ~ background `#F3F4F6`, text `#374151`, bold ~12px, rounded-full (pill) shape ~4px vertical padding. Task title `#111827` bold 16px. Metadata/tag row `#9CA3AF`/`#6B7280` ~13px regular, icons ~14px matching gray.

**Interactions implied:**
- "Manual" badge strongly implies there's a second task-type (e.g., "Automatic"/"System") not shown here — worth designing a Task Type enum: Manual vs Automated (auto-completed when a linked form/file-request/step is satisfied).
- Tasks are scoped to an entity type via the Contact/Group/Submission tab taxonomy AND individually tagged with a target (Contact, Session) shown as a small icon+label chip under the title — suggesting each task has a "target/scope" field (which entity type triggers/receives this task) distinct from arbitrary linked automation text ("ssign up", "add" — likely a rule/trigger description like "Assign upon sign up" or "Added when session is confirmed").
- "•••" per-card menu presumably offers Edit / Duplicate / Delete / Reorder.
- **Not captured:** the actual portal-rendered checklist (what a speaker sees — task name, description, a "Mark complete" or checkbox control, status pills like "Not Started/In Progress/Complete," due dates, or a progress bar). This screenshot batch does not include that view; recommend sourcing an additional screenshot of the live `View Portal` > Tasks tab to nail the exact checklist visual (checkbox style, status color coding, completion %, ordering).

---

## image18.png — Portals > Forms (admin list, empty state)

**Screen:** Organizer-side Forms list (PORTALS > Forms in nav), zero forms created yet in this sandbox.

**Layout structure:**
1. Header: speech-bubble/chat icon + "Forms" H1 + subtitle "Create forms that can be assigned to your portals to collect information".
2. "+ Add ▾" primary blue button top-right (same split-button pattern as Tasks).
3. Same four-tab taxonomy as Tasks but for Forms, all showing `0`:
   - **All Forms** 0 (active)
   - **Contact Forms** 0
   - **Group Forms** 0
   - **Submission Forms** 0
4. Empty-state card (dashed border): speech-bubble-with-dots icon, "No forms yet", "Create a form to collect information from participants".

**Confirms:** Forms share the identical Contact/Group/Submission scoping taxonomy as Tasks — this is a consistent cross-module pattern (Tasks, Forms, File Requests all scope to the same three entity types) that the clone should replicate as a shared "assignable-to" concept.

---

## image22.png — Create Form > Step 1 "Form Setup"

**Screen:** Multi-step form builder wizard, first step, freshly opened (fields empty).

**Layout structure:**
1. Header: "Create Form" H1 (no icon this time, no subtitle), "💾 Create" primary blue button top-right (disabled-looking style not evident, but likely disabled until required fields filled — the button reads "Create" not "Save", implying this whole wizard commits at the end rather than per-step).
2. **Two-pane layout below header:**
   - **Left rail** (~350px, light background, bordered right edge): "← Back to forms" link at top (gray text, back-arrow icon). Below it, a mini vertical stepper list under a small-caps label "FORM SETUP":
     - **Step 1 "Form Setup"** — active, shown as a dark/near-black filled rounded-rect card (bg `#1E293B`-ish navy-black) with a small sparkle/wand icon (white) + white bold title "Form Setup" + white/gray subtitle "Name, module, and welcome ..." (truncated).
     - **Step 2 "Form Questions"** — inactive, plain white/gray-100 row, gray clipboard icon, gray text "Form Questions" + gray subtitle "Questions and section headin..." (truncated).
     - **Step 3 "Settings"** — inactive, same styling, gear icon, "Settings" + subtitle "Deadlines, login, reminders, a..." (truncated).
     - This vertical stepper (active step = dark filled card, inactive = plain list rows) is a distinct pattern from the top-tab pattern used elsewhere — worth reusing exactly for our own multi-step builder wizards.
   - **Right content pane:** "Form Setup" H2 + description "Give your form an internal name, public title, and select what kind of form you want to build."
     - White bordered card containing two stacked text inputs:
       - **"Name"** label with red required-asterisk, input placeholder "e.g. Speaker Contact Form"
       - **"Title"** label with red required-asterisk, input placeholder "e.g. Add A Contact To Manage Your Portal"
       - (Implies "Name" = internal/admin label, "Title" = public-facing headline shown to the form-filler — a naming convention worth adopting.)
     - **"Type"** section below the card (label, not inside a bordered box): three large selectable tile-cards side by side, equal width, ~380px wide each, ~300px tall, rounded ~12px border:
       - **Contacts** tile: light-blue rounded-square icon background with a single-person glyph (blue `#2563EB`), bold title "Contacts", gray description "Collect contact information from people" — this tile appears in an unselected-but-emphasized default visual state (normal border weight).
       - **Groups** tile: icon = two-people glyph, title "Groups", description "Collect information from sponsors and exhibitors" — text appears slightly lighter/grayed (possibly indicating a not-yet-available or de-emphasized option relative to Contacts).
       - **Submissions** tile: icon = building/stacked-document glyph, title "Submissions", description "Collect submission-related information" — normal emphasis like Contacts.
       - Confirms the "Type" selector for Forms uses the exact same three categories (Contacts/Groups/Submissions) as the Task taxonomy — a single shared enum across the platform for "what this thing is attached to."
3. Footer bar (sticky bottom, white, top border): "Back" (disabled/gray, left), helper text center-right "Complete all required fields on this step to continue.", "Next" primary blue button (bottom-right).

**Colors:** active stepper card bg ~`#111827`/`#1E293B`, white text; type-tiles border `#E5E7EB` ~1.5px, icon chip bg light blue `#EFF6FF`, icon color `#3B82F6`; required asterisk red `#EF4444`.

---

## image26.png — Edit Form > Step 2 "Form Questions" (with field-picker menu open)

**Screen:** Same wizard, now on step 2 for an existing form named "kh" (test data), with an "Add Field" flyout menu open showing a rich searchable field library.

**Layout structure:**
1. Header now reads "Edit Form" (H1) + small gray subtitle "kh" (the form's internal name) instead of "Create Form" — confirms the wizard is reused for edit mode. Top-right actions: "⧉ Duplicate" (outline button), "🗑 Delete" (red filled/danger button, white text), "💾 Save" (blue filled, slightly muted/lighter blue than primary — possibly styled as the "active but not yet dirty" state).
2. Left stepper (same pattern as image22): Step 1 "Form Setup" now shows a **gray checkmark icon** (completed state) instead of the sparkle icon — confirms completed steps get a checkmark. Step 2 "Form Questions" is now the active dark-filled card (clipboard icon, white text). Step 3 "Settings" still inactive/gray.
3. **Main content — "Form Questions"** H2 + subtitle "Add and arrange the fields participants will fill out."
   - **Section card** (white, bordered, rounded ~10px):
     - **"Section Title"** field (required, red asterisk) — text input filled with **"Update Your Information"**.
     - **"Description & Instructions"** field — a full **rich-text editor** with a formatting toolbar: Bold, Italic, Underline, Superscript (x²), Subscript (x₂), Link/chain icon, bullet list, numbered list, indent/outdent icons (icons partially cut off at right edge of visible toolbar — likely more icons like align/image continue, as seen fully in image28's toolbar). Editor body pre-filled with placeholder-ish real text: "Please add or update your information below." Bottom-left of editor shows a small "p" tag chip (paragraph-type indicator, CMS-style block editor affordance).
   - **"Form Questions"** sub-section header (H3-ish, bold) with **"+ Add Field"** button top-right (outline style, plus icon) — this is what was clicked to open the flyout.
     - Below it, one existing field row already added: a bordered light-gray card containing a **6-dot drag-handle icon** (left edge, for reordering), field label **"Title"** with red required asterisk, gray helper caption "Text" (denoting field type), and on the right: a **"Required"** label + a **toggle switch** (currently ON/dark), a small **lock icon** (possibly "lock field" / prevent deletion, since Title is likely a mandatory system field), and a "•••" overflow menu.
4. **Flyout panel** (opened via "+ Add Field", large white card with drop-shadow, positioned overlapping the right ~40% of the screen, rounded ~10px):
   - Top option row: **"⊕ Add Section Element"** with a right-chevron `>` (implies a submenu of section-level elements: probably headers, dividers, page breaks, rich-text blocks).
   - **"⊕ Create Field"** — option to define a brand-new custom field from scratch.
   - **Search input**: "Search fields..." pill, currently focused (blue border ring), magnifying-glass icon.
   - Below the search, a scrollable **list of existing reusable fields** from the org's shared field library (this is a field-reuse/global-schema system, not per-form-only fields), each row showing the field name left and a **field-type pill badge** right (light-gray pill, monospace-ish lowercase label):
     - **Client Session ID** — type `text`
     - **Description** — type `wysiwyg`
     - **Format** — type `dropdown`
     - **Language** — type `dropdown`
     - **Level** — type `dropdown`
     - **Tags** — type `dropdown`
     - (List is scrollable/cut off at bottom — likely more fields below.)
   - This is a significant architectural finding: **fields are defined once in a global/shared field registry** (reused across forms — the same "Language"/"Level"/"Format"/"Tags" fields probably also populate Abstract-submission forms) and then added by reference into any given form, rather than each form having fully独立 ad-hoc fields. Field types observed: `text`, `wysiwyg` (rich text), `dropdown` — plus `Contacts`/`Groups`/`Submissions` module scoping seen elsewhere.
5. Footer: "Back" (outline) and "Next" (primary blue) bottom corners, consistent with step 1.

**Colors:** flyout panel shadow (soft, ~0 8px 24px rgba(0,0,0,0.12)); type-pill bg `#F3F4F6`, text `#4B5563`, ~11px, rounded-full, monospace/lowercase; drag-handle dots gray `#9CA3AF`; toggle ON state dark navy/black track with white knob (distinct from the blue-toggle pattern seen in image28 — worth checking for consistency, might just be an "active/dark" themed switch here vs blue elsewhere).

---

## image28.png — Edit Form > Step 3 "Settings" (saved-toast visible; browser chrome visible)

**Screen:** Same "kh" form, Step 3 "Settings", captured with a real browser window (Chrome) showing the URL: `appv2.sessionboard.com/event/6703/portals/forms/85614107-9041-42ba-a954-d1dfea35b8f` — confirms product URL structure: `/event/{eventId}/portals/forms/{formUuid}`. A "Saved successfully" toast notification is visible bottom-right.

**Layout structure:**
1. Header: "Edit Form" + "kh" subtitle, same Duplicate/Delete/Save button trio as image26.
2. Left stepper: Step 1 "Form Setup" ✓ checked, Step 2 "Form Questions" ✓ checked (both now completed/checkmarked), Step 3 "Settings" active (dark filled card, gear icon).
3. Main content — **"Form Settings"** H2 (no subtitle this time), inside one white bordered card:
   - **"Send Confirmation Email"** row: bold label + description "Submitters will receive an email with a link to access their submission in the portal." — with a **large toggle switch** on the right, currently ON (blue-filled track `#2563EB`/dark-blue, white circular knob, right-aligned) — this is a materially different toggle color (blue) vs. the dark/black toggle seen in image26's "Required" switch, suggesting toggle color may vary by semantic context or these are just two slightly different design tokens in the product (worth picking one consistent toggle style for the clone, e.g. blue-when-on).
   - Below that, a **rich text editor** for the confirmation email body — same toolbar pattern as image26 but fuller here (fully visible, not cut off): Bold, Italic, Underline, Superscript, Subscript, Link, bullet list, numbered list, indent, outdent, align-left, align-center, align-right, image-insert icon, "•••" more-options. Editor pre-filled with: "Thank you for submitting your form. Here is a link to your submission." Bottom-left "p" tag chip again.
4. Bottom-right toast: white card, drop shadow, rounded ~10px: bold "Saved successfully" + gray subtext "Your changes have been saved." + a "View All Forms" outline button to the right of the message, all in one horizontal toast row.
5. Footer: "Back" button only visible at very bottom-left (Next probably replaced by "Create"/final submit off-screen or this being the last step in edit mode shows no Next).

**Confirms:** the Settings step for a form governs email/notification behavior (deadlines, login requirements, reminders per the left-nav subtitle text "Deadlines, login, reminders, a..." seen truncated in image22/26 — meaning Settings has MORE toggles than just the confirmation email one; only the top portion was visible in this capture, page likely scrolls to reveal Deadline date picker, Login-requirement toggle, and Reminder-schedule config not captured here).

---

## image24.png — Portals > File Requests (admin list, empty state)

**Screen:** Organizer-side File Requests list (PORTALS > File Requests in nav), empty.

**Layout structure:**
1. Header: file-with-up-arrow icon + "File Requests" H1 + two-line subtitle: "Collect files (e.g. documents, contracts) from your portals. Uploaded files are stored here for download or export — they are not attached to a submission or contact record." (Important semantic distinction called out explicitly in-product: File Requests are NOT the same as file *fields* embedded in a Form/Submission — they're a standalone collection mechanism whose outputs live independently.)
2. "+ Add ▾" primary blue button top-right.
3. Same four-tab taxonomy: **All Requests** 0 / **Contact Requests** 0 / **Group Requests** 0 / **Submission Requests** 0 — confirms File Requests is the third module (after Tasks, Forms) sharing the identical Contact/Group/Submission scoping tab pattern.
4. Empty-state card: file-upload icon, "No file requests yet", "Create a file request to collect documents from participants".

---

## image16.png — Add File Request (creation drawer/panel, right-side slide-over)

**Screen:** A right-side slide-over drawer/panel (not a full page — background page dimmed/overlayed at ~50% gray scrim) for creating a new File Request, opened presumably from the "+ Add" button on the File Requests list.

**Layout structure:**
1. Drawer occupies right ~45% of viewport, white background, drop shadow on left edge, full height.
2. Header inside drawer: bold "Add File Request" title + gray subtitle "Create a new file request for participants" + "✕" close icon top-right corner.
3. **Info callout box** near top: light-gray/blue-tinted bordered rounded box with an ⓘ info icon + bold heading "Files are stored, not attached" + explanatory body text: "Uploaded files live on this File Request and can be downloaded or exported. They are not attached to the contact, group, or session record." (Reinforces the same distinction noted in image24's subtitle — a deliberate, repeated in-product explanation, meaning the product team considered this a common point of confusion worth calling out twice.)
4. **"Title"** field: label + text input, placeholder "e.g. Upload Presentation Slides".
5. **"Type"** field (required, red asterisk): three selectable tiles again, same Contacts/Groups/Submissions pattern, but smaller/more compact than the Form-builder version (since this is a drawer not a full page): icon-in-light-blue-square + bold label, NO description text this time (just icon+label, more condensed). **"Contacts"** tile is shown actively selected: black/dark border (~2px, `#111827`) and a slightly darker fill/elevated shadow vs. the other two tiles (Groups, Submissions) which have plain thin gray borders — confirms the selection visual = bold dark border + subtle bg shift, not a blue highlight like elsewhere (another toggle/selection-style inconsistency worth normalizing to one pattern, likely blue selection, for our clone).
6. **"Instructions"** field: label + rich text editor (toolbar: Bold, Italic, Underline, bullet list, numbered list, align-left/center/right, link, strikethrough/clear-formatting icon — a slightly different/shorter toolbar subset than the Form Settings email editor, missing superscript/subscript/image/indent here), placeholder text "Enter instructions..." shown gray/unfilled, "p" tag chip bottom-left.
7. Drawer footer (sticky bottom): "Cancel" (outline button, left) and "Create File Request" (primary blue filled, right).

**Colors/spacing:** drawer padding ~40px horizontal; info callout bg ~`#F8FAFC` with `#E2E8F0` border, icon gray-blue `#64748B`; selected-tile border black `#0F172A` ~2px vs unselected `#E5E7EB` ~1px — a distinctly different selection affordance (border-darken) compared to the Form-type-tile screen (image22) where visual differentiation wasn't clearly a selected state at all (none appeared pre-selected there).

---

## Synthesis — Cross-cutting patterns to replicate in the clone

1. **Shared three-way scoping taxonomy**: Tasks, Forms, and File Requests are all sub-typed into exactly **Contacts / Groups / Submissions** everywhere (creation-type picker AND list-filter tabs). Groups = "sponsors and exhibitors" per the tooltip text — a group entity distinct from a solo Contact. This is a foundational data-model decision: one shared `target_type` enum (`contact | group | submission`) governs which of Tasks/Forms/FileRequests/(and by extension Agenda sessions) an item attaches to, and each of the three portal-config modules (Tasks, Forms, File Requests, and presumably also Resources) reuses one **identical page template**: icon+H1+subtitle header, "+ Add ▾" split button (Add X / Copy from...), 4-tab filter row with live counts (All/Contact/Group/Submission), list of bordered cards, and a shared dashed-border empty state.

2. **Multi-step builder wizard pattern** (Forms confirmed, likely also used for Tasks/File Requests given the identical "+Add" split-button and similar drawer-vs-full-page treatment): left vertical stepper with 3 steps — Setup → Questions/Content → Settings — where the active step is a dark-filled rounded card with icon+title+truncated-subtitle, inactive steps are plain gray rows, and completed steps show a checkmark icon instead of their original icon. Sticky footer with Back/Next, final step's primary action reads "Create" (create mode) — this whole stepper chrome should be built once and reused for every builder-style flow in our clone (Forms, and ideally Tasks/Agenda-session-forms too).

3. **Global field-registry / reusable fields**: the field-picker flyout in Form Questions confirms fields are NOT form-local — they're pulled from a shared organization-wide field library (seen: Client Session ID [text], Description [wysiwyg], Format/Language/Level/Tags [dropdown]) via a searchable list, with an option to "Create Field" (define new) alongside "Add Section Element" (structural, non-data elements like headers/dividers). Clone should implement a global `fields` table/registry referenced by many forms, not embedded JSON per form.

4. **Rich text editor** is used consistently for any long-form text (form section descriptions, confirmation emails, file-request instructions) — same toolbar family reused with 8–13 icon variants depending on context (fuller toolbar for confirmation emails, condensed for instructions), always shows a small "p" (paragraph block-type) tag chip bottom-left of the editor — a lightweight Notion/ProseMirror-style block editor, not a plain textarea.

5. **Two selection-affordance styles observed and should be reconciled to one**: (a) blue border + light-blue icon tint for "emphasized/available" tiles (Form type picker), vs (b) black/dark 2px border for "actively selected" tiles (File Request type picker, with Contacts pre-selected). Recommend standardizing on a single selected-state look (e.g., blue border + blue-tinted background + checkmark) across all these tri-tile pickers in our clone.

6. **Toggle switches** appear in two colorways — dark/black-track (Form Questions "Required" toggle) vs blue-track (Form Settings "Send Confirmation Email" toggle). Recommend one consistent ON-state color (blue, matching primary brand accent) for our clone's design system.

7. **Agenda module views**: confirmed six view tabs — **List, Day, Week, Month, Rooms, Conflicts** — with icons (list-bullet, calendar-day, calendar-week, calendar-month, room/building glyph, warning-triangle). No populated-data screenshot was available in this batch, so the actual **drag-and-drop time-grid mechanics, room-column layout, time-axis granularity, unscheduled-session tray, and conflict-badge visuals remain unverified** — flagged as a follow-up screenshot need. The List view toolbar (Search, Saved Views, Columns, Sort, Filter, Drafts, Options, Add Session) confirms List is a filterable/sortable/column-configurable spreadsheet-like table of sessions, and that a "Drafts" bucket exists separate from scheduled/published sessions.

8. **URL structure** confirmed from image28: `appv2.sessionboard.com/event/{eventId}/portals/forms/{formUuid}` — i.e. routes are nested under `/event/{id}/portals/{module}/{itemId}`, useful for mirroring our own route structure (e.g. `/events/:eventId/portals/forms/:formId`).

9. **Explicit non-attachment framing for File Requests** (repeated twice, in the list-page subtitle and again in the creation-drawer info callout) shows Sessionboard treats "File Requests" as a standalone collection bucket, deliberately decoupled from the Contact/Group/Submission record it's associated with — different from Form-collected data which presumably does write back onto the record. Worth replicating this same explicit UX callout in our clone so organizers understand where uploaded files end up.

10. **Coverage gap for the original ask**: the requested "Portal > Tasks" (speaker-facing checklist) and "Portal > Forms" (speaker-facing live form fill-out with bio/headshot/AV-requirements fields) were NOT actually depicted in any of the 8 supplied images — all 8 are organizer/admin builder screens instead, several in empty states. To fully close out the drag-and-drop Agenda grid and the true speaker-portal checklist/form-fill UI, we need a second screenshot pass targeting: (a) Agenda Day/Week/Rooms views with real sessions scheduled, (b) the Conflicts tab with an actual conflict present, and (c) the "View Portal" preview (top-right button, present on every admin screen) clicked through to show the live Tasks checklist and a Form being filled out by a speaker.
