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
  RiInformationLine,
  RiRefreshLine,
  RiSaveLine,
  RiSmartphoneLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { widgetSearchToQuery } from "@/components/public/widget-search"
import { SavedEmbeds } from "@/components/embeds/saved-embeds"
import { OptionCard, OptionGroupLabel } from "@/components/embeds/option-card"
import {
  EMBED_FORMATS,
  FORMAT_GROUPS,
  WIDGET_GROUPS,
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
      activeSlug && widget.dataset === "speakers"
        ? { slug: activeSlug }
        : "skip",
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

  const trackSummary = tracks.length === 0 ? ALL_TRACKS : tracks.join(", ")

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
            session.room
              ? `      <span>${escapeHtml(session.room.name)}</span>`
              : null,
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

  /**
   * What step 4 hands over, per format. `where` is the "what do I paste where"
   * line — the single sentence that turns a box of code into an instruction,
   * for an organizer who has never touched an embed before.
   */
  const deliverable: {
    value: string
    label: string
    help: string
    where: string
    /** URL formats get a select-one-line input; code formats get a block. */
    kind: "url" | "code"
  } = (() => {
    switch (format.id) {
      case "link":
        return {
          value: publicUrl,
          label: "Your link",
          kind: "url",
          help: "The widget as its own page, always up to date.",
          where:
            "Paste it anywhere a link goes — your newsletter, a Slack message, or behind a QR code on your signage.",
        }
      case "html":
        return {
          value: htmlSnippet,
          label: "Your markup",
          kind: "code",
          help: "Unstyled HTML you can restyle to match your site.",
          where:
            "Paste into an HTML block on your page. This is a snapshot of the programme right now — copy it again after you change the schedule.",
        }
      case "json":
        return {
          value: jsonUrl ?? "",
          label: "Your REST endpoint",
          kind: "url",
          help: "Returns paginated JSON of this event.",
          where:
            "Send this to whoever builds your site, together with an API key from Settings → API & MCP (it goes in an Authorization: Bearer header).",
        }
      case "xml":
        return {
          value: xmlFeedUrl ?? "",
          label: "Your XML feed",
          kind: "url",
          help: "A live XML document of the published programme. No key needed.",
          where:
            "Paste it into your CMS or site builder's feed importer — it re-reads the programme on its own.",
        }
      case "ics":
        return {
          value: icsFeedUrl ?? "",
          label: "Your calendar feed",
          kind: "url",
          help: "A subscribe-able .ics of the whole programme. No key needed.",
          where:
            "Share it with attendees, or add it under “Subscribe by URL” in Google, Outlook or Apple Calendar.",
        }
      default:
        return {
          value: iframeSnippet,
          label: "Your embed code",
          kind: "code",
          help: "One snippet, always showing live data.",
          where:
            "In your site builder, add an Embed / Custom HTML block where you want the widget and paste this in. Webflow, Wix, Squarespace and WordPress all have one.",
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
        description: errorMessage(error, "Please try again."),
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

  /**
   * Which of step 3's controls actually reach the chosen format. A JSON or
   * calendar feed carries the whole published programme and has no appearance
   * at all, so its knobs are hidden rather than sitting there doing nothing —
   * a switch that changes nothing is worse than no switch.
   */
  const applies = {
    /** Descriptions and speaker names — present in the static HTML too. */
    layout: showPreview || format.id === "html",
    /** Photos and in-widget search only exist in a rendered widget. */
    interactive: showPreview,
    branding: showPreview,
    height: format.id === "iframe",
    tracks: format.id !== "json" && format.id !== "ics",
  }
  const configurable = applies.layout || applies.tracks

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
      <section className="flex flex-col gap-4">
        <StepHeading
          step={1}
          title="Choose a widget"
          description="Each one is a live view of this event — it updates itself whenever you change the program. No re-publishing."
        />
        {WIDGET_GROUPS.map((group) => (
          <div key={group.dataset} className="flex flex-col gap-2">
            <OptionGroupLabel label={group.label} />
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {WIDGET_TYPES.filter(
                (type) => type.dataset === group.dataset,
              ).map((type) => (
                <li key={type.id}>
                  <OptionCard
                    icon={type.icon}
                    name={type.name}
                    description={type.description}
                    selected={type.id === widget.id}
                    onSelect={() => setWidgetId(type.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* 2 — pick a delivery format */}
      <section className="flex flex-col gap-4">
        <StepHeading
          step={2}
          title="Choose a format"
          description="How you want to take it away. Most organizers want the embedded widget."
        />
        {FORMAT_GROUPS.map((group) => (
          <div key={group.group} className="flex flex-col gap-2">
            <OptionGroupLabel label={group.label} hint={group.hint} />
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {EMBED_FORMATS.filter(
                (option) => option.group === group.group,
              ).map((option) => (
                <li key={option.id}>
                  <OptionCard
                    icon={option.icon}
                    name={option.name}
                    description={option.description}
                    selected={option.id === format.id}
                    onSelect={() => setFormatId(option.id)}
                    badge={
                      option.recommended ? (
                        <Badge variant="secondary">Recommended</Badge>
                      ) : option.snapshot ? (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Snapshot
                        </Badge>
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* 3 — configure · 4 — copy + preview */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card className="h-fit gap-5 p-5">
          <StepHeading step={3} title="Choose what shows" />

          {configurable ? null : (
            <p className="text-sm text-muted-foreground">
              The {format.name.toLowerCase()} carries the whole published
              programme, so there's nothing to configure. Name it below if you
              want to come back to it.
            </p>
          )}

          {applies.layout ? (
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
              {applies.interactive ? (
                <>
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
                </>
              ) : null}
            </div>
          ) : null}

          {applies.layout && applies.tracks ? <Separator /> : null}

          {/* Which tracks — several, not one: a sponsor page often covers two
              rooms of a conference, and picking them one at a time meant two
              embeds where one would do. Nothing ticked = the whole program. */}
          {applies.tracks ? (
            <Field>
              <FieldLabel>Tracks to include</FieldLabel>
              <FieldDescription>
                Leave everything unticked to show the whole program, or pick the
                tracks this page is about.
              </FieldDescription>
              {(program?.tracks ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This event has no tracks yet — add them under Settings →
                  Event.
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
          ) : null}

          {applies.branding ? (
            <>
              <Separator />

              {/* Branding — the widget lives on somebody else's page and should
              look like it belongs there. Colour repaints links and buttons
              only; the surfaces stay neutral so it never fights the host. */}
              <Field>
                <FieldLabel htmlFor="opt-accent">Accent colour</FieldLabel>
                <FieldDescription>
                  Used for links and buttons inside the widget. Leave empty to
                  use the Trackstage blue.
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccent("")}
                    >
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
                        "size-8 rounded-md ring-1 ring-foreground/10 transition outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                        accentHex === preset.value &&
                          "ring-2 ring-foreground/60",
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
            </>
          ) : null}

          {applies.height ? (
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
              Name the configuration so you can come back to it — and so you can
              turn this embed off later without editing your website.
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

        {/* The deliverable sits above the preview and outside any tab. It used
            to live behind a "Get code" tab that was not the default one, so
            the page's whole reason to exist — the snippet and the Copy button
            — was one click out of sight. */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-4 p-5">
            <div className="flex flex-col gap-2.5">
              <StepHeading
                step={4}
                title="Copy the code"
                description={deliverable.help}
              />
              {/* What the snippet below currently reflects — so a change made
                  in steps 1–3 is visibly connected to the code. */}
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Showing:</span>
                {[
                  widget.name,
                  format.name,
                  ...(applies.tracks ? [trackSummary] : []),
                ].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </p>
            </div>

            <Field>
              <FieldLabel htmlFor="embed-snippet">
                {deliverable.label}
              </FieldLabel>
              {deliverable.kind === "url" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="embed-snippet"
                    readOnly
                    value={deliverable.value}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 font-mono text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <CopyButton
                      value={deliverable.value}
                      label="Copy link"
                      className="flex-1 sm:flex-none"
                    />
                    {format.id === "link" ? (
                      <a
                        href={relativeUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({
                          variant: "outline",
                          size: "lg",
                        })}
                      >
                        <RiExternalLinkLine aria-hidden />
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <Textarea
                    id="embed-snippet"
                    readOnly
                    rows={format.id === "html" ? 12 : 8}
                    value={deliverable.value}
                    onFocus={(event) => event.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <CopyButton
                    value={deliverable.value}
                    label={format.id === "html" ? "Copy HTML" : "Copy code"}
                    className="w-full sm:w-fit sm:self-start"
                  />
                </>
              )}
            </Field>

            {/* "What do I paste where" — the sentence a first-time organizer
                actually needs, next to the thing they just copied. */}
            <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <RiInformationLine
                size={15}
                aria-hidden
                className="mt-px shrink-0"
              />
              <span>
                <span className="font-medium text-foreground">
                  Where this goes:{" "}
                </span>
                {deliverable.where}
              </span>
            </p>

            {format.id === "iframe" ? (
              <>
                <Separator />
                <Field>
                  <FieldLabel htmlFor="embed-link">
                    Or share the direct link
                  </FieldLabel>
                  <FieldDescription>
                    The same widget as its own page — good for emails, Slack and
                    QR codes.
                  </FieldDescription>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="embed-link"
                      readOnly
                      value={publicUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <CopyButton
                        value={publicUrl}
                        label="Copy link"
                        variant="outline"
                        className="flex-1 sm:flex-none"
                      />
                      <a
                        href={relativeUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({
                          variant: "outline",
                          size: "lg",
                        })}
                      >
                        <RiExternalLinkLine aria-hidden />
                        Open
                      </a>
                    </div>
                  </div>
                </Field>
              </>
            ) : null}
          </Card>

          {showPreview ? (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <p className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
                  <RiEyeLine
                    size={15}
                    aria-hidden
                    className="text-muted-foreground"
                  />
                  Live preview
                </p>
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
              <div className="bg-muted/40 p-4">
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
                      style={{ height: Math.min(height, 560) }}
                    />
                  </div>
                ) : (
                  <Skeleton className="h-[420px] w-full" />
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  )
}

/**
 * The numbered step marker. The four steps used to be plain "1." prefixes that
 * disappeared into the headings; the dark disc is the same one the form-builder
 * wizard uses for its active step, so the page reads as a sequence.
 */
function StepHeading({
  step,
  title,
  description,
}: {
  step: number
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background"
      >
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
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

/**
 * Copying is the point of this page, so the button is the primary blue one and
 * 44px tall — and it says "Copied" in place for two seconds on top of the toast,
 * because a toast that has already faded is not a confirmation.
 */
function CopyButton({
  value,
  label,
  className,
  variant = "default",
}: {
  value: string
  label: string
  className?: string
  variant?: "default" | "outline"
}) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      variant={variant}
      size="lg"
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
