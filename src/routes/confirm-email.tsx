import { useEffect, useRef, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { RiMailSendLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Logo } from "@/components/brand/logo"
import { authClient } from "@/lib/auth-client"
import { invalidateAuthMemo } from "@/lib/auth-memo"
import { WELCOME_CALLBACK_URL } from "@/lib/onboarding-storage"

/**
 * `/confirm-email` — email verification as a pure AUTH concern (Marko,
 * definitive boundary: "have it completely separate … don't make it a step
 * in the regular onboarding … only after I've clicked the link does it
 * redirect me to the app").
 *
 * Reached two ways, one surface:
 *   - signup with a non-exempt address lands HERE, not in the app
 *     (src/routes/login.tsx) — no wizard dots, no app chrome;
 *   - an unverified account hitting any /app URL is redirected here
 *     (useOnboardingGate) instead of an in-app takeover.
 *
 * A 3s poll + focus refetch watches for the emailed link being clicked in
 * any tab; the moment the session reports `emailVerified`, this page moves
 * to `/app` — where the onboarding wizard starts fresh at step 1. Exempt
 * addresses (`@example.*`, demo) are born verified and never see this page.
 * Works in both verification modes: soft (our default — the signup session
 * exists, so the poll runs) and REQUIRE_EMAIL_VERIFICATION (no session
 * until the link is clicked — the card stands as a receipt, `?email=`
 * carries the address, and the link itself signs the user in).
 */

const RESEND_COOLDOWN_MS = 30_000

interface ConfirmEmailSearch {
  /** Fallback address for display when there is no session (hard mode). */
  email?: string
}

export const Route = createFileRoute("/confirm-email")({
  validateSearch: (search: Record<string, unknown>): ConfirmEmailSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: ConfirmEmailPage,
})

function ConfirmEmailPage() {
  const navigate = useNavigate()
  const { email: emailFromSearch } = Route.useSearch()
  const { data, isPending } = authClient.useSession()

  const email = data?.user.email ?? emailFromSearch ?? ""
  const verified = Boolean(data?.user.emailVerified)

  // `?email=` means signup sent us here; its absence means the gate did —
  // i.e. an EXISTING account that merely hasn't confirmed yet. Only the
  // first deserves `?welcome=1`, which makes /app paint the onboarding
  // takeover before its queries can answer: an established user clicking
  // their confirmation link would otherwise get a flash of a first-run
  // wizard they have no business seeing.
  const callbackURL = emailFromSearch ? WELCOME_CALLBACK_URL : "/app"

  // Nothing to confirm: no session AND no address to show → back to sign-in.
  useEffect(() => {
    if (!isPending && !data?.user && !emailFromSearch) {
      void navigate({ to: "/login", replace: true })
    }
  }, [isPending, data, emailFromSearch, navigate])

  // The moment the address is confirmed (this tab's poll, another tab's
  // link click, or arriving here already verified): into the app — where
  // onboarding takes over.
  //
  // `invalidateAuthMemo()` first, every time: this is a CLIENT-SIDE
  // transition, so `/app`'s guard re-reads the root route's memoized auth
  // answer — which this page's own loads wrote *before* the address was
  // confirmed. Same shape as the login page's sign-in transition.
  useEffect(() => {
    if (!verified) return
    invalidateAuthMemo()
    void navigate({ to: "/app", replace: true })
  }, [verified, navigate])

  // Watch for the confirmation while a session exists (soft mode). Better
  // Auth's cached session can keep saying unverified, so ask the server.
  useEffect(() => {
    if (isPending || !data?.user || verified) return
    let cancelled = false as boolean
    const check = async () => {
      try {
        const fresh = await authClient.getSession({
          query: { disableCookieCache: true },
        })
        if (!cancelled && fresh.data?.user.emailVerified) {
          invalidateAuthMemo()
          void navigate({ to: "/app", replace: true })
        }
      } catch {
        /* transient network — the next tick retries */
      }
    }
    const interval = setInterval(check, 3_000)
    window.addEventListener("focus", check)
    void check()
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("focus", check)
    }
  }, [isPending, data, verified, navigate])

  const [resending, setResending] = useState(false)
  const [resentAt, setResentAt] = useState<number | null>(null)
  const [sendFailed, setSendFailed] = useState(false)

  // Arriving WITHOUT `?email=` means the gate sent us: an existing account
  // signed in normally and is still unverified. Nothing mailed anything on
  // that path — the link went out at signup, possibly days ago — so the card
  // used to promise an email that never came, and the only way forward was to
  // guess at "Resend". Send it on arrival instead, once, so the promise below
  // is true whichever way this page was reached. (Signup passes `?email=` and
  // Better Auth has already sent; re-sending there would double-mail.)
  const autoSent = useRef(false)
  useEffect(() => {
    if (isPending || verified || autoSent.current) return
    if (emailFromSearch || !data?.user.email) return
    autoSent.current = true
    setResending(true)
    void authClient
      .sendVerificationEmail({
        email: data.user.email,
        callbackURL,
      })
      .then(() => setResentAt(Date.now()))
      .catch(() => setSendFailed(true))
      .finally(() => setResending(false))
  }, [isPending, verified, emailFromSearch, data])

  useEffect(() => {
    if (resentAt === null) return
    const t = setTimeout(
      () => setResentAt(null),
      Math.max(0, resentAt + RESEND_COOLDOWN_MS - Date.now()),
    )
    return () => clearTimeout(t)
  }, [resentAt])

  async function resend() {
    if (!email || resending || resentAt !== null) return
    setResending(true)
    setSendFailed(false)
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL,
      })
      setResentAt(Date.now())
    } catch {
      setSendFailed(true)
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background py-12">
      <div className="container-card">
        <Link
          to="/"
          className="mb-6 flex justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="md" />
        </Link>

        <Card className="items-center gap-5 px-8 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-primary">
            <RiMailSendLine size={22} aria-hidden />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">
              Confirm your email
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Click it and you'll land straight in Trackstage.
            </p>
          </div>
          {sendFailed ? (
            <p role="alert" className="text-xs text-destructive">
              We couldn&rsquo;t send it just now. Try again in a moment.
            </p>
          ) : data?.user ? (
            <p role="status" className="text-xs text-muted-foreground">
              Waiting for your confirmation — checking automatically…
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={resending || resentAt !== null}
            onClick={resend}
          >
            {resending
              ? "Sending…"
              : resentAt !== null
                ? "Sent — check your inbox"
                : sendFailed
                  ? "Try again"
                  : "Resend email"}
          </Button>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Wrong account?{" "}
          <Link
            to="/logout"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Log out
          </Link>
        </p>
      </div>
    </main>
  )
}
