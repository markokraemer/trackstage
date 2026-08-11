import { defineConfig, devices } from "@playwright/test"

// UI end-to-end suite. Runs against the local dev server (reused if already
// running). Seeded demo data is assumed: `pnpm exec convex run seed:setup`.
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // suite shares one seeded deployment; keep runs deterministic
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /flows\//,
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
    },
    // Per-flow end-to-end journeys (tests/e2e/flows) — one file per user
    // flow, each driving the real UI end to end. They share one seeded
    // deployment, so they run serially (workers: 1, above). Anything that
    // fails all attempts is a product bug and belongs in
    // tests/e2e/KNOWN-ISSUES.md, not in a widened selector.
    {
      name: "flows",
      testMatch: /flows\/.*\.spec\.ts/,
      timeout: 120_000,
      // Two retries, not one. These specs share a deployment that other agents
      // reseed while the run is in flight — `seed:setup` recreates the demo
      // event with a new id, which invalidates whatever the running test set
      // up (measured: the id changed twice inside one two-minute window during
      // the build fleet's peak). A reseed collision is unrecoverable mid-test
      // and entirely uncorrelated with the next attempt, so retrying is the
      // correct response; a spec that fails all three times is a real failure.
      retries: 2,
      use: {
        ...devices["Desktop Chrome"],
        // Without this, an action on an element that never becomes actionable
        // blocks until the *test* timeout and reports a bare "timeout exceeded"
        // with no locator — the least debuggable failure there is. Bounding it
        // turns the same bug into "waiting for getByRole(…)".
        actionTimeout: 20_000,
      },
      dependencies: ["setup"],
    },
  ],
})
