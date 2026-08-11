# Tasks

*Source: https://learn.sessionboard.com/videos/video-tasks — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Walkthrough

#### [00:00 - 00:15] Title & Intro
**NARRATION:**
"Welcome to Sessionboard. In this quick video, we'll walk you through how to create and assign a task to a portal. A task is a general action item within the portal that a user or group must complete such as register for the event or attend an upcoming speaker call."

*(Title Screen: Blue gradient background displaying `SESSIONBOARD` logo and bold text `TASKS`)*

---

#### [00:16 - 00:26] Task List Navigation
**NARRATION:**
"To begin, navigate to the Portals module and select Tasks at the top of your page. To create a new task, select the button Add Task."

*(Module: `Portals` -> Tab: `Tasks`)*  
*(Full Page Layout: Main sidebar on left: `Dashboard`, `Contacts`, `Exhibitors`, `Sponsors`, `Sessions`, `Portals` [expanded: `Portals`, `Tasks`, `Forms`, `File Requests`], `Resources (Files)`, `Content`, `Reports`, `Settings`. Main view header: `Tasks` with subtext "Create tasks that can be assigned to your portals". Top right primary button: `+ Add Task` [Blue]. Table headers: `Name`, `Type`, `Method`, `URL Value`, `Actions` [Edit | Delete])*

---

#### [00:27 - 01:37] Creating a Task
**NARRATION:**
"In the pop-up, enter a title that will be visible to your event contacts in the portal, and select the type of task you'd like to create. There are three types of tasks you can create: First, People. Assign tasks to individual contacts, such as requesting them to register for the upcoming event. Second, Groups. Assign tasks to sponsor or exhibitor groups, like sharing a reminder to ship all booth materials to the event venue by a specific date. Third, Sessions. Assign tasks to each session, such as upload presentation files to their session through the portal. Add a brief description that explains to the contact what you would like them to do. To display a unique task description for each user, select Use Field. Make sure the field already exists as a text or text area type and contains data for each contact, group, or session. This will dynamically appear in their portal. If needed, add a link to your task. Similar to the description field, you can use a field as the task link to dynamically display a unique link for each contact. Once complete, click the Add Task button."

*(Modal: `Add Task` triggered via `+ Add Task` button)*  
*(Modal Layout: Title "Add Task", subtext instruction. Form Fields: `Task *` [Text input, 0/100 char count], `Type *` [Radio cards: `People (Contacts, Speakers)`, `Groups (Sponsors, Exhibitors)`, `Sessions (Sessions)`], `Description` [Radio toggles: `Enter Description` with rich text toolbar vs `Use Field` selector], `Task Link` [Radio toggles: `Enter Task URL` vs `Use Field` selector]. Bottom Buttons: `Add Task` [Primary Gold/Orange], `Cancel` [Outline])*

---

#### [01:38 - 01:49] Portal Navigation
**NARRATION:**
"After creating your task, be sure to assign it to the appropriate portal so your contacts can view and complete it. To do this, click Portals at the top of the page to return to the portal home."

*(Module: `Portals` -> Tab: `Portals`)*  
*(Page Layout: Nav tabs: `People Portals (2)`, `Group Portals (1)`. Search bar, button `+ Create Portal`. List of portal cards showing title, description badge, filter criteria, creation metadata, and context menu `...` button)*

---

#### [01:50 - 02:04] Assigning Tasks in Portal Configuration
**NARRATION:**
"Select the ellipses to the right of the portal the task should be assigned to and select Edit Tasks from the action list. Navigate to the Assign Tasks widget and select the button Assign Tasks to assign the task you have just created."

*(Navigation: Portal Card Context Menu `...` -> `Edit Tasks`)*  
*(Screen Layout: Portal Configuration Wizard, Step 2: `Assign Items`. Widget Section: `Assign Tasks` containing sub-text, and buttons `Assign tasks`, `Manage tasks`, `Learn more`)*

---

#### [02:05 - 02:12] Selecting Tasks
**NARRATION:**
"In the pop-up, check the box next to the task you want to assign to your portal, and don't forget to click Save in the bottom right corner."

