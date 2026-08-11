// Demo seed — docs/SPEC.md §7.
//
// Builds the "AI Engineer Summit 2026" demo world plus a deliberately tiny
// second event ("Design Systems Day") whose only job is to prove cross-event
// scoping: nothing from event two may ever leak into event one's screens.
//
// `run` is idempotent: if the demo event already exists, every row belonging to
// it is purged (including stored files) before rebuilding, so a judge can reset
// the demo repeatedly and always land on identical data.
//
// Storage-backed demo assets (speaker headshots, one slide deck) cannot be
// created from a mutation — `ctx.storage.store` is action-only — so `run`
// schedules `attachDemoAssets` to fill them in immediately afterwards.

import { v, type Infer } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server"
import { requireUser } from "./lib/auth"
import { authComponent, createAuth } from "./auth"
import { DEFAULT_TEMPLATES, portalLinkFor, renderTemplate } from "./lib/email"

// ——— Demo constants ———————————————————————————————————————————————————————

export const DEMO_EVENT_SLUG = "ai-summit-2026"
export const DEMO_SECOND_EVENT_SLUG = "design-systems-day"
export const DEMO_ORGANIZER_EMAIL = "organizer@demo.sessionboard.dev"
export const DEMO_ORGANIZER_PASSWORD = "demo2026"
export const DEMO_ORGANIZER_NAME = "Dana Organizer"

const DAY = 24 * 60 * 60 * 1000

