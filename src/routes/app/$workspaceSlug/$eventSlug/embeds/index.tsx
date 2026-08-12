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
  RiFileCopyLine,
  RiInformationLine,
  RiRefreshLine,
  RiSaveLine,
  RiSmartphoneLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { widgetSearchToQuery } from "@/components/public/widget-search"
import { SavedEmbeds } from "@/components/embeds/saved-embeds"
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
import { apiBaseUrl } from "@/lib/deployment-urls"
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
 *
 * LAYOUT (Marko, 2026-08-12): it is a *builder*, not a wizard. The four
 * numbered steps — choose a widget, choose a format, choose what shows, copy
 * the code — pushed the one thing worth looking at, the widget itself, two
 * screens below the fold: "I should directly see the WIDGET when I'm on the
 * page but I see all this other shit." So every control moved into a 320px
 * left rail and the whole right side is the live preview, with a
 * Preview | Code segmented switch at its top. Same capabilities, no steps.
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
  /** Which face of the right pane is showing. */
  const [pane, setPane] = useState<"preview" | "code">("preview")

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
    if (!activeSlug) return null
    return `${apiBaseUrl()}/v1/event/${activeSlug}`
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
   * What the Code pane hands over, per format. `where` is the "what do I paste
   * where" line — the single sentence that turns a box of code into an
   * instruction, for an organizer who has never touched an embed before.
   */
  const deliverable: {
    value: string
    label: string
    where: string
    /** URL formats get a one-line row; code formats get a block. */
    kind: "url" | "code"
  } = (() => {
    switch (format.id) {
      case "link":
        return {
          value: publicUrl,
          label: "Your link",
          kind: "url",
          where:
            "Paste it anywhere a link goes — your newsletter, a Slack message, or behind a QR code on your signage.",
        }
      case "html":
        return {
          value: htmlSnippet,
          label: "Your markup",
          kind: "code",
          where:
            "Paste into an HTML block on your page. This is a snapshot of the programme right now — copy it again after you change the schedule.",
        }
      case "json":
        return {
          value: jsonUrl ?? "",
          label: "Your REST endpoint",
          kind: "url",
          where:
            "Send this to whoever builds your site, together with an API key from Settings → API & MCP (it goes in an Authorization: Bearer header).",
        }
      case "xml":
        return {
          value: xmlFeedUrl ?? "",
          label: "Your XML feed",
          kind: "url",
          where:
            "Paste it into your CMS or site builder's feed importer — it re-reads the programme on its own.",
        }
      case "ics":
        return {
          value: icsFeedUrl ?? "",
          label: "Your calendar feed",
          kind: "url",
          where:
            "Share it with attendees, or add it under “Subscribe by URL” in Google, Outlook or Apple Calendar.",
        }
      default:
        return {
          value: iframeSnippet,
          label: "Your embed code",
          kind: "code",
          where:
            "In your site builder, add an Embed / Custom HTML block where you want the widget and paste this in. Webflow, Wix, Squarespace and WordPress all have one.",
        }
    }
  })()

  /**
   * Which controls actually reach the chosen format. A JSON or calendar feed
   * carries the whole published programme and has no appearance at all, so its
   * knobs are hidden rather than sitting there doing nothing — a switch that
   * changes nothing is worse than no switch.
   */
  const applies = {
    /** Descriptions and speaker names — present in the static HTML too. */
    layout:
      format.id === "iframe" || format.id === "link" || format.id === "html",
    /** Photos and in-widget search only exist in a rendered widget. */
    interactive: format.id === "iframe" || format.id === "link",
    branding: format.id === "iframe" || format.id === "link",
    height: format.id === "iframe",
    tracks: format.id !== "json" && format.id !== "ics",
  }

  /**
   * Feeds are data, not pictures — there is nothing to render for them, so the
   * pane opens on the code instead of an empty frame. Everything else lands on
   * the widget, which is the whole point of the screen.
   */
  const hasVisualPreview =
    format.id === "iframe" || format.id === "link" || format.id === "html"
  useEffect(() => {
    setPane(hasVisualPreview ? "preview" : "code")
  }, [hasVisualPreview])

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
        description: "It's in your saved embeds at the top of the panel.",
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

  const previewHeight = Math.min(Math.max(height, 320), 760)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Embeds"
        description="Put your agenda, sessions or speakers on your own website. Everything you pick shows up in the preview straight away."
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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ——— Left rail: every control, top to bottom ——————————————— */}
        <Card
          className="gap-0 divide-y divide-border p-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto"
          size="sm"
        >
          <SavedEmbeds
            embeds={embedsQuery.data}
            activeId={savedId}
            onLoad={loadSaved}
            loading={Boolean(activeEvent) && embedsQuery.isPending}
          />

          <RailSection label="Widget">
            <Select
              value={widgetId}
              onValueChange={(value) => setWidgetId(String(value ?? ""))}
            >
              <SelectTrigger
                id="embed-widget"
                aria-label="Widget"
                className="w-full"
              >
                <widget.icon
                  size={16}
                  aria-hidden
                  className="text-muted-foreground"
                />
                {/* Base UI renders the raw value unless it is given the label. */}
                <SelectValue>{widget.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WIDGET_GROUPS.map((group) => (
                  <SelectGroup key={group.dataset}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {WIDGET_TYPES.filter(
                      (type) => type.dataset === group.dataset,
                    ).map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {widget.description}
            </p>
          </RailSection>

          <RailSection label="Format">
            <Select
              value={formatId}
              onValueChange={(value) => setFormatId(String(value ?? ""))}
            >
              <SelectTrigger
                id="embed-format"
                aria-label="Format"
                className="w-full"
              >
                <format.icon
                  size={16}
                  aria-hidden
                  className="text-muted-foreground"
                />
                <SelectValue>{format.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FORMAT_GROUPS.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {EMBED_FORMATS.filter(
                      (option) => option.group === group.group,
                    ).map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                        {option.recommended ? " — recommended" : ""}
                        {option.snapshot ? " — snapshot" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {format.description}
            </p>
          </RailSection>

          {applies.layout ? (
            <RailSection label="What shows">
              <SwitchRow
                id="opt-descriptions"
                label="Session descriptions"
                checked={showDescriptions}
                onChange={setShowDescriptions}
              />
              <SwitchRow
                id="opt-speakers"
                label="Speakers on cards"
                checked={showSpeakers}
                onChange={setShowSpeakers}
              />
              {applies.interactive ? (
                <>
                  <SwitchRow
                    id="opt-photos"
                    label="Speaker photos"
                    checked={showPhotos}
                    onChange={setShowPhotos}
                  />
                  <SwitchRow
                    id="opt-search"
                    label="Search and filters"
                    checked={showSearch}
                    onChange={setShowSearch}
                  />
                </>
              ) : null}
            </RailSection>
          ) : null}

          {/* Which tracks — several, not one: a sponsor page often covers two
              rooms of a conference, and picking them one at a time meant two
              embeds where one would do. Nothing ticked = the whole program. */}
          {applies.tracks ? (
            <RailSection
              label="Tracks"
              hint="Nothing ticked shows the whole programme."
            >
              {(program?.tracks ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This event has no tracks yet — add them under Settings →
                  Event.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={tracks.length === 0}
                      onCheckedChange={() => setTracks([])}
                    />
                    {ALL_TRACKS}
                  </label>
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
              )}
            </RailSection>
          ) : null}

          {/* Branding — the widget lives on somebody else's page and should
              look like it belongs there. Colour repaints links and buttons
              only; the surfaces stay neutral so it never fights the host. */}
          {applies.branding ? (
            <RailSection label="Appearance">
              <Label
                htmlFor="opt-accent"
                className="text-sm font-normal text-foreground"
              >
                Accent colour
              </Label>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-9 shrink-0 rounded-lg ring-1 ring-foreground/10"
                  style={{ backgroundColor: accentHex || "var(--primary)" }}
                />
                <Input
                  id="opt-accent"
                  value={accent}
                  onChange={(event) => setAccent(event.target.value)}
                  placeholder="#2F5CE0"
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
                      "size-7 rounded-md ring-1 ring-foreground/10 transition outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                      accentHex === preset.value && "ring-2 ring-foreground/60",
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>
              <SwitchRow
                id="opt-header"
                label="Event name and logo"
                checked={showHeader}
                onChange={setShowHeader}
              />
              {applies.height ? (
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="opt-height"
                    className="text-sm font-normal text-foreground"
                  >
                    Height on your site
                  </Label>
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
                    className="w-24"
                  />
                </div>
              ) : null}
            </RailSection>
          ) : null}

          <RailSection
            label={savedId ? "Saved embed" : "Save this embed"}
            hint={
              savedId
                ? undefined
                : "Name it to come back to it — and to be able to turn it off later without editing your website."
            }
          >
            <div className="flex items-center gap-2">
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
              <>
                {/* The off switch, where the organizer is already looking after
                    saving. Turning it off makes every copy of this snippet — on
                    every site it was pasted into — say so instead of showing
                    the programme (sbek EMB-15). */}
                <SwitchRow
                  id="opt-enabled"
                  label="Embed is live"
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
                <p className="text-xs text-muted-foreground">
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
                </p>
              </>
            ) : null}
          </RailSection>
        </Card>

        {/* ——— Right pane: the widget itself ————————————————————————— */}
        <Card className="min-w-0 gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div
              role="group"
              aria-label="Preview or code"
              className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
            >
              <PaneTab
                active={pane === "preview"}
                disabled={!hasVisualPreview}
                onClick={() => setPane("preview")}
              >
                Preview
              </PaneTab>
              <PaneTab active={pane === "code"} onClick={() => setPane("code")}>
                Code
              </PaneTab>
            </div>

            {pane === "preview" ? (
              <div className="flex items-center gap-1">
                <Button
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Desktop preview"
                  aria-pressed={device === "desktop"}
                  onClick={() => setDevice("desktop")}
                >
                  <RiComputerLine aria-hidden />
                </Button>
                <Button
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Mobile preview"
                  aria-pressed={device === "mobile"}
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
            ) : (
              <CopyButton
                value={deliverable.value}
                label={deliverable.kind === "url" ? "Copy link" : "Copy code"}
              />
            )}
          </div>

          {pane === "preview" ? (
            <div className="bg-muted/40 p-3">
              {!activeSlug ? (
                <Skeleton className="h-[420px] w-full" />
              ) : format.id === "html" ? (
                // The static export is a snapshot of unstyled markup — so the
                // honest preview is that markup rendered, not the widget.
                <div className="mx-auto max-w-full overflow-hidden rounded-xl bg-card ring-1 ring-border">
                  <iframe
                    key={`html-${refreshKey}`}
                    title="Static HTML preview"
                    srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;font:14px/1.6 system-ui,sans-serif;color:#17171A">${htmlSnippet}</body>`}
                    sandbox=""
                    className="block w-full bg-background"
                    style={{ height: previewHeight }}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "mx-auto overflow-hidden rounded-xl bg-card ring-1 ring-border transition-[max-width]",
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
                    style={{ height: previewHeight }}
                  />
                </div>
              )}
              {program ? (
                <p className="pt-3 text-center text-xs text-muted-foreground">
                  Live data: {program.totals.sessions} accepted{" "}
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
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {deliverable.label}
              </p>

              {deliverable.kind === "url" ? (
                <UrlRow url={deliverable.value} />
              ) : (
                <pre className="max-h-[440px] overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground select-all">
                  <code>{deliverable.value}</code>
                </pre>
              )}

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
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Or share the direct link
                  </p>
                  <UrlRow url={publicUrl} />
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/** One block of controls in the left rail. */
function RailSection({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5 px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </h2>
        {hint ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** Label + switch, one line. The preview is the explanation. */
function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal text-foreground">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(Boolean(next))}
      />
    </div>
  )
}

/** One half of the Preview | Code switch at the top of the right pane. */
function PaneTab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-card text-foreground ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
      )}
    >
      {children}
    </button>
  )
}

/**
 * A URL as an affordance rather than a fact — the compact row the copilot's
 * shared views use: the URL in truncated monospace, quiet icon buttons for copy
 * and open. The full-width input with a 44px Copy button beside it was the
 * biggest control on the page for its least interesting content.
 */
function UrlRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex h-10 items-center gap-1 rounded-lg border border-border bg-muted/40 pr-1 pl-2.5">
      <code
        title={url}
        className="min-w-0 flex-1 truncate font-mono text-xs text-foreground select-all"
      >
        {url}
      </code>
      <button
        type="button"
        aria-label="Copy link"
        title="Copy link"
        onClick={() => {
          void copyText(url).then((ok) => {
            if (!ok) {
              toast.error("Couldn't copy — select the text instead")
              return
            }
            setCopied(true)
            toast.success("Copied to your clipboard")
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {copied ? (
          <RiCheckLine size={14} aria-hidden className="text-status-green-fg" />
        ) : (
          <RiFileCopyLine size={14} aria-hidden />
        )}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Open"
        title="Open"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <RiExternalLinkLine size={14} aria-hidden />
      </a>
    </div>
  )
}

/**
 * Copying is the point of this page, so the button is the primary blue one —
 * and it says "Copied" in place for two seconds on top of the toast, because a
 * toast that has already faded is not a confirmation.
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
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
