import { useId, useState } from "react"
import { RiAddLine, RiCloseLine, RiMailLine } from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldError } from "@/components/ui/field"
import { BuilderField } from "./builder-controls"
import { EMAIL_PATTERN } from "./model"

/**
 * Email recipients as removable chips (docs/ux/02 image7 — the admin
 * notification pickers). Adding works by Enter, by comma, or by the Add
 * button, so a keyboard user, a mouse user and a browser agent all succeed.
 */

export interface EmailChipsInputProps {
  label: React.ReactNode
  description?: React.ReactNode
  value: Array<string>
  onValueChange: (value: Array<string>) => void
  placeholder?: string
  emptyHint?: string
}

export function EmailChipsInput({
  label,
  description,
  value,
  onValueChange,
  placeholder = "name@yourcompany.com",
  emptyHint = "No one is notified yet.",
}: EmailChipsInputProps) {
  const id = useId()
  const [entry, setEntry] = useState("")
  const [error, setError] = useState<string | null>(null)

  function add() {
    const candidate = entry.trim().replace(/,$/, "")
    if (candidate.length === 0) return
    if (!EMAIL_PATTERN.test(candidate)) {
      setError(`“${candidate}” doesn't look like an email address.`)
      return
    }
    if (value.some((email) => email.toLowerCase() === candidate.toLowerCase())) {
      setError("That address is already on the list.")
      return
    }
    onValueChange([...value, candidate])
    setEntry("")
    setError(null)
  }

  return (
    <BuilderField htmlFor={id} label={label} description={description}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          type="email"
          value={entry}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="w-full sm:max-w-xs"
          onChange={(event) => {
            const next = event.target.value
            setError(null)
            if (next.endsWith(",")) {
              setEntry(next.slice(0, -1))
              return
            }
            setEntry(next)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault()
              add()
            }
          }}
          onBlur={() => {
            if (entry.trim().length > 0) add()
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <RiAddLine aria-hidden />
          Add recipient
        </Button>
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((email) => (
            <li key={email}>
              <Badge variant="secondary" className="gap-1.5 py-1 pr-1 pl-2">
                <RiMailLine
                  size={12}
                  aria-hidden
                  className="text-muted-foreground"
                />
                {email}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${email}`}
                  onClick={() =>
                    onValueChange(value.filter((item) => item !== email))
                  }
                >
                  <RiCloseLine size={12} aria-hidden />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </BuilderField>
  )
}
