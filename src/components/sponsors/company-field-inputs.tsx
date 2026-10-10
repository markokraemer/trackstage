import { RiEyeLine, RiLock2Line } from "@remixicon/react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** One of the event's company fields, with this sponsor's value. */
export interface CompanyField {
  id: string
  label: string
  kind: "text" | "longText" | "url"
  public: boolean
  value: string | null
}

/**
 * The event's OWN company fields — whatever the organizers defined in Sponsor
 * settings ("LinkedIn", "Booth number", "Industry"), rendered by kind. Used by
 * the organizer's sponsor drawer and by the sponsor's Company page, so both
 * sides always see the same fields in the same order. Nothing here is
 * hardcoded except the three kinds.
 */
export function CompanyFieldInputs({
  fields,
  values,
  onChange,
  onBlurField,
  idPrefix,
  showVisibility = true,
}: {
  fields: Array<CompanyField>
  /** Current draft values by field id. */
  values: Record<string, string>
  onChange: (fieldId: string, value: string) => void
  /** Autosave hook (the portal saves each field when it loses focus). */
  onBlurField?: (fieldId: string) => void
  idPrefix: string
  /** Say whether each value is public or private. */
  showVisibility?: boolean
}) {
  if (fields.length === 0) return null
  return (
    <>
      {fields.map((field) => {
        const id = `${idPrefix}-field-${field.id}`
        const value = values[field.id] ?? ""
        const common = {
          id,
          value,
          onChange: (e: { target: { value: string } }) => onChange(field.id, e.target.value),
          onBlur: onBlurField ? () => onBlurField(field.id) : undefined,
        }
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            {field.kind === "longText" ? (
              <Textarea rows={3} {...common} />
            ) : (
              <Input
                type={field.kind === "url" ? "url" : "text"}
                placeholder={field.kind === "url" ? "https://" : undefined}
                {...common}
              />
            )}
            {showVisibility ? (
              <FieldDescription className="inline-flex items-center gap-1">
                {field.public ? (
                  <>
                    <RiEyeLine size={12} aria-hidden /> Shown on the event site
                  </>
                ) : (
                  <>
                    <RiLock2Line size={12} aria-hidden /> Only the organizers and the sponsor see this
                  </>
                )}
              </FieldDescription>
            ) : null}
          </Field>
        )
      })}
    </>
  )
}

/** `{id → value}` of what changed between two value maps (cleared ⇒ ""). */
export function changedFieldValues(
  saved: Record<string, string>,
  draft: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of new Set([...Object.keys(saved), ...Object.keys(draft)])) {
    if ((saved[id] ?? "") !== (draft[id] ?? "")) out[id] = draft[id] ?? ""
  }
  return out
}

export function fieldValueMap(fields: Array<CompanyField>): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.id, f.value ?? ""]))
}
