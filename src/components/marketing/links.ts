/**
 * Destinations used across the marketing homepage.
 * Kept in one place so a URL never drifts between the nav, hero, pricing and footer.
 */

export const GITHUB_URL = "https://github.com/markokraemer/sessionboard"
export const GITHUB_LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`
export const GITHUB_README_URL = `${GITHUB_URL}#readme`
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`
export const SESSIONBOARD_URL = "https://www.sessionboard.com"
export const KILL_MY_SAAS_POST_URL =
  "https://x.com/swyx/status/2085517544795079014"
export const LATENT_SPACE_URL = "https://www.latent.space"

/**
 * Public product surfaces anyone can open without an account. These are real,
 * seeded routes (`convex/seed.ts`) — the landing page never links to a stub.
 */
export const DEMO_CFP_URL = "/submit/cfp"
export const DEMO_PORTAL_URL = "/portal"
export const DEMO_EVENT_SLUG = "ai-summit-2026"
export const DEMO_PROGRAM_URL = `/e/${DEMO_EVENT_SLUG}`
export const PUBLIC_API_PREFIX = "/api/v1"
/** The MCP endpoint agents connect to (Convex HTTP router, `convex/mcp.ts`). */
export const MCP_ENDPOINT_PATH = "/mcp"
/** Tool count exposed by our MCP server — keep in step with `convex/mcp.ts`. */
export const MCP_TOOL_COUNT = 27

/** In-page anchors. Section ids live here so nav and sections cannot drift. */
export const SECTION_IDS = {
  product: "product",
  demos: "demos",
  platform: "platform",
  openSource: "open-source",
  pricing: "pricing",
} as const

/** Props every external link on this page uses. */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noreferrer",
} as const
