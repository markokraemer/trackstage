import { RiDraftLine, RiShieldCheckLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StatusPill } from "@/components/shared/status-pill"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

/**
 * Step 2 — Account (docs/SPEC.md §4.3). Email only: `submit.identify` returns
 * the person's portal token, which is all the auth this flow ever needs. No
 * passwords, ever — the video's biggest friction point was Sessionboard
 * forcing a full password signup on a public form.
 */

export interface AccountDraft {
  id: string
  title: string
}

/**
 * The email form. It carries `onSubmit` so pressing Enter in the single input
 * advances the flow; the visible Continue button lives in the card footer with
 * every other step's primary action.
 */
const ACCOUNT_FORM_ID = "submit-account-form"

export interface AccountStepProps {
  email: string
  onEmailChange: (email: string) => void
  /** Identify the speaker; called by the footer's Continue button too. */
  onSubmit: () => void
  pending: boolean
  error: string | null
  invalid: boolean
  /** Drafts found for this email on this form — offered for resume. */
  drafts: Array<AccountDraft>
  onResume: (draftId: string) => void
  onStartNew: () => void
  resumingDraftId: string | null
}

export function AccountStep({
  email,
  onEmailChange,
  onSubmit,
  pending,
  error,
  invalid,
  drafts,
  onResume,
  onStartNew,
  resumingDraftId,
}: AccountStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Your email address
        </h1>
        <p className="text-sm text-muted-foreground">
          We use your email to save your progress, to reach you about this
          proposal, and to give you a speaker portal afterwards.
        </p>
      </div>

      <form
        id={ACCOUNT_FORM_ID}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="submit-email" className="text-foreground">
            Email address
            <span className="required-asterisk" aria-hidden>
              *
            </span>
            <span className="sr-only">(required)</span>
          </FieldLabel>
          <FieldDescription>
            Use the address you check most — decisions and speaker tasks go here.
          </FieldDescription>
          <Input
            id="submit-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            disabled={pending}
            aria-invalid={invalid || undefined}
            onChange={(event) => onEmailChange(event.target.value)}
          />
          {invalid && !error ? (
            <FieldError>Please enter a valid email address.</FieldError>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </form>

      {drafts.length > 0 ? (
        <div className="space-y-3">
          <Alert>
            <RiDraftLine aria-hidden />
            <AlertTitle>You have a saved draft</AlertTitle>
            <AlertDescription>
              Pick up where you left off, or start a new proposal.
            </AlertDescription>
          </Alert>

          {drafts.map((draft) => (
            <Card
              key={draft.id}
              size="sm"
              className="flex-row flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {draft.title || "Untitled draft"}
                </p>
                <StatusPill status="draft" size="sm" className="mt-1.5" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => onResume(draft.id)}
                disabled={resumingDraftId !== null}
              >
                {resumingDraftId === draft.id ? "Loading…" : "Resume draft"}
              </Button>
            </Card>
          ))}

          <Button
            type="button"
            variant="ghost"
            onClick={onStartNew}
            disabled={resumingDraftId !== null}
          >
            Start a new submission instead
          </Button>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <RiShieldCheckLine
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-primary"
        />
        <p>
          No password to create and nothing to remember — your submission is
          linked to this email address.
        </p>
      </div>
    </div>
  )
}
