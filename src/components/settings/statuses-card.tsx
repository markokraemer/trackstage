import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
  RiInformationLine,
  RiPriceTag3Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StatusPill } from "@/components/shared/status-pill"
import { absoluteDate } from "@/components/submissions/constants"
import { StatusColorPicker } from "@/components/settings/status-color-picker"
import { errorMessage } from "@/lib/errors"
import { CATEGORY_META, CATEGORY_OPTIONS } from "@/lib/status-catalog"
import type {
  StatusCategory,
  StatusOption,
  StatusTone,
} from "@/lib/status-catalog"

/**
 * Settings → Statuses — the organizer's own status vocabulary
 * (docs/reference/sessionboard-product-map.md §2.2, TODO.md [L1]).
 *
 * Rename "Accepted" to "Confirmed", recolour it, reorder the list, or add
 * "Waitlist" under the pending category. What a status *does* comes from its
 * category, which is why the category picker carries the explainer and why
 * the seven built-ins can't change theirs — see `src/lib/status-catalog.ts`.
 *
 * Built on the shadcn `Card`, `Table`, `Select`, `Input` and `AlertDialog`
 * primitives plus the shared `StatusPill`.
 */
export function StatusesCard({
  eventId,
  statuses,
  initialized,
}: {
  eventId: string
  statuses: Array<StatusOption>
  /** False until the seven built-ins exist as real rows in the database. */
  initialized: boolean
}) {
  const ensureDefaults = useConvexMutation(api.sessionStatuses.ensureDefaults)
  const createStatus = useMutation({
    mutationFn: useConvexMutation(api.sessionStatuses.create),
  })
  const updateStatus = useMutation({
    mutationFn: useConvexMutation(api.sessionStatuses.update),
  })
  const removeStatus = useMutation({
    mutationFn: useConvexMutation(api.sessionStatuses.remove),
  })

  // An event that has never opened this screen runs on the built-in defaults
  // with no rows behind them. Materialise them the moment someone arrives, so
  // every control below edits something real.
  useEffect(() => {
    if (initialized) return
    void ensureDefaults({ eventId: eventId as Id<"events"> }).catch(() => {
      /* a concurrent visit already created them — harmless */
    })
  }, [initialized, eventId])

  const [name, setName] = useState("")
  const [category, setCategory] = useState<StatusCategory>("pending")
  const [color, setColor] = useState<StatusTone>("gray")

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the status a name first.")
      return
    }
    try {
      await createStatus.mutateAsync({
        eventId: eventId as Id<"events">,
        name: trimmed,
        category,
        color,
      })
      setName("")
      toast.success(`“${trimmed}” added`)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add that status."))
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const current = statuses.at(index)
    const swap = statuses.at(index + direction)
    if (!current?._id || !swap?._id) return
    try {
      await Promise.all([
        updateStatus.mutateAsync({
          statusId: current._id as Id<"sessionStatuses">,
          patch: { order: swap.order },
        }),
        updateStatus.mutateAsync({
          statusId: swap._id as Id<"sessionStatuses">,
          patch: { order: current.order },
        }),
      ])
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't reorder the statuses."))
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiPriceTag3Line size={18} aria-hidden className="text-primary" />
          Statuses
        </CardTitle>
        <CardDescription>
          The words your team uses for where a submission stands. Rename or
          recolour the built-in ones, or add your own — “Waitlist”, “Accepted
          with revisions”, “Cancelled”.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{statuses.length}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <RiInformationLine
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <span>
            <strong className="font-medium text-foreground">
              Category controls pipeline behaviour
            </strong>{" "}
            — emails, queues and what speakers see in their portal. The name and
            colour are yours to choose; the category decides what actually
            happens.
          </span>
        </p>

        <div className="-mx-6 mt-4 overflow-x-auto">
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24 pl-6 text-xs">Order</TableHead>
                <TableHead className="min-w-[220px] text-xs">Name</TableHead>
                <TableHead className="w-[190px] text-xs">Category</TableHead>
                <TableHead className="w-[150px] text-xs">Preview</TableHead>
                <TableHead className="w-[110px] text-xs">Submissions</TableHead>
                <TableHead className="w-[170px] text-xs">Added by</TableHead>
                <TableHead className="w-12 pr-6 text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((status, index) => (
                <StatusRow
                  key={status._id ?? status.systemKey ?? status.name}
                  status={status}
                  otherStatuses={statuses.filter((s) => s._id !== status._id)}
                  isFirst={index === 0}
                  isLast={index === statuses.length - 1}
                  disabled={!status._id}
                  onMoveUp={() => void move(index, -1)}
                  onMoveDown={() => void move(index, 1)}
                  onPatch={(patch) =>
                    updateStatus.mutateAsync({
                      statusId: status._id as Id<"sessionStatuses">,
                      patch,
                    })
                  }
                  onDelete={(reassignToStatusId) =>
                    removeStatus.mutateAsync({
                      statusId: status._id as Id<"sessionStatuses">,
                      reassignToStatusId: reassignToStatusId
                        ? (reassignToStatusId as Id<"sessionStatuses">)
                        : undefined,
                    })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Colour</Label>
            <div className="flex h-9 items-center">
              <StatusColorPicker
                value={color}
                onValueChange={setColor}
                statusName="the new status"
              />
            </div>
          </div>

          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="new-status-name" className="text-xs font-medium">
              Status name
            </Label>
            <Input
              id="new-status-name"
              value={name}
              placeholder="Waitlist"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="w-52 space-y-1.5">
            <Label className="text-xs font-medium">Behaves like</Label>
            <CategorySelect
              value={category}
              onValueChange={setCategory}
              ariaLabel="Category for the new status"
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            disabled={createStatus.isPending}
          >
            <RiAddLine size={16} aria-hidden />
            Add status
          </Button>
        </form>

        <p className="mt-2 text-xs text-muted-foreground">
          {CATEGORY_META[category].description}
        </p>
      </CardContent>
    </Card>
  )
}

function CategorySelect({
  value,
  onValueChange,
  disabled,
  ariaLabel,
}: {
  value: StatusCategory
  onValueChange: (value: StatusCategory) => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as StatusCategory)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" aria-label={ariaLabel}>
        {/* Base UI hands the trigger the raw value, so spell out the label —
            otherwise the closed select reads "pending", not "Pending". */}
        <SelectValue>
          {(selected) =>
            CATEGORY_OPTIONS.find((option) => option.value === selected)
              ?.label ?? String(selected)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-w-80">
        {CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function StatusRow({
  status,
  otherStatuses,
  isFirst,
  isLast,
  disabled,
  onMoveUp,
  onMoveDown,
  onPatch,
  onDelete,
}: {
  status: StatusOption
  otherStatuses: Array<StatusOption>
  isFirst: boolean
  isLast: boolean
  /** True while the row is still a built-in default with no database row. */
  disabled?: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onPatch: (patch: {
    name?: string
    category?: StatusCategory
    color?: StatusTone
  }) => Promise<unknown>
  onDelete: (reassignToStatusId?: string) => Promise<unknown>
}) {
  const [name, setName] = useState(status.name)
  useEffect(() => setName(status.name), [status.name])

  const isBuiltIn = !!status.systemKey

  async function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(status.name)
      return
    }
    if (trimmed === status.name) return
    try {
      await onPatch({ name: trimmed })
    } catch (error) {
      setName(status.name)
      toast.error(errorMessage(error, "Couldn't rename that status."))
    }
  }

  return (
    <TableRow className="h-14">
      <TableCell className="pl-6">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isFirst || disabled}
            aria-label={`Move ${status.name} up`}
            onClick={onMoveUp}
          >
            <RiArrowUpLine size={13} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isLast || disabled}
            aria-label={`Move ${status.name} down`}
            onClick={onMoveDown}
          >
            <RiArrowDownLine size={13} aria-hidden />
          </Button>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1">
          <StatusColorPicker
            value={status.color}
            statusName={status.name}
            disabled={disabled}
            onValueChange={(value) => {
              void onPatch({ color: value }).catch((error: unknown) =>
                toast.error(errorMessage(error, "Couldn't change that colour.")),
              )
            }}
          />
          <Input
            value={name}
            disabled={disabled}
            aria-label={`Status name (${status.name})`}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void commitName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") setName(status.name)
            }}
            className="h-9 min-w-40 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus:border-input"
          />
        </div>
      </TableCell>

      <TableCell>
        {isBuiltIn ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex cursor-help items-center gap-1.5 text-sm text-muted-foreground underline decoration-dotted underline-offset-4" />
              }
            >
              {CATEGORY_META[status.category].label}
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Built-in status — its category is what the accept/decline
              pipeline runs on, so it can't change. You can still rename and
              recolour it.
            </TooltipContent>
          </Tooltip>
        ) : (
          <CategorySelect
            value={status.category}
            disabled={disabled}
            ariaLabel={`Category for ${status.name}`}
            onValueChange={(value) => {
              void onPatch({ category: value }).catch((error: unknown) =>
                toast.error(errorMessage(error, "Couldn't change that category.")),
              )
            }}
          />
        )}
      </TableCell>

      <TableCell>
        <StatusPill
          status={status.pipelineStatus}
          label={status.name}
          tone={status.color}
          variant="pill"
          size="sm"
        />
      </TableCell>

      <TableCell>
        <span className="text-sm tabular-nums text-muted-foreground">
          {status.count}
        </span>
      </TableCell>

      {/* Their `Created By` + `Created At` columns, folded into one cell so the
          table stays readable — the built-ins read as "System". */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {isBuiltIn ? (
            "System"
          ) : (
            <>
              {status.createdBy || "—"}
              {status.createdAt ? (
                <span className="block text-xs text-muted-foreground/80">
                  {absoluteDate(status.createdAt)}
                </span>
              ) : null}
            </>
          )}
        </span>
      </TableCell>

      <TableCell className="pr-6 text-right">
        {isBuiltIn ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="text-xs text-muted-foreground">Built-in</span>
              }
            />
            <TooltipContent className="max-w-72">
              The seven built-in statuses can't be deleted — the accept and
              decline flows need them.
            </TooltipContent>
          </Tooltip>
        ) : (
          <DeleteStatusDialog
            status={status}
            otherStatuses={otherStatuses}
            onDelete={onDelete}
          />
        )}
      </TableCell>
    </TableRow>
  )
}

