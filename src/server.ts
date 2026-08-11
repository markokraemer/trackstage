import startEntry from "@tanstack/react-start/server-entry"

/**
 * Custom Worker entry. Exists for exactly one reason: HTTP Range support for
 * the launch film.
 *
 * Cloudflare's static-asset layer (which serves everything in public/) always
 * answers `Range: bytes=…` with a 200 and the FULL body — no `accept-ranges`,
 * no 206. For a 24MB mp4 that means the browser's scrubber cannot seek: the
 * player has to download linearly to the point you drag to (Marko: "has to
 * watch every second — can't skip"). So wrangler.jsonc routes /launch.mp4
 * through this Worker (`assets.run_worker_first`) and we slice the asset
 * stream into proper 206 partial responses ourselves. Everything else is
 * delegated untouched to the TanStack Start handler / the asset layer.
 */

const RANGE_SERVED_PATHS = new Set(["/launch.mp4"])

type AssetsFetcher = {
  fetch: (request: Request) => Promise<Response>
}

interface WorkerEnv {
  ASSETS?: AssetsFetcher
}

// The default entry forwards (request, env, ctx) straight through; its
// published type only admits (request, opts?) — keep runtime behavior
// identical and loosen the type at this one seam.
const delegate = startEntry.fetch as unknown as (
  ...args: Array<unknown>
) => Promise<Response> | Response

export default {
  async fetch(
    request: Request,
    env?: WorkerEnv,
    ctx?: unknown,
  ): Promise<Response> {
    const url = new URL(request.url)
    if (
      RANGE_SERVED_PATHS.has(url.pathname) &&
      env?.ASSETS &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return serveAssetWithRanges(request, env.ASSETS)
    }
    return delegate(request, env, ctx)
  },
}

/** Fetch a static asset and answer Range requests with real 206 slices. */
async function serveAssetWithRanges(
  request: Request,
  assets: AssetsFetcher,
): Promise<Response> {
  // Always GET the full asset: the asset layer ignores Range anyway (that is
  // the bug we are papering over), and conditional headers could turn the
  // response into a body-less 304 while we need bytes to slice.
  const asset = await assets.fetch(
    new Request(request.url, { method: "GET" }),
  )
  if (!asset.ok) return asset

  const headers = new Headers()
  for (const name of ["content-type", "etag", "cache-control", "last-modified"]) {
    const value = asset.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("accept-ranges", "bytes")

  // Production's asset layer sends content-length, so we can slice the stream
  // without ever holding the file. Local dev (miniflare) omits the header —
  // there we buffer the file once and slice the buffer instead.
  const headerTotal = Number(asset.headers.get("content-length"))
  const streamable =
    asset.body !== null && Number.isFinite(headerTotal) && headerTotal > 0
  const buffered = streamable
    ? null
    : new Uint8Array(await asset.arrayBuffer())
  const total = buffered ? buffered.byteLength : headerTotal
  if (total <= 0) {
    return new Response(request.method === "HEAD" ? null : (buffered ?? asset.body), {
      status: 200,
      headers,
    })
  }

  if (request.method === "HEAD") {
    if (!buffered) void asset.body?.cancel()
    headers.set("content-length", String(total))
    return new Response(null, { status: 200, headers })
  }

  // If-Range: when the validator no longer matches, fall back to the full
  // representation instead of slicing a file the client half-cached.
  const ifRange = request.headers.get("if-range")
  const etag = asset.headers.get("etag")
  const rangeHeader =
    ifRange && ifRange !== etag ? null : request.headers.get("range")

  const range = parseRange(rangeHeader, total)
  if (range === "unsatisfiable") {
    if (!buffered) void asset.body?.cancel()
    headers.set("content-range", `bytes */${total}`)
    return new Response(null, { status: 416, headers })
  }
  if (!range) {
    headers.set("content-length", String(total))
    return new Response(buffered ?? asset.body, { status: 200, headers })
  }

  const { start, end } = range
  headers.set("content-range", `bytes ${start}-${end}/${total}`)
  headers.set("content-length", String(end - start + 1))
  const partial = buffered
    ? buffered.subarray(start, end + 1)
    : sliceStream(asset.body as ReadableStream<Uint8Array>, start, end)
  return new Response(partial, { status: 206, headers })
}

/**
 * Parse a single-range `Range` header against a known total size.
 * Returns null for absent/malformed/multi-range headers (we then serve the
 * full 200, which RFC 9110 permits), or "unsatisfiable" for a proper 416.
 */
function parseRange(
  header: string | null,
  total: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (rawStart === "" && rawEnd === "") return null
  if (rawStart === "") {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd)
    if (suffix === 0) return "unsatisfiable"
    return { start: Math.max(total - suffix, 0), end: total - 1 }
  }
  const start = Number(rawStart)
  if (start >= total) return "unsatisfiable"
  const end = rawEnd === "" ? total - 1 : Math.min(Number(rawEnd), total - 1)
  if (end < start) return "unsatisfiable"
  return { start, end }
}

/**
 * Slice [start, end] (inclusive) out of a byte stream without buffering the
 * whole file, cancelling the upstream as soon as the window is served.
 */
function sliceStream(
  body: ReadableStream<Uint8Array>,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  let position = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        const chunkStart = position
        position += value.byteLength
        const chunkEnd = position // exclusive
        if (chunkEnd <= start) continue
        const from = Math.max(start - chunkStart, 0)
        const to = Math.min(end + 1 - chunkStart, value.byteLength)
        if (to > from) controller.enqueue(value.subarray(from, to))
        if (chunkEnd > end) {
          controller.close()
          void reader.cancel().catch(() => undefined)
          return
        }
        // chunkEnd <= end and chunkEnd > start, so something was enqueued:
        // yield until the consumer pulls again.
        return
      }
    },
    cancel(reason) {
      void reader.cancel(reason).catch(() => undefined)
    },
  })
}
