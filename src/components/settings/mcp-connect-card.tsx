import { useRef, useState } from "react"
import { useMutation } from "convex/react"
import {
  RiCheckboxCircleLine,
  RiInformationLine,
  RiPlugLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
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

/** What the snippets SHOW. The real key only ever exists in the copied text. */
const MASKED_KEY = "sb_live_••••••••••••"

/**
 * "Connect from your AI assistant" — the MCP setup surface (docs/memory/
 * RULES.md 21: "connect and it just works perfectly"). One endpoint, four
 * client-specific tabs — and one-click setup: copying a key-bearing snippet
 * mints a personal API key on the spot and embeds it in the copied text, so
 * the flow is copy → paste → connected. On screen the key stays masked
 * (Marko, 2026-08-11: hidden in the UI, working when copied).
 */
export function McpConnectCard({ apiKey }: { apiKey: string | null }) {
  const endpoint = mcpEndpoint()
  const createKey = useMutation(api.apiKeys.create)
  // The plaintext is only mintable once, so whatever we mint is held for the
  // rest of this visit and every later copy reuses it instead of stacking keys.
  const [minted, setMinted] = useState<string | null>(null)
  const minting = useRef<Promise<string> | null>(null)

  /** The key to embed in copied snippets — mint one the first time. */
  async function resolveKey(): Promise<string | null> {
    if (apiKey) return apiKey
    if (minted) return minted
    try {
      // Single-flight: a double-click must not create two keys.
      minting.current ??= createKey({ name: "AI assistant (auto-created)" }).then(
        (created) => created.key,
      )
      const key = await minting.current
      setMinted(key)
      toast.success(
        "API key created and embedded in the copied command — manage it under API keys.",
      )
      return key
    } catch (error) {
      minting.current = null
      toast.error(
        error instanceof Error && /20 API keys/.test(error.message)
          ? "You already have 20 API keys — revoke one above, then copy again."
          : "Couldn't create an API key — try again.",
      )
      return null
    }
  }

  const hasKey = Boolean(apiKey ?? minted)
  const claudeCommand = (key: string) =>
    `claude mcp add trackstage --transport http ${endpoint} --header "Authorization: Bearer ${key}"`
  const codexConfig = (key: string) =>
    [
      "[mcp_servers.trackstage]",
      `url = "${endpoint}"`,
      `http_headers = { Authorization = "Bearer ${key}" }`,
    ].join("\n")
  const anyConfig = (key: string) =>
    JSON.stringify(
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
    )
  const copyWith = (compose: (key: string) => string) => async () => {
    const key = await resolveKey()
    return key === null ? null : compose(key)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiPlugLine size={18} aria-hidden className="text-primary" />
          Connect from your AI assistant
        </CardTitle>
        <CardDescription>
          Point Claude, ChatGPT, Codex or any MCP-compatible client at this
          event so it can read and manage it for you. One copy sets everything
          up — a key is created for you and included in what you paste.
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
                Copy, paste in your terminal, done — the command carries a key
                created for you.
              </p>
              <CodeSnippet
                title="Terminal"
                copyLabel="Copy command"
                successMessage="Command copied — paste it in your terminal"
                value={claudeCommand(MASKED_KEY)}
                getCopyValue={copyWith(claudeCommand)}
              />
              <KeyNote hasKey={hasKey} />
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
              Copy this into your Codex config — the key is filled in for you on
              copy.
            </p>
            <CodeSnippet
              title="~/.codex/config.toml"
              copyLabel="Copy config"
              successMessage="Config copied — paste it into ~/.codex/config.toml"
              value={codexConfig(MASKED_KEY)}
              getCopyValue={copyWith(codexConfig)}
            />
            <KeyNote hasKey={hasKey} />
          </TabsContent>

          <TabsContent value="any" className="flex flex-col gap-3 pt-4">
            <p className="text-sm text-muted-foreground">
              A generic streamable-HTTP MCP config — for Cursor, Windsurf, or
              anything else that speaks MCP over HTTP with a bearer token.
            </p>
            <CodeSnippet
              title="mcp.json"
              copyLabel="Copy config"
              successMessage="Config copied — the key is inside"
              value={anyConfig(MASKED_KEY)}
              getCopyValue={copyWith(anyConfig)}
            />
            <KeyNote hasKey={hasKey} />
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
        <RiCheckboxCircleLine
          size={14}
          aria-hidden
          className="text-status-green-dot"
        />
        Your key is embedded in what you copy — it stays hidden on screen.
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RiInformationLine size={14} aria-hidden />
      No setup needed — copying creates a personal API key and includes it
      automatically.
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
