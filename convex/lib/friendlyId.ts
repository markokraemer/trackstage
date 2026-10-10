/**
 * Human-facing short id, mirroring their `friendly_id` / `friendly_id_raw`.
 * Convex ids are opaque strings, so the raw form is a stable numeric hash of
 * the id rather than a sequence — same contract (stable, sortable, short),
 * different derivation.
 */
export function friendlyId(prefix: string, id: string): { id: string; raw: number } {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const raw = hash % 100000
  return { id: `${prefix}-${raw}`, raw }
}
