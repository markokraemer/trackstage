# Settings - event details

*Source: https://learn.sessionboard.com/videos/video-event-settings — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

Here is the chronological analysis and system specification derived from the video.

---

### Chronological Walkthrough

#### [00:00]
**NARRATION:** Welcome to Sessionboard. In this tutorial, we'll walk you through how to update your event details step-by-step.

*(Title Screen: Blue gradient background displaying "SESSIONBOARD" logo with megaphone icon and bold title "EVENT DETAILS".)*

---

#### [00:06]
**NARRATION:** From the left-hand navigation menu, scroll to the bottom and click on Settings.

*(Navigation: Dashboard -> Left Sidebar -> Settings)*  
*(Screen Layout - Dashboard: Left sidebar contains "<- Back to organization", "Dashboard", "Contacts", "Sessions", "Portals", "Content", "Reports", "Studio", "History", "Event Team", "Settings". Main panel shows top tabs ["Speakers", "Sponsors"], "Complete onboarding" banner, "File Summary" widget, and "Session Submission Form" card with "+ Manage Forms" button. Orange highlight appears around "Settings" item at the bottom of the sidebar.)*

---

#### [00:12]
**NARRATION:** Within the Settings module, click on Event Details to edit the details of your event. This is important as it will set the foundation for additional system features such as the session submission form, portal, and email communications.

*(Navigation: Settings -> Event Details)*  
*(Screen Layout - Event Settings Screen: Two-column layout. Left sub-navigation panel "Event Settings" containing: "Event Details", "Record Settings", "Themes" [nested: "Login Page", "Appearance"], "Submission Forms", "Email Templates", "Integrations". Right main panel titled "Event Details" with subtitle "Customize your event settings and appearance". Header bar displays event title "Sessionboard Conference", date range "Jan 1/1/26 17:00 - Jan 1/1/26 18:00 (PST)", "View Portal" button, and user avatar dropdown. Orange highlight surrounds "Event Details" sub-nav item.)*

---

#### [00:26]
**NARRATION:** Enter the official name of your event.

*(Interaction: Focus highlight on "Event Name" text field, currently populated with "Sessionboard Conference".)*

---

#### [00:29]
**NARRATION:** Customize the slug that appears in your event's URL.

*(Interaction: Focus highlight on "Event Slug" text field, populated with "sessionboard-conference" and displaying an info tooltip icon.)*

---

#### [00:33]
**NARRATION:** Select the type of event that best describes this event.

*(Interaction: Focus highlight on "Event Type" dropdown select box, currently showing "Conference" with a clear "x" icon and chevron.)*

---

#### [00:37]
**NARRATION:** If available, enter the URL of the website associated with your event.

*(Interaction: Focus highlight on "Event Website URL" text input with placeholder text "ex: https://www.yoursite.com".)*

---

#### [00:42]
**NARRATION:** Specify the location of the event.

*(Interaction: Focus highlight on "Event Location" text input displaying tooltip icon and placeholder "ex: San Francisco, CA (or Zoom, Ch24, etc.)".)*

---

#### [00:45]
**NARRATION:** Select the time zone that your event is located in. Dates and times displayed across your event will reflect what you choose here. If you are intending to use a native integration, for example Grip, ensure the time zone in Sessionboard mirrors the time zone within your third-party system.

*(Interaction: Focus highlight on "Timezone" single-select dropdown, set to "(GMT-8:00) America/Los_Angeles (Pacific Stand..." with clear "x" button and dropdown arrow.)*

---

#### [01:02]
**NARRATION:** Use the calendar picker to add a starts at and ends at date and time for your event.

*(Interaction: Focus highlight on date/time picker inputs: "Starts At" set to "01/01/2026 @ 05:00 pm" [format helper: "MM/DD/YYYY @ hh:mm a"] and "Ends At" set to "01/01/2026 @ 06:00 pm" [format helper: "MM/DD/YYYY @ hh:mm a"], both with calendar icons.)*

---

#### [01:08]
**NARRATION:** Describe the core focus or theme of your event. This helps improve search, recommendations, and how content is organized.

*(Interaction: Focus highlight on "Theme" text field card area. Displays description text: "This helps improve search, recommendations, and how content is organized. Describe the main focus and what you want attendees to take away, such as new skills, ideas, or inspiration. This helps guide session content and speaker selection." Bottom counter shows "0/1000 Characters".)*

---

#### [01:16]
**NARRATION:** Upload a logo to represent your event across the platform. This logo will be featured in email communications as well as forms such as the session submission form.

*(Interaction: Focus highlight on "Image Settings" -> "Logo Image" card. Contains "Upload New" button, preview image box showing logo, helper text "Recommended: 300 w x 300 h", and "Clear Value" text button.)*

---

#### [01:26]
**NARRATION:** Upload a background image to represent your event. This image will be used on your forms such as the session submission form. We recommend using an abstract image here.

*(Interaction: Focus highlight on "Image Settings" -> "Background Image" card. Contains "Upload New" button, image thumbnail preview, helper text "Recommended: 1500 w x 500 h", and "Clear Value" text button.)*

---

#### [01:37]
**NARRATION:** Once you've made all your updates, click Save at the bottom of the page. This ensures all changes are applied and visible across your event.

*(Interaction: Focus highlight on primary "Save" button located at the bottom-left of the main form area.)*

---

#### [01:45]
**NARRATION:** That's it. Your event details are now updated. If you have any questions, feel free to contact our support team. Thank you for choosing Sessionboard.

