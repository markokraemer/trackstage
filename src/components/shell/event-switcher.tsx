import { useState } from "react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import {
  RiAddLine,
  RiCalendarEventLine,
  RiCheckLine,
  RiExpandUpDownLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import {
  WorkspaceMenuSection,
  useWorkspaceSwitcher,
} from "@/components/shell/workspace-switcher"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import { eventScopedPath } from "@/lib/app-links"

/**
 * The sidebar context picker — the event-context block IS the control
 * (docs/memory/RULES.md 23a). It reads top-down as the hierarchy itself:
 *
 *   level 1  the WORKSPACE you're in → every workspace you belong to
 *   level 2  the EVENTS that workspace owns → the one you're working on
 *
 * Events are listed for the current workspace only. Showing every event of
 * every workspace in one flat list (as this used to) quietly denied that
 * workspaces are separate tenants — and got unreadable the moment someone was
 * invited into a second team.
 *
 * Mirrors Sessionboard's own two-level model (an event workspace you can leave
 * via "Back to organization"): "All events" is our organization dashboard.
 */
export function ShellEventSwitcher() {
  const { workspaceEvents, event, selectEvent, isLoading } = useCurrentEvent()
  const { workspaceOptions, workspace, switchTo, switchToCreated, creating, setCreating } =
    useWorkspaceSwitcher()
  const [creatingEvent, setCreatingEvent] = useState(false)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const currentOption = workspaceOptions.find((row) => row.isCurrent)

  const dates = event
    ? (formatZonedDateRange(event.startsAt, event.endsAt, event.timezone) ??
      "Dates not set")
    : undefined

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Switch event"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                "transition-colors outline-none hover:bg-sidebar-accent",
                "aria-expanded:bg-sidebar-accent",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            />
          }
        >
          <EventTile
            name={event?.name}
            logoUrl={event?.logoUrl ?? undefined}
            size={26}
          />
          <span className="min-w-0 flex-1">
            {/* While the event list is in flight this is a shape, not words:
                "Loading… / Create your first event" told an organizer with six
                events that they had none. Two lines of exactly this height, so
                the real name replaces them without moving anything. */}
            {!event && isLoading ? (
              <>
                <Skeleton className="my-0.5 block h-4 w-32 max-w-full" />
                <Skeleton className="my-0.5 block h-3 w-24 max-w-full" />
                <span className="sr-only">Loading your events…</span>
              </>
            ) : (
              <>
                <span className="block truncate text-sm font-semibold text-foreground">
                  {event?.name ?? "No event yet"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {event ? dates : "Create your first event"}
                </span>
              </>
            )}
          </span>
          <RiExpandUpDownLine
            size={15}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {/* Level 1 — which workspace am I in? */}
          <WorkspaceMenuSection
            workspaces={workspaceOptions}
            current={currentOption}
            onSelect={switchTo}
            onCreate={() => setCreating(true)}
          />

          <DropdownMenuSeparator />

          {/* Level 2 — which of ITS events am I working on? */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              Events{workspace ? ` in ${workspace.name}` : ""}
            </DropdownMenuLabel>
            {workspaceEvents.length === 0 ? (
              <p className="px-2 pb-1.5 text-sm text-muted-foreground">
                {isLoading
                  ? "Loading your events…"
                  : "No events yet — create one to get started."}
              </p>
            ) : (
              workspaceEvents.map((row) => (
                <DropdownMenuItem
                  key={row._id}
                  onClick={() => {
                    // The URL is the source of truth for event context
                    // (docs/memory/DECISIONS.md): switching NAVIGATES to the
                    // same section under the chosen event. The store write
                    // keeps bare legacy paths and global pages in step.
                    selectEvent(row._id)
                    const target = eventScopedPath(pathname, eventRefOf(row))
                    if (target) void navigate({ href: target })
                  }}
                >
                  <EventTile
                    name={row.name}
                    logoUrl={row.logoUrl ?? undefined}
                    size={22}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatZonedDateRange(
                        row.startsAt,
                        row.endsAt,
                        row.timezone,
                      ) ?? "Dates not set"}
                    </span>
                  </span>
                  {row._id === event?._id ? (
                    <RiCheckLine
                      size={15}
                      aria-hidden
                      className="text-primary"
                    />
                  ) : null}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            nativeButton={false}
            render={<Link to="/app/events" />}
          >
            <RiCalendarEventLine size={15} aria-hidden />
            All events
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreatingEvent(true)}>
            <RiAddLine size={15} aria-hidden />
            New event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewEventDialog
        hideTrigger
        open={creatingEvent}
        onOpenChange={setCreatingEvent}
      />
      {/*
        Both dialogs live OUTSIDE the menu: a dialog rendered inside
        DropdownMenuContent unmounts the instant the menu closes.
      */}
      <NewWorkspaceDialog
        hideTrigger
        open={creating}
        onOpenChange={setCreating}
        onCreated={switchToCreated}
      />
    </>
  )
}

/**
 * The event's identity, never ours.
 *
 * The switcher used to lead with the Trackstage logomark, which put the same
 * blue mark twice on one screen (top-left lockup + here) and told the
 * organizer nothing about which event they were in. It now shows the event's
 * uploaded logo when branding is set (convex/files.setEventBranding), and
 * otherwise a neutral tile carrying the event's initial — a calendar glyph
 * when there is no event yet.
 */
function EventTile({
  name,
  logoUrl,
  size,
}: {
  name?: string
  logoUrl?: string
  size: number
}) {
  const initial = name?.trim().charAt(0).toUpperCase()

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        "bg-muted text-muted-foreground ring-1 ring-border ring-inset",
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : initial ? (
        <span
          className="font-heading font-semibold text-foreground/70"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          {initial}
        </span>
      ) : (
        <RiCalendarEventLine size={Math.round(size * 0.58)} />
      )}
    </span>
  )
}
