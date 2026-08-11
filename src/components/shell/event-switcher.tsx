import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
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
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import { useCurrentEvent } from "@/lib/current-event"
import type { EventSummary } from "@/lib/current-event"

/**
 * Event switcher — the sidebar's event-context block IS the control
 * (docs/memory/RULES.md 23a). Clicking it lists every event you can reach,
 * grouped by the workspace that owns it, so the hierarchy
 * workspace → events is visible at the moment you switch.
 *
 * Mirrors Sessionboard's own two-level model (an event workspace you can leave
 * via "Back to organization"): "All events" is our organization dashboard.
 */
export function ShellEventSwitcher() {
  const { events, event, workspaces, selectEvent, isLoading } = useCurrentEvent()
  const [creating, setCreating] = useState(false)

  // Group by workspace, keeping the workspace order the user knows from the
  // account menu, and tolerating an event whose workspace hasn't loaded yet.
  const groups = useMemo(() => {
    const byWorkspace = new Map<string, Array<EventSummary>>()
    for (const row of events) {
      const key = row.organizationId as string
      const list = byWorkspace.get(key)
      if (list) list.push(row)
      else byWorkspace.set(key, [row])
    }
    const ordered: Array<{ id: string; name: string; events: Array<EventSummary> }> =
      []
    for (const workspace of workspaces) {
      const rows = byWorkspace.get(workspace.id)
      if (!rows) continue
      ordered.push({ id: workspace.id, name: workspace.name, events: rows })
      byWorkspace.delete(workspace.id)
    }
    for (const [id, rows] of byWorkspace) {
      ordered.push({
        id,
        name: rows[0]?.organizationName || "Workspace",
        events: rows,
      })
    }
    return ordered
  }, [events, workspaces])

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
                "max-md:justify-center max-md:px-1",
              )}
            />
          }
        >
          <EventTile
            name={event?.name}
            logoUrl={event?.logoUrl ?? undefined}
            size={26}
          />
          <span className="min-w-0 flex-1 max-md:sr-only">
            <span className="block truncate text-sm font-semibold text-foreground">
              {event?.name ?? (isLoading ? "Loading…" : "No event yet")}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {event ? dates : "Create your first event"}
            </span>
          </span>
          <RiExpandUpDownLine
            size={15}
            aria-hidden
            className="shrink-0 text-muted-foreground max-md:hidden"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {groups.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              {isLoading
                ? "Loading your events…"
                : "You haven't created an event yet."}
            </p>
          ) : (
            groups.map((group) => (
              <DropdownMenuGroup key={group.id}>
                <DropdownMenuLabel className="text-muted-foreground">
                  {group.name}
                </DropdownMenuLabel>
                {group.events.map((row) => (
                  <DropdownMenuItem
                    key={row._id}
                    onClick={() => selectEvent(row._id)}
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
                ))}
              </DropdownMenuGroup>
            ))
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            nativeButton={false}
            render={<Link to="/app/events" />}
          >
            <RiCalendarEventLine size={15} aria-hidden />
            All events
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <RiAddLine size={15} aria-hidden />
            New event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewEventDialog hideTrigger open={creating} onOpenChange={setCreating} />
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
