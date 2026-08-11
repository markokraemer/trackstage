# Settings - email templates

*Source: https://learn.sessionboard.com/videos/video-email-templates — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

Here is the chronological transcript and technical feature specification derived directly from the Sessionboard email template walkthrough.

---

### Chronological Walkthrough & Screen Details

#### [00:00 - 00:07]
**NARRATION:**  
"Welcome to Sessionboard. In this tutorial, we'll show you how to create custom email templates for your event communications."

**SCREEN:**  
*(Title Card: White text "SESSIONBOARD" with megaphone logo and "EMAIL TEMPLATES" over a blue background image. At 00:07, transitions to Dashboard `[Dashboard]`).*
* **Nav Path:** Sidebar -> Settings
* **Sidebar Menu Items:** Back to organization, Dashboard, Contacts, Sponsors, Sessions, Portals, Content, Reports, Studio, History, Event Team, Settings.
* **Header / Top Bar:** Event dropdown "Sessionboard Conference", Date/Time "Jan 15 00:00 PM - Jan 18 00:00 PM (PST)", "View Portal" button, Notification bell, Help icon, User Avatar ("VD").
* **Dashboard Summary Cards:**
  * **Complete onboarding:** "Configure your speaker portal", "Edit Portal" button.
  * **File Summary:** 3 Session Files, 3 Sessions With Uploaded Files, 0 Comments Today, 4 Exports Generated.
  * **Session Submission Form Card:** Metrics (1 submission, 0 drafts), Status badge "OPEN" (Green badge), "Open" button with external link icon, "+ Manage Forms" button.

---

#### [00:08 - 00:15]
**NARRATION:**  
"To start, navigate to the Settings module in the left-hand menu. Access the Email Templates page."

**SCREEN:**  
*(Click: `Settings` icon in left menu -> expands to `Event Settings` sub-navigation panel -> clicks `Email Templates`).*
* **Settings Sub-Navigation Tree:**
  * Event Details
  * Record Settings
  * Portals (Expandable)
    * Submission Forms
    * Email Templates *(Active selection)*
    * Login Page
    * Appearance
  * Integrations
* **Main Content Header:** "Event Settings", Subtitle: "Customize your event settings and appearance".
* **Custom Templates Section Header:** "Custom Templates", Primary Action Button: `+ Add` (Orange outline button).
* **Empty State Display:** "You haven't added any templates yet", Subtext: "Custom email templates make it easy to send common emails quickly".
* **Standard Templates Section:** List of predefined system email cards.

---

#### [00:16 - 00:27]
**NARRATION:**  
"Standard templates are available for use. Click on any template to view its details. By clicking it, you can edit a template to further customize it for the specific needs of your event."

**SCREEN:**  
*(Hover & Click: Standard Template card `Accept Sessions` -> Opens inline/modal editor).*
* **Standard Template Cards:**
  * **Accept Sessions:** Subtext "Send this template to submissions that you have accepted".
  * **Decline Sessions:** Subtext "Send this template to submissions that you have declined".
  * **Session Form - One Day Reminder:** (Visible in bottom scroll list).
* **Template Editor Modal Overlay:**
  * Header/Title: `Settings` / `Accept Sessions`
  * **Subject Line Field:** Text input containing `Your submission has been accepted`.
  * **Message Body Field:** Rich text toolbar containing: Bold (`B`), Italic (`I`), Underline (`U`), Strikethrough (`S`), Superscript (`X²`), Subscript (`X₂`), Unordered List, Ordered List, Alignment options, Link, Image, Code (`<>`), Clear formatting, More tools (`...`).
  * **Action Link:** `Merge Tags` (Top-right of editor field).
  * **Editor Content Pre-filled Values:**
    `Dear {{recipient_first_name}} {{recipient_last_name}}, We are pleased to inform you that your session {{title}} has been accepted for {{event_name}}. Proposed Session Date and Time: {{starts_at}} - {{ends_at}}. Location: {{location}}...`
  * **Footer Metadata & Actions:** Word counter (`42 words`), Buttons: `Save` (Dark Blue button), `Cancel` (Secondary text button).

---

#### [00:28 - 00:36]
**NARRATION:**  
"To create a custom template, select the Add button. Add a name for your template that will be visible to your internal team."

**SCREEN:**  
*(Click: `+ Add` button in Custom Templates section -> Opens `Create Custom Template` modal).*
* **Modal Window:** `Create Custom Template` (Close `X` icon top right).
* **Field Focus:** `Template Name` text field with info icon tooltip.

---

#### [00:37 - 01:03]
**NARRATION:**  
"Select the module from which you plan to send the email. People is used for emails related to the contacts and speakers modules. Groups is for emails sent from the sponsor or exhibitor modules. Sessions allows you to use the template within the sessions module. If you're creating a custom acceptance email or need to include both session and speaker details, we recommend selecting the sessions module to take advantage of session and contact merge tags."

**SCREEN:**  
*(Click: `Type` dropdown selector).*
* **Type Dropdown Menu Options:**
  * `Contacts`
  * `Exhibitors/Sponsors`
  * `Sessions`

---

#### [01:04 - 01:40]
**NARRATION:**  
"Specify the email address where responses should be sent. This field supports a single email address. Add a compelling subject line that will grab the reader's attention. CC is intended to send a copy of the email to the addresses you enter separated by comma. Keep in mind this has a limit of 5, and invalid emails will be ignored. BCC is intended to send a blind copy instead. This means sent to additional recipients without the primary recipient knowing about it. It also has a limit of 5, and invalid emails will be ignored."

