# Sessionboard UX Forensics — CMS Embeds & Dashboard

Source screenshots: `$10,0000 Kill My SaaS - Competition Brief/images/`
App: `appv2.sessionboard.com/event/6703/...` (event "AI.Engineer Sandbox Event - NYC", Oct 12–14 2026)
Global chrome observed across all screens: white top bar (`#FFFFFF`), left icon rail with blue "megaphone" logo tile (`~#2F5CF0` / `#3B5BFB` on `#EFF3FF` rounded-square background), top search bar "Find or ask" with `⌘K` hint pill, right-aligned "View Portal" outlined-blue button, bell/megaphone announcement icon with red notification dot, "?" help icon, circular dark-navy avatar badge "SY". Left sidebar shows event switcher card (org initials avatar "AS", org name truncated "AI.Engineer Sand...", date range "Oct 12–14, 2026", chevron expander) then nav sections: Dashboard, Program (expandable: Overview, Submissions [View All, Abstracts, Sessions, Files], Collect & Review [Forms, Evaluation, Agenda, Invoices, Site], Portals [Portals, Tasks, Forms, File Requests, Resources, Files], Configure [Settings]), then CRM, Marketing, CMS (Overview, Embeds), Reports, Studio, History, Event Team, Preview, Settings. Base font is a clean grotesque/system sans (looks like Inter or similar), body copy ~14px, headings bold ~28–32px for page titles.

Overall palette: background `#F5F7FB`/`#EEF2FA` (very light blue-gray), card surfaces `#FFFFFF` with 1px `#E5E9F2` borders and ~8–12px border radius, primary brand blue `#2F5CF0`/`#3560F0`, success/green `#1E9E6B` or similar (progress bars, "Accepted" pills use near-black `#0B1220` chip with white text in one place and green text-on-mint-background elsewhere — inconsistent, see notes), purple accent `#7C4DFF`/`#8B5CF6` for some donut segments and pipeline dot, orange/amber `#F5A623` for "Pending"/review accents, headings in near-black navy `#111827`/`#0F172A`.

---

## image39.png — CMS > Embeds (list view)

**1. Screen:** CMS section, "Embeds" sub-page (`.../event/6703/cms/embeds`). This is the entry point for the embeddable widgets feature (marked OPTIONAL in the brief).

**2. Layout structure:**
- Left sidebar: full nav rail, with "CMS" expanded showing two children — "Overview" and "Embeds" (Embeds is active, highlighted with light-blue pill background `#E8EEFE` and blue text/icon).
- Main content area, single column, generous top padding:
  - Header row: small `<>` (code bracket) icon in a light-gray rounded-square tile, page title "Embeds" (large bold), subtitle line "Export a feed of your agenda, sessions, or speakers to place in your app or website." in muted gray.
  - Toolbar row: left — search input "Search by name, format, or ID..." (full rounded rectangle, magnifying-glass icon prefix); next to it a segmented filter/tab group "All 1 · Enabled 1 · Disabled 0" (pill-style, "All" active with darker gray background chip showing the count inline); right — primary blue button "+ Add Embed" with a small chevron-down (implies a dropdown of embed types).
  - Below toolbar: a collapsible group header "Styled HTML  1" (with `<>` icon prefix and an up-chevron to collapse), acting as a category grouping for embed cards.
  - Card grid (appears to be 1 card so far, room for a multi-column grid): a white rounded card labeled "New Embed" with a small "duplicate" icon and a "..." overflow-menu icon top-right, and a status pill below reading "Enabled" (pale green background `#DDF5E8`, green text `#1E9E6B`).

**3. Components / exact labels:**
- Page title: "Embeds"
- Subtitle: "Export a feed of your agenda, sessions, or speakers to place in your app or website."
- Search placeholder: "Search by name, format, or ID..."
- Filter tabs: "All 1", "Enabled 1", "Disabled 0"
- Button: "+ Add Embed" (with dropdown chevron)
- Group label: "Styled HTML" with count badge "1"
- Embed card: title "New Embed", icons (copy/duplicate, more-options "..."), status chip "Enabled"

**4. Visual style:** Background light lavender-gray `#EEF1FA`. Cards white with subtle border/shadow, ~10px radius. Primary button solid blue `#2F5CF0`/`#3560F0`, white bold text, ~8px radius, medium padding (~10x20). Status pill: mint background, green text, pill/rounded-full shape, small caps-ish weight-medium label. Group header is a full-width light-gray bar (`#F1F3F8`) with bold left-aligned label and chevron on the right — accordion pattern. Typography: page title ~28px bold dark navy; body/labels ~14px regular gray `#6B7280`; card title ~15px medium dark.

**5. Interactions implied:** Click "+ Add Embed" → opens a type picker (dropdown or panel) leading to the builder shown in image12. Search filters embed cards by name/format/ID. Tab filters (All/Enabled/Disabled) toggle visible cards. Card overflow menu ("...") likely offers Edit/Duplicate/Delete/Disable. Copy icon duplicates the embed config. Group header collapses/expands the "Styled HTML" category (suggesting other embed format categories like JSON/iCal could exist elsewhere).

**6. Outstanding-speaker-tasks relevance:** None directly — this is the embeds list, unrelated to onboarding-task tracking.

---

## image12.png — CMS > Embeds > New Embed (builder / editor, live preview)

