import { useNavigate } from "@tanstack/react-router"
import { RiArrowRightLine, RiGithubFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PepButton, TextReveal } from "@/components/interactions"
import { ProductShot } from "@/components/marketing/product-shot"
import { DISPLAY_HEADING, GridBackdrop } from "@/components/marketing/section"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"

const PROOF_POINTS = [
  "MIT licensed",
  "No credit card, no sales call",
  "Self-host in minutes",
]

/**
 * The fold, composed the way Attio composes theirs (docs/memory/RULES.md #25):
 * a small announcement chip, one very large tight-tracked headline, two lines
 * of sub, two buttons, and then the real product filling the width beneath —
 * all sitting on a faint graph-paper wash.
 *
 * The headline arrives word by word (`TextReveal`) and the primary CTA has
 * press depth (`PepButton`). Nothing else on this page moves on its own.
 */
export function Hero() {
  const navigate = useNavigate()

  return (
    <section className="relative w-full overflow-hidden border-b border-border/70 bg-card pt-16 pb-0 sm:pt-24">
      <GridBackdrop />

      <div className="container-page relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <a
            href={GITHUB_URL}
            {...EXTERNAL_LINK_PROPS}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Open source, MIT licensed
            <RiArrowRightLine size={13} aria-hidden />
          </a>

          <h1
            className={cn(
              DISPLAY_HEADING,
              "mt-7 text-[2.5rem] leading-[1.02] text-balance sm:text-6xl lg:text-[4.25rem]"
            )}
          >
            <TextReveal text="Run your call for speakers." />{" "}
            <span className="text-muted-foreground/55">
              <TextReveal text="Not your inbox." />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Collect talks, review them as a team, keep speakers on track, build
            the agenda and send every email — one fast, open-source tool instead
            of a $40,000 invoice.
          </p>

          <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <PepButton
              size="lg"
              className="px-5"
              onClick={() => navigate({ to: "/login" })}
            >
              Get started free
              <RiArrowRightLine aria-hidden />
            </PepButton>
            <Button
              variant="outline"
              size="lg"
              className="px-5"
              nativeButton={false}
              render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiGithubFill aria-hidden />
              Star on GitHub
            </Button>
          </div>

          <ul className="mt-6 flex flex-col items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center">
            {PROOF_POINTS.map((point, index) => (
              <li key={point} className="flex items-center gap-5">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="hidden size-1 rounded-full bg-border sm:block"
                  />
                ) : null}
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/*
         * The shot runs off the bottom of the fold — you see enough to know it's
         * a real product and scroll to see the rest. Attio's exact move.
         */}
        <div className="mt-14 sm:mt-20">
          <ProductShot
            variant="dashboard"
            crop="top"
            elevation="lg"
            priority
            className="rounded-b-none"
          />
        </div>
      </div>
    </section>
  )
}
