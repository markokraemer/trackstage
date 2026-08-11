import { useSortable } from "@dnd-kit/sortable"
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
  RiDraggable,
  RiFileCopyLine,
  RiGitBranchLine,
  RiLockLine,
  RiMore2Line,
  RiPencilLine,
  RiSignpostLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RequiredMark } from "./builder-controls"
import { conditionSummary, questionSublabel, questionTypeMeta } from "./model"
import type { FormQuestion } from "./model"

/**
 * One row of the question builder — the most-reused component in the whole
 * product (docs/ux/02 image1/image2: drag handle, label, Locked badge, type
 * sub-label, Required toggle, overflow menu).
 *
 * Reordering works by dragging the grip, by keyboard on the grip, and by
 * "Move up"/"Move down" in the row menu, so it is never a drag-only feature.
 */

export interface QuestionRowProps {
  question: FormQuestion
  /** All questions, in order — used to describe conditions in plain English. */
  questions: Array<FormQuestion>
  onChange: (patch: Partial<FormQuestion>) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}

export function QuestionRow({
  question,
  questions,
  onChange,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: QuestionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const meta = questionTypeMeta(question.type)
  const Icon = meta.icon

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className={cn(
        "relative rounded-xl border border-border bg-card p-3.5 shadow-xs transition-shadow sm:p-4",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/30",
        !question.enabled && "bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Reorder ${question.label}`}
          className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <RiDraggable size={16} aria-hidden />
        </Button>

        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"
        >
          <Icon size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-sm font-semibold text-foreground",
                !question.enabled && "text-muted-foreground",
              )}
            >
              {question.label}
              {question.required ? <RequiredMark /> : null}
            </p>
            {question.locked ? (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <RiLockLine size={11} aria-hidden />
                Locked
              </Badge>
            ) : null}
            {!question.enabled ? (
              <Badge variant="outline" className="text-[11px]">
                Hidden on the form
              </Badge>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {questionSublabel(question)}
          </p>

          {question.help ? (
            <p className="mt-1 text-xs text-muted-foreground italic">
              “{question.help}”
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5 empty:mt-0">
            {question.isTrackQuestion ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-primary">
                <RiSignpostLine size={12} aria-hidden />
                Answers route submissions to the matching track
              </span>
            ) : null}
            {question.showIf ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <RiGitBranchLine size={12} aria-hidden />
                {conditionSummary(questions, question.showIf)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Required
            <Switch
              size="sm"
              checked={question.required}
              disabled={question.locked}
              aria-label={`${question.label} is required`}
              onCheckedChange={(value) => onChange({ required: value })}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Enabled
            <Switch
              size="sm"
              checked={question.enabled}
              disabled={question.locked}
              aria-label={`${question.label} is shown on the form`}
              onCheckedChange={(value) =>
                onChange(
                  value ? { enabled: true } : { enabled: false, required: false },
                )
              }
            />
          </label>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${question.label}`}
            onClick={onEdit}
          >
            <RiPencilLine size={16} aria-hidden />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`More actions for ${question.label}`}
                />
              }
            >
              <RiMore2Line size={16} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onEdit}>
                  <RiPencilLine aria-hidden />
                  Edit question
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isFirst} onClick={() => onMove(-1)}>
                  <RiArrowUpLine aria-hidden />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isLast} onClick={() => onMove(1)}>
                  <RiArrowDownLine aria-hidden />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <RiFileCopyLine aria-hidden />
                  Duplicate
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={question.locked}
                  onClick={onDelete}
                >
                  <RiDeleteBinLine aria-hidden />
                  Delete question
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}
