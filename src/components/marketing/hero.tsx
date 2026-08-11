import { Link } from "@tanstack/react-router"
import { RiArrowRightLine, RiGithubFill } from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProductShot } from "@/components/marketing/product-shot"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"

const PROOF_POINTS = [
  "MIT licensed",
  "No credit card, no sales call",
  "Self-host in minutes",
]

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden border-b border-border/70 bg-card pt-16 pb-16 sm:pt-24 sm:pb-24">
      {/* A single soft wash behind the fold — no animation, no noise. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--accent)_0%,transparent_70%)]"
      />

      <div className="container-page relative">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Badge
            variant="outline"
            className="h-7 gap-1.5 bg-card px-3 text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Open source · MIT
          </Badge>

          <h1 className="mt-6 font-heading text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
            One place for your speakers, sessions and content — without the
            enterprise sales call
          </h1>

          <p className="container-reading mt-6 text-lg leading-relaxed text-pretty text-muted-foreground">
            Collect talks, review them, keep speakers on track, build the agenda
            and send every email — in one fast tool your whole team can pick up
            in an afternoon.
          </p>

          <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="px-4"
              nativeButton={false}
              render={<Link to="/login" />}
            >
              Get started free
              <RiArrowRightLine aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-4"
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

        <div className="mx-auto mt-14 max-w-5xl sm:mt-16">
          <ProductShot
            variant="dashboard"
            elevation="lg"
            className="translate-y-px"
          />
        </div>
      </div>
    </section>
  )
}
