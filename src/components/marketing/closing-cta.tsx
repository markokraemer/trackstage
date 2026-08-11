import { Link } from "@tanstack/react-router"
import { RiArrowRightLine, RiGithubFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
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
  return (
    // Asymmetric padding: the band lost a line in the trim pass, so the bottom
    // is pulled in to keep the gap to the footer rule looking deliberate.
    <section className="relative w-full overflow-hidden bg-foreground pt-20 pb-16 sm:pt-24 sm:pb-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--background)_1px,transparent_1px),linear-gradient(to_bottom,var(--background)_1px,transparent_1px)] [mask-image:radial-gradient(90%_100%_at_50%_0%,black,transparent_75%)] [background-size:72px_72px] opacity-[0.07]"
      />

      <div className="container-page relative flex flex-col items-center text-center">
        <h2
          className={cn(
            DISPLAY_HEADING,
            "max-w-2xl text-3xl leading-[1.05] text-balance text-background sm:text-4xl lg:text-[2.75rem]"
          )}
        >
          Ready to open your call for papers?
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-background/70">
          Try the demo first, then run your own event on exactly the same code.
          Free either way.
        </p>

        <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <Link to="/login" className={buttonVariants({ size: "lg", className: "px-5" })}>
            Get started free
            <RiArrowRightLine aria-hidden />
          </Link>
          <a
            href={GITHUB_URL}
            {...EXTERNAL_LINK_PROPS}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className:
                "border-background/25 bg-transparent px-5 text-background hover:bg-background/10 hover:text-background",
            })}
          >
            <RiGithubFill aria-hidden />
            Read the source
          </a>
        </div>
      </div>
    </section>
  )
}
