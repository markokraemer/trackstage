import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { scheduleAirtableSync } from "./airtable"
import { emitWebhook } from "./webhooks"
import { randomToken } from "./lib/auth"
import { notifySubmissionAdmins } from "./platformEmails"

// ————————————————————————————————————————————————————————————————————————
// Public CFP submission flow. Token model: the Account step identifies the
// submitter by email and returns their portalToken (magic auth — no
// passwords, per docs/memory/DECISIONS.md). All subsequent public calls
// authenticate with that token.
// ————————————————————————————————————————————————————————————————————————

const participantArg = v.object({
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  role: v.string(), // speaker | chairperson | moderator
  jobTitle: v.optional(v.string()),
  company: v.optional(v.string()),
  phone: v.optional(v.string()),
  bio: v.optional(v.string()),
})

function isFormOpen(form: Doc<"forms">): { open: boolean; reason?: string } {
  if (form.status !== "open") {
    return { open: false, reason: "This call for speakers is closed." }
  }
  if (form.closeAt && Date.now() > form.closeAt) {
    return {
      open: false,
      reason: "The submission deadline for this form has passed.",
    }
  }
  return { open: true }
}

/** Questions actually visible given current answers (conditional logic). */
function visibleQuestions(
  form: Doc<"forms">,
  answers: Record<string, unknown>,
) {
  return form.questions.filter((q) => {
    if (!q.enabled) return false
    if (!q.showIf) return true
    return answers[q.showIf.questionId] === q.showIf.equals
  })
}

export const getForm = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!form) return null
    const event = await ctx.db.get(form.eventId)
    if (!event) return null
    const openState = isFormOpen(form)
    return {
      formId: form._id,
      event: {
        name: event.name,
        slug: event.slug,
        venue: event.venue,
        timezone: event.timezone,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      },
      externalTitle: form.externalTitle,
      pageHeading: form.pageHeading,
      welcomeMessage: form.showWelcomeMessage ? form.welcomeMessage : undefined,
      kind: form.kind,
      open: openState.open,
      closedReason: openState.reason,
      closeAt: form.closeAt,
      limitPerUser: form.settings.limitPerUser,
      allowDrafts: form.settings.allowDrafts,
      successMessage: form.settings.successMessage,
      autoRedirectToPortal: form.settings.autoRedirectToPortal,
      questions: form.questions.filter((q) => q.enabled),
      participantConfig: {
        speakerMin: form.participantConfig.speakerMin,
        speakerMax: form.participantConfig.speakerMax,
        chairpersonEnabled: form.participantConfig.chairpersonEnabled,
        moderatorEnabled: form.participantConfig.moderatorEnabled,
        fields: form.participantConfig.fields.filter((f) => f.enabled),
      },
    }
  },
})

/**
 * Profile fields a submission form may carry for a participant. Everything
 * else on `people` (portal token, headshot, links, workflow status) belongs to
 * the person and is never touched by someone else's submission.
 */
const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "jobTitle",
  "company",
  "phone",
  "bio",
] as const
type ProfileField = (typeof PROFILE_FIELDS)[number]
type ProfileInput = Partial<Record<ProfileField, string | undefined>>

const isBlank = (value: unknown): boolean =>
  typeof value !== "string" || value.trim() === ""

/**
 * Unique Contact Settings, the correctness half (product map §2.2, delta #9).
 *
 * A contact who already has a profile OWNS it. When a *later* submission names
 * the same co-speaker — a repeat speaker across two talks, a colleague guessing
 * their bio — whatever the submitter typed may only fill fields that are still
 * empty. It can never overwrite a value the speaker wrote in their portal (or
 * an earlier, more complete submission wrote for them), which is exactly the
 * silent-overwrite bug this closes.
 *
 * `mode: "own"` is the opposite case: a person editing their OWN row (the
 * submitter's contact step, their own participant entry). That is their data,
 * typed by them, so it wins — subject only to "never blank out", since the form
 * may not have collected a field at all.
 */
