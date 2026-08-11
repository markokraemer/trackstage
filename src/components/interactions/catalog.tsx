import { useEffect, useMemo, useRef, useState } from "react"
import {
  RiCalendarScheduleLine,
  RiCheckLine,
  RiInformationLine,
  RiSearchLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  BlurUpImage,
  CollapsibleBanner,
  CommandPalette,
  CopyButton,
  ExpandingSearch,
  FilterGrid,
  FloatingLabelInput,
  HideOnScroll,
  HoldToConfirm,
  IconMorph,
  InlineValidation,
  LikeBurst,
  Lightbox,
  LiveActivity,
  LoadMore,
  LoadingButton,
  LogoMarquee,
  LongPressButton,
  NewItemsPill,
  OtpInput,
  PasswordStrength,
  PepButton,
  PollResults,
  PresenceAvatars,
  PressDepth,
  ProgressBar,
  ReadingProgress,
  ReorderList,
  Ripple,
  ScrollSpy,
  SegmentedControl,
  ShowMore,
  SkeletonSwap,
  SliderDetents,
  SnapCarousel,
  SortableTable,
  StickyHeader,
  StreamingText,
  SwipeDeck,
  TagInput,
  TaskSteps,
  TextReveal,
  TreeView,
  TypingIndicator,
  ValueFlash,
  WizardSteps,
} from "@/components/interactions"
import type { Activity } from "@/components/interactions"

/* ------------------------------------------------------------------ shell */

/**
 * Mounts its children only while the tile is anywhere near the viewport.
 *
 * This catalogue is ~45 live demos on one page, and a good third of them are
 * self-driving: typing indicators, streaming text, value flashes, presence
 * avatars, progress bars. Mounted all at once they left six `setInterval`s and
 * a permanent ~120fps rAF loop running behind everything you scrolled past,
 * which is what read as the page "flickering". Off-screen tiles now render a
 * placeholder of the height the demo last occupied, so nothing shifts when a
 * tile swaps back in — the page is still, and only what you are looking at
 * moves.
 */
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  // Deliberately starts UNMOUNTED. Mounting all 45 tiles for even one frame
  // leaves a self-rescheduling rAF loop running afterwards (at least one
  // interior demo does not cancel its loop on unmount), which is the exact
  // idle churn this gate exists to remove.
  const [visible, setVisible] = useState(false)
  const [height, setHeight] = useState<number>()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // No IntersectionObserver (jsdom, ancient Safari) → render everything.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      // A screen of slack either side: the demo is already running by the
      // time it scrolls into view, so nothing pops.
      { rootMargin: "600px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Keep the placeholder honest: whatever the live demo measures while it is
  // mounted is the height the empty tile holds open once it unmounts.
  useEffect(() => {
    const node = ref.current
    if (!visible || !node || typeof ResizeObserver === "undefined") return
    const resize = new ResizeObserver(() => {
      if (node.offsetHeight > 0) setHeight(node.offsetHeight)
    })
    resize.observe(node)
    return () => resize.disconnect()
  }, [visible])

  return { ref, visible, height }
}

