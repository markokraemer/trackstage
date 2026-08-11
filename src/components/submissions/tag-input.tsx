import { useState } from "react"
import { RiCloseLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

/**
 * Free-form tag entry as removable chips (docs/ux/03: Tags are flat, gray,
 * multi-value — unlike the colored single-select Track). Extends the shadcn
 * `Input` + `Badge` primitives; Enter or comma commits a tag.
 */
export interface TagInputProps {
  id?: string
  value: Array<string>
  onChange: (value: Array<string>) => void
  placeholder?: string
  className?: string
}

export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type a tag and press Enter",
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState("")

  function commit(raw: string) {
    const tag = raw.trim().replace(/,$/, "").trim()
    if (!tag || value.includes(tag)) {
      setDraft("")
      return
    }
    onChange([...value, tag])
    setDraft("")
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value
          if (next.endsWith(",")) commit(next)
          else setDraft(next)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(draft)
          } else if (event.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft && commit(draft)}
      />
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="inline-flex size-4 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <RiCloseLine size={12} aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
