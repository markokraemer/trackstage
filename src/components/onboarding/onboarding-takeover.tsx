import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiArrowRightLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LabeledField } from "@/components/settings/labeled-field"
import { DateTimePicker } from "@/components/settings/date-time-picker"
import { EVENT_TYPES } from "@/components/settings/event-details-form"
import { TimezoneSelect } from "@/components/settings/timezone-select"
import { browserTimezone } from "@/components/settings/timezone"
import { isValidSlug, publicEventUrl, slugify } from "@/components/settings/slug"
import { authClient } from "@/lib/auth-client"
import {
  FRESH_SIGNUP_KEY,
  clearTourPhase,
  writeTourPhase,
} from "@/lib/onboarding-storage"
import { useSession } from "@/lib/session"
import { setCurrentEventId, useCurrentEvent } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"
import { errorMessage } from "@/lib/errors"

/**
 * First-run onboarding — a FULL-SCREEN takeover (Marko, 2026-08-12: "you
 * should not show me anything else while I'm in that state"). While a signed-in
 * organizer has never finished or skipped it AND owns zero events, every
 * `/app` address renders THIS instead of the shell: no sidebar, no top bar,
 * just the logo and one calm card per step.
 *
 * The flow (Marko, definitive boundary — verification is an AUTH concern
 * and lives on `/confirm-email`, NEVER in this wizard):
 *
 *   workspace name → YOUR EVENT (name + type + description) → WHEN & WHERE
 *   (dates, timezone, venue) → finish INTO the app: the new event's
 *   settings page with confetti + one welcome card
 *   (src/components/onboarding/dashboard-tour.tsx). The Getting-started
 *   checklist in the sidebar carries the guidance from there.
 *
 * An UNVERIFIED account never reaches this wizard at all: the gate below
 * sends it to `/confirm-email` (the auth surface) on any `/app` access, and
 * only the clicked link brings it back — verified, landing at step 1.
 * Exempt addresses (`@example.*` / `@demo.sessionboard.dev` — the
 * databaseHook in convex/auth.ts) are born verified, so the judge, e2e and
 * demo accounts go straight through; seeded accounts own events and never
 * meet the wizard either.
 *
 * Only the event NAME is required — every other field is optional with
 * honest defaults (timezone = browser, dates = blank, not fake), and the
 * same `events.create` mutation the settings page's fields map onto carries
 * whatever was filled straight into the event record. Skipping sets both
 * per-user flags (convex/onboarding.ts) — no wizard, no welcome, ever again.
 */

/** `?onboarding-redo` is consumed at most once per page load — a module
 *  flag, not a ref, so a remounting layout can never double-fire it. */
let redoConsumed = false

/** Mid-flow state, so a reload resumes where it left off. */
const RESUME_KEY = "ts-onboarding-state"

interface ResumeState {
  step?: number
  workspaceName?: string
  eventName?: string
  eventType?: string
  description?: string
  venue?: string
  timezone?: string
  startsAt?: number
  endsAt?: number
  createdSlug?: string
  createdEventId?: string
}

function readResume(): ResumeState {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? "{}") as ResumeState
  } catch {
    return {}
  }
}

function writeResume(state: ResumeState): void {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(state))
  } catch {
    /* private mode */
  }
}

function clearOnboardingStorage(): void {
  try {
    sessionStorage.removeItem(RESUME_KEY)
    sessionStorage.removeItem(FRESH_SIGNUP_KEY)
  } catch {
    /* private mode */
  }
}

export type OnboardingGate =
  | { state: "hide" }
  /** Queries still in flight, but the fresh-signup hint says it's coming —
   *  paint the takeover's frame, never a flash of the shell. Also held
   *  briefly while an unverified account is redirected to /confirm-email. */
  | { state: "pending" }
  | { state: "show"; finish: () => void }

/**
 * Whether the takeover owns the screen. Sticky once shown — creating the
 * event mid-flow makes `events` non-empty, and that must NOT yank the flow
 * away; only finishing or skipping releases it.
 *
 * Unverified accounts are not this surface's business: they are redirected
 * to `/confirm-email` — the AUTH surface — and come back verified.
 */
