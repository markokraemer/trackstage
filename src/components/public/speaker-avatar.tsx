import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/components/public/format"

/**
 * Speaker headshot with an initials fallback — extends the shadcn `Avatar`.
 * Missing photos are a first-class state on public pages (sbek EMB-12), so the
 * fallback is designed, not accidental.
 */
export interface SpeakerAvatarProps
  extends Omit<React.ComponentProps<typeof Avatar>, "children"> {
  name: string
  headshotUrl?: string | null
  /** `hideImage` renders initials only (embed field option). */
  hideImage?: boolean
}

export function SpeakerAvatar({
  name,
  headshotUrl,
  hideImage,
  className,
  ...props
}: SpeakerAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", className)} {...props}>
      {headshotUrl && !hideImage ? (
        <AvatarImage src={headshotUrl} alt={name} />
      ) : null}
      <AvatarFallback className="bg-accent font-medium text-accent-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
