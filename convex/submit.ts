import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { scheduleAirtableSync } from "./airtable"
import { emitWebhook } from "./webhooks"
import { queueMessage } from "./comms"
import { randomToken } from "./lib/auth"
import { siteUrl } from "./lib/email"
import { isFormOpen } from "./lib/formWindow"
import {
  formPath,
  resolvePublicForm,
  workspaceSlugForEvent,
} from "./lib/publicLinks"
import { notifySubmissionAdmins } from "./platformEmails"

// ————————————————————————————————————————————————————————————————————————
// Public CFP submission flow.
//
// IDENTITY MODEL (docs/memory/DECISIONS.md, "Typing an email is not proof of
// owning it"). The portalToken is a bearer credential: whoever holds it reads
// that speaker's submissions, tasks, files and profile. So the Account step
// hands one out on exactly two conditions:
//
//   1. The email has never been seen for this event → we create the person and
//      return the token. The account is empty, there is nothing to steal, and
//      the wizard needs the credential to save drafts. Zero friction, which is
//      the common case and the one swyx's video was angry about.
//   2. The caller already proved they hold the token (same browser session, or
//      the link we emailed them).
//
// Anyone else — every email address with any history on this event — gets an
// emailed sign-in link instead, and a response that says nothing about them:
// no token, no name, no drafts, no submission counts. Inbox access is the
// proof of ownership; typing an address is not.
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

/**
 * The one public form lookup used by every mutation below. The canonical
 * address is `/submit/:workspaceSlug/:eventSlug/:formSlug`; omitting either
 * parent segment takes a legacy path, which still resolves (oldest claimant
 * wins — see `resolvePublicForm`).
 */
const publicFormArgs = {
  slug: v.string(),
  eventSlug: v.optional(v.string()),
  workspaceSlug: v.optional(v.string()),
}

async function requirePublicForm(
  ctx: MutationCtx,
  args: { slug: string; eventSlug?: string; workspaceSlug?: string },
): Promise<Doc<"forms">> {
  const resolved = await resolvePublicForm(ctx, args)
  if (resolved.status === "ok") return resolved.form
  throw new ConvexError("Form not found")
}

/**
 * Resolve a legacy `/submit/:slug` or `/submit/:eventSlug/:formSlug` link to
 * its canonical three-segment address, for a 307.
 *
 * Every link ever printed has to keep working (docs/memory/DECISIONS.md), and
 * several events may now share a slug, so the oldest claimant wins — see
 * `resolvePublicForm` for why that beats an "ambiguous link" page.
 */
export const resolveLegacyLink = query({
  args: { slug: v.string(), eventSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await resolvePublicForm(ctx, {
      slug: args.slug,
      ...(args.eventSlug ? { eventSlug: args.eventSlug } : {}),
    })
    if (resolved.status === "ok") {
      return {
        status: "found" as const,
        workspaceSlug: resolved.workspaceSlug,
        eventSlug: resolved.event.slug,
        formSlug: resolved.form.slug,
      }
    }
    return { status: "missing" as const }
  },
})

