/**
 * Scene renderers, one per storyboard `kind`. Apple-keynote restraint: white
 * ground, one idea per frame, cubic easing, nothing moves without a reason.
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
import { AnimatedMark, BrowserFrame, TextReveal } from "./components"
import { EASE_OUT, FONT, body, color, heading, overline } from "./theme"
import type {
  CardsScene,
  ChapterScene,
  CloseScene,
  RevealScene,
  StillsScene,
  TitleScene,
} from "./storyboard"

const easeOut = Easing.bezier(...EASE_OUT)

const Ground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: color.background,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
)

// ——— Title (cold open) ——————————————————————————————————————————————————————

export const Title: React.FC<{ scene: TitleScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const fadeOverline = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <Ground>
      <div style={{ maxWidth: 1640, textAlign: "center", padding: "0 80px" }}>
        {scene.overline ? (
          <div style={{ ...overline(21), opacity: fadeOverline, marginBottom: 34 }}>
            {scene.overline}
          </div>
        ) : null}
        <div style={heading(80)}>
          {scene.headline.map((line, i) => (
            <div
              key={i}
              style={{
                color: i === scene.mutedLine ? "rgba(23,23,26,0.42)" : color.foreground,
              }}
            >
              <TextReveal text={line} delay={10 + i * 14} perWord={3.5} />
            </div>
          ))}
        </div>
        {scene.sub ? (
          <div style={{ ...body(31), marginTop: 36 }}>
            <TextReveal text={scene.sub} delay={44} perWord={1.5} />
          </div>
        ) : null}
      </div>
    </Ground>
  )
}

// ——— Reveal (logo + one-liner) ———————————————————————————————————————————————

export const Reveal: React.FC<{ scene: RevealScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 90 } })
  const rule = interpolate(frame, [30, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <Ground>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <AnimatedMark size={104} delay={2} />
          <div
            style={{
              ...heading(112),
              opacity: wordmark,
              translate: `0 ${interpolate(wordmark, [0, 1], [18, 0])}px`,
            }}
          >
            Trackstage
          </div>
        </div>
        <div
          style={{
            width: interpolate(rule, [0, 1], [0, 72]),
            height: 3,
            borderRadius: 2,
            background: color.border,
            marginTop: 44,
            marginBottom: 40,
          }}
        />
        <div style={{ ...heading(44), fontWeight: 500 }}>
          <TextReveal text={scene.tagline} delay={36} perWord={2.5} />
        </div>
        <div style={{ ...body(26), marginTop: 22, color: color.faint }}>
          <TextReveal text={scene.sub} delay={58} perWord={1.2} />
        </div>
      </div>
    </Ground>
  )
}

// ——— Chapter (real footage in a browser frame) ———————————————————————————————

const FRAME_W = 1408
const HEADER_Y = 58

export const Chapter: React.FC<{ scene: ChapterScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  // Tasteful slow push-in over the whole chapter.
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.028], {
    easing: Easing.linear,
  })
  const headIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <div
        style={{
          position: "absolute",
          top: HEADER_Y,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <span
          style={{
            ...overline(17),
            color: color.primary,
            marginRight: 22,
            opacity: headIn,
          }}
        >
          {scene.overline}
        </span>
        <span style={{ ...heading(38), display: "inline-block" }}>
          <TextReveal text={scene.headline} delay={2} perWord={2} />
        </span>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ marginTop: 148, scale: String(zoom) }}>
          <BrowserFrame width={FRAME_W} url={scene.url}>
            <OffthreadVideo
              src={staticFile(`clips/${scene.clip}`)}
              style={{ width: FRAME_W - 2, display: "block" }}
              muted
            />
          </BrowserFrame>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ——— Stills flash (capability shots) ————————————————————————————————————————

export const Stills: React.FC<{ scene: StillsScene }> = ({ scene }) => {
  let from = 0
  return (
    <AbsoluteFill style={{ background: color.background }}>
      {scene.shots.map((shot, i) => {
        const start = from
        from += shot.framesEach
        return (
          <Sequence key={i} from={start} durationInFrames={shot.framesEach} layout="absolute-fill">
            <StillShot src={shot.src} label={shot.label} url={shot.url} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

const StillShot: React.FC<{ src: string; label: string; url: string }> = ({
  src,
  label,
  url,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.022], {
    easing: Easing.linear,
  })
  const headIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <div
        style={{
          position: "absolute",
          top: HEADER_Y,
          left: 0,
          right: 0,
          textAlign: "center",
          ...heading(38),
          opacity: headIn,
          translate: `0 ${interpolate(headIn, [0, 1], [10, 0])}px`,
        }}
      >
        {label}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ marginTop: 148, scale: String(zoom) }}>
          <BrowserFrame width={FRAME_W} url={url}>
            <Img
              src={staticFile(src)}
              style={{ width: FRAME_W - 2, display: "block" }}
            />
          </BrowserFrame>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ——— Differentiator cards ————————————————————————————————————————————————————

export const Cards: React.FC<{ scene: CardsScene }> = ({ scene }) => {
  const per = Math.floor(scene.durationInFrames / scene.cards.length)
  return (
    <AbsoluteFill style={{ background: color.background }}>
      {scene.cards.map((card, i) => (
        <Sequence key={i} from={i * per} durationInFrames={per} layout="absolute-fill">
          <Card text={card.text} accent={card.accent} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

const Card: React.FC<{ text: string; accent?: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 130, mass: 0.6 } })
  return (
    <Ground>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            ...heading(accent ? 148 : 104),
            opacity: pop,
            scale: String(interpolate(pop, [0, 1], [0.94, 1], )),
            color: accent ? color.primary : color.foreground,
          }}
        >
          {text}
        </div>
        {accent ? (
          <div
            style={{
              ...body(34),
              marginTop: 18,
              opacity: interpolate(frame, [8, 20], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {accent}
          </div>
        ) : null}
      </div>
    </Ground>
  )
}

// ——— Close ———————————————————————————————————————————————————————————————————

export const Close: React.FC<{ scene: CloseScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 90 } })
  const fadeAt = (at: number) =>
    interpolate(frame, [at, at + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeOut,
    })
  return (
    <Ground>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <AnimatedMark size={76} delay={0} />
          <div
            style={{
              ...heading(84),
              opacity: wordmark,
              translate: `0 ${interpolate(wordmark, [0, 1], [14, 0])}px`,
            }}
          >
            Trackstage
          </div>
        </div>
        <div
          style={{
            ...heading(40),
            fontWeight: 500,
            color: color.primary,
            marginTop: 40,
            opacity: fadeAt(26),
          }}
        >
          {scene.domain}
        </div>
        <div style={{ ...body(30), marginTop: 18, opacity: fadeAt(40) }}>
          {scene.sub}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 21,
            color: color.faint,
            marginTop: 54,
            opacity: fadeAt(62),
          }}
        >
          {scene.wink}
        </div>
      </div>
    </Ground>
  )
}
