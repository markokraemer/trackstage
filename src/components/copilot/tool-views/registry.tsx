import { Component } from "react"
import type { ComponentType, ErrorInfo, ReactNode } from "react"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiCalendarScheduleLine,
  RiCodeSSlashLine,
  RiDashboardLine,
  RiDeleteBin6Line,
  RiFile3Line,
  RiFileList3Line,
  RiGroupLine,
  RiHistoryLine,
  RiInboxUnarchiveLine,
  RiKey2Line,
  RiMagicLine,
  RiMailAddLine,
  RiMailCheckLine,
  RiMailLine,
  RiMailSendLine,
  RiPresentationLine,
  RiScales3Line,
  RiSettings3Line,
  RiShareForwardLine,
  RiShieldUserLine,
  RiShuffleLine,
  RiTaskLine,
  RiTeamLine,
  RiToolsLine,
  RiUserAddLine,
  RiUserStarLine,
  RiWebhookLine,
} from "@remixicon/react"
import type { DynamicToolUIPart, ToolUIPart } from "ai"

import { JsonBlock, isRecord } from "@/components/copilot/tool-views/shared"
import { AutoView } from "@/components/copilot/tool-views/auto"
import {
  EventCreatedView,
  EventDeletedView,
  EventStatsView,
  EventUpdatedView,
  EventsView,
  WorkspacesView,
} from "@/components/copilot/tool-views/events"
import {
  FormCreatedView,
  FormDeletedView,
  FormDetailView,
  FormQuestionSavedView,
  FormSettingsUpdatedView,
  FormUpdatedView,
  FormsListView,
  PublicFormLinkView,
} from "@/components/copilot/tool-views/forms"
import {
  DecisionQueueCommittedView,
  ManualSessionView,
  ParticipantChangedView,
  StatusChangedView,
  SubmissionDetailView,
  SubmissionTrashedView,
  SubmissionUpdatedView,
  SubmissionsListView,
  TrashView,
} from "@/components/copilot/tool-views/submissions"
import {
  AgendaPublishedView,
  AgendaView,
  AutoPlaceView,
  SessionScheduledView,
  SessionUnscheduledView,
} from "@/components/copilot/tool-views/agenda"
import {
  BulkSpeakersView,
  RemindersSentView,
  SpeakerPortalLinkView,
  SpeakerRemovedView,
  SpeakerSavedView,
  SpeakersView,
  TaskAssignedView,
  TaskLibraryView,
  TaskRemovedView,
  TaskTemplateSavedView,
} from "@/components/copilot/tool-views/speakers"
import {
  BulkAudienceView,
  BulkEmailSentView,
  OutboxView,
  TemplateDetailView,
  TemplateUpdatedView,
  TemplatesView,
  TestEmailView,
} from "@/components/copilot/tool-views/comms"
import {
  FileDeletedView,
  FileReviewedView,
  FilesView,
  TaskTemplateDeletedView,
  TaskUpdatedView,
  TasksView,
} from "@/components/copilot/tool-views/tasks-files"
import {
  EvaluationPlanDeletedView,
  EvaluationPlanDetailView,
  EvaluationPlanSavedView,
  EvaluationPlansView,
  EvaluationsDistributedView,
  EvaluationsView,
  EvaluatorRemovedView,
  EvaluatorSavedView,
  EvaluatorTokenRotatedView,
  EvaluatorsRemindedView,
} from "@/components/copilot/tool-views/evaluation"
import {
  ActivityView,
  EmbedDeletedView,
  EmbedSavedView,
  EmbedsView,
  FieldOptionsView,
  ManagedSettingView,
  MemberInvitedView,
  MemberRemovedView,
  MemberUpdatedView,
  WebhookSavedView,
  WebhooksView,
  WorkspaceMembersView,
  WorkspaceUpdatedView,
} from "@/components/copilot/tool-views/settings"

