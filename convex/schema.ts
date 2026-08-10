import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Domain model for the open-source Sessionboard replacement.
// Flow: event → CFP form → submission → review/decision → speaker onboarding
//       → session scheduled on the agenda → published program.
export default defineSchema({
  events: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()), // ISO date, event-local
    endDate: v.optional(v.string()),
    timezone: v.string(),
    venue: v.optional(v.string()),
  }).index("by_slug", ["slug"]),

  // A call-for-speakers form. Fields are ordered and support conditional
  // visibility plus category-based routing to a track. The field list is
  // bounded (an organizer authors tens of fields), so it lives inline.
  forms: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    slug: v.string(),
    isOpen: v.boolean(),
    closesAt: v.optional(v.number()),
    intro: v.optional(v.string()),
    successMessage: v.optional(v.string()),
    fields: v.array(
      v.object({
        id: v.string(),
        type: v.string(), // text | textarea | select | multiselect | email | url | file | checkbox
        label: v.string(),
        help: v.optional(v.string()),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
        // Show only when another field's answer matches.
        showIf: v.optional(
          v.object({ fieldId: v.string(), equals: v.string() }),
        ),
        // Answering with one of these values routes the submission to a track.
        routesToTrack: v.optional(v.id("tracks")),
      }),
    ),
  })
    .index("by_eventId", ["eventId"])
    .index("by_slug", ["slug"]),

  speakers: defineTable({
    eventId: v.id("events"),
    email: v.string(),
    name: v.string(),
    bio: v.optional(v.string()),
    headshotId: v.optional(v.id("_storage")),
    company: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    links: v.optional(v.record(v.string(), v.string())),
    // Opaque token for passwordless portal access.
    portalToken: v.string(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_email", ["eventId", "email"])
    .index("by_portalToken", ["portalToken"]),

  submissions: defineTable({
    eventId: v.id("events"),
    formId: v.id("forms"),
    primarySpeakerId: v.id("speakers"),
    coSpeakerIds: v.array(v.id("speakers")),
    title: v.string(),
    abstract: v.optional(v.string()),
    // Answers keyed by form field id; shape is defined by the form, not the schema.
    answers: v.record(v.string(), v.any()),
    category: v.optional(v.string()),
    trackId: v.optional(v.id("tracks")),
    status: v.string(), // draft | submitted | in_review | accepted | waitlisted | declined | withdrawn
    decidedAt: v.optional(v.number()),
    notifiedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_status", ["eventId", "status"])
    .index("by_primarySpeakerId", ["primarySpeakerId"]),

  reviews: defineTable({
    submissionId: v.id("submissions"),
    eventId: v.id("events"),
    round: v.number(),
    reviewerEmail: v.string(),
    score: v.optional(v.number()),
    vote: v.optional(v.string()), // approve | maybe | deny
    comment: v.optional(v.string()),
  })
    .index("by_submissionId", ["submissionId"])
    .index("by_eventId", ["eventId"]),

  rooms: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    capacity: v.optional(v.number()),
    order: v.number(),
  }).index("by_eventId", ["eventId"]),

  tracks: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    color: v.optional(v.string()),
  }).index("by_eventId", ["eventId"]),

  // A scheduled (or not-yet-scheduled) program item.
  sessions: defineTable({
    eventId: v.id("events"),
    submissionId: v.optional(v.id("submissions")),
    title: v.string(),
    description: v.optional(v.string()),
    speakerIds: v.array(v.id("speakers")),
    roomId: v.optional(v.id("rooms")),
    trackId: v.optional(v.id("tracks")),
    startsAt: v.optional(v.number()), // epoch ms; unscheduled when absent
    durationMinutes: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_roomId", ["roomId"]),

  // Onboarding checklist items driving the real-time organizer dashboard.
  tasks: defineTable({
    eventId: v.id("events"),
    speakerId: v.id("speakers"),
    title: v.string(),
    kind: v.string(), // profile | headshot | slides | confirm | form | custom
    formId: v.optional(v.id("forms")),
    dueAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_speakerId", ["speakerId"]),

  uploads: defineTable({
    eventId: v.id("events"),
    speakerId: v.id("speakers"),
    taskId: v.optional(v.id("tasks")),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.optional(v.string()),
  }).index("by_speakerId", ["speakerId"]),

  emailTemplates: defineTable({
    eventId: v.id("events"),
    key: v.string(), // accepted | declined | waitlisted | reminder | custom
    name: v.string(),
    subject: v.string(),
    body: v.string(), // supports {{speakerName}}, {{sessionTitle}}, … placeholders
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_key", ["eventId", "key"]),

  // Outbox: scheduled + sent speaker communications.
  messages: defineTable({
    eventId: v.id("events"),
    speakerId: v.id("speakers"),
    templateKey: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    // Attach a calendar invite (.ics) for the speaker's session.
    sessionId: v.optional(v.id("sessions")),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    status: v.string(), // scheduled | sent | failed
    error: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_status", ["status"]),
})
