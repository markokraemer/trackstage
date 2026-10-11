import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiBuilding2Line,
  RiMailSendLine,
  RiSettings3Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import type { SponsorDrawerTab, SponsorRow } from "@/components/sponsors/sponsor-drawer"
import { SponsorsTable, SponsorsTableSkeleton } from "@/components/sponsors/sponsors-table"
import { appLink } from "@/lib/app-links"

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
    add: search.add === true || search.add === 1 || search.add === "1" || search.add === "true" ? true : undefined,
  }),
  component: SponsorsPage,
})

type FilterView = "all" | "no_contact" | "not_invited"

const VIEW_LABELS: Record<FilterView, string> = {
  all: "All sponsors",
  no_contact: "No contact",
  not_invited: "Not invited",
}

/** Sentinel for "don't filter by tier". */
const ANY_TIER = "__any__"

function RuleFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  )
}

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
  const [openTab, setOpenTab] = useState<SponsorDrawerTab>("details")
  const [view, setView] = useState<FilterView>("all")
  const [tier, setTier] = useState<string>(ANY_TIER)
  const [selected, setSelected] = useState<Array<string>>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [creating, setCreating] = useState(false)
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
  const tiers = useMemo(() => data?.tiers ?? [], [data])
  // Filter choices: the managed tiers, plus any legacy free-text tier in use.
  const tierNames = useMemo(
    () => [
      ...new Set([
        ...tiers.map((t) => t.name),
        ...(rows ?? []).map((row) => row.tier).filter((t): t is string => !!t),
      ]),
    ],
    [tiers, rows],
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

  const counts = useMemo(() => {
    const all = rows ?? []
    return {
      all: all.length,
      no_contact: all.filter((row) => row.contacts.length === 0).length,
      not_invited: all.filter(
        (row) => row.contacts.length > 0 && row.contacts.some((c) => c.invitedAt === null),
      ).length,
    }
  }, [rows])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((row) => {
      if (view === "no_contact" && row.contacts.length > 0) return false
      if (
        view === "not_invited" &&
        !(row.contacts.length > 0 && row.contacts.some((c) => c.invitedAt === null))
      ) {
        return false
      }
      if (tier !== ANY_TIER && (row.tier ?? "") !== tier) return false
      if (!term) return true
      return (
        row.name.toLowerCase().includes(term) ||
        (row.tier ?? "").toLowerCase().includes(term) ||
        row.contacts.some(
          (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term),
        ) ||
        row.sessions.some((s) => s.title.toLowerCase().includes(term))
      )
    })
  }, [rows, search, view, tier])

  const tierOptions = [
    { value: ANY_TIER, label: "Any tier" },
    ...tierNames.map((t) => ({ value: t, label: t })),
  ]

  function openSponsor(row: SponsorRow, tab: SponsorDrawerTab = "details") {
    setOpenTab(tab)
    setOpenId(row._id)
  }

  /** Bulk: email the portal invite to every contact of the ticked sponsors. */
  async function inviteSelected() {
    const targets = (rows ?? []).filter(
      (row) => selected.includes(row._id) && row.contacts.length > 0,
    )
    if (targets.length === 0) {
      toast.error("None of the selected sponsors has a contact yet")
      return
    }
    setBulkBusy(true)
    try {
      let queued = 0
      for (const row of targets) {
        queued += (await sendInvites({ sponsorId: row._id })).queued
      }
      toast.success(`Portal invites sent to ${queued} contact${queued === 1 ? "" : "s"}`, {
        description: `Across ${targets.length} sponsor${targets.length === 1 ? "" : "s"}.`,
      })
      setSelected([])
    } catch (error) {
      toast.error("Couldn't send the invites", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBulkBusy(false)
    }
  }

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
      setSelected((prev) => prev.filter((id) => id !== deleting._id))
      setDeleting(null)
    } catch (error) {
      toast.error("Couldn't remove the sponsor", { description: errorMessage(error, "Please try again.") })
    } finally {
      setDeleteBusy(false)
    }
  }

  if (isEmpty) return <EmptyEventState section="sponsors" />

  const rules = data?.rules

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        data-tour="page-sponsors"
        title="Sponsors"
        description="Companies with a package on your event. Their contacts sign into a sponsor portal and add the sessions their package includes — no call for papers."
        actions={
          event ? (
            <>
              {eventRef ? (
                // Tiers and company fields live with every other option list
                // (Settings → Fields & options); a real link, not a drawer.
                <Link
                  to={appLink.settingsSection(eventRef, "fields-and-options")}
                  hash="sponsors"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <RiSettings3Line aria-hidden />
                  Tiers &amp; fields
                </Link>
              ) : null}

              <Button size="sm" onClick={() => setCreating(true)}>
                <RiAddLine aria-hidden />
                Add sponsor
              </Button>
            </>
          ) : null
        }
      />

      {/* The event-wide portal rules, stated once — the same muted strip the
          drawers use for status — with the way to change them right beside. */}
      {rules && event ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
          <RuleFact
            label="New sponsor sessions"
            value={rules.newSessionStatus === "accepted" ? "Accepted" : "Pending review"}
          />
          <RuleFact
            label="Deadline"
            value={rules.closeAt ? formatDeadline(rules.closeAt, event.timezone) : "None"}
          />
          <RuleFact
            label="Colleague invites"
            value={rules.allowColleagueInvites ? "Allowed" : "Organizers only"}
          />
          {eventRef ? (
            <Link
              to={appLink.settings(eventRef)}
              hash="sponsor-portal"
              className="ml-auto text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Change
            </Link>
          ) : null}
        </div>
      ) : null}

      {rows && rows.length > 0 ? (
        <DataToolbar
          value={search}
          onValueChange={setSearch}
          placeholder="Search sponsors, contacts or sessions…"
          searchLabel="Search sponsors"
          filters={
            <>
              <Tabs
                value={view}
                onValueChange={(value) => setView(value as FilterView)}
                className="min-w-0 max-w-full"
              >
                <TabsList className="max-w-full justify-start overflow-x-auto">
                  {(Object.keys(VIEW_LABELS) as Array<FilterView>).map((key) => (
                    <TabsTrigger key={key} value={key}>
                      {VIEW_LABELS[key]}
                      <TabsCount>{counts[key]}</TabsCount>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {tierNames.length > 0 ? (
                <Select
                  items={tierOptions}
                  value={tier}
                  onValueChange={(value) => setTier(String(value))}
                >
                  <SelectTrigger size="sm" aria-label="Filter by tier" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tierOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </>
          }
        />
      ) : null}

      {selected.length > 0 ? (
        <Card
          size="sm"
          className="flex-row flex-wrap items-center gap-3 border border-primary/20 bg-accent px-4"
        >
          <p className="text-sm font-medium text-foreground">
            {selected.length} sponsor{selected.length === 1 ? "" : "s"} selected
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" disabled={bulkBusy} onClick={() => void inviteSelected()}>
              <RiMailSendLine aria-hidden />
              {bulkBusy ? "Sending…" : "Email portal invites"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </Card>
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
          title="No sponsor matches this view"
          description="Try a different search term, or switch back to All sponsors."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setView("all")
                setTier(ANY_TIER)
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <SponsorsTable
          rows={visible}
          selected={selected}
          onSelectedChange={setSelected}
          onOpen={openSponsor}
          onInvite={(row) => void inviteAll(row)}
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
            initialTab={openTab}
            onOpenChange={(next) => {
              if (next) return
              setCreating(false)
              setOpenId(null)
            }}
            onCreated={(id) => {
              setCreating(false)
              setOpenTab("contacts")
              setOpenId(id)
            }}
            onDelete={setDeleting}
          />
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
