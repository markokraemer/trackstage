/**
 * Design-language explorations — /design-system §Explorations.
 *
 * Marko's brief (docs/memory/RULES.md #20): keep the current language shipping,
 * but put concrete candidates on the design-system page and choose from them.
 * Two independent axes, each shown on the SAME mini organizer dashboard:
 *
 * 1. **Colour** — "De-blued" (the star) against what we ship today.
 * 2. **Type** — four pairings, from the Inter baseline to a distinctive one.
 *
 * Nothing here leaks into the app. The candidate fonts are loaded by this
 * module only, and applied through `[data-demo-panel]` scoped rules in
 * `explorations.css` — the global `--font-sans` stack is untouched.
 */

import "@fontsource-variable/instrument-sans"
import "@fontsource-variable/bricolage-grotesque"
import "@fontsource-variable/space-grotesk"
import "@fontsource-variable/newsreader"
import "@fontsource-variable/public-sans"
import "@fontsource-variable/sora"
import "./explorations.css"

import { RiAddLine, RiArrowRightUpLine } from "@remixicon/react"

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
import { StatusPill } from "@/components/shared/status-pill"

/* ------------------------------------------------------------------- axes */

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
      "Headings pick up squared terminals and a wider stance. Body switches to Public Sans (the US design system's workhorse), which is a touch more formal than Inter.",
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

type Palette = "current" | "neutral"

/**
 * "De-blued": every tinted surface goes neutral, #2F5CE0 is reserved for
 * primary buttons, links, focus rings and the active nav item. Applied as
 * scoped custom-property overrides — the same tokens a rollout would edit in
 * `src/styles.css`, nothing more.
 */
const NEUTRAL_TOKENS: Record<string, string> = {
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
}

/* ------------------------------------------------------------ demo panel */

const NAV_ITEMS = ["Dashboard", "Submissions", "Speakers", "Agenda"]

const DEMO_ROWS: Array<{ title: string; speaker: string; status: string }> = [
  {
    title: "Scaling a design system to 40 teams",
    speaker: "Amara Osei",
    status: "accepted",
  },
  {
    title: "What we learned running 300 sessions",
    speaker: "Jonas Lindqvist",
    status: "pending",
  },
  { title: "The programme committee playbook", speaker: "Rio Tanaka", status: "active" },
]

export interface DemoPanelProps {
  heading: string
  body: string
  palette?: Palette
  className?: string
}

/**
 * The constant in every comparison: one mini organizer dashboard, rendered
 * from the real shadcn primitives and the real shared components, so a
 * candidate is judged on the surfaces we actually ship.
 */
export function DemoPanel({
  heading,
  body,
  palette = "current",
  className,
}: DemoPanelProps) {
  const style = {
    "--demo-heading": heading,
    "--demo-body": body,
    ...(palette === "neutral" ? NEUTRAL_TOKENS : {}),
  } as React.CSSProperties

  return (
    <div
      data-demo-panel=""
      style={style}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
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
                    : "font-medium text-foreground/80",
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4 p-4">
          <PageHeader
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

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="max-sm:hidden">Speaker</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_ROWS.map((row) => (
                  <TableRow key={row.title}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {row.speaker}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusPill status={row.status} size="sm" />
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

function Frame({
  badge,
  name,
  pairing,
  personality,
  changes,
  featured = false,
  children,
}: {
  badge: string
  name: string
  pairing: string
  personality: string
  changes: string
  featured?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "rounded-2xl p-4",
        featured
          ? "bg-accent ring-1 ring-primary/20"
          : "bg-muted/60 ring-1 ring-border",
      )}
    >
      {children}
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
          Two independent choices, both shown on the same mini organizer
          dashboard so nothing but the variable moves. Colour is the{" "}
          <code className="font-mono">--accent</code> /{" "}
          <code className="font-mono">--sidebar-*</code> /{" "}
          <code className="font-mono">--status-blue-*</code> tokens in{" "}
          <code className="font-mono">src/styles.css</code>; type is{" "}
          <code className="font-mono">--font-sans</code> and{" "}
          <code className="font-mono">--font-heading</code> in the same file.
          Until you choose, the shipping app is unchanged — these panels are
          scoped previews, not a live theme.
        </p>
      </Card>

      <Heading title="1 · Colour — the one to look at first">
        Same structure, same fonts, less blue. Luma-neutral chrome with{" "}
        <code className="font-mono">#2F5CE0</code> reserved for things you can
        click.
      </Heading>

      <Frame
        featured
        badge="E · Recommended"
        name="De-blued"
        pairing="current type · neutral chrome"
        personality="Corporate restraint: the interface goes quiet and the blue means something again."
        changes="Page-header banners go #F4F5F7 instead of lavender, the sidebar and its active item go neutral gray, secondary surfaces lose their tint, and Active/Scheduled pills turn gray. #2F5CE0 stays on primary buttons, links, focus rings and the active nav state — and nowhere else."
      >
        <DemoPanel
          palette="neutral"
          heading={CURRENT_TYPE.heading}
          body={CURRENT_TYPE.body}
        />
      </Frame>

      <Frame
        badge="Baseline"
        name="Current — blue chrome"
        pairing="what ships today"
        personality="Friendly and a little sassy: blue is doing decoration as well as direction."
        changes="Nothing. Shown here only so the difference above is measurable rather than remembered."
      >
        <DemoPanel
          palette="current"
          heading={CURRENT_TYPE.heading}
          body={CURRENT_TYPE.body}
        />
      </Frame>

      <Heading title="2 · Type — four pairings, same panel">
        All four are corporate-standard faces in daily production use, not
        display experiments. Judge them on the table and the stat cards, not on
        the headline.
      </Heading>

      {TYPE_CANDIDATES.map((candidate) => (
        <Frame
          key={candidate.id}
          badge={`${candidate.letter} · ${candidate.name}`}
          name={candidate.name}
          pairing={candidate.pairing}
          personality={candidate.personality}
          changes={candidate.changes}
        >
          <DemoPanel heading={candidate.heading} body={candidate.body} />
        </Frame>
      ))}

      <Heading title="3 · The two axes combine">
        Colour and type are independent: any type candidate can sit on the
        de-blued palette. Here is the pairing with the most character on the
        quietest chrome.
      </Heading>

      <Frame
        badge="E + D"
        name="De-blued + Character"
        pairing="Bricolage Grotesque headings · Instrument Sans body · neutral chrome"
        personality="Distinctive where it is read, invisible where it is not — the most opinionated combination that still looks like business software."
        changes="Both changes at once: neutral chrome from E, headline personality from D. If this reads right, the rollout is two token edits instead of one."
      >
        <DemoPanel
          palette="neutral"
          heading={CHARACTER_TYPE.heading}
          body={CHARACTER_TYPE.body}
        />
      </Frame>

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
