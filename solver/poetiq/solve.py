"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Main entry point for Poetiq solver.
 *          Provides simple solve() function that uses default configuration.
 * SRP and DRY check: Pass - Entry point only, delegates to solve_parallel_coding.
 * Source: Internalized from poetiq-solver/arc_agi/solve.py
"""

from solver.poetiq.config import CONFIG_LIST
from solver.poetiq.solve_parallel_coding import solve_parallel_coding
from solver.poetiq.types import ARCAGIResult


async def solve(
    train_in: list[list[list[int]]],
    train_out: list[list[list[int]]],
    test_in: list[list[list[int]]],
    problem_id: str | None = None,
) -> list[ARCAGIResult]:
    """
    Solve an ARC puzzle using the Poetiq iterative code generation approach.
    
    This is the main entry point that uses the default CONFIG_LIST.
    For custom configurations, call solve_parallel_coding directly.
    
    Args:
        train_in: List of training input grids
        train_out: List of training output grids (ground truth)
        test_in: List of test input grids
        problem_id: Optional identifier for logging
    
    Returns:
        List of ARCAGIResult, ordered by vote count (best predictions first)
    """
    result = await solve_parallel_coding(
        train_in=train_in,
        train_out=train_out,
        test_in=test_in,
        expert_configs=[cfg.copy() for cfg in CONFIG_LIST],
        problem_id=problem_id,
    )

    return result
