# Known issues found by the e2e flow suite

Real product defects the `tests/e2e/flows/*` journeys hit. Each one is
reproducible by hand — none of them is papered over: either a spec is
`test.fixme`'d with the `KI-n` reference, or (for console noise) the pattern is
listed in `KNOWN_CONSOLE_NOISE` in `tests/e2e/flows/_helpers.ts` with the same
reference, so the failure stays visible in `crawl.spec.ts` instead of silently
disappearing.

Delete a row when it's fixed, and delete the matching allowance with it.

---

## KI-1 — Base UI console error on every `Tabs` that renders links

**Severity:** low (noise), but it is a real accessibility warning and it makes
the console-cleanliness net unusable on half the app.

**Repro**

```
pnpm exec playwright test --project=chromium -g "renders clean: /app/submissions"
```

or by hand: sign in as the demo organizer, open `/app/submissions`, look at the
browser console.

**Observed**

```
Base UI: A component that acts as a button expected a native <button> because
the `nativeButton` prop is true. Rendering a non-<button> removes native button
semantics, which can impact forms and accessibility. Use a real <button> in the
`render` prop, or set `nativeButton` to `false`.
    at TabsTr…
```

**Cause:** `TabsTrigger` is given `render={<Link …/>}` (status tabs are real
links so they're shareable/back-button-able — correct product decision), but
Base UI still defaults `nativeButton` to `true`, so it warns on every render.

**Fix:** pass `nativeButton={false}` wherever a `TabsTrigger` is rendered as a
`Link` (submissions status tabs, and any other tab strip built the same way).

**Affected specs:** all organizer flow specs — allowed via `KNOWN_CONSOLE_NOISE`
so the journeys still assert their own semantics. `crawl.spec.ts › organizer
routes › renders clean: /app/submissions` fails on it today, by design.

---

## KI-2 — Per-user submission limit copy contradicts the server

**Severity:** medium — an organizer configures a rule that behaves differently
from what the builder promises.

**Repro:** `/app/forms/:id` → step "Form settings" → turn on "Limit submissions
per person". The description reads **"Including saved drafts."** and the helper
text says drafts count toward the limit.

`convex/submit.ts` `submit` counts only submissions with `status !== "draft"`,
so drafts do **not** count. A submitter with `limitPerUser: 1` and one saved
draft can still submit.

**Fix:** either count drafts server-side, or change the builder copy to "Saved
drafts don't count."

**Affected specs:** `cfp-submit.spec.ts › per-user limit` asserts the *server*
behaviour (the one users actually experience) and additionally documents the
mismatch; it does not assert the builder copy.