/** Matches the `Sample` card used across the rest of /design-system. */
function Demo({
  name,
  use,
  children,
  tall = false,
}: {
  name: string
  use: string
  children: React.ReactNode
  tall?: boolean
}) {
  const { ref, visible, height } = useNearViewport<HTMLDivElement>()

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <p className="font-mono text-xs font-medium text-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{use}</p>
      </div>
      <div
        ref={ref}
        style={!visible && height ? { height } : undefined}
        className={cn(
          "flex flex-1 items-center justify-center bg-background/60 p-5",
          tall && "min-h-56",
        )}
      >
        <div className="w-full max-w-sm">{visible ? children : null}</div>
      </div>
    </div>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <p className="pt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </p>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------- 1. action feedback */

function ActionFeedback() {
  const [likeCount, setLikeCount] = useState(18)

  return (
    <Group title="Action feedback">
      <Demo
        name="copy-button"
        use="Public CFP link, portal link, evaluator magic links, API keys."
      >
        <div className="flex justify-center">
          <CopyButton value="https://trackstage.app/submit/ai-engineer-2026" />
        </div>
      </Demo>

      <Demo
        name="loading-button"
        use="Every async submit: save form, send invite, commit a decision queue."
      >
        <div className="flex justify-center">
          <LoadingButton
            onAction={async () => {
              await wait(1100)
            }}
            successLabel="Saved"
          >
            Save changes
          </LoadingButton>
        </div>
      </Demo>

      <Demo
        name="hold-to-confirm"
        use="Irreversible organizer actions — commit accept/decline queue, delete an event."
      >
        <div className="flex justify-center">
          <HoldToConfirm onConfirm={() => undefined} confirmLabel="Sent">
            Hold to send 24 decisions
          </HoldToConfirm>
        </div>
      </Demo>

      <Demo
        name="like-burst"
        use="Evaluator shortlisting — a one-tap 'I want this talk' with optimistic count."
      >
        <div className="flex justify-center">
          <LikeBurst
            initialCount={likeCount}
            onCommit={async (liked) => {
              await wait(400)
              setLikeCount((n) => n + (liked ? 1 : -1))
            }}
            label="Shortlist"
            activeLabel="Shortlisted"
          />
        </div>
      </Demo>

      <Demo
        name="ripple"
        use="Touch feedback on large tap targets: agenda slots, mobile portal rows."
      >
        <Ripple
          className="w-full rounded-xl border border-border bg-card"
          onPress={() => undefined}
        >
          <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <RiCalendarScheduleLine
              size={18}
              aria-hidden
              className="text-muted-foreground"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">Building agents that ship</p>
              <p className="text-xs text-muted-foreground">
                Track A · 10:00 – 10:30
              </p>
            </div>
          </div>
        </Ripple>
      </Demo>

      <Demo
        name="icon-morph"
        use="Sidebar collapse, drawer close, expand/collapse toggles in the agenda."
      >
        <div className="flex justify-center gap-6">
          <IconMorph preset="menu-close" showLabel />
          <IconMorph preset="plus-minus" showLabel />
          <IconMorph preset="check-close" showLabel />
        </div>
      </Demo>

      <Demo
        name="press-depth"
        use="Raw mechanic. Prefer PepButton below, which wears our button variants."
      >
        <div className="flex justify-center">
          <PressDepth>Press me</PressDepth>
        </div>
      </Demo>

      <Demo
        name="PepButton (ours)"
        use="Opt-in wrapper: press-depth on shadcn buttonVariants. Hero CTAs only."
      >
        <div className="flex flex-wrap items-end justify-center gap-3">
          <PepButton>Submit a talk</PepButton>
          <PepButton variant="outline">Preview</PepButton>
          <PepButton variant="secondary" size="sm">
            Duplicate
          </PepButton>
        </div>
      </Demo>
    </Group>
  )
}

/* ------------------------------------------------------------ 2. input */

const emailValidator = (value: string) => {
  if (!value.trim()) return "Email is required"
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
    return "That isn’t a valid email"
  return null
}

function Inputs() {
  const [floating, setFloating] = useState("")
  const [email, setEmail] = useState("speaker@")
  const [password, setPassword] = useState("Session")
  const [tags, setTags] = useState(["ai", "devtools"])
  const [otpStatus, setOtpStatus] = useState<"idle" | "error" | "success">(
    "idle"
  )

  return (
    <Group title="Input">
      <Demo
        name="floating-label"
        use="Compact forms where a separate label would cost a row — drawers, filters."
      >
        <FloatingLabelInput
          label="Session title"
          value={floating}
          onChange={setFloating}
          hint="Shown publicly on the agenda"
        />
      </Demo>

      <Demo
        name="inline-validation"
        use="Public CFP fields — the error appears without shoving the rest of the form."
      >
        <InlineValidation
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          validate={emailValidator}
          hint="We send decisions here"
        />
      </Demo>

      <Demo
        name="password-strength"
        use="Better Auth sign-up and password reset."
      >
        <div className="space-y-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="text"
            aria-label="Password"
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <PasswordStrength value={password} />
        </div>
      </Demo>

      <Demo
        name="otp-input"
        use="Speaker-portal magic-link codes and evaluator access codes."
      >
        <OtpInput
          length={6}
          status={otpStatus}
          errorMessage="That code didn’t match"
          successMessage="Verified"
          onComplete={(code) =>
            setOtpStatus(code === "123456" ? "success" : "error")
          }
          onChange={() => setOtpStatus("idle")}
          hint="Try 123456"
        />
      </Demo>

      <Demo
        name="tag-input"
        use="Form-builder select options, session tags, track keywords."
      >
        <TagInput label="Tags" value={tags} onChange={setTags} max={6} />
      </Demo>

      <Demo
        name="expanding-search"
        use="DataToolbar on Abstracts / Sessions / Speakers, and the app top bar."
      >
        <div className="flex justify-end">
          <ExpandingSearch placeholder="Search abstracts" resultCount={12} />
        </div>
      </Demo>
    </Group>
  )
}

/* ------------------------------------------------------------ 3. async */

const TASKS = [
  { id: "parse", label: "Reading submissions", meta: "412 rows" },
  { id: "route", label: "Routing to tracks" },
  { id: "assign", label: "Assigning evaluators" },
  { id: "notify", label: "Queueing emails" },
]

function Async() {
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [loaded, setLoaded] = useState(3)

  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => (s + 1) % (TASKS.length + 1)),
      1400
    )
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p === null ? 0 : p >= 100 ? null : p + 12))
    }, 700)
    return () => clearInterval(id)
  }, [])

  return (
    <Group title="Async">
      <Demo
        name="skeleton-swap"
        use="Every Convex-backed list on first paint — reserves height, so no jump."
      >
        <div className="space-y-3">
          <SkeletonSwap ready={ready} lines={3} label="Loading abstracts">
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">Building agents that ship</p>
              <p className="text-muted-foreground">
                Pending · Track A · submitted 2 days ago
              </p>
              <p className="text-muted-foreground">3 evaluators assigned</p>
            </div>
          </SkeletonSwap>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReady((r) => !r)}
          >
            {ready ? "Reset" : "Load"}
          </Button>
        </div>
      </Demo>

      <Demo
        name="progress-bar"
        use="Airtable sync, bulk email send, CSV import — indeterminate → determinate."
      >
        <ProgressBar value={progress} label="Syncing to Airtable" />
      </Demo>

      <Demo
        name="load-more"
        use="Paginated Abstracts / Speakers lists — loads before the user hits bottom."
      >
        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            {loaded} of 9 abstracts
          </p>
          <LoadMore
            auto={false}
            hasMore={loaded < 9}
            onLoad={async () => {
              await wait(700)
              setLoaded((n) => Math.min(9, n + 3))
            }}
          />
        </div>
      </Demo>

      <Demo
        name="streaming-text"
        use="AI-ish moments: generated session summaries, evaluator note drafts."
      >
        <StreamingText
          text="Three strong submissions cluster around agent evaluation. Two overlap heavily with the Tuesday keynote — consider moving one to Track B."
          tokensPerSecond={22}
        />
      </Demo>

      <Demo
        name="task-steps"
        use="Speaker onboarding checklist and long organizer jobs (bulk decisions)."
        tall
      >
        <TaskSteps
          steps={TASKS}
          current={step}
          label="Processing submissions"
        />
      </Demo>
    </Group>
  )
}

