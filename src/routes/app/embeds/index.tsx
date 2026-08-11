import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import {
  RiCheckLine,
  RiCodeSSlashLine,
  RiComputerLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiFileCopyLine,
  RiGalleryLine,
  RiLayoutGridLine,
  RiListCheck2,
  RiListUnordered,
  RiRefreshLine,
  RiSettings3Line,
  RiSmartphoneLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { widgetSearchToQuery } from "@/components/public/widget-search"
import type { WidgetSearch } from "@/components/public/widget-search"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * Embeds — the "Get Code" surface (sbek EMB-15, docs/ux/05 image39 + image12).
 *
 * Sessionboard makes organizers create, name and publish an embed record, then
 * wait ~60 minutes for the widget cache to catch up. Ours is a link: every
 * public page already renders bare with `?embed=1`, so this screen is a
 * configurator that writes query params, previews the real widget in an
 * iframe, and hands over a snippet. Nothing to publish, and the embed shows
 * live data the moment the organizer changes the program.
 */
export const Route = createFileRoute("/app/embeds/")({
  component: EmbedsPage,
})

interface WidgetType {
  id: string
  name: string
  description: string
  icon: RemixiconComponentType
  /** Path under the event, e.g. "/sessions". */
  path: string
  /** Params that define this widget (on top of the organizer's options). */
  params: WidgetSearch
  /** Sensible iframe height. */
  height: number
}

const WIDGET_TYPES: Array<WidgetType> = [
  {
    id: "agenda",
    name: "Agenda",
    description:
      "The wall-planner grid: rooms across the top, time down the side, one day at a time.",
    icon: RiLayoutGridLine,
    path: "",
    params: { view: "rooms" },
    height: 900,
  },
  {
    id: "itinerary",
    name: "Schedule itinerary",
    description:
      "The chronological day-by-day agenda with day tabs and full session cards.",
    icon: RiListCheck2,
    path: "",
    params: { view: "time" },
    height: 900,
  },
  {
    id: "sessions",
    name: "Sessions list",
    description:
      "A searchable catalog of every session, with track, format and room filters.",
    icon: RiListUnordered,
    path: "/sessions",
    params: {},
    height: 900,
  },
  {
    id: "speaker-gallery",
    name: "Speaker gallery",
    description:
      "A photo grid of your speakers. Clicking a face opens their bio and sessions.",
    icon: RiGalleryLine,
    path: "/speakers",
    params: { view: "gallery" },
    height: 800,
  },
  {
    id: "speaker-list",
    name: "Speakers list",
    description:
      "A directory that pairs each speaker with the sessions they're presenting.",
    icon: RiListUnordered,
    path: "/speakers",
    params: { view: "list" },
    height: 900,
  },
]

const ALL_TRACKS = "All tracks"

function EmbedsPage() {
  const { events, event: currentEvent, isEmpty: hasNoEvent } = useCurrentEvent()
  const [slug, setSlug] = useState<string | null>(null)
  const activeSlug = slug ?? currentEvent?.slug ?? null
  const activeEvent = events.find((event) => event.slug === activeSlug)

  const [widgetId, setWidgetId] = useState(WIDGET_TYPES[0].id)
  const widget =
    WIDGET_TYPES.find((type) => type.id === widgetId) ?? WIDGET_TYPES[0]

  const [showDescriptions, setShowDescriptions] = useState(true)
  const [showSpeakers, setShowSpeakers] = useState(true)
  const [showPhotos, setShowPhotos] = useState(true)
  const [showSearch, setShowSearch] = useState(true)
  const [track, setTrack] = useState(ALL_TRACKS)
  const [height, setHeight] = useState(widget.height)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [refreshKey, setRefreshKey] = useState(0)

  // The height default follows the widget unless the organizer typed one.
  useEffect(() => {
    setHeight(widget.height)
  }, [widget.height])

  const { data: program } = useQuery(
    convexQuery(
      api.publicData.schedule,
      activeSlug ? { slug: activeSlug } : "skip",
    ),
  )

  const [origin, setOrigin] = useState("")
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const search: WidgetSearch = {
    embed: true,
    ...widget.params,
    hideDescriptions: showDescriptions ? undefined : true,
    hideSpeakers: showSpeakers ? undefined : true,
    hideImages: showPhotos ? undefined : true,
    hideSearch: showSearch ? undefined : true,
    track: track === ALL_TRACKS ? undefined : track,
  }

  const relativeUrl = activeSlug
    ? `/e/${activeSlug}${widget.path}${widgetSearchToQuery(search)}`
    : ""
  const publicUrl = `${origin || "https://your-sessionboard-site.com"}${relativeUrl}`
  const snippet = useMemo(
    () =>
      [
        `<iframe`,
        `  src="${publicUrl}"`,
        `  title="${widget.name} — ${activeEvent?.name ?? "Event"}"`,
        `  width="100%"`,
        `  height="${height}"`,
        `  style="border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc"`,
        `  loading="lazy"`,
        `></iframe>`,
      ].join("\n"),
    [publicUrl, widget.name, activeEvent?.name, height],
  )

  const icsFeedUrl = useMemo(() => {
    const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
    if (!convexUrl || !activeSlug) return null
    return `${convexUrl.replace(".convex.cloud", ".convex.site")}/v1/event/${activeSlug}/schedule.ics`
  }, [activeSlug])

  if (hasNoEvent) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Embeds"
          description="Put your agenda, sessions or speakers on your own website."
        />
        <EmptyState
          icon={RiCodeSSlashLine}
          title="Create your event first"
          description="Embeds publish an event's schedule and speakers to your website. Once you've set up an event in Settings, come back here to grab the code."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Embeds"
        description="Export a feed of your agenda, sessions, or speakers to place in your app or website."
        actions={
          activeSlug ? (
            <Button
              variant="outline"
              render={
                <a
                  href={`/e/${activeSlug}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <RiExternalLinkLine aria-hidden />
              View public page
            </Button>
          ) : null
        }
      />

      {events.length > 1 ? (
        <Field className="max-w-sm">
          <FieldLabel htmlFor="embed-event">Event</FieldLabel>
          <Select
            items={events.map((event) => ({
              value: event.slug,
              label: event.name,
            }))}
            value={activeSlug ?? ""}
            onValueChange={(next) => setSlug(String(next))}
          >
            <SelectTrigger id="embed-event" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.slug} value={event.slug}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {/* 1 — pick a widget type */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            1. Choose a widget
          </h2>
          <p className="text-sm text-muted-foreground">
            Each one is a live view of this event — it updates itself whenever
            you change the program. No re-publishing.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WIDGET_TYPES.map((type) => {
            const selected = type.id === widget.id
            return (
              <li key={type.id}>
                <Card
                  size="sm"
                  className={cn(
                    "h-full p-0 transition-shadow",
                    selected && "ring-2 ring-primary",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setWidgetId(type.id)}
                    className="flex h-full w-full flex-col items-start gap-1.5 rounded-xl p-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <type.icon size={17} aria-hidden />
                      </span>
                      <span className="font-medium text-foreground">
                        {type.name}
                      </span>
                      {selected ? (
                        <StatusPill
                          status="active"
                          label="Selected"
                          size="sm"
                          className="ml-auto"
                        />
                      ) : null}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {type.description}
                    </span>
                  </button>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 2 — configure + preview + copy */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card className="h-fit gap-5 p-5">
          <div className="flex items-center gap-2">
            <RiSettings3Line size={16} aria-hidden className="text-muted-foreground" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              2. Choose what shows
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <OptionSwitch
              id="opt-descriptions"
              label="Session descriptions"
              description="The abstract under each title, with a Show more link."
              checked={showDescriptions}
              onChange={setShowDescriptions}
            />
            <OptionSwitch
              id="opt-speakers"
              label="Speakers on cards"
              description="Names, job titles and companies under each session."
              checked={showSpeakers}
              onChange={setShowSpeakers}
            />
            <OptionSwitch
              id="opt-photos"
              label="Speaker photos"
              description="Turn off to show initials instead of headshots."
              checked={showPhotos}
              onChange={setShowPhotos}
            />
            <OptionSwitch
              id="opt-search"
              label="Search and filters"
              description="Let visitors search and filter inside the widget."
              checked={showSearch}
              onChange={setShowSearch}
            />
          </div>

          <Separator />

          <Field>
            <FieldLabel htmlFor="opt-track">Show only one track</FieldLabel>
            <FieldDescription>
              Handy for a track-specific landing page on your website.
            </FieldDescription>
            <Select
              items={[ALL_TRACKS, ...(program?.tracks ?? []).map((t) => t.name)].map(
                (name) => ({ value: name, label: name }),
              )}
              value={track}
              onValueChange={(next) => setTrack(String(next))}
            >
              <SelectTrigger id="opt-track" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TRACKS}>{ALL_TRACKS}</SelectItem>
                {(program?.tracks ?? []).map((item) => (
                  <SelectItem key={item._id} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="opt-height">Height on your site</FieldLabel>
            <FieldDescription>
              Pixels. The widget scrolls inside this box.
            </FieldDescription>
            <Input
              id="opt-height"
              type="number"
              min={200}
              max={5000}
              step={50}
              value={height}
              onChange={(event) =>
                setHeight(Number(event.target.value) || widget.height)
              }
            />
          </Field>

          {program ? (
            <p className="text-xs text-muted-foreground">
              Showing live data: {program.totals.sessions} accepted{" "}
              {program.totals.sessions === 1 ? "session" : "sessions"} ·{" "}
              {program.totals.speakers}{" "}
              {program.totals.speakers === 1 ? "speaker" : "speakers"}.
            </p>
          ) : null}
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <Tabs defaultValue="preview" className="gap-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <TabsList variant="line">
                <TabsTrigger value="preview">
                  <RiEyeLine size={15} aria-hidden />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code">
                  <RiCodeSSlashLine size={15} aria-hidden />
                  Get code
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1">
                <Button
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Desktop preview"
                  onClick={() => setDevice("desktop")}
                >
                  <RiComputerLine aria-hidden />
                </Button>
                <Button
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Mobile preview"
                  onClick={() => setDevice("mobile")}
                >
                  <RiSmartphoneLine aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh preview"
                  onClick={() => setRefreshKey((key) => key + 1)}
                >
                  <RiRefreshLine aria-hidden />
                </Button>
              </div>
            </div>

            <TabsContent value="preview" className="m-0 bg-muted/40 p-4">
              {activeSlug ? (
                <div
                  className={cn(
                    "mx-auto overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[max-width]",
                    device === "mobile" ? "max-w-[390px]" : "max-w-full",
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
                    <span className="flex gap-1" aria-hidden>
                      <span className="size-2.5 rounded-full bg-status-red-dot/70" />
                      <span className="size-2.5 rounded-full bg-status-amber-dot/70" />
                      <span className="size-2.5 rounded-full bg-status-green-dot/70" />
                    </span>
                    <span className="truncate rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
                      {publicUrl}
                    </span>
                  </div>
                  <iframe
                    key={`${relativeUrl}-${refreshKey}`}
                    src={relativeUrl}
                    title={`${widget.name} preview`}
                    className="block w-full bg-background"
                    style={{ height: Math.min(height, 700) }}
                  />
                </div>
              ) : (
                <Skeleton className="h-[420px] w-full" />
              )}
            </TabsContent>

            <TabsContent value="code" className="m-0 flex flex-col gap-5 p-5">
              <Field>
                <FieldLabel htmlFor="embed-snippet">
                  Paste this into your website
                </FieldLabel>
                <FieldDescription>
                  Works in any site builder that accepts HTML — Webflow, Wix,
                  Squarespace, WordPress, or your own code.
                </FieldDescription>
                <Textarea
                  id="embed-snippet"
                  readOnly
                  rows={8}
                  value={snippet}
                  onFocus={(event) => event.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <CopyButton
                  value={snippet}
                  label="Copy embed code"
                  className="w-fit self-start"
                />
              </Field>

              <Separator />

              <Field>
                <FieldLabel htmlFor="embed-link">
                  Or share the direct link
                </FieldLabel>
                <FieldDescription>
                  The same widget as its own page — good for emails, Slack and
                  QR codes.
                </FieldDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="embed-link"
                    readOnly
                    value={publicUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 font-mono text-xs"
                  />
                  <CopyButton value={publicUrl} label="Copy link" />
                  <Button
                    variant="outline"
                    render={
                      <a
                        href={relativeUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <RiExternalLinkLine aria-hidden />
                    Open
                  </Button>
                </div>
              </Field>

              {icsFeedUrl ? (
                <>
                  <Separator />
                  <Field>
                    <FieldLabel htmlFor="embed-ics">
                      Calendar feed (.ics)
                    </FieldLabel>
                    <FieldDescription>
                      Subscribe-able calendar of the whole program, for people
                      who'd rather live in their calendar app.
                    </FieldDescription>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="embed-ics"
                        readOnly
                        value={icsFeedUrl}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 font-mono text-xs"
                      />
                      <CopyButton value={icsFeedUrl} label="Copy feed" />
                    </div>
                  </Field>
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </Card>
      </section>
    </div>
  )
}

function OptionSwitch({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(Boolean(next))}
      />
    </div>
  )
}

function CopyButton({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true)
            toast.success("Copied to your clipboard")
            setTimeout(() => setCopied(false), 2000)
          })
          .catch(() => toast.error("Couldn't copy — select the text instead"))
      }}
    >
      {copied ? <RiCheckLine aria-hidden /> : <RiFileCopyLine aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  )
}
