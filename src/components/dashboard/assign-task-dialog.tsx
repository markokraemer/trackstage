import { useEffect, useMemo, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
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

/** Task kinds accepted by `convex/tasksAdmin.ts`, in organizer language. */
export const TASK_KINDS = [
  {
    value: "upload",
    label: "Upload a file",
    help: "Slides, a headshot file, a signed form — anything you need back.",
  },
  {
    value: "profile",
    label: "Complete their profile",
    help: "Bio, job title, company and links on their speaker profile.",
  },
  {
    value: "headshot",
    label: "Upload a headshot",
    help: "A photo for the public agenda and speaker gallery.",
  },
  {
    value: "form",
    label: "Fill out a form",
    help: "Point them at a form to complete in their portal.",
  },
  {
    value: "confirm",
    label: "Confirm something",
    help: "A simple yes — attendance, travel, an agreement.",
  },
] as const

export interface AssignTaskSpeaker {
  personId: Id<"people">
  name: string
  email: string
  company?: string
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

  const createTask = useConvexMutation(api.tasksAdmin.create)

  // Reset the form each time the dialog opens so it never shows stale input.
  useEffect(() => {
    if (open) {
      setTitle("")
      setInstructions("")
      setKind("upload")
      setDueAt(undefined)
      setSearch("")
      setShowErrors(false)
      setSelected(initialPersonIds ? initialPersonIds.map(String) : [])
    }
  }, [open, initialPersonIds])

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

  const titleMissing = title.trim().length === 0
  const noSpeakers = selected.length === 0
  const kindHelp = TASK_KINDS.find((option) => option.value === kind)?.help

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
    if (titleMissing || noSpeakers) {
      setShowErrors(true)
      toast.error("Add a task title and pick at least one speaker")
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
      })
      onOpenChange(false)
      toast.success(
        `Task assigned to ${result.created} speaker${result.created === 1 ? "" : "s"}`,
        { description: `"${title.trim()}" is now in their speaker portal.` },
      )
    } catch (error) {
      toast.error("Couldn't assign the task", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>
            Tasks appear in the speaker's portal with your instructions and show
            up in your outstanding-task counts until they're done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="task-title">
                Task title<span className="required-asterisk">*</span>
              </FieldLabel>
              <FieldDescription>
                What the speaker sees at the top of the task.
              </FieldDescription>
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

            <Field>
              <FieldLabel htmlFor="task-kind">Task type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(value) => setKind(String(value))}
              >
                <SelectTrigger id="task-kind" className="w-full">
                  <SelectValue placeholder="Choose a task type" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_KINDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kindHelp ? (
                <FieldDescription>{kindHelp}</FieldDescription>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="task-instructions">Instructions</FieldLabel>
              <FieldDescription>
                Optional. Spell out exactly what you need — file format, length,
                anything easy to get wrong.
              </FieldDescription>
              <Textarea
                id="task-instructions"
                name="instructions"
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="PDF or Keynote, 16:9, no more than 30 slides."
              />
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
                  No accepted speakers yet. Accept a submission first — its
                  speakers land here automatically.
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
          </FieldGroup>

          <DialogFooter className="mt-6">
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
