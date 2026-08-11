import { CopyButton } from "@/components/settings/copy-button"
import { cn } from "@/lib/utils"

/**
 * A read-only code/config block with its own copy button in a small header
 * bar — used throughout the API & MCP settings tab so every snippet is
 * copy-pasteable on its own, and wide lines scroll inside the block rather
 * than the page.
 */
export function CodeSnippet({
  value,
  title,
  copyLabel = "Copy",
  successMessage,
  className,
}: {
  value: string
  title?: string
  copyLabel?: string
  successMessage?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/60 px-3 py-1.5">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {title ?? "Snippet"}
        </span>
        <CopyButton
          value={value}
          label={copyLabel}
          successMessage={successMessage}
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-2 text-xs"
        />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed whitespace-pre text-foreground">
        <code>{value}</code>
      </pre>
    </div>
  )
}
