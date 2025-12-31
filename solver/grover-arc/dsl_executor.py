#!/usr/bin/env python3
"""
DSL Executor for ARC puzzles
Executes DSL programs on input grids using GPT-5 translation
"""

import json
import os
import subprocess
import concurrent.futures
import io
import contextlib
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Union, Tuple, Container, Callable, FrozenSet, Iterable
from PIL import Image
import numpy as np
import sys

# Add arc-dsl to path and import
arc_dsl_path = str(Path(__file__).parent / 'arc-dsl')
if arc_dsl_path not in sys.path:
    sys.path.insert(0, arc_dsl_path)

from dsl import *
from constants import *

from gpt5_prompt import prompt_with_reasoning, prompt_with_image_and_reasoning


PALETTE = {
    0: (0, 0, 0),        # black
    1: (0, 116, 217),    # blue
    2: (255, 65, 54),    # red
    3: (46, 204, 64),    # green
    4: (255, 220, 0),    # yellow
    5: (255, 133, 27),   # orange
    6: (240, 18, 190),   # pink
    7: (177, 13, 201),   # dark red/purple
    8: (133, 20, 75),    # maroon
    9: (0, 176, 255),    # light blue
}

EXECUTE_DSL_PROMPT = """
I have the following DSL that I'd like you to make a python program for.

REQUIRED OUTPUT:
* Define **exactly**: `def program(g: List[List[int]]) -> List[List[int]]:`
* Use only the standard library. **No I/O**, no `__main__`, no demo code.
* Make sure the program matches the semantics and expected behavior of the DSL.
* Output the program as text.

Other considerations:
* A sample of inputs and outputs is provided in a pretty printed format below.
* This is every input that the program will be run on.
* The program should produce the exact sample transform and other generalized inputs as specified by the DSL.
* Follow the DSL and extrapolate as needed to represent the abstract instructions specified by the DSL.

IMPORTANT: Output ONLY the program, no explanations or other text.
"""


def get_color_char(color_id: int) -> str:
    """Return a character representation for each color."""
    color_chars = {
        0: '0',  # black/background
        1: '1',  # blue
        2: '2',  # red
        3: '3',  # green
        4: '4',  # yellow
        5: '5',  # orange
        6: '6',  # pink
        7: '7',  # dark red
        8: '8',  # maroon
        9: '9',  # light blue
    }
    return color_chars.get(color_id, '?')


def get_pretty_printed_problem(problem_path: str) -> str:
    """Get pretty printed version of problem using pretty_print_json.py."""
    result = subprocess.run(
        ['python3', 'pretty_print_json.py', problem_path, '--no-test-output'],
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout

def get_color_name(color_id: int) -> str:
    """Return the color name for display."""
    color_names = {
        0: "black",
        1: "blue",
        2: "red",
        3: "green",
        4: "yellow",
        5: "orange",
        6: "pink",
        7: "dark red",
        8: "maroon",
        9: "light blue"
    }
    return color_names.get(color_id, f"color_{color_id}")


def format_grid(grid: List[List[int]]) -> str:
    """Format a grid for display."""
    return '\n'.join(['[' + ', '.join(str(cell) for cell in row) + ']' for row in grid])


def format_grid_with_legend(grid: List[List[int]]) -> str:
    """Format a grid with color legend for display."""
    lines = []
    
    # Add the numerical array
    lines.append("Numerical array:")
    for row in grid:
        lines.append('[' + ', '.join(str(cell) for cell in row) + ']')
    
    # Add color legend
    unique_colors = set()
    for row in grid:
        unique_colors.update(row)
    
    if unique_colors:
        lines.append("\nColors present:")
        for color in sorted(unique_colors):
            lines.append(f"  {get_color_char(int(color))} = {get_color_name(int(color))}")
    
    return '\n'.join(lines)


def save_grid_image(grid: List[List[int]], log_dir: str, name: str) -> None:
    """Save a grid as a PNG image."""
    grid_array = np.array(grid)
    height, width = grid_array.shape
    cell_size = 30
    
    rgb_image = np.zeros((height * cell_size, width * cell_size, 3), dtype=np.uint8)
    
    for y in range(height):
        for x in range(width):
            color_id = int(grid_array[y, x])
            color = PALETTE.get(color_id, (128, 128, 128))
            rgb_image[y*cell_size:(y+1)*cell_size, x*cell_size:(x+1)*cell_size] = color
    
    img = Image.fromarray(rgb_image)
    img.save(Path(log_dir) / name)


def log_execution_step(log_dir: str, step_name: str, content: str) -> None:
    """Log an execution step to the log file."""
    log_file = Path(log_dir) / "log.txt"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(log_file, "a") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"=== {step_name} ===\n")
        f.write(f"[{timestamp}] {content}\n\n")


