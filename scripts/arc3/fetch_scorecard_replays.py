"""
Author: Claude Sonnet 5
Date: 2026-09-15
PURPOSE: Pull every replay link out of one ARC-AGI-3 scorecard automatically, instead of
         copying each https://arcprize.org/replay/<guid> URL by hand. Mark plays through
         the official web console, which opens a scorecard behind the scenes just like the
         REST API does (docs.arcprize.org/scorecards) and lists it at
         https://arcprize.org/scorecards/<card_id> once he is logged in there -- that page
         is the one thing this script cannot reach (no shared browser session, and account
         pages are not public), so the card_id has to come from Mark.

         Everything past that is ordinary REST: GET /api/scorecard/{card_id} on
         three.arcprize.org, authenticated with the same X-API-Key header already used by
         Arc3ApiClient.ts, returns `environments[].id` (the versioned game_env_id, e.g.
         "bp35-0a0ad940") and, nested under it, `runs[].guid` (the session id that IS the
         replay UUID). No other endpoint lists a user's scorecards or replays -- confirmed
         against the actual OpenAPI spec at docs.arcprize.org/arc3v1.yaml, not guessed.

         Usage:
             python scripts/arc3/fetch_scorecard_replays.py <card_id> [--api-key KEY] [--json]

         Without --api-key, reads ARC3_API_KEY (or ARC_API_KEY) from the environment/.env.
SRP/DRY check: Pass -- one script, one job: card_id in, replay links out. Does not touch
         shared/arc3Games/*.ts itself; that stays a reviewed edit per game.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

API_BASE = "https://three.arcprize.org"


def load_dotenv_key() -> str | None:
    """Minimal .env reader so this works without python-dotenv installed."""
    env_path = pathlib.Path(__file__).resolve().parent.parent.parent / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("ARC3_API_KEY=") or line.startswith("ARC_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def resolve_api_key(cli_key: str | None) -> str:
    key = cli_key or os.environ.get("ARC3_API_KEY") or os.environ.get("ARC_API_KEY") or load_dotenv_key()
    if not key:
        print("[fetch_scorecard_replays] No API key: pass --api-key, or set ARC3_API_KEY/"
              "ARC_API_KEY in the environment or .env.", file=sys.stderr)
        sys.exit(1)
    return key


def fetch_scorecard(card_id: str, api_key: str) -> dict:
    url = f"{API_BASE}/api/scorecard/{card_id}"
    request = urllib.request.Request(url, headers={"X-API-Key": api_key})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"[fetch_scorecard_replays] {error.code} {error.reason}: {body}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("card_id", help="Scorecard id, from arcprize.org/scorecards/<card_id>")
    parser.add_argument("--api-key", help="X-API-Key value; defaults to ARC3_API_KEY/.env")
    parser.add_argument("--json", action="store_true", help="Print raw {game_id: [replay_urls]} JSON")
    args = parser.parse_args()

    api_key = resolve_api_key(args.api_key)
    card = fetch_scorecard(args.card_id, api_key)

    replays: dict[str, list[dict]] = {}
    for env in card.get("environments", []):
        env_id = env.get("id", "unknown")
        short_id = env_id.split("-", 1)[0]
        for run in env.get("runs", []):
            guid = run.get("guid")
            if not guid:
                continue
            replays.setdefault(short_id, []).append({
                "env_id": env_id,
                "guid": guid,
                "url": f"https://arcprize.org/replay/{guid}",
                "state": run.get("state"),
                "score": run.get("score"),
                "levels_completed": run.get("levels_completed"),
            })

    if args.json:
        print(json.dumps(replays, indent=2))
        return

    if not replays:
        print("[fetch_scorecard_replays] No runs with a guid found on this scorecard.")
        return

    for short_id, runs in sorted(replays.items()):
        print(f"\n{short_id}  ({runs[0]['env_id']})")
        for run in runs:
            print(f"  {run['state']:<12} score={run['score']:<6} levels={run['levels_completed']:<3} {run['url']}")


if __name__ == "__main__":
    main()
