// GENERATED FILE — DO NOT EDIT.
// Source of truth: convex/mcp.ts (`export const TOOLS`).
// Regenerate with: node scripts/generate-mcp-tools.mjs

export interface McpToolDoc {
  /** Tool name exactly as the MCP client sees it. */
  name: string
  /** Short human title from the tool's `annotations.title`. */
  title: string
  /** The description the model is given. */
  description: string
  /** `readOnlyHint` — true when the tool cannot change anything. */
  readOnly: boolean
  /** Guarded by a required `confirm: true` argument. */
  requiresConfirm: boolean
  args: Array<string>
  required: Array<string>
}

export interface McpToolGroup {
  id: string
  label: string
  tools: Array<McpToolDoc>
}

export const MCP_TOOL_GROUPS: Array<McpToolGroup> = [
  {
    id: "workspaces",
    label: "Workspaces & events",
    tools: [
      {
        name: "list_workspaces",
        title: "List workspaces",
        description: "Lists every Sessionboard workspace (organization) you belong to, your role in each (owner/admin/member), and how many events each one holds. Start here when you don't yet know which workspace or event to operate on.",
        readOnly: true,
        requiresConfirm: false,
        args: [],
        required: [],
      },
      {
        name: "list_events",
        title: "List events",
        description: "Lists every event you can access, across all your workspaces, with each event's id, slug, dates, venue and timezone. Almost every other tool needs an event id or slug from here.",
        readOnly: true,
        requiresConfirm: false,
        args: [],
        required: [],
      },
      {
        name: "create_event",
        title: "Create an event",
        description: "Creates a new event in one of your workspaces. Requires the admin or owner role. If you belong to exactly one workspace you can omit organizationId. Dates are ISO-8601 strings, e.g. \"2026-09-14T09:00:00Z\"; set them if you plan to use auto_place_sessions later.",
        readOnly: false,
        requiresConfirm: false,
        args: ["name","slug","organizationId","timezone","type","venue","description","websiteUrl","startsAt","endsAt"],
        required: ["name"],
      },
      {
        name: "delete_event",
        title: "Delete an event (IRREVERSIBLE)",
        description: "Permanently deletes an event and EVERYTHING belonging to it: every submission, speaker, CFP form, task, uploaded file, email template and outbox row. There is no undo and no trash. It needs the admin or owner role and TWO independent confirmations: confirm: true, and confirmName set to the event's exact name as list_events returns it. Never guess confirmName — if the user has not named the event they want destroyed, ask them, don't infer it.",
        readOnly: false,
        requiresConfirm: true,
        args: ["event","confirmName","confirm"],
        required: ["event","confirmName","confirm"],
      },
      {
        name: "get_event_overview",
        title: "Event dashboard stats (deprecated — use get_event_summary)",
        description: "DEPRECATED ALIAS of get_event_summary, kept so existing scripts keep working; it returns exactly the same payload. Call get_event_summary instead.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event"],
        required: ["event"],
      },
      {
        name: "get_event_summary",
        title: "Event status & dashboard stats",
        description: "THE status call, and the one that used to be split in two (it absorbed get_event_overview). Returns every dashboard number plus the narrative: a headline sentence, submission counts by status, total submissions, agenda health (scheduled, acceptedNotScheduled, conflict count and labels), open vs completed speaker tasks, outbox counts by delivery status, every CFP form with its id, status, closeAt and public link, a prioritised \"needs attention\" list, and the nearest deadlines. Reach for this for \"how is my event doing?\", \"pull the dashboard stats\" or \"what should I do next?\". It does NOT list individual sessions or times — that is get_agenda.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event"],
        required: ["event"],
      },
    ],
  },
  {
    id: "forms",
    label: "CFP forms",
    tools: [
      {
        name: "list_forms",
        title: "List CFP forms",
        description: "Lists the call-for-papers forms on an event with their open/closed status, close date, public submission URL, and how many submissions and drafts each has collected.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event"],
        required: ["event"],
      },
      {
        name: "get_form",
        title: "Get a form",
        description: "Returns a form in full: every question (type, required/enabled, options, conditional showIf rules, which one routes to tracks), the participant configuration, and the submission settings.",
        readOnly: true,
        requiresConfirm: false,
        args: ["form"],
        required: ["form"],
      },
      {
        name: "create_form",
        title: "Create a CFP form",
        description: "Creates a new call-for-papers form on an event, pre-filled with the standard question set (title, description, format, track, level, language, tags) and speaker fields. Track options are seeded from the event's existing tracks. Returns the public submission URL — the form opens immediately.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","name","kind"],
        required: ["event","name"],
      },
      {
        name: "update_form_settings",
        title: "Open, close or configure a form",
        description: "Opens or closes a CFP form, sets or clears its close date, and updates submission settings (per-user limit, drafts allowed, reminder emails, success message). This is how you extend or end a call for papers.",
        readOnly: false,
        requiresConfirm: false,
        args: ["form","status","closeAt","externalTitle","limitPerUser","allowDrafts","sendReminderEmail","successMessage"],
        required: ["form"],
      },
      {
        name: "get_public_form_link",
        title: "Get a form's public link",
        description: "Returns the shareable public submission URL for a form and whether it is currently accepting submissions. Use this when someone asks \"what's the link to submit a talk?\".",
        readOnly: true,
        requiresConfirm: false,
        args: ["form"],
        required: ["form"],
      },
      {
        name: "delete_form",
        title: "Delete a CFP form (IRREVERSIBLE)",
        description: "Permanently deletes a call-for-papers form. Admin or owner role, and confirm: true. A form that has ANY submissions (drafts included) is refused — closing it with update_form_settings(status: \"closed\") is what you almost always want, because that keeps the submissions and just stops new ones.",
        readOnly: false,
        requiresConfirm: true,
        args: ["form","confirm"],
        required: ["form","confirm"],
      },
    ],
  },
  {
    id: "submissions",
    label: "Submissions & decisions",
    tools: [
      {
        name: "list_submissions",
        title: "List submissions",
        description: "Lists submissions (abstracts and sessions) for an event, optionally filtered by status, track name, or a free-text search across titles, descriptions and speaker names/emails. Statuses: draft, pending, accept_queue, decline_queue, accepted, declined, withdrawn.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event","status","track","search","limit"],
        required: ["event"],
      },
      {
        name: "get_submission",
        title: "Get a submission",
        description: "Returns one submission in full: description, every form answer, participants with roles and emails, uploaded files with their approval state, and review scores (average plus evaluator comments). Use it before making an accept/decline call.",
        readOnly: true,
        requiresConfirm: false,
        args: ["submissionId"],
        required: ["submissionId"],
      },
      {
        name: "set_submission_status",
        title: "Stage a decision",
        description: "Moves a submission along the pipeline. Crucially, moving something to accept_queue or decline_queue only STAGES the decision — no speaker is emailed until you run commit_decision_queue. That two-step design is deliberate: stage everything, review the list, then send in one go.",
        readOnly: false,
        requiresConfirm: false,
        args: ["submissionId","status"],
        required: ["submissionId","status"],
      },
      {
        name: "commit_decision_queue",
        title: "Commit a decision queue (SENDS EMAIL)",
        description: "Commits every submission staged in the accept or decline queue: flips them to accepted/declined and QUEUES REAL DECISION EMAILS to their speakers (accepted speakers also get their onboarding tasks created). This is irreversible from the speaker's point of view, so you must pass confirm: true, and you need the admin or owner role. Preview what will be sent first with list_submissions(status: \"accept_queue\").",
        readOnly: false,
        requiresConfirm: true,
        args: ["event","queue","confirm"],
        required: ["event","queue","confirm"],
      },
      {
        name: "add_manual_session",
        title: "Add a session manually",
        description: "Adds a programme item that never came through the CFP — a sponsor slot, keynote, break or invited talk. Defaults to kind \"session\" with status \"accepted\", so it is immediately schedulable on the agenda. Speakers are matched or created by email.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","title","description","kind","status","track","format","level","language","tags","speakers"],
        required: ["event","title"],
      },
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    tools: [
      {
        name: "get_agenda",
        title: "Get the agenda",
        description: "The programme itself — WHICH session is in which room at what time. Scheduled sessions in time order (room, start, duration, track, speakers), the unscheduled tray of accepted sessions still waiting for a slot, a per-room roll-up (byRoom), the room list, and every detected conflict (same room double-booked, or a speaker in two overlapping sessions). Row detail is capped at 40 scheduled and 40 unscheduled; the counts and byRoom totals always cover everything. For status numbers rather than the timetable, use get_event_summary.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event"],
        required: ["event"],
      },
      {
        name: "schedule_session",
        title: "Schedule a session",
        description: "Places an accepted session in a room at a time. The room can be named or given by id. Conflicts never block the write — they are reported back in the result so you can decide, exactly like dragging a card on the agenda board.",
        readOnly: false,
        requiresConfirm: false,
        args: ["submissionId","room","startsAt","durationMinutes"],
        required: ["submissionId","room","startsAt"],
      },
      {
        name: "unschedule_session",
        title: "Unschedule a session",
        description: "Removes a session from its agenda slot and returns it to the unscheduled tray. The session stays accepted.",
        readOnly: false,
        requiresConfirm: false,
        args: ["submissionId"],
        required: ["submissionId"],
      },
      {
        name: "auto_place_sessions",
        title: "Auto-fill the agenda",
        description: "Greedily fills the agenda with every accepted-but-unscheduled session, skipping any slot that would double-book a room or a speaker. Already-scheduled sessions are left exactly where they are. The event needs start/end dates and at least one room. Reports how many were placed and how many wouldn't fit.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","dayStartHour","dayEndHour","defaultDurationMinutes","gapMinutes"],
        required: ["event"],
      },
    ],
  },
  {
    id: "speakers",
    label: "Speakers & tasks",
    tools: [
      {
        name: "list_speakers",
        title: "Speaker roster",
        description: "The confirmed speaker roster: everyone attached to an accepted session, their sessions, their outstanding onboarding tasks with due dates, and what's still missing from their profile (bio, headshot, slides). This is the \"who do I need to chase?\" list. The response states its own counts — totalSpeakers, returned, withOpenTasks, withProfileGaps — plus a `summary` sentence; quote those numbers rather than counting rows yourself.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event","onlyWithOutstandingWork","includeProfileGaps"],
        required: ["event"],
      },
      {
        name: "get_speaker_portal_link",
        title: "Get a speaker's portal link",
        description: "Returns the private magic link that signs one speaker straight into their portal (no password). Use it when a speaker says they can't find their invite. Treat the URL as a credential — only send it to that speaker.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event","speaker"],
        required: ["event","speaker"],
      },
      {
        name: "assign_task",
        title: "Assign a speaker task",
        description: "Assigns an onboarding task to one or more speakers — it appears in their portal immediately. Kinds: profile (completes itself once their bio is filled in), headshot (completes on upload), upload (they send a file such as slides, you review it), confirm (one click to acknowledge). Assigning does not email anyone; run send_reminders for that.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","speakers","title","kind","instructions","dueAt"],
        required: ["event","speakers","title"],
      },
      {
        name: "remove_task",
        title: "Remove a speaker task",
        description: "Deletes one onboarding task, retracting it from that speaker's portal — the inverse of assign_task, for a task assigned by mistake or no longer needed. Admin or owner role. Task ids come from list_speakers (each speaker's outstandingTasks). Completing a task is the speaker's job in the portal; this removes it outright, so don't use it to mark work as done.",
        readOnly: false,
        requiresConfirm: false,
        args: ["taskId"],
        required: ["taskId"],
      },
      {
        name: "send_reminders",
        title: "Remind speakers with open tasks (SENDS EMAIL)",
        description: "Queues a reminder email to every speaker with incomplete tasks, using the event's reminder template. Anyone already reminded in the last 20 hours is skipped automatically, so calling it twice is safe. Optionally narrow it to tasks due within N days.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","dueWithinDays"],
        required: ["event"],
      },
    ],
  },
  {
    id: "email",
    label: "Email",
    tools: [
      {
        name: "list_templates",
        title: "List email templates",
        description: "Lists the event's email templates (accepted, declined, waitlisted, reminder, confirmation) with their subject, a 200-character body preview, and whether each has been customised or is still the built-in default. Use get_template for one template's full body. Placeholders such as {{firstName}} and {{sessionTitle}} are filled in at send time.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event"],
        required: ["event"],
      },
      {
        name: "get_template",
        title: "Get an email template",
        description: "Returns one email template in full — subject and complete body, and whether it is customised for this event or still the built-in default. Read it before rewriting a template with update_template so you edit the copy that is actually in use.",
        readOnly: true,
        requiresConfirm: false,
        args: ["event","key"],
        required: ["event","key"],
      },
      {
        name: "update_template",
        title: "Edit an email template",
        description: "Rewrites an email template's subject and/or body for this event. Supported placeholders: {{speakerName}}, {{firstName}}, {{sessionTitle}}, {{eventName}}, {{portalLink}}. Editing a template does not send anything — use send_test_email to check it, and it applies to future sends.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","key","subject","body","name"],
        required: ["event","key"],
      },
      {
        name: "list_outbox",
        title: "List the email outbox",
        description: "Shows what Sessionboard has emailed (or is about to email) for this event: recipient, subject, template, delivery status and any error. Status \"preview\" means the message was rendered but deliberately not delivered (demo @example.com recipients, or no RESEND_API_KEY configured).",
        readOnly: true,
        requiresConfirm: false,
        args: ["event","status","limit"],
        required: ["event"],
      },
      {
        name: "send_test_email",
        title: "Send yourself a test email",
        description: "Renders a template with real event data and sends it to you (or an address you name) so you can proof it before it goes to speakers. Returns the rendered subject and body too, so you can check the copy without leaving the conversation.",
        readOnly: false,
        requiresConfirm: false,
        args: ["event","key","to"],
        required: ["event","key"],
      },
    ],
  },
]

export const MCP_TOOL_COUNT = 31
