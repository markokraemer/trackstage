import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
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
  titleFromAnswers,
  validateParticipants,
} from "@/components/submit/form-logic"
import { emptyParticipant } from "@/components/submit/types"
import type {
  AnswerValue,
  Answers,
  ParticipantDraft,
  SubmitForm,
} from "@/components/submit/types"

/**
 * `/submit/:slug` — the public call-for-speakers flow (docs/SPEC.md §4.3).
 *
 * Five steps, no login wall: Welcome → Account → Submission → Participants →
 * Review. Auth is the portal token `submit.identify` hands back for an email
 * address; it is kept in sessionStorage alongside the in-progress answers so a
 * reload, a phone call, or a closed tab never costs a speaker their work.
 */

export const Route = createFileRoute("/submit/$slug")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.submit.getForm, { slug: params.slug }),
    )
  },
  pendingComponent: SubmitSkeleton,
  component: PublicSubmitPage,
})

const VALIDATION_TOAST = "Missing required fields. Complete the highlighted fields below."

function storageKey(slug: string) {
  return `sessionboard:submit:${slug}`
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
  const { slug } = Route.useParams()
  const { data: form } = useSuspenseQuery(
    convexQuery(api.submit.getForm, { slug }),
  )

  if (!form) return <NotFoundCard slug={slug} />
  if (!form.open) return <ClosedCard form={form} />
  return <SubmitFlow key={slug} slug={slug} form={form} />
}

function SubmitFlow({ slug, form }: { slug: string; form: SubmitForm }) {
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
  const [savingDraft, setSavingDraft] = useState(false)
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
      portalToken ? { portalToken } : "skip",
    ),
    retry: false,
  })

  // ——— Persistence ————————————————————————————————————————————————————
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (typeof window === "undefined") return
    const raw = window.sessionStorage.getItem(storageKey(slug))
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
      window.sessionStorage.removeItem(storageKey(slug))
    }
  }, [slug])

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
    window.sessionStorage.setItem(storageKey(slug), JSON.stringify(payload))
  }, [
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

  const addParticipant = useCallback(() => {
    setParticipants((current) => [...current, emptyParticipant("speaker")])
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
      const result = await identify({ slug, email: trimmed })
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
        error instanceof Error
          ? error.message
          : "We couldn't check that email. Please try again.",
      )
    } finally {
      setIdentifying(false)
    }
  }, [email, focusFirstInvalid, goTo, identify, slug])

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
        portalToken,
        draftId: draftId as Id<"submissions"> | undefined,
        title: titleFromAnswers(answers),
        answers: answersForSubmit(form.questions, answers),
        participants: participantPayload(false),
      })
      setDraftId(result.draftId)
      toast.success(
        "Draft saved. Come back with the same email address to finish it.",
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't save your draft.",
      )
    } finally {
      setSavingDraft(false)
    }
  }, [
    answers,
    draftId,
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
      const result = await submit({
        slug,
        portalToken,
        draftId: draftId as Id<"submissions"> | undefined,
        title: titleFromAnswers(answers),
        answers: answersForSubmit(form.questions, answers),
        participants: participantPayload(true),
      })
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(storageKey(slug))
        window.scrollTo({ top: 0 })
      }
      setSubmitted({ portalToken: result.portalToken, email: email.trim() })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't submit your proposal. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    answers,
    draftId,
    email,
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
    <Button
      type="button"
      variant="outline"
      onClick={() => void handleSaveDraft()}
      disabled={savingDraft}
    >
      <RiSaveLine aria-hidden />
      {savingDraft ? "Saving…" : "Save as draft"}
    </Button>
  ) : null

  const backButton = (
    <Button type="button" variant="outline" onClick={() => goTo(stepIndex - 1)}>
      <RiArrowLeftLine aria-hidden />
      Back
    </Button>
  )

  const footer = useMemo(() => {
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
        return (
          <SubmitFooterActions left={backButton}>
            <Button
              type="button"
              disabled={identifying}
              onClick={() => void handleIdentify()}
            >
              {identifying ? "Checking…" : "Continue"}
              <RiArrowRightLine aria-hidden />
            </Button>
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
  }, [
    backButton,
    goTo,
    handleSubmit,
    identifying,
    saveDraftButton,
    stepIndex,
    submitting,
    validateParticipantsStep,
    validateSubmissionStep,
  ])

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
          reachedIndex={reachedIndex}
          onSelect={goTo}
        />
      }
      footer={footer}
    >
      {stepIndex === STEP_INDEX.welcome ? <WelcomeStep form={form} /> : null}

      {stepIndex === STEP_INDEX.account ? (
        <AccountStep
          email={email}
          onEmailChange={(value) => {
            setEmail(value)
            setEmailInvalid(false)
            setAccountError(null)
          }}
          onSubmit={() => void handleIdentify()}
          pending={identifying}
          error={accountError}
          invalid={emailInvalid}
          drafts={drafts}
          onResume={handleResume}
          onStartNew={() => goTo(STEP_INDEX.submission)}
          resumingDraftId={resumingDraftId}
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
