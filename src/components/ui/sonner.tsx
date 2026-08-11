import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"
import {
  RiCheckboxCircleLine,
  RiInformationLine,
  RiErrorWarningLine,
  RiCloseCircleLine,
  RiLoaderLine,
} from "@remixicon/react"

/**
 * Toasts.
 *
 * `theme` is pinned to `"light"`, NOT the system theme. Trackstage is light
 * mode only (docs/memory/RULES.md #3), and Sonner's dark theme paints the
 * description line `hsl(0 0% 91%)` — near-white on our white popover surface,
 * which is exactly how the "Public link copied" URL went invisible for anyone
 * whose OS was in dark mode. Nothing else in the app follows the system theme,
 * so neither does this.
 *
 * Every colour below comes from a token, and the two text lines are set
 * explicitly (title = ink, description = muted) so no upstream stylesheet gets
 * to decide legibility for us. Both lines clear AA on the popover surface.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      /* Most of these toasts are receipts for something irreversible — mail
         sent, decisions committed — and several carry a count or a URL in the
         description. Four seconds is not long enough to read a two-line receipt
         and act on it; six is, and a toast that has already been read is
         dismissible by clicking it. */
      duration={6000}
      icons={{
        success: <RiCheckboxCircleLine className="size-4" />,
        info: <RiInformationLine className="size-4" />,
        warning: <RiErrorWarningLine className="size-4" />,
        error: <RiCloseCircleLine className="size-4" />,
        loading: <RiLoaderLine className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Sonner's own rules are attribute-scoped and out-specify a bare
          // utility class, hence the `!` on the properties we own outright.
          toast:
            "cn-toast items-start! gap-3! rounded-lg! border! border-border! bg-popover! px-4! py-3.5! text-popover-foreground! shadow-lg! shadow-black/5!",
          title: "text-sm! leading-5! font-medium! text-foreground!",
          description: "mt-0.5! text-sm! leading-5! text-muted-foreground!",
          icon: "mt-0.5! shrink-0!",
          actionButton:
            "h-(--control-h-sm)! rounded-md! bg-primary! px-3! text-sm! font-medium! text-primary-foreground!",
          cancelButton:
            "h-(--control-h-sm)! rounded-md! bg-secondary! px-3! text-sm! font-medium! text-secondary-foreground!",
          closeButton: "border-border! bg-popover! text-muted-foreground!",
          success: "[&_[data-icon]]:text-status-green-dot",
          error: "[&_[data-icon]]:text-status-red-dot",
          warning: "[&_[data-icon]]:text-status-amber-dot",
          info: "[&_[data-icon]]:text-primary",
          loading: "[&_[data-icon]]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
