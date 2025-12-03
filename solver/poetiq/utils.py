"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Utility functions for Poetiq solver.
 * SRP and DRY check: Pass - Single utility function.
 * Source: Internalized from poetiq-solver/arc_agi/utils.py
"""

from solver.poetiq.types import RunResult


def canonical_test_key(results: list[RunResult]) -> str:
    """Create a canonical key from test results for grouping/voting."""
    return str([r["output"] for r in results])
