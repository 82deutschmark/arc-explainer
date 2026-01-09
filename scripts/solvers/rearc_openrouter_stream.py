#!/usr/bin/env python3
"""
Author: Cascade (ChatGPT)
Date: 2026-01-09
PURPOSE: Python-based RE-ARC solver that calls OpenRouter models with explicit
         completion budgets and writes submission.json incrementally as each
         attempt finishes. Supports resumable runs, configurable throttling,
         and structured JSONL logs for external monitoring.
SRP/DRY check: Pass — solver logic, OpenRouter calls, and disk writing are
               encapsulated within this module without duplicating other flows.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
  from dotenv import load_dotenv
except ImportError:
  load_dotenv = lambda: None  # type: ignore

try:
  from openai import OpenAI
except ImportError as exc:  # pragma: no cover - guidance for users
  print("Error: openai package not installed. Install it via `pip install openai`.")
  raise SystemExit(1) from exc

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = PROJECT_ROOT / "2026RealRearc.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "rearc-submission-live.json"
DEFAULT_LOG = PROJECT_ROOT / "rearc-submission-live.jsonl"

MODEL_KEY = os.getenv("REARC_MODEL", "xiaomi/mimo-v2-flash:free")
REASONING_EFFORT = os.getenv("REARC_REASONING_EFFORT", "medium")
MAX_CONCURRENT = int(os.getenv("REARC_MAX_CONCURRENT", "4"))
LAUNCH_DELAY_MS = int(os.getenv("REARC_LAUNCH_DELAY_MS", "5000"))
PROVIDER_LIMIT = 65536
REQUESTED_MAX_OUTPUT = int(os.getenv("REARC_MAX_OUTPUT_TOKENS", "60000"))
RESERVED_COMPLETION = int(os.getenv("REARC_COMPLETION_RESERVE", "512"))
MAX_OUTPUT_TOKENS = max(2048, min(PROVIDER_LIMIT, REQUESTED_MAX_OUTPUT))

API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
  print("Error: OPENROUTER_API_KEY not set in environment.")
  sys.exit(1)

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=API_KEY,
  default_headers={
    "HTTP-Referer": "https://arc.markbarney.net",
    "X-Title": "ARC Explainer RE-ARC Solver",
  },
  timeout=35 * 60,
)

GRID_PATTERN = re.compile(r"\[\s*\[[\s\S]*?\]\s*\]")


@dataclass
class WorkItem:
  task_id: str
  test_index: int
  attempt_num: int


@dataclass
class AttemptResult:
  grid: Optional[List[List[int]]]
  success: bool
  finish_reason: Optional[str]
  error: Optional[str]
  prompt_tokens: Optional[int]
  completion_tokens: Optional[int]
  reasoning_tokens: Optional[int]
  content_sample: str


class LiveSubmissionWriter:
  """Persist submission snapshots + append-only JSONL telemetry."""

  def __init__(self, snapshot_path: Path, log_path: Path, dataset: Dict[str, Any], fresh: bool):
    self.snapshot_path = snapshot_path
    self.log_path = log_path
    self.dataset = dataset
    self._lock = asyncio.Lock()
    if fresh or not snapshot_path.exists():
      self.state = self._build_empty_state()
      self._write_snapshot()
      if log_path.exists():
        log_path.unlink()
    else:
      self.state = self._load_existing(snapshot_path)

  def _build_empty_state(self) -> Dict[str, List[Dict[str, Optional[List[List[int]]]]]]:
    state: Dict[str, List[Dict[str, Optional[List[List[int]]]]]] = {}
    for task_id, task in self.dataset.items():
      state[task_id] = [{"attempt_1": None, "attempt_2": None} for _ in range(len(task["test"]))]
    return state

  def _load_existing(self, path: Path):
    with open(path, "r", encoding="utf-8") as fh:
      return json.load(fh)

  async def record(
    self,
    *,
    task_id: str,
    test_index: int,
    attempt_num: int,
    grid: Optional[List[List[int]]],
    metadata: Dict[str, Any],
  ):
    async with self._lock:
      if task_id not in self.state:
        self.state[task_id] = [{"attempt_1": None, "attempt_2": None} for _ in range(len(self.dataset[task_id]["test"]))]
      entry = self.state[task_id][test_index]
      entry_key = f"attempt_{attempt_num}"
      entry[entry_key] = grid if grid else [[0]]
      self._write_snapshot()
      self._append_log_line(metadata)

  def _append_log_line(self, metadata: Dict[str, Any]):
    line = {
      **metadata,
      "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    with open(self.log_path, "a", encoding="utf-8") as fh:
      fh.write(json.dumps(line) + "\n")

  def _write_snapshot(self):
    serialized = json.dumps(self.state, indent=2)
    tmp_path = self.snapshot_path.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as fh:
      fh.write(serialized)
    tmp_path.replace(self.snapshot_path)

  def summary(self) -> Dict[str, Any]:
    total = 0
    completed = 0
    for task_entries in self.state.values():
      for entry in task_entries:
        total += 1
        if entry.get("attempt_1") and entry.get("attempt_2"):
          completed += 1
    return {"total_cases": total, "completed_cases": completed}


def grid_to_string(grid: List[List[int]]) -> str:
  return "\n".join(" ".join(str(cell) for cell in row) for row in grid)


def build_prompt(task: Dict[str, Any], test_index: int, attempt_num: int) -> str:
  lines: List[str] = []
  lines.append("You are solving an ARC (Abstraction and Reasoning Corpus) test case.")
  lines.append("Study the training pairs and output ONLY the solved grid for the test input.")
  lines.append("")
  lines.append("## Training Examples")
  lines.append("")
  for idx, pair in enumerate(task["train"], start=1):
    lines.append(f"### Example {idx}")
    lines.append("Input:")
    lines.append(grid_to_string(pair["input"]))
    lines.append("Output:")
    lines.append(grid_to_string(pair["output"]))
    lines.append("")
  lines.append("## Test Input")
  lines.append(grid_to_string(task["test"][test_index]["input"]))
  lines.append("")
  if attempt_num == 1:
    lines.append("Respond with the JSON grid. No narration, no markdown, only the array literal.")
  else:
    lines.append(
      "Produce an alternative JSON grid without repeating attempt 1 verbatim. Again, respond with just the array literal."
    )
  return "\n".join(lines)


def normalize_content(content: Any) -> str:
  if isinstance(content, str):
    return content
  if isinstance(content, list):
    collected: List[str] = []
    for chunk in content:
      if isinstance(chunk, str):
        collected.append(chunk)
      elif isinstance(chunk, dict) and "text" in chunk:
        collected.append(str(chunk["text"]))
    return "\n".join(collected)
  if isinstance(content, dict) and "text" in content:
    return str(content["text"])
  return "" if content is None else str(content)


def parse_grid_from_response(text: str) -> Optional[List[List[int]]]:
  for match in GRID_PATTERN.finditer(text):
    try:
      candidate = json.loads(match.group(0))
      if (
        isinstance(candidate, list)
        and candidate
        and all(isinstance(row, list) and row and all(isinstance(cell, int) and 0 <= cell <= 9 for cell in row)
                for row in candidate)
      ):
        return candidate
    except json.JSONDecodeError:
      continue
  return None


def solve_attempt_sync(task: Dict[str, Any], item: WorkItem) -> AttemptResult:
  prompt = build_prompt(task, item.test_index, item.attempt_num)
  request = {
    "model": MODEL_KEY,
    "messages": [
      {
        "role": "system",
        "content": "You solve ARC puzzles. Respond only with the output grid as JSON. Do not add explanations.",
      },
      {"role": "user", "content": prompt},
    ],
    "temperature": 0.0 if item.attempt_num == 1 else 0.35,
    "max_output_tokens": MAX_OUTPUT_TOKENS,
  }
  if REASONING_EFFORT != "none":
    request["reasoning"] = {"effort": REASONING_EFFORT, "exclude": True}

  try:
    response = client.chat.completions.create(**request)
    choice = response.choices[0]
    message = choice.message
    content = normalize_content(getattr(message, "content", ""))
    grid = parse_grid_from_response(content)
    usage = response.usage
    return AttemptResult(
      grid=grid,
      success=grid is not None,
      finish_reason=getattr(choice, "finish_reason", None),
      error=None if grid else "Failed to parse grid from response.",
      prompt_tokens=getattr(usage, "prompt_tokens", None),
      completion_tokens=getattr(usage, "completion_tokens", None),
      reasoning_tokens=len(getattr(message, "reasoning", "") or ""),
      content_sample=content[:400],
    )
  except Exception as exc:  # pragma: no cover - network failures
    return AttemptResult(
      grid=None,
      success=False,
      finish_reason=None,
      error=str(exc),
      prompt_tokens=None,
      completion_tokens=None,
      reasoning_tokens=None,
      content_sample="",
    )


async def process_item(
  item: WorkItem,
  dataset: Dict[str, Any],
  writer: LiveSubmissionWriter,
  stats: Dict[str, int],
  throttle_delay: float,
  semaphore: asyncio.Semaphore,
):
  async with semaphore:
    await asyncio.sleep(throttle_delay)
    task = dataset[item.task_id]
    loop = asyncio.get_running_loop()
    result: AttemptResult = await loop.run_in_executor(None, solve_attempt_sync, task, item)
    metadata = {
      "task_id": item.task_id,
      "test_index": item.test_index,
      "attempt": item.attempt_num,
      "success": result.success,
      "finish_reason": result.finish_reason,
      "error": result.error,
      "prompt_tokens": result.prompt_tokens,
      "completion_tokens": result.completion_tokens,
      "reasoning_tokens": result.reasoning_tokens,
    }
    await writer.record(
      task_id=item.task_id,
      test_index=item.test_index,
      attempt_num=item.attempt_num,
      grid=result.grid,
      metadata=metadata,
    )
    if result.success:
      stats["success"] += 1
    else:
      stats["failure"] += 1
    if result.finish_reason == "length":
      stats["length_stops"] += 1


def build_work_queue(dataset: Dict[str, Any]) -> List[WorkItem]:
  queue: List[WorkItem] = []
  for task_id in sorted(dataset.keys()):
    task = dataset[task_id]
    for test_index in range(len(task["test"])):
      queue.append(WorkItem(task_id, test_index, 1))
      queue.append(WorkItem(task_id, test_index, 2))
  return queue


async def run_solver(args):
  dataset_path = Path(args.dataset)
  if not dataset_path.exists():
    raise SystemExit(f"Dataset not found: {dataset_path}")
  with open(dataset_path, "r", encoding="utf-8") as fh:
    dataset = json.load(fh)

  writer = LiveSubmissionWriter(Path(args.output), Path(args.log), dataset, fresh=args.fresh)
  queue = build_work_queue(dataset)
  semaphore = asyncio.Semaphore(MAX_CONCURRENT)
  stats = {"success": 0, "failure": 0, "length_stops": 0}
  print("=" * 72)
  print("OpenRouter Streaming Solver")
  print("=" * 72)
  print(f"Dataset: {dataset_path}")
  print(f"Submission snapshot: {args.output}")
  print(f"JSONL log: {args.log}")
  print(f"Model: {MODEL_KEY}")
  print(f"Reasoning: {REASONING_EFFORT}")
  print(f"Max output tokens: {MAX_OUTPUT_TOKENS} (provider cap {PROVIDER_LIMIT})")
  print(f"Concurrency: {MAX_CONCURRENT}, Launch delay: {LAUNCH_DELAY_MS} ms")
  print(f"Total attempts scheduled: {len(queue)}")
  print("=" * 72)

  tasks = []
  throttle_seconds = max(0.0, LAUNCH_DELAY_MS / 1000.0)
  for idx, item in enumerate(queue):
    task = asyncio.create_task(process_item(item, dataset, writer, stats, throttle_seconds, semaphore))
    tasks.append(task)
    await asyncio.sleep(throttle_seconds)

  await asyncio.gather(*tasks)
  summary = writer.summary()
  print("\n" + "=" * 72)
  print("Run complete")
  print("=" * 72)
  print(f"Successes: {stats['success']}")
  print(f"Failures: {stats['failure']}")
  print(f"Length stops: {stats['length_stops']}")
  print(f"Completed cases: {summary['completed_cases']} / {summary['total_cases']}")
  print(f"Submission snapshot: {args.output}")
  print(f"Detailed log: {args.log}")
  print("=" * 72)


def parse_args():
  parser = argparse.ArgumentParser(description="RE-ARC OpenRouter streaming solver")
  parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="Path to RE-ARC dataset JSON")
  parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Path to write live submission JSON")
  parser.add_argument("--log", default=str(DEFAULT_LOG), help="Path to append JSONL attempt logs")
  parser.add_argument("--fresh", action="store_true", help="Ignore existing submission snapshot and start fresh")
  return parser.parse_args()


def main():
  args = parse_args()
  asyncio.run(run_solver(args))


if __name__ == "__main__":
  main()
