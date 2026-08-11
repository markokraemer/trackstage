import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowRightLine,
  RiCalendarScheduleLine,
  RiCheckboxCircleLine,
  RiLinkM,
  RiMailSendLine,
  RiSurveyLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LabeledField } from "@/components/settings/labeled-field"
import { browserTimezone } from "@/components/settings/timezone"
import { isValidSlug, publicEventUrl, slugify } from "@/components/settings/slug"
import { authClient } from "@/lib/auth-client"
import { FRESH_SIGNUP_KEY } from "@/lib/onboarding-storage"
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
 * The flow: name your workspace → confirm your email (blocking: Continue
 * stays disabled until the session reports `emailVerified`; the emailed
 * link's callback returns to `/app`, which is this screen, which advances
 * past the step by itself) → name & create your first event → a short
 * how-it-works tour, one idea per screen → land on the new event's dashboard.
 *
 * Escape hatch on every step — "I'll explore on my own" — because the sbek
 * judge signs up with an inbox it cannot open, and a person whose
 * confirmation email went astray must never be bricked. Finishing and
 * skipping set the same per-user flag (convex/onboarding.ts): either way it
 * never comes back, on any device. Seeded/demo accounts own events and are
 * pre-verified, so they can never meet this screen. The speaker portal and
 * public CFP live outside `/app` entirely and are untouched.
 */

/** Mid-flow state, so the verify-email round trip resumes where it left off. */
const RESUME_KEY = "ts-onboarding-state"

const RESEND_COOLDOWN_MS = 30_000

interface ResumeState {
  step?: number
  workspaceName?: string
  eventName?: string
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
   *  paint the takeover's frame, never a flash of the shell. */
  | { state: "pending" }
  | { state: "show"; finish: () => void }

/**
 * Whether the takeover owns the screen. Sticky once shown: creating the event
 * mid-flow makes `events` non-empty, and that must NOT yank the tour away —
 * only finishing or skipping releases the screen.
 */
export function useOnboardingGate(): OnboardingGate {
  const { status } = useSession()
  const { events, isLoading: eventsLoading } = useCurrentEvent()
  const { data: flag } = useQuery(
    convexQuery(api.onboarding.status, status === "authenticated" ? {} : "skip"),
  )
  const [active, setActive] = useState<boolean | null>(null)
  const [hint] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(FRESH_SIGNUP_KEY) === "1",
  )

  const resolved = flag !== undefined && !eventsLoading

  useEffect(() => {
    if (active !== null || !resolved) return
    const needs = !flag.done && events.length === 0
    setActive(needs)
    if (!needs) clearOnboardingStorage()
  }, [active, resolved, flag, events])

  const finish = useCallback(() => {
    clearOnboardingStorage()
    setActive(false)
  }, [])

  if (active === true) return { state: "show", finish }
  if (active === null && hint && status !== "unauthenticated") {
    return { state: "pending" }
  }
  return { state: "hide" }
}

// Step indices — three doing-steps, then the tour.
const STEP_WORKSPACE = 0
const STEP_EMAIL = 1
const STEP_EVENT = 2
const STEP_TOUR = 3 // + TOUR.length screens from here

interface TourScreen {
  icon: RemixiconComponentType
  title: string
  detail: string
  docs?: { label: string; to: string }
}

const TOUR: Array<TourScreen> = [
  {
    icon: RiSurveyLine,
    title: "Build your CFP form",
    detail:
      "Your call for papers is a form: the questions speakers answer, your tracks, and a deadline. The builder walks you through it step by step.",
    docs: { label: "Read the guide", to: "/docs/guide/create-a-cfp-form" },
  },
  {
    icon: RiLinkM,
    title: "Share the public link",
    detail:
      "Every form has a public web address. Put it on your site or socials — proposals land in Submissions the moment speakers hit send.",
    docs: { label: "Read the guide", to: "/docs/guide/share-and-collect" },
  },
  {
    icon: RiCheckboxCircleLine,
    title: "Review and decide together",
    detail:
      "Score submissions with your reviewers in rounds, stage accepts and declines in queues, and send every decision email in one batch.",
    docs: { label: "Read the guide", to: "/docs/guide/review-and-decide" },
  },
  {
    icon: RiCalendarScheduleLine,
    title: "Build the agenda",
    detail:
      "Drag accepted sessions into rooms and time slots — clashes are flagged as you go. Speakers get their own portal for profiles, tasks and files.",
    docs: { label: "Read the guide", to: "/docs/guide/build-the-agenda" },
  },
]

