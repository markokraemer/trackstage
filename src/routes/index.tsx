import { createFileRoute } from "@tanstack/react-router"

import { MarketingNav } from "@/components/marketing/marketing-nav"
import { Hero } from "@/components/marketing/hero"
import { DemoEntries } from "@/components/marketing/demo-entries"
import { FeatureGrid } from "@/components/marketing/feature-grid"
import { StorySection } from "@/components/marketing/story-section"
import { MarketingFooter } from "@/components/marketing/marketing-footer"

/**
 * TODO(Marko): paste the $10,000 Stripe Checkout link here.
 * While it is an empty string the "Declare the winner" button stays clickable
 * and explains itself with a toast instead of dead-linking.
 */
const STRIPE_CHECKOUT_URL = ""

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sessionboard OSS — open-source speaker & program management" },
      {
        name: "description",
        content:
          "CFP forms, speaker portal, review, agenda builder and speaker comms in one fast, open-source tool. No enterprise sales calls.",
      },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MarketingNav />
      <main className="flex-1">
        <Hero stripeCheckoutUrl={STRIPE_CHECKOUT_URL} />
        <DemoEntries />
        <FeatureGrid />
        <StorySection />
      </main>
      <MarketingFooter />
    </div>
  )
}
