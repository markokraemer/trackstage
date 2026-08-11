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
            src="walkthrough/25-speaker-portal.png"
            alt="The speaker portal home for the accepted Devcon Berlin speaker"
            caption="Home shows what has been decided and what is still outstanding."
          />
        </Step>

        <Step title="Tasks is their to-do list from you: confirm the slot, upload slides, send a headshot.">
          <Shot
            src="walkthrough/26-speaker-tasks.png"
            alt="The speaker portal Tasks tab with the headshot-and-bio task the organizer assigned"
            caption="The task you assigned on the organizer side is already waiting here."
          />
        </Step>

        <Step title="Submissions lists everything they sent you, with the same status wording you use.">
          <Shot
            src="portal-submissions.png"
            alt="The speaker portal Submissions tab for a speaker with several proposals"
            caption="Accepted speakers can still edit — nothing locks."
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
          Want to see it yourself? Open the demo portal at <code>/portal</code>{" "}
          and pick a seeded speaker.
        </Callout>
      </div>
    </DocArticle>
  )
}
