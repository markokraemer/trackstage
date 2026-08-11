/**
 * A minimal, dependency-free ZIP writer — enough to give organizers the
 * "Download files bundle" button Sessionboard has, without adding a library to
 * a project that otherwise has none for this.
 *
 * Store-only (compression method 0): the payload is slide decks, PDFs and
 * JPEGs, all of which are already compressed, so DEFLATE would buy a few
 * percent in exchange for shipping an inflater. Every writer/OS unzips a
 * stored archive.
 *
 * Format: PKZIP APPNOTE 6.3.3 — local file headers, then the central
 * directory, then the end-of-central-directory record. No ZIP64, so this is
 * good to 4 GB and 65,535 entries; an event's files are nowhere near either.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** MS-DOS date/time, the only timestamp the base ZIP format carries. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  }
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Filenames that survive every unzipper — no separators, no control chars. */
export function safeZipName(name: string): string {
  return (
    name
      .replace(/[/\\]+/g, "-")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f<>:"|?*]/g, "")
      .trim() || "file"
  )
}

/** De-duplicate names the way a download folder does: `deck.pdf`, `deck (2).pdf`. */
export function uniqueZipName(name: string, taken: Set<string>): string {
  const safe = safeZipName(name)
  if (!taken.has(safe)) {
    taken.add(safe)
    return safe
  }
  const dot = safe.lastIndexOf(".")
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ""
  let n = 2
  let candidate = `${stem} (${n})${ext}`
  while (taken.has(candidate)) {
    n += 1
    candidate = `${stem} (${n})${ext}`
  }
  taken.add(candidate)
  return candidate
}

export function createZip(entries: Array<ZipEntry>, now = new Date()): Blob {
  const encoder = new TextEncoder()
  const { time, date } = dosDateTime(now)
  const locals: Array<Uint8Array> = []
  const centrals: Array<Uint8Array> = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // local file header signature
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 filename flag
    lv.setUint16(8, 0, true) // method: stored
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // extra field length
    local.set(nameBytes, 30)
    locals.push(local, entry.data)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true) // central directory signature
    cv.setUint16(4, 20, true) // version made by
    cv.setUint16(6, 20, true) // version needed
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true) // relative offset of local header
    central.set(nameBytes, 46)
    centrals.push(central)

    offset += local.length + size
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true) // end of central directory
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  // One contiguous buffer rather than a list of views: `Blob` only accepts
  // `ArrayBufferView<ArrayBuffer>`, and a Uint8Array we allocate ourselves is
  // the one thing guaranteed to be backed by a plain ArrayBuffer.
  const parts = [...locals, ...centrals, end]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return new Blob([out.buffer], { type: "application/zip" })
}
