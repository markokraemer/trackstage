import { Link, useParams } from "@tanstack/react-router"

/**
 * The inline "Settings → Rooms & tracks" mention, as a real link straight to
 * that settings page. The wizard autosaves as you type, so following it can
 * never lose form work — no warning needed, just go. Falls back to plain text
 * outside an event route (it never should be, but a link to nowhere is worse).
 */
export function RoomsTracksLink() {
  const { workspaceSlug, eventSlug } = useParams({ strict: false })
  if (!workspaceSlug || !eventSlug) {
    return <span className="font-medium">Settings → Rooms &amp; tracks</span>
  }
  return (
    <Link
      to="/app/$workspaceSlug/$eventSlug/settings/rooms-and-tracks"
      params={{ workspaceSlug, eventSlug }}
      className="font-medium text-primary underline underline-offset-4 hover:no-underline"
    >
      Settings → Rooms &amp; tracks
    </Link>
  )
}
