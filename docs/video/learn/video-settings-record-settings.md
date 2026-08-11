# Settings - record settings

*Source: https://learn.sessionboard.com/videos/video-settings-record-settings — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Breakdown

#### [00:00]
**NARRATION:**  
Welcome to Sessionboard. In this tutorial, we'll walk you through configuring your record settings.

**SCREEN:**  
*(Title slide: Blue background with text "SESSIONBOARD" logo and "RECORD SETTINGS" in bold white typography.)*

---

#### [00:06]
**NARRATION:**  
In record settings, you can enable the option to collect additional contacts, such as a speaker's assistant, through the session submission form.

**SCREEN:**  
*(Public Submission Form view highlighting the "Secondary Contacts" section. Fields: "First name *", "Last name *", "Email *", "Role", and "+ Add Secondary Contact" button. Bottom action bar: "<- Back", "Save as draft", "Complete ->".)*

---

#### [00:15]
**NARRATION:**  
To begin, access the Settings module on the left side of your screen.

**SCREEN:**  
*(Dashboard: Navigation path `Event Dashboard -> Settings`. Left sidebar menu: `Dashboard`, `Contacts`, `Sessions`, `Portals`, `Content`, `Reports`, `History`, `Event Team`, `Settings` [highlighted in orange box]. Main area shows `Speakers` and `Sponsors` tabs.)*

---

#### [00:20]
**NARRATION:**  
Navigate to the Record Settings page.

**SCREEN:**  
*(Page path: `Settings -> Record Settings`. Left submenu: `Event Details`, `Record Settings` [selected], `Admin Settings`, `Portals` -> `Login Page`, `Appearance`, `Submission Forms`, `Email Templates`, `Integrations`. Main view shows `Event Settings` header with tabs `General` [selected] and `Layouts`.)*

---

#### [00:23]
**NARRATION:**  
On Layouts, you can choose what fields to display when creating new contact or group records by using the Show/Hide Fields button.

**SCREEN:**  
*(Sub-navigation: `Settings -> Record Settings -> Layouts`. Tabs: `Contact Fields` [active], `Group Fields`. Controls: Search bar `"Search by name ..."` and button `👁 Show/Hide Fields`. Table columns: `Name`, `Category`, `Type`, `Level`. Visible rows: `Email`, `First Name`, `Last Name`, `Mobile Phone`, `Headshot`, `Biography`, `Home Phone`, `Zip`.)*

---

#### [00:31]
**NARRATION:**  
In General settings, you can set a global limit of submissions a speaker is allowed to make in your event. However, this can also be set per submission form.

**SCREEN:**  
*(Sub-navigation: `Settings -> Record Settings -> General`. Focus on toggle section: `Set Submission Limit` with description "Limit the number of sessions one user can submit to this event. This can also be set per submission form." Toggle state: OFF.)*

---

#### [00:41]
**NARRATION:**  
You can enable automatic portal access for your contacts. When enabled, contacts' portal access will automatically be provisioned with their contact email and will be updated when the email changes.

**SCREEN:**  
*(Focus on toggle section: `Automatically provision contact portal access`. Toggle state: ON [green]. Info tooltip icon present next to label.)*

---

#### [00:53]
**NARRATION:**  
The collection of record settings will be enabled by default. If you prefer not to collect additional contacts for your speakers, you can disable this feature by toggling the setting off.

**SCREEN:**  
*(Focus on toggle section: `Collect Additional Contacts`. Toggle state: ON [green]. Below it: `Enable Primary Speakers` toggle [ON].)*

---

#### [01:04]
**NARRATION:**  
You can enable headshot file upload limitations for your speakers, such as specific file formats or specific file sizes.

**SCREEN:**  
*(Focus on expanded setting: `Enable Speaker Headshot Limitations` [Toggle: ON]. Controls displayed: `Accepted File Formats` multi-select field containing chips `PNG x`, `JPEG x`; `Limit File Size` toggle [ON]; blue notice box: "Enter custom values in order to restrict the allowed file size. The maximum permitted file size is 1.95 GB."; numeric inputs: `Maximum File Size` [`5`], `Type` dropdown [`MB`].)*

---

#### [01:13]
**NARRATION:**  
You can also specify the prefix for records within your event.

**SCREEN:**  
*(Focus on form section: `Record IDs`. Input text fields: `Session Prefix` [`SESS`], `Contact Prefix` [`CONT`], `Group Prefix` [`ACCT`].)*

---

#### [01:17]
**NARRATION:**  
Lastly, by enabling this option, the ID of a sub-session will remain the same and will not show as nested under the parent session ID.

**SCREEN:**  
*(Focus on checkbox control below Record IDs: `[X] Keep original ID with submissions`.)*

---

#### [01:26]
**NARRATION:**  
After making your updates, click Save at the bottom of the page to apply the changes to your submission form. Please note that these updates will affect all submission forms within your event.

**SCREEN:**  
*(Focus on bottom action button: `Save` [solid orange button].)*

---

#### [01:37]
**NARRATION:**  
Congratulations! You have configured your record settings. If you have any questions, feel free to contact our support team. Thank you for choosing Sessionboard.

**SCREEN:**  
*(Redirected back to main `Dashboard` -> `Speakers` tab view displaying onboarding cards, file summary metrics, and active submission forms list.)*

