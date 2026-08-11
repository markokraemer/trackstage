import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/publish-your-program")({
  component: Page,
  head: () => ({ meta: [{ title: "Publish your program · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Publish your program"
      lead="One button turns the private board into a public schedule. You never have to publish twice."
    >
      <Steps>
        <Step title="On Agenda, press “Publish agenda” and confirm. The dialog tells you exactly how many sessions go live and where.">
          <Shot
            src="walkthrough/30-publish.png"
            alt="The Publish the agenda dialog naming the public address and the session count"
            caption="Until you do, the public page says “Schedule coming soon” — no times leak."
          />
        </Step>

        <Step title="That is it. Your public event page is live, with Schedule, Speakers, Sessions and My schedule.">
          <Shot
            src="walkthrough/31-public-page.png"
            alt="The live public page for Devcon Berlin 2026 showing the published schedule"
            caption="The same talk the speaker submitted, now on a public programme. Every later edit goes out live — no re-publishing."
          />
        </Step>

        <Step title="Publishing is one reversible flag.">
          <p className="doc-prose">
            An <strong>Unpublish</strong> button appears next to a “Published ·
            date” pill, and unpublishing deletes nothing.
          </p>
        </Step>

        <Step title="Need it on your own website? Open Embeds and build a widget in three picks.">
          <Shot
            src="embeds.png"
            alt="The Embeds page with widget, format and display options"
            caption="Widget (agenda, sessions, speakers…), format (iframe, link, static HTML, JSON, calendar feed), then what shows."
          />
        </Step>

        <Step title="Give the configuration a name so you can come back to it — “Agenda for the sponsors page”.">
          <p className="doc-prose">
            The calendar feed needs no key at all: attendees subscribe once and
            their calendar keeps itself right.
          </p>
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="note">
          The JSON feed is the same data as the{" "}
          <DocLink to="/docs/api">HTTP API</DocLink> — it needs an API key,
          which lives with you rather than with the event: avatar menu →{" "}
          <strong>Account settings</strong> → <strong>API &amp; MCP</strong>.
        </Callout>
      </div>
    </DocArticle>
  )
}
