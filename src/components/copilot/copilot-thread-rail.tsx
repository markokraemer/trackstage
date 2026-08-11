import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import type { OptimisticLocalStore } from "convex/browser"
import { format, isToday, isYesterday } from "date-fns"
import { RiDeleteBinLine, RiMoreLine, RiPencilLine } from "@remixicon/react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { forgetCopilotThread, useCopilotChat } from "@/lib/copilot-store"
import { useCurrentEvent } from "@/lib/current-event"
import { errorMessage } from "@/lib/errors"

/**
 * Conversation history for the full-page copilot (docs/memory/RULES.md 24).
 *
 * Every chat the organizer had about THIS event, newest first, grouped the way
 * anyone actually remembers them — today, yesterday, before that. Clicking one
 * switches the shared conversation instantly (rule 26); the transcript lands
 * behind it (copilot-thread-sync.tsx).
 *
 * The row menu is quiet on purpose: rename and delete appear on hover or
 * keyboard focus, so a list of twenty chats reads as a list of titles rather
 * than a list of controls.
 */
export function CopilotThreadRail({
  className,
  onPick,
}: {
  className?: string
  /** Lets the page close the rail's mobile overlay after a selection. */
  onPick?: () => void
}) {
  const { event } = useCurrentEvent()
  const eventId = event?._id
  const queryClient = useQueryClient()
  const { threadId, selectThread } = useCopilotChat(eventId)
  const [renaming, setRenaming] = useState<string | null>(null)

  // One object identity for both the query and its optimistic patches —
  // `localStore.getQuery` matches on the args, so they must be the same shape.
  const listArgs = useMemo(() => ({ eventId }), [eventId])
  const { data: threads, isPending } = useQuery(
    convexQuery(api.copilotThreads.list, listArgs)
  )

  const rename = useMutation({
    mutationFn: useConvexMutation(
      api.copilotThreads.rename
    ).withOptimisticUpdate((localStore, args) => {
      patchThreads(localStore, listArgs, (rows) =>
        rows.map((row) =>
          row._id === args.threadId ? { ...row, title: args.title } : row
        )
      )
    }),
    onError: (error) =>
      toast.error(errorMessage(error, "Couldn't rename that chat.")),
  })

  const remove = useMutation({
    mutationFn: useConvexMutation(
      api.copilotThreads.remove
    ).withOptimisticUpdate((localStore, args) => {
      patchThreads(localStore, listArgs, (rows) =>
        rows.filter((row) => row._id !== args.threadId)
      )
    }),
    onError: (error) =>
      toast.error(errorMessage(error, "Couldn't delete that chat.")),
  })

  const groups = useMemo(() => groupThreads(threads ?? []), [threads])

  return (
    <div
      className={cn(
        "flex w-[260px] shrink-0 flex-col border-r border-border bg-sidebar",
        className
      )}
    >
      {/* Same height as the shell's event-switcher block and the copilot
          header, so the tops line up across both seams. No "New chat" here —
          the page header already has one, and two of them was the first thing
          Marko flagged (2026-08-12). The rail is history, nothing else. */}
      <div className="flex h-18 shrink-0 items-end px-4 pb-2">
        <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Chat history
        </h2>
      </div>

      <nav
        aria-label="Copilot conversations"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      >
        {isPending ? (
          <ul className="space-y-1 px-1">
            {[0, 1, 2, 3].map((row) => (
              <li key={row}>
                <Skeleton className="h-8 w-full rounded-md" />
              </li>
            ))}
          </ul>
        ) : groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Your conversations show up here once you've asked something.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="pb-3">
              <h2 className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h2>
              <ul className="space-y-0.5">
                {group.threads.map((thread) => (
                  <li key={thread._id}>
                    {renaming === thread._id ? (
                      <RenameRow
                        title={thread.title}
                        onCancel={() => setRenaming(null)}
                        onCommit={(title) => {
                          setRenaming(null)
                          if (title && title !== thread.title) {
                            rename.mutate({ threadId: thread._id, title })
                          }
                        }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "group/row relative flex items-center rounded-md",
                          "hover:bg-sidebar-accent",
                          thread._id === threadId &&
                            "bg-sidebar-accent font-medium"
                        )}
                      >
                        <button
                          type="button"
                          aria-current={
                            thread._id === threadId ? "true" : undefined
                          }
                          onClick={() => {
                            selectThread(thread._id)
                            onPick?.()
                          }}
                          // The transcript is one hover away from being in
                          // cache, which is what makes the click feel free.
                          onPointerEnter={() =>
                            void queryClient.prefetchQuery(
                              convexQuery(api.copilotThreads.get, {
                                threadId: thread._id,
                              })
                            )
                          }
                          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="w-full truncate pr-6 text-sm text-sidebar-foreground">
                            {thread.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {threadTimestamp(thread.updatedAt)}
                          </span>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${thread.title}`}
                                className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
                              />
                            }
                          >
                            <RiMoreLine size={15} aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => setRenaming(thread._id)}
                            >
                              <RiPencilLine size={15} aria-hidden />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                // The store first: the open conversation must
                                // not outlive the row it belongs to.
                                forgetCopilotThread(eventId, thread._id)
                                remove.mutate({ threadId: thread._id })
                                toast.success("Chat deleted")
                              }}
                            >
                              <RiDeleteBinLine size={15} aria-hidden />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>
    </div>
  )
}

/** Inline rename — the title becomes an input in place, no dialog to dismiss. */
function RenameRow({
  title,
  onCommit,
  onCancel,
}: {
  title: string
  onCommit: (title: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(title)
  // Escape must cancel even though blur commits; the blur fires second.
  const cancelled = useRef(false)
  return (
    <Input
      autoFocus
      value={value}
      aria-label="Chat name"
      className="h-8 text-sm"
      onChange={(changeEvent) => setValue(changeEvent.currentTarget.value)}
      onBlur={() => {
        if (cancelled.current) return
        onCommit(value.trim())
      }}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter") {
          keyEvent.preventDefault()
          onCommit(value.trim())
        } else if (keyEvent.key === "Escape") {
          keyEvent.preventDefault()
          cancelled.current = true
          onCancel()
        }
      }}
    />
  )
}

type ThreadRow = {
  _id: Id<"copilotThreads">
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

function patchThreads(
  localStore: OptimisticLocalStore,
  args: { eventId: Id<"events"> | undefined },
  patch: (rows: Array<ThreadRow>) => Array<ThreadRow>
): void {
  const current = localStore.getQuery(api.copilotThreads.list, args)
  if (!current) return
  localStore.setQuery(api.copilotThreads.list, args, patch(current))
}

/** Today · Yesterday · Earlier — the only three buckets anyone thinks in. */
function groupThreads(
  threads: Array<ThreadRow>
): Array<{ label: string; threads: Array<ThreadRow> }> {
  const buckets: Array<{ label: string; threads: Array<ThreadRow> }> = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Earlier", threads: [] },
  ]
  for (const thread of threads) {
    const index = isToday(thread.updatedAt)
      ? 0
      : isYesterday(thread.updatedAt)
        ? 1
        : 2
    buckets[index].threads.push(thread)
  }
  return buckets.filter((bucket) => bucket.threads.length > 0)
}

/** The day is already in the group heading, so the row only needs the rest. */
function threadTimestamp(at: number): string {
  if (isToday(at) || isYesterday(at)) return format(at, "HH:mm")
  return format(at, "d MMM")
}
