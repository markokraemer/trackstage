import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  RiAddLine,
  RiExpandDiagonalLine,
  RiSparkling2Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { CopilotChat } from "@/components/copilot/copilot-chat"
import { CopilotAppContext } from "@/components/copilot/copilot-app-context"
import {
  COPILOT_PANEL_MIN_WIDTH,
  clampCopilotPanelWidth,
  copilotPanelMaxWidth,
  resetCopilotPanelWidth,
  setCopilotPanelWidth,
  useCopilotChat,
  useCopilotPanel,
  useCopilotPanelWidth,
} from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * The copilot side panel — the copilot "next to any screen" half of
 * docs/memory/RULES.md #24 (the other half is /app/copilot).
 *
 * Non-modal on purpose: no scrim, no focus trap escape hatch needed, the
 * organizer keeps reading the table behind it while the copilot works. It is
 * still a Sheet (rule #17 — shadcn primitives, extended rather than
 * hand-rolled), just one that has been told not to dim the page.
 *
 * RESIZABLE, because the panel is a workspace: a submissions table rendered
 * by a tool needs room, and how much room to give it is the organizer's call,
 * not ours. The width persists (src/lib/copilot-store.ts) and the handle is a
 * real `separator` widget — pointer drag, arrow keys, Home/End, and
 * double-click to reset — so it is usable without a mouse.
 *
 * Conversation state lives in src/lib/copilot-store.ts, above the router, so
 * opening the panel on Submissions and then walking to Agenda keeps the
 * thread — and the full-page chat picks up exactly where the panel left off.
 */

/** Cmd/Ctrl+I. Cmd+K is reserved for a command palette. */
const SHORTCUT_KEY = "i"

/** One arrow press. Shift multiplies it (see the handler). */
const KEYBOARD_STEP = 24

/**
 * Base UI closes a dialog for several reasons; a non-modal work panel should
 * only honour the deliberate ones. Clicking the table behind the copilot, or
 * letting focus wander out of it, must not dismiss the conversation.
 */
function ignoreDismissal(setOpen: (open: boolean) => void) {
  return (open: boolean, details: { reason?: string }) => {
    if (!open && (details.reason === "outside-press" || details.reason === "focus-out")) {
      return
    }
    setOpen(open)
  }
}

export function CopilotPanel() {
  const { open, setOpen } = useCopilotPanel()
  const { event } = useCurrentEvent()
  const { newChat } = useCopilotChat(event?._id)
  const width = useCopilotPanelWidth()

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key.toLowerCase() !== SHORTCUT_KEY) return
      if (!(keyEvent.metaKey || keyEvent.ctrlKey)) return
      keyEvent.preventDefault()
      setOpen(!open)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  // A viewport that shrinks below the current width would leave the panel
  // covering the app; re-clamp instead.
  useEffect(() => {
    const onResize = () => setCopilotPanelWidth(width)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [width])

  return (
    <>
      {/* Mounted whether or not the panel is open: the copilot must already
          know what screen the organizer came from the moment they open it. */}
      <CopilotAppContext />
      {/*
        `ignoreDismissal` is the other half of `modal={false}`. A non-modal
        panel exists so the organizer can keep working in the table behind it —
        but Base UI dismisses a dialog on outside press and focus-out by
        default, so the first click on that table closed the copilot, which is
        the opposite of the point. It also made the resize handle unusable: a
        drag that ends past the panel's left edge counts as an outside press.
        Escape and the close button remain the ways out.
      */}
      <Sheet open={open} onOpenChange={ignoreDismissal(setOpen)} modal={false}>
        <SheetContent
          side="right"
          showOverlay={false}
          showCloseButton
          aria-label="Trackstage copilot"
          style={{ width: `min(100vw, ${width}px)` }}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-none"
        >
          <ResizeHandle width={width} />

          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <RiSparkling2Line size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-sm">Copilot</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {event?.name ?? "No event selected"}
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New chat"
              title="New chat"
              onClick={newChat}
            >
              <RiAddLine size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open full page"
              title="Open full page"
              nativeButton={false}
              render={<Link to="/app/copilot" onClick={() => setOpen(false)} />}
            >
              <RiExpandDiagonalLine size={16} aria-hidden />
            </Button>
            {/* Leaves room for SheetContent's built-in close button. */}
            <span aria-hidden className="w-7" />
          </header>

          <CopilotChat variant="panel" className="min-h-0 flex-1" />
        </SheetContent>
      </Sheet>
    </>
  )
}

