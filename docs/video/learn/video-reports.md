# Reports

*Source: https://learn.sessionboard.com/videos/video-reports — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Video Log

**[00:00 - 00:06]**
* **NARRATION:** Overview of creating and managing event reports in Sessionboard.
* **SCREEN:** *(Title Card: Title "REPORTS" with Sessionboard logo on a blue background).*

**[00:06 - 00:24]**
* **NARRATION:** Navigate to Reports. Four report types exist. Session reports group sessions vertically with related details/roles horizontally.
* **SCREEN:** *(Reports page: Nav path: `Main Sidebar -> Reports`. Navigation bar: Exhibitors, Sponsors, Sessions, Applications, Portals, Library, Reports, Studio, History, Event Team, Settings. Top Nav: Event selector "Sessionboard Conference", Date "Jan 1 5:00 PM - Jan 2 6:00 PM (GMT-7)", Search bar, "View Portal" link, User Profile "MC". Page Title: "Reports", Subtitle: "View and export reports for your event. Records are filtered based on your user permissions." Search field present. Section 1: "Session Reports" (7) with "+ Add Report" button. Cards shown: "Sessions with Speaker Details", "Sessions with Evaluation Ratings", "New Sessions Report", "Session Agenda". Cards contain card title, description, gear settings icon, and "Run Report" button with download icon).*

**[00:24 - 00:34]**
* **NARRATION:** Contact reports display contacts vertically with associated relationships horizontally.
* **SCREEN:** *(Reports page: Section 2: "Contact Reports" (5) with "+ Add Report" button. Cards shown: "Speakers with Session Details", "Chairpersons with Session Details", "Moderators with Session Details", "Submitters with Session Details", "New Contact Report").*

**[00:34 - 00:46]**
* **NARRATION:** Group reports list companies/organizations vertically with associated contact and session details horizontally.
* **SCREEN:** *(Reports page: Section 3: "Group Reports" (2) with "+ Add Report" button. Cards shown: "Exhibitors with Contact and Session Details", "Sponsors with Contact and Session Details").*

**[00:46 - 01:03]**
* **NARRATION:** Evaluation plan reports show evaluator progress. Admins cannot add new ones, but rating data exports via Evaluation module.
* **SCREEN:** *(Reports page: Section 4: "Evaluation Plan Reports" (3). Cards shown: "Evaluator Details Report", "Individual Grade Report (Consolidated)", "Cumulative Grades Report (Consolidated)". Cards contain "Run Report" buttons).*

**[01:03 - 01:08]**
* **NARRATION:** Click Add Report beside the desired type to build a report.
* **SCREEN:** *(Reports page: Hover and click on "+ Add Report" button next to "Session Reports" section).*

**[01:08 - 01:15]**
* **NARRATION:** Enter report name and brief description in the modal.
* **SCREEN:** *(Modal: "Add Session Report". Header wizard steps: `1 Configuration` (active), `2 Relationships`, `3 Choose Fields`, `4 Filters & Sorting`, `5 Review`. Form fields: "Report Name *" text field [Filled: "New Sessions Report"], "Description" textarea [Placeholder: "Enter a description"]. Footer: "Next" primary button).*

**[01:15 - 01:21]**
* **NARRATION:** Toggle desired relationship inclusions.
* **SCREEN:** *(Modal: "Add Session Report" - Step `2 Relationships`. Header: "Include Relationships", Subtitle: "Select which relationships you would like to include in your report." Toggle list: "Session Submitter", "Session Speakers", "Session Chairpersons", "Session Moderators", "Session Exhibitors". Footer: "Back" secondary button, "Next" primary button).*

**[01:21 - 01:41]**
* **NARRATION:** Select output fields via tabs, reorder on left side, and view selected fields in the right panel.
* **SCREEN:** *(Modal: "Add Session Report" - Step `3 Choose Fields`. Header: "Add Fields". Left pane: Search bar, Category tab "Sessions", Checkbox field list ("ID", "Type", "Title", "Description"), drag handles for reordering. Right pane: Field layout preview "Showing 3 fields" with list ("ID", "Title", "Status") and "Remove all" action button. Footer: "Back", "Next").*

**[01:41 - 01:52]**
* **NARRATION:** Filter and sort data in ascending/descending order by field.
* **SCREEN:** *(Modal: "Add Session Report" - Step `4 Filters & Sorting`. Toggle: "Must match all filters" (When enabled, records must match filters in every section). Section: "Filter Session Records" with rule "Starts At" | "is after" | "04/04/2026", "+ Add Filter" button. Section: "Sort Session Records" with dropdown field "Location", direction dropdown "Ascending", "+ Add sort" button. Footer: "Back", "Next").*

**[01:52 - 02:02]**
* **NARRATION:** Review summary and click Save Report.
* **SCREEN:** *(Modal: "Add Session Report" - Step `5 Review`. Summary fields: Configuration ("Report Name": "New Sessions Report", "Description": "—"), Relationships ("Session Speakers"), Fields ("Sessions": "ID", "Title"). Footer: "Back" secondary button, "Save Report" primary button).*

