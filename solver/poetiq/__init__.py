"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Poetiq solver package - internalized from poetiq-solver submodule.
 *          This package implements iterative code generation for ARC puzzle solving.
 *          Uses litellm for multi-provider routing (faithful to original Poetiq).
 *          ENHANCED: Now captures token usage that original Poetiq discarded.
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
