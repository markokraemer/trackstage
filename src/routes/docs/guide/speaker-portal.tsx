import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/speaker-portal")({
  component: Page,
  head: () => ({ meta: [{ title: "Speaker portal · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Speaker portal"
      lead="What your speakers see. Same wording as your side, so nobody has to translate."
    >
      <Steps>
        <Step title="Speakers get in with a link — from the confirmation after submitting, or from any email you send them. No password.">
          <Shot
            src="walkthrough/28-speaker-portal.png"
            alt="The speaker portal home for the accepted Devcon Berlin speaker: their submission, profile completeness and open tasks"
            caption="Your event's name, dates and venue sit across the top. Four tabs — Home, Submissions, Profile, Tasks — and Tasks carries a count so nothing gets forgotten."
          />
        </Step>

        <Step title="Home answers the two questions they actually have: what was decided, and what is still on me?">
          <p className="doc-prose">
            Their submission shows its status in your words —{" "}
            <strong>Accepted</strong> here. A profile bar counts what is filled
            in (biography, headshot, job title, a link), and the open tasks run
            underneath with their due dates.
          </p>
        </Step>

        <Step title="Lost the link? They enter their email on your call-for-speakers page and we send a fresh one.">
          <p className="doc-prose">
            The link is the whole login, so it is also the whole security model:
            an address that already has submissions, tasks or a profile behind it
            never opens from the form itself — we email a new sign-in link to
            that address and show nothing about the account until it is opened.
            Up to three links an hour, and every one of them shows up in your
            Communications outbox as “Sign-in link”, so you can see it was sent.
          </p>
        </Step>

        <Step title="Tasks is their to-do list from you: confirm the slot, upload slides, send a headshot.">
          <Shot
            src="walkthrough/29-speaker-tasks.png"
            alt="The speaker portal Tasks tab: the task the organizer assigned, plus the three onboarding tasks acceptance created"
            caption="Top of the list is the task the organizer assigned a minute ago — anything with a due date sorts first. The three below it were created automatically the moment the talk was accepted."
          />
        </Step>

        <Step title="Submissions lists everything they sent you, with the same status wording you use.">
          <Shot
            src="portal-submissions.png"
            alt="The speaker portal Submissions tab for a speaker with several proposals"
            caption="They can keep editing while your call is open — being accepted does not lock anything. Once the call closes, editing closes with it for everyone, unless you reopen it in the event's portal settings."
          />
        </Step>

        <Step title="Profile is where the bio, headshot, job title and links live. Whatever they save here is what appears on your public programme.">
          <Shot
            src="portal-profile.png"
            alt="The speaker portal Profile tab with bio, headshot and links"
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Want to see it yourself? Open <code>/portal</code> and press{" "}
          <strong>Open the demo speaker portal</strong> — that is a real speaker
          on the sample event, with submissions, a profile and open tasks.
        </Callout>
      </div>
    </DocArticle>
  )
}
