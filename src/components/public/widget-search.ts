/**
 * URL contract for the public widgets.
 *
 * Every public page under `/e/$workspaceSlug/$eventSlug` is also an
 * embeddable widget: the same
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
  /**
   * Content filter: only show sessions on these tracks, BY NAME. One name is
   * the everyday case (the track chips on the public page set exactly one);
   * an embed that covers two rooms of a conference comma-separates them.
   */
  track?: string
  /**
   * The saved embed this URL was generated from. Present only on snippets
   * copied out of a SAVED embed, and used for one thing: asking whether the
   * organizer has since switched that embed off (sbek EMB-15).
   */
  e?: string
  /** Branding: accent colour as `#RRGGBB`, applied to links and buttons. */
  accent?: string
  /** Branding: show the event's logo and name above the widget. */
  brand?: true
  /** Sessions catalog facets, by display name — linkable like every filter. */
  format?: string
  room?: string
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

/** `#RRGGBB` only — anything else is ignored rather than styled with. */
function hexColor(value: unknown): string | undefined {
  const raw = text(value)
  if (!raw) return undefined
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : undefined
}

/**
 * `?track=AI,Infra` → `["ai", "infra"]`, lower-cased for comparison. One name
 * is the common case; the list is what lets a curated embed pin several
 * tracks. Every filter site parses through here so they can't drift.
 */
export function trackFilter(track: string | undefined): Array<string> {
  if (!track) return []
  return track
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0)
}

/** Does this session's track pass a (possibly multi-value) `?track=` filter? */
export function matchesTrackFilter(
  wanted: Array<string>,
  trackName: string | undefined,
): boolean {
  if (wanted.length === 0) return true
  return trackName !== undefined && wanted.includes(trackName.toLowerCase())
}

/** The human phrase for a `?track=` filter: "the AI track" / "the selected tracks". */
export function trackFilterLabel(track: string | undefined): string | null {
  const names = (track ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  if (names.length === 0) return null
  if (names.length === 1) return `the ${names[0]} track`
  return `the ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} tracks`
}

/** `validateSearch` for the `/e/$workspaceSlug/$eventSlug` layout — children inherit these. */
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
    e: text(search.e),
    accent: hexColor(search.accent),
    brand: flag(search.brand),
    format: text(search.format),
    room: text(search.room),
    view: text(search.view),
    day: text(search.day),
    q: text(search.q),
  }
}

/**
 * Drop empty values so generated embed URLs stay short and readable.
 * Flags serialise as `true` — the router's own canonical form — so an embed
 * never pays for a normalising redirect on first paint. (`?embed=1` still
 * works for hand-written URLs; it just redirects once.)
 */
export function widgetSearchToQuery(search: WidgetSearch): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === false) continue
    params.set(key, value === true ? "true" : String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}
