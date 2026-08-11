import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { RiLoginBoxLine, RiUserAddLine } from "@remixicon/react"

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
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const { isAuthenticated } = useSession()

  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const goToApp = () => {
    if (redirectTo) navigate({ href: redirectTo })
    else navigate({ to: "/app" })
  }

  // Already signed in? Don't make them do it twice.
  useEffect(() => {
    if (!isAuthenticated) return
    if (redirectTo) navigate({ href: redirectTo })
    else navigate({ to: "/app" })
  }, [isAuthenticated, redirectTo, navigate])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0]!,
          email: email.trim(),
          password,
        })
        if (signUpError) throw new Error(signUpError.message ?? "Sign-up failed")
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        })
        if (signInError) throw new Error(signInError.message ?? "Sign-in failed")
      }
      goToApp()
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      setError(
        /invalid|incorrect|credential/i.test(message)
          ? "That email and password don't match. Try the demo credentials below."
          : /exist/i.test(message)
            ? "An account with that email already exists — sign in instead."
            : message || "Something went wrong. Please try again.",
      )
    } finally {
      setPending(false)
    }
  }

  const fillDemo = () => {
    setError(null)
    setMode("signin")
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Link
          to="/"
          className="mb-6 flex justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="md" />
        </Link>

        <Card className="gap-0 p-6">
          <div className="mb-5 space-y-1 text-center">
            <h1 className="font-heading text-lg font-semibold tracking-tight">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Organizer access to your events, submissions, and speakers.
            </p>
          </div>

          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as "signin" | "signup")
              setError(null)
            }}
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

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
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

              {error ? (
                <Alert variant="destructive" className="bg-destructive/5">
                  <AlertTitle>
                    {mode === "signin"
                      ? "We couldn't sign you in"
                      : "We couldn't create your account"}
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
                ) : (
                  <RiUserAddLine aria-hidden />
                )}
                {pending
                  ? mode === "signin"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Button>
            </FieldGroup>
          </form>
        </Card>

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

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
