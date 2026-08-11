# Known issues found by the e2e flow suite

Real product defects and environment hazards the `tests/e2e/flows/*` journeys
hit. Nothing here is papered over silently: a defect is either `test.fixme`'d
with its `KI-n` reference, or — for console noise — listed in
`KNOWN_CONSOLE_NOISE` in `tests/e2e/flows/_helpers.ts` with the same reference,
so the failure stays visible in `crawl.spec.ts` (the strict console net)
instead of disappearing.

Delete a row when it's fixed, and delete the matching allowance with it.

---

## KI-1 — Base UI console error on `Tabs` that render links · FIXED

**Was:** every `TabsTrigger` rendered as a `<Link>` logged

```
Base UI: A component that acts as a button expected a native <button> because
the `nativeButton` prop is true…
```

on every render, which made the console-cleanliness net unusable on half the
app (`/app/submissions` in particular).

**Fixed by** passing `nativeButton={false}` alongside `render={<Link …/>}` —
see `src/components/submissions/status-tabs.tsx`, which now carries a comment
explaining exactly why. The allowance stays in `KNOWN_CONSOLE_NOISE` for now
because the same pattern appears in several tab strips and only some have been
converted; remove it once `crawl.spec.ts` is green on every organizer route.

---

## KI-2 — Per-user submission limit copy contradicts the server

**Severity:** medium — the organizer configures a rule that behaves differently
from what the builder promises.

**Repro**

1. `/app/forms/:id` → step **Form settings** → enable "Limit submissions per
   person".
2. Read the description: **"Including saved drafts."**
   (`src/components/forms-builder/steps/settings-step.tsx:117`)
3. Now read `convex/submit.ts` (`submit`, the limit check): it filters
   `s.status !== "draft"` under the comment *"Per-user submission limit (drafts
   don't count)"*.

**Result:** with `limitPerUser: 1`, a submitter holding one saved draft can
still submit a second proposal. The builder said drafts would count.

**Fix:** pick one. Either count drafts server-side, or change the builder copy
to "Saved drafts don't count."

**Covered by:** `cfp-submit.spec.ts › hitting the per-user limit shows a
friendly error` asserts the *server* behaviour (what users actually experience)
and deliberately does not assert the builder's copy, so the spec stays green
whichever way this is resolved.

---

## KI-3 — Dev-server SSR falls back to client rendering mid-edit

**Severity:** environment, not product — recorded so the next person doesn't
chase it.

**Symptom:** a page emits

```
pageerror: Switched to client rendering because the server rendering errored:
Cannot read properties of null (reading 'useRef')      (or 'useContext')
```

and renders a bare `Loading…` shell for one request.

**Evidence it is churn, not a defect:** it never reproduces against a settled
server. `curl` on `/e/:slug`, `/submit/cfp`, `/login` and `/design-system`
while nothing is being saved returns fully server-rendered HTML with zero
`Loading…` placeholders. It appears only when a `src/` file is written during
the request, which is constant while the build fleet is running — Vite's SSR
module graph is briefly inconsistent and React's dispatcher comes back null.

**Handling:** tolerated in `KNOWN_CONSOLE_NOISE` for flow specs (they exist to
protect journeys, not to re-report one transient ten times per run). Judge SSR
health from `crawl.spec.ts` on a quiet tree.

**KI-4 — a mid-run reseed invalidates a test's fixtures.** `seed:setup`
recreates the demo event with a *new* id, so any spec holding one starts
getting `Event not found`. `until()` detects that specific error and fails
fast with "the deployment was reseeded mid-test" so Playwright's retry starts
over against the new world instead of burning the timeout. If you see that
message, nothing is broken — someone reseeded while you were running.

**Related, same cause:** `[copilot] MCP tool loading failed: getRequestHeaders
is not a function` (`src/routes/api/chat.ts:143`). `getRequestHeaders` *is*
exported by the installed `@tanstack/react-start/server` — verified directly —
so this is the same mid-edit module-graph inconsistency, surfacing through
`@convex-dev/better-auth`'s dynamic import. Worth re-checking on a quiet tree
before treating it as real: if it persists there, the copilot silently loses
every tool, which `copilot.spec.ts` will catch.
