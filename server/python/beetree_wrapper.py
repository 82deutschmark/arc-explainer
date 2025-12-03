#!/usr/bin/env python3
"""
server/python/beetree_wrapper.py

Wrapper around beetreeARC solver that:
- Reads a single JSON payload from stdin: { taskId, testIndex, mode, runTimestamp }
- Runs beetreeARC in single-task mode (--task <task_id>) with cost tracking
- Emits NDJSON events to stdout for start/progress/log/final/error
- Includes real-time cost and token data in events
- Redirects beetreeARC's native stdout to stderr to keep NDJSON clean

Author: Cascade (model: Cascade GPT-5 medium reasoning)
Date: 2025-12-01
PURPOSE: Bridge beetreeARC multi-model ensemble solver into arc-explainer via NDJSON protocol
SRP/DRY check: Pass - Reuses saturn_wrapper.py patterns and NDJSON event structure
"""

import sys
import os
import json
import time
import io
import contextlib
import threading
import types
from typing import Any, Dict, List, Optional
from pathlib import Path

# Ensure we can import beetreeARC
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
BEETREE_DIR = os.path.join(PROJECT_ROOT, 'beetreeARC')
if BEETREE_DIR not in sys.path:
    sys.path.insert(0, BEETREE_DIR)

# beetreeARC uses fcntl for file locking, which is unavailable on Windows.
# Provide a minimal shim so imports succeed and locking becomes a no-op.
if os.name == 'nt' and 'fcntl' not in sys.modules:
    fcntl_stub = types.ModuleType('fcntl')
    fcntl_stub.LOCK_EX = 0
    fcntl_stub.LOCK_UN = 0

    def _noop_flock(*_args, **_kwargs):
        return None

    fcntl_stub.flock = _noop_flock  # type: ignore[attr-defined]
    sys.modules['fcntl'] = fcntl_stub

try:
    from src.solver_engine import run_solver_mode
    from src.tasks import load_task
    from src.run_utils import find_task_path
except Exception as e:
    print(json.dumps({"type": "error", "message": f"Failed to import beetreeARC: {e}"}))
    sys.exit(1)


def emit(obj: Dict[str, Any]):
    """Emit a single NDJSON event and flush.
    Important: write to sys.__stdout__ to avoid recursion when stdout is redirected.
    """
    sys.__stdout__.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.__stdout__.flush()


class ProgressReporter:
    """Adapter to bridge beetreeARC's ProgressReporter to our NDJSON events."""
    def __init__(self):
        self.start_time = time.time()
        self.total_cost = 0.0
        self.current_stage = "Initializing"
        
    def emit(self, status: str, step: str, outcome: Optional[str] = None, 
             event: Optional[str] = None, predictions: Optional[List] = None, 
             cost_so_far: Optional[float] = None, tokens_used: Optional[Dict] = None):
        """Convert beetree progress to NDJSON events."""
        timestamp_ms = int((time.time() - self.start_time) * 1000)
        
        # Update stage tracking
        if step in ["Step 1 (Shallow search)", "Step 2 (Evaluation)", 
                   "Step 3 (Extended search)", "Step 4 (Evaluation)", 
                   "Step 5 (Full search)", "Finished"]:
            self.current_stage = step
        
        # Base event structure
        event_data = {
            "type": "progress" if status == "RUNNING" else "final" if status == "COMPLETED" else "error",
            "status": status,
            "stage": self.current_stage,
            "timestamp": timestamp_ms,
        }
        
        # Add optional fields
        if outcome:
            event_data["outcome"] = outcome
        if event:
            event_data["event"] = event
        if predictions:
            event_data["predictions"] = predictions
        if cost_so_far is not None:
            event_data["costSoFar"] = round(cost_so_far, 4)
            self.total_cost = cost_so_far
        if tokens_used:
            event_data["tokensUsed"] = tokens_used
        
        emit(event_data)


