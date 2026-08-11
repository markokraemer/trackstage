/**
 * Publish / go live (sbek AIA-07).
 *
 * Until an organizer presses this, everything on the agenda is a draft: the
 * public event page shows "Schedule coming soon" and no session times leak,
 * however many are accepted. Publishing is one reversible flag
 * (`events.agendaPublishedAt`) — the confirm dialog says exactly what changes,
 * and the published state carries the date plus a way back.
 */

import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiCheckLine, RiEyeOffLine, RiRocketLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusPill } from "@/components/shared/status-pill"

export interface PublishAgendaButtonProps {
  eventId: Id<"events">
  eventSlug: string
  /** `events.agendaPublishedAt`, or null while the programme is a draft. */
  agendaPublishedAt: number | null
  /** How many sessions already have a time — shown in the confirmation. */
  scheduledCount: number
}

function formatPublishedDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function PublishAgendaButton({
  eventId,
  eventSlug,
  agendaPublishedAt,
  scheduledCount,
}: PublishAgendaButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const navigate = useNavigate()
  const publish = useConvexMutation(api.agenda.publishAgenda)
  const unpublish = useConvexMutation(api.agenda.unpublishAgenda)
  const published = agendaPublishedAt !== null

  async function run() {
    setPending(true)
    try {
      if (published) {
        await unpublish({ eventId })
        toast.success("Schedule unpublished", {
          description:
            "Your public event page now says the schedule is coming soon.",
        })
      } else {
        const result = await publish({ eventId })
        // Publishing is only half the job — the next thing an organizer wants
        // is this agenda on their own website. Say so, and hand them the door.
        toast.success("Schedule published", {
          description: `${result.sessionCount} session${result.sessionCount === 1 ? " is" : "s are"} now live at /e/${eventSlug}. Put it on your own site from Embeds.`,
          action: {
            label: "Get embed code",
            onClick: () => {
              void navigate({ to: "/app/embeds" })
            },
          },
        })
      }
      setOpen(false)
    } catch (error) {
      toast.error(
        published ? "Couldn't unpublish" : "Couldn't publish the schedule",
        {
          description:
            error instanceof Error ? error.message : "Please try again.",
        },
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {published ? (
        <div className="flex items-center gap-2">
          <StatusPill
            status="complete"
            variant="pill"
            label={`Published · ${formatPublishedDate(agendaPublishedAt)}`}
          />
          <Button variant="outline" onClick={() => setOpen(true)}>
            <RiEyeOffLine aria-hidden />
            Unpublish
          </Button>
        </div>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <RiRocketLine aria-hidden />
          Publish agenda
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {published ? "Unpublish the schedule?" : "Publish the agenda?"}
            </DialogTitle>
            <DialogDescription>
              {published
                ? "Your public event page will go back to “Schedule coming soon”. Nothing is deleted — every session keeps its room and time, and you can publish again at any point."
                : "Makes the schedule visible on your public event page."}
            </DialogDescription>
          </DialogHeader>

          {published ? null : (
            <ul className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <RiCheckLine
                  size={16}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-status-green-dot"
                />
                <span>
                  <span className="font-medium text-foreground">
                    {scheduledCount} scheduled session
                    {scheduledCount === 1 ? "" : "s"}
                  </span>{" "}
                  appear on{" "}
                  <code className="rounded bg-card px-1 py-0.5 text-xs">
                    /e/{eventSlug}
                  </code>
                  , in your embeds, and in the calendar feed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <RiCheckLine
                  size={16}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-status-green-dot"
                />
                <span>
                  Later changes go out live — you never have to publish twice.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <RiCheckLine
                  size={16}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-status-green-dot"
                />
                <span>Reversible: you can unpublish whenever you like.</span>
              </li>
            </ul>
          )}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancel
            </DialogClose>
            <Button onClick={() => void run()} disabled={pending}>
              {published ? (
                <>
                  <RiEyeOffLine aria-hidden />
                  {pending ? "Unpublishing…" : "Unpublish schedule"}
                </>
              ) : (
                <>
                  <RiRocketLine aria-hidden />
                  {pending ? "Publishing…" : "Publish agenda"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
