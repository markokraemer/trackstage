/**
 * Design-language explorations — /design-system §Explorations.
 *
 * Marko's brief (docs/memory/RULES.md #20): keep the current language shipping,
 * but put concrete candidates on the design-system page and choose from them.
 * Three independent axes, each shown on the SAME mini organizer dashboard:
 *
 * 1. **Colour & feel** — De-blued and Attio (the two finalists), Juicebox-soft
 *    as the soft secondary, against what we ship today.
 * 2. **Accent** — a teal-family alternative to Sessionboard blue, switchable on
 *    every panel below.
 * 3. **Type** — four pairings, from the Inter baseline to a distinctive one.
 *
 * Nothing here leaks into the app. The candidate fonts are loaded by this
 * module only, palettes are scoped custom-property overrides on the panel
 * element, and the global `--font-sans` stack is untouched.
 */

import "@fontsource-variable/instrument-sans"
import "@fontsource-variable/bricolage-grotesque"
import "@fontsource-variable/space-grotesk"
import "@fontsource-variable/newsreader"
import "@fontsource-variable/public-sans"
import "@fontsource-variable/sora"
import "./explorations.css"

import { useState } from "react"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightUpLine,
  RiCheckLine,
  RiFilter3Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { StatusPill, statusLabel } from "@/components/shared/status-pill"

/* ------------------------------------------------------------- axis: type */

const INTER = "'Inter Variable', sans-serif"

interface TypeCandidate {
  id: string
  letter: string
  name: string
  pairing: string
  personality: string
  changes: string
  heading: string
  body: string
}

const TYPE_CANDIDATES: Array<TypeCandidate> = [
  {
    id: "current",
    letter: "A",
    name: "Current",
    pairing: "Inter for everything",
    personality:
      "The neutral default — maximum legibility, no opinion of its own.",
    changes:
      "Nothing. This is the baseline the other three are measured against.",
    heading: INTER,
    body: INTER,
  },
  {
    id: "editorial",
    letter: "B",
    name: "Editorial",
    pairing: "Newsreader headings · Instrument Sans body",
    personality:
      "Warm, confident and print-like — a well-set conference programme.",
    changes:
      "Headings become a serif, so titles carry the brand instead of the colour. Body copy gets slightly wider, friendlier letterforms; numbers and tables read the same.",
    heading: "'Newsreader Variable', Georgia, serif",
    body: "'Instrument Sans Variable', sans-serif",
  },
  {
    id: "grotesk",
    letter: "C",
    name: "Grotesk",
    pairing: "Space Grotesk headings · Public Sans body",
    personality: "Technical and sharp — reads like well-made software.",
    changes:
      "Headings pick up squared terminals and a wider stance. Body switches to Public Sans (the US design system's workhorse), a touch more formal than Inter.",
    heading: "'Space Grotesk Variable', sans-serif",
    body: "'Public Sans Variable', sans-serif",
  },
  {
    id: "character",
    letter: "D",
    name: "Character",
    pairing: "Bricolage Grotesque headings · Instrument Sans body",
    personality:
      "Distinctive and human without getting cute — the one nobody mistakes for a template.",
    changes:
      "Headings gain hand-cut, variable-width forms with real personality; body stays quiet so dense screens do not get louder.",
    heading: "'Bricolage Grotesque Variable', sans-serif",
    body: "'Instrument Sans Variable', sans-serif",
  },
]

const CURRENT_TYPE = TYPE_CANDIDATES[0]
const CHARACTER_TYPE = TYPE_CANDIDATES[3]

/* ----------------------------------------------------------- axis: accent */

interface Accent {
  id: string
  name: string
  hex: string
}

/**
 * Corporate-safe teal family — deep enough for white button text, none of them
 * neon. `blue` is what ships today, kept first so a panel can always be put
 * back.
 */
const ACCENTS: Array<Accent> = [
  { id: "blue", name: "Sessionboard blue", hex: "#2F5CE0" },
  { id: "teal", name: "Deep teal", hex: "#0F766E" },
  { id: "verdigris", name: "Verdigris", hex: "#0D9488" },
  { id: "petrol", name: "Petrol", hex: "#155E63" },
  { id: "jade", name: "Muted jade", hex: "#0E8A5F" },
]

