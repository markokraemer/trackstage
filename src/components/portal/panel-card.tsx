import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export interface PanelCardProps
  extends Omit<React.ComponentProps<typeof Card>, "title"> {
  icon?: RemixiconComponentType
  title: React.ReactNode
  /** Right side of the blue banner — usually a "View all" link. */
  action?: React.ReactNode
  /** Extra classes for the body. */
  bodyClassName?: string
  children: React.ReactNode
}

/**
 * The speaker portal's signature panel: a solid blue banner with an icon and a
 * title, and a white body underneath (docs/ux/03, image17). Built on the
 * shadcn `Card` primitive so it stays identical to the rest of the product —
 * only the header treatment differs.
 */
export function PanelCard({
  icon: Icon,
  title,
  action,
  bodyClassName,
  className,
  children,
  ...props
}: PanelCardProps) {
  return (
    <Card
      data-slot="portal-panel"
      className={cn("gap-0 py-0", className)}
      {...props}
    >
      <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
        {Icon ? <Icon size={17} aria-hidden className="shrink-0" /> : null}
        <h2 className="font-heading min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </h2>
        {action ? <div className="shrink-0 text-sm">{action}</div> : null}
      </div>
      <CardContent className={cn("gap-3 p-4", bodyClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
