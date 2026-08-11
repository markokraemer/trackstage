import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarEventLine,
  RiDeleteBin6Line,
  RiDownloadLine,
  RiFileList3Line,
  RiMore2Fill,
  RiSearchLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import type { SubmissionStatus } from "@/components/shared/status-pill"
import { TrackValue } from "@/components/submissions/field-bits"
import { StatusTabs } from "@/components/submissions/status-tabs"
import {
  KindTabs,
  isSubmissionKind,
  kindHint,
} from "@/components/submissions/kind-tabs"
import type { SubmissionKindValue } from "@/components/submissions/kind-tabs"
import { QueueBanner } from "@/components/submissions/queue-banner"
import { BulkBar } from "@/components/submissions/bulk-bar"
import { SubmissionsTable } from "@/components/submissions/submissions-table"
import type {
  SortDirection,
  SortKey,
  SubmissionRow,
} from "@/components/submissions/submissions-table"
import type { StatusChoice } from "@/components/submissions/status-picker"
import { AddSubmissionDrawer } from "@/components/submissions/add-submission-drawer"
import { DeleteSubmissionDialog } from "@/components/submissions/delete-submission-dialog"
import { DeletedSubmissionsDrawer } from "@/components/submissions/deleted-submissions-drawer"
import { SubmissionDetailDrawer } from "@/components/submissions/submission-detail-drawer"
import { useCurrentEvent } from "@/lib/current-event"
import { appLink, legacyAppLink } from "@/lib/app-links"
import {
  STATUS_TABS,
  TAB_EMPTY_COPY,
  isStatusTab,
} from "@/components/submissions/constants"
import type { StatusTabValue } from "@/components/submissions/constants"
import {
  buildSubmissionsCsv,
  csvFilename,
  downloadCsv,
} from "@/components/submissions/export-csv"

/**
 * `/app/submissions` — the organizer's triage workspace (docs/SPEC.md §4.4,
 * docs/ux/03 Part B). Status tabs with live counts, instant client-side search,
 * inline status editing, bulk staging into the decision queues, and the
 * two-phase commit that actually emails speakers.
 *
 * Every filter lives in the URL, so a view can be shared, bookmarked, and
 * restored — and a browser agent can reach any tab through a plain link.
 */

const PAGE_SIZE = 25

interface SubmissionsSearch {
  status?: StatusTabValue
  /** Abstracts vs Sessions (kind-tabs.tsx). Absent ⇒ both. */
  kind?: Exclude<SubmissionKindValue, "all">
  q?: string
  track?: string
  id?: string
}

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/submissions/")({
  validateSearch: (search: Record<string, unknown>): SubmissionsSearch => {
    const status =
      typeof search.status === "string" && isStatusTab(search.status)
        ? search.status
        : undefined
    const kind =
      typeof search.kind === "string" && isSubmissionKind(search.kind)
        ? search.kind
        : undefined
    return {
      status: status === "all" ? undefined : status,
      kind: kind === "all" ? undefined : kind,
      q: typeof search.q === "string" && search.q ? search.q : undefined,
      track:
        typeof search.track === "string" && search.track
          ? search.track
          : undefined,
      id: typeof search.id === "string" && search.id ? search.id : undefined,
    }
  },
  component: SubmissionsPage,
})

function SubmissionsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const tab: StatusTabValue = search.status ?? "all"
  const kind: SubmissionKindValue = search.kind ?? "all"
  const [query, setQuery] = useState(search.q ?? "")
  const [selectedIds, setSelectedIds] = useState<Array<string>>([])
  const [pendingStatus, setPendingStatus] = useState<
    Record<string, StatusChoice>
  >({})
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "submitted",
    direction: "desc",
  })
  const [page, setPage] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Delete is soft (convex/submissions.remove) — the confirmation and the
  // Deleted drawer are the two halves of UI census #6.
  const [deleteTarget, setDeleteTarget] = useState<SubmissionRow | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)

  // ——— Data ————————————————————————————————————————————————————————————
  const { event, eventRef, isEmpty: hasNoEvent } = useCurrentEvent()
  const submissionsHref = eventRef
    ? appLink.submissions(eventRef)
    : legacyAppLink.submissions
  const formsHref = eventRef ? appLink.forms(eventRef) : legacyAppLink.forms
  const eventId = event?._id
  const eventArgs = eventId ? { eventId } : "skip"

  const { data: counts } = useQuery(
    convexQuery(api.submissions.counts, eventArgs)
  )
  const { data: rooms } = useQuery(convexQuery(api.roomsTracks.list, eventArgs))
  const { data: scores } = useQuery(
    convexQuery(api.evaluationsAdmin.scoresBySubmission, eventArgs)
  )
  const { data: exportRows } = useQuery(
    convexQuery(api.submissions.exportData, eventArgs)
  )
  const { data: rows, isPending: rowsPending } = useQuery(
    convexQuery(
      api.submissions.list,
      eventId
        ? {
            eventId,
            status: tab === "all" ? undefined : tab,
            trackId: search.track ? (search.track as Id<"tracks">) : undefined,
          }
        : "skip"
    )
  )

  const tracks = useMemo(() => rooms?.tracks ?? [], [rooms])

  const setStatusMutation = useConvexMutation(api.submissions.setStatus)
  const bulkSetStatus = useConvexMutation(api.submissions.bulkSetStatus)
  const commitQueue = useConvexMutation(api.submissions.commitQueue)

  // ——— URL sync ————————————————————————————————————————————————————————
  // Search filters instantly on the client; the URL catches up a beat later so
  // the view stays shareable without a round-trip per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((search.q ?? "") === query) return
      void navigate({
        search: (prev) => ({ ...prev, q: query || undefined }),
        replace: true,
      })
    }, 300)
    return () => clearTimeout(handle)
  }, [query, search.q, navigate])

  // Filters changing means the old page/selection no longer make sense.
  useEffect(() => {
    setPage(0)
    setSelectedIds([])
  }, [tab, kind, search.track, query])

  // ——— Derived rows ————————————————————————————————————————————————————
  // Abstract vs Session counts for the segmented control. Taken from `rows`,
  // which the server already narrowed to the active status tab and track — so
  // the numbers describe the view the organizer is actually looking at, the
  // same way the status counts do.
  const kindCounts = useMemo(() => {
    const list: Array<SubmissionRow> = rows ?? []
    const sessions = list.filter((row) => row.kind === "session").length
    return {
      all: list.length,
      session: sessions,
      abstract: list.length - sessions,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const byKind: Array<SubmissionRow> = (rows ?? []).filter((row) =>
      kind === "all"
        ? true
        : kind === "session"
          ? row.kind === "session"
          : row.kind !== "session"
    )
    const list = byKind
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? list.filter((row) => {
          return (
            row.title.toLowerCase().includes(needle) ||
            (row.description ?? "").toLowerCase().includes(needle) ||
            (row.track?.name ?? "").toLowerCase().includes(needle) ||
            (row.format ?? "").toLowerCase().includes(needle) ||
            row.participants.some(
              (person) =>
                person.name.toLowerCase().includes(needle) ||
                person.email.toLowerCase().includes(needle)
            )
          )
        })
      : list

    const direction = sort.direction === "asc" ? 1 : -1
    return [...matched].sort((a, b) => {
      if (sort.key === "title") {
        return a.title.localeCompare(b.title) * direction
      }
      if (sort.key === "score") {
        const scoreA = scores?.[a._id]?.avg ?? -1
        const scoreB = scores?.[b._id]?.avg ?? -1
        return (scoreA - scoreB) * direction
      }
      return (a._creationTime - b._creationTime) * direction
    })
  }, [rows, kind, query, sort, scores])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  )

  // The table footer describes the filtered view, not the 25 rows on this page
  // (docs/memory/RULES.md 19 follow-up) — so both numbers are computed here,
  // where the filtering happens.
  const tableTotals = useMemo(() => {
    const scored = scores
      ? filtered.flatMap((row) => {
          const avg = row._id in scores ? scores[row._id].avg : null
          return avg === null ? [] : [avg]
        })
      : []
    return {
      count: filtered.length,
      avgScore:
        scored.length > 0
          ? scored.reduce((sum, value) => sum + value, 0) / scored.length
          : null,
    }
  }, [filtered, scores])

  const acceptStaged = counts?.accept_queue ?? 0
  const declineStaged = counts?.decline_queue ?? 0

  // ——— Actions —————————————————————————————————————————————————————————
  async function handleStatusChange(id: string, choice: StatusChoice) {
    setPendingStatus((prev) => ({ ...prev, [id]: choice }))
    try {
      await setStatusMutation({
        submissionId: id as Id<"submissions">,
        status: choice.status,
        // The custom status label, when the organizer picked one
        // (src/lib/status-catalog.ts). `status` above stays the pipeline value.
        statusId: choice.statusId
          ? (choice.statusId as Id<"sessionStatuses">)
          : undefined,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change the status."
      )
    } finally {
      setPendingStatus((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  async function handleBulk(status: SubmissionStatus) {
    if (selectedIds.length === 0) return
    setBusy(true)
    try {
      await bulkSetStatus({
        submissionIds: selectedIds as Array<Id<"submissions">>,
        status,
      })
      const label =
        STATUS_TABS.find((entry) => entry.value === status)?.label ?? status
      toast.success(
        `${selectedIds.length} submission${selectedIds.length === 1 ? "" : "s"} moved to ${label}.`
      )
      setSelectedIds([])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not move those submissions."
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleCommit(queue: "accept_queue" | "decline_queue") {
    if (!eventId) return
    try {
      const result = await commitQueue({ eventId, queue })
      toast.success(
        queue === "accept_queue"
          ? `${result.committed} accepted · ${result.notified} speaker email${result.notified === 1 ? "" : "s"} queued.`
          : `${result.committed} declined · ${result.notified} speaker email${result.notified === 1 ? "" : "s"} queued.`
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send those decisions."
      )
      throw error
    }
  }

  function exportCsv(scope: "all" | "view") {
    const source = scope === "all" ? (exportRows ?? []) : filtered
    if (source.length === 0) {
      toast.error("There's nothing to export yet.")
      return
    }
    downloadCsv(
      csvFilename(event?.name ?? "event"),
      buildSubmissionsCsv(source, scores ?? {})
    )
    toast.success(`Exported ${source.length} submissions.`)
  }

  // ——— No event yet ————————————————————————————————————————————————————
  if (hasNoEvent) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Submissions"
          description="Everything submitted to your event, in one place."
        />
        <EmptyState
          icon={RiCalendarEventLine}
          title="Create your event first"
          description="Submissions belong to an event. Set up your event name, dates, and tracks, then publish a call for papers to start collecting talks."
          action={
            <Link
              to={eventRef ? appLink.settings(eventRef) : legacyAppLink.settings}
              className={buttonVariants({})}
            >
              Go to event settings
            </Link>
          }
        />
      </div>
    )
  }

  const showAcceptBanner =
    (tab === "all" || tab === "accept_queue") && acceptStaged > 0
  const showDeclineBanner =
    (tab === "all" || tab === "decline_queue") && declineStaged > 0

  const emptyCopy = TAB_EMPTY_COPY[tab]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Submissions"
        description="Review what came in, stage your decisions, then send them when you're ready."
      />

      {/*
        Two levels of filter, outer above inner (kind-tabs.tsx): WHERE a
        program item came from, then WHERE it is in the pipeline. Both are
        links, both live in the URL, and they compose.
      */}
      <div className="flex flex-col gap-1.5">
        <KindTabs
          value={kind}
          counts={rows ? kindCounts : undefined}
          search={{ status: search.status, q: search.q, track: search.track }}
        />
        <p className="text-sm text-muted-foreground">{kindHint(kind)}</p>
      </div>

      <StatusTabs
        value={tab}
        counts={counts}
        search={{ q: search.q, track: search.track, kind: search.kind }}
      />

      {showAcceptBanner ? (
        <QueueBanner
          queue="accept_queue"
          count={acceptStaged}
          onCommit={() => handleCommit("accept_queue")}
          secondaryAction={
            tab === "all" ? (
              <Link
                to={submissionsHref}
                search={{ status: "accept_queue" }}
                className={buttonVariants({ variant: "outline" })}
              >
                Review the queue
              </Link>
            ) : null
          }
        />
      ) : null}

      {showDeclineBanner ? (
        <QueueBanner
          queue="decline_queue"
          count={declineStaged}
          onCommit={() => handleCommit("decline_queue")}
          secondaryAction={
            tab === "all" ? (
              <Link
                to={submissionsHref}
                search={{ status: "decline_queue" }}
                className={buttonVariants({ variant: "outline" })}
              >
                Review the queue
              </Link>
            ) : null
          }
        />
      ) : null}

      <DataToolbar
        value={query}
        onValueChange={setQuery}
        placeholder="Search title, speaker, or track…"
        searchLabel="Search submissions"
        filters={
          <Select
            value={search.track ?? "all"}
            onValueChange={(value) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  track: value === "all" ? undefined : (value as string),
                }),
              })
            }
          >
            <SelectTrigger aria-label="Filter by track" className="min-w-40">
              <SelectValue>
                {(value) => (
                  <TrackValue
                    tracks={tracks}
                    value={value}
                    empty="All tracks"
                  />
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tracks</SelectItem>
              {tracks.map((track) => (
                <SelectItem key={track._id} value={track._id}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: track.color }}
                    />
                    {track.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" aria-label="More options" />}
              >
                <RiMore2Fill aria-hidden />
                Options
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Export</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportCsv("all")}>
                  <RiDownloadLine aria-hidden />
                  Export all submissions (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv("view")}>
                  <RiDownloadLine aria-hidden />
                  Export this view (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTrashOpen(true)}>
                  <RiDeleteBin6Line aria-hidden />
                  Deleted submissions
                  {counts?.deleted ? ` (${counts.deleted})` : ""}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to={formsHref} />}>
                  <RiFileList3Line aria-hidden />
                  Manage submission forms
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => setAddOpen(true)}>
              <RiAddLine aria-hidden />
              Add submission
            </Button>
          </>
        }
      />

      <BulkBar
        count={selectedIds.length}
        busy={busy}
        onMove={handleBulk}
        onClear={() => setSelectedIds([])}
      />

      <Card size="sm" className="gap-0 py-0">
        {!rowsPending && visible.length === 0 ? (
          query ? (
            <EmptyState
              variant="plain"
              icon={RiSearchLine}
              title={`No submissions match “${query}”`}
              description="Try a different title, speaker name, or track — or clear the search to see everything in this tab."
              action={
                <Button variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : kind !== "all" ? (
            // The tab isn't empty — this SEGMENT is. Say which, and give a way
            // back, or the organizer reads it as "my submissions are gone".
            <EmptyState
              variant="plain"
              icon={RiFileList3Line}
              title={
                kind === "session"
                  ? "No sessions here"
                  : "No abstracts here"
              }
              description={kindHint(kind)}
              action={
                <Link
                  to={submissionsHref}
                  search={{ status: search.status, track: search.track }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Show all {kindCounts.all}
                </Link>
              }
              secondaryAction={
                kind === "session" ? (
                  <Button onClick={() => setAddOpen(true)}>
                    <RiAddLine aria-hidden />
                    Add session
                  </Button>
                ) : (
                  <Link to={formsHref} className={buttonVariants({ variant: "outline" })}>
                    Share your form link
                  </Link>
                )
              }
            />
          ) : (
            <EmptyState
              variant="plain"
              icon={RiFileList3Line}
              title={emptyCopy.title}
              description={emptyCopy.description}
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <RiAddLine aria-hidden />
                  Add submission
                </Button>
              }
              secondaryAction={
                tab === "all" ? (
                  <Link to={formsHref} className={buttonVariants({ variant: "outline" })}>
                    Share your form link
                  </Link>
                ) : null
              }
            />
          )
        ) : (
          <SubmissionsTable
            rows={visible}
            scores={scores}
            loading={rowsPending}
            selectedIds={selectedIds}
            onToggleRow={(id, isSelected) =>
              setSelectedIds((prev) =>
                isSelected
                  ? [...new Set([...prev, id])]
                  : prev.filter((value) => value !== id)
              )
            }
            onToggleAll={(isSelected) =>
              setSelectedIds(isSelected ? visible.map((row) => row._id) : [])
            }
            onStatusChange={handleStatusChange}
            sort={sort}
            onSortChange={(key) =>
              setSort((prev) =>
                prev.key === key
                  ? {
                      key,
                      direction: prev.direction === "asc" ? "desc" : "asc",
                    }
                  : { key, direction: key === "title" ? "asc" : "desc" }
              )
            }
            pendingStatus={pendingStatus}
            onDelete={setDeleteTarget}
            totals={tableTotals}
          />
        )}

        {filtered.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {safePage * PAGE_SIZE + 1}–
              {safePage * PAGE_SIZE + visible.length} of {filtered.length}{" "}
              submission{filtered.length === 1 ? "" : "s"}
            </p>
            {pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  <RiArrowLeftSLine aria-hidden />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage + 1} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                  <RiArrowRightSLine aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {eventId ? (
        <AddSubmissionDrawer
          open={addOpen}
          onOpenChange={setAddOpen}
          eventId={eventId}
          tracks={tracks}
          onCreated={(submissionId) =>
            void navigate({
              search: (prev) => ({ ...prev, id: submissionId }),
            })
          }
        />
      ) : null}

      <DeleteSubmissionDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        submissionId={deleteTarget?._id ?? null}
        title={deleteTarget?.title ?? ""}
        kind={deleteTarget?.kind}
        onDeleted={() => {
          setSelectedIds((prev) =>
            prev.filter((value) => value !== deleteTarget?._id)
          )
          setDeleteTarget(null)
        }}
      />

      {eventId ? (
        <DeletedSubmissionsDrawer
          open={trashOpen}
          onOpenChange={setTrashOpen}
          eventId={eventId}
        />
      ) : null}

      <SubmissionDetailDrawer
        open={Boolean(search.id)}
        onOpenChange={(open) => {
          if (!open) {
            void navigate({ search: (prev) => ({ ...prev, id: undefined }) })
          }
        }}
        submissionId={(search.id as Id<"submissions"> | undefined) ?? null}
        tracks={tracks}
      />
    </div>
  )
}
