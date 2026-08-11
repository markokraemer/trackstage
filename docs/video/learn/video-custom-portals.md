# Custom portals

*Source: https://learn.sessionboard.com/videos/video-custom-portals — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

Here is the chronological breakdown and technical specifications for Sessionboard's "Custom Portals" feature.

---

### Chronological Walkthrough

**[00:00]**  
**NARRATION:** Welcome to Sessionboard. In this tutorial, we'll walk you through how to create custom portals to segment contacts and groups within your event.  
**SCREEN:** *(Title screen showing Sessionboard logo and text "CUSTOM PORTALS" on dark blue gradient background).*

**[00:08]**  
**NARRATION:** Portals are customizable online interfaces that allow your event contacts, such as speakers, exhibitors, or session owners, to complete tasks, submit information, and access important event details in a centralized location.  
**SCREEN:** *(Participant View: Top bar with logo and nav (`Home`, `Sessions`, `Profile`, `Tasks`, `Files`, `Resources`). Main dashboard card grid: `My Sessions (1)` showing accepted session badge, `My Profile` for speaker details, `Tasks (4)` listing participant action items, `Resources` with venue link, and `Files` showing presentation recording download).*

**[00:23]**  
**NARRATION:** To begin, access the Portals module from the left side of your screen.  
**SCREEN:** *(Organizer Dashboard: Nav path `Content` -> `Portals` -> `Portals`. View contains header, search bar `Search portals by name...`, top-right action button `+ Create Portal`, tab bar (`People Portals (0)`, `Group Portals (1)`), informational alert banner, empty state block with button `Add Portal`, and `Default People Portal` card).*

**[00:28]**  
**NARRATION:** There are two types of portals in Sessionboard: People Portals and Group Portals.  
**SCREEN:** *(Organizer Dashboard: Highlight box focuses on tab navigation `People Portals (0)` and `Group Portals (0)`).*

**[00:34]**  
**NARRATION:** Every event includes People Portals where contacts such as speakers, moderators, chairpersons, submitters, and group representatives are assigned. Every contact is assigned a portal. If a contact is not assigned to a custom portal you create, they will automatically be assigned to the default People Portal.  
**SCREEN:** *(Organizer Dashboard: Highlight box focuses on `People Portals (0)` tab and `Default People Portal` card showing `Assigned to 1` badge).*

**[00:53]**  
**NARRATION:** Group Portals are only available when using the Sponsors or Exhibitors module. By default, all groups will be assigned to the default Sponsor or Exhibitor portal unless they are assigned to a custom portal you create.  
**SCREEN:** *(Organizer Dashboard: Cursor selects `Group Portals (0)` tab. View updates to display `Default Exhibitor Portal` and `Default Sponsor Portal` cards, both showing `Assigned to 0`).*

**[01:07]**  
**NARRATION:** To create a custom portal, select the button Create Portal.  
**SCREEN:** *(Organizer Dashboard: Cursor clicks `+ Create Portal` button at top right).*

**[01:12]**  
**NARRATION:** Within the pop-up, give your portal an internal name and select the type of portal you want to create, either People or Groups.  
**SCREEN:** *(Modal: `Add Portal`. Text input field `What is the name of your portal?` populated with `Moderators`. Type card selection: `People` (selected) and `Groups`. Clicks `Save`).*

**[01:20]**  
**NARRATION:** Next, you can determine which participants will see this portal by applying a filter. Only contacts or groups that meet the filter criteria will be assigned to the portal you're creating. Please note that admins do not manually assign contacts or groups to portals. Sessionboard automatically does this based on the filters you set.  
**SCREEN:** *(Portal Setup Wizard: Header `Moderators` with pencil edit icon. Stepper path: `1 Select participants` (active), `2 Assign items`, `3 Configuration`, `4 Appearance`. Left sidebar panel shows `Portal Filters` section with `+ Add Filter` dropdown button. Main canvas displays empty state `You haven't applied any filters yet`).*

**[01:39]**  
**NARRATION:** From the drop-down list, select a field to filter by. If you're creating a People Portal, you'll have access to all contact fields, both standard and custom, as well as contact roles such as speaker, moderator, chairperson, and submitter. Additionally, you can filter using a limited set of session fields, including track, tags, format, level, and language.  
**SCREEN:** *(Portal Setup Wizard: Dropdown menu opened under `Add filter`. Options shown: standard contact fields (`First Name`, `Last Name`, `Email`, `Company Name`, `Job Title`), custom fields (`Airline`, `Are You Flying or Driving`, `Arrival Time`), contact roles (`Chairperson`, `Speaker`, `Moderator`, `Submitter`), and session fields (`[Session] Track`, `[Session] Tags`, `[Session] Format`, `[Session] Level`, `[Session] Language`).)*

