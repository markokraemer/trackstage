import type { ReactNode } from "react"
import { RiArrowDownSLine, RiToolsLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { StatusPill } from "@/components/shared/status-pill"
import { FieldGrid, JsonBlock } from "@/components/copilot/tool-views/shared"
import { humanizeArgName, summarizeToolArgs } from "@/lib/copilot"
import type {
  CopilotToolState,
  ToolIconComponent,
} from "@/components/copilot/tool-views/registry"

/**
 * The frame every tool call wears.
 *
 * The rich rendering below it is the answer; this is the RECEIPT — proof of
 * what the copilot actually did, collapsed by default so a five-step chain
 * reads as five quiet lines instead of five walls of JSON. Expanding shows
 * the humanised arguments, then the raw request and response for anyone who
 * wants to check the model's homework.
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
  /** Raw tool name, shown in the expanded receipt. */
  toolName: string
  state: CopilotToolState
  icon?: ToolIconComponent
  input: unknown
  output?: unknown
  errorText?: string
  /** Destructive tools carry an amber edge even after they've run. */
  emphasis?: boolean
  /** Rendered inside the expanded body, above the raw payloads. */
  children?: ReactNode
  className?: string
}

export function ToolFrame({
  title,
  toolName,
  state,
  icon: Icon = RiToolsLine,
  input,
  output,
  errorText,
  emphasis = false,
  children,
  className,
}: ToolFrameProps) {
  const chip = STATE_CHIP[state]
  const args = summarizeToolArgs(input)
  const running = state === "input-streaming" || state === "input-available"

  return (
    <Collapsible
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
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
            running && "animate-pulse"
          )}
        >
          <Icon size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <StatusPill status={chip.status} label={chip.label} size="sm" />
        <RiArrowDownSLine
          size={16}
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border">
        <div className="space-y-3 p-3">
          {children}

          <Section label="Parameters">
            {args.length > 0 ? (
              <FieldGrid entries={args} />
            ) : (
              <p className="text-xs text-muted-foreground">No parameters.</p>
            )}
          </Section>

          {errorText ? (
            <Section label="Error">
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
                {errorText}
              </p>
            </Section>
          ) : null}

          {output !== undefined ? (
            <Section label={`Raw result · ${toolName}`}>
              <JsonBlock value={output} />
            </Section>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h4>
      {children}
    </div>
  )
}

/** Re-exported so the approval card labels its arguments identically. */
export { humanizeArgName }
