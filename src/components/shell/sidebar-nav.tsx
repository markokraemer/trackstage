import { Link } from "@tanstack/react-router"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface NavItem {
  label: string
  to: string
  icon: RemixiconComponentType
  exact?: boolean
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
}: {
  groups: Array<NavGroup>
  onNavigate?: () => void
  itemClassName?: string
}) {
  return (
    <nav aria-label="Main" className="px-3 pt-2 pb-6">
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
                <Link
                  to={item.to}
                  title={item.label}
                  activeOptions={{ exact: item.exact ?? false }}
                  onClick={onNavigate}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full justify-start gap-2.5 px-2.5 font-medium text-foreground/80",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    itemClassName,
                  )}
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                    "aria-current": "page",
                  }}
                >
                  <item.icon size={17} aria-hidden className="shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
