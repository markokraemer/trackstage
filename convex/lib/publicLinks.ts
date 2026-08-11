import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

/**
 * The public URL scheme — one place, server side (docs/memory/DECISIONS.md,
 * "Public URL scheme is hierarchical").
 *
 *     /e/:eventSlug                  the public event program (globally unique)
 *     /submit/:eventSlug/:formSlug   the canonical call-for-speakers link
 *     /submit/:formSlug              LEGACY, resolves across events and redirects
 *     /portal/t/:token               already globally unique by construction
 *
 * Form slugs live in a PER-EVENT namespace. Before this, "cfp" or
 * "call-for-speakers" could only exist once across the whole platform, so the
 * second organizer to want the obvious name silently got `-2`. Nesting the form
 * under its event makes the obvious name available to everyone, forever.
 *
 * The mirror of this module on the client is `src/lib/public-links.ts`. Keep
 * the two in sync — they are deliberately duplicated rather than shared because
 * Convex bundles `convex/` independently of the app.
 */

/** Lowercase, dash-separated, URL-safe. Empty input never yields an empty slug. */
export function slugify(value: string, fallback = "form"): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
  return slug || fallback
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value)
}

/** Canonical public path for a CFP form. */
export function formPath(eventSlug: string, formSlug: string): string {
  return `/submit/${eventSlug}/${formSlug}`
}

/** Canonical public path for an event's program. */
export function eventPath(eventSlug: string): string {
  return `/e/${eventSlug}`
}

/**
 * A short, readable disambiguator — the suffix an event slug picks up when the
 * obvious address is already claimed (`kortix-con` → `kortix-con-x3f2`). Four
 * base-36 characters read as a deliberate id rather than as a mistake, which
 * `-2` does not once you are the fourth "summit".
 */
export function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

/**
 * The next free EVENT slug (events stay globally unique — `/e/:slug` is one
 * segment). Never throws and never blocks: a taken address is suffixed, and the
 * caller tells the organizer what they actually got.
 */
export async function uniqueEventSlug(
  ctx: QueryCtx | MutationCtx,
  desired: string,
  ignoreEventId?: Id<"events">,
): Promise<string> {
  const base = slugify(desired, "event")
  let candidate = base
  for (let attempt = 0; attempt < 25; attempt++) {
    const clash = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first()
    if (!clash || clash._id === ignoreEventId) return candidate
    candidate = `${base}-${shortSuffix()}`
  }
  return `${base}-${Date.now().toString(36)}`
}

/** Is this form slug free inside its event? */
export async function formSlugIsFree(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  slug: string,
  ignoreFormId?: Id<"forms">,
): Promise<boolean> {
  const clash = await ctx.db
    .query("forms")
    .withIndex("by_eventId_slug", (q) =>
      q.eq("eventId", eventId).eq("slug", slug),
    )
    .first()
  return !clash || clash._id === ignoreFormId
}

/**
 * The next free FORM slug inside one event. Used when we are generating the
 * slug ourselves (create / duplicate) — an organizer who TYPES a taken address
 * gets told instead (see `convex/forms.ts` update), because silently moving the
 * link someone just decided to print is worse than a one-line error.
 */
export async function uniqueFormSlug(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  desired: string,
  ignoreFormId?: Id<"forms">,
): Promise<string> {
  const base = slugify(desired, "form")
  let candidate = base
  for (let attempt = 2; attempt < 50; attempt++) {
    if (await formSlugIsFree(ctx, eventId, candidate, ignoreFormId)) {
      return candidate
    }
    candidate = `${base}-${attempt}`
  }
  return `${base}-${shortSuffix()}`
}

/** The `-2`-style suggestion offered back to an organizer who hit a clash. */
export async function suggestFormSlug(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  desired: string,
  ignoreFormId?: Id<"forms">,
): Promise<string> {
  return await uniqueFormSlug(ctx, eventId, desired, ignoreFormId)
}

// ————————————————————————————————————————————————————————————————————————
// Public resolution
// ————————————————————————————————————————————————————————————————————————

export type FormResolution =
  | { status: "ok"; form: Doc<"forms">; event: Doc<"events">; legacy: boolean }
  | { status: "missing" }

/** How many same-slug forms a legacy lookup will consider. */
const LEGACY_SCAN_LIMIT = 50

/**
 * Resolve a public form from a canonical (`eventSlug` + `slug`) or a legacy
 * (`slug` only) address.
 *
 * The legacy path scans across events, because before the per-event namespace a
 * slug WAS the whole address and organizers printed it on slides. Several forms
 * may now share one slug, so the tie-break is **oldest wins**: the form that
 * held the address when the link was printed keeps it, forever.
 *
 * That rule is deliberate. The obvious alternative — refuse to guess and show
 * an "ambiguous link" page — would hand every organizer a way to kill someone
 * else's printed link just by naming a form the same thing, which is precisely
 * the cross-tenant blocking this whole change exists to remove. Deterministic,
 * creation-ordered resolution means a newcomer can never take an address they
 * did not have; they simply use their own canonical two-segment link, which is
 * what every surface in the product now hands them.
 */
export async function resolvePublicForm(
  ctx: QueryCtx | MutationCtx,
  args: { slug: string; eventSlug?: string },
): Promise<FormResolution> {
  const formSlug = args.slug.trim().toLowerCase()
  if (!formSlug) return { status: "missing" }

  if (args.eventSlug) {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.eventSlug!.trim().toLowerCase()))
      .unique()
    if (!event) return { status: "missing" }
    const form = await ctx.db
      .query("forms")
      .withIndex("by_eventId_slug", (q) =>
        q.eq("eventId", event._id).eq("slug", formSlug),
      )
      .unique()
    return form ? { status: "ok", form, event, legacy: false } : { status: "missing" }
  }

  // Legacy: one segment, every event a candidate.
  const matches = await ctx.db
    .query("forms")
    .withIndex("by_slug", (q) => q.eq("slug", formSlug))
    .take(LEGACY_SCAN_LIMIT)
  if (matches.length === 0) return { status: "missing" }
  const form = matches.reduce((oldest, candidate) =>
    candidate._creationTime < oldest._creationTime ? candidate : oldest,
  )
  const event = await ctx.db.get(form.eventId)
  if (!event) return { status: "missing" }
  return { status: "ok", form, event, legacy: true }
}
