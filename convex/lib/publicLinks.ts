import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

/**
 * THE URL scheme — one place, server side (docs/memory/DECISIONS.md,
 * "URL architecture is fully hierarchical: workspace → event → form").
 *
 *     /e/:workspaceSlug/:eventSlug                 public event program (CANONICAL)
 *     /submit/:workspaceSlug/:eventSlug/:formSlug  public CFP link (CANONICAL)
 *     /portal/t/:token                             globally unique by construction
 *     /review/:token                               globally unique by construction
 *
 * Namespaces, top to bottom:
 *   · WORKSPACE slugs are globally unique (organizations.by_slug).
 *   · EVENT slugs are unique PER WORKSPACE (events.by_organizationId_slug).
 *     Events created before this scheme carried globally-unique slugs; those
 *     remain valid and resolvable forever.
 *   · FORM slugs are unique PER EVENT (forms.by_eventId_slug).
 *
 * LEGACY shapes — every previously printed link keeps resolving, then 307s to
 * the canonical address (oldest claimant wins wherever a slug is ambiguous):
 *
 *     /e/:eventSlug                     → /e/:ws/:eventSlug
 *     /e/:eventSlug/<subpage…>          → /e/:ws/:eventSlug/<subpage…>
 *     /submit/:eventSlug/:formSlug      → /submit/:ws/:eventSlug/:formSlug
 *     /submit/:formSlug                 → /submit/:ws/:eventSlug/:formSlug
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

/**
 * Words a WORKSPACE slug may never claim: every static path that lives beside
 * `/app/:workspaceSlug` (the bare legacy sections, account, copilot, …) plus
 * the app's own top-level route names. A workspace slugged "submissions" would
 * be permanently shadowed by the static route — so the generator treats these
 * as taken.
 */
export const RESERVED_WORKSPACE_SLUGS: ReadonlySet<string> = new Set([
  "account",
  "agenda",
  "api",
  "app",
  "communications",
  "copilot",
  "docs",
  "e",
  "embeds",
  "evaluation",
  "events",
  "files",
  "forms",
  "login",
  "new",
  "portal",
  "review",
  "settings",
  "speakers",
  "submissions",
  "submit",
  "workspace",
])

/**
 * Words an EVENT slug may never claim: the static children of
 * `/app/:workspaceSlug` ("workspace" is the workspace hub) plus a small
 * defensive set. Kept deliberately tiny — event slugs live one level down and
 * have almost no static siblings.
 */
export const RESERVED_EVENT_SLUGS: ReadonlySet<string> = new Set([
  "events",
  "new",
  "settings",
  "workspace",
])

/**
 * A short, readable disambiguator — the suffix a slug picks up when the
 * obvious address is already claimed (`kortix-con` → `kortix-con-x3f2`). Four
 * base-36 characters read as a deliberate id rather than as a mistake, which
 * `-2` does not once you are the fourth "summit".
 */
export function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

// ————————————————————————————————————————————————————————————————————————
// Canonical path builders — nothing in convex/ may build these by hand.
// ————————————————————————————————————————————————————————————————————————

/** Canonical public path for an event's program: `/e/:ws/:event`. */
export function eventPath(workspaceSlug: string, eventSlug: string): string {
  return `/e/${workspaceSlug}/${eventSlug}`
}

/**
 * Canonical ORGANIZER path for an event: `/app/:ws/:event`. The public
 * builders above are for speakers and attendees; this one is the admin side,
 * which the MCP tools hand to assistants so a chat answer can link a person
 * straight to the screen it is describing.
 */
export function appEventPath(workspaceSlug: string, eventSlug: string): string {
  return `/app/${workspaceSlug}/${eventSlug}`
}

/** Canonical public path for a CFP form: `/submit/:ws/:event/:form`. */
export function formPath(
  workspaceSlug: string,
  eventSlug: string,
  formSlug: string,
): string {
  return `/submit/${workspaceSlug}/${eventSlug}/${formSlug}`
}

