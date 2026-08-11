import { useEffect, useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { toast } from "sonner"
import {
  RiArrowGoBackLine,
  RiEyeLine,
  RiMailSendLine,
  RiSaveLine,
} from "@remixicon/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { defaultTemplate, renderTemplate } from "@convex/lib/email"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { TEMPLATE_META, placeholders, sampleVars, templateLabel } from "./constants"
import type { TemplateRow } from "./types"
import { errorMessage } from "@/lib/errors"

/**
 * Template editor drawer (docs/SPEC.md §4.9).
 *
 * Name, subject and body, with click-to-insert merge fields, a live preview
 * rendered through the *same* `renderTemplate` the server uses, and "Send test
 * to myself" so an organizer can see the real thing in their own inbox before
 * a single speaker gets it.
 */

export interface TemplateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: TemplateRow | null
  eventId: Id<"events"> | undefined
  eventName?: string
  /** Jump to the Outbox tab (offered in the "test sent" toast). */
  onViewOutbox?: () => void
}

export function TemplateDrawer({
  open,
  onOpenChange,
  template,
  eventId,
  eventName,
  onViewOutbox,
}: TemplateDrawerProps) {
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [focusTarget, setFocusTarget] = useState<"subject" | "body">("body")

  const upsertTemplate = useConvexMutation(api.comms.upsertTemplate)
  const sendTestToSelf = useConvexMutation(api.comms.sendTestToSelf)

  // Load the selected template into the form whenever the drawer opens on a
  // different row (or the row changes underneath us after a save).
  useEffect(() => {
    if (!template) return
    setName(templateLabel(template.key, template.name))
    setSubject(template.subject)
    setBody(template.body)
    setShowPreview(false)
  }, [template])

  if (!template) return null

  const meta = TEMPLATE_META[template.key]
  const vars = sampleVars(eventName)
  const chips = placeholders(eventName)
  const dirty =
    name !== templateLabel(template.key, template.name) ||
    subject !== template.subject ||
    body !== template.body
  const valid = Boolean(name.trim() && subject.trim() && body.trim())

  function insert(token: string) {
    const text = `{{${token}}}`
    if (focusTarget === "subject") {
      insertAtCursor(subjectRef.current, subject, setSubject, text)
    } else {
      insertAtCursor(bodyRef.current, body, setBody, text)
    }
  }

  async function handleSave() {
    if (!eventId || !template || !valid) return
    setSaving(true)
    try {
      await upsertTemplate({
        eventId,
        key: template.key,
        name: name.trim(),
        subject: subject.trim(),
        body,
      })
      toast.success("Template saved", {
        description: "New emails of this type will use your wording.",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error("Could not save the template", {
        description: messageOf(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSendTest() {
    if (!eventId || !template) return
    setSending(true)
    try {
      const result = await sendTestToSelf({
        eventId,
        key: template.key,
      })
      toast.success(`Test email sent to ${result.toEmail}`, {
        description:
          "It is rendered with real speaker details and logged in the Outbox.",
        action: onViewOutbox
          ? { label: "View Outbox", onClick: onViewOutbox }
          : undefined,
      })
    } catch (error) {
      toast.error("Could not send the test email", {
        description: messageOf(error),
      })
    } finally {
      setSending(false)
    }
  }

  function handleResetWording() {
    if (!template) return
    const fallback = defaultTemplate(template.key)
    setSubject(fallback.subject)
    setBody(fallback.body)
    toast.info("Original wording restored", {
      description: "Save to keep it, or close the drawer to discard.",
    })
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={templateLabel(template.key, template.name)}
      description={meta?.when}
      className="data-[side=right]:sm:max-w-[600px]"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => void handleSendTest()}
            disabled={sending || !eventId}
          >
            <RiMailSendLine aria-hidden />
            {sending ? "Sending…" : "Send test to myself"}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !valid || !dirty}
          >
            <RiSaveLine aria-hidden />
            {saving ? "Saving…" : "Save template"}
          </Button>
        </>
      }
    >
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="template-name">
            Template name
            <span className="required-asterisk">*</span>
          </FieldLabel>
          <FieldDescription>
            Internal only — speakers never see this.
          </FieldDescription>
          <Input
            id="template-name"
            value={name}
            aria-invalid={!name.trim() || undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-subject">
            Subject line
            <span className="required-asterisk">*</span>
          </FieldLabel>
          <Input
            id="template-subject"
            ref={subjectRef}
            value={subject}
            aria-invalid={!subject.trim() || undefined}
            onFocus={() => setFocusTarget("subject")}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-body">
            Email body
            <span className="required-asterisk">*</span>
          </FieldLabel>
          <FieldDescription>
            Plain text. Blank lines become paragraphs in the email.
          </FieldDescription>
          <Textarea
            id="template-body"
            ref={bodyRef}
            rows={16}
            value={body}
            aria-invalid={!body.trim() || undefined}
            onFocus={() => setFocusTarget("body")}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[280px] leading-relaxed"
          />
        </Field>

        <div>
          <p className="text-sm font-medium text-foreground">
            Insert a merge field
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Click one to drop it where your cursor is in the{" "}
            {focusTarget === "subject" ? "subject line" : "email body"}. Each is
            replaced with the recipient's own details when the email is sent.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Button
                key={chip.token}
                type="button"
                variant="outline"
                size="xs"
                title={`${chip.label} — e.g. ${chip.sample}`}
                onClick={() => insert(chip.token)}
              >
                <span className="font-mono">{`{{${chip.token}}}`}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowPreview((value) => !value)
              // The card renders below the fold of the drawer's scroll area —
              // without this, toggling it on looks like a no-op.
              requestAnimationFrame(() =>
                previewRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                })
              )
            }}
          >
            <RiEyeLine aria-hidden />
            {showPreview ? "Hide preview" : "Preview with sample details"}
          </Button>
          {template.isDefault ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetWording}
            >
              <RiArrowGoBackLine aria-hidden />
              Restore original wording
            </Button>
          )}
        </div>

        {showPreview ? (
          <Card ref={previewRef} className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Preview
              </p>
              <Badge variant="ghost" className="text-muted-foreground">
                Sample speaker: {vars.speakerName}
              </Badge>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {renderTemplate(subject, vars)}
              </p>
              <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {renderTemplate(body, vars)}
              </p>
            </div>
          </Card>
        ) : null}
      </FieldGroup>
    </DrawerShell>
  )
}

/** Insert `text` at the caret of an input/textarea, keeping the caret after it. */
function insertAtCursor(
  element: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  setValue: (next: string) => void,
  text: string,
): void {
  if (!element) {
    setValue(value + text)
    return
  }
  const start = element.selectionStart ?? value.length
  const end = element.selectionEnd ?? value.length
  setValue(value.slice(0, start) + text + value.slice(end))
  requestAnimationFrame(() => {
    element.focus()
    const caret = start + text.length
    element.setSelectionRange(caret, caret)
  })
}

function messageOf(error: unknown): string {
  return errorMessage(error, "Please try again.")
}
