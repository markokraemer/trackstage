import { useCallback, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { isToolUIPart } from "ai"
import type { UIMessage } from "ai"
import { RiErrorWarningLine, RiSparkling2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Loader } from "@/components/ai-elements/loader"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { CopilotToolPart } from "@/components/copilot/copilot-tool-part"
import { COPILOT_SUGGESTIONS } from "@/lib/copilot"
import { setCopilotEventContext, useCopilotChat } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * The copilot conversation (docs/memory/RULES.md #24).
 *
 * One component, two homes: the side panel (copilot-panel.tsx) and the
 * full-page chat (/app/copilot). Both mount this with the same `Chat`
 * instance out of src/lib/copilot-store.ts, so navigating away from a screen
 * — or from the panel to the full page — never loses the thread.
 *
 * Everything the model can do comes from our MCP server, and every
 * destructive call arrives here as an approval card the organizer has to
 * accept before anything happens (see copilot-tool-part.tsx).
 */

export type CopilotChatProps = {
  /** Full-page mode gets more air and a bigger empty state. */
  variant?: "panel" | "page"
  className?: string
  /** Rendered above the conversation on the empty state (page variant). */
  headline?: string
}

export function CopilotChat({
  variant = "panel",
  className,
  headline,
}: CopilotChatProps) {
  const { event } = useCurrentEvent()
  const { chat } = useCopilotChat(event?._id)

  // The transport reads this at send time, so the server always knows which
  // event the organizer is looking at (src/lib/copilot-store.ts).
  useEffect(() => {
    setCopilotEventContext({
      eventId: event?._id,
      eventName: event?.name,
      eventSlug: event?.slug,
    })
  }, [event?._id, event?.name, event?.slug])

  const { messages, sendMessage, status, error, addToolApprovalResponse, stop } =
    useChat<UIMessage>({ chat })

  const busy = status === "submitted" || status === "streaming"

  const submit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim()
      if (!text || busy) return
      void sendMessage({ text })
    },
    [busy, sendMessage],
  )

  const ask = useCallback(
    (text: string) => {
      if (busy) return
      void sendMessage({ text })
    },
    [busy, sendMessage],
  )

  const approve = useCallback(
    (approvalId: string, approved: boolean) => {
      addToolApprovalResponse({ id: approvalId, approved })
    },
    [addToolApprovalResponse],
  )

  const isEmpty = messages.length === 0
  const isPage = variant === "page"

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent
          className={cn("gap-6", isPage ? "mx-auto w-full max-w-3xl p-6" : "p-4")}
        >
          {isEmpty ? (
            <CopilotEmptyState
              variant={variant}
              headline={headline}
              eventName={event?.name}
              onPick={ask}
            />
          ) : null}

          {messages.map((message) => (
            <Message key={message.id} from={message.role} className="max-w-full">
              <MessageContent>
                {message.parts.map((part, index) => {
                  const key = `${message.id}-${index}`

                  if (part.type === "text") {
                    return part.text ? (
                      <MessageResponse key={key}>{part.text}</MessageResponse>
                    ) : null
                  }

                  if (part.type === "reasoning") {
                    return null
                  }

                  // Covers both static (`tool-<name>`) and dynamic tool parts.
                  if (isToolUIPart(part)) {
                    return (
                      <CopilotToolPart
                        key={key}
                        part={part}
                        disabled={busy}
                        onApprovalResponse={approve}
                      />
                    )
                  }

                  return null
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader size={14} />
              Thinking…
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <RiErrorWarningLine size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                {error.message || "The copilot hit an error. Try again."}
              </span>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        className={cn(
          "shrink-0 border-t border-border bg-card",
          isPage ? "px-6 py-4" : "p-3",
        )}
      >
        <div className={cn(isPage && "mx-auto w-full max-w-3xl")}>
          {!isEmpty ? (
            <Suggestions className="mb-2">
              {COPILOT_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  suggestion={suggestion}
                  disabled={busy}
                  onClick={ask}
                  className="h-7 text-xs"
                />
              ))}
            </Suggestions>
          ) : null}

          <PromptInput onSubmit={submit}>
            <PromptInputBody>
              <InputGroup>
                <PromptInputTextarea
                  placeholder={
                    event
                      ? `Ask about ${event.name}…`
                      : "Ask the Sessionboard copilot…"
                  }
                  className="min-h-16"
                />
                <InputGroupAddon align="block-end">
                  <span className="text-xs text-muted-foreground">
                    Runs on your Sessionboard MCP tools
                  </span>
                  {busy ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => stop()}
                    >
                      Stop
                    </Button>
                  ) : (
                    <PromptInputSubmit status={status} className="ml-auto" />
                  )}
                </InputGroupAddon>
              </InputGroup>
            </PromptInputBody>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

function CopilotEmptyState({
  variant,
  headline,
  eventName,
  onPick,
}: {
  variant: "panel" | "page"
  headline?: string
  eventName?: string
  onPick: (text: string) => void
}) {
  const isPage = variant === "page"
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        isPage ? "gap-4 py-16" : "gap-3 py-10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary/10 text-primary",
          isPage ? "size-14" : "size-11",
        )}
      >
        <RiSparkling2Line size={isPage ? 26 : 20} />
      </span>
      <div className="space-y-1">
        <h2
          className={cn(
            "font-heading font-semibold text-foreground",
            isPage ? "text-xl" : "text-base",
          )}
        >
          {headline ?? "Ask your Sessionboard copilot"}
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {eventName
            ? `It can read and change everything in ${eventName} — submissions, the agenda, speakers and their emails. Anything that emails people or decides someone's fate asks you first.`
            : "It can read and change everything in your events. Anything that emails people or decides someone's fate asks you first."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        {COPILOT_SUGGESTIONS.map((suggestion) => (
          <Suggestion
            key={suggestion}
            suggestion={suggestion}
            onClick={onPick}
            className="h-8 text-xs"
          />
        ))}
      </div>
    </div>
  )
}
