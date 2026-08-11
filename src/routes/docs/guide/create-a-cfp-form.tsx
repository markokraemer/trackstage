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
      lead="The form speakers fill in. It arrives pre-filled with the questions most events ask, so this is mostly deleting."
    >
      <Steps>
        <Step title="Devcon Berlin has no forms yet. Open Forms and press “New form”.">
          <Shot
            src="walkthrough/07-no-forms-yet.png"
            alt="The Forms page for Devcon Berlin 2026 with no forms yet"
          />
        </Step>

        <Step title="Name it, then pick what it collects: talk proposals you will review, or programme items that are already confirmed.">
          <Shot
            src="walkthrough/08-new-form.png"
            alt="The new-form screen named Devcon Berlin Call for Speakers, with two collection choices"
            caption="Proposals become Abstracts you decide on. Confirmed items go straight onto the programme."
          />
        </Step>

        <Step title="The builder opens on six steps: Setup, Welcome screen, Submission questions, Participants, Form settings, Notifications.">
          <Shot
            src="walkthrough/09-form-questions.png"
            alt="The Submission questions step of the Devcon Berlin form builder"
            caption="Every question has an on/off switch and a required switch. Drag to reorder."
          />
        </Step>

        <Step title="The Track question already lists the tracks you created in Settings, so submissions route themselves the moment a speaker picks one.">
          <p className="doc-prose">
            Open any single-select question to add a <strong>show-if</strong>{" "}
            rule as well, so it only appears when an earlier answer matches. That
            is how one form covers workshops and talks without asking everyone
            everything.
          </p>
        </Step>

        <Step title="Participants decides who a submission is about: how many speakers are allowed, and which details you ask each of them for.">
          <Shot
            src="walkthrough/10-form-participants.png"
            alt="The Participants step showing speaker limits and per-speaker fields"
            caption="One speaker minimum by default — a co-speaker is optional, never forced."
          />
        </Step>

        <Step title="On Form settings, set the close date and how many proposals one person may send.">
          <Shot
            src="walkthrough/11-form-settings.png"
            alt="The Form settings step showing the close date, submission limits and thank-you page"
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
