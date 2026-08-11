import { Link } from "@tanstack/react-router"
import { RiCheckLine, RiGithubFill } from "@remixicon/react"

import { DeclareWinnerButton } from "@/components/marketing/declare-winner-button"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  DISPLAY_HEADING,
  MarketingSection,
  SectionIntro,
} from "@/components/marketing/section"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

/**
 * Pricing, the industry-standard shape — but every number on it is true.
 * Two ways to run the product, both free: self-host the MIT-licensed repo, or
 * use the hosted version while it's in beta. No invented paid tiers, no
 * feature gates — a single generous free framing done properly beats a made-up
 * plan table.
 */
const SELF_HOST_POINTS = [
  "Every feature. There are no tiers.",
  "MIT licensed — fork it, rebrand it, keep it",
  "Your servers, your data",
]

const CLOUD_POINTS = [
  "The same code as the repo, hosted for you",
  "Unlimited events, submissions and speakers",
  "No credit card, no sales call",
]

const WINNER_POINTS = [
  "One time. Not a subscription.",
  "Bragging rights (non-transferable)",
  "About three months of what you pay today",
]

/** Stripe Checkout link for the $10,000 card. */
const STRIPE_CHECKOUT_URL = "https://pay.kortix.com/b/9B6cN597kaK38NH76nbo400"

export function Pricing() {
  return (
    <MarketingSection id={SECTION_IDS.pricing} tone="muted">
      <SectionIntro
        align="center"
        title="Simple, honest pricing"
        description="Every feature, both ways. No seats, no tiers, no quote-on-request."
      />

      {/* Three flat cells in one bordered container — the house plan table. */}
      <div className="mx-auto mt-12 grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <PlanCard
          name="Self-host"
          price="$0"
          cadence="forever"
          summary="Clone the repo and run the whole thing on your own infrastructure."
          points={SELF_HOST_POINTS}
          action={
            <a
              href={GITHUB_URL}
              {...EXTERNAL_LINK_PROPS}
              className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
            >
              <RiGithubFill aria-hidden />
              Get it on GitHub
            </a>
          }
        />

        <PlanCard
          featured
          badge="Free while in beta"
          name="Cloud"
          price="$0"
          cadence="while in beta"
          summary="The hosted version. Sign up and run your event today."
          points={CLOUD_POINTS}
          action={
            <Link to="/login" className={buttonVariants({ size: "lg", className: "w-full" })}>
              Get started free
            </Link>
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
              checkoutUrl={STRIPE_CHECKOUT_URL}
              className="w-full"
            />
          }
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
    </div>
  )
}
