import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/chase-speakers")({
  component: Page,
  head: () => ({ meta: [{ title: "Chase speakers · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Chase speakers"
      lead="Give people a to-do list instead of an inbox thread, then remind everyone who is behind in one click."
    >
      <Steps>
        <Step title="Sending the acceptances put your first speaker on the Speakers page. It lists everyone on an accepted session and what each of them still owes you.">
          <Shot
            src="walkthrough/23-speakers.png"
            alt="The Devcon Berlin speakers page with the newly accepted speaker, their task progress and what is still needed"
            caption="“Still needed” is the short version: no bio, no headshot, no slides. Speakers who never applied can be added by hand or imported from a CSV."
          />
        </Step>

        <Step title="Press “Assign task”, give it a title, and pick what the speaker actually has to do.">
          <Shot
            src="walkthrough/24-assign-a-task.png"
            alt="The Assign a task dialog: a task title and the five kinds of task a speaker can be given"
            caption="Five kinds: upload a file, answer a question, update their profile, upload a headshot, confirm something. Instructions, a due date and the “Assign to” list follow underneath."
          />
          <p className="doc-prose">
            <strong>Assign to</strong> is further down the dialog — tick
            everyone who needs to do this. Ticking rows in the table first
            pre-fills it: a bar appears above the list saying how many speakers
            are selected, with “Assign task” right there in it.
          </p>
        </Step>

        <Step title="It appears in their portal immediately, with your instructions and the due date.">
          <p className="doc-prose">
            Profile and headshot tasks tick themselves off the moment the speaker
            fills that field. Uploads and confirmations wait for them to act. See{" "}
            <DocLink to="/docs/guide/speaker-portal">Speaker portal</DocLink> for
            their side of it.
          </p>
        </Step>

        <Step title="Press “Remind all incomplete” to email everyone with an unfinished task — anyone reminded in the last day is skipped automatically.">
          <p className="doc-prose">
            Trackstage also sends a daily nudge for tasks coming due, so most of
            the chasing happens without you.
          </p>
        </Step>

        <Step title="Communications is the record: the Templates tab is what gets sent, the Outbox tab is what was sent.">
          <Shot
            src="communications.png"
            alt="The Communications page showing the confirmation, acceptance, decline and waitlist email templates"
            caption="Confirmation, acceptance, decline, waitlist and reminder — edit the wording, keep the merge fields. “Compose” sends a one-off to speakers you pick."
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="note">
          An email marked <strong>Preview</strong> in the Outbox was rendered but
          not delivered — that means no <code>RESEND_API_KEY</code> is configured
          on the deployment.
        </Callout>
      </div>
    </DocArticle>
  )
}
