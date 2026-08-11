import { createFileRoute } from "@tanstack/react-router"
import { RiAddLine, RiSideBarLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { CopilotChat } from "@/components/copilot/copilot-chat"
import { useCopilotChat, useCopilotPanel } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/copilot")({
  component: CopilotPage,
})

/**
 * The full-page copilot (docs/memory/RULES.md #24). Same conversation as the
 * side panel — the `Chat` instance is shared through src/lib/copilot-store.ts
 * — just with room to breathe for longer sessions.
 */
function CopilotPage() {
  const { event } = useCurrentEvent()
  const { newChat } = useCopilotChat(event?._id)
  const { setOpen } = useCopilotPanel()

  return (
    // Full-bleed within the shell: escape main's vertical padding so the
    // conversation owns the whole height and the composer sits on the shell's
    // bottom edge — a workspace, not a card floating in one (Marko, 2026-08-11).
    <div className="-my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border py-3">
        <div className="min-w-0">
          <h1 className="font-heading truncate text-sm font-semibold text-foreground">
            Copilot
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {event
              ? `Working on ${event.name}`
              : "Create an event to give the copilot something to work on"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={newChat}>
            <RiAddLine aria-hidden />
            <span className="max-sm:sr-only">New chat</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Continue in the side panel"
            onClick={() => setOpen(true)}
          >
            <RiSideBarLine aria-hidden />
            <span className="max-sm:sr-only">Open as panel</span>
          </Button>
        </div>
      </header>

      <CopilotChat
        variant="page"
        className="min-h-0 flex-1"
        headline="What can I do for your event?"
      />
    </div>
  )
}
