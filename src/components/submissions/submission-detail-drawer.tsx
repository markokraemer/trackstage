import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiArrowGoBackLine,
  RiAttachment2,
  RiEyeLine,
  RiEyeOffLine,
  RiFileTextLine,
  RiHistoryLine,
  RiStarLine,
  RiTeamLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { SubmissionFiles } from "@/components/submissions/submission-files"
import { ParticipantsEditor } from "@/components/submissions/participants-editor"
import {
  StatusPicker,
  statusSavedMessage,
} from "@/components/submissions/status-picker"
import type { StatusChoice } from "@/components/submissions/status-picker"
import { TagInput } from "@/components/submissions/tag-input"
import { ChoiceValue, TrackValue } from "@/components/submissions/field-bits"
import { AnswersEditor } from "@/components/submissions/answers-editor"
import { ActivityTimeline } from "@/components/activity/activity-timeline"
import type { ActivityRow } from "@/components/activity/activity-timeline"
import { DeleteSubmissionButton } from "@/components/submissions/delete-submission-dialog"
import { errorMessage } from "@/lib/errors"
import {
  EMPTY_CELL,
  FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  LEVEL_OPTIONS,
  absoluteDate,
  formatScore,
  relativeDate,
  withCurrent,
} from "@/components/submissions/constants"

/**
 * Submission detail slide-over (docs/SPEC.md §4.4): Details / Participants /
 * Evaluations / Files. Organizers edit the core fields in place — the table
 * behind the drawer never loses its state, and the speaker portal reflects
 * every change immediately.
 */

const NONE = "none"

/** Questions with their own dedicated control above the answers block. */
const CORE_QUESTION_IDS = new Set([
  "title",
  "description",
  "track",
  "format",
  "level",
  "language",
  "tags",
])

interface Draft {
  title: string
  description: string
  trackId: string
  format: string
  level: string
  language: string
  tags: Array<string>
  /** "Show on public schedule" — sbek CNT-12. Absent on the record ⇒ on. */
  publicVisible: boolean
}

export interface SubmissionDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submissionId: Id<"submissions"> | null
  tracks: Array<{ _id: Id<"tracks">; name: string; color: string }>
}

