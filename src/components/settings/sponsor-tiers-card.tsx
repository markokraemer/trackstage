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
  RiVipCrown2Line,
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
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { errorMessage } from "@/lib/errors"

export type SponsorTierSetting = FunctionReturnType<typeof api.sponsors.settings>["tiers"][number]

/** Mirrors `cleanSessionLimit` in convex/lib/sponsors.ts. */
const MAX_SESSIONS = 50

function validLimit(raw: string): number | null {
  const value = Number(raw)
  return raw.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= MAX_SESSIONS
    ? value
    : null
}

/**
 * Settings → Fields & options → Sponsor tiers. The packages sponsors buy,
 * most prominent first (the order of the sponsor wall), each with the number
 * of sessions it includes — picking a tier on a sponsor pre-fills that. Edited
 * inline like Tracks: rename on blur, reorder with the arrows, and a rename
 * moves every sponsor in the tier with it.
 */
export function SponsorTiersCard({
  eventId,
  tiers,
}: {
  eventId: Id<"events">
  tiers: Array<SponsorTierSetting>
}) {
  const saveTier = useConvexMutation(api.sponsors.saveTier)
  const removeTier = useConvexMutation(api.sponsors.removeTier)
  const reorder = useConvexMutation(api.sponsors.reorderTiers)
  const [name, setName] = useState("")
  const [limit, setLimit] = useState("1")
  const [adding, setAdding] = useState(false)

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the tier a name first.")
      return
    }
    const sessionLimit = validLimit(limit)
    if (sessionLimit === null) {
      toast.error(`Sessions included must be a whole number from 0 to ${MAX_SESSIONS}.`)
      return
    }
    setAdding(true)
    try {
      await saveTier({ eventId, name: trimmed, sessionLimit })
      setName("")
      setLimit("1")
      toast.success(`“${trimmed}” added`)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add that tier."))
    } finally {
      setAdding(false)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const ids = tiers.map((tier) => tier._id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + direction, 0, moved)
    try {
      await reorder({ eventId, tierIds: ids })
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't reorder the tiers."))
    }
  }

  return (
    <Card id="sponsor-tiers" className="scroll-mt-24">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiVipCrown2Line size={18} aria-hidden className="text-primary" />
          Sponsor tiers
        </CardTitle>
        <CardDescription>
          Your sponsorship packages, most prominent first — the order sponsors
          appear in. Each says how many sessions it includes, so picking a tier
          on a sponsor fills that in for you.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{tiers.length}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        {tiers.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiVipCrown2Line}
            title="No tiers yet"
            description="Add your packages — Platinum, Gold, Community partner — and pick one for each sponsor."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {tiers.map((tier, index) => (
              <TierRow
                key={tier._id}
                tier={tier}
                isFirst={index === 0}
                isLast={index === tiers.length - 1}
                onMoveUp={() => void move(index, -1)}
                onMoveDown={() => void move(index, 1)}
                onSave={(patch) =>
                  saveTier({
                    eventId,
                    tierId: tier._id,
                    name: patch.name ?? tier.name,
                    sessionLimit: patch.sessionLimit ?? tier.sessionLimit,
                  })
                }
                onDelete={() => removeTier({ tierId: tier._id })}
              />
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
        >
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="new-tier-name" className="text-xs font-medium">
              Tier name
            </Label>
            <Input
              id="new-tier-name"
              value={name}
              placeholder="Gold"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="new-tier-sessions" className="text-xs font-medium">
              Sessions included
            </Label>
            <Input
              id="new-tier-sessions"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SESSIONS}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={adding}>
            <RiAddLine size={16} aria-hidden />
            Add tier
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function TierRow({
  tier,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onSave,
  onDelete,
}: {
  tier: SponsorTierSetting
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onSave: (patch: { name?: string; sessionLimit?: number }) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  const [name, setName] = useState(tier.name)
  const [limit, setLimit] = useState(String(tier.sessionLimit))
  useEffect(() => setName(tier.name), [tier.name])
  useEffect(() => setLimit(String(tier.sessionLimit)), [tier.sessionLimit])

  async function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(tier.name)
      return
    }
    if (trimmed === tier.name) return
    try {
      await onSave({ name: trimmed })
      toast.success(
        tier.sponsorCount > 0
          ? `Renamed to “${trimmed}” — its sponsors moved with it`
          : `Renamed to “${trimmed}”`,
      )
    } catch (error) {
      setName(tier.name)
      toast.error(errorMessage(error, "Couldn't rename that tier."))
    }
  }

  async function commitLimit() {
    const value = validLimit(limit)
    if (value === null) {
      setLimit(String(tier.sessionLimit))
      toast.error(`Sessions included must be a whole number from 0 to ${MAX_SESSIONS}.`)
      return
    }
    if (value === tier.sessionLimit) return
    try {
      await onSave({ sessionLimit: value })
      toast.success(`${tier.name} now includes ${value} session${value === 1 ? "" : "s"}`, {
        description: "Sponsors already in this tier keep the allowance they have.",
      })
    } catch (error) {
      setLimit(String(tier.sessionLimit))
      toast.error(errorMessage(error, "Couldn't save that."))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isFirst}
          aria-label={`Move ${tier.name} up`}
          onClick={onMoveUp}
        >
          <RiArrowUpLine size={13} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          aria-label={`Move ${tier.name} down`}
          onClick={onMoveDown}
        >
          <RiArrowDownLine size={13} aria-hidden />
        </Button>
      </div>

      <Input
        value={name}
        aria-label={`Tier name (${tier.name})`}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") setName(tier.name)
        }}
        className="h-9 min-w-40 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus:border-input"
      />

      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SESSIONS}
          value={limit}
          aria-label={`Sessions included in ${tier.name}`}
          onChange={(event) => setLimit(event.target.value)}
          onBlur={() => void commitLimit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
          className="h-9 w-16 tabular-nums"
        />
        <span className="w-14">{Number(limit) === 1 ? "session" : "sessions"}</span>
      </label>

      <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:inline">
        {tier.sponsorCount > 0
          ? `${tier.sponsorCount} ${tier.sponsorCount === 1 ? "sponsor" : "sponsors"}`
          : "no sponsors yet"}
      </span>

      <ConfirmDeleteButton
        label={`Delete tier ${tier.name}`}
        title={`Delete “${tier.name}”?`}
        description={
          tier.sponsorCount > 0
            ? `${tier.sponsorCount} ${tier.sponsorCount === 1 ? "sponsor is" : "sponsors are"} in this tier. They keep their sessions and allowance — they just won't have a tier.`
            : "No sponsor is in this tier."
        }
        confirmLabel="Delete tier"
        onConfirm={onDelete}
        fallbackError="Couldn't delete that tier."
        successMessage={`“${tier.name}” deleted`}
      >
        <RiDeleteBinLine size={15} aria-hidden />
      </ConfirmDeleteButton>
    </li>
  )
}
