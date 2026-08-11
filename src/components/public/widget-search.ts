/**
 * URL contract for the public widgets.
 *
 * Every public page under `/e/$slug` is also an embeddable widget: the same
 * route renders bare (no site header, no nav) when `?embed=1`, and the display
 * options an organizer picks in `/app/embeds` are plain query params. Keeping
 * the config in the URL means an embed is a link — nothing to publish, nothing
 * to invalidate, and the widget always reflects live data.
 */

export interface WidgetSearch {
  /** `1` = bare widget: no event header, no nav pills. */
  embed?: true
  /** Field options — omit descriptions / speakers / photos from cards. */
  hideDescriptions?: true
  hideSpeakers?: true
  hideImages?: true
  /** Hide the search + filter toolbar (fixed, curated embeds). */
  hideSearch?: true
  /** Content filter: only show sessions on this track (by name). */
  track?: string
  /** Per-page view mode: `time` | `rooms` (schedule), `gallery` | `list`. */
  view?: string
  /** Selected day on the schedule, as `YYYY-MM-DD`. */
  day?: string
  /** Initial keyword for the sessions/speakers search box. */
  q?: string
}

function flag(value: unknown): true | undefined {
  if (value === true || value === 1) return true
  if (typeof value === "string") {
    const normalized = value.toLowerCase()
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true
    }
  }
  return undefined
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/** `validateSearch` for the `/e/$slug` layout — children inherit these. */
export function validateWidgetSearch(
  search: Record<string, unknown>,
): WidgetSearch {
  return {
    embed: flag(search.embed),
    hideDescriptions: flag(search.hideDescriptions),
    hideSpeakers: flag(search.hideSpeakers),
    hideImages: flag(search.hideImages),
    hideSearch: flag(search.hideSearch),
    track: text(search.track),
    view: text(search.view),
    day: text(search.day),
    q: text(search.q),
  }
}

/** Drop empty values so generated embed URLs stay short and readable. */
export function widgetSearchToQuery(search: WidgetSearch): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === false) continue
    params.set(key, value === true ? "1" : String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}
