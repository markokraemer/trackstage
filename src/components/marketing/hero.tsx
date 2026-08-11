import { Link } from "@tanstack/react-router"
import { RiCheckLine, RiGithubFill } from "@remixicon/react"

import { LogoMark } from "@/components/brand/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeclareWinnerButton } from "@/components/marketing/declare-winner-button"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"

const PROOF_POINTS = [
  "MIT licensed — fork it, host it, keep it",
  "No sales call, no seat pricing",
  "Runs on Cloudflare in minutes",
]

export interface HeroProps {
  stripeCheckoutUrl: string
}

export function Hero({ stripeCheckoutUrl }: HeroProps) {
  return (
    <section className="w-full border-b border-border/70 bg-card px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <Badge
          variant="outline"
          className="h-7 gap-1.5 bg-background px-3 text-muted-foreground"
        >
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Open source · Built for swyx&rsquo;s Kill My SaaS
        </Badge>

        <LogoMark size={64} variant="boxed" className="mt-8 rounded-2xl" />

        <h1 className="font-heading mt-6 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
          Open-source speaker &amp; program management
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          CFP forms, speaker portal, review, agenda builder, comms — one fast
          tool. No enterprise sales calls.
        </p>

        <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="lg"
            render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
          >
            <RiGithubFill aria-hidden />
            Star on GitHub
          </Button>
          <Button size="lg" render={<Link to="/login" />}>
            Try the live demo
          </Button>
          <DeclareWinnerButton checkoutUrl={stripeCheckoutUrl} />
        </div>

        <ul className="mt-8 flex flex-col items-center gap-x-6 gap-y-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center">
          {PROOF_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <RiCheckLine size={16} aria-hidden className="text-primary" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
