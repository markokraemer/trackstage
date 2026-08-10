# Sessionboard UX Forensics — Event Config & Public CFP Page

Source: `$10,0000 Kill My SaaS - Competition Brief/images/` (Sessionboard competition brief screenshots).
Goal: forensic detail sufficient to recreate these screens ~1:1 in an open-source, light-mode, organizer-friendly clone.

Images covered, in read order:
1. `image38.png` — marketing site, Products mega-menu (context, pre-screenshots section)
2. `image37.png` — docs/help center (learn.sessionboard.com), sidebar TOC (Program & agenda / Submissions & forms)
3. `image6.png` — docs/help center, sidebar TOC continued (Portals / Evaluations / Communications / Reporting & AI)
4. `image29.png` — **App**: Event Settings → Overview (index of all settings)
5. `image25.png` — **App**: Event Settings → Event Details (top half — core fields)
6. `image41.png` — **App**: Event Settings → Event Details (bottom half — Exhibitors/Sponsors + Image Settings)
7. `image4.png` — **Public CFP page**: `appv2.sessionboard.com/submit/<event-slug>/<uuid>` — Step 1 "Welcome!"

---

## 1. image38.png — Marketing site: Products mega-menu

**Screen/route:** `sessionboard.com` marketing/landing site, top nav "Products" dropdown open (mega-menu), captured inside a mocked browser chrome (Chrome address bar visible, "Ask Gemini" extension, etc. — not part of the product UI itself).

