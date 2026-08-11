# Sessionboard — Program > Submission Forms > Create (Form Builder) — Forensic UX/UI Spec

Source: `docs/initial-brief/images/` — image15, image35, image23, image20, image1, image27, image2, image21, image36, image9, image7.

All 11 screenshots come from the **CFP / Submission Form builder**, entered via `Program > Forms`. The builder is a **left-rail, multi-step wizard** (not a top-tab or modal wizard) titled "Edit Session Form" while editing an existing form ("Session Submission Form #4"). Two screenshots (image21, image7) carry red callout annotations from the brief author grading each panel's priority for the clone ("NOT NEEDED", "kinda impt", "make sure this works", "nice to have", "must have") — these are noted per-image and folded into the synthesis priorities.

**Important scope note:** none of these 11 images show a dedicated "conditional logic" builder screen or a "categories/routing" step. The Form Setup left-rail (captured in full across image35/23/20/1/27/2/21/36/9/7) enumerates exactly 7 steps — Submission Setup, Welcome Screen, Abstract Information, Participant Information, Payments & Fees, Form Settings, Notifications — with no separate "Logic" or "Categories" entry visible. Conditional logic in this tool appears to live **inline, per-question**, expressed via the "Locked" badge, Required toggle, and (implied but not screenshotted here) a per-field "..." overflow menu that likely opens field-level condition/visibility rules and option-level routing (e.g. the `Track`/`Tags`/`Format` dropdown fields seen in image1 are the natural place category-based routing would attach, since those are the fields evaluation/agenda routing would key off). This gap is called out explicitly in the synthesis so the eng team knows to pull additional screenshots (there are 46 total in the folder) before finalizing the logic-builder spec.

---

## image15.png — Forms list + "Create Form" entry point

**Step/screen:** Not the builder itself — this is `Program > Forms`, the list screen the builder is launched from. Included because it's the entry point ("Create") and shows the CRM-based alternate flow being promoted.

**Layout structure:**
- Standard app shell: far-left icon rail (org switcher, Dashboard, collapsible "Program" nav group), top bar (global search "Find or ask" with ⌘K, "View Portal" link button, bell icon with red unread dot, help "?", avatar "SY").
- Left nav (expanded "Program" section) groups: **SUBMISSIONS** (Overview, View All, Abstracts, Sessions, Files), **COLLECT & REVIEW** (Forms [active/highlighted], Evaluation, Agenda, Invoices, Site), **PORTALS** (Portals, Tasks, Forms, File Requests, Resources, Files), **CONFIGURE** (Settings). "CRM" as a separate top-level nav item below, collapsible.
- Main content: page header icon (chat/comment bubble in rounded square) + H1 "Submission Forms" + subtitle "Collect abstract, session and participant information for your event", right-aligned primary button "+ Add" (blue) with a chevron, open as a dropdown showing **"Create Form"** (highlighted/selected, blue background) and **"Copy from..."**. A large red hand-drawn arrow points from the "Add" button down into the dropdown, clearly an annotation calling out this as the entry point to the builder flow being documented.
- Below header: a promo/upsell banner card (light blue-gray bg) — icon (link/chain in dark rounded square) + bold "Collect submissions year-round with Speaker CRM" + pill badge "✦ NEW" + description paragraph + row of two ghost buttons: "💬 Learn more" and plain text "No commitment required — see it in action first".
- Search bar "🔍 Search forms..." full width.
- Filter tabs: "All 3" (active, blue underline), "Open 3", "Closed 0" — each with a count badge (light pill).
- Right-aligned sort control: "↕ Most Pending ⌄".
- List of form cards, each: numbered circle badge (submission count, e.g. "1", "0"), form name (bold, black), status pill ("Open" — dark navy/black bg, white text), tag pills ("Abstracts & Participants", "V2" — light gray outline pills), "..." overflow menu top-right; second row: "N submissions · N drafts [· Closes DATE]" (gray) left, "Created DATE" (gray) right.

