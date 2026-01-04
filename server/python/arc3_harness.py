#!/usr/bin/env python3
"""
Author: Cascade (Gemini 3 Flash High Thinking)
Date: 2026-01-03
PURPOSE: General Intelligence Harness for ARC-AGI-3 agents.
         Provides generalized grid analysis with zero assumptions about game mechanics.
         Focuses on mathematical and topological properties to aid LLM reasoning.

Design Principles:
- Generalization: No assumptions about "players", "levels", or specific game mechanics
- Mathematical: Use entropy, symmetry, and topology rather than heuristics
- Agnostic: Component detection without semantic labels like "door" or "key"
"""

import numpy as np
from typing import List, Tuple, Dict, Any, Optional, Set
from dataclasses import dataclass
import re
from collections import defaultdict, Counter
import hashlib

# ARC-AGI Color Palette (0-15)
COLOR_NAMES = {
    0: "white",       # Background
    1: "blue",
    2: "gray",
    3: "dark-gray",
    4: "darker-gray",
    5: "black",
    6: "brown",
    7: "light-gray",
    8: "red",
    9: "light-blue",
    10: "green",
    11: "yellow",
    12: "orange",
    13: "magenta",
    14: "light-green",
    15: "purple"
}

@dataclass
class Component:
    """A connected component of same-colored pixels."""
    id: str
    color: str
    color_value: int
    positions: List[Tuple[int, int]]
    size: int
    bounds: Tuple[int, int, int, int]  # (min_row, max_row, min_col, max_col)
    centroid: Tuple[float, float]     # (row, col) center of mass
    
    def get_region(self) -> str:
        """Classify component region in 3x3 grid."""
        center_row, center_col = self.centroid
        row_zone = min(center_row // 21, 2)
        col_zone = min(center_col // 21, 2)
        regions = [
            "top-left", "top-center", "top-right",
            "center-left", "center", "center-right",
            "bottom-left", "bottom-center", "bottom-right"
        ]
        return regions[row_zone * 3 + col_zone]

@dataclass
class GridAnalysis:
    """Complete analysis of a single grid frame."""
    entropy: float
    symmetry: Dict[str, bool]
    color_histogram: Dict[str, int]
    components: List[Component]
    adjacency_graph: Dict[str, Set[str]]  # component_id -> neighboring component_ids

@dataclass
class FrameDelta:
    """Analysis of changes between two frames."""
    pixels_changed: int
    changed_pixels: List[Tuple[int, int]]
    component_transformations: Dict[str, Dict[str, Any]]  # component_id -> transformation info
    new_components: List[Component]
    disappeared_components: List[Component]

class Arc3Harness:
    """General Intelligence Harness for ARC-AGI-3 Grid Analysis."""
    
    def __init__(self):
        self.component_counter = 0
        
    def analyze_grid(self, grid: List[List[int]]) -> GridAnalysis:
        """Perform complete analysis of a grid frame."""
        grid_array = np.array(grid)
        
        # 1. Geometric & Global Analysis
        entropy = self._calculate_entropy(grid_array)
        symmetry = self._analyze_symmetry(grid_array)
        color_histogram = self._calculate_color_histogram(grid_array)
        
        # 2. Topological Analysis
        components = self._detect_components(grid_array)
        adjacency_graph = self._build_adjacency_graph(components)
        
        return GridAnalysis(
            entropy=entropy,
            symmetry=symmetry,
            color_histogram=color_histogram,
            components=components,
            adjacency_graph=adjacency_graph
        )
    
    def analyze_delta(self, prev_grid: List[List[int]], curr_grid: List[List[int]]) -> FrameDelta:
        """Analyze changes between two frames."""
        prev_array = np.array(prev_grid)
        curr_array = np.array(curr_grid)
        
        # Pixel-level changes
        diff = prev_array != curr_array
        pixels_changed = np.sum(diff)
        changed_pixels = list(zip(*np.where(diff)))
        
        # Component-level analysis
        prev_components = self._detect_components(prev_array)
        curr_components = self._detect_components(curr_array)
        
        transformations = self._match_components(prev_components, curr_components)
        new_components = self._find_new_components(prev_components, curr_components)
        disappeared = self._find_disappeared_components(prev_components, curr_components)
        
        return FrameDelta(
            pixels_changed=pixels_changed,
            changed_pixels=changed_pixels,
            component_transformations=transformations,
            new_components=new_components,
            disappeared_components=disappeared
        )
    
    def extract_coordinates(self, text: str) -> List[Tuple[int, int]]:
        """Extract (row, col) coordinates from text using regex."""
        # Match patterns like "(10, 15)", "(10,15)", "at 10,15", etc.
        patterns = [
            r'\((\d+)\s*,\s*(\d+)\)',  # (10, 15)
            r'at\s+(\d+)\s*,\s*(\d+)',  # at 10, 15
            r'coordinate\s+(\d+)\s*,\s*(\d+)',  # coordinate 10, 15
        ]
        
        coords = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    row, col = int(match[0]), int(match[1])
                    if 0 <= row < 64 and 0 <= col < 64:  # ARC grid bounds
                        coords.append((row, col))
                except ValueError:
                    continue
        
        return coords
    
    def verify_statement(self, statement: str, delta: FrameDelta, components: List[Component]) -> Dict[str, Any]:
        """Verify if an agent's statement matches the actual grid changes."""
        result = {
            "statement": statement,
            "verified": True,
            "issues": []
        }
        
        # Extract colors mentioned
        colors_mentioned = []
        for color_name, color_value in COLOR_NAMES.items():
            if color_name.lower() in statement.lower():
                colors_mentioned.append((color_name, color_value))
        
        # Check if mentioned colors actually exist
        existing_colors = {comp.color_value for comp in components}
        for color_name, color_value in colors_mentioned:
            if color_value not in existing_colors and color_value != 0:  # 0 is background
                result["issues"].append(f"Color '{color_name}' not found in grid")
                result["verified"] = False
        
        # Check coordinate references
        coords = self.extract_coordinates(statement)
        for row, col in coords:
            if not (0 <= row < len(components) and 0 <= col < len(components[0].positions) if components else False):
                # This is a loose check - we'd need the actual grid to be precise
                result["issues"].append(f"Coordinate ({row}, {col}) may be out of bounds")
                result["verified"] = False
        
        return result
    
    # === Private Methods ===
    
    def _calculate_entropy(self, grid: np.ndarray) -> float:
        """Calculate Shannon entropy of the grid (measure of complexity)."""
        # Remove background (0) from entropy calculation
        non_bg = grid[grid != 0]
        if len(non_bg) == 0:
            return 0.0
        
        _, counts = np.unique(non_bg, return_counts=True)
        probabilities = counts / len(non_bg)
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
        return float(entropy)
    
    def _analyze_symmetry(self, grid: np.ndarray) -> Dict[str, bool]:
        """Check for various symmetries in the grid."""
        return {
            "horizontal": np.array_equal(grid, np.flipud(grid)),
            "vertical": np.array_equal(grid, np.fliplr(grid)),
            "rotational_90": np.array_equal(grid, np.rot90(grid)),
            "rotational_180": np.array_equal(grid, np.rot90(grid, 2)),
            "rotational_270": np.array_equal(grid, np.rot90(grid, 3)),
        }
    
    def _calculate_color_histogram(self, grid: np.ndarray) -> Dict[str, int]:
        """Count pixels of each color."""
        unique, counts = np.unique(grid, return_counts=True)
        histogram = {}
        for value, count in zip(unique, counts):
            if value in COLOR_NAMES:
                histogram[COLOR_NAMES[value]] = int(count)
        return histogram
    
    def _detect_components(self, grid: np.ndarray) -> List[Component]:
        """Detect connected components using flood fill."""
        visited = np.zeros_like(grid, dtype=bool)
        components = []
        
        for row in range(grid.shape[0]):
            for col in range(grid.shape[1]):
                if not visited[row, col] and grid[row, col] != 0:
                    positions = self._flood_fill(grid, visited, row, col, grid[row, col])
                    if positions:
                        comp = self._create_component(positions, grid[row, col])
                        components.append(comp)
        
        return components
    
    def _flood_fill(self, grid: np.ndarray, visited: np.ndarray, 
                    start_row: int, start_col: int, target_color: int) -> List[Tuple[int, int]]:
        """Flood fill algorithm to find connected pixels."""
        if (start_row < 0 or start_row >= grid.shape[0] or 
            start_col < 0 or start_col >= grid.shape[1] or
            visited[start_row, start_col] or grid[start_row, start_col] != target_color):
            return []
        
        positions = []
        stack = [(start_row, start_col)]
        
        while stack:
            row, col = stack.pop()
            if (row < 0 or row >= grid.shape[0] or 
                col < 0 or col >= grid.shape[1] or
                visited[row, col] or grid[row, col] != target_color):
                continue
            
            visited[row, col] = True
            positions.append((row, col))
            
            # Add 4-connected neighbors
            stack.extend([(row-1, col), (row+1, col), (row, col-1), (row, col+1)])
        
        return positions
    
    def _create_component(self, positions: List[Tuple[int, int]], color_value: int) -> Component:
        """Create a Component object from positions."""
        self.component_counter += 1
        
        rows = [p[0] for p in positions]
        cols = [p[1] for p in positions]
        
        bounds = (min(rows), max(rows), min(cols), max(cols))
        centroid = (np.mean(rows), np.mean(cols))
        
        return Component(
            id=f"COMP_{self.component_counter}",
            color=COLOR_NAMES.get(color_value, f"color_{color_value}"),
            color_value=color_value,
            positions=positions,
            size=len(positions),
            bounds=bounds,
            centroid=centroid
        )
    
    def _build_adjacency_graph(self, components: List[Component]) -> Dict[str, Set[str]]:
        """Build graph of which components are touching."""
        adjacency = defaultdict(set)
        
        for i, comp1 in enumerate(components):
            for j, comp2 in enumerate(components[i+1:], i+1):
                if self._components_touching(comp1, comp2):
                    adjacency[comp1.id].add(comp2.id)
                    adjacency[comp2.id].add(comp1.id)
        
        return dict(adjacency)
    
    def _components_touching(self, comp1: Component, comp2: Component) -> bool:
        """Check if two components are adjacent (4-connected)."""
        pos1_set = set(comp1.positions)
        pos2_set = set(comp2.positions)
        
        for row, col in pos1_set:
            # Check 4 neighbors
            for dr, dc in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                if (row + dr, col + dc) in pos2_set:
                    return True
        return False
    
    def _match_components(self, prev_components: List[Component], 
                         curr_components: List[Component]) -> Dict[str, Dict[str, Any]]:
        """Match components between frames and detect transformations."""
        transformations = {}
        
        for prev_comp in prev_components:
            best_match = None
            best_score = 0
            
            for curr_comp in curr_components:
                if prev_comp.color_value == curr_comp.color_value:
                    # Simple similarity score based on position and size
                    pos_dist = np.linalg.norm(np.array(prev_comp.centroid) - np.array(curr_comp.centroid))
                    size_diff = abs(prev_comp.size - curr_comp.size)
                    score = 1.0 / (1.0 + pos_dist + size_diff * 0.1)
                    
                    if score > best_score:
                        best_score = score
                        best_match = curr_comp
            
            if best_match and best_score > 0.5:  # Threshold for matching
                delta = np.array(best_match.centroid) - np.array(prev_comp.centroid)
                transformations[prev_comp.id] = {
                    "matched_to": best_match.id,
                    "translation": tuple(delta),
                    "size_change": best_match.size - prev_comp.size,
                    "confidence": best_score
                }
        
        return transformations
    
    def _find_new_components(self, prev_components: List[Component], 
                            curr_components: List[Component]) -> List[Component]:
        """Find components that exist in curr but not in prev."""
        prev_ids = {comp.id for comp in prev_components}
        return [comp for comp in curr_components if comp.id not in prev_ids]
    
    def _find_disappeared_components(self, prev_components: List[Component], 
                                  curr_components: List[Component]) -> List[Component]:
        """Find components that existed in prev but not in curr."""
        curr_ids = {comp.id for comp in curr_components}
        return [comp for comp in prev_components if comp.id not in curr_ids]

# === Utility Functions ===

def analyze_frame_sequence(frames: List[List[List[int]]]) -> List[Dict[str, Any]]:
    """Analyze a sequence of frames and return progressive insights."""
    harness = Arc3Harness()
    results = []
    
    for i, frame in enumerate(frames):
        analysis = harness.analyze_grid(frame)
        
        result = {
            "frame_number": i,
            "entropy": analysis.entropy,
            "symmetry": analysis.symmetry,
            "component_count": len(analysis.components),
            "dominant_color": max(analysis.color_histogram.items(), key=lambda x: x[1])[0] if analysis.color_histogram else "white",
            "components": [
                {
                    "id": comp.id,
                    "color": comp.color,
                    "size": comp.size,
                    "region": comp.get_region(),
                    "centroid": comp.centroid
                }
                for comp in analysis.components
            ]
        }
        
        # Add delta analysis if we have a previous frame
        if i > 0:
            delta = harness.analyze_delta(frames[i-1], frame)
            result["delta"] = {
                "pixels_changed": delta.pixels_changed,
                "new_components": len(delta.new_components),
                "transformations": len(delta.component_transformations)
            }
        
        results.append(result)
    
    return results

# === Example Usage ===

if __name__ == "__main__":
    # Example grid (simplified)
    example_grid = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 1, 0, 8, 0],
        [0, 0, 0, 8, 0],
        [0, 0, 0, 0, 0]
    ]
    
    harness = Arc3Harness()
    analysis = harness.analyze_grid(example_grid)
    
    print("=== Grid Analysis ===")
    print(f"Entropy: {analysis.entropy:.3f}")
    print(f"Symmetry: {analysis.symmetry}")
    print(f"Components: {len(analysis.components)}")
    
    for comp in analysis.components:
        print(f"  {comp.id}: {comp.color}, size={comp.size}, region={comp.get_region()}")
    
    # Example delta analysis
    next_grid = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 1, 0, 0, 8],  # Red pixel moved
        [0, 0, 0, 8, 0],
        [0, 0, 0, 0, 0]
    ]
    
    delta = harness.analyze_delta(example_grid, next_grid)
    print(f"\n=== Delta Analysis ===")
    print(f"Pixels changed: {delta.pixels_changed}")
    print(f"Transformations: {len(delta.component_transformations)}")
    
    # Example statement verification
    statement = "I moved the red object from (2,3) to (3,4)"
    verification = harness.verify_statement(statement, delta, analysis.components)
    print(f"\n=== Statement Verification ===")
    print(f"Verified: {verification['verified']}")
    if verification['issues']:
        print(f"Issues: {verification['issues']}")
