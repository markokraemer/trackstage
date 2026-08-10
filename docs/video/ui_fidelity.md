Here is the visual and UI/UX documentation for recreating the Sessionboard platform based on the video analysis.

---

### A. Layout Geometry & Structure

* **Sidebar Navigation [02:34]**:
  * **Width**: ~240px fixed width, light gray background (`#F8F9FA`).
  * **App-Level Switcher**: Top primary group (Dashboard, Program, CRM, Marketing, CMS, Studio, History, Settings).
  * **Contextual Navigation (Program)**: Sub-grouped into *Overview*, *Submissions* (View All, Abstracts, Sessions), *Collect & Review* (Forms, Evaluation, Agenda, Site, Reports), and *Configure*.
* **Header Bar [02:34]**:
  * Left: Active Event Switcher (e.g., "AI Engineer Sandbox Event - NYC"), start/end date range.
  * Center/Right: "View Portal" outline button, user avatar/profile menu.
* **Content Container & Padding**:
  * **Max-Width**: Full fluid width with `24px` outer container padding.
  * **Structure**: White card containers (`#FFFFFF`) with subtle border shadow on light background.
* **Form Field Alignment**:
  * **Labels**: Stacked directly above input fields.
  * **Primary Actions**: Top-right corner of page headers or sticky bottom-right bar in multi-step flows.

---

### B. Form Builder Deep Dive [04:26–05:57]

```
Wizard Steps: 
[1. Submission Setup] -> [2. Welcome Screen] -> [3. Abstract Information] -> [4. Participant Information] -> [5. Payments & Fees] -> [6. Form Settings] -> [7. Notifications]
```

#### Step Breakdown & Fields:
1. **Submission Setup [04:33]**:
   * Selection Cards: `Abstracts` (Collect abstract submissions) vs `Sessions` (Full proposals).
2. **Welcome Screen [04:39]**:
   * Fields: `Internal Form Name*`, `External Form Title*`, `Page Heading*`, `Welcome Message` (WYSIWYG editor with `Show message` toggle).
3. **Abstract Information [04:41]**:
   * Fields: `Section Title*`, `Page Heading*`, `Description & Instructions*`.
   * Form Questions Table:
     * `Title` (Locked, Required toggle on)
     * `Description` (WYSIWYG, Required toggle on)
     * `Format`, `Tags`, `Track`, `Level`, `Language` (Dropdowns, each with **Required** and **Enabled** toggles).
4. **Participant Information [04:47]**:
   * Participant Roles Config:
     * `Speaker` role (Min/Max inputs: e.g., set `2` to `4`), `Send submission confirmation email` toggle.
     * `Chairperson`, `Moderator` toggles.
   * Participant Form Questions:
     * `First Name` (Locked, Required)
     * `Last Name` (Locked, Required)
     * `Email` (Locked, Required)
     * `Mobile Phone` (Pencil edit opens side drawer: *Custom Label*, *Help Text*, *Phone Input Type* US/International)
     * `Biography` (WYSIWYG editor)
5. **Payments & Fees [05:15]**:
   * Options: `Do Not Collect Payment` (Selected), `Upon Submission`.
6. **Form Settings [05:19]**:
   * Deadlines: `Close Date` datepicker (Calendar grid modal with month dropdown).
   * Toggles & Labels:
     * `Send Reminder Email`
     * `Set Submission Limit` (Input: `X sessions per user for this form`)
     * `Allow multiple draft submissions`
     * `Auto-redirect to speaker portal`
     * `Customize the success page message`
7. **Notifications [05:37]**:
   * Select Dropdowns:
     * `What admins should be notified when a new submission is received?`
     * `What admins should be notified when an existing submission is updated?`

---

### C. Public Submission Flow [05:58–06:54]

* **Step Tracker Design [06:00]**:
  * Top horizontal bar showing progress circles & text:
    `[1. Welcome!] -> [2. Account] -> [3. Submission] -> [4. Participant] -> [5. Review]`
