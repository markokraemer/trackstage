/**
 * Pull the sentence WE wrote out of whatever Convex hands the client.
 *
 * Three shapes have to be survived, and the first is the one that bit us in
 * production (docs/memory/BUILD-LOG.md — the Airtable connect report):
 *
 *  1. `ConvexError` — the only kind whose message crosses the boundary on a
 *     production deployment. The payload is on `.data`; `.message` is decorated
 *     with `[CONVEX A(module:fn)] [Request ID: …]` and a stack.
 *  2. A plain `Error` from a DEV deployment — message intact, stack glued on.
 *  3. A plain `Error` from a PROD deployment — the message is gone, replaced by
 *     `Server Error`. There is nothing to show, so we fall back rather than
 *     print Convex's plumbing at an event organizer.
 */

/** `[CONVEX A(airtable:connect)] [Request ID: abc] ` and friends. */
const CONVEX_PREFIX = /^(?:\[CONVEX [^\]]*\]\s*|\[Request ID:[^\]]*\]\s*)+/i

/** `Uncaught Error:` / `Uncaught ConvexError:` / `Uncaught AirtableError:`. */
const UNCAUGHT = /Uncaught \w*Error:\s*(.+?)(?:\n|$)/

function clean(value: string): string {
  return value.replace(CONVEX_PREFIX, "").trim()
}

function usable(value: string | undefined): value is string {
  if (!value) return false
  // Convex's redaction placeholder is not a message — it's the absence of one.
  return !/^Server Error\b/i.test(value) && value.length < 400
}

export function errorMessage(error: unknown, fallback: string): string {
  // 1. ConvexError carries the payload verbatim — always prefer it.
  const data = (error as { data?: unknown } | null)?.data
  if (typeof data === "string" && usable(clean(data))) return clean(data)
  if (data && typeof data === "object" && "message" in data) {
    const nested = (data as { message?: unknown }).message
    if (typeof nested === "string" && usable(clean(nested)))
      return clean(nested)
  }

  if (!(error instanceof Error)) return fallback

  // 2. `Uncaught …Error: <our sentence>` on a following line. Don't cut at
  // " at " — that truncates any message containing the word ("Create one at
  // airtable.com/…").
  const uncaught = UNCAUGHT.exec(error.message)?.[1]?.trim()
  if (usable(uncaught)) return clean(uncaught)

  // 3. First line, minus Convex's decoration.
  const firstLine = clean(error.message.split("\n")[0] ?? "")
  return usable(firstLine) ? firstLine : fallback
}
