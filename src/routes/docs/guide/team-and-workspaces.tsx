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
        <Step title="The row above every settings page — Account · Workspace · Event — is the hierarchy. Click a level to jump to it.">
          <p className="doc-prose">
            The address bar says the same thing:{" "}
            <code>/app/{"{workspace}"}/{"{event}"}/…</code> for anything about
            one event, <code>/app/{"{workspace}"}/workspace</code> for the team,{" "}
            <code>/app/account</code> for you. Every one of those is a link you
            can paste to a colleague.
          </p>
        </Step>

        <Step title="Workspace settings is the team hub — the workspaces you belong to, this workspace's name and address, every event it owns, and who runs them.">
          <Shot
            src="workspace-settings.png"
            alt="The Workspace settings page: your workspaces with a Switch button, the workspace name and web address, and its events"
            caption="“Your workspaces” at the top switches the whole app — sidebar included — to another workspace, or makes a new one."
          />
        </Step>

        <Step title="Press “Invite teammate”, enter an email, pick Admin or Member, and choose which events they can reach.">
          <Shot
            src="workspace-invite.png"
            alt="The Invite a teammate dialog with an email field, a role select, and an Event access choice of all events or only selected ones"
            caption="They show as Invited until they sign in with that address, then Active."
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
            team.
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
            alt="The Account settings page with its Profile, Security and API & MCP tabs"
            caption="Three tabs: Profile, Security (password) and API & MCP — your personal keys and the MCP connection. They follow you into every workspace."
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Which level am I on? <strong>Account</strong> = just me (profile,
          password, API keys). <strong>Workspace</strong> = my team and all its
          events. <strong>Settings</strong> = this one event (dates, venue,
          rooms &amp; tracks, statuses, integrations).
        </Callout>
      </div>
    </DocArticle>
  )
}
