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
  head: () => ({ meta: [{ title: "Share it & collect · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Share it & collect submissions"
      lead="One link. No account needed to start, no login wall in the middle."
    >
      <Steps>
        <Step title="On the Forms page press “Copy public link”, and paste it wherever your speakers are.">
          <Shot
            src="walkthrough/14-share-the-link.png"
            alt="The Devcon Berlin Call for Speakers card with its public address, Copy public link, View and Edit"
            caption="“View” opens the exact page a speaker sees. Use it to proof-read."
          />
          <p className="doc-prose">
            The link is printed on the card so you can read it before you send
            it: <code>/submit/{"{workspace}"}/{"{event}"}/{"{form}"}</code>. It
            never changes unless you rename the form, so it is safe on a poster.
          </p>
        </Step>

        <Step title="This is what they get: a five-step form — Welcome, Account, Submission, Participants, Review.">
          <Shot
            src="walkthrough/15-submit-welcome.png"
            alt="The public Devcon Berlin call-for-speakers welcome screen with dates, venue and tracks"
            caption="Your event's name, dates and venue at the top; the step tracker down the side stays visible the whole way through."
          />
        </Step>

        <Step title="They give an email to identify themselves. That is the whole account step — no password to invent.">
          <Shot
            src="walkthrough/16-submit-account.png"
            alt="The account step of the public form asking only for an email address"
            caption="Everything they type from here on is saved against that address as a draft."
          />
        </Step>

        <Step title="If that address has already been used for your event, we email them a secure link instead of letting them straight in.">
          <p className="doc-prose">
            First time? They go straight through. But once an address has a
            submission, a draft, a task or a co-speaker credit, anyone who typed
            it would be looking at somebody else&rsquo;s proposals — so we send a
            one-click sign-in link to the address itself and show a &ldquo;check
            your email&rdquo; screen. Opening the link carries on exactly where
            they were. Still no password, and nothing about the account is shown
            until the link is opened.
          </p>
        </Step>

        <Step title="Then the proposal itself: your questions, in your order, with the tracks you set up.">
          <Shot
            src="walkthrough/17-submit-talk.png"
            alt="A speaker filling in the Devcon Berlin proposal: title, description, format and track"
          />
        </Step>

        <Step title="Participants is where they name themselves and add any co-speakers.">
          <Shot
            src="walkthrough/18-submit-speaker.png"
            alt="The participants step with the speaker's name, job title and company"
          />
        </Step>

        <Step title="Review shows everything back to them in one screen before anything is sent.">
          <Shot
            src="walkthrough/19-submit-review.png"
            alt="The review step summarising the proposal and the speaker before submitting"
          />
        </Step>

        <Step title="On submit they get a confirmation and a link straight into their speaker portal.">
          <Shot
            src="walkthrough/20-submitted.png"
            alt="The thank-you screen after submitting, offering a link to the speaker portal"
            caption="No password, no second sign-up. The link is theirs from now on."
          />
        </Step>

        <Step title="Meanwhile, on your side: the proposal is already in Submissions, marked Pending.">
          <Shot
            src="walkthrough/21-first-submission.png"
            alt="The Devcon Berlin submissions inbox showing the first proposal as Pending"
            caption="Live — no refresh. It appeared while the speaker was still on the thank-you page."
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
