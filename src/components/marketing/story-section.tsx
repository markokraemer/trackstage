import { RiArrowRightUpLine, RiGithubFill } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { MarketingSection } from "@/components/marketing/section"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  KILL_MY_SAAS_POST_URL,
  LATENT_SPACE_URL,
  SESSIONBOARD_URL,
} from "@/components/marketing/links"

const STATS = [
  { value: "$40k+/yr", label: "What the tool we replaced costs" },
  { value: "1 weekend", label: "What this one took to build" },
  { value: "MIT", label: "What it costs you" },
]

export function StorySection() {
  return (
    <MarketingSection tone="muted">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            The story
          </p>
          <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built in a weekend for swyx&rsquo;s &ldquo;Kill My SaaS&rdquo;
          </h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              swyx runs the AI Engineer conferences. His team pays over $40,000
              a year for{" "}
              <a
                href={SESSIONBOARD_URL}
                {...EXTERNAL_LINK_PROPS}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Sessionboard
              </a>{" "}
              — and uses maybe a third of it. So he posted the frustration,
              wrote a brief, and offered $10,000 to whoever built an open-source
              replacement his team would actually switch to.
            </p>
            <p>
              This is that replacement. Same six jobs — call for speakers,
              speaker portal, comms, review, agenda, outstanding tasks — rebuilt
              for people who produce events, not people who read release notes.
              Fast, plain-English, and yours to fork.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button
              variant="outline"
              render={
                <a href={KILL_MY_SAAS_POST_URL} {...EXTERNAL_LINK_PROPS} />
              }
            >
              Read the original brief
              <RiArrowRightUpLine aria-hidden />
            </Button>
            <Button
              variant="ghost"
              render={<a href={LATENT_SPACE_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              latent.space
              <RiArrowRightUpLine aria-hidden />
            </Button>
            <Button
              variant="ghost"
              render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiGithubFill aria-hidden />
              Read the source
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
              <dd className="mt-1 text-sm text-muted-foreground">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </MarketingSection>
  )
}
