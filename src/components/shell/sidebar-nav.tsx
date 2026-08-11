import { Link } from "@tanstack/react-router"
import { RiExternalLinkLine } from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface NavItem {
  label: string
  to: string
  icon: RemixiconComponentType
  exact?: boolean
  /** Anchor id for the first-run guided tour (`data-tour` attribute). */
  tour?: string
  /**
   * A destination OUTSIDE the app (the public event page): rendered as a
   * plain new-tab anchor with an external-link glyph, never a router Link.
   */
  external?: boolean
}

export interface NavGroup {
  label?: string
  items: Array<NavItem>
}

/**
 * The organizer nav list — ONE markup for both shells: the static md+ aside
 * (src/routes/app/route.tsx) and the mobile drawer
 * (src/components/shell/mobile-nav.tsx). The drawer passes `onNavigate` so it
 * can close itself the moment a destination is chosen, and `itemClassName`
 * to give every row a ≥44px touch target without changing desktop rhythm.
 */
export function SidebarNav({
  groups,
  onNavigate,
  itemClassName,
  className,
  ariaLabel = "Main",
}: {
  groups: Array<NavGroup>
  onNavigate?: () => void
  itemClassName?: string
  /** Overrides the nav's padding rhythm (the pinned footer nav is tighter). */
  className?: string
  /** Distinguishes multiple navs per shell for assistive tech. */
  ariaLabel?: string
}) {
  const itemClasses = cn(
    buttonVariants({ variant: "ghost" }),
    "w-full justify-start gap-2.5 px-2.5 font-medium text-foreground/80",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    itemClassName,
  )

  return (
    <nav aria-label={ariaLabel} className={cn("px-3 pt-2 pb-6", className)}>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="mb-1">
          {group.label ? (
            <p className="mt-4 mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                {item.external ? (
                  <a
                    href={item.to}
                    target="_blank"
                    rel="noreferrer"
                    title={item.label}
                    onClick={onNavigate}
                    className={itemClasses}
                  >
                    <item.icon size={17} aria-hidden className="shrink-0" />
                    {item.label}
                    <RiExternalLinkLine
                      size={13}
                      aria-hidden
                      className="ml-auto shrink-0 text-muted-foreground"
                    />
                  </a>
                ) : (
                  <Link
                    to={item.to}
                    title={item.label}
                    data-tour={item.tour}
                    activeOptions={{ exact: item.exact ?? false }}
                    onClick={onNavigate}
                    className={itemClasses}
                    activeProps={{
                      className:
                        "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                      "aria-current": "page",
                    }}
                  >
                    <item.icon size={17} aria-hidden className="shrink-0" />
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
