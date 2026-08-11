import { cn } from "@/lib/utils"
import { LogoMark, Wordmark } from "@/components/brand/logo"

/**
 * "Powered by ▣ Trackstage" — the one piece of our branding a de-chromed
 * public surface carries.
 *
 * ONE component, every site (Marko, 2026-08-12: "make sure every 'Trackstage'
 * mention like that uses the actual Trackstage logo correctly, 100%"). Before
 * this, the CFP wizard footer spelled the name out as a plain blue text link,
 * the portal footer showed a bare wordmark with no mark, and the public event
 * pages showed a full 22px lockup — three different answers to one question.
 *
 * The rules it encodes:
 * - the MARK is always the real logo, boxed in brand blue, at 16px, so the
 *   attribution is recognisably ours at a glance;
 * - "Powered by" is muted and the wordmark sits one step above it, warming to
 *   full foreground on hover — branded, never shouty;
 * - the whole thing is one link target, and it points at `/`, which *is*
 *   trackstage.app in production and stays correct on dev/staging/preview
 *   where an absolute URL would send people to the wrong deployment.
 *
 * A plain `<a>` on purpose: this renders inside and outside the router (embed
 * frames, error shells), and a full page load to the marketing site is the
 * intended destination anyway.
 */

export type PoweredByTrackstageProps = Omit<React.ComponentProps<"a">, "href">

export function PoweredByTrackstage({
  className,
  ...props
}: PoweredByTrackstageProps) {
  return (
    <a
      href="/"
      data-slot="powered-by"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <span>Powered by</span>
      {/* The lockup's own right-click brand menu would fight the link on a
          surface this small; the mark is attribution here, not a download. */}
      <LogoMark size={16} variant="boxed" disableBrandMenu aria-hidden />
      <Wordmark
        size="sm"
        className="text-xs font-semibold text-foreground/70 transition-colors group-hover:text-foreground"
      />
    </a>
  )
}
