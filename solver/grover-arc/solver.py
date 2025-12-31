#!/usr/bin/env python3
"""
Clean, modular GPT-5 based ARC puzzle solver with sequential prompting strategy
"""

import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image
import numpy as np
import re

from gpt5_prompt import prompt_with_images, prompt_with_reasoning
from dsl_executor import execute_dsl_on_problem, ProblemExecutionResult, format_grid, log_execution_step
from normalize_colors import get_normalized_problem_text

from util import (
    create_log_directory,
    log_prompt,
    log_response,
    save_grid_image,
    load_problem,
    extract_first_training_pair,
    extract_second_training_pair,
    extract_first_test_input,
    get_pretty_printed_problem,
    grid_to_image,
    save_training_images,
    print_validation_result,
)

from prompts import (
    PROMPT_mini_analyzer,
    PROMPT_interconnection_finder,
    PROMPT_program_synth_with_feedback,
    PROMPT_summarize_attempt,
    DSL_EXAMPLES,
    PALETTE,
)


def prepare_training_feedback(execution_result: ProblemExecutionResult) -> str:
    """Prepare training feedback based on execution results."""
    feedback_parts = []

    for i in range(len(execution_result.train_outputs)):
        if execution_result.train_errors[i]:
            feedback_parts.append(f"Training example {i + 1} result: ERROR - {execution_result.train_errors[i]}")
        elif execution_result.train_outputs[i] == execution_result.train_expected[i]:
            feedback_parts.append(f"Training example {i + 1} result: CORRECT")
        else:
            feedback_parts.append(
                f"Training example {i + 1} result: INCORRECT\n"
                f"Generated:\n{format_grid(execution_result.train_outputs[i])}\n"
                f"Expected:\n{format_grid(execution_result.train_expected[i])}"
            )

    return "\n\n".join(feedback_parts)


def prepare_test_feedback(execution_result: ProblemExecutionResult) -> str:
    """Prepare test feedback based on execution results."""
    if execution_result.test_error:
        feedback = f"Test input result: ERROR - {execution_result.test_error}"
    elif execution_result.test_output:
        feedback = f"Test input generated output:\n{format_grid(execution_result.test_output)}"
    else:
        feedback = "Test input: No output generated"

    # Add debug output
    feedback += """
    **Think** about the correct output for the test input. Mentally run the puzzle rules and considerations over the test input grid and think about what the output should be and if the generated output matches. If it does not match, think about how best to update the program to handle the test input.
    """

    return feedback


def extract_grade(attempt: str) -> int:
    """Extract grade from attempt summary. Grade format: 'MARK ATTEMPT GRADE: X/10'"""
    match = re.search(r'MARK ATTEMPT GRADE:\s*(\d+)/10', attempt)
    return int(match.group(1)) if match else 0


def remove_low_scoring_attempts(log_dir: str, prev_attempts: List[str], max_removals: int = 8) -> List[str]:
    """Remove lowest scoring attempts (grade < 5/10), up to max_removals."""
    attempts_with_grades = [(attempt, extract_grade(attempt)) for attempt in prev_attempts]
    low_scoring = [(attempt, grade) for attempt, grade in attempts_with_grades if grade < 5]
    low_scoring.sort(key=lambda x: x[1])  # Sort by grade ascending (lowest first)

    attempts_to_remove = [attempt for attempt, _ in low_scoring[:max_removals]]  # Take up to max_removals
    filtered_attempts = [attempt for attempt in prev_attempts if attempt not in attempts_to_remove]

    if attempts_to_remove:
        print(f"[MARK REMOVE LOW SCORING] Removed {len(attempts_to_remove)} low-scoring attempts (grade < 6/10)")
        log_execution_step(
            log_dir, "[MARK REMOVE LOW SCORING]", 
            f"Removed {len(attempts_to_remove)} low-scoring attempts (grade < 6/10)"
        )

    return filtered_attempts


