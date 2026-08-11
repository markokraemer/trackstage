"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  animate,
  AnimatePresence,
  motion,
  motionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react"

const FILL = { type: "spring", stiffness: 210, damping: 34, mass: 0.9 } as const

const POP = { type: "spring", stiffness: 640, damping: 22, mass: 0.7 } as const
const EASE = [0.23, 1, 0.32, 1] as const
const ENTER = { duration: 0.2, ease: EASE } as const
const STILL = { duration: 0 } as const

export type PollOption = {
  id: string
  label: string
  votes: number
}

export type UsePollResultsOptions = {
  options: PollOption[]

  value?: string | null
  defaultValue?: string | null
  onVote?: (id: string) => void
}

export function usePollResults({
  options,
  value,
  defaultValue = null,
  onVote,
}: UsePollResultsOptions) {
  const [internal, setInternal] = useState<string | null>(defaultValue)
  const controlled = value !== undefined
  const chosen = controlled ? value : internal

  const emit = useRef(onVote)
  emit.current = onVote

  const vote = useCallback(
    (id: string) => {
      if (chosen !== null) return
      if (!controlled) setInternal(id)
      emit.current?.(id)
    },
    [chosen, controlled]
  )

  const total = options.reduce((sum, o) => sum + Math.max(0, o.votes), 0)
  const top = options.reduce((best, o) => (o.votes > best ? o.votes : best), 0)

  const rows = options.map((option) => ({
    ...option,
    share: total > 0 ? Math.max(0, option.votes) / total : 0,
    winner: total > 0 && option.votes === top,
    mine: option.id === chosen,
  }))

  return {
    rows,
    total,
    chosen,
    revealed: chosen !== null,
    vote,
  }
}

const Tick = (
  <svg viewBox="0 0 256 256" width="11" height="11" fill="none" aria-hidden>
    <polyline
      points="216 72 104 184 48 128"
      stroke="currentColor"
      strokeWidth="26"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type RowProps = {
  label: string
  share: number
  winner: boolean
  mine: boolean
  revealed: boolean
  reduced: boolean
  onPick: () => void
}

function Row({
  label,
  share,
  winner,
  mine,
  revealed,
  reduced,
  onPick,
}: RowProps) {
  const progress = useRef(motionValue(0)).current
  const clipPath = useTransform(
    progress,
    (p) => `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0 round 5px)`
  )

  const [landed, setLanded] = useState(false)
  const readout = useRef<HTMLSpanElement | null>(null)

  useMotionValueEvent(progress, "change", (p) => {
    const node = readout.current
    if (!node) return
    const next = `${Math.round(p * 100)}%`
    if (node.textContent !== next) node.textContent = next
  })

  useEffect(() => {
    if (!revealed) return
    if (reduced) {
      progress.jump(share)
      setLanded(true)
      return
    }
    const controls = animate(progress, share, FILL)
    void controls.finished.then(() => setLanded(true))
    return () => controls.stop()
  }, [revealed, share, reduced, progress])

  return (
    <button
      type="button"
      onClick={onPick}
      aria-disabled={revealed}
      aria-pressed={revealed ? mine : undefined}
      className={`group relative h-9 w-full overflow-hidden rounded-md border text-left transition-[border-color,background-color,box-shadow,transform] duration-200 outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:rounded-[7px] focus-visible:after:bg-primary/[0.06] focus-visible:after:shadow-[inset_0_0_0_1px_var(--primary)] ${
        revealed
          ? "cursor-default border-border bg-muted/70 shadow-[inset_0_1px_2px_rgba(27,30,39,0.07)]"
          : "border-border bg-card shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(27,30,39,0.06),0_1px_2px_rgba(27,30,39,0.08)] hover:bg-secondary active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(27,30,39,0.06)]"
      }`}
    >
      <motion.span
        aria-hidden
        style={{ clipPath }}
        className={`absolute inset-[3px] rounded-[5px] ${
          mine
            ? "bg-primary/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(47,92,224,0.28)]"
            : "bg-foreground/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(27,30,39,0.1)]"
        }`}
      />
      <span className="relative flex h-full items-center gap-2 px-3">
        <span
          className={`min-w-0 flex-1 truncate text-[13px] transition-[color,font-weight] duration-200 ${
            revealed && winner
              ? "font-medium text-foreground"
              : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {label}
        </span>
        <span className="grid size-4 shrink-0 place-items-center">
          <AnimatePresence initial={false}>
            {revealed && winner && landed ? (
              <motion.span
                key="win"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: STILL }}
                transition={reduced ? STILL : POP}
                className="text-foreground"
              >
                {Tick}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
        <span className="relative grid shrink-0 text-right">
          <span
            aria-hidden
            className="invisible col-start-1 row-start-1 font-mono text-[11px] tabular-nums"
          >
            100%
          </span>
          <motion.span
            ref={readout}
            aria-hidden
            initial={false}
            animate={{ opacity: revealed ? 1 : 0 }}
            transition={reduced ? STILL : ENTER}
            className="col-start-1 row-start-1 font-mono text-[11px] text-muted-foreground tabular-nums"
          >
            0%
          </motion.span>
        </span>
      </span>
    </button>
  )
}

export type PollResultsProps = UsePollResultsOptions & {
  label: string
  className?: string
}

export function PollResults({
  options,
  value,
  defaultValue,
  onVote,
  label,
  className = "",
}: PollResultsProps) {
  const poll = usePollResults({ options, value, defaultValue, onVote })
  const reduced = useReducedMotion() === true

  const [spoken, setSpoken] = useState("")
  useEffect(() => {
    if (!poll.revealed) return
    const winner = poll.rows.find((r) => r.winner)
    const t = setTimeout(
      () =>
        setSpoken(
          winner
            ? `Results: ${winner.label} leads with ${Math.round(winner.share * 100)} percent of ${poll.total} votes`
            : `Results shown, ${poll.total} votes`
        ),
      700
    )
    return () => clearTimeout(t)
  }, [poll.revealed, poll.rows, poll.total])

  return (
    <div role="group" aria-label={label} className={`w-full ${className}`}>
      <p className="mb-2.5 text-[13px] font-medium text-foreground">{label}</p>
      <div className="space-y-1.5">
        {poll.rows.map((row) => (
          <Row
            key={row.id}
            label={row.label}
            share={row.share}
            winner={row.winner}
            mine={row.mine}
            revealed={poll.revealed}
            reduced={reduced}
            onPick={() => poll.vote(row.id)}
          />
        ))}
      </div>
      <p className="mt-2 h-4 font-mono text-[10.5px] text-muted-foreground/70 tabular-nums">
        <motion.span
          initial={false}
          animate={{ opacity: poll.revealed ? 1 : 0 }}
          transition={reduced ? STILL : { ...ENTER, delay: 0.4 }}
          className="inline-block"
        >
          {poll.total.toLocaleString("en-US")} votes
        </motion.span>
      </p>
      <span role="status" className="sr-only">
        {spoken}
      </span>
    </div>
  )
}
