import * as React from "react"
import { Link } from "@tanstack/react-router"
import {
  RiArrowRightSLine,
  RiImageLine,
  RiInformationLine,
  RiAlertLine,
  RiCheckboxCircleLine
  
} from "@remixicon/react"
import type {RemixiconComponentType} from "@remixicon/react";

import { cn } from "@/lib/utils"
import { EXTERNAL_LINK_PROPS } from "@/components/marketing/links"

/**
 * The building blocks every /docs page is made of.
 *
 * Deliberately tiny (rule 27: "hyper-minimal, never gigantic text"): a page is
 * a title, one lead sentence, a handful of numbered steps, and a screenshot per
 * step. Nothing here renders more than that.
 */

// ——— Page frame ———————————————————————————————————————————————————————————

export function DocArticle({
  title,
  lead,
  children,
}: {
  title: string
  /** One sentence. If it needs two, the page is doing too much. */
  lead: string
  children: React.ReactNode
}) {
  return (
    <article>
      <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-balance text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-7 text-pretty text-muted-foreground">
        {lead}
      </p>
      <div className="mt-8">{children}</div>
    </article>
  )
}

// ——— Steps ————————————————————————————————————————————————————————————————

/** A vertical rail of numbered steps. Children must be `<Step>`s. */
export function Steps({ children }: { children: React.ReactNode }) {
  const steps = React.Children.toArray(children)
  return (
    <ol className="space-y-8">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <div className="flex shrink-0 flex-col items-center">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-full border border-primary-border bg-primary-surface font-mono text-xs font-medium text-primary"
            >
              {index + 1}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-1">{step}</div>
        </li>
      ))}
    </ol>
  )
}

/**
 * One step: a single plain-English sentence, then (usually) the screenshot of
 * exactly what the organizer is looking at while they do it.
 */
export function Step({
  title,
  children,
}: {
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <p className="text-[0.9375rem] leading-6 font-medium text-pretty text-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

// ——— Screenshot ———————————————————————————————————————————————————————————

/**
 * A product screenshot from `public/docs/` (captured by
 * `scripts/capture-screenshots.mjs --docs`, so it can never drift from the
 * real UI). A shot that has not been captured yet degrades to a labelled
 * placeholder rather than a broken image.
 */
export function Shot({
  src,
  alt,
  caption,
  className,
}: {
  /** File name inside `public/docs/`, e.g. `"gs-dashboard.png"`. */
  src: string
  alt: string
  caption?: string
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)

  return (
    <figure className={cn("space-y-1.5", className)}>
      {failed ? (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
          <RiImageLine size={20} aria-hidden />
          <span className="px-4 text-center text-xs">{alt}</span>
        </div>
      ) : (
        <img
          src={`/docs/${src}`}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full rounded-xl border border-border bg-card"
        />
      )}
      {caption ? (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

// ——— Inline link ——————————————————————————————————————————————————————————

/** An in-prose link to another docs page (client-side, styled by `.doc-prose`). */
export function DocLink({
  to,
  children,
}: {
  to: React.ComponentProps<typeof Link>["to"]
  children: React.ReactNode
}) {
  return <Link to={to}>{children}</Link>
}

// ——— Callout ——————————————————————————————————————————————————————————————

const CALLOUT_TONES = {
  note: {
    icon: RiInformationLine,
    className: "border-border bg-muted/50 text-muted-foreground",
    iconClassName: "text-muted-foreground",
  },
  tip: {
    icon: RiCheckboxCircleLine,
    className: "border-primary-border bg-primary-surface text-foreground",
    iconClassName: "text-primary",
  },
  warning: {
    icon: RiAlertLine,
    className:
      "border-[var(--status-amber-dot)]/30 bg-[var(--status-amber-bg)] text-[var(--status-amber-fg)]",
    iconClassName: "text-[var(--status-amber-dot)]",
  },
} as const

export function Callout({
  tone = "note",
  children,
}: {
  tone?: keyof typeof CALLOUT_TONES
  children: React.ReactNode
}) {
  const { icon: Icon, className, iconClassName } = CALLOUT_TONES[tone]
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border px-3.5 py-3 text-[0.875rem] leading-6",
        className
      )}
    >
      <Icon size={16} aria-hidden className={cn("mt-0.5 shrink-0", iconClassName)} />
      <div className="min-w-0 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </div>
  )
}

// ——— Cards ————————————————————————————————————————————————————————————————

export function DocCardGrid({
  columns = 2,
  children,
}: {
  columns?: 2 | 3
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3"
      )}
    >
      {children}
    </div>
  )
}

const CARD_CLASS =
  "group flex h-full flex-col gap-1.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary-border hover:bg-primary-surface/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"

function CardBody({
  icon: Icon,
  title,
  description,
}: {
  icon?: RemixiconComponentType
  title: string
  description: string
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon size={16} aria-hidden className="shrink-0 text-primary" />
        ) : null}
        <span className="font-heading text-[0.9375rem] font-medium tracking-[-0.01em] text-foreground">
          {title}
        </span>
        <RiArrowRightSLine
          size={16}
          aria-hidden
          className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <span className="text-[0.8125rem] leading-6 text-pretty text-muted-foreground">
        {description}
      </span>
    </>
  )
}

export function DocCard({
  to,
  href,
  icon,
  title,
  description,
}: {
  /** Internal route. Mutually exclusive with `href`. */
  to?: React.ComponentProps<typeof Link>["to"]
  /** External URL. */
  href?: string
  icon?: RemixiconComponentType
  title: string
  description: string
}) {
  if (href) {
    return (
      <a href={href} {...EXTERNAL_LINK_PROPS} className={CARD_CLASS}>
        <CardBody icon={icon} title={title} description={description} />
      </a>
    )
  }
  return (
    <Link to={to} className={CARD_CLASS}>
      <CardBody icon={icon} title={title} description={description} />
    </Link>
  )
}
