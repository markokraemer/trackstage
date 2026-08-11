/**
 * Small renderers shared by the submissions selects.
 *
 * Base UI's `Select.Value` prints the raw stored value unless it's told how to
 * label it, so every select in this slice passes one of these as its children —
 * that's what keeps a track cell reading "Agents in production" (with its color
 * dot) instead of a database id.
 */

export interface TrackOption {
  _id: string
  name: string
  color: string
}

/** Colored dot + track name, or a plain fallback label when nothing is set. */
export function TrackValue({
  tracks,
  value,
  empty,
}: {
  tracks: Array<TrackOption>
  value: unknown
  empty: string
}) {
  const track = tracks.find((option) => option._id === String(value))
  if (!track) return <>{empty}</>
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: track.color }}
      />
      {track.name}
    </span>
  )
}

/** A plain choice value, falling back to a readable "not set" label. */
export function ChoiceValue({
  value,
  empty,
  none = "none",
}: {
  value: unknown
  empty: string
  none?: string
}) {
  const text =
    typeof value === "string" && value && value !== none ? value : empty
  return <>{text}</>
}
