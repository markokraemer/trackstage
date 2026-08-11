import { useEffect, useRef, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Doc, Id } from "@convex/_generated/dataModel"
import {
  RiArrowLeftLine,
  RiChatSmile2Line,
  RiCheckLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiNotification3Line,
  RiSaveLine,
  RiSettings3Line,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { WizardShell } from "@/components/shared/wizard-shell"
import type { WizardStep } from "@/components/shared/wizard-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentEvent } from "@/lib/current-event"
import { CopyLinkButton } from "@/components/forms-builder/copy-link-button"
import { publicFormPath } from "@/components/forms-builder/model"
import { useFormDraft } from "@/components/forms-builder/use-form-draft"
import type { SaveState } from "@/components/forms-builder/use-form-draft"
import { SetupStep } from "@/components/forms-builder/steps/setup-step"
import { WelcomeStep } from "@/components/forms-builder/steps/welcome-step"
import { QuestionsStep } from "@/components/forms-builder/steps/questions-step"
import { ParticipantsStep } from "@/components/forms-builder/steps/participants-step"
import { SettingsStep } from "@/components/forms-builder/steps/settings-step"
import { NotificationsStep } from "@/components/forms-builder/steps/notifications-step"

export const Route = createFileRoute("/app/forms/$formId")({
  component: FormEditorPage,
})

const STEPS: Array<WizardStep> = [
  {
    id: "setup",
    title: "Setup",
    description: "What this form collects",
    icon: RiSurveyLine,
  },
  {
    id: "welcome",
    title: "Welcome screen",
    description: "The first page people see",
    icon: RiChatSmile2Line,
  },
  {
    id: "questions",
    title: "Submission questions",
    description: "What you ask about each talk",
    icon: RiFileList3Line,
  },
  {
    id: "participants",
    title: "Participants",
    description: "Speakers and their details",
    icon: RiUserVoiceLine,
  },
  {
    id: "settings",
    title: "Form settings",
    description: "Deadline, limits, thank-you page",
    icon: RiSettings3Line,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Who gets emailed",
    icon: RiNotification3Line,
  },
]

function FormEditorPage() {
  const { formId } = Route.useParams()
  const { event } = useCurrentEvent()

  const { data: form, isError } = useQuery(
    convexQuery(api.forms.get, { formId: formId as Id<"forms"> }),
  )
  const { data: roomsTracks } = useQuery(
    convexQuery(api.roomsTracks.list, event ? { eventId: event._id } : "skip"),
  )

  if (isError) {
    return (
      <EmptyState
        icon={RiErrorWarningLine}
        title="We couldn't open that form"
        description="It may have been deleted, or it belongs to another event."
        action={
          <Link to="/app/forms" className={buttonVariants()}>
            Back to forms
          </Link>
        }
      />
    )
  }

  if (!form) return <EditorSkeleton />

  return (
    <FormEditor
      key={form._id}
      form={form}
      trackNames={(roomsTracks?.tracks ?? []).map((track) => track.name)}
      timezone={event?.timezone}
    />
  )
}

function FormEditor({
  form,
  trackNames,
  timezone,
}: {
  form: Doc<"forms">
  trackNames: Array<string>
  timezone?: string
}) {
  const { draft, patch, update, save, saveState } = useFormDraft(form)
  const [stepId, setStepId] = useState("setup")

  // Leaving the editor flushes anything the debounce hasn't written yet.
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => () => void saveRef.current(), [])

  const index = STEPS.findIndex((step) => step.id === stepId)

  async function goTo(nextStepId: string) {
    await save()
    setStepId(nextStepId)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/app/forms"
        className={buttonVariants({ variant: "ghost", size: "sm" }) + " w-fit"}
      >
        <RiArrowLeftLine aria-hidden />
        Back to forms
      </Link>

      <WizardShell
        railTitle="Form setup"
        steps={STEPS}
        currentStepId={stepId}
        completedStepIds={STEPS.filter((step) => step.id !== stepId).map(
          (step) => step.id,
        )}
        onStepSelect={(next) => void goTo(next)}
        title={draft.internalName || "Untitled form"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={draft.status} size="sm" />
            <span className="text-muted-foreground">
              {publicFormPath(form.slug)}
            </span>
          </span>
        }
        actions={
          <>
            <Button nativeButton={false}
              variant="outline"
              render={
                <a
                  href={publicFormPath(form.slug)}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <RiExternalLinkLine aria-hidden />
              View form
            </Button>
            <CopyLinkButton slug={form.slug} label="Copy link" />
            <Button
              onClick={() =>
                void save().then((ok) => {
                  if (ok) toast.success("Form saved.")
                })
              }
              disabled={saveState === "saving"}
            >
              <RiSaveLine aria-hidden />
              {saveState === "saving" ? "Saving…" : "Save"}
            </Button>
          </>
        }
        onBack={index > 0 ? () => void goTo(STEPS[index - 1].id) : undefined}
        onNext={
          index < STEPS.length - 1
            ? () => void goTo(STEPS[index + 1].id)
            : undefined
        }
        onSave={() =>
          void save().then((ok) => {
            if (ok) toast.success("Form saved. Share the link and you're live.")
          })
        }
        saving={saveState === "saving"}
        saveLabel="Save form"
        footerLeft={<SaveIndicator state={saveState} />}
      >
        {stepId === "setup" ? (
          <SetupStep draft={draft} slug={form.slug} patch={patch} />
        ) : null}
        {stepId === "welcome" ? (
          <WelcomeStep draft={draft} patch={patch} />
        ) : null}
        {stepId === "questions" ? (
          <QuestionsStep draft={draft} update={update} trackNames={trackNames} />
        ) : null}
        {stepId === "participants" ? (
          <ParticipantsStep draft={draft} update={update} />
        ) : null}
        {stepId === "settings" ? (
          <SettingsStep
            draft={draft}
            patch={patch}
            update={update}
            timezone={timezone}
          />
        ) : null}
        {stepId === "notifications" ? (
          <NotificationsStep draft={draft} patch={patch} update={update} />
        ) : null}
      </WizardShell>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span>Saving…</span>
  if (state === "unsaved") return <span>Unsaved changes</span>
  if (state === "error")
    return (
      <span className="flex items-center gap-1.5 text-destructive">
        <RiErrorWarningLine size={14} aria-hidden />
        Not saved — check the message above
      </span>
    )
  return (
    <span className="flex items-center gap-1.5">
      <RiCheckLine size={14} aria-hidden className="text-status-green-fg" />
      All changes saved
    </span>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex shrink-0 flex-col gap-2 lg:w-64">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
      <Card className="min-w-0 flex-1 gap-4 p-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    </div>
  )
}
