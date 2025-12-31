import numpy as np
import json
from collections import deque
from typing import List, Tuple, Dict, Set
import argparse

class ConnectedAreaAnalyzer:
    def __init__(self, image: np.ndarray):
        self.image = image
        self.height, self.width = image.shape
        self.visited = np.zeros_like(image, dtype=bool)
        self.areas = []
        
    def find_connected_areas(self):
        for y in range(self.height):
            for x in range(self.width):
                if not self.visited[y, x] and self.image[y, x] != 0:
                    area = self._flood_fill(x, y)
                    if area:
                        self.areas.append(area)
        return self.areas
    
    def _flood_fill(self, start_x: int, start_y: int) -> Dict:
        color = self.image[start_y, start_x]
        pixels = []
        queue = deque([(start_x, start_y)])
        
        while queue:
            x, y = queue.popleft()
            
            if (x < 0 or x >= self.width or y < 0 or y >= self.height or 
                self.visited[y, x] or self.image[y, x] != color):
                continue
                
            self.visited[y, x] = True
            pixels.append((x, y))
            
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                queue.append((x + dx, y + dy))
        
        if not pixels:
            return None
            
        return {
            'color': int(color),
            'pixels': pixels,
            'bounds': self._get_bounds(pixels),
            'centroid': self._get_centroid(pixels),
            'holes': self._count_holes(pixels, color),
            'size': len(pixels)
        }
    
    def _get_bounds(self, pixels: List[Tuple[int, int]]) -> Dict:
        xs = [p[0] for p in pixels]
        ys = [p[1] for p in pixels]
        return {
            'min_x': min(xs),
            'max_x': max(xs),
            'min_y': min(ys),
            'max_y': max(ys)
        }
    
    def _get_centroid(self, pixels: List[Tuple[int, int]]) -> Tuple[float, float]:
        xs = [p[0] for p in pixels]
        ys = [p[1] for p in pixels]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    
    def _count_holes(self, area_pixels: List[Tuple[int, int]], color: int) -> int:
        pixel_set = set(area_pixels)
        bounds = self._get_bounds(area_pixels)
        
        # Create a sub-image for the bounding box
        sub_height = bounds['max_y'] - bounds['min_y'] + 3
        sub_width = bounds['max_x'] - bounds['min_x'] + 3
        sub_image = np.zeros((sub_height, sub_width), dtype=bool)
        
        # Mark area pixels
        for x, y in area_pixels:
            sub_image[y - bounds['min_y'] + 1, x - bounds['min_x'] + 1] = True
        
        # Flood fill from outside to find background
        visited = np.zeros_like(sub_image, dtype=bool)
        queue = deque()
        
        # Add all border pixels to queue
        for i in range(sub_width):
            queue.append((i, 0))
            queue.append((i, sub_height - 1))
        for i in range(sub_height):
            queue.append((0, i))
            queue.append((sub_width - 1, i))
        
        # Flood fill exterior
        while queue:
            x, y = queue.popleft()
            
            if (x < 0 or x >= sub_width or y < 0 or y >= sub_height or 
                visited[y, x] or sub_image[y, x]):
                continue
                
            visited[y, x] = True
            
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                queue.append((x + dx, y + dy))
        
        # Count separate hole regions
        hole_count = 0
        for y in range(1, sub_height - 1):
            for x in range(1, sub_width - 1):
                if not sub_image[y, x] and not visited[y, x]:
                    # Found a hole, flood fill it
                    hole_count += 1
                    queue = deque([(x, y)])
                    while queue:
                        hx, hy = queue.popleft()
                        if (hx < 0 or hx >= sub_width or hy < 0 or hy >= sub_height or 
                            visited[hy, hx] or sub_image[hy, hx]):
                            continue
                        visited[hy, hx] = True
                        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                            queue.append((hx + dx, hy + dy))
        
        return hole_count

