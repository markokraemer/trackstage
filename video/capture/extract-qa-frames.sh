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
scenes="cold-open:0:96 reveal:84:118 form-builder:190:138 cfp:328:216 triage:544:134 commit:678:126 portal:804:126 agenda:930:152 autoplace:1082:108 publish:1190:144 copilot:1334:170 capabilities:1504:150 stats:1644:140 close:1772:156"

frames=""
for s in $scenes; do
  name="${s%%:*}"; rest="${s#*:}"; start="${rest%%:*}"; dur="${rest#*:}"
  mid=$((start + dur / 2)); end=$((start + dur - 3))
  frames="$frames $name-a:$((start + 4)) $name-mid:$mid $name-end:$end"
done

# hard cuts (chapter boundaries + internal segment jumps + still swaps)
for c in 328 412 544 678 804 930 1082 1190 1334 1504 1554 1604; do
  frames="$frames cut$c-m1:$((c - 1)) cut$c-0:$c cut$c-p1:$((c + 1))"
done

for f in $frames; do
  label="${f%%:*}"; n="${f##*:}"
  ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$n)" -vsync 0 -frames:v 1 "$OUT/$(printf %04d "$n")-$label.png"
done
echo "wrote $(ls "$OUT" | wc -l | tr -d ' ') frames to $OUT"
