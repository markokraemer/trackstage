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
        <Step title="On Agenda, press “Publish agenda” in the page header.">
          <Shot
            src="publish-agenda.png"
            alt="The Agenda page header with the Publish agenda button"
            caption="Until you do, the public page says “Schedule coming soon” — no times leak."
          />
        </Step>

        <Step title="Confirm. The dialog tells you exactly how many sessions go live and where.">
          <p className="doc-prose">
            It is one reversible flag. An <strong>Unpublish</strong> button
            appears next to a “Published · date” pill, and unpublishing deletes
            nothing.
          </p>
        </Step>

        <Step title="Your public event page is live at /e/your-slug with Schedule, Speakers, Sessions and My schedule.">
          <Shot
            src="public-schedule.png"
            alt="The public event page showing the published schedule"
            caption="Every later edit goes out live — no re-publishing."
          />
        </Step>

        <Step title="Need it on your own website? Open Embeds and build a widget in three picks.">
          <Shot
            src="embeds.png"
            alt="The Embeds page with widget, format and display options"
            caption="Widget (agenda, sessions, speakers…), format (iframe, link, static HTML, JSON, calendar feed), then what shows."
          />
        </Step>

        <Step title="Save the configuration a name so you can come back to it — “Agenda for the sponsors page”.">
          <p className="doc-prose">
            The calendar feed needs no key at all: attendees subscribe once and
            their calendar keeps itself right.
          </p>
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="note">
          The JSON feed is the same data as the{" "}
          <DocLink to="/docs/api">HTTP API</DocLink> — it needs an API key from
          Settings → API &amp; MCP.
        </Callout>
      </div>
    </DocArticle>
  )
}
