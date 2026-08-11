#!/usr/bin/env node
/**
 * Password-reset end-to-end verification (docs/memory/RULES.md #18e).
 *
 * This is the one leg the Playwright spec can't drive: the emailed link. It
 * walks the whole real flow against the running deployment —
 *
 *   sign up a throwaway @example.com organizer (a preview recipient, so no mail
 *   ever leaves) → POST /request-password-reset → read the scheduled action's
 *   preview log for the link Better Auth actually built → follow that link →
 *   land on /reset-password with a token → set a new password → sign in with it
 *   → prove the old one is dead and the token can't be replayed
 *
 * — plus the two properties that matter for security: an address with no
 * account gets the byte-identical response (no account enumeration), and a real
 * recipient's request is accepted whether or not Resend can ultimately deliver.
 *
 * Usage: pnpm dev (in another shell), then `node scripts/verify-password-reset.mjs`
 */

import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
)
const SITE = env.VITE_CONVEX_SITE_URL
const ORIGIN = process.env.APP_URL ?? "http://localhost:3000"
const HEADERS = { "Content-Type": "application/json", Origin: ORIGIN }

let failures = 0
const check = (ok, label, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

const stamp = Date.now().toString(36)
const EMAIL = `reset-probe-${stamp}@example.com`
const OLD_PASSWORD = "probe-old-2026"
const NEW_PASSWORD = "probe-new-2026"

const post = (path, body) =>
  fetch(`${SITE}/api/auth${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  })

// 1 — a throwaway account to reset ————————————————————————————————————————
const signUp = await post("/sign-up/email", {
  name: "Reset Probe",
  email: EMAIL,
  password: OLD_PASSWORD,
})
check(signUp.ok, "sign-up of throwaway organizer", `${signUp.status}`)

// 2 — ask for the link ————————————————————————————————————————————————————
const request = await post("/request-password-reset", {
  email: EMAIL,
  redirectTo: "/reset-password",
})
const requestBody = await request.json().catch(() => ({}))
check(request.status === 200, "request-password-reset returns 200", `${request.status}`)
check(
  /if this email exists/i.test(requestBody.message ?? ""),
  "response is non-committal about whether the account exists",
  JSON.stringify(requestBody),
)

// 3 — the email itself, via the preview log ————————————————————————————————
// @example.com recipients never reach Resend; sendPasswordReset logs the link
// instead, which is exactly what makes this flow verifiable without an inbox.
let link = null
for (let attempt = 0; attempt < 4 && !link; attempt++) {
  let out = ""
  try {
    // `convex logs` tails forever — ten seconds of it replays the history.
    out = execFileSync(
      "bash",
      ["-c", "timeout 10 pnpm exec convex logs --history 60 2>/dev/null"],
      { cwd: root, encoding: "utf8", timeout: 30_000 },
    )
  } catch (error) {
    out = error.stdout ?? ""
  }
  const line = out
    .split("\n")
    .reverse()
    .find((l) => l.includes("[email:preview] password-reset") && l.includes(EMAIL))
  // The CLI single-quotes the log line; drop the closing quote.
  if (line) link = line.match(/link=(\S+)/)?.[1]?.replace(/['"]+$/, "") ?? null
}
check(Boolean(link), "sendPasswordReset ran and logged the preview link", link ?? "not found")
check(
  Boolean(link?.includes("/api/auth/reset-password/")),
  "link points at Better Auth's validating callback",
  link ?? "",
)
check(
  Boolean(link?.includes(`callbackURL=${encodeURIComponent("/reset-password")}`)),
  "link carries our /reset-password callbackURL",
  link ?? "",
)

// 4 — follow it like a mail client would ——————————————————————————————————
let token = null
if (link) {
  const hop = await fetch(link, { redirect: "manual", headers: { Origin: ORIGIN } })
  const location = hop.headers.get("location") ?? ""
  check([302, 307].includes(hop.status), "callback redirects", `${hop.status} → ${location}`)
  const parsed = location ? new URL(location, ORIGIN) : null
  token = parsed?.searchParams.get("token") ?? null
  check(
    parsed?.pathname === "/reset-password" && Boolean(token),
    "redirect lands on /reset-password carrying the token",
    location,
  )
}

// 5 — the password actually changes ———————————————————————————————————————
if (token) {
  const reset = await post("/reset-password", { newPassword: NEW_PASSWORD, token })
  check(reset.ok, "reset-password accepts the token", `${reset.status}`)

  const newLogin = await post("/sign-in/email", { email: EMAIL, password: NEW_PASSWORD })
  check(newLogin.ok, "sign-in with the NEW password", `${newLogin.status}`)

  const oldLogin = await post("/sign-in/email", { email: EMAIL, password: OLD_PASSWORD })
  check(!oldLogin.ok, "old password no longer works", `${oldLogin.status}`)

  const replay = await post("/reset-password", { newPassword: "replay-attempt-1", token })
  check(!replay.ok, "the same token can't be replayed", `${replay.status}`)
}

// 6 — no account enumeration ——————————————————————————————————————————————
const unknown = await post("/request-password-reset", {
  email: `no-such-account-${stamp}@example.com`,
  redirectTo: "/reset-password",
})
const unknownBody = await unknown.json().catch(() => ({}))
check(
  unknown.status === 200 && unknownBody.message === requestBody.message,
  "an address with no account gets the identical 200 + message",
  `${unknown.status} ${JSON.stringify(unknownBody)}`,
)

// 7 — a real recipient is accepted (delivery is Resend's problem, not ours) ——
const demo = await post("/request-password-reset", {
  email: "organizer@demo.sessionboard.dev",
  redirectTo: "/reset-password",
})
check(
  demo.status === 200,
  "real (non-preview) recipient: request accepted, send handed to Resend",
  `${demo.status}`,
)

console.log(`\n${failures === 0 ? "ALL GREEN" : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
