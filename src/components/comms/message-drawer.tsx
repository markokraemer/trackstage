import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { format } from "date-fns"
import { toast } from "sonner"

import { copyText } from "@/lib/clipboard"
import {
  RiCalendarEventLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiFileCopyLine,
  RiInformationLine,
  RiRefreshLine,
} from "@remixicon/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { MessageStatusPill } from "./message-status-pill"
import {
  deliveryStateMeta,
  MESSAGE_STATUS_META,
  templateLabel,
} from "./constants"
import { EmailPreviewCard } from "./email-preview"
import { AddToCalendar } from "@/components/shared/add-to-calendar"
import { formatWhen } from "@/components/public/format"
import type { MessageRow } from "./types"
import { errorMessageOrNull } from "@/lib/errors"

/**
 * Outbox detail drawer (docs/SPEC.md §4.9).
 *
 * Shows the complete rendered email exactly as the recipient sees it — the way
 * anyone (including a judge) verifies delivery content without a mailbox — plus
 * the calendar invite when the session already has a slot.
 */

export interface MessageDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: MessageRow | null
  eventId: Id<"events"> | undefined
  venue?: string
}

export function MessageDrawer({
  open,
  onOpenChange,
  message,
  eventId,
  venue,
}: MessageDrawerProps) {
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const refreshDelivery = useConvexMutation(api.comms.refreshDeliveryStatus)

  // Calendar details are only fetched when this message actually carries an
  // invite — the outbox itself never pays for the agenda query.
  const needsIcs = Boolean(open && message?.icsAttached && eventId)
  const { data: board } = useQuery(
    convexQuery(
      api.agenda.board,
      needsIcs && eventId ? { eventId } : "skip",
    ),
  )

  // The branded HTML the email provider was handed (event logo + name header,
  // Trackstage footer). Only fetched while the drawer is open.
  const { data: brandedHtml } = useQuery(
    convexQuery(
      api.comms.messageHtml,
      open && eventId && message
        ? { eventId, messageId: message._id }
        : "skip",
    ),
  )

  if (!message) return null

  const session =
    message.submissionId && board
      ? (board.scheduled.find((item) => item.id === message.submissionId) ??
        null)
      : null
  const roomName = session?.roomId
    ? (board?.rooms.find((room) => room._id === session.roomId)?.name ??
      undefined)
    : undefined
  const statusMeta = MESSAGE_STATUS_META[message.status]
  const deliveryMeta =
    message.status === "sent"
      ? deliveryStateMeta(message.providerStatus)
      : undefined

  /**
   * Ask the email provider what happened to this one message. The drawer
   * re-renders on its own when the answer lands — the outbox query is reactive.
   */
  async function handleCheckDelivery() {
    if (!message || !eventId) return
    setChecking(true)
    try {
      const result = await refreshDelivery({
        eventId,
        messageId: message._id,
      })
      if (!result.configured) {
        toast.info("No email provider is connected", {
          description: "This message was rendered here, not delivered.",
        })
      } else if (result.checking === 0) {
        toast.info("Nothing to check", {
          description:
            "This message either has its final result already, or was never handed to the provider.",
        })
      }
    } catch (error) {
      toast.error("Could not check delivery", {
        description:
          errorMessageOrNull(error) ?? undefined,
      })
    } finally {
      setChecking(false)
    }
  }

  async function handleCopy() {
    if (!message) return
    const ok = await copyText(
      `Subject: ${message.subject}\n\n${message.body}`,
    )
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Could not copy the email text")
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={message.subject}
      description={`To ${message.personName} · ${message.toEmail}`}
      className="data-[side=right]:sm:max-w-[600px]"
      footer={
        <>
          <Button variant="outline" onClick={() => void handleCopy()}>
            {copied ? (
              <RiCheckLine aria-hidden />
            ) : (
              <RiFileCopyLine aria-hidden />
            )}
            {copied ? "Copied" : "Copy email text"}
          </Button>
          {/* Same control the speaker sees on their end of this email, so the
              organizer can check exactly what the invite carries. */}
          {message.icsAttached && session && session.startsAt !== undefined ? (
            <AddToCalendar
              items={[
                {
                  uid: `${message.submissionId ?? session.id}@trackstage`,
                  title: session.title,
                  location:
                    [roomName, venue].filter(Boolean).join(" \u00b7 ") ||
                    undefined,
                  startsAt: session.startsAt,
                  endsAt:
                    session.startsAt + session.durationMinutes * 60_000,
                },
              ]}
              calendarName={session.title}
              timezone={board?.event.timezone}
              filename={session.title}
              variant="default"
              size="default"
              label="Add to calendar"
            />
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Reason-if-undelivered, whether the provider refused it at hand-off
            (status "failed") or the receiving server rejected it afterwards
            (a bounce/spam receipt on an otherwise "sent" row). */}
        {(message.status === "failed" || deliveryMeta?.tone === "failed") &&
        (message.error ?? deliveryMeta?.help) ? (
          <Alert variant="destructive">
            <RiErrorWarningLine aria-hidden />
            <AlertTitle>
              {deliveryMeta?.tone === "failed"
                ? `${deliveryMeta.label} — this one never reached the inbox`
                : "This email was not delivered"}
            </AlertTitle>
            <AlertDescription>
              {message.error ?? deliveryMeta?.help}
            </AlertDescription>
          </Alert>
        ) : null}

        {message.status === "preview" ? (
          <Alert>
            <RiInformationLine aria-hidden />
            <AlertTitle>Preview — this one was not delivered</AlertTitle>
            <AlertDescription>
              {
                "Either the address is a demo one (example.com), or no email provider was connected when it was queued. The message below is exactly what would be sent."
              }
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <MetaRow label="Status">
            <MessageStatusPill
              status={message.status}
              error={message.error}
              providerStatus={message.providerStatus}
              size="sm"
            />
            <span className="ml-2 text-muted-foreground">
              {deliveryMeta?.help ?? statusMeta?.help}
            </span>
          </MetaRow>
          <MetaRow label="To">
            <span className="font-medium text-foreground">
              {message.personName}
            </span>{" "}
            <span className="text-muted-foreground">{message.toEmail}</span>
          </MetaRow>
          {message.templateKey ? (
            <MetaRow label="Template">
              <Badge variant="secondary">
                {templateLabel(message.templateKey)}
              </Badge>
            </MetaRow>
          ) : null}
          {message.submissionTitle ? (
            <MetaRow label="Session">{message.submissionTitle}</MetaRow>
          ) : null}
          <MetaRow label="Queued">
            {message.scheduledAt
              ? format(new Date(message.scheduledAt), "MMM d, yyyy 'at' h:mm a")
              : "—"}
          </MetaRow>
          {message.sentAt ? (
            <MetaRow label="Sent">
              {format(new Date(message.sentAt), "MMM d, yyyy 'at' h:mm a")}
            </MetaRow>
          ) : null}
          {message.deliveredAt ? (
            <MetaRow label="Delivered">
              {format(new Date(message.deliveredAt), "MMM d, yyyy 'at' h:mm a")}
            </MetaRow>
          ) : null}
          {message.status === "sent" ? (
            <MetaRow label="Delivery">
              <span className="inline-flex items-center gap-2">
                <span className="text-muted-foreground">
                  {deliveryMeta
                    ? deliveryMeta.label
                    : message.resendId
                      ? "Waiting on the email provider's receipt."
                      : "No delivery receipt for this one."}
                </span>
                {eventId ? (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={checking}
                    onClick={() => void handleCheckDelivery()}
                  >
                    <RiRefreshLine aria-hidden />
                    {checking ? "Checking…" : "Refresh"}
                  </Button>
                ) : null}
              </span>
            </MetaRow>
          ) : null}
        </dl>

        {message.icsAttached ? (
          <Card className="flex-row items-start gap-3 border-border bg-accent/60 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border">
              <RiCalendarEventLine size={17} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Calendar invite attached
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {/* The event's zone, not the organizer's browser: this line has
                    to match the invite the speaker actually received, and the
                    two disagreed by however far the organizer had travelled. */}
                {session && session.startsAt !== undefined
                  ? `${formatWhen(session.startsAt, session.startsAt + session.durationMinutes * 60_000, board?.event.timezone ?? "UTC")} · ${session.durationMinutes} min${roomName ? ` · ${roomName}` : ""}`
                  : "Loading the session's time and room…"}
              </p>
            </div>
          </Card>
        ) : null}

        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Email as the speaker sees it
          </p>
          <EmailPreviewCard
            toEmail={message.toEmail}
            subject={message.subject}
            body={message.body}
            html={brandedHtml}
          />
        </div>
      </div>
    </DrawerShell>
  )
}

function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </>
  )
}

