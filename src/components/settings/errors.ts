/**
 * Convex surfaces a thrown `Error` to the client with the server stack glued
 * on. Organizers should never see that — pull out the sentence we wrote.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  const uncaught = /Uncaught (?:Convex)?Error:\s*(.+?)(?:\n|\s+at\s)/.exec(
    error.message,
  )
  if (uncaught?.[1]) return uncaught[1].trim()
  const firstLine = error.message.split("\n")[0]?.trim()
  return firstLine && firstLine.length < 200 ? firstLine : fallback
}