**SCREEN:**  
*(Form Field Highlighting in sequence):*
1. **Reply To Field:** Input field under `EMAIL` section. Single email validation.
2. **Subject Line Field:** Text input field.
3. **CC Field:** Input box with tooltip. Max limit 5 emails, comma-separated.
4. **BCC Field:** Input box with tooltip. Max limit 5 emails, comma-separated.

---

#### [01:41 - 02:08]
**NARRATION:**  
"Use the toolbar to create and customize your message body. Include merge tags such as first name for an email greeting or the session location to communicate confirmed details. Ensure to select the appropriate module for your template first before customizing your message body, as merge tags differ based on module type. Don't forget to save your template so you can use it to communicate with your event contacts in the future."

**SCREEN:**  
*(Cursor enters Message Body field -> Types "test" into Subject Line -> Clicks `Save`).*
* **Message Body Area:** Text editor box with default placeholder `Enter text here...`. Lower footer shows HTML path indicator `p`.
* **Action:** Click `Save` button at modal footer. Modal closes, returning user to `Event Settings -> Email Templates`.

---

#### [02:09 - 02:25]
**NARRATION:**  
"You've successfully created a custom email template. If you have any questions, don't hesitate to reach out to our support team. Thank you for choosing Sessionboard."

**SCREEN:**  
*(Static view of Email Templates screen with empty state, followed by Sessionboard animated outro logo card).*

---

### A. Screen Inventory

1. **Dashboard (`/dashboard`)**
   * **Purpose:** High-level metrics, onboarding tasks, and access point to admin settings.
   * **Components:** Left Sidebar, Top Navigation, Speaker Portal Card, File Summary Card, Form Metrics Card (`OPEN` badge, `+ Manage Forms` button).

2. **Event Settings - Email Templates (`/settings/email-templates`)**
   * **Purpose:** Management hub for custom and standard system email templates.
   * **Components:** 
     * Sub-nav sidebar (`Event Details`, `Record Settings`, `Portals`, `Integrations`).
     * `Custom Templates` section (`+ Add` button, empty state container).
     * `Standard Templates` card list (`Accept Sessions`, `Decline Sessions`, `Session Form - One Day Reminder`).

3. **Standard Template Quick Editor Modal**
   * **Purpose:** Quick modification of system-default templates (e.g., Session Acceptance/Rejection).
   * **Components:** Inputs for `Subject Line`, Rich Text Toolbar, `Merge Tags` action button, Content Editor area, Word Count meter (`42 words`), `Save` and `Cancel` buttons.

4. **Create Custom Template Modal**
   * **Purpose:** Creation of user-defined, module-scoped outbound emails.
   * **Components:** Form Inputs: `Template Name`, `Type` (Dropdown: `Contacts`, `Exhibitors/Sponsors`, `Sessions`), `Reply To`, `CC`, `BCC`, `Subject Line`, Rich Text Editor area with `Merge Tags` picker, `Save` and `Cancel` action buttons.

---

### B. Feature / Capability List

* **Custom Email Template Creation:** Create and name internal email templates scoped to specific functional modules.
* **Module Scoping (`Type`):** Contextually restricts available dynamic fields based on entity:
  * `Contacts`: Scoped to Speakers and Contacts menu.
  * `Exhibitors/Sponsors`: Scoped to Exhibitors and Sponsor groups.
  * `Sessions`: Scoped to Session entities; enables cross-entity merge fields (both Session and Speaker metadata).
* **Header Configuration:**
  * **Reply-To:** Strict single email format.
  * **CC / BCC Limits:** Max 5 email addresses per field, comma-delimited. Automated validation discards invalid emails.
* **Rich Text Formatting & Dynamic Merge Fields:**
  * Full formatting toolbar (bold, lists, links, images, code block, clear formatting).
  * Variable insertion via `Merge Tags` picker (e.g., `{{recipient_first_name}}`, `{{title}}`, `{{starts_at}}`, `{{location}}`).
* **System Defaults (Standard Templates):** System-provided standard response templates for session acceptance, rejection, and form reminders with editable text.

---

### C. Data Model Signals

* **Email Template Entity:**
  * `Template Name` (string, required)
  * `Type` / `Module Scope` (enum: `Contacts`, `Exhibitors/Sponsors`, `Sessions`)
  * `Reply To` (string, single email address format)
  * `CC` (array of strings, max length: 5)
  * `BCC` (array of strings, max length: 5)
  * `Subject Line` (string)
  * `Message Body` (HTML/rich text content)
  * `Is Standard / System Template` (boolean flag)
* **Merge Tag References:**
  * **Contact Attributes:** `recipient_first_name`, `recipient_last_name`
  * **Session Attributes:** `title`, `starts_at`, `ends_at`, `location`
  * **Event Attributes:** `event_name`

---

### D. Organizer vs Participant

* **Organizer (Admin Interface):** Everything shown in this walkthrough belongs exclusively to the Event Organizer portal (`Settings -> Email Templates`).
* **Participant (Speaker/Sponsor Interface):** Passive recipients of emails generated from these configured templates.

---

### E. UX/UI Craft Notes

* **Layout Geometry:** Left navigation panel uses a fixed-width dark theme sidebar, paired with a white sub-navigation tree under "Settings" and a padded main content area.
* **Color Palette & Styling:**
  * **Brand Primary:** Deep blue/navy (`#1E293B` style tones) for primary nav and header overlays.
  * **Accent/CTA:** Vivid orange (`+ Add` border and buttons) and bright blue for interactive focus states.
  * **Status Badges:** Rounded pills with bold green background for `OPEN` status indicators.
* **Form Layout:** Labels positioned directly above input fields with grey info circles (`(i)`) adjacent to labels for inline contextual help.
* **Modal Windows:** Centered overlay cards with explicit header dividers, top-right `X` close triggers, and right-aligned bottom actions (`Cancel` text link next to solid `Save` button).