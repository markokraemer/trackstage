import {
  RiFile3Line,
  RiFileExcel2Line,
  RiFilePdf2Line,
  RiFileTextLine,
  RiFileZipLine,
  RiImageLine,
  RiSlideshow3Line,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { createZip, uniqueZipName } from "@/lib/zip"

/**
 * Everything the browser needs to know about files, in one place, so the
 * speaker portal and the organizer app validate, label, upload and download
 * them identically.
 *
 * The limits mirror `convex/lib/files.ts` — the server enforces them against
 * the real bytes it stored, this half exists so a speaker learns their 40 MB
 * keynote is too big BEFORE spending four minutes uploading it.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** `accept` for a general file request: images, PDFs, decks, docs, archives. */
export const FILE_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  ".ppt",
  ".pptx",
  ".key",
  ".odp",
  ".doc",
  ".docx",
  ".odt",
  ".txt",
  ".md",
  ".csv",
  ".zip",
].join(",")

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif"

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "heic", "avif"]
const SLIDE_EXTENSIONS = ["ppt", "pptx", "key", "odp"]
const DOC_EXTENSIONS = ["doc", "docx", "odt", "txt", "md", "rtf"]
const ALLOWED_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  ...SLIDE_EXTENSIONS,
  ...DOC_EXTENSIONS,
  "pdf",
  "csv",
  "zip",
]

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".")
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase()
}

/** "2.4 MB". Returns null for unknown/zero so callers can omit the segment. */
export function formatBytes(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

export function isImage(contentType?: string, filename = ""): boolean {
  if (contentType?.startsWith("image/")) return true
  return IMAGE_EXTENSIONS.includes(extensionOf(filename))
}

/** "PDF" · "Slides" · "Image" — what an organizer would call it out loud. */
export function fileKindLabel(contentType?: string, filename = ""): string {
  const ext = extensionOf(filename)
  if (isImage(contentType, filename)) return "Image"
  if (contentType === "application/pdf" || ext === "pdf") return "PDF"
  if (SLIDE_EXTENSIONS.includes(ext) || contentType?.includes("presentation")) {
    return "Slides"
  }
  if (ext === "csv") return "Spreadsheet"
  if (ext === "zip" || contentType?.includes("zip")) return "Archive"
  if (DOC_EXTENSIONS.includes(ext) || contentType?.startsWith("text/")) {
    return "Document"
  }
  return "File"
}

export function fileIcon(
  contentType?: string,
  filename = "",
): RemixiconComponentType {
  switch (fileKindLabel(contentType, filename)) {
    case "Image":
      return RiImageLine
    case "PDF":
      return RiFilePdf2Line
    case "Slides":
      return RiSlideshow3Line
    case "Spreadsheet":
      return RiFileExcel2Line
    case "Archive":
      return RiFileZipLine
    case "Document":
      return RiFileTextLine
    default:
      return RiFile3Line
  }
}

export interface FileValidationOptions {
  maxBytes?: number
  /** Only accept images (headshots, event branding). */
  imagesOnly?: boolean
}

/**
 * Client-side gate, run BEFORE the upload starts. Returns a sentence to show
 * the user, or null when the file is fine.
 */
export function validateFile(
  file: File,
  { maxBytes = MAX_UPLOAD_BYTES, imagesOnly = false }: FileValidationOptions = {},
): string | null {
  if (file.size === 0) {
    return "That file is empty — please choose another one."
  }
  if (file.size > maxBytes) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)} — please choose a smaller one.`
  }
  const ext = extensionOf(file.name)
  if (imagesOnly) {
    return isImage(file.type, file.name)
      ? null
      : "That needs to be an image — a PNG, JPG or WebP."
  }
  if (file.type && !file.type.startsWith("application/octet-stream")) {
    if (isImage(file.type, file.name)) return null
  }
  if (ALLOWED_EXTENSIONS.includes(ext)) return null
  if (
    file.type === "application/pdf" ||
    file.type.includes("presentation") ||
    file.type.includes("word") ||
    file.type.includes("zip") ||
    file.type.startsWith("text/")
  ) {
    return null
  }
  return "That file type isn't accepted. Upload an image, a PDF, a slide deck, a document or a zip."
}

/**
 * POST the bytes to a Convex signed upload URL with real progress.
 *
 * `fetch` can't report upload progress (the request-stream API isn't
 * available everywhere), so this is the one place we reach for XHR: a speaker
 * pushing a 20 MB deck over conference wifi needs to see it moving.
 */
export function uploadToStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("POST", uploadUrl, true)
    if (file.type) request.setRequestHeader("Content-Type", file.type)
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("The file could not be uploaded. Please try again."))
        return
      }
      try {
        const { storageId } = JSON.parse(request.responseText) as {
          storageId: string
        }
        onProgress?.(100)
        resolve(storageId)
      } catch {
        reject(new Error("The upload finished but the server didn't confirm it."))
      }
    }
    request.onerror = () =>
      reject(new Error("The upload failed — check your connection and retry."))
    request.onabort = () => reject(new Error("The upload was cancelled."))
    request.send(file)
  })
}

function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick — Safari needs the URL alive during the click.
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

/** Download one file under its real name (a signed URL alone opens a tab). */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download ${filename}.`)
  saveBlob(await response.blob(), filename)
}

export interface BundleFile {
  url: string | null
  filename: string
}

/**
 * "Download files bundle": fetch every file and hand back ONE .zip — the
 * parity feature from Sessionboard's Options menu. Files that no longer
 * resolve are skipped and reported rather than failing the whole bundle.
 */
export async function downloadFilesBundle(
  files: Array<BundleFile>,
  zipFilename: string,
): Promise<{ included: number; skipped: number }> {
  const taken = new Set<string>()
  const entries = []
  let skipped = 0
  for (const file of files) {
    if (!file.url) {
      skipped++
      continue
    }
    try {
      const response = await fetch(file.url)
      if (!response.ok) throw new Error("not ok")
      const buffer = await response.arrayBuffer()
      entries.push({
        name: uniqueZipName(file.filename, taken),
        data: new Uint8Array(buffer),
      })
    } catch {
      skipped++
    }
  }
  if (entries.length === 0) {
    throw new Error("None of those files could be downloaded.")
  }
  saveBlob(createZip(entries), zipFilename)
  return { included: entries.length, skipped }
}

/**
 * The newest upload in each version slot.
 *
 * The Files library lists every version — that is what a library is for — but a
 * bundle is a handover, and handing the AV team both v1 and v2 of the same deck
 * (arriving as "slides.pdf" and "slides (2).pdf") is how the wrong talk gets
 * projected. One file per slot, the one that supersedes the rest.
 *
 * The slot rule mirrors `convex/lib/files.ts::slotKey`, which is the authority:
 * a task owns its own versions, otherwise a submission owns them per speaker,
 * otherwise they belong to the person.
 */
export function latestVersionsOnly<
  TFile extends {
    version: number
    personId: string
    taskId?: string
    submissionId?: string
  },
>(files: Array<TFile>): Array<TFile> {
  const best = new Map<string, TFile>()
  for (const file of files) {
    const slot = file.taskId
      ? `task:${file.taskId}`
      : file.submissionId
        ? `submission:${file.submissionId}:${file.personId}`
        : `person:${file.personId}`
    const current = best.get(slot)
    if (!current || file.version > current.version) best.set(slot, file)
  }
  // Keep the caller's ordering rather than the Map's insertion quirks.
  const keep = new Set([...best.values()])
  return files.filter((file) => keep.has(file))
}
