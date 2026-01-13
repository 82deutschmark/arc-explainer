#!/usr/bin/env python3
"""
Author: Cascade (ChatGPT)
Date: 2026-01-09
PURPOSE: RE-ARC solver (OpenRouter) that writes each run to a dated, model-tagged submission JSON while streaming results.
- Fires off API calls in parallel (not sequential per-task)
- Writes results to a timestamped submission file immediately as they arrive
- Uses threading for true parallelism with blocking API calls
SRP/DRY check: Pass — output-path generation is centralized and reused across load/save helpers.

Usage:
    python scripts/solvers/rearc_free_solver.py [--dataset PATH] [--output PATH] [--fresh]

Environment:
    OPENROUTER_API_KEY - Required
    REARC_MODEL - Model (default: xiaomi/mimo-v2-flash:free)
    REARC_REASONING_EFFORT - Reasoning: high|medium|low|none (default: medium)
    REARC_LAUNCH_DELAY_MS - Delay between launches (default: 10000)
    REARC_MAX_CONCURRENT - Max concurrent threads (default: 4)
"""

import argparse
import json
import os
import sys
import threading
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not installed. Install with: pip install openai")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = lambda: None

# Load environment
load_dotenv()

# Configuration
MODEL_KEY = os.getenv("REARC_MODEL", "xiaomi/mimo-v2-flash:free")
REASONING_EFFORT = os.getenv("REARC_REASONING_EFFORT", "medium")
LAUNCH_DELAY_MS = int(os.getenv("REARC_LAUNCH_DELAY_MS", "10000"))
MAX_CONCURRENT = int(os.getenv("REARC_MAX_CONCURRENT", "4"))
API_KEY = os.getenv("OPENROUTER_API_KEY")

if not API_KEY:
    print("Error: OPENROUTER_API_KEY not set")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent.parent
DEFAULT_SUBMISSION_DIR = PROJECT_ROOT

# Thread-safe lock for submission writes
submission_lock = threading.Lock()

# Initialize OpenRouter client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY,
    default_headers={
        "HTTP-Referer": "https://arc.markbarney.net",
        "X-Title": "ARC Explainer RE-ARC Solver",
    },
    timeout=35 * 60  # 35 minutes for reasoning
)


def sanitize_model_name(model: str) -> str:
    """Create filesystem-safe version of the provider model name."""
    sanitized = model.lower().replace("/", "-").replace(":", "-").replace(".", "-")
    return re.sub(r"[^a-z0-9\-]+", "-", sanitized).strip("-")


