/**
 * URL-safe slugs — the public address of an event.
 *
 * Re-exported from `src/lib/public-links.ts`, which owns the whole public URL
 * scheme (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical"). Kept
 * as its own module so the settings screens' imports read in their own terms.
 */
export {
  SLUG_PATTERN,
  eventUrl as publicEventUrl,
  isValidSlug,
  slugify,
  slugifyInput,
} from "@/lib/public-links"
