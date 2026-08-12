import { createFileRoute } from "@tanstack/react-router"

/**
 * App-origin auth proxy — hand-rolled 2026-08-12, replacing the library's
 * `handler` from @convex-dev/better-auth/react-start.
 *
 * Why: the library forwards with BOTH `x-better-auth-forwarded-host` (which
 * Better Auth on the Convex side uses to rebuild absolute URLs) and a plain
 * `x-forwarded-host`. Convex's edge router (usher) interprets a plain
 * `x-forwarded-host` as a custom-HTTP-domain lookup and answers 404 for
 * domains not registered with the deployment (custom domains are Pro-gated) —
 * which took production sign-in down. Same forward, minus that one header.
 */

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string

async function forward(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const nextUrl = `${CONVEX_SITE_URL}${requestUrl.pathname}${requestUrl.search}`
  const headers = new Headers(request.headers)
  headers.delete("transfer-encoding")
  headers.delete("content-length")
  headers.delete("connection")
  // The one deliberate difference from the library: no plain x-forwarded-host.
  headers.delete("x-forwarded-host")
  // Preserve Cloudflare's canonical client address for Better Auth's durable
  // rate limiter. Always overwrite (or remove) the application-owned bridge
  // header so a browser cannot choose its own rate-limit identity.
  const clientIp = headers.get("cf-connecting-ip")
  if (clientIp) headers.set("x-trackstage-client-ip", clientIp)
  else headers.delete("x-trackstage-client-ip")
  headers.set("accept-encoding", "application/json")
  headers.set("host", new URL(CONVEX_SITE_URL).host)
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(/:$/, ""))
  headers.set("x-better-auth-forwarded-host", requestUrl.host)
  headers.set(
    "x-better-auth-forwarded-proto",
    requestUrl.protocol.replace(/:$/, ""),
  )
  return fetch(nextUrl, {
    method: request.method,
    headers,
    redirect: "manual",
    body: request.body,
    // @ts-expect-error — required for streaming bodies in workerd, absent from lib.dom types
    duplex: "half",
  })
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => forward(request),
      POST: ({ request }) => forward(request),
    },
  },
})
