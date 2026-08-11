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
      lead="What your speakers see. It is the same wording as your side, so nobody has to translate."
    >
      <Steps>
        <Step title="Speakers get in with a link — from the confirmation after submitting, or from any email you send them. No password.">
          <Shot
            src="portal-home.png"
            alt="The speaker portal home screen"
            caption="Home shows what is outstanding and what has been decided."
          />
        </Step>

        <Step title="Submissions lists everything they sent you, with the same status wording you use.">
          <Shot
            src="portal-submissions.png"
            alt="The speaker portal Submissions tab"
            caption="Accepted speakers can still edit — nothing locks."
          />
        </Step>

        <Step title="Profile is where the bio, headshot, job title and links live. Whatever they save here is what appears on your public programme.">
          <Shot src="portal-profile.png" alt="The speaker portal Profile tab" />
        </Step>

        <Step title="Tasks is their to-do list from you: confirm the slot, upload slides, send a headshot.">
          <Shot
            src="portal-tasks.png"
            alt="The speaker portal Tasks tab with open tasks and due dates"
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Want to see it yourself? Open the demo portal at{" "}
          <code>/portal</code> and pick a seeded speaker.
        </Callout>
      </div>
    </DocArticle>
  )
}
