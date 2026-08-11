import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  RiCheckLine,
  RiLockPasswordLine,
  RiMailSendLine,
} from "@remixicon/react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Logo } from "@/components/brand/logo"
import { authClient } from "@/lib/auth-client"

/** Better Auth's own minimum (`emailAndPassword.minPasswordLength`). */
const MIN_PASSWORD_LENGTH = 8

export interface ResetPasswordSearch {
  /** Handed over by Better Auth's callback once it has vetted the link. */
  token?: string
  /** `INVALID_TOKEN` when the link was already used or has expired. */
  error?: string
}

/**
 * Where a password-reset email lands.
 *
 * The emailed link points at Better Auth's own callback
 * (`/api/auth/reset-password/{token}?callbackURL=/reset-password`), which
 * checks the token exists and hasn't expired and then redirects HERE with
 * `?token=…`, or with `?error=INVALID_TOKEN` when it hasn't. So an expired
 * link is a friendly page, not a broken form — and the token is still consumed
 * server-side by `resetPassword`, which is the only thing that actually
 * decides whether the change is allowed.
 */
export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token, error: linkError } = Route.useSearch()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  /** The link never carried a usable token — nothing to submit. */
  const linkUnusable = !token || Boolean(linkError)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.")
      return
    }

    setPending(true)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (resetError)
        throw new Error(resetError.message ?? "Could not reset your password")
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      setError(
        /token|expired|invalid/i.test(message)
          ? "This reset link is no longer valid — links expire an hour after they're sent, and each one works once. Request a fresh one and we'll email it straight away."
          : /short|length|password/i.test(message)
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
            : message || "Something went wrong. Please try again."
      )
    } finally {
      setPending(false)
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

        <Card className="gap-0 p-6">
          <div className="mb-5 space-y-1 text-center">
            <h1 className="font-heading text-lg font-semibold tracking-tight">
              {done
                ? "Password updated"
                : linkUnusable
                  ? "This link has expired"
                  : "Choose a new password"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {done
                ? "You can sign in with your new password now."
                : linkUnusable
                  ? "Reset links last an hour and can only be used once."
                  : "Pick something you don't use anywhere else."}
            </p>
          </div>

          {done ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate({ to: "/login" })}
            >
              <RiCheckLine aria-hidden />
              Continue to sign in
            </Button>
          ) : linkUnusable ? (
            <div className="space-y-5">
              <Alert>
                <AlertTitle>Request a new link</AlertTitle>
                <AlertDescription>
                  Nothing is wrong with your account — this particular link just
                  can't be used any more. We'll send you another one.
                </AlertDescription>
              </Alert>
              <Link
                to="/login"
                search={{ mode: "forgot" }}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                <RiMailSendLine aria-hidden />
                Email me a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <Input
                    id="new-password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <FieldDescription>
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </Field>

                {error ? (
                  <Alert variant="destructive" className="bg-destructive/5">
                    <AlertTitle>We couldn't reset your password</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                >
                  <RiLockPasswordLine aria-hidden />
                  {pending ? "Saving…" : "Set new password"}
                </Button>
              </FieldGroup>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="hover:text-foreground hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
