import {
  RiAttachment2,
  RiCheckLine,
  RiGitBranchLine,
  RiSearchLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/brand/logo"
import { StatusPill } from "@/components/shared/status-pill"

/**
 * ProductShot — the product imagery for the marketing page.
 *
 * Real screenshots don't exist yet (docs/memory/RULES.md 18f explicitly allows
 * placeholders), so every shot is drawn here in markup from the same design
 * tokens the real app uses: `--sidebar`, `--accent`, the chart palette and the
 * status pill system. That keeps the marketing page honest — the mock cannot
 * drift into a look the product doesn't have — and it costs zero image bytes.
 *
 * **Swapping in a real screenshot:** pass `src` (and `alt`). The browser chrome,
 * frame, shadow and caption stay identical, so a screenshot drops in without
 * touching any caller:
 *
 * ```tsx
 * <ProductShot variant="agenda" src="/shots/agenda.png" alt="The agenda builder" />
 * ```
 */

export type ProductShotVariant =
  | "dashboard"
  | "form"
  | "review"
  | "portal"
  | "agenda"
  | "comms"
  | "program"

export interface ProductShotProps extends React.ComponentProps<"figure"> {
  variant?: ProductShotVariant
  /** Real screenshot. When set it replaces the drawn mock inside the frame. */
  src?: string
  /** Accessible description of the shot. Defaults per variant. */
  alt?: string
  /** Address shown in the mock browser chrome. Defaults per variant. */
  url?: string
  /** `lg` gives the hero shot a deeper shadow. */
  elevation?: "default" | "lg"
}

const META: Record<ProductShotVariant, { url: string; alt: string }> = {
  dashboard: {
    url: "app.sessionboard.dev/dashboard",
    alt: "The organizer dashboard: event navigation, abstract and acceptance counts, and the latest submissions with their statuses.",
  },
  form: {
    url: "app.sessionboard.dev/forms/cfp",
    alt: "The call-for-speakers form builder: a step rail, question fields, and a conditional-logic rule shown on a question.",
  },
  review: {
    url: "app.sessionboard.dev/evaluation",
    alt: "The review queue: submissions with evaluator scores, pending and accept-queue filters, and staged decisions.",
  },
  portal: {
    url: "app.sessionboard.dev/portal",
    alt: "The speaker portal: a speaker's outstanding tasks, uploads and submission status.",
  },
  agenda: {
    url: "app.sessionboard.dev/agenda",
    alt: "The agenda builder: sessions laid out across rooms and time slots with a flagged scheduling conflict.",
  },
  comms: {
    url: "app.sessionboard.dev/communications",
    alt: "Speaker communications: message templates, a decision email preview, and an attached calendar invite.",
  },
  program: {
    url: "sessionboard.dev/e/ai-summit-2026",
    alt: "The public program: the published schedule with times, sessions and speakers.",
  },
}

export function ProductShot({
  variant = "dashboard",
  src,
  alt,
  url,
  elevation = "default",
  className,
  ...props
}: ProductShotProps) {
  const meta = META[variant]

  return (
    <figure
      data-slot="product-shot"
      data-variant={variant}
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        elevation === "lg"
          ? "shadow-[0_24px_60px_-24px_rgb(27_30_39/0.35)]"
          : "shadow-[0_12px_32px_-18px_rgb(27_30_39/0.30)]",
        className,
      )}
      {...props}
    >
      <BrowserChrome url={url ?? meta.url} />
      {src ? (
        <img
          src={src}
          alt={alt ?? meta.alt}
          className="block w-full"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <>
          <div
            aria-hidden
            className="pointer-events-none bg-background select-none"
          >
            {MOCKS[variant]}
          </div>
          <figcaption className="sr-only">{alt ?? meta.alt}</figcaption>
        </>
      )}
    </figure>
  )
}

/* ------------------------------------------------------------------------- */
/* Frame                                                                      */
/* ------------------------------------------------------------------------- */

