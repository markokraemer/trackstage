import { useState } from "react"
import { RiPlugLine } from "@remixicon/react"

import { cn } from "@/lib/utils"

/**
 * Shared brand-icon set for "connect your client" surfaces — /docs/mcp and
 * Settings → API & MCP both render these, so identity lives in one place
 * and the two surfaces can never drift apart.
 */
export type McpClientId = "claude" | "chatgpt" | "codex" | "cursor" | "any"

/** Domain Google's favicon service resolves each client's brand mark from. */
const CLIENT_ICON_DOMAIN: Partial<Record<McpClientId, string>> = {
  claude: "claude.ai",
  chatgpt: "chatgpt.com",
  codex: "openai.com",
  cursor: "cursor.com",
}

/**
 * One client's icon: a real brand favicon fetched from Google's favicon
 * service, or a generic plug glyph for clients with no single brand mark
 * (e.g. "any client"). Fetching a favicon is an external request, so a
 * failed load falls back to the same generic glyph instead of a broken
 * image — the tab must never show a broken-image icon.
 */
export function ClientIcon({
  client,
  className,
}: {
  client: McpClientId
  className?: string
}) {
  const domain = CLIENT_ICON_DOMAIN[client]
  const [failed, setFailed] = useState(false)

  if (!domain || failed) {
    return (
      <RiPlugLine
        aria-hidden
        className={cn("size-4 shrink-0 text-current", className)}
      />
    )
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      aria-hidden
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(
        "size-4 shrink-0 rounded-[4px] object-contain",
        className
      )}
    />
  )
}
