Here is the complete reference document for cloning Sessionboard, based on the video walkthrough.

---

# Chronological Walkthrough & Visual Log

### [00:00 - 00:50]
**TRANSCRIPT**  
"Okay, hi. Thanks for setting up for this crazy experiment. We are being... I think a lot of us are interested in building software that people want to pay money for, but also don't really know the extent to which they can build. And I think a time-scoped thing like this exercise or this game and this competition would be really interesting, and we are a real customer. The reason I'm not being public is to honestly just preserve their privacy. But I think this will be a fun exercise, and genuinely we are looking at paying $40,000 for this software, which I'll show you. You can go to sessionboard.com."

*(SCREEN: Browser open to `https://www.sessionboard.com`. Header nav: Logo, Products dropdown, Platform dropdown, Resources dropdown, Pricing, Log in button, Request a demo button [blue primary]. Hero text: "ONE platform for speakers, sessions and content management." Subtext with "Explore the platform" and "Request a demo" buttons. Graphic showing Sessionboard UI preview below headline.)*

---

### [00:50 - 01:48]
**TRANSCRIPT**  
"This is the rough spec which I'm going to send to you guys of what we are actually using. So it is not all the features that we are looking to clone. We want the sort of program submission, you know, I run a conference and we get a lot of submissions for speakers and, you know, people want to apply, we have to evaluate them and put them on the schedule and communicate with them and make them show up and all these things."

*(SCREEN: Presenter switches tab to Google Doc titled "Kill My SaaS 1 - Google Docs". Brief title: "High Level Brief - We are looking to replace Sessionboard, which costs >$40k a year." Lists bulleted primary draws: Custom call-for-papers submission forms, self-service speaker portal, automated email communications, evaluation and scoring workflows, drag-and-drop schedule/agenda builder, native integration with Accelerate, embeddable schedule/speaker widgets, real-time dashboard. Presenter switches back to `sessionboard.com` tab and scrolls down.)*

---

### [01:48 - 02:34]
**TRANSCRIPT**  
"Sessionboard is a type of software in the industry which people pay anywhere between $500 to $200,000 a year or per event to do these things. Sessionboard seems very comprehensive. There are other competitor platforms like Sessionize that only do the program, but Sessionboard also does CRM, marketing, CMS which delivers content to your things. So you can also check this yourself. We are probably only going to use the program side of these things and we're probably not really using the marketing side, not really using the CRM side."

*(SCREEN: Presenter switches tab to `ai.engineer/nyc2026`. Scrolls past event header, venue details ("Sheraton New York Times Square Hotel"), and role charts to section "SPEAK AT AIE NYC 2026 - Call for Speakers". Shows Key Dates, Stage Talk / Workshop / Lightning Talk format details, and "Submit Your Proposal" button. Presenter returns to `sessionboard.com`, scrolls to footer showing product matrix columns: Program [Call for Papers, Portals, Abstract Management, Digital Posters, Awards, AI Evaluators, Agenda, Speaker Management, Content Management], CRM, Marketing, CMS, Platform.)*

---

### [02:34 - 03:11]
**TRANSCRIPT**  
"We're just going to pay attention to the program side. The main idea, the thing that you should set up with, it should look roughly like this. You should probably have some settings where you can set up the event details, some basic stuff here. I assume that you can pause if you want to manage this kind of thing, all good, right? And we'll give you a walkthrough if you want, but it doesn't really matter as long as you fulfill the main core functionality that we describe in the Google Doc."

*(SCREEN: Presenter switches tab to Sessionboard Admin Portal at `app2.sessionboard.com/event/8703/sessions/submissions`. Navigation sidebar on left: Top workspace dropdown "AI Engineer Sandbox Event - NYC", Dashboard, Program, CRM, Marketing, CMS, Reports, Studio, History, Event Team, Preview, Settings. Presenter clicks Settings -> Event Details (`/settings/details`). Page fields: Event Name ("AI Engineer Sandbox Event - NYC"), Event Slug, Event Type ("Conference"), Event Website URL, Time Zone, Starts At, Ends At, Theme description box, Exhibitors & Sponsors toggles, Image Settings [Logo Image, Background Image] with blue "Upload new" buttons.)*

