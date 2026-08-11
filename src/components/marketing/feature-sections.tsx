import { Link } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiCalendarScheduleLine,
  RiCheckLine,
  RiGlobalLine,
  RiMailSendLine,
  RiScalesLine,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { MarketingSection, SectionIntro } from "@/components/marketing/section"
import { ProductShot } from "@/components/marketing/product-shot"
import type { ProductShotVariant } from "@/components/marketing/product-shot"
import {
  DEMO_CFP_URL,
  DEMO_PORTAL_URL,
  DEMO_PROGRAM_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

interface FeatureRow {
  eyebrow: string
  title: string
  description: string
  bullets: Array<string>
  icon: RemixiconComponentType
  shot: ProductShotVariant
  link: { label: string; to?: "/login"; href?: string }
}

/** The six jobs from the brief, in the order an organizer actually meets them. */
const FEATURES: Array<FeatureRow> = [
  {
    eyebrow: "Call for speakers",
    title: "Collect talks without a spreadsheet",
    description:
      "Build your submission form in a guided wizard — your questions, your wording, your tracks. Copy the public link and you're collecting.",
    bullets: [
      "Follow-up questions appear only when they're relevant",
      "Submissions route themselves to the right track",
      "Close dates, submission limits and a welcome screen you write",
    ],
    icon: RiSurveyLine,
    shot: "form",
    link: { label: "See the live form", href: DEMO_CFP_URL },
  },
  {
    eyebrow: "Review & decisions",
    title: "Decide as a team, then send it all at once",
    description:
      "Evaluators get their own queue and score what's assigned to them. You stage accepts and declines, look at the whole picture, and commit when you're ready.",
    bullets: [
      "Assign evaluators, score across rounds, see who's finished",
      "Accept and decline queues hold decisions before anything sends",
      "Commit the queue and the emails go out together",
    ],
    icon: RiScalesLine,
    shot: "review",
    link: { label: "Open the review queue", to: "/login" },
  },
  {
    eyebrow: "Speaker portal",
    title: "Speakers keep their own details up to date",
    description:
      "Send one link. Speakers see their talks, their profile and exactly what's still outstanding — so you stop digging attachments out of email threads.",
    bullets: [
      "One link per speaker — no password for them to forget",
      "Bio, headshot, slides and signed forms in one place",
      "You get a live list of who still owes you what",
    ],
    icon: RiUserVoiceLine,
    shot: "portal",
    link: { label: "Open the speaker portal", href: DEMO_PORTAL_URL },
  },
  {
    eyebrow: "Agenda builder",
    title: "Drag a session into a room. That's the whole thing.",
    description:
      "The schedule is one drag-and-drop board with day, week, room and list views. Clashes surface while you're moving things, not the night before.",
    bullets: [
      "Day, week, rooms and list — the same schedule, four ways",
      "Double-booked speakers and rooms flagged as you drag",
      "Publish when it's ready; keep editing after",
    ],
    icon: RiCalendarScheduleLine,
    shot: "agenda",
    link: { label: "Open the agenda", to: "/login" },
  },
  {
    eyebrow: "Communications",
    title: "Every speaker email, with the invite attached",
    description:
      "Acceptances, declines, reminders, room details — written once as templates, personalised per speaker, and sent with a calendar invite that just works.",
    bullets: [
      "Templates for every moment in the speaker journey",
      "Merge fields for name, session, time and room",
      "Calendar invites (.ics) that land in any calendar app",
    ],
    icon: RiMailSendLine,
    shot: "comms",
    link: { label: "See the templates", to: "/login" },
  },
  {
    eyebrow: "Public program",
    title: "Your schedule, published the moment you're ready",
    description:
      "Attendees get a fast public schedule and speaker pages on your event link. Your website team gets embeds and an API instead of a ticket queue.",
    bullets: [
      "Public schedule, session and speaker pages out of the box",
      "Embeddable views for your own site",
      "Read-only JSON API and an .ics feed for everything else",
    ],
    icon: RiGlobalLine,
    shot: "program",
    link: { label: "See a published program", href: DEMO_PROGRAM_URL },
  },
]

const LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50"

export function FeatureSections() {
  return (
    <MarketingSection id={SECTION_IDS.product}>
      <SectionIntro
        eyebrow="The product"
        title="Six jobs. All of them done properly."
        description="The same work the $40k-a-year tool does — fewer clicks, plainer words, and pages that load before you've finished blinking."
      />

      <div className="mt-14 space-y-20 sm:mt-16 sm:space-y-28">
        {FEATURES.map((feature, index) => {
          const flipped = index % 2 === 1

          return (
            <div
              key={feature.eyebrow}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
            >
              <div className={cn(flipped && "lg:order-2")}>
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon size={20} aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                  {feature.eyebrow}
                </p>
                <h3 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
                  {feature.title}
                </h3>
                <p className="mt-3.5 text-base leading-relaxed text-pretty text-muted-foreground">
                  {feature.description}
                </p>

                <ul className="mt-6 space-y-2.5">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5 text-sm">
                      <RiCheckLine
                        size={17}
                        aria-hidden
                        className="mt-0.5 shrink-0 text-primary"
                      />
                      <span className="leading-relaxed text-foreground">
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {feature.link.to ? (
                    <Link to={feature.link.to} className={LINK_CLASS}>
                      {feature.link.label}
                      <RiArrowRightLine size={15} aria-hidden />
                    </Link>
                  ) : (
                    <a href={feature.link.href} className={LINK_CLASS}>
                      {feature.link.label}
                      <RiArrowRightLine size={15} aria-hidden />
                    </a>
                  )}
                </div>
              </div>

              <ProductShot
                variant={feature.shot}
                className={cn(flipped && "lg:order-1")}
              />
            </div>
          )
        })}
      </div>
    </MarketingSection>
  )
}
