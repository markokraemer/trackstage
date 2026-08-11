import { RiAttachment2 } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/shared/status-pill"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MESSAGE_STATUS_META } from "./constants"

/**
 * Outbox status pill — the shared `StatusPill` with the message-delivery tone
 * map layered on top (docs/SPEC.md §4.9): Sent green · Preview blue ·
 * Scheduled amber · Failed red. Failures carry the provider error in a tooltip
 * so an organizer never has to guess why an email did not land.
 */

/** Tone overrides for statuses the shared pill does not know about. */
const TONE_OVERRIDE: Record<string, string | undefined> = {
  scheduled:
    "bg-status-amber-bg text-status-amber-fg [&>span[aria-hidden]]:bg-status-amber-dot",
  sending:
    "bg-status-blue-bg text-status-blue-fg [&>span[aria-hidden]]:bg-status-blue-dot",
  preview:
    "bg-status-blue-bg text-status-blue-fg [&>span[aria-hidden]]:bg-status-blue-dot",
}

export interface MessageStatusPillProps {
  status: string
  /** Provider error, shown in a tooltip on failed messages. */
  error?: string
  size?: "sm" | "default"
  className?: string
}

export function MessageStatusPill({
  status,
  error,
  size = "default",
  className,
}: MessageStatusPillProps) {
  const meta = MESSAGE_STATUS_META[status]
  const pill = (
    <StatusPill
      status={status}
      label={meta?.label}
      size={size}
      className={cn(TONE_OVERRIDE[status], className)}
    />
  )

  const tip = status === "failed" && error ? error : meta?.help
  if (!tip) return pill

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex cursor-help align-middle" />}
      >
        {pill}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}

/** Paperclip marker for messages that carry a calendar invite. */
export function IcsAttachmentIcon({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground",
              className,
            )}
          />
        }
      >
        <RiAttachment2 size={15} aria-hidden />
        <span className="sr-only">Calendar invite attached</span>
      </TooltipTrigger>
      <TooltipContent>Calendar invite (.ics) attached</TooltipContent>
    </Tooltip>
  )
}
