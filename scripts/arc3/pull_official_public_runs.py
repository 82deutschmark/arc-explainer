"""
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: Pull ARC Prize's OWN model runs on the 25 public ARC-AGI-3 games -- every replay
         linked from a results page such as arcprize.org/results/openai-gpt-6-astra -- and
         keep, per run: the token usage of every move (so the public-set cost can be
         rebuilt, which ARC does not publish), and every level's moves with the model's
         own text (for the training corpus). Frames are dropped while streaming, so the
         ~30 GB of recordings never touch the disk.

         WHAT IT READS (all public, no login):
           1. https://arcprize.org/media/data/leaderboard/v3.json -> resultsUrl of every
              ARC-AGI-3 model (used when no slug is given).
           2. https://arcprize.org/results/<slug> -> every /replay/<guid> link. For Astra
              that is 300: 2 harnesses x 6 efforts x 25 games.
           3. https://three.arcprize.org/api/sessions/<guid> -> the run's card: model,
              config (e.g. openai-gpt-6-astra-high-provider-adapter), env id, state,
              level_actions, level_baseline_actions.
           4. https://arcprize.org/api/recordings/<env_id>/<guid> -> JSONL, one line per
              move. action_input.reasoning is ARC's ActionMetadata:
              {output, reasoning (summary), usage {input_tokens, input_tokens_details.
              cached_tokens, output_tokens, output_tokens_details.reasoning_tokens}, cost
              (always 0 in these runs), state {harness_compaction {usage, cost}, ...}}.

         HOW COST IS REBUILT. ARC's harness docs (arcprize/arc-agi-3-benchmarking,
         docs/runtime-state.md, "Published v3 costs are reconstructed downstream from
         ARC-facing action token usage and configured input/output prices") say the move's
         top-level usage already includes any harness compaction since the previous move,
         and state.harness_compaction holds that compaction's share. So: total = sum of
         top-level usage over moves; nothing is added twice. For the long-context rule
         (a request over 272K input tokens) the move's own request and its compaction are
         classified separately. Prices are applied by official_run_costs.py, not here.

         WHAT IT WRITES.
           - data/arc3-official-runs/cache/<guid>.json          (gitignored, resumable)
             One run: card fields, usage totals, and every level's steps (model text +
             moves). Re-running skips runs already cached.
           - data/arc3-official-runs/sessions.jsonl             (committed)
             One row per run: model, config, harness, effort, game, state, levels, moves,
             token totals, long-context totals, and whether our per-level move counts
             matched the card.
           - data/arc3-official-runs/levels-won.jsonl.gz        (committed)
             Every CLEARED level from every run, as training records: game, build, level,
             moves, baseline, and steps (the model's text with the moves it made).

         Usage:
             python scripts/arc3/pull_official_public_runs.py [slug ...] [--workers 6]
             e.g. openai-gpt-6-astra anthropic-claude-opus-5 ; no slug = every v3 model.
SRP/DRY check: Pass -- one job: official public runs in, usage + level records out. Level
         splitting and move labels are pull_agent_scorecard.split_levels / move_label; live
         builds come from pull_human_scorecards.load_game_hashes. Prices and dollar totals
         live in official_run_costs.py.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pull_agent_scorecard import do_not_train, split_levels  # noqa: E402
from pull_human_scorecards import load_game_hashes  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT_ROOT = REPO / "data" / "arc3-official-runs"
CACHE_DIR = OUT_ROOT / "cache"
SITE = "https://arcprize.org"
API = "https://three.arcprize.org"
USER_AGENT = "arc-explainer/pull_official_public_runs (hobby project)"
LONG_CONTEXT_INPUT = 272_000  # OpenAI's gpt-6-astra long-context threshold; recorded for every model
BARE_ACTION = re.compile(r"^\s*(RESET|ACTION\d+(?:\s+\d+\s+\d+)?)\s*$")


def log(message: str) -> None:
    print(f"[pull_official_public_runs] {message}", flush=True)


def open_url(url: str, timeout: int = 300):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(request, timeout=timeout)


def get_json(url: str, attempts: int = 4):
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with open_url(url, timeout=120) as response:
                return json.loads(response.read())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last = error
            time.sleep(3 * attempt)
    raise RuntimeError(f"GET {url} failed: {last}")


def results_slugs() -> list[str]:
    board = get_json(f"{SITE}/media/data/leaderboard/v3.json")
    urls = {e.get("resultsUrl") for e in board.get("evaluations", []) if e.get("resultsUrl")}
    return sorted(u.rsplit("/", 1)[-1] for u in urls)


def replay_guids(slug: str) -> list[str]:
    with open_url(f"{SITE}/results/{slug}", timeout=120) as response:
        html = response.read().decode("utf-8", "replace")
    return sorted(set(re.findall(r"/replay/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", html)))


def parse_metadata(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {"output": raw}
        except json.JSONDecodeError:
            return {"output": raw}
    return {}


def official_note(metadata) -> str | None:
    """The model's own words for one move: its reasoning summary (provider adapter) and
    its reply (standard harness), minus a reply that is only the bare action token."""
    meta = parse_metadata(metadata)
    parts = []
    summary = meta.get("reasoning")
    if isinstance(summary, str) and summary.strip():
        parts.append(summary.strip())
    output = meta.get("output")
    if isinstance(output, str) and output.strip() and not BARE_ACTION.match(output):
        parts.append(output.strip())
    return "\n\n".join(parts) or None


def usage_numbers(usage: dict | None) -> tuple[int, int, int, int]:
    usage = usage or {}
    return (
        int(usage.get("input_tokens") or 0),
        int((usage.get("input_tokens_details") or {}).get("cached_tokens") or 0),
        int(usage.get("output_tokens") or 0),
        int((usage.get("output_tokens_details") or {}).get("reasoning_tokens") or 0),
    )


def empty_bucket() -> dict:
    return {"requests": 0, "input": 0, "cached": 0, "output": 0, "reasoning": 0}


def add(bucket: dict, numbers: tuple[int, int, int, int], requests: int = 1) -> None:
    bucket["requests"] += requests
    bucket["input"] += numbers[0]
    bucket["cached"] += numbers[1]
    bucket["output"] += numbers[2]
    bucket["reasoning"] += numbers[3]


def pull_one(guid: str, slug: str) -> dict:
    """Fetch one run, stream its recording, write its cache file. Returns a status row."""
    cache_path = CACHE_DIR / f"{guid}.json"
    if cache_path.exists():
        return {"guid": guid, "status": "cached"}
    card = get_json(f"{API}/api/sessions/{guid}")
    envs = card.get("environments") or []
    if len(envs) != 1 or len(envs[0].get("runs") or []) != 1:
        return {"guid": guid, "status": "error", "error": f"expected 1 env/1 run, got {len(envs)}"}
    env = envs[0]
    run = env["runs"][0]
    env_id = env["id"]
    level_count = int(run.get("number_of_levels") or env.get("level_count") or 0)

    records: list[dict] = []
    totals = {"all": empty_bucket(), "actionRequests": empty_bucket(), "compactionRequests": empty_bucket(),
              "longActionRequests": empty_bucket(), "longCompactionRequests": empty_bucket()}
    moves_without_usage = 0
    last_error: Exception | None = None
    for attempt in range(1, 4):
        records.clear()
        for bucket in totals.values():
            bucket.update(empty_bucket())
        moves_without_usage = 0
        try:
            with open_url(f"{SITE}/api/recordings/{env_id}/{guid}", timeout=600) as response:
                for raw_line in response:
                    if not raw_line.strip():
                        continue
                    data = json.loads(raw_line)["data"]
                    data.pop("frame", None)
                    action = data.get("action_input") or {}
                    meta = parse_metadata(action.get("reasoning"))
                    action["reasoning"] = meta
                    if records:  # line 0 is the opening RESET, not a move
                        if meta.get("usage"):
                            whole = usage_numbers(meta.get("usage"))
                            compaction = usage_numbers(((meta.get("state") or {}).get("harness_compaction") or {}).get("usage"))
                            own = tuple(w - c for w, c in zip(whole, compaction))
                            has_compaction = bool(compaction[0] or compaction[2])
                            add(totals["all"], whole, requests=1 + int(has_compaction))
                            add(totals["actionRequests"], own)
                            if own[0] > LONG_CONTEXT_INPUT:
                                add(totals["longActionRequests"], own)
                            if has_compaction:
                                add(totals["compactionRequests"], compaction)
                                if compaction[0] > LONG_CONTEXT_INPUT:
                                    add(totals["longCompactionRequests"], compaction)
                        else:
                            moves_without_usage += 1
                    records.append(data)
            break
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as error:
            last_error = error
            time.sleep(5 * attempt)
    else:
        return {"guid": guid, "status": "error", "error": f"recording: {last_error}"}

    try:
        levels, final_state, reset_moves = split_levels(records, level_count, note_of=official_note)
    except ValueError as error:
        return {"guid": guid, "status": "error", "error": f"levels: {error}"}

    card_level_actions = [int(n) for n in run.get("level_actions") or []]
    rebuilt = [level["moves"] for level in levels]
    check = "match" if rebuilt[: len(card_level_actions)] == card_level_actions else "mismatch"
    config = card.get("config") or ""
    result = {
        "resultsSlug": slug,
        "model": card.get("model"),
        "config": config,
        "harness": "provider-adapter" if config.endswith("-provider-adapter") else "standard",
        "cardId": card.get("card_id"),
        "tags": card.get("tags"),
        "publishedAt": card.get("published_at"),
        "guid": guid,
        "envId": env_id,
        "gameId": env_id.split("-")[0],
        "build": env_id.partition("-")[2],
        "state": run.get("state"),
        "recordingEndState": final_state,
        "score": run.get("score"),
        "levelsCompleted": run.get("levels_completed"),
        "levelCount": level_count,
        "moves": len(records) - 1,
        "cardActions": run.get("actions"),
        "resets": run.get("resets"),
        "resetMoves": reset_moves,
        "levelActions": card_level_actions,
        "levelBaselineActions": [int(n) for n in run.get("level_baseline_actions") or []],
        "levelCheck": check,
        "movesWithoutUsage": moves_without_usage,
        "usage": totals,
        "levels": levels,
    }
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = cache_path.with_suffix(".part")
    tmp.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    tmp.replace(cache_path)
    return {"guid": guid, "status": "pulled", "config": config, "game": result["gameId"],
            "moves": result["moves"], "check": check}


def effort_of(config: str) -> str:
    """openai-gpt-6-astra-high-provider-adapter -> high. The effort is the last word
    before the harness suffix; configs without one report 'default'."""
    stem = config.removesuffix("-provider-adapter")
    last = stem.rsplit("-", 1)[-1]
    return last if last in {"none", "minimal", "low", "medium", "high", "xhigh", "max"} else "default"


def write_outputs(hashes: dict[str, str]) -> None:
    """Rebuild both committed files from EVERY cached run, whichever invocation pulled it,
    so pulling one model never drops another model's rows."""
    rows, won = [], []
    for path in sorted(CACHE_DIR.glob("*.json")):
        run = json.loads(path.read_text(encoding="utf-8"))
        slug = run["resultsSlug"]
        effort = effort_of(run["config"])
        live = hashes.get(run["gameId"]) == run["build"]
        rows.append({k: v for k, v in run.items() if k != "levels"} | {"effort": effort, "liveBuild": live})
        for level in run["levels"]:
            if not level["cleared"]:
                continue
            index = level["level"] - 1
            won.append({
                "source": {"resultsSlug": slug, "model": run.get("model"), "config": run["config"],
                           "harness": run["harness"], "effort": effort, "cardId": run.get("cardId"),
                           "publishedAt": run.get("publishedAt"), "doNotTrain": do_not_train(run.get("model"))},
                "gameId": run["gameId"], "build": run["build"], "liveBuild": live,
                "envId": run["envId"], "guid": run["guid"],
                "level": level["level"], "levelCount": run["levelCount"],
                "moves": level["moves"],
                "baselineActions": run["levelBaselineActions"][index] if index < len(run["levelBaselineActions"]) else None,
                "steps": level["steps"],
                "recordingLines": [level["firstLine"], level["lastLine"]],
            })
    rows.sort(key=lambda r: (r["resultsSlug"], r["config"], r["gameId"]))
    won.sort(key=lambda r: (r["source"]["resultsSlug"], r["source"]["config"], r["gameId"], r["level"]))
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUT_ROOT / "sessions.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    with gzip.open(OUT_ROOT / "levels-won.jsonl.gz", "wt", encoding="utf-8") as handle:
        for record in won:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    log(f"wrote sessions.jsonl ({len(rows)} runs) and levels-won.jsonl.gz ({len(won)} cleared levels, "
        f"{(OUT_ROOT / 'levels-won.jsonl.gz').stat().st_size / 1e6:.1f} MB)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull ARC Prize's own public-set runs: usage and levels")
    parser.add_argument("slugs", nargs="*", help="results page slugs; default: every ARC-AGI-3 model")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--combine-only", action="store_true", help="rebuild the committed files from the cache, pull nothing")
    args = parser.parse_args()

    hashes = load_game_hashes()
    if args.combine_only:
        write_outputs(hashes)
        return 0
    slugs = args.slugs or results_slugs()
    guids_by_slug = {slug: replay_guids(slug) for slug in slugs}
    for slug, guids in guids_by_slug.items():
        log(f"{slug}: {len(guids)} public replays")
    jobs = [(guid, slug) for slug, guids in guids_by_slug.items() for guid in guids]
    errors = []
    done = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(pull_one, guid, slug): (guid, slug) for guid, slug in jobs}
        for future in as_completed(futures):
            guid, slug = futures[future]
            done += 1
            try:
                status = future.result()
            except Exception as error:  # a worker crash must not lose the other runs
                status = {"guid": guid, "status": "error", "error": repr(error)}
            if status["status"] == "error":
                errors.append(status)
                log(f"[{done}/{len(jobs)}] ERROR {slug} {guid}: {status['error']}")
            elif status["status"] == "pulled":
                log(f"[{done}/{len(jobs)}] {status['config']} {status['game']}: {status['moves']} moves, levels {status['check']}")
    write_outputs(hashes)
    if errors:
        log(f"{len(errors)} run(s) failed; re-run to retry them (cached runs are skipped)")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
