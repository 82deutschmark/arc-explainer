#!/usr/bin/env python3
"""
Author: Cascade (Claude Sonnet 4)
Date: 2025-11-25
Updated: 2025-11-27 - MIGRATED TO DIRECT SDK CALLS (NO LiteLLM)
         - OpenAI: Uses Responses API (POST /v1/responses) for GPT-5.x, o3, o4 models
         - Anthropic: Uses Messages API directly via anthropic SDK
         - Google Gemini: Uses Generative AI SDK directly
         - OpenRouter/xAI: Uses OpenAI SDK with custom base_url
         
PURPOSE: Python bridge wrapper for Poetiq ARC-AGI solver integration.
         Receives puzzle data via stdin, runs Poetiq solver, streams progress as NDJSON.
         Uses internalized solver from solver/poetiq/ with direct SDK calls for all providers.

SRP and DRY check: Pass - Single responsibility is bridging Node.js to Poetiq solver.
                   LLM calls are delegated to solver/poetiq/llm.py which has provider-specific functions.

Protocol:
  Node -> Python (stdin): { "puzzleId": str, "task": { train: [...], test: [...] }, "options": {...} }
  Python -> Node (stdout): NDJSON events:
    { "type": "start", "metadata": {...} }
    { "type": "progress", "phase": str, "iteration": int, "message": str, "tokenUsage"?: {...}, "cost"?: {...} }
    { "type": "log", "level": str, "message": str }
    { "type": "final", "success": bool, "result": {..., "tokenUsage": {...}, "cost": {...}} }
    { "type": "error", "message": str }
"""

import asyncio
import json
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Dict, Tuple, Optional, Any

# Note: OpenAI, Anthropic, and Google SDKs are now called via solver/poetiq/llm.py
# which provides direct SDK integration for all providers (NO LiteLLM)


# ==========================================
# NDJSON EVENT EMISSION (must be defined FIRST)
# ==========================================
def emit(event: dict):
    """Emit NDJSON event to stdout for Node.js consumption."""
    print(json.dumps(event, default=str), flush=True)


def log(message: str, level: str = "info"):
    """Emit a log event."""
    emit({"type": "log", "level": level, "message": message})


# ==========================================
# COST TRACKING UTILITIES
# ==========================================
# Model pricing per 1M tokens (from server/config/models.ts)
# This mirrors our centralized pricing config
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    # OpenAI models
    "gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "o3-mini": {"input": 1.10, "output": 4.40},
    "o4-mini": {"input": 1.10, "output": 4.40},
    "o3": {"input": 2.00, "output": 8.00},
    "gpt-4.1": {"input": 2.00, "output": 8.00},
    "gpt-5": {"input": 1.25, "output": 10.00},
    "gpt-5-chat": {"input": 1.25, "output": 10.00},
    "gpt-5-mini": {"input": 0.25, "output": 2.00},
    "gpt-5.1": {"input": 0.35, "output": 1.40},
    "gpt-5.1-codex": {"input": 1.25, "output": 10.00},
    "gpt-5.1-codex-mini": {"input": 0.25, "output": 2.00},

    # Anthropic models
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
    "claude-haiku-4": {"input": 0.80, "output": 4.00},
    "claude-haiku-4-5": {"input": 0.80, "output": 4.00},
    "claude-opus-4": {"input": 15.00, "output": 75.00},

    # Google Gemini models
    "gemini-2.0-flash": {"input": 0.075, "output": 0.30},
    "gemini-2.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-3-pro": {"input": 1.25, "output": 5.00},
    "gemini-exp-1206": {"input": 0.00, "output": 0.00},

    # xAI models
    "grok-4": {"input": 5.00, "output": 15.00},
    "grok-4-fast": {"input": 0.50, "output": 1.50},
}


