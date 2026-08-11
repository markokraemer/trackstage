import { useEffect, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import {
  RiCalendarCloseLine,
  RiCalendarEventLine,
  RiCloseCircleLine,
  RiFileTextLine,
  RiInformationLine,
  RiMapPin2Line,
  RiTeamLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { StatusPill } from "@/components/shared/status-pill"
import { usePortal } from "./portal-context"
import type { PortalSubmission } from "./portal-context"
import { TrackDot } from "./submission-card"
import { errorMessage } from "@/lib/errors"
import {
  canEdit,
  canWithdraw,
  formatDate,
  formatEventDateTime,
  humanizeKey,
} from "./portal-utils"

/** Answers we render as editable text (everything else is shown read-only). */
function isTextAnswer(value: unknown): value is string {
  return typeof value === "string"
}

/**
 * A locked submission is bad news only when the decision went against the
 * speaker. A closed call for speakers, or an event that takes edits by email,
 * is ordinary information — so those stay in the default tone.
 */
const LOCK_TONE: Record<string, "default" | "destructive"> = {
  withdrawn: "destructive",
  declined: "destructive",
  portal_disabled: "default",
  cfp_closed: "default",
}

export interface SubmissionDrawerProps {
  submission: PortalSubmission
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Submission detail (docs/SPEC.md §4.7). Details and Participants tabs, and —
 * per swyx's clarification — the speaker can still edit the text after the
 * submission has been accepted. Editing locks when the decision went against
 * them, when the organizer turned portal edits off, or when the call for
 * speakers closed on a talk that isn't accepted yet; `editLock` carries the
 * reason and the sentence, straight from the server.
 */
export function SubmissionDrawer({
  submission,
  code,
  open,
  onOpenChange,
}: SubmissionDrawerProps) {
  const { portalToken, home } = usePortal()
  // Optimistic on both (docs/memory/RULES.md #26): the speaker's own text is
  // already on their screen, so the list behind the drawer must not lag a
  // round-trip behind it. A rejected save rolls back and the toast says why.
  const updateSubmission = useConvexMutation(
    api.portal.updateSubmission,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.portal.home, { portalToken })
    if (!current) return
    localStore.setQuery(
      api.portal.home,
      { portalToken },
      {
        ...current,
        submissions: current.submissions.map((s) =>
          s.id === args.submissionId
            ? {
                ...s,
                title: args.patch.title ?? s.title,
                description: args.patch.description ?? s.description,
                answers: args.patch.answers ?? s.answers,
              }
            : s,
        ),
      },
    )
  })
  const withdrawSubmission = useConvexMutation(
    api.portal.withdrawSubmission,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.portal.home, { portalToken })
    if (!current) return
    localStore.setQuery(
      api.portal.home,
      { portalToken },
      {
        ...current,
        submissions: current.submissions.map((s) =>
          s.id === args.submissionId ? { ...s, status: "withdrawn" } : s,
        ),
      },
    )
  })

  // One server-computed verdict (convex/portal.ts editLockFor): a decided
  // status, the organizer's "allow submission edits" switch, or the CFP's own
  // close date. Present ⇒ show the fields read-only with the reason, rather
  // than letting someone type a paragraph the save would then refuse.
  const lock = submission.editLock
  const editable = canEdit(submission)
  const [title, setTitle] = useState(submission.title)
  const [description, setDescription] = useState(submission.description ?? "")
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    submission.answers,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // Reload the draft when a different submission is opened. Deliberately not
  // reacting to live server updates — that would wipe what the speaker is
  // halfway through typing.
  const submissionId = submission.id
  useEffect(() => {
    setTitle(submission.title)
    setDescription(submission.description ?? "")
    setAnswers(submission.answers)

  }, [submissionId, open])

  const dirty =
    title !== submission.title ||
    description !== (submission.description ?? "") ||
    JSON.stringify(answers) !== JSON.stringify(submission.answers)

  async function handleSave() {
    if (title.trim().length === 0) {
      toast.error("Your submission needs a title.")
      return
    }
    setIsSaving(true)
    try {
      await updateSubmission({
        portalToken,
        submissionId: submission.id,
        patch: {
          title: title.trim(),
          description,
          answers,
        },
      })
      toast.success("Your changes were saved.")
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't save your changes."))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleWithdraw() {
    setIsWithdrawing(true)
    try {
      await withdrawSubmission({ portalToken, submissionId: submission.id })
      toast.success("Your submission was withdrawn.")
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't withdraw this submission."))
    } finally {
      setIsWithdrawing(false)
    }
  }

  const answerKeys = Object.keys(answers).sort()

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={submission.title}
      description={`${code} · ${submission.kind === "session" ? "Session" : "Abstract"}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {editable ? (
            <Button onClick={handleSave} disabled={!dirty || isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </>
      }
    >
      <Tabs defaultValue="details" className="gap-4">
        <TabsList>
          <TabsTrigger value="details" className="gap-1.5">
            <RiFileTextLine size={15} aria-hidden />
            Details
          </TabsTrigger>
          <TabsTrigger value="participants" className="gap-1.5">
            <RiTeamLine size={15} aria-hidden />
            Participants
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={submission.status} />
            {submission.track ? (
              <Badge variant="secondary" className="gap-1.5">
                <TrackDot
                  name={submission.track.name}
                  color={submission.track.color}
                />
              </Badge>
            ) : null}
            {submission.format ? (
              <Badge variant="secondary">{submission.format}</Badge>
            ) : null}
            {submission.level ? (
              <Badge variant="secondary">{submission.level}</Badge>
            ) : null}
            {submission.language ? (
              <Badge variant="secondary">{submission.language}</Badge>
            ) : null}
            {submission.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {submission.scheduled ? (
            <Alert>
              <RiCalendarEventLine aria-hidden />
              <AlertTitle>You're on the schedule</AlertTitle>
              <AlertDescription>
                <span className="block font-medium text-foreground">
                  {formatEventDateTime(
                    submission.scheduled.startsAt,
                    home.event.timezone,
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{submission.scheduled.durationMinutes} minutes</span>
                  {submission.scheduled.room ? (
                    <span className="inline-flex items-center gap-1.5">
                      <RiMapPin2Line size={14} aria-hidden />
                      {submission.scheduled.room}
                    </span>
                  ) : null}
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          {lock === null ? (
            <Alert>
              <RiInformationLine aria-hidden />
              <AlertDescription>
                {submission.editableUntil
                  ? `You can update the wording here until ${formatDate(submission.editableUntil)}, when the call for speakers closes. The organizers see your latest version.`
                  : "You can update the wording here — even after your talk has been accepted. The organizers see your latest version."}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant={LOCK_TONE[lock.code]}>
              {lock.code === "cfp_closed" ? (
                <RiCalendarCloseLine aria-hidden />
              ) : lock.code === "portal_disabled" ? (
                <RiInformationLine aria-hidden />
              ) : (
                <RiCloseCircleLine aria-hidden />
              )}
              <AlertTitle>{lock.title}</AlertTitle>
              <AlertDescription>{lock.message}</AlertDescription>
            </Alert>
          )}

          <Field>
            <FieldLabel htmlFor="submission-title">
              Title <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="submission-title"
              value={title}
              maxLength={255}
              disabled={!editable}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="submission-description">Description</FieldLabel>
            <FieldDescription>
              What the audience will take away. Plain text is fine.
            </FieldDescription>
            <Textarea
              id="submission-description"
              value={description}
              rows={6}
              disabled={!editable}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          {answerKeys.length > 0 ? (
            <div className="flex flex-col gap-5 border-t border-border pt-5">
              <p className="text-sm font-medium text-foreground">
                Your answers from the submission form
              </p>
              {answerKeys.map((key) => {
                const value = answers[key]
                if (!isTextAnswer(value)) {
                  return (
                    <Field key={key}>
                      <FieldLabel>{humanizeKey(key)}</FieldLabel>
                      <p className="text-sm text-muted-foreground">
                        {Array.isArray(value)
                          ? value.join(", ")
                          : String(value ?? "—")}
                      </p>
                    </Field>
                  )
                }
                const long = value.length > 90
                return (
                  <Field key={key}>
                    <FieldLabel htmlFor={`answer-${key}`}>
                      {humanizeKey(key)}
                    </FieldLabel>
                    {long ? (
                      <Textarea
                        id={`answer-${key}`}
                        value={value}
                        rows={4}
                        disabled={!editable}
                        onChange={(event) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <Input
                        id={`answer-${key}`}
                        value={value}
                        disabled={!editable}
                        onChange={(event) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </Field>
                )
              })}
            </div>
          ) : null}

          {canWithdraw(submission) ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">
                Can no longer speak?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Withdrawing tells the organizers to take this submission out of
                consideration. You can't undo it yourself.
              </p>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" className="mt-3" />
                  }
                >
                  Withdraw submission
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Withdraw "{submission.title}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      The organizers will see this submission as Withdrawn and
                      will stop reviewing it. Only they can put it back.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my submission</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleWithdraw}
                      disabled={isWithdrawing}
                    >
                      {isWithdrawing ? "Withdrawing…" : "Yes, withdraw it"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="participants" className="flex flex-col gap-3">
          {submission.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No participants have been added to this submission yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {submission.participants.map((participant, index) => (
                <li
                  key={`${participant.name}-${index}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {participant.name}
                    </p>
                    {participant.company ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {participant.company}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="secondary" className={cn("capitalize")}>
                    {participant.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            Need to add or swap a co-speaker? Reply to the organizers' email and
            they'll update it for you.
          </p>
        </TabsContent>
      </Tabs>
    </DrawerShell>
  )
}
