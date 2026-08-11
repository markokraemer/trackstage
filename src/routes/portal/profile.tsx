import { createFileRoute } from "@tanstack/react-router"
import { RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { ProfileEditor } from "@/components/portal/profile-editor"
import { usePortal } from "@/components/portal/portal-context"
import {
  fullName,
  initialsOf,
  profileCompleteness,
} from "@/components/portal/portal-utils"

export const Route = createFileRoute("/portal/profile")({
  component: PortalProfilePage,
})

/**
 * Profile tab (docs/ux/03 image40): identity header, then General / Headshot /
 * My Links. What the speaker types here is exactly what the organizer sees on
 * their roster and what goes on the public programme.
 */
function PortalProfilePage() {
  const { home } = usePortal()
  const me = home.me
  const completeness = profileCompleteness(me)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16 ring-1 ring-border">
          {me.headshotUrl ? <AvatarImage src={me.headshotUrl} alt="" /> : null}
          <AvatarFallback className="text-lg">
            {initialsOf(me.firstName, me.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-heading truncate text-2xl font-semibold tracking-tight text-foreground">
            {fullName(me) || "Your profile"}
          </h1>
          <a
            href={`mailto:${me.email}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {me.email}
          </a>
        </div>

        <div className="ml-auto w-full max-w-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              Profile {completeness.percent}% complete
            </span>
            <span className="text-muted-foreground">
              {completeness.done} of {completeness.total}
            </span>
          </div>
          <Progress
            value={completeness.percent}
            className="mt-1.5"
            aria-label="Profile completeness"
          />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {completeness.items.map((item) => (
              <li
                key={item.key}
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  item.done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-full",
                    item.done
                      ? "bg-status-green-bg text-status-green-fg"
                      : "border border-dashed border-border",
                  )}
                >
                  {item.done ? <RiCheckLine size={9} /> : null}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ProfileEditor />
    </div>
  )
}
