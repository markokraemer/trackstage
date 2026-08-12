import { RiCloseLine, RiSearchLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/**
 * List toolbar: search on the left, filter controls in the middle, primary
 * action on the right (docs/SPEC.md §2.7, docs/ux/03 image5).
 *
 * Built on the shadcn `InputGroup` primitive for the search control.
 *
 * ```tsx
 * <DataToolbar
 *   value={search}
 *   onValueChange={setSearch}
 *   placeholder="Search submissions…"
 *   filters={<StatusFilter … />}
 *   actions={<Button><RiAddLine /> Add submission</Button>}
 * />
 * ```
 */
export interface DataToolbarProps extends Omit<
  React.ComponentProps<"div">,
  "onChange"
> {
  /** Search text (controlled). Omit both to hide the search box. */
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** Filter/sort/column controls, rendered next to the search box. */
  filters?: React.ReactNode
  /** Right-aligned actions; primary button last. */
  actions?: React.ReactNode
  searchLabel?: string
}

export function DataToolbar({
  value,
  onValueChange,
  placeholder = "Search…",
  filters,
  actions,
  searchLabel = "Search",
  className,
  children,
  ...props
}: DataToolbarProps) {
  const showSearch = value !== undefined || onValueChange !== undefined

  return (
    <div
      data-slot="data-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-2 sm:flex-nowrap",
        className
      )}
      {...props}
    >
      {showSearch ? (
        <InputGroup className="w-full min-w-[200px] bg-card sm:max-w-xs">
          <InputGroupAddon align="inline-start">
            <RiSearchLine aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={searchLabel}
            placeholder={placeholder}
            value={value ?? ""}
            onChange={(event) => onValueChange?.(event.target.value)}
            className="[&::-webkit-search-cancel-button]:hidden"
          />
          {value ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => onValueChange?.("")}
              >
                <RiCloseLine aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      ) : null}

      {filters ? (
        // `min-w-0 max-w-full` lets a scrollable child (e.g. a wide tab strip)
        // actually shrink on phones. Full width below `sm` also prevents the
        // filter cluster from dragging the page into horizontal scroll.
        <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          {filters}
        </div>
      ) : null}

      {children}

      {actions ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
