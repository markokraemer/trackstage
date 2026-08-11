import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"

/**
 * Types for the public widgets, derived from the Convex contract so the UI can
 * never drift from `convex/publicData.ts`.
 */

export type ScheduleData = NonNullable<
  FunctionReturnType<typeof api.publicData.schedule>
>
export type SpeakersData = NonNullable<
  FunctionReturnType<typeof api.publicData.speakers>
>
export type SessionsListData = NonNullable<
  FunctionReturnType<typeof api.publicData.sessionsList>
>
export type SessionDetailData = NonNullable<
  FunctionReturnType<typeof api.publicData.sessionDetail>
>
export type ItineraryData = NonNullable<
  FunctionReturnType<typeof api.publicData.speakerItinerary>
>

/** The event header shape shared by every public query. */
export type PublicEvent = ScheduleData["event"]

/** A session card's payload (identical across schedule / list / itinerary). */
export type PublicSession = ScheduleData["days"][number]["sessions"][number]

export type PublicSpeaker = PublicSession["speakers"][number]

/** A speaker row in the gallery/directory (speaker + their sessions). */
export type PublicSpeakerRow = SpeakersData["speakers"][number]

export type PublicTrack = ScheduleData["tracks"][number]

export type PublicRoom = ScheduleData["rooms"][number]

export type PublicDay = ScheduleData["days"][number]
