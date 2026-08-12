import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiListCheck3 } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/dashboard/date-picker"
import { initialsOf } from "@/components/dashboard/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { errorMessage } from "@/lib/errors"

/**
 * What the speaker is being asked to do. The choice is not decoration — it
 * decides how the task can be completed, so each option says so out loud
 * rather than making an organizer guess what "kind" means.
 *
 * `form` used to be offered here and is deliberately gone: nothing in the
 * product ever read it, so it was a promise the portal couldn't keep. What
 * replaced it is `answer` — the same "ask them something" job, done in the one
 * shape a portal can actually complete: a question, a text box, an answer.
 */
export const TASK_KINDS = [
  {
    value: "upload",
    label: "Upload a file",
    help: "They attach a file in their portal — slides, a form, a rider.",
  },
  {
    value: "answer",
    label: "Collect an answer",
    help: "They type a reply to the question you write below.",
  },
  {
    value: "profile",
    label: "Update their profile",
    help: "Ticks itself off as soon as their bio is filled in.",
  },
  {
    value: "headshot",
    label: "Upload a headshot",
    help: "Ticks itself off the moment they upload a photo.",
  },
  {
    value: "confirm",
    label: "Confirm something",
    help: "One click to acknowledge — travel, AV needs, an agreement.",
  },
] as const

/** Sentinel for "no library task" — Base UI selects want a real value. */
const FROM_SCRATCH = "scratch"

/** Sentinel for "this task isn't about one particular session". */
const NO_SESSION = "none"

/**
 * The placeholders an organizer may drop into the instructions. Rendered per
 * speaker when the portal shows the task, so one wording reads personally for
 * everybody — Sessionboard's "Use Field", without the field picker.
 */
export const TASK_PLACEHOLDER_HINTS = [
  { token: "{{firstName}}", label: "their first name" },
  { token: "{{sessionTitle}}", label: "their session title" },
] as const

export interface AssignTaskSpeaker {
  personId: Id<"people">
  name: string
  email: string
  company?: string
  /** Their accepted sessions — the choices for "For session…". */
  sessions?: Array<{ _id: string; title: string }>
}

export interface AssignTaskDialogProps {
  eventId: Id<"events">
  speakers: Array<AssignTaskSpeaker>
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-ticked speakers (e.g. the rows selected in the roster). */
  initialPersonIds?: Array<Id<"people">>
}

/**
 * "Assign task" (docs/reference/sbek-rubric.md SPK-05 / CNT-01): an organizer
 * creates a task with instructions and a due date and assigns it to one or
 * many speakers. It lands in each speaker's portal immediately and shows up in
 * the outstanding-task counts on the dashboard.
 */
