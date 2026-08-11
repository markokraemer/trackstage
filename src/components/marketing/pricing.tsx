import { Link } from "@tanstack/react-router"
import { RiCheckLine, RiGithubFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MarketingSection, SectionIntro } from "@/components/marketing/section"
import { DeclareWinnerButton } from "@/components/marketing/declare-winner-button"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

export interface PricingProps {
  /** Stripe Checkout link for the $10,000 joke. Empty string = not live yet. */
  stripeCheckoutUrl: string
}

const OPEN_SOURCE_POINTS = [
  "Every feature. There are no tiers.",
  "MIT licensed — fork it, rename it, sell it",
  "Your servers, your database, your data",
  "Support: GitHub issues and other humans",
]

const DEMO_POINTS = [
  "Organizer app, speaker portal and CFP form",
  "A pre-loaded event with real-looking data",
  "No credit card, no sales call, no trial clock",
  "You're inside it about ten seconds from now",
]

const WINNER_POINTS = [
  "One time. Not a subscription. We mean it.",
  "Includes the source code, which you already have",
  "Bragging rights (non-transferable)",
  "Roughly three months of what you pay today",
]

export function Pricing({ stripeCheckoutUrl }: PricingProps) {
  return (
    <MarketingSection id={SECTION_IDS.pricing}>
      <SectionIntro
        align="center"
        eyebrow="Pricing"
        title="Free. Both kinds of free."
        description="Free as in you keep the source, and free as in there is no invoice. Exactly one card here has a price on it, and it's a joke — mostly."
      />

      <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
        <PlanCard
          name="Open source"
          price="$0"
          cadence="forever"
          summary="Clone the repo and run the whole thing yourself. Nothing is held back for a paid tier — there isn't one."
          points={OPEN_SOURCE_POINTS}
          action={
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              nativeButton={false}
              render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiGithubFill aria-hidden />
              Get it on GitHub
            </Button>
          }
        />

        <PlanCard
          featured
          badge="Start here"
          name="Cloud demo"
          price="$0"
          cadence="try it now"
          summary="The hosted demo, loaded with a full event. Click everything — you can't break anything that matters."
          points={DEMO_POINTS}
          action={
            <Button
              size="lg"
              className="w-full"
              nativeButton={false}
              render={<Link to="/login" />}
            >
              Open the demo
            </Button>
          }
        />

        <PlanCard
          name="Declare the winner"
          price="$10,000"
          cadence="one time, voluntary"
          summary="You know who you are. If this actually replaces the $40k-a-year invoice, the prize has a Buy Now button — because of course it does."
          points={WINNER_POINTS}
          action={
            <DeclareWinnerButton
              checkoutUrl={stripeCheckoutUrl}
              className="w-full"
            />
          }
          footnote="Yes: this is the Kill My SaaS prize, wired to a checkout link. Entirely voluntary, wildly appreciated."
        />
      </div>
    </MarketingSection>
  )
}

interface PlanCardProps {
  name: string
  price: string
  cadence: string
  summary: string
  points: Array<string>
  action: React.ReactNode
  featured?: boolean
  badge?: string
  footnote?: string
}

function PlanCard({
  name,
  price,
  cadence,
  summary,
  points,
  action,
  featured = false,
  badge,
  footnote,
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        "h-full gap-0 px-6 py-6",
        featured && "ring-2 ring-primary lg:-mt-3 lg:pb-8"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-medium text-foreground">
          {name}
        </h3>
        {badge ? <Badge className="h-6 px-2.5">{badge}</Badge> : null}
      </div>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold tracking-tight text-foreground">
          {price}
        </span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </p>

      <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">
        {summary}
      </p>

      <div className="mt-6">{action}</div>

      <ul className="mt-6 space-y-2.5 border-t border-border/70 pt-6">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5 text-sm">
            <RiCheckLine
              size={17}
              aria-hidden
              className="mt-0.5 shrink-0 text-primary"
            />
            <span className="leading-relaxed text-foreground">{point}</span>
          </li>
        ))}
      </ul>

      {footnote ? (
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </Card>
  )
}
