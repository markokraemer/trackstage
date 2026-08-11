import { Link } from "@tanstack/react-router"
import {
  RiArrowRightUpLine,
  RiGithubFill,
  RiPaletteLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DISPLAY_HEADING, MarketingSection } from "@/components/marketing/section"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  KILL_MY_SAAS_POST_URL,
  SECTION_IDS,
  SESSIONBOARD_URL,
} from "@/components/marketing/links"

const STATS = [
  { value: "$40k+/yr", label: "What the tool we're replacing costs" },
  { value: "MIT", label: "What this one costs" },
  { value: "100%", label: "Of the source, in the open" },
]

const PROSE_LINK_CLASS =
  "rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * The story band, in Attio's manifesto layout: an oversized headline holding the
 * left column on its own, and the prose set quietly beside it on the right.
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
            swyx runs the AI Engineer conferences. His team pays over $40,000 a
            year for{" "}
            <a
              href={SESSIONBOARD_URL}
              {...EXTERNAL_LINK_PROPS}
              className={PROSE_LINK_CLASS}
            >
              a speaker platform
            </a>{" "}
            they use maybe a third of. So he wrote a brief, put $10,000 on the
            table, and asked the internet to kill it.
          </p>
          <p>
            This is our answer — the same jobs, rebuilt for the people who
            actually produce events rather than the people who buy software. The
            code, the design system, the decisions and the build log are all in
            the repo. If it doesn&rsquo;t do what your event needs, open an
            issue. Or change it yourself; that&rsquo;s rather the point.
          </p>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <Button
              nativeButton={false}
              render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiGithubFill aria-hidden />
              Read the source
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/design-system" />}
            >
              <RiPaletteLine aria-hidden />
              Browse the design system
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={
                <a href={KILL_MY_SAAS_POST_URL} {...EXTERNAL_LINK_PROPS} />
              }
            >
              The original brief
              <RiArrowRightUpLine aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <dl className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
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
