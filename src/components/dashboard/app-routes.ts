/**
 * Organizer destinations linked to from the dashboard and the speakers roster.
 *
 * They are declared as plain strings on purpose: the router's generated path
 * union only contains routes that exist on disk, and these screens are built
 * in sibling slices. Widening to `string` keeps the dashboard compiling
 * independently while the links stay ordinary `<Link>`s (docs/SPEC.md §1 —
 * every flow must work through real links for the browser-agent judge).
 */
export const APP_ROUTES: Record<
  | "dashboard"
  | "submissions"
  | "forms"
  | "agenda"
  | "speakers"
  | "communications"
  | "settings",
  string
> = {
  dashboard: "/app",
  submissions: "/app/submissions",
  forms: "/app/forms",
  agenda: "/app/agenda",
  speakers: "/app/speakers",
  communications: "/app/communications",
  settings: "/app/settings",
}

/**
 * Search params for one of the destinations above. The router types the
 * `search` prop against the routes that exist on disk, so params for a sibling
 * slice's route are passed through this helper; the router still builds a real
 * `?key=value` href at runtime.
 */
export function linkSearch(search: Record<string, string>) {
  return search as never
}

/** Public speaker-portal magic link for a person's `portalToken`. */
export function portalLinkFor(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin
  return `${origin}/portal/t/${token}`
}

/** Public submission form link for a form slug. */
export function formLinkFor(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin
  return `${origin}/submit/${slug}`
}
