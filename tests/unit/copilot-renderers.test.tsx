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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

/** The full MCP surface (convex/mcp.ts). Coverage is measured against it. */
const ALL_TOOLS = [
  "list_workspaces",
  "list_events",
  "create_event",
  "get_event_overview",
  "list_forms",
  "get_form",
  "create_form",
  "update_form_settings",
  "get_public_form_link",
  "list_submissions",
  "get_submission",
  "set_submission_status",
  "commit_decision_queue",
  "add_manual_session",
  "get_agenda",
  "schedule_session",
  "unschedule_session",
  "auto_place_sessions",
  "list_speakers",
  "get_speaker_portal_link",
  "assign_task",
  "send_reminders",
  "list_templates",
  "update_template",
  "list_outbox",
  "send_test_email",
  "get_template",
  "delete_event",
  "delete_form",
  "remove_task",
  "get_event_summary",
  // Task library (product-fixes wave, 2026-08-11).
  "list_task_library",
  "save_task_template",
  "assign_task_from_template",
] as const

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
  it("has a purpose-built view for all 31 MCP tools", () => {
    const missing = ALL_TOOLS.filter((name) => !hasToolView(name))
    expect(missing).toEqual([])
    expect(ALL_TOOLS.length).toBe(34)
  })

  it("does not register views for tools the MCP server doesn't expose", () => {
    const extra = Object.keys(TOOL_VIEWS).filter(
      (name) => !(ALL_TOOLS as ReadonlyArray<string>).includes(name)
    )
    expect(extra).toEqual([])
  })

  it("falls back to raw JSON for an unknown tool", () => {
    const { container } = renderTool("some_future_tool", {
      input: {},
      output: { hello: "world" },
    })
    expect(container.querySelector("[data-view-fallback]")).not.toBeNull()
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
