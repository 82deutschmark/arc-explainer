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

class ExecutionTimeout(Exception):
    """Raised when code execution exceeds timeout"""
    pass

def validate_ast(code: str) -> tuple[bool, str]:
    """Validate Python code AST - block dangerous operations"""
    try:
        tree = ast.parse(code)

        # Check for dangerous nodes
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                return (False, "Imports not allowed")
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
            
            result = execute_program(program, test_inputs)
            
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
                result = execute_program(code, training_inputs)
                results.append({
                    "programIdx": idx,
                    "code": code,
                    **result
                })

            # Output NDJSON
            sys.stdout.write(json.dumps({"type": "execution_results", "results": results}) + "\n")
            sys.stdout.flush()
            return 0

    except Exception as e:
        sys.stderr.write(json.dumps({"type": "error", "message": str(e)}) + "\n")
        sys.stderr.flush()
        return 1

if __name__ == "__main__":
    sys.exit(main())
