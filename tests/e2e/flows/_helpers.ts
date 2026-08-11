import { expect } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
import { env, watchConsole } from "../utils"
import type { ConsoleWatcher } from "../utils"

export { env, watchConsole, assertNoErrorBoundary } from "../utils"
export { DEMO_ORGANIZER, ORGANIZER_STATE, organizerConvexClient } from "../utils"

export const MAIN_EVENT_SLUG = "ai-summit-2026"
export const MAIN_EVENT_NAME = "AI Engineer Summit 2026"
export const DEMO_WORKSPACE_NAME = "AI Engineer"
/** The demo workspace's URL slug — the first segment of every canonical address. */
export const DEMO_WORKSPACE_SLUG = "ai-engineer"

/**
 * A collision-proof identity for a spec run.
 *
 * Also the CONTRACT the seed's fixture purge matches on: `convex/seed.ts`
 * recognises the `-<base36 ms>-<rand>` tail (`E2E_FIXTURE_MARKER`) and deletes
 * anything carrying it, which is how `seed:setup` scrubs a run's leftovers out
 * of the demo world. Every synthetic title and email a spec creates must be
 * built from this (or from `testEmail`) — a fixture named by hand is a fixture
 * that survives the reset and greets a judge on the public programme.
 */
export function unique(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Emails ending in @example.com never leave the deployment: `deliverPending`
 * marks them "preview" instead of handing them to Resend. Every synthetic
 * recipient a test creates MUST use this so a run can never send real mail.
 */
export function testEmail(prefix: string) {
  return `${unique(prefix)}@example.com`
}

// ——— Backend access ————————————————————————————————————————————————————————

/** Anonymous Convex client (public queries only). */
export function anonConvexClient() {
  return new ConvexHttpClient(env.VITE_CONVEX_URL)
}

/** Sign in over Better Auth REST; returns the raw Convex JWT. */
export async function signInApi(email: string, password: string) {
  const res = await fetch(`${env.VITE_CONVEX_SITE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status}`)
  const jwt = res.headers
    .getSetCookie()
    .find((c) => c.includes("convex_jwt="))
    ?.match(/convex_jwt=([^;]+)/)?.[1]
  if (!jwt) throw new Error("no convex_jwt cookie in sign-in response")
  return decodeURIComponent(jwt)
}

export async function signUpApi(name: string, email: string, password: string) {
  const res = await fetch(`${env.VITE_CONVEX_SITE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ name, email, password }),
  })
  if (!res.ok) throw new Error(`sign-up failed for ${email}: ${res.status}`)
}

export async function clientFor(email: string, password: string) {
  const client = new ConvexHttpClient(env.VITE_CONVEX_URL)
  client.setAuth(await signInApi(email, password))
  return client
}

/**
 * Resolve the demo event by slug through an authed client. Specs must call
 * this rather than caching an id: other agents reseed this deployment
 * mid-run, which recreates the event with a brand-new id.
 */
export async function mainEvent(client: ConvexHttpClient) {
  const events = await client.query(api.events.list, {})
  const main = events.find((e) => e.slug === MAIN_EVENT_SLUG)
  if (!main) {
    throw new Error(
      `seed missing "${MAIN_EVENT_SLUG}" — run \`pnpm exec convex run seed:setup\``,
    )
  }
  return main
}

/**
 * Create a submission the way an organizer would from the "+ Add submission"
 * drawer, with one speaker attached. Specs use this instead of hand-rolling
 * `addManual` so a signature change lands in exactly one place.
 */
export async function createSubmission(
  client: ConvexHttpClient,
  args: {
    eventId: Id<"events">
    title: string
    status?: string
    kind?: "abstract" | "session"
    email?: string
    firstName?: string
    lastName?: string
    description?: string
  },
): Promise<Id<"submissions">> {
  return await client.mutation(api.submissions.addManual, {
    eventId: args.eventId,
    kind: args.kind ?? "abstract",
    title: args.title,
    description: args.description ?? "Created by the e2e flow suite.",
    status: args.status ?? "pending",
    speakerEmails: [
      {
        email: args.email ?? testEmail("speaker"),
        firstName: args.firstName ?? "Testy",
        lastName: args.lastName ?? "Speaker",
      },
    ],
  })
}

// ——— UI plumbing ———————————————————————————————————————————————————————————

/**
 * Console noise that is a REAL product bug, already failing loudly in
 * `tests/e2e/crawl.spec.ts` (the dedicated console-cleanliness net) and written
 * up in `tests/e2e/KNOWN-ISSUES.md`. Flow specs tolerate it so a known,
 * documented defect in one component can't mask a regression in the ten
 * journeys these files exist to protect. Delete an entry the moment its
 * KNOWN-ISSUES row is fixed — crawl.spec will tell you.
 */
