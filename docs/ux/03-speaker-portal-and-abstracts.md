# Sessionboard UX Forensics — 03: Speaker Portal (Post-Submission) & Program > Abstracts

Source images: `$10,0000 Kill My SaaS - Competition Brief/images/{image17,image40,image5,image13,image14,image10,image8}.png`

Scope: (A) what a speaker sees in the public/speaker portal after they submit a CFP entry, and (B) the organizer-facing "Program > Abstracts" review workspace — the core submission-review, status-triage, column-configuration, and abstract-creation surfaces.

---

## PART A — Speaker Portal (post-submission)

### image17.png — Speaker Portal "Home" tab

**1. Screen**
The default landing tab of the public speaker portal, shown to a logged-in speaker/submitter after they've made at least one CFP submission. Top-right shows the logged-in identity (avatar "SY" + name "Sw yx" + chevron for account menu) — this is a *speaker-role* view of the portal, distinct from the organizer's internal app chrome (no left sidebar, no "Program" nav — this is the externally-facing portal).

**2. Layout structure**
- Full-width white page, thin bottom-border header bar with just the account menu (top right), no logo/left-nav visible in this crop.
- Centered page title "Home" (large, bold, serif-adjacent geometric sans, ~32px) with a full-width thin horizontal divider underneath.
- A horizontal pill/segmented tab bar, centered, with 4 tabs: **Home** (active, blue-bordered pill), **Submissions**, **Profile**, **Tasks**. Each tab is a rounded-rectangle button with an icon + label.
- Below the tab bar: two side-by-side cards in a 2-column grid (roughly 55/45 split): **"My Submissions (2)"** (left, wider) and **"My Profile"** (right).
- Below that, a full-width **"Tasks"** panel spanning the whole content width.

**3. Components (exact text)**
- Nav tabs: `Home` (house icon), `Submissions` (calendar icon), `Profile` (person-in-circle icon), `Tasks` (briefcase icon).
- Card 1 header (solid blue banner): calendar icon + **"My Submissions (2)"** on the left, **"View All"** link on the right (white text).
  - Submission row 1 (bordered card): title `SESS-4 – sd`, subtitle `Featured Keynote`, status row with green circular check icon + **`Accepted`** (green text).
  - Submission row 2 (bordered card): title `SESS-3 – ;lkj`, subtitle `Keynote`, status row with orange/amber outline circle icon + **`Pending`** (amber text).
  - Submission "titles" follow the pattern `{SubmissionCode} – {Title}` where code is `SESS-<n>`.
- Card 2 header (solid blue banner): person icon + **"My Profile"**.
  - Avatar square (gray, initials "SY"), name **"Sw yx"**, email `swyx@ai.engineer` (gray, smaller).
  - **"View more"** link (blue).
  - A dark tooltip/callout floating near bottom of this card: "Click to go back, hold to see history" (this appears to be an incidental OS/browser gesture-nav tooltip captured in the screenshot, not app UI — likely a trackpad gesture hint overlay, not a real Sessionboard component).
- Tasks panel header (solid blue banner): briefcase icon + **"Tasks"**.
  - Sub-tabs under the banner: **All** (active, blue underline), **My Tasks (0)**, **Submissions (0)**, and a right-aligned **Filter** control (funnel icon + chevron).
  - Section header row (light-gray background): **"Submission Tasks"** with an info "(i)" icon, and right-aligned **"Open All"** / **"Collapse All"** links.
  - Empty state text: "No submission tasks found."
  - Second section header: **"My Tasks"** with info icon.
  - Empty state (cut off): "No tasks found."

**4. Visual style**
- Primary brand blue: card headers/banners are a solid, saturated indigo-blue, ~`#4F5FE0` to `#4652D9` (royal/indigo-blue, similar to a Tailwind `indigo-600`/`blue-600` blend). Active tab border/text also this blue.
- Status colors: Accepted = green (~`#16A34A` icon, `#15803D`-ish text), Pending = amber/orange (~`#F59E0B` icon and text).
- Background: white page, cards have a very light gray/off-white body (~`#FAFAFA`–`#F5F6F8`) with 1px light-gray borders (~`#E5E7EB`) and generous rounded corners (~12–16px radius on outer cards, ~8px on inner submission cards).
- Typography: clean geometric sans-serif (looks like Inter or similar). Page title large/bold (~28–32px). Card headers white-on-blue, medium weight ~16px. Body text gray-900 for primary, gray-500 for secondary/meta.
- Spacing: generous padding inside cards (~20–24px), comfortable gaps between the two top cards (~24px), consistent card corner radius across the page suggesting a single design-system "Card" primitive reused for stat panels, list panels, and section panels alike.
- Section header rows inside the Tasks panel use a flat light-gray background band (~`#F3F4F6`) full-width, distinguishing "grouped list" sections within a card — same treatment we'd want for grouped table sections in our clone.

**5. Interactions implied**
- Tab bar switches views within the portal: Home / Submissions / Profile / Tasks (client-side routing, likely under a shared portal shell).
- "View All" on My Submissions → navigates to the Submissions tab/list.
- "View more" under My Profile → expands or navigates to full profile edit (see image40).
- Tasks panel: All / My Tasks / Submissions sub-filter tabs; a global Filter dropdown; per-section Open All/Collapse All (implies each task section is a collapsible group, likely grouped by submission or task type).
- Each submission card in "My Submissions" is presumably clickable → opens submission detail.

