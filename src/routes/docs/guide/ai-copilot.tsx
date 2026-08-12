import { createFileRoute } from "@tanstack/react-router"

import {
  Callout,
  DocArticle,
  DocLink,
  Shot,
  Step,
  Steps,
} from "@/components/docs/doc-primitives"

export const Route = createFileRoute("/docs/guide/ai-copilot")({
  component: Page,
  head: () => ({ meta: [{ title: "AI copilot · Trackstage docs" }] }),
})

function Page() {
  return (
    <DocArticle
      title="AI copilot"
      lead="Ask for what you want in plain English. It uses the same tools as the app, and asks before anything irreversible."
    >
      <Steps>
        <Step title="Copilot is the second entry in the sidebar. The button in the top bar (or ⌘I / Ctrl+I) opens the same conversation in a side panel.">
          <Shot
            src="copilot.png"
            alt="The Copilot page naming the event it is working on, with five suggested prompts and a message box"
            caption="It names the event it is working on under the title — the same one your sidebar is pointed at. Full page or side panel, it is one conversation and one history."
          />
        </Step>

        <Step title="Ask something. The starters under the title are the ones people ask most: “What needs my attention?”, “Show today’s agenda”, “Who’s behind on tasks?”">
          <p className="doc-prose">
            It can read and change everything in the event you have selected —
            submissions, the agenda, speakers and their emails. Answers come back
            as plain cards you can read: a list of speakers, a day of the agenda,
            a count — never a wall of raw data.
          </p>
        </Step>

        <Step title="Anything that emails people or decides someone’s fate stops and shows a confirmation card first.">
          <p className="doc-prose">
            The card names the action, lists exactly what it would do, and gives
            you <strong>Cancel</strong> or <strong>Approve &amp; run</strong>.
            Cancel and nothing was changed.
          </p>
        </Step>

        <Step title="Old chats are kept. “New chat” starts a fresh one; the rail lists the rest by day.">
          <p className="doc-prose">
            Rename or delete any of them from the rail. The history follows you
            between the panel and the full page, so a conversation you started
            beside the submissions table is still there at{" "}
            <code>/app/copilot</code>.
          </p>
        </Step>

        <Step title="Open the panel beside any screen so you can watch the table update as it works.">
          <p className="doc-prose">
            Drag the panel&rsquo;s left edge to make it wider. “Connect MCP” in
            the header gives the same tools to Claude, ChatGPT or Codex on your
            own machine.
          </p>
        </Step>
      </Steps>

      <div className="mt-10">
        <Callout tone="note">
          The copilot runs on the very same{" "}
          <DocLink to="/docs/mcp">MCP server</DocLink> you can connect Claude or
          ChatGPT to — with your own permissions, never a private back door.
        </Callout>
      </div>
    </DocArticle>
  )
}
