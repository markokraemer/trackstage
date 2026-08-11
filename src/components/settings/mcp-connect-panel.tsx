import { useRef, useState } from "react"
import { useMutation } from "convex/react"
import { RiCheckboxCircleLine, RiInformationLine } from "@remixicon/react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import { cn } from "@/lib/utils"
import { ClientIcon } from "@/components/docs/client-icon"
import type { McpClientId } from "@/components/docs/client-icon"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { CopyButton } from "@/components/settings/copy-button"
import { CodeSnippet } from "@/components/settings/code-snippet"
import { mcpEndpoint } from "@/lib/deployment-urls"
import { errorMessage } from "@/lib/errors"

/** What the snippets SHOW. The real key only ever exists in the copied text. */
const MASKED_KEY = "sb_live_••••••••••••"

/**
 * The one "connect your AI assistant" surface (docs/memory/RULES.md 21:
 * "connect and it just works perfectly"), extracted so it can be shown
 * wherever the organizer happens to want it — inline in Account settings, and
 * as a modal from the copilot page — WITHOUT forking the snippets. There is
 * exactly one copy of the Claude/ChatGPT/Codex instructions in the product,
 * and this is it.
 *
 * One endpoint, four client tabs, and one-click setup: copying a key-bearing
 * snippet mints a personal API key on the spot and embeds it in the copied
 * text, so the flow is copy → paste → connected. On screen the key stays
 * masked (Marko, 2026-08-11: hidden in the UI, working when copied).
 *
 * SCOPE, stated honestly: the key is an ACCOUNT credential, not an event one.
 * It does whatever its owner can do — every workspace they belong to, every
 * event that workspace lets them see (convex/lib/auth.ts). The copy says so;
 * an organizer who believes they handed out an event-shaped key would be
 * handing out more than they think.
 */
export function McpConnectPanel({
  apiKey,
  className,
}: {
  apiKey: string | null
  className?: string
}) {
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
        /20 API keys/.test(errorMessage(error, ""))
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
    <div className={cn("flex w-full min-w-0 flex-col gap-6", className)}>
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

      <Tabs defaultValue="claude" className="min-w-0">
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

        <TabsContent value="claude" className="flex min-w-0 flex-col gap-6 pt-4">
          <div className="flex min-w-0 flex-col gap-2">
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

          <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4">
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

        <TabsContent value="chatgpt" className="flex min-w-0 flex-col gap-3 pt-4">
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

        <TabsContent value="codex" className="flex min-w-0 flex-col gap-3 pt-4">
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

        <TabsContent value="any" className="flex min-w-0 flex-col gap-3 pt-4">
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
    </div>
  )
}

/** The honest one-liner about what a connected client may do. Shared copy. */
export const MCP_SCOPE_COPY =
  "Point Claude, ChatGPT, Codex or any MCP client at Trackstage — it can do everything your account can do, across your workspaces and events."

/**
 * TWO marks, not three (Marko, 2026-08-11): Codex and ChatGPT are both
 * OpenAI, so the third circle just reads as the second one repeated.
 */
const STACK_CLIENTS: Array<McpClientId> = ["claude", "chatgpt"]

/**
 * The overlapping client marks. Used as the face of the connect action — two
 * logos say "works with your assistant" faster than any label does, and the
 * label is still there next to them.
 */
export function McpClientStack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center -space-x-1.5", className)}
    >
      {STACK_CLIENTS.map((client) => (
        <span
          key={client}
          className="flex size-5 items-center justify-center rounded-full bg-background ring-1 ring-border"
        >
          <ClientIcon client={client} className="size-3.5" />
        </span>
      ))}
    </span>
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
