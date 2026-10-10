import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { errorMessage } from "@/lib/errors"

const NONE = "__none__"

/**
 * "Which sponsor is this session for?" — in the submission drawer. Saves on
 * pick (it is a link, not wording under edit): every contact of the chosen
 * sponsor then sees the session in their portal. Hidden entirely on events
 * with no sponsors, so the drawer stays as short as it was.
 */
export function SponsorPicker({
  eventId,
  submissionId,
  sponsorId,
}: {
  eventId: Id<"events">
  submissionId: Id<"submissions">
  sponsorId: Id<"sponsors"> | null
}) {
  const { data: sponsors } = useQuery(convexQuery(api.sponsors.options, { eventId }))
  const setSponsor = useConvexMutation(api.sponsors.setSessionSponsor)

  if (!sponsors || (sponsors.length === 0 && !sponsorId)) return null

  const items = [
    { value: NONE, label: "No sponsor" },
    ...sponsors.map((s) => ({ value: s._id, label: s.name })),
  ]

  async function pick(value: string) {
    const next = value === NONE ? null : (value as Id<"sponsors">)
    if (next === sponsorId) return
    try {
      await setSponsor({ submissionId, sponsorId: next })
      const name = sponsors?.find((s) => s._id === next)?.name
      toast.success(name ? `Linked to ${name}` : "Sponsor link removed", {
        description: name ? `${name}'s contacts can now see and edit it in their portal.` : undefined,
      })
    } catch (error) {
      toast.error("Couldn't change the sponsor", { description: errorMessage(error, "Please try again.") })
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor="detail-sponsor">Sponsor</FieldLabel>
      <Select items={items} value={sponsorId ?? NONE} onValueChange={(value) => void pick(String(value))}>
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
      <FieldDescription>Saved straight away. The sponsor's contacts see linked sessions in their portal.</FieldDescription>
    </Field>
  )
}
