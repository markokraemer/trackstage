import * as React from "react"
import { Link } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiLockLine,
  RiSearchEyeLine,
} from "@remixicon/react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { RichText } from "@/components/submit/rich-text"
import { SubmitShell } from "@/components/submit/submit-shell"
import { formatDeadline, formatEventDates } from "@/components/submit/form-logic"
import type { SubmitForm } from "@/components/submit/types"

/** Terminal screens for the public flow: success, closed, not found, loading. */

export interface SuccessCardProps {
  form: SubmitForm
  email: string
  /**
   * The token THIS session holds. Empty is not an error state to shout about —
   * it just means we have no proof of who is looking, so the portal door stays
   * shut and the confirmation points at their inbox instead.
   */
  portalToken: string
  /** Offer another proposal when the form allows more than one. */
  onSubmitAnother?: () => void
}

/** Seconds the auto-redirect waits, so the confirmation is actually readable. */
const AUTO_REDIRECT_SECONDS = 3

export function SuccessCard({
  form,
  email,
  portalToken,
  onSubmitAnother,
}: SuccessCardProps) {
  const portalHref = portalToken ? `/portal/t/${portalToken}` : null
  // The organizer's "take them straight to the portal" toggle
  // (`forms.settings.autoRedirectToPortal`). Counts down out loud and can be
  // cancelled — a redirect that fires with no warning reads as a bug.
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(
    form.autoRedirectToPortal && portalToken ? AUTO_REDIRECT_SECONDS : null,
  )

  React.useEffect(() => {
    if (secondsLeft === null || !portalHref) return
    if (secondsLeft <= 0) {
      window.location.href = portalHref
      return
    }
    const timer = window.setTimeout(
      () => setSecondsLeft((current) => (current === null ? null : current - 1)),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [secondsLeft, portalHref])

  return (
    <SubmitShell eventName={form.event.name} formTitle={form.externalTitle}>
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <RiCheckboxCircleFill
            size={48}
            aria-hidden
            className="text-status-green-dot"
          />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Thank you for submitting to present at our event!
          </h1>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ve saved your submission and sent a confirmation to{" "}
            <strong className="font-medium text-foreground">{email}</strong>.
            You can follow its status any time in your speaker portal — and if
            it&rsquo;s accepted, that&rsquo;s where your speaker tasks will
            appear.
          </p>
        </div>

        {form.successMessage ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-left">
            <RichText content={form.successMessage} />
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          {/* A plain link: the portal is a separate, token-authenticated
              surface, so this is a full navigation rather than a client-side
              route transition. Only ever rendered when this session actually
              holds the token — we never mint portal access from a screen. */}
          {portalHref ? (
            <a href={portalHref} className={buttonVariants({ size: "lg" })}>
              {secondsLeft !== null && secondsLeft > 0
                ? `Continue to portal — ${secondsLeft}s`
                : "Continue to portal"}
              <RiArrowRightLine aria-hidden />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your speaker portal link is in the confirmation email we just sent
              you.
            </p>
          )}

          {secondsLeft !== null ? (
            <p
              aria-live="polite"
              className="text-xs text-muted-foreground"
            >
              Taking you to your speaker portal in {Math.max(secondsLeft, 0)}{" "}
              second{secondsLeft === 1 ? "" : "s"}.{" "}
              <button
                type="button"
                onClick={() => setSecondsLeft(null)}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Stay here
              </button>
            </p>
          ) : null}

          {onSubmitAnother ? (
            <Button type="button" variant="ghost" onClick={onSubmitAnother}>
              Submit another proposal
            </Button>
          ) : null}
        </div>
      </div>
    </SubmitShell>
  )
}

export function ClosedCard({ form }: { form: SubmitForm }) {
  const dates = formatEventDates(
    form.event.startsAt,
    form.event.endsAt,
    form.event.timezone,
  )

  return (
    <SubmitShell eventName={form.event.name} formTitle={form.externalTitle}>
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <RiLockLine size={22} aria-hidden />
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            This call for speakers is closed
          </h1>
          <p className="text-sm text-muted-foreground">
            {form.closeAt
              ? `The deadline was ${formatDeadline(form.closeAt, form.event.timezone)}, so we're no longer accepting submissions.`
              : (form.closedReason ??
                "We're no longer accepting submissions for this event.")}
          </p>
        </div>

        <Card size="sm" className="gap-2 p-4 text-left">
          <p className="text-sm text-foreground">
            <span className="font-medium">{form.event.name}</span>
            {dates ? ` · ${dates}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Already submitted? Your speaker portal link is in the confirmation
            email we sent you.
          </p>
        </Card>

        {form.welcomeMessage ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-left">
            <RichText content={form.welcomeMessage} />
          </div>
        ) : null}

        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Back to Trackstage
        </Link>
      </div>
    </SubmitShell>
  )
}

export function NotFoundCard({ slug }: { slug: string }) {
  return (
    <SubmitShell>
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <RiSearchEyeLine size={22} aria-hidden />
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            We couldn&rsquo;t find that call for speakers
          </h1>
          <p className="text-sm text-muted-foreground">
            No submission form matches{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[13px]">
              {slug}
            </code>
            . The link may have changed, or the organizer may have removed the
            form. Ask them for an up-to-date link.
          </p>
        </div>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Back to Trackstage
        </Link>
      </div>
    </SubmitShell>
  )
}

/** Skeletons, never a spinner (docs/SPEC.md §2.11). */
export function SubmitSkeleton() {
  return (
    <SubmitShell tracker={<Skeleton className="h-8 w-full max-w-md" />}>
      <div className="space-y-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-9 w-36" />
      </div>
    </SubmitShell>
  )
}
