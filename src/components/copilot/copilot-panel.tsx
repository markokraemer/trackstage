import { useEffect } from "react"
import { Link } from "@tanstack/react-router"
import {
  RiAddLine,
  RiExpandDiagonalLine,
  RiSparkling2Line,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { CopilotChat } from "@/components/copilot/copilot-chat"
import { useCopilotChat, useCopilotPanel } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * The copilot side panel — the copilot "next to any screen" half of
 * docs/memory/RULES.md #24 (the other half is /app/copilot).
 *
 * Non-modal on purpose: no scrim, no focus trap escape hatch needed, the
 * organizer keeps reading the table behind it while the copilot works. It is
 * still a Sheet (rule #17 — shadcn primitives, extended rather than
 * hand-rolled), just one that has been told not to dim the page.
 *
 * Conversation state lives in src/lib/copilot-store.ts, above the router, so
 * opening the panel on Submissions and then walking to Agenda keeps the
 * thread — and the full-page chat picks up exactly where the panel left off.
 */

/** Cmd/Ctrl+I. Cmd+K is reserved for a command palette. */
const SHORTCUT_KEY = "i"

export function CopilotPanel() {
  const { open, setOpen } = useCopilotPanel()
  const { event } = useCurrentEvent()
  const { newChat } = useCopilotChat(event?._id)

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key.toLowerCase() !== SHORTCUT_KEY) return
      if (!(keyEvent.metaKey || keyEvent.ctrlKey)) return
      keyEvent.preventDefault()
      setOpen(!open)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        side="right"
        showOverlay={false}
        showCloseButton
        aria-label="Sessionboard copilot"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <RiSparkling2Line size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-sm">Copilot</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {event?.name ?? "No event selected"}
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            title="New chat"
            onClick={newChat}
          >
            <RiAddLine size={16} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open full page"
            title="Open full page"
            nativeButton={false}
            render={<Link to="/app/copilot" onClick={() => setOpen(false)} />}
          >
            <RiExpandDiagonalLine size={16} aria-hidden />
          </Button>
          {/* Leaves room for SheetContent's built-in close button. */}
          <span aria-hidden className="w-7" />
        </header>

        <CopilotChat variant="panel" className="min-h-0 flex-1" />
      </SheetContent>
    </Sheet>
  )
}

/** The sparkle in the app top bar. Opens the panel; Cmd+I does the same. */
export function CopilotTriggerButton() {
  const { open, toggle } = useCopilotPanel()
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Open the AI copilot"
      aria-expanded={open}
      title="Copilot (⌘I)"
      onClick={toggle}
    >
      <RiSparkling2Line aria-hidden />
      <span className="max-sm:sr-only">Copilot</span>
    </Button>
  )
}
