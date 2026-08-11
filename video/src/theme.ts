/**
 * The Trackstage design system, verbatim from `src/styles.css` and
 * `src/components/brand/assets.ts` in the app — the video must look like the
 * same designer made it (Attio-neutral chrome, blue only where it means
 * something, Inter, light mode).
 */
import { loadFont } from "@remotion/google-fonts/Inter"

const inter = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
})

export const FONT = inter.fontFamily

export const color = {
  background: "#FAFAFA",
  card: "#FFFFFF",
  foreground: "#17171A",
  muted: "#6E6E76",
  faint: "#9B9BA1",
  border: "#EAEAEC",
  primary: "#2F5CE0",
  primarySurface: "#EEF2FC",
  green: "#0C8A5A",
} as const

/** Attio-voice display heading: semibold, tight tracking, tight leading. */
export const heading = (size: number): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 600,
  fontSize: size,
  letterSpacing: "-0.032em",
  lineHeight: 1.06,
  color: color.foreground,
})

export const overline = (size = 22): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 600,
  fontSize: size,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: color.faint,
})

export const body = (size = 30): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1.45,
  color: color.muted,
})

/** Logo geometry — `MARK_RECTS` from src/components/brand/assets.ts. */
export const MARK_VIEWBOX = 24
export const MARK_RECTS = [
  { x: 2, y: 3, width: 3.2, height: 18, rx: 1.6, opacity: 1 },
  { x: 7.8, y: 3, width: 14.2, height: 4.6, rx: 2, opacity: 0.4 },
  { x: 7.8, y: 9.7, width: 9.6, height: 4.6, rx: 2, opacity: 1 },
  { x: 7.8, y: 16.4, width: 12.4, height: 4.6, rx: 2, opacity: 0.65 },
] as const

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]
