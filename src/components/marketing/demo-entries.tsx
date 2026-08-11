import { Link } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiMicLine,
  RiSendPlaneLine,
  RiUserSettingsLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { MarketingSection, SectionIntro } from "@/components/marketing/section"

interface DemoEntry {
  title: string
  description: string
  href: string
  cta: string
  icon: RemixiconComponentType
  /** Typed router route — external/dynamic public routes use a plain anchor. */
  routed?: boolean
}

const DEMO_ENTRIES: Array<DemoEntry> = [
  {
    title: "Organizer demo",
    description:
      "Run the event: review submissions, build the agenda, chase outstanding speaker tasks.",
    href: "/login",
    cta: "Open the organizer app",
    icon: RiUserSettingsLine,
    routed: true,
  },
  {
    title: "Speaker portal demo",
    description:
      "What a speaker sees: their submissions, profile, headshot and outstanding tasks.",
    href: "/portal",
    cta: "Open the speaker portal",
    icon: RiMicLine,
  },
  {
    title: "Submit a talk",
    description:
      "The public call-for-speakers form, exactly as a speaker fills it in. No account needed.",
    href: "/submit/cfp",
    cta: "Open the CFP form",
    icon: RiSendPlaneLine,
  },
]

const CARD_CLASS =
  "h-full gap-3 px-5 py-5 text-left transition-colors group-hover:bg-accent/40 group-hover:ring-primary/30"
const LINK_CLASS =
  "group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

export function DemoEntries() {
  return (
    <MarketingSection id="try-it-now" tone="muted">
      <SectionIntro
        eyebrow="Try it now"
        title="Three ways in — pick a seat"
        description="Everything below runs against a pre-loaded demo event. Nothing to install, nothing to configure."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_ENTRIES.map((entry) => {
          const content = (
            <Card className={CARD_CLASS}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <entry.icon size={20} aria-hidden />
              </span>
              <span className="font-heading block text-base font-medium text-foreground">
                {entry.title}
              </span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
                {entry.cta}
                <RiArrowRightLine
                  size={15}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Card>
          )

          return entry.routed ? (
            <Link key={entry.href} to="/login" className={LINK_CLASS}>
              {content}
            </Link>
          ) : (
            <a key={entry.href} href={entry.href} className={LINK_CLASS}>
              {content}
            </a>
          )
        })}
      </div>
    </MarketingSection>
  )
}
