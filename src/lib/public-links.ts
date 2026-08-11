/**
 * The public URL scheme — one place, client side.
 *
 *     /e/:eventSlug                  the public event program (globally unique)
 *     /submit/:eventSlug/:formSlug   the canonical call-for-speakers link
 *     /submit/:formSlug              LEGACY, redirects to the canonical link
 *     /portal/t/:token               already globally unique by construction
 *
 * Form slugs live in a PER-EVENT namespace, so "cfp" belongs to whoever wants
 * it, in every event, forever. Nothing in the app may build a `/submit/…`
 * string by hand — every link producer goes through here so the scheme can
 * only ever change in one place. Mirrors `convex/lib/publicLinks.ts`.
 */

/** Lowercase, dash-separated, URL-safe. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

/**
 * Slugify for a field the user is still TYPING in.
 *
 * `slugify` strips trailing dashes, which is right for a finished value and
 * wrong for a keystroke: re-slugifying on every change turned "ai-summit-2026"
 * into "aisummit2026", one swallowed dash at a time. This keeps the dash the
 * user just typed and leaves the tidy-up to `slugify` on submit (and to the
 * server, which normalises whatever arrives).
 */
export function slugifyInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60)
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value)
}

function origin(): string {
  return typeof window === "undefined" ? "" : window.location.origin
}

/** Canonical public path for a CFP form, e.g. `/submit/ai-summit-2026/cfp`. */
export function formPath(eventSlug: string, formSlug: string): string {
  return `/submit/${eventSlug}/${formSlug}`
}

/** The same link, absolute — what a copy button puts on the clipboard. */
export function formUrl(eventSlug: string, formSlug: string): string {
  return `${origin()}${formPath(eventSlug, formSlug)}`
}

/** Canonical public path for an event's program, e.g. `/e/ai-summit-2026`. */
export function eventPath(eventSlug: string): string {
  return `/e/${eventSlug}`
}

/** Absolute public event URL. */
export function eventUrl(eventSlug: string): string {
  return `${origin()}${eventPath(eventSlug)}`
}

/** Speaker-portal magic link for a person's `portalToken` (already unique). */
export function portalPath(token: string): string {
  return `/portal/t/${token}`
}

/** Absolute speaker-portal magic link. */
export function portalUrl(token: string): string {
  return `${origin()}${portalPath(token)}`
}
