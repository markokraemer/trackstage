import { createFileRoute } from "@tanstack/react-router"

// ————————————————————————————————————————————————————————————————————————
// OAuth 2.0 Authorization Server Metadata (RFC 8414) for the MCP server.
//
// The Sessionboard MCP endpoint lives on the Convex site and advertises THIS
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

async function metadata() {
  const upstream = await fetch(
    `${CONVEX_SITE_URL}/api/auth/.well-known/oauth-authorization-server`,
  )
  const body = await upstream.text()
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