---

### [03:11 - 04:28]
**TRANSCRIPT**  
"So let's talk about the Google Doc. We're looking at the program, and this is like a little dashboard thing. The main life cycle is that you have submissions, which can either be abstracts (applications to speak) or sessions (people guaranteed to speak, e.g. sponsors). And you can set up some kind of abstract session here. I have already set up this series of abstracts. Part of this I also don't love is that it's kind of slow. Here you can enter in manually, or you can look for the submission functionality, which I can't really tell where it is. But this slowness is part of why I think you guys can probably do a better job than Sessionboard."

*(SCREEN: Clicks Dashboard (`/dashboard`). Header displays "Good evening, Sw" with sub-tabs: Today, Review Progress, Speaker Tracking, Submissions Pipeline. Top row stat widgets: Accepted Speakers (0), Exhibitors (0), Sponsors (0). Submission Status bar: Submissions (3), Pending (3), Accepted (0), Declined (0). Submission Pacing graph over time. Submissions list cards at bottom. Presenter clicks Program -> View All (`/sessions/submissions`), then Program -> Abstracts (`/sessions/abstracts`). Page shows top sub-tabs: All Abstracts, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, Drafts. Click "+ Add Abstract" blue button top right -> opens right side drawer titled "Add Abstract" with sub-tabs "Details" and "Participants" and fields: Title, Status, Description, Starts At, Ends At, Capacity, CEU Credits, Client ID, Format, Language, Level, Track, Location, Tags. Closes drawer, clicks Program -> Overview (`/program`). Page displays grid cards: Sessions, Submissions, Forms, Evaluator, Site, Settings. Clicks Forms (`/sessions/forms`). Shows list: "Session Submission Form #2" and "Submission Form".)*

---

### [04:28 - 05:15]
**TRANSCRIPT**  
"In order to create an abstract application page, you create a form. It looks like this. You want abstracts or you want sessions, you can choose down here. You have a welcome screen, blah blah, all this messaging and customization. So you have like a form builder is what you're being asked to build here. This is just a very fancy form builder, that's all it is. You have some limits in terms of the number of speakers and biography and all these things, all of which has very standard validation rules."

*(SCREEN: Clicks blue "+ Add" dropdown -> "Create Form". Navigates to Edit Session Form (`/sessions/forms/edit`). Left vertical wizard stepper: Form Setup [Submission Type, Welcome Screen, Abstract Info, Forms, Participant Info, Payments & Fees, Form Settings, Notifications]. Under Submission Type: choices for "Abstracts" (Collect abstract submissions for review before sessions are finalized), "Sessions" (Collect full session proposals), "Participants" (Include a step to collect speaker and participant contact info). Clicks "Abstract Info": form questions for Title, Description, Format, Tags, Track, Level, Language. Clicks "Participant Info": Participant roles setup (Speaker toggle, Min 2, Max 4, Send submission confirmation email toggle; Chairperson; Moderator). Form Questions below: First Name, Last Name, Email, Mobile Phone, Biography. Clicks gear icon on Mobile Phone -> opens "Edit Contact Field" modal showing field name, phone validation options [US Only vs International], and required toggle.)*

---

### [05:15 - 05:58]
**TRANSCRIPT**  
"We don't really care about payments, so you can skip this one if you're cloning it. And then you have a close date, let's just call it September 15th. Doesn't matter. You can send a reminder email, set a submission limit, multiple draft submissions, thank you email, multi-language (we only care about English). You should be able to enter in admins. This one also optional. Just show us the rough format. Again, the higher fidelity, the more usefulness. You are allowed to use your own judgment as to what this is. So we created a form here, Form 3."

