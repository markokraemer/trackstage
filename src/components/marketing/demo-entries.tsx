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
import { Card } from "@/components/ui/card"
import { MarketingSection } from "@/components/marketing/section"
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

const CARD_CLASS =
  "h-full gap-2.5 px-5 py-5 text-left transition-all duration-150 group-hover:-translate-y-0.5 group-hover:ring-primary/40 group-hover:shadow-md"
const LINK_CLASS =
  "group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * The live-demo entry points. These sit directly under the hero on purpose
 * (docs/memory/RULES.md 18f): anyone landing here — judge, organizer, curious
 * dev — is one click from a working product, no signup in the way.
 */
export function DemoEntries() {
  return (
    <MarketingSection id={SECTION_IDS.demos} tone="muted">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-(--container-narrow)">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            Try it right now
          </p>
          <h2 className="mt-2.5 font-heading text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            Three ways in. Pick a seat.
          </h2>
        </div>
        <p className="text-sm text-muted-foreground sm:text-right">
          Everything runs on a pre-loaded demo event.
          <br className="hidden sm:block" /> Nothing to install, nothing to
          configure.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_ENTRIES.map((entry) => {
          const content = (
            <Card className={CARD_CLASS}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <entry.icon size={20} aria-hidden />
              </span>
              <span className="block font-heading text-base font-medium text-foreground">
                {entry.title}
              </span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-3 text-sm font-medium text-primary">
                {entry.cta}
                <RiArrowRightLine
                  size={15}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Card>
          )

          return entry.to ? (
            <Link key={entry.title} to={entry.to} className={LINK_CLASS}>
              {content}
            </Link>
          ) : (
            <a key={entry.title} href={entry.href} className={LINK_CLASS}>
              {content}
            </a>
          )
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Curious what attendees see?{" "}
        <a
          href={DEMO_PROGRAM_URL}
          className={cn(
            "inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4",
            "rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
        >
          Browse the published program
          <RiExternalLinkLine size={13} aria-hidden />
        </a>
      </p>
    </MarketingSection>
  )
}
