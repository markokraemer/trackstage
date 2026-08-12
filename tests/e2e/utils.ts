import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import type { Page } from "@playwright/test"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../convex/_generated/api.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const fileEnv = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
) as Record<string, string>

// Process-scoped values are how an audit can point Playwright at an isolated
// local/preview Convex deployment without rewriting the developer's
// `.env.local` (which may be symlinked across worktrees). Keep the file as the
// normal default, but let the supervised test process override the two public
// URLs exactly as Vite does.
export const env = {
  ...fileEnv,
  VITE_CONVEX_URL:
    process.env.VITE_CONVEX_URL ?? fileEnv.VITE_CONVEX_URL,
  VITE_CONVEX_SITE_URL:
    process.env.VITE_CONVEX_SITE_URL ?? fileEnv.VITE_CONVEX_SITE_URL,
} as Record<string, string>

export const DEMO_ORGANIZER = {
  email: "organizer@demo.sessionboard.dev",
  password: "demo2026",
}

export const ORGANIZER_STATE = "tests/e2e/.auth/organizer.json"

/** Sign in via Better Auth REST and return an authed Convex client. */
export async function organizerConvexClient(): Promise<ConvexHttpClient> {
  const res = await fetch(`${env.VITE_CONVEX_SITE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(DEMO_ORGANIZER),
  })
  if (!res.ok) throw new Error(`demo sign-in failed: ${res.status}`)
  const cookies = res.headers.getSetCookie()
  const jwt = cookies
    .find((c) => c.includes("convex_jwt="))
    ?.match(/convex_jwt=([^;]+)/)?.[1]
  if (!jwt) throw new Error("no convex_jwt in sign-in response")
  const client = new ConvexHttpClient(env.VITE_CONVEX_URL)
  client.setAuth(decodeURIComponent(jwt))
  return client
}

/** Seeded fixture handles for driving flows (portal + review tokens, ids). */
export async function demoFixtures() {
  const client = await organizerConvexClient()
  const events = await client.query(api.events.list, {})
  const main = events.find((e: { slug: string }) => e.slug === "ai-summit-2026")
  if (!main) throw new Error("seed missing — run `pnpm exec convex run seed:setup`")
  const roster = await client.query(api.dashboard.speakersRoster, {
    eventId: main._id,
  })
  const evaluators = await client.query(api.evaluationsAdmin.listEvaluators, {
    eventId: main._id,
  })
  return {
    client,
    event: main,
    portalToken: roster[0]?.portalToken as string | undefined,
    reviewToken: evaluators[0]?.token as string | undefined,
  }
}

export interface ConsoleWatcher {
  errors: string[]
  /** Forget everything seen so far — use after a deliberate negative case. */
  reset: () => void
  assertClean: (context: string) => void
}

/**
 * Arm a page with console/pageerror tracking. Any uncaught exception or
 * console.error fails the test — this is the net that catches runtime UI
 * breakage (missing providers, bad hook usage, hydration errors) everywhere.
 */
export function watchConsole(
  page: Page,
  extraIgnored: Array<RegExp> = [],
): ConsoleWatcher {
  const errors: string[] = []
  const IGNORED = [
    /Download the React DevTools/i,
    /\[vite\]/i,
    /Failed to load resource.*40[34]/i, // route-level 404s are asserted separately
    // Playwright's frame instrumentation can ask Chromium to execute inside
    // the intentionally script-less branded-email iframe. Chromium refusing
    // that request proves the sandbox is doing its job; the delivered HTML
    // contains no script, so this exact message is harness noise.
    /Blocked script execution in 'about:srcdoc'.*frame is sandboxed.*allow-scripts/i,
    ...extraIgnored,
  ]
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    if (IGNORED.some((pattern) => pattern.test(text))) return
    errors.push(text)
  })
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`)
  })
  return {
    errors,
    reset() {
      errors.length = 0
    },
    assertClean(context: string) {
      if (errors.length > 0) {
        throw new Error(
          `Console errors on ${context}:\n${errors.map((e) => `  · ${e.slice(0, 300)}`).join("\n")}`,
        )
      }
    },
  }
}

/** Fail if an error boundary or crash text is visible. */
export async function assertNoErrorBoundary(page: Page, context: string) {
  const crash = page.locator(
    "text=/Something went wrong|Internal Server Error|MenuGroupContext|Minified React error/i",
  )
  if ((await crash.count()) > 0) {
    throw new Error(`Error boundary/crash text visible on ${context}`)
  }
}
