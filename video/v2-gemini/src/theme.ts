import { loadFont } from "@remotion/google-fonts/Inter";

const inter = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const FONT = inter.fontFamily;

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
  red: "#EF4444",
} as const;

export const heading = (size: number): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 700,
  fontSize: size,
  letterSpacing: "-0.035em",
  lineHeight: 1.05,
  color: color.foreground,
});

export const overline = (size = 20): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 600,
  fontSize: size,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: color.primary,
});

export const body = (size = 28): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1.45,
  color: color.muted,
});

export const MARK_VIEWBOX = 24;
export const MARK_RECTS = [
  { x: 2, y: 3, width: 3.2, height: 18, rx: 1.6, opacity: 1 },
  { x: 7.8, y: 3, width: 14.2, height: 4.6, rx: 2, opacity: 0.4 },
  { x: 7.8, y: 9.7, width: 9.6, height: 4.6, rx: 2, opacity: 1 },
  { x: 7.8, y: 16.4, width: 12.4, height: 4.6, rx: 2, opacity: 0.65 },
] as const;
