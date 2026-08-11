import { RiPlugLine } from "@remixicon/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { McpConnectButton } from "@/components/settings/mcp-connect-dialog"
import { MCP_SCOPE_COPY } from "@/components/settings/mcp-connect-panel"
import { mcpEndpoint } from "@/lib/deployment-urls"
import { CopyButton } from "@/components/settings/copy-button"

/**
 * "Connect from your AI assistant", as a summary row (Marko, 2026-08-11).
 *
 * The instructions themselves moved into a shared modal
 * (mcp-connect-dialog.tsx) so the copilot page and this settings tab open the
 * SAME surface. What stays inline is what a settings page is for: the endpoint
 * you might want to copy on its own, an honest sentence about what a connected
 * client may do, and the way in.
 */
export function McpConnectCard({ apiKey }: { apiKey: string | null }) {
  const endpoint = mcpEndpoint()
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiPlugLine size={18} aria-hidden className="text-primary" />
          Connect from your AI assistant
        </CardTitle>
        <CardDescription>
          {MCP_SCOPE_COPY} One copy sets everything up — a key is created for
          you and included in what you paste.
        </CardDescription>
      </CardHeader>

      {/* `flex-row` explicitly: CardContent is a COLUMN by default, and
          `items-center` on a column centres everything horizontally — which is
          not the endpoint-left / actions-right row this wants. */}
      <CardContent className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            MCP endpoint
          </span>
          <code className="truncate font-mono text-xs text-foreground">
            {endpoint}
          </code>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton
            value={endpoint}
            label="Copy endpoint"
            variant="ghost"
            successMessage="MCP endpoint copied to your clipboard"
          />
          <McpConnectButton apiKey={apiKey} />
        </div>
      </CardContent>
    </Card>
  )
}
