import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAttachment2,
  RiCheckLine,
  RiDeleteBin6Line,
  RiFolderDownloadLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { FileList, FileRow } from "@/components/shared/file-row"
import { downloadFilesBundle, uploadToStorage } from "@/lib/files"

/**
 * Files tab of the submission drawer (docs/SPEC.md §4.4).
 *
 * Organizers do three things with a session's files: look at what the speaker
 * sent (with the real size and type, from the `_storage` system table), attach
 * the deck that arrived by email themselves, and take the lot away as one zip
 * — Sessionboard's "Download files bundle", without the wait.
 */
export function SubmissionFiles({
  submissionId,
  eventId,
  title,
}: {
  submissionId: Id<"submissions">
  eventId: Id<"events">
  title: string
}) {
  const { data: files, isPending } = useQuery(
    convexQuery(api.files.submissionFiles, { submissionId }),
  )
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const attachUpload = useConvexMutation(api.files.attachUploadAsOrganizer)
  const reviewUpload = useConvexMutation(api.tasksAdmin.reviewUpload)
  const deleteUpload = useConvexMutation(api.files.deleteUpload)
  const [bundling, setBundling] = useState(false)

  async function handleUpload(
    file: File,
    onProgress: (percent: number) => void,
  ) {
    const uploadUrl = await generateUploadUrl({ eventId })
    const storageId = await uploadToStorage(uploadUrl, file, onProgress)
    await attachUpload({
      submissionId,
      storageId: storageId as Id<"_storage">,
      filename: file.name,
    })
    toast.success(`${file.name} attached to this session.`)
  }

  async function handleBundle() {
    if (!files || files.length === 0) return
    setBundling(true)
    try {
      const result = await downloadFilesBundle(
        files.map((file) => ({ url: file.url, filename: file.filename })),
        `${slugify(title)}-files.zip`,
      )
      toast.success(
        result.skipped > 0
          ? `Downloaded ${result.included} files — ${result.skipped} couldn't be read.`
          : `Downloaded ${result.included} file${result.included === 1 ? "" : "s"}.`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not build the bundle.",
      )
    } finally {
      setBundling(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!files || files.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={RiAttachment2}
          title="No files attached"
          description="Slides, headshots, and anything a speaker uploads against this submission show up here with their approval status. You can also attach a file yourself — handy when a deck arrives by email."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {files.length} file{files.length === 1 ? "" : "s"}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={bundling}
              onClick={() => void handleBundle()}
            >
              <RiFolderDownloadLine aria-hidden />
              {bundling ? "Preparing…" : "Download all"}
            </Button>
          </div>

          <FileList>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                meta={
                  file.personName
                    ? `${file.personName}${file.reviewNote ? ` · “${file.reviewNote}”` : ""}`
                    : undefined
                }
                actions={
                  <>
                    {file.approvalStatus !== "approved" ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Approve ${file.filename}`}
                        onClick={() =>
                          void reviewUpload({
                            uploadId: file.id,
                            approvalStatus: "approved",
                          }).then(
                            () => toast.success("File approved."),
                            (error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not approve that file.",
                              ),
                          )
                        }
                      >
                        <RiCheckLine aria-hidden />
                      </Button>
                    ) : null}
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${file.filename}`}
                          />
                        }
                      >
                        <RiDeleteBin6Line aria-hidden />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete version {file.version} of {file.filename}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            The file is removed from storage for good — the
                            speaker's other versions are untouched. Use this for
                            a rejected file nobody should keep.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() =>
                              void deleteUpload({ uploadId: file.id }).then(
                                () => toast.success("File deleted."),
                                (error: unknown) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Could not delete that file.",
                                  ),
                              )
                            }
                          >
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                }
              />
            ))}
          </FileList>
        </>
      )}

      <FileDropZone
        label="Attach a file for this session"
        hint="Filed against the primary speaker, exactly as if they had uploaded it themselves."
        onUpload={handleUpload}
        onError={(message) => toast.error(message)}
      />
    </div>
  )
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "session"
  )
}
