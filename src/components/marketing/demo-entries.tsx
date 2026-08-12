import { Link } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  RiArrowRightLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiMicLine,
  RiSendPlaneLine,
  RiUserSettingsLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { DEMO_MODE } from "@/lib/demo-mode"
import { cn } from "@/lib/utils"
import {
  DISPLAY_HEADING,
  MarketingSection,
} from "@/components/marketing/section"
import {
  DEMO_CFP_URL,
  DEMO_ORGANIZER_EMAIL,
  DEMO_ORGANIZER_PASSWORD,
  DEMO_PORTAL_URL,
  DEMO_PROGRAM_URL,
  SECTION_IDS,
} from "@/components/marketing/links"

interface DemoEntry {
  title: string
  description: string
  cta: string
  icon: RemixiconComponentType
  /** Typed router link (organizer demo) vs. plain anchor (public surfaces). */
  to?: "/login"
  href?: string
  /** Extra content between the description and the CTA (the creds block). */
  extra?: React.ReactNode
}

/**
 * The demo credentials, copyable in place. The organizer entrance is the one
 * seat that needs a sign-in, so the account is handed over right here — click
 * to copy, then the CTA takes you to the form that wants it. The login card
 * shows the same pair (both import it from links.ts).
 */
function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => toast.success(`${label} copied`))
          .catch(() => toast(value))
      }}
      title={`Copy ${label.toLowerCase()}`}
      className="group/cred flex w-full items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="w-16 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
        {value}
      </span>
      <RiFileCopyLine
        size={14}
        aria-hidden
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/cred:opacity-100 group-focus-visible/cred:opacity-100"
      />
      <span className="sr-only">Copy {label.toLowerCase()}</span>
    </button>
  )
}

const DEMO_ENTRIES: Array<DemoEntry> = [
  {
    title: "The organizer app",
    description:
      "Proposals, reviews, the agenda and the emails — the whole thing. Sign in with the demo account below.",
    cta: "Open the organizer app",
    icon: RiUserSettingsLine,
    to: "/login",
    extra: (
      <div className="mt-2 space-y-1.5">
        <CredRow label="Email" value={DEMO_ORGANIZER_EMAIL} />
        <CredRow label="Password" value={DEMO_ORGANIZER_PASSWORD} />
      </div>
    ),
  },
  {
    title: "The speaker portal",
    description:
      "What a speaker sees once they're accepted: their talks, their profile, their to-do list. No password.",
    cta: "Open the speaker portal",
    icon: RiMicLine,
    href: DEMO_PORTAL_URL,
  },
  {
    title: "The submission form",
    description:
      "The public form a speaker fills in to propose a talk, start to finish. No account needed.",
    cta: "Open the submission form",
    icon: RiSendPlaneLine,
    href: DEMO_CFP_URL,
  },
]

/**
 * Three flat panes sharing one bordered container — the grouped-card pattern:
 * hairlines between the cells, no shadows, no rounded islands. Cells are plain
 * containers (not links) so the creds block stays clickable; the CTA at the
 * bottom of each cell is the way in.
 */
const CELL_CLASS =
  "flex h-full flex-col gap-2.5 p-6 border-t border-border first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0"

const CTA_CLASS =
  "group mt-auto flex w-fit items-center gap-1.5 pt-4 text-sm font-medium text-primary rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * The live-demo entry points, directly under the hero: anyone landing here is
 * one click from a working product on a pre-loaded event, no signup in the way.
 * Rendered only in DEMO_MODE — a self-hosted instance has no seeded demo
 * world, so there is nothing here to enter.
 */
export function DemoEntries() {
  if (!DEMO_MODE) return null
  return (
    <MarketingSection id={SECTION_IDS.demos} tone="muted">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2
          className={cn(
            DISPLAY_HEADING,
            "max-w-md text-3xl leading-[1.05] text-balance sm:text-4xl"
          )}
        >
          See it working, right now.
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground sm:text-right">
          A real demo conference with real data in it. Open to anyone, nothing
          to install.
        </p>
      </div>

      <div className="mt-9 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3">
        {DEMO_ENTRIES.map((entry) => {
          const cta = (
            <>
              {entry.cta}
              <RiArrowRightLine
                size={15}
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </>
          )

          return (
            <div key={entry.title} className={CELL_CLASS}>
              <entry.icon
                size={20}
                aria-hidden
                className="text-muted-foreground"
              />
              <span className="mt-1 block font-heading text-base font-medium text-foreground">
                {entry.title}
              </span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </span>
              {entry.extra}
              {entry.to ? (
                <Link to={entry.to} className={CTA_CLASS}>
                  {cta}
                </Link>
              ) : (
                <a href={entry.href} className={CTA_CLASS}>
                  {cta}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Attendee view:{" "}
        <a
          href={DEMO_PROGRAM_URL}
          className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Browse the published program
          <RiExternalLinkLine size={13} aria-hidden />
        </a>
      </p>
    </MarketingSection>
  )
}
