import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Driver } from "driver.js"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { appLink } from "@/lib/app-links"
import type { EventRef } from "@/lib/app-links"
import {
  clearTourPhase,
  readTourIndex,
  readTourPhase,
  subscribeTourPhase,
  writeTourIndex,
  writeTourPhase,
} from "@/lib/onboarding-storage"
import type { TourPhase } from "@/lib/onboarding-storage"
import { useCurrentEvent } from "@/lib/current-event"

import "driver.js/dist/driver.css"
import "./tour.css"

/**
 * The guided first-run tour — IN the live app, not on wizard pages (Marko,
 * final shape): confetti + welcome, then driver.js spotlights that walk a
 * non-technical organizer across the REAL pages: event details and the
 * public link, Rooms & tracks, the form builder, the submissions pipeline,
 * evaluation, the agenda, the speaker roster, the copilot, and the
 * Getting-started checklist that carries the rest. Ten steps, one plain
 * sentence each, navigating between pages as it goes (Marko, tour v2:
 * "multi-page, but don't overdo it").
 *
 * It can ONLY start via the sessionStorage phase the onboarding takeover
 * writes on finish (src/lib/onboarding-storage.ts) — existing accounts,
 * demo/seeded data and e2e sign-ins never see it. Skippable at every
 * moment: the welcome card's "I'll explore on my own", driver's ✕, or
 * finishing — all end it forever (userFlags.tourDoneAt).
 *
 * Phases (survive the tour's own navigations):
 *   welcome → confetti + centered card
 *   create  → spotlight on the create-event button; the dialog advances
 *             the phase to "details" and redirects to Event settings
 *   details → the ten-step journey below, position in sessionStorage so
 *             each page change resumes exactly where it left off
 *
 * Re-run it any time: append `?onboarding-redo` to any /app URL — resets the
 * flags and drops you back at the welcome moment (wizard first when the
 * workspace has no events). Handled in useOnboardingGate.
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

/** A page of the organizer app the journey can route to; `null` = wherever
 *  the previous step left us (shell-level anchors exist on every page). */
type JourneyPage =
  | "settings"
  | "forms"
  | "submissions"
  | "evaluation"
  | "agenda"
  | "speakers"
  | null

interface JourneyStep {
  page: JourneyPage
  selector: string
  title: string
  description: string
}

/** Ten tight steps across the real product, in Marko's order. */
const JOURNEY: Array<JourneyStep> = [
  {
    page: "settings",
    selector: "[data-tour='event-details']",
    title: "Add the important details",
    description:
      "Dates, venue, a sentence about the event — this is what builds your public event page.",
  },
  {
    page: "settings",
    selector: "[data-tour='public-link']",
    title: "Your event's public page",
    description:
      "This address is your event's home on the web — share it anywhere.",
  },
  {
    page: "settings",
    selector: "[data-tour='settings-tab-rooms']",
    title: "Rooms & tracks",
    description:
      "Give your venue its rooms and your program its tracks — the agenda is built from them.",
  },
  {
    page: "forms",
    selector: "[data-tour='new-form']",
    title: "Build your CFP form",
    description:
      "Your call for papers is a form — build it here, then share its link with speakers.",
  },
  {
    page: "submissions",
    selector: "[data-tour='page-submissions']",
    title: "Proposals arrive here",
    description:
      "Every submission lands in this pipeline — statuses, queues, and decisions in batches.",
  },
  {
    page: "evaluation",
    selector: "[data-tour='page-evaluation']",
    title: "Decide together",
    description:
      "Invite reviewers to score submissions in rounds before you accept or decline.",
  },
  {
    page: "agenda",
    selector: "[data-tour='page-agenda']",
    title: "Build your agenda",
    description:
      "Drag accepted talks into rooms and time slots — clashes get flagged as you go.",
  },
  {
    page: "speakers",
    selector: "[data-tour='page-speakers']",
    title: "Your speakers",
    description:
      "The roster: every speaker's profile, sessions, and the tasks they still owe you.",
  },
  {
    page: null,
    selector: "[data-tour='copilot']",
    title: "Or just ask",
    description:
      "The copilot can do all of this for you — it reads and changes your event, and asks first before anything big.",
  },
  {
    page: null,
    selector: "[data-tour='getting-started']",
    title: "Your progress lives here",
    description:
      "We tick these off automatically as your event comes together. That's the tour — you're in good shape.",
  },
]

