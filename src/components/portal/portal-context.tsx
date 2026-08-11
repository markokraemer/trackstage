import { createContext, use } from "react"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"

/**
 * Everything the portal screens need, resolved once by the portal shell
 * (`src/routes/portal/route.tsx`) and shared through context so no tab
 * re-queries or flashes a second loading state.
 */

export type PortalHome = FunctionReturnType<typeof api.portal.home>
export type PortalEvent = PortalHome["event"]
export type PortalMe = PortalHome["me"]
export type PortalSubmission = PortalHome["submissions"][number]
export type PortalTask = PortalHome["tasks"][number]

export type PortalUpload = FunctionReturnType<typeof api.portal.myUploads>[number]

export interface PortalContextValue {
  /** The speaker's magic-link token — every portal Convex call takes it. */
  portalToken: string
  home: PortalHome
  signOut: () => void
}

const PortalContext = createContext<PortalContextValue | null>(null)

export const PortalProvider = PortalContext.Provider

export function usePortal(): PortalContextValue {
  const value = use(PortalContext)
  if (!value) {
    throw new Error("usePortal must be used inside the speaker portal shell")
  }
  return value
}
