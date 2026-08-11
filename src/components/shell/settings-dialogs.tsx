import { useState } from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
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
import { TooltipProvider } from "@/components/ui/tooltip"
import { ProfileCard } from "@/components/account/profile-card"
import { PasswordCard } from "@/components/account/password-card"
import type { CreatedApiKey } from "@/components/settings/api-keys-card"
import { ApiKeysCard } from "@/components/settings/api-keys-card"
import { McpConnectCard } from "@/components/settings/mcp-connect-card"
import { McpCapabilitiesCard } from "@/components/settings/mcp-capabilities-card"
import { RestApiCard } from "@/components/settings/rest-api-card"
import { WorkspaceNameCard } from "@/components/workspace/workspace-name-card"
import { MembersCard } from "@/components/workspace/members-card"
import { WorkspacesCard } from "@/components/workspace/workspaces-card"
import { WorkspaceEventsCard } from "@/components/workspace/events-card"
import { useWorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { useCurrentEvent } from "@/lib/current-event"
import { useSession } from "@/lib/session"

/**
 * Account + Workspace settings as MODALS over whatever page the organizer is
 * on (Marko, 2026-08-11): only EVENT settings deserves a page of its own —
 * "account" and "workspace" are quick errands, not places you live, and the
 * old workspace-settings PAGE stranded people with no idea what to do next.
 *
 * The state is a search param handled at the app shell (`/app` validates it),
 * Linear-style, so the modals are URL-addressable from anywhere:
 *
 *     ?settings=account&settingsTab=api-mcp
 *     ?settings=workspace&invite=1&inviteEvent=…
 *
 * and the legacy `/app/account` + `/app/:ws/workspace` addresses redirect to
 * the nearest real page with the right modal open — no dead links. The keys
 * are namespaced (`settingsTab`, not `tab`) so they can ride on top of any
 * page's own search params (evaluation and communications both own `tab`).
 */

export type SettingsModalKind = "account" | "workspace"
export type AccountSettingsTab = "profile" | "security" | "api-mcp"

export interface SettingsModalSearch {
  /** Which settings modal is open. Absent ⇒ none. */
  settings?: SettingsModalKind
  /** Account modal section. Absent ⇒ Profile. */
  settingsTab?: AccountSettingsTab
  /** Open the workspace modal's invite dialog straight away. */
  invite?: boolean
  /** Pre-select that invite's event scope (Event settings → Team card). */
  inviteEvent?: string
}

const ACCOUNT_TABS: ReadonlyArray<AccountSettingsTab> = [
  "profile",
  "security",
  "api-mcp",
]

/**
 * `validateSearch` for the `/app` layout route. Conditional keys (never
 * `{ settings: undefined }`) keep `search` OPTIONAL on every plain
 * `<Link to="/app/…">` in the app.
 */
export function settingsModalSearch(
  search: Record<string, unknown>,
): SettingsModalSearch {
  const out: SettingsModalSearch = {}
  if (search.settings === "account" || search.settings === "workspace") {
    out.settings = search.settings
  }
  if (
    typeof search.settingsTab === "string" &&
    (ACCOUNT_TABS as ReadonlyArray<string>).includes(search.settingsTab)
  ) {
    out.settingsTab = search.settingsTab as AccountSettingsTab
  }
  if (search.invite === true || search.invite === "1" || search.invite === 1) {
    out.invite = true
  }
  if (typeof search.inviteEvent === "string" && search.inviteEvent) {
    out.inviteEvent = search.inviteEvent
  }
  return out
}

/** Spread into a search updater to close whichever modal is open. */
export const SETTINGS_MODAL_CLOSED = {
  settings: undefined,
  settingsTab: undefined,
  invite: undefined,
  inviteEvent: undefined,
} as const

/**
 * Mounted once in the organizer shell (src/routes/app/route.tsx), beside the
 * copilot panel, so both modals are reachable from every page.
 */
export function SettingsDialogsHost() {
  const navigate = useNavigate()
  const raw = useSearch({ strict: false })
  const search = settingsModalSearch(raw)

  const close = () => {
    void navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...SETTINGS_MODAL_CLOSED,
      }),
      replace: true,
    } as never)
  }

  return (
    <>
      <AccountSettingsDialog
        open={search.settings === "account"}
        tab={search.settingsTab ?? "profile"}
        onClose={close}
      />
      <WorkspaceSettingsDialog
        open={search.settings === "workspace"}
        invite={search.settings === "workspace" && search.invite === true}
        inviteEvent={search.inviteEvent}
        onClose={close}
      />
    </>
  )
}

/** The wide, clip-proof shell both settings modals share (the `min-w-0` grid
 *  is the Connect-MCP fix — long code lines must never widen the track). */
const SETTINGS_DIALOG_CLASS =
  "grid max-h-[85svh] w-full grid-cols-[minmax(0,1fr)] content-start gap-5 overflow-y-auto sm:max-w-3xl"

/**
 * Account settings — you, personally (docs/memory/RULES.md 23b): profile,
 * sign-in, API keys & MCP. Everything follows your login into whatever
 * workspace or event you open; nothing here belongs to a team.
 */