*(SCREEN: Clicks "Payments & Fees" step (Presenter explicitly notes to skip). Clicks "Form Settings" step: Close Date picker set to Sept 15, 2026; "Send Reminder Email" toggle; "Set Submission Limit" toggle set to 3; "Allow multiple draft submissions" toggle; "Auto-redirect to speaker portal" toggle; "Customize the success page message" rich editor text area; "Cross-field character limits"; "Languages". Clicks "Notifications" step: dropdown select for "Which admins should be notified when a new submission is received?" [selects users], Submitter notifications card, Admin notifications card. Clicks "Save" button bottom right. Returns to Forms list showing "Session Submission Form #3" with "Open" badge.)*

---

### [05:58 - 06:54]
**TRANSCRIPT**  
"And let's go and see it publicly. So this would be the public link. I'm going to show you how in Incognito we can access this, and you can submit that form. So this is the... it looks like it's asking me to use a password. I probably have a password stored, so good enough. Fill in some blanks, it has some required fields. Let's see if we can get a quick submission down here. Excellent. Excellent. Okay, excellent. Submit. That was stupid. Obviously, it should not have a minimum of two speakers, that's not something that we do."

*(SCREEN: Clicks public form link -> opens tab `app2.sessionboard.com/submit/ai-engineer-sandbox-event...`. Top progress bar: Welcome -> Account -> Submission -> Participant -> Review. Copies URL, opens Incognito browser tab. Page shows Welcome Screen text ("Welcome to our event!", "Call for Speakers", Key Dates). Clicks "Continue". Account page: prompt "Get started - Your Email Address", enters `swyx@ai.engineer`, clicks "Next". Screen updates to "Log in with your existing account", autofills password, clicks "Log In". Page loads Submission step: Title (fills "sd"), Description (fills "wdw"), Format (selects "Featured Keynote"), Tags (selects "Tag A"), Track (selects "Track 2"), Level (selects "Introductory"), Language (selects "English"). Clicks "Next step". Participant step: Participant 1 role Speaker, fills First Name ("qwd"), Last Name ("qdw"), Email (`qwd@qdhskj.com`), Phone (`+1 2404242142`), Biography ("wd"). Validation error banner appears bottom right: "Participant requirements not met - Speaker: 2-4 required | 1 added". Presenter fills Participant 2: First Name ("wd"), Last Name ("wdq"), Email (`wd22@wdkqds.com`), Phone, Bio. Clicks "Continue to review". Review step shows summary. Clicks blue "Submit" button. Thank You page displays: "Thank you for submitting to present at our event!")*

---

### [06:54 - 07:40]
**TRANSCRIPT**  
"So now once you have a login, you can actually see your login if you're a speaker, and your tasks. And this IS an important part of it—whether or not you have been accepted or not, I think that's a key part, as well as once you've been accepted, what tasks do you have to complete? That also is kind of optional, but it is very, very handy for people using this. So, oh my god, this is so slow. Okay. You can see the session we just submitted down here with the two speakers, as well as you being able to update your own biography. This is a very important part of the overall submissions."

*(SCREEN: On confirmation page, clicks blue "Continue to portal" button -> opens Speaker Portal at `app2.sessionboard.com/portals/ai-engineer-sandbox-event...`. Top navigation banner: Home, Submissions, Profile, Tasks. User menu top right ("Sw yx"). Home tab content: "My Submissions (2)" card listing "SESS-4 - sd" [Featured Keynote, Pending badge] and "SESS-3 - jkj" [Keynote, Pending badge]; "My Profile" card; "Tasks" card. Presenter clicks "Submissions" tab, clicks "SESS-4 - sd" -> opens right side drawer displaying Details tab (Title, Description, Track, Tags) and Participants tab (listing speaker cards "qwd qdw" and "wad wdq"). Presenter clicks "Profile" tab: shows rich text Biography editor, Salutation, First Name ("Sw"), Last Name ("yx"), Honorific, Pronouns, Gender, Job Title, Company, Email, Mobile Phone, Address fields, and "My Links" sidebar (LinkedIn, X/Twitter, Facebook, Website URLs). Presenter clicks "Tasks" tab. Presenter clicks top right user dropdown -> clicks "Back to Admin Mode".)*

---