/** Pacific Daylight Time (UTC−7) — valid for the March–November 2026 window. */
function pt(year: number, month: number, day: number, hour: number, minute = 0) {
  return Date.UTC(year, month - 1, day, hour + 7, minute)
}
/** Eastern Standard Time (UTC−5) — valid for November 2026. */
function et(year: number, month: number, day: number, hour: number, minute = 0) {
  return Date.UTC(year, month - 1, day, hour + 5, minute)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Deterministic, human-readable portal token: `demo-ava-nakamura`. */
function portalTokenFor(firstName: string, lastName: string): string {
  return `demo-${slugify(`${firstName} ${lastName}`)}`
}

const AVATAR_COLORS = [
  "#2F5CE0",
  "#1E9E6B",
  "#B45309",
  "#7C3AED",
  "#DB2777",
  "#0F766E",
  "#C2410C",
  "#4338CA",
]

// ——— Purge —————————————————————————————————————————————————————————————————

/** Delete every row (and stored file) belonging to one event. */
async function purgeEvent(ctx: MutationCtx, eventId: Id<"events">) {
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(500)
  for (const row of rooms) await ctx.db.delete("rooms", row._id)

  const tracks = await ctx.db
    .query("tracks")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(500)
  for (const row of tracks) await ctx.db.delete("tracks", row._id)

  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(500)
  for (const row of forms) await ctx.db.delete("forms", row._id)

  const uploads = await ctx.db
    .query("uploads")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(2000)
  for (const row of uploads) {
    await ctx.storage.delete(row.storageId)
    await ctx.db.delete("uploads", row._id)
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(2000)
  for (const row of tasks) await ctx.db.delete("tasks", row._id)

  const plans = await ctx.db
    .query("evaluationPlans")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(200)
  for (const plan of plans) {
    // `evaluations` is only indexed by plan / submission / evaluator.
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_planId", (q) => q.eq("planId", plan._id))
      .take(2000)
    for (const row of evaluations) await ctx.db.delete("evaluations", row._id)
    await ctx.db.delete("evaluationPlans", plan._id)
  }

  const evaluators = await ctx.db
    .query("evaluators")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(500)
  for (const row of evaluators) await ctx.db.delete("evaluators", row._id)

  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(2000)
  for (const row of participants) {
    await ctx.db.delete("submissionParticipants", row._id)
  }

  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(2000)
  for (const row of submissions) await ctx.db.delete("submissions", row._id)

  const messages = await ctx.db
    .query("messages")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(2000)
  for (const row of messages) await ctx.db.delete("messages", row._id)

  const templates = await ctx.db
    .query("emailTemplates")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(500)
  for (const row of templates) await ctx.db.delete("emailTemplates", row._id)

  const people = await ctx.db
    .query("people")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(2000)
  for (const row of people) {
    if (row.headshotId) await ctx.storage.delete(row.headshotId)
    await ctx.db.delete("people", row._id)
  }

  const event = await ctx.db.get("events", eventId)
  if (event?.logoId) await ctx.storage.delete(event.logoId)
  await ctx.db.delete("events", eventId)
}

async function purgeBySlug(ctx: MutationCtx, slug: string) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()
  if (existing) await purgeEvent(ctx, existing._id)
}

// ——— Seed data ————————————————————————————————————————————————————————————

type PersonSeed = {
  key: string
  firstName: string
  lastName: string
  jobTitle: string
  company: string
  pronouns?: string
  bio?: string
  headshot: boolean
  links?: { linkedin?: string; twitter?: string; website?: string }
}

const PEOPLE: PersonSeed[] = [
  {
    key: "ava",
    firstName: "Ava",
    lastName: "Nakamura",
    jobTitle: "Staff ML Engineer",
    company: "Lumen AI",
    pronouns: "she/her",
    headshot: true,
    bio: "Ava leads the evaluation platform at Lumen AI, where she is responsible for making sure model changes ship without quietly regressing customer-facing quality. She spent six years in search relevance before moving to LLM systems.",
    links: { linkedin: "https://linkedin.com/in/example-ava", twitter: "https://x.com/example_ava" },
  },
  {
    key: "marcus",
    firstName: "Marcus",
    lastName: "Ellery",
    jobTitle: "Principal Engineer",
    company: "Northwind Data",
    headshot: true,
    bio: "Marcus has spent the last decade building data infrastructure that other engineers have to trust at 3am. He writes about testing practice for probabilistic systems.",
  },
  {
    key: "priya",
    firstName: "Priya",
    lastName: "Raghavan",
    jobTitle: "Head of Platform",
    company: "Cobalt Systems",
    pronouns: "she/her",
    headshot: true,
    bio: "Priya runs the platform organisation at Cobalt Systems, covering everything from developer experience to the inference fleet. She has been a programme chair three times and still enjoys it.",
    links: { website: "https://example.com/priya" },
  },
  {
    key: "tom",
    firstName: "Tom",
    lastName: "Beaumont",
    jobTitle: "Developer Advocate",
    company: "Ridgeline",
    headshot: true,
    // Deliberately missing a bio — powers the "no bio" chase pill.
  },
  {
    key: "sofia",
    firstName: "Sofia",
    lastName: "Marchetti",
    jobTitle: "Founding Engineer",
    company: "Vantage Labs",
    pronouns: "she/her",
    headshot: false, // Deliberately missing a headshot.
    bio: "Sofia was the first engineer at Vantage Labs and now leads their agent runtime. She is unreasonably interested in what happens when a tool call fails halfway through.",
  },
  {
    key: "daniel",
    firstName: "Daniel",
    lastName: "Okonkwo",
    jobTitle: "Director of AI",
    company: "Meridian Health",
    headshot: true,
    bio: "Daniel builds clinical decision-support systems at Meridian Health, in a regulatory environment where 'we will fix it in the next deploy' is not an option.",
  },
  {
    key: "hana",
    firstName: "Hana",
    lastName: "Kobayashi",
    jobTitle: "Research Engineer",
    company: "Institute for Applied ML",
    pronouns: "she/her",
    headshot: true,
    bio: "Hana works on calibration and abstention — teaching models to recognise the edge of their own competence. She publishes regularly and reviews for three conferences.",
  },
  {
    key: "liam",
    firstName: "Liam",
    lastName: "Ferguson",
    jobTitle: "Staff Site Reliability Engineer",
    company: "Orbit Cloud",
    headshot: true,
    // Deliberately missing a bio.
  },
  {
    key: "elena",
    firstName: "Elena",
    lastName: "Petrova",
    jobTitle: "Product Lead",
    company: "Runway Analytics",
    pronouns: "she/her",
    headshot: true,
    bio: "Elena has shipped AI features to two million users and has the support tickets to prove it. She is interested in the gap between demo behaviour and daily behaviour.",
  },
  {
    key: "noah",
    firstName: "Noah",
    lastName: "Blackwood",
    jobTitle: "Chief Technology Officer",
    company: "Fathom Robotics",
    headshot: true,
    bio: "Noah is CTO at Fathom Robotics, where inference cost is a line item the board reads every month. He previously built pricing systems at a payments company.",
  },
  {
    key: "yara",
    firstName: "Yara",
    lastName: "Haddad",
    jobTitle: "Senior Engineer",
    company: "Cirrus Payments",
    pronouns: "she/her",
    headshot: true,
    bio: "Yara works on the developer platform at Cirrus Payments and maintains two widely used open-source schema libraries.",
  },
  {
    key: "jonas",
    firstName: "Jonas",
    lastName: "Weber",
    jobTitle: "ML Infrastructure Lead",
    company: "Halcyon",
    headshot: true,
    bio: "Jonas runs retrieval infrastructure at Halcyon at a scale where every index decision has a budget attached to it.",
  },
  {
    key: "grace",
    firstName: "Grace",
    lastName: "Lindqvist",
    jobTitle: "Design Engineer",
    company: "Studio Kern",
    pronouns: "she/her",
    headshot: true,
    bio: "Grace sits between design and engineering at Studio Kern and cares a great deal about interfaces for systems that are only probably right.",
  },
  {
    key: "rafael",
    firstName: "Rafael",
    lastName: "Duarte",
    jobTitle: "Solutions Architect",
    company: "Terrafirma",
    headshot: false, // Deliberately missing a headshot.
    bio: "Rafael helps enterprise teams take AI prototypes into production, which mostly means helping them delete things.",
  },
]

type SubmissionSeed = {
  key: string
  title: string
  description: string
  status: string
  kind: string
  submitter: string
  speakers: string[]
  track: "ai" | "product" | "infra"
  format: string
  level: string
  language: string
  tags: string[]
  takeaways: string
  workshopDuration?: string
  fromForm: boolean
  schedule?: { room: "main" | "workshop"; startsAt: number; durationMinutes: number }
  decidedAt?: number
}

const SUBMISSIONS: SubmissionSeed[] = [
  // — 3 drafts ————————————————————————————————————————————————————————————
  {
    key: "s1",
    title: "Evaluating RAG pipelines without a golden dataset",
    description:
      "Most teams start building retrieval-augmented generation long before anyone has labelled a single example. This talk covers the evaluation techniques that actually work in that gap: LLM-as-judge with calibrated rubrics, retrieval-only metrics you can compute for free, and the small hand-labelled set that is worth the two days it costs.",
    status: "draft",
    kind: "abstract",
    submitter: "ava",
    speakers: ["ava"],
    track: "ai",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["rag", "evaluation"],
    takeaways:
      "A concrete evaluation ladder you can climb from zero labels to a trustworthy regression suite.",
    fromForm: true,
  },
  {
    key: "s2",
    title: "A field guide to prompt regression testing",
    description:
      "Prompts are code, but they fail like configuration. A short, practical tour of how to version, diff and regression-test prompts so a one-word change never silently breaks production again.",
    status: "draft",
    kind: "abstract",
    submitter: "marcus",
    speakers: ["marcus"],
    track: "ai",
    format: "Lightning talk",
    level: "Beginner",
    language: "English",
    tags: ["prompting", "testing"],
    takeaways: "A minimal prompt test harness you can add to CI this week.",
    fromForm: true,
  },
  {
    key: "s3",
    title: "Designing agent handoffs that don't lose context",
    description:
      "When one agent hands work to another — or to a human — context is where things break. We look at handoff design as a product problem: what state travels, what gets summarised, what the user is shown, and how to make the seam recoverable when it fails.",
    status: "draft",
    kind: "abstract",
    submitter: "priya",
    speakers: ["priya"],
    track: "product",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["agents", "ux"],
    takeaways: "A checklist for designing and instrumenting agent-to-human handoffs.",
    fromForm: true,
  },

  // — 4 pending ————————————————————————————————————————————————————————————
  {
    key: "s4",
    title: "Shipping LLM features when latency is the product",
    description:
      "A 900ms response feels instant; a 4-second one feels broken. We share how we restructured an AI feature around a latency budget — streaming, speculative prefetch, aggressive caching, and the three features we cut because they could not be made fast.",
    status: "pending",
    kind: "abstract",
    submitter: "elena",
    speakers: ["elena"],
    track: "product",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["latency", "product"],
    takeaways: "How to set and defend a latency budget for an AI feature.",
    fromForm: true,
  },
  {
    key: "s5",
    title: "Vector databases at ten billion embeddings",
    description:
      "What breaks when your index no longer fits on one machine: sharding strategies, recall/cost trade-offs at scale, hybrid search that is actually hybrid, and the reindexing story nobody plans for until the embedding model changes.",
    status: "pending",
    kind: "abstract",
    submitter: "jonas",
    speakers: ["jonas"],
    track: "infra",
    format: "Talk",
    level: "Advanced",
    language: "English",
    tags: ["retrieval", "scale"],
    takeaways: "A decision framework for index topology and reindexing at scale.",
    fromForm: true,
  },
  {
    key: "s6",
    title: "From notebook to nine-nines: productionising ML in regulated healthcare",
    description:
      "A hands-on workshop taking a working notebook through the full path to a production clinical service: reproducible training, model registry, shadow deployment, audit trails and the documentation a regulator will actually ask for.",
    status: "pending",
    kind: "abstract",
    submitter: "daniel",
    speakers: ["daniel"],
    track: "infra",
    format: "Workshop",
    level: "Intermediate",
    language: "English",
    tags: ["mlops", "compliance"],
    takeaways: "A production readiness checklist for models in a regulated setting.",
    workshopDuration: "Half day",
    fromForm: true,
  },
  {
    key: "s7",
    title: "Teaching your model to say “I don't know”",
    description:
      "Abstention is a feature. We walk through calibration techniques, uncertainty signals that survive contact with production, and the interface patterns that let a model decline gracefully instead of confidently inventing an answer.",
    status: "pending",
    kind: "abstract",
    submitter: "hana",
    speakers: ["hana"],
    track: "ai",
    format: "Talk",
    level: "Advanced",
    language: "English",
    tags: ["calibration", "safety"],
    takeaways: "Practical uncertainty signals and how to surface them in a UI.",
    fromForm: true,
  },

  // — 2 in the accept queue ————————————————————————————————————————————————
  {
    key: "s8",
    title: "Structured output without the sadness",
    description:
      "Ten minutes on getting reliable JSON out of a language model: schema design that models can actually follow, constrained decoding, repair strategies, and when to stop fighting and use two calls.",
    status: "accept_queue",
    kind: "abstract",
    submitter: "yara",
    speakers: ["yara"],
    track: "ai",
    format: "Lightning talk",
    level: "Beginner",
    language: "English",
    tags: ["structured-output", "tooling"],
    takeaways: "Schema patterns that measurably raise structured-output success rates.",
    fromForm: true,
  },
  {
    key: "s9",
    title: "Cost modelling for inference-heavy products",
    description:
      "How to build a unit-economics model for an AI product before the invoice teaches you: per-request cost decomposition, the caching wins that matter, routing between model tiers, and how to talk about all of it with a finance team.",
    status: "accept_queue",
    kind: "abstract",
    submitter: "noah",
    speakers: ["noah"],
    track: "product",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["cost", "strategy"],
    takeaways: "A reusable unit-economics model for inference-heavy features.",
    fromForm: true,
  },

  // — 1 in the decline queue ————————————————————————————————————————————————
  {
    key: "s10",
    title: "Why we rewrote our stack in Rust (again)",
    description:
      "A candid retrospective on two rewrites, one of which was a mistake. Covers the performance wins that were real, the ones that were not, and the organisational cost of a rewrite nobody asked for.",
    status: "decline_queue",
    kind: "abstract",
    submitter: "grace",
    speakers: ["grace"],
    track: "infra",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["rust", "retrospective"],
    takeaways: "An honest cost model for a platform rewrite.",
    fromForm: true,
  },

  // — 4 accepted (all scheduled) ————————————————————————————————————————————
  {
    key: "s11",
    title: "Building reliable agents: a practitioner's playbook",
    description:
      "Agents fail in ways that traditional services do not: partially, plausibly, and expensively. This talk is the playbook we wish we had — bounded tool surfaces, idempotent actions, replayable traces, checkpointing, and the escalation paths that keep a human in the loop without keeping them in the way.",
    status: "accepted",
    kind: "abstract",
    submitter: "sofia",
    speakers: ["sofia", "ava"],
    track: "ai",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["agents", "reliability"],
    takeaways: "Seven design rules for agents that fail safely.",
    fromForm: true,
    schedule: { room: "main", startsAt: pt(2026, 10, 12, 10, 0), durationMinutes: 60 },
  },
  {
    key: "s12",
    title: "Evaluation harnesses for production LLMs",
    description:
      "A working tour of a real evaluation harness: dataset curation, judge prompts you can defend, statistical significance on small samples, and wiring the whole thing into CI so a regression blocks a deploy rather than surprising a customer.",
    status: "accepted",
    kind: "abstract",
    submitter: "tom",
    speakers: ["tom", "hana"],
    track: "ai",
    format: "Talk",
    level: "Advanced",
    language: "English",
    tags: ["evaluation", "ci"],
    takeaways: "A harness architecture you can copy, plus the statistics to read it honestly.",
    fromForm: true,
    schedule: { room: "workshop", startsAt: pt(2026, 10, 12, 10, 0), durationMinutes: 45 },
  },
  {
    key: "s13",
    title: "Serving four hundred models on one GPU fleet",
    description:
      "Multi-tenant inference from the operator's seat: scheduling, memory packing, cold-start mitigation, noisy-neighbour isolation, and the observability you need before you can safely oversubscribe anything.",
    status: "accepted",
    kind: "abstract",
    submitter: "liam",
    speakers: ["liam"],
    track: "infra",
    format: "Talk",
    level: "Advanced",
    language: "English",
    tags: ["gpu", "operations"],
    takeaways: "Concrete packing and scheduling tactics for shared inference fleets.",
    fromForm: true,
    schedule: { room: "main", startsAt: pt(2026, 10, 12, 11, 15), durationMinutes: 45 },
  },
  {
    key: "s14",
    title: "What users actually do with your AI feature",
    description:
      "Six months of session recordings, support tickets and telemetry from a shipped AI feature, and what they revealed: the prompts people really write, where they give up, the workarounds they invent, and the three changes that moved retention.",
    status: "accepted",
    kind: "abstract",
    submitter: "rafael",
    speakers: ["rafael", "elena"],
    track: "product",
    format: "Talk",
    level: "Beginner",
    language: "English",
    tags: ["research", "adoption"],
    takeaways: "A research method for understanding real AI-feature usage.",
    fromForm: true,
    schedule: { room: "main", startsAt: pt(2026, 10, 13, 9, 30), durationMinutes: 60 },
  },

  // — 1 declined, 1 withdrawn ————————————————————————————————————————————————
  {
    key: "s15",
    title: "Blockchain for model provenance",
    description:
      "A proposal to record model lineage and training-data attestations on a distributed ledger, with a walkthrough of a prototype implementation.",
    status: "declined",
    kind: "abstract",
    submitter: "marcus",
    speakers: ["marcus"],
    track: "infra",
    format: "Talk",
    level: "Beginner",
    language: "English",
    tags: ["provenance"],
    takeaways: "A ledger-backed approach to model lineage.",
    fromForm: true,
  },
  {
    key: "s16",
    title: "Fine-tuning small models on a budget",
    description:
      "Getting a 3B model to outperform a frontier model on one narrow task, for less than the price of a laptop. Covers data curation, LoRA settings that matter, and how to know when you are done.",
    status: "withdrawn",
    kind: "abstract",
    submitter: "grace",
    speakers: ["grace"],
    track: "ai",
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["fine-tuning"],
    takeaways: "A budget recipe for task-specific small models.",
    fromForm: true,
  },

  // — 2 manual agenda items (kind = session, never came through the form) ————
  {
    key: "m1",
    title: "Opening keynote: the year AI engineering grew up",
    description:
      "A look at what changed in the last twelve months — from demos to systems, from prompts to products — and what the discipline needs to figure out next.",
    status: "accepted",
    kind: "session",
    submitter: "priya",
    speakers: ["priya"],
    track: "ai",
    format: "Keynote",
    level: "Beginner",
    language: "English",
    tags: ["keynote"],
    takeaways: "A shared map of where the field is.",
    fromForm: false,
    schedule: { room: "main", startsAt: pt(2026, 10, 12, 9, 0), durationMinutes: 45 },
  },
  {
    key: "m2",
    title: "Closing panel: what we got wrong about agents",
    description:
      "Four practitioners compare notes on the agent architectures they abandoned, the assumptions that did not survive production, and what they would build differently today.",
    status: "accepted",
    kind: "session",
    submitter: "noah",
    speakers: ["noah", "daniel", "ava"],
    track: "product",
    format: "Panel",
    level: "Intermediate",
    language: "English",
    tags: ["panel", "agents"],
    takeaways: "Honest post-mortems from four production agent systems.",
    fromForm: false,
    schedule: { room: "main", startsAt: pt(2026, 10, 13, 16, 0), durationMinutes: 60 },
  },
]

type TaskSeed = {
  person: string
  title: string
  instructions: string
  kind: string
  dueInDays: number
  completedDaysAgo?: number
}

/**
 * Onboarding tasks for accepted speakers. Deliberately mixed so the Speakers
 * page and the dashboard chase list have something real to show, and so the
 * 72h reminder cron has work to do.
 */
const TASKS: TaskSeed[] = [
  // Priya — 3/3 complete (her slide deck is the seeded upload).
  { person: "priya", title: "Upload your headshot", instructions: "A square image, at least 800×800px. It appears on the public programme.", kind: "headshot", dueInDays: 12, completedDaysAgo: 9 },
  { person: "priya", title: "Confirm your biography", instructions: "Review the biography on your profile and confirm it is current.", kind: "confirm", dueInDays: 12, completedDaysAgo: 9 },
  { person: "priya", title: "Upload your slides", instructions: "PDF please, 16:9. We collect slides a week ahead so the AV team can test them.", kind: "upload", dueInDays: 20, completedDaysAgo: 2 },

  // Ava — 2/3, slides due inside the reminder window.
  { person: "ava", title: "Upload your headshot", instructions: "A square image, at least 800×800px. It appears on the public programme.", kind: "headshot", dueInDays: 12, completedDaysAgo: 6 },
  { person: "ava", title: "Confirm your biography", instructions: "Review the biography on your profile and confirm it is current.", kind: "confirm", dueInDays: 12, completedDaysAgo: 6 },
  { person: "ava", title: "Upload your slides", instructions: "PDF please, 16:9. We collect slides a week ahead so the AV team can test them.", kind: "upload", dueInDays: 2 },

  // Sofia — 1/3, headshot overdue.
  { person: "sofia", title: "Upload your headshot", instructions: "A square image, at least 800×800px. It appears on the public programme.", kind: "headshot", dueInDays: -2 },
  { person: "sofia", title: "Confirm your biography", instructions: "Review the biography on your profile and confirm it is current.", kind: "confirm", dueInDays: 12, completedDaysAgo: 4 },
  { person: "sofia", title: "Upload your slides", instructions: "PDF please, 16:9. We collect slides a week ahead so the AV team can test them.", kind: "upload", dueInDays: 20 },

  // Tom — 1/3, biography missing entirely.
  { person: "tom", title: "Upload your headshot", instructions: "A square image, at least 800×800px. It appears on the public programme.", kind: "headshot", dueInDays: 12, completedDaysAgo: 3 },
  { person: "tom", title: "Confirm your biography", instructions: "Add a short biography (60–100 words) so we can introduce you properly.", kind: "confirm", dueInDays: 1 },
  { person: "tom", title: "Upload your slides", instructions: "PDF please, 16:9. We collect slides a week ahead so the AV team can test them.", kind: "upload", dueInDays: 20 },

  // Liam — 1/3, biography missing entirely.
  { person: "liam", title: "Upload your headshot", instructions: "A square image, at least 800×800px. It appears on the public programme.", kind: "headshot", dueInDays: 12, completedDaysAgo: 1 },
  { person: "liam", title: "Confirm your biography", instructions: "Add a short biography (60–100 words) so we can introduce you properly.", kind: "confirm", dueInDays: 3 },
  { person: "liam", title: "Upload your slides", instructions: "PDF please, 16:9. We collect slides a week ahead so the AV team can test them.", kind: "upload", dueInDays: 20 },

  // Rafael — 1/3, headshot due inside the reminder window.
  { person: "rafael", title: "Upload your headshot", instructions: "A square image, at least 800×800px. It appears on the public programme.", kind: "headshot", dueInDays: 2 },
  { person: "rafael", title: "Confirm your biography", instructions: "Review the biography on your profile and confirm it is current.", kind: "confirm", dueInDays: 12, completedDaysAgo: 5 },
  { person: "rafael", title: "Upload your slides", instructions: "PDF please, 16:9. We collect slides a week ahead so the AV team can test them.", kind: "upload", dueInDays: 20 },
]

type EvaluationSeed = {
  submission: string
  evaluator: "alex" | "sam"
  overall: number
  relevance: number
  comment: string
}

/** 10 of 16 possible (plan × evaluator) pairs completed — ~60%. */
const EVALUATIONS: EvaluationSeed[] = [
  { submission: "s4", evaluator: "alex", overall: 4, relevance: 5, comment: "Strong, concrete and clearly grounded in real work. The latency-budget framing is the kind of thing attendees can apply on Monday." },
  { submission: "s4", evaluator: "sam", overall: 4, relevance: 4, comment: "Good talk. Would like a little more on measurement methodology, but the substance is there." },
  { submission: "s5", evaluator: "alex", overall: 5, relevance: 4, comment: "Genuinely advanced material from someone clearly operating at this scale. Rare and worth a main-stage slot." },
  { submission: "s5", evaluator: "sam", overall: 4, relevance: 3, comment: "Excellent depth, though the audience for ten-billion-vector problems may be narrow for this event." },
  { submission: "s6", evaluator: "alex", overall: 3, relevance: 4, comment: "Valuable and unusually well grounded in compliance reality, but a half-day workshop is a big ask for our schedule." },
  { submission: "s7", evaluator: "alex", overall: 5, relevance: 5, comment: "The best abstract in my batch. Abstention is under-discussed and this proposal treats it as an engineering problem rather than a research curiosity." },
  { submission: "s8", evaluator: "alex", overall: 4, relevance: 4, comment: "Tight, useful, and perfectly sized as a lightning talk. Easy yes." },
  { submission: "s8", evaluator: "sam", overall: 5, relevance: 4, comment: "Everyone in the room has fought this. Practical and well scoped." },
  { submission: "s9", evaluator: "alex", overall: 4, relevance: 5, comment: "Cost is the conversation every team is having and almost nobody submits about. Would schedule." },
  { submission: "s11", evaluator: "sam", overall: 5, relevance: 5, comment: "Clear, experienced and specific. The failure-mode taxonomy alone justifies the slot." },
]

// ——— The seed itself ——————————————————————————————————————————————————————

const seedSummaryValidator = v.object({
  eventId: v.id("events"),
  eventSlug: v.string(),
  secondEventId: v.id("events"),
  secondEventSlug: v.string(),
  organizerEmail: v.string(),
  organizerPassword: v.string(),
  counts: v.object({
    people: v.number(),
    submissions: v.number(),
    scheduled: v.number(),
    tasks: v.number(),
    evaluations: v.number(),
    messages: v.number(),
    templates: v.number(),
  }),
})

export type SeedSummary = Infer<typeof seedSummaryValidator>

export const run = internalMutation({
  args: { userId: v.string(), email: v.string() },
  returns: seedSummaryValidator,
  handler: async (ctx, args): Promise<SeedSummary> => {
    const now = Date.now()

    // — Idempotency: wipe both demo events before rebuilding —————————————
    await purgeBySlug(ctx, DEMO_EVENT_SLUG)
    await purgeBySlug(ctx, DEMO_SECOND_EVENT_SLUG)

    // — Demo workspace + owner membership (Better Auth user id) ——————————
    let organizationId: Id<"organizations">
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "ai-engineer"))
      .unique()
    if (existingOrg) {
      organizationId = existingOrg._id
    } else {
      organizationId = await ctx.db.insert("organizations", {
        name: "AI Engineer",
        slug: "ai-engineer",
      })
    }
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", args.userId),
      )
      .unique()
    if (!existingMember) {
      await ctx.db.insert("members", {
        organizationId,
        userId: args.userId,
        email: args.email,
        role: "owner",
      })
    }

    // — Event ————————————————————————————————————————————————————————————
    const eventId = await ctx.db.insert("events", {
      organizationId,
      name: "AI Engineer Summit 2026",
      slug: DEMO_EVENT_SLUG,
      type: "Conference",
      websiteUrl: "https://example.com/ai-summit-2026",
      description:
        "Two days for the people building AI systems that have to work on Monday morning. Practitioner talks on evaluation, agents, retrieval, inference infrastructure and the product decisions in between — no keynote fluff, no vendor pitches.",
      venue: "Moscone West, San Francisco",
      timezone: "America/Los_Angeles",
      startsAt: pt(2026, 10, 12, 9, 0),
      endsAt: pt(2026, 10, 13, 18, 0),
    })

    // — Rooms & tracks ————————————————————————————————————————————————————
    const roomIds = {
      main: await ctx.db.insert("rooms", {
        eventId,
        name: "Main Stage",
        capacity: 300,
        order: 0,
      }),
      workshop: await ctx.db.insert("rooms", {
        eventId,
        name: "Workshop Room",
        capacity: 80,
        order: 1,
      }),
    }

    const trackIds = {
      ai: await ctx.db.insert("tracks", {
        eventId,
        name: "AI Engineering",
        color: "#2F5CE0",
        order: 0,
      }),
      product: await ctx.db.insert("tracks", {
        eventId,
        name: "Product",
        color: "#1E9E6B",
        order: 1,
      }),
      infra: await ctx.db.insert("tracks", {
        eventId,
        name: "Infrastructure",
        color: "#B45309",
        order: 2,
      }),
    }
    const trackNames = { ai: "AI Engineering", product: "Product", infra: "Infrastructure" }

    // — The open call for papers ————————————————————————————————————————
    const formId = await ctx.db.insert("forms", {
      eventId,
      slug: "cfp",
      kind: "abstract",
      status: "open",
      closeAt: pt(2026, 9, 15, 23, 59),
      internalName: "CFP 2026 — main call",
      externalTitle: "Call for Speakers — AI Engineer Summit 2026",
      pageHeading: "Submit a talk",
      welcomeMessage:
        "We're looking for practitioner talks: things you built, things that broke, and what you learned. You don't need to be a famous speaker — you need a real story and something the audience can use.\n\nThe call closes on 15 September 2026. You may submit up to three proposals, and you can save a draft and come back to it at any time.",
      showWelcomeMessage: true,
      questions: [
        {
          id: "title",
          label: "Session title",
          type: "short_text",
          required: true,
          enabled: true,
          locked: true,
          placeholder: "A clear, specific title",
          help: "Aim for something an attendee could choose from a schedule without extra context.",
          maxChars: 120,
        },
        {
          id: "description",
          label: "Session description",
          type: "long_text",
          required: true,
          enabled: true,
          locked: true,
          placeholder: "What will you cover, and what will people leave knowing?",
          help: "150–300 words works best. This is what reviewers read first.",
          maxChars: 2000,
        },
        {
          id: "format",
          label: "Format",
          type: "dropdown",
          required: true,
          enabled: true,
          locked: false,
          options: ["Talk", "Workshop", "Lightning talk"],
          help: "Talks are 45 minutes, lightning talks 10, workshops are scheduled separately.",
        },
        {
          id: "track",
          label: "Track",
          type: "dropdown",
          required: true,
          enabled: true,
          locked: false,
          options: [trackNames.ai, trackNames.product, trackNames.infra],
          isTrackQuestion: true,
          help: "Pick the closest fit — we may move it during programming.",
        },
        {
          id: "level",
          label: "Audience level",
          type: "dropdown",
          required: true,
          enabled: true,
          locked: false,
          options: ["Beginner", "Intermediate", "Advanced"],
        },
        {
          id: "language",
          label: "Language",
          type: "dropdown",
          required: false,
          enabled: true,
          locked: false,
          options: ["English", "German", "Spanish"],
        },
        {
          id: "workshopDuration",
          label: "Workshop duration",
          type: "dropdown",
          required: false,
          enabled: true,
          locked: false,
          options: ["90 minutes", "Half day", "Full day"],
          showIf: { questionId: "format", equals: "Workshop" },
          help: "Only needed if you selected Workshop above.",
        },
        {
          id: "takeaways",
          label: "Key takeaways",
          type: "long_text",
          required: false,
          enabled: true,
          locked: false,
          placeholder: "What should someone be able to do after your session?",
          maxChars: 500,
        },
      ],
      participantConfig: {
        speakerMin: 1,
        speakerMax: 3,
        chairpersonEnabled: false,
        moderatorEnabled: false,
        sendConfirmationEmail: true,
        fields: [
          { id: "firstName", label: "First name", required: true, enabled: true, locked: true },
          { id: "lastName", label: "Last name", required: true, enabled: true, locked: true },
          { id: "email", label: "Email address", required: true, enabled: true, locked: true },
          { id: "jobTitle", label: "Job title", required: false, enabled: true, locked: false },
          { id: "company", label: "Company", required: false, enabled: true, locked: false },
          {
            id: "bio",
            label: "Biography",
            required: false,
            enabled: true,
            locked: false,
            help: "60–100 words. Used in the programme if your talk is accepted.",
          },
          { id: "headshot", label: "Headshot", required: false, enabled: true, locked: false },
          { id: "phone", label: "Phone number", required: false, enabled: false, locked: false },
        ],
      },
      settings: {
        limitPerUser: 3,
        allowDrafts: true,
        successMessage:
          "Thanks — your proposal is in. We'll email you when the programme committee has reviewed it.",
        autoRedirectToPortal: true,
        sendReminderEmail: true,
      },
      notifyEmails: [DEMO_ORGANIZER_EMAIL],
    })

    // — People ——————————————————————————————————————————————————————————
    const peopleIds: Record<string, Id<"people">> = {}
    const headshotTargets: Array<{
      personId: Id<"people">
      initials: string
      color: string
    }> = []

    for (const [index, person] of PEOPLE.entries()) {
      const id = await ctx.db.insert("people", {
        eventId,
        email: `${slugify(`${person.firstName} ${person.lastName}`).replace(/-/g, ".")}@example.com`,
        firstName: person.firstName,
        lastName: person.lastName,
        pronouns: person.pronouns,
        jobTitle: person.jobTitle,
        company: person.company,
        bio: person.bio,
        links: person.links,
        portalToken: portalTokenFor(person.firstName, person.lastName),
      })
      peopleIds[person.key] = id
      if (person.headshot) {
        headshotTargets.push({
          personId: id,
          initials: `${person.firstName[0]}${person.lastName[0]}`.toUpperCase(),
          color: AVATAR_COLORS[index % AVATAR_COLORS.length],
        })
      }
    }

    // — Submissions + participants ————————————————————————————————————————
    const submissionIds: Record<string, Id<"submissions">> = {}
    let scheduledCount = 0

    for (const seed of SUBMISSIONS) {
      const answers: Record<string, unknown> = {
        title: seed.title,
        description: seed.description,
        format: seed.format,
        track: trackNames[seed.track],
        level: seed.level,
        language: seed.language,
        takeaways: seed.takeaways,
      }
      if (seed.workshopDuration) answers.workshopDuration = seed.workshopDuration

      const decided =
        seed.status === "accepted" || seed.status === "declined"
          ? (seed.decidedAt ?? now - 6 * DAY)
          : undefined

      const submissionId = await ctx.db.insert("submissions", {
        eventId,
        formId: seed.fromForm ? formId : undefined,
        kind: seed.kind,
        title: seed.title,
        description: seed.description,
        answers,
        trackId: trackIds[seed.track],
        format: seed.format,
        level: seed.level,
        language: seed.language,
        tags: seed.tags,
        status: seed.status,
        submitterId: peopleIds[seed.submitter],
        decidedAt: decided,
        notifiedAt: seed.status === "accepted" ? now - 5 * DAY : undefined,
        roomId: seed.schedule ? roomIds[seed.schedule.room] : undefined,
        startsAt: seed.schedule?.startsAt,
        durationMinutes: seed.schedule?.durationMinutes,
      })
      submissionIds[seed.key] = submissionId
      if (seed.schedule) scheduledCount++

      for (const [order, speakerKey] of seed.speakers.entries()) {
        await ctx.db.insert("submissionParticipants", {
          submissionId,
          eventId,
          personId: peopleIds[speakerKey],
          role: "speaker",
          order,
        })
      }
    }

    // — Evaluation ————————————————————————————————————————————————————————
    const criteria = [
      { id: "overall", label: "Overall" },
      { id: "relevance", label: "Relevance" },
    ]
    const round1SubmissionKeys = ["s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"]
    const round1Id = await ctx.db.insert("evaluationPlans", {
      eventId,
      name: "Round 1 — Programme Committee",
      round: 1,
      criteria,
      submissionIds: round1SubmissionKeys.map((key) => submissionIds[key]),
      dueAt: pt(2026, 9, 25, 17, 0),
      status: "open",
    })
    // Round 2 is deliberately empty and closed — it proves the UI handles a
    // plan with no submissions and no evaluators.
    await ctx.db.insert("evaluationPlans", {
      eventId,
      name: "Round 2 — Final Review",
      round: 2,
      criteria,
      submissionIds: [],
      status: "closed",
    })

    const evaluatorIds = {
      alex: await ctx.db.insert("evaluators", {
        planId: round1Id,
        eventId,
        email: "alex.rivera@example.com",
        name: "Alex Rivera",
        token: "demo-eval-alex",
      }),
      sam: await ctx.db.insert("evaluators", {
        planId: round1Id,
        eventId,
        email: "sam.okafor@example.com",
        name: "Sam Okafor",
        token: "demo-eval-sam",
      }),
    }

    for (const [index, evaluation] of EVALUATIONS.entries()) {
      await ctx.db.insert("evaluations", {
        planId: round1Id,
        eventId,
        submissionId: submissionIds[evaluation.submission],
        evaluatorId: evaluatorIds[evaluation.evaluator],
        scores: { overall: evaluation.overall, relevance: evaluation.relevance },
        comment: evaluation.comment,
        completedAt: now - (10 - index) * 0.5 * DAY,
      })
    }

    // — Speaker tasks ——————————————————————————————————————————————————————
    const taskIds: Record<string, Id<"tasks">> = {}
    for (const task of TASKS) {
      const id = await ctx.db.insert("tasks", {
        eventId,
        personId: peopleIds[task.person],
        title: task.title,
        instructions: task.instructions,
        kind: task.kind,
        dueAt: now + task.dueInDays * DAY,
        completedAt:
          task.completedDaysAgo === undefined
            ? undefined
            : now - task.completedDaysAgo * DAY,
      })
      taskIds[`${task.person}:${task.kind}`] = id
    }

    // — Email templates ————————————————————————————————————————————————————
    for (const template of DEFAULT_TEMPLATES) {
      await ctx.db.insert("emailTemplates", {
        eventId,
        key: template.key,
        name: template.name,
        subject: template.subject,
        body: template.body,
      })
    }

    // — Outbox: 2 sent, 1 preview ————————————————————————————————————————
    const messagesSeeded = await seedOutbox(ctx, {
      eventId,
      eventName: "AI Engineer Summit 2026",
      now,
      peopleIds,
      submissionIds,
    })

    // — Second event: proves cross-event scoping ————————————————————————
    const secondEventId = await seedSecondEvent(ctx, organizationId, now)

    // — Storage-backed assets have to be created from an action ——————————
    await ctx.scheduler.runAfter(0, internal.seed.attachDemoAssets, {
      headshots: headshotTargets,
      slides: {
        eventId,
        personId: peopleIds.priya,
        taskId: taskIds["priya:upload"],
        submissionId: submissionIds.m1,
        title: "Opening keynote: the year AI engineering grew up",
        speakerName: "Priya Raghavan",
      },
    })

    return {
      eventId,
      eventSlug: DEMO_EVENT_SLUG,
      secondEventId,
      secondEventSlug: DEMO_SECOND_EVENT_SLUG,
      organizerEmail: DEMO_ORGANIZER_EMAIL,
      organizerPassword: DEMO_ORGANIZER_PASSWORD,
      counts: {
        people: PEOPLE.length,
        submissions: SUBMISSIONS.length,
        scheduled: scheduledCount,
        tasks: TASKS.length,
        evaluations: EVALUATIONS.length,
        messages: messagesSeeded,
        templates: DEFAULT_TEMPLATES.length,
      },
    }
  },
})