/**
 * The workspace segment for an event's public links. Every event owns exactly
 * one organization; the fallback only exists so a half-migrated row can never
 * crash a link builder — "workspace" is a reserved slug, so the resolver's
 * legacy path picks such a link up and re-resolves it by event slug.
 */
export async function workspaceSlugForEvent(
  ctx: QueryCtx | MutationCtx,
  event: Doc<"events">,
): Promise<string> {
  if (event.organizationId) {
    const org = await ctx.db.get(event.organizationId)
    if (org) return org.slug
  }
  return "workspace"
}

// ————————————————————————————————————————————————————————————————————————
// Slug generation — never blocks, always reports what was actually claimed.
// ————————————————————————————————————————————————————————————————————————

/**
 * The next free WORKSPACE slug (globally unique — it is the first URL segment
 * of everything). A taken or reserved address is suffixed, never refused:
 * nothing may stand between a user and their workspace.
 */
export async function uniqueWorkspaceSlug(
  ctx: QueryCtx | MutationCtx,
  desired: string,
  ignoreOrganizationId?: Id<"organizations">,
): Promise<string> {
  const base = slugify(desired, "workspace").slice(0, 40).replace(/-+$/g, "") ||
    "workspace"
  let candidate = base
  for (let attempt = 0; attempt < 25; attempt++) {
    if (!RESERVED_WORKSPACE_SLUGS.has(candidate)) {
      const clash = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", candidate))
        .first()
      if (!clash || clash._id === ignoreOrganizationId) return candidate
    }
    candidate = `${base}-${shortSuffix()}`
  }
  return `${base}-${Date.now().toString(36)}`
}

/**
 * The next free EVENT slug INSIDE one workspace. Event slugs used to be
 * globally unique (`/e/:slug` was one segment); the canonical address now
 * carries the workspace, so the obvious name — "summit", "devcon" — is
 * available to every workspace at once. Never throws and never blocks: a taken
 * address is suffixed, and the caller tells the organizer what they got.
 */