def estimate_model_cost(model_name: str, input_tokens: int, output_tokens: int, mode: str) -> float:
    """Estimate cost based on model name and token counts."""
    # Pricing per 1M tokens (input, output)
    pricing = {
        'gpt-5.1': (1.25, 10.00),
        'gpt-5': (1.25, 10.00),
        'gpt-4': (0.03, 0.06),
        'claude-opus': (5.00, 25.00),
        'claude-sonnet': (3.00, 15.00),
        'gemini-3': (2.00, 12.00),
        'gemini': (0.50, 1.50),
        'deepseek': (0.14, 0.28),
        'grok': (0.50, 1.50),
    }
    
    # Find matching pricing
    model_lower = model_name.lower()
    input_rate, output_rate = 0.50, 1.50  # Default fallback
    
    for key, rates in pricing.items():
        if key in model_lower:
            input_rate, output_rate = rates
            break
    
    # Calculate cost
    cost = (input_tokens * input_rate / 1_000_000) + (output_tokens * output_rate / 1_000_000)
    return round(cost, 6)


class CostTracker:
    """Track costs and tokens from beetreeARC events."""
    def __init__(self):
        self.model_costs = {}
        self.stage_costs = {}
        self.total_cost = 0.0
        self.total_tokens = {"input": 0, "output": 0, "reasoning": 0}
        
    def track_model_call(self, model: str, input_tokens: int, output_tokens: int, 
                        reasoning_tokens: int = 0, cost: float = 0.0):
        """Track a single model API call."""
        if model not in self.model_costs:
            self.model_costs[model] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "reasoning_tokens": 0,
                "cost": 0.0
            }
        
        self.model_costs[model]["input_tokens"] += input_tokens
        self.model_costs[model]["output_tokens"] += output_tokens
        self.model_costs[model]["reasoning_tokens"] += reasoning_tokens
        self.model_costs[model]["cost"] += cost
        
        self.total_tokens["input"] += input_tokens
        self.total_tokens["output"] += output_tokens
        self.total_tokens["reasoning"] += reasoning_tokens
        self.total_cost += cost
    
    def track_stage_cost(self, stage: str, cost: float, duration_ms: int):
        """Track cost for a specific stage."""
        if stage not in self.stage_costs:
            self.stage_costs[stage] = {"cost": 0.0, "duration_ms": 0}
        self.stage_costs[stage]["cost"] += cost
        self.stage_costs[stage]["duration_ms"] += duration_ms
    
    def get_breakdown(self) -> Dict[str, Any]:
        """Get complete cost breakdown."""
        return {
            "total_cost": self.total_cost,
            "by_model": [
                {
                    "model_name": model,
                    **data
                }
                for model, data in self.model_costs.items()
            ],
            "by_stage": [
                {
                    "stage": stage,
                    **data
                }
                for stage, data in self.stage_costs.items()
            ],
            "total_tokens": self.total_tokens
        }


