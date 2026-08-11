import { useCallback, useEffect, useRef, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Driver } from "driver.js"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  clearTourPhase,
  readTourPhase,
  writeTourPhase,
} from "@/lib/onboarding-storage"
import { useCurrentEvent } from "@/lib/current-event"
import type { TourPhase } from "@/lib/onboarding-storage"

import "driver.js/dist/driver.css"

/**
 * The guided first-run tour — IN the live app, not on wizard pages (Marko,
 * final shape): confetti + welcome, then driver.js spotlights that walk a
 * non-technical organizer through actually DOING the setup: create the
 * event → (the new-event dialog redirects to Event settings) → fill the
 * details that build the public page → where forms, evaluation and the
 * agenda live → the Getting-started checklist that tracks the rest.
 *
 * It can ONLY start via the sessionStorage phase the onboarding takeover
 * writes on finish (src/lib/onboarding-storage.ts) — existing accounts,
 * demo/seeded data and e2e sign-ins never see it. Skippable at every
 * moment: the welcome card's "I'll explore on my own", driver's ✕, or
 * finishing — all end it forever (userFlags.tourDoneAt).
 *
 * Phases (survive the tour's own navigations):
 *   welcome → confetti + centered card on the dashboard
 *   create  → spotlight on the create-event button; the dialog advances
 *             the phase to "details" and redirects to Event settings
 *   details → one driver run over whatever anchors exist on this page:
 *             details form → public link → Forms → Evaluation → Agenda →
 *             Getting-started checklist
 */

const WAIT_FOR_ELEMENT_MS = 5_000

function waitForElement(
  selector: string,
  timeoutMs = WAIT_FOR_ELEMENT_MS,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const started = Date.now()
    const look = () => {
      const el = document.querySelector(selector)
      if (el) return resolve(el)
      if (Date.now() - started > timeoutMs) return resolve(null)
      requestAnimationFrame(look)
    }
    look()
  })
}

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

/** The guided steps of the "details" phase, in Marko's order. Filtered to
 *  the anchors that actually exist on the current page, so the tour runs
 *  wherever the organizer is instead of erroring on a missing element. */
const GUIDE_STEPS = [
  {
    selector: "[data-tour='event-details']",
    title: "Add the important details",
    description:
      "Dates, venue, a sentence about the event — this is what builds your public event page. Fill in what you know and hit Save.",
  },
  {
    selector: "[data-tour='public-link']",
    title: "Your event's public page",
    description:
      "This address is your event's home on the web — it updates itself as you add details and publish your program.",
  },
  {
    selector: "[data-tour='nav-forms']",
    title: "Get submissions with a form",
    description:
      "Your call for papers lives here. Build the form, share its link, and every proposal lands in Submissions.",
  },
  {
    selector: "[data-tour='nav-evaluation']",
    title: "Decide together",
    description:
      "Invite reviewers to score submissions, then accept or decline in batches — decision emails go out when you say so.",
  },
  {
    selector: "[data-tour='nav-agenda']",
    title: "Build your agenda",
    description:
      "Drag accepted talks into rooms and time slots — clashes get flagged as you go.",
  },
  {
    selector: "[data-tour='getting-started']",
    title: "Your progress lives here",
    description:
      "We tick these off automatically as your event comes together. That's the tour — you're in good shape.",
  },
]