def normalize_model_name(model_id: str) -> str:
    """
    Normalize model ID to match our pricing lookup keys.
    Handles provider prefixes (openai/, gemini/, anthropic/, openrouter/, etc.)
    """
    # Remove provider prefix (openai/, gemini/, anthropic/, openrouter/, etc.)
    parts = model_id.split("/")
    if len(parts) > 1:
        model_name = parts[-1]  # Take last part after final slash
    else:
        model_name = model_id

    # Normalize common patterns
    model_lower = model_name.lower()

    # GPT models
    if "gpt-5.1-codex-mini" in model_lower:
        return "gpt-5.1-codex-mini"
    if "gpt-5.1-codex" in model_lower:
        return "gpt-5.1-codex"
    if "gpt-5.1" in model_lower:
        return "gpt-5.1"
    if "gpt-5-mini" in model_lower:
        return "gpt-5-mini"
    if "gpt-5-chat" in model_lower:
        return "gpt-5-chat"
    if "gpt-5" in model_lower:
        return "gpt-5"
    if "gpt-4.1-nano" in model_lower:
        return "gpt-4.1-nano"
    if "gpt-4.1-mini" in model_lower:
        return "gpt-4.1-mini"
    if "gpt-4.1" in model_lower:
        return "gpt-4.1"
    if "gpt-4o-mini" in model_lower:
        return "gpt-4o-mini"
    if "o4-mini" in model_lower:
        return "o4-mini"
    if "o3-mini" in model_lower:
        return "o3-mini"
    if model_lower.startswith("o3"):
        return "o3"

    # Claude models
    if "claude-sonnet-4-5" in model_lower or "claude-sonnet-4.5" in model_lower:
        return "claude-sonnet-4-5"
    if "claude-sonnet-4" in model_lower:
        return "claude-sonnet-4"
    if "claude-3-5-sonnet" in model_lower or "claude-3.5-sonnet" in model_lower:
        return "claude-3-5-sonnet"
    if "claude-haiku-4-5" in model_lower or "claude-haiku-4.5" in model_lower:
        return "claude-haiku-4-5"
    if "claude-haiku-4" in model_lower:
        return "claude-haiku-4"
    if "claude-opus-4" in model_lower:
        return "claude-opus-4"

    # Gemini models
    if "gemini-3-pro" in model_lower:
        return "gemini-3-pro"
    if "gemini-2.5-pro" in model_lower:
        return "gemini-2.5-pro"
    if "gemini-2.5-flash" in model_lower:
        return "gemini-2.5-flash"
    if "gemini-2.0-flash" in model_lower or "gemini-2-flash" in model_lower:
        return "gemini-2.0-flash"
    if "gemini-exp-1206" in model_lower:
        return "gemini-exp-1206"

    # Grok models
    if "grok-4-fast" in model_lower:
        return "grok-4-fast"
    if "grok-4" in model_lower:
        return "grok-4"

    # Fallback: return as-is
    return model_name


def calculate_cost(model_id: str, token_usage: Dict) -> Dict[str, float]:
    """
    Calculate cost from token usage using our pricing model.
    Mirrors logic from server/utils/costCalculator.ts

    Args:
        model_id: Model identifier (e.g., "gemini/gemini-3-pro-preview")
        token_usage: Dict with input_tokens, output_tokens, total_tokens

    Returns:
        Dict with input_cost, output_cost, total_cost
    """
    if not token_usage:
        return {"input": 0.0, "output": 0.0, "total": 0.0}

    input_tokens = token_usage.get("input_tokens", 0)
    output_tokens = token_usage.get("output_tokens", 0)

    # Look up pricing
    normalized_name = normalize_model_name(model_id)
    pricing = MODEL_PRICING.get(normalized_name)

    if not pricing:
        log(f"No pricing found for model '{normalized_name}' (from '{model_id}'), cost will be $0", "warn")
        return {"input": 0.0, "output": 0.0, "total": 0.0}

    # Calculate costs (pricing is per 1M tokens)
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    total_cost = input_cost + output_cost

    return {
        "input": input_cost,
        "output": output_cost,
        "total": total_cost,
    }


# ==========================================
# PREFLIGHT CHECKS
# ==========================================
# Add solver directory to path (internalized Poetiq solver)
PROJECT_ROOT = Path(__file__).parent.parent.parent
SOLVER_PATH = PROJECT_ROOT / "solver"