**1. Screen:** Detail/edit view for a single embed ("New Embed"), reached from image39's card or "+ Add Embed". Two-pane layout: left = configuration form, right = live device-frame preview.

**2. Layout structure:**
- Left panel (~35% width, white, scrollable, right border divider):
  - Header: back-arrow "←", title "New Embed".
  - Accordion section "Type" (expanded, chevron-up):
    - Field "Name *" with info "ⓘ" icon, text input containing "New Embed", and to its right a labeled toggle "Enabled" with an on/off switch (currently ON, dark navy filled).
    - Field "Format *": a card-style selector showing "Embed Styled HTML" (bold) with a "🔒 Locked" badge top-right, description text: "Configure settings for styled HTML feeds including Agenda, Session List, Schedule Itinerary, Speaker List, and Speaker Gallery. Each embed can be placed directly in your website and will auto-update with speaker and session details." plus helper text "Create a new embed to use a different format." (muted, smaller).
  - Three collapsed accordion sections below: "Style Options", "Filters (badge: 1)", "Field Options" — each with a chevron-down, indicating more config (colors/fonts, filter rules, which fields to show).
- Right panel (~65% width, dark canvas):
  - Preview toolbar: "👁 Preview" / "</> Get Code" tab toggle (Preview active, underlined/bold), and top-right small label "Styled HTML" (format indicator).
  - Below: a browser-chrome mock (traffic-light dots red/amber/green), a dropdown selector currently reading "Agenda" (this is the embed TYPE being previewed — dropdown implies switching among Agenda / Session List / Schedule Itinerary / Speaker List / Speaker Gallery per the format description), desktop/mobile viewport toggle icons, and right-aligned "Copy code" button + refresh icon + external-link/open icon.
  - A mock address bar: "https://www.yoursite.com/agenda?" with query param highlighted in a gray pill "sb-speaker-id=abc123" and a "Go" button — demonstrating deep-linking an embed to a specific speaker via URL param.
  - Rendered preview: a blue banner bar with white bold text "AI.Engineer Sandbox Event - NYC", below it a near-black/navy content area with a small ">" expand chevron (likely an accordion/day-selector for the agenda), and at the very bottom-left a "Powered by SESSION BOARD" badge (white text + small logo mark) — confirming free-tier/branding footer on embeds.

**3. Components / exact labels:**
- "New Embed" (editable name field, also page title)
- Toggle: "Enabled"
- "Format *" selector card: "Embed Styled HTML", badge "Locked"
- Accordions: "Style Options", "Filters" (count 1), "Field Options"
- Preview tabs: "Preview", "Get Code"
- Format tag: "Styled HTML"
- Type dropdown in preview: "Agenda"
- Buttons/icons: desktop icon, mobile icon, "Copy code", refresh, external-link
- URL bar: "https://www.yoursite.com/agenda? sb-speaker-id=abc123" + "Go"
- Preview content: event title banner "AI.Engineer Sandbox Event - NYC", dark body, "Powered by SESSION BOARD" watermark

**4. Visual style:** Split-pane editor pattern (config left, live preview right) — a common no-code embed-builder UX. Left pane uses standard white/light-gray form styling with accordions (chevron rotates open/close), red-asterisk required-field markers. The preview pane simulates an actual browser window with macOS-style traffic-light dots for realism. Preview brand banner blue matches app's primary blue `#2F5CF0`; content background very dark navy `#0B1220`/`#0D1526` (this is the embeddable widget's own theme, distinct from the app's light theme — suggesting the widget itself defaults to a dark card look that can be restyled via "Style Options"). "Powered by" watermark in small caps white/gray, bottom-left, low-emphasis — a typical white-label footer for a free/lower-tier plan.

