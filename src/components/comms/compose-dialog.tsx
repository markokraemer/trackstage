/**
 * Bulk email composer (sbek SPK-13).
 *
 * Templates cover the moments the system already knows about — accepted,
 * declined, reminder. This covers everything else a programme chair has to
 * say: the venue moved, here's your green-room time, please read the AV notes.
 *
 * Three decisions, in the order an organizer makes them: who it goes to (with
 * a live count, so nobody guesses), what it says (merge fields insert at the
 * cursor), and then send. Everything lands in the same outbox as every other
 * email, so the preview-vs-deliver rule (@example.com addresses render as
 * previews rather than bouncing) is inherited, not re-implemented.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiGroupLine, RiSendPlaneLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Mirrors `BULK_FILTERS` in convex/comms.ts. */
export const AUDIENCES = [
  {
    value: "all_speakers",
    label: "All speakers",
    help: "Everyone on any submission, plus anyone you added by hand.",
  },
  {
    value: "accepted",
    label: "Accepted speakers",
    help: "Only the people speaking at an accepted session.",
  },
  {
    value: "incomplete_tasks",
    label: "Speakers with incomplete tasks",
    help: "Anyone who still owes you something.",
  },
  {
    value: "manual",
    label: "Pick people myself",
    help: "Tick exactly who should get this.",
  },
] as const

type Audience = (typeof AUDIENCES)[number]["value"]

/** The merge fields the renderer understands (convex/lib/email.ts). */
const PLACEHOLDERS = [
  "firstName",
  "speakerName",
  "eventName",
  "sessionTitle",
  "portalLink",
] as const

export interface ComposeDialogProps {
  eventId: Id<"events"> | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Jump to the outbox once the mail is queued. */
  onSent?: () => void
}

export function ComposeDialog({
  eventId,
  open,
  onOpenChange,
  onSent,
}: ComposeDialogProps) {
  const composeBulk = useConvexMutation(api.comms.composeBulk)
  const [audience, setAudience] = React.useState<Audience>("all_speakers")
  const [picked, setPicked] = React.useState<Array<string>>([])
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    setAudience("all_speakers")
    setPicked([])
    setSubject("")
    setBody("")
  }, [open])

  const { data: roster } = useQuery(
    convexQuery(
      api.dashboard.speakersRoster,
      open && eventId ? { eventId } : "skip",
    ),
  )

  const { data: count } = useQuery(
    convexQuery(
      api.comms.recipientCount,
      open && eventId
        ? {
            eventId,
            filter: audience,
            personIds:
              audience === "manual"
                ? (picked as Array<Id<"people">>)
                : undefined,
          }
        : "skip",
    ),
  )

  const recipients = count ?? 0
  const audienceHelp = AUDIENCES.find((item) => item.value === audience)?.help

  /** Insert `{{token}}` where the cursor is, not blindly at the end. */
  function insertPlaceholder(token: string) {
    const textarea = bodyRef.current
    const snippet = `{{${token}}}`
    if (!textarea) {
      setBody((current) => `${current}${snippet}`)
      return
    }
    const start = textarea.selectionStart ?? body.length
    const end = textarea.selectionEnd ?? body.length
    const next = `${body.slice(0, start)}${snippet}${body.slice(end)}`
    setBody(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const caret = start + snippet.length
      textarea.setSelectionRange(caret, caret)
    })
  }

  function togglePerson(personId: string, checked: boolean) {
    setPicked((current) =>
      checked
        ? current.includes(personId)
          ? current
          : [...current, personId]
        : current.filter((id) => id !== personId),
    )
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!eventId) return
    if (subject.trim().length === 0 || body.trim().length === 0) {
      toast.error("Add a subject and a message")
      return
    }
    if (recipients === 0) {
      toast.error("Nobody matches this audience yet")
      return
    }
    setSending(true)
    try {
      const result = await composeBulk({
        eventId,
        filter: audience,
        subject: subject.trim(),
        body: body.trim(),
        personIds:
          audience === "manual" ? (picked as Array<Id<"people">>) : undefined,
      })
      onOpenChange(false)
      toast.success(
        `Queued ${result.queued} email${result.queued === 1 ? "" : "s"}`,
        {
          description:
            "Every one is in the outbox with its rendered subject and body.",
        },
      )
      onSent?.()
    } catch (error) {
      toast.error("Couldn't send", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose an email</DialogTitle>
          <DialogDescription>
            A one-off message to a group of speakers. Merge fields fill
            themselves in per person, exactly like your saved templates.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void send(event)}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="compose-audience">Send to</FieldLabel>
              <Select
                items={AUDIENCES.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                value={audience}
                onValueChange={(value) => setAudience(String(value) as Audience)}
              >
                <SelectTrigger id="compose-audience" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {audienceHelp ? (
                <FieldDescription>{audienceHelp}</FieldDescription>
              ) : null}
            </Field>

            {audience === "manual" ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
                {(roster ?? []).length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No speakers on this event yet.
                  </p>
                ) : (
                  (roster ?? []).map((row) => {
                    const id = String(row.personId)
                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-accent/50"
                      >
                        <Checkbox
                          checked={picked.includes(id)}
                          onCheckedChange={(value) =>
                            togglePerson(id, value === true)
                          }
                          aria-label={`Email ${row.name}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {row.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.email}
                          </span>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            ) : null}

            <p
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                recipients === 0
                  ? "border-status-amber-dot/30 bg-status-amber-bg/50 text-status-amber-fg"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <RiGroupLine size={16} aria-hidden />
              {recipients === 0
                ? "Nobody matches this audience yet."
                : `This will send ${recipients} email${recipients === 1 ? "" : "s"} — one per person.`}
            </p>

            <Field>
              <FieldLabel htmlFor="compose-subject">
                Subject<span className="required-asterisk">*</span>
              </FieldLabel>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="A quick update about your session"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="compose-body">
                Message<span className="required-asterisk">*</span>
              </FieldLabel>
              <FieldDescription>
                Click a merge field to drop it in where your cursor is.
              </FieldDescription>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((token) => (
                  <Button
                    key={token}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 font-mono text-[11px]"
                    onClick={() => insertPlaceholder(token)}
                  >
                    {`{{${token}}}`}
                  </Button>
                ))}
              </div>
              <Textarea
                id="compose-body"
                ref={bodyRef}
                rows={9}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={
                  "Hi {{firstName}},\n\nOne quick update about {{eventName}}…\n\n— The programme team"
                }
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sending || !eventId}>
              <RiSendPlaneLine aria-hidden />
              {sending
                ? "Sending…"
                : `Send to ${recipients} ${recipients === 1 ? "person" : "people"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
