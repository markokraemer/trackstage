### 1. Strategy & Scope Exclusion

1. **[00:43] EXPLICIT-REQUIREMENT**: Replace Sessionboard ($40k+/yr) with an open-source clone.
   * *Requirement*: Provide core CFP, evaluation, speaker portal, and agenda features without high enterprise SaaS pricing.
2. **[01:38] SCOPE-EXCLUSION**: Speaker CRM & Sponsor Pipeline modules.
   * *Requirement*: Omit extensive CRM functionality from initial target scope.
3. **[01:42] SCOPE-EXCLUSION**: Marketing suite (Media Library, Transcriptions, Content Repurposing).
   * *Requirement*: Omit marketing content repurposing tools from target scope.
4. **[01:43] SCOPE-EXCLUSION**: Complex CMS page builder.
   * *Requirement*: Omit full CMS site building; focus only on embeddable components.
5. **[02:07] EXPLICIT-REQUIREMENT**: Primary focus on the "Program" suite.
   * *Requirement*: Clone CFP submissions, review workflows, evaluation management, agenda planning, and speaker portals.

---

### 2. Event Settings & Configuration

6. **[02:43] SHOWN-IN-PRODUCT**: Event Details configuration page.
   * *Requirement*: Form fields for Event Name, Event Slug, Event Type, Website URL, Location, Timezone, and Start/End Dates.
7. **[02:46] SHOWN-IN-PRODUCT**: Exhibitors & Sponsors toggles.
   * *Requirement*: Toggles to enable or disable sponsor/exhibitor portal management.
8. **[02:50] SHOWN-IN-PRODUCT**: Image Settings.
   * *Requirement*: Image upload inputs for Logo (300x300) and Background Image (1500x500).
9. **[02:54] SHOWN-IN-PRODUCT**: Settings Sidebar Navigation.
   * *Requirement*: Navigation menu for Event Details, Record Settings, Portals, Submission Forms, Email Templates, Email Themes, and Integrations.
10. **[03:00] SHOWN-IN-PRODUCT**: Email Templates table.
    * *Requirement*: List automated email triggers (Accept, Decline, Reminders) with columns for Name, Subject, Category, Type, and Trigger.
11. **[03:04] SHOWN-IN-PRODUCT**: Custom HTML & CSS Email Header/Footer editor.
    * *Requirement*: Code input field to inject custom HTML/CSS styles into outbound platform emails.

---

### 3. Admin Dashboard & Metrics

12. **[03:11] SHOWN-IN-PRODUCT**: Main Dashboard Top Metrics Bar.
    * *Requirement*: Display live count metrics for Submissions, Accepted Speakers, Exhibitors, and Sponsors.
13. **[03:15] SHOWN-IN-PRODUCT**: Submission Status summary counters.
    * *Requirement*: Status breakdown badges for Accepted, Pending, Declined, Drafts, and Withdrawn.
14. **[03:17] SHOWN-IN-PRODUCT**: Submission Pacing Chart.
    * *Requirement*: Time-series line graph tracking submission volume relative to event date countdown (T-minus days).
15. **[03:20] SHOWN-IN-PRODUCT**: Active Forms progress widget.
    * *Requirement*: Quick-view card showing active submission forms, total entries, status, and direct edit buttons.

---

### 4. Submissions & Abstracts Management Table

16. **[03:24] SHOWN-IN-PRODUCT**: Program View Switcher.
    * *Requirement*: Tab/menu controls to switch between "All Submissions", "Abstracts", and "Sessions".
17. **[03:29] SHOWN-IN-PRODUCT**: Main Submissions Data Table.
    * *Requirement*: Data table with columns: Status, Source, Title, Client Session ID, Description, Starts At, Ends At, Notified, and Rating.
18. **[03:35] SHOWN-IN-PRODUCT**: "Add Abstract / Submission" slide-out panel.
    * *Requirement*: Side drawer form to manually insert submission details into the database.
19. **[03:39] SHOWN-IN-PRODUCT**: Submission Status filter tabs.
    * *Requirement*: Quick filter chips across top: All, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, Drafts.
20. **[03:56] SHOWN-IN-PRODUCT**: Options / Export menu.
    * *Requirement*: Actions dropdown containing Import Sessions, Export CSV, Export XLSX, and Download Files Bundle.
