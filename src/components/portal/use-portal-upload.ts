import { useCallback, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

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
 * the same way: ask for a signed URL → POST the file → record it against the
 * task/submission/profile.
 */
export function usePortalUpload() {
  const { portalToken } = usePortal()
  const generateUploadUrl = useConvexMutation(api.portal.generateUploadUrl)
  const attachUpload = useConvexMutation(api.portal.attachUpload)
  const [isUploading, setIsUploading] = useState(false)

  const upload = useCallback(
    async (file: File, target: PortalUploadTarget = {}) => {
      setIsUploading(true)
      try {
        const uploadUrl = await generateUploadUrl({ portalToken })
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: file.type ? { "Content-Type": file.type } : undefined,
          body: file,
        })
        if (!response.ok) {
          throw new Error("The file could not be uploaded. Please try again.")
        }
        const { storageId } = (await response.json()) as { storageId: string }
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
