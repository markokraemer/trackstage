/**
 * Saved embeds (sbek EMB-15).
 *
 * Our embeds are links, so nothing here has to be "published" — but organizers
 * still build several (the sponsor page wants one track, the app wants the
 * whole thing, the newsletter wants speakers) and need to come back to them.
 * This is that shelf: name a configuration, reopen it, hand the same code to a
 * colleague, delete it when the event is over.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Doc, Id } from "@convex/_generated/dataModel"
import { RiBookmarkLine, RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { StatusPill } from "@/components/shared/status-pill"
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
        description:
          errorMessage(error, "Please try again."),
      })
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full" />
      </Card>
    )
  }

  if (!embeds || embeds.length === 0) {
    return (
      <Card className="gap-1.5 border-dashed p-5">
        <p className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
          <RiBookmarkLine size={16} aria-hidden />
          Saved embeds
        </p>
        <p className="text-sm text-muted-foreground">
          Configure a widget below and press{" "}
          <span className="font-medium text-foreground">Save embed</span> to
          keep it here — handy when different pages of your site need different
          versions.
        </p>
      </Card>
    )
  }

  return (
    <Card className="gap-3 p-5">
      <div>
        <p className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
          <RiBookmarkLine size={16} aria-hidden />
          Saved embeds
        </p>
        <p className="text-sm text-muted-foreground">
          Click one to load its configuration and copy the code again. The
          switch turns an embed off everywhere it's pasted.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {embeds.map((embed) => {
          const widget = widgetById(embed.widget)
          const format = formatById(embed.options.format)
          const active = activeId === embed._id
          const live = embed.enabled !== false
          return (
            <li key={embed._id}>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors",
                  active ? "bg-accent/60 ring-2 ring-primary" : "bg-card",
                )}
              >
                <button
                  type="button"
                  onClick={() => onLoad(embed)}
                  aria-pressed={active}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground",
                      !live && "opacity-50",
                    )}
                  >
                    <widget.icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {embed.name}
                      </span>
                      {live ? null : (
                        <StatusPill status="inactive" label="Off" size="sm" />
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {widget.name} · {format.name}
                      {embed.options.track
                        ? ` · ${embed.options.track.split(",").join(", ")}`
                        : ""}
                    </span>
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
    </Card>
  )
}
