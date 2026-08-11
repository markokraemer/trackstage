import { useEffect } from "react"
import { useRouter } from "@tanstack/react-router"

/**
 * Warms a handful of route chunks once the browser is idle.
 *
 * Routes are code-split, so the very first visit to a screen is "download the
 * chunk, *then* mount it, *then* subscribe" — a waterfall the user watches.
 * `defaultPreload: "intent"` already hides that behind a hover, but only for
 * someone who hovers; a browser agent (and a decisive human) clicks straight
 * away. The organizer app is small enough that we can simply have every
 * destination in memory before it is asked for.
 *
 * Deliberately one at a time on `requestIdleCallback`, so this never competes
 * with the current page's own data or the fonts.
 */
export function RoutePrewarm({ to }: { to: ReadonlyArray<string> }) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const schedule =
      typeof window.requestIdleCallback === "function"
        ? (cb: () => void) => window.requestIdleCallback(() => cb(), { timeout: 2000 })
        : (cb: () => void) => window.setTimeout(cb, 200)

    let index = 0
    const step = () => {
      if (cancelled || index >= to.length) return
      const next = to[index++]
      // `preloadRoute` is typed against the generated route tree; these paths
      // come from the nav config, which is a plain string list.
      void Promise.resolve(
        router.preloadRoute({ to: next } as never),
      ).catch(() => {
        /* a route that declines to preload is not a user-visible problem */
      })
      schedule(step)
    }
    schedule(step)

    return () => {
      cancelled = true
    }
  }, [router, to])

  return null
}
