import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { RiDiscordFill, RiGithubFill, RiLockLine } from "@remixicon/react"

import { Logo } from "@/components/brand/logo"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"

/**
 * `/get` — the source-code front door.
 *
 * The repo stays private until the Kill My SaaS contest concludes so the work
 * can't be lifted mid-competition. Flipping it public is a manual step — the
 * page promises nothing automatic. It does check GitHub live, so once the
 * repo IS public it redirects straight there without a deploy; until then it
 * counts down to the contest close and tells competition folks how to get
 * early access.
 */

const REPO_URL = "https://github.com/markokraemer/trackstage"
const REPO_API = "https://api.github.com/repos/markokraemer/trackstage"
/** Contest end: Wednesday Aug 12 2026, 10:00 PM PDT (05:00 UTC Aug 13). */
const CONTEST_ENDS_UTC = Date.UTC(2026, 7, 13, 5, 0, 0)

export const Route = createFileRoute("/get")({
  component: GetRoute,
  head: () => ({
    meta: [{ title: "Get the code — Trackstage" }],
  }),
})

function GetRoute() {
  const [state, setState] = useState<"checking" | "private" | "public">(
    "checking",
  )

  useEffect(() => {
    let cancelled = false
    // Unauthenticated GitHub API: 200 = public, 404 = private/nonexistent.
    fetch(REPO_API)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setState("public")
          window.location.replace(REPO_URL)
        } else {
          setState("private")
        }
      })
      .catch(() => {
        if (!cancelled) setState("private")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4">
      <header className="flex w-full max-w-2xl items-center py-6">
        <Logo size="md" />
      </header>

      <main className="flex w-full max-w-xl flex-1 flex-col items-center justify-center pb-24">
        {state === "public" ? (
          <p className="text-sm text-muted-foreground">
            Taking you to GitHub…{" "}
            <a href={REPO_URL} className="text-primary underline-offset-4 hover:underline">
              {REPO_URL}
            </a>
          </p>
        ) : (
          <Card className="w-full items-center gap-0 px-8 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
              <RiLockLine size={22} aria-hidden />
            </span>
            <h1 className="mt-5 font-heading text-xl font-semibold text-foreground">
              The GitHub repo opens when the contest concludes
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Trackstage is open source (MIT), but the repository stays private
              until the Kill My SaaS competition wraps up.
            </p>
            <Countdown />
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Judging the competition and want access now? Ping{" "}
              <strong className="text-foreground">marko kraemer</strong> on
              Discord and you'll be added to the repo right away.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href={REPO_URL}
                className={buttonVariants({ variant: "outline" })}
                rel="noreferrer"
              >
                <RiGithubFill aria-hidden />
                Try anyway
              </a>
              <a
                href="https://discord.com"
                className={buttonVariants({ variant: "outline" })}
                target="_blank"
                rel="noreferrer"
              >
                <RiDiscordFill aria-hidden />
                Discord: marko kraemer
              </a>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

function Countdown() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [])

  const remaining = CONTEST_ENDS_UTC - now
  if (remaining <= 0) {
    return (
      <p className="mt-5 text-sm text-muted-foreground">
        The contest has concluded.
      </p>
    )
  }

  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1_000)
  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <p className="mt-5 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
      {hours}:{pad(minutes)}:{pad(seconds)}
    </p>
  )
}