**6. Domain language**
- Statuses shown to the speaker: **Accepted**, **Pending** (matches organizer-side status vocabulary — see Part B; the speaker portal reads directly off the same status field, not a paraphrased/friendlier label).
- Submission naming convention: **SESS-{n}** as a short code, paired with the submission's title.
- Format/type labels used as subtitle under a submission: **"Featured Keynote"**, **"Keynote"** — implies a "Format" or "Session Type" taxonomy the speaker sees per-submission (Featured Keynote appears to be a distinct, higher-tier format from plain Keynote).
- "Tasks" is a first-class concept surfaced to speakers, split into "Submission Tasks" and "My Tasks" — implying the organizer can assign action items to speakers tied either to a specific submission or generally to the speaker.

---

### image40.png — Speaker Portal "Profile" tab, with account dropdown open

**1. Screen**
The Profile tab of the same speaker portal, mid-interaction: the account dropdown (top right) is open, and a large red annotation callout ("update your own bio data") has been added by whoever authored this teaser image — this is explanatory/marketing overlay, not app UI. There's also a big red arrow pointing at the dropdown item "Back to Admin Mode."

**2. Layout structure**
- Same shell as image17: top tab bar (Home / Submissions / **Profile** [active] / Tasks), avatar+name+chevron top-right.
- Below tabs: profile header row — large circular avatar placeholder ("Sy" initials, light gray), name **"Sw yx"** (bold), email `swyx@ai.engineer` (blue-tinted gray, looks like a mailto link) underneath.
- A single sub-tab pill below the header: **"Profile Info"** (only one visible — likely one of possibly several profile sub-sections).
- Two-column content area below: left column ~65% width = **"General"** panel; right column ~35% width = **"My Links"** panel. Both are collapsible (chevron icon top-right of each panel header).

**3. Components (exact text)**
- Account dropdown menu (opened from top-right chevron):
  - Header: name "Sw yx" + email "swyx@ai.engineer" (non-interactive identity block)
  - Divider
  - Menu item: **"Profile"** (person icon)
  - Menu item: **"Back to Admin Mode"** (two-people icon) — confirms this speaker account is actually an organizer/admin who used an "impersonate/view as speaker" feature and can switch back.
  - Menu item: **"Logout"** (exit icon)
- "General" panel:
  - Field label **"Biography"** with a rich-text toolbar: Bold (B), Italic (I), Underline (U), bullet list, numbered list, align-left, align-center, align-right, link (chain icon), clear-formatting (Tx icon).
  - Rich text body area with placeholder "Enter text here…"
  - Character counter: **"0 / 5,000 characters"**
  - Below a divider, a 3-column field row: **Salutation** (dropdown, shown collapsed/red-flagged with an emoji-like icon — likely a broken/placeholder render), **First Name** (text input, value "Sw"), **Last Name** (text input, value "yx")
  - Second 3-column field row: **Honorific** (text input, empty), **Pronouns** (select dropdown, placeholder "Select…"), **Gender** (select dropdown, placeholder "Select…")
  - Bottom edge shows a drag-handle affordance (dark pill, likely a resizable-panel or bottom-sheet handle from the screenshot tool, or a scrollbar thumb).
- "My Links" panel:
  - **LinkedIn URL** (text input, empty)
  - **X (Twitter) URL** (text input, empty)
  - **Facebook URL** (text input, empty)
  - **Website** (text input, empty)

**4. Visual style**
- Section panels use a very light gray/blue-tinted background (~`#F7F8FC`) with rounded corners (~12px) and thin border, consistent with image17's card style.
- Rich text toolbar sits in its own bordered sub-panel atop the text area, white background, icon buttons ~32px square, gray icon color (~`#374151`), no visible active/hover state captured.
- Field labels: small, medium-weight gray-700 text above each input, consistent label-above-input pattern throughout.
- Inputs: white background, 1px light-gray border, rounded ~8px corners, consistent height (~44px), placeholder text in lighter gray italic-less style.
- Avatar: large (~64–72px) circular, flat light-gray fill with darker gray initials — same avatar treatment as the small one in the top-right nav, just scaled up.
- The red arrow + red rounded-rectangle callout box are clearly post-hoc annotations (bright red `#EE1111`-ish, white bold sans text) added by Sessionboard's own marketing/screenshot tool — not part of the product chrome; should be ignored for our clone except as a note that "Back to Admin Mode" is a real, important feature.

**5. Interactions implied**
- Collapsible panels (chevron toggles General / My Links sections open-closed).
- Rich text biography editor with a 5,000-character cap and live counter.
- "Back to Admin Mode" — critical UX pattern: organizers can preview/act as a specific speaker (impersonation) from within the admin app, edit or view what the speaker sees, then jump back to their own admin session via this menu item. This should be replicated in our clone as an "Assume speaker view" / "View as speaker" affordance with a clear way back.
- Standard profile self-service editing: speaker can update their own bio, name, pronouns, gender, honorific, salutation, and social links — this is the data source for the organizer-side "Speaker" fields seen in Abstracts columns (e.g., bios/links feed into program/marketing).

