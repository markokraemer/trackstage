import * as React from "react"
import { RiExternalLinkLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EXTERNAL_LINK_PROPS } from "@/components/marketing/links"

/**
 * Scalar's interactive API reference, mounted client-side from their standalone
 * bundle.
 *
 * It runs FULL PAGE (`/docs/api` is a standalone route outside the docs shell)
 * because that is the layout Scalar is built for: its own sidebar, its own
 * three-column endpoint reader, its own request runner. Squeezing it into the
 * docs content column produced a sidebar-inside-a-sidebar and a squashed
 * example panel — hence the dedicated route.
 *
 * We load it from a CDN rather than as a dependency deliberately: it is a
 * 1MB-plus reader that only this one route needs, and keeping it out of the app
 * bundle keeps every other page fast (RULES.md 26). A blocked CDN degrades to a
 * link to the raw specification instead of an empty page.
 */

const SCALAR_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference"
const LOAD_TIMEOUT_MS = 8000

declare global {
  interface Window {
    Scalar?: {
      createApiReference: (
        selector: string | Element,
        configuration: Record<string, unknown>
      ) => { destroy?: () => void }
    }
  }
}

export function ScalarReference({ specUrl }: { specUrl: string }) {
  const mountRef = React.useRef<HTMLDivElement | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "failed">(
    "loading"
  )

  React.useEffect(() => {
    let cancelled = false
    let instance: { destroy?: () => void } | undefined
    let observer: MutationObserver | undefined

    function repairVendorAccessibility() {
      if (!mountRef.current) return

      // Scalar 1.44 renders its API-key editor as an incomplete ARIA combobox
      // (no name, expanded state, or controlled list). It behaves as a plain
      // editable field here, so expose the semantics it actually implements.
      for (const editor of mountRef.current.querySelectorAll<HTMLElement>(
        '[data-placeholder="api-key"]'
      )) {
        editor.setAttribute("role", "textbox")
        editor.setAttribute("aria-label", "API key")
        editor.removeAttribute("aria-autocomplete")
        editor.removeAttribute("aria-expanded")
        editor.removeAttribute("aria-controls")
      }

      // Code samples scroll horizontally. Keyboard users need to be able to
      // focus those regions and pan them without a mouse.
      for (const region of mountRef.current.querySelectorAll<HTMLElement>(
        "pre, code.custom-scroll"
      )) {
        if (region.scrollWidth > region.clientWidth) region.tabIndex = 0
      }
    }

    function mount() {
      if (cancelled || !mountRef.current || !window.Scalar) return
      try {
        instance = window.Scalar.createApiReference(mountRef.current, {
          url: specUrl,
          // Our own tokens are light-only; keep the reader in step (RULES.md 3).
          forceDarkModeState: "light",
          darkMode: false,
          hideDarkModeToggle: true,
          // Scalar owns this page, so it gets the layout it was designed for:
          // its own operation sidebar and the side-by-side example column.
          layout: "modern",
          showSidebar: true,
          showToolbar: "never",
          hideModels: false,
          documentDownloadType: "json",
        })
        repairVendorAccessibility()
        observer = new MutationObserver(repairVendorAccessibility)
        observer.observe(mountRef.current, { childList: true, subtree: true })
        setState("ready")
      } catch {
        setState("failed")
      }
    }

    if (window.Scalar) {
      mount()
      return () => {
        cancelled = true
        observer?.disconnect()
        instance?.destroy?.()
      }
    }

    const timer = window.setTimeout(() => {
      if (!cancelled && !window.Scalar) setState("failed")
    }, LOAD_TIMEOUT_MS)

    const script = document.createElement("script")
    script.src = SCALAR_CDN
    script.async = true
    script.onload = mount
    script.onerror = () => {
      if (!cancelled) setState("failed")
    }
    document.head.appendChild(script)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      observer?.disconnect()
      instance?.destroy?.()
    }
  }, [specUrl])

  if (state === "failed") {
    return (
      <div className="container-page py-16">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            The interactive reference could not load. The specification itself
            is right here.
          </p>
          <a
            href={specUrl}
            {...EXTERNAL_LINK_PROPS}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "mt-3",
            })}
          >
            <RiExternalLinkLine size={16} aria-hidden />
            Open openapi.json
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <style>{`
        .scalar-docs .scalar-app {
          --scalar-color-1: #1b1e27;
          --scalar-color-2: #334155;
          --scalar-color-3: #475569;
          --scalar-color-accent: #1d4ed8;
        }
        .scalar-docs .scalar-app :is(pre, code),
        .scalar-docs .scalar-app :is(pre, code) *,
        .scalar-docs .scalar-app :is(.badge, .endpoint-method, .sidebar-heading-type),
        .scalar-docs .scalar-app :is(.badge, .endpoint-method, .sidebar-heading-type) * {
          color: #1b1e27 !important;
        }
        .scalar-docs .scalar-app :is(.sidebar-search-placeholder, .client-libraries-text) {
          color: #475569 !important;
        }
        .scalar-docs .scalar-app [class~="hover:text-sidebar-c-1"] {
          color: #334155 !important;
        }
      `}</style>
      {state === "loading" ? (
        <div className="container-page space-y-3 py-10" aria-hidden>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="mt-6 h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      <div
        ref={mountRef}
        data-loaded={state === "ready" ? "true" : undefined}
        className="scalar-docs [&_.scalar-app]:bg-transparent"
      />
    </div>
  )
}
