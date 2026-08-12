/**
 * V3 scene renderers. Every scene is a landing-page band come alive:
 * white hero ground + graph-paper wash for the type moments, the muted page
 * ground for the product chapters, hairline rules instead of boxes, and the
 * two-tone DISPLAY_HEADING voice throughout. Motion is the landing's own —
 * soft spring settles, word-by-word reveals, a barely-there push-in on
 * footage. Nothing moves without a reason.
 */
import React from "react"
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { AnimatedMark, TextReveal } from "./components"
import {
  ArrowIcon,
  BrowserFrameV3,
  Chip,
  CtaButton,
  EyebrowRow,
  GithubIcon,
  GridWash,
} from "./components-v3"
import { EASE_OUT, FONT, body, color, heading } from "./theme"
import type {
  ChapterSceneV3,
  CloseSceneV3,
  McpSceneV3,
  RevealSceneV3,
  StatsSceneV3,
  StillsSceneV3,
  TitleSceneV3,
} from "./storyboard-v3"

const easeOut = Easing.bezier(...EASE_OUT)

/** The hero ground: white card + graph-paper wash (GridBackdrop). */
const HeroGround: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: color.card,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <GridWash />
    {children}
  </AbsoluteFill>
)

/** The muted ink the hero uses for its second sentence (muted-foreground/55). */
const MUTED_INK = "rgba(110,110,118,0.55)"

// ——— Title (cold open) ——————————————————————————————————————————————————————

export const Title: React.FC<{ scene: TitleSceneV3 }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const eyebrowIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <HeroGround>
      <div style={{ maxWidth: 1640, textAlign: "center", padding: "0 80px" }}>
        {scene.eyebrow ? (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 22,
              fontWeight: 500,
              color: color.muted,
              marginBottom: 30,
              opacity: eyebrowIn,
            }}
          >
            {scene.eyebrow}
          </div>
        ) : null}
        <div style={heading(82)}>
          {scene.headline.map((line, i) => (
            <div
              key={i}
              style={{
                color:
                  scene.mutedFrom !== undefined && i >= scene.mutedFrom
                    ? MUTED_INK
                    : color.foreground,
              }}
            >
              <TextReveal text={line} delay={8 + i * 14} perWord={3.5} />
            </div>
          ))}
        </div>
      </div>
    </HeroGround>
  )
}

// ——— Reveal (the hero fold) ——————————————————————————————————————————————————

export const Reveal: React.FC<{ scene: RevealSceneV3 }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const wordmark = spring({
    frame: frame - 18,
    fps,
    config: { damping: 18, stiffness: 90 },
  })
  // Content leaves BEFORE the crossfade, so the transition into the first
  // chapter blends from a clean grid ground — never text over UI.
  const exit = interpolate(
    frame,
    [durationInFrames - 16, durationInFrames - 3],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut },
  )
  return (
    <HeroGround>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: exit,
        }}
      >
        <Chip text={scene.chip} delay={14} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginTop: 44,
          }}
        >
          <AnimatedMark size={96} delay={12} />
          <div
            style={{
              ...heading(108),
              opacity: wordmark,
              translate: `0 ${interpolate(wordmark, [0, 1], [16, 0])}px`,
            }}
          >
            Trackstage
          </div>
        </div>
        {/* Bounded so a full-sentence tagline (the landing hero's own
            headline, in the final cut) wraps to two centred lines instead of
            running to the frame edges. */}
        <div
          style={{
            ...heading(48),
            marginTop: 46,
            textAlign: "center",
            maxWidth: 1240,
            lineHeight: 1.16,
          }}
        >
          <TextReveal text={scene.tagline} delay={36} perWord={2.5} />{" "}
          <span style={{ color: MUTED_INK }}>
            <TextReveal text={scene.taglineMuted} delay={48} perWord={2.5} />
          </span>
        </div>
        <div style={{ ...body(26), marginTop: 24 }}>
          <TextReveal text={scene.sub} delay={58} perWord={1.2} />
        </div>
      </div>
    </HeroGround>
  )
}

// ——— Chapter (real footage in the landing's browser frame) ———————————————————

const FRAME_W = 1344
const FRAME_X = (1920 - FRAME_W) / 2
const CLIP_RATIO = 1000 / 1600
const HEADER_TOP = 42
const FRAME_TOP = 170

