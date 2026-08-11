import { useEffect } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import { RiBuilding2Line, RiCalendarEventLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"
import type { SettingsModalSearch } from "@/components/shell/settings-dialogs"
import { settingsModalSearch } from "@/components/shell/settings-dialogs"

interface WorkspaceHubSearch {
  /** LEGACY key — the old page's `?event=` invite scope; now `inviteEvent`. */
  event?: string
}

/**
 * LEGACY address — workspace settings used to be a PAGE here, and it was the
 * page Marko singled out: "it just redirects you to the workspace settings
 * page and you have no fucking idea what to do there." Workspace settings is
 * a MODAL now (`?settings=workspace`, hosted by the /app shell). This route
 * stays forever so every old link keeps resolving:
 *
 *   workspace has events → replace-navigate to the event dashboard with the
 *                          modal open (you land somewhere real, settings on top)
 *   no events yet        → stay here: render the create-your-first-event
 *                          screen and open the modal over it in place
 *
 * The old `?invite=1&event=…` deep link (Event settings → Team card, before
 * the modal era) maps onto `?invite=1&inviteEvent=…`.
 */
export const Route = createFileRoute("/app/$workspaceSlug/workspace")({
  validateSearch: (search: Record<string, unknown>): WorkspaceHubSearch => ({
    ...(typeof search.event === "string" && search.event
      ? { event: search.event }
      : {}),
  }),
  component: WorkspaceHubHost,
})

function WorkspaceHubHost() {
  const { workspaceSlug } = Route.useParams()
  const navigate = useNavigate()
  const legacy = Route.useSearch()
  // The shell-level modal keys ride on every /app URL; read them loosely so
  // this component doesn't fight the /app route's own validation.
  const raw = useSearch({ strict: false })
  const modal: SettingsModalSearch = settingsModalSearch(raw)
  const { workspaceOptions, selectWorkspace, isLoading } = useCurrentEvent()

  const option = workspaceOptions.find((row) => row.slug === workspaceSlug)
  const firstEvent = option?.events.at(0)

  useEffect(() => {
    if (!option) return
    // Keep app context and address agreed on which workspace this is.
    if (!option.isCurrent) selectWorkspace(option.id)

    const search = {
      // An explicitly-asked-for modal (settings=account via the legacy
      // /app/account redirect) wins; otherwise this address MEANS workspace
      // settings, so that modal opens.
      settings: modal.settings ?? ("workspace" as const),
      settingsTab: modal.settingsTab,
      invite: modal.invite,
      inviteEvent: modal.inviteEvent ?? legacy.event,
    }

    if (firstEvent) {
      const ref = eventRefOf(firstEvent)
      void navigate({
        to: "/app/$workspaceSlug/$eventSlug",
        params: ref,
        search,
        replace: true,
      })
    } else if (modal.settings === undefined || legacy.event !== undefined) {
      // No event to land on — host the modal right here, over the
      // first-event empty state below. Normalize the URL once.
      void navigate({
        to: "/app/$workspaceSlug/workspace",
        params: { workspaceSlug },
        search: { ...search, event: undefined },
        replace: true,
      })
    }
  }, [
    option?.id,
    option?.isCurrent,
    firstEvent?._id,
    modal.settings,
    modal.settingsTab,
    modal.invite,
    modal.inviteEvent,
    legacy.event,
    workspaceSlug,
    navigate,
    selectWorkspace,
  ])

  if (!option && !isLoading) {
    return (
      <EmptyState
        icon={RiBuilding2Line}
        title="Workspace not found."
        description="There's no workspace at this address that you have access to. Check the link, or switch workspace from the sidebar."
        action={
          <Link to={appLink.app} className={buttonVariants({ variant: "outline" })}>
            Back to the app
          </Link>
        }
        className="mx-auto mt-16 max-w-lg"
      />
    )
  }

  if (option && !firstEvent) {
    // The page under the modal for a brand-new workspace: creating the first
    // event is the one next step that matters.
    return (
      <EmptyState
        icon={RiCalendarEventLine}
        title="Create your first event"
        description="An event is one conference, summit or meetup. It holds its own call for speakers, submissions, speakers and agenda."
        action={<NewEventDialog label="Create an event" />}
        className="mx-auto mt-16 max-w-lg"
      />
    )
  }

  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <p className="sr-only">Opening workspace settings…</p>
    </div>
  )
}
