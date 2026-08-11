import { useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { RiArrowDownSLine, RiCheckLine, RiSettings3Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusPill } from "@/components/shared/status-pill"
import type { SubmissionStatus } from "@/components/shared/status-pill"
import { resolveStatusOption, useStatusCatalog } from "@/lib/status-catalog"
import type { StatusOption } from "@/lib/status-catalog"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * Inline status editor for the submissions table (docs/ux/03 image13): click the
 * pill in the cell, click a status, done. **One click applies it** — there is no
 * Save/Cancel pair, because triage is a list of small decisions and a two-step
 * confirm on every row is the thing that made this feel like software from 2011.
 * The row updates optimistically and a toast is the receipt (Escape/click-away
 * cancels, and re-picking is one click away).
 *
 * That is safe precisely BECAUSE of the two-phase decision model: picking
 * "Accept Queue" only *stages* the decision — `submissions.setStatus` writes the
 * status and nothing else. Speakers hear nothing until the organizer commits the
 * queue from the banner (`commitQueue`), which is the real confirm step. The
 * quiet footnote in the popover says exactly that.
 *
 * The list comes from the event's status catalogue (Settings → Statuses), so a
 * renamed built-in and a custom status like "Waitlist" both show up here with
 * the organizer's own wording and colour. What gets written is still the
 * pipeline enum — see `src/lib/status-catalog.ts` for why. Editing the catalogue
 * is configuration, not picking, so it lives as a gear in the header rather than
 * as a third button competing with the choice itself.
 *
 * Extends the shadcn `Popover` + shared `StatusPill` primitives.
 */

export interface StatusChoice {
  /** The pipeline value written to `submissions.status`. */
  status: SubmissionStatus
  /** The custom label picked, when it isn't a plain built-in. */
  statusId?: string
  /** The organizer-facing name of the status picked — for the toast receipt. */
  label: string
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

/**
 * The toast receipt both call sites show after a pick. Queue statuses get the
 * caveat spelled out, because "Accept Queue" looking like a decision is exactly
 * the misread the two-phase model has to prevent.
 */
export function statusSavedMessage(choice: StatusChoice): string {
  if (choice.status === "accept_queue" || choice.status === "decline_queue") {
    return `Staged as ${choice.label}. Nothing emailed yet — send the queue when you're ready.`
  }
  return `Status set to ${choice.label}.`
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
  const { eventRef } = useCurrentEvent()
  const statusesSettingsLink = eventRef
    ? appLink.settingsSection(eventRef, "statuses")
    : legacyAppLink.settings
  const [open, setOpen] = useState(false)
  // What we just picked, shown on the trigger until the parent's data catches
  // up — so the pill never flashes back to the old status mid-write.
  const [optimistic, setOptimistic] = useState<StatusOption | null>(null)
  // Opening lands on the status the submission already has, not on the gear —
  // otherwise the first Tab stop is "leave this screen".
  const currentItemRef = useRef<HTMLButtonElement | null>(null)

  const server = resolveStatusOption(statuses, status, statusId)
  const current =
    optimistic && optionKey(optimistic) !== optionKey(server)
      ? optimistic
      : server

  async function pick(option: StatusOption) {
    setOpen(false)
    if (optionKey(option) === optionKey(current)) return
    setOptimistic(option)
    try {
      await onSave({
        status: option.pipelineStatus,
        // Built-ins carry no label — the pipeline value says it all, and
        // leaving the label off keeps the row clean.
        statusId: option.systemKey ? undefined : (option._id ?? undefined),
        label: option.name,
      })
    } finally {
      // Either the write landed (and `server` now matches) or it failed and the
      // caller has said so — either way the truth is the server's again.
      setOptimistic(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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

      <PopoverContent
        align="start"
        className="w-64 gap-0 p-1.5"
        initialFocus={currentItemRef}
      >
        <PopoverHeader className="flex-row items-center justify-between gap-2 px-1.5 pt-1 pb-2">
          <PopoverTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Status
          </PopoverTitle>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  to={statusesSettingsLink as never}
                  aria-label="Edit statuses"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon-xs",
                    className: "-mr-1 text-muted-foreground",
                  })}
                >
                  <RiSettings3Line aria-hidden />
                </Link>
              }
            />
            <TooltipContent>Edit statuses</TooltipContent>
          </Tooltip>
        </PopoverHeader>

        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {statuses.map((option) => {
            const isCurrent = optionKey(current) === optionKey(option)
            return (
              <button
                key={optionKey(option)}
                ref={isCurrent ? currentItemRef : undefined}
                type="button"
                aria-pressed={isCurrent}
                onClick={() => void pick(option)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left outline-none",
                  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                )}
              >
                <StatusPill
                  status={option.pipelineStatus}
                  label={option.name}
                  tone={option.color}
                  size="sm"
                />
                {isCurrent ? (
                  <RiCheckLine
                    size={16}
                    aria-hidden
                    className="mr-1 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        <p className="mt-1.5 border-t px-1.5 pt-2 pb-1 text-xs text-muted-foreground">
          Queue statuses don't email anyone until you send the queue.
        </p>
      </PopoverContent>
    </Popover>
  )
}
