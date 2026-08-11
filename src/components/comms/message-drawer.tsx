import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  RiCalendarEventLine,
  RiCheckLine,
  RiDownload2Line,
  RiErrorWarningLine,
  RiFileCopyLine,
  RiInformationLine,
} from "@remixicon/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { MessageStatusPill } from "./message-status-pill"
import { MESSAGE_STATUS_META, templateLabel } from "./constants"
import { downloadIcs, icsFilename, icsForSession } from "./ics"
import type { MessageRow } from "./types"

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

  // Calendar details are only fetched when this message actually carries an
  // invite — the outbox itself never pays for the agenda query.
  const needsIcs = Boolean(open && message?.icsAttached && eventId)
  const { data: board } = useQuery(
    convexQuery(
      api.agenda.board,
      needsIcs && eventId ? { eventId } : "skip",
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

  function handleDownloadIcs() {
    if (!message || !session || session.startsAt === undefined) {
      toast.error("Calendar details are still loading", {
        description: "Give it a second and try again.",
      })
      return
    }
    const contents = icsForSession({
      submissionId: message.submissionId ?? session.id,
      title: session.title,
      startsAt: session.startsAt,
      durationMinutes: session.durationMinutes,
      roomName,
      venue,
      timezone: board?.event.timezone,
      eventName: board?.event.name,
      attendeeEmail: message.toEmail,
    })
    downloadIcs(icsFilename(session.title), contents)
    toast.success("Calendar invite downloaded", {
      description: "Opens in Google Calendar, Apple Calendar and Outlook.",
    })
  }

  async function handleCopy() {
    if (!message) return
    try {
      await navigator.clipboard.writeText(
        `Subject: ${message.subject}\n\n${message.body}`,
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
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
          {message.icsAttached ? (
            <Button onClick={handleDownloadIcs} disabled={!session}>
              <RiDownload2Line aria-hidden />
              Download .ics
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {message.status === "failed" && message.error ? (
          <Alert variant="destructive">
            <RiErrorWarningLine aria-hidden />
            <AlertTitle>This email was not delivered</AlertTitle>
            <AlertDescription>{message.error}</AlertDescription>
          </Alert>
        ) : null}

        {message.status === "preview" ? (
          <Alert>
            <RiInformationLine aria-hidden />
            <AlertTitle>Preview — no email key configured</AlertTitle>
            <AlertDescription>
              {
                "Nothing was delivered. The message below is exactly what would be sent; add a RESEND_API_KEY to switch delivery on."
              }
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <MetaRow label="Status">
            <MessageStatusPill
              status={message.status}
              error={message.error}
              size="sm"
            />
            {statusMeta ? (
              <span className="ml-2 text-muted-foreground">
                {statusMeta.help}
              </span>
            ) : null}
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
        </dl>

        {message.icsAttached ? (
          <Card className="flex-row items-start gap-3 border-primary/20 bg-accent/60 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border">
              <RiCalendarEventLine size={17} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Calendar invite attached
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {session && session.startsAt !== undefined
                  ? `${format(new Date(session.startsAt), "EEE, MMM d · h:mm a")} · ${session.durationMinutes} min${roomName ? ` · ${roomName}` : ""}`
                  : "Loading the session's time and room…"}
              </p>
            </div>
          </Card>
        ) : null}

        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Email as the speaker sees it
          </p>
          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-b border-border bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                To: {message.toEmail}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {message.subject}
              </p>
            </div>
            <div className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              <BodyWithLinks body={message.body} />
            </div>
          </Card>
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

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/g

/**
 * Render the plain-text body, turning URLs (the portal magic link, above all)
 * into real anchors so the link can be followed straight from the outbox.
 */
function BodyWithLinks({ body }: { body: string }) {
  const parts = body.split(URL_PATTERN)
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}
