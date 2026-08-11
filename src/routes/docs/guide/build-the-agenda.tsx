import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/build-the-agenda")({
  component: Page,
  head: () => ({ meta: [{ title: "Build the agenda · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Build the agenda"
      lead="Accepted sessions start in a tray on the left. Move them into a room and a time until the tray is empty."
    >
      <Steps>
        <Step title="Open Agenda. Everything you accepted is waiting in the unscheduled tray — nothing is on the grid yet.">
          <Shot
            src="walkthrough/27-nothing-scheduled.png"
            alt="The Devcon Berlin agenda with the accepted talk waiting in the unscheduled tray"
            caption="Six views share one board: List, Day, Week, Track, Rooms and Conflicts."
          />
        </Step>

        <Step title="Drag a card onto the grid — or click it and pick a day, a room and a start time. Both save the moment you finish.">
          <Shot
            src="walkthrough/28-schedule-a-session.png"
            alt="The schedule popover for the talk, with day, room and start-time selects"
            caption="The click-to-schedule path exists so the agenda works on a laptop trackpad, a tablet, or by keyboard."
          />
        </Step>

        <Step title="It lands on the grid, in the right room, in your event’s timezone.">
          <Shot
            src="walkthrough/29-agenda.png"
            alt="The Devcon Berlin day view with the talk placed in the Aula at 09:00"
          />
        </Step>

        <Step title="Check Conflicts before you publish. It flags a room booked twice and a speaker in two overlapping sessions.">
          <Shot
            src="agenda-conflicts.png"
            alt="The Conflicts view of a full programme, listing overlapping sessions"
            caption="From a full event — one talk cannot clash with itself. Conflicts never block a drop; you decide."
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          In a hurry? Ask the{" "}
          <DocLink to="/docs/guide/ai-copilot">AI copilot</DocLink> to “auto-fill
          the agenda” — it places everything that fits and tells you what did
          not.
        </Callout>
      </div>
    </DocArticle>
  )
}
