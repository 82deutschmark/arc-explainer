#!/usr/bin/env python3
"""
Author: Cascade (Claude Sonnet 4)
Date: 2025-11-25
PURPOSE: Python bridge wrapper for Poetiq ARC-AGI solver integration.
         Receives puzzle data via stdin, runs Poetiq solver, streams progress as NDJSON.
         
SRP and DRY check: Pass - Single responsibility is bridging Node.js to Poetiq solver.
                   Does not duplicate Poetiq logic, only wraps it.

Protocol:
  Node -> Python (stdin): { "puzzleId": str, "task": { train: [...], test: [...] }, "options": {...} }
  Python -> Node (stdout): NDJSON events:
    { "type": "start", "metadata": {...} }
    { "type": "progress", "phase": str, "iteration": int, "message": str }
    { "type": "log", "level": str, "message": str }
    { "type": "final", "success": bool, "result": {...} }
    { "type": "error", "message": str }
"""

import asyncio
import json
import os
import sys
import time
import traceback
from pathlib import Path

# Add poetiq-solver to path
POETIQ_PATH = Path(__file__).parent.parent.parent / "poetiq-solver"

# Check if Poetiq solver is available
if not POETIQ_PATH.exists() or not (POETIQ_PATH / "arc_agi" / "solve.py").exists():
    emit({
        "type": "error", 
        "message": "Poetiq solver not available. The git submodule needs to be initialized with: git submodule update --init --recursive"
    })
    sys.exit(1)

sys.path.insert(0, str(POETIQ_PATH))

# ==========================================
# INSTRUMENTATION - Monkey patch to get live updates
# ==========================================
import numpy as np
from arc_agi.types import ARCAGIResult, ARCAGISolution, ExpertConfig, RunResult
import arc_agi.solve_parallel_coding
from arc_agi.solve_coding import (
    _make_example, format_problem, _build_prompt, create_examples, 
    _parse_code_from_llm, _eval_on_train_and_test, _build_feedback
)
from arc_agi.llm import llm

async def instrumented_solve_coding(
    *,
    train_in: list[list[list[int]]],
    train_out: list[list[list[int]]],
    test_in: list[list[list[int]]],
    config: ExpertConfig,
    problem_id: str | None = None,
) -> ARCAGIResult:
    """
    Instrumented version of solve_coding that emits progress events.
    """
    expert_id = config.get("expert_id", 0)
    solver_prompt = config["solver_prompt"]
    feedback_prompt = config["feedback_prompt"]
    llm_model = config["llm_id"]
    max_iterations = int(config["max_iterations"])
    solver_temperature = float(config["solver_temperature"])
    max_solutions = int(config.get("max_solutions"))
    selection_probability = float(config.get("selection_probability"))
    seed = int(config.get("seed"))
    timeout_sandbox = float(config.get("timeout_s", 5))
    shuffle_examples = bool(config.get("shuffle_examples"))
    improving_order = bool(config.get("improving_order"))
    return_best = bool(config.get("return_best_result"))
    request_timeout = config.get("request_timeout")
    max_total_timeouts = config.get("max_total_timeouts")
    max_total_time = config.get("max_total_time")
    per_iteration_retries = config.get("per_iteration_retries")

    best_train_score = -1.0
    best_result = None
    last_train = [
        RunResult(
            success=False,
            output="",
            soft_score=0.0,
            error="Unexpected use of initial empty train result",
            code="",
        )
    ]
    last_test = None

    rng = np.random.default_rng(seed)
    solutions = []

    for it in range(max_iterations):
        emit({
            "type": "progress",
            "phase": "reasoning",
            "iteration": it + 1,
            "expert": expert_id,
            "message": f"Expert {expert_id}: Reasoning for iteration {it + 1}..."
        })

        example = _make_example(train_in, train_out, test_in)
        problem_str = format_problem(example, shuffle_examples, seed + it)
        message = _build_prompt(solver_prompt, problem=problem_str)

        selected = []
        if solutions:
            mask = rng.uniform(size=len(solutions)) < selection_probability
            selected = [s for s, keep in zip(solutions, mask) if keep]

        if selected:
            examples_block = create_examples(
                selected, max_examples=max_solutions, improving_order=improving_order
            )
            message += "\n\n" + _build_prompt(feedback_prompt, feedback=examples_block)

        try:
            response, duration, max_total_time, max_total_timeouts = await llm(
                llm_model,
                message=message,
                temperature=solver_temperature,
                request_timeout=request_timeout,
                max_remaining_time=max_total_time,
                max_remaining_timeouts=max_total_timeouts,
                problem_id=problem_id,
                retries=per_iteration_retries,
            )
        except Exception as e:
            if "Exceeded timeouts allotted to the request" in str(e) or "Exceeded time allotted to the request" in str(e):
                print("Exiting early due to exceeding allotted time or timeouts on problem", problem_id)
                break
            continue

        code = _parse_code_from_llm(response)
        
        emit({
            "type": "progress",
            "phase": "evaluating",
            "iteration": it + 1,
            "expert": expert_id,
            "message": f"Expert {expert_id}: Evaluating generated code...",
            "reasoning": response, # Send full reasoning/code block
            "code": code
        })

        if not code:
            continue

        train_res, test_res = await _eval_on_train_and_test(
            code, train_in, train_out, test_in, timeout_s=timeout_sandbox
        )

        last_train, last_test = train_res, test_res
        
        # Calculate score for reporting
        current_score = sum(1 for r in train_res if r["success"]) / len(train_res) if train_res else 0
        
        # Emit evaluation results
        clean_results = []
        for r in train_res:
             clean_results.append({
                 "success": r.get("success", False),
                 "error": str(r.get("error", ""))[:200] if r.get("error") else None 
             })
             
        emit({
            "type": "progress",
            "phase": "feedback",
            "iteration": it + 1,
            "expert": expert_id,
            "message": f"Expert {expert_id}: Iteration {it + 1} complete (Score: {current_score:.0%})",
            "trainResults": clean_results
        })

        if all(r["success"] for r in train_res):
            return ARCAGIResult(
                train_results=train_res, results=test_res, iteration=it + 1
            )

        feedback, score = _build_feedback(train_res, train_in, train_out)
        solutions.append(ARCAGISolution(code=code, feedback=feedback, score=score))

        if score >= best_train_score:
            best_train_score = score
            best_result = ARCAGIResult(
                train_results=train_res, results=test_res, iteration=it + 1
            )

    if return_best and best_result is not None:
        return best_result
    if last_test is None:
        last_test = [
            RunResult(
                success=False,
                output="",
                soft_score=0.0,
                error="Failed to generate any valid solutions.",
                code="",
            )
        ]
    return ARCAGIResult(
        train_results=last_train, results=last_test, iteration=max_iterations
    )

