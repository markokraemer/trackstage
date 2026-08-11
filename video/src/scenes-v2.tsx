/**
 * V2 scene renderers — beat-cut, 3D-tilted, kinetic. One idea per scene,
 * nothing on screen longer than it earns.
 */
import React from "react"
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { AnimatedMark, BrowserFrame } from "./components"
import {
  DarkGround,
  GroundShadow,
  IndexChip,
  LightGround,
  PunchWords,
  TiltStage,
  dark,
  impactShake,
} from "./components-v2"
import { EASE_OUT, FONT, body, color, heading } from "./theme"
import { beatF } from "./storyboard-v2"
import type {
  ChapterScene,
  CloseScene,
  UniverseScene,
  WordScene,
} from "./storyboard-v2"

const easeOut = Easing.bezier(...EASE_OUT)
const FRAME_W = 1340
const CLIP_AR = 1600 / 1000

// ——— Cold open A: the invoice ————————————————————————————————————————————————

export const ColdOpenA: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const slam = spring({ frame, fps, config: { damping: 13, stiffness: 240, mass: 0.6 } })
  const chip = spring({ frame: frame - 8, fps, config: { damping: 15, stiffness: 220, mass: 0.5 } })
  return (
    <DarkGround>
      <div
        style={{
          textAlign: "center",
          translate: impactShake(frame, 3, 11),
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: dark.muted,
            marginBottom: 30,
            opacity: interpolate(frame, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Event teams pay
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 260,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            color: dark.foreground,
            opacity: slam,
            scale: String(interpolate(slam, [0, 1], [1.7, 1])),
          }}
        >
          $40,000
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: dark.accent,
            opacity: chip,
            scale: String(interpolate(chip, [0, 1], [1.4, 1])),
          }}
        >
          a year
        </div>
      </div>
    </DarkGround>
  )
}

// ——— Cold open B: what it buys ———————————————————————————————————————————————

