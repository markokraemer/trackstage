import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"

/**
 * Types for the public CFP flow (docs/SPEC.md §4.3).
 *
 * Everything is derived from the `convex/submit.ts` contract so the form the
 * organizer builds and the form the speaker fills can never drift.
 */

export type SubmitForm = NonNullable<
  FunctionReturnType<typeof api.submit.getForm>
>

export type SubmitQuestion = SubmitForm["questions"][number]

export type ParticipantFieldConfig =
  SubmitForm["participantConfig"]["fields"][number]

export type ParticipantConfig = SubmitForm["participantConfig"]

/** Roles a participant can hold. `speaker` is always available. */
export const PARTICIPANT_ROLES = ["speaker", "chairperson", "moderator"] as const

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number]

export const ROLE_LABELS: Record<string, string> = {
  speaker: "Speaker",
  chairperson: "Chairperson",
  moderator: "Moderator",
}

/** One row of the Participants step — mirrors `submit.ts` `participantArg`. */
export interface ParticipantDraft {
  firstName: string
  lastName: string
  email: string
  role: string
  jobTitle?: string
  company?: string
  phone?: string
  bio?: string
}

/** Answer values by question type: text/dropdown = string, multi_select =
 * string[], checkbox = boolean. */
export type AnswerValue = string | Array<string> | boolean | undefined

export type Answers = Record<string, AnswerValue>

/** The whole flow's state — persisted to sessionStorage so a reload or a
 * closed tab never costs a speaker their work. */
export interface SubmitProgress {
  stepIndex: number
  email: string
  portalToken: string
  answers: Answers
  participants: Array<ParticipantDraft>
  draftId?: string
}

export function emptyParticipant(
  role: string = "speaker",
  email = "",
): ParticipantDraft {
  return { firstName: "", lastName: "", email, role }
}
