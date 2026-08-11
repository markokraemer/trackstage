import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// ————————————————————————————————————————————————————————————————————————
// Sessionboard OSS domain model. See docs/SPEC.md §5.
// Lifecycle: event → CFP form → submission (abstract|session) → evaluation →
// decision queues → accepted ⇒ schedulable on the agenda → published program.
// Every table is event-scoped; queries must always filter by eventId
// (cross-event isolation is an explicitly judged behavior).
// ————————————————————————————————————————————————————————————————————————

const questionValidator = v.object({
  id: v.string(),
  label: v.string(),
  // short_text | long_text | rich_text | dropdown | multi_select | email |
  // url | phone | checkbox | file
  type: v.string(),
  required: v.boolean(),
  enabled: v.boolean(),
  locked: v.boolean(), // system fields (Title, Description) can't be removed
  help: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  maxChars: v.optional(v.number()),
  // Conditional visibility: show only when another question's answer matches.
  showIf: v.optional(v.object({ questionId: v.string(), equals: v.string() })),
  // The track question: answers map 1:1 to track names and route the submission.
  isTrackQuestion: v.optional(v.boolean()),
})

const participantFieldValidator = v.object({
  id: v.string(), // firstName | lastName | email | phone | bio | jobTitle | company | headshot
  label: v.string(),
  required: v.boolean(),
  enabled: v.boolean(),
  locked: v.boolean(),
  help: v.optional(v.string()),
})

