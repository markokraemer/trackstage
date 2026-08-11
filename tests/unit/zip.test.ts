import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createZip, safeZipName, uniqueZipName } from "../../src/lib/zip"

/**
 * The "Download files bundle" archive is hand-rolled (no dependency), so it is
 * verified two ways: the byte structure by hand, and — the part that actually
 * matters — by handing the file to the operating system's own unzip and
 * checking the contents survive the round trip.
 */

const bytes = (value: string) => new TextEncoder().encode(value)

async function zipBytes(entries: Array<{ name: string; data: Uint8Array }>) {
  const blob = createZip(entries, new Date(Date.UTC(2026, 9, 12, 10, 30, 0)))
  return new Uint8Array(await blob.arrayBuffer())
}

describe("zip writer", () => {
  it("writes the PKZIP signatures in order", async () => {
    const out = await zipBytes([{ name: "a.txt", data: bytes("hello") }])
    const view = new DataView(out.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50) // local file header
    // End-of-central-directory is the last 22 bytes of a comment-less archive.
    expect(view.getUint32(out.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(out.length - 22 + 10, true)).toBe(1) // entry count
  })

  it("records one central-directory entry per file", async () => {
    const out = await zipBytes([
      { name: "a.txt", data: bytes("one") },
      { name: "b.txt", data: bytes("two") },
    ])
    const view = new DataView(out.buffer)
    expect(view.getUint16(out.length - 22 + 10, true)).toBe(2)
  })

  it("declares the stored (uncompressed) method and the real size", async () => {
    const payload = bytes("some slide bytes")
    const out = await zipBytes([{ name: "deck.pdf", data: payload }])
    const view = new DataView(out.buffer)
    expect(view.getUint16(8, true)).toBe(0) // method 0 = stored
    expect(view.getUint32(18, true)).toBe(payload.length) // compressed size
    expect(view.getUint32(22, true)).toBe(payload.length) // uncompressed size
  })

  it("round-trips through the operating system's unzip", async () => {
    const out = await zipBytes([
      { name: "notes.txt", data: bytes("speaker notes") },
      { name: "deck.txt", data: bytes("slide one\nslide two") },
    ])
    const dir = mkdtempSync(join(tmpdir(), "sb-zip-"))
    const archive = join(dir, "bundle.zip")
    writeFileSync(archive, out)
    execFileSync("unzip", ["-qq", "-o", archive, "-d", dir])
    expect(readFileSync(join(dir, "notes.txt"), "utf8")).toBe("speaker notes")
    expect(readFileSync(join(dir, "deck.txt"), "utf8")).toBe(
      "slide one\nslide two",
    )
  })

  it("sanitises names that would escape the archive", () => {
    expect(safeZipName("../../etc/passwd")).toBe("..-..-etc-passwd")
    expect(safeZipName("   ")).toBe("file")
  })

  it("de-duplicates repeated filenames the way a download folder does", () => {
    const taken = new Set<string>()
    expect(uniqueZipName("deck.pdf", taken)).toBe("deck.pdf")
    expect(uniqueZipName("deck.pdf", taken)).toBe("deck (2).pdf")
    expect(uniqueZipName("deck.pdf", taken)).toBe("deck (3).pdf")
  })
})
