import { useCallback, useSyncExternalStore } from "react"
import { Chat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai"
import type { UIMessage } from "ai"

import { readCopilotContext } from "@/lib/copilot-context"

/**
 * Copilot conversation state, deliberately OUTSIDE the React tree.
 *
 * The copilot lives in two places at once — a side panel that must survive
 * navigation between organizer screens, and a full-page chat at
 * /app/copilot — and both must be the SAME conversation. A hook-local
 * `useChat` would reset on every route change, so the `Chat` instances live in
 * a module-level registry and the components subscribe to them via
 * `useChat({ chat })`. Same pattern (and same reasoning) as
 * src/lib/current-event.ts: an external store, one source of truth, every
 * reader re-renders together.
 *
 * Conversations are keyed by event: switching events starts a fresh chat,
 * because "how many submissions do I have?" means something different on the
 * other side of the switcher.
 */

const API_ENDPOINT = "/api/chat"

// ——— Panel visibility ———————————————————————————————————————————————————

const listeners = new Set<() => void>()
let panelOpen = false

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setCopilotPanelOpen(open: boolean): void {
  if (panelOpen === open) return
  panelOpen = open
  notify()
}

export function toggleCopilotPanel(): void {
  setCopilotPanelOpen(!panelOpen)
}

/** Panel open/close, readable and writable from anywhere in the shell. */
export function useCopilotPanel(): {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
} {
  const open = useSyncExternalStore(
    subscribe,
    () => panelOpen,
    () => false
  )
  return {
    open,
    setOpen: setCopilotPanelOpen,
    toggle: toggleCopilotPanel,
  }
}

// ——— Panel width ————————————————————————————————————————————————————————
//
// The panel is a workspace, not a notification: an organizer reading a
// submissions table next to a copilot answer needs to decide how the screen is
// split, and that decision should survive a reload. Width lives here (not in
// component state) for the same reason the conversation does — the panel
// unmounts on every close.

const WIDTH_STORAGE_KEY = "sb.copilotPanelWidth"

/** Below this the tool cards start wrapping badly. */
export const COPILOT_PANEL_MIN_WIDTH = 360
/** Above this it stops being a side panel. */
export const COPILOT_PANEL_MAX_WIDTH = 720
export const COPILOT_PANEL_DEFAULT_WIDTH = 460

/** The hard ceiling, also bounded by the viewport so it can't eat the app. */
export function copilotPanelMaxWidth(): number {
  if (typeof window === "undefined") return COPILOT_PANEL_MAX_WIDTH
  return Math.max(
    COPILOT_PANEL_MIN_WIDTH,
    Math.min(COPILOT_PANEL_MAX_WIDTH, Math.round(window.innerWidth * 0.6))
  )
}

export function clampCopilotPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return COPILOT_PANEL_DEFAULT_WIDTH
  return Math.round(
    Math.min(copilotPanelMaxWidth(), Math.max(COPILOT_PANEL_MIN_WIDTH, width))
  )
}

let panelWidth: number | null = null

function readStoredWidth(): number {
  if (panelWidth !== null) return panelWidth
  if (typeof window === "undefined") return COPILOT_PANEL_DEFAULT_WIDTH
  const stored = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY))
  panelWidth = stored
    ? clampCopilotPanelWidth(stored)
    : COPILOT_PANEL_DEFAULT_WIDTH
  return panelWidth
}

export function setCopilotPanelWidth(width: number): void {
  const next = clampCopilotPanelWidth(width)
  if (panelWidth === next) return
  panelWidth = next
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(next))
    } catch {
      // Private mode / quota — the width still works for this session.
    }
  }
  notify()
}

/** Double-click on the handle: back to the width the panel ships with. */
export function resetCopilotPanelWidth(): void {
  setCopilotPanelWidth(COPILOT_PANEL_DEFAULT_WIDTH)
}

export function useCopilotPanelWidth(): number {
  return useSyncExternalStore(
    subscribe,
    readStoredWidth,
    () => COPILOT_PANEL_DEFAULT_WIDTH
  )
}

// ——— Event context carried on every request ——————————————————————————————

export type CopilotEventContext = {
  eventId?: string
  eventName?: string
  eventSlug?: string
}

/**
 * Mutable because the transport is created once per conversation but the
 * selected event can change under it; `prepareSendMessagesRequest` reads this
 * at send time so the server always gets the event the organizer is actually
 * looking at.
 */
let eventContext: CopilotEventContext = {}

export function setCopilotEventContext(context: CopilotEventContext): void {
  if (
    eventContext.eventId === context.eventId &&
    eventContext.eventName === context.eventName &&
    eventContext.eventSlug === context.eventSlug
  ) {
    return
  }
  eventContext = context
}

// ——— Conversation registry ——————————————————————————————————————————————

const chats = new Map<string, Chat<UIMessage>>()
/** Bumped by "New chat" so subscribers swap to a freshly created instance. */
const generations = new Map<string, number>()

function registryKey(eventId: string | undefined): string {
  return eventId ?? "no-event"
}

function createChat(id: string): Chat<UIMessage> {
  return new Chat<UIMessage>({
    id,
    transport: new DefaultChatTransport<UIMessage>({
      api: API_ENDPOINT,
      prepareSendMessagesRequest: ({ id: chatId, messages, body }) => ({
        body: {
          id: chatId,
          messages,
          eventName: eventContext.eventName,
          eventSlug: eventContext.eventSlug,
          // What the organizer is looking at, read at SEND time so "decline
          // this one" resolves against the screen they are on right now
          // (src/lib/copilot-context.ts).
          appContext: readCopilotContext(),
          ...body,
        },
      }),
    }),
    // The approval handshake: once the organizer has answered every pending
    // approval card, the conversation continues on its own — no "send" click
    // to run the thing they just approved.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })
}

/**
 * The conversation for an event, created on first use. Stable across
 * navigations, so the panel and the full page share it.
 */
export function getCopilotChat(eventId: string | undefined): Chat<UIMessage> {
  const key = registryKey(eventId)
  const generation = generations.get(key) ?? 0
  const id = `copilot:${key}:${generation}`
  let chat = chats.get(id)
  if (!chat) {
    chat = createChat(id)
    chats.set(id, chat)
  }
  return chat
}

/** "New chat" — drops the conversation and starts a clean one. */
export function resetCopilotChat(eventId: string | undefined): void {
  const key = registryKey(eventId)
  const generation = (generations.get(key) ?? 0) + 1
  generations.set(key, generation)
  for (const [id] of chats) {
    if (id.startsWith(`copilot:${key}:`)) chats.delete(id)
  }
  notify()
}

/**
 * Subscribes to the conversation for `eventId`, re-resolving when "New chat"
 * bumps the generation. Pass the result to `useChat({ chat })`.
 */
export function useCopilotChat(eventId: string | undefined): {
  chat: Chat<UIMessage>
  newChat: () => void
} {
  const key = registryKey(eventId)
  const generation = useSyncExternalStore(
    subscribe,
    () => generations.get(key) ?? 0,
    () => 0
  )
  // `generation` is what makes this recompute after a reset; the lookup below
  // reads it back out of the registry, so the value itself is unused.
  void generation
  const chat = getCopilotChat(eventId)
  const newChat = useCallback(() => resetCopilotChat(eventId), [eventId])
  return { chat, newChat }
}