export const KNOWN_CONSOLE_NOISE = [
  // KI-1: Base UI Tabs render Links via `render`, keeping nativeButton=true.
  /Base UI: A component that acts as a button expected a native <button>/i,
  // Not a page error at all: the TanStack devtools bridge replays *server*
  // console output into every connected browser tab, so a log emitted while
  // handling someone else's request shows up here. Dev-only transport noise.
  /__tsd\/open-source/i,
  // Vite's SSR module graph is momentarily inconsistent while a file is being
  // saved, and React's dispatcher comes back null mid-render ("Cannot read
  // properties of null (reading 'useRef'/'useContext')"). The app recovers by
  // client-rendering, and it does NOT reproduce against a settled server —
  // verified by curling the same routes with nothing being edited. This suite
  // runs while four agents write to src/, so tolerate it here; `crawl.spec.ts`
  // stays strict and is the place to judge SSR health from a quiet tree.
  /Switched to client rendering because the server rendering errored/i,
  // Same cause, network layer: a module request that lands during a rebuild
  // gets a 500 with no other context. The flows still have to pass — if a 500
  // actually broke the page, the journey's own assertions fail.
  /Failed to load resource.*status of 500/i,
  // KI-5: the copilot's deadline list keys rows by their label, and every
  // accepted speaker gets identically-titled onboarding tasks — so two
  // speakers with the same open task collide. A real bug with a one-line fix,
  // written up in KNOWN-ISSUES.md; allowed here so copilot.spec still tests
  // the panel, the stream and the tool call rather than re-reporting it.
  /Encountered two children with the same key/i,
]

/** Arm console tracking and return the watcher (call assertClean at the end). */
export function armed(page: Page, extraIgnored: Array<RegExp> = []): ConsoleWatcher {
  return watchConsole(page, [...KNOWN_CONSOLE_NOISE, ...extraIgnored])
}

/**
 * Fill a controlled input in a way that survives React hydration. Filling
 * before hydration finishes gets wiped when the controlled input mounts, so we
 * re-fill until the value sticks.
 */
export async function fillStable(locator: Locator, value: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await locator.fill(value)
    await locator.page().waitForTimeout(150)
    if ((await locator.inputValue()) === value) return
  }
  throw new Error(`could not stabilise input value "${value}"`)
}

/** Sign in through the real UI (hydration-retried, same shape as auth.setup). */
export async function uiSignIn(page: Page, email: string, password: string) {
  await gotoStable(page, "/login", "networkidle")
  for (let attempt = 0; attempt < 5; attempt++) {
    await fillStable(page.getByLabel("Email").first(), email)
    await fillStable(page.getByLabel("Password").first(), password)
    await page.getByRole("button", { name: /^sign in$/i }).first().click()
    try {
      await page.waitForURL(/\/app/, { timeout: 10_000 })
      return
    } catch {
      if (!page.url().includes("/app")) {
        await gotoStable(page, "/login", "networkidle")
      }
    }
  }
  throw new Error(`UI sign-in never reached /app for ${email}`)
}

/** Sign up a brand-new organizer through the real UI. */
export async function uiSignUp(
  page: Page,
  name: string,
  email: string,
  password: string,
) {
  await gotoStable(page, "/login", "networkidle")
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      // The signup tab only responds once React has hydrated; before that the
      // click is swallowed and the name field never mounts.
      const nameField = page.getByLabel(/your name/i).first()
      await expect(async () => {
        await page.getByRole("tab", { name: /create account/i }).first().click()
        await expect(nameField).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 30_000 })

      await fillStable(nameField, name)
      await fillStable(page.getByLabel("Email").first(), email)
      await fillStable(page.getByLabel("Password").first(), password)
      await page
        .getByRole("button", { name: /^create account$/i })
        .first()
        .click()
      await page.waitForURL(/\/app/, { timeout: 15_000 })
      return
    } catch {
      if (page.url().includes("/app")) return
      await gotoStable(page, "/login", "networkidle")
    }
  }
  throw new Error(`UI sign-up never reached /app for ${email}`)
}

/** Wait for the organizer shell to be interactive. */
export async function waitForShell(page: Page) {
  await expect(
    page.getByRole("button", { name: /switch event/i }).first(),
  ).toBeVisible({ timeout: 30_000 })
}

/**
 * Pin the shell to a named event. Other agents reseed mid-run and a fresh
 * browser lands on whichever event comes back first, so every organizer spec
 * calls this before asserting anything event-scoped.
 *
 * Switching events now NAVIGATES — it moves the address bar to the same
 * section under the chosen event's canonical `/app/:workspaceSlug/:eventSlug/…`
 * URL, not just a client-state flip — so this waits for that navigation to
 * settle rather than assuming the URL never moved.
 */
export async function selectEvent(page: Page, name = MAIN_EVENT_NAME) {
  const switcher = page.getByRole("button", { name: /switch event/i }).first()
  await expect(switcher).toBeVisible({ timeout: 30_000 })
  if ((await switcher.textContent())?.includes(name)) return
  const before = page.url()
  await switcher.click()
  await page.getByRole("menuitem", { name: new RegExp(name, "i") }).first().click()
  await expect(switcher).toContainText(new RegExp(name, "i"), { timeout: 15_000 })
  if (page.url() !== before) {
    await page.waitForLoadState("networkidle").catch(() => {})
  }
}