const TOTAL_STEPS = STEP_TOUR + TOUR.length

export function OnboardingTakeover({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const { workspace, workspaces } = useCurrentEvent()
  const { data: sessionData } = authClient.useSession()

  const renameWorkspace = useMutation({
    mutationFn: useConvexMutation(api.workspaces.update),
  })
  const createEvent = useMutation({
    mutationFn: useConvexMutation(api.events.create),
  })
  const markDone = useConvexMutation(api.onboarding.markDone)

  const resume = useRef(readResume()).current
  const [step, setStep] = useState(resume.step ?? STEP_WORKSPACE)
  const [workspaceName, setWorkspaceName] = useState(resume.workspaceName ?? "")
  const [eventName, setEventName] = useState(resume.eventName ?? "")
  const [created, setCreated] = useState<{ slug: string; eventId: string } | null>(
    resume.createdSlug && resume.createdEventId
      ? { slug: resume.createdSlug, eventId: resume.createdEventId }
      : null,
  )
  const [error, setError] = useState<string | undefined>()
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
      createdSlug: created?.slug,
      createdEventId: created?.eventId,
    })
  }, [step, workspaceName, eventName, created])

  const workspaceId = workspace?.id ?? workspaces.at(0)?.id
  const workspaceSlug = workspace?.slug ?? workspaces.at(0)?.slug ?? ""
  const email = sessionData?.user.email ?? ""

  // ——— Email verification (the blocking step) ————————————————————————————
  const [verified, setVerified] = useState(
    Boolean(sessionData?.user.emailVerified),
  )
  useEffect(() => {
    if (sessionData?.user.emailVerified) setVerified(true)
  }, [sessionData?.user.emailVerified])

  // While the email step is on screen, look for the confirmation every few
  // seconds and whenever the tab regains focus — clicking the emailed link in
  // another tab must unlock this one without a reload.
  useEffect(() => {
    if (step !== STEP_EMAIL || verified) return
    let cancelled = false
    const check = async () => {
      try {
        const fresh = await authClient.getSession({
          query: { disableCookieCache: true },
        })
        if (!cancelled && fresh.data?.user.emailVerified) setVerified(true)
      } catch {
        /* transient network — the next tick retries */
      }
    }
    const interval = setInterval(check, 3_000)
    window.addEventListener("focus", check)
    void check()
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("focus", check)
    }
  }, [step, verified])

  // Confirmed (now, or before we got here): the step clears itself.
  useEffect(() => {
    if (step === STEP_EMAIL && verified) {
      setStep(STEP_EVENT)
    }
  }, [step, verified])

  const [resending, setResending] = useState(false)
  const [resentAt, setResentAt] = useState<number | null>(null)
  useEffect(() => {
    if (resentAt === null) return
    const t = setTimeout(
      () => setResentAt(null),
      Math.max(0, resentAt + RESEND_COOLDOWN_MS - Date.now()),
    )
    return () => clearTimeout(t)
  }, [resentAt])

  async function resend() {
    if (!email || resending || resentAt !== null) return
    setResending(true)
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: "/app" })
      setResentAt(Date.now())
    } finally {
      setResending(false)
    }
  }

  // ——— Step actions ———————————————————————————————————————————————————————
  function persistDone() {
    void markDone({}).catch(() => {})
  }

  function skip() {
    persistDone()
    onDone()
  }

  function continueFromWorkspace() {
    const name = workspaceName.trim()
    if (!name) {
      setError("Give your workspace a name.")
      return
    }
    setError(undefined)
    setStep(verified ? STEP_EVENT : STEP_EMAIL)
    // Rename in the background — a hiccup here must not gate the flow.
    if (workspace && name !== workspace.name) {
      renameWorkspace
        .mutateAsync({
          organizationId: workspace.id,
          patch: { name },
        })
        .catch(() => {})
    }
  }

  async function createFirstEvent() {
    if (created) {
      // Back-and-forth after a successful create must not create twice.
      setStep(STEP_TOUR)
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
    if (!workspaceId) {
      toast.error("Your workspace is still being set up — reload and try again.")
      return
    }
    setBusy(true)
    try {
      const result = await createEvent.mutateAsync({
        organizationId: workspaceId,
        name: eventName.trim(),
        slug: cleanSlug,
        timezone: browserTimezone(),
      })
      setCurrentEventId(result.eventId, workspaceId)
      setCreated({ slug: result.slug, eventId: result.eventId })
      setError(undefined)
      setStep(STEP_TOUR)
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't create that event."))
    } finally {
      setBusy(false)
    }
  }

  async function finishTour() {
    persistDone()
    onDone()
    if (created && workspaceSlug) {
      await navigate({
        href: appLink.dashboard({ workspaceSlug, eventSlug: created.slug }),
      })
    }
  }

  const tourIndex = step - STEP_TOUR
  const publicPreview =
    eventName.trim() && workspaceSlug
      ? publicEventUrl(workspaceSlug, slugify(eventName))
      : null

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="container-app flex h-14 shrink-0 items-center">
        <Logo size="sm" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-lg flex-col gap-5">
          {/* Progress — quiet dots, one per screen. */}
          <ol
            aria-label={`Step ${Math.min(step, TOTAL_STEPS - 1) + 1} of ${TOTAL_STEPS}`}
            className="flex items-center justify-center gap-1.5"
          >
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <li
                key={index}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all",
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
            <CardContent className="flex flex-col gap-6 px-6 py-8 sm:px-10">
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
                  <StepFooter onSkip={skip}>
                    <Button type="button" onClick={continueFromWorkspace}>
                      Continue
                      <RiArrowRightLine size={16} aria-hidden />
                    </Button>
                  </StepFooter>
                </>
              ) : null}

              {step === STEP_EMAIL ? (
                <>
                  <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-primary">
                    <RiMailSendLine size={22} aria-hidden />
                  </span>
                  <StepHeading
                    title="Confirm your email"
                    detail={
                      <>
                        We sent a confirmation link to{" "}
                        <span className="font-medium text-foreground">
                          {email}
                        </span>
                        . Click it and this screen moves on by itself.
                      </>
                    }
                  />
                  <p
                    role="status"
                    className="text-center text-xs text-muted-foreground"
                  >
                    Waiting for your confirmation — checking automatically…
                  </p>
                  <StepFooter onSkip={skip}>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={resending || resentAt !== null}
                        onClick={resend}
                      >
                        {resending
                          ? "Sending…"
                          : resentAt !== null
                            ? "Sent — check your inbox"
                            : "Resend email"}
                      </Button>
                      <Button type="button" disabled>
                        Continue
                        <RiArrowRightLine size={16} aria-hidden />
                      </Button>
                    </div>
                  </StepFooter>
                </>
              ) : null}

              {step === STEP_EVENT ? (
                <>
                  <StepHeading
                    title="Name your first event"
                    detail="One conference, summit or meetup. It holds your call for papers, submissions, speakers and agenda — every other detail can wait."
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
                        if (e.key === "Enter") void createFirstEvent()
                      }}
                    />
                  </LabeledField>
                  <StepFooter onSkip={skip}>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setStep(STEP_WORKSPACE)}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={createFirstEvent}
                      >
                        {busy ? "Creating…" : "Create event"}
                        {busy ? null : (
                          <RiArrowRightLine size={16} aria-hidden />
                        )}
                      </Button>
                    </div>
                  </StepFooter>
                </>
              ) : null}

              {tourIndex >= 0 && tourIndex < TOUR.length ? (
                <TourStep
                  screen={TOUR[tourIndex]}
                  stepNumber={tourIndex + 1}
                  stepCount={TOUR.length}
                  isLast={tourIndex === TOUR.length - 1}
                  onBack={() =>
                    setStep(tourIndex === 0 ? STEP_EVENT : step - 1)
                  }
                  onNext={() => {
                    if (tourIndex === TOUR.length - 1) {
                      void finishTour()
                    } else {
                      setStep(step + 1)
                    }
                  }}
                  onSkip={skip}
                />
              ) : null}
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
        I'll explore on my own
      </button>
      {children}
    </div>
  )
}

function TourStep({
  screen,
  stepNumber,
  stepCount,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  screen: TourScreen
  stepNumber: number
  stepCount: number
  isLast: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const Icon = screen.icon
  return (
    <>
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-primary">
        <Icon size={22} aria-hidden />
      </span>
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          How it works · {stepNumber} of {stepCount}
        </p>
        <h1 className="font-heading mt-1 text-xl font-semibold text-foreground">
          {screen.title}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {screen.detail}
        </p>
        {screen.docs ? (
          <Link
            to={screen.docs.to}
            target="_blank"
            className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {screen.docs.label} →
          </Link>
        ) : null}
      </div>
      <StepFooter onSkip={onSkip}>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="button" onClick={onNext}>
            {isLast ? "Go to your dashboard" : "Next"}
            {isLast ? null : <RiArrowRightLine size={16} aria-hidden />}
          </Button>
        </div>
      </StepFooter>
    </>
  )
}
