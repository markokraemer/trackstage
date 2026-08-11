import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { RiAddLine, RiSideBarLine } from "@remixicon/react"

import { api } from "../../../convex/_generated/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CopilotChat } from "@/components/copilot/copilot-chat"
import { CopilotThreadRail } from "@/components/copilot/copilot-thread-rail"
import { McpConnectButton } from "@/components/settings/mcp-connect-dialog"
import { useCopilotChat, useCopilotPanel } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/copilot")({
  component: CopilotPage,
})

/**
 * The full-page copilot (docs/memory/RULES.md #24), as a real chat product:
 * history on the left, conversation in the middle, and a way to point an
 * outside client at the same tools in the header.
 *
 * Same conversation as the side panel — the `Chat` instance is shared through
 * src/lib/copilot-store.ts and the transcript is persisted by
 * copilot-thread-sync.tsx — so opening a chat here and continuing it in the
 * panel is one thread, not two.
 */
function CopilotPage() {
  const { event } = useCurrentEvent()
  const { newChat } = useCopilotChat(event?._id)
  const { setOpen } = useCopilotPanel()
  // Open on a desktop, out of the way on a phone — the rail is context, and
  // on a narrow screen the conversation has to win.
  const [railOpen, setRailOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 1024px)").matches
  )

  // Only used to decide how loud the empty state should be, and it is already
  // in cache from the rail — so this costs nothing.
  const { data: threads } = useQuery(
    convexQuery(api.copilotThreads.list, { eventId: event?._id })
  )
  const hasHistory = (threads?.length ?? 0) > 0

  return (
    // Full-bleed within the shell: escape main's padding so the rail meets the
    // sidebar and the composer sits on the shell's bottom edge — a workspace,
    // not a card floating in one (Marko, 2026-08-11).
    <div className="relative -mx-4 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 overflow-hidden sm:-mx-6">
      {railOpen ? (
        <>
          {/* On a narrow screen the rail floats over the conversation, so it
              needs something to dismiss it against. */}
          <button
            type="button"
            aria-label="Close conversation history"
            onClick={() => setRailOpen(false)}
            className="absolute inset-0 z-20 bg-foreground/10 lg:hidden"
          />
          <CopilotThreadRail
            className={cn(
              "z-30 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-lg"
            )}
            onPick={() => {
              if (!window.matchMedia("(min-width: 1024px)").matches) {
                setRailOpen(false)
              }
            }}
          />
        </>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/*
          NO bottom border, and exactly the height of the sidebar's event-
          switcher block (Marko, 2026-08-11): two hairlines meeting at slightly
          different heights across the sidebar seam read as broken chrome, so
          the header separates by space alone and its controls sit on the same
          invisible line as the switcher and the rail's "New chat".
        */}
        <header className="flex h-18 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  railOpen
                    ? "Hide conversation history"
                    : "Show conversation history"
                }
                aria-expanded={railOpen}
                onClick={() => setRailOpen((open) => !open)}
              >
                <RiSideBarLine size={16} aria-hidden />
              </Button>
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
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* The same tools this chat runs on, in whatever client the
                  organizer already lives in (rule 21). */}
              <McpConnectButton variant="ghost" />
              <Button variant="outline" size="sm" onClick={newChat}>
                <RiAddLine aria-hidden />
                <span className="max-sm:sr-only">New chat</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Continue in the side panel"
                onClick={() => setOpen(true)}
              >
                <RiSideBarLine size={16} aria-hidden className="rotate-180" />
              </Button>
            </div>
        </header>

        <CopilotChat
          variant="page"
          className="min-h-0 flex-1"
          headline="What can I do for your event?"
          slimEmptyState={hasHistory}
          autoFocus
        />
      </div>
    </div>
  )
}