/** An accent swap is literally these four tokens. */
function accentTokens(hex: string): Record<string, string> {
  return {
    "--primary": hex,
    "--ring": hex,
    "--sidebar-primary": hex,
    "--chart-1": hex,
  }
}

/* ------------------------------------------------------------ axis: feel */

interface PaletteCandidate {
  id: string
  tokens: Record<string, string>
  /** Shape overrides that no token can express. Never density — see #20. */
  panelClassName?: string
  defaultAccent: string
  /** Restrict the accent picker to a shortlist for this candidate. */
  accentIds?: Array<string>
  /** Attio has no tinted module banners — the page title just sits there. */
  headerVariant?: "banner" | "plain"
  /** `dot` = coloured dot + plain label instead of a tinted pill. */
  statusStyle?: "pill" | "dot"
}

/** What ships today: lavender banner, blue-tinted sidebar and pills. */
const CURRENT_PALETTE: PaletteCandidate = {
  id: "current",
  tokens: {},
  defaultAccent: "blue",
}

/**
 * "De-blued": every tinted surface goes neutral and #2F5CE0 is reserved for
 * primary buttons, links, focus rings and the active nav item.
 */
const DEBLUED_PALETTE: PaletteCandidate = {
  id: "deblued",
  defaultAccent: "blue",
  tokens: {
    "--accent": "#f4f5f7",
    "--accent-foreground": "#1b1e27",
    "--secondary": "#f4f5f7",
    "--secondary-foreground": "#1b1e27",
    "--muted": "#f4f5f7",
    "--sidebar": "#f7f8f9",
    "--sidebar-accent": "#eceef1",
    "--sidebar-accent-foreground": "#1b1e27",
    "--sidebar-border": "#e6e8eb",
    "--status-blue-bg": "#eceef1",
    "--status-blue-fg": "#414753",
    "--status-blue-dot": "#8a919e",
  },
}

/**
 * "Attio": the gold standard Marko named. Near-white warm-grey chrome, hairline
 * borders instead of fills, small-radius controls, a quiet three-step text
 * hierarchy and immaculate table craft — with his caveat applied: we take the
 * SYSTEM, not the density. Row heights, control sizes and padding stay exactly
 * where they are today, because Attio itself is too minuscule for organizers.
 */
const ATTIO_PALETTE: PaletteCandidate = {
  id: "attio",
  defaultAccent: "blue",
  accentIds: ["blue", "teal"],
  headerVariant: "plain",
  statusStyle: "dot",
  // Attio's system, our sizing: hairlines and small radii from the reference,
  // but taller rows and larger controls than Attio ships (RULES.md #22).
  panelClassName:
    "[&_[data-slot=card]]:rounded-lg [&_[data-slot=card]]:shadow-none [&_button]:rounded-md [&_button]:h-9 [&_th]:py-3 [&_td]:py-4",
  tokens: {
    "--background": "#fbfbfa",
    "--card": "#ffffff",
    "--card-foreground": "#1b1b19",
    "--foreground": "#1b1b19",
    "--muted": "#f6f6f4",
    "--muted-foreground": "#77776f",
    "--accent": "#f6f6f4",
    "--accent-foreground": "#1b1b19",
    "--secondary": "#f6f6f4",
    "--secondary-foreground": "#1b1b19",
    "--border": "#e8e8e4",
    "--input": "#deded8",
    "--sidebar": "#f9f9f7",
    "--sidebar-foreground": "#1b1b19",
    "--sidebar-accent": "#efefeb",
    "--sidebar-accent-foreground": "#1b1b19",
    "--sidebar-border": "#e8e8e4",
    "--status-green-bg": "#e8f1e9",
    "--status-green-fg": "#33613c",
    "--status-green-dot": "#4f8b5c",
    "--status-amber-bg": "#f7efdc",
    "--status-amber-fg": "#7a5a1e",
    "--status-amber-dot": "#b98a2c",
    "--status-gray-bg": "#f0f0ec",
    "--status-gray-fg": "#5f5f58",
    "--status-gray-dot": "#a3a39a",
    "--status-blue-bg": "#eaefee",
    "--status-blue-fg": "#2a504b",
    "--status-blue-dot": "#6f938d",
  },
}

/**
 * "Juicebox-soft": the same information, softened — warmer greys, larger radii,
 * more air per row. Friendly without being playful.
 */
