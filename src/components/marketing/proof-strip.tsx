import { LogoMarquee } from "@/components/interactions"
import type { LogoMarqueeItem } from "@/components/interactions"
import { MarketingSection } from "@/components/marketing/section"

/**
 * Social proof, honestly. We have no customers to name yet, so instead of
 * borrowed logos this strip says what kind of event the tool is shaped for —
 * and admits how new it is rather than dressing it up.
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
  "Workshop series",
  "User groups",
  "Unconferences",
  "Product launches",
  "Research colloquia",
].map((label) => ({ id: label, label }))

export function ProofStrip() {
  return (
    <MarketingSection spacing="tight">
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Built for the people who actually produce events
        </p>

        <LogoMarquee
          items={EVENT_TYPES}
          label="Kinds of event Sessionboard is built for"
          speed={26}
          className="border-0 shadow-none [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        />

        <p className="container-reading text-xs leading-relaxed text-muted-foreground/80">
          No customer logos on this page — the project is brand new and
          we&rsquo;re not going to borrow anyone else&rsquo;s. Run an event on it
          and yours goes here first.
        </p>
      </div>
    </MarketingSection>
  )
}
