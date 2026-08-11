import { Link, createFileRoute } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiMicLine,
  RiSendPlaneLine,
  RiUserSettingsLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { LogoMark } from "@/components/brand/logo"

export const Route = createFileRoute("/")({
  component: LandingPage,
})

/** Temporary landing — the real marketing homepage is built separately. */
const ENTRY_POINTS: Array<{
  title: string
  description: string
  href: string
  icon: RemixiconComponentType
}> = [
  {
    title: "Organizer demo",
    description:
      "Run the event: review submissions, build the agenda, chase speakers.",
    href: "/login",
    icon: RiUserSettingsLine,
  },
  {
    title: "Speaker portal demo",
    description:
      "What speakers see: their submissions, profile, and outstanding tasks.",
    href: "/portal",
    icon: RiMicLine,
  },
  {
    title: "Submit a talk",
    description:
      "The public call for speakers form, exactly as a speaker sees it.",
    href: "/submit/ai-summit-2026",
    icon: RiSendPlaneLine,
  },
]

const CARD_CLASS =
  "h-full flex-row items-start gap-4 px-4 py-4 text-left transition-colors group-hover:bg-accent/50 group-hover:ring-primary/30"
const LINK_CLASS =
  "group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={44} variant="boxed" />
          <h1 className="font-heading mt-5 text-3xl font-semibold tracking-tight">
            Sessionboard
          </h1>
          <p className="mt-3 max-w-lg text-base text-muted-foreground">
            Open-source speaker and program management — call for speakers,
            review, speaker portal, and agenda building in one fast tool.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3">
          {ENTRY_POINTS.map((entry) => {
            const content = (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <entry.icon size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {entry.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
                <RiArrowRightLine
                  size={16}
                  aria-hidden
                  className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </>
            )

            return entry.href === "/login" ? (
              <Link key={entry.href} to="/login" className={LINK_CLASS}>
                <Card className={CARD_CLASS}>{content}</Card>
              </Link>
            ) : (
              <a key={entry.href} href={entry.href} className={LINK_CLASS}>
                <Card className={CARD_CLASS}>{content}</Card>
              </a>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link
            to="/design-system"
            className="hover:text-foreground hover:underline"
          >
            Design system →
          </Link>
        </p>
      </div>
    </main>
  )
}
