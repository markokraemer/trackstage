import {
  RiCheckboxCircleLine,
  RiFlashlightLine,
  RiServerLine,
  RiShieldKeyholeLine,
  RiTeamLine,
  RiTranslate2,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { MarketingSection, SectionIntro } from "@/components/marketing/section"

interface Foundation {
  title: string
  description: string
  icon: RemixiconComponentType
}

/**
 * The boring-but-important stuff, said in plain words (docs/memory/RULES.md
 * 18f) — a title and at most six words each (trim pass, 2026-08-11).
 */
const FOUNDATIONS: Array<Foundation> = [
  {
    title: "Workspaces & roles",
    description: "Your team, your events, one workspace.",
    icon: RiTeamLine,
  },
  {
    title: "Sign-in done properly",
    description: "Better Auth accounts, invites and resets.",
    icon: RiShieldKeyholeLine,
  },
  {
    title: "Many events, one place",
    description: "Last year's, this year's, next year's.",
    icon: RiCheckboxCircleLine,
  },
  {
    title: "Host it yourself",
    description: "MIT licensed. Your servers, your rules.",
    icon: RiServerLine,
  },
  {
    title: "Fast, everywhere",
    description: "Edge-deployed, realtime, instant for everyone.",
    icon: RiFlashlightLine,
  },
  {
    title: "Plain words",
    description: "Written for producers, not procurement.",
    icon: RiTranslate2,
  },
]

export function Foundations() {
  return (
    <MarketingSection>
      <SectionIntro
        eyebrow="Foundations"
        title="The unglamorous parts, taken seriously"
      />

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FOUNDATIONS.map((item) => (
          <div
            key={item.title}
            className="border-t border-border pt-5 pl-0.5 first:border-t"
          >
            <item.icon
              size={18}
              aria-hidden
              className="text-muted-foreground"
            />
            <h3 className="mt-3 font-heading text-base font-medium text-foreground">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </MarketingSection>
  )
}
