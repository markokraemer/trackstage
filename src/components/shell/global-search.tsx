import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiCalendarScheduleLine,
  RiCornerDownLeftLine,
  RiFileList3Line,
  RiMailSendLine,
  RiSearchLine,
  RiSettings3Line,
  RiSparkling2Line,
  RiStarLine,
  RiSurveyLine,
  RiTimeLine,
  RiUserAddLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { InputGroupAddon } from "@/components/ui/input-group"
import { StatusPill } from "@/components/shared/status-pill"
import { useCopilotPanel } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"
import { dayKeyOf, safeTimeZone } from "@/components/agenda/agenda-time"

/**
 * Global search — the ⌘K palette behind the top bar's search affordance
 * (docs/memory/RULES.md #26: it must feel instant, and #17: it is the shadcn
 * `command` primitive, extended, not a hand-rolled listbox).
 *
 * Two halves, one piece of state:
 *  - `GlobalSearchTrigger` — the compact Attio/Linear-style button that lives
 *    in the middle of the top bar. A button, NOT a permanently focused input:
 *    a full-width focus-ringed field shouts at the organizer on every screen
 *    and still cannot show grouped results.
 *  - the palette itself — one Convex query (`api.search.global`) returning
 *    submissions, sessions, speakers and forms in a single round trip, plus
 *    client-side QUICK ACTIONS, which are routes rather than data and so need
 *    no server at all.
 *
 * Everything is reachable by keyboard: ⌘K (or Ctrl+K) opens, typing filters,
 * ↑/↓ move, Enter navigates, Esc closes.
 */

/** Debounce before the query fires. Typing itself always echoes instantly. */
const DEBOUNCE_MS = 120

const RECENTS_KEY = "sb.searchRecents"
const RECENTS_MAX = 5

// ——— Quick actions ————————————————————————————————————————————————————————

interface QuickAction {
  id: string
  label: string
  keywords: string
  icon: RemixiconComponentType
  run: (helpers: QuickActionHelpers) => void
}

interface QuickActionHelpers {
  go: (to: string, search?: Record<string, string>) => void
  openExternal: (href: string) => void
  openCopilot: () => void
  eventSlug: string | undefined
}

const QUICK_ACTIONS: Array<QuickAction> = [
  {
    id: "new-form",
    label: "Create a form",
    keywords: "new cfp call for papers builder add",
    icon: RiSurveyLine,
    run: ({ go }) => go("/app/forms/new"),
  },
  {
    id: "add-speaker",
    label: "Add a speaker",
    keywords: "new person invite participant",
    icon: RiUserAddLine,
    run: ({ go }) => go("/app/speakers", { add: "1" }),
  },
  {
    id: "agenda",
    label: "Open the agenda",
    keywords: "schedule programme program rooms conflicts calendar",
    icon: RiCalendarScheduleLine,
    run: ({ go }) => go("/app/agenda"),
  },
  {
    id: "review",
    label: "Review submissions",
    keywords: "abstracts triage pending queue accept decline",
    icon: RiFileList3Line,
    run: ({ go }) => go("/app/submissions"),
  },
  {
    id: "evaluation",
    label: "Open evaluation",
    keywords: "score reviewers plans rounds judges",
    icon: RiStarLine,
    run: ({ go }) => go("/app/evaluation"),
  },
  {
    id: "communications",
    label: "Send an email",
    keywords: "communications templates reminder invite ics",
    icon: RiMailSendLine,
    run: ({ go }) => go("/app/communications"),
  },
  {
    id: "copilot",
    label: "Ask the copilot",
    keywords: "ai chat assistant mcp",
    icon: RiSparkling2Line,
    run: ({ openCopilot }) => openCopilot(),
  },
  {
    id: "public",
    label: "View the public event page",
    keywords: "website preview live attendees",
    icon: RiArrowRightUpLine,
    run: ({ openExternal, eventSlug }) => {
      if (eventSlug) openExternal(`/e/${eventSlug}`)
    },
  },
  {
    id: "settings",
    label: "Event settings",
    keywords: "rooms tracks timezone dates branding",
    icon: RiSettings3Line,
    run: ({ go }) => go("/app/settings"),
  },
]

// ——— Recents ——————————————————————————————————————————————————————————————

function readRecents(): Array<string> {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is string => typeof row === "string")
  } catch {
    return []
  }
}

