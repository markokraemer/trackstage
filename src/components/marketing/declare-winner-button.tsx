import { toast } from "sonner"
import { RiTrophyLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { EXTERNAL_LINK_PROPS } from "@/components/marketing/links"

export interface DeclareWinnerButtonProps {
  /** Stripe Checkout link. Empty string = not configured yet. */
  checkoutUrl: string
  className?: string
}

/**
 * The joke CTA. Once Marko pastes a Stripe Checkout link it becomes a real
 * outbound link; until then it stays clickable and explains itself instead of
 * silently doing nothing (a dead button would read as a bug to the judges).
 */
export function DeclareWinnerButton({
  checkoutUrl,
  className,
}: DeclareWinnerButtonProps) {
  const label = (
    <>
      <RiTrophyLine aria-hidden />
      Declare the winner ($10,000)
    </>
  )

  if (checkoutUrl) {
    return (
      <Button
        variant="ghost"
        size="lg"
        className={className}
        render={<a href={checkoutUrl} {...EXTERNAL_LINK_PROPS} />}
      >
        {label}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="lg"
      className={className}
      onClick={() =>
        toast("Marko hasn't pasted his Stripe link yet", {
          description: "Check back after the judging call.",
        })
      }
    >
      {label}
    </Button>
  )
}