export const ColdOpenB: React.FC = () => {
  const frame = useCurrentFrame()
  const strikeAt = beatF(2)
  const strike = interpolate(frame, [strikeAt, strikeAt + 7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  return (
    <DarkGround>
      <div
        style={{
          textAlign: "center",
          maxWidth: 1560,
          padding: "0 80px",
          translate: impactShake(frame, strikeAt, 8),
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 108,
            letterSpacing: "-0.035em",
            lineHeight: 1.08,
            color: dark.foreground,
          }}
        >
          <PunchWords text="for slow speaker software." perWord={2.5} />
          <div
            style={{
              position: "absolute",
              left: "-1%",
              top: "50%",
              width: "102%",
              height: 12,
              borderRadius: 6,
              background: dark.red,
              rotate: "-1.6deg",
              transformOrigin: "left center",
              scale: `${strike} 1`,
              boxShadow: `0 0 34px rgba(229,72,77,${0.55 * strike})`,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 30,
            color: dark.muted,
            opacity: interpolate(frame, [strikeAt + 6, strikeAt + 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          There is a faster way.
        </div>
      </div>
    </DarkGround>
  )
}

// ——— Reveal ——————————————————————————————————————————————————————————————————

export const RevealV2: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 200, mass: 0.6 } })
  return (
    <LightGround>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          translate: impactShake(frame, 6, 7),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <AnimatedMark size={112} delay={0} />
          <div
            style={{
              ...heading(124),
              opacity: wordmark,
              scale: String(interpolate(wordmark, [0, 1], [1.25, 1])),
            }}
          >
            Trackstage
          </div>
        </div>
        <div style={{ ...heading(46), fontWeight: 500, marginTop: 46 }}>
          <PunchWords text="Run your call for speakers. Not your inbox." delay={16} perWord={2.5} />
        </div>
        <div
          style={{
            ...body(26),
            marginTop: 22,
            color: color.faint,
            opacity: interpolate(frame, [46, 58], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Open-source speaker &amp; program management
        </div>
      </div>
    </LightGround>
  )
}

// ——— Chapter: tilted browser frame + real footage at speedrun pace ———————————

export const ChapterV2: React.FC<{ scene: ChapterScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const headIn = spring({ frame, fps, config: { damping: 16, stiffness: 220, mass: 0.5 } })
  const punchAt = scene.punch ? beatF(scene.punch.atBeat) : Number.MAX_SAFE_INTEGER
  const punch = scene.punch
    ? spring({ frame: frame - punchAt, fps, config: { damping: 17, stiffness: 190, mass: 0.7 } })
    : 0
  const punchScale = 1 + punch * 0.48
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1300px 850px at 50% 38%, #FFFFFF, ${color.background})`,
      }}
    >
      <GroundShadow width={FRAME_W} />
      <AbsoluteFill style={{ translate: impactShake(frame, punchAt, 6) }}>
        <TiltStage tilt={scene.tilt}>
          <div
            style={{
              scale: String(punchScale),
              transformOrigin: scene.punch?.origin ?? "50% 50%",
            }}
          >
            <BrowserFrame width={FRAME_W} url={scene.url}>
              <OffthreadVideo
                src={staticFile(`clips/${scene.clip}`)}
                trimBefore={Math.round(scene.trimSec * 30)}
                playbackRate={scene.rate}
                style={{
                  width: FRAME_W - 2,
                  height: Math.round((FRAME_W - 2) / CLIP_AR),
                  display: "block",
                  objectFit: "cover",
                }}
                muted
              />
            </BrowserFrame>
          </div>
        </TiltStage>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          // The label yields the stage while a zoom punch is in flight.
          opacity: headIn * (1 - 0.88 * punch),
          scale: String(interpolate(headIn, [0, 1], [1.15, 1])),
        }}
      >
        <IndexChip text={scene.overline} style={{ marginRight: 20, verticalAlign: "middle" }} />
        <span style={{ ...heading(42), display: "inline-block", verticalAlign: "middle" }}>
          <PunchWords text={scene.headline} delay={2} perWord={2} />
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ——— Universe: the parallax wall of everything else ——————————————————————————

export const UniverseV2: React.FC<{ scene: UniverseScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const cam = interpolate(frame, [0, durationInFrames], [1.05, 1.24], {
    easing: Easing.linear,
  })
  const enter = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  const capIn = interpolate(frame, [beatF(3), beatF(3) + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  const TILE_W = 640
  const TILE_H = 400
  const GAP = 56
  const colDrift = [34, -46, 40]
  const colBase = [-36, -210, -110]
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1300px 850px at 50% 38%, #FFFFFF, ${color.background})`,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          perspective: 2800,
          perspectiveOrigin: "50% 45%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: enter,
            scale: String(cam),
            transform: `rotateX(9deg) rotateY(-13deg) rotateZ(1.2deg)`,
            transformStyle: "preserve-3d",
            display: "flex",
            gap: GAP,
          }}
        >
          {scene.columns.map((col, ci) => (
            <div
              key={ci}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: GAP,
                translate: `0 ${
                  colBase[ci] +
                  interpolate(frame, [0, durationInFrames], [0, colDrift[ci]])
                }px`,
              }}
            >
              {col.map((src, ri) => (
                <div
                  key={ri}
                  style={{
                    width: TILE_W,
                    height: TILE_H,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: `1px solid ${color.border}`,
                    boxShadow:
                      "0 24px 60px rgba(23,23,26,0.14), 0 3px 12px rgba(23,23,26,0.06)",
                    background: color.card,
                  }}
                >
                  <Img
                    src={staticFile(src)}
                    style={{
                      width: TILE_W,
                      height: TILE_H,
                      objectFit: "cover",
                      objectPosition: "top left",
                      display: "block",
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(760px 340px at 50% 52%, rgba(250,250,250,0.94), rgba(250,250,250,0))",
          opacity: capIn,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ ...heading(72) }}>
            <PunchWords text={scene.headline} delay={beatF(3)} perWord={2.5} />
          </div>
          <div style={{ ...body(26), marginTop: 22, color: color.muted }}>
            {scene.sub}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ——— Word punch ——————————————————————————————————————————————————————————————

export const WordPunch: React.FC<{ scene: WordScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const slam = spring({ frame, fps, config: { damping: 13, stiffness: 250, mass: 0.6 } })
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.045], {
    easing: Easing.linear,
  })
  const size = scene.text.length > 10 ? 128 : 176
  return (
    <DarkGround>
      <div
        style={{
          textAlign: "center",
          translate: impactShake(frame, 2, 10),
          scale: String(drift),
        }}
      >
        <IndexChip text={scene.index} tone="dark" style={{ marginBottom: 36 }} />
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: size,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: dark.foreground,
            opacity: slam,
            scale: String(interpolate(slam, [0, 1], [1.6, 1])),
          }}
        >
          {scene.text}
          <span style={{ color: dark.accent }}>.</span>
        </div>
      </div>
    </DarkGround>
  )
}

// ——— Climax: $40,000 falls, $0 lands —————————————————————————————————————————

export const ClimaxV2: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const dropAt = beatF(4)
  const inSlam = spring({ frame, fps, config: { damping: 13, stiffness: 240, mass: 0.6 } })
  const strike = interpolate(frame, [beatF(1), beatF(1) + 7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  })
  const drop = interpolate(frame, [dropAt, dropAt + 13], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.9, 0.4),
  })
  const zero = spring({ frame: frame - dropAt - 2, fps, config: { damping: 12, stiffness: 210, mass: 0.8 } })
  const forever = spring({ frame: frame - dropAt - 22, fps, config: { damping: 15, stiffness: 220, mass: 0.5 } })
  return (
    <DarkGround>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(700px 480px at 50% 52%, rgba(123,161,255,${
            0.16 * zero
          }), rgba(123,161,255,0))`,
        }}
      />
      <div
        style={{
          position: "relative",
          textAlign: "center",
          translate: impactShake(frame, dropAt + 4, 13),
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 128,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: dark.foreground,
            opacity: inSlam * (1 - drop),
            scale: String(interpolate(inSlam, [0, 1], [1.55, 1])),
            translate: `0 ${drop * 420}px`,
            rotate: `${drop * -7}deg`,
          }}
        >
          $40,000 a year
          <div
            style={{
              position: "absolute",
              left: "-1%",
              top: "52%",
              width: "102%",
              height: 11,
              borderRadius: 6,
              background: dark.red,
              rotate: "-1.4deg",
              transformOrigin: "left center",
              scale: `${strike} 1`,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            translate: "-50% -54%",
            textAlign: "center",
            opacity: zero,
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 360,
              letterSpacing: "-0.05em",
              lineHeight: 1,
              color: dark.accent,
              scale: String(interpolate(zero, [0, 1], [1.8, 1])),
            }}
          >
            $0
          </div>
          <div
            style={{
              marginTop: 20,
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 40,
              letterSpacing: "0.04em",
              color: dark.foreground,
              opacity: forever,
              scale: String(interpolate(forever, [0, 1], [1.3, 1])),
            }}
          >
            forever
          </div>
        </div>
      </div>
    </DarkGround>
  )
}

// ——— Close ———————————————————————————————————————————————————————————————————

export const CloseV2: React.FC<{ scene: CloseScene }> = ({ scene }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 210, mass: 0.6 } })
  const domain = spring({ frame: frame - beatF(2), fps, config: { damping: 15, stiffness: 230, mass: 0.5 } })
  const pills = scene.sub.split(". ").map((p) => p.replace(/\.$/, ""))
  return (
    <LightGround>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <AnimatedMark size={84} delay={0} />
          <div
            style={{
              ...heading(92),
              opacity: wordmark,
              scale: String(interpolate(wordmark, [0, 1], [1.2, 1])),
            }}
          >
            Trackstage
          </div>
        </div>
        <div
          style={{
            ...heading(46),
            fontWeight: 600,
            color: color.primary,
            marginTop: 42,
            opacity: domain,
            scale: String(interpolate(domain, [0, 1], [1.25, 1])),
          }}
        >
          {scene.domain}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
          {pills.map((pill, i) => {
            const s = spring({
              frame: frame - beatF(4) - i * 4,
              fps,
              config: { damping: 14, stiffness: 240, mass: 0.5 },
            })
            return (
              <span
                key={pill}
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 25,
                  color: color.foreground,
                  background: color.card,
                  border: `1px solid ${color.border}`,
                  boxShadow: "0 2px 8px rgba(23,23,26,0.05)",
                  borderRadius: 999,
                  padding: "12px 28px",
                  opacity: s,
                  scale: String(interpolate(s, [0, 1], [1.35, 1])),
                }}
              >
                {pill}
              </span>
            )
          })}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 21,
            color: color.faint,
            marginTop: 58,
            opacity: interpolate(frame, [beatF(7), beatF(7) + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {scene.wink}
        </div>
      </div>
    </LightGround>
  )
}
