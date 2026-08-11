import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * The rendered email, exactly as the recipient sees it — one component, used by
 * the outbox drawer (what was sent) and the composer's review step (what is
 * about to be sent), so "review" and "record" never drift apart.
 */

export interface EmailPreviewCardProps {
  toEmail: string
  subject: string
  body: string
  className?: string
}

export function EmailPreviewCard({
  toEmail,
  subject,
  body,
  className,
}: EmailPreviewCardProps) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">To: {toEmail}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{subject}</p>
      </div>
      <div className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        <BodyWithLinks body={body} />
      </div>
    </Card>
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