### [07:40 - 08:26]
**TRANSCRIPT**  
"So that is the bulk of it. I think there will be others, so for example if we go over to evaluations, we can create evaluation plans on the admin side or the conference committee side, and we can assign sessions to be evaluated by conference committees. So here we can say, 'All right, this team is evaluating whatever numbers of submissions.' And as an evaluator I can look through all these things. So I think that's really helpful. Once things have been evaluated, accepted, and information is put out there, then we can add the accepted sessions in here for the agenda on putting it publicly, as well as showing them or embedding them in some external environment where you can get the code."

*(SCREEN: Returns to Admin Portal (`app2.sessionboard.com`). Navigates sidebar to Program -> Evaluation (`/sessions/evaluation`). Header tabs: Summary, Evaluation Plans, My Evaluations, Evaluators, Evaluator Tags. Summary tab displays evaluation completion stats charts, Average Submission Score by Plan, Top 10 Submissions. Clicks "Evaluation Plans" tab (`/sessions/evaluation/plans`): card for "My Evaluation Plan" showing Evaluators (2), Submissions (0), Total Evals (0), Due Date. Clicks "Evaluators" tab (`/sessions/evaluation/reviewers`): table listing evaluators "Chrisy A" and "Kelsey Mohland". Navigates sidebar to Program -> Agenda (`/sessions/agenda`). Tabs: List, Day, Week, Month, Rooms, Conflicts. Table view empty. Presenter clicks "+ Add Session" blue button top right -> opens "Add Session" side drawer.)*

---

### [08:26 - 08:50]
**TRANSCRIPT**  
"And here it's roughly how it should look. It's a very standard sort of event display with everything all linked and what have you."

*(SCREEN: Navigates sidebar to CMS -> Embeds (`/cms/embeds`). List shows item "New Embed" [Styled HTML, Enabled badge]. Presenter clicks three-dots menu on card -> selects "Get Code". Right side preview drawer opens displaying interactive agenda widget titled "AIEngineer Sandbox Event - NYC". Top date bar ("Mon, October 12, 2026"). Room header columns ("Room A"). Time slot rows (8:00 AM, 9:00 AM, 10:00 AM). Session card "Test 1 Submission" [Track 1 badge, Room A]. Presenter clicks session card -> opens detail view in embed preview showing session title, time, "Add to Calendar" button, and speaker profile cards ("Beau Fabricant", "Delia Nullfield", "Ada Testerman") with headshots, names, titles, and organizations.)*

---

### [08:50 - 09:55]
**TRANSCRIPT**  
"So that is the rough idea. There's a lot in here that I'm skimming over that I think we'll have to scope out what the requirements are. I think there's a lot in this video itself that can get you started. I think as long as you roughly get the idea that we have in here with this basis, you can also use the Sessionboard website where you can look at the individual screens. It's not about the fidelity to Sessionboard, it's about filling the job to be done that fits it. I don't care about the AI workflow thing, I just care that we have an accepted industry standard tool that we have open source and we can clone it in a weekend. I think it is very doable if you're focused on it. I think having all these public bullet points gives you some idea of what it can be. I will be available to you in the Discord in order to answer any questions and probably record a more professional demo of this. Good luck!"

*(SCREEN: Presenter switches tab back to Google Doc brief, then switches tab to `sessionboard.com/products/call-for-papers`. Scrolls through product marketing page highlighting features: "Smarter Tools for High-Volume Reviews", "Flexible Forms", "One Dashboard", "Reviewer Workflows", "Forms That Fit Your Program", "Add a Virtual Reviewer" (Presenter notes this AI feature is NOT needed), GDPR/Security section, and FAQ accordion. Presenter switches to `sessionboard.com/capabilities/speaker-management`. Scrolls past "Personalized Speaker Portals", "Built-in Communication", "Track Progress at a Glance", "Reuse What You Already Have". Stops recording at 09:55.)*

---

# Closing Technical Sections

## A. Complete Screen Inventory

