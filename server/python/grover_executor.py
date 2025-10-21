#!/usr/bin/env python3
"""
Author: Cascade using Sonnet 4.5
Date: 2025-10-09
Updated: 2025-10-11 by Sonnet 4.5
PURPOSE: Grover code execution sandbox - executes LLM-generated Python code safely.
Supports two modes:
  1. Training mode: {"programs": [...], "training_inputs": [...]}
  2. Test mode: {"mode": "test", "program": "...", "test_inputs": [...]}
Writes stdout: NDJSON events with execution results
SRP/DRY check: Pass - Single responsibility (safe code execution only)
CROSS-PLATFORM: Uses threading for timeout (works on Windows + Unix)
"""
import sys
import json
import ast
import threading
from typing import Dict, List, Any, Optional

# Whitelist of safe modules Grover programs are allowed to import.
# NOTE: Puzzle solutions occasionally rely on small portions of the Python
# standard library (e.g., `copy.deepcopy`, `itertools.product`). Blocking
# imports entirely caused otherwise valid solutions to fail AST validation.
# The whitelist intentionally mirrors deterministic, side-effect free modules.
SAFE_IMPORT_MODULES: tuple[str, ...] = (
    "collections",
    "collections.abc",
    "copy",
    "functools",
    "itertools",
    "math",
    "statistics",
    "typing",
)


def _is_safe_import(module_name: str | None) -> bool:
    """Return True if the import target is included in the safe whitelist."""
    if not module_name:
        return False

    # Accept either the exact module or any parent module in the whitelist so
    # statements like `from collections import Counter` or
    # `from collections.abc import Iterable` succeed.
    target = module_name
    while target:
        if target in SAFE_IMPORT_MODULES:
            return True
        if "." not in target:
            break
        target = target.rsplit(".", 1)[0]
    return module_name in SAFE_IMPORT_MODULES

class ExecutionTimeout(Exception):
    """Raised when code execution exceeds timeout"""
    pass

def validate_ast(code: str) -> tuple[bool, str]:
    """Validate Python code AST - block dangerous operations"""
    try:
        tree = ast.parse(code)

        # Check for dangerous nodes
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if not _is_safe_import(alias.name):
                        return (False, f"Import of '{alias.name}' not allowed")
            if isinstance(node, ast.ImportFrom):
                module_name = node.module or ""
                if not _is_safe_import(module_name):
                    return (False, f"Import from '{module_name or node.names[0].name}' not allowed")
            # Note: ast.Exec was removed in Python 3 (exec is now a function, checked below)
            if isinstance(node, ast.Call):
                # Block dangerous function calls
                if isinstance(node.func, ast.Name):
                    if node.func.id in ('eval', 'exec', 'compile', '__import__', 'open'):
                        return (False, f"Function {node.func.id}() not allowed")

        return (True, "")
    except SyntaxError as e:
        return (False, f"Syntax error: {str(e)}")

def execute_program(code: str, inputs: List[List[List[int]]]) -> Dict[str, Any]:
    """
    Execute program on training inputs with 5s timeout (cross-platform via threading)

    Args:
        code: Python code defining transform(grid) function
        inputs: Training input grids

    Returns:
        {"outputs": [...], "error": str|None}
    """
    # Validate AST
    valid, error_msg = validate_ast(code)
    if not valid:
        return {"outputs": [], "error": f"AST validation failed: {error_msg}"}

    # Execution state shared between threads
    result: Dict[str, Any] = {"outputs": [], "error": None}
    exception_holder: List[Optional[Exception]] = [None]

    def _run_execution():
        """Inner function that runs in separate thread"""
        try:
            # Create isolated namespace
            namespace = {}
            exec(code, namespace)

            # Check for transform function
            if 'transform' not in namespace:
                exception_holder[0] = ValueError("Code must define transform(grid) function")
                return

            transform_fn = namespace['transform']

            # Execute on all inputs
            outputs = []
            for input_grid in inputs:
                output = transform_fn(input_grid)
                outputs.append(output)

            result["outputs"] = outputs
            result["error"] = None

        except Exception as e:
            exception_holder[0] = e

    # Run execution in separate thread with timeout
    execution_thread = threading.Thread(target=_run_execution, daemon=True)
    execution_thread.start()
    execution_thread.join(timeout=5.0)

    # Check if timeout occurred
    if execution_thread.is_alive():
        # Timeout - thread is still running
        return {"outputs": [], "error": "Execution timeout (5s)"}

    # Check if exception occurred
    if exception_holder[0]:
        e = exception_holder[0]
        return {"outputs": [], "error": f"{type(e).__name__}: {str(e)}"}

    return result

def main():
    """Main entry point - reads stdin, executes, writes stdout"""
    try:
        payload = json.loads(sys.stdin.read())
        mode = payload.get('mode', 'training')
        
        if mode == 'test':
            # Test execution mode: single program on test inputs
            program = payload.get('program', '')
            test_inputs = payload.get('test_inputs', [])

            if not program:
                raise ValueError("Test mode requires 'program' field")
            if not test_inputs:
                raise ValueError("Test mode requires 'test_inputs' field")

            # Emit start event
            sys.stdout.write(json.dumps({
                "type": "log",
                "level": "info",
                "message": f"🎯 Executing best program on {len(test_inputs)} test input(s)..."
            }) + "\n")
            sys.stdout.flush()

            result = execute_program(program, test_inputs)

            # Emit completion event
            if result["error"]:
                sys.stdout.write(json.dumps({
                    "type": "log",
                    "level": "error",
                    "message": f"❌ Test execution failed: {result['error']}"
                }) + "\n")
            else:
                sys.stdout.write(json.dumps({
                    "type": "log",
                    "level": "info",
                    "message": f"✅ Generated predictions for {len(result['outputs'])} test case(s)"
                }) + "\n")
            sys.stdout.flush()

            # Output test execution result
            sys.stdout.write(json.dumps({
                "type": "test_execution_result",
                "outputs": result["outputs"],
                "error": result["error"]
            }) + "\n")
            sys.stdout.flush()
            return 0
            
        else:
            # Training mode: multiple programs on training inputs
            programs = payload.get('programs', [])
            training_inputs = payload.get('training_inputs', [])

            results = []
            for idx, code in enumerate(programs):
                # Emit start event BEFORE execution
                sys.stdout.write(json.dumps({
                    "type": "log",
                    "level": "info",
                    "message": f"⚙️  Executing program {idx + 1} of {len(programs)}..."
                }) + "\n")
                sys.stdout.flush()

                result = execute_program(code, training_inputs)

                # Emit result event AFTER execution
                if result["error"]:
                    sys.stdout.write(json.dumps({
                        "type": "log",
                        "level": "warn",
                        "message": f"❌ Program {idx + 1} failed: {result['error']}"
                    }) + "\n")
                else:
                    sys.stdout.write(json.dumps({
                        "type": "log",
                        "level": "info",
                        "message": f"✅ Program {idx + 1} executed successfully"
                    }) + "\n")
                sys.stdout.flush()

                results.append({
                    "programIdx": idx,
                    "code": code,
                    **result
                })

            # Output final results
            sys.stdout.write(json.dumps({"type": "execution_results", "results": results}) + "\n")
            sys.stdout.flush()
            return 0

    except Exception as e:
        sys.stderr.write(json.dumps({"type": "error", "message": str(e)}) + "\n")
        sys.stderr.flush()
        return 1

if __name__ == "__main__":
    sys.exit(main())
