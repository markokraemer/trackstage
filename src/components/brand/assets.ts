/**
 * Brand asset kit — one source of truth for the Sessionboard logo geometry,
 * plus pure client-side SVG/PNG generators for every asset we could need
 * (docs/memory/RULES.md #18). No server assets, no build step: the same rect
 * geometry drives the React `<LogoMark>`, the downloadable SVGs, the rasterised
 * PNGs, the social avatar, the OG banner, and the favicon.
 */

export const BRAND_PRIMARY = "#2F5CE0"
export const BRAND_NAVY = "#17171A"
export const BRAND_MUTED = "#6E6E76"
export const BRAND_SURFACE = "#FAFAFA"
export const BRAND_WHITE = "#FFFFFF"

export const WORDMARK = "Sessionboard"
export const BRAND_TAGLINE =
  "Open-source speaker and program management"

/** The mark is drawn in a 24×24 box. */
export const MARK_VIEWBOX = 24

export interface MarkRect {
  x: number
  y: number
  width: number
  height: number
  rx: number
  opacity: number
}

/** Time rail + three session blocks. */
export const MARK_RECTS: Array<MarkRect> = [
  { x: 2, y: 3, width: 3.2, height: 18, rx: 1.6, opacity: 1 },
  { x: 7.8, y: 3, width: 14.2, height: 4.6, rx: 2, opacity: 0.4 },
  { x: 7.8, y: 9.7, width: 9.6, height: 4.6, rx: 2, opacity: 1 },
  { x: 7.8, y: 16.4, width: 12.4, height: 4.6, rx: 2, opacity: 0.65 },
]

export type BrandVariant =
  | "mark-boxed"
  | "mark-plain"
  | "lockup"
  | "wordmark"

/** `color` = brand blue on transparent; `inverse` = white, for dark surfaces. */
export type BrandTone = "color" | "inverse"

const FONT_STACK = `'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`

/** Wordmark width as a multiple of its font size (Inter Semibold, tight). */
const WORDMARK_WIDTH_RATIO = 6.35
/** Lockup metrics, all relative to the mark size. */
const LOCKUP_GAP = 0.28
const LOCKUP_FONT = 0.62

function markColor(tone: BrandTone): string {
  return tone === "inverse" ? BRAND_WHITE : BRAND_PRIMARY
}

function rectsMarkup(color: string, scale = 1, dx = 0, dy = 0): string {
  return MARK_RECTS.map((rect) => {
    const x = (rect.x * scale + dx).toFixed(3)
    const y = (rect.y * scale + dy).toFixed(3)
    const w = (rect.width * scale).toFixed(3)
    const h = (rect.height * scale).toFixed(3)
    const rx = (rect.rx * scale).toFixed(3)
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}" opacity="${rect.opacity}"/>`
  }).join("")
}

function svgDocument(
  width: number,
  height: number,
  body: string,
  title: string,
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    body,
    `</svg>`,
  ].join("")
}

/** Mark on its own, filling the whole canvas. */
export function markSvg(size: number, tone: BrandTone = "color"): string {
  const scale = size / MARK_VIEWBOX
  return svgDocument(
    size,
    size,
    rectsMarkup(markColor(tone), scale),
    `${WORDMARK} logomark`,
  )
}

/** Mark inside a rounded brand-petrol (or white) tile — the app icon shape. */
export function markBoxedSvg(
  size: number,
  tone: BrandTone = "color",
  cornerRatio = 0.22,
): string {
  const boxFill = tone === "inverse" ? BRAND_WHITE : BRAND_PRIMARY
  const glyphFill = tone === "inverse" ? BRAND_PRIMARY : BRAND_WHITE
  const glyph = size * 0.62
  const scale = glyph / MARK_VIEWBOX
  const offset = (size - glyph) / 2
  const radius = (size * cornerRatio).toFixed(3)
  return svgDocument(
    size,
    size,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${boxFill}"/>` +
      rectsMarkup(glyphFill, scale, offset, offset),
    `${WORDMARK} app icon`,
  )
}

/** Wordmark only. `size` is the cap height driver (the font size). */
export function wordmarkSvg(fontSize: number, tone: BrandTone = "color"): string {
  const color = tone === "inverse" ? BRAND_WHITE : BRAND_NAVY
  const width = Math.round(fontSize * WORDMARK_WIDTH_RATIO)
  const height = Math.round(fontSize * 1.35)
  return svgDocument(
    width,
    height,
    `<text x="0" y="${(height * 0.72).toFixed(2)}" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="600" letter-spacing="${(-fontSize * 0.02).toFixed(3)}" fill="${color}">${WORDMARK}</text>`,
    `${WORDMARK} wordmark`,
  )
}

