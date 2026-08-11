# Embeds

*Source: https://learn.sessionboard.com/videos/video-embeds — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Video Walkthrough

#### [00:00] Title Screen
**NARRATION:**
> Welcome to Sessionboard. In this video, we'll walk you through how to create embeds to showcase your event agenda and speakers on your event website.

*(SCREEN: Title graphic on blue gradient background displaying "SESSIONBOARD" logo and "EMBEDS" title text.)*

---

#### [00:08] Embeds Dashboard & Add Action
**NARRATION:**
> On the Sessions module, select the Embeds tab and click Add Embed to create a new embed for your event. You can create multiple embeds as needed, each with filters to display specific sessions and/or speakers. For example, you may want to create a separate embed per track to showcase your schedule across different pages of your website.

*(SCREEN: Nav path: `Sessions` -> `Embeds`. Left Sidebar: `Back to organization`, `Sessions` [selected] -> `Submissions`, `Forms`, `Evaluation`, `Agenda`, `Embeds` [selected], `Settings`; `Applications`, `Portals`, `Library`, `Reports`, `Studio`. Top Nav: `Sessionboard Conference`, Date `Jan 1 5:00 PM - Jan 2 6:00 PM (GMT-7)`, `Search...`, `View Portal`, User avatar `MC`. Header: `Embeds`, subtitle "Export a feed of your agenda, sessions, or speakers to place in your app or website.", Search input `Search`, `+ Add Embed` button [blue primary]. Content: Accordions `Styled HTML` [4 items: cards `Agenda`, `Full Agenda`, `New Embed`, `New Embed` with badge `Enabled` in gray], `JSON` [1 item: card `New Embed` with badge `Enabled`]. Click `+ Add Embed` button.)*

---

#### [00:30] Add Embed Modal Step 1: Select Type
**NARRATION:**
> In the pop-up window, enter an internal name for your embed and choose the desired format type.

*(SCREEN: Modal `Add Embed`. Stepper header: `1 Select Type` [active], `2 Style Options`, `3 Filters`, `4 Field Options`, `5 Get Code`. Header: "Configure your embedded content settings." Form fields: `Name *` text field ["New Embed"], `Enabled` toggle switch [ON, black]. `Format *` radio options: `Styled HTML` [selected radio; description: "Configure settings for styled HTML feeds including Agenda, Session List, Schedule Itinerary, Speaker List, and Speaker Gallery..."], `Embed HTML` ["Create a feed that you can style with CSS."], `JSON Feed` ["A format used for organizing and sharing information..."]. Footer buttons: `Cancel` [ghost], `Next: Style Options` [blue primary]. Click `Next: Style Options`.)*

---

#### [00:36] Add Embed Modal Step 2: Style Options
**NARRATION:**
> Depending on the selected embed format, page two allows you to customize styling options such as light or dark theme, primary color, and your preferred date and time format for displaying session details. You can also enhance the embed with additional features, such as allowing attendees to filter sessions by format or track, and enabling calendar integration so attendees can add sessions directly to their personal calendars.

*(SCREEN: Modal `Add Embed` -> Step `2 Style Options`. Left Column: `Website Color Theme` dropdown ["Light"], `Primary Color` hex picker [`#1b6ec2`], `Date/Time Format` dropdown ["English (US): Fri, June 2, 8:11 AM"], `Hex Color` text field [`#1b6ec2`], `Extra CSS Code` textarea [placeholder `.someClass { some-cs-property: value; }`], warning banner "Sessionboard doesn't validate or provide custom code support...". Right Column [`SESSION AND SPEAKER`]: Checkboxes: `Click session or speaker to open pop-out view` [checked], `Display schedule in browser timezone` [checked], `Show add to calendar button` [unchecked], `Search session/speaker by name` [checked], `Order session speakers alphabetically` [unchecked]. `SHOW FILTERS` sub-section: Checkboxes: `Filter sessions by format` [checked], `Filter sessions by sponsor` [unchecked], `Filter sessions by level` [checked], `Filter sessions by location` [checked]. Footer buttons: `Back`, `Next: Filters`. Click `Next: Filters`.)*

---

#### [01:02] Add Embed Modal Step 3: Filters
**NARRATION:**
> Next, apply a filter to your embed to control which sessions and speakers are displayed. For example, you can create an embed filtered by the format "Keynote" to showcase all keynote speakers on the main page of your website.

*(SCREEN: Modal `Add Embed` -> Step `3 Filters`. Subtitle: "Set a filter to only include relevant sessions and related contacts." Filter row builder: Field dropdown [`Ends At`], Operator dropdown [`is after`], Date picker input [`04-04-26`], remove icon `X`. Button: `+ Add Filter`. Green result alert: check icon + "2 sessions and 68 speakers match this filter". Note: "Note: Some embed styles will not show sessions if they do not have a start and end time defined". Footer buttons: `Back`, `Next: Field Options`. Click `Next: Field Options`.)*

---