21. **[04:11] OFFHAND-PREFERENCE**: High UI response speed.
    * *Requirement*: Speaker notes Sessionboard feels slow; clone must prioritize fast table loads and swift transitions.

---

### 5. Submission Form Builder (Admin)

22. **[04:31] EXPLICIT-REQUIREMENT**: Custom CFP Form Builder.
    * *Requirement*: Visual multi-step form builder supporting custom questions and logic.
23. **[04:34] SHOWN-IN-PRODUCT**: Submission Type selector.
    * *Requirement*: Option to configure form for "Abstracts" (pre-review proposals) or "Sessions" (confirmed proposals).
24. **[04:40] SHOWN-IN-PRODUCT**: Welcome Screen step setup.
    * *Requirement*: Inputs for Internal Name, External Title, Page Heading, Welcome Message rich text, and Call for Speakers details.
25. **[04:41] SHOWN-IN-PRODUCT**: Abstract Information & Form Questions builder.
    * *Requirement*: Configurable default fields (Title, Description, Format, Tags, Track, Level, Language) with required toggles.
26. **[04:48] SHOWN-IN-PRODUCT**: Participant Roles configuration.
    * *Requirement*: Define accepted submitter roles (Speaker, Chairperson, Moderator) with min/max count constraints.
27. **[04:55] OFFHAND-PREFERENCE**: Flexible minimum speaker requirement.
    * *Requirement*: Speaker complained about strict min speaker limits; clone should default to min 1 and allow easy adjustments.
28. **[04:58] SHOWN-IN-PRODUCT**: Participant Contact Fields setup.
    * *Requirement*: Default profile inputs for First Name, Last Name, Email, Mobile Phone, and Biography.
29. **[05:06] SHOWN-IN-PRODUCT**: Field Customization Modal.
    * *Requirement*: Dialog to set Custom Field Label, Help Text, Character Limits, and Input Type (e.g. US/International phone format).
30. **[05:15] SCOPE-EXCLUSION**: Form Payments & Fees step.
    * *Requirement*: Skip build of submission payment gateways or fee structures.
31. **[05:20] SHOWN-IN-PRODUCT**: Form Deadlines & Submission Capacity settings.
    * *Requirement*: Date picker for Close Date, automated reminder trigger checkbox, per-user submission limit setting, and draft toggles.
32. **[05:32] SHOWN-IN-PRODUCT**: Custom Confirmation Page & Auto-Redirect settings.
    * *Requirement*: Editable post-submission message text and optional auto-redirect toggle to the speaker portal.
33. **[05:35] SHOWN-IN-PRODUCT**: Multi-language switch toggle.
    * *Requirement*: Feature toggle enabling public form submitters to translate form prompts.
34. **[05:38] SHOWN-IN-PRODUCT**: Admin Notification Recipient picker.
    * *Requirement*: Multi-select user dropdown determining which team admins receive email notifications upon new submissions.

---

### 6. Public Submission Flow (Speaker View)

35. **[06:00] SHOWN-IN-PRODUCT**: Public CFP Header Banner.
    * *Requirement*: Banner displaying event title, submission deadline date, and remaining user submission allocation.
36. **[06:06] SHOWN-IN-PRODUCT**: Public Step Progress Tracker.
    * *Requirement*: Visual horizontal indicator tracking progress: Welcome -> Account -> Submission -> Participant -> Review.
37. **[06:07] SHOWN-IN-PRODUCT**: Submitter Account Gate.
    * *Requirement*: Email lookup screen routing submitter to password authentication or sign-up.
38. **[06:18] SHOWN-IN-PRODUCT**: Proposal Details submission form.
    * *Requirement*: Input form with Title, Rich Text Description, Format dropdown, Tag select, Track select, Level select, and Language select.
39. **[06:27] SHOWN-IN-PRODUCT**: Form action controls.
    * *Requirement*: "Save as draft", "Back", and "Next step" navigation controls on submitter forms.
40. **[06:30] SHOWN-IN-PRODUCT**: Co-Participant/Speaker Entry screen.
    * *Requirement*: Dynamic form allowing submitters to add co-speakers, set roles, and enter contact details/bios.
