import { Link } from "@tanstack/react-router"
import { RiGithubFill } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"

/** Sticky top bar: brand on the left, the two things people came for on the right. */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/70 bg-card/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link to="/" aria-label="Sessionboard home" className="rounded-md">
          <Logo size="md" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            render={<a href="#features" />}
          >
            Features
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            render={<a href="#try-it-now" />}
          >
            Live demo
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
          >
            <RiGithubFill aria-hidden />
            GitHub
          </Button>
          <Button size="sm" render={<Link to="/login" />}>
            Open the demo
          </Button>
        </div>
      </nav>
    </header>
  )
}
