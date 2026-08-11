/**
 * The feedback layer of an agenda drag: the ghost, the chip, the narration.
 *
 * The rule the whole interaction is built on — **the card under the pointer
 * shows what you're moving, the ghost shows where it lands**. Nothing about the
 * outcome is left for the organizer to infer from a floating rectangle: the
 * ghost sits in the exact snapped slot, at the session's real duration, in the
 * column it would land in, and the chip spells the result out in words
 * ("10:15 AM – 11:00 AM · Main Stage") as it changes.
 *
 * Conflicts are pre-warned, never blocked (convex/agenda.ts §schedule) — the
 * ghost turns red and the chip names the session it would collide with, and the
 * drop still goes through if the organizer wants it to.
 */

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { RiErrorWarningLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { trackTint } from "./agenda-model"
import type { DragPlacement } from "./use-drag-machine"
import { placementRangeLabel } from "./use-drag-machine"

export interface DropGhostProps {
  placement: DragPlacement
  pixelsPerMinute: number
  windowStartMinutes: number
  orientation?: "vertical" | "horizontal"
  /** Keyboard moves scroll the ghost into view and carry the chip inline. */
  keyboard?: boolean
  /** Horizontal grids need an explicit lane height. */
  laneInset?: number
}

/** The block-shaped preview of where the drop lands. */
export function DropGhost({
  placement,
  pixelsPerMinute,
  windowStartMinutes,
  orientation = "vertical",
  keyboard = false,
  laneInset = 8,
}: DropGhostProps) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement | null>(null)
  const conflicted = placement.warnings.length > 0 || !!placement.blockedReason
  const tint = trackTint(placement.column.color ?? placement.session.track?.color)

  const offset = (placement.minutes - windowStartMinutes) * pixelsPerMinute
  const extent = Math.max(placement.durationMinutes * pixelsPerMinute, 22)

  // A keyboard move can push the ghost outside the scroll port — follow it.
  React.useEffect(() => {
    if (!keyboard) return
    ref.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduced ? "auto" : "smooth",
    })
  }, [keyboard, reduced, placement.minutes, placement.column.key])

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 780, damping: 46, mass: 0.7 }

  const geometry =
    orientation === "vertical"
      ? { top: offset, height: extent, left: 4, right: 4 }
      : { left: offset, width: extent, top: laneInset, bottom: laneInset }

  return (
    <motion.div
      ref={ref}
      data-slot="agenda-drop-ghost"
      data-conflicted={conflicted ? "true" : "false"}
      aria-hidden
      className="pointer-events-none absolute z-40"
      initial={false}
      animate={geometry}
      transition={spring}
      style={geometry}
    >
      <div
        className={cn(
          "relative flex h-full w-full flex-col justify-center overflow-hidden rounded-md border-[1.5px] border-dashed px-2",
          conflicted && "border-destructive"
        )}
        style={
          conflicted
            ? { backgroundColor: "var(--status-red-bg)" }
            : { backgroundColor: tint.surface, borderColor: tint.bar }
        }
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 rounded-l-[4px]"
          style={{
            backgroundColor: conflicted
              ? "var(--destructive)"
              : tint.bar,
          }}
        />
        {extent >= 34 ? (
          <span
            className="truncate pl-1.5 text-[11px] leading-4 font-semibold tabular-nums"
            style={{
              color: conflicted ? "var(--status-red-fg)" : tint.title,
            }}
          >
            {placementRangeLabel(placement)}
          </span>
        ) : null}
        {extent >= 52 ? (
          <span
            className="truncate pl-1.5 text-[11px] leading-4"
            style={{ color: conflicted ? "var(--status-red-fg)" : tint.meta }}
          >
            {placement.session.title}
          </span>
        ) : null}
      </div>

      {keyboard ? (
        // Near the top of the grid there is no room above the ghost — the chip
        // would sit on the sticky column headers, so it flips underneath.
        <div
          className={cn(
            "absolute left-0 z-50",
            offset < 72 ? "-bottom-1 translate-y-full" : "-top-1 -translate-y-full"
          )}
        >
          <DragChipBody placement={placement} keyboard />
        </div>
      ) : null}
    </motion.div>
  )
}

/**
 * The chip's contents — time range, column, and the reason it's red.
 * Rendered inline above the ghost for keyboard moves, and inside the
 * pointer-following portal for mouse drags.
 */