/* ----------------------------------------------------- 4. notification */

const PEOPLE = [
  { id: "1", name: "Ada Lovelace" },
  { id: "2", name: "Grace Hopper" },
  { id: "3", name: "Alan Turing" },
  { id: "4", name: "Katherine Johnson" },
  { id: "5", name: "Barbara Liskov" },
  { id: "6", name: "Linus Torvalds" },
]

function Notifications() {
  const [visible, setVisible] = useState(3)
  const [typing, setTyping] = useState(1)
  const [count, setCount] = useState(0)
  const [activity, setActivity] = useState<Activity | null>({
    id: "sync",
    title: "Sending 24 decisions",
    detail: "18 of 24 delivered",
    progress: 0.75,
    phase: "running",
  })

  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c + 1) % 8), 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <Group title="Notification">
      <Demo
        name="live-activity"
        use="Background organizer jobs — bulk email, Airtable sync — as a small dock."
        tall
      >
        <div className="space-y-3">
          <LiveActivity
            activity={activity}
            onDismiss={() => setActivity(null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setActivity({
                  id: "sync",
                  title: "Sending 24 decisions",
                  detail: "18 of 24 delivered",
                  progress: 0.75,
                  phase: "running",
                })
              }
            >
              Running
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setActivity({
                  id: "sync",
                  title: "All 24 decisions sent",
                  phase: "success",
                })
              }
            >
              Success
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setActivity({
                  id: "sync",
                  title: "3 emails bounced",
                  detail: "Seeded @example.com recipients",
                  phase: "error",
                  action: { label: "View outbox", onClick: () => undefined },
                })
              }
            >
              Error
            </Button>
          </div>
        </div>
      </Demo>

      <Demo
        name="collapsible-banner"
        use="'Your CFP closes in 3 days' / setup nudges — folds to its title, then goes."
      >
        <CollapsibleBanner
          icon={<RiInformationLine size={16} aria-hidden />}
          title="Your call for papers closes in 3 days"
          description="217 abstracts so far. Reminders go out automatically to speakers who started but didn’t submit."
          action={
            <Button size="xs" variant="outline">
              Extend deadline
            </Button>
          }
        />
      </Demo>

      <Demo
        name="presence-avatars"
        use="Speakers on a session, evaluators in a plan, org members in settings."
      >
        <div className="space-y-3">
          <PresenceAvatars
            people={PEOPLE.slice(0, visible)}
            label="Evaluators"
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setVisible((v) => Math.max(1, v - 1))}
            >
              Leave
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setVisible((v) => Math.min(PEOPLE.length, v + 1))}
            >
              Join
            </Button>
          </div>
        </div>
      </Demo>

      <Demo
        name="typing-indicator"
        use="Evaluator discussion threads and organizer↔speaker message threads."
      >
        <div className="space-y-3">
          <TypingIndicator
            typists={PEOPLE.slice(0, typing).map((p) => p.name)}
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setTyping((t) => Math.max(0, t - 1))}
            >
              −
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setTyping((t) => Math.min(3, t + 1))}
            >
              +
            </Button>
          </div>
        </div>
      </Demo>

      <Demo
        name="new-items-pill"
        use="Live Convex subscriptions — new abstracts arrive without stealing scroll."
        tall
      >
        <div className="relative h-40 overflow-hidden rounded-lg border border-border bg-card p-3">
          <NewItemsPill count={count} onJump={() => setCount(0)} />
          <div className="space-y-2 pt-10 text-xs text-muted-foreground">
            <p>Building agents that ship — Pending</p>
            <p>Evaluating RAG in production — Accepted</p>
            <p>The cost of tokens — Accept queue</p>
          </div>
        </div>
      </Demo>
    </Group>
  )
}

