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
        <Step title="Open Submissions. Two rows of tabs: what a thing IS, then where it stands.">
          <Shot
            src="walkthrough/19-first-submission.png"
            alt="The Devcon Berlin submissions inbox with kind tabs, status tabs and one pending proposal"
            caption="Top row: All · Abstracts · Sessions. Second row: the pipeline. Search and a track filter sit above the table."
          />
          <p className="doc-prose">
            <strong>Abstracts</strong> arrived through one of your forms and are
            waiting on you. <strong>Sessions</strong> are things you added
            yourself — keynotes, sponsor slots, breaks — and they start out
            accepted. The second row is the pipeline every abstract moves
            along: All, Accepted, Accept Queue, Pending, Decline Queue,
            Declined, Withdrawn, Drafts. The two combine, so “Abstracts +
            Pending” is one click.
          </p>
        </Step>

        <Step title="Click a row to read the whole thing. The drawer has five tabs: Details, People, Reviews, Files and History.">
          <Shot
            src="walkthrough/20-read-the-submission.png"
            alt="The submission drawer for the Devcon Berlin proposal, with Details, People, Reviews, Files and History tabs"
            caption="Everything is editable in place, including the status pill at the top."
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

        <Step title="At a real event this table runs to hundreds of rows — same tabs, same two-step decision, plus filters to cut it down.">
          <Shot
            src="submissions-inbox.png"
            alt="A busier event's submissions table, filtered to accepted talks in one track, showing scores and speakers"
            caption="A different, busier event, narrowed to Accepted in one track. The counts on both tab rows always report the whole event."
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
