/**
 * Import speakers from a CSV (sbek SPK-03).
 *
 * Organizers do not build their line-up in one place. It arrives as a
 * spreadsheet from the sponsor team, an export from last year's tool, a list
 * someone typed in Google Sheets. Retyping forty people into a dialog is the
 * kind of chore that makes a product feel hostile — so: drop the file, SEE
 * exactly what will happen to every row, then commit.
 *
 * The preview is the point. Before anything is written the organizer knows
 * which rows are new, which people are already on the roster (and will only
 * have their blanks filled in — never overwritten), which lines repeat, and
 * which are unusable and why. Nothing is silently dropped.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiDownload2Line, RiUploadLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { checkImportRows, parseSpeakerCsv } from "@/lib/csv"
import type { CheckedImportRow, ImportRowStatus } from "@/lib/csv"

export interface ImportSpeakersDialogProps {
  eventId: Id<"events">
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Emails already on the roster — drives the "we'll merge this one" preview. */
  existingEmails: Array<string>
}

const STATUS_LABELS: Record<ImportRowStatus, string> = {
  new: "New speaker",
  existing: "Already here",
  duplicate: "Repeated row",
  invalid: "Can't import",
}

/** Design-system status tones (src/styles.css), same family as StatusPill. */
const STATUS_TONE: Record<ImportRowStatus, string> = {
  new: "border-transparent bg-status-green-bg text-status-green-fg",
  existing: "border-transparent bg-status-blue-bg text-status-blue-fg",
  duplicate: "border-transparent bg-status-amber-bg text-status-amber-fg",
  invalid: "border-transparent bg-status-red-bg text-status-red-fg",
}

/** A file every spreadsheet opens, with the exact headers we read back. */
const TEMPLATE_CSV = [
  "first_name,last_name,email,job_title,company,bio",
  'Ada,Lovelace,ada@example.com,Principal Engineer,Analytical Engines,"Wrote the first algorithm."',
].join("\n")

export function ImportSpeakersDialog({
  eventId,
  open,
  onOpenChange,
  existingEmails,
}: ImportSpeakersDialogProps) {
  const bulkAdd = useConvexMutation(api.speakersAdmin.bulkAdd)
  const [filename, setFilename] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<Array<CheckedImportRow>>([])
  const [importing, setImporting] = React.useState(false)

  React.useEffect(() => {
    if (open) return
    setFilename(null)
    setRows([])
    setImporting(false)
  }, [open])

  const counts = React.useMemo(() => {
    const tally = { new: 0, existing: 0, duplicate: 0, invalid: 0 }
    for (const row of rows) tally[row.status] += 1
    return tally
  }, [rows])

  const importable = counts.new + counts.existing

  async function readFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new Error(
        "That needs to be a .csv file. Export your spreadsheet as CSV and try again.",
      )
    }
    const parsed = parseSpeakerCsv(await file.text())
    if (parsed.error) throw new Error(parsed.error)
    if (parsed.rows.length === 0) {
      throw new Error("That file has a header row but no speakers in it.")
    }
    setRows(checkImportRows(parsed.rows, existingEmails))
    setFilename(file.name)
  }

  async function runImport() {
    const payload = rows
      .filter((row) => row.status === "new" || row.status === "existing")
      .map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName || undefined,
        email: row.email,
        jobTitle: row.jobTitle || undefined,
        company: row.company || undefined,
        bio: row.bio || undefined,
      }))
    if (payload.length === 0) {
      toast.error("There's nothing in this file we can import")
      return
    }
    setImporting(true)
    try {
      const result = await bulkAdd({ eventId, rows: payload })
      const skipped = result.skipped + counts.duplicate + counts.invalid
      onOpenChange(false)
      toast.success(
        `${result.added} added, ${result.updated} updated, ${skipped} skipped`,
        {
          description:
            result.added > 0
              ? "New speakers have a portal already — open a row's menu to copy their link."
              : "Everyone in that file was already on your roster.",
        },
      )
    } catch (error) {
      toast.error("Couldn't import that file", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setImporting(false)
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([TEMPLATE_CSV], { type: "text/csv" }),
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "speakers-template.csv"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import speakers from a CSV</DialogTitle>
          <DialogDescription>
            One row per person, with a header row. We read{" "}
            <span className="font-medium text-foreground">
              name (or first/last name), email, job title, company and bio
            </span>{" "}
            — in any order, under most common column names. Anyone already on
            your roster is matched by email and merged, never duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FileDropZone
            label={
              filename
                ? `${filename} — drop another file to replace it`
                : "Drop your speakers.csv here, or click to choose it"
            }
            hint="A .csv file with a header row · up to 500 speakers at a time"
            size={rows.length > 0 ? "sm" : "default"}
            onUpload={async (file) => {
              await readFile(file)
            }}
            onError={(message) => toast.error(message)}
          />

          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {rows.length} row{rows.length === 1 ? "" : "s"} read
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {counts.new} new, {counts.existing} already here,{" "}
                  {counts.duplicate + counts.invalid} skipped
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Title &amp; company</TableHead>
                      <TableHead>What happens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.line}-${row.email}`}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {row.line}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {`${row.firstName} ${row.lastName}`.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.email || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {[row.jobTitle, row.company]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="outline"
                              className={cn("w-fit", STATUS_TONE[row.status])}
                            >
                              {STATUS_LABELS[row.status]}
                            </Badge>
                            {row.note ? (
                              <span className="text-xs text-muted-foreground">
                                {row.note}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="mt-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <RiDownload2Line aria-hidden />
            Download a template
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void runImport()}
              disabled={importing || importable === 0}
            >
              <RiUploadLine aria-hidden />
              {importing
                ? "Importing…"
                : importable === 0
                  ? "Import speakers"
                  : `Import ${importable} speaker${importable === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