/** Three outbox rows so Communications is never an empty screen. */
async function seedOutbox(
  ctx: MutationCtx,
  opts: {
    eventId: Id<"events">
    eventName: string
    now: number
    peopleIds: Record<string, Id<"people">>
    submissionIds: Record<string, Id<"submissions">>
  },
): Promise<number> {
  const byKey = Object.fromEntries(DEFAULT_TEMPLATES.map((t) => [t.key, t]))

  const rows: Array<{
    personKey: string
    templateKey: string
    submissionKey?: string
    sessionTitle: string
    status: string
    sentDaysAgo?: number
    icsAttached: boolean
  }> = [
    {
      personKey: "ava",
      templateKey: "confirmation",
      submissionKey: "s11",
      sessionTitle: "Building reliable agents: a practitioner's playbook",
      status: "sent",
      sentDaysAgo: 12,
      icsAttached: false,
    },
    {
      personKey: "sofia",
      templateKey: "accepted",
      submissionKey: "s11",
      sessionTitle: "Building reliable agents: a practitioner's playbook",
      status: "sent",
      sentDaysAgo: 5,
      icsAttached: true,
    },
    {
      personKey: "tom",
      templateKey: "reminder",
      sessionTitle: "Evaluation harnesses for production LLMs",
      status: "preview",
      icsAttached: false,
    },
  ]

  for (const row of rows) {
    const person = await ctx.db.get("people", opts.peopleIds[row.personKey])
    if (!person) continue
    const template = byKey[row.templateKey]
    const vars = {
      speakerName: `${person.firstName} ${person.lastName}`,
      firstName: person.firstName,
      eventName: opts.eventName,
      sessionTitle: row.sessionTitle,
      portalLink: portalLinkFor(person.portalToken),
    }
    const sentAt =
      row.sentDaysAgo === undefined ? undefined : opts.now - row.sentDaysAgo * DAY
    await ctx.db.insert("messages", {
      eventId: opts.eventId,
      personId: person._id,
      templateKey: row.templateKey,
      toEmail: person.email,
      subject: renderTemplate(template.subject, vars),
      body: renderTemplate(template.body, vars),
      submissionId: row.submissionKey
        ? opts.submissionIds[row.submissionKey]
        : undefined,
      icsAttached: row.icsAttached,
      scheduledAt: sentAt !== undefined ? sentAt - 60_000 : opts.now - DAY,
      sentAt,
      status: row.status,
    })
  }
  return rows.length
}