**6. Domain language**
- "Profile Info" as the (only visible) sub-tab of Profile — implies there may be additional profile sub-tabs elsewhere (e.g., "Travel," "Availability") not captured here.
- Field vocabulary to mirror exactly: Biography, Salutation, First Name, Last Name, Honorific, Pronouns, Gender, LinkedIn URL, X (Twitter) URL, Facebook URL, Website.
- Portal role-switch is called **"Admin Mode"** vs implicitly "Speaker Mode" — worth adopting this naming.

---

## PART B — Organizer: Program > Abstracts

### image5.png — Abstracts list, default/base state

**1. Screen**
The organizer's internal "Program > Abstracts" table view — the central CFP review workspace, inside the full admin app shell (left sidebar nav, top global search/help/notifications bar).

**2. Layout structure**
- **Top global bar**: logo (blue rounded-square icon, top-left), global "Find or ask" search input with ⌘K hint (center), and right-aligned: "View Portal" link (blue), megaphone/broadcast icon, notification bell with red dot badge, help "?" icon, user avatar circle ("SY").
- **Left sidebar** (fixed, ~340px), organized into sections:
  - Workspace switcher at top: "AS" icon avatar + **"AI.Engineer Sand…"** (truncated) event name + **"Oct 12–14, 2026"** dates, with an up/down chevron (multi-event switcher).
  - **Dashboard** (top-level, grid icon)
  - **Program** (top-level, clipboard icon, expanded/expandable — chevron shown pointing down = expanded)
    - **Overview** (grid icon)
    - Section label: **SUBMISSIONS** (uppercase gray micro-label)
      - **View All**
      - **Abstracts** (currently active/highlighted, document icon)
      - **Sessions** (link icon)
      - **Files** (folder icon)
    - Section label: **COLLECT & REVIEW**
      - **Forms**
      - **Evaluation** (folder icon)
      - **Agenda** (calendar icon)
      - **Invoices** ($ icon)
      - **Site** (house icon)
  - Section label: **PORTALS**
    - **Portals** (gear icon)
    - **Tasks** (pulse/activity icon)
    - **Forms** (globe icon)
    - **File Requests** (file icon)
    - **Resources** (globe icon)
    - **Files** (file-plus icon)
  - Section label: **CONFIGURE**
    - **Settings** (gear icon)
  - Bottom-pinned: **CRM** app-switcher row (with its own icon), collapsed by default, chevron to expand; grid-icon button bottom-left corner (likely an app launcher / module switcher for the whole platform, since Sessionboard appears to bundle Program + CRM as distinct modules).
- **Main content area**:
  - Page header: document/abstract icon (in a gray rounded-square), **"Abstracts"** title (large bold), subtitle **"Review and manage your abstract submissions"** (gray).
  - Top-right of header: **"Options"** button (··· icon + label, outlined) and **"+ Add Abstract"** primary button (solid blue).
  - **Status tab strip** (horizontal, text tabs with counts, underline-active style):
    `All Abstracts  2` (active, blue underline) · `Accepted  0` · `Accept Queue  0` · `Pending  2` · `Decline Queue  0` · `Declined  0` · `Withdrawn  0` · `Drafts  0`
  - **Toolbar row**: search input "Search abstracts…" (left, wide), then right-aligned icon/button cluster: a "list/rows" icon button (looks like a row-height/density toggle), **"Saved Views"** (eye icon + chevron), **"Columns"** (outlined, currently active/selected — table-columns icon), **"Sort"** (up/down arrows icon), **"Filter"** (funnel icon).
  - **Data table**:
    - Leading checkbox-select column (header checkbox for select-all).
    - Columns (each with a small "(i)" info-tooltip icon next to the header label): **Status**, **Source**, **Title**, **Client Session ID**, **Description**, **Notified**, **Rating** (cut off at right edge — table scrolls horizontally, more columns exist beyond viewport, consistent with the 18/25 columns config seen in image14).
    - Row 1: checkbox, pencil/edit icon, Status pill **"Pending"** (yellow/amber), Source = **"Session Submission F…"** (truncated pill, likely "Session Submission Form"), Title = **"sd"**, Client Session ID = **"–"**, Description = **"wdw"**, Notified = **"–"**, Rating = (cut off).
    - Row 2: same pattern — Status **"Pending"**, Source **"Session Submission F…"**, Title **";lkj"**, Client Session ID **"–"**, Description **"lkjasd"**, Notified **"–"**.
    - (Test/dummy data — titles/descriptions are placeholder gibberish, confirming this is a sandbox account, not representative content but fully representative of structure.)
  - **Footer/pagination bar**: **"1 — 2 of 2 rows"** (left), page-number pager with `<` **1** `>` (center, "1" as active blue pill), **"Show: 25"** dropdown (right, rows-per-page selector).