#### [01:16] Add Embed Modal Step 4: Field Options
**NARRATION:**
> Lastly, choose which fields you'd like to include in your embed. The agenda column determines which fields are shown when clicking on a session card in the agenda embed. The speaker column controls the fields displayed on each speaker card. And the session column defines the fields shown when clicking on a session card in the schedule itinerary or session list embed.

*(SCREEN: Modal `Add Embed` -> Step `4 Field Options`. Subtitle: "Select which fields to display in each section of the embed." Search input: `Filter fields...`. Three selection columns:
- `Agenda` [Select All checkbox]: `Title` [checked], `Starts At` [checked], `Ends At` [checked], `Speakers` [checked], `Description` [checked], `Track` [unchecked], `Format` [unchecked], `Location` [unchecked].
- `Speaker` [Select All checkbox]: `Salutation` [unchecked], `Full Name` [checked], `Honorific` [unchecked], `Email` [unchecked], `Job Title` [unchecked], `Company Name` [unchecked], `Headshot` [unchecked], `Biography` [unchecked].
- `Session` [Select All checkbox]: `Title` [checked], `Starts At` [checked], `Ends At` [checked], `Description` [checked], `Speakers` [checked], `Location` [unchecked], `Track` [unchecked], `Level` [unchecked].
Footer buttons: `Back`, `Save` [blue primary]. Click `Save`.)*

---

#### [01:38] Add Embed Modal Step 5: Get Code
**NARRATION:**
> Once you've finished configuring your embed, preview it to ensure everything looks as expected before adding the code into your website builder.

*(SCREEN: Modal `Add Embed` -> Step `5 Get Code`. Subtitle: "Copy and paste one code into your webpage. Do not use multiple codes on the same webpage." Embed cards:
- `Schedule Itinerary`: Code snippet block `<script src="https://api.sessionboard.com/sessionboard-schedule-embed.js"></script><sessionboard-embed embed-id="..." widget-type="schedule"></sessionboard-embed>`. Buttons: `Copy`, `Preview`.
- `Speaker Gallery`: Code snippet block `<script src="https://api.sessionboard.com/sessionboard-speaker-gallery-embed.js"></script><sessionboard-embed embed-id="..." widget-type="speaker-gallery"></sessionboard-embed>`. Buttons: `Copy`, `Preview`.
Footer buttons: `Back`, `Done` [blue primary]. Click `Done`.)*

---

#### [01:46] Embed List & Cache Refresh
**NARRATION:**
> Embeds automatically update every 60 minutes with any changes made to sessions and speakers in Sessionboard. However, if you'd like to push an immediate update, you can select "Refresh Cache" from the three dots column.

*(SCREEN: Nav path: `Sessions` -> `Embeds`. Accordion card `New Embed` expanded menu click `...` [overflow menu]. Menu options: `Edit`, `Get Code`, `Refresh Cache` [highlighted with orange outline box], `Delete` [red icon/text].)*

---

#### [02:01] Embedded Itinerary Widget Preview
**NARRATION:**
> You're all set to seamlessly showcase your sessions and speakers on your website. If you have any questions, don't hesitate to reach out to our support team. Thank you for choosing Sessionboard.

*(SCREEN: Published embedded web component rendering live on a webpage: "2025 HINOMA Research Annual Conference". Header text: `Itinerary`. Controls: Search bar `Search session by title`, Dropdowns: `Level`, `Track`, `Format`, `Location`, `Tags`, `Language`. Day tabs: `Thursday, December 14`, `Friday, December 15`. Time block header: `09:00 AM`. Session Card: Category pill `Leadership`, Title link `GradFAIR: A Career Fair for Graduate Students and Postdocs`, Time/Room `09:00 AM - 10:00 AM` | `Room 307`. Speaker Grid cards: Headshot photos + Name + Title + Organization [e.g., "Aisha Mohammed - Founder, Girls Who Code", "Ryan Parker - Head of Product Design at Innovate", "Devendra Prakash - Graduate Researcher, USF"]. Footer meta tags: `LANGUAGE: English`, `LOCATION: Room 307`, `LEVEL: Intermediate`, `TAGS: CPOI Credit Eligible`, `TRACK: Leadership`, `FORMAT: Roundtable`.)*

---

#### [02:13] Outro
*(SCREEN: Animated Sessionboard logo card overlay on blue geometric slash backdrop.)*

---

### A. Screen Inventory

1. **Embeds List (`Sessions` -> `Embeds`)**
   - **Purpose:** Central management list of all generated session, agenda, and speaker embeds.
   - **Components:** Left navigation bar, page title `Embeds`, page subtitle, search input `Search`, primary button `+ Add Embed`, category accordions (`Styled HTML [count]`, `JSON [count]`), embed cards with Title, `Enabled` status badge, and `...` menu actions (`Edit`, `Get Code`, `Refresh Cache`, `Delete`).

