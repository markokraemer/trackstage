/**
 * Copying text, the way it actually has to be done in 2026.
 *
 * `navigator.clipboard.writeText` is the right API and it is also the one that
 * quietly isn't there: it needs a secure context, it needs the document to be
 * focused, and a browser is free to refuse it outright. A "Copy link" button
 * that leaves the link nowhere the person can reach it is worse than no button
 * at all — so every failure falls through to the old hidden-textarea trick,
 * which works in exactly the places the modern API doesn't.
 *
 * Returns whether the text made it to the clipboard, so callers can say
 * something true either way.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fall through — a refusal here is ordinary, not exceptional. The API is
    // typed as always present but is genuinely absent on insecure origins.
  }

  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.top = "0"
  area.style.left = "0"
  area.style.opacity = "0"
  document.body.appendChild(area)

  const selection = document.getSelection()
  const previous =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  area.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }

  document.body.removeChild(area)
  if (selection && previous) {
    selection.removeAllRanges()
    selection.addRange(previous)
  }
  return ok
}