/**
 * Tool name → how to draw its result.
 *
 * The copilot's tools are DISCOVERED AT RUNTIME from our MCP server
 * (convex/mcp.ts, loaded as `jsonSchema` tools in src/lib/copilot-mcp.ts), so
 * they arrive in the message stream as `dynamic-tool` parts carrying a
 * `toolName` string rather than a compile-time `tool-<name>` union. That makes
 * the tool NAME the only stable key a renderer registry can use — and it means
 * this registry must degrade gracefully, because a tool added to the MCP
 * server tomorrow will show up here with no entry at all.
 *
 * The 2026-08-11 adversarial review found the consequence: the registry had
 * been built at 34 tools and the server had since tripled, so half the surface
 * was rendering as raw JSON — against Marko's directive (#30) that EVERY tool
 * call gets a real in-app view. The fix is two-layered, and both layers matter:
 *
 *  1. **Bespoke views for every tool the server exposes today.** Every entry
 *     below is hand-drawn for its payload: the numbers that matter first, the
 *     rows capped, and a link into the app section where the organizer
 *     finishes the job.
 *  2. **An AUTO VIEW as the floor, not raw JSON** (`auto.tsx`). A tool we've
 *     never seen still renders as key/value cards, clean tables and its own
 *     `note` — presentable, redacted, and honest. Raw JSON survives in exactly
 *     two places: a payload that isn't an object at all, and a view that threw.
 */

export type CopilotToolPart = ToolUIPart | DynamicToolUIPart

/** Every state the AI SDK can put a tool part in, approvals included. */
export type CopilotToolState = CopilotToolPart["state"]

export type ToolOutputProps = {
  /** The tool result, already narrowed to an object. */
  output: Record<string, unknown>
  /** The arguments the model called with — filters, requested settings. */
  input: unknown
  toolName: string
}

/** Matches Remixicon's own prop shape so any `Ri*Line` icon fits. */
export type ToolIconComponent = ComponentType<{
  size?: string | number
  className?: string
}>

type IconComponent = ToolIconComponent

export type ToolViewSpec = {
  icon: IconComponent
  OutputView?: ComponentType<ToolOutputProps>
}

const FALLBACK_ICON: IconComponent = RiToolsLine