export function AssignTaskDialog({
  eventId,
  speakers,
  open,
  onOpenChange,
  initialPersonIds,
}: AssignTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [kind, setKind] = useState<string>("upload")
  const [dueAt, setDueAt] = useState<number | undefined>(undefined)
  const [selected, setSelected] = useState<Array<string>>([])
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [templateId, setTemplateId] = useState<string>(FROM_SCRATCH)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [submissionId, setSubmissionId] = useState<string>(NO_SESSION)

  const createTask = useConvexMutation(api.tasksAdmin.create)
  const { data: templates } = useQuery(
    convexQuery(api.tasksAdmin.listTemplates, { eventId }),
  )

  // "Start from scratch" plus every saved task, in one picker.
  const templateOptions = useMemo(
    () => [
      { value: FROM_SCRATCH, label: "Start from scratch" },
      ...(templates ?? []).map((template) => ({
        value: String(template.id),
        label: template.title,
      })),
    ],
    [templates],
  )

  // Reset the form each time the dialog opens so it never shows stale input.
  useEffect(() => {
    if (open) {
      setTitle("")
      setInstructions("")
      setKind("upload")
      setDueAt(undefined)
      setSearch("")
      setShowErrors(false)
      setTemplateId(FROM_SCRATCH)
      setSaveAsTemplate(false)
      setSubmissionId(NO_SESSION)
      setSelected(initialPersonIds ? initialPersonIds.map(String) : [])
    }
  }, [open, initialPersonIds])

  /**
   * Picking a saved task fills the form in — and leaves it editable, so a
   * one-off tweak never means editing the library copy.
   */
  function applyTemplate(nextId: string) {
    setTemplateId(nextId)
    if (nextId === FROM_SCRATCH) {
      setTitle("")
      setInstructions("")
      setKind("upload")
      return
    }
    const template = (templates ?? []).find((t) => String(t.id) === nextId)
    if (!template) return
    setTitle(template.alias?.trim() || template.title)
    setInstructions(template.instructions ?? "")
    setKind(template.kind)
    setSaveAsTemplate(false)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return speakers
    return speakers.filter(
      (speaker) =>
        speaker.name.toLowerCase().includes(term) ||
        speaker.email.toLowerCase().includes(term) ||
        (speaker.company ?? "").toLowerCase().includes(term),
    )
  }, [speakers, search])

  /**
   * "For session…" only offers sessions EVERY selected speaker is on: with one
   * speaker that is simply their sessions, with two co-speakers it is the talk
   * they share. Anything else would file a speaker's slides against a session
   * they aren't part of.
   */
  const sessionOptions = useMemo(() => {
    const rows = speakers.filter((speaker) =>
      selected.includes(String(speaker.personId)),
    )
    if (rows.length === 0) return []
    const shared = new Map<string, string>()
    for (const session of rows[0].sessions ?? []) {
      if (
        rows.every((row) =>
          (row.sessions ?? []).some((s) => s._id === session._id),
        )
      ) {
        shared.set(session._id, session.title)
      }
    }
    return [
      { value: NO_SESSION, label: "Not about a particular session" },
      ...[...shared.entries()].map(([value, label]) => ({ value, label })),
    ]
  }, [speakers, selected])

  // Drop a session choice that the current selection no longer shares.
  useEffect(() => {
    if (
      submissionId !== NO_SESSION &&
      !sessionOptions.some((option) => option.value === submissionId)
    ) {
      setSubmissionId(NO_SESSION)
    }
  }, [sessionOptions, submissionId])

  const titleMissing = title.trim().length === 0
  const noSpeakers = selected.length === 0
  const isAnswerKind = kind === "answer"
  /** An "answer" task with no question is a text box with nothing above it. */
  const questionMissing = isAnswerKind && instructions.trim().length === 0

  function toggle(personId: string, checked: boolean) {
    setSelected((current) =>
      checked
        ? current.includes(personId)
          ? current
          : [...current, personId]
        : current.filter((id) => id !== personId),
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (titleMissing || noSpeakers || questionMissing) {
      setShowErrors(true)
      toast.error(
        questionMissing && !titleMissing && !noSpeakers
          ? "Write the question you want them to answer"
          : "Add a task title and pick at least one speaker",
      )
      return
    }
    setSubmitting(true)
    try {
      const result = await createTask({
        eventId,
        personIds: selected as Array<Id<"people">>,
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        kind,
        dueAt,
        submissionId:
          submissionId === NO_SESSION
            ? undefined
            : (submissionId as Id<"submissions">),
        saveAsTemplate: saveAsTemplate || undefined,
      })
      onOpenChange(false)
      toast.success(
        `Task assigned to ${result.created} speaker${result.created === 1 ? "" : "s"}`,
        {
          description: saveAsTemplate
            ? `"${title.trim()}" is in their speaker portal and saved to your library.`
            : `"${title.trim()}" is now in their speaker portal.`,
        },
      )
    } catch (error) {
      toast.error("Couldn't assign the task", {
        description:
          errorMessage(error, "Please try again."),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bounded height with the fields scrolling inside: the header and the
          Assign button stay put however many speakers the event has. 90svh
          rather than 85 — this is a long form, and every extra pixel of the
          scroll region is a control someone doesn't have to go looking for. */}
      <DialogContent className="max-h-[90svh] grid-rows-[auto_minmax(0,1fr)] gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>
            Tasks appear in the speaker's portal with your instructions and show
            up in your outstanding-task counts until they're done.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void submit(event)}
          className="flex min-h-0 flex-col gap-4"
        >
          <FieldGroup className="-mr-2 min-h-0 flex-1 gap-4 overflow-y-auto pr-2">
            {templateOptions.length > 1 ? (
              <Field>
                <FieldLabel htmlFor="task-template">From your library</FieldLabel>
                <Select
                  items={templateOptions}
                  value={templateId}
                  onValueChange={(next) => applyTemplate(String(next))}
                >
                  <SelectTrigger id="task-template" aria-label="From your library">
                    {/* Always the task's NAME, never its id: the trigger
                        renders the raw value whenever the item list hasn't
                        arrived (or a saved task was renamed under it), and a
                        Convex id under the field is meaningless to an
                        organizer. Resolve the label ourselves and fall back to
                        the sentinel's wording. */}
                    <SelectValue>
                      {(value) =>
                        templateOptions.find(
                          (option) => option.value === String(value),
                        )?.label ?? "Start from scratch"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {templateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {/* The kind comes BEFORE the title on purpose, and its options are
                deliberately one line tall.

                Two reasons, one of them a bug we shipped. Logically the kind
                decides the shape of everything under it — it is what turns
                "Instructions" into "Your question" — so picking it first reads
                better than naming a task before deciding what it is. And
                practically: five two-line cards further down the form pushed the
                last two options past the bottom of this scroll region, where
                they still had layout boxes but were clipped out of view. A click
                aimed at their coordinates hit the form (or, past the panel edge,
                the dialog backdrop) and did nothing, so the choice was only
                reachable by scrolling or by keyboard. Kept short and kept high,
                every option is on screen the moment the dialog opens. */}
            <Field>
              <FieldLabel>What should the speaker do?</FieldLabel>
              <RadioGroup
                value={kind}
                onValueChange={(value) => setKind(String(value))}
                aria-label="What should the speaker do?"
                className="gap-2"
              >
                {TASK_KINDS.map((option) => {
                  const checked = kind === option.value
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors",
                        checked
                          ? "border-primary bg-accent/60 ring-1 ring-primary"
                          : "border-border hover:bg-accent/40",
                      )}
                    >
                      <RadioGroupItem
                        value={option.value}
                        className="mt-0.5"
                        aria-label={option.label}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {option.help}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="task-title">
                Task title<span className="required-asterisk">*</span>
              </FieldLabel>
              <Input
                id="task-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Upload your slides"
                aria-invalid={showErrors && titleMissing ? true : undefined}
                required
              />
            </Field>

            {/* For an "answer" task this field IS the question, so it stops
                being optional and says so — a text box under a blank question
                is the one thing a speaker cannot act on. */}
            <Field>
              <FieldLabel htmlFor="task-instructions">
                {isAnswerKind ? (
                  <>
                    Your question<span className="required-asterisk">*</span>
                  </>
                ) : (
                  "Instructions"
                )}
              </FieldLabel>
              <FieldDescription>
                {isAnswerKind
                  ? "What do you want to know? They see this above a text box in their portal, and their reply lands on their profile."
                  : "Optional. Spell out exactly what you need — file format, length, anything easy to get wrong."}
              </FieldDescription>
              <Textarea
                id="task-instructions"
                name="instructions"
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                aria-invalid={
                  showErrors && questionMissing ? true : undefined
                }
                placeholder={
                  isAnswerKind
                    ? "What size t-shirt do you wear, and do you have any dietary requirements?"
                    : "PDF or Keynote, 16:9, no more than 30 slides."
                }
              />
              {/* Personalisation, explained in plain English and one click
                  away — organizers shouldn't have to memorise the tokens. */}
              <FieldDescription className="flex flex-wrap items-center gap-1.5">
                <span>Personalise it:</span>
                {TASK_PLACEHOLDER_HINTS.map((hint) => (
                  <Button
                    key={hint.token}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 font-mono text-[11px]"
                    onClick={() =>
                      setInstructions((current) =>
                        current.length === 0
                          ? hint.token
                          : `${current.replace(/\s+$/, "")} ${hint.token}`,
                      )
                    }
                  >
                    {hint.token}
                  </Button>
                ))}
                <span>
                  becomes {TASK_PLACEHOLDER_HINTS.map((h) => h.label).join(" and ")}
                  , per speaker.
                </span>
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="task-due">Due date</FieldLabel>
              <FieldDescription>
                Optional. Speakers see this in their portal and reminders use it.
              </FieldDescription>
              <DatePicker
                id="task-due"
                value={dueAt}
                onValueChange={setDueAt}
                placeholder="Pick a due date"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="task-speaker-search">
                Assign to<span className="required-asterisk">*</span>
              </FieldLabel>
              <FieldDescription>
                {selected.length === 0
                  ? "Tick everyone who needs to do this."
                  : `${selected.length} of ${speakers.length} speaker${speakers.length === 1 ? "" : "s"} selected.`}
              </FieldDescription>

              {speakers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  Nobody on your roster yet. Everyone on a submission or session
                  lands here automatically — or add a speaker by hand.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="task-speaker-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search speakers…"
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelected(
                          selected.length === speakers.length
                            ? []
                            : speakers.map((speaker) => String(speaker.personId)),
                        )
                      }
                    >
                      {selected.length === speakers.length
                        ? "Clear all"
                        : "Select all"}
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "max-h-52 overflow-y-auto rounded-lg border border-border",
                      showErrors && noSpeakers && "border-destructive",
                    )}
                  >
                    {filtered.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No speaker matches "{search}".
                      </p>
                    ) : (
                      filtered.map((speaker) => {
                        const id = String(speaker.personId)
                        const checked = selected.includes(id)
                        return (
                          <label
                            key={id}
                            className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-accent/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggle(id, value === true)
                              }
                              aria-label={`Assign to ${speaker.name}`}
                            />
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px]">
                                {initialsOf(speaker.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-foreground">
                                {speaker.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {speaker.company || speaker.email}
                              </span>
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </Field>

            {/* Only worth asking once we know whose sessions to offer — and
                only when the selection actually shares one. */}
            {sessionOptions.length > 1 ? (
              <Field>
                <FieldLabel htmlFor="task-session">For session</FieldLabel>
                <FieldDescription>
                  Optional. Anything they upload for this task is filed against
                  that session, so you find it on the session's Files tab.
                </FieldDescription>
                <Select
                  items={sessionOptions}
                  value={submissionId}
                  onValueChange={(next) => setSubmissionId(String(next))}
                >
                  <SelectTrigger id="task-session" aria-label="For session">
                    {/* Session titles, never submission ids — same reason. */}
                    <SelectValue>
                      {(value) =>
                        sessionOptions.find(
                          (option) => option.value === String(value),
                        )?.label ?? "Not about a particular session"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sessionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-accent/40">
                <Checkbox
                  checked={saveAsTemplate}
                  onCheckedChange={(value) => setSaveAsTemplate(value === true)}
                  className="mt-0.5"
                  aria-label="Save this task to your library"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    Save this task to your library
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Keeps the title and instructions so you can assign the same
                    task again next time without retyping it.
                  </span>
                </span>
              </label>
            </Field>
          </FieldGroup>

          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || speakers.length === 0}>
              <RiListCheck3 aria-hidden />
              {submitting ? "Assigning…" : "Assign task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
