import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"
import {
  RiAddLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiInformationLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  statusLabel,
  StatusPill,
  SUBMISSION_STATUS_OPTIONS,
} from "@/components/shared/status-pill"
import { DatePickerField } from "@/components/evaluation/date-picker-field"

/**
 * "New evaluation plan" (docs/SPEC.md §4.5). One dialog does the whole job:
 * name the round, decide what's being scored, pick the submissions, invite the
 * evaluators, set a due date. Every control is a real component — selects,
 * checkboxes, a calendar — never a raw text box for structured data.
 */

interface CriterionDraft {
  key: string
  label: string
}

const DEFAULT_CRITERIA: Array<CriterionDraft> = [
  { key: "c1", label: "Overall" },
  { key: "c2", label: "Relevance" },
]

let criterionSeq = 2
function nextCriterionKey(): string {
  criterionSeq += 1
  return `c${criterionSeq}`
}

/** Stable, human-readable criterion id derived from the label. */
function criterionId(label: string, index: number, seen: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `criterion-${index + 1}`
  let id = base
  let suffix = 2
  while (seen.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  seen.add(id)
  return id
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export interface NewPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: Id<"events">
  /** Suggested round number (highest existing round + 1). */
  nextRound: number
  onCreated?: (planId: Id<"evaluationPlans">) => void
}

export function NewPlanDialog({
  open,
  onOpenChange,
  eventId,
  nextRound,
  onCreated,
}: NewPlanDialogProps) {
  const [name, setName] = useState(`Round ${nextRound} review`)
  const [round, setRound] = useState(String(nextRound))
  const [criteria, setCriteria] =
    useState<Array<CriterionDraft>>(DEFAULT_CRITERIA)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [trackFilter, setTrackFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Array<string>>([])
  const [emails, setEmails] = useState<Array<string>>([])
  const [emailDraft, setEmailDraft] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [blind, setBlind] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seeded = useRef(false)

  const { data: submissions } = useQuery(
    convexQuery(api.submissions.list, open ? { eventId } : "skip"),
  )

  // Fresh dialog every time it opens.
  useEffect(() => {
    if (open) return
    seeded.current = false
    setName(`Round ${nextRound} review`)
    setRound(String(nextRound))
    setCriteria(DEFAULT_CRITERIA)
    setStatusFilter("pending")
    setTrackFilter("all")
    setSearch("")
    setSelected([])
    setEmails([])
    setEmailDraft("")
    setDueDate(undefined)
    setBlind(false)
    setError(null)
  }, [open, nextRound])

  // Sensible default: everything still Pending is what usually goes to review.
  useEffect(() => {
    if (!open || seeded.current || !submissions) return
    seeded.current = true
    setSelected(
      submissions.filter((s) => s.status === "pending").map((s) => s._id),
    )
  }, [open, submissions])

  const tracks = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    for (const submission of submissions ?? []) {
      if (submission.track) {
        map.set(submission.track._id, {
          id: submission.track._id,
          name: submission.track.name,
          color: submission.track.color,
        })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [submissions])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (submissions ?? []).filter((submission) => {
      if (statusFilter !== "all" && submission.status !== statusFilter) {
        return false
      }
      if (trackFilter !== "all" && submission.track?._id !== trackFilter) {
        return false
      }
      if (needle && !submission.title.toLowerCase().includes(needle)) {
        return false
      }
      return true
    })
  }, [submissions, statusFilter, trackFilter, search])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const createPlan = useMutation({
    mutationFn: useConvexMutation(api.evaluationsAdmin.createPlan),
  })

  function toggle(submissionId: string) {
    setSelected((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId],
    )
  }

  function commitEmail(raw: string) {
    const parts = raw
      .split(/[,\s;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
    if (parts.length === 0) return
    const invalid = parts.filter((part) => !isEmail(part))
    if (invalid.length > 0) {
      setError(`"${invalid[0]}" doesn't look like an email address.`)
      return
    }
    setEmails((current) => [...new Set([...current, ...parts])])
    setEmailDraft("")
    setError(null)
  }

  function submit() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Give the plan a name so you can tell rounds apart.")
      return
    }
    const labelled = criteria.filter((c) => c.label.trim().length > 0)
    if (labelled.length === 0) {
      setError("Add at least one thing for evaluators to score.")
      return
    }
    if (selected.length === 0) {
      setError("Pick at least one submission for evaluators to review.")
      return
    }

    // A half-typed email in the box should still count — organizers forget to
    // press Add.
    const pendingDraft = emailDraft.trim().toLowerCase()
    if (pendingDraft && !isEmail(pendingDraft)) {
      setError(`"${pendingDraft}" doesn't look like an email address.`)
      return
    }
    const evaluatorEmails = [
      ...new Set([...emails, ...(pendingDraft ? [pendingDraft] : [])]),
    ]

    const seen = new Set<string>()
    const due = dueDate ? new Date(dueDate) : undefined
    if (due) due.setHours(23, 59, 0, 0)

    createPlan.mutate(
      {
        eventId,
        name: trimmedName,
        round: Number(round),
        criteria: labelled.map((criterion, index) => ({
          id: criterionId(criterion.label, index, seen),
          label: criterion.label.trim(),
        })),
        submissionIds: selected as Array<Id<"submissions">>,
        evaluatorEmails,
        dueAt: due ? due.getTime() : undefined,
        blind,
      },
      {
        onSuccess: (planId) => {
          toast.success("Evaluation plan created", {
            description:
              evaluatorEmails.length > 0
                ? `Copy each evaluator's review link to invite them.`
                : "Add evaluators next to start collecting scores.",
          })
          onOpenChange(false)
          onCreated?.(planId)
        },
        onError: (mutationError: Error) => {
          setError(mutationError.message)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle>New evaluation plan</DialogTitle>
          <DialogDescription>
            A plan is one round of scoring: the submissions being reviewed, the
            people reviewing them, and what they score out of 5.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <FieldGroup className="gap-6">
            <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
              <Field>
                <FieldLabel htmlFor="plan-name">
                  Plan name
                  <span className="required-asterisk">*</span>
                </FieldLabel>
                <FieldDescription>
                  Something you'll recognise later, e.g. "First pass — AI track".
                </FieldDescription>
                <Input
                  id="plan-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Round 1 review"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="plan-round">Round</FieldLabel>
                <FieldDescription>Run one plan per round.</FieldDescription>
                <Select
                  value={round}
                  onValueChange={(value) => setRound(String(value))}
                >
                  <SelectTrigger id="plan-round" className="w-full">
                    <SelectValue>
                      {(value: string) => `Round ${value}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        Round {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Criteria */}
            <Field>
              <FieldLabel>
                What evaluators score
                <span className="required-asterisk">*</span>
              </FieldLabel>
              <FieldDescription>
                Each line becomes a 1–5 rating on the evaluator's screen.
              </FieldDescription>
              <div className="space-y-2">
                {criteria.map((criterion, index) => (
                  <div key={criterion.key} className="flex items-center gap-2">
                    <Input
                      value={criterion.label}
                      aria-label={`Scoring criterion ${index + 1}`}
                      placeholder="e.g. Speaker experience"
                      onChange={(event) =>
                        setCriteria((current) =>
                          current.map((item) =>
                            item.key === criterion.key
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove criterion ${criterion.label || index + 1}`}
                      disabled={criteria.length === 1}
                      onClick={() =>
                        setCriteria((current) =>
                          current.filter((item) => item.key !== criterion.key),
                        )
                      }
                    >
                      <RiDeleteBinLine aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCriteria((current) => [
                      ...current,
                      { key: nextCriterionKey(), label: "" },
                    ])
                  }
                >
                  <RiAddLine aria-hidden />
                  Add criterion
                </Button>
              </div>
            </Field>

            {/* Submissions */}
            <Field>
              <FieldLabel>
                Submissions to review
                <span className="required-asterisk">*</span>
              </FieldLabel>
              <FieldDescription>
                Everything still Pending is selected for you — narrow it down by
                track or status if you only want part of the pool.
              </FieldDescription>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search titles…"
                  aria-label="Search submissions"
                  className="w-full sm:w-56"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(String(value))}
                >
                  <SelectTrigger aria-label="Filter by status" className="w-40">
                    <SelectValue>
                      {(value: string) =>
                        value === "all" ? "All statuses" : statusLabel(value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {SUBMISSION_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={trackFilter}
                  onValueChange={(value) => setTrackFilter(String(value))}
                >
                  <SelectTrigger aria-label="Filter by track" className="w-40">
                    <SelectValue>
                      {(value: string) =>
                        value === "all"
                          ? "All tracks"
                          : (tracks.find((track) => track.id === value)?.name ??
                            "All tracks")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tracks</SelectItem>
                    {tracks.map((track) => (
                      <SelectItem key={track.id} value={track.id}>
                        {track.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{selected.length} selected</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelected((current) => [
                      ...new Set([...current, ...visible.map((s) => s._id)]),
                    ])
                  }
                >
                  Select all {visible.length} shown
                </Button>
                {selected.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected([])}
                  >
                    Clear selection
                  </Button>
                ) : null}
              </div>

              <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border">
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {submissions
                      ? "No submissions match these filters."
                      : "Loading submissions…"}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {visible.map((submission) => (
                      <li key={submission._id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/60",
                            selectedSet.has(submission._id) && "bg-accent/50",
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={selectedSet.has(submission._id)}
                            onCheckedChange={() => toggle(submission._id)}
                            aria-label={`Include ${submission.title}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {submission.title}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2">
                              <StatusPill status={submission.status} size="sm" />
                              {submission.track ? (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span
                                    aria-hidden
                                    className="size-2 rounded-full"
                                    style={{
                                      backgroundColor: submission.track.color,
                                    }}
                                  />
                                  {submission.track.name}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>

            {/* Evaluators */}
            <Field>
              <FieldLabel htmlFor="plan-evaluator">Evaluators</FieldLabel>
              <FieldDescription>
                Add the email of everyone reviewing. Each one gets their own
                private review link — no account, no password.
              </FieldDescription>
              <div className="flex items-center gap-2">
                <Input
                  id="plan-evaluator"
                  type="email"
                  value={emailDraft}
                  placeholder="reviewer@example.com"
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault()
                      commitEmail(emailDraft)
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => commitEmail(emailDraft)}
                >
                  <RiAddLine aria-hidden />
                  Add
                </Button>
              </div>
              {emails.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {emails.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="gap-1 pr-1 pl-2.5"
                    >
                      {email}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${email}`}
                        onClick={() =>
                          setEmails((current) =>
                            current.filter((item) => item !== email),
                          )
                        }
                      >
                        <RiCloseLine aria-hidden />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Field>

            {/* Due date */}
            <Field>
              <FieldLabel htmlFor="plan-due">Due date</FieldLabel>
              <FieldDescription>
                Shown to evaluators on their review page. Optional.
              </FieldDescription>
              <DatePickerField
                id="plan-due"
                value={dueDate}
                onChange={setDueDate}
                placeholder="No due date"
                aria-label="Plan due date"
                className="max-w-xs"
              />
            </Field>

            {/* Blind review (sbek ABS-07) */}
            <Field
              orientation="horizontal"
              className="items-start justify-between gap-6 rounded-lg border border-border p-4"
            >
              <div className="min-w-0">
                <FieldLabel htmlFor="plan-blind">Blind review</FieldLabel>
                <FieldDescription>
                  Evaluators won't see who submitted — names, job titles and
                  companies are stripped from their review page.
                </FieldDescription>
              </div>
              <Switch
                id="plan-blind"
                checked={blind}
                onCheckedChange={(value) => setBlind(Boolean(value))}
              />
            </Field>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-status-red-bg px-3 py-2 text-sm text-status-red-fg"
              >
                <RiInformationLine size={16} aria-hidden className="mt-0.5" />
                {error}
              </p>
            ) : null}
          </FieldGroup>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={createPlan.isPending}
          >
            {createPlan.isPending ? "Creating…" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
