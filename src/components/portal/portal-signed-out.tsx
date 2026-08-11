import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { RiArrowRightLine, RiMailOpenLine, RiSparkling2Line } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Logo } from "@/components/brand/logo"
import {
  DEMO_PORTAL_TOKEN,
  parsePortalToken,
  writePortalToken,
} from "./portal-token"

/**
 * Shown when we have no portal token: the speaker landed on `/portal` without
 * following their magic link. No jargon, no dead end — explain where the link
 * comes from, let them paste it, and offer the demo speaker for anyone
 * evaluating the product.
 */
export function PortalSignedOut({
  reason = "missing",
  onToken,
}: {
  /** `invalid` = the stored link no longer works. */
  reason?: "missing" | "invalid"
  onToken: (token: string) => void
}) {
  const navigate = useNavigate()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = parsePortalToken(value)
    if (!token) {
      setError("That doesn't look like a portal link. Paste the whole link from your email.")
      return
    }
    setError(null)
    writePortalToken(token)
    onToken(token)
  }

  function openDemo() {
    writePortalToken(DEMO_PORTAL_TOKEN)
    onToken(DEMO_PORTAL_TOKEN)
    void navigate({ to: "/portal" })
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background py-12">
      <div className="container-card">
        <div className="flex flex-col items-center text-center">
          <Logo size="sm" />
          <div className="mt-6 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <RiMailOpenLine size={22} aria-hidden />
          </div>
          <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">
            {reason === "invalid"
              ? "That portal link has expired"
              : "Check your email for your portal link"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {reason === "invalid"
              ? "The link we had saved on this device no longer works. Open the most recent email from the event organizers, or paste your link below."
              : "Your speaker portal opens from the personal link the event organizers emailed you — there is no password to remember. Paste that link below to open it here."}
          </p>
        </div>

        <Card className="mt-6">
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="portal-link">
                  Your portal link or code
                </FieldLabel>
                <FieldDescription>
                  For example: https://sessionboard.dev/portal/t/your-code
                </FieldDescription>
                <Input
                  id="portal-link"
                  name="portalLink"
                  autoComplete="off"
                  placeholder="Paste your link here…"
                  value={value}
                  aria-invalid={error ? true : undefined}
                  onChange={(event) => setValue(event.target.value)}
                />
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </Field>
              <Button type="submit" className="w-full">
                Open my portal
                <RiArrowRightLine aria-hidden />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-4 bg-accent/60" size="sm">
          <CardContent className="gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <RiSparkling2Line size={16} aria-hidden className="text-primary" />
              Just looking around?
            </p>
            <p className="text-sm text-muted-foreground">
              Open the demo speaker portal for Ava Nakamura — a real speaker in
              the sample event, with submissions, a profile and open tasks.
            </p>
            <div>
              <Button variant="outline" size="sm" onClick={openDemo}>
                Open the demo speaker portal
                <RiArrowRightLine aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
