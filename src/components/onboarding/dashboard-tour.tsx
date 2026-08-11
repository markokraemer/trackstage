import { useCallback, useEffect, useRef, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  clearTourPhase,
  readTourPhase,
  subscribeTourPhase,
} from "@/lib/onboarding-storage"
import type { TourPhase } from "@/lib/onboarding-storage"

/**
 * The welcome moment after the onboarding wizard — confetti + one calm card,
 * and NOTHING else (Marko, final call: "keep the confetti and the welcome
 * but I don't think we need these individual steps"). The step-by-step
 * product tour that used to follow was removed end to end; the sidebar's
 * Getting-started checklist (src/components/shell/getting-started.tsx) is
 * the sole guidance from here.
 *
 * It can ONLY appear via the sessionStorage phase the onboarding takeover
 * writes on finish (src/lib/onboarding-storage.ts) — existing accounts,
 * demo/seeded data and e2e sign-ins never see it. "Let's go" (or
 * `?onboarding-redo` never being used again) persists userFlags.tourDoneAt
 * so it never re-shows.
 */

/** One celebratory burst, ~2.5s total, never looping. */
async function fireConfetti(): Promise<void> {
  const confetti = (await import("canvas-confetti")).default
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.35 } })
  setTimeout(
    () =>
      confetti({
        particleCount: 45,
        spread: 100,
        angle: 60,
        origin: { x: 0.1, y: 0.5 },
      }),
    350,
  )
  setTimeout(
    () =>
      confetti({
        particleCount: 45,
        spread: 100,
        angle: 120,
        origin: { x: 0.9, y: 0.5 },
      }),
    700,
  )
}

export function DashboardTour() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const markTourDone = useConvexMutation(api.onboarding.markTourDone)

  const [phase, setPhase] = useState<TourPhase | null>(() => readTourPhase())
  // The wizard finishes with a navigation; pick up the phase it wrote.
  useEffect(() => {
    setPhase(readTourPhase())
  }, [pathname])
  // …and `?onboarding-redo` re-arms it WITHOUT a navigation (sessionStorage
  // fires no event in its own tab, so the writer notifies).
  useEffect(
    () => subscribeTourPhase(() => setPhase(readTourPhase())),
    [],
  )

  const dismiss = useCallback(() => {
    clearTourPhase()
    setPhase(null)
    void markTourDone({}).catch(() => {})
  }, [markTourDone])

  // One confetti burst, fired once per arming.
  const confettiFired = useRef(false)
  useEffect(() => {
    if (phase !== "welcome" || confettiFired.current) return
    confettiFired.current = true
    void fireConfetti()
  }, [phase])

  if (phase !== "welcome") return null

  return (
    <div className="animate-in fade-in-0 fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 px-4 duration-300">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Welcome to Trackstage 🎉
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your event is ready. The Getting-started list in the sidebar will
            walk you through the rest — build your form, share the link, and
            the submissions start rolling in.
          </p>
          <Button type="button" size="lg" onClick={dismiss}>
            Let's go
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