# Check if internalized solver is available
if not (SOLVER_PATH / "poetiq" / "solve.py").exists():
    emit({
        "type": "error", 
        "message": f"Poetiq solver not found at {SOLVER_PATH / 'poetiq'}",
        "remediation": "Ensure solver/poetiq/ directory exists with all Python files"
    })
    sys.exit(1)

sys.path.insert(0, str(SOLVER_PATH.parent))  # Add project root so 'solver.poetiq' imports work
log(f"Poetiq solver loaded from: {SOLVER_PATH / 'poetiq'}")

# ==========================================
# INSTRUMENTATION - Monkey patch to get live updates
# ==========================================
import numpy as np
from solver.poetiq.types import ARCAGIResult, ARCAGISolution, ExpertConfig, RunResult
import solver.poetiq.solve_parallel_coding
from solver.poetiq.solve_coding import (
    _make_example, format_problem, _build_prompt, create_examples,
    _parse_code_from_llm, _eval_on_train_and_test, _build_feedback
)
from solver.poetiq.llm import llm

# Global tracker for token/cost data across all experts
# Reset at the start of each puzzle run
_token_cost_tracker = {
    "experts": {},  # expert_id -> {tokens, cost}
    "total": {"tokens": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}, "cost": {"input": 0.0, "output": 0.0, "total": 0.0}}
}

# ==========================================
# API ROUTING (uses solver/poetiq/llm.py which has direct SDK calls)
# ==========================================
def get_api_routing(model_id: str) -> dict:
    """
    Determine which API style is being used for a given model.
    All providers now use direct SDK calls (NO LiteLLM).
    
    Returns: {"provider": str, "apiStyle": str}
    """
    model_lower = model_id.lower()
    
    # OpenAI models (use Responses API)
    if any(x in model_lower for x in ['gpt-5', 'o3-', 'o4-', 'gpt-4.1']):
        if 'openrouter' not in model_lower:
            return {
                "provider": "OpenAI",
                "apiStyle": "Responses API (Direct SDK)"
            }
    
    # OpenRouter models
    if 'openrouter' in model_lower:
        return {
            "provider": "OpenRouter",
            "apiStyle": "ChatCompletions API (Direct SDK)"
        }
    
    # Anthropic models
    if 'claude' in model_lower or 'anthropic' in model_lower:
        return {
            "provider": "Anthropic",
            "apiStyle": "Messages API (Direct SDK)"
        }
    
    # Google Gemini models
    if 'gemini' in model_lower:
        return {
            "provider": "Google Gemini",
            "apiStyle": "Generative AI SDK (Direct)"
        }
    
    # xAI Grok models
    if 'grok' in model_lower or 'xai' in model_lower:
        return {
            "provider": "xAI",
            "apiStyle": "ChatCompletions API (Direct SDK)"
        }
    
    # Unknown - will be routed through OpenRouter
    return {
        "provider": "OpenRouter (fallback)",
        "apiStyle": "ChatCompletions API (Direct SDK)"
    }


