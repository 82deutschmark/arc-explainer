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
from datetime import datetime, timezone
from urllib import error, request


# Free models to test
FREE_MODELS = [
    "xiaomi/mimo-v2-flash:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
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


def build_pairings(free_models: list[str], cheap_models: list[str]) -> list[tuple[str, str]]:
    """
    Build all pairings: each free model plays each cheap model in both directions.
    Also includes free vs free head-to-head matches.
    """
    pairings: list[tuple[str, str]] = []

    # Free vs Cheap (both directions)
    for free_model in free_models:
        for cheap_model in cheap_models:
            pairings.append((free_model, cheap_model))
            pairings.append((cheap_model, free_model))

    # Free vs Free head-to-head (both directions)
    if len(free_models) >= 2:
        for i, model_a in enumerate(free_models):
            for model_b in free_models[i + 1:]:
                pairings.append((model_a, model_b))
                pairings.append((model_b, model_a))

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
        default=600,
        help="Timeout per match request in seconds (default: 600).",
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
        for i, (model_a, model_b) in enumerate(pairings, start=1):
            print(f"  {i:2d}. {model_a} vs {model_b} (x{args.count})")
        print("")
        print("No API calls made.")
        return 0

    success_count = 0
    failure_count = 0
    start_time = time.time()

    for index, (model_a, model_b) in enumerate(pairings, start=1):
        label = f"[{index}/{total_pairings}] {model_a} vs {model_b} (x{args.count})"
        print(f"{utc_timestamp()} {label}")

        request_start = time.time()
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
            elapsed = time.time() - request_start

            if result.get("success") is False:
                failure_count += 1
                print(f"  ERROR ({format_duration(elapsed)}): {result.get('error', 'Unknown')}")
            else:
                success_count += 1
                print(f"  OK ({format_duration(elapsed)})")

        except Exception as exc:
            elapsed = time.time() - request_start
            failure_count += 1
            print(f"  ERROR ({format_duration(elapsed)}): {exc}", file=sys.stderr)

        time.sleep(max(args.delay_ms, 0) / 1000.0)

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
