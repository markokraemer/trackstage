# Attio revamp — the mechanical change list

Status: **EXECUTED, 2026-08-11**, with one amendment from Marko at rollout time:

> **The accent stays Sessionboard blue `#2F5CE0`.** Every neutral in the tables
> below shipped exactly as written — that is the part that fixes "too blue" —
> but the teal/petrol accent was reviewed and rejected: *"i don't like the teal
> color or the turquoise… i even preferred the blue that we had before."* So
> `--primary` is unchanged, and `--ring` / `--sidebar-primary` / `--chart-1`
> now reference it rather than repeating it. The status-green nudge to true
> green in §1 was a prerequisite for a teal accent only, and is **not** applied;
> green stays emerald.

Shipped as candidate **E — "De-blued"**: this file's neutral system with the
original accent. `/design-system` → Explorations is now the record of that
decision rather than a chooser; the candidate palettes and the four type
pairings (and their six webfonts) were removed from the page.

Source of truth for the target: the real Attio screens pulled via the Mobbin
MCP, plus Marko's caveat — **take Attio's system, not Attio's density.**

## The five rules the revamp enforces

1. **Chrome is neutral.** Near-white sidebar, white content, hairline borders.
   No tinted banner anywhere — the lavender `#EEF1FC` module header is the
   single most "vibe-coded" surface we have and it goes first.
2. **Colour carries data, not chrome.** Soft multi-tint tag pills for
   categorical data (track, format, tags); a small coloured dot plus a plain
   text label for state. Filled status pills stop being the default.
3. **Blue appears in three places only**: the primary button, links, and the
   selected-filter chip. Focus rings follow the accent token.
4. **Everything gets a bit larger.** Attio is built for power users at 32px
   controls; organizers are not power users. Controls go to 40px, rows to 44px+.
5. **One accent token.** `--primary` is the only place the brand colour is
   decided. Swapping blue → deep teal is a one-line change, independent of
   everything else here.

## 1. Token changes — `src/styles.css` `:root`

Every row is old → new. Rows marked **keep** are listed so the pass can verify
it did not miss one.

### Surfaces and text

| Token               | Now       | After     | Note                                       |
| ------------------- | --------- | --------- | ------------------------------------------ |
| `--background`      | `#F8FAFC` | `#FAFAFA` | Cool slate → neutral near-white.           |
| `--foreground`      | `#1B1E27` | `#17171A` | Navy-tinted ink → true deep ink.           |
| `--card`            | `#FFFFFF` | `#FFFFFF` | keep                                       |
| `--card-foreground` | `#1B1E27` | `#17171A` |                                            |
| `--popover`         | `#FFFFFF` | `#FFFFFF` | keep                                       |
| `--popover-fg`      | `#1B1E27` | `#17171A` | (`--popover-foreground`)                   |
| `--muted`           | `#F1F5F9` | `#F7F7F8` | Slate → neutral.                           |
| `--muted-foreground`| `#64748B` | `#6E6E76` | Secondary text step.                       |

### The blue removal (the heart of it)

| Token                        | Now       | After     | Note                                                |
| ---------------------------- | --------- | --------- | --------------------------------------------------- |
| `--accent`                   | `#EEF1FC` | `#F4F4F5` | **The lavender banner fill. Highest-impact line.**   |
| `--accent-foreground`        | `#1E3FA8` | `#17171A` | Blue text on tint → ink.                            |
| `--secondary`                | `#F1F5F9` | `#F4F4F5` |                                                     |
| `--secondary-foreground`     | `#1B1E27` | `#17171A` |                                                     |
| `--sidebar`                  | `#F1F5F9` | `#FAFAFA` | Slate panel → near-white.                           |
| `--sidebar-foreground`       | `#1B1E27` | `#17171A` |                                                     |
| `--sidebar-accent`           | `#E4EBFC` | `#EFEFF1` | **Active nav item stops being blue.**               |
| `--sidebar-accent-foreground`| `#1E3FA8` | `#17171A` |                                                     |
| `--sidebar-border`           | `#E2E8F0` | `#EAEAEC` |                                                     |

### Lines, focus, brand

| Token                 | Now       | After                  | Note                                        |
| --------------------- | --------- | ---------------------- | ------------------------------------------- |
| `--border`            | `#E5E7EB` | `#EAEAEC`              | The hairline.                               |
| `--input`             | `#DFE3EA` | `#E1E1E4`              |                                             |
| `--primary`           | `#2F5CE0` | `#2F5CE0` **(kept)**   | Decided: the blue stays. Teal/petrol rejected. |
| `--primary-foreground`| `#FFFFFF` | `#FFFFFF`              | keep — both candidates pass on white text.  |
| `--ring`              | `#2F5CE0` | = `--primary`          | Must follow the accent, not be re-typed.    |
| `--sidebar-primary`   | `#2F5CE0` | = `--primary`          | Same.                                       |
| `--destructive`       | `#DC2626` | `#DC2626`              | keep                                        |
| `--radius`            | `0.5rem`  | `0.5rem`               | keep                                        |

### Status system — state becomes dot + label

The `*-bg` / `*-fg` pairs stay defined (drawers and the queue banners still use
filled emphasis), but the **dot** is what the tables render. Blue state pills go
neutral so blue can mean "clickable".

