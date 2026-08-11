/**
 * The public URL scheme — one place, client side.
 *
 *     /e/:workspaceSlug/:eventSlug                 public event program (CANONICAL)
 *     /submit/:workspaceSlug/:eventSlug/:formSlug  public CFP link (CANONICAL)
 *     /portal/t/:token                             globally unique by construction
 *     /review/:token                               globally unique by construction
 *
 * Workspace slugs are globally unique, event slugs are unique per workspace,
 * form slugs are unique per event — so the obvious names ("summit", "cfp")
 * belong to everyone at once. Legacy shapes (`/e/:eventSlug`,
 * `/submit/:eventSlug/:formSlug`, `/submit/:formSlug`) keep resolving and 307
 * to canonical, oldest claimant first.
 *
 * Nothing in the app may build a `/e/…` or `/submit/…` string by hand — every
 * link producer goes through here so the scheme can only ever change in one
 * place. Mirrors `convex/lib/publicLinks.ts`; organizer-app URLs live in
 * `src/lib/app-links.ts`.
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

/** Canonical public CFP path, e.g. `/submit/ai-engineer/ai-summit-2026/cfp`. */
export function formPath(
  workspaceSlug: string,
  eventSlug: string,
  formSlug: string,
): string {
  return `/submit/${workspaceSlug}/${eventSlug}/${formSlug}`
}

/** The same link, absolute — what a copy button puts on the clipboard. */
export function formUrl(
  workspaceSlug: string,
  eventSlug: string,
  formSlug: string,
): string {
  return `${origin()}${formPath(workspaceSlug, eventSlug, formSlug)}`
}

/** Canonical public event path, e.g. `/e/ai-engineer/ai-summit-2026`. */
export function eventPath(workspaceSlug: string, eventSlug: string): string {
  return `/e/${workspaceSlug}/${eventSlug}`
}

/** Absolute public event URL. */
export function eventUrl(workspaceSlug: string, eventSlug: string): string {
  return `${origin()}${eventPath(workspaceSlug, eventSlug)}`
}

/** Speaker-portal magic link for a person's `portalToken` (already unique). */
export function portalPath(token: string): string {
  return `/portal/t/${token}`
}

/** Absolute speaker-portal magic link. */
export function portalUrl(token: string): string {
  return `${origin()}${portalPath(token)}`
}