/**
 * A second, minimal event. It exists purely so that every organizer screen can
 * be checked for leakage: nothing below should ever appear under the summit.
 */
async function seedSecondEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<Id<"events">> {
  const eventId = await ctx.db.insert("events", {
    organizationId,
    name: "Design Systems Day",
    slug: DEMO_SECOND_EVENT_SLUG,
    type: "Meetup",
    description:
      "A single-track day for the people who maintain design systems, and everyone who has to live with them.",
    venue: "Brooklyn Expo Center, New York",
    timezone: "America/New_York",
    startsAt: et(2026, 11, 5, 9, 0),
    endsAt: et(2026, 11, 5, 18, 0),
  })

  const trackId = await ctx.db.insert("tracks", {
    eventId,
    name: "Design Systems",
    color: "#7C3AED",
    order: 0,
  })
  const roomId = await ctx.db.insert("rooms", {
    eventId,
    name: "Studio",
    capacity: 120,
    order: 0,
  })

  const formId = await ctx.db.insert("forms", {
    eventId,
    // Form slugs are looked up with a global `by_slug` index — keep them unique.
    slug: "ds-cfp",
    kind: "abstract",
    status: "closed",
    closeAt: now - 20 * DAY,
    internalName: "Design Systems Day — call for talks",
    externalTitle: "Call for Speakers — Design Systems Day",
    pageHeading: "Submit a talk",
    welcomeMessage: "This call is now closed. Thank you to everyone who submitted.",
    showWelcomeMessage: true,
    questions: [
      {
        id: "title",
        label: "Session title",
        type: "short_text",
        required: true,
        enabled: true,
        locked: true,
        maxChars: 120,
      },
      {
        id: "description",
        label: "Session description",
        type: "long_text",
        required: true,
        enabled: true,
        locked: true,
        maxChars: 2000,
      },
    ],
    participantConfig: {
      speakerMin: 1,
      speakerMax: 2,
      chairpersonEnabled: false,
      moderatorEnabled: false,
      sendConfirmationEmail: false,
      fields: [
        { id: "firstName", label: "First name", required: true, enabled: true, locked: true },
        { id: "lastName", label: "Last name", required: true, enabled: true, locked: true },
        { id: "email", label: "Email address", required: true, enabled: true, locked: true },
        { id: "company", label: "Company", required: false, enabled: true, locked: false },
      ],
    },
    settings: {
      limitPerUser: 2,
      allowDrafts: false,
      autoRedirectToPortal: false,
      sendReminderEmail: false,
    },
    notifyEmails: [DEMO_ORGANIZER_EMAIL],
  })

  const irisId = await ctx.db.insert("people", {
    eventId,
    email: "iris.chen@example.com",
    firstName: "Iris",
    lastName: "Chen",
    jobTitle: "Design Systems Lead",
    company: "Beacon Studio",
    bio: "Iris maintains a design system used by nine product teams and has strong opinions about token naming.",
    portalToken: portalTokenFor("Iris", "Chen"),
  })
  const owenId = await ctx.db.insert("people", {
    eventId,
    email: "owen.baptiste@example.com",
    firstName: "Owen",
    lastName: "Baptiste",
    jobTitle: "Staff Frontend Engineer",
    company: "Harbourline",
    bio: "Owen led a 200-component migration without freezing product work, and lived to describe how.",
    portalToken: portalTokenFor("Owen", "Baptiste"),
  })

  const sub1 = await ctx.db.insert("submissions", {
    eventId,
    formId,
    kind: "abstract",
    title: "Tokens all the way down",
    description:
      "A practical look at multi-tier token architectures: primitives, semantics, component tokens, and where each layer starts to cost more than it gives back.",
    answers: {
      title: "Tokens all the way down",
      description:
        "A practical look at multi-tier token architectures and where each layer stops paying for itself.",
    },
    trackId,
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tags: ["tokens"],
    status: "pending",
    submitterId: irisId,
  })
  const sub2 = await ctx.db.insert("submissions", {
    eventId,
    formId,
    kind: "abstract",
    title: "Migrating 200 components without a freeze",
    description:
      "How we replaced a design system underneath a shipping product: codemods, dual-rendering, adoption metrics, and the six months of patience it required.",
    answers: {
      title: "Migrating 200 components without a freeze",
      description:
        "Codemods, dual-rendering and adoption metrics for a design system migration under load.",
    },
    trackId,
    format: "Talk",
    level: "Advanced",
    language: "English",
    tags: ["migration"],
    status: "accepted",
    submitterId: owenId,
    decidedAt: now - 3 * DAY,
    roomId,
    startsAt: et(2026, 11, 5, 11, 0),
    durationMinutes: 45,
  })

  await ctx.db.insert("submissionParticipants", {
    submissionId: sub1,
    eventId,
    personId: irisId,
    role: "speaker",
    order: 0,
  })
  await ctx.db.insert("submissionParticipants", {
    submissionId: sub2,
    eventId,
    personId: owenId,
    role: "speaker",
    order: 0,
  })

  return eventId
}

