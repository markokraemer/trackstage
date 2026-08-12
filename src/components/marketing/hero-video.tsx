import * as React from "react"
import { RiCloseLine, RiPlayFill } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { ProductShot } from "@/components/marketing/product-shot"

/**
 * The hero product shot with a launch-film play action (Marko, 2026-08-11:
 * "place it in the hero with action to start playing"). The still stays the
 * hero — it loads instantly and reads as the real product — and the play
 * affordance opens the film in a lightbox. `/launch.mp4` is the 1080p web
 * render of the final cut (81s, ~23 MiB — the Workers static-asset cap is
 * 25 MiB); the full-quality master lives at
 * `video/out/trackstage-launch-final.mp4`.
 *
 * The label's duration has to match the file: re-render the film, re-measure,
 * update it here.
 */
export function HeroVideoShot() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
      <div className="group relative">
        <ProductShot
          variant="dashboard"
          crop="top"
          elevation="lg"
          priority
          className="rounded-b-none"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Play the launch video"
          className="absolute inset-0 flex items-start justify-center rounded-t-xl pt-[18%] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <span
            className={cn(
              "flex items-center gap-2.5 rounded-full border border-border/60 bg-card/95 py-2.5 pr-5 pl-3.5 shadow-lg backdrop-blur transition-transform duration-150",
              "group-hover:scale-[1.04]",
            )}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <RiPlayFill size={18} aria-hidden />
            </span>
            <span className="text-sm font-medium text-foreground">
              Watch the film
              <span className="ml-1.5 text-muted-foreground">81 sec</span>
            </span>
          </span>
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trackstage launch video"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4 backdrop-blur-sm sm:p-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src="/launch.mp4"
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-black shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the video"
              className="absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-muted"
            >
              <RiCloseLine size={18} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
