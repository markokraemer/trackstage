import { Link } from "@tanstack/react-router"
import {
  RiCalendarCheckLine,
  RiCodeSSlashLine,
  RiPlugLine,
  RiRobot2Line,
  RiTerminalBoxLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { MarketingSection, SectionIntro } from "@/components/marketing/section"
import {
  MCP_ENDPOINT_PATH,
  MCP_TOOL_COUNT,
  PRODUCT_NAME,
  PUBLIC_API_PREFIX,
  PUBLIC_ICS_PATH,
  SECTION_IDS,
} from "@/components/marketing/links"

interface Surface {
  icon: RemixiconComponentType
  title: string
  description: string
  meta: string
}

/**
 * Three ways out of the app — all of them real, all of them documented. One
 * tight row is the whole section now (trim pass, 2026-08-11): the copilot
 * prompt-chip panel repeated what the MCP cell already says.
 */
const SURFACES: Array<Surface> = [
  {
    icon: RiCodeSSlashLine,
    title: "Read API",
    description: "Sessions, speakers and submissions as paginated JSON.",
    meta: `GET ${PUBLIC_API_PREFIX}/sessions`,
  },
  {
    icon: RiCalendarCheckLine,
    title: "Calendar feed",
    description: "The whole programme as .ics. No key needed.",
    meta: `GET ${PUBLIC_ICS_PATH}`,
  },
  {
    icon: RiRobot2Line,
    title: "MCP server",
    description: `${MCP_TOOL_COUNT} tools over OAuth. Anything that changes data asks first.`,
    meta: `POST ${MCP_ENDPOINT_PATH}`,
  },
]

export function PlatformSection() {
  return (
    <MarketingSection id={SECTION_IDS.platform} tone="muted">
      <SectionIntro
        icon={RiPlugLine}
        eyebrow="Developers & agents"
        title={
          <>
            Your event, addressable.{" "}
            <span className="text-muted-foreground/55">
              By your site, your scripts, and your agent.
            </span>
          </>
        }
        description={`Point your website at the API, subscribe to the calendar feed, or connect Claude, ChatGPT and Codex straight to ${PRODUCT_NAME}.`}
      />

      <div className="mt-12 grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-3">
        {SURFACES.map((surface) => (
          <div
            key={surface.title}
            className="flex flex-col gap-2 border-t border-border p-6 first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0"
          >
            <span className="flex items-center gap-2 font-heading text-[15px] font-medium text-foreground">
              <surface.icon
                size={16}
                aria-hidden
                className="text-muted-foreground"
              />
              {surface.title}
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {surface.description}
            </p>
            {/* `mt-auto`: the endpoints line up across the row even when one
                description wraps to two lines. */}
            <code className="mt-auto block overflow-x-auto rounded-md bg-muted px-2.5 py-1.5 pt-1.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
              {surface.meta}
            </code>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <Link to="/docs" className={buttonVariants({ variant: "outline" })}>
          <RiTerminalBoxLine aria-hidden />
          Read the docs
        </Link>
      </div>
    </MarketingSection>
  )
}
