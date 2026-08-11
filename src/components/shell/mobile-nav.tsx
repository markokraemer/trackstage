import { useEffect, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { RiMenuLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ShellEventSwitcher } from "@/components/shell/event-switcher"
import { GettingStarted } from "@/components/shell/getting-started"
import { SidebarNav } from "@/components/shell/sidebar-nav"
import type { NavGroup } from "@/components/shell/sidebar-nav"

/**
 * The phone-width shell navigation (below `md`): a hamburger in the top bar
 * opening a full-height left drawer that carries the COMPLETE sidebar — the
 * event switcher with name + dates, every labelled nav group, and the
 * Getting-started checklist. The 64px icon rail it replaces had no labels and
 * no switcher detail, which on a phone is navigation by memory.
 *
 * Closing is automatic wherever the journey continues: tapping a destination,
 * switching events (the pathname effect catches the navigation), tapping the
 * backdrop, or Esc. Desktop (md+) never renders any of this.
 */
export function MobileNav({ groups }: { groups: Array<NavGroup> }) {
  const [open, setOpen] = useState(false)

  // Any navigation — nav link, event switcher, checklist row — closes the
  // drawer; a drawer still covering the page you just chose reads as a hang.
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Open navigation"
            className="-ml-2 shrink-0 md:hidden"
          />
        }
      >
        <RiMenuLine size={20} aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(19rem,86vw)] gap-0 overflow-y-auto bg-sidebar p-0 md:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {/* pr-12 keeps the switcher clear of the sheet's ✕ button. */}
        <div className="border-b border-sidebar-border p-3 pr-12">
          <ShellEventSwitcher />
        </div>
        <SidebarNav
          groups={groups}
          onNavigate={() => setOpen(false)}
          itemClassName="min-h-11"
        />
        <GettingStarted />
      </SheetContent>
    </Sheet>
  )
}
