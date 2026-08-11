/** URL-safe slugs — the public address of an event. */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value)
}

/** Absolute public event URL, e.g. `https://…/e/ai-engineer-sandbox`. */
export function publicEventUrl(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin
  return `${origin}/e/${slug}`
}
