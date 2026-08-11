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
import { PRODUCT_NAME } from "@/components/marketing/links"

/** The one-line pitch used by every social/preview card for this page. */
const SHARE_DESCRIPTION =
  "The open-source Sessionboard alternative. Free, fast and easy to run — and your speakers will love it too."

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `${PRODUCT_NAME} — call for papers, agenda and speaker management`,
      },
      {
        name: "description",
        content:
          "The open-source Sessionboard alternative. Collect talks, review and decide, build the agenda, give every speaker a portal and send the emails — one fast, simple tool. Free and MIT licensed.",
      },
      // The root sets site-wide defaults; the landing page is the one surface
      // that gets shared, so it overrides them with the positioning line
      // itself. Meta is deduped by `name`/`property`, child wins.
      {
        property: "og:title",
        content: `${PRODUCT_NAME} — call for papers, agenda and speaker management`,
      },
      {
        property: "og:description",
        content: SHARE_DESCRIPTION,
      },
      {
        name: "twitter:title",
        content: `${PRODUCT_NAME} — call for papers, agenda and speaker management`,
      },
      {
        name: "twitter:description",
        content: SHARE_DESCRIPTION,
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
    // `bg-card`: the only place the wrapper shows is behind the transparent
    // nav, which sits over the white hero — it must not read as a grey band.
    <div className="flex min-h-svh flex-col bg-card">
      <MarketingNav />
      <main className="flex-1">
        <Hero />
        <DemoEntries />
        <ProofStrip />
        <FeatureSections />
        <PlatformSection />
        <Foundations />
        <Pricing />
        <OpenSource />
        <ClosingCta />
      </main>
      <MarketingFooter />
    </div>
  )
}
