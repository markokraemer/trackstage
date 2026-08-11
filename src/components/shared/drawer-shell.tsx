import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * Right slide-over drawer, ~480px (docs/SPEC.md §2.5). Used for every
 * create/detail flow so the table underneath never loses its state.
 *
 * ```tsx
 * <DrawerShell
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Add submission"
 *   description="Manually add a session to the program."
 *   footer={<><Button variant="outline">Cancel</Button><Button>Save</Button></>}
 * >
 *   …fields…
 * </DrawerShell>
 * ```
 */
export interface DrawerShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** Tabs (or any strip) pinned under the header, above the scroll area. */
  tabs?: React.ReactNode
  /** Right-aligned footer actions; primary button last. */
  footer?: React.ReactNode
  /** Extra classes for the scrollable body. */
  bodyClassName?: string
  className?: string
  children: React.ReactNode
}

export function DrawerShell({
  open,
  onOpenChange,
  title,
  description,
  tabs,
  footer,
  bodyClassName,
  className,
  children,
}: DrawerShellProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-slot="drawer-shell"
        className={cn(
          "gap-0 bg-card data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]",
          className,
        )}
      >
        <SheetHeader className="gap-1 border-b px-5 py-4 pr-12">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        {tabs ? <div className="border-b px-5 py-2">{tabs}</div> : null}

        <div
          className={cn("min-h-0 flex-1 overflow-y-auto p-5", bodyClassName)}
        >
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