**5. Interactions implied:** Toggle "Enabled" on/off; edit Name; Format is locked once created (can't change format in place — must create new embed); expand Style Options to reconfigure colors/branding; expand Filters to scope which speakers/sessions appear; expand Field Options to choose displayed fields (name, bio, headshot, company, etc.); switch preview Type dropdown among Agenda/Session List/Schedule Itinerary/Speaker List/Speaker Gallery; toggle desktop/mobile responsive preview; "Get Code" tab reveals the actual `<script>`/`<iframe>` snippet to copy; "Copy code" button one-click copies embed code; URL param `sb-speaker-id=abc123` shows embeds support deep-linking/filtering via query string for a single speaker's public profile card.

**6. Outstanding-speaker-tasks relevance:** None — purely public-facing embed configuration, not an internal dashboard/task view.

---

## image32.png — Dashboard > "Today" (default/system dashboard), top portion

**1. Screen:** Main "Dashboard" landing page, "Today" tab selected (one of 4 tabs: Today, Review Progress, Speaker Tracking, Submissions Pipeline). URL implied `.../event/6703/dashboard`. This is the organizer's daily-driver home screen after login.

**2. Layout structure (top-to-bottom):**
- Context line: "SATURDAY, AUGUST 8 · 65 DAYS TO EVENT" (small caps, muted gray, centered-left).
- Greeting headline: "Good morning, Sw" (very large bold, ~32px, dark navy) — personalized greeting using first-name initials/short name.
- Dashboard tab-strip: 4 tabs each prefixed with a small colored dot — "● Today" (blue dot, active/underlined), "● Review Progress" (orange dot), "● Speaker Tracking" (blue dot), "● Submissions Pipeline" (purple dot). Right-aligned button "+ Add Dashboard" (outlined, plus icon) — confirms dashboards are a manageable/addable set of "views," not just tabs.
- KPI stat-card row (4 equal white cards, each with a top-right line icon):
  - "Submissions" — icon: document/file — value "4"
  - "Accepted Speakers" — icon: microphone — value "2"
  - "Exhibitors" — icon: booth/storefront — value "0"
  - "Sponsors" — icon: medal/ribbon — value "0"
- Section label "SUBMISSION STATUS" (small caps muted).
- Second stat-card row (5 equal white cards, each icon top-right):
  - "Accepted" — icon: check-circle — value "1"
  - "Pending" (with "ⓘ" info icon) — icon: clock — value "3"
  - "Declined" — icon: x-circle — value "0"
  - "Drafts" — icon: edit/document — value "0"
  - "Withdrawn" — icon: exit-arrow — value "0"
- "Also check" nudge bar (single-line, light background strip): "Also check   1 accepted sessions still need a time slot on the agenda. (Agenda) >   ·   3 session submissions are awaiting a decision. (Participants) >   +1 more" — an inline actionable digest/notification row with clickable deep-links.
- Sub-tab strip: "Submission Forms" (active, blue underline) | "Participants" | "Evaluations" | "Agenda" — this switches the detail panel beneath.
- Detail panel (bordered card, light background) titled "Submission Pacing" with subtitle "Cumulative submissions in the run-up to event start." and a collapse/expand chevron button top-right.
  - Mini-stat row inside: "Submissions: 4", "vs prior (T-65d): — —", "Days to event: 65", "This week vs prior: +4"
  - Legend "— This event" (purple line swatch) and a toggle-button pair "Days before event" (active, blue filled) / "Calendar date" (inactive, outlined) — X-axis mode switch for the chart below.
  - Line/area chart begins to render (Y-axis ticks 4,3,2..., X-axis "This event" purple line), cut off at bottom of screenshot.

**3. Components — exact labels:** "Submissions", "Accepted Speakers", "Exhibitors", "Sponsors", "Accepted", "Pending", "Declined", "Drafts", "Withdrawn", "Also check", "Submission Forms", "Participants", "Evaluations", "Agenda", "Submission Pacing", "vs prior (T-65d)", "Days to event", "This week vs prior", "Days before event", "Calendar date".

**4. Visual style:** Stat cards: white, ~12px radius, subtle border, generous internal padding (~24px), label top-left in medium-gray, big bold black number below (~32–36px), icon top-right in a light rounded-square chip (outline-style icon, muted navy/gray stroke). "Also check" bar: pale blue background (`#EAF1FF`), rounded, single row, italic-ish label "Also check" then plain-text sentences with parenthetical blue-link category tags and chevron affordances — a compact actionable insights strip. Nested "Submission Pacing" widget: bordered card with off-white/lavender background, mini KPI cells separated by vertical hairlines rather than full card borders (denser sub-stat treatment), toggle pair styled as segmented control (blue-filled active state, white outline inactive).

**5. Interactions implied:** Tabs switch entire dashboard "view" (Today/Review Progress/Speaker Tracking/Submissions Pipeline — the last two are literally the same custom-dashboard templates seen in image3's gallery, meaning "Today" is a fixed system view, others are user-added custom dashboards). "+ Add Dashboard" opens the New Dashboard modal (image3). Stat cards are likely clickable (navigate to the underlying list e.g. click "Pending" → filtered submissions list). "Also check" links jump to Agenda / Participants pages pre-filtered. Sub-tabs (Submission Forms/Participants/Evaluations/Agenda) swap the lower widget entirely (as evidenced by image42 = Participants tab, image11 = Evaluations tab). Chart toggle switches X-axis between relative "days before event" and absolute "calendar date."

**6. Outstanding-speaker-tasks relevance:** Indirect — "Accepted Speakers: 2" stat and the "Also check" nudges are proto-signals, but the dedicated task-tracking view is the "Speaker Tracking" tab (see image31).

---

## image19.png — Dashboard > "Today", scrolled further down (Forms + Recent Submissions)

**1. Screen:** Same "Today" dashboard, scrolled past the chart to show "Your forms" and "Recent Submissions" sections.

**2. Layout structure:**
- Continuation of the "Submission Pacing" chart: X-axis labels visible "T-365d, T-290d, T-215d, T-140d, T-65d" (days-before-event ticks), helper caption below chart: "Pick a prior event to compare submission pacing edition-over-edition." (muted italic-gray, implies historical/edition-over-edition benchmarking is a feature).
- Section header "Your forms" with right-aligned link "View 1 more".
  - Nested card "SUBMISSION PROGRESS" (small caps label) with a full-width green progress bar (100% filled) and caption "2 submitted".
  - Row of 3 form cards (equal width, white, bordered):
    - "Session Submission Form #2" + green pill "Open"; thin green progress bar (~60% filled); "1 submitted"; buttons "🔗 View" (outlined) and "⚙ Manage" (ghost/text).
    - "Session Submission Form #3" + green pill "Open"; caption "Closes in a month"; green progress bar (~90% filled); "1 submitted"; buttons "🔗 View" / "⚙ Manage".
    - "Session Submission Form #4" + green pill "Open"; caption "No submissions yet"; (no progress bar / empty state); buttons "🔗 View" / "⚙ Manage".
- Section header "Recent Submissions" with right-aligned link "View all".
  - Data table, columns: **Source | Title | Status | Speakers | Tags | Submitted**
    - Row: Source "Session Submission Form #3", Title "sd", Status pill "Accepted" (dark navy filled pill, white text), Speakers "—", Tags "Tag A" (circular avatar-style chip), Submitted "Fri August 7, 2026, 11:51:05 PM PDT"
    - Row: Source "Session Submission Form #2", Title ";lkj", Status pill "Pending" (light-gray pill), Speakers "—", Tags "Tag A", Submitted "Fri August 7, 2026, 11:32:55 PM PDT"
    - Row: Source "Manual", Title "AIE Presenting Expo 1", Status "Pending", Speakers "—", Tags "—", Submitted "Fri August 7, 2026, 02:52:23 PM PDT"
    - Row: Source "Manual", Title "AIE NYC 2026: Insights from Session T..." (truncated), Status "Pending", Speakers "—", Tags "Tag A", Submitted "Thu August 6, 2026, 02:10:49 PM PDT"

**3. Components — exact labels:** "Your forms", "View 1 more", "SUBMISSION PROGRESS", "2 submitted", "Session Submission Form #2/#3/#4", "Open", "Closes in a month", "No submissions yet", "View", "Manage", "Recent Submissions", "View all", table headers "Source, Title, Status, Speakers, Tags, Submitted", status values "Accepted"/"Pending", tag chip "Tag A".

**4. Visual style:** Form cards: white, bordered, rounded ~10px, title bold ~16px + status pill inline to the right (green mint bg / green text, pill shape), thin progress bar beneath (green fill on light-gray track, ~4px height, full rounded), caption text small muted gray, two buttons bottom-aligned (outlined "View" with icon, plain-text "Manage" with gear icon). Table: clean row-per-record with generous vertical padding (~16-20px), no zebra striping, hairline row dividers (`#EEF0F5`), status pills color-coded (Accepted = solid dark navy/black pill w/ white text — an odd stylistic outlier vs. the mint-green "Accepted" pill used elsewhere in the app; Pending = light-gray neutral pill), Tags rendered as small circular badge "Tag A" rather than a rectangular chip.

**5. Interactions implied:** "View 1 more" expands additional form cards beyond the visible 3. Each form card's "View" opens the public form, "Manage" opens the form editor/settings. Table rows are likely clickable → open submission detail. "View all" navigates to the full Submissions list (View All under Program > Submissions).

**6. Outstanding-speaker-tasks relevance:** None directly (this is submission-centric, not speaker-onboarding-centric), though "Speakers" column exists in the Recent Submissions table (currently "—" placeholder) — implying speaker names/avatars would populate here once assigned to a session.

---

## image42.png — Dashboard > "Today" > "Participants" sub-tab (Program snapshot)

**1. Screen:** Same Today dashboard, but with the lower sub-tab set to "Participants" instead of "Submission Forms". This is the closest general-dashboard view to per-speaker completion status.

**2. Layout structure:**
- (Top of visible crop) repeat of Submission Status 5-card row (Accepted 1, Pending 3, Declined 0, Drafts 0, Withdrawn 0) and the "Also check" bar (single item visible: "1 accepted sessions still need a time slot on the agenda. (Agenda) >").
- Sub-tabs: "Submission Forms" | "Participants" (active, blue underline) | "Evaluations" | "Agenda".
- A highlighted/bordered panel (light mint-green border, ~`#DFF3E8`, rounded corners) containing:
  - Insight row 1: "ⓘ 3 session submissions are awaiting a decision." with right-aligned blue link "Review submissions".
  - Insight row 2: "ⓘ 2 accepted speakers are missing a bio or headshot (2 bios, 2 headshots)." with right-aligned blue link "View speakers" — **this is the clearest general-dashboard evidence of per-speaker outstanding-task surfacing** (bio/headshot completion).
  - Section header "Program snapshot" with right-aligned link "View participants".
  - Card "PARTICIPANTS BY ROLE" (small-caps label) with explanatory copy: "Role names (e.g. Speakers, Unconfirmed Speakers) come from this event's participant role settings. Each row is unique people in that role on a submission. The center total deduplicates people in multiple roles." Below: large centered number "6" / "unique participants", a full-width horizontal stacked bar (100% green, single segment here), and a legend row: green dot "Speakers  6  100%  >" (chevron implies drill-down).
  - Card "SUBMISSION STATUS" (small-caps) subtitle "Counts session submissions (not people), at top level only." with a donut/ring chart (center label "3 / awaiting decision") and a 4-row legend with counts + percentages + chevrons:
    - Purple dot "Accepted abstracts — 1 — 20% >"
    - Purple dot "Accepted sessions — 1 — 20% >"
    - Orange/amber dot "Pending abstracts — 1 — 20% >"
    - Orange/amber dot "Pending sessions — 2 — 40% >"

**3. Components — exact labels:** "3 session submissions are awaiting a decision.", "Review submissions", "2 accepted speakers are missing a bio or headshot (2 bios, 2 headshots).", "View speakers", "Program snapshot", "View participants", "PARTICIPANTS BY ROLE", "6 unique participants", "Speakers 6 100%", "SUBMISSION STATUS", "3 awaiting decision", "Accepted abstracts 1 20%", "Accepted sessions 1 20%", "Pending abstracts 1 20%", "Pending sessions 2 40%".

**4. Visual style:** Insight rows use a pale blue background chip/row (`#EAF3FF`) with a blue outlined "ⓘ" info-circle icon, black body text, and a bold blue right-aligned CTA link — a lightweight notification/task-nudge pattern reused across the dashboard (matches "Also check" styling family). "Program snapshot" cards are white, bordered, generous padding, small-caps section labels in muted gray-blue, large centered numerals for the "role" widget, donut chart uses purple + amber/orange 2-tone palette with a bold center number + muted center caption, legend items each end in a chevron ">" suggesting click-through to a filtered list.

**5. Interactions implied:** "Review submissions" → Submissions list filtered to pending. "View speakers" → Participants/Speakers list filtered to those missing bio/headshot (this is effectively the outstanding-speaker-task filter, expressed inline rather than as a dedicated table). "View participants" → full Participants list. Each legend row chevron drills into a filtered sub-view (e.g., click "Pending sessions" → sessions pending list).

**6. Outstanding-speaker-tasks relevance — CORE:** This is the strongest signal in the general dashboard: a plain-language insight card literally states *"2 accepted speakers are missing a bio or headshot (2 bios, 2 headshots)"* with a one-click "View speakers" link. This confirms the product tracks per-speaker profile-completion state (bio present/absent, headshot present/absent) and surfaces it as an actionable count, separate from submission/session status. A clone should replicate this exact pattern: a computed list of "speaker onboarding gaps" (missing bio, missing headshot, unconfirmed, no agreement signed, etc.) rendered as a dismissable/persistent insight banner plus a filterable "Speakers" list view.

---

## image11.png — Dashboard > "Today" > "Evaluations" sub-tab

**1. Screen:** Same Today dashboard, lower sub-tab set to "Evaluations". Browser URL bar visible: `appv2.sessionboard.com/event/6703/dashboard/evaluations` — confirms each sub-tab is its own route.

**2. Layout structure:**
- Repeats greeting header "Good morning, Sw", the 4-tab dashboard strip (Today active), "+ Add Dashboard" button, the 3-stat KPI row (Submissions 4, Accepted Speakers 2, Exhibitors 0, Sponsors 0), "SUBMISSION STATUS" 5-card row, "Also check" bar.
- Sub-tabs: "Submission Forms" | "Participants" | "Evaluations" (active) | "Agenda".
- Panel with pale-yellow border/background accent (`#FFFDE7`-ish) titled "Review progress" with right-aligned link "Open evaluation".
  - Empty-state placeholder box (dashed border): "Reviewer assignments will appear here once evaluations begin." (centered, muted gray italic).
  - Below: 3-cell mini-stat row (separated by hairlines, not full cards): "Evaluation 2.0 plans — 1", "Evaluated submissions — 0", "Reviews in progress — 0".
  - Footer line: "Most active plan: My Evaluation Plan" (label muted, value bold).

**3. Components — exact labels:** "Review progress", "Open evaluation", "Reviewer assignments will appear here once evaluations begin.", "Evaluation 2.0 plans", "Evaluated submissions", "Reviews in progress", "Most active plan: My Evaluation Plan".

**4. Visual style:** The colored accent border on the panel changes per sub-tab (green-ish for Participants panel in image42, pale yellow/cream for Evaluations here) — a subtle color-coding convention differentiating dashboard sub-sections. Empty states use a dashed-border light box with centered muted copy — consistent empty-state pattern likely reused throughout the app (also implied for "No data" widgets in image31).

**5. Interactions implied:** "Open evaluation" deep-links into the Evaluation module. Once reviewers are assigned, the dashed box would presumably populate with a reviewer-workload list/table.

**6. Outstanding-speaker-tasks relevance:** None (evaluation/review workflow, not speaker onboarding).

---

## image31.png — Dashboard > "Speaker Tracking" (custom dashboard) — outstanding-speaker-task view

**1. Screen:** Custom dashboard tab "Speaker Tracking" (3rd of the 4 dashboard tabs), one of Sessionboard's pre-built custom-dashboard templates focused specifically on speaker completion tracking. This is the **most directly relevant screen** to the "which speakers still have outstanding onboarding tasks" requirement.

**2. Layout structure:**
- Standard header repeats (date/countdown, "Good morning, Sw", 4-tab strip with "Speaker Tracking" active/underlined in blue).
- Sub-header row: small blue dot + small-caps label "CUSTOM DASHBOARD" and description "Confirmation status, outstanding tasks, and an overdue list for accepted speakers." (this line is literally the dashboard's stated purpose). Right-aligned buttons: "+ Add Widget" (outlined) and "⚙ Settings" (outlined).
- Widget grid, 2 columns (roughly 2/3 + 1/3 split on the right):
  - Left-top row, 2 equal square-ish stat widgets side by side:
    - Big centered number "0", label below in small-caps bold "ACCEPTED SPEAKERS"
    - Big centered number "0", label "OUTSTANDING SPEAKER TASKS" — **this is the literal named metric for the core requirement.**
  - Right column, tall widget: header "SPEAKER CONFIRMATION MIX" (small-caps), body currently "No data" (centered muted placeholder) — implied to normally hold a donut/pie chart of confirmed vs. unconfirmed/pending speakers.
  - Below-left, wide widget: header "TOP SPEAKERS BY OUTSTANDING TASKS" (small-caps) — body "No data" placeholder. This is the named widget that, when populated, would literally rank/list speakers by number of open onboarding tasks (the exact feature the brief calls out as core). Per the Gallery preview in image3, this renders as a horizontal bar-chart/list of speaker names with bar lengths = task counts.

**3. Components — exact labels:**
- Tab: "Speaker Tracking"
- Description: "Confirmation status, outstanding tasks, and an overdue list for accepted speakers."
- Buttons: "+ Add Widget", "⚙ Settings"
- Widgets: "ACCEPTED SPEAKERS" (0), "OUTSTANDING SPEAKER TASKS" (0), "SPEAKER CONFIRMATION MIX" (No data), "TOP SPEAKERS BY OUTSTANDING TASKS" (No data)

**4. Visual style:** Widget cards are plain white, bordered, generously sized, minimal internal chrome — big bold numerals (~48–56px) centered for KPI tiles, small-caps gray-navy label centered beneath. Chart widgets show a simple centered "No data" gray placeholder when empty (no icon, no illustration) — a spare/minimal empty state. Grid uses CSS-grid-like proportions: two small square tiles + one tall right-side tile on row 1, one wide tile spanning under the two squares on row 2.

**5. Interactions implied:** "+ Add Widget" opens a widget picker to append more metrics/charts to this custom dashboard. "⚙ Settings" likely lets you rename/reconfigure/delete the dashboard or change its refresh/date-range scope. Presumably each KPI tile and chart is clickable to drill into a filtered Speakers list. Because current data is all zero/"No data" (this sandbox event has only 0 accepted speakers logged against roles, despite "Accepted Speakers: 2" showing elsewhere — likely a data-sync nuance between "accepted via submission" vs. "accepted + confirmed as speaker record"), the widgets show their empty states.

**6. Outstanding-speaker-tasks relevance — CORE, PRIMARY EVIDENCE:** This entire dashboard tab is purpose-built for the requirement. Its subtitle literally says "outstanding tasks... for accepted speakers," and it has a dedicated metric card labeled **"OUTSTANDING SPEAKER TASKS"** plus a dedicated widget **"TOP SPEAKERS BY OUTSTANDING TASKS"** (a ranked list, per the gallery thumbnail in image3, showing speaker initials/names like "A. Chen, N. Patel, J. Rivera, S. Park, L. Wang, T. Brown" each with a horizontal bar sized to task count) and a **"SPEAKER CONFIRMATION MIX"** donut (confirmed vs. unconfirmed/declined speakers). A clone's "core" outstanding-tasks view should ship exactly this trio: (a) a raw outstanding-task count KPI, (b) a confirmation-status breakdown chart, and (c) a sortable/ranked speaker list showing name + outstanding task count + (implied) task types (bio, headshot, bio/headshot per image42, plus likely: agreement/contract signed, AV/tech-rider submitted, headshot uploaded, session confirmed, travel info, etc.).

---

## image34.png — Dashboard > "Submissions Pipeline" (custom dashboard)

**1. Screen:** 4th dashboard tab, "Submissions Pipeline" — another pre-built custom dashboard, this one submission/funnel-focused rather than speaker-focused.

**2. Layout structure:**
- Same header pattern; tab strip shows "Submissions Pipeline" active (purple dot, blue underline).
- Sub-header: purple dot + "CUSTOM DASHBOARD" label, description "Funnel of submissions from received → reviewed → accepted, with per-form and per-track context." Right buttons "+ Add Widget", "⚙ Settings".
- Widget grid:
  - Left-top: 2 square KPI tiles — "TOTAL SUBMISSIONS" = "2"; "PENDING REVIEW" = "2".
  - Right, tall widget: "SUBMISSIONS BY FORM" — a vertical bar chart, Y-axis 0–2 (gridlines at 0, .5, 1, 1.5, 2), single visible bar (~2 tall) under X-axis label "(none)" (blue solid bars, `#2F5CF0`-ish blue `#3B5BFB`).
  - Below-left, wide widget: "SUBMISSIONS BY TRACK" — vertical bar chart, Y-axis 0–1 (ticks 0, .25, .5, .75, 1 — mislabeled/overlapping as "25", "5", "75" in the crop, likely rendering artifact of ".25/.5/.75"), two bars each at height 1, both blue, X-axis labels cut off at bottom of screenshot.

**3. Components — exact labels:** "TOTAL SUBMISSIONS" (2), "PENDING REVIEW" (2), "SUBMISSIONS BY FORM", "SUBMISSIONS BY TRACK", axis label "(none)".

**4. Visual style:** Identical widget-card chrome to Speaker Tracking (white, bordered, small-caps header labels, big bold centered numerals for KPI tiles). Bar charts use solid blue fill, thin dashed horizontal gridlines (`#E5E9F2`), sans-serif axis tick labels in small muted gray, no data labels on bars themselves, bars appear moderately wide with small gaps (looks like ~40–50% category gap), no rounded bar corners (sharp rectangular bars).

**5. Interactions implied:** Same as other custom dashboards — Add Widget/Settings, presumably clickable bars drill into filtered submission lists by form/track.

**6. Outstanding-speaker-tasks relevance:** None — submissions/funnel focused, not speaker-task focused. Included for completeness/contrast with Speaker Tracking.

---

## image3.png — "New Dashboard" creation modal (Gallery of pre-built templates)

**1. Screen:** Modal/dialog triggered by "+ Add Dashboard", overlaying a dimmed Dashboard background. Title "New Dashboard", subtitle "Start from a pre-built dashboard, describe what you want, or build one manually."

**2. Layout structure:**
- Modal header: bold title "New Dashboard", close "✕" top-right.
- Subtitle line as above.
- Segmented control / tab bar, 3 options: "▦ Gallery" (active, white bg, appears as a raised/selected tab), "✨ AI prompt" (icon: sparkles — natural-language dashboard generation), "🔧 Build manually" (icon: wrench).
- Gallery grid, 2 rows x 3 columns visible (more likely below the fold — footer shows 2 more card tops cut off):
  - Row 1:
    1. **"Event Overview"** — colored header thumbnail (light blue gradient) showing 4 mini-KPI labels "SUBMISSIONS 248 / SPEAKERS 86 / SCHEDULED 142 / DRAFT 12" plus a mini bar chart "Sessions by Day" and mini donut "Status Mix" (legend: Accepted/Pending/Other). Description: "KPIs at a glance: total submissions, accepted speakers, scheduled sessions, and session..." (truncated). Tag pill "OVERVIEW" (blue). Meta: "5 widgets".
    2. **"Submissions Pipeline"** — purple gradient thumbnail with a funnel/filter icon. Description: "Funnel of submissions from received → reviewed → accepted, with per-form and..." Tag pill "SUBMISSIONS" (purple). Meta: "5 widgets".
    3. **"Speaker Tracking"** — pink/rose gradient thumbnail showing mini-KPIs "ACCEPTED SPEAKERS 86 / OUTSTANDING TASKS 42" plus a mini donut "Confirmation Mix" (68% shown) and a mini ranked list "Top Open Tasks" with rows "A. Chen, N. Patel, J. Rivera, S. Park, L. Wang, T. Brown" each with a horizontal bar (descending length, pink/rose color) — **this is the visual proof of the "which speakers have outstanding tasks" ranked-list widget design.** Description: "Confirmation status, outstanding tasks, and an overdue list for accepted speakers." Tag pill "SPEAKERS" (pink/rose). Meta: "5 widgets".
  - Row 2:
    4. **"Review Progress"** — orange/amber gradient, icon: clipboard-with-check. Description: "Reviewer workload, session scores, top-rated sessions, and pending submissions." Tag pill "EVALUATION" (amber). Meta: "5 widgets".
    5. **"Evaluation Plans by Tracks"** — gray gradient, icon: document. Description: "Compare Plan 2.0 session scores across tracks and evaluation plans." Tag pill "EVALUATION" (gray). Meta: "4 widgets".
    6. **"Schedule Health"** — indigo/blue-purple gradient thumbnail showing mini-KPIs "SCHEDULED 142 / UNSCHEDULED 28" plus mini bar charts "Sessions per Day" and "Sessions per Room". Description: "Scheduled vs unscheduled sessions, sessions per day/room/track, and an..." Tag pill "AGENDA" (indigo). Meta: "5 widgets".
  - Row 3 (cut off at bottom, 2 more card tops visible in pale green and pale peach — additional templates exist beyond the crop, category tags not readable).

**3. Components — exact labels:** Modal title "New Dashboard"; tabs "Gallery", "AI prompt", "Build manually"; template names "Event Overview", "Submissions Pipeline", "Speaker Tracking", "Review Progress", "Evaluation Plans by Tracks", "Schedule Health"; category tag pills "OVERVIEW", "SUBMISSIONS", "SPEAKERS", "EVALUATION" (x2), "AGENDA"; widget-count meta "5 widgets" / "4 widgets"; mini-thumbnail chart labels: "Sessions by Day", "Status Mix" (legend Accepted/Pending/Other), "Confirmation Mix", "Top Open Tasks" (with sample names A. Chen, N. Patel, J. Rivera, S. Park, L. Wang, T. Brown), "Sessions per Day", "Sessions per Room".

**4. Visual style:** Large centered modal (~1320px wide implied), white background, rounded corners (~16px), drop shadow separating from dimmed backdrop (`rgba(0,0,0,0.5)` overlay). Template cards: colored gradient header zone (~180px tall) containing a small white "mini-dashboard" preview card (rounded, drop-shadowed) with tiny mock stats/charts rendered at true-to-final-product fidelity — this is a strong pattern: each template's thumbnail is a miniature, accurate rendering of the widgets it contains. Below the gradient: white card body with bold template name (~16px), 2-line muted gray description, and a footer row with a colored category pill (rounded-full, small, colored bg + colored/dark text) + light-gray "N widgets" meta text. Card grid gap ~16–24px, 3 columns, consistent card height via truncated descriptions (ellipsis implied).

**5. Interactions implied:** Click "Gallery" template card → instantiates that pre-built dashboard as a new tab (this is how "Speaker Tracking" and "Submissions Pipeline" tabs got added in image31/34). "AI prompt" tab presumably lets the organizer type a natural-language description ("show me speakers missing headshots") and the system generates a custom widget set. "Build manually" opens a blank canvas with "+ Add Widget" only. Modal closes via "✕" or presumably clicking outside/Cancel.

**6. Outstanding-speaker-tasks relevance — CORE, KEY VISUAL REFERENCE:** The "Speaker Tracking" template thumbnail is the single richest piece of evidence for the required UI: it shows, at a glance, (a) two headline numbers "ACCEPTED SPEAKERS 86" and "OUTSTANDING TASKS 42", (b) a "Confirmation Mix" donut (percentage of speakers confirmed, e.g. "68%"), and (c) a "Top Open Tasks" ranked/sorted horizontal-bar list of individual speakers by name (abbreviated as first-initial + last name, e.g. "A. Chen") with bar length encoding task count, sorted descending (most outstanding tasks first). This confirms the intended end-state UI once real data exists (image31 showed the same widgets empty/zeroed for the sandbox event).

---

## Synthesis — building the "outstanding speaker tasks" view for the clone

**Primary blueprint = image31 + image3's "Speaker Tracking" template**, supplemented by the inline insight banner in image42.

Recommended core screen/module (mark as CORE per requirement, independent of the general dashboard being optional):

1. **Header/description bar**: "Speaker Tracking" (or similar) with one-line purpose text ("Confirmation status, outstanding tasks, and an overdue list for accepted speakers").
2. **Two headline KPI tiles**: "Accepted Speakers" (count) and "Outstanding Speaker Tasks" (count) — big bold centered numerals, small-caps label beneath, plain white bordered card.
3. **"Speaker Confirmation Mix" donut/pie**: segments for Confirmed / Unconfirmed / Pending / Declined (states inferred from "accepted speakers" + confirmation workflow), with center total number and percentage legend rows (each row clickable/chevron to drill into filtered list) — mirror the "SUBMISSION STATUS" donut styling from image42 (purple/amber palette, center numeral + caption).
4. **"Top Speakers by Outstanding Tasks" ranked list/bar-chart widget**: horizontal bars, one per speaker, sorted descending by open-task count, speaker name (or initial + last name) as the Y-axis label, bar length + inline count as the value. This is the literal "which speakers still have outstanding onboarding tasks" view.
5. **Underlying task taxonomy** (inferred from image42's banner + the "Speaker" concept generally in event-management SaaS): missing bio, missing headshot, unconfirmed attendance/session, unsigned agreement/release, missing AV/tech requirements, missing travel/logistics info. Each should be an individually trackable boolean/status per speaker so the "outstanding tasks" count is a sum, and the ranked list can show a tooltip/expansion of which specific tasks are open per speaker.
6. **Inline actionable insight banners** (reused pattern, not unique to this widget): pale-blue-background row, "ⓘ" icon, plain-English sentence stating the gap ("N accepted speakers are missing a bio or headshot"), right-aligned bold blue CTA link ("View speakers") that deep-links to a pre-filtered Speakers/Participants table. This pattern should appear both embedded in the main Dashboard "Today" view (Participants sub-tab) AND could double as the entry point into the dedicated Speaker Tracking dashboard.
7. Empty states: centered muted-gray "No data" text, no illustration — keep it minimal.
8. **"+ Add Widget" / "⚙ Settings"** controls on every custom dashboard, plus a global "+ Add Dashboard" → opens a "New Dashboard" modal with 3 modes (Gallery of templates / AI prompt / Build manually) — this whole dashboard system (tabs = list of saved dashboard configs, each composed of independently addable widgets) is itself worth replicating structurally even though the general dashboard is optional, since "Speaker Tracking" — the CORE requirement — is implemented as one of these template dashboards.

### Style tokens observed (for design-system reuse)
- Background: `#EEF1FA` / `#F5F7FB`
- Card surface: `#FFFFFF`, border `#E5E9F2`, radius ~10–12px
- Primary blue: `#2F5CF0` (buttons, active tab underline, links, primary chart bars)
- Success green: `#1E9E6B` text on `#DDF5E8` bg (status pills, progress bars)
- Warning/pending amber: `#F5A623`-ish (pending states, donut segments)
- Purple accent: `#7C4DFF`/`#8B5CF6` (secondary donut segments, "Submissions Pipeline" branding, line-chart series)
- Pink/rose accent: used specifically for "Speaker Tracking" template branding (gradient thumbnail + bar chart color) — could be reserved as the "Speakers" domain color throughout the clone for consistency (nav icon, tags, charts).
- Text: headings `#0F172A`/`#111827`, muted labels/small-caps `#6B7280`/`#8A93A6`
- Small-caps section labels used pervasively for widget/group headers (e.g. "SUBMISSION STATUS", "PARTICIPANTS BY ROLE", "ACCEPTED SPEAKERS") — letter-spaced, ~11–12px, medium-bold, muted gray-navy.
- KPI numerals: ~32–56px bold, black/navy, no color-coding by value (even "0" renders in the same dark color, not red/gray).
- Status pills: pill/rounded-full, colored bg + colored text pairing (mint/green for positive, light-gray for neutral/pending) — note one inconsistency where "Accepted" renders as a solid dark-navy pill w/ white text in the Recent Submissions table (image19) vs. the mint-green pill style used for embed "Enabled" status and form "Open" status — a clone can standardize this rather than replicate the inconsistency.