export const getForm = query({
  args: publicFormArgs,
  handler: async (ctx, args) => {
    const resolved = await resolvePublicForm(ctx, args)
    if (resolved.status !== "ok") return null
    const { form, event } = resolved
    const openState = isFormOpen(form)
    return {
      formId: form._id,
      // The canonical address of this exact form, so any page that resolved it
      // a legacy way can 307 and link onward without rebuilding the URL.
      canonical: {
        workspaceSlug: resolved.workspaceSlug,
        eventSlug: event.slug,
        formSlug: form.slug,
      },
      legacy: resolved.legacy,
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

// ——— Identity: who is allowed to be handed a portal token ————————————————

/**
 * How long a still-empty person row counts as "the one this wizard session
 * just created". Inside the window, re-entering the same address (a second
 * tab, a cleared sessionStorage, a back button) sails through exactly as it
 * did the first time — there is provably nothing behind the account to leak.
 */
const NEW_ACCOUNT_GRACE_MS = 30 * 60 * 1000

/** Sign-in links per person per hour. Deliberately small and forgiving. */
const PORTAL_LINK_LIMIT = 3
const PORTAL_LINK_WINDOW_MS = 60 * 60 * 1000
/** Outbox key for the "continue as you" email. */
export const PORTAL_LINK_TEMPLATE_KEY = "portal_link"

/**
 * Does this person have anything a stranger must not reach?
 *
 * "Anything readable" is the test, and it is deliberately generous: a
 * submission (drafts included), a co-speaker credit — co-speakers DO get portal
 * access to the sessions they are on — a task, an uploaded file, or a profile
 * somebody has filled in. Only a bare row created minutes ago by this very
 * wizard falls through as "new".
 */
async function hasSpeakerHistory(
  ctx: QueryCtx | MutationCtx,
  person: Doc<"people">,
): Promise<boolean> {
  const submitted = await ctx.db
    .query("submissions")
    .withIndex("by_submitterId", (q) => q.eq("submitterId", person._id))
    .first()
  if (submitted) return true

  const credited = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_personId", (q) => q.eq("personId", person._id))
    .first()
  if (credited) return true

  const task = await ctx.db
    .query("tasks")
    .withIndex("by_personId", (q) => q.eq("personId", person._id))
    .first()
  if (task) return true

  const upload = await ctx.db
    .query("uploads")
    .withIndex("by_personId", (q) => q.eq("personId", person._id))
    .first()
  if (upload) return true

  // A profile is personal data in its own right — a bio and a phone number are
  // worth protecting even before the first submission lands.
  const profiled =
    person.firstName.trim() !== "" ||
    person.lastName.trim() !== "" ||
    Boolean(person.bio) ||
    Boolean(person.jobTitle) ||
    Boolean(person.company) ||
    Boolean(person.phone) ||
    Boolean(person.salutation) ||
    Boolean(person.pronouns) ||
    Boolean(person.headshotId) ||
    Boolean(person.links) ||
    Boolean(person.logistics) ||
    person.workflowStatus !== undefined
  if (profiled) return true

  return person._creationTime < Date.now() - NEW_ACCOUNT_GRACE_MS
}

/** Drafts this person has in progress ON THIS FORM. Token-holders only. */
async function draftsFor(
  ctx: QueryCtx | MutationCtx,
  person: Doc<"people">,
  form: Doc<"forms">,
) {
  const mine = await ctx.db
    .query("submissions")
    .withIndex("by_submitterId", (q) => q.eq("submitterId", person._id))
    .collect()
  return mine
    .filter((s) => s.formId === form._id && s.status === "draft")
    .map((s) => ({ id: s._id, title: s.title }))
}

/**
 * Email the person a link that carries their token — the one way a returning
 * speaker gets back in without a password.
 *
 * It goes through the ordinary speaker outbox (convex/comms.ts), so a demo
 * `@example.com` address renders as an inspectable "preview" row exactly like
 * every other email in the product, and a real address goes out over Resend.
 *
 * Returns `sent: false` when the hourly cap has been reached; the caller shows
 * a friendly "check your inbox" instead, never an error.
 */
async function sendPortalLink(
  ctx: MutationCtx,
  form: Doc<"forms">,
  person: Doc<"people">,
): Promise<{ sent: boolean }> {
  const now = Date.now()
  const recent = await ctx.db
    .query("messages")
    .withIndex("by_personId", (q) => q.eq("personId", person._id))
    .order("desc")
    .take(25)
  const inWindow = recent.filter(
    (m) =>
      m.templateKey === PORTAL_LINK_TEMPLATE_KEY &&
      (m.scheduledAt ?? m._creationTime) > now - PORTAL_LINK_WINDOW_MS,
  )
  if (inWindow.length >= PORTAL_LINK_LIMIT) return { sent: false }

  const event = await ctx.db.get(form.eventId)
  if (!event) return { sent: false }
  const continueLink = `${siteUrl()}${formPath(await workspaceSlugForEvent(ctx, event), event.slug, form.slug)}?t=${person.portalToken}`

  await queueMessage(ctx, {
    eventId: form.eventId,
    personId: person._id,
    templateKey: PORTAL_LINK_TEMPLATE_KEY,
    extraVars: { submitterEmail: person.email, continueLink },
    override: {
      subject: "Continue as {{submitterEmail}} on {{eventName}}",
      body: [
        "Hi {{firstName}},",
        "",
        "Somebody just entered {{submitterEmail}} on the call for speakers for {{eventName}}. If that was you, open this link to carry on where you left off — it signs you in, with no password to remember:",
        "",
        "{{continueLink}}",
        "",
        "The same sign-in works for your speaker portal, where your submissions, tasks and profile live:",
        "",
        "{{portalLink}}",
        "",
        "If it wasn't you, you can ignore this email. Whoever typed your address was shown nothing about you, and nothing changes unless the link above is opened.",
        "",
        "— The {{eventName}} programme team",
      ].join("\n"),
    },
  })
  await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
  return { sent: true }
}

const identifyResult = v.union(
  v.object({
    /** The session may proceed — it now holds this person's portal token. */
    status: v.literal("ready"),
    portalToken: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    drafts: v.array(v.object({ id: v.id("submissions"), title: v.string() })),
  }),
  v.object({
    /**
     * The address has history here. Everything else about it stays private —
     * this payload is identical whether they have one draft or forty talks.
     */
    status: v.literal("link_sent"),
    email: v.string(),
    /** False ⇒ hourly cap reached; a link is already in their inbox. */
    sent: v.boolean(),
  }),
)

/**
 * Account step. New address ⇒ straight through with a token. Known address ⇒
 * we email a sign-in link and say only that we did.
 *
 * `portalToken` is the caller's proof it already holds the credential (the
 * wizard's sessionStorage, or the `?t=` link we mailed). With it, a returning
 * speaker never has to check their inbox twice in one sitting.
 */
export const identify = mutation({
  args: {
    ...publicFormArgs,
    email: v.string(),
    portalToken: v.optional(v.string()),
  },
  returns: identifyResult,
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ConvexError("Please enter a valid email address.")
    }
    const form = await requirePublicForm(ctx, args)

    const existing = await ctx.db
      .query("people")
      .withIndex("by_eventId_and_email", (q) =>
        q.eq("eventId", form.eventId).eq("email", email),
      )
      .unique()

    // 1 — Nobody by that name here yet. Create the (empty) account and hand
    // over its token: there is nothing behind it to protect, and the wizard
    // needs it to save drafts.
    if (!existing) {
      const person = await getOrCreatePerson(ctx, form.eventId, email)
      return {
        status: "ready" as const,
        portalToken: person.portalToken,
        firstName: person.firstName,
        lastName: person.lastName,
        drafts: [],
      }
    }

    // 2 — Either the caller already holds the token, or the row is a
    // seconds-old shell this same wizard session created.
    const holdsToken = args.portalToken === existing.portalToken
    if (holdsToken || !(await hasSpeakerHistory(ctx, existing))) {
      return {
        status: "ready" as const,
        portalToken: existing.portalToken,
        firstName: existing.firstName,
        lastName: existing.lastName,
        drafts: await draftsFor(ctx, existing, form),
      }
    }

    // 3 — A real speaker. Prove the inbox, then continue.
    const { sent } = await sendPortalLink(ctx, form, existing)
    return { status: "link_sent" as const, email, sent }
  },
})

/**
 * Pick a wizard session back up from an emailed link (`?t=…`). Token in, own
 * data out — the same authentication the speaker portal uses, so this can
 * safely return the things `identify` no longer will.
 */
export const resume = query({
  args: { ...publicFormArgs, portalToken: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      email: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      drafts: v.array(v.object({ id: v.id("submissions"), title: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolvePublicForm(ctx, args)
    if (resolved.status !== "ok") return null
    const person = await ctx.db
      .query("people")
      .withIndex("by_portalToken", (q) => q.eq("portalToken", args.portalToken))
      .unique()
    if (!person || person.eventId !== resolved.form.eventId) return null
    return {
      email: person.email,
      firstName: person.firstName,
      lastName: person.lastName,
      drafts: await draftsFor(ctx, person, resolved.form),
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
    throw new ConvexError(`Missing required fields: ${missing.join(", ")}`)
  }

  const speakers = participants.filter((p) => p.role === "speaker")
  const { speakerMin, speakerMax } = form.participantConfig
  if (speakers.length < speakerMin) {
    throw new ConvexError(
      `At least ${speakerMin} speaker${speakerMin === 1 ? "" : "s"} required.`,
    )
  }
  if (speakers.length > speakerMax) {
    throw new ConvexError(`At most ${speakerMax} speakers allowed.`)
  }
  for (const p of participants) {
    if (!p.firstName.trim() || !p.lastName.trim()) {
      throw new ConvexError("Every participant needs a first and last name.")
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) {
      throw new ConvexError(`Invalid email for ${p.firstName || "participant"}.`)
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
        throw new ConvexError(`"${field.label}" is required for every participant.`)
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
    ...publicFormArgs,
    portalToken: v.string(),
    draftId: v.optional(v.id("submissions")),
    title: v.string(),
    answers: v.record(v.string(), v.any()),
    participants: v.array(participantArg),
  },
  handler: async (ctx, args) => {
    const form = await requirePublicForm(ctx, args)
    if (!form.settings.allowDrafts) throw new ConvexError("Drafts are not allowed on this form.")
    const openState = isFormOpen(form)
    if (!openState.open) throw new ConvexError(openState.reason)

    const person = await ctx.db
      .query("people")
      .withIndex("by_portalToken", (q) => q.eq("portalToken", args.portalToken))
      .unique()
    if (!person || person.eventId !== form.eventId) {
      throw new ConvexError("Session expired — please re-enter your email.")
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
        throw new ConvexError("Draft not found")
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
    ...publicFormArgs,
    portalToken: v.string(),
    draftId: v.optional(v.id("submissions")),
    title: v.string(),
    answers: v.record(v.string(), v.any()),
    participants: v.array(participantArg),
  },
  handler: async (ctx, args) => {
    const form = await requirePublicForm(ctx, args)
    const openState = isFormOpen(form)
    if (!openState.open) throw new ConvexError(openState.reason)

    const person = await ctx.db
      .query("people")
      .withIndex("by_portalToken", (q) => q.eq("portalToken", args.portalToken))
      .unique()
    if (!person || person.eventId !== form.eventId) {
      throw new ConvexError("Session expired — please re-enter your email.")
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
        throw new ConvexError(
          `You've reached the limit of ${form.settings.limitPerUser} submissions for this form.`,
        )
      }
    }

    if (!args.title.trim()) throw new ConvexError("Missing required fields: Title")
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
      if (!draft || draft.submitterId !== person._id) throw new ConvexError("Draft not found")
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

    // Deliberately NOT the portal token: the caller had to present it to get
    // here, so echoing it back only widens where the credential can leak from.
    return {
      submissionId,
      autoRedirectToPortal: form.settings.autoRedirectToPortal,
      successMessage: form.settings.successMessage,
    }
  },
})
