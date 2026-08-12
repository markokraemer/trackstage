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
      lead="Accepted sessions wait in a tray beside the grid. Move them into a room and a time until the tray is empty."
    >
      <Steps>
        <Step title="Open Agenda. Everything you accepted is sitting in “Not scheduled” on the right — nothing is on the grid yet.">
          <Shot
            src="walkthrough/30-nothing-scheduled.png"
            alt="The Devcon Berlin agenda, Day view, with rooms as columns and the accepted talk waiting in the Not scheduled tray"
            caption="Six views share one board: List, Day, Week, Track, Rooms and Conflicts. The chip on the right names the timezone every time on screen is in."
          />
        </Step>

        <Step title="Drag a card onto the grid — or open it and pick a room, a day and a start time. Both save the moment you finish.">
          <Shot
            src="walkthrough/31-schedule-a-session.png"
            alt="The schedule panel for the talk, with room, day, start-time and length pickers and a Schedule session button"
            caption="The click-to-schedule path exists so the agenda works on a laptop trackpad, a tablet, or by keyboard. Focus a card and press Enter to place it with the arrow keys."
          />
        </Step>

        <Step title="It lands on the grid, in the right room, in your event’s timezone.">
          <Shot
            src="walkthrough/32-agenda.png"
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
          for you — the number beside it is how many sessions are still waiting.
          It places everything that fits and tells you what did not. The{" "}
          <DocLink to="/docs/guide/ai-copilot">AI copilot</DocLink> can do the
          same from a sentence.
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
