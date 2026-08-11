import {
  RiCalendarCheckLine,
  RiCodeSSlashLine,
  RiKey2Line,
  RiPlugLine,
  RiRobot2Line,
  RiTerminalBoxLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MarketingSection, SectionIntro } from "@/components/marketing/section"
import {
  EXTERNAL_LINK_PROPS,
  GITHUB_README_URL,
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

/** Three ways out of the app — all of them real, all of them documented. */
const SURFACES: Array<Surface> = [
  {
    icon: RiCodeSSlashLine,
    title: "Read API",
    description:
      "Sessions, speakers and submissions as paginated JSON. Point your event site at it instead of pasting a schedule into HTML.",
    meta: `GET ${PUBLIC_API_PREFIX}/sessions`,
  },
  {
    icon: RiCalendarCheckLine,
    title: "Calendar feed",
    description:
      "The whole programme as .ics — subscribed once and correct forever. No key needed, and every decision email carries the invite too.",
    meta: `GET ${PUBLIC_ICS_PATH}`,
  },
  {
    icon: RiKey2Line,
    title: "Keys, not scraping",
    description:
      "Workspace-scoped API keys and OAuth for agents. Nothing here needs a browser session or a support ticket.",
    meta: "Authorization: Bearer sk_…",
  },
]

/**
 * The prompts our MCP tools actually cover — copy of the real tool surface in
 * `convex/mcp.ts`, written as an organizer would say them. Rendered as static
 * chips: this is a picture of the copilot, not a fake chat you can talk to.
 */
const COPILOT_PROMPTS = [
  "Who still owes me a headshot?",
  "Accept the top three AI Engineering talks",
  "Move the keynote to Main Stage at 9am",
  "Send reminders to everyone with an open task",
  "What's clashing on Tuesday?",
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
        description="Everything the app can read, something else can read too — over a documented HTTP API, over calendar feeds, or over MCP."
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
            <code className="mt-2 block overflow-x-auto rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
              {surface.meta}
            </code>
          </div>
        ))}
      </div>

      {/* MCP + copilot — one calm panel, no simulated conversation. */}
      <div className="mt-5 grid gap-5 rounded-2xl border border-border bg-card p-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10 lg:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <RiRobot2Line size={16} aria-hidden />
            </span>
            <Badge variant="secondary" className="h-6 rounded-full px-2.5">
              MCP server built in
            </Badge>
          </div>

          <h3 className="mt-5 font-heading text-2xl font-semibold tracking-[-0.02em] text-balance text-foreground">
            Ask for it instead of clicking for it
          </h3>
          <p className="mt-3.5 text-base leading-relaxed text-pretty text-muted-foreground">
            {PRODUCT_NAME} ships {MCP_TOOL_COUNT} MCP tools over OAuth at{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
              {MCP_ENDPOINT_PATH}
            </code>
            . Connect Claude, ChatGPT or Codex and they can read your programme
            and change it — or use the copilot built into the app, which runs on
            exactly the same tools. Anything destructive asks first.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={GITHUB_README_URL} {...EXTERNAL_LINK_PROPS} />}
            >
              <RiTerminalBoxLine aria-hidden />
              Read the docs
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-5">
          <p className="text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">
            Things people ask it
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {COPILOT_PROMPTS.map((prompt, index) => (
              <li key={prompt}>
                <Badge
                  variant="outline"
                  className={cn(
                    // Long prompts must wrap on a 360px screen, not push the page.
                    "h-auto rounded-full border-border bg-card px-3.5 py-1.5 text-[13px] font-normal whitespace-normal",
                    index === 0 ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {prompt}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Every tool call that writes — accepting a talk, moving a session,
            emailing a speaker — surfaces a confirmation card before it runs.
          </p>
        </div>
      </div>
    </MarketingSection>
  )
}