/**
 * Deleting a status that submissions still carry would silently reset their
 * wording, so when it's in use the dialog makes you say where those
 * submissions go instead — the server refuses without it.
 */
function DeleteStatusDialog({
  status,
  otherStatuses,
  onDelete,
}: {
  status: StatusOption
  otherStatuses: Array<StatusOption>
  onDelete: (reassignToStatusId?: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const fallback = otherStatuses.find((s) => s.systemKey === "pending")
  const [target, setTarget] = useState<string>(
    fallback?._id ?? otherStatuses[0]?._id ?? "",
  )
  const inUse = status.count > 0

  async function confirm() {
    if (inUse && !target) {
      toast.error("Pick a status to move them to first.")
      return
    }
    setPending(true)
    try {
      await onDelete(inUse ? target : undefined)
      setOpen(false)
      toast.success(`“${status.name}” deleted`)
    } catch (error) {
      setOpen(false)
      toast.error(errorMessage(error, "Couldn't delete that status."))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete status ${status.name}`}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <RiDeleteBinLine size={15} aria-hidden />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{status.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {inUse
                ? `${status.count} submission${status.count === 1 ? "" : "s"} currently use this status. Choose where ${status.count === 1 ? "it" : "they"} should go.`
                : "Nothing uses this status, so it can go straight away. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {inUse ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Move them to</Label>
              <Select
                value={target}
                onValueChange={(next) => setTarget(String(next))}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Status to move these submissions to"
                >
                  {/* The values are ids — resolve them to names, or the closed
                      select shows a raw Convex id. */}
                  <SelectValue>
                    {(selected) =>
                      otherStatuses.find((o) => o._id === selected)?.name ??
                      "Choose a status"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherStatuses.map((option) => (
                    <SelectItem key={option._id} value={option._id ?? ""}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending ? "Deleting…" : "Delete status"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
