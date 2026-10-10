import * as React from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiAddLine,
  RiBuilding2Line,
  RiCalendarEventLine,
  RiInformationLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { errorMessage } from "@/lib/errors"

export const Route = createFileRoute("/portal/sponsor")({
  validateSearch: (search: Record<string, unknown>): { open?: string; add?: boolean } => ({
    open: typeof search.open === "string" ? search.open : undefined,
    add: search.add === true || search.add === "1" || search.add === "true" ? true : undefined,
  }),
  component: PortalSponsorPage,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The sponsor portal (Kelsey's ask): a sponsor contact adds the sessions
 * their package includes — no call for papers — names who presents, and
 * keeps them current until the organizers' sponsor deadline. Opening a
 * session or the add form is a real URL (`?open=`, `?add=1`), so links from
 * Home, the invite email and the back button all land in the right place.
 */
function PortalSponsorPage() {
  const { home } = usePortal()
  const navigate = useNavigate()
  const { open, add } = Route.useSearch()
  const sponsor = home.sponsor

  if (!sponsor) {
    return (
      <EmptyState
        icon={RiBuilding2Line}
        title="You're not a sponsor contact"
        description="This tab is for the people managing a sponsor's sessions. If that should be you, email the organizers and they'll add you."
        action={
          <Link to="/portal" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        }
      />
    )
  }

  const active = sponsor.sessions.find((s) => s.id === open) ?? null
  const setSearch = (next: { open?: string; add?: boolean }) =>
    void navigate({ to: "/portal/sponsor", search: next, replace: true })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <PanelCard
          icon={RiCalendarEventLine}
          title={`${sponsor.name} sessions`}
          count={sponsor.sessions.length}
          action={
            sponsor.addBlocker ? null : (
              <Button size="sm" onClick={() => setSearch({ add: true })}>
                <RiAddLine aria-hidden />
                Add a session
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {sponsor.tier ? <Tag tone={tagTone(sponsor.tier)}>{sponsor.tier}</Tag> : null}
              <AllowanceMeter
                used={sponsor.sessionsUsed}
                limit={sponsor.sessionLimit}
                className="max-w-xs flex-1"
              />
            </div>
            {sponsor.closeAt && !sponsor.addBlocker ? (
              <p className="text-xs text-muted-foreground">
                You can add and edit sessions until{" "}
                <span className="font-medium text-foreground">
                  {formatEventDateTime(sponsor.closeAt, home.event.timezone)}
                </span>
                .
              </p>
            ) : null}
            {sponsor.addBlocker ? (
              <Alert>
                <RiInformationLine aria-hidden />
                <AlertDescription>{sponsor.addBlocker}</AlertDescription>
              </Alert>
            ) : null}

            {sponsor.sessions.length === 0 ? (
              <EmptyState
                variant="plain"
                icon={RiCalendarEventLine}
                title="No sessions yet"
                description={
                  sponsor.addBlocker
                    ? "Sessions the organizers add for your company will appear here."
                    : `Add the session${sponsor.sessionLimit === 1 ? "" : "s"} your package includes. You can keep editing until the organizers close sponsor sessions.`
                }
                action={
                  sponsor.addBlocker ? undefined : (
                    <Button onClick={() => setSearch({ add: true })}>
                      <RiAddLine aria-hidden />
                      Add a session
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid gap-3">
                {sponsor.sessions.map((session, index) => (
                  <SubmissionCard
                    key={session.id}
                    submission={session}
                    code={`SPON-${sponsor.sessions.length - index}`}
                    detailed
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearch({ open: session.id })}
                      >
                        {session.editLock ? "View" : "Manage"}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </PanelCard>

        <ColleaguesCard />
      </div>

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

/** Everyone who can manage this sponsor's sessions — and a way to add one. */
function ColleaguesCard() {
  const { home, portalToken } = usePortal()
  const sponsor = home.sponsor
  const addColleague = useConvexMutation(api.portal.addSponsorColleague)
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "" })
  const [saving, setSaving] = React.useState(false)
  if (!sponsor) return null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.firstName.trim() || !EMAIL_PATTERN.test(form.email.trim())) {
      toast.error("Add their first name and a valid email")
      return
    }
    setSaving(true)
    try {
      await addColleague({
        portalToken,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      })
      toast.success(`${form.firstName.trim()} has been invited`, {
        description: "They'll get an email with their own sign-in link.",
      })
      setForm({ firstName: "", lastName: "", email: "" })
    } catch (error) {
      toast.error("Couldn't add your colleague", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelCard
      icon={RiTeamLine}
      title="Your team"
      count={sponsor.contacts.length}
      description={`Everyone here can add and edit ${sponsor.name}'s sessions.`}
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {sponsor.contacts.map((contact) => (
            <li key={contact.id} className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {contact.name}
                {contact.isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
            </li>
          ))}
        </ul>
        {sponsor.canInviteColleagues ? (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 border-t pt-4">
            <p className="text-sm font-medium text-foreground">Add a colleague</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="colleague-first">First name</FieldLabel>
                <Input
                  id="colleague-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="colleague-last">Last name</FieldLabel>
                <Input
                  id="colleague-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="colleague-email">Work email</FieldLabel>
              <Input
                id="colleague-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@company.com"
              />
            </Field>
            <div>
              <Button type="submit" size="sm" variant="outline" disabled={saving}>
                <RiUserAddLine aria-hidden />
                {saving ? "Inviting…" : "Invite colleague"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Need someone else to have access? Email the organizers and they'll add them.
          </p>
        )}
      </div>
    </PanelCard>
  )
}
