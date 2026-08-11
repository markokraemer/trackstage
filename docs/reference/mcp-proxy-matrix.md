# MCP full-proxy matrix — every organizer capability → tool → gate

**Mandate (Marko, 2026-08-11):** the MCP server must be a FULL PROXY — everything the
organizer can do in the app, an agent can do over `/mcp` — and **anything that is not a
read is gated behind an explicit approval**. This document is the authoritative
capability-by-capability audit: the app surface (ground truth: the 169 public Convex
functions the organizer UI calls), the MCP tool that covers it, and its gate tier.

**Surface: 81 tools** (27 reads, 54 writes) in `convex/mcp.ts` (`TOOLS`), docs table
generated into `src/docs/generated/mcp-tools.ts`, rendered at `/docs/mcp`.

## The gating model (three layers, one rule)

| Layer | What it does | Who enforces it |
| --- | --- | --- |
| **`confirm: true`** | EVERY write tool refuses to run without it, answering an instructive tool error ("tell the user, get approval, call again"). Injected into every write schema centrally (`convex/mcp.ts`), checked in the dispatcher before validation. Client-agnostic: works in curl. | The server — cannot be routed around |
| **Tool annotations** | Every tool carries truthful `readOnlyHint` / `destructiveHint` (false = purely additive create) / `idempotentHint` / `openWorldHint: false` per the 2025-06-18 MCP spec. Clients that honor them (ChatGPT explicitly does) add their own approval prompt on writes. | Well-behaved clients |
| **Double confirmation** | `delete_event` additionally requires `confirmName` = the event's exact name. | The server |

The in-app copilot is the same model, not a parallel one: `src/routes/api/chat.ts`
suspends every tool the server does not annotate `readOnlyHint: true` (AI SDK
`toolApproval`), the organizer sees the approval card, and clicking **Approve** is what
supplies `confirm: true` (`src/lib/copilot-mcp.ts` adds it inside `execute`, which only
runs after approval). Cancel ⇒ the call is declined and the server never sees it.

**Elicitation** (`elicitation/create`) was investigated and deliberately NOT used as the
gate: Claude.ai connectors and ChatGPT don't support it (Claude Code and Cursor do), and
our server is stateless single-response JSON — a server-initiated request mid-call needs
an open stream. `confirm: true` is the portable equivalent. Per-client reality:

| Client | Honors `readOnlyHint`? | Prompts before writes? | Elicitation? | What their users see |
| --- | --- | --- | --- | --- |
| Claude.ai connectors | Directory requirement; auto-approval linkage undocumented | Yes — per-tool approval + "Allow always" | **No** (open feature request) | Claude asks per tool; even "always allowed" writes still hit our `confirm` refusal until the model asks the user |
| Claude Code | No (name-based permission rules only) | Yes — permission dialog per MCP tool | **Yes** (form + URL modes) | Permission dialog, then our `confirm` gate on top |
| ChatGPT connectors | **Yes, explicitly** — no hint ⇒ treated as write | Yes — write actions require confirmation (per conversation) | Not documented | Double gate: ChatGPT's own confirmation AND our `confirm` |
| Cursor | Not documented | Yes by default (Run Modes can allowlist) | Yes | Approval prompt, then our `confirm` gate |

## Capability → tool matrix

Tiers: **R** read (ungated) · **W** write (`confirm: true`) · **D** destructive write
(`confirm: true`, `destructiveHint: true`) · **D+** delete_event's double confirmation.

### Workspaces & events

| Capability (app surface) | MCP tool | Tier |
| --- | --- | --- |
| List workspaces / events (`workspaces.mine`, `events.list`) | `list_workspaces`, `list_events` | R |
| Dashboard (`dashboard.overview`) | `get_event_summary` (+ deprecated alias `get_event_overview`) | R |
| Create event (`events.create`) | `create_event` | W |
| Edit details, dates, venue + **portal toggles** (`events.update`) | `update_event` | D |
| Delete event + cascade (`events.remove`) | `delete_event` | **D+** |
| Members roster (`workspaces.members`) | `list_workspace_members` | R |
| Invite teammate, event-scoped (`workspaces.addMember`) | `invite_workspace_member` | W (sends email) |
| Change role / event scope (`updateMemberRole`, `setMemberEventAccess`) | `update_workspace_member` | D |
| Remove member (`workspaces.removeMember`) | `remove_workspace_member` | D |

### CFP forms & questions

| Capability | MCP tool | Tier |
| --- | --- | --- |
| List / read forms (`forms.list/get`) | `list_forms`, `get_form`, `get_public_form_link` | R |
| Create form (`forms.create`) | `create_form` | W |
| Open/close, deadline, limits, reminders (`forms.update` subset) | `update_form_settings` | D |
| Public title, heading, welcome, notify emails, participant rules (`forms.update`) | `update_form` | D |
| Question editor — add/edit/remove questions (`forms.update` questions) | `manage_form_question` | D |
| Delete form (`forms.remove`) | `delete_form` | D |