---

### A. Screen Inventory

1. **Submission Form - Secondary Contacts Section**
   * **Purpose:** Public interface allowing submitters to add assistant/secondary contact information.
   * **Components:** `First name *` (Text Input), `Last name *` (Text Input), `Email *` (Text Input), `Role` (Text Input), `+ Add Secondary Contact` (Text Button), `<- Back` (Button), `Save as draft` (Button), `Complete ->` (Primary Button).

2. **Event Settings - Record Settings (General Tab)**
   * **Purpose:** Global event configuration for submission limits, portal provisioning, secondary contacts, headshots, and record prefixes.
   * **Components:**
     * Submenu: `Event Details`, `Record Settings`, `Admin Settings`, `Portals` (`Login Page`, `Appearance`), `Submission Forms`, `Email Templates`, `Integrations`.
     * Tabs: `General`, `Layouts`.
     * Toggles & Inputs:
       * `Set Submission Limit` (Toggle)
       * `Automatically provision contact portal access` (Toggle)
       * `Collect Additional Contacts` (Toggle)
       * `Enable Primary Speakers` (Toggle)
       * `Enable Speaker Headshot Limitations` (Toggle)
       * `Accepted File Formats` (Multi-select Tag Field)
       * `Limit File Size` (Toggle)
       * `Maximum File Size` (Numeric Field)
       * `Type` (Dropdown Select)
       * `Session Prefix` (Text Input)
       * `Contact Prefix` (Text Input)
       * `Group Prefix` (Text Input)
       * `Keep original ID with submissions` (Checkbox)
     * Actions: `Save` (Primary Button).

3. **Event Settings - Record Settings (Layouts Tab)**
   * **Purpose:** Manage global field visibilities for contact and group creation forms.
   * **Components:**
     * Tabs: `Contact Fields`, `Group Fields`.
     * Actions: `Search by name ...` (Search Input), `👁 Show/Hide Fields` (Button).
     * Table: Headers (`Name`, `Category`, `Type`, `Level`). Pagination control (`Show: 25`).

---

### B. Feature / Capability List

* **Global Submission Limit:** Toggle and set maximum session submissions per user event-wide (overrideable per form).
* **Automated Portal Access Provisioning:** Auto-create and sync speaker portal access based on contact email changes.
* **Secondary Contacts Collection:** Enable optional/required assistant/secondary contact collection on forms.
* **Primary Speaker Flagging:** Ability to designate primary speakers on submissions.
* **Headshot File Upload Controls:** Restrict accepted file extensions (e.g., PNG, JPEG) and set maximum file size caps up to 1.95 GB.
* **Record Identifier Customization:** Define global uppercase prefixes for `Session Prefix`, `Contact Prefix`, and `Group Prefix`.
* **Sub-session ID Preservation:** Preserve independent record IDs for sub-sessions instead of hierarchical parent nesting.
* **Field Layout Management:** Configurable visibility (Show/Hide) for system contact and group fields.

---

### C. Data Model Signals

* **Event Setting / Configuration:**
  * `submission_limit_enabled` (Boolean)
  * `auto_provision_portal_access` (Boolean)
  * `collect_secondary_contacts` (Boolean)
  * `enable_primary_speakers` (Boolean)
  * `headshot_limits_enabled` (Boolean)
  * `headshot_allowed_formats` (List/Array)
  * `headshot_max_file_size` (Integer/Float)
  * `headshot_max_file_size_unit` (Enum: `MB`, `GB`, `KB`)
  * `session_id_prefix` (String)
  * `contact_id_prefix` (String)
  * `group_id_prefix` (String)
  * `keep_original_subsession_id` (Boolean)
* **Secondary Contact:**
  * `first_name` (String, Required)
  * `last_name` (String, Required)
  * `email` (String, Required)
  * `role` (String, Optional)
* **Field Metadata / Layout:**
  * `field_name` (String)
  * `category` (Enum: `Profile`, `Communication`, etc.)
  * `type` (Enum: `Email`, `Text`, `Phone`, `File`, `Wysiwyg`)
  * `level` (Enum: `Global`, `Event`)

---

### D. Organizer vs Participant

* **Organizer Side:**
  * Navigating and configuring `Settings -> Record Settings` (General & Layouts).
  * Setting file limits, record prefixes, submission limits, and portal provisioning rules.
* **Participant (Speaker / Submitter) Side:**
  * Entering secondary contact details on public submission forms.
  * Experiencing file format/size validations when uploading headshots.
  * Accessing the speaker portal automatically via provisioned email.

---

### E. UX/UI Craft Notes

* **Sidebar & Layout Geometry:** Fixed 240px navy left sidebar with grouped collapsible links; sub-navigation uses a clean left-side panel for settings modules.
* **Color Palette:**
  * Primary Accent: Orange (`#F26522` / `#E0530E`) for key CTAs (`Save`, `Manage Forms`, `Open`).
  * Active Toggle State: Vivid Green when enabled, Gray when disabled.
  * Notice/Alert Banners: Light blue background with dark blue text for system notices.
* **Form Controls:** Labels stacked directly above inputs; micro-copy and max-character counters rendered below inputs in muted gray text.
* **Button Hierarchy:** Solid orange for primary submit/save actions; outlined white/gray buttons for secondary actions (`Show/Hide Fields`).