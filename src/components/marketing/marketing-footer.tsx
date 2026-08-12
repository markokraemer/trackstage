import { Link } from "@tanstack/react-router"
import { RiGithubFill } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import {
  DEMO_CFP_URL,
  DEMO_PORTAL_URL,
  DEMO_PROGRAM_URL,
  EXTERNAL_LINK_PROPS,
  GITHUB_ISSUES_URL,
  GITHUB_LICENSE_URL,
  GITHUB_README_URL,
  GITHUB_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

const LINK_CLASS =
  "rounded-sm text-sm text-background/60 underline-offset-4 outline-none transition-colors hover:text-background hover:underline focus-visible:ring-3 focus-visible:ring-background/40"

const COLUMN_TITLE_CLASS = "text-sm font-medium text-background"

interface FooterLink {
  label: string
  /** Typed router destination, plain href, or an external URL. */
  to?: "/login" | "/design-system" | "/docs" | "/docs/api" | "/docs/mcp"
  href?: string
  external?: boolean
}

interface FooterColumn {
  title: string
  links: Array<FooterLink>
}

/** Every link here resolves to something real — no placeholder destinations. */
const COLUMNS: Array<FooterColumn> = [
  {
    title: "Product",
    links: [
      { label: "Organizer app", to: "/login" },
      { label: "Speaker portal", href: DEMO_PORTAL_URL },
      { label: "Submit a talk", href: DEMO_CFP_URL },
      { label: "Public program", href: DEMO_PROGRAM_URL },
      { label: "Design system", to: "/design-system" },
    ],
  },
  {
    title: "On this page",
    links: [
      { label: "Live demo", href: `#${SECTION_IDS.demos}` },
      { label: "Features", href: `#${SECTION_IDS.product}` },
      { label: "Developers", href: `#${SECTION_IDS.platform}` },
      { label: "Pricing", href: `#${SECTION_IDS.pricing}` },
      { label: "The story", href: `#${SECTION_IDS.openSource}` },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", to: "/docs" },
      { label: "API reference", to: "/docs/api" },
      { label: "MCP server", to: "/docs/mcp" },
      { label: "README", href: GITHUB_README_URL, external: true },
      { label: "Source on GitHub", href: GITHUB_URL, external: true },
      { label: "Report an issue", href: GITHUB_ISSUES_URL, external: true },
      { label: "MIT license", href: GITHUB_LICENSE_URL, external: true },
    ],
  },
]

/**
 * Attio's footer shape: dark ground shared with the closing CTA above it, the
 * brand in its own column, link columns beside it, and a quiet legal rule at the
 * bottom. Every column here is real — nothing is padded out with dead links.
 */
export function MarketingFooter() {
  return (
    <footer className="w-full bg-foreground pt-4 pb-12">
      <div className="container-page">
        <div className="grid gap-10 border-t border-background/10 pt-12 lg:grid-cols-[1.1fr_2.4fr]">
          <div className="max-w-xs">
            {/* Wordmark hardcodes `text-foreground`; on the dark ground it has
                to invert, and the blue mark tile carries the brand. */}
            <Logo
              size="md"
              className="[&_[data-slot=wordmark]]:text-background"
            />
            <p className="mt-4 text-sm leading-relaxed text-background/60">
              Open-source software for your call for papers, your agenda and
              your speakers.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
          >
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <p className={COLUMN_TITLE_CLASS}>{column.title}</p>
                {column.links.map((link) =>
                  link.to ? (
                    <Link key={link.label} to={link.to} className={LINK_CLASS}>
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.label}
                      href={link.href}
                      className={LINK_CLASS}
                      {...(link.external ? EXTERNAL_LINK_PROPS : {})}
                    >
                      {link.label}
                    </a>
                  )
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-background/10 pt-7 text-sm text-background/55 lg:flex-row lg:items-center lg:justify-between">
          <p>&copy; {new Date().getFullYear()} Trackstage. MIT licensed.</p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-5">
            <a
              href={GITHUB_URL}
              {...EXTERNAL_LINK_PROPS}
              className={`${LINK_CLASS} inline-flex items-center gap-1.5`}
            >
              <RiGithubFill size={16} aria-hidden />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
