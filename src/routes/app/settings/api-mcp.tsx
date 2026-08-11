import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import {
  ApiKeysCard,
  type CreatedApiKey,
} from "@/components/settings/api-keys-card"
import { McpConnectCard } from "@/components/settings/mcp-connect-card"
import { McpCapabilitiesCard } from "@/components/settings/mcp-capabilities-card"
import { RestApiCard } from "@/components/settings/rest-api-card"

export const Route = createFileRoute("/app/settings/api-mcp")({
  component: ApiMcpPage,
})

/**
 * Settings → API & MCP (docs/memory/RULES.md 21 — "a PERFECT MCP and API").
 * The plaintext key from a fresh `apiKeys.create` call is held here for the
 * lifetime of the page so the connect snippets below can drop it straight
 * in, instead of making the organizer copy-paste it themselves.
 */
function ApiMcpPage() {
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <ApiKeysCard
        createdKey={createdKey}
        onCreated={setCreatedKey}
        onDismissCreated={() => setCreatedKey(null)}
      />
      <McpConnectCard apiKey={createdKey?.key ?? null} />
      <McpCapabilitiesCard />
      <RestApiCard />
    </div>
  )
}
