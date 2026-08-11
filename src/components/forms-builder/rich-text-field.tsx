import { useId, useRef, useState } from "react"
import {
  RiBold,
  RiItalic,
  RiLinkM,
  RiListUnordered,
  RiText,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BuilderField, CharCounter } from "./builder-controls"

/**
 * Rich-text editor for the welcome / success / instruction copy.
 *
 * Deliberately a real `<textarea>` with a formatting toolbar rather than a
 * contenteditable canvas: organizers get bold/italic/links/lists, screen
 * readers and browser agents get a plain form control they can actually type
 * into, and the stored value stays simple HTML (docs/ux/02 — WYSIWYG panels).
 */

interface ToolbarAction {
  id: string
  label: string
  icon: RemixiconComponentType
  before: string
  after: string
  /** Text inserted when nothing is selected. */
  sample: string
}

const ACTIONS: Array<ToolbarAction> = [
  {
    id: "bold",
    label: "Bold",
    icon: RiBold,
    before: "<strong>",
    after: "</strong>",
    sample: "bold text",
  },
  {
    id: "italic",
    label: "Italic",
    icon: RiItalic,
    before: "<em>",
    after: "</em>",
    sample: "italic text",
  },
  {
    id: "link",
    label: "Link",
    icon: RiLinkM,
    before: '<a href="https://example.com">',
    after: "</a>",
    sample: "link text",
  },
  {
    id: "bullets",
    label: "Bulleted list",
    icon: RiListUnordered,
    before: "<ul>\n  <li>",
    after: "</li>\n</ul>",
    sample: "First point",
  },
  {
    id: "paragraph",
    label: "Paragraph",
    icon: RiText,
    before: "<p>",
    after: "</p>",
    sample: "New paragraph",
  },
]

export interface RichTextFieldProps {
  label: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  description?: React.ReactNode
  placeholder?: string
  required?: boolean
  maxChars?: number
  rows?: number
  className?: string
}

export function RichTextField({
  label,
  value,
  onValueChange,
  description,
  placeholder,
  required,
  maxChars,
  rows = 6,
  className,
}: RichTextFieldProps) {
  const id = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  function applyAction(action: ToolbarAction) {
    const node = textareaRef.current
    if (!node) return
    const start = node.selectionStart
    const end = node.selectionEnd
    const selected = value.slice(start, end) || action.sample
    const next =
      value.slice(0, start) +
      action.before +
      selected +
      action.after +
      value.slice(end)
    onValueChange(next)
    // Put the caret around the newly wrapped text.
    requestAnimationFrame(() => {
      node.focus()
      const caret = start + action.before.length
      node.setSelectionRange(caret, caret + selected.length)
    })
  }

  return (
    <BuilderField
      htmlFor={id}
      label={label}
      required={required}
      description={description}
      hint={maxChars ? <CharCounter value={value} max={maxChars} /> : null}
      className={className}
    >
      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
          <TooltipProvider>
            {ACTIONS.map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={action.label}
                      title={action.label}
                      disabled={preview}
                      onClick={() => applyAction(action)}
                    />
                  }
                >
                  <action.icon size={15} aria-hidden />
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto"
            aria-pressed={preview}
            onClick={() => setPreview((current) => !current)}
          >
            {preview ? "Edit" : "Preview"}
          </Button>
        </div>

        {preview ? (
          <div
            className={cn(
              "prose-organizer min-h-[7rem] px-3 py-2.5 text-sm leading-relaxed",
              "[&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:font-semibold",
            )}
            // Organizer-authored copy for their own public form.
            dangerouslySetInnerHTML={{
              __html: value || "<p>Nothing to preview yet.</p>",
            }}
          />
        ) : (
          <Textarea
            id={id}
            ref={textareaRef}
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onValueChange(event.target.value)}
            className="rounded-none border-0 font-mono text-[13px] shadow-none focus-visible:ring-0"
          />
        )}
      </div>
    </BuilderField>
  )
}
