/**
 * Saved embeds (sbek EMB-15).
 *
 * Our embeds are links, so nothing here has to be "published" — but organizers
 * still build several (the sponsor page wants one track, the app wants the
 * whole thing, the newsletter wants speakers) and need to come back to them.
 * This is that shelf: name a configuration, reopen it, hand the same code to a
 * colleague, delete it when the event is over.
 *
 * It lives at the top of the builder's left rail (2026-08-12), so it is a
 * compact section rather than a card of its own — the right-hand side of the
 * screen belongs to the preview.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Doc, Id } from "@convex/_generated/dataModel"
import { RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { formatById, widgetById } from "@/components/embeds/embed-config"
import { errorMessage } from "@/lib/errors"

export interface SavedEmbedsProps {
  embeds: Array<Doc<"embeds">> | undefined
  /** The row currently loaded into the configurator, if any. */
  activeId: Id<"embeds"> | null
  onLoad: (embed: Doc<"embeds">) => void
  loading?: boolean
}

export function SavedEmbeds({
  embeds,
  activeId,
  onLoad,
  loading,
}: SavedEmbedsProps) {
  const remove = useConvexMutation(api.embeds.remove)
  const setEnabled = useConvexMutation(api.embeds.setEnabled)
  const [removing, setRemoving] = React.useState<string | null>(null)

  // The off switch (sbek EMB-15). A saved embed's snippet carries its id, so
  // turning this off reaches every copy already pasted around the web: those
  // pages answer "this embed is turned off" instead of the programme.
  // `enabled` absent means ON — rows saved before the switch existed keep
  // working exactly as they did.
  async function handleToggle(embed: Doc<"embeds">, next: boolean) {
    try {
      await setEnabled({ embedId: embed._id, enabled: next })
      toast.success(
        next ? `“${embed.name}” is live again` : `“${embed.name}” is turned off`,
        {
          description: next
            ? undefined
            : "Anywhere it's pasted now says the embed is turned off.",
        },
      )
    } catch (error) {
      toast.error("Couldn't change that", {
        description: errorMessage(error, "Please try again."),
      })
    }
  }

  async function handleRemove(embed: Doc<"embeds">) {
    setRemoving(String(embed._id))
    try {
      await remove({ embedId: embed._id })
      toast.success(`Deleted “${embed.name}”`)
    } catch (error) {
      toast.error("Couldn't delete that embed", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col gap-2 px-4 py-4">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-11 w-full" />
      </section>
    )
  }

  // Nothing saved yet: the rail's "Save this embed" section is where the idea
  // is introduced, so an empty shelf would only take space from the controls.
  if (!embeds || embeds.length === 0) return null

  return (
    <section className="flex flex-col gap-2 px-4 py-4">
      <h2 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Saved embeds
      </h2>
      <ul className="flex flex-col gap-1.5">
        {embeds.map((embed) => {
          const widget = widgetById(embed.widget)
          const format = formatById(embed.options.format)
          const active = activeId === embed._id
          const live = embed.enabled !== false
          return (
            <li key={embed._id}>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                )}
              >
                <button
                  type="button"
                  onClick={() => onLoad(embed)}
                  aria-pressed={active}
                  title={`${embed.name} — ${widget.name} · ${format.name}`}
                  className="flex min-w-0 flex-1 flex-col rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "truncate text-sm font-medium text-foreground",
                      !live && "text-muted-foreground",
                    )}
                  >
                    {embed.name}
                    {live ? "" : " · off"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {widget.name} · {format.name}
                  </span>
                </button>
                <Switch
                  checked={live}
                  aria-label={`${live ? "Turn off" : "Turn on"} ${embed.name}`}
                  onCheckedChange={(next) =>
                    void handleToggle(embed, Boolean(next))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${embed.name}`}
                  disabled={removing === String(embed._id)}
                  onClick={() => void handleRemove(embed)}
                >
                  <RiDeleteBinLine aria-hidden />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
