import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import type { Id } from "@convex/_generated/dataModel"
import { api } from "@convex/_generated/api"
import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/lib/errors"

/**
 * Honest failure signal for transactional email that cannot live in the
 * speaker outbox (workspace invites, evaluator reminders, form alerts).
 * Automatic retries stay visible; an exhausted delivery gets a one-click
 * manual retry. Password reset/verification rows are deliberately absent:
 * exposing them from an organizer screen would leak account-lifecycle data.
 */
export function PlatformEmailIssues({
  eventId,
  organizationId,
  enabled = true,
  className,
}: {
  eventId?: string
  organizationId?: string
  enabled?: boolean
  className?: string
}) {
  const eventIssues = useQuery(
    convexQuery(
      api.platformEmails.eventDeliveryIssues,
      enabled && eventId
        ? { eventId: eventId as Id<"events">, limit: 20 }
        : "skip",
    ),
  )
  const workspaceIssues = useQuery(
    convexQuery(
      api.platformEmails.workspaceDeliveryIssues,
      enabled && organizationId && !eventId
        ? {
            organizationId: organizationId as Id<"organizations">,
            limit: 20,
          }
        : "skip",
    ),
  )
  const retry = useMutation({
    mutationFn: useConvexMutation(api.platformEmails.retry),
  })
  const issues = eventId ? eventIssues.data : workspaceIssues.data

  if (!issues || issues.length === 0) return null
  const failed = issues.filter((issue) => issue.status === "failed")
  const retrying = issues.length - failed.length

  return (
    <Alert variant="destructive" className={cn("items-start", className)}>
      <RiErrorWarningLine aria-hidden />
      <AlertTitle>Email delivery needs attention</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {failed.length > 0
            ? `${failed.length} email${failed.length === 1 ? " has" : "s have"} exhausted automatic retries.`
            : "Email delivery is being retried automatically."}
          {retrying > 0 && failed.length > 0
            ? ` ${retrying} more ${retrying === 1 ? "is" : "are"} retrying now.`
            : ""}
        </p>
        <ul className="space-y-2" aria-label="Email delivery issues">
          {issues.slice(0, 3).map((issue) => (
            <li
              key={issue._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/20 bg-background/70 px-3 py-2 text-foreground"
            >
              <span className="min-w-0 text-xs">
                <strong className="font-medium">{issue.toEmail}</strong>
                <span className="text-muted-foreground">
                  {` · ${emailKindLabel(issue.kind)} · ${issue.attempts} ${issue.attempts === 1 ? "attempt" : "attempts"}`}
                </span>
                {issue.lastError ? (
                  <span className="mt-0.5 block max-w-2xl truncate text-destructive">
                    {issue.lastError}
                  </span>
                ) : null}
              </span>
              {issue.status === "failed" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() =>
                    retry
                      .mutateAsync({ deliveryId: issue._id })
                      .then(() => toast.success(`Retry queued for ${issue.toEmail}`))
                      .catch((caught: unknown) =>
                        toast.error(errorMessage(caught, "Couldn't retry that email.")),
                      )
                  }
                >
                  <RiRefreshLine aria-hidden />
                  Retry
                </Button>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">
                  Retrying automatically
                </span>
              )}
            </li>
          ))}
        </ul>
        {issues.length > 3 ? (
          <p className="text-xs">And {issues.length - 3} more recent issues.</p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function emailKindLabel(kind: string): string {
  return kind
    .replace(/^submission-/, "submission ")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}
