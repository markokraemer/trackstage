import { useState } from "react"
import {
  RiKey2Line,
  RiShieldKeyholeLine,
  RiUserSettingsLine,
} from "@remixicon/react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileCard } from "@/components/account/profile-card"
import { PasswordCard } from "@/components/account/password-card"
import type { CreatedApiKey } from "@/components/settings/api-keys-card"
import { ApiKeysCard } from "@/components/settings/api-keys-card"
import { McpConnectCard } from "@/components/settings/mcp-connect-card"
import { McpCapabilitiesCard } from "@/components/settings/mcp-capabilities-card"
import { RestApiCard } from "@/components/settings/rest-api-card"
import { useSession } from "@/lib/session"

export const ACCOUNT_SETTINGS_TABS = ["profile", "security", "api-mcp"] as const
export type AccountSettingsTab = (typeof ACCOUNT_SETTINGS_TABS)[number]

export function isAccountSettingsTab(
  value: unknown
): value is AccountSettingsTab {
  return (
    typeof value === "string" &&
    (ACCOUNT_SETTINGS_TABS as readonly string[]).includes(value)
  )
}

/**
 * Account settings — a MODAL, not a page (docs/memory/RULES.md 23b refined:
 * account settings is personal to you, so it opens over whatever you were
 * doing rather than navigating you away from it). Workspace and event
 * settings stay full pages one level up — see SettingsLevelNav.
 *
 * The active tab is owned by the caller (the `/app` shell reads it from the
 * `?account=` search param) so the modal is deep-linkable: `/app?account=
 * api-mcp` opens straight to API & MCP.
 */
export function AccountSettingsDialog({
  open,
  tab,
  onOpenChange,
  onTabChange,
}: {
  open: boolean
  tab: AccountSettingsTab
  onOpenChange: (open: boolean) => void
  onTabChange: (tab: AccountSettingsTab) => void
}) {
  const { session, status } = useSession()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            {session?.email
              ? `Your personal profile and sign-in for ${session.email}. Only you can see and change these.`
              : "Your personal profile and sign-in. Only you can see and change these."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (isAccountSettingsTab(value)) onTabChange(value)
          }}
          className="min-h-0 flex-1"
        >
          <div className="border-b border-border px-6 pt-3">
            <TabsList variant="line" className="h-auto">
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {status !== "authenticated" || !session ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
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
                  <ApiMcpTab />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/**
 * API keys & MCP — moved here from the old `/app/settings/api-mcp` event-level
 * page. Keys are personal to whoever holds them, so they belong at the account
 * level, not the event level (docs/memory/RULES.md 21 + 23b).
 */
function ApiMcpTab() {
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
