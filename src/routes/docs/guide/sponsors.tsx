import { createFileRoute } from "@tanstack/react-router"

import { Callout, DocArticle, Step, Steps } from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/sponsors")({
  component: Page,
  head: () => ({ meta: [{ title: "Sponsors · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Sponsors"
      lead="Not every session comes through your call for papers. Sponsors sign into their own portal and add the sessions their package includes."
    >
      <Steps>
        <Step title="Add the sponsor: its name, tier, and how many sessions its package includes.">
          <p className="doc-prose">
            Open <strong>Speakers → Sponsors</strong> and press{" "}
            <strong>Add sponsor</strong>. <em>Sessions included</em> is the
            number the sponsor can add itself — use 0 if you'll add their
            sessions for them. Add the person who handles the sponsorship as the
            main contact and tick <em>Email them their sponsor portal link
            now</em>.
          </p>
        </Step>

        <Step title="The contact opens their link and adds their sessions — title, description, format, length and who is presenting.">
          <p className="doc-prose">
            No password and no call-for-papers form. Their portal gets a tab
            named after their company with a counter like{" "}
            <strong>1 of 2 sessions added</strong>. Each speaker they name gets
            their own speaker portal for their bio and photo. They can also
            invite a colleague, who gets their own sign-in link by email.
          </p>
        </Step>

        <Step title="Their sessions land in Submissions like any other — marked with the sponsor's name.">
          <p className="doc-prose">
            By default they arrive as <strong>Pending</strong>, so you review
            them like any proposal. If every paid slot is guaranteed, switch{" "}
            <strong>Portal settings → New sponsor sessions start as</strong> to{" "}
            <strong>Accepted</strong> and they go straight to the agenda's
            unscheduled tray. On the public programme they read{" "}
            <em>Presented by</em> the sponsor.
          </p>
        </Step>

        <Step title="Freeze changes before you print the agenda.">
          <p className="doc-prose">
            Set a date under <strong>Portal settings</strong>. After it, the
            sponsor portal shows their sessions read-only and tells them to email
            you for changes. You can still edit everything yourself.
          </p>
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Already have a sponsor's session in Submissions? Open it and pick the
          sponsor in the <strong>Sponsor</strong> field — every contact of that
          sponsor can then see and edit it from their portal.
        </Callout>
      </div>
    </DocArticle>
  )
}
