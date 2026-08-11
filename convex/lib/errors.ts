// ————————————————————————————————————————————————————————————————————————
// Reading a thrown refusal back out — the server-side twin of
// `src/lib/errors.ts`.
//
// Why it exists: **Convex redacts the `message` of an ordinary exception on a
// production deployment.** `throw new Error("Add at least one room first
// (Settings).")` reads perfectly against dev:neat-sparrow-926 and arrives on
// trackstage.app as `[Request ID: a1b2…] Server Error`. Only `ConvexError`
// crosses that boundary, and it crosses on `.data` — never on `.message`.
//
// So every user-facing refusal under convex/ is a `ConvexError` carrying its
// sentence as data, and the two layers that re-serialize those refusals into
// their own protocols read them through here:
//
//   · convex/apiHttp.ts  — the REST error body ("the message IS the API's copy")
//   · convex/mcp.ts      — the tool result a model reads and corrects itself on
//   · convex/apiV1.ts    — per-operation errors inside a bulk response
//
// Reading `.data` first is the whole point: it is the only field guaranteed to
// still hold a sentence out on production.
// ————————————————————————————————————————————————————————————————————————

/** `Uncaught Error:` / `Uncaught ConvexError:` — Convex's own decoration. */
const UNCAUGHT = /Uncaught \w*Error:\s*(.+?)(?:\n|$)/

/** `[CONVEX M(forms:update)] [Request ID: …] ` and friends. */
const PREFIX = /^(?:\[CONVEX [^\]]*\]\s*|\[Request ID:[^\]]*\]\s*)+/i

/** Convex's redaction placeholder is the absence of a message, not one. */
function usable(value: string | undefined): value is string {
  return Boolean(value) && !/^Server Error\b/i.test(value!)
}

export function humanMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null)?.data
  if (typeof data === "string" && data.trim()) return data.trim()
  if (data && typeof data === "object" && "message" in data) {
    const nested = (data as { message?: unknown }).message
    if (typeof nested === "string" && nested.trim()) return nested.trim()
  }

  const raw = error instanceof Error ? error.message : String(error)
  const uncaught = UNCAUGHT.exec(raw)?.[1]?.trim()
  if (usable(uncaught)) return uncaught

  const firstLine = raw.replace(PREFIX, "").split("\n")[0]?.trim()
  return usable(firstLine) ? firstLine : fallback
}
