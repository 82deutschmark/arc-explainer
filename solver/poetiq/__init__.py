"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * Updated: 2025-11-27 - MIGRATED TO DIRECT SDK CALLS (NO LiteLLM)
 * PURPOSE: Poetiq solver package - internalized from poetiq-solver submodule.
 *          This package implements iterative code generation for ARC puzzle solving.
 *          Uses direct SDK calls for all providers:
 *          - OpenAI: Responses API (GPT-5.x, o3, o4)
 *          - Anthropic: Messages API (Claude)
 *          - Google: Generative AI SDK (Gemini)
 *          - OpenRouter/xAI: OpenAI SDK with custom base_url
 * SRP and DRY check: Pass - Package init only, exports main solve function.
"""

from solver.poetiq.solve import solve
from solver.poetiq.solve_parallel_coding import solve_parallel_coding
from solver.poetiq.types import ExpertConfig, ARCAGIResult, ARCAGISolution, RunResult

__all__ = [
    "solve",
    "solve_parallel_coding",
    "ExpertConfig",
    "ARCAGIResult",
    "ARCAGISolution",
    "RunResult",
]
