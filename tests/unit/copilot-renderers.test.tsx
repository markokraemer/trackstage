// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Every copilot tool view, rendered.
 *
 * The payloads come from `tests/fixtures/copilot-tool-payloads.json`, which
 * `scripts/verify-copilot.mjs` writes from REAL runs against the live MCP
 * server — so these tests draw what the server actually returns, not what we
 * imagined it returns. The inline `SHAPES` below are the fallback for any tool
 * the last capture missed (and the source of the deliberately hostile empty /
 * malformed cases, which a live run can't produce on demand).
 */

// TanStack `Link` needs a router; the views only ever use it to build an href,
// so a plain anchor is a faithful stand-in and keeps the suite router-free.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    params,
    children,
    ...rest
  }: {
    to?: string
    search?: Record<string, unknown>
    params?: Record<string, string>
    children?: React.ReactNode
  } & Record<string, unknown>) => {
    let href = String(to ?? "#")
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value)
      }
    }
    const query = search
      ? Object.entries(search)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join("&")
      : ""
    return (
      <a href={query ? `${href}?${query}` : href} {...rest}>
        {children}
      </a>
    )
  },
}))

const { CopilotToolOutput, TOOL_VIEWS, hasToolView } =
  await import("@/components/copilot/tool-views/registry")
const { MCP_TOOL_COUNT, MCP_TOOL_GROUPS } = await import("@/docs/generated/mcp-tools")

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

/**
 * The tools the copilot must draw richly — read from the GENERATED MCP tool
 * table (`scripts/generate-mcp-tools.mjs` writes it from `convex/mcp.ts`), not
 * hand-maintained here.
 *
 * That is the point of the 2026-08-11 generative-UI pass: the registry is no
 * longer a curated subset that quietly falls behind the server. Every tool the
 * server exposes has a purpose-built view, so the list and the server are the
 * same list by construction — add a tool to `convex/mcp.ts` and this suite
 * fails until it has a view and a fixture.
 */
const ALL_TOOLS: ReadonlyArray<string> = MCP_TOOL_GROUPS.flatMap((group) =>
  group.tools.map((tool) => tool.name)
)

type Payload = { input: unknown; output: unknown }

/**
 * Hand-written stand-ins, shaped exactly like the internal queries in
 * convex/mcp.ts. Used when a live capture is unavailable, and always used for
 * the assertions that name specific strings.
 */
