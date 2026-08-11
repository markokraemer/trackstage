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
 * The flow: name your workspace → confirm your email → name & create your
 * first event → ONE how-it-works screen (four points together — a sequence of
 * screens here was "overkill by a lot") → land on the new event's dashboard.
 *
 * THE EMAIL STEP IS A REAL GATE (Marko, round 3: "why can I click 'I'll
 * explore on my own' while my email is not verified?"). Two teeth:
 *
 *   1. The email step offers no skip. Resend, plus a 3s poll + focus refetch,
 *      so clicking the link in another tab unlocks this one instantly.
 *   2. The GATE ITSELF pins any signed-in unverified account to this screen
 *      on every `/app` access — flag done or not, events or not ("verify"
 *      mode). Verified → the gate opens and they are exactly where they were.
 *
 * The judge, e2e and demo accounts are born verified (`@example.*` /
 * `@demo.sessionboard.dev` — the databaseHook in convex/auth.ts), so none of
 * this can ever wall them. Skipping the wizard from its OTHER steps still
 * works and sets the same per-user flag as finishing
 * (convex/onboarding.ts). The speaker portal and public CFP live outside
 * `/app` and are untouched.
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

/**
 * Is this signed-in account's email confirmed? Better Auth's cached session
 * can keep saying `emailVerified: false` after the link is clicked, so while
 * unverified this polls every 3s and on window focus — the moment the
 * emailed link lands (any tab), `verified` flips here without a reload.
 */
function useEmailVerification() {
  const { data, isPending } = authClient.useSession()
  const [verifiedOverride, setVerifiedOverride] = useState(false)

  const hasUser = Boolean(data?.user)
  const verified = Boolean(data?.user.emailVerified) || verifiedOverride
  const unverified = !isPending && hasUser && !verified

  useEffect(() => {
    if (!unverified) return
    let cancelled = false
    const check = async () => {
      try {
        const fresh = await authClient.getSession({
          query: { disableCookieCache: true },
        })
        if (!cancelled && fresh.data?.user.emailVerified) {
          setVerifiedOverride(true)
        }
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
  }, [unverified])

  return { email: data?.user.email ?? "", hasUser, pending: isPending, verified }
}

export type OnboardingGate =
  | { state: "hide" }
  /** Queries still in flight, but the fresh-signup hint says it's coming —
   *  paint the takeover's frame, never a flash of the shell. */
  | { state: "pending" }
  | {
      state: "show"
      /** `wizard` = the guided flow; `verify` = pinned to email confirmation. */
      mode: "wizard" | "verify"
      email: string
      emailVerified: boolean
      finish: () => void
    }

/**
 * Whether the takeover owns the screen.
 *
 * Wizard: sticky once shown — creating the event mid-flow makes `events`
 * non-empty, and that must NOT yank the flow away; only finishing or
 * skipping releases it.
 *
 * Verify: not skippable and not sticky — it holds exactly while the account
 * is unverified, on every `/app` access, and opens by itself the moment the
 * confirmation lands.
 */
export function useOnboardingGate(): OnboardingGate {
  const { status } = useSession()
  const { events, isLoading: eventsLoading } = useCurrentEvent()
  const { data: flag } = useQuery(
    convexQuery(api.onboarding.status, status === "authenticated" ? {} : "skip"),
  )
  const emailState = useEmailVerification()
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

  if (active === true) {
    return {
      state: "show",
      mode: "wizard",
      email: emailState.email,
      emailVerified: emailState.verified,
      finish,
    }
  }
  // The hard gate: signed in, session resolved, email not confirmed — pinned,
  // whatever the flag or event count says. Exempt (born-verified) accounts
  // can never reach this branch.
  if (emailState.hasUser && !emailState.pending && !emailState.verified) {
    return {
      state: "show",
      mode: "verify",
      email: emailState.email,
      emailVerified: false,
      finish,
    }
  }
  if (active === null && hint && status !== "unauthenticated") {
    return { state: "pending" }
  }
  return { state: "hide" }
}

// Step indices — three doing-steps, then ONE how-it-works screen.
const STEP_WORKSPACE = 0
const STEP_EMAIL = 1
const STEP_EVENT = 2
const STEP_HOW = 3

// ONE screen, not a sequence (Marko, 2026-08-12: four separate how-it-works
// steps "is overkill by a lot") — the whole product in four glances, then the
// docs for anyone who wants more.
interface HowPoint {
  icon: RemixiconComponentType
  text: string
}

const HOW_POINTS: Array<HowPoint> = [
  { icon: RiSurveyLine, text: "Build your CFP form — the questions speakers answer." },
  { icon: RiLinkM, text: "Share the public link — proposals land in Submissions." },
  { icon: RiCheckboxCircleLine, text: "Review with your team, then accept and decline in batches." },
  { icon: RiCalendarScheduleLine, text: "Drag the agenda together — speakers get their own portal." },
]

const TOTAL_STEPS = STEP_HOW + 1

export function OnboardingTakeover({
  mode,
  email,
  emailVerified,
  onDone,
}: {
  mode: "wizard" | "verify"
  email: string
  emailVerified: boolean
  onDone: () => void
}) {
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
    if (mode !== "wizard") return
    writeResume({
      step,
      workspaceName,
      eventName,
      createdSlug: created?.slug,
      createdEventId: created?.eventId,
    })
  }, [mode, step, workspaceName, eventName, created])

  const workspaceId = workspace?.id ?? workspaces.at(0)?.id
  const workspaceSlug = workspace?.slug ?? workspaces.at(0)?.slug ?? ""

  // Confirmed (now, or before we got here): the email step clears itself.
  useEffect(() => {
    if (mode === "wizard" && step === STEP_EMAIL && emailVerified) {
      setStep(STEP_EVENT)
    }
  }, [mode, step, emailVerified])

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
    setStep(emailVerified ? STEP_EVENT : STEP_EMAIL)
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
      setStep(STEP_HOW)
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
      setStep(STEP_HOW)
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't create that event."))
    } finally {
      setBusy(false)
    }
  }

  async function finishHow() {
    persistDone()
    onDone()
    if (created && workspaceSlug) {
      await navigate({
        href: appLink.dashboard({ workspaceSlug, eventSlug: created.slug }),
      })
    }
  }

  const publicPreview =
    eventName.trim() && workspaceSlug
      ? publicEventUrl(workspaceSlug, slugify(eventName))
      : null

  const showEmail = mode === "verify" || step === STEP_EMAIL
  // Keying the card body restarts its enter animation on each step change —
  // one consistent quick fade/slide (200ms), no layout jump: the card keeps
  // its width and the content column its rhythm.
  const contentKey = mode === "verify" ? "verify" : `step-${step}`

  return (
    <div className="animate-in fade-in-0 flex min-h-svh flex-col bg-background duration-300">
      <header className="container-app flex h-14 shrink-0 items-center">
        <Logo size="sm" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-lg flex-col gap-5">
          {mode === "wizard" ? (
            /* Progress — quiet dots, one per screen. */
            <ol
              aria-label={`Step ${Math.min(step, TOTAL_STEPS - 1) + 1} of ${TOTAL_STEPS}`}
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
          ) : null}

          <Card>
            <CardContent className="px-6 py-8 sm:px-10">
              <div
                key={contentKey}
                className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200"
              >
                {mode === "wizard" && step === STEP_WORKSPACE ? (
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

                {showEmail ? (
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
                    {/* Deliberately NO skip here (Marko, round 3): confirming
                        the address is what unlocks the platform. */}
                    <div className="flex items-center justify-center gap-2 pt-1">
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
                  </>
                ) : null}

                {mode === "wizard" && step === STEP_EVENT ? (
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

                {mode === "wizard" && step === STEP_HOW ? (
                  <>
                    <StepHeading
                      title="You're set — here's how it works"
                      detail={
                        created
                          ? `“${eventName.trim() || "Your event"}” is ready. From here, the whole flow is:`
                          : "From here, the whole flow is:"
                      }
                    />
                    <ul className="flex flex-col gap-2.5">
                      {HOW_POINTS.map((point) => (
                        <li
                          key={point.text}
                          className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
                            <point.icon size={16} aria-hidden />
                          </span>
                          <span className="text-sm text-foreground">
                            {point.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-center">
                      <Link
                        to="/docs"
                        target="_blank"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Check out the docs →
                      </Link>
                    </p>
                    <StepFooter onSkip={skip}>
                      <Button type="button" onClick={() => void finishHow()}>
                        Go to your dashboard
                      </Button>
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
        I'll explore on my own
      </button>
      {children}
    </div>
  )
}
