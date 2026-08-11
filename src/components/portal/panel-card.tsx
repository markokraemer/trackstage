import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface PanelCardProps
  extends Omit<React.ComponentProps<typeof Card>, "title"> {
  icon?: RemixiconComponentType
  title: React.ReactNode
  /** One plain-English line under the title. */
  description?: React.ReactNode
  /** Rendered muted next to the title — "Submissions 3", never "(3)". */
  count?: number
  /** Right side of the header — usually a "View all" link. */
  action?: React.ReactNode
  /** Extra classes for the body. */
  bodyClassName?: string
  /**
   * Full-bleed body, for lists that supply their own row padding and want
   * their dividers to reach the card edge.
   */
  flush?: boolean
  children: React.ReactNode
}

/**
 * The portal's titled section card.
 *
 * It is deliberately NOT a portal invention: it is the exact organizer-app
 * recipe (Card → CardHeader with a bottom hairline → CardTitle with a muted
 * icon → CardAction), so a speaker and an organizer are looking at the same
 * product. The old solid-blue banner header was retired with the rest of the
 * tinted chrome (docs/memory/RULES.md #22 — colour carries data, never
 * chrome); the only thing left that is blue in here is a link.
 */
export function PanelCard({
  icon: Icon,
  title,
  description,
  count,
  action,
  bodyClassName,
  flush = false,
  className,
  children,
  ...props
}: PanelCardProps) {
  return (
    <Card data-slot="portal-panel" className={cn("gap-4", className)} {...props}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          {Icon ? (
            <Icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
          ) : null}
          <span className="min-w-0 truncate">{title}</span>
          {count !== undefined ? (
            <span className="font-normal text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : null}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn(flush && "px-0", bodyClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
