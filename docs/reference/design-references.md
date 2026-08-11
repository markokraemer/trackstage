# Design references — the products we're stealing from

**Why this doc exists.** Rule 20 says the current UX/UI is *liked* but "too blue… a bit too sassy",
and the direction is neutral-first, "boring business sauce", corporate but not boring. Rule 19 says
one agent does a final reconciliation pass over the whole app. This file is the evidence base for
that pass: what each reference product actually does (measured, not vibes), which of *our* surfaces
it maps onto, and what to deliberately leave behind.

**Our surfaces**, referenced by name throughout:

| Surface | Where it lives |
| --- | --- |
| Submissions table | `src/routes/app/submissions/*`, `src/components/submissions/*` |
| Agenda day/week view | `src/routes/app/agenda/*`, `src/components/agenda/*` |
| Speaker portal | `src/routes/portal/*`, `src/components/portal/*` |
| Public submit flow | `src/routes/submit/*`, `src/components/submit/*`, `src/components/public/*` |
| Settings / multi-tenant | `src/routes/app/settings/*`, `src/components/settings/*` |
| Dashboard | `src/routes/app/index.tsx`, `src/components/dashboard/*` |
| Landing | `src/routes/index.tsx`, `src/components/marketing/*` |
| Design system | `src/routes/design-system.tsx`, `src/components/brand/*` |

**Reference hierarchy** (Marko's steer, 2026-08-11):

1. **Attio — THE gold standard.** "The right company to take." Caveat: *"too minuscule in a lot of
   aspects"* — we take Attio's **system** (neutral palette, hairline/alpha borders, table + filter +
   saved-view craft, quiet hierarchy, restraint) and explicitly **reject its density**. We keep our
   comfortable sizing.
2. **Stripe — right next to it.** Settings IA, multi-tenant switcher, empty-state copy formula,
   saved-views-as-tabs, semantic status cells.