function profilePatch(
  person: Doc<"people">,
  incoming: ProfileInput,
  mode: "own" | "existing-contact",
): ProfileInput {
  const patch: ProfileInput = {}
  for (const field of PROFILE_FIELDS) {
    const value = incoming[field]?.trim()
    if (!value) continue // never blank out what's already there
    if (mode === "existing-contact" && !isBlank(person[field])) continue
    if (person[field] === value) continue
    patch[field] = value
  }
  return patch
}

async function getOrCreatePerson(
  ctx: MutationCtx,
  eventId: Id<"events">,
  email: string,
  firstName?: string,
  lastName?: string,
) {
  const normalized = email.toLowerCase().trim()
  const existing = await ctx.db
    .query("people")
    .withIndex("by_eventId_and_email", (q) =>
      q.eq("eventId", eventId).eq("email", normalized),
    )
    .unique()
  if (existing) return existing
  const id = await ctx.db.insert("people", {
    eventId,
    email: normalized,
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    portalToken: randomToken(),
  })
  const person = await ctx.db.get(id)
  if (!person) throw new Error("Failed to create account")
  return person
}

// Account step: identify by email. Returns the portal token (demo-friendly
// magic auth) plus any drafts so the user can resume.
export const identify = mutation({
  args: { slug: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email.trim())) {
      throw new Error("Please enter a valid email address.")
    }
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!form) throw new Error("Form not found")
    const person = await getOrCreatePerson(ctx, form.eventId, args.email)
    const drafts = await ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", person._id))
      .collect()
    return {
      portalToken: person.portalToken,
      firstName: person.firstName,
      lastName: person.lastName,
      drafts: drafts
        .filter((s) => s.formId === form._id && s.status === "draft")
        .map((s) => ({ id: s._id, title: s.title })),
    }
  },
})