def default_submission_path() -> Path:
    """Generate timestamped submission path based on model name."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    filename = f"submission-{sanitize_model_name(MODEL_KEY)}-{timestamp}.json"
    return DEFAULT_SUBMISSION_DIR / filename


def load_dataset(path: str) -> dict:
    """Load dataset JSON."""
    with open(path, "r") as f:
        return json.load(f)


def load_submission(path: Path) -> dict:
    """Load existing submission JSON or return empty dict."""
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return {}


def save_submission_threadsafe(path: Path, submission: dict) -> None:
    """Save submission JSON to disk (thread-safe)."""
    with submission_lock:
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with open(tmp_path, "w") as f:
            json.dump(submission, f, indent=2)
        tmp_path.replace(path)


def grid_to_string(grid: list) -> str:
    """Convert grid to readable format."""
    return "\n".join(" ".join(str(cell) for cell in row) for row in grid)


def build_prompt(task: dict, test_index: int) -> str:
    """Build prompt for solving a test case."""
    lines = [
        "You are solving an ARC (Abstraction and Reasoning Corpus) puzzle.",
        "",
        "## Training Examples",
        ""
    ]

    for i, pair in enumerate(task["train"]):
        lines.append(f"### Example {i + 1}")
        lines.append("Input:")
        lines.append(grid_to_string(pair["input"]))
        lines.append("")
        lines.append("Output:")
        lines.append(grid_to_string(pair["output"]))
        lines.append("")

    lines.extend([
        "## Test Input",
        grid_to_string(task["test"][test_index]["input"]),
        "",
        "## Your Output",
        "Respond with ONLY the output grid as a JSON array of arrays.",
        "Example: [[1, 2, 3], [4, 5, 6]]",
        "No explanation, no markdown, just the JSON array."
    ])

    return "\n".join(lines)


def parse_grid_from_response(text: str) -> Optional[list]:
    """Extract grid from response text."""
    # Try JSON array extraction
    matches = re.finditer(r'\[\s*\[[\s\S]*?\]\s*\]', text)
    for match in matches:
        try:
            parsed = json.loads(match.group(0))
            if is_valid_grid(parsed):
                return parsed
        except (json.JSONDecodeError, ValueError):
            continue

    return None


def is_valid_grid(grid: Any) -> bool:
    """Validate grid structure."""
    if not isinstance(grid, list) or len(grid) == 0:
        return False

    for row in grid:
        if not isinstance(row, list) or len(row) == 0:
            return False
        for cell in row:
            if not isinstance(cell, int) or cell < 0 or cell > 9:
                return False

    return True


def solve_attempt(
    task_id: str,
    task: dict,
    test_index: int,
    attempt_num: int,
) -> Optional[list]:
    """
    Solve a single test case attempt.
    Returns grid or None if failed.
    """
    prompt = build_prompt(task, test_index)

    try:
        print(f"  [{task_id}] test {test_index + 1}/{len(task['test'])}, attempt {attempt_num}...", flush=True)

        request_params = {
            "model": MODEL_KEY,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0 if attempt_num == 1 else 0.3,
        }

        if REASONING_EFFORT != "none":
            request_params["reasoning"] = {"effort": REASONING_EFFORT}

        response = client.chat.completions.create(**request_params)

        message = response.choices[0].message
        content = getattr(message, "content", "") or ""
        reasoning = getattr(message, "reasoning", None)

        if reasoning:
            print(f"    [reasoning] {reasoning[:100].replace(chr(10), ' ')}...", flush=True)

        grid = parse_grid_from_response(content)

        if not grid:
            print(f"  [FAIL parse] {task_id} test {test_index + 1} attempt {attempt_num}: Failed to parse grid", flush=True)
            return None

        return grid

    except Exception as err:
        print(f"  [FAIL api] {task_id} test {test_index + 1} attempt {attempt_num}: {str(err)[:160]}", flush=True)
        return None


def run_phase(
    dataset: dict,
    submission: dict,
    attempt_num: int,
    submission_path: Path,
) -> None:
    """
    Run one phase (attempt 1 or 2).
    Dispatch all API calls with delays, then wait for results.
    """
    phase_name = f"Attempt {attempt_num}"
    print("\n" + "=" * 72)
    print(f"PHASE: {phase_name}")
    print("=" * 72)
    print()

    # Build work queue
    work_queue = []
    for task_id in sorted(dataset.keys()):
        task = dataset[task_id]
        for test_index in range(len(task["test"])):
            work_queue.append((task_id, test_index, task))

    print(f"Dispatching {len(work_queue)} API calls with {LAUNCH_DELAY_MS}ms delay...")
    print()

    # Dispatch all calls to thread pool
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        futures = {}

        for task_id, test_index, task in work_queue:
            future = executor.submit(solve_attempt, task_id, task, test_index, attempt_num)
            futures[future] = (task_id, test_index)

            # Delay between dispatches
            time.sleep(LAUNCH_DELAY_MS / 1000.0)

        print(f"All {len(futures)} calls dispatched. Waiting for responses...")
        print()

        # Process results as they complete
        completed = 0
        for future in as_completed(futures):
            task_id, test_index = futures[future]

            try:
                grid = future.result()

                # Initialize entry if needed
                if task_id not in submission:
                    submission[task_id] = [
                        {"attempt_1": None, "attempt_2": None}
                        for _ in range(len(dataset[task_id]["test"]))
                    ]

                # Store result
                key = f"attempt_{attempt_num}"
                submission[task_id][test_index][key] = grid or [[0]]

                # Save immediately
                save_submission_threadsafe(submission_path, submission)

                completed += 1
                if grid:
                    print(f"  [SUCCESS {completed}/{len(futures)}] {task_id} test {test_index + 1}", flush=True)
                else:
                    print(f"  [FILLED {completed}/{len(futures)}] {task_id} test {test_index + 1} (placeholder)", flush=True)

            except Exception as err:
                print(f"  [ERROR] {task_id} test {test_index + 1}: {err}", flush=True)
                completed += 1

    print()
    print("=" * 72)
    print(f"{phase_name} COMPLETE - {completed} entries processed")
    print("=" * 72)


def print_summary(dataset: dict, submission: dict, submission_path: Path) -> None:
    """Print summary of results."""
    total_tests = sum(len(task["test"]) for task in dataset.values())
    completed = sum(
        1 for task_entry in submission.values()
        for entry in task_entry
        if entry.get("attempt_1") and entry.get("attempt_2")
    )

    print("\n" + "=" * 72)
    print("RE-ARC Free Solver - SUMMARY")
    print("=" * 72)
    print(f"Dataset: {len(dataset)} tasks, {total_tests} total test cases")
    print(f"Model: {MODEL_KEY}")
    print(f"Reasoning: {REASONING_EFFORT}")
    print(f"Submission: {submission_path}")
    print(f"Completed: {completed}/{total_tests} test cases with both attempts")
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(description="RE-ARC Solver")
    parser.add_argument("--dataset", default="2026RealRearc.json", help="Dataset JSON path")
    parser.add_argument("--output", help="Submission JSON path (defaults to timestamped name with model)")
    parser.add_argument("--fresh", action="store_true", help="Start fresh (ignore existing submission file)")
    args = parser.parse_args()

    dataset_path = PROJECT_ROOT / args.dataset
    submission_path = Path(args.output) if args.output else default_submission_path()

    if not dataset_path.exists():
        print(f"Error: Dataset not found: {dataset_path}")
        sys.exit(1)
    submission_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 72)
    print("RE-ARC FREE SOLVER")
    print("=" * 72)
    print(f"Dataset: {dataset_path}")
    print(f"Submission: {submission_path}")
    print(f"Model: {MODEL_KEY}")
    print(f"Reasoning: {REASONING_EFFORT}")
    print(f"Max concurrent: {MAX_CONCURRENT}, Launch delay: {LAUNCH_DELAY_MS}ms")
    print("=" * 72)
    print()

    # Load dataset
    dataset = load_dataset(str(dataset_path))
    print(f"Loaded: {len(dataset)} tasks")
    print()

    # Load or create submission
    if args.fresh or not submission_path.exists():
        submission = {}
        print("Starting fresh submission")
    else:
        submission = load_submission(submission_path)
        total_entries = sum(len(entries) for entries in submission.values())
        print(f"Resuming with {len(submission)} tasks, {total_entries} entries")

    print()

    # Phase 1: Attempt 1
    run_phase(dataset, submission, 1, submission_path)

    # Phase 2: Attempt 2
    run_phase(dataset, submission, 2, submission_path)

    # Summary
    print_summary(dataset, submission, submission_path)


if __name__ == "__main__":
    main()
