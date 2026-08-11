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
        <Step title="Workspace settings is the team hub — rename the workspace, see every event it owns, manage who is in it.">
          <Shot
            src="workspace-settings.png"
            alt="The Workspace settings page with the workspace name, events and members"
          />
        </Step>

        <Step title="Press “Invite teammate”, enter an email and pick Admin or Member.">
          <Shot
            src="workspace-invite.png"
            alt="The Invite a teammate dialog with an email field and a role select"
            caption="They show as Invited until they sign in with that address, then Active."
          />
        </Step>

        <Step title="Change a role from the select on their row; remove someone with the bin icon. Only the owner can change roles.">
          <p className="doc-prose">
            Admins can create events, run decisions and invite people. Members
            can work inside events but not restructure the team.
          </p>
        </Step>

        <Step title="Switch event from the block at the top of the sidebar. It also holds “All events” and “New event”.">
          <p className="doc-prose">
            Multiple events are the normal case — every page in the app follows
            whichever one is selected here.
          </p>
        </Step>

        <Step title="Your own profile, password and API keys live on Account settings, reachable from the avatar menu.">
          <Shot
            src="account-settings.png"
            alt="The Account settings page with profile and password cards"
          />
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="tip">
          Which level am I on? <strong>Account</strong> = just me.{" "}
          <strong>Workspace</strong> = my team and all its events.{" "}
          <strong>Settings</strong> = this one event (dates, venue, rooms &amp;
          tracks).
        </Callout>
      </div>
    </DocArticle>
  )
}
