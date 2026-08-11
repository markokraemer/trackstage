import { useMemo, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  RiInformationLine,
  RiMailLine,
  RiNotification3Line,
  RiRefreshLine,
} from "@remixicon/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { EmptyState } from "@/components/shared/empty-state"
import { MESSAGE_STATUS_FILTERS, templateLabel } from "./constants"
import { IcsAttachmentIcon, MessageStatusPill } from "./message-status-pill"
import type { MessageRow } from "./types"

/**
 * Outbox (docs/SPEC.md §4.9) — every email this event has queued, previewed,
 * sent or failed, newest first. Row click opens the full rendered email.
 */

export interface OutboxTableProps {
  messages: Array<MessageRow> | undefined
  loading?: boolean
  eventId: Id<"events"> | undefined
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  onOpenMessage: (message: MessageRow) => void
  /** Jump to the Templates tab (offered from the empty state). */
  onEditTemplates?: () => void
}

export function OutboxTable({
  messages,
  loading,
  eventId,
  search,
  onSearchChange,
  status,
  onStatusChange,
  onOpenMessage,
  onEditTemplates,
}: OutboxTableProps) {
  const rows = useMemo(() => {
    if (!messages) return []
    const needle = search.trim().toLowerCase()
    return messages.filter((message) => {
      if (status !== "all" && message.status !== status) return false
      if (!needle) return true
      return [
        message.personName,
        message.toEmail,
        message.subject,
        message.submissionTitle ?? "",
        message.templateKey ? templateLabel(message.templateKey) : "",
      ].some((value) => value.toLowerCase().includes(needle))
    })
  }, [messages, search, status])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const message of messages ?? []) {
      map.set(message.status, (map.get(message.status) ?? 0) + 1)
    }
    return map
  }, [messages])

  const previewMode = (counts.get("preview") ?? 0) > 0
  const filtered = search.trim().length > 0 || status !== "all"

  // Sent, but the provider has not told us yet whether it landed. Only these
  // make "Check delivery" worth showing (product-map delta #7).
  const awaitingReceipts = useMemo(
    () =>
      (messages ?? []).filter(
        (message) => message.status === "sent" && !message.providerStatus,
      ).length,
    [messages],
  )

  return (
    <div className="flex flex-col gap-4">
      <DataToolbar
        value={search}
        onValueChange={onSearchChange}
        placeholder="Search by speaker, email, or subject…"
        searchLabel="Search the outbox"
        filters={
          <Select
            value={status}
            // `items` lets the trigger render the friendly label, not the raw
            // value — Base UI resolves the selected label from this list.
            items={MESSAGE_STATUS_FILTERS}
            onValueChange={(value: unknown) => onStatusChange(String(value))}
          >
            <SelectTrigger className="w-[180px] bg-card" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESSAGE_STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {option.value === "all"
                      ? (messages?.length ?? 0)
                      : (counts.get(option.value) ?? 0)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        actions={
          <>
            {awaitingReceipts > 0 ? (
              <CheckDeliveryButton
                eventId={eventId}
                awaiting={awaitingReceipts}
              />
            ) : null}
            <RemindSpeakersButton eventId={eventId} />
          </>
        }
      />

      {previewMode ? (
        <Alert>
          <RiInformationLine aria-hidden />
          <AlertTitle>
            Preview mode — emails are rendered here, not delivered
          </AlertTitle>
          <AlertDescription>
            No email key is configured, so every message is kept in full below
            instead of being sent. Open any row to read exactly what the speaker
            would receive.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading || !messages ? (
        <Card className="gap-0 p-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </Card>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={RiMailLine}
          title="No emails yet"
          description="Every email your event sends lands here — acceptances, declines, waitlist notes and task reminders — with the full text, so you can always check what a speaker actually received."
          action={<RemindSpeakersButton eventId={eventId} />}
          secondaryAction={
            onEditTemplates ? (
              <Button variant="outline" onClick={onEditTemplates}>
                Review your templates
              </Button>
            ) : null
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RiMailLine}
          title="No emails match these filters"
          description="Try a different status, or clear the search to see the whole outbox."
          action={
            <Button
              variant="outline"
              onClick={() => {
                onSearchChange("")
                onStatusChange("all")
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <Card className="gap-0 overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[210px]">To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[170px]">Template</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[150px]">Time</TableHead>
                  <TableHead className="w-[84px] text-right">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((message) => (
                  <TableRow
                    key={message._id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open email “${message.subject}” to ${message.personName}`}
                    className="cursor-pointer"
                    onClick={() => onOpenMessage(message)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onOpenMessage(message)
                      }
                    }}
                  >
                    <TableCell className="max-w-[210px]">
                      <span className="block truncate font-medium text-foreground">
                        {message.personName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {message.toEmail}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-foreground">
                          {message.subject}
                        </span>
                        {message.icsAttached ? <IcsAttachmentIcon /> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {message.templateKey ? (
                        <Badge variant="secondary" className="max-w-full truncate">
                          {templateLabel(message.templateKey)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <MessageStatusPill
                        status={message.status}
                        error={message.error}
                        providerStatus={message.providerStatus}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <TimeCell message={message} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenMessage(message)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {filtered ? (
            <p className="text-sm text-muted-foreground">
              Showing {rows.length} of {messages.length} emails.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

function TimeCell({ message }: { message: MessageRow }) {
  const stamp = message.sentAt ?? message.scheduledAt ?? message._creationTime
  return (
    <span
      className="text-muted-foreground"
      title={format(new Date(stamp), "MMM d, yyyy 'at' h:mm a")}
    >
      {formatDistanceToNow(new Date(stamp), { addSuffix: true })}
    </span>
  )
}

/**
 * "Check delivery" (product-map delta #7) — asks the email provider what
 * happened to every sent message we don't have a receipt for yet. On demand,
 * because an organizer only asks this question when a speaker says "I never
 * got it"; the rows update themselves as the answers land.
 */
export function CheckDeliveryButton({
  eventId,
  awaiting,
}: {
  eventId: Id<"events"> | undefined
  awaiting: number
}) {
  const [running, setRunning] = useState(false)
  const refresh = useConvexMutation(api.comms.refreshDeliveryStatus)

  async function handleClick() {
    if (!eventId) return
    setRunning(true)
    try {
      const result = await refresh({ eventId })
      if (!result.configured) {
        toast.info("No email provider is connected", {
          description:
            "Messages are rendered here as previews, so there is no delivery to check.",
        })
      } else if (result.checking === 0) {
        toast.info("Nothing left to check", {
          description: "Every sent email already has a delivery result.",
        })
      } else {
        toast.success(
          `Checking ${result.checking} ${plural(result.checking, "email")}`,
          {
            description:
              "The status column updates as the provider answers — usually a second or two.",
          },
        )
      }
    } catch (error) {
      toast.error("Could not check delivery", {
        description:
          error instanceof Error ? error.message.split("\n")[0] : undefined,
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button
      variant="outline"
      disabled={!eventId || running}
      onClick={() => void handleClick()}
    >
      <RiRefreshLine aria-hidden />
      {running ? "Checking…" : `Check delivery (${awaiting})`}
    </Button>
  )
}

/**
 * "Remind incomplete speakers" (docs/SPEC.md §4.9) — one click, one confirm,
 * one plain-English result. The backend skips anyone already reminded in the
 * last 20 hours, so the button is always safe to press.
 */
export function RemindSpeakersButton({
  eventId,
}: {
  eventId: Id<"events"> | undefined
}) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const remind = useConvexMutation(api.comms.remindIncompleteSpeakers)

  async function handleConfirm() {
    if (!eventId) return
    setRunning(true)
    try {
      const result = await remind({ eventId })
      if (result.queued > 0) {
        toast.success(
          `Reminder queued for ${result.queued} ${plural(result.queued, "speaker")}`,
          {
            description:
              result.skipped > 0
                ? `${result.skipped} ${plural(result.skipped, "speaker")} were already reminded in the last 20 hours and were skipped.`
                : "Open any row in the outbox to read the exact email.",
          },
        )
      } else if (result.skipped > 0) {
        toast.info("Everyone was reminded recently", {
          description: `${result.skipped} ${plural(result.skipped, "speaker")} still have open tasks but were emailed in the last 20 hours.`,
        })
      } else {
        toast.info("Nobody to remind", {
          description: "Every speaker has completed their tasks. Nice.",
        })
      }
      setOpen(false)
    } catch (error) {
      toast.error("Could not send the reminders", {
        description:
          error instanceof Error ? error.message.split("\n")[0] : undefined,
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button disabled={!eventId} />}>
        <RiNotification3Line aria-hidden />
        Remind incomplete speakers
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Email every speaker with outstanding tasks?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Everyone who still has an incomplete task gets your “Task reminder”
            email with a link to their speaker portal. Anyone reminded in the
            last 20 hours is skipped automatically, so nobody gets nagged twice.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={running}
            onClick={() => void handleConfirm()}
          >
            {running ? "Sending…" : "Send reminders"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`
}