export function useOnboardingGate(): OnboardingGate {
  const { status } = useSession()
  const { events, isLoading: eventsLoading } = useCurrentEvent()
  const { data: flag } = useQuery(
    convexQuery(api.onboarding.status, status === "authenticated" ? {} : "skip"),
  )
  const { data: authData, isPending: authPending } = authClient.useSession()
  const resetOnboarding = useConvexMutation(api.onboarding.reset)
  const navigate = useNavigate()
  const [active, setActive] = useState<boolean | null>(null)
  const [hint] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(FRESH_SIGNUP_KEY) === "1",
  )

  const resolved = flag !== undefined && !eventsLoading

  // Verification is an AUTH concern: an unverified session gets the
  // /confirm-email page, not an in-app screen. Born-verified (exempt)
  // accounts can never trip this.
  const unverified = Boolean(
    !authPending && authData?.user && !authData.user.emailVerified,
  )
  useEffect(() => {
    if (!unverified) return
    void navigate({ to: "/confirm-email", replace: true })
  }, [unverified, navigate])

  useEffect(() => {
    if (active !== null || !resolved) return
    const needs = !flag.done && events.length === 0
    setActive(needs)
    if (!needs) clearOnboardingStorage()
  }, [active, resolved, flag, events])

  // `?onboarding-redo` on any /app URL — explicit opt-in to run the whole
  // experience again (Marko, 2026-08-12), demo accounts included: both
  // server flags reset, then straight into welcome (has events) or the full
  // wizard (zero events). Consumed once and stripped from the address, the
  // same pattern as the portal's `?t=` token. Read from `window.location` —
  // the routes' validateSearch re-stringifies the search and quietly drops
  // keys it doesn't declare.
  const routerLocation = useRouterState({ select: (s) => s.location.href })
  useEffect(() => {
    void routerLocation // re-check on every navigation
    if (redoConsumed || typeof window === "undefined") return
    if (!new URLSearchParams(window.location.search).has("onboarding-redo")) {
      return
    }
    if (status !== "authenticated" || eventsLoading) return
    redoConsumed = true
    void resetOnboarding({}).catch(() => {})
    clearOnboardingStorage()
    clearTourPhase()
    if (events.length > 0) {
      setActive(false)
      writeTourPhase("welcome")
    } else {
      try {
        sessionStorage.setItem(FRESH_SIGNUP_KEY, "1")
      } catch {
        /* private mode */
      }
      setActive(true)
    }
    // Strip THROUGH the router (raw history.replaceState desyncs TanStack's
    // patched history and the two fight over the address).
    const url = new URL(window.location.href)
    url.searchParams.delete("onboarding-redo")
    void navigate({
      href: url.pathname + url.search + url.hash,
      replace: true,
    })
  }, [routerLocation, status, eventsLoading, events, resetOnboarding, navigate])

  const finish = useCallback(() => {
    clearOnboardingStorage()
    setActive(false)
  }, [])

  if (unverified) return { state: "pending" }
  if (active === true) return { state: "show", finish }
  if (active === null && hint && status !== "unauthenticated") {
    return { state: "pending" }
  }
  return { state: "hide" }
}

// Three steps: name the team's home, describe the event, place it in time.
const STEP_WORKSPACE = 0
const STEP_EVENT = 1
const STEP_WHEN = 2
const TOTAL_STEPS = 3

const DESCRIPTION_LIMIT = 1000

