import { Link } from "@tanstack/react-router"
import { RiCheckLine, RiGithubFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DISPLAY_HEADING,
  MarketingSection,
  SectionIntro,
} from "@/components/marketing/section"
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
  "Your servers, your data",
]

const DEMO_POINTS = [
  "Organizer app, speaker portal and CFP form",
  "A pre-loaded event with real-looking data",
  "No credit card, no sales call",
]

const WINNER_POINTS = [
  "One time. Not a subscription.",
  "Bragging rights (non-transferable)",
  "About three months of what you pay today",
]

export function Pricing({ stripeCheckoutUrl }: PricingProps) {
  return (
    <MarketingSection id={SECTION_IDS.pricing} tone="muted">
      <SectionIntro
        align="center"
        title="Free. Both kinds of free."
        description="Exactly one card here has a price on it, and it's a joke — mostly."
      />

      {/* Three flat cells in one bordered container — Attio's plan table. */}
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-3">
        <PlanCard
          name="Open source"
          price="$0"
          cadence="forever"
          summary="Clone the repo and run the whole thing yourself."
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
          summary="The hosted demo, loaded with a full event. Click everything."
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
          summary="You know who you are. The prize has a Buy Now button — because of course it does."
          points={WINNER_POINTS}
          action={
            <DeclareWinnerButton
              variant="outline"
              checkoutUrl={stripeCheckoutUrl}
              className="w-full"
            />
          }
          footnote="The Kill My SaaS prize, wired to a checkout link. Entirely voluntary."
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
    <div
      data-featured={featured ? "" : undefined}
      className={cn(
        "flex h-full flex-col bg-card px-6 py-7",
        featured && "bg-card ring-1 ring-primary ring-inset"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-medium text-foreground">
          {name}
        </h3>
        {badge ? (
          <Badge className="h-6 rounded-full px-2.5">{badge}</Badge>
        ) : null}
      </div>

      <p className="mt-5 flex items-baseline gap-2">
        <span className={cn(DISPLAY_HEADING, "text-4xl leading-none")}>
          {price}
        </span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </p>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {summary}
      </p>

      <div className="mt-7">{action}</div>

      <ul className="mt-7 space-y-2.5 border-t border-border pt-6">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5 text-sm">
            <RiCheckLine
              size={17}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
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
    </div>
  )
}