/**
 * Navigate, retrying the aborts the Vite dev server produces when another
 * agent saves a file mid-navigation (`net::ERR_ABORTED`). Product failures
 * still surface — only the transport-level abort is retried.
 */
export async function gotoStable(
  page: Page,
  path: string,
  waitUntil: "domcontentloaded" | "networkidle" = "domcontentloaded",
) {
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await page.goto(path, { waitUntil })
      // A dev server mid-rebuild answers 500 for a second or two. Product
      // failures (4xx, or a rendered error boundary) are returned as-is.
      if ((response?.status() ?? 0) >= 500 && attempt < 4) {
        await page.waitForTimeout(1_500)
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (!/ERR_ABORTED|ERR_CONNECTION|frame was detached/i.test(String(error))) {
        throw error
      }
      await page.waitForTimeout(1_000)
    }
  }
  if (lastError) throw lastError
  return await page.goto(path, { waitUntil })
}

/**
 * Open an organizer route with the demo event selected.
 *
 * `path` may be a bare legacy section (`/app/agenda`) or an already-canonical
 * one (`/app/ai-engineer/ai-summit-2026/agenda`). A bare section 307-redirects
 * client-side to its canonical `/app/:workspaceSlug/:eventSlug/…` address the
 * moment the stored event pointer resolves
 * (src/components/shell/legacy-redirect.tsx) — a few pages (`/app/copilot`,
 * `/app/account`) are global and never move. `waitForShell` already blocks
 * until the redirect lands (the switcher only renders on the real
 * destination), but this also waits for the URL itself to settle into
 * whichever shape — bare or canonical — matches the section that was asked
 * for, so a slow redirect can't race whatever the caller does next.
 */
export async function gotoApp(page: Page, path: string) {
  await gotoStable(page, path)
  await waitForShell(page)

  const pathname = path.split(/[?#]/)[0]
  const rest = pathname.replace(/^\/app\/?/, "")
  const escaped = rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = rest
    ? new RegExp(`\\/app\\/(?:[^/]+\\/[^/]+\\/)?${escaped}`)
    : new RegExp(`\\/app(?:\\/[^/]+\\/[^/]+)?(?:[/?#]|$)`)
  await page.waitForURL(pattern, { timeout: 15_000 }).catch(() => {})

  await selectEvent(page)
}

/**
 * Click a button until the page has visibly moved on. Public pages are
 * server-rendered, so the first click can land before React has hydrated and
 * is simply swallowed. Idempotent: if `settled` is already visible the click
 * is skipped, so a retry can never over-advance a wizard.
 */
export async function advance(
  page: Page,
  buttonName: RegExp,
  settled: Locator,
  { timeout = 45_000 } = {},
) {
  await expect(async () => {
    if (await settled.first().isVisible().catch(() => false)) return
    await page
      .getByRole("button", { name: buttonName })
      .first()
      .click({ timeout: 5_000 })
    await expect(settled.first()).toBeVisible({ timeout: 4_000 })
  }).toPass({ timeout })
}

/** Sonner toast text (any toast currently on screen). */
export function toasts(page: Page) {
  return page.locator("[data-sonner-toast]")
}

export async function expectToast(page: Page, pattern: RegExp, timeout = 15_000) {
  await expect(toasts(page).filter({ hasText: pattern }).first()).toBeVisible({
    timeout,
  })
}

/** Dismiss every visible toast so it can't intercept later clicks. */
export async function clearToasts(page: Page) {
  const all = toasts(page)
  for (let i = (await all.count()) - 1; i >= 0; i--) {
    await all.nth(i).click({ force: true }).catch(() => {})
  }
  await page.waitForTimeout(200)
}

/**
 * Poll a backend predicate. Used where the assertion is about data the UI
 * doesn't necessarily surface (outbox status transitions, task completion).
 */
export async function until<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  { timeout = 30_000, interval = 750, label = "condition" } = {},
): Promise<T> {
  const deadline = Date.now() + timeout
  let last: T | undefined
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      last = await fn()
      if (predicate(last)) return last
      lastError = undefined
    } catch (error) {
      // Another agent reseeding this deployment recreates the demo event with
      // a new id, which invalidates everything this test set up. Polling can
      // never recover from that, so surface it immediately and let the retry
      // start over against the new world instead of burning the timeout.
      if (/Event not found|Submission not found|Form not found/i.test(String(error))) {
        throw new Error(
          `the deployment was reseeded mid-test (waiting for ${label}) — retrying is the fix`,
        )
      }
      lastError = error
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  const detail = lastError
    ? `last error: ${String(lastError).slice(0, 200)}`
    : `last value: ${String(JSON.stringify(last)).slice(0, 400)}`
  throw new Error(`timed out waiting for ${label} — ${detail}`)
}

/** True when the locator resolves to at least one element within `timeout`. */
export async function present(locator: Locator, timeout = 3_000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout })
    return true
  } catch {
    return false
  }
}
