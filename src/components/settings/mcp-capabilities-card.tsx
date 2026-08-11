import { RiSparklingLine } from "@remixicon/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MCP_TOOL_COUNT } from "@/docs/generated/mcp-tools"

const EXAMPLE_PROMPTS = [
  "Summarise my event",
  "Show me everything in the accept queue",
  "Auto-fill the agenda",
  "Which speakers still owe me slides?",
  "Send a reminder to speakers with open tasks",
  "Create a new CFP form for the workshop track",
]

/**
 * "What you can do with it" — every MCP tool across events, forms, submissions &
 * decisions, agenda, speakers/tasks and email (`convex/mcp.ts`). Kept as a
 * short prompt list rather than a tool-by-tool dump — organizers think in
 * outcomes, not tool names.
 */
export function McpCapabilitiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiSparklingLine size={18} aria-hidden className="text-primary" />
          What you can do with it
        </CardTitle>
        <CardDescription>
          {MCP_TOOL_COUNT} tools covering events, forms, submissions &amp;
          decisions, the agenda, speakers &amp; tasks, and email — anything your
          assistant can do, it can do here too. Destructive actions (sending
          decisions, bulk changes) still ask for confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <li
              key={prompt}
              className="truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
              title={prompt}
            >
              “{prompt}”
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
