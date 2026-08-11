# Creating & sending emails

*Source: https://learn.sessionboard.com/videos/video-creating-sending-emails — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Video Breakdown

#### [00:00] Title Slide
* **NARRATION:** Welcome to Sessionboard. In this video, we will walk through how to create and send an email to your event contacts.
* **SCREEN:** *(Title card screen: dark blue background with logo and title text "CREATING & SENDING EMAILS".)*

---

#### [00:06] Navigation & Email Modules
* **NARRATION:** Emails can be sent from the contacts, exhibitors, sponsors, and sessions modules. In this demonstration, we'll walk through the process of sending emails from the sessions module, which is especially useful if you need to include session and speaker metadata. However, the steps for sending an email are the same across all of the listed modules.
* **SCREEN:** *(Dashboard layout with left sidebar highlighting relevant navigation links: `Contacts`, `Exhibitors`, `Sponsors`, `Sessions` under the main navigation group.)*

---

#### [00:28] Filter and Paginate Submissions
* **NARRATION:** Within the sessions module, there are predefined filters at the top of the page based on session status. Select a status to view all sessions with that associated status. This helps streamline the process of sending emails to sessions with similar statuses. We recommend increasing your pagination to 100 in the bottom right hand corner as emails can only be sent in batches of up to 100 at a time.
* **SCREEN:** *(Nav: `Sessions` -> `Submissions` tab. Status filter pills at top: `View All (11)`, `Accepted (8)` [blue active], `Accept Queue (0)`, `Pending (1)`, `Decline Queue (0)`, `Declined (2)`, `Drafts (0)`. Table headers: Checkbox, Edit (pencil), Status, Title, CEU Credits, Description, Starts At. Bottom right pagination dropdown: `Show: 100`.)*

---

#### [00:53] Bulk Selection and Action Bar
* **NARRATION:** Select all records on the page by clicking the checkbox in the header row, then click the send emails button located in the action bar.
* **SCREEN:** *(User clicks header checkbox selecting all rows. Bulk action bar appears above filter pills: `11 Selected`, `Edit`, `Send Emails` [highlighted button], `Download Files`, `Delete`, `More`.)*

---

#### [01:01] Email Setup: Recipient Configuration
* **NARRATION:** Within the pop-up, select the recipient type from the drop-down menu in the receiver field. Each contact associated with their respective session will receive an individual email. If you choose select individual contacts, you'll have the option to select specific contacts to receive the email on the review page.
* **SCREEN:** *(Modal opens: `Send Email` with a 3-step progress stepper: `Setup Email` [active], `Review`, `Send`. Left side form field dropdown `Who should receive this email?` opened showing options: `Everyone (Submitters, Speakers, Chairpersons, Moderators)`, `Session Participants (Speakers, Chairpersons, Moderators)`, `Session Speakers` [selected], `Session Chairpersons`, `Session Moderators`, `Session Submitters`, `Select Individual Contacts`.)*

---

#### [01:20] Email Setup: Additional Contacts, Sender & Copy Options
* **NARRATION:** If you include additional contacts, they will also receive their own separate email. However, it will be an exact copy of the message sent to the speaker they are associated with. In the reply sent to field, enter the email address where you'd like to receive responses. Please note that this field supports only one email address. In the CC field, you can send a copy of the email to the addresses you enter. Make sure they're valid and separated by commas. Invalid email addresses will be ignored, and it has a limit of five. Similarly, BCC stands for blind carbon copy, which allows you to send an email to multiple recipients without them seeing each other's email addresses. This feature is useful for maintaining privacy and preventing reply-all situations in group emails.
* **SCREEN:** *(Form field dropdown `Include additional contacts:` showing options: `Select...`, `Include additional contacts of recipients (CC)`, `Send only to additional contacts of recipients`, `Do not include additional contacts`. Form text inputs: `Replies sent to:` [default: `no-reply@sessionboard.com`], `CC:`, `BCC:`.)*

---

#### [02:10] Email Setup: Template & Rich Text Composition
* **NARRATION:** On the right side of the screen, you can either insert a previously created email template or compose a new message by adding a subject line and a message body. Once complete, select the review button to preview your email.
* **SCREEN:** *(Right side panel in modal: `Insert a message template` dropdown, `Merge Tags` button, Subject line input `Your submission has been accepted`, rich-text toolbar, body editor containing text mixed with merge tags like `{{recipient.first_name}}`, `{{title}}`, `{{starts_at}}`. Click `Review` button in bottom left footer.)*

---

#### [02:24] Email Review & Individual Preview
* **NARRATION:** Within the actions column, select the recipient whose email you'd like to preview. The right side of the screen will display the exact message that the recipient will receive. After reviewing all emails, click the send emails button to proceed to step three.
* **SCREEN:** *(Modal step 2: `Review` active. Left side shows recipient table under `Review & Preview` - `3 people will receive emails` with columns: `Name`, `Email`, `Action` [radio button]. Right side panel renders full email preview populated with recipient data. Click bottom button `Send Emails`.)*

