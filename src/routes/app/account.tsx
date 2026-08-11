import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  RiKey2Line,
  RiShieldKeyholeLine,
  RiUserSettingsLine,
} from "@remixicon/react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
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
  // every `<Link to="/app/account">` in the app.
  validateSearch: (search: Record<string, unknown>): AccountSearch =>
    isAccountTab(search.tab) ? { tab: search.tab } : {},
  component: AccountSettingsPage,
})

/**
 * Account settings — you, personally (docs/memory/RULES.md 23b): profile,
 * sign-in and API access. Everything follows your login into whatever
 * workspace or event you open; nothing here belongs to a team.
 *
 * A standalone PAGE (Marko, 2026-08-12, after two modal-on-modal pile-ups:
 * "instead of being a modal just make it a standalone page again"). Settings
 * surfaces are pages; dialogs are for atomic actions only — which is exactly
 * why this works: Connect-a-client can open as a single ordinary dialog OVER
 * the page. The tab lives in the URL (`/app/account?tab=api-mcp`) so it is
 * deep-linkable from the docs, the eval kit, and every legacy redirect.
 */
function AccountSettingsPage() {
  const navigate = Route.useNavigate()
  const { tab } = Route.useSearch()
  const { session, status } = useSession()
  const active: AccountTab = tab ?? "profile"

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
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
 * API keys & MCP — personal credentials, so they live at the account level
 * (docs/memory/RULES.md 21 + 23b). A key resolves to YOU and then runs
 * through the same membership and event-scope checks your browser session
 * does. The Connect-a-client dialog opens OVER this page — a single, ordinary
 * dialog, which is the whole point of settings being a page.
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
