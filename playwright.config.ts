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
    // Per-flow end-to-end journeys (tests/e2e/flows). These drive real
    // multi-step product flows against the shared dev deployment, so they run
    // serially with one retry — pre-hydration clicks are the only flake we
    // tolerate; anything else is a product bug and belongs in KNOWN-ISSUES.md.
    {
      name: "flows",
      testMatch: /flows\/.*\.spec\.ts/,
      timeout: 120_000,
      retries: 1,
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
    },
  ],
})