**[02:02]**  
**NARRATION:** If you're creating a Group Portal, you'll have access to all group fields, both standard and custom, as well as group types such as sponsor or exhibitor. Additionally, you can filter using a limited set of session fields, including track, tags, format, level, and language.  
**SCREEN:** *(Portal Setup Wizard (Group context): Filter menu opened showing group fields (`Name`, `Collaborator Link`, `Link`, `Reg Link`), group types (`Sponsor`, `Exhibitor`), and session fields (`[Session] Tags`, `[Session] Tracks`).)*

**[02:20]**  
**NARRATION:** When filtering by a contact role, such as moderator in this example, or a group role, you can choose to filter based on whether those contacts or groups are checked or not. You don't need to manually check off these contacts or groups yourself. This is handled automatically on the back end when a contact or group is assigned to the corresponding role. In this step, you're simply instructing Sessionboard to include anyone who has been identified as a moderator for this event.  
**SCREEN:** *(Portal Setup Wizard: Sub-dialog for `Moderator` field opens with radio toggle options `(o) is checked` and `( ) is not checked`. Clicks `Add Filter`).*

**[02:48]**  
**NARRATION:** Feel free to apply multiple filters to refine the system's search across your contacts and groups. When using more than one filter, the system will only return results that meet all the criteria applied. In this example, Sessionboard will identify all contacts who are both assigned the role of moderator and linked to a session with the track Innovation.  
**SCREEN:** *(Portal Setup Wizard: Filter stack panel updates to display two combined AND criteria chips: `"Moderator" is checked` AND `"[Session] Tracks" is Innovation`. Toggle `Portal Filters ON` displayed. Preview table updates to match criteria).*

**[03:09]**  
**NARRATION:** Once you have applied all of your portal filters, select the button Save & Customize to assign tasks, forms, file requests, and wiki pages to your portal.  
**SCREEN:** *(Portal Setup Wizard: Cursor clicks primary top-right button `Save & Customize`).*

**[03:20]**  
**NARRATION:** Please note that each contact or group can only be assigned to one portal. If a contact or group meets the criteria for multiple portals, they will be assigned to the first portal they match with.  
**SCREEN:** *(Organizer Dashboard: Returned to Portals list view. Blue alert box highlights priority hierarchy evaluation rule).*

**[03:32]**  
**NARRATION:** To change the order in which portals are evaluated, click the pencil icon and drag and drop the portals into your preferred sequence.  
**SCREEN:** *(Organizer Dashboard: Pencil reorder icon clicked, activating drag handle UI. User drags `Speakers` portal card above `Moderators` portal card. Clicks `Save Changes`. Pop-up dialog `Confirm Portal Reorder` confirmed by clicking `Save`. System displays toast alert: `Preferences Saved. Refreshing counts...`).*

**[03:45]**  
**NARRATION:** If you have any questions, feel free to reach out to our support team. Thank you for choosing Sessionboard.  
**SCREEN:** *(Organizer Dashboard: Final list screen showing reordered portal evaluation priority).*

**[03:53]**  
**NARRATION:** [Music]  
**SCREEN:** *(Sessionboard closing logo animation).*

---

### A. SCREEN INVENTORY

1. **Participant Portal Dashboard View**
   - **Purpose:** Front-end workspace for assigned event contacts.
   - **Components:** Top nav (`Home`, `Sessions`, `Profile`, `Tasks`, `Files`, `Resources`), session status card (`My Sessions`), profile widget (`My Profile`), task completion checklist (`My Tasks`), resource links (`Resources`), and media download list (`Files`).

2. **Organizer Portals List View**
   - **Purpose:** Central management panel for defining and ordering portal priority.
   - **Components:** Left navigation sidebar, header title/subtitle, search input `Search portals by name...`, button `+ Create Portal`, reorder pencil icon button, tabs (`People Portals (N)`, `Group Portals (N)`), informational alert banner, custom portal cards, and default portal fallback cards (`Default People Portal`, `Default Exhibitor Portal`, `Default Sponsor Portal`).

