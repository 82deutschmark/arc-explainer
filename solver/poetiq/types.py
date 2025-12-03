"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Type definitions for Poetiq solver.
 *          Defines ExpertConfig, RunResult, ARCAGIResult, and other TypedDicts.
 * SRP and DRY check: Pass - Types only, no logic.
 * Source: Internalized from poetiq-solver/arc_agi/types.py
"""

from typing import Literal, Optional, TypedDict

# Model identifiers - kept for type hints but actual routing is flexible
Models = Literal[
    # Direct API models
    "groq/openai/gpt-oss-120b",
    "openai/gpt-5",
    "openai/gpt-5.1",
    "xai/grok-4-fast",
    "xai/grok-4",
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-haiku-4-5",
    "gemini/gemini-2.5-pro",
    "gemini/gemini-3-pro-preview",
    # OpenRouter models (use OPENROUTER_API_KEY)
    "openrouter/google/gemini-3-pro-preview",
    "openrouter/google/gemini-2.5-flash-preview-09-2025",
    "openrouter/anthropic/claude-sonnet-4",
    "openrouter/openai/gpt-5.1",
]


class ExpertConfig(TypedDict):
    use_new_voting: bool
    count_failed_matches: bool
    iters_tiebreak: bool
    low_to_high_iters: bool
    solver_prompt: str
    feedback_prompt: str
    llm_id: Models
    max_iterations: int
    solver_temperature: float
    max_solutions: int
    selection_probability: float
    seed: int
    shuffle_examples: bool
    improving_order: bool
    return_best_result: bool
    request_timeout: Optional[int]
    max_total_timeouts: Optional[int]
    max_total_time: Optional[int]
    num_experts: int
    per_iteration_retries: int


MessageRole = Literal["user", "assistant", "system"]


class Message(TypedDict):
    role: MessageRole
    content: str


class RunResult(TypedDict):
    success: bool
    output: str
    soft_score: float
    error: Optional[str]
    code: str


class ARCAGIResult(TypedDict):
    train_results: list[RunResult]
    results: list[RunResult]  # test results
    iteration: int


class ARCAGISolution(TypedDict):
    code: str
    feedback: str
    score: float


class TokenUsage(TypedDict, total=False):
    """Token usage tracking - new addition for cost analysis"""
    input_tokens: int
    output_tokens: int
    total_tokens: int
