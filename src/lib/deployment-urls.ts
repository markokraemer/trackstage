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

/**
 * The origin we ADVERTISE for the public HTTP surfaces (MCP + REST). When a
 * branded custom domain is attached to the Convex deployment (Convex
 * dashboard → project settings → Custom Domains), set VITE_PUBLIC_API_URL to
 * it and every printed endpoint becomes ours instead of *.convex.site.
 * Deliberately separate from VITE_CONVEX_SITE_URL, which stays on the raw
 * deployment host — the auth proxy, SSR session resolution and copilot tools
 * are wired through it and must not move when the branding does.
 */
export function publicApiOrigin(): string {
  const branded = import.meta.env.VITE_PUBLIC_API_URL as string | undefined
  if (branded) return branded.replace(/\/+$/, "")
  return convexSiteUrl()
}

/** The MCP Streamable-HTTP endpoint AI clients connect to. */
export function mcpEndpoint(): string {
  return `${publicApiOrigin()}/mcp`
}

/** Base for the public REST API — `${base}/v1/event/{slug}/…`. */
export function apiBaseUrl(): string {
  return publicApiOrigin()
}

/**
 * The bearer token the demo deployment ships with (`PUBLIC_API_TOKEN` defaults
 * to this in `convex/http.ts`), so the docs' copy-paste examples work as-is.
 */
export const DEMO_API_TOKEN = "demo-api-token"
