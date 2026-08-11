import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"

/**
 * The Communications contract, taken straight from `convex/comms.ts` so the UI
 * can never drift from the backend shapes.
 */

/** One row of `api.comms.listTemplates` — stored override or built-in default. */
export type TemplateRow = FunctionReturnType<
  typeof api.comms.listTemplates
>[number]

/** One row of `api.comms.listMessages` — a message plus recipient join fields. */
export type MessageRow = FunctionReturnType<
  typeof api.comms.listMessages
>[number]
