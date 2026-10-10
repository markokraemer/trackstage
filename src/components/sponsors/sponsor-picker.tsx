import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Sentinel for "no sponsor" — Select values must be strings. */
export const NO_SPONSOR = "none"

/**
 * "Which sponsor is this session for?" — a field in the submission drawer's
 * draft like Track or Format, saved with "Save changes". Hidden entirely on
 * events with no sponsors, so the drawer stays as short as it was.
 */
export function SponsorPicker({
  eventId,
  value,
  onChange,
}: {
  eventId: Id<"events">
  /** A sponsor id, or NO_SPONSOR. */
  value: string
  onChange: (value: string) => void
}) {
  const { data: sponsors } = useQuery(convexQuery(api.sponsors.options, { eventId }))
  if (!sponsors || (sponsors.length === 0 && value === NO_SPONSOR)) return null

  const items = [
    { value: NO_SPONSOR, label: "No sponsor" },
    ...sponsors.map((s) => ({ value: String(s._id), label: s.name })),
  ]

  return (
    <Field>
      <FieldLabel htmlFor="detail-sponsor">Sponsor</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(String(next))}>
        <SelectTrigger id="detail-sponsor" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
