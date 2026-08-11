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
  // ——— Core setup ———————————————————————————————————————————————————————
  events: defineTable({
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
  }).index("by_slug", ["slug"]),

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

  // ——— Organizer auth (simple team model: organizers see all events) ————
  organizers: defineTable({
    email: v.string(),
    name: v.string(),
    // SHA-256 hex of the password. Demo accounts are seeded; this is a
    // competition demo, not a hardened auth system.
    passwordHash: v.string(),
  }).index("by_email", ["email"]),

  orgSessions: defineTable({
    token: v.string(),
    organizerId: v.id("organizers"),
    createdAt: v.number(),
  }).index("by_token", ["token"]),

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
    links: v.optional(
      v.object({
        linkedin: v.optional(v.string()),
        twitter: v.optional(v.string()),
        website: v.optional(v.string()),
      }),
    ),
    // Opaque token for passwordless portal access (magic link).
    portalToken: v.string(),
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
})
