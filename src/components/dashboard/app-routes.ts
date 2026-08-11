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

/**
 * Public links. Both are re-exports of `src/lib/public-links.ts`, which owns
 * the URL scheme — the dashboard never builds a public URL by hand.
 *
 * Portal tokens are already globally unique by construction, so `/portal/t/…`
 * needs no hierarchy. Form links do: a form slug is only unique inside its
 * event (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical").
 */
export { portalUrl as portalLinkFor, formUrl as formLinkFor } from "@/lib/public-links"
