import { RiAlarmWarningLine, RiMailSendLine } from "@remixicon/react"
import type { DynamicToolUIPart, ToolUIPart } from "ai"

import { cn } from "@/lib/utils"
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import {
  humanizeToolName,
  isDestructiveTool,
  sendsEmail,
  summarizeToolArgs,
} from "@/lib/copilot"
import {
  CopilotJsonBlock,
  CopilotToolResult,
} from "@/components/copilot/copilot-tool-result"

/**
 * One tool call, rendered.
 *
 * Two jobs, and they are not the same job:
 *
 *  - the APPROVAL CARD, for destructive tools the server has suspended
 *    (`state: "approval-requested"`). This is the only thing standing between
 *    "the copilot suggested emailing 40 speakers" and "40 speakers got an
 *    email", so it leads with what will happen and to how many people, and
 *    the two buttons are unambiguous.
 *  - the RECEIPT, for everything else: a quiet collapsible row with the raw
 *    parameters and result, plus a rich rendering of the result when we know
 *    its shape (copilot-tool-result.tsx).
 */

export type CopilotToolPart = ToolUIPart | DynamicToolUIPart

function toolNameOf(part: CopilotToolPart): string {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.slice("tool-".length)
}

export function CopilotToolPart({
  part,
  onApprovalResponse,
  disabled = false,
}: {
  part: CopilotToolPart
  onApprovalResponse: (approvalId: string, approved: boolean) => void
  disabled?: boolean
}) {
  const toolName = toolNameOf(part)
  const label = humanizeToolName(toolName)
  const destructive = isDestructiveTool(toolName)
  const args = summarizeToolArgs(part.input)

  // ——— The gate ————————————————————————————————————————————————————————
  if (part.state === "approval-requested") {
    // Auto-approvals (policy, not a person) still stream through this state;
    // there is nothing for the organizer to press.
    if (part.approval.isAutomatic) {
      return (
        <p className="text-sm text-muted-foreground">
          Checking approval for {label.toLowerCase()}…
        </p>
      )
    }
    return (
      <Confirmation
        approval={part.approval}
        state={part.state}
        className="border-status-amber-dot/40 bg-status-amber-bg/50"
      >
        <div className="flex items-start gap-2">
          {sendsEmail(toolName) ? (
            <RiMailSendLine
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-status-amber-fg"
            />
          ) : (
            <RiAlarmWarningLine
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-status-amber-fg"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <ConfirmationTitle className="block font-medium text-foreground">
              {label}
              {sendsEmail(toolName) ? " — this sends real email" : ""}
            </ConfirmationTitle>
            {args.length > 0 ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                {args.map((entry) => (
                  <div key={entry.label} className="contents">
                    <dt className="text-muted-foreground">{entry.label}</dt>
                    <dd className="min-w-0 truncate font-medium text-foreground">
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">No parameters.</p>
            )}
          </div>
        </div>
        <ConfirmationActions>
          <ConfirmationAction
            variant="outline"
            disabled={disabled}
            onClick={() => onApprovalResponse(part.approval.id, false)}
          >
            Cancel
          </ConfirmationAction>
          <ConfirmationAction
            disabled={disabled}
            onClick={() => onApprovalResponse(part.approval.id, true)}
          >
            Approve &amp; run
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
  }

  if (part.state === "output-denied") {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> — cancelled,
        nothing was changed.
      </p>
    )
  }

  // ——— The receipt ———————————————————————————————————————————————————————
  const rich =
    part.state === "output-available" ? (
      <CopilotToolResult toolName={toolName} output={part.output} />
    ) : null

  return (
    <div className="space-y-2">
      <Tool
        className={cn(
          "group mb-0 border-border bg-card text-left",
          destructive && "border-status-amber-dot/40",
        )}
      >
        <ToolHeader
          title={label}
          type={`tool-${toolName}`}
          state={part.state}
          className="cursor-pointer px-3 py-2 hover:bg-muted/50"
        />
        <ToolContent className="border-t border-border">
          <ToolInput input={part.input} />
          {part.state === "output-available" ? (
            <div className="space-y-2 p-4 pt-0">
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Result
              </h4>
              <CopilotJsonBlock value={part.output} />
            </div>
          ) : null}
          {part.state === "output-error" ? (
            <ToolOutput output={undefined} errorText={part.errorText} />
          ) : null}
        </ToolContent>
      </Tool>
      {rich}
    </div>
  )
}
