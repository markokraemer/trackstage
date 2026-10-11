import { useEffect, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
  RiInputField,
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { errorMessage } from "@/lib/errors"

export type SponsorFieldSetting = FunctionReturnType<typeof api.sponsors.settings>["fields"][number]
type FieldKind = SponsorFieldSetting["kind"]

const FIELD_KINDS: Array<{ value: FieldKind; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "longText", label: "Long text" },
  { value: "url", label: "Link" },
]

/**
 * Settings → Fields & options → Sponsor company fields. Everything the event
 * collects about a sponsor beyond logo, website and description — LinkedIn,
 * booth number, industry — defined here once for every sponsor. Sponsors fill
 * them in from their portal's Company tab; "Public" ones show on the event
 * site, the rest stay with the team.
 */
export function SponsorFieldsCard({
  eventId,
  fields,
}: {
  eventId: Id<"events">
  fields: Array<SponsorFieldSetting>
}) {
  const saveField = useConvexMutation(api.sponsors.saveField)
  const removeField = useConvexMutation(api.sponsors.removeField)
  const reorder = useConvexMutation(api.sponsors.reorderFields)
  const [label, setLabel] = useState("")
  const [kind, setKind] = useState<FieldKind>("url")
  const [adding, setAdding] = useState(false)

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error("Give the field a label first.")
      return
    }
    setAdding(true)
    try {
      // Links are usually public (LinkedIn, X); text is usually logistics.
      await saveField({ eventId, label: trimmed, kind, public: kind === "url" })
      setLabel("")
      setKind("url")
      toast.success(`“${trimmed}” added — sponsors see it on their Company tab`)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add that field."))
    } finally {
      setAdding(false)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const ids = fields.map((field) => field._id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + direction, 0, moved)
    try {
      await reorder({ eventId, fieldIds: ids })
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't reorder the fields."))
    }
  }

  return (
    <Card id="sponsor-fields" className="scroll-mt-24">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiInputField size={18} aria-hidden className="text-primary" />
          Sponsor company fields
        </CardTitle>
        <CardDescription>
          What you collect from every sponsor beyond logo, website and
          description — LinkedIn, booth number, industry. Sponsors fill them in
          from their portal; public ones are shown on the event site.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{fields.length}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        {fields.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiInputField}
            title="No extra fields"
            description="Add one for anything you need from every sponsor."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {fields.map((field, index) => (
              <FieldRow
                key={field._id}
                field={field}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                onMoveUp={() => void move(index, -1)}
                onMoveDown={() => void move(index, 1)}
                onSave={(patch) =>
                  saveField({
                    eventId,
                    fieldId: field._id,
                    label: patch.label ?? field.label,
                    kind: patch.kind ?? field.kind,
                    public: patch.public ?? field.public,
                  })
                }
                onDelete={() => removeField({ fieldId: field._id })}
              />
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
        >
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="new-field-label" className="text-xs font-medium">
              Field label
            </Label>
            <Input
              id="new-field-label"
              value={label}
              placeholder="Booth number"
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="w-36 space-y-1.5">
            <Label htmlFor="new-field-kind" className="text-xs font-medium">
              Type
            </Label>
            <Select
              items={FIELD_KINDS}
              value={kind}
              onValueChange={(value) => setKind(value as FieldKind)}
            >
              <SelectTrigger id="new-field-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_KINDS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={adding}>
            <RiAddLine size={16} aria-hidden />
            Add field
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function FieldRow({
  field,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onSave,
  onDelete,
}: {
  field: SponsorFieldSetting
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onSave: (patch: { label?: string; kind?: FieldKind; public?: boolean }) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  const [label, setLabel] = useState(field.label)
  useEffect(() => setLabel(field.label), [field.label])

  async function commitLabel() {
    const trimmed = label.trim()
    if (!trimmed) {
      setLabel(field.label)
      return
    }
    if (trimmed === field.label) return
    try {
      await onSave({ label: trimmed })
      toast.success(`Renamed to “${trimmed}”`)
    } catch (error) {
      setLabel(field.label)
      toast.error(errorMessage(error, "Couldn't rename that field."))
    }
  }

  function save(patch: { kind?: FieldKind; public?: boolean }) {
    void onSave(patch).catch((error: unknown) =>
      toast.error(errorMessage(error, "Couldn't save that field.")),
    )
  }

  const switchId = `sponsor-field-public-${field._id}`

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isFirst}
          aria-label={`Move ${field.label} up`}
          onClick={onMoveUp}
        >
          <RiArrowUpLine size={13} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          aria-label={`Move ${field.label} down`}
          onClick={onMoveDown}
        >
          <RiArrowDownLine size={13} aria-hidden />
        </Button>
      </div>

      <Input
        value={label}
        aria-label={`Field label (${field.label})`}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => void commitLabel()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") setLabel(field.label)
        }}
        className="h-9 min-w-40 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus:border-input"
      />

      <Select
        items={FIELD_KINDS}
        value={field.kind}
        onValueChange={(value) => save({ kind: value as FieldKind })}
      >
        <SelectTrigger size="sm" aria-label={`Type of ${field.label}`} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_KINDS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          id={switchId}
          size="sm"
          checked={field.public}
          onCheckedChange={(value) => save({ public: Boolean(value) })}
        />
        <Label htmlFor={switchId} className="text-xs font-normal text-muted-foreground">
          Public
        </Label>
      </div>

      <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:inline">
        {field.filledCount > 0
          ? `filled by ${field.filledCount}`
          : "not filled yet"}
      </span>

      <ConfirmDeleteButton
        label={`Delete field ${field.label}`}
        title={`Delete “${field.label}”?`}
        description={
          field.filledCount > 0
            ? `${field.filledCount} ${field.filledCount === 1 ? "sponsor has" : "sponsors have"} filled this in. Their answers are deleted with it. This can't be undone.`
            : "No sponsor has filled this in yet."
        }
        confirmLabel="Delete field"
        onConfirm={onDelete}
        fallbackError="Couldn't delete that field."
        successMessage={`“${field.label}” deleted`}
      >
        <RiDeleteBinLine size={15} aria-hidden />
      </ConfirmDeleteButton>
    </li>
  )
}
