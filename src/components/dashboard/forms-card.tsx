import { Link } from "@tanstack/react-router"
import { RiExternalLinkLine, RiSurveyLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { StatusPill } from "@/components/shared/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { CopyLinkButton } from "@/components/dashboard/copy-link-button"
import { APP_ROUTES, formLinkFor } from "@/components/dashboard/app-routes"
import { formPath } from "@/lib/public-links"
import { closesLabel } from "@/components/dashboard/format"

export interface DashboardFormRow {
  formId: string
  name: string
  externalTitle?: string
  slug: string
  kind: string
  status: string
  closeAt?: number
  submissionCount: number
}

export interface FormsCardProps {
  forms: Array<DashboardFormRow>
  /** The event in context — the first segment of every public form link. */
  eventSlug: string
  className?: string
}

/**
 * "Your forms" (docs/ux/05 image19): every call-for-papers form with its
 * status, how many submissions it has pulled in, and — front and centre — the
 * public link, ready to copy.
 */
export function FormsCard({ forms, eventSlug, className }: FormsCardProps) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle>Your forms</CardTitle>
        <CardDescription>
          Share these links to collect submissions.
        </CardDescription>
        <CardAction>
          <Link
            to={APP_ROUTES.forms}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Manage forms
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent>
        {forms.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiSurveyLine}
            title="No submission form yet"
            description="A form is the page speakers fill in to propose a talk. Build one and share its public link to start collecting submissions."
            className="py-10"
            action={
              <Link to={APP_ROUTES.forms} className={buttonVariants()}>
                Create a form
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {forms.map((form) => (
              <div
                key={form.formId}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">
                    {form.name}
                  </p>
                  <StatusPill status={form.status} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.submissionCount === 0
                    ? "No submissions yet"
                    : `${form.submissionCount} submission${form.submissionCount === 1 ? "" : "s"}`}
                  {closesLabel(form.closeAt)
                    ? ` · ${closesLabel(form.closeAt)}`
                    : ""}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <CopyLinkButton
                    url={formLinkFor(eventSlug, form.slug)}
                    label="Copy link"
                    toastMessage={`Public link for "${form.name}" copied`}
                  />
                  <a
                    href={formPath(eventSlug, form.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    <RiExternalLinkLine aria-hidden />
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function FormsCardSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-5 w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[132px] rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
