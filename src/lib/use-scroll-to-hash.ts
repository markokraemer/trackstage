import { useEffect } from "react"

/**
 * Scroll to the element named by the URL's `#hash` once the page has
 * rendered it. The router's own hash scroll runs on navigation — before a
 * Convex-backed settings card exists — so deep links like
 * `settings/fields-and-options#sponsors` call this once their data is in.
 */
export function useScrollToHash(ready: boolean) {
  useEffect(() => {
    if (!ready || typeof window === "undefined") return
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [ready])
}
