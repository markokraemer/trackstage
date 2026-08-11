import * as React from "react"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { ConvexReactClient } from "convex/react"
import { Toaster } from "@/components/ui/sonner"
import { authClient } from "@/lib/auth-client"
import { getToken } from "@/lib/auth-server"

import appCss from "../styles.css?url"
// The one font file every screen paints with. Imported for its hashed URL so
// the browser can start fetching it from the document head instead of waiting
// for the stylesheet to parse — Inter is `font-display: swap`, so this is the
// difference between text and a flash of fallback text.
import interLatinWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url"

export interface RouterContext {
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
  convexClient: ConvexReactClient
}

/** Where the reactive websocket goes — warmed from the document head. */
const CONVEX_ORIGIN = new URL(import.meta.env.VITE_CONVEX_URL as string).origin

/**
 * The auth token for this request, or `null`.
 *
 * The cookie check is not a micro-optimisation: `getToken()` talks to the
 * Convex site, and this runs in the root `beforeLoad`, i.e. before *every*
 * page this app serves — including the landing page, the public CFP form, the
 * speaker portal and the public agenda, none of which have a session at all.
 * Anonymous visitors were paying a ~200ms round trip to be told "no token".
 * No Better Auth cookie ⇒ no session ⇒ nothing to ask about.
 */
const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server")
  const cookie = getRequestHeader("cookie") ?? ""
  if (!cookie.includes("better-auth.")) return null
  return await getToken()
})

/**
 * `beforeLoad` re-runs whenever the router (re)builds this match — including
 * once per route *preload*, and we warm every sidebar destination at idle. In
 * the browser `getAuth` is an HTTP call, so that was a burst of round trips
 * asking the same question. Hold the answer briefly instead.
 *
 * Sign-out does a full `window.location.assign`, and an expiring session is
 * caught by the live `useSession()` subscription in the shell, so a one-minute
 * window cannot strand anybody on a page they should not see.
 */
const AUTH_MEMO_MS = 60_000
let authMemo: { at: number; value: Awaited<ReturnType<typeof getAuth>> } | null = null

async function resolveAuth() {
  if (typeof document === "undefined") return await getAuth()
  if (authMemo && Date.now() - authMemo.at < AUTH_MEMO_MS) return authMemo.value
  const value = await getAuth()
  authMemo = { at: Date.now(), value }
  return value
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Trackstage",
      },
      {
        name: "description",
        content:
          "Open-source speaker and program management: call for speakers, review, speaker portal, and agenda building.",
      },
      { name: "theme-color", content: "#2F5CE0" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Trackstage" },
      { property: "og:title", content: "Trackstage" },
      {
        property: "og:description",
        content: "Open-source speaker and program management.",
      },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Trackstage" },
      {
        name: "twitter:description",
        content: "Open-source speaker and program management.",
      },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      // Warm the Convex socket's TCP+TLS handshake while the HTML is still
      // streaming, so the first reactive query does not pay for it.
      { rel: "preconnect", href: CONVEX_ORIGIN, crossOrigin: "anonymous" },
      {
        rel: "preload",
        href: interLatinWoff2,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  beforeLoad: async (ctx) => {
    const token = await resolveAuth()
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }
    return { isAuthenticated: !!token, token }
  },
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })

  // The Convex client is built with `expectAuth: true` (src/router.tsx), which
  // PAUSES its websocket until auth resolves one way or the other. Convex's
  // `ConvexProviderWithAuth` only ever calls `clearAuth()` in the *cleanup* of
  // an effect that runs when the visitor is authenticated — so a visitor who is
  // never authenticated never unpauses it. Every anonymous surface (the public
  // CFP form, the speaker portal, evaluator review links) then loads fine from
  // SSR data but hangs forever on its first live query or mutation.
  //
  // A visitor with no token resolves auth to "none" here, once, which is what
  // releases the socket — `clearAuth()` alone does NOT, only `setAuth()` runs
  // the code path that resumes it. Authenticated visitors carry a token and are
  // left to the provider, keeping the no-flash behaviour `expectAuth` is for.
  // Mount only — deliberately not re-run: a later sign-in goes through the
  // provider's own setAuth, which supersedes this.
  const released = React.useRef(false)
  React.useEffect(() => {
    if (released.current) return
    released.current = true
    if (!context.token) context.convexClient.setAuth(async () => null)
  }, [context.token, context.convexClient])

  return (
    <ConvexBetterAuthProvider
      client={context.convexClient}
      // Cast: the provider's AuthClient type predates the convexClient plugin
      // generics; runtime shape is exactly what it expects.
      authClient={authClient as unknown as React.ComponentProps<typeof ConvexBetterAuthProvider>["authClient"]}
      initialToken={context.token}
    >
      <Outlet />
    </ConvexBetterAuthProvider>
  )
}

/**
 * Opt-in only. The devtools badge floated over the bottom-right of every
 * screen in development and dragged its whole dependency tree into the dev
 * module graph; `VITE_DEVTOOLS=1` in `.env.local` brings it back when someone
 * actually wants it. `import.meta.env.DEV` is statically false in the Worker
 * build, so the branch (and the dynamic import) is dead code there.
 */
const DEVTOOLS_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_DEVTOOLS === "1"

function DevTools() {
  const [Panel, setPanel] = React.useState<React.ComponentType | null>(null)
  React.useEffect(() => {
    if (!DEVTOOLS_ENABLED) return
    void import("@/components/dev/devtools").then((mod) => setPanel(() => mod.default))
  }, [])
  return Panel ? <Panel /> : null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <DevTools />
        <Scripts />
      </body>
    </html>
  )
}
