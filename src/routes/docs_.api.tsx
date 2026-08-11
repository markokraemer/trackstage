import { Link, createFileRoute } from "@tanstack/react-router"
import { RiArrowLeftLine, RiDownloadLine, RiRobot2Line } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { ScalarReference } from "@/components/docs/scalar-reference"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { EXTERNAL_LINK_PROPS } from "@/components/marketing/links"

/**
 * The API reference, STANDALONE — deliberately not a child of the `/docs`
 * layout (the `docs_` segment opts this route out of that shell).
 *
 * Scalar ships a complete three-column reader with its own navigation; nesting
 * it inside the docs sidebar + reading column meant two sidebars, a squeezed
 * example panel and a page that read as broken. Here it gets the whole
 * viewport and only a slim bar back to the docs.
 */
export const Route = createFileRoute("/docs_/api")({
  component: ApiReferencePage,
  head: () => ({
    meta: [
      { title: "API reference · Trackstage" },
      {
        name: "description",
        content:
          "Read an event's sessions, speakers and submissions over HTTP, plus a public .ics calendar feed. Interactive OpenAPI reference.",
      },
    ],
  }),
})

const SPEC_URL = "/docs/api/openapi.json"

function ApiReferencePage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-12 items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/docs" />}
          >
            <RiArrowLeftLine size={16} aria-hidden />
            Docs
          </Button>
          <Separator orientation="vertical" className="h-5 max-sm:hidden" />
          <Link
            to="/"
            aria-label="Trackstage home"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:hidden"
          >
            <Logo size="sm" />
          </Link>
          <span className="font-heading text-sm font-medium tracking-[-0.01em] text-muted-foreground max-sm:hidden">
            API reference
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="max-sm:hidden"
              nativeButton={false}
              render={<Link to="/docs/mcp" />}
            >
              <RiRobot2Line size={16} aria-hidden />
              MCP server
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={SPEC_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiDownloadLine size={16} aria-hidden />
              openapi.json
            </Button>
          </div>
        </div>
      </header>

      <ScalarReference specUrl={SPEC_URL} />
    </div>
  )
}