function BrowserChrome({ url }: { url: string }) {
  return (
    <div
      aria-hidden
      className="flex h-9 items-center gap-2 border-b border-border/70 bg-muted/70 px-3 select-none"
    >
      <div className="flex gap-1.5">
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
      </div>
      <div className="mx-auto hidden max-w-[60%] min-w-0 truncate rounded-full bg-card px-3 py-0.5 text-[11px] text-muted-foreground ring-1 ring-foreground/10 sm:block">
        {url}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Mock primitives                                                            */
/* ------------------------------------------------------------------------- */

/** A neutral placeholder bar — stands in for a line of copy. */
function Bar({
  w = "w-full",
  className,
}: {
  w?: string
  className?: string
}) {
  return <span className={cn("block h-2 rounded-full bg-foreground/10", w, className)} />
}

function NavItem({
  label,
  active = false,
}: {
  label: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        "flex h-6 items-center rounded-md px-2 text-[11px] font-medium",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
}

function NavGroup({ label }: { label: string }) {
  return (
    <span className="px-2 pt-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
      {label}
    </span>
  )
}

function Panel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card p-3 ring-1 ring-foreground/10",
        className,
      )}
    >
      {children}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Panel className="p-2.5">
      <span className="font-heading block text-lg leading-tight font-semibold tracking-tight text-foreground">
        {value}
      </span>
      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
        {label}
      </span>
    </Panel>
  )
}

const TRACK_COLORS = [
  "bg-chart-1",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-2",
] as const

function TrackChip({ label, index }: { label: string; index: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          TRACK_COLORS[index % TRACK_COLORS.length],
        )}
      />
      {label}
    </span>
  )
}

function Initials({ value }: { value: string }) {
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[9px] font-medium text-accent-foreground ring-2 ring-card">
      {value}
    </span>
  )
}

function FakeButton({
  label,
  tone = "primary",
}: {
  label: string
  tone?: "primary" | "ghost"
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-[10px] font-medium",
        tone === "primary"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
}

function FieldRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] font-medium text-foreground">
        {label}
      </span>
      <div className="flex h-6 items-center rounded-md bg-card px-2 text-[10px] text-muted-foreground ring-1 ring-input">
        {value ?? <Bar w="w-1/2" />}
      </div>
    </div>
  )
}

/** Shared padding for every mock body. */
const BODY = "min-h-[248px] p-3 sm:min-h-[300px] sm:p-4"

/* ------------------------------------------------------------------------- */
/* Mocks                                                                      */
/* ------------------------------------------------------------------------- */

