import { RiInformationLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * The settings form field: label above the input, red asterisk when required,
 * an "(i)" tooltip for anything non-obvious, helper text under the label, and
 * the error under the control (docs/SPEC.md §2.3, docs/ux/01 image25).
 *
 * Built on the shadcn `Field` primitives — Base UI has no react-hook-form
 * `Form`, so `Field` + `FieldLabel` + `FieldError` is the house pattern.
 */
export interface LabeledFieldProps
  extends Omit<React.ComponentProps<typeof Field>, "title"> {
  label: React.ReactNode
  /** Ties the label to the control. Required for real inputs. */
  htmlFor?: string
  required?: boolean
  /** Plain-English "why we ask" line, shown under the label. */
  description?: React.ReactNode
  /** Contents of the "(i)" tooltip. */
  hint?: React.ReactNode
  /** Validation message. Renders red and marks the field invalid. */
  error?: string
  /** Rendered under the control — e.g. a live URL preview. */
  footer?: React.ReactNode
  children: React.ReactNode
}

export function LabeledField({
  label,
  htmlFor,
  required,
  description,
  hint,
  error,
  footer,
  children,
  className,
  ...props
}: LabeledFieldProps) {
  return (
    <Field
      data-invalid={error ? true : undefined}
      className={cn("gap-2", className)}
      {...props}
    >
      <FieldLabel htmlFor={htmlFor} className="items-center gap-1.5">
        <span className="text-sm font-medium">
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </span>
        {hint ? <FieldHint label={label}>{hint}</FieldHint> : null}
      </FieldLabel>
      {description ? (
        <FieldDescription className="-mt-1 text-xs">
          {description}
        </FieldDescription>
      ) : null}
      {children}
      {footer ? (
        <FieldDescription className="text-xs">{footer}</FieldDescription>
      ) : null}
      {error ? <FieldError className="text-xs">{error}</FieldError> : null}
    </Field>
  )
}

function FieldHint({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  const accessibleName =
    typeof label === "string" ? `About ${label}` : "More information"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={accessibleName}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <RiInformationLine size={14} aria-hidden />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  )
}
