# Event team

*Source: https://learn.sessionboard.com/videos/video-event-team — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Video Log

**[00:00]**
- **NARRATION**: "Welcome to Sessionboard. In this quick video, we'll walk through how to add team members to your event so they can help manage content, sessions, speakers, and more."
- **SCREEN**: *(Title Screen)* Blue title slide displaying the white `SESSIONBOARD` logo with a megaphone icon and `EVENT TEAM` heading over a darkened background photo of an audience.

---

**[00:10]**
- **NARRATION**: "To get started, navigate to the Event Team module."
- **SCREEN**: *(Nav: Event Team -> Team tab)* Main Event Team screen displays:
  - **Left Sidebar**: `< Back to organization`, `Dashboard`, `Contacts`, `Exhibitors`, `Sessions`, `Applications`, `Portals`, `Library`, `Reports`, `Studio`, `History`, `Event Team` (selected), `Settings`.
  - **Top Bar**: Event context (`Sessionboard Conference`, `Jan 1 5:00 PM - Jan 2 6:00 PM (GMT-7)`), `Search...`, `View Portal`, notification icon, user profile badge (`MC`).
  - **Main View**: Title `Event Team` with description "Manage team members with access to this event". Sub-tabs: `Team` (active), `Permissions`. Search field `Search users by name or email...`, filter count pills (`View All 101`, `Event Admins 16`, `Evaluators 2`, `Portal Only Access 81`), and blue button `+ Invite User`.
  - **Table**: Columns for multi-select checkbox, `Name`, `Email`, `Permissions`, `Last Login At`, `Tags`, and actions (`...`).

---

**[00:14]**
- **NARRATION**: "Save time by importing users in bulk. To learn more, check out our data importing video. Alternatively, you can add users manually by clicking the Invite User button."
- **SCREEN**: *(Nav: Event Team -> Team tab -> + Invite User dropdown)* Clicked split dropdown on `+ Invite User` shows menu items: `Import`, `Export .CSV`, and `Export .XLSX`.

---

**[00:26]**
- **NARRATION**: "Within the pop-up modal enter the email address, first name, and last name of the person you want to add."
- **SCREEN**: *(Nav: Event Team -> + Invite User)* Modal popup opens titled `Invite User`.
  - **Form Fields**: `Email *` (placeholder: "Enter email address"), `First Name *`, `Last Name *`.

---

**[00:32]**
- **NARRATION**: "Choose the appropriate user role. Each role grants different levels of access. You can also apply tags to help categorize users if needed."
- **SCREEN**: *(Nav: Event Team -> Invite User modal)* Role selection grid under "What type of user is this? *" section featuring tiles: `Admin User`, `Admin Lite`, `Evaluator`, `Evaluator Session Manager`, `Session Manager`, `Portal User`, `Content Manager`, `Communication Manager`, `Reporting Only Admin`, `Marketing`, `Custom Role`, `DBA`, etc. Tags section below displays selectable chips (`Review Committee`, `Volunteer`, `Workshop`) and selected tag pill (`Volunteer x`).

---

**[00:43]**
- **NARRATION**: "Once all of the required fields are completed, click the blue Invite User button. The user will receive an email with instructions to join your event in Sessionboard."
- **SCREEN**: *(Nav: Event Team -> Invite User modal -> click Invite User)* Cursor clicks the blue `Invite User` primary action button in the bottom right of the modal.

---

**[00:53]**
- **NARRATION**: "To learn more about what each permission level grants access to, visit the Permissions page. Select a role from the left side of the screen to view its permission details on the right."
- **SCREEN**: *(Nav: Event Team -> Permissions tab)* Roles and Permissions interface opens:
  - **Left Pane**: List grouped under `DEFAULT ROLES` (`Admin Lite`, `Admin User`, `AV Manager`, `Communication M...`, `Content Manager`, `Evaluator`, etc.) and `CUSTOM ROLES`.
  - **Right Pane**: Header for `Admin User` showing description and sub-tabs `Permissions` and `Fields`. Search bar and accordion permission sections (`Sessions` showing `6/6` enabled toggles).

---

**[01:05]**
- **NARRATION**: "Feel free to create a custom role if a default role does not suit your event needs. Toggle settings on or off to customize the permissions for your custom role."
- **SCREEN**: *(Nav: Event Team -> Permissions tab -> Custom Role)* User selects `Custom Role` from `CUSTOM ROLES` list or clicks `+ Create new role`. Shows feature permission toggles (`Can view sessions`, `Can add sessions`, `Can update sessions`, `Can delete sessions`, `Can export sessions`, `Can manage session fields`).

---

