import { toast } from "sonner"
import { RiTrophyLine } from "@remixicon/react"

import { Button, buttonVariants } from "@/components/ui/button"
import { EXTERNAL_LINK_PROPS } from "@/components/marketing/links"

export interface DeclareWinnerButtonProps extends Pick<
  React.ComponentProps<typeof Button>,
  "variant" | "size"
> {
  /** Stripe Checkout link. Empty string = not configured yet. */
  checkoutUrl: string
  label?: string
  className?: string
}

/**
 * The joke CTA — the Kill My SaaS prize rendered as a Buy Now button.
 *
 * Once Marko pastes a Stripe Checkout link it becomes a real outbound link;
 * until then it stays clickable and explains itself with a toast instead of
 * silently doing nothing (a dead button would read as a bug to the judges).
 */
export function DeclareWinnerButton({
  checkoutUrl,
  label = "Declare the winner",
  variant = "default",
  size = "lg",
  className,
}: DeclareWinnerButtonProps) {
  const content = (
    <>
      <RiTrophyLine aria-hidden />
      {label}
    </>
  )

  if (checkoutUrl) {
    return (
      <a
        href={checkoutUrl}
        {...EXTERNAL_LINK_PROPS}
        className={buttonVariants({ variant, size, className })}
      >
        {content}
      </a>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() =>
        toast("The checkout link isn't live yet", {
          description:
            "Marko hasn't pasted the Stripe link. Try again after the judging call — the offer stands.",
        })
      }
    >
      {content}
    </Button>
  )
}
