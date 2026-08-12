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
            <p className="doc-prose">
              We email you a confirmation link. Until you open it, signing in
              lands you on a “Confirm your email” page with a Resend button — so
              nothing else is in the way, and nothing is lost.
            </p>
          </Step>

          <Step title="Setup takes over the whole screen: three short questions and nothing else. First, name your workspace — your organisation, the thing that owns your events and your team.">
            <Shot
              src="walkthrough/02-name-your-workspace.png"
              alt="The first onboarding screen: Welcome to Trackstage, with a Workspace name field filled in as Devcon Events"
              caption="Three dots at the top say how far there is to go. “Skip” moves past one question — it never dumps you out."
            />
          </Step>

          <Step title="Then the event itself. Only the name is required; the public web address writes itself underneath as you type.">
            <Shot
              src="walkthrough/03-your-event.png"
              alt="The second onboarding screen: event name Devcon Berlin 2026, its public address, an event type of Conference and a short description"
              caption="Type and description are optional — the description is the paragraph speakers read on your public page."
            />
            <p className="doc-prose">
              The address under the name has two parts:{" "}
              <code>/e/{"{workspace}"}/{"{event}"}</code>. The second half comes
              from the event name you just typed. The first is your
              workspace&rsquo;s address, which starts out made from your own
              name — change it once in Workspace settings and every link
              follows.
            </p>
          </Step>

          <Step title="Last, when and where. All optional: fill in what you know, leave the rest blank.">
            <Shot
              src="walkthrough/04-when-and-where.png"
              alt="The third onboarding screen: start and end dates, the Europe/Berlin timezone and a venue"
              caption="The timezone is guessed from your browser. Every date, deadline and calendar invite in the app follows it, so it is worth a glance."
            />
          </Step>

          <Step title="Press “Create event” and you are in — on your new event, with the app around you.">
            <Shot
              src="walkthrough/05-welcome.png"
              alt="The Trackstage app with a welcome card and confetti over the new event's settings page"
              caption="The sidebar is the whole app: Dashboard and Copilot at the top, then Program, Speakers and Share, with Event settings pinned at the bottom."
            />
            <p className="doc-prose">
              The <strong>Getting started</strong> list above it counts off the
              five things worth doing first, and ticks them itself as you do
              them. Close it whenever you like — it disappears for good once all
              five are done.
            </p>
          </Step>

          <Step title="Event settings is where everything about this one event lives, on seven tabs.">
            <Shot
              src="walkthrough/06-event-settings.png"
              alt="Event settings for Devcon Berlin 2026: the Event details form with dates, timezone and venue, and the Branding card beside it"
              caption="Event details · Rooms & tracks · Team · Fields & options · Statuses · Integrations · Activity. Everything here changes this event and no other."
            />
            <p className="doc-prose">
              Your dates and venue are already filled in from setup. Branding
              sits beside them: a logo and a header image, which appear on your
              public pages, in the speaker portal and in embedded widgets.
            </p>
          </Step>

          <Step title="Add your rooms and tracks while you are here — Settings → Rooms & tracks. The agenda has nowhere to put a session until a room exists.">
            <Shot
              src="walkthrough/07-rooms-and-tracks.png"
              alt="Rooms and tracks for Devcon Berlin 2026: the Aula and Workshop rooms, and two coloured tracks"
              caption="Tracks colour every card and become the columns in the track view."
            />
          </Step>

          <Step title="The dashboard is your home. On day one it is honest about being empty and tells you what to do next.">
            <Shot
              src="walkthrough/08-empty-dashboard.png"
              alt="The Devcon Berlin 2026 dashboard on day one, with zero counts and a getting-started checklist in the sidebar"
              caption="Two of five ticked already: the event details and the rooms and tracks you just added."
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
