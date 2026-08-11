import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

/**
 * Reseed the shared dev deployment once per run so the suite starts from a
 * known world ("AI Engineer Summit 2026" + "Design Systems Day").
 *
 * `seed:run` purges and rebuilds every row belonging to the demo events, so a
 * previous run's leftovers (submissions, messages, plans) never leak into the
 * next one. Set `SB_SKIP_SEED=1` to run against whatever is already there.
 *
 * Individual specs must still be self-contained: other agents reseed this same
 * deployment mid-run, so nothing may assume "the event I saw at setup time is
 * still the current one" — always select the event explicitly.
 */
export default async function globalSetup() {
  if (process.env.SB_SKIP_SEED === "1") {
    console.log("[global-setup] SB_SKIP_SEED=1 — using existing data")
    return
  }
  const started = Date.now()
  try {
    execFileSync("pnpm", ["exec", "convex", "run", "seed:setup"], {
      cwd: root,
      stdio: "pipe",
      timeout: 180_000,
    })
    console.log(`[global-setup] reseeded in ${Date.now() - started}ms`)
  } catch (error) {
    // A failed reseed is worth shouting about but must not mask the real
    // suite result — the specs assert their own preconditions.
    const detail =
      error instanceof Error ? error.message.slice(0, 400) : String(error)
    console.warn(`[global-setup] reseed FAILED (continuing): ${detail}`)
  }
  // Demo assets (headshots, slide deck) are attached by a scheduled action.
  await new Promise((r) => setTimeout(r, 2_500))
}