const SHAPES: Record<string, Payload> = {
  list_workspaces: {
    input: {},
    output: {
      workspaces: [
        {
          organizationId: "org1",
          name: "Sessionboard Demo",
          slug: "demo",
          yourRole: "owner",
          eventCount: 2,
        },
      ],
    },
  },
  list_events: {
    input: {},
    output: {
      events: [
        {
          eventId: "ev1",
          slug: "ai-summit-2026",
          name: "AI Engineer Summit 2026",
          type: "Conference",
          venue: "Moscone West",
          timezone: "America/Los_Angeles",
          startsAt: "2026-09-14T16:00:00.000Z",
          endsAt: "2026-09-15T01:00:00.000Z",
          organizationId: "org1",
          organizationName: "Sessionboard Demo",
          yourRole: "owner",
        },
      ],
    },
  },
  create_event: {
    input: { name: "Copilot Verification Event" },
    output: {
      eventId: "ev2",
      slug: "copilot-verification-event",
      name: "Copilot Verification Event",
      publicSubmitUrlHint: "http://localhost:3000/submit/ai-summit-2026/<form-slug>",
    },
  },
  get_event_overview: {
    input: { event: "ai-summit-2026" },
    output: {
      event: {
        eventId: "ev1",
        name: "AI Engineer Summit 2026",
        slug: "ai-summit-2026",
        timezone: "America/Los_Angeles",
        startsAt: "2026-09-14T16:00:00.000Z",
        endsAt: "2026-09-15T01:00:00.000Z",
        venue: "Moscone West",
      },
      totalSubmissions: 24,
      statusCounts: {
        draft: 1,
        pending: 8,
        accept_queue: 2,
        decline_queue: 0,
        accepted: 10,
        declined: 3,
        withdrawn: 0,
      },
      openTaskCount: 7,
      scheduledSessions: 6,
      acceptedNotYetScheduled: 4,
      agendaConflicts: 1,
      outbox: { sent: 12, preview: 3, failed: 0 },
      forms: [
        {
          formId: "form1",
          name: "Main CFP 2026",
          slug: "main-cfp-2026",
          status: "open",
          closeAt: "2026-08-01T00:00:00.000Z",
          publicUrl: "http://localhost:3000/submit/ai-summit-2026/main-cfp-2026",
        },
      ],
    },
  },
  get_event_summary: {
    input: { event: "ai-summit-2026" },
    output: {
      headline:
        "AI Engineer Summit 2026 — 24 submission(s): 10 accepted, 8 pending, 3 declined. 6 session(s) scheduled across 1 form(s).",
      event: {
        eventId: "ev1",
        name: "AI Engineer Summit 2026",
        slug: "ai-summit-2026",
        timezone: "America/Los_Angeles",
        startsAt: "2026-09-14T16:00:00.000Z",
        endsAt: "2026-09-15T01:00:00.000Z",
        venue: "Moscone West",
      },
      submissions: {
        draft: 1,
        pending: 8,
        accept_queue: 2,
        decline_queue: 0,
        accepted: 10,
        declined: 3,
        withdrawn: 0,
      },
      agenda: {
        scheduled: 6,
        acceptedNotScheduled: 4,
        conflicts: ["Room Main Stage is double-booked at 10:00"],
      },
      speakerTasks: { open: 7, completed: 11 },
      forms: [
        {
          name: "Main CFP 2026",
          status: "open",
          publicUrl: "http://localhost:3000/submit/ai-summit-2026/main-cfp-2026",
          closesAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      needsAttention: [
        "8 submission(s) still pending review",
        "2 staged in the accept queue — commit_decision_queue sends the acceptance emails",
      ],
      upcomingDeadlines: [
        {
          what: 'CFP "Main CFP 2026" closes',
          when: "2026-08-01T00:00:00.000Z",
          daysAway: 3,
        },
        {
          what: "AI Engineer Summit 2026 starts",
          when: "2026-09-14T16:00:00.000Z",
          daysAway: 47,
        },
      ],
    },
  },
  list_forms: {
    input: { event: "ai-summit-2026" },
    output: {
      forms: [
        {
          formId: "form1",
          name: "Main CFP 2026",
          externalTitle: "Call for Speakers",
          slug: "main-cfp-2026",
          kind: "abstract",
          status: "open",
          closeAt: "2026-08-01T00:00:00.000Z",
          publicUrl: "http://localhost:3000/submit/ai-summit-2026/main-cfp-2026",
          submissionCount: 23,
          draftCount: 1,
        },
      ],
    },
  },
  get_form: {
    input: { form: "main-cfp-2026" },
    output: {
      formId: "form1",
      eventId: "ev1",
      name: "Main CFP 2026",
      externalTitle: "Call for Speakers",
      pageHeading: "Call for Speakers",
      welcomeMessage: "<p>We'd love to hear from you!</p>",
      slug: "main-cfp-2026",
      kind: "abstract",
      status: "open",
      closeAt: "2026-08-01T00:00:00.000Z",
      publicUrl: "http://localhost:3000/submit/ai-summit-2026/main-cfp-2026",
      questions: [
        {
          id: "title",
          label: "Title",
          type: "short_text",
          required: true,
          enabled: true,
          locked: true,
          options: null,
          showIf: null,
          isTrackQuestion: false,
        },
        {
          id: "track",
          label: "Track",
          type: "dropdown",
          required: true,
          enabled: true,
          locked: false,
          options: ["Agents", "Infra"],
          showIf: null,
          isTrackQuestion: true,
        },
        {
          id: "level",
          label: "Level",
          type: "dropdown",
          required: false,
          enabled: false,
          locked: false,
          options: ["Intro"],
          showIf: { questionId: "track" },
          isTrackQuestion: false,
        },
      ],
      participantConfig: {
        speakerMin: 1,
        speakerMax: 4,
        fields: [
          {
            id: "firstName",
            label: "First Name",
            required: true,
            enabled: true,
            locked: true,
          },
          {
            id: "phone",
            label: "Mobile Phone",
            required: false,
            enabled: false,
            locked: false,
          },
        ],
      },
      settings: { allowDrafts: true, sendReminderEmail: true, limitPerUser: 3 },
      notifyEmails: [],
    },
  },
  create_form: {
    input: {
      event: "ai-summit-2026",
      name: "Copilot Verification CFP",
      kind: "abstract",
    },
    output: {
      formId: "form2",
      slug: "copilot-verification-cfp",
      publicUrl: "http://localhost:3000/submit/ai-summit-2026/copilot-verification-cfp",
      status: "open",
    },
  },
  update_form_settings: {
    input: { form: "copilot-verification-cfp", status: "closed" },
    output: {
      formId: "form2",
      status: "closed",
      closeAt: null,
      publicUrl: "http://localhost:3000/submit/ai-summit-2026/copilot-verification-cfp",
      settings: { allowDrafts: true, sendReminderEmail: true },
      previous: {
        status: "open",
        closeAt: null,
        settings: { allowDrafts: true, sendReminderEmail: true },
      },
    },
  },
  get_public_form_link: {
    input: { form: "main-cfp-2026" },
    output: {
      formId: "form1",
      name: "Main CFP 2026",
      publicUrl: "http://localhost:3000/submit/ai-summit-2026/main-cfp-2026",
      status: "open",
      closeAt: "2026-08-01T00:00:00.000Z",
      acceptingSubmissions: true,
      note: "Share this link with prospective speakers.",
    },
  },
  list_submissions: {
    input: { event: "ai-summit-2026", status: "pending" },
    output: {
      total: 12,
      returned: 12,
      submissions: Array.from({ length: 12 }, (_, index) => ({
        submissionId: `sub${index}`,
        title: `Scaling agents in production ${index}`,
        status: "pending",
        kind: "abstract",
        track: index % 2 === 0 ? "Agents" : "Infrastructure",
        format: "Talk",
        level: "Intermediate",
        tags: ["AI"],
        speakers: [
          `Ada Lovelace <ada${index}@example.com>`,
          "Grace Hopper <grace@example.com>",
        ],
        scheduled:
          index === 0
            ? {
                startsAt: "2026-09-14T17:00:00.000Z",
                durationMinutes: 45,
                room: "Main Stage",
              }
            : null,
      })),
    },
  },
  get_submission: {
    input: { submissionId: "sub0" },
    output: {
      submissionId: "sub0",
      title: "Scaling agents in production",
      status: "accepted",
      kind: "abstract",
      track: "Agents",
      format: "Talk",
      level: "Intermediate",
      tags: ["AI", "Infrastructure"],
      speakers: ["Ada Lovelace <ada@example.com>"],
      scheduled: {
        startsAt: "2026-09-14T17:00:00.000Z",
        durationMinutes: 45,
        room: "Main Stage",
      },
      description: "<p>A talk about running agents at scale.</p>",
      answers: { format: "Talk" },
      formName: "Main CFP 2026",
      decidedAt: "2026-07-01T00:00:00.000Z",
      notifiedAt: "2026-07-01T00:00:00.000Z",
      participants: [
        { name: "Ada Lovelace", email: "ada@example.com", role: "speaker" },
      ],
      uploads: [
        {
          filename: "slides.pdf",
          version: 2,
          approvalStatus: "pending",
          reviewNote: null,
        },
      ],
      evaluation: {
        completedReviews: 3,
        averageScore: 4.33,
        comments: ["Strong speaker.", "Would love more detail."],
      },
    },
  },
  set_submission_status: {
    input: { submissionId: "sub0", status: "accept_queue" },
    output: {
      submissionId: "sub0",
      title: "Scaling agents in production",
      previousStatus: "pending",
      status: "accept_queue",
      note: "Staged only — no email has been sent. Run commit_decision_queue to notify the speakers.",
    },
  },
  commit_decision_queue: {
    input: { event: "ai-summit-2026", queue: "accept_queue", confirm: true },
    output: {
      queue: "accept_queue",
      committed: 3,
      emailsQueued: 4,
      titles: [
        "Scaling agents in production",
        "The RAG we deserve",
        "Eval-driven development",
      ],
      note: "Decision emails are queued in the outbox; check them with list_outbox.",
    },
  },
  add_manual_session: {
    input: {
      event: "ai-summit-2026",
      title: "Copilot Verification Keynote",
      track: "Agents",
      format: "Keynote",
    },
    output: {
      submissionId: "sub99",
      title: "Copilot Verification Keynote",
      kind: "session",
      status: "accepted",
      speakers: ["ada@example.com"],
    },
  },
  get_agenda: {
    input: { event: "ai-summit-2026" },
    output: {
      event: {
        name: "AI Engineer Summit 2026",
        timezone: "America/Los_Angeles",
        startsAt: "2026-09-14T16:00:00.000Z",
        endsAt: "2026-09-15T01:00:00.000Z",
      },
      rooms: [
        { roomId: "room1", name: "Main Stage", capacity: 400 },
        { roomId: "room2", name: "Workshop Room", capacity: 80 },
      ],
      scheduled: [
        {
          submissionId: "sub0",
          title: "Opening keynote",
          startsAt: "2026-09-14T17:00:00.000Z",
          durationMinutes: 45,
          room: "Main Stage",
          roomId: "room1",
          track: "Agents",
          speakers: ["Ada Lovelace"],
        },
        {
          submissionId: "sub1",
          title: "Eval-driven development",
          startsAt: "2026-09-14T18:00:00.000Z",
          durationMinutes: 45,
          room: "Workshop Room",
          roomId: "room2",
          track: "Infra",
          speakers: ["Grace Hopper"],
        },
        {
          submissionId: "sub2",
          title: "Day two opener",
          startsAt: "2026-09-15T17:00:00.000Z",
          durationMinutes: 30,
          room: "Main Stage",
          roomId: "room1",
          track: null,
          speakers: [],
        },
      ],
      unscheduled: [
        {
          submissionId: "sub3",
          title: "The RAG we deserve",
          startsAt: null,
          durationMinutes: 45,
          room: null,
          roomId: null,
          track: "Agents",
          speakers: ["Alan Turing"],
        },
      ],
      conflicts: [
        {
          kind: "room",
          problem: "Main Stage is double-booked at 10:00",
          sessions: ["Opening keynote", "Day two opener"],
          submissionIds: ["sub0", "sub2"],
        },
      ],
    },
  },
  schedule_session: {
    input: {
      submissionId: "sub99",
      room: "Main Stage",
      startsAt: "2026-09-14T17:00:00Z",
      durationMinutes: 30,
    },
    output: {
      submissionId: "sub99",
      title: "Copilot Verification Keynote",
      room: "Main Stage",
      startsAt: "2026-09-14T17:00:00.000Z",
      durationMinutes: 30,
      conflicts: ["Main Stage is double-booked with Opening keynote"],
    },
  },
  unschedule_session: {
    input: { submissionId: "sub99" },
    output: {
      submissionId: "sub99",
      title: "Copilot Verification Keynote",
      note: "Moved back to the unscheduled tray.",
    },
  },
  auto_place_sessions: {
    input: { event: "ai-summit-2026" },
    output: {
      placed: 4,
      couldNotFit: 1,
      conflictsAfterwards: 0,
      note: "Existing scheduled sessions were left untouched; only the unscheduled tray was filled.",
    },
  },
  list_speakers: {
    input: { event: "ai-summit-2026", onlyWithOutstandingWork: true },
    output: {
      speakerCount: 2,
      speakers: [
        {
          personId: "p1",
          name: "Ada Lovelace",
          email: "ada@example.com",
          company: "Analytical Engines",
          jobTitle: "Principal Engineer",
          sessions: ["Scaling agents in production"],
          outstandingTasks: [
            {
              taskId: "t1",
              title: "Upload your slides",
              kind: "upload",
              dueAt: "2026-09-01T00:00:00.000Z",
            },
          ],
          missingProfileItems: ["bio", "headshot"],
        },
        {
          personId: "p2",
          name: "Grace Hopper",
          email: "grace@example.com",
          company: null,
          jobTitle: null,
          sessions: ["Eval-driven development"],
          outstandingTasks: [],
          missingProfileItems: [],
        },
      ],
    },
  },
  get_speaker_portal_link: {
    input: { event: "ai-summit-2026", speaker: "ada@example.com" },
    output: {
      personId: "p1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      portalUrl: "http://localhost:3000/portal/t/abc123token",
      note: "A private magic link — it signs this speaker straight into their portal.",
    },
  },
  list_task_library: {
    input: { event: "ai-summit-2026" },
    output: {
      templates: [
        {
          id: "nx70000000000000000000000000000t1",
          title: "Upload your slides",
          kind: "upload",
          alias: null,
          instructions: "PDF or Keynote, 16:9.",
        },
      ],
      note: "Assign one with assign_task_from_template.",
    },
  },
  save_task_template: {
    input: {
      event: "ai-summit-2026",
      title: "Confirm your travel plans",
      kind: "confirm",
      instructions: "{{firstName}}, confirm you can be on site 45 minutes early.",
    },
    output: {
      id: "nx70000000000000000000000000000t2",
      title: "Confirm your travel plans",
      updated: false,
      note: "Saved to the library — idempotent on title.",
    },
  },
  assign_task_from_template: {
    input: {
      event: "ai-summit-2026",
      template: "nx70000000000000000000000000000t1",
      speakers: ["ada@example.com"],
    },
    output: {
      created: 1,
      title: "Upload your slides",
      kind: "upload",
      assignedTo: ["ada@example.com"],
      note: "Speakers see it in their portal immediately.",
    },
  },
  assign_task: {
    input: {
      event: "ai-summit-2026",
      speakers: ["ada@example.com"],
      title: "Upload your slides",
    },
    output: {
      created: 1,
      title: "Upload your slides",
      kind: "upload",
      dueAt: "2026-09-01T00:00:00.000Z",
      assignedTo: ["ada@example.com"],
      note: "Speakers see this in their portal. Use send_reminders to nudge them by email.",
    },
  },
  send_reminders: {
    input: { event: "ai-summit-2026" },
    output: {
      queued: 5,
      skipped: 2,
      note: "Skipped speakers were already reminded in the last 20 hours.",
    },
  },
  get_template: {
    input: { event: "ai-summit-2026", key: "accepted" },
    output: {
      key: "accepted",
      name: "Accepted",
      subject: "You're in!",
      body: "<p>Hi {{firstName}}, your talk was accepted.</p>",
      customized: true,
      variables: ["speakerName", "firstName", "sessionTitle"],
      note: "Rewrite it with update_template, then proof it with send_test_email.",
    },
  },
  delete_event: {
    input: {
      event: "throwaway-2026",
      confirmName: "Throwaway 2026",
      confirm: true,
    },
    output: {
      deleted: true,
      eventId: "evt_throwaway",
      name: "Throwaway 2026",
      slug: "throwaway-2026",
      removed: {
        submissions: 3,
        forms: 1,
        people: 4,
        tasks: 2,
        rooms: 1,
      },
      note: "The event and everything belonging to it are gone. This cannot be undone.",
    },
  },
  delete_form: {
    input: { form: "workshop-cfp", confirm: true },
    output: {
      deleted: true,
      formId: "form_workshop",
      name: "Workshop CFP",
      slug: "workshop-cfp",
      note: "The form is gone. Its public URL now 404s.",
    },
  },
  remove_task: {
    input: { taskId: "task_slides" },
    output: {
      removed: true,
      taskId: "task_slides",
      title: "Upload your slides",
      speaker: "ada@example.com",
      wasCompleted: false,
      note: "It has disappeared from that speaker's portal.",
    },
  },
  list_templates: {
    input: { event: "ai-summit-2026" },
    output: {
      templates: [
        {
          key: "accepted",
          name: "Accepted",
          subject: "You're in!",
          bodyPreview: "<p>Hi {{firstName}}</p>",
          bodyLength: 21,
          bodyTruncated: false,
          customized: true,
        },
        {
          key: "reminder",
          name: "Reminder",
          subject: "A quick nudge",
          bodyPreview: "<p>Please finish your tasks.</p>",
          bodyLength: 32,
          bodyTruncated: false,
          customized: false,
        },
      ],
      variables: [
        "speakerName",
        "firstName",
        "sessionTitle",
        "eventName",
        "portalLink",
      ],
      note: "Placeholders use {{variable}} syntax.",
    },
  },
  update_template: {
    input: {
      event: "ai-summit-2026",
      key: "reminder",
      subject: "A quick nudge about {{eventName}}",
    },
    output: {
      key: "reminder",
      name: "Reminder",
      subject: "A quick nudge about {{eventName}}",
      body: "<p>Please finish your tasks.</p>",
      note: "Preview it with send_test_email before it goes out for real.",
    },
  },
  list_outbox: {
    input: { event: "ai-summit-2026", status: "sent" },
    output: {
      counts: { sent: 12, preview: 3 },
      messages: [
        {
          to: "ada@example.com",
          subject: "You're in!",
          templateKey: "accepted",
          status: "sent",
          calendarInviteAttached: true,
          sentAt: "2026-07-01T09:00:00.000Z",
          error: null,
        },
        {
          to: "grace@example.com",
          subject: "A quick nudge",
          templateKey: "reminder",
          status: "failed",
          calendarInviteAttached: false,
          sentAt: null,
          error: "Mailbox unavailable",
        },
      ],
      note: '"preview" means it was rendered but not actually mailed.',
    },
  },
  send_test_email: {
    input: { event: "ai-summit-2026", key: "accepted" },
    output: {
      to: "organizer@demo.sessionboard.dev",
      templateKey: "accepted",
      subject: "You're in!",
      body: "<p>Hi Ada, your talk was accepted.</p>",
      note: "Queued for delivery. Check list_outbox for the final status.",
    },
  },

  // ——— The 2026-08-11 generative-UI pass ————————————————————————————————
  // Shapes taken from real calls against the dev MCP deployment. The
  // apiV1-backed tools answer in the REST envelope (`{data, results,
  // pagination}`, snake_cased); the bespoke convex/mcp.ts tools answer with a
  // small flat object plus a `note`. Both forms are represented here on
  // purpose — the views have to read either.
  update_workspace: {
    input: { workspace: "ai-engineer", name: "AI Engineer", slug: "ai-engineer" },
    output: {
      organizationId: "org1",
      name: "AI Engineer",
      slug: "ai-engineer",
      slugAdjusted: false,
      url: "http://localhost:3000/app/ai-engineer",
    },
  },
  update_event: {
    input: { event: "ai-summit-2026", venue: "Moscone South", allowSubmissionEdits: false },
    output: {
      data: {
        id: "ev1",
        name: "AI Engineer Summit 2026",
        slug: "ai-summit-2026",
        venue: "Moscone South",
        timezone: "America/Los_Angeles",
        starts_at: "2026-10-12T16:00:00.000Z",
        ends_at: "2026-10-14T01:00:00.000Z",
        public_url: "/e/ai-engineer/ai-summit-2026",
        portal_settings: {
          allow_submission_edits: false,
          always_show_tasks: false,
          extend_task_deadlines: true,
        },
      },
    },
  },
  list_workspace_members: {
    input: { workspace: "ai-engineer" },
    output: {
      workspace: { organizationId: "org1", name: "AI Engineer", slug: "ai-engineer" },
      memberCount: 2,
      members: [
        {
          memberId: "mem1",
          email: "organizer@demo.sessionboard.dev",
          role: "owner",
          accepted: true,
          eventScope: null,
        },
        {
          memberId: "mem2",
          email: "scoped@example.com",
          role: "member",
          accepted: false,
          eventScope: ["AI Engineer Summit 2026"],
        },
      ],
    },
  },
  invite_workspace_member: {
    input: { email: "new@example.com", role: "member" },
    output: {
      email: "new@example.com",
      role: "member",
      eventScope: "All events",
      invited: true,
    },
  },
  update_workspace_member: {
    input: { memberId: "mem2", role: "admin" },
    output: { memberId: "mem2", email: "scoped@example.com", role: "admin", eventScope: "all events" },
  },
  remove_workspace_member: {
    input: { memberId: "mem2" },
    output: {
      removed: true,
      email: "scoped@example.com",
      note: "Their access ended immediately. Invite them again with invite_workspace_member if needed.",
    },
  },
  update_form: {
    input: { form: "main-cfp-2026", externalTitle: "Call for Speakers 2026", speakerMax: 3 },
    output: {
      data: {
        id: "form1",
        name: "Main CFP 2026",
        external_title: "Call for Speakers 2026",
        status: "open",
      },
    },
  },
  manage_form_question: {
    input: {
      event: "ai-summit-2026",
      action: "create",
      label: "What will attendees take away?",
      type: "long_text",
      required: true,
    },
    output: {
      data: {
        id: "field1",
        label: "What will attendees take away?",
        type: "long_text",
        required: true,
        enabled: true,
        help: "Three bullet points is plenty.",
        options: null,
      },
    },
  },
  update_submission: {
    input: { submissionId: "sub1", title: "Shipping agents that don't drift", tags: ["agents"] },
    output: {
      data: {
        id: "sub1",
        title: "Shipping agents that don't drift",
        status: "accepted",
        tags: ["agents"],
        track: { id: "trk1", name: "AI Engineering" },
        duration_minutes: 45,
      },
    },
  },
  delete_submission: {
    input: { submissionId: "sub1" },
    output: { data: { id: "sub1", title: "Duplicate submission", status: "pending" } },
  },
  restore_submission: {
    input: { event: "ai-summit-2026", submissionId: "sub1" },
    output: { data: { id: "sub1", title: "Duplicate submission", status: "pending" } },
  },
  list_trash: {
    input: { event: "ai-summit-2026" },
    output: {
      event: "AI Engineer Summit 2026",
      total: 2,
      returned: 2,
      trashed: [
        {
          submissionId: "sub9",
          title: "Spam submission",
          status: "pending",
          kind: "abstract",
          track: null,
          format: "Talk",
          level: null,
          tags: [],
          speakers: ["Spammy McSpam <spam@example.com>"],
          scheduled: null,
          deletedAt: "2026-08-11T19:31:06.218Z",
        },
      ],
      note: "Bring any of these back with restore_submission.",
    },
  },
  add_participant: {
    input: { submissionId: "sub1", speaker: "ada@example.com", role: "moderator" },
    output: {
      data: {
        id: "person1",
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        role: "moderator",
        participant_id: "part1",
        session_id: "sub1",
      },
      created: true,
    },
  },
  remove_participant: {
    input: { submissionId: "sub1", speaker: "ada@example.com" },
    output: { data: { deleted: true }, deleted: true },
  },
  set_agenda_published: {
    input: { event: "ai-summit-2026", published: true },
    output: {
      data: {
        id: "ev1",
        name: "AI Engineer Summit 2026",
        agenda_published_at: "2026-08-11T19:42:05.951Z",
        public_url: "/e/ai-engineer/ai-summit-2026",
      },
    },
  },
  add_speaker: {
    input: { event: "ai-summit-2026", email: "grace@example.com", firstName: "Grace" },
    output: {
      data: {
        id: "person2",
        full_name: "Grace Hopper",
        email: "grace@example.com",
        title: "Rear Admiral",
        company_name: "US Navy",
        workflow_status: "invited",
        is_public: true,
      },
    },
  },
  update_speaker: {
    input: { event: "ai-summit-2026", speaker: "grace@example.com", company: "US Navy" },
    output: {
      data: {
        id: "person2",
        full_name: "Grace Hopper",
        email: "grace@example.com",
        company_name: "US Navy",
        is_public: true,
      },
    },
  },
  remove_speaker: {
    input: { event: "ai-summit-2026", speaker: "grace@example.com" },
    output: { data: { deleted: true, full_name: "Grace Hopper" } },
  },
  bulk_add_speakers: {
    input: { event: "ai-summit-2026", rows: [{ email: "a@example.com" }] },
    output: {
      added: 2,
      updated: 1,
      skipped: 1,
      total: 4,
      results: [
        { email: "a@example.com", outcome: "added" },
        { email: "b@example.com", outcome: "updated (blanks filled)" },
        { email: "c@example.com", outcome: "skipped (already complete)" },
      ],
    },
  },
  list_tasks: {
    input: { event: "ai-summit-2026" },
    output: {
      data: [
        {
          id: "task1",
          title: "Upload your slides",
          instructions: "PDF please, 16:9.",
          kind: "upload",
          due_at: "2026-08-31T19:38:44.911Z",
          completed_at: null,
          is_complete: false,
          is_overdue: true,
          response: null,
          session_id: null,
          session_title: null,
          speaker: { id: "person3", email: "rafael.duarte@example.com", full_name: "Rafael Duarte" },
        },
        {
          id: "task2",
          title: "Update their profile",
          kind: "profile",
          due_at: null,
          completed_at: "2026-08-02T10:00:00.000Z",
          is_complete: true,
          is_overdue: false,
          speaker: { id: "person4", email: "ada@example.com", full_name: "Ada Lovelace" },
        },
      ],
      results: [],
      pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalResults: 2 },
    },
  },
  update_task: {
    input: { event: "ai-summit-2026", taskId: "task1", completed: true },
    output: {
      data: {
        id: "task1",
        title: "Upload your slides",
        kind: "upload",
        due_at: "2026-08-31T19:38:44.911Z",
        is_complete: true,
        speaker: { id: "person3", email: "rafael.duarte@example.com", full_name: "Rafael Duarte" },
      },
    },
  },
  delete_task_template: {
    input: { template: "tpl1" },
    output: {
      deleted: true,
      templateId: "tpl1",
      title: "Upload your slides",
      note: "Removed from the library. Tasks already assigned from it keep their wording.",
    },
  },
  list_files: {
    input: { event: "ai-summit-2026" },
    output: {
      total: 2,
      returned: 2,
      countsByApprovalStatus: { approved: 1, pending: 1 },
      files: [
        {
          fileId: "file1",
          filename: "opening-keynote-slides.pdf",
          speaker: "Ada Lovelace <ada@example.com>",
          session: "Opening keynote",
          task: "Upload your slides",
          version: 2,
          approvalStatus: "approved",
          reviewNote: "Looks great — AV have the deck.",
          uploadedAt: "2026-08-11T19:38:48.984Z",
        },
        {
          fileId: "file2",
          filename: "headshot.jpg",
          speaker: "Rafael Duarte <rafael.duarte@example.com>",
          session: null,
          task: "Upload a headshot",
          version: 1,
          approvalStatus: "pending",
          reviewNote: null,
          uploadedAt: "2026-08-10T09:12:00.000Z",
        },
      ],
      note: "Files awaiting review block nothing automatically — approve or ask for changes.",
    },
  },
  review_file: {
    input: { fileId: "file2", approvalStatus: "changes_requested", reviewNote: "Please send a 16:9 crop." },
    output: {
      fileId: "file2",
      filename: "headshot.jpg",
      approvalStatus: "changes_requested",
      reviewNote: "Please send a 16:9 crop.",
      speaker: "rafael.duarte@example.com",
      taskReopened: true,
    },
  },
  delete_file: {
    input: { fileId: "file2" },
    output: {
      deleted: true,
      fileId: "file2",
      filename: "headshot.jpg",
      note: "The file row and its stored bytes are gone. This cannot be undone.",
    },
  },
  count_bulk_audience: {
    input: { event: "ai-summit-2026", audience: "accepted" },
    output: {
      audience: "accepted",
      recipients: 10,
      sampleEmails: ["sofia.marchetti@example.com", "ada@example.com"],
      note: "Nothing sent — this only counted the audience.",
    },
  },
  send_bulk_email: {
    input: { event: "ai-summit-2026", audience: "accepted", subject: "Travel details" },
    output: {
      queued: 10,
      recipients: 10,
      subject: "Travel details",
      note: "Each recipient gets their own copy with {{firstName}} etc. resolved. Track delivery with list_outbox.",
    },
  },
  list_evaluation_plans: {
    input: { event: "ai-summit-2026" },
    output: {
      data: [
        {
          id: "plan1",
          name: "Round 1 — Programme Committee",
          round: 1,
          status: "open",
          blind: false,
          due_at: "2026-09-26T00:00:00.000Z",
          opens_at: null,
          submission_count: 8,
          evaluator_count: 2,
          assigned_count: 16,
          completed_count: 10,
          outstanding_count: 6,
          recused_count: 0,
          completion_pct: 63,
          average_score: 4.3,
          criteria: [
            { id: "overall", label: "Overall", type: "numeric", weight: 1, options: null },
          ],
        },
      ],
      results: [],
      pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalResults: 1 },
    },
  },
  get_evaluation_plan: {
    input: { event: "ai-summit-2026", planId: "plan1" },
    output: {
      data: {
        id: "plan1",
        name: "Round 1 — Programme Committee",
        round: 1,
        status: "open",
        blind: false,
        due_at: "2026-09-26T00:00:00.000Z",
        submission_count: 8,
        evaluator_count: 2,
        assigned_count: 16,
        completed_count: 10,
        outstanding_count: 6,
        average_score: 4.3,
        criteria: [
          { id: "overall", label: "Overall", type: "numeric", weight: 1, options: null },
        ],
        evaluators: [
          {
            id: "eval1",
            name: "Alex Rivera",
            email: "alex.rivera@example.com",
            assigned_count: 8,
            completed_count: 6,
            outstanding_count: 2,
            recused_count: 0,
            custom_assignment: false,
            review_path: "/review/abc123",
            token: "abc123",
            last_reminded_at: null,
          },
        ],
        submissions: [
          { id: "sub1", title: "Opening keynote", status: "pending", average_score: 4.25, completed_count: 2 },
        ],
      },
    },
  },
  create_evaluation_plan: {
    input: { event: "ai-summit-2026", name: "Round 2 — Final Review" },
    output: {
      data: {
        id: "plan2",
        name: "Round 2 — Final Review",
        round: 2,
        status: "open",
        submission_count: 4,
        evaluator_count: 0,
        due_at: "2026-10-01T00:00:00.000Z",
        criteria: [{ id: "overall", label: "Overall", type: "numeric", weight: 1 }],
      },
    },
  },
  update_evaluation_plan: {
    input: { event: "ai-summit-2026", planId: "plan1", status: "closed" },
    output: {
      data: {
        id: "plan1",
        name: "Round 1 — Programme Committee",
        round: 1,
        status: "closed",
        submission_count: 8,
        evaluator_count: 2,
      },
    },
  },
  delete_evaluation_plan: {
    input: { event: "ai-summit-2026", planId: "plan1" },
    output: { data: { id: "plan1", name: "Round 1 — Programme Committee", deleted: true } },
  },
  add_evaluator: {
    input: { event: "ai-summit-2026", planId: "plan1", email: "jo@example.com", name: "Jo Smith" },
    output: {
      data: {
        id: "eval2",
        name: "Jo Smith",
        email: "jo@example.com",
        assigned_count: 8,
        custom_assignment: false,
        review_path: "/review/def456",
      },
    },
  },
  update_evaluator: {
    input: { event: "ai-summit-2026", evaluatorId: "eval2", assignedSubmissionIds: ["sub1"] },
    output: {
      data: {
        id: "eval2",
        name: "Jo Smith",
        email: "jo@example.com",
        assigned_count: 1,
        custom_assignment: true,
        review_path: "/review/def456",
      },
    },
  },
  rotate_evaluator_token: {
    input: { evaluatorId: "eval2" },
    output: {
      evaluatorId: "eval2",
      email: "jo@example.com",
      name: "Jo Smith",
      reviewUrl: "http://localhost:3000/review/ghi789",
      note: "The old link stopped working immediately.",
    },
  },
  remove_evaluator: {
    input: { event: "ai-summit-2026", evaluatorId: "eval2" },
    output: { data: { id: "eval2", name: "Jo Smith", email: "jo@example.com", deleted: true } },
  },
  list_evaluations: {
    input: { event: "ai-summit-2026" },
    output: {
      data: [
        {
          id: "score1",
          plan_id: "plan1",
          plan_name: "Round 1 — Programme Committee",
          round: 1,
          session_id: "sub1",
          session_title: "Opening keynote",
          evaluator_id: "eval1",
          evaluator_email: "alex.rivera@example.com",
          scores: { overall: 4, relevance: 5 },
          comment: "Strong opener, good fit for the main stage.",
          recused: false,
          recusal_reason: null,
          completed_at: "2026-08-06T19:38:44.911Z",
        },
        {
          id: "score2",
          plan_id: "plan1",
          session_title: "Closing panel",
          evaluator_email: "jo@example.com",
          scores: {},
          recused: true,
          recusal_reason: "Works at the same company",
          completed_at: null,
        },
      ],
      results: [],
      pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalResults: 2 },
    },
  },
  distribute_evaluations: {
    input: { planId: "plan1", perReviewerCap: 5 },
    output: {
      plan: "Round 1 — Programme Committee",
      assigned: 8,
      unassigned: 2,
      evaluatorCount: 2,
      note: "Some submissions stayed unassigned — add evaluators or raise perReviewerCap, then run again.",
    },
  },
  remind_evaluators: {
    input: { planId: "plan1" },
    output: {
      plan: "Round 1 — Programme Committee",
      reminded: 2,
      skipped: 1,
      recipients: ["alex.rivera@example.com", "jo@example.com"],
      note: "Each email carries that evaluator's own review link.",
    },
  },
  list_field_options: {
    input: { event: "ai-summit-2026", resource: "tracks" },
    output: {
      data: [
        { id: "trk1", name: "AI Engineering", color: "#2F5CE0", order: 0 },
        { id: "trk2", name: "Product", color: "#0F6E70", order: 1 },
      ],
      results: [],
      pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalResults: 2 },
      unknownResource: false,
    },
  },
  manage_room: {
    input: { event: "ai-summit-2026", action: "create", name: "Main Stage", capacity: 300 },
    output: { data: { id: "room1", name: "Main Stage", capacity: 300, order: 0 } },
  },
  manage_track: {
    input: { event: "ai-summit-2026", action: "create", name: "AI Engineering", color: "#2F5CE0" },
    output: { data: { id: "trk1", name: "AI Engineering", color: "#2F5CE0", order: 0 } },
  },
  manage_field_option: {
    input: { event: "ai-summit-2026", resource: "tags", action: "create", value: "agents" },
    output: { data: { id: "tag1", value: "agents", name: "agents" } },
  },
  manage_session_status: {
    input: { event: "ai-summit-2026", action: "create", name: "Waitlisted", pipelineStatus: "pending" },
    output: {
      data: { id: "st1", name: "Waitlisted", pipeline_status: "pending", color: "amber", order: 20 },
    },
  },
  list_webhooks: {
    input: { event: "ai-summit-2026" },
    output: {
      data: [
        {
          id: "wh1",
          url: "https://example.com/hook",
          events: ["submission.created", "session.scheduled"],
          enabled: true,
          consecutive_failures: 0,
          last_delivery_at: "2026-08-11T19:42:05.668Z",
          last_error: null,
          secret: "whsec_7a16abbb6c7551ecef65b3bd047ceaeb",
        },
      ],
      results: [],
    },
  },
  manage_webhook: {
    input: { event: "ai-summit-2026", action: "create", url: "https://example.com/hook" },
    output: {
      data: {
        id: "wh1",
        url: "https://example.com/hook",
        events: ["submission.created"],
        enabled: true,
        secret: "whsec_7a16abbb6c7551ecef65b3bd047ceaeb",
        consecutive_failures: 0,
      },
    },
  },
  list_embeds: {
    input: { event: "ai-summit-2026" },
    output: {
      embedCount: 1,
      embeds: [
        {
          embedId: "emb1",
          name: "Agenda for the homepage",
          widget: "agenda",
          options: { format: "iframe", height: 900 },
        },
      ],
      widgets: ["agenda", "speakers"],
      formats: ["iframe", "html", "link", "json", "ics"],
      note: "Copy the snippet from the Embeds page.",
    },
  },
  save_embed: {
    input: { event: "ai-summit-2026", name: "Agenda for the homepage", widget: "agenda" },
    output: { embedId: "emb1", name: "Agenda for the homepage", widget: "agenda", updated: false },
  },
  delete_embed: {
    input: { embedId: "emb1" },
    output: { deleted: true, embedId: "emb1", name: "Agenda for the homepage" },
  },
  list_activity: {
    input: { event: "ai-summit-2026", filter: "agents" },
    output: {
      returned: 2,
      activity: [
        {
          id: "act1",
          summary: "Moved “Opening keynote” to the accept queue",
          actor: "organizer@demo.sessionboard.dev",
          entity: "submission",
          at: "2026-08-11T19:42:05.951Z",
          source: "mcp",
        },
        {
          id: "act2",
          summary: "Published the agenda",
          actor: "organizer@demo.sessionboard.dev",
          entity: "agenda",
          at: "2026-08-11T18:02:00.000Z",
          source: "app",
        },
      ],
      note: '"agents" narrows this to MCP and API writes.',
    },
  },
}

