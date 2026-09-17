"""
Author: Claude Opus 5
Date: 2026-09-16
PURPOSE: Build shared/arc3Games/humanPlay.generated.json -- the human play data behind the
         two human numbers on each public ARC-AGI-3 game page: ARC's own baseline action
         counts per level, and one human player's recent scorecard runs (today the owner,
         who goes by Boss and plays on the arcprize.org account "Mark").

         WHAT IT READS.
           1. external/ARCEngine/environment_files/<id>/<live hash>/metadata.json
              `baseline_actions` for each of the 25 public games. Live hashes come from
              GAME_HASHES in scripts/arc3/render_public_demo_levels.py, parsed with `ast`
              (that module imports numpy/PIL at the top, so it is not imported).
           2. GET https://arcprize.org/api/user/scorecards?limit=50&at=0 -- the player's
              card list (cookie auth). The list view zeroes open_at, so it is only used
              for card ids.
           3. GET https://arcprize.org/api/user/scorecards/<card_id> for every listed card --
              real open_at, card tags, and environments[].runs[].

         WHICH RUNS ARE KEPT. A run is kept only if, checked in this order (the first
         failed check is the drop reason that gets counted):
           - actions > 0                         (dropped as zeroActions -- a card open)
           - card open_at >= 2026-06-18T00:00Z   (beforeCutoff -- 90 days before 16 Sep)
           - card tags include "human"           (notHumanTag)
           - game is one of the 25 public games  (notPublicGame)
           - build hash (after the dash in the env id) is the live hash (wrongBuild)
         The cutoff is the same constant as HUMAN_DATA_CUTOFF in
         shared/arc3Games/humanDifficulty.ts. Change both together.

         WHY 50 CARDS IS ENOUGH. The list endpoint caps at 50 and `at` does not page
         (at=50 returns the same first rows as at=0 -- checked 16 Sep). It is sorted by
         published_at, newest first, and a card is always published after it is opened, so
         once the oldest listed card was published before the cutoff, every card opened on
         or after the cutoff is already in the list. The script refuses to write if that is
         not true (the oldest listed card is still inside the window), rather than silently
         committing a partial set.

         RUN ORDER. runs[] inside one environment of one card is in play order. Checked on
         the owner's s5i5 card of 16 Sep by walking its recording: its three rows (0, 831
         and 507 actions) match, in order, the three stretches between full resets. All
         three rows share one guid -- guid is the play session, not the run -- so each kept
         run also records runIndex (its position in runs[]) to stay addressable.

         WHAT IS COMMITTED. Only: player, gameId, build, cardId, guid, runIndex, state,
         levelsCompleted, levelCount, actions, resets, score, levelActions,
         levelBaselineActions, openAt -- built field by field, never copied from the API
         object. No user id. The cookie is read from a file outside the repo and is never
         printed, logged or written. Runs for other players already in the file are kept,
         so another human's scorecards can be added later by running this with their
         cookie and ARC3_HUMAN_PLAYER set to their arcprize.org user name.

         `score` is ARC-AGI-3's per-run efficiency score, not "levels cleared": the owner's
         9/9 su15 win scored 90.6.

         Usage:
             python3 scripts/arc3/pull_human_scorecards.py [--dry-run] [--out PATH]
         Env:
             ARC3_HUMAN_COOKIE_FILE  default ~/bubba-workspace/secrets/arcprize-boss-cookie.txt
             ARC3_HUMAN_ACCOUNT      default Mark -- the arcprize.org user_name the cards must carry
             ARC3_HUMAN_PLAYER       default Boss -- the name the site shows (the owner goes by Boss)
SRP/DRY check: Pass -- one job: scorecards + baselines in, one committed JSON out. The
         endpoints and cookie flow follow ~/bubba-workspace/tools/arc3/pull_boss_scorecards.py
         (outside the repo, writes raw dumps). Live hashes are read from
         render_public_demo_levels.py instead of copied. The ratings built on this file live
         in shared/arc3Games/humanDifficulty.ts, not here.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ENV_FILES = REPO / "external" / "ARCEngine" / "environment_files"
HASHES_SOURCE = REPO / "scripts" / "arc3" / "render_public_demo_levels.py"
DEFAULT_OUT = REPO / "shared" / "arc3Games" / "humanPlay.generated.json"
DEFAULT_COOKIE_FILE = "~/bubba-workspace/secrets/arcprize-boss-cookie.txt"

BASE = "https://arcprize.org"
LIST_LIMIT = 50
CUTOFF = "2026-06-18T00:00:00Z"
DROP_REASONS = ("zeroActions", "beforeCutoff", "notHumanTag", "notPublicGame", "wrongBuild")


def fail(message: str) -> None:
    print(f"[pull_human_scorecards] {message}", file=sys.stderr)
    sys.exit(1)


def parse_iso(value: str | None) -> datetime | None:
    """ISO timestamps from arcprize.org carry a trailing Z and a fractional second whose
    digit count is not fixed -- 6 digits on most cards, 5 on some (seen on the 12-Sep
    r11l and re86 cards). Python 3.9's datetime.fromisoformat accepts only 3 or 6
    fractional digits, so anything else raised ValueError and this returned None, and a
    None card open_at is indistinguishable from "opened before the cutoff": two real,
    in-window runs were being dropped and counted as beforeCutoff. Pad to 6 first.
    Fixed 2026-09-17 (Claude Opus 5)."""
    if not value or not isinstance(value, str):
        return None
    text = value.replace("Z", "+00:00")
    match = re.match(r"^(.+\.)(\d{1,6})([+-]\d{2}:\d{2})$", text)
    if match:
        text = f"{match.group(1)}{match.group(2).ljust(6, '0')}{match.group(3)}"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def load_game_hashes() -> dict[str, str]:
    tree = ast.parse(HASHES_SOURCE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "GAME_HASHES" for t in node.targets
        ):
            hashes = ast.literal_eval(node.value)
            if not isinstance(hashes, dict) or not hashes:
                fail(f"GAME_HASHES in {HASHES_SOURCE} is not a non-empty dict")
            return {str(k): str(v) for k, v in hashes.items()}
    fail(f"could not find GAME_HASHES in {HASHES_SOURCE}")
    return {}


def load_baselines(hashes: dict[str, str]) -> dict[str, dict]:
    games: dict[str, dict] = {}
    for game_id in sorted(hashes):
        build = hashes[game_id]
        meta_path = ENV_FILES / game_id / build / "metadata.json"
        if not meta_path.exists():
            fail(f"missing {meta_path}")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("game_id") != f"{game_id}-{build}":
            fail(f"{meta_path} says game_id={meta.get('game_id')!r}, expected {game_id}-{build}")
        baseline = meta.get("baseline_actions")
        if not isinstance(baseline, list) or not baseline or not all(
            isinstance(n, int) and n > 0 for n in baseline
        ):
            fail(f"{meta_path} has no usable baseline_actions")
        games[game_id] = {
            "build": build,
            "levelCount": len(baseline),
            "baselineActions": baseline,
            "baselineTotal": sum(baseline),
        }
    return games


def read_cookie() -> str:
    path = Path(os.path.expanduser(os.environ.get("ARC3_HUMAN_COOKIE_FILE", DEFAULT_COOKIE_FILE)))
    if not path.exists():
        fail(f"cookie file not found (set ARC3_HUMAN_COOKIE_FILE); looked at {path}")
    cookie = path.read_text(encoding="utf-8").strip().replace("\n", "")
    if not cookie:
        fail("cookie file is empty")
    return cookie


def get_json(path: str, cookie: str):
    req = urllib.request.Request(
        BASE + path,
        headers={"Cookie": cookie, "User-Agent": "Mozilla/5.0", "Accept": "application/json"},
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                fail(f"arcprize.org answered {error.code} for {path.split('?')[0]} -- the cookie has expired or is wrong")
            last_error = error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
        time.sleep(2 * (attempt + 1))
    fail(f"GET {path.split('?')[0]} failed after 3 tries: {last_error!r}")
    return None


def drop_reason(run: dict, env_id: str, card_open: datetime | None, card_tags: list, hashes: dict[str, str]) -> str | None:
    actions = run.get("actions")
    if not isinstance(actions, int) or actions <= 0:
        return "zeroActions"
    if card_open is None or card_open < parse_iso(CUTOFF):
        return "beforeCutoff"
    if "human" not in card_tags:
        return "notHumanTag"
    game_id, _, build = env_id.partition("-")
    if game_id not in hashes:
        return "notPublicGame"
    if build != hashes[game_id]:
        return "wrongBuild"
    return None


def int_list(value) -> list[int]:
    return [int(n) for n in value] if isinstance(value, list) else []


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull recent human ARC-AGI-3 scorecard runs and ARC baselines into shared/arc3Games/humanPlay.generated.json")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--dry-run", action="store_true", help="print the summary, write nothing")
    args = parser.parse_args()

    # The arcprize.org account is named "Mark"; the owner goes by Boss, and Boss is what the
    # site shows. Match cards on the account name, label runs with the player name.
    account = os.environ.get("ARC3_HUMAN_ACCOUNT", "Mark")
    player = os.environ.get("ARC3_HUMAN_PLAYER", "Boss")
    hashes = load_game_hashes()
    games = load_baselines(hashes)
    cookie = read_cookie()

    listing = get_json(f"/api/user/scorecards?limit={LIST_LIMIT}&at=0", cookie)
    cards = listing.get("items") if isinstance(listing, dict) else None
    if not isinstance(cards, list):
        fail("scorecard list response has no items[]")
    published = sorted(filter(None, (parse_iso(c.get("published_at")) for c in cards)))
    oldest_published = published[0] if published else None
    if len(cards) >= LIST_LIMIT and (oldest_published is None or oldest_published >= parse_iso(CUTOFF)):
        fail(
            f"the list is capped at {LIST_LIMIT} cards and the oldest one is still inside the window "
            f"(published {oldest_published}); recent cards may be missing, so nothing was written"
        )

    kept: list[dict] = []
    drops = {reason: 0 for reason in DROP_REASONS}
    runs_seen = 0
    cutoff_dt = parse_iso(CUTOFF)
    for index, card in enumerate(cards):
        card_id = card.get("card_id")
        if not isinstance(card_id, str) or not card_id:
            fail(f"list item {index} has no card_id")
        detail = get_json(f"/api/user/scorecards/{card_id}", cookie)
        user_name = detail.get("user_name")
        if user_name != account:
            fail(f"card {card_id} belongs to user_name {user_name!r}, expected {account!r} (set ARC3_HUMAN_ACCOUNT)")
        card_open = parse_iso(detail.get("open_at"))
        card_tags = detail.get("tags") or []
        for env in detail.get("environments") or []:
            env_id = env.get("id") or ""
            for run_index, run in enumerate(env.get("runs") or []):
                runs_seen += 1
                run_env_id = run.get("id") or env_id
                reason = drop_reason(run, run_env_id, card_open, card_tags, hashes)
                if reason:
                    drops[reason] += 1
                    continue
                game_id, _, build = run_env_id.partition("-")
                baseline = games[game_id]["baselineActions"]
                level_baseline = int_list(run.get("level_baseline_actions"))
                if level_baseline != baseline:
                    fail(
                        f"{run_env_id} run {run_index} on card {card_id}: level_baseline_actions "
                        f"{level_baseline} != metadata.json baseline_actions {baseline}"
                    )
                assert card_open is not None and card_open >= cutoff_dt
                kept.append({
                    "player": player,
                    "gameId": game_id,
                    "build": build,
                    "cardId": card_id,
                    "guid": str(run.get("guid") or ""),
                    "runIndex": run_index,
                    "state": str(run.get("state") or "UNKNOWN"),
                    "levelsCompleted": int(run.get("levels_completed") or 0),
                    "levelCount": int(run.get("number_of_levels") or env.get("level_count") or len(baseline)),
                    "actions": int(run["actions"]),
                    "resets": int(run.get("resets") or 0),
                    "score": float(run.get("score") or 0),
                    "levelActions": int_list(run.get("level_actions")),
                    "levelBaselineActions": level_baseline,
                    "openAt": detail["open_at"],
                })
        time.sleep(0.2)

    kept.sort(key=lambda r: (r["player"], r["gameId"], r["openAt"], r["cardId"], r["runIndex"]))
    pull = {
        "player": player,
        "pulledAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cardsListed": len(cards),
        "listCap": LIST_LIMIT,
        "oldestListedPublishedAt": oldest_published.strftime("%Y-%m-%dT%H:%M:%SZ") if oldest_published else None,
        "runsSeen": runs_seen,
        "runsKept": len(kept),
        "dropped": drops,
    }

    out_path = Path(args.out)
    other_runs: list[dict] = []
    other_pulls: list[dict] = []
    if out_path.exists():
        previous = json.loads(out_path.read_text(encoding="utf-8"))
        other_runs = [r for r in previous.get("runs", []) if r.get("player") != player]
        other_pulls = [p for p in previous.get("pulls", []) if p.get("player") != player]

    data = {
        "cutoff": CUTOFF,
        "games": games,
        "pulls": sorted(other_pulls + [pull], key=lambda p: p["player"]),
        "runs": sorted(other_runs + kept, key=lambda r: (r["player"], r["gameId"], r["openAt"], r["cardId"], r["runIndex"])),
    }

    per_game: dict[str, list[str]] = {}
    for run in kept:
        per_game.setdefault(run["gameId"], []).append(f"{run['state']}:{run['actions']}")
    print(json.dumps({k: v for k, v in pull.items()}, indent=1))
    for game_id in sorted(games):
        print(f"  {game_id}  baseline={games[game_id]['baselineTotal']:>5}  runs={', '.join(per_game.get(game_id, [])) or '-'}")

    if args.dry_run:
        print("dry run: nothing written")
        return 0
    # Number lists (per-level actions and baselines) on one line each, so a diff of the
    # committed file reads run by run instead of one number per line.
    text = re.sub(
        r"\[\s*(-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)*)\s*\]",
        lambda m: "[" + ", ".join(part.strip() for part in m.group(1).split(",")) + "]",
        json.dumps(data, indent=2),
    )
    out_path.write_text(text + "\n", encoding="utf-8")
    print(f"wrote {out_path.relative_to(REPO) if out_path.is_relative_to(REPO) else out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