export function OnboardingTakeover({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const { workspace, workspaces } = useCurrentEvent()

  const renameWorkspace = useMutation({
    mutationFn: useConvexMutation(api.workspaces.update),
  })
  const createEvent = useMutation({
    mutationFn: useConvexMutation(api.events.create),
  })
  const markDone = useConvexMutation(api.onboarding.markDone)

  const resume = useRef(readResume()).current
  const [step, setStep] = useState(
    // Clamp: a resume state written by an older, longer flow must not strand
    // the person past the last screen.
    Math.min(resume.step ?? STEP_WORKSPACE, TOTAL_STEPS - 1),
  )
  const [workspaceName, setWorkspaceName] = useState(resume.workspaceName ?? "")
  const [eventName, setEventName] = useState(resume.eventName ?? "")
  const [eventType, setEventType] = useState(resume.eventType ?? "")
  const [description, setDescription] = useState(resume.description ?? "")
  const [venue, setVenue] = useState(resume.venue ?? "")
  const [timezone, setTimezone] = useState(resume.timezone ?? browserTimezone())
  const [startsAt, setStartsAt] = useState<number | undefined>(resume.startsAt)
  const [endsAt, setEndsAt] = useState<number | undefined>(resume.endsAt)
  const [created, setCreated] = useState<{ slug: string; eventId: string } | null>(
    resume.createdSlug && resume.createdEventId
      ? { slug: resume.createdSlug, eventId: resume.createdEventId }
      : null,
  )
  const [error, setError] = useState<string | undefined>()
  const [dateError, setDateError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  // Prefill the workspace name once the auto-created workspace resolves.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !workspace?.name) return
    prefilled.current = true
    setWorkspaceName((current) => current || workspace.name)
  }, [workspace?.name])

  useEffect(() => {
    writeResume({
      step,
      workspaceName,
      eventName,
      eventType,
      description,
      venue,
      timezone,
      startsAt,
      endsAt,
      createdSlug: created?.slug,
      createdEventId: created?.eventId,
    })
  }, [
    step,
    workspaceName,
    eventName,
    eventType,
    description,
    venue,
    timezone,
    startsAt,
    endsAt,
    created,
  ])

  const workspaceId = workspace?.id ?? workspaces.at(0)?.id
  // The rename below may re-slug the workspace; the mutation's answer beats
  // the reactive query by a beat, so keep the freshest slug locally too.
  const [liveSlug, setLiveSlug] = useState<string | null>(null)
  const workspaceSlug =
    liveSlug ?? workspace?.slug ?? workspaces.at(0)?.slug ?? ""

  // ——— Step actions ———————————————————————————————————————————————————————
  /** Into the app: the new event's settings page, welcome moment armed. */
  const finishIntoTour = useCallback(
    (slug: string) => {
      void markDone({}).catch(() => {})
      // The ONE place the welcome moment is ever armed.
      writeTourPhase("welcome")
      onDone()
      if (workspaceSlug) {
        void navigate({
          href: appLink.settings({ workspaceSlug, eventSlug: slug }),
        })
      }
    },
    [markDone, onDone, navigate, workspaceSlug],
  )

  /** Every step skipped, no event named: finish anyway — the flag sets, the
   *  welcome card shows, and the empty-state app + checklist take it from
   *  there. The wizard never re-shows either way. */
  const finishWithoutEvent = useCallback(() => {
    void markDone({}).catch(() => {})
    writeTourPhase("welcome")
    onDone()
  }, [markDone, onDone])

  /** "Skip" advances ONE step — never exits the wizard (Marko, 2026-08-12:
   *  "it should skip this particular step", not close the whole thing). */
  function skipStep() {
    setError(undefined)
    setDateError(undefined)
    if (step === STEP_WORKSPACE) {
      setStep(STEP_EVENT)
    } else if (step === STEP_EVENT) {
      setStep(STEP_WHEN)
    } else if (created) {
      finishIntoTour(created.slug)
    } else {
      finishWithoutEvent()
    }
  }

  function continueFromWorkspace() {
    const name = workspaceName.trim()
    if (!name) {
      setError("Give your workspace a name.")
      return
    }
    setError(undefined)
    setStep(STEP_EVENT)
    // Rename in the background — a hiccup here must not gate the flow.
    if (workspace && name !== workspace.name) {
      // The auto-created workspace's slug was minted from the signup name
      // ("Nora Feldmann's workspace" → /e/nora-feldmann-s-workspace-…). If
      // it is still that auto-minted shape — the user never chose an address
      // of their own — re-slug from the NEW name, so every public URL from
      // here on reads /e/devcon-events/… instead of fossilizing the signup
      // default. A customized address is never touched. Uniqueness-adjust
      // happens server-side (workspaces.update → uniqueWorkspaceSlug), and
      // the answer carries the address that is actually live.
      const mintedBase = slugify(workspace.name)
      const autoMinted =
        workspace.slug === mintedBase ||
        workspace.slug.startsWith(`${mintedBase}-`)
      renameWorkspace
        .mutateAsync({
          organizationId: workspace.id,
          patch: {
            name,
            ...(autoMinted && slugify(name) ? { slug: slugify(name) } : {}),
          },
        })
        .then((result) => setLiveSlug(result.slug))
        .catch(() => {})
    }
  }

  /** "Your event" → "When & where". Name is the ONLY required field. */
  function continueFromEvent() {
    if (created) {
      setStep(STEP_WHEN)
      return
    }
    if (!eventName.trim()) {
      setError("Give your event a name.")
      return
    }
    const cleanSlug = slugify(eventName)
    if (!cleanSlug || !isValidSlug(cleanSlug)) {
      setError("Use letters and numbers in the name — the web address is made from it.")
      return
    }
    setError(undefined)
    setStep(STEP_WHEN)
  }

  /** "When & where" → create the event with everything collected so far. */
  async function createFirstEvent() {
    if (created) {
      // Back-and-forth after a successful create must not create twice.
      finishIntoTour(created.slug)
      return
    }
    if (!eventName.trim()) {
      // They skipped naming an event — nothing to create; finish clean.
      finishWithoutEvent()
      return
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setDateError("The end has to come after the start.")
      return
    }
    setDateError(undefined)
    if (!workspaceId) {
      toast.error("Your workspace is still being set up — reload and try again.")
      return
    }
    setBusy(true)
    try {
      const result = await createEvent.mutateAsync({
        organizationId: workspaceId,
        name: eventName.trim(),
        slug: slugify(eventName),
        timezone,
        // Optional fields travel only when filled — blank stays blank.
        type: eventType || undefined,
        description: description.trim() || undefined,
        venue: venue.trim() || undefined,
        startsAt,
        endsAt,
      })
      setCurrentEventId(result.eventId, workspaceId)
      setCreated({ slug: result.slug, eventId: result.eventId })
      finishIntoTour(result.slug)
    } catch (caught) {
      // Name problems belong to the previous card — send the person there.
      const message = errorMessage(caught, "Couldn't create that event.")
      if (/name|slug|address/i.test(message)) {
        setError(message)
        setStep(STEP_EVENT)
      } else {
        setDateError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const publicPreview =
    eventName.trim() && workspaceSlug
      ? publicEventUrl(workspaceSlug, slugify(eventName))
      : null

  return (
    <div className="animate-in fade-in-0 flex min-h-svh flex-col bg-background duration-300">
      <header className="container-app flex h-14 shrink-0 items-center">
        <Logo size="sm" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-lg flex-col gap-5">
          {/* Progress — quiet dots, one per screen. */}
          <ol
            aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}
            className="flex items-center justify-center gap-1.5"
          >
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <li
                key={index}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  index === step ? "w-6 bg-primary" : "w-1.5",
                  index < step
                    ? "bg-primary/50"
                    : index > step
                      ? "bg-border"
                      : "",
                )}
              />
            ))}
          </ol>

          <Card>
            <CardContent className="px-6 py-8 sm:px-10">
              {/* Keyed so each step swaps in place with one quick fade/slide
                  — fade FROM 50%, not 0: starting fully transparent painted
                  a blank card for the animation's first frames (the jank in
                  Marko's screenshots). */}
              <div
                key={`step-${step}`}
                className="animate-in fade-in-50 slide-in-from-right-2 flex flex-col gap-6 duration-200"
              >
                {step === STEP_WORKSPACE ? (
                  <>
                    <StepHeading
                      title="Welcome to Trackstage"
                      detail="Your call for speakers, end to end — collect proposals, decide together, build the agenda. First, name your workspace: your team's home."
                    />
                    <LabeledField
                      label="Workspace name"
                      htmlFor="onboarding-workspace-name"
                      error={error}
                      description="Usually your company or team. You can rename it any time."
                    >
                      <Input
                        id="onboarding-workspace-name"
                        value={workspaceName}
                        autoComplete="organization"
                        placeholder="Acme Events"
                        autoFocus
                        aria-invalid={error ? true : undefined}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") continueFromWorkspace()
                        }}
                      />
                    </LabeledField>
                    <StepFooter onSkip={skipStep}>
                      <Button type="button" onClick={continueFromWorkspace}>
                        Continue
                        <RiArrowRightLine size={16} aria-hidden />
                      </Button>
                    </StepFooter>
                  </>
                ) : null}

                {step === STEP_EVENT ? (
                  <>
                    <StepHeading
                      title="Your event"
                      detail="One conference, summit or meetup. Only the name is needed now — everything here can be changed later in Settings."
                    />
                    <LabeledField
                      label="Event name"
                      htmlFor="onboarding-event-name"
                      required
                      error={error}
                      footer={
                        publicPreview ? (
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {publicPreview}
                          </code>
                        ) : null
                      }
                    >
                      <Input
                        id="onboarding-event-name"
                        value={eventName}
                        autoComplete="off"
                        placeholder="AI Engineer Summit 2027"
                        autoFocus
                        aria-invalid={error ? true : undefined}
                        onChange={(e) => setEventName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") continueFromEvent()
                        }}
                      />
                    </LabeledField>
                    <LabeledField
                      label="Event type"
                      htmlFor="onboarding-event-type"
                      description="Optional — helps your team see the shape of the event at a glance."
                    >
                      <Select
                        value={eventType || undefined}
                        onValueChange={(value) => setEventType(String(value))}
                      >
                        <SelectTrigger
                          id="onboarding-event-type"
                          className="h-9 w-full"
                        >
                          <SelectValue placeholder="Pick a type (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </LabeledField>
                    <LabeledField
                      label="Description"
                      htmlFor="onboarding-event-description"
                      description="Optional — one or two sentences speakers will see on the public page."
                    >
                      <Textarea
                        id="onboarding-event-description"
                        value={description}
                        rows={3}
                        maxLength={DESCRIPTION_LIMIT}
                        placeholder="Two days of talks on production AI engineering."
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </LabeledField>
                    <StepFooter onSkip={skipStep}>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setStep(STEP_WORKSPACE)}
                        >
                          Back
                        </Button>
                        <Button type="button" onClick={continueFromEvent}>
                          Continue
                          <RiArrowRightLine size={16} aria-hidden />
                        </Button>
                      </div>
                    </StepFooter>
                  </>
                ) : null}

                {step === STEP_WHEN ? (
                  <>
                    <StepHeading
                      title="When & where"
                      detail="All optional — fill in what you know, leave the rest blank. Dates and deadlines everywhere will follow this timezone."
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <LabeledField label="Starts" htmlFor="onboarding-starts">
                        <DateTimePicker
                          id="onboarding-starts"
                          value={startsAt}
                          onChange={(value) => {
                            setStartsAt(value)
                            setDateError(undefined)
                          }}
                          timezone={timezone}
                          placeholder="Pick a date (optional)"
                          defaultTime="09:00"
                        />
                      </LabeledField>
                      <LabeledField
                        label="Ends"
                        htmlFor="onboarding-ends"
                        error={dateError}
                      >
                        <DateTimePicker
                          id="onboarding-ends"
                          value={endsAt}
                          onChange={(value) => {
                            setEndsAt(value)
                            setDateError(undefined)
                          }}
                          timezone={timezone}
                          placeholder="Pick a date (optional)"
                          defaultTime="18:00"
                          invalid={Boolean(dateError)}
                        />
                      </LabeledField>
                    </div>
                    <LabeledField
                      label="Timezone"
                      htmlFor="onboarding-timezone"
                      description="We guessed from your browser — change it if the event runs elsewhere."
                    >
                      <TimezoneSelect
                        id="onboarding-timezone"
                        value={timezone}
                        onValueChange={setTimezone}
                      />
                    </LabeledField>
                    <LabeledField
                      label="Venue or city"
                      htmlFor="onboarding-venue"
                      description="Optional — shown to speakers, and on calendar invites when rooms are known."
                    >
                      <Input
                        id="onboarding-venue"
                        value={venue}
                        autoComplete="off"
                        placeholder="Moscone Center, San Francisco"
                        onChange={(e) => setVenue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void createFirstEvent()
                        }}
                      />
                    </LabeledField>
                    <StepFooter onSkip={skipStep}>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setStep(STEP_EVENT)}
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={createFirstEvent}
                        >
                          {busy
                            ? "Creating…"
                            : eventName.trim() || created
                              ? "Create event"
                              : "Finish"}
                          {busy ? null : (
                            <RiArrowRightLine size={16} aria-hidden />
                          )}
                        </Button>
                      </div>
                    </StepFooter>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

/** The takeover's frame with nothing in it yet — shown for the beat between
 *  a fresh signup's redirect and its queries resolving, so the first thing a
 *  new organizer ever sees is this screen, not a flash of the app shell. */
export function OnboardingTakeoverPending() {
  return (
    <div aria-busy="true" className="flex min-h-svh flex-col bg-background">
      <header className="container-app flex h-14 shrink-0 items-center">
        <Logo size="sm" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <p className="sr-only">Loading…</p>
      </main>
    </div>
  )
}

function StepHeading({
  title,
  detail,
}: {
  title: React.ReactNode
  detail: React.ReactNode
}) {
  return (
    <div className="text-center">
      <h1 className="font-heading text-xl font-semibold text-foreground">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

function StepFooter({
  onSkip,
  children,
}: {
  onSkip: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <button
        type="button"
        onClick={onSkip}
        className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Skip
      </button>
      {children}
    </div>
  )
}
