import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image
import numpy as np

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

def create_log_directory(problem_filename: str) -> str:
    """Create a unique log directory for this problem run."""
    problem_hash = Path(problem_filename).stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = Path("logs") / problem_hash / timestamp
    log_dir.mkdir(parents=True, exist_ok=True)
    return str(log_dir)


def log_prompt(log_path: str, prompt_name: str, content: str) -> None:
    """Log a prompt to the log file."""
    log_file = Path(log_path) / "log.txt"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(log_file, "a") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"=== {prompt_name} ===\n")
        f.write(f"[{timestamp}] Prompt:\n")
        f.write(content)
        f.write("\n\n")


def log_response(log_path: str, response: str) -> None:
    """Log a response to the log file."""
    log_file = Path(log_path) / "log.txt"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(log_file, "a") as f:
        f.write(f"[{timestamp}] Response:\n")
        f.write(response)
        f.write("\n\n")


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


def load_problem(file_path: str) -> Dict:
    """Load an ARC problem from JSON file."""
    with open(file_path, 'r') as f:
        return json.load(f)


def extract_first_training_pair(problem: Dict) -> Tuple[List, List]:
    """Extract the first training input/output pair."""
    if 'train' not in problem or len(problem['train']) == 0:
        raise ValueError("No training examples found in problem")
    
    first_train = problem['train'][0]
    return first_train['input'], first_train['output']


def extract_second_training_pair(problem: Dict) -> Tuple[List, List]:
    """Extract the second training input/output pair."""
    if 'train' not in problem or len(problem['train']) < 2:
        raise ValueError("Not enough training examples found in problem")

    second_train = problem['train'][1]
    return second_train['input'], second_train['output']


def extract_first_test_input(problem: Dict) -> List:
    """Extract the first test input."""
    if 'test' not in problem or len(problem['test']) == 0:
        raise ValueError("No test examples found in problem")

    return problem['test'][0]['input']


def get_pretty_printed_problem(problem_path: str) -> str:
    """Get pretty printed version of problem using pretty_print_json.py."""
    result = subprocess.run(
        ['python3', 'pretty_print_json.py', problem_path, '--no-test-output'],
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout


def grid_to_image(grid: List[List[int]], cell_size: int = 30) -> Image:
    """Convert a grid to a PIL Image."""
    grid_array = np.array(grid)
    height, width = grid_array.shape
    
    rgb_image = np.zeros((height * cell_size, width * cell_size, 3), dtype=np.uint8)
    
    for y in range(height):
        for x in range(width):
            color_id = int(grid_array[y, x])
            color = PALETTE.get(color_id, (128, 128, 128))
            rgb_image[y*cell_size:(y+1)*cell_size, x*cell_size:(x+1)*cell_size] = color
    
    return Image.fromarray(rgb_image)


def save_training_images(problem: Dict, log_dir: str) -> List[str]:
    """Save all training and test images to the log directory."""
    saved_paths = []
    
    if 'train' in problem:
        for i, sample in enumerate(problem['train']):
            input_name = f"train_{i}_input.png"
            output_name = f"train_{i}_output.png"
            
            save_grid_image(sample['input'], log_dir, input_name)
            save_grid_image(sample['output'], log_dir, output_name)
            
            saved_paths.extend([
                str(Path(log_dir) / input_name),
                str(Path(log_dir) / output_name)
            ])
    
    if 'test' in problem:
        for i, sample in enumerate(problem['test']):
            input_name = f"test_{i}_input.png"
            output_name = f"test_{i}_output.png"

            save_grid_image(sample['input'], log_dir, input_name)
            save_grid_image(sample['output'], log_dir, output_name)

            saved_paths.extend([
                str(Path(log_dir) / input_name),
                str(Path(log_dir) / output_name)
            ])
    
    return saved_paths

def print_validation_result(is_valid: bool, problem_path: str) -> None:
    """Print validation result."""
    problem_name = Path(problem_path).stem
    if is_valid:
        print(f"✅ SUCCESS {problem_name}: Prediction matches expected output")
    else:
        print(f"❌ FAIL {problem_name}: Prediction does not match expected output")