---

#### [02:39] Confirmation & Final Send
* **NARRATION:** To send your email, click the green send emails button in the center of the screen. Once selected, your emails will be successfully sent.
* **SCREEN:** *(Modal step 3: `Send` active. Center confirmation card with paper airplane graphic: `Just to confirm - You're about to send 18 emails. Ready to go? Hit "Send" below.` Green action button: `Send 18 emails`.)*

---

#### [02:49] Tracking in History Module
* **NARRATION:** You can track all emails sent from Sessionboard within the history module. Watch the history training video to learn more. If you have any questions, feel free to reach out to our support team. Thank you for choosing Sessionboard.
* **SCREEN:** *(Nav: `History` module. Tabs: `History`, `Emails` [active], `SMS`, `Integrations`, `Exports`, `Audit`. Sub-filter pills: `Campaigns (0)`, `Sent Emails (334)` [active], `Errors (0)`. Table headers: `Recipient`, `Email`, `Subject`, `Status` [Delivered, Open, Dropped badges], `System`, `Sent By`, `Sent At`.)*

---

### A. Screen Inventory

#### 1. Sessions Submissions Page
* **Purpose:** List, filter, select, and manage session submissions and trigger batch operations.
* **Components:**
  * Top navigation header (Event switcher, `View Portal`, Profile menu).
  * Left side navigation sidebar (`Dashboard`, `Contacts`, `Exhibitors`, `Sponsors`, `Sessions`, `Portals`, `Content`, `Reports`, `Studio`, `History`, `Settings`).
  * Module sub-tabs: `Submissions`, `Forms`.
  * Filter pills: `View All (#)`, `Accepted (#)`, `Accept Queue (#)`, `Pending (#)`, `Decline Queue (#)`, `Declined (#)`, `Drafts (#)`.
  * Search bar & filter controls: Search input, `Show/Hide Fields`, `Add Filter +`, `Add Sort By +`.
  * Bulk Action Bar: Checkbox selector, `<N> Selected` counter, `Edit`, `Send Emails`, `Download Files`, `Delete`, `More`.
  * Data Table: Headers (`Checkbox`, `Edit`, `Status`, `Title`, `CEU Credits`, `Description`, `Starts At`). Status badges: `Pending` (Yellow), `Accepted` (Green), `Declined` (Red).
  * Pagination footer: Row count label (`11 rows`), pagination control (`Show: 100`).

#### 2. Send Email Modal (Step 1: Setup Email)
* **Purpose:** Configure recipients, sender parameters, copy recipients, email template, and rich text body with merge tags.
* **Components:**
  * Top Stepper: `Setup Email` (Blue/Active) -> `Review` -> `Send`.
  * Left Panel Inputs:
    * Dropdown: `Who should receive this email?`
    * Dropdown: `Include additional contacts:`
    * Text Input: `Replies sent to:`
    * Text Input: `CC:`
    * Text Input: `BCC:`
  * Right Panel Controls:
    * Dropdown: `Insert a message template`
    * Button: `Merge Tags`
    * Text Input: `Enter your email subject...`
    * Rich text WYSIWYG editor & toolbar.
  * Modal Footer: Buttons (`Review`, `Cancel`, `X` close).

#### 3. Send Email Modal (Step 2: Review)
* **Purpose:** Preview individual generated emails with populated recipient-specific merge tags.
* **Components:**
  * Top Stepper: `Setup Email` -> `Review` (Blue/Active) -> `Send`.
  * Left Recipient Table: Header `Review & Preview`, count indicator `<N> people will receive emails`, table headers `Name`, `Email`, `Action` (Radio selection).
  * Right Preview Pane: Fully rendered HTML email preview showing subject, sender CC info, populated body content, and logo header.
  * Modal Footer: Buttons (`<- Back`, `Send Emails`).

#### 4. Send Email Modal (Step 3: Send Confirmation)
* **Purpose:** Final confirmation before queuing email dispatch.
* **Components:**
  * Top Stepper: `Setup Email` -> `Review` -> `Send` (Blue/Active).
  * Center Confirmation Card: Paper plane graphic, message `Just to confirm - You're about to send <N> emails. Ready to go? Hit "Send" below.`
  * Green Action Button: `Send <N> emails`.
  * Modal Footer: Button (`<- Back`).

