import { RiAlarmWarningLine, RiMailSendLine } from "@remixicon/react"

import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation"
import { Loader } from "@/components/ai-elements/loader"
import {
  humanizeToolName,
  isDestructiveTool,
  sendsEmail,
  summarizeToolArgs,
} from "@/lib/copilot"
import { ToolFrame } from "@/components/copilot/tool-views/tool-frame"
import {
  CopilotToolOutput,
  toolIcon,
} from "@/components/copilot/tool-views/registry"
import type { CopilotToolPart as ToolPart } from "@/components/copilot/tool-views/registry"
import { FieldGrid, ToolAlert } from "@/components/copilot/tool-views/shared"

/**
 * One tool call, rendered.
 *
 * Three jobs, and they are not the same job:
 *
 *  - the APPROVAL CARD, for destructive tools the server has suspended
 *    (`state: "approval-requested"`). This is the only thing standing between
 *    "the copilot suggested emailing 40 speakers" and "40 speakers got an
 *    email", so it leads with what will happen and to how many people, and
 *    the two buttons are unambiguous.
 *  - the RESULT, once the tool has run: a purpose-built rendering per tool
 *    (tool-views/registry.tsx) — a form card with a copyable public link, a
 *    submissions table, an agenda day summary — rather than JSON.
 *  - the RECEIPT above it: a collapsed frame naming the tool and its state,
 *    which expands to the exact arguments and the raw response.
 *
 * Tool parts arrive from `useChat` as `dynamic-tool` parts (our tools are
 * discovered from the MCP server at runtime), so everything keys off
 * `part.toolName`; static `tool-<name>` parts are handled too, for free.
 */

export type CopilotToolPart = ToolPart

function toolNameOf(part: ToolPart): string {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.slice("tool-".length)
}

export function CopilotToolPart({
  part,
  onApprovalResponse,
  disabled = false,
}: {
  part: ToolPart
  onApprovalResponse: (approvalId: string, approved: boolean) => void
  disabled?: boolean
}) {
  const toolName = toolNameOf(part)
  const label = humanizeToolName(toolName)
  const destructive = isDestructiveTool(toolName)
  const emails = sendsEmail(toolName)
  const Icon = toolIcon(toolName)

  // ——— The gate ————————————————————————————————————————————————————————
  if (part.state === "approval-requested") {
    // Auto-approvals (policy, not a person) still stream through this state;
    // there is nothing for the organizer to press.
    if (part.approval.isAutomatic) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader size={14} />
          Checking approval for {label.toLowerCase()}…
        </p>
      )
    }
    const args = summarizeToolArgs(part.input)
    return (
      <Confirmation
        approval={part.approval}
        state={part.state}
        className="border-status-amber-dot/40 bg-status-amber-bg/40"
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-status-amber-bg text-status-amber-fg"
          >
            {emails ? (
              <RiMailSendLine size={16} />
            ) : (
              <RiAlarmWarningLine size={16} />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <ConfirmationTitle className="block text-sm font-medium text-foreground">
              {label}
              {emails ? " — this sends real email" : ""}
            </ConfirmationTitle>
            {args.length > 0 ? (
              <FieldGrid entries={args} />
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

  const frame = (
    <ToolFrame
      title={label}
      toolName={toolName}
      state={part.state}
      icon={Icon}
      input={part.input}
      output={part.state === "output-available" ? part.output : undefined}
      errorText={part.state === "output-error" ? part.errorText : undefined}
      emphasis={destructive}
    />
  )

  if (part.state === "output-denied") {
    return (
      <div className="space-y-2">
        {frame}
        <p className="text-sm text-muted-foreground">
          Cancelled — nothing was changed.
        </p>
      </div>
    )
  }

  if (part.state === "output-error") {
    return (
      <div className="space-y-2">
        {frame}
        <ToolAlert title={`${label} failed`}>
          {part.errorText || "The tool returned an error."}
        </ToolAlert>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {frame}
      {part.state === "output-available" ? (
        <CopilotToolOutput
          toolName={toolName}
          input={part.input}
          output={part.output}
        />
      ) : null}
    </div>
  )
}
