import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/getting-started")({
  component: Page,
  head: () => ({ meta: [{ title: "Getting started · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Getting started"
      lead="From a blank account to an event you can open a call for speakers on — about two minutes."
    >
      <Callout tone="note">
        Every screenshot in this guide comes from one real run: a brand-new
        account setting up <strong>Devcon Berlin 2026</strong>, from signing up
        to a published programme. You are watching the same event grow page by
        page.
      </Callout>

      <div className="mt-8">
        <Steps>
          <Step title="Create your account with a name, an email address and a password.">
            <Shot
              src="walkthrough/01-sign-up.png"
              alt="The Trackstage sign-up card filled in with a name, email and password"
              caption="No credit card, no trial clock — it is open source."
            />
          </Step>

          <Step title="You land in a workspace straight away, and it is empty. A workspace is your organisation: it owns your events and your team.">
            <Shot
              src="walkthrough/02-empty-workspace.png"
              alt="A brand-new workspace with no events yet and a Create your first event button"
              caption="Nothing to configure here. Renaming it and inviting colleagues can wait."
            />
          </Step>

          <Step title="Press “Create your first event”. Type the name — the public web address and your timezone fill themselves in.">
            <Shot
              src="walkthrough/03-create-event.png"
              alt="The Create an event dialog with the name Devcon Berlin 2026, a matching web address and the Europe/Berlin timezone"
              caption="Three fields. The grey line under the address is the page your speakers will get."
            />
          </Step>

          <Step title="You land on the event’s settings. Add the dates and the venue — this is what your public page and every calendar invite will say.">
            <Shot
              src="walkthrough/04-event-details.png"
              alt="Event settings for Devcon Berlin 2026 with dates, timezone and venue filled in"
              caption="The row above the title — Account · Workspace · Event — is the whole hierarchy. These tabs change this one event."
            />
          </Step>

          <Step title="Add your rooms and tracks while you are here — Settings → Rooms & tracks. The agenda has nowhere to put a session until a room exists.">
            <Shot
              src="walkthrough/06-rooms-and-tracks.png"
              alt="Rooms and tracks for Devcon Berlin 2026: the Aula and Workshop rooms, and two coloured tracks"
              caption="Tracks colour every card and become the columns in the track view."
            />
          </Step>

          <Step title="The dashboard is now your home. On day one it is honest about being empty and tells you what to do next.">
            <Shot
              src="walkthrough/05-empty-dashboard.png"
              alt="The Devcon Berlin 2026 dashboard on day one, with empty counts and a next step"
            />
          </Step>

          <Step title="Once submissions start arriving it fills in: counts by status, what is still unscheduled, and who owes you something.">
            <Shot
              src="gs-dashboard.png"
              alt="A busy organizer dashboard: counts by status, speakers missing a bio or headshot, and submissions awaiting a decision"
              caption="A different, busier event — so you can see what the numbers look like once a call has been open for a while."
            />
          </Step>
        </Steps>
      </div>

      <div className="mt-10">
        <Callout tone="tip">
          Every page in the app belongs to one event, and the address bar says
          which: <code>/app/{"{workspace}"}/{"{event}"}/…</code>. Switch events
          from the block at the top of the sidebar — or just send someone the
          link. If a page looks empty, check the name in that block first; see{" "}
          <DocLink to="/docs/guide/team-and-workspaces">Team &amp; workspaces</DocLink>.
        </Callout>
      </div>
    </DocArticle>
  )
}