**3. Components — exact labels recap**
- Status filter tabs: All Abstracts, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, Drafts (each with a live count).
- Toolbar controls: Search abstracts…, [density/list icon], Saved Views, Columns, Sort, Filter.
- Table columns visible: Status, Source, Title, Client Session ID, Description, Notified, Rating (+ Speaker, Track, Tags, Files, Location, Capacity, Format, Language, Level, Session Submitter, CEU Credits, Chairperson, Created At, Ends At, Exhibitors — enumerated fully in image14).
- Row-level icon actions: pencil (inline edit) next to the checkbox on every row.
- Header actions: Options (with dropdown — see image10), + Add Abstract (opens the panel in image8).

**4. Visual style**
- Overall admin theme: white content canvas, very light blue-gray page background wash behind/around the card-like main content region (~`#EEF1FA` outer background, white inner card with soft shadow/border).
- Sidebar: white background, active item ("Abstracts") has a light blue highlight background (~`#E8ECFC`) with blue text/icon, rounded rectangle selection, consistent with the blue accent used elsewhere.
- Primary blue accent (buttons, active tab underline, active nav item, links): ~`#4457E8`/`#4F5FE0` indigo-blue — same family as the portal cards in image17.
- Status pill colors: **Pending** = amber/yellow fill (~`#FCD34D`/`#FBBF24` bg, dark amber/black text) — pill shape, fully rounded, bold text, small (~28px tall).
- Typography: sans-serif throughout (Inter-like), table header labels small-caps-weight gray-600 (~13px), cell text gray-900 (~14px), page title bold ~24px, subtitle gray-500 ~14px.
- Table: white rows, subtle 1px bottom-border per row (~`#F1F2F4`), generous row height (~52–56px) for readability, checkbox + edit-pencil column kept narrow/fixed-left.
- Buttons: "Add Abstract" solid blue rounded (~8px) with white bold text and "+" icon; "Options" is outlined/ghost gray button with border; toolbar icon-buttons are outlined gray pill/rounded-rect buttons (~36px tall) with icon + label + occasional chevron.
- Empty-state cells render as a plain gray em-dash "–" for null values (Client Session ID, Notified) — a consistent placeholder-for-empty convention to mirror.

