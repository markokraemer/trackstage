import { useRef, useState } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * The rendered email, exactly as the recipient sees it — one component, used by
 * the outbox drawer (what was sent) and the composer's review step (what is
 * about to be sent), so "review" and "record" never drift apart.
 *
 * When `html` is given (the outbox drawer asks the server for the branded
 * markup it hands the email provider) the real email is rendered in a
 * script-less iframe, header, logo, footer and all. Without it — the composer's
 * review step, where nothing has been rendered server-side yet — the plain-text
 * body is shown with its links live.
 */

export interface EmailPreviewCardProps {
  toEmail: string
  subject: string
  body: string
  /** The branded HTML actually sent, when it is available. */
  html?: string | null
  className?: string
}

export function EmailPreviewCard({
  toEmail,
  subject,
  body,
  html,
  className,
}: EmailPreviewCardProps) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">To: {toEmail}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{subject}</p>
      </div>
      {html ? (
        <HtmlEmailFrame html={html} title={subject} />
      ) : (
        <div className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          <BodyWithLinks body={body} />
        </div>
      )}
    </Card>
  )
}

/**
 * The branded email in an isolated document: no scripts, no app styles leaking
 * in, and the frame grows to whatever the email needs so there is never a
 * scrollbar inside a scrollbar.
 */
function HtmlEmailFrame({ html, title }: { html: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [height, setHeight] = useState(320)

  return (
    <iframe
      ref={frameRef}
      title={`${title} — email preview`}
      srcDoc={html}
      // No allow-scripts: organizer copy is rendered, never executed.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="w-full border-0 bg-white"
      style={{ height }}
      onLoad={() => {
        const doc = frameRef.current?.contentDocument
        if (!doc) return
        const next = doc.documentElement.scrollHeight
        if (next > 0) setHeight(next)
      }}
    />
  )
}

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/g

/**
 * Render the plain-text body, turning URLs (the portal magic link, above all)
 * into real anchors so the link can be followed straight from the preview.
 */
export function BodyWithLinks({ body }: { body: string }) {
  const parts = body.split(URL_PATTERN)
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}
