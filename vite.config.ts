import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { cloudflare } from "@cloudflare/vite-plugin"

const config = defineConfig(({ mode }) => {
  // The TanStack devtools plugin injects its client (and its event-bus socket)
  // into every dev page, and its panel used to float a badge over the app.
  // It is genuinely useful when you want it and pure noise when you do not, so
  // it is opt-in — `VITE_DEVTOOLS=1` in .env.local, matching the gate on the
  // panel itself in src/routes/__root.tsx. Never active in a build.
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const wantsDevtools = mode !== "production" && env.VITE_DEVTOOLS === "1"

  return {
    resolve: { tsconfigPaths: true },
    server: {
      watch: {
        // Playwright writes retained traces while Vite is serving the app.
        // They are test output, not source: watching them produced hundreds
        // of full-reload broadcasts after a failure and could restart a cold
        // shell while the remaining serial flow suite was still running.
        ignored: [
          "**/tests/e2e/.results/**",
          "**/playwright-report/**",
        ],
      },
    },
    plugins: [
      ...(wantsDevtools ? [devtools()] : []),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
