import { createFileRoute } from "@tanstack/react-router"

import { Callout, DocArticle, DocLink, Step, Steps } from "@/components/docs/doc-primitives"
import { CodeSnippet } from "@/components/settings/code-snippet"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/docs/self-host")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Self-host · Trackstage docs" },
      {
        name: "description",
        content:
          "Run your own Trackstage: clone, install, provision a free Convex backend, and deploy.",
      },
    ],
  }),
})

const RUN_LOCALLY = `git clone https://github.com/markokraemer/trackstage
cd trackstage
pnpm install`

const PROVISION = `pnpm dev:setup   # signs you in to Convex and provisions a free backend`

const START = `pnpm dev                          # http://localhost:3000
pnpm exec convex run seed:setup   # optional: demo event + organizer login`

const DEPLOY = `pnpm deploy   # Convex backend + Cloudflare Workers frontend`

/** Everything optional. The app runs without a single one of them. */
const ENV = [
  {
    name: "RESEND_API_KEY",
    what: "Sends real email. Without it, every message is written to the outbox instead.",
  },
  {
    name: "SITE_URL",
    what: "Your app's public origin. Required for MCP OAuth and for links inside emails.",
  },
  {
    name: "PUBLIC_API_TOKEN",
    what:
      "Your own read-only token for the whole HTTP API. Unset, that role falls to `demo-api-token`, which otherwise reads only the seeded demo events.",
  },
  {
    name: "OPENROUTER_API_KEY",
    what: "Turns the AI copilot on.",
  },
  {
    name: "REQUIRE_EMAIL_VERIFICATION",
    what: "Set it to block password sign-in until an address is confirmed. Off by default.",
  },
] as const

function Page() {
  return (
    <DocArticle
      title="Self-host"
      lead="Trackstage is MIT-licensed and runs on a free Convex backend — about five minutes from clone to a working app."
    >
      <Steps>
        <Step title="Clone it and install.">
          <CodeSnippet value={RUN_LOCALLY} title="Terminal" successMessage="Copied" />
        </Step>

        <Step title="Provision your backend. This opens a browser once to sign you in to Convex, then writes the connection into .env.local.">
          <CodeSnippet value={PROVISION} title="Terminal" successMessage="Copied" />
        </Step>

        <Step title="Start it. Seeding is optional — it fills the app with a demo event so you have something to click.">
          <CodeSnippet value={START} title="Terminal" successMessage="Copied" />
        </Step>

        <Step title="Deploy when you are ready. One command pushes the Convex backend and the Cloudflare Workers frontend.">
          <CodeSnippet value={DEPLOY} title="Terminal" successMessage="Copied" />
        </Step>
      </Steps>

      <h2 className="font-heading mt-12 text-lg font-semibold tracking-[-0.02em] text-foreground">
        Optional settings
      </h2>
      <p className="mt-1 text-[0.875rem] text-muted-foreground">
        Set these on your Convex deployment. Everything works without them.
      </p>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {ENV.map((variable) => (
          <li key={variable.name} className="px-4 py-3">
            <Badge variant="secondary" className="font-mono text-[0.6875rem]">
              {variable.name}
            </Badge>
            <p className="mt-1 text-[0.8125rem] leading-6 text-muted-foreground">
              {variable.what}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3">
        <Callout tone="note">
          <strong>Your first account, before you configure email.</strong>{" "}
          Signing up sends a confirmation link, and without{" "}
          <code>RESEND_API_KEY</code> that link is only written to the outbox
          — which you need to be signed in to read. Two ways round it: set{" "}
          <code>RESEND_API_KEY</code> first, or sign up with an{" "}
          <code>@example.com</code> address, which is born confirmed (it is a
          reserved domain that can never receive mail, so it is never walled
          behind it). Seeding does the same for its demo organizer.
        </Callout>
        <Callout tone="tip">
          Your own deployment gets the same{" "}
          <DocLink to="/docs/api">API</DocLink> and{" "}
          <DocLink to="/docs/mcp">MCP server</DocLink> — point them at your host
          instead of the demo one.
        </Callout>
      </div>
    </DocArticle>
  )
}
