# Create a session

*Source: https://learn.sessionboard.com/videos/video-create-a-session — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Walkthrough

#### [00:00 - 00:07]
* **NARRATION:** "Welcome to Sessionboard. In this video, we'll guide you through the step-by-step process of creating a new session for your event."
* **SCREEN:** *(Title Screen: Dark blue gradient with centered white logo `SESSIONBOARD` and title `CREATE A SESSION`.)*

---

#### [00:08 - 00:12]
* **NARRATION:** "To get started, navigate to the Sessions module on the left of your screen."
* **SCREEN:** *(Module: `Sessions` -> `Submissions`. Top Bar: Event name `Sessionboard Conference`, date `Jan 1 5:00 PM - Jan 2 6:00 PM (GMT-7)`, Search input `Search...`, `View Portal` button, user avatar `MC`. Left Navigation Sidebar: `< Back to organization`, `Sponsors`, `Sessions` (expanded: `Submissions`, `Forms`, `Evaluation`, `Agenda`), `Embeds`, `Settings`, `Applications`, `Portals`, `Library`. Page Header: `Submissions`, subtitle `Manage session submissions and reviews`, `... Options` menu button, `+ Add Session` blue button. Filter Bar Tabs: `All Submissions 10`, `Accepted 8`, `Accept Queue 0`, `Pending 1`, `Decline Queue 1`, `Declined 0`, `Withdrawn 0`, `Draft >`. Controls: `Search submissions...`, `View: Forum 1`, `Columns`, `Sort`, `Filter`. Table Headers: Checkbox, Edit icon, `Session ID`, `Status`, `Title`, `Description`, `Tags`, `Location`.)*

---

#### [00:13 - 00:17]
* **NARRATION:** "Click the blue Add Session button at the top right hand corner of the screen."
* **SCREEN:** *(Page: `Sessions` -> `Submissions`. Cursor hovers and clicks `+ Add Session` button at top right.)*

---

#### [00:18 - 00:30]
* **NARRATION:** "In the Details page, you'll add the basic information for your session. Within the pop-up window, fill in all of the fields with the confirmed session information. Session details and session participants."
* **SCREEN:** *(Drawer/Modal: Right-side overlay `Add Session` opens. Tabs: `Details` (active), `Participants`. Form fields: `Title *` (input, placeholder `Enter session title...`, char counter `0/255`), `Status` dropdown showing options with colored pills: `Pending` (yellow), `Accepted` (green fill), `Accept Queue` (green border), `Decline Queue` (yellow/red), `Declined` (red). Date/Time fields: `Starts At`, `Ends At`.)*

---

#### [00:31 - 00:43]
* **NARRATION:** "Scroll down to add details such as session level, track, tags, location, among others. Note that sponsors and exhibitors can only be assigned to a session if you have access to those modules."
* **SCREEN:** *(Drawer/Modal: `Add Session` -> `Details` tab scrolled down. Form fields: `Level` (`Select level...`), `Track` (`Select track...`), `Tags` (`Add tags...`), `Location` / `Type` (`Select location type...`), `Capacity` (`Enter capacity...`), `Upload your on-demand recording...` (`Choose file...`), `Are you a member?` (`Select if you a member?...`), `Member ID` (0/255), `Track Lead Status` (`Select track lead status...`).)*

---

#### [00:44 - 00:49]
* **NARRATION:** "Once all the fields are completed, click the blue Add Session button to finalize the session."
* **SCREEN:** *(Drawer/Modal: Footer actions showing `Cancel` text button and `Add Session` primary blue button. Cursor clicks `Add Session`.)*

---

#### [00:50 - 01:05]
* **NARRATION:** "Your session is now saved and will appear in the session list. You can edit it at any time by clicking the pencil icon to the left of the session record. If you have any questions, feel free to reach out to our support team. Thank you for choosing Sessionboard."
* **SCREEN:** *(Page: `Sessions` -> `Submissions`. Drawer closes, table updates showing newly created session row. Cursor highlights the pencil `Edit` icon next to the session record in the first column.)*