/**
 * The left edge, as a drag target.
 *
 * Pointer events (not mouse events) so a trackpad, a pen and a touch drag all
 * behave; `setPointerCapture` keeps the drag alive when the cursor outruns the
 * 8px hit area, which is the difference between "resizable" and "resizable if
 * you move slowly".
 */
function ResizeHandle({ width }: { width: number }) {
  const [dragging, setDragging] = useState(false)
  const frame = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    []
  )

  const applyWidth = useCallback((next: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      setCopilotPanelWidth(next)
    })
  }, [])

  const onPointerDown = useCallback((pointerEvent: React.PointerEvent) => {
    if (pointerEvent.button !== 0) return
    pointerEvent.preventDefault()
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    setDragging(true)
  }, [])

  const onPointerMove = useCallback(
    (pointerEvent: React.PointerEvent) => {
      if (!dragging) return
      // The panel is anchored right, so its width is whatever is left of the
      // viewport edge.
      applyWidth(window.innerWidth - pointerEvent.clientX)
    },
    [applyWidth, dragging]
  )

  const endDrag = useCallback((pointerEvent: React.PointerEvent) => {
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
      pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId)
    }
    setDragging(false)
  }, [])

  const onKeyDown = useCallback(
    (keyEvent: React.KeyboardEvent) => {
      const step = keyEvent.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP
      // Left widens: the panel grows leftwards from the right edge.
      if (keyEvent.key === "ArrowLeft") {
        keyEvent.preventDefault()
        setCopilotPanelWidth(width + step)
      } else if (keyEvent.key === "ArrowRight") {
        keyEvent.preventDefault()
        setCopilotPanelWidth(width - step)
      } else if (keyEvent.key === "Home") {
        keyEvent.preventDefault()
        setCopilotPanelWidth(copilotPanelMaxWidth())
      } else if (keyEvent.key === "End") {
        keyEvent.preventDefault()
        setCopilotPanelWidth(COPILOT_PANEL_MIN_WIDTH)
      } else if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault()
        resetCopilotPanelWidth()
      }
    },
    [width]
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the copilot panel"
      aria-valuenow={clampCopilotPanelWidth(width)}
      aria-valuemin={COPILOT_PANEL_MIN_WIDTH}
      aria-valuemax={copilotPanelMaxWidth()}
      tabIndex={0}
      data-slot="copilot-resize-handle"
      data-dragging={dragging || undefined}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={resetCopilotPanelWidth}
      onKeyDown={onKeyDown}
      className={cn(
        "group absolute inset-y-0 left-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center",
        "focus-visible:outline-none"
      )}
    >
      {/* The visible affordance: a hairline that thickens on hover/drag. */}
      <span
        aria-hidden
        className={cn(
          "h-full w-px bg-transparent transition-colors",
          "group-hover:bg-primary/40 group-focus-visible:bg-primary group-data-[dragging]:bg-primary"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute h-8 w-1 rounded-full bg-border opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[dragging]:opacity-100"
        )}
      />
    </div>
  )
}

/**
 * The sparkle in the app top bar. Opens the panel; Cmd+I does the same.
 *
 * Calm, but not anonymous: a soft primary-tinted surface rather than another
 * outlined utility button, because the copilot IS a product feature and the
 * top bar has to say so without shouting (no gradient, no filled primary
 * competing with the page's own save buttons).
 */
export function CopilotTriggerButton() {
  const { open, toggle } = useCopilotPanel()
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Open the AI copilot"
      aria-expanded={open}
      title="Copilot (⌘I)"
      onClick={toggle}
      className={cn(
        "gap-1.5 bg-primary/8 text-primary hover:bg-primary/14 hover:text-primary",
        "aria-expanded:bg-primary/14 aria-expanded:text-primary"
      )}
    >
      <RiSparkling2Line aria-hidden />
      <span className="max-sm:sr-only">Copilot</span>
    </Button>
  )
}
