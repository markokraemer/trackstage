import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Doc, Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"

import { copyText } from "@/lib/clipboard"
import {
  RiCheckLine,
  RiCodeSSlashLine,
  RiComputerLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiSaveLine,
  RiSettings3Line,
  RiSmartphoneLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { widgetSearchToQuery } from "@/components/public/widget-search"
import { SavedEmbeds } from "@/components/embeds/saved-embeds"
import {
  EMBED_FORMATS,
  WIDGET_TYPES,
  escapeHtml,
  formatById,
  searchFor,
  tracksOf,
  tracksToOption,
  widgetById,
} from "@/components/embeds/embed-config"
import type { EmbedOptions } from "@/components/embeds/embed-config"
import { TRACK_COLORS } from "@/components/settings/track-color-picker"
import { useCurrentEvent } from "@/lib/current-event"
import { eventPath } from "@/lib/public-links"
import { errorMessage } from "@/lib/errors"

/**
 * Embeds — the "Get Code" surface (sbek EMB-15, docs/ux/05 image39 + image12).
 *
 * Sessionboard makes organizers create, name and publish an embed record, then
 * wait ~60 minutes for the widget cache to catch up. Ours is a link: every
 * public page already renders bare with `?embed=1`, so this screen is a
 * generator — pick a widget, pick what shows, pick a delivery format, preview
 * the real thing, copy the snippet. Configurations can be saved and reopened
 * (that's all a "saved embed" is here), and every live format shows current
 * data the moment the organizer changes the program.
 */
export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/embeds/")({
  component: EmbedsPage,
})

const ALL_TRACKS = "All tracks"

/**
 * Starting points for the accent colour — the eight track colours organizers
 * already choose from (src/components/settings/track-color-picker.tsx), so the
 * whole product picks colour from one palette. Any hex still works.
 */
const ACCENT_PRESETS = TRACK_COLORS

