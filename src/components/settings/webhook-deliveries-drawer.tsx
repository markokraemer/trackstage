import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { RiHistoryLine, RiSendPlaneLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { errorMessage } from "@/lib/errors"

/** Which endpoint the drawer is currently showing. `null` closes it. */
export interface WebhookDeliveriesDrawerTarget {
  webhookId: Id<"webhooks">
  url: string
}

/**
 * Delivery log for one webhook endpoint (`convex/webhooks.ts` `deliveries`) —
 * the last 10 attempts, newest first, with a "Send test" shortcut in the
 * footer so an organizer can watch a fresh attempt land without leaving the
 * drawer. The underlying query is reactive, so a queued test (or a real
 * event firing) appears and settles on its own — no polling or refresh
 * button needed.
 */
export function WebhookDeliveriesDrawer({
  target,
  open,
  onOpenChange,
}: {
  target: WebhookDeliveriesDrawerTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: deliveries, isPending } = useQuery(
    convexQuery(
      api.webhooks.deliveries,
      target ? { webhookId: target.webhookId, limit: 10 } : "skip",
    ),
  )
  const sendTest = useMutation({
    mutationFn: useConvexMutation(api.webhooks.sendTest),
  })

  async function handleSendTest() {
    if (!target) return
    try {
      await sendTest.mutateAsync({ webhookId: target.webhookId })
      toast.success(
        "Test delivery queued — it'll show up below in a few seconds.",
      )
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't send a test delivery."))
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Delivery log"
      description={
        target ? (
          <span className="block font-mono text-xs break-all">
            {target.url}
          </span>
        ) : undefined
      }
      footer={
        <Button
          type="button"
          size="sm"
          disabled={sendTest.isPending || !target}
          onClick={() => void handleSendTest()}
        >
          <RiSendPlaneLine size={15} aria-hidden />
          {sendTest.isPending ? "Sending…" : "Send test"}
        </Button>
      }
    >
      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !deliveries || deliveries.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={RiHistoryLine}
          title="No deliveries yet"
          description="Once something happens that this endpoint is subscribed to — or you send a test — every attempt shows up here with its result."
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {deliveries.map((delivery) => (
            <li
              key={delivery._id}
              className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs font-medium text-foreground">
                  {delivery.eventType}
                </span>
                <DeliveryStatusPill
                  status={delivery.status}
                  responseStatus={delivery.responseStatus}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span
                  title={format(delivery.createdAt, "MMM d, yyyy 'at' h:mm:ss a")}
                >
                  {formatDistanceToNow(delivery.createdAt, {
                    addSuffix: true,
                  })}
                </span>
                {delivery.responseStatus !== null ? (
                  <span>Response {delivery.responseStatus}</span>
                ) : null}
                {delivery.attempts > 1 ? (
                  <span>{delivery.attempts} attempts</span>
                ) : null}
              </div>
              {delivery.error ? (
                <p className="text-xs text-destructive">{delivery.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  )
}

function DeliveryStatusPill({
  status,
  responseStatus,
}: {
  status: string
  responseStatus: number | null
}) {
  if (status === "success") {
    return <StatusPill status="sent" label="Delivered" />
  }
  if (status === "failed") {
    return (
      <StatusPill
        status="failed"
        label={responseStatus ? `Failed — ${responseStatus}` : "Failed"}
      />
    )
  }
  return <StatusPill status="pending" label="Pending" />
}