/** Live captures win; the hand-written shape is the fallback. */
const CAPTURED: Record<string, Payload> = (() => {
  const path = resolve(root, "tests/fixtures/copilot-tool-payloads.json")
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, Payload>
  } catch {
    return {}
  }
})()

function payloadFor(toolName: string): Payload {
  return CAPTURED[toolName] ?? SHAPES[toolName]
}

function renderTool(toolName: string, payload: Payload) {
  return render(
    <CopilotToolOutput
      toolName={toolName}
      input={payload.input}
      output={payload.output}
    />
  )
}

afterEach(cleanup)

describe("copilot tool-view registry", () => {
  it("has a purpose-built view for EVERY tool the MCP server exposes", () => {
    const missing = ALL_TOOLS.filter((name) => !hasToolView(name))
    expect(missing).toEqual([])
    expect(ALL_TOOLS.length).toBe(MCP_TOOL_COUNT)
  })

  it("does not register views for tools the MCP server doesn't expose", () => {
    const extra = Object.keys(TOOL_VIEWS).filter(
      (name) => !ALL_TOOLS.includes(name)
    )
    expect(extra).toEqual([])
  })

  it("draws an unknown tool with the auto view, never naked JSON", () => {
    const { container } = renderTool("some_future_tool", {
      input: {},
      output: { hello: "world", total_results: 3 },
    })
    expect(container.querySelector("[data-view-fallback]")).toBeNull()
    // Humanised key, real value — not a JSON blob.
    expect(container.textContent).toContain("Hello")
    expect(container.textContent).toContain("world")
  })

  it("falls back to raw JSON when the output is not an object", () => {
    const { container } = renderTool("list_events", {
      input: {},
      output: "not an object",
    })
    expect(container.querySelector("[data-view-fallback]")).not.toBeNull()
  })
})

