import * as React from "react"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { createServerFn } from "@tanstack/react-start"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { ConvexReactClient } from "convex/react"
import { Toaster } from "@/components/ui/sonner"
import { authClient } from "@/lib/auth-client"
import { getToken } from "@/lib/auth-server"

import appCss from "../styles.css?url"

export interface RouterContext {
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
  convexClient: ConvexReactClient
}

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken()
})

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
    const token = await getAuth()
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

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
