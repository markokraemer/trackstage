# Files

*Source: https://learn.sessionboard.com/videos/video-files — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Log & UI Breakdown

**[00:00 - 00:11] Title Screen**
* **Narration:** Welcome to Sessionboard. In this quick video, we'll walk you through how to upload and assign files to a portal such as PowerPoint templates, social media graphics, and much more.
* **Screen:** Title card displaying "SESSIONBOARD - FILES".

**[00:11 - 00:20] Files Management Overview**
* **Narration:** To begin, navigate to the Portals module and select Files. To add a new file, select the button Add File.
* **Screen:** *(Portals -> Files)*
  * **Top Nav:** Event dropdown `Sessionboard Conference`, Date `Jan 1, 5:00 PM - Jan 6, 2:00 PM (GMT-7)`, `Search...`, `View Portal`, notifications bell, user avatar `MC`.
  * **Sidebar:** `< Back to organization`, `APPLICATIONS`: `Portals` (expanded: `Portals`, `Forms`, `File Requests`, `Tasks`, `Resources`, `Files`), `In Library`, `Reports`, `Studio`, `History`, `Event Team`, `Settings`.
  * **Main Content:** Page title `Files`, subtitle `Manage files that can be shared to your portals`.
  * **Actions:** Search input `Search files...`, primary button `+ Add File`.
  * **File Items:** 
    * `Agenda` | Badge: `File` | `application/pdf - 696.9 kB`
    * `Hotel Map` | Badge: `File` | `application/pdf - 5.8 MB` | Badge: `new`

**[00:20 - 00:34] Adding a New File**
* **Narration:** In the pop-up, upload a file from your device or use external URL to add a link. Add a title and description for the file that your event contacts will see in the portal. Click the Add File button once complete.
* **Screen:** *(Portals -> Files -> + Add File)*
  * **Modal:** `Add File` (`Add a file or URL for your portal`).
  * **Fields:** 
    * `Type`: Radio `Upload File` (default) | `External URL`.
    * `File`: Upload dropzone button `Upload file`.
    * `Title`: Text input (placeholder `e.g. Speaker Handbook`).
    * `Description`: Textarea (placeholder `Optional description...`).
  * **Footer Buttons:** `Cancel`, `Add File`.

**[00:34 - 00:50] Navigating to Portals**
* **Narration:** After adding your file, be sure to assign it to the appropriate portal so your contacts can view it. To do this, click Portals at the top of the page to return to the portal home. Select the ellipses to the right of the portal the task should be assigned to.
* **Screen:** *(Portals -> Portals)*
  * **Header/Tabs:** `Contact Portals (5)`, `Group Portals (1)`, button `+ Create Portal`.
  * **List Row:** Portal `Speakers + GDPR opt-in Complete`.
  * **Metadata:** Criteria text string, badges `Filters 3`, `Assigned to 1`, `Created by Valentin Dieguez on Sunday, December 21, 2025`.
  * **Row Action:** `...` (Ellipsis button).

**[00:50 - 00:54] Editing Portal Tasks**
* **Narration:** Then select Edit Tasks from the action list.
* **Screen:** *(Portals -> Portals -> Ellipsis Menu)*
  * **Dropdown Menu Items:** `Copy Link`, `Edit Criteria`, `Edit Tasks`, `Edit Settings`, `Edit Appearance`, `Duplicate`, `Delete` (red).

**[00:54 - 01:06] Assigning Files to Portal**
* **Narration:** Under the Assign Items tab, navigate to the Files widget. Select the button Add to open a pop-up module. This will show any files you have created to select and assign to your portal.
* **Screen:** *(Portals -> [Portal Name] -> Assign Items)*
  * **Wizard Navigation:** `1 Select Participants` -> `2 Assign Items` (active) -> `3 Configuration` -> `4 Appearance` -> `5 Manage Fields`.
  * **Widgets:** `File Requests (2)`, `Resources (1)`, `Files` (expanded card).
  * **Files Widget Actions:** Buttons `+ Add`, `Manage`, link `Learn more`.
  * **Empty State:** `No items assigned.`

**[01:06 - 01:13] Selecting Files Modal**
* **Narration:** Within the actions column, click next to the file you want to assign to the portal and select Add Selected.
* **Screen:** *(Portals -> [Portal Name] -> Assign Items -> + Add)*
  * **Modal:** `Add Files`.
  * **Components:** Search input `Search...`, list options with checkboxes (`Agenda`, `Hotel Map`).
  * **Footer Buttons:** `Cancel`, `Add Selected`.