export const Chapter: React.FC<{ scene: ChapterSceneV3 }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  // Barely-there push-in over the whole chapter.
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.02], {
    easing: Easing.linear,
  })
  const headlineIn = interpolate(frame, [2, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  let acc = 0
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <div style={{ position: "absolute", top: HEADER_TOP, left: FRAME_X }}>
        <EyebrowRow glyph={scene.step} label={scene.label} />
        <div
          style={{
            ...heading(40),
            marginTop: 16,
            opacity: headlineIn,
            translate: `0 ${interpolate(headlineIn, [0, 1], [8, 0])}px`,
          }}
        >
          {scene.headline}
        </div>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ marginTop: FRAME_TOP, scale: String(zoom) }}>
          <BrowserFrameV3 width={FRAME_W} url={scene.url}>
            <div
              style={{
                position: "relative",
                width: FRAME_W,
                height: Math.round(FRAME_W * CLIP_RATIO),
              }}
            >
              {scene.segments.map((seg, i) => {
                const from = acc
                acc += seg.hold
                return (
                  <Sequence
                    key={i}
                    from={from}
                    durationInFrames={seg.hold}
                    layout="absolute-fill"
                  >
                    <OffthreadVideo
                      src={staticFile(`clips/${scene.clip}`)}
                      // Source seconds = (frame + trimBefore)/fps × rate, so
                      // divide the desired source-frame offset by the rate.
                      trimBefore={Math.round(seg.trimBefore / seg.rate)}
                      playbackRate={seg.rate}
                      style={{ width: FRAME_W, display: "block" }}
                      muted
                    />
                  </Sequence>
                )
              })}
            </div>
          </BrowserFrameV3>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ——— MCP (the flagship beat: drive it from Claude / ChatGPT / Codex) —————————

/**
 * A calm pan down the real connect surface: personal API keys → "Connect from
 * your AI assistant" → the client tabs and the one-command connect. The image
 * is shown slightly over-scale inside the frame so the pan has room; nothing
 * else moves.
 */
export const Mcp: React.FC<{ scene: McpSceneV3 }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const headlineIn = interpolate(frame, [2, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  const viewportH = Math.round(FRAME_W * CLIP_RATIO)
  const imgW = Math.round(FRAME_W * 1.3)
  const imgH = Math.round(imgW * CLIP_RATIO)
  // A slight downward drift, ending bottom-aligned on the connect card + the
  // CLI one-liner. The whole travel stays BELOW the account header (heading
  // and sub end at image y≈208 at this scale) so the demo fixture email
  // never enters the viewport.
  const maxPan = imgH - viewportH
  const panY = interpolate(
    frame,
    [8, durationInFrames - 10],
    [maxPan - 40, maxPan],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  )
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <div style={{ position: "absolute", top: HEADER_TOP, left: FRAME_X }}>
        <EyebrowRow glyph={scene.step} label={scene.label} />
        <div
          style={{
            ...heading(40),
            marginTop: 16,
            opacity: headlineIn,
            translate: `0 ${interpolate(headlineIn, [0, 1], [8, 0])}px`,
          }}
        >
          {scene.headline}
        </div>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ marginTop: FRAME_TOP }}>
          <BrowserFrameV3 width={FRAME_W} url={scene.url}>
            <div
              style={{
                position: "relative",
                width: FRAME_W,
                height: viewportH,
                overflow: "hidden",
              }}
            >
              <Img
                src={staticFile(scene.src)}
                style={{
                  position: "absolute",
                  width: imgW,
                  left: -(imgW - FRAME_W) / 2,
                  top: -panY,
                  display: "block",
                }}
              />
            </div>
          </BrowserFrameV3>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ——— Stills (capability shots) ———————————————————————————————————————————————

