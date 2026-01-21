#!/usr/bin/env python3
# Author: Claude Opus 4.5
# Date: 2026-01-16T12:00:00Z
# PURPOSE: Test free models (MiMo v2 Flash, Nemotron 3 Nano) against cheap paid models
#          (GPT-5-nano, GPT-5-mini, GPT-OSS-120B) in Worm Arena. Both directions per pairing.
#          No rate limiting - all models can run fast.
# SRP/DRY check: Pass - single-purpose tournament runner.

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib import error, request


# Free models to test
FREE_MODELS = [
    "xiaomi/mimo-v2-flash:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "z-ai/glm-4.7-flash",
]

# Cheap paid models as opponents
CHEAP_MODELS = [
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-oss-120b",
]


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def format_duration(seconds: float) -> str:
    minutes, secs = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{secs:02d}s"
    if minutes:
        return f"{minutes}m{secs:02d}s"
    return f"{secs}s"


def post_run_batch(
    base_url: str,
    model_a: str,
    model_b: str,
    count: int,
    num_apples: int,
    player_persona: str,
    timeout_sec: int,
) -> dict:
    """Queue one or more matches between model_a and model_b."""
    url = base_url.rstrip("/") + "/api/snakebench/run-batch"
    payload = {
        "modelA": model_a,
        "modelB": model_b,
        "count": count,
        "numApples": num_apples,
        "playerPersona": player_persona,
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout_sec) as resp:
            body = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"HTTP {exc.code} {exc.reason}: {body}") from exc
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"raw": body}


