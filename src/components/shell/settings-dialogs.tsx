import { useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { useCurrentEvent } from "@/lib/current-event"

/**
 * LEGACY `?settings=` interpreter — back-compat for the brief modal era
 * (2026-08-12): account and workspace settings were modals addressed by
 * shell-level search params before Marko's final call flipped them back to
 * standalone PAGES ("instead of being a modal just make it a standalone page
 * again" — see docs/memory/DECISIONS.md). Any URL from that window —
 * bookmarks, history entries, emailed links —
 *
 *     ?settings=account&settingsTab=api-mcp
 *     ?settings=workspace&settingsTab=team&invite=1&inviteEvent=…
 *
 * still resolves: this host (mounted once in the /app shell) rewrites it to
 * the page equivalent (`/app/account?tab=…`,
 * `/app/:ws/workspace?tab=…&invite=1&event=…`) and gets out of the way.
 * The RULE going forward: settings surfaces are pages; dialogs are for atomic
 * actions only; never a dialog over a dialog.
 */

export type SettingsModalKind = "account" | "workspace"
export type AccountSettingsTab = "profile" | "security" | "api-mcp"
export type WorkspaceSettingsTab = "general" | "team" | "events"
export type SettingsTab = AccountSettingsTab | WorkspaceSettingsTab

export interface SettingsModalSearch {
  settings?: SettingsModalKind
  settingsTab?: SettingsTab
  invite?: boolean
  inviteEvent?: string
}

const ALL_TABS: ReadonlyArray<SettingsTab> = [
  "profile",
  "security",
  "api-mcp",
  "general",
  "team",
  "events",
]

/**
 * `validateSearch` for the `/app` layout route. Conditional keys (never
 * `{ settings: undefined }`) keep `search` OPTIONAL on every plain
 * `<Link to="/app/…">` in the app.
 */
export function settingsModalSearch(
  search: Record<string, unknown>,
): SettingsModalSearch {
  const out: SettingsModalSearch = {}
  if (search.settings === "account" || search.settings === "workspace") {
    out.settings = search.settings
  }
  if (
    typeof search.settingsTab === "string" &&
    (ALL_TABS as ReadonlyArray<string>).includes(search.settingsTab)
  ) {
    out.settingsTab = search.settingsTab as SettingsTab
  }
  if (search.invite === true || search.invite === "1" || search.invite === 1) {
    out.invite = true
  }
  if (typeof search.inviteEvent === "string" && search.inviteEvent) {
    out.inviteEvent = search.inviteEvent
  }
  return out
}

/** Mounted once in the organizer shell (src/routes/app/route.tsx). */
export function SettingsDialogsHost() {
  const navigate = useNavigate()
  const raw = useSearch({ strict: false })
  const search = settingsModalSearch(raw)
  const { workspace } = useCurrentEvent()
  const workspaceSlug = workspace?.slug

  const kind = search.settings
  const { settingsTab, invite, inviteEvent } = search

  useEffect(() => {
    if (!kind) return
    if (kind === "account") {
      void navigate({
        to: "/app/account",
        search:
          settingsTab === "security" || settingsTab === "api-mcp"
            ? { tab: settingsTab }
            : {},
        replace: true,
      })
      return
    }
    if (!workspaceSlug) return // resolves on the next render
    const tab =
      settingsTab === "team" || settingsTab === "events"
        ? settingsTab
        : invite
          ? ("team" as const)
          : undefined
    void navigate({
      to: "/app/$workspaceSlug/workspace",
      params: { workspaceSlug },
      search: { tab, invite, event: inviteEvent },
      replace: true,
    })
  }, [kind, settingsTab, invite, inviteEvent, workspaceSlug, navigate])

  return null
}
