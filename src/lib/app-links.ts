/**
 * Organizer-app URLs — one place (docs/memory/DECISIONS.md, "URL architecture
 * is fully hierarchical").
 *
 * Every event-scoped screen lives under the event that owns it:
 *
 *     /app/:workspaceSlug/:eventSlug/{…section}
 *
 * so the URL itself carries the working context — two tabs on two events stay
 * two tabs on two events, links are shareable, and the browser's history means
 * what it says. The localStorage pointer (src/lib/current-event.ts) survives
 * only as the fallback that resolves BARE legacy paths (`/app/submissions`,
 * a bookmark from before the scheme) to the event the organizer last touched.
 *
 * Workspace-level pages sit beside the events they own
 * (`/app/:workspaceSlug/workspace`); truly personal pages stay global
 * (`/app/account`, `/app/copilot`, `/app/events`).
 *
 * Nothing in the app may build an `/app/…` string by hand — every link
 * producer goes through here (the public scheme lives in
 * `src/lib/public-links.ts`).
 */

/** The two URL segments that name an event uniquely, everywhere. */
export interface EventRef {
  workspaceSlug: string
  eventSlug: string
}

/** Sections that live under an event. Settings subpages are `settings/…`. */
export type EventSection =
  | "submissions"
  | "forms"
  | "evaluation"
  | "agenda"
  | "speakers"
  | "files"
  | "communications"
  | "embeds"
  | "settings"

/** Every event section's first path segment — used to map legacy paths. */
export const EVENT_SECTIONS: ReadonlyArray<EventSection> = [
  "submissions",
  "forms",
  "evaluation",
  "agenda",
  "speakers",
  "files",
  "communications",
  "embeds",
  "settings",
]

function base(ref: EventRef): string {
  return `/app/${ref.workspaceSlug}/${ref.eventSlug}`
}

/** Static children of `/app` — never a workspace slug (reserved server-side). */
const STATIC_APP_SEGMENTS: ReadonlySet<string> = new Set([
  "account",
  "agenda",
  "communications",
  "copilot",
  "embeds",
  "evaluation",
  "events",
  "files",
  "forms",
  "settings",
  "speakers",
  "submissions",
  "workspace",
])

export const appLink = {
  // ——— Event-scoped ————————————————————————————————————————————————————
  dashboard: (ref: EventRef) => base(ref),
  submissions: (ref: EventRef) => `${base(ref)}/submissions`,
  forms: (ref: EventRef) => `${base(ref)}/forms`,
  formNew: (ref: EventRef) => `${base(ref)}/forms/new`,
  form: (ref: EventRef, formId: string) => `${base(ref)}/forms/${formId}`,
  evaluation: (ref: EventRef) => `${base(ref)}/evaluation`,
  evaluationPlan: (ref: EventRef, planId: string) =>
    `${base(ref)}/evaluation/${planId}`,
  agenda: (ref: EventRef) => `${base(ref)}/agenda`,
  speakers: (ref: EventRef) => `${base(ref)}/speakers`,
  files: (ref: EventRef) => `${base(ref)}/files`,
  communications: (ref: EventRef) => `${base(ref)}/communications`,
  embeds: (ref: EventRef) => `${base(ref)}/embeds`,
  settings: (ref: EventRef) => `${base(ref)}/settings`,
  settingsSection: (
    ref: EventRef,
    section:
      | "rooms-and-tracks"
      | "statuses"
      | "fields-and-options"
      | "integrations"
      | "activity"
      | "api-mcp",
  ) => `${base(ref)}/settings/${section}`,
  section: (ref: EventRef, section: EventSection) => `${base(ref)}/${section}`,

  // ——— Workspace-scoped ————————————————————————————————————————————————
  workspaceHub: (workspaceSlug: string) => `/app/${workspaceSlug}/workspace`,

  // ——— Global (personal, or cross-workspace) ————————————————————————————
  app: "/app",
  account: "/app/account",
  copilot: "/app/copilot",
  events: "/app/events",
  workspaceHubFallback: "/app/workspace",
} as const

/**
 * LEGACY bare paths — the pre-hierarchy shape of each section, kept as real
 * routes that redirect through the stored event pointer. These are what link
 * producers fall back to while no event is resolvable yet (a brand-new
 * account, a still-loading list): the redirect route turns them into the
 * canonical address the moment one exists.
 */
export const legacyAppLink = {
  dashboard: "/app",
  submissions: "/app/submissions",
  forms: "/app/forms",
  evaluation: "/app/evaluation",
  agenda: "/app/agenda",
  speakers: "/app/speakers",
  files: "/app/files",
  communications: "/app/communications",
  embeds: "/app/embeds",
  settings: "/app/settings",
} as const

/** The workspace segment of a canonical `/app/:ws/…` pathname, if any. */
export function workspaceSlugFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/^\/app\/([^/]+)(?:\/|$)/)
  if (!match || STATIC_APP_SEGMENTS.has(match[1])) return undefined
  return match[1]
}

/**
 * The event named by a pathname, when it names one — `/app/:ws/:event/…`
 * parsed with the reserved-word guards. Pure and provider-free, so contexts
 * that can't reach the router or query client (copilot tool views, tests)
 * can still resolve the event in context from `window.location`.
 */
export function eventRefFromPathname(pathname: string): EventRef | undefined {
  const match = pathname.match(/^\/app\/([^/]+)\/([^/]+)(?:\/|$)/)
  if (!match) return undefined
  if (STATIC_APP_SEGMENTS.has(match[1])) return undefined
  // Static children of the workspace segment (the hub) name no event.
  if (match[2] === "workspace") return undefined
  return { workspaceSlug: match[1], eventSlug: match[2] }
}

/**
 * Where "the same place" is on ANOTHER event — what the event switcher
 * navigates to. Detail pages (a form's builder, an evaluation plan) belong to
 * the event they were opened on, so they fall back to their section's index;
 * settings keeps its subpage (every event has the same settings sections).
 * A pathname outside the event tree returns null: switching event on a global
 * page (account, copilot) moves the pointer, not the page.
 */
export function eventScopedPath(pathname: string, next: EventRef): string | null {
  const match = pathname.match(/^\/app\/([^/]+)\/[^/]+(\/.*)?$/)
  if (!match) return null
  // The static children of /app (account, the bare legacy sections, …) are
  // reserved workspace slugs, so a first segment naming one of them means
  // this is NOT the event tree — it is a legacy or global path mid-redirect.
  if (STATIC_APP_SEGMENTS.has(match[1])) return null
  const rest = (match[2] || "/").split("/").filter(Boolean)
  const section = rest[0] as EventSection | undefined
  if (!section || !EVENT_SECTIONS.includes(section)) return base(next)
  if (section === "settings") {
    return rest.length > 1
      ? `${base(next)}/settings/${rest.slice(1).join("/")}`
      : appLink.settings(next)
  }
  return appLink.section(next, section)
}
