# Decision log (semantic memory)

Format: date · decision · why · status.

- **2026-08-11 · TanStack Start over Next.js** — 100× faster builds (~400ms vs ~60s),
  native Cloudflare Workers via `@cloudflare/vite-plugin` (no OpenNext adapter risk).
  Evaluated in depth; Next 16.2.0 had a Workers crash history. ✅
- **2026-08-11 · Convex over InstantDB/Supabase** — scheduled functions (reminders),
  reactive queries (live dashboard), file storage, HTTP actions (API). ✅
- **2026-08-11 · Base UI preset `b7BYM32MS` (base-vega, remixicon)** — Marko's preset;
  Base UI is the new shadcn standard. No react-hook-form `form`; use `field.tsx`. ✅
- **2026-08-11 · Single app, no monorepo** — Marko's call after trying a workspace. ✅
- **2026-08-11 · Flattened organizer sidebar** (7 items vs Sessionboard's nesting) —
  video shows swyx getting lost in `Collect & Review`; master-pass guidance says flatten. ✅
- **2026-08-11 · No passwords in public flow; magic links everywhere** — swyx explicitly
  disliked the password wall; demo mode shows links inline so sbek's browser agent and
  judges never need an inbox. Organizer keeps seeded email+password (sbek config format). ✅
- **2026-08-11 · Accepted submissions ARE agenda sessions** — one `submissions` table
  with schedule fields; matches "abstracts become sessions"; makes the accepted→agenda→
  public handoff (a judged rubric type) trivial. ✅
- **2026-08-11 · sbek rubric amends the brief** — Public Widgets are a REQUIRED area
  (20%), Content Management (file versions + approvals) 15%, multi-event scoping judged
  (11%), AI agenda 10%. Build them despite the brief striking embeds. ✅
- **2026-08-11 · Private repo until submission** — competitor research stays private;
  flip public at submission time (rules require open source). ⏳ flip pending
- **2026-08-11 · Agenda views: List/Day/Rooms/Conflicts** (Week/Month cut) — Day+Rooms
  cover the job-to-be-done; conflicts get a dedicated view. ✅
- **2026-08-11 · Email via Resend if key present, else preview-in-outbox** — demo-safe,
  judges can verify content without delivery; .ics always downloadable. ✅
- **2026-08-11 · Design language E "De-blued" SHIPPED; Petrol/teal accent REJECTED** —
  the revamp landed the Attio-derived NEUTRAL system (chrome chroma ≤ 2, near-white
  #FAFAFA sidebar, hairline borders, no tinted banners, status as dot + label, 40px
  controls / 44px rows) but kept `--primary: #2F5CE0`. Marko reviewed Petrol `#0F6E70`
  — which won every measured axis in design-references.md §10 — and preferred the
  original blue: "i don't like the teal color or the turquoise… i even preferred the
  blue that we had before." The complaint was never the hue, it was how much chrome
  was wearing it. Colour policy (Stripe's, verbatim in /design-system): the accent is
  permitted in FIVE places — primary button, links, focus ring, active nav item,
  `--chart-1`. Consequences: the emerald→true-green status nudge is NOT needed (it was
  a petrol-adjacency fix) and is reverted; brand assets stay blue. ✅
- **2026-08-11 · /design-system Explorations is a record, not a chooser** — the six
  candidate palettes, four type pairings and their six variable webfonts were deleted
  from the page. Six fonts loading behind the app's longest page, plus ~45 self-driving
  interaction demos running `setInterval`/rAF forever off-screen, is what Marko saw as
  "flickering". Demos now mount only within 600px of the viewport. ✅
- **2026-08-11 · Toasts are pinned to `theme="light"`** — Sonner was following the OS
  theme on a light-mode-only app, so its dark rule painted the description line
  `hsl(0 0% 91%)` — near-white on white. Every toast colour now comes from a token. ✅
- **2026-08-11 · Right-click the logo opens a MENU, never a redirect** — RULES #20d's
  "right-click → /design-system" shipped as an auto-navigate and felt like a hijack.
  The affordance is a context menu that *offers* the design system alongside SVG/PNG
  download and copy-as-SVG (Vercel/Linear). New `ui/context-menu.tsx` on Base UI. ✅

