import * as React from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiGithubFill,
  RiMenu2Line,
} from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { EXTERNAL_LINK_PROPS, GITHUB_URL } from "@/components/marketing/links"
import { DOCS_NAV, docsNeighbours, docsPage, docsSection } from "@/docs/nav"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
})

/**
 * The documentation shell: a sidebar tree on the left, one short page on the
 * right, prev/next at the bottom. Same chrome as the rest of the product
 * (tokens, hairline borders, remixicon) — no separate docs design language.
 */
function DocsLayout() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const current = docsPage(pathname)
  const section = docsSection(pathname)
  const { previous, next } = docsNeighbours(pathname)

  // Close the mobile sheet whenever the reader navigates.
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="container-page flex h-14 items-center gap-3">
          <Link
            to="/"
            aria-label="Sessionboard home"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo size="sm" />
          </Link>
          <Separator orientation="vertical" className="h-5 max-sm:hidden" />
          <Link
            to="/docs"
            className="font-heading text-sm font-medium tracking-[-0.01em] text-muted-foreground hover:text-foreground max-sm:hidden"
          >
            Docs
          </Link>

          {/* Below `sm` the row is just the logo and the menu — the two links
              would push the header past the viewport on a 390px phone. */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="max-sm:hidden"
              nativeButton={false}
              render={<Link to="/app" />}
            >
              Open the app
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="max-sm:hidden"
              nativeButton={false}
              render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiGithubFill size={16} aria-hidden />
              GitHub
            </Button>

            <div className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button variant="outline" size="icon-sm" aria-label="Browse the docs" />
                  }
                >
                  <RiMenu2Line size={16} aria-hidden />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 gap-0 p-0">
                  <SheetHeader className="border-b border-border">
                    <SheetTitle>Documentation</SheetTitle>
                    <SheetDescription className="sr-only">
                      Browse the Sessionboard documentation.
                    </SheetDescription>
                  </SheetHeader>
                  <nav className="min-h-0 flex-1 overflow-y-auto p-3">
                    <DocsTree pathname={pathname} />
                  </nav>
                  {/* The header links are hidden at this width — keep a way out. */}
                  <div className="flex gap-2 border-t border-border p-3">
                    <Button
                      size="sm"
                      className="flex-1"
                      nativeButton={false}
                      render={<Link to="/app" />}
                    >
                      Open the app
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Source on GitHub"
                      nativeButton={false}
                      render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
                    >
                      <RiGithubFill size={16} aria-hidden />
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page flex items-start gap-10">
        <aside className="sticky top-14 hidden max-h-[calc(100svh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 lg:block">
          <nav aria-label="Documentation">
            <DocsTree pathname={pathname} />
          </nav>
        </aside>

        <main className="min-w-0 flex-1 py-8 lg:py-10">
          {/* The API reference embeds a full reader — it gets the whole column. */}
          <div className={pathname === "/docs/api" ? undefined : "container-reading"}>
            {section && current ? (
              <p className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Link to="/docs" className="hover:text-foreground">
                  Docs
                </Link>
                <RiArrowRightSLine size={13} aria-hidden />
                <span>{section}</span>
                <RiArrowRightSLine size={13} aria-hidden />
                <span className="text-foreground">{current.title}</span>
              </p>
            ) : null}

            <Outlet />

            {previous || next ? (
              <>
                <Separator className="mt-14" />
                <nav className="grid gap-3 pt-6 pb-4 sm:grid-cols-2">
                  {previous ? (
                    <PagerLink direction="previous" to={previous.to} title={previous.title} />
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <PagerLink direction="next" to={next.to} title={next.title} />
                  ) : null}
                </nav>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function DocsTree({ pathname }: { pathname: string }) {
  return (
    <div className="space-y-6">
      {DOCS_NAV.map((group, index) => (
        <div key={group.label ?? index} className="space-y-1">
          {group.label ? (
            <p className="px-2 pb-1 text-[0.6875rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] leading-5 transition-colors",
                  active
                    ? "bg-primary-surface font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon
                  size={15}
                  aria-hidden
                  className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function PagerLink({
  direction,
  to,
  title,
}: {
  direction: "previous" | "next"
  to: string
  title: string
}) {
  const isNext = direction === "next"
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary-border hover:bg-primary-surface/40",
        isNext && "sm:col-start-2 sm:items-end sm:text-right"
      )}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {!isNext ? <RiArrowLeftSLine size={13} aria-hidden /> : null}
        {isNext ? "Next" : "Previous"}
        {isNext ? <RiArrowRightSLine size={13} aria-hidden /> : null}
      </span>
      <span className="font-heading text-sm font-medium tracking-[-0.01em] text-foreground">
        {title}
      </span>
    </Link>
  )
}
