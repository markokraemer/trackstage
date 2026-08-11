import { Link } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiExternalLinkLine,
  RiMicLine,
  RiSendPlaneLine,
  RiUserSettingsLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  DISPLAY_HEADING,
  MarketingSection,
} from "@/components/marketing/section"
import {
  DEMO_CFP_URL,
  DEMO_PORTAL_URL,
  DEMO_PROGRAM_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

interface DemoEntry {
  title: string
  description: string
  cta: string
  icon: RemixiconComponentType
  /** Typed router link (organizer demo) vs. plain anchor (public surfaces). */
  to?: "/login"
  href?: string
}

const DEMO_ENTRIES: Array<DemoEntry> = [
  {
    title: "Organizer demo",
    description:
      "The full event: submissions, review queues, the agenda and everything your speakers still owe you.",
    cta: "Open the organizer app",
    icon: RiUserSettingsLine,
    to: "/login",
  },
  {
    title: "Speaker portal demo",
    description:
      "What a speaker sees after they're accepted — their talks, their profile, their to-do list.",
    cta: "Open the speaker portal",
    icon: RiMicLine,
    href: DEMO_PORTAL_URL,
  },
  {
    title: "Submit a talk",
    description:
      "The public call-for-speakers form, exactly as a speaker fills it in. No account needed.",
    cta: "Open the CFP form",
    icon: RiSendPlaneLine,
    href: DEMO_CFP_URL,
  },
]

/**
 * Three flat panes sharing one bordered container — Attio's grouped-card
 * pattern: hairlines between the cells, no shadows, no rounded islands.
 */
const CELL_CLASS = cn(
  "group flex h-full flex-col gap-2.5 p-6 outline-none transition-colors",
  "border-t border-border first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0",
  "hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
)

/**
 * The live-demo entry points. These sit directly under the hero on purpose
 * (docs/memory/RULES.md 18f): anyone landing here — judge, organizer, curious
 * dev — is one click from a working product, no signup in the way.
 */
export function DemoEntries() {
  return (
    <MarketingSection id={SECTION_IDS.demos} tone="muted">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2
          className={cn(
            DISPLAY_HEADING,
            "max-w-md text-3xl leading-[1.05] text-balance sm:text-4xl"
          )}
        >
          Three ways in. Pick a seat.
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-right">
          Everything below runs on a pre-loaded demo event. Nothing to install,
          nothing to configure, nothing you can break.
        </p>
      </div>

      <div className="mt-9 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3">
        {DEMO_ENTRIES.map((entry) => {
          const content = (
            <>
              <entry.icon
                size={20}
                aria-hidden
                className="text-muted-foreground"
              />
              <span className="mt-1 block font-heading text-base font-medium text-foreground">
                {entry.title}
              </span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-primary">
                {entry.cta}
                <RiArrowRightLine
                  size={15}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </>
          )

          return entry.to ? (
            <Link key={entry.title} to={entry.to} className={CELL_CLASS}>
              {content}
            </Link>
          ) : (
            <a key={entry.title} href={entry.href} className={CELL_CLASS}>
              {content}
            </a>
          )
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Curious what attendees see?{" "}
        <a
          href={DEMO_PROGRAM_URL}
          className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Browse the published program
          <RiExternalLinkLine size={13} aria-hidden />
        </a>
      </p>
    </MarketingSection>
  )
}