*(Screen State: Highlights removed; full "Event Details" settings form shown in complete state.)*

---

### A. Screen Inventory

#### 1. Dashboard (`/dashboard`)
* **Purpose:** Central hub for event progress, portal configuration, and file metrics.
* **Components:**
  * **Sidebar:** Links for `<- Back to organization`, `Dashboard`, `Contacts`, `Sessions`, `Portals`, `Content`, `Reports`, `Studio`, `History`, `Event Team`, `Settings`.
  * **Top Tabs:** `Speakers`, `Sponsors`.
  * **Onboarding Banner:** "Configure your speaker portal", `Edit Portal` button.
  * **Metrics Card:** `File Summary` (`3 Session Files`, `3 Sessions With Uploaded Files`, `0 Comments Today`, `4 Exports Generated`).
  * **Form Management Card:** `Session Submission Form` status block, `+ Manage Forms` button.

#### 2. Settings - Event Details (`/settings/event-details`)
* **Purpose:** Primary configuration screen for core event metadata, scheduling, branding, and asset customization.
* **Components:**
  * **Header Bar:** Event Name context label, Event Date/Time summary, `View Portal` primary button, User Profile dropdown menu.
  * **Sub-Navigation Sidebar:** `Event Details` (active), `Record Settings`, `Themes` (`Login Page`, `Appearance`), `Submission Forms`, `Email Templates`, `Integrations`.
  * **Form Controls:**
    * `Event Name` (Text input)
    * `Event Slug` (Text input with info tooltip)
    * `Event Type` (Select dropdown with clear action)
    * `Event Website URL` (URL input)
    * `Event Location` (Text input with info tooltip)
    * `Timezone` (Searchable select dropdown with clear action)
    * `Starts At` & `Ends At` (Date-time pickers with format hint `MM/DD/YYYY @ hh:mm a`)
    * `Theme` (Textarea input with `0/1000 Characters` limit counter)
    * `Logo Image` (Upload card: `Upload New` button, thumbnail preview, dimension hint `Recommended: 300 w x 300 h`, `Clear Value` action)
    * `Background Image` (Upload card: `Upload New` button, thumbnail preview, dimension hint `Recommended: 1500 w x 500 h`, `Clear Value` action)
  * **Action Bar:** `Save` primary button.

---

### B. Feature / Capability List

1. **Event Identity Management:** Custom event naming and dynamic URL slug generation.
2. **Event Classification:** Categorization via Event Type options.
3. **External Linking:** Configuration of primary external event web address.
4. **Location Specs:** Free-text location field supporting physical venues and virtual platforms.
5. **Timezone Standardization:** Global timezone selector dictating dates across submission forms, portals, and integrations (e.g., Grip).
6. **Event Scheduling:** Precise Start and End timestamp controls using standard 12-hour AM/PM formats.
7. **Event Summary/Theme:** Multi-line text field capped at 1,000 characters to guide AI search, content organization, and speaker selection.
8. **Brand Asset Configuration:**
   * Custom Logo upload with recommended 1:1 aspect ratio (300x300 px) for forms and email headers.
   * Custom Background Image upload with recommended 3:1 aspect ratio (1500x500 px) for form headers.
   * Image reset capabilities (`Clear Value`).

---

### C. Data Model Signals

```
Event
├── id: UUID
├── name: String (e.g., "Sessionboard Conference")
├── slug: String (e.g., "sessionboard-conference")
├── type: Enum/Select (e.g., "Conference")
├── website_url: String/URL
├── location: String
├── timezone: TimezoneEnum (e.g., "America/Los_Angeles")
├── starts_at: Timestamp (e.g., "2026-01-01T17:00:00Z")
├── ends_at: Timestamp (e.g., "2026-01-01T18:00:00Z")
├── theme_description: Text (Max length: 1000)
├── logo_image_url: AssetURL
└── background_image_url: AssetURL
```

---

### D. Organizer vs Participant

* **Organizer Capabilities (In-App Admin):**
  * Configuring event names, slugs, timezones, and dates.
  * Setting event branding assets (logos, background graphics).
  * Defining theme parameters and external integration rules.
* **Participant Capabilities (Public/Speaker View - Inferred):**
  * Viewing branded forms and portals customized with logo, background, and theme parameters.
  * Receiving email notifications containing configured event branding and timezone-adjusted schedules.

---

### E. UX/UI Craft Notes

* **Layout Geometry:**
  * Left main navigation sidebar: ~220px fixed width, dark/slate text on light background.
  * Sub-navigation panel: ~200px width, light grey outline separation.
  * Content area: Max-width constraint around 1000px, multi-column grid layouts for form fields.
* **Form Field Density & Alignment:**
  * Two-column form layout for inline field pairings (`Event Name` / `Event Slug`, `Event Type` / `Event Website URL`, `Starts At` / `Ends At`).
  * Field labels positioned top-aligned with dark bold typography.
  * Sub-text and format constraints (`MM/DD/YYYY @ hh:mm a`) placed below controls in light grey text.
* **Brand & Action Elements:**
  * Primary actions (e.g., `Save`) styled in solid blue rectangular buttons with white text.
  * Secondary actions (`Upload New`) styled in clean white bordered buttons.
  * Destructive/Reset triggers (`Clear Value`) styled as plain text links with blue/dark underlines.
* **Card & Container Styling:**
  * Subtle grey outline borders defining image upload zones with integrated image previews.