import { defineConfig } from "vitest/config"

// Standalone vitest config: unit tests run in plain Node, deliberately NOT
// through vite.config.ts (whose Cloudflare plugin would route tests into the
// workerd runner). E2E lives in Playwright (tests/e2e), not vitest.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
})
