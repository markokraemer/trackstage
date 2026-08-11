import { Link } from "@tanstack/react-router"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiUserSettingsLine,
} from "@remixicon/react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentEvent } from "@/lib/current-event"

export type SettingsLevel = "account" | "workspace" | "event"

/**
 * The three settings levels, always in the same order and always visible, so
 * an organizer can never wonder which one they're editing
 * (docs/memory/RULES.md 23 — "never mix the levels"):
 *
 *     Account (you) · Workspace (your team + its events) · Event (this event)
 */
export function SettingsLevelNav({
  level,
  onOpenAccountSettings,
}: {
  level: SettingsLevel
  /**
   * Account settings is a modal now, not a page (docs/memory/RULES.md 23b) —
   * the caller opens it (via its own route-scoped navigate, so the `?account=`
   * search param stays correctly typed) instead of this shared component
   * navigating away from Workspace/Event settings.
   */
  onOpenAccountSettings: () => void
}) {
  const { event, workspace } = useCurrentEvent()

  const items = [
    {
      value: "account" as const,
      label: "Account",
      detail: "You",
      icon: RiUserSettingsLine,
      to: undefined,
    },
    {
      value: "workspace" as const,
      label: "Workspace",
      detail: workspace?.name ?? "Your team",
      icon: RiBuilding2Line,
      to: "/app/workspace",
    },
    {
      value: "event" as const,
      label: "Event",
      detail: event?.name ?? "No event yet",
      icon: RiCalendarEventLine,
      to: "/app/settings",
    },
  ]

  return (
    <Tabs value={level} aria-label="Settings level">
      <TabsList variant="line" className="h-auto flex-wrap">
        {items.map((item) =>
          item.to ? (
            <TabsTrigger
              key={item.value}
              value={item.value}
              nativeButton={false}
              className="gap-2"
              render={<Link to={item.to} />}
            >
              <item.icon size={15} aria-hidden />
              <span className="font-medium">{item.label}</span>
              <span className="max-w-40 truncate text-xs text-muted-foreground max-sm:hidden">
                {item.detail}
              </span>
            </TabsTrigger>
          ) : (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="gap-2"
              onClick={onOpenAccountSettings}
            >
              <item.icon size={15} aria-hidden />
              <span className="font-medium">{item.label}</span>
              <span className="max-w-40 truncate text-xs text-muted-foreground max-sm:hidden">
                {item.detail}
              </span>
            </TabsTrigger>
          )
        )}
      </TabsList>
    </Tabs>
  )
}
