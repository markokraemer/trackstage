import { createFileRoute } from "@tanstack/react-router"
import { RiDownloadLine } from "@remixicon/react"

import { Callout, DocLink } from "@/components/docs/doc-primitives"
import { ScalarReference } from "@/components/docs/scalar-reference"
import { CodeSnippet } from "@/components/settings/code-snippet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiBaseUrl, DEMO_API_TOKEN } from "@/lib/deployment-urls"
import { DEMO_EVENT_SLUG, EXTERNAL_LINK_PROPS } from "@/components/marketing/links"

export const Route = createFileRoute("/docs/api")({
  component: ApiPage,
  head: () => ({
    meta: [
      { title: "API reference · Sessionboard docs" },
      {
        name: "description",
        content:
          "Read an event's sessions, speakers and submissions over HTTP, plus a public .ics calendar feed.",
      },
    ],
  }),
})

const SPEC_URL = "/docs/api/openapi.json"

const ENDPOINTS = [
  {
    path: "/v1/event/{slug}/sessions",
    auth: true,
    what: "The published programme: every accepted session with its room, track and speakers.",
  },
  {
    path: "/v1/event/{slug}/speakers",
    auth: true,
    what: "Confirmed speakers, their bios and the sessions they are on. Includes email.",
  },
  {
    path: "/v1/event/{slug}/submissions",
    auth: true,
    what: "Every submission at every status, newest first. The one to poll into a sheet.",
  },
  {
    path: "/v1/event/{slug}/schedule.ics",
    auth: false,
    what: "A calendar feed anyone can subscribe to. No key.",
  },
] as const

function ApiPage() {
  const base = apiBaseUrl()
  const quickstart = `curl -s "${base}/v1/event/${DEMO_EVENT_SLUG}/sessions?page=1&pageSize=25" \\
  -H "Authorization: Bearer ${DEMO_API_TOKEN}"

# No key needed for the calendar feed:
curl -s "${base}/v1/event/${DEMO_EVENT_SLUG}/schedule.ics"`

  return (
    <div>
      <div className="container-reading">
        <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-foreground">
          API reference
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-7 text-pretty text-muted-foreground">
          Four read-only endpoints over one event, addressed by its slug. Every
          timestamp is epoch milliseconds.
        </p>

        <h2 className="font-heading mt-10 text-lg font-semibold tracking-[-0.02em] text-foreground">
          Quickstart
        </h2>
        <p className="mt-1 mb-3 text-[0.875rem] text-muted-foreground">
          The demo deployment answers to <code className="rounded-[0.3rem] border border-border bg-muted px-1 py-0.5 font-mono text-[0.8125em] text-foreground">demo-api-token</code>.
          Your own key comes from Settings → API &amp; MCP.
        </p>
        <CodeSnippet
          value={quickstart}
          title="Terminal"
          copyLabel="Copy"
          successMessage="Command copied to your clipboard"
        />

        <h2 className="font-heading mt-10 text-lg font-semibold tracking-[-0.02em] text-foreground">
          The whole surface
        </h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {ENDPOINTS.map((endpoint) => (
            <li key={endpoint.path} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[0.6875rem]">
                  GET
                </Badge>
                <code className="font-mono text-[0.8125rem] text-foreground">
                  {endpoint.path}
                </code>
                {endpoint.auth ? (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Bearer
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Public
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[0.8125rem] leading-6 text-muted-foreground">
                {endpoint.what}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={SPEC_URL} {...EXTERNAL_LINK_PROPS} />}
          >
            <RiDownloadLine size={16} aria-hidden />
            openapi.json
          </Button>
          <span className="text-xs text-muted-foreground">
            OpenAPI 3.1 — point any client generator at it.
          </span>
        </div>

        <div className="mt-6">
          <Callout tone="note">
            Need to <strong>write</strong>, not just read? Everything the app can
            do is exposed through the{" "}
            <DocLink to="/docs/mcp">MCP server</DocLink> — full parity, one
            endpoint.
          </Callout>
        </div>

        <h2 className="font-heading mt-12 text-lg font-semibold tracking-[-0.02em] text-foreground">
          Try it
        </h2>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Schemas, examples and a request runner for every endpoint.
        </p>
      </div>

      <div className="mt-4">
        <ScalarReference specUrl={SPEC_URL} />
      </div>
    </div>
  )
}
