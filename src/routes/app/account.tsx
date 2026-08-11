import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import {
  RiKey2Line,
  RiShieldKeyholeLine,
  RiUserSettingsLine,
} from "@remixicon/react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsLevelNav } from "@/components/shell/settings-level-nav"
import { appLink } from "@/lib/app-links"
import { ProfileCard } from "@/components/account/profile-card"
import { PasswordCard } from "@/components/account/password-card"
import type { CreatedApiKey } from "@/components/settings/api-keys-card"
import { ApiKeysCard } from "@/components/settings/api-keys-card"
import { McpConnectCard } from "@/components/settings/mcp-connect-card"
import { McpCapabilitiesCard } from "@/components/settings/mcp-capabilities-card"
import { RestApiCard } from "@/components/settings/rest-api-card"
import { useSession } from "@/lib/session"

const ACCOUNT_TABS = ["profile", "security", "api-mcp"] as const
type AccountTab = (typeof ACCOUNT_TABS)[number]

function isAccountTab(value: unknown): value is AccountTab {
  return (
    typeof value === "string" &&
    (ACCOUNT_TABS as readonly string[]).includes(value)
  )
}

interface AccountSearch {
  /** Which section is open. Absent ⇒ Profile, so `/app/account` stays clean. */
  tab?: AccountTab
}

export const Route = createFileRoute("/app/account")({
  // Returning `{}` rather than `{ tab: undefined }` keeps `search` OPTIONAL on
  // every `<Link to="/app/account">` in the app — with the key always present,
  // TanStack types it as required and each plain link fails to typecheck.
  validateSearch: (search: Record<string, unknown>): AccountSearch =>
    isAccountTab(search.tab) ? { tab: search.tab } : {},
  component: AccountSettingsPage,
})

/**
 * Account settings — the TOP level of the hierarchy (docs/memory/RULES.md 23b):
 * you, personally. Everything here follows your login into whatever workspace
 * or event you happen to open; nothing on this page belongs to a team.
 *
 * It is a full PAGE, matching Workspace and Event settings exactly — same
 * SettingsLevelNav, same PageHeader, same tab strip — so the three levels read
 * as one system with three floors rather than three different mechanisms.
 * The tab lives in the URL (`/app/account?tab=api-mcp`) so it is deep-linkable
 * from the docs, the eval kit, and the old `/app/settings/api-mcp` redirect.
 */
function AccountSettingsPage() {
  const navigate = Route.useNavigate()
  const { tab } = Route.useSearch()
  const { session, status } = useSession()
  const active: AccountTab = tab ?? "profile"

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <SettingsLevelNav level="account" />

        <PageHeader
          title={
            session?.email
              ? `Account settings — ${session.email}`
              : "Account settings"
          }
          description="Your personal profile, sign-in and API access. Only you can see and change these — they follow you into every workspace and event."
        >
          <Tabs
            value={active}
            onValueChange={(value) => {
              if (!isAccountTab(value)) return
              void navigate({
                search: { tab: value === "profile" ? undefined : value },
                replace: true,
              })
            }}
          >
            <TabsList variant="line" className="h-auto flex-wrap">
              <TabsTrigger value="profile" className="gap-1.5">
                <RiUserSettingsLine size={15} aria-hidden />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-1.5">
                <RiShieldKeyholeLine size={15} aria-hidden />
                Security
              </TabsTrigger>
              <TabsTrigger value="api-mcp" className="gap-1.5">
                <RiKey2Line size={15} aria-hidden />
                API &amp; MCP
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </PageHeader>

        {status !== "authenticated" || !session ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Tabs value={active}>
            <TabsContent value="profile" className="flex flex-col gap-6">
              <ProfileCard
                key={session.email}
                name={session.name}
                email={session.email}
              />
              <LevelsCard />
            </TabsContent>

            <TabsContent value="security" className="flex flex-col gap-6">
              <PasswordCard />
            </TabsContent>

            <TabsContent value="api-mcp">
              <ApiMcpPanel />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * API keys & MCP — personal credentials, so they live at the account level and
 * not on the old `/app/settings/api-mcp` event page (docs/memory/RULES.md 21 +
 * 23b). A key resolves to YOU and then runs through the same membership and
 * event-scope checks your browser session does.
 */
function ApiMcpPanel() {
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <ApiKeysCard
        createdKey={createdKey}
        onCreated={setCreatedKey}
        onDismissCreated={() => setCreatedKey(null)}
      />
      <McpConnectCard apiKey={createdKey?.key ?? null} />
      <McpCapabilitiesCard />
      <RestApiCard />
    </div>
  )
}

/** Says, in one sentence, what belongs here versus one level down. */
function LevelsCard() {
  return (
    <Link
      to={appLink.workspaceHubFallback}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm transition-colors hover:bg-muted/60"
    >
      <RiUserSettingsLine
        size={18}
        aria-hidden
        className="mt-0.5 shrink-0 text-primary"
      />
      <span>
        <span className="block font-medium text-foreground">
          Looking for your team, or your events?
        </span>
        <span className="block text-muted-foreground">
          Teammates, roles and the events they can reach live one level down, in
          Workspace settings.
        </span>
      </span>
    </Link>
  )
}