// ——— Storage-backed demo assets ——————————————————————————————————————————

export const attachDemoAssets = internalAction({
  args: {
    headshots: v.array(
      v.object({
        personId: v.id("people"),
        initials: v.string(),
        color: v.string(),
      }),
    ),
    slides: v.optional(
      v.object({
        eventId: v.id("events"),
        personId: v.id("people"),
        taskId: v.id("tasks"),
        submissionId: v.id("submissions"),
        title: v.string(),
        speakerName: v.string(),
      }),
    ),
  },
  returns: v.object({ headshots: v.number(), uploads: v.number() }),
  handler: async (ctx, args) => {
    let headshots = 0
    for (const target of args.headshots) {
      const svg = buildAvatarSvg(target.initials, target.color)
      const storageId = await ctx.storage.store(
        new Blob([svg], { type: "image/svg+xml" }),
      )
      await ctx.runMutation(internal.seed.applyHeadshot, {
        personId: target.personId,
        storageId,
      })
      headshots++
    }

    let uploads = 0
    if (args.slides) {
      const pdf = buildDemoPdf(args.slides.title, args.slides.speakerName)
      const storageId = await ctx.storage.store(
        new Blob([pdf], { type: "application/pdf" }),
      )
      await ctx.runMutation(internal.seed.applyUpload, {
        eventId: args.slides.eventId,
        personId: args.slides.personId,
        taskId: args.slides.taskId,
        submissionId: args.slides.submissionId,
        storageId,
        filename: "opening-keynote-slides.pdf",
        contentType: "application/pdf",
        size: pdf.length,
      })
      uploads++
    }

    return { headshots, uploads }
  },
})