def translate_dsl_to_python(dsl_program: str, problem_path: str, log_dir: str) -> str:
    """Translate a DSL program to Python using GPT-5."""
    # Use existing test_0_input.png from log directory
    test_image_path = str(Path(log_dir) / "test_0_input.png")

    pretty_problem = get_pretty_printed_problem(problem_path)
    prompt = EXECUTE_DSL_PROMPT + f"\n\nDSL Program:\n{dsl_program}\n\nSample Inputs and Outputs:\n{pretty_problem}"

    log_execution_step(log_dir, "DSL Translation Request (PROMPT)", prompt)

    try:
        python_code = prompt_with_image_and_reasoning(prompt, test_image_path, "high")
        log_execution_step(log_dir, "DSL Translation Response", f"Generated Python Code:\n{python_code}")
        return python_code
    except Exception as e:
        error_msg = f"Translation failed: {str(e)}"
        log_execution_step(log_dir, "DSL Translation Error", error_msg)
        raise ValueError(error_msg)


def execute_python_on_grid(python_code: str, input_grid: List[List[int]], log_dir: str) -> Dict[str, Any]:
    """Execute Python code on an input grid."""
    try:
        # Add common imports as prefix
        # Create exec namespace with all globals (includes dsl and constants)
        exec_namespace = dict(globals())

        exec(python_code, exec_namespace)
        
        if 'program' not in exec_namespace:
            error_msg = "Generated code does not contain 'program' function"
            log_execution_step(log_dir, "Execution Error", error_msg)
            return {'success': False, 'error': error_msg}
        
        program_func = exec_namespace['program']

        # Capture stdout during program execution
        stdout_capture = io.StringIO()

        def run_program_with_capture():
            with contextlib.redirect_stdout(stdout_capture):
                return program_func(input_grid)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(run_program_with_capture)
            try:
                result = future.result(timeout=120)
            except concurrent.futures.TimeoutError:
                error_msg = "Execution timed out after 2 minutes"
                log_execution_step(log_dir, "Execution Error", error_msg)
                return {'success': False, 'error': error_msg}

        # Get captured stdout
        debug_output = stdout_capture.getvalue()

        if result and isinstance(result, list) and all(isinstance(row, list) for row in result):
            log_execution_step(log_dir, "Execution Success", f"Generated output grid:\n{format_grid(result)}")
            return {'success': True, 'output': result, 'debug': debug_output}
        else:
            error_msg = f"Program returned invalid grid format: {type(result)}"
            log_execution_step(log_dir, "Execution Error", error_msg)
            return {'success': False, 'error': error_msg, 'debug': debug_output}
            
    except Exception as e:
        error_msg = f"Execution error: {str(e)}"
        log_execution_step(log_dir, "Execution Error", error_msg)
        return {'success': False, 'error': error_msg}


def load_problem(problem_path: str) -> Dict:
    """Load an ARC problem from JSON file."""
    with open(problem_path, 'r') as f:
        return json.load(f)


def get_first_test_input(problem: Dict) -> List[List[int]]:
    """Extract the first test input from the problem."""
    if 'test' not in problem or len(problem['test']) == 0:
        raise ValueError("No test examples found in problem")
    return problem['test'][0]['input']

def save_python_program(python_code: str, log_dir: str) -> None:
    """Save the generated Python program to the log directory."""
    timestamp = datetime.now().strftime("%H%M%S")
    program_file = Path(log_dir) / f"generated_program_{timestamp}.py"
    with open(program_file, "w") as f:
        f.write(python_code)
    log_execution_step(log_dir, "Program Saved", f"Python program saved to: {program_file}")

def get_next_file_suffix(log_dir: str) -> int:
    """Get the next available file suffix based on existing files in the directory."""
    log_path = Path(log_dir)
    existing_files = list(log_path.glob("*.png"))
    return len(existing_files)


class ProblemExecutionResult:
    """Container for DSL execution results on training and test samples."""
    def __init__(self):
        self.train_outputs = []  # List of output grids
        self.train_expected = []  # List of expected grids
        self.train_errors = []   # List of error messages
        self.train_summaries = []    # List of debug outputs from program execution
        self.test_output = None  # Test output grid
        self.test_expected = None  # Test expected grid (if available)
        self.test_error = None   # Test error message
        self.test_summary = None   # Debug output from test execution
        self.all_train_matches = False  # Whether all training samples match
        self.training_matches_count = 0
        self.test_matches = False  # Whether test matches expected


