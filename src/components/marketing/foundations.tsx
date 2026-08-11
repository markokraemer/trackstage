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

/** The boring-but-important stuff, said in plain words (docs/memory/RULES.md 18f). */
const FOUNDATIONS: Array<Foundation> = [
  {
    title: "Workspaces & roles",
    description:
      "Your team and all your events in one workspace. Invite people, set who can do what, switch workspaces in a click.",
    icon: RiTeamLine,
  },
  {
    title: "Sign-in done properly",
    description:
      "Accounts, sessions, invites and password resets handled by Better Auth — not improvised on a Saturday.",
    icon: RiShieldKeyholeLine,
  },
  {
    title: "Many events, one place",
    description:
      "Run this year's summit and next year's while last year's programme stays published. Events never bleed into each other.",
    icon: RiCheckboxCircleLine,
  },
  {
    title: "Host it yourself",
    description:
      "MIT licensed. Run it on your own infrastructure and change whatever you want. Nobody can take it away or reprice it.",
    icon: RiServerLine,
  },
  {
    title: "Fast, everywhere",
    description:
      "Edge-deployed with a realtime database behind it. Decisions, drags and edits land for everyone else immediately.",
    icon: RiFlashlightLine,
  },
  {
    title: "Plain words",
    description:
      "Written for event producers, not procurement. Every screen says what it does, and the destructive ones ask first.",
    icon: RiTranslate2,
  },
]

export function Foundations() {
  return (
    <MarketingSection>
      <SectionIntro
        eyebrow="Foundations"
        title="The unglamorous parts, taken seriously"
        description="Nobody picks software for its auth stack. Everybody notices when it's missing."
      />

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FOUNDATIONS.map((item) => (
          <div
            key={item.title}
            className="border-t border-border pt-5 pl-0.5 first:border-t"
          >
            <item.icon size={18} aria-hidden className="text-muted-foreground" />
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