/* ------------------------------------------------------- 5. navigation */

const COMMANDS = [
  { id: "new-abstract", label: "New abstract", shortcut: ["N"] },
  {
    id: "agenda",
    label: "Go to agenda",
    hint: "Program",
    shortcut: ["G", "A"],
  },
  { id: "forms", label: "Open form builder", hint: "Collect & Review" },
  { id: "invite", label: "Invite a member", hint: "Settings" },
  { id: "export", label: "Export submissions as CSV" },
]

const TREE = [
  {
    id: "program",
    label: "Program",
    children: [
      { id: "day-1", label: "Day 1", meta: "18 sessions" },
      {
        id: "day-2",
        label: "Day 2",
        children: [
          { id: "track-a", label: "Track A", meta: "9 sessions" },
          { id: "track-b", label: "Track B", meta: "7 sessions" },
        ],
      },
    ],
  },
  { id: "unscheduled", label: "Unscheduled", meta: "4 sessions" },
]

const WIZARD = [
  {
    id: "setup",
    label: "Submission setup",
    content: (
      <p className="text-sm text-muted-foreground">
        Name the form, pick the event, set a close date.
      </p>
    ),
  },
  {
    id: "welcome",
    label: "Welcome screen",
    content: (
      <p className="text-sm text-muted-foreground">
        The first thing a speaker reads. Keep it short.
      </p>
    ),
  },
  {
    id: "abstract",
    label: "Abstract information",
    content: (
      <p className="text-sm text-muted-foreground">
        Title, description, track, format, level — each Required / Enabled.
      </p>
    ),
  },
]

