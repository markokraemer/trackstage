import { LogoMarquee } from "@/components/interactions"
import type { LogoMarqueeItem } from "@/components/interactions"
import { MarketingSection } from "@/components/marketing/section"
import { PRODUCT_NAME } from "@/components/marketing/links"

/**
 * Social proof, honestly. We have no customers to name yet, so instead of
 * borrowed logos this strip names the kinds of event the tool is shaped for —
 * one line of copy and the drift, nothing more (trim pass, 2026-08-11: the
 * apologetic paragraph about having no logos was itself the slop).
 *
 * `LogoMarquee` (interior.dev) does the drifting; it stops the moment a pointer
 * or keyboard focus lands on it, and falls back to a plain scroller under
 * `prefers-reduced-motion`.
 */
const EVENT_TYPES: Array<LogoMarqueeItem> = [
  "Developer conferences",
  "Community meetups",
  "Company summits",
  "Academic symposia",
  "Hackathons",
  "User groups",
  "Workshop series",
  "Unconferences",
].map((label) => ({ id: label, label }))

export function ProofStrip() {
  return (
    <MarketingSection spacing="tight">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Built for the people who actually produce events
        </p>

        <LogoMarquee
          items={EVENT_TYPES}
          label={`Kinds of event ${PRODUCT_NAME} is built for`}
          speed={26}
          className="border-0 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] shadow-none"
        />
      </div>
    </MarketingSection>
  )
}
