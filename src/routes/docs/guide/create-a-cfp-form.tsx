import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/create-a-cfp-form")({
  component: Page,
  head: () => ({ meta: [{ title: "Create your CFP form · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Create your CFP form"
      lead="The form speakers fill in. It starts pre-filled with the questions most events ask, so this is mostly deleting."
    >
      <Steps>
        <Step title="Go to Forms in the sidebar and press “New form”.">
          <Shot src="form-list.png" alt="The Forms page listing existing CFP forms" />
        </Step>

        <Step title="Name it, then pick what it collects: talk proposals to review, or programme items that are already confirmed.">
          <Shot
            src="form-new.png"
            alt="The new-form screen with a name field and two choices"
            caption="Proposals become Abstracts you decide on. Confirmed items go straight onto the programme."
          />
        </Step>

        <Step title="Work down the six steps on the left: Setup, Welcome screen, Submission questions, Participants, Form settings, Notifications.">
          <Shot
            src="form-questions.png"
            alt="The Submission questions step of the form builder"
            caption="Every question has an on/off switch and a required switch. Drag to reorder."
          />
        </Step>

        <Step title="Open a single-select question and turn on “Route answers to tracks” — from then on, submissions land in the track the speaker picked.">
          <p className="doc-prose">
            The same drawer can add a <strong>show-if</strong> rule, so a
            question only appears when an earlier answer matches. That is how
            one form covers workshops and talks without asking everyone
            everything.
          </p>
        </Step>

        <Step title="On Form settings, set the close date and how many submissions one person may send.">
          <Shot
            src="form-settings.png"
            alt="The Form settings step showing a close date and submission limits"
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="note">
          First name, last name and email are locked on — every submission needs
          somebody to email. Next:{" "}
          <DocLink to="/docs/guide/share-and-collect">share it &amp; collect submissions</DocLink>.
        </Callout>
      </div>
    </DocArticle>
  )
}
