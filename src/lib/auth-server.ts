import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"

const authServer = convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL!,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
    /**
     * Every SSR render calls `getToken()` from the root route's `beforeLoad`,
     * and without this it makes a round trip to the Convex site *on every
     * request* just to mint a JWT the browser is already carrying in the
     * `better-auth.convex_jwt` cookie. That round trip was the single largest
     * item in our TTFB (measured 220-550ms on the Worker build).
     *
     * With the cache the cookie's JWT is decoded locally and reused until it
     * is within a minute of expiring; only then does a fresh one get fetched.
     * `isAuthError` is the escape hatch: if Convex rejects a cached token
     * anyway, the helper retries once with a forced refresh.
     */
    jwtCache: {
      enabled: true,
      isAuthError: (error) =>
        error instanceof Error &&
        /unauthenticated|unauthorized|token|jwt|expired/i.test(error.message),
    },
  })

export const { getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  authServer

/**
 * Carry Cloudflare's canonical client address across the Worker → Convex
 * subrequest boundary under an application-owned header. Cloudflare reserves
 * and may rewrite its own `CF-Connecting-IP` header on subrequests; a plain
 * header clone therefore is not a dependable contract. We always overwrite
 * (or remove) the application header so a browser cannot choose its rate-limit
 * identity by sending one itself.
 */
export const handler = (request: Request) => {
  const headers = new Headers(request.headers)
  const clientIp = headers.get("cf-connecting-ip")
  if (clientIp) headers.set("x-trackstage-client-ip", clientIp)
  else headers.delete("x-trackstage-client-ip")
  return authServer.handler(new Request(request, { headers }))
}
