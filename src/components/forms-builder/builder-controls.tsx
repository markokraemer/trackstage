import { RiInformationLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"

/**
 * The form builder's field furniture, all built on the shadcn `field.tsx`
 * primitives: label ABOVE the input, red asterisk for required, helper text
 * under the label — never inside a placeholder (docs/SPEC.md §2.3).
 */

/** Red asterisk. Announced to screen readers as "required". */
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  )
}

export interface BuilderFieldProps {
  /** Must match the control's `id` so the label is clickable. */
  htmlFor: string
  label: React.ReactNode
  required?: boolean
  /** Plain-English helper, rendered under the label. */
  description?: React.ReactNode
  /** Right-aligned hint next to the label (e.g. a character counter). */
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function BuilderField({
  htmlFor,
  label,
  required,
  description,
  hint,
  className,
  children,
}: BuilderFieldProps) {
  return (
    <Field className={className}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={htmlFor}>
          {label}
          {required ? <RequiredMark /> : null}
          {required ? <span className="sr-only">(required)</span> : null}
        </FieldLabel>
        {hint ? (
          <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {children}
    </Field>
  )
}

/** "26 / 255" counter, turning red when over the limit. */
export function CharCounter({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span className={cn(over && "font-medium text-destructive")}>
      {value.length.toLocaleString()} / {max.toLocaleString()}
    </span>
  )
}

export interface SettingRowProps {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Revealed under the row while the switch is on. */
  children?: React.ReactNode
  className?: string
}

/**
 * A bordered toggle row: label + explanation on the left, switch on the right
 * (docs/ux/02 — the pattern every settings card in the builder uses).
 */
export function SettingRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
  className,
}: SettingRowProps) {
  return (
    <Card size="sm" className={cn("gap-0 p-4", className)}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={id} className="text-sm font-medium">
            {title}
          </FieldLabel>
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
        </FieldContent>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value)}
        />
      </Field>
      {checked && children ? (
        <div className="mt-4 border-t pt-4">{children}</div>
      ) : null}
    </Card>
  )
}

/**
 * The muted intro card every wizard step opens with (docs/ux/02 — "a light
 * gray page-intro card mirroring the rail item's title + description").
 */
export function StepIntro({
  title,
  description,
}: {
  title: React.ReactNode
  description: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3.5">
      <h2 className="font-heading text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

/** Soft blue info banner — used for the "you can change this later" notes. */
export function InfoNote({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-border bg-accent px-3.5 py-3 text-sm text-foreground/80",
        className,
      )}
    >
      <RiInformationLine
        size={16}
        aria-hidden
        className="mt-0.5 shrink-0 text-primary"
      />
      <p className="leading-relaxed">{children}</p>
    </div>
  )
}

/** Step body heading: "Deadlines" + one explanatory line. */
export function SectionHeading({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
