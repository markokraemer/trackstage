import { Component } from "react"
import type { ComponentType, ErrorInfo, ReactNode } from "react"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiCalendarScheduleLine,
  RiDashboardLine,
  RiFileList3Line,
  RiInboxUnarchiveLine,
  RiKey2Line,
  RiMagicLine,
  RiMailCheckLine,
  RiMailLine,
  RiMailSendLine,
  RiPresentationLine,
  RiSettings3Line,
  RiShareForwardLine,
  RiTaskLine,
  RiTeamLine,
  RiToolsLine,
} from "@remixicon/react"
import type { DynamicToolUIPart, ToolUIPart } from "ai"

import { JsonBlock, isRecord } from "@/components/copilot/tool-views/shared"
import {
  EventCreatedView,
  EventStatsView,
  EventsView,
  WorkspacesView,
} from "@/components/copilot/tool-views/events"
import {
  FormCreatedView,
  FormDetailView,
  FormSettingsUpdatedView,
  FormsListView,
  PublicFormLinkView,
} from "@/components/copilot/tool-views/forms"
import {
  DecisionQueueCommittedView,
  ManualSessionView,
  StatusChangedView,
  SubmissionDetailView,
  SubmissionsListView,
} from "@/components/copilot/tool-views/submissions"
import {
  AgendaView,
  AutoPlaceView,
  SessionScheduledView,
  SessionUnscheduledView,
} from "@/components/copilot/tool-views/agenda"
import {
  RemindersSentView,
  SpeakerPortalLinkView,
  SpeakersView,
  TaskAssignedView,
} from "@/components/copilot/tool-views/speakers"
import {
  OutboxView,
  TemplateUpdatedView,
  TemplatesView,
  TestEmailView,
} from "@/components/copilot/tool-views/comms"

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
 * So: every one of the 27 tools has a view, and anything unknown falls back to
 * a syntax-highlighted JSON block that is still honest about what happened.
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
  // Workspaces & events
  list_workspaces: { icon: RiBuilding2Line, OutputView: WorkspacesView },
  list_events: { icon: RiCalendarEventLine, OutputView: EventsView },
  create_event: { icon: RiCalendarEventLine, OutputView: EventCreatedView },
  get_event_overview: { icon: RiDashboardLine, OutputView: EventStatsView },
  get_event_summary: { icon: RiDashboardLine, OutputView: EventStatsView },

  // Forms
  list_forms: { icon: RiFileList3Line, OutputView: FormsListView },
  get_form: { icon: RiFileList3Line, OutputView: FormDetailView },
  create_form: { icon: RiFileList3Line, OutputView: FormCreatedView },
  update_form_settings: {
    icon: RiSettings3Line,
    OutputView: FormSettingsUpdatedView,
  },
  get_public_form_link: {
    icon: RiShareForwardLine,
    OutputView: PublicFormLinkView,
  },

  // Submissions & decisions
  list_submissions: { icon: RiPresentationLine, OutputView: SubmissionsListView },
  get_submission: { icon: RiPresentationLine, OutputView: SubmissionDetailView },
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

  // Agenda
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

  // Speakers & tasks
  list_speakers: { icon: RiTeamLine, OutputView: SpeakersView },
  get_speaker_portal_link: {
    icon: RiKey2Line,
    OutputView: SpeakerPortalLinkView,
  },
  assign_task: { icon: RiTaskLine, OutputView: TaskAssignedView },
  send_reminders: { icon: RiMailSendLine, OutputView: RemindersSentView },

  // Comms
  list_templates: { icon: RiMailLine, OutputView: TemplatesView },
  update_template: { icon: RiMailCheckLine, OutputView: TemplateUpdatedView },
  list_outbox: { icon: RiMailSendLine, OutputView: OutboxView },
  send_test_email: { icon: RiMailCheckLine, OutputView: TestEmailView },
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
 * The honest last resort: a tool we have no view for, or a payload no view can
 * read. Marked in the DOM so tests can tell "rendered richly" from "gave up".
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
  const spec = TOOL_VIEWS[toolName]
  if (!spec?.OutputView || !isRecord(output)) {
    return <RawFallback value={output} />
  }
  const View = spec.OutputView
  return (
    <ToolViewBoundary fallback={<RawFallback value={output} />}>
      <View output={output} input={input} toolName={toolName} />
    </ToolViewBoundary>
  )
}
