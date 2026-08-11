import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/getting-started")({
  component: Page,
  head: () => ({ meta: [{ title: "Getting started · Sessionboard docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Getting started"
      lead="From nothing to an event you can build a call for papers on — about two minutes."
    >
      <Steps>
        <Step title="Create your account with an email address and a password.">
          <Shot
            src="gs-signup.png"
            alt="The Sessionboard sign-in card with a Create account tab"
            caption="No credit card, no trial clock — it is open source."
          />
        </Step>

        <Step title="You land in a workspace straight away. A workspace is your organisation; it owns your events and your team.">
          <p className="doc-prose">
            You do not have to set anything up here. Renaming it and inviting
            colleagues can wait — see{" "}
            <DocLink to="/docs/guide/team-and-workspaces">Team &amp; workspaces</DocLink>.
          </p>
        </Step>

        <Step title="Open the event switcher at the top of the left sidebar and choose “New event”.">
          <Shot
            src="gs-first-event.png"
            alt="The event switcher open, showing All events and New event"
            caption="Name, dates, timezone and venue. You can change all of it later."
          />
        </Step>

        <Step title="The dashboard is now your home: submissions by status, what is unscheduled, and who still owes you something.">
          <Shot
            src="gs-dashboard.png"
            alt="The Sessionboard organizer dashboard for a seeded event"
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Every page in the app is scoped to the event in the switcher. If
          something looks empty, check you are on the right event.
        </Callout>
      </div>
    </DocArticle>
  )
}
