import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image
import numpy as np

from gpt5_prompt import prompt_with_images, prompt_with_reasoning, prompt_with_multiple_images_and_reasoning
from dsl_executor import execute_dsl_on_problem, ProblemExecutionResult

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
)

# Global ARC color palette
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

DSL_EXAMPLES = """
Output a python program to solve this puzzle. Avoid nested loops and nested control flow. Create one function per transformation, rule, or observation. Make sure each function is self contained. Do not output a monolithic program, instead output a program that composes individual rules. Make sure each function clearly describes what observation or rule it is handling.

REQUIRED OUTPUT:
* Define **exactly**: `def program(g: List[List[int]]) -> List[List[int]]:`
* Use only the standard library. **No I/O**, no `__main__`, no demo code.
* Output the program as text.

Other considerations:
* A sample of inputs and outputs is provided in a pretty printed format.
* This is every input that the program will be run on. 
* IMPORTANT: pay special attention to the TEST input, this is the only one that will be scored. The train inputs are just for reference.
"""


def PROMPT_mini_analyzer(input_img: str, output_img: str, test_img: str, log_dir: str) -> str:
    """Stage 1: Mini Image Analyzer with low reasoning."""
    prompt = "Succinctly describe all elements in this visual puzzle as one bullet list, generalized over both input and output."

    # prompt = "Succinctly describe all elements in this visual puzzle as one bullet list, generalized over both input and output or concatonate descriptions of both, depending on what makes sense and is consistent. Call out specific shapes and elements that you see. Be specific, complete, and succinct. Do not attempt to understand the transformation. Do not draw connections. Just enumerate the elements present. Give semantics and detailed descriptions (looks like a key, looks like a grid, looks like a cross). Elements may not be consistent across inputs and outputs, if this is the case, enumerate and describe elements in both."

    log_prompt(log_dir, "Stage 1: Mini Image Analyzer",
               f"Prompt: {prompt}\nInput image: {input_img}\nOutput image: {output_img}\nTest image: {test_img}")

    response = prompt_with_multiple_images_and_reasoning(prompt, [input_img, output_img, test_img], "medium", 0)

    log_response(log_dir, response)
    return response


def PROMPT_interconnection_finder(description: str, problem_path: str, log_dir: str) -> str:
    """Stage 2: Interconnection Finder with medium reasoning."""
    result = subprocess.run(
        ['python3', 'image_analyzer.py', problem_path, '-m', '--no-test-output'],
        capture_output=True,
        text=True,
        check=True
    )
    image_analysis = result.stdout

    # You may need to consider objects around each other, for example, groups that pull each other together (transform), or groupings that influence color. There may be compositional elements, for example, one element is placed which effects how the next element is placed. Objects may be grouped together to produce shapes with semantic meaning.

    # Attempt to connect the visual description to the specific elements that you have concrete information about, this is the only way you will be able to identify higher-level semantic meaning for complex shapes (stars, crosses, etc.).
    
    prompt = f"""This is a visual puzzle. Don't try to solve it. Just interconnected components. What to identify: elements that interact with each other or effect each other. This could be shapes that seem to have some connection or interaction, colors that effect movement, shapes properties (edges, holes, or silhouettes) that effect movement, position effects transformation or movement. We want a list of interconnected properties and components. What we DON'T want: a total solution, high level understanding, etc. What we DON'T want: elements that are irrelevant to the puzzle. Elements that do not have any interaction or connection. Elements that don't have consistent interaction across all examples. Only identify interactions or connections that are consistent in EVERY puzzle.

Any property may be used to find connections: position -> color, position -> position, hole count -> color, specific shape -> transform, and so on.

IMPORTANT: some shapes or semantic meaning may not be identifiable given the information provided, do not force connections that are not there. Do not attempt to solve this problem. Your job is only to identify connections that are obvious and consistent, if you cannot explain a transformation, call that out as an unkown rather than trying to explain it.

{description}

{image_analysis}"""
    
    log_prompt(log_dir, "Stage 2: Interconnection Finder", prompt)
    
    response = prompt_with_reasoning(prompt, "medium", 0)
    
    log_response(log_dir, response)
    return response