const JUICEBOX_PALETTE: PaletteCandidate = {
  id: "juicebox",
  defaultAccent: "verdigris",
  panelClassName:
    "[&_[data-slot=card]]:rounded-2xl [&_[data-slot=page-header]]:rounded-2xl [&_button]:rounded-xl [&_th]:py-3 [&_td]:py-3.5",
  tokens: {
    "--background": "#fbf9f7",
    "--card": "#ffffff",
    "--card-foreground": "#26211d",
    "--foreground": "#26211d",
    "--muted": "#f6f2ee",
    "--muted-foreground": "#7a7068",
    "--accent": "#f7f0ea",
    "--accent-foreground": "#3a2f28",
    "--secondary": "#f6f2ee",
    "--secondary-foreground": "#3a2f28",
    "--border": "#ece5de",
    "--input": "#e3dad1",
    "--sidebar": "#f8f4f0",
    "--sidebar-foreground": "#26211d",
    "--sidebar-accent": "#f0e8e0",
    "--sidebar-accent-foreground": "#3a2f28",
    "--sidebar-border": "#ece5de",
    "--status-gray-bg": "#f0eae4",
    "--status-gray-fg": "#655c54",
    "--status-blue-bg": "#e9f1ef",
    "--status-blue-fg": "#2c5751",
    "--status-blue-dot": "#6b9a93",
  },
}

/** The two to decide between, side by side, before scrolling into detail. */
const FINALISTS: Array<{
  badge: string
  name: string
  swatches: Array<string>
  pitch: string
  cost: string
}> = [
  {
    badge: "E",
    name: "De-blued",
    swatches: ["#ffffff", "#f7f8f9", "#f4f5f7", "#eceef1", "#2f5ce0"],
    pitch:
      "Today's design language with the blue taken out of the chrome. Nothing moves, nothing resizes — the tint just goes grey.",
    cost: "Five tokens. Zero risk of regression, zero re-QA of layout.",
  },
  {
    badge: "F",
    name: "Attio",
    swatches: ["#ffffff", "#fbfbfa", "#f9f9f7", "#e8e8e4", "#0f766e"],
    pitch:
      "Attio's system adopted properly: warm near-white ramp, hairlines instead of fills, small radii, quiet type hierarchy — at our comfortable sizing, not Attio's.",
    cost: "The full neutral ramp plus radii. One commit, but the whole app wants a visual pass afterwards.",
  },
]

/* ------------------------------------------------------------ demo panel */

const NAV_ITEMS = ["Dashboard", "Submissions", "Speakers", "Agenda"]

/**
 * Soft data tints for the Track tag — deliberately independent of the chrome
 * palette, because in the Attio reading colour carries DATA, not chrome.
 */
const TRACK_TINTS: Record<string, { bg: string; fg: string }> = {
  Design: { bg: "#f3eafb", fg: "#5b2f9a" },
  Platform: { bg: "#e6f0fb", fg: "#1d4e89" },
  Community: { bg: "#e7f4ec", fg: "#256040" },
}

type DotTone = "green" | "amber" | "blue"

const DOT_CLASS: Record<DotTone, string> = {
  green: "bg-status-green-dot",
  amber: "bg-status-amber-dot",
  blue: "bg-status-blue-dot",
}

const DEMO_ROWS: Array<{
  title: string
  speaker: string
  status: string
  tone: DotTone
  track: keyof typeof TRACK_TINTS
}> = [
  {
    title: "Scaling a design system to 40 teams",
    speaker: "Amara Osei",
    status: "accepted",
    tone: "green",
    track: "Design",
  },
  {
    title: "What we learned running 300 sessions",
    speaker: "Jonas Lindqvist",
    status: "pending",
    tone: "amber",
    track: "Community",
  },
  {
    title: "The programme committee playbook",
    speaker: "Rio Tanaka",
    status: "active",
    tone: "blue",
    track: "Platform",
  },
]

export interface DemoPanelProps {
  heading: string
  body: string
  palette?: PaletteCandidate
  accentHex?: string
  className?: string
}

/**
 * The constant in every comparison: one mini organizer dashboard, built from
 * the real shadcn primitives and the real shared components, so a candidate is
 * judged on the surfaces we actually ship.
 */
