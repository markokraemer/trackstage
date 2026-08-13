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
        <Step title="Open Event settings — bottom of the sidebar — then the Integrations tab, and press “Connect Airtable”.">
          <Shot
            src="airtable.png"
            alt="The event's Integrations settings tab with the Airtable card and the Webhooks card below it"
            caption="Event-scoped, like every tab on this page — each event mirrors into its own base. Webhooks sit underneath, for when you'd rather be called than polled."
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

      <Steps>
        <Step title="Optional: let Airtable write back — one switch, then one tick per column.">
          <p className="doc-prose">
            Out of the box the sync is <strong>one way</strong>: Trackstage
            writes to Airtable and never reads back, so anything you type there
            is overwritten on the next sync. That is the safe default and most
            events never need more.
          </p>
          <p className="doc-prose">
            Turn on <strong>Let Airtable write back</strong> and you get a
            checklist of exactly which columns Airtable may change. Tick{" "}
            <strong>Status</strong> alone to triage in a grid; add{" "}
            <strong>Title</strong>, <strong>Description</strong>,{" "}
            <strong>Track</strong>, <strong>Tags</strong> and the rest to edit
            submissions there; add the Speakers columns to bulk-fix bios and job
            titles; add the Sessions columns to move things on the agenda.
            Anything you don’t tick stays read-only.
          </p>
        </Step>
      </Steps>

      <div className="mt-10 space-y-3">
        <Callout tone="warning">
          <strong>Trackstage is always the source of truth.</strong> If the same
          thing changed in both places since the last sync, Trackstage wins and
          the overruled Airtable edit is written to Settings → Activity, so you
          can see exactly what was ignored and why.
        </Callout>
        <Callout tone="note">
          <strong>What Airtable can never do.</strong> Set a submission to Draft
          or Withdrawn (those belong to the speaker), change a speaker’s email
          (it’s the identity their portal and emails hang off), create or delete
          records, or invent a track or room that doesn’t exist in Trackstage — an
          unrecognised name is left alone rather than guessed at. A cell also has
          to be mirrored at least once before an edit to it counts, which is what
          stops a half-filled row from clearing anything.
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