async def instrumented_solve_coding(
    *,
    train_in: list[list[list[int]]],
    train_out: list[list[list[int]]],
    test_in: list[list[list[int]]],
    config: ExpertConfig,
    problem_id: str | None = None,
) -> ARCAGIResult:
    """
    Instrumented version of solve_coding that emits progress events WITH token/cost tracking.
    Also emits prompt data for UI visibility.
    """
    expert_id = config.get("expert_id", 0)
    solver_prompt = config["solver_prompt"]
    feedback_prompt = config["feedback_prompt"]
    llm_model = config["llm_id"]
    max_iterations = int(config["max_iterations"])
    solver_temperature = float(config["solver_temperature"])

    # Determine API routing for this model
    api_routing = get_api_routing(llm_model)
    
    # Token/cost tracking accumulators (per expert)
    expert_tokens = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    expert_cost = {"input": 0.0, "output": 0.0, "total": 0.0}
    conversation_messages: list[dict[str, Any]] = []
    previous_response_id: Optional[str] = None

    # Extract extra LLM params
    llm_kwargs = {}
    if "reasoning_effort" in config:
        llm_kwargs["reasoning_effort"] = config["reasoning_effort"]
    if "thinking" in config:
        llm_kwargs["thinking"] = config["thinking"]
    
    # Hardcode verbosity and reasoning_summary for GPT-5/o3 models
    # These are always "high" and "detailed" per project standards (see SaturnVisualSolver)
    model_lower = llm_model.lower()
    if "gpt-5" in model_lower or "o3" in model_lower or "gpt5" in model_lower:
        llm_kwargs["verbosity"] = "high"
        llm_kwargs["reasoning_summary"] = "detailed"

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
        # Build the prompt FIRST so we can show it to users
        example = _make_example(train_in, train_out, test_in)
        problem_str = format_problem(example, shuffle_examples, seed + it)
        message = _build_prompt(solver_prompt, problem=problem_str)

        selected = []
        feedback_prompt_text = ""
        if solutions:
            mask = rng.uniform(size=len(solutions)) < selection_probability
            selected = [s for s, keep in zip(solutions, mask) if keep]

        if selected:
            examples_block = create_examples(
                selected, max_examples=max_solutions, improving_order=improving_order
            )
            feedback_prompt_text = _build_prompt(feedback_prompt, feedback=examples_block)
            message += "\n\n" + feedback_prompt_text

        if not conversation_messages:
            conversation_messages.append({
                "role": "user",
                "label": "Puzzle setup",
                "content": message,
                "metadata": {
                    "iteration": 0,
                    "expert": expert_id,
                },
            })

        api_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in conversation_messages
        ]
        telemetry_messages = [
            {
                "role": msg["role"],
                "content": msg["content"],
                "label": msg.get("label"),
                "metadata": msg.get("metadata"),
            }
            for msg in conversation_messages
        ]
        previous_attempts_count = sum(1 for msg in conversation_messages if msg.get("role") == "assistant")

        # Emit progress with PROMPT DATA for UI visibility (now includes structured messages)
        emit({
            "type": "progress",
            "phase": "prompting",
            "iteration": it + 1,
            "expert": expert_id,
            "message": f"Expert {expert_id}: Sending prompt to {llm_model}...",
            "promptData": {
                "systemPrompt": solver_prompt,
                "userPrompt": message,
                "model": llm_model,
                "temperature": solver_temperature,
                "provider": api_routing["provider"],
                "apiStyle": api_routing["apiStyle"],
                "reasoningParams": {
                    "effort": llm_kwargs.get("reasoning_effort", "default"),
                    "verbosity": llm_kwargs.get("verbosity", "default"),
                    "summary": llm_kwargs.get("reasoning_summary", "default"),
                } if llm_kwargs else None,
                "problemSection": problem_str,
                "feedbackSection": feedback_prompt_text or None,
                "messages": telemetry_messages,
                "stats": {
                    "systemPromptChars": len(solver_prompt),
                    "userPromptChars": len(message),
                    "problemChars": len(problem_str),
                    "feedbackChars": len(feedback_prompt_text) if feedback_prompt_text else 0,
                    "previousSolutionCount": previous_attempts_count,
                },
            }
        })

        # Track reasoning summary (captured from Responses API for GPT-5.x, or from thinking for Claude/Gemini)
        reasoning_summary_text = ""
        
        try:
            # Use unified llm() function which routes to appropriate SDK internally
            # All providers now use direct SDK calls (NO LiteLLM)
            log(f"[{api_routing['provider']}] Calling via {api_routing['apiStyle']}")
            response, duration, max_total_time, max_total_timeouts, token_usage, provider_response_id = await llm(
                llm_model,
                message=message,
                temperature=solver_temperature,
                request_timeout=request_timeout,
                max_remaining_time=max_total_time,
                max_remaining_timeouts=max_total_timeouts,
                problem_id=problem_id,
                retries=per_iteration_retries,
                system_prompt=solver_prompt,  # Pass system prompt to the unified llm()
                conversation_messages=api_messages,
                previous_response_id=previous_response_id,
                **llm_kwargs,  # Pass reasoning_effort, verbosity, reasoning_summary, thinking etc.
            )
            
            if provider_response_id:
                previous_response_id = provider_response_id
            
            # Note: reasoning_summary is not directly returned by llm() anymore
            # It's handled internally by the provider-specific functions

            # Accumulate token usage for this expert
            if token_usage:
                expert_tokens["input_tokens"] += token_usage.get("input_tokens", 0)
                expert_tokens["output_tokens"] += token_usage.get("output_tokens", 0)
                expert_tokens["total_tokens"] += token_usage.get("total_tokens", 0)

                # Calculate and accumulate cost
                iteration_cost = calculate_cost(llm_model, token_usage)
                expert_cost["input"] += iteration_cost["input"]
                expert_cost["output"] += iteration_cost["output"]
                expert_cost["total"] += iteration_cost["total"]

                # Update global tracker
                _token_cost_tracker["total"]["tokens"]["input_tokens"] += token_usage.get("input_tokens", 0)
                _token_cost_tracker["total"]["tokens"]["output_tokens"] += token_usage.get("output_tokens", 0)
                _token_cost_tracker["total"]["tokens"]["total_tokens"] += token_usage.get("total_tokens", 0)
                _token_cost_tracker["total"]["cost"]["input"] += iteration_cost["input"]
                _token_cost_tracker["total"]["cost"]["output"] += iteration_cost["output"]
                _token_cost_tracker["total"]["cost"]["total"] += iteration_cost["total"]

        except Exception as e:
            if "Exceeded timeouts allotted to the request" in str(e) or "Exceeded time allotted to the request" in str(e):
                print("Exiting early due to exceeding allotted time or timeouts on problem", problem_id)
                break
            continue

        code = _parse_code_from_llm(response)
        
        # Emit progress with token/cost data and reasoning summary
        emit({
            "type": "progress",
            "phase": "evaluating",
            "iteration": it + 1,
            "expert": expert_id,
            "message": f"Expert {expert_id}: Evaluating generated code...",
            "reasoning": response,  # Send full reasoning/code block (LLM output)
            "reasoningSummary": reasoning_summary_text if reasoning_summary_text else None,  # Responses API reasoning summary
            "code": code,
            "tokenUsage": token_usage if token_usage else None,
            "cost": iteration_cost if token_usage else None,
            "expertCumulativeTokens": dict(expert_tokens),
            "expertCumulativeCost": dict(expert_cost),
            "globalTokens": dict(_token_cost_tracker["total"]["tokens"]),
            "globalCost": dict(_token_cost_tracker["total"]["cost"])
        })

        if not code:
            continue

        train_res, test_res = await _eval_on_train_and_test(
            code, train_in, train_out, test_in, timeout_s=timeout_sandbox
        )

        last_train, last_test = train_res, test_res
        train_pass_count = sum(1 for r in train_res if r.get("success"))
        total_train_cases = len(train_res)
        pass_rate_pct = (train_pass_count / total_train_cases * 100) if total_train_cases else 0.0
        failure_reasons: list[str] = []
        for idx, res in enumerate(train_res, start=1):
            if not res.get("success"):
                err_text = res.get("error") or "Mismatch"
                failure_reasons.append(f"Example {idx}: {err_text[:200]}")

        sandbox_summary_lines = []
        if total_train_cases:
            sandbox_summary_lines.append(f"Train pass rate: {train_pass_count}/{total_train_cases} ({pass_rate_pct:.1f}%)")
        else:
            sandbox_summary_lines.append("Train pass rate unavailable (no results).")
        if failure_reasons:
            sandbox_summary_lines.append("Failures:")
            sandbox_summary_lines.extend(failure_reasons[:5])
        base_feedback_text = "\n".join(sandbox_summary_lines)

        # Append assistant turn describing the code + sandbox stats
        conversation_messages.append({
            "role": "assistant",
            "label": f"Attempt {it + 1}",
            "content": "\n".join([
                f"Iteration {it + 1} attempt (Expert {expert_id})",
                "```python",
                code.strip(),
                "```",
                "Sandbox summary:",
                base_feedback_text or "No sandbox results captured."
            ]),
            "metadata": {
                "iteration": it + 1,
                "expert": expert_id,
                "trainPasses": train_pass_count,
                "trainTotal": total_train_cases,
            },
        })
        
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
            conversation_messages.append({
                "role": "user",
                "label": f"Sandbox feedback {it + 1}",
                "content": base_feedback_text or "All training examples passed. Proceeding to final validation.",
                "metadata": {
                    "iteration": it + 1,
                    "expert": expert_id,
                    "trainPasses": train_pass_count,
                    "trainTotal": total_train_cases,
                    "solved": True,
                },
            })
            return ARCAGIResult(
                train_results=train_res, results=test_res, iteration=it + 1
            )

        feedback, score = _build_feedback(train_res, train_in, train_out)
        sandbox_feedback_text = f"{base_feedback_text}\n\n{feedback}".strip()
        conversation_messages.append({
            "role": "user",
            "label": f"Sandbox feedback {it + 1}",
            "content": sandbox_feedback_text,
            "metadata": {
                "iteration": it + 1,
                "expert": expert_id,
                "trainPasses": train_pass_count,
                "trainTotal": total_train_cases,
                "solved": False,
            },
        })
        solutions.append(ARCAGISolution(code=code, feedback=feedback, score=score))

        if score >= best_train_score:
            best_train_score = score
            best_result = ARCAGIResult(
                train_results=train_res, results=test_res, iteration=it + 1
            )

    # Store this expert's final token/cost data in global tracker
    _token_cost_tracker["experts"][expert_id] = {
        "tokens": dict(expert_tokens),
        "cost": dict(expert_cost)
    }

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
solver.poetiq.solve_parallel_coding.solve_coding = instrumented_solve_coding
# ==========================================


