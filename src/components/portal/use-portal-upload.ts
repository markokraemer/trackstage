import { useCallback, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

import { uploadToStorage } from "@/lib/files"
import { usePortal } from "./portal-context"

export interface PortalUploadTarget {
  /** Attach the file to a task — this also completes the task. */
  taskId?: Id<"tasks">
  /** Attach the file to one of my submissions. */
  submissionId?: Id<"submissions">
  /** Replace my profile photo. */
  isHeadshot?: boolean
}

/**
 * The three-step Convex file upload, wrapped so every portal screen does it
 * the same way: ask for a signed URL → PUSH the bytes (with real progress) →
 * record the file against the task/submission/profile.
 *
 * The server re-reads size and MIME type from the `_storage` system table when
 * it attaches, so what we send here is a convenience, never the source of
 * truth.
 */
export function usePortalUpload() {
  const { portalToken } = usePortal()
  const generateUploadUrl = useConvexMutation(api.portal.generateUploadUrl)
  const attachUpload = useConvexMutation(api.portal.attachUpload)
  const [isUploading, setIsUploading] = useState(false)

  const upload = useCallback(
    async (
      file: File,
      target: PortalUploadTarget = {},
      onProgress?: (percent: number) => void,
    ) => {
      setIsUploading(true)
      try {
        const uploadUrl = await generateUploadUrl({ portalToken })
        const storageId = await uploadToStorage(uploadUrl, file, onProgress)
        await attachUpload({
          portalToken,
          storageId: storageId as Id<"_storage">,
          filename: file.name,
          contentType: file.type || undefined,
          size: file.size,
          ...target,
        })
      } finally {
        setIsUploading(false)
      }
    },
    [attachUpload, generateUploadUrl, portalToken],
  )

  return { upload, isUploading }
}
