import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/components/public/format"

/**
 * Speaker headshot with an initials fallback — extends the shadcn `Avatar`.
 *
 * Missing photos are a first-class state on public pages (sbek EMB-12), so the
 * fallback is designed, not accidental: the initials scale with the circle
 * instead of sitting as 14px text inside an 80px disc.
 *
 * The box is sized by CSS before the image resolves, so a gallery of thirty
 * headshots never reflows as they arrive — the only thing that changes inside
 * the reserved circle is initials → photo.
 */

/** Named sizes so the fallback's type scale always matches the circle. */
const SCALE = {
  /** 32px — inline speaker rows on a session card. */
  xs: "size-8 text-[11px]",
  /** 40px — compact lists. */
  sm: "size-10 text-xs",
  /** 56 → 64px — directory rows, session detail. */
  md: "size-14 text-base sm:size-16 sm:text-lg",
  /** 64 → 80px — gallery tiles, speaker page. */
  lg: "size-16 text-lg sm:size-20 sm:text-2xl",
} as const

export interface SpeakerAvatarProps
  extends Omit<React.ComponentProps<typeof Avatar>, "children" | "size"> {
  name: string
  headshotUrl?: string | null
  /** `hideImage` renders initials only (embed field option). */
  hideImage?: boolean
  size?: keyof typeof SCALE
  /** Above-the-fold headshots (detail pages) shouldn't wait for lazy loading. */
  eager?: boolean
}

export function SpeakerAvatar({
  name,
  headshotUrl,
  hideImage,
  size = "xs",
  eager = false,
  className,
  ...props
}: SpeakerAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", SCALE[size], className)} {...props}>
      {headshotUrl && !hideImage ? (
        <AvatarImage
          src={headshotUrl}
          alt={`${name}, headshot`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ) : null}
      <AvatarFallback className="bg-accent font-medium text-accent-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