describe.each(ALL_TOOLS)("%s", (toolName) => {
  it("renders a rich view without throwing", () => {
    const payload = payloadFor(toolName)
    expect(payload, `no fixture for ${toolName}`).toBeTruthy()
    const { container } = renderTool(toolName, payload)
    // Something rendered…
    expect(container.textContent.trim().length).toBeGreaterThan(0)
    // …and it is not the JSON fallback (which would mean the view bailed).
    expect(container.querySelector("[data-view-fallback]")).toBeNull()
  })

  it("survives an empty payload", () => {
    const { container } = renderTool(toolName, { input: {}, output: {} })
    expect(container).toBeTruthy()
  })

  it("survives a hostile payload", () => {
    const { container } = renderTool(toolName, {
      input: null,
      output: {
        events: "nope",
        forms: 42,
        submissions: null,
        speakers: { not: "an array" },
        messages: [null, 1, "x"],
        templates: [{}],
        questions: [{}],
        conflicts: [{}],
        scheduled: [{ startsAt: "not-a-date" }],
        statusCounts: { weird: "value" },
        needsAttention: [1, 2],
        previous: 7,
      },
    })
    expect(container).toBeTruthy()
  })
})

// ——— The details that make each view worth having ————————————————————————

describe("what each view actually says", () => {
  it("list_events badges the current event and shows its dates", () => {
    window.localStorage.setItem("sb.currentEventId", "ev1")
    renderTool("list_events", SHAPES.list_events)
    expect(screen.getByText("AI Engineer Summit 2026")).toBeTruthy()
    expect(screen.getByText("Current")).toBeTruthy()
    window.localStorage.clear()
  })

  it("get_event_summary leads with stats and the needs-attention list", () => {
    const { container } = renderTool(
      "get_event_summary",
      SHAPES.get_event_summary
    )
    expect(
      container.querySelectorAll("[data-slot=stat-card]").length
    ).toBeGreaterThan(2)
    expect(container.textContent).toContain(
      "8 submission(s) still pending review"
    )
    expect(container.textContent).toContain("Needs attention")
  })

  it("get_event_overview renders the same shape from a different payload", () => {
    const { container } = renderTool(
      "get_event_overview",
      SHAPES.get_event_overview
    )
    expect(
      container.querySelectorAll("[data-slot=stat-card]").length
    ).toBeGreaterThan(2)
    expect(container.textContent).toContain("AI Engineer Summit 2026")
  })

  it("create_form gives the public link a copy button and both next steps", () => {
    const { container } = renderTool("create_form", SHAPES.create_form)
    expect(container.textContent).toContain(
      "http://localhost:3000/submit/ai-summit-2026/copilot-verification-cfp"
    )
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy()
    const builder = screen.getByText(/edit in form builder/i).closest("a")
    expect(builder?.getAttribute("href")).toBe("/app/forms/form2")
    const external = container.querySelector('a[target="_blank"]')
    expect(external?.getAttribute("href")).toContain("/submit/")
  })

  it("get_public_form_link renders the URL as a copyable affordance", () => {
    const { container } = renderTool(
      "get_public_form_link",
      SHAPES.get_public_form_link
    )
    expect(container.querySelector("code")?.textContent).toContain(
      "/submit/ai-summit-2026/main-cfp-2026"
    )
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy()
  })

  it("update_form_settings shows a real before → after row", () => {
    const { container } = renderTool(
      "update_form_settings",
      SHAPES.update_form_settings
    )
    expect(container.textContent).toContain("Status")
    // Both the old and the new status pill are present.
    const pills = container.querySelectorAll("[data-slot=status-pill]")
    const labels = [...pills].map((pill) => pill.getAttribute("data-status"))
    expect(labels).toContain("open")
    expect(labels).toContain("closed")
  })

  it("list_submissions caps at 8 rows and links the filter through", () => {
    const { container } = renderTool(
      "list_submissions",
      SHAPES.list_submissions
    )
    expect(container.querySelectorAll("tbody tr").length).toBe(8)
    const more = screen.getByText(/view all 12 in submissions/i).closest("a")
    expect(more?.getAttribute("href")).toContain("status=pending")
    expect(
      container.querySelectorAll("[data-slot=track-dot]").length
    ).toBeGreaterThan(0)
  })

  it("set_submission_status renders the old → new transition", () => {
    const { container } = renderTool(
      "set_submission_status",
      SHAPES.set_submission_status
    )
    const statuses = [
      ...container.querySelectorAll("[data-slot=status-pill]"),
    ].map((pill) => pill.getAttribute("data-status"))
    expect(statuses).toEqual(["pending", "accept_queue"])
  })

  it("commit_decision_queue reports the counts and links the outbox", () => {
    const { container } = renderTool(
      "commit_decision_queue",
      SHAPES.commit_decision_queue
    )
    expect(container.textContent).toContain(
      "3 acceptances committed · 4 emails queued"
    )
    const outbox = screen.getByText(/check the outbox/i).closest("a")
    expect(outbox?.getAttribute("href")).toContain("tab=outbox")
  })

  it("get_agenda groups by day, counts rooms and shouts about conflicts", () => {
    const { container } = renderTool("get_agenda", SHAPES.get_agenda)
    expect(container.textContent).toContain("Main Stage · 1")
    expect(container.textContent).toContain("1 conflict to resolve")
    expect(container.textContent).toContain(
      "Main Stage is double-booked at 10:00"
    )
    expect(container.textContent).toContain(
      "1 accepted session waiting for a slot"
    )
  })

  it("schedule_session shows the slot and any clash it created", () => {
    const { container } = renderTool(
      "schedule_session",
      SHAPES.schedule_session
    )
    expect(container.textContent).toContain("Main Stage")
    expect(container.textContent).toContain("30 min")
    expect(container.textContent).toContain("double-booked")
  })

  it("auto_place_sessions summarises placed vs left over", () => {
    const { container } = renderTool(
      "auto_place_sessions",
      SHAPES.auto_place_sessions
    )
    expect(container.textContent).toContain("4 sessions placed")
    expect(container.textContent).toContain("Wouldn't fit")
  })

  it("list_speakers shows readiness bars and what each person owes", () => {
    const { container } = renderTool("list_speakers", SHAPES.list_speakers)
    const bars = container.querySelectorAll('[role="progressbar"]')
    expect(bars.length).toBe(2)
    expect(container.textContent).toContain("Upload your slides")
    expect(container.textContent).toContain("no bio")
    expect(container.textContent).toContain("All done")
  })

  it("get_speaker_portal_link treats the URL as a credential", () => {
    const { container } = renderTool(
      "get_speaker_portal_link",
      SHAPES.get_speaker_portal_link
    )
    expect(container.textContent).toContain("private")
    expect(container.querySelector("code")?.textContent).toContain("/portal/t/")
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy()
  })

  it("send_reminders splits queued from skipped", () => {
    const { container } = renderTool("send_reminders", SHAPES.send_reminders)
    expect(container.textContent).toContain("5 reminders queued")
    expect(container.textContent).toContain("Skipped")
  })

  it("list_outbox pills every delivery status and surfaces errors", () => {
    const { container } = renderTool("list_outbox", SHAPES.list_outbox)
    expect(container.textContent).toContain("Mailbox unavailable")
    const statuses = [
      ...container.querySelectorAll("[data-slot=status-pill]"),
    ].map((pill) => pill.getAttribute("data-status"))
    expect(statuses).toContain("failed")
  })

  it("list_templates flattens HTML bodies instead of rendering them", () => {
    const { container } = renderTool("list_templates", SHAPES.list_templates)
    expect(container.innerHTML).not.toContain("<p>Hi {{firstName}}</p>")
    expect(container.textContent).toContain("Hi {{firstName}}")
    expect(container.textContent).toContain("Customised")
  })

  it("send_test_email confirms recipient, subject and a body proof", () => {
    const { container } = renderTool("send_test_email", SHAPES.send_test_email)
    expect(container.textContent).toContain("organizer@demo.sessionboard.dev")
    expect(container.textContent).toContain("You're in!")
  })

  it("update_event states a portal toggle in speaker terms", () => {
    const { container } = renderTool("update_event", SHAPES.update_event)
    expect(container.textContent).toContain("Moscone South")
    expect(container.textContent).toContain(
      "Editing closes with the CFP — for everyone, accepted included."
    )
  })

  it("list_tasks counts overdue work and strikes through what's done", () => {
    const { container } = renderTool("list_tasks", SHAPES.list_tasks)
    expect(container.textContent).toContain("Overdue")
    expect(container.textContent).toContain("overdue")
    expect(container.querySelector(".line-through")?.textContent).toContain(
      "Update their profile"
    )
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1)
  })

  it("review_file says the speaker's task reopened", () => {
    const { container } = renderTool("review_file", SHAPES.review_file)
    expect(container.textContent).toContain("Changes requested")
    expect(container.textContent).toContain("Please send a 16:9 crop.")
    expect(container.textContent).toContain("task reopened")
  })

  it("list_files leads with what is still awaiting review", () => {
    const { container } = renderTool("list_files", SHAPES.list_files)
    expect(container.textContent).toContain("Awaiting review")
    expect(container.textContent).toContain("opening-keynote-slides.pdf")
    expect(container.textContent).toContain("v2")
  })

  it("get_evaluation_plan shows per-evaluator progress bars", () => {
    const { container } = renderTool(
      "get_evaluation_plan",
      SHAPES.get_evaluation_plan
    )
    expect(container.textContent).toContain("Alex Rivera")
    expect(container.textContent).toContain("6/8")
    expect(
      container.querySelectorAll('[role="progressbar"]').length
    ).toBeGreaterThan(0)
    expect(container.textContent).toContain("Outstanding")
  })

  it("list_evaluations shows recusals as rows but flags them", () => {
    const { container } = renderTool("list_evaluations", SHAPES.list_evaluations)
    expect(container.textContent).toContain("Recused")
    expect(container.textContent).toContain("Works at the same company")
    expect(container.textContent).toContain("excluded from every average")
  })

  it("distribute_evaluations warns about what didn't fit", () => {
    const { container } = renderTool(
      "distribute_evaluations",
      SHAPES.distribute_evaluations
    )
    expect(container.textContent).toContain("2 left unassigned")
    expect(container.textContent).toContain("REPLACED")
  })

  it("bulk_add_speakers reports the outcome of every row", () => {
    const { container } = renderTool(
      "bulk_add_speakers",
      SHAPES.bulk_add_speakers
    )
    expect(container.textContent).toContain("added")
    expect(container.textContent).toContain("updated (blanks filled)")
    expect(container.textContent).toContain("skipped (already complete)")
  })

  it("manage_webhook hands over the signing secret exactly once", () => {
    const { container } = renderTool("manage_webhook", SHAPES.manage_webhook)
    expect(container.querySelector("code")?.textContent).toContain(
      "https://example.com/hook"
    )
    expect(container.textContent).toContain(
      "whsec_7a16abbb6c7551ecef65b3bd047ceaeb"
    )
    expect(container.textContent).toContain("only time the secret is shown")
  })

  it("list_webhooks never prints the signing secret", () => {
    const { container } = renderTool("list_webhooks", SHAPES.list_webhooks)
    expect(container.textContent).toContain("https://example.com/hook")
    expect(container.textContent).not.toContain("whsec_")
  })

  it("list_workspace_members spells out event scope and pending invites", () => {
    const { container } = renderTool(
      "list_workspace_members",
      SHAPES.list_workspace_members
    )
    expect(container.textContent).toContain("All events")
    expect(container.textContent).toContain("AI Engineer Summit 2026")
    expect(container.textContent).toContain("Invited")
  })

  it("list_trash says how to get a submission back", () => {
    const { container } = renderTool("list_trash", SHAPES.list_trash)
    expect(container.textContent).toContain("Spam submission")
    expect(container.textContent).toContain("restore")
  })

  it("remove_participant distinguishes detaching from deleting", () => {
    const { container } = renderTool(
      "remove_participant",
      SHAPES.remove_participant
    )
    expect(container.textContent).toContain("still in the event")
  })

  it("set_agenda_published hands over the public URL", () => {
    const { container } = renderTool(
      "set_agenda_published",
      SHAPES.set_agenda_published
    )
    expect(container.textContent).toContain("now public")
    expect(container.querySelector("code")?.textContent).toContain(
      "/e/ai-engineer/ai-summit-2026"
    )
  })

  it("manage_track renders the real colour the organizer picked", () => {
    const { container } = renderTool("manage_track", SHAPES.manage_track)
    const dot = container.querySelector("[data-slot=track-dot]")
    expect(dot?.getAttribute("style")).toContain("rgb(47, 92, 224)")
    expect(container.textContent).toContain("#2F5CE0")
  })

  it("empty results get a friendly row, not an empty box", () => {
    const cases: Array<[string, unknown]> = [
      ["list_submissions", { submissions: [], total: 0, returned: 0 }],
      ["list_speakers", { speakerCount: 0, speakers: [] }],
      ["list_forms", { forms: [] }],
      ["list_outbox", { counts: {}, messages: [] }],
      ["list_events", { events: [] }],
      [
        "get_agenda",
        { scheduled: [], unscheduled: [], rooms: [], conflicts: [] },
      ],
    ]
    for (const [toolName, output] of cases) {
      const { container, unmount } = renderTool(toolName, { input: {}, output })
      expect(
        container.textContent.trim().length,
        `${toolName} empty state`
      ).toBeGreaterThan(10)
      unmount()
    }
  })
})

