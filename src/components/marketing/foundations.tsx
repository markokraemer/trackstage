import {
  RiCodeSSlashLine,
  RiFlashlightLine,
  RiServerLine,
  RiShieldKeyholeLine,
  RiTeamLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Card } from "@/components/ui/card"
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
      "Your team and your events in one workspace. Invite people, set who can do what, switch workspaces in a click.",
    icon: RiTeamLine,
  },
  {
    title: "Sign-in done properly",
    description:
      "Accounts, sessions, invites and password resets handled by Better Auth — not improvised on a Saturday.",
    icon: RiShieldKeyholeLine,
  },
  {
    title: "An open API",
    description:
      "Sessions and speakers as JSON, plus an .ics feed. Wire it into your site, your app, your Airtable.",
    icon: RiCodeSSlashLine,
  },
  {
    title: "Host it yourself",
    description:
      "MIT licensed. Run it on your own infrastructure and change whatever you want. Nobody can take it away.",
    icon: RiServerLine,
  },
  {
    title: "Fast, everywhere",
    description:
      "Edge-deployed with a realtime database behind it, so the app keeps up with you — not the other way round.",
    icon: RiFlashlightLine,
  },
]

export function Foundations() {
  return (
    <MarketingSection tone="muted">
      <SectionIntro
        eyebrow="Solid foundations"
        title="The unglamorous parts, taken seriously"
        description="Nobody buys software for its auth stack. You do notice when it's missing."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {FOUNDATIONS.map((item) => (
          <Card key={item.title} className="h-full gap-2.5 px-5 py-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <item.icon size={18} aria-hidden />
            </span>
            <h3 className="font-heading text-base font-medium text-foreground">
              {item.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </Card>
        ))}
      </div>
    </MarketingSection>
  )
}
