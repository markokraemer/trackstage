import { MarketingSection } from "@/components/marketing/section"

/**
 * Social proof, honestly. We have no customers to name yet, so instead of
 * borrowed logos this strip names the kinds of event the tool is shaped for.
 * One static single-pass row — the old marquee's seamless loop duplicated the
 * list, which read as repeated content (deslopify pass, 2026-08-11).
 */
const EVENT_TYPES = [
  "Developer conferences",
  "Community meetups",
  "Company summits",
  "Academic symposia",
  "Hackathons",
  "User groups",
  "Workshop series",
  "Unconferences",
]

export function ProofStrip() {
  return (
    <MarketingSection spacing="tight">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Built for the people who actually produce events
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
          {EVENT_TYPES.map((label) => (
            <li
              key={label}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </MarketingSection>
  )
}
