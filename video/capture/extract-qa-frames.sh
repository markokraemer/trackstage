#!/bin/bash
# Extract QA frames from the V3 render: post-cut, midpoint and pre-cut frames
# for every scene, plus N-1/N/N+1 around every hard cut. Frame numbers come
# from the cut map in video/V3-QA.md — keep both in sync with storyboard-v3.ts.
set -euo pipefail
SRC="${1:-out/trackstage-launch-v3.mp4}"
OUT="${2:-/tmp/v3-qa}"
mkdir -p "$OUT"
rm -f "$OUT"/*.png

# scene: start dur
scenes="cold-open:0:90 reveal:78:118 form-builder:184:132 cfp:316:212 triage:528:130 commit:658:126 portal:784:124 agenda:908:148 autoplace:1056:108 publish:1164:140 copilot:1304:170 mcp:1474:116 capabilities:1590:96 stats:1676:140 close:1804:152"

frames=""
for s in $scenes; do
  name="${s%%:*}"; rest="${s#*:}"; start="${rest%%:*}"; dur="${rest#*:}"
  mid=$((start + dur / 2)); end=$((start + dur - 3))
  frames="$frames $name-a:$((start + 4)) $name-mid:$mid $name-end:$end"
done

# hard cuts (chapter boundaries + internal segment jumps + still swaps)
for c in 316 396 528 658 784 908 1056 1164 1304 1474 1590 1638; do
  frames="$frames cut$c-m1:$((c - 1)) cut$c-0:$c cut$c-p1:$((c + 1))"
done

for f in $frames; do
  label="${f%%:*}"; n="${f##*:}"
  ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$n)" -vsync 0 -frames:v 1 "$OUT/$(printf %04d "$n")-$label.png"
done
echo "wrote $(ls "$OUT" | wc -l | tr -d ' ') frames to $OUT"