### Submissions, decisions & participants

| Capability | MCP tool | Tier |
| --- | --- | --- |
| List / read / search (`submissions.list/get/counts`) | `list_submissions`, `get_submission` | R |
| Edit content, classification, answers, embargo (`submissions.updateDetails`) | `update_submission` | D |
| Stage a decision (`submissions.setStatus`, `bulkSetStatus`) | `set_submission_status` (per id; loop for bulk) | D |
| Commit a queue → decision emails (`submissions.commitQueue`) | `commit_decision_queue` | D (email) |
| Add manual session (`submissions.addManual`) | `add_manual_session` | W |
| Trash / restore (`submissions.remove/restore/listDeleted`) | `delete_submission`, `restore_submission` | D / W |
| Attach / detach / re-role participants (`speakersAdmin.*Participant`) | `add_participant`, `remove_participant` | W / D |

### Agenda

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Board, conflicts, rooms (`agenda.board`) | `get_agenda` | R |
| Schedule / unschedule (`agenda.schedule/unschedule`) | `schedule_session`, `unschedule_session` | D |
| Auto-place (`agenda.autoPlace`) | `auto_place_sessions` | D |
| **Publish / unpublish** (`agenda.publishAgenda/unpublishAgenda`) | `set_agenda_published` | D |

### Speakers

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Roster + chase list (`dashboard.speakersRoster`, `speakersAdmin.searchPeople`) | `list_speakers` | R |
| Portal magic link | `get_speaker_portal_link` | R (credential — description warns) |
| Add by hand (`speakersAdmin.addManual`) | `add_speaker` (idempotent on email) | W |
| Edit profile, links, workflow status, embargo (`updateProfile`, `setWorkflowStatus`, `setPublicVisibility`) | `update_speaker` | D |
| **CSV-scale import** (`speakersAdmin.bulkAdd`) | `bulk_add_speakers` (≤500 rows, fills blanks only) | W |
| Remove person (`speakersAdmin.removePerson`) | `remove_speaker` (refused while on a live session) | D |

### Speaker tasks

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Task dashboard (`tasksAdmin.list`) | `list_tasks` (open/completed/overdue) | R |
| Assign, incl. **answer kind** (`tasksAdmin.create`) | `assign_task` | W |
| Edit / complete / reopen (`tasksAdmin.update`) | `update_task` | D |
| Delete (`tasksAdmin.remove`) | `remove_task` | D |
| Template library CRUD (`listTemplates/createTemplate/updateTemplate/removeTemplate/assignFromTemplate`) | `list_task_library`, `save_task_template`, `assign_task_from_template`, `delete_task_template` | R / W / W / D |
| Reminder emails (`comms.remindIncompleteSpeakers`) | `send_reminders` | D (email) |

### Files & review

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Files library w/ approval filter (`tasksAdmin.listUploads`, `files.submissionFiles`) | `list_files` (+ per-submission via `get_submission`) | R |
| **Approve / request changes** — reopens the task (`tasksAdmin.reviewUpload`) | `review_file` | D |
| Delete file + blob (`files.deleteUpload`) | `delete_file` | D |

### Comms

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Templates (`comms.listTemplates`, `upsertTemplate`) | `list_templates`, `get_template`, `update_template` | R / D |
| Outbox (`comms.listMessages`) | `list_outbox` | R |
| Test send (`comms.sendTestToSelf`) | `send_test_email` (defaults to the caller; `to` only if the user named one) | D (email) |
| **Bulk composer** audience preview (`comms.recipientCount`) | `count_bulk_audience` (count + sample emails) | R |
| **Bulk composer** send (`comms.composeBulk`) | `send_bulk_email` (same audiences, per-recipient merge fields) | D (email) |

### Evaluation

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Plans + progress (`evaluationsAdmin.listPlans/planDetail/summary`) | `list_evaluation_plans`, `get_evaluation_plan` | R |
| Create plan: criteria, pool, window, **blind** (`createPlan`) | `create_evaluation_plan` | W |
| Edit / close / reopen (`updatePlan`, `closePlan`) | `update_evaluation_plan` | D |
| Delete plan + scores (`deletePlan`) | `delete_evaluation_plan` | D |
| Add evaluator → magic review link (`addEvaluator`) | `add_evaluator` | W |
| Hand-pick assignments (`setAssignments`) | `update_evaluator` | D |
| Remove evaluator + their scores (`removeEvaluator`) | `remove_evaluator` | D |
| **Distribute** round-robin with cap (`autoDistribute`) | `distribute_evaluations` | D |
| **Remind** outstanding evaluators (`remindOutstandingEvaluators`) | `remind_evaluators` | D (email) |
| Scorecards incl. **recusals** (`submissionEvaluations`, REST evaluations) | `list_evaluations` (recused rows excluded from averages, visible as rows) | R |

