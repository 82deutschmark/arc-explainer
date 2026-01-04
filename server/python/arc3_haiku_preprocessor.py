#!/usr/bin/env python3
"""
Author: Claude Sonnet 4
Date: 2026-01-03
PURPOSE: Clean data extraction for Haiku 4.5 agent - objects, positions, changes.
         NO mathematical analysis (entropy, symmetry, components, etc.)
         Child-like descriptions for vision-first learning.
SRP/DRY check: Pass - isolated preprocessing, no game logic.
"""

from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict


# ARC color palette - human-readable names
ARC_COLORS = {
    0: "black",      # Background
    1: "blue",
    2: "red",
    3: "green",
    4: "yellow",
    5: "gray",
    6: "pink",
    7: "orange",
    8: "cyan",
    9: "brown",
}


def get_color_name(value: int) -> str:
    """Convert numeric color value to human-readable name."""
    return ARC_COLORS.get(value, f"color-{value}")


def get_position_zone(row: int, col: int, height: int, width: int) -> str:
    """
    Convert pixel coordinates to 9-zone grid position.
    Returns: 'top-left', 'center', 'bottom-right', etc.
    """
    # Divide into thirds
    row_zone = "top" if row < height / 3 else ("bottom" if row >= 2 * height / 3 else "middle")
    col_zone = "left" if col < width / 3 else ("right" if col >= 2 * width / 3 else "center")
    
    if row_zone == "middle" and col_zone == "center":
        return "center"
    elif row_zone == "middle":
        return f"center-{col_zone}"
    elif col_zone == "center":
        return f"{row_zone}-center"
    else:
        return f"{row_zone}-{col_zone}"


def classify_shape(pixels: List[Tuple[int, int]], bounds: Dict) -> str:
    """
    Classify a group of connected pixels as a shape.
    Simple heuristics - no complex analysis.
    """
    count = len(pixels)
    if count == 0:
        return "empty"
    if count == 1:
        return "dot"
    
    height = bounds["max_row"] - bounds["min_row"] + 1
    width = bounds["max_col"] - bounds["min_col"] + 1
    area = height * width
    fill_ratio = count / area if area > 0 else 0
    
    # Simple shape classification
    if height == 1 and width > 2:
        return "horizontal-line"
    if width == 1 and height > 2:
        return "vertical-line"
    if height == width and fill_ratio > 0.8:
        return "square"
    if fill_ratio > 0.8:
        return "rectangle"
    if fill_ratio < 0.3:
        return "scattered"
    if fill_ratio < 0.6:
        return "sparse-shape"
    return "shape"


def find_connected_components(grid: List[List[int]], background: int = 0) -> List[Dict]:
    """
    Find discrete objects (connected components) in the grid.
    Uses simple flood-fill approach.
    
    Returns list of objects with:
    - color: human-readable color name
    - shape: classified shape type
    - position: 9-zone grid position
    - bounds: bounding box coordinates
    - size: pixel count
    - center: approximate center point
    """
    if not grid or not grid[0]:
        return []
    
    height = len(grid)
    width = len(grid[0])
    visited = [[False] * width for _ in range(height)]
    objects = []
    
    def flood_fill(start_row: int, start_col: int, color: int) -> List[Tuple[int, int]]:
        """Simple flood fill to find connected pixels of same color."""
        stack = [(start_row, start_col)]
        pixels = []
        
        while stack:
            r, c = stack.pop()
            if r < 0 or r >= height or c < 0 or c >= width:
                continue
            if visited[r][c] or grid[r][c] != color:
                continue
            
            visited[r][c] = True
            pixels.append((r, c))
            
            # 4-connectivity (not diagonal)
            stack.extend([(r-1, c), (r+1, c), (r, c-1), (r, c+1)])
        
        return pixels
    
    for row in range(height):
        for col in range(width):
            if visited[row][col]:
                continue
            
            color_val = grid[row][col]
            if color_val == background:
                visited[row][col] = True
                continue
            
            # Found a new object
            pixels = flood_fill(row, col, color_val)
            if not pixels:
                continue
            
            # Compute bounds
            rows = [p[0] for p in pixels]
            cols = [p[1] for p in pixels]
            bounds = {
                "min_row": min(rows),
                "max_row": max(rows),
                "min_col": min(cols),
                "max_col": max(cols),
            }
            
            # Center point
            center_row = sum(rows) // len(rows)
            center_col = sum(cols) // len(cols)
            
            objects.append({
                "color": get_color_name(color_val),
                "color_value": color_val,
                "shape": classify_shape(pixels, bounds),
                "position": get_position_zone(center_row, center_col, height, width),
                "bounds": bounds,
                "size": len(pixels),
                "center": (center_row, center_col),
            })
    
    # Sort by size (largest first) for more natural descriptions
    objects.sort(key=lambda x: -x["size"])
    return objects


