#!/usr/bin/env python3
# Author: Cascade
# Date: 2026-02-07T22:35:00Z
# PURPOSE: Reusable Python script to evaluate a new OpenRouter model on ARC puzzles.
#          Sends puzzles to the model via the server's analysis API, saves results to the
#          database, and skips puzzles that already have explanations from the target model.
#          Designed for quick turnaround when new (especially free/cloaked) models appear.
# SRP/DRY check: Pass - single-purpose ARC puzzle evaluator, fully parameterized via CLI.

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional
from urllib import error, request

# Default model to test (override with --model)
DEFAULT_MODEL = "openrouter/pony-alpha"

# Default ARC puzzle sources to evaluate
DEFAULT_SOURCES = ["ARC2-Eval", "ARC1-Eval"]

# Timing defaults
DEFAULT_RATE_LIMIT_MS = 5000       # 5s between analysis calls
DEFAULT_PUZZLE_TIMEOUT_SEC = 1800  # 30 minutes per puzzle
DEFAULT_SAVE_TIMEOUT_SEC = 30     # 30 seconds for save operations


def utc_timestamp() -> str:
    """ISO-ish UTC timestamp for log lines."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def format_duration(seconds: float) -> str:
    """Human-readable duration string."""
    minutes, secs = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{secs:02d}s"
    if minutes:
        return f"{minutes}m{secs:02d}s"
    return f"{secs}s"


def http_get(url: str, timeout_sec: int = 60) -> dict:
    """Simple GET request returning parsed JSON."""
    req = request.Request(url, method="GET")
    try:
        with request.urlopen(req, timeout=timeout_sec) as resp:
            body = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"GET {url} -> HTTP {exc.code}: {body}") from exc
    return json.loads(body)


def http_post(url: str, payload: dict, timeout_sec: int = 60) -> dict:
    """Simple POST request returning parsed JSON."""
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
        raise RuntimeError(f"POST {url} -> HTTP {exc.code}: {body}") from exc
    return json.loads(body)


def fetch_puzzle_ids(base_url: str, source: str) -> list[str]:
    """Pull puzzle IDs from the server for a given source (ARC1-Eval, ARC2-Eval, etc.)."""
    url = f"{base_url}/api/puzzle/list?source={source}"
    result = http_get(url)
    if not result.get("success"):
        raise RuntimeError(f"Failed to load puzzle list for {source}")
    items = result.get("data", [])
    return [item["id"] for item in items if "id" in item]


def has_existing_explanation(base_url: str, puzzle_id: str, model_key: str) -> bool:
    """Check if the puzzle already has an explanation from this model."""
    try:
        url = f"{base_url}/api/puzzle/{puzzle_id}/explanations"
        result = http_get(url, timeout_sec=10)
        if not result.get("success"):
            return False
        explanations = result.get("data", [])
        # Match on modelName field (how the DB stores it)
        return any(exp.get("modelName") == model_key for exp in explanations)
    except Exception:
        # If we can't check, assume it doesn't exist and proceed
        return False


def analyze_and_save(
    base_url: str,
    puzzle_id: str,
    model_key: str,
    reasoning_effort: str,
    puzzle_timeout_sec: int,
    save_timeout_sec: int,
) -> dict[str, Any]:
    """Run analysis on a single puzzle and save the result to the database."""
    # URL-encode model key (may contain slashes, colons)
    encoded_model = request.quote(model_key, safe="")

    # Step 1: Analyze the puzzle
    analysis_payload = {
        "temperature": 0.2,
        "promptId": "solver",
        "reasoningEffort": reasoning_effort,
        "reasoningVerbosity": "high",
        "reasoningSummaryType": "auto",
        "systemPromptMode": "ARC",
        "omitAnswer": True,
        "retryMode": False,
    }
    analysis_url = f"{base_url}/api/puzzle/analyze/{puzzle_id}/{encoded_model}"
    analysis_result = http_post(analysis_url, analysis_payload, timeout_sec=puzzle_timeout_sec)

    if not analysis_result.get("success"):
        raise RuntimeError(analysis_result.get("message", "Analysis call failed"))

    analysis_data = analysis_result.get("data", {})

    # Step 2: Save to database (same pattern as frontend and TypeScript scripts)
    save_payload = {
        "explanations": {
            model_key: {
                **analysis_data,
                "modelKey": model_key,
            }
        }
    }
    save_url = f"{base_url}/api/puzzle/save-explained/{puzzle_id}"
    save_result = http_post(save_url, save_payload, timeout_sec=save_timeout_sec)

    if not save_result.get("success"):
        raise RuntimeError(save_result.get("error", "Save call failed"))

    return analysis_data


def run_model_on_source(
    base_url: str,
    model_key: str,
    source: str,
    reasoning_effort: str,
    rate_limit_ms: int,
    puzzle_timeout_sec: int,
    save_timeout_sec: int,
    limit: Optional[int],
) -> dict[str, int]:
    """Run the model on all puzzles from one source. Returns stats dict."""
    print(f"\n{'='*60}")
    print(f"Source: {source}  |  Model: {model_key}")
    print(f"{'='*60}")

    puzzle_ids = fetch_puzzle_ids(base_url, source)
    if limit and limit > 0:
        puzzle_ids = puzzle_ids[:limit]
    total = len(puzzle_ids)
    print(f"Loaded {total} puzzle IDs from {source}")

    # Phase 1: Check which puzzles already have explanations (fast, parallel-ish)
    print("Phase 1: Checking for existing explanations...")
    to_analyze: list[str] = []
    skipped = 0
    for pid in puzzle_ids:
        if has_existing_explanation(base_url, pid, model_key):
            skipped += 1
        else:
            to_analyze.append(pid)
    print(f"  Skipping {skipped} (already have explanations), analyzing {len(to_analyze)}")

    # Phase 2: Analyze remaining puzzles with rate limiting
    print(f"Phase 2: Analyzing {len(to_analyze)} puzzles (rate limit: {rate_limit_ms}ms)...")
    success_count = 0
    failure_count = 0
    rate_limit_sec = rate_limit_ms / 1000.0

    for idx, puzzle_id in enumerate(to_analyze):
        start = time.time()
        try:
            print(f"  [{idx+1}/{len(to_analyze)}] Analyzing {puzzle_id}...", end="", flush=True)
            analyze_and_save(
                base_url, puzzle_id, model_key, reasoning_effort,
                puzzle_timeout_sec, save_timeout_sec,
            )
            elapsed = time.time() - start
            print(f" OK ({format_duration(elapsed)})")
            success_count += 1
        except Exception as exc:
            elapsed = time.time() - start
            print(f" FAILED ({format_duration(elapsed)}): {exc}", file=sys.stderr)
            failure_count += 1

        # Rate limit between calls
        if idx < len(to_analyze) - 1:
            time.sleep(rate_limit_sec)

    print(f"\nSource {source} complete: {success_count} analyzed, {skipped} skipped, {failure_count} failed")

    return {
        "total": total,
        "analyzed": success_count,
        "skipped": skipped,
        "failed": failure_count,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate a new OpenRouter model on ARC puzzles via the server API."
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Model slug to test (default: {DEFAULT_MODEL}).",
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        default=DEFAULT_SOURCES,
        help=f"ARC puzzle sources (default: {' '.join(DEFAULT_SOURCES)}).",
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:5000",
        help="API base URL (default: http://localhost:5000).",
    )
    parser.add_argument(
        "--reasoning-effort",
        default="medium",
        choices=["low", "medium", "high"],
        help="Reasoning effort level (default: medium).",
    )
    parser.add_argument(
        "--rate-limit-ms",
        type=int,
        default=DEFAULT_RATE_LIMIT_MS,
        help=f"Delay between analysis calls in ms (default: {DEFAULT_RATE_LIMIT_MS}).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max puzzles per source (default: all). Useful for quick smoke tests.",
    )
    parser.add_argument(
        "--puzzle-timeout-sec",
        type=int,
        default=DEFAULT_PUZZLE_TIMEOUT_SEC,
        help=f"Timeout per puzzle analysis in seconds (default: {DEFAULT_PUZZLE_TIMEOUT_SEC}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print plan without executing any analysis.",
    )
    args = parser.parse_args()

    model_key = args.model

    print("")
    print("=" * 68)
    print("ARC Puzzle Analysis: New Model Evaluation")
    print("=" * 68)
    print(f"Model:       {model_key}")
    print(f"Sources:     {', '.join(args.sources)}")
    print(f"Reasoning:   {args.reasoning_effort}")
    print(f"Rate limit:  {args.rate_limit_ms}ms")
    print(f"Base URL:    {args.base_url}")
    if args.limit:
        print(f"Limit:       {args.limit} puzzles per source")
    print("=" * 68)

    if args.dry_run:
        print("\nDRY RUN - Would analyze puzzles from these sources:")
        for source in args.sources:
            try:
                ids = fetch_puzzle_ids(args.base_url, source)
                effective = ids[:args.limit] if args.limit else ids
                print(f"  {source}: {len(effective)} puzzles (of {len(ids)} total)")
            except Exception as exc:
                print(f"  {source}: ERROR loading - {exc}")
        print("\nNo analysis calls made.")
        return 0

    # Run analysis across all sources
    grand_totals = {"total": 0, "analyzed": 0, "skipped": 0, "failed": 0}

    for source in args.sources:
        try:
            stats = run_model_on_source(
                args.base_url, model_key, source, args.reasoning_effort,
                args.rate_limit_ms, args.puzzle_timeout_sec,
                DEFAULT_SAVE_TIMEOUT_SEC, args.limit,
            )
            for key in grand_totals:
                grand_totals[key] += stats[key]
        except Exception as exc:
            print(f"\nFATAL error on source {source}: {exc}", file=sys.stderr)
            grand_totals["failed"] += 1

    # Final summary
    print("")
    print("=" * 68)
    print(f"{utc_timestamp()} Analysis complete")
    print(f"Model:      {model_key}")
    print(f"Total:      {grand_totals['total']} puzzles across {len(args.sources)} source(s)")
    print(f"Analyzed:   {grand_totals['analyzed']}")
    print(f"Skipped:    {grand_totals['skipped']} (already had explanations)")
    print(f"Failed:     {grand_totals['failed']}")
    print("=" * 68)

    if grand_totals["failed"] > 0:
        print(f"\nTip: Re-run this script to retry the {grand_totals['failed']} failed puzzle(s).")

    return 0 if grand_totals["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
