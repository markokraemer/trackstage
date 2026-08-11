import { Link } from "@tanstack/react-router"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiUserSettingsLine,
} from "@remixicon/react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/lib/session"
import { useCurrentEvent } from "@/lib/current-event"
import { appLink, legacyAppLink } from "@/lib/app-links"

export type SettingsLevel = "account" | "workspace" | "event"

/**
 * The three settings levels, always in the same order and always visible, so
 * an organizer can never wonder which one they're editing
 * (docs/memory/RULES.md 23 — "never mix the levels"):
 *
 *     Account (you) · Workspace (your team + its events) · Event (this event)
 *
 * All three are real pages and all three are real links, so the strip doubles
 * as the way UP the hierarchy: an event's settings are one click from the
 * workspace that owns it, and the workspace one click from you. Each tab shows
 * WHICH thing it edits — your email, your workspace's name, the event's name —
 * because "Workspace settings" alone doesn't say *which* workspace.
 */
export function SettingsLevelNav({ level }: { level: SettingsLevel }) {
  const { session } = useSession()
  const { event, eventRef, workspace, isLoading } = useCurrentEvent()

  const items = [
    {
      value: "account" as const,
      label: "Account",
      detail: session?.email ?? "You",
      icon: RiUserSettingsLine,
      to: appLink.account,
    },
    {
      value: "workspace" as const,
      label: "Workspace",
      detail: workspace?.name ?? "Your team",
      icon: RiBuilding2Line,
      to: workspace?.slug
        ? appLink.workspaceHub(workspace.slug)
        : appLink.workspaceHubFallback,
    },
    {
      value: "event" as const,
      label: "Event",
      // "No event yet" is a claim about the account, not a loading
      // state — don't make it while the events list is still in flight.
      detail: event?.name ?? (isLoading ? "Loading…" : "No event yet"),
      icon: RiCalendarEventLine,
      to: eventRef ? appLink.settings(eventRef) : legacyAppLink.settings,
    },
  ]

  return (
    <Tabs value={level} aria-label="Settings level">
      <TabsList variant="line" className="h-auto flex-wrap">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            nativeButton={false}
            className="gap-2"
            render={<Link to={item.to as never} />}
          >
            <item.icon size={15} aria-hidden />
            <span className="font-medium">{item.label}</span>
            <span className="max-w-40 truncate text-xs text-muted-foreground max-sm:hidden">
              {item.detail}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