| Screen Name | Path / Context | Purpose | Complete Component List |
| :--- | :--- | :--- | :--- |
| **Marketing Homepage** | `sessionboard.com` | Landing page & product overview | Top header navbar, hero banner, primary action buttons, feature highlights grid, module tabs (Program, CRM, Marketing, CMS), footer product matrix. |
| **Event Settings - Details** | `/settings/details` | Configure event metadata & branding | Admin sidebar, page title, text inputs (Name, Slug, Website URL), dropdowns (Type, Time Zone), date pickers (Start, End), text area (Theme description), toggle buttons (Exhibitors, Sponsors), image uploaders (Logo, Background) with preview cards and "Upload new" buttons, bottom sticky "Save" button. |
| **Admin Dashboard** | `/dashboard` | Executive overview & metrics | Sub-navigation bar, top stat widgets (Accepted Speakers, Exhibitors, Sponsors), status counter pill bar, submission pacing line chart, submission form status summary cards. |
| **Submissions / Abstracts List** | `/sessions/submissions` & `/sessions/abstracts` | Table view of all entries | Status filter tabs, search bar, top action bar (Saved Views, Columns, Sort, Filter, "+ Add Abstract" / "+ Add Submission", "Options" dropdown), data table (checkbox, status badge, source, title, client session ID, description, track, notifications), pagination footer. |
| **Add Submission / Abstract Drawer** | Side drawer on Submissions page | Manual entry form for abstract | Title input, status selector, description text area, date/time pickers, number inputs (Capacity, CEU Credits), text inputs (Client ID, Location), dropdowns (Format, Language, Level, Track), tag selector, top close button. |
| **Submission Forms List** | `/sessions/forms` | Manage CFP forms | Hero banner card, search input, status filter bar, form item cards (title, submission type badge, version badge, status badge, submission count, date, external link icon, action menu), top right "+ Add" primary button. |
| **Edit Session Form (Form Builder)** | `/sessions/forms/edit` | Multi-step form builder wizard | Left vertical step bar (Form Setup, Welcome Screen, Abstract Info, Forms, Participant Info, Payments & Fees, Form Settings, Notifications), rich text editors, drag-and-drop field list, required toggles, field settings gear icon, modal dialogs, bottom navigation buttons ("Back", "Next", "Save"). |
| **Public Submission Portal** | `/submit/[event-slug]` | Public speaker CFP workflow | Step progress indicator bar, welcome text display, email step input, authentication password screen, multi-field submission form (Title, Rich Description, Format, Tags, Track, Level, Language), participant card list with dynamic adder ("Add 1 more Speaker"), review summary step, confirmation message screen with portal redirect button. |
| **Speaker Portal - Home** | `/portals/[event-slug]` | Speaker dashboard | Header tabs (Home, Submissions, Profile, Tasks), top right user menu with "Back to Admin Mode", "My Submissions" card list with status badges, "My Profile" summary card, "Tasks" pending list card. |
| **Speaker Portal - Submissions & Detail** | `/portals/.../sessions` | View submitted entries | Submissions list, slide-over drawer with sub-tabs "Details" and "Participants", full field display, "View Submission" link. |
| **Speaker Portal - Profile** | `/portals/.../profile` | Speaker profile editor | Rich text Biography editor, personal detail grid inputs (Salutation, First/Last Name, Honorific, Pronouns, Gender, Job Title, Company, Email, Mobile, Address), "My Links" sidebar inputs (LinkedIn, X, Facebook, Website). |
| **Evaluation Summary & Plans** | `/sessions/evaluation` | Manage reviewer scoring | Top sub-tab bar (Summary, Evaluation Plans, My Evaluations, Evaluators, Evaluator Tags), completion status chart, average score widget, evaluation plan grid cards (evaluator count, submission count, total evals, due date), evaluators data table. |
| **Agenda Builder** | `/sessions/agenda` | Schedule management | View tabs (List, Day, Week, Month, Rooms, Conflicts), search & filter bar, action buttons (Columns, Sort, Filter, Drafts, Options, "+ Add Session"), schedule grid / calendar view. |
| **CMS Embeds & Code Modal** | `/cms/embeds` | Embeddable public widget builder | Embed list table, "+ Add Embed" button, action dropdown ("Get Code", "Edit", "Delete"), split-screen preview drawer containing interactive widget header, date filter bar, room columns, time slot rows, session cards, speaker profile modal. |

