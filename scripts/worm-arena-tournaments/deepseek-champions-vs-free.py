#!/usr/bin/env python3
# Author: Codex (GPT-5)
# Date: 2026-01-10T00:35:00Z
# PURPOSE: Run a Worm Arena tournament where DeepSeek v3.2 EXP and DeepSeek Chat v3.1
#          play two total matches per pairing (both directions) against a curated
#          list of free models, plus a head-to-head match between the champions.
#          Uses the SnakeBench run-batch API with default game settings and a
#          sequential queue to keep free-model concurrency at one active match,
#          with timestamped logs and periodic summaries for operator visibility.
# SRP/DRY check: Pass - single-purpose tournament runner.

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from urllib import error, request


CHAMPIONS = [
    "deepseek/deepseek-v3.2-exp",
    "deepseek/deepseek-chat-v3.1",
]

FREE_MODELS = [
    "deepseek/deepseek-r1-0528:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemma-3-27b-it:free",
    "kwaipilot/kat-coder-pro:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "openai/gpt-oss-120b:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen3-coder:free",
    "xiaomi/mimo-v2-flash:free",
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


def post_run_batch(base_url: str, model_a: str, model_b: str, timeout_sec: int) -> dict:
    url = base_url.rstrip("/") + "/api/snakebench/run-batch"
    payload = {
        "modelA": model_a,
        "modelB": model_b,
        "count": 1,
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


def build_pairings(champions: list[str], free_models: list[str]) -> list[tuple[str, str]]:
    pairings: list[tuple[str, str]] = []

    champion_a = champions[0]
    champion_b = champions[1]
    forward = list(free_models)
    reverse = list(reversed(free_models))

    # First pass: champion A starts from the top, champion B starts from the bottom.
    for index in range(len(forward)):
        pairings.append((champion_a, forward[index]))
        pairings.append((champion_b, reverse[index]))

    # Second pass: reverse direction, still avoiding immediate back-to-back rematches.
    for index in range(len(forward)):
        pairings.append((forward[index], champion_a))
        pairings.append((reverse[index], champion_b))

    # Champions head-to-head (both directions).
    pairings.append((champion_a, champion_b))
    pairings.append((champion_b, champion_a))

    return pairings


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run a DeepSeek champions tournament vs free models using SnakeBench."
        )
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:5000",
        help="API base URL for ARC Explainer (default: http://localhost:5000).",
    )
    parser.add_argument(
        "--delay-ms",
        type=int,
        default=250,
        help="Delay between matches in milliseconds.",
    )
    parser.add_argument(
        "--timeout-sec",
        type=int,
        default=600,
        help="Timeout per match request in seconds.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print match plan without executing API calls.",
    )
    parser.add_argument(
        "--summary-every",
        type=int,
        default=5,
        help="Print a periodic summary every N matches (default: 5).",
    )
    parser.add_argument(
        "--summary-seconds",
        type=int,
        default=120,
        help="Print a periodic summary if this many seconds have passed (default: 120).",
    )
    args = parser.parse_args()

    pairings = build_pairings(CHAMPIONS, FREE_MODELS)
    total = len(pairings)

    print("")
    print("Worm Arena Tournament: DeepSeek Champions vs Free Models")
    print(f"Champions: {', '.join(CHAMPIONS)}")
    print(f"Free models: {len(FREE_MODELS)}")
    print(f"Total matches (both directions): {total}")
    print(f"Base URL: {args.base_url}")
    print(f"Delay: {args.delay_ms} ms")
    print(f"Timeout: {args.timeout_sec} sec")
    print(f"Summary every: {args.summary_every} matches or {args.summary_seconds} sec")
    print("")

    success_count = 0
    failure_count = 0
    start_time = time.time()
    last_summary_time = start_time

    if args.summary_every < 1:
        args.summary_every = 1
    if args.summary_seconds < 1:
        args.summary_seconds = 1

    for index, (model_a, model_b) in enumerate(pairings, start=1):
        label = f"[{index}/{total}] {model_a} vs {model_b}"
        print(f"{utc_timestamp()} {label}")

        if args.dry_run:
            continue

        request_start = time.time()
        try:
            result = post_run_batch(args.base_url, model_a, model_b, args.timeout_sec)
            elapsed = time.time() - request_start
            if result.get("success") is False:
                failure_count += 1
                print(
                    f"{utc_timestamp()} ERROR in {format_duration(elapsed)}: "
                    f"{result.get('error', 'Unknown error')}"
                )
            else:
                success_count += 1
                print(f"{utc_timestamp()} OK in {format_duration(elapsed)}")
        except Exception as exc:
            elapsed = time.time() - request_start
            failure_count += 1
            print(
                f"{utc_timestamp()} ERROR in {format_duration(elapsed)}: {exc}",
                file=sys.stderr,
            )

        time.sleep(max(args.delay_ms, 0) / 1000.0)

        elapsed_total = time.time() - start_time
        since_last_summary = time.time() - last_summary_time
        if (
            index % args.summary_every == 0
            or since_last_summary >= args.summary_seconds
            or index == total
        ):
            in_flight = total - index
            print(
                f"{utc_timestamp()} SUMMARY: "
                f"{index}/{total} queued, "
                f"{success_count} ok, "
                f"{failure_count} failed, "
                f"{in_flight} remaining, "
                f"elapsed {format_duration(elapsed_total)}"
            )
            last_summary_time = time.time()

    print("")
    print(f"{utc_timestamp()} Tournament complete.")
    print(f"Successful matches: {success_count}")
    print(f"Failed matches: {failure_count}")
    return 0 if failure_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
