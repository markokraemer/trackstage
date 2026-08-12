import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { oAuthProtectedResourceMetadata } from "better-auth/plugins"
import { authComponent, createAuth } from "./auth"
import {
  handleMcpDelete,
  handleMcpGet,
  handleMcpOptions,
  handleMcpPost,
} from "./mcp"
import { handleApiOptions, handleApiRequest } from "./apiHttp"
import { FAVICON_PNG_BASE64, FAVICON_SVG } from "./lib/favicon"

// ————————————————————————————————————————————————————————————————————————
// Route table. The API itself lives in convex/apiHttp.ts (routing + auth +
// serialization) and convex/apiV1.ts (data); this file only wires paths to
// handlers so the whole surface is visible in one place.
// ————————————————————————————————————————————————————————————————————————

const http = httpRouter()

// Better Auth endpoints (sign-in/up, session, JWT for Convex).
authComponent.registerRoutes(http, createAuth)

// ——— Public REST API v1 (convex/apiHttp.ts) ——————————————————————————————
// One dispatcher owns the whole `/v1/` tree: Convex matches prefixes, not
// path templates, and every resource here nests several levels deep
// (`/v1/event/{ref}/sessions/{id}/files/{fileId}/complete`). Registering one
// prefix per method keeps the routing table honest instead of scattering
// near-identical prefixes that would shadow each other.
for (const method of ["GET", "POST", "PUT", "DELETE"] as const) {
  http.route({ pathPrefix: "/v1/", method, handler: handleApiRequest })
}
http.route({ pathPrefix: "/v1/", method: "OPTIONS", handler: handleApiOptions })

// ——— MCP server (convex/mcp.ts) ——————————————————————————————————————————
// One endpoint, MCP Streamable HTTP: POST carries JSON-RPC, GET would be the
// server-initiated SSE stream we deliberately don't offer (405 with a helpful
// body), OPTIONS is the CORS preflight browser-based clients send.
http.route({ path: "/mcp", method: "POST", handler: handleMcpPost })
http.route({ path: "/mcp", method: "GET", handler: handleMcpGet })
http.route({ path: "/mcp", method: "DELETE", handler: handleMcpDelete })
http.route({ path: "/mcp", method: "OPTIONS", handler: handleMcpOptions })

// ——— OAuth discovery (RFC 9728) ——————————————————————————————————————————
// This deployment is the protected RESOURCE; the authorization server is the
// app origin (see convex/auth.ts for why). Clients find that out here, either
// at the bare well-known path or at the path-suffixed form RFC 9728 defines
// for a resource that lives at /mcp. Claude and ChatGPT both probe these
// after a 401, which is what turns "add connector by URL" into a real login.
const protectedResourceMetadata = httpAction(async (ctx, request) => {
  const auth = createAuth(ctx)
  const response = await oAuthProtectedResourceMetadata(auth)(request)
  // better-auth's mcp() plugin advertises `<app>/api/auth/mcp/jwks`, a route it
  // never registers (that path belongs to its jwt() plugin, which we don't
  // mount). Point clients at the convex() plugin's live RS256 key set instead —
  // the same set the app-origin authorization-server metadata advertises.
  try {
    const body = await response.json()
    body.jwks_uri = `${process.env.CONVEX_SITE_URL}/api/auth/convex/jwks`
    // Name the resource by the origin the client actually reached us on: a
    // caller that added the branded custom domain must not be told its
    // resource lives on the raw *.convex.site host — clients compare the two
    // and treat a mismatch as someone else's resource.
    try {
      body.resource = `${new URL(request.url).origin}/mcp`
    } catch {
      /* unparseable URL — better-auth's own value stands */
    }
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: response.headers,
    })
  } catch {
    return response
  }
})

http.route({
  path: "/.well-known/oauth-protected-resource",
  method: "GET",
  handler: protectedResourceMetadata,
})
http.route({
  path: "/.well-known/oauth-protected-resource/mcp",
  method: "GET",
  handler: protectedResourceMetadata,
})
http.route({
  path: "/.well-known/oauth-protected-resource",
  method: "OPTIONS",
  handler: handleMcpOptions,
})
http.route({
  path: "/.well-known/oauth-protected-resource/mcp",
  method: "OPTIONS",
  handler: handleMcpOptions,
})

// ——— Brand mark ——————————————————————————————————————————————————————————
// MCP clients label a connector with the favicon of the endpoint's ORIGIN.
// Without these routes that fetch 404s and Claude/ChatGPT fall back to a
// generic (or Convex) mark — so the Trackstage icon is served right from the
// deployment, on *.convex.site and the custom domain alike (convex/lib/
// favicon.ts). Long cache: the mark changes never, the bytes are embedded.
const faviconPng = httpAction(async () => {
  const bytes = Uint8Array.from(atob(FAVICON_PNG_BASE64), (c) =>
    c.charCodeAt(0)
  )
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  })
})
const faviconSvg = httpAction(async () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  })
})
http.route({ path: "/favicon.ico", method: "GET", handler: faviconPng })
http.route({ path: "/favicon.png", method: "GET", handler: faviconPng })
http.route({ path: "/favicon.svg", method: "GET", handler: faviconSvg })
http.route({ path: "/apple-touch-icon.png", method: "GET", handler: faviconPng })

export default http
