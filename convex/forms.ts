import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { record as recordAudit } from "./lib/audit"
import {
  formSlugIsFree,
  isValidSlug,
  slugify,
  suggestFormSlug,
  uniqueFormSlug,
  workspaceSlugForEvent,
} from "./lib/publicLinks"

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
    const { event } = await requireEventAccess(ctx, args.eventId)
    const workspaceSlug = await workspaceSlugForEvent(ctx, event)
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return await Promise.all(
      forms.map(async (form) => {
        const submissions = (
          await ctx.db
            .query("submissions")
            .withIndex("by_formId", (q) => q.eq("formId", form._id))
            .collect()
        ).filter((s) => s.deletedAt === undefined)
        return {
          _id: form._id,
          internalName: form.internalName,
          externalTitle: form.externalTitle,
          slug: form.slug,
          // The canonical public link is `/submit/:ws/:event/:form`, so
          // every list row carries both parent segments and no caller ever
          // has to stitch one together from a second query.
          eventSlug: event.slug,
          workspaceSlug,
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
    const { event } = await requireEventAccess(ctx, form.eventId)
    // Both parent slugs ride along so the builder can render the canonical
    // public URL without a second round trip (docs/memory/DECISIONS.md).
    return {
      ...form,
      eventSlug: event.slug,
      workspaceSlug: await workspaceSlugForEvent(ctx, event),
    }
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

    // Unique WITHIN THIS EVENT — "cfp" is available to every organizer
    // (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical").
    const slug = await uniqueFormSlug(ctx, args.eventId, args.internalName)

    const formId = await ctx.db.insert("forms", {
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
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "form",
      entityId: formId,
      action: "created",
      summary: `Form created · ${args.internalName}`,
      meta: { kind: args.kind, slug },
    })
    return formId
  },
})

export const update = mutation({
  args: {
    formId: v.id("forms"),
    patch: v.object({
      /**
       * The public address, editable (Form builder → Setup → Public link).
       * Unique per event; a clash is REFUSED with a suggestion rather than
       * silently re-pointed, because the organizer may already have printed it.
       */
      slug: v.optional(v.string()),
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

    const { closeAt, questions, status, slug, ...rest } = args.patch
    if (status && !["open", "closed"].includes(status)) {
      throw new Error("status must be open or closed")
    }

    // ——— Public address —————————————————————————————————————————————————
    // Sent only when the organizer actually edits the link, so an autosave of
    // the rest of the form can never trip the uniqueness check.
    let nextSlug: string | undefined
    if (slug !== undefined) {
      const cleaned = slugify(slug, "")
      if (!cleaned || !isValidSlug(cleaned)) {
        throw new Error(
          "A web address needs at least one letter or number — use lowercase letters, numbers and dashes.",
        )
      }
      if (cleaned !== form.slug) {
        const free = await formSlugIsFree(ctx, form.eventId, cleaned, form._id)
        if (!free) {
          const suggestion = await suggestFormSlug(
            ctx,
            form.eventId,
            cleaned,
            form._id,
          )
          throw new Error(
            `That address is already taken for this event. Try “${suggestion}” instead.`,
          )
        }
        nextSlug = cleaned
      }
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
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(status ? { status } : {}),
      ...(questions ? { questions } : {}),
      ...(closeAt !== undefined ? { closeAt: closeAt ?? undefined } : {}),
    })

    // Opening/closing a form and moving its deadline are the edits that change
    // what the PUBLIC sees, so they get their own sentence; everything else is
    // recorded as a field list.
    const changed = Object.keys(args.patch)
    const headline =
      status && status !== form.status
        ? `Form ${status === "open" ? "opened" : "closed"} · ${form.internalName}`
        : nextSlug
          ? `Public link changed to /${nextSlug} · ${form.internalName}`
          : closeAt !== undefined && (closeAt ?? undefined) !== form.closeAt
            ? `Close date ${closeAt ? "set" : "cleared"} · ${form.internalName}`
            : `Form updated (${changed.join(", ")}) · ${form.internalName}`
    await recordAudit(ctx, {
      eventId: form.eventId,
      entity: "form",
      entityId: args.formId,
      action: status && status !== form.status ? "status_changed" : "updated",
      summary: headline,
      meta: {
        fields: changed,
        ...(status ? { status, previousStatus: form.status } : {}),
        ...(nextSlug ? { slug: nextSlug, previousSlug: form.slug } : {}),
        ...(closeAt !== undefined ? { closeAt: closeAt ?? "cleared" } : {}),
      },
    })
    // The slug that is actually live now, so the builder can echo the canonical
    // URL back without waiting for the reactive query to land.
    return { slug: nextSlug ?? form.slug }
  },
})

export const duplicate = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId)
    if (!form) throw new Error("Form not found")
    await requireEventAccess(ctx, form.eventId)
    const { _id, _creationTime, slug, internalName, ...rest } = form
    // Per-event namespace, same as create.
    const copySlug = await uniqueFormSlug(ctx, form.eventId, `${slug}-copy`)
    const copyId = await ctx.db.insert("forms", {
      ...rest,
      slug: copySlug,
      internalName: `${internalName} (copy)`,
    })
    await recordAudit(ctx, {
      eventId: form.eventId,
      entity: "form",
      entityId: copyId,
      action: "duplicated",
      summary: `Form duplicated from “${internalName}”`,
      meta: { sourceFormId: _id, slug: copySlug },
    })
    return copyId
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
    await recordAudit(ctx, {
      eventId: form.eventId,
      entity: "form",
      entityId: args.formId,
      action: "deleted",
      summary: `Form deleted · ${form.internalName}`,
      meta: { slug: form.slug, kind: form.kind },
    })
    return null
  },
})