export const TOOL_VIEWS: Record<string, ToolViewSpec | undefined> = {
  // ——— Workspaces & events ————————————————————————————————————————————————
  list_workspaces: { icon: RiBuilding2Line, OutputView: WorkspacesView },
  update_workspace: { icon: RiBuilding2Line, OutputView: WorkspaceUpdatedView },
  list_events: { icon: RiCalendarEventLine, OutputView: EventsView },
  create_event: { icon: RiCalendarEventLine, OutputView: EventCreatedView },
  update_event: { icon: RiCalendarEventLine, OutputView: EventUpdatedView },
  get_event_overview: { icon: RiDashboardLine, OutputView: EventStatsView },
  get_event_summary: { icon: RiDashboardLine, OutputView: EventStatsView },

  // ——— Workspace membership ———————————————————————————————————————————————
  list_workspace_members: {
    icon: RiShieldUserLine,
    OutputView: WorkspaceMembersView,
  },
  invite_workspace_member: {
    icon: RiMailAddLine,
    OutputView: MemberInvitedView,
  },
  update_workspace_member: {
    icon: RiShieldUserLine,
    OutputView: MemberUpdatedView,
  },
  remove_workspace_member: {
    icon: RiDeleteBin6Line,
    OutputView: MemberRemovedView,
  },

  // ——— Forms ——————————————————————————————————————————————————————————————
  list_forms: { icon: RiFileList3Line, OutputView: FormsListView },
  get_form: { icon: RiFileList3Line, OutputView: FormDetailView },
  create_form: { icon: RiFileList3Line, OutputView: FormCreatedView },
  update_form: { icon: RiFileList3Line, OutputView: FormUpdatedView },
  update_form_settings: {
    icon: RiSettings3Line,
    OutputView: FormSettingsUpdatedView,
  },
  manage_form_question: {
    icon: RiFileList3Line,
    OutputView: FormQuestionSavedView,
  },
  get_public_form_link: {
    icon: RiShareForwardLine,
    OutputView: PublicFormLinkView,
  },

  // ——— Submissions & decisions ————————————————————————————————————————————
  list_submissions: {
    icon: RiPresentationLine,
    OutputView: SubmissionsListView,
  },
  get_submission: {
    icon: RiPresentationLine,
    OutputView: SubmissionDetailView,
  },
  update_submission: {
    icon: RiPresentationLine,
    OutputView: SubmissionUpdatedView,
  },
  set_submission_status: {
    icon: RiPresentationLine,
    OutputView: StatusChangedView,
  },
  commit_decision_queue: {
    icon: RiMailSendLine,
    OutputView: DecisionQueueCommittedView,
  },
  add_manual_session: {
    icon: RiPresentationLine,
    OutputView: ManualSessionView,
  },
  // The trash is one story told by three tools, so they share two views: a
  // receipt for the move (either direction) and the list you pick from.
  delete_submission: {
    icon: RiDeleteBin6Line,
    OutputView: SubmissionTrashedView,
  },
  restore_submission: {
    icon: RiInboxUnarchiveLine,
    OutputView: SubmissionTrashedView,
  },
  list_trash: { icon: RiDeleteBin6Line, OutputView: TrashView },
  add_participant: { icon: RiUserAddLine, OutputView: ParticipantChangedView },
  remove_participant: {
    icon: RiDeleteBin6Line,
    OutputView: ParticipantChangedView,
  },

  // ——— Agenda —————————————————————————————————————————————————————————————
  get_agenda: { icon: RiCalendarScheduleLine, OutputView: AgendaView },
  schedule_session: {
    icon: RiCalendarScheduleLine,
    OutputView: SessionScheduledView,
  },
  unschedule_session: {
    icon: RiInboxUnarchiveLine,
    OutputView: SessionUnscheduledView,
  },
  auto_place_sessions: { icon: RiMagicLine, OutputView: AutoPlaceView },
  set_agenda_published: {
    icon: RiCalendarScheduleLine,
    OutputView: AgendaPublishedView,
  },

  // ——— Speakers ———————————————————————————————————————————————————————————
  list_speakers: { icon: RiTeamLine, OutputView: SpeakersView },
  get_speaker_portal_link: {
    icon: RiKey2Line,
    OutputView: SpeakerPortalLinkView,
  },
  add_speaker: { icon: RiUserAddLine, OutputView: SpeakerSavedView },
  update_speaker: { icon: RiTeamLine, OutputView: SpeakerSavedView },
  remove_speaker: { icon: RiDeleteBin6Line, OutputView: SpeakerRemovedView },
  bulk_add_speakers: { icon: RiGroupLine, OutputView: BulkSpeakersView },

  // ——— Speaker tasks ——————————————————————————————————————————————————————
  list_tasks: { icon: RiTaskLine, OutputView: TasksView },
  assign_task: { icon: RiTaskLine, OutputView: TaskAssignedView },
  update_task: { icon: RiTaskLine, OutputView: TaskUpdatedView },
  list_task_library: { icon: RiTaskLine, OutputView: TaskLibraryView },
  save_task_template: {
    icon: RiTaskLine,
    OutputView: TaskTemplateSavedView,
  },
  delete_task_template: {
    icon: RiDeleteBin6Line,
    OutputView: TaskTemplateDeletedView,
  },
  // Same payload shape as assign_task — one view, because from the
  // organizer's side the two tools did the same thing.
  assign_task_from_template: { icon: RiTaskLine, OutputView: TaskAssignedView },
  send_reminders: { icon: RiMailSendLine, OutputView: RemindersSentView },

  // ——— Files & review —————————————————————————————————————————————————————
  list_files: { icon: RiFile3Line, OutputView: FilesView },
  review_file: { icon: RiFile3Line, OutputView: FileReviewedView },
  delete_file: { icon: RiDeleteBin6Line, OutputView: FileDeletedView },

  // ——— Email ——————————————————————————————————————————————————————————————
  list_templates: { icon: RiMailLine, OutputView: TemplatesView },
  get_template: { icon: RiMailLine, OutputView: TemplateDetailView },
  update_template: { icon: RiMailCheckLine, OutputView: TemplateUpdatedView },
  list_outbox: { icon: RiMailSendLine, OutputView: OutboxView },
  send_test_email: { icon: RiMailCheckLine, OutputView: TestEmailView },
  count_bulk_audience: { icon: RiGroupLine, OutputView: BulkAudienceView },
  send_bulk_email: { icon: RiMailSendLine, OutputView: BulkEmailSentView },

  // ——— Evaluation —————————————————————————————————————————————————————————
  list_evaluation_plans: {
    icon: RiScales3Line,
    OutputView: EvaluationPlansView,
  },
  get_evaluation_plan: {
    icon: RiScales3Line,
    OutputView: EvaluationPlanDetailView,
  },
  create_evaluation_plan: {
    icon: RiScales3Line,
    OutputView: EvaluationPlanSavedView,
  },
  update_evaluation_plan: {
    icon: RiScales3Line,
    OutputView: EvaluationPlanSavedView,
  },
  delete_evaluation_plan: {
    icon: RiDeleteBin6Line,
    OutputView: EvaluationPlanDeletedView,
  },
  add_evaluator: { icon: RiUserStarLine, OutputView: EvaluatorSavedView },
  update_evaluator: { icon: RiUserStarLine, OutputView: EvaluatorSavedView },
  rotate_evaluator_token: {
    icon: RiKey2Line,
    OutputView: EvaluatorTokenRotatedView,
  },
  remove_evaluator: {
    icon: RiDeleteBin6Line,
    OutputView: EvaluatorRemovedView,
  },
  list_evaluations: { icon: RiScales3Line, OutputView: EvaluationsView },
  distribute_evaluations: {
    icon: RiShuffleLine,
    OutputView: EvaluationsDistributedView,
  },
  remind_evaluators: {
    icon: RiMailSendLine,
    OutputView: EvaluatorsRemindedView,
  },

  // ——— Event setup ————————————————————————————————————————————————————————
  list_field_options: { icon: RiSettings3Line, OutputView: FieldOptionsView },
  // Four tools, one verb over four tables — one receipt, so the organizer
  // learns a single card instead of four.
  manage_room: { icon: RiSettings3Line, OutputView: ManagedSettingView },
  manage_track: { icon: RiSettings3Line, OutputView: ManagedSettingView },
  manage_field_option: {
    icon: RiSettings3Line,
    OutputView: ManagedSettingView,
  },
  manage_session_status: {
    icon: RiSettings3Line,
    OutputView: ManagedSettingView,
  },

  // ——— Integrations ———————————————————————————————————————————————————————
  list_webhooks: { icon: RiWebhookLine, OutputView: WebhooksView },
  manage_webhook: { icon: RiWebhookLine, OutputView: WebhookSavedView },
  list_embeds: { icon: RiCodeSSlashLine, OutputView: EmbedsView },
  save_embed: { icon: RiCodeSSlashLine, OutputView: EmbedSavedView },
  delete_embed: { icon: RiDeleteBin6Line, OutputView: EmbedDeletedView },
  list_activity: { icon: RiHistoryLine, OutputView: ActivityView },

  // ——— Deletion. Each one draws a RECEIPT — what went, and how much of it —
  // never a celebration, because none of it can be undone. The approval card in
  // copilot-tool-part.tsx carries the real weight here: every one of these
  // matches isDestructiveTool(), so none of them runs unconfirmed.
  delete_event: { icon: RiDeleteBin6Line, OutputView: EventDeletedView },
  delete_form: { icon: RiDeleteBin6Line, OutputView: FormDeletedView },
  remove_task: { icon: RiDeleteBin6Line, OutputView: TaskRemovedView },
}

