import { useEffect } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  RiArrowRightSLine,
  RiCalendarEventLine,
  RiCheckLine,
  RiListCheck3,
} from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { Tag, tagTone } from "@/components/shared/tag"
import { PanelCard } from "@/components/portal/panel-card"
import { DueChip } from "@/components/portal/due-chip"
import { usePortal } from "@/components/portal/portal-context"
import type { PortalHome } from "@/components/portal/portal-context"
import { formatEventDateTime } from "@/components/portal/portal-utils"
import { AllowanceMeter } from "@/components/sponsors/allowance-meter"

/**
 * `?open=` / `?add=` used to live on `/sponsor` (the sessions page, before it
 * moved to `/sponsor/sessions`). Invite emails and old links still carry them,
 * so the Overview forwards them instead of swallowing them.
 */
export const Route = createFileRoute("/sponsor/")({
  validateSearch: (search: Record<string, unknown>): { open?: string; add?: boolean } => ({
    open: typeof search.open === "string" ? search.open : undefined,
    add:
      search.add === true || search.add === 1 || search.add === "1" || search.add === "true"
        ? true
        : undefined,
  }),
  component: SponsorOverviewPage,
})

type Sponsor = NonNullable<PortalHome["sponsor"]>
type Needed = Sponsor["stillNeeded"][number]

/** Where each "still needed" item gets done. */
function NeededLink({ item, children }: { item: Needed; children: React.ReactNode }) {
  const className =
    "flex items-center gap-3 px-6 py-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
  if (item.key === "logo" || item.key === "description") {
    return (
      <Link to="/sponsor/company" className={className}>
        {children}
      </Link>
    )
  }
  if (item.key === "sessions") {
    return (
      <Link to="/sponsor/sessions" search={{ add: true }} className={className}>
        {children}
      </Link>
    )
  }
  return <div className={className}>{children}</div>
}

const NEEDED_HINT: Record<string, string> = {
  logo: "Shown on the event site and the stage screens",
  description: "One or two sentences for the sponsor wall",
  sessions: "Your package includes them — add title, description and speakers",
}

/**
 * Sponsor portal → Overview: the first question a sponsor has — "what do you
 * need from us, by when?" — answered before anything else, then where their
 * sessions stand. The list is the server's `stillNeeded`, the same one the
 * organizers read in their "Still needed" column, so the two can't disagree.
 */
function SponsorOverviewPage() {
  const { home } = usePortal()
  const navigate = useNavigate()
  const { open, add } = Route.useSearch()
  const sponsor = home.sponsor

  useEffect(() => {
    if (open === undefined && add === undefined) return
    void navigate({
      to: "/sponsor/sessions",
      search: { ...(open ? { open } : {}), ...(add ? { add: true } : {}) },
      replace: true,
    })
  }, [open, add, navigate])

  // The layout never renders this page without a sponsor (src/routes/sponsor/route.tsx).
  if (!sponsor) return null

  // Only the sponsor's own to-dos — invites and contacts are the organizers' job.
  const needed = sponsor.stillNeeded.filter((item) => item.owner === "sponsor")
  const sessions = sponsor.sessions

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <PanelCard
        icon={RiListCheck3}
        title="Still needed from you"
        count={needed.length}
        description={
          needed.length > 0
            ? "Anyone on your team can do these. Each one opens where it's done."
            : undefined
        }
        flush
        bodyClassName="gap-0"
      >
        {needed.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiCheckLine}
            title="You're all set"
            description="Nothing is waiting on you right now. If the organizers need anything else, it appears here — and in your inbox."
            className="px-6 py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {needed.map((item) => (
              <li key={item.key}>
                <NeededLink item={item}>
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded-full border border-dashed border-muted-foreground/50"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.key === "logo"
                        ? "Upload your logo"
                        : item.key === "description"
                          ? "Write your company description"
                          : item.key === "sessions"
                            ? `Add ${item.label.replace(/ to add$/, "")}`
                            : item.label}
                    </span>
                    {NEEDED_HINT[item.key] ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {NEEDED_HINT[item.key]}
                      </span>
                    ) : null}
                  </span>
                  <DueChip dueAt={item.dueAt} />
                  <RiArrowRightSLine size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                </NeededLink>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        icon={RiCalendarEventLine}
        title="Your sessions"
        count={sessions.length}
        action={
          <Link
            to="/sponsor/sessions"
            className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        }
        flush
        bodyClassName="gap-0"
      >
        <div className="flex flex-col gap-2 border-b border-border px-6 pb-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {sponsor.tier ? <Tag tone={tagTone(sponsor.tier)}>{sponsor.tier}</Tag> : null}
            <AllowanceMeter
              used={sponsor.sessionsUsed}
              limit={sponsor.sessionLimit}
              className="max-w-64 flex-1"
            />
          </div>
          {sponsor.addBlocker ? (
            <p className="text-xs text-muted-foreground">{sponsor.addBlocker}</p>
          ) : sponsor.closeAt ? (
            <p className="text-xs text-muted-foreground">
              Add and edit sessions until{" "}
              <span className="font-medium text-foreground">
                {formatEventDateTime(sponsor.closeAt, home.event.timezone)}
              </span>
              .
            </p>
          ) : null}
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiCalendarEventLine}
            title="No sessions yet"
            description={
              sponsor.addBlocker
                ? "Sessions the organizers add for your company will appear here."
                : "Add the sessions your package includes — the organizers review them and set the time and room."
            }
            action={
              sponsor.addBlocker ? undefined : (
                <Link to="/sponsor/sessions" search={{ add: true }} className={buttonVariants()}>
                  Add a session
                </Link>
              )
            }
            className="px-6 py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  to="/sponsor/sessions"
                  search={{ open: session.id }}
                  className="flex items-start gap-3 px-6 py-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {session.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {session.scheduled
                        ? [
                            formatEventDateTime(session.scheduled.startsAt, home.event.timezone),
                            session.scheduled.room,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "Time and room set by the organizers"}
                    </span>
                  </span>
                  <StatusPill status={session.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  )
}