---

## B. Requirements & Opinions

### Requirements (Explicit & Implicit)
* **[00:50 - 01:48] Core Scope:** Focus exclusively on the **Program** module (CFP form builder, speaker portal, evaluations, agenda builder, embeddable schedule widget).
* **[04:28 - 05:15] CFP Form Builder:** Must support configurable submission types (Abstracts vs Sessions), customizable welcome screens, custom field schema (Title, Description, Format, Track, Level, Tags, Language), participant role rules (min/max count per role), close dates, and confirmation email notifications.
* **[05:58 - 06:54] Public CFP Workflow:** Publicly accessible flow without requiring prior account creation; handles email lookup/login inline, rich submission details, dynamic co-speaker fields, and immediate portal access upon submission.
* **[06:54 - 07:40] Speaker Portal:** Dedicated dashboard for speakers to track submission review status (Pending, Accepted, Declined), view submission details, complete assigned tasks, and update biography/social links.
* **[07:40 - 08:26] Evaluation Workflows:** Ability to group submissions into evaluation plans, assign reviewer committees, track completion progress, and score abstracts.
* **[08:26 - 08:50] Embeddable Agenda Widget:** Generate HTML/JS embeds providing an interactive schedule with date pickers, room columns, track badges, and speaker detail modal popups.

### Presenter Opinions & Usability Signals
* **[03:48 - 04:15] Usability Complaint (Slowness):** Presenter repeatedly complains about Sessionboard’s slow page loads and UI latency ("Part of this I also don't love is that it's kind of slow... this slowness is part of why I think you guys can probably do a better job").
* **[04:00 - 04:25] Usability Complaint (Navigation Confusion):** Presenter gets lost trying to find where public forms are located in the sidebar hierarchy.
* **[05:15 - 05:18] Skip Signal:** Explicitly skip payment processing/fees ("We don't really care about payments, so you can skip this one").
* **[06:48 - 06:54] Usability Complaint (Form Defaults):** Mocking Sessionboard's default requiring 2+ speakers ("That was stupid. Obviously it should not have a minimum of two speakers").
* **[09:20 - 09:25] Skip Signal:** Explicitly skip AI feature sets ("I don't care about the AI workflow thing").
* **[09:15 - 09:30] Priority Signal:** Do not worry about 1:1 visual styling match ("It's not about the fidelity to Sessionboard, it's about filling the job to be done").

---

## C. UX Guidance for the Clone

### What to Keep Identical
1. **Multi-step Form Builder Stepper:** Maintain the left-hand wizard stepper pattern for creating CFP forms (Setup -> Welcome -> Abstract Info -> Participant Info -> Settings -> Notifications).
2. **Submission Drawer Context:** Keep the slide-over right drawer pattern for viewing abstract details and speaker profiles without losing table list state.
3. **Pill Filter Bar for Submissions:** Retain the top tab filter bar (`All Submissions`, `Accepted`, `Pending`, `Declined`, `Drafts`) above data tables.
4. **Embedded Agenda Layout:** Keep the exact structure of the public schedule widget (date selectors on top, room/track columns across, time slots down, click-to-open speaker modal).

### What to Simplify & Clean Up
1. **Navigation Structure:** Eliminate deep sub-menu nesting. Combine "View All", "Abstracts", "Sessions", and "Forms" under a unified "Program" section.
2. **Form Setup Defaults:** Default speaker minimum to 1 instead of 2 to avoid blocking individual speakers.
3. **Authentication Flow:** Allow magic-link or passwordless login during CFP submission so speakers aren't blocked by standard password prompts.
4. **Strip Unused Modules:** Completely remove CRM, Marketing, Media Library, Payments, and AI Evaluator tabs to keep the interface lightweight.

### Eliminating Wasted Time
* **Instant UI Feedback:** Eliminate full-page reloads and server delay by using optimistic local state updates.
* **Direct Public Form Link Access:** Provide an explicit "Copy Public Link" button directly on every form card in the main list rather than hiding it inside nested edit settings.