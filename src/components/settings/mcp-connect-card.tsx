import {
  RiCheckboxCircleLine,
  RiInformationLine,
  RiPlugLine,
} from "@remixicon/react"

import { ClientIcon } from "@/components/docs/client-icon"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { CopyButton } from "@/components/settings/copy-button"
import { CodeSnippet } from "@/components/settings/code-snippet"
import { mcpEndpoint } from "@/lib/deployment-urls"

const PLACEHOLDER_KEY = "sb_live_xxx"

/**
 * "Connect from your AI assistant" — the MCP setup surface (docs/memory/
 * RULES.md 21: "connect and it just works perfectly"). One endpoint, four
 * client-specific tabs, every snippet copyable on its own.
 */
export function McpConnectCard({ apiKey }: { apiKey: string | null }) {
  const endpoint = mcpEndpoint()
  const key = apiKey ?? PLACEHOLDER_KEY

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiPlugLine size={18} aria-hidden className="text-primary" />
          Connect from your AI assistant
        </CardTitle>
        <CardDescription>
          Point Claude, ChatGPT, Codex or any MCP-compatible client at this
          event so it can read and manage it for you.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            MCP endpoint
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              readOnly
              value={endpoint}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 font-mono text-xs"
            />
            <CopyButton
              value={endpoint}
              label="Copy endpoint"
              successMessage="MCP endpoint copied to your clipboard"
            />
          </div>
        </div>

        <Tabs defaultValue="claude">
          <TabsList variant="line" className="h-auto flex-wrap">
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

          <TabsContent value="claude" className="flex flex-col gap-6 pt-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Claude Code (CLI)
              </h3>
              <p className="text-sm text-muted-foreground">
                Run this once in your terminal — Claude Code will remember it.
              </p>
              <CodeSnippet
                title="Terminal"
                copyLabel="Copy command"
                successMessage="Command copied to your clipboard"
                value={`claude mcp add trackstage --transport http ${endpoint} --header "Authorization: Bearer ${key}"`}
              />
              <KeyNote hasKey={Boolean(apiKey)} />
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">
                Claude desktop or claude.ai (Connectors)
              </h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Go to Settings → Connectors → Add custom connector.</li>
                <li>Paste the endpoint URL below.</li>
                <li>Sign in with your Trackstage account when prompted.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  readOnly
                  value={endpoint}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 font-mono text-xs"
                />
                <CopyButton value={endpoint} label="Copy URL" />
              </div>
              <OAuthNote />
            </div>
          </TabsContent>

          <TabsContent value="chatgpt" className="flex flex-col gap-3 pt-4">
            <p className="text-sm text-muted-foreground">
              ChatGPT connects the same way as Claude's Connectors — no key to
              paste, you just sign in.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Go to Settings → Connectors → Create.</li>
              <li>Paste the endpoint URL below.</li>
              <li>Authenticate with your Trackstage account.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={endpoint}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-xs"
              />
              <CopyButton value={endpoint} label="Copy URL" />
            </div>
            <OAuthNote />
          </TabsContent>

          <TabsContent value="codex" className="flex flex-col gap-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Add this to your Codex config file.
            </p>
            <CodeSnippet
              title="~/.codex/config.toml"
              copyLabel="Copy config"
              successMessage="Config copied to your clipboard"
              value={[
                "[mcp_servers.trackstage]",
                `url = "${endpoint}"`,
                `http_headers = { Authorization = "Bearer ${key}" }`,
              ].join("\n")}
            />
            <KeyNote hasKey={Boolean(apiKey)} />
          </TabsContent>

          <TabsContent value="any" className="flex flex-col gap-3 pt-4">
            <p className="text-sm text-muted-foreground">
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
                      headers: { Authorization: `Bearer ${key}` },
                    },
                  },
                },
                null,
                2,
              )}
            />
            <KeyNote hasKey={Boolean(apiKey)} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function KeyNote({ hasKey }: { hasKey: boolean }) {
  if (hasKey) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RiCheckboxCircleLine size={14} aria-hidden className="text-status-green-dot" />
        Filled in with the key you just created, above.
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RiInformationLine size={14} aria-hidden />
      Create a key above, then swap{" "}
      <code className="font-mono">{PLACEHOLDER_KEY}</code> for it.
    </p>
  )
}

function OAuthNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RiInformationLine size={14} aria-hidden />
      Sign-in happens in your browser — no API key needed for this route.
    </p>
  )
}