**[01:13 - 01:23] Participant Portal View**
* **Narration:** You have successfully added and assigned a file to your event portal. If you have any questions, feel free to reach out to our support team. Thank you for choosing Sessionboard.
* **Screen:** *(Participant Portal Interface)*
  * **Sections:** `Session Tasks` (`No session tasks found`), `My Tasks` (`No tasks found`), `Files` (blue header banner).
  * **Card:** `PPT` orange icon badge, label `Speaker PPT Template`.

**[01:23 - 01:30] End Card**
* **Narration:** [Music]
* **Screen:** Sessionboard logo animation.

---

### A. Screen Inventory

1. **Files List (`Portals -> Files`)**
   * **Purpose:** Central repository for event files and downloadables.
   * **Components:** Header string `Files`, search `Search files...`, `+ Add File` button, file card items showing mime-type, file size, title, and badges (`File`, `new`).

2. **Add File Modal (`Portals -> Files -> + Add File`)**
   * **Purpose:** Upload local files or link external URLs.
   * **Components:** Radio toggle (`Upload File`/`External URL`), file upload dropzone, text input `Title`, textarea `Description`, `Cancel` and `Add File` buttons.

3. **Portals Home (`Portals -> Portals`)**
   * **Purpose:** Manage speaker/participant access portals.
   * **Components:** Tabs (`Contact Portals`, `Group Portals`), search bar, portal summary cards, filter badges, row action dropdown menu (`Edit Tasks`, etc.).

4. **Portal Setup Wizard: Assign Items (`Portals -> [Portal] -> Step 2`)**
   * **Purpose:** Attach content widgets (Files, Resources, Tasks) to a specific portal.
   * **Components:** Step indicator bar, widget containers (`Files`), action bar (`+ Add`, `Manage`, `Learn more`), step navigation buttons (`Back`, `Next`).

5. **Add Files Modal (`Assign Items -> Files Widget -> + Add`)**
   * **Purpose:** Select files from the library to attach to the portal.
   * **Components:** Search input, selection list with checkboxes, `Cancel` and `Add Selected` buttons.

6. **Participant Portal View**
   * **Purpose:** Public/speaker-facing dashboard to view tasks and download assigned files.
   * **Components:** Section cards (`Session Tasks`, `My Tasks`, `Files`), file preview items with file-type badges.

---

### B. Feature / Capability List

* **File Upload & Linking:**
  * Support for local file uploads and external web URLs.
  * Custom title and optional description for participant display.
  * Support for PDF, PPT, and general downloadable assets.
* **Portal Management & Assignment:**
  * Multi-step wizard layout for configuring portals.
  * Conditional target criteria for portal participants.
  * Capability to map shared files to targeted participant portals.
* **Participant Experience:**
  * Dedicated "Files" card section on the portal interface.
  * Direct file download links with file-type iconography.

---

### C. Data Model Signals

* **File/Resource:** `id`, `type` (`Upload File` | `External URL`), `file_path`/`url`, `title`, `description`, `file_format`, `file_size`, `created_at`.
* **Portal:** `id`, `name`, `type` (`Contact` | `Group`), `target_criteria`, `assigned_files[]`, `assigned_tasks[]`, `assigned_resources[]`.
* **Participant/Contact:** Assigned portal mapping based on filter criteria.

---

### D. Organizer vs Participant Capabilities

* **Organizer (Backend):**
  * Manage global file repository.
  * Configure access portals and target criteria.
  * Assign specific files to specific portals via the wizard.
* **Participant (Frontend Portal):**
  * Read-only access to view and download assigned files.
  * Complete assigned tasks or submit file requests.

---

### E. UX/UI Craft Notes

* **Layout Geometry:** Left sidebar with sub-navigation collapsible sections; top navigation bar for global event scope.
* **Color Hierarchy:** Primary dark blue (`#1A2B4C` style) for main buttons and active tabs; muted blue banners for participant sections; orange badges for PPT asset icons.
* **Modals & Drawers:** Centered modal dialogs with dark overlay backdrops and header close buttons.
* **Form Inputs:** Labels rendered above input fields; subtle placeholders providing contextual examples (`e.g. Speaker Handbook`).