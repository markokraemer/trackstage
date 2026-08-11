import { useEffect } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { RiBuilding2Line } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { appLink } from "@/lib/app-links"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"

/**
 * `/app/:workspaceSlug` — a workspace with no section named. Lands on the
 * workspace's event context: the event you last touched there (else its first
 * event) at its canonical dashboard, or the workspace hub when it owns no
 * events yet. An address naming a workspace you can't reach reads exactly
 * like one that doesn't exist.
 */
export const Route = createFileRoute("/app/$workspaceSlug/")({
  component: WorkspaceIndexRedirect,
})

function WorkspaceIndexRedirect() {
  const { workspaceSlug } = Route.useParams()
  const navigate = useNavigate()
  const { event, workspace, isLoading } = useCurrentEvent()

  const known = workspace?.slug === workspaceSlug
  const target = known
    ? event && event.organizationId === workspace.id
      ? appLink.dashboard(eventRefOf(event))
      : appLink.workspaceHub(workspace.slug)
    : undefined

  useEffect(() => {
    if (target) void navigate({ href: target, replace: true })
  }, [target, navigate])

  if (!known && !isLoading) {
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

  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <p className="sr-only">Loading…</p>
    </div>
  )
}