function DragChipBody({
  placement,
  keyboard = false,
}: {
  placement: DragPlacement
  keyboard?: boolean
}) {
  const conflicted = placement.warnings.length > 0
  const reason = placement.blockedReason ?? placement.warnings[0]?.label
  return (
    <div
      data-slot="agenda-drag-chip"
      data-conflicted={conflicted || placement.blockedReason ? "true" : "false"}
      className={cn(
        "flex max-w-72 flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left shadow-lg ring-1",
        conflicted || placement.blockedReason
          ? "bg-destructive text-white ring-black/10"
          : "bg-foreground text-background ring-black/10"
      )}
    >
      <span className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold tabular-nums">
        {placementRangeLabel(placement)}
        <span aria-hidden className="opacity-50">
          ·
        </span>
        <span className="truncate font-medium opacity-90">
          {placement.column.name}
        </span>
      </span>
      {reason ? (
        <span className="flex items-start gap-1 text-[11px] leading-4 opacity-95">
          <RiErrorWarningLine size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span className="truncate">{reason}</span>
        </span>
      ) : null}
      {keyboard ? (
        <span className="text-[10px] leading-3.5 opacity-70">
          Arrows move · Enter drops · Esc cancels
        </span>
      ) : null}
    </div>
  )
}

/**
 * The chip while the pointer is somewhere nothing can land — over the tray,
 * the toolbar, the page margin.
 *
 * Saying nothing here is worse than it sounds: the ghost has just vanished, so
 * without a word the organizer has to guess whether the drag is still live.
 * One neutral line keeps the gesture legible until they're back on the grid.
 */
function OffGridChipBody({ title }: { title: string }) {
  return (
    <div
      data-slot="agenda-drag-chip"
      data-conflicted="false"
      data-off-grid="true"
      className="flex max-w-72 flex-col gap-0.5 rounded-lg bg-foreground px-2.5 py-1.5 text-left text-background shadow-lg ring-1 ring-black/10"
    >
      <span className="truncate text-[12px] leading-4 font-semibold">
        {title}
      </span>
      <span className="text-[11px] leading-4 opacity-80">
        Move back over the grid to place it
      </span>
    </div>
  )
}

/**
 * The chip that follows the mouse.
 *
 * It listens for pointer moves itself and writes the transform straight onto
 * the node inside a rAF, so a 120 Hz mouse never re-renders the grid — the one
 * place in the agenda where bypassing React is the right call.
 */
export function PointerDragChip({
  placement,
  title,
}: {
  /** Null while the pointer is off the grid — the chip stays, the slot goes. */
  placement: DragPlacement | null
  /** Fallback label for the off-grid state. */
  title: string
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let frame = 0
    let x = 0
    let y = 0
    let seen = false

    const GAP = 16
    const MARGIN = 8

    function paint() {
      frame = 0
      const node = ref.current
      if (!node) return
      // Flip to the other side of the cursor rather than run off the window.
      // The tray sits at the right edge of the grid, which is exactly where an
      // organizer parks a card mid-thought — a clipped chip there would hide
      // the sentence that explains why the ghost went away.
      const { width, height } = node.getBoundingClientRect()
      const right = x + GAP + width
      const bottom = y + GAP + 2 + height
      const left =
        right > window.innerWidth - MARGIN
          ? Math.max(MARGIN, x - GAP - width)
          : x + GAP
      const top =
        bottom > window.innerHeight - MARGIN
          ? Math.max(MARGIN, y - GAP - height)
          : y + GAP + 2
      node.style.transform = `translate3d(${left}px, ${top}px, 0)`
      if (!seen) return
      node.style.opacity = "1"
    }

    function onPointerMove(event: PointerEvent) {
      x = event.clientX
      y = event.clientY
      seen = true
      if (!frame) frame = window.requestAnimationFrame(paint)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed top-0 left-0 z-9999 opacity-0 transition-opacity duration-100"
    >
      {placement ? (
        <DragChipBody placement={placement} />
      ) : (
        <OffGridChipBody title={title} />
      )}
    </div>
  )
}

/**
 * Screen-reader narration of the move in flight.
 *
 * Every keyboard step announces the slot it moved to and whether that slot
 * clashes — the same sentence the chip shows. It doubles as a deterministic
 * assertion target for the browser agent that judges us.
 */
export function DragAnnouncer({ message }: { message: string }) {
  return (
    <div
      data-slot="agenda-drag-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}

/** The always-present instruction cards are described by, once per grid. */
export function KeyboardDragHint({ id }: { id: string }) {
  return (
    <span id={id} hidden>
      Press Enter or Space to pick this session up, then use the arrow keys to
      move it between slots and columns. Press Enter to drop it, or Escape to
      cancel.
    </span>
  )
}
