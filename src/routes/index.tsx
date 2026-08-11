import { createFileRoute } from "@tanstack/react-router"

import { MarketingNav } from "@/components/marketing/marketing-nav"
import { Hero } from "@/components/marketing/hero"
import { DemoEntries } from "@/components/marketing/demo-entries"
import { ProofStrip } from "@/components/marketing/proof-strip"
import { FeatureSections } from "@/components/marketing/feature-sections"
import { PlatformSection } from "@/components/marketing/platform-section"
import { Foundations } from "@/components/marketing/foundations"
import { Pricing } from "@/components/marketing/pricing"
import { OpenSource } from "@/components/marketing/open-source"
import { ClosingCta } from "@/components/marketing/closing-cta"
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
          "Collect talks, review them, run the speaker portal, build the agenda and send every email — one fast, open-source tool. No enterprise sales call.",
      },
    ],
  }),
  component: LandingPage,
})

/**
 * Marketing homepage.
 *
 * Visual language is Attio's, adapted to our brand (docs/memory/RULES.md #22,
 * #25): white bands, hairlines instead of boxes, one oversized tight-tracked
 * heading per band, colour saved for actions and data — and REAL product
 * screenshots throughout (`public/screenshots`, refreshed by
 * `scripts/capture-screenshots.mjs`).
 *
 * Section order mirrors how a visitor decides: what is it (hero) → prove it
 * (live demos, above everything else per RULES.md 18f) → who it's for → what it
 * does (real screens) → what it plugs into → is it solid → what it costs → who
 * built it and why → one last way in.
 */
function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MarketingNav />
      <main className="flex-1">
        <Hero />
        <DemoEntries />
        <ProofStrip />
        <FeatureSections />
        <PlatformSection />
        <Foundations />
        <Pricing stripeCheckoutUrl={STRIPE_CHECKOUT_URL} />
        <OpenSource />
        <ClosingCta />
      </main>
      <MarketingFooter />
    </div>
  )
}
