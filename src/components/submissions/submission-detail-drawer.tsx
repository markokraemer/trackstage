import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAttachment2,
  RiFileTextLine,
  RiStarLine,
  RiTeamLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import type { SubmissionStatus } from "@/components/shared/status-pill"
import { SubmissionFiles } from "@/components/submissions/submission-files"
import { StatusPicker } from "@/components/submissions/status-picker"
import { TagInput } from "@/components/submissions/tag-input"
import { ChoiceValue, TrackValue } from "@/components/submissions/field-bits"
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

const ROLE_LABELS: Record<string, string> = {
  speaker: "Speaker",
  chairperson: "Chairperson",
  moderator: "Moderator",
}

interface Draft {
  title: string
  description: string
  trackId: string
  format: string
  level: string
  language: string
  tags: Array<string>
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
      toast.error(
        error instanceof Error ? error.message : "Could not save your changes."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(next: SubmissionStatus) {
    if (!submissionId) return
    try {
      await setStatus({ submissionId, status: next })
      toast.success("Status updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change the status."
      )
    }
  }

  const questionLabels = new Map<string, string>(
    (form?.questions ?? []).map((question) => [question.id, question.label])
  )
  const answerEntries = Object.entries(submission?.answers ?? {}).filter(
    ([, value]) =>
      value !== null && value !== undefined && String(value).length > 0
  )

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
          <TabsList className="w-full">
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
          </TabsList>
        }
        footer={
          <>
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

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="detail-title">
                    Title <span className="text-destructive">*</span>
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

              {answerEntries.length > 0 ? (
                <>
                  <Separator className="my-6" />
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Form answers
                  </h3>
                  <dl className="flex flex-col gap-4">
                    {answerEntries.map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {questionLabels.get(key) ?? key}
                        </dt>
                        <dd className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                          {Array.isArray(value)
                            ? value.join(", ")
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="participants">
              {speakers.length === 0 ? (
                <EmptyState
                  variant="plain"
                  icon={RiTeamLine}
                  title="No people on this submission yet"
                  description="Speakers added through your form appear here with their role. You can add people to a manually created session when you create it."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {speakers.map((person) => (
                    <li
                      key={`${person.personId}-${person.role}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <Avatar className="size-9">
                        <AvatarFallback className="text-xs">
                          {initials(person.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {person.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {person.email}
                          {person.company ? ` · ${person.company}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {ROLE_LABELS[person.role] ?? person.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
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
                          <span className="font-heading text-lg font-semibold text-foreground">
                            {formatScore(evaluation.score)}
                          </span>
                        </div>
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
          </>
        )}
      </DrawerShell>
    </Tabs>
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

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
