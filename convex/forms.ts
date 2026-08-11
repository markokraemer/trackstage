import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"

// Reusable validators mirroring the schema shapes (kept in sync manually —
// schema.ts is the source of truth).
const questionArg = v.object({
  id: v.string(),
  label: v.string(),
  type: v.string(),
  required: v.boolean(),
  enabled: v.boolean(),
  locked: v.boolean(),
  help: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  maxChars: v.optional(v.number()),
  showIf: v.optional(v.object({ questionId: v.string(), equals: v.string() })),
  isTrackQuestion: v.optional(v.boolean()),
})

const participantFieldArg = v.object({
  id: v.string(),
  label: v.string(),
  required: v.boolean(),
  enabled: v.boolean(),
  locked: v.boolean(),
  help: v.optional(v.string()),
})

const participantConfigArg = v.object({
  speakerMin: v.number(),
  speakerMax: v.number(),
  chairpersonEnabled: v.boolean(),
  moderatorEnabled: v.boolean(),
  fields: v.array(participantFieldArg),
  sendConfirmationEmail: v.boolean(),
})

const settingsArg = v.object({
  limitPerUser: v.optional(v.number()),
  allowDrafts: v.boolean(),
  successMessage: v.optional(v.string()),
  autoRedirectToPortal: v.boolean(),
  sendReminderEmail: v.boolean(),
})

function defaultQuestions() {
  return [
    { id: "title", label: "Title", type: "short_text", required: true, enabled: true, locked: true, maxChars: 200 },
    { id: "description", label: "Description", type: "rich_text", required: true, enabled: true, locked: true, maxChars: 5000 },
    { id: "format", label: "Format", type: "dropdown", required: true, enabled: true, locked: false, options: ["Talk", "Workshop", "Lightning Talk"] },
    { id: "track", label: "Track", type: "dropdown", required: true, enabled: true, locked: false, options: [], isTrackQuestion: true },
    { id: "level", label: "Level", type: "dropdown", required: false, enabled: true, locked: false, options: ["Introductory", "Intermediate", "Advanced"] },
    { id: "language", label: "Language", type: "dropdown", required: false, enabled: true, locked: false, options: ["English"] },
    { id: "tags", label: "Tags", type: "multi_select", required: false, enabled: true, locked: false, options: ["AI", "Infrastructure", "Product", "Open Source"] },
  ]
}

function defaultParticipantConfig() {
  return {
    // Deliberately 1 — swyx got trapped by Sessionboard's min-2 default.
    speakerMin: 1,
    speakerMax: 4,
    chairpersonEnabled: false,
    moderatorEnabled: false,
    sendConfirmationEmail: true,
    fields: [
      { id: "firstName", label: "First Name", required: true, enabled: true, locked: true },
      { id: "lastName", label: "Last Name", required: true, enabled: true, locked: true },
      { id: "email", label: "Email", required: true, enabled: true, locked: true },
      { id: "jobTitle", label: "Job Title", required: false, enabled: true, locked: false },
      { id: "company", label: "Company", required: false, enabled: true, locked: false },
      { id: "phone", label: "Mobile Phone", required: false, enabled: false, locked: false },
      { id: "bio", label: "Biography", required: false, enabled: true, locked: false },
      { id: "headshot", label: "Headshot", required: false, enabled: true, locked: false },
    ],
  }
}

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return await Promise.all(
      forms.map(async (form) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_formId", (q) => q.eq("formId", form._id))
          .collect()
        return {
          _id: form._id,
          internalName: form.internalName,
          externalTitle: form.externalTitle,
          slug: form.slug,
          kind: form.kind,
          status: form.status,
          closeAt: form.closeAt,
          submissionCount: submissions.filter((s) => s.status !== "draft").length,
          draftCount: submissions.filter((s) => s.status === "draft").length,
        }
      }),
    )
  },
})

export const get = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId)
    if (!form) throw new Error("Form not found")
    await requireEventAccess(ctx, form.eventId)
    return form
  },
})

