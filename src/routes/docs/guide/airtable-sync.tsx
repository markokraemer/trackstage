import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/airtable-sync")({
  component: Page,
  head: () => ({ meta: [{ title: "Airtable sync · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Airtable sync"
      lead="Mirror your event into an Airtable base so the automations your team already built keep firing."
    >
      <Steps>
        <Step title="Go to Settings → Integrations and press “Connect Airtable”.">
          <Shot
            src="airtable.png"
            alt="The Integrations settings page with the Airtable card"
          />
        </Step>

        <Step title="Paste a personal access token from airtable.com/create/tokens and your base ID.">
          <p className="doc-prose">
            The token needs four scopes:{" "}
            <code>data.records:read</code>, <code>data.records:write</code>,{" "}
            <code>schema.bases:read</code>, <code>schema.bases:write</code>. The
            base ID is the <code>app…</code> part of the base URL.
          </p>
        </Step>

        <Step title="Connecting creates three tables in your base — Submissions, Speakers, Sessions — and fills them.">
          <p className="doc-prose">
            If those tables already exist, Trackstage adopts them instead of
            making duplicates. Rows are matched on a{" "}
            <strong>Trackstage ID</strong> column, so re-syncing never doubles
            anything up.
          </p>
        </Step>

        <Step title="From then on it keeps itself up to date: within seconds of a change, plus a sweep every five minutes.">
          <p className="doc-prose">
            The card shows when it last synced and how many rows are in each
            table. “Sync now” forces a run.
          </p>
        </Step>
      </Steps>

      <div className="mt-10 space-y-3">
        <Callout tone="warning">
          One way only. Trackstage writes to Airtable and never reads back —
          edits made in Airtable will be overwritten.
        </Callout>
        <Callout tone="note">
          If a sync fails you get a “Last sync didn’t finish” message on the card
          with Airtable’s own error. Disconnecting only forgets the token; your
          Airtable rows stay.
        </Callout>
      </div>
    </DocArticle>
  )
}
