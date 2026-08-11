import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// ————————————————————————————————————————————————————————————————————————
// Trackstage domain model. See docs/SPEC.md §5.
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
    /**
     * Per-member event scoping (docs/memory/RULES.md 23): which events in this
     * workspace this person may see. ABSENT ⇒ every event, now and in future —
     * that is the default for everyone, and the only possible value for owners
     * and admins, who always run the whole workspace. Meaningful only for the
     * `member` role; `convex/lib/auth.ts` is the single place it is enforced.
     */
    eventIds: v.optional(v.array(v.id("events"))),
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
    // REST API scopes (convex/apiV1.ts), mirroring Sessionboard's token
    // scopes: read:events, read:sessions, read:contacts, read:media,
    // write:sessions, write:fields, write:metadata, write:events,
    // write:webhooks. UNSET means "no scope restriction" — the key acts with
    // exactly the permissions its owner's org membership grants, which is the
    // pre-existing behaviour every MCP key relies on. Once set, it is enforced
    // as an additional narrowing on top of membership (never a widening).
    scopes: v.optional(v.array(v.string())),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"]),

  // Saved AI-copilot conversations (docs/memory/RULES.md 24). One row per
  // chat: the whole transcript lives in `messages` as serialized AI SDK
  // `UIMessage`s, because that is exactly what both the renderer and the model
  // want back — no reassembly, no per-part table, no join on read.
  //
  // The transcript IS bounded (convex/copilotThreads.ts trims to a byte budget
  // before every write), which is what makes an array field legitimate here:
  // the document can never grow past the budget however long the chat runs.
  //
  // Scoped to a user AND an event: "how many submissions do I have?" means
  // something different on the other side of the event switcher, so the rail
  // only ever lists the current event's conversations.
  copilotThreads: defineTable({
    userId: v.string(), // Better Auth user id — the only reader
    eventId: v.optional(v.id("events")), // absent ⇒ chatted with no event selected
    title: v.string(), // auto-derived from the first user message, renameable
    createdAt: v.number(),
    updatedAt: v.number(), // last autosave; the rail sorts on it
    messages: v.array(v.any()), // serialized UIMessage[]
  })
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_and_eventId_and_updatedAt", [
      "userId",
      "eventId",
      "updatedAt",
    ]),

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
    // Event branding (convex/files.ts). The logo shows on the public pages and
    // in the speaker portal header; the background is the optional hero image
    // behind the public header. Both are storage blobs the organizer owns —
    // replacing or clearing one deletes the blob it replaces.
    logoId: v.optional(v.id("_storage")),
    backgroundId: v.optional(v.id("_storage")),
    // Go-live gate for the public program (sbek AIA-07). Unset ⇒ the public
    // pages render "Schedule coming soon" with no sessions, however many are
    // accepted and scheduled internally. Set by agenda.publishAgenda.
    agendaPublishedAt: v.optional(v.number()),
    // How the speaker portal behaves for this event (Settings → Event →
    // Speaker portal; the high-value subset of Sessionboard's per-portal
    // Configuration step, docs/reference/sessionboard-product-map.md §2.5).
    // Every flag is optional and every unset flag resolves to the permissive
    // value in convex/portal.ts, so an event that never opens the card keeps
    // exactly the behaviour it had before this existed.
    portalSettings: v.optional(
      v.object({
        // Tasks are visible to everyone with portal access. Off ⇒ only
        // speakers with an accepted session see the Tasks tab.
        alwaysShowTasks: v.optional(v.boolean()),
        // Speakers may edit their own submissions from the portal.
        allowSubmissionEdits: v.optional(v.boolean()),
        // Past-due tasks stay completable. Off ⇒ an overdue task locks and
        // only the organizers can reopen it.
        extendTaskDeadlines: v.optional(v.boolean()),
      }),
    ),
  })
    // EVENT slugs are unique PER WORKSPACE (docs/memory/DECISIONS.md, "URL
    // architecture is fully hierarchical"): `by_organizationId_slug` is the
    // uniqueness index and the canonical `/e/:ws/:event` lookup. `by_slug`
    // survives to resolve legacy one-segment links, where several workspaces
    // may now legitimately answer to the same slug — so every read through it
    // must tolerate multiple rows (oldest claimant wins, never `.unique()`).
    .index("by_slug", ["slug"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_slug", ["organizationId", "slug"]),

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

  /**
   * Custom session statuses (Settings → Statuses) — Sessionboard's
   * `Name · Category · Color · Order · Sessions` CRUD.
   *
   * DESIGN CHOICE, read this before changing anything here:
   * `submissions.status` STAYS the fixed pipeline enum
   * (`draft | pending | accept_queue | decline_queue | accepted | declined |
   * withdrawn`). Every rule in the product — queue commits, decision emails,
   * portal masking, agenda visibility, the public API — keys off that string
   * and must keep doing so. This table is a PRESENTATION + GROUPING layer on
   * top of it:
   *
   *   • `pipelineStatus` is the enum value a row behaves as. It is what gets
   *     written to `submissions.status` when an organizer picks the row.
   *   • `category` is the behavioural bucket the row inherits (Sessionboard's
   *     own model: "every status maps to a category and inherits its
   *     behaviour"). It is what an organizer reasons about.
   *   • `name` / `color` / `order` are pure presentation.
   *
   * So an organizer can rename "Accepted" to "Confirmed", recolour it, and add
   * "Waitlist" (category `pending`) — and nothing downstream changes, because
   * a Waitlist submission is still `status: "pending"` to every pipeline rule.
   * `submissions.statusId` remembers WHICH label was chosen; when it disagrees
   * with `status` (e.g. a queue commit moved the row) the label is ignored and
   * the built-in wording wins. See `convex/sessionStatuses.ts`.
   */
  sessionStatuses: defineTable({
    eventId: v.id("events"),
    // What the organizer sees. Unique per event, case-insensitively.
    name: v.string(),
    // The behavioural bucket. Drives what the rest of the product does with a
    // submission carrying this status — nothing else.
    category: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("withdrawn"),
    ),
    // The pipeline enum value written to `submissions.status`. Always inside
    // the row's category (the two queue statuses are the only case where a
    // category holds more than one pipeline value).
    pipelineStatus: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("accept_queue"),
      v.literal("decline_queue"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("withdrawn"),
    ),
    // A design token name, never a hex — the pill tones live in styles.css.
    color: v.union(
      v.literal("green"),
      v.literal("amber"),
      v.literal("red"),
      v.literal("gray"),
      v.literal("blue"),
    ),
    order: v.number(),
    // Set on the seven rows that ship with every event ("Created By: System"
    // in Sessionboard). System rows can be renamed, recoloured and reordered
    // but never deleted and never re-categorised — the pipeline needs them.
    systemKey: v.optional(v.string()),
    // Who added a custom status, for the `Created By` column. Absent on the
    // built-ins, which render as "System". Denormalised on purpose: it is an
    // audit label, not a live reference, so it must survive the member leaving.
    // (`Created At` needs no field — Convex gives every row `_creationTime`.)
    createdBy: v.optional(v.string()),
    // Soft delete. Deleting a custom status hides it everywhere but keeps the
    // row, so `POST /v1/event/{ref}/statuses/{id}/restore` can bring it back —
    // Sessionboard's own delete/restore pair for statuses, and the reason an
    // organizer who deletes the wrong label is not stuck with retyping it.
    deletedAt: v.optional(v.number()),
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
    // Form slugs are unique PER EVENT, not globally (docs/memory/DECISIONS.md —
    // "Public URL scheme"). `by_eventId_slug` is the uniqueness index and the
    // canonical `/submit/:eventSlug/:formSlug` lookup. `by_slug` survives only
    // to resolve legacy single-segment `/submit/:formSlug` links, where several
    // events may now legitimately answer to the same slug — so every read
    // through it must tolerate multiple rows (never `.unique()`).
    .index("by_slug", ["slug"])
    .index("by_eventId_slug", ["eventId", "slug"]),

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
    // Public visibility (sbek CNT-12 — Sessionboard's per-participant "eye"
    // toggle). Absent means visible: every person is public by default, and an
    // organizer flips this to embargo a keynote speaker until the announcement.
    // `false` removes them from every public surface — gallery, session speaker
    // lists, itineraries, the JSON API and the .ics feed — without touching
    // their submission or acceptance status.
    publicVisible: v.optional(v.boolean()),
    // Travel & logistics notes (sbek SPK-15). Free text on purpose: real
    // organizers keep "arrives Tue 14:00 LHR, needs a hotel Tue+Wed, vegetarian"
    // in one place, and forcing that into flight/hotel columns nobody fills in
    // is how CRMs get abandoned. Organizer-side only — never shown publicly.
    logistics: v.optional(v.string()),
    // Last REST-API write (convex/apiV1.ts) — see submissions.updatedAt.
    updatedAt: v.optional(v.number()),
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
    // Which custom status LABEL the organizer picked (convex/sessionStatuses.ts).
    // Presentation only: `status` above is the single source of truth for every
    // pipeline rule. Ignored whenever the referenced row's `pipelineStatus` no
    // longer equals `status`, so a queue commit can never leave a lying label.
    statusId: v.optional(v.id("sessionStatuses")),
    submitterId: v.id("people"),
    decidedAt: v.optional(v.number()),
    notifiedAt: v.optional(v.number()),
    // Scheduling (only meaningful once accepted / kind=session).
    roomId: v.optional(v.id("rooms")),
    startsAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    // Public visibility (sbek CNT-12 — Sessionboard's "Display Session"
    // checkbox). Absent means visible: an accepted session is public once the
    // agenda is published, and an organizer unticks this to keep a surprise
    // keynote or an internal briefing off the public schedule, sessions list,
    // session page, speaker itineraries, JSON API and .ics feed. It is a flag
    // on the record, not a workflow — nothing else changes.
    publicVisible: v.optional(v.boolean()),
    // Last REST-API write (convex/apiV1.ts). Surfaced as `updated_at` and used
    // as the optimistic-concurrency token on PUT (mismatch ⇒ 409), exactly
    // like Sessionboard's. Falls back to `_creationTime` when never written
    // through the API.
    updatedAt: v.optional(v.number()),
    // Soft delete (REST API parity: DELETE /sessions/{id} + POST /restore).
    // Set ⇒ the row is invisible to every organizer, portal and public read;
    // the blob of history is kept so a mis-click is undoable. Nothing in the
    // product UI sets this — only convex/apiV1.ts.
    deletedAt: v.optional(v.number()),
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
    criteria: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        // How the evaluator answers this criterion (sbek ABS-03). Absent ⇒
        // "numeric", which is what every criterion was before types existed —
        // a 1–5 rating. "select" answers one of `options`; "text" is free
        // prose. Only numeric criteria ever reach an average.
        type: v.optional(
          v.union(v.literal("numeric"), v.literal("select"), v.literal("text")),
        ),
        // The choices for a "select" criterion, in the order shown.
        options: v.optional(v.array(v.string())),
        // Relative importance of a numeric criterion in the weighted average
        // (sbek ABS-04). Absent ⇒ 1.
        weight: v.optional(v.number()),
      }),
    ),
    submissionIds: v.array(v.id("submissions")),
    // Round window (sbek ABS-01). `dueAt` closes it, `opensAt` opens it —
    // before `opensAt` the review link works but politely holds the queue back.
    opensAt: v.optional(v.number()),
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
    // Per-evaluator assignment (sbek ABS-05/06). Absent ⇒ this evaluator
    // reviews the plan's whole pool, which is how every plan behaved before
    // assignment existed. An empty array means "assigned nothing", on purpose.
    assignedSubmissionIds: v.optional(v.array(v.id("submissions"))),
    // Last time the organizer nudged this evaluator (sbek ABS-09).
    lastRemindedAt: v.optional(v.number()),
  })
    .index("by_planId", ["planId"])
    .index("by_token", ["token"])
    .index("by_eventId", ["eventId"]),

  evaluations: defineTable({
    planId: v.id("evaluationPlans"),
    eventId: v.id("events"),
    submissionId: v.id("submissions"),
    evaluatorId: v.id("evaluators"),
    scores: v.record(v.string(), v.number()), // criterionId → 1..5 (numeric criteria only)
    // Answers to non-numeric criteria: criterionId → chosen option / free text
    // (sbek ABS-03). Kept apart from `scores` so the 1–5 guard on scores never
    // has to loosen and nothing non-numeric can leak into an average.
    values: v.optional(v.record(v.string(), v.string())),
    comment: v.optional(v.string()),
    // Conflict of interest (sbek ABS-12): the evaluator recused themselves.
    // The row still counts as "handled" for their queue but is excluded from
    // every average and shown to the organizer as "Recused".
    recusedAt: v.optional(v.number()),
    recusalReason: v.optional(v.string()),
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
    kind: v.string(), // profile | headshot | upload | answer | confirm
    formId: v.optional(v.id("forms")),
    // `answer` tasks only ("Collect an answer"): what the speaker typed back.
    // The reply IS the proof of completion — submitting it sets `completedAt`
    // — so the organizer reads the answer wherever they read the task.
    response: v.optional(v.string()),
    // The session this task is about ("upload the slides for THIS talk"). Set
    // by the organizer when they assign it; every file uploaded against the
    // task inherits it, so speaker uploads surface on the session's Files tab
    // instead of vanishing into a task nobody opens.
    submissionId: v.optional(v.id("submissions")),
    dueAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_personId", ["personId"])
    .index("by_submissionId", ["submissionId"]),

  // The reusable task library (product-map delta #10 — "Portals → Tasks").
  // Organizers write "Upload your slides" once and assign it all season, and
  // the instructions may carry {{firstName}} / {{sessionTitle}} placeholders
  // that resolve per speaker when the portal renders them.
  taskTemplates: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    instructions: v.optional(v.string()),
    kind: v.string(), // profile | headshot | upload | answer | confirm
    /** What a portal calls this task, when it differs from the library name. */
    alias: v.optional(v.string()),
  }).index("by_eventId", ["eventId"]),

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
    // ——— REST API session-file parity (convex/apiV1.ts) ———
    // Display title, defaulting to `filename` when absent.
    title: v.optional(v.string()),
    // The session participant this file belongs to (their
    // `assigned_participant_id`). Distinct from `personId`, which is whoever
    // uploaded it.
    assignedPersonId: v.optional(v.id("people")),
    // Soft delete — DELETE .../files/{id}.
    deletedAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_personId", ["personId"])
    .index("by_submissionId", ["submissionId"])
    .index("by_taskId", ["taskId"])
    // "Who else points at this blob?" — asked before every storage.delete so a
    // file is never deleted out from under a version that still shows it.
    .index("by_storageId", ["storageId"]),

  // A comment thread per uploaded file (sbek CNT-05, product-map delta #8).
  // Both sides read the same thread — an organizer asking "can you re-export
  // this at 16:9?" and the speaker's reply live together, attached to the file
  // rather than to an email nobody else can see. No notification in v1, which
  // is exactly how Sessionboard ships it (documented as a known gap).
  uploadComments: defineTable({
    uploadId: v.id("uploads"),
    eventId: v.id("events"),
    authorType: v.string(), // organizer | speaker
    /** Display name captured at write time, so it survives renames/removals. */
    authorLabel: v.string(),
    body: v.string(),
  })
    .index("by_uploadId", ["uploadId"])
    .index("by_eventId", ["eventId"]),

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
    // True when the template was authored as HTML — decided BEFORE merge
    // fields render, so recipient-typed text can never flip the mode.
    isHtml: v.optional(v.boolean()),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    status: v.string(), // scheduled | sent | failed | preview
    error: v.optional(v.string()),
    // ——— Delivery receipt (product-map delta #7) ————————————————————————
    // `status: "sent"` only proves the provider accepted the email. These three
    // carry what happened afterwards, refreshed on demand from Resend.
    /** Resend's message id, returned by POST /emails — the polling handle. */
    resendId: v.optional(v.string()),
    /** Resend's latest event: delivered | bounced | complained | opened | … */
    providerStatus: v.optional(v.string()),
    /** When the provider confirmed the mail actually landed. */
    deliveredAt: v.optional(v.number()),
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
    /**
     * The off switch (sbek EMB-15). A saved embed's snippet carries its id, so
     * turning this off turns the widget off everywhere it was pasted — the
     * page answers "this embed is turned off" instead of the programme.
     * ABSENT ⇒ ON: every embed saved before this field existed keeps working.
     */
    enabled: v.optional(v.boolean()),
    options: v.object({
      // Delivery format of the snippet: iframe | html | link | json | xml | ics
      format: v.optional(v.string()),
      hideDescriptions: v.optional(v.boolean()),
      hideSpeakers: v.optional(v.boolean()),
      hideImages: v.optional(v.boolean()),
      hideSearch: v.optional(v.boolean()),
      /**
       * Track NAMES (public URLs filter by name, not id). One name is the
       * historical shape and still valid; several are comma-separated, which
       * is exactly what the `?track=` URL parameter accepts.
       */
      track: v.optional(v.string()),
      height: v.optional(v.number()),
      /** Branding: the organizer's accent colour, `#RRGGBB`. */
      accent: v.optional(v.string()),
      /** Branding: show the event's logo and name at the top of the widget. */
      showHeader: v.optional(v.boolean()),
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
    // EXPERIMENTAL inbound sync (HISTORY.md 61). Off unless the organizer
    // opts in. When on, the sync run also PULLS the Status column back —
    // scoped to that one field, guarded against echoes, and our DB always
    // wins a genuine conflict. See convex/lib/airtableInbound.ts.
    twoWaySync: v.optional(v.boolean()),
    // Outcome of the last pull, so the Integrations card can be honest about
    // what came back rather than silently swallowing skips.
    inbound: v.optional(
      v.object({
        at: v.number(),
        applied: v.number(),
        skipped: v.number(),
        conflicts: v.number(),
      }),
    ),
  }).index("by_eventId", ["eventId"]),

  // Per-submission mirror state for the two-way sync. Separate from
  // `submissions` on purpose: it is high-churn integration bookkeeping that
  // must never contend with the product row, and it disappears cleanly when
  // the integration does.
  //
  // `lastPushedStatus` is the whole loop guard. It records the value WE last
  // wrote into Airtable, which lets one comparison answer both questions the
  // inbound path has to get right: "is this Airtable value just our own echo
  // coming back?" (airtable === lastPushed) and "did our side change since
  // the mirror was written?" (current !== lastPushed ⇒ conflict, we win).
  airtableRecordSync: defineTable({
    eventId: v.id("events"),
    submissionId: v.id("submissions"),
    lastPushedStatus: v.optional(v.string()),
    lastPushedAt: v.optional(v.number()),
    lastPulledStatus: v.optional(v.string()),
    lastPulledAt: v.optional(v.number()),
    /** Airtable's own LAST_MODIFIED_TIME for the record, as an ISO string. */
    lastPulledModifiedTime: v.optional(v.string()),
  })
    .index("by_submissionId", ["submissionId"])
    .index("by_eventId", ["eventId"]),

  // ——— Audit log (sbek CNT-11) ———————————————————————————————————————————
  // One append-only row per meaningful change, with attribution. Deliberately
  // NOT a versioning system: swyx's instinct was that full restore is overkill
  // for v1, so this answers "who changed what, when" and nothing more.
  //
  // `eventId` is absent for workspace-level rows (API-key lifecycle), which is
  // why `organizationId` — always known — is the one required scope. Both the
  // event feed and the workspace feed read from their own index.
  // Previous wording of a submission, so the History tab's "Restore this
  // version" has something real to put back.
  //
  // This is deliberately NOT the audit log. `meta` there is clamped to 500
  // characters per value, which is fine for a receipt and silently ruinous for
  // an abstract — a restore that quietly returns two thirds of a paragraph is
  // worse than no restore at all. One row per edit that actually changed the
  // title or the description; the audit row points at it by id.
  submissionVersions: defineTable({
    eventId: v.id("events"),
    submissionId: v.id("submissions"),
    /** The wording as it stood BEFORE the edit this row was written for. */
    title: v.string(),
    description: v.string(),
  }).index("by_submissionId", ["submissionId"]),

  auditLog: defineTable({
    organizationId: v.id("organizations"),
    eventId: v.optional(v.id("events")),
    // organizer | speaker | mcp | api | system
    actorType: v.string(),
    // Human attribution: a name, an email, "MCP · set_submission_status ·
    // sb_live_1a2b3c4d", "Airtable sync". Never a raw id.
    actorLabel: v.string(),
    // submission | form | session | speaker | agenda | settings | api-key
    entity: v.string(),
    /** Stringified doc id (or a stable key like the event id for settings). */
    entityId: v.string(),
    // status_changed | created | updated | deleted | scheduled | published |
    // decision_committed | sync_conflict | …
    action: v.string(),
    /** One human sentence: "Status changed Pending → Accepted". */
    summary: v.string(),
    /** Small structured payload (previous/next values, receipts). */
    meta: v.optional(v.record(v.string(), v.any())),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_eventId", ["eventId"])
    .index("by_eventId_and_entity_and_entityId", [
      "eventId",
      "entity",
      "entityId",
    ]),

  // ——— Public REST API (convex/apiV1.ts + convex/webhooks.ts) ——————————————

  // Outbound webhook endpoints. Event-scoped by default (an organizer wires
  // their own automation to one event); `eventId: undefined` subscribes to
  // every event in the workspace, which is what Sessionboard's org-level
  // endpoints do.
  webhooks: defineTable({
    organizationId: v.id("organizations"),
    eventId: v.optional(v.id("events")),
    url: v.string(), // https:// only
    // Signing secret (`whsec_…`). Shown in full on create and on rotate; the
    // list endpoint masks it. HMAC-SHA256 over `${timestamp}.${body}`.
    secret: v.string(),
    // Subscribed event types, e.g. ["session.updated"]. `["*"]` = everything.
    events: v.array(v.string()),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    // Rolling health, so the settings UI and GET /webhooks can show a status
    // without scanning the delivery log.
    lastDeliveryAt: v.optional(v.number()),
    lastStatus: v.optional(v.number()),
    lastError: v.optional(v.string()),
    consecutiveFailures: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_eventId", ["eventId"]),

  // Per-attempt delivery log (Sessionboard shows the same thing under
  // "Monitoring"). Trimmed by the crons sweep so it cannot grow unbounded.
  webhookDeliveries: defineTable({
    webhookId: v.id("webhooks"),
    organizationId: v.id("organizations"),
    eventType: v.string(),
    payload: v.string(), // the exact JSON body that was signed
    // pending | success | failed
    status: v.string(),
    attempts: v.number(),
    responseStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_webhookId", ["webhookId"])
    .index("by_organizationId", ["organizationId"])
    // Retention sweep walks oldest-first without scanning the table.
    .index("by_createdAt", ["createdAt"]),

  // Token-bucket counters backing the documented 100 req / 15 min per
  // (credential, category) limit. One row per window; stale rows are swept.
  apiRateLimits: defineTable({
    // sha-256 of the presenting credential — never the credential itself.
    subject: v.string(),
    bucket: v.string(), // entity_reads | session_writes | …
    windowStart: v.number(),
    count: v.number(),
  }).index("by_subject_and_bucket", ["subject", "bucket"]),

  // Two-phase (>50 MB) session-file uploads. POST …/files mints an intent and
  // hands back a PUT URL on our own origin; the bytes land in Convex storage;
  // POST …/files/{id}/complete promotes the intent into an `uploads` row.
  // Intents are ephemeral — the crons sweep drops abandoned ones.
  fileUploadIntents: defineTable({
    eventId: v.id("events"),
    submissionId: v.id("submissions"),
    personId: v.id("people"),
    filename: v.string(),
    contentType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    title: v.optional(v.string()),
    assignedPersonId: v.optional(v.id("people")),
    // Set when replacing an existing file group, so `complete` versions it.
    replacesUploadId: v.optional(v.id("uploads")),
    // Filled by PUT …/files/{id}/bytes; `complete` refuses without it.
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  })
    .index("by_submissionId", ["submissionId"])
    .index("by_storageId", ["storageId"])
    .index("by_createdAt", ["createdAt"]),
})
