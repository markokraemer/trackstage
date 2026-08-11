import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiHistoryLine,
  RiMore2Line,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiRefreshLine,
  RiSendPlaneLine,
  RiShieldKeyholeLine,
  RiWebhookLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { LabeledField } from "@/components/settings/labeled-field"
import { CopyButton } from "@/components/settings/copy-button"
import { errorMessage } from "@/components/settings/errors"
import type { WebhookDeliveriesDrawerTarget } from "@/components/settings/webhook-deliveries-drawer"
import { WebhookDeliveriesDrawer } from "@/components/settings/webhook-deliveries-drawer"

type WebhookListItem = FunctionReturnType<typeof api.webhooks.list>[number]

interface RevealedSecret {
  webhookId: Id<"webhooks">
  url: string
  secret: string
}

/** Human title for each `prefix.` group in the create dialog's checklist. */
const GROUP_LABELS: Record<string, string> = {
  submission: "Submissions",
  session: "Sessions",
  decision: "Decisions",
  agenda: "Agenda",
  speaker: "Speakers",
  file: "Files",
}

function prefixOf(type: string): string {
  return type.split(".")[0] ?? type
}

/** "session.speaker.attached" → "Speaker Attached". */
function eventLabel(type: string): string {
  const dot = type.indexOf(".")
  const rest = dot === -1 ? type : type.slice(dot + 1)
  return rest
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function groupEventTypes(types: Array<string>): Record<string, Array<string>> {
  const grouped: Record<string, Array<string>> = {}
  for (const type of types) {
    const prefix = prefixOf(type)
    grouped[prefix] ??= []
    grouped[prefix].push(type)
  }
  return grouped
}

/**
 * Webhooks — Settings → Integrations (docs/reference/api-parity.md UI census
 * row #22). Organizer-facing management for `convex/webhooks.ts`'s outbound
 * endpoints: the same create/rotate/test/delete operations the REST API
 * exposes to an API key, wired here through ordinary workspace-membership
 * auth so anyone with the app open can use them without minting a key.
 *
 * Mutations are admin-only server-side; we don't pre-hide the controls for
 * non-admins (RULES.md — surface the thrown error as a toast instead).
 */
export function WebhooksCard({ eventId }: { eventId: Id<"events"> }) {
  const { data: hooks, isPending } = useQuery(
    convexQuery(api.webhooks.list, { eventId }),
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null)
  const [deliveriesTarget, setDeliveriesTarget] =
    useState<WebhookDeliveriesDrawerTarget | null>(null)

  const hasHooks = (hooks?.length ?? 0) > 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiWebhookLine size={18} aria-hidden className="text-primary" />
          Webhooks
        </CardTitle>
        <CardDescription>
          Get a signed HTTP call the moment something changes, instead of
          polling the API.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <RiAddLine size={15} aria-hidden />
            Add endpoint
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {revealed ? (
          <RevealedSecretAlert
            revealed={revealed}
            onDismiss={() => setRevealed(null)}
          />
        ) : null}

        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !hasHooks ? (
          <EmptyState
            variant="plain"
            icon={RiWebhookLine}
            title="No webhooks yet"
            description="A webhook is a URL of yours that we call automatically whenever something happens — a submission comes in, a session gets scheduled, a decision goes out. No refreshing, no polling, it just arrives."
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <RiAddLine size={15} aria-hidden />
                Add endpoint
              </Button>
            }
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {(hooks ?? []).map((hook) => (
              <WebhookRow
                key={hook._id}
                hook={hook}
                onRotated={setRevealed}
                onViewDeliveries={() =>
                  setDeliveriesTarget({ webhookId: hook._id, url: hook.url })
                }
              />
            ))}
          </ul>
        )}
      </CardContent>

      <CreateWebhookDialog
        eventId={eventId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setRevealed}
      />

      <WebhookDeliveriesDrawer
        target={deliveriesTarget}
        open={deliveriesTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeliveriesTarget(null)
        }}
      />
    </Card>
  )
}