function DashboardMock() {
  const rows = [
    { title: "Shipping agents that don't break", track: "Agents", status: "pending" },
    { title: "Evals for production LLM apps", track: "Evals", status: "accept_queue" },
    { title: "RAG is dead, long live RAG", track: "Retrieval", status: "accepted" },
    { title: "The infra behind 10M tokens/s", track: "Infra", status: "pending" },
  ]

  return (
    <div className="flex min-h-[248px] sm:min-h-[320px]">
      <div className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-border/70 bg-sidebar p-2 sm:flex">
        <span className="mb-1 flex items-center gap-2 rounded-md bg-card px-2 py-1.5 ring-1 ring-foreground/10">
          <LogoMark size={18} className="rounded-[5px]" />
          <span className="truncate text-[11px] font-medium text-foreground">
            AI Summit 2026
          </span>
        </span>
        <NavGroup label="Program" />
        <NavItem label="Dashboard" active />
        <NavItem label="Abstracts" />
        <NavItem label="Sessions" />
        <NavGroup label="Collect & review" />
        <NavItem label="Forms" />
        <NavItem label="Evaluation" />
        <NavItem label="Agenda" />
        <NavItem label="Tasks" />
      </div>

      <div className="min-w-0 flex-1 space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-sm font-semibold text-foreground">
            Dashboard
          </span>
          <FakeButton label="New session" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat value="412" label="Abstracts" />
          <Stat value="128" label="Accepted" />
          <Stat value="37" label="Open tasks" />
        </div>

        <Panel className="p-0">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <span className="text-[11px] font-medium text-foreground">
              Latest submissions
            </span>
            <span className="text-[10px] text-muted-foreground">Last 24h</span>
          </div>
          <ul className="divide-y divide-border/70">
            {rows.map((row, index) => (
              <li
                key={row.title}
                className="flex items-center gap-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                  {row.title}
                </span>
                <span className="hidden sm:inline-flex">
                  <TrackChip label={row.track} index={index} />
                </span>
                <StatusPill status={row.status} size="sm" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function FormMock() {
  const steps = [
    "Submission setup",
    "Welcome screen",
    "Abstract information",
    "Participants",
    "Form settings",
    "Notifications",
  ]

  return (
    <div className="flex min-h-[248px] sm:min-h-[300px]">
      <ol className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border/70 bg-sidebar p-2 sm:flex">
        {steps.map((step, index) => (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px]",
              index === 2
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold",
                index < 2
                  ? "bg-status-green-bg text-status-green-fg"
                  : index === 2
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {index < 2 ? <RiCheckLine size={9} /> : index + 1}
            </span>
            <span className="truncate">{step}</span>
          </li>
        ))}
      </ol>

      <div className={cn("min-w-0 flex-1 space-y-3", BODY)}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-sm font-semibold text-foreground">
            Abstract information
          </span>
          <FakeButton label="Preview form" tone="ghost" />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <FieldRow label="Session title *" value="Shipping agents that…" />
          <FieldRow label="Track *" value="Agents" />
          <div className="sm:col-span-2">
            <FieldRow label="Abstract *" />
          </div>
        </div>

        <div className="rounded-lg bg-accent/60 p-2.5 ring-1 ring-primary/20">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-accent-foreground">
            <RiGitBranchLine size={12} />
            Conditional logic
          </span>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Show <span className="text-foreground">“Which agent framework?”</span>{" "}
            only when Track is <span className="text-foreground">Agents</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
            <span className="h-2.5 w-4 rounded-full bg-primary" />
            Required
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
            <span className="h-2.5 w-4 rounded-full bg-primary" />
            Enabled
          </span>
          <span className="ml-auto">6 questions · 2 rules</span>
        </div>
      </div>
    </div>
  )
}

function ReviewMock() {
  const rows = [
    { title: "Evals for production LLM apps", score: "4.6", status: "accept_queue" },
    { title: "The infra behind 10M tokens/s", score: "4.2", status: "accept_queue" },
    { title: "Prompt engineering is a job", score: "3.1", status: "pending" },
    { title: "Our vector DB migration", score: "2.4", status: "decline_queue" },
  ]

  return (
    <div className={cn("space-y-3", BODY)}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 flex-1 items-center gap-1.5 rounded-md bg-card px-2 text-[10px] text-muted-foreground ring-1 ring-input">
          <RiSearchLine size={11} />
          Search 412 abstracts
        </span>
        <FakeButton label="Commit queue" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusPill status="pending" size="sm" label="Pending · 42" />
        <StatusPill status="accept_queue" size="sm" label="Accept queue · 12" />
        <StatusPill status="decline_queue" size="sm" label="Decline queue · 8" />
      </div>

      <Panel className="p-0">
        <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-[10px] font-medium text-muted-foreground">
          <span className="flex-1">Submission</span>
          <span className="hidden w-20 sm:block">Evaluators</span>
          <span className="w-8 text-right">Score</span>
          <span className="w-24 text-right">Decision</span>
        </div>
        <ul className="divide-y divide-border/70">
          {rows.map((row) => (
            <li key={row.title} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                {row.title}
              </span>
              <span className="hidden w-20 items-center -space-x-1.5 sm:flex">
                <Initials value="AK" />
                <Initials value="RM" />
                <Initials value="JT" />
              </span>
              <span className="w-8 text-right text-[11px] font-medium text-foreground">
                {row.score}
              </span>
              <span className="flex w-24 justify-end">
                <StatusPill status={row.status} size="sm" />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

function PortalMock() {
  const tasks = [
    { label: "Upload your headshot", done: true },
    { label: "Confirm your session time", done: true },
    { label: "Submit slides (PDF)", done: false },
    { label: "Sign the recording release", done: false },
  ]

  return (
    <div className={cn("space-y-3", BODY)}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-[11px] font-medium text-accent-foreground">
          RM
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-foreground">
            Rina Moreau
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            Speaker · AI Summit 2026
          </span>
        </span>
        <StatusPill status="accepted" size="sm" />
      </div>

      <Panel className="p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
          <span className="text-[11px] font-medium text-foreground">
            Your tasks
          </span>
          <span className="text-[10px] text-muted-foreground">2 of 4 done</span>
        </div>
        <ul className="divide-y divide-border/70">
          {tasks.map((task) => (
            <li key={task.label} className="flex items-center gap-2 px-3 py-2">
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-[5px]",
                  task.done
                    ? "bg-primary text-primary-foreground"
                    : "bg-card ring-1 ring-input",
                )}
              >
                {task.done ? <RiCheckLine size={10} /> : null}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[11px]",
                  task.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {task.label}
              </span>
              {task.done ? null : (
                <span className="text-[10px] text-muted-foreground">
                  Due Mar 4
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-input bg-card p-2.5">
        <RiAttachment2 size={14} className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          Drop your slides here — PDF or Keynote, up to 50 MB
        </span>
        <FakeButton label="Upload" tone="ghost" />
      </div>
    </div>
  )
}

function AgendaMock() {
  const slots = [
    ["09:00", "Opening keynote", "", "Office hours"],
    ["10:00", "Agents in prod", "Evals workshop", ""],
    ["11:00", "", "Evals workshop", "RAG clinic"],
    ["12:00", "Infra at scale", "", "RAG clinic"],
  ]

  return (
    <div className={cn("space-y-2.5", BODY)}>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-6 items-center rounded-md bg-foreground px-2 text-[10px] font-medium text-background">
          Day 1
        </span>
        <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-[10px] text-muted-foreground">
          Day 2
        </span>
        <span className="ml-auto">
          <StatusPill status="failed" size="sm" label="1 conflict" />
        </span>
      </div>

      <div className="grid grid-cols-[34px_repeat(2,minmax(0,1fr))] gap-1.5 sm:grid-cols-[40px_repeat(3,minmax(0,1fr))]">
        <span />
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          Main Stage
        </span>
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          Workshop A
        </span>
        <span className="hidden truncate text-[10px] font-medium text-muted-foreground sm:block">
          Workshop B
        </span>

        {slots.map(([time, ...rooms], rowIndex) => (
          <div key={time} className="contents">
            <span className="pt-1 text-[9px] text-muted-foreground">{time}</span>
            {rooms.map((session, roomIndex) => (
              <div
                key={`${time}-${roomIndex}`}
                className={cn(
                  "h-9 rounded-md",
                  roomIndex === 2 && "hidden sm:block",
                  session
                    ? "bg-card p-1.5 ring-1 ring-foreground/10"
                    : "bg-muted/60",
                  rowIndex === 1 && roomIndex === 1
                    ? "ring-2 ring-status-red-dot/60"
                    : "",
                )}
              >
                {session ? (
                  <>
                    <span
                      className={cn(
                        "mb-1 block h-1 w-6 rounded-full",
                        TRACK_COLORS[roomIndex % TRACK_COLORS.length],
                      )}
                    />
                    <span className="block truncate text-[9px] leading-tight text-foreground">
                      {session}
                    </span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-md bg-status-red-bg px-2 py-1.5 text-[10px] text-status-red-fg">
        <span className="size-1.5 shrink-0 rounded-full bg-status-red-dot" />
        <span className="truncate">
          Rina Moreau is double-booked at 10:00 — Main Stage and Workshop A.
        </span>
      </div>
    </div>
  )
}

function CommsMock() {
  const templates = [
    { label: "Acceptance", active: true },
    { label: "Decline", active: false },
    { label: "Slides reminder", active: false },
    { label: "Room details", active: false },
  ]

  return (
    <div className="flex min-h-[248px] sm:min-h-[300px]">
      <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-border/70 bg-sidebar p-2 sm:flex">
        <NavGroup label="Templates" />
        {templates.map((template) => (
          <NavItem
            key={template.label}
            label={template.label}
            active={template.active}
          />
        ))}
      </div>

      <div className={cn("min-w-0 flex-1 space-y-2.5", BODY)}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-sm font-semibold text-foreground">
            Acceptance
          </span>
          <FakeButton label="Send to 128" />
        </div>

        <Panel className="space-y-2">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground">To</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
              128 accepted speakers
            </span>
          </div>
          <div className="text-[11px] font-medium text-foreground">
            You&rsquo;re speaking at AI Summit 2026 🎉
          </div>
          <div className="space-y-1.5 pt-0.5">
            <Bar w="w-full" />
            <Bar w="w-[92%]" />
            <Bar w="w-[70%]" />
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-accent/60 px-2 py-1.5 text-[10px] text-accent-foreground">
            <RiAttachment2 size={12} />
            ai-summit-2026.ics · Wed 10:00, Main Stage
          </div>
        </Panel>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <StatusPill status="sent" size="sm" label="Sent · 96" />
          <StatusPill status="scheduled" size="sm" label="Scheduled · 32" />
          <span className="ml-auto hidden sm:inline">
            Merge fields: name, session, room
          </span>
        </div>
      </div>
    </div>
  )
}

function ProgramMock() {
  const sessions = [
    { time: "09:00", title: "Opening keynote", room: "Main Stage" },
    { time: "10:00", title: "Agents in production", room: "Main Stage" },
    { time: "10:00", title: "Evals workshop", room: "Workshop A" },
    { time: "11:30", title: "RAG clinic", room: "Workshop B" },
  ]

  return (
    <div className={cn("space-y-3", BODY)}>
      <div className="rounded-lg bg-accent/60 p-3">
        <span className="font-heading block text-sm font-semibold text-foreground">
          AI Summit 2026
        </span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          March 3–4 · San Francisco · 128 sessions
        </span>
        <div className="mt-2 flex gap-1.5">
          <span className="inline-flex h-5 items-center rounded-md bg-foreground px-2 text-[9px] font-medium text-background">
            Schedule
          </span>
          <span className="inline-flex h-5 items-center rounded-md bg-card px-2 text-[9px] text-muted-foreground ring-1 ring-foreground/10">
            Speakers
          </span>
          <span className="inline-flex h-5 items-center rounded-md bg-card px-2 text-[9px] text-muted-foreground ring-1 ring-foreground/10">
            My schedule
          </span>
        </div>
      </div>

      <Panel className="p-0">
        <ul className="divide-y divide-border/70">
          {sessions.map((session, index) => (
            <li
              key={`${session.time}-${session.title}`}
              className="flex items-center gap-2.5 px-3 py-2"
            >
              <span className="w-9 shrink-0 text-[10px] font-medium text-muted-foreground">
                {session.time}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-foreground">
                  {session.title}
                </span>
                <span className="block truncate text-[9px] text-muted-foreground">
                  {session.room}
                </span>
              </span>
              <span className="flex -space-x-1.5">
                <Initials value="RM" />
                {index % 2 === 0 ? <Initials value="JT" /> : null}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

const MOCKS: Record<ProductShotVariant, React.ReactNode> = {
  dashboard: <DashboardMock />,
  form: <FormMock />,
  review: <ReviewMock />,
  portal: <PortalMock />,
  agenda: <AgendaMock />,
  comms: <CommsMock />,
  program: <ProgramMock />,
}