**5. Interactions implied**
- Clicking a status tab filters the table to that status (with counts already computed/live).
- Search box does live/instant text filtering across abstracts.
- Saved Views: implies users can save a named table configuration (filters+sort+columns) and switch between them.
- Columns: opens the column-manager panel (image14) to toggle/reorder/add fields.
- Sort / Filter: open their respective config panels (same tabbed "Preferences" modal per image14, which has Columns/Sort/Filter/Drafts as tabs).
- Row pencil icon: inline/quick-edit affordance separate from clicking into the row (which likely opens a full detail drawer/page).
- Row checkboxes + header checkbox: bulk-select for bulk actions (likely bulk status change, bulk export, bulk delete — inferred from the Options menu's bulk-oriented actions in image10, though those seemed table-wide not selection-scoped in this crop).
- Pagination: numbered pager + configurable page size (default 25).

**6. Domain language — statuses (exhaustive, from tab strip AND status-picker in image13)**
Full status vocabulary for an abstract/submission, in what appears to be pipeline order:
1. **Accepted**
2. **Accept Queue**
3. **Pending**
4. **Decline Queue**
5. **Declined**
6. **Withdrawn**
7. **Drafts** (separate bucket, likely submissions not yet finalized by the speaker)

This "Queue" pattern (Accept Queue / Decline Queue existing as distinct pre-stages before Accepted/Declined) is an important domain nuance: it implies a two-step decision workflow — an organizer/reviewer marks a submission for eventual acceptance or decline (queued), then a separate action/batch process (likely triggered notification + review) promotes it to the final Accepted/Declined state. This is likely tied to notification batching ("Notified" column) — i.e., you queue decisions, then bulk-send notification emails, which flips Queue → final state and stamps "Notified."

---

### image13.png — Abstracts list, Status cell edit popover open

**1. Screen**
Same Abstracts table as image5, but with an inline status-editor popover open on row 1's Status cell (triggered by clicking the "Pending" pill).

**2. Layout structure**
- Identical shell/table to image5.
- A floating popover anchored below/over the Status cell, white card with shadow, rounded corners (~10px), positioned overlapping into the second row.

**3. Components (exact text)**
- Popover header: **"Status"** (bold, left) and **"× Clear"** (right, muted link/button with an X icon) — lets you clear the status entirely.
- Option list (each rendered as a colored pill matching the table's pill styling, full-width row, hover/selectable):
  - **Accepted** (green pill)
  - **Accept Queue** (green pill — lighter/different green shade than Accepted, or same green; visually a slightly muted/lighter green vs Accepted's more saturated green)
  - **Pending** (yellow pill) — currently selected, shown with light-blue row highlight background and a **checkmark** on the right side confirming selection
  - **Decline Queue** (yellow/amber pill — same amber family as Pending, distinguishing "queue" states as amber alongside "Pending" rather than as a red-family state)
  - **Declined** (red pill)
  - A duplicate/second **"Pending ×"** pill shown at the bottom of the list, separately, with its own "×" remove icon — this looks like a "currently applied value" chip echoed at the bottom of the picker (possibly for a multi-select-style status field, or it's the pending "new value to apply" chip before hitting Save).
- Footer buttons: **"Cancel"** (outlined/ghost) and **"Save"** (solid blue) — confirming this status change requires an explicit save, it's not auto-committed on click.

**4. Visual style**
- Popover: white bg, ~1px light border + drop shadow, comfortable padding (~16–20px), rows ~40px tall with generous horizontal padding.
- Selected row gets a light blue background highlight (~`#EAF0FE`) behind the pill, with a bold black checkmark icon on the far right.
- Pill color coding confirmed across the whole taxonomy:
  - **Accepted** → saturated green (~`#22C55E` bg with white/black bold text — appears white-on-green or very dark-on-green, bold weight)
  - **Accept Queue** → green (same or very slightly different shade — both clearly "green family" = positive/accept path)
  - **Pending** → amber/gold (~`#F5C518`-ish, bold black text)
  - **Decline Queue** → amber/gold (same family as Pending — "still in limbo/needs action" reads amber)
  - **Declined** → red (~`#EF4444`/`#F87171`, bold text)
  - **Withdrawn** (not shown in this popover's visible options, likely below the fold or a separate concept — note the popover only lists 5 options + the trailing chip, not the full 7-status taxonomy from the tab strip, meaning Withdrawn/Drafts may not be manually settable via this quick-edit and might only be system/speaker-triggered states)
- Cancel button: outlined gray, standard secondary treatment; Save button: solid indigo-blue, standard primary treatment — consistent with "+ Add Abstract" button styling.

**5. Interactions implied**
- Status is changed via a click-to-open popover picker directly in the table cell (inline editing pattern), not a separate modal/drawer — fast triage workflow for reviewers scanning many rows.
- Selecting a new pill updates a staged/pending selection (shown as the trailing removable chip) before "Save" commits it — supports correcting a misclick before committing.
- "Clear" removes status entirely (sets to null/unset) rather than just closing.
- Since Withdrawn isn't in the manual picker, it's likely a status only the *speaker* can set (via their own portal, e.g. "withdraw my submission") or that's set automatically/by a distinct action — worth modeling as a state transition speakers themselves trigger, not organizers, in our clone.

**6. Domain language**
- Color-family grouping is a meaningful signal for our clone's design tokens: green = "will speak" (Accepted + its queue), amber = "undecided/in review" (Pending + Decline Queue oddly grouped here — meaning "Decline Queue" is still visually "amber" not "red," suggesting it reads as "pending a decline decision" rather than a final negative state), red = "declined" (final negative only).
- This confirms the **Queue** states are provisional/staging states rather than final; only **Accepted** and **Declined** (plus **Withdrawn**) are terminal.

---

### image14.png — "Preferences" modal, Columns tab (field picker)

**1. Screen**
A large right-side slide-over / modal titled **"Preferences"**, opened from the Abstracts toolbar's "Columns" button, showing the Columns configuration tab mid-use — background Abstracts table dimmed/overlaid behind it (modal-over-scrim pattern, ~60% width dark overlay on the left, ~40% width white panel on the right... actually spans nearly the full viewport as a 2-pane layout).

**2. Layout structure**
- Modal header: **"Preferences"** (bold title, left) and **"×"** close button (top right).
- Top tab strip inside the modal (underline-active style): **Columns  18/25** (active, with a live "selected/total" count badge), **Sort**, **Filter**, **Drafts** — confirming Columns/Sort/Filter/Drafts share one unified "Preferences" panel rather than being four separate popovers (contradicts the toolbar row's separate-looking buttons in image5 — clicking any of Saved Views-adjacent Columns/Sort/Filter opens this same shell, just pre-selecting the relevant tab).
- Below tabs, two-pane body:
  - **Left pane** ("available fields" browser):
    - Sub-tabs: **Fields** (active, solid blue pill) / **Reporting Fields** (plain tab).
    - Search input: "Search columns…"
    - Collapsible group header: **"SESSION DETAILS (18/39)"** with chevron (expanded) and right-aligned **"Show All"** / **"Hide All"** links.
    - A scrollable list of field rows, each with: checkbox, type icon (# for number, T for text, calendar icon for date, ≡ for rich text, chevron-down icon implying select/enum type), field name (bold) + field type label (gray, small, under the name), and a small calendar-like icon on the far right of each row (purpose unclear from crop — possibly "insert into agenda/timeline" or a per-field settings affordance).
    - Visible fields in this list (checked = currently selected/shown as columns): **Capacity** (Number, checked), **CEU Credits** (Number, checked), **Chairperson** (Text, unchecked), **Client Session ID** (Text, checked), **Created At** (Date, unchecked), **Description** (Rich Text, checked), **Ends At** (Date, unchecked), **Exhibitors** (Text, unchecked), **Files** (Text, checked) — list continues beyond the crop (39 total fields in this group alone).
  - **Right pane** ("selected columns" — current table configuration):
    - Header: **"Selected (18)"** (left) and **"Reset to Default"** (right, link).
    - Subtext: "Drag to reorder columns" — drag handles (⣿ icon) on every row.
    - Ordered list of currently-selected columns, each row = drag handle, type icon, field name, and an "×" remove button:
      **Client Session ID** (T), **Description** (≡), **Notified** (calendar icon), **Ratings: My Evaluation Plan** (#), **Format** (chevron/select), **Language** (chevron/select), **Level** (chevron/select), **Session Submitter** (T), **Speaker** (T), **Track** (chevron/select), **Tags** (chevron/select), **Files** (T), **Location** (chevron/select), **CEU Credits** (#) — (list continues/scrolls; 18 total, matching the "18/25" badge and "Selected (18)" header).
- Footer: bottom-right primary button **"✓ Apply Changes"** (solid blue).

**3. Components — exact labels recap**
- Tabs: Columns, Sort, Filter, Drafts.
- Sub-tabs (within Columns): Fields, Reporting Fields.
- Field group: "SESSION DETAILS" (there are presumably other groups below/above, like "Speaker Details" or "Review Details," not visible in this crop, given 25 total available column slots vs 39 fields in this one group).
- Buttons/links: Show All, Hide All, Reset to Default, Apply Changes.
- Notable field roster (this is the authoritative list of abstract/session metadata fields to replicate in our schema): Capacity, CEU Credits, Chairperson, Client Session ID, Created At, Description, Ends At, Exhibitors, Files, Location, Notified, Ratings: My Evaluation Plan, Format, Language, Level, Session Submitter, Speaker, Track, Tags, Status (implied), Source (implied), Title (implied), Starts At (implied, pairs with Ends At), Withdrawn/Decline reason (not directly observed but plausible).

**4. Visual style**
- Modal panel: white background, occupies right ~60% of viewport as a large drawer with rounded left corners; left portion of screen shows the dimmed/scrim'd Abstracts table behind it.
- Field-type icons use a small monochrome glyph system: `#` = number, `T` = text (serif capital T in a box), calendar = date, `≡` (lines) = rich text, `⌄` chevron = select/enum — a compact iconographic type system worth replicating 1:1 for a field/column picker in our clone.
- Selected checkboxes: solid blue-filled squares with white checkmark (~18px), unselected = empty outlined squares.
- Selected-column pill rows on the right use a light blue-tinted background (~`#EEF1FE`) per row, distinguishing "these are active" at a glance from the plain-white unselected rows on the left.
- Drag handles: vertical 6-dot grip icon, gray, left-aligned in each selected row.
- "Apply Changes" button: solid blue, checkmark icon + label, bottom-right, sticky footer.

**5. Interactions implied**
- Two-pane picker: check/uncheck in the left "catalog" pane adds/removes from the right "selected, ordered" pane; alternatively remove directly via "×" on the right.
- Drag-to-reorder on the right pane changes column order in the live table.
- Group-level "Show All"/"Hide All" toggles an entire field-group's fields at once (efficient bulk column management for wide field catalogs).
- "Reset to Default" reverts to the system/template default column set.
- This whole Preferences modal is reused across Columns/Sort/Filter/Drafts — i.e., our clone should build ONE generic "table preferences" component with tabs, not four bespoke popovers.
- "Reporting Fields" sub-tab suggests a second category of fields (likely computed/aggregate fields, e.g., rating averages, submission counts) distinct from raw data "Fields" — worth having a Fields vs Reporting-Fields distinction in our column model.

**6. Domain language**
- "Ratings: My Evaluation Plan" as a column name confirms Sessionboard supports multiple, named **Evaluation Plans** for scoring, and a reviewer can see ratings scoped to "their" plan as a column — a strong signal for how our scoring/rubric system should be modeled (named, possibly per-reviewer-role, Evaluation Plans with a Ratings rollup).
- Confirms field taxonomy naming to reuse verbatim: Capacity, CEU Credits, Chairperson, Client Session ID, Format, Language, Level, Session Submitter, Speaker, Track, Tags, Location.

---

### image10.png — Abstracts list, "Options" menu open (scrolled right to reveal more columns)

**1. Screen**
Same Abstracts table, scrolled horizontally to reveal additional columns, with the header **"Options"** button clicked open, showing its dropdown menu.

**2. Layout structure**
- Same shell/table/tab-strip/toolbar as image5, but the table is horizontally scrolled to show columns further right: **…mitter** (Session Submitter, truncated), **Speaker**, **Track**, **Tags**, **Files**, **Loca…** (Location, truncated), **Capacity** — confirming these are real, populated columns in this exact order for the two dummy rows.
- Options dropdown: anchored below the "Options" button, top-right, floating white card, right-aligned to the header button, with a red arrow annotation pointing at it (again, marketing overlay, ignore for UI purposes but note it's pointing at "Import Sessions" specifically as a highlighted capability).

**3. Components (exact text)**
- Row data confirmed: Row 1 — Session Submitter `@ai.en…` (truncated email), Speaker chips `qwd qdw` and `wad wdq` (multiple speaker pills = multi-speaker support per submission), Track pill **"Track 2"** (green), Tags pill **"Tag A"** (gray), Files `–`, Location `–`, Capacity `–`. Row 2 — Session Submitter `@ai.en…`, Speaker chip `wd wqd`, Track pill **"Track 1"** (blue), Tags **"Tag A"**, Files `–`, Location `–`, Capacity `–`.
- Options dropdown items (each with a leading icon):
  - **"Import Sessions"** (upload icon)
  - **"Export .CSV"** (download icon)
  - **"Export .XLSX"** (download icon)
  - **"Download files bundle…"** (download icon, two-line label wrapping)

**4. Visual style**
- Track pills are colored per-track (Track 2 = green, Track 1 = blue) — implies tracks have organizer-assignable colors, a taxonomy worth modeling with a color field.
- Tag pills are neutral gray, undifferentiated by tag name (unlike tracks) — tags are flat/uncolored metadata vs. tracks which get distinct branded colors.
- Speaker "chips" render as small pill-shaped tags per speaker name, multiple per cell when multi-speaker, wrapping/stacking horizontally.
- Options dropdown: simple white card, ~280px wide, icon+label rows ~44px tall, no dividers between items, subtle shadow, rounded corners matching the rest of the app (~8–10px).

**5. Interactions implied**
- Options menu = bulk data I/O actions scoped to the whole Abstracts list (not per-row): Import Sessions (bring in submissions from an external source/spreadsheet), Export CSV/XLSX (download current view), Download files bundle (zip of all attached files across abstracts).
- Table supports wide horizontal scroll with many columns (consistent with the 18-25 configurable columns from image14); column set order in this scrolled view: Status, Source, Title, Client Session ID, Description, Notified, Rating, [more cols], Session Submitter, Speaker, Track, Tags, Files, Location, Capacity, [continues to CEU Credits, Format, Language, Level per image14's selected list].

**6. Domain language**
- "Session Submitter" (the person who submitted, shown as email) is distinct from "Speaker" (the person(s) presenting) — a submission can be submitted by someone other than the speaker(s), and can have multiple speakers.
- "Track" and "Tags" are both classification dimensions but function differently: Track = primary single-select colored category (session track/theme), Tags = flexible multi-value flat labels.

---

### image8.png — "Add Abstract" side panel (create form), Details tab

**1. Screen**
The create-new-abstract slide-over panel, opened via the "+ Add Abstract" button, background Abstracts table dimmed behind it. Shows the "Details" sub-tab of the form.

**2. Layout structure**
- Right-side slide-over panel (~45% viewport width), white background, full height.
- Panel header: **"Add Abstract"** (bold title, left), **"×"** close (top right).
- Sub-tabs directly under header: **Details** (active, icon = document, bordered/highlighted pill) and **Participants** (icon = two people, plain tab) — two-step/two-section form.
- Below tabs: a vertical single-column form with labeled fields, generous spacing between each.
- Footer (sticky, bottom-right): **"Cancel"** (outlined) and **"Create Abstract"** (solid blue, initially appears in a lighter/disabled-looking blue — possibly disabled until required fields are filled).

**3. Components (exact text, in order)**
- **Title** * (required, red asterisk) — text input, placeholder "Enter abstract title…", char counter "0/255"
- **Status** — dropdown, pre-filled with **"Pending"** pill (yellow) as the default value, chevron to open
- **Description** — larger text area, placeholder "Enter description…" (italic gray)
- **Starts At** — date/time picker, placeholder "Select start date & time…"
- **Ends At** — date/time picker, placeholder "Select end date & time…"
- **Capacity** — number input, placeholder "Number of attendees"
- **CEU Credits** — text/number input, placeholder "Enter CEU credits"
- **Client ID** — text input, placeholder "Enter client ID" (this is presumably what populates the "Client Session ID" column)
- **Format** — dropdown, placeholder "Select format…"
- (form continues below the fold, not captured — likely Track, Tags, Location, Language, Level, etc., matching the field catalog from image14)

**4. Visual style**
- Consistent input styling with image40's profile form: white inputs, light-gray 1px border, ~8px radius, label-above-input, placeholder in muted gray.
- Required-field asterisk in red next to "Title" label — the only required field visible.
- Status field defaults to "Pending" pill — confirms "Pending" is the system default status for any newly created/submitted abstract.
- "Create Abstract" button appears visually muted/lighter blue compared to the fully-saturated blue used elsewhere (e.g., "+ Add Abstract" trigger button) — likely a disabled state pending required-field completion (Title is empty at this point), a good micro-interaction to replicate (disable primary CTA until required fields pass validation).
- Panel uses a two-tab (Details/Participants) structure for creation, meaning speaker/participant assignment is deliberately separated from the core session metadata — worth mirroring as a two-step create flow (session details first, then add speakers/participants) rather than one giant form.

**5. Interactions implied**
- Organizers can manually create abstracts directly (not just via the public CFP form) — useful for invited/direct-ask speakers, matching the "Featured Keynote" concept seen in the portal.
- Participants tab (not shown in detail here) presumably lets the organizer attach one or more Speakers + a Session Submitter at creation time, matching the multi-speaker chips seen in image10.
- Date pickers for Starts At / Ends At suggest abstracts, once accepted, effectively become schedulable sessions with real timeslots directly from this same record (abstract and session appear to be the same underlying entity/table, just filtered by status — reinforced by the sidebar nesting "Abstracts" and "Sessions" both under "SUBMISSIONS", and by the "Client Session ID" field implying an abstract can be linked/synced to an external session record).

**6. Domain language**
- Confirms "Client ID"/"Client Session ID" as an external-system reference field (e.g., syncing with an external agenda/session tool) — a passthrough ID, not user-facing description.
- Confirms default status on creation = **Pending**.

---

## Synthesis — End-to-end Abstract/CFP Review Workflow

Putting all seven images together, the domain model and workflow for our clone should be:

**Entities**
- **Abstract / Submission** (single entity, referred to as "Abstract" in the organizer UI and "Submission" in the speaker portal) with fields: Title (required), Status, Source, Description (rich text), Starts At / Ends At, Capacity, CEU Credits, Client ID / Client Session ID, Format, Language, Level, Track (single-select, colored), Tags (multi-select, flat/gray), Location, Files, Chairperson, Exhibitors, Session Submitter (the submitting user), Speaker(s) (one-to-many), Notified (timestamp/flag), Ratings (per Evaluation Plan), Created At.
- **Speaker** (portal user) — has Profile (Biography rich text w/ 5,000 char cap, Salutation, First/Last Name, Honorific, Pronouns, Gender) and Links (LinkedIn, X/Twitter, Facebook, Website).
- **Evaluation Plan** — a named scoring rubric; ratings roll up into a column like "Ratings: My Evaluation Plan," implying multiple named plans can coexist and a reviewer's own plan is called out specifically ("My…").
- **Task** — assignable action items scoped either to a submission ("Submission Tasks") or generally to a speaker ("My Tasks"), visible in the speaker portal.

**Status pipeline (exact domain wording to match verbatim)**
`Drafts → Pending → {Accept Queue → Accepted} | {Decline Queue → Declined} | Withdrawn`
- **Drafts**: speaker started but hasn't finalized submission (separate bucket from the main pipeline).
- **Pending**: submitted, awaiting organizer review (system default on creation).
- **Accept Queue** / **Decline Queue**: organizer has made a provisional decision but not yet finalized/notified — both render in the "amber" family visually except Accept Queue is green in the status-picker (Accepted and Accept Queue both green; Pending and Decline Queue both amber; Declined red). Re-verify exact pill colors against image13 if pixel-perfect fidelity matters: Accepted/Accept Queue = green family, Pending/Decline Queue = amber family, Declined = red, Withdrawn = presumably gray/neutral (not shown, likely speaker-triggered only).
- **Accepted** / **Declined**: terminal, final decision states, and drive the "Notified" flag/column (likely a bulk "send decisions" action promotes Queue → final state and stamps Notified).
- **Withdrawn**: speaker-side self-service action (pull my own submission), not offered in the organizer's manual status-picker.

Speaker portal mirrors organizer statuses 1:1 with no relabeling ("Accepted"/"Pending" shown identically on both sides) — we should NOT invent friendlier speaker-facing copy; use the exact same status strings everywhere.

**Review UX pattern to replicate**
1. Organizer lands on Abstracts, a status-tabbed, searchable, sortable, filterable, fully column-configurable data table (single generic "Preferences" modal drives Columns/Sort/Filter/Drafts via tabs).
2. Inline status change via click-to-open pill-picker directly in the table cell (not a separate page), staged selection + explicit Save, with a Clear option.
3. Two-phase decisioning: stage into Accept Queue/Decline Queue, then a distinct bulk step finalizes to Accepted/Declined and marks Notified — build this as an explicit "finalize/send decisions" bulk action, not just direct status edits.
4. Bulk table-level actions live under a single "Options" menu: Import Sessions, Export CSV/XLSX, Download files bundle.
5. Manual "+ Add Abstract" creation flow is a 2-tab slide-over (Details, then Participants) — separates core metadata entry from speaker/submitter assignment; Status defaults to Pending; Title is the only required field; primary CTA disables until valid.
6. Column catalog is large (25 selectable of 39+ available fields) and grouped (e.g., "SESSION DETAILS" group), with a Fields vs. Reporting Fields split, drag-to-reorder selected columns, per-group Show All/Hide All, and Reset to Default — build column management as one reusable component.
7. Speaker-side: after submitting, speakers see their own submissions list with the same status pills, a Profile self-service editor (bio, links, personal info), and a Tasks inbox grouped by "Submission Tasks" vs "My Tasks" with Open All/Collapse All per group.
8. Organizers can impersonate/preview as a speaker via "Back to Admin Mode" style role switching — build a clearly-labeled admin-preview-as-speaker mode with an obvious way back.

**Visual system to carry through our clone**
- Primary accent: indigo/royal blue (~#4550DD family) for primary buttons, active tab underlines/borders, active sidebar item highlight, links.
- Status pill semantics: green = accept-path, amber = pending/decline-queue (limbo), red = declined (final negative only) — reuse consistently for any status chip in the product, not just abstracts.
- Cards/panels: white or very-light-gray/blue background, ~8-16px rounded corners, thin light-gray borders, generous internal padding — one shared "Card" primitive for dashboard tiles, list-group panels, and modals alike.
- Data tables: checkbox+edit-pencil leading column, "(i)" info icon next to every header label (inline field-description affordance), muted em-dash "–" for empty cells, numbered pagination + "Show: N" page-size selector, sticky/scrollable-right for wide column sets.
- Forms: label-above-input, consistent input height/border/radius, required fields marked with a red asterisk, disabled-until-valid primary submit buttons, rich text fields include a compact toolbar + character counter.
