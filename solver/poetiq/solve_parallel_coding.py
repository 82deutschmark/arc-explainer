"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Parallel expert solving and voting for Poetiq solver.
 *          Runs multiple coding experts concurrently and aggregates results.
 * SRP and DRY check: Pass - Parallel orchestration and voting only.
 * Source: Internalized from poetiq-solver/arc_agi/solve_parallel_coding.py
"""

import asyncio

import numpy as np

from solver.poetiq.solve_coding import solve_coding
from solver.poetiq.types import ARCAGIResult, ExpertConfig
from solver.poetiq.utils import canonical_test_key


async def solve_parallel_coding(
    *,
    train_in: list[list[list[int]]],
    train_out: list[list[list[int]]],
    test_in: list[list[list[int]]],
    expert_configs: list[ExpertConfig],
    problem_id: str | None = None,
) -> list[ARCAGIResult]:
    """
    Run multiple coding experts in parallel, group by identical test outputs, then rank.
    
    This implements Poetiq's "voting" system where multiple expert configurations
    run independently and their results are aggregated by consensus.
    
    Args:
        train_in: List of training input grids
        train_out: List of training output grids (ground truth)
        test_in: List of test input grids
        expert_configs: List of ExpertConfig dicts, one per expert
        problem_id: Optional identifier for logging
    
    Returns:
        List of ARCAGIResult, ordered by vote count (most popular first)
    """
    use_new_voting = expert_configs[0]["use_new_voting"]
    count_failed_matches = expert_configs[0]["count_failed_matches"]
    iters_tiebreak = expert_configs[0]["iters_tiebreak"]
    low_to_high_iters = expert_configs[0]["low_to_high_iters"]

    for it, cfg in enumerate(expert_configs):
        # Ensure each config gets a separate sequence of seeds. The code_solver
        # adds the current iteration to the seed at each iteration, so this
        # guarantees that each iteration of each code_solver gets a different
        # seed, assuming the configs all start with an identical seed.
        cfg["seed"] += it * cfg["max_iterations"]

    # Solve concurrently
    tasks = [
        asyncio.create_task(
            solve_coding(
                train_in=train_in,
                train_out=train_out,
                test_in=test_in,
                config=cfg,
                problem_id=problem_id,
            )
        )
        for cfg in expert_configs
    ]
    results: list[ARCAGIResult] = await asyncio.gather(*tasks)

    # Buckets
    candidate_buckets: dict[str, list[ARCAGIResult]] = {}
    failure_buckets: dict[str, list[ARCAGIResult]] = {}

    for res in results:
        is_passer = all(rr.get("success", False) for rr in res.get("train_results", []))
        key = canonical_test_key(res.get("results", []))
        if is_passer:
            candidate_buckets.setdefault(key, []).append(res)
        else:
            failure_buckets.setdefault(key, []).append(res)

    if use_new_voting:
        # Optionally merge failures into passers if outputs match
        if count_failed_matches:
            for k in list(failure_buckets.keys()):
                if k in candidate_buckets:
                    candidate_buckets[k].extend(failure_buckets[k])
                    del failure_buckets[k]

        # ---- Passers: sort by vote count desc; diversity-first ----
        passer_groups: list[list[ARCAGIResult]] = list(candidate_buckets.values())

        if iters_tiebreak:
            # Put the lowest (if low_to_high_iters) iterations in position 0 of each sublist.
            passer_groups = [
                sorted(ps, key=lambda x: x['iteration'], reverse=not low_to_high_iters) for ps in passer_groups
            ]
            # Sort the list by min iterations, highest to lowest, so after the last sort below it is lowest to highest.
            passer_groups = sorted(passer_groups, key=lambda x: x[0]['iteration'], reverse=low_to_high_iters)

        # Sort passers by how many votes they have.
        passer_groups = sorted(passer_groups, key=len, reverse=True)

        ordered: list[ARCAGIResult] = []
        # one per group for diversity
        ordered.extend([grp[0] for grp in passer_groups if grp])

        # ---- Failures: grouped + ranked ----
        # within each failure group, best first by mean soft_score desc
        for fs in failure_buckets.values():
            fs.sort(key=_mean_soft, reverse=True)

        failure_groups: list[list[ARCAGIResult]] = list(failure_buckets.values())
        # Sort groups: votes (desc), tie-break by best member's mean soft_score (desc)
        failure_groups.sort(
            key=lambda fs: (len(fs), _mean_soft(fs[0]) if fs else 0.0),
            reverse=True,
        )

        # diversity-first over failure groups
        ordered.extend([fs[0] for fs in failure_groups if fs])
        # remaining passer members
        ordered.extend([m for grp in passer_groups for m in grp[1:]])
        # remaining failure members
        ordered.extend([m for fs in failure_groups for m in fs[1:]])

        return ordered

    else:
        # ---- Old mode ----
        # Passers by vote desc
        passer_groups: list[list[ARCAGIResult]] = sorted(
            candidate_buckets.values(), key=len, reverse=True
        )

        firsts = [grp[0] for grp in passer_groups if grp]

        # Failures are flat, sorted by mean soft_score desc
        failed_flat: list[ARCAGIResult] = [
            r for fs in failure_buckets.values() for r in fs
        ]
        failed_sorted = sorted(failed_flat, key=_mean_soft, reverse=True)

        rest = [m for grp in passer_groups for m in grp[1:]]

        return firsts + failed_sorted + rest


def _mean_soft(res: ARCAGIResult) -> float:
    """Calculate mean soft score across training results."""
    trs = res.get("train_results", [])
    if not trs:
        return 0.0
    return float(np.mean([rr.get("soft_score", 0.0) for rr in trs]))
