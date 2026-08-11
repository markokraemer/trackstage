import {
  RiCalendarScheduleLine,
  RiDashboardLine,
  RiMailSendLine,
  RiScalesLine,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { MarketingSection, SectionIntro } from "@/components/marketing/section"

interface Feature {
  title: string
  description: string
  icon: RemixiconComponentType
}

/** The six core requirements from the brief, in plain English. */
const FEATURES: Array<Feature> = [
  {
    title: "Call-for-speakers forms",
    description:
      "Build your submission form in a guided wizard: your own questions, conditional logic, and track-based routing — then copy the public link.",
    icon: RiSurveyLine,
  },
  {
    title: "Self-service speaker portal",
    description:
      "Speakers keep their own bio, headshot, slides and supporting files up to date. You stop chasing attachments over email.",
    icon: RiUserVoiceLine,
  },
  {
    title: "Templated speaker comms",
    description:
      "Templated emails and reminders, with calendar invites (.ics) that land straight in each speaker's own calendar.",
    icon: RiMailSendLine,
  },
  {
    title: "Review & scoring",
    description:
      "Assign evaluators, score across multiple rounds, and move submissions through accept and decline queues before anything is sent.",
    icon: RiScalesLine,
  },
  {
    title: "Drag-and-drop agenda",
    description:
      "Build the schedule by dragging sessions into rooms and slots. Room, speaker and track clashes are flagged automatically.",
    icon: RiCalendarScheduleLine,
  },
  {
    title: "Outstanding-tasks dashboard",
    description:
      "A live view of exactly which speakers still owe you a bio, a headshot or a signed form — updated the moment they submit.",
    icon: RiDashboardLine,
  },
]

export function FeatureGrid() {
  return (
    <MarketingSection id="features">
      <SectionIntro
        eyebrow="Everything you actually need"
        title="Six things a program manager does. All of them, done well."
        description="The same jobs the $40k/year tool does — minus the clutter, the sluggishness and the annual invoice."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="h-full gap-2.5 px-5 py-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <feature.icon size={18} aria-hidden />
            </span>
            <h3 className="font-heading text-base font-medium text-foreground">
              {feature.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </MarketingSection>
  )
}
