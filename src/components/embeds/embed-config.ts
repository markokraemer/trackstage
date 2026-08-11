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
  RiBracesLine,
  RiCalendarLine,
  RiCodeBoxLine,
  RiCodeSSlashLine,
  RiFileTextLine,
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
    name: "Agenda grid",
    description: "Rooms across the top, time down the side, one day at a time.",
    icon: RiLayoutGridLine,
    path: "",
    params: { view: "rooms" },
    height: 900,
    dataset: "schedule",
  },
  {
    id: "itinerary",
    name: "Schedule itinerary",
    description: "Day-by-day running order with day tabs and session cards.",
    icon: RiListCheck2,
    path: "",
    params: { view: "time" },
    height: 900,
    dataset: "schedule",
  },
  {
    id: "sessions",
    name: "Sessions list",
    description: "Searchable catalog with track, format and room filters.",
    icon: RiListUnordered,
    path: "/sessions",
    params: {},
    height: 900,
    dataset: "schedule",
  },
  {
    id: "speaker-gallery",
    name: "Speaker gallery",
    description: "Photo grid — clicking a face opens the bio and sessions.",
    icon: RiGalleryLine,
    path: "/speakers",
    params: { view: "gallery" },
    height: 800,
    dataset: "speakers",
  },
  {
    id: "speaker-list",
    name: "Speakers list",
    description: "Directory pairing each speaker with the sessions they give.",
    icon: RiListUnordered,
    path: "/speakers",
    params: { view: "list" },
    height: 900,
    dataset: "speakers",
  },
]

/**
 * The two families of widget, in the order they are offered. Grouping is what
 * turns five look-alike cards into two short, obvious lists — an organizer
 * scanning for "the speaker one" reads a heading, not five descriptions.
 */
export const WIDGET_GROUPS: Array<{
  dataset: WidgetType["dataset"]
  label: string
}> = [
  { dataset: "schedule", label: "Your programme" },
  { dataset: "speakers", label: "Your speakers" },
]

export function widgetById(id: string): WidgetType {
  return WIDGET_TYPES.find((type) => type.id === id) ?? WIDGET_TYPES[0]
}

export interface EmbedFormat {
  id: string
  name: string
  description: string
  icon: RemixiconComponentType
  /** Which shelf it sits on — see `FORMAT_GROUPS`. */
  group: "site" | "developer"
  /** The one an organizer should take unless they know better. */
  recommended?: boolean
  /** True when the output is a point-in-time copy rather than a live view. */
  snapshot?: boolean
}

/**
 * How the organizer wants to take the widget away with them.
 *
 * Every format used to sit in one flat six-up grid, so "JSON feed" had exactly
 * the same weight as "Embedded widget" for a non-technical organizer. They are
 * shelved instead: the three that belong on a website first, the three that
 * belong to a developer or a calendar app second, with one card marked as the
 * recommended default. Everything is live except Static HTML, which is tagged
 * a snapshot rather than explaining itself in a paragraph.
 */
export const EMBED_FORMATS: Array<EmbedFormat> = [
  {
    id: "iframe",
    name: "Embedded widget",
    description: "Paste a snippet into your site. Always shows live data.",
    icon: RiCodeSSlashLine,
    group: "site",
    recommended: true,
  },
  {
    id: "link",
    name: "Direct link",
    description: "The widget as its own page — emails, Slack, QR codes.",
    icon: RiLinkM,
    group: "site",
  },
  {
    id: "html",
    name: "Static HTML",
    description: "Plain markup you can restyle to match your site.",
    icon: RiFileTextLine,
    group: "site",
    snapshot: true,
  },
  {
    id: "json",
    name: "JSON feed",
    description: "REST endpoint for a developer building your own layout.",
    icon: RiBracesLine,
    group: "developer",
  },
  {
    id: "xml",
    name: "XML feed",
    description: "For a CMS or site builder whose import box speaks XML.",
    icon: RiCodeBoxLine,
    group: "developer",
  },
  {
    id: "ics",
    name: "Calendar feed",
    description: "Subscribe-able .ics for Google, Outlook or Apple Calendar.",
    icon: RiCalendarLine,
    group: "developer",
  },
]

export const FORMAT_GROUPS: Array<{
  group: EmbedFormat["group"]
  label: string
  hint: string
}> = [
  {
    group: "site",
    label: "Put it on your website",
    hint: "No developer needed.",
  },
  {
    group: "developer",
    label: "Feeds for developers and calendar apps",
    hint: "Hand these to whoever builds your site.",
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
  /** One track name, or several comma-separated — the URL takes both. */
  track?: string
  height?: number
  /** Branding: accent colour as `#RRGGBB`. */
  accent?: string
  /** Branding: the event's logo and name above the widget. */
  showHeader?: boolean
}

/** `"AI, Infra"` ⇄ `["AI", "Infra"]` — the stored shape is the URL's shape. */
export function tracksOf(track: string | undefined): Array<string> {
  if (!track) return []
  return track
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

export function tracksToOption(tracks: Array<string>): string | undefined {
  return tracks.length === 0 ? undefined : tracks.join(",")
}

/**
 * Build the public widget query from a widget + the organizer's options.
 *
 * `embedId` is threaded in for SAVED embeds only: it is what lets the public
 * page ask whether the organizer has since switched this embed off. Branding
 * rides in the URL too, so a snippet is still self-contained — the saved row
 * is the off switch, not a lookup the widget depends on to render.
 */
export function searchFor(
  widget: WidgetType,
  options: EmbedOptions,
  embedId?: string,
): WidgetSearch {
  return {
    embed: true,
    ...widget.params,
    hideDescriptions: options.hideDescriptions ? true : undefined,
    hideSpeakers: options.hideSpeakers ? true : undefined,
    hideImages: options.hideImages ? true : undefined,
    hideSearch: options.hideSearch ? true : undefined,
    track: options.track,
    accent: options.accent,
    brand: options.showHeader ? true : undefined,
    e: embedId,
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
