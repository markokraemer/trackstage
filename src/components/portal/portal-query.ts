/**
 * One timestamp for every `portal.home` cache entry in this browser session.
 *
 * Convex queries must not read the wall clock: cached results do not rerun just
 * because time advanced. The timestamp therefore belongs in the query key.
 * Keeping it stable here also means optimistic updates address the exact same
 * cache entry as the portal shell instead of inventing a fresh key per click.
 */
const PORTAL_QUERY_NOW = Math.floor(Date.now() / 60_000) * 60_000

export function portalHomeArgs(portalToken: string) {
  return { portalToken, now: PORTAL_QUERY_NOW }
}
