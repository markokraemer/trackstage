import { useEffect, useRef } from "react"

/**
 * Ambient app-state context for the copilot — "what is the organizer looking
 * at right now?".
 *
 * Modelled on CopilotKit's `useCopilotReadable` (docs/reference/copilot-sota.md):
 * a component declares a fact about the screen, the fact lives in a registry
 * for exactly as long as that component is mounted, and everything currently
 * registered is flattened onto the next chat request. The point is that the
 * copilot can answer "decline this one" or "who's on stage here?" without the
 * organizer having to re-type what the screen already says.
 *
 * We replicate the pattern rather than take the dependency (that evaluation is
 * written up in docs/reference/copilot-sota.md): CopilotKit owns the transport
 * end to end, and our spine is the AI SDK + our own MCP server.
 *
 * Two deliberate differences from CopilotKit's version:
 *  - a HARD BUDGET. Context that grows without bound is a slow, expensive
 *    prompt; entries are truncated and the whole block is capped.
 *  - it is CONTEXT, NOT TRUTH. The system prompt says so explicitly, because a
 *    model that "reads" a count off the screen instead of calling a tool is
 *    exactly the failure mode rule #24 is trying to avoid.
 */

export type CopilotReadable = {
  id: string
  /** What this fact is, in the model's language. "Current page", "Filters". */
  label: string
  /** Rendered value. Objects are JSON; keep them small. */
  value: unknown
  /** Optional grouping — reserved for scoping a future second copilot. */
  category?: string
  /** Lower sorts first. Event/page context should outrank screen detail. */
  order?: number
}

/** Per-entry clip. A readable is a hint, never a payload. */
const MAX_ENTRY_CHARS = 200
/** Whole-block clip, so a busy screen can't crowd out the actual question. */
const MAX_CONTEXT_CHARS = 1200

const readables = new Map<string, CopilotReadable>()
const listeners = new Set<() => void>()
let sequence = 0

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeCopilotReadables(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function addCopilotReadable(entry: Omit<CopilotReadable, "id">): string {
  const id = `readable-${++sequence}`
  readables.set(id, { ...entry, id })
  notify()
  return id
}

export function removeCopilotReadable(id: string): void {
  if (readables.delete(id)) notify()
}

function serialize(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value)
  return text.length > MAX_ENTRY_CHARS
    ? `${text.slice(0, MAX_ENTRY_CHARS - 1)}…`
    : text
}

/**
 * Everything currently on screen, as a compact block for the system prompt.
 * Empty string when nothing is registered — the prompt then omits the section
 * entirely rather than telling the model about an empty screen.
 */
export function readCopilotContext(category?: string): string {
  const entries = [...readables.values()]
    .filter((entry) => !category || entry.category === category)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  const lines: Array<string> = []
  let used = 0
  for (const entry of entries) {
    const text = serialize(entry.value)
    if (!text) continue
    const line = `- ${entry.label}: ${text}`
    if (used + line.length > MAX_CONTEXT_CHARS) break
    lines.push(line)
    used += line.length
  }
  return lines.join("\n")
}

/** Test/debug helper — the raw registry, in render order. */
export function copilotReadables(): Array<CopilotReadable> {
  return [...readables.values()].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  )
}

/**
 * Declares one fact about the current screen for as long as this component is
 * mounted. Re-registers when the serialized value changes, so the copilot
 * always sees the current filter, not the one the page opened with.
 */
export function useCopilotReadable(entry: Omit<CopilotReadable, "id">): void {
  const idRef = useRef<string | null>(null)
  const serialized = serialize(entry.value)
  const { label, category, order } = entry

  useEffect(() => {
    if (!serialized) {
      idRef.current = null
      return
    }
    const id = addCopilotReadable({ label, value: serialized, category, order })
    idRef.current = id
    return () => removeCopilotReadable(id)
  }, [label, serialized, category, order])
}
