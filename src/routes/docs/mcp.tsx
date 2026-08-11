import { createFileRoute } from "@tanstack/react-router"
import {
  RiAlarmWarningLine,
  RiCheckLine,
  RiInformationLine,
  RiLock2Line,
} from "@remixicon/react"

import { ClientIcon } from "@/components/docs/client-icon"
import { Callout, DocLink } from "@/components/docs/doc-primitives"
import { CodeSnippet } from "@/components/settings/code-snippet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MCP_TOOL_COUNT, MCP_TOOL_GROUPS } from "@/docs/generated/mcp-tools"
import { mcpEndpoint } from "@/lib/deployment-urls"

export const Route = createFileRoute("/docs/mcp")({
  component: McpPage,
  head: () => ({
    meta: [
      { title: "MCP server · Trackstage docs" },
      {
        name: "description",
        content:
          "Connect Claude, ChatGPT, Codex or any MCP client to Trackstage and run your event by chat.",
      },
    ],
  }),
})

const PLACEHOLDER_KEY = "sb_live_xxx"

function McpPage() {
  const endpoint = mcpEndpoint()

  return (
    <div>
      <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-foreground">
        MCP server
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-7 text-pretty text-muted-foreground">
        One endpoint, {MCP_TOOL_COUNT} tools, everything the app can do. Point
        your assistant at it and ask for what you want.
      </p>

      {/* ——— The endpoint ——————————————————————————————————————————— */}
      <h2 className="font-heading mt-10 text-lg font-semibold tracking-[-0.02em] text-foreground">
        The endpoint
      </h2>
      <div className="mt-3">
        <CodeSnippet
          value={endpoint}
          title="MCP endpoint"
          copyLabel="Copy endpoint"
          successMessage="MCP endpoint copied to your clipboard"
        />
      </div>
      <p className="doc-prose mt-3">
        Two ways in. <strong>Just add the URL</strong> and sign in with your
        browser — Claude and ChatGPT both do this, no key to paste. Or send an{" "}
        <strong>API key</strong> as a bearer token, which is what CLI clients
        want. Create keys under Account settings → API &amp; MCP (avatar menu →
        Account settings), where they live — keys are personal, not per-event.
      </p>

      <div className="mt-3">
        <Callout tone="note">
          Either way, the server acts as <em>you</em>: it can see and change
          exactly what your account can, in the workspaces you belong to.
        </Callout>
      </div>

      {/* ——— Per-client setup ——————————————————————————————————————— */}
      <h2 className="font-heading mt-10 text-lg font-semibold tracking-[-0.02em] text-foreground">
        Connect your client
      </h2>

      <Tabs defaultValue="claude" className="mt-3">
        {/* Four labels plus their brand icons are a few pixels wider than a
            390px phone — let the strip scroll rather than the page. */}
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="claude">
            <ClientIcon client="claude" />
            Claude
          </TabsTrigger>
          <TabsTrigger value="chatgpt">
            <ClientIcon client="chatgpt" />
            ChatGPT
          </TabsTrigger>
          <TabsTrigger value="codex">
            <ClientIcon client="codex" />
            Codex
          </TabsTrigger>
          <TabsTrigger value="any">
            <ClientIcon client="any" />
            Any client
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claude" className="space-y-5 pt-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Claude desktop or claude.ai
            </h3>
            <ol className="doc-prose">
              <li>Settings → Connectors → Add custom connector.</li>
              <li>Paste the endpoint URL above.</li>
              <li>Sign in with your Trackstage account when prompted.</li>
            </ol>
            <OAuthNote />
          </div>
          <div className="space-y-2 border-t border-border pt-5">
            <h3 className="text-sm font-medium text-foreground">
              Claude Code (CLI)
            </h3>
            <p className="doc-prose">
              Run this once — Claude Code will remember it.
            </p>
            <CodeSnippet
              title="Terminal"
              copyLabel="Copy command"
              successMessage="Command copied to your clipboard"
              value={`claude mcp add trackstage --transport http ${endpoint} --header "Authorization: Bearer ${PLACEHOLDER_KEY}"`}
            />
            <KeyNote />
          </div>
        </TabsContent>

        <TabsContent value="chatgpt" className="space-y-2 pt-4">
          <p className="doc-prose">
            ChatGPT connects the same way as Claude’s Connectors — no key to
            paste, you just sign in.
          </p>
          <ol className="doc-prose">
            <li>Settings → Connectors → Create.</li>
            <li>Paste the endpoint URL above.</li>
            <li>Authenticate with your Trackstage account.</li>
          </ol>
          <OAuthNote />
        </TabsContent>

        <TabsContent value="codex" className="space-y-2 pt-4">
          <p className="doc-prose">Add this to your Codex config file.</p>
          <CodeSnippet
            title="~/.codex/config.toml"
            copyLabel="Copy config"
            successMessage="Config copied to your clipboard"
            value={`[mcp_servers.trackstage]\nurl = "${endpoint}"\nhttp_headers = { Authorization = "Bearer ${PLACEHOLDER_KEY}" }`}
          />
          <KeyNote />
        </TabsContent>

        <TabsContent value="any" className="space-y-2 pt-4">
          <p className="doc-prose">
            A generic streamable-HTTP MCP config — for Cursor, Windsurf, or
            anything else that speaks MCP over HTTP with a bearer token.
          </p>
          <CodeSnippet
            title="mcp.json"
            copyLabel="Copy config"
            successMessage="Config copied to your clipboard"
            value={JSON.stringify(
              {
                mcpServers: {
                  trackstage: {
                    type: "http",
                    url: endpoint,
                    headers: { Authorization: `Bearer ${PLACEHOLDER_KEY}` },
                  },
                },
              },
              null,
              2
            )}
          />
          <KeyNote />
        </TabsContent>
      </Tabs>

      {/* ——— Try it ————————————————————————————————————————————————— */}
      <h2 className="font-heading mt-10 text-lg font-semibold tracking-[-0.02em] text-foreground">
        Say this first
      </h2>
      <ul className="doc-prose mt-3">
        <li>“Summarise my event.”</li>
        <li>“Show me everything in the accept queue.”</li>
        <li>“Auto-fill the agenda.”</li>
        <li>“Which speakers still owe me slides?”</li>
        <li>“Send a reminder to speakers with open tasks.”</li>
      </ul>

      {/* ——— The tools —————————————————————————————————————————————— */}
      <h2 className="font-heading mt-10 text-lg font-semibold tracking-[-0.02em] text-foreground">
        All {MCP_TOOL_COUNT} tools
      </h2>
      <p className="mt-1 text-[0.875rem] text-muted-foreground">
        Generated from the server’s own definitions, so this list cannot drift.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <RiCheckLine size={13} aria-hidden className="text-[var(--status-green-dot)]" />
          Read-only — runs without approval
        </span>
        <span className="flex items-center gap-1.5">
          <RiAlarmWarningLine size={13} aria-hidden className="text-[var(--status-amber-dot)]" />
          Creates data — requires <code className="font-mono">confirm: true</code>
        </span>
        <span className="flex items-center gap-1.5">
          <RiLock2Line size={13} aria-hidden className="text-[var(--status-red-dot)]" />
          Changes or destroys data — requires{" "}
          <code className="font-mono">confirm: true</code>
        </span>
      </div>

      <div className="mt-4 space-y-6">
        {MCP_TOOL_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="text-[0.6875rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </h3>
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {group.tools.map((tool) => (
                <li key={tool.name} className="flex gap-3 px-4 py-3">
                  <ToolBadge
                    readOnly={tool.readOnly}
                    destructive={tool.destructive}
                  />
                  <div className="min-w-0 flex-1">
                    <code className="font-mono text-[0.8125rem] font-medium text-foreground">
                      {tool.name}
                    </code>
                    <p className="mt-0.5 text-[0.8125rem] leading-6 text-pretty text-muted-foreground">
                      {firstSentence(tool.description)}
                    </p>
                    {tool.required.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requires{" "}
                        {tool.required.map((arg, index) => (
                          <span key={arg}>
                            {index > 0 ? ", " : ""}
                            <code className="font-mono">{arg}</code>
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Callout tone="warning">
          Every tool that writes anything — creates included — refuses to run
          without <code>confirm: true</code>, so an assistant has to ask you
          before changing your event; reads never need it.{" "}
          <code>delete_event</code> additionally demands the event&rsquo;s
          exact name in <code>confirmName</code>. Tools are also annotated
          with the MCP <code>readOnlyHint</code>/<code>destructiveHint</code>{" "}
          hints, so clients that honor them (ChatGPT does) add their own
          approval prompt on top.
        </Callout>
        <Callout tone="note">
          The in-app{" "}
          <DocLink to="/docs/guide/ai-copilot">AI copilot</DocLink> uses this
          exact server, and shows an approval card before every tool that
          changes something — approving the card is what supplies{" "}
          <code>confirm: true</code>.
        </Callout>
      </div>
    </div>
  )
}

/** First sentence of a tool description — the list stays scannable. */
function firstSentence(description: string): string {
  const match = /^.*?[.!?](?=\s|$)/.exec(description)
  return match ? match[0] : description
}

function ToolBadge({
  readOnly,
  destructive,
}: {
  readOnly: boolean
  destructive: boolean
}) {
  if (readOnly) {
    return (
      <Badge
        variant="outline"
        aria-label="Read-only"
        className="mt-0.5 size-6 shrink-0 justify-center border-[var(--status-green-dot)]/30 bg-[var(--status-green-bg)] p-0 text-[var(--status-green-fg)]"
      >
        <RiCheckLine size={13} aria-hidden />
      </Badge>
    )
  }
  if (destructive) {
    return (
      <Badge
        variant="outline"
        aria-label="Changes or destroys data — requires confirm"
        className="mt-0.5 size-6 shrink-0 justify-center border-[var(--status-red-dot)]/30 bg-[var(--status-red-bg)] p-0 text-[var(--status-red-fg)]"
      >
        <RiLock2Line size={13} aria-hidden />
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      aria-label="Creates data — requires confirm"
      className="mt-0.5 size-6 shrink-0 justify-center border-[var(--status-amber-dot)]/30 bg-[var(--status-amber-bg)] p-0 text-[var(--status-amber-fg)]"
    >
      <RiAlarmWarningLine size={13} aria-hidden />
    </Badge>
  )
}

function OAuthNote() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <RiInformationLine size={14} aria-hidden className="mt-0.5 shrink-0" />
      Sign-in happens in your browser — no API key needed for this route.
    </p>
  )
}

function KeyNote() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <RiInformationLine size={14} aria-hidden className="mt-0.5 shrink-0" />
      Swap <code className="font-mono">{PLACEHOLDER_KEY}</code> for a key from
      Account settings → API &amp; MCP.
    </p>
  )
}
