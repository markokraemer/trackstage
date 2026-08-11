/**
 * Client-side image shrinking, so an over-the-limit photo becomes a smaller
 * one instead of an error. A speaker's 23 MB phone photo is not a mistake to
 * scold them for — the browser can resize it in under a second, and nothing
 * about a headshot needs more than ~1600 px.
 *
 * Hand-rolled on canvas (createImageBitmap → draw capped at 1600 px longest
 * side → JPEG, stepping quality down until it fits) — no dependency needed.
 * The server-side byte limits stay as the backstop; this runs before them.
 */

const MAX_DIMENSION = 1600
const MIN_DIMENSION = 400
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4]

/** The file could not be decoded as an image at all (HEIC in most browsers,
 * corrupt files, things merely named .jpg). */
export class ImageDecodeError extends Error {
  constructor() {
    super(
      "We couldn't read that image — that format isn't supported. Please use a JPG or PNG.",
    )
    this.name = "ImageDecodeError"
  }
}

function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  )
}

/**
 * Returns the file untouched when it is already within `maxBytes`; otherwise
 * decodes it, scales it down and re-encodes as JPEG until it fits. Throws
 * `ImageDecodeError` when the browser cannot decode it (the only real reason
 * to reject a photo).
 */
export async function fitImageWithinLimit(
  file: File,
  maxBytes: number,
): Promise<File> {
  if (file.size <= maxBytes) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageDecodeError()
  }

  try {
    for (
      let dimension = MAX_DIMENSION;
      dimension >= MIN_DIMENSION;
      dimension = Math.round(dimension / 1.5)
    ) {
      const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d")
      if (!context) throw new ImageDecodeError()
      // JPEG has no alpha channel — flatten transparent PNGs onto white, not
      // the default black.
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      for (const quality of QUALITY_STEPS) {
        const blob = await encode(canvas, quality)
        if (blob && blob.size > 0 && blob.size <= maxBytes) {
          const stem = file.name.replace(/\.[^.]+$/, "") || "photo"
          return new File([blob], `${stem}.jpg`, { type: "image/jpeg" })
        }
      }
    }
  } finally {
    bitmap.close()
  }

  // 400 px at quality 0.4 is a few tens of KB — reaching here means the limit
  // is pathologically small, but fail with a sentence rather than a mystery.
  throw new Error(
    "That image couldn't be shrunk far enough — please export it as a smaller JPG and try again.",
  )
}
