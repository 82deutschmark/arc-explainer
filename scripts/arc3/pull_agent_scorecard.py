"""
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: Pull one PUBLIC AI scorecard from arcprize.org -- every game's full recording,
         with the one-line note the agent sent alongside each move -- and turn it into
         backend training data. Nothing here is shown on the site. First card pulled: an
         external gpt-6-astra (high) harness, 9 Sep 2026, 25/25 public games, 183/183
         levels, 6,732 moves (https://arcprize.org/scorecards/75d9c8e7-ade9-4a8f-a747-6acbea51bb1b).

         WHAT IT READS (no login, no API key -- a published card is public):
           1. GET https://arcprize.org/api/v3/scorecards/<card_id>
              card totals plus environments[].runs[]: guid, state, level_actions,
              level_baseline_actions. This is the call the public scorecard page makes.
           2. GET https://arcprize.org/api/recordings/<env_id>/<guid>
              JSONL, one line per step: {timestamp, data: {state, levels_completed,
              full_reset, action_input: {id, data, reasoning}, available_actions, frame}}.
              Line 0 is the opening RESET and is not a move. action_input.reasoning is
              whatever the agent passed as `reasoning` on that step; OY1 sends
              '{"experiment": "<one line>"}' once per batch, repeated on every move in the
              batch. frame is the list of 64x64 grids shown after that step.

         WHAT IT WRITES.
           - data/arc3-agent-runs/raw/<card_id>/<env_id>.<guid>.jsonl   (gitignored)
             The recordings exactly as served, about 100 MB for this card. Re-running skips
             files already on disk, so an interrupted pull resumes.
           - data/arc3-agent-runs/<card_id>.levels.jsonl                (committed)
             One record per (game, level), the unit the dataset brief asks for
             (docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md, Part 4).
             Each record holds that level's moves grouped into "steps" -- a run of
             consecutive moves that carried the same note -- plus ARC's baseline, the run
             guid and the recording line range, so frames can be joined back from the raw
             file (or re-rendered by replaying the moves; the builds are checked equal to
             ours, see below). No frames are committed. One file per card, so a second
             card is added beside the first, never merged into it.

         CHECKS. The script refuses to write anything if:
           - a game on the card is not one of our 25 public games, or its build hash
             differs from GAME_HASHES in render_public_demo_levels.py (the moves would be
             for a different version of the level than the one we document);
           - the per-level move counts rebuilt from the recording disagree with the card's
             own level_actions, or the recording's last state disagrees with the card.

         Usage:
             python scripts/arc3/pull_agent_scorecard.py <card_id> --team "OY Labs" \\
                 --agent "OY1 AGI" --model "gpt-6-astra (high)" \\
                 --source-url https://github.com/OYLabsAI/arc-agi-3-api-harness [--dry-run]
SRP/DRY check: Pass -- one job: a public AI card in, recordings on disk and one derived
         file out. The live build hashes and the "one of our 25" list come from
         pull_human_scorecards.load_game_hashes (which reads render_public_demo_levels.py),
         not a copy. Human cards stay in pull_human_scorecards.py; card-id-to-replay-links
         with an API key stays in fetch_scorecard_replays.py.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pull_human_scorecards import load_game_hashes  # noqa: E402  (stdlib-only module, import-safe)

REPO = Path(__file__).resolve().parents[2]
BASE = "https://arcprize.org"
RAW_ROOT = REPO / "data" / "arc3-agent-runs" / "raw"
LEVELS_ROOT = REPO / "data" / "arc3-agent-runs"
USER_AGENT = "arc-explainer/pull_agent_scorecard (hobby project)"

# Boss, 18-Sep-2026: gpt-6-astra's text is its own shorthand, unreadable to humans, and would
# pollute the training corpus. Its records stay (moves, costs, provenance) but are flagged.
DO_NOT_TRAIN_MODELS = ("gpt-6-astra",)


def do_not_train(model: str | None) -> bool:
    """True for records whose model text must not go into training. Shared with
    pull_official_public_runs.py."""
    name = (model or "").lower().split("/")[-1]
    return any(name.startswith(prefix) for prefix in DO_NOT_TRAIN_MODELS)


def fail(message: str) -> None:
    print(f"[pull_agent_scorecard] {message}", file=sys.stderr)
    sys.exit(1)


def log(message: str) -> None:
    print(f"[pull_agent_scorecard] {message}")


def http_get(url: str, attempts: int = 3) -> bytes:
    """GET with a short backoff. These are idempotent reads, so retrying is safe."""
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            if isinstance(error, urllib.error.HTTPError) and error.code == 404:
                break
            time.sleep(2 * attempt)
    fail(f"GET {url} failed: {last_error}")
    return b""


def fetch_card(card_id: str) -> dict:
    card = json.loads(http_get(f"{BASE}/api/v3/scorecards/{card_id}"))
    if card.get("card_id") != card_id:
        fail(f"card endpoint returned card_id={card.get('card_id')!r}, expected {card_id}")
    return card


def fetch_recording(env_id: str, guid: str, raw_dir: Path) -> Path:
    path = raw_dir / f"{env_id}.{guid}.jsonl"
    if path.exists() and path.stat().st_size > 0:
        return path
    body = http_get(f"{BASE}/api/recordings/{env_id}/{guid}")
    if not body.strip():
        fail(f"empty recording for {env_id}/{guid}")
    tmp = path.with_suffix(".part")
    tmp.write_bytes(body)
    tmp.replace(path)
    log(f"downloaded {path.name} ({len(body) / 1e6:.1f} MB)")
    return path


def note_text(reasoning) -> str | None:
    """OY1 sends '{"experiment": "..."}' as a string. Anything else is kept as text."""
    if reasoning is None:
        return None
    if isinstance(reasoning, str):
        try:
            parsed = json.loads(reasoning)
        except json.JSONDecodeError:
            return reasoning.strip() or None
        reasoning = parsed
    if isinstance(reasoning, dict):
        if isinstance(reasoning.get("experiment"), str):
            return reasoning["experiment"].strip() or None
        return json.dumps(reasoning, ensure_ascii=False)
    return str(reasoning)


def move_label(action_input: dict) -> str:
    name = action_input.get("id") or "UNKNOWN"
    data = action_input.get("data") or {}
    if "x" in data and "y" in data:
        return f"{name}({data['x']},{data['y']})"
    return name


def split_levels(records: list[dict], level_count: int, note_of=note_text) -> tuple[list[dict], str, int]:
    """Split one recording's step records (each line's `data`, opening RESET first) into
    levels. Returns (levels, final_state, reset_moves). Raises ValueError on a move past
    the last level. Shared with pull_official_public_runs.py, which passes its own note_of.

    A move belongs to the level that was being played when it was sent: the previous
    record's levels_completed + 1. A RESET mid-game is a move too (the card counts it).
    Consecutive moves with the same note are one step."""
    if not records:
        raise ValueError("recording has no lines")
    levels = [
        {"level": n, "moves": 0, "steps": [], "firstLine": None, "lastLine": None, "cleared": False}
        for n in range(1, level_count + 1)
    ]
    previous_completed = int(records[0].get("levels_completed") or 0)
    reset_moves = 0
    for index in range(1, len(records)):
        data = records[index]
        action = data.get("action_input") or {}
        level_number = previous_completed + 1
        if not 1 <= level_number <= level_count:
            raise ValueError(f"line {index}: move on level {level_number} of {level_count}")
        level = levels[level_number - 1]
        label = move_label(action)
        if action.get("id") == "RESET":
            reset_moves += 1
        note = note_of(action.get("reasoning"))
        steps = level["steps"]
        if steps and steps[-1]["note"] == note:
            steps[-1]["moves"].append(label)
        else:
            steps.append({"note": note, "moves": [label]})
        level["moves"] += 1
        level["firstLine"] = index if level["firstLine"] is None else level["firstLine"]
        level["lastLine"] = index
        completed = int(data.get("levels_completed") or 0)
        if completed > previous_completed:
            for cleared in range(previous_completed, min(completed, level_count)):
                levels[cleared]["cleared"] = True
        previous_completed = completed
    return levels, str(records[-1].get("state")), reset_moves


def parse_recording(path: Path, level_count: int) -> tuple[list[dict], str, int]:
    """Read a downloaded recording and split it into levels (see split_levels)."""
    lines = [json.loads(line)["data"] for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    try:
        return split_levels(lines, level_count)
    except ValueError as error:
        fail(f"{path.name}: {error}")
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull a public ARC-AGI-3 AI scorecard and its recordings")
    parser.add_argument("card_id")
    parser.add_argument("--team", required=True, help='who ran it, e.g. "OY Labs"')
    parser.add_argument("--agent", required=True, help='their harness name, e.g. "OY1 AGI"')
    parser.add_argument("--model", required=True, help='model and effort, e.g. "gpt-6-astra (high)"')
    parser.add_argument("--source-url", default=None, help="their code, if public")
    parser.add_argument("--dry-run", action="store_true", help="download and check, write no derived files")
    args = parser.parse_args()

    hashes = load_game_hashes()
    card = fetch_card(args.card_id)
    scorecard_url = f"{BASE}/scorecards/{args.card_id}"
    log(f"card {args.card_id}: score {card.get('score')}, {card.get('total_levels_completed')}/"
        f"{card.get('total_levels')} levels, {card.get('total_actions')} actions, ai_agent={card.get('ai_agent')}")

    raw_dir = RAW_ROOT / args.card_id
    raw_dir.mkdir(parents=True, exist_ok=True)

    source = {
        "cardId": args.card_id,
        "team": args.team,
        "agent": args.agent,
        "model": args.model,
        "scorecardUrl": scorecard_url,
        "sourceUrl": args.source_url,
        "publishedAt": card.get("published_at"),
        "competitionMode": card.get("competition_mode"),
        "doNotTrain": do_not_train(args.model),
    }

    level_records: list[dict] = []
    games_matched = 0
    problems: list[str] = []

    for env in sorted(card.get("environments") or [], key=lambda e: e.get("id", "")):
        env_id = env.get("id", "")
        game_id, _, build = env_id.partition("-")
        if game_id not in hashes:
            problems.append(f"{env_id}: not one of our public games")
            continue
        if hashes[game_id] != build:
            problems.append(f"{env_id}: build {build} is not our live build {hashes[game_id]}")
            continue
        runs = env.get("runs") or []
        if len(runs) != 1:
            problems.append(f"{env_id}: {len(runs)} runs on the card; this script expects exactly one")
            continue
        run = runs[0]
        guid = run["guid"]
        level_count = int(run.get("number_of_levels") or env.get("level_count") or 0)
        card_level_actions = [int(n) for n in run.get("level_actions") or []]
        baselines = [int(n) for n in run.get("level_baseline_actions") or []]

        path = fetch_recording(env_id, guid, raw_dir)
        levels, final_state, reset_moves = parse_recording(path, level_count)

        rebuilt = [level["moves"] for level in levels][: len(card_level_actions)]
        if rebuilt != card_level_actions:
            problems.append(f"{env_id}: per-level moves {rebuilt} != card level_actions {card_level_actions}")
            continue
        if final_state != run.get("state"):
            problems.append(f"{env_id}: recording ends {final_state}, card says {run.get('state')}")
            continue

        replay_url = f"{BASE}/replay/{guid}"
        for level in levels:
            if level["moves"] == 0:
                continue
            baseline = baselines[level["level"] - 1] if level["level"] - 1 < len(baselines) else None
            level_records.append({
                "source": source,
                "gameId": game_id,
                "build": build,
                "envId": env_id,
                "guid": guid,
                "replayUrl": replay_url,
                "level": level["level"],
                "levelCount": level_count,
                "cleared": level["cleared"],
                "moves": level["moves"],
                "baselineActions": baseline,
                "decisions": len(level["steps"]),
                "steps": level["steps"],
                "recordingLines": [level["firstLine"], level["lastLine"]],
            })
        games_matched += 1
        log(f"{env_id}: {run.get('state')}, {sum(rebuilt)} moves, {sum(len(l['steps']) for l in levels)} notes, "
            f"{reset_moves} resets -- matches card")

    if problems:
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        fail(f"{len(problems)} problem(s); nothing written")

    total_moves = sum(record["moves"] for record in level_records)
    if total_moves != card.get("total_actions"):
        fail(f"rebuilt {total_moves} moves in total, card says {card.get('total_actions')}; nothing written")

    log(f"all {games_matched} games match the card: {len(level_records)} level records, {total_moves} moves, "
        f"{sum(r['decisions'] for r in level_records)} notes")
    if args.dry_run:
        log("dry run: no derived files written")
        return 0

    levels_path = LEVELS_ROOT / f"{args.card_id}.levels.jsonl"
    levels_path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in level_records), encoding="utf-8")
    log(f"wrote {levels_path.relative_to(REPO)} ({levels_path.stat().st_size / 1e3:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
