/**
 * Person picker — "who is this?", answered from the event's own people.
 *
 * The backend has always been ONE person graph per event, keyed by email:
 * adding a speaker whose address already exists attaches THAT person — their
 * portal, tasks, profile and other sessions intact — instead of creating a
 * twin (convex/submissions.ts `addManual`, convex/speakersAdmin.ts
 * `addSubmissionParticipant`). The UI hid that completely: every "add a
 * speaker" surface was three blank boxes, so organizers had no way to know
 * whether they were reusing Tom Beaumont or minting a second one.
 *
 * This is that truth, made visible. Type a few letters and you see the people
 * already on the event — photo, company, and how many sessions they're on —
 * and picking one fills the form with their details. Type a full email nobody
 * matches and you get an explicit "add them as a new person" row.
 *
 * Two deliberate properties:
 *
 *  - **It mirrors the email, it doesn't own it.** The parent keeps its plain
 *    email input exactly as it was, so pasting an address straight in still
 *    works — and the moment that address belongs to someone, this component
 *    says so ("Existing speaker — their portal and profile carry over"),
 *    because it derives the match from the email rather than from having been
 *    clicked. Both paths tell the same story.
 *  - **It is a recogniser, not a directory.** Eight rows, ranked exact-email →
 *    prefix → contains. The Speakers table is where you browse everyone.
 *
 * Composes the shadcn `Popover` + `Command` combobox pattern (rule 17), the
 * same one behind `TimezoneSelect` and the ⌘K palette.
 */

import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiUserSearchLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FieldDescription } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { initialsOf } from "@/components/dashboard/format"

/** One row of `api.speakersAdmin.searchPeople` — the shape callers get back. */
export type PersonPickerPerson = FunctionReturnType<
  typeof api.speakersAdmin.searchPeople
>[number]

/** Debounce before the search query fires. Typing always echoes instantly. */
const DEBOUNCE_MS = 120

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

/**
 * The one-glance fact that tells two same-named people apart: what they are
 * already on. "Added manually" is its own answer — it means an organizer put
 * them there by hand and nothing is scheduled yet.
 */
export function personFacet(person: PersonPickerPerson): string {
  if (person.sessionCount > 0) {
    return person.sessionCount === 1 ? "1 session" : `${person.sessionCount} sessions`
  }
  if (person.manuallyAdded) return "Added manually"
  return "No sessions yet"
}

export interface PersonPickerProps {
  id?: string
  /** The event whose people are searched. Undefined ⇒ the picker sits idle. */
  eventId: Id<"events"> | undefined
  /** The email currently in the parent's form — the picker mirrors it. */
  email: string
  /** An existing person was chosen: fill name AND email from them. */
  onPick: (person: PersonPickerPerson) => void
  /** A brand-new address was entered: only the email is known. */
  onNewEmail: (email: string) => void
  /** Addresses already used on this form — offered, but not twice. */
  excludeEmails?: Array<string>
  placeholder?: string
  /**
   * Helper line under the field while nobody is matched. It is REPLACED by
   * the "existing speaker" confirmation once the email belongs to someone —
   * one line that always says the most useful thing, instead of a hint and a
   * confirmation stacked on top of each other.
   */
  hint?: React.ReactNode
  /** Set false when the parent renders its own "existing speaker" line. */
  showNote?: boolean
  disabled?: boolean
  className?: string
}

export function PersonPicker({
  id,
  eventId,
  email,
  onPick,
  onNewEmail,
  excludeEmails = [],
  placeholder = "Search people, or type an email…",
  hint,
  showNote = true,
  disabled,
  className,
}: PersonPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // The list behind the popover. Only subscribed while it is open.
  const { data: results } = useQuery({
    ...convexQuery(
      api.speakersAdmin.searchPeople,
      eventId && open ? { eventId, q: debounced } : "skip",
    ),
    // Results that blink to "No matches" between keystrokes read as broken.
    placeholderData: keepPreviousData,
  })

  // The mirror: is the address in the form already somebody? This is what
  // makes the paste-an-email path tell the same story as the picked path.
  const normalizedEmail = email.trim().toLowerCase()
  const { data: matches } = useQuery({
    ...convexQuery(
      api.speakersAdmin.searchPeople,
      eventId && looksLikeEmail(normalizedEmail)
        ? { eventId, q: normalizedEmail, limit: 3 }
        : "skip",
    ),
    placeholderData: keepPreviousData,
  })
  const matched =
    matches?.find((person) => person.email === normalizedEmail) ?? null

  const excluded = React.useMemo(
    () =>
      new Set(
        excludeEmails
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0 && value !== normalizedEmail),
      ),
    [excludeEmails, normalizedEmail],
  )

  const rows = results ?? []
  const typed = search.trim().toLowerCase()
  const offerNew =
    looksLikeEmail(typed) && !rows.some((person) => person.email === typed)

  function close() {
    setSearch("")
    setDebounced("")
    setOpen(false)
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
          else setOpen(true)
        }}
      >
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="h-9 w-full justify-between px-3 font-normal"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {matched ? (
              <Avatar className="size-5">
                {matched.headshotUrl ? (
                  <AvatarImage src={matched.headshotUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {initialsOf(matched.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <RiUserSearchLine
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
            )}
            <span className="truncate">
              {matched ? matched.name : email.trim() || placeholder}
            </span>
            {matched ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {personFacet(matched)}
              </span>
            ) : null}
          </span>
          <RiArrowDownSLine
            size={16}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--anchor-width) min-w-80 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name, email or company…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {typed
                  ? `No one on this event matches “${search.trim()}”. Type a full email address to add someone new.`
                  : "No one on this event yet — type an email address to add the first person."}
              </CommandEmpty>
              {rows.map((person) => {
                const already = excluded.has(person.email)
                return (
                  <CommandItem
                    key={person.personId}
                    value={person.personId}
                    disabled={already}
                    data-checked={
                      person.email === normalizedEmail ? true : undefined
                    }
                    className="gap-2.5 py-2"
                    onSelect={() => {
                      if (already) return
                      onPick(person)
                      close()
                    }}
                  >
                    <Avatar className="size-7">
                      {person.headshotUrl ? (
                        <AvatarImage src={person.headshotUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {person.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {person.email}
                        {person.company ? ` · ${person.company}` : ""}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {already ? "Already added" : personFacet(person)}
                    </span>
                  </CommandItem>
                )
              })}
              {offerNew ? (
                <CommandItem
                  value={`new:${typed}`}
                  className="gap-2.5 py-2"
                  onSelect={() => {
                    onNewEmail(typed)
                    close()
                  }}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <RiAddLine size={15} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{typed}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Add as a new person — they get a speaker portal
                      automatically.
                    </span>
                  </span>
                </CommandItem>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showNote && matched ? (
        <FieldDescription className="flex items-start gap-1.5 text-xs">
          <RiCheckLine
            size={14}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          Existing speaker — their portal and profile carry over.
        </FieldDescription>
      ) : hint ? (
        <FieldDescription className="text-xs">{hint}</FieldDescription>
      ) : null}
    </div>
  )
}
