import { Link } from "@tanstack/react-router"
import { RiGithubFill } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { Separator } from "@/components/ui/separator"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_LICENSE_URL,
  GITHUB_URL,
} from "@/components/marketing/links"

const LINK_CLASS =
  "rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

export function MarketingFooter() {
  return (
    <footer className="w-full bg-card px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Logo size="md" />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Open-source speaker and program management. Fork it, host it, make
              it yours.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid gap-x-12 gap-y-6 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.12em] text-foreground uppercase">
                Product
              </p>
              <Link to="/login" className={LINK_CLASS}>
                Organizer demo
              </Link>
              <a href="/portal" className={LINK_CLASS}>
                Speaker portal
              </a>
              <a href="/submit/cfp" className={LINK_CLASS}>
                Submit a talk
              </a>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.12em] text-foreground uppercase">
                Project
              </p>
              <a
                href={GITHUB_URL}
                {...EXTERNAL_LINK_PROPS}
                className={`${LINK_CLASS} inline-flex items-center gap-1.5`}
              >
                <RiGithubFill size={15} aria-hidden />
                GitHub
              </a>
              <Link to="/design-system" className={LINK_CLASS}>
                Design system
              </Link>
              <a
                href={GITHUB_LICENSE_URL}
                {...EXTERNAL_LINK_PROPS}
                className={LINK_CLASS}
              >
                MIT license
              </a>
            </div>
          </nav>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            MIT licensed — free forever, self-host it anywhere. Built for swyx
            &amp; the AI Engineer team.
          </p>
          <p>
            Public read API:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              /api/v1
            </code>{" "}
            — sessions, speakers and an event <code>.ics</code> feed, documented
            in the README.
          </p>
        </div>
      </div>
    </footer>
  )
}
