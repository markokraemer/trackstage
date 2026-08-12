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
            src="walkthrough/33-publish.png"
            alt="The Publish the agenda dialog naming the public address and the session count"
            caption="Until you do, the public page says “Schedule coming soon” — no times leak."
          />
        </Step>

        <Step title="That is it. Your public event page is live, with Schedule, Speakers, Sessions and My schedule.">
          <Shot
            src="walkthrough/34-public-page.png"
            alt="The live public page for Devcon Berlin 2026 showing the published schedule, track filters and add-to-calendar buttons"
            caption="The same talk the speaker submitted, now on a public programme. Every later edit goes out live — no re-publishing."
          />
        </Step>

        <Step title="Attendees can take it with them. Every level has an add-to-calendar button next to it.">
          <p className="doc-prose">
            <strong>Add to calendar</strong> at the top of the page takes the
            whole event; <strong>Add the whole program</strong> and{" "}
            <strong>Add this day</strong> do what they say; and each session card
            has its own. Google, Outlook, Apple or a plain <code>.ics</code>{" "}
            download — and <strong>My schedule</strong> lets someone bookmark
            just the sessions they picked and subscribe to those.
          </p>
        </Step>

        <Step title="Publishing is one reversible flag.">
          <p className="doc-prose">
            An <strong>Unpublish</strong> button appears next to a “Published ·
            date” pill, and unpublishing deletes nothing.
          </p>
        </Step>

        <Step title="Need it on your own website? Open Embeds — options on the left, a live preview of the real thing on the right.">
          <Shot
            src="embeds.png"
            alt="The Embeds page: saved embeds, widget, format and display options on the left, and a live preview of the agenda grid on the right"
            caption="Pick a widget (agenda grid, sessions, speakers…), a format (embedded widget, link, static HTML, JSON, XML, calendar feed), then what shows — down to which tracks. The preview updates as you pick, and the Code tab is the snippet to paste."
          />
        </Step>

        <Step title="Give the configuration a name so you can come back to it — “Agenda for the homepage”.">
          <p className="doc-prose">
            Saved embeds sit at the top of the left column, each with an{" "}
            <strong>off switch</strong>: turn one off and every page you pasted
            it into says “This embed is turned off” instead of showing the
            programme — no need to edit your website.
          </p>
          <p className="doc-prose">
            The calendar and XML feeds need no key at all: attendees subscribe
            once and their calendar keeps itself right, and a CMS that imports
            an XML feed re-reads yours whenever the programme changes.
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