export const applyHeadshot = internalMutation({
  args: { personId: v.id("people"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) {
      // The seed was re-run and this person no longer exists — drop the file.
      await ctx.storage.delete(args.storageId)
      return null
    }
    if (person.headshotId) await ctx.storage.delete(person.headshotId)
    await ctx.db.patch("people", args.personId, { headshotId: args.storageId })
    return null
  },
})

export const applyUpload = internalMutation({
  args: {
    eventId: v.id("events"),
    personId: v.id("people"),
    taskId: v.id("tasks"),
    submissionId: v.id("submissions"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    const task = await ctx.db.get("tasks", args.taskId)
    if (!person || !task) {
      await ctx.storage.delete(args.storageId)
      return null
    }
    await ctx.db.insert("uploads", {
      eventId: args.eventId,
      personId: args.personId,
      submissionId: args.submissionId,
      taskId: args.taskId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      version: 1,
      approvalStatus: "approved",
      reviewNote: "Looks great — AV have the deck.",
    })
    return null
  },
})

/** Circular avatar with initials — a real image, no external dependency. */
function buildAvatarSvg(initials: string, color: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">',
    `<rect width="256" height="256" rx="128" fill="${color}"/>`,
    '<text x="128" y="132" text-anchor="middle" dominant-baseline="middle"',
    ' font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"',
    ` font-size="96" font-weight="600" fill="#FFFFFF">${initials}</text>`,
    "</svg>",
  ].join("")
}

