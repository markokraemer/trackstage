/**
 * Design-language explorations — /design-system §Explorations.
 *
 * DECIDED (Marko, 2026-08-11). The exploration ran six candidates across three
 * axes (feel · accent · type); this file is now the RECORD of that decision,
 * not a chooser. Candidate **E — "De-blued" — SHIPPED**: today's structure with
 * the blue drained out of the chrome and reserved for primary buttons, links,
 * focus rings and the active nav item. The accent stays Trackstage blue
 * `#2F5CE0`; the teal/petrol family was reviewed and rejected. Type is
 * unchanged (Inter everywhere).
 *
 * Everything that used to live here — the Attio and Juicebox-soft palettes, the
 * four type pairings and their six webfonts, the live accent picker — is gone
 * on purpose. Six variable fonts loading behind a page that also renders the
 * whole component library is what made this page flicker, and a chooser whose
 * choice has been made is just noise. What survives is one panel showing what
 * shipped, plus a plain list of what lost and why.
 */

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
import { Tag } from "@/components/shared/tag"

/* ------------------------------------------------------------- demo panel */

const NAV_ITEMS = ["Dashboard", "Submissions", "Speakers", "Agenda"]

const DEMO_ROWS: Array<{
  title: string
  speaker: string
  status: string
  track: string
  tone: "purple" | "blue" | "green"
}> = [
  {
    title: "Scaling a design system to 40 teams",
    speaker: "Amara Osei",
    status: "accepted",
    track: "Design",
    tone: "purple",
  },
  {
    title: "What we learned running 300 sessions",
    speaker: "Jonas Lindqvist",
    status: "pending",
    track: "Community",
    tone: "green",
  },
  {
    title: "The programme committee playbook",
    speaker: "Rio Tanaka",
    status: "active",
    track: "Platform",
    tone: "blue",
  },
]

export interface DemoPanelProps {
  className?: string
}

/**
 * One mini organizer dashboard, built from the real shadcn primitives and the
 * real shared components — so what you see here is literally what ships.
 */
export function DemoPanel({ className }: DemoPanelProps) {
  return (
    <div
      data-demo-panel=""
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

        <div className="min-w-0 flex-1 space-y-4 bg-background p-4">
          <PageHeader
            title="Submissions"
            description="Everything submitted to Frontend Summit 2026, in one table."
            actions={
              <>
                <Button variant="outline" size="sm">
                  Export CSV
                </Button>
                <Button size="sm">Add submission</Button>
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
                <p className="text-xs text-muted-foreground">{stat.delta}</p>
              </Card>
            ))}
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
                      <Tag tone={row.tone} size="sm">
                        {row.track}
                      </Tag>
                    </TableCell>
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
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- section */

/** What was on the table, and what happened to it. */
const CONSIDERED: Array<{ badge: string; name: string; verdict: string }> = [
  {
    badge: "F",
    name: "Attio",
    verdict:
      "Rejected as a whole, harvested in part. Its neutral system is what E now ships — near-white sidebar, hairline borders, no tinted banners, status as a dot plus a label. Its density was never on the table (RULES.md #22) and its warm near-white ramp went further than the brief needed.",
  },
  {
    badge: "G",
    name: "Juicebox-soft",
    verdict:
      "Rejected. Warm greys and 16px radii read friendlier but cost vertical space on the densest screens, and it is the furthest from the restraint the brief asked for.",
  },
  {
    badge: "—",
    name: "Teal / petrol accent",
    verdict:
      "Rejected on sight, after the maths said yes. Petrol #0F6E70 won every measured axis — contrast, distance from the status greens, distinctiveness in a field where every competitor is blue — and Marko still preferred the blue we had. The blue was never the problem; the amount of chrome wearing it was.",
  },
  {
    badge: "A–D",
    name: "Type pairings",
    verdict:
      "Deferred, not rejected. Inter stays for now; D (Bricolage Grotesque headings · Instrument Sans body) is the one to revisit when type gets its own pass.",
  },
]

export function DesignExplorations() {
  return (
    <div className="space-y-5">
      <Card className="gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>E</Badge>
          <h3 className="font-heading text-base font-semibold tracking-tight">
            De-blued — SHIPPED
          </h3>
          <StatusPill status="complete" label="Decided 2026-08-11" size="sm" />
        </div>
        <p className="container-reading text-sm text-muted-foreground">
          Today's structure with the blue taken out of the chrome. Page headers
          are a neutral hairline instead of a lavender panel, the sidebar and
          its active item are grey, secondary surfaces lose their tint, and
          Active/Scheduled stop reading as links. Trackstage blue{" "}
          <code className="font-mono">#2F5CE0</code> stays, and it now appears
          in exactly five places: primary buttons, links, the active nav item,
          the selected-row indicator, and{" "}
          <code className="font-mono">--chart-1</code>. Everything below the
          fold of this decision is recorded in{" "}
          <code className="font-mono">docs/memory/DESIGN-REVAMP.md</code>.
        </p>
      </Card>

      <DemoPanel />

      <Card className="gap-3 p-5">
        <h3 className="font-heading text-base font-semibold tracking-tight">
          What else was on the table
        </h3>
        <dl className="grid gap-3">
          {CONSIDERED.map((item) => (
            <div key={item.name} className="flex gap-3">
              <dt className="w-24 shrink-0">
                <Badge variant="secondary">{item.badge}</Badge>
                <span className="mt-1 block text-sm font-medium">
                  {item.name}
                </span>
              </dt>
              <dd className="min-w-0 text-sm text-muted-foreground">
                {item.verdict}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