// ——— The auto view: the floor under every tool ————————————————————————————

describe("auto view (no bespoke renderer)", () => {
  const auto = (output: unknown) =>
    renderTool("a_tool_we_have_never_seen", { input: {}, output })

  it("unwraps the REST envelope instead of drawing data and results twice", () => {
    const { container } = auto({
      data: [{ name: "Main Stage", capacity: 300 }],
      results: [{ name: "Main Stage", capacity: 300 }],
      pagination: { totalResults: 40, currentPage: 1, pageSize: 100 },
    })
    expect(container.querySelectorAll("table").length).toBe(1)
    expect(container.querySelectorAll("tbody tr").length).toBe(1)
    expect(container.textContent).toContain("Main Stage")
    // The server knows about more rows than it sent — say so rather than
    // implying the one row on screen is the whole answer.
    expect(container.textContent).toContain("40 total")
  })

  it("humanises keys and types values", () => {
    const { container } = auto({
      full_name: "Ada Lovelace",
      is_public: true,
      created_at: "2026-08-11T19:42:05.951Z",
      website_url: "https://example.com",
    })
    expect(container.textContent).toContain("Full name")
    expect(container.textContent).toContain("Yes")
    expect(container.querySelector('a[target="_blank"]')?.getAttribute("href")).toBe(
      "https://example.com"
    )
    // A raw ISO string would read as machine output; the view formats it.
    expect(container.textContent).not.toContain("2026-08-11T19:42:05.951Z")
  })

  it("never prints anything that looks like a credential", () => {
    const { container } = auto({
      name: "Hook",
      secret: "whsec_deadbeefdeadbeefdeadbeef",
      token: "tok_abcdef123456",
    })
    expect(container.textContent).not.toContain("deadbeefdeadbeef")
    expect(container.textContent).not.toContain("abcdef123456")
    expect(container.textContent).toContain("hidden")
  })

  it("surfaces the server's own note as prose", () => {
    const { container } = auto({
      queued: 3,
      note: "Track delivery with list_outbox.",
    })
    expect(container.textContent).toContain("Track delivery with list_outbox.")
  })

  it("renders arrays of strings as chips and arrays of objects as a table", () => {
    const { container } = auto({
      events: ["submission.created", "session.scheduled"],
      rows: [
        { name: "One", status: "open" },
        { name: "Two", status: "closed" },
      ],
    })
    expect(container.textContent).toContain("submission.created")
    expect(container.querySelectorAll("tbody tr").length).toBe(2)
    expect(container.querySelectorAll("thead th").length).toBe(2)
  })

  it("caps long tables and says how many it held back", () => {
    const { container } = auto({
      rows: Array.from({ length: 20 }, (_, index) => ({ name: `Row ${index}` })),
    })
    expect(container.querySelectorAll("tbody tr").length).toBe(8)
    expect(container.textContent).toContain("+12 more")
  })

  it("stays standing on hostile and empty payloads", () => {
    for (const output of [
      {},
      { nested: { deep: { deeper: { deepest: 1 } } } },
      { weird: [null, undefined, () => {}] },
      { mixed: [1, "two", { three: 3 }] },
    ]) {
      const { container, unmount } = auto(output)
      expect(container.querySelector("[data-view-fallback]")).toBeNull()
      unmount()
    }
  })

  it("still falls back to raw JSON when the output is not an object at all", () => {
    const { container } = auto("just a string")
    expect(container.querySelector("[data-view-fallback]")).not.toBeNull()
  })
})