# Apply monkey patch
arc_agi.solve_parallel_coding.solve_coding = instrumented_solve_coding
# ==========================================


def emit(event: dict):
    """Emit NDJSON event to stdout for Node.js consumption."""
    print(json.dumps(event, default=str), flush=True)


def log(message: str, level: str = "info"):
    """Emit a log event."""
    emit({"type": "log", "level": level, "message": message})


def build_config_list(num_experts: int, model: str, max_iterations: int, temperature: float):
    """
    Build a dynamic CONFIG_LIST for this run based on user options.
    This allows per-request expert count without modifying global state.
    """
    from arc_agi.prompts import FEEDBACK_PROMPT, SOLVER_PROMPT_1
    
    base_config = {
        'solver_prompt': SOLVER_PROMPT_1,
        'feedback_prompt': FEEDBACK_PROMPT,
        'llm_id': model,
        'solver_temperature': temperature,
        'request_timeout': 60 * 60,  # 1 hour
        'max_total_timeouts': 15,
        'max_total_time': None,
        'per_iteration_retries': 2,
        'num_experts': num_experts,
        'max_iterations': max_iterations,
        'max_solutions': 5,
        'selection_probability': 1.0,
        'seed': 0,
        'shuffle_examples': True,
        'improving_order': True,
        'return_best_result': True,
        'use_new_voting': True,
        'count_failed_matches': True,
        'iters_tiebreak': False,
        'low_to_high_iters': False,
    }
    
    # Create list of configs, one per expert
    configs = []
    for i in range(num_experts):
        config = base_config.copy()
        config['expert_id'] = i + 1
        configs.append(config)
    return configs


