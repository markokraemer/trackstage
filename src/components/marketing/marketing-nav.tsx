import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { RiGithubFill, RiMenuLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
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
  PRODUCT_NAME,
  SECTION_IDS,
} from "@/components/marketing/links"

interface NavLink {
  label: string
  href: string
}

const NAV_LINKS: Array<NavLink> = [
  { label: "Product", href: `#${SECTION_IDS.product}` },
  { label: "Live demo", href: `#${SECTION_IDS.demos}` },
  { label: "Developers", href: `#${SECTION_IDS.platform}` },
  { label: "Open source", href: `#${SECTION_IDS.openSource}` },
  { label: "Pricing", href: `#${SECTION_IDS.pricing}` },
]

const NAV_LINK_CLASS =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * True once the window has scrolled past `offset`.
 *
 * interior.dev's `useCondense` measures a scroll *container*; this bar reacts to
 * the document, so it gets its own three-line listener rather than a misused
 * hook. Passive, and it settles its initial value on mount so a restored scroll
 * position doesn't paint a transparent bar over content.
 */
function useScrolledPast(offset: number) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    const read = () => setPast(window.scrollY > offset)
    read()
    window.addEventListener("scroll", read, { passive: true })
    return () => window.removeEventListener("scroll", read)
  }, [offset])

  return past
}

/**
 * Sticky top bar, Attio-style: logo left with the section links sitting right
 * beside it, the two things people came for on the right. The bar is invisible
 * over the hero and grows a hairline + backdrop the moment the page moves.
 */
export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const condensed = useScrolledPast(12)

  return (
    <header
      data-condensed={condensed ? "" : undefined}
      className={cn(
        "sticky top-0 z-40 w-full transition-[background-color,border-color,box-shadow] duration-200",
        condensed
          ? "border-b border-border/70 bg-card/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav
        aria-label="Main"
        className="container-page flex h-16 items-center gap-1"
      >
        <Link
          to="/"
          aria-label={`${PRODUCT_NAME} home`}
          className="mr-4 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="md" />
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={NAV_LINK_CLASS}>
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={GITHUB_URL}
            {...EXTERNAL_LINK_PROPS}
            aria-label={`${PRODUCT_NAME} on GitHub`}
            className={cn(NAV_LINK_CLASS, "hidden sm:inline-flex")}
          >
            <RiGithubFill size={18} aria-hidden />
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
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
                  Design system
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
