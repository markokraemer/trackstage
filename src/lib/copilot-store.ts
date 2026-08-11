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
 *
 * They are also PERSISTED (convex/copilotThreads.ts): the registry below holds
 * the live `Chat` objects, a thread row holds the transcript, and
 * copilot-threads.tsx is the one component that moves messages between the
 * two. A conversation is written down the moment it has something in it — so
 * "New chat" costs nothing and the rail never fills with empty rows.
 */

const API_ENDPOINT = "/api/chat"

// ——— Panel visibility ———————————————————————————————————————————————————

const listeners = new Set<() => void>()
let panelOpen = false

/**
 * Bumped by every mutation of this module's state. Readers subscribe to the
 * number rather than to the objects, because `useSyncExternalStore` needs a
 * snapshot it can compare with `Object.is` and a `Map` lookup is not that.
 */
let version = 0

function notify(): void {
  version += 1
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
/**
 * Above this it stops being a side panel. Raised from 720 (Marko,
 * 2026-08-11: "the resize range is too small — let it expand much further"):
 * a tool card rendering a submissions table wants room, and on a 2560px
 * display the old cap was barely a quarter of the screen. The viewport share
 * below keeps it past his 45% floor at every width without ever letting the
 * panel swallow the app.
 */
export const COPILOT_PANEL_MAX_WIDTH = 900
/** Share of the viewport the panel may take at most. */
const COPILOT_PANEL_MAX_VIEWPORT_SHARE = 0.55
export const COPILOT_PANEL_DEFAULT_WIDTH = 460

/** The hard ceiling, also bounded by the viewport so it can't eat the app. */
export function copilotPanelMaxWidth(): number {
  if (typeof window === "undefined") return COPILOT_PANEL_MAX_WIDTH
  return Math.max(
    COPILOT_PANEL_MIN_WIDTH,
    Math.min(
      COPILOT_PANEL_MAX_WIDTH,
      Math.round(window.innerWidth * COPILOT_PANEL_MAX_VIEWPORT_SHARE)
    )
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
//
// Two coordinates identify a conversation: the EVENT it belongs to and the
// THREAD within it. A thread is either a saved row (`threadId`) or a draft
// that has not been written down yet — a "New chat" nobody has typed into.
// Both live in the same map so the rest of the app only ever asks for "the
// active chat for this event".

const chats = new Map<string, Chat<UIMessage>>()
/** Chat keys whose transcript is already in memory — see `hydrateCopilotThread`. */
const hydratedChats = new Set<string>()
/** chat.id → signature of what has been persisted, so autosave can no-op. */
const savedSignatures = new Map<string, string>()

type ActiveThread = {
  /** The saved row, or null while this is still an unwritten draft. */
  threadId: string | null
  /** Distinguishes successive drafts, so "New chat" twice means two chats. */
  draft: number
}

const activeThreads = new Map<string, ActiveThread>()
const draftCounters = new Map<string, number>()

function registryKey(eventId: string | undefined): string {
  return eventId ?? "no-event"
}

/** Which conversation the organizer was in, remembered across reloads. */
function activeStorageKey(eventKey: string): string {
  return `sb.copilotThread.${eventKey}`
}

function readStoredThreadId(eventKey: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(activeStorageKey(eventKey))
  } catch {
    return null
  }
}

function writeStoredThreadId(eventKey: string, threadId: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (threadId) {
      window.localStorage.setItem(activeStorageKey(eventKey), threadId)
    } else {
      window.localStorage.removeItem(activeStorageKey(eventKey))
    }
  } catch {
    // Private mode — the conversation still works, it just won't survive F5.
  }
}

function activeThread(eventKey: string): ActiveThread {
  const existing = activeThreads.get(eventKey)
  if (existing) return existing
  const restored: ActiveThread = {
    threadId: readStoredThreadId(eventKey),
    draft: 0,
  }
  activeThreads.set(eventKey, restored)
  return restored
}

function chatKey(eventKey: string, thread: ActiveThread): string {
  return thread.threadId
    ? `copilot:${eventKey}:t:${thread.threadId}`
    : `copilot:${eventKey}:d:${thread.draft}`
}

function createChat(
  id: string,
  initialMessages?: Array<UIMessage>
): Chat<UIMessage> {
  return new Chat<UIMessage>({
    id,
    messages: initialMessages,
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
  const eventKey = registryKey(eventId)
  const id = chatKey(eventKey, activeThread(eventKey))
  let chat = chats.get(id)
  if (!chat) {
    chat = createChat(id)
    chats.set(id, chat)
  }
  return chat
}

/** The saved row the active conversation belongs to, if it has one yet. */
export function getCopilotThreadId(eventId: string | undefined): string | null {
  return activeThread(registryKey(eventId)).threadId
}

/**
 * True while the active conversation is a saved thread whose transcript has
 * not been read back yet — the difference between "this chat is empty" and
 * "this chat hasn't arrived", which the UI must not confuse.
 */
export function isCopilotThreadPending(eventId: string | undefined): boolean {
  const eventKey = registryKey(eventId)
  const thread = activeThread(eventKey)
  if (!thread.threadId) return false
  return !hydratedChats.has(chatKey(eventKey, thread))
}

/** "New chat" — parks the current conversation and starts an unwritten one. */
export function resetCopilotChat(eventId: string | undefined): void {
  const eventKey = registryKey(eventId)
  const draft = (draftCounters.get(eventKey) ?? 0) + 1
  draftCounters.set(eventKey, draft)
  activeThreads.set(eventKey, { threadId: null, draft })
  writeStoredThreadId(eventKey, null)
  notify()
}

/**
 * Opens a saved conversation. Instant by design (rule 26): the rail highlights
 * the row in the same frame, and copilot-threads.tsx fills the transcript in
 * behind it — from the react-query cache when the organizer has been here
 * before, which is most of the time.
 */
export function selectCopilotThread(
  eventId: string | undefined,
  threadId: string
): void {
  const eventKey = registryKey(eventId)
  const current = activeThread(eventKey)
  if (current.threadId === threadId) return
  activeThreads.set(eventKey, { threadId, draft: current.draft })
  writeStoredThreadId(eventKey, threadId)
  notify()
}

/**
 * Installs a transcript read back from Convex. Called once per thread — a
 * conversation the organizer has since added to must never be overwritten by
 * the query that loaded it.
 */
export function hydrateCopilotThread(
  eventId: string | undefined,
  threadId: string,
  messages: Array<UIMessage>,
  signature: string
): void {
  const eventKey = registryKey(eventId)
  const id = `copilot:${eventKey}:t:${threadId}`
  if (hydratedChats.has(id)) return
  hydratedChats.add(id)
  const chat = createChat(id, messages)
  chats.set(id, chat)
  // Whatever we just read IS what is stored, so autosave has nothing to do —
  // without this, merely opening an old chat would bump it to the top of the
  // rail.
  savedSignatures.set(chat.id, signature)
  notify()
}

/**
 * The first autosave of a draft turns it into a real thread. The live `Chat`
 * is kept — it may still be streaming — and simply re-filed under its new
 * identity, so nothing the organizer is watching flickers.
 */
export function adoptCopilotThread(
  eventId: string | undefined,
  chat: Chat<UIMessage>,
  threadId: string
): void {
  const eventKey = registryKey(eventId)
  const current = activeThread(eventKey)
  // The organizer may have hit "New chat" while the save was in flight; that
  // decision wins.
  if (chats.get(chatKey(eventKey, current)) !== chat) return
  const id = `copilot:${eventKey}:t:${threadId}`
  chats.delete(chatKey(eventKey, current))
  chats.set(id, chat)
  hydratedChats.add(id)
  activeThreads.set(eventKey, { threadId, draft: current.draft })
  writeStoredThreadId(eventKey, threadId)
  notify()
}

/** A deleted (or vanished) thread: drop it, and move on if it was open. */
export function forgetCopilotThread(
  eventId: string | undefined,
  threadId: string
): void {
  const eventKey = registryKey(eventId)
  const id = `copilot:${eventKey}:t:${threadId}`
  const chat = chats.get(id)
  if (chat) savedSignatures.delete(chat.id)
  chats.delete(id)
  hydratedChats.delete(id)
  if (activeThread(eventKey).threadId === threadId) {
    resetCopilotChat(eventId)
    return
  }
  notify()
}

/** What autosave last wrote for this chat, so an unchanged chat stays silent. */
export function copilotSavedSignature(chatId: string): string | undefined {
  return savedSignatures.get(chatId)
}

export function setCopilotSavedSignature(
  chatId: string,
  signature: string
): void {
  savedSignatures.set(chatId, signature)
}

/**
 * Subscribes to the conversation for `eventId`, re-resolving when "New chat",
 * a rail click or the first autosave changes which thread is active. Pass the
 * result to `useChat({ chat })`.
 */
export function useCopilotChat(eventId: string | undefined): {
  chat: Chat<UIMessage>
  /** The saved row, or null while the conversation is still a draft. */
  threadId: string | null
  /** The transcript is on its way — draw a skeleton, not an empty state. */
  pending: boolean
  newChat: () => void
  selectThread: (threadId: string) => void
} {
  // The version is what makes this recompute; the values themselves are read
  // back out of the registry below.
  void useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  )
  const chat = getCopilotChat(eventId)
  const newChat = useCallback(() => resetCopilotChat(eventId), [eventId])
  const selectThread = useCallback(
    (threadId: string) => selectCopilotThread(eventId, threadId),
    [eventId]
  )
  return {
    chat,
    threadId: getCopilotThreadId(eventId),
    pending: isCopilotThreadPending(eventId),
    newChat,
    selectThread,
  }
}