def PROMPT_program_synth_with_feedback(prev_dsl: str, extra_info: str, problem_path: str, log_dir: str, iter: int, images: List[str]) -> str:
    """Intermediate phase: DSL Generator based on training data feedback."""
    pretty_print = get_pretty_printed_problem(problem_path)

    prompt = f"""You are trying to build a program to solve this puzzle. The puzzle is presented as a set of inputs and outputs. Your job is to 1) infer the rules of the puzzle and how to generate the correct output for any given input based on these pairs and 2) a program that represents these rules and can be applied to any of the train or test inputs.

Here is a summary of previous attempts:
{prev_dsl}

Unlike the training pairs, there is no test output to compare against, so THINK about if the generated output above makes sense and looks valid. If the test output does not look valid, make sure to update the program, specifying how to produce the correct test output.

Based on this feedback, refine your program. Think about what worked and what didn't, then output an NEW and IMPROVED program. You will get many attempts to generate programs, so try NEW approaches, different from the previously generated programs. Be creative. Try out of the box approaches. Test things that you think might work.

{pretty_print}

{extra_info}

{DSL_EXAMPLES}

IMPORTANT: only output the program, do not output anything else, do not output any reasoning or explanation.
"""

    log_prompt(log_dir, f"Stage Python Generator With Feedback)", prompt)

    response = prompt_with_multiple_images_and_reasoning(prompt, images, "high", min(1.0, 0.3 * iter))

    log_response(log_dir, response)
    return response

def PROMPT_summarize_attempt(prev_attempts: str, problem_path: str, log_dir: str) -> str:
    """Intermediate phase: DSL Generator based on training data feedback."""
    pretty_print = get_pretty_printed_problem(problem_path)

    prompt = f"""We are working on a visual puzzle. Your task is to summarize the last submission, talk about what worked, and what didn't in an effort to find the correct solution.

You previously generated the following program which generated the following outputs:
{prev_attempts}

YOUR TASK: summarize the above attempts, summarize what worked, and what did not work. Summarize the problem as you understand it. Call out the high level puzzle rules as well as subtle elements of the puzzle that are easy to miss. Include all considerations across all attempts. Include helpful functions from attempts, such as functions to extract objects. 

IMPORTANT: Be specific and list the observe effects (what was generated) and how they are different from what you expected. It's okay to say you don't know why something is different, but make sure to note that it IS different.

You can include unhelpful functions, so that we don't use them in future attempts. Make sure to make it clear when a function is either broken or not helpful to the problem.

IMPORTANT: look at the generated test outputs. The generated test outputs are the MOST IMPORTANT. Do the test outputs make sense? Do they look correct? If they do not look correct, explain why they are not correct.

IMPORTANT: grade this attempt at the end. You must match the grading format EXACTLY: "MARK ATTEMPT GRADE: 10/10". 

Grading is always out of 10. A perfect score means that the training samples all passed and the test makes sense. A 0/10 should be a complete lack of understanding of the problem. Grade harshly, if the problem understanding is not demonstrated, give a low or 0 score. If the problem is partially understood (only some elements are understood), still give a lower score around 3/10. Only give a score above 5/10 if core elements are understood OR some training samples pass. Only give a high score (above 7/10) if core principles are demonstrated AND some training samples pass.

OUTPUT FORMAT: Below is an example of what you should output. Make sure to include every section. Follow this format exactly.

============= EXAMPLE OUTPUT =============
**High level:** this is a puzzle that... (one-two sentences)

**Details, subtleties, key considerations:**
 * Omit objects that...
 * Make sure you match....
 * And so on...

**Helpful functions, types, and tools:**
```python
class PuzzleElement:
    def __init__(self):
        self.hole_count = ...
```

```python
def extract_objects(g: List[List[int]]) -> PuzzleElement:
    return ...
```

**Previous attempts:**
 * Missed ommission of objects with hole count not in key
 * Consider problems where key component does not stretch across the entire grid
 * Missed X
 * extract_objects is essential for Y
 * Train 1 omitted the devider bar
 * Train 1 mismatches blob shape for unkown reason (it's okay to say it's unknown)
 * Function `extract_objects` is incorrect or not relevant to the puzzle (don't use it in the future)

**Test output:**
 * The test output does not look correct in any attempt
 * The test output is missing X and Y
 * Make sure to account for keys with ... to handle test case

 MARK ATTEMPT GRADE: X/10
"""
    
    log_prompt(log_dir, f"Stage DSL Extrapolate)", prompt)
    
    response = prompt_with_reasoning(prompt, "high", 0)
    
    log_response(log_dir, response)
    return response
