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
  head: () => ({ meta: [{ title: "Build the agenda · Sessionboard docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Build the agenda"
      lead="Accepted sessions start in a tray. Drag them into a room and a time until the tray is empty."
    >
      <Steps>
        <Step title="Add your rooms first — Settings → Rooms & tracks. Without a room there is nowhere to drop anything.">
          <p className="doc-prose">
            Tracks live on the same page. They colour the cards and become the
            columns in the track view.
          </p>
        </Step>

        <Step title="Open Agenda. Six views share one board: List, Day, Week, Track, Rooms and Conflicts.">
          <Shot
            src="agenda-list.png"
            alt="The agenda in List view"
            caption="List is the fastest way to see everything at once."
          />
        </Step>

        <Step title="Drag a card from the unscheduled tray onto the grid. It saves the moment you drop it.">
          <Shot
            src="agenda-day.png"
            alt="The agenda Day view with rooms as columns and sessions placed in time slots"
          />
        </Step>

        <Step title="Check Conflicts. It flags a room booked twice and a speaker in two overlapping sessions.">
          <Shot
            src="agenda-conflicts.png"
            alt="The Conflicts view listing overlapping sessions"
            caption="Conflicts never block a drop — you decide."
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