export function DemoPanel({
  heading,
  body,
  palette = CURRENT_PALETTE,
  accentHex,
  className,
}: DemoPanelProps) {
  const style = {
    "--demo-heading": heading,
    "--demo-body": body,
    ...palette.tokens,
    ...(accentHex ? accentTokens(accentHex) : {}),
  } as React.CSSProperties

  return (
    <div
      data-demo-panel=""
      style={style}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        palette.panelClassName,
        className
      )}
    >
      <div className="flex">
        <div className="hidden w-44 shrink-0 border-r border-sidebar-border bg-sidebar p-3 lg:block">
          <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Program
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item, index) => (
              <span
                key={item}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm",
                  index === 1
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "font-medium text-foreground/80"
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4 bg-background p-4">
          <PageHeader
            variant={palette.headerVariant ?? "banner"}
            title="Submissions"
            description="Everything submitted to Frontend Summit 2026, in one table."
            actions={
              <>
                <Button variant="outline" size="sm">
                  Export CSV
                </Button>
                <Button size="sm">
                  <RiAddLine aria-hidden />
                  Add submission
                </Button>
              </>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Submissions", value: "128", delta: "+12 this week" },
              { label: "Accepted", value: "34", delta: "27% of total" },
            ].map((stat) => (
              <Card key={stat.label} className="gap-1 p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RiArrowRightUpLine size={13} aria-hidden />
                  {stat.delta}
                </p>
              </Card>
            ))}
          </div>

          {/* Toolbar — view switcher left, view settings right. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">
              All submissions
              <RiArrowDownSLine aria-hidden />
            </Button>
            <Button variant="outline" size="sm">
              <RiFilter3Line aria-hidden />
              Filter
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto">
              View settings
            </Button>
          </div>

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="max-md:hidden">Track</TableHead>
                  <TableHead className="max-sm:hidden">Speaker</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_ROWS.map((row) => (
                  <TableRow key={row.title}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="max-md:hidden">
                      <span
                        className="inline-flex h-6 items-center rounded-md px-2 text-xs font-medium"
                        style={{
                          background: TRACK_TINTS[row.track].bg,
                          color: TRACK_TINTS[row.track].fg,
                        }}
                      >
                        {row.track}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {row.speaker}
                    </TableCell>
                    <TableCell className="text-right">
                      {palette.statusStyle === "dot" ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              DOT_CLASS[row.tone]
                            )}
                          />
                          {statusLabel(row.status)}
                        </span>
                      ) : (
                        <StatusPill status={row.status} size="sm" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Review moves in one direction: an organizer reads the abstract,
            drops it in the accept or decline queue, and the speaker hears back
            the same day. Nobody has to learn a second tool to run a programme.
          </p>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- section */

interface CandidateProps {
  badge: string
  name: string
  pairing: string
  personality: string
  changes: string
  featured?: boolean
  palette?: PaletteCandidate
  heading?: string
  body?: string
}

/**
 * One candidate: the demo panel, its own accent picker, and the three lines
 * that say what it is, how it feels, and what would actually change.
 */
function Candidate({
  badge,
  name,
  pairing,
  personality,
  changes,
  featured = false,
  palette = CURRENT_PALETTE,
  heading = CURRENT_TYPE.heading,
  body = CURRENT_TYPE.body,
}: CandidateProps) {
  const [accentId, setAccentId] = useState(palette.defaultAccent)
  const accent = ACCENTS.find((item) => item.id === accentId) ?? ACCENTS[0]
  const chips = palette.accentIds
    ? ACCENTS.filter((item) => palette.accentIds?.includes(item.id))
    : ACCENTS

  return (
    <section
      className={cn(
        "rounded-2xl p-4",
        featured
          ? "bg-accent ring-1 ring-primary/20"
          : "bg-muted/60 ring-1 ring-border"
      )}
    >
      <DemoPanel
        palette={palette}
        heading={heading}
        body={body}
        accentHex={accent.hex}
      />

      <div className="mt-3.5 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={featured ? "default" : "secondary"}>{badge}</Badge>
          <h3 className="font-heading text-base font-semibold tracking-tight">
            {name}
          </h3>
          <code className="font-mono text-xs text-muted-foreground">
            {pairing}
          </code>
        </div>
        <p className="mt-1.5 text-sm text-foreground/80">{personality}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">What changes: </span>
          {changes}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Accent:
          </span>
          {chips.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAccentId(item.id)}
              aria-pressed={item.id === accent.id}
              title={`${item.name} · ${item.hex}`}
              className={cn(
                "flex size-6 items-center justify-center rounded-full ring-1 ring-foreground/10 transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                item.id === accent.id && "ring-2 ring-foreground/40"
              )}
              style={{ background: item.hex }}
            >
              {item.id === accent.id ? (
                <RiCheckLine size={13} aria-hidden className="text-white" />
              ) : null}
              <span className="sr-only">{item.name}</span>
            </button>
          ))}
          <code className="font-mono text-xs text-muted-foreground">
            {accent.name} · {accent.hex}
          </code>
        </div>
      </div>
    </section>
  )
}