function rememberRecent(term: string): Array<string> {
  const trimmed = term.trim()
  if (trimmed.length < 2) return readRecents()
  const next = [
    trimmed,
    ...readRecents().filter(
      (row) => row.toLowerCase() !== trimmed.toLowerCase()
    ),
  ].slice(0, RECENTS_MAX)
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* private mode — recents are a convenience, never a requirement */
  }
  return next
}

// ——— The top-bar affordance ————————————————————————————————————————————————

export function GlobalSearchTrigger({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "group flex h-(--control-h-sm) w-full items-center gap-2 rounded-lg border border-border bg-muted/40 pr-1.5 pl-2.5",
        "text-sm text-muted-foreground transition-colors outline-none",
        "hover:border-border hover:bg-muted hover:text-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <RiSearchLine size={15} aria-hidden className="shrink-0" />
      <span className="flex-1 truncate text-left">Search</span>
      <Kbd className="max-sm:hidden">⌘K</Kbd>
    </button>
  )
}

function Kbd({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 items-center rounded-[5px] border border-border bg-card px-1.5",
        "font-sans text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  )
}

// ——— The palette ——————————————————————————————————————————————————————————

export function GlobalSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [debounced, setDebounced] = useState("")
  const [recents, setRecents] = useState<Array<string>>([])

  const navigate = useNavigate()
  const { event } = useCurrentEvent()
  const { setOpen: setCopilotOpen } = useCopilotPanel()

  // ⌘K / Ctrl+K from anywhere in the organizer app.
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key.toLowerCase() !== "k") return
      if (!(keyEvent.metaKey || keyEvent.ctrlKey)) return
      keyEvent.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Debounce the network, never the keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [input])

  // Reset on open so the palette never reopens holding a stale query.
  useEffect(() => {
    if (!open) return
    setInput("")
    setDebounced("")
    setRecents(readRecents())
  }, [open])

  const term = debounced
  const { data, isFetching } = useQuery({
    ...convexQuery(
      api.search.global,
      event && term.length > 0 ? { eventId: event._id, q: term } : "skip"
    ),
    // Keep the previous results on screen while the next ones land: results
    // that blink to "No matches" between keystrokes read as broken.
    placeholderData: keepPreviousData,
  })

  const results = term.length > 0 ? data : undefined
  const timeZone = safeTimeZone(results?.timezone ?? event?.timezone)

  const close = useCallback(() => setOpen(false), [])

  const helpers = useMemo<QuickActionHelpers>(
    () => ({
      go: (to, search) => {
        void navigate({ to: to as never, search: (search ?? {}) as never })
      },
      openExternal: (href) => window.open(href, "_blank", "noreferrer"),
      openCopilot: () => setCopilotOpen(true),
      eventSlug: event?.slug,
    }),
    [navigate, setCopilotOpen, event?.slug]
  )

  const commit = useCallback(
    (action: () => void) => {
      setRecents(rememberRecent(input))
      close()
      action()
    },
    [close, input]
  )

  const actions = useMemo(() => {
    const q = input.trim().toLowerCase()
    const terms = q.split(/\s+/).filter(Boolean)
    const visible = QUICK_ACTIONS.filter((action) => {
      if (action.id === "public" && !event?.slug) return false
      if (terms.length === 0) return true
      const haystack = `${action.label} ${action.keywords}`.toLowerCase()
      return terms.every((part) => haystack.includes(part))
    })
    // With a query on screen the actions are a footnote, not the headline.
    return terms.length === 0 ? visible : visible.slice(0, 3)
  }, [input, event?.slug])

  const hasResults =
    (results?.submissions.length ?? 0) +
      (results?.sessions.length ?? 0) +
      (results?.speakers.length ?? 0) +
      (results?.forms.length ?? 0) >
    0

  return (
    <>
      <GlobalSearchTrigger onClick={() => setOpen(true)} className={className} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          aria-label="Search Trackstage"
          className="top-[12vh] max-w-[min(38rem,calc(100%-2rem))] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[38rem]"
        >
          <DialogTitle className="sr-only">Search Trackstage</DialogTitle>
          <Command
            shouldFilter={false}
            loop
            label="Search Trackstage"
            className="rounded-none! bg-transparent p-0"
          >
            <CommandInput
              size="lg"
              autoFocus
              value={input}
              onValueChange={setInput}
              placeholder={
                event
                  ? `Search ${event.name}…`
                  : "Search submissions, speakers, sessions…"
              }
            >
              <InputGroupAddon align="inline-end" className="pr-3">
                {isFetching && term.length > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    Searching…
                  </span>
                ) : (
                  <Kbd>Esc</Kbd>
                )}
              </InputGroupAddon>
            </CommandInput>

            <CommandList className="max-h-[min(26rem,60vh)] p-1">
              {term.length > 0 && !hasResults && !isFetching ? (
                <CommandEmpty className="py-10 text-muted-foreground">
                  No matches for “{term}”.
                </CommandEmpty>
              ) : null}

              {/* Recents only make sense on the blank palette. */}
              {input.trim().length === 0 && recents.length > 0 ? (
                <CommandGroup heading="Recent searches">
                  {recents.map((recent) => (
                    <CommandItem
                      key={`recent-${recent}`}
                      value={`recent-${recent}`}
                      onSelect={() => setInput(recent)}
                    >
                      <RiTimeLine aria-hidden className="text-muted-foreground" />
                      <span className="truncate">{recent}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results && results.submissions.length > 0 ? (
                <CommandGroup heading="Submissions">
                  {results.submissions.map((row) => (
                    <CommandItem
                      key={row.id}
                      value={`submission-${row.id}`}
                      onSelect={() =>
                        commit(() =>
                          helpers.go("/app/submissions", { id: row.id })
                        )
                      }
                    >
                      <RiFileList3Line
                        aria-hidden
                        className="text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {row.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.speakers}
                          {row.trackName ? ` · ${row.trackName}` : ""}
                        </span>
                      </span>
                      <StatusPill status={row.status} size="sm" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results && results.sessions.length > 0 ? (
                <CommandGroup heading="Scheduled sessions">
                  {results.sessions.map((row) => (
                    <CommandItem
                      key={row.id}
                      value={`session-${row.id}`}
                      onSelect={() =>
                        commit(() =>
                          helpers.go("/app/agenda", {
                            view: "day",
                            day: dayKeyOf(row.startsAt, timeZone),
                            focus: row.id,
                          })
                        )
                      }
                    >
                      <RiCalendarScheduleLine
                        aria-hidden
                        className="text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {row.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatSlot(row.startsAt, timeZone)}
                          {row.roomName ? ` · ${row.roomName}` : ""}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results && results.speakers.length > 0 ? (
                <CommandGroup heading="Speakers">
                  {results.speakers.map((row) => (
                    <CommandItem
                      key={row.personId}
                      value={`speaker-${row.personId}`}
                      onSelect={() =>
                        commit(() =>
                          helpers.go("/app/speakers", { person: row.personId })
                        )
                      }
                    >
                      <RiUserVoiceLine
                        aria-hidden
                        className="text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {row.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.company ? `${row.company} · ` : ""}
                          {row.email}
                        </span>
                      </span>
                      {row.missing.length > 0 ? (
                        <span className="flex shrink-0 items-center gap-1">
                          {row.missing.slice(0, 2).map((chip) => (
                            <span
                              key={chip}
                              className="rounded-full bg-status-amber-bg px-2 py-0.5 text-[11px] text-status-amber-fg"
                            >
                              {chip}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results && results.forms.length > 0 ? (
                <CommandGroup heading="Forms">
                  {results.forms.map((row) => (
                    <CommandItem
                      key={row.formId}
                      value={`form-${row.formId}`}
                      onSelect={() =>
                        commit(() =>
                          void navigate({
                            to: "/app/forms/$formId",
                            params: { formId: row.formId },
                          })
                        )
                      }
                    >
                      <RiSurveyLine
                        aria-hidden
                        className="text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {row.name}
                      </span>
                      <StatusPill status={row.status} size="sm" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {actions.length > 0 ? (
                <CommandGroup heading="Actions">
                  {actions.map((action) => (
                    <CommandItem
                      key={action.id}
                      value={`action-${action.id}`}
                      onSelect={() => commit(() => action.run(helpers))}
                    >
                      <action.icon
                        aria-hidden
                        className="text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {action.label}
                      </span>
                      {action.id === "new-form" || action.id === "add-speaker" ? (
                        <RiAddLine
                          aria-hidden
                          className="text-muted-foreground"
                        />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>

            <footer className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <RiCornerDownLeftLine size={11} aria-hidden />
                </Kbd>
                to open
              </span>
              <span className="ml-auto truncate">
                {event ? event.name : "No event selected"}
              </span>
            </footer>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** "Mon 12 Oct, 09:00" in the event's own clock. */
function formatSlot(startsAt: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(startsAt))
  } catch {
    return new Date(startsAt).toLocaleString()
  }
}
