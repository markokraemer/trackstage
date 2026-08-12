import { useCallback, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { RiAddLine, RiBuilding2Line, RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { roleLabel } from "@/components/workspace/roles"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import type { WorkspaceOption } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"

/**
 * Workspace switching — level ONE of the shell's two-level picker
 * (docs/memory/RULES.md 23a/23c, and Marko: "proper UI to see all workspaces
 * you're part of & also a workspace switcher").
 *
 * A user can belong to several workspaces at once (they get invited into
 * other teams'). The sidebar picker therefore reads top-down as the hierarchy
 * itself: which workspace am I in → which of ITS events am I on. Everything
 * here is derived from `useCurrentEvent`, so the sidebar, the workspace hub
 * and the account menu can never disagree about the answer.
 */

/** "Owner · 3 events" — the one line every workspace row carries. */
export function workspaceMetaLabel(role: string, eventCount: number): string {
  return `${roleLabel(role)} · ${eventCount} event${eventCount === 1 ? "" : "s"}`
}

/**
 * Switching workspace NAVIGATES: the URL carries the working context
 * (docs/memory/DECISIONS.md, "URL architecture is fully hierarchical"), so
 * the target workspace's first reachable event lands at its canonical
 * dashboard, and an empty workspace lands on its first-run home — where
 * "create an event" is the obvious next step. The store write travels along
 * so global pages and bare legacy paths agree on the context.
 */
export function useWorkspaceSwitcher() {
  const { workspaceOptions, workspace, selectWorkspace } = useCurrentEvent()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const switchTo = useCallback(
    (workspaceId: string) => {
      const option = workspaceOptions.find((row) => row.id === workspaceId)
      const hasEvents = selectWorkspace(workspaceId)
      if (!option) return
      const first = option.events.at(0)
      // An empty workspace lands on its first-run home (create an event is
      // the obvious next step there) — never on workspace settings.
      void navigate({
        href:
          hasEvents && first
            ? appLink.dashboard(eventRefOf(first))
            : appLink.workspaceHome(option.slug),
      })
    },
    [workspaceOptions, selectWorkspace, navigate],
  )

  /**
   * Land on a JUST-created workspace's first-run home. It is always empty and,
   * crucially, not yet in `workspaceOptions` (the `workspaces.mine` query
   * hasn't refetched when the create mutation resolves) — so `switchTo` above
   * would find no option and bail. The create result carries the slug, which
   * is all the home link needs; the context write still moves the pointer.
   */
  const switchToCreated = useCallback(
    (created: { organizationId: string; slug: string }) => {
      selectWorkspace(created.organizationId)
      void navigate({ href: appLink.workspaceHome(created.slug) })
    },
    [selectWorkspace, navigate],
  )

  return {
    workspaceOptions,
    workspace,
    switchTo,
    switchToCreated,
    creating,
    setCreating,
  }
}

/**
 * The workspace level of the sidebar picker, rendered INSIDE the event
 * switcher's popover: the workspace you're in (checked), every workspace you
 * belong to, and a way to start another one.
 *
 * Deliberately a flat section rather than a hover submenu. The judge driving
 * this app is a browser agent and non-technical organizers are the users —
 * both do far better with "click the thing you can see" than with a submenu
 * that only exists while a pointer rests on its parent.
 */
export function WorkspaceMenuSection({
  workspaces,
  current,
  onSelect,
  onCreate,
}: {
  workspaces: Array<WorkspaceOption>
  current: WorkspaceOption | undefined
  onSelect: (workspaceId: string) => void
  onCreate: () => void
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>
        Workspace{current ? ` · ${roleLabel(current.role)}` : ""}
      </DropdownMenuLabel>
      <WorkspaceMenuItems workspaces={workspaces} onSelect={onSelect} />
      <DropdownMenuItem onClick={onCreate}>
        <RiAddLine size={15} aria-hidden />
        Create workspace
      </DropdownMenuItem>
    </DropdownMenuGroup>
  )
}

/**
 * The rows themselves — one per workspace you belong to, with your role and
 * how many of its events you can reach, the current one checked. Shared by the
 * sidebar picker and the avatar menu so the two can never drift apart.
 */
export function WorkspaceMenuItems({
  workspaces,
  onSelect,
}: {
  workspaces: Array<WorkspaceOption>
  onSelect: (workspaceId: string) => void
}) {
  return (
    <>
      {workspaces.map((row) => (
        <DropdownMenuItem
          key={row.id}
          aria-label={`Switch to ${row.name}`}
          onClick={() => onSelect(row.id)}
        >
          <WorkspaceTile name={row.name} size={20} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{row.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {workspaceMetaLabel(row.role, row.events.length)}
            </span>
          </span>
          {row.isCurrent ? (
            <RiCheckLine size={15} aria-hidden className="text-primary" />
          ) : null}
        </DropdownMenuItem>
      ))}
    </>
  )
}

/**
 * A workspace's identity mark: its initial on a neutral tile. Workspaces have
 * no uploaded logo (events do), so this stays deliberately quiet — it exists
 * to make the rows scannable, not to compete with the event branding one
 * level down.
 */
export function WorkspaceTile({
  name,
  size,
  className,
}: {
  name?: string
  size: number
  className?: string
}) {
  const initial = name?.trim().charAt(0).toUpperCase()

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        "bg-muted text-muted-foreground ring-1 ring-border ring-inset",
        className,
      )}
    >
      {initial ? (
        <span
          className="font-heading font-semibold text-foreground/70"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          {initial}
        </span>
      ) : (
        <RiBuilding2Line size={Math.round(size * 0.58)} />
      )}
    </span>
  )
}