function RevealedSecretAlert({
  revealed,
  onDismiss,
}: {
  revealed: RevealedSecret
  onDismiss: () => void
}) {
  return (
    <Alert className="border-primary/25 bg-accent">
      <RiShieldKeyholeLine
        size={18}
        aria-hidden
        className="text-accent-foreground"
      />
      <AlertTitle>New signing secret</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span className="block truncate font-mono text-xs" title={revealed.url}>
          {revealed.url}
        </span>
        <p className="font-medium text-destructive">
          Copy this now — we only ever show it once. Every delivery is signed
          with it as{" "}
          <code className="font-mono">
            Trackstage-Signature: t=…,v1=…
          </code>
          .
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <code className="min-w-0 flex-1 leading-relaxed break-all select-all font-mono text-sm text-foreground">
            {revealed.secret}
          </code>
          <CopyButton
            value={revealed.secret}
            label="Copy secret"
            successMessage="Signing secret copied to your clipboard"
          />
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            Done — I've saved it
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function EventPills({ events }: { events: Array<string> }) {
  if (events.includes("*")) {
    return (
      <Badge variant="outline" className="w-fit">
        All events
      </Badge>
    )
  }
  const shown = events.slice(0, 3)
  const rest = events.length - shown.length
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((event) => (
        <Badge key={event} variant="outline" className="font-mono text-[11px]">
          {event}
        </Badge>
      ))}
      {rest > 0 ? <Badge variant="outline">+{rest}</Badge> : null}
    </div>
  )
}

function LastDelivery({ hook }: { hook: WebhookListItem }) {
  if (!hook.lastDeliveryAt) {
    return (
      <span className="text-xs text-muted-foreground">No deliveries yet</span>
    )
  }
  if (hook.lastError) {
    return (
      <StatusPill
        status="failed"
        label={hook.lastStatus ? `Failed — ${hook.lastStatus}` : "Failed"}
        title={hook.lastError}
      />
    )
  }
  return (
    <StatusPill
      status="sent"
      label={`Delivered ${formatDistanceToNow(hook.lastDeliveryAt, { addSuffix: true })}`}
    />
  )
}

