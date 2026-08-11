/**
 * DEPRECATED indirection. Organizer destinations now live in
 * `src/lib/app-links.ts` (`appLink.*` / `legacyAppLink.*`) — every event-scoped
 * screen needs an `EventRef` (`{workspaceSlug, eventSlug}`), which this module
 * has no way to carry as a static string map, so `APP_ROUTES` and its
 * `linkSearch` cast are gone. Callers that used to import `APP_ROUTES` now
 * import `appLink`/`legacyAppLink` directly and resolve the event in context
 * with `useCurrentEvent().eventRef` (docs/memory/DECISIONS.md, "URL
 * architecture is fully hierarchical").
 *
 * The two re-exports below still earn their keep: neither link needs an
 * `EventRef` (a portal token and a form's own `workspaceSlug`/`eventSlug` are
 * already globally unambiguous), so the dashboard keeps reaching for them
 * here instead of importing `src/lib/public-links.ts` directly.
 */

/**
 * Public links. Both are re-exports of `src/lib/public-links.ts`, which owns
 * the URL scheme — the dashboard never builds a public URL by hand.
 *
 * Portal tokens are already globally unique by construction, so `/portal/t/…`
 * needs no hierarchy. Form links do: a form slug is only unique inside its
 * event, so `formLinkFor` takes the workspace slug too
 * (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical").
 */
export { portalUrl as portalLinkFor, formUrl as formLinkFor } from "@/lib/public-links"