---

#### [01:06 - 01:11]
* **NARRATION:** *(None / Music)*
* **SCREEN:** *(Outro Title Screen: Animated `SESSIONBOARD` logo on blue geometry.)*

---

### A. Screen Inventory

1. **Submissions List View (`Sessions` -> `Submissions`)**
   * **Purpose:** Central table for viewing, filtering, and managing session proposals and confirmed sessions.
   * **Components:** Left navigation sidebar, top navigation header (event switcher, global search, portal link, user profile), sub-header with metric/status tabs (`All Submissions`, `Accepted`, `Pending`, etc.), toolbar (`Search`, `View`, `Columns`, `Sort`, `Filter`, `Options`, `+ Add Session`), data table with row edit actions.

2. **Add / Edit Session Modal Drawer (`Add Session`)**
   * **Purpose:** Multi-tab drawer panel to enter or update session metadata and participant assignments.
   * **Components:** Top header title with close (`X`) icon, tab switcher (`Details`, `Participants`), form inputs (`Title`, `Status`, `Starts At`, `Ends At`, `Level`, `Track`, `Tags`, `Location`, `Capacity`, file uploader, membership toggles), sticky bottom action bar (`Cancel`, `Add Session`).

---

### B. Feature / Capability List

* **Session Creation & Editing:** Slide-out drawer workflow with real-time field validation and character counters (e.g., 255-char limit).
* **Status Lifecycle Management:** Custom color-coded session statuses (`Pending`, `Accepted`, `Accept Queue`, `Decline Queue`, `Declined`).
* **Categorization & Metadata:** Multi-attribute tagging including Level, Track, Tags, Location Type, and Capacity limits.
* **Media & File Attachments:** Direct file upload capability for on-demand session recordings.
* **Cross-Module Integrations:** Conditional assignment of Sponsors and Exhibitors based on active plan/module permissions.
* **Participant & Member Tracking:** Member classification dropdowns, Member ID inputs, and Track Lead tracking.
* **Table & View Controls:** Filter tabs by status counts, view saved layouts (`View: Forum 1`), column customization, sorting, and inline pencil edit triggers.

---

### C. Data Model Signals

* **Session Entity:**
  * `id` (string/UUID, e.g., `SESS-415`)
  * `title` (string, max 255 chars)
  * `status` (enum: `Pending`, `Accepted`, `Accept Queue`, `Decline Queue`, `Declined`, `Withdrawn`, `Draft`)
  * `description` (text)
  * `starts_at` / `ends_at` (datetime)
  * `level` (enum/string)
  * `track` (foreign key / string)
  * `tags` (array of strings / badges)
  * `location_type` & `location` (string/relation)
  * `capacity` (integer)
  * `ondemand_file_url` (file/string)
  * `is_member` (boolean/enum)
  * `member_id` (string, max 255 chars)
  * `track_lead_status` (enum/string)
  * `sponsors` / `exhibitors` (relations)

---

### D. Organizer vs Participant

* **Organizer Side:** Full access to the Sessions module, status transitions, track lead assignments, custom column views, manual session creation (`+ Add Session`), and editing via drawer.
* **Participant Side:** Read-only submission views or public schedule layouts (accessed via `View Portal`).

---

### E. UX/UI Craft Notes

* **Layout Geometry:** Left collapsible sidebar navigation, right-aligned slide-over drawer modal overlaying main page content.
* **Color Palette & Badges:** Distinct pill-shaped status badges:
  * Green solid: `Accepted`
  * Green outline: `Accept Queue`
  * Yellow/Orange solid: `Pending` / `Volunteer`
  * Red/Yellow combo: `Decline Queue`
  * Red solid: `Declined`
* **Form Inputs:** Vertical stacked field layouts with bold labels, soft gray borders, rounded corners, explicit placeholder guidance, and subtle text character counters (`0/255`).
* **Button Hierarchy:** Primary action in solid bright blue (`+ Add Session`), secondary controls in white outline/ghost style (`Cancel`, `Columns`, `Filter`).