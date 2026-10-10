import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { RiAddLine, RiCalendarEventLine, RiInformationLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Tag, tagTone } from "@/components/shared/tag"
import { PanelCard } from "@/components/portal/panel-card"
import { SubmissionCard } from "@/components/portal/submission-card"
import { usePortal } from "@/components/portal/portal-context"
import {
  AddSponsorSessionDrawer,
  ManageSponsorSessionDrawer,
} from "@/components/portal/sponsor-session-drawer"
import { AllowanceMeter } from "@/components/sponsors/allowance-meter"
import { formatEventDateTime } from "@/components/portal/portal-utils"

export const Route = createFileRoute("/sponsor/sessions")({
  validateSearch: (search: Record<string, unknown>): { open?: string; add?: boolean } => ({
    open: typeof search.open === "string" ? search.open : undefined,
    add: search.add === true || search.add === 1 || search.add === "1" || search.add === "true" ? true : undefined,
  }),
  component: PortalSponsorPage,
})

/**
 * Sponsor portal → Sessions, the portal's home (Kelsey's ask): a sponsor contact adds the sessions
 * their package includes — no call for papers — names who presents, and
 * keeps them current until the organizers' sponsor deadline. Same card
 * recipe as the portal's Home (a flush PanelCard with hairline rows), so a
 * contact who also speaks is never relearning a layout. Opening a session or
 * the add form is a real URL (`?open=`, `?add=1`).
 */
function PortalSponsorPage() {
  const { home } = usePortal()
  const navigate = useNavigate()
  const { open, add } = Route.useSearch()
  const sponsor = home.sponsor

  // The layout never renders this page without a sponsor (src/routes/sponsor/route.tsx).
  if (!sponsor) return null

  const total = sponsor.sessions.length
  const active = sponsor.sessions.find((s) => s.id === open) ?? null
  const setSearch = (next: { open?: string; add?: boolean }) =>
    void navigate({ to: "/sponsor/sessions", search: next, replace: true })

  return (
    <div className="flex flex-col gap-4">
      <PanelCard
        icon={RiCalendarEventLine}
        title="Sessions"
        count={total}
        action={
          sponsor.addBlocker ? null : (
            <Button size="sm" onClick={() => setSearch({ add: true })}>
              <RiAddLine aria-hidden />
              Add a session
            </Button>
          )
        }
        flush
        bodyClassName="gap-0"
      >
        {/* The package, in one line: tier, how much of it is used, and the
            deadline or the reason nothing more can be added. */}
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
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <RiInformationLine size={14} aria-hidden className="mt-px shrink-0" />
              {sponsor.addBlocker}
            </p>
          ) : sponsor.closeAt ? (
            <p className="text-xs text-muted-foreground">
              You can add and edit sessions until{" "}
              <span className="font-medium text-foreground">
                {formatEventDateTime(sponsor.closeAt, home.event.timezone)}
              </span>
              .
            </p>
          ) : null}
        </div>

        {total === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiCalendarEventLine}
            title="No sessions yet"
            description={
              sponsor.addBlocker
                ? "Sessions the organizers add for your company will appear here."
                : `Add the session${sponsor.sessionLimit === 1 ? "" : "s"} your package includes — title, description and who's presenting. You can keep editing until the organizers close sponsor sessions.`
            }
            action={
              sponsor.addBlocker ? undefined : (
                <Button onClick={() => setSearch({ add: true })}>
                  <RiAddLine aria-hidden />
                  Add a session
                </Button>
              )
            }
            className="px-6 py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {sponsor.sessions.map((session, index) => (
              <li key={session.id}>
                <SubmissionCard
                  submission={session}
                  code={`SPON-${total - index}`}
                  bare
                  showSchedule
                  action={
                    <Button variant="outline" size="sm" onClick={() => setSearch({ open: session.id })}>
                      {session.editLock ? "View details" : "Manage"}
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <AddSponsorSessionDrawer
        open={add === true && !sponsor.addBlocker}
        onOpenChange={(next) => {
          if (!next) setSearch({})
        }}
      />
      {active ? (
        <ManageSponsorSessionDrawer
          key={active.id}
          session={active}
          open
          onOpenChange={(next) => {
            if (!next) setSearch({})
          }}
        />
      ) : null}
    </div>
  )
}