# NOTE: emit() and log() are defined at the top of the file


def build_config_list(num_experts: int, model: str, max_iterations: int, temperature: float, reasoning_effort: str = None, verbosity: str = None, reasoning_summary: str = None):
    """
    Build a dynamic CONFIG_LIST for this run based on user options.
    This allows per-request expert count without modifying global state.
    """
    from solver.poetiq.prompts import FEEDBACK_PROMPT, SOLVER_PROMPT_1
    
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
    
    # Add reasoning effort if specified
    if reasoning_effort:
        base_config['reasoning_effort'] = reasoning_effort
        
        # Auto-configure thinking budget for Claude/Gemini if implied by reasoning level
        # (This is a simple heuristic, ideally should be explicit)
        if 'claude' in model.lower() and reasoning_effort in ['high', 'medium']:
             base_config['thinking'] = {"type": "enabled", "budget_tokens": 16000}
             
    # Add GPT-5 specific params
    if verbosity:
        base_config['verbosity'] = verbosity
    if reasoning_summary:
        base_config['reasoning_summary'] = reasoning_summary

    
    # Create list of configs, one per expert
    configs = []
    for i in range(num_experts):
        config = base_config.copy()
        config['expert_id'] = i + 1
        configs.append(config)
    return configs


async def run_poetiq_solver(puzzle_id: str, task: dict, options: dict) -> dict:
    """
    Run the Poetiq solver on a single puzzle with comprehensive token/cost tracking.

    Args:
        puzzle_id: Unique identifier for the puzzle
        task: ARC task with 'train' and 'test' arrays
        options: Solver configuration options including:
            - model: LLM model ID (e.g., 'gemini/gemini-3-pro-preview')
            - numExperts: Number of parallel experts (1, 2, 4, or 8)
            - maxIterations: Max code refinement iterations per expert
            - temperature: LLM temperature

    Returns:
        Result dictionary with predictions, metadata, AND token/cost data
    """
    # Reset global token/cost tracker for this puzzle
    global _token_cost_tracker
    _token_cost_tracker = {
        "experts": {},
        "total": {"tokens": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}, "cost": {"input": 0.0, "output": 0.0, "total": 0.0}}
    }

    # CRITICAL: We call solve_parallel_coding DIRECTLY instead of solve()
    # This is because solve.py imports CONFIG_LIST at module load time,
    # so patching config.CONFIG_LIST after importing solve.py has no effect.
    # By calling solve_parallel_coding directly, we pass our own config list.
    from solver.poetiq.solve_parallel_coding import solve_parallel_coding
    from solver.poetiq.io import build_kaggle_two_attempts
    from solver.poetiq.scoring import score_task
    
    # Extract train/test data in Poetiq format
    train = task.get("train", [])
    test = task.get("test", [])
    
    train_in = [ex["input"] for ex in train]
    train_out = [ex["output"] for ex in train]
    test_in = [ex["input"] for ex in test]
    
    # Get config from options with sensible defaults
    # Default: 2 experts, Gemini 3 Pro Preview via OpenRouter, 10 iterations
    model = options.get("model", "openrouter/google/gemini-3-pro-preview")
    num_experts = options.get("numExperts", 2)
    max_iterations = options.get("maxIterations", 10)
    temperature = options.get("temperature", 1.0)
    reasoning_effort = options.get("reasoningEffort")
    verbosity = options.get("verbosity")
    reasoning_summary = options.get("reasoningSummary")
    
    # Build dynamic config list for this run
    config_list = build_config_list(num_experts, model, max_iterations, temperature, reasoning_effort, verbosity, reasoning_summary)
    
    emit({
        "type": "progress",
        "phase": "solver_start",
        "iteration": 0,
        "message": f"Starting Poetiq solver for {puzzle_id} with {len(train)} training examples and {len(test)} test inputs"
    })
    
    log(f"Running with {len(config_list)} expert configs: {[c.get('expert_id') for c in config_list]}")
    
    start_time = time.time()
    
    try:
        # CRITICAL: Call solve_parallel_coding DIRECTLY with our config list
        # This bypasses solve() which has a stale reference to CONFIG_LIST
        results = await solve_parallel_coding(
            train_in=train_in,
            train_out=train_out,
            test_in=test_in,
            expert_configs=config_list,
            problem_id=puzzle_id,
        )
        
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
        resolved_config = config_list[0] if config_list else {}

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
                "model": resolved_config.get("llm_id"),
                "maxIterations": resolved_config.get("max_iterations"),
                "temperature": resolved_config.get("solver_temperature"),
                "numExperts": len(config_list) if config_list else 0,
            },
            # TOKEN AND COST TRACKING - Key addition for independent audit
            "tokenUsage": dict(_token_cost_tracker["total"]["tokens"]),
            "cost": dict(_token_cost_tracker["total"]["cost"]),
            "expertBreakdown": {
                str(expert_id): {
                    "tokens": data["tokens"],
                    "cost": data["cost"]
                }
                for expert_id, data in _token_cost_tracker["experts"].items()
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
            # Include partial token/cost data even on failure
            "tokenUsage": dict(_token_cost_tracker["total"]["tokens"]),
            "cost": dict(_token_cost_tracker["total"]["cost"]),
            "expertBreakdown": {
                str(expert_id): {
                    "tokens": data["tokens"],
                    "cost": data["cost"]
                }
                for expert_id, data in _token_cost_tracker["experts"].items()
            }
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
        
        # Extract config for rich start event
        model = options.get("model", "openrouter/google/gemini-3-pro-preview")
        num_experts = options.get("numExperts", 2)
        max_iterations = options.get("maxIterations", 10)
        temperature = options.get("temperature", 1.0)
        
        emit({
            "type": "start",
            "metadata": {
                "puzzleId": puzzle_id,
                "trainCount": len(task.get("train", [])),
                "testCount": len(task.get("test", [])),
                "model": model,
                "numExperts": num_experts,
                "maxIterations": max_iterations,
                "temperature": temperature,
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
            emit({
                "type": "error", 
                "message": "No API keys found. Set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY",
                "remediation": "Provide an API key in the UI or set environment variables on the server"
            })
            sys.exit(1)
        
        log(
            "API keys available: "
            f"OpenRouter={'yes' if openrouter_key else 'no'}, "
            f"Gemini={'yes' if gemini_key else 'no'}, "
            f"OpenAI={'yes' if openai_key else 'no'}"
        )
        
        # Emit progress event before solver starts (for immediate UI feedback)
        emit({
            "type": "progress",
            "phase": "initializing",
            "iteration": 0,
            "message": f"Initializing Poetiq solver with {num_experts} expert(s) using {model}..."
        })
        
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
