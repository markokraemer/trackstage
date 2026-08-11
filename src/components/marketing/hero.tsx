import { Link } from "@tanstack/react-router"
import { RiArrowRightLine, RiGithubFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { TextReveal } from "@/components/interactions"
import { HeroVideoShot } from "@/components/marketing/hero-video"
import { DISPLAY_HEADING, GridBackdrop } from "@/components/marketing/section"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"

/**
 * The fold, composed the way Attio composes theirs (docs/memory/RULES.md #25):
 * a small announcement chip, one very large tight-tracked headline, ONE line of
 * sub, two buttons, and then the real product filling the width beneath — all
 * sitting on a faint graph-paper wash. The old proof-point row said what the
 * chip and the pricing band already say, so it's gone (trim pass, 2026-08-11).
 *
 * The headline arrives word by word (`TextReveal`); the primary CTA is the
 * house flat button (press-depth retired — Marko, 2026-08-11: "looks a bit
 * odd"). Nothing else on this page moves on its own.
 */
export function Hero() {

  return (
    <section className="relative w-full overflow-hidden border-b border-border/70 bg-card pt-16 pb-0 sm:pt-24">
      <GridBackdrop />

      <div className="container-page relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <a
            href={GITHUB_URL}
            {...EXTERNAL_LINK_PROPS}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
            The open-source Sessionboard alternative. Collect talks, review
            them, build the agenda and send every email — fast, simple, with an
            AI copilot built in.
          </p>

          <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <Link
              to="/login"
              className={buttonVariants({ size: "lg", className: "px-5" })}
            >
              Get started free
              <RiArrowRightLine aria-hidden />
            </Link>
            <a
              href={GITHUB_URL}
              {...EXTERNAL_LINK_PROPS}
              className={buttonVariants({ variant: "outline", size: "lg", className: "px-5" })}
            >
              <RiGithubFill aria-hidden />
              Star on GitHub
            </a>
          </div>
        </div>

        {/*
         * The shot runs off the bottom of the fold — you see enough to know it's
         * a real product and scroll to see the rest. Attio's exact move.
         */}
        <div className="mt-14 sm:mt-20">
          <HeroVideoShot />
        </div>
      </div>
    </section>
  )
}
