import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/team-and-workspaces")({
  component: Page,
  head: () => ({ meta: [{ title: "Team & workspaces · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="Team & workspaces"
      lead="Three levels, never mixed: you, your workspace, and each event inside it."
    >
      <Steps>
        <Step title="Each level has its own page, and the address bar says which one you are on.">
          <p className="doc-prose">
            <code>/app/{"{workspace}"}/{"{event}"}/…</code> for anything about
            one event, <code>/app/{"{workspace}"}/workspace</code> for the team,{" "}
            <code>/app/account</code> for you. Your own two live in the avatar
            menu, top right; the event&rsquo;s is{" "}
            <strong>Event settings</strong>, pinned at the bottom of the
            sidebar. Every one of those is a link you can paste to a colleague.
          </p>
        </Step>

        <Step title="Workspace settings has three tabs: General, Team and Events.">
          <Shot
            src="workspace-settings.png"
            alt="The Workspace settings page, General tab: your workspaces with a Switch button, and the workspace name and web address"
            caption="General holds “Your workspaces” — switch the whole app, sidebar included, to another one, or make a new one — plus this workspace's name and web address."
          />
          <p className="doc-prose">
            That <strong>web address</strong> is the first segment of every link
            you will ever send: app pages, public event pages, submission forms.
            It starts out made from your own name, so it is worth setting once,
            early. Changing it moves every link at once.
          </p>
        </Step>

        <Step title="Team is everyone who can work here, with their role and exactly which events they can reach.">
          <Shot
            src="workspace-team.png"
            alt="The Team tab of workspace settings: a member table with person, role and event access columns, and an Invite teammate button"
            caption="Invited people show as Invited until they sign in with that address, then Active."
          />
        </Step>

        <Step title="Press “Invite teammate”, enter an email, pick Admin or Member, and choose which events they can reach.">
          <Shot
            src="workspace-invite.png"
            alt="The Invite a teammate panel with an email field, a role select, and an Event access choice of all events or only selected ones"
            caption="Inviting happens in place, right where the table was — no dialog stacked on top of a dialog. “Back” returns to the list."
          />
          <p className="doc-prose">
            <strong>Event access</strong> is real isolation, not a filter: an
            event a member wasn&rsquo;t given is invisible to them — it never
            appears in their switcher, and its address answers the same
            &ldquo;Event not found&rdquo; a stranger gets. Owners and admins
            always see everything.
          </p>
        </Step>

        <Step title="Change a role from the select on their row; remove someone with the bin icon. Only the owner can change roles.">
          <p className="doc-prose">
            Admins can create events, run decisions and invite people. Members
            can work inside the events they were given, but not restructure the
            team. Each event also has its own <strong>Team</strong> tab in Event
            settings — the same table, narrowed to who can open that one event.
          </p>
        </Step>

        <Step title="Switch event from the block at the top of the sidebar. It also holds “All events” and “New event”.">
          <p className="doc-prose">
            Multiple events are the normal case — every page in the app follows
            whichever one is selected here, and the URL changes with it, so two
            browser tabs can sit on two different events at once.
          </p>
        </Step>

        <Step title="Your own profile, password and API keys live on Account settings, reachable from the avatar menu.">
          <Shot
            src="account-settings.png"
            alt="The Account settings page with its Profile, Security and API & MCP tabs, showing the profile form and an Appearance card"
            caption="Three tabs: Profile, Security (password) and API & MCP — your personal keys and the MCP connection. They follow you into every workspace."
          />
          <p className="doc-prose">
            <strong>Appearance</strong> sits under Profile: Light, Dark or
            System. It changes your organizer screens only — the public pages
            your speakers and attendees see always stay light.
          </p>
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Which level am I on? <strong>Account</strong> = just me (profile,
          password, appearance, API keys). <strong>Workspace</strong> = my team
          and all its events. <strong>Event settings</strong> = this one event
          (details, rooms &amp; tracks, team, fields, statuses, integrations,
          activity).
        </Callout>
      </div>
    </DocArticle>
  )
}