| Token                | Now       | After     | Note                                    |
| -------------------- | --------- | --------- | --------------------------------------- |
| `--status-green-dot` | `#059669` | `#059669` | **Not applied** — the nudge existed only to clear a teal accent. |
| `--status-amber-dot` | `#D97706` | `#D97706` | keep                                     |
| `--status-red-dot`   | `#DC2626` | `#DC2626` | keep                                     |
| `--status-gray-bg`   | `#F1F5F9` | `#F4F4F5` |                                          |
| `--status-gray-fg`   | `#475569` | `#5F5F66` |                                          |
| `--status-gray-dot`  | `#94A3B8` | `#A1A1AA` |                                          |
| `--status-blue-bg`   | `#E4EBFC` | `#F4F4F5` | **Active/Scheduled stop reading blue.**  |
| `--status-blue-fg`   | `#1E3FA8` | `#5F5F66` |                                          |
| `--status-blue-dot`  | `#2F5CE0` | `#A1A1AA` |                                          |

Green/amber/red `*-bg` and `*-fg` values stay as they are — they are data
colours and already read correctly on a neutral ground.

### New tokens to add

Categorical tag tints (soft ~8% backgrounds, dark text) — these are what colour
is *for* after the revamp. Add to `:root` and expose through `@theme inline` the
same way the status palette is exposed.

| Token             | Value     |     | Token             | Value     |
| ----------------- | --------- | --- | ----------------- | --------- |
| `--tag-blue-bg`   | `#E6F0FB` |     | `--tag-blue-fg`   | `#1D4E89` |
| `--tag-green-bg`  | `#E7F4EC` |     | `--tag-green-fg`  | `#256040` |
| `--tag-amber-bg`  | `#FBF0DC` |     | `--tag-amber-fg`  | `#7A5A1E` |
| `--tag-purple-bg` | `#F3EAFB` |     | `--tag-purple-fg` | `#5B2F9A` |
| `--tag-gray-bg`   | `#F4F4F5` |     | `--tag-gray-fg`   | `#5F5F66` |

Sizing tokens (rule 4 — "make everything a bit larger"):

| Token              | Value    | Used by                            |
| ------------------ | -------- | ---------------------------------- |
| `--control-h`      | `2.5rem` | Button default, Input, Select, 40px |
| `--control-h-sm`   | `2.25rem`| Toolbar chips, table row actions, 36px |
| `--row-h`          | `2.75rem`| Table row minimum, 44px            |

## 2. Component pattern changes

Ordered by blast radius. Each one is a single shared component — that is the
whole reason the revamp is mechanical.

1. **`src/components/shared/page-header.tsx` — kill the banner.**
   `variant="banner"` currently renders `bg-accent` + `border-primary/10`.
   After: `plain` becomes the default, and `banner` renders as
   `bg-card border-b border-border` (a hairline rule, no fill). Every organizer
   route uses this component, so this one edit de-lavenders the whole app.
2. **`src/components/shared/status-pill.tsx` — add `variant="dot"` and make it
   the default.** Dot (`size-2` in the tone's `*-dot` colour) + plain label in
   `text-foreground`. Keep `variant="pill"` for the accept/decline queue banners
   and the drawer header, where staged emphasis is the point.
3. **New `src/components/shared/tag.tsx`** — the multi-tint categorical pill
   (track, format, level, language, free tags) on the `--tag-*` tokens, on a
   shadcn `Badge` base. Replaces every ad-hoc `<Badge variant="secondary">` used
   for data, and the colour-dot track markers in the agenda/submissions tables.
4. **`src/components/shared/data-toolbar.tsx` — Attio toolbar.** Left: view
   switcher (icon + name + chevron) as an outline button. Middle: sort/filter as
   small bordered chips, selected chips get `bg-primary/8 text-primary`
   (the only tinted-blue surface left). Right: "View settings" + Import/Export.
5. **`src/routes/app/route.tsx` — sidebar.** Neutral panel, active item on
   `--sidebar-accent` with ink text and `font-semibold`; nav item height to
   `--control-h`; group labels stay small-caps muted.
6. **`src/components/ui/button.tsx`** — default height to `--control-h`, `sm` to
   `--control-h-sm`, radius stays `rounded-md`. Primary stays solid; secondary
   actions become outline/ghost neutral.
7. **`src/components/ui/table.tsx`** — row minimum height `--row-h`, hairline
   dividers only (no zebra), column headers muted + optional leading icon, and
   an optional ghost footer row ("+ Add …") to match the reference.
8. **`src/components/ui/card.tsx`** — `shadow-none` + a single hairline. Depth
   comes from the border, not the shadow.
9. **Links in cells** — plain-text cells that navigate become
   `text-primary underline underline-offset-2`. This is where the blue goes.

## 3. What must NOT change

- **Density beyond the sizes above.** No tightening of padding, no smaller type
  scale, no 32px controls. Attio's density is explicitly rejected (#22).
- **The width system.** `--container-*` and the `.container-*` utilities landed
  separately (RULES.md #20e) and are orthogonal to this.
- **Light mode only.** The `dark` variant stays neutered (RULES.md #3).
- **The logomark.** Brand geometry is unaffected; only `--primary` moves, and
  the mark paints in `currentColor`, so it follows for free.

## 4. Execution order

1. Tokens (`src/styles.css`) — one commit, visually reviewable on every screen.
2. `PageHeader`, `StatusPill`, new `Tag`, `DataToolbar` — the four shared
   components.
3. `Button` / `Table` / `Card` sizing.
4. Sweep: replace data-carrying `Badge`s with `Tag`, state pills with dots,
   and delete any hardcoded hex left behind (`rg '#[0-9A-Fa-f]{6}' src/`).
5. `/design-system` refresh: the Color, Status and App-patterns sections
   document the new system; the Explorations section stays as the record of why.
6. Reconciliation pass (RULES.md #19) audits every screen against it.