export function DashboardTour() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { events } = useCurrentEvent()
  const markTourDone = useConvexMutation(api.onboarding.markTourDone)

  const [phase, setPhase] = useState<TourPhase | null>(() => readTourPhase())
  // The tour's own redirects change the pathname; pick up the phase the
  // dialog wrote before navigating.
  useEffect(() => {
    setPhase(readTourPhase())
  }, [pathname])

  const driverRef = useRef<Driver | null>(null)
  // True while WE destroy the driver (unmount, page change) — those must not
  // count as the person ending the tour.
  const programmaticDestroy = useRef(false)

  const endTour = useCallback(() => {
    clearTourPhase()
    setPhase(null)
    void markTourDone({}).catch(() => {})
  }, [markTourDone])

  // ——— welcome: one confetti burst, fired once per arming ————————————————
  const confettiFired = useRef(false)
  useEffect(() => {
    if (phase !== "welcome" || confettiFired.current) return
    confettiFired.current = true
    void fireConfetti()
  }, [phase])

  // ——— create: spotlight the create-event button, then get out of the way —
  useEffect(() => {
    if (phase !== "create") return
    let cancelled = false as boolean
    void (async () => {
      const { driver } = await import("driver.js")
      const el = await waitForElement("[data-tour='create-event']")
      if (cancelled) return
      if (!el) {
        // Nothing to point at (they already have events some other way) —
        // fall through to the guide phase rather than dead-ending.
        writeTourPhase("details")
        setPhase("details")
        return
      }
      const instance = driver({
        showProgress: false,
        allowClose: true,
        // The whole point of this step is CLICKING the highlighted button.
        disableActiveInteraction: false,
        overlayOpacity: 0.6,
        steps: [
          {
            element: "[data-tour='create-event']",
            popover: {
              title: "Create your first event",
              description:
                "Everything starts here — click the button and give your event a name. (✕ ends the tour any time.)",
              side: "bottom",
              showButtons: ["close"],
            },
          },
        ],
        onDestroyed: () => {
          driverRef.current = null
          // Advanced by the dialog ⇒ a hand-off, not an exit.
          if (!programmaticDestroy.current && readTourPhase() === "create") {
            endTour()
          }
          programmaticDestroy.current = false
        },
      })
      driverRef.current = instance
      instance.drive()
    })()
    return () => {
      cancelled = true
      if (driverRef.current) {
        programmaticDestroy.current = true
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [phase, endTour])

  // ——— details: the guided walk over whatever anchors this page has ——————
  useEffect(() => {
    if (phase !== "details") return
    let cancelled = false as boolean
    void (async () => {
      const { driver } = await import("driver.js")
      // The settings page needs a beat to render its form.
      await waitForElement(GUIDE_STEPS[0].selector, 3_000)
      if (cancelled) return
      const present = GUIDE_STEPS.filter((step) =>
        document.querySelector(step.selector),
      )
      if (present.length === 0) {
        endTour()
        return
      }
      const instance = driver({
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        allowClose: true,
        disableActiveInteraction: true,
        overlayOpacity: 0.6,
        steps: present.map((step) => ({
          element: step.selector,
          popover: {
            title: step.title,
            description: step.description,
          },
        })),
        onDestroyed: () => {
          driverRef.current = null
          // Finished or closed — either way the tour is over (the checklist
          // stays behind to carry the rest).
          if (!programmaticDestroy.current) endTour()
          programmaticDestroy.current = false
        },
      })
      driverRef.current = instance
      instance.drive()
    })()
    return () => {
      cancelled = true
      if (driverRef.current) {
        programmaticDestroy.current = true
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
    // Deliberately NOT keyed on pathname: navigating mid-guide would restart
    // it; the overlay + disabled interactions make that near-impossible anyway.
  }, [phase, endTour])

  if (phase !== "welcome") return null

  return (
    <div className="animate-in fade-in-0 fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 px-4 duration-300">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Welcome to Trackstage 🎉
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {events.length > 0
              ? "Your event is ready. Let's take a two-minute walk through where everything lives."
              : "Let's set up your first event — it takes about two minutes, and we'll show you around as you go."}
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => {
                // An event already exists (the wizard made it) ⇒ straight to
                // the guided walk; otherwise start by creating one.
                const next = events.length > 0 ? "details" : "create"
                writeTourPhase(next)
                setPhase(next)
              }}
            >
              Start the tour
            </Button>
            <button
              type="button"
              onClick={endTour}
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              I'll explore on my own
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