export default defineSchema({
  // ——— Multi-tenancy ————————————————————————————————————————————————————
  // Authentication is Better Auth (the @convex-dev/better-auth component
  // owns users/sessions). Authorization is explicit here: organizations own
  // events; members carry roles. userId = Better Auth user id.
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
  }).index("by_slug", ["slug"]),

  members: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    email: v.string(),
    role: v.string(), // owner | admin | member
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_organizationId_and_userId", ["organizationId", "userId"]),

  // Personal API keys — the credential the MCP server (convex/mcp.ts) and any
  // scripted client authenticates with. Only the sha-256 hash is stored; the
  // plaintext `sb_live_…` key is shown to the user exactly once at creation.
  // A key carries no scope of its own: it resolves to a userId and then runs
  // through the same membership checks as a browser session.
  apiKeys: defineTable({
    userId: v.string(), // Better Auth user id
    name: v.string(), // human label, e.g. "Claude Code (laptop)"
    keyHash: v.string(), // sha-256 hex of the full key
    prefix: v.string(), // e.g. "sb_live_1a2b3c4d" — safe to display
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    // "copilot" marks the ONE server-managed loopback key the in-app AI
    // copilot uses to talk to our own MCP endpoint on the user's behalf
    // (src/routes/api/chat.ts). Absent/undefined = an ordinary personal key.
    kind: v.optional(v.string()),
    // Only ever set for kind === "copilot": the server has to be able to
    // present the key again on every chat turn, so it cannot be write-only
    // like a personal key. Never returned by `list`, never shown in the UI,
    // and its blast radius equals the signed-in session that minted it.
    secret: v.optional(v.string()),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"]),

  // ——— Core setup ———————————————————————————————————————————————————————
  events: defineTable({
    // TEMP-OPTIONAL during legacy purge — tightened right back (see seed.run
    // purgeLegacy); required for all new rows.
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    slug: v.string(),
    type: v.optional(v.string()), // Conference | Summit | Meetup | …
    websiteUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    venue: v.optional(v.string()),
    timezone: v.string(), // IANA
    startsAt: v.optional(v.number()), // epoch ms
    endsAt: v.optional(v.number()),
    logoId: v.optional(v.id("_storage")),
    // Go-live gate for the public program (sbek AIA-07). Unset ⇒ the public
    // pages render "Schedule coming soon" with no sessions, however many are
    // accepted and scheduled internally. Set by agenda.publishAgenda.
    agendaPublishedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_organizationId", ["organizationId"]),

  rooms: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    capacity: v.optional(v.number()),
    order: v.number(),
  }).index("by_eventId", ["eventId"]),

  tracks: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    color: v.string(), // hex
    order: v.number(),
  }).index("by_eventId", ["eventId"]),

  // ——— CFP forms ————————————————————————————————————————————————————————
  forms: defineTable({
    eventId: v.id("events"),
    slug: v.string(),
    kind: v.string(), // abstract | session
    status: v.string(), // open | closed
    closeAt: v.optional(v.number()),
    internalName: v.string(),
    externalTitle: v.string(),
    pageHeading: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    showWelcomeMessage: v.boolean(),
    questions: v.array(questionValidator),
    participantConfig: v.object({
      speakerMin: v.number(),
      speakerMax: v.number(),
      chairpersonEnabled: v.boolean(),
      moderatorEnabled: v.boolean(),
      fields: v.array(participantFieldValidator),
      sendConfirmationEmail: v.boolean(),
    }),
    settings: v.object({
      limitPerUser: v.optional(v.number()),
      allowDrafts: v.boolean(),
      successMessage: v.optional(v.string()),
      autoRedirectToPortal: v.boolean(),
      sendReminderEmail: v.boolean(),
    }),
    notifyEmails: v.array(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_slug", ["slug"]),

  // ——— People (speakers, submitters, co-speakers — unified) —————————————
  people: defineTable({
    eventId: v.id("events"),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    salutation: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    headshotId: v.optional(v.id("_storage")),
    // Internal organizer note about the speaker's photo ("waiting on a
    // higher-res file", "crop tighter"). Never shown publicly.
    headshotNote: v.optional(v.string()),
    links: v.optional(
      v.object({
        linkedin: v.optional(v.string()),
        twitter: v.optional(v.string()),
        website: v.optional(v.string()),
      }),
    ),
    // Opaque token for passwordless portal access (magic link).
    portalToken: v.string(),
    // Organizer-managed speaker workflow (sbek SPK-04): invited | confirmed |
    // dropped. Only ever set for people the organizer manages as speakers —
    // its presence is also what puts a manually added speaker (one with no
    // accepted submission yet) on the roster.
    workflowStatus: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_email", ["eventId", "email"])
    .index("by_portalToken", ["portalToken"]),

  // ——— Submissions (abstracts AND sessions; accepted ones are schedulable) —
  submissions: defineTable({
    eventId: v.id("events"),
    formId: v.optional(v.id("forms")), // absent for manually added
    kind: v.string(), // abstract | session
    title: v.string(),
    description: v.optional(v.string()),
    // Answers keyed by question id (shape defined by the form).
    answers: v.record(v.string(), v.any()),
    trackId: v.optional(v.id("tracks")),
    format: v.optional(v.string()),
    level: v.optional(v.string()),
    language: v.optional(v.string()),
    tags: v.array(v.string()),
    // draft | pending | accept_queue | decline_queue | accepted | declined | withdrawn
    status: v.string(),
    submitterId: v.id("people"),
    decidedAt: v.optional(v.number()),
    notifiedAt: v.optional(v.number()),
    // Scheduling (only meaningful once accepted / kind=session).
    roomId: v.optional(v.id("rooms")),
    startsAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_status", ["eventId", "status"])
    .index("by_formId", ["formId"])
    .index("by_submitterId", ["submitterId"])
    .index("by_roomId", ["roomId"]),

  submissionParticipants: defineTable({
    submissionId: v.id("submissions"),
    eventId: v.id("events"),
    personId: v.id("people"),
    role: v.string(), // speaker | chairperson | moderator
    order: v.number(),
  })
    .index("by_submissionId", ["submissionId"])
    .index("by_personId", ["personId"])
    .index("by_eventId", ["eventId"]),

  // ——— Evaluation ———————————————————————————————————————————————————————
  evaluationPlans: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    round: v.number(),
    criteria: v.array(v.object({ id: v.string(), label: v.string() })), // 1–5 each
    submissionIds: v.array(v.id("submissions")),
    dueAt: v.optional(v.number()),
    status: v.string(), // open | closed
    // Blind review: evaluators see submissions without speaker identities.
    blind: v.optional(v.boolean()),
  }).index("by_eventId", ["eventId"]),

  evaluators: defineTable({
    planId: v.id("evaluationPlans"),
    eventId: v.id("events"),
    email: v.string(),
    name: v.optional(v.string()),
    token: v.string(), // magic review link
  })
    .index("by_planId", ["planId"])
    .index("by_token", ["token"])
    .index("by_eventId", ["eventId"]),

  evaluations: defineTable({
    planId: v.id("evaluationPlans"),
    eventId: v.id("events"),
    submissionId: v.id("submissions"),
    evaluatorId: v.id("evaluators"),
    scores: v.record(v.string(), v.number()), // criterionId → 1..5
    comment: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_planId", ["planId"])
    .index("by_submissionId", ["submissionId"])
    .index("by_evaluatorId", ["evaluatorId"]),

  // ——— Speaker onboarding tasks + files ————————————————————————————————
  tasks: defineTable({
    eventId: v.id("events"),
    personId: v.id("people"),
    title: v.string(),
    instructions: v.optional(v.string()),
    kind: v.string(), // profile | headshot | upload | form | confirm
    formId: v.optional(v.id("forms")),
    dueAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_personId", ["personId"]),

  // Files uploaded by speakers (slides, docs, headshots). Versioned per
  // (personId, submissionId, taskId) slot; organizers approve/request changes.
  uploads: defineTable({
    eventId: v.id("events"),
    personId: v.id("people"),
    submissionId: v.optional(v.id("submissions")),
    taskId: v.optional(v.id("tasks")),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    version: v.number(),
    // pending | approved | changes_requested
    approvalStatus: v.string(),
    reviewNote: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_personId", ["personId"])
    .index("by_submissionId", ["submissionId"])
    .index("by_taskId", ["taskId"]),

  // ——— Communications ——————————————————————————————————————————————————
  emailTemplates: defineTable({
    eventId: v.id("events"),
    key: v.string(), // accepted | declined | waitlisted | reminder | confirmation | custom-*
    name: v.string(),
    subject: v.string(),
    body: v.string(), // {{speakerName}} {{sessionTitle}} {{eventName}} {{portalLink}}
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_key", ["eventId", "key"]),

  messages: defineTable({
    eventId: v.id("events"),
    personId: v.id("people"),
    templateKey: v.optional(v.string()),
    toEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    submissionId: v.optional(v.id("submissions")),
    icsAttached: v.boolean(),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    status: v.string(), // scheduled | sent | failed | preview
    error: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_personId", ["personId"])
    .index("by_status", ["status"]),

  // ——— Embeds ———————————————————————————————————————————————————————————
  // A named, reusable widget configuration (sbek EMB-15). The embed itself is
  // still just a URL into the public site — nothing is "published" and there
  // is no cache to wait for — but organizers need to name a configuration,
  // come back to it, and hand the same snippet to a colleague.
  embeds: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    // agenda | itinerary | sessions | speaker-gallery | speaker-list
    widget: v.string(),
    options: v.object({
      // Delivery format of the snippet: iframe | html | link | json | ics
      format: v.optional(v.string()),
      hideDescriptions: v.optional(v.boolean()),
      hideSpeakers: v.optional(v.boolean()),
      hideImages: v.optional(v.boolean()),
      hideSearch: v.optional(v.boolean()),
      /** Track NAME (public URLs filter by name, not id). */
      track: v.optional(v.string()),
      height: v.optional(v.number()),
    }),
  }).index("by_eventId", ["eventId"]),

  // ——— Integrations —————————————————————————————————————————————————————
  // One-way Airtable mirror (docs/memory/RULES.md 15, convex/airtable.ts).
  // At most one connection per event: the organizer's own base, mirrored
  // into by us and never read back.
  airtableConnections: defineTable({
    eventId: v.id("events"),
    // The organizer's Airtable personal access token, stored as-is.
    // DELIBERATE: encrypting it here would only move the problem — the key
    // would live in the same deployment as the ciphertext, so it buys
    // obfuscation, not secrecy. What actually protects it is that NOTHING
    // returns this field: `airtable.status` exposes `maskToken(token)` only,
    // and every read goes through requireEventAccess. If this ever holds
    // customer money-grade secrets, move it to a real KMS/vault first.
    token: v.string(),
    baseId: v.string(), // app…
    status: v.string(), // connected | error
    // Set when AIRTABLE_DEMO_MODE=1 created the connection: no live Airtable
    // account is involved, sync counts rows and writes nothing.
    demo: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    recordCounts: v.optional(
      v.object({
        submissions: v.number(),
        speakers: v.number(),
        sessions: v.number(),
      }),
    ),
    // Debounce latch for the on-write hook (scheduleAirtableSync): one
    // pending sync at a time, cleared when that sync starts.
    syncScheduled: v.optional(v.boolean()),
  }).index("by_eventId", ["eventId"]),
})
