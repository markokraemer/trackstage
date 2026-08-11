import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/share-and-collect")({
  component: Page,
  head: () => ({ meta: [{ title: "Share it & collect · Sessionboard docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Share it & collect submissions"
      lead="One link. No account needed to start, no login wall in the middle."
    >
      <Steps>
        <Step title="On the Forms page press “Copy public link” on your form, and paste it wherever your speakers are.">
          <Shot
            src="share-link.png"
            alt="A form card with Copy public link, View and Edit buttons"
            caption="“View” opens the same page a speaker sees. Use it to proof-read."
          />
        </Step>

        <Step title="Speakers get a five-step form: Welcome, Account, Submission, Participants, Review.">
          <Shot
            src="submit-welcome.png"
            alt="The public call-for-papers welcome screen"
          />
        </Step>

        <Step title="They enter an email to identify themselves — that is all. Everything they type is saved as a draft they can come back to.">
          <Shot
            src="submit-form.png"
            alt="The submission step of the public form"
          />
        </Step>

        <Step title="They add co-speakers on the Participants step, check the Review step, and submit.">
          <p className="doc-prose">
            After submitting they are offered a link straight into their{" "}
            <strong>speaker portal</strong> — no password to invent.
          </p>
        </Step>

        <Step title="Every submission appears live on your Submissions page as Pending.">
          <Shot
            src="submissions-inbox.png"
            alt="The Submissions table showing pending submissions"
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="note">
          Closing the form (Forms → ⋯ → “Close form”, or the close date you set)
          stops new submissions. Drafts already started stay visible to you.
        </Callout>
      </div>
    </DocArticle>
  )
}