async def run_poetiq_solver(puzzle_id: str, task: dict, options: dict) -> dict:
    """
    Run the Poetiq solver on a single puzzle.
    
    Args:
        puzzle_id: Unique identifier for the puzzle
        task: ARC task with 'train' and 'test' arrays
        options: Solver configuration options including:
            - model: LLM model ID (e.g., 'gemini/gemini-3-pro-preview')
            - numExperts: Number of parallel experts (1, 2, 4, or 8)
            - maxIterations: Max code refinement iterations per expert
            - temperature: LLM temperature
        
    Returns:
        Result dictionary with predictions and metadata
    """
    from arc_agi.solve import solve
    from arc_agi.io import build_kaggle_two_attempts
    from arc_agi.scoring import score_task
    
    # Extract train/test data in Poetiq format
    train = task.get("train", [])
    test = task.get("test", [])
    
    train_in = [ex["input"] for ex in train]
    train_out = [ex["output"] for ex in train]
    test_in = [ex["input"] for ex in test]
    
    # Get config from options with sensible defaults
    # Default: 2 experts, OpenRouter Gemini, 10 iterations
    model = options.get("model", "openrouter/google/gemini-3-pro-preview")
    num_experts = options.get("numExperts", 2)
    max_iterations = options.get("maxIterations", 10)
    temperature = options.get("temperature", 1.0)
    
    # Build dynamic config list for this run
    config_list = build_config_list(num_experts, model, max_iterations, temperature)
    
    # Patch the global CONFIG_LIST so solve() uses our config
    import arc_agi.config as config_module
    config_module.CONFIG_LIST = config_list
    config_module.NUM_EXPERTS = num_experts
    
    emit({
        "type": "progress",
        "phase": "solver_start",
        "iteration": 0,
        "message": f"Starting Poetiq solver for {puzzle_id} with {len(train)} training examples and {len(test)} test inputs"
    })
    
    start_time = time.time()
    
    try:
        # Run the solver
        results = await solve(train_in, train_out, test_in, problem_id=puzzle_id)
        
        elapsed = time.time() - start_time
        
        # Build Kaggle-format predictions
        kaggle_preds = build_kaggle_two_attempts(results, test_in)
        
        # Extract predictions from results
        predictions = []
        for result in results:
            test_results = result.get("results", [])
            for tr in test_results:
                output_str = tr.get("output", "")
                if output_str:
                    try:
                        pred_grid = json.loads(output_str)
                        predictions.append(pred_grid)
                    except json.JSONDecodeError:
                        predictions.append(None)
                else:
                    predictions.append(None)
        
        # Score against ground truth if available
        test_outputs = [ex.get("output") for ex in test if ex.get("output")]
        is_correct = False
        accuracy = 0.0
        
        if test_outputs and kaggle_preds:
            try:
                task_score = score_task(kaggle_preds, test_outputs)
                is_correct = task_score == 1.0
                accuracy = task_score
            except Exception as e:
                log(f"Scoring failed: {e}", "warn")
        
        # Extract iteration data and generated code
        iteration_data = []
        best_code = None
        best_train_score = 0.0
        
        for idx, result in enumerate(results):
            train_results = result.get("train_results", [])
            train_score = sum(1 for tr in train_results if tr.get("success", False)) / len(train_results) if train_results else 0
            
            iteration_info = {
                "index": idx,
                "iteration": result.get("iteration", 0),
                "trainScore": train_score,
                "trainResults": [
                    {
                        "success": tr.get("success", False),
                        "softScore": tr.get("soft_score", 0.0),
                        "error": tr.get("error"),
                    }
                    for tr in train_results
                ]
            }
            
            # Extract code from first successful train result if available
            for tr in train_results:
                if tr.get("code"):
                    iteration_info["code"] = tr["code"]
                    if train_score > best_train_score:
                        best_train_score = train_score
                        best_code = tr["code"]
                    break
            
            iteration_data.append(iteration_info)
        
        return {
            "success": True,
            "puzzleId": puzzle_id,
            "predictions": predictions,
            "kagglePreds": kaggle_preds,
            "isPredictionCorrect": is_correct,
            "accuracy": accuracy,
            "iterationCount": len(results),
            "iterations": iteration_data,
            "generatedCode": best_code,
            "bestTrainScore": best_train_score,
            "elapsedMs": int(elapsed * 1000),
            "config": {
                "model": CONFIG_LIST[0].get("llm_id") if CONFIG_LIST else None,
                "maxIterations": CONFIG_LIST[0].get("max_iterations") if CONFIG_LIST else None,
                "temperature": CONFIG_LIST[0].get("solver_temperature") if CONFIG_LIST else None,
                "numExperts": len(CONFIG_LIST),
            }
        }
        
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "success": False,
            "puzzleId": puzzle_id,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "elapsedMs": int(elapsed * 1000),
        }


async def main():
    """Main entry point - read from stdin, run solver, emit results."""
    try:
        # Read payload from stdin
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            emit({"type": "error", "message": "No input provided on stdin"})
            sys.exit(1)
        
        payload = json.loads(raw_input)
        puzzle_id = payload.get("puzzleId", "unknown")
        task = payload.get("task")
        options = payload.get("options", {})
        
        if not task:
            emit({"type": "error", "message": "No task data provided"})
            sys.exit(1)
        
        emit({
            "type": "start",
            "metadata": {
                "puzzleId": puzzle_id,
                "trainCount": len(task.get("train", [])),
                "testCount": len(task.get("test", [])),
                "options": options,
            }
        })
        
        # Load environment variables
        from dotenv import load_dotenv
        load_dotenv()
        
        # Verify API keys are available
        gemini_key = os.environ.get("GEMINI_API_KEY")
        openai_key = os.environ.get("OPENAI_API_KEY")
        openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        
        if not gemini_key and not openai_key and not openrouter_key:
            emit({"type": "error", "message": "No API keys found. Set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY"})
            sys.exit(1)
        
        log(
            "API keys available: "
            f"OpenRouter={'yes' if openrouter_key else 'no'}, "
            f"Gemini={'yes' if gemini_key else 'no'}, "
            f"OpenAI={'yes' if openai_key else 'no'}"
        )
        
        # Run the solver
        result = await run_poetiq_solver(puzzle_id, task, options)
        
        emit({
            "type": "final",
            "success": result.get("success", False),
            "result": result,
        })
        
    except json.JSONDecodeError as e:
        emit({"type": "error", "message": f"Invalid JSON input: {e}"})
        sys.exit(1)
    except Exception as e:
        emit({
            "type": "error",
            "message": str(e),
            "traceback": traceback.format_exc(),
        })
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
