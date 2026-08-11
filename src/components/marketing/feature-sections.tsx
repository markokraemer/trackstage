import { Link } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiCalendarScheduleLine,
  RiGlobalLine,
  RiInboxUnarchiveLine,
  RiLayoutGridLine,
  RiMailSendLine,
  RiScalesLine,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  DISPLAY_HEADING,
  MarketingSection,
  SectionIntro,
} from "@/components/marketing/section"
import { ProductGif, ProductShot } from "@/components/marketing/product-shot"
import type { ProductShotVariant } from "@/components/marketing/product-shot"
import {
  DEMO_CFP_URL,
  DEMO_PORTAL_URL,
  DEMO_PROGRAM_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

const LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50"

interface Pillar {
  icon: RemixiconComponentType
  title: string
  description: string
}

/** The four moments of a CFP, as the header row of the showcase block. */
const PILLARS: Array<Pillar> = [
  {
    icon: RiInboxUnarchiveLine,
    title: "Collect",
    description:
      "One public form, your questions, your tracks. Submissions arrive already sorted.",
  },
  {
    icon: RiScalesLine,
    title: "Decide",
    description:
      "Evaluators score what's assigned to them. You stage accepts and declines, then send.",
  },
  {
    icon: RiCalendarScheduleLine,
    title: "Schedule",
    description:
      "Drag accepted sessions onto rooms and times. Clashes surface while you're moving them.",
  },
  {
    icon: RiMailSendLine,
    title: "Communicate",
    description:
      "Decisions, reminders and room details go out as templates, with the calendar invite attached.",
  },
]

interface FeatureRow {
  eyebrow: string
  title: string
  description: string
  icon: RemixiconComponentType
  shot: ProductShotVariant | "agendaGif"
  link: { label: string; to?: "/login"; href?: string }
}

/** The rest of the product, one row per screen — each with its real capture. */
const FEATURES: Array<FeatureRow> = [
  {
    eyebrow: "Form builder",
    title: "Build the call for speakers in an afternoon",
    description:
      "A guided six-step wizard writes your public form: your questions, your wording, your tracks. Follow-up questions appear only when they're relevant, and the Track answer routes each submission to the right place. Copy the link and you're collecting.",
    icon: RiSurveyLine,
    shot: "form",
    link: { label: "See the live form", href: DEMO_CFP_URL },
  },
  {
    eyebrow: "Agenda",
    title: "Drag a session into a room. That's the whole thing.",
    description:
      "One board, four views — list, day, rooms and conflicts. Accepted sessions wait in a tray until you place them, double-bookings are flagged as you drag, and the public schedule updates the moment you publish.",
    icon: RiCalendarScheduleLine,
    shot: "agendaGif",
    link: { label: "Open the agenda", to: "/login" },
  },
  {
    eyebrow: "Speaker portal",
    title: "Speakers keep their own details up to date",
    description:
      "Send one link — no password for them to forget. They see their talks, their profile completeness and exactly what's still outstanding, so you stop digging headshots out of email threads.",
    icon: RiUserVoiceLine,
    shot: "portal",
    link: { label: "Open the speaker portal", href: DEMO_PORTAL_URL },
  },
  {
    eyebrow: "Public program",
    title: "Your schedule, published the moment you're ready",
    description:
      "Attendees get a fast public schedule, session pages and speaker pages on your event link, plus personal itineraries and calendar files. Your website team gets an API instead of a ticket queue.",
    icon: RiGlobalLine,
    shot: "program",
    link: { label: "See a published program", href: DEMO_PROGRAM_URL },
  },
]

export function FeatureSections() {
  return (
    <MarketingSection id={SECTION_IDS.product}>
      <SectionIntro
        icon={RiLayoutGridLine}
        eyebrow="The product"
        title={
          <>
            Everything a call for speakers needs.{" "}
            <span className="text-muted-foreground/55">
              Nothing it doesn&rsquo;t.
            </span>
          </>
        }
        description="The same jobs the $40k-a-year tool does — fewer clicks, plainer words, and pages that finish loading before you've let go of the mouse."
      />

      <ShowcaseBlock />

      <div className="mt-20 space-y-20 sm:mt-28 sm:space-y-28">
        {FEATURES.map((feature, index) => (
          <FeatureRowBlock
            key={feature.eyebrow}
            feature={feature}
            flipped={index % 2 === 1}
          />
        ))}
      </div>
    </MarketingSection>
  )
}

/**
 * Attio's signature block: a bordered container whose top half explains the
 * shape of the product in four short columns, and whose bottom half is the real
 * screenshot running off the edge.
 */
function ShowcaseBlock() {
  return (
    <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card sm:mt-14">
      <div className="grid lg:grid-cols-4">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="flex flex-col gap-2 border-t border-border p-6 first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0"
          >
            <span className="flex items-center gap-2 font-heading text-[15px] font-medium text-foreground">
              <pillar.icon
                size={16}
                aria-hidden
                className="text-muted-foreground"
              />
              {pillar.title}
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-background px-4 pt-6 sm:px-8 sm:pt-10">
        <ProductShot
          variant="submissions"
          crop="top"
          className="rounded-b-none"
        />
      </div>
    </div>
  )
}

function FeatureRowBlock({
  feature,
  flipped,
}: {
  feature: FeatureRow
  flipped: boolean
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={cn(flipped && "lg:order-2")}>
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
            <feature.icon size={16} aria-hidden />
          </span>
          <p className="text-sm font-medium text-muted-foreground">
            {feature.eyebrow}
          </p>
        </div>

        <h3
          className={cn(
            DISPLAY_HEADING,
            "mt-5 text-2xl leading-[1.08] text-balance sm:text-[2rem]"
          )}
        >
          {feature.title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
          {feature.description}
        </p>

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

      <div className={cn(flipped && "lg:order-1")}>
        {feature.shot === "agendaGif" ? (
          <ProductGif
            src="/screenshots/agenda-flow.gif"
            url="app.sessionboard.dev/app/agenda"
            alt="A recording of the agenda: a session is picked up from the day grid, dragged down the Main Stage column and dropped into a new time slot."
          />
        ) : (
          <ProductShot variant={feature.shot} />
        )}
      </div>
    </div>
  )
}
