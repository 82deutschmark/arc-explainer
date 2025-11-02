#!/usr/bin/env python3
"""
Grid Visualization Service

Author: Sonnet 4.5 using Sonnet 4.5
Date: 2025-10-09T00:07:00-04:00
PURPOSE: ONLY generates PNG images from ARC grids. NO API calls. NO solver logic.
This is a pure visualization service that reads grid data from stdin and outputs
PNG file paths and base64-encoded images to stdout. Completely isolated from AI providers.
SRP/DRY check: Pass - Single responsibility (visualization), no AI logic, no duplicate code
shadcn/ui: Pass - Python backend utility, no UI components
"""
import sys
import json
import base64
import os
from typing import List, Dict, Any
from PIL import Image
import numpy as np

# ARC-AGI standard color palette (0-9)
ARC_COLORS = {
    0: (0, 0, 0),        # Black (background)
    1: (0, 116, 217),    # Blue
    2: (255, 65, 54),    # Red
    3: (46, 204, 64),    # Green
    4: (255, 220, 0),    # Yellow
    5: (128, 128, 128),  # Grey
    6: (240, 18, 190),   # Magenta/Pink
    7: (255, 133, 27),   # Orange
    8: (127, 219, 255),  # Light Blue/Cyan
    9: (128, 0, 0)       # Maroon
}


def grid_to_image(grid: List[List[int]], cell_size: int = 30) -> Image.Image:
    """
    Convert a 2D grid to a PIL Image using ARC color palette
    
    Args:
        grid: 2D list of integers (0-9) representing the grid
        cell_size: Size of each cell in pixels (default: 30)
    
    Returns:
        PIL Image object
    """
    if not grid or not grid[0]:
        raise ValueError("Grid is empty or malformed")
    
    height = len(grid)
    width = len(grid[0])
    
    # Create numpy array for the image (RGB)
    img_array = np.zeros((height * cell_size, width * cell_size, 3), dtype=np.uint8)
    
    # Fill in the colors
    for i, row in enumerate(grid):
        for j, value in enumerate(row):
            # Get color from palette, default to grey if invalid
            color = ARC_COLORS.get(value, (128, 128, 128))
            y_start = i * cell_size
            y_end = (i + 1) * cell_size
            x_start = j * cell_size
            x_end = (j + 1) * cell_size
            img_array[y_start:y_end, x_start:x_end] = color
    
    return Image.fromarray(img_array)


def encode_image_base64(image_path: str) -> str:
    """
    Encode an image file to base64 string
    
    Args:
        image_path: Path to the image file
    
    Returns:
        Base64-encoded string
    """
    try:
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        print(f"Warning: Failed to encode {image_path}: {e}", file=sys.stderr)
        return ''


def main():
    """
    Main entry point - reads JSON from stdin, generates images, outputs results to stdout
    
    Expected stdin format:
    {
        "grids": [[[...]], [[...]], ...],
        "taskId": "puzzle_id",
        "cellSize": 30
    }
    
    Output format:
    {
        "type": "visualization_complete",
        "imagePaths": ["/path/to/img1.png", ...],
        "base64Images": ["base64data1", ...]
    }
    """
    try:
        # Read payload from stdin
        payload_raw = sys.stdin.read()
        if not payload_raw.strip():
            raise ValueError("No input provided on stdin")
        
        payload = json.loads(payload_raw)
        
        # Extract parameters
        grids = payload.get('grids', [])
        task_id = payload.get('taskId', 'unknown')
        cell_size = payload.get('cellSize', 30)
        label = payload.get('label')
        
        if not grids:
            raise ValueError("No grids provided in payload")
        
        # Determine output directory (img_tmp in solver directory)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, '..', '..'))
        temp_dir = os.path.join(project_root, 'solver', 'img_tmp')
        os.makedirs(temp_dir, exist_ok=True)
        
        image_paths = []
        base64_images = []
        
        # Generate images for each grid
        for idx, grid in enumerate(grids):
            try:
                # Validate grid structure
                if not isinstance(grid, list):
                    print(f"Warning: Grid {idx} is not a list, skipping", file=sys.stderr)
                    continue
                
                if not grid or not isinstance(grid[0], list):
                    print(f"Warning: Grid {idx} is empty or malformed, skipping", file=sys.stderr)
                    continue
                
                # Generate image
                img = grid_to_image(grid, cell_size)
                
                # Save to file with unique name
                suffix = f"_{label}" if label else ""
                img_filename = f"saturn_{task_id}{suffix}_grid_{idx:03d}.png"
                img_path = os.path.join(temp_dir, img_filename)
                img.save(img_path)
                
                # Encode to base64
                b64_data = encode_image_base64(img_path)
                
                image_paths.append(img_path)
                base64_images.append(b64_data)
                
            except Exception as grid_error:
                print(f"Error processing grid {idx}: {grid_error}", file=sys.stderr)
                # Continue with other grids
                continue
        
        if not image_paths:
            raise ValueError("No images were successfully generated")
        
        # Output success response as JSON
        result = {
            "type": "visualization_complete",
            "imagePaths": image_paths,
            "base64Images": base64_images,
            "gridCount": len(image_paths)
        }
        
        sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        return 0
        
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON input: {e}"
        sys.stderr.write(json.dumps({"type": "error", "message": error_msg}) + "\n")
        sys.stderr.flush()
        return 1
    except Exception as e:
        error_msg = f"Visualization error: {str(e)}"
        sys.stderr.write(json.dumps({"type": "error", "message": error_msg}) + "\n")
        sys.stderr.flush()
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