2. **Add Embed Modal (`Add Embed`)**
   - **Purpose:** 5-step wizard to create and configure custom website embeds.
   - **Step 1: Select Type:** Stepper navigation, `Name *` input, `Enabled` toggle, format radio buttons (`Styled HTML`, `Embed HTML`, `JSON Feed`), `Cancel`, `Next: Style Options`.
   - **Step 2: Style Options:** Theme selector (`Light`/`Dark`), Hex color pickers, Date/Time format dropdown, Custom CSS textarea, toggles/checkboxes for session pop-outs, timezone matching, calendar buttons, search bars, speaker sorting, and public filter chips (`Format`, `Sponsor`, `Level`, `Location`), `Back`, `Next: Filters`.
   - **Step 3: Filters:** Rule builder (Field, Operator, Value), `+ Add Filter` button, live count matching banner (`2 sessions and 68 speakers match this filter`), `Back`, `Next: Field Options`.
   - **Step 4: Field Options:** Field selection search box `Filter fields...`, 3 field visibility columns (`Agenda`, `Speaker`, `Session`) with individual checkboxes and `Select All` controls, `Back`, `Save`.
   - **Step 5: Get Code:** Script code blocks for individual widgets (`Schedule Itinerary`, `Speaker Gallery`), action buttons (`Copy`, `Preview`), `Back`, `Done`.

3. **Public Embedded Widget (`Schedule Itinerary / Speaker Gallery`)**
   - **Purpose:** Publicly rendered web component for event attendees.
   - **Components:** Title, date tabs, quick search input, dropdown filter bar (`Level`, `Track`, `Format`, `Location`, `Tags`, `Language`), timeline list with session cards, speaker avatar grids, room locations, add-to-calendar triggers, and detailed taxonomy tags.

---

### B. Feature / Capability List

1. **Multi-Embed Generation:** Create independent embeds with custom names, formats, and rules.
2. **Format Types:** Support for `Styled HTML` (pre-built widgets), `Embed HTML` (raw HTML with custom CSS), and `JSON Feed`.
3. **Styling & Theming:** Custom light/dark themes, primary brand hex color override, date/time string format localization, custom CSS injection box.
4. **Interactive Controls:** Toggleable pop-out detail view modal, attendee local browser timezone conversion, "Add to Calendar" export buttons, live text search, alphabetical speaker sorting.
5. **Attendee Filters:** Expose public filter menus on widgets by Format, Sponsor, Level, and Location.
6. **Data Rule Filtering:** Server-side rule builder filtering sessions/speakers by date (`Ends At`, `is after`, etc.), track, format, and other fields before embedding.
7. **Field Level Visibility Granularity:** Choose explicit fields displayed across three distinct contexts: Agenda card, Speaker card, and Session detail modal.
8. **Cache Management:** Automatic background refresh every 60 minutes with manual instant override via `Refresh Cache`.
9. **Embed Code Export:** One-click script snippet generation (`<script>` loader + `<sessionboard-embed>` custom element) with built-in instant preview modal.

---

### C. Data Model Signals

* **Embed Entity:** `id`, `name`, `enabled` (boolean), `format_type` (`STYLED_HTML`, `EMBED_HTML`, `JSON`), `theme` (`LIGHT`, `DARK`), `primary_color_hex`, `date_time_format`, `custom_css`, `enable_popout` (boolean), `use_browser_timezone` (boolean), `show_add_to_calendar` (boolean), `enable_search` (boolean), `sort_speakers_alphabetically` (boolean), `visible_filters` (array), `filter_rules` (array of field-operator-value tuples), `visible_fields` (map of `agenda`, `speaker`, `session` arrays), `cache_updated_at`.
* **Session Entity:** `title`, `starts_at`, `ends_at`, `description`, `location`, `track`, `format`, `level`, `tags`, `language`, `sponsors`.
* **Speaker Entity:** `salutation`, `full_name`, `honorific`, `email`, `job_title`, `company_name`, `headshot_url`, `biography`.

---

### D. Organizer vs Participant

| Feature / Capability | Organizer (Admin) | Participant (Attendee) |
| :--- | :---: | :---: |
| Create/Configure Embed Rules & CSS | **X** | |
| Select Field-Level Visibility | **X** | |
| Copy HTML/JS Embed Snippets | **X** | |
| Trigger Manual Cache Refresh | **X** | |
| Filter Agenda by Track/Format/Level | | **X** |
| Search Sessions/Speakers | | **X** |
| Add Session to Personal Calendar | | **X** |
| View Speaker Bios & Pop-Out Modals | | **X** |

---

### E. UX/UI Craft Notes

* **Layout & Geometry:** Standard Sessionboard admin structure with fixed 240px left sidebar, white content cards on `#F8F9FA` background canvas, and multi-step full-overlay center modals (`max-width: ~800px`).
* **Modal Stepper:** Linear 5-step horizontal indicator at the top of the creation workflow with distinct active/completed step states.
* **Button & Control Hierarchy:** Primary actions use solid `#1B6EC2` blue fill with white bold text; secondary navigation actions use white outlined/ghost buttons. Toggle switches use solid black active indicators.
* **Status Badges:** Small neutral pill badges (`Enabled`) placed next to embed headers.
* **Widget Presentation:** Embedded elements use modern card containers, soft border lines, clear typography contrast, grid headshot layouts for speakers, and bottom tag lists for taxonomy metadata.