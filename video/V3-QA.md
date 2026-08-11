# Trackstage Launch V3 — QA loop log

The mandatory perfection loop: render → extract frames at every cut point +
scene midpoints → read each frame with vision → critique against the checklist
→ fix → re-render. Loop until a full pass yields ZERO findings, then one
end-to-end 2fps watch-through for pacing.

## Checklist (every frame pass)

**Landing-token fidelity**
- [ ] Grounds: hero scenes = white `#FFFFFF` + 72px graph-paper wash with
      radial top mask (GridBackdrop); product scenes = page `#FAFAFA`.
- [ ] Type = DISPLAY_HEADING: Inter semibold, −0.032em tracking, ~1.05
      leading; two-tone second sentence in muted-foreground/55.
- [ ] Eyebrow = SectionIntro language: hairline glyph box (rounded-lg,
      border `#EAEAEC`) + muted medium label — sentence case, never
      uppercase-tracked.
- [ ] Chip = hero announcement pill: border, white bg, 8px primary dot,
      muted label, arrow.
- [ ] Browser frame = product-shot BrowserChrome: muted/60 bar, three
      foreground/15 dots, white rounded-full URL pill with foreground/10
      ring; figure = rounded-xl, foreground/10 ring, lg shadow.
- [ ] `#2F5CE0` only where it means something (dot, $0 stat, domain,
      primary CTA). Chrome stays neutral.

**Composition & legibility**
- [ ] Safe margins: nothing within ~40px of frame edges; browser frame's
      bottom edge on screen at max push-in.
- [ ] Headline never collides with the browser frame at max zoom.
- [ ] UI in frame legible at 1080p (text ≥ ~11px rendered).
- [ ] No fixture junk, no dev chrome (localhost URLs, devtools, scrollbars,
      OS cursors outside the app, seeded-data embarrassments).
- [ ] Hold durations long enough to read: headline ≥ ~2.5s on screen;
      footage action followable (net speed calm, no speedrun feel).

**Transition cleanliness**
- [ ] At every hard cut N: frames N−1 / N / N+1 clean — no half-faded
      ghosts, no layout jump of the persistent browser frame, headers
      re-enter smoothly.
- [ ] Crossfades (12/10fr) complete without double-exposure artifacts on
      text.
- [ ] Video segments never run past their source (no frozen/black tail).

**Film-level**
- [ ] 1920×1080, 30fps, H.264 + AAC.
- [ ] Runtime 55–65s; music fades in/out cleanly; cuts feel intentional
      against the bed.

## Cut map (composition frames, fadeIn overlaps applied) — iteration 3

| # | scene | start | dur | notes |
|---|-------|-------|-----|-------|
| 1 | cold-open | 0 | 90 | fade 0 |
| 2 | reveal | 78 | 118 | fade 12; content exit-fades from ~102 |
| 3 | form-builder | 184 | 132 | fade 12 |
| 4 | cfp | 316 | 212 | hard cut; internal jump at 396 |
| 5 | triage | 528 | 130 | hard cut |
| 6 | commit | 658 | 126 | hard cut |
| 7 | portal | 784 | 124 | hard cut |
| 8 | agenda | 908 | 148 | hard cut |
| 9 | autoplace | 1056 | 108 | hard cut |
| 10 | publish | 1164 | 140 | hard cut |
| 11 | copilot | 1304 | 170 | hard cut; single segment |
| 12 | mcp | 1474 | 116 | hard cut; slow pan down connect surface |
| 13 | capabilities | 1590 | 96 | hard cut; still cut at 1638 |
| 14 | stats | 1676 | 140 | fade 10 |
| 15 | close | 1804 | 152 | fade 12 → total 1956 fr = 65.2s |

## Iterations

### Iteration 1 — render 1 (1936 fr / 64.58s), 78 frames read

Verdict of the pass: layout, landing fidelity, footage legibility and the
stat wall / close card are right on the first render. Six findings, all
fixed before render 2:

1. **Reveal ghosting over footage** (frames 0188/0193): the reveal's
   wordmark/tagline crossfaded on top of the form-builder UI — text over
   product. Fix: reveal content exit-fades to 0 in its last ~14 frames, so
   the transition blends from a clean grid ground. Reveal 112 → 118 fr to
   keep the sub readable.
