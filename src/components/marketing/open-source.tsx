import { Link } from "@tanstack/react-router"
import { RiGithubFill, RiPaletteLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  DISPLAY_HEADING,
  MarketingSection,
} from "@/components/marketing/section"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  SECTION_IDS,
  SESSIONBOARD_URL,
} from "@/components/marketing/links"

const STATS = [
  { value: "MIT", label: "The whole product, no strings" },
  { value: "100%", label: "Of the source, in the open" },
  { value: "$0", label: "Self-host or cloud beta" },
]

const PROSE_LINK_CLASS =
  "rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * The story band, in the manifesto layout: an oversized headline holding the
 * left column on its own, and the prose set quietly beside it on the right.
 * Positioning, plainly: the open-source alternative to Sessionboard.
 */
export function OpenSource() {
  return (
    <MarketingSection id={SECTION_IDS.openSource} tone="muted">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
        <h2
          className={cn(
            DISPLAY_HEADING,
            "max-w-md text-3xl leading-[1.05] text-balance sm:text-4xl lg:text-[2.75rem]"
          )}
        >
          Built in the open, to be taken and kept.
        </h2>

        <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            Speaker and program management has been an enterprise category:
            tools like{" "}
            <a
              href={SESSIONBOARD_URL}
              {...EXTERNAL_LINK_PROPS}
              className={PROSE_LINK_CLASS}
            >
              Sessionboard
            </a>{" "}
            are sold on a call, priced in five figures a year, and most teams
            use a fraction of what they pay for.
          </p>
          <p>
            Trackstage is the open-source alternative: the same jobs, rebuilt
            for the people who actually produce events — and fast. Code, design
            system and build log are all in the repo.
          </p>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} className={buttonVariants({})}>
              <RiGithubFill aria-hidden />
              Read the source
            </a>
            <Link to="/design-system" className={buttonVariants({ variant: "outline" })}>
              <RiPaletteLine aria-hidden />
              Browse the design system
            </Link>
          </div>
        </div>
      </div>

      <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-card px-6 py-5">
            <dt
              className={cn(
                DISPLAY_HEADING,
                "text-2xl leading-none sm:text-[1.75rem]"
              )}
            >
              {stat.value}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {stat.label}
            </dd>
          </div>
        ))}
      </dl>
    </MarketingSection>
  )
}
