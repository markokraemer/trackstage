import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import {
  RiAddLine,
  RiBarChartLine,
  RiDeleteBinLine,
  RiMicLine,
  RiPencilLine,
  RiPriceTag3Line,
  RiTranslate2,
} from "@remixicon/react"
import { toast } from "sonner"
import { Link } from "@tanstack/react-router"

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
import { Badge } from "@/components/ui/badge"
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
import { errorMessage } from "@/components/settings/errors"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

export type ValueList = FunctionReturnType<typeof api.valueLists.list>[number]
export type ValueListOption = ValueList["options"][number]

const LIST_ICONS: Record<ValueList["key"], typeof RiMicLine> = {
  format: RiMicLine,
  level: RiBarChartLine,
  language: RiTranslate2,
  tags: RiPriceTag3Line,
}

/**
 * One shared value list (Format / Level / Language / Tags) — SPEC/RULES §28,
 * docs/reference/api-parity.md UI-census #16. A value list has no table of
 * its own: it IS the option set on the matching form question, so every add /
 * rename / remove here writes through `convex/valueLists.ts` onto every form
 * that carries the question and (for rename) cascades onto the sessions
 * already using the old value.
 */
export function ValueListCard({
  eventId,
  list,
}: {
  eventId: string
  list: ValueList
}) {
  const Icon = LIST_ICONS[list.key]
  const { eventRef } = useCurrentEvent()
  const formsLink = eventRef ? appLink.forms(eventRef) : legacyAppLink.forms

  const addOption = useMutation({
    mutationFn: useConvexMutation(api.valueLists.add),
  })
  const renameOption = useMutation({
    mutationFn: useConvexMutation(api.valueLists.rename),
  })
  const removeOption = useMutation({
    mutationFn: useConvexMutation(api.valueLists.remove),
  })

  const [draft, setDraft] = useState("")

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) {
      toast.error(`Give the ${list.singular} a name first.`)
      return
    }
    try {
      await addOption.mutateAsync({
        eventId: eventId as Id<"events">,
        key: list.key,
        name: trimmed,
      })
      setDraft("")
      toast.success(`“${trimmed}” added to ${list.label.toLowerCase()}`)
    } catch (error) {
      toast.error(errorMessage(error, `Couldn't add that ${list.singular}.`))
    }
  }

  async function handleRename(from: string, to: string) {
    try {
      await renameOption.mutateAsync({
        eventId: eventId as Id<"events">,
        key: list.key,
        from,
        to,
      })
      toast.success(`Renamed “${from}” to “${to}”`)
    } catch (error) {
      toast.error(errorMessage(error, `Couldn't rename that ${list.singular}.`))
      throw error
    }
  }

  async function handleRemove(name: string) {
    try {
      await removeOption.mutateAsync({
        eventId: eventId as Id<"events">,
        key: list.key,
        name,
      })
      toast.success(`“${name}” removed from ${list.label.toLowerCase()}`)
    } catch (error) {
      toast.error(errorMessage(error, `Couldn't remove that ${list.singular}.`))
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Icon size={18} aria-hidden className="text-primary" />
          {list.label}
        </CardTitle>
        <CardDescription>{list.help}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{list.options.length}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        {list.options.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No {list.label.toLowerCase()} yet.
          </p>
        ) : (
          <>
            <p className="pb-2 text-xs text-muted-foreground">
              Use the pencil icon to rename a value — it updates every session
              already using it too.
            </p>
            <ul className="divide-y divide-border">
              {list.options.map((option) => (
                <ValueListRow
                  key={option.name}
                  option={option}
                  onRename={(to) => handleRename(option.name, to)}
                  onRemove={() => handleRemove(option.name)}
                />
              ))}
            </ul>
          </>
        )}

        {list.formCount === 0 ? (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            No form on this event asks for a {list.singular}. Add that question
            in the{" "}
            <Link
              to={formsLink as never}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              form builder
            </Link>{" "}
            first.
          </p>
        ) : (
          <form
            onSubmit={handleAdd}
            className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
          >
            <div className="min-w-40 flex-1 space-y-1.5">
              <Input
                aria-label={`New ${list.singular} name`}
                value={draft}
                placeholder={`Add a ${list.singular}…`}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={addOption.isPending}>
              <RiAddLine size={16} aria-hidden />
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function ValueListRow({
  option,
  onRename,
  onRemove,
}: {
  option: ValueListOption
  onRename: (to: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(option.name)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function startEdit() {
    setName(option.name)
    setEditing(true)
  }

  async function commit() {
    const trimmed = name.trim()
    setEditing(false)
    if (!trimmed || trimmed === option.name) return
    try {
      await onRename(trimmed)
    } catch {
      // toast already shown by the caller
    }
  }

  async function confirmRemove() {
    setDeleting(true)
    try {
      await onRemove()
      setConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      {editing ? (
        <Input
          autoFocus
          value={name}
          aria-label={`Rename ${option.name}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
            if (event.key === "Escape") {
              setName(option.name)
              setEditing(false)
            }
          }}
          className="h-9 min-w-40 flex-1"
        />
      ) : (
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <span className="text-sm">{option.name}</span>
          {!option.offered ? (
            <Badge className="bg-status-amber-bg text-status-amber-fg">
              No longer offered
            </Badge>
          ) : null}
        </div>
      )}

      <span className="shrink-0 text-xs text-muted-foreground">
        {option.usage > 0
          ? `used by ${option.usage} ${option.usage === 1 ? "session" : "sessions"}`
          : "not used yet"}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Rename ${option.name}`}
          onClick={startEdit}
        >
          <RiPencilLine size={15} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${option.name}`}
          onClick={() => setConfirmOpen(true)}
        >
          <RiDeleteBinLine size={15} aria-hidden />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{option.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {option.usage > 0
                ? `${option.usage} ${option.usage === 1 ? "session uses" : "sessions use"} “${option.name}”. They keep the value — it just won't be offered on your form any more.`
                : `This takes “${option.name}” off your form. No sessions use it right now.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmRemove()}
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