**[01:17]**
- **NARRATION**: "You can also choose which fields this role can see or edit. This helps ensure users only interact with information that fits their responsibilities. Make sure you review the contact, session, and group fields they have access to and lock or hide as needed."
- **SCREEN**: *(Nav: Event Team -> Permissions tab -> Custom Role -> Fields tab)* Views field-level permissions matrix:
  - **Sub-tabs**: `Contact Fields`, `Session Fields`, `Group Fields`.
  - **Search & Bulk Actions**: Field search input, `Bulk Actions` dropdown (`Set All Locked`, `Set All Unlocked`).
  - **Table Columns**: `Field Name`, `Category`, `Type`, `Level`, `Visibility` (Eye icon toggle), `Lock Status` (Lock icon toggle).

---

**[01:32]**
- **NARRATION**: "You are now equipped with the resources to add users to your event team. If you have any questions, feel free to reach out to our support team. Thank you for choosing Sessionboard."
- **SCREEN**: *(Nav: Dashboard)* Redirects to `Event Dashboard` showing metric overview cards (`Session Submissions`, `Accepted Speakers`, `Exhibitors`, `Sponsors`), `Session Status` breakdown, and `Session Submission Forms` list.

---

**[01:43]**
- **SCREEN**: Animated blue outro slide with the white `SESSIONBOARD` logo.

---

### A. SCREEN INVENTORY

1. **Event Team - Team Tab (`/event-team`)**
   - **Purpose**: Manage event team access, search members, filter by access levels, import/export lists, and invite new members.
   - **Components**: Left navigation sidebar, top event contextual header, search input (`Search users by name or email...`), filter chips (`View All`, `Event Admins`, `Evaluators`, `Portal Only Access`), split action button (`+ Invite User`, `Import`, `Export .CSV`, `Export .XLSX`), user data table (`Name`, `Email`, `Permissions`, `Last Login At`, `Tags`).

2. **Invite User Modal (`/event-team?modal=invite`)**
   - **Purpose**: Modal form to add individual users and assign roles and tags.
   - **Components**: Input fields (`Email *`, `First Name *`, `Last Name *`), role selection grid tiles (`Admin User`, `Evaluator`, `Portal User`, etc.), tag selection chips (`Review Committee`, `Volunteer`, `Workshop`), footer buttons (`Cancel`, `Invite User`).

3. **Event Team - Permissions Tab (`/event-team/permissions`)**
   - **Purpose**: View, configure, and define role-based access control (RBAC) and field-level visibility/lock rules.
   - **Components**: Role sidebar list (`DEFAULT ROLES`, `CUSTOM ROLES`, `+ Create new role`), role permission configuration pane (`Permissions` tab with section accordions and toggle switches; `Fields` tab with field categories, visibility toggles, lock status toggles, and bulk action dropdowns).

4. **Event Dashboard (`/dashboard`)**
   - **Purpose**: Central hub displaying event progress metrics, submission counts, and status breakdowns.
   - **Components**: Metric counter tiles, status bar graphs, form status cards, navigation sidebar.

---

### B. FEATURE / CAPABILITY LIST

- **User Invitations & Import/Export**: Add individual team members via email; import members in bulk; export team listings to `.CSV` or `.XLSX`.
- **Predefined & Custom RBAC**: Assign predefined system roles or create custom roles with granular feature-level permission toggles (View, Add, Update, Delete, Export, Field Management).
- **Field-Level Access Control**: Grant or restrict visibility (`Visible`/`Hidden`) and editing capability (`Locked`/`Unlocked`) per role across Contact Fields, Session Fields, and Group Fields.
- **Categorization & Filtering**: Categorize team members with custom tags and filter user tables by specific access groups.

---

### C. DATA MODEL SIGNALS

- **Team Member / User**: First Name, Last Name, Email, Assigned Role, Last Login Timestamp, Tags (array of strings).
- **Role**: Role Name, Role Type (`Default` vs `Custom`), Description, Feature Permissions Map (module action flags), Field Permissions Map (Visibility & Lock states).
- **Field Mapping**: Field Name, Field Category (`Custom`, `Communication`), Field Type (`Checkbox`, `Text`), Level (`Event`, `Global`), Visibility State, Lock State.

---

### D. ORGANIZER vs PARTICIPANT

- **Organizer Side**: All team configuration, permission modeling, field-locking, user invitations, and metric dashboard views belong strictly to the Event Organizer interface.
- **Participant Side**: Users assigned restricted roles (e.g., `Portal User`, `Evaluator`) interact only with external/participant portals for reviewing assigned sessions or submitting content based on defined field access rules.

---

### E. UX/UI CRAFT NOTES

- **Layout Structure**: Persistent dark-gray left navigation sidebar (~240px wide) paired with a clean white top contextual header and light background main canvas.
- **Form Controls**: Labels positioned above inputs with red asterisk indicators for required fields. Role selection rendered as selectable grid cards rather than traditional drop-downs.
- **Tables & Modals**: Clean table density with avatar initials, subtle status pill badges, right-aligned action menus, and centered modal overlays with crisp blue primary action buttons.