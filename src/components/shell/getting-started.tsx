import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiCheckboxCircleFill,
  RiCircleLine,
  RiCloseLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { appLink } from "@/lib/app-links"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"

/**
 * "Getting started" — a quiet sidebar checklist for a young event (Marko,
 * 2026-08-12: guidance lives HERE, not in more wizard screens).
 *
 * Every checkmark is DERIVED from the event's real state
 * (convex/onboarding.ts::checklist) — nothing is ticked by hand, so it can
 * never lie. Each row links to the screen where the work happens. The ✕
 * dismisses it forever for this user + event; it also disappears by itself
 * once everything is done. Linear-widget energy: present, useful, ignorable.
 */
export function GettingStarted() {
  const { event, workspace } = useCurrentEvent()
  const { data } = useQuery(
    convexQuery(
      api.onboarding.checklist,
      event ? { eventId: event._id } : "skip",
    ),
  )
  const dismiss = useConvexMutation(api.onboarding.dismissChecklist)
  // Optimistic: the block leaves the instant the ✕ is clicked.
  const [dismissedNow, setDismissedNow] = useState<string | null>(null)

  if (!event || !workspace || !data) return null
  if (data.dismissed || dismissedNow === event._id) return null

  const ref = eventRefOf(event)
  // Marko's order (2026-08-12): describe the event, give it a stage, then
  // collect, share, and bring the team in.
  const items = [
    {
      label: "Add basic event details",
      done: data.hasBasics,
      to: appLink.settings(ref),
    },
    {
      label: "Add rooms & tracks",
      done: data.hasRoomsOrTracks,
      to: appLink.settingsSection(ref, "rooms-and-tracks"),
    },
    {
      label: "Build your CFP form",
      done: data.hasForm,
      to: appLink.forms(ref),
    },
    {
      label: "Share your public link",
      done: data.hasOpenForm,
      to: appLink.forms(ref),
    },
    {
      label: "Invite your team",
      done: data.hasTeam,
      // The workspace settings page's Team section, invite dialog open —
      // page URL + search params, so it survives the modal→page migration.
      to: `${appLink.workspaceHub(workspace.slug)}?invite=1&inviteEvent=${event._id}`,
    },
  ]
  const doneCount = items.filter((item) => item.done).length
  if (doneCount === items.length) return null

  return (
    <section
      aria-label="Getting started"
      data-tour="getting-started"
      className="animate-in fade-in-0 mx-3 mb-6 rounded-lg border border-border bg-card p-3 duration-200"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Getting started
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
            {doneCount} of {items.length}
          </span>
        </p>
        <button
          type="button"
          aria-label="Dismiss getting started"
          onClick={() => {
            setDismissedNow(event._id)
            void dismiss({ eventId: event._id }).catch(() => {})
          }}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RiCloseLine size={14} aria-hidden />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                item.done
                  ? "text-muted-foreground line-through decoration-border"
                  : "text-foreground/80",
              )}
            >
              {item.done ? (
                <RiCheckboxCircleFill
                  size={15}
                  aria-hidden
                  className="shrink-0 text-primary"
                />
              ) : (
                <RiCircleLine
                  size={15}
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                />
              )}
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="sr-only">{item.done ? " — done" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
