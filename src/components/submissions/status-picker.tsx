import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiRefreshLine,
  RiSettings3Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { StatusPill } from "@/components/shared/status-pill"
import type { SubmissionStatus } from "@/components/shared/status-pill"
import {
  resolveStatusOption,
  useStatusCatalog,
} from "@/lib/status-catalog"
import type { StatusOption } from "@/lib/status-catalog"

/**
 * Inline status editor for the submissions table (docs/ux/03 image13): click the
 * pill in the cell, pick a new one, confirm with Save. The selection is *staged*
 * — nothing is written until Save — so a misclick during fast triage is free.
 *
 * The list comes from the event's status catalogue (Settings → Statuses), so a
 * renamed built-in and a custom status like "Waitlist" both show up here with
 * the organizer's own wording and colour. What gets written is still the
 * pipeline enum — see `src/lib/status-catalog.ts` for why.
 *
 * Extends the shadcn `Popover` + shared `StatusPill` primitives.
 */

export interface StatusChoice {
  /** The pipeline value written to `submissions.status`. */
  status: SubmissionStatus
  /** The custom label picked, when it isn't a plain built-in. */
  statusId?: string
}

export interface StatusPickerProps {
  status: string
  /** The custom status label currently on the submission, if any. */
  statusId?: string | null
  /** Submission title — used for accessible labelling only. */
  title: string
  onSave: (next: StatusChoice) => void | Promise<void>
  disabled?: boolean
  className?: string
}

/** Stable identity for an option — custom rows by id, built-ins by status. */
function optionKey(option: StatusOption): string {
  return option._id ?? `system:${option.pipelineStatus}`
}

export function StatusPicker({
  status,
  statusId,
  title,
  onSave,
  disabled,
  className,
}: StatusPickerProps) {
  const { statuses } = useStatusCatalog()
  const [open, setOpen] = useState(false)
  const [staged, setStaged] = useState<StatusOption | null>(null)
  const [saving, setSaving] = useState(false)

  const current = resolveStatusOption(statuses, status, statusId)
  const selected = staged ?? current
  const dirty = staged !== null && optionKey(staged) !== optionKey(current)
  const pending =
    statuses.find((option) => option.systemKey === "pending") ?? current

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setStaged(null)
  }

  async function handleSave() {
    // `dirty` is only ever true when something is staged, so TypeScript
    // narrows `staged` to non-null from here on.
    if (!dirty) {
      handleOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await onSave({
        status: staged.pipelineStatus,
        // Built-ins carry no label — the pipeline value says it all, and
        // leaving the label off keeps the row clean.
        statusId: staged.systemKey ? undefined : (staged._id ?? undefined),
      })
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
            aria-label={`Change status of ${title} (currently ${current.name})`}
            className={cn(
              "-mx-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 outline-none",
              "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:opacity-60",
              className
            )}
          />
        }
      >
        <StatusPill
          status={current.pipelineStatus}
          label={current.name}
          tone={current.color}
          size="sm"
        />
        <RiArrowDownSLine
          size={14}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 gap-0 p-3">
        <PopoverHeader className="flex-row items-center justify-between gap-2">
          <PopoverTitle>Status</PopoverTitle>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setStaged(pending)}
            disabled={optionKey(selected) === optionKey(pending)}
          >
            <RiRefreshLine aria-hidden />
            Reset
          </Button>
        </PopoverHeader>
        <PopoverDescription className="mt-1">
          Pick a status, then save. Queue statuses don't email anyone yet.
        </PopoverDescription>

        <div className="mt-3 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {statuses.map((option) => {
            const isSelected = optionKey(selected) === optionKey(option)
            return (
              <button
                key={optionKey(option)}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setStaged(option)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left outline-none",
                  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected && "bg-accent hover:bg-accent"
                )}
              >
                <StatusPill
                  status={option.pipelineStatus}
                  label={option.name}
                  tone={option.color}
                  size="sm"
                />
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
          <StatusPill
            status={selected.pipelineStatus}
            label={selected.name}
            tone={selected.color}
            size="sm"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Link
            to="/app/settings/statuses"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <RiSettings3Line aria-hidden />
            Edit statuses
          </Link>
          <div className="flex items-center gap-2">
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
