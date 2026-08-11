import * as React from "react"
import { useRouterState } from "@tanstack/react-router"

import {
  THEME_STORAGE_KEY,
  applyThemeClass,
  isThemePreference,
  isThemeableRoute,
  persistTheme,
  resolveTheme,
} from "@/lib/theme"
import type { ResolvedTheme, ThemePreference } from "@/lib/theme"

interface ThemeContextValue {
  /** What the organizer CHOSE — including "system". */
  preference: ThemePreference
  /** What is actually painted right now, after "system" is resolved. */
  resolved: ResolvedTheme
  /** What the OS is currently asking for — shown next to the System option. */
  systemResolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

/**
 * The theme's single source of truth for the running app.
 *
 * It does NOT paint anything itself and renders no DOM: the class on <html> is
 * put there by the inline boot script before first paint, and kept in step
 * afterwards by the effect below. That split is the whole no-flash story —
 * React is too late to be the one that decides, so it only ever confirms.
 *
 * `initialPreference` is threaded in from the root route's `beforeLoad`, which
 * reads the theme cookie (on the server during SSR, from `document.cookie` in
 * the browser). Passing it in rather than reading storage in a `useState`
 * initializer is what lets the Appearance control render pre-selected on the
 * server without a hydration mismatch.
 */
export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference
  children: React.ReactNode
}) {
  const [preference, setPreferenceState] =
    React.useState<ThemePreference>(initialPreference)

  const systemPrefersDark = useSystemPrefersDark()

  // The route matters because dark mode is scoped to `/app/*` (src/lib/theme.ts).
  // Subscribing to just the pathname keeps this to one re-render per navigation.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const resolved = resolveTheme(preference, systemPrefersDark)
  const painted: ResolvedTheme = isThemeableRoute(pathname) ? resolved : "light"

  // Layout effect, not effect: on a client-side navigation OUT of /app the
  // class must be gone in the same frame the public page appears, or the first
  // paint of a marketing page is dark.
  React.useLayoutEffect(() => {
    applyThemeClass(painted)
  }, [painted])

  // Another tab changed the preference — follow it. (localStorage fires no
  // event in the tab that wrote it, so this cannot loop.)
  React.useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return
      if (isThemePreference(event.newValue)) setPreferenceState(event.newValue)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setPreference = React.useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    persistTheme(next)
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      systemResolved: systemPrefersDark ? "dark" : "light",
      setPreference,
    }),
    [preference, resolved, systemPrefersDark, setPreference],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const value = React.useContext(ThemeContext)
  if (!value) {
    throw new Error("useTheme must be used inside <ThemeProvider>")
  }
  return value
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

/**
 * A LIVE subscription, not a read: "System" means the app follows the OS as it
 * changes (macOS auto-appearance at sunset, Windows night light), in place.
 * The server snapshot is `false` — the server cannot know, and the boot script
 * has already corrected the document by the time this matters.
 */
function useSystemPrefersDark(): boolean {
  return React.useSyncExternalStore(
    subscribeSystemTheme,
    getSystemSnapshot,
    () => false,
  )
}

function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getSystemSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false
  return window.matchMedia(DARK_QUERY).matches
}