def build_pairings(free_models: list[str], cheap_models: list[str]) -> list[tuple[int, str, str]]:
    """
    Build all pairings with indices: each free model plays each cheap model in both directions.
    Also includes free vs free head-to-head matches.
    Returns: [(index, model_a, model_b), ...]
    """
    pairings: list[tuple[int, str, str]] = []
    index = 1

    # Free vs Cheap (both directions)
    for free_model in free_models:
        for cheap_model in cheap_models:
            pairings.append((index, free_model, cheap_model))
            index += 1
            pairings.append((index, cheap_model, free_model))
            index += 1

    # Free vs Free head-to-head (both directions)
    if len(free_models) >= 2:
        for i, model_a in enumerate(free_models):
            for model_b in free_models[i + 1:]:
                pairings.append((index, model_a, model_b))
                index += 1
                pairings.append((index, model_b, model_a))
                index += 1

    return pairings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Test free models against cheap models in Worm Arena."
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:5000",
        help="API base URL (default: http://localhost:5000).",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=3,
        help="Matches per pairing (default: 3).",
    )
    parser.add_argument(
        "--num-apples",
        type=int,
        default=15,
        help="Number of apples on the board (default: 15).",
    )
    parser.add_argument(
        "--persona",
        type=str,
        default="B",
        help="LLM player persona: default, A, or B (default: B).",
    )
    parser.add_argument(
        "--delay-ms",
        type=int,
        default=100,
        help="Delay between API calls in milliseconds (default: 100).",
    )
    parser.add_argument(
        "--timeout-sec",
        type=int,
        default=28800,
        help="Timeout per batch request in seconds (default: 28800 = 8 hours).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print match plan without executing API calls.",
    )
    args = parser.parse_args()

    pairings = build_pairings(FREE_MODELS, CHEAP_MODELS)
    total_pairings = len(pairings)
    total_matches = total_pairings * args.count

    print("")
    print("=" * 60)
    print("Worm Arena: Free Models vs Cheap Models")
    print("=" * 60)
    print(f"Free models:  {', '.join(FREE_MODELS)}")
    print(f"Cheap models: {', '.join(CHEAP_MODELS)}")
    print(f"Pairings: {total_pairings} (both directions)")
    print(f"Matches per pairing: {args.count}")
    print(f"Total matches: {total_matches}")
    print(f"Apples: {args.num_apples}")
    print(f"Persona: {args.persona}")
    print(f"Base URL: {args.base_url}")
    print("=" * 60)
    print("")

    if args.dry_run:
        print("DRY RUN - Match plan:")
        for pairing_idx, model_a, model_b in pairings:
            print(f"  {pairing_idx:2d}. {model_a} vs {model_b} (x{args.count})")
        print("")
        print("No API calls made.")
        return 0

    def run_pairing(pairing_idx: int, model_a: str, model_b: str) -> dict:
        """Run matches for a single pairing and return result."""
        label = f"[{pairing_idx}/{total_pairings}] {model_a} vs {model_b}"
        start = time.time()
        try:
            result = post_run_batch(
                args.base_url,
                model_a,
                model_b,
                args.count,
                args.num_apples,
                args.persona,
                args.timeout_sec,
            )
            elapsed = time.time() - start
            return {
                "pairing_idx": pairing_idx,
                "label": label,
                "elapsed": elapsed,
                "result": result,
                "error": None,
            }
        except Exception as exc:
            elapsed = time.time() - start
            return {
                "pairing_idx": pairing_idx,
                "label": label,
                "elapsed": elapsed,
                "result": None,
                "error": str(exc),
            }

    start_time = time.time()
    success_count = 0
    failure_count = 0

    print(f"{utc_timestamp()} Firing {total_pairings} pairings in parallel...")
    print("(Each pairing will block for ~5-15 minutes while matches run)")
    print("(Results will print as pairings complete)\n")

    # Use thread pool to run pairings in parallel
    with ThreadPoolExecutor(max_workers=8) as executor:
        # Track which pairings are queued
        futures = {}
        for idx, model_a, model_b in pairings:
            label = f"[{idx}/{total_pairings}] {model_a} vs {model_b}"
            future = executor.submit(run_pairing, idx, model_a, model_b)
            futures[future] = label
            print(f"{utc_timestamp()} QUEUED: {label}")

        print("")

        # Print results as they complete
        completed_count = 0
        for future in as_completed(futures):
            result_data = future.result()
            pairing_idx = result_data["pairing_idx"]
            label = result_data["label"]
            elapsed = result_data["elapsed"]
            completed_count += 1

            if result_data["error"]:
                failure_count += 1
                print(f"\n{utc_timestamp()} COMPLETE: {label} [{completed_count}/{total_pairings}]", file=sys.stderr)
                print(f"  FAILED ({format_duration(elapsed)}): {result_data['error']}", file=sys.stderr)
            else:
                result = result_data["result"]
                if result.get("success") is False:
                    failure_count += 1
                    print(f"\n{utc_timestamp()} COMPLETE: {label} [{completed_count}/{total_pairings}]")
                    print(f"  FAILED ({format_duration(elapsed)}): {result.get('error', 'Unknown')}")
                else:
                    success_count += 1
                    batch = result.get("batch", {})
                    results = batch.get("results", [])
                    errors = batch.get("errors", [])

                    print(f"\n{utc_timestamp()} COMPLETE: {label} [{completed_count}/{total_pairings}]")
                    print(f"  OK in {format_duration(elapsed)}")
                    print(f"  {len(results)}/{args.count} matches")
                    if errors:
                        print(f"  {len(errors)} errors")

                    # Show first 3 game IDs
                    if results:
                        game_ids = [r.get("gameId", "unknown") for r in results[:3]]
                        if len(results) > 3:
                            print(f"  Games: {', '.join(game_ids)}, ... (+{len(results) - 3} more)")
                        else:
                            print(f"  Games: {', '.join(game_ids)}")

    total_elapsed = time.time() - start_time
    print("")
    print("=" * 60)
    print(f"{utc_timestamp()} Tournament complete")
    print(f"Successful: {success_count}/{total_pairings} pairings")
    print(f"Failed: {failure_count}/{total_pairings} pairings")
    print(f"Total time: {format_duration(total_elapsed)}")
    print("=" * 60)

    return 0 if failure_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