export const create = mutation({
  args: {
    eventId: v.id("events"),
    internalName: v.string(),
    kind: v.string(), // abstract | session
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    if (!["abstract", "session"].includes(args.kind)) {
      throw new Error("kind must be abstract or session")
    }

    // Track question options default to the event's tracks.
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    const questions = defaultQuestions().map((question) =>
      question.isTrackQuestion
        ? { ...question, options: tracks.sort((a, b) => a.order - b.order).map((t) => t.name) }
        : question,
    )

    const base = args.internalName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "form"
    let slug = base
    for (let i = 2; ; i++) {
      const clash = await ctx.db
        .query("forms")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
      if (!clash) break
      slug = `${base}-${i}`
    }

    return await ctx.db.insert("forms", {
      eventId: args.eventId,
      slug,
      kind: args.kind,
      status: "open",
      internalName: args.internalName,
      externalTitle: args.internalName,
      pageHeading: "Call for Speakers",
      welcomeMessage:
        "<p>We'd love to hear from you! Tell us about the session you'd like to present.</p>",
      showWelcomeMessage: true,
      questions,
      participantConfig: defaultParticipantConfig(),
      settings: {
        allowDrafts: true,
        autoRedirectToPortal: true,
        sendReminderEmail: true,
        successMessage:
          "<p>Thank you for submitting to present at our event! We'll review your submission and get back to you soon.</p>",
      },
      notifyEmails: [],
    })
  },
})

export const update = mutation({
  args: {
    formId: v.id("forms"),
    patch: v.object({
      internalName: v.optional(v.string()),
      externalTitle: v.optional(v.string()),
      pageHeading: v.optional(v.string()),
      welcomeMessage: v.optional(v.string()),
      showWelcomeMessage: v.optional(v.boolean()),
      kind: v.optional(v.string()),
      status: v.optional(v.string()),
      closeAt: v.optional(v.union(v.number(), v.null())),
      questions: v.optional(v.array(questionArg)),
      participantConfig: v.optional(participantConfigArg),
      settings: v.optional(settingsArg),
      notifyEmails: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId)
    if (!form) throw new Error("Form not found")
    await requireEventAccess(ctx, form.eventId)

    const { closeAt, questions, status, ...rest } = args.patch
    if (status && !["open", "closed"].includes(status)) {
      throw new Error("status must be open or closed")
    }
    if (questions) {
      // Locked questions can be edited but never removed or disabled.
      for (const locked of form.questions.filter((q) => q.locked)) {
        const still = questions.find((q) => q.id === locked.id)
        if (!still || !still.enabled) {
          throw new Error(`The "${locked.label}" question is required and cannot be removed.`)
        }
      }
      // showIf must reference an existing, earlier question.
      const ids = questions.map((q) => q.id)
      for (const q of questions) {
        if (q.showIf) {
          const refIndex = ids.indexOf(q.showIf.questionId)
          if (refIndex === -1) throw new Error(`"${q.label}" has a condition referencing a deleted question.`)
          if (refIndex >= ids.indexOf(q.id)) {
            throw new Error(`"${q.label}" can only depend on a question that comes before it.`)
          }
        }
      }
    }

    await ctx.db.patch(args.formId, {
      ...rest,
      ...(status ? { status } : {}),
      ...(questions ? { questions } : {}),
      ...(closeAt !== undefined ? { closeAt: closeAt ?? undefined } : {}),
    })
    return null
  },
})

export const duplicate = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId)
    if (!form) throw new Error("Form not found")
    await requireEventAccess(ctx, form.eventId)
    const { _id, _creationTime, slug, internalName, ...rest } = form
    let copySlug = `${slug}-copy`
    for (let i = 2; ; i++) {
      const clash = await ctx.db
        .query("forms")
        .withIndex("by_slug", (q) => q.eq("slug", copySlug))
        .unique()
      if (!clash) break
      copySlug = `${slug}-copy-${i}`
    }
    return await ctx.db.insert("forms", {
      ...rest,
      slug: copySlug,
      internalName: `${internalName} (copy)`,
    })
  },
})

export const remove = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId)
    if (!form) throw new Error("Form not found")
    await requireEventAccess(ctx, form.eventId, "admin")
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_formId", (q) => q.eq("formId", args.formId))
      .first()
    if (existing) {
      throw new Error(
        "This form has submissions. Close it instead of deleting it.",
      )
    }
    await ctx.db.delete(args.formId)
    return null
  },
})
