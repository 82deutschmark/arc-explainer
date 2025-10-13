"""
Heuristic ARC Solver Package

A minimal ARC transform learner and predictor that learns transformations
from training examples and applies them to test inputs.

Modules:
- grids: Grid operations and utilities
- prims: Parameterized transform primitives
- program: Pipeline search and composition logic
- cli: JSON contract interface for backend integration

Author: Max Power
Date: 2025-10-12
PURPOSE: Minimal ARC transform learner + predictor for integration with ARC Explainer
SRP/DRY check: Pass - Each module has single responsibility
"""

from . import grids, prims, program, cli

__version__ = "0.1.0"
__all__ = ["grids", "prims", "program", "cli"]
