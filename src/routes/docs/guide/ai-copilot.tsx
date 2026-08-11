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
        <Step title="Press the sparkle “Copilot” button in the top bar, or hit ⌘I / Ctrl+I.">
          <Shot
            src="copilot.png"
            alt="The Copilot chat naming the event it is working on, with suggested prompts"
            caption="It names the event it is working on under the title — the same one your sidebar is pointed at. Same conversation whether you use the side panel or the full page."
          />
        </Step>

        <Step title="Ask something. Good openers: “What needs my attention?”, “Show today’s agenda”, “Who’s behind on tasks?”">
          <p className="doc-prose">
            It can read and change everything in the event you have selected —
            submissions, the agenda, speakers and their emails.
          </p>
        </Step>

        <Step title="Anything that emails people or decides someone’s fate stops and shows a confirmation card first.">
          <p className="doc-prose">
            The card names the action, lists exactly what it would do, and gives
            you <strong>Cancel</strong> or <strong>Approve &amp; run</strong>.
            Cancel and nothing was changed.
          </p>
        </Step>

        <Step title="Open the panel beside any screen so you can watch the table update as it works.">
          <p className="doc-prose">
            Drag the panel’s left edge to make it wider; “Open full page” moves
            the same chat to <code>/app/copilot</code>.
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