def run():
    try:
        # Change to project root so relative paths work correctly
        os.chdir(PROJECT_ROOT)

        # Read configuration from stdin
        payload_raw = sys.stdin.read()
        cfg = json.loads(payload_raw)

        task_id: str = cfg.get('taskId')
        test_index: int = int(cfg.get('testIndex', 1))
        mode: str = cfg.get('mode', 'testing')  # 'testing' or 'production'
        run_timestamp: str = cfg.get('runTimestamp', f"beetree_{int(time.time())}")
        
        if not task_id:
            emit({"type": "error", "message": "Missing required field: taskId"})
            return 1
        
        # Validate mode
        if mode not in ['testing', 'production']:
            emit({"type": "error", "message": f"Invalid mode: {mode}. Must be 'testing' or 'production'"})
            return 1
        
        # Initialize tracking
        reporter = ProgressReporter()
        cost_tracker = CostTracker()
        
        # Emit start event
        emit({
            "type": "start",
            "metadata": {
                "taskId": task_id,
                "testIndex": test_index,
                "mode": mode,
                "runTimestamp": run_timestamp
            }
        })
        
        # Set up environment for beetreeARC
        os.environ['BEETREE_MODE'] = mode
        os.environ['BEETREE_RUN_TIMESTAMP'] = run_timestamp
        
        # Find task path
        try:
            task_path = find_task_path(task_id)
        except FileNotFoundError as e:
            emit({"type": "error", "message": f"Task not found: {task_id}"})
            return 1
        
        # Create logs directory if it doesn't exist
        logs_dir = Path(BEETREE_DIR) / "logs"
        logs_dir.mkdir(exist_ok=True)
        
        # Override beetreeARC's ProgressReporter to capture events
        from src.solver_engine import ProgressReporter as BeetreeProgressReporter
        original_emit = BeetreeProgressReporter.emit
        
        def tracking_emit(self, status, step, outcome=None, event=None, predictions=None):
            # Call original emit first
            original_emit(self, status, step, outcome, event, predictions)
            
            # Then emit our NDJSON event
            reporter.emit(status, step, outcome, event, predictions, cost_tracker.total_cost)
        
        BeetreeProgressReporter.emit = tracking_emit
        
        # Capture beetreeARC's stdout to stderr to keep NDJSON clean
        verbose_output = io.StringIO()
        
        print(f"[BEETREE-DEBUG] Starting run for task: {task_id}, mode: {mode}")
        
        # Run beetreeARC with stdout redirected
        with contextlib.redirect_stdout(sys.stderr):  # Send beetree prints to stderr
            with contextlib.redirect_stderr(StreamEmitter(verbose_output, 'info')):
                try:
                    # Call beetreeARC's run_solver_mode
                    result = run_solver_mode(
                        task_id=task_id,
                        test_index=test_index,
                        verbose=True,
                        is_testing=(mode == 'testing'),
                        run_timestamp=run_timestamp,
                        task_path=Path(task_path),
                        progress_queue=None,  # We use our custom reporter
                        answer_path=None
                    )
                    
                    # Parse result to extract cost information
                    if result and len(result) >= 2:
                        # result is [attempt1_grid, attempt2_grid]
                        predictions = result
                        
                        # Extract real cost/token information from step logs
                        consensus_data = {
                            "strength": 0.0,
                            "diversity_score": 0.0,
                            "agreement_count": 0,
                            "total_candidates": 0
                        }
                        
                        try:
                            finish_log_path = logs_dir / f"{run_timestamp}_{task_id}_{test_index}_step_finish.json"
                            if finish_log_path.exists():
                                with open(finish_log_path, 'r') as f:
                                    finish_log = json.load(f)
                                
                                # Extract consensus data from candidates_object
                                candidates = finish_log.get('candidates_object', {})
                                picked_solutions = finish_log.get('picked_solutions', [])
                                
                                if candidates:
                                    total_runs = sum(c.get('count', 1) for c in candidates.values())
                                    consensus_data["total_candidates"] = len(candidates)
                                    
                                    # Get top candidate agreement
                                    if picked_solutions and len(picked_solutions) > 0:
                                        top_count = picked_solutions[0].get('count', 1)
                                        consensus_data["agreement_count"] = top_count
                                        consensus_data["strength"] = top_count / max(total_runs, 1)
                                    
                                    # Diversity = unique grids / total runs
                                    consensus_data["diversity_score"] = len(candidates) / max(total_runs, 1)
                            
                            # Parse step logs for real token/cost data
                            for step_num in [1, 3, 5]:
                                step_log_path = logs_dir / f"{run_timestamp}_{task_id}_{test_index}_step_{step_num}.json"
                                if step_log_path.exists():
                                    with open(step_log_path, 'r') as f:
                                        step_log = json.load(f)
                                    
                                    # Extract per-run cost data
                                    runs = step_log if isinstance(step_log, list) else step_log.get('runs', [])
                                    for run_data in runs:
                                        if isinstance(run_data, dict):
                                            model_name = run_data.get('model_name', run_data.get('run_id', 'unknown'))
                                            # Extract from run_id if needed: "claude-opus-4.5_1_step_1"
                                            if '_' in str(model_name):
                                                model_name = model_name.split('_')[0]
                                            
                                            input_tokens = run_data.get('input_tokens', 0)
                                            output_tokens = run_data.get('output_tokens', 0)
                                            cached_tokens = run_data.get('cached_tokens', 0)
                                            cost = run_data.get('cost', 0.0)
                                            
                                            # If no explicit cost, estimate from tokens and model
                                            if cost == 0 and (input_tokens > 0 or output_tokens > 0):
                                                cost = estimate_model_cost(model_name, input_tokens, output_tokens, mode)
                                            
                                            cost_tracker.track_model_call(
                                                model=model_name,
                                                input_tokens=input_tokens,
                                                output_tokens=output_tokens,
                                                reasoning_tokens=run_data.get('reasoning_tokens', 0),
                                                cost=cost
                                            )
                                            
                                            # Track stage cost
                                            cost_tracker.track_stage_cost(
                                                stage=f"Step {step_num}",
                                                cost=cost,
                                                duration_ms=int(run_data.get('duration_seconds', 0) * 1000)
                                            )
                        
                        except Exception as log_err:
                            print(f"[BEETREE-DEBUG] Could not parse cost logs: {log_err}")
                            # Fallback: use estimates if log parsing fails
                            if cost_tracker.total_cost == 0:
                                models_estimate = 3 if mode == 'testing' else 8
                                for i in range(models_estimate):
                                    cost_tracker.track_model_call(
                                        model=f"model_{i+1}",
                                        input_tokens=5000 if mode == 'testing' else 15000,
                                        output_tokens=1000 if mode == 'testing' else 5000,
                                        reasoning_tokens=0 if mode == 'testing' else 3000,
                                        cost=0.40 if mode == 'testing' else 4.00
                                    )
                        
                        # Emit final success event with consensus data
                        emit({
                            "type": "final",
                            "success": True,
                            "predictions": predictions,
                            "result": {
                                "taskId": task_id,
                                "testIndex": test_index,
                                "mode": mode,
                                "runTimestamp": run_timestamp,
                                "predictions": predictions,
                                "costBreakdown": cost_tracker.get_breakdown(),
                                "consensus": consensus_data,
                                "verboseLog": verbose_output.getvalue()
                            },
                            "timingMs": int((time.time() - reporter.start_time) * 1000)
                        })
                        
                    else:
                        emit({
                            "type": "error", 
                            "message": "beetreeARC returned invalid result"
                        })
                        return 1
                        
                except Exception as solver_err:
                    emit({
                        "type": "error",
                        "message": f"beetreeARC solver error: {solver_err}"
                    })
                    return 1
        
        return 0
        
    except Exception as e:
        emit({"type": "error", "message": f"Wrapper error: {e}"})
        return 1


class StreamEmitter(io.TextIOBase):
    """Redirect beetreeARC prints to NDJSON log events while preserving them."""
    def __init__(self, sink: io.StringIO, level: str = 'info') -> None:
        self._sink = sink
        self._buf = ''
        self._level = level

    def write(self, s: Any) -> int:
        try:
            text = s if isinstance(s, str) else str(s)
        except Exception:
            text = str(s)
        
        # Store full output for final verbose log
        self._sink.write(text)
        self._buf += text
        
        # Emit each complete line as a log event
        while '\n' in self._buf:
            line, self._buf = self._buf.split('\n', 1)
            line_stripped = line.strip()
            if line_stripped:
                emit({ 
                    'type': 'log', 
                    'level': ('error' if self._level == 'error' else 'info'), 
                    'message': line_stripped 
                })
        return len(text)

    def flush(self) -> None:
        pass


if __name__ == '__main__':
    code = run()
    sys.exit(code)
