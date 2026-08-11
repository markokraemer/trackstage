import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import type { AccountSettingsTab } from "@/components/shell/settings-dialogs"

const ACCOUNT_TABS = ["profile", "security", "api-mcp"] as const

function isAccountTab(value: unknown): value is AccountSettingsTab {
  return (
    typeof value === "string" &&
    (ACCOUNT_TABS as readonly string[]).includes(value)
  )
}

/**
 * LEGACY address — account settings used to be a PAGE here; it is a MODAL now
 * (`?settings=account`, hosted by the /app shell — Marko, 2026-08-11: only
 * EVENT settings is a page). This route stays forever so old bookmarks, docs
 * links and the eval kit keep resolving: it lands on the best page available
 * (the event dashboard, else the workspace's no-events screen) with the
 * account modal open and the old `?tab=` mapped onto `?settingsTab=`.
 */
export const Route = createFileRoute("/app/account")({
  validateSearch: (search: Record<string, unknown>) =>
    isAccountTab(search.tab) ? { tab: search.tab } : {},
  component: AccountSettingsRedirect,
})

function AccountSettingsRedirect() {
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const { event, workspace } = useCurrentEvent()

  const eventRef = event ? eventRefOf(event) : undefined
  const workspaceSlug = workspace?.slug

  useEffect(() => {
    // A full search object (not an updater): the legacy `?tab=` key is
    // deliberately left behind, replaced by the namespaced `settingsTab`.
    const search = {
      settings: "account" as const,
      settingsTab: tab,
    }
    if (eventRef) {
      void navigate({
        to: "/app/$workspaceSlug/$eventSlug",
        params: eventRef,
        search,
        replace: true,
      })
    } else if (workspaceSlug) {
      // No event yet — the old workspace-hub address renders a neutral
      // no-events screen and hosts whichever settings modal is asked for.
      void navigate({
        to: "/app/$workspaceSlug/workspace",
        params: { workspaceSlug },
        search,
        replace: true,
      })
    }
  }, [eventRef?.workspaceSlug, eventRef?.eventSlug, workspaceSlug, tab, navigate])

  // Content-shaped skeleton for the redirect's single frame (rule 26).
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-32 w-full" />
      <p className="sr-only">Opening account settings…</p>
    </div>
  )
}
