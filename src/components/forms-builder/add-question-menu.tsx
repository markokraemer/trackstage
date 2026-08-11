import { RiAddLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { QUESTION_TYPES } from "./model"
import type { QuestionType } from "./model"

/**
 * "+ Add question" with the answer-type picker (docs/ux/02 image20 —
 * "+ Add Field" opens a field-type picker). Each type carries a plain-English
 * line so a non-technical organizer never has to guess.
 */
export function AddQuestionMenu({
  onAdd,
  label = "Add question",
}: {
  onAdd: (type: QuestionType) => void
  label?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
        <RiAddLine aria-hidden />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Choose an answer type</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {QUESTION_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.value}
              className="items-start gap-2.5 py-2"
              onClick={() => onAdd(type.value)}
            >
              <type.icon
                size={16}
                aria-hidden
                className="mt-0.5 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-xs text-muted-foreground">
                  {type.description}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
