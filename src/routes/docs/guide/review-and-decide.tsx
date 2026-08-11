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
  head: () => ({ meta: [{ title: "Review & decide · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Review & decide"
      lead="Decisions are two steps on purpose: stage them all, read the list once, then send."
    >
      <Steps>
        <Step title="Open Submissions. The tabs across the top are the whole pipeline — All, Accepted, Accept Queue, Pending, Decline Queue, Declined, Withdrawn, Drafts.">
          <Shot
            src="walkthrough/19-first-submission.png"
            alt="The Devcon Berlin submissions inbox with status tabs and one pending proposal"
            caption="Search, plus track and status filters, sit above the table."
          />
        </Step>

        <Step title="Click a row to read the whole thing: the abstract, every answer, the speakers, uploaded files and any evaluator scores.">
          <Shot
            src="walkthrough/20-read-the-submission.png"
            alt="The submission drawer for the Devcon Berlin proposal, showing the abstract and speaker"
          />
        </Step>

        <Step title="Set the status to Accept Queue or Decline Queue. Nothing is emailed yet — the speaker sees no change at all.">
          <Shot
            src="walkthrough/21-accept-queue.png"
            alt="The Accept Queue tab with one staged proposal and a banner counting it"
            caption="Tick several rows to stage them in one go."
          />
        </Step>

        <Step title="A banner counts what is staged. Read the queue one last time — this is the only moment it costs nothing to change your mind.">
          <p className="doc-prose">
            “Review the queue” filters the table down to exactly what is about to
            go out.
          </p>
        </Step>

        <Step title="Press “Send acceptances” (or “Send declines”) and confirm.">
          <Shot
            src="walkthrough/22-send-acceptances.png"
            alt="The confirmation dialog before sending the acceptances"
            caption="The dialog counts what is going out. Accepted speakers also get their onboarding tasks created."
          />
        </Step>

        <Step title="At a real event this table is hundreds of rows deep — the same tabs, the same two-step decision.">
          <Shot
            src="submissions-inbox.png"
            alt="A submissions table for a large event with many proposals across every status"
            caption="A different, much larger event — so you can see how the pipeline reads at scale."
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