def extract_objects(grid: List[List[int]], background: int = 0) -> List[Dict]:
    """
    Main entry point: extract clean object descriptions from grid.
    
    Args:
        grid: 2D grid of color values (single layer)
        background: background color value (default 0 = black)
    
    Returns:
        List of object descriptions suitable for Haiku
    """
    # Handle 3D frames (take first layer)
    if grid and isinstance(grid[0], list) and grid[0] and isinstance(grid[0][0], list):
        grid = grid[0]
    
    return find_connected_components(grid, background)


def detect_changes(
    prev_grid: Optional[List[List[int]]],
    curr_grid: List[List[int]],
    prev_objects: Optional[List[Dict]] = None,
    curr_objects: Optional[List[Dict]] = None
) -> Dict:
    """
    Detect what changed between two frames.
    Returns human-readable change summary.
    
    Args:
        prev_grid: Previous frame grid (2D)
        curr_grid: Current frame grid (2D)
        prev_objects: Optional pre-computed objects from previous frame
        curr_objects: Optional pre-computed objects from current frame
    
    Returns:
        Dictionary with:
        - pixels_changed: count of changed pixels
        - objects_moved: list of movements detected
        - new_objects: list of new objects
        - disappeared_objects: list of vanished objects
        - summary: human-readable one-liner
    """
    if prev_grid is None:
        return {
            "pixels_changed": 0,
            "objects_moved": [],
            "new_objects": [],
            "disappeared_objects": [],
            "summary": "First frame - no previous state to compare",
        }
    
    # Handle 3D frames
    if prev_grid and isinstance(prev_grid[0], list) and prev_grid[0] and isinstance(prev_grid[0][0], list):
        prev_grid = prev_grid[0]
    if curr_grid and isinstance(curr_grid[0], list) and curr_grid[0] and isinstance(curr_grid[0][0], list):
        curr_grid = curr_grid[0]
    
    # Count pixel changes
    pixels_changed = 0
    try:
        for r in range(min(len(prev_grid), len(curr_grid))):
            for c in range(min(len(prev_grid[r]), len(curr_grid[r]))):
                if prev_grid[r][c] != curr_grid[r][c]:
                    pixels_changed += 1
    except (IndexError, TypeError):
        pixels_changed = -1  # Error marker
    
    # Get objects if not provided
    if prev_objects is None:
        prev_objects = extract_objects(prev_grid)
    if curr_objects is None:
        curr_objects = extract_objects(curr_grid)
    
    # Match objects by color and approximate size
    objects_moved = []
    new_objects = []
    disappeared_objects = []
    
    # Group by color
    prev_by_color = defaultdict(list)
    curr_by_color = defaultdict(list)
    
    for obj in prev_objects:
        prev_by_color[obj["color"]].append(obj)
    for obj in curr_objects:
        curr_by_color[obj["color"]].append(obj)
    
    all_colors = set(prev_by_color.keys()) | set(curr_by_color.keys())
    
    for color in all_colors:
        prev_list = prev_by_color.get(color, [])
        curr_list = curr_by_color.get(color, [])
        
        if not prev_list and curr_list:
            # New objects of this color appeared
            for obj in curr_list:
                new_objects.append({
                    "color": color,
                    "position": obj["position"],
                    "size": obj["size"],
                })
        elif prev_list and not curr_list:
            # Objects of this color disappeared
            for obj in prev_list:
                disappeared_objects.append({
                    "color": color,
                    "position": obj["position"],
                    "size": obj["size"],
                })
        elif len(prev_list) == 1 and len(curr_list) == 1:
            # Single object of this color - check if it moved
            prev_obj = prev_list[0]
            curr_obj = curr_list[0]
            
            delta_row = curr_obj["center"][0] - prev_obj["center"][0]
            delta_col = curr_obj["center"][1] - prev_obj["center"][1]
            
            if delta_row != 0 or delta_col != 0:
                # Describe movement in human terms
                direction_parts = []
                if delta_row < 0:
                    direction_parts.append(f"{abs(delta_row)} up")
                elif delta_row > 0:
                    direction_parts.append(f"{delta_row} down")
                if delta_col < 0:
                    direction_parts.append(f"{abs(delta_col)} left")
                elif delta_col > 0:
                    direction_parts.append(f"{delta_col} right")
                
                direction = " and ".join(direction_parts) if direction_parts else "stayed"
                
                objects_moved.append({
                    "color": color,
                    "from_center": prev_obj["center"],
                    "to_center": curr_obj["center"],
                    "delta": (delta_row, delta_col),
                    "description": f"{color.title()} {prev_obj['shape']} moved {direction}",
                })
    
    # Build summary
    if pixels_changed == 0:
        summary = "No visible changes"
    elif objects_moved:
        move_desc = objects_moved[0]["description"]
        if len(objects_moved) > 1:
            move_desc += f" (and {len(objects_moved) - 1} more)"
        summary = move_desc
    elif new_objects:
        summary = f"New {new_objects[0]['color']} object appeared at {new_objects[0]['position']}"
    elif disappeared_objects:
        summary = f"{disappeared_objects[0]['color'].title()} object disappeared from {disappeared_objects[0]['position']}"
    else:
        summary = f"{pixels_changed} pixels changed"
    
    return {
        "pixels_changed": pixels_changed,
        "objects_moved": objects_moved,
        "new_objects": new_objects,
        "disappeared_objects": disappeared_objects,
        "summary": summary,
    }


