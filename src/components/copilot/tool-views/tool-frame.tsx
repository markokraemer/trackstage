import type { ReactNode } from "react"
import { RiArrowDownSLine, RiToolsLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { StatusPill } from "@/components/shared/status-pill"
import type {
  CopilotToolState,
  ToolIconComponent,
} from "@/components/copilot/tool-views/registry"

/**
 * The frame every tool call wears.
 *
 * The header row is the receipt — what the copilot did and how it went — and
 * the chevron toggles the RICH rendering underneath (the purpose-built view
 * from tool-views/registry.tsx), open by default. There is deliberately no
 * state that shows raw parameters or a JSON dump: Marko's 2026-08-11 verdict
 * was that "no normal non-technical user is gonna understand this", and he is
 * right — the rendered view IS the result, and collapsing it just quiets a
 * long chain down to its one-line receipts.
 *
 * The status chip is `StatusPill`, the same component the submissions table
 * uses — a tool call is just another thing with a state, and it should not
 * invent its own colour language (docs/memory/RULES.md #19).
 */

type ChipSpec = { status: string; label: string }

const STATE_CHIP: Record<CopilotToolState, ChipSpec> = {
  "input-streaming": { status: "draft", label: "Preparing" },
  "input-available": { status: "scheduled", label: "Running" },
  "approval-requested": { status: "pending", label: "Needs you" },
  "approval-responded": { status: "scheduled", label: "Approved" },
  "output-available": { status: "sent", label: "Done" },
  "output-error": { status: "failed", label: "Failed" },
  "output-denied": { status: "withdrawn", label: "Cancelled" },
}

export type ToolFrameProps = {
  /** Humanised tool title, e.g. "Commit decision queue". */
  title: string
  /** Raw tool name — kept as a DOM marker for tests, never shown as copy. */
  toolName: string
  state: CopilotToolState
  icon?: ToolIconComponent
  /**
   * A humanised one-liner for the header — the submission's title, "12
   * submissions" — derived from the RESULT, never a raw id. Optional: when
   * nothing humanizable exists the header shows nothing extra.
   */
  summary?: string | null
  /** Destructive tools carry an amber edge even after they've run. */
  emphasis?: boolean
  /** The rich rendered view. When absent the frame is just the header row. */
  children?: ReactNode
  className?: string
}

export function ToolFrame({
  title,
  toolName,
  state,
  icon: Icon = RiToolsLine,
  summary,
  emphasis = false,
  children,
  className,
}: ToolFrameProps) {
  const chip = STATE_CHIP[state]
  const running = state === "input-streaming" || state === "input-available"
  const hasBody = children !== undefined && children !== null

  const header = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          running && "animate-pulse"
        )}
      >
        <Icon size={14} />
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="shrink-0 truncate text-sm font-medium text-foreground">
          {title}
        </span>
        {summary ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            · {summary}
          </span>
        ) : null}
      </span>
      <StatusPill status={chip.status} label={chip.label} size="sm" />
    </>
  )

  if (!hasBody) {
    // Nothing rendered yet (still preparing/running) — a chevron with an
    // empty panel behind it would be a lie, so the frame is just the row.
    return (
      <div
        data-slot="tool-frame"
        data-tool={toolName}
        data-state-label={chip.label}
        className={cn(
          "w-full overflow-hidden rounded-lg border border-border bg-card",
          emphasis && "border-status-amber-dot/40",
          className
        )}
      >
        <div className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
          {header}
        </div>
      </div>
    )
  }

  return (
    <Collapsible
      defaultOpen
      data-slot="tool-frame"
      data-tool={toolName}
      data-state-label={chip.label}
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-card",
        emphasis && "border-status-amber-dot/40",
        className
      )}
    >
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        )}
      >
        {header}
        <RiArrowDownSLine
          size={16}
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border">
        <div className="p-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