### Event setup

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Rooms / tracks / tags / formats / levels / languages / statuses reads (`roomsTracks.list`, `valueLists.list`, `sessionStatuses.list`) | `list_field_options` | R |
| Rooms CRUD (`addRoom/updateRoom/deleteRoom`) | `manage_room` | W/D by action |
| Tracks CRUD (`addTrack/updateTrack/deleteTrack`) | `manage_track` | W/D by action |
| Value-list options (`valueLists.add/rename/remove`) | `manage_field_option` | W/D by action |
| Custom status labels incl. archive/restore/reassign (`sessionStatuses.*`) | `manage_session_status` | W/D by action |

### Integrations & activity

| Capability | MCP tool | Tier |
| --- | --- | --- |
| Webhooks list + delivery log (`webhooks.list/deliveries/eventTypes`) | `list_webhooks` | R |
| Webhook create/update/test/rotate/delete (`webhooks.*`) | `manage_webhook` (secret returned once on create/rotate) | W/D by action |
| Saved embeds (`embeds.list/save/remove`) | `list_embeds`, `save_embed`, `delete_embed` | R / W / D |
| Activity feed incl. **"agents" lens** (`audit.feed/forEntity`) | `list_activity` | R |

## Deliberately excluded (and why)

| Capability | Why it is not an MCP tool |
| --- | --- |
| API-key create/list/revoke (`apiKeys.*`) | Credential management over a credential is a privilege-escalation boundary: a leaked key must not be able to mint immortal successors. Settings UI only. |
| Password / display-name / sign-up / sessions (Better Auth HTTP routes) | Not Convex functions at all; session-bound identity operations. No API surface either. |
| Workspace create / `mine` / `ensure` | Session-bootstrap semantics ("claim MY invites", "MY first workspace") — meaningless for a key acting as an existing member. |
| Binary uploads: headshot, branding, file bytes (`files.generateUploadUrl`, `setHeadshot`, `setEventBranding`, `attachUploadAsOrganizer`) | MCP tool results/args are JSON text; shipping blobs through a model's context is the wrong transport. The REST API's three-step upload (`initiate → PUT bytes → complete`) is the machine path; the description of `list_files` points there. |
| Airtable connect/disconnect (`airtable.*`) | The token is a secret; secrets must not transit a model's context. Configure in Settings → Integrations. |
| `sendTestToSelf` semantics | Covered by `send_test_email`, which defaults to the caller's membership email — the "self" the key belongs to. |
| Global search (`search.global`) | The list/get tools with `search` arguments are the model-shaped equivalent; a ⌘K ranking API adds nothing an LLM can use. |
| CSV export (`submissions.exportData`) | `list_submissions` returns the same joined rows as JSON — the export format is a UI concern. |
| Demo reseed (`seed.reseed`) | Dev-only, destroys and recreates the demo event. |
| Upload comment threads (`listUploadComments`/`addUploadComment`) | Organizer-authored comments need a human author label from the session; `review_file`'s `reviewNote` covers the review-feedback use the eval kit probes. |
| Duplicate form (`forms.duplicate`) | `create_form` + `update_form`/`manage_form_question` compose it; a dedicated tool would tempt models into cloning instead of editing. |
| Delivery-status re-poll (`comms.refreshDeliveryStatus`) | A background/cron concern; `list_outbox` shows the live status. |

## REST parity note

Wherever a REST route existed, its MCP tool **wraps the same internal function**
(`internal.apiV1.*`), so REST and MCP cannot drift. Capabilities that are MCP-only
(bulk email, evaluation distribute/remind, file review, embeds, workspace members,
activity, task-template delete) mirror organizer-app functions directly; they have no
Sessionboard-API counterpart, and rule 28's REST surface intentionally tracks
Sessionboard's public API census (see `docs/reference/api-parity.md`). If a REST
integration needs one of them, promote the same internal function to a route — the
pattern is one manifest entry.

## Verification

- `scripts/verify-backend.mjs` → "MCP server" section: 81-tool count, truthful
  annotations, every write's schema requires `confirm`, no read carries it, five
  representative writes refuse without `confirm: true` with the instructive message,
  refused writes change nothing, reads run ungated — plus all pre-existing MCP flow
  assertions (now passing `confirm: true`).
- Live e2e proof (2026-08-11, dev deployment `neat-sparrow-926`): 74/74 assertions —
  every new tool family executed with `confirm: true` end to end (forms, questions,
  speakers incl. bulk, tasks, files review, submissions edit/trash/restore,
  participants, evaluation plan→evaluator→distribute→remind-gate→delete, rooms,
  tracks, options, statuses, webhooks create/test/rotate/delete, embeds, agenda
  publish toggle, workspace invite→scope→remove, bulk audience, activity agents lens),
  refusals verified side-effect-free, throwaway rows cleaned up, seeded data restored.
