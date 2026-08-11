import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { RiGithubFill, RiMenuLine } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

interface NavLink {
  label: string
  href: string
}

const NAV_LINKS: Array<NavLink> = [
  { label: "Live demo", href: `#${SECTION_IDS.demos}` },
  { label: "Product", href: `#${SECTION_IDS.product}` },
  { label: "Open source", href: `#${SECTION_IDS.openSource}` },
  { label: "Pricing", href: `#${SECTION_IDS.pricing}` },
]

/**
 * Sticky top bar. Brand left, section links centre, the two things people came
 * for right — with a sheet menu carrying the same links on small screens.
 */
export function MarketingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-card/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="container-page flex h-16 items-center gap-4"
      >
        <Link
          to="/"
          aria-label="Sessionboard home"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="md" />
        </Link>

        <div className="ml-4 hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              nativeButton={false}
              render={<a href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            nativeButton={false}
            render={<Link to="/design-system" />}
          >
            Design
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sessionboard on GitHub"
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            nativeButton={false}
            render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
          >
            <RiGithubFill aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link to="/login" />}
          >
            Log in
          </Button>
          <Button size="sm" nativeButton={false} render={<Link to="/login" />}>
            Get started
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="md:hidden" />
              }
            >
              <RiMenuLine aria-hidden />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo size="sm" />
                </SheetTitle>
                <SheetDescription>
                  Open-source speaker &amp; program management.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    nativeButton={false}
                    render={
                      <a
                        href={link.href}
                        className="rounded-md px-2 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <SheetClose
                  nativeButton={false}
                  render={
                    <Link
                      to="/design-system"
                      className="rounded-md px-2 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  Design
                </SheetClose>

                <Separator className="my-3" />

                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={<Link to="/login" />}
                >
                  Log in
                </Button>
                <Button
                  className="mt-2 w-full"
                  nativeButton={false}
                  render={<Link to="/login" />}
                >
                  Get started
                </Button>
                <Button
                  variant="ghost"
                  className="mt-2 w-full"
                  nativeButton={false}
                  render={<a href={GITHUB_URL} {...EXTERNAL_LINK_PROPS} />}
                >
                  <RiGithubFill aria-hidden />
                  GitHub
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