export async function uniqueEventSlug(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  desired: string,
  ignoreEventId?: Id<"events">,
): Promise<string> {
  const base = slugify(desired, "event")
  let candidate = base
  for (let attempt = 0; attempt < 25; attempt++) {
    if (!RESERVED_EVENT_SLUGS.has(candidate)) {
      const clash = await ctx.db
        .query("events")
        .withIndex("by_organizationId_slug", (q) =>
          q.eq("organizationId", organizationId).eq("slug", candidate),
        )
        .first()
      if (!clash || clash._id === ignoreEventId) return candidate
    }
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

/** How many same-slug rows a legacy lookup will consider. */
const LEGACY_SCAN_LIMIT = 50

/**
 * The event that has held a (formerly global) slug the longest.
 *
 * Before per-workspace namespacing an event slug WAS the whole `/e/` address
 * and organizers printed it. Several events may now legitimately share a slug,
 * so the tie-break is **oldest wins**: the event that held the address when
 * the link was printed keeps it, forever. Deterministic, creation-ordered
 * resolution means a newcomer can never take an address it never had — it
 * simply uses its own canonical two-segment link, which is what every surface
 * in the product now hands out. (The "refuse and show an ambiguous-link page"
 * alternative was rejected: it would let any organizer kill someone else's
 * printed link just by reusing a slug — exactly the cross-tenant interference
 * this scheme exists to remove.)
 */
export async function oldestEventBySlug(
  ctx: QueryCtx | MutationCtx,
  slug: string,
): Promise<Doc<"events"> | null> {
  const trimmed = slug.trim().toLowerCase()
  if (!trimmed) return null
  const matches = await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", trimmed))
    .take(LEGACY_SCAN_LIMIT)
  if (matches.length === 0) return null
  return matches.reduce((oldest, candidate) =>
    candidate._creationTime < oldest._creationTime ? candidate : oldest,
  )
}

export type EventResolution =
  | {
      status: "ok"
      event: Doc<"events">
      /** The canonical workspace segment for this event. */
      workspaceSlug: string
      /** True when the request arrived through a legacy shape → 307. */
      legacy: boolean
    }
  | { status: "missing" }

/**
 * Resolve a public event from a canonical (`workspaceSlug` + `eventSlug`) or a
 * legacy (`eventSlug` only) address.
 *
 * Canonical-first: when both segments are given, the workspace lookup wins; if
 * that misses, the FIRST segment is re-read as a legacy event slug (that is
 * what `/e/summit/speakers` is) by the route layer, which calls back in with
 * only `eventSlug`.
 */
export async function resolvePublicEvent(
  ctx: QueryCtx | MutationCtx,
  args: { eventSlug: string; workspaceSlug?: string },
): Promise<EventResolution> {
  const eventSlug = args.eventSlug.trim().toLowerCase()
  if (!eventSlug) return { status: "missing" }

  if (args.workspaceSlug) {
    const workspaceSlug = args.workspaceSlug.trim().toLowerCase()
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", workspaceSlug))
      .unique()
    if (org) {
      const event = await ctx.db
        .query("events")
        .withIndex("by_organizationId_slug", (q) =>
          q.eq("organizationId", org._id).eq("slug", eventSlug),
        )
        .first()
      if (event) {
        return { status: "ok", event, workspaceSlug: org.slug, legacy: false }
      }
    }
    return { status: "missing" }
  }

  // Legacy one-segment shape: oldest claimant wins (see oldestEventBySlug).
  const event = await oldestEventBySlug(ctx, eventSlug)
  if (!event) return { status: "missing" }
  return {
    status: "ok",
    event,
    workspaceSlug: await workspaceSlugForEvent(ctx, event),
    legacy: true,
  }
}

export type FormResolution =
  | {
      status: "ok"
      form: Doc<"forms">
      event: Doc<"events">
      /** The canonical workspace segment for this form's event. */
      workspaceSlug: string
      legacy: boolean
    }
  | { status: "missing" }

/**
 * Resolve a public form from any of its three address shapes:
 *
 *   canonical  { workspaceSlug, eventSlug, slug }   /submit/:ws/:event/:form
 *   legacy v2  { eventSlug, slug }                  /submit/:event/:form
 *   legacy v1  { slug }                             /submit/:form
 *
 * Both legacy paths resolve oldest-claimant (see `oldestEventBySlug` for the
 * rationale) and report `legacy: true` so the route can 307 to canonical.
 */
export async function resolvePublicForm(
  ctx: QueryCtx | MutationCtx,
  args: { slug: string; eventSlug?: string; workspaceSlug?: string },
): Promise<FormResolution> {
  const formSlug = args.slug.trim().toLowerCase()
  if (!formSlug) return { status: "missing" }

  if (args.eventSlug) {
    const resolved = await resolvePublicEvent(ctx, {
      eventSlug: args.eventSlug,
      ...(args.workspaceSlug ? { workspaceSlug: args.workspaceSlug } : {}),
    })
    if (resolved.status !== "ok") return { status: "missing" }
    const form = await ctx.db
      .query("forms")
      .withIndex("by_eventId_slug", (q) =>
        q.eq("eventId", resolved.event._id).eq("slug", formSlug),
      )
      .unique()
    if (!form) return { status: "missing" }
    return {
      status: "ok",
      form,
      event: resolved.event,
      workspaceSlug: resolved.workspaceSlug,
      legacy: resolved.legacy,
    }
  }

  // Legacy v1: one segment, every event a candidate — oldest form wins.
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
  return {
    status: "ok",
    form,
    event,
    workspaceSlug: await workspaceSlugForEvent(ctx, event),
    legacy: true,
  }
}
