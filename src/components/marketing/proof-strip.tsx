import { MarketingSection } from "@/components/marketing/section"

/**
 * Social proof, honestly. We have no customers to name yet, so instead of
 * borrowed logos this strip says who the tool is shaped for — and admits how
 * new it is rather than dressing it up.
 */
const EVENT_TYPES = [
  "Developer conferences",
  "Community meetups",
  "Company summits",
  "Academic symposia",
  "Hackathons",
  "Workshop series",
  "User groups",
  "Unconferences",
]

export function ProofStrip() {
  return (
    <MarketingSection spacing="tight">
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Built for teams who run real conferences
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-2">
          {EVENT_TYPES.map((type) => (
            <li
              key={type}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {type}
            </li>
          ))}
        </ul>

        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground/80">
          No customer logos on this page — the project is brand new and we
          aren&rsquo;t going to borrow anyone else&rsquo;s. Run an event on it
          and yours goes here first.
        </p>
      </div>
    </MarketingSection>
  )
}