function Navigation() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [view, setView] = useState("list")

  return (
    <Group title="Navigation">
      <Demo
        name="command-palette"
        use="⌘K across the organizer app — jump to any event, screen, or record."
      >
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setPaletteOpen(true)}>
            Open palette
          </Button>
          <CommandPalette
            open={paletteOpen}
            items={COMMANDS}
            autoFocus
            onSelect={() => setPaletteOpen(false)}
            onDismiss={() => setPaletteOpen(false)}
          />
        </div>
      </Demo>

      <Demo
        name="segmented-control"
        use="Agenda view switcher (List / Day / Week / Rooms / Conflicts)."
      >
        <SegmentedControl
          label="Agenda view"
          value={view}
          onValueChange={setView}
          options={[
            { value: "list", label: "List" },
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
          ]}
        />
      </Demo>

      <Demo
        name="wizard-steps"
        use="Form builder's 7-step rail and the public CFP's 5-step tracker."
        tall
      >
        <WizardSteps steps={WIZARD} label="Form builder" />
      </Demo>

      <Demo
        name="tree-view"
        use="Agenda by day → track → room, and the settings navigator."
        tall
      >
        <TreeView
          nodes={TREE}
          label="Program"
          defaultExpanded={["program", "day-2"]}
        />
      </Demo>
    </Group>
  )
}

/* ----------------------------------------------------------- 6. scroll */

const SPY_SECTIONS = [
  { id: "spy-overview", label: "Overview" },
  { id: "spy-speakers", label: "Speakers" },
  { id: "spy-schedule", label: "Schedule" },
]

function Filler({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      {Array.from({ length: n }, (_, i) => (
        <p key={i}>
          Row {i + 1} — abstract, speaker, track, status, submitted date.
        </p>
      ))}
    </div>
  )
}

