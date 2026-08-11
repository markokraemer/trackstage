/**
 * The embed generator's vocabulary, shared by the page and the saved-embeds
 * list so a saved row and the live configurator can never disagree.
 *
 * Widget ids mirror `EMBED_WIDGETS` in convex/embeds.ts; formats mirror
 * `EMBED_FORMATS`. Everything else is derived from the public widget URL
 * contract in `src/components/public/widget-search.ts` — an embed is a link,
 * so a saved embed is just the options that build that link.
 */

import {
  RiCalendarLine,
  RiCodeSSlashLine,
  RiFileCodeLine,
  RiGalleryLine,
  RiLayoutGridLine,
  RiLinkM,
  RiListCheck2,
  RiListUnordered,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import type { WidgetSearch } from "@/components/public/widget-search"

export interface WidgetType {
  id: string
  name: string
  description: string
  icon: RemixiconComponentType
  /** Path under the event, e.g. "/sessions". */
  path: string
  /** Params that define this widget (on top of the organizer's options). */
  params: WidgetSearch
  /** Sensible iframe height. */
  height: number
  /** Which public dataset the static-HTML export reads. */
  dataset: "schedule" | "speakers"
}

export const WIDGET_TYPES: Array<WidgetType> = [
  {
    id: "agenda",
    name: "Agenda",
    description:
      "The wall-planner grid: rooms across the top, time down the side, one day at a time.",
    icon: RiLayoutGridLine,
    path: "",
    params: { view: "rooms" },
    height: 900,
    dataset: "schedule",
  },
  {
    id: "itinerary",
    name: "Schedule itinerary",
    description:
      "The chronological day-by-day agenda with day tabs and full session cards.",
    icon: RiListCheck2,
    path: "",
    params: { view: "time" },
    height: 900,
    dataset: "schedule",
  },
  {
    id: "sessions",
    name: "Sessions list",
    description:
      "A searchable catalog of every session, with track, format and room filters.",
    icon: RiListUnordered,
    path: "/sessions",
    params: {},
    height: 900,
    dataset: "schedule",
  },
  {
    id: "speaker-gallery",
    name: "Speaker gallery",
    description:
      "A photo grid of your speakers. Clicking a face opens their bio and sessions.",
    icon: RiGalleryLine,
    path: "/speakers",
    params: { view: "gallery" },
    height: 800,
    dataset: "speakers",
  },
  {
    id: "speaker-list",
    name: "Speakers list",
    description:
      "A directory that pairs each speaker with the sessions they're presenting.",
    icon: RiListUnordered,
    path: "/speakers",
    params: { view: "list" },
    height: 900,
    dataset: "speakers",
  },
]

export function widgetById(id: string): WidgetType {
  return WIDGET_TYPES.find((type) => type.id === id) ?? WIDGET_TYPES[0]
}

export interface EmbedFormat {
  id: string
  name: string
  description: string
  icon: RemixiconComponentType
}

/**
 * How the organizer wants to take the widget away with them. The first two are
 * live (they re-read the program on every page view); Static HTML is a
 * snapshot, and says so.
 */
export const EMBED_FORMATS: Array<EmbedFormat> = [
  {
    id: "iframe",
    name: "Embedded widget",
    description:
      "An <iframe> you paste into any site builder. Always shows live data.",
    icon: RiCodeSSlashLine,
  },
  {
    id: "link",
    name: "Direct link",
    description:
      "The same widget as its own page — for emails, Slack and QR codes.",
    icon: RiLinkM,
  },
  {
    id: "html",
    name: "Static HTML",
    description:
      "Plain, unstyled markup of the current program. A snapshot: re-copy it after you change the schedule.",
    icon: RiFileCodeLine,
  },
  {
    id: "json",
    name: "JSON feed",
    description:
      "Our REST endpoint, for a developer wiring the program into your own site.",
    icon: RiFileCodeLine,
  },
  {
    id: "ics",
    name: "Calendar feed",
    description:
      "A subscribe-able .ics of the whole program, for people who live in their calendar.",
    icon: RiCalendarLine,
  },
]

export function formatById(id: string | undefined): EmbedFormat {
  return EMBED_FORMATS.find((format) => format.id === id) ?? EMBED_FORMATS[0]
}

/** Everything a saved embed row stores under `options`. */
export interface EmbedOptions {
  format?: string
  hideDescriptions?: boolean
  hideSpeakers?: boolean
  hideImages?: boolean
  hideSearch?: boolean
  track?: string
  height?: number
}

/** Build the public widget query from a widget + the organizer's options. */
export function searchFor(
  widget: WidgetType,
  options: EmbedOptions,
): WidgetSearch {
  return {
    embed: true,
    ...widget.params,
    hideDescriptions: options.hideDescriptions ? true : undefined,
    hideSpeakers: options.hideSpeakers ? true : undefined,
    hideImages: options.hideImages ? true : undefined,
    hideSearch: options.hideSearch ? true : undefined,
    track: options.track,
  }
}

/** Escape text destined for a generated HTML snippet. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