/** The icon for a tool, including ones we've never heard of. */
export function toolIcon(toolName: string): IconComponent {
  return TOOL_VIEWS[toolName]?.icon ?? FALLBACK_ICON
}

/** True when we have a purpose-built view — used by tests and the frame. */
export function hasToolView(toolName: string): boolean {
  return Boolean(TOOL_VIEWS[toolName]?.OutputView)
}

/**
 * A view that throws must cost the organizer a JSON block, never the whole
 * conversation — so the rich rendering runs inside a boundary. A try/catch
 * would not do: React renders the element long after this function returns.
 */
class ToolViewBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[copilot] tool view failed:", error, info.componentStack)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * The last resort, and deliberately rare: a payload that is not an object at
 * all, or a view (auto view included) that threw. Marked in the DOM so tests
 * can tell "rendered richly" from "gave up".
 */
function RawFallback({ value }: { value: unknown }) {
  return (
    <div data-view-fallback="">
      <JsonBlock value={value} />
    </div>
  )
}

/** The rich rendering of a tool result, with the raw JSON as its safety net. */
export function CopilotToolOutput({
  toolName,
  input,
  output,
}: {
  toolName: string
  input: unknown
  output: unknown
}): ReactNode {
  if (!isRecord(output)) return <RawFallback value={output} />
  // No bespoke view? The auto view still draws it properly — a tool result
  // never reaches the organizer as naked JSON.
  const View = TOOL_VIEWS[toolName]?.OutputView ?? AutoView
  return (
    <ToolViewBoundary fallback={<RawFallback value={output} />}>
      <View output={output} input={input} toolName={toolName} />
    </ToolViewBoundary>
  )
}