def get_color_name(color_id: int) -> str:
    color_map = {
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
    return color_map.get(color_id, f"color_{color_id}")

def describe_position(centroid: Tuple[float, float], bounds: Dict, image_shape: Tuple[int, int]) -> str:
    cx, cy = centroid
    return f"({int(cx)}, {int(cy)})"

def analyze_image(image: np.ndarray, name: str = "Image", mini: bool = False) -> str:
    analyzer = ConnectedAreaAnalyzer(image)
    areas = analyzer.find_connected_areas()
    
    # Group areas by color
    color_groups = {}
    for area in areas:
        color = area['color']
        if color not in color_groups:
            color_groups[color] = []
        color_groups[color].append(area)
    
    # Sort areas within each color group by position (top to bottom, left to right)
    for color in color_groups:
        color_groups[color].sort(key=lambda a: (a['centroid'][1], a['centroid'][0]))
    
    # Generate output
    if mini:
        return generate_mini_output(name, areas, color_groups, image.shape)
    else:
        return generate_full_output(name, areas, color_groups, image.shape)

def generate_mini_output(name: str, areas: List[Dict], color_groups: Dict, image_shape: Tuple[int, int]) -> str:
    # Collect all areas and sort by position
    all_areas = []
    for area in areas:
        if area['color'] == 0:  # Skip background
            continue
        color_name = get_color_name(area['color']).title()
        holes = area['holes']
        bounds = area['bounds']
        pixels = area['size']
        cx, cy = area['centroid']
        all_areas.append((cy, cx, f"{color_name}(holes={holes}, bbox=[{bounds['min_x']},{bounds['min_y']},{bounds['max_x']},{bounds['max_y']}], pixels={pixels})"))
    
    # Sort by y then x position
    all_areas.sort(key=lambda a: (a[0], a[1]))
    
    # Format output
    area_strings = [area[2] for area in all_areas]
    return f"{name}: [{', '.join(area_strings)}]"

def generate_full_output(name: str, areas: List[Dict], color_groups: Dict, image_shape: Tuple[int, int]) -> str:
    output = [name]
    
    # Output all colored areas
    for color_id in sorted(color_groups.keys()):
        if color_id == 0:  # Skip background
            continue
            
        areas_of_color = color_groups[color_id]
        color_name = get_color_name(color_id)
        
        if areas_of_color:
            output.append(f"{color_name.title()} Blobs")
            
            for area in areas_of_color:
                holes = area['holes']
                position = describe_position(area['centroid'], area['bounds'], image_shape)
                
                if holes == 0:
                    hole_desc = "no holes"
                elif holes == 1:
                    hole_desc = "1 hole"
                else:
                    hole_desc = f"{holes} holes"
                
                bounds = area['bounds']
                pixels = area['size']
                bbox_str = f"[{bounds['min_x']},{bounds['min_y']},{bounds['max_x']},{bounds['max_y']}]"
                output.append(f"\t• Blob with {hole_desc}, {color_name}, bbox: {bbox_str}, pixels: {pixels}, centroid: {position}")
    
    
    return "\n".join(output)

def load_arc_json(filepath: str, no_test_output: bool = False) -> List[Tuple[np.ndarray, str]]:
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    images = []
    
    if 'train' in data:
        for i, sample in enumerate(data['train']):
            if 'input' in sample:
                images.append((np.array(sample['input']), f"Train input {i+1}"))
            if 'output' in sample:
                images.append((np.array(sample['output']), f"Train output {i+1}"))
    
    if 'test' in data:
        for i, sample in enumerate(data['test']):
            if 'input' in sample:
                images.append((np.array(sample['input']), f"Test input {i+1}"))
            if 'output' in sample and not no_test_output:
                images.append((np.array(sample['output']), f"Test output {i+1}"))
    
    return images

def main():
    parser = argparse.ArgumentParser(description='Analyze connected areas in images')
    parser.add_argument('input', help='Input file (JSON, numpy array, or hash)')
    parser.add_argument('-o', '--output', help='Output file (optional)')
    parser.add_argument('-m', '--mini', action='store_true', help='Use mini output format')
    parser.add_argument('--no-test-output', action='store_true', help='Omit test outputs from analysis')
    args = parser.parse_args()
    
    input_path = args.input
    
    # Check if input is a hash (8 character hex string)
    if len(args.input) == 8 and all(c in '0123456789abcdef' for c in args.input.lower()):
        # Try to find the file in ARC-AGI-2 data directories
        import os
        possible_paths = [
            f"ARC-AGI-2/data/evaluation/{args.input}.json",
            f"ARC-AGI-2/data/training/{args.input}.json",
            f"ARC-AGI-2/data/validation/{args.input}.json"
        ]
        for path in possible_paths:
            if os.path.exists(path):
                input_path = path
                # print(f"Found file: {path}")
                break
        else:
            print(f"Could not find file with hash {args.input} in ARC-AGI-2 directories")
            return
    
    # Load images
    if input_path.endswith('.json'):
        images = load_arc_json(input_path, args.no_test_output)
    else:
        # Assume it's a numpy file
        image = np.load(input_path)
        images = [(image, "Image")]
    
    # Analyze all images
    results = []
    for image, name in images:
        analysis = analyze_image(image, name, mini=args.mini)
        results.append(analysis)
    
    # Output results
    output_text = "\n\n".join(results)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output_text)
        print(f"Analysis saved to {args.output}")
    else:
        print(output_text)

if __name__ == "__main__":
    main()