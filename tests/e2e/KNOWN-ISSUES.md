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
explaining exactly why. Every link-rendering `TabsTrigger` in the tree now does
this (`status-tabs`, `portal-tabs`, `settings-level-nav`, `app/settings/route`),
verified by grep.

**Next step:** the allowance is still listed in `KNOWN_CONSOLE_NOISE`. It was
deliberately left in place for the three verification runs so they measured one
constant configuration. Drop it, re-run `crawl.spec.ts` against every organizer
route, and if that stays green delete this section too.

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

**Related, and NOT a bug — checked rather than assumed:** the console error
`[copilot] MCP tool loading failed: getRequestHeaders is not a function`
(`src/routes/api/chat.ts:143`) looked like it meant the copilot was running
with zero tools. It isn't. Driving the real panel end to end, the copilot
renders a `data-tool` frame and answers correctly ("There are 7 pending
submissions"), and the destructive-approval card appears within 5 s with
Cancel / Approve & run. `getRequestHeaders` *is* exported by the installed
`@tanstack/react-start/server`. So this is the same transient mid-edit
module-graph inconsistency as KI-3 — logged, recovered from, harmless. It was
one verification away from being filed as a false S1 bug.

## KI-5 — duplicate React keys in the copilot's deadline list

**Severity:** medium — React's own message says rows "may be duplicated and/or
omitted", and this list is what the copilot shows an organizer when they ask
what's coming up.

**Repro:** sign in as the demo organizer, open the copilot (⌘I), ask anything
that calls `get_event_summary` ("what needs my attention?"), and watch the
console:

```
Encountered two children with the same key, `%s`. … Speaker task "Upload your
headshot" due
```

**Cause:** `src/components/copilot/tool-views/events.tsx:339`

```tsx
key={str(deadline.what) ?? index}
```

`deadline.what` is built in `convex/mcp.ts:1953` as
`Speaker task "${task.title}" due` — and the onboarding tasks created for every
accepted speaker share their titles ("Upload your headshot", "Complete your
speaker bio", "Upload your slides"). Two speakers with the same open task
therefore produce byte-identical keys.

**Fix:** make the key unique — `key={`${deadline.what}-${deadline.when}`}` or
just `key={index}`, since the list is a rendered slice with no reordering.

**Handling:** listed in `KNOWN_CONSOLE_NOISE` with this reference so
`copilot.spec.ts` still asserts what it exists to assert (the panel opens, the
answer streams, a tool ran). Delete the allowance with the fix.

## Recommended next step — give the specs their own event

Every flow spec currently works inside the seeded `ai-summit-2026` event. That
is the right default (it is the world a judge sees, and several specs genuinely
need the seeded CFP form, templates and roster), but it makes each test a
hostage to `seed:setup`: a reseed purges and recreates that event, and any test
holding its id or the rows it created dies mid-flight. Measured during this
build: the event id changed twice inside one two-minute window.

`retries: 2` covers it — the keyboard-drag spec needed all three attempts in
the last run and then passed — but the structural fix is for the specs that
don't depend on seeded content (agenda, triage, evaluation, speakers) to
`events.create` their own event, add rooms/tracks, select it in the switcher,
and delete it in a `finally`. That makes them immune to reseeding entirely and
would let the suite run green while the build fleet is active.

Keep `cfp-submit`, `forms-builder` and `emails` on the seeded event — they are
asserting the seeded CFP and templates on purpose.
