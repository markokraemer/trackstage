import { Link } from "@tanstack/react-router"
import {
  RiCalendarScheduleLine,
  RiCodeSSlashLine,
  RiFileList3Line,
  RiFolder3Line,
  RiMailSendLine,
  RiSettings3Line,
  RiStarLine,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import type { EventSection } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * What every organizer sees BEFORE the first event exists.
 *
 * A workspace with zero events used to bounce every sidebar click to the
 * workspace hub (src/components/shell/legacy-redirect.tsx fell back there),
 * which made the whole app read as broken — nav that appears to do nothing,
 * and "Workspace settings" as the answer to "where are my submissions?".
 * Instead, every section now renders IN PLACE: its normal page header, one
 * sentence saying what the section is for, and the same "Create your first
 * event" flow the switcher offers (docs/memory/BUILD-LOG.md 2026-08-11).
 */

interface SectionCopy {
  icon: RemixiconComponentType
  /** The section's normal page title — the page keeps its identity. */
  title: string
  /** The one-line header description, organizer language. */
  tagline: string
  /** What this section does + why it needs an event, for the empty card. */
  body: string
  /** Optional "learn more" companion to the create CTA. */
  secondary?: { label: string; to: string }
}

const SECTION_COPY: Record<EventSection, SectionCopy> = {
  submissions: {
    icon: RiFileList3Line,
    title: "Submissions",
    tagline: "Every talk proposal, in one pipeline from draft to accepted.",
    body: "Submissions are the talk proposals speakers send in through your call-for-papers form. They live inside an event — create yours to start collecting.",
  },
  forms: {
    icon: RiSurveyLine,
    title: "Submission forms",
    tagline: "Collect talk proposals and speaker details in one place.",
    body: "A form is your call for papers: the questions speakers answer, your tracks and deadline, and a public link to share. Create your event to build one.",
    secondary: {
      label: "See how the CFP builder works",
      to: "/docs/guide/create-a-cfp-form",
    },
  },
  evaluation: {
    icon: RiStarLine,
    title: "Evaluation",
    tagline: "Score submissions with your reviewers, in rounds.",
    body: "Evaluation plans bundle reviewers, assigned submissions and rounds, so decisions are fair and fast. Create your event to set one up.",
  },
  agenda: {
    icon: RiCalendarScheduleLine,
    title: "Agenda",
    tagline: "Drag sessions into rooms and time slots — conflicts flagged as you go.",
    body: "The agenda is your event's timetable: accepted sessions placed into rooms and time slots, with clashes caught for you. Create your event to start building it.",
  },
  embeds: {
    icon: RiCodeSSlashLine,
    title: "Embeds",
    tagline: "Put your published program on your own website.",
    body: "Embeds are copy-paste snippets that show your published agenda and speaker list on your own site, always up to date. Create your event to get yours.",
  },
  speakers: {
    icon: RiUserVoiceLine,
    title: "Speakers",
    tagline: "Everyone on your program, and what they still owe you.",
    body: "The speaker roster tracks every speaker's profile, sessions and outstanding tasks in one place. Create your event to start it.",
  },
  files: {
    icon: RiFolder3Line,
    title: "Files",
    tagline: "Slides, headshots and signed forms your speakers upload.",
    body: "Files collect everything speakers upload through their portal — slides, headshots, signed forms — with review status. Create your event to start receiving them.",
  },
  communications: {
    icon: RiMailSendLine,
    title: "Communications",
    tagline: "Templated emails, reminders and calendar invites to speakers.",
    body: "Communications hold your templated emails, reminders and .ics calendar invites to speakers. Create your event to start sending.",
  },
  settings: {
    icon: RiSettings3Line,
    title: "Event settings",
    tagline: "Dates, rooms, tracks and statuses for one event.",
    body: "Settings belong to a single event — its dates, timezone, rooms, tracks and statuses. Create your first event to configure it.",
  },
}

/**
 * A section of the organizer app, rendered in the shell with no event yet:
 * normal header, what-this-is sentence, and the create-event flow. The dialog
 * itself navigates to the new event's dashboard on success, so every one of
 * these CTAs ends in the same place.
 */
export function EmptyEventState({ section }: { section: EventSection }) {
  const copy = SECTION_COPY[section]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={copy.title} description={copy.tagline} />
      <EmptyState
        icon={copy.icon}
        title="Create your first event"
        description={copy.body}
        action={<NewEventDialog label="Create your first event" />}
        secondaryAction={
          copy.secondary ? (
            <Link
              to={copy.secondary.to}
              className={buttonVariants({ variant: "outline" })}
            >
              {copy.secondary.label}
            </Link>
          ) : undefined
        }
      />
    </div>
  )
}

/**
 * The dashboard's first-run experience — the richest of the empty states,
 * because it is where a brand-new account lands. A calm welcome, the create
 * CTA, and the three steps that ARE the product, in order.
 */
export function FirstRunDashboard() {
  const { workspace } = useCurrentEvent()

  // The guided first-run flow is the FULL-SCREEN takeover at the shell level
  // (src/components/onboarding/onboarding-takeover.tsx); by the time this
  // hero renders, the person has finished or skipped it.
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={workspace ? `Welcome to ${workspace.name}` : "Welcome"}
        description="Trackstage runs your call for speakers end to end — collect proposals, decide together, build the agenda."
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-8 px-6 py-12 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
              <RiCalendarScheduleLine size={20} aria-hidden />
            </div>
            <p className="font-heading text-base font-semibold text-foreground">
              Create your first event
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              An event is one conference, summit or meetup. It holds your
              call for papers, submissions, speakers and agenda — everything
              starts there.
            </p>
            <div className="mt-4">
              <NewEventDialog label="Create your first event" />
            </div>
          </div>

          <ol className="grid w-full max-w-2xl gap-4 text-left sm:grid-cols-3">
            <FirstRunStep
              number={1}
              title="Create your event"
              detail="Name, public web address and timezone — under two minutes."
            />
            <FirstRunStep
              number={2}
              title="Build your CFP form"
              detail="Pick the questions speakers answer and set your deadline."
            />
            <FirstRunStep
              number={3}
              title="Share the public link"
              detail="Proposals arrive here, ready to review and schedule."
            />
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

function FirstRunStep({
  number,
  title,
  detail,
}: {
  number: number
  title: string
  detail: string
}) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4">
      <span
        aria-hidden
        className="mb-1 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      >
        {number}
      </span>
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">
        {detail}
      </span>
    </li>
  )
}
