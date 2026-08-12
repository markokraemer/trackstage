# Credits & licenses

## Music

### FINAL (`TrackstageLaunchFinal` → `out/trackstage-launch-final.mp4`, shipped as `public/launch.mp4`)

Same track as V1 below — "Digital Clouds" (Mixkit, asset 175), Mixkit Stock
Music Free License. V2's energetic bed was auditioned and rejected: the final
cut keeps V1's calm, and an EDM kick under a form builder reads as a pitch
rather than as a product. Volume rides 0 → 0.85 over the first 18 frames and
back to 0 over the last 90, so the film ends on the end card in silence.

### V2 (`TrackstageLaunchV2` → `out/trackstage-launch-v2.mp4`)

- **Track:** "Infected Mushroom Vibes"
- **Artist:** Alejandro Magaña (A. M.)
- **Genre / listing:** EDM, tagged Energetic on Mixkit
- **Source:** Mixkit — https://mixkit.co/free-stock-music/tag/energetic/ (asset
  id 136, file `https://assets.mixkit.co/music/136/136.mp3`; title/artist/genre
  verified from the page's embedded MusicRecording JSON-LD metadata)
- **Local copy:** `public/audio/infected-mushroom-vibes.mp3`
- **License:** Mixkit Stock Music Free License — https://mixkit.co/license/#musicFree
  (same terms as the V1 track below: free for commercial use, no attribution
  required, monetization allowed, no reselling/redistribution of the item itself)
- **Use:** trimmed 8.13 s from the front so a kick lands on frame 0; the V2 cut
  list is quantized to the measured beat grid (145.0 BPM, first kick 0.255 s).

### V1 (`TrackstageLaunch` → `out/trackstage-launch.mp4`)

- **Track:** "Digital Clouds"
- **Source:** Mixkit — https://mixkit.co/free-stock-music/ (listed under the
  Corporate tag; asset id 175, file `https://assets.mixkit.co/music/175/175.mp3`)
- **Local copy:** `public/audio/digital-clouds.mp3`
- **License:** Mixkit Stock Music Free License — https://mixkit.co/license/#musicFree
  License text (summary as published): "Items under the Mixkit Stock Music Free
  License can be used in your commercial and non-commercial projects, free of
  charge, with no attribution required. You can use them in videos you monetize —
  including YouTube — and in films, apps and advertising. You cannot resell or
  redistribute the items themselves."

## Footage

All product footage is first-party: recorded live from the Trackstage demo
deployment (AI Engineer Summit 2026 seed data) with the Playwright scripts in
`capture/`. No third-party screen material is used.

The final cut's footage was re-recorded from scratch on 2026-08-12 against the
current product — hierarchical `/app/:workspace/:event` URLs, the one-click
status picker, the revamped copilot, the Connect-a-client sheet, the embeds
builder and the new landing page — and cut by `capture/prep-clips-final.mjs`
into `public/clips/final/`. Nothing from the V1/V2 capture library survives in
it. Reproduce with:

```sh
node video/capture/capture.mjs all          # records raw/*.webm
node video/capture/prep-clips-final.mjs     # cuts public/clips/final/*.mp4
cd video && npx remotion render TrackstageLaunchFinal \
  out/trackstage-launch-final.mp4 --codec=h264 --crf=16
```

## Typeface

Inter (SIL Open Font License 1.1), loaded via `@remotion/google-fonts/Inter` —
the same face the product and homepage use.

## Logo

The Trackstage brand mark is drawn from the repo's own brand kit geometry
(`src/components/brand/assets.ts`), animated natively in Remotion.
