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
            alt="The Devcon Berlin speakers page with the newly accepted speaker"
          />
        </Step>

        <Step title="Tick the speakers you mean and press “Assign task”.">
          <Shot
            src="walkthrough/24-assign-a-task.png"
            alt="The Assign a task dialog with a title, a task type and a due date"
            caption="Four kinds: upload a file, update their profile, upload a headshot, confirm something."
          />
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
            alt="The Communications page showing email templates"
            caption="Confirmation, acceptance, decline, waitlist and reminder — edit the wording, keep the merge fields."
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