export const Stills: React.FC<{ scene: StillsSceneV3 }> = ({ scene }) => {
  let from = 0
  return (
    <AbsoluteFill style={{ background: color.background }}>
      {scene.shots.map((shot, i) => {
        const start = from
        from += shot.framesEach
        return (
          <Sequence
            key={i}
            from={start}
            durationInFrames={shot.framesEach}
            layout="absolute-fill"
          >
            <StillShot
              eyebrow={scene.eyebrow}
              src={shot.src}
              label={shot.label}
              url={shot.url}
              first={i === 0}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

const MarkGlyph: React.FC = () => (
  <svg width={18} height={18} viewBox="0 0 24 24">
    <rect x={2} y={3} width={3.2} height={18} rx={1.6} fill={color.muted} />
    <rect x={7.8} y={3} width={14.2} height={4.6} rx={2} fill={color.muted} opacity={0.4} />
    <rect x={7.8} y={9.7} width={9.6} height={4.6} rx={2} fill={color.muted} />
    <rect x={7.8} y={16.4} width={12.4} height={4.6} rx={2} fill={color.muted} opacity={0.65} />
  </svg>
)

const StillShot: React.FC<{
  eyebrow: string
  src: string
  label: string
  url: string
  first: boolean
}> = ({ eyebrow, src, label, url, first }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.014], {
    easing: Easing.linear,
  })
  const headlineIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <div style={{ position: "absolute", top: HEADER_TOP, left: FRAME_X }}>
        <EyebrowRow glyph={<MarkGlyph />} label={eyebrow} delay={first ? 0 : -30} />
        <div
          style={{
            ...heading(40),
            marginTop: 16,
            opacity: headlineIn,
            translate: `0 ${interpolate(headlineIn, [0, 1], [8, 0])}px`,
          }}
        >
          {label}
        </div>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ marginTop: FRAME_TOP, scale: String(zoom) }}>
          <BrowserFrameV3 width={FRAME_W} url={url}>
            <Img
              src={staticFile(src)}
              style={{ width: FRAME_W, display: "block" }}
            />
          </BrowserFrameV3>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ——— Stats (the open-source section's hairline stat wall) ————————————————————

export const Stats: React.FC<{ scene: StatsSceneV3 }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const headlineIn = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  // Leave before the crossfade into the close, so the incoming hero fold
  // lands on a clean ground instead of on top of the stat wall.
  const exit = interpolate(
    frame,
    [durationInFrames - 16, durationInFrames - 3],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut },
  )
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: FRAME_X,
          width: FRAME_W,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: exit,
        }}
      >
        <EyebrowRow glyph={<MarkGlyph />} label={scene.eyebrow} delay={2} />
        <div
          style={{
            ...heading(64),
            marginTop: 22,
            opacity: headlineIn,
            translate: `0 ${interpolate(headlineIn, [0, 1], [10, 0])}px`,
          }}
        >
          {scene.headline}{" "}
          <span style={{ color: MUTED_INK }}>{scene.headlineMuted}</span>
        </div>
        <div
          style={{
            marginTop: 52,
            display: "grid",
            gridTemplateColumns: `repeat(${scene.stats.length}, 1fr)`,
            gap: 1,
            background: color.border,
            border: `1px solid ${color.border}`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {scene.stats.map((stat, i) => {
            const appear = spring({
              frame: frame - 26 - i * 6,
              fps,
              config: { damping: 19, stiffness: 110, mass: 0.8 },
            })
            return (
              <div
                key={i}
                style={{
                  background: color.card,
                  padding: "34px 36px 30px",
                  opacity: appear,
                  translate: `0 ${interpolate(appear, [0, 1], [14, 0])}px`,
                }}
              >
                <div
                  style={{
                    ...heading(54),
                    color: stat.accent ? color.primary : color.foreground,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ ...body(21), marginTop: 12 }}>{stat.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ——— Close (the hero fold, as the end card) ——————————————————————————————————

export const Close: React.FC<{ scene: CloseSceneV3 }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({
    frame: frame - 14,
    fps,
    config: { damping: 18, stiffness: 90 },
  })
  const fadeAt = (at: number) =>
    interpolate(frame, [at, at + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeOut,
    })
  const buttons = spring({
    frame: frame - 56,
    fps,
    config: { damping: 19, stiffness: 100, mass: 0.8 },
  })
  return (
    <HeroGround>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Chip text={scene.chip} delay={10} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            marginTop: 40,
          }}
        >
          <AnimatedMark size={76} delay={12} />
          <div
            style={{
              ...heading(88),
              opacity: wordmark,
              translate: `0 ${interpolate(wordmark, [0, 1], [14, 0])}px`,
            }}
          >
            Trackstage
          </div>
        </div>
        <div
          style={{
            ...heading(38),
            color: color.primary,
            marginTop: 34,
            opacity: fadeAt(30),
          }}
        >
          {scene.domain}
        </div>
        <div style={{ ...body(28), marginTop: 14, opacity: fadeAt(42) }}>
          {scene.sub}
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: 42,
            opacity: buttons,
            translate: `0 ${interpolate(buttons, [0, 1], [12, 0])}px`,
          }}
        >
          <CtaButton variant="primary">
            Get started free
            <ArrowIcon size={18} color="#FFFFFF" />
          </CtaButton>
          <CtaButton variant="outline">
            <GithubIcon size={20} fill={color.foreground} />
            Star on GitHub
          </CtaButton>
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 20,
            color: color.faint,
            marginTop: 50,
            opacity: fadeAt(84),
          }}
        >
          {scene.wink}
        </div>
      </div>
    </HeroGround>
  )
}
