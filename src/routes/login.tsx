import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  RiArrowLeftLine,
  RiLoginBoxLine,
  RiMailSendLine,
  RiUserAddLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Logo } from "@/components/brand/logo"
import { authClient } from "@/lib/auth-client"
import { useSession } from "@/lib/session"

/** Seeded demo organizer — shown on the sign-in card so judges never guess. */
const DEMO_EMAIL = "organizer@demo.sessionboard.dev"
const DEMO_PASSWORD = "demo2026"

export interface LoginSearch {
  /** Where to land after a successful sign-in. */
  redirect?: string
  /** `?mode=forgot` opens the card straight in "reset my password" state. */
  mode?: "forgot"
}

/**
 * The MCP OAuth flow (Claude / ChatGPT "add connector by URL") sends people
 * here when they hit /api/auth/mcp/authorize without a session, passing the
 * OAuth request along as query params. Signing in IS the consent step, so
 * once they're in we hand them straight back to the authorize endpoint with
 * the original request intact and the flow continues to the redirect_uri.
 */
function oauthReturnTo(search: Record<string, unknown>): string | undefined {
  if (typeof search.client_id !== "string" || !search.client_id) return undefined
  if (search.response_type !== "code") return undefined
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") params.set(key, value)
  }
  return `/api/auth/mcp/authorize?${params.toString()}`
}

type Mode = "signin" | "signup" | "forgot"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : oauthReturnTo(search),
    mode: search.mode === "forgot" ? "forgot" : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo, mode: modeFromUrl } = Route.useSearch()
  const { isAuthenticated } = useSession()

  const [mode, setMode] = useState<Mode>(modeFromUrl === "forgot" ? "forgot" : "signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  /** Set once the reset request came back — the card becomes a receipt. */
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

  const goToApp = () => {
    if (!redirectTo) {
      navigate({ to: "/app" })
      return
    }
    // /api/* targets (the MCP OAuth authorize endpoint) are server routes —
    // they need a real navigation, not a client-side route transition.
    if (redirectTo.startsWith("/api/")) window.location.href = redirectTo
    else navigate({ href: redirectTo })
  }

  // Already signed in? Don't make them do it twice.
  useEffect(() => {
    if (!isAuthenticated) return
    if (!redirectTo) {
      navigate({ to: "/app" })
      return
    }
    if (redirectTo.startsWith("/api/")) window.location.href = redirectTo
    else navigate({ href: redirectTo })
  }, [isAuthenticated, redirectTo, navigate])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === "forgot") {
        const address = email.trim()
        // Better Auth answers "if this email exists, check your inbox" whether
        // or not the account is real, and the email itself is sent in the
        // background on the Convex side — so the only honest UI is the same
        // receipt in both cases. Never branch on whether the address exists.
        const { error: resetError } = await authClient.requestPasswordReset({
          email: address,
          redirectTo: "/reset-password",
        })
        if (resetError)
          throw new Error(resetError.message ?? "Could not send the reset link")
        setResetSentTo(address)
        return
      }
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0],
          email: email.trim(),
          password,
        })
        if (signUpError)
          throw new Error(signUpError.message ?? "Sign-up failed")
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        })
        if (signInError)
          throw new Error(signInError.message ?? "Sign-in failed")
      }
      goToApp()
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      setError(
        /invalid|incorrect|credential/i.test(message)
          ? "That email and password don't match. Try the demo credentials below."
          : /exist/i.test(message)
            ? "An account with that email already exists — sign in instead."
            : message || "Something went wrong. Please try again."
      )
    } finally {
      setPending(false)
    }
  }

  const fillDemo = () => {
    setError(null)
    setMode("signin")
    setResetSentTo(null)
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setResetSentTo(null)
  }

  const heading =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password"
  const subheading =
    mode === "forgot"
      ? "We'll email you a link to choose a new password."
      : "Organizer access to your events, submissions, and speakers."

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
              {resetSentTo ? "Check your email" : heading}
            </h1>
            <p className="text-sm text-muted-foreground">
              {resetSentTo
                ? `If an account exists for ${resetSentTo}, a reset link is on its way.`
                : subheading}
            </p>
          </div>

          {mode === "forgot" ? null : (
            <Tabs
              value={mode}
              onValueChange={(value) => switchMode(value as Mode)}
              className="mb-5"
            >
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Create account
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {resetSentTo ? (
            <div className="space-y-5">
              <Alert>
                <AlertTitle>Reset link sent</AlertTitle>
                <AlertDescription>
                  Open it within the hour and you'll be able to set a new
                  password. Nothing in your inbox? Check spam, or try another
                  address.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => switchMode("signin")}
              >
                <RiArrowLeftLine aria-hidden />
                Back to sign in
              </Button>
            </div>
          ) : (
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-5">
              {mode === "signup" ? (
                <Field>
                  <FieldLabel htmlFor="name">Your name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Dana Organizer"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>
              ) : null}

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

              {mode === "forgot" ? null : (
                <Field>
                  <div className="flex items-baseline justify-between gap-3">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    {mode === "signin" ? (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  {mode === "signup" ? (
                    <FieldDescription>At least 8 characters.</FieldDescription>
                  ) : null}
                </Field>
              )}

              {error ? (
                <Alert variant="destructive" className="bg-destructive/5">
                  <AlertTitle>
                    {mode === "signin"
                      ? "We couldn't sign you in"
                      : mode === "signup"
                        ? "We couldn't create your account"
                        : "We couldn't send the reset link"}
                  </AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={pending}
              >
                {mode === "signin" ? (
                  <RiLoginBoxLine aria-hidden />
                ) : mode === "signup" ? (
                  <RiUserAddLine aria-hidden />
                ) : (
                  <RiMailSendLine aria-hidden />
                )}
                {pending
                  ? mode === "signin"
                    ? "Signing in…"
                    : mode === "signup"
                      ? "Creating account…"
                      : "Sending link…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Email me a reset link"}
              </Button>

              {mode === "forgot" ? (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="w-full"
                  onClick={() => switchMode("signin")}
                >
                  <RiArrowLeftLine aria-hidden />
                  Back to sign in
                </Button>
              ) : null}
            </FieldGroup>
          </form>
          )}
        </Card>

        {mode === "forgot" ? null : (
        <Card className="mt-4 gap-0 bg-accent px-4 py-4 ring-primary/15">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Demo credentials
              </p>
              <FieldDescription className="mt-1 font-mono text-xs break-all">
                {DEMO_EMAIL}
                <br />
                {DEMO_PASSWORD}
              </FieldDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillDemo}
              className="shrink-0"
            >
              Use these
            </Button>
          </div>
        </Card>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
