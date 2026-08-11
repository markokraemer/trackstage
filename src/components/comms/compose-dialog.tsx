/**
 * Bulk email composer (sbek SPK-13) with a per-recipient review step
 * (sbek SPK-14 / product-map delta #7).
 *
 * Templates cover the moments the system already knows about — accepted,
 * declined, reminder. This covers everything else a programme chair has to
 * say: the venue moved, here's your green-room time, please read the AV notes.
 *
 * Four decisions, in the order an organizer makes them: who it goes to (with a
 * live count, so nobody guesses), what it says (merge fields insert at the
 * cursor), *then a read-through of each person's actual email* — click a name,
 * see their copy with their own merge fields filled in, drop anyone who
 * shouldn't be on it — and only then send. The review renders through the same
 * server code that queues the mail, so what is approved is what goes out.
 *
 * Everything lands in the same outbox as every other email, so the
 * preview-vs-deliver rule (@example.com addresses render as previews rather
 * than bouncing) is inherited, not re-implemented.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiArrowLeftLine,
  RiCloseLine,
  RiEyeLine,
  RiGroupLine,
  RiSendPlaneLine,
} from "@remixicon/react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmailPreviewCard } from "./email-preview"
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

/** One recipient's rendered copy, straight from `composeBulk({ preview: true })`. */
type Preview = {
  personId: Id<"people">
  personName: string
  toEmail: string
  subject: string
  body: string
}

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
  const [step, setStep] = React.useState<"compose" | "review">("compose")
  const [previews, setPreviews] = React.useState<Array<Preview>>([])
  /** How many people the audience matched, before the 100-per-send cap. */
  const [audienceTotal, setAudienceTotal] = React.useState(0)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    setAudience("all_speakers")
    setPicked([])
    setSubject("")
    setBody("")
    setStep("compose")
    setPreviews([])
    setSelectedId(null)
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
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
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

  /** Step 1 → 2: render everyone's copy on the server, queue nothing. */
  async function review(event: React.FormEvent) {
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
        preview: true,
      })
      setPreviews(result.previews)
      setAudienceTotal(result.recipients)
      setSelectedId(
        result.previews.length > 0 ? String(result.previews[0].personId) : null,
      )
      setStep("review")
    } catch (error) {
      toast.error("Couldn't build the preview", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSending(false)
    }
  }

  /**
   * Step 2 → sent. Always addressed to the exact people left in the review
   * list, so removing someone genuinely removes them — the audience filter is
   * not re-run behind the organizer's back.
   */
  async function send() {
    if (!eventId || previews.length === 0) return
    setSending(true)
    try {
      const result = await composeBulk({
        eventId,
        filter: "manual",
        subject: subject.trim(),
        body: body.trim(),
        personIds: previews.map((preview) => preview.personId),
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

  function removeRecipient(personId: string) {
    const next = previews.filter(
      (preview) => String(preview.personId) !== personId,
    )
    setPreviews(next)
    if (selectedId === personId) {
      const fallback = next.at(0)
      setSelectedId(fallback ? String(fallback.personId) : null)
    }
  }

  const selected: Preview | null =
    previews.find((preview) => String(preview.personId) === selectedId) ??
    previews.at(0) ??
    null

  if (step === "review") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review before sending</DialogTitle>
            <DialogDescription>
              Click a name to read the exact email that person will get, with
              their own details filled in. Remove anyone who shouldn't be on
              this send.
            </DialogDescription>
          </DialogHeader>

          {previews.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
              You removed everyone. Go back to add recipients again.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {previews.length} recipient{previews.length === 1 ? "" : "s"}
                </p>
                {audienceTotal > previews.length ? (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {previews.length} of {audienceTotal}. One
                    send goes to at most {previews.length} people — send again
                    for the rest.
                  </p>
                ) : null}
                <ScrollArea className="h-[380px] rounded-lg border border-border">
                  <ul>
                    {previews.map((preview) => {
                      const id = String(preview.personId)
                      const active = selected
                        ? String(selected.personId) === id
                        : false
                      return (
                        <li
                          key={id}
                          className={cn(
                            "flex items-center gap-1 border-b border-border last:border-b-0",
                            active && "bg-accent",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(id)}
                            aria-current={active ? "true" : undefined}
                            className="min-w-0 flex-1 cursor-pointer px-3 py-2.5 text-left hover:bg-accent/60"
                          >
                            <span className="block truncate text-sm font-medium text-foreground">
                              {preview.personName || preview.toEmail}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {preview.toEmail}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="mr-1.5 shrink-0 text-muted-foreground"
                            aria-label={`Remove ${preview.personName || preview.toEmail}`}
                            onClick={() => removeRecipient(id)}
                          >
                            <RiCloseLine aria-hidden />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Email as {selected?.personName || "this person"} sees it
                </p>
                <ScrollArea className="h-[380px]">
                  {selected ? (
                    <EmailPreviewCard
                      toEmail={selected.toEmail}
                      subject={selected.subject}
                      body={selected.body}
                    />
                  ) : null}
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("compose")}
              disabled={sending}
            >
              <RiArrowLeftLine aria-hidden />
              Back to the message
            </Button>
            <Button
              type="button"
              onClick={() => void send()}
              disabled={sending || previews.length === 0}
            >
              <RiSendPlaneLine aria-hidden />
              {sending
                ? "Sending…"
                : `Send to ${previews.length} ${previews.length === 1 ? "person" : "people"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose an email</DialogTitle>
          <DialogDescription>
            A one-off message to a group of speakers. Merge fields fill
            themselves in per person, exactly like your saved templates. You'll
            read each person's email before anything is sent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void review(event)}>
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
                : `${recipients} email${recipients === 1 ? "" : "s"} — one per person. You'll read each one before it goes out.`}
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
              <RiEyeLine aria-hidden />
              {sending
                ? "Rendering…"
                : `Review ${recipients} ${recipients === 1 ? "email" : "emails"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