#### 5. History Module (Emails Tab)
* **Purpose:** Audit and log tracking for all sent emails, campaigns, and delivery errors.
* **Components:**
  * Module Tabs: `History`, `Emails` (Active), `SMS`, `Integrations`, `Exports`, `Audit`.
  * Filter Chips: `Campaigns (#)`, `Sent Emails (#)` (Active), `Errors (#)`.
  * Table Search & Page Controls: Search bar, row count, pagination navigation.
  * Audit Table Columns: `Recipient`, `Email`, `Subject`, `Status`, `System`, `Sent By`, `Sent At`.
  * Status Badges: `Delivered` (Green outline/text), `Open` (Blue outline/text), `Dropped` (Gray outline/text).

---

### B. Feature / Capability List

1. **Multi-Module Dispatch Capabilities:** Email triggering available across Contacts, Exhibitors, Sponsors, and Sessions modules.
2. **Status-Based Filter Quick-Pills:** Quick filtering by session status (`Accepted`, `Accept Queue`, `Pending`, `Decline Queue`, `Declined`, `Drafts`).
3. **Batch Email Limit & Pagination:** Max batch size of 100 emails per send action; pagination selectable up to 100 items per page.
4. **Target Recipient Selection:** Granular selection by role (`Everyone`, `Session Participants`, `Session Speakers`, `Session Chairpersons`, `Session Moderators`, `Session Submitters`, `Select Individual Contacts`).
5. **Additional Contacts Handling:** Options to CC, target exclusively, or exclude secondary contacts linked to primary recipients.
6. **Reply-To & Copy Routing:** Supports a single `Replies sent to` address and up to 5 comma-separated `CC` / `BCC` recipients (invalid emails ignored).
7. **Template & Dynamic Content Integration:** Template insertion support and dynamic syntax substitution via `Merge Tags` (e.g., recipient names, session titles, dates).
8. **WYSIWYG Formatting:** Full-featured rich text editing toolbar for body composition.
9. **Recipient-Level Email Preview:** Interactive preview in Step 2 allowing selection of individual recipients to inspect rendered merge fields.
10. **Delivery & Status Tracking:** Logged tracking in `History -> Emails` showing delivery states (`Delivered`, `Open`, `Dropped`, `Errors`).

---

### C. Data Model Signals

#### Entities & Attributes
* **Session Submission:**
  * Status: `Accepted`, `Accept Queue`, `Pending`, `Decline Queue`, `Declined`, `Draft`.
  * Attributes: Title, Description, CEU Credits, Start Time (`starts_at`), End Time (`ends_at`), Location.
* **Contact / Recipient:**
  * Identity: First Name, Last Name, Primary Email Address.
  * Roles: Submitter, Speaker, Chairperson, Moderator, Participant, Additional Contact.
* **Email Message / Log:**
  * Properties: Subject, Body (HTML/Rich Text), Reply-To Address, CC Addresses (Max 5), BCC Addresses.
  * Metadata: Sent By (User/System), Sent At (Timestamp), Delivery Status (`Delivered`, `Open`, `Dropped`, `Failed`).
  * System Identifiers: Merge Tags mapping to Recipient, Event, and Session objects.

---

### D. Organizer vs Participant Mapping

| Feature / Capability | Organizer (Admin Dashboard) | Participant (Speaker / Contact Portal) |
| :--- | :---: | :---: |
| Access Sessions & Submissions Table | **Yes** | No |
| Bulk Selection & Action Triggering | **Yes** | No |
| Email Template Selection & Composition | **Yes** | No |
| Customizing Sender, CC, BCC, & Reply-To Fields | **Yes** | No |
| Previewing Rendered Recipient Emails | **Yes** | No |
| Dispatching Batch Email Campaigns | **Yes** | No |
| Receiving System Emails & Notifications | No | **Yes** |
| Email History & Audit Log Tracking | **Yes** | No |

---

### E. UX/UI Craft Notes

* **Layout Geometry:**
  * Sidebar: Fixed left panel (~220px wide) with dark theme and icon + label vertical navigation links.
  * Content Area: Off-white background carrying card-based containers for tabular data and forms.
  * Email Modal: Overlay dialog (~900px width) containing a top 3-step breadcrumb progress stepper (`Setup Email` -> `Review` -> `Send`).
* **Modal Split Composition:** Step 1 and Step 2 use a split 50/50 two-panel arrangement (Left: Controls/Table; Right: Editor/Preview pane).
* **Typography & Labels:** Labels positioned directly above form fields in standard crisp sans-serif font with explicit help text indicators.
* **Status Badge Styling:** Rounded pill shapes with solid or outlined indicators:
  * Green: `Accepted`, `Delivered`
  * Yellow/Amber: `Pending`
  * Red: `Declined`
  * Blue: `Open`
  * Gray: `Dropped`
* **Button Hierarchy:**
  * Primary Action: Solid blue (`Send Emails`, `Review`) or bright green (`Send <N> emails`).
  * Secondary Action: Outline/Bordered grey buttons (`Cancel`, `<- Back`).
  * Table Bulk Actions: Action bar popping up top-left above tables upon item selection.