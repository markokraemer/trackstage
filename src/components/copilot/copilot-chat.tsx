import { useCallback, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { isToolUIPart } from "ai"
import type { UIMessage } from "ai"
import { RiErrorWarningLine, RiSparkling2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { InputGroupAddon } from "@/components/ui/input-group"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Loader } from "@/components/ai-elements/loader"
import { MessageResponse } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { CopilotToolPart } from "@/components/copilot/copilot-tool-part"
import { COPILOT_SUGGESTIONS } from "@/lib/copilot"
import { setCopilotEventContext, useCopilotChat } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"
import { errorMessage } from "@/lib/errors"

/**
 * The copilot conversation (docs/memory/RULES.md #24).
 *
 * One component, two homes: the side panel (copilot-panel.tsx) and the
 * full-page chat (/app/copilot). Both mount this with the same `Chat`
 * instance out of src/lib/copilot-store.ts, so navigating away from a screen
 * — or from the panel to the full page — never loses the thread.
 *
 * THE CHROME IS SHADCN'S CHAT PRIMITIVES (June 2026 release), per rule #17:
 * `MessageScroller` owns the transcript's scroll behaviour — anchored turns,
 * following a streamed reply only while the reader is at the live edge, and a
 * jump-to-latest control — which is exactly the class of thing that is easy to
 * get subtly wrong by hand. `Message`/`Bubble` lay out the rows (user turns as
 * bubbles, assistant turns full-width so tables and tool cards get the width
 * they need) and `Marker` carries the system/status rows.
 *
 * AI ELEMENTS STAYS for the AI-specific parts shadcn deliberately does not
 * ship: the composer (`prompt-input`), the tool visualisation and the
 * approval `Confirmation` — see copilot-tool-part.tsx.
 *
 * Everything the model can do comes from our MCP server, and every
 * destructive call arrives here as an approval card the organizer has to
 * accept before anything happens.
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

  const {
    messages,
    sendMessage,
    status,
    error,
    addToolApprovalResponse,
    stop,
  } = useChat<UIMessage>({ chat })

  const busy = status === "submitted" || status === "streaming"

  // Typing past an approval card is an answer: decline it. Without this, the
  // pending tool call never gets a result and the NEXT request dies with
  // "Tool result is missing for tool call …" — the organizer ignoring a card
  // must never break the conversation.
  const declinePendingApprovals = useCallback(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          isToolUIPart(part) &&
          part.state === "approval-requested" &&
          !part.approval.isAutomatic
        ) {
          addToolApprovalResponse({ id: part.approval.id, approved: false })
        }
      }
    }
  }, [messages, addToolApprovalResponse])

  const submit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim()
      if (!text || busy) return
      declinePendingApprovals()
      void sendMessage({ text })
    },
    [busy, sendMessage, declinePendingApprovals]
  )

  const ask = useCallback(
    (text: string) => {
      if (busy) return
      declinePendingApprovals()
      void sendMessage({ text })
    },
    [busy, sendMessage, declinePendingApprovals]
  )

  const approve = useCallback(
    (approvalId: string, approved: boolean) => {
      addToolApprovalResponse({ id: approvalId, approved })
    },
    [addToolApprovalResponse]
  )

  const isEmpty = messages.length === 0
  const isPage = variant === "page"

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <MessageScrollerProvider
        autoScroll
        defaultScrollPosition="last-anchor"
        scrollPreviousItemPeek={64}
      >
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent
              aria-busy={status === "streaming"}
              className={cn(
                "gap-6",
                isPage ? "mx-auto w-full max-w-3xl p-6" : "p-4"
              )}
            >
              {isEmpty ? (
                <CopilotEmptyState
                  variant={variant}
                  headline={headline}
                  eventName={event?.name}
                  onPick={ask}
                />
              ) : null}

              {messages.map((message) => {
                const isUser = message.role === "user"
                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={isUser}
                  >
                    <Message align={isUser ? "end" : "start"}>
                      <MessageContent>
                        {isUser ? (
                          <Bubble variant="tinted" align="end">
                            <BubbleContent>
                              {message.parts
                                .map((part) =>
                                  part.type === "text" ? part.text : ""
                                )
                                .join("")}
                            </BubbleContent>
                          </Bubble>
                        ) : (
                          message.parts.map((part, index) => {
                            const key = `${message.id}-${index}`

                            if (part.type === "text") {
                              return part.text ? (
                                <MessageResponse key={key}>
                                  {part.text}
                                </MessageResponse>
                              ) : null
                            }

                            if (part.type === "reasoning") return null

                            // Covers static (`tool-<name>`) and dynamic parts.
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
                          })
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )
              })}

              {status === "submitted" ? (
                <MessageScrollerItem messageId="copilot-status">
                  <Marker role="status">
                    <MarkerIcon>
                      <Loader size={14} />
                    </MarkerIcon>
                    <MarkerContent className="shimmer">Thinking…</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}

              {error ? (
                <MessageScrollerItem messageId="copilot-error">
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <RiErrorWarningLine
                      size={16}
                      aria-hidden
                      className="mt-0.5 shrink-0"
                    />
                    <span className="min-w-0">
                      {errorMessage(error, "The copilot hit an error. Try again.")}
                    </span>
                  </div>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div
        className={cn(
          "shrink-0 border-t border-border bg-card",
          isPage ? "px-6 py-4" : "p-3"
        )}
      >
        <div className={cn("space-y-2", isPage && "mx-auto w-full max-w-3xl")}>
          {!isEmpty ? (
            <Suggestions>
              {COPILOT_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  suggestion={suggestion}
                  disabled={busy}
                  onClick={ask}
                  className="h-7 rounded-full text-xs"
                />
              ))}
            </Suggestions>
          ) : null}

          {/*
            NO `PromptInputBody` here, deliberately. It renders
            `display: contents`, which flattens the LAYOUT tree but not the DOM
            tree — and `InputGroup`'s styling is driven by `:has(> …)` selectors
            that only see real DOM children. Wrapping the composer in it makes
            the group miss its own textarea and block-end addon, and the input
            collapses into the 24px-wide sliver Marko screenshotted. The
            textarea and the toolbar must be direct children of `PromptInput`.
          */}
          <PromptInput onSubmit={submit} className="rounded-xl">
            <PromptInputTextarea
              placeholder={
                event
                  ? `Ask about ${event.name}…`
                  : "Ask the Trackstage copilot…"
              }
              className="max-h-40 min-h-11 px-3 py-2.5 text-sm"
            />
            <InputGroupAddon align="block-end" className="gap-2">
              <span className="truncate text-xs text-muted-foreground">
                Runs on your Trackstage MCP tools
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
        isPage ? "gap-4 py-16" : "gap-3 py-10"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary/10 text-primary",
          isPage ? "size-14" : "size-11"
        )}
      >
        <RiSparkling2Line size={isPage ? 26 : 20} />
      </span>
      <div className="space-y-1">
        <h2
          className={cn(
            "font-heading font-semibold text-foreground",
            isPage ? "text-xl" : "text-base"
          )}
        >
          {headline ?? "Ask your Trackstage copilot"}
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
            className="h-8 rounded-full text-xs"
          />
        ))}
      </div>
    </div>
  )
}
