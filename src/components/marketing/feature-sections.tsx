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

import { DEMO_MODE } from "@/lib/demo-mode"
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

/**
 * The four jobs, as the header row of the showcase block. Each title names the
 * job in plain words and each line says what actually happens — no metaphors
 * (copy pass, 2026-08-12).
 */
const PILLARS: Array<Pillar> = [
  {
    icon: RiInboxUnarchiveLine,
    title: "Collect proposals",
    description:
      "One public form. Every talk that comes in lands in one list, sorted by track.",
  },
  {
    icon: RiScalesLine,
    title: "Review and decide",
    description:
      "Your reviewers score the talks. You accept or decline, then send the news.",
  },
  {
    icon: RiCalendarScheduleLine,
    title: "Build the agenda",
    description:
      "Drag each talk into a room and a time. Double-bookings are flagged for you.",
  },
  {
    icon: RiMailSendLine,
    title: "Email your speakers",
    description:
      "Ready-made emails send themselves, with the calendar invite attached.",
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

/**
 * The rest of the product, one row per screen — each with its real capture.
 * One line of copy per row, deliberately: the screenshot beside it is doing the
 * explaining (trim pass, 2026-08-11).
 */
const FEATURES: Array<FeatureRow> = [
  {
    eyebrow: "Form builder",
    title: "Collect proposals with a form you build yourself",
    description:
      "A step-by-step wizard writes your public submission form: your questions, your tracks, your deadline. Nothing to code, and you can change it after it's live.",
    icon: RiSurveyLine,
    shot: "form",
    link: { label: "See the live form", href: DEMO_CFP_URL },
  },
  {
    eyebrow: "Agenda",
    title: "Build the agenda by dragging talks into place",
    description:
      "See the whole program by day, by room, or by conflict. Double-book a room or a speaker and it tells you the moment you drop the talk.",
    icon: RiCalendarScheduleLine,
    shot: "agendaGif",
    link: { label: "Open the agenda", to: "/login" },
  },
  {
    eyebrow: "Speaker portal",
    title: "Every speaker gets their own portal",
    description:
      "One link, no password. Speakers see their talks, keep their bio and photo up to date, and work through a checklist of what you still need from them.",
    icon: RiUserVoiceLine,
    shot: "portal",
    link: { label: "Open the speaker portal", href: DEMO_PORTAL_URL },
  },
  {
    eyebrow: "Public program",
    title: "Publish the schedule when you're ready",
    description:
      "A public program with a page for every talk and every speaker, a personal itinerary for each attendee, and calendar files that just work.",
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
            From first proposal to final schedule.{" "}
            <span className="text-muted-foreground">
              All in one place.
            </span>
          </>
        }
        description="Four jobs, one tool: collect the proposals, review and decide, build the agenda, and keep your speakers informed."
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

        {/* href links point into the seeded demo world — demo builds only.
            The /login link works on any deployment and always renders. */}
        {feature.link.to ? (
          <div className="mt-6">
            <Link to={feature.link.to} className={LINK_CLASS}>
              {feature.link.label}
              <RiArrowRightLine size={15} aria-hidden />
            </Link>
          </div>
        ) : DEMO_MODE ? (
          <div className="mt-6">
            <a href={feature.link.href} className={LINK_CLASS}>
              {feature.link.label}
              <RiArrowRightLine size={15} aria-hidden />
            </a>
          </div>
        ) : null}
      </div>

      <div className={cn(flipped && "lg:order-1")}>
        {feature.shot === "agendaGif" ? (
          <ProductGif
            src="/screenshots/agenda-flow.gif"
            url="trackstage.app/app/agenda"
            alt="A recording of the agenda: a session is picked up from the day grid, dragged down the Main Stage column and dropped into a new time slot."
          />
        ) : (
          <ProductShot variant={feature.shot} />
        )}
      </div>
    </div>
  )
}
