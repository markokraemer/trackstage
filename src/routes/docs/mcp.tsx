import { createFileRoute } from "@tanstack/react-router"
import {
  RiAlarmWarningLine,
  RiCheckLine,
  RiLock2Line,
} from "@remixicon/react"

import { Callout, DocLink, Shot } from "@/components/docs/doc-primitives"
import { CodeSnippet } from "@/components/settings/code-snippet"
import { Badge } from "@/components/ui/badge"
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

function McpPage() {
  const endpoint = mcpEndpoint()

  return (
    <div>
      <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-foreground">
        MCP server
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-7 text-pretty text-muted-foreground">
        Let Claude, ChatGPT, Codex or any other AI assistant work on your event
        with you — ask for what you want in chat, and it uses Trackstage on
        your behalf.
      </p>

      {/* ——— Connect from the app ——————————————————————————————————— */}
      <h2 className="mt-10 font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
        Connect your assistant
      </h2>
      <p className="doc-prose mt-3">
        Do it from inside the app: open the <strong>Copilot</strong> screen
        (in your event&rsquo;s sidebar) and click{" "}
        <strong>Connect MCP</strong> in the top-right corner. It walks you
        through a one-click connection for Claude, ChatGPT, Codex and other
        assistants — with the right link and the right steps for each one, so
        there is nothing to get wrong.
      </p>
      <div className="mt-4">
        <Shot
          src="copilot.png"
          alt="The Copilot screen with the Connect MCP button in the top-right corner of the header."
          caption="The Copilot screen — Connect MCP sits in the top-right corner."
        />
      </div>

      {/* ——— The link, for assistants that ask for one ————————————— */}
      <h2 className="mt-10 font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
        If your assistant asks for a link
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
        Some assistants just want this link. Paste it where they ask, then sign
        in with your Trackstage account when your browser opens — no key to
        copy. The Connect MCP dialog covers the rest, including the assistants
        that want an API key instead.
      </p>

      <div className="mt-3">
        <Callout tone="note">
          However it connects, the assistant acts as <em>you</em>: it can see
          and change exactly what your account can, in the workspaces you
          belong to.
        </Callout>
      </div>

      {/* ——— Try it ————————————————————————————————————————————————— */}
      <h2 className="mt-10 font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
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
      <h2 className="mt-10 font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
        All {MCP_TOOL_COUNT} tools
      </h2>
      <p className="mt-1 text-[0.875rem] text-muted-foreground">
        Everything an assistant can do in Trackstage, in one list.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <RiCheckLine
            size={13}
            aria-hidden
            className="text-[var(--status-green-dot)]"
          />
          Only looks things up — runs right away
        </span>
        <span className="flex items-center gap-1.5">
          <RiAlarmWarningLine
            size={13}
            aria-hidden
            className="text-[var(--status-amber-dot)]"
          />
          Creates something — asks you first
        </span>
        <span className="flex items-center gap-1.5">
          <RiLock2Line
            size={13}
            aria-hidden
            className="text-[var(--status-red-dot)]"
          />
          Changes or deletes something — asks you first
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
          Nothing changes without your yes. Any tool that would create, change
          or delete something in your event refuses to run until you approve
          it — so an assistant can never email your speakers or touch your
          agenda behind your back. Deleting an event goes one step further:
          you also have to type the event&rsquo;s exact name.
        </Callout>
        <Callout tone="note">
          The in-app <DocLink to="/docs/guide/ai-copilot">AI copilot</DocLink>{" "}
          uses these same tools, and shows you an approval card before
          anything that changes your event.
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
        role="img"
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
        role="img"
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
      role="img"
      aria-label="Creates data — requires confirm"
      className="mt-0.5 size-6 shrink-0 justify-center border-[var(--status-amber-dot)]/30 bg-[var(--status-amber-bg)] p-0 text-[var(--status-amber-fg)]"
    >
      <RiAlarmWarningLine size={13} aria-hidden />
    </Badge>
  )
}