**Layout structure:**
- Full-width top nav bar, white background, subtle bottom hairline shadow.
- Left: logo lockup — small rounded-square blue icon (bullhorn/megaphone glyph, white on blue, ~40×40px, ~10px corner radius) + wordmark "SESSIONBOARD" in bold black uppercase, tight tracking, two-weight styling (SESSION bold black / BOARD bold black, same weight — reads as one solid wordmark).
- Center nav links: **Products** (active, blue text + chevron-down), **Platform** (chevron-down), **Resources** (chevron-down), **Pricing** (no chevron, single link). Dark navy/charcoal text (~#1F2430), medium weight, ~15–16px.
- Right: **Log in** (secondary/outline button, white bg, grey border, dark text, pill-ish rounded rect ~8px radius) and **Request a demo** (primary button, solid blue #2F5CE0-ish, white bold text, same corner radius).
- Below nav: full-bleed mega-menu panel, three-column layout, floating card with soft gradient border (mint-green → light blue) and drop shadow, rounded corners (~16–20px), sitting just under the nav, inset from the page edges left/right (like a dropdown "sheet").

**Mega-menu columns:**
- **Left column** ("switcher" list) — this is actually a secondary nav *inside* the mega-menu with 4 category entries stacked vertically, each ~72px tall:
  - **Program** — "Build and run your event program" — currently selected: highlighted with a gradient pill background (mint-green to light-blue gradient, rounded ~14px) and a white circular chevron-right icon button on the right edge.
  - **CRM** — "The people behind this event" (plain row, grey chevron-right, unselected = white bg)
  - **Marketing** — "Turn your event into content and demand"
  - **CMS** — "Deliver your content to your audience"
  - Each row: bold dark title line + smaller grey (#8A94A6-ish) description line underneath, chevron-right icon aligned right.
- **Center column** ("Products" detail panel) — white card, heading "Products" (grey label, small caps-ish, ~13px), then a 2-column grid of 6 product entries, each with a small line-icon (24px, dark stroke) + bold title + grey description:
  - Call for papers & grading — icon: stacked documents — "Manage speaker submissions"
  - Speaker management — icon: chat bubble — "Manage your speakers easily"
  - Abstract Management — icon: overlapping squares/layers — "For associations and enterprise teams"
  - Content management — icon: folder with person — "Manage speaker content"
  - AI evaluators — icon: checkmarks — "AI tools to automate session selection"
  - Portals — icon: clipboard — "Branded portals for speakers and sponsors"
  - Agenda management — icon: calendar with star — "A way to build your agenda"
  - Awards — icon: trophy — "2026 Workshop Series"
  - Below the grid, a full-width footer strip inside the same card (gradient mint→blue background continuing from the outer card edge): "Subscribe to product updates" (bold) + an email input showing placeholder/prefilled text "swyx@ai.engineer", a small red icon button (Slack? messaging glyph) and a circular arrow-submit button.
- **Right column** — separate sub-panel, "AI Agents" heading with a green dot + "Live now" status label (green pill/text, live indicator dot). Lists 3 agent roles with line icons: **Reviewer** (list+magnifier icon), **Scheduler** (calendar-check icon), **Coordinator** (eye icon). Below that, a highlighted card (light mint-green rounded box) featuring a trophy icon badge (white rounded square with dark trophy glyph) + "Team Lead" bold title + "Orchestrates every agent across all products." description — this is presented as the flagship/orchestrator agent, visually promoted with its own card treatment distinct from the plain list rows above it.

**Visual style:**
- Palette: white background, near-black/navy text (#1B1E27 approx), blue accent (#2F5CE0 / #3B5FE0-ish — matches primary buttons and active nav state), soft mint-green (#C9F2DC / #B8F0D4-ish) and pale blue (#D8E4FF-ish) used only as gradient/accent backgrounds on cards and the active-state pill, medium grey for descriptions (#8A94A6-ish), light grey borders (#E7E9EE-ish).
- Typography: sans-serif (looks like a grotesque, e.g. similar to Inter/Söhne) — bold headings, regular/medium body, generous line-height on descriptions.
- Corner radius: large on outer mega-menu card (~16-20px), medium on inner cards/rows (~12-14px), small-pill on buttons (~8-10px), fully round on the icon avatar and status dots.
- Spacing: generous padding inside cards (~24px), consistent icon-to-text gap (~12px), row height ~64-72px in the left switcher list.
- Icons: simple 1.5px-stroke line icons, consistent 20-24px size, no fill, dark navy stroke color.

**Interactions implied:** hover/click on "Products" opens this dropdown; clicking left-column items (Program/CRM/Marketing/CMS) swaps the center+right panel content; the whole thing behaves like a persistent contextual switcher + detail mega-nav (not a simple flyout list).

**Relevance to app clone:** this is top-of-funnel marketing chrome, not the app itself — but it's useful for establishing brand palette (blue #2F5CE0 primary, mint/blue gradient accents) and the icon-set style (thin line icons, rounded-square icon badges) that carries into the actual app's home/overview screens (see image29 icon badges below, which reuse the same square-with-rounded-corner icon-badge pattern).

---

## 2. image37.png — Docs site (learn.sessionboard.com): sidebar table of contents, "Program & agenda" + "Submissions & forms"

**Screen/route:** `learn.sessionboard.com` (a Mintlify- or GitBook-style docs/help center), landing/overview page with anchor links, page scrolled so a red-outlined callout box (annotation added by the brief's author, not product UI) highlights two sections.

**Layout structure:** Classic 3-column docs layout:
- **Left sidebar** (~280px): logo lockup (same bullhorn-in-blue-square icon + "SESSIONBOARD" wordmark) at top, then two grouped nav sections:
  - "GUIDES" (grey uppercase label with dropdown chevron) containing: Get started, Core concepts, Program, CRM, Marketing, CMS, Awards, Portals, Communications, Reporting & Dashboards, Agents, Event Team, Settings — each a bold dark row with trailing chevron-right, indicating each expands to a sub-list.
  - "PARTICIPANT GUIDE" (grey uppercase label) containing plain (non-bold, no chevron) leaf links: Guide overview, Access your portal, View & edit your submission, Upload files & make comments, Add or edit session speakers, Switch between portals, Access your other event portals, Change your username or email, View wiki pages, View & download files, Share group portal access, Save a submission as a draft, Speaker headshot do's and don'ts.
- **Center content column**: top search bar "Search" with a "⌘K" keyboard-shortcut badge on the right edge of the input (rounded pill input, light grey background, magnifier icon left-aligned). Below it, large-type H1/H2 section headers ("Program & agenda", "Submissions & forms", "Contacts & data") each followed by a bulleted list of blue underlined hyperlinks:
  - **Program & agenda**: Create a session, Session settings, Agenda building, AI agenda builder, Accept & decline sessions, Embeds
  - **Submissions & forms**: Session submission form, Forms, Fields, File requests
  - **Contacts & data** (heading visible, list cut off): Create a contact, Importing data, History
- **Right sidebar** ("On this page" mini-TOC, ~280px): bold "On this page" heading, then a vertical list of same-page anchor links (Overview, Program & agenda [active/blue], Submissions & forms, Contacts & data, Portals, Evaluations, Communications, Reporting & AI, Event team & settings) — active item is blue, rest are grey.
- Top-right of the whole page (partially visible): "Contact support" pill button (white, grey border) + a small external-link icon button + partial user avatar.

**Visual style:**
- Background: white/very-light-grey content area, sidebar slightly off-white or same white with a right hairline border.
- Text: headings in bold dark navy (#1B2338-ish, larger/heavier than marketing site — looks like a serif-adjacent grotesque, could just be a bold sans at large size ~32-36px for H1/H2). Body/links in a lighter, more legible sans, ~16px.
- Links: classic blue (#2F5CE0/#3D5CFF) underlined — a deliberately "documentation" link style distinct from the app's button styles.
- Bullet lists: simple round bullets, generous vertical spacing (~12-16px between items), left-indented.
- Sidebar active/hover state: bold black text for expandable categories vs. regular-weight grey for leaf links; no visible pill/background highlight on the currently expanded category (relies on bold weight + chevron only) except the mini-TOC on the right which uses blue text color for the active anchor.
- Red rectangle overlays in the screenshot are **annotations added by the brief author** (competition scoping), not part of Sessionboard's UI — they mark which doc sections are must-have.

**Interactions implied:** collapsible sidebar categories (chevron-right = collapsed/expandable), inline anchor-scrolling right-rail TOC that highlights current section, global search with ⌘K.

**Non-technical organizer relevance:** This page enumerates the *entire* feature surface an organizer touches — valuable as a feature checklist/IA reference (Program, CRM, Marketing, CMS, Awards, Portals, Communications, Reporting & Dashboards, Agents, Event Team, Settings) for scoping the clone's nav.

---

## 3. image6.png — Docs site continued: "Portals" / "Evaluations" / "Communications" / "Reporting & AI"

**Screen/route:** Same `learn.sessionboard.com/videos/overview` docs page as image37, scrolled further down. Same mocked browser chrome as image38 (real Chrome UI visible: back/forward/reload, address bar `learn.sessionboard.com/videos/overview`, star/bookmark icon, extension icons, "Ask Gemini").

**Layout/style:** Identical 3-column docs template as image37 (same sidebar, same content typography). New sections visible, again with red annotation boxes:
- **Portals**: Portals (Pro) [note the "(Pro)" tag — paid-tier feature], Custom portals, Portal settings & appearance, Tasks, Files, Session files, Resources & wiki pages.
- **Evaluations**: Evaluation plans, AI evaluations.
- **Communications** (red-boxed = must-have per brief): Creating & sending emails, Email templates.
- **Reporting & AI**: Reports (red "nice to have" sticky-note annotation pointing at it — brief author's prioritization callout, not product UI), AI content remix.

**Sidebar identical** to image37 (Guides list + Participant Guide list), confirming this is one continuous scrollable page (`/videos/overview`), not separate pages — i.e., Sessionboard's docs IA is a single long index page with anchor sections, each linking out to individual guide articles.

**Non-technical organizer relevance:** Confirms the "Portals" feature is tiered ("Pro"), and that Reports/AI content remix are lower-priority/nice-to-have per the brief's own scoring — useful signal for what to deprioritize in the clone's V1.

---

## 4. image29.png — App: Event Settings → Overview

**Screen/route:** The actual product app (not marketing/docs). URL not visible but structurally this is the event-scoped Settings home, likely `app.sessionboard.com/events/:eventId/settings` (or similar), reached via the left global nav's "Settings" item. Page title: "Event Settings" / subtitle "Configure event details and preferences."

**Overall layout structure — 3-tier navigation:**
1. **Top bar** (full width, white, ~64px tall, bottom hairline border): left — small blue rounded-square logo icon (bullhorn glyph, no wordmark text here, just the icon — collapsed/compact branding for in-app use). Center — global search input "Find or ask" (grey pill, magnifier icon, right-aligned "⌘K" shortcut chip). Right — "View Portal" link button (blue text, white/transparent bg, likely outline), a megaphone/announcement icon button with a red notification dot, a "?" circular help icon button, and a circular user avatar (dark navy circle, white initials "SY").
2. **Left global sidebar** (~330px wide, white bg, right hairline border):
   - Top: **event switcher** — grey rounded-square avatar with initials "AS", event name "AI.Engineer Sand..." (truncated) + date range subtitle "Oct 12–14, 2026", with an up/down chevron-stack icon on the far right (dropdown to switch events). This whole row sits in a light-grey rounded card, functioning as the primary event context switcher.
   - Below, top-level nav items (icon + label, ~44px row height, left-icon + label, no active state shown here since we're in Settings sub-view... actually "Program" row shows a blue-outlined rounded rectangle around it — that's a hover/focus highlight state):
     - Dashboard (grid icon)
     - Program (document/clipboard icon, chevron-right — expandable) — shown with blue outline box (hover state)
     - CRM (person-in-box icon, chevron-right — expandable)
     - Marketing (megaphone icon)
     - CMS (globe icon, chevron-right — expandable)
   - Divider (hairline)
   - Reports (document icon)
   - Studio (magic-wand/sparkle icon)
   - History (clock-with-arrow icon)
   - Divider
   - Event Team (two-people icon)
   - Preview (flask/beaker icon)
   - **Settings** (gear icon) — active state: light blue background pill (rounded rect, full-row highlight) + blue text/icon — this is the currently selected top-level section.
   - Bottom-left: small 2x2-grid app-switcher icon button (likely "switch workspace/app" launcher).
3. **Settings sub-nav (secondary sidebar)**, nested to the right of the global sidebar, ~300px wide, white bg with the local page header above it:
   - Local header row: back-arrow icon button, gear icon, "Event Settings" H1 (bold, dark), "Configure event details and preferences" subtitle (grey) — sits in a very-pale-blue/lavender tinted band across the full content width (background ~#EEF1FC-ish), giving Settings its own tinted "zone."
   - Sub-nav list (this is the local settings menu, distinct from the global sidebar):
     - **Overview** (grid icon) — active: blue text + light-blue rounded pill background
     - Event Details (document icon)
     - Library (stacked-books icon, expandable, chevron pointing down = currently expanded) → nested children indented further: Fields, Tags, Personas
     - Record Settings (database/stack icon)
     - Portals (person-in-doorway icon)
     - Submission Forms (chat-bubble/form icon)
     - Email Templates (envelope icon)
     - Email Themes (paint-palette icon)
     - Integrations (puzzle-piece icon)
4. **Main content area**: grouped card grid under section headers, each entry is a horizontal "tile" with a square icon badge (light-blue bg, rounded ~10px corners, blue line icon) + bold blue-link-styled title + grey 1-2 line description, arranged 3-per-row:
   - **"Event setup"** section: Event Details ("Name, dates, timezone, and the basics."), Record Settings ("Record layouts and field configuration."), Portals ("Speaker and exhibitor portal appearance."), Submission Forms ("Submission form appearance and content.") — this last one wraps to a second row (only 1 item).
   - **"Library"** section: Fields ("Custom fields for contacts, sessions, and submissions."), Tags ("Reusable labels across records."), Personas ("Audience segments and attendee types.").
   - **"Communications"** section: Email Templates ("Transactional email content."), Email Themes ("Branding applied to your emails.").
   - **"Configuration"** section: Integrations ("Connect Cvent, Swoogo, Zoom, and more.").
   - Section headers ("Event setup", "Library", "Communications", "Configuration") are bold dark, ~18-20px, left-aligned, with generous top margin (~40px) separating groups.

**Visual style:**
- Colors: white page background; pale lavender/blue banner behind the page header (~#EDF0FC); primary blue accent ~#2F5CE0 (active nav pill text/icon, tile titles, primary buttons); light blue icon-badge background ~#E7EDFC; dark navy body text ~#1B1E27; grey secondary text ~#6B7280; hairline borders ~#E5E7EB; active nav-pill background ~#E4EBFC (very light blue-purple), rounded ~10px.
- Typography: sans-serif throughout (same family as marketing site). H1 "Event Settings" ~22-24px bold. Section headers ~18px bold. Tile titles ~15-16px semibold blue. Descriptions ~13-14px regular grey. Sidebar nav labels ~14-15px medium.
- Spacing: consistent ~24px gutter between grid tiles, ~16px internal tile padding, sidebar rows ~40-44px tall with ~12px icon-text gap, 8-10px border radius nearly everywhere (buttons, pills, icon badges, cards) — no sharp corners, no heavy shadows (flat/bordered style over shadow-heavy style).
- Icon badges: consistent square (not circle) rounded-corner containers, ~40x40px, tinted background matching the accent color family, single-color line icon centered — this exact pattern (icon badge = tinted rounded square) is the dominant "content tile" component reused everywhere in the settings overview.

**Interactions implied:**
- Left global sidebar items with chevron-right are expandable/collapsible in place (accordion) — "Library" is shown expanded with 3 children indented.
- Event switcher at sidebar top is a dropdown (chevron up/down icon) to jump between events/orgs.
- Every tile title and icon badge is a clickable link into that settings sub-page (confirmed since image25/41 show the destination of clicking "Event Details").
- "View Portal" top-bar button presumably opens the public-facing speaker/attendee portal in a new context.
- Notification/announcement bell-like icon has a red dot badge (unread indicator).

**Organizer-relevant takeaways:** Settings is organized as a single "index/hub" page grouping related settings into labeled sections (Event setup / Library / Communications / Configuration) with plain-language one-line descriptions under every link — this scannable, self-documenting index pattern (icon + bold title + helper sentence) is worth replicating as the core "settings home" pattern for the clone, rather than a bare list of settings links.

---

## 5. image25.png — App: Event Settings → Event Details (top section)

**Screen/route:** Same app shell as image29, now drilled into Settings → **Event Details** (sub-nav item highlighted blue with light-blue pill background). Same 3-tier nav (top bar / global left sidebar / settings sub-nav) persists unchanged — confirms Settings uses a stable double-sidebar layout while only the rightmost content panel swaps.

**Layout structure:** Content panel header: bold "Event Details" H1 + grey subtitle "Configure basic event information." Below, a single-column form (not multi-step wizard) laid out as a **2-column field grid** (label-above-input pattern), each row pairing two related fields side by side:

**Fields, in order, with exact labels/placeholders/values (values shown are pre-filled sandbox data):**
- Row 1: **Event Name*** (required, red asterisk) — text input, value: "AI.Engineer Sandbox Event - NYC" | **Event Slug*** (required) with an info "(i)" tooltip icon — text input, value: "ai-engineer-sandbox-event"
- Row 2: **Event Type** (info tooltip icon) — dropdown/select, value: "Conference" | **Event Website URL** (info tooltip icon) — text input, value: "ai.engineer"
- Row 3: **Event Location** (info tooltip icon) — text input, value: "New York" | **Timezone** (info tooltip icon) — dropdown/select, value: "(GMT-8:00) America/Los_Angeles (Pacifi..." (truncated)
- Row 4: **Starts At*** (required, info tooltip) — date-time picker input with calendar icon, value "October 12th, 2026 at 9:00 AM" + "PDT" chip + a clear/"X" button | **Ends At*** (required, info tooltip) — date-time picker, value "October 14th, 2026 at 5:00 PM" + "PDT" chip + clear "X" button
- Row 5 (full width): **Theme** — helper text below label: "This helps improve search, recommendations, and how content is organized." — large multi-line textarea, value "Test Event for NYC", with a live character counter bottom-right "18 / 1000"
- Footer: hairline divider, then a solid blue **"Save"** button (primary, rounded ~8px, bold white text) bottom-left of the panel.

**Visual style specifics:**
- Input fields: white background, thin grey border (~#D8DCE3, 1px), rounded corners (~8px), consistent height (~44px for text inputs), label sits directly above input in dark navy medium-weight text (~14px), with red asterisk suffix for required fields and a small circular "i" info-icon (grey, ~14px) suffix for fields that have contextual help.
- Date/time inputs render as a formatted human-readable string ("October 12th, 2026 at 9:00 AM") with a leading calendar-glyph icon, an inline timezone abbreviation chip ("PDT") right-aligned before the clear (X) icon — implies a rich date-time-picker component rather than a bare `<input type=datetime>`.
- Dropdowns (Event Type, Timezone) show a chevron/caret icon right-aligned, same border/height/radius as text inputs — visually indistinguishable from text inputs except for the caret icon.
- Textarea for Theme is notably tall (~150px) with bottom-right live counter styled in small grey text.
- Section uses no card/box chrome around the form itself — it sits directly on the white content background; only the Save button area is set off by a horizontal hairline divider above it.
- Color palette matches image29: navy text, grey placeholders/helper text, blue primary button, light input borders.

**Interactions implied:** Save is likely disabled/enabled based on dirty-state (not visually indicated as disabled here); required fields marked with red asterisk imply client-side validation; info-icons imply hover/click tooltips explaining each field's purpose (e.g., why Event Slug matters for the public URL, why Timezone affects displayed times); date pickers likely open a calendar+time overlay on click.

**Organizer-relevant takeaways:** This is the "basics" form every organizer fills out first — Name, Slug (their public URL), Type, Website, Location, Timezone, Start/End datetime, and a free-text "Theme" field explicitly described as improving search/recommendations/organization (likely feeds an AI feature). The slug field directly determines the public CFP URL seen in image4 (`/submit/ai-engineer-sandbox-event/...`), confirming Event Slug = URL slug.

---

## 6. image41.png — App: Event Settings → Event Details (bottom section, scrolled)

**Screen/route:** Same Event Details page as image25, scrolled down — shows the remainder of the form below the Theme textarea.

**Additional sections revealed:**

1. **"Exhibitors & Sponsors"** section — heading + grey helper text: "Enable exhibitor and sponsor groups for this event. Advanced portal and contact features are managed by your Sessionboard team." (note: this line signals a support/managed-service touch point for advanced config — a "call us" upsell pattern). Sub-prompt: "Which group types do you want to manage for this event?" followed by two large selectable toggle-cards side by side, each ~330x155px, rounded ~12px border:
   - **Exhibitors** card — storefront/booth line icon (centered, large ~32px) + label below, with a green circular checkmark badge in the top-right corner indicating "selected/enabled."
   - **Sponsors** card — two-people icon, same layout, also green-checkmark selected.
   - Both cards show a blue border ring when selected (selected state = blue border + green check badge combo), implying these are toggleable multi-select cards (like checkbox tiles) rather than radio/single-select.

2. **"Image Settings"** section — heading + helper text "Upload event logo and background images." Two side-by-side upload fields:
   - **Logo Image** — helper "Recommended: 300 w x 300 h" — a dashed-border square drop-zone (~130x130px) with an upload-arrow icon centered, plus a separate blue **"+ Upload new"** button (with dropdown chevron, suggesting upload-source options e.g. file vs. URL vs. library) placed to the right of the drop-zone.
   - **Background Image** — helper "Recommended: 1500 w x 500 h" — same dashed drop-zone pattern (wider aspect ratio implied) + "+ Upload new" button with chevron.
   - Both drop-zones are empty/placeholder state (no image uploaded yet in this sandbox).

3. Footer: hairline divider + blue **"Save"** button, same as image25 (confirms Save is a single page-level action covering the whole Event Details form, not per-section).

**Visual style specifics:**
- Selectable toggle-cards: light lavender/blue-tinted fill when selected (~#EEF1FC), blue 1-2px border, green filled circular checkmark badge (~24px, white check glyph) overlapping the top-right corner of the card — a distinctive "selectable feature card" component reused for binary/multi-select choices.
- Upload drop-zones: dashed grey border (~1.5px, #C7CBD4-ish), rounded ~8px corners, light grey upload-cloud/arrow icon, no fill — standard empty-state file-drop affordance.
- "+ Upload new" buttons: solid blue, white bold text, rounded ~8px, leading "+" icon, trailing dropdown chevron — implies a split/combo button (primary upload action + secondary menu of upload sources).

**Organizer-relevant takeaways:** Confirms Sessionboard's data model treats Exhibitors/Sponsors as optional, independently-toggleable "groups" per event (not baked-in) — an important schema decision for the clone (groups/participant-types should be a configurable list, defaulting to at least Speaker, with Exhibitor/Sponsor as opt-in extras). Also confirms exact recommended image dimensions (logo 300×300, background 1500×500) worth reusing as defaults.

---

## 7. image4.png — Public CFP page: `/submit/:eventSlug/:uuid` — Step 1 "Welcome!"

**Screen/route:** `appv2.sessionboard.com/submit/ai-engineer-sandbox-event/034fa450-8851-4c25-bf01-5252dbb...` — the **public-facing**, unauthenticated Call-for-Papers submission form that speakers land on. Different subdomain (`appv2`) from the organizer app, and a different visual register entirely — this is a **standalone, centered single-card wizard**, not the dashboard shell.

**Layout structure:**
- Full page: light neutral-grey background (~#F4F5F7), no top nav, no sidebar at all — fully de-chromed for external/public visitors.
- Single centered white card (rounded corners ~16-20px, soft shadow, max-width ~1100-1200px, generous internal padding ~48px), vertically centered-ish, floats on the grey backdrop.
- **Step indicator / progress bar** at the very top of the card: a horizontal 5-step breadcrumb-style stepper:
  1. **① Welcome!** — current/active step: filled blue circle number badge (white numeral), blue bold label text.
  2. → **② Account** — inactive: grey outline circle, grey label.
  3. → **③ Submission** — inactive: grey circle, grey label.
  4. → **④ Participant** — inactive: grey circle, grey label.
  5. → **⑤ Review** — inactive: grey circle, grey label.
  - Steps connected by thin grey arrow/chevron separators ("→"), left-aligned as a single horizontal row.
- Below stepper: a bordered info callout box (light background, thin grey border, rounded ~8px, centered text, two lines):
  - "Form submissions will be accepted until **September 15 at 11:59 PM PDT.**"
  - "Submission Limit: 3 submissions per user"
- Below that: free-form rich-text content area (this is organizer-authored CMS/markdown content, not a fixed template) rendered with standard heading/paragraph/list/link styles:
  - H1: "Welcome to our event!" (large bold, ~28-32px)
  - H3: "Call for Speakers" (bold, ~18-20px)
  - Body paragraph: "Our event is the premiere event welcoming leaders, practitioners, and change-makers from all around the world to collaborate and learn from the best. Sessions for our agenda will be selected from these submissions."
  - Body paragraph: "Our conference will take place on X date at Y time." (placeholder tokens X/Y left un-filled in this sandbox — organizer template copy)
  - Body paragraph: "Here are the different tracks we offering:" (sic — minor grammar typo preserved from source, i.e. organizer-entered copy, not a system string)
  - Bulleted list: Topic A / Topic B / Topic C / Topic D
  - Paragraph: "If you're interested in submitting a topic for us to consider, please use the following form. You can use the portal to keep up to date on the status of your submissions. If approved, you'll receive a list of tasks to complete within the portal." — this line is important: it tells the speaker that after CFP submission, they get a **portal** with a **task list** for onboarding (ties back to the "Portals" + "Tasks" docs sections in image6).
  - H3: "Helpful Tips and Important Information"
  - Bulleted list of blue underlined links: "Speaker Agreement Terms and Conditions", "FAQs for Speaker Application Process", "Speaker Tips and Resources Guide"
  - H3: "Dates and Deadlines"
  - Bulleted list: "Call for Speakers will open **X Date.**" / "Presentation submissions are due by **Y Date,** by **11:59 PM EST**" / italic aside "*(Late submissions will not be accepted, no exceptions.)*" / "Our event will take place the week of **X Date.**"
- Page cuts off at the bottom mid-scroll; a small dark horizontal "grabber" bar is visible at the very bottom center (likely a mobile-preview/scroll affordance artifact in the screenshot, not product UI) plus the edge of a blue button (presumably "Continue"/"Next" — not fully visible but color/position consistent with primary CTA to advance to Step 2 "Account").

**Visual style:**
- Card background: pure white, page background: light cool grey.
- Stepper: filled blue circle (~28px) for active step, outlined grey circle for inactive/future steps — a very standard numbered-wizard pattern; no checkmarks shown yet (implies checkmarks would appear on completed steps once advanced past them).
- Callout/info box: neutral (not red/yellow warning-colored) — grey/white bordered box, centered text, used for logistical constraints (deadline + submission cap) rather than error/warning styling.
- Typography: same sans family as the rest of the product; headings bold dark navy, body text regular dark grey (~#3A3F4B), links blue underlined (same blue as elsewhere, ~#2F5CE0).
- Content is clearly CMS-driven rich text (organizer can embed headings, paragraphs, bulleted lists, links, and bold/italic inline formatting) — the clone should support a rich-text/markdown editor for this welcome content in the organizer settings (this maps to the "Submission Forms" settings entry seen in image29, described as "Submission form appearance and content").

**Interactions implied:**
- Multi-step wizard (5 steps: Welcome → Account → Submission → Participant → Review) with forward-only linear progression visualized as a horizontal breadcrumb; likely clickable back-navigation once a step is completed (not visible here since only step 1 is active).
- A primary CTA button (cut off at bottom, blue) to proceed from Welcome to Account.
- The "Account" step (step 2) strongly implies the speaker must create/log into an account before submitting — i.e., the CFP form requires identity (email/password or magic link) before collecting submission content, which then unlocks their personal "portal" for tracking status.

**Organizer-relevant takeaways:** This is the single most important public-facing surface — it must support: (a) organizer-configurable submission window + per-user submission cap shown prominently up top, (b) fully custom rich-text welcome/instructions content, (c) a clear 5-step mental model speakers can see progress through, (d) linking out to organizer-hosted policy docs (speaker agreement, FAQ, tips guide), and (e) messaging that sets expectation of a follow-up "portal" experience post-submission for task tracking.

---

## Synthesis — Common Design Language Across the App

**Navigation model:**
- The **authenticated organizer app** uses a persistent **3-tier nested navigation**: (1) slim top bar with global search + utility icons + avatar, (2) a global left sidebar scoped to the *current event* (with an event-switcher control pinned at the top) listing top-level modules (Dashboard, Program, CRM, Marketing, CMS, Reports, Studio, History, Event Team, Preview, Settings), and (3) for any module with sub-pages (like Settings), a second, narrower local sidebar listing that module's sub-sections, with its own tinted page-header banner. Content-heavy sub-pages (like Settings → Overview) additionally use a grouped-card "index" layout to fan out into third-level pages.
- The **public CFP page** deliberately drops all of that chrome — no top bar, no sidebars — replaced by a single centered card with a horizontal numbered-step wizard. This is a hard visual/UX split between "internal tool" (dense, sidebar-heavy, information-dense) and "public form" (minimal, centered, guided, one-thing-at-a-time).
- The **marketing site** and **docs site** each have their own independent nav patterns (mega-menu dropdown; 3-column docs layout) — not shared chrome with the app, but they do share the exact same logo lockup and blue/mint brand palette.

**Color system (estimated hex):**
- Primary blue (buttons, active states, links): `#2F5CE0` – `#3B5FE0` range.
- Dark navy body/heading text: `#1B1E27` – `#1F2338`.
- Secondary/muted grey text: `#6B7280` – `#8A94A6`.
- Borders/hairlines: `#E5E7EB` – `#D8DCE3`.
- Light blue tint (active nav pill bg, icon badge bg, settings header banner bg): `#E4EBFC` – `#EEF1FC`.
- Success/selected green (checkmark badges): `#22C55E`-ish.
- Required-field red asterisk: standard red `#EF4444`-ish.
- Page background (public CFP): light neutral grey `#F4F5F7`.
- Mint-green gradient accent (marketing only): `#B8F0D4`-ish, paired with light blue in gradients.

**Typography:**
- One sans-serif family throughout (grotesque style, Inter/Söhne-like) used across marketing, docs, and app.
- Scale roughly: H1 ~22-32px bold, H2/section headers ~18-20px bold, body/labels ~14-16px regular/medium, helper/meta text ~13px grey, tiny counters/badges ~11-12px.
- Docs site uses a heavier/larger heading weight than the app itself, which favors medium-weight labels over big display type (app is a "tool," docs page is "editorial").

**Spacing & shape system:**
- Consistent ~8px corner radius on inputs, buttons, icon badges, and small cards; ~12-16px on larger cards/panels; fully round on avatars/status dots/circular icon buttons.
- Icon badges are a recurring atomic component: a tinted rounded-square (~40x40px) containing a single-color line icon — used identically in the marketing mega-menu and the app's Settings Overview tiles.
- Forms use label-above-field with consistent ~44px input height, red-asterisk for required, small "(i)" info icons for contextual help, and live character counters on long-text fields.
- Selectable "feature toggle" cards (Exhibitors/Sponsors) use a distinct pattern: large icon-centered card, blue border + green corner-badge checkmark when selected — worth reusing anywhere the clone needs multi-select "which of these do you want" choices (vs. plain checkboxes).
- Primary actions are always solid blue rounded buttons, bottom-left of the form they belong to, following a hairline divider that separates the button from the form content above it.

**Non-technical-organizer conveniences observed:**
- Every settings link in the Overview index has a one-line plain-English description (no jargon) — organizers understand what a link does without opening it.
- Contextual "(i)" info icons on nearly every non-obvious field (Event Type, Website URL, Location, Timezone, Starts/Ends At) — implies hover tooltips are relied on heavily instead of dense inline help text.
- The Theme field explicitly explains *why* it matters ("helps improve search, recommendations, and how content is organized") — a pattern of justifying "why we're asking" rather than just labeling the field.
- The public CFP page surfaces submission-window and per-user-limit constraints in a highly visible callout at the very top, before any form field — organizers clearly want speakers to see deadlines before they invest time filling out the form.
- The CFP welcome copy explicitly tells speakers what happens after they submit (a portal + task list), reducing "black box" anxiety for non-technical external users.
