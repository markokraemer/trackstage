import { createFileRoute } from "@tanstack/react-router"
import { RiDashboardLine } from "@remixicon/react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Who you need to chase, and what's happening with your program."
      />
      <EmptyState
        icon={RiDashboardLine}
        title="Your dashboard is warming up"
        description="Once submissions start arriving you'll see submission counts, accepted speakers, and the speakers with outstanding tasks right here."
      />
    </div>
  )
}