/**
 * A genuinely valid single-page PDF (correct xref offsets), so the seeded slide
 * deck actually opens. ASCII only, which keeps byte offsets equal to string
 * indices.
 */
function buildDemoPdf(title: string, subtitle: string): string {
  const esc = (value: string) =>
    value
      .replace(/[^\x20-\x7e]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")

  const content =
    "BT\n/F1 22 Tf\n60 700 Td\n" +
    `(${esc(title)}) Tj\nET\n` +
    "BT\n/F1 13 Tf\n60 668 Td\n" +
    `(${esc(subtitle)} - AI Engineer Summit 2026) Tj\nET\n` +
    "BT\n/F1 11 Tf\n60 636 Td\n" +
    "(Placeholder deck generated by the Sessionboard OSS demo seed.) Tj\nET\n"

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`
  return pdf
}

// ——— Public reset (organizer-only) ————————————————————————————————————————

/**
 * Reset the demo from the UI. Requires an organizer session; note that the demo
 * event is recreated with a NEW id, so callers must re-resolve it by slug.
 */
export const reseed = mutation({
  args: {},
  returns: seedSummaryValidator,
  handler: async (ctx): Promise<SeedSummary> => {
    const user = await requireUser(ctx)
    const summary: SeedSummary = await ctx.runMutation(internal.seed.run, {
      userId: user.userId,
      email: user.email,
    })
    return summary
  },
})

// ——— Bootstrap: create the Better Auth demo user, then seed ———————————————
// Entry point: `npx convex run seed:setup`
export const setup = internalAction({
  args: {},
  returns: seedSummaryValidator,
  handler: async (ctx): Promise<SeedSummary> => {
    const auth = createAuth(ctx)
    let userId: string | null = null
    try {
      const res = await auth.api.signUpEmail({
        body: {
          email: DEMO_ORGANIZER_EMAIL,
          password: DEMO_ORGANIZER_PASSWORD,
          name: DEMO_ORGANIZER_NAME,
        },
      })
      userId = res.user.id
    } catch {
      // Already exists — sign in to resolve the user id.
      const res = await auth.api.signInEmail({
        body: {
          email: DEMO_ORGANIZER_EMAIL,
          password: DEMO_ORGANIZER_PASSWORD,
        },
      })
      userId = res.user.id
    }
    if (!userId) throw new Error("Could not create or resolve the demo user")
    return await ctx.runMutation(internal.seed.run, {
      userId,
      email: DEMO_ORGANIZER_EMAIL,
    })
  },
})
