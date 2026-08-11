import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

/**
 * The TanStack devtools panel, in its own module so nothing here is ever
 * imported unless somebody explicitly asks for it (see `__root.tsx`).
 *
 * It used to be mounted unconditionally: a floating TanStack badge parked over
 * the bottom-right of every screen in development, popping in a beat after
 * hydration and sitting on top of the app's own content. That is the "weird
 * Vite thing" — it is not Vite, it is this. It is now opt-in behind
 * `VITE_DEVTOOLS=1`, and its (large) dependency tree stays out of the dev
 * module graph entirely when it is off.
 */
export default function DevTools() {
  return (
    <TanStackDevtools
      config={{ position: "bottom-right" }}
      plugins={[
        {
          name: "Tanstack Router",
          render: <TanStackRouterDevtoolsPanel />,
        },
      ]}
    />
  )
}
