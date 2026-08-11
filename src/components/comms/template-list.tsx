import { RiEditLine, RiMailLine } from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TEMPLATE_META, templateLabel } from "./constants"
import type { TemplateRow } from "./types"

/**
 * Templates tab — one card per email the event can send (docs/SPEC.md §4.9).
 * Each card answers the two questions an organizer has: what is this email,
 * and when does it go out. Clicking anywhere opens the editor drawer.
 */

export interface TemplateListProps {
  templates: Array<TemplateRow> | undefined
  loading?: boolean
  onEdit: (template: TemplateRow) => void
}

export function TemplateList({
  templates,
  loading,
  onEdit,
}: TemplateListProps) {
  if (loading || !templates) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="gap-3 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {templates.map((template) => (
        <TemplateCard
          key={template.key}
          template={template}
          onEdit={() => onEdit(template)}
        />
      ))}
    </div>
  )
}

function TemplateCard({
  template,
  onEdit,
}: {
  template: TemplateRow
  onEdit: () => void
}) {
  const meta = TEMPLATE_META[template.key]
  const name = templateLabel(template.key, template.name)

  return (
    <Card
      className="group gap-0 p-5 transition-shadow hover:shadow-md"
      data-template-key={template.key}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-[15px] font-semibold text-foreground">
              {name}
            </h3>
            <Badge variant="outline" className="font-mono text-[10px]">
              {template.key}
            </Badge>
            {template.isDefault ? (
              <Badge variant="ghost" className="text-muted-foreground">
                Default wording
              </Badge>
            ) : (
              <Badge variant="secondary">Edited</Badge>
            )}
          </div>
          {meta ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {meta.when}
            </p>
          ) : null}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <RiMailLine size={17} aria-hidden />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Subject
        </p>
        <p className="mt-1 truncate text-sm font-medium text-foreground">
          {template.subject}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {template.body}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <RiEditLine aria-hidden />
          Edit template
        </Button>
      </div>
    </Card>
  )
}