function EmbedsPage() {
  // The event comes from the sidebar switcher, like every other organizer
  // screen (docs/memory/RULES.md 23a). This page used to carry its own Event
  // select, which could disagree with the shell.
  const { event: activeEvent, isEmpty: hasNoEvent } = useCurrentEvent()
  const activeSlug = activeEvent?.slug ?? null
  const activeWorkspaceSlug = activeEvent?.organizationSlug ?? null

  const [widgetId, setWidgetId] = useState(WIDGET_TYPES[0].id)
  const widget = widgetById(widgetId)

  const [formatId, setFormatId] = useState(EMBED_FORMATS[0].id)
  const format = formatById(formatId)

  const [showDescriptions, setShowDescriptions] = useState(true)
  const [showSpeakers, setShowSpeakers] = useState(true)
  const [showPhotos, setShowPhotos] = useState(true)
  const [showSearch, setShowSearch] = useState(true)
  const [tracks, setTracks] = useState<Array<string>>([])
  const [accent, setAccent] = useState("")
  const [showHeader, setShowHeader] = useState(false)
  const [height, setHeight] = useState(widget.height)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [refreshKey, setRefreshKey] = useState(0)

  // Saved-embed state: the row currently loaded, and the name to save under.
  const [savedId, setSavedId] = useState<Id<"embeds"> | null>(null)
  const [embedName, setEmbedName] = useState("")
  const [saving, setSaving] = useState(false)
  /** The off switch of the row being edited (new embeds are born live). */
  const [enabled, setEnabled] = useState(true)

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
  const { data: speakerData } = useQuery(
    convexQuery(
      api.publicData.speakers,
      activeSlug && widget.dataset === "speakers" ? { slug: activeSlug } : "skip",
    ),
  )
  const embedsQuery = useQuery(
    convexQuery(
      api.embeds.list,
      activeEvent ? { eventId: activeEvent._id } : "skip",
    ),
  )
  const saveEmbed = useConvexMutation(api.embeds.save)
  const toggleEnabled = useConvexMutation(api.embeds.setEnabled)

  const [origin, setOrigin] = useState("")
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Only a complete `#RRGGBB` is ever put in front of the widget — the field
  // stays editable mid-typing without repainting the preview through six
  // half-finished colours.
  const accentHex = /^#[0-9a-fA-F]{6}$/.test(accent.trim())
    ? accent.trim().toUpperCase()
    : ""

  const options: EmbedOptions = {
    format: formatId,
    hideDescriptions: !showDescriptions,
    hideSpeakers: !showSpeakers,
    hideImages: !showPhotos,
    hideSearch: !showSearch,
    track: tracksToOption(tracks),
    height,
    accent: accentHex || undefined,
    showHeader,
  }

  // A saved embed's snippet carries its id, so the off switch reaches every
  // copy already pasted around the web. An unsaved configuration is just a
  // link, exactly as before.
  const search = searchFor(widget, options, savedId ?? undefined)

  const relativeUrl =
    activeSlug && activeWorkspaceSlug
      ? `${eventPath(activeWorkspaceSlug, activeSlug)}${widget.path}${widgetSearchToQuery(search)}`
      : ""
  const publicUrl = `${origin || "https://your-trackstage-site.com"}${relativeUrl}`

  const iframeSnippet = useMemo(
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

  /** A plain, unstyled snapshot of the current program. */
  const htmlSnippet = useMemo(() => {
    if (widget.dataset === "speakers") {
      const rows = speakerData?.speakers ?? []
      if (rows.length === 0) return "<!-- No speakers to export yet -->"
      return [
        `<ul class="trackstage-speakers">`,
        ...rows.map((speaker) =>
          [
            `  <li>`,
            `    <strong>${escapeHtml(speaker.name)}</strong>`,
            speaker.jobTitle || speaker.company
              ? `    <span>${escapeHtml([speaker.jobTitle, speaker.company].filter(Boolean).join(", "))}</span>`
              : null,
            showDescriptions && speaker.bio
              ? `    <p>${escapeHtml(speaker.bio)}</p>`
              : null,
            `  </li>`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        `</ul>`,
      ].join("\n")
    }

    const wanted = tracks.map((name) => name.toLowerCase())
    const days = (program?.days ?? []).map((day) => ({
      ...day,
      sessions:
        wanted.length === 0
          ? day.sessions
          : day.sessions.filter(
              (session) =>
                session.track !== null &&
                wanted.includes(session.track.name.toLowerCase()),
            ),
    }))
    const withSessions = days.filter((day) => day.sessions.length > 0)
    if (withSessions.length === 0) return "<!-- No scheduled sessions yet -->"
    return [
      `<div class="trackstage-agenda">`,
      ...withSessions.flatMap((day) => [
        `  <h3>${escapeHtml(day.label)}</h3>`,
        `  <ul>`,
        ...day.sessions.map((session) =>
          [
            `    <li>`,
            `      <strong>${escapeHtml(session.title)}</strong>`,
            session.room ? `      <span>${escapeHtml(session.room.name)}</span>` : null,
            showSpeakers && session.speakers.length > 0
              ? `      <span>${escapeHtml(session.speakers.map((s) => s.name).join(", "))}</span>`
              : null,
            showDescriptions && session.description
              ? `      <p>${escapeHtml(session.description)}</p>`
              : null,
            `    </li>`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        `  </ul>`,
      ]),
      `</div>`,
    ].join("\n")
  }, [
    widget.dataset,
    speakerData,
    program,
    tracks,
    showDescriptions,
    showSpeakers,
  ])

  const apiBase = useMemo(() => {
    const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
    if (!convexUrl || !activeSlug) return null
    return `${convexUrl.replace(".convex.cloud", ".convex.site")}/v1/event/${activeSlug}`
  }, [activeSlug])

  const jsonUrl = apiBase
    ? `${apiBase}/${widget.dataset === "speakers" ? "speakers" : "sessions"}`
    : null
  const icsFeedUrl = apiBase ? `${apiBase}/schedule.ics` : null
  // The XML feed takes the same track filter the widgets do, so a
  // track-specific page can import a track-specific feed.
  const xmlFeedUrl = apiBase
    ? `${apiBase}/schedule.xml${
        tracks.length > 0
          ? `?track=${encodeURIComponent(tracks.join(","))}`
          : ""
      }`
    : null

  /** What the "Get code" tab hands over, per format. */
  const deliverable: { value: string; label: string; help: string } = (() => {
    switch (format.id) {
      case "link":
        return {
          value: publicUrl,
          label: "Share this link",
          help: "The widget as its own page. Good for emails, Slack and QR codes.",
        }
      case "html":
        return {
          value: htmlSnippet,
          label: "Paste this markup",
          help: "Unstyled HTML you can restyle to match your site. It's a snapshot of the program right now — copy it again after you change the schedule.",
        }
      case "json":
        return {
          value: jsonUrl ?? "",
          label: "REST endpoint",
          help: "Returns paginated JSON. Send an API key as `Authorization: Bearer …` — create one under Settings → API & MCP.",
        }
      case "xml":
        return {
          value: xmlFeedUrl ?? "",
          label: "XML feed URL",
          help: "A live XML document of the published programme — point your CMS or site builder's feed importer at it. No key needed.",
        }
      case "ics":
        return {
          value: icsFeedUrl ?? "",
          label: "Calendar feed URL",
          help: "Subscribe-able .ics of the whole program. No key needed — it's public once the agenda is published.",
        }
      default:
        return {
          value: iframeSnippet,
          label: "Paste this into your website",
          help: "Works in any site builder that accepts HTML — Webflow, Wix, Squarespace, WordPress, or your own code.",
        }
    }
  })()

  function loadSaved(embed: Doc<"embeds">) {
    setSavedId(embed._id)
    setEmbedName(embed.name)
    setWidgetId(embed.widget)
    setFormatId(embed.options.format ?? EMBED_FORMATS[0].id)
    setShowDescriptions(!embed.options.hideDescriptions)
    setShowSpeakers(!embed.options.hideSpeakers)
    setShowPhotos(!embed.options.hideImages)
    setShowSearch(!embed.options.hideSearch)
    setTracks(tracksOf(embed.options.track))
    setAccent(embed.options.accent ?? "")
    setShowHeader(embed.options.showHeader === true)
    // Rows saved before the off switch existed have no `enabled` — they are on.
    setEnabled(embed.enabled !== false)
    setHeight(embed.options.height ?? widgetById(embed.widget).height)
    toast.success(`Loaded “${embed.name}”`)
  }

  async function handleSave() {
    if (!activeEvent) return
    const name = embedName.trim()
    if (!name) {
      toast.error("Give this embed a name first")
      return
    }
    setSaving(true)
    try {
      const id = await saveEmbed({
        eventId: activeEvent._id,
        embedId: savedId ?? undefined,
        name,
        widget: widget.id,
        enabled,
        options,
      })
      setSavedId(id)
      toast.success(savedId ? `Updated “${name}”` : `Saved “${name}”`, {
        description: "It's in your saved embeds at the top of this page.",
      })
    } catch (error) {
      toast.error("Couldn't save this embed", {
        description:
          errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

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

  const showPreview = format.id === "iframe" || format.id === "link"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Embeds"
        description="Export a feed of your agenda, sessions, or speakers to place in your app or website."
        actions={
          activeSlug && activeWorkspaceSlug ? (
            <a
              href={eventPath(activeWorkspaceSlug, activeSlug)}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <RiExternalLinkLine aria-hidden />
              View public page
            </a>
          ) : null
        }
      />

      <SavedEmbeds
        embeds={embedsQuery.data}
        activeId={savedId}
        onLoad={loadSaved}
        loading={Boolean(activeEvent) && embedsQuery.isPending}
      />

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

      {/* 2 — pick a delivery format */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            2. Choose a format
          </h2>
          <p className="text-sm text-muted-foreground">
            How you want to take it away. The first two stay live; the rest are
            for developers and calendar apps.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {EMBED_FORMATS.map((option) => {
            const selected = option.id === format.id
            return (
              <li key={option.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFormatId(option.id)}
                  className={cn(
                    "flex h-full w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected
                      ? "border-primary bg-accent/60 ring-1 ring-primary"
                      : "border-border bg-card",
                  )}
                >
                  <option.icon
                    size={16}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {option.name}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 3 — configure + preview + copy */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card className="h-fit gap-5 p-5">
          <div className="flex items-center gap-2">
            <RiSettings3Line
              size={16}
              aria-hidden
              className="text-muted-foreground"
            />
            <h2 className="font-heading text-base font-semibold text-foreground">
              3. Choose what shows
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

          {/* Which tracks — several, not one: a sponsor page often covers two
              rooms of a conference, and picking them one at a time meant two
              embeds where one would do. Nothing ticked = the whole program. */}
          <Field>
            <FieldLabel>Tracks to include</FieldLabel>
            <FieldDescription>
              Leave everything unticked to show the whole program, or pick the
              tracks this page is about.
            </FieldDescription>
            {(program?.tracks ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This event has no tracks yet — add them under Settings → Event.
              </p>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                  <Checkbox
                    checked={tracks.length === 0}
                    onCheckedChange={() => setTracks([])}
                  />
                  {ALL_TRACKS}
                </label>
                <div className="flex flex-col gap-2 border-t border-border pt-2">
                  {(program?.tracks ?? []).map((item) => (
                    <label
                      key={item._id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={tracks.includes(item.name)}
                        onCheckedChange={(checked) =>
                          setTracks((prev) =>
                            checked
                              ? [...prev, item.name]
                              : prev.filter((name) => name !== item.name),
                          )
                        }
                      />
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Field>

          <Separator />

          {/* Branding — the widget lives on somebody else's page and should
              look like it belongs there. Colour repaints links and buttons
              only; the surfaces stay neutral so it never fights the host. */}
          <Field>
            <FieldLabel htmlFor="opt-accent">Accent colour</FieldLabel>
            <FieldDescription>
              Used for links and buttons inside the widget. Leave empty to use
              the Trackstage blue.
            </FieldDescription>
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="size-8 shrink-0 rounded-lg ring-1 ring-foreground/10"
                style={{ backgroundColor: accentHex || "var(--primary)" }}
              />
              <Input
                id="opt-accent"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                placeholder="#0F6E70"
                spellCheck={false}
                className="min-w-0 flex-1 font-mono text-xs uppercase"
              />
              {accent ? (
                <Button variant="ghost" size="sm" onClick={() => setAccent("")}>
                  Reset
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  aria-label={preset.name}
                  aria-pressed={accentHex === preset.value}
                  onClick={() => setAccent(preset.value)}
                  className={cn(
                    "size-6 rounded-md ring-1 ring-foreground/10 outline-none transition hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                    accentHex === preset.value && "ring-2 ring-foreground/60",
                  )}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>
          </Field>

          <OptionSwitch
            id="opt-header"
            label="Event name and logo"
            description="Adds a small branded header above the widget."
            checked={showHeader}
            onChange={setShowHeader}
          />

          {format.id === "iframe" ? (
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
          ) : null}

          <Separator />

          <Field>
            <FieldLabel htmlFor="embed-name">Save this embed</FieldLabel>
            <FieldDescription>
              Name the configuration so you can come back to it — and so you
              can turn this embed off later without editing your website.
            </FieldDescription>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="embed-name"
                value={embedName}
                onChange={(event) => setEmbedName(event.target.value)}
                placeholder="Agenda for the sponsors page"
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                onClick={() => void handleSave()}
                disabled={saving || !activeEvent}
              >
                <RiSaveLine aria-hidden />
                {savedId ? "Update" : "Save"}
              </Button>
            </div>
            {savedId ? (
              <FieldDescription>
                Editing a saved embed.{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2"
                  onClick={() => {
                    setSavedId(null)
                    setEmbedName("")
                    setEnabled(true)
                  }}
                >
                  Save as new instead
                </button>
              </FieldDescription>
            ) : null}
          </Field>

          {savedId ? (
            <>
              <Separator />
              {/* The off switch, where the organizer is already looking after
                  saving. Turning it off makes every copy of this snippet — on
                  every site it was pasted into — say so instead of showing the
                  programme (sbek EMB-15). */}
              <OptionSwitch
                id="opt-enabled"
                label="Embed is live"
                description="Turn off to replace it with “This embed is turned off” everywhere it's pasted."
                checked={enabled}
                onChange={(next) => {
                  setEnabled(next)
                  void toggleEnabled({ embedId: savedId, enabled: next })
                    .then(() =>
                      toast.success(
                        next ? "Embed turned on" : "Embed turned off",
                      ),
                    )
                    .catch((error: unknown) => {
                      setEnabled(!next)
                      toast.error("Couldn't change that", {
                        description: errorMessage(error, "Please try again."),
                      })
                    })
                }}
              />
            </>
          ) : null}

          {program ? (
            <p className="text-xs text-muted-foreground">
              Showing live data: {program.totals.sessions} accepted{" "}
              {program.totals.sessions === 1 ? "session" : "sessions"} ·{" "}
              {program.totals.speakers}{" "}
              {program.totals.speakers === 1 ? "speaker" : "speakers"}.
              {program.publicMessage ? (
                <>
                  {" "}
                  <span className="font-medium text-status-amber-fg">
                    The schedule isn't published yet — publish it from the
                    Agenda so this embed shows sessions.
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <Tabs defaultValue={showPreview ? "preview" : "code"} className="gap-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <TabsList variant="line">
                {showPreview ? (
                  <TabsTrigger value="preview">
                    <RiEyeLine size={15} aria-hidden />
                    Preview
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="code">
                  <RiCodeSSlashLine size={15} aria-hidden />
                  Get code
                </TabsTrigger>
              </TabsList>
              {showPreview ? (
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
              ) : null}
            </div>

            {showPreview ? (
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
            ) : null}

            <TabsContent value="code" className="m-0 flex flex-col gap-5 p-5">
              <Field>
                <FieldLabel htmlFor="embed-snippet">
                  {deliverable.label}
                </FieldLabel>
                <FieldDescription>{deliverable.help}</FieldDescription>
                {format.id === "link" ||
                format.id === "json" ||
                format.id === "xml" ||
                format.id === "ics" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="embed-snippet"
                      readOnly
                      value={deliverable.value}
                      onFocus={(event) => event.currentTarget.select()}
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <CopyButton value={deliverable.value} label="Copy" />
                    {format.id === "link" ? (
                      <a
                        href={relativeUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "outline" })}
                      >
                        <RiExternalLinkLine aria-hidden />
                        Open
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <Textarea
                      id="embed-snippet"
                      readOnly
                      rows={format.id === "html" ? 14 : 8}
                      value={deliverable.value}
                      onFocus={(event) => event.currentTarget.select()}
                      className="font-mono text-xs"
                    />
                    <CopyButton
                      value={deliverable.value}
                      label={
                        format.id === "html" ? "Copy HTML" : "Copy embed code"
                      }
                      className="w-fit self-start"
                    />
                  </>
                )}
              </Field>

              {format.id === "iframe" ? (
                <>
                  <Separator />
                  <Field>
                    <FieldLabel htmlFor="embed-link">
                      Or share the direct link
                    </FieldLabel>
                    <FieldDescription>
                      The same widget as its own page — good for emails, Slack
                      and QR codes.
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
                      <a
                        href={relativeUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "outline" })}
                      >
                        <RiExternalLinkLine aria-hidden />
                        Open
                      </a>
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
        void copyText(value).then((ok) => {
          if (!ok) {
            toast.error("Couldn't copy — select the text instead")
            return
          }
          setCopied(true)
          toast.success("Copied to your clipboard")
          setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? <RiCheckLine aria-hidden /> : <RiFileCopyLine aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  )
}
