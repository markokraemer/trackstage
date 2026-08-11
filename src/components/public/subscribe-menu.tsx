import { RiCalendarCheckLine, RiDownload2Line, RiLinkM } from "@remixicon/react"
import { toast } from "sonner"

import { copyText } from "@/lib/clipboard"

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
import { icsFeedUrl, webcalFeedUrl } from "@/components/public/ics"

/**
 * "Add to calendar" for the *whole event* — the live `.ics` feed.
 *
 * Distinct from `AddToCalendarButton`, which downloads a snapshot of whatever
 * sessions are on screen. This one hands over the subscribe-able feed, so a
 * visitor's calendar keeps up when the organizer moves a room or a time. Three
 * routes to the same URL because calendar apps disagree about which one they
 * accept: `webcal://` (Apple/Outlook one-click), a plain download, and the raw
 * link to paste into Google Calendar's "From URL".
 *
 * Built on the shadcn `DropdownMenu` + `Button`.
 */
export interface SubscribeMenuProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  slug: string
  label?: string
}

export function SubscribeMenu({
  slug,
  label = "Add to calendar",
  variant = "outline",
  size = "sm",
  ...props
}: SubscribeMenuProps) {
  const feed = icsFeedUrl(slug)
  const webcal = webcalFeedUrl(slug)
  if (!feed || !webcal) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant={variant} size={size} {...props} />}
      >
        <RiCalendarCheckLine aria-hidden />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          Subscribe once and your calendar updates itself whenever the
          organizer changes the program.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<a href={webcal} />}
            aria-label="Subscribe in your calendar app"
          >
            <RiCalendarCheckLine aria-hidden />
            Subscribe in my calendar app
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={feed} download={`${slug}.ics`} />}>
            <RiDownload2Line aria-hidden />
            Download the .ics file
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void copyText(feed).then((ok) =>
                ok
                  ? toast.success("Calendar feed URL copied", {
                      description: feed,
                    })
                  : toast.error("We couldn't copy that automatically", {
                      description: feed,
                    }),
              )
            }}
          >
            <RiLinkM aria-hidden />
            Copy the feed URL
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