*(Modal: `1 task assigned` selection overlay)*  
*(Modal Layout: Search input, `SELECT ALL / NONE` text buttons, list of tasks with checkboxes [`Register for the event`, `Submit Session Presentation`, `Upload your Files`]. Footer showing selected count `1 selected` and primary button `Save`)*

---

#### [02:13 - 02:24] Task Settings & Requirement Toggle
**NARRATION:**
"After assigning your task, you can mark it as required by toggling the icon in the Required column. To configure additional settings, such as a due date, click the pencil icon in the Actions column."

*(UI Interaction: `Assign Tasks` table row)*  
*(Table Layout: Columns `Name`, `Alias`, `Due Date`, `Extended Due Date`, `Required` [Toggle switch], `Actions` [Pencil/Edit icon, Delete icon])*

---

#### [02:25 - 02:35] Filtering Session Tasks
**NARRATION:**
"If you're assigning a session task, you can use the Actions pop-up to apply a filter. Only sessions that match the filter criteria will see the task in their portal."

*(Modal: `Edit Session task` triggered by Pencil icon)*  
*(Modal Fields: `Alias` text input, `Due Date` date/time picker, `Required` toggle, `Make Completed Tasks View-Only` toggle, `Assign By Filter` toggle [Active Green] with dynamic rule builder dropdowns [e.g., `Format` `is` `Keynote`] and `+ Add filter` link. Button: `Update`)*

---

#### [02:36 - 02:53] Participant Portal Task Execution & Outro
**NARRATION:**
"You have successfully created and assigned a task to your event portal. If you have any questions, feel free to reach out to our support team. Thank you for choosing Sessionboard."

*(Participant View: Portal Interface)*  
*(Layout: Task tab listing `All (1)`, `My Tasks` section containing card `Register for the event`. Detail Drawer on right: Header `Register for the event`, status tags `OPEN` [Yellow], `Incomplete` [Gray], task description text, button `Open Link`, bottom action buttons `Done`, `Mark as Complete` [Primary Blue])*

---

### A. Screen Inventory

1. **Tasks Management List** (`Portals` -> `Tasks`)
   - *Purpose:* List, manage, create, and delete reusable task templates.
   - *Components:* Title, subtext, button `+ Add Task`, search, table columns (`Name`, `Type`, `Method`, `URL Value`, `Actions`).

2. **Add Task Modal** (`Portals` -> `Tasks` -> `+ Add Task`)
   - *Purpose:* Define task attributes and assignment target types.
   - *Components:* Form inputs (`Task *` title, `Type` radio selector [`People`, `Groups`, `Sessions`], `Description` option tabs [`Enter Description`, `Use Field`] with rich text area or field selector, `Task Link` option tabs [`Enter Task URL`, `Use Field`] with URL input or field selector), buttons `Add Task`, `Cancel`.

3. **Portal Builder - Assign Items** (`Portals` -> `Portals` -> `...` -> `Edit Tasks`)
   - *Purpose:* Configure task attachments and rules for a specific portal.
   - *Components:* Step wizard bar (`1 Select participants`, `2 Assign Items`, `3 Configuration`, `4 Appearance`), section card `Assign Tasks`, buttons `Assign tasks`, `Manage tasks`, `Learn more`, table of assigned tasks with columns (`Name`, `Alias`, `Due Date`, `Extended Due Date`, `Required`, `Actions`).

4. **Task Assignment Selection Overlay**
   - *Purpose:* Bulk select task templates to attach to the portal.
   - *Components:* Header count, search box, `SELECT ALL / NONE` links, checkbox task list, selection summary footer, button `Save`.

5. **Edit Session/Task Rules Modal**
   - *Purpose:* Configure task due dates, completion behaviors, and conditional visibility.
   - *Components:* Inputs (`Alias`, `Due Date` datepicker), toggles (`Required`, `Make Completed Tasks View-Only`, `Assign By Filter`), dynamic filter rule builder (`Field`, `Operator`, `Value`, `+ Add filter`), button `Update`.

