import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

/**
 * A text input whose value lives in the URL — without the typing lag.
 *
 * Every filter on the public pages has to be linkable (a visitor shares
 * "?q=agents", the back button undoes a search, and the embed builder can
 * pre-seed one). Writing the URL on each keystroke would put the router in the
 * input's critical path, which rule 26 forbids: the field echoes instantly
 * from local state and the URL catches up on a short debounce, `replace: true`
 * so a five-letter search doesn't leave five history entries.
 *
 * The effect also re-syncs when the URL changes underneath us (back button,
 * a nav link that clears filters), which local-only state cannot do.
 */
export function useUrlText(
  urlValue: string | undefined,
  write: (value: string | undefined) => void,
  delay = 250,
): [string, (next: string) => void] {
  const [value, setValue] = useState(urlValue ?? "")
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  // What we last pushed, so an inbound URL change is distinguishable from the
  // echo of our own write.
  const lastWritten = useRef(urlValue ?? "")
  const writeRef = useRef(write)
  writeRef.current = write

  useEffect(() => {
    const incoming = urlValue ?? ""
    if (incoming === lastWritten.current) return
    lastWritten.current = incoming
    setValue(incoming)
  }, [urlValue])

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current)
    },
    [],
  )

  const set = (next: string) => {
    setValue(next)
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => {
      lastWritten.current = next
      writeRef.current(next.trim() === "" ? undefined : next)
    }, delay)
  }

  return [value, set]
}

/** `useNavigate`-backed setter for one search param on the current route. */
export function useSearchParamWriter() {
  const navigate = useNavigate()
  return (patch: Record<string, string | undefined>) => {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }),
      replace: true,
    })
  }
}