def preprocess_frame(
    frame_data: Dict[str, Any],
    prev_frame_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main preprocessing entry point for Haiku agent.
    
    Args:
        frame_data: Current frame from ARC3 API (contains "frame", "score", "state", etc.)
        prev_frame_data: Previous frame (optional, for change detection)
    
    Returns:
        FrameContext dict with objects, changes, score, state - all human-readable
    """
    # Extract grid from frame_data
    current_grid = frame_data.get("frame", [])
    if not current_grid:
        return {
            "objects": [],
            "grid_state": {"width": 0, "height": 0},
            "changes_from_previous": None,
            "score": frame_data.get("score", 0),
            "state": frame_data.get("state", "UNKNOWN"),
        }
    
    # Handle 3D frames (layers)
    if current_grid and isinstance(current_grid[0], list) and current_grid[0] and isinstance(current_grid[0][0], list):
        display_grid = current_grid[0]
    else:
        display_grid = current_grid
    
    # Extract objects
    objects = extract_objects(display_grid)
    
    # Grid state
    height = len(display_grid) if display_grid else 0
    width = len(display_grid[0]) if display_grid and display_grid[0] else 0
    non_bg_pixels = sum(1 for row in display_grid for cell in row if cell != 0)
    
    # Detect changes if we have previous frame
    changes = None
    if prev_frame_data:
        prev_grid = prev_frame_data.get("frame", [])
        if prev_grid and isinstance(prev_grid[0], list) and prev_grid[0] and isinstance(prev_grid[0][0], list):
            prev_grid = prev_grid[0]
        changes = detect_changes(prev_grid, display_grid)
    
    return {
        "objects": objects,
        "grid_state": {
            "width": width,
            "height": height,
            "non_background_pixels": non_bg_pixels,
        },
        "changes_from_previous": changes,
        "score": frame_data.get("score", 0),
        "state": frame_data.get("state", "NOT_FINISHED"),
    }


def describe_objects_for_haiku(objects: List[Dict], max_objects: int = 5) -> str:
    """
    Generate natural language description of objects for Haiku.
    
    Args:
        objects: List of object dicts from extract_objects
        max_objects: Maximum number to describe (to avoid overwhelming)
    
    Returns:
        Human-readable description string
    """
    if not objects:
        return "The grid appears empty or all one color."
    
    lines = []
    for i, obj in enumerate(objects[:max_objects]):
        size_desc = "small" if obj["size"] < 10 else ("large" if obj["size"] > 50 else "medium")
        lines.append(f"- {obj['color'].title()} {obj['shape']} ({size_desc}) at {obj['position']}")
    
    if len(objects) > max_objects:
        lines.append(f"- ...and {len(objects) - max_objects} more objects")
    
    return "\n".join(lines)


if __name__ == "__main__":
    # Simple test
    test_grid = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 0, 0, 2, 2],
        [0, 0, 0, 2, 2],
    ]
    
    objects = extract_objects(test_grid)
    print("Objects found:")
    for obj in objects:
        print(f"  {obj['color']} {obj['shape']} at {obj['position']} (size={obj['size']})")
    
    print("\nDescription:")
    print(describe_objects_for_haiku(objects))
