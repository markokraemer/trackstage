import { Link } from "@tanstack/react-router"
import { RiGithubFill } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { Separator } from "@/components/ui/separator"
import {
  DEMO_CFP_URL,
  DEMO_PORTAL_URL,
  DEMO_PROGRAM_URL,
  EXTERNAL_LINK_PROPS,
  GITHUB_LICENSE_URL,
  GITHUB_README_URL,
  GITHUB_URL,
  PUBLIC_API_PREFIX,
  SECTION_IDS,
} from "@/components/marketing/links"

const LINK_CLASS =
  "rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

const COLUMN_TITLE_CLASS =
  "text-xs font-semibold tracking-[0.12em] text-foreground uppercase"

export function MarketingFooter() {
  return (
    <footer className="w-full border-t border-border/70 bg-card py-14">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Logo size="md" />
            <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">
              Open-source speaker and program management. Collect talks, review
              them, build the agenda, keep everyone in the loop. Fork it, host
              it, make it yours.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid gap-x-8 gap-y-8 sm:grid-cols-3"
          >
            <div className="flex flex-col gap-2.5">
              <p className={COLUMN_TITLE_CLASS}>Product</p>
              <Link to="/login" className={LINK_CLASS}>
                Organizer app
              </Link>
              <a href={DEMO_PORTAL_URL} className={LINK_CLASS}>
                Speaker portal
              </a>
              <a href={DEMO_CFP_URL} className={LINK_CLASS}>
                Submit a talk
              </a>
              <a href={DEMO_PROGRAM_URL} className={LINK_CLASS}>
                Public program
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className={COLUMN_TITLE_CLASS}>On this page</p>
              <a href={`#${SECTION_IDS.demos}`} className={LINK_CLASS}>
                Live demo
              </a>
              <a href={`#${SECTION_IDS.product}`} className={LINK_CLASS}>
                Features
              </a>
              <a href={`#${SECTION_IDS.pricing}`} className={LINK_CLASS}>
                Pricing
              </a>
              <a href={`#${SECTION_IDS.openSource}`} className={LINK_CLASS}>
                The story
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className={COLUMN_TITLE_CLASS}>Project</p>
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
                href={GITHUB_README_URL}
                {...EXTERNAL_LINK_PROPS}
                className={LINK_CLASS}
              >
                API docs
              </a>
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

        <Separator className="my-9" />

        <div className="flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <p>
            MIT licensed — free forever, self-host it anywhere. Built for
            swyx&rsquo;s Kill My SaaS.
          </p>
          <p>
            Public read API:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {PUBLIC_API_PREFIX}
            </code>{" "}
            — sessions, speakers and an event <code>.ics</code> feed, documented
            in the README.
          </p>
        </div>
      </div>
    </footer>
  )
}
