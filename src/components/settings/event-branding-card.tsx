import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiDeleteBin6Line } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { MAX_IMAGE_BYTES, formatBytes, uploadToStorage } from "@/lib/files"
import { errorMessage } from "@/lib/errors"

/**
 * Settings → Event details → Branding (docs/ux/01 image25).
 *
 * The logo replaces the Trackstage mark on the event's public pages and in
 * the speaker portal header; the background image sits behind the public
 * header. Both are optional — everything falls back to the event name, which
 * is why the previews show exactly what an attendee would see.
 *
 * Replacing or removing an image deletes the file it replaces
 * (`convex/files.ts` → `setEventBranding`): branding has no version history,
 * so keeping the old blob would leak storage for the life of the workspace.
 */
export function EventBrandingCard({ eventId }: { eventId: Id<"events"> }) {
  const { data: branding, isPending } = useQuery(
    convexQuery(api.files.eventBranding, { eventId }),
  )
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const setBranding = useConvexMutation(api.files.setEventBranding)

  async function upload(
    slot: "logo" | "background",
    file: File,
    onProgress: (percent: number) => void,
  ) {
    const uploadUrl = await generateUploadUrl({ eventId })
    const storageId = await uploadToStorage(uploadUrl, file, onProgress)
    await setBranding({
      eventId,
      slot,
      storageId: storageId as Id<"_storage">,
      filename: file.name,
    })
    toast.success(slot === "logo" ? "Logo updated." : "Background updated.")
  }

  async function clear(slot: "logo" | "background") {
    try {
      await setBranding({ eventId, slot, storageId: null })
      toast.success(slot === "logo" ? "Logo removed." : "Background removed.")
    } catch (error) {
      toast.error(errorMessage(error, "Could not remove that image."))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Your logo appears on the public event pages, in the speaker portal
          and in embedded widgets. Speakers and attendees should recognise your
          event, not ours.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-6">
        {isPending ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BrandingSlot
              title="Event logo"
              hint={`Square works best — 300 × 300 pixels or larger. PNG, JPG or WebP, up to ${formatBytes(MAX_IMAGE_BYTES)}.`}
              preview={branding?.logo ?? null}
              previewClassName="size-24 rounded-lg object-contain"
              onUpload={(file, onProgress) => upload("logo", file, onProgress)}
              onClear={() => clear("logo")}
            />
            <BrandingSlot
              title="Header background"
              hint="A wide image behind your public page header — 1600 × 400 pixels or larger. Optional."
              preview={branding?.background ?? null}
              previewClassName="h-24 w-full rounded-lg object-cover"
              onUpload={(file, onProgress) =>
                upload("background", file, onProgress)
              }
              onClear={() => clear("background")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface BrandingPreview {
  url: string | null
  size: number
  contentType?: string
  uploadedAt: number
}

function BrandingSlot({
  title,
  hint,
  preview,
  previewClassName,
  onUpload,
  onClear,
}: {
  title: string
  hint: string
  preview: BrandingPreview | null
  previewClassName: string
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<void>
  onClear: () => void | Promise<void>
}) {
  const [clearing, setClearing] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>

      {preview?.url ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <img
              src={preview.url}
              alt={`${title} preview`}
              className={cn("bg-background", previewClassName)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {formatBytes(preview.size)}
                {preview.contentType ? ` · ${preview.contentType}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${title.toLowerCase()}`}
              disabled={clearing}
              onClick={async () => {
                setClearing(true)
                await onClear()
                setClearing(false)
              }}
            >
              <RiDeleteBin6Line aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      <FileDropZone
        size="sm"
        imagesOnly
        maxBytes={MAX_IMAGE_BYTES}
        label={
          preview?.url
            ? `Drop a new ${title.toLowerCase()} here`
            : `Drop your ${title.toLowerCase()} here, or click to choose one`
        }
        hint={`PNG, JPG or WebP · up to ${formatBytes(MAX_IMAGE_BYTES)}`}
        onUpload={onUpload}
        onError={(message) => toast.error(message)}
      />
    </div>
  )
}
