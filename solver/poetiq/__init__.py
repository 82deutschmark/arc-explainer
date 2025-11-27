"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Poetiq solver package - internalized from poetiq-solver submodule.
 *          This package implements iterative code generation for ARC puzzle solving
 *          using direct Google Generative AI SDK (no litellm dependency).
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
