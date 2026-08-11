import { createFileRoute } from "@tanstack/react-router"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { ProfileEditor } from "@/components/portal/profile-editor"
import { ProfileMeter } from "@/components/portal/profile-meter"
import { usePortal } from "@/components/portal/portal-context"
import { fullName, initialsOf } from "@/components/portal/portal-utils"

export const Route = createFileRoute("/portal/profile")({
  component: PortalProfilePage,
})

/**
 * Profile tab (docs/ux/03 image40): identity card, then General / Headshot /
 * My Links. What the speaker types here is exactly what the organizer sees on
 * their roster and what goes on the public programme.
 */
function PortalProfilePage() {
  const { home } = usePortal()
  const me = home.me

  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-14">
              {me.headshotUrl ? (
                <AvatarImage src={me.headshotUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-base">
                {initialsOf(me.firstName, me.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-heading truncate text-base font-semibold text-foreground">
                {fullName(me) || "Your profile"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {me.email}
              </p>
              {me.jobTitle || me.company ? (
                <p className="truncate text-sm text-muted-foreground">
                  {[me.jobTitle, me.company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          <ProfileMeter me={me} compact className="w-full sm:max-w-xs" />
        </CardContent>
      </Card>

      <ProfileEditor />
    </div>
  )
}
