#!/bin/zsh
# Author: Claude Opus 5
# Date: 02-September-2026
# PURPOSE: Run the hypothesis sweep against console screenshots dropped into
#          data/arc3-hypothesis-sweep/shots/ rather than engine-rendered frames. Exists because
#          three games the Boss wants tested (lf52, dc22, cn04) have no source in this checkout -
#          the local registry holds only ct01/ct03/ft09/gw01/gw02/ls20/vc33/ws03/ws04 - so a
#          screenshot is the only possible stimulus for them. Takes no decisions: defaults are
#          fixed here so a run never waits on a question.
# SRP/DRY check: Pass - all sampling logic stays in hypothesis_sweep.py; this only stages images
#          into the frame cache, which render_frame() honours before it looks for game source.
set -euo pipefail
cd "$(dirname "$0")/../.."

SHOTS=data/arc3-hypothesis-sweep/shots
FRAMES=data/arc3-hypothesis-sweep/frames
mkdir -p "$SHOTS" "$FRAMES"

# Any image in shots/ becomes a game id equal to its filename stem. render_frame() returns a
# cached frames/<id>@512.png without ever looking for a .py, so an unrenderable game still runs.
ids=()
for f in "$SHOTS"/*.(png|jpg|jpeg|PNG|JPG|JPEG)(N); do
  id="${${f:t:r}// /_}"
  cp -f "$f" "$FRAMES/${id}@512.png"
  ids+="$id"
done

if (( ${#ids} == 0 )); then
  echo "No images in $SHOTS - nothing to do."
  exit 0
fi
echo "staged ${#ids} image(s): $ids"

# Breadth settings, matching last night's cell exactly so the stimulus is the ONLY variable:
# thinking off, temp 1.0, top_k 500, n=4. Tagged and stimulus-form-labelled so these rows never
# pool with bare-frame rows by accident.
python3 scripts/arc3/hypothesis_sweep.py \
  --games "${ids[@]}" \
  --efforts none --temps 1.0 --n 4 \
  --stimulus-form console_screenshot \
  --tag screenshots "$@"

python3 scripts/arc3/hypothesis_report.py \
  data/arc3-hypothesis-sweep/hypotheses_*screenshots*.jsonl \
  > data/arc3-hypothesis-sweep/report_screenshots.txt 2>&1 || true
echo "=== SCREENSHOT RUN DONE ==="