2. **Chip popped mid-crossfade** (0093): the announcement chip sprang in
   while the cold open was still fading out, double-exposing with the
   eyebrow. Fix: chip delay 4 → 14 (after the fade completes).
3. **CFP chapter opened on a loading skeleton** (0322): clip frame 0 is a
   page-load placeholder. Fix: segment trimBefore 0 → 10.
4. **Copilot chapter: 2s of dead air** (1368–1423): segment 1 (source
   30–108) showed only the empty copilot screen — the typing lives later
   in the clip than the prep notes suggested. Fix: single segment from
   source 88 (ask sent → tools → approval card → Approve & run → result).
5. **Copilot → capabilities crossfade garbled two headlines + two screens**
   (1528/1531). Fix: hard cut (fadeIn 0), consistent with every other
   chapter boundary; stills 46 → 50 fr each with the freed time.
6. **Pacing trim to stay inside 55–65s** after the reveal/stills additions:
   triage/commit/portal/agenda/autoplace/publish/cfp-seg2 each −4…−6 fr.
   New total 1928 fr = 64.27s.

Accepted (noted, not defects): the MCP still shows the real demo MCP
endpoint (convex.site) and demo account email at ~13px — authentic
product footage, illegible at viewing size; the app's own dialog-backdrop
blur in commit/auto-place is product behaviour, not an edit artifact.

### Iteration 3 — render 3 (1956 fr / 65.26s), 81 frames read

All iteration-1 fixes verified clean in pixels: reveal exits before the
crossfade (0188/0193 now blend ground → chapter, no text over UI); no chip
pop at the cold-open handoff (0087); CFP opens on the loaded welcome
screen (0316); copilot chapter now reads ask → Thinking… (1308) →
approval card (1389) → approved + "staged only, no email sent" result
(1471) — the full trust story. The new MCP beat lands: pan from API keys
to the connect card, ending on Claude / ChatGPT / Codex tabs + the
one-command connect (1587). Three findings, fixed for render 4:

1. **MCP pan starts on the account header** (1478): "Account settings —
   organizer@demo.sessionboard.dev" is large and legible at 1.3× — a
   Sessionboard-brand fixture leak in a Trackstage film. Fix: pan starts
   at image y=110, below the header; the email never enters the viewport.
2. **Stats → close crossfade collision** (1813): the close's chip and the
   logomark's blue rail drew on top of the fading stat wall. Fix: stats
   content exit-fades in its last ~14 frames (same recipe as the reveal);
   close chip/mark/wordmark delays 10/12/14 so the fold assembles after
   the fade completes.
3. Minor: dead white at the very bottom of the MCP pan is the capture's
   own page padding — bounded by ending the pan at the image bottom
   (verified against mcp.png crops; the CLI line is the last content).

### Iteration 4 — render 4 (1956 fr / 65.26s), changed scenes re-read

- Stats → close handoff now clean: the stat wall exit-fades to the bare
  grid (1813), the close fold assembles after the fade (1808). Fixed.
- **MCP pan STILL opened on the account header** (1478): the y=110 start
  was based on a bad estimate — measured properly against mcp.png, the
  heading + sub occupy image y≈158–208 at 1.3×, and max pan is only 252,
  so most of the intended travel was inside the header zone. Fix: drift
  constrained to [maxPan−40 → maxPan] — starts just below the sub, ends
  bottom-aligned on the connect card + Claude Code CLI line. The email can
  never enter the viewport by construction.

### Iteration 2 — render 2 (1928 fr / 64.27s), superseded before frame pass

All six iteration-1 fixes rendered, but Marko's mid-task directive landed:
the copilot + MCP story is THE flagship differentiator and must be a real
beat, not a 50-frame blink. Restructured before reading frames:

- NEW scene 12 "10 · Connect" (116 fr): a calm pan down the real MCP
  connect surface in `captures/mcp.png` — personal API keys → "Connect
  from your AI assistant" → Claude / ChatGPT / Codex tabs → the
  one-command connect (Claude Code CLI block). Image at 1.3× inside the
  landing browser frame, ease-in-out pan, nothing else moves.
- Copilot chapter (approval-card beat) unchanged at 170 fr — together the
  two beats run ~9.5s, the longest act in the film.
- `mcp.png` dropped from the capabilities stills (now embeds + dashboard,
  48 fr each); cold open / form-builder / cfp / triage / portal / agenda /
  publish / close trimmed 2–6 fr each to land at 1956 fr = 65.2s.
