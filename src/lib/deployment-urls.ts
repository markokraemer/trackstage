/**
 * Where this deployment's HTTP surfaces live.
 *
 * Convex serves HTTP actions (`convex/http.ts` — the REST API and the MCP
 * endpoint) from the `.convex.site` twin of the `.convex.cloud` websocket URL.
 * One helper so the settings cards, the docs and anything else that has to
 * print a URL can never print a different one.
 */

/** `https://<deployment>.convex.site`, without a trailing slash. */
export function convexSiteUrl(): string {
  const site = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined
  if (site) return site.replace(/\/+$/, "")

  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (convexUrl) {
    return convexUrl.replace(/\/+$/, "").replace(".convex.cloud", ".convex.site")
  }
  return "https://your-deployment.convex.site"
}

/** The MCP Streamable-HTTP endpoint AI clients connect to. */
export function mcpEndpoint(): string {
  return `${convexSiteUrl()}/mcp`
}

/** Base for the public REST API — `${base}/v1/event/{slug}/…`. */
export function apiBaseUrl(): string {
  return convexSiteUrl()
}

/**
 * The bearer token the demo deployment ships with (`PUBLIC_API_TOKEN` defaults
 * to this in `convex/http.ts`), so the docs' copy-paste examples work as-is.
 */
export const DEMO_API_TOKEN = "demo-api-token"
