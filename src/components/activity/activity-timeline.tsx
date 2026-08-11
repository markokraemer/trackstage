import {
  RiCalendarCheckLine,
  RiDeleteBin6Line,
  RiEditLine,
  RiErrorWarningLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiGlobeLine,
  RiKey2Line,
  RiMailSendLine,
  RiRobot2Line,
  RiShuffleLine,
  RiSparkling2Line,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * The audit log's one rendering (sbek CNT-11), shared by the submission
 * drawer's History tab and the event-wide Activity page.
 *
 * Read as a sentence, not a table: icon · what happened · who did it · when.
 * The heavy lifting is done server-side — `summary` is already a human
 * sentence — so this component's whole job is rhythm and attribution.
 */

export type ActivityRow = {
  _id: string
  _creationTime: number
  actorType: string
  actorLabel: string
  entity: string
  entityId: string
  action: string
  summary: string
  meta: Record<string, unknown> | null
}

const ACTION_ICONS: Partial<Record<string, RemixiconComponentType>> = {
  created: RiSparkling2Line,
  updated: RiEditLine,
  deleted: RiDeleteBin6Line,
  restored: RiFileTextLine,
  duplicated: RiFileCopyLine,
  status_changed: RiShuffleLine,
  decision_committed: RiMailSendLine,
  scheduled: RiCalendarCheckLine,
  rescheduled: RiCalendarCheckLine,
  unscheduled: RiCalendarCheckLine,
  auto_placed: RiCalendarCheckLine,
  published: RiGlobeLine,
  unpublished: RiGlobeLine,
  sync_conflict: RiErrorWarningLine,
  revoked: RiKey2Line,
}

function iconFor(row: ActivityRow): RemixiconComponentType {
  if (row.entity === "api-key") return RiKey2Line
  const mapped: RemixiconComponentType | undefined = ACTION_ICONS[row.action]
  if (mapped) return mapped
  // MCP tool calls use the tool name as their action, so anything unmapped
  // from an agent is agent-shaped.
  if (row.actorType === "mcp" || row.actorType === "api") return RiRobot2Line
  return RiEditLine
}

/** Agent and API traffic reads differently on purpose — that's the review lens. */
const ACTOR_STYLE: Record<string, string> = {
  mcp: "bg-primary/10 text-primary",
  api: "bg-primary/10 text-primary",
  speaker: "bg-amber-100 text-amber-800",
  system: "bg-muted text-muted-foreground",
  organizer: "bg-muted text-foreground",
}

const ACTOR_WORD: Record<string, string> = {
  mcp: "AI agent",
  api: "API",
  speaker: "Speaker",
  system: "Automatic",
  organizer: "Organizer",
}

export function ActivityTimeline({
  rows,
  emptyState,
  className,
}: {
  rows: Array<ActivityRow>
  emptyState?: React.ReactNode
  className?: string
}) {
  if (rows.length === 0) return <>{emptyState ?? null}</>

  return (
    <ol className={cn("flex flex-col", className)}>
      {rows.map((row, index) => {
        const Icon = iconFor(row)
        const last = index === rows.length - 1
        return (
          <li key={row._id} className="flex gap-3">
            {/* Rail: the dot marks the moment, the line ties the moments together. */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  ACTOR_STYLE[row.actorType] ?? "bg-muted text-muted-foreground"
                )}
              >
                <Icon size={14} aria-hidden />
              </span>
              {!last ? (
                <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
              ) : null}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
              <p className="text-sm text-foreground">{row.summary}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="truncate">{row.actorLabel}</span>
                <span aria-hidden>·</span>
                <time
                  dateTime={new Date(row._creationTime).toISOString()}
                  title={new Date(row._creationTime).toLocaleString()}
                >
                  {formatDistanceToNow(row._creationTime, { addSuffix: true })}
                </time>
                {row.actorType !== "organizer" ? (
                  <Badge variant="outline" className="font-normal">
                    {ACTOR_WORD[row.actorType] ?? row.actorType}
                  </Badge>
                ) : null}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
