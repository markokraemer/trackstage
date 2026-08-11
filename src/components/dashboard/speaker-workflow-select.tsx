/**
 * Speaker workflow status (sbek SPK-04): invited → confirmed → dropped.
 *
 * Deliberately an inline control rather than a drawer field — the whole point
 * of a workflow column is that an organizer can walk the roster and change
 * three people's states without opening anything. Saves on change, reports
 * failures, and reads as a status chip the rest of the time.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const WORKFLOW_STATUSES = ["invited", "confirmed", "dropped"] as const

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  invited: "Invited",
  confirmed: "Confirmed",
  dropped: "Dropped",
}

const DOT_CLASS: Record<WorkflowStatus, string> = {
  invited: "bg-status-amber-dot",
  confirmed: "bg-status-green-dot",
  dropped: "bg-status-red-dot",
}

export const WORKFLOW_OPTIONS = WORKFLOW_STATUSES.map((value) => ({
  value,
  label: WORKFLOW_LABELS[value],
}))

export function isWorkflowStatus(value: string): value is WorkflowStatus {
  return (WORKFLOW_STATUSES as ReadonlyArray<string>).includes(value)
}

export interface SpeakerWorkflowSelectProps {
  personId: Id<"people">
  value: string
  name: string
  className?: string
}

export function SpeakerWorkflowSelect({
  personId,
  value,
  name,
  className,
}: SpeakerWorkflowSelectProps) {
  const setStatus = useConvexMutation(api.speakersAdmin.setWorkflowStatus)
  const [pending, setPending] = React.useState(false)
  const current: WorkflowStatus = isWorkflowStatus(value) ? value : "confirmed"

  async function change(next: string) {
    if (!isWorkflowStatus(next) || next === current) return
    setPending(true)
    try {
      await setStatus({ personId, workflowStatus: next })
      toast.success(`${name} marked ${WORKFLOW_LABELS[next].toLowerCase()}`)
    } catch (error) {
      toast.error("Couldn't update the status", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Select
      items={WORKFLOW_OPTIONS}
      value={current}
      onValueChange={(next) => void change(String(next))}
      disabled={pending}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Workflow status for ${name}`}
        className={cn("w-34 gap-1.5 text-xs", className)}
      >
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", DOT_CLASS[current])}
        />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORKFLOW_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