function pagePath(page: Exclude<JourneyPage, null>, ref: EventRef): string {
  switch (page) {
    case "settings":
      return appLink.settings(ref)
    case "forms":
      return appLink.forms(ref)
    case "submissions":
      return appLink.submissions(ref)
    case "evaluation":
      return appLink.evaluation(ref)
    case "agenda":
      return appLink.agenda(ref)
    case "speakers":
      return appLink.speakers(ref)
  }
}

export function DashboardTour() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { events, eventRef } = useCurrentEvent()
  const markTourDone = useConvexMutation(api.onboarding.markTourDone)

  const [phase, setPhase] = useState<TourPhase | null>(() => readTourPhase())
  // The tour's own redirects change the pathname; pick up the phase the
  // dialog wrote before navigating.
  useEffect(() => {
    setPhase(readTourPhase())
  }, [pathname])
  // …and `?onboarding-redo` re-arms the phase WITHOUT a navigation
  // (sessionStorage fires no event in its own tab, so the writer notifies).
  useEffect(
    () => subscribeTourPhase(() => setPhase(readTourPhase())),
    [],
  )

  const driverRef = useRef<Driver | null>(null)
  // True while WE destroy the driver (unmount, page hand-off) — those must
  // not count as the person ending the tour.
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
        // fall through to the journey rather than dead-ending.
        writeTourPhase("details")
        setPhase("details")
        return
      }
      const instance = driver({
        popoverClass: "ts-tour",
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

  // ——— details: the ten-step journey, one page segment at a time ——————————
  useEffect(() => {
    if (phase !== "details" || !eventRef) return
    let cancelled = false as boolean

    const index = Math.min(readTourIndex(), JOURNEY.length - 1)
    const step = JOURNEY[index]
    const targetPath =
      step.page === null ? null : pagePath(step.page, eventRef)

    // Not on this step's page yet — go there; the pathname change re-runs
    // this effect and the segment starts.
    if (targetPath && !pathname.startsWith(targetPath)) {
      void navigate({ href: targetPath })
      return
    }

    // The segment: consecutive steps on this same page (page-less steps ride
    // along with whatever page they follow).
    let end = index
    while (
      end + 1 < JOURNEY.length &&
      (JOURNEY[end + 1].page === null || JOURNEY[end + 1].page === step.page)
    ) {
      end += 1
    }
    const segment = JOURNEY.slice(index, end + 1)
    const isFinalSegment = end === JOURNEY.length - 1

    void (async () => {
      const { driver } = await import("driver.js")
      await waitForElement(segment[0].selector, 3_000)
      if (cancelled) return
      const present = segment.filter((s) =>
        document.querySelector(s.selector),
      )
      if (present.length === 0) {
        // Nothing on this page (odd viewport, dismissed checklist) — move on.
        if (isFinalSegment) {
          endTour()
        } else {
          writeTourIndex(end + 1)
          const nextStep = JOURNEY[end + 1]
          if (nextStep.page) {
            void navigate({ href: pagePath(nextStep.page, eventRef) })
          }
        }
        return
      }

      const instance = driver({
        popoverClass: "ts-tour",
        // Segment-local progress lies about the journey; a quiet global
        // "k of 10" is appended into each description instead.
        showProgress: false,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: isFinalSegment ? "Finish" : "Next",
        allowClose: true,
        disableActiveInteraction: true,
        overlayOpacity: 0.6,
        steps: present.map((s) => ({
          element: s.selector,
          popover: {
            title: s.title,
            description: `${s.description}<span class="ts-tour-count">${
              JOURNEY.indexOf(s) + 1
            } of ${JOURNEY.length}</span>`,
          },
        })),
        onNextClick: () => {
          const active = driverRef.current
          if (!active) return
          if (!active.isLastStep()) {
            active.moveNext()
            return
          }
          // Segment boundary: hand off to the next page, or finish.
          if (isFinalSegment) {
            active.destroy() // non-programmatic ⇒ onDestroyed ends the tour
            return
          }
          programmaticDestroy.current = true
          active.destroy()
          writeTourIndex(end + 1)
          const nextStep = JOURNEY[end + 1]
          if (nextStep.page) {
            void navigate({ href: pagePath(nextStep.page, eventRef) })
          }
        },
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
  }, [phase, pathname, eventRef, navigate, endTour])

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
