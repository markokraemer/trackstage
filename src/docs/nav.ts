import {
  RiAirplayLine,
  RiBookOpenLine,
  RiCalendarScheduleLine,
  RiCodeSSlashLine,
  RiFlashlightLine,
  RiGlobalLine,
  RiMailSendLine,
  RiRobot2Line,
  RiServerLine,
  RiShareForwardLine,
  RiSparklingLine,
  RiSurveyLine,
  RiTeamLine,
  RiTableLine,
  RiUserVoiceLine
  
} from "@remixicon/react"
import type {RemixiconComponentType} from "@remixicon/react";
import type { LinkProps } from "@tanstack/react-router"

/**
 * The /docs sidebar tree — and the only place a docs page is registered.
 *
 * Order here is the order in the sidebar AND the order of the prev/next links
 * at the bottom of every page, so the guide reads as one path from "I just
 * signed up" to "my programme is live".
 */

export interface DocsNavItem {
  /** A real route in the generated route tree — checked at the literal below. */
  to: NonNullable<LinkProps["to"]>
  title: string
  /** One line, shown on the /docs index cards and as the sidebar tooltip. */
  summary: string
  icon: RemixiconComponentType
  /**
   * The page lives OUTSIDE the docs shell and takes the whole viewport (the
   * Scalar API reference). The sidebar marks these so a click that swaps the
   * entire chrome is never a surprise.
   */
  standalone?: boolean
}

export interface DocsNavGroup {
  /** Small-caps section label. Omitted for the single top entry. */
  label?: string
  items: Array<DocsNavItem>
}

export const DOCS_NAV: Array<DocsNavGroup> = [
  {
    items: [
      {
        to: "/docs",
        title: "Overview",
        summary: "What Sessionboard does, in one screen.",
        icon: RiBookOpenLine,
      },
    ],
  },
  {
    label: "User guide",
    items: [
      {
        to: "/docs/guide/getting-started",
        title: "Getting started",
        summary: "Sign up, land in a workspace, create your first event.",
        icon: RiFlashlightLine,
      },
      {
        to: "/docs/guide/create-a-cfp-form",
        title: "Create your CFP form",
        summary: "Build the form speakers fill in, question by question.",
        icon: RiSurveyLine,
      },
      {
        to: "/docs/guide/share-and-collect",
        title: "Share it & collect",
        summary: "Publish the link and watch submissions arrive.",
        icon: RiShareForwardLine,
      },
      {
        to: "/docs/guide/review-and-decide",
        title: "Review & decide",
        summary: "Stage accepts and declines, then send them in one go.",
        icon: RiTableLine,
      },
      {
        to: "/docs/guide/speaker-portal",
        title: "Speaker portal",
        summary: "What your speakers see after they submit.",
        icon: RiUserVoiceLine,
      },
      {
        to: "/docs/guide/build-the-agenda",
        title: "Build the agenda",
        summary: "Drag sessions into rooms and clear every conflict.",
        icon: RiCalendarScheduleLine,
      },
      {
        to: "/docs/guide/chase-speakers",
        title: "Chase speakers",
        summary: "Assign tasks and remind whoever is still missing.",
        icon: RiMailSendLine,
      },
      {
        to: "/docs/guide/publish-your-program",
        title: "Publish your program",
        summary: "Go live with a public schedule, a calendar feed and embeds.",
        icon: RiGlobalLine,
      },
      {
        to: "/docs/guide/team-and-workspaces",
        title: "Team & workspaces",
        summary: "Invite colleagues and run several events side by side.",
        icon: RiTeamLine,
      },
      {
        to: "/docs/guide/airtable-sync",
        title: "Airtable sync",
        summary: "Mirror submissions into a base your automations already watch.",
        icon: RiAirplayLine,
      },
      {
        to: "/docs/guide/ai-copilot",
        title: "AI copilot",
        summary: "Ask for changes in plain English and approve them.",
        icon: RiSparklingLine,
      },
    ],
  },
  {
    label: "Developers",
    items: [
      {
        to: "/docs/api",
        title: "API reference",
        summary:
          "Read sessions, speakers and submissions over plain HTTP. Opens full screen.",
        icon: RiCodeSSlashLine,
        standalone: true,
      },
      {
        to: "/docs/mcp",
        title: "MCP server",
        summary: "Connect Claude, ChatGPT or Codex and run the event by chat.",
        icon: RiRobot2Line,
      },
      {
        to: "/docs/self-host",
        title: "Self-host",
        summary: "Clone it, provision a free backend, deploy your own.",
        icon: RiServerLine,
      },
    ],
  },
]

/** Flat, in reading order — powers the prev/next footer. */
export const DOCS_PAGES = DOCS_NAV.flatMap((group) => group.items)

export function docsNeighbours(path: string) {
  const index = DOCS_PAGES.findIndex((page) => page.to === path)
  if (index === -1) return { previous: null, next: null }
  return {
    previous: index > 0 ? DOCS_PAGES[index - 1] : null,
    next: index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : null,
  }
}

/** Sidebar group label for a page, used in the breadcrumb. */
export function docsSection(path: string): string | null {
  for (const group of DOCS_NAV) {
    if (group.items.some((item) => item.to === path)) {
      return group.label ?? null
    }
  }
  return null
}

export function docsPage(path: string): DocsNavItem | null {
  return DOCS_PAGES.find((page) => page.to === path) ?? null
}