function WebhookRow({
  hook,
  onRotated,
  onViewDeliveries,
}: {
  hook: WebhookListItem
  onRotated: (revealed: RevealedSecret) => void
  onViewDeliveries: () => void
}) {
  const [rotateOpen, setRotateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const update = useMutation({
    mutationFn: useConvexMutation(api.webhooks.update),
  })
  const remove = useMutation({
    mutationFn: useConvexMutation(api.webhooks.remove),
  })
  const rotate = useMutation({
    mutationFn: useConvexMutation(api.webhooks.rotate),
  })
  const sendTest = useMutation({
    mutationFn: useConvexMutation(api.webhooks.sendTest),
  })

  async function togglePause() {
    try {
      await update.mutateAsync({ webhookId: hook._id, enabled: !hook.enabled })
      toast.success(hook.enabled ? "Webhook paused" : "Webhook resumed")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't update that webhook."))
    }
  }

  async function handleSendTest() {
    try {
      await sendTest.mutateAsync({ webhookId: hook._id })
      toast.success(
        "Test delivery queued — open “View deliveries” to watch it settle.",
      )
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't send a test delivery."))
    }
  }

  async function confirmRotate() {
    try {
      const secret = await rotate.mutateAsync({ webhookId: hook._id })
      setRotateOpen(false)
      onRotated({ webhookId: hook._id, url: hook.url, secret })
      toast.success("Secret rotated")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't rotate that secret."))
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync({ webhookId: hook._id })
      setDeleteOpen(false)
      toast.success("Webhook deleted")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete that webhook."))
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            title={hook.url}
            className="truncate font-mono text-sm text-foreground"
          >
            {hook.url}
          </span>
          <EventPills events={hook.events} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill
            status={hook.enabled ? "active" : "closed"}
            label={hook.enabled ? "Active" : "Paused"}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`More actions for ${hook.url}`}
                />
              }
            >
              <RiMore2Line size={16} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={sendTest.isPending}
                  onClick={() => void handleSendTest()}
                >
                  <RiSendPlaneLine aria-hidden />
                  Send test
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onViewDeliveries}>
                  <RiHistoryLine aria-hidden />
                  View deliveries
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRotateOpen(true)}>
                  <RiRefreshLine aria-hidden />
                  Rotate secret
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void togglePause()}>
                  {hook.enabled ? (
                    <RiPauseCircleLine aria-hidden />
                  ) : (
                    <RiPlayCircleLine aria-hidden />
                  )}
                  {hook.enabled ? "Pause" : "Resume"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <RiDeleteBinLine aria-hidden />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {hook.description ? (
          <span className="truncate text-xs text-muted-foreground">
            {hook.description}
          </span>
        ) : (
          <span />
        )}
        <LastDelivery hook={hook} />
      </div>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate this webhook's secret?</AlertDialogTitle>
            <AlertDialogDescription>
              The old secret stops working immediately — anything still
              checking deliveries against it will start rejecting every one
              until you update it with the new secret.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rotate.isPending}
              onClick={() => void confirmRotate()}
            >
              {rotate.isPending ? "Rotating…" : "Rotate secret"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll stop calling this URL and remove its delivery history too.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {remove.isPending ? "Deleting…" : "Delete webhook"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

function CreateWebhookDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: {
  eventId: Id<"events">
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (revealed: RevealedSecret) => void
}) {
  const { data: eventTypes } = useQuery(
    convexQuery(api.webhooks.eventTypes, open ? {} : "skip"),
  )
  const create = useMutation({
    mutationFn: useConvexMutation(api.webhooks.create),
  })

  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [selected, setSelected] = useState<Array<string>>(["*"])
  const [urlError, setUrlError] = useState<string | null>(null)

  const allSelected = selected.includes("*")
  const grouped = groupEventTypes(eventTypes ?? [])

  function reset() {
    setUrl("")
    setDescription("")
    setSelected(["*"])
    setUrlError(null)
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? ["*"] : [])
  }

  function toggleEvent(type: string, checked: boolean) {
    setSelected((current) => {
      const withoutAll = current.filter((value) => value !== "*")
      return checked
        ? [...withoutAll, type]
        : withoutAll.filter((value) => value !== type)
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedUrl = url.trim()
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setUrlError("Enter a full URL starting with https://")
      return
    }
    setUrlError(null)
    try {
      const result = await create.mutateAsync({
        eventId,
        url: trimmedUrl,
        events: selected,
        description: description.trim() || undefined,
      })
      onOpenChange(false)
      reset()
      onCreated({
        webhookId: result._id,
        url: result.url,
        secret: result.secret,
      })
      toast.success("Webhook created")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create that webhook."))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add a webhook</DialogTitle>
            <DialogDescription>
              We'll send a signed JSON call to this URL every time one of the
              events you pick happens.
            </DialogDescription>
          </DialogHeader>

          <LabeledField
            label="Endpoint URL"
            htmlFor="webhook-url"
            required
            error={urlError ?? undefined}
          >
            <Input
              id="webhook-url"
              value={url}
              autoComplete="off"
              spellCheck={false}
              placeholder="https://example.com/webhooks/trackstage"
              onChange={(event) => {
                setUrl(event.target.value)
                if (urlError) setUrlError(null)
              }}
            />
          </LabeledField>

          <LabeledField
            label="Description"
            htmlFor="webhook-description"
            description="Optional — a reminder of what this endpoint is for."
          >
            <Input
              id="webhook-description"
              value={description}
              placeholder="Zapier — new submission alerts"
              onChange={(event) => setDescription(event.target.value)}
            />
          </LabeledField>

          <LabeledField
            label="Events"
            required
            description="Choose what should trigger a call, or subscribe to everything."
          >
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked)}
                />
                All events
              </label>
              <div
                className={cn(
                  "flex max-h-56 flex-col gap-4 overflow-y-auto border-t border-border pt-3",
                  allSelected && "pointer-events-none opacity-40",
                )}
              >
                {Object.entries(grouped).map(([prefix, types]) => (
                  <div key={prefix} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {GROUP_LABELS[prefix] ?? prefix}
                    </span>
                    {types.map((type) => (
                      <label
                        key={type}
                        className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                      >
                        <Checkbox
                          checked={selected.includes(type)}
                          onCheckedChange={(checked) =>
                            toggleEvent(type, checked)
                          }
                        />
                        {eventLabel(type)}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </LabeledField>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Add webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
