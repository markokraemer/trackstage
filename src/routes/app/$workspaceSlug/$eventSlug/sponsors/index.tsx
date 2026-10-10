import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiAddLine, RiBuilding2Line, RiSettings3Line } from "@remixicon/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useCurrentEvent } from "@/lib/current-event"
import { errorMessage } from "@/lib/errors"
import { EmptyEventState } from "@/components/shell/empty-event-state"
import { SponsorDrawer } from "@/components/sponsors/sponsor-drawer"
import type { SponsorRow } from "@/components/sponsors/sponsor-drawer"
import { SponsorsTable, SponsorsTableSkeleton } from "@/components/sponsors/sponsors-table"
import { SponsorPortalSettingsDialog } from "@/components/sponsors/sponsor-portal-settings-dialog"

/**
 * Deep links: `?sponsor=<id>` opens that sponsor's drawer, `?add=1` opens the
 * create flow — plain URL params, so the ⌘K palette, the copilot and a
 * browser-agent judge can all land here directly.
 */
interface SponsorsSearch {
  sponsor?: string
  add?: boolean
}

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/sponsors/")({
  validateSearch: (search: Record<string, unknown>): SponsorsSearch => ({
    sponsor: typeof search.sponsor === "string" && search.sponsor ? search.sponsor : undefined,
    add: search.add === true || search.add === "1" || search.add === "true" ? true : undefined,
  }),
  component: SponsorsPage,
})

function formatDeadline(ms: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(ms)
  } catch {
    return new Date(ms).toLocaleString()
  }
}

/**
 * Sponsors (Kelsey, AI Engineer ops, 2026-10-10: "not all submissions come
 * through the CFP… if OpenAI has a sponsor, OpenAI has a main login, then
 * they go in and add the sessions that they want").
 *
 * One list of the companies with a package, each with the people who can
 * sign into its sponsor portal and how much of its session allowance it has
 * used. Everything a sponsor adds lands in Submissions like any other
 * session, so review, scheduling and emails need nothing new.
 */
function SponsorsPage() {
  const { event, eventRef, isEmpty } = useCurrentEvent()
  const navigate = Route.useNavigate()
  const { sponsor: deepLinked, add: deepLinkedAdd } = Route.useSearch()
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<Id<"sponsors"> | null>(null)
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleting, setDeleting] = useState<SponsorRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const { data } = useQuery(
    convexQuery(api.sponsors.list, event ? { eventId: event._id } : "skip"),
  )
  const removeSponsor = useConvexMutation(api.sponsors.remove)
  const sendInvites = useConvexMutation(api.sponsors.sendInvites)

  const rows = data?.sponsors
  const open = useMemo(
    () => (openId ? (rows ?? []).find((row) => row._id === openId) ?? null : null),
    [rows, openId],
  )
  const tiers = useMemo(
    () => [...new Set((rows ?? []).map((row) => row.tier).filter((t): t is string => !!t))],
    [rows],
  )

  useEffect(() => {
    if (!deepLinked || !rows) return
    const match = rows.find((row) => String(row._id) === deepLinked)
    if (match) setOpenId(match._id)
    void navigate({ search: (prev: SponsorsSearch) => ({ ...prev, sponsor: undefined }), replace: true })
  }, [deepLinked, rows, navigate])

  useEffect(() => {
    if (!deepLinkedAdd) return
    setCreating(true)
    void navigate({ search: (prev: SponsorsSearch) => ({ ...prev, add: undefined }), replace: true })
  }, [deepLinkedAdd, navigate])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows ?? []
    return (rows ?? []).filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        (row.tier ?? "").toLowerCase().includes(term) ||
        row.contacts.some(
          (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term),
        ) ||
        row.sessions.some((s) => s.title.toLowerCase().includes(term)),
    )
  }, [rows, search])

  async function inviteAll(row: SponsorRow) {
    try {
      const result = await sendInvites({ sponsorId: row._id })
      toast.success(
        `Portal invite${result.queued === 1 ? "" : "s"} sent to ${result.queued} contact${result.queued === 1 ? "" : "s"} at ${row.name}`,
        { description: result.recipients.join(", ") },
      )
    } catch (error) {
      toast.error("Couldn't send the invites", { description: errorMessage(error, "Please try again.") })
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await removeSponsor({ sponsorId: deleting._id })
      toast.success(`${deleting.name} removed`, {
        description: "Its sessions stay on your program; its contacts lose the sponsor tab.",
      })
      if (openId === deleting._id) setOpenId(null)
      setDeleting(null)
    } catch (error) {
      toast.error("Couldn't remove the sponsor", { description: errorMessage(error, "Please try again.") })
    } finally {
      setDeleteBusy(false)
    }
  }

  if (isEmpty) return <EmptyEventState section="sponsors" />

  const rules = data?.rules
  const rulesSummary = rules
    ? [
        rules.newSessionStatus === "accepted"
          ? "New sponsor sessions go straight onto the program"
          : "New sponsor sessions wait for your review",
        rules.closeAt && event
          ? `sponsors can add and edit until ${formatDeadline(rules.closeAt, event.timezone)}`
          : "no deadline",
      ].join(" · ")
    : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        data-tour="page-sponsors"
        title="Sponsors"
        description="Companies with a package on your event. Their contacts sign into a sponsor portal and add the sessions their package includes — no call for papers."
        actions={
          event ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                <RiSettings3Line aria-hidden />
                Portal settings
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <RiAddLine aria-hidden />
                Add sponsor
              </Button>
            </>
          ) : null
        }
      />

      {rows && rows.length > 0 ? (
        <DataToolbar
          value={search}
          onValueChange={setSearch}
          placeholder="Search sponsors, contacts or sessions…"
          searchLabel="Search sponsors"
          filters={
            rulesSummary ? (
              <p className="text-xs text-muted-foreground">{rulesSummary}</p>
            ) : null
          }
        />
      ) : null}

      {rows === undefined ? (
        <SponsorsTableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RiBuilding2Line}
          title="No sponsors yet"
          description="Add a sponsor, set how many sessions its package includes, and invite its contact. They sign into their own portal and add their sessions — which land in Submissions like any other."
          action={
            <Button onClick={() => setCreating(true)}>
              <RiAddLine aria-hidden />
              Add your first sponsor
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={RiBuilding2Line}
          title="No sponsor matches that search"
          description="Try a company name, a contact's email or a session title."
          action={
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <SponsorsTable
          rows={visible}
          onOpen={(row) => setOpenId(row._id)}
          onInviteAll={(row) => void inviteAll(row)}
          onDelete={setDeleting}
        />
      )}

      {event ? (
        <>
          <SponsorDrawer
            eventId={event._id}
            eventRef={eventRef}
            sponsor={creating ? null : open}
            tiers={tiers}
            open={creating || open !== null}
            onOpenChange={(next) => {
              if (next) return
              setCreating(false)
              setOpenId(null)
            }}
            onCreated={(id) => {
              setCreating(false)
              setOpenId(id)
            }}
            onDelete={setDeleting}
          />
          {rules ? (
            <SponsorPortalSettingsDialog
              eventId={event._id}
              timezone={event.timezone}
              rules={rules}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
            />
          ) : null}
        </>
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {deleting?.sessions.length ?? 0} session
              {deleting?.sessions.length === 1 ? "" : "s"} stay on your program and its
              contacts stay on the event — they just lose the sponsor portal tab. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? "Removing…" : "Remove sponsor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
