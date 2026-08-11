/**
 * Convex surfaces a thrown `Error` to the client with the server stack glued
 * on. Organizers should never see that — pull out the sentence we wrote.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  // `Uncaught Error:` / `Uncaught ConvexError:` / any custom subclass name
  // (e.g. `Uncaught AirtableError:` from the Airtable integration).
  // Convex puts the stack on following lines, so the first line IS our
  // sentence — don't cut at " at ", which truncates any message containing
  // the word ("Create one at airtable.com/…").
  const uncaught = /Uncaught \w*Error:\s*(.+?)(?:\n|$)/.exec(error.message)
  if (uncaught?.[1]) return uncaught[1].trim()
  const firstLine = error.message.split("\n")[0]?.trim()
  return firstLine && firstLine.length < 200 ? firstLine : fallback
}