def main_solve_loop(problem_path: str, log_dir: str, prev_attempts: List[str], iteration: int) -> Tuple[List[str], bool]:
    """
    Runs one solve loop.

    Returns (previous attempts, test success)
    """

    problem = load_problem(problem_path)
    test_input = extract_first_test_input(problem)

    first_input_path = str(Path(log_dir) / "train_0_input.png")
    first_output_path = str(Path(log_dir) / "train_0_output.png")
    test_input_path = str(Path(log_dir) / "test_0_input.png")

    seed = ""
    images = []

    if iteration == 2:
        # Use normalized colors as supplemental input
        seed = get_normalized_problem_text(problem_path)

    if iteration == 3:
        # Add all training and test images
        for train_idx in range(len(problem['train'])):
            images.append(str(Path(log_dir) / f"train_{train_idx}_input.png"))
            images.append(str(Path(log_dir) / f"train_{train_idx}_output.png"))
        images.append(str(Path(log_dir) / "test_0_input.png"))
    
    max_iter = 3

    if iteration == 0 or iteration == 1 or iteration == 4:
        max_iter = 5

    for i in range(max_iter):
        if iteration == 1:
            print("\nStage 1: Mini Image Analyzer")
            mini_analyzer_result = PROMPT_mini_analyzer(first_input_path, first_output_path, test_input_path, log_dir)

            print("\nStage 2: Interconnection Finder")
            seed = PROMPT_interconnection_finder(mini_analyzer_result, problem_path, log_dir)

        # Do some runs without context to increase the chances of the model taking a different path/new approach. 
        # If we pass context, the model usually tries to base the next solution on that.
        # This introduces some amount of varience while still remembering all attempts so 
        # that they can be used/sorted in the future.
        if (i == 0 and iteration != 4) or (i == 1 and iteration != 4) or (i == 2 and iteration == 1):
            prev_attempts_str = ""
        else:
            prev_attempts_str = "\n\n=== Attempt ===\n".join([""] + prev_attempts)

        program = PROMPT_program_synth_with_feedback(
            prev_attempts_str, 
            seed, problem_path, log_dir, i, images
        )
        execution_result = execute_dsl_on_problem(program, problem_path, log_dir)

        training_feedback = prepare_training_feedback(execution_result)
        test_feedback = prepare_test_feedback(execution_result)
        full_feedback = f"Program:\n{program}\n\n{training_feedback}\n\n{test_feedback}"

        summary = PROMPT_summarize_attempt(full_feedback, problem_path, log_dir)

        prev_attempts.append(summary)

        # Sort prev_attempts by grade (lowest first, highest last)
        prev_attempts.sort(key=extract_grade)

        if execution_result.test_matches:
            print_validation_result(True, problem_path)
            return (prev_attempts, True)

        # Check if we have two 10/10 grades - exit early
        perfect_scores = [attempt for attempt in prev_attempts if extract_grade(attempt) == 10]
        if len(perfect_scores) >= 2:
            print("[EARLY EXIT] Found 2 attempts with 10/10 grade")
            print_validation_result(False, problem_path)
            # Incorrectly return True to prevent further iteration
            return (prev_attempts, True)

    return (prev_attempts, False)


def solve_problem(problem_path: str) -> str:
    """Main orchestration function to solve an ARC problem."""
    problem = load_problem(problem_path)
    log_dir = create_log_directory(problem_path)
    
    print(f"Solving problem: {problem_path}")
    print(f"Log directory: {log_dir}")
    
    saved_images = save_training_images(problem, log_dir)
    print(f"Saved {len(saved_images)} images")

    prev_attempts = []
    num_iterations = 5
    
    for iteration in range(num_iterations):
        if iteration == num_iterations - 1:
            # Remove lowest scoring attempts before final iteration
            prev_attempts = remove_low_scoring_attempts(log_dir, prev_attempts)

        print("=" * 80)
        print(f"MAIN SOLVE RUN {iteration + 1} - STARTING")
        print("=" * 80)
        print(f"Previous attempts count: {len(prev_attempts)}")
        print("=" * 80)

        prev_attempts, test_passed = main_solve_loop(problem_path, log_dir, prev_attempts, iteration)
        if test_passed:
            return

    print_validation_result(False, problem_path)


def main():
    """Main entry point."""
    if len(sys.argv) != 2:
        print("Usage: python solver.py <problem.json>")
        sys.exit(1)
    
    problem_path = sys.argv[1]
    
    if not os.path.exists(problem_path):
        print(f"Error: File not found: {problem_path}")
        sys.exit(1)
    
    try:
        solve_problem(problem_path)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
