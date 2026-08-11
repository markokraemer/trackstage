import { useState } from "react"
import { RiArrowDownSLine, RiCheckLine, RiRefreshLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { StatusPill, statusLabel } from "@/components/shared/status-pill"
import type { SubmissionStatus } from "@/components/shared/status-pill"

/**
 * Inline status editor for the submissions table (docs/ux/03 image13): click the
 * pill in the cell, pick a new one, confirm with Save. The selection is *staged*
 * — nothing is written until Save — so a misclick during fast triage is free.
 *
 * Extends the shadcn `Popover` + shared `StatusPill` primitives.
 */

/** Order shown in the picker — pipeline order, most-used first. */
const PICKER_ORDER: Array<SubmissionStatus> = [
  "accepted",
  "accept_queue",
  "pending",
  "decline_queue",
  "declined",
  "withdrawn",
  "draft",
]

export interface StatusPickerProps {
  status: string
  /** Submission title — used for accessible labelling only. */
  title: string
  onSave: (status: SubmissionStatus) => void | Promise<void>
  disabled?: boolean
  className?: string
}

export function StatusPicker({
  status,
  title,
  onSave,
  disabled,
  className,
}: StatusPickerProps) {
  const [open, setOpen] = useState(false)
  const [staged, setStaged] = useState<SubmissionStatus | null>(null)
  const [saving, setSaving] = useState(false)

  const current = status as SubmissionStatus
  const selected = staged ?? current
  const dirty = staged !== null && staged !== current

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setStaged(null)
  }

  async function handleSave() {
    if (!dirty) {
      handleOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await onSave(staged)
      handleOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            aria-label={`Change status of ${title} (currently ${statusLabel(status)})`}
            className={cn(
              "-mx-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 outline-none",
              "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:opacity-60",
              className
            )}
          />
        }
      >
        <StatusPill status={status} size="sm" />
        <RiArrowDownSLine
          size={14}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 gap-0 p-3">
        <PopoverHeader className="flex-row items-center justify-between gap-2">
          <PopoverTitle>Status</PopoverTitle>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setStaged("pending")}
            disabled={selected === "pending"}
          >
            <RiRefreshLine aria-hidden />
            Reset
          </Button>
        </PopoverHeader>
        <PopoverDescription className="mt-1">
          Pick a status, then save. Queue statuses don't email anyone yet.
        </PopoverDescription>

        <div className="mt-3 flex flex-col gap-0.5">
          {PICKER_ORDER.map((option) => {
            const isSelected = selected === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setStaged(option)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left outline-none",
                  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected && "bg-accent hover:bg-accent"
                )}
              >
                <StatusPill status={option} size="sm" />
                {isSelected ? (
                  <RiCheckLine
                    size={16}
                    aria-hidden
                    className="shrink-0 text-primary"
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <span>New status:</span>
          <StatusPill status={selected} size="sm" />
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
