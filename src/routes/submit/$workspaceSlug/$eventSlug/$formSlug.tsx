import { useCallback, useEffect, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiArrowLeftLine, RiArrowRightLine, RiSaveLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { StepTracker } from "@/components/submit/step-tracker"
import {
  SubmitFooterActions,
  SubmitShell,
} from "@/components/submit/submit-shell"
import { WelcomeStep } from "@/components/submit/welcome-step"
import { AccountStep } from "@/components/submit/account-step"
import { SubmissionStep } from "@/components/submit/submission-step"
import { ParticipantsStep } from "@/components/submit/participants-step"
import { ReviewStep } from "@/components/submit/review-step"
import {
  ClosedCard,
  NotFoundCard,
  SubmitSkeleton,
  SuccessCard,
} from "@/components/submit/outcome-cards"
import {
  STEPS,
  STEP_INDEX,
  answersForSubmit,
  isValidEmail,
  missingQuestionIds,
  resolveTitle,
  validateParticipants,
} from "@/components/submit/form-logic"
import { emptyParticipant } from "@/components/submit/types"
import { errorMessage } from "@/lib/errors"
import type {
  AnswerValue,
  Answers,
  ParticipantDraft,
  SubmitForm,
} from "@/components/submit/types"
import { portalHomeArgs } from "@/components/portal/portal-query"

/**
 * `/submit/:eventSlug/:formSlug` — the public call-for-speakers flow, and the
 * CANONICAL public address of a form (docs/SPEC.md §4.3,
 * docs/memory/DECISIONS.md "Public URL scheme is hierarchical").
 *
 * Form slugs are unique per EVENT, so both segments are needed to name one.
 * The one-segment `/submit/:slug` of old still resolves — it redirects here
 * (see `src/routes/submit/$eventSlug/index.tsx`).
 *
 * Five steps, no login wall: Welcome → Account → Submission → Participants →
 * Review. Auth is the portal token, kept in sessionStorage alongside the
 * in-progress answers so a reload, a phone call, or a closed tab never costs a
 * speaker their work.
 *
 * Where that token comes from is the security-relevant part (convex/submit.ts,
 * "IDENTITY MODEL"): a brand-new email address gets one immediately, while an
 * address with speaker history here gets a link emailed to it and this page
 * shows the "check your inbox" state instead. `?t=…` is that emailed link
 * coming back — it is consumed into sessionStorage and stripped from the URL
 * straight away, so the credential never sits in the address bar, in a
 * screenshot, or in a shared link.
 */

export const Route = createFileRoute("/submit/$workspaceSlug/$eventSlug/$formSlug")({
  /** `?t=<portalToken>` — the sign-in link we emailed a returning speaker. */
  validateSearch: (search: Record<string, unknown>): { t?: string } => {
    const token = typeof search.t === "string" ? search.t.trim() : ""
    return token ? { t: token } : {}
  },
  loader: async ({ context, params }) => {
    const now = Date.now()
    await context.queryClient.ensureQueryData(
      convexQuery(api.submit.getForm, {
        slug: params.formSlug,
        eventSlug: params.eventSlug,
        workspaceSlug: params.workspaceSlug,
        now,
      }),
    )
    return { now }
  },
  pendingComponent: SubmitSkeleton,
  component: PublicSubmitPage,
})

const VALIDATION_TOAST = "Missing required fields. Complete the highlighted fields below."

function storageKey(eventSlug: string, formSlug: string) {
  return `sessionboard:submit:${eventSlug}/${formSlug}`
}

interface StoredProgress {
  stepIndex: number
  email: string
  portalToken: string
  answers: Answers
  participants: Array<ParticipantDraft>
  draftId?: string
}

function PublicSubmitPage() {
  const { workspaceSlug, eventSlug, formSlug } = Route.useParams()
  const { now } = Route.useLoaderData()
  const { data: form } = useSuspenseQuery(
    convexQuery(api.submit.getForm, {
      slug: formSlug,
      eventSlug,
      workspaceSlug,
      now,
    }),
  )

  if (!form) return <NotFoundCard slug={`${eventSlug}/${formSlug}`} />
  if (!form.open) return <ClosedCard form={form} />
  return (
    <SubmitFlow
      key={`${eventSlug}/${formSlug}`}
      workspaceSlug={workspaceSlug}
      eventSlug={eventSlug}
      slug={formSlug}
      form={form}
    />
  )
}

function SubmitFlow({
  workspaceSlug,
  eventSlug,
  slug,
  form,
}: {
  workspaceSlug: string
  eventSlug: string
  slug: string
  form: SubmitForm
}) {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [stepIndex, setStepIndex] = useState(0)
  const [reachedIndex, setReachedIndex] = useState(0)

  const [email, setEmail] = useState("")
  const [portalToken, setPortalToken] = useState("")
  const [drafts, setDrafts] = useState<Array<{ id: string; title: string }>>([])
  const [draftId, setDraftId] = useState<string | undefined>(undefined)
  const [resumingDraftId, setResumingDraftId] = useState<string | null>(null)

  const [answers, setAnswers] = useState<Answers>({})
  const [participants, setParticipants] = useState<Array<ParticipantDraft>>([
    emptyParticipant(),
  ])

  const [invalidQuestionIds, setInvalidQuestionIds] = useState<Array<string>>([])
  const [invalidParticipantKeys, setInvalidParticipantKeys] = useState<
    Array<string>
  >([])
  const [participantIssues, setParticipantIssues] = useState<Array<string>>([])

  const [emailInvalid, setEmailInvalid] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [identifying, setIdentifying] = useState(false)
  // Set when the address already has speaker history here: we emailed a
  // sign-in link and this page is waiting for them to open it.
  const [linkSent, setLinkSent] = useState<{
    email: string
    /** False ⇒ hourly cap; a link is already sitting in their inbox. */
    sent: boolean
  } | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  /**
   * When the draft was last stored. A toast says so and then leaves; this stays
   * next to the button, because "did that save?" is the exact question someone
   * has when they close a half-finished proposal and hope to come back to it.
   */
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{
    portalToken: string
    email: string
  } | null>(null)

  const identify = useConvexMutation(api.submit.identify)
  const saveDraft = useConvexMutation(api.submit.saveDraft)
  const submit = useConvexMutation(api.submit.submit)

  // Drafts live behind the same portal token, so their contents come from the
  // speaker portal query — only fetched once we actually have a token.
  const portalQuery = useQuery({
    ...convexQuery(
      api.portal.home,
      portalToken ? portalHomeArgs(portalToken) : "skip",
    ),
    retry: false,
  })

  // ——— Persistence ————————————————————————————————————————————————————
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (typeof window === "undefined") return
    const raw = window.sessionStorage.getItem(storageKey(eventSlug, slug))
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as Partial<StoredProgress>
      if (saved.email) setEmail(saved.email)
      if (saved.portalToken) setPortalToken(saved.portalToken)
      if (saved.answers) setAnswers(saved.answers)
      if (saved.participants?.length) setParticipants(saved.participants)
      if (saved.draftId) setDraftId(saved.draftId)
      const step = saved.portalToken ? (saved.stepIndex ?? 0) : 0
      setStepIndex(step)
      setReachedIndex(step)
    } catch {
      window.sessionStorage.removeItem(storageKey(eventSlug, slug))
    }
  }, [eventSlug, slug])

  useEffect(() => {
    if (typeof window === "undefined" || !restored.current) return
    if (submitted) return
    const payload: StoredProgress = {
      stepIndex,
      email,
      portalToken,
      answers,
      participants,
      draftId,
    }
    window.sessionStorage.setItem(
      storageKey(eventSlug, slug),
      JSON.stringify(payload),
    )
  }, [
    eventSlug,
    slug,
    stepIndex,
    email,
    portalToken,
    answers,
    participants,
    draftId,
    submitted,
  ])

  // ——— Navigation ————————————————————————————————————————————————————
  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(index, STEPS.length - 1))
    setStepIndex(next)
    setReachedIndex((current) => Math.max(current, next))
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [])

  const focusFirstInvalid = useCallback((elementId: string) => {
    if (typeof document === "undefined") return
    window.requestAnimationFrame(() => {
      const node = document.getElementById(elementId)
      node?.scrollIntoView({ block: "center", behavior: "smooth" })
      if (node instanceof HTMLElement) node.focus({ preventScroll: true })
    })
  }, [])

  // ——— The emailed sign-in link (`?t=…`) ————————————————————————————————
  // Take the token out of the URL and into this session immediately: a link in
  // an address bar gets screenshotted, pasted into chat, and logged by every
  // proxy on the way. Then ask the server who it belongs to — that query is
  // authenticated by the token itself, so it can safely hand back the email
  // address and drafts `identify` deliberately no longer will.
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const consumedLink = useRef(false)
  useEffect(() => {
    if (consumedLink.current || !search.t) return
    consumedLink.current = true
    setPortalToken(search.t)
    setLinkToken(search.t)
    void navigate({
      to: "/submit/$workspaceSlug/$eventSlug/$formSlug",
      params: { workspaceSlug, eventSlug, formSlug: slug },
      search: {},
      replace: true,
    })
  }, [eventSlug, navigate, search.t, slug])

  const linkResume = useQuery({
    ...convexQuery(
      api.submit.resume,
      linkToken ? { slug, eventSlug, workspaceSlug, portalToken: linkToken } : "skip",
    ),
    retry: false,
  })

  useEffect(() => {
    if (!linkToken || linkResume.data === undefined) return
    setLinkToken(null)
    const me = linkResume.data
    if (!me) {
      setPortalToken("")
      goTo(STEP_INDEX.account)
      toast.error(
        "That link has expired. Enter your email address and we'll send a new one.",
      )
      return
    }
    setLinkSent(null)
    setEmail(me.email)
    setParticipants((current) =>
      current.map((participant, index) =>
        index === 0
          ? {
              ...participant,
              email: me.email,
              firstName: participant.firstName || me.firstName,
              lastName: participant.lastName || me.lastName,
            }
          : participant,
      ),
    )
    setDrafts(me.drafts)
    if (me.drafts.length === 0) {
      goTo(STEP_INDEX.submission)
      toast.success(`Signed in as ${me.email}.`)
    } else {
      goTo(STEP_INDEX.account)
    }
  }, [goTo, linkResume.data, linkToken])

  // ——— Field updates ————————————————————————————————————————————————
  const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }))
    setInvalidQuestionIds((current) => current.filter((id) => id !== questionId))
  }, [])

  const patchParticipant = useCallback(
    (index: number, patch: Partial<ParticipantDraft>) => {
      setParticipants((current) =>
        current.map((participant, at) =>
          at === index ? { ...participant, ...patch } : participant,
        ),
      )
      setInvalidParticipantKeys((current) =>
        current.filter(
          (key) => !Object.keys(patch).some((field) => key === `${index}-${field}`),
        ),
      )
    },
    [],
  )

  const addParticipant = useCallback((role: string) => {
    setParticipants((current) => [...current, emptyParticipant(role)])
  }, [])

  const removeParticipant = useCallback((index: number) => {
    setParticipants((current) => current.filter((_, at) => at !== index))
    setInvalidParticipantKeys([])
  }, [])

  // ——— Account step ——————————————————————————————————————————————————
  const handleIdentify = useCallback(async () => {
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setEmailInvalid(true)
      setAccountError(null)
      toast.error("Please enter a valid email address.")
      focusFirstInvalid("submit-email")
      return
    }
    setEmailInvalid(false)
    setAccountError(null)
    setIdentifying(true)
    try {
      // The token we already hold, if any: it is this session's proof that the
      // address is really ours, and it saves a returning speaker a second trip
      // to their inbox in the same sitting.
      const result = await identify({
        slug,
        eventSlug,
        workspaceSlug,
        email: trimmed,
        portalToken: portalToken || undefined,
      })

      // Known address, unproven session: the server emailed a sign-in link and
      // told us nothing else about them. Say so and stop here.
      if (result.status === "link_sent") {
        setLinkSent({ email: result.email, sent: result.sent })
        // Nothing of theirs may show while the address is unproven. The token
        // this session may already hold is deliberately NOT thrown away: it
        // belongs to whoever typed their own address earlier, and dropping it
        // over a typo would cost them a draft. The step tracker is clamped to
        // this step below, so it cannot be used to walk forward as somebody
        // else either.
        setDrafts([])
        return
      }

      setLinkSent(null)
      setPortalToken(result.portalToken)
      setParticipants((current) =>
        current.map((participant, index) =>
          index === 0
            ? {
                ...participant,
                email: trimmed,
                firstName: participant.firstName || result.firstName,
                lastName: participant.lastName || result.lastName,
              }
            : participant,
        ),
      )
      setDrafts(result.drafts)
      if (result.drafts.length === 0) {
        goTo(STEP_INDEX.submission)
      } else {
        toast.success(
          `Welcome back — you have ${result.drafts.length} saved draft${
            result.drafts.length === 1 ? "" : "s"
          }.`,
        )
      }
    } catch (error) {
      setAccountError(
        errorMessage(error, "We couldn't check that email. Please try again."),
      )
    } finally {
      setIdentifying(false)
    }
  }, [
    email,
    eventSlug,
    focusFirstInvalid,
    goTo,
    identify,
    portalToken,
    slug,
  ])

  /** "Send it again" from the check-your-inbox state — same hourly cap. */
  const handleResendLink = useCallback(async () => {
    if (!linkSent) return
    setIdentifying(true)
    try {
      const result = await identify({ slug, eventSlug, workspaceSlug, email: linkSent.email })
      if (result.status === "link_sent") {
        setLinkSent({ email: result.email, sent: result.sent })
        toast[result.sent ? "success" : "message"](
          result.sent
            ? `New link sent to ${result.email}.`
            : "We've already sent a few links to that address in the last hour — check your inbox and spam folder.",
        )
      }
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't send that link. Please try again."))
    } finally {
      setIdentifying(false)
    }
  }, [eventSlug, identify, linkSent, slug])

  const applyDraft = useCallback(
    (submission: {
      id: string
      title: string
      answers?: Record<string, unknown>
      participants: Array<{ name: string; role: string; company?: string }>
    }) => {
      const restoredAnswers = {
        ...((submission.answers ?? {}) as Answers),
      }
      if (!restoredAnswers.title && submission.title) {
        restoredAnswers.title = submission.title
      }
      setAnswers(restoredAnswers)
      const restoredParticipants: Array<ParticipantDraft> =
        submission.participants.map((participant, index) => {
          const [first, ...rest] = participant.name.trim().split(/\s+/)
          return {
            firstName: first,
            lastName: rest.join(" "),
            email: index === 0 ? email.trim() : "",
            role: participant.role,
            company: participant.company,
          }
        })
      setParticipants(
        restoredParticipants.length > 0
          ? restoredParticipants
          : [emptyParticipant("speaker", email.trim())],
      )
      setDraftId(submission.id)
      setResumingDraftId(null)
      goTo(STEP_INDEX.submission)
      toast.success("Draft loaded — pick up where you left off.")
      if (restoredParticipants.length > 1) {
        toast("Please re-enter your co-speakers' email addresses.")
      }
    },
    [email, goTo],
  )

  const handleResume = useCallback(
    (id: string) => {
      const submission = portalQuery.data?.submissions.find(
        (item) => item.id === id,
      )
      if (submission) {
        applyDraft(submission)
        return
      }
      setResumingDraftId(id)
    },
    [applyDraft, portalQuery.data],
  )

  useEffect(() => {
    if (!resumingDraftId) return
    const submission = portalQuery.data?.submissions.find(
      (item) => item.id === resumingDraftId,
    )
    if (submission) applyDraft(submission)
    else if (portalQuery.isError) {
      setResumingDraftId(null)
      toast.error("We couldn't load that draft. Please start a new submission.")
    }
  }, [applyDraft, portalQuery.data, portalQuery.isError, resumingDraftId])

  // ——— Validation ————————————————————————————————————————————————————
  const validateSubmissionStep = useCallback(() => {
    const missing = missingQuestionIds(form.questions, answers)
    setInvalidQuestionIds(missing)
    if (missing.length > 0) {
      toast.error(VALIDATION_TOAST)
      focusFirstInvalid(`question-${missing[0]}`)
      return false
    }
    return true
  }, [answers, focusFirstInvalid, form.questions])

  const validateParticipantsStep = useCallback(() => {
    const issues = validateParticipants(form.participantConfig, participants)
    setInvalidParticipantKeys(issues.fieldKeys)
    setParticipantIssues(issues.messages)
    if (issues.fieldKeys.length > 0 || issues.messages.length > 0) {
      toast.error(
        issues.fieldKeys.length > 0 ? VALIDATION_TOAST : issues.messages[0],
      )
      const first = issues.fieldKeys[0]
      if (first) focusFirstInvalid(`participant-${first}`)
      return false
    }
    return true
  }, [focusFirstInvalid, form.participantConfig, participants])

  // ——— Payloads ———————————————————————————————————————————————————————
  const participantPayload = useCallback(
    (requireEmail: boolean) =>
      participants
        .filter((participant) =>
          requireEmail ? true : isValidEmail(participant.email),
        )
        .map((participant) => ({
          firstName: participant.firstName.trim(),
          lastName: participant.lastName.trim(),
          email: participant.email.trim(),
          role: participant.role,
          jobTitle: participant.jobTitle?.trim() || undefined,
          company: participant.company?.trim() || undefined,
          phone: participant.phone?.trim() || undefined,
          bio: participant.bio?.trim() || undefined,
        })),
    [participants],
  )

  const handleSaveDraft = useCallback(async () => {
    if (!portalToken) {
      goTo(STEP_INDEX.account)
      toast.error("Enter your email first so we know where to save your draft.")
      return
    }
    setSavingDraft(true)
    try {
      const result = await saveDraft({
        slug,
        eventSlug,
        workspaceSlug,
        portalToken,
        draftId: draftId as Id<"submissions"> | undefined,
        title: resolveTitle(form.questions, answers),
        answers: answersForSubmit(form.questions, answers),
        participants: participantPayload(false),
      })
      setDraftId(result.draftId)
      setDraftSavedAt(new Date())
      toast.success(
        "Draft saved. Come back with the same email address to finish it.",
      )
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't save your draft."))
    } finally {
      setSavingDraft(false)
    }
  }, [
    answers,
    draftId,
    eventSlug,
    form.questions,
    goTo,
    participantPayload,
    portalToken,
    saveDraft,
    slug,
  ])

  const handleSubmit = useCallback(async () => {
    if (!portalToken) {
      goTo(STEP_INDEX.account)
      return
    }
    if (!validateSubmissionStep()) {
      goTo(STEP_INDEX.submission)
      return
    }
    if (!validateParticipantsStep()) {
      goTo(STEP_INDEX.participants)
      return
    }
    setSubmitting(true)
    try {
      await submit({
        slug,
        eventSlug,
        workspaceSlug,
        portalToken,
        draftId: draftId as Id<"submissions"> | undefined,
        title: resolveTitle(form.questions, answers),
        answers: answersForSubmit(form.questions, answers),
        participants: participantPayload(true),
      })
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(storageKey(eventSlug, slug))
        window.scrollTo({ top: 0 })
      }
      // The token this session already holds — `submit` no longer echoes it
      // back, and a session that got this far necessarily has it.
      setSubmitted({ portalToken, email: email.trim() })
    } catch (error) {
      toast.error(
        errorMessage(error, "We couldn't submit your proposal. Please try again."),
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    answers,
    draftId,
    email,
    eventSlug,
    form.questions,
    goTo,
    participantPayload,
    portalToken,
    slug,
    submit,
    validateParticipantsStep,
    validateSubmissionStep,
  ])

  const handleSubmitAnother = useCallback(() => {
    setSubmitted(null)
    setAnswers({})
    setDraftId(undefined)
    setDrafts([])
    setInvalidQuestionIds([])
    setInvalidParticipantKeys([])
    setParticipantIssues([])
    setParticipants([emptyParticipant("speaker", email.trim())])
    setReachedIndex(STEP_INDEX.submission)
    setStepIndex(STEP_INDEX.submission)
  }, [email])

  const canSaveDraft = form.allowDrafts && portalToken !== ""

  const saveDraftButton = canSaveDraft ? (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleSaveDraft()}
        disabled={savingDraft}
      >
        <RiSaveLine aria-hidden />
        {savingDraft ? "Saving…" : "Save as draft"}
      </Button>
      {draftSavedAt ? (
        <span
          aria-live="polite"
          className="text-xs text-muted-foreground"
        >
          Draft saved at{" "}
          {draftSavedAt.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
          . Come back with the same email address to finish it.
        </span>
      ) : null}
    </span>
  ) : null

  const backButton = (
    <Button type="button" variant="outline" onClick={() => goTo(stepIndex - 1)}>
      <RiArrowLeftLine aria-hidden />
      Back
    </Button>
  )

  // Plain function, not memoised: it closes over handlers that change with
  // every keystroke, and a stale footer would submit stale values.
  const renderFooter = () => {
    switch (stepIndex) {
      case STEP_INDEX.welcome:
        return (
          <SubmitFooterActions>
            <Button type="button" onClick={() => goTo(STEP_INDEX.account)}>
              Continue
              <RiArrowRightLine aria-hidden />
            </Button>
          </SubmitFooterActions>
        )
      case STEP_INDEX.account:
        // While a sign-in link is in flight there is nothing to continue TO —
        // the next move is in their inbox, and the card offers resend and
        // "use a different address" instead.
        return (
          <SubmitFooterActions left={backButton}>
            {linkSent ? null : (
              <Button
                type="button"
                disabled={identifying}
                onClick={() => void handleIdentify()}
              >
                {identifying ? "Checking…" : "Continue"}
                <RiArrowRightLine aria-hidden />
              </Button>
            )}
          </SubmitFooterActions>
        )
      case STEP_INDEX.submission:
        return (
          <SubmitFooterActions left={backButton}>
            {saveDraftButton}
            <Button
              type="button"
              onClick={() => {
                if (validateSubmissionStep()) goTo(STEP_INDEX.participants)
              }}
            >
              Continue
              <RiArrowRightLine aria-hidden />
            </Button>
          </SubmitFooterActions>
        )
      case STEP_INDEX.participants:
        return (
          <SubmitFooterActions left={backButton}>
            {saveDraftButton}
            <Button
              type="button"
              onClick={() => {
                if (validateParticipantsStep()) goTo(STEP_INDEX.review)
              }}
            >
              Continue
              <RiArrowRightLine aria-hidden />
            </Button>
          </SubmitFooterActions>
        )
      default:
        return (
          <SubmitFooterActions left={backButton}>
            {saveDraftButton}
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit"}
              <RiArrowRightLine aria-hidden />
            </Button>
          </SubmitFooterActions>
        )
    }
  }

  if (submitted) {
    return (
      <SuccessCard
        form={form}
        email={submitted.email}
        portalToken={submitted.portalToken}
        onSubmitAnother={
          form.limitPerUser === undefined || form.limitPerUser > 1
            ? handleSubmitAnother
            : undefined
        }
      />
    )
  }

  return (
    <SubmitShell
      eventName={form.event.name}
      formTitle={form.externalTitle}
      tracker={
        <StepTracker
          currentIndex={stepIndex}
          // Waiting on a sign-in link means the identity of this session is
          // unsettled — the tracker must not offer a way past the Account step
          // until it is, whatever was reached earlier.
          reachedIndex={
            linkSent ? Math.min(reachedIndex, STEP_INDEX.account) : reachedIndex
          }
          onSelect={goTo}
        />
      }
      footer={renderFooter()}
    >
      {stepIndex === STEP_INDEX.welcome ? <WelcomeStep form={form} /> : null}

      {stepIndex === STEP_INDEX.account ? (
        <AccountStep
          email={email}
          onEmailChange={(value) => {
            setEmail(value)
            setEmailInvalid(false)
            setAccountError(null)
            setLinkSent(null)
          }}
          onSubmit={() => void handleIdentify()}
          pending={identifying}
          error={accountError}
          invalid={emailInvalid}
          drafts={drafts}
          onResume={handleResume}
          onStartNew={() => goTo(STEP_INDEX.submission)}
          resumingDraftId={resumingDraftId}
          linkSent={linkSent}
          onResendLink={() => void handleResendLink()}
          onUseDifferentEmail={() => {
            setLinkSent(null)
            setEmail("")
            focusFirstInvalid("submit-email")
          }}
        />
      ) : null}

      {stepIndex === STEP_INDEX.submission ? (
        <SubmissionStep
          form={form}
          answers={answers}
          onAnswerChange={setAnswer}
          invalidIds={invalidQuestionIds}
        />
      ) : null}

      {stepIndex === STEP_INDEX.participants ? (
        <ParticipantsStep
          config={form.participantConfig}
          participants={participants}
          onChange={patchParticipant}
          onAdd={addParticipant}
          onRemove={removeParticipant}
          invalidKeys={invalidParticipantKeys}
          issues={participantIssues}
        />
      ) : null}

      {stepIndex === STEP_INDEX.review ? (
        <ReviewStep
          form={form}
          email={email}
          answers={answers}
          participants={participants}
          onEditStep={goTo}
        />
      ) : null}
    </SubmitShell>
  )
}