/** Full lockup: mark + wordmark. `markSize` drives every other measurement. */
export function lockupSvg(markSize: number, tone: BrandTone = "color"): string {
  const scale = markSize / MARK_VIEWBOX
  const gap = markSize * LOCKUP_GAP
  const fontSize = markSize * LOCKUP_FONT
  const textWidth = fontSize * WORDMARK_WIDTH_RATIO
  const width = Math.round(markSize + gap + textWidth)
  const height = Math.round(markSize)
  const textColor = tone === "inverse" ? BRAND_WHITE : BRAND_NAVY
  return svgDocument(
    width,
    height,
    rectsMarkup(markColor(tone), scale) +
      `<text x="${(markSize + gap).toFixed(2)}" y="${(height / 2).toFixed(2)}" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${fontSize.toFixed(2)}" font-weight="600" letter-spacing="${(-fontSize * 0.02).toFixed(3)}" fill="${textColor}">${WORDMARK}</text>`,
    `${WORDMARK} logo`,
  )
}

/** 1:1 social profile picture — mark centred on brand blue. */
export function socialAvatarSvg(size: number): string {
  const glyph = size * 0.52
  const scale = glyph / MARK_VIEWBOX
  const offset = (size - glyph) / 2
  return svgDocument(
    size,
    size,
    `<rect width="${size}" height="${size}" fill="${BRAND_PRIMARY}"/>` +
      rectsMarkup(BRAND_WHITE, scale, offset, offset),
    `${WORDMARK} profile picture`,
  )
}

/** 1200×630 Open Graph banner: lockup + tagline on the light surface. */
export function ogImageSvg(): string {
  const width = 1200
  const height = 630
  const markSize = 120
  const scale = markSize / MARK_VIEWBOX
  const left = 96
  const markTop = 190
  return svgDocument(
    width,
    height,
    [
      `<rect width="${width}" height="${height}" fill="${BRAND_SURFACE}"/>`,
      `<rect x="0" y="0" width="${width}" height="10" fill="${BRAND_PRIMARY}"/>`,
      rectsMarkup(BRAND_PRIMARY, scale, left, markTop),
      `<text x="${left + markSize + 34}" y="${markTop + markSize / 2}" dominant-baseline="central" font-family="${FONT_STACK}" font-size="76" font-weight="600" letter-spacing="-1.6" fill="${BRAND_NAVY}">${WORDMARK}</text>`,
      `<text x="${left}" y="${markTop + markSize + 96}" font-family="${FONT_STACK}" font-size="40" font-weight="500" letter-spacing="-0.6" fill="${BRAND_MUTED}">${BRAND_TAGLINE}</text>`,
      `<text x="${left}" y="${markTop + markSize + 156}" font-family="${FONT_STACK}" font-size="28" font-weight="500" letter-spacing="-0.2" fill="${BRAND_PRIMARY}">Call for speakers · Review · Speaker portal · Agenda</text>`,
    ].join(""),
    `${WORDMARK} — ${BRAND_TAGLINE}`,
  )
}

/** The SVG for a given logo variant at a given size. */
export function brandSvg(
  variant: BrandVariant,
  tone: BrandTone,
  size: number,
): string {
  switch (variant) {
    case "mark-boxed":
      return markBoxedSvg(size, tone)
    case "mark-plain":
      return markSvg(size, tone)
    case "wordmark":
      return wordmarkSvg(size * 0.62, tone)
    case "lockup":
      return lockupSvg(size, tone)
  }
}

/* ------------------------------------------------------------- downloads */

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give Safari/Firefox a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), filename)
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not rasterise the SVG."))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Could not encode the PNG."))
    }, "image/png")
  })
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.")
  return { canvas, ctx }
}

function setFont(
  ctx: CanvasRenderingContext2D,
  weight: number,
  size: number,
  tracking = -0.02,
): void {
  ctx.font = `${weight} ${size}px ${FONT_STACK}`
  // letterSpacing is Chromium/Safari 17+; harmless where unsupported.
  try {
    ctx.letterSpacing = `${(size * tracking).toFixed(2)}px`
  } catch {
    /* ignore */
  }
}

/**
 * Rasterise a variant. Text is drawn with Canvas 2D (not inside the SVG) so the
 * loaded Inter Variable webfont is actually used — an `<img>` built from an SVG
 * blob cannot load webfonts.
 */