* **Step Fields in Sequence**:
  * **Step 1 (Welcome)**: Event Call for Speakers description, public guidelines, `Continue` button.
  * **Step 2 (Account)**: `Your Email Address*`, Password prompt / login.
  * **Step 3 (Submission)**: `Title*`, `Description*` (WYSIWYG), `Format*`, `Tags*`, `Track*`, `Level*`, `Language*`.
  * **Step 4 (Participant)**: Dynamic role sections (Participant 1 of X). First Name, Last Name, Email, Mobile Phone, Biography.
  * **Step 5 (Review)**: Summary card of all entries. `Back`, `Save as Draft`, `Submit` buttons.
* **Validation Behavior [06:29]**:
  * Triggers sticky red alert toast in bottom right: `"Missing required fields. Complete the highlighted fields below."`
  * Outlines invalid fields in dark red stroke with error text below input.
* **Success Screen [06:46]**:
  * Heading: `"Thank you for submitting to present at our event!"`
  * Body: Explanation of confirmation email and portal link.
  * Primary Button: `Continue to portal ->` (Blue pill button).

---

### D. Agenda, Evaluation & Embeds [07:42–08:46]

* **Agenda Module [08:10]**:
  * **View Tabs**: `List`, `Day`, `Week`, `Month`, `Rooms`, `Conflicts`.
  * **Calendar Grid**: Vertical time axis (hourly blocks: 8:00 AM, 9:00 AM...), horizontal room/track columns (e.g., `Room A`).
  * **Session Card**: Blue rounded rectangle showing Track tag badge, Session Title, Room location, and speaker names.
* **Evaluation Summary [07:42]**:
  * **Tabs**: `Summary`, `Evaluation Plans`, `My Evaluations`, `Evaluators`, `Evaluator Tags`.
  * **Metric Cards**: Total Evaluations, Evaluated Submissions, Evaluation Plans, Evaluators, Average Submission Score.
* **CMS Embed Preview Drawer [08:33]**:
  * Split-pane layout: Left pane config controls (`Name`, `Style Options`, `Filters`, `Field Options`), Right pane live interactive browser preview showing embedded dark/light calendar feed.

---

### E. Usability Cues & Presenter Friction Points

* **Performance Bottleneck [03:49, 07:20]**: Page/drawer load transitions took 2–4 seconds, causing presenter to remark on slowness ("God, this is so slow").
* **Navigation Confusion [04:00–04:26]**: Presenter struggled to find form creation under *Submissions* tab; expected it in the top menu, but found it tucked under `Program -> Collect & Review -> Forms`.
* **Validation Trap [06:36–06:51]**: Presenter mistakenly set minimum speaker requirement to `2` during form build, blocking his own test submission until he added a dummy second speaker.
* **Role/Permission Friction [06:08]**: Public form forced full password login instead of guest pass/magic link submission.

---

### F. Micro-Style System

* **Buttons**:
  * **Primary**: Dark Solid Blue (`#2563EB` / `#1D4ED8`), rounded edges (radius `6px`), white text.
  * **Outline/Secondary**: White background with light gray border (`#D1D5DB`), dark text.
  * **Ghost**: Plain text buttons for table inline actions.
* **Status Badges**:
  * `Pending`: Yellow fill (`#FEF3C7`), dark orange text (`#92400E`), rounded pill.
  * `Accepted`: Green fill (`#D1FAE5`), dark green text (`#065F46`).
  * `Enabled`: Mint green pill badge.
* **Table Density**: Compact row padding (`8px` vertical), light gray dividing lines, hover row background highlight (`#F9FAFB`).
* **Icons**: Standard line icons (Feather/Lucide style: edit pencil, trash, calendar, checkmark, chevron down).
* **Typography**: Clean sans-serif (Inter style), medium weight (`500`) for input labels, bold (`700`) for headers.