function Heading({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="pt-2">
      <h3 className="font-heading text-base font-semibold tracking-tight">
        {title}
      </h3>
      <p className="container-reading mt-1 text-sm text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

export function DesignExplorations() {
  return (
    <div className="space-y-5">
      <Card className="gap-2 border-primary/20 bg-accent p-5">
        <h3 className="font-heading text-base font-semibold tracking-tight">
          Pick one — rollout is a one-line token change.
        </h3>
        <p className="container-reading text-sm text-foreground/80">
          Three independent choices — <strong>feel</strong>,{" "}
          <strong>accent</strong>, <strong>type</strong> — all shown on the same
          mini organizer dashboard so nothing but the variable moves. Feel is
          the <code className="font-mono">--accent</code> /{" "}
          <code className="font-mono">--sidebar-*</code> /{" "}
          <code className="font-mono">--status-*</code> tokens in{" "}
          <code className="font-mono">src/styles.css</code>; accent is{" "}
          <code className="font-mono">--primary</code>; type is{" "}
          <code className="font-mono">--font-sans</code> and{" "}
          <code className="font-mono">--font-heading</code> in the same file.
          Every panel below has its own accent picker — click a chip to see that
          candidate in another colour. Until you choose, the shipping app is
          unchanged: these are scoped previews, not a live theme.
        </p>
      </Card>

      <Heading title="1 · Feel — two finalists, then the rest">
        Same structure, same fonts, different chrome.{" "}
        <strong className="font-medium text-foreground/80">E</strong> is the
        smallest change that fixes what you flagged — too much blue.{" "}
        <strong className="font-medium text-foreground/80">F</strong> goes
        further and takes Attio's system wholesale, minus its density.
      </Heading>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {FINALISTS.map((finalist) => (
            <div key={finalist.name} className="p-5">
              <div className="flex items-center gap-2">
                <Badge>{finalist.badge}</Badge>
                <h4 className="font-heading text-sm font-semibold tracking-tight">
                  {finalist.name}
                </h4>
              </div>
              <div className="mt-3 flex gap-1.5">
                {finalist.swatches.map((hex) => (
                  <span
                    key={hex}
                    title={hex}
                    className="size-7 rounded-md ring-1 ring-foreground/10"
                    style={{ background: hex }}
                  />
                ))}
              </div>
              <p className="mt-3 text-sm text-foreground/80">
                {finalist.pitch}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/70">Cost: </span>
                {finalist.cost}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Candidate
        featured
        badge="E · Recommended"
        name="De-blued"
        pairing="today's structure · neutral chrome"
        personality="Corporate restraint: the interface goes quiet and the blue means something again."
        changes="Page-header banners go #F4F5F7 instead of lavender, the sidebar and its active item go neutral grey, secondary surfaces lose their tint, and Active/Scheduled pills turn grey. The accent stays on primary buttons, links, focus rings and the active nav state — and nowhere else. Cheapest possible next step: keep this and swap one token for a teal accent."
        palette={DEBLUED_PALETTE}
      />

      <Candidate
        featured
        badge="F · Attio"
        name="Attio"
        pairing="near-white chrome · colour carries data · sized up"
        personality="The gold standard: calm, achromatic chrome, and completely confident that the table is the product."
        changes="Four things at once. (1) The neutral ramp goes near-white and faintly warm — #FBFBFA page, #F9F9F7 sidebar, #E8E8E4 hairlines — and the tinted module banner disappears entirely: the page title just sits on the page. (2) Colour moves off the chrome and onto the data: soft multi-tint Track tags, and status becomes a small coloured dot plus a plain label instead of a filled pill. (3) Blue shrinks to the primary button, links and selected filters. (4) The one thing we do NOT copy is Attio's density — controls go UP to 36–40px and rows to 44px+, because organizers are not power users (RULES.md #22). Click the teal chip: that is the whole unique-accent question in one click."
        palette={ATTIO_PALETTE}
      />

      <Candidate
        badge="Baseline"
        name="Current — blue chrome"
        pairing="what ships today"
        personality="Friendly and a little sassy: blue is doing decoration as well as direction."
        changes="Nothing. Shown here only so the two above are measurable rather than remembered."
        palette={CURRENT_PALETTE}
      />

      <Candidate
        badge="G · Juicebox-soft"
        name="Juicebox-soft"
        pairing="warm greys · larger radii · more air"
        personality="The soft secondary — modern and welcoming, soft edges and roomier rows, still unmistakably business software."
        changes="Cards and banners go to 16px radii, buttons to 12px, table rows gain ~4px of breathing room, and the neutral ramp warms a shade past Attio. Non-technical organizers read this as the least intimidating of the set; it costs the most vertical space, and it is the furthest from Attio's discipline."
        palette={JUICEBOX_PALETTE}
      />

      <Heading title="2 · Accent — a colour that is ours">
        Four corporate-safe alternatives to Sessionboard blue, all deep enough
        for white button text and none of them neon. The chips under every panel
        are live: the swap is one token (
        <code className="font-mono">--primary</code>), which is why it can ride
        along with any choice above.
      </Heading>

      <Card className="gap-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCENTS.map((accent) => (
            <div key={accent.id} className="flex items-center gap-3">
              <span
                className="size-11 shrink-0 rounded-lg ring-1 ring-foreground/10"
                style={{ background: accent.hex }}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {accent.name}
                  {accent.id === "blue" ? (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      (current)
                    </span>
                  ) : null}
                </span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  --primary · {accent.hex}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="container-reading mt-1 text-sm text-muted-foreground">
          Deep teal is the safest of the four (closest in weight to today's
          blue). Petrol is the most distinctive and the most "not a template".
          Verdigris and muted jade read greener — good on the warm palettes,
          slightly loud on the cool ones.
        </p>
      </Card>

      <Heading title="3 · Type — four pairings, same panel">
        All four are corporate-standard faces in daily production use, not
        display experiments. Judge them on the table and the stat cards, not on
        the headline.
      </Heading>

      {TYPE_CANDIDATES.map((candidate) => (
        <Candidate
          key={candidate.id}
          badge={`${candidate.letter} · ${candidate.name}`}
          name={candidate.name}
          pairing={candidate.pairing}
          personality={candidate.personality}
          changes={candidate.changes}
          heading={candidate.heading}
          body={candidate.body}
        />
      ))}

      <Heading title="4 · The axes combine">
        Feel, accent and type are independent. Here is the pairing with the most
        character on the quietest chrome — and an Attio/Grotesk build for the
        opposite end.
      </Heading>

      <Candidate
        badge="E + D"
        name="De-blued + Character"
        pairing="Bricolage Grotesque headings · Instrument Sans body · neutral chrome"
        personality="Distinctive where it is read, invisible where it is not — the most opinionated combination that still looks like business software."
        changes="Neutral chrome from E, headline personality from D. Two token edits instead of one."
        palette={DEBLUED_PALETTE}
        heading={CHARACTER_TYPE.heading}
        body={CHARACTER_TYPE.body}
      />

      <Candidate
        badge="F + C"
        name="Attio + Grotesk"
        pairing="Space Grotesk headings · Public Sans body · Attio neutrals"
        personality="The full re-brand: nothing about this screen says it started from a template."
        changes="Everything — neutral ramp, accent and both families. Highest effort, highest distance from today; still one commit, since it is all tokens."
        palette={ATTIO_PALETTE}
        heading={TYPE_CANDIDATES[2].heading}
        body={TYPE_CANDIDATES[2].body}
      />

      <Card className="gap-2 p-5">
        <h3 className="font-heading text-base font-semibold tracking-tight">
          Also in the box
        </h3>
        <p className="text-sm text-muted-foreground">
          Sora is installed and ready if none of the four land — a rounder,
          geometric heading face that sits between Grotesk and Character.
        </p>
        <p
          className="mt-1 text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "'Sora Variable', sans-serif" }}
        >
          Sessionboard
        </p>
      </Card>
    </div>
  )
}
