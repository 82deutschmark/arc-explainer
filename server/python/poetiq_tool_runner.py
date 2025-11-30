#!/usr/bin/env python3
"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-30
 * PURPOSE: Single-shot tool entrypoint for evaluating a candidate Poetiq
 *          transform() function in the ARC-AGI sandbox.
 *          This is designed to be called from Node.js tools (e.g. OpenAI
 *          Agents SDK) and to mirror the existing Poetiq solver evaluation
 *          logic as closely as possible.
 *
 * SRP and DRY check: Pass — exposes existing evaluation helpers from
 * solver/poetiq/solve_coding.py via a simple JSON CLI contract.
"""

import asyncio
import json
import sys
import traceback
from pathlib import Path
from typing import Any, Dict


def emit(obj: Dict[str, Any]) -> None:
    """Emit a single JSON object to stdout and flush immediately."""
    print(json.dumps(obj, default=str), flush=True)


# ------------------------------------------
# Import Poetiq solver internals
# ------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent.parent
SOLVER_PATH = PROJECT_ROOT / "solver"

# Basic preflight to give a clear error if the internalized solver is missing
if not (SOLVER_PATH / "poetiq" / "solve_coding.py").exists():
    emit(
        {
            "success": False,
            "error": f"Poetiq solver not found at {SOLVER_PATH / 'poetiq'}",
            "remediation": "Ensure solver/poetiq/ directory exists and is synced from poetiq-solver.",
        }
    )
    sys.exit(1)

# Add project root so that `import solver.poetiq.*` works
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:  # Import after sys.path adjustment
    from solver.poetiq.solve_coding import _eval_on_train_and_test, _build_feedback  # type: ignore
except Exception as import_error:  # pragma: no cover - defensive
    emit(
        {
            "success": False,
            "error": f"Failed to import Poetiq modules: {import_error}",
            "traceback": traceback.format_exc(),
        }
    )
    sys.exit(1)


async def eval_candidate(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate a single candidate transform() implementation.

    Expected payload shape (from stdin JSON):
      {
        "mode": "eval_candidate",
        "puzzleId": "...",
        "task": { "train": [...], "test": [...] },
        "code": "def transform(...): ...",
        "iteration": 1,
        "timeout_s": 1.5
      }

    Returns a JSON-serializable dict with:
      - success: bool
      - puzzleId: str
      - iteration: int
      - trainResults: list[RunResult-like dict]
      - testResults: list[RunResult-like dict]
      - trainScore: float (0–1)
      - feedback: str (same structure as core Poetiq feedback)
      - timeout_s: float
    """
    puzzle_id = payload.get("puzzleId", "unknown")
    task = payload.get("task") or {}
    code = payload.get("code")
    iteration_raw = payload.get("iteration", 0)
    timeout_s = float(payload.get("timeout_s", 1.5))

    try:
        iteration = int(iteration_raw)
    except Exception:
        iteration = 0

    if not isinstance(code, str) or not code.strip():
        return {
            "success": False,
            "puzzleId": puzzle_id,
            "iteration": iteration,
            "error": "Missing or empty 'code' field for eval_candidate.",
        }

    train = task.get("train") or []
    test = task.get("test") or []

    # Extract raw grids in the same way as poetiq_wrapper.run_poetiq_solver
    try:
        train_in = [ex["input"] for ex in train if "input" in ex and "output" in ex]
        train_out = [ex["output"] for ex in train if "input" in ex and "output" in ex]
        test_in = [ex["input"] for ex in test if "input" in ex]
    except Exception as e:  # pragma: no cover - defensive
        return {
            "success": False,
            "puzzleId": puzzle_id,
            "iteration": iteration,
            "error": f"Invalid task format: {e}",
        }

    try:
        train_results, test_results = await _eval_on_train_and_test(
            code,
            train_in,
            train_out,
            test_in,
            timeout_s=timeout_s,
        )
    except Exception as e:
        return {
            "success": False,
            "puzzleId": puzzle_id,
            "iteration": iteration,
            "error": f"Sandbox evaluation failed: {e}",
            "traceback": traceback.format_exc(),
        }

    # Build feedback + aggregate score using the exact same helper as the core solver
    try:
        feedback, train_score = _build_feedback(train_results, train_in, train_out)
    except Exception as e:  # pragma: no cover - defensive
        feedback = f"Failed to build feedback: {e}"
        train_score = 0.0

    return {
        "success": True,
        "puzzleId": puzzle_id,
        "iteration": iteration,
        "timeout_s": timeout_s,
        "trainResults": train_results,
        "testResults": test_results,
        "trainScore": float(train_score),
        "feedback": feedback,
    }


async def main() -> None:
    """Main entrypoint: read one JSON payload from stdin and emit one JSON result."""
    try:
        raw_input = sys.stdin.read()
        if not raw_input or not raw_input.strip():
            emit(
                {
                    "success": False,
                    "error": "No input provided on stdin.",
                }
            )
            sys.exit(1)

        try:
            payload = json.loads(raw_input)
        except json.JSONDecodeError as e:
            emit(
                {
                    "success": False,
                    "error": f"Invalid JSON input: {e}",
                }
            )
            sys.exit(1)

        mode = payload.get("mode", "eval_candidate")

        if mode == "eval_candidate":
            result = await eval_candidate(payload)
            emit(result)
            return

        emit(
            {
                "success": False,
                "error": f"Unsupported mode: {mode}",
            }
        )
        sys.exit(1)

    except Exception as e:  # pragma: no cover - top-level guard
        emit(
            {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
            }
        )
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