3. **Luma** — public surfaces only (submit flow, speaker portal, public agenda, landing register).
4. **Notion Calendar (Cron)** — the agenda day/week grid, exclusively.
5. **Juicebox** — secondary; brand/feel candidate.
6. Linear (speed, filters, review queue), Vercel/Geist (token architecture, brand page), Cal.com
   (open-source scheduling in our exact category — its token file is the single most liftable
   artifact here), Sessionize (the competitor we're beating).
7. **Mercury — considered, rejected.** See the note at the end.

**Method note.** Most of this doc comes from the products' own sites, help centres, design-system
docs, engineering blogs, and — where it mattered — their **served CSS/JS bundles**, which is how the
exact token values here were obtained. Unofficial community "DESIGN.md" reconstructions are flagged
as such and are never used as the authority for anything.

Direct `WebFetch` of mobbin.com returns HTTP 403, but a **Mobbin MCP server became available
mid-research**, and real screen sets were reviewed for **Attio, Juicebox, and Luma** (marked
🖼 **Mobbin-verified** below — these are observations from actual product screenshots, and they both
confirm and in one case *correct* the CSS-derived findings). **Notion Calendar is not in Mobbin's web
library** — a search for its day/week grid returns Notion's *database* calendar view, not the
standalone app — so §4 remains sourced from Notion's own full-resolution product screenshots on
`images.ctfassets.net`. Linear, Stripe, Vercel, Cal.com and Sessionize were not cross-checked against
Mobbin; their sections rest on published design-system docs and served bundles, which for those five
is the stronger source anyway.

---

## 1. Attio — the gold standard

CRM. Near-monochrome surfaces, one sparingly-used accent, spreadsheet-grade tables.
Sources: [attio.com](https://attio.com/) · [help/…/define-your-data-model-objects-lists-and-views](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views) ·
[help/…/create-and-manage-table-views](https://attio.com/help/reference/managing-your-data/views/create-and-manage-table-views) ·
[help/…/filter-and-sort-views](https://attio.com/help/reference/managing-your-data/views/filter-and-sort-views) ·
[help/…/configure-record-pages](https://attio.com/help/reference/managing-your-data/records/configure-record-pages) ·
[help/…/navigating-your-workspace](https://attio.com/help/reference/productivity-collaborating/navigating-your-workspace) ·
[engineering/blog/react-data-list](https://attio.com/engineering/blog/react-data-list-building-virtualized-uis-declaratively) ·
[Design at Attio](https://verifiedinsider.substack.com/p/design-at-attio) · [opensourceceo.com](https://www.opensourceceo.com/p/attio-beautiful-design)

### (a) What it does exceptionally, mapped to our surfaces

**Their four stated design principles** — worth taping to the wall, because they *are* the answer to
"corporate but not boring":

> **Restraint** — "Nothing is asking for your attention. **The best version always has less in it
> than the one before.**"
> **Honesty** — "It is what it is, no more, no less."
> **Inevitability** — "It couldn't have been done any other way. Nothing is missing, nothing is
> forced, nothing is accidental."
> **Charm** — "When something stops trying to please and starts being itself."

The fix for "too blue" is not *a different colour*. It's **less of everything else, so the little
colour that survives means something.**

**Object / List / list-entry → our data model, and therefore our tables.** An *Object* is an entity
type; a *List* is "a group of records pulled from a specific object, used to represent a workflow,
project, or segment"; joining a list creates a **list entry**, and "it's where list-specific
attributes live." That is exactly **Speaker (global person) vs Submission-to-this-event**. Status,
track, rating, reviewer, room belong to the entry, not the person. Their rule: *"use a custom object
to model new data, and use a list to organize existing data for a process or workflow."*
→ **Submissions table**, **speaker portal**, **multi-tenant**.

**Table views → submissions table.** "A spreadsheet-style layout" where you "filter, sort, and edit
data directly in your table." Specific mechanics worth copying:
- A **trailing `+` button to the right of the final column** offering *pick an existing attribute*
  **or** *+ Create new attribute*. Schema extension happens in the table, not in a settings screen.
  Organizers invent fields (dietary needs, A/V requirements, travel funding) — let them.
- **Column resize by hovering the cell edge** — handle revealed on hover, no persistent grip.
- Reorder by dragging the header, or header dropdown → **⭠ Move left / Move right ⭢**. Hide via
  **Hide attribute**.
- **Inline edit**: click a cell, `Enter` commits.
- **Range select + `Cmd+C`/`Cmd+V`, including to and from external spreadsheets**, pasting only where
  the source cell type matches the destination attribute type. Event organizers live in Google
  Sheets — this is both the migration on-ramp and the retention moat.
- Column-level calculations on numeric columns (→ average score per track).

**Attribute types → our field types.** Status, User, Select / Multi-select (colour-coded), Text,
Date/Timestamp, Number, Currency, Checkbox, **Rating (1–5 stars)**, Record reference, Relationship
(bidirectional), Location. Note that **Rating is a first-class primitive**, not a bolt-on widget —
that's our reviewer score.

**Filter builder → submissions table + agenda.** `Filter → attribute → condition ("is", "is not",
"contains") → value`, stack more with `+`. A `⋮` on any condition offers **"Convert to advanced
condition"**, which is the *only* way to reach nested groups with an And/Or toggle. Simple filters
never show the boolean machinery. Sort: attribute → Asc/Desc, multiple keys reordered by a `:::`
drag handle.

**The save model — copy this verbatim.** Three options at save time: **"Save for everyone"** (primary
button), an arrow next to it revealing **"Save as new view"**, and **"Discard changes"**. Unsaved
filter state is a live, explicitly-reconcilable diff against the saved view. It removes the "did I
just change everyone's view?" fear that kills shared views in every other product.

**Record page anatomy → speaker portal + submission detail.** Three zones:
1. **Left panel** — a mandatory *Record Details* section + a mandatory *Lists* section (list
   memberships), **resizable via a draggable divider**, inline-editable, drag handles reorder
   multi-value fields, **right-click a value → "View edit history."**
2. **Centre, tabbed** — Overview / Activity / Emails / Files / Notes / Tasks / Calls, plus `+ Add
   tab`, drag or `⋮ → Move left/right` to reorder.
3. **Overview tab: up to six "highlight widgets"** — pinned at-a-glance attributes. A **hard cap of
   six**, not a soft guideline. Ours: status, track, session count, travel status, confirmation,
   last contact.

**Configuration is admin-gated and type-wide.** `⋮ → Configure page` applies to *all* records of that
object type. Layout is a schema decision, not a per-user preference. Correct for us: the org admin
defines what a speaker record looks like; individual reviewers don't each get a bespoke layout.

**Action bar, upper-left of the record**: Compose email, Add to list, New note, Run workflow, New
task — reorderable behind an explicit **Edit** button. Ours: Email speaker, Add to session, Add note,
Create task.

**Permissions → settings/multi-tenant.** Per-object **Full access / Read and write / Read only**,
resolved **most-permissive-wins** across workspace-default → team → individual: more specific
settings can only *add* access, never subtract. Simple enough that a conference chair can reason
about it out loud. Ours: organizers Full, reviewers Read+write on submissions only, speakers Read
only on their own.

**Workspace switching**: click the **workspace name, upper-left of the sidebar** → dropdown with
other workspaces + Account settings + (admin only) Workspace settings. **Linear does exactly the
same thing** — two independent products converged, so just do it.

**Two keys, two jobs.** `Cmd+K` = Quick Actions, contents change contextually by location. `/` =
global search. `?` = help + shortcut list. Search and command are **never merged**.

**Forms.** Attio ships **no native form builder**; the ecosystem fills it, and the good third-party
pattern ([attio.com/apps/forms-app](https://attio.com/apps/forms-app)) **derives the public form from
the workspace schema** — attribute types become input types, select options become dropdown options.
That is precisely how our **form builder → public submit flow** should relate: the organizer
configures the submission schema once; the public page is *generated*, not separately authored.

**Reports → dashboard.** A *Report* = one chart over an object/list; a *Dashboard* = a page holding
several. Report `⋮ → Edit / Delete / **Download as image**`. That last one matters enormously for our
audience — organizers put charts in board decks and sponsor reports. Their pipeline report types
(**Funnel, Time in Stage, Stage Changed**) map cleanly onto submitted → under review → accept queue →
accepted → confirmed, with time-in-stage exposing review bottlenecks.

**Performance → submissions table at scale.** They open-sourced
[React Data List](https://attio.com/engineering/blog/react-data-list-building-virtualized-uis-declaratively):
deliberately does *not* implement its own virtualizer, wraps existing ones, uses `getItemType` for
type-aware row recycling, renders in-viewport items "often with some overshoot to help prevent blanks
when scrolling," and lets rows compose with ordinary React idioms. Relevant the moment a CFP passes
~800 submissions.

**Landing.** Dual CTA — "Talk to sales" **and** "Start for free" side by side. A **tabbed platform
overview across five motions**, each with an interactive mockup carrying realistic sample data
(better than five stacked screenshots for a multi-surface product like ours → CFP · Review · Schedule
· Speakers · Day-of). Named testimonial with title + company. A hard number ("Trusted by 30,000+
customers"). Logo wall. **Colour used almost entirely for data semantics** — risk red, positive
highlighted — never decoration.

### 🖼 Mobbin-verified — what the real screens show

Screens: [table + sort popover](https://mobbin.com/screens/162a06bc-8151-456b-8590-044508c2bfa1) ·
[condition dropdown](https://mobbin.com/screens/6dd2d5c3-e23c-4f63-b299-9e00f308be10) ·
[aggregation menu](https://mobbin.com/screens/9b7cd195-28c6-472d-a3f3-4c3b93f8362b) ·
[collapsed sidebar](https://mobbin.com/screens/e1fcdf36-7726-4a8a-9ca7-7188daa3be36) ·
[active filter](https://mobbin.com/screens/1feec693-b9aa-4028-8c79-0271a6b7e4d5) ·
[currency aggregation](https://mobbin.com/screens/a44be622-b84a-4805-ad7a-6f600ece6356)

- **⚠️ Nuance on "near-monochrome": Attio's chrome is monochrome, but its *cells* are not.** The
  Categories column is a wall of soft-tinted multi-select pills (B2B blue, B2C purple, E-commerce
  green, Finance amber, Internet violet…) — genuinely colourful. The discipline is precisely the one
  Stripe writes down: **colour belongs to data, never to chrome.** Sidebar, toolbar, headers, borders
  and backgrounds are all gray; the only saturated pixels are tag pills, status dots, and the Save
  button. This is the single most transferable observation in the doc.
- **In a dense table, status is a coloured dot + plain text, not a filled pill.** The "Connection
  strength" column renders `● Very weak` / `● Very strong` / `● No communication` — an 8px dot plus
  ordinary body text. Filled pills are reserved for the multi-select tag columns. → **our submissions
  table should use dot + text for status and keep `StatusPill` for detail pages and drawers**, which
  is exactly Vercel's "subtle level for dense surfaces" rule arrived at independently.
- **The three-way save is confirmed, and its placement is specific**: `Discard changes` as a plain
  text link sitting immediately left of a **blue split-button `Save ⌄`**, both at the far right of
  the filter bar — visible *only* while the view is dirty. Blue appears here and essentially nowhere
  else on the screen.
- **Filter chips read as a sentence**: `⇅ Sorted by Record ID +1` · `👤 Employee range less than
  [1K-5K]` · `+`. The **value is a nested tinted chip inside the filter chip**, and the `+1` overflow
  counter collapses extra sort keys.
- **Condition vocabulary is plain English, confirmed on screen**: `is / is not / less than / greater
  than / empty / not empty`. No boolean UI visible anywhere by default.
- **Column-footer aggregations are a real, prominent feature** — every column ends in a `+ Add
  calculation` affordance, opening `Count empty / Count filled / Percent empty / Percent filled / Sum
  / Average / Min / Max`, and the row also carries a live `13 count`. Results render right-aligned in
  the footer (`US$85,325,000.00 avg`). → **our submissions table footer should show count, average
  score, and % reviewed**, which is a genuinely useful organizer readout we'd otherwise have built as
  a separate stats card.
- **Sort popover**: `Record ID` + `Descending` + `✕` per key, then `+ Add sort` and a muted
  `ⓘ Learn about sorting` link — inline docs at the point of confusion.
- **Sidebar structure confirmed**: workspace name `ASMobbin ⌄` top-left, then `Quick actions ⌘K` and
  a `/` search row, then `Notifications / Tasks / Notes / Emails / Reports / Automations`, then
  grouped `Favorites`, `Records`, `Lists`. Footer carries `Invite teammates`, `Help and first steps
  ⤢ 3/6`, and a trial banner. Collapsible via a toggle with a `Collapse sidebar ⌘\` tooltip.
- **Row height is visibly tight (~36px) and column headers are ~11px** — direct visual confirmation
  of Marko's "too minuscule" note, and of why we take the system but not the sizing.
- **Views-as-dropdown is confirmed** (`▦ All Companies ⌄`, `▦ Non-US Companies ⌄`) — which supports
  the "what NOT to take" call below: we want a visible tab strip instead.

### (b) Concrete stealable patterns

- Near-monochrome **chrome** + colour confined to data cells. Four independent sources converge on
  this; it is the whole visual thesis.
- Status as **dot + text** in dense tables; filled pills only on detail surfaces.
- Column-footer aggregations (`count`, `average`) as a built-in readout.
- Three-way save: **Save for everyone / Save as new view / Discard changes**, with unsaved state
  shown as a diff.
- Boolean logic hidden behind **"Convert to advanced condition"** until asked for.
- Trailing `+` column that can create a new attribute inline.
- Hover-revealed resize handle at the column boundary; no persistent grip.
- Six-widget cap on the record overview. Hard cap, not guidance.
- Most-permissive-wins permission resolution.
- Workspace name upper-left → dropdown.
- `/` search, `Cmd+K` actions, `?` shortcuts — three keys, three jobs.
- Schema generates the public form.
- Chart → **Download as image**.
- Their note that **"clear, semantic naming and thoughtful structure"** matters more now because the
  design system guides AI tooling as much as humans → our tokens should be semantic
  (`--surface-raised`, `--border-subtle`) rather than palette-named.

### (c) What NOT to take

1. **The density.** Marko's own words: Attio is *"too minuscule in a lot of aspects."* This is the
   explicit carve-out — we take the system, not the sizing. Our controls stay ≥36px, our table rows
   stay comfortable (see change #6), our body text stays 14–16px. Attio is built for someone who
   lives in it 8h/day; a program chair opens ours a few weeks a year.
2. **The vocabulary.** "Objects / Lists / List entries / Attributes / Records / Views" is CRM-schema
   language. Borrow the *model*, ship *our* nouns: Speakers, Sessions, Abstracts, CFP, Submission,
   Field, Track, Room. (Linear's Method: *"Don't invent terms if possible."*)
3. **Unbounded configurability.** CRMs are genuinely idiosyncratic; conferences have a known shape.
   Ship strong opinionated defaults — a working CFP form and review pipeline out of the box — and
   expose customization as a second layer. Linear again: *"Your tools should not make you the
   designer and maintainer of them."*
4. **A 13-destination sidebar** (Home, Search, notifications, Tasks, Notes, Emails, Calls, Reports,
   Sequences, Workflows, Favorites, Records, Lists, Chats). That's a CRM's surface area. We keep our
   flattened grouped nav.
5. **Views as a dropdown under the list name.** Discoverable for a daily CRM user, invisible for a
   quarterly organizer. Our 3–5 canonical views want a visible tab strip / segmented control
   (Stripe's pattern); the dropdown is only for the long tail.
6. **Sequences / drip-email machinery** as a headline feature (their sync-mailbox cap is 12 emails/hr,
   200/day). We need speaker comms, not a campaign engine.
7. **"Agentic revenue" / "Universal Context™" landing copy.** Trademarked coinages and AI-first
   framing are wrong for a buyer who wants to know whether their CFP closes on time.
8. **Spreadsheet range-select everywhere.** Right in the reviewer grid; alien and frightening in the
   speaker portal or a public form. Confine it.
9. **The circulating `#3ABDAF` teal and its token set.** It comes from a self-declared *unofficial*
   community file that states it is "not necessarily affiliated with any brand referenced." Attio
   publishes no public colour or type spec. Take the *principle* (near-monochrome + one sparing
   accent); pick our own hue. Do **not** put that hex in our tokens on Attio's authority.
10. **Assuming Attio solved density.** Row-height modes and sticky first columns are undocumented in
    their help centre. Get those conventions elsewhere (Airtable publishes named tiers: Short /
    Medium / Tall / Extra Tall, defaulting to Short).

---

## 2. Stripe Dashboard — the boring-business-sauce gold standard

Sources: [docs.stripe.com/dashboard](https://docs.stripe.com/dashboard) · [/dashboard/search](https://docs.stripe.com/dashboard/search) ·
[/sandboxes](https://docs.stripe.com/sandboxes) · [/get-started/account/orgs](https://docs.stripe.com/get-started/account/orgs) ·
[/connect/dashboard/review-actionable-accounts](https://docs.stripe.com/connect/dashboard/review-actionable-accounts) ·
[/stripe-apps/design](https://docs.stripe.com/stripe-apps/design) · [/patterns/empty-state](https://docs.stripe.com/stripe-apps/patterns/empty-state) ·
[/patterns/lists](https://docs.stripe.com/stripe-apps/patterns/lists) · [/patterns/filter-controls](https://docs.stripe.com/stripe-apps/patterns/filter-controls) ·
[/patterns/communicating-state](https://docs.stripe.com/stripe-apps/patterns/communicating-state) ·
[components/datatable](https://docs.stripe.com/stripe-apps/components/datatable.md?app-sdk-version=9) ·
[mattstromawn.com/projects/stripe-dashboard](https://mattstromawn.com/projects/stripe-dashboard/) · [portfolio.chsmc.org/sail](https://portfolio.chsmc.org/sail)

### (a) What it does exceptionally, mapped to our surfaces

**Colour restraint is written down as policy.** In-product: *"Colour is reserved for status signals:
green for succeeded, red for failed, yellow for pending."* Home sparklines are **monochrome**, not
coloured. Third-party brand colour in Stripe Apps is quarantined into exactly one element — the **app
indicator**, a colour bar + icon at the top — and their guidance says custom styling is
*"intentionally limited… we limit the colors you can use for each element because color contrast is
an important aspect of accessible UI."* One element is the entire brand-expression budget.

⚠️ The widely-cited Stripe hexes (`#533afd`, `#f6f9fc`, `#0d253d`, `#64748d`, `#e3e8ee`) are
**marketing-site derived, not dashboard**. Don't quote them as in-product tokens.

**Typography.** One family (Söhne, `sohne-var`), **weights 300 and 400 only** — the entire hierarchy
is size + colour + spacing, no weight games. `ss01` on, and **`tnum` tabular numerals on every
financial figure**. Roughly six sizes in-product.

**Sail's migration order.** 100+ pages over two years, and they shipped foundations **typography,
spacing, colour first**, deliberately paving the way for a **card-less system**. Colour tokens were
**auto-generated from WCAG contrast algorithms** rather than hand-picked. Our reconciliation pass
should follow the same order: tokens → spacing → components → pages.

**The Connected-accounts list → our submissions table, one-to-one.** This is the single highest-value
pattern in the whole document:
- A row of **status tabs** across the top (All / Restricted / In review / Rejected / Enabled). Tabs
  *are* the primary filter. Ours: All / Pending / Accept Queue / Decline Queue / Accepted / Declined
  / Withdrawn.
- **Saved custom views**: define columns + filters + sorting → **Save list** → name → **Save as new
  list**. The saved view **appears as another tab in that same row**, is **drag-repositionable**, and
  gets an **overflow `⋯` on hover** for duplicate/rename/delete. Views are per-user; default status
  tabs can't be deleted but their columns can change. A program chair's real workflow is *"my review
  queue" / "needs a second reviewer" / "accepted, awaiting confirmation"* — that's three saved tabs,
  and it's the feature that makes the product feel built for them.
- **Edit columns** per view: add, remove, rearrange.
- **Default filters below the status tabs**; **More filters** opens grouped categories. Ours:
  Speaker / Session / Review / Tags / Custom questions.
- **Export** top-right, exporting the *current filtered view*.

**`DataTable` primitive**: column pinning, resize, drag reorder, checkbox batch selection, three
pagination modes with an **"x–y of z results"** caption. Cell types are **semantic, not styled** —
`text | link | date | id | status | currency`. **IDs render monospace.** Status cells take a
`statusMap` restricted to **six semantic states** — `neutral | urgent | warning | negative | positive
| info`. There is **no raw colour API**. Our `StatusPill` should work the same way: statuses map onto
semantic tokens and nobody ever writes a hex in a table cell.

**Search grammar → submissions table.** One global bar across all object types; `?` opens the
shortcut sheet. Filter grammar (`amount:`, `status:`, `email:`, …) with `>` `<` `..` operators, `is:`
for both object type and state, `-` to negate, quotes for phrases, natural-language dates
(`date:yesterday`). Top results inline; Enter expands to grouped results **with sortable column
headings**. Crucially: **search terms live in the URL, so a search is bookmarkable and shareable.**
Ours: `speaker: track: status: tag: submitted:` — and URL-shareability matters *more* to event
organizers than to Stripe's users, because their whole workflow is pasting links into Slack and
email. (Linear does the same, and documents the caveat that only main filters serialize.)

**Settings IA → our settings/multi-tenant.** Three explicit categories: **Personal, Account,
Product.** Ours maps cleanly to **Personal / Organization / Event**, which resolves the multi-tenant
question in one stroke (my settings vs my org's settings vs this event's settings). Nav labels are
**job-based, not model-based** ("Payments", "Payouts", "Disputes"), and the sidebar carries a
**Shortcuts** section of pinned + recently-visited pages.

**Multi-tenant switcher.** A **Dashboard account picker** — and sandboxes live *inside* it, as a peer
of accounts rather than a global mode toggle. **Organizations** add an org-level dashboard with
cross-account lists **filterable by account**, where clicking a record gives you **a deep link into
that record within its owning account**. That is exactly our multi-event story: an org-level rollup
(all submissions across all events, filterable by event) with deep links into the owning event.

**Empty states — the official formula, no illustration.**
- **Title**: states what's missing, short phrase, **ends with a period**, no promotion.
  Good: `No successful payments.` Bad: `Try creating your first payment to get started!`
- **Description**: explains *when* data appears, **under 14 words**, active voice.
  `Payments appear here after your first sale.`
- **Action**: call-and-response with the title — `No customers yet` → `Add customer`. **Never "Get
  started".**
- **Two distinct empties**: filtered-to-zero vs never-had-data. *"Don't show a 'create first item'
  call to action when items exist but are filtered out."* The filtered variant pairs with a **Clear
  filters** link in the filter bar.
- **Section-level empty**: a **1px dashed neutral border box**, medium radius, large padding, title
  in body font **not bold**, description in caption/secondary, centred.
- Render order is mandated: **loading → error → empty → content.** Empty ≠ error.

**Filters.** Chips above the table, two states: **Suggested** (`+`, opens a menu) and **Active**
(shows the value + `✕`). Rules: *"Match filter labels to column headers"*; **Clear filters** appears
only when ≥1 filter is active.

**Banners vs toasts — a hard decision table:**

| | Toast | Banner |
| --- | --- | --- |
| Display | Temporary, always triggered by user action, auto-dismisses | Persistent, can appear anytime, dismissal requires an action |
| Content | **< 4 words, one line, max 30 characters** | Title + body, medium-to-long |
| Action | Optional | **Required** |
| Position | Bottom | Under the header |

Ours: toast for "Session saved", "Speaker invited". Banner **with a CTA** for "CFP closes in 2 days",
"3 speakers haven't confirmed".

### (b) Concrete stealable patterns

- Saved-views-as-tabs, drag-orderable, `⋯` on hover. **The highest-value single pattern here.**
- Six semantic status states; no raw colour API in table cells.
- `tnum` tabular numerals on scores/counts/dates; monospace IDs.
- Filter chips: Suggested (`+`) vs Active (value + `✕`); labels match column headers.
- Empty-state copy formula, including the two-variant rule and the dashed-border section empty.
- loading → error → empty → content render order.
- Toast ≤30 chars / Banner requires a CTA.
- Settings as Personal / Organization / Event; job-based nav labels.
- Org-level rollup + deep link into the owning tenant.
- URL-encoded search and filter state.

### (c) What NOT to take

- **The typed grammar as the only path.** `is:charge -exp:08/22` is a developer affordance. Ship the
  chip/menu filter bar as primary and the grammar as an accelerator; never require syntax.
- **Weight-300 body text.** Söhne 300 at 14px works because Stripe controls the font. In a system
  stack it renders anaemic. Keep 400/500 and get hierarchy from colour + size.
- **A sidebar that scales with products.** Stripe's own acknowledged weakness. Ours stays flat.
- **Code snippets in empty states.** Theirs shows an API call; ours shows "Share your CFP link".
- **"Comprehensive rather than opinionated"** — Stripe cites its own reports section as the failure
  mode. Be opinionated.
- **A persistent onboarding checklist in the sidebar.** Reads as nagging to someone running one
  conference a year.

---

## 3. Luma — event-native simplicity (public surfaces only)

Marko's own reference, and the origin of the "too blue" hypothesis. Liked, but **too playful**. The
good news, verified in their served CSS: *everything playful in Luma is isolated in the theme layer
and is trivially separable from the layout system underneath.*

Sources: [luma.com](https://luma.com/) (lu.ma now 301s here) · [luma.com/create](https://luma.com/create) ·
[luma.com/tech-europe](https://luma.com/tech-europe) · a live public event page ·
`luma.com/_next/static/immutable/chunks/00m1643cfi-06.css` · [help.luma.com](https://help.luma.com/) ·
[Event Themes](https://help.luma.com/p/event-themes-and-customization) · [Creating an Event](https://help.luma.com/p/creating-an-event) ·
[Registration Process](https://help.luma.com/p/event-registration-process) · [Guest List](https://help.luma.com/p/managing-your-guest-list) ·
[Expanded Guest Table](https://help.luma.com/p/expanded-guest-table) · [Submitting Events to Calendars](https://help.luma.com/p/submitting-events-to-calendars)

### (a) What it does exceptionally, mapped to our surfaces

**Luma is far narrower than it looks.** From their CSS:

```
--max-width: 820px;  --max-width-wide-page: 960px;  --max-width-extra-wide-page: 1080px;
--horizontal-padding: 1rem;
```

The flagship public event page is a **two-column flex, not a grid**: `.event-page-left { width:330px }`
(300px <1000, 280px <820, 100%/max-400px centred <650) and `.event-page-right { flex:1 }`, total
~820px. Left rail = cover + hosts + guest avatars. Right = title, date/time block, location block,
**Registration card**, About Event. One scroll, no tabs. → **Public submit flow** and **public session
page**: resist making these app-width.

**The single best trick Luma has — the per-event tint recolours the *neutrals*, not the UI.** The
event payload carries `"tint_color":"#146AEB"`, and a `.tint-root` element **re-derives the entire
gray ramp** from that hue. Note how *little* the grays move — a couple of percent — and that the
accent surfaces as a ~2–8% wash on borders/backgrounds, a barely-tinted black
(`--black-base-rgb: 0, 17, 53` instead of neutral), and the primary button. **That is the entire
"branded" feel.** No coloured headers, no coloured nav, no coloured cards. This is precisely the
mechanism we want for per-org branding — and precisely the discipline we're currently violating.

**Borders are alpha, never solid gray.** `--divider-color: var(--opacity-8)` — 8% of the foreground —
with an `--opacity-2/4/8/16/24/32/48/64/80` ramp. Cal.com independently landed on the same technique.

**Density tokens — well-tuned, copy them:**

```
--content-card-vertical-padding:1rem;  --content-card-horizontal-padding:1.125rem;
--event-row-padding:.75rem 1rem;       --base-list-row-vertical-padding:.75rem / horizontal:1rem
--input-font-size:1rem                 /* 16px inputs — never 14px; avoids iOS zoom */
```

Inputs are flat: `--input-box-shadow:none; --input-focus-box-shadow:none; --input-focus-border-color:
var(--primary-color)`. **Focus = the border goes to full-contrast foreground. No ring, no glow, no
blue.**

**Type scale caps at 24px — there is no display type in the product.** 10/12/13/14/16/18/20/22/24,
weights 300/400/500/**600 (their "bold" — 700 does not exist)**. And the app font is a **system
stack**, not a brand face; the display face (Roc Grotesk) is loaded **per-event, title-only**.

**The calendar page is a sticky-date timeline → our agenda list/day view.** `--timeline-title-width:
7rem; --timeline-column-gap: 4rem; --timeline-sticky-header-offset: 1rem`. A 7rem left rail holds the
sticky date; events sit in the right column against a vertical hairline; below the breakpoint it
collapses to a single column with a 1.5rem line gutter. Header controls: **"Submit Event"**, "Add
iCal Subscription", and an Upcoming/Past **segmented switcher** (sliding pill with a `shadow-xs`,
1px dividers between unselected segments).

**Luma has literally already shipped our review workflow.** On a calendar, non-admins see **"Submit
Event"** → it goes to admins for review → approve/reject; admins see "Add Event" and bypass. The
pending state is a **status sentence**, verbatim:

> **"You have 0 events pending approval by the calendar admin."**
> "They will show up on the schedule once approved."

Medium-weight line + a muted second line. **No icon, no art, no button.** Luma's zero states are
status sentences — cheaper and more corporate than illustrations. → **speaker portal** pending state.

**Public registration copy, verbatim**: card heading "Registration" → "Welcome! To join the event,
please register below." → button "Register". Hosts section "Hosted By". Description "About Event".
The form requires **name + email only**; returning guests get one-click sign-in. → **Public submit
flow**: do not build an account wall in front of the form.

**Create flow is one screen, not a wizard.** Calendar picker + Public toggle → cover panel → Start /
End → "Add Event Location" → "Add Description" → an **Event Options** block of **label/value rows**
(Ticket Price · Free / Require Approval / Capacity · Unlimited / Waitlist) → one "Create Event"
button. **The label-left / current-value-right row is the pattern to steal** — it kills the
toggles-in-a-grid look in our settings pages.

**Guest management → submissions table.** Status tabs **with counts** (Going, Pending, Waitlist,
Invited, Not Going, Checked In, Not Checked In); sort by Name / Email / Registration time (default,
newest first) / Check-in time; search matches name, partial email, **and email domain**; "Bulk Update
Status"; and an **expand icon (↗) top-right that opens a full-screen table** with every registration
question as a column, shift-click range select, a "Selected (n)" bulk-action dropdown, click-to-copy
email cells. **The two-tier model — compact list inline, full table on demand — is the right answer
for a CFP table with 40 custom questions.**

### (b) Concrete stealable patterns

- 820px public page; 330px meta rail + fluid content. Narrow for public, wide for the app.
- Accent applied as a 2–8% wash + a barely-tinted black + the primary button. Nothing else.
- Alpha borders at ~8% of foreground.
- 16px inputs; flat by default; focus = border goes to foreground colour, no ring.
- Type scale that stops at 24px; 600 as the heaviest weight.
- Sticky-date timeline with a 7rem date rail.
- Segmented switcher with a sliding pill for Day/Week and Open/Closed.
- Status-sentence empty states (no art).
- Name+email-only registration; remember returning guests.
- Event Options label/value rows in settings.
- Status tabs with counts + `↗` full-screen expanded table.

### (c) What NOT to take — precisely which "playful" traits

1. **The stacked animated background rig.** A live event page wraps five siblings — `.background`,
   `.background-glow`, `.background-overlay`, `.background-overlay2`, `.background-overlay3` — for
   the Warp theme's animated gradient field. Leave all of it.
2. **The breathing cover glow.** `.cover-with-glow` renders a duplicate of the cover behind itself at
   `opacity:.2; filter: brightness(.8) blur(24px) saturate(1.2)`, plus a `@keyframes nudge`
   translating 0.1px on a `1s infinite alternate` loop. An idly-breathing hero is the single most
   consumer-feeling thing on the page.
3. **`mix-blend-mode: plus-darker / plus-lighter` on the nav.** Cute, unpredictable over arbitrary
   content, a contrast-audit hazard.
4. **The theme catalogue** — Confetti, Emoji (15+ shapes), Champagne, Bokeh, Fireworks, Polaroid,
   Matrix, Halloween, plus cover-image *frames*. Party-invite vocabulary.
5. **Per-event display fonts** (`font_title: roc-grotesk`). Letting each event pick a typeface is
   exactly how a B2B tool stops looking like one system. Ship **one** type system.
6. **`corner-shape: squircle` at 2× radii.** Squircled 1.5rem cards read toy-ish. Stay on 4/8/12/16.
7. **Emoji-as-icons and the pre-designed cover gallery** (cocktail glasses, birthday confetti).
8. **Cranberry `#f31a7c` as the default brand.** Right instinct (don't default to blue), wrong hue.
9. **The marketing voice** — "Delightful/Vivid/Stellar events start here", "Your next unforgettable
   memory awaits." Not our register.
10. **The 820px cap for the logged-in app.** Luma's data tables suffer for it — which is exactly why
    they bolted on the full-screen expanded table.

---

## 4. Notion Calendar (Cron) — the agenda grid reference

Verified by inspecting Notion's own full-resolution product screenshots
(`images.ctfassets.net/spoqsaf9291f/…` linked off the product page), not prose descriptions.
Sources: [notion.com/product/calendar](https://notion.com/product/calendar) ·
[keyboard shortcuts](https://notion.com/help/notion-calendar-keyboard-shortcuts) ·
[settings](https://notion.com/help/notion-calendar-settings) ·
[introducing-notion-calendar](https://notion.com/blog/introducing-notion-calendar) ·
[cron.com changelog](https://cron.com/changelog/2021-04-12-menu-bar-calendar) ·
[TechCrunch on Cron](https://techcrunch.com/2021/11/18/cron-is-a-new-calendar-app-following-in-sunrises-footsteps/)

### (a) What it does exceptionally, mapped to our agenda day/week view

**The event block recipe — the most valuable single finding for us.** The default block is **not** a
filled coloured box:

- Background = a very pale tint of the calendar's hue (~8–12% saturation).
- A **solid, fully-saturated left accent bar ~4–5px wide**, full block height, rounded on the left
  edge only.
- **The title text is the saturated hue, not black** — ~15px semibold. This is the trick that lets a
  dense grid read as calm while staying colour-coded: **the hue lives in the text and the bar; the
  surface stays near-white.**
- Time text below the title in the same hue, lighter weight/opacity.
- Radius ~4–6px.

Our `src/components/agenda/session-card.tsx` already renders a track-colour edge — we're most of the
way there. What's missing is the **saturated title text** and the **pale-tint surface**.

**Short-duration collapse rule.** At ≥1h, the time goes on a second line below the title. At ~30 min
or less the layout **collapses to one line with the time appended inline in muted colour** — observed
verbatim as `OR Team Lunch 1PM`. Long titles truncate with a real ellipsis. Implement as a height
threshold.

**Active/drag inverts the treatment**: the dragged block becomes a **solid saturated fill with white
bold text**, time inline in translucent white, grabbing-hand cursor. So: **quiet tint = resting,
solid fill = active/selected.**

**Overlaps use a shingled cascade, not equal-width columns.** The first event keeps near-full column
width; the overlapping one renders **narrower, offset right, stacked on top**, with the block behind
still visible. Where three or more overlap you see only the thin accent-bar stubs of the buried
blocks at the left edge. This is materially different from Google Calendar's equal-width split, and
it's the better model for us: **a genuine double-booking should look like an anomaly stacking on top
of a legitimate session, not like two equal peers.** That reads as *conflict*.

**Time axis.** Hour labels ~11px, gray, **right-aligned in a narrow gutter, vertically centred
directly on the hour gridline** (not in the middle of the slot). Gridlines are **hour-only** and very
light — **no half-hour lines** appear anywhere in the light-mode screenshots. A faint vertical rule
separates gutter from grid and bounds each day column. (Our `day-view.tsx` currently paints *both*
hour and half-slot lines via `repeating-linear-gradient`, at `rgba(15,23,42,…)` — slate-tinted.)

**The current-time indicator is dark, not red.** A bold near-black `3:40PM` label in the gutter
(displacing the neighbouring hour label) plus a thin horizontal rule. **Red is reserved exclusively
for the today chip** — a red rounded square behind the date number. Good discipline: red on the
now-line would fight our conflict/error colour.

**All-day row** above the grid, separated by a rule, with a collapse chevron in the gutter; full-width
pills. → repurpose as the track-agnostic band for Registration, Expo Floor, Lunch, Keynote.

**Chrome is extremely minimal**: avatar, a `Day ⌄` dropdown, a `Today` button, `‹ ›` chevrons — white
buttons, hairline border, ~8–10px radius. Nothing else. Nice typographic move in the date title:
**`January` in heavy black, `2024` in a lighter weight** at ~34px.

**Keyboard**: `T` today, `D`/`W`/`M` views, **number keys `1–9` set how many days are visible** (a
3-day conference is literally `3`), `⌘K` command bar, `?` shortcuts. Density is separately controlled
by **Zoom Hours In/Out**, compressing or expanding the hour row height — which directly solves our
8am–10pm conference-day problem.

**Command palette**: white card ~12px radius, large light-gray `Type a command…` placeholder, rows
with a left label and a **right-aligned single-letter keycap chip**. No row icons. Backdrop dims and
blurs.

**Three-pane shell: event detail in a right-hand panel — never a modal over the grid.** Edits apply
live on drag, no save step. → our session detail should be a right drawer, so the organizer never
loses sight of the grid.

**Multiple timezone columns** stack left of the grid, labelled in small gray caps, and are
**drag-reorderable** (lifted column renders as a white card with a shadow) — genuinely useful for
hybrid events.

### (b) Concrete stealable patterns

- Block = pale tint surface + 4px saturated left bar + **saturated title text**.
- Short-duration one-line collapse below a height threshold.
- Drag/active state = solid saturated fill, white text.
- Shingled overlap cascade (first event stays readable) as the visual language of a conflict.
- Hour-only gridlines; labels centred *on* the line in a right-aligned gutter; no half-hour lines.
- Dark now-line; red reserved for one meaning only.
- All-day band for non-track program items.
- Zoom Hours In/Out; number keys for days-visible.
- Right-hand detail panel, never a modal.
- Month-bold / year-light title typography.

### (c) What NOT to take

- Availability sharing and scheduling links — meaningless for a published fixed agenda.
- RSVP accepted/tentative/declined chips — our "RSVP" is capacity/waitlist, a different model.
- Free/busy privacy blocking — conference sessions are public by definition.
- The macOS menu-bar app and system-wide global shortcuts (the *countdown to next session* idea is
  worth keeping; the OS-chrome delivery is not).
- Multi-account calendar merging (Google + iCloud + Outlook) — a personal problem, not an organizer's.
- Drag-a-person-onto-the-grid to create — no conference analogue.
- **Their 7-colour palette as semantic.** Notion's colours are user-chosen identity; ours must encode
  track and status, so we need a fixed, meaning-bearing assignment.

---

## 5. Cal.com — open-source scheduling, our exact neighbourhood

The highest-leverage *implementation* reference in this document, because Cal.com migrated their
whole app onto **`coss.com/ui` — Base UI + Tailwind, shadcn-style copy-paste** — which is our stack
exactly. Sources: [cal.com](https://cal.com/) · [v6.6 changelog](https://cal.com/blog/calcom-v6-6) ·
[coss.com/ui/docs/styling](https://coss.com/ui/docs/styling) · [Button](https://coss.com/ui/docs/components/button) ·
[Table](https://coss.com/ui/docs/components/table) · [Empty](https://coss.com/ui/docs/components/empty) ·
[cal.com/font](https://cal.com/font) · [github.com/calcom/sans](https://github.com/calcom/sans) ·
[cal.com/platform](https://cal.com/platform) · [event types guide](https://cal.com/blog/event-types-guide-calcom)

### (a) What it does exceptionally, mapped to our surfaces

**Their token file solves "too blue" outright**, and it's from a scheduling product in our category:

```css
:root {
  --primary:            var(--color-neutral-800);   /* primary is NEUTRAL, not a hue */
  --primary-foreground: var(--color-neutral-50);
  --secondary:          --alpha(var(--color-black) / 4%);
  --background:         var(--color-white);
  --foreground:         var(--color-neutral-800);
  --border:             --alpha(var(--color-black) / 8%);
  --input:              --alpha(var(--color-black) / 10%);
  --ring:               var(--color-neutral-400);   /* focus ring is GREY, not blue */
  --destructive: red-500  --info: blue-500  --success: emerald-500  --warning: amber-500;
  --radius: 0.625rem;                                /* 10px, ONE radius token */
}
```

**Blue appears exactly once, as `--info`.** Their stated reason for alpha borders: *"opaque borders
instead of solid ones to ensure crisp, contrasted borders even when backgrounds lack sufficient
contrast"* — the same technique Luma uses. (Two Base-UI gotchas they document and we'll hit:
`isolation: isolate` on the root wrapper for stacking contexts, and `position: relative` on `body`
for iOS Safari 26+ backdrop coverage.)

**Typography discipline — the rule to steal.** Three vars: `--font-sans`, `--font-heading`,
`--font-mono`. The `font-heading` class is applied to **only four things: Dialog, AlertDialog, Sheet,
and Empty titles.** Everything else is `--font-sans`. That is how you get a display face without it
leaking everywhere — directly relevant to rule 20(a)'s type exploration. **Cal Sans 2** itself is OFL,
variable, optical-sizing 8–45pt, and explicitly *"vertical alignment shared with Inter, Geist, Roboto,
Helvetica, SF Pro, and Segoe UI"* — a **metric-compatible drop-in**, so it's a zero-risk heading-face
candidate.

Note: **their public booking pages do not use Cal Sans.** The served booking shell is
`font-family:'Inter','Inter Fallback'`. Display face = marketing and chrome; booking surface = plain
body face.

**Public-page customization is exactly four knobs**: `brandColor`, `darkBrandColor`, `cornerStyle`
(`"rounded" | "sharp"`), `theme` (null = follow system), plus `bookerLayouts`. Compare to Luma's 40
themes. **Four fields is the B2B-appropriate multi-tenant branding surface** — that's what our org
settings should expose.

**Booker layouts → our agenda.** `Month` / `Weekly` / `Column`, with the setting copy *"You can
select multiple and your bookers can switch views. This can be overridden on a per event basis."* and
validation *"At least one layout has to be enabled."* Org default + per-event override + viewer can
switch. That's our public-agenda layout preference, fully specified.

**Empty anatomy**: `Empty > EmptyHeader > EmptyMedia(variant="icon") + EmptyTitle + EmptyDescription`,
then `EmptyContent > Button`. **Icon, not illustration** → title (in `font-heading`) → one-line
description → one button. Their real strings distinguish *nothing exists* (`"No meeting types setup"`)
from *nothing matched* (`"No meeting types found"`) — same two-variant rule Stripe mandates.

**Button**: 7 variants (`default, outline, secondary, destructive, destructive-outline, ghost, link`),
9 sizes including a full icon set. The `loading` prop renders a spinner, forces `disabled`, sets
`aria-disabled="true"`, adds `data-loading`, and **preserves button width by hiding content
visually** — no layout jump. Steal this for our submit flows.

**Table**: two variants — `default` (simple rows, standard borders) and `variant="card"` (separated
borders, rounded corners, rows read as card surfaces). Pairs with Badge for status and TanStack Table
for sort/paginate/select. → `default` for the submissions table, `card` for agenda list view.

**Settings IA lesson**: event-type settings are 9 tabs (Basics, Availability, Assignment, Limits,
Advanced, Recurring, Apps, Workflows, Webhooks) — and in v6.6 they **deleted the "Advanced settings"
catch-all entirely**, recategorized every setting, and added a **live booker preview beside the
settings** so you watch the public page update as you configure. **Never ship an "Advanced" tab**, and
the live-preview-beside-settings pattern is high perceived quality for low build cost → our form
builder and public-page settings.

**Open-source signalling → our landing.** Tagline *"Scheduling infrastructure for absolutely
everyone."* AGPLv3 on an explicit open-core split. README badge row: license, stars, commit activity,
Docker pulls, help-wanted, Contributor Covenant. On the marketing page itself, open-source is signalled
**quietly** — a GitHub link, a self-host path, a LICENSE link — not a banner. **Their hero sells the
product benefit and lets the badges do the OSS work.**

### (b) Concrete stealable patterns

- The token file, near-wholesale: neutral primary, gray ring, alpha borders/inputs, blue demoted to
  `--info`, one radius token.
- `font-heading` restricted to Dialog / AlertDialog / Sheet / Empty titles.
- Four-knob public branding (brand colour, dark brand colour, corner style, theme).
- Layout switcher with org default + per-event override + viewer choice.
- `Empty` anatomy and the two-string convention.
- `loading` button that preserves width.
- Table `default` vs `card` variants.
- Live preview beside settings.
- Quiet OSS signalling: badges and a self-host path, not a hero banner.

### (c) What NOT to take

- **Don't take their marketing-site tokens as app tokens.** The circulating community `DESIGN.md`
  (primary `#111111`, hairline `#e5e7eb`, 8px radius, etc.) documents the *marketing* surface, is an
  unofficial reconstruction, and **conflicts with the real `coss.com/ui` tokens** (10px radius, alpha
  borders). `coss.com/ui/docs/styling` is the authority for the app.
- **Don't copy 9 tabs of settings depth.** They have a decade of scheduling edge cases; ours starts
  at 3–4 tabs.
- **Don't copy the `#101010` full-bleed dark footer** into the app — a marketing device that will
  fight our light-first app.
- **Don't copy their badge accent set** (orange/pink/violet/emerald) for statuses, or the submissions
  table becomes fruit salad. Map to the semantic four + neutral.
- **Don't copy "Talk to sales" / "Book a demo"** unless we have sales. For OSS the honest pair is
  "Get started" + "Self-host"/"Star on GitHub".
- Don't copy their hero headline register ("The better way to schedule your meetings") — the weakest
  part of their design, and the one place Luma clearly wins.
- ⚠️ **cal.diy is a different project** — a community MIT fork that strips enterprise code. If you
  see MIT attributed to Cal.com, that's the fork.

---

## 6. Linear — neutral-first chrome, speed as brand

Sources: [linear.app](https://linear.app/) · [/method/introduction](https://linear.app/method/introduction) ·
[How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui) ·
[Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh) ·
[/docs/filters](https://linear.app/docs/filters) · [/docs/custom-views](https://linear.app/docs/custom-views) ·
[/docs/display-options](https://linear.app/docs/display-options) · [/docs/peek](https://linear.app/docs/peek) ·
[/docs/triage](https://linear.app/docs/triage) · [/docs/linear-asks](https://linear.app/docs/linear-asks) ·
[reverse-linear-sync-engine](https://github.com/wzhudev/reverse-linear-sync-engine) ·
[LogRocket on Linear design](https://blog.logrocket.com/ux-design/linear-design/) ·
[emilkowal.ski/ui/you-dont-need-animations](https://emilkowal.ski/ui/you-dont-need-animations)

### (a) What it does exceptionally, mapped to our surfaces

**Linear has publicly solved "too blue" twice, and wrote both down.** This is the most directly
actionable thing in the entire document.

*Redesign I*: they moved theme generation from **HSL → LCH** ("perceptually uniform, meaning a red and
a yellow color with lightness 50 will appear roughly equally light to the human eye") and collapsed
**98 hand-set theme variables → 3 inputs**: base colour, accent colour, contrast. And the de-blue-ing,
verbatim: they got a *"more neutral and timeless appearance"* by **"limiting how much chrome (blue in
our case) was used in the calculations applied to our color system."** The accent hue was leaking
into every derived neutral. **That is exactly what is happening in `src/styles.css`.**

*Redesign II — "A calmer interface for a product in motion"*:
- Palette shifted from a **"cool, blue-ish hue" → warmer gray**, keeping crispness while reducing
  saturation.
- The **sidebar was made "a few notches dimmer"** so the content area wins.
- Tab bar went full-width → **compact, rounded, smaller icon + text**; some tabs became icon-only pills.
- **Fewer icons, smaller icons**, and they **removed coloured team-icon backgrounds** — which they had
  *added* in 2022 for "unique identity" and then killed. **Chroma-per-entity is a trap they walked
  into and out of.**
- Borders rounded, **divider contrast softened**, unnecessary separators deleted — "gives users
  structure on the page without cluttering their view."

Two principles to tape to the wall: **"Don't compete for attention you haven't earned"** and
**"Structure should be felt not seen."**

**Measured values** (from live-site CSS extraction; treat as directional where noted): sidebar
**256px**; spacing **4/8/12/16/24/32/48/96**; radius **6px** controls, **8–12px** cards, pill for
chips; hairlines **0.5px and 1px solid**, and **elevation = lighter surface + border, not drop
shadow**; motion **100ms quick / 250ms regular / 350ms slow**, easing `cubic-bezier(0.25,0.46,0.45,0.94)`.
Type: Inter Display for headings, Inter for body. Row-height/density px values for their list views
are genuinely undocumented anywhere public.

**Triage → our review queue.** A **split view**: queue list left, focused item detail right, side by
side — shipped as a preview then made default because it "makes it easier and faster to go through
your issues and take actions with more context." Number-key verdicts: **`1` Accept, `2` Duplicate,
`3` Decline, `H` Snooze** (until a time, or **until new activity**), with an **optional comment**
attached to the verdict inline, no separate dialog. → ours: `1` Accept Queue, `2` Waitlist, `3`
Decline Queue, plus a "needs info" snooze that auto-resurfaces on submitter activity.

**Peek → submissions table.** **Tap `Space`** toggles a preview; **hold `Space`** previews only while
held; `↑`/`↓` moves through adjacent rows **and the preview updates live**. Linear calls it "one of
the semi-secrets of the Linear UI" — an organizer flicking down a list reading abstracts without
leaving the list is exactly our reviewer's job.

**Filters and views.** Operator vocabulary in plain English — *is / is not / is either of / includes
any / includes all / includes neither / before / after* — which non-technical people parse fine.
Nested AND/OR behind advanced filters. **Filters live in the URL**: "copy the browser address to share
the filtered view." **The Save-view icon only appears after you've added ≥1 filter** — progressive
disclosure, no dead button. Saved views scope to Workspace or Team; favouriting is a **star next to
the view name**, and a favourited view can be **set as your homepage**.

**Display options → submissions table + agenda.** Grouping (status, assignee, project, priority,
label, …) plus a special **"Focus"** grouping that orders your items by what you'd want to work on
first. **Sub-grouping produces swim lanes** → our rooms/stages. **Display properties** as a long
toggle list. And **"Show empty groups"** — which matters *inverted* for us: organizers need to see
empty room-slots in order to fill them, the opposite of the usual hide-empties default.

**Preference persistence, two-tier**: personal customizations persist **per-view, per-user**; a
separate **"Set as default"** pushes them workspace-wide. (Attio's three-way save is the better
version of this for a shared-team product.)

**Speed.** The credible source is the CTO-endorsed reverse-engineering: the client database is
**IndexedDB** (80+ per-model tables, a `_meta` table with a globally monotonic `lastSyncId`, and a
`_transaction` table that persists unsent mutations *before* sending so a killed tab resends on
restart). Bootstrap is streamed NDJSON; the UI reads from an in-memory object pool, so reads never
touch the network. Only `transform`/`opacity` are animated. **We should not build this** — see (c) —
but the cheap 80% is real: skeletons shaped like the incoming content, no full-page reload on view
change, instant local state on toggle/rating/status with quiet rollback on failure.

**Motion rule that matters most**: **never animate keyboard-triggered actions.** Repeated animation
on repeated keypresses reads as sluggish. Stay under ~300ms.

**Landing structure**: headline + subhead + one primary CTA → three value props → **numbered feature
sections (1.0 Intake, 2.0 Plan, 3.0 Build…)**, each anchored by a real product screenshot with
real-looking data → named testimonials → a hard number → changelog inline. The **numbered narrative**
is unusually good for a multi-surface product: CFP → Review → Schedule → Speakers → Day-of.

### (b) Concrete stealable patterns

- Stop the accent hue entering derived neutrals; move the gray ramp cool → warm.
- Dim the sidebar relative to content; soften dividers; delete non-load-bearing separators.
- Smaller, fewer, uncoloured icons; **no coloured per-entity tiles**.
- Elevation = lighter surface + 1px hairline, not shadow.
- Split-view review queue with number-key verdicts + inline optional comment.
- `Space` to peek, `↑`/`↓` to advance.
- Save-view control appears only after the first filter.
- Plain-English operator vocabulary.
- Sub-grouping as swim lanes; "show empty groups" defaulted **on** for agenda.
- Motion budget 100/250/350ms, transform+opacity only, zero animation on keyboard actions.
- Numbered narrative sections on the landing page.

### (c) What NOT to take

1. **Keyboard-only affordances.** Peek is `Space`-only with no mouse path, and Linear is proud of it.
   An organizer who opens our app four times a year will never find it. Ship every keyboard action
   with a visible affordance; the shortcut is the accelerator, never the interface.
2. **Chorded navigation as the primary nav model** (`G,I` / `G,B` / `O,W`). Keep `Cmd+K` and `/`;
   don't make chords necessary.
3. **Dark-mode-default and the black canvas.** Reads as *developer tool*. We're light-mode-first for
   the right reason (rule 3).
4. **The density.** Linear is for someone in it 8h/day. Our reviewer screen may be dense; the speaker
   portal and public submit flow must not be. Two deliberate density regimes.
5. **`?` as the only shortcut discovery.**
6. **Their own invented vocabulary** (Cycles, Triage, Peek, Asks, Initiatives) — ironic given their
   Method says *"Don't invent terms."* Our users have vocabulary: Abstract, Session, Track, Room,
   Accept Queue. Ship **"Review queue"**, never "Triage".
7. **The Linear marketing finish** — dark hero with glowing gradient — is now a cliché that reads "YC
   dev tool". Take the structure, not the finish.
8. **Coloured per-entity icon backgrounds** — they added them and explicitly removed them. Don't
   reintroduce for tracks/rooms; use a small colour chip or a text label.
9. **Local-first sync as a goal.** Multi-year architecture, not a UI pattern.

---

## 7. Vercel / Geist — monochrome discipline and token architecture

Sources: [vercel.com/geist/introduction](https://vercel.com/geist/introduction) · [/geist/colors](https://vercel.com/geist/colors) ·
[/geist/materials](https://vercel.com/geist/materials) · [/geist/typography](https://vercel.com/geist/typography) ·
[/geist/table](https://vercel.com/geist/table) · [/geist/entity](https://vercel.com/geist/entity) ·
[/geist/empty-state](https://vercel.com/geist/empty-state) · [/geist/note](https://vercel.com/geist/note) ·
[/geist/toast](https://vercel.com/geist/toast) · [/geist/badge](https://vercel.com/geist/badge) ·
[/geist/command-menu](https://vercel.com/geist/command-menu) · [/geist/grid](https://vercel.com/geist/grid) ·
[/design/brands](https://vercel.com/design/brands) · [new dashboard navigation](https://vercel.com/changelog/new-dashboard-navigation-available) ·
[brand assets changelog](https://vercel.com/changelog/easily-access-vercel-brand-assets-and-guidelines)

### (a) What it does exceptionally, mapped to our surfaces

**The colour system's real trick — and the structural cure for "too blue".** Geist has 10 scales
(`backgrounds, gray, gray-alpha, blue, red, amber, green, teal, purple, pink`) and **every non-background
scale has exactly 10 steps, 100→1000, with identical fixed semantics**:

| Step | Purpose |
| --- | --- |
| 100 | Default background |
| 200 | Hover background |
| 300 | Active background |
| 400 | Default border |
| 500 | Hover border |
| 600 | Active border |
| 700 | High-contrast background |
| 800 | Hover high-contrast background |
| 900 | Secondary text and icons |
| 1000 | Primary text and icons |

Because accent scales are **structurally isomorphic to gray**, `--ds-gray-400` → `--ds-blue-400` is a
one-token swap. **Neutral is not a stylistic choice, it's the default binding**; colour is opt-in per
component, per step. **You cannot accidentally be blue.** Stripe enforces the same discipline by
written policy; Vercel enforces it by architecture — and architecture is the one to implement.

The `backgrounds` scale has **only two values** — `--ds-background-100` (default) and `-200`
(secondary) — with the docs stating *"Background 2 should be used sparingly when a subtle background
differentiation is needed."* **Two page backgrounds, total.** That single rule kills the
everything-is-a-tinted-card look we currently have.

**Radii**: `6px` functional UI, `12px` cards/panels, floating scale 6px tooltip → 16px fullscreen,
`9999px` **badges and pills only**, 50% avatars. **Two radii do 95% of the work.**

**Spacing**: 4px base — 4/8/12/16/24/32/40/64/96/128/192/256, with semantic aliases small 32, medium
40, large 48, gap 24.

**Shadows: borders *are* shadows.** `0 0 0 1px rgba(0,0,0,0.08)`. Focus ring `0 0 0 2px white, 0 0 0
4px #0072F5`. Medium elevation = border + `0 2px 2px rgba(0,0,0,.04), 0 8px 8px -8px rgba(0,0,0,.04)`.
Elevation is nearly invisible — 4% alpha.

**Layout**: 1200px standard page width, 1400px wide, **64px header**, 24px horizontal margin. → the
direct answer to rule 20(e)'s "fix the inconsistent container widths".

**Typography**: Geist Sans + Mono, **weights 400/500/600 only**, with named classes that bundle
size+line-height+tracking+weight in four families — `text-heading-*`, `text-button-*`,
`text-label-*` (single-line), `text-copy-*` (multiline, *"higher line height than Label"*). **The
Label vs Copy split is the useful idea**: UI chrome and prose have different line-heights and belong
to separate token families.

**Table**: density and decoration are **prop-driven on `TableBody`** — `striped`, `bordered`,
`interactive`, `virtualize` (documented with a 5,000-row example). Headers are **Title Case noun
phrases** ("Last Used", "Requests (7d)"). Numeric columns get **`tabular-nums` "so digits align across
rows for comparison."** Gating rule: use Table only for *"tabular data where rows share the same shape
and at least one column is sortable or comparable across rows"* — otherwise use `Entity`.

**`Entity` — our settings and speaker-list primitive.** Left = scannable identifier (avatar/icon),
centre = title (Title Case) + description (sentence case), right = **one or two controls**. Right-column
buttons are **Verb + Noun** — "Remove Member", not "Remove". Skeleton variant while loading. → org
members, event team, integration rows, portal task rows. **Do not build those as tables.**

**Empty state**: `EmptyStateIcon` + Title (Title Case) + description (sentence case) + optional CTA.
Four named variants — Blank Slate, Informational, Educational, Guide. Rules: **one primary CTA, max
two** "when the first action could legitimately be one of two paths"; *"The CTA must be a real Button
or Link, not an onClick div"*; labels **Verb + Noun**, never "Get Started" or "OK"; **quote the query
verbatim** — `No logs match "${query}". Clear the filter to see all logs.`; `aria-live="polite"` for
async filter changes.

**Feedback hierarchy — four components, explicitly delineated.**
- **Note** — inline contextual feedback next to the field/card it describes. `NoteLabel` is a **1–2
  word Title Case topic** ("Rate Limit", "Plan Limit") and *"Cut hedges like `Heads Up`, `FYI`, and
  `Note`."* `NoteContent` is **one sentence, active voice, naming the impact**.
- **Banner** — full-width, page-level, **needs a CTA**.
- **Toast** — transient ack of user-initiated actions. **Not** for *"billing failures, permission
  denials, or build failures the user has to triage."* Copy: **one sentence, sentence case, no
  trailing period**, pattern `{Noun} {past-participle}` ("Session saved", "Speaker invited"), **never
  the word "successfully."** Undo snackbars 5–10s, one action.
- **Modal** — destructive confirmations only.

**Badge**: two hard don'ts — *"Don't add a checkmark icon for success states or an X for errors; the
variant carries that signal"* and no `onClick` (*"promote to a Button or link if the user can act on
the value"*). One word, two max. A **subtle (low-contrast) level exists "for dense surfaces"** — use
it in the submissions table, standard contrast on detail pages.

**Command menu**: `⌘K`, global, *"should not be reused for in-page filters."* Paginate into sub-pages
*"when grouping exceeds approximately 30 items"*, and **"preserve the search query when navigating
back from a sub-page."** Items are **Title Case verb phrases** — *"Avoid navigation phrasing like `Go
to project page`; CommandMenu commands act, not browse."* Placeholder is **sentence case,
action-oriented, ends with `…`, and names the scope** — `Search projects…`; *"Bare `Search…` is wrong
because it doesn't name the scope."* **Show recent/default items when the input is empty.**

**Scope switcher — the signature move.** The redesign went horizontal tabs → resizable sidebar with
*"unified sidebar navigation with consistent links across team and project levels"*, and crucially
**projects-as-a-filter**: *"Switch between team and project versions of the same page in one click."*
The breadcrumb/scope control **narrows the current page** rather than navigating away and back.
Applied to us: switching event on the Submissions page keeps you on Submissions for the new event.
Strictly better than a sidebar dropdown for a multi-event organizer.

**Brand menu → rule 20(d), already on our list.** *"Copy the SVGs for the Vercel logo and wordmark or
open the brand guidelines by **right clicking on the Vercel logo** no matter where you are in the
platform."* `/geist/brands` per brand: light/dark logotype, symbol, ZIP download, **and a React
component import example**, plus explicit prohibitions (no modifying marks, no implied endorsement,
no marks in business names) and a `brand@` contact. **That page format is exactly what our
`/design-system` brand section should contain**, and Geist's IA — Foundations (Colors, Typography,
Materials, Grid) / Assets (Brands, Icons) / Components — is a ready-made structure for it.

**Grid — note carefully.** `Grid / GridCell / GridSystem` exists *"for two-dimensional cell-and-guide
layouts in **marketing pages, docs landing pages, and feature breakdowns** where the rule lines and
cell borders are part of the design."* **The visible-rule aesthetic Vercel is famous for is scoped to
marketing, not product UI.** That's where it belongs on our landing page too.

### (b) Concrete stealable patterns

- The 100→1000 fixed-semantics scale as our token layer, with every shadcn var bound to a **gray** step.
- Two page backgrounds, full stop.
- Two radii (6px controls, 12px surfaces); pills for badges only.
- Borders as `0 0 0 1px rgba(0,0,0,0.08)`; 4%-alpha elevation.
- 1200px standard / 1400px wide page widths; 64px header; 24px margin.
- Label vs Copy type families.
- Table props (`striped | bordered | interactive | virtualize`) instead of table variants.
- `Entity` for settings/member/task rows.
- Note / Banner / Toast / Modal hierarchy with their copy rules.
- Badge without icons; subtle level in dense tables.
- `⌘K` copy rules: scoped placeholder, verb-phrase items, recents when empty.
- Breadcrumb-as-filter scope switching.
- Right-click-logo brand menu; the `/brands` page format.

### (c) What NOT to take

- **⌘K as a primary navigation path.** Vercel's audience lives in a terminal.
- **Near-invisible borders (`rgba(0,0,0,0.08)`, `#EAEAEA`) and `#8F8F8F` muted text.** Vercel optimizes
  for young developers on retina displays in dark rooms. **Conference program chairs are often 45+, on
  a mid-range laptop, in a bright hotel ballroom.** Darken one step: borders ~`#E0E0E0`–`#D4D4D4`,
  muted text no lighter than ~`#6B6B6B`. Boring business sauce tolerates more contrast than Vercel's
  aesthetic minimum.
- **−2.28px letter-spacing on headings.** Reads "tech startup". Use −0.5 to −1px.
- **The Educational / Guide empty-state variants** (contextual tours, interactive starter data). Blank
  Slate + one Verb+Noun CTA is the whole job.
- **Black-as-primary-button.** Reads dev-tool/fashion-brand. A restrained *coloured* primary reads
  more like software you paid for — neutral everything else. (This is the one place we deliberately
  diverge from Cal.com's neutral-800 primary; see the synthesis.)
- **The visible-rule grid inside the app** — Vercel confines it to marketing; so do we.
- Novelty badge variants and mono type for anything but IDs.

---

## 8. Sessionize — the competitor we're beating

The headline finding: **Sessionize is two entirely different products visually stitched together, and
the half that overlaps with our surfaces is the badly dated half.**
Sources: [sessionize.com](https://sessionize.com/) · [/pricing](https://sessionize.com/pricing) ·
[/playbook/fields-explained](https://sessionize.com/playbook/fields-explained) · a live public CFP page ·
a public speaker profile · a public session page · a `*.sessionize.com/schedule` agenda ·
`cdn.sessionize.com/landing/stylesheets/style.css` · `cdn.sessionize.com/bundles/App_Css-*` and `App_Js-*`

### (a) What's actually there

**The marketing site is fine.** Headings in `Playfair Display`, body in a system stack, a custom
BEM-ish component system (`c-button`, `c-card`, `o-icon`) — **not** Bootstrap. Radii `.25–.375rem`,
pill buttons at `2rem`. Brand teal `#1ab394`.

**The actual app is a 2015 Bootstrap 3 admin template** — specifically **Inspinia**, a commercial
ThemeForest theme. Not an inference; the fingerprints are literal in their bundles: `.col-xs-*`
(BS3-only), `font-family:'Glyphicons Halflings'` (removed after BS3), Inspinia-signature classes
verbatim (`ibox`, `ibox-title`, `ibox-content`, `gray-bg`, `navbar-static-top`, `i-checks`, `m-b-sm`),
`animated fadeInLeft/fadeInRight` (Animate.css), the exact Inspinia palette
(`#1ab394 #1c84c6 #23c6c8 #f8ac59 #ed5565`) plus Bootstrap's `#337ab7`, jQuery compiled in,
**Summernote** jQuery WYSIWYG for abstract/bio fields, `modernizr-2.8.3.js` still shipping, and:

```css
.form-control{height:34px;padding:6px 12px;font-size:14px;border:1px solid #ccc;
  border-radius:4px;box-shadow:inset 0 1px 1px rgba(0,0,0,.075)}
```

App-wide radii cluster at 2/3/4px; type is Open Sans + Roboto.

**The tell**: their brand teal `#1ab394` **is Inspinia's default accent**. The brand colour was
inherited from the admin template. (Relevant to our accent choice — see §10 — and a cautionary tale:
don't let a framework default become a brand.)

### (b) Domain patterns worth taking

**The three-tier field visibility model** ([fields-explained](https://sessionize.com/playbook/fields-explained))
— the single genuinely good idea they have, and the correct permission primitive for a CFP tool:

| Tier | Who sees it |
| --- | --- |
| **Submission fields** | Speaker fills at submit time; publicly visible |
| **Additional fields** | Speaker sees in their portal **after acceptance**; not on the public form (flight number, dietary needs, slide uploads) |
| **Internal fields** | Organizer / review team only (scores, reliability notes) |

Maps straight onto our form builder, submissions-table column visibility, and speaker portal.

**Speaker profile IA, near-verbatim**: photo/name/role/location header → bio → recognition badges →
**two separate taxonomies** (broad expertise categories vs granular topic tags) → sessions list with
inline abstracts → reverse-chron event history → socials repeated top and bottom. The two-taxonomy
split and the event-history timeline are both genuinely good.

**Session detail**: title → abstract → speaker card → dual CTA ("Invite to your event" / "Contact
directly").

**Pricing**: free for community events, **$499 flat per professional event**, custom bulk, explicitly
*"all features included in each package"* — gated on event volume, never on features. A proven shape
in this exact market, and worth echoing in our landing's pricing register.

**One clever low-friction pattern**: attendees favourite sessions and sync across devices via a
**6-digit code, no account required.**

### (c) Where we beat them, and what NOT to take

**Beat them on the public submit flow.** They force **full account creation before you can even see
the form** ("Classic login" modal). Let people fill the form and gate only at submit. That's a real,
measurable conversion win against the category leader — and Luma has already proven the pattern
(name + email only).

**The agenda grid is a wide-open gap.** Their organizer-facing schedule builder is Bootstrap 3, and
their public schedule is a **day-list, not a grid** (a Vue app rendering sequential per-day cards).
The room×time matrix **only exists as an embeddable widget** for orgs' own sites, customized via a
colour picker and raw CSS overrides. **A first-class Notion-Calendar-grade agenda grid is the clearest
differentiation available to us.**

**Do not take**: anything Bootstrap 3 — `.col-xs-*`, Glyphicons, `.form-control` inset shadows,
`i-checks` checkbox replacements, Animate.css entrance animations on form columns, Summernote
toolbars, 2–4px radii, jQuery architecture. Nor `Playfair Display`. Nor the forced login wall. And
**never let a framework's default accent become the brand colour.**

---

## 9. Juicebox — secondary feel/brand candidate

AI people-search / recruiting (juicebox.ai). Marko: *"rip the entire feel and brand in the deepest
form."* Mobbin 403'd, but something better was available: the **logged-in app's CSS bundles at
`app.juicebox.ai/_next/static/chunks/*.css` are served unauthenticated** — a complete shadcn/Tailwind
v4 token set from a product that solved the exact problem we have. Marketing values come from the
Framer HTML's inline CSS.

### (a) The feel, in one paragraph

Juicebox reads as **"Swiss-neutral publication that happens to be software."** The entire marketing
surface is built out of a **purple-tinted gray** — never a true gray, never a blue-gray — set in
**Neue Haas Grotesk** (real Helvetica, not Inter) at −0.02em tracking, punctuated by **DM Mono** for
numbered section labels (`[01] DISCOVERY`, `[02] CORE FEATURES`). The brand purple exists and it is
*loud* when it appears — but it appears about four times per page. Counting hexes on the homepage:
the mauve neutral ramp occurs **~110 times**; the brand purple `#6A2F8D` occurs **4 times**. On the
pricing page it's 15 mauve vs 2 purple. **That ratio is the brand.** The colour doesn't come from
chrome — chrome is monochrome — it comes from *content*: an avatar, a highlighted matched phrase, a
categorical tag. Corporate discipline, zero corporate boredom, because the "gray" is secretly a
colour.

### (b) Concrete stealable patterns

**The marketing neutral ramp.** Every "gray" satisfies R = B > G — a desaturated mauve, at CIELAB
chroma ~1.9:

| Hex | Role |
| --- | --- |
| `#0D080D` | deepest ink |
| `#1D161D` | primary text |
| `#574E57` | secondary text |
| `#786C78` | **the most-used colour on the entire site** — muted text |
| `#A89EA8` | tertiary / placeholder |
| `#D6D1D6` / `#E7E4E7` | border / divider |
| `#F8F6F8` | surface |
| `#FAF9FA` | page background |

**The app abandons the mauve entirely and goes fully achromatic** — this divergence is deliberate and
is itself the lesson. Fonts switch to Geist/Geist Mono; neutrals become Tailwind `neutral-*` at
**chroma exactly 0.0**; `--radius: 0.625rem`. The shipped light-mode tokens, verbatim:

```
--background:#fff   --card:#fff   --popover:#fff   --foreground:#0a0a0a
--muted:#f5f5f5     --muted-foreground:#737373
--border:#e5e5e5    --input:#e5e5e5    --ring:#737373        ← NEUTRAL FOCUS RING
--accent:#f5f5f5    --accent-foreground:#171717              ← NEUTRAL HOVER TOKEN
--primary:#750bcc   --primary-foreground:#faf7fe
--primary-surface:#f7f3ff  --primary-surface-hover:#ece3fc  --primary-border:#d8c8f3
--sidebar:#fafafa   --sidebar-border:#e5e5e5   --sidebar-accent:#f5f5f5
--sidebar-primary:#9336ea  --sidebar-ring:#737373
--success:#319751   --success-surface:#e8fbeb   --success-border:#b2e7bc
--warning:#c48300   --warning-surface:#fff7e2   --warning-border:#f9daa1
--destructive:#df2225  --destructive-surface:#fff1f1  --destructive-border:#ffbdba
--chart-1..5: #d9b5ff → #c182fc → #a957f7 → #9336ea → #8022d1
```

**The two decisive lines are `--ring:#737373` and `--accent:#f5f5f5`.** In stock shadcn both are
brand-tinted — and `--accent` is the token behind every dropdown-item hover, table-row hover, and
sidebar selection. Juicebox neutralized both. Brand purple survives only in `--primary`,
`--sidebar-primary`, links, and the `primary-surface / -hover / -border` trio.

Ranked transferable moves:

1. **Neutralize `--ring` and `--accent`.** Single highest-leverage change; it's the same conclusion
   Cal.com reached independently (`--ring: neutral-400`).
2. **Adopt the five-part semantic token shape**: `{name}` / `{name}-foreground` / `{name}-surface` /
   `{name}-surface-hover` / `{name}-border`, applied identically to primary/success/warning/destructive.
   This is exactly the structure our `StatusPill` system wants, and it generalizes for free.
3. **Pick a tint direction and commit, but keep chroma ≤ 2.** Juicebox's mauve is chroma ~1.9 —
   enough to feel authored, not enough to read as coloured. (Reference: `neutral-200` = 0.0,
   `stone-200` = 0.9, `zinc-200` = 1.6, **`slate-200` = 4.6 — over the line**.)
4. **Let marketing and app diverge deliberately.** Tinted neutrals + a display grotesk on the landing;
   achromatic + a workhorse sans in the app. Data-dense surfaces get zero hue.
5. **Accent budget ~3% of coloured pixels.** Enforce it literally by counting.
6. **Mono for structure, not just code** — `[01] DISCOVERY` eyebrows, table metadata, IDs, timestamps.
   Cheap, and instantly "corporate but not boring".
7. **Small radii + one near-invisible shadow.** Marketing radii are 3/4/5/6px; the app is 10px. There
   is exactly **one** shadow on the whole marketing site, used 22 times:
   `0px 4px 4px 0px rgba(0,0,0,0.05)`. Hairline borders do the separating, not elevation.
8. **Single-hue chart ramp** (`#d9b5ff → #8022d1`) instead of a rainbow — our `--chart-1..5` is
   currently two blues plus green/amber/gray.
9. **Categorical tags generated from one recipe rotated around the hue wheel** — note the identical
   structure of `#2F8D6E` / `#2F878D` / `#6A2F8D`: same lightness and chroma, hue stepped. Guarantees
   track colours never fight each other. → directly applicable to `track-color-picker.tsx`.
10. **Product screenshots: real UI, cropped, slightly tilted, soft shadow. No fake browser chrome.**
    → our `product-shot.tsx`.

Page structure, for the landing: hero (*"Win the talent war."*) → live candidate carousel →
mono-numbered sections `[01]…[04]` → tilted screenshots → 41-logo integration wall → customer stories
→ FAQ. Typography: weights 400/500 do ~85% of the work; `-0.02em` default tracking, `+0.02em` on
mono/eyebrow labels. Motion is nearly absent — one `transition: color .15s`, no scroll-jacking.

### (c) What NOT to take

- **`#0099FF` is a red herring.** It appears 257 times in their source, but every instance is
  `--framer-link-text-color: rgb(0,153,255)` — Framer's stock default. Not a brand colour. (Same class
  of mistake as Sessionize inheriting Inspinia's teal.)
- **The novelty faces** — `Patrick Hand`, `Neucha`, `Fragment Mono` each appear once for texture.
  Charming on a recruiting site, wrong for us.
- **Purple itself.** The *discipline* transfers; the hue doesn't — see §10.
- **The 3–6px marketing radii inside the app.** Their own app uses 10px, and so should ours; our
  `--radius: 0.5rem` is already right.
- **Marketing-grade tinted neutrals in the app.** Juicebox explicitly doesn't do this. Our organizer
  app goes achromatic; the landing may carry the tint.

---

## 10. Accent colour direction

Marko wants a distinctive non-blue accent: *"turquoise maybe, not turquoise, something like that."*
All contrast figures below are **computed**, not estimated — WCAG 2.x relative luminance
(`0.2126R + 0.7152G + 0.0722B` on linearized sRGB), ratio `(L₁+0.05)/(L₂+0.05)` — and separation is
measured as **CIELAB hue angle + ΔE76**, because HSL hue distance is actively misleading in the
teal/green region.

### (a) Quantifying the actual problem

The blue is not only in `--primary`. Measuring our current `src/styles.css` tokens as CIELAB chroma
(0 = truly achromatic; >3 reads visibly tinted on a light surface):

| Token | Hex | Chroma | |
| --- | --- | --- | --- |
| `--ring` | `#2f5ce0` | **78.3** | brand blue on every focus ring |
| `--accent-foreground` | `#1e3fa8` | **66.0** | |
| `--muted-foreground` | `#64748b` | **14.5** | slate-500 — *all* secondary text |
| `--status-gray-fg` | `#475569` | **13.3** | |
| `--status-gray-dot` | `#94a3b8` | **12.6** | |
| `--sidebar-accent` | `#e4ebfc` | **9.1** | |
| `--foreground` | `#1b1e27` | **6.7** | **even the black is blue** |
| `--accent` | `#eef1fc` | **5.7** | fires on every row/menu hover |
| `--sidebar-border` | `#e2e8f0` | **4.6** | |
| `--input` | `#dfe3ea` | **3.9** | |

**Swapping `--primary` alone will not fix this.** Ten tokens carry the blue independently, and the
`--accent` / `--sidebar-accent` pair is the worst offender because it fires on every hover in a dense
table. This is exactly Linear's documented diagnosis — the accent hue leaking into the derived
neutrals — and Juicebox's exactly-two-line fix.

### (b) Where the field actually puts its accent

| Product | Accent | Neutral base | Where accent is permitted |
| --- | --- | --- | --- |
| **Attio** | `#266df0`, hover `#215bc4` | cool slate (`#6f7988`, `#8f99a8`, whites `#e4e7ec`) | **The broadest in the set** — verified in `app.attio.com/web-assets/main.bundle.*.css`: `--internal-color-focus-ring:#266df04d`, link foreground, accent stroke, plus **alpha washes `#266df01a` / `#266df00d`** on row hover and selection. It earns the breadth by using *alpha washes*, never solid brand fills. Separate categorical tag palette (`#00b5e6`, `#0fc27b`, `#ff5b59`, `#ab92f1`) for record fields. |
| **Stripe** | Blurple `#635BFF` | near-black/gray | On marketing, almost entirely inside **gradients**, not flat fills. In-dashboard: primary button, active nav, links, focus ring. |
| **Vercel** | `#0070f3` | **pure achromatic** (`#f2f2f2 … #1a1a1a`, R=G=B) | Links, primary buttons, focus rings, active states. Explicitly nothing else. |
| **Linear** | `#5E6AD2` / `#7170FF` | cool near-mono (`#232326`, `#F4F5F8`) | CTAs and active/selected only. |
| **Cal.com** | **black is the accent** (`#141414`) | true grayscale by policy | Chromatic colour essentially absent. |
| **Clay** | primary action **black**; `#0382f7` demoted to *secondary* accent | **warm "oat"** `#fffcfa → #f9f8f6` | Buttons black; fruit-named categorical palette for tags only. |
| **Ramp** | chartreuse `#E4F222` | warm off-white | "Only where money moves" — CTAs, live counters, active states. |
| **Arc** | `#3139FB` | **cream `#FFFCEA`** — "paper rather than screen" | User-customizable; blue is just the default. |
| **Retool** | `#003DA5` | warm `#E9EAE7` | Primary actions and links. |
| **Notion** | none fixed | pure black/white/`#787774` | Colour is user-generated only; chrome stays achromatic. |
| **Juicebox** | `#750bcc` app / `#6A2F8D` marketing | achromatic app / mauve marketing | `--primary`, `--sidebar-primary`, links, `primary-surface` trio. ~3% of pixels. |
| **Raycast** | `#FF6363` | adapts to macOS chrome | Brand mark; UI neutral-first. |

Three conclusions:

1. **Nearly every one of these is blue or indigo** — `#266df0`, `#635BFF`, `#0070f3`, `#5E6AD2`,
   `#0382f7`, `#003DA5`, `#3139FB`. A non-blue accent is **genuinely differentiating** in this
   category, not just a personal preference.
2. The consensus rule is **accent confined to primary buttons + links + focus ring + active nav**;
   structural chrome stays neutral. Attio is the deliberate exception and it earns it with alpha
   washes.
3. **Neutral hue is the real personality lever**, not the accent — Attio/Vercel/Linear cool-or-
   achromatic; Arc/Clay/Retool/Ramp warm. Nobody in this set gets their character from the accent.

### (c) Candidates — computed, not guessed

| # | Name | Hex | Button fill, white text (≥4.5) | Link on `#FCFCFC` (≥4.5) | LAB hue | Chroma |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Petrol** | `#0F6E70` | **6.03** ✅ | **5.87** ✅ | 199 | 26 |
| 2 | **Verdigris** | `#127C74` | **5.05** ✅ | **4.92** ✅ | 187 | 30 |
| 3 | **Peacock** | `#0E7490` | **5.36** ✅ | **5.22** ✅ | 234 | 28 |
| 4 | **Jade** | `#0D7A5F` | **5.29** ✅ | **5.16** ✅ | 169 | 36 |
| 5 | **Petrol-slate** | `#2A6F7A` | **5.75** ✅ | **5.60** ✅ | 215 | 22 |
| 6 | **Ink-teal** | `#0B5C63` | **7.71** ✅ | **7.51** ✅ | 208 | 22 |
| 7 | **Terracotta** *(wildcard)* | `#B4522F` | **5.01** ✅ | **4.89** ✅ | 46 | 54 |

All seven pass AA on both tests. For contrast, the obvious pick `teal-600 #0D9488` scores only
**3.74** and **fails outright as a button fill** — rule it out.

### (d) The status-collision test — the constraint that decides it

An events tool has a green "Accepted", an amber "Pending", and a red "Declined". An accent that reads
as a status is disqualifying. Threshold: <25° = high risk, 25–45° = related-but-readable, >45° =
clearly a different family.

| Candidate | vs green `#15803D` | vs amber `#B54708` | vs red `#B42318` | Verdict |
| --- | --- | --- | --- | --- |
| Petrol `#0F6E70` | **52°** / ΔE 42 | 148° | 161° | ✅ safe |
| Verdigris `#127C74` | **40°** / ΔE 35 | 136° | 149° | ⚠️ borderline |
| Peacock `#0E7490` | 87° | 177° | 163° | ✅ safe — but see below |
| Jade `#0D7A5F` | **21°** / ΔE 23 | 117° | 131° | ❌ **FAILS** |
| Petrol-slate `#2A6F7A` | 68° | 164° | 177° | ✅ safe |
| Ink-teal `#0B5C63` | 61° | 157° | 170° | ✅ safe |
| Terracotta `#B4522F` | 101° | **6°** / ΔE 15 | **8°** / ΔE 20 | ❌❌ **FAILS HARD** |

- **Jade fails** — 21° from "accepted" green. A jade primary button next to green accepted pills reads
  as one family.
- **Terracotta fails catastrophically** — 6° from amber *and* 8° from red. It collides with two
  statuses at once. The wildcard is dead; the maths killed it.
- **Peacock passes the status test but fails the brief** — at LAB hue 234 it's cyan-blue and moves
  only **60°** from `#2F5CE0`, the least escape of any candidate. It risks re-reading as "blue",
  which is the entire problem being solved.

Distance from the blue we're escaping (`#2F5CE0`, LAB hue 294): Verdigris 107°, Petrol 95°, Ink-teal
86°, Petrol-slate 79°, Peacock 60°.

### (e) ⚠️ Blocking finding: our "green" is emerald, and it will collide

**`--status-green-*` is not green — it's emerald**, which is teal-leaning and fights *any* teal accent:

| Current token | Hex | LAB hue | Sep. vs Petrol | vs Verdigris |
| --- | --- | --- | --- | --- |
| `--status-green-fg` | `#065f46` | 166 | **33°** ⚠️ | **21°** ❌ |
| `--status-green-dot` | `#059669` | 162 | **37°** ⚠️ | **25°** ❌ |
| `--status-green-bg` | `#d1fae5` | 162 | 38° ⚠️ | 25° ❌ |

**Fix, non-optional if we go teal:** move the status green from emerald to **true green** —
`fg #166534`, `dot #16A34A`, `bg #DCFCE7`. That lifts separation from 33° to **50°** against Petrol.
Without it, even the winning accent is compromised.

### (f) Ramp survivability

Hover ×0.86, active ×0.74; surfaces at 7% / 13% / 30% mixes with white.

**Petrol is the standout** — every step stays AA-compliant and the tints stay clean:

```
--primary                #0F6E70   (white text 6.03)
--primary-hover          #0D5F60   (white text 7.44)
--primary-active         #0B5153   (white text 9.07)
--primary-surface        #EEF5F5
--primary-surface-hover  #E0ECEC
--primary-border         #B7D4D4
   accent text on its own surface: 5.46 ✅
```

Verdigris's equivalent accent-on-surface only reaches **4.60** — passing, but with no margin. Ink-teal
is the most robust (6.93) but at L 22% / chroma 22 it's dark and quiet, closer to "very dark neutral"
than a brand.

### (g) Recommendation

**Primary: Petrol `#0F6E70`.** It wins on every measured axis. Best contrast headroom of the safe
candidates (6.03 button / 5.87 link, comfortably clear of 4.5). 52° from green — real separation,
extended past 50° once the emerald status green is corrected. Moves 95° from the old blue, so it will
never be mistaken for the thing it replaced, while sitting far enough from cyan-blue (LAB hue 199 vs
Peacock's 234) not to re-import the problem. At chroma 26 it's saturated enough to be a brand and
restrained enough to survive at a 7% tint. And it's exactly the brief — *"turquoise maybe, not
turquoise"*: a deep, slightly-grayed petrol that reads considered rather than tropical. Against a
field where Attio, Stripe, Vercel, Linear, Clay, Retool and Arc are **all** blue or indigo, it's
genuinely distinctive.

**Runner-up: Verdigris `#127C74`.** Warmer, greener, more memorable as a mark, and the furthest of all
from the old blue (107°). But it's the weaker engineering choice: 40° from status green (borderline),
4.60 accent-on-surface (no margin), 5.05 button contrast (thinnest of the safe set). Viable only if
the status green moves all the way to an olive-forest (`#4D7C0F`, 63° separation) — a bigger change
than it's worth.

**Drop entirely:** Jade (collides with Accepted), Terracotta (collides with Pending *and* Declined),
Peacock (still reads blue), `teal-600 #0D9488` (fails AA as a button fill).

**Whatever hue is chosen**, the structural fix comes first or the accent swap won't land: `--ring` to
a neutral gray, `--accent` / `--sidebar-accent` to achromatic `#F5F5F5` / `#F4F4F5`,
`--muted-foreground` off slate-500 (chroma 14.5) to `#737373` (chroma 0), and de-blue `--foreground`,
`--input`, `--sidebar-border`, and the three `--status-gray-*` tokens. The accent is then permitted in
exactly five places: **primary buttons, links, active sidebar item, selected-row indicator, and
`--chart-1`.**

---

## 11. Mercury — considered, rejected

Mercury (mercury.com) was on the shortlist as a "premium-but-boring banking software" feel candidate —
warm-neutral palette, ink-dark type, restrained depth. **Dropped from deep treatment on Marko's call
(2026-08-11): Attio won.** Attio delivers the same neutral-first restraint with far better evidence
for the surfaces we actually build (tables, filters, saved views, record pages), and Stripe covers the
financial-software register more directly for settings and multi-tenancy. Nothing in the Mercury look
is unavailable via Attio + Stripe + Luma. If a future pass wants warmth specifically, the warm-gray
move is already captured in §6 (Linear's cool→warm ramp shift) without importing a second brand's
personality.

---

## 12. Synthesis — "the Sessionboard OSS look"

**One paragraph.** Sessionboard OSS looks like a piece of quiet, fast, grown-up software that happens
to be about events: **Attio's system, at our density.** That means an achromatic (or barely-tinted,
chroma ≤ 2) neutral ramp with the accent hue kept entirely out of the derived neutrals — Juicebox's
two decisive lines, `--ring` neutral and `--accent` achromatic — alpha hairlines at ~8% of the
foreground instead of solid gray rules, elevation as a lighter surface plus a 1px border rather than a
shadow, and exactly two page backgrounds; all of it governed by **Stripe's written colour policy**
that colour is a semantic channel and never a decorative one, at roughly **Juicebox's 3% accent
budget**, so the only saturated pixels on any screen are a status pill, a track chip, an agenda
block's accent bar, or the single primary button in the top-right of the page header. The accent
itself is **Petrol `#0F6E70`** — a deep, slightly-grayed teal that is 95° from the blue we're
escaping and 52° from our "Accepted" green, chosen because in a field where Attio, Stripe, Vercel,
Linear, Clay, Retool and Arc are *all* blue or indigo, not being blue is the differentiator. Onto that
we keep **Luma's public-surface proportions and plain-spoken register** (an ~820px submit page with a
330px meta rail, 16px inputs, name-and-email-only entry, status-sentence empty states), **Notion
Calendar's agenda grammar** (pale-tint block + 4px saturated left bar + saturated title text,
hour-only gridlines, a dark now-line, red reserved for one meaning), **Stripe's settings IA and
saved-views-as-tabs**, and **Linear's speed** — optimistic local state, skeletons shaped like their
content, a 100/250/350ms motion budget, `transform`/`opacity` only, nothing animated on a keypress.
Our existing tokens survive almost intact: `--radius: 0.5rem` is already right, the status ramps are
already soft-tinted and semantic, and the shell structure from the 42 screenshots stays exactly as it
is — what changes is the *distribution* of colour. And critically, **we take Attio's system but
explicitly reject Attio's density**: 36px+ controls, comfortable table rows, 14–16px body, and borders
one contrast step darker than Vercel's aesthetic minimum — because our user is a program chair on a
mid-range laptop in a bright hotel ballroom, not an operator living in the tool eight hours a day.

### The 10 changes, ranked by impact — the rule-19 reconciliation brief

| # | Change | Why it's ranked here | Touches |
| --- | --- | --- | --- |
| 1 | **De-blue the neutrals: retire the slate ramp.** `--background #f8fafc`, `--secondary`/`--muted` `#f1f5f9`, `--muted-foreground #64748b` (chroma **14.5**), `--foreground #1b1e27` (6.7 — even the black is blue), `--sidebar #f1f5f9`, `--border`, `--input`, and the three `--status-gray-*` are all blue-tinted Tailwind *slate*. Rebind every one to **chroma ≤ 2** (`neutral`/`zinc` register; Juicebox's app ships chroma exactly 0). This is Linear's documented fix — *"limiting how much chrome (blue in our case) was used in the calculations"* — and it alone resolves most of "too blue". | The complaint is about the **neutrals**, not the primary. Ten tokens carry the blue independently; `slate-200` measures chroma 4.6 against `zinc` 1.6 and Juicebox's authored mauve 1.9. Highest impact per line changed. | `src/styles.css`, then everything |
| 2 | **Neutralize `--ring` and `--accent` — the two decisive lines.** `--ring #2f5ce0` (chroma **78**) fires on every focus; `--accent #eef1fc` / `--sidebar-accent #e4ebfc` fire on every dropdown-item hover, table-row hover and sidebar selection. Set ring → neutral gray, accent → achromatic `#F5F5F5`. Also unbind `--chart-1/2` (currently two blues) → a single-hue accent ramp, and `--sidebar-primary`. Then adopt Geist's rule structurally: **every shadcn var binds to a gray step by default; colour is opt-in per component.** | Juicebox and Cal.com independently shipped exactly this (`--ring:#737373`, `--ring: neutral-400`). Blue is currently reachable *by accident* on every focus, hover and selection — making neutral the default binding means we can't regress. | `src/styles.css`, sidebar nav, charts |
| 3 | **Quiet the tinted chrome: `PageHeader` banner + `EmptyState` icon tile.** `PageHeader variant="banner"` is `bg-accent` + `border-primary/10` on every organizer page; `EmptyState` puts `bg-accent text-accent-foreground` behind every icon. Move both to neutral surfaces (Vercel: **two page backgrounds, total**; "Background 2 sparingly"). Keep the banner *structure* from the screenshots — just drain the lavender. | These two primitives repeat on literally every page, so they set the app's colour temperature single-handedly. Cheapest possible high-visibility win. | `src/components/shared/page-header.tsx`, `empty-state.tsx` |
| 4 | **Adopt Petrol `#0F6E70` as the accent, fix the emerald status green, and write the colour policy down.** Full ramp in §10(f): `--primary #0F6E70` / hover `#0D5F60` / active `#0B5153` / surface `#EEF5F5` / surface-hover `#E0ECEC` / border `#B7D4D4`. **Blocking prerequisite:** `--status-green-*` is currently *emerald* (`#065f46` / `#059669` / `#d1fae5`), only 33° from Petrol — move it to true green (`#166534` / `#16A34A` / `#DCFCE7`) to reach 50° separation. Restructure every semantic colour on Juicebox's five-part shape (`{name}` / `-foreground` / `-surface` / `-surface-hover` / `-border`). Then permit the accent in exactly five places — primary button, link text, active sidebar item, selected-row indicator, `--chart-1` — write Stripe's rule into `/design-system` verbatim (*"colour is reserved for status signals"*), and audit the **183** current `bg-primary` / `text-primary` / `bg-accent` / `sidebar-accent` usages against it. | Delivers the "distinctive, not vibe-coded" half of rule 20 with the maths done: 6.03:1 as a button fill, 95° from the old blue, 52° from Accepted green, and distinctive in a field where Attio/Stripe/Vercel/Linear/Clay/Retool/Arc are all blue. The restraint policy is what stops the new hue becoming the new problem. Must land *after* #1–#3 so the accent is judged against neutral chrome. | `src/styles.css`, `status-pill.tsx`, `design-system.tsx`, app-wide audit |
| 5 | **Rebuild the agenda block on the Notion Calendar recipe.** Pale track-tint surface + 4px saturated left bar + **saturated title text**; solid saturated fill only while dragging/selected; one-line collapse with inline muted time below a height threshold; **hour-only gridlines** (drop the half-slot lines, and recolour the `rgba(15,23,42,…)` gradients off slate); dark now-line with red reserved for conflicts only; shingled overlap cascade so a double-booking reads as an anomaly. Regenerate the 8-swatch track palette in `track-color-picker.tsx` from **one recipe rotated around the hue wheel** (Juicebox: same L and C, hue stepped) so track colours never fight each other — and drop `#2F5CE0` from it, since it's the old brand blue. | The agenda is our clearest differentiator — Sessionize's grid is a CSS-override embed widget — and it's currently the densest concentration of colour in the app. | `src/components/agenda/*` |
| 6 | **One container-width system.** Rule 20(e), and it's real: `max-w-5xl`(9), `max-w-2xl`(8), `max-w-6xl`(4), `max-w-7xl`(2), plus one-offs. Adopt three named widths — **app 1200px / wide 1400px / public 820px** (Vercel + Luma) — as tokens or a `<PageContainer>` wrapper, with a 64px header and 24px gutters. Public surfaces get 820px with Luma's 330px meta rail. | Inconsistent widths are the loudest "assembled by different agents" tell, and this is exactly what rule 19 exists to fix. Mechanical, verifiable, no judgement calls. | every route |
| 7 | **Upgrade the submissions table to the Stripe list pattern.** Status tabs **with counts** as the primary filter (All / Pending / Accept Queue / Decline Queue / Accepted / Declined / Withdrawn) → **saved views join that same tab row**, drag-orderable, `⋯` on hover → Attio's three-way save (**Save for everyone / Save as new view / Discard changes**) → default filter chips below, "More filters" grouped → Edit columns → Export honouring the current filter → **filter state in the URL**. Filter grammar stays plain English (*is / is not / includes any / before / after*); boolean nesting hides behind "Convert to advanced condition". | The chair's real workflow is three saved tabs ("my review queue", "needs a second reviewer", "accepted, awaiting confirmation"). URL-shareable filters matter more to organizers than to Stripe's users — they live in Slack and email. | `src/components/submissions/*`, `data-toolbar.tsx` |
| 8 | **Standardize the feedback + empty-state vocabulary.** Four components, delineated: **Note** (inline, 1–2-word Title Case label, one active-voice sentence), **Banner** (page-level, CTA required), **Toast** (`{Noun} {past-participle}`, sentence case, no period, **never "successfully"**, ≤30 chars), **Modal** (destructive confirmation only). Empty states get the Stripe formula — title ends with a period, description <14 words explaining *when* data appears, action in call-and-response with the title, **never "Get started"** — plus the mandatory **two variants** (never-had-data vs filtered-to-zero, the latter quoting the query and offering Clear filters). Render order: **loading → error → empty → content**. | Copy and feedback drift is the second-loudest per-agent tell after layout drift, and it's what makes software feel unserious to a non-technical buyer. Also directly improves the sbek browser-agent's ability to navigate. | `empty-state.tsx`, all toasts/alerts, all list routes |
| 9 | **Make the multi-tenant model legible: scope-preserving switcher + Personal/Organization/Event settings.** Workspace name **upper-left of the sidebar** → dropdown (Attio and Linear converged on this), with the event picker nested inside it (Stripe puts sandboxes inside the account picker). Switching org or event **keeps you on the same page** — Vercel's *"switch between team and project versions of the same page in one click"*. Settings reorganize into **Personal / Organization / Event**, job-based labels, and **no "Advanced" tab** (Cal.com deleted theirs). Member/team/integration rows use a Vercel-`Entity` row — avatar left, name+email centre, role select + **"Remove Member"** right — not a table. | Rule 18g demands the full multi-tenant spiel; this gives it a shape three reference products independently agree on, and the scope-preserving switch is strictly better for a multi-event organizer. | `src/routes/app/settings/*`, `event-switcher.tsx`, app shell |
| 10 | **Speed and craft polish, Linear-grade.** Motion budget **100 / 250 / 350ms**, `transform`/`opacity` only, **nothing animated on a keyboard-triggered action**; optimistic local state on status/rating/toggle with quiet rollback; skeletons shaped like their content, never spinners; `tabular-nums` on every score/count/date column and monospace on IDs; `loading` buttons that **preserve width**; **Space to peek** + `↑`/`↓` in the submissions list *with a visible mouse affordance*; `⌘K` for actions with a **scoped placeholder** ("Search submissions…"), verb-phrase items, and recents when empty; `/` for search; right-click the logo → `/design-system` (rule 20d, Vercel's pattern). | swyx's loudest complaint about Sessionboard was that it's **sluggish** — speed is our stated differentiator, and perceived speed is mostly these details. Ranked last only because it presumes #1–#9 have landed. | `src/components/interior/*`, app shell, all mutations |

**Sequencing note.** Stripe migrated 100+ pages by shipping foundations in the order **typography →
spacing → colour**, deliberately paving the way for a card-less system. The reconciliation pass should
do the same: **#1–#4 (tokens) → #6 (widths/spacing) → #3, #5, #7–#9 (components and pages) → #10
(motion and polish)**. Doing components before tokens means doing them twice.
