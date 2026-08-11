import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Standalone vitest config: unit tests run in plain Node, deliberately NOT
// through vite.config.ts (whose Cloudflare plugin would route tests into the
// workerd runner). E2E lives in Playwright (tests/e2e), not vitest.
export default defineConfig({
  // The app's own path aliases (tsconfig `paths`), repeated here because this
  // config deliberately does not extend vite.config.ts.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@convex": fileURLToPath(new URL("./convex", import.meta.url)),
    },
  },
  test: {
    // `.tsx` is included for the component tests, which opt into jsdom with a
    // per-file `// @vitest-environment jsdom` pragma — the default stays Node
    // so the pure-logic suites keep their fast, DOM-free runtime.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
  },
})
