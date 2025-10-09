#!/usr/bin/env python3
"""
Author: Sonnet 4.5
Date: 2025-10-08
PURPOSE: Grover code execution sandbox - executes LLM-generated Python code safely.
Reads stdin: {"programs": [...], "training_inputs": [...]}
Writes stdout: NDJSON events with execution results
SRP/DRY check: Pass - Single responsibility (safe code execution only)
"""
import sys
import json
import ast
import signal
from typing import Dict, List, Any

class ExecutionTimeout(Exception):
    """Raised when code execution exceeds timeout"""
    pass

def timeout_handler(signum, frame):
    raise ExecutionTimeout("Execution timeout (5s)")

def validate_ast(code: str) -> tuple[bool, str]:
    """Validate Python code AST - block dangerous operations"""
    try:
        tree = ast.parse(code)

        # Check for dangerous nodes
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                return (False, "Imports not allowed")
            if isinstance(node, (ast.Exec,)):
                return (False, "Exec not allowed")
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
    Execute program on training inputs with 5s timeout

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

    # Set timeout
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(5)

    try:
        # Create isolated namespace
        namespace = {}
        exec(code, namespace)

        # Check for transform function
        if 'transform' not in namespace:
            return {"outputs": [], "error": "Code must define transform(grid) function"}

        transform_fn = namespace['transform']

        # Execute on all inputs
        outputs = []
        for input_grid in inputs:
            try:
                output = transform_fn(input_grid)
                outputs.append(output)
            except Exception as e:
                return {"outputs": outputs, "error": f"Transform error: {type(e).__name__}: {str(e)}"}

        signal.alarm(0)  # Cancel timeout
        return {"outputs": outputs, "error": None}

    except ExecutionTimeout:
        signal.alarm(0)
        return {"outputs": [], "error": "Execution timeout (5s)"}
    except Exception as e:
        signal.alarm(0)
        return {"outputs": [], "error": f"{type(e).__name__}: {str(e)}"}

def main():
    """Main entry point - reads stdin, executes, writes stdout"""
    try:
        payload = json.loads(sys.stdin.read())
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