function Scroll() {
  const article = useRef<HTMLDivElement>(null)
  const spyRoot = useRef<HTMLDivElement>(null)

  return (
    <Group title="Scroll">
      <Demo
        name="sticky-header"
        use="Every organizer page header — condenses as the table scrolls under it."
        tall
      >
        <StickyHeader
          title="Abstracts"
          subtitle="217 submissions · 3 tracks"
          actions={
            <Button size="xs" variant="outline">
              Export
            </Button>
          }
          maxHeight={220}
        >
          <Filler n={12} />
        </StickyHeader>
      </Demo>

      <Demo
        name="reading-progress"
        use="Long speaker-facing docs: CFP guidelines, code of conduct, event handbook."
        tall
      >
        <div className="space-y-2">
          <ReadingProgress scroller={article} words={480} />
          <div
            ref={article}
            className="h-40 overflow-y-auto rounded-lg border border-border bg-card p-3"
          >
            <Filler n={18} />
          </div>
        </div>
      </Demo>

      <Demo
        name="scroll-spy"
        use="Landing page section nav and the long Settings page rail."
        tall
      >
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <ScrollSpy sections={SPY_SECTIONS} root={spyRoot} offset={12} />
          <div
            ref={spyRoot}
            className="h-40 overflow-y-auto rounded-lg border border-border bg-card p-3"
          >
            {SPY_SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="pb-6">
                <p className="text-sm font-medium">{s.label}</p>
                <Filler n={4} />
              </section>
            ))}
          </div>
        </div>
      </Demo>

      <Demo
        name="snap-carousel"
        use="Landing screenshot gallery and mobile agenda day-by-day paging."
        tall
      >
        <SnapCarousel label="Screens" peek={24}>
          {["Dashboard", "Agenda", "Abstracts", "Portal"].map((s) => (
            <div
              key={s}
              className="grid h-28 place-items-center rounded-xl border border-border bg-accent text-sm font-medium text-accent-foreground"
            >
              {s}
            </div>
          ))}
        </SnapCarousel>
      </Demo>

      <Demo
        name="hide-on-scroll"
        use="DataToolbar on long tables — the filter bar yields to the rows."
        tall
      >
        <HideOnScroll
          maxHeight={200}
          bar={
            <div className="flex h-11 items-center gap-2 border-b border-border bg-card px-3">
              <RiSearchLine
                size={15}
                aria-hidden
                className="text-muted-foreground"
              />
              <span className="text-xs text-muted-foreground">
                Filter 217 abstracts
              </span>
            </div>
          }
        >
          <div className="p-3">
            <Filler n={16} />
          </div>
        </HideOnScroll>
      </Demo>
    </Group>
  )
}

/* ------------------------------------------------------------- 7. data */

type Abstract = {
  id: string
  title: string
  track: string
  score: number
}

const ABSTRACTS: Abstract[] = [
  { id: "a", title: "Building agents that ship", track: "Agents", score: 4.6 },
  { id: "b", title: "Evaluating RAG in production", track: "RAG", score: 4.2 },
  { id: "c", title: "The cost of tokens", track: "Ops", score: 3.9 },
  { id: "d", title: "Prompt regression testing", track: "Agents", score: 4.4 },
  { id: "e", title: "Vector stores, honestly", track: "RAG", score: 3.4 },
]

