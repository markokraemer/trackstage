import { Link, createFileRoute } from "@tanstack/react-router"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiKey2Line,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsLevelNav } from "@/components/shell/settings-level-nav"
import { ProfileCard } from "@/components/account/profile-card"
import { PasswordCard } from "@/components/account/password-card"
import { useSession } from "@/lib/session"

export const Route = createFileRoute("/app/account")({
  component: AccountSettingsPage,
})

/**
 * Account settings — the personal level of the hierarchy
 * (docs/memory/RULES.md 23b). Everything here is about *you*: it follows you
 * into every workspace and every event, and nothing here changes what your
 * teammates see in their own accounts.
 */
function AccountSettingsPage() {
  const { session, status } = useSession()

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <SettingsLevelNav level="account" />

        <PageHeader
          title="Account settings"
          description={
            session?.email
              ? `Your personal profile and sign-in for ${session.email}. Only you can see and change these.`
              : "Your personal profile and sign-in. Only you can see and change these."
          }
        />

        {status !== "authenticated" || !session ? (
          <Card>
            <CardContent className="gap-4 pt-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : (
          <>
            <ProfileCard
              key={session.email}
              name={session.name}
              email={session.email}
            />
            <PasswordCard />
            <ApiKeysCard />
            <WhereThingsLiveCard />
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * Personal API keys and the MCP connection live with the account, not with a
 * workspace or an event — the page itself is owned by the API slice
 * (docs/memory/RULES.md 21), so we point at it rather than duplicating it.
 */
function ApiKeysCard() {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiKey2Line size={18} aria-hidden className="text-primary" />
          API keys & MCP
        </CardTitle>
        <CardDescription>
          Keys are personal to you and act with your access. Use them to connect
          Claude, ChatGPT or Codex to Sessionboard, or to call the REST API.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/app/settings/api-mcp" />}
          >
            <RiKey2Line size={16} aria-hidden />
            Manage API keys & MCP
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The one-screen explanation of the hierarchy. Non-technical organizers should
 * never have to guess which level a setting belongs to.
 */
function WhereThingsLiveCard() {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Looking for something else?</CardTitle>
        <CardDescription>
          Your account is personal. Your team and your events are managed one
          level up.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3 pt-2 text-sm">
        <Link
          to="/app/workspace"
          className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
        >
          <RiBuilding2Line
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <span>
            <span className="block font-medium text-foreground">
              Workspace settings
            </span>
            <span className="block text-muted-foreground">
              Rename your workspace, invite teammates and set their roles.
            </span>
          </span>
        </Link>
        <Link
          to="/app/settings"
          className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
        >
          <RiCalendarEventLine
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <span>
            <span className="block font-medium text-foreground">
              Event settings
            </span>
            <span className="block text-muted-foreground">
              Dates, venue, public web address, rooms and tracks — for the event
              you're working on.
            </span>
          </span>
        </Link>
      </CardContent>
    </Card>
  )
}
