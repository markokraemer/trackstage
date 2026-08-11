import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
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
