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
        <Step title="Devcon Berlin has no forms yet. Open Forms in the sidebar and press “Create your first form”.">
          <Shot
            src="walkthrough/09-no-forms-yet.png"
            alt="The Forms page for Devcon Berlin 2026 with no forms yet"
            caption="Forms is the first entry under PROGRAM — the sidebar runs in the order the work happens: Forms, Submissions, Evaluation, Agenda."
          />
        </Step>

        <Step title="A small dialog asks two things: what to call it, and what it collects.">
          <Shot
            src="walkthrough/10-new-form.png"
            alt="The New submission form dialog: a form name, and a choice between collecting proposals to review or confirmed programme items"
            caption="Proposals become Abstracts you decide on. Confirmed items go straight onto the programme. Both are changeable later."
          />
          <p className="doc-prose">
            The name is internal — only your team sees it. What speakers read is
            the welcome screen, which you write in the next step.
          </p>
        </Step>

        <Step title="“Create form” drops you into the builder: six steps down the left, one screen each.">
          <Shot
            src="walkthrough/11-form-questions.png"
            alt="The Submission questions step of the Devcon Berlin form builder"
            caption="Setup · Welcome screen · Submission questions · Participants · Form settings · Notifications. Every question has an on/off switch and a required switch; drag to reorder."
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
            src="walkthrough/12-form-participants.png"
            alt="The Participants step showing speaker limits and per-speaker fields"
            caption="One speaker minimum by default — a co-speaker is optional, never forced."
          />
        </Step>

        <Step title="On Form settings, set the close date and how many proposals one person may send.">
          <Shot
            src="walkthrough/13-form-settings.png"
            alt="The Form settings step showing the close date, submission limits and thank-you page"
            caption="The builder saves as you go — the footer reads “All changes saved”, and there is a Save button for when you want to be certain."
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
