#!/usr/bin/env python3
"""
Batch runner for executing multiple ARC problems in parallel.
Uses random_problems.py to select problems and runs them across multiple workers.
"""

import os
import sys
import argparse
import subprocess
import concurrent.futures
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional
import time
import random

def run_single_problem(problem_path: str, worker_id: int) -> Tuple[str, bool, str]:
    """
    Run solver.py on a single problem.
    Returns (problem_path, success, result_message)
    """
    problem_name = Path(problem_path).stem
    print(f"[Worker {worker_id}] Starting: {problem_name}")
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            ['python3', 'solver.py', problem_path],
            capture_output=True,
            text=True,
            timeout=24000  # 400 minute timeout per problem
        )
        
        elapsed = time.time() - start_time
        
        # Check for success/failure in output
        output = result.stdout
        success = "✅ SUCCESS" in output
        
        if success:
            message = f"SUCCESS in {elapsed:.1f}s"
        elif "❌ FAIL" in output:
            message = f"FAILED validation in {elapsed:.1f}s"
        else:
            message = f"ERROR: {result.stderr[:80] if result.stderr else 'Unknown error'}"
            print("Unkown error: dumping stdout")
            print(result.stdout[:3000])
            success = False
            
        print(f"[Worker {worker_id}] Completed {problem_name}: {message}")
        return (problem_path, success, message)
        
    except subprocess.TimeoutExpired:
        message = "TIMEOUT (>400min)"
        print(f"[Worker {worker_id}] Timeout {problem_name}: {message}")
        return (problem_path, False, message)
        
    except Exception as e:
        message = f"ERROR: {str(e)[:100]}"
        print(f"[Worker {worker_id}] Error {problem_name}: {message}")
        return (problem_path, False, message)


def get_problem_paths(count: int, include: Optional[str], exclude: Optional[str], 
                     dataset: Optional[str], seed: Optional[int]) -> List[str]:
    """Get problem paths using random_problems.py"""
    cmd = ['python3', 'random_problems.py', str(count)]
    
    if include:
        cmd.extend(['--include', include])
    
    if exclude:
        cmd.extend(['--exclude', exclude])
    
    if dataset:
        cmd.extend(['--dataset', dataset])
    
    if seed is not None:
        cmd.extend(['--seed', str(seed)])
    
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    
    paths = []
    for line in result.stdout.strip().split('\n'):
        if line:
            paths.append(line)
    
    return paths


def print_summary(results: List[Tuple[str, bool, str]]) -> None:
    """Print a summary of the batch run."""
    total = len(results)
    successful = sum(1 for _, success, _ in results if success)
    failed = total - successful
    
    print("\n" + "="*60)
    print("BATCH RUN SUMMARY")
    print("="*60)
    print(f"Total problems: {total}")
    print(f"✅ Successful: {successful} ({100*successful/total:.1f}%)")
    print(f"❌ Failed: {failed} ({100*failed/total:.1f}%)")
    
    if successful > 0:
        print("\nSuccessful problems:")
        for problem_path, success, message in results:
            if success:
                print(f"  - {Path(problem_path).stem}: {message}")
    
    if failed > 0:
        print("\nFailed problems:")
        for problem_path, success, message in results:
            if not success:
                print(f"  - {Path(problem_path).stem}: {message}")


def main():
    parser = argparse.ArgumentParser(
        description='Run multiple ARC problems in parallel using random selection'
    )
    parser.add_argument('count', type=int, help='Number of problems to run')
    parser.add_argument('-w', '--workers', type=int, default=4,
                       help='Number of parallel workers (default: 4)')
    parser.add_argument('--include', type=str,
                       help='Comma-separated list of problem hashes to include')
    parser.add_argument('--exclude', type=str,
                       help='Comma-separated list of problem hashes to exclude')
    parser.add_argument('--dataset', choices=['training', 'evaluation'],
                       help='Select only from training or evaluation dataset')
    parser.add_argument('--seed', type=int,
                       help='Random seed for reproducible problem selection')
    
    args = parser.parse_args()
    
    # Get problem paths
    print(f"Selecting {args.count} random problems...")
    if args.dataset:
        print(f"Dataset: {args.dataset}")
    if args.include:
        print(f"Including: {args.include}")
    if args.exclude:
        print(f"Excluding: {args.exclude}")
    
    try:
        problem_paths = get_problem_paths(
            args.count, args.include, args.exclude, args.dataset, args.seed
        )
    except subprocess.CalledProcessError as e:
        print(f"Error getting problem paths: {e.stderr}")
        sys.exit(1)
    
    if not problem_paths:
        print("No problems found matching criteria")
        sys.exit(1)
    
    print(f"Selected {len(problem_paths)} problems")

    # Shuffle the problem paths
    random.shuffle(problem_paths)
    print("Shuffled problem order")

    # Print comma-separated list of problem hashes
    problem_hashes = [Path(p).stem for p in problem_paths]
    print(f"Order: {', '.join(problem_hashes)}")

    print(f"Using {args.workers} parallel workers")
    print("\n" + "="*60)
    print("STARTING BATCH RUN")
    print("="*60 + "\n")

    # Run problems in parallel
    results = []
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        # Create future to problem mapping
        future_to_problem = {}
        
        for i, problem_path in enumerate(problem_paths):
            worker_id = i % args.workers + 1
            future = executor.submit(run_single_problem, problem_path, worker_id)
            future_to_problem[future] = problem_path
        
        # Collect results as they complete
        for future in concurrent.futures.as_completed(future_to_problem):
            result = future.result()
            results.append(result)
    
    total_time = time.time() - start_time
    
    # Print summary
    print_summary(results)
    print(f"\nTotal execution time: {total_time:.1f} seconds")
    print(f"Average time per problem: {total_time/len(results):.1f} seconds")


if __name__ == "__main__":
    main()