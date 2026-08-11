import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/review-and-decide")({
  component: Page,
  head: () => ({ meta: [{ title: "Review & decide · Sessionboard docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Review & decide"
      lead="Decisions are two steps on purpose: stage them all, read the list once, then send."
    >
      <Steps>
        <Step title="Open Submissions and use the tabs — All, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, Drafts.">
          <Shot
            src="submissions-inbox.png"
            alt="The Submissions page with status tabs and counts"
            caption="Search, plus filters for track and status, sit above the table."
          />
        </Step>

        <Step title="Click a row to read the whole thing: the abstract, every answer, the speakers, uploaded files and any evaluator scores.">
          <Shot
            src="review-detail.png"
            alt="A submission detail drawer with the abstract and speakers"
          />
        </Step>

        <Step title="Set the status to Accept Queue or Decline Queue. Nothing is emailed yet — the speaker sees no change.">
          <Shot
            src="review-queue.png"
            alt="Submissions filtered to the accept queue with a banner at the top"
            caption="Tick several rows to stage them in one go."
          />
        </Step>

        <Step title="A banner appears at the top of the page counting what is staged. Read the queue one last time.">
          <p className="doc-prose">
            “Review the queue” filters the table down to exactly what is about to
            go out.
          </p>
        </Step>

        <Step title="Press “Send acceptances” (or “Send declines”) and confirm.">
          <Shot
            src="review-commit.png"
            alt="The confirmation dialog before sending acceptances"
            caption="Accepted speakers are emailed and get their onboarding tasks created."
          />
        </Step>
      </Steps>

      <div className="mt-10 space-y-3">
        <Callout tone="warning">
          Sending is the point of no return for the speaker — the email has left.
          The status can still be changed afterwards, but the message cannot be
          unsent.
        </Callout>
        <Callout tone="note">
          Running a scored review with a panel? That lives under{" "}
          <strong>Evaluation</strong>: bundle evaluators, submissions and rounds
          into a plan, and each evaluator gets their own “My evaluations” link.
        </Callout>
      </div>
    </DocArticle>
  )
}
