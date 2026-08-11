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
