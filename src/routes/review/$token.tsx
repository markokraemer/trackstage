import { useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { format } from "date-fns"
import {
  RiArrowRightLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiEyeOffLine,
  RiLockLine,
  RiTrophyLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Logo } from "@/components/brand/logo"
import { ProgressMeter } from "@/components/evaluation/progress-meter"
import { ScoreField } from "@/components/evaluation/score-field"

/**
 * Evaluator review queue — `/review/:token` (docs/SPEC.md §4.5).
 *
 * Public and de-chromed: no sidebar, no login wall, nothing but the work. The
 * evaluator clicks the link in their invite and starts scoring. Everything is
 * ordinary buttons and a textarea, so a person on a train and a browser agent
 * both get through it without instructions.
 */
export const Route = createFileRoute("/review/$token")({
  component: ReviewPage,
})

function ReviewPage() {
  const { token } = Route.useParams()

  const {
    data: queue,
    isPending,
    isError,
    error,
  } = useQuery({
    ...convexQuery(api.review.queue, { token }),
    retry: false,
  })

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [showMissing, setShowMissing] = useState(false)
  const pickedFirst = useRef(false)

  const submitScores = useMutation({
    mutationFn: useConvexMutation(api.review.submitScores),
  })

  // Land on the first thing that still needs scoring.
  useEffect(() => {
    if (pickedFirst.current || !queue || queue.submissions.length === 0) return
    pickedFirst.current = true
    const firstOpen = queue.submissions.find((s) => s.completedAt === null)
    setCurrentId((firstOpen ?? queue.submissions[0])._id)
  }, [queue])

  const current = useMemo(() => {
    if (!queue) return null
    return queue.submissions.find((s) => s._id === currentId) ?? null
  }, [queue, currentId])

  // Load saved scores whenever the evaluator moves to another submission.
  useEffect(() => {
    if (!current) return
    setScores(current.scores ?? {})
    setComment(current.comment ?? "")
    setShowMissing(false)
    // Intentionally keyed on the selection only: re-running on every queue
    // refetch would wipe scores the evaluator is mid-way through typing.
  }, [currentId])

  if (isError) {
    return (
      <ReviewShell>
        <Card className="mx-auto w-full max-w-(--container-card) p-8 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-status-red-bg text-status-red-fg">
            <RiErrorWarningLine size={20} aria-hidden />
          </div>
          <h1 className="font-heading text-lg font-semibold text-foreground">
            This review link isn't valid
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {error.message.includes("no longer exists")
              ? "The evaluation round this link belonged to has been deleted."
              : "The link may have been mistyped, replaced by a newer invite, or removed by the organizer."}{" "}
            Ask the event organizer to send you a fresh review link.
          </p>
        </Card>
      </ReviewShell>
    )
  }

  if (isPending) {
    return (
      <ReviewShell>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </ReviewShell>
    )
  }

  const { plan, progress, evaluator, event } = queue
  const closed = plan.status !== "open"
  const allDone = progress.total > 0 && progress.done >= progress.total
  const due = plan.dueAt === undefined ? undefined : new Date(plan.dueAt)
  const criteria = plan.criteria
  const missing = criteria.filter((criterion) => !(criterion.id in scores))
  const nextOpen =
    queue.submissions.find(
      (s) => s.completedAt === null && s._id !== current?._id
    ) ?? null

  function save() {
    if (!current) return
    if (missing.length > 0) {
      setShowMissing(true)
      return
    }
    submitScores.mutate(
      {
        token,
        submissionId: current._id,
        scores,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          toast.success("Score saved", {
            description: `${result.done} of ${result.total} reviewed.`,
          })
          if (nextOpen) setCurrentId(nextOpen._id)
        },
        onError: (mutationError: Error) =>
          toast.error("Couldn't save your score", {
            description: mutationError.message,
          }),
      }
    )
  }

  return (
    <ReviewShell eventName={event?.name}>
      {/* Greeting + progress */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Hi {evaluator.name ?? evaluator.email} — thanks for reviewing
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You're scoring for{" "}
              <span className="font-medium text-foreground">{plan.name}</span>
              {event ? ` · ${event.name}` : ""}
              {due ? ` · due ${format(due, "MMM d, yyyy")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Round {plan.round}</Badge>
            {queue.anonymized ? (
              <Badge
                variant="secondary"
                className="gap-1"
                title="Speaker names, job titles and companies are withheld for this round."
              >
                <RiEyeOffLine size={12} aria-hidden />
                Blind review
              </Badge>
            ) : null}
            {closed ? (
              <Badge variant="secondary" className="gap-1">
                <RiLockLine size={12} aria-hidden />
                Round closed
              </Badge>
            ) : null}
          </div>
        </div>
        <ProgressMeter
          className="mt-4"
          label="Your progress"
          done={progress.done}
          total={progress.total}
          unit="reviewed"
        />
      </Card>

      {closed ? (
        <Card className="border-l-4 border-l-status-amber-dot bg-status-amber-bg/40 p-4">
          <p className="text-sm text-foreground">
            This round has been closed by the organizer, so scores can no longer
            be changed. Thank you for your reviews.
          </p>
        </Card>
      ) : null}

      {allDone ? (
        <Card className="border-l-4 border-l-status-green-dot p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-status-green-bg text-status-green-fg">
              <RiTrophyLine size={18} aria-hidden />
            </span>
            <div>
              <p className="font-heading text-base font-semibold text-foreground">
                All done — every submission scored
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thank you. You can still revisit any submission below and change
                your score while the round is open.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {queue.submissions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-heading text-base font-semibold text-foreground">
            Nothing to review yet
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The organizer hasn't assigned any submissions to this round. Check
            back later — your link keeps working.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[17rem_1fr] lg:items-start">
          {/* Queue */}
          <nav aria-label="Your review queue" className="lg:sticky lg:top-6">
            <Card className="gap-0 p-2">
              <p className="px-2 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Your queue
              </p>
              <ul className="max-h-[26rem] space-y-0.5 overflow-y-auto lg:max-h-[70svh]">
                {queue.submissions.map((submission, index) => {
                  const done = submission.completedAt !== null
                  const active = submission._id === current?._id
                  return (
                    <li key={submission._id}>
                      <button
                        type="button"
                        onClick={() => setCurrentId(submission._id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                          active && "bg-accent"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            done
                              ? "bg-status-green-bg text-status-green-fg"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {done ? (
                            <RiCheckLine size={12} aria-hidden />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium text-foreground">
                            {submission.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {done ? "Scored" : "Not scored yet"}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </nav>

          {/* Current submission */}
          {current ? (
            <Card className="gap-0 p-0">
              <div className="border-b border-border p-6">
                <div className="flex flex-wrap items-center gap-2">
                  {current.track ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: current.track.color }}
                      />
                      {current.track.name}
                    </span>
                  ) : null}
                  {current.format ? (
                    <Badge variant="secondary">{current.format}</Badge>
                  ) : null}
                  {current.level ? (
                    <Badge variant="secondary">{current.level}</Badge>
                  ) : null}
                  {current.language ? (
                    <Badge variant="secondary">{current.language}</Badge>
                  ) : null}
                  {current.completedAt !== null ? (
                    <Badge variant="secondary" className="gap-1">
                      <RiCheckLine size={12} aria-hidden />
                      You scored this
                    </Badge>
                  ) : null}
                </div>

                <h2 className="mt-3 font-heading text-xl font-semibold tracking-tight text-foreground">
                  {current.title}
                </h2>

                {current.description ? (
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                    {current.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No abstract was provided for this submission.
                  </p>
                )}

                {current.tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {current.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {queue.anonymized ? (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RiEyeOffLine size={13} aria-hidden />
                    Blind review — score this on the abstract alone. Speaker
                    details are withheld for this round.
                  </p>
                ) : current.speakers.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {current.speakers.length === 1 ? "Speaker" : "Speakers"}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {current.speakers.map((speaker, index) => (
                        <li
                          key={`${speaker.name}-${index}`}
                          className="text-sm text-foreground"
                        >
                          {speaker.name}
                          {speaker.jobTitle || speaker.company ? (
                            <span className="text-muted-foreground">
                              {" — "}
                              {[speaker.jobTitle, speaker.company]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* Scoring */}
              <CardContent className="space-y-6 p-6">
                <div className="space-y-5">
                  {criteria.map((criterion) => (
                    <ScoreField
                      key={criterion.id}
                      criterionId={criterion.id}
                      label={criterion.label}
                      value={scores[criterion.id]}
                      disabled={closed}
                      onChange={(value) =>
                        setScores((currentScores) => ({
                          ...currentScores,
                          [criterion.id]: value,
                        }))
                      }
                    />
                  ))}
                </div>

                <Field>
                  <FieldLabel htmlFor="review-comment">
                    Comments for the organizers
                  </FieldLabel>
                  <FieldDescription>
                    Optional. Speakers never see this.
                  </FieldDescription>
                  <Textarea
                    id="review-comment"
                    rows={4}
                    value={comment}
                    disabled={closed}
                    placeholder="What stood out? Anything the organizers should know?"
                    onChange={(commentEvent) =>
                      setComment(commentEvent.target.value)
                    }
                  />
                </Field>

                {showMissing && missing.length > 0 ? (
                  <p
                    role="alert"
                    className="rounded-lg bg-status-red-bg px-3 py-2 text-sm text-status-red-fg"
                  >
                    Please give a score for{" "}
                    {missing.map((criterion) => criterion.label).join(", ")}{" "}
                    before saving.
                  </p>
                ) : null}
              </CardContent>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
                <p className="text-xs text-muted-foreground">
                  {closed
                    ? "Scoring is closed for this round."
                    : "Your scores are private to the organizers."}
                </p>
                <div className="flex items-center gap-2">
                  {nextOpen ? (
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentId(nextOpen._id)}
                    >
                      Skip for now
                    </Button>
                  ) : null}
                  <Button
                    onClick={save}
                    disabled={closed || submitScores.isPending}
                  >
                    {submitScores.isPending
                      ? "Saving…"
                      : nextOpen
                        ? "Save & next"
                        : "Save"}
                    <RiArrowRightLine aria-hidden />
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </ReviewShell>
  )
}

/** De-chromed public shell — same treatment as the speaker portal. */
function ReviewShell({
  eventName,
  children,
}: {
  eventName?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Logo size="sm" />
          {eventName ? (
            <p className="truncate text-sm text-muted-foreground">
              {eventName}
            </p>
          ) : null}
        </div>
      </header>
      <main className="container-page flex flex-col gap-5 py-8">
        {children}
      </main>
    </div>
  )
}