async function renderBrandCanvas(
  variant: BrandVariant,
  tone: BrandTone,
  px: number,
): Promise<HTMLCanvasElement> {
  await document.fonts.ready

  if (variant === "mark-boxed" || variant === "mark-plain") {
    const svg =
      variant === "mark-boxed" ? markBoxedSvg(px, tone) : markSvg(px, tone)
    const image = await loadSvgImage(svg)
    const { canvas, ctx } = createCanvas(px, px)
    ctx.drawImage(image, 0, 0, px, px)
    return canvas
  }

  if (variant === "wordmark") {
    const fontSize = Math.round(px * 0.62)
    const { canvas: probe, ctx: probeCtx } = createCanvas(1, 1)
    setFont(probeCtx, 600, fontSize)
    const width = Math.ceil(probeCtx.measureText(WORDMARK).width)
    probe.remove()
    const height = Math.round(fontSize * 1.35)
    const { canvas, ctx } = createCanvas(width, height)
    setFont(ctx, 600, fontSize)
    ctx.fillStyle = tone === "inverse" ? BRAND_WHITE : BRAND_NAVY
    ctx.textBaseline = "middle"
    ctx.fillText(WORDMARK, 0, height / 2)
    return canvas
  }

  // lockup — `px` is the mark size.
  const markSize = px
  const gap = markSize * LOCKUP_GAP
  const fontSize = Math.round(markSize * LOCKUP_FONT)
  const { canvas: probe, ctx: probeCtx } = createCanvas(1, 1)
  setFont(probeCtx, 600, fontSize)
  const textWidth = Math.ceil(probeCtx.measureText(WORDMARK).width)
  probe.remove()

  const { canvas, ctx } = createCanvas(
    Math.ceil(markSize + gap + textWidth),
    markSize,
  )
  const image = await loadSvgImage(markSvg(markSize, tone))
  ctx.drawImage(image, 0, 0, markSize, markSize)
  setFont(ctx, 600, fontSize)
  ctx.fillStyle = tone === "inverse" ? BRAND_WHITE : BRAND_NAVY
  ctx.textBaseline = "middle"
  ctx.fillText(WORDMARK, markSize + gap, markSize / 2)
  return canvas
}

export async function downloadBrandPng(
  variant: BrandVariant,
  tone: BrandTone,
  px: number,
  filename: string,
): Promise<void> {
  const canvas = await renderBrandCanvas(variant, tone, px)
  triggerDownload(await canvasToBlob(canvas), filename)
}

/** Square social avatar PNG (400 or 1024). */
export async function downloadSocialAvatarPng(px: number): Promise<void> {
  const image = await loadSvgImage(socialAvatarSvg(px))
  const { canvas, ctx } = createCanvas(px, px)
  ctx.drawImage(image, 0, 0, px, px)
  triggerDownload(await canvasToBlob(canvas), `sessionboard-social-${px}.png`)
}

/** 1200×630 OG banner PNG, text drawn with the real Inter. */
export async function downloadOgImagePng(): Promise<void> {
  await document.fonts.ready
  const width = 1200
  const height = 630
  const { canvas, ctx } = createCanvas(width, height)

  ctx.fillStyle = BRAND_SURFACE
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = BRAND_PRIMARY
  ctx.fillRect(0, 0, width, 10)

  const markSize = 120
  const left = 96
  const markTop = 190
  const image = await loadSvgImage(markSvg(markSize, "color"))
  ctx.drawImage(image, left, markTop, markSize, markSize)

  ctx.textBaseline = "middle"
  setFont(ctx, 600, 76)
  ctx.fillStyle = BRAND_NAVY
  ctx.fillText(WORDMARK, left + markSize + 34, markTop + markSize / 2)

  setFont(ctx, 500, 40, -0.015)
  ctx.fillStyle = BRAND_MUTED
  ctx.fillText(BRAND_TAGLINE, left, markTop + markSize + 96)

  setFont(ctx, 500, 28, -0.01)
  ctx.fillStyle = BRAND_PRIMARY
  ctx.fillText(
    "Call for speakers · Review · Speaker portal · Agenda",
    left,
    markTop + markSize + 156,
  )

  triggerDownload(await canvasToBlob(canvas), "sessionboard-og-1200x630.png")
}

/** Favicon PNG at a given pixel size, from the boxed mark. */
export async function downloadFaviconPng(px: number): Promise<void> {
  const image = await loadSvgImage(markBoxedSvg(px, "color", 0.18))
  const { canvas, ctx } = createCanvas(px, px)
  ctx.drawImage(image, 0, 0, px, px)
  triggerDownload(await canvasToBlob(canvas), `favicon-${px}.png`)
}