**[02:02 - 02:09]**
* **NARRATION:** Click Run Report to export XLSX or CSV files.
* **SCREEN:** *(Reports page: Highlight on "Run Report" button inside custom card "New Sessions Report").*

**[02:09 - 02:25]**
* **NARRATION:** Gear icon allows editing or deleting reports. Support contact info and conclusion.
* **SCREEN:** *(Reports page: Highlight on gear settings icon on report card).*

**[02:25 - 02:31]**
* **NARRATION:** None.
* **SCREEN:** *(Outro animation with Sessionboard logo).*

---

### A. Screen Inventory

1. **Reports Index Dashboard (`/reports`)**
   * **Purpose:** Central Hub to view, search, configure, and export reports across four system categories.
   * **Components:**
     * Left navigation sidebar.
     * Top header with event metadata, quick search, portal link, user menu.
     * Global report search field (`Search`).
     * Categorized Report Groups: "Session Reports", "Contact Reports", "Group Reports", "Evaluation Plan Reports".
     * Action buttons: `+ Add Report` (per section except Evaluation Plan), `Run Report` (per card), Gear icon (`Edit`/`Delete`).

2. **Add/Edit Report Wizard Modal (`Add [Type] Report`)**
   * **Purpose:** 5-step wizard modal to configure custom reports.
   * **Components:**
     * Step Indicator: `1 Configuration`, `2 Relationships`, `3 Choose Fields`, `4 Filters & Sorting`, `5 Review`.
     * Step 1 Controls: `Report Name *` text input, `Description` text area.
     * Step 2 Controls: Relationship switches (`Session Submitter`, `Session Speakers`, `Session Chairpersons`, `Session Moderators`, `Session Exhibitors`).
     * Step 3 Controls: Search bar, entity tabs, field checkboxes with drag-and-drop handles, right preview list (`SESSION DETAILS`) with field items and `Remove all` button.
     * Step 4 Controls: `Must match all filters` toggle, `Filter [Entity] Records` builder with conditional dropdowns and `+ Add Filter`, `Sort [Entity] Records` builder with field selector, direction selector (`Ascending`/`Descending`), and `+ Add sort`.
     * Step 5 Controls: Structured config preview, `Back`, `Save Report`.

---

### B. Feature / Capability List

* **Report Categorization:** Reports organized into Session, Contact, Group, and Evaluation Plan types.
* **Custom Report Generation:** Wizard-driven builder with custom names, descriptions, and field selection.
* **Relationship Joining:** Ability to attach 1-to-N related entities (Speakers, Chairpersons, Submitters, Moderators, Exhibitors) to primary records.
* **Field Customization & Reordering:** Select specific fields and set column order via drag-and-drop.
* **Filtering & Sorting Rules:** Multi-condition filtering (`AND`/`OR` match toggle) and multi-field sorting (`Ascending`/`Descending`).
* **Data Exports:** File exports available in `.xlsx` and `.csv` formats upon executing `Run Report`.
* **Evaluation Reports Lock:** System evaluation reports are pre-configured; admins cannot add new custom evaluation plan reports directly within this module.
* **Management Controls:** Custom reports edited or deleted via card gear settings.

---

### C. Data Model Signals

* **Report Entity:** `ID`, `Name`, `Description`, `Category` (`Session`, `Contact`, `Group`, `Evaluation Plan`), `Relationships`, `Selected Fields`, `Filter Rules`, `Sort Rules`.
* **Session Attributes:** `ID`, `Type`, `Title`, `Description`, `Status`, `Starts At`, `Location`.
* **Session Relationships / Roles:** `Submitter`, `Speaker`, `Chairperson`, `Moderator`, `Exhibitor`.
* **Group Entities:** `Exhibitors`, `Sponsors` (Companies/Organizations).
* **Evaluation Attributes:** `Evaluator`, `Plan`, `Ratings`, `Scores`, `Status`.

---

### D. Organizer vs Participant

* **Organizer (Admin):** Entire module accessible only to organizers/admins for system-wide data reporting, field configuration, filtering, and exporting.
* **Participant (Speaker/Evaluator/Exhibitor):** No access to this reporting module.

---

### E. UX/UI Craft Notes

* **Layout Geometry:** Left navigation sidebar, centered main body layout, grouped grid card sections.
* **Cards:** White cards with border stroke, drop shadow on hover, title on top, description text below, footer action buttons.
* **Wizard Modal:** Center overlay modal with horizontal numbered step progress indicator at top, dual-column structure for field selection (Step 3), clear `Back` / `Next` action button hierarchy at bottom right.
* **Controls:** Toggle switches for boolean options, standard search inputs with magnifying glass iconography, drag handles for reorderable lists.