export function SubmissionDetailDrawer({
  open,
  onOpenChange,
  submissionId,
  tracks,
}: SubmissionDetailDrawerProps) {
  const [tab, setTab] = useState("details")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: submission, error: loadError } = useQuery(
    convexQuery(api.submissions.get, submissionId ? { submissionId } : "skip")
  )
  const { data: evaluations } = useQuery(
    convexQuery(
      api.evaluationsAdmin.submissionEvaluations,
      submissionId && open ? { submissionId } : "skip"
    )
  )
  const { data: form } = useQuery(
    convexQuery(
      api.forms.get,
      submission?.formId ? { formId: submission.formId } : "skip"
    )
  )

  const updateDetails = useConvexMutation(api.submissions.updateDetails)
  const setStatus = useConvexMutation(api.submissions.setStatus)

  // Re-seed the editable draft whenever a different submission is opened.
  useEffect(() => {
    if (!submission) return
    setDraft({
      title: submission.title,
      description: submission.description ?? "",
      trackId: submission.trackId ?? NONE,
      format: submission.format ?? NONE,
      level: submission.level ?? NONE,
      language: submission.language ?? NONE,
      tags: submission.tags,
      publicVisible: submission.publicVisible !== false,
    })
  }, [submission?._id])

  useEffect(() => {
    if (open) setTab("details")
  }, [open, submissionId])

  const dirty =
    submission !== undefined &&
    draft !== null &&
    (draft.title !== submission.title ||
      draft.description !== (submission.description ?? "") ||
      draft.trackId !== (submission.trackId ?? NONE) ||
      draft.format !== (submission.format ?? NONE) ||
      draft.level !== (submission.level ?? NONE) ||
      draft.language !== (submission.language ?? NONE) ||
      draft.tags.join("|") !== submission.tags.join("|"))

  async function handleSave() {
    if (!submissionId || !draft || !dirty) return
    if (!draft.title.trim()) {
      toast.error("A submission needs a title.")
      return
    }
    setSaving(true)
    try {
      await updateDetails({
        submissionId,
        patch: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          trackId:
            draft.trackId === NONE ? null : (draft.trackId as Id<"tracks">),
          format: draft.format === NONE ? "" : draft.format,
          level: draft.level === NONE ? "" : draft.level,
          language: draft.language === NONE ? "" : draft.language,
          tags: draft.tags,
        },
      })
      toast.success("Submission updated.")
    } catch (error) {
      toast.error(errorMessage(error, "Could not save your changes."))
    } finally {
      setSaving(false)
    }
  }

  /**
   * "Show on public schedule" (sbek CNT-12). Saved the instant it is flipped —
   * a visibility switch that needs a second "Save" click is how a session ends
   * up announced by accident. The UI echoes first, the server confirms, and a
   * failure puts the switch back.
   */
  async function handleVisibility(next: boolean) {
    if (!submissionId || !draft) return
    setDraft({ ...draft, publicVisible: next })
    try {
      await updateDetails({ submissionId, patch: { publicVisible: next } })
      toast.success(
        next
          ? "Showing on the public schedule."
          : "Hidden from the public schedule."
      )
    } catch (error) {
      setDraft((current) =>
        current ? { ...current, publicVisible: !next } : current
      )
      toast.error(errorMessage(error, "Could not change the visibility."))
    }
  }

  async function handleStatus(next: StatusChoice) {
    if (!submissionId) return
    try {
      await setStatus({
        submissionId,
        status: next.status,
        // Custom status label, if one was picked (src/lib/status-catalog.ts).
        statusId: next.statusId
          ? (next.statusId as Id<"sessionStatuses">)
          : undefined,
      })
      toast.success(statusSavedMessage(next))
    } catch (error) {
      toast.error(errorMessage(error, "Could not change the status."))
    }
  }

  // The custom-field block below is rendered by `AnswersEditor`, which drives
  // each answer through its own question definition (so a dropdown is a
  // dropdown) and autosaves. It is shown whenever the form has a non-core
  // question OR the submission carries an answer we can still show.
  const customQuestions = (form?.questions ?? []).filter(
    (question) => question.enabled && !CORE_QUESTION_IDS.has(question.id)
  )
  const extraAnswerKeys = Object.keys(submission?.answers ?? {}).filter(
    (key) => !CORE_QUESTION_IDS.has(key)
  )
  const hasAnswers = customQuestions.length > 0 || extraAnswerKeys.length > 0

  const speakers = submission?.participants ?? []

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as string)}
      className="contents"
    >
      <DrawerShell
        open={open}
        onOpenChange={onOpenChange}
        title={
          submission ? (
            <span className="flex items-center gap-2">
              <span className="min-w-0 truncate">{submission.title}</span>
            </span>
          ) : (
            "Submission"
          )
        }
        description={
          submission ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {submission.kind === "session" ? "Session" : "Abstract"} ·
                Submitted {relativeDate(submission._creationTime)}
              </span>
            </span>
          ) : undefined
        }
        tabs={
          // Five tabs overflow a phone-width drawer — the strip scrolls.
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">
              <RiFileTextLine aria-hidden />
              Details
            </TabsTrigger>
            <TabsTrigger value="participants">
              <RiTeamLine aria-hidden />
              People
            </TabsTrigger>
            <TabsTrigger value="evaluations">
              <RiStarLine aria-hidden />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="files">
              <RiAttachment2 aria-hidden />
              Files
            </TabsTrigger>
            <TabsTrigger value="history">
              <RiHistoryLine aria-hidden />
              History
            </TabsTrigger>
          </TabsList>
        }
        footer={
          <>
            {submission ? (
              <DeleteSubmissionButton
                submissionId={submission._id}
                title={submission.title}
                kind={submission.kind}
                onDeleted={() => onOpenChange(false)}
              />
            ) : null}
            <span className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        {loadError ? (
          <EmptyState
            variant="plain"
            icon={RiFileTextLine}
            title="We couldn't open that submission"
            description="It may have been deleted, or it belongs to a different event. Close this panel and pick another submission from the table."
            action={
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            }
          />
        ) : !submission || !draft ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-9 w-1/2" />
          </div>
        ) : (
          <>
            <TabsContent value="details">
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusPicker
                  status={submission.status}
                  statusId={submission.statusId}
                  title={submission.title}
                  onSave={handleStatus}
                />
                {submission.notifiedAt ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Speaker notified {relativeDate(submission.notifiedAt)}
                  </span>
                ) : (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Not notified yet
                  </span>
                )}
              </div>

              <div className="mb-5 flex items-start gap-3 rounded-lg border border-border px-3 py-3">
                {draft.publicVisible ? (
                  <RiEyeLine
                    size={18}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                ) : (
                  <RiEyeOffLine
                    size={18}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="detail-public-visible"
                    className="text-sm font-medium text-foreground"
                  >
                    Show on public schedule
                  </label>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {draft.publicVisible
                      ? "Anyone can see this session on your public schedule, session list and calendar feed."
                      : "Hidden from the public schedule, session list and calendar feed. It stays on your agenda and in the speaker's portal."}
                  </p>
                </div>
                <Switch
                  id="detail-public-visible"
                  checked={draft.publicVisible}
                  onCheckedChange={(value) => void handleVisibility(value)}
                />
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="detail-title">
                    Title
                    <span className="required-asterisk" aria-hidden>
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </FieldLabel>
                  <Input
                    id="detail-title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="detail-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="detail-description"
                    rows={5}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="detail-track">Track</FieldLabel>
                  <Select
                    value={draft.trackId}
                    onValueChange={(value) =>
                      setDraft({ ...draft, trackId: value as string })
                    }
                  >
                    <SelectTrigger id="detail-track" className="w-full">
                      <SelectValue>
                        {(value) => (
                          <TrackValue
                            tracks={tracks}
                            value={value}
                            empty="No track"
                          />
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No track</SelectItem>
                      {tracks.map((track) => (
                        <SelectItem key={track._id} value={track._id}>
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: track.color }}
                            />
                            {track.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="detail-format">Format</FieldLabel>
                    <Select
                      value={draft.format}
                      onValueChange={(value) =>
                        setDraft({ ...draft, format: value as string })
                      }
                    >
                      <SelectTrigger id="detail-format" className="w-full">
                        <SelectValue>
                          {(value) => (
                            <ChoiceValue value={value} empty="No format" />
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No format</SelectItem>
                        {withCurrent(FORMAT_OPTIONS, submission.format).map(
                          (option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="detail-level">Level</FieldLabel>
                    <Select
                      value={draft.level}
                      onValueChange={(value) =>
                        setDraft({ ...draft, level: value as string })
                      }
                    >
                      <SelectTrigger id="detail-level" className="w-full">
                        <SelectValue>
                          {(value) => (
                            <ChoiceValue value={value} empty="No level" />
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No level</SelectItem>
                        {withCurrent(LEVEL_OPTIONS, submission.level).map(
                          (option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="detail-language">Language</FieldLabel>
                  <Select
                    value={draft.language}
                    onValueChange={(value) =>
                      setDraft({ ...draft, language: value as string })
                    }
                  >
                    <SelectTrigger id="detail-language" className="w-full">
                      <SelectValue>
                        {(value) => (
                          <ChoiceValue value={value} empty="No language" />
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No language</SelectItem>
                      {withCurrent(LANGUAGE_OPTIONS, submission.language).map(
                        (option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="detail-tags">Tags</FieldLabel>
                  <TagInput
                    id="detail-tags"
                    value={draft.tags}
                    onChange={(tags) => setDraft({ ...draft, tags })}
                  />
                </Field>
              </FieldGroup>

              <Separator className="my-6" />

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <MetaRow
                  label="Source"
                  value={submission.formName ?? "Added manually"}
                />
                <MetaRow
                  label="Submitted"
                  value={absoluteDate(submission._creationTime)}
                />
                <MetaRow
                  label="Room"
                  value={submission.room?.name ?? EMPTY_CELL}
                />
                <MetaRow
                  label="Scheduled"
                  value={
                    submission.startsAt
                      ? absoluteDate(submission.startsAt)
                      : "Not scheduled"
                  }
                />
              </dl>

              {hasAnswers ? (
                <>
                  <Separator className="my-6" />
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Form answers
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Edit these the way the speaker filled them in — each
                      change saves on its own.
                    </p>
                  </div>
                  <AnswersEditor
                    submissionId={submission._id}
                    questions={form?.questions ?? []}
                    answers={submission.answers}
                  />
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="participants">
              {/* Co-speakers stay editable after submission (sbek ABS-11):
                  add, re-role and remove people on an existing record. */}
              <ParticipantsEditor
                submissionId={submission._id}
                participants={speakers}
              />
            </TabsContent>

            <TabsContent value="evaluations">
              {!evaluations || evaluations.evaluations.length === 0 ? (
                <EmptyState
                  variant="plain"
                  icon={RiStarLine}
                  title="No reviews yet"
                  description="Scores appear here once evaluators submit their reviews. Set up an evaluation plan and invite reviewers from the Evaluation page."
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <div>
                      <p className="font-heading text-2xl font-semibold text-foreground">
                        {formatScore(evaluations.avg)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Average score
                      </p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div>
                      <p className="font-heading text-2xl font-semibold text-foreground">
                        {evaluations.count}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Completed reviews
                      </p>
                    </div>
                  </div>

                  <ul className="flex flex-col gap-2">
                    {evaluations.evaluations.map((evaluation) => (
                      <li
                        key={evaluation._id}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {evaluation.evaluatorName ??
                                evaluation.evaluatorEmail}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {evaluation.planName}
                              {evaluation.completedAt
                                ? ` · ${relativeDate(evaluation.completedAt)}`
                                : " · in progress"}
                            </p>
                          </div>
                          {/* Conflict of interest (sbek ABS-12) */}
                          {evaluation.recusedAt ? (
                            <span className="shrink-0 rounded-md bg-status-amber-bg px-2 py-0.5 text-xs font-medium text-status-amber-fg">
                              Recused
                            </span>
                          ) : (
                            <span className="font-heading text-lg font-semibold text-foreground">
                              {formatScore(evaluation.score)}
                            </span>
                          )}
                        </div>
                        {evaluation.recusedAt ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {evaluation.recusalReason
                              ? `Conflict of interest — "${evaluation.recusalReason}"`
                              : "Declared a conflict of interest. Excluded from the average."}
                          </p>
                        ) : null}
                        {/* Select + free-text answers (sbek ABS-03) */}
                        {Object.entries(evaluation.values).length > 0 ? (
                          <dl className="mt-2 space-y-1">
                            {evaluation.criteria
                              .filter(
                                (criterion) => criterion.id in evaluation.values,
                              )
                              .map((criterion) => (
                                <div
                                  key={criterion.id}
                                  className="flex gap-2 text-sm"
                                >
                                  <dt className="shrink-0 text-muted-foreground">
                                    {criterion.label}:
                                  </dt>
                                  <dd className="min-w-0 whitespace-pre-wrap text-foreground">
                                    {evaluation.values[criterion.id]}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                        ) : null}
                        {evaluation.comment ? (
                          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                            {evaluation.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="files">
              <SubmissionFiles
                submissionId={submission._id}
                eventId={submission.eventId}
                title={submission.title}
              />
            </TabsContent>

            <TabsContent value="history">
              <SubmissionHistory
                eventId={submission.eventId}
                submissionId={submission._id}
                entity={
                  submission.kind === "session" ? "session" : "submission"
                }
                active={tab === "history"}
              />
            </TabsContent>
          </>
        )}
      </DrawerShell>
    </Tabs>
  )
}

/**
 * History tab (sbek CNT-11). Every decision, edit and agent action on THIS
 * record, newest first — the answer to "who moved this to Declined, and when".
 * Loaded only while the tab is open: a drawer opened to skim details should
 * not pay for a feed nobody looked at.
 */
function SubmissionHistory({
  eventId,
  submissionId,
  entity,
  active,
}: {
  eventId: Id<"events">
  submissionId: Id<"submissions">
  entity: string
  active: boolean
}) {
  const { data: rows, isPending } = useQuery(
    convexQuery(
      api.audit.forEntity,
      active ? { eventId, entity, entityId: submissionId } : "skip"
    )
  )

  if (isPending || !rows) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    )
  }

  return (
    <ActivityTimeline
      rows={rows}
      renderAction={(row) => (
        <RestoreVersionButton submissionId={submissionId} row={row} />
      )}
      emptyState={
        <EmptyState
          variant="plain"
          icon={RiHistoryLine}
          title="Nothing has happened yet"
          description="Status changes, edits by the speaker, decisions you commit and anything an AI agent or the API does to this submission all appear here with who did it and when."
        />
      }
    />
  )
}

/**
 * "Restore this version" (sbek CNT-11) — offered only on the entries that
 * actually carry the wording they replaced, so the control never appears
 * where it couldn't do anything.
 *
 * Restoring writes forward and logs its own entry rather than rewinding the
 * log, which means the text you just replaced becomes restorable in turn and
 * the history never loses the fact that somebody undid something.
 */
function RestoreVersionButton({
  submissionId,
  row,
}: {
  submissionId: Id<"submissions">
  row: ActivityRow
}) {
  const [busy, setBusy] = useState(false)
  const restore = useConvexMutation(api.submissions.restoreFromHistory)

  // Only the entries that actually banked a version offer to put one back.
  const versionId = row.meta?.versionId
  if (typeof versionId !== "string") return null

  const preview =
    typeof row.meta?.previousTitle === "string" ? row.meta.previousTitle : null

  async function onRestore() {
    setBusy(true)
    try {
      const result = await restore({
        submissionId,
        versionId: versionId as Id<"submissionVersions">,
      })
      toast.success(
        `Restored the earlier ${result.restored.join(" and ")}`,
        { description: "The version you replaced is now the one you can put back." },
      )
    } catch (error) {
      toast.error("Couldn't restore that version", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Before this edit
        {preview ? (
          <>
            {" "}
            the title was &ldquo;
            <span className="text-foreground">{preview}</span>&rdquo;
          </>
        ) : null}
        .
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="mt-1.5"
        disabled={busy}
        onClick={() => void onRestore()}
      >
        <RiArrowGoBackLine aria-hidden />
        {busy ? "Restoring…" : "Restore this version"}
      </Button>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("min-w-0")}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm text-foreground">{value}</dd>
    </div>
  )
}

