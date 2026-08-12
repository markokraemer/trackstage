import {
  RiArrowDownSLine,
  RiCalendarCheckLine,
  RiDownload2Line,
  RiLinkM,
} from "@remixicon/react"
import { toast } from "sonner"

import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AppleGlyph,
  GoogleGlyph,
  MicrosoftGlyph,
} from "@/components/shared/calendar-glyphs"
import {
  buildIcsFor,
  calendarFilename,
  downloadIcsFile,
  googleCalendarUrl,
  googleFeedUrl,
  outlookFeedUrl,
  outlookLiveUrl,
  outlookOfficeUrl,
  webcalOf,
} from "@/components/shared/calendar-links"
import type { CalendarItem } from "@/components/shared/calendar-links"
import { formatWhen } from "@/components/public/format"

/**
 * The one "Add to calendar" control, used on every surface that shows a dated
 * session: public schedule and session pages, the speaker portal, the organizer
 * agenda and submission drawers, and the embeddable widgets.
 *
 * Three shapes fall out of the props, so callers never pick a variant:
 *
 * - **One session** → Google / Outlook / Apple, each a single click that opens
 *   the provider already prefilled (see `calendar-links.ts`).
 * - **Several sessions** → a provider compose URL only holds one event, so this
 *   offers the `.ics` file, plus one-click *subscribe* when a feed exists.
 * - **No sessions, just a feed** → subscribe only. This is the whole-program
 *   control in the public header: subscribe once and the visitor's calendar
 *   follows every room and time change the organizer makes afterwards.
 *
 * Undated items are filtered out; when nothing is left the button explains
 * itself as disabled rather than disappearing, unless `hideWhenEmpty` is set.
 */
export interface AddToCalendarProps
  extends Omit<React.ComponentProps<typeof Button>, "children" | "onClick"> {
  /** Dated items. Anything without a start time is ignored. */
  items?: Array<CalendarItem>
  /** Live `.ics` feed (https). Enables the one-click subscribe entries. */
  feedUrl?: string | null
  /** Calendar name for the `.ics` and the subscribe entries. */
  calendarName?: string
  /** IANA zone of the event — display only (see `calendar-links.ts`). */
  timezone?: string
  /** Download filename, without the extension. */
  filename?: string
  label?: string
  /** Square icon-only trigger for dense rows and embedded widgets. */
  iconOnly?: boolean
  /** Render nothing at all when there is neither a dated item nor a feed. */
  hideWhenEmpty?: boolean
  align?: "start" | "center" | "end"
}

/** Menu rows are touch targets first: 44px on phones, compact on the desktop. */
const ITEM = "min-h-11 gap-2.5 sm:min-h-8"

export function AddToCalendar({
  items = [],
  feedUrl = null,
  calendarName,
  timezone,
  filename,
  label = "Add to calendar",
  iconOnly = false,
  hideWhenEmpty = false,
  align = "end",
  variant = "outline",
  size = "sm",
  className,
  ...props
}: AddToCalendarProps) {
  const dated = items.filter((item) => Number.isFinite(item.startsAt))
  const single = dated.length === 1 ? dated[0] : null
  const webcal = webcalOf(feedUrl)
  const name = calendarName ?? single?.title ?? "Schedule"

  if (dated.length === 0 && !feedUrl) {
    if (hideWhenEmpty) return null
    return (
      <Button
        variant={variant}
        size={iconOnly ? "icon-sm" : size}
        disabled
        aria-label={iconOnly ? label : undefined}
        title="No time on the schedule yet — check back once the organizer publishes it"
        className={className}
        {...props}
      >
        <RiCalendarCheckLine aria-hidden />
        {iconOnly ? null : label}
      </Button>
    )
  }

  function downloadFile() {
    const contents = buildIcsFor(dated, { name, timezone })
    downloadIcsFile(`${calendarFilename(filename ?? name)}.ics`, contents)
    toast.success(
      single ? `"${single.title}" added` : `${dated.length} sessions downloaded`,
      {
        description: single
          ? timezone
            ? formatWhen(single.startsAt, single.endsAt, timezone)
            : "Open the file to add it to your calendar."
          : "Open the .ics file to add every session at once.",
      },
    )
  }

  function copyFeed() {
    if (!feedUrl) return
    void copyText(feedUrl).then((ok) =>
      ok
        ? toast.success("Calendar feed URL copied", { description: feedUrl })
        : toast.error("We couldn't copy that automatically", {
            description: feedUrl,
          }),
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size={iconOnly ? "icon-sm" : size}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            className={className}
            {...props}
          />
        }
      >
        <RiCalendarCheckLine aria-hidden />
        {iconOnly ? null : (
          <>
            {label}
            <RiArrowDownSLine
              aria-hidden
              data-icon="inline-end"
              className="text-muted-foreground"
            />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72">
        {single ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-foreground">
                {single.title}
              </span>
              {timezone ? (
                <span className="block text-muted-foreground">
                  {formatWhen(single.startsAt, single.endsAt, timezone)}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <ProviderLink
                href={googleCalendarUrl(single)}
                icon={<GoogleGlyph />}
                label="Google Calendar"
              />
              <ProviderLink
                href={outlookLiveUrl(single)}
                icon={<MicrosoftGlyph />}
                label="Outlook.com"
              />
              <ProviderLink
                href={outlookOfficeUrl(single)}
                icon={<MicrosoftGlyph />}
                label="Outlook (work or school)"
              />
              <DropdownMenuItem className={ITEM} onClick={downloadFile}>
                <AppleGlyph className="text-foreground" />
                Apple Calendar &amp; others
                <span className="ml-auto text-xs text-muted-foreground">
                  .ics
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}

        {dated.length > 1 ? (
          <>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {dated.length} sessions — one file your calendar imports in a
              single step.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM} onClick={downloadFile}>
              <RiDownload2Line aria-hidden />
              Download all {dated.length}
              <span className="ml-auto text-xs text-muted-foreground">.ics</span>
            </DropdownMenuItem>
          </>
        ) : null}

        {feedUrl && webcal ? (
          <>
            {dated.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              Subscribe and your calendar updates itself whenever the organizer
              changes the program.
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <ProviderLink
                href={googleFeedUrl(webcal)}
                icon={<GoogleGlyph />}
                label="Subscribe in Google"
              />
              <ProviderLink
                href={outlookFeedUrl("outlook.live.com", feedUrl, name)}
                icon={<MicrosoftGlyph />}
                label="Subscribe in Outlook.com"
              />
              <ProviderLink
                href={outlookFeedUrl("outlook.office.com", feedUrl, name)}
                icon={<MicrosoftGlyph />}
                label="Subscribe in Outlook (work)"
              />
              <ProviderLink
                href={webcal}
                newTab={false}
                icon={<AppleGlyph className="text-foreground" />}
                label="Subscribe in Apple Calendar"
              />
              <DropdownMenuItem className={ITEM} onClick={copyFeed}>
                <RiLinkM aria-hidden />
                Copy the feed URL
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A menu row that is a real anchor — middle-click, long-press and "open in new
 * tab" all behave, which matters because these hand off to another site.
 */
function ProviderLink({
  href,
  icon,
  label,
  newTab = true,
}: {
  href: string
  icon: React.ReactNode
  label: string
  newTab?: boolean
}) {
  return (
    <DropdownMenuItem
      className={cn(ITEM, "cursor-pointer")}
      render={
        <a
          href={href}
          {...(newTab
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        />
      }
    >
      {icon}
      {label}
    </DropdownMenuItem>
  )
}
