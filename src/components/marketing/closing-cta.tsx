import { Link, useNavigate } from "@tanstack/react-router"
import { RiArrowRightLine, RiGithubFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PepButton } from "@/components/interactions"
import { DISPLAY_HEADING } from "@/components/marketing/section"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"

/**
 * The closing band. Attio ends the page on a full-bleed coloured block sitting
 * directly on top of the footer; ours uses the ink from our own palette
 * (`--foreground`) rather than a wash of brand blue — the page stays calm and
 * colour keeps meaning something (docs/memory/RULES.md #22).
 *
 * It shares its ground with `MarketingFooter`, which is why neither has a rule
 * between them.
 */
export function ClosingCta() {
  const navigate = useNavigate()

  return (
    <section className="relative w-full overflow-hidden bg-foreground py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,var(--background)_1px,transparent_1px),linear-gradient(to_bottom,var(--background)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(90%_100%_at_50%_0%,black,transparent_75%)]"
      />

      <div className="container-page relative flex flex-col items-center text-center">
        <h2
          className={cn(
            DISPLAY_HEADING,
            "max-w-2xl text-3xl leading-[1.05] text-balance text-background sm:text-4xl lg:text-[2.75rem]"
          )}
        >
          Your next call for speakers opens in about ten seconds.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-background/70">
          Open the demo, click through a real event, then run your own on the
          same code. No trial, no seat count, no call with anybody.
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
            className="border-background/25 bg-transparent px-5 text-background hover:bg-background/10 hover:text-background"
            nativeButton={false}
            render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
          >
            <RiGithubFill aria-hidden />
            Read the source
          </Button>
        </div>

        <p className="mt-6 text-sm text-background/60">
          Or{" "}
          <Link
            to="/login"
            className="rounded-sm text-background underline underline-offset-4 outline-none hover:text-background focus-visible:ring-3 focus-visible:ring-background/40"
          >
            sign in
          </Link>{" "}
          if you already have a workspace.
        </p>
      </div>
    </section>
  )
}
