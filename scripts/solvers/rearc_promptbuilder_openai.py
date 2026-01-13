#!/usr/bin/env python3
"""
Author: Cascade (ChatGPT)
Date: 2026-01-09
PURPOSE: Python RE-ARC solver that mirrors promptBuilder.ts semantics, calls
         OpenAI Responses API (GPT-5-nano, high reasoning), chains attempts per
         task, and streams submission writes to uniquely named files.
SRP/DRY check: Pass — isolated solver orchestrator, prompt builder parity, and
         persistence utilities.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package is not installed. Run `pip install openai`.", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    def load_dotenv() -> None:
        return None


load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = PROJECT_ROOT / "2026RealRearc.json"
MODEL = os.getenv("REARC_MODEL", "gpt-5-nano")
REASONING_EFFORT = os.getenv("REARC_REASONING_EFFORT", "high")
MAX_OUTPUT_TOKENS = os.getenv("REARC_MAX_OUTPUT_TOKENS")
DEFAULT_LAUNCH_DELAY = int(os.getenv("REARC_LAUNCH_DELAY_MS", "0"))
MAX_GRID_SIZE = 30
SUBMISSION_DIR = PROJECT_ROOT

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def sanitize_model_name(model: str) -> str:
    return model.lower().replace("/", "-").replace(":", "-").replace(".", "-")


def default_submission_path() -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    name = f"submission-{sanitize_model_name(MODEL)}-{timestamp}.json"
    return SUBMISSION_DIR / name


def atomic_write_json(path: Path, data: Any) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
    tmp_path.replace(path)


def load_json_if_exists(path: Path) -> Optional[Any]:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def ensure_submission_structure(dataset: Dict[str, Any], submission: Dict[str, Any]) -> Dict[str, Any]:
    for task_id, task in dataset.items():
        tests = task.get("test", [])
        if task_id not in submission:
            submission[task_id] = [{"attempt_1": None, "attempt_2": None} for _ in tests]
        elif len(submission[task_id]) != len(tests):
            submission[task_id] = submission[task_id][: len(tests)]
            while len(submission[task_id]) < len(tests):
                submission[task_id].append({"attempt_1": None, "attempt_2": None})
    return submission


def build_system_prompt(test_count: int) -> str:
    base = (
        "You are an expert ARC (Abstraction and Reasoning Corpus) puzzle analyst. "
        "Identify the transformation that maps each training input grid to its output grid, "
        "then apply the transformation to ALL provided test grids.\n\n"
        "Rules:\n"
        "- Reply ONLY with valid JSON matching the schema provided.\n"
        "- Every grid cell must be an integer 0-9.\n"
        "- Preserve grid dimensions exactly; do not invent new colors.\n"
    )
    schema = (
        f"You must respond with an object {{\"grids\": [...]}} where `grids` contains exactly {test_count} arrays, "
        "one per test case, in the same order as presented.\n"
    )
    return base + schema


def format_grid(grid: List[List[int]]) -> str:
    return json.dumps(grid)


def build_user_prompt(task: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("TRAINING EXAMPLES:")
    for idx, pair in enumerate(task.get("train", []), start=1):
        lines.append(f"Example {idx}:")
        lines.append(f"Input: {format_grid(pair['input'])}")
        lines.append(f"Output: {format_grid(pair['output'])}")
        lines.append("")
    lines.append("TEST INPUTS (predict the outputs in order):")
    for idx, case in enumerate(task.get("test", []), start=1):
        lines.append(f"Test {idx}: {format_grid(case['input'])}")
    lines.append("")
    lines.append("Return ONLY the JSON object with `grids` containing the predicted outputs.")
    return "\n".join(lines)


def build_attempt_two_prompt(task: Dict[str, Any], attempt_one_grids: List[List[List[int]]]) -> str:
    prompt = []
    prompt.append("ATTEMPT 2 – Provide an alternative interpretation.")
    prompt.append(
        "You are still solving the SAME ARC puzzle. Re-examine the training examples and produce different outputs."
    )
    prompt.append("")
    prompt.append("Your first attempt returned:")
    for idx, grid in enumerate(attempt_one_grids, start=1):
        prompt.append(f"Test {idx}: {format_grid(grid)}")
    prompt.append("")
    prompt.append("Re-run your reasoning, describe a different valid transformation, and output new grids.")
    prompt.append(build_user_prompt(task))
    return "\n".join(prompt)


def extract_text_from_response(response: Any) -> str:
    output = getattr(response, "output", None)
    if output:
        for block in output:
            content = getattr(block, "content", None)
            if not content:
                continue
            for piece in content:
                text = getattr(piece, "text", None)
                if text:
                    return text
    # fallback to output_text or raw dump
    raw = getattr(response, "output_text", None)
    if isinstance(raw, list):
        return "\n".join(str(item) for item in raw)
    if isinstance(raw, str):
        return raw
    return json.dumps(response)


def solve_attempt(
    task_id: str,
    task: Dict[str, Any],
    attempt_num: int,
    conversation_id: Optional[str],
    attempt_one_grids: Optional[List[List[List[int]]]],
    max_output_tokens: Optional[int],
) -> Tuple[List[List[List[int]]], Optional[str]]:
    test_count = len(task.get("test", [])) or 1
    system_prompt = build_system_prompt(test_count)
    user_prompt = (
        build_user_prompt(task) if attempt_num == 1 else build_attempt_two_prompt(task, attempt_one_grids or [])
    )
    request = {
        "model": MODEL,
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "reasoning": {"effort": REASONING_EFFORT},
    }

    if conversation_id:
        request["conversation"] = conversation_id
    if max_output_tokens:
        request["max_output_tokens"] = max_output_tokens

    response = client.responses.create(**request)
    conversation = getattr(response, "conversation_id", None)

    text_payload = extract_text_from_response(response)
    parsed = json.loads(text_payload)
    grids = parsed.get("grids")

    if not isinstance(grids, list) or len(grids) != test_count:
        raise ValueError(f"[{task_id}] Invalid grid payload: {text_payload}")

    for grid in grids:
        if not isinstance(grid, list):
            raise ValueError(f"[{task_id}] Grid entry malformed: {grid}")

    return grids, conversation


@dataclass
class TaskProgress:
    attempt1_conversation: Optional[str] = None
    attempt1_done: bool = False
    attempt2_done: bool = False


@dataclass
class SolverState:
    submission_path: Path
    metadata_path: Path
    submission: Dict[str, Any] = field(default_factory=dict)
    progress: Dict[str, TaskProgress] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


def load_state(dataset: Dict[str, Any], submission_path: Path, fresh: bool) -> SolverState:
    metadata_path = submission_path.with_suffix(submission_path.suffix + ".meta.json")
    submission = {} if fresh else load_json_if_exists(submission_path) or {}
    submission = ensure_submission_structure(dataset, submission)

    raw_progress = {} if fresh else load_json_if_exists(metadata_path) or {}
    progress: Dict[str, TaskProgress] = {}
    for task_id, payload in raw_progress.items():
        progress[task_id] = TaskProgress(
            attempt1_conversation=payload.get("attempt1_conversation"),
            attempt1_done=payload.get("attempt1_done", False),
            attempt2_done=payload.get("attempt2_done", False),
        )

    return SolverState(
        submission_path=submission_path,
        metadata_path=metadata_path,
        submission=submission,
        progress=progress,
    )


def write_state(state: SolverState) -> None:
    atomic_write_json(state.submission_path, state.submission)
    raw_progress = {
        task_id: {
            "attempt1_conversation": tp.attempt1_conversation,
            "attempt1_done": tp.attempt1_done,
            "attempt2_done": tp.attempt2_done,
        }
        for task_id, tp in state.progress.items()
    }
    atomic_write_json(state.metadata_path, raw_progress)


async def run_solver(
    dataset: Dict[str, Any],
    state: SolverState,
    max_output_tokens: Optional[int],
    concurrency: int,
) -> None:
    task_ids = sorted(dataset.keys())
    total_tasks = len(task_ids)
    semaphore = asyncio.Semaphore(max(1, concurrency))
    loop = asyncio.get_running_loop()
    launch_delay = max(0.0, DEFAULT_LAUNCH_DELAY / 1000.0)

    async def invoke_attempt(
        task_id: str,
        attempt_num: int,
        task: Dict[str, Any],
        conversation_id: Optional[str],
        attempt1_grids: Optional[List[List[List[int]]]],
    ) -> Tuple[List[List[List[int]]], Optional[str]]:
        async with semaphore:
            if launch_delay:
                await asyncio.sleep(launch_delay)
            return await loop.run_in_executor(
                None,
                solve_attempt,
                task_id,
                task,
                attempt_num,
                conversation_id,
                attempt1_grids,
                max_output_tokens,
            )

    async def process_task(index: int, task_id: str) -> None:
        task = dataset[task_id]
        progress = state.progress.setdefault(task_id, TaskProgress())
        records = state.submission[task_id]

        if not progress.attempt1_done:
            print(f"[{index}/{total_tasks}] Attempt 1 ⇒ {task_id}")
            try:
                grids, conversation = await invoke_attempt(task_id, 1, task, None, None)
                async with state.lock:
                    for test_idx, grid in enumerate(grids):
                        records[test_idx]["attempt_1"] = grid
                    progress.attempt1_conversation = conversation
                    progress.attempt1_done = True
                    write_state(state)
            except Exception as err:
                print(f"  [ERROR] Attempt 1 failed for {task_id}: {err}")
                return

        if progress.attempt1_done and not progress.attempt2_done:
            attempt1_grids = [entry["attempt_1"] or [[0]] for entry in records]
            print(f"[{index}/{total_tasks}] Attempt 2 ⇒ {task_id}")
            try:
                grids, _ = await invoke_attempt(
                    task_id,
                    2,
                    task,
                    progress.attempt1_conversation,
                    attempt1_grids,
                )
                async with state.lock:
                    for test_idx, grid in enumerate(grids):
                        records[test_idx]["attempt_2"] = grid
                    progress.attempt2_done = True
                    write_state(state)
            except Exception as err:
                print(f"  [ERROR] Attempt 2 failed for {task_id}: {err}")
                return

    await asyncio.gather(
        *(process_task(index, task_id) for index, task_id in enumerate(task_ids, start=1))
    )

    print("\nRun complete.")
    print(f"Submission written to: {state.submission_path}")
    print(f"Metadata written to: {state.metadata_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Python-based RE-ARC solver using OpenAI Responses API.")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="Path to the RE-ARC dataset JSON.")
    parser.add_argument("--output", default=None, help="Optional submission output path.")
    parser.add_argument("--fresh", action="store_true", help="Ignore any existing submission file and start fresh.")
    parser.add_argument("--resume", action="store_true", help="Require the output file to exist and resume from it.")
    parser.add_argument("--max-output-tokens", type=int, default=int(MAX_OUTPUT_TOKENS) if MAX_OUTPUT_TOKENS else None)
    parser.add_argument("--concurrency", type=int, default=1, help="Number of tasks to process concurrently (default: 1).")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        print(f"Dataset not found: {dataset_path}", file=sys.stderr)
        sys.exit(1)

    submission_path = Path(args.output) if args.output else default_submission_path()
    if args.resume and not submission_path.exists():
        print(f"--resume specified but file not found: {submission_path}", file=sys.stderr)
        sys.exit(1)

    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    state = load_state(dataset, submission_path, fresh=args.fresh and not args.resume)

    print("=" * 72)
    print("PYTHON RE-ARC PROMPT BUILDER SOLVER")
    print("=" * 72)
    print(f"Dataset: {dataset_path}")
    print(f"Submission output: {submission_path}")
    print(f"Model: {MODEL}")
    print(f"Reasoning effort: {REASONING_EFFORT}")
    if args.max_output_tokens:
        print(f"Max output tokens: {args.max_output_tokens}")
    print("=" * 72)

    asyncio.run(run_solver(dataset, state, args.max_output_tokens, args.concurrency))


if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)
    main()
