import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { RiGithubFill, RiMenuLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button, buttonVariants } from "@/components/ui/button"
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
} from "@/components/marketing/links"

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
 * Sticky top bar, Attio-style: logo left, and on the right only the things
 * someone actually leaves the page for — docs, source, sign in, sign up. The
 * page scrolls, so it carries no anchor links (Marko, 2026-08-11: a nav full of
 * jump links is slop). The bar is invisible over the hero and grows a hairline
 * + backdrop the moment the page moves.
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
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="md" />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/docs" className={cn(NAV_LINK_CLASS, "hidden sm:block")}>
            Docs
          </Link>
          <a
            href={GITHUB_URL}
            {...EXTERNAL_LINK_PROPS}
            aria-label={`${PRODUCT_NAME} on GitHub`}
            className={cn(NAV_LINK_CLASS, "hidden sm:inline-flex")}
          >
            <RiGithubFill size={18} aria-hidden />
          </a>
          <Link
            to="/login"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "hidden text-muted-foreground hover:text-foreground sm:inline-flex",
            })}
          >
            Log in
          </Link>
          <Link to="/login" className={buttonVariants({ size: "sm" })}>
            Get started
          </Link>

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
                  Call for papers, agenda and speaker management.
                </SheetDescription>
              </SheetHeader>

              {/* Same four destinations as the desktop bar, nothing else. */}
              <div className="flex flex-col gap-1 px-4">
                <SheetClose
                  nativeButton={false}
                  render={
                    <Link
                      to="/docs"
                      className="rounded-md px-2 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  Docs
                </SheetClose>

                <Separator className="my-3" />

                <Link
                  to="/login"
                  className={buttonVariants({ variant: "outline", className: "w-full" })}
                >
                  Log in
                </Link>
                <Link
                  to="/login"
                  className={buttonVariants({ className: "mt-2 w-full" })}
                >
                  Get started
                </Link>
                <a
                  href={GITHUB_URL}
                  {...EXTERNAL_LINK_PROPS}
                  className={buttonVariants({ variant: "ghost", className: "mt-2 w-full" })}
                >
                  <RiGithubFill aria-hidden />
                  GitHub
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
