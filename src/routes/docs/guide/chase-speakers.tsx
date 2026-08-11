import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
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
        <Step title="Open Speakers. It lists everyone on an accepted session and what each of them still owes you.">
          <Shot
            src="speakers-list.png"
            alt="The Speakers page listing confirmed speakers and outstanding tasks"
          />
        </Step>

        <Step title="Tick the speakers you mean and press “Assign task” — or assign to everyone from the header button.">
          <Shot
            src="speaker-tasks.png"
            alt="The Assign a task dialog with a title, a task type and a due date"
            caption="Four kinds: upload a file, update their profile, upload a headshot, confirm something."
          />
        </Step>

        <Step title="Profile and headshot tasks tick themselves off the moment the speaker fills that field. Uploads and confirmations wait for them to act.">
          <p className="doc-prose">
            Speakers see the list in their portal under <strong>Tasks</strong>,
            with your instructions and the due date.
          </p>
        </Step>

        <Step title="Press “Remind all incomplete” to email everyone with an unfinished task — anyone reminded in the last day is skipped automatically.">
          <p className="doc-prose">
            Trackstage also sends a daily nudge for tasks coming due, so most
            of the chasing happens without you.
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
          not delivered — that means no <code>RESEND_API_KEY</code> is
          configured on the deployment.
        </Callout>
      </div>
    </DocArticle>
  )
}
