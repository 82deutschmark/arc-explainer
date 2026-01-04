#!/usr/bin/env python3
"""
Author: Cascade
Date: 2026-01-03
PURPOSE: Test script for the General Intelligence Harness integration.
         Demonstrates harness usage with sample ARC3 grids.
SRP/DRY check: Pass - isolated test script for harness verification.
"""

import sys
import json
from pathlib import Path

# Add server/python to path for imports
sys.path.insert(0, str(Path(__file__).parent / "server" / "python"))

try:
    from arc3_harness import Arc3Harness
    print("✓ Successfully imported Arc3Harness")
except ImportError as e:
    print(f"✗ Failed to import Arc3Harness: {e}")
    sys.exit(1)

def test_basic_grid_analysis():
    """Test basic grid analysis functionality."""
    print("\n=== Testing Basic Grid Analysis ===")
    
    # Sample test grid (simple pattern)
    test_grid = [
        [0, 1, 0, 2, 0],
        [1, 1, 1, 2, 2],
        [0, 1, 0, 2, 0],
        [3, 3, 3, 0, 0],
        [0, 0, 0, 0, 0]
    ]
    
    harness = Arc3Harness()
    analysis = harness.analyze_grid(test_grid)
    
    print(f"Grid entropy: {analysis.entropy:.3f}")
    print(f"Components found: {len(analysis.components)}")
    print(f"Symmetry axes: {sum(analysis.symmetry.values())}/5")
    
    for comp in analysis.components:
        print(f"  Component: color={comp.color}, size={comp.size}, bounds={comp.bounds}")
    
    return analysis

def test_delta_analysis():
    """Test frame delta analysis."""
    print("\n=== Testing Delta Analysis ===")
    
    # Initial grid
    grid1 = [
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0]
    ]
    
    # After some action (moved the red component)
    grid2 = [
        [0, 0, 1],
        [0, 1, 1],
        [0, 0, 1]
    ]
    
    harness = Arc3Harness()
    delta = harness.analyze_delta(grid1, grid2)
    
    print(f"Pixels changed: {delta.pixels_changed}")
    print(f"Component transformations: {len(delta.component_transformations)}")
    
    for transform in delta.component_transformations:
        print(f"  {transform}")
    
    return delta

def test_coordinate_extraction():
    """Test coordinate extraction from text."""
    print("\n=== Testing Coordinate Extraction ===")
    
    test_texts = [
        "I should click at position (3, 4) to activate the switch",
        "The target is at coordinates 2,5",
        "Move to (1, 1) then press ACTION6",
        "No coordinates in this text"
    ]
    
    harness = Arc3Harness()
    
    for text in test_texts:
        coords = harness.extract_coordinates(text)
        print(f"Text: {text[:50]}...")
        print(f"  Extracted: {coords}")
    
    return coords

def test_statement_verification():
    """Test statement verification against grid state."""
    print("\n=== Testing Statement Verification ===")
    
    grid = [
        [0, 2, 0],
        [1, 1, 1],
        [0, 2, 0]
    ]
    
    statements = [
        "The red component is at position (1, 0)",
        "There are 3 blue pixels",
        "The grid has high symmetry",
        "I moved the component from (0, 1) to (2, 1)"
    ]
    
    harness = Arc3Harness()
    analysis = harness.analyze_grid(grid)
    
    for statement in statements:
        verification = harness.verify_statement(statement, None, analysis.components)
        print(f"Statement: {statement}")
        print(f"  Verified: {verification['verified']}")
        if not verification['verified']:
            print(f"  Issues: {verification['issues']}")
    
    return verification

def main():
    """Run all tests."""
    print("General Intelligence Harness Test Suite")
    print("=" * 50)
    
    try:
        # Run all tests
        test_basic_grid_analysis()
        test_delta_analysis()
        test_coordinate_extraction()
        test_statement_verification()
        
        print("\n" + "=" * 50)
        print("✓ All tests completed successfully!")
        print("\nThe General Intelligence Harness is ready for integration")
        print("with ARC3 agents for mathematical grid analysis.")
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