function AccountSettingsDialog({
  open,
  tab,
  onClose,
}: {
  open: boolean
  tab: AccountSettingsTab
  onClose: () => void
}) {
  const { session, status } = useSession()

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className={SETTINGS_DIALOG_CLASS}>
        <DialogHeader className="min-w-0">
          <DialogTitle>
            {session?.email
              ? `Account settings — ${session.email}`
              : "Account settings"}
          </DialogTitle>
          <DialogDescription>
            Your personal profile, sign-in and API access. Only you can see and
            change these — they follow you into every workspace and event.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <Tabs value={tab}>
            <TabsList variant="line" className="h-auto flex-wrap">
              <TabsTrigger
                value="profile"
                nativeButton={false}
                className="gap-1.5"
                render={
                  <Link
                    to="."
                    search={(prev: Record<string, unknown>) =>
                      ({ ...prev, settingsTab: undefined })
                    }
                    replace
                  />
                }
              >
                <RiUserSettingsLine size={15} aria-hidden />
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="security"
                nativeButton={false}
                className="gap-1.5"
                render={
                  <Link
                    to="."
                    search={(prev: Record<string, unknown>) =>
                      ({ ...prev, settingsTab: "security" }) as never
                    }
                    replace
                  />
                }
              >
                <RiShieldKeyholeLine size={15} aria-hidden />
                Security
              </TabsTrigger>
              <TabsTrigger
                value="api-mcp"
                nativeButton={false}
                className="gap-1.5"
                render={
                  <Link
                    to="."
                    search={(prev: Record<string, unknown>) =>
                      ({ ...prev, settingsTab: "api-mcp" }) as never
                    }
                    replace
                  />
                }
              >
                <RiKey2Line size={15} aria-hidden />
                API &amp; MCP
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {status !== "authenticated" || !session ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Tabs value={tab}>
              <TabsContent value="profile" className="flex flex-col gap-5">
                <ProfileCard
                  key={session.email}
                  name={session.name}
                  email={session.email}
                />
              </TabsContent>

              <TabsContent value="security" className="flex flex-col gap-5">
                <PasswordCard />
              </TabsContent>

              <TabsContent value="api-mcp">
                <ApiMcpPanel />
              </TabsContent>
            </Tabs>
          )}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}

/**
 * API keys & MCP — personal credentials, so they live at the account level
 * (docs/memory/RULES.md 21 + 23b). A key resolves to YOU and then runs through
 * the same membership and event-scope checks your browser session does.
 */
function ApiMcpPanel() {
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)

  return (
    <div className="flex min-w-0 flex-col gap-5">
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

/**
 * Workspace settings — the level above your events (docs/memory/RULES.md 23c):
 * the workspace itself, every event it owns, and the people who run them.
 * Always manages the workspace the app is IN, so this dialog and the sidebar
 * can never name two different workspaces. Content order = the hierarchy:
 * which workspaces you belong to → THIS workspace → what it owns (events) →
 * who runs them (team; its access column refers to the events listed above).
 */
function WorkspaceSettingsDialog({
  open,
  invite,
  inviteEvent,
  onClose,
}: {
  open: boolean
  invite: boolean
  inviteEvent: string | undefined
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { session } = useSession()
  const { workspaceEvents, selectEvent, selectWorkspace, isLoading } =
    useCurrentEvent()
  const { workspaceOptions, workspace, switchToCreated } =
    useWorkspaceSwitcher()

  // Switching workspace from INSIDE this dialog keeps the dialog open — you
  // are managing workspaces, and the content simply becomes the one you
  // switched to. (The sidebar picker's `switchTo` drops the `?settings=` key
  // and would close it mid-task.) Same store write, same landing rule: first
  // event's dashboard, else the workspace's no-events screen.
  const switchKeepingDialog = (workspaceId: string) => {
    const option = workspaceOptions.find((row) => row.id === workspaceId)
    const hasEvents = selectWorkspace(workspaceId)
    if (!option) return
    const first = option.events.at(0)
    if (hasEvents && first) {
      void navigate({
        to: "/app/$workspaceSlug/$eventSlug",
        params: {
          workspaceSlug: first.organizationSlug,
          eventSlug: first.slug,
        },
        search: { settings: "workspace" },
        replace: true,
      })
    } else {
      void navigate({
        to: "/app/$workspaceSlug/workspace",
        params: { workspaceSlug: option.slug },
        search: { settings: "workspace" },
        replace: true,
      })
    }
  }

  // `?invite=1&inviteEvent=…` — arriving from an event's Team card. Closing
  // the invite dialog drops the params so a reload doesn't reopen it; the
  // workspace modal itself stays open.
  const inviteEventIds =
    inviteEvent && workspaceEvents.some((row) => row._id === inviteEvent)
      ? [inviteEvent]
      : undefined

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className={SETTINGS_DIALOG_CLASS}>
        <DialogHeader className="min-w-0">
          <DialogTitle>
            {workspace
              ? `Workspace settings — ${workspace.name}`
              : "Workspace settings"}
          </DialogTitle>
          <DialogDescription>
            The level above your events: the workspace itself, every event it
            owns, and the people who run them. Anything personal to you lives
            in Account settings.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          {isLoading || !workspace ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-5">
              <WorkspacesCard
                workspaces={workspaceOptions}
                onSwitch={switchKeepingDialog}
                onCreated={switchToCreated}
              />
              <WorkspaceNameCard
                key={`name-${workspace.id}`}
                organizationId={workspace.id}
                name={workspace.name}
                slug={workspace.slug}
                myRole={workspace.role}
              />
              <WorkspaceEventsCard
                key={`events-${workspace.id}`}
                events={workspaceEvents}
                onOpen={selectEvent}
              />
              <MembersCard
                key={`members-${workspace.id}`}
                organizationId={workspace.id}
                workspaceName={workspace.name}
                myRole={workspace.role}
                myEmail={session?.email ?? ""}
                events={workspaceEvents}
                inviteOpen={invite}
                inviteEventIds={inviteEventIds}
                onInviteClosed={() => {
                  if (invite || inviteEvent) {
                    void navigate({
                      search: (prev: Record<string, unknown>) => ({
                        ...prev,
                        invite: undefined,
                        inviteEvent: undefined,
                      }),
                      replace: true,
                    } as never)
                  }
                }}
              />
            </div>
          )}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