**Components & exact labels:** "Submission Forms", "Collect abstract, session and participant information for your event", "+ Add", "Create Form", "Copy from...", "Collect submissions year-round with Speaker CRM", "NEW", "Learn more", "No commitment required — see it in action first", "Search forms...", "All 3", "Open 3", "Closed 0", "Most Pending", "Session Submission Form #2", "Session Submission Form #3", "Submission Form", "Open", "Abstracts & Participants", "V2", "submissions", "drafts", "Closes Sep 15, 2026", "Created Aug 7, 2026", "Created Aug 6, 2026".

**Visual style:** Background pale blue-gray (~#F4F6FB / #EEF1F8). Cards white (#FFFFFF) with 1px light-gray border (~#E4E7EC), radius ~12–14px, subtle shadow. Primary blue for CTA/active states ~#2563EB / #1D4ED8. Status pill "Open" is near-black navy ~#111827 with white text — deliberately high contrast, not green, to look neutral/premium rather than "traffic light." Typography: bold black/dark-slate headings (~#0F172A), gray body/meta text (~#6B7280, #94A3B8). Sidebar active item ("Forms") has a light blue pill background. Generous padding (~24px card padding, ~16px vertical rhythm between list items).

**Interactions implied:** Clicking "+ Add" opens dropdown → "Create Form" launches the wizard (the flow documented below) at Submission Setup; "Copy from..." presumably opens a picker to clone an existing form/template. Tabs filter list by status. Card "..." opens per-form actions (edit/duplicate/close/delete, inferred). Whole card row is likely clickable to open editor.

---

## image35.png — Step 1: Submission Setup

**Step/screen:** `Edit Session Form` wizard, Step 1 of 7 — **Submission Setup**.

**Layout structure:** Three-column layout inside the main panel:
1. App left nav (same as image15, "Forms" highlighted).
2. **Wizard sidebar** (second column, ~280px, light gray bg, bordered right): "← Back to forms" link at top, then a section label "FORM SETUP" (uppercase, small, gray) followed by a vertical list of 7 step items, each with icon + title + one-line description. Current step is rendered as a solid dark/near-black rounded card (active state) with white icon+text; other steps are plain rows with muted gray icon+text (locked/not-yet-visited styling — lighter opacity than visited-but-inactive steps in later screenshots).
3. **Main content panel** (white, bordered, rounded ~16px): a light gray "page intro" card at top with bold H2 title + gray subtitle (this pattern repeats on every step: title card mirrors the sidebar item's title+description), then the actual step content below.

**Page header (outside the 3-col body, spans full width):** "Edit Session Form" (H1, bold) / "Session Submission Form #4" (subtitle, gray) on the left; right-aligned button row: "↗ View Form" (ghost/outline), "⧉ Copy Link" (ghost/outline), "💾 Save" (solid blue, primary).

**Step content — Submission Setup:**
- Intro card: **"Submission Setup"** / "Submission type and participants".
- H3: "What kind of submissions do you want to collect?" + gray body: "Choose what submitters will send and whether to collect participant details."
- Info banner (light gray/blue bg, rounded, ⓘ icon): "You can adjust these choices later by editing this form."
- Two large selectable **choice cards** side by side (this is the submission-type radio-card pattern):
  - **Abstracts** card (currently selected — blue border ~2px, light blue-tinted bg #EFF6FF, icon in blue rounded square, document icon): "Collect abstract submissions for review before sessions are finalized."
  - **Sessions** card (unselected — plain white/gray border, icon in muted gray-blue rounded square, presentation/easel icon): "Collect full session proposals with details for your program."
- Below, a full-width **toggle card** (black/dark border ~2px, indicating "on" emphasis) for **Participants**: icon (people, blue), bold "Participants" + description "Include a step to collect speaker and participant contact information." + toggle switch on the right, **ON** (dark navy track, white knob).
- Footer bar (sticky bottom, full width, white, top border): "Back" (ghost, disabled-looking/gray) on left, "Next" (solid blue) on right.

**Visual style:** Radius: cards ~12px, choice cards ~16px, buttons ~8px, pills ~999px (full). Colors: active step nav item near-black #0B1220 with white text; selected choice card border blue #2563EB, bg tint #EFF6FF; icon chips light-blue #DCEAFE with blue icon #2563EB (Abstracts) vs light-slate #E5E9F0 with slate icon (Sessions, unselected); Participants toggle-card border black ~#111827 (~2px) signaling a "locked/important" affordance distinct from the blue selection border. Body text gray #475569/#64748B. Typography: large bold serif-less headings (looks like a geometric sans, e.g. similar to "General Sans"/"Inter"-family), ~20–24px for step title, ~15px body.

**Interactions implied:** Radio-style single-select between Abstracts/Sessions (mutually exclusive — selecting one changes which downstream steps appear, e.g. "Abstract Information" vs a "Session Information" step). Participants toggle adds/removes the "Participant Information" step from the sidebar. "Next" advances to Welcome Screen; steps in the sidebar become checked/completed as you progress (seen in later screenshots).

---

## image23.png — Step 2: Welcome Screen

**Step/screen:** Step 2 of 7 — **Welcome Screen** ("Welcome message and terms").

**Layout structure:** Same 3-column shell. Sidebar now shows **Submission Setup** with a checkmark icon in a light-gray rounded chip (completed state) and **Welcome Screen** as the active dark card; remaining 5 steps still muted/uncompleted.

**Step content:**
- Intro card: **"Welcome Screen"** / "Welcome message and terms".
- Body copy: "The first screen a user will see before submitting their abstract."
- Form card containing:
  - Two-column row: **"Internal Form Name *"** (text input, value "Session Submission Form #4", char counter "26/255", plus a small red icon-button "•••" — likely an AI-assist / duplicate-name-warning affordance) | **"External Form Title *"** (text input, placeholder-style value "Welcome to our event!", counter "21/255").
  - **"Page Heading *  (15 char max)"** single field spanning left column width, value "Welcome!".
- Second card: **"Welcome Message"** header row with a right-aligned toggle **"Show message"** (ON, dark track).
  - Below: a **rich text editor (WYSIWYG)** toolbar: Bold (B), Italic (I), Underline (U), Superscript (x²), Subscript (x₂), Link (🔗), Bullet list, Numbered list, Outdent, Indent, Align-left, Align-center, Align-right, Image insert, "•••" more-options overflow.
  - Editor body pre-filled with sample rich text: bold heading "**Call for Speakers**" then a paragraph: "Our event is the premiere event welcoming leaders, practitioners, and change-makers from all around the world to collaborate and learn from the best. Sessions for our agenda will be selected from these submissions." Resize handle bottom-right corner of the textarea.

**Visual style:** Form fields: white bg, 1px gray border #D8DEE9, radius ~8px, ~44px height, right-aligned muted counter text inside the field. Required-field marker: red asterisk immediately after label. Section cards: white, border, radius ~14–16px, ~24px internal padding. Toolbar icons dark slate, flat/minimal, ~16–18px, evenly spaced with thin divider rules between icon groups.

**Interactions implied:** Toggling "Show message" off likely collapses/hides the WYSIWYG editor and removes the welcome message from the public form. Rich text toolbar is a standard WYSIWYG (probably Tiptap/ProseMirror-based given the exact icon set and later screenshot's stray "p" tag artifact in image27). Character counters live-update. The red "•••" badge on Internal Form Name is unclear from pixels alone — plausibly a "duplicate name" warning or AI suggestion trigger.

---

## image20.png — Step 3: Abstract Information (top: section title/desc, start of Form Questions)

**Step/screen:** Step 3 of 7 — **Abstract Information** ("Session or abstract questions"). Sidebar: Submission Setup ✓, Welcome Screen ✓, Abstract Information active (dark), rest muted.

**Step content:**
- Intro card: **"Abstract Information"** / "Session or abstract questions".
- Card with two-column fields: **"Section Title *"** (value "Tell us about your submission", counter "29/255") | **"Page Heading *  (15 char max)"** (value "Submission").
- **"Description & Instructions *"** — full WYSIWYG editor (same toolbar as Welcome Screen) with body text: "What do you want to present? Fill out the following information to tell us more."
- Below (new card): gray helper line "Collect information about submitted abstracts." then section header **"Form Questions"** with a right-aligned **"+ Add Field"** button (ghost, outline, plus icon).
- First question row begins to appear at the bottom edge: **"Title *"** with a **"Locked"** pill badge next to the label, sub-line "Text | Max 255 chars", right-aligned "Required" label + toggle (ON, dark).

**Visual style:** Identical field/card styling to Welcome Screen. "Locked" badge: small pill, light-gray bg, dark text, denotes a system-mandatory field that can't be removed/retyped (its type is fixed). "Add Field" button: white bg, gray border, plus icon left of label, ~8px radius, sits top-right of the "Form Questions" section header — this is the primary way organizers add new custom questions.

**Interactions implied:** "+ Add Field" opens a field-type picker (not captured in these screenshots) to insert new custom questions into this section. Each question row appears to be part of a reorderable, toggleable list (confirmed fully in image1).

---

## image1.png — Step 3 continued: Abstract Information — full Form Questions list

**Step/screen:** Same step (Abstract Information), scrolled down to show the complete **Form Questions** list — this is the most detail-dense screenshot for the question-builder pattern.

**Layout:** Sidebar unchanged (Abstract Information active). Main panel shows "Collect information about submitted abstracts." + "Form Questions" header + "+ Add Field" button, then a **vertical stack of question row cards**, each row structured identically:

```
[⠿ drag-handle]  Label *  [Locked]        Required [toggle]  [•••]
                 TypeTag  [Max N chars pill]
```

Rows visible, in order:
1. **Title** * — badge "Locked" — sub "Text | Max 255 chars" — Required: ON (dark/locked-looking toggle, slightly grayed suggesting it can't be turned off since it's Locked).
2. **Description** * — sub "Wysiwyg | Max 5,000 chars" — Required: ON (blue-ish dark toggle).
3. **Format** * — sub "Dropdown" — Required: ON.
4. **Tags** * — sub "Dropdown" — Required: ON.
5. **Track** * — sub "Dropdown" — Required: ON.
6. **Level** (no asterisk — optional) — sub "Dropdown" — Required: OFF (toggle light/off state, track light gray).

Each row: far-left 6-dot **drag handle** icon (⠿, vertical grip, gray), far-right **"..."** overflow/kebab menu icon (opens per-field settings — edit options, conditional visibility, delete, duplicate — inferred).

**Visual style:** Row cards: white bg, light gray border #E5E7EB, radius ~12px, ~24px padding, ~16px gap between rows. Label: bold, dark (~17–18px). Red asterisk = required-in-schema marker distinct from the Required toggle (asterisk = field is inherently required by system for "Locked" fields; toggle = organizer-controlled requiredness for other fields). Type sub-label + "Max N chars" as a small pill/tag, muted gray, monospace-ish or just small sans, sits directly under the field name. Toggle switches: ON = dark navy/black track + white knob (right-aligned); OFF = light gray track + white knob, positioned left.

**Field types observed in this list:** Text, Wysiwyg (rich text), Dropdown (×3: Format, Tags, Track, Level — all dropdowns), implying the builder supports at minimum: Text, Wysiwyg, Dropdown, Email, Phone (seen in image2). This is a strong signal for **category-based routing**: Track, Tags, Format, and Level are exactly the classification fields an evaluation/agenda system would later route or filter sessions by — i.e., "categories" in Sessionboard are simply **Dropdown-type questions** on the Abstract Information step, not a separate routing UI. Whatever "conditional logic / category routing" exists downstream (Evaluation, Agenda) almost certainly reads these dropdown field values rather than having its own configuration screen inside the form builder.

**Interactions implied:** Drag handle = manual reorder (drag-and-drop) of questions within the section. "..." per-row menu = edit field (label, help text, options list for dropdowns, min/max, conditional show/hide rules — not directly screenshotted but the obvious location for "conditional logic" wiring: e.g. "show this question only if Track = X"). Toggle = mark required/optional per organizer (disabled/locked for system fields like Title). "+ Add Field" at section top adds new rows to this same list.

---

## image27.png — Step 4: Participant Information (top half)

**Step/screen:** Step 4 of 7 — **Participant Information** ("Participant and contact fields"). Sidebar: Submission Setup ✓, Welcome Screen ✓, Abstract Information ✓, Participant Information active (dark), Payments & Fees / Form Settings / Notifications still muted below.

**Step content:**
- Intro card: **"Participant Information"** / "Participant and contact fields".
- Card: **"Section Title *"** (value "Tell us about you", "17/255") | **"Page Heading *  (15 char max)"** (value "Participant").
- **"Description & Instructions *"** WYSIWYG, body: "Give us information about yourself and your credentials for presenting at our event." (Note: editor footer shows a stray "p" — a leaked HTML/markdown tag artifact from the rich-text component, useful detail for recreating the exact editor library's debug/placeholder quirk.)
- New card: **"Participant roles"** ⌄ (expandable/collapsible section, chevron-up shown = expanded) with helper text: "Choose which roles submitters can add. Optionally set minimum and maximum counts per role, and overall limits across all roles."
- Inside: a **role row** — checkbox (checked, dark filled) + icon (link/mic icon in rounded chip) + **"Speaker"** label with sub-label "Speaker" (role key/type) — right side has **"Min"** and **"Max"** numeric input boxes (both showing a placeholder dash "–"), column-header labeled above the inputs.

**Visual style:** Consistent card/field styling. The "Participant roles" section header has a **chevron toggle** (▲ expanded / would be ▼ collapsed) — first collapsible sub-section seen in the wizard, suggesting other steps may have similar nested collapsibles not fully visible in these crops. Role checkbox: dark navy fill when checked, white checkmark. Min/Max inputs: small (~90px wide), bordered, right-aligned in a 2-column header grid.

**Interactions implied:** Toggling a role checkbox on/off includes/excludes that participant role (Speaker, and presumably Co-Speaker/Moderator/Panelist etc., cut off below the fold) from the form. Min/Max let organizers cap how many of each role a submitter can add (e.g., max 1 speaker, max 3 panelists) plus (per the helper text) an overall cross-role limit — this is the closest thing to "business rule" logic seen in these screenshots, though it's quantity constraints rather than visibility/conditional logic.

---

## image2.png — Step 4 continued: Participant Information — Form Questions list

**Step/screen:** Same step (Participant Information), scrolled to the **Form Questions** list for participant/contact fields.

**Content:** "Collect information for participants and the primary contact for this submission." + "Form Questions" header + "+ Add Field" button, then question rows:
1. **First Name** * — "Locked" — "Text | Max 255 chars" — Required: ON.
2. **Last Name** * — "Locked" — "Text | Max 255 chars" — Required: ON.
3. **Email** * — "Locked" — "Email" (type tag only, no char-max pill) — Required: ON.
4. **Mobile Phone** — "Phone" type — Required: OFF.
5. **Biography** — "Wysiwyg | Max 5,000 chars" — Required: OFF.

Same exact row anatomy as image1 (drag handle, label+asterisk+Locked badge, type sub-label, Required toggle, "..." menu). Confirms field type roster includes **Email** and **Phone** as distinct typed inputs (not just "Text").

**Visual style/interactions:** Identical to image1's pattern — reinforces this question-row component is reused verbatim across every "Information" step (Abstract, Participant), i.e., it's a single shared `FormQuestionRow` / `QuestionList` component in the underlying app, which is a strong recommendation for the clone's component architecture.

---

## image21.png — Step 5: Payments & Fees (annotated "NOT NEEDED")

**Step/screen:** Step 5 of 7 — **Payments & Fees** ("Fees, gateway, and promo codes"). Sidebar: first 4 steps ✓, Payments & Fees active.

**Step content (partially obscured by a large red "NOT NEEDED" callout arrow drawn by the brief author, pointing at this whole step):**
- Intro card: **"Payments & Fees"** / "Fees, gateway, and promo codes".
- Body: "Configure how and when fees are collected for this form."
- Card: **"When to Collect Payment"** (clock icon, blue chip) — a selectable option row (covered by the red graphic, presumably a dropdown/select "Payment method/timing"), with a second, currently-selected option below: **"Upon Submission"** ✓ (checkmark icon) — "Payment is collected when the submission is completed and submitted."

**Annotation meaning:** The brief explicitly marks this entire step as **out of scope** for the clone ("NOT NEEDED") — payments/fees should be skipped or stubbed, not rebuilt.

**Visual style:** Consistent card pattern; option row styling matches other choice-card patterns (icon chip + bold label + description, with a checkmark for selected state rather than radio dot).

---

## image36.png — Step 6: Form Settings (top: Deadlines + Submission capacity)

**Step/screen:** Step 6 of 7 — **Form Settings** ("Deadlines, limits, and success page"). Sidebar: first 5 steps ✓ (now including Payments & Fees), Form Settings active. Annotated with a red "**kinda impt**" speech-bubble pointing at the Close Date field.

**Step content:**
- Intro card: **"Form Settings"** / "Deadlines, limits, and success page".
- Body: "Configure submission deadlines, limits, and post-submission behavior."
- **H3 "Deadlines"** + body "When the form stops accepting new and updated submissions."
  - Card: **"Close Date"** bold label + description "If set, form and submissions will close after specified date." + a date/time picker input "📅 Select date and time" (empty state) + helper text below: "Set a close date to enable draft reminder emails." *(Annotation: "kinda impt" — moderate priority for clone.)*
- **H3 "Submission capacity"** + body "How many sessions each submitter may have, and how saved drafts work on the portal."
  - Card row 1: toggle **"Set Submission Limit"** (OFF) + description "Limit how many sessions one user may have for this form. Includes saved drafts and submitted sessions." + inline info pill "Event max: 3" with note "Applies when no form-level limit is set."
  - Card row 2 (cut off at fold): toggle **"Allow multiple draft submissions"** (OFF).

**Visual style:** Toggle rows follow the same left-label/description + right-aligned switch pattern used throughout. "Event max: 3" rendered as a small rounded pill/badge, distinguishing an inherited/global default from this form's own override.

**Interactions implied:** Setting a Close Date presumably unlocks/enables a "draft reminder emails" feature (cross-references the Notifications step). Submission-limit toggle, when enabled, likely reveals a numeric input to override the event-level max of 3.

---

## image9.png — Step 6 continued: Form Settings — After Submission / Validation rules (annotated "make sure this works")

**Step/screen:** Same step (Form Settings), scrolled further to **After submission** and **Validation rules** sub-sections.

**Content:**
- **H3 "After submission"** + body "What submitters see on the confirmation page after they complete the form."
- Card: toggle **"Auto-redirect to speaker portal"** (ON) + description "After 10 seconds on the confirmation page. If off, submitters use Continue to portal [button]" (text cut by red callout).
- Divider, then **"Customize the success page message:"** (bold) + description "Shown on the public confirmation page after submit (and after payment, when fees apply)." — a large red **"make sure this works"** callout arrow points directly at this label, flagging it as a priority correctness item for the clone.
  - Full WYSIWYG editor (same toolbar) pre-filled with sample multi-paragraph success copy: "You will receive a confirmation email shortly with a link to your speaker portal. We will review sessions over the next few weeks and then notify you regarding your status." / "Next, you will be logged into your speaker portal where you can see if there are any tasks to complete." / "If you would like to submit another session, please **click here** [blue underlined inline link] to return to the submission form."
- **H3 "Validation rules"** + body "Combined character limits across several text fields."
  - Card: **"Cross-field character limits"** bold + description "Cap the combined length of several text fields (for example a printed program block). Submitters see a live combined counter; speaker-field rules apply to each participant." + right-aligned **"+ Add rule"** button (ghost, same style as "+ Add Field").

**Visual style:** Identical card/typography system. The success-page WYSIWYG shows the editor supports inline hyperlinks rendered in blue-underline within body copy — confirms the rich-text component supports the Link toolbar button functionally, not just cosmetically.

**Interactions implied:** "+ Add rule" opens a rule builder (not captured) to pick which fields participate in a combined character cap — this is a secondary, lower-priority "logic-like" feature (cross-field validation) distinct from conditional visibility logic.

---

## image7.png — Step 7: Notifications (final step, annotated "nice to have" / "must have")

**Step/screen:** Step 7 of 7 (final) — **Notifications** ("Admin alerts and email templates"). Sidebar: all prior 6 steps ✓, Notifications active. Footer button changes from "Next" to **"Save"** (still present top-right too), confirming this is the last step of the wizard — there is no separate "Publish" step; saving here (or via the persistent top-right Save) is how the form goes live/updates.

**Content:**
- Intro card: **"Notifications"** / "Admin alerts and email templates".
- Body: "Choose who receives admin alerts and customize automated emails for this form."
- Card: **"What admins should be notified when a new submission is received?"** — a multi-select/tag input populated with one chip "Sw yx ✕" (a person, removable tag). Red callout: **"nice to have"** pointing at this field.
- **"What admins should be notified when an existing submission is updated?"** — same pattern, chip "Sw yx ✕".
- Card: **"Submitter notifications"** header (person icon) + "1 template" count + chevron (collapsed/expandable row) — red callout **"must have"** pointing here.
  - Nested row: **"Submission Confirmation"** (envelope icon) — "Email sent to the submitter after a successful submission" — right-aligned toggle (ON) + **"Customize"** link/button (with small icon, pencil-like).
- Card: **"Admin notifications"** header (shield icon) + "2 templates" + right-chevron (collapsed, not expanded in this screenshot).

**Annotation priorities:** admin-recipient pickers = "nice to have"; the submitter-facing "Submission Confirmation" email = "**must have**" — the single clearest priority signal in this whole image set: transactional confirmation email to submitters is core; admin notification recipient customization is secondary.

**Visual style:** Chips/tags: rounded pill, light gray bg, name + "✕" remove icon, inside a bordered input container (typeahead/multi-select pattern, likely searches org members). Collapsible template groups use a leading icon (person / envelope / shield) to differentiate audience type (submitter vs. admin vs. security-ish/admin-alert). Chevron direction communicates expand state (down = collapsed with hidden content, up/expanded = shows nested rows, as seen with "Submitter notifications" being expanded to reveal "Submission Confirmation").

**Interactions implied:** "Customize" opens an email template editor (subject/body, likely with merge-tag/variable support — not captured). Toggle enables/disables that specific automated email independent of the others. Admin notifications (2 templates, collapsed) likely include "New Submission Received" and "Submission Updated" emails mirroring the two recipient-picker questions above.

---

## Synthesis: Full inferred Form Builder flow, start to "publish"

**Entry point:** `Program > Forms` list (image15) → "+ Add" button → dropdown with **"Create Form"** (fresh wizard) or **"Copy from..."** (clone existing form/template). A promo banner upsells a separate "Speaker CRM year-round collection" feature — not part of the builder itself, skip for clone unless CRM is in scope.

**Wizard shell (constant across all steps):**
- Page header: "Edit Session Form" (or "Create Session Form" when new) / form name subtitle, with persistent top-right actions **View Form** (preview in new tab), **Copy Link** (public submission URL), and **Save** (primary blue) — Save is available on every step, not gated to the end.
- Left wizard rail titled **"FORM SETUP"**, always showing all applicable steps with icon + title + 1-line description; completed steps get a checkmark chip, the current step is a solid dark active card, future/untouched steps are muted.
- Bottom sticky footer: **Back** / **Next** (Next becomes **Save** only on the final step).

**The 7 steps, in fixed order:**
1. **Submission Setup** — pick submission type (**Abstracts** vs **Sessions**, mutually exclusive card-select) and toggle whether to collect **Participants** info as its own step. This choice determines which later steps appear (e.g., "Abstract Information" step is only shown/relevant for the Abstracts path; a Sessions-path equivalent likely swaps in similar fields).
2. **Welcome Screen** — Internal Form Name, External Form Title, Page Heading (15-char cap), and a toggleable rich-text **Welcome Message** (WYSIWYG) shown before the public form.
3. **Abstract/Session Information** — Section Title, Page Heading, rich-text Description & Instructions, then a **Form Questions** builder: a reorderable (drag-handle) list of question rows, each with Label, required-asterisk, optional "Locked" badge (system field, type fixed, often required-locked-on), a type sub-label (Text / Wysiwyg / Dropdown / Email / Phone with char-max pills where relevant), a per-row **Required** toggle, and a **"..."** overflow menu for deeper field config. **"+ Add Field"** appends new custom questions. Locked/system fields observed: Title, Description. Custom/dropdown fields observed: Format, Tags, Track, Level — these are the de facto **category/classification fields**, and are the most likely place downstream conditional-logic or routing (e.g., in Evaluation/Agenda) reads from.
4. **Participant Information** — same Section Title/Page Heading/Description pattern, plus a **Participant roles** collapsible sub-section: checkbox-enable which roles (Speaker, likely Co-Speaker/Panelist/Moderator below the fold) submitters may add, with per-role **Min/Max** counts and an overall cross-role limit. Then its own **Form Questions** list (First Name, Last Name, Email — all Locked/required; Mobile Phone, Biography — optional).
5. **Payments & Fees** — *(flagged "NOT NEEDED" for the clone)* — when to collect payment (e.g. "Upon Submission"), presumably gateway and promo-code config below the fold. Skip/stub in the clone.
6. **Form Settings** — Deadlines (Close Date picker, *"kinda impt"*, enables draft-reminder emails), Submission capacity (Set Submission Limit toggle with an inherited "Event max: N" default, Allow multiple draft submissions toggle), After Submission behavior (Auto-redirect to speaker portal toggle with a 10-second delay note, and a WYSIWYG **success page message** editor — *"make sure this works"*, flagged as a correctness-critical item, supports inline links), and Validation rules (Cross-field character limits via "+ Add rule" — a secondary/lower-priority feature).
7. **Notifications** (final step) — Admin alert recipient pickers for "new submission" and "submission updated" (*"nice to have"*, tag/chip multi-select of org members), then two collapsible template groups: **Submitter notifications** (1 template: **Submission Confirmation**, toggle + "Customize" — flagged **"must have"**) and **Admin notifications** (2 templates, collapsed — presumably New Submission / Submission Updated admin emails).

**No explicit "Publish" step or "Categories/Logic" step exists in this set of 11 screenshots.** Publishing is implicit: the form is live/editable via the persistent **Save** button on every step (there's no draft/publish state toggle visible), and "conditional logic" / "category-based routing" is **not** a dedicated builder screen — it is expressed indirectly through:
- **Dropdown-type questions** (Track, Tags, Format, Level) acting as the taxonomy/category fields,
- the per-field **"..."** overflow menu (not opened in any of these 11 screenshots — recommend pulling more images, e.g. others from the same 46-image set, before finalizing the logic-builder spec, since that menu is the most likely place field-level visibility conditions or option-based routing rules would be configured),
- and quantity-based rules (Participant role Min/Max, cross-field character-limit rules) rather than true show/hide conditional logic.

**Recommendation for the clone build:** Reproduce the 7-step left-rail wizard shell and the shared `QuestionRow`/`QuestionList` component (drag handle, Locked badge, type tag, Required toggle, overflow menu) as the highest-value, most-reused piece of UI. Treat Payments & Fees as out of scope per the brief's own annotation. Prioritize: the submitter-facing Submission Confirmation email (must-have), the success-page message editor correctness (must-have per annotation), Close Date (should-have), and treat admin-notification recipient customization plus cross-field validation rules as nice-to-haves. Before implementing "conditional logic," source additional screenshots of the per-field "..." menu and any options/branching UI, since it was not present in this batch.