async function validateSubmission(
  _ctx: MutationCtx,
  form: Doc<"forms">,
  answers: Record<string, unknown>,
  participants: Array<{
    firstName: string
    lastName: string
    email: string
    role: string
  }>,
) {
  const missing: string[] = []
  for (const q of visibleQuestions(form, answers)) {
    if (!q.required) continue
    const value = answers[q.id]
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    if (empty) missing.push(q.label)
  }
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`)
  }

  const speakers = participants.filter((p) => p.role === "speaker")
  const { speakerMin, speakerMax } = form.participantConfig
  if (speakers.length < speakerMin) {
    throw new Error(
      `At least ${speakerMin} speaker${speakerMin === 1 ? "" : "s"} required.`,
    )
  }
  if (speakers.length > speakerMax) {
    throw new Error(`At most ${speakerMax} speakers allowed.`)
  }
  for (const p of participants) {
    if (!p.firstName.trim() || !p.lastName.trim()) {
      throw new Error("Every participant needs a first and last name.")
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) {
      throw new Error(`Invalid email for ${p.firstName || "participant"}.`)
    }
  }

  // Required participant fields beyond the basics.
  const requiredFields = form.participantConfig.fields.filter(
    (f) => f.enabled && f.required && !["firstName", "lastName", "email"].includes(f.id),
  )
  for (const field of requiredFields) {
    for (const p of participants as Array<Record<string, unknown>>) {
      const value = p[field.id]
      if (value === undefined || (typeof value === "string" && value.trim() === "")) {
        throw new Error(`"${field.label}" is required for every participant.`)
      }
    }
  }
}

async function resolveTrackId(
  ctx: MutationCtx,
  form: Doc<"forms">,
  answers: Record<string, unknown>,
): Promise<Id<"tracks"> | undefined> {
  const trackQuestion = form.questions.find((q) => q.isTrackQuestion && q.enabled)
  if (!trackQuestion) return undefined
  const answer = answers[trackQuestion.id]
  if (typeof answer !== "string" || !answer) return undefined
  const tracks = await ctx.db
    .query("tracks")
    .withIndex("by_eventId", (q) => q.eq("eventId", form.eventId))
    .collect()
  return tracks.find((t) => t.name === answer)?._id
}

async function upsertParticipants(
  ctx: MutationCtx,
  form: Doc<"forms">,
  submissionId: Id<"submissions">,
  participants: Array<{
    firstName: string
    lastName: string
    email: string
    role: string
    jobTitle?: string
    company?: string
    phone?: string
    bio?: string
  }>,
  /** The signed-in submitter — the one participant row that is self-entered. */
  submitterId: Id<"people">,
) {
  // Replace the participant set (used on draft update + final submit).
  const existing = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
    .collect()
  for (const row of existing) await ctx.db.delete(row._id)

  for (const [index, p] of participants.entries()) {
    const person = await getOrCreatePerson(
      ctx,
      form.eventId,
      p.email,
      p.firstName,
      p.lastName,
    )
    // Fill the profile in, but never speak over the contact themselves: only
    // the submitter's own row may change values that are already set (see
    // `profilePatch`). Everyone else's is fill-the-blanks only.
    const patch = profilePatch(
      person,
      {
        firstName: p.firstName,
        lastName: p.lastName,
        jobTitle: p.jobTitle,
        company: p.company,
        phone: p.phone,
        bio: p.bio,
      },
      person._id === submitterId ? "own" : "existing-contact",
    )
    if (Object.keys(patch).length > 0) await ctx.db.patch(person._id, patch)
    await ctx.db.insert("submissionParticipants", {
      submissionId,
      eventId: form.eventId,
      personId: person._id,
      role: p.role,
      order: index,
    })
  }
}

export const saveDraft = mutation({
  args: {
    slug: v.string(),
    portalToken: v.string(),
    draftId: v.optional(v.id("submissions")),
    title: v.string(),
    answers: v.record(v.string(), v.any()),
    participants: v.array(participantArg),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!form) throw new Error("Form not found")
    if (!form.settings.allowDrafts) throw new Error("Drafts are not allowed on this form.")
    const openState = isFormOpen(form)
    if (!openState.open) throw new Error(openState.reason)

    const person = await ctx.db
      .query("people")
      .withIndex("by_portalToken", (q) => q.eq("portalToken", args.portalToken))
      .unique()
    if (!person || person.eventId !== form.eventId) {
      throw new Error("Session expired — please re-enter your email.")
    }

    const trackId = await resolveTrackId(ctx, form, args.answers)
    const fields = {
      title: args.title || "Untitled draft",
      description: typeof args.answers.description === "string" ? args.answers.description : undefined,
      answers: args.answers,
      trackId,
      format: typeof args.answers.format === "string" ? args.answers.format : undefined,
      level: typeof args.answers.level === "string" ? args.answers.level : undefined,
      language: typeof args.answers.language === "string" ? args.answers.language : undefined,
      tags: Array.isArray(args.answers.tags) ? (args.answers.tags as string[]) : [],
    }

    let submissionId: Id<"submissions">
    if (args.draftId) {
      const draft = await ctx.db.get(args.draftId)
      if (!draft || draft.submitterId !== person._id || draft.status !== "draft") {
        throw new Error("Draft not found")
      }
      await ctx.db.patch(args.draftId, fields)
      submissionId = args.draftId
    } else {
      submissionId = await ctx.db.insert("submissions", {
        eventId: form.eventId,
        formId: form._id,
        kind: form.kind,
        status: "draft",
        submitterId: person._id,
        ...fields,
      })
    }
    await upsertParticipants(ctx, form, submissionId, args.participants, person._id)
    return { draftId: submissionId }
  },
})

export const submit = mutation({
  args: {
    slug: v.string(),
    portalToken: v.string(),
    draftId: v.optional(v.id("submissions")),
    title: v.string(),
    answers: v.record(v.string(), v.any()),
    participants: v.array(participantArg),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!form) throw new Error("Form not found")
    const openState = isFormOpen(form)
    if (!openState.open) throw new Error(openState.reason)

    const person = await ctx.db
      .query("people")
      .withIndex("by_portalToken", (q) => q.eq("portalToken", args.portalToken))
      .unique()
    if (!person || person.eventId !== form.eventId) {
      throw new Error("Session expired — please re-enter your email.")
    }

    // Per-user submission limit (drafts don't count).
    if (form.settings.limitPerUser) {
      const mine = await ctx.db
        .query("submissions")
        .withIndex("by_submitterId", (q) => q.eq("submitterId", person._id))
        .collect()
      // KI-2: the builder copy promises the cap counts saved drafts too —
      // count everything on this form except the draft being promoted now.
      const submitted = mine.filter(
        (s) => s.formId === form._id && s._id !== args.draftId,
      )
      if (submitted.length >= form.settings.limitPerUser) {
        throw new Error(
          `You've reached the limit of ${form.settings.limitPerUser} submissions for this form.`,
        )
      }
    }

    if (!args.title.trim()) throw new Error("Missing required fields: Title")
    await validateSubmission(ctx, form, args.answers, args.participants)
    const trackId = await resolveTrackId(ctx, form, args.answers)

    const fields = {
      title: args.title.trim(),
      description:
        typeof args.answers.description === "string" ? args.answers.description : undefined,
      answers: args.answers,
      trackId,
      format: typeof args.answers.format === "string" ? args.answers.format : undefined,
      level: typeof args.answers.level === "string" ? args.answers.level : undefined,
      language: typeof args.answers.language === "string" ? args.answers.language : undefined,
      tags: Array.isArray(args.answers.tags) ? (args.answers.tags as string[]) : [],
      status: "pending",
    }

    let submissionId: Id<"submissions">
    if (args.draftId) {
      const draft = await ctx.db.get(args.draftId)
      if (!draft || draft.submitterId !== person._id) throw new Error("Draft not found")
      await ctx.db.patch(args.draftId, fields)
      submissionId = args.draftId
    } else {
      submissionId = await ctx.db.insert("submissions", {
        eventId: form.eventId,
        formId: form._id,
        kind: form.kind,
        submitterId: person._id,
        ...fields,
      })
    }
    await upsertParticipants(ctx, form, submissionId, args.participants, person._id)

    // ——— Side effects. None of these may lose the submission ———————————
    // The row is already written; a mail failure here must not roll the
    // speaker's work back, so each side effect is isolated and logged.

    // "Send submission confirmation email" (form builder → Notifications).
    // Goes to the submitter and every speaker on the proposal — a co-speaker
    // added by someone else still gets told their name is on a talk. The
    // preview/@example.com rule is inherited from the outbox, not re-built.
    if (form.participantConfig.sendConfirmationEmail) {
      const participantRows = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
        .collect()
      const recipients = new Set<Id<"people">>([person._id])
      for (const row of participantRows) {
        if (row.role === "speaker") recipients.add(row.personId)
      }
      for (const personId of recipients) {
        try {
          await ctx.runMutation(internal.comms.queueForPerson, {
            eventId: form.eventId,
            personId,
            templateKey: "confirmation",
            submissionId,
          })
        } catch (error) {
          console.error("confirmation email could not be queued", error)
        }
      }
    }

    // Alert the organizers on the form's notify list (Notifications step).
    try {
      await notifySubmissionAdmins(ctx, {
        submissionId,
        kind: "new",
        submitterName:
          `${person.firstName} ${person.lastName}`.trim() || person.email,
      })
    } catch (error) {
      console.error("submission notification could not be scheduled", error)
    }

    // Mirror to Airtable within seconds (no-op unless connected).
    await scheduleAirtableSync(ctx, form.eventId)

    // Outbound webhooks (convex/webhooks.ts) — fire-and-forget, never blocks
    // the speaker's submission on a customer's endpoint being reachable.
    await emitWebhook(ctx, form.eventId, "submission.created", {
      id: submissionId,
      form_id: form._id,
      submitter_email: person.email,
      submitter_name:
        `${person.firstName} ${person.lastName}`.trim() || person.email,
    })

    return {
      submissionId,
      portalToken: person.portalToken,
      autoRedirectToPortal: form.settings.autoRedirectToPortal,
      successMessage: form.settings.successMessage,
    }
  },
})
