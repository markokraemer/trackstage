import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { QueryClient, notifyManager } from "@tanstack/react-query"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  if (typeof document !== "undefined") {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (!CONVEX_URL) {
    throw new Error(
      "VITE_CONVEX_URL is not set. Run `pnpm dev:setup` to provision a Convex deployment, " +
        "or set it in .env.local to point at an existing one.",
    )
  }

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL, {
    expectAuth: true,
  })
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        // `convexQuery()` already pins `staleTime: Infinity` — Convex pushes
        // updates, so cached data is never stale. What decides whether a
        // *return* to a page is instant is `gcTime`: when React Query evicts
        // the entry, ConvexQueryClient drops the subscription with it and the
        // next visit starts from nothing. The default 5 minutes is shorter
        // than an organizer spends on the agenda before going back to the
        // dashboard, so hold the whole session's worth. A handful of live
        // subscriptions is exactly what the websocket is for.
        gcTime: 60 * 60 * 1000,
        // A dropped websocket frame should not cost a screenful of skeletons.
        retry: 2,
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      convexQueryClient,
      convexClient: convexQueryClient.convexClient,
    },
    scrollRestoration: true,
    // Hovering (or focusing, or touching) a link starts fetching its route
    // chunk, so the click has nothing left to wait for.
    defaultPreload: "intent",
    // Convex owns freshness; React Query's cache decides what a preload
    // reuses. Zero here means "ask the query cache", which is what we want —
    // it is NOT a re-fetch, because `convexQuery` data is never stale.
    defaultPreloadStaleTime: 0,
    // Default is 50ms of hover before preloading. A deliberate move to a
    // sidebar item is obvious well before that.
    defaultPreloadDelay: 20,
    // Nothing pending may appear for a switch that is about to finish anyway:
    // wait 200ms before showing any pending UI, and once shown keep it up long
    // enough (300ms) that it reads as a state rather than a flicker.
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
