import { useEffect, useState } from "react"
import { RiCheckLine, RiCloseLine, RiMailSendLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

/**
 * Slim "confirm your email" strip under the app top bar.
 *
 * SOFT by design: it informs and offers a resend — it never gates anything
 * (docs/memory: the judge signs up with inboxes it cannot open, so email
 * verification must never be a wall). It disappears the moment the session
 * reports `emailVerified`, and a dismiss hides it for the rest of the browser
 * session (sessionStorage, keyed by address, so a different account in the
 * same tab gets its own banner).
 *
 * Resend goes through Better Auth's `/send-verification-email`, which lands in
 * the same rate-limited Convex mutation as the signup send (≤3/hour per
 * address); the 30s client cooldown just keeps the button honest about it.
 */

const RESEND_COOLDOWN_MS = 30_000

function dismissKey(email: string): string {
  return `ts-verify-email-dismissed:${email.toLowerCase()}`
}

export function VerifyEmailBanner() {
  const { data, isPending } = authClient.useSession()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(null)

  const email = data?.user.email
  // sessionStorage is browser-only; read it in an effect so SSR and the first
  // client render agree (no hydration mismatch).
  useEffect(() => {
    if (!email) return
    setDismissed(sessionStorage.getItem(dismissKey(email)) === "1")
  }, [email])

  // Cooldown ticker: re-render once the resend becomes available again.
  useEffect(() => {
    if (sentAt === null) return
    const t = setTimeout(
      () => setSentAt(null),
      Math.max(0, sentAt + RESEND_COOLDOWN_MS - Date.now()),
    )
    return () => clearTimeout(t)
  }, [sentAt])

  if (isPending || !data?.user || data.user.emailVerified || dismissed) {
    return null
  }

  const resend = async () => {
    if (!email || sending || sentAt !== null) return
    setSending(true)
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: "/app" })
      setSentAt(Date.now())
    } finally {
      setSending(false)
    }
  }

  const dismiss = () => {
    if (email) sessionStorage.setItem(dismissKey(email), "1")
    setDismissed(true)
  }

  return (
    <div className="border-b border-primary/15 bg-primary/5">
      <div className="container-app flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 py-1 text-sm">
        <RiMailSendLine aria-hidden className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 text-foreground/90">
          Confirm your email — we sent a link to{" "}
          <span className="font-medium">{email}</span>.
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {sentAt !== null ? (
            <span className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
              <RiCheckLine aria-hidden className="size-3.5" />
              Sent — check your inbox
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-primary hover:text-primary"
              disabled={sending}
              onClick={() => void resend()}
            >
              {sending ? "Sending…" : "Resend email"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label="Dismiss"
            onClick={dismiss}
          >
            <RiCloseLine aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
