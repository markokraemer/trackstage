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

        <Step title="Drag a card onto the grid — or click it and pick a room, a day and a start time. Both save the moment you finish.">
          <Shot
            src="walkthrough/28-schedule-a-session.png"
            alt="The schedule popover for the talk, with room, day, start-time and length pickers"
            caption="The click-to-schedule path exists so the agenda works on a laptop trackpad, a tablet, or by keyboard. Focus a card and press Enter to place it with the arrow keys."
          />
        </Step>

        <Step title="It lands on the grid, in the right room, in your event’s timezone.">
          <Shot
            src="walkthrough/29-agenda.png"
            alt="The Devcon Berlin day view with the talk placed in the Aula at 09:00"
          />
        </Step>

        <Step title="Check Conflicts before you publish. It watches for two things: a room booked twice, and a speaker in two overlapping sessions.">
          <Shot
            src="agenda-conflicts.png"
            alt="The Conflicts view of a fully scheduled event, reporting no clashes"
            caption="From a full, published event with nothing clashing — which is what you want to see here. Anything that does clash appears the moment it happens, and conflicts never block a drop: you decide."
          />
        </Step>
      </Steps>

      <div className="mt-10 space-y-3">
        <Callout tone="tip">
          In a hurry? <strong>Auto-place</strong> in the toolbar fills the grid
          for you — it places everything that fits and tells you what did not.
          The <DocLink to="/docs/guide/ai-copilot">AI copilot</DocLink> can do
          the same from a sentence.
        </Callout>
        <Callout tone="note">
          Nothing here is public yet. The programme stays a private draft until
          you press <strong>Publish agenda</strong> — see{" "}
          <DocLink to="/docs/guide/publish-your-program">Publish your program</DocLink>.
        </Callout>
      </div>
    </DocArticle>
  )
}
