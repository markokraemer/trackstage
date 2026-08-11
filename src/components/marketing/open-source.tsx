import { Link } from "@tanstack/react-router"
import {
  RiArrowRightUpLine,
  RiGithubFill,
  RiPaletteLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { MarketingSection } from "@/components/marketing/section"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  KILL_MY_SAAS_POST_URL,
  SECTION_IDS,
  SESSIONBOARD_URL,
} from "@/components/marketing/links"

const STATS = [
  { value: "$40k+/yr", label: "What the tool we're replacing costs" },
  { value: "1 weekend", label: "What this one took to build" },
  { value: "MIT", label: "What it costs you" },
]

export function OpenSource() {
  return (
    <MarketingSection id={SECTION_IDS.openSource} tone="muted" bordered={false}>
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-16">
        <div className="max-w-(--container-narrow)">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            Open source
          </p>
          <h2 className="mt-2.5 font-heading text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Built in a weekend for swyx&rsquo;s &ldquo;Kill My SaaS&rdquo;
          </h2>

          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              swyx runs the AI Engineer conferences. His team pays over $40,000
              a year for{" "}
              <a
                href={SESSIONBOARD_URL}
                {...EXTERNAL_LINK_PROPS}
                className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                a speaker platform
              </a>{" "}
              they use maybe a third of. So he wrote a brief, put $10,000 on the
              table, and asked the internet to kill it.
            </p>
            <p>
              This is our answer — the same six jobs, rebuilt for the people who
              actually produce events rather than the people who buy software.
              The code, the design system, the decisions and the build log are
              all in the open. If it doesn&rsquo;t do what your event needs,
              open an issue. Or just change it yourself; that&rsquo;s rather the
              point.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button
              size="lg"
              nativeButton={false}
              render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiGithubFill aria-hidden />
              Read the source
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link to="/design-system" />}
            >
              <RiPaletteLine aria-hidden />
              Browse the design system
            </Button>
            <Button
              variant="ghost"
              size="lg"
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

        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10"
            >
              <dt className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {stat.value}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </MarketingSection>
  )
}