function Data() {
  const [metric, setMetric] = useState(217)

  useEffect(() => {
    const id = setInterval(
      () => setMetric((m) => m + Math.round((Math.random() - 0.3) * 9)),
      1800
    )
    return () => clearInterval(id)
  }, [])

  const columns = useMemo(
    () => [
      { id: "title", header: "Abstract", value: (r: Abstract) => r.title },
      { id: "track", header: "Track", value: (r: Abstract) => r.track },
      {
        id: "score",
        header: "Score",
        numeric: true,
        align: "end" as const,
        value: (r: Abstract) => r.score,
        cell: (r: Abstract) => r.score.toFixed(1),
      },
    ],
    []
  )

  return (
    <Group title="Data">
      <Demo
        name="sortable-table"
        use="Abstracts / Sessions / Speakers tables — rows travel to their new order."
        tall
      >
        <SortableTable
          rows={ABSTRACTS}
          columns={columns}
          getRowId={(r) => r.id}
          label="Abstracts"
          defaultSort={{ columnId: "score", direction: "desc" }}
        />
      </Demo>

      <Demo
        name="filter-grid"
        use="Track / status filter chips over the submissions and speakers grids."
        tall
      >
        <FilterGrid
          items={ABSTRACTS}
          label="Abstracts by track"
          getKey={(r) => r.id}
          columns={2}
          rowHeight={56}
          filters={[
            { id: "all", label: "All", match: () => true },
            {
              id: "agents",
              label: "Agents",
              match: (r) => r.track === "Agents",
            },
            { id: "rag", label: "RAG", match: (r) => r.track === "RAG" },
            { id: "ops", label: "Ops", match: (r) => r.track === "Ops" },
          ]}
          renderItem={(r) => (
            <div className="flex h-full flex-col justify-center rounded-lg border border-border bg-card px-3">
              <p className="truncate text-xs font-medium">{r.title}</p>
              <p className="text-[11px] text-muted-foreground">{r.track}</p>
            </div>
          )}
        />
      </Demo>

      <Demo
        name="value-flash"
        use="Dashboard metrics on live Convex subscriptions — marks what just changed."
      >
        <div className="flex items-baseline justify-center gap-2">
          <ValueFlash value={metric} label="Abstracts received" />
          <span className="text-xs text-muted-foreground">abstracts</span>
        </div>
      </Demo>

      <Demo
        name="poll-results"
        use="Evaluation round outcomes and audience-vote style track breakdowns."
      >
        <PollResults
          label="Preferred slot length"
          options={[
            { id: "20", label: "20 minutes", votes: 42 },
            { id: "30", label: "30 minutes", votes: 61 },
            { id: "45", label: "45 minutes", votes: 17 },
          ]}
        />
      </Demo>
    </Group>
  )
}

/* ---------------------------------------------------------- 8. gesture */

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F5CE0"/><stop offset="1" stop-color="#7D9BF2"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="480" cy="110" r="70" fill="#ffffff" fill-opacity="0.18"/><rect x="60" y="250" width="220" height="16" rx="8" fill="#ffffff" fill-opacity="0.45"/><rect x="60" y="286" width="140" height="12" rx="6" fill="#ffffff" fill-opacity="0.3"/></svg>`
  )

