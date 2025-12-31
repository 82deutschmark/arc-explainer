import numpy as np
import json
import argparse
import os

def get_color_char(color_id: int) -> str:
    """Return a character representation for each color"""
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

def get_color_name(color_id: int) -> str:
    """Return the color name for display"""
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

def print_array(array: np.ndarray, title: str, legend: bool):
    """Pretty print a 2D array"""
    if title:
        print(f"\n{title}")
    
    height, width = array.shape
    print(f"Size: {width}x{height}")
    
    print('\n'.join(['[' + ', '.join(str(cell) for cell in row) + ']' for row in array]))

    if legend == False:
        return
    
    # Print color legend if there are non-zero values
    unique_colors = set(array.flatten())
    unique_colors.discard(0)  # Remove background
    if unique_colors:
        print("\nColors present:")
        for color in sorted(unique_colors):
            print(f"  {get_color_char(int(color))} = {get_color_name(int(color))}")

def load_and_print_arc_json(filepath: str, no_test_output: bool = False):
    """Load and pretty print all arrays in an ARC JSON file"""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # print(f"\n{'='*60}")
    # print(f"File: {filepath}")
    # print(f"{'='*60}")
    
    # Process training examples
    if 'train' in data:
        for i, sample in enumerate(data['train']):
            if 'input' in sample:
                print_array(np.array(sample['input']), f"Training Example {i+1} - Input", False)
            if 'output' in sample:
                print_array(np.array(sample['output']), f"Training Example {i+1} - Output", True)
            print("-" * 80)
    
    # Process test examples
    if 'test' in data:
        for i, sample in enumerate(data['test']):
            if 'input' in sample:
                print_array(np.array(sample['input']), f"Test Example {i+1} - Input", False)
            if 'output' in sample and not no_test_output:
                print_array(np.array(sample['output']), f"Test Example {i+1} - Output", True)
            print("-" * 80)

def main():
    parser = argparse.ArgumentParser(description='Pretty print arrays from ARC JSON files')
    parser.add_argument('input', help='Input file (JSON file path or 8-character hash)')
    parser.add_argument('--compact', '-c', action='store_true', help='Use compact output (no spaces between characters)')
    parser.add_argument('--no-test-output', action='store_true', help='Omit test outputs from display')
    args = parser.parse_args()
    
    input_path = args.input
    
    # Check if input is a hash (8 character hex string)
    if len(args.input) == 8 and all(c in '0123456789abcdef' for c in args.input.lower()):
        # Try to find the file in ARC-AGI-2 data directories
        possible_paths = [
            f"ARC-AGI-2/data/evaluation/{args.input}.json",
            f"ARC-AGI-2/data/training/{args.input}.json",
            f"ARC-AGI-2/data/validation/{args.input}.json"
        ]
        for path in possible_paths:
            if os.path.exists(path):
                input_path = path
                break
        else:
            print(f"Error: Could not find file with hash {args.input} in ARC-AGI-2 directories")
            return
    
    # Check if file exists
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        return
    
    # Load and print the JSON file
    try:
        load_and_print_arc_json(input_path, args.no_test_output)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON file: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()