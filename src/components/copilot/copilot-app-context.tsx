import { useRouterState } from "@tanstack/react-router"

import { useCopilotReadable } from "@/lib/copilot-context"
import { useCurrentEvent } from "@/lib/current-event"
import { statusLabel } from "@/components/shared/status-pill"

/**
 * Feeds the copilot what the organizer is looking at.
 *
 * Mounted once by the copilot panel (which lives in the /app shell), so every
 * organizer screen gets this for free without a per-screen edit. Two facts go
 * up with every message:
 *
 *  - the EVENT in the switcher — name, slug and dates, so the model can pass
 *    the right `event` argument and reason about "next week";
 *  - the SCREEN — which page, and the filters/selection that page keeps in the
 *    URL. Trackstage deliberately puts every filter in the query string
 *    (see /app/submissions, /app/agenda, /app/communications), which means the
 *    copilot can read the organizer's current view without any screen having
 *    to report it.
 *
 * The result is that "decline this one", "who's speaking here?" and "remind
 * these people" resolve against the screen instead of bouncing back a "which
 * one do you mean?". The system prompt is explicit that this is CONTEXT, not
 * truth — facts still come from tools (src/lib/copilot.ts).
 */

/** Route path → the name an organizer would use for that screen. */
const PAGE_NAMES: Array<[RegExp, string]> = [
  [/^\/app\/?$/, "Dashboard"],
  [/^\/app\/submissions/, "Submissions"],
  [/^\/app\/agenda/, "Agenda"],
  [/^\/app\/speakers/, "Speakers"],
  [/^\/app\/communications/, "Communications (email templates and outbox)"],
  [/^\/app\/forms\/new/, "Forms — new form wizard"],
  [/^\/app\/forms\/[^/]+/, "Form builder"],
  [/^\/app\/forms/, "Forms"],
  [/^\/app\/evaluation/, "Evaluation"],
  [/^\/app\/embeds/, "Embeds and public widgets"],
  [/^\/app\/events/, "All events"],
  [/^\/app\/settings\/rooms-and-tracks/, "Event settings — rooms and tracks"],
  [/^\/app\/settings\/integrations/, "Event settings — integrations"],
  [/^\/app\/settings/, "Event settings"],
  [/^\/app\/workspace/, "Workspace settings — the team and its events"],
  [/^\/app\/account/, "Account settings — your own profile, password and API keys"],
  [/^\/app\/copilot/, "the copilot's own full-page chat"],
]

function pageName(pathname: string): string {
  for (const [pattern, name] of PAGE_NAMES) {
    if (pattern.test(pathname)) return name
  }
  return pathname
}

/** URL search params → the sentence a person would say about them. */
function describeView(
  pathname: string,
  search: Record<string, unknown>
): string | null {
  const parts: Array<string> = []
  const value = (key: string): string | null => {
    const raw = search[key]
    return typeof raw === "string" && raw ? raw : null
  }

  if (pathname.startsWith("/app/submissions")) {
    const status = value("status")
    if (status) parts.push(`status filter "${statusLabel(status)}"`)
    if (value("track")) parts.push(`track "${value("track")}"`)
    if (value("q")) parts.push(`search "${value("q")}"`)
    if (value("id")) parts.push(`submission ${value("id")} open in the drawer`)
  } else if (pathname.startsWith("/app/agenda")) {
    if (value("view")) parts.push(`${value("view")} view`)
    if (value("day")) parts.push(`day ${value("day")}`)
    if (value("focus")) parts.push(`session ${value("focus")} highlighted`)
  } else if (pathname.startsWith("/app/communications")) {
    if (value("tab")) parts.push(`${value("tab")} tab`)
    const status = value("status")
    if (status && status !== "all") parts.push(`status "${status}"`)
  } else {
    // Everything else: report whatever the screen put in the URL verbatim.
    for (const [key, raw] of Object.entries(search)) {
      if (typeof raw === "string" && raw) parts.push(`${key}=${raw}`)
    }
  }

  return parts.length > 0 ? parts.join(", ") : null
}

export function CopilotAppContext() {
  const { event, workspace } = useCurrentEvent()
  const location = useRouterState({ select: (state) => state.location })
  const search = location.search as Record<string, unknown>
  const view = describeView(location.pathname, search)

  useCopilotReadable({
    label: "Selected event",
    order: 10,
    value: event
      ? {
          name: event.name,
          slug: event.slug,
          eventId: event._id,
          startsAt: event.startsAt
            ? new Date(event.startsAt).toISOString().slice(0, 10)
            : null,
          endsAt: event.endsAt
            ? new Date(event.endsAt).toISOString().slice(0, 10)
            : null,
          timezone: event.timezone,
        }
      : null,
  })

  useCopilotReadable({
    label: "Workspace",
    order: 20,
    value: workspace ? workspace.name : null,
  })

  useCopilotReadable({
    label: "Current screen",
    order: 30,
    value: `${pageName(location.pathname)} (${location.pathname})`,
  })

  useCopilotReadable({
    label: "Visible filters and selection",
    order: 40,
    value: view,
  })

  return null
}