const BLUR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="#4a6fe3"/></svg>`
  )

function Gestures() {
  const [rating, setRating] = useState(60)
  const [order, setOrder] = useState([
    { id: "q1", label: "Session title" },
    { id: "q2", label: "Abstract description" },
    { id: "q3", label: "Track" },
    { id: "q4", label: "Speaker bio" },
  ])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const thumb = useRef<HTMLButtonElement>(null)
  const [decided, setDecided] = useState<string[]>([])

  return (
    <Group title="Gesture">
      <Demo
        name="slider-detents"
        use="Evaluator scoring (1–5 with felt stops) and agenda slot-length pickers."
      >
        <SliderDetents
          label="Score"
          value={rating}
          onValueChange={setRating}
          detents={[
            { value: 0, label: "1" },
            { value: 25, label: "2" },
            { value: 50, label: "3" },
            { value: 75, label: "4" },
            { value: 100, label: "5" },
          ]}
          format={(v) => `${Math.round(v / 25) + 1} / 5`}
        />
      </Demo>

      <Demo
        name="swipe-deck"
        use="Evaluator triage — decide a stack of abstracts one card at a time."
        tall
      >
        <SwipeDeck
          items={ABSTRACTS.filter((a) => !decided.includes(a.id))}
          itemKey={(a) => a.id}
          itemLabel={(a) => a.title}
          leftLabel="Decline"
          rightLabel="Accept"
          onDecide={(a) => setDecided((d) => [...d, a.id])}
          onUndo={(a) => setDecided((d) => d.filter((id) => id !== a.id))}
        >
          {(a) => (
            <div className="flex h-full flex-col justify-center px-4">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.track} · score {a.score.toFixed(1)}
              </p>
            </div>
          )}
        </SwipeDeck>
      </Demo>

      <Demo
        name="reorder-list"
        use="Form-builder question order and agenda running order."
        tall
      >
        <ReorderList
          items={order}
          label="Form questions"
          getId={(q) => q.id}
          getLabel={(q) => q.label}
          onReorder={setOrder}
        >
          {(q) => <span className="text-sm">{q.label}</span>}
        </ReorderList>
      </Demo>

      <Demo
        name="long-press"
        use="Touch equivalent of right-click: bulk-select rows, agenda slot actions."
      >
        <div className="flex justify-center">
          <LongPressButton onLongPress={() => undefined}>
            Hold to select all
          </LongPressButton>
        </div>
      </Demo>

      <Demo
        name="lightbox"
        use="Speaker headshots and sponsor artwork — zoom that returns where it started."
        tall
      >
        <div className="flex justify-center">
          <button
            ref={thumb}
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="overflow-hidden rounded-xl border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <img src={PHOTO} alt="Speaker headshot" width={192} height={120} />
          </button>
          <Lightbox
            open={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
            src={PHOTO}
            alt="Speaker headshot"
            caption="Ada Lovelace — opening keynote"
            originRef={thumb}
          />
        </div>
      </Demo>
    </Group>
  )
}

/* ---------------------------------------------------------- 9. content */

const LOGOS = [
  "Anthropic",
  "Convex",
  "Cloudflare",
  "TanStack",
  "Resend",
  "Base UI",
]

function Content() {
  return (
    <Group title="Content">
      <Demo
        name="text-reveal"
        use="Landing hero headline and section intros — words arrive in reading order."
      >
        <TextReveal
          text="Run your call for papers without the drag."
          className="text-center font-heading text-lg font-semibold tracking-tight"
        />
      </Demo>

      <Demo
        name="logo-marquee"
        use="Landing 'built on' / sponsor strip — stops when you look at it."
      >
        <LogoMarquee
          label="Built on"
          items={LOGOS.map((name) => ({
            id: name,
            label: name,
            mark: (
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <LogoMark size={16} />
                {name}
              </span>
            ),
          }))}
        />
      </Demo>

      <Demo
        name="blur-up-image"
        use="Speaker headshots and landing screenshots — placeholder resolves in."
      >
        <div className="flex justify-center">
          <BlurUpImage
            src={PHOTO}
            placeholder={BLUR_PLACEHOLDER}
            alt="Event photo"
            width={256}
            height={160}
            radius={11}
          />
        </div>
      </Demo>

      <Demo
        name="show-more"
        use="Long abstract descriptions in tables, drawers, and the speaker portal."
      >
        <ShowMore lines={3} label="Abstract">
          <p className="text-sm text-muted-foreground">
            Agents are easy to demo and hard to ship. This talk walks through
            the three failure modes we hit taking an agent from a notebook to
            production — silent tool errors, unbounded context growth, and
            evaluation drift — and the small, boring engineering practices that
            fixed each one. You’ll leave with a checklist you can run against
            your own agent this week, plus the traces and dashboards we use to
            catch regressions before customers do.
          </p>
        </ShowMore>
      </Demo>
    </Group>
  )
}

/* ------------------------------------------------------------- catalog */

export function InteractionsCatalog() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-accent/50 px-4 py-3 text-xs text-accent-foreground">
        <RiCheckLine size={15} aria-hidden className="mt-px shrink-0" />
        <p>
          45 of interior.dev’s 54 registry items, restyled onto our tokens. The
          nine a11y-critical overlays (modal, popover, drawer, dropdown,
          context-menu, tabs, accordion, tooltip-group, pagination) were{" "}
          <strong>not</strong> adopted — our shadcn-on-Base-UI versions stay
          canonical. Import everything from{" "}
          <code className="font-mono">@/components/interactions</code>.
        </p>
      </div>
      <ActionFeedback />
      <Inputs />
      <Async />
      <Notifications />
      <Navigation />
      <Scroll />
      <Data />
      <Gestures />
      <Content />
    </div>
  )
}