3. **Add Portal Modal**
   - **Purpose:** Initial creation step for naming and classifying a new portal.
   - **Components:** Text input field `What is the name of your portal?`, radio card options (`People`, `Groups`), primary button `Save`, secondary button `Cancel`.

4. **Portal Setup Wizard (Step 1: Select Participants)**
   - **Purpose:** Rule-builder view to set dynamic target criteria for portal assignment.
   - **Components:** Nav controls (`< Back`, `Save & Customize`), step sequence indicator (`1 Select participants`, `2 Assign items`, `3 Configuration`, `4 Appearance`), left filter drawer (`Portal Filters`, toggle `ON/OFF`, button `+ Add Filter`, rule chip panel), and preview grid canvas with empty state message.

5. **Confirm Portal Reorder Modal**
   - **Purpose:** Dialogue prompt to confirm changes to portal evaluation sequence.
   - **Components:** Title `Confirm Portal Reorder`, warning text body, primary button `Save`, secondary button `Cancel`.

---

### B. FEATURE / CAPABILITY LIST

- **Dynamic Rule-Based Assignment:** Automated back-end contact/group evaluation based on filter criteria (eliminates manual portal tagging).
- **Portal Categorization:** Distinct portal models for individuals (`People Portals`) versus corporate entities (`Group Portals`).
- **Default Fallback Logic:** Pre-configured catch-all portals that automatically ingest contacts/groups matching zero custom portal rules.
- **Priority Cascade Ordering:** Strict top-to-bottom evaluation order where the first matching portal rule claims participant assignment.
- **Drag-and-Drop Reordering:** Interactive reordering mode allowing admins to modify evaluation hierarchy with confirmation dialogs and real-time count recalculation.
- **Multi-Filter Combination:** AND-based multi-condition logic targeting standard contact attributes, custom profile fields, role flags (`Speaker`, `Moderator`, `Chairperson`, `Submitter`), group parameters, and session metadata (`Track`, `Tags`, `Format`, `Level`, `Language`).
- **Targeted Content Association:** Capability to selectively deliver tasks, custom forms, file upload requests, and wiki pages based on assigned portal.

---

### C. DATA MODEL SIGNALS

- **Portal Entity:**
  - `id`, `name`, `type` (`People` | `Group`), `priority_order` (integer), `is_default` (boolean).
  - Associated filter definitions list.
  - Mapped content items: `Tasks`, `Forms`, `File Requests`, `Resources`.
- **Contact Roles (Boolean Flags):**
  - `is_speaker`, `is_moderator`, `is_chairperson`, `is_submitter`.
- **Group Roles / Types:**
  - `is_sponsor`, `is_exhibitor`.
- **Session Properties (Filter Matrix):**
  - `track`, `tags`, `format`, `level`, `language`.
- **User / Contact Schema Attributes:**
  - Standard: `first_name`, `last_name`, `email`, `company_name`, `job_title`.
  - Custom attributes: `airline`, `transportation_mode`, `arrival_time`.

---

### D. ORGANIZER vs PARTICIPANT

- **Organizer Workspace:**
  - Portal entity setup and type selection (`People` vs `Groups`).
  - Filter logic definition and precedence stack management.
  - Reordering priority sequences and confirming reorder execution.
  - Mapping portal-specific resources, forms, file dropboxes, and task lists.
- **Participant Workspace:**
  - Dynamic personalized portal view displaying mapped event assets.
  - Reviewing linked session assignments (`My Sessions`).
  - Executing assigned forms and checklist items (`My Tasks`).
  - Accessing designated media downloads and wiki documentation (`Files`, `Resources`).

---

### E. UX/UI CRAFT NOTES

- **Layout Structure:** Persistent left navigation sidebar, top-aligned horizontal breadcrumb builder (`1 -> 2 -> 3 -> 4`), and two-column wizard layout (filter control drawer on left, preview table on right).
- **Button Hierarchy:** Solid blue primary actions (`+ Create Portal`, `Save & Customize`), white secondary outlines (`Cancel`), icon-only action triggers (pencil reorder icon).
- **Filter Chip Design:** Vertical stack of defined rules inside card containers showing full field path and match operator (`"Moderator" is checked`, `"[Session] Tracks" is Innovation`).
- **System Messaging:** Prominent warning banners explaining precedence logic, modal prompts before applying order changes, and bottom-left confirmation toasts (`Preferences Saved. Refreshing counts...`).
- **Visual Stylings:** Pill-shaped status badges, rounded card containers with light grey borders, and clear progress iconography.