6. **Participant Task Portal Drawer**
   - *Purpose:* End-user interface to view, execute, and mark tasks complete.
   - *Components:* Category tabs (`All`, `My Tasks`, `Session Tasks`), task list cards, detail drawer with status badges (`OPEN`, `Incomplete`), action button `Open Link`, footer buttons `Done`, `Mark as Complete`.

---

### B. Feature / Capability List

- **Task Scope Targeting:** Support for 3 distinct entity target scopes: People (individual contacts/speakers), Groups (companies/sponsors/exhibitors), and Sessions.
- **Dynamic Field Substitution:** Ability to source task descriptions and task URLs dynamically from custom profile fields per entity instead of static text.
- **Portal Item Assignment:** Capability to attach task templates to specific participant portals with custom aliases.
- **Task Mandate Toggle:** Setting tasks as required or optional per portal via table toggle.
- **Conditional Visibility Filtering:** Capability to filter task visibility per session based on criteria rules (e.g., Format, Track).
- **Read-Only Post Completion:** Setting `Make Completed Tasks View-Only` to lock inputs after submission.
- **Due Date Management:** Assignment of standard due dates and extended individual due dates per task.
- **Participant Workflow:** Direct external link tracking and user self-completion confirmation (`Mark as Complete`).

---

### C. Data Model Signals

- **Task Entity:**
  - `Title` (string, max 100 chars, required)
  - `Type` (enum: `People`, `Groups`, `Sessions`)
  - `Description Type` (enum: `Static Text`, `Field Mapping`)
  - `Description Text` (rich text string, optional)
  - `Description Field Source` (foreign key / field reference, optional)
  - `Link Type` (enum: `Static URL`, `Field Mapping`)
  - `Link URL` (string/URL, optional)
  - `Link Field Source` (foreign key / field reference, optional)
- **Portal-Task Junction Entity:**
  - `Portal ID` (foreign key)
  - `Task ID` (foreign key)
  - `Alias` (string, optional rename for portal view)
  - `Due Date` (datetime, optional)
  - `Extended Due Date` (datetime, optional)
  - `Is Required` (boolean, default false)
  - `Make Completed View-Only` (boolean, default false)
  - `Filter Rules` (array of filter objects: `field`, `operator`, `value`)
- **Task Submission / Progress:**
  - `Status` (enum: `OPEN`, `IN_PROGRESS`, `COMPLETED`)
  - `Completion State` (enum: `Incomplete`, `Complete`)

---

### D. Organizer vs Participant

| Capability / Feature | Organizer UI | Participant UI |
| :--- | :---: | :---: |
| Task Template Creation & Management | **X** | |
| Mapping Dynamic Fields to Tasks | **X** | |
| Assigning Tasks to Portals | **X** | |
| Setting Due Dates & Conditional Rules | **X** | |
| Toggling Task Requirement Status | **X** | |
| Viewing Portal Task List | | **X** |
| Accessing Task Action Links | | **X** |
| Marking Tasks Complete | | **X** |

---

### E. UX/UI Craft Notes

- **Layout Geometry:** Fixed left sidebar (dark grey icons on light background when collapsed, clear hierarchy). Content container uses padded card-based structure with soft neutral borders.
- **Modal Design:** Centered dialogs with dark grey overlay backdrop. Top right clear `X` close button, header banner with contextual icon, and full-width footer button placement.
- **Color Palette & Hierarchy:**
  - Primary Action Buttons: Accent Blue (`#1E62D0`) or Dark Orange/Gold (`#E37312`) for main creation CTA.
  - Status Badges: Neutral/Yellow pills (`OPEN`), Grey outline pills (`Incomplete`).
  - Active Toggles: Vibrant green indicator (`#28A745`) when enabled.
- **Tables & Density:** Moderate-density tables with explicit inline actions (`Edit`, `Delete`, text buttons, or icon buttons). Clear status indicator toggles directly in row cells.
- **Drawer Panels:** Slide-over detail drawer on the right side of the screen for task inspection without navigating away from the active tab list.