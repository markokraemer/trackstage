import { createFileRoute } from "@tanstack/react-router"

// ————————————————————————————————————————————————————————————————————————
// OAuth 2.0 Authorization Server Metadata (RFC 8414) for the MCP server.
//
// The Trackstage MCP endpoint lives on the Convex site and advertises THIS
// origin as its authorization server (see convex/mcp.ts for why the browser
// leg has to happen here: the Better Auth session cookie is set on the app
// origin, because /api/auth/* is proxied from here to Convex).
//
// RFC 8414 requires the metadata to sit at <issuer>/.well-known/oauth-
// authorization-server, but Better Auth publishes it under its own base path
// (/api/auth/.well-known/…). This route republishes it at the well-known
// location so "add connector by URL" resolves in Claude and ChatGPT.
// ————————————————————————————————————————————————————————————————————————

const CONVEX_SITE_URL = (
  import.meta.env.VITE_CONVEX_SITE_URL ??
  (import.meta.env.VITE_CONVEX_URL ?? "").replace(".convex.cloud", ".convex.site")
).replace(/\/+$/, "")

/**
 * The JWKS clients actually get.
 *
 * Better Auth's `mcp()` plugin hardcodes `jwks_uri: <baseURL>/mcp/jwks` into
 * its authorization-server metadata, but it never registers that route — the
 * route only exists if the separate `jwt()` plugin is installed, and even then
 * its default path is `/jwks`. So the document advertised a URL that 404s, and
 * any spec-compliant connector that resolves `jwks_uri` to verify an RS256
 * id_token fell over on it.
 *
 * We already publish a real RS256 key set: the `convex()` Better Auth plugin
 * serves one here, and it is the key set our tokens are actually verifiable
 * against. Point discovery at the JWKS that exists rather than minting a
 * second one — adding `jwt()` would put a second key of a different algorithm
 * into the same store for no gain.
 */
const JWKS_URI = `${CONVEX_SITE_URL}/api/auth/convex/jwks`

/**
 * Rewrite `jwks_uri` to the URL that resolves, leaving every other field the
 * upstream document sets untouched. Anything unparseable is passed straight
 * through — a broken discovery document is still better than none.
 */
function withWorkingJwks(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return body
    }
    return JSON.stringify({ ...parsed, jwks_uri: JWKS_URI })
  } catch {
    return body
  }
}

async function metadata() {
  const upstream = await fetch(
    `${CONVEX_SITE_URL}/api/auth/.well-known/oauth-authorization-server`,
  )
  const body = withWorkingJwks(await upstream.text())
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: () => metadata(),
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
    },
  },
})
