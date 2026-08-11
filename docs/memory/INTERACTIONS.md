# Interactions — the adopted interior.dev library

Semantic memory. **Where each micro-interaction belongs in Sessionboard.** Rule 20(b)
directed adopting [interior.dev](https://www.interior.dev/docs) end to end "to add some
pep" while keeping our design language. This file is the map the reconciliation pass
(rule 19) integrates from.

## What was done

- **45 of interior.dev's 54 registry items adopted**, via
  `pnpm dlx shadcn@latest add https://www.interior.dev/r/<name>.json`.
  Sources land in `src/components/interior/*.tsx` (registry target from
  `components.json`). Each file exports a headless hook **and** a rendered component;
  the hook is the reusable half.
- **Import surface is `@/components/interactions`** — a barrel over all 45 plus our own
  `PepButton`. Never deep-import `@/components/interior/*` in app code.
- **No new dependencies.** `motion` v13 was already installed; every item's only
  dependency is `motion`. `package.json` was not touched.

### Restyled onto our tokens (they must look native)

Applied mechanically across all 45 files, animation timing untouched:

| interior.dev | Sessionboard |
| --- | --- |
| `stone-700…950` text | `text-foreground` |
| `stone-400…600` text | `text-muted-foreground` (`/70` for 400) |
| `stone-100/200/300` borders + fills | `border-border` / `border-input` / `bg-muted` / `bg-border` |
| `bg-white`, `from-white` | `bg-card`, `from-card` |
| `emerald-*` | `--status-green-*` |
| `red-*` | `--destructive` |
| `amber-*` | `--status-amber-*` |
| `#4568FF` / `#93B0FF` (their accent) | `var(--primary)` → `#2F5CE0`, or `border-ring` / `text-primary` |
| `rgba(28,25,23,…)` (their ink) | `rgba(27,30,39,…)` → `#1B1E27` |
| `rounded-[8/9px]`, `[10/11px]`, `[12/13/14px]` | `rounded-md` / `rounded-lg` / `rounded-xl` |
| all 506 `dark:` utilities | **deleted** — we are light-mode only (RULES.md #3) |

Then four indicators were moved from neutral to brand blue so they match our
`Progress`/`Button` language: the wizard Next button, the wizard rail fill, the slider
track fill + thumb, and the carousel's active dot. Dark-on-light thumbs kept elsewhere
(segmented control, filter chips, scroll-spy, wizard step markers) — that is the
interior signature and matches SPEC's "dark active step".

### NOT adopted — 9 items, deliberately

`modal` · `popover` · `drawer` · `dropdown` · `context-menu` · `tabs` · `accordion` ·
`tooltip-group` · `pagination`

These duplicate Base UI primitives we already rely on for a11y-critical structure —
focus traps, scroll locking, collision-aware positioning, roving tabindex, `aria-*`
wiring. RULES.md #17 makes `src/components/ui/*` canonical for those. Our shadcn
versions stay; interior's animation ideas can be ported *into* them later if wanted,
but the structure must not fork.

## The map — component → where it belongs

### Action feedback

| Component | Where we use it |
| --- | --- |
| `CopyButton` | Public CFP link, speaker-portal link, evaluator magic links, API keys, Airtable base id. |
| `LoadingButton` | Every async submit: save form step, send invite, commit a decision queue, sync Airtable. |
| `HoldToConfirm` | Irreversible organizer actions — **commit the Accept/Decline queue**, delete an event, remove a member. The guard rail before real emails go out. |
| `LikeBurst` | Evaluator shortlisting — one-tap "I want this talk", optimistic count that survives rapid taps. |
| `Ripple` | Large tap targets on touch: agenda slots, mobile portal rows, submission cards. |
| `IconMorph` | Sidebar collapse, drawer close, agenda expand/collapse. `menu-close`, `plus-minus`, `check-close`. |
| `PressDepth` | Raw mechanic — prefer `PepButton`. |
| **`PepButton`** (ours) | Opt-in wrapper: press-depth on shadcn `buttonVariants`, so the face is a normal Sessionboard button. **Hero CTAs only** (landing CTA, "Submit a talk", "Send decisions") — it adds a plinth, so it changes the box model. Never a blanket `Button` replacement. |

### Input

| Component | Where we use it |
| --- | --- |
| `FloatingLabelInput` | Dense forms where a label row costs too much — drawers, filter panels, inline edits. |
| `InlineValidation` | Public CFP fields. Error appears without shoving the rest of the form (reserves its line). |
| `PasswordStrength` | Better Auth sign-up and password reset (RULES.md #18c). |
| `OtpInput` | Speaker-portal magic-link codes and evaluator access codes. Auto-advance, paste, error recovery. |
| `TagInput` | **Form-builder select/multi-select option authoring**, session tags, track keywords. |
| `ExpandingSearch` | `DataToolbar` on Abstracts / Sessions / Speakers, plus the app top bar. |

### Async

| Component | Where we use it |
| --- | --- |
| `SkeletonSwap` | Every Convex-backed list on first paint. Reserves height → zero layout shift, which is the whole "we're faster than Sessionboard" differentiator. |
| `ProgressBar` | Airtable sync, bulk email send, CSV import. Indeterminate handing over to determinate. |
| `LoadMore` | Paginated Abstracts / Speakers lists — sentinel loads before the user hits the end. |
| `StreamingText` | AI-ish moments: generated session summaries, evaluator note drafts, conflict explanations. |
| `TaskSteps` | **Speaker onboarding checklist** and long organizer jobs (bulk decisions, imports) narrating their work. |

### Notification

| Component | Where we use it |
| --- | --- |
| `LiveActivity` | Background organizer jobs worn as a small dock — bulk email send, Airtable sync, import. Survives navigation. |
| `CollapsibleBanner` | "Your CFP closes in 3 days", setup nudges, outbox-preview notice for seeded `@example.com` recipients. Folds to its title, then lets go. |
| `PresenceAvatars` | **Speakers on a session**, evaluators in an evaluation plan, members in org settings. |
| `TypingIndicator` | Evaluator discussion threads, organizer↔speaker message threads. |
| `NewItemsPill` | Live Convex subscriptions — new abstracts arrive without stealing the organizer's scroll position. |

### Navigation

| Component | Where we use it |
| --- | --- |
| `CommandPalette` | ⌘K across the organizer app — jump to any event, screen, abstract, or speaker. Results reorder as you type. Our `ui/command.tsx` (cmdk) stays available; use whichever the surface already uses, don't mix in one screen. |
| `SegmentedControl` | **Agenda view switcher** — List / Day / Week / Rooms / Conflicts. Also Abstracts vs Sessions toggles. |
| `WizardSteps` | **Form builder's 7-step rail** and the public CFP's 5-step tracker. Its transition knows forward from back. |
| `TreeView` | Agenda by day → track → room; settings navigator. Arrow-key walkable. |

### Scroll

| Component | Where we use it |
| --- | --- |
| `StickyHeader` | Organizer page headers — condenses as the table scrolls under it. Compose with `shared/page-header.tsx`, don't replace it. |
| `ReadingProgress` | Long speaker-facing docs: CFP guidelines, code of conduct, event handbook. |
| `ScrollSpy` | Landing page section nav; the long Settings page rail. |
| `SnapCarousel` | Landing screenshot gallery; mobile agenda day-by-day paging. |
| `HideOnScroll` | `DataToolbar` on long tables — the filter bar yields to the rows. |

### Data

| Component | Where we use it |
| --- | --- |
| `SortableTable` | Abstracts / Sessions / Speakers tables — rows *travel* to their new order instead of blinking. Our `ui/table.tsx` stays the base for plain tables. |
| `FilterGrid` | Track / status filter chips over the submissions and speakers grids. Filtering rearranges, never flashes. |
| `ValueFlash` | **Dashboard metrics** on live Convex subscriptions — marks exactly what just changed, green up / red down. |
| `PollResults` | Evaluation-round outcomes; track-preference breakdowns. The winner lands last. |

### Gesture

| Component | Where we use it |
| --- | --- |
| `SliderDetents` | Evaluator scoring (1–5 with felt stops); agenda slot-length pickers. |
| `SwipeDeck` | **Evaluator triage** — decide a stack of abstracts one card at a time, with undo. |
| `ReorderList` | **Form-builder question order**, agenda running order. The gap the siblings open *is* the drop target. Note: we already use `@dnd-kit` for the agenda drag-drop — pick one per surface, don't nest them. |
| `LongPressButton` | Touch equivalent of right-click: bulk-select rows, agenda slot actions. |
| `Lightbox` | Speaker headshots, sponsor artwork. Zoom that returns to where it started. |

### Content

| Component | Where we use it |
| --- | --- |
| `TextReveal` | **Landing** hero headline and section intros — words arrive in reading order. |
| `LogoMarquee` | **Landing** "built on" / sponsor strip. Stops when you look at it. |
| `BlurUpImage` | Speaker headshots and landing screenshots — placeholder resolves into the photo. |
| `ShowMore` | Long abstract descriptions in tables, drawers, and the speaker portal. Height animates, text doesn't reflow. |

## Integration status

- **Catalogued**: `/design-system` → **Interactions** section shows all 46 tiles live
  (45 + `PepButton`), each captioned with its intended home. Component:
  `src/components/interactions/catalog.tsx`. This is the review surface.
- **Shipped into product screens**: none yet, by design. Slices belong to other agents
  and this pass must not restructure their screens. The table above is the work order.
- **`copy-button` was NOT swapped in.** There are already **three** near-identical
  copy-link buttons — `src/components/{settings,forms-builder,dashboard}/copy-link-button.tsx`
  — plus inline `navigator.clipboard.writeText` calls in
  `evaluation/review-link.tsx`, `comms/message-drawer.tsx`, and
  `dashboard/speakers-table.tsx`. They use our `Button` variants + toasts, so
  interior's `CopyButton` is not a drop-in (different chrome, no variant support).
  **Reconciliation job:** collapse those three into one
  `shared/copy-link-button.tsx` built on `useCopyToClipboard` from
  `@/components/interactions`, keeping our `Button` chrome and adding interior's
  width-locked label→tick crossfade.

## Rules for using these

1. Import from `@/components/interactions`, never `@/components/interior/*`.
2. The **hooks** are the reusable half. When a surface already has our chrome
   (`Button`, `Input`, `shared/*`), take `useCopyToClipboard` / `usePressDepth` /
   `useValueFlash` / `useTagInput` and keep our markup — don't import a whole
   second button style into a screen.
3. Never adopt the nine skipped overlay/nav items. `src/components/ui/*` is canonical
   for anything with a focus trap, a portal, or roving tabindex.
4. Everything honours `prefers-reduced-motion` already (`useReducedMotion` throughout).
   Don't strip it.
5. Re-running `shadcn add` for an interior item **overwrites the restyle**. If you
   update one, re-apply the token map above (or diff against a sibling file).