def save_sample_images(grid_input: List[List[int]], grid_output: Optional[List[List[int]]],
                      grid_expected: Optional[List[List[int]]], sample_type: str,
                      index: int, log_dir: str) -> None:
    """Save input, output, and expected images for a sample."""
    # Save input
    file_suffix = get_next_file_suffix(log_dir)
    input_filename = f"{sample_type}_input_{index}_{file_suffix}.png"
    save_grid_image(grid_input, log_dir, input_filename)

    # Save expected if available
    if grid_expected is not None:
        file_suffix = get_next_file_suffix(log_dir)
        expected_filename = f"{sample_type}_expected_{index}_{file_suffix}.png"
        save_grid_image(grid_expected, log_dir, expected_filename)

    # Save output prediction if available - this may fail if program generated invalid grid
    if grid_output is not None:
        try:
            file_suffix = get_next_file_suffix(log_dir)
            output_filename = f"{sample_type}_prediction_{index}_{file_suffix}.png"
            save_grid_image(grid_output, log_dir, output_filename)
        except Exception as e:
            log_execution_step(log_dir, "Image Save Error",
                             f"Failed to save output image for {sample_type} {index}: {str(e)}")


def execute_dsl_on_problem(dsl_program: str, problem_path: str, log_dir: str) -> ProblemExecutionResult:
    """Execute DSL program on all training samples and one test sample.

    Returns:
        ProblemExecutionResult object containing all outputs and errors
    """
    result = ProblemExecutionResult()

    # Load problem
    problem = load_problem(problem_path)

    # Convert DSL to Python once, using all training examples for context
    python_code = dsl_program # translate_dsl_to_python(dsl_program, problem_path, log_dir)
    save_python_program(python_code, log_dir)

    # Strip markdown code block markers if present
    lines = python_code.strip().split('\n')
    if lines and lines[0].strip().startswith('```'):
        lines = lines[1:]
    if lines and lines[-1].strip() == '```':
        lines = lines[:-1]
    python_code = '\n'.join(lines)

    # Process all training samples
    train_matches = []
    for i in range(len(problem['train'])):
        train_input = problem['train'][i]['input']
        train_expected = problem['train'][i]['output']

        # Execute using the prepared Python code
        train_output, train_error, train_debug = execute_dsl_on_grid(python_code, train_input, log_dir)

        # Save images
        save_sample_images(train_input, train_output, train_expected, "train", i, log_dir)

        # Store results
        result.train_outputs.append(train_output)
        result.train_expected.append(train_expected)
        result.train_errors.append(train_error)

        # Check match
        matches = train_output == train_expected
        train_matches.append(matches)
        log_execution_step(log_dir, f"Training {i} Comparison", f"Matches expected: {matches}")

    # Check if all training samples match
    result.all_train_matches = all(train_matches)
    result.training_matches_count = sum(train_matches)

    # Process test sample
    test_input = problem['test'][0]['input']
    test_expected = problem['test'][0].get('output')

    # Execute using the prepared Python code
    test_output, test_error, test_debug = execute_dsl_on_grid(python_code, test_input, log_dir)

    # Save images
    save_sample_images(test_input, test_output, test_expected, "test", 0, log_dir)

    # Store results
    result.test_output = test_output
    result.test_expected = test_expected
    result.test_error = test_error
    result.test_matches = test_output == test_expected

    # Log summary
    log_execution_step(log_dir, "Execution Summary",
                      f"All training matches: {result.all_train_matches}\n"
                      f"Test matches: {result.test_matches}")

    return result


def execute_dsl_on_grid(python_code: str, input_grid: List[List[int]], log_dir: str) -> tuple[Optional[List[List[int]]], Optional[str], str]:
    """Execute Python code on a given input grid. Returns (output_grid, error_message, debug_output)."""
    try:
        log_execution_step(log_dir, "Execution Start",
                          f"Executing on input grid:\n{format_grid(input_grid)}")

        result = execute_python_on_grid(python_code, input_grid, log_dir)

        debug_output = result.get('debug', '')

        if result['success']:
            output_grid = result['output']
            return output_grid, None, debug_output
        else:
            log_execution_step(log_dir, "Execution Failed", f"Error: {result['error']}")
            return None, result['error'], debug_output

    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        log_execution_step(log_dir, "Execution Failed", error_msg)
        return None, error_msg, ""
