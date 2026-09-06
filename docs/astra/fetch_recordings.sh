#!/bin/sh
# Author: Claude Opus 5 (Bubba)
# Date: 06-September-2026
# PURPOSE: Fetch the six raw ARC Prize replay recordings that every number in
# reasoning-trace-audit.md is computed from. Three games x {default, provider adapter}.
# ~231 MB total, no auth. Pass a target dir (default ./astra-data, gitignored).
# SRP/DRY check: Pass -- audit_reasoning_traces.py analyses; this only downloads.
set -e
DIR="${1:-$(dirname "$0")/astra-data}"
mkdir -p "$DIR"
# game_env_id / session_guid / arm / score
fetch() { # $1=name $2=env_id $3=guid
  curl -sf -m 900 -o "$DIR/$1.ndjson" "https://arcprize.org/api/recordings/$2/$3" &
}
fetch bp35_def bp35-0a0ad940 084397eb-e736-4cfa-bd64-0f73cc198e50   #   2.222 default
fetch bp35_pa  bp35-0a0ad940 b02b9920-372b-43c9-8eef-58b76704664f   # 100.000 provider adapter
fetch lf52_def lf52-271a04aa 0beb41f9-31a2-499f-9d5a-64f187ae1edd   #  10.909 default
fetch lf52_pa  lf52-271a04aa 248b7fbd-5f82-40bd-af6d-ff811283526a   # 100.000 provider adapter
fetch ls20_def ls20-9607627b f00f5439-8a69-4b13-8248-c864b82fb025   # default
fetch ls20_pa  ls20-9607627b c836fd19-5a16-4ca0-8d3f-afd48c73073e   # 100.000 provider adapter
wait
ls -la "$DIR"