41. **[06:43] SHOWN-IN-PRODUCT**: Submission Review step.
    * *Requirement*: Read-only summary screen of all entered abstract and speaker data prior to final submission.
42. **[06:46] SHOWN-IN-PRODUCT**: Submission Confirmation screen.
    * *Requirement*: Thank-you confirmation screen displaying next steps and a button redirecting to the Speaker Portal.

---

### 7. Speaker Portal

43. **[06:55] EXPLICIT-REQUIREMENT**: Self-Service Speaker Portal.
    * *Requirement*: Dedicated portal for submitters to review status, edit proposals, and complete assigned organizer tasks.
44. **[06:56] SHOWN-IN-PRODUCT**: Portal Navigation Bar.
    * *Requirement*: Top tabs for Home, Submissions, Profile, and Tasks.
45. **[06:57] SHOWN-IN-PRODUCT**: "My Submissions" widget.
    * *Requirement*: List cards showing proposal titles, talk formats, and current review status badges (Pending, Accepted, Declined).
46. **[07:00] SHOWN-IN-PRODUCT**: Speaker Tasks widget.
    * *Requirement*: Action item checklist displaying pending tasks (e.g. upload headshot, sign speaker agreement).
47. **[07:23] SHOWN-IN-PRODUCT**: Submission Detail drawer.
    * *Requirement*: Slide-out panel displaying full submitted proposal details and associated co-speakers.
48. **[07:27] EXPLICIT-REQUIREMENT**: Speaker Profile Management page.
    * *Requirement*: Profile editing interface for Biography, Headshot, Title, Company, Phone, and Social Links (LinkedIn, Twitter/X, Facebook, Website).

---

### 8. Abstract Evaluations & Reviewer Workflow

49. **[07:42] EXPLICIT-REQUIREMENT**: Abstract Evaluation System.
    * *Requirement*: Committee review workflow to assign, score, and grade incoming abstract submissions.
50. **[07:48] SHOWN-IN-PRODUCT**: Evaluation Summary Dashboard.
    * *Requirement*: Metrics showing Total Evaluations, Evaluated Submissions, Evaluation Plans, Evaluators, Completion Status chart, and Avg Score.
51. **[07:51] SHOWN-IN-PRODUCT**: Evaluation Plans management tab.
    * *Requirement*: Interface to create multi-round review plans, assign submission pools, and establish review deadlines.
52. **[08:02] SHOWN-IN-PRODUCT**: Evaluators List table.
    * *Requirement*: Directory displaying Evaluator Name, Status, Assigned Rounds, Completed Progress, and Conflicts tab.
53. **[08:08] SHOWN-IN-PRODUCT**: Evaluator Tags tab.
    * *Requirement*: Tagging system to categorize reviewers by expertise for automated routing and filtered assignments.
54. **[09:20] SCOPE-EXCLUSION**: AI Evaluator Automated Scoring.
    * *Requirement*: Speaker explicitly disclaims need for AI reviewer agent features; do not prioritize.

---

### 9. Agenda & Schedule Builder

55. **[08:10] EXPLICIT-REQUIREMENT**: Agenda Schedule Builder.
    * *Requirement*: Drag-and-drop schedule planner to assign accepted sessions into timeslots and rooms.
56. **[08:15] SHOWN-IN-PRODUCT**: Agenda View Modes.
    * *Requirement*: View toggle buttons for List, Day, Week, Month, Rooms, and Conflicts.
57. **[08:17] SHOWN-IN-PRODUCT**: Manual "Add Session" modal.
    * *Requirement*: Modal form to insert custom sessions directly onto the agenda schedule.

---

### 10. CMS & Public Schedule Embeds

58. **[08:27] EXPLICIT-REQUIREMENT**: Embeddable Public Agenda Widget.
    * *Requirement*: Exportable HTML/JS script widget to display live schedules and speaker profiles on external event sites.
59. **[08:32] SHOWN-IN-PRODUCT**: Embed Generator interface.
    * *Requirement*: Configurator drawer providing embed snippet code, filter options, and style customization controls.
60. **[08:37] SHOWN-IN-PRODUCT**: Public Agenda Embed Preview.
    * *Requirement*: Rendered schedule preview displaying date tabs, color-coded track tags, room labels, talk cards, speaker popups, and "Add to Calendar" buttons.