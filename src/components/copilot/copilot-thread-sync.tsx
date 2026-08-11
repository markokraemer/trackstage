import { useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { copilotThreadTitle } from "@/lib/copilot"
import {
  adoptCopilotThread,
  copilotSavedSignature,
  forgetCopilotThread,
  hydrateCopilotThread,
  setCopilotSavedSignature,
  useCopilotChat,
} from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * The bridge between the live conversation and its saved row
 * (convex/copilotThreads.ts). Renders nothing; it exists to do two jobs.
 *
 * AUTOSAVE — the organizer never presses save. When a turn finishes streaming
 * the transcript is written down, debounced, and the row is created on the
 * first turn (so "New chat" alone leaves no trace). Nothing is written while a
 * reply is still streaming: half a message in the database is worse than none,
 * and the finished one is a few hundred milliseconds away.
 *
 * HYDRATION — clicking a chat in the rail switches the store instantly and
 * this fills the transcript in behind it, from the react-query cache on any
 * revisit.
 *
 * MOUNTED EXACTLY ONCE, in the app shell next to the panel (see
 * copilot-panel.tsx). Both the panel and the full page can be on screen at the
 * same time, and two of these would race each other into two rows for one
 * conversation.
 */
export function CopilotThreadSync() {
  const { event } = useCurrentEvent()
  const eventId = event?._id
  const { chat, threadId, pending } = useCopilotChat(eventId)
  const { messages, status } = useChat<UIMessage>({ chat })

  const save = useConvexMutation(api.copilotThreads.save)

  // ——— Hydration ————————————————————————————————————————————————————————
  const { data: stored, isError } = useQuery(
    convexQuery(
      api.copilotThreads.get,
      threadId && pending
        ? { threadId: threadId as Id<"copilotThreads"> }
        : "skip"
    )
  )

  useEffect(() => {
    if (!threadId || !pending) return
    if (stored === undefined) return
    if (stored === null || isError) {
      // Deleted in another tab, or never ours — don't strand the organizer in
      // a conversation that no longer exists.
      forgetCopilotThread(eventId, threadId)
      return
    }
    const restored = stored.messages as Array<UIMessage>
    hydrateCopilotThread(
      eventId,
      threadId,
      restored,
      JSON.stringify(serialize(restored))
    )
  }, [eventId, threadId, pending, stored, isError])

  // ——— Autosave —————————————————————————————————————————————————————————
  const inFlight = useRef(false)

  useEffect(() => {
    // Streaming, or a transcript we haven't finished reading back: not ours to
    // write yet.
    if (pending) return
    if (status === "streaming" || status === "submitted") return
    if (messages.length === 0) return

    const payload = serialize(messages)
    const signature = JSON.stringify(payload)
    if (copilotSavedSignature(chat.id) === signature) return

    let done = false
    const persist = async () => {
      if (done || inFlight.current) return
      done = true
      inFlight.current = true
      // Claim the signature before the round trip so a re-render mid-flight
      // doesn't queue the same write twice.
      setCopilotSavedSignature(chat.id, signature)
      try {
        const result = await save({
          // The store speaks in plain strings — an id it never has to resolve
          // is not worth a Convex type dependency.
          threadId: threadId ? (threadId as Id<"copilotThreads">) : undefined,
          eventId,
          messages: payload,
          title: copilotThreadTitle(
            payload as Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>
          ),
        })
        if (!threadId) adoptCopilotThread(eventId, chat, result.threadId)
      } catch {
        // Let the next turn try again rather than nagging the organizer about
        // a background save.
        setCopilotSavedSignature(chat.id, "")
      } finally {
        inFlight.current = false
      }
    }

    const timer = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      // Switching chats (or unmounting) must not lose the last turn.
      void persist()
    }
  }, [chat, eventId, messages, pending, save, status, threadId])

  return null
}

/** Long enough to coalesce a burst, short enough to survive a tab close. */
const SAVE_DEBOUNCE_MS = 500

/**
 * Convex stores plain JSON. A round trip through `JSON` drops `undefined`
 * fields and anything non-serialisable the SDK hung off a message, which is
 * exactly the normalisation the validator expects.
 */
function serialize(messages: Array<UIMessage>): Array<unknown> {
  return JSON.parse(JSON.stringify(messages)) as Array<unknown>
}
